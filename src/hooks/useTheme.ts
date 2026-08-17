import { useEffect, useState } from 'react'
import type { ThemePreference } from '../lib/theme'
import { THEME_COLORS, normalizeThemePreference, resolveTheme } from '../lib/theme'
import { useLocalStorage } from './useLocalStorage'

const STORAGE_KEY = 'stage-note:theme:v1'

function prefersLightNow(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
}

/**
 * 配色の設定を保持して、<html data-theme> とステータスバーの色に反映する。
 * 「端末に合わせる」のときは属性を外し、CSS 側のメディアクエリに任せる。
 */
export function useTheme() {
  const [stored, setStored] = useLocalStorage<ThemePreference>(STORAGE_KEY, 'system')
  const preference = normalizeThemePreference(stored)
  const [prefersLight, setPrefersLight] = useState(prefersLightNow)

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = (event: MediaQueryListEvent) => setPrefersLight(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolved = resolveTheme(preference, prefersLight)

  useEffect(() => {
    const root = document.documentElement
    if (preference === 'system') delete root.dataset.theme
    else root.dataset.theme = preference

    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[resolved])
  }, [preference, resolved])

  return { preference, resolved, setPreference: setStored }
}
