import { useState, type FormEvent } from 'react'
import { GeocodeError, geocodeAddress, type GeocodeCandidate } from '../lib/geocode'
import { isValidLatLng } from '../lib/geo'
import { createPoolId, formatTags, parseTags } from '../lib/pools'
import type { Pool } from '../types'

export interface PoolDraft {
  id: string | null
  name: string
  address: string
  lat: string
  lng: string
  tags: string
  note: string
  url: string
  phone: string
}

export const EMPTY_DRAFT: PoolDraft = {
  id: null,
  name: '',
  address: '',
  lat: '',
  lng: '',
  tags: '',
  note: '',
  url: '',
  phone: '',
}

export function toDraft(pool: Pool): PoolDraft {
  return {
    id: pool.id,
    name: pool.name,
    address: pool.address,
    lat: String(pool.location.lat),
    lng: String(pool.location.lng),
    tags: formatTags(pool.tags),
    note: pool.note ?? '',
    url: pool.url ?? '',
    phone: pool.phone ?? '',
  }
}

interface Props {
  draft: PoolDraft
  onDraftChange: (draft: PoolDraft) => void
  onSubmit: (pool: Pool) => void
  onCancel: () => void
}

/** プールの新規登録・編集フォーム。住所から座標を引ける。 */
export function PoolForm({ draft, onDraftChange, onSubmit, onCancel }: Props) {
  const [lookupState, setLookupState] = useState<'idle' | 'loading'>('idle')
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const update = (patch: Partial<PoolDraft>) => onDraftChange({ ...draft, ...patch })

  function applyCandidate(candidate: GeocodeCandidate) {
    setCandidates(null)
    update({
      lat: candidate.location.lat.toFixed(6),
      lng: candidate.location.lng.toFixed(6),
      address: draft.address.trim() === '' ? candidate.title : draft.address,
    })
  }

  async function lookupAddress() {
    if (draft.address.trim() === '') {
      setError('先に住所を入力してください。')
      return
    }

    setLookupState('loading')
    setError(null)
    setCandidates(null)

    try {
      const results = await geocodeAddress(draft.address)
      if (results.length === 0) {
        setError('住所が見つかりませんでした。緯度経度を直接入力することもできます。')
      } else if (results.length === 1) {
        applyCandidate(results[0])
      } else {
        setCandidates(results.slice(0, 10))
      }
    } catch (cause) {
      setError(cause instanceof GeocodeError ? cause.message : '住所の変換に失敗しました。')
    } finally {
      setLookupState('idle')
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const name = draft.name.trim()
    if (name === '') {
      setError('施設名は必須です。')
      return
    }

    const location = { lat: Number(draft.lat), lng: Number(draft.lng) }
    if (!isValidLatLng(location)) {
      setError('緯度経度が未設定です。「住所から座標を取得」を押すか、直接入力してください。')
      return
    }

    setError(null)
    onSubmit({
      id: draft.id ?? createPoolId(),
      name,
      address: draft.address.trim(),
      location,
      tags: parseTags(draft.tags),
      note: draft.note.trim() || undefined,
      url: draft.url.trim() || undefined,
      phone: draft.phone.trim() || undefined,
    })
  }

  return (
    <form className="pool-form" onSubmit={handleSubmit}>
      <h3 className="section-title">{draft.id ? '施設を編集' : '施設を新規登録'}</h3>

      <label className="field">
        <span className="field-label">施設名 *</span>
        <input
          className="input"
          value={draft.name}
          onChange={(event) => update({ name: event.target.value })}
          placeholder="○○市民プール"
        />
      </label>

      <label className="field">
        <span className="field-label">住所</span>
        <div className="field-row">
          <input
            className="input"
            value={draft.address}
            onChange={(event) => update({ address: event.target.value })}
            placeholder="東京都○○区○○1-2-3"
          />
          <button className="button" type="button" onClick={lookupAddress} disabled={lookupState === 'loading'}>
            {lookupState === 'loading' ? '取得中…' : '住所から座標を取得'}
          </button>
        </div>
      </label>

      {candidates && (
        <ul className="candidate-list">
          {candidates.map((candidate) => (
            <li key={`${candidate.title}-${candidate.location.lat}`}>
              <button className="button ghost block" type="button" onClick={() => applyCandidate(candidate)}>
                {candidate.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="field-grid">
        <label className="field">
          <span className="field-label">緯度 *</span>
          <input
            className="input"
            value={draft.lat}
            onChange={(event) => update({ lat: event.target.value })}
            placeholder="35.681200"
            inputMode="decimal"
          />
        </label>
        <label className="field">
          <span className="field-label">経度 *</span>
          <input
            className="input"
            value={draft.lng}
            onChange={(event) => update({ lng: event.target.value })}
            placeholder="139.767100"
            inputMode="decimal"
          />
        </label>
      </div>

      <label className="field">
        <span className="field-label">タグ</span>
        <input
          className="input"
          value={draft.tags}
          onChange={(event) => update({ tags: event.target.value })}
          placeholder="25m, 屋内, 温水, キッズ"
        />
      </label>

      <label className="field">
        <span className="field-label">メモ（営業時間・料金など）</span>
        <textarea
          className="input"
          rows={2}
          value={draft.note}
          onChange={(event) => update({ note: event.target.value })}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span className="field-label">URL</span>
          <input
            className="input"
            value={draft.url}
            onChange={(event) => update({ url: event.target.value })}
            placeholder="https://"
          />
        </label>
        <label className="field">
          <span className="field-label">電話番号</span>
          <input
            className="input"
            value={draft.phone}
            onChange={(event) => update({ phone: event.target.value })}
          />
        </label>
      </div>

      {error && <p className="message error">{error}</p>}

      <div className="form-actions">
        <button className="button primary" type="submit">
          {draft.id ? '更新する' : '登録する'}
        </button>
        <button className="button ghost" type="button" onClick={onCancel}>
          {draft.id ? '編集をやめる' : '入力を消す'}
        </button>
      </div>
    </form>
  )
}
