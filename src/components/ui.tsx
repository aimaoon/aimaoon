import type { ReactNode } from 'react'
import type { PreparationTask } from '../types'

export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'accent' | 'final'

/** 状態を表す小さなバッジ。色の点＋短い語で、埋めすぎないようにしている。 */
export function Chip({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: Tone
  /** 渡すと、頭の点の代わりにこの印を出す（ファイナル権のトロフィーなど）。 */
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <span className={`chip chip--${tone} ${icon ? 'chip--mark' : ''}`}>
      {icon}
      {children}
    </span>
  )
}

/**
 * 詳細画面のセクション。
 * 見出しは和文＋欧文のラベルの 2 段構え（フライヤーの版面ラベルのつもり）。
 */
export function Card({
  title,
  label,
  action,
  variant,
  children,
}: {
  title?: string
  label?: string
  action?: ReactNode
  variant?: 'final'
  children: ReactNode
}) {
  return (
    <section className={`card ${variant ? `card--${variant}` : ''}`}>
      {title && (
        <header className="card__head">
          <h2 className="card__title">
            {title}
            {label && <span className="eyebrow">{label}</span>}
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

/**
 * 準備の進み具合。1 本＝1 項目で、済んだものは白、期限が近い／過ぎたものは色が付く。
 * 割合のバーより「何が残っているか」が見えるようにしている。
 */
export function Segments({ tasks }: { tasks: PreparationTask[] }) {
  return (
    <div className="segments" role="presentation">
      {tasks.map((task) => (
        <i
          key={task.kind}
          className={`segments__bar ${task.done ? 'is-done' : task.urgency !== 'none' ? `is-${task.urgency}` : ''}`}
        />
      ))}
    </div>
  )
}

/** 一覧が空のとき。 */
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {description && <p className="empty__desc">{description}</p>}
    </div>
  )
}

/** 「まだ入力されていない」ことを示す表示。 */
export function Blank({ children = '未設定' }: { children?: ReactNode }) {
  return <span className="blank">{children}</span>
}
