/**
 * Worker の純粋なところ。
 * 受け取った内容の検証と「いま送るべきものはどれか」の判断だけを扱い、
 * D1 やネットワークには触らない（そのぶんテストできる）。
 */

import { base64UrlToBytes } from './push'
import type { PushSubscription } from './push'

/** 端末から預かる通知 1 件。中身は通知に出す文言だけで、大会のデータは持たない。 */
export interface PlannedReminder {
  /** 端末側で決める識別子。同じものを送り直したら上書きされる。 */
  key: string
  /** 通知する時刻（ISO 8601・UTC） */
  at: string
  title: string
  body: string
}

export interface SyncPayload {
  subscription: PushSubscription
  reminders: PlannedReminder[]
}

/** 1 購読あたりの上限。数か月ぶんの予定でも十分収まる。 */
export const MAX_REMINDERS = 300
export const MAX_TITLE_LENGTH = 120
export const MAX_BODY_LENGTH = 240

/** 遅れて配信しても意味がある猶予。これより古いものは送らずに畳む。 */
export const GRACE_MINUTES = 60

export class ValidationError extends Error {}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new ValidationError('形式が違います')
  return value as Record<string, unknown>
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new ValidationError(`${field} がありません`)
  return value
}

function byteLength(base64url: string, field: string): number {
  try {
    return base64UrlToBytes(base64url).length
  } catch {
    throw new ValidationError(`${field} を読めません`)
  }
}

/** 購読情報の検証。鍵の長さまで見ておくと、後段で意味不明な失敗をしなくて済む。 */
export function parseSubscription(input: unknown): PushSubscription {
  const record = asRecord(input)
  const endpoint = asString(record.endpoint, 'endpoint')

  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new ValidationError('endpoint が URL ではありません')
  }
  if (url.protocol !== 'https:') throw new ValidationError('endpoint は https のみ受け付けます')

  const keys = asRecord(record.keys)
  const p256dh = asString(keys.p256dh, 'p256dh')
  const auth = asString(keys.auth, 'auth')
  if (byteLength(p256dh, 'p256dh') !== 65) throw new ValidationError('p256dh の長さが違います')
  if (byteLength(auth, 'auth') !== 16) throw new ValidationError('auth の長さが違います')

  return { endpoint, keys: { p256dh, auth } }
}

/**
 * 通知の一覧を整える。
 * 1 件ずつの不備は落として通す（端末側の細かい事情で全体が失敗しないように）。
 * 過去の時刻も落とす。同じ key は後勝ちで 1 件にまとめる。
 */
export function parseReminders(input: unknown, now: Date): PlannedReminder[] {
  if (!Array.isArray(input)) throw new ValidationError('reminders が配列ではありません')

  const byKey = new Map<string, PlannedReminder>()
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) continue
    const item = raw as Record<string, unknown>
    const { key, at, title } = item
    if (typeof key !== 'string' || key === '') continue
    if (typeof at !== 'string' || typeof title !== 'string' || title.trim() === '') continue

    const when = new Date(at)
    if (Number.isNaN(when.getTime()) || when.getTime() <= now.getTime()) continue

    byKey.set(key, {
      key,
      at: when.toISOString(),
      title: title.slice(0, MAX_TITLE_LENGTH),
      body: (typeof item.body === 'string' ? item.body : '').slice(0, MAX_BODY_LENGTH),
    })
  }

  return [...byKey.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(0, MAX_REMINDERS)
}

export function parseSyncPayload(input: unknown, now: Date): SyncPayload {
  const record = asRecord(input)
  return {
    subscription: parseSubscription(record.subscription),
    reminders: parseReminders(record.reminders ?? [], now),
  }
}

export interface DueRow {
  id: string
  at: string
}

/**
 * 期限が来たものを「送る」と「送らずに畳む」に分ける。
 * 端末の電源が長く落ちていた後に、古い通知がまとめて鳴るのを避けるための区別。
 */
export function partitionDue<T extends DueRow>(
  rows: T[],
  now: Date,
  graceMinutes: number = GRACE_MINUTES,
): { send: T[]; stale: T[] } {
  const limit = now.getTime() - graceMinutes * 60_000
  const send: T[] = []
  const stale: T[] = []

  for (const row of rows) {
    const at = new Date(row.at).getTime()
    if (Number.isNaN(at) || at <= limit) stale.push(row)
    else if (at <= now.getTime()) send.push(row)
  }
  return { send, stale }
}

/** endpoint から購読の ID を作る。endpoint そのものを主キーにすると長すぎるため。 */
export async function subscriptionId(endpoint: string): Promise<string> {
  const encoded = new TextEncoder().encode(endpoint)
  const digest = await crypto.subtle.digest('SHA-256', encoded.buffer.slice(0, encoded.byteLength) as ArrayBuffer)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
