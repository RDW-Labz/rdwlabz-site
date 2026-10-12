import { defineConfig, devices } from '@playwright/test';

/**
 * Default: tests run against the production build (`astro build && astro preview`).
 * PW_DEV=1: run against `astro dev` (needed for the dev-only /_studies and /_gallery routes).
 */
const useDev = process.env.PW_DEV === '1';
const port = useDev ? 4391 : 4392;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: useDev
      ? `npx astro dev --port ${port}`
      : `npx astro build && npx astro preview --port ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'e2e',
      testIgnore: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
