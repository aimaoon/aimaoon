/**
 * Stage Note の通知サーバー（Cloudflare Worker）。
 *
 * 端末からは「通知の日時・タイトル・本文」と購読情報だけを預かる。
 * 大会の中身（入金額、ジャッジのメモ、振り返り）は端末に残したまま。
 *
 * 5 分ごとの Cron で、時刻が来たものを Web Push で送る。
 */

import { GRACE_MINUTES, ValidationError, parseSyncPayload, partitionDue, subscriptionId } from './api'
import { sendPush } from './push'
import type { VapidKeys } from './push'

/** 使うぶんだけの D1 の型。@cloudflare/workers-types を入れずに済ませている。 */
interface D1Result<T> {
  results: T[]
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  run(): Promise<unknown>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
}
interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown>
}

export interface Env {
  DB: D1Database
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
  /** 許可するアプリのオリジン。未設定ならどこからでも受ける。 */
  ALLOWED_ORIGIN?: string
  /** 設定すると、この合言葉を持つリクエストだけ受け付ける。 */
  APP_TOKEN?: string
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

/** 1 回の Cron でさばく上限。取りこぼしても次の 5 分で拾う。 */
const BATCH_SIZE = 200

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Stage-Note-Token',
    'Access-Control-Max-Age': '86400',
  }
}

function json(body: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(env) },
  })
}

function authorized(request: Request, env: Env): boolean {
  if (!env.APP_TOKEN) return true
  return request.headers.get('X-Stage-Note-Token') === env.APP_TOKEN
}

/** 購読を登録し直し、通知の予定をまるごと置き換える。 */
async function handleSync(request: Request, env: Env): Promise<Response> {
  const payload = parseSyncPayload(await request.json(), new Date())
  const id = await subscriptionId(payload.subscription.endpoint)
  const now = new Date().toISOString()

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO subscriptions (id, endpoint, p256dh, auth, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)
       ON CONFLICT(id) DO UPDATE SET p256dh = ?3, auth = ?4, updated_at = ?5`,
    ).bind(id, payload.subscription.endpoint, payload.subscription.keys.p256dh, payload.subscription.keys.auth, now),
    // 予定は毎回まるごと入れ替える。端末で消した予定がサーバーに残らない。
    env.DB.prepare('DELETE FROM reminders WHERE subscription_id = ?1').bind(id),
  ]

  for (const reminder of payload.reminders) {
    statements.push(
      env.DB.prepare(
        'INSERT INTO reminders (id, subscription_id, at, title, body) VALUES (?1, ?2, ?3, ?4, ?5)',
      ).bind(`${id}:${reminder.key}`, id, reminder.at, reminder.title, reminder.body),
    )
  }

  await env.DB.batch(statements)
  return json({ ok: true, scheduled: payload.reminders.length }, env)
}

/** 通知をやめるとき。購読ごと消す（予定も外部キーで一緒に消える）。 */
async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { endpoint?: unknown }
  if (typeof body.endpoint !== 'string') throw new ValidationError('endpoint がありません')

  const id = await subscriptionId(body.endpoint)
  await env.DB.prepare('DELETE FROM subscriptions WHERE id = ?1').bind(id).run()
  return json({ ok: true }, env)
}

interface DueReminder {
  id: string
  at: string
  title: string
  body: string
  subscription_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** Cron から呼ばれる本体。 */
export async function deliverDue(env: Env, now: Date = new Date()): Promise<{ sent: number; stale: number; failed: number }> {
  const vapid: VapidKeys = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  }

  const { results } = await env.DB.prepare(
    `SELECT r.id, r.at, r.title, r.body, r.subscription_id, s.endpoint, s.p256dh, s.auth
     FROM reminders r
     JOIN subscriptions s ON s.id = r.subscription_id
     WHERE r.sent_at IS NULL AND r.at <= ?1
     ORDER BY r.at
     LIMIT ?2`,
  )
    .bind(now.toISOString(), BATCH_SIZE)
    .all<DueReminder>()

  const { send, stale } = partitionDue(results, now, GRACE_MINUTES)
  const done: string[] = stale.map((row) => row.id)
  const expiredSubscriptions = new Set<string>()
  let failed = 0

  for (const row of send) {
    const payload = JSON.stringify({ title: row.title, body: row.body, tag: row.id })
    try {
      const result = await sendPush(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        payload,
        vapid,
        { now },
      )
      if (result.ok) done.push(row.id)
      else if (result.expired) expiredSubscriptions.add(row.subscription_id)
      else failed += 1 // 一時的な失敗として残し、次の Cron でもう一度試す
    } catch {
      failed += 1
    }
  }

  const statements: D1PreparedStatement[] = []
  if (done.length > 0) {
    const placeholders = done.map((_, index) => `?${index + 2}`).join(', ')
    statements.push(
      env.DB.prepare(`UPDATE reminders SET sent_at = ?1 WHERE id IN (${placeholders})`).bind(now.toISOString(), ...done),
    )
  }
  for (const id of expiredSubscriptions) {
    statements.push(env.DB.prepare('DELETE FROM subscriptions WHERE id = ?1').bind(id))
  }
  if (statements.length > 0) await env.DB.batch(statements)

  return { sent: done.length - stale.length, stale: stale.length, failed }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) })
    if (url.pathname === '/api/health') return json({ ok: true }, env)
    if (request.method !== 'POST') return json({ error: 'POST してください' }, env, 405)
    if (!authorized(request, env)) return json({ error: '合言葉が違います' }, env, 401)

    try {
      if (url.pathname === '/api/sync') return await handleSync(request, env)
      if (url.pathname === '/api/unsubscribe') return await handleUnsubscribe(request, env)
      return json({ error: '見つかりません' }, env, 404)
    } catch (error) {
      if (error instanceof ValidationError) return json({ error: error.message }, env, 400)
      // 原因は wrangler tail / Workers Logs で追えるようにしておく。
      console.error('リクエストの処理に失敗しました', error)
      return json({ error: '処理できませんでした' }, env, 500)
    }
  },

  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(deliverDue(env))
  },
}
