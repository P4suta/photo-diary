import { test as base } from '@playwright/test'

export { expect } from '@playwright/test'

/**
 * The day MockPhotoLibrary treats as today (`MOCK_TODAY_ISO` in src/data/mock/fixtures.ts), at noon local time.
 * Browser E2E runs against that mock, so every fixture is dated relative to this day.
 */
const MOCK_NOW = new Date('2026-07-05T12:00:00')

/**
 * Playwright's `test`, with the page clock pinned to the mock's today.
 * UI state seeded from the wall clock — the calendar opens on the current month — would otherwise drift away from the fixtures as real time passes, and the suite would pass or fail depending on the day it runs.
 * The clock starts at MOCK_NOW and then runs at real speed, so timers and animations behave as usual.
 */
export const test = base.extend<{ mockClock: undefined }>({
  mockClock: [
    async ({ page }, use) => {
      await page.clock.install({ time: MOCK_NOW })
      await use(undefined)
    },
    { auto: true },
  ],
})
