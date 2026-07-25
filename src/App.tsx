import { useCallback, useMemo, useState } from 'react'
import { DomainSettings } from './components/DomainSettings'
import { ThreadDetail } from './components/ThreadDetail'
import { TreeView } from './components/TreeView'
import { DEFAULT_OUR_DOMAINS, OUR_COMPANY_NAME, SAMPLE_MESSAGES } from './data/sampleMessages'
import { useLocalStorage } from './hooks/useLocalStorage'
import { filterTree } from './lib/filter'
import { buildMailTree, type MailTree, type ThreadNode } from './lib/tree'

/** ツリー内のすべての開閉キー。検索中の自動展開に使う。 */
function allKeysOf(tree: MailTree): Set<string> {
  const keys = new Set<string>()
  for (const domain of tree.domains) {
    keys.add(`domain:${domain.domain}`)
    for (const contact of domain.contacts) keys.add(`contact:${contact.address}`)
  }
  return keys
}

/** 初期表示では、要対応を含むドメインとアドレスだけ開いておく。 */
function waitingKeysOf(tree: MailTree): Set<string> {
  const keys = new Set<string>()
  for (const domain of tree.domains) {
    if (domain.waitingCount === 0) continue
    keys.add(`domain:${domain.domain}`)
    for (const contact of domain.contacts) {
      if (contact.waitingCount > 0) keys.add(`contact:${contact.address}`)
    }
  }
  return keys
}

export default function App() {
  const [ourDomains, setOurDomains] = useLocalStorage<string[]>(
    'mail-tree:our-domains',
    DEFAULT_OUR_DOMAINS,
  )
  const [query, setQuery] = useState('')
  const [onlyWaiting, setOnlyWaiting] = useState(false)
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)

  const tree = useMemo(() => buildMailTree(SAMPLE_MESSAGES, ourDomains), [ourDomains])
  const filtered = useMemo(
    () => filterTree(tree, { query, onlyWaiting }),
    [tree, query, onlyWaiting],
  )

  const [manualExpanded, setManualExpanded] = useState<Set<string>>(() => waitingKeysOf(tree))
  const searching = query.trim() !== '' || onlyWaiting
  const expandedKeys = useMemo(
    () => (searching ? allKeysOf(filtered) : manualExpanded),
    [searching, filtered, manualExpanded],
  )

  const toggle = useCallback((key: string) => {
    setManualExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const selectedThread: ThreadNode | null = useMemo(() => {
    if (!selectedThreadId) return null
    for (const domain of tree.domains) {
      for (const contact of domain.contacts) {
        const found = contact.threads.find((thread) => thread.threadId === selectedThreadId)
        if (found) return found
      }
    }
    return null
  }, [tree, selectedThreadId])

  const { waitingCount, answeredCount, threadCount } = tree.summary
  const answeredRate = threadCount === 0 ? 0 : Math.round((answeredCount / threadCount) * 100)

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1 className="app__title">メール対応ツリー管理</h1>
          <p className="app__subtitle">
            {OUR_COMPANY_NAME} ／ お客様ごとに「自社の誰かが最後に返せているか」を確認できます
          </p>
        </div>

        <div className="stats">
          <div className="stat stat--waiting">
            <span className="stat__value">{waitingCount}</span>
            <span className="stat__label">要対応</span>
          </div>
          <div className="stat stat--answered">
            <span className="stat__value">{answeredCount}</span>
            <span className="stat__label">対応済み</span>
          </div>
          <div className="stat">
            <span className="stat__value">{answeredRate}%</span>
            <span className="stat__label">対応率</span>
          </div>
        </div>
      </header>

      <DomainSettings ourDomains={ourDomains} onChange={setOurDomains} />

      {ourDomains.length === 0 ? (
        <p className="warning">
          自社ドメインが未設定のため、すべてのスレッドが「要対応」と判定されています。
        </p>
      ) : null}

      <div className="toolbar">
        <input
          type="search"
          className="toolbar__search"
          value={query}
          placeholder="件名・本文・アドレス・氏名で検索"
          onChange={(event) => setQuery(event.target.value)}
          aria-label="検索"
        />
        <label className="toolbar__toggle">
          <input
            type="checkbox"
            checked={onlyWaiting}
            onChange={(event) => setOnlyWaiting(event.target.checked)}
          />
          要対応のみ表示
        </label>
        <div className="toolbar__spacer" />
        <button type="button" onClick={() => setManualExpanded(allKeysOf(tree))} disabled={searching}>
          すべて展開
        </button>
        <button type="button" onClick={() => setManualExpanded(new Set())} disabled={searching}>
          すべて閉じる
        </button>
      </div>

      <main className="layout">
        <section className="panel panel--tree" aria-label="お客様ツリー">
          <div className="panel__head">
            <span>
              {filtered.summary.domainCount}ドメイン ／ {filtered.summary.contactCount}アドレス ／{' '}
              {filtered.summary.threadCount}スレッド
            </span>
          </div>
          <TreeView
            tree={filtered}
            expandedKeys={expandedKeys}
            onToggle={toggle}
            selectedThreadId={selectedThreadId}
            onSelectThread={(thread) => setSelectedThreadId(thread.threadId)}
          />
        </section>

        <section className="panel panel--detail" aria-label="スレッド詳細">
          <ThreadDetail thread={selectedThread} ourDomains={ourDomains} />
        </section>
      </main>
    </div>
  )
}
