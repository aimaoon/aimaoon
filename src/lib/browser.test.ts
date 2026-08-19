import { describe, expect, it } from 'vitest'
import { inAppBrowserName } from './browser'

describe('inAppBrowserName', () => {
  it('LINE の内蔵ブラウザを見分ける', () => {
    const ios =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari/604.1 Line/14.9.0'
    const android =
      'Mozilla/5.0 (Linux; Android 15; SC-51D Build/AP3A) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 Line/14.9.1/IAB'
    expect(inAppBrowserName(ios)).toBe('LINE')
    expect(inAppBrowserName(android)).toBe('LINE')
  })

  it('ほかのアプリの内蔵ブラウザも見分ける', () => {
    expect(inAppBrowserName('Mozilla/5.0 ... Instagram 300.0.0.0')).toBe('Instagram')
    expect(inAppBrowserName('Mozilla/5.0 ... [FBAN/FBIOS;FBAV/450.0]')).toBe('Facebook')
  })

  it('ふつうのブラウザなら null', () => {
    const safari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
    const chrome =
      'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
    expect(inAppBrowserName(safari)).toBeNull()
    expect(inAppBrowserName(chrome)).toBeNull()
  })

  it('「Linux」や「Airline」を LINE と間違えない', () => {
    expect(inAppBrowserName('Mozilla/5.0 (X11; Linux x86_64) Chrome/131.0')).toBeNull()
    expect(inAppBrowserName('Mozilla/5.0 Airline/1.0')).toBeNull()
  })
})
