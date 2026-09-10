import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { CHROMIUM, OUT } from './config.mjs'

/**
 * 「実際に触っている」ところの短い動画。
 *
 * Playwright の録画（recordVideo）は画面の下のほうを取りこぼすので使わず、
 * 1 コマずつ撮って ffmpeg でつなぐ。止まっている間は同じコマを複製するだけなので速い。
 *
 * 撮る窓はアプリの最大幅（520px）以内にしてある。ここを超えると左右に余白が出る。
 */

const FPS = 15

/** 投稿する形。撮る窓は同じ比率で、版面が最大幅に収まる大きさにしている。 */
const FORMATS = [
  { name: 'app-scroll-9x16', width: 1080, height: 1920, shot: { width: 405, height: 720 }, label: 'リール / ストーリー' },
  { name: 'app-scroll-4x5', width: 1080, height: 1350, shot: { width: 432, height: 540 }, label: 'フィード' },
]

const FRAMES = `${OUT}/video-frames`

/** 1 コマずつ撮りながら画面をひと通り触る。 */
async function record(page) {
  let index = 0
  let last = null
  const name = (n) => `${FRAMES}/f${String(n).padStart(5, '0')}.png`

  const shot = async () => {
    const path = name(index++)
    await page.screenshot({ path })
    last = path
  }
  /** 止まっている時間。撮り直さずに同じコマを並べる。 */
  const hold = (seconds) => {
    for (let i = 0; i < Math.round(seconds * FPS); i += 1) copyFileSync(last, name(index++))
  }
  /** 指でなぞったようにゆっくり送る。一気に飛ばすと「動画」に見えない。 */
  const glide = async (distance, seconds) => {
    const steps = Math.round(seconds * FPS)
    const from = await page.evaluate(() => window.scrollY)
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
    for (let i = 1; i <= steps; i += 1) {
      await page.evaluate((y) => window.scrollTo(0, y), from + distance * ease(i / steps))
      await shot()
    }
  }
  const tap = async (locator, settle = 0.7) => {
    await locator.click()
    await page.waitForTimeout(260)
    await shot()
    hold(settle)
  }
  const tab = (label) => tap(page.locator('.tabbar button').filter({ hasText: label }), 0.9)

  await shot()
  hold(0.6)
  await tap(page.getByRole('button', { name: 'サンプルで中身を見る' }), 1.2)

  // 一覧を眺める
  await glide(520, 1.1)
  hold(0.5)
  await glide(520, 1.1)
  hold(0.6)
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot()
  hold(0.5)

  // 1 件開いて、準備チェックから音源まで下りる
  await tap(page.locator('.contest-list li').first(), 0.9)
  await glide(700, 1.2)
  hold(0.7)
  await glide(700, 1.2)
  hold(0.8)
  await tap(page.locator('.detail__bar .icon-btn').first(), 0.6)

  // カレンダー
  await tab('カレンダー')
  const marked = page.locator('.cal__day:not(.is-outside)').filter({ has: page.locator('.dot') }).first()
  if (await marked.count()) await tap(marked, 1.1)

  // 通知
  await tab('通知')
  await glide(460, 1.0)
  hold(1.1)

  await tab('イベント')
  hold(0.9)
  return index
}

const browser = await chromium.launch({ executablePath: CHROMIUM })

for (const format of FORMATS) {
  rmSync(FRAMES, { recursive: true, force: true })
  mkdirSync(FRAMES, { recursive: true })

  const context = await browser.newContext({
    viewport: format.shot,
    // 3 倍で撮って書き出しで縮めると、文字の輪郭が締まる
    deviceScaleFactor: 3,
    hasTouch: true,
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    colorScheme: 'dark',
  })
  const page = await context.newPage()
  await page.route('**/version.json*', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"version":"0.6.0"}' }),
  )
  await page.goto(`file://${OUT}/preview.html`, { waitUntil: 'load' })
  await page.waitForTimeout(900)

  const frames = await record(page)
  await context.close()

  execFileSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', `${FRAMES}/f%05d.png`,
     '-vf', `scale=${format.width}:${format.height}:flags=lanczos`,
     '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p',
     '-r', '30', '-movflags', '+faststart', '-an', `${OUT}/${format.name}.mp4`],
    { stdio: 'inherit' },
  )
  rmSync(FRAMES, { recursive: true, force: true })
  console.log(`${format.name}.mp4  ${format.width}×${format.height}  ${(frames / FPS).toFixed(1)} 秒  ${format.label}`)
}

await browser.close()
