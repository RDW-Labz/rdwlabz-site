import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { astroBuild, settleMotion } from './helpers';
import {
  findPersonalData,
  isLocalUrl,
  pageProblem,
  validateShowcase,
} from '../scripts/showcase/checks.mjs';
import { diffRatio, encodeWebp, MAX_BYTES } from '../scripts/showcase/images.mjs';
import { showcase } from '../src/lib/showcase';

const data = JSON.parse(readFileSync('src/data/showcase.json', 'utf8'));
const shots = JSON.parse(readFileSync('src/data/showcase-shots.json', 'utf8'));
const entry = (over: Record<string, unknown> = {}) => ({
  slug: 'demo',
  name: 'Demo',
  url: 'https://example.com/',
  kind: 'web',
  blurb: 'A demo site.',
  tags: ['Demo'],
  private: false,
  ...over,
});

test.describe('showcase data', () => {
  test('showcase.json is valid', () => {
    expect(validateShowcase(data)).toEqual([]);
  });

  test('bad entries are rejected', () => {
    const cases: [Record<string, unknown>[], RegExp][] = [
      [[entry({ url: 'http://example.com/' })], /public https URL/],
      [[entry({ url: 'https://localhost:3000/' })], /public https URL/],
      [[entry({ private: true })], /must not have a url/],
      [[entry({ private: true, url: null, publicContact: ['a@b.co'] })], /can't allow contact/],
      [[entry(), entry()], /duplicate slug/],
      [[entry({ slug: 'Bad Slug' })], /bad slug/],
      [[entry({ kind: 'game' })], /kind must be "web"/],
      [[entry({ private: 'no' })], /true or false/],
      [[entry({ blurb: 'Call (870) 555-0100 today.' })], /contact details in the copy/],
      [[entry({ blurb: 'Mail jane.doe@example.com' })], /contact details in the copy/],
      [[entry({ blurb: '<script>x</script>' })], /bad blurb/],
      [[entry({ tags: ['a', 'b', 'c', 'd', 'e'] })], /tags/],
      [[entry({ downloads: 9000 })], /unknown field "downloads"/],
    ];
    for (const [d, re] of cases) expect(validateShowcase(d).join('\n'), String(re)).toMatch(re);
    expect(validateShowcase([entry({ private: true, url: null })])).toEqual([]);
  });

  test('personal data is found; specs, prices and dates are not', () => {
    const hits = findPersonalData(
      'Write jane@example.com or call (870) 555-0100, +44 20 7946 0958.\n' +
        'Visit 123 Main Street, or PO Box 77. Harrison, AR 72601',
    ).map((h) => h.kind);
    expect(hits.filter((k) => k === 'email')).toHaveLength(1);
    expect(hits.filter((k) => k === 'phone')).toHaveLength(2);
    expect(hits.filter((k) => k === 'address')).toHaveLength(3);
    expect(
      findPersonalData(
        'Forty-eight NVIDIA B300 GPUs. 2,304 GB HBM3E. $1,299.00. Nov 2026. 48 × B300. 8 TB/s. 2026-10-15',
      ),
    ).toEqual([]);
  });

  test("a site's own published contact can be allowed, exactly", () => {
    expect(findPersonalData('Call (870) 517-5028', ['(870) 517-5028'])).toEqual([]);
    expect(findPersonalData('Call 870.517.5028', ['(870) 517-5028'])).toEqual([]);
    expect(findPersonalData('Call (870) 517-5029', ['(870) 517-5028'])).toHaveLength(1);
  });

  test('error pages, login walls and blank pages are refused', () => {
    const ok = {
      status: 200,
      url: 'https://example.com/',
      title: 'Example',
      headings: ['Hello'],
      passwordFields: 0,
      bodyText: 'A perfectly normal home page with words.',
    };
    expect(pageProblem(ok)).toBeNull();
    expect(pageProblem({ ...ok, status: 503 })).toMatch(/HTTP 503/);
    expect(pageProblem({ ...ok, title: 'Page not found' })).toMatch(/error page/);
    expect(pageProblem({ ...ok, headings: ['Just a moment...'] })).toMatch(/error page/);
    expect(pageProblem({ ...ok, passwordFields: 1 })).toMatch(/login wall/);
    expect(pageProblem({ ...ok, url: 'https://example.com/login?next=/' })).toMatch(/login wall/);
    expect(pageProblem({ ...ok, bodyText: 'Please sign in to continue.' })).toMatch(/login wall/);
    expect(pageProblem({ ...ok, bodyText: ' ' })).toMatch(/blank/);
  });

  test('capture-private only takes local URLs', () => {
    for (const u of ['http://localhost:3000/', 'http://127.0.0.1:8080', 'http://192.168.1.20/'])
      expect(isLocalUrl(u), u).toBe(true);
    for (const u of ['https://example.com/', 'http://8.8.8.8/', 'file:///etc/passwd', 'nope'])
      expect(isLocalUrl(u), u).toBe(false);
  });
});

test.describe('showcase images', () => {
  const noise = (w: number, h: number, seed = 1) => {
    const buf = Buffer.alloc(w * h * 3);
    let x = seed;
    for (let i = 0; i < buf.length; i++) buf[i] = (x = (x * 1103515245 + 12345) & 0x7fffffff) & 255;
    return sharp(buf, { raw: { width: w, height: h, channels: 3 } })
      .png()
      .toBuffer();
  };
  const blocks = async (
    w: number,
    h: number,
    box?: { left: number; top: number; size: number },
  ) => {
    let img = sharp({ create: { width: w, height: h, channels: 3, background: '#fff6ea' } });
    if (box)
      img = img.composite([
        {
          input: await sharp({
            create: { width: box.size, height: box.size, channels: 3, background: '#1e1433' },
          })
            .png()
            .toBuffer(),
          left: box.left,
          top: box.top,
        },
      ]);
    return img.png().toBuffer();
  };

  test('encodeWebp stays under 400 KB even for incompressible input', async () => {
    const out = await encodeWebp(await noise(2880, 1800));
    expect(out.buf.length).toBeLessThanOrEqual(MAX_BYTES);
    expect((await sharp(out.buf).metadata()).format).toBe('webp');
  });

  test('perceptual diff: identical 0, tiny change under 2%, real change over 2%, new height 100%', async () => {
    const base = await blocks(1440, 900);
    expect(await diffRatio(base, base)).toBe(0);
    const tiny = await blocks(1440, 900, { left: 700, top: 400, size: 40 }); // ~0.1% of pixels
    expect(await diffRatio(base, tiny)).toBeLessThan(0.02);
    const big = await blocks(1440, 900, { left: 100, top: 100, size: 400 }); // ~12%
    expect(await diffRatio(base, big)).toBeGreaterThan(0.02);
    expect(await diffRatio(base, await blocks(1440, 1200))).toBe(1);
  });

  test('perceptual diff on saved screenshots: re-encode is not a change, another site is', async () => {
    const yotta = readFileSync('tests/fixtures/showcase/yottaify.webp');
    const forge = readFileSync('tests/fixtures/showcase/forge-pizza-co.webp');
    const reencoded = await sharp(yotta).webp({ quality: 40 }).toBuffer();
    expect(await diffRatio(yotta, reencoded)).toBeLessThan(0.02);
    expect(await diffRatio(yotta, forge)).toBeGreaterThan(0.02);
  });

  test('every captured site has its images on disk, each under 400 KB', () => {
    for (const e of data.filter((d: { private: boolean }) => !d.private)) {
      expect(shots[e.slug], `${e.slug} has never been captured`).toBeTruthy();
      for (const key of ['desktop', 'desktop-full', 'mobile', 'mobile-full', 'og']) {
        const file = join('public/showcase', e.slug, `${key}.webp`);
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size, file).toBeLessThanOrEqual(MAX_BYTES);
      }
      expect(shots[e.slug].files.og).toMatchObject({ width: 1200, height: 630 });
    }
  });
});

test.describe('web projects on the site', () => {
  // Tests never reach the live sites: anything off localhost is blocked and fails the test.
  let external: string[] = [];
  test.beforeEach(async ({ context }) => {
    external = [];
    await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => {
      external.push(route.request().url());
      return route.abort();
    });
  });
  test.afterEach(() => {
    expect(external, 'requests to external sites').toEqual([]);
  });

  // The approved prototype home has no "Web projects" section; /projects still does.
  for (const path of ['/projects']) {
    test(`${path}: cards link out safely with labelled screenshots`, async ({ page }) => {
      await page.goto(path);
      const section = page.locator('#web-projects');
      await expect(section.getByRole('heading', { level: 2, name: 'Web projects' })).toBeVisible();
      await expect(section.locator('[data-showcase]')).toHaveCount(showcase.length);
      for (const s of showcase) {
        const card = section.locator(`[data-showcase="${s.slug}"]`);
        await expect(card.getByRole('heading', { level: 3 })).toContainText(s.name);
        await expect(card).toContainText(s.blurb);
        for (const t of s.tags) await expect(card.locator('.web-card__tags')).toContainText(t);
        const img = card.locator('img');
        if (s.image) {
          await expect(img).toHaveAttribute('alt', new RegExp(`^Screenshot of .*${s.name}`));
          await expect(img).toHaveAttribute('width', /\d+/);
        } else await expect(img).toHaveCount(0);
        const links = card.locator('a');
        if (s.private) {
          await expect(links).toHaveCount(0);
          await expect(card).toContainText('Private build: demo on request');
          continue;
        }
        await expect(links).toHaveCount(1);
        await expect(links).toHaveAttribute('href', s.href!);
        await expect(links).toHaveAttribute('target', '_blank');
        expect((await links.getAttribute('rel'))!.split(' ').sort()).toEqual([
          'noopener',
          'noreferrer',
        ]);
        await expect(links).toHaveAccessibleName(`${s.name} (opens external site in a new tab)`);
      }
    });

    test(`${path}: web projects reflow at 320px`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(path);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        const cards = [...document.querySelectorAll('[data-showcase]')].map(
          (c) => c.getBoundingClientRect().right - document.documentElement.clientWidth,
        );
        return Math.max(doc, ...cards);
      });
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('clicking a card (not just the name) opens the live site in a new tab', async ({
    page,
    context,
  }) => {
    const s = showcase.find((x) => x.href);
    test.skip(!s, 'no public web projects');
    // Registered after the blocker, so it wins for this one URL: a local stub, not the site.
    await context.route(s!.href!, (r) => r.fulfill({ body: '<title>stub</title>stub' }));
    await page.goto('/projects');
    // A plain mouse click on the blurb: the link's stretched hit area covers it.
    const blurb = page.locator(`[data-showcase="${s!.slug}"] .web-card__blurb`);
    await blurb.scrollIntoViewIfNeeded();
    await settleMotion(page);
    const box = (await blurb.boundingBox())!;
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.mouse.click(box.x + box.width / 2, box.y + box.height / 2),
    ]);
    expect(popup.url()).toBe(s!.href);
    // noopener: the new tab can't reach back into ours.
    expect(await popup.evaluate(() => window.opener)).toBeNull();
  });

  test('private entries show "demo on request" and no link (fixture build)', () => {
    test.slow();
    const tmp = mkdtempSync(join(tmpdir(), 'rdwlabz-showcase-'));
    try {
      const file = join(tmp, 'showcase.json');
      writeFileSync(
        file,
        JSON.stringify([
          ...data,
          entry({ slug: 'secret-app', name: 'Secret App', private: true, url: null }),
        ]),
      );
      const outDir = join(tmp, 'dist');
      astroBuild(outDir, { RDWLABZ_SHOWCASE: resolve(file) });
      const html = readFileSync(join(outDir, 'projects.html'), 'utf8');
      const card = html.match(/<article[^>]*data-showcase="secret-app"[\s\S]*?<\/article>/)?.[0];
      expect(card).toBeTruthy();
      expect(card).toContain('Private build: demo on request');
      expect(card).not.toMatch(/<a\b/);
      expect(card).not.toContain('<img');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
