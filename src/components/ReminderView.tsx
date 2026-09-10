import { useMemo } from 'react'
import type { Contest, ReminderOccurrence } from '../types'
import { formatDateJa, formatDateTimeJa, toDateKey } from '../lib/date'
import { upcomingReminders } from '../lib/reminder'
import { buildPushPlan } from '../lib/pushSchedule'
import { downloadIcs } from '../lib/ics'
import { useNotifications } from '../hooks/useNotifications'
import { usePush } from '../hooks/usePush'
import { Card, Chip, EmptyState } from './ui'

const KIND_LABEL: Record<ReminderOccurrence['kind'], string> = {
  event: '開催',
  final: 'ファイナル',
  payment: '入金',
  music: '音源',
}

const KIND_TONE = {
  event: 'accent',
  final: 'final',
  payment: 'warn',
  music: 'ok',
} as const

/** 通知タブ。これから鳴る予定と、確実に受け取るための導線をまとめる。 */
export function ReminderView({
  contests,
  now,
  onOpen,
}: {
  contests: Contest[]
  now: Date
  onOpen: (id: string) => void
}) {
  const occurrences = useMemo(() => upcomingReminders(contests, now), [contests, now])
  const plan = useMemo(() => buildPushPlan(contests, now), [contests, now])
  const push = usePush(plan)

  // プッシュが動いているときに画面側でも鳴らすと二重に届くので、そのときは渡さない。
  const inApp = useNotifications(push.state === 'subscribed' ? [] : occurrences)

  const grouped = useMemo(() => {
    const map = new Map<string, ReminderOccurrence[]>()
    for (const occurrence of occurrences) {
      const key = toDateKey(new Date(occurrence.at))
      map.set(key, [...(map.get(key) ?? []), occurrence])
    }
    return [...map.entries()]
  }, [occurrences])

  return (
    <div className="view">
      <Card title="通知" label="NOTIFICATIONS">
        {push.state === 'subscribed' ? (
          <>
            <p className="hint hint--ok">
              この端末で受け取る設定になっています。アプリを閉じていても、{push.syncedCount || plan.length} 件の予定が時刻に届きます。
            </p>
            {push.syncedAt && (
              <p className="hint">最終同期 {formatDateTimeJa(push.syncedAt)}（予定を変えると自動で送り直します）</p>
            )}
            <button type="button" className="btn btn--ghost" onClick={push.disable} disabled={push.busy}>
              この端末での受け取りをやめる
            </button>
          </>
        ) : push.state === 'idle' ? (
          <>
            <p className="hint">
              許可すると、アプリを閉じていても通知が届きます。
              iPhone では先に「ホーム画面に追加」してから、追加したアイコンで開いて許可してください。
            </p>
            <button type="button" className="btn btn--primary" onClick={push.enable} disabled={push.busy}>
              {push.busy ? '登録しています…' : 'この端末で受け取る'}
            </button>
          </>
        ) : push.state === 'denied' ? (
          <p className="hint hint--warn">
            通知がブロックされています。ブラウザの設定から許可し直すと登録できます。
          </p>
        ) : push.state === 'unsupported' ? (
          <p className="hint">この端末は通知に対応していません。下の .ics でカレンダーに登録してください。</p>
        ) : (
          // 送信先が未設定のときは、開いている間だけの通知に倒す。
          <>
            <p className="hint">
              通知サーバーが未設定のため、いまは<strong>アプリを開いている間だけ</strong>お知らせできます。
              閉じていても受け取るには、worker/ を配置して .env を設定してください。
            </p>
            {inApp.permission === 'granted' ? (
              <>
                <p className="hint hint--ok">開いている間の通知は許可済みです（24 時間以内の {inApp.scheduledCount} 件）。</p>
                <button type="button" className="btn btn--ghost" onClick={inApp.sendTest}>
                  テスト通知を送る
                </button>
              </>
            ) : inApp.permission === 'default' ? (
              <button type="button" className="btn btn--ghost" onClick={inApp.request}>
                開いている間の通知を許可する
              </button>
            ) : null}
          </>
        )}

        {push.error && <p className="hint hint--warn">{push.error}</p>}

        <p className="hint">
          スマホの標準カレンダーに取り込んでおくと、この端末以外でもアラームが鳴ります。
        </p>
        <button type="button" className="btn btn--ghost" onClick={() => downloadIcs(contests)} disabled={contests.length === 0}>
          すべての予定を書き出す（.ics）
        </button>
      </Card>

      {grouped.length === 0 ? (
        <EmptyState title="予定されている通知はありません" description="コンテストを追加すると自動で並びます" />
      ) : (
        grouped.map(([day, items]) => (
          <section key={day} className="timeline">
            <h3 className="timeline__day">{formatDateJa(day)}</h3>
            <ul className="timeline__list">
              {items.map((occurrence) => (
                <li key={`${occurrence.contestId}-${occurrence.at}-${occurrence.kind}`}>
                  <button type="button" className="timeline__item" onClick={() => onOpen(occurrence.contestId)}>
                    <span className="timeline__time">{formatDateTimeJa(new Date(occurrence.at)).split(' ')[1]}</span>
                    <span className="timeline__body">
                      <span className="timeline__title">{occurrence.title}</span>
                      <span className="timeline__sub">{occurrence.body}</span>
                    </span>
                    <Chip tone={KIND_TONE[occurrence.kind]}>{KIND_LABEL[occurrence.kind]}</Chip>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
