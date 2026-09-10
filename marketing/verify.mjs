import { chromium } from 'playwright'
import { createRequire } from 'node:module'
import { CHROMIUM, OUT, APP_URL } from './config.mjs'

const require = createRequire(import.meta.url)
const JSQR = require.resolve('jsqr/dist/jsQR.js')
const b = await chromium.launch({ executablePath: CHROMIUM })
const page=await (await b.newContext()).newPage()
await page.goto('about:blank'); await page.addScriptTag({path:JSQR})
let ok = true
for (const [file,label] of [['ig-3-open.png','IG 3枚目'],['ig-story.png','ストーリー'],['flyer-preview.png','フライヤー']]) {
  const data='data:image/png;base64,'+(await import('node:fs')).readFileSync(`${OUT}/${file}`).toString('base64')
  const out=await page.evaluate(async (src)=>{
    const img=new Image()
    await new Promise((res,rej)=>{img.onload=res;img.onerror=rej;img.src=src})
    const c=document.createElement('canvas'); c.width=img.width; c.height=img.height
    const x=c.getContext('2d'); x.drawImage(img,0,0)
    const d=x.getImageData(0,0,c.width,c.height)
    const r=window.jsQR(d.data,c.width,c.height)
    return r ? r.data : null
  }, data)
  const good = out === APP_URL
  if (!good) ok = false
  console.log(`${good ? 'OK ' : 'NG '} ${label}: ${out ?? '読めない'}`)
}
if (!ok) {
  console.error('QR が config.mjs の APP_URL と一致しません')
  process.exitCode = 1
}
await b.close()
