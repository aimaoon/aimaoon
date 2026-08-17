import { describe, expect, it } from 'vitest'
import {
  addDays,
  atTime,
  buildMonthGrid,
  daysUntil,
  diffDays,
  formatDateJa,
  formatDayOffset,
  parseDateKey,
  shiftMonth,
  toDateKey,
} from './date'

describe('日付キーの変換', () => {
  it('ローカル時刻の Date を YYYY-MM-DD にする', () => {
    expect(toDateKey(new Date(2026, 7, 20, 23, 30))).toBe('2026-08-20')
  })

  it('YYYY-MM-DD をローカルの 0 時として読む（UTC 解釈でズレない）', () => {
    const d = parseDateKey('2026-08-20')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(7)
    expect(d.getDate()).toBe(20)
    expect(d.getHours()).toBe(0)
  })

  it('往復しても同じ日付になる', () => {
    expect(toDateKey(parseDateKey('2026-01-01'))).toBe('2026-01-01')
  })

  it('日付と時刻を合成できる', () => {
    const d = atTime('2026-08-20', '09:30')
    expect(d.getHours()).toBe(9)
    expect(d.getMinutes()).toBe(30)
  })
})

describe('日数の計算', () => {
  it('月をまたいでも日数を数えられる', () => {
    expect(diffDays('2026-08-30', '2026-09-02')).toBe(3)
  })

  it('過去は負になる', () => {
    expect(diffDays('2026-09-02', '2026-08-30')).toBe(-3)
  })

  it('日付を加算できる', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('夏時間のない日本でも、時刻に関係なく暦日で数える', () => {
    const now = new Date(2026, 7, 20, 23, 59)
    expect(daysUntil('2026-08-21', now)).toBe(1)
    expect(daysUntil('2026-08-20', now)).toBe(0)
  })
})

describe('表示用の整形', () => {
  it('曜日つきで表示する', () => {
    expect(formatDateJa('2026-08-20')).toBe('8/20(木)')
  })

  it('残り日数を日本語にする', () => {
    expect(formatDayOffset(0)).toBe('今日')
    expect(formatDayOffset(1)).toBe('明日')
    expect(formatDayOffset(2)).toBe('明後日')
    expect(formatDayOffset(5)).toBe('あと5日')
    expect(formatDayOffset(-3)).toBe('3日前')
  })
})

describe('カレンダーの升目', () => {
  it('日曜始まりで 7 日ずつに区切る', () => {
    const weeks = buildMonthGrid(2026, 8)
    expect(weeks.every((week) => week.length === 7)).toBe(true)
    expect(parseDateKey(weeks[0][0]).getDay()).toBe(0)
  })

  it('その月の 1 日と月末を必ず含む', () => {
    const days = buildMonthGrid(2026, 2).flat()
    expect(days).toContain('2026-02-01')
    expect(days).toContain('2026-02-28')
  })

  it('月をまたいで前後に移動できる', () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 })
  })
})
