import { useEffect, useMemo, useState } from 'react'
import type { Contest } from './types'
import { buildSampleContests } from './data/sampleContests'
import { contestPhase, preparationOf } from './lib/contest'
import { createContest, normalizeContest } from './lib/factory'
import { useLocalStorage } from './hooks/useLocalStorage'
import { BottomNav, type Tab } from './components/BottomNav'
import { CalendarView } from './components/CalendarView'
import { ContestDetail } from './components/ContestDetail'
import { ContestForm } from './components/ContestForm'
import { HomeView } from './components/HomeView'
import { ReminderView } from './components/ReminderView'
import { SettingsView } from './components/SettingsView'

const STORAGE_KEY = 'stage-note:contests:v1'

const TAB_TITLES: Record<Tab, string> = {
  home: 'コンテスト',
  calendar: 'カレンダー',
  reminder: 'リマインダー',
  settings: '設定',
}

/** 全画面で開く子画面。 */
type Screen = { kind: 'list' } | { kind: 'detail'; id: string } | { kind: 'form'; draft: Contest; isNew: boolean }

export default function App() {
  const [stored, setStored] = useLocalStorage<Contest[]>(STORAGE_KEY, () => buildSampleContests())
  const contests = useMemo(() => stored.map(normalizeContest), [stored])

  const [tab, setTab] = useState<Tab>('home')
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })

  // 「あと何日」の表示が日付をまたいでもズレないように、1 分ごとに現在時刻を取り直す。
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // 画面を切り替えたら先頭から見せる（前の画面のスクロール位置が残らないように）。
  const screenKey =
    screen.kind === 'detail' ? `detail:${screen.id}` : screen.kind === 'form' ? `form:${screen.draft.id}` : `list:${tab}`
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screenKey])

  const alertCount = useMemo(
    () =>
      contests
        .filter((contest) => contestPhase(contest, now) !== 'past')
        .reduce((sum, contest) => sum + preparationOf(contest, now).alerts.length, 0),
    [contests, now],
  )

  const openDetail = (id: string) => setScreen({ kind: 'detail', id })
  const backToList = () => setScreen({ kind: 'list' })

  const upsert = (contest: Contest) => {
    setStored((prev) => {
      const exists = prev.some((item) => item.id === contest.id)
      return exists ? prev.map((item) => (item.id === contest.id ? contest : item)) : [...prev, contest]
    })
  }

  const remove = (id: string) => {
    setStored((prev) => prev.filter((item) => item.id !== id))
    backToList()
  }

  if (screen.kind === 'form') {
    return (
      <ContestForm
        initial={screen.draft}
        isNew={screen.isNew}
        onCancel={() => (screen.isNew ? backToList() : openDetail(screen.draft.id))}
        onSave={(contest) => {
          upsert(contest)
          openDetail(contest.id)
        }}
      />
    )
  }

  if (screen.kind === 'detail') {
    const contest = contests.find((item) => item.id === screen.id)
    if (!contest) return <ContestNotFound onBack={backToList} />
    return (
      <ContestDetail
        contest={contest}
        now={now}
        onChange={upsert}
        onEdit={() => setScreen({ kind: 'form', draft: contest, isNew: false })}
        onDelete={() => {
          if (window.confirm(`「${contest.name}」を削除します。よろしいですか？`)) remove(contest.id)
        }}
        onClose={backToList}
      />
    )
  }

  return (
    <div className="app">
      <header className="appbar">
        <h1 className="appbar__title">{TAB_TITLES[tab]}</h1>
        <span className="appbar__brand">Stage Note</span>
      </header>

      <main className="app__main">
        {tab === 'home' && <HomeView contests={contests} now={now} onOpen={openDetail} />}
        {tab === 'calendar' && <CalendarView contests={contests} now={now} onOpen={openDetail} />}
        {tab === 'reminder' && <ReminderView contests={contests} now={now} onOpen={openDetail} />}
        {tab === 'settings' && (
          <SettingsView
            contests={contests}
            now={now}
            onLoadSample={() => setStored(buildSampleContests())}
            onClear={() => setStored([])}
          />
        )}
      </main>

      {(tab === 'home' || tab === 'calendar') && (
        <button
          type="button"
          className="fab"
          aria-label="コンテストを追加"
          onClick={() => setScreen({ kind: 'form', draft: createContest(now), isNew: true })}
        >
          ＋
        </button>
      )}

      <BottomNav current={tab} badge={alertCount} onChange={setTab} />
    </div>
  )
}

function ContestNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="view">
      <p className="hint">このコンテストは見つかりませんでした。</p>
      <button type="button" className="btn btn--primary" onClick={onBack}>
        一覧に戻る
      </button>
    </div>
  )
}
