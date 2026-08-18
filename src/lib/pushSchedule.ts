import type { Contest } from '../types'
import { upcomingReminders } from './reminder'

/**
 * 通知サーバーへ預ける予定の組み立て。
 * 送るのは「日時・タイトル・本文」だけで、入金額やジャッジのメモは端末に残す。
 */

export interface PlannedReminder {
  key: string
  /** ISO 8601（UTC） */
  at: string
  title: string
  body: string
}

/** サーバー側の上限に合わせる。 */
export const MAX_PLANNED = 300

/** 何日先の予定まで送るか。 */
export const HORIZON_DAYS = 90

/** これから鳴る通知を、サーバーが扱える形に直す。 */
export function buildPushPlan(contests: Contest[], now: Date): PlannedReminder[] {
  return upcomingReminders(contests, now, HORIZON_DAYS)
    .slice(0, MAX_PLANNED)
    .map((occurrence) => ({
      // 同じ予定が別の行として増えないよう、内容から決まるキーにする。
      key: `${occurrence.contestId}:${occurrence.kind}:${occurrence.at}`,
      at: occurrence.at,
      title: occurrence.title,
      body: occurrence.body,
    }))
}

/**
 * 予定が変わったかどうかの判定に使う短い指紋。
 * 打鍵のたびにサーバーへ送らないための目印なので、衝突しにくければ十分。
 */
export function planFingerprint(plan: PlannedReminder[]): string {
  const source = plan.map((item) => `${item.key}|${item.at}|${item.title}|${item.body}`).join('\n')
  let hash = 5381
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0
  }
  return `${plan.length}-${hash.toString(36)}`
}

/**
 * VAPID の公開鍵（base64url）を pushManager.subscribe が求める形に直す。
 * ArrayBuffer を作って返すのは、Uint8Array のままだと TypeScript が
 * SharedArrayBuffer の可能性を消せず BufferSource として渡せないため。
 */
export function vapidKeyToBytes(base64url: string): ArrayBuffer {
  const padded = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}
