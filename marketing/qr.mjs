import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { APP_URL, OUT } from './config.mjs'

/**
 * 誌面に載せる QR。
 * アプリ本体は自前の実装（src/lib/qr.ts）で描くが、こちらは素材づくりの道具なので
 * 参照実装をそのまま使う。出来上がりは verify.mjs で読み取り確認する。
 */
const require = createRequire(import.meta.url)
const QR = require('qrcode')

const code = QR.create([{ data: APP_URL, mode: 'byte' }], { errorCorrectionLevel: 'M' })
const size = code.modules.size
const quiet = 4
const span = size + quiet * 2

let path = ''
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    if (code.modules.data[y * size + x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`
  }
}

mkdirSync(OUT, { recursive: true })
writeFileSync(
  `${OUT}/qr.svg`,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" shape-rendering="crispEdges">` +
    `<rect width="${span}" height="${span}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`,
)
console.log(`QR 版 ${code.version}（${size} マス） → out/qr.svg  ${APP_URL}`)
