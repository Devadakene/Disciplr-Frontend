/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures call `use`, which is not a React hook */
import { test as base, expect, type Page } from '@playwright/test'

export const FROZEN_TIME = new Date('2026-01-15T10:00:00Z')
export const ALLOWED_ORIGIN = 'http://localhost:4173'

const NO_ANIMATION_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
`

type Fixtures = {
  /** Page with frozen clock, forced theme, no fonts/network leaving localhost. */
  page: Page
  /** URLs of any request that attempted to leave localhost:4173. */
  blockedRequests: string[]
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  blockedRequests: async ({}, use) => {
    const blocked: string[] = []
    await use(blocked)
  },

  page: async ({ page, blockedRequests }, use, testInfo) => {
    const theme = (testInfo.project.metadata as { theme: 'light' | 'dark' }).theme

    // Frozen clock: Date.now()/new Date() fixed; timers still run so React renders.
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme })
    await page.clock.install({ time: FROZEN_TIME })
    await page.clock.resume()

    await page.addInitScript((t) => {
      window.localStorage.setItem('disciplr-theme', t)
    }, theme)

    // Network guard: only localhost:4173 is allowed. Web fonts are blocked
    // (system fonts are used) to avoid cross-OS flakiness.
    await page.route('**/*', (route) => {
      const req = route.request()
      if (!req.url().startsWith(ALLOWED_ORIGIN) && !req.url().startsWith('data:') && !req.url().startsWith('blob:')) {
        blockedRequests.push(req.url())
        return route.abort()
      }
      if (req.resourceType() === 'font') return route.abort()
      return route.continue()
    })

    await use(page)

    expect(blockedRequests, 'requests left localhost:4173').toEqual([])
  },
})

export { expect }

/** Navigate, wait for the app to settle, and neutralise animations. */
export async function gotoStable(page: Page, path: string) {
  await page.goto(path)
  await page.addStyleTag({ content: NO_ANIMATION_CSS })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

/** Navigate to a wallet-protected route using the built-in demo account. */
export async function gotoProtected(page: Page, path: string) {
  await page.goto(path)
  await page.getByRole('button', { name: 'Try the demo account' }).click()
  await page.waitForURL(`**${path}`)
  await page.addStyleTag({ content: NO_ANIMATION_CSS })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}
