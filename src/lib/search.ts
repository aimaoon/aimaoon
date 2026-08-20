import { localEstimateProvider, type TravelTimeProvider } from './travelTime'
import type { LatLng, Pool, SearchResult, TravelMode } from '../types'

export interface SearchOptions {
  pools: Pool[]
  origin: LatLng
  mode: TravelMode
  /** 「1時間圏内」なら 60 */
  limitMinutes: number
  provider?: TravelTimeProvider
}

/**
 * 出発地から各プールの所要時間を求め、近い順に並べて返す。
 * 圏外の施設も `withinLimit: false` として返すので、
 * 「少し足を伸ばせば」の候補も画面側で出せる。
 */
export async function searchPools({
  pools,
  origin,
  mode,
  limitMinutes,
  provider = localEstimateProvider,
}: SearchOptions): Promise<SearchResult[]> {
  if (pools.length === 0) return []

  const estimates = await provider.estimateMany(
    origin,
    pools.map((pool) => pool.location),
    mode,
  )

  return pools
    .map((pool, index) => {
      const estimate = estimates[index]
      return { pool, estimate, withinLimit: estimate.minutes <= limitMinutes }
    })
    .sort((a, b) => a.estimate.minutes - b.estimate.minutes)
}

export interface PoolFilter {
  /** 施設名・住所・メモに対する部分一致 */
  keyword?: string
  /** 指定したタグをすべて持つ施設だけに絞る */
  tags?: string[]
}

export function filterPools(pools: Pool[], filter: PoolFilter): Pool[] {
  const keyword = filter.keyword?.trim().toLowerCase() ?? ''
  const tags = filter.tags ?? []

  return pools.filter((pool) => {
    if (tags.length > 0 && !tags.every((tag) => pool.tags.includes(tag))) return false
    if (keyword === '') return true

    const haystack = [pool.name, pool.address, pool.note ?? '', ...pool.tags]
      .join(' ')
      .toLowerCase()
    return haystack.includes(keyword)
  })
}

/** 登録済みプールに付いているタグを、使われている数の多い順に集める */
export function collectTags(pools: Pool[]): string[] {
  const counts = new Map<string, number>()
  for (const pool of pools) {
    for (const tag of pool.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .map(([tag]) => tag)
}
