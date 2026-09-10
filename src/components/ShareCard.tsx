import { useEffect, useRef, useState } from 'react'
import type { Contest } from '../types'
import { buildShareUrl, encodeShare, toSharePayload } from '../lib/share'
import { QrImage } from './QrImage'
import { Card } from './ui'

type CopyState = 'idle' | 'copied' | 'failed'

/** この端末に「送る」（OS の共有シート）があるか。iPhone なら LINE もここに出る。 */
function canSend(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/**
 * クリップボードへ写す。
 * navigator.clipboard は端末や設定によっては使えないので、
 * 昔ながらの選択＋コピーにも落ちる。それも駄目なら false を返して手で拾ってもらう。
 */
async function copyText(text: string, field: HTMLInputElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 下の手に進む
  }
  try {
    if (field) {
      field.removeAttribute('readonly')
      field.focus()
      field.setSelectionRange(0, text.length)
      const done = document.execCommand('copy')
      field.setAttribute('readonly', 'true')
      if (done) return true
    }
  } catch {
    // 手で拾ってもらう
  }
  return false
}

/**
 * この大会をリンクか QR で渡すためのカード。
 *
 * 中身はリンクそのものに入っている（サーバーには置かない）ので、
 * 渡した相手はアプリを開くだけで受け取れる。
 */
export function ShareCard({ contest }: { contest: Contest }) {
  const [url, setUrl] = useState<string | null>(null)
  const [copy, setCopy] = useState<CopyState>('idle')
  const [showQr, setShowQr] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let alive = true
    setCopy('idle')
    void encodeShare(toSharePayload(contest)).then((token) => {
      if (alive) setUrl(buildShareUrl(window.location.origin, token))
    })
    return () => {
      alive = false
    }
  }, [contest])

  const onCopy = async () => {
    if (!url) return
    const done = await copyText(url, field.current)
    setCopy(done ? 'copied' : 'failed')
    if (done) window.setTimeout(() => setCopy('idle'), 2500)
  }

  const onSend = async () => {
    if (!url) return
    try {
      await navigator.share({ title: contest.name, text: `${contest.name}`, url })
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
          {canSend() && (
            <button type="button" className="btn btn--primary" onClick={() => void onSend()}>
              送る（LINE・メールなど）
            </button>
          )}

          <button
            type="button"
            className={canSend() ? 'btn btn--ghost' : 'btn btn--primary'}
            onClick={() => void onCopy()}
          >
            {copy === 'copied' ? 'コピーしました' : 'リンクをコピー'}
          </button>

          <button type="button" className="btn btn--ghost" onClick={() => setShowQr((value) => !value)}>
            {showQr ? 'QR を閉じる' : 'QR コードを出す'}
          </button>

          {showQr && (
            <div className="qr-plate">
              <QrImage text={url} label={`${contest.name} の共有 QR コード`} />
              <p className="hint">相手のカメラで読み取ってもらってください。</p>
            </div>
          )}

          <div className="field">
            <span className="field__label">
              リンク
              <span className="field__hint">長押しして「すべてを選択」→「コピー」でも渡せます</span>
            </span>
            <input
              ref={field}
              className="input"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>

          {copy === 'failed' && (
            <p className="hint hint--warn">
              コピーできませんでした。上の「リンク」の欄を長押しして「コピー」を選んでください。
            </p>
          )}

          <p className="hint">
            リンクを開いた人は、確認画面で中身を見てから取り込みます。
            <strong>リンクを知っている人は誰でも中身を見られる</strong>ので、送る相手は選んでください。
          </p>
        </>
      )}
    </Card>
  )
}
