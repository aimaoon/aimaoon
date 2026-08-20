/** 移動手段 */
export type TravelMode = 'car' | 'transit' | 'bike' | 'walk'

export const TRAVEL_MODES: TravelMode[] = ['car', 'transit', 'bike', 'walk']

export interface LatLng {
  lat: number
  lng: number
}

/** あらかじめ登録しておく施設（プール） */
export interface Pool {
  id: string
  /** 施設名 */
  name: string
  /** 住所（表示用。座標は location を使う） */
  address: string
  location: LatLng
  /** 「25m」「50m」「屋内」「温水」などの自由タグ */
  tags: string[]
  /** 営業時間・料金などのメモ */
  note?: string
  url?: string
  phone?: string
}

/** 出発地（お客様の住所） */
export interface Origin {
  /** 入力された住所文字列 */
  address: string
  /** ジオコーディング結果の正式表記 */
  title?: string
  location: LatLng
}

export interface TravelEstimate {
  mode: TravelMode
  /** 所要時間（分） */
  minutes: number
  /** 直線距離（km） */
  straightKm: number
  /** 迂回を見込んだ推定移動距離（km） */
  routeKm: number
  /** 概算か実測かの区別。将来 Google Maps 等に差し替えたときに実測を返す */
  source: 'estimate' | 'api'
}

export interface SearchResult {
  pool: Pool
  estimate: TravelEstimate
  /** 指定した時間内に収まっているか */
  withinLimit: boolean
}
