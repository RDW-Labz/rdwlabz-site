import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { settleMotion } from './helpers';

test('home renders with a heading and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('RDW Labz');
  expect(errors).toEqual([]);
});

test('home has no axe violations (WCAG 2.2 AA tags)', async ({ page }) => {
  await page.goto('/');
  await settleMotion(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('dev-only routes are not in the production build', async ({ page }) => {
  test.skip(process.env.PW_DEV === '1', 'dev server serves them on purpose');
  for (const path of ['/_studies', '/_gallery']) {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
  }
});
