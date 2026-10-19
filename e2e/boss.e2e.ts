import type { Locator, Page } from '@playwright/test'
import { QUIZZES } from '../src/data/quizzes'
import { expect, test } from './fixtures'

const LESSON = 1
const questions = QUIZZES[LESSON]

// No smooth scrolling, so a click never lands while the page is still moving.
test.use({ contextOptions: { reducedMotion: 'reduce' } })

async function openBoss(page: Page) {
  await page.goto(`/lesson/${LESSON}`)
  const boss = page.locator('#boss')
  await boss.scrollIntoViewIfNeeded()
  return boss
}

/** The answer buttons in the order they are shown. */
const options = (boss: Locator) => boss.locator('fieldset button')

/** Slot (0-based) where the right answer for question `qi` is shown right now. */
async function answerSlot(boss: Locator, qi: number) {
  const shown = (await options(boss).locator('span.flex-1').allTextContents()).map((t) => t.trim())
  const slot = shown.indexOf(questions[qi].options[questions[qi].answer])
  expect(slot, `answer of question ${qi + 1} is on screen`).toBeGreaterThanOrEqual(0)
  return slot
}

async function answerAllRight(boss: Locator) {
  for (let qi = 0; qi < questions.length; qi++) {
    const right = questions[qi].options[questions[qi].answer]
    await boss.getByRole('button', { name: right, exact: true }).click()
    await expect(boss.getByText('Critical hit!')).toBeVisible()
    await boss.getByRole('button', { name: qi + 1 < questions.length ? 'Next question' : 'Finish the boss' }).click()
  }
}

test('beat the boss and keep the stars after a reload', async ({ page }) => {
  const boss = await openBoss(page)
  await boss.getByRole('button', { name: 'Fight!' }).click()
  await answerAllRight(boss)
  await expect(boss.getByText('Stage clear!')).toBeVisible()
  await expect(boss.getByRole('img', { name: '3 of 3 stars' }).first()).toBeVisible()

  await page.reload()
  await expect(page.locator('#boss').getByText('Cleared')).toBeVisible()
})

test('a wrong answer costs a heart and explains why', async ({ page }) => {
  const boss = await openBoss(page)
  await boss.getByRole('button', { name: 'Fight!' }).click()
  const q = questions[0]
  const wrong = q.options.find((_, i) => i !== q.answer)!
  await boss.getByRole('button', { name: wrong, exact: true }).click()
  await expect(boss.getByText('You lost a heart')).toBeVisible()
  await expect(boss.getByText(q.why).first()).toBeVisible()
  await expect(boss.getByRole('img', { name: '2 of 3 hearts left' })).toBeVisible()
})

test('number keys answer the question in the shown order', async ({ page }) => {
  const boss = await openBoss(page)
  await boss.getByRole('button', { name: 'Fight!' }).click()
  const slot = await answerSlot(boss, 0)
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await page.keyboard.press(String(slot + 1))
  await expect(boss.getByText('Critical hit!')).toBeVisible()
})

test('a rematch moves every right answer to a new place', async ({ page }) => {
  const boss = await openBoss(page)
  await boss.getByRole('button', { name: 'Fight!' }).click()
  const first: number[] = []
  for (let qi = 0; qi < questions.length; qi++) {
    first.push(await answerSlot(boss, qi))
    await options(boss).nth(first[qi]).click()
    await expect(boss.getByText('Critical hit!')).toBeVisible()
    await boss.getByRole('button', { name: qi + 1 < questions.length ? 'Next question' : 'Finish the boss' }).click()
  }
  await boss.getByRole('button', { name: 'Rematch' }).click()
  for (let qi = 0; qi < questions.length; qi++) {
    const slot = await answerSlot(boss, qi)
    expect(slot, `question ${qi + 1}`).not.toBe(first[qi])
    await options(boss).nth(slot).click()
    await expect(boss.getByText('Critical hit!')).toBeVisible()
    await boss.getByRole('button', { name: qi + 1 < questions.length ? 'Next question' : 'Finish the boss' }).click()
  }
})
