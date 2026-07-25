import type { ThreadStatus } from '../types'
import type { UrgencyLevel } from '../lib/format'

const LABELS: Record<ThreadStatus, string> = {
  answered: '対応済み',
  waiting: '要対応',
  unknown: '不明',
}

interface Props {
  status: ThreadStatus
  urgency?: UrgencyLevel
  /** 「26時間放置」のような補足 */
  note?: string
}

/** スレッド／アドレス／ドメインの対応状況バッジ。 */
export function StatusBadge({ status, urgency = 'none', note }: Props) {
  const level = status === 'waiting' ? urgency : 'none'
  return (
    <span className={`badge badge--${status} badge--urgency-${level}`}>
      <span className="badge__dot" aria-hidden="true" />
      {LABELS[status]}
      {note ? <span className="badge__note">{note}</span> : null}
    </span>
  )
}
