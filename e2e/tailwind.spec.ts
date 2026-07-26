import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('photo-diary-theme', 'light')
    localStorage.setItem('photo-diary-accent', 'moss')
  })

  await expect(async () => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('photo-diary')).toBeVisible({ timeout: 3000 })
  }).toPass({ timeout: 30_000 })
})

test('Tailwind v4 generates the app theme, tokens, and class-driven variants', async ({ page }) => {
  const body = page.locator('body')
  await expect(body).toHaveCSS('font-family', /Noto Sans JP Variable/)

  const lightBackground = await body.evaluate(
    (element) => element.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor,
  )
  expect(lightBackground).not.toBe('rgba(0, 0, 0, 0)')

  const timelineCard = page.locator('article').first()
  await expect(timelineCard).toBeVisible()
  await expect(timelineCard).toHaveCSS('border-radius', '12px')
  expect(
    await timelineCard.evaluate(
      (element) => element.ownerDocument.defaultView?.getComputedStyle(element).boxShadow,
    ),
  ).toContain('0px 1px 2px')

  await page.goto('/tokens')
  const radiusSm = page.locator('.rounded-sm.shadow-card')
  const radiusMd = page.locator('.rounded-md.shadow-card')
  const radiusLg = page.locator('.rounded-lg.shadow-pop')
  await expect(radiusSm).toHaveCSS('border-radius', '6px')
  await expect(radiusMd).toHaveCSS('border-radius', '8px')
  await expect(radiusLg).toHaveCSS('border-radius', '12px')
  expect(
    await radiusSm.evaluate(
      (element) => element.ownerDocument.defaultView?.getComputedStyle(element).boxShadow,
    ),
  ).toContain('0px 1px 2px')
  expect(
    await radiusLg.evaluate(
      (element) => element.ownerDocument.defaultView?.getComputedStyle(element).boxShadow,
    ),
  ).toContain('0px 12px 40px')

  await page.getByRole('link', { name: 'Settings' }).click()
  const accentSwatch = page.locator('aside > div').first().locator(':scope > div').first()
  const mossAccent = await accentSwatch.evaluate(
    (element) => element.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor,
  )
  await page.getByRole('button', { name: 'Dusk', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'dusk')
  await expect
    .poll(() =>
      accentSwatch.evaluate(
        (element) => element.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor,
      ),
    )
    .not.toBe(mossAccent)

  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect
    .poll(() =>
      body.evaluate(
        (element) => element.ownerDocument.defaultView?.getComputedStyle(element).backgroundColor,
      ),
    )
    .not.toBe(lightBackground)
})
