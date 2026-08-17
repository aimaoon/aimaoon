import type { Contest } from '../types'
import { atTime, addDays } from './date'
import { FINAL_LABELS, MUSIC_LABELS, PAYMENT_LABELS, finalVenue, isMusicSettled, isPaymentSettled } from './contest'
import { finalReminderDateTime, reminderDateTime, reminderLabel } from './reminder'

/**
 * iCalendar (.ics) の書き出し。
 * スマホの標準カレンダー（iOS カレンダー / Google カレンダー）に読み込ませて、
 * OS 側の通知としてリマインダーを鳴らすために使う。
 */

const PRODID = '-//Stage Note//Dance Contest Manager//JA'

/** RFC 5545 のテキストエスケープ。 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** 1 行 75 オクテットで折り返す（継続行は先頭に空白）。 */
function foldLine(line: string): string[] {
  const out: string[] = []
  let rest = line
  let limit = 75
  while (rest.length > limit) {
    out.push(rest.slice(0, limit))
    rest = rest.slice(limit)
    limit = 74 // 継続行は先頭の空白 1 文字ぶん短くなる
  }
  out.push(rest)
  return out.map((chunk, index) => (index === 0 ? chunk : ` ${chunk}`))
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** ローカル時刻のまま "YYYYMMDDTHHMMSS"（フローティング時刻）で書く。 */
function localStamp(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `T${pad(date.getHours())}${pad(date.getMinutes())}00`
  )
}

/** UTC の "YYYYMMDDTHHMMSSZ"。DTSTAMP と絶対時刻の TRIGGER に使う。 */
export function utcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

/** "YYYY-MM-DD" → "YYYYMMDD" */
function dateStamp(dateKey: string): string {
  return dateKey.replace(/-/g, '')
}

function description(contest: Contest): string {
  const lines = [
    `部門: ${contest.category || '-'}`,
    `入金: ${PAYMENT_LABELS[contest.entry.status]}${contest.entry.fee ? `（${contest.entry.fee.toLocaleString('ja-JP')}円）` : ''}`,
    `音源: ${MUSIC_LABELS[contest.music.status]}${contest.music.title ? `／${contest.music.title}` : ''}`,
  ]
  if (contest.judges.length > 0) {
    lines.push(`ジャッジ: ${contest.judges.map((judge) => judge.name).join('、')}`)
  }
  if (contest.venue.note) lines.push(`会場メモ: ${contest.venue.note}`)
  if (contest.memo) lines.push(`メモ: ${contest.memo}`)
  return lines.join('\n')
}

function location(contest: Contest): string {
  return [contest.venue.name, contest.venue.address].filter(Boolean).join(' ')
}

/** 日時のある予定と終日予定を書き分ける。 */
function timeLines(dateKey: string, startTime?: string, endTime?: string): string[] {
  if (!startTime) {
    return [`DTSTART;VALUE=DATE:${dateStamp(dateKey)}`, `DTEND;VALUE=DATE:${dateStamp(addDays(dateKey, 1))}`]
  }
  const start = atTime(dateKey, startTime)
  const end = endTime ? atTime(dateKey, endTime) : new Date(start.getTime() + 3 * 3_600_000)
  return [`DTSTART:${localStamp(start)}`, `DTEND:${localStamp(end)}`]
}

function alarmLines(description: string, at: Date): string[] {
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(description)}`,
    `TRIGGER;VALUE=DATE-TIME:${utcStamp(at)}`,
    'END:VALARM',
  ]
}

function eventLines(contest: Contest, now: Date): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${contest.id}@stage-note`, `DTSTAMP:${utcStamp(now)}`]

  lines.push(...timeLines(contest.date, contest.startTime, contest.endTime))

  lines.push(
    `SUMMARY:${escapeText(contest.category ? `${contest.name}（${contest.category}）` : contest.name)}`,
    `LOCATION:${escapeText(location(contest))}`,
    `DESCRIPTION:${escapeText(description(contest))}`,
  )

  for (const reminder of contest.reminders) {
    if (!reminder.enabled) continue
    lines.push(...alarmLines(`${contest.name}（${reminderLabel(reminder)}）`, reminderDateTime(contest, reminder)))
  }

  lines.push('END:VEVENT')
  return lines
}

/** ファイナルは別の予定として書き出す。敗退が決まっていれば出さない。 */
function finalLines(contest: Contest, now: Date): string[] {
  const final = contest.final
  if (!final || final.status === 'eliminated') return []

  const venue = finalVenue(contest)
  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${contest.id}-final@stage-note`,
    `DTSTAMP:${utcStamp(now)}`,
    ...timeLines(final.date, final.startTime, final.endTime),
    `SUMMARY:${escapeText(`${contest.name} ファイナル`)}`,
    `LOCATION:${escapeText([venue.name, venue.address].filter(Boolean).join(' '))}`,
    `DESCRIPTION:${escapeText([FINAL_LABELS[final.status], final.note].filter(Boolean).join('\n'))}`,
  ]

  for (const reminder of final.reminders) {
    if (!reminder.enabled) continue
    lines.push(
      ...alarmLines(`${contest.name} ファイナル（${reminderLabel(reminder)}）`, finalReminderDateTime(final, reminder)),
    )
  }

  lines.push('END:VEVENT')
  return lines
}

function deadlineLines(
  contest: Contest,
  now: Date,
  kind: 'payment' | 'music',
  dueDate: string,
  summary: string,
): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:${contest.id}-${kind}@stage-note`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;VALUE=DATE:${dateStamp(dueDate)}`,
    `DTEND;VALUE=DATE:${dateStamp(addDays(dueDate, 1))}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(`${contest.name} の締切です`)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    `TRIGGER;VALUE=DATE-TIME:${utcStamp(atTime(dueDate, '09:00'))}`,
    'END:VALARM',
    'END:VEVENT',
  ]
}

/**
 * コンテスト一覧を .ics 文字列にする。
 * 未対応の入金・音源の期限は終日予定として別に足す。
 */
export function buildIcs(contests: Contest[], now: Date = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ダンスコンテスト',
  ]

  for (const contest of contests) {
    lines.push(...eventLines(contest, now))
    lines.push(...finalLines(contest, now))
    if (!isPaymentSettled(contest) && contest.entry.dueDate) {
      lines.push(...deadlineLines(contest, now, 'payment', contest.entry.dueDate, `入金期限：${contest.name}`))
    }
    if (!isMusicSettled(contest) && contest.music.dueDate) {
      lines.push(
        ...deadlineLines(contest, now, 'music', contest.music.dueDate, `音源提出期限：${contest.name}`),
      )
    }
  }

  lines.push('END:VCALENDAR')
  return lines.flatMap(foldLine).join('\r\n')
}

/** .ics をダウンロードさせる。 */
export function downloadIcs(contests: Contest[], filename = 'dance-contests.ics'): void {
  const blob = new Blob([buildIcs(contests)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
