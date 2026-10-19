import AxeBuilder from '@axe-core/playwright'
import { expect, ROUTES, test } from './fixtures'

// Automatic accessibility check (axe-core) against WCAG 2.1 A and AA rules.
// Serious and critical problems fail the test; the report lists each one.
for (const route of ROUTES) {
  test(`${route} has no serious accessibility problems`, async ({ page }) => {
    await page.goto(route)
    await expect(page.locator('main h1').first()).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    const bad = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 5).map((n) => `  - ${n.target.join(' ')}`).join('\n')}`)
    expect(bad, bad.join('\n\n')).toEqual([])
  })
}
