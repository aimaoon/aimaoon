import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReminderOccurrence } from '../types'

/** ブラウザ通知が使えないときも含めた状態。 */
export type NotificationState = 'unsupported' | 'default' | 'granted' | 'denied'

/** setTimeout で仕掛けられる現実的な上限。これより先はアプリを開いたときに改めて仕掛ける。 */
const SCHEDULE_WINDOW_MS = 24 * 3_600_000

function currentState(): NotificationState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as NotificationState
}

/**
 * アプリを開いている間だけ、直近 24 時間ぶんのリマインダーをブラウザ通知として仕掛ける。
 * アプリを閉じている間の通知は OS 側に任せる必要があるため、確実に受け取りたい場合は
 * 設定タブから .ics を書き出してスマホのカレンダーに取り込んでもらう。
 */
export function useNotifications(occurrences: ReminderOccurrence[]) {
  const [permission, setPermission] = useState<NotificationState>(currentState)

  const scheduled = useMemo(() => {
    const now = Date.now()
    return occurrences.filter((occurrence) => {
      const at = new Date(occurrence.at).getTime()
      return at > now && at - now <= SCHEDULE_WINDOW_MS
    })
  }, [occurrences])

  const request = useCallback(async () => {
    if (!('Notification' in window)) {
      setPermission('unsupported')
      return
    }
    const result = await Notification.requestPermission()
    setPermission(result as NotificationState)
  }, [])

  useEffect(() => {
    if (permission !== 'granted') return
    const timers = scheduled.map((occurrence) => {
      const delay = new Date(occurrence.at).getTime() - Date.now()
      return window.setTimeout(() => {
        new Notification(occurrence.title, { body: occurrence.body, tag: `${occurrence.contestId}-${occurrence.at}` })
      }, Math.max(delay, 0))
    })
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [permission, scheduled])

  /** 設定できているか確かめるためのテスト通知。 */
  const sendTest = useCallback(() => {
    if (Notification.permission !== 'granted') return
    new Notification('通知のテスト', { body: 'この形でリマインダーが届きます。' })
  }, [])

  return { permission, request, sendTest, scheduledCount: scheduled.length }
}
