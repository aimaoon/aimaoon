/**
 * タブバーのアイコン。
 * 出来合いのアイコンセットではなく、この画面の線の太さと角の作りに合わせて引いている。
 * 24 の升目・幾何形で構成し、選択中だけ線を少し太らせて重心を移す（書体の使い分けと同じ考え方）。
 */

type IconProps = { active?: boolean }

function Frame({ active, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className="tabbar__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 1.9 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/** イベント：トロフィー。コンテストに出るためのアプリなので、これを顔にする。 */
export function TrophyIcon({ active }: IconProps) {
  return (
    <Frame active={active}>
      <path d="M7.2 4.2h9.6v4a4.8 4.8 0 0 1-9.6 0v-4Z" />
      <path d="M7.2 5.8H4.9a2.4 2.4 0 0 0 2.9 3.1" />
      <path d="M16.8 5.8h2.3a2.4 2.4 0 0 1-2.9 3.1" />
      <path d="M12 13.1v2.7" />
      <path d="M9.9 19.8l.7-4h2.8l.7 4" />
      <path d="M8.4 19.8h7.2" />
    </Frame>
  )
}

/** カレンダー：日付をひとつ塗って、本文のカレンダーで使っている点と揃える。 */
export function CalendarIcon({ active }: IconProps) {
  return (
    <Frame active={active}>
      <rect x="4.2" y="6" width="15.6" height="13.8" rx="1.4" />
      <path d="M4.2 10.2h15.6" />
      <path d="M8.6 4.2v3.4" />
      <path d="M15.4 4.2v3.4" />
      <circle cx="9" cy="14.6" r="1.35" fill="currentColor" stroke="none" />
    </Frame>
  )
}

/** 通知：ベル。輪郭は角を立てて、丸っこくならないようにしている。 */
export function BellIcon({ active }: IconProps) {
  return (
    <Frame active={active}>
      <path d="M12 4.6a5.4 5.4 0 0 0-5.4 5.4c0 3.9-1.4 5.4-1.4 5.4h13.6s-1.4-1.5-1.4-5.4A5.4 5.4 0 0 0 12 4.6Z" />
      <path d="M12 2.8v1.8" />
      <path d="M10.1 18.2a2.1 2.1 0 0 0 3.8 0" />
    </Frame>
  )
}

/** 設定：歯車ではなくミキサーのフェーダー。音を扱う道具立てで揃える。 */
export function FadersIcon({ active }: IconProps) {
  return (
    <Frame active={active}>
      <path d="M7 4.4v15.2" />
      <path d="M12 4.4v15.2" />
      <path d="M17 4.4v15.2" />
      <rect x="5" y="7.4" width="4" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="10" y="13.2" width="4" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
      <rect x="15" y="9.6" width="4" height="2.6" rx="0.7" fill="currentColor" stroke="none" />
    </Frame>
  )
}
