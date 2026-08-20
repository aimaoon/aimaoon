import { MODE_PROFILES } from './travelTime'
import type { LatLng, TravelMode } from '../types'

const GOOGLE_TRAVEL_MODE: Record<TravelMode, string> = {
  car: 'driving',
  transit: 'transit',
  bike: 'bicycling',
  walk: 'walking',
}

/** 概算だけでは不安なときに、実際の経路を Google マップで開くためのリンク */
export function directionsUrl(from: LatLng, to: LatLng, mode: TravelMode): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: GOOGLE_TRAVEL_MODE[mode],
  })
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function modeLabel(mode: TravelMode): string {
  return MODE_PROFILES[mode].label
}
