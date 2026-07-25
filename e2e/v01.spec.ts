import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await expect(async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('photo-diary')).toBeVisible({ timeout: 3000 })
  }).toPass({ timeout: 30_000 })
})

test('search applies date/place filters, restores history, and clears the URL', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Search…' }).click()
  const dates = page.locator('input[type="date"]')
  await dates.nth(0).fill('2026-07-04')
  await dates.nth(1).fill('2026-07-04')
  await page.getByLabel(/Shibuya/).check()
  await page.getByRole('button', { name: 'Apply' }).click()

  await expect(page).toHaveURL(/from=2026-07-04/)
  await expect(page).toHaveURL(/place=Shibuya/)
  await expect(page.getByRole('heading', { name: 'July 4' })).toBeVisible()
  await expect(page.getByRole('main')).toContainText('Shibuya')

  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByText('Yoyogi Park in the morning. It was cool around the fountain.'),
  ).toBeVisible()

  await page.goForward()
  await expect(page).toHaveURL(/place=Shibuya/)
  await page.getByRole('button', { name: /2026-07-04/ }).click()
  await page.getByRole('button', { name: 'Clear' }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('lightbox C/S shortcuts persist a caption and star state', async ({ page }) => {
  await page.getByLabel('Open photo').first().click()
  await page.keyboard.press('c')
  const caption = page.getByPlaceholder('Add a one-line caption…')
  await expect(caption).toBeFocused()
  await caption.fill('A caption saved from Playwright')
  await caption.press('Enter')

  const before = await page.getByRole('button', { name: /★ Pick/ }).textContent()
  await page.keyboard.press('s')
  await expect(page.getByRole('button', { name: /★ Pick/ })).not.toHaveText(before ?? '')

  await page.keyboard.press('Escape')
  await page.getByLabel('Open photo').first().click()
  await expect(page.getByPlaceholder('Add a one-line caption…')).toHaveValue(
    'A caption saved from Playwright',
  )
})

test('day detail exposes virtual grid, size, scrubber and bulk star controls', async ({ page }) => {
  await page.getByLabel('Open day detail').click()
  await expect(page).toHaveURL(/\/day\/2026-06-28$/)
  const grid = page.getByTestId('virtual-day-grid')
  await expect(grid).toBeVisible()
  await expect(grid).toHaveAttribute('data-loaded-count', '120')
  await grid.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll'))
  })
  await expect
    .poll(async () => Number(await grid.getAttribute('data-loaded-count')))
    .toBeGreaterThan(120)

  await page.getByTitle('Small tiles').click()
  await expect(page.getByTitle('Small tiles')).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Jump to capture time').fill('900')
  await expect
    .poll(async () => Number(await grid.getAttribute('data-loaded-count')))
    .toBeGreaterThan(2_500)

  await page.getByRole('button', { name: 'Select' }).click()
  await page.getByLabel('Toggle photo selection').first().click()
  await expect(page.getByText('1 selected')).toBeVisible()
  await page.getByRole('button', { name: '★ Selected' }).click()
})

test('event metadata and calendar day navigation remain routable', async ({ page }) => {
  const title = page.getByLabel('Event title')
  await title.fill('Edited Kanazawa trip')
  await title.press('Enter')
  const note = page.getByLabel('Event note')
  await note.fill('Edited event note')
  await note.press('Control+Enter')

  await page.getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('link', { name: 'Timeline' }).click()
  await expect(page.getByLabel('Event title')).toHaveValue('Edited Kanazawa trip')

  await page.getByRole('link', { name: 'Calendar' }).click()
  await page.getByText('6 photos', { exact: true }).click()
  await expect(page).toHaveURL(/\/day\/2026-07-04$/)

  await page.getByRole('link', { name: 'Calendar' }).click()
  await page.getByRole('button', { name: 'Previous month' }).click()
  const eventBands = page.getByTestId('calendar-event-band')
  await expect(eventBands).toHaveCount(4)
  await expect(eventBands.first()).toHaveAttribute('aria-label', /Edited Kanazawa trip/)
})

test('settings confirmations and English/Japanese controls are functional', async ({ page }) => {
  await page.getByRole('link', { name: 'Settings' }).click()

  let clearMessage = ''
  page.once('dialog', async (dialog) => {
    clearMessage = dialog.message()
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  expect(clearMessage).toContain('Full-resolution masters are not affected')

  let removeMessage = ''
  page.once('dialog', async (dialog) => {
    removeMessage = dialog.message()
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Remove', exact: true }).first().click()
  expect(removeMessage).toContain('Imported photos will stay')

  await page.getByRole('button', { name: '日本語' }).click()
  await expect(page.getByRole('link', { name: '設定' })).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
})

test('timeline and settings have no automated WCAG A/AA violations', async ({ page }) => {
  const timeline = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(timeline.violations).toEqual([])

  await page.getByRole('link', { name: 'Settings' }).click()
  const settings = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(settings.violations).toEqual([])
})
