import { chromium, type FullConfig } from '@playwright/test'

/**
 * Warm the dev server once, serially, before the parallel tests start.
 * On first run vite dev re-bundles deps and does a full reload (cold start). If 4 workers
 * hit an unoptimized server at once, that reload repeats and tests wedge. Waiting here until
 * it stabilizes before the real tests run means each test only ever sees a warm server.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:5173'
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const deadline = Date.now() + 90_000
  try {
    while (Date.now() < deadline) {
      try {
        await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 5_000 })
        await page.getByText('photo-diary').waitFor({ timeout: 3_000 })
        // Watch for 2 seconds to confirm no re-bundle reload comes flying in.
        await page.waitForTimeout(2_000)
        await page.getByText('photo-diary').waitFor({ timeout: 2_000 })
        return
      } catch {
        await page.waitForTimeout(1_000)
      }
    }
    throw new Error('dev server did not stabilize within the warm-up window')
  } finally {
    await browser.close()
  }
}
