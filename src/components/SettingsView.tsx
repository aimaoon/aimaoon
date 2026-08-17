import type { Contest } from '../types'
import { contestPhase, isMusicSettled, isPaymentSettled } from '../lib/contest'
import { downloadIcs } from '../lib/ics'
import { Card } from './ui'

/** 集計・データ管理。 */
export function SettingsView({
  contests,
  now,
  onLoadSample,
  onClear,
}: {
  contests: Contest[]
  now: Date
  onLoadSample: () => void
  onClear: () => void
}) {
  const upcoming = contests.filter((contest) => contestPhase(contest, now) !== 'past')
  const unpaid = upcoming.filter((contest) => !isPaymentSettled(contest))
  const unpaidTotal = unpaid.reduce(
    (sum, contest) => sum + Math.max(contest.entry.fee - (contest.entry.paidAmount ?? 0), 0),
    0,
  )
  const pendingMusic = upcoming.filter((contest) => !isMusicSettled(contest))
  const spent = contests
    .filter((contest) => isPaymentSettled(contest))
    .reduce((sum, contest) => sum + contest.entry.fee, 0)

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(contests, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'dance-contests.json'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="view">
      <Card title="サマリー" label="SUMMARY">
        <div className="stats">
          <div className="stat">
            <span className="stat__value">{upcoming.length}</span>
            <span className="stat__label">これからの大会</span>
          </div>
          <div className="stat">
            <span className="stat__value stat__value--warn">{unpaidTotal.toLocaleString('ja-JP')}</span>
            <span className="stat__label">未入金の合計（円）</span>
          </div>
          <div className="stat">
            <span className="stat__value">{pendingMusic.length}</span>
            <span className="stat__label">音源が未対応</span>
          </div>
          <div className="stat">
            <span className="stat__value">{spent.toLocaleString('ja-JP')}</span>
            <span className="stat__label">支払い済み合計（円）</span>
          </div>
        </div>
      </Card>

      <Card title="カレンダー連携" label="CALENDAR">
        <p className="hint">
          .ics を書き出して開くと、iPhone のカレンダーや Google カレンダーに、開催予定・締切・アラームごと取り込めます。
        </p>
        <button type="button" className="btn btn--primary" onClick={() => downloadIcs(contests)} disabled={contests.length === 0}>
          すべての予定を書き出す（.ics）
        </button>
      </Card>

      <Card title="データ" label="DATA">
        <p className="hint">データはこの端末のブラウザ（localStorage）にだけ保存されます。</p>
        <div className="btn-row">
          <button type="button" className="btn btn--ghost" onClick={exportJson} disabled={contests.length === 0}>
            JSON で書き出す
          </button>
          <button type="button" className="btn btn--ghost" onClick={onLoadSample}>
            サンプルを読み込む
          </button>
        </div>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            if (window.confirm('保存されているコンテストをすべて削除します。よろしいですか？')) onClear()
          }}
        >
          すべて削除
        </button>
      </Card>

      <Card title="Stage Note について" label="ABOUT">
        <p className="hint">
          ダンスコンテストごとの入金・音源提出・会場・ジャッジ・振り返りを 1 か所にまとめるアプリです。
          ホーム画面に追加すると、アプリのように全画面で使えます。
        </p>
      </Card>
    </div>
  )
}
