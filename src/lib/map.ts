import type { Venue } from '../types'

/**
 * 会場の地図リンク。
 * 埋め込み地図は API キーが要るので、Google マップをそのまま開く URL を作る
 * （アプリが入っていればアプリ側で開く）。
 * 座標があれば座標を、なければ住所（無ければ会場名）を検索語にする。
 */

/** 地図で開くときの検索語。 */
export function mapQuery(venue: Venue): string {
  if (typeof venue.lat === 'number' && typeof venue.lng === 'number') {
    return `${venue.lat},${venue.lng}`
  }
  return (venue.address || venue.name || '').trim()
}

/** 地図を開けるだけの情報があるか。 */
export function canOpenMap(venue: Venue): boolean {
  return mapQuery(venue).length > 0
}

/** Google マップ（アプリが入っていればアプリで開く）。 */
export function googleMapsUrl(venue: Venue): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery(venue))}`
}

/** 現在地からの経路検索。 */
export function directionsUrl(venue: Venue): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapQuery(venue))}`
}

/** 住所をコピーしたいとき用の 1 行表記。 */
export function venueOneLine(venue: Venue): string {
  return [venue.name, venue.address].filter(Boolean).join(' / ')
}
