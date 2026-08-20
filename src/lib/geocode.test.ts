import { describe, expect, it, vi } from 'vitest'
import { GeocodeError, geocodeAddress, parseGeocodeResponse, parseLatLngInput } from './geocode'

const gsiResponse = [
  {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [139.7017, 35.6581] },
    properties: { title: '東京都渋谷区神南一丁目' },
  },
]

function fakeFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return vi.fn(async (_input: RequestInfo | URL) =>
    ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    }) as unknown as Response,
  )
}

describe('parseGeocodeResponse', () => {
  it('GeoJSON の [経度, 緯度] を lat/lng に直す', () => {
    expect(parseGeocodeResponse(gsiResponse)).toEqual([
      { title: '東京都渋谷区神南一丁目', location: { lat: 35.6581, lng: 139.7017 } },
    ])
  })

  it('FeatureCollection で包まれていても読める', () => {
    expect(parseGeocodeResponse({ type: 'FeatureCollection', features: gsiResponse })).toHaveLength(1)
  })

  it('座標が壊れている候補は捨てる', () => {
    const broken = [{ geometry: { coordinates: ['x', 'y'] }, properties: { title: 'だめ' } }, ...gsiResponse]
    expect(parseGeocodeResponse(broken)).toHaveLength(1)
  })

  it('想定外のレスポンスなら空配列', () => {
    expect(parseGeocodeResponse(null)).toEqual([])
    expect(parseGeocodeResponse({ error: 'x' })).toEqual([])
  })
})

describe('parseLatLngInput', () => {
  it('カンマ区切りの緯度経度を読む', () => {
    expect(parseLatLngInput('35.6581, 139.7017')).toEqual({ lat: 35.6581, lng: 139.7017 })
    expect(parseLatLngInput('35.6581 139.7017')).toEqual({ lat: 35.6581, lng: 139.7017 })
  })

  it('住所や範囲外の数値は null', () => {
    expect(parseLatLngInput('東京都渋谷区')).toBeNull()
    expect(parseLatLngInput('100, 139')).toBeNull()
  })
})

describe('geocodeAddress', () => {
  it('住所を投げて候補を受け取る', async () => {
    const fetchImpl = fakeFetch(gsiResponse)
    const candidates = await geocodeAddress('東京都渋谷区神南1丁目', fetchImpl)
    expect(candidates[0].location.lat).toBe(35.6581)
    expect(String(fetchImpl.mock.calls[0][0])).toContain(encodeURIComponent('東京都渋谷区神南1丁目'))
  })

  it('緯度経度が直接入力されたら通信しない', async () => {
    const fetchImpl = fakeFetch(gsiResponse)
    expect(await geocodeAddress('35.0, 139.0', fetchImpl)).toEqual([
      { title: '35.0, 139.0', location: { lat: 35, lng: 139 } },
    ])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('空文字なら通信せず空配列', async () => {
    const fetchImpl = fakeFetch(gsiResponse)
    expect(await geocodeAddress('   ', fetchImpl)).toEqual([])
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('HTTP エラーは GeocodeError にする', async () => {
    const fetchImpl = fakeFetch(null, { ok: false, status: 503 })
    await expect(geocodeAddress('東京都', fetchImpl)).rejects.toBeInstanceOf(GeocodeError)
  })

  it('通信自体に失敗した場合も GeocodeError にする', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    await expect(geocodeAddress('東京都', fetchImpl)).rejects.toBeInstanceOf(GeocodeError)
  })
})
