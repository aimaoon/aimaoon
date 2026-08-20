import { haversineKm } from './geo'
import type { LatLng, TravelEstimate, TravelMode } from '../types'

export interface ModeProfile {
  label: string
  /** 直線距離 → 実際の移動距離への倍率（道路や線路の迂回ぶん） */
  detourFactor: number
  /** 駐車・駅までの徒歩・待ち時間など、距離によらない固定時間（分） */
  overheadMinutes: number
  /** ごく近距離の平均速度（km/h）。信号や生活道路で遅くなる */
  minSpeedKmh: number
  /** 十分遠いときに近づく平均速度（km/h）。幹線・高速・優等列車 */
  maxSpeedKmh: number
  /** 速度が min と max の中間になる移動距離（km）。カーブの立ち上がりを決める */
  speedHalfKm: number
  /** これを超えるとこの手段では現実的でない、という目安（km） */
  practicalLimitKm: number
}

/**
 * 平均速度は距離が延びるほど速くなる（近所は下道、遠出は幹線や高速）。
 * 距離帯ごとに固定速度を割り当てる方式だと、
 * 長距離のときにも「最初の数 km ぶんの遅さ」を必ず足してしまい
 * 電車などが極端に遅く出るため、距離に対して連続に変化させている。
 */
export const MODE_PROFILES: Record<TravelMode, ModeProfile> = {
  car: {
    label: '車',
    detourFactor: 1.3,
    overheadMinutes: 5,
    minSpeedKmh: 20,
    maxSpeedKmh: 70,
    speedHalfKm: 40,
    practicalLimitKm: 250,
  },
  transit: {
    label: '電車・バス',
    detourFactor: 1.25,
    overheadMinutes: 14,
    minSpeedKmh: 13,
    maxSpeedKmh: 55,
    speedHalfKm: 25,
    practicalLimitKm: 200,
  },
  bike: {
    label: '自転車',
    detourFactor: 1.2,
    overheadMinutes: 3,
    minSpeedKmh: 14,
    maxSpeedKmh: 14,
    speedHalfKm: 10,
    practicalLimitKm: 25,
  },
  walk: {
    label: '徒歩',
    detourFactor: 1.15,
    overheadMinutes: 2,
    minSpeedKmh: 5,
    maxSpeedKmh: 5,
    speedHalfKm: 10,
    practicalLimitKm: 8,
  },
}

export const MODE_LABELS: Record<TravelMode, string> = {
  car: MODE_PROFILES.car.label,
  transit: MODE_PROFILES.transit.label,
  bike: MODE_PROFILES.bike.label,
  walk: MODE_PROFILES.walk.label,
}

/**
 * 移動距離に応じた平均速度。
 * min + (max - min) * d / (d + half) の形で、d が伸びるほど max に近づく。
 * 所要時間が距離に対して単調増加であるためには
 * minSpeed > (maxSpeed - minSpeed) / 4 が必要で、上のプロファイルはこれを満たしている
 * （travelTime.test.ts で検証している）。
 */
export function averageSpeedKmh(routeKm: number, profile: ModeProfile): number {
  const { minSpeedKmh, maxSpeedKmh, speedHalfKm } = profile
  if (maxSpeedKmh === minSpeedKmh) return minSpeedKmh
  return minSpeedKmh + (maxSpeedKmh - minSpeedKmh) * (routeKm / (routeKm + speedHalfKm))
}

/** 直線距離ベースの概算。API キー不要でその場で計算できる。 */
export function estimateTravel(from: LatLng, to: LatLng, mode: TravelMode): TravelEstimate {
  const profile = MODE_PROFILES[mode]
  const straightKm = haversineKm(from, to)
  const routeKm = straightKm * profile.detourFactor
  const minutes =
    profile.overheadMinutes + (routeKm / averageSpeedKmh(routeKm, profile)) * 60

  return {
    mode,
    minutes: Math.round(minutes),
    straightKm: Math.round(straightKm * 10) / 10,
    routeKm: Math.round(routeKm * 10) / 10,
    source: 'estimate',
  }
}

/** その手段で行くには遠すぎる（＝所要時間の概算があてにならない）距離か */
export function isBeyondPracticalRange(estimate: TravelEstimate): boolean {
  return estimate.routeKm > MODE_PROFILES[estimate.mode].practicalLimitKm
}

/**
 * 所要時間の取得元。
 * いまは概算のみだが、Google Maps Distance Matrix などに差し替えられるよう
 * インターフェースを挟んである（`search.ts` はこの型にしか依存しない）。
 */
export interface TravelTimeProvider {
  readonly id: string
  readonly label: string
  estimateMany(from: LatLng, targets: LatLng[], mode: TravelMode): Promise<TravelEstimate[]>
}

export const localEstimateProvider: TravelTimeProvider = {
  id: 'local-estimate',
  label: '直線距離からの概算',
  async estimateMany(from, targets, mode) {
    return targets.map((to) => estimateTravel(from, to, mode))
  },
}
