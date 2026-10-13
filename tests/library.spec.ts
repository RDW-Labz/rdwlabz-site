import { test, expect, type Page } from '@playwright/test';
import { astroBuild } from './helpers';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { downloadFor, isAllowedDownload, validatePackJson } from '../scripts/library/validate.mjs';
import { facets, packAction, packs, validateLibrary, type LibraryPack } from '../src/lib/library';

const realPacks: LibraryPack[] = JSON.parse(readFileSync('src/data/library.json', 'utf8')).packs;

/** A minimal valid upstream pack.json (clay-asset-packs/packs/<batch>/pack.json). */
const upstream = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  id: 'batch001',
  slug: 'test-pack',
  name: 'Test pack',
  description: 'Two clay models.',
  category: 'Medieval',
  style: 'Claymation',
  tags: ['knight'],
  formats: ['GLB'],
  free: false,
  price: null,
  listed: true,
  license: 'TODO: license',
  aiGenerated: true,
  assets: [
    {
      id: 'char_knight',
      name: 'Knight',
      kind: 'character',
      file: 'models/batch001/char_knight.glb',
      triangles: 9000,
    },
    {
      id: 'prop_barrel',
      name: 'Barrel',
      kind: 'prop',
      file: 'models/batch001/prop_barrel.glb',
      triangles: null,
    },
  ],
  hero: ['char_knight'],
  textures: [],
  files: [{ path: 'models/batch001/char_knight.glb', bytes: 1200 }],
  totalBytes: 1200,
  download: null,
  ...over,
});

const SHA = 'a'.repeat(64);

test.describe('manifest validation', () => {
  test('a well-formed pack.json passes', () => {
    expect(validatePackJson(upstream())).toEqual([]);
  });

  test('rejects unsafe or broken manifests', () => {
    const bad: [Record<string, unknown>, RegExp][] = [
      [{ slug: '../etc' }, /slug/],
      [{ slug: 'Has Spaces' }, /slug/],
      [{ schemaVersion: 2 }, /schemaVersion/],
      [{ formats: [] }, /formats/],
      [{ free: 'yes' }, /free/],
      [{ free: true, price: 5, license: 'CC0' }, /free pack cannot have a price/],
      [{ free: true }, /free pack needs a real license/],
      [{ price: -1 }, /price/],
      [{ hero: ['nope'] }, /hero/],
      [{ hero: [] }, /hero/],
      [{ listed: true, review: 'TODO: check names' }, /open review/],
      [{ files: [{ path: '../secret', bytes: 1 }] }, /safe paths/],
      [
        {
          assets: [
            {
              id: 'Bad-Id',
              name: 'x',
              kind: 'character',
              file: 'models/batch001/x.glb',
              triangles: 1,
            },
          ],
          hero: ['Bad-Id'],
        },
        /snake_case/,
      ],
      [
        {
          assets: [
            { id: 'a', name: 'A', kind: 'robot', file: 'models/batch001/a.glb', triangles: 1 },
          ],
          hero: ['a'],
        },
        /bad kind/,
      ],
      [{ download: { key: 'packs/x/../../evil.zip', bytes: 1, sha256: SHA } }, /download.key/],
      [{ download: { key: 'packs/test-pack/test-pack.zip', bytes: 1, sha256: 'nope' } }, /sha256/],
    ];
    for (const [over, re] of bad) {
      expect(validatePackJson(upstream(over)).join('\n'), JSON.stringify(over)).toMatch(re);
    }
    expect(validatePackJson(null)).toEqual(['not an object']);
    expect(validatePackJson([])).toEqual(['not an object']);
  });

  test('downloads only for free, licensed, uploaded packs on our own hosts', () => {
    const key = { key: 'packs/test-pack/test-pack.zip', bytes: 1000, sha256: SHA };
    const base = 'https://assets.rdwlabz.com/';
    expect(downloadFor(upstream({ free: true, license: 'CC0 1.0', download: key }), base)).toEqual({
      url: 'https://assets.rdwlabz.com/packs/test-pack/test-pack.zip',
      bytes: 1000,
      sha256: SHA,
    });
    expect(
      downloadFor(upstream({ free: false, license: 'CC0 1.0', download: key }), base),
    ).toBeNull();
    expect(
      downloadFor(upstream({ free: true, license: 'TODO: pick', download: key }), base),
    ).toBeNull();
    expect(
      downloadFor(upstream({ free: true, license: 'CC0 1.0', download: null }), base),
    ).toBeNull();
    expect(
      downloadFor(
        upstream({ free: true, license: 'CC0 1.0', download: key }),
        'https://evil.example/',
      ),
    ).toBeNull();
    expect(isAllowedDownload(`https://pub-${'0'.repeat(32)}.r2.dev/packs/a.zip`)).toBe(true);
    expect(isAllowedDownload('http://assets.rdwlabz.com/packs/a.zip')).toBe(false);
    expect(isAllowedDownload('https://assets.rdwlabz.com.evil.example/a.zip')).toBe(false);
  });
});

test.describe('library.json validation', () => {
  test.skip(realPacks.length === 0, 'no packs synced yet');
  const base = () => structuredClone(realPacks[0]);

  test('the synced library.json passes', () => {
    expect(validateLibrary({ packs: realPacks }).length).toBe(realPacks.length);
  });

  test('rejects packs that could ship a broken or unsafe page', () => {
    const cases: [(p: LibraryPack) => void, RegExp][] = [
      [(p) => (p.slug = 'Bad Slug'), /invalid slug/],
      [(p) => (p.media.thumb.src = 'https://evil.example/x.webp'), /media outside/],
      [(p) => (p.media.webm = `/library/packs/${p.slug}/../../x.webm`), /media outside/],
      [(p) => (p.assets[0].thumb = '/elsewhere/x.webp'), /thumb is outside/],
      [(p) => (p.media.mp4Bytes = 2_000_000), /over 1.5 MB/],
      [(p) => Object.assign(p, { free: true, price: 3 }), /free but has a price/],
      [
        (p) => (p.download = { url: 'https://assets.rdwlabz.com/a.zip', bytes: 1, sha256: SHA }),
        /not free/,
      ],
      [
        (p) =>
          Object.assign(p, {
            free: true,
            license: 'TODO: pick',
            download: { url: 'https://assets.rdwlabz.com/a.zip', bytes: 1, sha256: SHA },
          }),
        /no license/,
      ],
      [
        (p) =>
          Object.assign(p, {
            free: true,
            license: 'CC0 1.0',
            download: { url: 'https://evil.example/a.zip', bytes: 1, sha256: SHA },
          }),
        /allowed host/,
      ],
    ];
    for (const [mutate, re] of cases) {
      const p = base();
      mutate(p);
      expect(() => validateLibrary({ packs: [p] })).toThrow(re);
    }
    expect(() => validateLibrary({ packs: [base(), base()] })).toThrow(/duplicate slug/);
  });

  test('pack actions: download only when free + licensed + uploaded', () => {
    const dl = { url: 'https://assets.rdwlabz.com/a.zip', bytes: 1, sha256: SHA };
    expect(packAction({ free: true, license: 'CC0 1.0', download: dl }).kind).toBe('download');
    expect(packAction({ free: true, license: 'TODO: x', download: dl }).kind).toBe('free-soon');
    expect(packAction({ free: true, license: 'CC0 1.0', download: null }).kind).toBe('free-soon');
    expect(packAction({ free: false, license: 'CC0 1.0', download: null }).kind).toBe('buy-soon');
  });

  test('filter groups appear only when they can narrow the list', () => {
    const [a, b] = [base(), base()];
    b.slug = 'other';
    expect(facets([a, b]).map((g) => g.id)).toEqual([]);
    b.category = 'Something else';
    b.style = 'Low poly';
    b.formats = [...b.formats, 'FBX'];
    expect(facets([a, b]).map((g) => g.id)).toEqual(['category', 'style', 'format']);
  });
});

/** Build the site into a temp dir with a given library.json (and optionally projects.json). */
function buildWith(library: { packs: unknown[] }, projects?: unknown) {
  const tmp = mkdtempSync(join(tmpdir(), 'rdwlabz-lib-'));
  const libFile = join(tmp, 'library.json');
  writeFileSync(libFile, JSON.stringify(library));
  const env: Record<string, string> = { RDWLABZ_LIBRARY: resolve(libFile) };
  if (projects) {
    const projFile = join(tmp, 'projects.json');
    writeFileSync(projFile, JSON.stringify(projects));
    env.RDWLABZ_DATA = resolve(projFile);
  }
  const outDir = join(tmp, 'dist');
  astroBuild(outDir, env);
  const read = (f: string) => readFileSync(join(outDir, f), 'utf8');
  return {
    outDir,
    read,
    has: (f: string) => existsSync(join(outDir, f)),
    done: () => rmSync(tmp, { recursive: true, force: true }),
  };
}

test('build with 0 packs: no teaser, no library card or nav link, a friendly empty library', () => {
  test.slow();
  const projects = JSON.parse(readFileSync('src/data/projects.json', 'utf8'));
  const b = buildWith({ packs: [] });
  try {
    const home = b.read('index.html');
    expect(home).not.toContain('id="clay-library"');
    expect(home).not.toContain('data-portal-overlay');
    expect(home).not.toContain('href="/library"');
    const lib = b.read('library.html');
    expect(lib).toContain('data-lib-empty');
    expect(lib).toContain('Coming soon');
    expect(lib).not.toContain('data-lib-grid');
    expect(lib).not.toContain('data-lib-tools');
    const pages = b.has('library')
      ? readdirSync(join(b.outDir, 'library')).filter((f) => f.endsWith('.html'))
      : [];
    expect(pages).toEqual([]);
    const proj = b.read('projects.html');
    expect(proj).not.toContain('Clay Asset Library');
    const hasAssetProject = projects.projects.some(
      (p: { category: string; name: string }) =>
        p.category === 'asset-packs' && !/^TODO/.test(p.name),
    );
    if (!hasAssetProject) expect(proj).not.toContain('data-filter="asset-packs"');
  } finally {
    b.done();
  }
});

test('free vs paid: only free + licensed + uploaded packs get a download button', () => {
  test.skip(realPacks.length < 3, 'needs 3 synced packs for the fixture');
  test.slow();
  const [free, paid, soon] = realPacks.slice(0, 3).map((p) => structuredClone(p));
  Object.assign(free, {
    free: true,
    license: 'CC0 1.0 (test fixture)',
    download: {
      url: `https://assets.rdwlabz.com/packs/${free.slug}/${free.slug}.zip`,
      bytes: 12_345_678,
      sha256: SHA,
    },
  });
  Object.assign(paid, { free: false, price: null, download: null });
  Object.assign(soon, { free: true, license: 'TODO: pick', download: null, style: 'Low poly' });
  soon.formats = [...soon.formats, 'FBX'];
  const b = buildWith({ packs: [free, paid, soon] });
  try {
    const f = b.read(`library/${free.slug}.html`);
    expect(f).toMatch(
      new RegExp(
        `<a[^>]+href="https://assets\\.rdwlabz\\.com/packs/${free.slug}/${free.slug}\\.zip"[^>]*data-pack-action="download"`,
      ),
    );
    expect(f).toContain('Download free');
    expect(f).toContain('CC0 1.0 (test fixture)');
    const p = b.read(`library/${paid.slug}.html`);
    expect(p).toContain('Buy — coming soon');
    expect(p).not.toContain('data-pack-action="download"');
    expect(p).not.toContain('.zip');
    const s = b.read(`library/${soon.slug}.html`);
    expect(s).toContain('Free download coming soon');
    expect(s).not.toContain('data-pack-action="download"');
    const lib = b.read('library.html');
    for (const g of ['category', 'style', 'format'])
      expect(lib).toContain(`aria-labelledby="facet-${g}"`);
    const homeText = b
      .read('index.html')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    expect(homeText).toMatch(/\b1 free pack\b/);
    expect(homeText).not.toContain('Downloads coming soon');
  } finally {
    b.done();
  }
});

/* ───────────── Browser tests against the real (production) build ───────────── */

test.describe('library pages', () => {
  test.skip(packs.length === 0, 'no packs synced yet');

  test('grid lists every pack with real renders and honest actions', async ({ page }) => {
    await page.goto('/library');
    const cards = page.locator('[data-lib-grid] > li');
    await expect(cards).toHaveCount(packs.length);
    for (const p of packs.slice(0, 3)) {
      const card = page.locator(`.pack-card:has(#pack-${p.slug}-title)`);
      await expect(card.locator(`img[src="${p.media.thumb.src}"]`)).toHaveAttribute('width', '800');
      await expect(card.getByRole('link', { name: p.name })).toHaveAttribute(
        'href',
        `/library/${p.slug}`,
      );
    }
    for (const a of await page.locator('main a[href$=".zip"]').all()) {
      expect(isAllowedDownload(await a.getAttribute('href'))).toBe(true);
    }
  });

  test('search, chips, URL state, no-match state and reset', async ({ page }) => {
    const groups = facets(packs);
    await page.goto('/library');
    const visible = page.locator('[data-lib-grid] > li:visible');
    const status = page.locator('[data-lib-status]');
    const word = packs[0].assets[0].name.split(' ').pop()!.toLowerCase();
    const expected = packs.filter((p) =>
      [
        p.name,
        p.description,
        p.category,
        p.style,
        ...p.tags,
        ...p.formats,
        ...p.assets.map((a) => a.name),
      ]
        .join(' ')
        .toLowerCase()
        .includes(word),
    ).length;
    await page.getByLabel('Search packs').fill(word);
    await expect(visible).toHaveCount(expected);
    await expect(page).toHaveURL(new RegExp(`\\?q=${word}`));
    if (expected < packs.length)
      await expect(status).toHaveText(`Showing ${expected} of ${packs.length} packs.`);

    await page.getByLabel('Search packs').fill('zzzz-nothing-matches');
    await expect(visible).toHaveCount(0);
    await expect(page.locator('[data-lib-none]')).toBeVisible();
    await expect(status).toContainText('No packs match');
    await page.getByRole('button', { name: 'Clear search and filters' }).click();
    await expect(visible).toHaveCount(packs.length);
    await expect(page.getByLabel('Search packs')).toBeFocused();
    await expect(page).toHaveURL(/\/library$/);

    const theme = groups.find((g) => g.id === 'category');
    if (theme) {
      const opt = theme.options[0];
      const chip = page.locator(`[data-facet="category"][data-facet-value="${opt.value}"]`);
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      await expect(visible).toHaveCount(opt.count);
      await expect(page).toHaveURL(
        new RegExp(`category=${encodeURIComponent(opt.value).replace(/%20/g, '\\+')}`),
      );
      await page.reload();
      await expect(
        page.locator(`[data-facet="category"][data-facet-value="${opt.value}"]`),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(visible).toHaveCount(opt.count);
      await page.locator('[data-facet="category"][data-facet-value=""]').click();
      await expect(visible).toHaveCount(packs.length);
    }
    await page.goto('/library?category=Not+a+theme');
    await expect(page.locator('[data-facet="category"][data-facet-value=""]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(visible).toHaveCount(packs.length);
  });

  test('hover spins the turntable; nothing downloads before', async ({ page }) => {
    const videos: string[] = [];
    page.on('request', (r) => /turntable\.(webm|mp4)$/.test(r.url()) && videos.push(r.url()));
    await page.goto('/library');
    await page.waitForTimeout(500);
    expect(videos).toEqual([]);
    const card = page.locator('.pack-card').first();
    await card.hover();
    const video = card.locator('video');
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute(
      'src',
      new RegExp(`/library/packs/${packs[0].slug}/turntable\\.(webm|mp4)$`),
    );
    await expect(card.locator('[data-turntable-media]')).toHaveClass(/is-spinning/);
    await page.mouse.move(0, 0);
    await expect(card.locator('[data-turntable-media]')).not.toHaveClass(/is-spinning/);
  });

  test('pack page: 3D viewer loads only on request, then shows the model', async ({ page }) => {
    const p = packs[0];
    const mv: string[] = [];
    page.on('request', (r) => /model-viewer|\.glb$/.test(r.url()) && mv.push(r.url()));
    await page.goto(`/library/${p.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.name);
    await page.waitForTimeout(500);
    expect(mv).toEqual([]);
    await page.getByRole('button', { name: 'Spin it in 3D' }).click();
    const root = page.locator('[data-model-preview]');
    await expect(root).toHaveAttribute('data-state', /ready|error/, { timeout: 30_000 });
    await expect(root).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('model-viewer')).toHaveAttribute('src', p.viewer[0].src);
    await expect(page.locator('[data-model-status]')).toContainText('loaded');
    if (p.viewer.length > 1) {
      await page.getByRole('button', { name: p.viewer[1].name, exact: true }).click();
      await expect(page.locator('model-viewer')).toHaveAttribute('src', p.viewer[1].src);
      await expect(root).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    }
    expect(mv.every((u) => new URL(u).host === new URL(page.url()).host)).toBe(true);
  });

  test('pack page: contents, stats and the coming-soon action', async ({ page }) => {
    const p = packs[0];
    await page.goto(`/library/${p.slug}`);
    for (const a of p.assets.slice(0, 5))
      await expect(page.locator('#contents')).toContainText(a.name);
    const stats = page.locator('.pack-stats');
    await expect(stats).toContainText(String(p.assets.length));
    await expect(stats).toContainText(p.formats.join(', '));
    const action = packAction(p);
    if (action.kind === 'buy-soon') {
      await expect(page.locator('[data-pack-action="buy-soon"]')).toHaveText(/Buy — coming soon/);
      await expect(page.locator('[data-pack-action="buy-soon"]')).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }
    if (p.aiGenerated) await expect(page.locator('.pack-info')).toContainText('AI-generated');
  });
});

/* ───────────── Portal transition ───────────── */

async function clickPortal(page: Page) {
  await page.goto('/');
  const link = page.locator('a[data-portal]');
  await link.scrollIntoViewIfNeeded();
  await link.click();
}

test.describe('portal transition', () => {
  test.skip(packs.length === 0, 'no packs synced yet');
  test.use({ reducedMotion: 'no-preference' });

  test('plays once, Esc skips straight into the library', async ({ page }) => {
    await clickPortal(page);
    const overlay = page.locator('[data-portal-overlay]');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('data-state', 'portal');
    await expect(page.locator('[data-portal-skip]')).toBeFocused();
    const t0 = Date.now();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/library$/);
    expect(Date.now() - t0).toBeLessThan(1500);
    await expect(page.getByRole('heading', { level: 1, name: 'Clay Asset Library' })).toBeVisible();

    // Second time in the same session: no portal, straight navigation.
    await page.goto('/');
    await page.locator('a[data-portal]').click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.locator('[data-portal-overlay][data-state="portal"]')).toHaveCount(0);
  });

  test('a click anywhere (or the Skip button) skips', async ({ page }) => {
    await clickPortal(page);
    await expect(page.locator('[data-portal-overlay]')).toBeVisible();
    await page.locator('[data-portal-skip]').click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test('never blocks: ends on its own within the hard cap', async ({ page }) => {
    await clickPortal(page);
    await expect(page.locator('[data-portal-overlay]')).toBeVisible();
    await expect(page).toHaveURL(/\/library$/, { timeout: 4000 });
  });

  test('a broken video navigates at once instead of hanging', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const o = document.querySelector<HTMLElement>('[data-portal-overlay]')!;
      o.dataset.webm = '/library/video/missing.webm';
      o.dataset.mp4 = '/library/video/missing.mp4';
    });
    const link = page.locator('a[data-portal]');
    await link.scrollIntoViewIfNeeded();
    const t0 = Date.now();
    await link.click();
    await expect(page).toHaveURL(/\/library$/);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  test('modifier clicks keep normal link behaviour', async ({ page }) => {
    await page.goto('/');
    const link = page.locator('a[data-portal]');
    await expect(link).toHaveAttribute('href', '/library');
    await link.scrollIntoViewIfNeeded();
    const [popup] = await Promise.all([
      page.context().waitForEvent('page'),
      link.click({ modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'] }),
    ]);
    await popup.close();
    await expect(page.locator('[data-portal-overlay]')).toBeHidden();
  });
});

test.describe('portal under reduced motion', () => {
  test.skip(packs.length === 0, 'no packs synced yet');
  test.use({ reducedMotion: 'reduce' });

  test('a short fade, no clip, no vortex', async ({ page }) => {
    const videos: string[] = [];
    page.on('request', (r) => /\/library\/video\//.test(r.url()) && videos.push(r.url()));
    await clickPortal(page);
    const overlay = page.locator('[data-portal-overlay]');
    await expect(overlay).toHaveAttribute('data-state', /fade|leaving/);
    await expect(overlay.locator('.portal__vortex')).toBeHidden();
    await expect(page).toHaveURL(/\/library$/, { timeout: 1500 });
    expect(videos).toEqual([]);
  });

  test('library cards do not spin and loops stay off', async ({ page }) => {
    await page.goto('/library');
    await page.locator('.pack-card').first().hover();
    await page.waitForTimeout(300);
    await expect(page.locator('.pack-card video')).toHaveCount(0);
    await expect(page.locator('[data-loop-media] video')).toHaveCount(0);
  });
});
