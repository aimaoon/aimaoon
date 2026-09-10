/** テストでだけ使う参照実装。型定義が同梱されていないので最小限だけ宣言する。 */
declare module 'http_ece' {
  import type { ECDH } from 'node:crypto'

  interface DecryptParams {
    version: 'aes128gcm'
    privateKey: ECDH
    authSecret: Buffer
  }

  const ece: {
    decrypt(buffer: Buffer, params: DecryptParams): Buffer
  }
  export default ece
}
