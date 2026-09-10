import { writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { OUT } from './config.mjs'

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// 広告に出てくる文字をぜんぶ集めて、その字だけの版を取りにいく（1 ファイル数 KB で済む）
const COPY = `
バトルで負けるのは、いい。締切で負けるのは、もったいない。
エントリー費の入金、音源の提出。出ると決めたあとが、いちばん抜ける。
出る大会の準備を、1 か所に。
入金したか、残りいくらか 期限が近いものは先頭に出ます
音源を出したか、当日持参か 当日持参なら催促は出ません
予選とファイナルを 1 つに 日程が未発表でも権利は記録できます
誰がジャッジで、何が課題か 次の大会に持っていけます
インストール不要。ブラウザで開くだけ。
iPhone / Android・無料 入れた内容は、あなたの端末の中だけ
ダンスコンテストの準備を、落とさないために。
会場・ジャッジ・振り返りまで、大会ごとにまとめて持てる道具です。
スマホのブラウザで開くだけ。アプリストアは要りません。
無料 端末の中だけに保存 通知あり カレンダーに書き出し
締切が近いものは、開いた瞬間いちばん上に出る。
使い方はこちら 詳しくはこちら 今すぐ開く
入金 音源 会場 ファイナル ジャッジ 振り返り 通知 カレンダー 共有
０１２３４５６７８９
`
// 差し替えが効くように、かなと記号は全部入れておく（数 KB 増えるだけ）
const RANGES = [
  [0x3041, 0x309f], // ひらがな
  [0x30a0, 0x30ff], // カタカナ
  [0x0020, 0x007e], // ASCII
  [0xff01, 0xff5e], // 全角英数記号
  [0x3000, 0x303f], // 句読点・かっこ
  [0x2010, 0x201f], // ダッシュ・引用符
  [0x00b7, 0x00b7],
]
const extra = []
for (const [from, to] of RANGES) for (let code = from; code <= to; code += 1) extra.push(String.fromCharCode(code))
const chars = [...new Set([...COPY, ...extra].filter((c) => c.trim() !== ''))].join('')
const encoded = encodeURIComponent(chars)

const faces = []
for (const weight of [400, 700, 900]) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encoded}`
  const css = execFileSync('curl', ['-sS', '-m', '40', '-A', UA, cssUrl], { encoding: 'utf8', maxBuffer: 1 << 24 })
  const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)
  if (!match) throw new Error(`weight ${weight}: src が見つからない\n${css.slice(0, 300)}`)
  const bin = execFileSync('curl', ['-sS', '-m', '40', '-A', UA, match[1]], { maxBuffer: 1 << 26 })
  console.log(`weight ${weight}: ${(bin.length / 1024).toFixed(1)} KB`)
  faces.push(
    `@font-face{font-family:'Noto Sans JP';font-style:normal;font-weight:${weight};` +
      `src:url(data:font/woff2;base64,${bin.toString('base64')}) format('woff2')}`,
  )
}
writeFileSync(`${OUT}/jp-font.css`, faces.join('\n'))
console.log('chars', chars.length, '→ out/jp-font.css')
