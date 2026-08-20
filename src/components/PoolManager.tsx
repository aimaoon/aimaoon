import { useState } from 'react'
import { EMPTY_DRAFT, PoolForm, toDraft, type PoolDraft } from './PoolForm'
import { mergePools, parsePoolsJson, toPoolsJson } from '../lib/pools'
import { SAMPLE_POOLS } from '../data/samplePools'
import type { Pool } from '../types'

interface Props {
  pools: Pool[]
  onChange: (pools: Pool[]) => void
}

/** 登録済みプールの一覧・追加・編集・削除と、JSON での一括入出力 */
export function PoolManager({ pools, onChange }: Props) {
  const [draft, setDraft] = useState<PoolDraft>(EMPTY_DRAFT)
  const [importText, setImportText] = useState('')
  const [importMessage, setImportMessage] = useState<
    { kind: 'ok' | 'error'; text: string; details?: string[] } | null
  >(null)

  function savePool(pool: Pool) {
    const exists = pools.some((current) => current.id === pool.id)
    onChange(exists ? pools.map((current) => (current.id === pool.id ? pool : current)) : [...pools, pool])
    setDraft(EMPTY_DRAFT)
  }

  function removePool(pool: Pool) {
    if (!window.confirm(`「${pool.name}」を削除します。よろしいですか？`)) return
    onChange(pools.filter((current) => current.id !== pool.id))
    if (draft.id === pool.id) setDraft(EMPTY_DRAFT)
  }

  function runImport() {
    try {
      const { pools: imported, skipped } = parsePoolsJson(importText)
      onChange(mergePools(pools, imported))
      setImportText('')
      setImportMessage({
        kind: 'ok',
        text: `${imported.length} 件を取り込みました。${skipped.length > 0 ? `${skipped.length} 件は読み飛ばしました。` : ''}`,
        details: skipped,
      })
    } catch (cause) {
      setImportMessage({ kind: 'error', text: cause instanceof Error ? cause.message : '取り込みに失敗しました。' })
    }
  }

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(toPoolsJson(pools))
      setImportMessage({ kind: 'ok', text: '登録内容の JSON をクリップボードにコピーしました。' })
    } catch {
      setImportMessage({ kind: 'error', text: 'コピーできませんでした。下のテキストを手で選択してください。' })
    }
  }

  function restoreSamples() {
    if (!window.confirm('サンプルの施設を追加します（同じ ID のものは上書きされます）。よろしいですか？')) return
    onChange(mergePools(pools, SAMPLE_POOLS))
  }

  return (
    <div className="pool-manager">
      <section className="panel">
        <header className="result-header">
          <h2 className="section-title">登録済みの施設 {pools.length} 件</h2>
          <div className="header-actions">
            <button className="button ghost small" type="button" onClick={restoreSamples}>
              サンプルを追加
            </button>
            <button className="button ghost small" type="button" onClick={copyExport}>
              JSON をコピー
            </button>
          </div>
        </header>

        {pools.length === 0 ? (
          <p className="message">まだ登録がありません。右のフォームから追加してください。</p>
        ) : (
          <ul className="pool-list">
            {pools.map((pool) => (
              <li key={pool.id} className={`pool-row ${draft.id === pool.id ? 'editing' : ''}`}>
                <div className="pool-row-main">
                  <strong>{pool.name}</strong>
                  <span className="pool-row-address">{pool.address || '住所未登録'}</span>
                  <span className="coords">
                    {pool.location.lat.toFixed(4)}, {pool.location.lng.toFixed(4)}
                  </span>
                  {pool.tags.length > 0 && (
                    <ul className="tag-list">
                      {pool.tags.map((tag) => (
                        <li key={tag} className="tag">
                          {tag}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="pool-row-actions">
                  <button className="button ghost small" type="button" onClick={() => setDraft(toDraft(pool))}>
                    編集
                  </button>
                  <button className="button ghost small danger" type="button" onClick={() => removePool(pool)}>
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="pool-side">
        <section className="panel">
          <PoolForm
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={savePool}
            onCancel={() => setDraft(EMPTY_DRAFT)}
          />
        </section>

        <section className="panel">
          <h3 className="section-title">JSON で一括登録</h3>
          <p className="message">
            {'[{ "name": "○○プール", "address": "…", "lat": 35.68, "lng": 139.76, "tags": ["25m"] }]'} の形で貼り付けてください。
            同じ id のものは上書きします。
          </p>
          <textarea
            className="input mono"
            rows={6}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='[{ "name": "○○プール", "lat": 35.68, "lng": 139.76 }]'
          />
          <div className="form-actions">
            <button className="button primary" type="button" onClick={runImport} disabled={importText.trim() === ''}>
              取り込む
            </button>
          </div>
          {importMessage && (
            <div className={`message ${importMessage.kind === 'error' ? 'error' : 'ok'}`}>
              <p>{importMessage.text}</p>
              {importMessage.details && importMessage.details.length > 0 && (
                <ul className="skip-list">
                  {importMessage.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
