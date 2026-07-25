import { defineConfig, devices } from '@playwright/test'

// E2E is heavy (browser launch). Run it locally via `just e2e` and in CI as a
// dedicated job only; it isn't part of pre-push / `just check`.
const CI = !!process.env.CI
const E2E_PORT = 41739
const E2E_URL = `http://127.0.0.1:${E2E_PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  // Locally 0 retries for an honest signal; CI uses 2 for process-start jitter.
  retries: CI ? 2 : 0,
  // Leave some slack for first-time module resolution.
  timeout: 45_000,
  // Windows can exhaust desktop-process resources when Playwright launches one
  // browser worker per core. Two keeps local runs parallel and deterministic.
  workers: CI ? 1 : 2,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: E2E_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // A dedicated strict port prevents a stale daily-development server from being
  // mistaken for the test server. Always start and stop it with this test run.
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${E2E_PORT} --strictPort`,
    url: E2E_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
