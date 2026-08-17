import { useMemo } from 'react'
import type { Contest, ReminderOccurrence } from '../types'
import { formatDateJa, formatDateTimeJa, toDateKey } from '../lib/date'
import { upcomingReminders } from '../lib/reminder'
import { downloadIcs } from '../lib/ics'
import { useNotifications } from '../hooks/useNotifications'
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
  const { permission, request, sendTest, scheduledCount } = useNotifications(occurrences)

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
      <Card title="通知の設定" label="NOTIFICATIONS">
        {permission === 'granted' ? (
          <>
            <p className="hint hint--ok">
              通知は許可されています。アプリを開いている間、24 時間以内の {scheduledCount} 件をお知らせします。
            </p>
            <button type="button" className="btn btn--ghost" onClick={sendTest}>
              テスト通知を送る
            </button>
          </>
        ) : permission === 'unsupported' ? (
          <p className="hint">このブラウザは通知に対応していません。下の .ics でカレンダーに登録してください。</p>
        ) : permission === 'denied' ? (
          <p className="hint hint--warn">通知がブロックされています。ブラウザの設定から許可し直してください。</p>
        ) : (
          <>
            <p className="hint">通知を許可すると、リマインダーの時刻にお知らせできます。</p>
            <button type="button" className="btn btn--primary" onClick={request}>
              通知を許可する
            </button>
          </>
        )}
        <p className="hint">
          アプリを閉じている間も確実に受け取るには、.ics を書き出してスマホのカレンダーに取り込むのが確実です。
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
