import { useState } from 'react'
import type { ContestFilter } from '../lib/contest'

/**
 * 一覧の絞り込み。
 * ジャッジは複数選べて「選んだ誰かがいる大会」を出す（絞り込むほど広がる、タグと同じ挙動）。
 * 普段は畳んでおき、絞り込み中はその件数をボタンに出す。
 */
export function FilterBar({
  judges,
  filter,
  resultCount,
  onChange,
}: {
  judges: { name: string; count: number }[]
  filter: ContestFilter
  resultCount: number
  onChange: (filter: ContestFilter) => void
}) {
  const selected = filter.judges ?? []
  const [open, setOpen] = useState(selected.length > 0)

  const toggleJudge = (name: string) => {
    const next = selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name]
    onChange({ ...filter, judges: next })
  }

  const active = selected.length > 0 || Boolean(filter.finalRightOnly)

  return (
    <div className="filters">
      <div className="filters__row">
        <button
          type="button"
          className={`filter-btn ${selected.length > 0 ? 'is-active' : ''}`}
          aria-expanded={open}
          disabled={judges.length === 0}
          onClick={() => setOpen((prev) => !prev)}
        >
          🧑‍⚖️ ジャッジ
          {selected.length > 0 && <span className="filter-btn__count">{selected.length}</span>}
        </button>

        <button
          type="button"
          className={`filter-btn ${filter.finalRightOnly ? 'is-active' : ''}`}
          aria-pressed={Boolean(filter.finalRightOnly)}
          onClick={() => onChange({ ...filter, finalRightOnly: !filter.finalRightOnly })}
        >
          🔥 ファイナル権獲得
        </button>

        {active && (
          <button
            type="button"
            className="filter-btn filter-btn--clear"
            onClick={() => onChange({ ...filter, judges: [], finalRightOnly: false })}
          >
            クリア
          </button>
        )}
      </div>

      {open && judges.length > 0 && (
        <ul className="judge-chips">
          {judges.map((judge) => (
            <li key={judge.name}>
              <button
                type="button"
                className={`judge-chip ${selected.includes(judge.name) ? 'is-active' : ''}`}
                aria-pressed={selected.includes(judge.name)}
                onClick={() => toggleJudge(judge.name)}
              >
                {judge.name}
                <span className="judge-chip__count">{judge.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && <p className="filters__result">{resultCount} 件が該当</p>}
    </div>
  )
}
