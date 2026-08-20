import { describe, expect, it } from 'vitest'
import {
  MODE_PROFILES,
  averageSpeedKmh,
  estimateTravel,
  isBeyondPracticalRange,
} from './travelTime'
import { TRAVEL_MODES } from '../types'
import type { LatLng } from '../types'

const origin: LatLng = { lat: 35.6812, lng: 139.7671 }

/** 東に約 dKm ずらした地点（緯度 35 度付近の経度 1 度 ≒ 91km） */
function eastOf(km: number): LatLng {
  return { lat: origin.lat, lng: origin.lng + km / 91 }
}

describe('estimateTravel', () => {
  it('同じ地点でも乗り降りぶんの固定時間が入る', () => {
    expect(estimateTravel(origin, origin, 'car').minutes).toBe(MODE_PROFILES.car.overheadMinutes)
  })

  it('速度カーブが単調性の条件（min > (max - min) / 4）を満たしている', () => {
    for (const mode of TRAVEL_MODES) {
      const { minSpeedKmh, maxSpeedKmh } = MODE_PROFILES[mode]
      expect(minSpeedKmh).toBeGreaterThan((maxSpeedKmh - minSpeedKmh) / 4)
    }
  })

  it('距離が延びれば平均速度は上がるが上限は超えない', () => {
    const profile = MODE_PROFILES.car
    expect(averageSpeedKmh(0, profile)).toBe(profile.minSpeedKmh)
    expect(averageSpeedKmh(5, profile)).toBeLessThan(averageSpeedKmh(50, profile))
    expect(averageSpeedKmh(10000, profile)).toBeLessThan(profile.maxSpeedKmh)
  })

  it('距離が延びれば所要時間も必ず延びる（近距離と遠距離で逆転しない）', () => {
    for (const mode of TRAVEL_MODES) {
      let previous = -1
      for (let km = 0; km <= 80; km += 0.5) {
        const minutes = estimateTravel(origin, eastOf(km), mode).minutes
        expect(minutes).toBeGreaterThanOrEqual(previous)
        previous = minutes
      }
    }
  })

  it('同じ距離なら 車 < 自転車 < 徒歩 の順に速い', () => {
    const to = eastOf(6)
    const car = estimateTravel(origin, to, 'car').minutes
    const bike = estimateTravel(origin, to, 'bike').minutes
    const walk = estimateTravel(origin, to, 'walk').minutes
    expect(car).toBeLessThan(bike)
    expect(bike).toBeLessThan(walk)
  })

  it('迂回ぶんを見込むので推定移動距離は直線距離より長い', () => {
    const estimate = estimateTravel(origin, eastOf(10), 'car')
    expect(estimate.routeKm).toBeGreaterThan(estimate.straightKm)
    expect(estimate.straightKm).toBeCloseTo(10, 0)
  })

  it('車で 1 時間圏内はおよそ直線 30km（首都圏の感覚に合う）', () => {
    expect(estimateTravel(origin, eastOf(30), 'car').minutes).toBeLessThanOrEqual(60)
    expect(estimateTravel(origin, eastOf(45), 'car').minutes).toBeGreaterThan(60)
  })

  it('電車で 1 時間圏内はおよそ直線 20km', () => {
    expect(estimateTravel(origin, eastOf(20), 'transit').minutes).toBeLessThanOrEqual(60)
    expect(estimateTravel(origin, eastOf(30), 'transit').minutes).toBeGreaterThan(60)
  })

  it('徒歩 1 時間圏内はおよそ 4km まで', () => {
    expect(estimateTravel(origin, eastOf(4), 'walk').minutes).toBeLessThanOrEqual(60)
    expect(estimateTravel(origin, eastOf(6), 'walk').minutes).toBeGreaterThan(60)
  })

  it('source は概算であることを示す', () => {
    expect(estimateTravel(origin, eastOf(3), 'transit').source).toBe('estimate')
  })
})

describe('isBeyondPracticalRange', () => {
  it('徒歩で 20km 先は現実的でないと判定する', () => {
    expect(isBeyondPracticalRange(estimateTravel(origin, eastOf(20), 'walk'))).toBe(true)
  })

  it('車で 20km 先は範囲内', () => {
    expect(isBeyondPracticalRange(estimateTravel(origin, eastOf(20), 'car'))).toBe(false)
  })
})
