import { displayNameOf, isInternalAddress } from '../lib/address'
import { formatDateTime, formatElapsed, urgencyOf } from '../lib/format'
import type { ThreadNode } from '../lib/tree'
import type { EmailAddress } from '../types'
import { StatusBadge } from './StatusBadge'

interface Props {
  thread: ThreadNode | null
  ourDomains: string[]
}

function AddressList({ label, people }: { label: string; people: EmailAddress[] }) {
  if (people.length === 0) return null
  return (
    <div className="message__addresses">
      <span className="message__addresses-label">{label}</span>
      <span>{people.map((person) => `${displayNameOf(person)} <${person.address}>`).join(', ')}</span>
    </div>
  )
}

/** 選択したスレッドのやりとりを時系列で表示する。 */
export function ThreadDetail({ thread, ourDomains }: Props) {
  if (!thread) {
    return (
      <div className="detail detail--empty">
        <p>左のツリーからスレッドを選択してください。</p>
      </div>
    )
  }

  const urgency = urgencyOf(thread.pendingSince)

  return (
    <div className="detail">
      <header className="detail__head">
        <h2 className="detail__subject">{thread.subject}</h2>
        <StatusBadge
          status={thread.status}
          urgency={urgency}
          note={thread.pendingSince ? `${formatElapsed(thread.pendingSince)}から` : undefined}
        />
      </header>

      <dl className="detail__facts">
        <div>
          <dt>最終メール</dt>
          <dd>
            {formatDateTime(thread.lastMessage.sentAt)}（{formatElapsed(thread.lastMessage.sentAt)}）
          </dd>
        </div>
        <div>
          <dt>自社の最終対応者</dt>
          <dd>
            {thread.lastInternalResponder ? (
              <>
                {displayNameOf(thread.lastInternalResponder)}
                <span className="muted"> &lt;{thread.lastInternalResponder.address}&gt;</span>
              </>
            ) : (
              <span className="detail__alert">まだ誰も返信していません</span>
            )}
          </dd>
        </div>
        {thread.otherExternalParticipants.length > 0 ? (
          <div>
            <dt>他の社外参加者</dt>
            <dd>
              {thread.otherExternalParticipants
                .map((person) => `${displayNameOf(person)} <${person.address}>`)
                .join(', ')}
            </dd>
          </div>
        ) : null}
      </dl>

      {thread.status === 'waiting' ? (
        <p className="detail__callout detail__callout--waiting">
          最後のメールは社外（
          {thread.lastExternalSender ? displayNameOf(thread.lastExternalSender) : '不明'}
          ）からです。自社ドメインからの返信がまだありません。
        </p>
      ) : (
        <p className="detail__callout detail__callout--answered">
          最後のメールは自社ドメインから送られています。社内の誰かが対応済みです。
        </p>
      )}

      <ol className="messages">
        {thread.messages.map((message) => {
          const internal = isInternalAddress(message.from.address, ourDomains)
          return (
            <li key={message.id} className={`message message--${internal ? 'internal' : 'external'}`}>
              <div className="message__head">
                <span className="message__side">{internal ? '自社' : '社外'}</span>
                <span className="message__from">
                  {displayNameOf(message.from)}
                  <span className="muted"> &lt;{message.from.address}&gt;</span>
                </span>
                <time className="message__time" dateTime={message.sentAt}>
                  {formatDateTime(message.sentAt)}
                </time>
              </div>
              <AddressList label="To" people={message.to} />
              <AddressList label="Cc" people={message.cc ?? []} />
              <p className="message__body">{message.body}</p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
