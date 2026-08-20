/** 95 → 「1時間35分」、45 → 「45分」 */
export function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes))
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (hours === 0) return `${rest}分`
  if (rest === 0) return `${hours}時間`
  return `${hours}時間${rest}分`
}

/** 0.8 → 「800m」、12.34 → 「12.3km」 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

/**
 * 制限時間に対する余裕度。リストの色分けに使う。
 * over は圏外、tight は制限時間の 8 割以上使っている。
 */
export type Proximity = 'close' | 'moderate' | 'tight' | 'over'

export function proximityOf(minutes: number, limitMinutes: number): Proximity {
  if (minutes > limitMinutes) return 'over'
  const ratio = minutes / limitMinutes
  if (ratio <= 0.5) return 'close'
  if (ratio < 0.8) return 'moderate'
  return 'tight'
}
