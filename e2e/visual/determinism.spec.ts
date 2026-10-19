import { test, expect, gotoStable, FROZEN_TIME, ALLOWED_ORIGIN } from './fixtures'

test.describe('determinism', () => {
  test('frozen clock is active', async ({ page }) => {
    await gotoStable(page, '/')
    const now = await page.evaluate(() => Date.now())
    // The clock may advance by a few ms of fake time while the page settles.
    expect(now).toBeGreaterThanOrEqual(FROZEN_TIME.getTime())
    expect(now - FROZEN_TIME.getTime()).toBeLessThan(60_000)
    expect(await page.evaluate(() => new Date().getUTCFullYear())).toBe(2026)
  })

  test('reduced motion is applied', async ({ page }) => {
    await gotoStable(page, '/')
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  })

  test('theme is forced from localStorage', async ({ page }, testInfo) => {
    await gotoStable(page, '/')
    const theme = (testInfo.project.metadata as { theme: string }).theme
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe(theme)
  })

  test('network guard blocks requests leaving localhost:4173', async ({ page, blockedRequests }) => {
    await gotoStable(page, '/')
    const outcome = await page.evaluate(() =>
      fetch('https://example.com/ping').then(() => 'allowed', () => 'blocked'),
    )
    expect(outcome).toBe('blocked')
    expect(blockedRequests).toEqual(['https://example.com/ping'])
    blockedRequests.length = 0 // expected for this test only
    expect(page.url().startsWith(ALLOWED_ORIGIN)).toBe(true)
  })
})
