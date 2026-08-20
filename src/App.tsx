import { useEffect, useMemo, useState } from 'react'
import { AddressForm } from './components/AddressForm'
import { PoolManager } from './components/PoolManager'
import { ResultList } from './components/ResultList'
import { SearchControls } from './components/SearchControls'
import { useLocalStorage } from './hooks/useLocalStorage'
import { collectTags, filterPools, searchPools } from './lib/search'
import { localEstimateProvider } from './lib/travelTime'
import { SAMPLE_POOLS } from './data/samplePools'
import type { Origin, Pool, SearchResult, TravelMode } from './types'

type Tab = 'search' | 'pools'

export default function App() {
  const [pools, setPools] = useLocalStorage<Pool[]>('pool-finder:pools', SAMPLE_POOLS)
  const [mode, setMode] = useLocalStorage<TravelMode>('pool-finder:mode', 'car')
  const [limitMinutes, setLimitMinutes] = useLocalStorage<number>('pool-finder:limit', 60)

  const [tab, setTab] = useState<Tab>('search')
  const [origin, setOrigin] = useState<Origin | null>(null)
  const [keyword, setKeyword] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [results, setResults] = useState<SearchResult[]>([])

  const availableTags = useMemo(() => collectTags(pools), [pools])

  const targetPools = useMemo(
    () => filterPools(pools, { keyword, tags: selectedTags }),
    [pools, keyword, selectedTags],
  )

  // 出発地・移動手段・上限・対象施設のどれかが変われば、その場で計算し直す
  useEffect(() => {
    if (!origin) {
      setResults([])
      return
    }

    let cancelled = false
    searchPools({
      pools: targetPools,
      origin: origin.location,
      mode,
      limitMinutes,
      provider: localEstimateProvider,
    }).then((next) => {
      if (!cancelled) setResults(next)
    })

    return () => {
      cancelled = true
    }
  }, [origin, targetPools, mode, limitMinutes])

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag],
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-title">プール圏内検索</h1>
          <p className="app-subtitle">
            登録しておいた施設の中から、お客様の住所から{' '}
            {limitMinutes >= 60 ? `${limitMinutes / 60}時間` : `${limitMinutes}分`}以内で行けるところを出します。
          </p>
        </div>
        <nav className="tabs">
          <button
            type="button"
            className={`tab ${tab === 'search' ? 'selected' : ''}`}
            onClick={() => setTab('search')}
          >
            検索
          </button>
          <button
            type="button"
            className={`tab ${tab === 'pools' ? 'selected' : ''}`}
            onClick={() => setTab('pools')}
          >
            プール登録（{pools.length}）
          </button>
        </nav>
      </header>

      {tab === 'search' ? (
        <main className="stack">
          <AddressForm onResolved={setOrigin} />

          <SearchControls
            mode={mode}
            onModeChange={setMode}
            limitMinutes={limitMinutes}
            onLimitChange={setLimitMinutes}
            keyword={keyword}
            onKeywordChange={setKeyword}
            availableTags={availableTags}
            selectedTags={selectedTags}
            onToggleTag={toggleTag}
          />

          {origin ? (
            <ResultList origin={origin} results={results} limitMinutes={limitMinutes} />
          ) : (
            <section className="panel">
              <p className="message">
                お客様の住所を入れると、登録済みの {pools.length} 件から近い順に並べます。
                施設の追加・編集は「プール登録」タブから行えます。
              </p>
            </section>
          )}

          <footer className="note">
            所要時間は直線距離と移動手段ごとの平均速度からの<strong>概算</strong>です（渋滞・ダイヤは見ていません）。
            正確な経路は各施設の「Google マップで経路を見る」から確認してください。
          </footer>
        </main>
      ) : (
        <main>
          <PoolManager pools={pools} onChange={setPools} />
        </main>
      )}
    </div>
  )
}
