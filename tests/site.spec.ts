import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/projects', '/404'];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    // The 404 page itself is expected to return 404.
    if (r.status() >= 400 && !r.url().endsWith('/404') && !r.url().includes('/does-not-exist'))
      errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

for (const path of PAGES) {
  test(`${path}: no axe violations, no console/network errors`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    // Measure final colors, not mid-fade: finish reveals and stop transitions first.
    await page.addStyleTag({ content: '*{transition:none!important}' });
    await page.evaluate(() => {
      document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed'));
      document.getAnimations().forEach((a) => {
        if (a.effect?.getTiming().iterations !== Infinity) a.finish();
      });
    });
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${path}: one h1, skip link, landmarks, title + description`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('main#main')).toHaveCount(1);
    await expect(page.locator('footer')).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
    await expect(page).toHaveTitle(/RDW Labz/);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  });
}

test('home: hero states who we are and links to projects', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('RDW Labz');
  await expect(
    page.getByRole('heading', { level: 1 }).getByText(/software, games, mods and asset packs/i),
  ).toBeVisible();
  const cta = page.getByRole('main').getByRole('link', { name: 'See our projects' });
  await expect(cta).toHaveAttribute('href', '/projects');
});

test('home: category tiles link to pre-filtered projects', async ({ page }) => {
  await page.goto('/');
  const tiles = page.locator('#what-we-build a');
  await expect(tiles).toHaveCount(4);
  for (const c of ['software', 'games', 'mods', 'asset-packs']) {
    await expect(page.locator(`#what-we-build a[href="/projects?c=${c}"]`)).toHaveCount(1);
  }
});

test('journey: tile → filtered projects (client-side nav)', async ({ page }) => {
  await page.goto('/');
  await page.locator('#what-we-build a[href="/projects?c=mods"]').click();
  await expect(page).toHaveURL(/\/projects\?c=mods$/);
  await expect(page.locator('[data-filter="mods"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-project-grid] > li:not([hidden])')).toHaveCount(
    await page.locator('[data-project-grid] > li[data-category="mods"]').count(),
  );
  await expect(page.locator('[data-filter-status]')).toContainText('in Mods');
  await expect(page.locator('a[aria-current="page"]').first()).toHaveText(/Projects/);
});

test('projects: filters by click and keyboard, reflect URL, and reset', async ({ page }) => {
  await page.goto('/projects');
  const visible = page.locator('[data-project-grid] > li:not([hidden])');
  const total = await page.locator('[data-project-grid] > li').count();
  await expect(visible).toHaveCount(total);

  await page.locator('[data-filter="games"]').click();
  await expect(page).toHaveURL(/\?c=games$/);
  await expect(page.locator('[data-filter="games"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'false');
  for (const li of await visible.all()) await expect(li).toHaveAttribute('data-category', 'games');

  await page.locator('[data-filter="software"]').focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\?c=software$/);
  await page.locator('[data-filter="all"]').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/projects$/);
  await expect(visible).toHaveCount(total);
});

test('projects: empty state when a category has no projects', async ({ page }) => {
  await page.goto('/projects');
  // Simulate a category with zero projects by removing its cards, then filtering.
  await page.evaluate(() =>
    document
      .querySelectorAll('[data-project-grid] > li[data-category="mods"]')
      .forEach((li) => li.remove()),
  );
  await page.locator('[data-filter="mods"]').click();
  await expect(page.locator('[data-empty]')).toBeVisible();
  await expect(page.locator('[data-empty]')).toContainText('mods');
  await expect(page.locator('[data-filter-status]')).toContainText('Showing 0 projects in Mods');
  await page.locator('[data-filter-reset]').click();
  await expect(page.locator('[data-empty]')).toBeHidden();
  await expect(page.locator('[data-filter="all"]')).toBeFocused();
});

test('projects: unknown ?c= falls back to All', async ({ page }) => {
  await page.goto('/projects?c=nope');
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
});

test('projects: placeholder projects show "Link coming soon", never a dead link', async ({
  page,
}) => {
  await page.goto('/projects');
  const cards = page.locator('.project-card');
  for (const card of await cards.all()) {
    const links = card.locator('a');
    const soon = card.getByText('Link coming soon');
    expect((await links.count()) + (await soon.count())).toBeGreaterThan(0);
    for (const a of await links.all()) await expect(a).toHaveAttribute('href', /^https?:\/\//);
  }
});

test('mobile menu: opens, traps focus, Esc closes and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('[data-menu-toggle]');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#mobile-menu')).toBeVisible();
  await expect(page.locator('#mobile-menu a').first()).toBeFocused();
  expect(await page.locator('main').evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  const inHeader = await page.evaluate(
    () => !!document.activeElement?.closest('[data-site-header]'),
  );
  expect(inHeader).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mobile-menu')).toBeHidden();
  await expect(toggle).toBeFocused();
  expect(await page.locator('main').evaluate((el) => (el as HTMLElement).inert)).toBe(false);
});

test('mobile menu: link navigates and menu closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('[data-menu-toggle]').click();
  await page.locator('#mobile-menu').getByRole('link', { name: 'Projects' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator('#mobile-menu')).toBeHidden();
  expect(await page.locator('main').evaluate((el) => (el as HTMLElement).inert)).toBe(false);
});

test('unknown routes return the branded 404', async ({ page }) => {
  const res = await page.goto('/does-not-exist');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('didn’t make it');
  await expect(page.getByRole('link', { name: 'Back to the lab' })).toHaveAttribute('href', '/');
});

test('contact: placeholder email never renders a mailto to a TODO address', async ({ page }) => {
  await page.goto('/');
  const mailtos = page.locator('a[href^="mailto:"]');
  for (const a of await mailtos.all()) {
    await expect(a).not.toHaveAttribute('href', /todo/i);
  }
});

test('SEO: canonical, OG tags, sitemap, robots, favicons', async ({ page, request }) => {
  await page.goto('/projects');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://rdwlabz.com/projects',
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.png$/);
  for (const p of [
    '/sitemap-index.xml',
    '/robots.txt',
    '/favicon.svg',
    '/favicon.ico',
    '/og.png',
    '/apple-touch-icon.png',
    '/site.webmanifest',
  ]) {
    expect((await request.get(p)).status(), p).toBe(200);
  }
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).toContain('https://rdwlabz.com/projects');
  expect(sitemap).not.toContain('404');
  expect(sitemap).not.toContain('_gallery');
});

test.describe('no JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('content is readable and filters degrade to links', async ({ page }) => {
    await page.goto('/projects?c=mods');
    await expect(page.locator('.project-card').first()).toBeVisible();
    await expect(page.locator('[data-filter="mods"]')).toHaveAttribute('href', '/projects?c=mods');
    await page.goto('/');
    await expect(page.locator('#what-we-build .tile').first()).toBeVisible();
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('reveals are visible immediately and hero tokens are static', async ({ page }) => {
    await page.goto('/');
    const tile = page.locator('#what-we-build [data-reveal]').first();
    await expect(tile).toHaveCSS('opacity', '1');
    const anim = await page
      .locator('.token')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe('none');
  });
});
