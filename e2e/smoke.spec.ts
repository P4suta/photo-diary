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

  // A note-only day (7/1 in the fixtures: a note, no photos) surfaces as a hasNote dot +
  // "note" label in the month grid — the calendar reflection of hasNote.
  await expect(page.getByText('note', { exact: true }).first()).toBeVisible()

  await page.getByRole('link', { name: 'Highlights' }).click()
  await expect(page).toHaveURL(/\/highlights$/)

  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
})

test('starring a photo in the lightbox persists across close and reopen', async ({ page }) => {
  await page.getByLabel('Open photo').first().click()
  await expect(page.getByText(/\d+ \/ \d+ ·/)).toBeVisible()

  // The star toggle shows exactly one of the two labels; flip it and expect the other.
  const pick = page.getByRole('button', { name: '★ Pick', exact: true })
  const picked = page.getByRole('button', { name: '★ Picked', exact: true })
  const wasStarred = await picked.isVisible()
  await (wasStarred ? picked : pick).click()
  const flipped = wasStarred ? pick : picked
  await expect(flipped).toBeVisible()

  // Close, then reopen the same photo: the star state must persist (toggleStar upsert +
  // query invalidation, resolved live from the timeline cache — no stale snapshot).
  await page.keyboard.press('Escape')
  await expect(page.getByText(/\d+ \/ \d+ ·/)).toBeHidden()
  await page.getByLabel('Open photo').first().click()
  await expect(flipped).toBeVisible()
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
