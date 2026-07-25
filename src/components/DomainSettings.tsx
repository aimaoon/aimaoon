import { useState } from 'react'
import { normalizeDomain } from '../lib/address'

interface Props {
  ourDomains: string[]
  onChange: (domains: string[]) => void
}

/** 「自社の共通ドメイン」を編集するパネル。判定の基準になる設定。 */
export function DomainSettings({ ourDomains, onChange }: Props) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const domain = normalizeDomain(draft)
    if (!domain) {
      setError('ドメインを入力してください')
      return
    }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      setError('ドメインの形式が正しくありません（例: example.co.jp）')
      return
    }
    if (ourDomains.some((existing) => normalizeDomain(existing) === domain)) {
      setError('すでに登録されています')
      return
    }
    onChange([...ourDomains, domain])
    setDraft('')
    setError(null)
  }

  const remove = (domain: string) => {
    onChange(ourDomains.filter((existing) => existing !== domain))
  }

  return (
    <section className="settings">
      <div className="settings__head">
        <h2 className="settings__title">自社の共通ドメイン</h2>
        <p className="settings__hint">
          ここに登録したドメイン（サブドメインを含む）から送られたメールを「自社からの対応」として判定します。
        </p>
      </div>

      <ul className="chips">
        {ourDomains.map((domain) => (
          <li key={domain} className="chip">
            @{domain}
            <button
              type="button"
              className="chip__remove"
              onClick={() => remove(domain)}
              aria-label={`${domain} を削除`}
            >
              ×
            </button>
          </li>
        ))}
        {ourDomains.length === 0 ? (
          <li className="chips__empty">未設定（すべてのメールが社外扱いになります）</li>
        ) : null}
      </ul>

      <form
        className="settings__form"
        onSubmit={(event) => {
          event.preventDefault()
          add()
        }}
      >
        <input
          type="text"
          value={draft}
          placeholder="example.co.jp"
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
          aria-label="追加する自社ドメイン"
        />
        <button type="submit">追加</button>
      </form>
      {error ? <p className="settings__error">{error}</p> : null}
    </section>
  )
}
