import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `http://localhost:${PORT}`

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
const mobile = {
  ...devices['Desktop Chrome'],
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
}

const project = (name: string, use: object, theme: 'light' | 'dark') => ({
  name,
  use: { ...use, colorScheme: theme, reducedMotion: 'reduce' as const },
  metadata: { theme },
})

export default defineConfig({
  testDir: './e2e/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  outputDir: './test-results/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  projects: [
    project('chromium-1440-light', desktop, 'light'),
    project('chromium-1440-dark', desktop, 'dark'),
    project('chromium-390-light', mobile, 'light'),
    project('chromium-390-dark', mobile, 'dark'),
  ],
  webServer: {
    // VITE_API is intentionally unset: the app runs on offline fixtures.
    // `--mode visual` enables the test-only crash route.
    command: `pnpm exec vite build --mode visual && pnpm exec vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
