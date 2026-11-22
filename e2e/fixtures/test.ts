/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect, type Page } from '@playwright/test';
import { FakeApi, setupFakeApi, DEMO_ADDRESS } from './fakeApi';

export interface TestFixtures {
  fakeApi: FakeApi;
  unexpectedExternalRequests: string[];
}

export const test = base.extend<TestFixtures>({
  // Guard against any external host requests
  unexpectedExternalRequests: [
    async ({ page }, use) => {
      const unexpected: string[] = [];

      // Route guard: only localhost/127.0.0.1 and data/blob urls are permitted
      await page.route('**/*', (route) => {
        const url = new URL(route.request().url());
        const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
        const isAllowedPort = url.port === '4173' || url.port === '4010' || url.port === '';
        const isAllowedProtocol = url.protocol === 'data:' || url.protocol === 'blob:';

        if ((isLocalhost && isAllowedPort) || isAllowedProtocol) {
          return route.continue();
        }

        unexpected.push(route.request().url());
        return route.abort('blockedbyclient');
      });

      await use(unexpected);

      // Verify zero external network requests were attempted
      expect(unexpected).toEqual([]);
    },
    { auto: true },
  ],

  // Set fixed time to avoid jitter from countdown timers
  page: async ({ page }, use) => {
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00.000Z'));
    await use(page);
  },

  fakeApi: [
    async ({ page }, use) => {
      // Note: because fakeApi route is registered AFTER the external origin guard,
      // Playwright evaluates routes LIFO (last-in, first-out), so **/api/** is matched first.
      const api = setupFakeApi(page);
      await use(api);
    },
    { auto: true },
  ],
});

export { expect, DEMO_ADDRESS };

/**
 * Connect the demo account by visiting landing and clicking "Try the demo account".
 */
export async function connectDemoAccount(page: Page) {
  await page.goto('/');
  const demoButton = page.getByRole('button', { name: /try the demo account/i });
  await expect(demoButton).toBeVisible();
  await demoButton.click();
  await expect(page).toHaveURL(/\/dashboard/);
}
