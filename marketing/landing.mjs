import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/**
 * 使う字だけの日本語フォントを取ってきて、data URI として埋め込む。
 * 外部から font を読ませないので、回線が細くても文字が化けず、表示も遅れない。
 */
function embedJpFont(text) {
  const RANGES = [[0x3041, 0x309f], [0x30a0, 0x30ff], [0x0020, 0x007e], [0xff01, 0xff5e], [0x3000, 0x303f], [0x2010, 0x201f]]
  const extra = []
  for (const [from, to] of RANGES) for (let c = from; c <= to; c += 1) extra.push(String.fromCharCode(c))
  const chars = [...new Set([...text, ...extra].filter((c) => c.trim() !== ''))].join('')
  const faces = []
  for (const weight of [400, 700, 900]) {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@${weight}&text=${encodeURIComponent(chars)}`
    const css = execFileSync('curl', ['-sS', '-m', '40', '-A', UA, url], { encoding: 'utf8', maxBuffer: 1 << 24 })
    const m = css.match(/src:\s*url\(([^)]+)\)\s*format\('woff2'\)/)
    if (!m) throw new Error(`weight ${weight} の取得に失敗`)
    const bin = execFileSync('curl', ['-sS', '-m', '40', '-A', UA, m[1]], { maxBuffer: 1 << 26 })
    faces.push(`@font-face{font-family:'Noto Sans JP';font-style:normal;font-weight:${weight};src:url(data:font/woff2;base64,${bin.toString('base64')}) format('woff2')}`)
  }
  return faces.join('\n')
}

import { APP_URL as APP, APP_URL_TEXT as APP_TEXT, MANUAL_URL as MANUAL, OUT, REPO } from './config.mjs'

const AD = OUT

const png = (n) => `data:image/png;base64,${readFileSync(`${AD}/${n}.png`).toString('base64')}`
const qr = readFileSync(`${AD}/qr.svg`, 'utf8').replace(/<\?xml[^>]*>/, '')

const phone = (name, caption) => `
  <figure class="phone-fig">
    <div class="phone"><img src="${png(name)}" alt="${caption}"></div>
    <figcaption>${caption}</figcaption>
  </figure>`

const antonWoff2 = readFileSync(`${REPO}/src/assets/anton-latin.woff2`).toString('base64')

const html = `<title>Stage Note</title>
<style>
__JP_FONT__
@font-face{font-family:'Anton';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${antonWoff2}) format('woff2')}
:root{
  --ground:#0b0a0d; --surface:#141319; --surface-2:#1b1a22;
  --line:#2a2833; --line-soft:#201f28; --line-strong:#3c3a47;
  --ink:#f4f2ed; --muted:#8a8796; --faint:#5f5c6b;
  --magenta:#ff2e7e; --magenta-dim:#3a1023;
  --cyan:#3fe0e8; --cyan-dim:#0d2c31;
  --amber:#ffc247;
  --on-accent:#12030a;
  --frame:#2a2833;
  --font-jp:'Noto Sans JP',system-ui,-apple-system,'Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,sans-serif;
  --font-display:'Anton',var(--font-jp);
  color-scheme:dark;
}
@media (prefers-color-scheme: light){
  :root:not([data-theme="dark"]){
    --ground:#f0eff3; --surface:#ffffff; --surface-2:#e8e7ec;
    --line:#d6d4dd; --line-soft:#e5e3ea; --line-strong:#b8b6c2;
    --ink:#16151a; --muted:#625f6b; --faint:#8f8c99;
    --magenta:#d1005f; --magenta-dim:#ffdfec;
    --cyan:#0d818c; --cyan-dim:#d2f0f2;
    --amber:#8a6410;
    --on-accent:#ffffff;
    --frame:#c9c7d2;
    color-scheme:light;
  }
}
:root[data-theme="light"]{
  --ground:#f0eff3; --surface:#ffffff; --surface-2:#e8e7ec;
  --line:#d6d4dd; --line-soft:#e5e3ea; --line-strong:#b8b6c2;
  --ink:#16151a; --muted:#625f6b; --faint:#8f8c99;
  --magenta:#d1005f; --magenta-dim:#ffdfec;
  --cyan:#0d818c; --cyan-dim:#d2f0f2;
  --amber:#8a6410;
  --on-accent:#ffffff;
  --frame:#c9c7d2;
  color-scheme:light;
}

*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--font-jp);
  font-size:17px;line-height:1.85;font-synthesis:none;-webkit-text-size-adjust:100%}
.wrap{max-width:1060px;margin:0 auto;padding:0 20px}
h1,h2,h3{margin:0;line-height:1.32;letter-spacing:-.01em}
p{margin:0}
img{display:block;max-width:100%;height:auto}
a{color:var(--magenta)}

.eyebrow{font-family:var(--font-display);font-size:.72rem;letter-spacing:.26em;
  text-transform:uppercase;color:var(--faint);display:block}
.brand{display:inline-flex;align-items:center;gap:11px}
.brand i{width:11px;height:11px;background:var(--magenta);display:block}
.brand span{font-family:var(--font-display);letter-spacing:.28em;font-size:.85rem;color:var(--muted)}
.rule{height:3px;width:64px;background:var(--magenta);border:0;margin:0}
.mag{color:var(--magenta)}
.line{display:block}

/* ---------- hero ---------- */
.hero{padding:70px 0 66px;border-bottom:1px solid var(--line)}
.hero h1{font-weight:900;font-size:clamp(2.1rem,7.4vw,4rem);margin-top:34px}
.hero .lead{color:var(--muted);margin-top:26px;max-width:44ch;font-size:1.05rem}
.cta-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:34px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:52px;padding:0 26px;border-radius:5px;font-weight:700;text-decoration:none;
  border:1px solid var(--line-strong);color:var(--ink);background:transparent;font-size:1rem}
.btn--go{background:var(--magenta);border-color:var(--magenta);color:var(--on-accent)}
.btn:focus-visible{outline:2px solid var(--magenta);outline-offset:3px}
.evidence{margin-top:44px;border:1px solid var(--frame);border-radius:8px;overflow:hidden;max-width:640px}

/* ---------- sections ---------- */
section{padding:64px 0;border-bottom:1px solid var(--line)}
section > .eyebrow + h2{margin-top:8px}
h2{font-weight:900;font-size:clamp(1.5rem,4.4vw,2.1rem)}
.sub{color:var(--muted);margin-top:16px;max-width:56ch}

/* ---------- 困りごと ---------- */
.pains{list-style:none;padding:0;margin:34px 0 0;display:grid;gap:2px;border-top:1px solid var(--line-soft)}
.pains li{padding:20px 0;border-bottom:1px solid var(--line-soft);font-size:1.12rem;font-weight:700;
  display:flex;gap:14px;align-items:baseline}
.pains li::before{content:'';width:9px;height:9px;background:var(--amber);flex:none;transform:translateY(-2px)}

/* ---------- できること ---------- */
.cards{display:grid;gap:18px;margin-top:34px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
.card{border:1px solid var(--line);border-radius:8px;background:var(--surface);padding:24px 22px;
  display:flex;flex-direction:column;gap:8px}
.card h3{font-size:1.12rem;font-weight:700}
.card p{color:var(--muted);font-size:.95rem;line-height:1.75}
.card--final{border-color:var(--cyan-dim)}
.card--final .eyebrow{color:var(--cyan)}

/* ---------- 画面 ---------- */
.phones{display:grid;gap:26px;margin-top:36px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
.phone-fig{margin:0}
.phone{border:1px solid var(--frame);border-radius:26px;overflow:hidden;background:var(--ground);
  box-shadow:0 20px 50px rgba(0,0,0,.28)}
.phone-fig figcaption{margin-top:12px;font-size:.82rem;color:var(--faint);text-align:center}

/* ---------- 手順 ---------- */
.steps{counter-reset:s;list-style:none;padding:0;margin:34px 0 0;display:grid;gap:2px}
.steps li{counter-increment:s;position:relative;padding:20px 0 20px 56px;border-bottom:1px solid var(--line-soft)}
.steps li::before{content:counter(s);position:absolute;left:0;top:17px;width:36px;height:36px;
  display:grid;place-items:center;border:1px solid var(--line-strong);border-radius:50%;
  font-family:var(--font-display);color:var(--magenta);font-size:1.1rem}
.steps b{display:block;font-weight:700}
.steps span{color:var(--muted);font-size:.94rem}

/* ---------- 安心 ---------- */
.facts{display:grid;gap:2px;margin-top:32px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.fact{padding:22px 0;border-top:1px solid var(--line-soft)}
.fact b{display:block;font-size:1.08rem;font-weight:700;margin-top:6px}
.fact span{display:block;color:var(--muted);font-size:.92rem;margin-top:4px}

/* ---------- CTA ---------- */
.open{display:flex;flex-wrap:wrap;gap:34px;align-items:center;margin-top:34px}
.qr-box{background:#fff;border-radius:10px;padding:12px;width:210px;height:210px;flex:none}
.qr-box svg{width:100%;height:100%;display:block}
.open__url{font-family:var(--font-display);font-size:1.28rem;letter-spacing:.04em;word-break:break-all}

footer{padding:40px 0 80px;color:var(--faint);font-size:.85rem}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">

<header class="hero">
  <span class="brand"><i></i><span>Stage Note</span></span>
  <h1>
    <span class="line">バトルで負けるのは、</span>
    <span class="line">いい。</span>
    <span class="line" style="margin-top:.3em">締切で負けるのは、</span>
    <span class="line mag">もったいない。</span>
  </h1>
  <p class="lead">
    出る大会ごとに、入金・音源・会場・ジャッジ・振り返りを 1 か所へ。
    期限が近いものは、開いた瞬間いちばん上に出ます。
  </p>
  <div class="cta-row">
    <a class="btn btn--go" href="${APP}" target="_blank" rel="noreferrer">アプリを開く</a>
    <a class="btn" href="${MANUAL}" target="_blank" rel="noreferrer">使い方を見る</a>
  </div>
  <div class="evidence"><img src="${png('alert')}" alt="締切が近い・過ぎている、と一覧の先頭に出ている画面"></div>
</header>

<section>
  <span class="eyebrow">The problem</span>
  <h2>踊る前に、抜ける。</h2>
  <p class="sub">出ると決めたあとにやることは、意外と多い。しかも全部、別の場所にある。</p>
  <ul class="pains">
    <li>エントリー費、もう払ったんだっけ</li>
    <li>音源の提出、締切いつまでだった</li>
    <li>会場の入り口、どっちだったか思い出せない</li>
    <li>あのジャッジ、前も見てもらった気がする</li>
  </ul>
</section>

<section>
  <span class="eyebrow">What it does</span>
  <h2>大会ごとに、まとめて持つ。</h2>
  <div class="cards">
    <div class="card">
      <span class="eyebrow">Payment</span>
      <h3>入金したか、残りいくらか</h3>
      <p>未入金・一部入金・入金済み・費用なしの 4 つから選ぶだけ。入金期限を入れると、近づいたときに教えます。</p>
    </div>
    <div class="card">
      <span class="eyebrow">Music</span>
      <h3>音源を出したか、当日持参か</h3>
      <p>事前提出のない大会は「当日持参」にチェック。準備済みの扱いになり、催促は出なくなります。</p>
    </div>
    <div class="card card--final">
      <span class="eyebrow">Final</span>
      <h3>予選とファイナルを 1 つの大会として</h3>
      <p>別々に登録しなくて大丈夫。日程が未発表でも、ファイナル権を獲得したことだけ先に記録できます。</p>
    </div>
    <div class="card">
      <span class="eyebrow">Review</span>
      <h3>ジャッジと振り返りを次に活かす</h3>
      <p>誰が審査したかで過去の大会を横断して探せます。よかったこと・課題・次にやることも大会ごとに。</p>
    </div>
  </div>
</section>

<section>
  <span class="eyebrow">Screens</span>
  <h2>画面はこんな感じ。</h2>
  <div class="phones">
    ${phone('home', '一覧。締切が近いものが先頭に出ます')}
    ${phone('calendar', 'カレンダー。開催日と締切を色分けで')}
    ${phone('reminder', '通知。これから鳴る予定を時系列で')}
  </div>
</section>

<section>
  <span class="eyebrow">Getting started</span>
  <h2>はじめ方は 3 つだけ。</h2>
  <ol class="steps">
    <li><b>スマホのブラウザで開く</b><span>アプリストアを探す必要はありません。iPhone は Safari、Android は Chrome で。</span></li>
    <li><b>ホーム画面に追加する</b><span>アドレスバーが消えて、普通のアプリと同じ見た目になります。通知もここから使えます。</span></li>
    <li><b>最初の大会を登録する</b><span>必要なのは大会名だけ。あとから足していけます。中身を見たいときはサンプルも入れられます。</span></li>
  </ol>
</section>

<section>
  <span class="eyebrow">Good to know</span>
  <h2>お金も、登録も、いりません。</h2>
  <div class="facts">
    <div class="fact"><span class="eyebrow">Price</span><b>無料</b><span>課金も広告もありません</span></div>
    <div class="fact"><span class="eyebrow">Account</span><b>登録なし</b><span>メールアドレスも要りません</span></div>
    <div class="fact"><span class="eyebrow">Privacy</span><b>端末の中だけ</b><span>入力した内容は外に出ません</span></div>
    <div class="fact"><span class="eyebrow">Backup</span><b>控えを持ち出せる</b><span>機種変更のときはファイルで移せます</span></div>
  </div>
</section>

<section style="border-bottom:0">
  <span class="eyebrow">Open</span>
  <h2>いま開けます。</h2>
  <div class="open">
    <div class="qr-box">${qr}</div>
    <div>
      <p class="open__url">${APP_TEXT}</p>
      <p style="color:var(--muted);margin-top:14px">カメラで読み取るか、下のボタンから。</p>
      <div class="cta-row" style="margin-top:22px">
        <a class="btn btn--go" href="${APP}" target="_blank" rel="noreferrer">アプリを開く</a>
        <a class="btn" href="${MANUAL}" target="_blank" rel="noreferrer">使い方を見る</a>
      </div>
    </div>
  </div>
</section>

<footer>
  Stage Note — ダンスコンテストの準備をまとめる道具。画面は開発中のもので、実際の表示と細部が異なる場合があります。
</footer>

</div>`

// 画面に出る文字だけを拾ってフォントを絞る
const visible = html
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<[^>]+>/g, ' ')
const final = html.replace('__JP_FONT__', embedJpFont(visible))
writeFileSync(`${OUT}/landing.html`, final)
console.log('landing.html', (final.length / 1024 / 1024).toFixed(2) + 'MB')
