import { readFileSync, writeFileSync } from 'node:fs'

import { APP_URL_TEXT, OUT, REPO } from './config.mjs'

const AD = OUT
const URL_TEXT = APP_URL_TEXT

const b64 = (p) => readFileSync(p).toString('base64')
const png = (n) => `data:image/png;base64,${b64(`${AD}/${n}.png`)}`
const anton = `data:font/woff2;base64,${b64('/home/user/aimaoon/src/assets/anton-latin.woff2')}`
const jpFont = readFileSync(`${AD}/jp-font.css`, 'utf8')
const qr = readFileSync(`${AD}/qr.svg`, 'utf8')

/*
 * A6（105×148mm）1 枚。スタジオや会場に置く用。
 * 断ち落としは付けず、家庭用プリンタでもそのまま刷れる余白にしている。
 */
const html = `<meta charset="utf-8">
<style>
${jpFont}
@font-face{font-family:Anton;src:url(${anton}) format('woff2');font-weight:400;font-style:normal}
@page{size:105mm 148mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:105mm;height:148mm}
body{background:#0b0a0d;color:#f4f2ed;font-synthesis:none;
  font-family:'Noto Sans JP',IPAGothic,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:105mm;height:148mm;padding:9mm 8mm 8mm;display:flex;flex-direction:column;overflow:hidden}
.brand{display:flex;align-items:center;gap:2mm}
.brand i{width:2.2mm;height:2.2mm;background:#ff2e7e;display:block}
.brand span{font-family:Anton,sans-serif;letter-spacing:.3em;font-size:3.1mm;color:#8a8796}
h1{font-weight:900;font-size:6.2mm;line-height:1.34;letter-spacing:-.01em;margin-top:5.5mm}
h1 .line{display:block;white-space:nowrap}
.mag{color:#ff2e7e}
.lead{font-size:2.9mm;line-height:1.65;color:#8a8796;margin-top:3.5mm}
.rule{height:.5mm;background:#ff2e7e;width:12mm;margin-top:3.5mm;border:0}
ul{list-style:none;margin-top:4mm;border-top:.2mm solid #201f28;flex:none}
li{display:flex;gap:2.2mm;align-items:baseline;padding:1.9mm 0;border-bottom:.2mm solid #201f28}
li i{width:1.5mm;height:1.5mm;background:#ff2e7e;flex:none;transform:translateY(-.3mm)}
li b{font-size:3.1mm;font-weight:700}
li span{font-size:2.5mm;color:#8a8796;display:block;margin-top:.4mm}
.foot{margin-top:auto;display:flex;align-items:center;gap:3.6mm;padding-top:4.5mm;flex:none}
.qr{width:22mm;height:22mm;background:#fff;border-radius:1.5mm;padding:1mm;flex:none}
.qr svg{width:100%;height:100%;display:block}
.url{font-family:Anton,sans-serif;letter-spacing:.04em;font-size:3.5mm;line-height:1.3;word-break:break-all}
.note{font-size:2.7mm;color:#8a8796;margin-top:1.6mm;line-height:1.6}
.shot{border:.2mm solid #2a2833;border-radius:1.4mm;overflow:hidden;margin-top:3.5mm;flex:none}
.shot img{display:block;width:100%;height:auto}
</style>
<div class="page">
  <div class="brand"><i></i><span>Stage Note</span></div>

  <h1>
    <span class="line">バトルで負けるのは、</span>
    <span class="line">いい。</span>
    <span class="line" style="margin-top:.3em">締切で負けるのは、</span>
    <span class="line mag">もったいない。</span>
  </h1>

  <hr class="rule">
  <p class="lead">出る大会ごとに、入金・音源・会場・ジャッジ・<br>振り返りまで 1 か所へ。期限が近いものから並びます。</p>

  <ul>
    <li><i></i><div><b>入金と音源の締切を落とさない</b><span>通知とカレンダー書き出しに対応</span></div></li>
    <li><i></i><div><b>予選とファイナルを 1 つの大会として</b><span>日程が未発表でも権利は記録できます</span></div></li>
    <li><i></i><div><b>ジャッジと振り返りを次に活かす</b><span>誰が審査したかで過去の大会を探せます</span></div></li>
  </ul>

  <div class="foot">
    <div class="qr">${qr}</div>
    <div>
      <p class="url">${URL_TEXT}</p>
      <p class="note">インストール不要・無料<br>iPhone / Android のブラウザで開くだけ</p>
    </div>
  </div>
</div>`
writeFileSync(`${AD}/flyer.html`, html)
console.log('flyer.html written')
