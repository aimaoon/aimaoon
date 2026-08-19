import type { SharePayload } from '../lib/share'
import { formatDateJa } from '../lib/date'
import { Card } from './ui'

const yen = (value: number) => `${value.toLocaleString('ja-JP')}円`

/**
 * 共有リンクから開いたときの確認画面。
 * 勝手に増やさず、何が入っているかを見せてから取り込んでもらう。
 */
export function ShareImport({
  payload,
  onImport,
  onCancel,
}: {
  payload: SharePayload
  onImport: () => void
  onCancel: () => void
}) {
  const [finalDate, finalStart, finalVenue] = payload.f ?? []

  return (
    <div className="detail">
      <header className="detail__bar">
        <span className="detail__bar-title">共有された大会</span>
      </header>

      <div className="view">
        <section className="hero hero--upcoming">
          <p className="hero__date">{formatDateJa(payload.d)}</p>
          <h1 className="hero__name">{payload.n}</h1>
          {payload.c && <p className="hero__category">{payload.c}</p>}
        </section>

        <Card title="入っている内容" label="CONTENTS">
          <dl className="kv">
            <div className="kv__row">
              <dt>開催日</dt>
              <dd>
                {formatDateJa(payload.d)}
                {payload.s && ` ${payload.s}`}
                {payload.e && `〜${payload.e}`}
              </dd>
            </div>
            {payload.p && (
              <div className="kv__row">
                <dt>会場</dt>
                <dd>
                  {payload.p[0]}
                  {payload.p[1] && <span className="kv__suffix">{payload.p[1]}</span>}
                </dd>
              </div>
            )}
            {payload.y !== undefined && (
              <div className="kv__row">
                <dt>エントリー費</dt>
                <dd>{yen(payload.y)}</dd>
              </div>
            )}
            {payload.yd && (
              <div className="kv__row">
                <dt>入金期限</dt>
                <dd>{formatDateJa(payload.yd)}</dd>
              </div>
            )}
            {payload.md && (
              <div className="kv__row">
                <dt>音源の提出期限</dt>
                <dd>{formatDateJa(payload.md)}</dd>
              </div>
            )}
            {(finalDate || finalVenue) && (
              <div className="kv__row">
                <dt>ファイナル</dt>
                <dd>
                  {finalDate ? formatDateJa(finalDate) : '日程未定'}
                  {finalStart && ` ${finalStart}`}
                  {finalVenue && <span className="kv__suffix">{finalVenue}</span>}
                </dd>
              </div>
            )}
            {payload.j && payload.j.length > 0 && (
              <div className="kv__row">
                <dt>ジャッジ</dt>
                <dd>{payload.j.map(([name]) => name).join('、')}</dd>
              </div>
            )}
          </dl>

          <p className="hint">
            取り込むと、あなたの一覧に 1 件増えます。入金や音源の状況は、ここから自分で付けていく形です。
          </p>
        </Card>

        <button type="button" className="btn btn--primary btn--block" onClick={onImport}>
          取り込む
        </button>
        <button type="button" className="btn btn--ghost btn--block" onClick={onCancel}>
          やめる
        </button>
      </div>
    </div>
  )
}
