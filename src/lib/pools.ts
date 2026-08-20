import { isValidLatLng } from './geo'
import type { Pool } from '../types'

export function createPoolId(): string {
  return `pool-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 「25m, 屋内 温水」のような入力をタグ配列にする */
export function parseTags(input: string): string[] {
  return [...new Set(input.split(/[,、\s]+/).map((tag) => tag.trim()).filter(Boolean))]
}

export function formatTags(tags: string[]): string {
  return tags.join(', ')
}

export interface PoolImportResult {
  pools: Pool[]
  /** 読み飛ばした行の理由（件数と内容を画面に出すため） */
  skipped: string[]
}

/**
 * JSON からプールを取り込む。手で書いた JSON や他システムの書き出しも通せるよう、
 * 型が違うものは落として理由を返す。
 */
export function parsePoolsJson(text: string): PoolImportResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('JSON として読めませんでした。書式を確認してください。')
  }

  const rows = Array.isArray(json) ? json : (json as any)?.pools
  if (!Array.isArray(rows)) {
    throw new Error('配列、または { "pools": [...] } の形式にしてください。')
  }

  const pools: Pool[] = []
  const skipped: string[] = []

  rows.forEach((row: any, index: number) => {
    const label = `${index + 1} 件目`
    const name = typeof row?.name === 'string' ? row.name.trim() : ''
    if (name === '') {
      skipped.push(`${label}: name がありません`)
      return
    }

    const location = {
      lat: Number(row?.location?.lat ?? row?.lat),
      lng: Number(row?.location?.lng ?? row?.lng),
    }
    if (!isValidLatLng(location)) {
      skipped.push(`${label}（${name}）: 緯度経度が不正です`)
      return
    }

    pools.push({
      id: typeof row?.id === 'string' && row.id !== '' ? row.id : createPoolId(),
      name,
      address: typeof row?.address === 'string' ? row.address : '',
      location,
      tags: Array.isArray(row?.tags)
        ? row.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
        : typeof row?.tags === 'string'
          ? parseTags(row.tags)
          : [],
      note: typeof row?.note === 'string' ? row.note : undefined,
      url: typeof row?.url === 'string' ? row.url : undefined,
      phone: typeof row?.phone === 'string' ? row.phone : undefined,
    })
  })

  return { pools, skipped }
}

/** 同じ id は後勝ちで上書きし、それ以外は追記する */
export function mergePools(current: Pool[], incoming: Pool[]): Pool[] {
  const byId = new Map(current.map((pool) => [pool.id, pool]))
  for (const pool of incoming) {
    byId.set(pool.id, pool)
  }
  return [...byId.values()]
}

export function toPoolsJson(pools: Pool[]): string {
  return JSON.stringify(pools, null, 2)
}
