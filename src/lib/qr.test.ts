import { describe, expect, it } from 'vitest'
import { create as createReference } from 'qrcode'
import { alignmentCoords, encodeQr, pickVersion } from './qr'
import { buildShareUrl, encodeShare, toSharePayload } from './share'
import { normalizeContest } from './factory'
import type { Contest } from '../types'

/** 参照実装（qrcode）を、こちらと同じ条件（バイトモード・レベル M）で動かす。 */
function reference(text: string): { version: number; rows: string[] } {
  const result = createReference([{ data: text, mode: 'byte' }], { errorCorrectionLevel: 'M' })
  const size = result.modules.size
  const rows: string[] = []
  for (let y = 0; y < size; y += 1) {
    let row = ''
    for (let x = 0; x < size; x += 1) row += result.modules.data[y * size + x] ? '#' : '.'
    rows.push(row)
  }
  return { version: result.version, rows }
}

function mine(text: string): { size: number; rows: string[] } {
  const code = encodeQr(text)
  if (!code) throw new Error('組み立てられなかった')
  return { size: code.size, rows: code.modules.map((row) => row.map((dark) => (dark ? '#' : '.')).join('')) }
}

/** 何度動かしても同じになるように、種を固定した乱数。 */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

describe('参照実装との突き合わせ', () => {
  it('決まった文字列', () => {
    for (const text of [
      'A',
      'HELLO WORLD',
      '12345678901234567890',
      'https://stagenote.example.workers.dev/',
      'ダンスコンテスト',
      '第 8 回 全日本ストリートダンス選手権 関東予選 🏆',
      'a'.repeat(100),
      'あ'.repeat(200),
    ]) {
      const expected = reference(text)
      const actual = mine(text)
      expect(actual.size, text).toBe(expected.rows.length)
      expect(actual.rows, text).toEqual(expected.rows)
    }
  })

  it('版の変わり目をまたいでも一致する', () => {
    // 版 1→2、9→10（文字数のビット数が変わる）、6→7（版情報が入る）あたりを通る長さ
    for (const length of [1, 13, 14, 25, 26, 100, 101, 154, 155, 271, 272, 321, 322]) {
      const text = 'x'.repeat(length)
      expect(mine(text).rows, `length=${length}`).toEqual(reference(text).rows)
    }
  })

  it('でたらめな文字列 60 本', () => {
    const random = seeded(20260819)
    const alphabet = 'abcXYZ0189 -_/:.?&=あいウエ漢字🏆'
    for (let round = 0; round < 60; round += 1) {
      const length = 1 + Math.floor(random() * 220)
      let text = ''
      for (let index = 0; index < length; index += 1) {
        text += alphabet[Math.floor(random() * alphabet.length)]
      }
      expect(mine(text).rows, text).toEqual(reference(text).rows)
    }
  })

  it('実際に配る共有 URL', async () => {
    const base = {
      id: 'c1',
      date: '2026-08-31',
      venue: { name: '横浜 BAY HALL', address: '神奈川県横浜市中区新山下2-1-1' },
      entry: { fee: 4000, status: 'unpaid', dueDate: '2026-08-22' },
      music: { status: 'none', dueDate: '2026-08-25' },
      reminders: [],
    }
    const contests: Contest[] = [
      normalizeContest({ ...base, name: '渋谷バトル', judges: [] } as unknown as Contest),
      normalizeContest({
        ...base,
        name: 'TOKYO DANCE BATTLE vol.8',
        category: 'HIPHOP 2on2',
        startTime: '12:00',
        judges: [
          { id: 'a', name: 'KENTO', genre: 'HIPHOP' },
          { id: 'b', name: 'MIKA', genre: 'FREESTYLE' },
        ],
      } as unknown as Contest),
      normalizeContest({
        ...base,
        name: '第 8 回 全日本ストリートダンス選手権 関東予選',
        category: 'HIPHOP / SOLO / 一般の部',
        final: { date: '2026-12-20', startTime: '12:00', status: 'undecided', reminders: [], venue: { name: '東京ドームシティホール', address: '東京都文京区後楽1-3-61' } },
        judges: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ id: String(n), name: `JUDGE${n}`, genre: 'HIPHOP / FREESTYLE' })),
      } as unknown as Contest),
    ]

    for (const contest of contests) {
      const url = buildShareUrl('https://stagenote.aimauto736.workers.dev', await encodeShare(toSharePayload(contest)))
      expect(mine(url).rows, contest.name).toEqual(reference(url).rows)
    }
  })
})

describe('版の選び方', () => {
  it('入る中でいちばん小さい版を選ぶ', () => {
    expect(pickVersion(1)).toBe(1)
    expect(pickVersion(14)).toBe(1) // 版 1（M）はバイト 14 まで
    expect(pickVersion(15)).toBe(2)
    expect(pickVersion(2331)).toBe(40)
  })

  it('版 40 にも入らなければ null', () => {
    expect(pickVersion(2332)).toBeNull()
    expect(encodeQr('x'.repeat(3000))).toBeNull()
  })

  it('参照実装と同じ版になる', () => {
    for (const length of [1, 14, 15, 100, 271, 272, 600]) {
      const text = 'x'.repeat(length)
      expect(pickVersion(length), `length=${length}`).toBe(reference(text).version)
    }
  })
})

describe('位置合わせパターンの座標', () => {
  it('規格の値と合う', () => {
    expect(alignmentCoords(1)).toEqual([])
    expect(alignmentCoords(2)).toEqual([6, 18])
    expect(alignmentCoords(7)).toEqual([6, 22, 38])
    expect(alignmentCoords(32)).toEqual([6, 34, 60, 86, 112, 138])
    expect(alignmentCoords(40)).toEqual([6, 30, 58, 86, 114, 142, 170])
  })
})
