/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

function revision(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

const api = process.env.PYN_API ?? 'http://127.0.0.1:7878'

// Dev: /v1 is proxied to pyn-server so the browser needs no CORS.
export default defineConfig({
  plugins: [vue()],
  define: {
    __WEB_VERSION__: JSON.stringify(pkg.version),
    __WEB_REVISION__: JSON.stringify(revision()),
  },
  resolve: { dedupe: ['vue'] },
  server: {
    proxy: { '/v1': api, '/healthz': api },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
})
