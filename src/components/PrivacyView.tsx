import privacy from '../content/privacy.json'
import { Card } from './ui'

/**
 * プライバシーポリシー。
 * 文面は src/content/privacy.json に置き、公開ページ（public/privacy.html）と
 * 同じ内容を使う（scripts/build-privacy.mjs で生成）。
 */
export function PrivacyView({ onClose }: { onClose: () => void }) {
  return (
    <div className="detail">
      <header className="detail__bar">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="戻る">
          ‹
        </button>
        <span className="detail__bar-title">PRIVACY</span>
        <span className="detail__bar-spacer" />
      </header>

      <div className="view">
        <Card title={privacy.title} label="PRIVACY">
          <p className="hint">最終更新 {privacy.updatedAt}</p>
          <p className="prose prose--lead">{privacy.summary}</p>
        </Card>

        {privacy.sections.map((section) => (
          <Card key={section.heading} title={section.heading}>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="prose">
                {paragraph}
              </p>
            ))}
          </Card>
        ))}
      </div>
    </div>
  )
}
