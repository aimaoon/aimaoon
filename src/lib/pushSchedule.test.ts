import { describe, expect, it } from 'vitest'
import type { Contest } from '../types'
import { createContest } from './factory'
import { defaultReminders } from './reminder'
import { MAX_PLANNED, buildPushPlan, planFingerprint, vapidKeyToBytes } from './pushSchedule'

const NOW = new Date(2026, 7, 20, 12, 0)

function contest(overrides: Partial<Contest> = {}): Contest {
  return { ...createContest(NOW), name: 'テスト大会', date: '2026-09-01', ...overrides }
}

describe('送る予定の組み立て', () => {
  it('これから鳴る通知だけを送る形にする', () => {
    const plan = buildPushPlan([contest({ reminders: defaultReminders() })], NOW)
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.every((item) => new Date(item.at).getTime() > NOW.getTime())).toBe(true)
    expect(plan[0]).toHaveProperty('title')
    expect(plan[0]).toHaveProperty('body')
  })

  it('大会の中身は含めない（鍵・日時・文言だけ）', () => {
    const plan = buildPushPlan(
      [
        contest({
          reminders: defaultReminders(),
          entry: { fee: 5000, status: 'unpaid' },
          judges: [{ id: 'j', name: 'KENTO', note: '見られるポイント' }],
          review: { good: '秘密のメモ' },
        }),
      ],
      NOW,
    )
    const keys = new Set(plan.flatMap((item) => Object.keys(item)))
    expect([...keys].sort()).toEqual(['at', 'body', 'key', 'title'])
    expect(JSON.stringify(plan)).not.toContain('秘密のメモ')
    expect(JSON.stringify(plan)).not.toContain('見られるポイント')
  })

  it('同じ内容なら毎回同じキーになる', () => {
    const items = [contest({ reminders: defaultReminders() })]
    expect(buildPushPlan(items, NOW).map((item) => item.key)).toEqual(buildPushPlan(items, NOW).map((item) => item.key))
  })

  it('件数に上限をかける', () => {
    const many = Array.from({ length: 200 }, (_, index) =>
      contest({ id: `c${index}`, date: '2026-09-10', reminders: defaultReminders() }),
    )
    expect(buildPushPlan(many, NOW).length).toBeLessThanOrEqual(MAX_PLANNED)
  })

  it('通知が無ければ空になる', () => {
    expect(buildPushPlan([contest({ reminders: [] })], NOW)).toEqual([])
    expect(buildPushPlan([], NOW)).toEqual([])
  })
})

describe('予定の指紋', () => {
  it('同じ予定なら同じ指紋', () => {
    const plan = buildPushPlan([contest({ reminders: defaultReminders() })], NOW)
    expect(planFingerprint(plan)).toBe(planFingerprint([...plan]))
  })

  it('文言が変われば指紋も変わる', () => {
    const plan = buildPushPlan([contest({ reminders: defaultReminders() })], NOW)
    const renamed = buildPushPlan([contest({ name: '別の大会', reminders: defaultReminders() })], NOW)
    expect(planFingerprint(plan)).not.toBe(planFingerprint(renamed))
  })

  it('空でも指紋を出せる', () => {
    expect(planFingerprint([])).toMatch(/^0-/)
  })
})

describe('VAPID 公開鍵の変換', () => {
  it('base64url を 65 バイトの鍵に戻す', () => {
    const key = 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
    const bytes = new Uint8Array(vapidKeyToBytes(key))
    expect(bytes.length).toBe(65)
    expect(bytes[0]).toBe(0x04)
  })
})
