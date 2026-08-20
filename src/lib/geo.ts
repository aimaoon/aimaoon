import type { LatLng } from '../types'

const EARTH_RADIUS_KM = 6371

const toRadians = (deg: number) => (deg * Math.PI) / 180

/** 2 地点の直線距離（km）。ヒュベニではなく球面近似（ハーバサイン）で十分な精度。 */
export function haversineKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.lat - from.lat)
  const dLng = toRadians(to.lng - from.lng)
  const lat1 = toRadians(from.lat)
  const lat2 = toRadians(to.lat)

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** 緯度経度として妥当な値か（日本国内に限定はしない） */
export function isValidLatLng(value: unknown): value is LatLng {
  if (typeof value !== 'object' || value === null) return false
  const { lat, lng } = value as Record<string, unknown>
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}
