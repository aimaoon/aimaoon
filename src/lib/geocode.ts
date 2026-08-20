import { isValidLatLng } from './geo'
import type { LatLng } from '../types'

export interface GeocodeCandidate {
  /** 国土地理院が返す正式表記（例: 東京都渋谷区神南一丁目） */
  title: string
  location: LatLng
}

export class GeocodeError extends Error {}

/** 国土地理院の住所検索 API。無料・API キー不要で使える。 */
const GSI_ENDPOINT = 'https://msearch.gsi.go.jp/address-search/AddressSearch'

/**
 * API のレスポンスを候補配列に直す。
 * GeoJSON の Feature 配列がそのまま返る仕様だが、
 * FeatureCollection で包まれても読めるようにしてある。
 */
export function parseGeocodeResponse(json: unknown): GeocodeCandidate[] {
  const features = Array.isArray(json)
    ? json
    : typeof json === 'object' && json !== null && Array.isArray((json as any).features)
      ? (json as any).features
      : []

  const candidates: GeocodeCandidate[] = []

  for (const feature of features) {
    const coordinates = feature?.geometry?.coordinates
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue

    const [lng, lat] = coordinates
    const location = { lat: Number(lat), lng: Number(lng) }
    if (!isValidLatLng(location)) continue

    const title = String(feature?.properties?.title ?? '').trim()
    candidates.push({ title: title === '' ? '(名称なし)' : title, location })
  }

  return candidates
}

/**
 * 「35.6581, 139.7017」のような直接入力を座標として読む。
 * 住所検索が使えない環境でも登録できるようにするための逃げ道。
 */
export function parseLatLngInput(input: string): LatLng | null {
  const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,、\s]\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null

  const location = { lat: Number(match[1]), lng: Number(match[2]) }
  return isValidLatLng(location) ? location : null
}

/** 住所文字列から緯度経度の候補を取得する。座標を直接入れた場合はそれを返す。 */
export async function geocodeAddress(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GeocodeCandidate[]> {
  const trimmed = query.trim()
  if (trimmed === '') return []

  const direct = parseLatLngInput(trimmed)
  if (direct) return [{ title: trimmed, location: direct }]

  let response: Response
  try {
    response = await fetchImpl(`${GSI_ENDPOINT}?q=${encodeURIComponent(trimmed)}`)
  } catch (cause) {
    throw new GeocodeError(
      '住所検索サーバーに接続できませんでした。ネットワークを確認するか、緯度経度を直接入力してください。',
      { cause },
    )
  }

  if (!response.ok) {
    throw new GeocodeError(`住所検索に失敗しました（HTTP ${response.status}）`)
  }

  return parseGeocodeResponse(await response.json())
}
