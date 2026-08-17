import { useState } from 'react'
import type { Contest, FinalRound, FinalStatus, Reminder } from '../types'
import { FINAL_LABELS, finalVenue } from '../lib/contest'
import { daysUntil, formatDateJa, formatDateLongJa, formatDayOffset, toDateKey } from '../lib/date'
import { canOpenMap, directionsUrl, googleMapsUrl } from '../lib/map'
import { createFinal, createId } from '../lib/factory'
import { finalReminderDateTime, reminderLabel } from '../lib/reminder'
import { Card, Chip, Field } from './ui'

const STATUS_OPTIONS: FinalStatus[] = ['undecided', 'advanced', 'eliminated']

const STATUS_TONE: Record<FinalStatus, 'accent' | 'ok' | 'neutral'> = {
  undecided: 'accent',
  advanced: 'ok',
  eliminated: 'neutral',
}

/**
 * ファイナル（決勝）の予定。
 * 予選と日程・会場が違うことが多いので、同じ大会の中で別枠として持つ。
 * 会場を空にしておけば予選と同じ会場として扱う。
 */
export function FinalPanel({
  contest,
  now,
  onChange,
}: {
  contest: Contest
  now: Date
  onChange: (final: FinalRound | undefined) => void
}) {
  const [newDays, setNewDays] = useState(3)
  const [newTime, setNewTime] = useState('20:00')

  const final = contest.final

  if (!final) {
    return (
      <Card title="ファイナル" icon="🔥">
        <p className="hint">
          予選を勝ち抜いた先の決勝がある大会は、ここで管理できます。日程が未発表でも権利だけ先に記録できます。
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onChange(createFinal(undefined, 'advanced'))}
          >
            🔥 ファイナル権を獲得した
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => onChange(createFinal(contest.date))}>
            日程を登録する
          </button>
        </div>
      </Card>
    )
  }

  const patch = (changes: Partial<FinalRound>) => onChange({ ...final, ...changes })
  const setReminders = (reminders: Reminder[]) => patch({ reminders })
  const venue = finalVenue(contest)
  const sharesVenue = !final.venue?.name && !final.venue?.address

  return (
    <Card
      title="ファイナル"
      icon="🔥"
      action={
        <button
          type="button"
          className="icon-btn"
          aria-label="ファイナルの予定を削除"
          onClick={() => {
            if (window.confirm('ファイナルの予定を削除します。よろしいですか？')) onChange(undefined)
          }}
        >
          ✕
        </button>
      }
    >
      <div className="final__head">
        <p className="final__date">{final.date ? formatDateLongJa(final.date) : '日程未定'}</p>
        <div className="final__chips">
          <Chip tone={STATUS_TONE[final.status]}>{FINAL_LABELS[final.status]}</Chip>
          {final.date && final.status !== 'eliminated' && (
            <Chip tone="neutral">{formatDayOffset(daysUntil(final.date, now))}</Chip>
          )}
        </div>
      </div>

      <div className="segmented segmented--wrap">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className={`segmented__item ${final.status === option ? 'is-active' : ''}`}
            onClick={() => patch({ status: option })}
          >
            {FINAL_LABELS[option]}
          </button>
        ))}
      </div>

      {final.status === 'eliminated' && (
        <p className="hint">敗退にすると、ファイナルの通知とカレンダー書き出しから外れます。</p>
      )}

      <Field label="開催日" hint={final.date ? undefined : '未発表なら空のままで構いません'}>
        <input
          className="input"
          type="date"
          value={final.date ?? ''}
          onChange={(event) => patch({ date: event.target.value || undefined })}
        />
      </Field>

      {!final.date && (
        <p className="hint">
          日程を入れると、リマインダーとカレンダー（.ics）の書き出し対象になります。
        </p>
      )}

      <div className="field-row">
        <Field label="集合・開始">
          <input
            className="input"
            type="time"
            value={final.startTime ?? ''}
            onChange={(event) => patch({ startTime: event.target.value })}
          />
        </Field>
        <Field label="終了予定">
          <input
            className="input"
            type="time"
            value={final.endTime ?? ''}
            onChange={(event) => patch({ endTime: event.target.value })}
          />
        </Field>
      </div>

      <Field label="会場" hint={sharesVenue ? '空欄なら予選と同じ会場' : undefined}>
        <input
          className="input"
          value={final.venue?.name ?? ''}
          placeholder={contest.venue.name || '会場名'}
          onChange={(event) => patch({ venue: { ...(final.venue ?? { name: '' }), name: event.target.value } })}
        />
      </Field>
      <Field label="住所">
        <input
          className="input"
          value={final.venue?.address ?? ''}
          placeholder={contest.venue.address || '住所'}
          onChange={(event) =>
            patch({ venue: { ...(final.venue ?? { name: '' }), address: event.target.value } })
          }
        />
      </Field>

      {canOpenMap(venue) && (
        <div className="map-links">
          <a className="btn btn--primary" href={googleMapsUrl(venue)} target="_blank" rel="noreferrer">
            🗺 Google マップで開く
          </a>
          <a className="btn btn--ghost" href={directionsUrl(venue)} target="_blank" rel="noreferrer">
            🚃 経路
          </a>
        </div>
      )}

      <ul className="reminder-list">
        {final.reminders.map((reminder) => (
          <li key={reminder.id} className="reminder">
            <label className="reminder__toggle">
              <input
                type="checkbox"
                checked={reminder.enabled}
                onChange={(event) =>
                  setReminders(
                    final.reminders.map((item) =>
                      item.id === reminder.id ? { ...item, enabled: event.target.checked } : item,
                    ),
                  )
                }
              />
              <span className="reminder__label">{reminderLabel(reminder)}</span>
            </label>
            <span className="reminder__at">
              {final.date
                ? `${formatDateJa(toDateKey(finalReminderDateTime(final.date, reminder)))} ${reminder.time}`
                : `日程未定 ${reminder.time}`}
            </span>
            <button
              type="button"
              className="icon-btn"
              aria-label="このリマインダーを削除"
              onClick={() => setReminders(final.reminders.filter((item) => item.id !== reminder.id))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="reminder-add">
        <input
          className="input input--tiny"
          type="number"
          min={0}
          value={newDays}
          onChange={(event) => setNewDays(Math.max(Number(event.target.value), 0))}
        />
        <span className="reminder-add__unit">日前の</span>
        <input
          className="input input--short"
          type="time"
          value={newTime}
          onChange={(event) => setNewTime(event.target.value)}
        />
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() =>
            setReminders([
              ...final.reminders,
              { id: createId('rem'), daysBefore: newDays, time: newTime, enabled: true },
            ])
          }
        >
          追加
        </button>
      </div>

      <textarea
        className="textarea"
        rows={2}
        value={final.note ?? ''}
        placeholder="ファイナルの持ち物、進出条件、リハの時間など"
        onChange={(event) => patch({ note: event.target.value })}
      />
    </Card>
  )
}
