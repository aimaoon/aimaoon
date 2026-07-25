import type { ContactNode, DomainNode, MailTree, ThreadNode } from './tree'
import { participantsOf } from './address'

export interface TreeFilter {
  /** 件名 / 本文 / アドレス / 表示名を対象にした部分一致 */
  query: string
  /** 未対応スレッドだけに絞り込む */
  onlyWaiting: boolean
}

function threadMatchesQuery(thread: ThreadNode, needle: string): boolean {
  if (thread.subject.toLowerCase().includes(needle)) return true
  return thread.messages.some((message) => {
    if (message.subject.toLowerCase().includes(needle)) return true
    if (message.body.toLowerCase().includes(needle)) return true
    return participantsOf(message).some(
      (person) =>
        person.address.toLowerCase().includes(needle) ||
        (person.name ?? '').toLowerCase().includes(needle),
    )
  })
}

/**
 * ツリーの形を保ったまま絞り込む。集計値（未対応件数など）は
 * 絞り込み後の内容にあわせて計算し直す。
 */
export function filterTree(tree: MailTree, filter: TreeFilter): MailTree {
  const needle = filter.query.trim().toLowerCase()
  if (!needle && !filter.onlyWaiting) return tree

  const domains: DomainNode[] = []
  for (const domain of tree.domains) {
    const contacts: ContactNode[] = []
    for (const contact of domain.contacts) {
      const threads = contact.threads.filter((thread) => {
        if (filter.onlyWaiting && thread.status !== 'waiting') return false
        if (needle && !threadMatchesQuery(thread, needle)) return false
        return true
      })
      if (threads.length === 0) continue
      contacts.push({
        ...contact,
        threads,
        waitingCount: threads.filter((t) => t.status === 'waiting').length,
        answeredCount: threads.filter((t) => t.status !== 'waiting').length,
      })
    }
    if (contacts.length === 0) continue
    domains.push({
      ...domain,
      contacts,
      threadCount: contacts.reduce((total, c) => total + c.threads.length, 0),
      waitingCount: contacts.reduce((total, c) => total + c.waitingCount, 0),
      answeredCount: contacts.reduce((total, c) => total + c.answeredCount, 0),
    })
  }

  return {
    domains,
    summary: {
      domainCount: domains.length,
      contactCount: domains.reduce((total, d) => total + d.contacts.length, 0),
      threadCount: domains.reduce((total, d) => total + d.threadCount, 0),
      waitingCount: domains.reduce((total, d) => total + d.waitingCount, 0),
      answeredCount: domains.reduce((total, d) => total + d.answeredCount, 0),
    },
  }
}
