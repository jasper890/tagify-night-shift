import { expect, ROUTES, test } from './fixtures'

test.describe('every page', () => {
  for (const route of ROUTES) {
    test(`${route} loads with a heading and fits the screen`, async ({ page }) => {
      await page.goto(route)
      await expect(page.locator('main h1').first()).toBeVisible()
      // No sideways scrolling, on desktop or on a phone.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }

  test('an unknown address shows the 404 page', async ({ page }) => {
    await page.goto('/no-such-page')
    await expect(page.locator('main h1')).toBeVisible()
    await expect(page.getByRole('link', { name: /world map|home/i }).first()).toBeVisible()
  })
})

test.describe('keyboard', () => {
  test('the first Tab shows a working "Skip to content" link', async ({ page }) => {
    await page.goto('/lesson/1')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to content' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main')).toBeFocused()
  })
})

test.describe('navigation', () => {
  test('a lesson links to the next one', async ({ page }) => {
    await page.goto('/lesson/1')
    const h1 = await page.locator('main h1').first().textContent()
    await page.getByRole('navigation', { name: 'Lesson navigation' }).getByRole('link', { name: /Stage 2/ }).click()
    await expect(page).toHaveURL(/\/lesson\/2$/)
    await expect(page.locator('main h1').first()).not.toHaveText(h1 ?? '')
  })

  test('a refreshed lesson page still works', async ({ page }) => {
    await page.goto('/lesson/4')
    await page.reload()
    await expect(page.locator('main h1').first()).toContainText('cron')
  })
})
