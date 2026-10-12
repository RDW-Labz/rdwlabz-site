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
  await expect(page.locator('[data-filter-status]')).toContainText(
    /in Mods|No projects on the shelf yet/,
  );
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
  test.skip(
    (await page.locator('[data-project-grid] > li').count()) === 0,
    'shelf is empty; covered by the empty-shelf test',
  );
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

test('placeholder entries are never shown or counted', async ({ page }) => {
  for (const path of ['/', '/projects']) {
    await page.goto(path);
    await expect(page.locator('.project-card.is-placeholder')).toHaveCount(0);
    await expect(page.getByText('Something’s brewing')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/\b(0|1) projects\b/);
  }
  await page.goto('/projects');
  for (const count of await page.locator('.chip-filter__count').all()) {
    await expect(count).not.toHaveText('0');
  }
  const cards = await page.locator('[data-project-grid] > li').count();
  const allCount = page.locator('[data-filter="all"] .chip-filter__count');
  if (cards === 0) await expect(allCount).toHaveCount(0);
  else await expect(allCount).toHaveText(String(cards));
});

test('projects: an empty shelf says so and never links back to itself', async ({ page }) => {
  await page.goto('/projects');
  test.skip((await page.locator('[data-project-grid] > li').count()) > 0, 'shelf has projects');
  await expect(page.locator('[data-filter-status]')).toHaveText('No projects on the shelf yet.');
  await expect(page.locator('[data-empty]')).toBeVisible();
  await expect(page.locator('[data-filter-reset]')).toHaveCount(0);
  await expect(page.locator('[data-empty] a[href^="mailto:"]')).toHaveCount(1);
  await page.locator('[data-filter="games"]').click();
  await expect(page.locator('[data-filter-status]')).toHaveText('No projects on the shelf yet.');
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

const MAILTO = 'mailto:devops@therdw.com';

for (const path of PAGES) {
  test(`${path}: every contact spot is a real mailto, no "Email coming soon"`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText(/email (address )?coming soon/i)).toHaveCount(0);
    const mailtos = page.locator('a[href^="mailto:"]');
    expect(await mailtos.count()).toBeGreaterThan(0);
    for (const a of await mailtos.all()) await expect(a).toHaveAttribute('href', MAILTO);
    await expect(page.locator(`header a[href="${MAILTO}"]`).first()).toHaveText(/Contact/);
    await expect(page.locator(`footer a[href="${MAILTO}"]`)).toHaveText(/devops@therdw\.com/);
  });
}

test('home: hero, Work with us and CTA band all link to the contact email', async ({ page }) => {
  await page.goto('/');
  for (const scope of ['[data-hero]', '.wwu', '.cta']) {
    await expect(page.locator(`${scope} a[href="${MAILTO}"]`), scope).toHaveCount(1);
  }
});

test('404: offers a way to email the lab', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.locator(`main a[href="${MAILTO}"]`)).toHaveCount(1);
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

for (const path of PAGES) {
  test(`${path}: reflows at 320px with no horizontal scrolling (WCAG 1.4.10)`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`${path}: every tab stop shows a visible focus indicator`, async ({ page }) => {
    await page.goto(path);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const ring =
          (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) ||
          // Focus ring shadows are added on top of the resting shadow, so there are ≥ 2.
          (cs.boxShadow.match(/rgba?\(/g) ?? []).length >= 2;
        return { key: el.outerHTML.slice(0, 80), ring };
      });
      if (!info || seen.has(info.key)) break;
      seen.add(info.key);
      expect(info.ring, info.key).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(2);
  });
}

test.describe('no JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('content is readable and filters degrade to links', async ({ page }) => {
    await page.goto('/projects?c=mods');
    const hasCards = (await page.locator('.project-card').count()) > 0;
    await expect(page.locator(hasCards ? '.project-card' : '[data-empty]').first()).toBeVisible();
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

  test('hero shows the full static sentence, no cycler, no pause button', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero__tag-static')).toBeVisible();
    await expect(page.locator('.hero__tag-cycle')).toBeHidden();
    await expect(page.locator('[data-motion-toggle]')).toBeHidden();
  });
});

test.describe('round 2 motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('hero cycler swaps the category word', async ({ page }) => {
    await page.goto('/');
    const on = page.locator('.cycler__word.is-on');
    await expect(on).toHaveCount(1);
    const first = await on.textContent();
    await expect.poll(() => on.textContent(), { timeout: 6000 }).not.toBe(first);
    // The cycle is decorative; the h1's accessible name keeps the full sentence.
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      /RDW Labz.*software, games, mods and asset packs/i,
    );
  });

  test('pause toggle stops the cycler and persists across reloads', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-motion-toggle]');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect(toggle).toContainText('Play animations');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
    await expect(page.locator('.hero__tag-static')).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'paused');
    await expect(page.locator('[data-motion-toggle]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-motion-toggle]').click();
    await expect(page.locator('html')).not.toHaveAttribute('data-motion', 'paused');
  });

  test('pop headings keep their accessible names', async ({ page }) => {
    await page.goto('/');
    for (const name of ['What we build', 'Fresh from the lab', 'Work with us']) {
      await expect(page.getByRole('heading', { level: 2, name })).toHaveCount(1);
    }
    await page.goto('/projects');
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toHaveCount(1);
  });

  test('lab activity lists build-time updates linking to the shelf', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('.activity li');
    // Built from real projects only: no projects, no strip.
    if ((await items.count()) === 0) {
      await expect(page.locator('.activity')).toHaveCount(0);
      return;
    }
    expect(await items.count()).toBeLessThanOrEqual(3);
    await expect(items.first().locator('a')).toHaveAttribute('href', /^\/projects\?c=/);
    await expect(items.first().locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
  });

  test('scroll progress is decorative and fills as you scroll', async ({ page }) => {
    await page.goto('/');
    const bar = page.locator('[data-scroll-progress]');
    await expect(bar).toHaveAttribute('aria-hidden', 'true');
    const scaleAt = () => bar.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    const top = await scaleAt();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(scaleAt).toBeGreaterThan(top + 0.2);
  });
});
