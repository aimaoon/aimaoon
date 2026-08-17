import { describe, expect, it } from 'vitest'
import type { Contest } from '../types'
import { createContest } from './factory'
import { buildSchedule, entriesOf, scheduleByDate, searchSchedule } from './schedule'

const NOW = new Date(2026, 7, 20, 12, 0) // 2026-08-20

function contest(overrides: Partial<Contest> = {}): Contest {
  return { ...createContest(NOW), name: 'テスト大会', date: '2026-09-01', reminders: [], ...overrides }
}

describe('予定の組み立て', () => {
  it('開催日は必ず 1 件出る', () => {
    const entries = entriesOf(contest())
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe('event')
    expect(entries[0].date).toBe('2026-09-01')
  })

  it('未対応の締切とファイナルが別の予定になる', () => {
    const entries = entriesOf(
      contest({
        entry: { fee: 5000, status: 'unpaid', dueDate: '2026-08-25' },
        music: { status: 'ready', dueDate: '2026-08-27' },
        final: { date: '2026-10-01', status: 'advanced', reminders: [] },
      }),
    )
    expect(entries.map((entry) => entry.kind).sort()).toEqual(['event', 'final', 'music', 'payment'])
  })

  it('対応済みの締切は予定に出さない', () => {
    const entries = entriesOf(
      contest({
        entry: { fee: 5000, status: 'paid', dueDate: '2026-08-25' },
        music: { status: 'ready', bringOnDay: true, dueDate: '2026-08-27' },
      }),
    )
    expect(entries).toHaveLength(1)
  })

  it('日程未定・敗退のファイナルは予定にしない', () => {
    expect(entriesOf(contest({ final: { status: 'advanced', reminders: [] } })).map((e) => e.kind)).toEqual(['event'])
    expect(
      entriesOf(contest({ final: { date: '2026-10-01', status: 'eliminated', reminders: [] } })).map((e) => e.kind),
    ).toEqual(['event'])
  })

  it('日付順に並ぶ', () => {
    const list = buildSchedule([
      contest({ id: 'b', name: 'B', date: '2026-09-10' }),
      contest({ id: 'a', name: 'A', date: '2026-08-25' }),
    ])
    expect(list.map((entry) => entry.date)).toEqual(['2026-08-25', '2026-09-10'])
  })

  it('日付をキーに引ける', () => {
    const map = scheduleByDate([
      contest({ id: 'a', name: 'A', date: '2026-09-01' }),
      contest({ id: 'b', name: 'B', date: '2026-09-01' }),
    ])
    expect(map.get('2026-09-01')).toHaveLength(2)
    expect(map.get('2026-09-02')).toBeUndefined()
  })
})

describe('予定の検索', () => {
  const items = [
    contest({ id: 'a', name: 'TOKYO BATTLE', date: '2026-09-01', venue: { name: '横浜 BAY HALL' } }),
    contest({
      id: 'b',
      name: 'OSAKA JAM',
      date: '2026-09-20',
      entry: { fee: 5000, status: 'unpaid', dueDate: '2026-09-05', method: '銀行振込' },
    }),
    contest({ id: 'c', name: '過ぎた大会', date: '2026-08-01' }),
  ]

  it('空の検索語では何も返さない', () => {
    expect(searchSchedule(items, '   ', NOW)).toHaveLength(0)
  })

  it('大会名で引ける', () => {
    expect(searchSchedule(items, 'osaka', NOW).map((entry) => entry.contestId)).toEqual(['b', 'b'])
  })

  it('会場名でも引ける', () => {
    expect(searchSchedule(items, 'bay', NOW).map((entry) => entry.contestId)).toEqual(['a'])
  })

  it('種別の名前で引ける', () => {
    const found = searchSchedule(items, '入金', NOW)
    expect(found).toHaveLength(1)
    expect(found[0].kind).toBe('payment')
  })

  it('既定では過ぎた予定を落とす', () => {
    expect(searchSchedule(items, '過ぎた', NOW)).toHaveLength(0)
    expect(searchSchedule(items, '過ぎた', NOW, { includePast: true })).toHaveLength(1)
  })

  it('結果は日付順', () => {
    const dates = searchSchedule(items, '大会', NOW, { includePast: true }).map((entry) => entry.date)
    expect(dates).toEqual([...dates].sort())
  })
})
