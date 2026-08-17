import { useMemo, useState } from 'react'
import type { Contest } from '../types'
import type { ContestFilter } from '../lib/contest'
import {
  contestPhase,
  filterContests,
  isFilterActive,
  judgeIndex,
  pendingReviews,
  preparationOf,
  sortContests,
} from '../lib/contest'
import { formatDateJa } from '../lib/date'
import { ContestCard } from './ContestCard'
import { FilterBar } from './FilterBar'
import { EmptyState } from './ui'

type Phase = 'upcoming' | 'todo' | 'past' | 'all'

const PHASES: { key: Phase; label: string }[] = [
  { key: 'upcoming', label: 'これから' },
  { key: 'todo', label: '要対応' },
  { key: 'past', label: '終わった' },
  { key: 'all', label: 'すべて' },
]

/** ホーム。要対応の警告 → 一覧、の順で見せる。 */
export function HomeView({
  contests,
  now,
  onOpen,
}: {
  contests: Contest[]
  now: Date
  onOpen: (id: string) => void
}) {
  const [phase, setPhase] = useState<Phase>('upcoming')
  const [filter, setFilter] = useState<ContestFilter>({ query: '', judges: [], finalRightOnly: false })

  const sorted = useMemo(() => sortContests(contests, now), [contests, now])
  const judges = useMemo(() => judgeIndex(contests), [contests])

  const alerts = useMemo(
    () =>
      sorted
        .filter((contest) => contestPhase(contest, now) !== 'past')
        .flatMap((contest) =>
          preparationOf(contest, now).alerts.map((task) => ({ contest, task })),
        )
        .sort((a, b) => (a.task.urgency === b.task.urgency ? 0 : a.task.urgency === 'overdue' ? -1 : 1)),
    [sorted, now],
  )

  const unreviewed = useMemo(() => pendingReviews(contests, now), [contests, now])

  const visible = useMemo(() => {
    const base = filterContests(sorted, filter)
    if (phase === 'all') return base
    if (phase === 'past') return base.filter((contest) => contestPhase(contest, now) === 'past')
    if (phase === 'todo') {
      return base.filter(
        (contest) => contestPhase(contest, now) !== 'past' && preparationOf(contest, now).alerts.length > 0,
      )
    }
    return base.filter((contest) => contestPhase(contest, now) !== 'past')
  }, [sorted, filter, phase, now])

  return (
    <div className="view">
      {alerts.length > 0 && (
        <div className="alert-strip">
          <h2 className="alert-strip__title">⚠︎ 締切が近い・過ぎている</h2>
          <ul className="alert-strip__list">
            {alerts.slice(0, 4).map(({ contest, task }) => (
              <li key={`${contest.id}-${task.kind}`}>
                <button type="button" className={`alert-row alert-row--${task.urgency}`} onClick={() => onOpen(contest.id)}>
                  <span className="alert-row__label">{task.label}</span>
                  <span className="alert-row__name">{contest.name}</span>
                  <span className="alert-row__due">
                    {task.dueDate ? `期限 ${formatDateJa(task.dueDate)}` : `開催 ${formatDateJa(contest.date)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {unreviewed.length > 0 && (
        <button type="button" className="review-nudge" onClick={() => onOpen(unreviewed[0].id)}>
          📝 「{unreviewed[0].name}」の振り返りがまだです
          {unreviewed.length > 1 && <span className="review-nudge__more">ほか {unreviewed.length - 1} 件</span>}
        </button>
      )}

      <div className="toolbar">
        <input
          className="search"
          type="search"
          value={filter.query ?? ''}
          placeholder="大会名・会場・ジャッジ・メモで検索"
          onChange={(event) => setFilter({ ...filter, query: event.target.value })}
        />
        <div className="segmented" role="tablist">
          {PHASES.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={phase === item.key}
              className={`segmented__item ${phase === item.key ? 'is-active' : ''}`}
              onClick={() => setPhase(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <FilterBar judges={judges} filter={filter} resultCount={visible.length} onChange={setFilter} />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="💃"
          title={
            isFilterActive(filter)
              ? '該当する大会がありません'
              : phase === 'todo'
                ? '要対応はありません'
                : 'まだ登録がありません'
          }
          description={
            isFilterActive(filter)
              ? '条件を外すか、「すべて」に切り替えて探してみてください'
              : '右下の ＋ からコンテストを追加できます'
          }
        />
      ) : (
        <ul className="contest-list">
          {visible.map((contest) => (
            <li key={contest.id}>
              <ContestCard contest={contest} now={now} onOpen={() => onOpen(contest.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
