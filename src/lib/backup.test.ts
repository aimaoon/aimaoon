import { describe, expect, it } from 'vitest'
import type { Contest } from '../types'
import { createContest } from './factory'
import {
  BACKUP_FORMAT,
  BackupError,
  backupFilename,
  buildBackup,
  daysSinceBackup,
  parseBackup,
  restoreContests,
  serializeBackup,
  shouldRemindBackup,
} from './backup'

const NOW = new Date(2026, 7, 20, 12, 0)

function contest(overrides: Partial<Contest> = {}): Contest {
  return { ...createContest(NOW), name: 'テスト大会', date: '2026-09-01', ...overrides }
}

describe('控えの書き出し', () => {
  it('形式・版・書き出した日時を添える', () => {
    const backup = buildBackup([contest()], NOW)
    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.version).toBe(1)
    expect(backup.exportedAt).toBe(NOW.toISOString())
    expect(backup.contests).toHaveLength(1)
  })

  it('人が開いても読める JSON にする', () => {
    const text = serializeBackup([contest()], NOW)
    expect(text).toContain('\n  ')
    expect(text.endsWith('\n')).toBe(true)
  })

  it('日付入りのファイル名にする', () => {
    expect(backupFilename(NOW)).toBe('stage-note-20260820.json')
  })
})

describe('控えの読み込み', () => {
  it('書き出したものをそのまま読み戻せる', () => {
    const original = [contest({ id: 'a', name: 'DANCE ALIVE 関東予選' })]
    const result = parseBackup(serializeBackup(original, NOW))
    expect(result.contests).toHaveLength(1)
    expect(result.contests[0].name).toBe('DANCE ALIVE 関東予選')
    expect(result.exportedAt).toBe(NOW.toISOString())
  })

  it('以前の形式（配列そのまま）も読める', () => {
    const result = parseBackup(JSON.stringify([contest({ name: '旧形式の大会' })]))
    expect(result.contests[0].name).toBe('旧形式の大会')
    expect(result.exportedAt).toBeNull()
  })

  it('欠けている項目は初期値で補う', () => {
    const result = parseBackup(JSON.stringify([{ id: 'x', name: '最低限', date: '2026-09-01' }]))
    const restored = result.contests[0]
    expect(restored.entry.status).toBe('unpaid')
    expect(restored.music.status).toBe('none')
    expect(restored.judges).toEqual([])
    expect(restored.reminders.length).toBeGreaterThan(0)
  })

  it('JSON でなければ理由の分かる失敗にする', () => {
    expect(() => parseBackup('これは JSON ではありません')).toThrow(BackupError)
    expect(() => parseBackup('これは JSON ではありません')).toThrow(/JSON/)
  })

  it('別のアプリのファイルは受け付けない', () => {
    expect(() => parseBackup(JSON.stringify({ format: 'other-app', contests: [] }))).toThrow(/このアプリ/)
  })

  it('新しすぎる版は読まずに知らせる', () => {
    expect(() =>
      parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, contests: [contest()] })),
    ).toThrow(/更新/)
  })

  it('中身が空なら失敗させる', () => {
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 1, contests: [] }))).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify([{ foo: 'bar' }]))).toThrow(BackupError)
  })
})

describe('取り込み方', () => {
  const mine = [
    contest({ id: 'shared', name: '手元が新しい', updatedAt: '2026-08-20T00:00:00.000Z' }),
    contest({ id: 'only-mine', name: '手元だけ' }),
  ]
  const backup = [
    contest({ id: 'shared', name: '控えが古い', updatedAt: '2026-08-01T00:00:00.000Z' }),
    contest({ id: 'only-backup', name: '控えだけ' }),
  ]

  it('置き換えなら控えの内容だけになる', () => {
    const result = restoreContests(mine, backup, 'replace')
    expect(result.contests.map((c) => c.id).sort()).toEqual(['only-backup', 'shared'])
    expect(result.added).toBe(2)
  })

  it('統合なら手元にないものだけ足す', () => {
    const result = restoreContests(mine, backup, 'merge')
    expect(result.contests.map((c) => c.id).sort()).toEqual(['only-backup', 'only-mine', 'shared'])
    expect(result.added).toBe(1)
  })

  it('統合では新しいほうを残す', () => {
    const result = restoreContests(mine, backup, 'merge')
    expect(result.contests.find((c) => c.id === 'shared')?.name).toBe('手元が新しい')
    expect(result.kept).toBe(1)
    expect(result.updated).toBe(0)
  })

  it('控えのほうが新しければ上書きする', () => {
    const newer = [contest({ id: 'shared', name: '控えが新しい', updatedAt: '2026-09-01T00:00:00.000Z' })]
    const result = restoreContests(mine, newer, 'merge')
    expect(result.contests.find((c) => c.id === 'shared')?.name).toBe('控えが新しい')
    expect(result.updated).toBe(1)
  })

  it('手元が空でも統合できる', () => {
    expect(restoreContests([], backup, 'merge').contests).toHaveLength(2)
  })
})

describe('控えを促すかどうか', () => {
  it('データが無ければ促さない', () => {
    expect(shouldRemindBackup(0, null, NOW)).toBe(false)
  })

  it('一度も取っていなければ促す', () => {
    expect(shouldRemindBackup(3, null, NOW)).toBe(true)
  })

  it('最近取っていれば促さない', () => {
    const recent = new Date(NOW.getTime() - 3 * 86_400_000).toISOString()
    expect(shouldRemindBackup(3, recent, NOW)).toBe(false)
  })

  it('しばらく取っていなければ促す', () => {
    const old = new Date(NOW.getTime() - 20 * 86_400_000).toISOString()
    expect(shouldRemindBackup(3, old, NOW)).toBe(true)
    expect(daysSinceBackup(old, NOW)).toBe(20)
  })

  it('壊れた日時は「取っていない」とみなす', () => {
    expect(daysSinceBackup('こわれています', NOW)).toBeNull()
    expect(shouldRemindBackup(1, 'こわれています', NOW)).toBe(true)
  })
})
