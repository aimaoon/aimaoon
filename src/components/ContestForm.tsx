import { useState } from 'react'
import type { Contest } from '../types'
import { createFinal } from '../lib/factory'
import { Card, Field } from './ui'

/**
 * 新規登録・編集フォーム。
 * ここでは「あとから変わりにくい情報」を扱う。入金状況や音源の提出状況は詳細画面で直接切り替える。
 */
export function ContestForm({
  initial,
  isNew,
  onSave,
  onCancel,
}: {
  initial: Contest
  isNew: boolean
  onSave: (contest: Contest) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Contest>(initial)

  const patch = (changes: Partial<Contest>) => setDraft((prev) => ({ ...prev, ...changes }))
  const canSave = draft.name.trim().length > 0 && Boolean(draft.date)

  const submit = () => {
    if (!canSave) return
    onSave({ ...draft, name: draft.name.trim(), updatedAt: new Date().toISOString() })
  }

  return (
    <div className="detail">
      <header className="detail__bar">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          キャンセル
        </button>
        <span className="detail__bar-title">{isNew ? 'コンテストを追加' : 'コンテストを編集'}</span>
        <button type="button" className="btn btn--primary btn--sm" onClick={submit} disabled={!canSave}>
          保存
        </button>
      </header>

      <div className="view">
        <Card title="基本" icon="🏆">
          <Field label="大会名">
            <input
              className="input"
              value={draft.name}
              placeholder="TOKYO DANCE BATTLE vol.8"
              onChange={(event) => patch({ name: event.target.value })}
            />
          </Field>
          <Field label="部門・カテゴリ">
            <input
              className="input"
              value={draft.category ?? ''}
              placeholder="HIPHOP 2on2 / SOLO など"
              onChange={(event) => patch({ category: event.target.value })}
            />
          </Field>
          <Field label="開催日">
            <input
              className="input"
              type="date"
              value={draft.date}
              onChange={(event) => patch({ date: event.target.value })}
            />
          </Field>
          <div className="field-row">
            <Field label="集合・開始">
              <input
                className="input"
                type="time"
                value={draft.startTime ?? ''}
                onChange={(event) => patch({ startTime: event.target.value })}
              />
            </Field>
            <Field label="終了予定">
              <input
                className="input"
                type="time"
                value={draft.endTime ?? ''}
                onChange={(event) => patch({ endTime: event.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="会場" icon="📍">
          <Field label="会場名">
            <input
              className="input"
              value={draft.venue.name}
              placeholder="渋谷 WOMB"
              onChange={(event) => patch({ venue: { ...draft.venue, name: event.target.value } })}
            />
          </Field>
          <Field label="住所" hint="地図アプリを開くのに使います">
            <input
              className="input"
              value={draft.venue.address ?? ''}
              placeholder="東京都渋谷区円山町2-16"
              onChange={(event) => patch({ venue: { ...draft.venue, address: event.target.value } })}
            />
          </Field>
          <div className="field-row">
            <Field label="緯度" hint="任意">
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={draft.venue.lat ?? ''}
                onChange={(event) =>
                  patch({ venue: { ...draft.venue, lat: event.target.value === '' ? undefined : Number(event.target.value) } })
                }
              />
            </Field>
            <Field label="経度" hint="任意">
              <input
                className="input"
                type="number"
                inputMode="decimal"
                value={draft.venue.lng ?? ''}
                onChange={(event) =>
                  patch({ venue: { ...draft.venue, lng: event.target.value === '' ? undefined : Number(event.target.value) } })
                }
              />
            </Field>
          </div>
        </Card>

        <Card title="ファイナル" icon="🔥">
          {draft.final ? (
            <>
              <Field label="開催日" hint="未発表なら空のままで構いません">
                <input
                  className="input"
                  type="date"
                  value={draft.final.date ?? ''}
                  onChange={(event) => patch({ final: { ...draft.final!, date: event.target.value || undefined } })}
                />
              </Field>
              <Field label="集合・開始">
                <input
                  className="input"
                  type="time"
                  value={draft.final.startTime ?? ''}
                  onChange={(event) => patch({ final: { ...draft.final!, startTime: event.target.value } })}
                />
              </Field>
              <Field label="会場" hint="空欄なら予選と同じ会場">
                <input
                  className="input"
                  value={draft.final.venue?.name ?? ''}
                  placeholder={draft.venue.name || '会場名'}
                  onChange={(event) =>
                    patch({
                      final: { ...draft.final!, venue: { ...(draft.final!.venue ?? { name: '' }), name: event.target.value } },
                    })
                  }
                />
              </Field>
              <button type="button" className="btn btn--ghost" onClick={() => patch({ final: undefined })}>
                ファイナルの予定を外す
              </button>
            </>
          ) : (
            <>
              <p className="hint">予選を勝ち抜いた先の決勝がある大会は、ここで日程も押さえておけます。</p>
              <button type="button" className="btn btn--ghost" onClick={() => patch({ final: createFinal(draft.date) })}>
                ファイナルの予定を追加
              </button>
            </>
          )}
        </Card>

        <Card title="エントリー費" icon="💰">
          <Field label="金額（円）">
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={draft.entry.fee}
              onChange={(event) => patch({ entry: { ...draft.entry, fee: Number(event.target.value) } })}
            />
          </Field>
          <Field label="入金期限" hint="設定すると期限の通知が出ます">
            <input
              className="input"
              type="date"
              value={draft.entry.dueDate ?? ''}
              onChange={(event) => patch({ entry: { ...draft.entry, dueDate: event.target.value } })}
            />
          </Field>
          <Field label="支払い方法">
            <input
              className="input"
              value={draft.entry.method ?? ''}
              placeholder="銀行振込 / PayPay など"
              onChange={(event) => patch({ entry: { ...draft.entry, method: event.target.value } })}
            />
          </Field>
        </Card>

        <Card title="音源" icon="🎵">
          <Field label="曲名">
            <input
              className="input"
              value={draft.music.title ?? ''}
              onChange={(event) => patch({ music: { ...draft.music, title: event.target.value } })}
            />
          </Field>
          <Field label="提出期限">
            <input
              className="input"
              type="date"
              value={draft.music.dueDate ?? ''}
              onChange={(event) => patch({ music: { ...draft.music, dueDate: event.target.value } })}
            />
          </Field>
          <Field label="提出方法">
            <input
              className="input"
              value={draft.music.method ?? ''}
              placeholder="Google フォーム / メール / 当日 USB"
              onChange={(event) => patch({ music: { ...draft.music, method: event.target.value } })}
            />
          </Field>
        </Card>

        <button type="button" className="btn btn--primary btn--block" onClick={submit} disabled={!canSave}>
          {isNew ? 'この内容で追加' : '保存する'}
        </button>
      </div>
    </div>
  )
}
