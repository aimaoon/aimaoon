/** 放置時間の深刻度。UI の色分けに使う。 */
export type UrgencyLevel = 'none' | 'fresh' | 'warning' | 'overdue'

const HOUR = 60 * 60 * 1000

/** 未対応になってからの深刻度。24 時間で警告、72 時間で重大とみなす。 */
export function urgencyOf(pendingSince: string | null, now: number = Date.now()): UrgencyLevel {
  if (!pendingSince) return 'none'
  const elapsed = now - Date.parse(pendingSince)
  if (Number.isNaN(elapsed)) return 'none'
  if (elapsed >= 72 * HOUR) return 'overdue'
  if (elapsed >= 24 * HOUR) return 'warning'
  return 'fresh'
}

/** 「3日前」「5時間前」のような相対表記。 */
export function formatElapsed(iso: string, now: number = Date.now()): string {
  const elapsed = now - Date.parse(iso)
  if (Number.isNaN(elapsed)) return '-'
  if (elapsed < 0) return 'まもなく'
  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days < 31) return `${days}日前`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}か月前`
  return `${Math.floor(days / 365)}年前`
}

const dateTimeFormat = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** 一覧・詳細で使う絶対日時表記。 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return dateTimeFormat.format(date)
}
