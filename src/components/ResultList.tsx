import { useState } from 'react'
import { formatDistance, formatMinutes, proximityOf } from '../lib/format'
import { directionsUrl } from '../lib/maps'
import { MODE_LABELS, isBeyondPracticalRange } from '../lib/travelTime'
import type { Origin, SearchResult } from '../types'

interface Props {
  origin: Origin
  results: SearchResult[]
  limitMinutes: number
}

function ResultCard({ origin, result, limitMinutes, rank }: {
  origin: Origin
  result: SearchResult
  limitMinutes: number
  rank?: number
}) {
  const { pool, estimate } = result
  const proximity = proximityOf(estimate.minutes, limitMinutes)

  return (
    <li className={`result ${proximity}`}>
      <div className="result-time">
        {rank !== undefined && <span className="rank">{rank}</span>}
        <strong>{formatMinutes(estimate.minutes)}</strong>
        <span className="sub">{MODE_LABELS[estimate.mode]}</span>
      </div>

      <div className="result-body">
        <h3 className="result-name">{pool.name}</h3>
        <p className="result-address">{pool.address}</p>
        {pool.tags.length > 0 && (
          <ul className="tag-list">
            {pool.tags.map((tag) => (
              <li key={tag} className="tag">
                {tag}
              </li>
            ))}
          </ul>
        )}
        {pool.note && <p className="result-note">{pool.note}</p>}
        <p className="result-meta">
          直線 {formatDistance(estimate.straightKm)} ／ 推定移動距離{' '}
          {formatDistance(estimate.routeKm)}
          {isBeyondPracticalRange(estimate) && (
            <span className="warn"> ※この手段では距離がありすぎます</span>
          )}
        </p>
        <div className="result-actions">
          <a
            className="button ghost small"
            href={directionsUrl(origin.location, pool.location, estimate.mode)}
            target="_blank"
            rel="noreferrer"
          >
            Google マップで経路を見る
          </a>
          {pool.url && (
            <a className="button ghost small" href={pool.url} target="_blank" rel="noreferrer">
              施設サイト
            </a>
          )}
          {pool.phone && <span className="result-phone">{pool.phone}</span>}
        </div>
      </div>
    </li>
  )
}

export function ResultList({ origin, results, limitMinutes }: Props) {
  const [showOutside, setShowOutside] = useState(false)

  const inside = results.filter((result) => result.withinLimit)
  const outside = results.filter((result) => !result.withinLimit)

  return (
    <section className="panel">
      <header className="result-header">
        <div>
          <h2 className="section-title">
            {formatMinutes(limitMinutes)}以内に行ける施設 {inside.length} 件
          </h2>
          <p className="origin-line">
            出発地: {origin.title ?? origin.address}
            {origin.title !== origin.address && (
              <span className="coords">
                （{origin.location.lat.toFixed(4)}, {origin.location.lng.toFixed(4)}）
              </span>
            )}
          </p>
        </div>
      </header>

      {inside.length === 0 ? (
        <p className="message">
          この条件で {formatMinutes(limitMinutes)}以内の施設はありませんでした。移動手段や上限時間を変えてみてください。
        </p>
      ) : (
        <ul className="result-list">
          {inside.map((result, index) => (
            <ResultCard
              key={result.pool.id}
              origin={origin}
              result={result}
              limitMinutes={limitMinutes}
              rank={index + 1}
            />
          ))}
        </ul>
      )}

      {outside.length > 0 && (
        <div className="outside">
          <button className="button ghost" type="button" onClick={() => setShowOutside(!showOutside)}>
            {showOutside ? '圏外の施設を隠す' : `圏外の施設も見る（${outside.length} 件）`}
          </button>
          {showOutside && (
            <ul className="result-list dim">
              {outside.map((result) => (
                <ResultCard
                  key={result.pool.id}
                  origin={origin}
                  result={result}
                  limitMinutes={limitMinutes}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
