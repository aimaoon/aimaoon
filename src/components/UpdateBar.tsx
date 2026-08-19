import type { UpdateState } from '../hooks/useUpdateCheck'

/**
 * 新しい版が配信されているときだけ出る帯。
 * アプリを消して入れ直さなくても最新にできる、と分かることが役目なので、
 * 文言は「何が起きるか」だけにして、押す先はひとつにしている。
 */
export function UpdateBar({ update }: { update: UpdateState }) {
  if (!update.available) return null

  return (
    <div className="update-bar" role="status">
      <div className="update-bar__text">
        <span className="eyebrow">UPDATE</span>
        <span className="update-bar__title">
          新しい版があります{update.version && `（${update.version}）`}
        </span>
      </div>
      <button type="button" className="btn btn--primary btn--sm" onClick={() => void update.apply()}>
        更新する
      </button>
      <button type="button" className="icon-btn" aria-label="あとで" onClick={update.dismiss}>
        ✕
      </button>
    </div>
  )
}
