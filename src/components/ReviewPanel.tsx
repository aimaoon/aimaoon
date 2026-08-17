import type { Review } from '../types'
import { Card } from './ui'

const RATINGS = [1, 2, 3, 4, 5]

const NOTES: { key: 'good' | 'improve' | 'next'; label: string; placeholder: string }[] = [
  { key: 'good', label: 'よかったこと', placeholder: '通用した動き、うまくいった準備' },
  { key: 'improve', label: '課題', placeholder: '崩れたところ、足りなかった準備' },
  { key: 'next', label: '次にやること', placeholder: '次の大会までに練習すること' },
]

/**
 * 振り返りメモ。イベントが終わってから書く前提で、
 * 「結果 → よかった → 課題 → 次」の順に並べている。
 */
export function ReviewPanel({
  review,
  isPast,
  onChange,
}: {
  review: Review | undefined
  isPast: boolean
  onChange: (review: Review) => void
}) {
  const value = review ?? {}
  const patch = (next: Partial<Review>) => onChange({ ...value, ...next, updatedAt: new Date().toISOString() })

  return (
    <Card title="振り返り" label="REVIEW">
      {!isPast && <p className="hint">開催後に書き込めます（今のうちに目標を書いておいてもかまいません）。</p>}

      <div className="rating" role="group" aria-label="自己評価">
        {RATINGS.map((star) => (
          <button
            key={star}
            type="button"
            className={`rating__star ${(value.rating ?? 0) >= star ? 'is-on' : ''}`}
            aria-label={`${star} / 5`}
            aria-pressed={(value.rating ?? 0) >= star}
            onClick={() => patch({ rating: value.rating === star ? undefined : star })}
          >
            ★
          </button>
        ))}
        <input
          className="input input--short"
          value={value.result ?? ''}
          placeholder="結果（優勝／ベスト8 など）"
          onChange={(event) => patch({ result: event.target.value })}
        />
      </div>

      {NOTES.map((note) => (
        <label key={note.key} className="field">
          <span className="field__label">{note.label}</span>
          <textarea
            className="textarea"
            rows={3}
            value={value[note.key] ?? ''}
            placeholder={note.placeholder}
            onChange={(event) => patch({ [note.key]: event.target.value })}
          />
        </label>
      ))}
    </Card>
  )
}
