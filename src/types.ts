/** 入金の状態。free は「エントリー費なし」（ゲストショーなど）。 */
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'free'

/**
 * 音源の状態。
 * - none:      まだ曲が決まっていない／用意していない
 * - ready:     曲は用意できたが主催者へは未提出
 * - submitted: 主催者へ提出済み
 * - onsite:    当日持参で対応する（提出不要）
 */
export type MusicStatus = 'none' | 'ready' | 'submitted' | 'onsite'

/** 開催場所。住所か緯度経度のどちらかがあれば地図を開ける。 */
export interface Venue {
  name: string
  address?: string
  lat?: number
  lng?: number
  /** 最寄り駅、入り口、楽屋の場所など */
  note?: string
}

/** エントリー費と入金の管理。 */
export interface Entry {
  /** エントリー費（円）。0 なら無料。 */
  fee: number
  status: PaymentStatus
  /** partial のときに入金済みの金額（円） */
  paidAmount?: number
  /** 入金期限 YYYY-MM-DD */
  dueDate?: string
  /** 入金日 YYYY-MM-DD */
  paidOn?: string
  /** 振込先、支払い方法のメモ */
  method?: string
}

/** 音源の提出管理。 */
export interface Music {
  status: MusicStatus
  /** 曲名／アーティスト */
  title?: string
  /** 音源提出期限 YYYY-MM-DD */
  dueDate?: string
  /** 提出日 YYYY-MM-DD */
  submittedOn?: string
  /** 提出方法（Google フォーム、メール、当日 USB など） */
  method?: string
  /** 尺、編集の有無などのメモ */
  note?: string
}

/** ジャッジ 1 人分。 */
export interface Judge {
  id: string
  name: string
  /** ジャンル／所属など */
  genre?: string
  /** 好みの傾向、過去に見てもらった時の反応など */
  note?: string
}

/** イベント後の振り返り。 */
export interface Review {
  /** 5 段階の自己評価 */
  rating?: number
  /** 結果（優勝、ベスト8、出演のみ など） */
  result?: string
  /** よかったこと */
  good?: string
  /** 課題 */
  improve?: string
  /** 次に向けてやること */
  next?: string
  updatedAt?: string
}

/** リマインダー 1 件の設定。開催日の daysBefore 日前の time に通知する。 */
export interface Reminder {
  id: string
  /** 0 なら当日 */
  daysBefore: number
  /** HH:mm */
  time: string
  label?: string
  enabled: boolean
}

/**
 * ファイナルへの進出状況。
 * - undecided: まだ結果待ち（日程だけ押さえている状態）
 * - advanced:  ファイナル権を獲得した
 * - eliminated: 予選で敗退した
 */
export type FinalStatus = 'undecided' | 'advanced' | 'eliminated'

/**
 * ファイナル（決勝）の予定。
 * 予選とは別日・別会場で行われることが多いので、1 つのコンテストの中に別枠で持つ。
 */
export interface FinalRound {
  /** 開催日 YYYY-MM-DD。権利だけ先に獲得して日程が未発表のこともあるので任意。 */
  date?: string
  /** 集合時刻 HH:mm */
  startTime?: string
  /** 終了予定 HH:mm */
  endTime?: string
  /** 会場が予選と違うときだけ入れる。未入力なら予選と同じ会場として扱う。 */
  venue?: Venue
  status: FinalStatus
  /** ファイナル用のリマインダー */
  reminders: Reminder[]
  note?: string
}

/** コンテスト（1 エントリー分）。アプリの中心となるデータ。 */
export interface Contest {
  id: string
  name: string
  /** 部門・カテゴリ（HIPHOP 2on2、SOLO など） */
  category?: string
  /** 開催日 YYYY-MM-DD */
  date: string
  /** 集合時刻 HH:mm */
  startTime?: string
  /** 終了予定 HH:mm */
  endTime?: string
  venue: Venue
  entry: Entry
  music: Music
  judges: Judge[]
  reminders: Reminder[]
  /** ファイナルがある大会だけ設定する */
  final?: FinalRound
  /** 当日の持ち物・段取りメモ */
  memo?: string
  review?: Review
  createdAt: string
  updatedAt: string
}

/** 開催日と現在時刻の関係。 */
export type ContestPhase = 'today' | 'upcoming' | 'past'

/** 準備タスク 1 件。詳細画面のチェックリストとホームの警告に使う。 */
export interface PreparationTask {
  kind: 'payment' | 'music' | 'venue' | 'judge'
  label: string
  done: boolean
  /** 期限 YYYY-MM-DD */
  dueDate?: string
  /** 未完了かつ期限が近い／過ぎている */
  urgency: 'none' | 'soon' | 'overdue'
}

/** 準備状況のまとめ。 */
export interface Preparation {
  tasks: PreparationTask[]
  doneCount: number
  totalCount: number
  /** 0〜1 */
  ratio: number
  /** 未完了で急ぎのタスク */
  alerts: PreparationTask[]
}

/** 通知タブに並べる、これから来る 1 件の予定。 */
export interface ReminderOccurrence {
  contestId: string
  contestName: string
  /** 通知する日時 */
  at: string
  title: string
  body: string
  kind: 'event' | 'final' | 'payment' | 'music'
}
