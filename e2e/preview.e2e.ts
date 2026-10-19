import { expect, test } from './fixtures'

test('the link preview card has a title, description and a working image', async ({ page, request }) => {
  await page.goto('/')
  const meta = (selector: string) => page.locator(selector).getAttribute('content')
  expect(await meta('meta[property="og:title"]')).toContain('Task Scheduling')
  expect(await meta('meta[property="og:description"]')).toBeTruthy()
  expect(await meta('meta[name="twitter:card"]')).toBe('summary_large_image')
  const image = await meta('meta[property="og:image"]')
  expect(image).toMatch(/^https:\/\/.+\/og-image\.jpg$/)
  // The same file must be served by the site itself.
  const res = await request.get(new URL(image!).pathname)
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('image/jpeg')
})
