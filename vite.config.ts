/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Dev: /v1 is proxied to pyn-server so the browser needs no CORS.
export default defineConfig({
  plugins: [vue()],
  css: {
    modules: { generateScopedName: 'pyn_[name]__[local]__[hash:base64:5]' },
  },
  server: {
    proxy: { '/v1': 'http://127.0.0.1:7878', '/healthz': 'http://127.0.0.1:7878' },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
