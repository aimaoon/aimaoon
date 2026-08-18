import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 表示用フォント（約 19KB）を data URI として埋め込み、外部リクエストを無くす。
  build: { assetsInlineLimit: 24 * 1024 },
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
})
