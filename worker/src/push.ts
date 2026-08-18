/**
 * Web Push の送信部分。
 * Cloudflare Workers には Node の crypto が無いので、WebCrypto だけで組んでいる。
 *
 * - 本文の暗号化: RFC 8188 (aes128gcm) + RFC 8291 (Web Push の鍵の作り方)
 * - 送信者の証明:  RFC 8292 (VAPID) の ES256 な JWT
 *
 * ここは目で見て正しさが分からない部類なので、暗号化は参照実装 (http_ece) で
 * 復号できることをテストで確かめている。
 */

export interface PushSubscriptionKeys {
  /** 受信側の公開鍵（base64url, 非圧縮の P-256 点 65 バイト） */
  p256dh: string
  /** 受信側の認証秘密（base64url, 16 バイト） */
  auth: string
}

export interface PushSubscription {
  endpoint: string
  keys: PushSubscriptionKeys
}

export interface VapidKeys {
  /** base64url の非圧縮公開鍵 */
  publicKey: string
  /** base64url の秘密鍵 d（32 バイト） */
  privateKey: string
  /** 連絡先。mailto: か https: */
  subject: string
}

const encoder = new TextEncoder()

/** 1 レコードに収める最大サイズ。通知の本文はこれより十分小さい。 */
const RECORD_SIZE = 4096

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * WebCrypto の引数は ArrayBuffer で渡す。
 * Uint8Array のままだと、TypeScript が SharedArrayBuffer の可能性を消せずに型が合わない。
 */
function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** 非圧縮の P-256 公開鍵（0x04 || X || Y）を JWK に開く。 */
function publicKeyToJwk(publicKey: Uint8Array): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 0x04) {
    throw new Error('P-256 の非圧縮公開鍵ではありません')
  }
  return {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToBase64Url(publicKey.slice(1, 33)),
    y: bytesToBase64Url(publicKey.slice(33, 65)),
    ext: true,
  }
}

async function importPublicKey(publicKey: Uint8Array, usages: KeyUsage[] = []): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', publicKeyToJwk(publicKey), { name: 'ECDH', namedCurve: 'P-256' }, true, usages)
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) },
    key,
    length * 8,
  )
  return new Uint8Array(bits)
}

/** "Content-Encoding: xxx" 形式の info（末尾に 0x00 が付く）。 */
function contentEncodingInfo(label: string): Uint8Array {
  return concat(encoder.encode(`Content-Encoding: ${label}`), new Uint8Array([0]))
}

/**
 * 本文を aes128gcm で暗号化して、そのまま POST できる本体を返す。
 * salt と送信側の鍵は毎回作り直す（テストのために差し込めるようにしてある）。
 */
export async function encryptPayload(
  payload: string,
  keys: PushSubscriptionKeys,
  options: { salt?: Uint8Array; senderKeys?: CryptoKeyPair } = {},
): Promise<Uint8Array> {
  const uaPublicBytes = base64UrlToBytes(keys.p256dh)
  const authSecret = base64UrlToBytes(keys.auth)
  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16))

  const senderKeys =
    options.senderKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const senderPublicBytes = new Uint8Array(await crypto.subtle.exportKey('raw', senderKeys.publicKey))

  // ECDH の共有秘密から、認証秘密を塩にして IKM を作る（RFC 8291 3.4）。
  const uaPublicKey = await importPublicKey(uaPublicBytes)
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaPublicKey },
    senderKeys.privateKey,
    256,
  )
  const ikmInfo = concat(
    encoder.encode('WebPush: info'),
    new Uint8Array([0]),
    uaPublicBytes,
    senderPublicBytes,
  )
  const ikm = await hkdf(authSecret, new Uint8Array(sharedBits), ikmInfo, 32)

  // ここから先は RFC 8188 の素の aes128gcm。
  const contentKey = await hkdf(salt, ikm, contentEncodingInfo('aes128gcm'), 16)
  const nonce = await hkdf(salt, ikm, contentEncodingInfo('nonce'), 12)

  const aesKey = await crypto.subtle.importKey('raw', buf(contentKey), 'AES-GCM', false, ['encrypt'])
  // 最終レコードの区切りは 0x02。
  const record = concat(encoder.encode(payload), new Uint8Array([2]))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce), tagLength: 128 }, aesKey, buf(record)),
  )

  const header = new Uint8Array(5)
  new DataView(header.buffer).setUint32(0, RECORD_SIZE)
  header[4] = senderPublicBytes.length
  return concat(salt, header, senderPublicBytes, ciphertext)
}

/** VAPID の秘密鍵を WebCrypto に読み込む。 */
async function importVapidPrivateKey(vapid: VapidKeys): Promise<CryptoKey> {
  const jwk = publicKeyToJwk(base64UrlToBytes(vapid.publicKey))
  return crypto.subtle.importKey(
    'jwk',
    { ...jwk, d: vapid.privateKey },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

/** endpoint のスキーム + ホストまで。JWT の aud になる。 */
export function audienceOf(endpoint: string): string {
  return new URL(endpoint).origin
}

/**
 * Authorization ヘッダに載せる VAPID の JWT を作る。
 * 期限は最長 24 時間と決まっているので、余裕を見て 12 時間にしている。
 */
export async function createVapidToken(
  endpoint: string,
  vapid: VapidKeys,
  now: Date = new Date(),
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const claims = {
    aud: audienceOf(endpoint),
    exp: Math.floor(now.getTime() / 1000) + 12 * 60 * 60,
    sub: vapid.subject,
  }
  const unsigned = `${bytesToBase64Url(encoder.encode(JSON.stringify(header)))}.${bytesToBase64Url(
    encoder.encode(JSON.stringify(claims)),
  )}`

  const key = await importVapidPrivateKey(vapid)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    buf(encoder.encode(unsigned)),
  )
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`
}

export interface PushResult {
  ok: boolean
  status: number
  /** 購読が無効になったので、こちらの控えも消してよい */
  expired: boolean
}

/** 通知を 1 件送る。 */
export async function sendPush(
  subscription: PushSubscription,
  payload: string,
  vapid: VapidKeys,
  options: { ttlSeconds?: number; now?: Date } = {},
): Promise<PushResult> {
  const body = await encryptPayload(payload, subscription.keys)
  const token = await createVapidToken(subscription.endpoint, vapid, options.now)

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${token}, k=${vapid.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(options.ttlSeconds ?? 12 * 60 * 60),
      Urgency: 'normal',
    },
    body: buf(body),
  })

  // 404/410 は購読が失効した合図（RFC 8030）。
  return { ok: response.ok, status: response.status, expired: response.status === 404 || response.status === 410 }
}
