import { describe, expect, it } from 'vitest'
import { appleMapsUrl, canOpenMap, directionsUrl, googleMapsUrl, mapQuery, venueOneLine } from './map'

describe('地図リンク', () => {
  it('座標があれば座標を優先する', () => {
    expect(mapQuery({ name: '渋谷 WOMB', address: '東京都渋谷区円山町2-16', lat: 35.6567, lng: 139.6952 })).toBe(
      '35.6567,139.6952',
    )
  })

  it('座標がなければ住所を使う', () => {
    expect(mapQuery({ name: '渋谷 WOMB', address: '東京都渋谷区円山町2-16' })).toBe('東京都渋谷区円山町2-16')
  })

  it('住所もなければ会場名で検索する', () => {
    expect(mapQuery({ name: '横浜 BAY HALL' })).toBe('横浜 BAY HALL')
  })

  it('片方だけの座標は使わない', () => {
    expect(mapQuery({ name: '会場', lat: 35.6 })).toBe('会場')
  })

  it('何も無ければ地図を開けない', () => {
    expect(canOpenMap({ name: '' })).toBe(false)
    expect(canOpenMap({ name: '  ' })).toBe(false)
  })

  it('URL エンコードして各地図サービスのリンクを作る', () => {
    const venue = { name: '渋谷 WOMB', address: '東京都渋谷区円山町2-16' }
    expect(googleMapsUrl(venue)).toContain(encodeURIComponent('東京都渋谷区円山町2-16'))
    expect(directionsUrl(venue)).toContain('destination=')
    expect(appleMapsUrl(venue)).toContain('?q=')
  })

  it('Apple マップは座標なら ll パラメータになる', () => {
    expect(appleMapsUrl({ name: '会場', lat: 35.6567, lng: 139.6952 })).toContain('?ll=')
  })

  it('会場名と住所を 1 行にまとめる', () => {
    expect(venueOneLine({ name: '渋谷 WOMB', address: '東京都渋谷区円山町2-16' })).toBe(
      '渋谷 WOMB / 東京都渋谷区円山町2-16',
    )
    expect(venueOneLine({ name: '渋谷 WOMB' })).toBe('渋谷 WOMB')
  })
})
