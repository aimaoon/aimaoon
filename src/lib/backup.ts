import type { Contest } from '../types'
import { normalizeContest } from './factory'

/**
 * バックアップの書き出しと読み込み。
 *
 * データは端末の中にしかないので、機種変更やブラウザのデータ削除で消える。
 * 「書き出せるが戻せない」状態は事故のもとなので、復元まで含めて用意する。
 *
 * 以前のバージョンはコンテストの配列をそのまま書き出していた。
 * その形も読めるようにしてある（古い控えを持っている人が困らないように）。
 */

export const BACKUP_FORMAT = 'stage-note-backup'
export const BACKUP_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  /** 書き出した日時（ISO 8601） */
  exportedAt: string
  contests: Contest[]
}

export class BackupError extends Error {}

/** 読み込んだ結果。件数は画面での確認用。 */
export interface BackupContents {
  contests: Contest[]
  exportedAt: string | null
}

/** いまのデータを控えの形にする。 */
export function buildBackup(contests: Contest[], now: Date = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    contests,
  }
}

/** 控えを整形した JSON にする（人が開いても読める形）。 */
export function serializeBackup(contests: Contest[], now: Date = new Date()): string {
  return `${JSON.stringify(buildBackup(contests, now), null, 2)}\n`
}

function toContests(value: unknown): Contest[] {
  if (!Array.isArray(value)) throw new BackupError('コンテストの一覧が入っていません')

  const contests = value
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => normalizeContest(item as Partial<Contest>))
    // 欠けた項目は初期値で埋まるので、名前だけは元のファイルにあることを求める
    // （関係のない JSON を選んでしまったときに、空の大会が大量に増えないように）。
    .filter((contest) => contest.name.trim() !== '')

  if (contests.length === 0) throw new BackupError('読み込めるコンテストがありませんでした')
  return contests
}

/**
 * 控えのファイルを読む。
 * 中身が違うファイルを選んでしまったときに、何が起きたか分かる文言で失敗させる。
 */
export function parseBackup(text: string): BackupContents {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('JSON として読めないファイルです')
  }

  // 旧形式（配列そのまま）
  if (Array.isArray(data)) return { contests: toContests(data), exportedAt: null }

  if (typeof data !== 'object' || data === null) throw new BackupError('バックアップの形式ではありません')
  const record = data as Record<string, unknown>

  if (record.format !== BACKUP_FORMAT) throw new BackupError('このアプリのバックアップではありません')
  if (typeof record.version === 'number' && record.version > BACKUP_VERSION) {
    throw new BackupError('新しいバージョンのバックアップです。アプリを更新してください')
  }

  return {
    contests: toContests(record.contests),
    exportedAt: typeof record.exportedAt === 'string' ? record.exportedAt : null,
  }
}

/** 読み込み方。置き換えるか、いまのデータに足すか。 */
export type RestoreMode = 'replace' | 'merge'

export interface RestoreResult {
  contests: Contest[]
  /** 新しく増えた件数 */
  added: number
  /** 控えの内容で上書きした件数 */
  updated: number
  /** 手元のほうが新しいので残した件数 */
  kept: number
}

/**
 * 控えを取り込む。
 * merge では同じ ID どうしを updatedAt で比べ、新しいほうを残す
 * （複数の端末で使っていて、両方に書き足した場合を想定）。
 */
export function restoreContests(current: Contest[], incoming: Contest[], mode: RestoreMode): RestoreResult {
  if (mode === 'replace') {
    return { contests: incoming, added: incoming.length, updated: 0, kept: 0 }
  }

  const byId = new Map(current.map((contest) => [contest.id, contest]))
  let added = 0
  let updated = 0
  let kept = 0

  for (const contest of incoming) {
    const existing = byId.get(contest.id)
    if (!existing) {
      byId.set(contest.id, contest)
      added += 1
      continue
    }
    if ((contest.updatedAt ?? '') > (existing.updatedAt ?? '')) {
      byId.set(contest.id, contest)
      updated += 1
    } else {
      kept += 1
    }
  }

  return { contests: [...byId.values()], added, updated, kept }
}

/** 最後に控えを取ってから何日経ったか。控えが無ければ null。 */
export function daysSinceBackup(lastBackupAt: string | null, now: Date): number | null {
  if (!lastBackupAt) return null
  const last = new Date(lastBackupAt).getTime()
  if (Number.isNaN(last)) return null
  return Math.floor((now.getTime() - last) / 86_400_000)
}

/** 控えを促すかどうか。データがあって、しばらく取っていなければ促す。 */
export function shouldRemindBackup(contestCount: number, lastBackupAt: string | null, now: Date, afterDays = 14): boolean {
  if (contestCount === 0) return false
  const days = daysSinceBackup(lastBackupAt, now)
  return days === null || days >= afterDays
}

/** 控えのファイル名。日付が入っていると、複数の控えを並べたときに分かりやすい。 */
export function backupFilename(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `stage-note-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`
}
