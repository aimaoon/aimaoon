/**
 * 配信されている版が、いま開いているものより新しいかを見るための道具。
 *
 * ホーム画面に追加したアプリは、一度読み込んだ index.html を握ったまま
 * 何日も更新されないことがある（iOS で特に起きる）。
 * アプリを消して入れ直さないと新しくならない、という状態を避けるために、
 * ビルドごとに書き出す version.json と手元の版を突き合わせる。
 */

export const VERSION_URL = '/version.json'

export type VersionInfo = {
  version: string
  builtAt?: string
}

/** version.json の中身。壊れていたら null（＝判定しない）を返す。 */
export function parseVersionInfo(text: string): VersionInfo | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null
  const record = data as Record<string, unknown>
  const version = record.version
  if (typeof version !== 'string' || version.trim() === '') return null
  return {
    version: version.trim(),
    builtAt: typeof record.builtAt === 'string' ? record.builtAt : undefined,
  }
}

/** '0.2.0' を [0, 2, 0] に。数字でないところは 0 として扱う。 */
function parts(version: string): number[] {
  return version
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((value) => (Number.isFinite(value) ? value : 0))
}

/**
 * remote が current より新しいときだけ true。
 * 巻き戻し（remote のほうが古い）で更新を勧めないように、大小をきちんと見る。
 */
export function isNewerVersion(current: string, remote: string): boolean {
  const a = parts(current)
  const b = parts(remote)
  const length = Math.max(a.length, b.length)
  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? 0
    const right = b[index] ?? 0
    if (right > left) return true
    if (right < left) return false
  }
  return false
}

/**
 * 取ってきた本文から「更新があるか」を決める。
 * 読めない・同じ・古いときは false。
 */
export function hasUpdate(current: string, text: string): boolean {
  const info = parseVersionInfo(text)
  return info ? isNewerVersion(current, info.version) : false
}

/** 途中のキャッシュに当たらないよう、毎回違う URL で取りにいく。 */
export function versionUrl(now: Date = new Date()): string {
  return `${VERSION_URL}?t=${now.getTime()}`
}

/**
 * 更新後に開く URL。
 * 同じ URL で読み直すと、握られている index.html がそのまま出てくることがあるので、
 * 版をクエリに付けて別の住所として取りにいかせる。
 */
export function reloadUrl(href: string, version: string): string {
  const url = new URL(href)
  url.searchParams.set('v', version)
  return url.toString()
}
