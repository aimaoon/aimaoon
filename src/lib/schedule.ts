import type { Contest } from '../types'
import { FINAL_LABELS, finalVenue, isMusicSettled, isPaymentSettled } from './contest'
import { daysUntil } from './date'

/**
 * カレンダーに載るできごとを 1 件ずつに開いたもの。
 * 「開催日」「ファイナル」「入金期限」「音源期限」を同じ形で扱えるようにして、
 * カレンダーの日別表示と予定検索の両方から使う。
 */
export interface ScheduleEntry {
  id: string
  contestId: string
  kind: 'event' | 'final' | 'payment' | 'music'
  /** YYYY-MM-DD */
  date: string
  /** 大会名 */
  title: string
  /** 時刻や状態などの補足 */
  sub: string
}

export const SCHEDULE_KIND_LABELS: Record<ScheduleEntry['kind'], string> = {
  event: '開催',
  final: 'ファイナル',
  payment: '入金期限',
  music: '音源期限',
}

/** コンテスト 1 件から、カレンダーに置く予定をすべて作る。 */
export function entriesOf(contest: Contest): ScheduleEntry[] {
  const list: ScheduleEntry[] = [
    {
      id: `${contest.id}-event`,
      contestId: contest.id,
      kind: 'event',
      date: contest.date,
      title: contest.name,
      sub: [contest.startTime || '時刻未定', contest.venue.name].filter(Boolean).join(' ・ '),
    },
  ]

  const final = contest.final
  if (final?.date && final.status !== 'eliminated') {
    list.push({
      id: `${contest.id}-final`,
      contestId: contest.id,
      kind: 'final',
      date: final.date,
      title: contest.name,
      sub: [final.startTime || '時刻未定', FINAL_LABELS[final.status], finalVenue(contest).name]
        .filter(Boolean)
        .join(' ・ '),
    })
  }

  if (!isPaymentSettled(contest) && contest.entry.dueDate) {
    list.push({
      id: `${contest.id}-payment`,
      contestId: contest.id,
      kind: 'payment',
      date: contest.entry.dueDate,
      title: contest.name,
      sub: `${contest.entry.fee.toLocaleString('ja-JP')}円${contest.entry.method ? ` ・ ${contest.entry.method}` : ''}`,
    })
  }

  if (!isMusicSettled(contest) && contest.music.dueDate) {
    list.push({
      id: `${contest.id}-music`,
      contestId: contest.id,
      kind: 'music',
      date: contest.music.dueDate,
      title: contest.name,
      sub: contest.music.method || '提出方法未設定',
    })
  }

  return list
}

/** 全コンテストの予定を日付順に並べて返す。 */
export function buildSchedule(contests: Contest[]): ScheduleEntry[] {
  return contests.flatMap(entriesOf).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'ja'))
}

/** 日付をキーにした引き当て表（カレンダーの升目用）。 */
export function scheduleByDate(contests: Contest[]): Map<string, ScheduleEntry[]> {
  const map = new Map<string, ScheduleEntry[]>()
  for (const entry of buildSchedule(contests)) {
    map.set(entry.date, [...(map.get(entry.date) ?? []), entry])
  }
  return map
}

/**
 * 予定のフリーワード検索。
 * 大会名・補足・種別名（「入金」「ファイナル」など）を対象にする。
 * 既定では過ぎた予定を落とし、日付が近い順に並べる。
 */
export function searchSchedule(
  contests: Contest[],
  query: string,
  now: Date,
  options: { includePast?: boolean } = {},
): ScheduleEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return buildSchedule(contests).filter((entry) => {
    if (!options.includePast && daysUntil(entry.date, now) < 0) return false
    return `${entry.title} ${entry.sub} ${SCHEDULE_KIND_LABELS[entry.kind]}`.toLowerCase().includes(q)
  })
}
