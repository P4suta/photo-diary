import { defineConfig, devices } from '@playwright/test'

// E2E is heavy (browser launch). Run it locally via `just e2e` and in CI as a dedicated
// job only; it's not part of pre-push / `just check`. Phase 1 uses MockPhotoLibrary, so it's deterministic.
const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  // global-setup warms the server before testing, so cold-start reloads don't ripple
  // into individual tests. Locally 0 retries for an honest signal; CI uses 2 for network jitter.
  retries: CI ? 2 : 0,
  // Fast once warm, but leave some slack for first-time module resolution.
  timeout: 45_000,
  // Warm the dev server serially before the parallel tests (absorbs dep re-bundle reloads).
  globalSetup: './e2e/global-setup.ts',
  workers: CI ? 1 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Start the Vite dev server before tests; CI spins up a fresh one each time. Reloads from
  // the first dep re-bundle are absorbed by each test's beforeEach (toPass wrapper).
  webServer: {
    command: 'pnpm dev',
    port: 5173,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
})
