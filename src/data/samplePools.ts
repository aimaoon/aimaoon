import type { Pool } from '../types'

/**
 * 動作確認用のサンプル登録（首都圏の公共プール）。
 * 座標は施設周辺の概略値なので、実運用では「プール登録」画面か
 * JSON 取り込みで自社の施設リストに置き換えてください。
 */
export const SAMPLE_POOLS: Pool[] = [
  {
    id: 'sample-tokyo-aquatics',
    name: '東京アクアティクスセンター',
    address: '東京都江東区辰巳2-2-1',
    location: { lat: 35.6438, lng: 139.819 },
    tags: ['50m', '屋内', '温水'],
  },
  {
    id: 'sample-tokyo-gymnasium',
    name: '東京体育館 プール',
    address: '東京都渋谷区千駄ヶ谷1-17-1',
    location: { lat: 35.6817, lng: 139.7128 },
    tags: ['50m', '屋内', '温水'],
  },
  {
    id: 'sample-minato-sc',
    name: '港区スポーツセンター',
    address: '東京都港区海岸1-16-1',
    location: { lat: 35.6494, lng: 139.758 },
    tags: ['25m', '屋内', '温水'],
  },
  {
    id: 'sample-chuo-sc',
    name: '中央区総合スポーツセンター',
    address: '東京都中央区日本橋浜町2-59-1',
    location: { lat: 35.6866, lng: 139.7896 },
    tags: ['25m', '屋内', '温水'],
  },
  {
    id: 'sample-shinjuku-cosmic',
    name: '新宿コズミックセンター 温水プール',
    address: '東京都新宿区大久保3-1-2',
    location: { lat: 35.702, lng: 139.706 },
    tags: ['25m', '屋内', '温水'],
  },
  {
    id: 'sample-setagaya-pool',
    name: '世田谷区立総合運動場 温水プール',
    address: '東京都世田谷区大蔵4-6-1',
    location: { lat: 35.6295, lng: 139.609 },
    tags: ['50m', '屋内', '温水'],
  },
  {
    id: 'sample-hachioji-pool',
    name: '八王子市市民屋内プール',
    address: '東京都八王子市宮下町348',
    location: { lat: 35.672, lng: 139.354 },
    tags: ['25m', '屋内', '温水'],
  },
  {
    id: 'sample-yokohama-intl',
    name: '横浜国際プール',
    address: '神奈川県横浜市都筑区北山田7-3-1',
    location: { lat: 35.568, lng: 139.586 },
    tags: ['50m', '屋内', '温水'],
  },
  {
    id: 'sample-asao-sc',
    name: '川崎市麻生スポーツセンター',
    address: '神奈川県川崎市麻生区上麻生4-2-1',
    location: { lat: 35.603, lng: 139.506 },
    tags: ['25m', '屋内', '温水'],
  },
  {
    id: 'sample-sagamihara-green',
    name: 'さがみはらグリーンプール',
    address: '神奈川県相模原市南区麻溝台2284-1',
    location: { lat: 35.517, lng: 139.382 },
    tags: ['50m', '屋内', '温水'],
  },
  {
    id: 'sample-saitama-kinen',
    name: 'さいたま市記念総合体育館 プール',
    address: '埼玉県さいたま市浦和区上木崎4-3-17',
    location: { lat: 35.876, lng: 139.666 },
    tags: ['25m', '屋内', '温水'],
  },
  {
    id: 'sample-chiba-intl',
    name: '千葉県国際総合水泳場',
    address: '千葉県習志野市茜浜2-3-1',
    location: { lat: 35.66, lng: 140.033 },
    tags: ['50m', '屋内', '温水'],
  },
]
