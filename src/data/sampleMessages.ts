import type { EmailAddress, Message } from '../types'

/**
 * デモ用のサンプルデータ。
 * 自社は「株式会社サンプルソリューションズ」で、`sample-sol.co.jp` と
 * そのサブドメイン `support.sample-sol.co.jp` を使っている想定。
 */
export const DEFAULT_OUR_DOMAINS = ['sample-sol.co.jp']

export const OUR_COMPANY_NAME = '株式会社サンプルソリューションズ'

// ---- 自社メンバー -------------------------------------------------------
const tanaka: EmailAddress = { name: '田中 一郎', address: 'tanaka@sample-sol.co.jp' }
const sato: EmailAddress = { name: '佐藤 美咲', address: 'sato@sample-sol.co.jp' }
const takahashi: EmailAddress = { name: '高橋 由紀', address: 'takahashi@sample-sol.co.jp' }
const suzuki: EmailAddress = { name: '鈴木 健太', address: 'suzuki@support.sample-sol.co.jp' }
const supportDesk: EmailAddress = { name: 'サポート窓口', address: 'support@sample-sol.co.jp' }

// ---- お客様 -------------------------------------------------------------
const yamada: EmailAddress = { name: '山田 太郎', address: 'yamada@mirai-shoji.co.jp' }
const inoue: EmailAddress = { name: '井上 花子', address: 'inoue@mirai-shoji.co.jp' }
const nakamura: EmailAddress = { name: '中村 誠', address: 'nakamura@towa-tech.jp' }
const kobayashi: EmailAddress = { name: '小林 拓也', address: 'kobayashi@towa-tech.jp' }
const watanabe: EmailAddress = { name: '渡辺 直美', address: 'watanabe@greenfoods.co.jp' }
const hashimoto: EmailAddress = { name: '橋本 剛', address: 'hashimoto@hashimoto-print.jp' }
const matsumoto: EmailAddress = { name: '松本 亮', address: 'matsumoto@nextlogi.com' }
const aoki: EmailAddress = { name: '青木 涼', address: 'aoki@aozora-data.co.jp' }
const okada: EmailAddress = { name: '岡田 みどり', address: 'okada@aozora-data.co.jp' }

/** アプリ起動時刻を基準にした相対日時。サンプルの経過時間が常に自然になる。 */
const baseTime = Date.now()
function hoursAgo(hours: number): string {
  return new Date(baseTime - hours * 60 * 60 * 1000).toISOString()
}

interface Draft {
  threadId: string
  subject: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  hoursAgo: number
  body: string
}

const drafts: Draft[] = [
  // --- みらい商事 / 山田様: 3日以上放置されている未対応 -------------------
  {
    threadId: 't-mirai-001',
    subject: '【御見積】基幹システム連携オプションについて',
    from: yamada,
    to: [tanaka],
    hoursAgo: 240,
    body: 'お世話になっております。みらい商事の山田です。\n先日ご提案いただいた連携オプションについて、正式なお見積りをいただけますでしょうか。',
  },
  {
    threadId: 't-mirai-001',
    subject: 'Re: 【御見積】基幹システム連携オプションについて',
    from: tanaka,
    to: [yamada],
    hoursAgo: 232,
    body: '山田様\nお世話になっております。田中です。\n本日中にお見積りをお送りいたします。',
  },
  {
    threadId: 't-mirai-001',
    subject: 'Re: 【御見積】基幹システム連携オプションについて',
    from: yamada,
    to: [tanaka],
    cc: [inoue],
    hoursAgo: 92,
    body: 'お見積りありがとうございました。\n社内で確認したところ、台数を 30 → 50 に増やした場合の金額も知りたいとの声がありました。\nお手数ですが再見積りをお願いできますでしょうか。',
  },

  // --- みらい商事 / 山田様: 担当が変わっても自社で返せている例 ------------
  {
    threadId: 't-mirai-002',
    subject: '定例ミーティングの日程調整',
    from: yamada,
    to: [tanaka],
    hoursAgo: 76,
    body: '来月の定例ですが、第2週で調整可能でしょうか。',
  },
  {
    threadId: 't-mirai-002',
    subject: 'Re: 定例ミーティングの日程調整',
    from: sato,
    to: [yamada],
    cc: [tanaka],
    hoursAgo: 70,
    body: '山田様\n田中が外出のため、代わりに佐藤よりご連絡いたします。\n第2週でしたら火曜・木曜の午後が空いております。',
  },

  // --- みらい商事 / 井上様: 対応済み -------------------------------------
  {
    threadId: 't-mirai-003',
    subject: '請求書の送付先変更のお願い',
    from: inoue,
    to: [supportDesk],
    hoursAgo: 130,
    body: '経理の井上です。次回請求分より送付先を経理部宛に変更をお願いいたします。',
  },
  {
    threadId: 't-mirai-003',
    subject: 'Re: 請求書の送付先変更のお願い',
    from: takahashi,
    to: [inoue],
    hoursAgo: 126,
    body: '井上様\nご連絡ありがとうございます。次回請求分より変更いたしました。',
  },

  // --- 東和テクノロジー / 中村様: 誰も返していない（最も深刻） ------------
  {
    threadId: 't-towa-001',
    subject: '障害報告：バッチ処理が深夜に停止する件',
    from: nakamura,
    to: [supportDesk],
    cc: [kobayashi],
    hoursAgo: 150,
    body: '東和テクノロジーの中村です。\n昨晩 2:00 頃からバッチが停止しています。ログを添付します。至急ご確認をお願いします。',
  },
  {
    threadId: 't-towa-001',
    subject: 'Re: 障害報告：バッチ処理が深夜に停止する件',
    from: nakamura,
    to: [supportDesk],
    cc: [kobayashi],
    hoursAgo: 120,
    body: '追加の情報です。再起動で復旧しましたが、原因が不明のままです。ご回答をお待ちしております。',
  },

  // --- 東和テクノロジー / 中村様: サブドメインの担当者が対応済み ----------
  {
    threadId: 't-towa-002',
    subject: '管理画面のログインができない',
    from: nakamura,
    to: [supportDesk],
    hoursAgo: 50,
    body: '管理画面にログインできなくなりました。パスワードは変更していません。',
  },
  {
    threadId: 't-towa-002',
    subject: 'Re: 管理画面のログインができない',
    from: suzuki,
    to: [nakamura],
    hoursAgo: 48,
    body: '中村様\nサポートの鈴木です。アカウントのロックを解除いたしました。お試しください。',
  },

  // --- 東和テクノロジー / 小林様: 直近で来た未対応 -----------------------
  {
    threadId: 't-towa-003',
    subject: '契約更新の条件について',
    from: kobayashi,
    to: [tanaka],
    hoursAgo: 5,
    body: '来期の契約更新にあたり、ライセンス数の見直しを検討しています。ご相談させてください。',
  },

  // --- グリーンフーズ / 渡辺様: 長いやりとりの末に対応済み ---------------
  {
    threadId: 't-green-001',
    subject: '納品スケジュールのご相談',
    from: watanabe,
    to: [sato],
    hoursAgo: 200,
    body: '来月の納品を 1 週間前倒しできないか検討しております。',
  },
  {
    threadId: 't-green-001',
    subject: 'Re: 納品スケジュールのご相談',
    from: sato,
    to: [watanabe],
    hoursAgo: 196,
    body: '渡辺様\n社内で調整いたします。少々お時間をください。',
  },
  {
    threadId: 't-green-001',
    subject: 'Re: 納品スケジュールのご相談',
    from: watanabe,
    to: [sato],
    hoursAgo: 180,
    body: 'ありがとうございます。よろしくお願いいたします。',
  },
  {
    threadId: 't-green-001',
    subject: 'Re: 納品スケジュールのご相談',
    from: sato,
    to: [watanabe],
    cc: [takahashi],
    hoursAgo: 30,
    body: '渡辺様\nお待たせしました。5 日前倒しでの納品が可能となりました。詳細は添付の通りです。',
  },

  // --- ハシモト印刷 / 橋本様: 26 時間放置（警告レベル） ------------------
  {
    threadId: 't-hashi-001',
    subject: '見積書の PDF が開けません',
    from: hashimoto,
    to: [supportDesk],
    hoursAgo: 26,
    body: 'いただいた PDF がエラーで開けませんでした。再送いただけますか。',
  },

  // --- ハシモト印刷 / 橋本様: 対応済み -----------------------------------
  {
    threadId: 't-hashi-002',
    subject: '年末年始の営業について',
    from: hashimoto,
    to: [tanaka],
    hoursAgo: 400,
    body: '年末年始の営業日を教えてください。',
  },
  {
    threadId: 't-hashi-002',
    subject: 'Re: 年末年始の営業について',
    from: tanaka,
    to: [hashimoto],
    hoursAgo: 396,
    body: '橋本様\n12/29 〜 1/3 を休業とさせていただきます。',
  },

  // --- NEXT LOGISTICS / 松本様: 自社発信のみ（相手待ち＝対応済み扱い） ----
  {
    threadId: 't-next-001',
    subject: '新機能のご案内（配送ステータス連携）',
    from: tanaka,
    to: [matsumoto],
    hoursAgo: 60,
    body: '松本様\n新しく追加された配送ステータス連携機能のご案内です。ご興味があればデモをご用意します。',
  },

  // --- NEXT LOGISTICS / 松本様: 未対応 -----------------------------------
  {
    threadId: 't-next-002',
    subject: 'API のレート制限について',
    from: matsumoto,
    to: [suzuki],
    cc: [supportDesk],
    hoursAgo: 40,
    body: '1 分あたりのリクエスト上限を引き上げることは可能でしょうか。現状だと夜間バッチが詰まります。',
  },

  // --- 青空データ / 青木様: 対応済み（複数社外参加者あり） ---------------
  {
    threadId: 't-aozora-001',
    subject: 'キックオフ日程のご相談',
    from: aoki,
    to: [sato],
    cc: [okada],
    hoursAgo: 100,
    body: 'プロジェクトのキックオフを来週で調整したく、候補日をいただけますか。',
  },
  {
    threadId: 't-aozora-001',
    subject: 'Re: キックオフ日程のご相談',
    from: sato,
    to: [aoki],
    cc: [okada, takahashi],
    hoursAgo: 94,
    body: '青木様、岡田様\n来週火曜 14:00 か 水曜 10:00 でいかがでしょうか。',
  },

  // --- 青空データ / 岡田様: 未対応（10時間前） ---------------------------
  {
    threadId: 't-aozora-002',
    subject: 'テスト環境のアカウント追加依頼',
    from: okada,
    to: [supportDesk],
    hoursAgo: 10,
    body: 'テスト環境に 3 名分のアカウント追加をお願いいたします。氏名は別途お送りします。',
  },

  // --- 社内のみのスレッド（ツリーには出ない想定） -------------------------
  {
    threadId: 't-internal-001',
    subject: '週次の売上レポート共有',
    from: takahashi,
    to: [tanaka, sato],
    hoursAgo: 12,
    body: '今週の売上レポートを共有します。',
  },
]

export const SAMPLE_MESSAGES: Message[] = drafts.map((draft, index) => ({
  id: `m-${String(index + 1).padStart(3, '0')}`,
  threadId: draft.threadId,
  subject: draft.subject,
  from: draft.from,
  to: draft.to,
  cc: draft.cc,
  sentAt: hoursAgo(draft.hoursAgo),
  body: draft.body,
}))
