import { describe, expect, it } from 'vitest'
import { createECDH, createPublicKey, createVerify, randomBytes } from 'node:crypto'
import ece from 'http_ece'
import {
  audienceOf,
  base64UrlToBytes,
  bytesToBase64Url,
  createVapidToken,
  encryptPayload,
} from './push'

/** 受信側（ブラウザ）の鍵を作る。実際の購読で渡ってくるものと同じ形。 */
function createReceiver() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  return {
    ecdh,
    auth,
    keys: {
      p256dh: bytesToBase64Url(new Uint8Array(ecdh.getPublicKey())),
      auth: bytesToBase64Url(new Uint8Array(auth)),
    },
  }
}

describe('base64url の変換', () => {
  it('往復しても壊れない', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255])
    expect(base64UrlToBytes(bytesToBase64Url(bytes))).toEqual(bytes)
  })

  it('+ と / を含まない', () => {
    const encoded = bytesToBase64Url(new Uint8Array([251, 255, 190, 255]))
    expect(encoded).not.toMatch(/[+/=]/)
  })
})

describe('本文の暗号化（aes128gcm）', () => {
  it('参照実装（http_ece）で復号できる', async () => {
    const receiver = createReceiver()
    const payload = JSON.stringify({ title: 'DANCE ALIVE 関東予選（前日）', body: '10:30 集合 / 渋谷 WOMB' })

    const body = await encryptPayload(payload, receiver.keys)

    const decrypted = ece.decrypt(Buffer.from(body), {
      version: 'aes128gcm',
      privateKey: receiver.ecdh,
      authSecret: receiver.auth,
    })
    expect(decrypted.toString('utf8')).toBe(payload)
  })

  it('日本語や記号が混じっても壊れない', async () => {
    const receiver = createReceiver()
    const payload = '入金期限：TOKYO DANCE BATTLE vol.8／5,000円 ✓'
    const body = await encryptPayload(payload, receiver.keys)
    const decrypted = ece.decrypt(Buffer.from(body), {
      version: 'aes128gcm',
      privateKey: receiver.ecdh,
      authSecret: receiver.auth,
    })
    expect(decrypted.toString('utf8')).toBe(payload)
  })

  it('本体の頭が salt・レコード長・送信側の公開鍵の順に並ぶ', async () => {
    const receiver = createReceiver()
    const salt = new Uint8Array(16).fill(7)
    const body = await encryptPayload('x', receiver.keys, { salt })

    expect(body.slice(0, 16)).toEqual(salt)
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096)
    expect(body[20]).toBe(65)
    expect(body[21]).toBe(0x04) // 非圧縮の P-256 点
  })

  it('毎回ちがう暗号文になる（salt と鍵を作り直している）', async () => {
    const receiver = createReceiver()
    const a = await encryptPayload('same', receiver.keys)
    const b = await encryptPayload('same', receiver.keys)
    expect(bytesToBase64Url(a)).not.toBe(bytesToBase64Url(b))
  })

  it('別の受信者の鍵では復号できない', async () => {
    const receiver = createReceiver()
    const stranger = createReceiver()
    const body = await encryptPayload('secret', receiver.keys)

    expect(() =>
      ece.decrypt(Buffer.from(body), {
        version: 'aes128gcm',
        privateKey: stranger.ecdh,
        authSecret: stranger.auth,
      }),
    ).toThrow()
  })
})

describe('VAPID の JWT', () => {
  // テスト用の鍵。実運用の鍵は Cloudflare の secret に入れる。
  const vapidEcdh = createECDH('prime256v1')
  vapidEcdh.generateKeys()
  const vapid = {
    publicKey: bytesToBase64Url(new Uint8Array(vapidEcdh.getPublicKey())),
    privateKey: bytesToBase64Url(new Uint8Array(vapidEcdh.getPrivateKey())),
    subject: 'mailto:dancer@example.com',
  }

  it('endpoint のオリジンを aud にする', () => {
    expect(audienceOf('https://fcm.googleapis.com/fcm/send/abc123')).toBe('https://fcm.googleapis.com')
    expect(audienceOf('https://web.push.apple.com/QWERTY?x=1')).toBe('https://web.push.apple.com')
  })

  it('ES256 で署名されていて、公開鍵で検証できる', async () => {
    const now = new Date('2026-08-20T12:00:00Z')
    const token = await createVapidToken('https://fcm.googleapis.com/fcm/send/abc', vapid, now)
    const [header, claims, signature] = token.split('.')

    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ typ: 'JWT', alg: 'ES256' })
    const payload = JSON.parse(Buffer.from(claims, 'base64url').toString())
    expect(payload.aud).toBe('https://fcm.googleapis.com')
    expect(payload.sub).toBe('mailto:dancer@example.com')
    // 期限は 24 時間以内（RFC 8292 の制限）
    expect(payload.exp - now.getTime() / 1000).toBeLessThanOrEqual(24 * 60 * 60)
    expect(payload.exp).toBeGreaterThan(now.getTime() / 1000)

    const publicKey = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: bytesToBase64Url(new Uint8Array(vapidEcdh.getPublicKey()).slice(1, 33)),
        y: bytesToBase64Url(new Uint8Array(vapidEcdh.getPublicKey()).slice(33, 65)),
      },
      format: 'jwk',
    })
    const verifier = createVerify('SHA256')
    verifier.update(`${header}.${claims}`)
    expect(
      verifier.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')),
    ).toBe(true)
  })

  it('別の鍵の署名は通らない', async () => {
    const other = createECDH('prime256v1')
    other.generateKeys()
    const token = await createVapidToken('https://example.com/push/1', vapid)
    const [header, claims, signature] = token.split('.')

    const publicKey = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: bytesToBase64Url(new Uint8Array(other.getPublicKey()).slice(1, 33)),
        y: bytesToBase64Url(new Uint8Array(other.getPublicKey()).slice(33, 65)),
      },
      format: 'jwk',
    })
    const verifier = createVerify('SHA256')
    verifier.update(`${header}.${claims}`)
    expect(
      verifier.verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')),
    ).toBe(false)
  })
})
