import type { EmailAddress, Message, ThreadStatus } from '../types'
import {
  displayNameOf,
  domainOf,
  isInternalAddress,
  normalizeAddress,
  participantsOf,
} from './address'

/** スレッド 1 件（＝ お客様との 1 つのやりとり）。 */
export interface ThreadNode {
  threadId: string
  subject: string
  /** 送信日時の昇順 */
  messages: Message[]
  lastMessage: Message
  status: ThreadStatus
  /** 自社側で最後に返信した人。まだ誰も返していなければ null */
  lastInternalResponder: EmailAddress | null
  /** 社外から最後に送ってきた人 */
  lastExternalSender: EmailAddress | null
  /**
   * 未対応スレッドで「ボールが自社に渡った時刻」。
   * 自社の最終返信より後にきた、最初の社外メールの送信日時。
   * 対応済みスレッドでは null。
   */
  pendingSince: string | null
  /** このスレッドに関わっている、主担当以外の社外アドレス */
  otherExternalParticipants: EmailAddress[]
}

/** 社外アドレス 1 件（ツリーの第 2 階層）。 */
export interface ContactNode {
  address: string
  name: string
  domain: string
  /** 未対応 → 対応済みの順、同状態内は最終更新の新しい順 */
  threads: ThreadNode[]
  waitingCount: number
  answeredCount: number
  status: ThreadStatus
  lastActivityAt: string
  /** 未対応スレッドのうち、最も長く放置されている時刻 */
  oldestPendingSince: string | null
}

/** 社外ドメイン 1 件（ツリーの第 1 階層＝おおむね「お客様の会社」）。 */
export interface DomainNode {
  domain: string
  contacts: ContactNode[]
  threadCount: number
  waitingCount: number
  answeredCount: number
  status: ThreadStatus
  lastActivityAt: string
  oldestPendingSince: string | null
}

export interface TreeSummary {
  domainCount: number
  contactCount: number
  threadCount: number
  waitingCount: number
  answeredCount: number
}

export interface MailTree {
  domains: DomainNode[]
  summary: TreeSummary
}

const bySentAtAsc = (a: Message, b: Message) =>
  Date.parse(a.sentAt) - Date.parse(b.sentAt) || a.id.localeCompare(b.id)

/**
 * スレッドの対応状況を判定する。
 *
 * 最後のメールの送信者が自社ドメインなら「対応済み」。送信者が誰であっても、
 * 自社ドメインでありさえすれば対応済みとみなす（担当者が変わっていても、
 * 同じ会社の人間が返していれば OK、という考え方）。
 */
export function statusOfMessages(messages: Message[], ourDomains: string[]): ThreadStatus {
  if (messages.length === 0) return 'unknown'
  const last = messages[messages.length - 1]
  return isInternalAddress(last.from.address, ourDomains) ? 'answered' : 'waiting'
}

/** 未対応スレッドで、ボールが自社に渡った時刻を求める。 */
function findPendingSince(messages: Message[], ourDomains: string[]): string | null {
  let pendingSince: string | null = null
  for (const message of messages) {
    if (isInternalAddress(message.from.address, ourDomains)) {
      // 自社が返信した時点でボールは相手に戻る
      pendingSince = null
    } else if (pendingSince === null) {
      pendingSince = message.sentAt
    }
  }
  return pendingSince
}

/**
 * スレッドの主担当となる社外アドレスを決める。
 * 社外からの送信者のうち最初に登場した人を優先し、社外送信者がいなければ
 * （自社からの一方通行のスレッド）最初の社外宛先を使う。
 */
function primaryContactOf(messages: Message[], ourDomains: string[]): EmailAddress | null {
  for (const message of messages) {
    if (!isInternalAddress(message.from.address, ourDomains)) return message.from
  }
  for (const message of messages) {
    for (const person of [...message.to, ...(message.cc ?? [])]) {
      if (!isInternalAddress(person.address, ourDomains)) return person
    }
  }
  return null
}

function buildThreadNode(
  threadId: string,
  rawMessages: Message[],
  ourDomains: string[],
  primary: EmailAddress,
): ThreadNode {
  const messages = [...rawMessages].sort(bySentAtAsc)
  const lastMessage = messages[messages.length - 1]

  let lastInternalResponder: EmailAddress | null = null
  let lastExternalSender: EmailAddress | null = null
  for (const message of messages) {
    if (isInternalAddress(message.from.address, ourDomains)) lastInternalResponder = message.from
    else lastExternalSender = message.from
  }

  const status = statusOfMessages(messages, ourDomains)
  const primaryKey = normalizeAddress(primary.address)
  const others = new Map<string, EmailAddress>()
  for (const message of messages) {
    for (const person of participantsOf(message)) {
      const key = normalizeAddress(person.address)
      if (key === primaryKey) continue
      if (isInternalAddress(person.address, ourDomains)) continue
      if (!others.has(key)) others.set(key, person)
    }
  }

  return {
    threadId,
    subject: messages[0].subject,
    messages,
    lastMessage,
    status,
    lastInternalResponder,
    lastExternalSender,
    pendingSince: status === 'waiting' ? findPendingSince(messages, ourDomains) : null,
    otherExternalParticipants: [...others.values()],
  }
}

/** 未対応を先に、同じ状態なら最終更新の新しい順。 */
function compareThreads(a: ThreadNode, b: ThreadNode): number {
  if (a.status !== b.status) return a.status === 'waiting' ? -1 : b.status === 'waiting' ? 1 : 0
  if (a.status === 'waiting' && a.pendingSince && b.pendingSince) {
    // 未対応どうしは、放置が長い順（古い順）
    return Date.parse(a.pendingSince) - Date.parse(b.pendingSince)
  }
  return Date.parse(b.lastMessage.sentAt) - Date.parse(a.lastMessage.sentAt)
}

function compareByUrgency(
  a: { status: ThreadStatus; oldestPendingSince: string | null; lastActivityAt: string },
  b: { status: ThreadStatus; oldestPendingSince: string | null; lastActivityAt: string },
): number {
  if (a.status !== b.status) return a.status === 'waiting' ? -1 : b.status === 'waiting' ? 1 : 0
  if (a.oldestPendingSince && b.oldestPendingSince) {
    return Date.parse(a.oldestPendingSince) - Date.parse(b.oldestPendingSince)
  }
  return Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt)
}

function earliest(a: string | null, b: string | null): string | null {
  if (!a) return b
  if (!b) return a
  return Date.parse(a) <= Date.parse(b) ? a : b
}

function latest(a: string, b: string): string {
  return Date.parse(a) >= Date.parse(b) ? a : b
}

/**
 * メール一覧を「社外ドメイン → 社外アドレス → スレッド」のツリーに組み立てる。
 *
 * 自社ドメインのアドレスはツリーの見出しには使わない。あくまで「どのお客様に
 * 対して自社が対応できているか」を見るための構造にしている。
 */
export function buildMailTree(messages: Message[], ourDomains: string[]): MailTree {
  const byThread = new Map<string, Message[]>()
  for (const message of messages) {
    const bucket = byThread.get(message.threadId)
    if (bucket) bucket.push(message)
    else byThread.set(message.threadId, [message])
  }

  const contactsByAddress = new Map<string, ContactNode>()

  for (const [threadId, threadMessages] of byThread) {
    if (threadMessages.length === 0) continue
    const sorted = [...threadMessages].sort(bySentAtAsc)
    const primary = primaryContactOf(sorted, ourDomains)
    // 社外の相手が 1 人もいない＝社内メールのみ。お客様対応の可視化には出さない。
    if (!primary) continue

    const thread = buildThreadNode(threadId, sorted, ourDomains, primary)
    const key = normalizeAddress(primary.address)
    let contact = contactsByAddress.get(key)
    if (!contact) {
      contact = {
        address: key,
        name: displayNameOf(primary),
        domain: domainOf(primary.address),
        threads: [],
        waitingCount: 0,
        answeredCount: 0,
        status: 'answered',
        lastActivityAt: thread.lastMessage.sentAt,
        oldestPendingSince: null,
      }
      contactsByAddress.set(key, contact)
    }
    contact.threads.push(thread)
    if (thread.status === 'waiting') contact.waitingCount += 1
    else contact.answeredCount += 1
    contact.lastActivityAt = latest(contact.lastActivityAt, thread.lastMessage.sentAt)
    contact.oldestPendingSince = earliest(contact.oldestPendingSince, thread.pendingSince)
  }

  const domainsByName = new Map<string, DomainNode>()
  for (const contact of contactsByAddress.values()) {
    contact.threads.sort(compareThreads)
    contact.status = contact.waitingCount > 0 ? 'waiting' : 'answered'

    let domain = domainsByName.get(contact.domain)
    if (!domain) {
      domain = {
        domain: contact.domain,
        contacts: [],
        threadCount: 0,
        waitingCount: 0,
        answeredCount: 0,
        status: 'answered',
        lastActivityAt: contact.lastActivityAt,
        oldestPendingSince: null,
      }
      domainsByName.set(contact.domain, domain)
    }
    domain.contacts.push(contact)
    domain.threadCount += contact.threads.length
    domain.waitingCount += contact.waitingCount
    domain.answeredCount += contact.answeredCount
    domain.lastActivityAt = latest(domain.lastActivityAt, contact.lastActivityAt)
    domain.oldestPendingSince = earliest(domain.oldestPendingSince, contact.oldestPendingSince)
  }

  const domains = [...domainsByName.values()]
  for (const domain of domains) {
    domain.status = domain.waitingCount > 0 ? 'waiting' : 'answered'
    domain.contacts.sort(compareByUrgency)
  }
  domains.sort(compareByUrgency)

  const summary: TreeSummary = {
    domainCount: domains.length,
    contactCount: contactsByAddress.size,
    threadCount: domains.reduce((total, d) => total + d.threadCount, 0),
    waitingCount: domains.reduce((total, d) => total + d.waitingCount, 0),
    answeredCount: domains.reduce((total, d) => total + d.answeredCount, 0),
  }

  return { domains, summary }
}
