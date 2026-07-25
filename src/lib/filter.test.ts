import { describe, expect, it } from 'vitest'
import type { EmailAddress, Message } from '../types'
import { buildMailTree } from './tree'
import { filterTree } from './filter'

const OURS = ['sample-sol.co.jp']
const tanaka: EmailAddress = { name: '田中', address: 'tanaka@sample-sol.co.jp' }
const yamada: EmailAddress = { name: '山田 太郎', address: 'yamada@kokyaku.co.jp' }
const nakamura: EmailAddress = { name: '中村', address: 'nakamura@betsu.jp' }

const messages: Message[] = [
  {
    id: 'm1',
    threadId: 't1',
    subject: '見積書の件',
    from: yamada,
    to: [tanaka],
    sentAt: '2026-01-01T09:00:00Z',
    body: '御見積をお願いします',
  },
  {
    id: 'm2',
    threadId: 't2',
    subject: '納期のご相談',
    from: nakamura,
    to: [tanaka],
    sentAt: '2026-01-02T09:00:00Z',
    body: '納期を早められますか',
  },
  {
    id: 'm3',
    threadId: 't2',
    subject: 'Re: 納期のご相談',
    from: tanaka,
    to: [nakamura],
    sentAt: '2026-01-02T10:00:00Z',
    body: '確認いたします',
  },
]

const tree = buildMailTree(messages, OURS)

describe('filterTree', () => {
  it('条件が無ければ元のツリーをそのまま返す', () => {
    expect(filterTree(tree, { query: '', onlyWaiting: false })).toBe(tree)
  })

  it('未対応のみに絞り込む', () => {
    const filtered = filterTree(tree, { query: '', onlyWaiting: true })
    expect(filtered.summary.threadCount).toBe(1)
    expect(filtered.summary.waitingCount).toBe(1)
    expect(filtered.domains[0].domain).toBe('kokyaku.co.jp')
  })

  it('件名で絞り込む', () => {
    const filtered = filterTree(tree, { query: '納期', onlyWaiting: false })
    expect(filtered.domains.map((d) => d.domain)).toEqual(['betsu.jp'])
  })

  it('本文で絞り込む', () => {
    const filtered = filterTree(tree, { query: '御見積', onlyWaiting: false })
    expect(filtered.domains.map((d) => d.domain)).toEqual(['kokyaku.co.jp'])
  })

  it('アドレスや表示名でも絞り込める', () => {
    expect(filterTree(tree, { query: 'YAMADA@', onlyWaiting: false }).summary.threadCount).toBe(1)
    expect(filterTree(tree, { query: '山田', onlyWaiting: false }).summary.threadCount).toBe(1)
  })

  it('該当が無ければ空になる', () => {
    const filtered = filterTree(tree, { query: '存在しない語句', onlyWaiting: false })
    expect(filtered.domains).toHaveLength(0)
    expect(filtered.summary.threadCount).toBe(0)
  })

  it('絞り込み後の集計値を計算し直す', () => {
    const filtered = filterTree(tree, { query: '納期', onlyWaiting: false })
    expect(filtered.summary).toEqual({
      domainCount: 1,
      contactCount: 1,
      threadCount: 1,
      waitingCount: 0,
      answeredCount: 1,
    })
  })
})
