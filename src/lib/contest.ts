import type { Contest, ContestPhase, FinalStatus, Preparation, PreparationTask, Venue } from '../types'
import { daysUntil, toDateKey } from './date'

/** 期限が何日前になったら「そろそろ」と警告するか。 */
export const SOON_DAYS = 3

export const FINAL_LABELS: Record<FinalStatus, string> = {
  undecided: '結果待ち',
  advanced: 'ファイナル権獲得',
  eliminated: '敗退',
}

export const PAYMENT_LABELS: Record<Contest['entry']['status'], string> = {
  unpaid: '未入金',
  partial: '一部入金',
  paid: '入金済み',
  free: '費用なし',
}

export const MUSIC_LABELS: Record<Contest['music']['status'], string> = {
  none: '未準備',
  ready: '用意済み・未提出',
  submitted: '提出済み',
  onsite: '当日持参',
}

/** 入金が完了扱いか。 */
export function isPaymentSettled(contest: Contest): boolean {
  return contest.entry.status === 'paid' || contest.entry.status === 'free'
}

/** 音源の対応が済んでいるか。当日持参も「対応済み」として扱う。 */
export function isMusicSettled(contest: Contest): boolean {
  return contest.music.status === 'submitted' || contest.music.status === 'onsite'
}

/** 会場の場所が分かっているか（地図を開けるか）。 */
export function hasVenueLocation(contest: Contest): boolean {
  const { address, lat, lng } = contest.venue
  return Boolean((address && address.trim()) || (typeof lat === 'number' && typeof lng === 'number'))
}

/** ファイナル権を獲得しているか。 */
export function hasFinalRight(contest: Contest): boolean {
  return contest.final?.status === 'advanced'
}

/** ファイナルがまだ先にあるか（日程未定・敗退は数えない）。 */
export function hasUpcomingFinal(contest: Contest, now: Date): boolean {
  const final = contest.final
  if (!final || final.status === 'eliminated' || !final.date) return false
  return daysUntil(final.date, now) >= 0
}

/**
 * その大会で次に来る日。
 * 予選が終わっていてもファイナルが残っていれば、一覧・並び順はファイナルの日で考える。
 */
export function activeDate(contest: Contest, now: Date): string {
  return hasUpcomingFinal(contest, now) && contest.date < toDateKey(now) ? contest.final!.date! : contest.date
}

/** ファイナルの会場。個別に設定していなければ予選と同じ会場を使う。 */
export function finalVenue(contest: Contest): Venue {
  const venue = contest.final?.venue
  return venue && (venue.name || venue.address) ? venue : contest.venue
}

/** 開催日と現在日の関係。ファイナルが残っていれば終了扱いにしない。 */
export function contestPhase(contest: Contest, now: Date): ContestPhase {
  const diff = daysUntil(activeDate(contest, now), now)
  if (diff === 0) return 'today'
  return diff > 0 ? 'upcoming' : 'past'
}

/**
 * 未完了タスクの緊急度。
 * 期限があればその期限、なければ開催日を基準にする。
 */
function urgencyOf(done: boolean, deadline: string | undefined, now: Date): PreparationTask['urgency'] {
  if (done || !deadline) return 'none'
  const left = daysUntil(deadline, now)
  if (left < 0) return 'overdue'
  return left <= SOON_DAYS ? 'soon' : 'none'
}

/** コンテスト 1 件の準備状況。詳細画面のチェックリストと一覧のバッジに使う。 */
export function preparationOf(contest: Contest, now: Date): Preparation {
  const paid = isPaymentSettled(contest)
  const music = isMusicSettled(contest)
  // 期限を決めていない項目は「次に来る本番の日」までが猶予。
  const reference = activeDate(contest, now)

  const tasks: PreparationTask[] = [
    {
      kind: 'payment',
      label: contest.entry.status === 'free' ? 'エントリー費なし' : 'エントリー費の入金',
      done: paid,
      dueDate: contest.entry.dueDate,
      urgency: urgencyOf(paid, contest.entry.dueDate ?? reference, now),
    },
    {
      kind: 'music',
      label: contest.music.status === 'onsite' ? '音源は当日持参' : '音源の提出',
      done: music,
      dueDate: contest.music.dueDate,
      urgency: urgencyOf(music, contest.music.dueDate ?? reference, now),
    },
    {
      kind: 'venue',
      label: '会場の場所を確認',
      done: hasVenueLocation(contest),
      urgency: urgencyOf(hasVenueLocation(contest), reference, now),
    },
    {
      kind: 'judge',
      label: 'ジャッジを確認',
      done: contest.judges.length > 0,
      urgency: urgencyOf(contest.judges.length > 0, reference, now),
    },
  ]

  // 終わったイベントの準備タスクは、もう急ぎではない。
  const past = contestPhase(contest, now) === 'past'
  const normalized = past ? tasks.map((task) => ({ ...task, urgency: 'none' as const })) : tasks

  const doneCount = normalized.filter((task) => task.done).length
  return {
    tasks: normalized,
    doneCount,
    totalCount: normalized.length,
    ratio: normalized.length === 0 ? 1 : doneCount / normalized.length,
    alerts: normalized.filter((task) => !task.done && task.urgency !== 'none'),
  }
}

/**
 * 一覧の並び順。
 * これからのイベントを開催日が近い順に、終わったイベントを新しい順に、その後ろへ。
 */
export function sortContests(contests: Contest[], now: Date): Contest[] {
  const todayKey = toDateKey(now)
  return [...contests].sort((a, b) => {
    const aDate = activeDate(a, now)
    const bDate = activeDate(b, now)
    const aPast = aDate < todayKey
    const bPast = bDate < todayKey
    if (aPast !== bPast) return aPast ? 1 : -1
    if (aDate !== bDate) return aPast ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate)
    return a.name.localeCompare(b.name, 'ja')
  })
}

/** 検索の対象になる文字列をすべて集める。 */
function searchableText(contest: Contest): string {
  return [
    contest.name,
    contest.category,
    contest.venue.name,
    contest.venue.address,
    contest.final?.venue?.name,
    contest.final?.venue?.address,
    contest.memo,
    contest.music.title,
    ...contest.judges.flatMap((judge) => [judge.name, judge.genre]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** 大会名・部門・会場・ジャッジ・曲名・メモを対象にしたあいまい検索。 */
export function searchContests(contests: Contest[], query: string): Contest[] {
  const q = query.trim().toLowerCase()
  if (!q) return contests
  return contests.filter((contest) => searchableText(contest).includes(q))
}

/** そのジャッジが入っているか（表記ゆれを避けるため大文字小文字と前後の空白は無視）。 */
export function hasJudge(contest: Contest, name: string): boolean {
  const target = name.trim().toLowerCase()
  return contest.judges.some((judge) => judge.name.trim().toLowerCase() === target)
}

/** 登録されているジャッジを、担当した大会が多い順に並べて返す。 */
export function judgeIndex(contests: Contest[]): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>()
  for (const contest of contests) {
    // 同じ大会に同名のジャッジが 2 回入っていても 1 大会として数える。
    const seen = new Set<string>()
    for (const judge of contest.judges) {
      const name = judge.name.trim()
      const key = name.toLowerCase()
      if (!name || seen.has(key)) continue
      seen.add(key)
      const found = counts.get(key)
      if (found) found.count += 1
      else counts.set(key, { name, count: 1 })
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
}

/** 一覧の絞り込み条件。 */
export interface ContestFilter {
  /** フリーワード */
  query?: string
  /** 選んだジャッジのうち誰か 1 人でも入っている大会に絞る */
  judges?: string[]
  /** ファイナル権を獲得した大会だけに絞る */
  finalRightOnly?: boolean
}

/** 検索とジャッジ・ファイナル権の絞り込みをまとめて適用する。 */
export function filterContests(contests: Contest[], filter: ContestFilter): Contest[] {
  let result = searchContests(contests, filter.query ?? '')
  if (filter.judges?.length) {
    result = result.filter((contest) => filter.judges!.some((name) => hasJudge(contest, name)))
  }
  if (filter.finalRightOnly) {
    result = result.filter(hasFinalRight)
  }
  return result
}

/** 絞り込みが 1 つでもかかっているか。 */
export function isFilterActive(filter: ContestFilter): boolean {
  return Boolean(filter.query?.trim() || filter.judges?.length || filter.finalRightOnly)
}

/** 振り返りが書かれているか。 */
export function hasReview(contest: Contest): boolean {
  const review = contest.review
  if (!review) return false
  return Boolean(review.result || review.good || review.improve || review.next || review.rating)
}

/** 終わったのに振り返りが未記入のイベント（ホームで「振り返りを書こう」と出す用）。 */
export function pendingReviews(contests: Contest[], now: Date): Contest[] {
  return contests
    .filter((contest) => contestPhase(contest, now) === 'past' && !hasReview(contest))
    .sort((a, b) => activeDate(b, now).localeCompare(activeDate(a, now)))
}
