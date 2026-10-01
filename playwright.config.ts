import { defineConfig } from '@playwright/test'

const port = 4391
const base = (process.env.SITE_BASE ?? '/pine-website').replace(/\/$/, '')

export default defineConfig({
  testDir: 'tests/smoke',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}${base}/`,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  },
  webServer: {
    command: `pnpm exec astro preview --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}${base}/`,
    reuseExistingServer: !process.env.CI,
    env: { SITE_BASE: base },
  },
})
