import { describe, expect, it } from 'vitest'
import { createECDH, randomBytes } from 'node:crypto'
import { GRACE_MINUTES, MAX_REMINDERS, ValidationError, parseReminders, parseSubscription, parseSyncPayload, partitionDue, subscriptionId } from './api'
import { bytesToBase64Url } from './push'

const NOW = new Date('2026-08-20T12:00:00Z')

const ecdh = createECDH('prime256v1')
ecdh.generateKeys()
const validSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: {
    p256dh: bytesToBase64Url(new Uint8Array(ecdh.getPublicKey())),
    auth: bytesToBase64Url(new Uint8Array(randomBytes(16))),
  },
}

describe('購読情報の検証', () => {
  it('正しい購読はそのまま通る', () => {
    expect(parseSubscription(validSubscription)).toEqual(validSubscription)
  })

  it('https 以外の endpoint は弾く', () => {
    expect(() => parseSubscription({ ...validSubscription, endpoint: 'http://example.com/push' })).toThrow(ValidationError)
    expect(() => parseSubscription({ ...validSubscription, endpoint: 'not a url' })).toThrow(ValidationError)
  })

  it('鍵の長さが違えば弾く', () => {
    const shortKey = bytesToBase64Url(new Uint8Array(32))
    expect(() => parseSubscription({ ...validSubscription, keys: { ...validSubscription.keys, p256dh: shortKey } })).toThrow(
      ValidationError,
    )
    expect(() =>
      parseSubscription({ ...validSubscription, keys: { ...validSubscription.keys, auth: bytesToBase64Url(new Uint8Array(8)) } }),
    ).toThrow(ValidationError)
  })

  it('中身が無ければ弾く', () => {
    expect(() => parseSubscription(null)).toThrow(ValidationError)
    expect(() => parseSubscription({})).toThrow(ValidationError)
  })
})

describe('通知一覧の整形', () => {
  const reminder = (key: string, at: string, title = '大会の前日') => ({ key, at, title, body: '本文' })

  it('未来のものだけを時刻順に残す', () => {
    const list = parseReminders(
      [reminder('b', '2026-09-01T11:00:00Z'), reminder('a', '2026-08-25T11:00:00Z'), reminder('past', '2026-08-19T11:00:00Z')],
      NOW,
    )
    expect(list.map((item) => item.key)).toEqual(['a', 'b'])
  })

  it('壊れた 1 件は落として、残りは通す', () => {
    const list = parseReminders(
      [reminder('ok', '2026-09-01T11:00:00Z'), { key: 'no-title', at: '2026-09-02T11:00:00Z' }, { at: '2026-09-03T11:00:00Z', title: 'キーなし' }, null],
      NOW,
    )
    expect(list.map((item) => item.key)).toEqual(['ok'])
  })

  it('同じ key は後から来たもので上書きする', () => {
    const list = parseReminders([reminder('same', '2026-09-01T11:00:00Z', '古い'), reminder('same', '2026-09-01T11:00:00Z', '新しい')], NOW)
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('新しい')
  })

  it('長すぎる文言は切り詰める', () => {
    const list = parseReminders([{ key: 'k', at: '2026-09-01T11:00:00Z', title: 'あ'.repeat(500), body: 'い'.repeat(500) }], NOW)
    expect(list[0].title.length).toBeLessThanOrEqual(120)
    expect(list[0].body.length).toBeLessThanOrEqual(240)
  })

  it('件数に上限をかける', () => {
    const many = Array.from({ length: MAX_REMINDERS + 50 }, (_, index) =>
      reminder(`k${index}`, new Date(NOW.getTime() + (index + 1) * 3_600_000).toISOString()),
    )
    expect(parseReminders(many, NOW)).toHaveLength(MAX_REMINDERS)
  })

  it('配列でなければ弾く', () => {
    expect(() => parseReminders('nope', NOW)).toThrow(ValidationError)
  })
})

describe('同期リクエスト全体', () => {
  it('購読と通知をまとめて受け取る', () => {
    const payload = parseSyncPayload(
      { subscription: validSubscription, reminders: [{ key: 'a', at: '2026-09-01T11:00:00Z', title: '前日', body: '' }] },
      NOW,
    )
    expect(payload.subscription.endpoint).toBe(validSubscription.endpoint)
    expect(payload.reminders).toHaveLength(1)
  })

  it('reminders が無ければ空として扱う（購読だけの登録）', () => {
    expect(parseSyncPayload({ subscription: validSubscription }, NOW).reminders).toEqual([])
  })
})

describe('配信対象の選別', () => {
  const row = (id: string, minutesFromNow: number) => ({ id, at: new Date(NOW.getTime() + minutesFromNow * 60_000).toISOString() })

  it('時刻が来たものだけ送る', () => {
    const { send, stale } = partitionDue([row('past', -5), row('now', 0), row('future', 10)], NOW)
    expect(send.map((r) => r.id)).toEqual(['past', 'now'])
    expect(stale).toHaveLength(0)
  })

  it('猶予を過ぎた古いものは送らずに畳む', () => {
    const { send, stale } = partitionDue([row('too-old', -GRACE_MINUTES - 1), row('just-in', -GRACE_MINUTES + 1)], NOW)
    expect(send.map((r) => r.id)).toEqual(['just-in'])
    expect(stale.map((r) => r.id)).toEqual(['too-old'])
  })

  it('時刻が壊れている行は畳む', () => {
    const { send, stale } = partitionDue([{ id: 'broken', at: 'nonsense' }], NOW)
    expect(send).toHaveLength(0)
    expect(stale.map((r) => r.id)).toEqual(['broken'])
  })
})

describe('購読 ID', () => {
  it('同じ endpoint からは同じ ID になる', async () => {
    expect(await subscriptionId('https://example.com/push/1')).toBe(await subscriptionId('https://example.com/push/1'))
  })

  it('違う endpoint とはぶつからない', async () => {
    expect(await subscriptionId('https://example.com/push/1')).not.toBe(await subscriptionId('https://example.com/push/2'))
  })
})
