/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 通知サーバーの URL。未設定なら push 機能を隠す。 */
  readonly VITE_PUSH_API?: string
  /** VAPID の公開鍵（base64url） */
  readonly VITE_VAPID_PUBLIC_KEY?: string
  /** サーバー側で APP_TOKEN を設定した場合の合言葉 */
  readonly VITE_PUSH_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
