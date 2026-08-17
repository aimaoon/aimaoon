import { describe, expect, it } from 'vitest'
import type { Contest } from '../types'
import { createContest } from './factory'
import { defaultReminders, nextReminder, occurrencesOf, reminderDateTime, upcomingReminders } from './reminder'

const NOW = new Date(2026, 7, 20, 12, 0) // 2026-08-20 12:00

function contest(overrides: Partial<Contest> = {}): Contest {
  return { ...createContest(NOW), name: 'テスト大会', date: '2026-09-01', ...overrides }
}

describe('リマインダーの時刻', () => {
  it('開催日の n 日前の指定時刻になる', () => {
    const c = contest({ reminders: [{ id: 'r', daysBefore: 7, time: '20:00', enabled: true }] })
    const at = reminderDateTime(c, c.reminders[0])
    expect(at.getMonth()).toBe(7)
    expect(at.getDate()).toBe(25)
    expect(at.getHours()).toBe(20)
  })

  it('0 日前は当日になる', () => {
    const c = contest({ reminders: [{ id: 'r', daysBefore: 0, time: '07:00', enabled: true }] })
    expect(reminderDateTime(c, c.reminders[0]).getDate()).toBe(1)
  })

  it('月をまたいでも正しく戻る', () => {
    const c = contest({ date: '2026-09-03', reminders: [{ id: 'r', daysBefore: 7, time: '20:00', enabled: true }] })
    const at = reminderDateTime(c, c.reminders[0])
    expect(at.getMonth()).toBe(7)
    expect(at.getDate()).toBe(27)
  })
})

describe('通知予定の組み立て', () => {
  it('無効なリマインダーは含めない', () => {
    const c = contest({
      reminders: [
        { id: 'on', daysBefore: 7, time: '20:00', enabled: true },
        { id: 'off', daysBefore: 1, time: '20:00', enabled: false },
      ],
    })
    expect(occurrencesOf(c).filter((o) => o.kind === 'event')).toHaveLength(1)
  })

  it('未入金なら入金期限も通知対象になる', () => {
    const c = contest({ reminders: [], entry: { fee: 5000, status: 'unpaid', dueDate: '2026-08-25' } })
    const payment = occurrencesOf(c).filter((o) => o.kind === 'payment')
    expect(payment).toHaveLength(1)
    expect(payment[0].title).toContain('入金期限')
  })

  it('入金済みなら期限の通知は出さない', () => {
    const c = contest({ reminders: [], entry: { fee: 5000, status: 'paid', dueDate: '2026-08-25' } })
    expect(occurrencesOf(c).filter((o) => o.kind === 'payment')).toHaveLength(0)
  })

  it('当日持参の音源は提出期限の通知を出さない', () => {
    const c = contest({ reminders: [], music: { status: 'onsite', dueDate: '2026-08-25' } })
    expect(occurrencesOf(c).filter((o) => o.kind === 'music')).toHaveLength(0)
  })

  it('未提出なら音源の期限を通知する', () => {
    const c = contest({ reminders: [], music: { status: 'ready', dueDate: '2026-08-25' } })
    expect(occurrencesOf(c).filter((o) => o.kind === 'music')).toHaveLength(1)
  })
})

describe('ファイナルの通知', () => {
  it('ファイナルの開催日を基準に鳴る', () => {
    const c = contest({
      reminders: [],
      final: {
        date: '2026-10-01',
        status: 'undecided',
        reminders: [{ id: 'f', daysBefore: 7, time: '20:00', enabled: true }],
      },
    })
    const finals = occurrencesOf(c).filter((o) => o.kind === 'final')
    expect(finals).toHaveLength(1)
    const at = new Date(finals[0].at)
    expect(at.getMonth()).toBe(8)
    expect(at.getDate()).toBe(24)
    expect(finals[0].title).toContain('ファイナル')
  })

  it('進出待ちの段階でも予定として通知する', () => {
    const c = contest({
      reminders: [],
      final: { date: '2026-10-01', status: 'undecided', reminders: defaultReminders() },
    })
    expect(occurrencesOf(c).filter((o) => o.kind === 'final').length).toBeGreaterThan(0)
  })

  it('敗退したら通知しない', () => {
    const c = contest({
      reminders: [],
      final: { date: '2026-10-01', status: 'eliminated', reminders: defaultReminders() },
    })
    expect(occurrencesOf(c).filter((o) => o.kind === 'final')).toHaveLength(0)
  })
})

describe('これから鳴る通知', () => {
  it('過去の通知は落として時系列に並べる', () => {
    const items = [
      contest({ id: 'a', name: 'A', date: '2026-09-01', reminders: defaultReminders() }),
      contest({ id: 'b', name: 'B', date: '2026-08-10', reminders: defaultReminders() }),
    ]
    const list = upcomingReminders(items, NOW)
    expect(list.every((o) => new Date(o.at).getTime() >= NOW.getTime())).toBe(true)
    expect(list.every((o) => o.contestId === 'a')).toBe(true)
    const times = list.map((o) => o.at)
    expect(times).toEqual([...times].sort())
  })

  it('先すぎるものは期間で切る', () => {
    const items = [contest({ date: '2027-06-01', reminders: defaultReminders() })]
    expect(upcomingReminders(items, NOW, 30)).toHaveLength(0)
  })

  it('直近の 1 件を取れる', () => {
    const items = [
      contest({ id: 'far', name: '先', date: '2026-10-01', reminders: defaultReminders() }),
      contest({ id: 'near', name: '近', date: '2026-08-22', reminders: defaultReminders() }),
    ]
    expect(nextReminder(items, NOW)?.contestId).toBe('near')
  })

  it('何もなければ null', () => {
    expect(nextReminder([], NOW)).toBeNull()
  })
})
