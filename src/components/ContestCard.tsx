import type { Contest } from '../types'
import { dateParts, daysUntil, formatDayOffset } from '../lib/date'
import {
  PAYMENT_LABELS,
  activeDate,
  contestPhase,
  hasFinalRight,
  hasUpcomingFinal,
  isMusicSettled,
  isPaymentSettled,
  musicSummary,
  preparationOf,
} from '../lib/contest'
import { Chip, Segments } from './ui'

/** 一覧に並ぶカード 1 枚。左の日付ブロックで日付を、右で状態を読ませる。 */
export function ContestCard({ contest, now, onOpen }: { contest: Contest; now: Date; onOpen: () => void }) {
  const phase = contestPhase(contest, now)
  // 予選が終わっていてファイナルが残っていれば、カードにはファイナルの日を出す。
  const shownDate = activeDate(contest, now)
  const showsFinal = shownDate !== contest.date
  const left = daysUntil(shownDate, now)
  const prep = preparationOf(contest, now)
  const paid = isPaymentSettled(contest)
  const music = isMusicSettled(contest)
  const { month, day, weekday } = dateParts(shownDate)

  return (
    <button type="button" className={`contest-card contest-card--${phase}`} onClick={onOpen}>
      <div className={`date-block ${showsFinal ? 'is-final' : ''}`}>
        {showsFinal && <span className="date-block__tag">FINAL</span>}
        <span className="date-block__month">{month}月</span>
        <span className="date-block__day">{day}</span>
        <span className="date-block__dow">{weekday}</span>
      </div>

      <div className="contest-card__body">
        <div className="contest-card__top">
          <span className="contest-card__offset">{formatDayOffset(left)}</span>
          {contest.category && <p className="contest-card__category">{contest.category}</p>}
        </div>

        <h3 className="contest-card__name">{contest.name || '（名称未設定）'}</h3>

        <p className="contest-card__venue">
          {contest.venue.name || '会場未定'}
          {contest.startTime ? ` ／ ${contest.startTime}` : ''}
        </p>

        <div className="contest-card__chips">
          <Chip tone={paid ? 'ok' : contest.entry.status === 'partial' ? 'warn' : 'danger'}>
            {PAYMENT_LABELS[contest.entry.status]}
          </Chip>
          <Chip tone={music ? 'ok' : 'danger'}>{musicSummary(contest)}</Chip>
          {prep.alerts.length > 0 && <Chip tone="danger">要対応 {prep.alerts.length}</Chip>}
          {hasFinalRight(contest) && <Chip tone="final">ファイナル権獲得</Chip>}
          {!showsFinal && !hasFinalRight(contest) && hasUpcomingFinal(contest, now) && (
            <Chip tone="final">ファイナルあり</Chip>
          )}
        </div>

        {phase !== 'past' && (
          <div className="contest-card__progress">
            <Segments tasks={prep.tasks} />
            <span className="contest-card__progress-label">
              {prep.doneCount}/{prep.totalCount}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}
