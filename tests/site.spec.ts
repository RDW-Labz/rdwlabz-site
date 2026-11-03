import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { astroBuild, escapeRe, settleMotion, shelf } from './helpers';
import { categories, listPhrase, pickActive, type CategoryId } from '../src/lib/projects';
import { packs } from '../src/lib/library';

const PAGES = [
  '/',
  '/projects',
  '/about',
  '/privacy',
  '/404',
  '/library',
  ...(packs[0] ? [`/library/${packs[0].slug}`] : []),
];
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/** `/` and `/about` use the approved 3D/paper prototype layout, not the content-page shell. */
const PROTO_PAGES = new Set(['/', '/about']);
/** The prototype pages are heavy WebGL by default; static HTML is enough for shell checks. */
const protoTestPath = (path: string) => (PROTO_PAGES.has(path) ? `${path}?nogl` : path);

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
    await page.goto(protoTestPath(path));
    await settleMotion(page);
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${path}: one h1, skip link, landmarks, title + description`, async ({ page }) => {
    await page.goto(protoTestPath(path));
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

test('categories: empty ones stay hidden and come back once they have a project', () => {
  const ids = (list: { name: string; category: CategoryId }[]) =>
    pickActive(categories, list).map((c) => c.id);
  expect(ids([])).toEqual([]);
  expect(ids([{ name: 'A game', category: 'games' }])).toEqual(['games']);
  expect(
    ids([
      { name: 'A mod', category: 'mods' },
      { name: 'A game', category: 'games' },
      { name: 'TODO: name', category: 'software' },
    ]),
  ).toEqual(['games', 'mods']);
  expect(listPhrase(['games'])).toBe('games');
  expect(listPhrase(['software', 'games'])).toBe('software and games');
  expect(listPhrase(['software', 'games', 'mods'])).toBe('software, games and mods');
});

test('home: the 3D workbench states who we are and links to work/about', async ({ page }) => {
  await page.goto('/');
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toContainText('We build software');
  await expect(h1).toContainText('clay 3D');
  await expect(page.locator('#nav a[href="/#work"]')).toHaveText('Work');
  await expect(page.locator('#nav a[href="/about"]')).toHaveText('About');
});

test('home: the no-WebGL fallback still shows every project', async ({ page }) => {
  await page.goto('/?nogl');
  await expect(page.locator('#bench')).toBeVisible();
  await expect(page.locator('#bench .pol')).toHaveCount(13);
  await expect(page.locator('#bench')).toContainText('Dormant Red');
  await expect(page.locator('#bench')).toContainText('Verrow AI');
});

test('journey: home → about (real route) → browser back', async ({ page }) => {
  await page.goto('/');
  await page.locator('#nav a[href="/about"]').click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator('#about')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#home')).toBeVisible();
});

test('projects: filter chips exist only for categories with projects', async ({ page }) => {
  await page.goto('/projects');
  await expect(page.locator('[data-filter]')).toHaveCount(1 + shelf.active.length);
  for (const c of shelf.hidden) await expect(page.locator(`[data-filter="${c}"]`)).toHaveCount(0);
  for (const c of shelf.active) {
    await expect(page.locator(`[data-filter="${c}"] .chip-filter__count`)).toHaveText(
      String(shelf.projects.filter((p) => p.category === c).length),
    );
  }
  // An old link to a hidden category shows everything instead of an empty shelf.
  if (shelf.hidden.length) {
    await page.goto(`/projects?c=${shelf.hidden[0]}`);
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
  }
});

test('projects: filters by click and keyboard, reflect URL, and reset', async ({ page }) => {
  test.skip(shelf.active.length === 0, 'no categories have projects');
  const [id] = shelf.active;
  await page.goto('/projects');
  const visible = page.locator('[data-project-grid] > li:not([hidden])');
  const total = await page.locator('[data-project-grid] > li').count();
  await expect(visible).toHaveCount(total);

  await page.locator(`[data-filter="${id}"]`).click();
  await expect(page).toHaveURL(new RegExp(`\\?c=${id}$`));
  await expect(page.locator(`[data-filter="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'false');
  for (const li of await visible.all()) await expect(li).toHaveAttribute('data-category', id);

  await page.locator('[data-filter="all"]').focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/\/projects$/);
  await expect(visible).toHaveCount(total);
  await page.locator(`[data-filter="${id}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`\\?c=${id}$`));
  await page.locator('[data-filter="all"]').click();
  await expect(visible).toHaveCount(total);
});

/** Empty-state copy that must only ship in the HTML when there are no projects. */
// Markup is matched as elements: the inlined filter script mentions these selectors too.
const EMPTY_SHELF = [
  'Nothing on this shelf yet',
  'No projects on the shelf yet',
  /<div[^>]*\bdata-empty\b/,
];
const EMPTY_FILTER = ['We haven’t published any', 'Show all projects', /<a[^>]*data-filter-reset/];
const EMPTY_FEATURED = 'Featured projects are on their way';
const GRID = /<ul[^>]*data-project-grid/;
const has = (html: string, s: string | RegExp) =>
  typeof s === 'string' ? html.includes(s) : s.test(html);

test('empty states are not in the served HTML when projects exist', async ({ request }) => {
  test.skip(shelf.projects.length === 0, 'shelf is empty; see the empty-build test');
  const projects = await (await request.get('/projects')).text();
  for (const s of [...EMPTY_SHELF, ...EMPTY_FILTER])
    expect(has(projects, s), String(s)).toBe(false);
  expect(has(projects, GRID)).toBe(true);
  const home = await (await request.get('/')).text();
  for (const s of EMPTY_SHELF) expect(has(home, s), String(s)).toBe(false);
  if (shelf.projects.some((p) => p.featured)) expect(home).not.toContain(EMPTY_FEATURED);
});

test('empty states are in the built HTML when there are no projects', () => {
  test.slow();
  const tmp = mkdtempSync(join(tmpdir(), 'rdwlabz-empty-'));
  try {
    const data = JSON.parse(readFileSync('src/data/projects.json', 'utf8'));
    const dataFile = join(tmp, 'projects.json');
    writeFileSync(dataFile, JSON.stringify({ ...data, projects: [] }));
    // The library adds its own card, so the truly empty shelf needs an empty library too.
    const libFile = join(tmp, 'library.json');
    writeFileSync(libFile, JSON.stringify({ packs: [] }));
    const outDir = join(tmp, 'dist');
    astroBuild(outDir, { RDWLABZ_DATA: resolve(dataFile), RDWLABZ_LIBRARY: resolve(libFile) });
    const projects = readFileSync(join(outDir, 'projects.html'), 'utf8');
    for (const s of EMPTY_SHELF) expect(has(projects, s), String(s)).toBe(true);
    for (const s of EMPTY_FILTER) expect(has(projects, s), String(s)).toBe(false);
    expect(has(projects, GRID)).toBe(false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
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
  test.skip(shelf.projects.length > 0, 'shelf has projects');
  await page.goto('/projects');
  await expect(page.locator('[data-filter-status]')).toHaveText('No projects on the shelf yet.');
  await expect(page.locator('[data-empty]')).toBeVisible();
  await expect(page.locator('[data-filter-reset]')).toHaveCount(0);
  await expect(page.locator('[data-empty] a[href^="mailto:"]')).toHaveCount(1);
  await expect(page.locator('[data-filter]')).toHaveCount(1);
});

test('projects: unknown ?c= falls back to All', async ({ page }) => {
  await page.goto('/projects?c=nope');
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
});

test('projects: cards without a link say so plainly, never a dead link or filler', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(page.locator('main')).not.toContainText(/details coming soon/i);
  const cards = page.locator('.project-card');
  for (const card of await cards.all()) {
    const links = card.locator('a');
    const note = card.getByText(/^(Link coming soon|Not out yet)$/);
    expect((await links.count()) + (await note.count())).toBeGreaterThan(0);
    // External store/repo links, or the site's own Clay Asset Library.
    for (const a of await links.all()) {
      await expect(a).toHaveAttribute('href', /^(https:\/\/|\/library$)/);
    }
  }
});

test('projects: synced store labels, buttons and real screenshots render', async ({ page }) => {
  await page.goto('/projects');
  for (const p of shelf.projects) {
    const card = page.locator(`.project-card:has(#proj-${p.slug}-title)`);
    await expect(card.locator('.chip--status')).toHaveText(p.statusText);
    if (p.href) {
      await expect(
        card.getByRole('link', { name: new RegExp(escapeRe(p.ctaText)) }),
      ).toHaveAttribute('href', p.href);
    }
    const [first] = p.screenshots;
    const shown = p.image ? [] : first?.width > first?.height ? [first] : p.screenshots.slice(0, 2);
    for (const s of shown) {
      const img = card.locator(`img[src="${s.src}"]`);
      await expect(img).toHaveAttribute('alt', s.alt);
      await expect(img).toHaveAttribute('width', String(s.width));
    }
  }
});

test('mobile menu: opens, traps focus, Esc closes and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');
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
  await page.goto('/privacy');
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
    await page.goto(protoTestPath(path));
    await expect(page.getByText(/email (address )?coming soon/i)).toHaveCount(0);
    const mailtos = page.locator('a[href^="mailto:"]');
    expect(await mailtos.count()).toBeGreaterThan(0);
    for (const a of await mailtos.all()) await expect(a).toHaveAttribute('href', MAILTO);
    if (!PROTO_PAGES.has(path)) {
      await expect(page.locator(`header a[href="${MAILTO}"]`).first()).toHaveText(/Contact/);
      for (const a of await page.locator(`footer a[href="${MAILTO}"]`).all()) {
        await expect(a).toHaveText(/devops@therdw\.com/);
      }
    }
  });

  test(`${path}: footer names the company, address and email`, async ({ page }) => {
    await page.goto(path === '/about' ? '/about?nogl#about-rest' : protoTestPath(path));
    if (PROTO_PAGES.has(path)) {
      if (path === '/about') await expect(page.locator('#aboutRest')).toBeVisible();
      const footer = page.locator('footer');
      await expect(footer).toContainText('© 2026 RDW, LLC');
      await expect(footer).toContainText('1301 N Main St, Harrison, AR 72601');
      await expect(footer).toContainText('devops@therdw.com');
      await expect(footer.locator(`a[href="${MAILTO}"]`).first()).toBeVisible();
      return;
    }
    const year = new Date().getFullYear();
    await expect(page.locator('[data-legal]')).toHaveText(
      `© ${year} RDW, LLC. RDW Labz is a brand of RDW, LLC · 1301 N Main St, Harrison, AR 72601 · devops@therdw.com`,
    );
    await expect(page.locator(`[data-legal] a[href="${MAILTO}"]`)).toHaveCount(1);
    const nav = page.getByRole('navigation', { name: 'Footer' });
    await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
    await expect(nav.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });
}

test('footer year follows the visitor’s clock, not only the build', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2031-03-01T12:00:00Z'));
  await page.goto('/projects');
  await expect(page.locator('[data-year]')).toHaveText('2031');
});

test('about: the paper walk keeps the real facts and the partner offer', async ({ page }) => {
  await page.goto('/about#about-rest');
  await expect(page.locator('#aboutRest')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('About RDW Labz');
  const main = page.locator('main');
  await expect(main).toContainText('Two benches, one workshop');
  await expect(main).toContainText('Harrison');
  await expect(main).toContainText('1301 N Main St');
  await expect(main).toContainText('Harrison, AR 72601');
  await expect(main.locator(`a[href="${MAILTO}"]`).first()).toBeVisible();
  await expect(main).toContainText('Verrow AI');
  await expect(main.locator('a[href="https://verrow.ai/"]').first()).toBeVisible();
  await expect(main).toContainText('Dormant Red');
  await expect(main).toContainText('Putt Drop');
  await expect(page.locator('header a[aria-current="page"]').first()).toHaveText(/About/);
});

test('privacy: RDW, LLC policy with the right contact, no leftovers, no motion', async ({
  page,
}) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy Policy');
  const main = page.locator('main');
  await expect(main).toContainText('This policy explains how RDW, LLC');
  await expect(main.locator('address')).toContainText('1301 N Main St');
  await expect(main.locator('address')).toContainText('Harrison, AR 72601, United States');
  await expect(main).not.toContainText(/Cluer|operations@|601 US 62|\[DATE\]|TODO|GoDaddy|Draft/);
  await expect(main.locator('.policy__date')).toHaveText('Effective date: October 13, 2026');
  // Only stores we ship on; no clauses for features no product has.
  await expect(main).not.toContainText(
    /Steam|Valve|Roblox|Mojang|Microsoft|username|your account/i,
  );
  await expect(main).toContainText('itch.io, Google Play and Apple’s App Store');
  await expect(main).toContainText(`personal information, email ${shelf.site.contactEmail} and`);
  await expect(main).toContainText(`information by emailing ${shelf.site.contactEmail}.`);
  const analytics = page.getByRole('heading', { level: 2, name: 'Website analytics' });
  await expect(analytics).toHaveCount(1);
  await expect(analytics.locator('xpath=following-sibling::p[1]')).toContainText(
    'rdwlabz.com uses Cloudflare Web Analytics',
  );
  for (const a of await main.locator('a[href^="mailto:"]').all()) {
    await expect(a).toHaveAttribute('href', MAILTO);
  }
  await expect(main.locator('[data-reveal]')).toHaveCount(0);
  for (const h of ['What we collect', 'Children', 'Your choices and rights', 'Contact']) {
    await expect(page.getByRole('heading', { level: 2, name: h })).toHaveCount(1);
  }
});

test('mobile nav: Work, About and Contact are real routes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?nogl');
  const nav = page.locator('#nav');
  await expect(nav.getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/#work');
  await expect(nav.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
  await expect(nav.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/#contact');
  await nav.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about$/);
});

test('content pages: mobile menu lists About and the Privacy Policy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');
  await page.locator('[data-menu-toggle]').click();
  const menu = page.locator('#mobile-menu');
  await expect(menu.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
  await expect(menu.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
    'href',
    '/privacy',
  );
});

test('home: the contact dialog and footer link the lab email', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(`#dlgWrap a[href="${MAILTO}"]`)).toHaveCount(1);
  await expect(page.locator(`footer a[href="${MAILTO}"]`)).toHaveCount(1);
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
  for (const p of ['/projects', '/about', '/privacy', '/library']) {
    expect(sitemap).toContain(`https://rdwlabz.com${p}`);
  }
  for (const p of packs) expect(sitemap).toContain(`https://rdwlabz.com/library/${p.slug}`);
  expect(sitemap).not.toContain('404');
  expect(sitemap).not.toContain('_gallery');
});

for (const path of PAGES) {
  test(`${path}: reflows at 320px with no horizontal scrolling (WCAG 1.4.10)`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(protoTestPath(path));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test(`${path}: every tab stop shows a visible focus indicator`, async ({ page }) => {
    await page.goto(protoTestPath(path));
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
    const id = shelf.active[0] ?? 'games';
    await page.goto(`/projects?c=${id}`);
    const hasCards = (await page.locator('.project-card').count()) > 0;
    await expect(page.locator(hasCards ? '.project-card' : '[data-empty]').first()).toBeVisible();
    if (shelf.active.length) {
      await expect(page.locator(`[data-filter="${id}"]`)).toHaveAttribute(
        'href',
        `/projects?c=${id}`,
      );
    }
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('home still renders the workbench', async ({ page }) => {
    await page.goto('/?quality=low');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('We build software');
    await expect.poll(() => page.evaluate('!!window.__world'), { timeout: 30000 }).toBe(true);
  });

  test('about can skip straight to the plain paper version', async ({ page }) => {
    await page.goto('/about#about-rest');
    await expect(page.locator('#aboutRest')).toBeVisible();
    await expect(page.locator('#aboutRest')).toContainText('Two benches, one workshop');
    await expect(page.locator('#aboutRest')).toContainText('Say hi to the lab!');
  });
});

test.describe('screen world', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('home exposes every screen-world beat', async ({ page }) => {
    await page.goto('/?quality=low');
    await expect
      .poll(() => page.evaluate('window.__world?.beats?.length ?? 0'), { timeout: 90000 })
      .toBe(11);
    expect(await page.evaluate('window.__world.beats.map((b) => b.id)')).toEqual([
      'ring',
      'build',
      'studio',
      'arcade',
      'putt',
      'library',
      'numbers',
      'process',
      'friends',
      'touch',
      'harrison',
    ]);
  });

  test('the chapter rail lists all beats and the ring carries every project', async ({ page }) => {
    await page.goto('/?quality=low');
    await expect
      .poll(() => page.locator('#worldUI .wr-rail button').count(), { timeout: 90000 })
      .toBe(11);
    await expect
      .poll(() => page.evaluate('window.__world?.projects?.length ?? 0'), { timeout: 90000 })
      .toBe(15);
    await page.goto('/projects');
    await expect(page.getByRole('heading', { level: 1, name: 'Projects' })).toHaveCount(1);
  });
});
