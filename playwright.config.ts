import { defineConfig } from '@playwright/test'

const isCI = Boolean(process.env.CI)

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  workers: isCI ? 1 : undefined,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL?.trim() || 'https://investigacion2-frontend.vercel.app',
    browserName: 'chromium',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
})
