import { useRef, useState } from 'react'
import type { Contest } from '../types'
import { contestPhase, isMusicSettled, isPaymentSettled } from '../lib/contest'
import { downloadIcs } from '../lib/ics'
import type { RestoreMode } from '../lib/backup'
import {
  BackupError,
  backupFilename,
  daysSinceBackup,
  parseBackup,
  restoreContests,
  serializeBackup,
  shouldRemindBackup,
} from '../lib/backup'
import type { UpdateState } from '../hooks/useUpdateCheck'
import type { ThemePreference } from '../lib/theme'
import { THEME_LABELS, THEME_OPTIONS } from '../lib/theme'
import { formatDateJa } from '../lib/date'
import { Card } from './ui'

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL ?? ''

function download(text: string, filename: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/** 集計・バックアップ・アプリの情報。 */
export function SettingsView({
  contests,
  now,
  theme,
  lastBackupAt,
  update,
  onThemeChange,
  onRestore,
  onBackedUp,
  onLoadSample,
  onClear,
  onOpenPrivacy,
}: {
  contests: Contest[]
  now: Date
  theme: ThemePreference
  lastBackupAt: string | null
  update: UpdateState
  onThemeChange: (theme: ThemePreference) => void
  onRestore: (contests: Contest[]) => void
  onBackedUp: (at: string) => void
  onLoadSample: () => void
  onClear: () => void
  onOpenPrivacy: () => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)

  const upcoming = contests.filter((contest) => contestPhase(contest, now) !== 'past')
  const unpaidTotal = upcoming
    .filter((contest) => !isPaymentSettled(contest))
    .reduce((sum, contest) => sum + Math.max(contest.entry.fee - (contest.entry.paidAmount ?? 0), 0), 0)
  const pendingMusic = upcoming.filter((contest) => !isMusicSettled(contest))
  const spent = contests.filter(isPaymentSettled).reduce((sum, contest) => sum + contest.entry.fee, 0)

  const elapsed = daysSinceBackup(lastBackupAt, now)
  const remind = shouldRemindBackup(contests.length, lastBackupAt, now)

  const exportBackup = () => {
    download(serializeBackup(contests, now), backupFilename(now), 'application/json')
    onBackedUp(now.toISOString())
    setMessage({ tone: 'ok', text: `${contests.length} 件を書き出しました。安全な場所に保管してください。` })
  }

  const importBackup = async (file: File) => {
    try {
      const result = parseBackup(await file.text())
      const restored = restoreContests(contests, result.contests, mode)
      onRestore(restored.contests)
      setMessage({
        tone: 'ok',
        text:
          mode === 'replace'
            ? `${restored.contests.length} 件に置き換えました。`
            : `${restored.added} 件を追加、${restored.updated} 件を更新しました（手元が新しい ${restored.kept} 件はそのまま）。`,
      })
    } catch (error) {
      setMessage({
        tone: 'warn',
        text: error instanceof BackupError ? error.message : 'ファイルを読み込めませんでした。',
      })
    }
  }

  return (
    <div className="view">
      <Card title="サマリー" label="SUMMARY">
        <div className="stats">
          <div className="stat">
            <span className="stat__value">{upcoming.length}</span>
            <span className="stat__label">これからの大会</span>
          </div>
          <div className="stat">
            <span className="stat__value stat__value--warn">{unpaidTotal.toLocaleString('ja-JP')}</span>
            <span className="stat__label">未入金の合計（円）</span>
          </div>
          <div className="stat">
            <span className="stat__value">{pendingMusic.length}</span>
            <span className="stat__label">音源が未対応</span>
          </div>
          <div className="stat">
            <span className="stat__value">{spent.toLocaleString('ja-JP')}</span>
            <span className="stat__label">支払い済み合計（円）</span>
          </div>
        </div>
      </Card>

      <Card title="バックアップ" label="BACKUP">
        <p className="hint">
          データはこの端末の中にだけあります。機種変更やブラウザのデータ削除で消えるので、
          ときどき控えを取ってください。書き出したファイルから元に戻せます。
        </p>

        {remind ? (
          <p className="hint hint--warn">
            {elapsed === null ? 'まだ一度も控えを取っていません。' : `最後に控えを取ってから ${elapsed} 日経っています。`}
          </p>
        ) : (
          lastBackupAt && <p className="hint hint--ok">最後の控え {formatDateJa(lastBackupAt.slice(0, 10))}</p>
        )}

        <button type="button" className="btn btn--primary" onClick={exportBackup} disabled={contests.length === 0}>
          バックアップを書き出す
        </button>

        <div className="segmented segmented--wrap">
          <button
            type="button"
            className={`segmented__item ${mode === 'merge' ? 'is-active' : ''}`}
            onClick={() => setMode('merge')}
          >
            いまの内容に足す
          </button>
          <button
            type="button"
            className={`segmented__item ${mode === 'replace' ? 'is-active' : ''}`}
            onClick={() => setMode('replace')}
          >
            すべて置き換える
          </button>
        </div>
        <p className="hint">
          {mode === 'merge'
            ? '同じ大会は、更新が新しいほうを残します。別の端末の控えを取り込むときはこちら。'
            : 'いまの内容をすべて捨てて、控えの内容にします。'}
        </p>

        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void importBackup(file)
            event.target.value = ''
          }}
        />
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            if (mode === 'replace' && contests.length > 0) {
              if (!window.confirm('いまの内容をすべて置き換えます。よろしいですか？')) return
            }
            fileInput.current?.click()
          }}
        >
          バックアップを読み込む
        </button>

        {message && <p className={`hint hint--${message.tone === 'ok' ? 'ok' : 'warn'}`}>{message.text}</p>}
      </Card>

      <Card title="表示" label="APPEARANCE">
        <div className="segmented segmented--wrap">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={`segmented__item ${theme === option ? 'is-active' : ''}`}
              onClick={() => onThemeChange(option)}
            >
              {THEME_LABELS[option]}
            </button>
          ))}
        </div>
        <p className="hint">
          夜の会場ならダーク、昼の稽古場や屋外ならライトが見やすいです。端末に合わせるを選ぶと OS の設定に追従します。
        </p>
      </Card>

      <Card title="カレンダー連携" label="CALENDAR">
        <p className="hint">
          .ics を書き出して開くと、iPhone のカレンダーや Google カレンダーに、開催予定・締切・アラームごと取り込めます。
        </p>
        <button type="button" className="btn btn--ghost" onClick={() => downloadIcs(contests)} disabled={contests.length === 0}>
          すべての予定を書き出す（.ics）
        </button>
      </Card>

      <Card title="このアプリについて" label="ABOUT">
        <dl className="kv">
          <div className="kv__row">
            <dt>バージョン</dt>
            <dd>{__APP_VERSION__}</dd>
          </div>
          <div className="kv__row">
            <dt>登録数</dt>
            <dd>{contests.length} 件</dd>
          </div>
        </dl>

        {update.available ? (
          <>
            <p className="hint hint--ok">新しい版（{update.version}）が配信されています。</p>
            <button type="button" className="btn btn--primary" onClick={() => void update.apply()}>
              更新する
            </button>
          </>
        ) : (
          <>
            {update.upToDate && <p className="hint hint--ok">最新の版を使っています。</p>}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void update.check(true)}
              disabled={update.checking}
            >
              {update.checking ? '確認しています…' : '更新を確認する'}
            </button>
          </>
        )}

        <button type="button" className="btn btn--ghost" onClick={onOpenPrivacy}>
          プライバシーポリシー
        </button>

        {SUPPORT_EMAIL && (
          <a
            className="btn btn--ghost"
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Stage Note ${__APP_VERSION__} のお問い合わせ`)}`}
          >
            お問い合わせ
          </a>
        )}
      </Card>

      <Card title="データの整理" label="DATA">
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              if (contests.length > 0 && !window.confirm('いまの内容を、サンプルに置き換えます。よろしいですか？')) return
              onLoadSample()
            }}
          >
            サンプルを読み込む
          </button>
        </div>
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => {
            if (window.confirm('保存されているコンテストをすべて削除します。よろしいですか？')) onClear()
          }}
        >
          すべて削除
        </button>
        <p className="hint">削除する前に、バックアップを書き出しておくと元に戻せます。</p>
      </Card>
    </div>
  )
}
