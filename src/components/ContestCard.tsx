import type { Contest } from '../types'
import { daysUntil, formatDateJa, formatDayOffset } from '../lib/date'
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
import { Chip, ProgressBar } from './ui'

/** 一覧に並ぶカード 1 枚。 */
export function ContestCard({ contest, now, onOpen }: { contest: Contest; now: Date; onOpen: () => void }) {
  const phase = contestPhase(contest, now)
  // 予選が終わっていてファイナルが残っていれば、カードにはファイナルの日を出す。
  const shownDate = activeDate(contest, now)
  const showsFinal = shownDate !== contest.date
  const left = daysUntil(shownDate, now)
  const prep = preparationOf(contest, now)
  const paid = isPaymentSettled(contest)
  const music = isMusicSettled(contest)

  return (
    <button type="button" className={`contest-card contest-card--${phase}`} onClick={onOpen}>
      <div className={`contest-card__date ${showsFinal ? 'is-final' : ''}`}>
        {showsFinal && <span className="contest-card__tag">FINAL</span>}
        <span className="contest-card__day">{formatDateJa(shownDate).split('(')[0]}</span>
        <span className="contest-card__offset">{formatDayOffset(left)}</span>
      </div>

      <div className="contest-card__body">
        <h3 className="contest-card__name">{contest.name || '（名称未設定）'}</h3>
        {contest.category && <p className="contest-card__category">{contest.category}</p>}
        <p className="contest-card__venue">
          📍 {contest.venue.name || '会場未定'}
          {contest.startTime ? ` ・ ${contest.startTime}` : ''}
        </p>

        <div className="contest-card__chips">
          <Chip tone={paid ? 'ok' : contest.entry.status === 'partial' ? 'warn' : 'danger'}>
            💰 {PAYMENT_LABELS[contest.entry.status]}
          </Chip>
          <Chip tone={music ? 'ok' : 'danger'}>🎵 {musicSummary(contest)}</Chip>
          {prep.alerts.length > 0 && <Chip tone="danger">⚠︎ 要対応 {prep.alerts.length}</Chip>}
          {hasFinalRight(contest) && <Chip tone="accent">🔥 ファイナル権獲得</Chip>}
          {!showsFinal && !hasFinalRight(contest) && hasUpcomingFinal(contest, now) && (
            <Chip tone="accent">🔥 ファイナル {formatDateJa(contest.final!.date!).split('(')[0]}</Chip>
          )}
        </div>

        {phase !== 'past' && (
          <div className="contest-card__progress">
            <ProgressBar ratio={prep.ratio} tone={prep.alerts.length > 0 ? 'warn' : 'accent'} />
            <span className="contest-card__progress-label">
              準備 {prep.doneCount}/{prep.totalCount}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}
