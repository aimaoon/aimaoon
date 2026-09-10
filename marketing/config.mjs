import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 広告素材を作り直すときの設定。
 * URL を変えたら、ここだけ直して `node marketing/build.mjs` を流し直す。
 */

export const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO = resolve(HERE, '..')
/** 出来上がった素材の置き場（git には入れない） */
export const OUT = resolve(HERE, 'out')

/** 配信しているアプリの URL。QR とリンクはこれで作る。 */
export const APP_URL = 'https://stagenote.aimauto736.workers.dev/'
/** 誌面に文字として出す URL（スキームなし） */
export const APP_URL_TEXT = APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
/** 使い方ガイド（紹介ページからリンクする） */
export const MANUAL_URL = 'https://claude.ai/code/artifact/583958f6-9969-4ddf-b500-7d27f67ce6e0'

/** 端末エミュレーションに使う Chromium。この環境に置いてあるものを使う。 */
export const CHROMIUM = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
