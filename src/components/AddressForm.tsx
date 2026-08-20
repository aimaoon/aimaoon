import { useState, type FormEvent } from 'react'
import { GeocodeError, geocodeAddress, type GeocodeCandidate } from '../lib/geocode'
import type { Origin } from '../types'

interface Props {
  onResolved: (origin: Origin) => void
}

/** お客様の住所を受け取り、緯度経度に変換して親に渡す */
export function AddressForm({ onResolved }: Props) {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading'>('idle')
  const [error, setError] = useState<string | null>(null)

  function select(candidate: GeocodeCandidate) {
    setCandidates(null)
    onResolved({ address: query.trim(), title: candidate.title, location: candidate.location })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (query.trim() === '') return

    setStatus('loading')
    setError(null)
    setCandidates(null)

    try {
      const results = await geocodeAddress(query)
      if (results.length === 0) {
        setError('住所が見つかりませんでした。市区町村までなど、少し大まかにして試してください。')
      } else if (results.length === 1) {
        select(results[0])
      } else {
        setCandidates(results)
      }
    } catch (cause) {
      setError(cause instanceof GeocodeError ? cause.message : '住所の変換に失敗しました。')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <section className="panel">
      <form className="address-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">お客様の住所</span>
          <input
            className="input input-lg"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例: 東京都渋谷区神南1-1-1 / 35.6581, 139.7017"
            autoComplete="off"
          />
        </label>
        <button className="button primary" type="submit" disabled={status === 'loading'}>
          {status === 'loading' ? '検索中…' : '検索'}
        </button>
      </form>

      {error && <p className="message error">{error}</p>}

      {candidates && (
        <div className="candidates">
          <p className="message">候補が複数見つかりました。どれか選んでください。</p>
          <ul className="candidate-list">
            {candidates.slice(0, 10).map((candidate) => (
              <li key={`${candidate.title}-${candidate.location.lat}-${candidate.location.lng}`}>
                <button className="button ghost block" type="button" onClick={() => select(candidate)}>
                  {candidate.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
