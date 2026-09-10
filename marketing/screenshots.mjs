import { chromium, devices } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { CHROMIUM, OUT, REPO } from './config.mjs'

/**
 * アプリをビルドして、1 枚の HTML にまとめる。
 * file:// から開けるようにすることで、撮影のためだけにサーバーを立てずに済む。
 */
function buildPreview() {
  execFileSync('npx', ['vite', 'build'], { cwd: REPO, stdio: 'ignore' })
  const dist = `${REPO}/dist`
  const cssFile = readdirSync(`${dist}/assets`).find((f) => f.endsWith('.css'))
  const jsFile = readdirSync(`${dist}/assets`).find((f) => f.endsWith('.js'))
  const css = readFileSync(`${dist}/assets/${cssFile}`, 'utf8')
  const js = readFileSync(`${dist}/assets/${jsFile}`, 'utf8').replace(/<\/script/gi, '<\\/script')
  let html = readFileSync(`${dist}/index.html`, 'utf8')
  html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${css}</style>`)
  html = html.replace(/<script type="module"[^>]*><\/script>/, () => `<script type="module">${js}</script>`)
  html = html.replace(/<link rel="manifest"[^>]*>/, '')
  html = `<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n${html}`
  mkdirSync(OUT, { recursive: true })
  writeFileSync(`${OUT}/preview.html`, html)
}

buildPreview()

const AD = OUT
const URL = `file://${OUT}/preview.html`
const b = await chromium.launch({ executablePath: CHROMIUM })
const ctx=await b.newContext({...devices['iPhone 13'],locale:'ja-JP',timezoneId:'Asia/Tokyo',colorScheme:'dark'})
const page=await ctx.newPage(); const errs=[]; page.on('pageerror',e=>errs.push(String(e)))
await page.route('**/version.json*',r=>r.fulfill({status:200,contentType:'application/json',body:'{"version":"0.6.0"}'}))
await page.goto(URL,{waitUntil:'load'}); await page.waitForTimeout(800)
await page.getByRole('button',{name:'サンプルで中身を見る'}).click(); await page.waitForTimeout(800)
const top=async()=>{ await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(300) }

await top(); await page.screenshot({path:`${AD}/home.png`})
await page.locator('.alert-strip').screenshot({path:`${AD}/alert.png`})

await page.locator('.tabbar button').filter({hasText:'通知'}).click(); await page.waitForTimeout(600)
await top(); await page.screenshot({path:`${AD}/reminder.png`})

await page.locator('.tabbar button').filter({hasText:'カレンダー'}).click(); await page.waitForTimeout(1200)
const marked = page.locator('.cal__day:not(.is-outside)').filter({has:page.locator('.dot')}).first()
if (await marked.count()) { await marked.click(); await page.waitForTimeout(800) }
await top(); await page.waitForTimeout(500); await page.screenshot({path:`${AD}/calendar.png`})

await page.locator('.tabbar button').filter({hasText:'イベント'}).click(); await page.waitForTimeout(500)
await top()
await page.locator('.contest-list li').first().click(); await page.waitForTimeout(700)
await top(); await page.screenshot({path:`${AD}/detail.png`})
const card=async(t,n)=>{const el=page.locator('.card').filter({has:page.locator('.card__title',{hasText:t})}).first()
  await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
  await page.evaluate(()=>{const p=document.getElementById('h');if(p)p.remove();const s=document.createElement('style');s.id='h';s.textContent='.tabbar,.detail__bar,.appbar,.fab{visibility:hidden!important}';document.head.appendChild(s)})
  await el.screenshot({path:`${AD}/${n}.png`})
  await page.evaluate(()=>{const p=document.getElementById('h');if(p)p.remove()})}
await card('入金','payment'); await card('音源','music')
console.log('errors', errs.length?errs:'none')
await b.close()
