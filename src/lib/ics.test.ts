import { describe, expect, it } from 'vitest'
import type { Contest } from '../types'
import { buildIcs, utcStamp } from './ics'
import { createContest } from './factory'

const NOW = new Date(2026, 7, 20, 12, 0)

function contest(overrides: Partial<Contest> = {}): Contest {
  return {
    ...createContest(NOW),
    id: 'c1',
    name: 'TOKYO BATTLE',
    date: '2026-09-01',
    reminders: [],
    ...overrides,
  }
}

function unfold(ics: string): string {
  return ics.replace(/\r\n /g, '')
}

describe('ics の書き出し', () => {
  it('カレンダーの枠と CRLF の改行を持つ', () => {
    const ics = buildIcs([contest()], NOW)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })

  it('時刻ありならローカル時刻の DTSTART / DTEND を書く', () => {
    const ics = unfold(buildIcs([contest({ startTime: '10:30', endTime: '18:00' })], NOW))
    expect(ics).toContain('DTSTART:20260901T103000')
    expect(ics).toContain('DTEND:20260901T180000')
  })

  it('終了時刻がなければ 3 時間で埋める', () => {
    const ics = unfold(buildIcs([contest({ startTime: '10:30' })], NOW))
    expect(ics).toContain('DTEND:20260901T133000')
  })

  it('時刻がなければ終日予定になり、翌日で閉じる', () => {
    const ics = unfold(buildIcs([contest({ startTime: '' })], NOW))
    expect(ics).toContain('DTSTART;VALUE=DATE:20260901')
    expect(ics).toContain('DTEND;VALUE=DATE:20260902')
  })

  it('リマインダーが VALARM になる', () => {
    const ics = unfold(
      buildIcs([contest({ reminders: [{ id: 'r', daysBefore: 1, time: '20:00', enabled: true }] })], NOW),
    )
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics).toContain(`TRIGGER;VALUE=DATE-TIME:${utcStamp(new Date(2026, 7, 31, 20, 0))}`)
  })

  it('無効なリマインダーは VALARM にしない', () => {
    const ics = buildIcs([contest({ reminders: [{ id: 'r', daysBefore: 1, time: '20:00', enabled: false }] })], NOW)
    expect(ics).not.toContain('BEGIN:VALARM')
  })

  it('未入金・未提出の期限が別予定として入る', () => {
    const ics = unfold(
      buildIcs(
        [
          contest({
            entry: { fee: 5000, status: 'unpaid', dueDate: '2026-08-25' },
            music: { status: 'ready', dueDate: '2026-08-27' },
          }),
        ],
        NOW,
      ),
    )
    expect(ics).toContain('SUMMARY:入金期限：TOKYO BATTLE')
    expect(ics).toContain('SUMMARY:音源提出期限：TOKYO BATTLE')
  })

  it('対応済みの期限は書き出さない', () => {
    const ics = buildIcs(
      [
        contest({
          entry: { fee: 5000, status: 'paid', dueDate: '2026-08-25' },
          music: { status: 'onsite', dueDate: '2026-08-27' },
        }),
      ],
      NOW,
    )
    expect(ics).not.toContain('入金期限')
    expect(ics).not.toContain('音源提出期限')
  })

  it('区切り文字や改行をエスケープする', () => {
    const ics = unfold(buildIcs([contest({ name: 'A,B;C', memo: '1行目\n2行目' })], NOW))
    expect(ics).toContain('SUMMARY:A\\,B\\;C')
    expect(ics).toContain('1行目\\n2行目')
  })

  it('長い行は 75 文字で折り返す', () => {
    const ics = buildIcs([contest({ memo: 'あ'.repeat(200) })], NOW)
    expect(ics.split('\r\n').every((line) => line.length <= 75)).toBe(true)
  })

  it('ファイナルを別の予定として書き出す', () => {
    const ics = unfold(
      buildIcs(
        [
          contest({
            final: {
              date: '2026-10-01',
              startTime: '13:00',
              endTime: '20:00',
              status: 'advanced',
              reminders: [{ id: 'f', daysBefore: 1, time: '20:00', enabled: true }],
              venue: { name: '東京ドームシティホール', address: '東京都文京区後楽1-3-61' },
            },
          }),
        ],
        NOW,
      ),
    )
    expect(ics).toContain('UID:c1-final@stage-note')
    expect(ics).toContain('SUMMARY:TOKYO BATTLE ファイナル')
    expect(ics).toContain('DTSTART:20261001T130000')
    expect(ics).toContain('DTEND:20261001T200000')
    expect(ics).toContain(`TRIGGER;VALUE=DATE-TIME:${utcStamp(new Date(2026, 8, 30, 20, 0))}`)
  })

  it('ファイナルの会場が未設定なら予選の会場を使う', () => {
    const ics = unfold(
      buildIcs(
        [
          contest({
            venue: { name: '渋谷 WOMB', address: '東京都渋谷区円山町2-16' },
            final: { date: '2026-10-01', status: 'undecided', reminders: [] },
          }),
        ],
        NOW,
      ),
    )
    expect(ics).toContain('LOCATION:渋谷 WOMB 東京都渋谷区円山町2-16')
  })

  it('敗退したファイナルは書き出さない', () => {
    const ics = buildIcs([contest({ final: { date: '2026-10-01', status: 'eliminated', reminders: [] } })], NOW)
    expect(ics).not.toContain('ファイナル')
  })

  it('イベントごとに UID が分かれる', () => {
    const ics = unfold(buildIcs([contest({ id: 'x' }), contest({ id: 'y' })], NOW))
    expect(ics).toContain('UID:x@stage-note')
    expect(ics).toContain('UID:y@stage-note')
  })
})
