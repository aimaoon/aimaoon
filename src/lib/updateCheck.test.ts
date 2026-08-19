import { describe, expect, it } from 'vitest'
import { hasUpdate, isNewerVersion, parseVersionInfo, reloadUrl, versionUrl } from './updateCheck'

describe('parseVersionInfo', () => {
  it('version があれば読む', () => {
    expect(parseVersionInfo('{"version":"0.3.0","builtAt":"2026-08-19T00:00:00.000Z"}')).toEqual({
      version: '0.3.0',
      builtAt: '2026-08-19T00:00:00.000Z',
    })
  })

  it('builtAt は無くてよい', () => {
    expect(parseVersionInfo('{"version":"1.0.0"}')).toEqual({ version: '1.0.0', builtAt: undefined })
  })

  it('前後の空白は落とす', () => {
    expect(parseVersionInfo('{"version":" 1.2.3 "}')?.version).toBe('1.2.3')
  })

  it('壊れていたら null', () => {
    expect(parseVersionInfo('<!doctype html>')).toBeNull()
    expect(parseVersionInfo('null')).toBeNull()
    expect(parseVersionInfo('[]')).toBeNull()
    expect(parseVersionInfo('{}')).toBeNull()
    expect(parseVersionInfo('{"version":""}')).toBeNull()
    expect(parseVersionInfo('{"version":3}')).toBeNull()
  })
})

describe('isNewerVersion', () => {
  it('新しければ true', () => {
    expect(isNewerVersion('0.2.0', '0.3.0')).toBe(true)
    expect(isNewerVersion('0.2.0', '0.2.1')).toBe(true)
    expect(isNewerVersion('0.9.9', '1.0.0')).toBe(true)
  })

  it('同じなら false', () => {
    expect(isNewerVersion('0.2.0', '0.2.0')).toBe(false)
  })

  it('巻き戻しでは勧めない', () => {
    expect(isNewerVersion('0.3.0', '0.2.0')).toBe(false)
    expect(isNewerVersion('1.0.0', '0.9.9')).toBe(false)
  })

  it('10 と 9 を文字の並びで比べない', () => {
    expect(isNewerVersion('0.9.0', '0.10.0')).toBe(true)
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(false)
  })

  it('桁数が違っても比べられる', () => {
    expect(isNewerVersion('1.0', '1.0.1')).toBe(true)
    expect(isNewerVersion('1.0.1', '1.0')).toBe(false)
    expect(isNewerVersion('1', '1.0.0')).toBe(false)
  })

  it('数字でないところは 0 として扱う', () => {
    expect(isNewerVersion('0.2.0', '0.2.x')).toBe(false)
    expect(isNewerVersion('0.2.x', '0.2.1')).toBe(true)
  })
})

describe('hasUpdate', () => {
  it('新しい版が配信されていれば true', () => {
    expect(hasUpdate('0.2.0', '{"version":"0.3.0"}')).toBe(true)
  })

  it('読めない中身では騒がない', () => {
    expect(hasUpdate('0.2.0', '<!doctype html>')).toBe(false)
    expect(hasUpdate('0.2.0', '')).toBe(false)
  })

  it('同じ版では騒がない', () => {
    expect(hasUpdate('0.2.0', '{"version":"0.2.0"}')).toBe(false)
  })
})

describe('versionUrl', () => {
  it('毎回違う URL になる', () => {
    expect(versionUrl(new Date('2026-08-19T00:00:00Z'))).toBe('/version.json?t=1787097600000')
    expect(versionUrl(new Date('2026-08-19T00:00:01Z'))).not.toBe(versionUrl(new Date('2026-08-19T00:00:00Z')))
  })
})

describe('reloadUrl', () => {
  it('版をクエリに付ける', () => {
    expect(reloadUrl('https://example.pages.dev/', '0.3.0')).toBe('https://example.pages.dev/?v=0.3.0')
  })

  it('前の版のクエリは上書きする（増えていかない）', () => {
    expect(reloadUrl('https://example.pages.dev/?v=0.2.0', '0.3.0')).toBe('https://example.pages.dev/?v=0.3.0')
  })

  it('ほかのクエリは残す', () => {
    expect(reloadUrl('https://example.pages.dev/?a=1', '0.3.0')).toBe('https://example.pages.dev/?a=1&v=0.3.0')
  })
})
