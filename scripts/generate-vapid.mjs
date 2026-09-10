/**
 * 通知サーバー用の VAPID 鍵をその場で作る。
 *   node scripts/generate-vapid.mjs
 * 出てきた値のうち、秘密鍵は wrangler secret put で入れる（ファイルに置かない）。
 */
import { createECDH } from 'node:crypto'

const ecdh = createECDH('prime256v1')
ecdh.generateKeys()

const publicKey = ecdh.getPublicKey().toString('base64url')
const privateKey = ecdh.getPrivateKey().toString('base64url')

console.log(`
VAPID の鍵を作りました。

  公開鍵（アプリと Worker の両方に入れる）
    ${publicKey}

  秘密鍵（Worker にだけ、secret として入れる）
    ${privateKey}

次にやること:
  cd worker
  npx wrangler secret put VAPID_PUBLIC_KEY    # 上の公開鍵
  npx wrangler secret put VAPID_PRIVATE_KEY   # 上の秘密鍵

アプリ側は .env に:
  VITE_VAPID_PUBLIC_KEY=${publicKey}
`)
