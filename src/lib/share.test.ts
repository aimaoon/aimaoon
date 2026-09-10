import { describe, expect, it } from 'vitest'
import type { Contest } from '../types'
import { normalizeContest } from './factory'
import {
  buildShareUrl,
  contestFromShare,
  decodeShare,
  encodeShare,
  isSharePayload,
  readShareToken,
  toSharePayload,
} from './share'

const NOW = new Date('2026-08-19T09:00:00+09:00')

function contest(overrides: Partial<Contest> = {}): Contest {
  return normalizeContest({
    id: 'c1',
    name: 'TOKYO DANCE BATTLE vol.8',
    category: 'HIPHOP 2on2',
    date: '2026-08-31',
    startTime: '12:00',
    endTime: '20:00',
    venue: { name: '横浜 BAY HALL', address: '神奈川県横浜市中区新山下2-1-1', note: '楽屋は 2F' },
    entry: { fee: 4000, status: 'paid', dueDate: '2026-08-22', paidOn: '2026-08-10', method: 'PayPay 送金' },
    music: { status: 'submitted', dueDate: '2026-08-25', title: 'Pete Rock - The Basement', note: '1分30秒' },
    judges: [
      { id: 'j1', name: 'KENTO', genre: 'HIPHOP', note: 'ミュージカリティ重視' },
      { id: 'j2', name: 'MIKA', genre: 'FREESTYLE' },
    ],
    reminders: [],
    memo: '当日は 11:00 に現地',
    review: { rating: 4, result: 'ベスト8', good: '通用した', improve: '崩れた' },
    ...overrides,
  } as Contest)
}

describe('toSharePayload', () => {
  it('大会そのものの情報を入れる', () => {
    const payload = toSharePayload(contest())
    expect(payload).toMatchObject({
      v: 1,
      n: 'TOKYO DANCE BATTLE vol.8',
      c: 'HIPHOP 2on2',
      d: '2026-08-31',
      s: '12:00',
      e: '20:00',
      p: ['横浜 BAY HALL', '神奈川県横浜市中区新山下2-1-1'],
      y: 4000,
      yd: '2026-08-22',
      md: '2026-08-25',
      j: [
        ['KENTO', 'HIPHOP'],
        ['MIKA', 'FREESTYLE'],
      ],
    })
  })

  it('自分の状況は入れない', () => {
    const text = JSON.stringify(toSharePayload(contest()))
    // 入金・音源の状況、支払い方法、曲名、メモ、振り返り、ジャッジへのメモ
    expect(text).not.toContain('paid')
    expect(text).not.toContain('PayPay')
    expect(text).not.toContain('Pete Rock')
    expect(text).not.toContain('1分30秒')
    expect(text).not.toContain('11:00 に現地')
    expect(text).not.toContain('ベスト8')
    expect(text).not.toContain('ミュージカリティ')
    expect(text).not.toContain('楽屋')
  })

  it('ファイナルは日程と場所だけ渡し、勝ち負けは渡さない', () => {
    const payload = toSharePayload(
      contest({
        final: {
          date: '2026-09-20',
          startTime: '13:00',
          status: 'advanced',
          reminders: [],
          venue: { name: '東京ドームシティホール' },
          note: '進出条件のメモ',
        },
      }),
    )
    expect(payload.f).toEqual(['2026-09-20', '13:00', '東京ドームシティホール'])
    expect(JSON.stringify(payload)).not.toContain('advanced')
    expect(JSON.stringify(payload)).not.toContain('進出条件')
  })

  it('日程も会場も無いファイナルは省く', () => {
    const payload = toSharePayload(
      contest({ final: { status: 'advanced', reminders: [], note: 'メモ' } }),
    )
    expect(payload.f).toBeUndefined()
  })

  it('空の項目は持たせない', () => {
    const bare = toSharePayload(
      contest({
        category: '',
        startTime: '',
        endTime: '',
        venue: { name: '' },
        entry: { fee: 0, status: 'free' },
        music: { status: 'none' },
        judges: [],
      }),
    )
    expect(Object.keys(bare).sort()).toEqual(['d', 'n', 'v'])
  })

  it('名前の無いジャッジは落とす', () => {
    const payload = toSharePayload(
      contest({ judges: [{ id: 'j1', name: '  ' }, { id: 'j2', name: 'RYU' }] }),
    )
    expect(payload.j).toEqual([['RYU']])
  })
})

describe('encodeShare / decodeShare', () => {
  it('往復して同じものが戻る', async () => {
    const payload = toSharePayload(contest())
    const token = await encodeShare(payload)
    expect(await decodeShare(token)).toEqual(payload)
  })

  it('日本語が壊れない', async () => {
    const payload = toSharePayload(contest({ name: '第 8 回 全日本ダンス選手権 🏆' }))
    const decoded = await decodeShare(await encodeShare(payload))
    expect(decoded?.n).toBe('第 8 回 全日本ダンス選手権 🏆')
  })

  it('QR に載る長さに収まる', async () => {
    const token = await encodeShare(toSharePayload(contest()))
    // URL 全体でも 400 文字を大きく超えないこと（版が上がると読み取りにくくなる）
    expect(buildShareUrl('https://stagenote.example.workers.dev', token).length).toBeLessThan(400)
  })

  it('壊れた文字列は受け取らない', async () => {
    expect(await decodeShare('')).toBeNull()
    expect(await decodeShare('1')).toBeNull()
    expect(await decodeShare('9zzzz')).toBeNull()
    expect(await decodeShare('1' + btoa('{"v":1}'))).toBeNull()
    expect(await decodeShare('1' + btoa('not json'))).toBeNull()
  })

  it('形式の版が違うものは受け取らない', async () => {
    const token = '1' + btoa(JSON.stringify({ v: 99, n: 'X', d: '2026-01-01' }))
    expect(await decodeShare(token)).toBeNull()
  })

  it('日付の形が違うものは受け取らない', async () => {
    const token = '1' + btoa(JSON.stringify({ v: 1, n: 'X', d: '2026/01/01' }))
    expect(await decodeShare(token)).toBeNull()
  })
})

describe('isSharePayload', () => {
  it('最低限そろっていれば通す', () => {
    expect(isSharePayload({ v: 1, n: '大会', d: '2026-01-01' })).toBe(true)
  })

  it('名前が空なら通さない', () => {
    expect(isSharePayload({ v: 1, n: '   ', d: '2026-01-01' })).toBe(false)
  })

  it('object でなければ通さない', () => {
    expect(isSharePayload(null)).toBe(false)
    expect(isSharePayload('x')).toBe(false)
    expect(isSharePayload([])).toBe(false)
  })
})

describe('buildShareUrl / readShareToken', () => {
  it('# のうしろに置く（サーバーに送られない場所）', () => {
    expect(buildShareUrl('https://example.com', 'ABC')).toBe('https://example.com/#c=ABC')
  })

  it('末尾のスラッシュや前の共有分は引きずらない', () => {
    expect(buildShareUrl('https://example.com/', 'ABC')).toBe('https://example.com/#c=ABC')
    expect(buildShareUrl('https://example.com/#c=OLD', 'ABC')).toBe('https://example.com/#c=ABC')
    expect(buildShareUrl('https://example.com/?a=1', 'ABC')).toBe('https://example.com/#c=ABC')
  })

  it('読み出せる', () => {
    expect(readShareToken('#c=ABC')).toBe('ABC')
    expect(readShareToken('c=ABC')).toBe('ABC')
    expect(readShareToken('#x=1&c=ABC')).toBe('ABC')
  })

  it('無ければ null', () => {
    expect(readShareToken('')).toBeNull()
    expect(readShareToken('#')).toBeNull()
    expect(readShareToken('#c=')).toBeNull()
    expect(readShareToken('#other=ABC')).toBeNull()
  })

  it('組み立てた URL から読み戻せる', async () => {
    const token = await encodeShare(toSharePayload(contest()))
    const url = new URL(buildShareUrl('https://example.com', token))
    expect(readShareToken(url.hash)).toBe(token)
  })
})

describe('contestFromShare', () => {
  it('中身を引き継ぎ、自分の状況は空から始める', () => {
    const created = contestFromShare(toSharePayload(contest()), NOW)
    expect(created.name).toBe('TOKYO DANCE BATTLE vol.8')
    expect(created.date).toBe('2026-08-31')
    expect(created.venue.name).toBe('横浜 BAY HALL')
    expect(created.entry.fee).toBe(4000)
    expect(created.entry.dueDate).toBe('2026-08-22')
    expect(created.music.dueDate).toBe('2026-08-25')
    expect(created.judges.map((judge) => judge.name)).toEqual(['KENTO', 'MIKA'])

    // ここからは自分のぶん
    expect(created.entry.status).toBe('unpaid')
    expect(created.entry.paidOn).toBeUndefined()
    expect(created.music.status).toBe('none')
    expect(created.review).toBeUndefined()
    expect(created.memo).toBe('')
    expect(created.judges[0].note).toBeUndefined()
    expect(created.reminders.length).toBeGreaterThan(0)
  })

  it('元とは別の id を持つ（取り込んでも上書きにならない）', () => {
    const payload = toSharePayload(contest())
    const a = contestFromShare(payload, NOW)
    const b = contestFromShare(payload, NOW)
    expect(a.id).not.toBe('c1')
    expect(a.id).not.toBe(b.id)
    expect(a.judges[0].id).not.toBe(b.judges[0].id)
  })

  it('費用が無ければ「費用なし」で始める', () => {
    const created = contestFromShare({ v: 1, n: 'ゲストショー', d: '2026-09-01' }, NOW)
    expect(created.entry.status).toBe('free')
    expect(created.entry.fee).toBe(0)
  })

  it('ファイナルは結果待ちで受け取る', () => {
    const created = contestFromShare(
      { v: 1, n: 'X', d: '2026-09-01', f: ['2026-10-01', '13:00', '大阪 BIGCAT'] },
      NOW,
    )
    expect(created.final?.date).toBe('2026-10-01')
    expect(created.final?.startTime).toBe('13:00')
    expect(created.final?.venue?.name).toBe('大阪 BIGCAT')
    expect(created.final?.status).toBe('undecided')
  })

  it('取り込んだものは、そのまま保存できる形になっている', () => {
    const created = contestFromShare(toSharePayload(contest()), NOW)
    expect(normalizeContest(created)).toEqual(created)
  })
})
