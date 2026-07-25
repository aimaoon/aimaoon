import type { EmailAddress, Message } from '../types'

/** メールアドレスからドメイン部分を取り出す（小文字化済み）。 */
export function domainOf(address: string): string {
  const at = address.lastIndexOf('@')
  if (at < 0) return ''
  return address.slice(at + 1).trim().toLowerCase()
}

/** 比較用にドメイン文字列を正規化する（前後の空白・`@`・末尾ドットを除去）。 */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@+/, '').replace(/\.+$/, '')
}

/** 比較用にアドレスを正規化する。 */
export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase()
}

/**
 * 自社ドメインかどうか。サブドメインも自社とみなす。
 * 例: ourDomains に `example.co.jp` があれば `support.example.co.jp` も自社扱い。
 */
export function isOurDomain(domain: string, ourDomains: string[]): boolean {
  const target = normalizeDomain(domain)
  if (!target) return false
  return ourDomains.some((raw) => {
    const base = normalizeDomain(raw)
    if (!base) return false
    return target === base || target.endsWith('.' + base)
  })
}

/** そのアドレスが自社の人間のものか。 */
export function isInternalAddress(address: string, ourDomains: string[]): boolean {
  return isOurDomain(domainOf(address), ourDomains)
}

/** 表示名があれば表示名、無ければアドレスのローカル部を返す。 */
export function displayNameOf(person: EmailAddress): string {
  if (person.name && person.name.trim()) return person.name.trim()
  const at = person.address.indexOf('@')
  return at > 0 ? person.address.slice(0, at) : person.address
}

/** 1 通のメールに登場する全アドレス（from / to / cc）。 */
export function participantsOf(message: Message): EmailAddress[] {
  return [message.from, ...message.to, ...(message.cc ?? [])]
}
