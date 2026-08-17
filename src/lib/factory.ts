import type { Contest, FinalRound, FinalStatus, Judge } from '../types'
import { addDays, toDateKey } from './date'
import { defaultReminders } from './reminder'

/** 衝突しない程度の ID。ローカル保存しかしないのでこれで十分。 */
export function createId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 新規コンテストの初期値。 */
export function createContest(date: Date = new Date()): Contest {
  const now = new Date().toISOString()
  return {
    id: createId('contest'),
    name: '',
    category: '',
    date: toDateKey(date),
    startTime: '',
    endTime: '',
    venue: { name: '' },
    entry: { fee: 0, status: 'unpaid' },
    music: { status: 'none' },
    judges: [],
    reminders: defaultReminders(),
    memo: '',
    createdAt: now,
    updatedAt: now,
  }
}

/** 新規ジャッジの初期値。 */
export function createJudge(name = ''): Judge {
  return { id: createId('judge'), name }
}

/**
 * ファイナルの初期値。
 * baseDate を渡すと仮に予選の 1 か月後を置く。日程がまだ発表されていないときは省略する。
 */
export function createFinal(baseDate?: string, status: FinalStatus = 'undecided'): FinalRound {
  return {
    date: baseDate ? addDays(baseDate, 30) : undefined,
    startTime: '',
    endTime: '',
    status,
    reminders: defaultReminders(),
    note: '',
  }
}

/** 保存されたデータを現在の型に合わせて補正する（古い保存データや手編集への保険）。 */
export function normalizeContest(input: Partial<Contest>): Contest {
  const base = createContest()
  return {
    ...base,
    ...input,
    venue: { ...base.venue, ...(input.venue ?? {}) },
    entry: { ...base.entry, ...(input.entry ?? {}) },
    music: { ...base.music, ...(input.music ?? {}) },
    judges: (input.judges ?? []).map((judge) => ({ ...createJudge(), ...judge })),
    reminders: input.reminders?.length ? input.reminders : base.reminders,
    final: input.final
      ? {
          ...createFinal(),
          ...input.final,
          reminders: input.final.reminders?.length ? input.final.reminders : defaultReminders(),
        }
      : undefined,
    id: input.id ?? base.id,
  }
}
