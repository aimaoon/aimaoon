import type { ReactNode } from 'react'

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'

/** 状態を表す小さなバッジ。 */
export function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`chip chip--${tone}`}>{children}</span>
}

/** 詳細画面のセクション。見出しの右に操作を置ける。 */
export function Card({
  title,
  icon,
  action,
  children,
}: {
  title?: string
  icon?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card">
      {title && (
        <header className="card__head">
          <h2 className="card__title">
            {icon && <span className="card__icon">{icon}</span>}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/** 入力 1 つぶん（ラベル + 中身）。 */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">
        {label}
        {hint && <span className="field__hint">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

/** 準備の進み具合。 */
export function ProgressBar({ ratio, tone = 'accent' }: { ratio: number; tone?: Tone }) {
  return (
    <div className="progress" role="presentation">
      <div className={`progress__fill progress__fill--${tone}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  )
}

/** 一覧が空のとき。 */
export function EmptyState({ icon, title, description }: { icon: string; title: string; description?: string }) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <p className="empty__title">{title}</p>
      {description && <p className="empty__desc">{description}</p>}
    </div>
  )
}

/** 「まだ入力されていない」ことを示す表示。 */
export function Blank({ children = '未設定' }: { children?: ReactNode }) {
  return <span className="blank">{children}</span>
}
