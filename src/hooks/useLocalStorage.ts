import { useEffect, useState } from 'react'

/** localStorage に読み書きする useState。値は JSON で保存する。 */
export function useLocalStorage<T>(key: string, initialValue: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    const fallback = () => (typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue)
    try {
      const stored = window.localStorage.getItem(key)
      return stored === null ? fallback() : (JSON.parse(stored) as T)
    } catch {
      return fallback()
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // 保存できなくても操作は続けられるので握りつぶす
    }
  }, [key, value])

  return [value, setValue] as const
}
