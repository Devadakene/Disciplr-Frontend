import { test, expect, gotoStable, gotoProtected } from './fixtures'

// No masks are used: the frozen clock covers every time-dependent region.

const publicRoutes: Array<{ name: string; path: string }> = [
  { name: 'home', path: '/' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'vaults', path: '/vaults' },
  { name: 'verifier-history', path: '/verifier/history' },
  { name: 'analytics', path: '/analytics' },
  { name: 'help', path: '/help' },
  { name: 'notification-settings', path: '/notifications/settings' },
  { name: 'not-found', path: '/this-route-does-not-exist' },
]

for (const route of publicRoutes) {
  test.describe(route.name, () => {
    test('matches snapshot', async ({ page }) => {
      await gotoStable(page, route.path)
      await expect(page).toHaveScreenshot(`${route.name}.png`, { fullPage: true })
    })
  })
}

test.describe('vault-detail', () => {
  test('matches snapshot', async ({ page }) => {
    await gotoProtected(page, '/vaults/1')
    await expect(page).toHaveScreenshot('vault-detail.png', { fullPage: true })
  })
})

test.describe('vault-create', () => {
  test('empty form', async ({ page }) => {
    await gotoProtected(page, '/vaults/create')
    await expect(page).toHaveScreenshot('vault-create-empty.png', { fullPage: true })
  })

  test('validation errors', async ({ page }) => {
    await gotoProtected(page, '/vaults/create')
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(100)
    await expect(page).toHaveScreenshot('vault-create-errors.png', { fullPage: true })
  })
})

test.describe('verifier-queue', () => {
  test('matches snapshot', async ({ page }) => {
    await gotoProtected(page, '/verifier/queue')
    await expect(page).toHaveScreenshot('verifier-queue.png', { fullPage: true })
  })
})

test.describe('error-boundary', () => {
  test('fallback matches snapshot', async ({ page }) => {
    await gotoStable(page, '/__visual__/crash')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveScreenshot('error-boundary.png', { fullPage: true })
  })
})
