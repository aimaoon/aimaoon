import type { Contest } from '../types'
import { addDays, toDateKey } from '../lib/date'
import { defaultReminders } from '../lib/reminder'

/**
 * デモ用データ。起動時刻を基準にした相対日付なので、いつ開いても
 * 「もうすぐのイベント」「終わったイベント」が自然に並ぶ。
 */
export function buildSampleContests(now: Date = new Date()): Contest[] {
  const today = toDateKey(now)
  const at = (days: number) => addDays(today, days)
  const stamp = now.toISOString()

  return [
    {
      id: 'sample-dance-alive',
      name: 'DANCE ALIVE 関東予選',
      category: 'SOLO / HIPHOP',
      date: at(2),
      startTime: '10:30',
      endTime: '18:00',
      venue: {
        name: '渋谷 WOMB',
        address: '東京都渋谷区円山町2-16',
        lat: 35.6567,
        lng: 139.6952,
        note: '出演者入口は建物裏。楽屋は B1。',
      },
      entry: { fee: 3500, status: 'paid', paidOn: at(-9), method: 'PayPay 送金' },
      music: {
        status: 'ready',
        bringOnDay: true,
        title: 'Pete Rock - The Basement',
        method: 'USB（バックアップで iPhone も持参）',
        note: '1分30秒に編集済み。頭出しの確認を忘れずに。',
      },
      judges: [
        { id: 'j-1', name: 'KENTO', genre: 'HIPHOP', note: 'ミュージカリティ重視。曲の取り方を見てくる。' },
        { id: 'j-2', name: 'MIKA', genre: 'FREESTYLE', note: '表情と抜け感。手数より流れ。' },
      ],
      reminders: defaultReminders(),
      memo: '持ち物：ゼッケン、テーピング、着替え2セット、飲み物。9:45 に現地着で動く。',
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'sample-tokyo-battle',
      name: 'TOKYO DANCE BATTLE vol.8',
      category: 'HIPHOP 2on2',
      date: at(12),
      startTime: '12:00',
      venue: {
        name: '横浜 BAY HALL',
        address: '神奈川県横浜市中区新山下2-11-1',
        note: '駐車場あり。リハは 11:00 から。',
      },
      entry: { fee: 5000, status: 'unpaid', dueDate: at(3), method: '三菱UFJ 銀行振込（振込名義はチーム名）' },
      music: {
        status: 'submitted',
        bringOnDay: true,
        title: 'DJ に一任（バトル形式）',
        submittedOn: at(-2),
        method: 'エントリーフォームで提出済み（当日 USB も持参）',
      },
      judges: [
        { id: 'j-3', name: 'RYU', genre: 'HIPHOP' },
        { id: 'j-4', name: 'SHOTA', genre: 'HOUSE', note: '足元をよく見る。ステップの正確さ。' },
        { id: 'j-5', name: 'ARISA', genre: 'ALL STYLE' },
      ],
      reminders: defaultReminders(),
      final: {
        date: at(54),
        startTime: '13:00',
        endTime: '20:00',
        venue: { name: '東京ドームシティホール', address: '東京都文京区後楽1-3-61' },
        status: 'undecided',
        reminders: defaultReminders(),
        note: '予選を勝ち抜いたらここ。リハは 11:00 集合、音源は再提出が必要。',
      },
      memo: '相方と事前に 2 回合わせる。ルーティンは 8 カウント × 4。',
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'sample-street-fire',
      name: 'STREET FIRE SHOWCASE',
      category: 'チーム / 3分ショーケース',
      date: at(26),
      startTime: '15:00',
      venue: { name: '大阪 なんば Hatch', address: '大阪府大阪市浪速区湊町1-3-1' },
      entry: { fee: 8000, status: 'partial', paidAmount: 4000, dueDate: at(10), method: '前半 4,000 円入金済み' },
      music: {
        status: 'ready',
        title: 'MIX 音源（DJ TAKU 編集）',
        dueDate: at(9),
        method: 'Google フォームに mp3 をアップロード',
        note: '3分00秒ちょうど。フェードアウト処理を確認してから提出。',
      },
      judges: [{ id: 'j-6', name: 'HIRO', genre: 'LOCK', note: 'ショーケースは構成と見せ場の数を見る。' }],
      reminders: defaultReminders(),
      memo: '新幹線と宿の予約がまだ。メンバー 6 人ぶん。',
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'sample-japan-delight',
      name: 'JAPAN DANCE DELIGHT 東京予選',
      category: 'チーム / 2分',
      date: at(-12),
      startTime: '13:00',
      venue: { name: 'Zepp DiverCity', address: '東京都江東区青海1-1-10' },
      entry: { fee: 4000, status: 'paid', paidOn: at(-30) },
      music: { status: 'submitted', title: 'MIX 音源', submittedOn: at(-18) },
      judges: [
        { id: 'j-8', name: 'KENTO', genre: 'HIPHOP', note: 'ミュージカリティ重視。曲の取り方を見てくる。' },
        { id: 'j-9', name: 'MASA', genre: 'POP', note: 'チームの揃い方より、個の色を見るタイプ。' },
      ],
      reminders: defaultReminders(),
      final: {
        // 権利だけ先に決まって、日程は後日発表されるパターン。
        status: 'advanced',
        reminders: defaultReminders(),
        note: 'ファイナル進出決定。日程と会場は主催の発表待ち（例年 3 月／大阪）。',
      },
      memo: '',
      review: {
        rating: 5,
        result: '優勝（ファイナル進出）',
        good: '構成の見せ場が刺さった。3 人の同期も揃っていた。',
        improve: 'ラストの尺が押した。時間管理は要練習。',
        next: 'ファイナルまでに 2 分の構成を組み直す。',
        updatedAt: at(-11),
      },
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'sample-guest-show',
      name: 'ゲストショー @ Club Harlem',
      category: 'ゲスト出演',
      date: at(-5),
      startTime: '22:00',
      venue: { name: 'Club Harlem', address: '東京都渋谷区宇田川町2-4' },
      entry: { fee: 0, status: 'free', method: 'ギャラ 15,000 円（当日手渡し）' },
      music: { status: 'ready', bringOnDay: true, title: 'いつものショー音源', method: '当日 USB' },
      judges: [],
      reminders: defaultReminders(),
      memo: '',
      createdAt: stamp,
      updatedAt: stamp,
    },
    {
      id: 'sample-summer-jam',
      name: 'SUMMER JAM CONTEST',
      category: 'SOLO / ALL STYLE',
      date: at(-24),
      startTime: '11:00',
      venue: { name: '川崎 CLUB CITTA', address: '神奈川県川崎市川崎区小川町4-1' },
      entry: { fee: 3000, status: 'paid', paidOn: at(-40) },
      music: { status: 'submitted', title: 'Kaytranada - Be Careful', submittedOn: at(-30) },
      judges: [{ id: 'j-7', name: 'YUKI', genre: 'ALL STYLE', note: '入りの 4 カウントを毎回見ている。' }],
      reminders: defaultReminders(),
      memo: '',
      review: {
        rating: 4,
        result: 'ベスト8',
        good: '1 回戦は音を細かく取れた。緊張しても最初のポーズで立て直せた。',
        improve: '準決勝で手数に頼って構成が単調になった。後半の見せ場が弱い。',
        next: '30秒のルーティンを 2 パターン作って、どの曲でも当てられるようにする。',
        updatedAt: at(-23),
      },
      createdAt: stamp,
      updatedAt: stamp,
    },
  ]
}
