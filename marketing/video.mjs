import { chromium, devices } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { CHROMIUM, OUT } from './config.mjs'

/**
 * 「実際に触っている」ところの短い動画。
 * 画面を上から下まで送って、タブを渡り歩くだけの 15 秒ほど。
 * 端末そのままの縦長で撮るので、そのまま Reels / ストーリーに載せられる。
 */
const RAW = `${OUT}/video-raw`
rmSync(RAW, { recursive: true, force: true })
mkdirSync(RAW, { recursive: true })

const phone = devices['iPhone 13']
// 動画の枠は端末の画面と同じ比率にする。ずれると Playwright が上下に黒を足してしまう。
const frame = {
  width: Math.round(phone.viewport.width * phone.deviceScaleFactor),
  height: Math.round(phone.viewport.height * phone.deviceScaleFactor),
}

const browser = await chromium.launch({ executablePath: CHROMIUM })
const context = await browser.newContext({
  ...phone,
  locale: 'ja-JP',
  timezoneId: 'Asia/Tokyo',
  colorScheme: 'dark',
  recordVideo: { dir: RAW, size: frame },
})
const page = await context.newPage()
await page.route('**/version.json*', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: '{"version":"0.6.0"}' }),
)

const wait = (ms) => page.waitForTimeout(ms)

/** 指をなぞったようにゆっくり送る。一気に飛ばすと「動画」に見えない。 */
async function glide(distance, ms = 1100) {
  const steps = Math.max(12, Math.round(ms / 16))
  await page.evaluate(
    async ([distance, steps]) => {
      const from = window.scrollY
      const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
      for (let i = 1; i <= steps; i += 1) {
        window.scrollTo(0, from + distance * ease(i / steps))
        await new Promise((r) => requestAnimationFrame(r))
      }
    },
    [distance, steps],
  )
}

const tab = async (label, hold = 900) => {
  await page.locator('.tabbar button').filter({ hasText: label }).click()
  await wait(hold)
}

await page.goto(`file://${OUT}/preview.html`, { waitUntil: 'load' })
await wait(900)
await page.getByRole('button', { name: 'サンプルで中身を見る' }).click()
await wait(1400)

// 一覧を眺める
await glide(700, 1300)
await wait(600)
await glide(700, 1300)
await wait(700)
await page.evaluate(() => window.scrollTo(0, 0))
await wait(700)

// 1 件開いて、入金と音源まで下りる
await page.locator('.contest-list li').first().click()
await wait(1200)
await glide(900, 1400)
await wait(900)
await glide(900, 1400)
await wait(900)
await page.locator('.detail__bar .icon-btn').first().click()
await wait(900)

// カレンダーと通知
await tab('カレンダー', 1500)
const marked = page.locator('.cal__day:not(.is-outside)').filter({ has: page.locator('.dot') }).first()
if (await marked.count()) {
  await marked.click()
  await wait(1200)
}
await tab('通知', 1600)
await glide(600, 1200)
await wait(1200)
await tab('イベント', 1400)

await context.close()
await browser.close()

const file = readdirSync(RAW).find((f) => f.endsWith('.webm'))
renameSync(`${RAW}/${file}`, `${OUT}/app-scroll.webm`)
rmSync(RAW, { recursive: true, force: true })

/*
 * Playwright が書き出すのは WebM。Instagram は受け取ってくれないので MP4 に直す。
 * 端末の画面は 9:19.5 と縦長なので、投稿の比率に合わせて左右（または上下）を地の色で埋める。
 */
const GROUND = '0x0b0a0d'
const convert = (name, width, height) => {
  execFileSync(
    'ffmpeg',
    ['-y', '-loglevel', 'error', '-i', `${OUT}/app-scroll.webm`,
     '-vf', `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:${GROUND}`,
     '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
     '-r', '30', '-movflags', '+faststart', '-an', `${OUT}/${name}`],
    { stdio: 'inherit' },
  )
  console.log(`${name}  ${width}×${height}`)
}

convert('app-scroll-9x16.mp4', 1080, 1920)
convert('app-scroll-4x5.mp4', 1080, 1350)
