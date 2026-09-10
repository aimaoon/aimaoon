import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlannedReminder } from '../lib/pushSchedule'
import { planFingerprint, vapidKeyToBytes } from '../lib/pushSchedule'

/**
 * アプリを閉じていても届く通知の購読。
 *
 * 端末で Service Worker を登録し、購読情報と「これから鳴る予定」をサーバーへ預ける。
 * 実際に通知を送るのはサーバー側の定期実行なので、アプリが開いている必要はない。
 *
 * 送信先が設定されていない場合（環境変数なし）は何もせず、画面側は
 * 従来どおり「開いている間の通知」と .ics の案内に倒す。
 */

const API_BASE = (import.meta.env.VITE_PUSH_API ?? '').replace(/\/$/, '')
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''
const APP_TOKEN = import.meta.env.VITE_PUSH_TOKEN ?? ''

/** 設定が揃っているか（揃っていなければ機能ごと隠す）。 */
export const PUSH_CONFIGURED = Boolean(API_BASE && VAPID_PUBLIC_KEY)

export type PushState =
  | 'unconfigured' // 送信先が未設定
  | 'unsupported' // 端末が対応していない
  | 'denied' // 通知がブロックされている
  | 'idle' // 使えるが未登録
  | 'subscribed' // 登録済み

function supported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
}

async function post(path: string, body: unknown): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (APP_TOKEN) headers['X-Stage-Note-Token'] = APP_TOKEN

  const response = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!response.ok) throw new Error(`サーバーが ${response.status} を返しました`)
  return response
}

function initialState(): PushState {
  if (!PUSH_CONFIGURED) return 'unconfigured'
  if (!supported()) return 'unsupported'
  return Notification.permission === 'denied' ? 'denied' : 'idle'
}

export function usePush(plan: PlannedReminder[]) {
  const [state, setState] = useState<PushState>(initialState)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncedCount, setSyncedCount] = useState(0)
  const [syncedAt, setSyncedAt] = useState<Date | null>(null)
  const lastFingerprint = useRef<string | null>(null)

  const fingerprint = planFingerprint(plan)

  // すでに登録済みの端末では、開いた時点でその状態に戻す。
  useEffect(() => {
    if (!PUSH_CONFIGURED || !supported()) return
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (subscription) setState('subscribed')
      })
      .catch(() => {
        /* 未登録なら idle のままでよい */
      })
  }, [])

  const sync = useCallback(async (reminders: PlannedReminder[]): Promise<void> => {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return

    await post('/api/sync', { subscription: subscription.toJSON(), reminders })
    setSyncedCount(reminders.length)
    setSyncedAt(new Date())
  }, [])

  /** 通知の許可を取り、購読して、いまの予定を預ける。 */
  const enable = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'idle')
        return
      }

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyToBytes(VAPID_PUBLIC_KEY),
        }))

      await post('/api/sync', { subscription: subscription.toJSON(), reminders: plan })
      lastFingerprint.current = fingerprint
      setSyncedCount(plan.length)
      setSyncedAt(new Date())
      setState('subscribed')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登録できませんでした')
    } finally {
      setBusy(false)
    }
  }, [plan, fingerprint])

  /** 購読をやめる。サーバー側の控えも消す。 */
  const disable = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await post('/api/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {
          /* サーバーに届かなくても、端末側は解除する */
        })
        await subscription.unsubscribe()
      }
      lastFingerprint.current = null
      setSyncedAt(null)
      setSyncedCount(0)
      setState('idle')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '解除できませんでした')
    } finally {
      setBusy(false)
    }
  }, [])

  // 予定が変わったら送り直す。打鍵のたびに飛ばさないよう、変化したときだけ・少し待ってから。
  useEffect(() => {
    if (state !== 'subscribed') return
    if (lastFingerprint.current === fingerprint) return

    const timer = window.setTimeout(() => {
      sync(plan)
        .then(() => {
          lastFingerprint.current = fingerprint
        })
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : '同期できませんでした')
        })
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [state, fingerprint, plan, sync])

  return { state, busy, error, syncedCount, syncedAt, enable, disable }
}
