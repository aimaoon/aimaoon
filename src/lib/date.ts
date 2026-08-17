/**
 * 日付ユーティリティ。
 * アプリ内の日付は "YYYY-MM-DD"（ローカルの暦日）、時刻は "HH:mm" の文字列で持つ。
 * new Date('2026-08-20') は UTC 解釈になり日本時間ではズレるため、ここでは必ず
 * 年月日を分解してローカルの Date を作る。
 */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const

/** Date → "YYYY-MM-DD"（ローカル） */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "YYYY-MM-DD" → その日の 00:00（ローカル）の Date */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** "YYYY-MM-DD" と "HH:mm" を合成してローカルの Date にする。時刻省略時は 00:00。 */
export function atTime(dateKey: string, time?: string): Date {
  const base = parseDateKey(dateKey)
  if (time) {
    const [h, min] = time.split(':').map(Number)
    base.setHours(h ?? 0, min ?? 0, 0, 0)
  }
  return base
}

/** 日数を足した "YYYY-MM-DD" を返す（負数で過去）。 */
export function addDays(dateKey: string, days: number): string {
  const d = parseDateKey(dateKey)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/** from から to までの日数。同じ日なら 0、to が未来なら正。 */
export function diffDays(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey).getTime()
  const to = parseDateKey(toKey).getTime()
  return Math.round((to - from) / 86_400_000)
}

/** 今日から見て、その日付まであと何日か。過去なら負。 */
export function daysUntil(dateKey: string, now: Date): number {
  return diffDays(toDateKey(now), dateKey)
}

/** "2026-08-20" → "8/20(木)" */
export function formatDateJa(dateKey: string): string {
  const d = parseDateKey(dateKey)
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS_JA[d.getDay()]})`
}

/** "2026-08-20" → "2026年8月20日(木)" */
export function formatDateLongJa(dateKey: string): string {
  const d = parseDateKey(dateKey)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS_JA[d.getDay()]})`
}

/** 残り日数の日本語表記。"今日" / "明日" / "あと3日" / "3日前" */
export function formatDayOffset(days: number): string {
  if (days === 0) return '今日'
  if (days === 1) return '明日'
  if (days === 2) return '明後日'
  if (days > 0) return `あと${days}日`
  return `${-days}日前`
}

/** 日時の表示。"8/20(木) 09:30" */
export function formatDateTimeJa(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${formatDateJa(toDateKey(date))} ${hh}:${mm}`
}

/** その月の 1 日を含む週から、月末を含む週までの日付キーを 7 日ずつに区切って返す（週の始まりは日曜）。 */
export function buildMonthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month - 1, 1)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())

  const weeks: string[][] = []
  const cursor = new Date(start)
  // 月末を含む週まで進める。最大 6 週で必ず収まる。
  for (let w = 0; w < 6; w += 1) {
    const week: string[] = []
    for (let i = 0; i < 7; i += 1) {
      week.push(toDateKey(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
    // 次の週がすべて翌月なら打ち切る
    if (cursor.getMonth() !== month - 1 && cursor.getDate() > 7) break
  }
  return weeks
}

/** "YYYY-MM-DD" の月（1〜12）を返す。 */
export function monthOf(dateKey: string): number {
  return Number(dateKey.slice(5, 7))
}

/** "YYYY-MM-DD" の年を返す。 */
export function yearOf(dateKey: string): number {
  return Number(dateKey.slice(0, 4))
}

/** 年月を n か月ずらす。 */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}
