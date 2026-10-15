import { defineConfig, devices } from '@playwright/test';

/**
 * Default: tests run against the production build (`astro build && astro preview`).
 * PW_DEV=1: run against `astro dev` (needed for the dev-only /_studies and /_gallery routes).
 */
const useDev = process.env.PW_DEV === '1';
const port = useDev ? 4391 : 4392;

export default defineConfig({
  testDir: './tests',
  // A stuck test or server fails fast instead of hanging the run.
  timeout: 60_000,
  globalTimeout: 15 * 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  webServer: {
    // --ignore-lock: Astro 7 otherwise backgrounds the server when it detects an AI agent, so the
    // command exits at once and Playwright reports "exited early".
    command: useDev
      ? `npx astro dev --port ${port} --ignore-lock`
      : `npx astro build && npx astro preview --port ${port} --ignore-lock`,
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
