import { useEffect, useState } from 'react'
import type { Contest } from '../types'
import { buildShareUrl, encodeShare, toSharePayload } from '../lib/share'
import { QrImage } from './QrImage'
import { Card } from './ui'

/**
 * この大会をリンクか QR で渡すためのカード。
 *
 * 中身はリンクそのものに入っている（サーバーには置かない）ので、
 * 渡した相手はアプリを開くだけで受け取れる。
 */
export function ShareCard({ contest }: { contest: Contest }) {
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)

  useEffect(() => {
    let alive = true
    setCopied(false)
    void encodeShare(toSharePayload(contest)).then((token) => {
      if (alive) setUrl(buildShareUrl(window.location.origin, token))
    })
    return () => {
      alive = false
    }
  }, [contest])

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // クリップボードが使えない端末では、下の欄から手で選んでもらう
      setCopied(false)
    }
  }

  const send = async () => {
    if (!url) return
    try {
      await navigator.share({ title: contest.name, text: `${contest.name} の予定`, url })
    } catch {
      // 共有をやめただけのことが多いので、何も出さない
    }
  }

  return (
    <Card title="共有" label="SHARE">
      <p className="hint">
        大会の日程・会場・エントリー費・締切・ジャッジを、リンクか QR で渡せます。
        <strong>入金や音源の状況、振り返り、ジャッジへのメモは入りません。</strong>
      </p>

      {url === null ? (
        <p className="hint">用意しています…</p>
      ) : (
        <>
          <div className="btn-row">
            <button type="button" className="btn btn--primary" onClick={() => void copy()}>
              {copied ? 'コピーしました' : 'リンクをコピー'}
            </button>
            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button type="button" className="btn btn--ghost" onClick={() => void send()}>
                送る
              </button>
            )}
          </div>

          <button type="button" className="btn btn--ghost" onClick={() => setShowQr((value) => !value)}>
            {showQr ? 'QR を閉じる' : 'QR コードを出す'}
          </button>

          {showQr && (
            <div className="qr-plate">
              <QrImage text={url} label={`${contest.name} の共有 QR コード`} />
              <p className="hint">相手のカメラで読み取ってもらってください。</p>
            </div>
          )}

          <input className="input" readOnly value={url} onFocus={(event) => event.target.select()} />
        </>
      )}
    </Card>
  )
}
