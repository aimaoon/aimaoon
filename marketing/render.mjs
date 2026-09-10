import { chromium } from 'playwright'
import { CHROMIUM, OUT } from './config.mjs'

/** 組んだ HTML を、投稿できる画像と印刷用の PDF にする。 */
const browser = await chromium.launch({ executablePath: CHROMIUM })

// --- Instagram の 4 枚。デザインした通りの画素数でそのまま撮る。 ---
{
  const context = await browser.newContext({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.goto(`file://${OUT}/ads.html`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  for (const [id, name] of [
    ['sq1', 'ig-1-hook'],
    ['sq2', 'ig-2-features'],
    ['sq3', 'ig-3-open'],
    ['story', 'ig-story'],
  ]) {
    const element = page.locator(`#${id}`)
    const box = await element.boundingBox()
    await element.screenshot({ path: `${OUT}/${name}.png` })
    console.log(`${name}  ${Math.round(box.width)}×${Math.round(box.height)}`)
  }
  await context.close()
}

// --- フライヤー。A6 = 105×148mm、96dpi 換算で 396.85×559.37px。3 倍で約 300dpi。 ---
{
  const context = await browser.newContext({ viewport: { width: 397, height: 560 }, deviceScaleFactor: 3 })
  const page = await context.newPage()
  await page.goto(`file://${OUT}/flyer.html`, { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(500)
  await page.pdf({ path: `${OUT}/flyer-a6.pdf`, width: '105mm', height: '148mm', printBackground: true, pageRanges: '1' })
  await page.locator('.page').screenshot({ path: `${OUT}/flyer-preview.png` })
  console.log('flyer-a6.pdf  105×148mm')
  await context.close()
}

await browser.close()
