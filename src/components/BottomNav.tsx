import type { ComponentType } from 'react'
import { BellIcon, CalendarIcon, FadersIcon, TrophyIcon } from './icons'

export type Tab = 'home' | 'calendar' | 'reminder' | 'settings'

const TABS: { key: Tab; label: string; Icon: ComponentType<{ active?: boolean }> }[] = [
  { key: 'home', label: 'イベント', Icon: TrophyIcon },
  { key: 'calendar', label: 'カレンダー', Icon: CalendarIcon },
  { key: 'reminder', label: '通知', Icon: BellIcon },
  { key: 'settings', label: '設定', Icon: FadersIcon },
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
      {TABS.map(({ key, label, Icon }) => {
        const active = current === key
        return (
          <button
            key={key}
            type="button"
            className={`tabbar__item ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(key)}
          >
            <Icon active={active} />
            <span className="tabbar__label">{label}</span>
            {key === 'home' && badge > 0 && <span className="tabbar__badge">{badge}</span>}
          </button>
        )
      })}
    </nav>
  )
}
