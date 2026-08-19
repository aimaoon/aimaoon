/**
 * どのアプリの中で開かれているかの判定。
 *
 * LINE などのアプリからリンクを開くと、そのアプリに内蔵されたブラウザで表示される。
 * 内蔵ブラウザの保存領域は Safari やホーム画面のアプリとは別なので、
 * そこで取り込んでも「いつものアプリ」には増えない。そのことを先に伝えるために使う。
 */

const IN_APP = [
  { name: 'LINE', pattern: / Line\// },
  { name: 'Instagram', pattern: /Instagram/ },
  { name: 'Facebook', pattern: /FBAN|FBAV/ },
]

/** 内蔵ブラウザで開かれていれば、そのアプリ名。ふつうのブラウザなら null。 */
export function inAppBrowserName(userAgent: string): string | null {
  for (const { name, pattern } of IN_APP) {
    if (pattern.test(userAgent)) return name
  }
  return null
}
