import { useMemo, useState } from 'react'
import type { Contest } from '../types'
import { buildMonthGrid, formatDateJa, monthOf, shiftMonth, toDateKey, yearOf } from '../lib/date'
import type { ScheduleEntry } from '../lib/schedule'
import { SCHEDULE_KIND_LABELS, scheduleByDate, searchSchedule } from '../lib/schedule'
import { EmptyState } from './ui'

const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土']

/** 予定 1 件のボタン。カレンダーの日別表示と検索結果で共通に使う。 */
function ScheduleRow({
  entry,
  showDate,
  onOpen,
}: {
  entry: ScheduleEntry
  showDate?: boolean
  onOpen: () => void
}) {
  return (
    <button type="button" className={`cal__item cal__item--${entry.kind}`} onClick={onOpen}>
      <span className="cal__item-kind">{SCHEDULE_KIND_LABELS[entry.kind]}</span>
      <span className="cal__item-name">{entry.title}</span>
      <span className="cal__item-sub">
        {showDate && <strong className="cal__item-date">{formatDateJa(entry.date)}</strong>}
        {entry.sub}
      </span>
    </button>
  )
}

/**
 * 月カレンダー。開催日に加えて、ファイナル・入金・音源の締切も点で置く。
 * 上の検索窓に入力すると、月に関係なく予定そのものを検索する。
 */
export function CalendarView({
  contests,
  now,
  selected,
  onSelect,
  onOpen,
}: {
  contests: Contest[]
  now: Date
  /** 選んでいる日 YYYY-MM-DD。＋ ボタンがこの日で新規追加するので、画面の外で持つ。 */
  selected: string
  onSelect: (day: string) => void
  onOpen: (id: string) => void
}) {
  const todayKey = toDateKey(now)
  const [cursor, setCursor] = useState(() => ({ year: yearOf(todayKey), month: monthOf(todayKey) }))
  const [query, setQuery] = useState('')
  const [includePast, setIncludePast] = useState(false)

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor])
  const byDate = useMemo(() => scheduleByDate(contests), [contests])
  const results = useMemo(
    () => searchSchedule(contests, query, now, { includePast }),
    [contests, query, now, includePast],
  )
  const searching = query.trim().length > 0
  const selectedEntries = byDate.get(selected) ?? []

  const kindsOf = (day: string) => new Set((byDate.get(day) ?? []).map((entry) => entry.kind))

  return (
    <div className="view">
      <input
        className="search"
        type="search"
        value={query}
        placeholder="予定を検索（大会名・会場・入金・音源）"
        onChange={(event) => setQuery(event.target.value)}
      />

      {searching ? (
        <>
          <div className="search-head">
            <h2 className="search-head__title">検索結果 {results.length} 件</h2>
            <label className="search-head__toggle">
              <input
                type="checkbox"
                checked={includePast}
                onChange={(event) => setIncludePast(event.target.checked)}
              />
              過ぎた予定も
            </label>
          </div>

          {results.length === 0 ? (
            <EmptyState title="該当する予定がありません" description="別の言葉で探してみてください" />
          ) : (
            <ul className="cal__items">
              {results.map((entry) => (
                <li key={entry.id}>
                  <ScheduleRow entry={entry} showDate onOpen={() => onOpen(entry.contestId)} />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="cal__head">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, -1))}
              aria-label="前の月"
            >
              ‹
            </button>
            <h2 className="cal__title">
              {cursor.year}年{cursor.month}月
            </h2>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setCursor(shiftMonth(cursor.year, cursor.month, 1))}
              aria-label="次の月"
            >
              ›
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setCursor({ year: yearOf(todayKey), month: monthOf(todayKey) })
                onSelect(todayKey)
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
                  const kinds = kindsOf(day)
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
                      onClick={() => onSelect(day)}
                    >
                      <span className="cal__num">{Number(day.slice(8))}</span>
                      <span className="cal__dots">
                        {kinds.has('event') && <i className="dot dot--event" />}
                        {kinds.has('final') && <i className="dot dot--final" />}
                        {kinds.has('payment') && <i className="dot dot--payment" />}
                        {kinds.has('music') && <i className="dot dot--music" />}
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

          {selectedEntries.length === 0 ? (
            <EmptyState title="この日は予定なし" />
          ) : (
            <ul className="cal__items">
              {selectedEntries.map((entry) => (
                <li key={entry.id}>
                  <ScheduleRow entry={entry} onOpen={() => onOpen(entry.contestId)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
