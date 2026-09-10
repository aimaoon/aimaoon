import { useState } from 'react'
import type { Contest, FinalRound, FinalStatus, Reminder } from '../types'
import { FINAL_LABELS, finalVenue } from '../lib/contest'
import { daysUntil, formatDateDotted, formatDateJa, formatDayOffset, toDateKey } from '../lib/date'
import { canOpenMap, directionsUrl, googleMapsUrl } from '../lib/map'
import { createFinal, createId } from '../lib/factory'
import { finalReminderDateTime, reminderLabel } from '../lib/reminder'
import { TrophyMark } from './icons'
import { Card, Chip, Field } from './ui'

/**
 * カードの先頭に出す 4 択。
 * 「ファイナル無し」だけはデータそのものが無い状態（contest.final === undefined）を指す。
 */
type FinalChoice = 'none' | FinalStatus

const CHOICE_OPTIONS: FinalChoice[] = ['none', 'undecided', 'advanced', 'eliminated']

const CHOICE_LABELS: Record<FinalChoice, string> = {
  none: 'ファイナル無し',
  undecided: FINAL_LABELS.undecided,
  advanced: FINAL_LABELS.advanced,
  eliminated: FINAL_LABELS.eliminated,
}

/** 選んだ状態が何を意味するのかを、選んだ直後に 1 行で返す。 */
const CHOICE_HINTS: Record<FinalChoice, string> = {
  none: '決勝が無い大会、または予選に出る前。ファイナルの予定は持ちません。',
  undecided: '予選の結果を待っている状態。日程が発表されていれば、下で押さえておけます。',
  advanced: '決勝に進みました。一覧の「ファイナル権獲得」で絞り込めます。日程は未発表のままでも構いません。',
  eliminated: 'ここで終わりです。ファイナルの通知とカレンダー書き出しからは外れます。',
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
  const choice: FinalChoice = final ? final.status : 'none'

  // 日程や会場を入れたあとで「ファイナル無し」に戻すと、それらは消える。消える中身があるときだけ確認する。
  const hasDetails = Boolean(
    final && (final.date || final.venue?.name || final.venue?.address || final.note),
  )

  const select = (next: FinalChoice) => {
    if (next === choice) return
    if (next === 'none') {
      if (hasDetails && !window.confirm('ファイナルの日程・会場・リマインダーも消えます。よろしいですか？')) return
      onChange(undefined)
      return
    }
    onChange(final ? { ...final, status: next } : createFinal(undefined, next))
  }

  const selector = (
    <>
      <div className="field">
        <span className="field__label">ファイナル権</span>
        <div className="segmented segmented--grid">
          {CHOICE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={choice === option}
              className={`segmented__item ${choice === option ? 'is-active' : ''}`}
              onClick={() => select(option)}
            >
              {CHOICE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>
      <p className="hint">{CHOICE_HINTS[choice]}</p>
    </>
  )

  if (!final) {
    return (
      <Card title="ファイナル" label="FINAL">
        {selector}
      </Card>
    )
  }

  const patch = (changes: Partial<FinalRound>) => onChange({ ...final, ...changes })
  const setReminders = (reminders: Reminder[]) => patch({ reminders })
  const venue = finalVenue(contest)
  const sharesVenue = !final.venue?.name && !final.venue?.address
  const isOut = final.status === 'eliminated'

  return (
    <Card title="ファイナル" label="FINAL" variant={isOut ? undefined : 'final'}>
      {selector}

      {(!isOut || final.date) && (
        <div className={`final__head ${isOut ? 'final__head--out' : ''}`}>
          <p className="final__date">{final.date ? formatDateDotted(final.date) : '日程未定'}</p>
          <div className="final__chips">
            {final.status === 'advanced' && (
              <Chip tone="final" icon={<TrophyMark />}>
                {FINAL_LABELS.advanced}
              </Chip>
            )}
            {final.date && !isOut && <Chip tone="neutral">{formatDayOffset(daysUntil(final.date, now))}</Chip>}
          </div>
        </div>
      )}

      {isOut ? (
        hasDetails && <p className="hint">日程と会場は消していません。状態を戻せばまた出てきます。</p>
      ) : (
        <>
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
              Google マップで開く
            </a>
            <a className="btn btn--ghost" href={directionsUrl(venue)} target="_blank" rel="noreferrer">
              経路
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
        </>
      )}

      <textarea
        className="textarea"
        rows={2}
        value={final.note ?? ''}
        placeholder={isOut ? 'ファイナルについてのメモ' : 'ファイナルの持ち物、進出条件、リハの時間など'}
        onChange={(event) => patch({ note: event.target.value })}
      />
    </Card>
  )
}
