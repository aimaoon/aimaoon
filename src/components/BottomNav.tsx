export type Tab = 'home' | 'calendar' | 'reminder' | 'settings'

const TABS: { key: Tab; label: string; latin: string }[] = [
  { key: 'home', label: 'イベント', latin: 'EVENTS' },
  { key: 'calendar', label: 'カレンダー', latin: 'CALENDAR' },
  { key: 'reminder', label: '通知', latin: 'ALERTS' },
  { key: 'settings', label: '設定', latin: 'SETTINGS' },
]

/** 画面下のタブバー。親指の届く位置に主要導線を置く。 */
export function BottomNav({
  current,
  badge,
  onChange,
}: {
  current: Tab
  badge: number
  onChange: (tab: Tab) => void
}) {
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`tabbar__item ${current === tab.key ? 'is-active' : ''}`}
          aria-current={current === tab.key ? 'page' : undefined}
          onClick={() => onChange(tab.key)}
        >
          <span className="tabbar__latin">{tab.latin}</span>
          <span className="tabbar__label">{tab.label}</span>
          {tab.key === 'home' && badge > 0 && <span className="tabbar__badge">{badge}</span>}
        </button>
      ))}
    </nav>
  )
}
