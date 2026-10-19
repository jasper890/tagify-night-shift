import { test as base, expect } from '@playwright/test'

// Every browser test starts as a new player with music and sound off, and fails if
// the page logs an error or throws.
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })
      await page.addInitScript(() => {
        // Only once per test, so a reload keeps the player's progress.
        if (sessionStorage.getItem('e2e-ready')) return
        sessionStorage.setItem('e2e-ready', '1')
        localStorage.clear()
        localStorage.setItem('tsa-music-v1', 'off')
        localStorage.setItem('tsa-sound-v1', 'off')
        // The "music is on" popup would cover buttons at the bottom of a phone screen.
        localStorage.setItem('tsa-music-hint-v1', '1')
      })
      await use(errors)
      expect(errors, 'browser errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Main pages of the site, used by the page and accessibility tests. */
export const ROUTES = [
  '/',
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `/lesson/${n}`),
  '/summary',
  '/beyond',
  '/beyond/github-actions',
  '/terminal',
  '/terminal/bash',
  '/practice',
  '/cheatsheet',
  '/glossary',
  '/player',
]
