/**
 * src/content/privacy.json から公開用のページを作る。
 *   node scripts/build-privacy.mjs
 *
 * ストアの審査ではプライバシーポリシーの URL を求められるので、
 * 配信したサイトの /privacy.html を出せるようにしておく。
 * アプリ内の表示と同じ文面を使うため、書き換えたらこれを流し直す。
 */
import { readFileSync, writeFileSync } from 'node:fs'

const privacy = JSON.parse(readFileSync(new URL('../src/content/privacy.json', import.meta.url), 'utf8'))

const escape = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const sections = privacy.sections
  .map(
    (section) => `    <section>
      <h2>${escape(section.heading)}</h2>
${section.body.map((paragraph) => `      <p>${escape(paragraph)}</p>`).join('\n')}
    </section>`,
  )
  .join('\n\n')

const html = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(privacy.title)} - Stage Note</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        margin: 0 auto;
        padding: 40px 20px 80px;
        max-width: 42rem;
        background: #f0eff3;
        color: #16151a;
        font-family: system-ui, -apple-system, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif;
        line-height: 1.9;
      }
      @media (prefers-color-scheme: dark) {
        body { background: #0b0a0d; color: #f4f2ed; }
        h1, h2 { color: #f4f2ed; }
        .meta { color: #8a8796; }
      }
      h1 { font-size: 1.5rem; letter-spacing: 0.04em; }
      h2 { margin-top: 2.5rem; font-size: 1.05rem; letter-spacing: 0.04em; }
      .meta { color: #625f6b; font-size: 0.85rem; }
      .lead { margin: 1.5rem 0 0; font-weight: 700; }
      p { margin: 0.8rem 0 0; }
    </style>
  </head>
  <body>
    <h1>${escape(privacy.title)}</h1>
    <p class="meta">Stage Note ／ 最終更新 ${escape(privacy.updatedAt)}</p>
    <p class="lead">${escape(privacy.summary)}</p>

${sections}
  </body>
</html>
`

writeFileSync(new URL('../public/privacy.html', import.meta.url), html)
console.log('public/privacy.html を書き出しました')
