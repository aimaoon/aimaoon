import type { Contest, FinalRound, Reminder, ReminderOccurrence } from '../types'
import { addDays, atTime, formatDateJa } from './date'
import { finalVenue, isMusicSettled, isPaymentSettled } from './contest'

/** 期限系の通知を出す時刻。 */
export const DEADLINE_TIME = '09:00'

/** 新規コンテストにあらかじめ入れておくリマインダー。 */
export function defaultReminders(): Reminder[] {
  return [
    { id: 'r-7', daysBefore: 7, time: '20:00', label: '1週間前', enabled: true },
    { id: 'r-1', daysBefore: 1, time: '20:00', label: '前日', enabled: true },
    { id: 'r-0', daysBefore: 0, time: '07:00', label: '当日の朝', enabled: true },
  ]
}

/** リマインダー設定の表示名。 */
export function reminderLabel(reminder: Reminder): string {
  if (reminder.label) return reminder.label
  if (reminder.daysBefore === 0) return '当日'
  return `${reminder.daysBefore}日前`
}

/** そのリマインダーが鳴る日時。 */
export function reminderDateTime(contest: Contest, reminder: Reminder): Date {
  return atTime(addDays(contest.date, -reminder.daysBefore), reminder.time)
}

/** ファイナル用。基準日が予選ではなくファイナルの開催日になる。 */
export function finalReminderDateTime(final: FinalRound, reminder: Reminder): Date {
  return atTime(addDays(final.date, -reminder.daysBefore), reminder.time)
}

function bodyOf(dateKey: string, startTime: string | undefined, venueName: string | undefined): string {
  const parts: string[] = []
  if (startTime) parts.push(`${startTime} 集合`)
  if (venueName) parts.push(venueName)
  parts.push(`${formatDateJa(dateKey)} 開催`)
  return parts.join(' / ')
}

function eventBody(contest: Contest): string {
  return bodyOf(contest.date, contest.startTime, contest.venue.name)
}

/**
 * コンテスト 1 件から発生する通知予定をすべて作る。
 * 開催日のリマインダーに加えて、未対応の入金・音源の期限も通知対象にする。
 */
export function occurrencesOf(contest: Contest): ReminderOccurrence[] {
  const list: ReminderOccurrence[] = []

  for (const reminder of contest.reminders) {
    if (!reminder.enabled) continue
    list.push({
      contestId: contest.id,
      contestName: contest.name,
      at: reminderDateTime(contest, reminder).toISOString(),
      title: `${contest.name}（${reminderLabel(reminder)}）`,
      body: eventBody(contest),
      kind: 'event',
    })
  }

  // ファイナルは敗退が決まっていなければ通知する（進出待ちの段階でも予定は押さえておきたい）。
  const final = contest.final
  if (final && final.status !== 'eliminated') {
    for (const reminder of final.reminders) {
      if (!reminder.enabled) continue
      list.push({
        contestId: contest.id,
        contestName: contest.name,
        at: finalReminderDateTime(final, reminder).toISOString(),
        title: `${contest.name} ファイナル（${reminderLabel(reminder)}）`,
        body: bodyOf(final.date, final.startTime, finalVenue(contest).name),
        kind: 'final',
      })
    }
  }

  if (!isPaymentSettled(contest) && contest.entry.dueDate) {
    list.push({
      contestId: contest.id,
      contestName: contest.name,
      at: atTime(contest.entry.dueDate, DEADLINE_TIME).toISOString(),
      title: `入金期限：${contest.name}`,
      body: `エントリー費 ${contest.entry.fee.toLocaleString('ja-JP')}円 の入金期限です`,
      kind: 'payment',
    })
  }

  if (!isMusicSettled(contest) && contest.music.dueDate) {
    list.push({
      contestId: contest.id,
      contestName: contest.name,
      at: atTime(contest.music.dueDate, DEADLINE_TIME).toISOString(),
      title: `音源提出期限：${contest.name}`,
      body: contest.music.method ? `提出方法：${contest.music.method}` : '音源の提出期限です',
      kind: 'music',
    })
  }

  return list
}

/**
 * これから鳴る通知を時系列で返す。
 * horizonDays を過ぎるものは通知タブに出しても仕方ないので落とす。
 */
export function upcomingReminders(contests: Contest[], now: Date, horizonDays = 90): ReminderOccurrence[] {
  const from = now.getTime()
  const to = from + horizonDays * 86_400_000
  return contests
    .flatMap(occurrencesOf)
    .filter((occurrence) => {
      const at = new Date(occurrence.at).getTime()
      return at >= from && at <= to
    })
    .sort((a, b) => a.at.localeCompare(b.at))
}

/** 直近 1 件。何もなければ null。 */
export function nextReminder(contests: Contest[], now: Date): ReminderOccurrence | null {
  return upcomingReminders(contests, now)[0] ?? null
}
