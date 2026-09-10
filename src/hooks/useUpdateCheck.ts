import { useCallback, useEffect, useRef, useState } from 'react'
import { hasUpdate, parseVersionInfo, reloadUrl, versionUrl } from '../lib/updateCheck'

/** 立て続けに取りにいかないよう、確認と確認のあいだに最低これだけ空ける。 */
const MIN_INTERVAL_MS = 5 * 60 * 1000

export type UpdateState = {
  /** 新しい版が配信されている。 */
  available: boolean
  /** 配信されている版。分からなければ null。 */
  version: string | null
  /** いま確認している最中。 */
  checking: boolean
  /** 手で確認したときだけ立つ、「最新でした」の返事。 */
  upToDate: boolean
  check: (force?: boolean) => Promise<void>
  apply: () => Promise<void>
  dismiss: () => void
}

/**
 * 配信されている版を見張る。
 *
 * ホーム画面に追加したアプリは古い画面を握ったままになりがちなので、
 * 開いたときと、ほかのアプリから戻ってきたときに確認する。
 */
export function useUpdateCheck(current: string): UpdateState {
  const [version, setVersion] = useState<string | null>(null)
  const [available, setAvailable] = useState(false)
  const [checking, setChecking] = useState(false)
  const [upToDate, setUpToDate] = useState(false)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const lastCheckedAt = useRef(0)

  const check = useCallback(
    async (force = false) => {
      if (typeof fetch !== 'function') return
      const now = Date.now()
      if (!force && now - lastCheckedAt.current < MIN_INTERVAL_MS) return
      lastCheckedAt.current = now

      if (force) {
        setChecking(true)
        setUpToDate(false)
      }
      try {
        const response = await fetch(versionUrl(new Date(now)), { cache: 'no-store' })
        if (!response.ok) return
        const text = await response.text()
        const info = parseVersionInfo(text)
        if (info) setVersion(info.version)
        const found = hasUpdate(current, text)
        setAvailable(found)
        if (force && !found) setUpToDate(true)
      } catch {
        // 圏外や配信前など。黙って次の機会を待つ。
      } finally {
        if (force) setChecking(false)
      }
    },
    [current],
  )

  useEffect(() => {
    void check(true)

    // ほかのアプリから戻ってきたときが、いちばん取りにいきやすい。
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [check])

  const apply = useCallback(async () => {
    // 画面のキャッシュは使っていないが、将来のぶんも含めて捨ててから読み直す。
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
    } catch {
      // 捨てられなくても、下の読み直しだけで足りることが多い
    }
    window.location.replace(reloadUrl(window.location.href, version ?? String(Date.now())))
  }, [version])

  return {
    available: available && dismissed !== version,
    version,
    checking,
    upToDate,
    check,
    apply,
    dismiss: () => setDismissed(version),
  }
}
