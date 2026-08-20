import { describe, expect, it } from 'vitest'
import { haversineKm, isValidLatLng } from './geo'

const tokyoStation = { lat: 35.6812, lng: 139.7671 }
const yokohamaStation = { lat: 35.4657, lng: 139.6224 }

describe('haversineKm', () => {
  it('同じ地点なら 0', () => {
    expect(haversineKm(tokyoStation, tokyoStation)).toBe(0)
  })

  it('東京駅〜横浜駅はおよそ 27km', () => {
    expect(haversineKm(tokyoStation, yokohamaStation)).toBeCloseTo(27.3, 0)
  })

  it('向きを入れ替えても同じ距離', () => {
    expect(haversineKm(tokyoStation, yokohamaStation)).toBeCloseTo(
      haversineKm(yokohamaStation, tokyoStation),
      10,
    )
  })
})

describe('isValidLatLng', () => {
  it('範囲内の数値なら true', () => {
    expect(isValidLatLng({ lat: 35.6, lng: 139.7 })).toBe(true)
  })

  it('範囲外・欠損・NaN は false', () => {
    expect(isValidLatLng({ lat: 95, lng: 139.7 })).toBe(false)
    expect(isValidLatLng({ lat: 35.6, lng: 200 })).toBe(false)
    expect(isValidLatLng({ lat: Number.NaN, lng: 139.7 })).toBe(false)
    expect(isValidLatLng({ lat: '35.6', lng: 139.7 })).toBe(false)
    expect(isValidLatLng(null)).toBe(false)
  })
})
