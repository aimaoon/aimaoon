/**
 * 配色の切り替え。
 * 夜のクラブでは黒地、昼の稽古場や屋外では紙に刷ったフライヤーのように白地で使えるようにする。
 * 既定は「端末に合わせる」で、自分で選べば上書きされる。
 */

export type ThemePreference = 'system' | 'dark' | 'light'
export type ResolvedTheme = 'dark' | 'light'

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: '端末に合わせる',
  dark: 'ダーク',
  light: 'ライト',
}

export const THEME_OPTIONS: ThemePreference[] = ['system', 'dark', 'light']

/** ステータスバーの色（PWA のとき端末の上下の色になる）。CSS の --ground と揃えている。 */
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#0b0a0d',
  light: '#f0eff3',
}

/** 設定と端末の設定から、実際に使う配色を決める。 */
export function resolveTheme(preference: ThemePreference, prefersLight: boolean): ResolvedTheme {
  if (preference === 'system') return prefersLight ? 'light' : 'dark'
  return preference
}

/** 保存された値が壊れていても落ちないように直す。 */
export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'dark' || value === 'light' || value === 'system' ? value : 'system'
}
