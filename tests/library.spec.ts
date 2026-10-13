import { test, expect, type Page } from '@playwright/test';
import { astroBuild } from './helpers';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import sharp from 'sharp';
import {
  glbGeometryProblem,
  parseCommitTitle,
  prettify,
  themeOf,
} from '../scripts/build-library.mjs';
import { facets, modelCount, packs, validateLibrary, type LibraryPack } from '../src/lib/library';

const realPacks: LibraryPack[] = JSON.parse(readFileSync('src/data/library.json', 'utf8')).packs;

/* ───────────── Sync (scripts/build-library.mjs) against a fixture clay-asset-packs repo ───────────── */

async function boxGlb(size = 1): Promise<Buffer> {
  const doc = new Document();
  const buf = doc.createBuffer();
  const s = size;
  const p = [
    -s,
    0,
    -s,
    s,
    0,
    -s,
    s,
    2 * s,
    -s,
    -s,
    2 * s,
    -s,
    -s,
    0,
    s,
    s,
    0,
    s,
    s,
    2 * s,
    s,
    -s,
    2 * s,
    s,
  ];
  const i = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 2, 3, 7, 2, 7, 6, 1, 2, 6, 1, 6, 5, 0, 4,
    7, 0, 7, 3,
  ];
  const prim = doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(p)).setBuffer(buf),
    )
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(i)).setBuffer(buf));
  doc
    .createScene()
    .addChild(doc.createNode('box').setMesh(doc.createMesh('box').addPrimitive(prim)));
  return Buffer.from(await new NodeIO().writeBinary(doc));
}

/** A box whose vertex positions read as ~3e38, like the misaligned upstream batch048 files. */
async function corruptGlb(): Promise<Buffer> {
  const glb = await boxGlb(1);
  const binAt = 20 + glb.readUInt32LE(12) + 8;
  glb.fill(0x7f, binAt, binAt + 8 * 12);
  return glb;
}

const jpg = (color: string) =>
  sharp({ create: { width: 64, height: 64, channels: 3, background: color } })
    .jpeg()
    .toBuffer();

function git(cwd: string, ...args: string[]) {
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-C', cwd, ...args], {
    stdio: 'pipe',
  });
}

function put(root: string, rel: string, body: Buffer | string) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), body);
}

function sync(src: string, out: string) {
  execFileSync(
    process.execPath,
    [
      'scripts/build-library.mjs',
      ...['--src', src, '--data', join(out, 'library.json'), '--out', join(out, 'packs')],
      ...['--summary', join(out, 'summary.md')],
    ],
    { stdio: 'pipe' },
  );
  return {
    data: JSON.parse(readFileSync(join(out, 'library.json'), 'utf8')) as { packs: LibraryPack[] },
    summary: readFileSync(join(out, 'summary.md'), 'utf8'),
  };
}

test.describe('library sync', () => {
  test('theme chips: crew packs get their own groups, everything else an era', () => {
    expect(themeOf('Brainrot Clay Crew II (2026 roster)')).toBe('Clay Crews');
    expect(themeOf('Clay Block-Build Trend Crew')).toBe('Trend Toys');
    expect(themeOf('Clay Dance Crew')).toBe('Trend Toys');
    expect(themeOf('Clay Brainrot Gods (hero/boss tier)')).toBe('Heroes & Gods');
    expect(themeOf('Clay Hero Crew: heroes, idols and tricksters')).toBe('Heroes & Gods');
    expect(themeOf('Medieval Knights')).toBe('Medieval');
    expect(themeOf('Greece and Rome II: heroes, myths and Roman life')).toBe('Ancient world');
    expect(themeOf('Something new')).toBe('Other');
  });

  test('names come from the commit message when there is no manifest', () => {
    expect(
      parseCommitTitle('batch048: Clay Hero Crew: heroes (4 models, 4 textures)', 'batch048'),
    ).toEqual({
      title: 'Clay Hero Crew: heroes',
      models: 4,
      textures: 4,
    });
    expect(parseCommitTitle('batch050: Robots (1 model)', 'batch050')?.title).toBe('Robots');
    expect(parseCommitTitle('batch049: Other pack (2 models)', 'batch050')).toBeNull();
    expect(parseCommitTitle('viewers: batch050 offline 3D viewer', 'batch050')).toBeNull();
    expect(prettify('batch050')).toBe('Batch 050');
    expect(prettify('wild_west_ii')).toBe('Wild West II');
  });

  test('corrupt GLBs are caught by their vertex data', async () => {
    expect(glbGeometryProblem(await boxGlb())).toBeNull();
    expect(glbGeometryProblem(await corruptGlb())).toMatch(/corrupt|past the end/);
  });

  test('every models/ folder becomes a pack; new folders appear, removed ones vanish', async () => {
    test.slow();
    const src = mkdtempSync(join(tmpdir(), 'clay-src-'));
    const out = mkdtempSync(join(tmpdir(), 'clay-out-'));
    try {
      git(src, 'init', '-q', '-b', 'main');
      // batch060: no manifest, named by its commit; one corrupt model; a 1-frame stub gif.
      put(src, 'models/batch060/char_clay_hero.glb', await boxGlb(1));
      put(src, 'models/batch060/char_clay_robot.glb', await boxGlb(0.8));
      put(src, 'models/batch060/char_clay_broken.glb', await corruptGlb());
      put(src, 'previews/batch060/char_clay_hero.jpg', await jpg('#c86'));
      put(src, 'previews/batch060/char_clay_broken.jpg', await jpg('#68c'));
      put(
        src,
        'previews/batch060/char_clay_hero.gif',
        await sharp({ create: { width: 8, height: 8, channels: 3, background: '#000' } })
          .gif()
          .toBuffer(),
      );
      git(src, 'add', '-A');
      git(src, 'commit', '-q', '-m', 'batch060: Clay Robot Crew (3 models, 0 textures)');
      // batch061: manifest title wins.
      put(src, 'models/batch061/mob_polar_bear.glb', await boxGlb(1.2));
      put(src, 'previews/batch061/mob_polar_bear.jpg', await jpg('#8ac'));
      put(
        src,
        'manifests/batch061.json',
        JSON.stringify({
          title: 'Arctic Test Pack',
          models: [{ id: 'mob_polar_bear', category: 'mob' }],
        }),
      );
      git(src, 'add', '-A');
      git(src, 'commit', '-q', '-m', 'batch061: add');

      let { data, summary } = sync(src, out);
      expect(data.packs.map((p) => p.slug)).toEqual(['clay-robot-crew', 'arctic-test-pack']);
      const crew = data.packs[0];
      expect(crew.name).toBe('Clay Robot Crew');
      expect(crew.category).toBe('Clay Crews');
      expect(crew.media.kind).toBe('concept');
      expect(crew.media.webm).toBeNull();
      expect(crew.assets.map((a) => a.id)).toEqual([
        'char_clay_broken',
        'char_clay_hero',
        'char_clay_robot',
      ]);
      expect(crew.assets.find((a) => a.id === 'char_clay_robot')!.thumb).toBeNull();
      expect(crew.assets.find((a) => a.id === 'char_clay_broken')!.triangles).toBeNull();
      expect(crew.viewer.map((v) => v.id).sort()).toEqual(['char_clay_hero', 'char_clay_robot']);
      expect(summary).toContain('char_clay_broken.glb: vertex positions are corrupt');
      const arctic = data.packs[1];
      expect(arctic.name).toBe('Arctic Test Pack');
      expect(arctic.category).toBe('Arctic');
      expect(arctic.assets[0].kind).toBe('creature');
      for (const p of data.packs) {
        expect(p).not.toHaveProperty('download');
        expect(p).not.toHaveProperty('price');
        expect(p).not.toHaveProperty('free');
      }
      expect(validateLibrary(data).length).toBe(2);
      for (const f of ['thumb.webp', 'assets/char_clay_hero.webp', 'char_clay_hero.glb']) {
        expect(existsSync(join(out, 'packs/clay-robot-crew', f)), f).toBe(true);
      }

      // A new batch pushed to main shows up on the next sync, with no other step.
      put(src, 'models/batch062/prop_clay_rocket.glb', await boxGlb(0.5));
      put(src, 'previews/batch062/prop_clay_rocket.jpg', await jpg('#c66'));
      git(src, 'add', '-A');
      git(src, 'commit', '-q', '-m', 'batch062: Clay Space Toys (1 model, 0 textures)');
      ({ data, summary } = sync(src, out));
      expect(data.packs.map((p) => p.slug)).toEqual([
        'clay-robot-crew',
        'arctic-test-pack',
        'clay-space-toys',
      ]);
      expect(summary).toMatch(/\*\*Added:\*\* Clay Space Toys/);
      expect(summary).not.toMatch(/Previews built:.*Clay Robot Crew/);

      // Removed upstream: gone from the data and its previews deleted.
      rmSync(join(src, 'models/batch061'), { recursive: true });
      ({ data, summary } = sync(src, out));
      expect(data.packs.map((p) => p.slug)).toEqual(['clay-robot-crew', 'clay-space-toys']);
      expect(summary).toMatch(/\*\*Removed:\*\* Arctic Test Pack/);
      expect(existsSync(join(out, 'packs/arctic-test-pack'))).toBe(false);
    } finally {
      rmSync(src, { recursive: true, force: true });
      rmSync(out, { recursive: true, force: true });
    }
  });
});

test.describe('library.json validation', () => {
  test.skip(realPacks.length === 0, 'no packs synced yet');
  const base = () => structuredClone(realPacks[0]);

  test('the synced library.json passes', () => {
    expect(validateLibrary({ packs: realPacks }).length).toBe(realPacks.length);
  });

  test('rejects packs that could ship a broken or unsafe page, or a download', () => {
    const cases: [(p: LibraryPack) => void, RegExp][] = [
      [(p) => (p.slug = 'Bad Slug'), /invalid slug/],
      [(p) => (p.media.thumb.src = 'https://evil.example/x.webp'), /media outside/],
      [(p) => (p.media.webm = `/library/packs/${p.slug}/../../x.webm`), /media outside/],
      [(p) => (p.assets[0].thumb = '/elsewhere/x.webp'), /thumb is outside/],
      [(p) => (p.media.mp4Bytes = 2_000_000), /over 1.5 MB/],
      [(p) => Object.assign(p.media, { kind: 'photo' }), /media kind/],
      [
        (p) => Object.assign(p, { download: { url: 'https://assets.rdwlabz.com/a.zip' } }),
        /download/,
      ],
      [(p) => Object.assign(p, { price: 3 }), /price/],
      [(p) => Object.assign(p, { free: true }), /free flag/],
    ];
    for (const [mutate, re] of cases) {
      const p = base();
      mutate(p);
      expect(() => validateLibrary({ packs: [p] })).toThrow(re);
    }
    expect(() => validateLibrary({ packs: [base(), base()] })).toThrow(/duplicate slug/);
  });

  test('filter groups appear only when they can narrow the list', () => {
    const [a, b] = [base(), base()];
    b.slug = 'other';
    b.category = a.category;
    b.style = a.style;
    b.formats = [...a.formats];
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

/* ───────────── Browser tests against the real (production) build ───────────── */

test.describe('library pages', () => {
  test.skip(packs.length === 0, 'no packs synced yet');

  test('grid lists every pack, with honest stats and no download or buy links', async ({
    page,
  }) => {
    await page.goto('/library');
    const cards = page.locator('[data-lib-grid] > li');
    await expect(cards).toHaveCount(packs.length);
    for (const p of [packs[0], packs.at(-1)!]) {
      const card = page.locator(`.pack-card:has(#pack-${p.slug}-title)`);
      await expect(card.locator(`img[src="${p.media.thumb.src}"]`)).toHaveAttribute('width', '800');
      await expect(card.getByRole('link', { name: p.name })).toHaveAttribute(
        'href',
        `/library/${p.slug}`,
      );
      await expect(card).toContainText('Preview only');
      await expect(card.locator('[data-turntable-media]')).toHaveCount(
        p.media.webm || p.media.mp4 ? 1 : 0,
      );
    }
    const stats = page.locator('main').first();
    await expect(stats).toContainText(`${packs.length} packs`);
    await expect(stats).toContainText(`${modelCount(packs)} models`);
    await expect(stats).toContainText('Downloads coming soon');
    await expect(
      page.locator('a[href$=".zip"], a[download], [data-pack-action="download"]'),
    ).toHaveCount(0);
    await expect(page.getByText(/\bbuy\b/i)).toHaveCount(0);
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
    const card = page.locator('.pack-card[data-turntable]').first();
    const spinner = packs.find((p) => p.media.webm || p.media.mp4)!;
    await card.hover();
    const video = card.locator('video');
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute(
      'src',
      new RegExp(`/library/packs/${spinner.slug}/turntable\\.(webm|mp4)$`),
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

  test('pack page: concept-image packs load their real models in 3D', async ({ page }) => {
    const p = packs.find((x) => x.media.kind === 'concept' && x.viewer.length > 0);
    test.skip(!p, 'no concept pack with models');
    await page.goto(`/library/${p!.slug}`);
    await expect(page.locator('.pv__note')).toContainText('concept image');
    await page.getByRole('button', { name: 'Spin it in 3D' }).click();
    const root = page.locator('[data-model-preview]');
    await expect(root).toHaveAttribute('data-state', /ready|error/, { timeout: 30_000 });
    await expect(root).toHaveAttribute('data-state', 'ready');
    await expect(page.locator('model-viewer')).toHaveAttribute('src', p!.viewer[0].src);
  });

  test('pack page: contents, stats, preview only, downloads coming soon', async ({ page }) => {
    for (const p of [packs[0], packs.at(-1)!]) {
      await page.goto(`/library/${p.slug}`);
      for (const a of p.assets.slice(0, 5))
        await expect(page.locator('#contents')).toContainText(a.name);
      const stats = page.locator('.pack-stats');
      await expect(stats).toContainText(String(p.assets.length));
      await expect(stats).toContainText(p.formats.join(', '));
      await expect(stats).toContainText('Preview only');
      const action = page.locator('[data-pack-action="soon"]');
      await expect(action).toHaveText(/Downloads coming soon/);
      await expect(action).toHaveAttribute('aria-disabled', 'true');
      await expect(page.locator('main a[href$=".zip"], main a[download]')).toHaveCount(0);
      if (p.aiGenerated) await expect(page.locator('.pack-info')).toContainText('AI-generated');
    }
  });

  test('a concept-image pack with no usable models says so instead of offering 3D', async ({
    page,
  }) => {
    const p = packs.find((x) => x.media.kind === 'concept' && x.viewer.length === 0);
    test.skip(!p, 'every concept pack has a 3D preview');
    await page.goto(`/library/${p!.slug}`);
    await expect(page.getByRole('button', { name: 'Spin it in 3D' })).toHaveCount(0);
    await expect(page.locator('.pv')).toContainText('3D preview for this pack isn’t ready yet');
    await expect(page.locator(`img[src="${p!.media.thumb.src}"]`).first()).toHaveAttribute(
      'alt',
      /Concept image/,
    );
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
