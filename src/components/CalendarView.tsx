import { useMemo, useState } from 'react'
import type { Contest } from '../types'
import { buildMonthGrid, formatDateJa, monthOf, shiftMonth, toDateKey, yearOf } from '../lib/date'
import { FINAL_LABELS, isMusicSettled, isPaymentSettled, preparationOf } from '../lib/contest'
import { EmptyState } from './ui'

const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土']

type DayMark = { contests: Contest[]; finals: Contest[]; paymentDue: Contest[]; musicDue: Contest[] }

/** 日付ごとに、その日に置くべき印を集める。 */
function buildMarks(contests: Contest[]): Map<string, DayMark> {
  const map = new Map<string, DayMark>()
  const ensure = (key: string) => {
    const found = map.get(key)
    if (found) return found
    const created: DayMark = { contests: [], finals: [], paymentDue: [], musicDue: [] }
    map.set(key, created)
    return created
  }

  for (const contest of contests) {
    ensure(contest.date).contests.push(contest)
    if (contest.final && contest.final.status !== 'eliminated') ensure(contest.final.date).finals.push(contest)
    if (!isPaymentSettled(contest) && contest.entry.dueDate) ensure(contest.entry.dueDate).paymentDue.push(contest)
    if (!isMusicSettled(contest) && contest.music.dueDate) ensure(contest.music.dueDate).musicDue.push(contest)
  }
  return map
}

/** 月カレンダー。開催日に加えて、入金と音源の締切も点で置く。 */
export function CalendarView({
  contests,
  now,
  onOpen,
}: {
  contests: Contest[]
  now: Date
  onOpen: (id: string) => void
}) {
  const todayKey = toDateKey(now)
  const [cursor, setCursor] = useState(() => ({ year: yearOf(todayKey), month: monthOf(todayKey) }))
  const [selected, setSelected] = useState<string>(todayKey)

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])
  const marks = useMemo(() => buildMarks(contests), [contests])
  const selectedMark = marks.get(selected)

  return (
    <div className="view">
      <div className="cal__head">
        <button type="button" className="icon-btn" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))} aria-label="前の月">
          ‹
        </button>
        <h2 className="cal__title">
          {cursor.year}年{cursor.month}月
        </h2>
        <button type="button" className="icon-btn" onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))} aria-label="次の月">
          ›
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            setCursor({ year: yearOf(todayKey), month: monthOf(todayKey) })
            setSelected(todayKey)
          }}
        >
          今日
        </button>
      </div>

      <div className="cal">
        <div className="cal__weekdays">
          {WEEK_LABELS.map((label) => (
            <span key={label} className="cal__weekday">
              {label}
            </span>
          ))}
        </div>

        {weeks.map((week) => (
          <div key={week[0]} className="cal__week">
            {week.map((day) => {
              const mark = marks.get(day)
              const outside = monthOf(day) !== cursor.month
              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    'cal__day',
                    outside ? 'is-outside' : '',
                    day === todayKey ? 'is-today' : '',
                    day === selected ? 'is-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelected(day)}
                >
                  <span className="cal__num">{Number(day.slice(8))}</span>
                  <span className="cal__dots">
                    {mark?.contests.length ? <i className="dot dot--event" /> : null}
                    {mark?.finals.length ? <i className="dot dot--final" /> : null}
                    {mark?.paymentDue.length ? <i className="dot dot--payment" /> : null}
                    {mark?.musicDue.length ? <i className="dot dot--music" /> : null}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="cal__legend">
        <span>
          <i className="dot dot--event" /> 開催日
        </span>
        <span>
          <i className="dot dot--final" /> ファイナル
        </span>
        <span>
          <i className="dot dot--payment" /> 入金期限
        </span>
        <span>
          <i className="dot dot--music" /> 音源期限
        </span>
      </div>

      <h3 className="cal__selected">{formatDateJa(selected)}</h3>

      {!selectedMark ? (
        <EmptyState icon="🗓" title="この日は予定なし" />
      ) : (
        <ul className="cal__items">
          {selectedMark.contests.map((contest) => {
            const prep = preparationOf(contest, now)
            return (
              <li key={`event-${contest.id}`}>
                <button type="button" className="cal__item cal__item--event" onClick={() => onOpen(contest.id)}>
                  <span className="cal__item-kind">開催</span>
                  <span className="cal__item-name">{contest.name}</span>
                  <span className="cal__item-sub">
                    {contest.startTime || '時刻未定'} ・ 準備 {prep.doneCount}/{prep.totalCount}
                  </span>
                </button>
              </li>
            )
          })}
          {selectedMark.finals.map((contest) => (
            <li key={`final-${contest.id}`}>
              <button type="button" className="cal__item cal__item--final" onClick={() => onOpen(contest.id)}>
                <span className="cal__item-kind">ファイナル</span>
                <span className="cal__item-name">{contest.name}</span>
                <span className="cal__item-sub">
                  {contest.final?.startTime || '時刻未定'} ・ {FINAL_LABELS[contest.final!.status]}
                </span>
              </button>
            </li>
          ))}
          {selectedMark.paymentDue.map((contest) => (
            <li key={`pay-${contest.id}`}>
              <button type="button" className="cal__item cal__item--payment" onClick={() => onOpen(contest.id)}>
                <span className="cal__item-kind">入金期限</span>
                <span className="cal__item-name">{contest.name}</span>
                <span className="cal__item-sub">{contest.entry.fee.toLocaleString('ja-JP')}円</span>
              </button>
            </li>
          ))}
          {selectedMark.musicDue.map((contest) => (
            <li key={`music-${contest.id}`}>
              <button type="button" className="cal__item cal__item--music" onClick={() => onOpen(contest.id)}>
                <span className="cal__item-kind">音源期限</span>
                <span className="cal__item-name">{contest.name}</span>
                <span className="cal__item-sub">{contest.music.method || '提出方法未設定'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
