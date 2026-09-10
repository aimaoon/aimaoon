import { useState } from 'react'
import type { Judge } from '../types'
import { createJudge } from '../lib/factory'
import { Card, EmptyState } from './ui'

/**
 * ジャッジの一覧。
 * 「誰が審査するか」だけでなく「どこを見る人か」をメモできるようにしている。
 */
export function JudgePanel({ judges, onChange }: { judges: Judge[]; onChange: (judges: Judge[]) => void }) {
  const [name, setName] = useState('')
  const [genre, setGenre] = useState('')

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onChange([...judges, { ...createJudge(trimmed), genre: genre.trim() || undefined }])
    setName('')
    setGenre('')
  }

  const update = (id: string, patch: Partial<Judge>) => {
    onChange(judges.map((judge) => (judge.id === id ? { ...judge, ...patch } : judge)))
  }

  return (
    <Card title="ジャッジ" label="JUDGES">
      {judges.length === 0 ? (
        <EmptyState title="ジャッジ未登録" description="発表されたら追加しておくと対策メモを残せます" />
      ) : (
        <ul className="judge-list">
          {judges.map((judge) => (
            <li key={judge.id} className="judge">
              <div className="judge__head">
                <span className="judge__avatar">{judge.name.slice(0, 1) || '?'}</span>
                <div className="judge__id">
                  <strong className="judge__name">{judge.name}</strong>
                  {judge.genre && <span className="judge__genre">{judge.genre}</span>}
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${judge.name} を削除`}
                  onClick={() => onChange(judges.filter((item) => item.id !== judge.id))}
                >
                  ✕
                </button>
              </div>
              <textarea
                className="judge__note"
                rows={2}
                value={judge.note ?? ''}
                placeholder="見られるポイント、前回の反応など"
                onChange={(event) => update(judge.id, { note: event.target.value })}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="judge-add">
        <input
          className="input"
          value={name}
          placeholder="ジャッジ名"
          onChange={(event) => setName(event.target.value)}
        />
        <input
          className="input input--short"
          value={genre}
          placeholder="ジャンル"
          onChange={(event) => setGenre(event.target.value)}
        />
        <button type="button" className="btn btn--ghost" onClick={add} disabled={!name.trim()}>
          追加
        </button>
      </div>
    </Card>
  )
}
