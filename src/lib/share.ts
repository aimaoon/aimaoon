import type { Contest } from '../types'
import { createId } from './factory'
import { defaultReminders } from './reminder'

/**
 * コンテストを 1 件、リンクや QR コードで渡すための変換。
 *
 * サーバーを持たない作りなので、中身は URL のフラグメント（# のうしろ）に詰める。
 * フラグメントはサーバーに送られないため、リンクを配ってもどこにも記録が残らない。
 *
 * 渡すのは「大会そのものの情報」だけで、「自分の状況」は入れない。
 * 入金したか、音源を出したか、ジャッジをどう見ているか、結果がどうだったかは
 * 共有相手に関係がなく、渡すと事故になる。
 */

/** '#c=...' の c。 */
export const SHARE_PARAM = 'c'

/** 中身の形が変わったときのために、先頭に持たせる番号。 */
export const SHARE_VERSION = 1

/** 詰め方の目印。1 = そのまま、2 = deflate で縮めた。 */
const RAW = '1'
const DEFLATE = '2'

/** 共有する中身。鍵を短くしているのは、QR に収まる長さに収めるため。 */
export interface SharePayload {
  /** 形式の版 */
  v: number
  /** 大会名 */
  n: string
  /** 部門・カテゴリ */
  c?: string
  /** 開催日 YYYY-MM-DD */
  d: string
  /** 集合・開始 HH:mm */
  s?: string
  /** 終了予定 HH:mm */
  e?: string
  /** 会場 [名前, 住所] */
  p?: [string, string?]
  /** ファイナル [日付, 開始, 会場名, 住所] */
  f?: [string?, string?, string?, string?]
  /** エントリー費（円） */
  y?: number
  /** 入金期限 YYYY-MM-DD */
  yd?: string
  /** 音源の提出期限 YYYY-MM-DD */
  md?: string
  /** ジャッジ ['名前', 'ジャンル'] の並び */
  j?: [string, string?][]
}

/** 空文字と undefined をまとめて落とす。 */
function trimmed(value: string | undefined): string | undefined {
  const text = value?.trim()
  return text ? text : undefined
}

/** 末尾の undefined を落として、JSON を短くする。 */
function compact<T extends unknown[]>(values: T): T {
  const copy = [...values]
  while (copy.length > 0 && copy[copy.length - 1] === undefined) copy.pop()
  return copy as T
}

/** コンテストから、渡してよいところだけを取り出す。 */
export function toSharePayload(contest: Contest): SharePayload {
  const payload: SharePayload = {
    v: SHARE_VERSION,
    n: contest.name.trim(),
    d: contest.date,
  }

  const category = trimmed(contest.category)
  if (category) payload.c = category
  const start = trimmed(contest.startTime)
  if (start) payload.s = start
  const end = trimmed(contest.endTime)
  if (end) payload.e = end

  const venueName = trimmed(contest.venue.name)
  const venueAddress = trimmed(contest.venue.address)
  if (venueName || venueAddress) {
    payload.p = compact([venueName ?? '', venueAddress]) as [string, string?]
  }

  // ファイナルは「日程と場所」だけ。進出できたかどうかは相手に関係がない。
  const final = contest.final
  if (final && (final.date || final.venue?.name || final.venue?.address)) {
    const entry = compact([
      trimmed(final.date),
      trimmed(final.startTime),
      trimmed(final.venue?.name),
      trimmed(final.venue?.address),
    ])
    if (entry.length > 0) payload.f = entry as [string?, string?, string?, string?]
  }

  if (contest.entry.fee > 0) payload.y = contest.entry.fee
  const entryDue = trimmed(contest.entry.dueDate)
  if (entryDue) payload.yd = entryDue
  const musicDue = trimmed(contest.music.dueDate)
  if (musicDue) payload.md = musicDue

  // 名前とジャンルまで。自分が書いた「見られるポイント」のメモは渡さない。
  const judges = contest.judges
    .map((judge) => compact([trimmed(judge.name) ?? '', trimmed(judge.genre)]) as [string, string?])
    .filter((entry) => entry[0] !== '')
  if (judges.length > 0) payload.j = judges

  return payload
}

/** 共有された中身から、自分の手元の 1 件を組み立てる。状態は自分のぶんとして空から始める。 */
export function contestFromShare(payload: SharePayload, now: Date): Contest {
  const timestamp = now.toISOString()
  const [finalDate, finalStart, finalVenueName, finalVenueAddress] = payload.f ?? []

  return {
    id: createId('contest'),
    name: payload.n,
    category: payload.c,
    date: payload.d,
    startTime: payload.s ?? '',
    endTime: payload.e ?? '',
    venue: {
      name: payload.p?.[0] ?? '',
      address: payload.p?.[1],
    },
    entry: {
      fee: payload.y ?? 0,
      status: payload.y && payload.y > 0 ? 'unpaid' : 'free',
      dueDate: payload.yd,
    },
    music: {
      status: 'none',
      dueDate: payload.md,
    },
    judges: (payload.j ?? []).map(([name, genre]) => ({ id: createId('judge'), name, genre })),
    reminders: defaultReminders(),
    memo: '',
    final:
      payload.f && (finalDate || finalVenueName || finalVenueAddress)
        ? {
            date: finalDate,
            startTime: finalStart ?? '',
            endTime: '',
            venue: finalVenueName || finalVenueAddress ? { name: finalVenueName ?? '', address: finalVenueAddress } : undefined,
            status: 'undecided',
            reminders: defaultReminders(),
            note: '',
          }
        : undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** 中身が共有データとして読めるかを見る。読めないものは受け取らない。 */
export function isSharePayload(value: unknown): value is SharePayload {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.v !== SHARE_VERSION) return false
  if (typeof record.n !== 'string' || record.n.trim() === '') return false
  if (typeof record.d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.d)) return false
  return true
}

/* ------------------------------------------------------------------ *
 * 文字への詰め方
 * ------------------------------------------------------------------ */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  // 一度に渡すと引数の数で溢れるので、少しずつ積む。
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function through(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

function sourceStream(bytes: Uint8Array): ReadableStream<BufferSource> {
  // TS 5.7 の Uint8Array<ArrayBufferLike> はそのまま渡せず、素の ArrayBuffer を流すと
  // Node の CompressionStream が進まないので、ArrayBuffer 実体を持つ Uint8Array に写す。
  const chunk = new Uint8Array(bytes.length)
  chunk.set(bytes)
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(chunk)
      controller.close()
    },
  })
}

/**
 * 共有データを 1 本の文字列にする。
 * 縮められる環境なら縮めて、短いほうを採る（QR の目が細かくなりすぎないように）。
 */
export async function encodeShare(payload: SharePayload): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(payload))
  const raw = RAW + bytesToBase64Url(json)

  if (typeof CompressionStream !== 'function') return raw
  try {
    const packed = await through(sourceStream(json).pipeThrough(new CompressionStream('deflate-raw')))
    const compressed = DEFLATE + bytesToBase64Url(packed)
    return compressed.length < raw.length ? compressed : raw
  } catch {
    return raw
  }
}

/** 受け取った文字列を戻す。読めなければ null（＝取り込まない）。 */
export async function decodeShare(token: string): Promise<SharePayload | null> {
  const marker = token.slice(0, 1)
  const body = token.slice(1)
  if (body === '') return null

  let bytes: Uint8Array
  try {
    bytes = base64UrlToBytes(body)
  } catch {
    return null
  }

  if (marker === DEFLATE) {
    if (typeof DecompressionStream !== 'function') return null
    try {
      bytes = await through(sourceStream(bytes).pipeThrough(new DecompressionStream('deflate-raw')))
    } catch {
      return null
    }
  } else if (marker !== RAW) {
    return null
  }

  try {
    const value = JSON.parse(new TextDecoder().decode(bytes))
    return isSharePayload(value) ? value : null
  } catch {
    return null
  }
}

/** 配る URL。中身は # のうしろに置くので、開いた先のサーバーには渡らない。 */
export function buildShareUrl(origin: string, token: string): string {
  return `${origin.replace(/[#?].*$/, '').replace(/\/$/, '')}/#${SHARE_PARAM}=${token}`
}

/** 開いた URL から共有データを取り出す。無ければ null。 */
export function readShareToken(hash: string): string | null {
  const text = hash.startsWith('#') ? hash.slice(1) : hash
  for (const part of text.split('&')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index) !== SHARE_PARAM) continue
    const value = part.slice(index + 1).trim()
    return value === '' ? null : value
  }
  return null
}
