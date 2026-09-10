import { useEffect, useMemo, useState } from 'react'
import type { Contest } from './types'
import { buildSampleContests } from './data/sampleContests'
import { contestPhase, preparationOf } from './lib/contest'
import { formatDateJa, parseDateKey, toDateKey } from './lib/date'
import { createContest, normalizeContest } from './lib/factory'
import { contestFromShare, decodeShare, readShareToken, type SharePayload } from './lib/share'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useTheme } from './hooks/useTheme'
import { useUpdateCheck } from './hooks/useUpdateCheck'
import { BottomNav, type Tab } from './components/BottomNav'
import { CalendarView } from './components/CalendarView'
import { ContestDetail } from './components/ContestDetail'
import { ContestForm } from './components/ContestForm'
import { HomeView } from './components/HomeView'
import { PrivacyView } from './components/PrivacyView'
import { ReminderView } from './components/ReminderView'
import { SettingsView } from './components/SettingsView'
import { ShareImport } from './components/ShareImport'
import { UpdateBar } from './components/UpdateBar'
import { Welcome } from './components/Welcome'

const STORAGE_KEY = 'stage-note:contests:v1'
const ONBOARDED_KEY = 'stage-note:onboarded:v1'
const BACKUP_KEY = 'stage-note:last-backup:v1'

/** 取り込んだあと、同じリンクで開き直しても二重に出ないように住所から落とす。 */
function clearShareHash(): void {
  const { pathname, search } = window.location
  window.history.replaceState(null, '', `${pathname}${search}`)
}

const TAB_TITLES: Record<Tab, string> = {
  home: 'コンテスト',
  calendar: 'カレンダー',
  reminder: 'リマインダー',
  settings: '設定',
}

/** 全画面で開く子画面。 */
type Screen =
  | { kind: 'list' }
  | { kind: 'detail'; id: string }
  | { kind: 'form'; draft: Contest; isNew: boolean }
  | { kind: 'privacy' }

export default function App() {
  // 初回は空で始める。サンプルを入れるかどうかは案内画面で選んでもらう。
  const [stored, setStored] = useLocalStorage<Contest[]>(STORAGE_KEY, [])
  const contests = useMemo(() => stored.map(normalizeContest), [stored])

  const [onboarded, setOnboarded] = useLocalStorage<boolean>(ONBOARDED_KEY, false)
  const [lastBackupAt, setLastBackupAt] = useLocalStorage<string | null>(BACKUP_KEY, null)

  const { preference: theme, setPreference: setTheme } = useTheme()
  const update = useUpdateCheck(__APP_VERSION__)
  const [tab, setTab] = useState<Tab>('home')
  // カレンダーで選んでいる日。＋ ボタンはこの日で新規追加する。
  // null のあいだは「今日」に追従させたいので、そのつど組み立てる。
  const [pickedDay, setPickedDay] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>({ kind: 'list' })

  // 共有リンク（#c=...）で開かれたとき。勝手に足さず、確認画面を挟む。
  const [incoming, setIncoming] = useState<SharePayload | null>(null)
  useEffect(() => {
    const token = readShareToken(window.location.hash)
    if (!token) return
    let alive = true
    void decodeShare(token).then((payload) => {
      if (alive && payload) setIncoming(payload)
      clearShareHash()
    })
    return () => {
      alive = false
    }
  }, [])

  // 「あと何日」の表示が日付をまたいでもズレないように、1 分ごとに現在時刻を取り直す。
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  // 画面を切り替えたら先頭から見せる（前の画面のスクロール位置が残らないように）。
  const screenKey =
    screen.kind === 'detail'
      ? `detail:${screen.id}`
      : screen.kind === 'form'
        ? `form:${screen.draft.id}`
        : screen.kind === 'privacy'
          ? 'privacy'
          : `list:${tab}`
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

  const selectedDay = pickedDay ?? toDateKey(now)

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

  // 共有された大会は、初回の案内より先に出す（リンクで来た人を案内で止めない）。
  if (incoming) {
    return (
      <ShareImport
        payload={incoming}
        onImport={() => {
          upsert(contestFromShare(incoming, now))
          setOnboarded(true)
          setIncoming(null)
          setTab('home')
        }}
        onCancel={() => setIncoming(null)}
      />
    )
  }

  if (!onboarded) {
    return (
      <Welcome
        onStart={() => {
          setOnboarded(true)
          setScreen({ kind: 'form', draft: createContest(now), isNew: true })
        }}
        onSample={() => {
          setStored(buildSampleContests())
          setOnboarded(true)
        }}
      />
    )
  }

  if (screen.kind === 'privacy') return <PrivacyView onClose={backToList} />

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

      <UpdateBar update={update} />

      <main className="app__main">
        {tab === 'home' && <HomeView contests={contests} now={now} onOpen={openDetail} />}
        {tab === 'calendar' && (
          <CalendarView
            contests={contests}
            now={now}
            selected={selectedDay}
            onSelect={setPickedDay}
            onOpen={openDetail}
          />
        )}
        {tab === 'reminder' && <ReminderView contests={contests} now={now} onOpen={openDetail} />}
        {tab === 'settings' && (
          <SettingsView
            contests={contests}
            now={now}
            theme={theme}
            lastBackupAt={lastBackupAt}
            onThemeChange={setTheme}
            onRestore={setStored}
            onBackedUp={setLastBackupAt}
            onLoadSample={() => setStored(buildSampleContests())}
            onClear={() => setStored([])}
            update={update}
            onOpenPrivacy={() => setScreen({ kind: 'privacy' })}
          />
        )}
      </main>

      {(tab === 'home' || tab === 'calendar') && (
        <button
          type="button"
          className="fab"
          aria-label={
            tab === 'calendar' ? `${formatDateJa(selectedDay)} にコンテストを追加` : 'コンテストを追加'
          }
          onClick={() =>
            setScreen({
              // カレンダーから足すときは、選んでいる日をそのまま初期値にする。
              draft: createContest(tab === 'calendar' ? parseDateKey(selectedDay) : now),
              isNew: true,
              kind: 'form',
            })
          }
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
