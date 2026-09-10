import { describe, expect, it } from 'vitest'
import { normalizeThemePreference, resolveTheme } from './theme'

describe('配色の決定', () => {
  it('端末に合わせるときは端末の設定に従う', () => {
    expect(resolveTheme('system', true)).toBe('light')
    expect(resolveTheme('system', false)).toBe('dark')
  })

  it('自分で選んだ場合は端末の設定より優先する', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
    expect(resolveTheme('light', false)).toBe('light')
  })

  it('保存された値が壊れていたら端末に合わせるへ戻す', () => {
    expect(normalizeThemePreference('light')).toBe('light')
    expect(normalizeThemePreference('sepia')).toBe('system')
    expect(normalizeThemePreference(undefined)).toBe('system')
  })
})
