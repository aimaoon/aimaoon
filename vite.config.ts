import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/**
 * 配信されている版を知らせる version.json をビルドごとに書き出す。
 * ホーム画面のアプリが古い画面を握ったままになっても、これと突き合わせて気づける。
 */
function versionManifest(): Plugin {
  return {
    name: 'stage-note-version-manifest',
    apply: 'build' as const,
    generateBundle() {
      this.emitFile({
        type: 'asset' as const,
        fileName: 'version.json',
        source: JSON.stringify({ version: pkg.version, builtAt: new Date().toISOString() }),
      })
    },
  }
}

export default defineConfig({
  // 表示用フォント（約 19KB）を data URI として埋め込み、外部リクエストを無くす。
  build: { assetsInlineLimit: 24 * 1024 },
  // 不具合の連絡でどの版か分かるように、画面へ出す。
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), versionManifest()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
})
