import { readFileSync, writeFileSync } from 'node:fs'

import { APP_URL_TEXT, OUT, REPO } from './config.mjs'

const AD = OUT
const URL_TEXT = APP_URL_TEXT

const b64 = (p) => readFileSync(p).toString('base64')
const png = (n) => `data:image/png;base64,${b64(`${AD}/${n}.png`)}`
const anton = `data:font/woff2;base64,${b64('/home/user/aimaoon/src/assets/anton-latin.woff2')}`
const jpFont = readFileSync(`${AD}/jp-font.css`, 'utf8')
const qr = readFileSync(`${AD}/qr.svg`, 'utf8').replace(/<\?xml[^>]*>/, '')

const CSS = `
${jpFont}
@font-face{font-family:Anton;src:url(${anton}) format('woff2');font-weight:400;font-style:normal}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#2a2833;font-synthesis:none;
  font-family:'Noto Sans JP',IPAGothic,sans-serif;
  -webkit-font-smoothing:antialiased}
.canvas{position:relative;overflow:hidden;background:#0b0a0d;color:#f4f2ed;display:block;margin:0 auto 40px}
.sq{width:1080px;height:1080px}
.story{width:1080px;height:1920px}

/* 版面ラベル（欧文だけ Anton） */
.eyebrow{font-family:Anton,sans-serif;text-transform:uppercase;color:#5f5c6b;display:block}
.brand{display:flex;align-items:center;gap:14px}
.brand i{width:16px;height:16px;background:#ff2e7e;display:block}
.brand span{font-family:Anton,sans-serif;letter-spacing:.3em;color:#8a8796}

.rule{height:3px;background:#ff2e7e;border:0}
.mag{color:#ff2e7e}
.cy{color:#3fe0e8}
h1{font-weight:900;letter-spacing:-.01em}
/* 見出しは行ごとに置く。途中で折り返して意味が切れるのを防ぐ。 */
h1 .line{display:block;white-space:nowrap}

/* 端末のモック。高さを決めると上から切って使える。 */
.phone{border:2px solid #2a2833;border-radius:52px;overflow:hidden;background:#0b0a0d;
  box-shadow:0 40px 90px rgba(0,0,0,.55);display:block}
.phone img{display:block;width:100%;height:auto}
/* 高さで切ったときは、下を地の色へ溶かして「切れている」ことを意図に見せる。 */
.phone--fade{position:relative}
.phone--fade::after{content:'';position:absolute;left:0;right:0;bottom:0;height:190px;
  background:linear-gradient(to bottom,rgba(11,10,13,0),#0b0a0d)}

.shot-plain{border:1px solid #2a2833;border-radius:10px;overflow:hidden;display:block}
.shot-plain img{display:block;width:100%;height:auto}

.qr{width:100%;height:100%;display:block}
.qr-box{background:#fff;border-radius:12px;padding:14px;display:block}

.url{font-family:Anton,sans-serif;letter-spacing:.06em;color:#f4f2ed}
`

/* ---------------- 1080×1080 ①つかみ ---------------- */
const sq1 = `
<div class="canvas sq" id="sq1" style="padding:70px 76px 74px;display:flex;flex-direction:column">
  <div class="brand"><i></i><span style="font-size:26px">Stage Note</span></div>

  <h1 style="margin-top:56px;font-size:78px;line-height:1.32">
    <span class="line">バトルで負けるのは、</span>
    <span class="line">いい。</span>
    <span class="line" style="margin-top:.34em">締切で負けるのは、</span>
    <span class="line mag">もったいない。</span>
  </h1>

  <hr class="rule" style="width:120px;margin-top:46px">

  <p style="margin-top:36px;font-size:30px;line-height:1.7;color:#8a8796">
    エントリー費の入金、音源の提出。<br>
    出ると決めたあとが、いちばん抜ける。
  </p>

  <div style="margin-top:auto;padding-top:52px">
    <div class="shot-plain"><img src="${png('alert')}" alt=""></div>
  </div>
</div>`

/* ---------------- 1080×1080 ②なにができる ---------------- */
const point = (label, title, body) => `
  <li style="padding:24px 0;border-bottom:1px solid #201f28">
    <span class="eyebrow" style="font-size:20px;letter-spacing:.26em">${label}</span>
    <strong style="display:block;font-size:32px;font-weight:700;margin-top:7px">${title}</strong>
    <span style="display:block;font-size:23px;color:#8a8796;margin-top:5px">${body}</span>
  </li>`

const sq2 = `
<div class="canvas sq" id="sq2" style="padding:74px 0 0 76px">
  <div class="brand"><i></i><span style="font-size:24px">Stage Note</span></div>
  <h1 style="margin-top:42px;font-size:62px;line-height:1.34">
    <span class="line">出る大会の準備を、</span>
    <span class="line"><span class="mag">1 か所</span>に。</span>
  </h1>

  <ul style="list-style:none;margin-top:34px;width:540px;border-top:1px solid #201f28">
    ${point('PAYMENT', '入金したか、残りいくらか', '期限が近いものは先頭に出ます')}
    ${point('MUSIC', '音源を出したか、当日持参か', '当日持参なら催促は出ません')}
    ${point('FINAL', '予選とファイナルを 1 つに', '日程が未発表でも権利は記録できます')}
    ${point('REVIEW', '誰がジャッジで、何が課題か', '次の大会に持っていけます')}
  </ul>

  <div class="phone" style="position:absolute;right:58px;top:286px;width:404px">
    <img src="${png('home')}" alt="">
  </div>
</div>`

/* ---------------- 1080×1080 ③さそい ---------------- */
const sq3 = `
<div class="canvas sq" id="sq3" style="padding:80px 76px;display:flex;flex-direction:column">
  <div class="brand"><i></i><span style="font-size:26px">Stage Note</span></div>

  <h1 style="margin-top:54px;font-size:74px;line-height:1.36">
    <span class="line">インストール不要。</span>
    <span class="line">ブラウザで<span class="mag">開くだけ。</span></span>
  </h1>

  <ul style="list-style:none;margin-top:52px;border-top:1px solid #201f28">
    ${['アプリストアを探さなくていい','アカウントの登録もいらない','ホーム画面に置けば、アプリと同じ']
      .map((t) => `<li style="display:flex;align-items:center;gap:20px;padding:26px 0;border-bottom:1px solid #201f28">
        <i style="width:12px;height:12px;background:#ff2e7e;flex:none"></i>
        <span style="font-size:34px;font-weight:700">${t}</span>
      </li>`).join('')}
  </ul>

  <div style="margin-top:auto;padding-top:48px;display:flex;align-items:flex-end;gap:48px">
    <div class="qr-box" style="width:300px;height:300px;flex:none">${qr}</div>
    <div style="padding-bottom:8px">
      <span class="eyebrow" style="font-size:22px;letter-spacing:.26em">OPEN</span>
      <p class="url" style="font-size:32px;margin-top:12px;line-height:1.4;word-break:break-all">${URL_TEXT}</p>
      <p style="font-size:25px;color:#8a8796;margin-top:22px;line-height:1.7">
        iPhone / Android・無料<br>
        入れた内容は、あなたの端末の中だけ
      </p>
    </div>
  </div>
</div>`

/* ---------------- 1080×1920 ストーリー ---------------- */
const story = `
<div class="canvas story" id="story" style="padding:158px 84px 196px;display:flex;flex-direction:column">
  <div class="brand"><i></i><span style="font-size:30px">Stage Note</span></div>

  <h1 style="margin-top:74px;font-size:94px;line-height:1.32">
    <span class="line">締切で負けるのは、</span>
    <span class="line mag">もったいない。</span>
  </h1>
  <p style="margin-top:36px;font-size:34px;line-height:1.7;color:#8a8796">
    入金・音源・会場・ジャッジ・振り返りを、<br>出る大会ごとに 1 か所へ。
  </p>

  <div class="phone phone--fade" style="width:568px;height:648px;margin:62px auto 0">
    <img src="${png('home')}" alt="">
  </div>

  <div style="margin-top:auto;padding-top:56px;display:flex;align-items:center;gap:44px">
    <div class="qr-box" style="width:250px;height:250px;flex:none">${qr}</div>
    <div>
      <p class="url" style="font-size:33px;line-height:1.45;word-break:break-all">${URL_TEXT}</p>
      <p style="font-size:28px;color:#8a8796;margin-top:18px">インストール不要・無料</p>
    </div>
  </div>
</div>`

writeFileSync(`${AD}/ads.html`, `<meta charset="utf-8"><style>${CSS}</style>${sq1}${sq2}${sq3}${story}`)
console.log('ads.html written')
