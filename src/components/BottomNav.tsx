export type Tab = 'home' | 'calendar' | 'reminder' | 'settings'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'イベント', icon: '🏆' },
  { key: 'calendar', label: 'カレンダー', icon: '🗓' },
  { key: 'reminder', label: '通知', icon: '🔔' },
  { key: 'settings', label: '設定', icon: '⚙️' },
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
          <span className="tabbar__icon">
            {tab.icon}
            {tab.key === 'home' && badge > 0 && <span className="tabbar__badge">{badge}</span>}
          </span>
          <span className="tabbar__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}
