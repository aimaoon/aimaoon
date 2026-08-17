import { describe, expect, it } from 'vitest'
import type { Contest } from '../types'
import {
  activeDate,
  contestPhase,
  finalVenue,
  hasReview,
  hasUpcomingFinal,
  isMusicSettled,
  isPaymentSettled,
  pendingReviews,
  preparationOf,
  searchContests,
  sortContests,
} from './contest'
import { createContest } from './factory'

const NOW = new Date(2026, 7, 20, 12, 0) // 2026-08-20 12:00

function contest(overrides: Partial<Contest> = {}): Contest {
  return { ...createContest(NOW), name: 'テスト大会', ...overrides }
}

function taskOf(c: Contest, kind: string) {
  const task = preparationOf(c, NOW).tasks.find((t) => t.kind === kind)
  if (!task) throw new Error(`${kind} のタスクがない`)
  return task
}

describe('入金の判定', () => {
  it('入金済みと費用なしは完了扱い', () => {
    expect(isPaymentSettled(contest({ entry: { fee: 3000, status: 'paid' } }))).toBe(true)
    expect(isPaymentSettled(contest({ entry: { fee: 0, status: 'free' } }))).toBe(true)
  })

  it('未入金と一部入金は未完了', () => {
    expect(isPaymentSettled(contest({ entry: { fee: 3000, status: 'unpaid' } }))).toBe(false)
    expect(isPaymentSettled(contest({ entry: { fee: 3000, status: 'partial', paidAmount: 1000 } }))).toBe(false)
  })

  it('入金期限を過ぎていたら overdue になる', () => {
    const c = contest({
      date: '2026-09-01',
      entry: { fee: 3000, status: 'unpaid', dueDate: '2026-08-18' },
    })
    expect(taskOf(c, 'payment').urgency).toBe('overdue')
  })

  it('期限が 3 日以内なら soon になる', () => {
    const c = contest({
      date: '2026-09-01',
      entry: { fee: 3000, status: 'unpaid', dueDate: '2026-08-22' },
    })
    expect(taskOf(c, 'payment').urgency).toBe('soon')
  })

  it('入金済みなら期限を過ぎていても警告しない', () => {
    const c = contest({
      date: '2026-09-01',
      entry: { fee: 3000, status: 'paid', dueDate: '2026-08-01' },
    })
    expect(taskOf(c, 'payment').urgency).toBe('none')
  })
})

describe('音源の判定', () => {
  it('提出済みと当日持参は完了扱い', () => {
    expect(isMusicSettled(contest({ music: { status: 'submitted' } }))).toBe(true)
    expect(isMusicSettled(contest({ music: { status: 'onsite' } }))).toBe(true)
  })

  it('用意しただけ・未準備は未完了', () => {
    expect(isMusicSettled(contest({ music: { status: 'ready' } }))).toBe(false)
    expect(isMusicSettled(contest({ music: { status: 'none' } }))).toBe(false)
  })

  it('当日持参ならラベルがそう表示される', () => {
    expect(taskOf(contest({ music: { status: 'onsite' } }), 'music').label).toBe('音源は当日持参')
  })

  it('提出期限がなければ開催日を期限とみなす', () => {
    const c = contest({ date: '2026-08-21', music: { status: 'ready' } })
    expect(taskOf(c, 'music').urgency).toBe('soon')
  })
})

describe('準備状況のまとめ', () => {
  it('4 項目すべて揃えば ratio が 1 になる', () => {
    const c = contest({
      date: '2026-09-01',
      entry: { fee: 3000, status: 'paid' },
      music: { status: 'submitted' },
      venue: { name: '渋谷 WOMB', address: '東京都渋谷区円山町2-16' },
      judges: [{ id: 'j1', name: 'KENTO' }],
    })
    const prep = preparationOf(c, NOW)
    expect(prep.doneCount).toBe(4)
    expect(prep.ratio).toBe(1)
    expect(prep.alerts).toHaveLength(0)
  })

  it('会場は住所か座標があれば確認済みとみなす', () => {
    expect(taskOf(contest({ venue: { name: '会場' } }), 'venue').done).toBe(false)
    expect(taskOf(contest({ venue: { name: '会場', lat: 35.6, lng: 139.7 } }), 'venue').done).toBe(true)
  })

  it('終わったイベントは未完了でも警告しない', () => {
    const c = contest({ date: '2026-08-01', entry: { fee: 3000, status: 'unpaid', dueDate: '2026-07-20' } })
    expect(preparationOf(c, NOW).alerts).toHaveLength(0)
  })
})

describe('開催日との関係', () => {
  it('今日・未来・過去を判定する', () => {
    expect(contestPhase(contest({ date: '2026-08-20' }), NOW)).toBe('today')
    expect(contestPhase(contest({ date: '2026-08-21' }), NOW)).toBe('upcoming')
    expect(contestPhase(contest({ date: '2026-08-19' }), NOW)).toBe('past')
  })
})

describe('並び替えと検索', () => {
  const list = [
    contest({ id: 'a', name: '過去A', date: '2026-08-01' }),
    contest({ id: 'b', name: '未来B', date: '2026-09-10' }),
    contest({ id: 'c', name: '未来C', date: '2026-08-25' }),
    contest({ id: 'd', name: '過去D', date: '2026-08-15' }),
  ]

  it('これからのイベントが近い順に先頭へ来る', () => {
    expect(sortContests(list, NOW).map((c) => c.id)).toEqual(['c', 'b', 'd', 'a'])
  })

  it('元の配列を壊さない', () => {
    const before = list.map((c) => c.id)
    sortContests(list, NOW)
    expect(list.map((c) => c.id)).toEqual(before)
  })

  it('会場名や部門でも検索できる', () => {
    const items = [
      contest({ id: 'x', name: 'BATTLE', venue: { name: '横浜 BAY HALL' } }),
      contest({ id: 'y', name: 'SHOWCASE', category: 'チーム' }),
    ]
    expect(searchContests(items, 'bay').map((c) => c.id)).toEqual(['x'])
    expect(searchContests(items, 'チーム').map((c) => c.id)).toEqual(['y'])
    expect(searchContests(items, '  ')).toHaveLength(2)
  })
})

describe('ファイナル', () => {
  const withFinal = (overrides: Partial<Contest>, finalDate: string, status: 'undecided' | 'advanced' | 'eliminated' = 'undecided') =>
    contest({
      ...overrides,
      final: { date: finalDate, status, reminders: [] },
    })

  it('予選が終わっていてもファイナルが残っていれば「これから」扱い', () => {
    const c = withFinal({ date: '2026-08-10' }, '2026-09-20')
    expect(contestPhase(c, NOW)).toBe('upcoming')
    expect(activeDate(c, NOW)).toBe('2026-09-20')
  })

  it('敗退したら終わったイベントに戻る', () => {
    const c = withFinal({ date: '2026-08-10' }, '2026-09-20', 'eliminated')
    expect(contestPhase(c, NOW)).toBe('past')
    expect(activeDate(c, NOW)).toBe('2026-08-10')
  })

  it('ファイナルも過ぎていれば終了', () => {
    expect(contestPhase(withFinal({ date: '2026-07-01' }, '2026-08-05'), NOW)).toBe('past')
  })

  it('予選がまだなら予選の日で見る', () => {
    const c = withFinal({ date: '2026-08-25' }, '2026-09-20')
    expect(activeDate(c, NOW)).toBe('2026-08-25')
    expect(hasUpcomingFinal(c, NOW)).toBe(true)
  })

  it('ファイナル待ちの大会は並び順もファイナルの日で決まる', () => {
    const items = [
      contest({ id: 'soon', date: '2026-08-22' }),
      withFinal({ id: 'final-later', date: '2026-08-01' }, '2026-09-20'),
    ]
    expect(sortContests(items, NOW).map((c) => c.id)).toEqual(['soon', 'final-later'])
  })

  it('会場を入れていなければ予選と同じ会場を使う', () => {
    const base = { name: '渋谷 WOMB', address: '東京都渋谷区円山町2-16' }
    expect(finalVenue(withFinal({ venue: base }, '2026-09-20')).name).toBe('渋谷 WOMB')
    const moved = contest({
      venue: base,
      final: { date: '2026-09-20', status: 'advanced', reminders: [], venue: { name: '東京ドームシティホール' } },
    })
    expect(finalVenue(moved).name).toBe('東京ドームシティホール')
  })

  it('ファイナルが残っていれば準備タスクを期限切れにしない', () => {
    const c = withFinal({ date: '2026-08-10', judges: [] }, '2026-09-20')
    const judge = preparationOf(c, NOW).tasks.find((task) => task.kind === 'judge')
    expect(judge?.urgency).toBe('none')
  })
})

describe('振り返り', () => {
  it('何か書いてあれば記入済み', () => {
    expect(hasReview(contest())).toBe(false)
    expect(hasReview(contest({ review: { updatedAt: '2026-08-01' } }))).toBe(false)
    expect(hasReview(contest({ review: { good: '音を取れた' } }))).toBe(true)
  })

  it('終わったのに未記入のものだけ拾う', () => {
    const items = [
      contest({ id: 'past-empty', date: '2026-08-10' }),
      contest({ id: 'past-written', date: '2026-08-12', review: { result: 'ベスト8' } }),
      contest({ id: 'future', date: '2026-09-01' }),
    ]
    expect(pendingReviews(items, NOW).map((c) => c.id)).toEqual(['past-empty'])
  })
})
