import { expect, test } from '@playwright/test'

// End-to-end pass over the core experience: capture date → day → photos in order →
// note → review. Phase 1 (browser dev) uses MockPhotoLibrary, so content is
// deterministic. The default locale is `en`.

test.beforeEach(async ({ page }) => {
  // vite dev re-bundles deps once on first start and does a full reload (ERR_ABORTED).
  // Wrap goto + a readiness assertion in toPass so the reload settles first (SPA →
  // wait for domcontentloaded, not load).
  await expect(async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('photo-diary')).toBeVisible({ timeout: 3000 })
  }).toPass({ timeout: 30_000 })
})

test('the timeline boots with the sidebar and today card', async ({ page }) => {
  await expect(page.getByText('photo-diary')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Timeline' })).toBeVisible()
  // Today's (7/5) note body shows in the feed.
  await expect(
    page.getByText('Yoyogi Park in the morning. It was cool around the fountain.'),
  ).toBeVisible()
})

test('a photo tile opens the lightbox and ← → Esc work', async ({ page }) => {
  await page.getByLabel('Open photo').first().click()
  // The footer shows "N / M" plus the key hint.
  await expect(page.getByText(/\d+ \/ \d+ ·/)).toBeVisible()
  await expect(page.getByText(/1 \//)).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByText(/2 \//)).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByText(/1 \//)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText(/1 \/ \d+ ·/)).toBeHidden()
})

test('the sidebar navigates to calendar, highlights, and settings', async ({ page }) => {
  await page.getByRole('link', { name: 'Calendar' }).click()
  await expect(page).toHaveURL(/\/calendar$/)
  await expect(page.getByText('July 2026')).toBeVisible()

  await page.getByRole('link', { name: 'Highlights' }).click()
  await expect(page).toHaveURL(/\/highlights$/)

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
})

test('editing a note saves and the feed re-renders with the new text', async ({ page }) => {
  const original = 'Yoyogi Park in the morning. It was cool around the fountain.'
  // Click an existing note → it becomes a textarea (prefilled) → overwrite → commit.
  await page.getByText(original).click()
  const editor = page.getByPlaceholder('A few lines about today.').first()
  await expect(editor).toBeVisible()
  await expect(editor).toHaveValue(original)
  await editor.fill('an edited note for the day')
  // Ctrl+Enter commits (NoteEditor) → saveNote → query invalidation → refetch.
  await editor.press('Control+Enter')
  // The mock upserts immutably, so the feed actually re-renders: new text in, old text gone.
  await expect(page.getByText('an edited note for the day')).toBeVisible()
  await expect(page.getByText(original)).toBeHidden()
})
