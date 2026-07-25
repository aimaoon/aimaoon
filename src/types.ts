/** メールアドレス 1 件（表示名は任意）。 */
export interface EmailAddress {
  name?: string
  address: string
}

/** 1 通のメール。スレッドは threadId でまとまる。 */
export interface Message {
  id: string
  threadId: string
  subject: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  /** ISO 8601 の送信日時 */
  sentAt: string
  body: string
}

/**
 * スレッドの対応状況。
 * - answered: 最後のメールが自社ドメインから送られている（＝社内の誰かが返信済み）
 * - waiting:  最後のメールが社外から。ボールは自社側にある（＝未対応）
 * - unknown:  自社・社外の判定ができない（メールが無い等）
 */
export type ThreadStatus = 'answered' | 'waiting' | 'unknown'
