import { describe, expect, it } from 'vitest'
import { displayNameOf, domainOf, isInternalAddress, isOurDomain, normalizeDomain } from './address'

describe('domainOf', () => {
  it('アドレスからドメインを取り出す', () => {
    expect(domainOf('tanaka@sample-sol.co.jp')).toBe('sample-sol.co.jp')
  })

  it('大文字は小文字に正規化する', () => {
    expect(domainOf('Tanaka@Sample-Sol.CO.JP')).toBe('sample-sol.co.jp')
  })

  it('@ が無ければ空文字', () => {
    expect(domainOf('not-an-address')).toBe('')
  })
})

describe('normalizeDomain', () => {
  it('前後の空白・先頭の @・末尾のドットを落とす', () => {
    expect(normalizeDomain('  @Example.CO.JP. ')).toBe('example.co.jp')
  })
})

describe('isOurDomain', () => {
  const ours = ['sample-sol.co.jp', 'sample-sol.com']

  it('完全一致を自社と判定する', () => {
    expect(isOurDomain('sample-sol.co.jp', ours)).toBe(true)
    expect(isOurDomain('sample-sol.com', ours)).toBe(true)
  })

  it('サブドメインも自社と判定する', () => {
    expect(isOurDomain('support.sample-sol.co.jp', ours)).toBe(true)
  })

  it('他社ドメインは自社と判定しない', () => {
    expect(isOurDomain('mirai-shoji.co.jp', ours)).toBe(false)
  })

  it('末尾が似ているだけの別ドメインを誤判定しない', () => {
    expect(isOurDomain('evil-sample-sol.co.jp', ours)).toBe(false)
    expect(isOurDomain('sample-sol.co.jp.attacker.com', ours)).toBe(false)
  })

  it('空の設定では常に false', () => {
    expect(isOurDomain('sample-sol.co.jp', [])).toBe(false)
    expect(isOurDomain('sample-sol.co.jp', ['  '])).toBe(false)
  })
})

describe('isInternalAddress', () => {
  it('自社ドメインのアドレスを社内と判定する', () => {
    expect(isInternalAddress('SUZUKI@support.sample-sol.co.jp', ['sample-sol.co.jp'])).toBe(true)
    expect(isInternalAddress('yamada@mirai-shoji.co.jp', ['sample-sol.co.jp'])).toBe(false)
  })
})

describe('displayNameOf', () => {
  it('表示名があればそれを使う', () => {
    expect(displayNameOf({ name: '田中 一郎', address: 'tanaka@x.jp' })).toBe('田中 一郎')
  })

  it('表示名が無ければローカル部を使う', () => {
    expect(displayNameOf({ address: 'tanaka@x.jp' })).toBe('tanaka')
    expect(displayNameOf({ name: '   ', address: 'tanaka@x.jp' })).toBe('tanaka')
  })
})
