import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default defineConfig({
  // 表示用フォント（約 19KB）を data URI として埋め込み、外部リクエストを無くす。
  build: { assetsInlineLimit: 24 * 1024 },
  // 不具合の連絡でどの版か分かるように、画面へ出す。
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
})
