import { expect, test } from './fixtures'

test('Terminal Lab: type the first two Bash steps', async ({ page }) => {
  await page.goto('/terminal/bash')
  const input = page.getByLabel('Type a command and press Enter')
  await input.fill('pwd')
  await input.press('Enter')
  await expect(page.getByText('Step 1 complete')).toBeVisible()
  await expect(page.getByText('/home/student').first()).toBeVisible()

  await page.getByRole('button', { name: 'Next step' }).click()
  await input.fill('cd lab')
  await input.press('Enter')
  await expect(page.getByText('Step 2 complete')).toBeVisible()
})

test('Terminal Lab: a wrong command does not complete the step', async ({ page }) => {
  await page.goto('/terminal/bash')
  const input = page.getByLabel('Type a command and press Enter')
  await input.fill('ls')
  await input.press('Enter')
  await expect(page.getByText('Step 1 complete')).toHaveCount(0)
  await expect(page.getByText('Step 1 of')).toBeVisible()
})
