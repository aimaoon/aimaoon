import { displayNameOf } from '../lib/address'
import { formatElapsed, urgencyOf } from '../lib/format'
import type { ContactNode, DomainNode, MailTree, ThreadNode } from '../lib/tree'
import { StatusBadge } from './StatusBadge'

interface Props {
  tree: MailTree
  selectedThreadId: string | null
  expandedKeys: Set<string>
  onToggle: (key: string) => void
  onSelectThread: (thread: ThreadNode) => void
}

/** 未対応の放置時間を「◯◯放置」という補足文にする。 */
function pendingNote(pendingSince: string | null): string | undefined {
  if (!pendingSince) return undefined
  return `${formatElapsed(pendingSince)}から`
}

function ThreadRow({
  thread,
  selected,
  onSelect,
}: {
  thread: ThreadNode
  selected: boolean
  onSelect: () => void
}) {
  const urgency = urgencyOf(thread.pendingSince)
  const responder = thread.lastInternalResponder

  return (
    <li>
      <button
        type="button"
        className={`row row--thread ${selected ? 'row--selected' : ''}`}
        onClick={onSelect}
      >
        <span className="row__main">
          <span className="row__title">{thread.subject}</span>
          <span className="row__meta">
            {thread.messages.length}通 ・ 最終 {formatElapsed(thread.lastMessage.sentAt)}
            {thread.status === 'answered' && responder ? (
              <> ・ 最終対応 {displayNameOf(responder)}</>
            ) : null}
          </span>
        </span>
        <StatusBadge status={thread.status} urgency={urgency} note={pendingNote(thread.pendingSince)} />
      </button>
    </li>
  )
}

function ContactBranch({
  contact,
  expandedKeys,
  onToggle,
  selectedThreadId,
  onSelectThread,
}: {
  contact: ContactNode
} & Omit<Props, 'tree'>) {
  const key = `contact:${contact.address}`
  const expanded = expandedKeys.has(key)

  return (
    <li>
      <button
        type="button"
        className="row row--contact"
        onClick={() => onToggle(key)}
        aria-expanded={expanded}
      >
        <span className={`caret ${expanded ? 'caret--open' : ''}`} aria-hidden="true" />
        <span className="row__main">
          <span className="row__title">{contact.name}</span>
          <span className="row__meta">
            {contact.address} ・ {contact.threads.length}スレッド
            {contact.waitingCount > 0 ? ` ・ 要対応 ${contact.waitingCount}` : ''}
          </span>
        </span>
        <StatusBadge
          status={contact.status}
          urgency={urgencyOf(contact.oldestPendingSince)}
          note={pendingNote(contact.oldestPendingSince)}
        />
      </button>

      {expanded ? (
        <ul className="tree__children">
          {contact.threads.map((thread) => (
            <ThreadRow
              key={thread.threadId}
              thread={thread}
              selected={thread.threadId === selectedThreadId}
              onSelect={() => onSelectThread(thread)}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function DomainBranch({
  domain,
  expandedKeys,
  onToggle,
  selectedThreadId,
  onSelectThread,
}: {
  domain: DomainNode
} & Omit<Props, 'tree'>) {
  const key = `domain:${domain.domain}`
  const expanded = expandedKeys.has(key)

  return (
    <li>
      <button
        type="button"
        className="row row--domain"
        onClick={() => onToggle(key)}
        aria-expanded={expanded}
      >
        <span className={`caret ${expanded ? 'caret--open' : ''}`} aria-hidden="true" />
        <span className="row__main">
          <span className="row__title">@{domain.domain}</span>
          <span className="row__meta">
            {domain.contacts.length}名 ・ {domain.threadCount}スレッド ・ 要対応{' '}
            {domain.waitingCount} / 対応済み {domain.answeredCount}
          </span>
        </span>
        <StatusBadge
          status={domain.status}
          urgency={urgencyOf(domain.oldestPendingSince)}
          note={pendingNote(domain.oldestPendingSince)}
        />
      </button>

      {expanded ? (
        <ul className="tree__children">
          {domain.contacts.map((contact) => (
            <ContactBranch
              key={contact.address}
              contact={contact}
              expandedKeys={expandedKeys}
              onToggle={onToggle}
              selectedThreadId={selectedThreadId}
              onSelectThread={onSelectThread}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/** 社外ドメイン → 社外アドレス → スレッドの 3 階層ツリー。 */
export function TreeView({ tree, ...rest }: Props) {
  if (tree.domains.length === 0) {
    return <p className="empty">条件に一致するメールはありません。</p>
  }

  return (
    <ul className="tree">
      {tree.domains.map((domain) => (
        <DomainBranch key={domain.domain} domain={domain} {...rest} />
      ))}
    </ul>
  )
}
