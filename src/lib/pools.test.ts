import { describe, expect, it } from 'vitest'
import { createPoolId, formatTags, mergePools, parsePoolsJson, parseTags, toPoolsJson } from './pools'
import type { Pool } from '../types'

const basePool: Pool = {
  id: 'a',
  name: 'Aプール',
  address: '東京都A区',
  location: { lat: 35, lng: 139 },
  tags: ['25m'],
}

describe('parseTags', () => {
  it('カンマ・読点・空白のどれでも区切れる', () => {
    expect(parseTags('25m, 屋内　温水、キッズ')).toEqual(['25m', '屋内', '温水', 'キッズ'])
  })

  it('重複と空要素は落とす', () => {
    expect(parseTags('25m,,25m, ')).toEqual(['25m'])
  })

  it('formatTags と往復できる', () => {
    expect(parseTags(formatTags(['25m', '屋内']))).toEqual(['25m', '屋内'])
  })
})

describe('parsePoolsJson', () => {
  it('配列でも { pools: [...] } でも読める', () => {
    const rows = [{ name: 'Aプール', address: '東京都A区', lat: 35, lng: 139, tags: '25m 屋内' }]
    expect(parsePoolsJson(JSON.stringify(rows)).pools[0]).toMatchObject({
      name: 'Aプール',
      location: { lat: 35, lng: 139 },
      tags: ['25m', '屋内'],
    })
    expect(parsePoolsJson(JSON.stringify({ pools: rows })).pools).toHaveLength(1)
  })

  it('書き出した JSON をそのまま読み戻せる', () => {
    expect(parsePoolsJson(toPoolsJson([basePool])).pools).toEqual([basePool])
  })

  it('名前や座標が欠けた行は理由つきで飛ばす', () => {
    const rows = [
      { address: '名前なし', lat: 35, lng: 139 },
      { name: '座標なし' },
      { name: 'まとも', lat: 35, lng: 139 },
    ]
    const result = parsePoolsJson(JSON.stringify(rows))
    expect(result.pools.map((pool) => pool.name)).toEqual(['まとも'])
    expect(result.skipped).toHaveLength(2)
  })

  it('id がなければ採番する', () => {
    const pools = parsePoolsJson(JSON.stringify([{ name: 'X', lat: 35, lng: 139 }])).pools
    expect(pools[0].id).not.toBe('')
  })

  it('JSON として壊れていれば例外', () => {
    expect(() => parsePoolsJson('{')).toThrow()
    expect(() => parsePoolsJson('"文字列"')).toThrow()
  })
})

describe('mergePools', () => {
  it('同じ id は取り込んだ側で上書きし、新規は追加する', () => {
    const updated = { ...basePool, name: 'Aプール（改称）' }
    const added = { ...basePool, id: 'b', name: 'Bプール' }
    const merged = mergePools([basePool], [updated, added])
    expect(merged).toHaveLength(2)
    expect(merged[0].name).toBe('Aプール（改称）')
  })
})

describe('createPoolId', () => {
  it('呼ぶたびに異なる id を返す', () => {
    expect(new Set(Array.from({ length: 50 }, createPoolId)).size).toBe(50)
  })
})
