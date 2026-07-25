import { describe, expect, it } from 'vitest'
import type { EmailAddress, Message } from '../types'
import { buildMailTree, statusOfMessages } from './tree'

const OURS = ['sample-sol.co.jp']

const tanaka: EmailAddress = { name: '田中', address: 'tanaka@sample-sol.co.jp' }
const sato: EmailAddress = { name: '佐藤', address: 'sato@sample-sol.co.jp' }
const suzuki: EmailAddress = { name: '鈴木', address: 'suzuki@support.sample-sol.co.jp' }
const yamada: EmailAddress = { name: '山田', address: 'yamada@kokyaku.co.jp' }
const inoue: EmailAddress = { name: '井上', address: 'inoue@kokyaku.co.jp' }
const nakamura: EmailAddress = { name: '中村', address: 'nakamura@betsu.jp' }

let seq = 0
function mail(
  threadId: string,
  from: EmailAddress,
  to: EmailAddress[],
  sentAt: string,
  extra: Partial<Message> = {},
): Message {
  seq += 1
  return {
    id: `m${seq}`,
    threadId,
    subject: `件名 ${threadId}`,
    from,
    to,
    sentAt,
    body: '本文',
    ...extra,
  }
}

describe('statusOfMessages', () => {
  it('最後が自社ドメインなら対応済み', () => {
    const messages = [
      mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z'),
      mail('t1', tanaka, [yamada], '2026-01-01T10:00:00Z'),
    ]
    expect(statusOfMessages(messages, OURS)).toBe('answered')
  })

  it('最後が社外なら未対応', () => {
    const messages = [
      mail('t1', tanaka, [yamada], '2026-01-01T09:00:00Z'),
      mail('t1', yamada, [tanaka], '2026-01-01T10:00:00Z'),
    ]
    expect(statusOfMessages(messages, OURS)).toBe('waiting')
  })

  it('担当者が別人でも、自社ドメインなら対応済みとみなす', () => {
    const messages = [
      mail('t1', tanaka, [yamada], '2026-01-01T09:00:00Z'),
      mail('t1', yamada, [tanaka], '2026-01-01T10:00:00Z'),
      mail('t1', sato, [yamada], '2026-01-01T11:00:00Z'),
    ]
    expect(statusOfMessages(messages, OURS)).toBe('answered')
  })

  it('自社ドメインのサブドメインからの返信も対応済み', () => {
    const messages = [
      mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z'),
      mail('t1', suzuki, [yamada], '2026-01-01T10:00:00Z'),
    ]
    expect(statusOfMessages(messages, OURS)).toBe('answered')
  })

  it('メールが無ければ unknown', () => {
    expect(statusOfMessages([], OURS)).toBe('unknown')
  })
})

describe('buildMailTree', () => {
  it('社外ドメイン → 社外アドレス → スレッドの階層を作る', () => {
    const tree = buildMailTree(
      [
        mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z'),
        mail('t1', tanaka, [yamada], '2026-01-01T10:00:00Z'),
        mail('t2', inoue, [tanaka], '2026-01-02T09:00:00Z'),
        mail('t3', nakamura, [tanaka], '2026-01-03T09:00:00Z'),
      ],
      OURS,
    )

    expect(tree.domains.map((d) => d.domain).sort()).toEqual(['betsu.jp', 'kokyaku.co.jp'])
    const kokyaku = tree.domains.find((d) => d.domain === 'kokyaku.co.jp')!
    expect(kokyaku.contacts.map((c) => c.address).sort()).toEqual([
      'inoue@kokyaku.co.jp',
      'yamada@kokyaku.co.jp',
    ])
    expect(tree.summary.threadCount).toBe(3)
  })

  it('自社アドレスはツリーの見出しにならない', () => {
    const tree = buildMailTree([mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z')], OURS)
    expect(tree.domains.map((d) => d.domain)).not.toContain('sample-sol.co.jp')
  })

  it('社内だけのスレッドは除外する', () => {
    const tree = buildMailTree([mail('t1', tanaka, [sato], '2026-01-01T09:00:00Z')], OURS)
    expect(tree.domains).toHaveLength(0)
    expect(tree.summary.threadCount).toBe(0)
  })

  it('未対応スレッドがあれば、アドレスもドメインも未対応になる', () => {
    const tree = buildMailTree(
      [
        mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z'),
        mail('t1', tanaka, [yamada], '2026-01-01T10:00:00Z'),
        mail('t2', yamada, [tanaka], '2026-01-02T09:00:00Z'),
      ],
      OURS,
    )
    const contact = tree.domains[0].contacts[0]
    expect(contact.status).toBe('waiting')
    expect(contact.waitingCount).toBe(1)
    expect(contact.answeredCount).toBe(1)
    expect(tree.domains[0].status).toBe('waiting')
  })

  it('すべて返信済みならドメインは対応済みになる', () => {
    const tree = buildMailTree(
      [
        mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z'),
        mail('t1', sato, [yamada], '2026-01-01T10:00:00Z'),
      ],
      OURS,
    )
    expect(tree.domains[0].status).toBe('answered')
    expect(tree.summary.waitingCount).toBe(0)
  })

  it('最終対応者と最終送信者を記録する', () => {
    const tree = buildMailTree(
      [
        mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z'),
        mail('t1', tanaka, [yamada], '2026-01-01T10:00:00Z'),
        mail('t1', yamada, [tanaka], '2026-01-01T11:00:00Z'),
        mail('t1', sato, [yamada], '2026-01-01T12:00:00Z'),
      ],
      OURS,
    )
    const thread = tree.domains[0].contacts[0].threads[0]
    expect(thread.lastInternalResponder?.address).toBe(sato.address)
    expect(thread.lastExternalSender?.address).toBe(yamada.address)
    expect(thread.status).toBe('answered')
    expect(thread.pendingSince).toBeNull()
  })

  it('pendingSince は自社の最終返信より後の、最初の社外メールを指す', () => {
    const tree = buildMailTree(
      [
        mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z'),
        mail('t1', tanaka, [yamada], '2026-01-01T10:00:00Z'),
        mail('t1', yamada, [tanaka], '2026-01-01T11:00:00Z'),
        mail('t1', yamada, [tanaka], '2026-01-01T15:00:00Z'),
      ],
      OURS,
    )
    const thread = tree.domains[0].contacts[0].threads[0]
    expect(thread.status).toBe('waiting')
    expect(thread.pendingSince).toBe('2026-01-01T11:00:00Z')
  })

  it('一度も返信していないスレッドは最初のメールが pendingSince になる', () => {
    const tree = buildMailTree(
      [
        mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z'),
        mail('t1', yamada, [tanaka], '2026-01-01T12:00:00Z'),
      ],
      OURS,
    )
    expect(tree.domains[0].contacts[0].threads[0].pendingSince).toBe('2026-01-01T09:00:00Z')
  })

  it('自社発信で相手からの返信待ちのスレッドは対応済みとして扱う', () => {
    const tree = buildMailTree([mail('t1', tanaka, [yamada], '2026-01-01T09:00:00Z')], OURS)
    const contact = tree.domains[0].contacts[0]
    expect(contact.address).toBe(yamada.address)
    expect(contact.threads[0].status).toBe('answered')
    expect(contact.threads[0].lastInternalResponder?.address).toBe(tanaka.address)
    expect(contact.threads[0].lastExternalSender).toBeNull()
  })

  it('スレッドは最初に送ってきた社外の人にひもづく', () => {
    const tree = buildMailTree(
      [
        mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z', { cc: [inoue] }),
        mail('t1', inoue, [tanaka], '2026-01-01T10:00:00Z'),
      ],
      OURS,
    )
    expect(tree.domains[0].contacts).toHaveLength(1)
    const contact = tree.domains[0].contacts[0]
    expect(contact.address).toBe(yamada.address)
    expect(contact.threads[0].otherExternalParticipants.map((p) => p.address)).toEqual([
      inoue.address,
    ])
  })

  it('メールの順序が前後していても正しく並べ替える', () => {
    const tree = buildMailTree(
      [
        mail('t1', tanaka, [yamada], '2026-01-01T10:00:00Z'),
        mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z'),
      ],
      OURS,
    )
    const thread = tree.domains[0].contacts[0].threads[0]
    expect(thread.messages.map((m) => m.sentAt)).toEqual([
      '2026-01-01T09:00:00Z',
      '2026-01-01T10:00:00Z',
    ])
    expect(thread.status).toBe('answered')
  })

  it('未対応のドメインを先頭に、放置が長い順で並べる', () => {
    const tree = buildMailTree(
      [
        // betsu.jp: 対応済み
        mail('t1', nakamura, [tanaka], '2026-01-05T09:00:00Z'),
        mail('t1', tanaka, [nakamura], '2026-01-05T10:00:00Z'),
        // kokyaku.co.jp: 未対応（古い）
        mail('t2', yamada, [tanaka], '2026-01-02T09:00:00Z'),
      ],
      OURS,
    )
    expect(tree.domains.map((d) => d.domain)).toEqual(['kokyaku.co.jp', 'betsu.jp'])
  })

  it('自社ドメインを空にすると、すべて未対応として扱われる', () => {
    const tree = buildMailTree(
      [
        mail('t1', yamada, [tanaka], '2026-01-01T09:00:00Z'),
        mail('t1', tanaka, [yamada], '2026-01-01T10:00:00Z'),
      ],
      [],
    )
    expect(tree.summary.waitingCount).toBe(1)
  })
})
