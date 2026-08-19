import { useState } from 'react'
import type { Contest, Entry, Music, Reminder } from '../types'
import { MUSIC_LABELS, PAYMENT_LABELS, contestPhase, isPaymentSettled, preparationOf } from '../lib/contest'
import { daysUntil, formatDateDotted, formatDateJa, formatDayOffset, toDateKey } from '../lib/date'
import { canOpenMap, directionsUrl, googleMapsUrl } from '../lib/map'
import { downloadIcs } from '../lib/ics'
import { createId } from '../lib/factory'
import { reminderDateTime, reminderLabel } from '../lib/reminder'
import { FinalPanel } from './FinalPanel'
import { TrophyMark } from './icons'
import { JudgePanel } from './JudgePanel'
import { ReviewPanel } from './ReviewPanel'
import { ShareCard } from './ShareCard'
import { Blank, Card, Chip, Segments } from './ui'

const PAYMENT_OPTIONS: Entry['status'][] = ['unpaid', 'partial', 'paid', 'free']
const MUSIC_OPTIONS: Music['status'][] = ['none', 'ready', 'submitted']

function yen(value: number): string {
  return `${value.toLocaleString('ja-JP')}円`
}

/**
 * コンテスト詳細。
 * 大会名や日付は編集画面で、入金・音源など「日々変わる状態」はこの画面で直接更新する。
 */
export function ContestDetail({
  contest,
  now,
  onChange,
  onEdit,
  onDelete,
  onClose,
}: {
  contest: Contest
  now: Date
  onChange: (contest: Contest) => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const [newReminderDays, setNewReminderDays] = useState(3)
  const [newReminderTime, setNewReminderTime] = useState('20:00')

  const phase = contestPhase(contest, now)
  const left = daysUntil(contest.date, now)
  const prep = preparationOf(contest, now)

  const patch = (changes: Partial<Contest>) => onChange({ ...contest, ...changes, updatedAt: new Date().toISOString() })
  const patchEntry = (changes: Partial<Entry>) => patch({ entry: { ...contest.entry, ...changes } })
  const patchMusic = (changes: Partial<Music>) => patch({ music: { ...contest.music, ...changes } })

  const setReminders = (reminders: Reminder[]) => patch({ reminders })

  return (
    <div className="detail">
      <header className="detail__bar">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="戻る">
          ‹
        </button>
        <span className="detail__bar-title">コンテスト詳細</span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onEdit}>
          編集
        </button>
      </header>

      <div className="view">
        <section className={`hero hero--${phase}`}>
          <p className="hero__date">
            {formatDateDotted(contest.date)}
            {contest.startTime && ` ${contest.startTime}`}
            {contest.endTime && `〜${contest.endTime}`}
          </p>
          <h1 className="hero__name">{contest.name || '（名称未設定）'}</h1>
          {contest.category && <p className="hero__category">{contest.category}</p>}
          <div className="hero__meta">
            <Chip tone={phase === 'past' ? 'neutral' : phase === 'today' ? 'danger' : 'accent'}>
              {formatDayOffset(left)}
            </Chip>
            <Chip tone={prep.alerts.length > 0 ? 'warn' : 'ok'}>
              準備 {prep.doneCount}/{prep.totalCount}
            </Chip>
            {contest.final && contest.final.status !== 'eliminated' && (
              <Chip tone="final" icon={contest.final.status === 'advanced' ? <TrophyMark /> : undefined}>
                {contest.final.status === 'advanced' ? 'ファイナル権獲得' : 'ファイナル'}
                {contest.final.date ? ` ${formatDateJa(contest.final.date)}` : '（日程未定）'}
              </Chip>
            )}
          </div>
          <Segments tasks={prep.tasks} />
        </section>

        <Card title="準備チェック" label="CHECKLIST">
          <ul className="checklist">
            {prep.tasks.map((task) => (
              <li key={task.kind} className={`checklist__item checklist__item--${task.urgency}`}>
                <span className={`checklist__mark ${task.done ? 'is-done' : ''}`}>{task.done ? '✓' : '—'}</span>
                <span className="checklist__label">{task.label}</span>
                {task.dueDate && <span className="checklist__due">期限 {formatDateJa(task.dueDate)}</span>}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="入金" label="PAYMENT">
          <div className="segmented segmented--wrap">
            {PAYMENT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`segmented__item ${contest.entry.status === option ? 'is-active' : ''}`}
                onClick={() =>
                  patchEntry({
                    status: option,
                    paidOn: option === 'paid' && !contest.entry.paidOn ? toDateKey(now) : contest.entry.paidOn,
                  })
                }
              >
                {PAYMENT_LABELS[option]}
              </button>
            ))}
          </div>

          <dl className="kv">
            <div className="kv__row">
              <dt>エントリー費</dt>
              <dd>{contest.entry.fee > 0 ? yen(contest.entry.fee) : <Blank>なし</Blank>}</dd>
            </div>
            <div className="kv__row">
              <dt>入金期限</dt>
              <dd>{contest.entry.dueDate ? formatDateJa(contest.entry.dueDate) : <Blank />}</dd>
            </div>
            {contest.entry.status === 'partial' && (
              <div className="kv__row">
                <dt>入金済み</dt>
                <dd>
                  <input
                    className="input input--short"
                    type="number"
                    inputMode="numeric"
                    value={contest.entry.paidAmount ?? 0}
                    onChange={(event) => patchEntry({ paidAmount: Number(event.target.value) })}
                  />
                  <span className="kv__suffix">
                    / {yen(contest.entry.fee)}（残り {yen(Math.max(contest.entry.fee - (contest.entry.paidAmount ?? 0), 0))}）
                  </span>
                </dd>
              </div>
            )}
            <div className="kv__row">
              <dt>入金日</dt>
              <dd>
                <input
                  className="input input--short"
                  type="date"
                  value={contest.entry.paidOn ?? ''}
                  onChange={(event) => patchEntry({ paidOn: event.target.value })}
                />
              </dd>
            </div>
          </dl>

          <textarea
            className="textarea"
            rows={2}
            value={contest.entry.method ?? ''}
            placeholder="振込先・支払い方法のメモ"
            onChange={(event) => patchEntry({ method: event.target.value })}
          />

          {!isPaymentSettled(contest) && contest.entry.status !== 'partial' && (
            <button type="button" className="btn btn--primary" onClick={() => patchEntry({ status: 'paid', paidOn: toDateKey(now) })}>
              入金済みにする
            </button>
          )}
        </Card>

        <Card title="音源" label="MUSIC">
          <div className="music-status">
            <div className="segmented segmented--wrap">
              {MUSIC_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`segmented__item ${contest.music.status === option ? 'is-active' : ''}`}
                  onClick={() =>
                    patchMusic({
                      status: option,
                      submittedOn:
                        option === 'submitted' && !contest.music.submittedOn
                          ? toDateKey(now)
                          : contest.music.submittedOn,
                    })
                  }
                >
                  {MUSIC_LABELS[option]}
                </button>
              ))}
            </div>

            <label className={`check-toggle ${contest.music.bringOnDay ? 'is-on' : ''}`}>
              <input
                type="checkbox"
                checked={Boolean(contest.music.bringOnDay)}
                onChange={(event) => patchMusic({ bringOnDay: event.target.checked })}
              />
              <span>当日持参</span>
            </label>
          </div>

          {contest.music.bringOnDay && (
            <p className="hint hint--accent">
              当日会場に持ち込む設定です。事前提出が未了でも準備は済み扱いになり、提出期限の通知は出しません。
            </p>
          )}

          <dl className="kv">
            <div className="kv__row">
              <dt>曲</dt>
              <dd>
                <input
                  className="input"
                  value={contest.music.title ?? ''}
                  placeholder="曲名 / アーティスト"
                  onChange={(event) => patchMusic({ title: event.target.value })}
                />
              </dd>
            </div>
            <div className="kv__row">
              <dt>提出期限</dt>
              <dd>
                <input
                  className="input input--short"
                  type="date"
                  value={contest.music.dueDate ?? ''}
                  onChange={(event) => patchMusic({ dueDate: event.target.value })}
                />
              </dd>
            </div>
            <div className="kv__row">
              <dt>提出日</dt>
              <dd>
                <input
                  className="input input--short"
                  type="date"
                  value={contest.music.submittedOn ?? ''}
                  onChange={(event) => patchMusic({ submittedOn: event.target.value })}
                />
              </dd>
            </div>
            <div className="kv__row">
              <dt>提出方法</dt>
              <dd>
                <input
                  className="input"
                  value={contest.music.method ?? ''}
                  placeholder="フォーム / メール / 当日 USB"
                  onChange={(event) => patchMusic({ method: event.target.value })}
                />
              </dd>
            </div>
          </dl>

          <textarea
            className="textarea"
            rows={2}
            value={contest.music.note ?? ''}
            placeholder="尺、編集の有無、バックアップなど"
            onChange={(event) => patchMusic({ note: event.target.value })}
          />

          {contest.music.status !== 'submitted' && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => patchMusic({ status: 'submitted', submittedOn: toDateKey(now) })}
            >
              提出済みにする
            </button>
          )}
        </Card>

        <Card title="会場" label="VENUE">
          <p className="venue__name">{contest.venue.name || <Blank>会場未定</Blank>}</p>
          {contest.venue.address ? (
            <p className="venue__address">{contest.venue.address}</p>
          ) : (
            <p className="venue__address">
              <Blank>住所が未入力です（編集画面から追加できます）</Blank>
            </p>
          )}

          {canOpenMap(contest.venue) ? (
            <div className="map-links">
              <a className="btn btn--primary" href={googleMapsUrl(contest.venue)} target="_blank" rel="noreferrer">
                Google マップで開く
              </a>
              <a className="btn btn--ghost" href={directionsUrl(contest.venue)} target="_blank" rel="noreferrer">
                経路
              </a>
            </div>
          ) : (
            <p className="hint">会場名か住所を入れると地図を開けます。</p>
          )}

          <textarea
            className="textarea"
            rows={2}
            value={contest.venue.note ?? ''}
            placeholder="入口、楽屋、最寄り駅からの行き方"
            onChange={(event) => patch({ venue: { ...contest.venue, note: event.target.value } })}
          />
        </Card>

        <FinalPanel contest={contest} now={now} onChange={(final) => patch({ final })} />

        <JudgePanel judges={contest.judges} onChange={(judges) => patch({ judges })} />

        <Card title="リマインダー" label="REMINDERS">
          <ul className="reminder-list">
            {contest.reminders.map((reminder) => (
              <li key={reminder.id} className="reminder">
                <label className="reminder__toggle">
                  <input
                    type="checkbox"
                    checked={reminder.enabled}
                    onChange={(event) =>
                      setReminders(
                        contest.reminders.map((item) =>
                          item.id === reminder.id ? { ...item, enabled: event.target.checked } : item,
                        ),
                      )
                    }
                  />
                  <span className="reminder__label">{reminderLabel(reminder)}</span>
                </label>
                <span className="reminder__at">
                  {formatDateJa(toDateKey(reminderDateTime(contest, reminder)))} {reminder.time}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="このリマインダーを削除"
                  onClick={() => setReminders(contest.reminders.filter((item) => item.id !== reminder.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          <div className="reminder-add">
            <input
              className="input input--tiny"
              type="number"
              min={0}
              value={newReminderDays}
              onChange={(event) => setNewReminderDays(Math.max(Number(event.target.value), 0))}
            />
            <span className="reminder-add__unit">日前の</span>
            <input
              className="input input--short"
              type="time"
              value={newReminderTime}
              onChange={(event) => setNewReminderTime(event.target.value)}
            />
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                setReminders([
                  ...contest.reminders,
                  { id: createId('rem'), daysBefore: newReminderDays, time: newReminderTime, enabled: true },
                ])
              }
            >
              追加
            </button>
          </div>

          <button type="button" className="btn btn--primary" onClick={() => downloadIcs([contest], `${contest.name || 'contest'}.ics`)}>
            カレンダーに追加（.ics）
          </button>
          <p className="hint">
            書き出したファイルをタップすると、スマホの標準カレンダーに予定とアラームごと登録できます。
          </p>
        </Card>

        <Card title="当日メモ" label="NOTES">
          <textarea
            className="textarea"
            rows={4}
            value={contest.memo ?? ''}
            placeholder="持ち物、集合時間、動き方"
            onChange={(event) => patch({ memo: event.target.value })}
          />
        </Card>

        <ReviewPanel review={contest.review} isPast={phase === 'past'} onChange={(review) => patch({ review })} />

        <ShareCard contest={contest} />

        <button type="button" className="btn btn--danger" onClick={onDelete}>
          このコンテストを削除
        </button>
      </div>
    </div>
  )
}
