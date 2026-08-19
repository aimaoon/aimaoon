/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 通知サーバーの URL。未設定なら push 機能を隠す。 */
  readonly VITE_PUSH_API?: string
  /** VAPID の公開鍵（base64url） */
  readonly VITE_VAPID_PUBLIC_KEY?: string
  /** サーバー側で APP_TOKEN を設定した場合の合言葉 */
  readonly VITE_PUSH_TOKEN?: string
  /** 設定タブに出す問い合わせ先。未設定なら項目ごと隠す。 */
  readonly VITE_SUPPORT_EMAIL?: string
}

/** package.json の version（vite.config.ts の define で埋め込む） */
declare const __APP_VERSION__: string

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** 参照実装。テストで自作の QR と突き合わせるためだけに使う（アプリ本体には含めない）。 */
declare module 'qrcode' {
  export function create(
    data: string | { data: string; mode: string }[],
    options?: { errorCorrectionLevel?: string },
  ): { version: number; modules: { size: number; data: Uint8Array } }
}
