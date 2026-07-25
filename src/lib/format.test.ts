import { describe, expect, it } from 'vitest'
import { formatElapsed, urgencyOf } from './format'

const NOW = Date.parse('2026-01-10T12:00:00Z')
const hoursBefore = (hours: number) => new Date(NOW - hours * 3600_000).toISOString()

describe('urgencyOf', () => {
  it('未対応でなければ none', () => {
    expect(urgencyOf(null, NOW)).toBe('none')
  })

  it('24 時間未満は fresh', () => {
    expect(urgencyOf(hoursBefore(1), NOW)).toBe('fresh')
    expect(urgencyOf(hoursBefore(23), NOW)).toBe('fresh')
  })

  it('24 時間以上 72 時間未満は warning', () => {
    expect(urgencyOf(hoursBefore(24), NOW)).toBe('warning')
    expect(urgencyOf(hoursBefore(71), NOW)).toBe('warning')
  })

  it('72 時間以上は overdue', () => {
    expect(urgencyOf(hoursBefore(72), NOW)).toBe('overdue')
    expect(urgencyOf(hoursBefore(240), NOW)).toBe('overdue')
  })

  it('日時として解釈できなければ none', () => {
    expect(urgencyOf('not-a-date', NOW)).toBe('none')
  })
})

describe('formatElapsed', () => {
  it('経過時間を日本語の相対表記にする', () => {
    expect(formatElapsed(hoursBefore(0), NOW)).toBe('たった今')
    expect(formatElapsed(hoursBefore(0.5), NOW)).toBe('30分前')
    expect(formatElapsed(hoursBefore(5), NOW)).toBe('5時間前')
    expect(formatElapsed(hoursBefore(30), NOW)).toBe('1日前')
    expect(formatElapsed(hoursBefore(24 * 45), NOW)).toBe('1か月前')
  })

  it('未来の日時は「まもなく」', () => {
    expect(formatElapsed(hoursBefore(-2), NOW)).toBe('まもなく')
  })

  it('日時として解釈できなければ - を返す', () => {
    expect(formatElapsed('not-a-date', NOW)).toBe('-')
  })
})
