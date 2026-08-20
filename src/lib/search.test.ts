import { describe, expect, it } from 'vitest'
import { collectTags, filterPools, searchPools } from './search'
import type { TravelTimeProvider } from './travelTime'
import type { Pool } from '../types'

const origin = { lat: 35.6812, lng: 139.7671 }

function pool(id: string, name: string, lat: number, lng: number, tags: string[] = []): Pool {
  return { id, name, address: `${name}の住所`, location: { lat, lng }, tags }
}

const pools = [
  pool('far', '遠いプール', 35.45, 139.6, ['50m']),
  pool('near', '近いプール', 35.69, 139.77, ['25m', '屋内']),
  pool('middle', '中くらいのプール', 35.6, 139.7, ['25m']),
]

describe('searchPools', () => {
  it('所要時間の短い順に並ぶ', async () => {
    const results = await searchPools({ pools, origin, mode: 'car', limitMinutes: 60 })
    expect(results.map((result) => result.pool.id)).toEqual(['near', 'middle', 'far'])
  })

  it('制限時間を超えた施設も withinLimit: false として残す', async () => {
    const results = await searchPools({ pools, origin, mode: 'walk', limitMinutes: 60 })
    expect(results[0].withinLimit).toBe(true)
    expect(results.at(-1)?.withinLimit).toBe(false)
  })

  it('ちょうど制限時間なら圏内に含める', async () => {
    const exactly60: TravelTimeProvider = {
      id: 'test',
      label: 'test',
      async estimateMany(_from, targets, mode) {
        return targets.map(() => ({
          mode,
          minutes: 60,
          straightKm: 1,
          routeKm: 1,
          source: 'estimate' as const,
        }))
      },
    }
    const results = await searchPools({
      pools,
      origin,
      mode: 'car',
      limitMinutes: 60,
      provider: exactly60,
    })
    expect(results.every((result) => result.withinLimit)).toBe(true)
  })

  it('登録が空なら空の結果', async () => {
    expect(await searchPools({ pools: [], origin, mode: 'car', limitMinutes: 60 })).toEqual([])
  })

  it('provider を差し替えれば所要時間の求め方を丸ごと変えられる', async () => {
    const fixed: TravelTimeProvider = {
      id: 'fixed',
      label: 'fixed',
      async estimateMany(_from, targets, mode) {
        return targets.map((_to, index) => ({
          mode,
          minutes: (targets.length - index) * 10,
          straightKm: 1,
          routeKm: 1,
          source: 'api' as const,
        }))
      },
    }
    const results = await searchPools({
      pools,
      origin,
      mode: 'transit',
      limitMinutes: 60,
      provider: fixed,
    })
    expect(results.map((result) => result.pool.id)).toEqual(['middle', 'near', 'far'])
    expect(results[0].estimate.source).toBe('api')
  })
})

describe('filterPools', () => {
  it('キーワードは名前・住所・タグを横断して探す', () => {
    expect(filterPools(pools, { keyword: '近い' }).map((p) => p.id)).toEqual(['near'])
    expect(filterPools(pools, { keyword: '50m' }).map((p) => p.id)).toEqual(['far'])
  })

  it('タグはすべて満たすものだけ残す', () => {
    expect(filterPools(pools, { tags: ['25m', '屋内'] }).map((p) => p.id)).toEqual(['near'])
    expect(filterPools(pools, { tags: ['25m'] }).map((p) => p.id)).toEqual(['near', 'middle'])
  })

  it('条件なしなら全件', () => {
    expect(filterPools(pools, {})).toHaveLength(3)
  })
})

describe('collectTags', () => {
  it('使われている数の多い順に返す', () => {
    expect(collectTags(pools)).toEqual(['25m', '50m', '屋内'])
  })
})
