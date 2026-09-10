import { TrophyIcon } from './icons'

/**
 * 初回だけ出す案内。
 * いきなりサンプルが並んでいると「誰かのデータ」に見えるので、
 * 何のアプリかを伝えたうえで、空から始めるかサンプルを見るかを選んでもらう。
 */
const POINTS = [
  { label: 'PAYMENT', title: '入金と音源の締切を落とさない', body: '期限が近いものはホームの先頭に出ます。' },
  { label: 'FINAL', title: '予選とファイナルを 1 つの大会として持つ', body: '日程が未発表でも権利だけ先に記録できます。' },
  { label: 'REVIEW', title: 'ジャッジと振り返りを次に活かす', body: '誰が審査したか、何が課題だったかを大会ごとに残せます。' },
]

export function Welcome({ onStart, onSample }: { onStart: () => void; onSample: () => void }) {
  return (
    <div className="detail">
      <div className="view welcome">
        <div className="welcome__head">
          <TrophyIcon active />
          <p className="eyebrow">STAGE NOTE</p>
          <h1 className="welcome__title">出る大会の準備を、1 か所に。</h1>
          <p className="welcome__lead">
            入金・音源・会場・ジャッジ・振り返りを大会ごとにまとめて、抜けが起きないようにする道具です。
          </p>
        </div>

        <ul className="welcome__points">
          {POINTS.map((point) => (
            <li key={point.label} className="welcome__point">
              <span className="eyebrow">{point.label}</span>
              <strong className="welcome__point-title">{point.title}</strong>
              <span className="welcome__point-body">{point.body}</span>
            </li>
          ))}
        </ul>

        <div className="welcome__actions">
          <button type="button" className="btn btn--primary btn--block" onClick={onStart}>
            最初の大会を登録する
          </button>
          <button type="button" className="btn btn--ghost btn--block" onClick={onSample}>
            サンプルで中身を見る
          </button>
        </div>

        <p className="hint">
          入力した内容はこの端末にだけ保存されます。サンプルは設定タブからいつでも消せます。
        </p>
      </div>
    </div>
  )
}
