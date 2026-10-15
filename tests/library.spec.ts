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
  truncateSync,
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
import { checkPagesLimits } from '../scripts/pages-limits.mjs';
import { manifestCopy, plainText } from '../scripts/library/validate.mjs';
import {
  addChanges,
  describeQuality,
  diffQuality,
  imageSize,
  meshType,
} from '../scripts/library/quality.mjs';
import {
  facets,
  formatDate,
  lastUpdated,
  modelCount,
  packs,
  recentlyUpdated,
  searchText,
  validateLibrary,
  type LibraryPack,
} from '../src/lib/library';

const realPacks: LibraryPack[] = JSON.parse(readFileSync('src/data/library.json', 'utf8')).packs;

/* ───────────── Sync (scripts/build-library.mjs) against a fixture clay-asset-packs repo ───────────── */

/** A bumpy n×n grid: 2·n² triangles, dense enough to need decimating under a small size cap. */
async function gridGlb(n: number): Promise<Buffer> {
  const doc = new Document();
  const buf = doc.createBuffer();
  const p = new Float32Array((n + 1) * (n + 1) * 3);
  for (let y = 0; y <= n; y++)
    for (let x = 0; x <= n; x++) {
      const i = (y * (n + 1) + x) * 3;
      p.set([x / n, Math.sin(x / 3) * Math.cos(y / 4) * 0.05, y / n], i);
    }
  const idx = new Uint32Array(n * n * 6);
  for (let y = 0, k = 0; y < n; y++)
    for (let x = 0; x < n; x++, k += 6) {
      const a = y * (n + 1) + x;
      idx.set([a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2], k);
    }
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(p).setBuffer(buf))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buf));
  doc
    .createScene()
    .addChild(doc.createNode('grid').setMesh(doc.createMesh('grid').addPrimitive(prim)));
  return Buffer.from(await new NodeIO().writeBinary(doc));
}

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

const jpg = (color: string, size = 64) =>
  sharp({ create: { width: size, height: size, channels: 3, background: color } })
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

function sync(src: string, out: string, env: Record<string, string> = {}) {
  execFileSync(
    process.execPath,
    [
      'scripts/build-library.mjs',
      ...['--src', src, '--data', join(out, 'library.json'), '--out', join(out, 'packs')],
      ...['--summary', join(out, 'summary.md')],
    ],
    // Blocks the worker (Playwright can't time it out), so it gets its own hard limit.
    { stdio: 'pipe', env: { ...process.env, ...env }, timeout: 150_000, killSignal: 'SIGKILL' },
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

  test('manifest copy: plain text only, within limits, bad fields dropped with a warning', () => {
    expect(plainText('<p>Sharper <em>clay</em></p>')).toBe('Sharper clay');
    expect(plainText('a<!-- x --><style>p{}</style>b')).toBe('a b');
    expect(
      plainText('&lt;script&gt;alert(1)&lt;/script&gt; ok &#39;hi&#39; &#x2014; &nbsp;x'),
    ).toBe("scriptalert(1)/script ok 'hi' — x");
    expect(plainText('unclosed <img src=x onerror=alert(1)')).toBe('unclosed');
    expect(plainText('  \n\t ')).toBeNull();
    expect(plainText(42)).toBeNull();
    expect(plainText('one two three four', 12)).toBe('one two…');

    expect(manifestCopy(null)).toEqual({
      tagline: null,
      description: null,
      highlights: [],
      updated: null,
      warnings: [],
    });
    const long = manifestCopy({
      tagline: 'word '.repeat(40),
      highlights: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'a', '<br>'],
      updated: '2026-02-30',
      description: ['not', 'text'],
    });
    expect(long.tagline!.length).toBeLessThanOrEqual(120);
    expect(long.tagline).toMatch(/word…$/);
    expect(long.highlights).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(long.updated).toBeNull();
    expect(long.description).toBeNull();
    expect(long.warnings.join('\n')).toMatch(/"tagline" is over 120[\s\S]*"description" is empty/);
    expect(long.warnings.join('\n')).toMatch(/more than 6[\s\S]*"updated" is not a YYYY-MM-DD/);
    expect(manifestCopy({ highlights: 'Sharper' }).warnings).toEqual([
      '"highlights" is not a list; ignored',
    ]);
  });

  test('"Updated" badge window: the last 30 days of the build date', () => {
    const now = new Date('2026-10-14T18:00:00Z');
    expect(recentlyUpdated('2026-10-14', now)).toBe(true);
    expect(recentlyUpdated('2026-10-15', now)).toBe(true);
    expect(recentlyUpdated('2026-09-14', now)).toBe(true);
    expect(recentlyUpdated('2026-09-13', now)).toBe(false);
    expect(recentlyUpdated('2026-10-20', now)).toBe(false);
    expect(recentlyUpdated(null, now)).toBe(false);
    expect(recentlyUpdated('Oct 1', now)).toBe(false);
    expect(formatDate('2026-10-01')).toBe('Oct 1, 2026');
    const changes = [{ date: '2026-10-10', items: ['Textures upgraded to 2048 px'] }];
    expect(lastUpdated({ changes, updated: null })).toBe('2026-10-10');
    expect(lastUpdated({ changes, updated: '2026-10-12' })).toBe('2026-10-12');
    expect(lastUpdated({ changes: [], updated: null })).toBeNull();
  });

  test('image sizes come from PNG, JPEG and GIF headers', async () => {
    const img = (w: number, h: number) =>
      sharp({ create: { width: w, height: h, channels: 3, background: '#c86' } });
    expect(imageSize(await img(2048, 1024).png().toBuffer())).toEqual({
      width: 2048,
      height: 1024,
    });
    expect(imageSize(await img(640, 480).gif().toBuffer())).toEqual({ width: 640, height: 480 });
    const exif = await img(1920, 1080)
      .withMetadata({ exif: { IFD0: { ImageDescription: 'x'.repeat(5000) } } })
      .jpeg()
      .toBuffer();
    expect(imageSize(exif)).toEqual({ width: 1920, height: 1080 });
    expect(imageSize(Buffer.from('not an image'))).toBeNull();
    expect(meshType([true, true])).toEqual({ type: 'watertight', watertight: 2 });
    expect(meshType([true, false])).toEqual({ type: 'mixed', watertight: 1 });
    expect(meshType([false])).toEqual({ type: 'open', watertight: 0 });
    expect(meshType([true, null])).toEqual({ type: null, watertight: 1 });
  });

  /** Measured quality of a typical textured pack. */
  const quality = () => ({
    models: { total: 24, character: 6, creature: 12, prop: 6 },
    triangles: { min: 818, avg: 6400, max: 10_000 },
    mesh: { type: 'watertight' as string | null, watertight: 24 },
    textures: { sets: 8, maps: ['albedo', 'normal', 'roughness'], px: { min: 1024, max: 1024 } },
    previews: { count: 24, px: { min: 1024, max: 1024 } },
    turntables: { count: 24, px: { min: 512, max: 512 } },
    bytes: 51_000_000,
    files: 48,
  });

  test('quality diff: no change means no entry; the first measurement is a baseline', () => {
    expect(diffQuality(quality(), quality())).toEqual([]);
    expect(diffQuality(undefined, quality())).toEqual([]);
    expect(addChanges([], [], '2026-10-14')).toEqual([]);
    const tiny = quality();
    tiny.triangles.avg = 6450;
    tiny.bytes = 51_200_000;
    expect(diffQuality(quality(), tiny)).toEqual([]);
  });

  test('quality diff: texture 1024 → 2048 px and other upgrades become factual phrases', () => {
    const next = quality();
    next.textures.px = { min: 2048, max: 2048 };
    expect(diffQuality(quality(), next)).toEqual(['Textures upgraded to 2048 px']);
    Object.assign(next, {
      triangles: { min: 900, avg: 9800, max: 14_000 },
      turntables: { count: 24, px: { min: 1080, max: 1080 } },
      bytes: 103_000_000,
    });
    expect(diffQuality(quality(), next)).toEqual([
      'Higher-detail models (avg 9,800 triangles, was 6,400)',
      'Textures upgraded to 2048 px',
      'Turntables now 1080 px',
      'Pack size 103 MB (was 51 MB)',
    ]);
    const worse = quality();
    worse.textures.px = { min: 512, max: 1024 };
    expect(diffQuality(quality(), worse)).toEqual(['Textures now 512 px (was 1024 px)']);
  });

  test('quality diff: watertight → open drops "rig-ready" from the description', () => {
    const was = quality();
    expect(describeQuality(was)).toContain('watertight and rig-ready');
    const open = quality();
    open.mesh = { type: 'open', watertight: 0 };
    expect(diffQuality(was, open)).toEqual(['Meshes are now open, no longer rig-ready']);
    expect(describeQuality(open)).not.toMatch(/rig-ready|watertight/);
    const mixed = quality();
    mixed.mesh = { type: 'mixed', watertight: 20 };
    expect(describeQuality(mixed)).toContain('20 of 24 meshes are watertight.');
    expect(describeQuality(mixed)).not.toContain('rig-ready');
    expect(diffQuality(open, was)).toEqual(['Every mesh is now watertight and rig-ready']);
    const unknown = quality();
    unknown.mesh = { type: null, watertight: 0 };
    expect(describeQuality(unknown)).not.toMatch(/rig-ready|watertight/);
  });

  test('generated description says only what was measured', () => {
    expect(describeQuality(quality())).toBe(
      '24 models (6 characters, 12 creatures and 6 props), about 6,400 triangles each on average (818 to 10,000). ' +
        'Every mesh is watertight and rig-ready. ' +
        '8 texture sets at 1024 px (albedo, normal and roughness maps). ' +
        '1024 px preview images and 512 px turntables. 51 MB in 48 files.',
    );
    const bare = Object.assign(quality(), {
      triangles: null,
      mesh: { type: null, watertight: 0 },
      textures: null,
      previews: null,
      turntables: null,
      models: { total: 1, character: 0, creature: 0, prop: 1 },
      files: 1,
      bytes: 400_000,
    });
    expect(describeQuality(bare)).toBe('1 model (1 prop). 400 KB in 1 file.');
  });

  test('change entries: newest first, merged within a day, last 3 kept', () => {
    let c = addChanges([], ['A'], '2026-10-01');
    c = addChanges(c, ['B'], '2026-10-01');
    expect(c).toEqual([{ date: '2026-10-01', items: ['A', 'B'] }]);
    for (const d of ['2026-10-02', '2026-10-03', '2026-10-04']) c = addChanges(c, [d], d);
    expect(c.map((e) => e.date)).toEqual(['2026-10-04', '2026-10-03', '2026-10-02']);
    expect(addChanges(c, [], '2026-10-05')).toBe(c);
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
      // batch061: manifest title and copy win.
      put(src, 'models/batch061/mob_polar_bear.glb', await boxGlb(1.2));
      put(src, 'previews/batch061/mob_polar_bear.jpg', await jpg('#8ac'));
      put(
        src,
        'manifests/batch061.json',
        JSON.stringify({
          title: 'Arctic Test Pack',
          tagline: '<b>Polar</b> bears, <script>alert(1)</script>remade',
          description: 'Re-sculpted with <a href="https://x.example">sharper</a> fur &amp; claws.',
          highlights: ['Higher-res turntables', '<img src=x onerror=alert(1)>', 'Sharper textures'],
          updated: '2026-10-01',
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
      // No manifest copy: description generated from measured quality only; first sync = baseline.
      expect(crew.quality).toMatchObject({
        models: { total: 3, character: 3 },
        triangles: { min: 12, avg: 12, max: 12 },
        mesh: { type: null },
        textures: null,
        previews: { count: 2, px: { min: 64, max: 64 } },
        turntables: { count: 1, px: { min: 8, max: 8 } },
        files: 3,
      });
      expect(crew.description).toMatch(
        /^3 models \(3 characters\), 12 triangles each\. 64 px preview images and 8 px turntables\. \d+ KB in 3 files\.$/,
      );
      expect(crew).toMatchObject({ tagline: null, highlights: [], updated: null, changes: [] });
      const arctic = data.packs[1];
      expect(arctic.name).toBe('Arctic Test Pack');
      expect(arctic.category).toBe('Arctic');
      expect(arctic.assets[0].kind).toBe('creature');
      // In the manifest, but without a "mesh" field: unknown, not open.
      expect(arctic.quality!.mesh).toEqual({ type: null, watertight: 0 });
      expect(arctic).toMatchObject({
        tagline: 'Polar bears, remade',
        description: 'Re-sculpted with sharper fur & claws.',
        highlights: ['Higher-res turntables', 'Sharper textures'],
        updated: '2026-10-01',
      });
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
      expect(data.packs.every((p) => p.changes.length === 0)).toBe(true);
      expect(summary).not.toContain("What's new");

      // Sharper preview images upstream: measured, dated, listed in the PR and on the page.
      put(src, 'previews/batch061/mob_polar_bear.jpg', await jpg('#8ac', 128));
      ({ data, summary } = sync(src, out, { LIBRARY_TODAY: '2026-10-14' }));
      const upgraded = data.packs.find((p) => p.slug === 'arctic-test-pack')!;
      expect(upgraded.changes).toEqual([
        { date: '2026-10-14', items: ['Preview images now 128 px'] },
      ]);
      expect(upgraded.description).toBe('Re-sculpted with sharper fur & claws.');
      expect(summary).toContain("What's new");
      expect(summary).toContain('Arctic Test Pack: Preview images now 128 px');
      expect(data.packs.find((p) => p.slug === 'clay-robot-crew')!.changes).toEqual([]);

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

  test('oversized preview GLBs are decimated, or left out of 3D, and flagged', async () => {
    test.slow();
    const src = mkdtempSync(join(tmpdir(), 'clay-src-'));
    const outs: string[] = [];
    const fresh = () => {
      const d = mkdtempSync(join(tmpdir(), 'clay-out-'));
      outs.push(d);
      return d;
    };
    try {
      git(src, 'init', '-q', '-b', 'main');
      put(src, 'models/batch070/prop_clay_terrain.glb', await gridGlb(160));
      put(src, 'previews/batch070/prop_clay_terrain.jpg', await jpg('#7a5'));
      git(src, 'add', '-A');
      git(src, 'commit', '-q', '-m', 'batch070: Clay Terrain (1 model, 0 textures)');

      const full = sync(src, fresh()).data.packs[0].viewer[0];
      const cap = Math.floor(full.bytes / 3);
      const small = sync(src, fresh(), { LIBRARY_VIEWER_MAX_BYTES: String(cap) });
      const v = small.data.packs[0].viewer[0];
      expect(v.bytes).toBeLessThanOrEqual(cap);
      expect(small.summary).toMatch(/Decimated for the web[\s\S]*Clay Terrain: Clay terrain \(/);

      const none = sync(src, fresh(), { LIBRARY_VIEWER_MAX_BYTES: '100' });
      expect(none.data.packs[0].viewer).toEqual([]);
      expect(none.data.packs[0].assets).toHaveLength(1);
      expect(none.summary).toMatch(
        /Skipped or broken files[\s\S]*Clay terrain is .* not offered in 3D/,
      );
    } finally {
      rmSync(src, { recursive: true, force: true });
      for (const d of outs) rmSync(d, { recursive: true, force: true });
    }
  });

  test('Cloudflare Pages limits: 25 MiB per file, 20,000 files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pages-'));
    try {
      writeFileSync(join(dir, 'ok.glb'), 'x');
      expect(checkPagesLimits(dir).problems).toEqual([]);
      writeFileSync(join(dir, 'huge.glb'), '');
      truncateSync(join(dir, 'huge.glb'), 25 * 1024 * 1024 + 1);
      expect(checkPagesLimits(dir).problems.join()).toMatch(/huge\.glb is 25\.0 MiB/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    const dist = checkPagesLimits('dist');
    expect(dist.problems).toEqual([]);
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
      [(p) => Object.assign(p, { updated: '14/10/2026' }), /not YYYY-MM-DD/],
      [(p) => Object.assign(p, { highlights: 'Sharper' }), /non-list highlights/],
      [(p) => Object.assign(p, { description: '<br>' }), /no description/],
      [(p) => Object.assign(p, { changes: { date: '2026-10-14' } }), /non-list changes/],
      [(p) => Object.assign(p, { changes: [{ date: 'today', items: ['x'] }] }), /YYYY-MM-DD/],
    ];
    for (const [mutate, re] of cases) {
      const p = base();
      mutate(p);
      expect(() => validateLibrary({ packs: [p] })).toThrow(re);
    }
    expect(() => validateLibrary({ packs: [base(), base()] })).toThrow(/duplicate slug/);
  });

  test('copy fields are optional and come out as plain text', () => {
    const old = base() as unknown as Record<string, unknown>;
    for (const k of ['tagline', 'highlights', 'updated', 'quality', 'changes']) delete old[k];
    expect(validateLibrary({ packs: [old] })[0]).toMatchObject({
      tagline: null,
      highlights: [],
      updated: null,
      quality: null,
      changes: [],
    });
    const p = Object.assign(base(), {
      tagline: '<i>Fresh</i> clay',
      highlights: ['<b>Sharper</b> textures', ''],
    });
    expect(validateLibrary({ packs: [p] })[0]).toMatchObject({
      tagline: 'Fresh clay',
      highlights: ['Sharper textures'],
    });
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

test('pack page and card: copy, "What\'s new", and "Updated" only within 30 days', () => {
  test.skip(realPacks.length < 2, 'needs two synced packs');
  test.slow();
  const day = (offset: number) =>
    new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const [fresh, stale] = [structuredClone(realPacks[0]), structuredClone(realPacks[1])];
  Object.assign(fresh, {
    tagline: 'Remade with <b>sharper</b> clay',
    description: 'Every model re-sculpted <script>alert(1)</script>with finer detail.',
    highlights: ['Higher-res turntables', 'Sharper textures'],
    updated: null,
    changes: [
      { date: day(2), items: ['Textures upgraded to 2048 px', 'Turntables now 1080 px'] },
      { date: day(40), items: ['Pack size 103 MB (was 51 MB)'] },
    ],
  });
  Object.assign(stale, {
    tagline: null,
    highlights: [],
    updated: null,
    changes: [{ date: day(60), items: ['<b>Higher-detail</b> models'] }],
  });
  const b = buildWith({ packs: [fresh, stale] });
  try {
    const infoOf = (slug: string) => {
      const page = b.read(`library/${slug}.html`);
      return page.slice(page.indexOf('class="pack-info'), page.indexOf('class="pack-stats'));
    };
    const info = infoOf(fresh.slug);
    expect(info).toContain('Remade with sharper clay');
    expect(info).toContain('Every model re-sculpted with finer detail.');
    expect(info).not.toMatch(/<script>alert|&lt;script|&lt;b&gt;/);
    expect(info).toMatch(
      /aria-label="Highlights"[\s\S]*Higher-res turntables[\s\S]*Sharper textures/,
    );
    expect(info).toMatch(
      new RegExp(`Updated <time datetime="${day(2)}"[^>]*>${formatDate(day(2))}</time>`),
    );
    expect(info.indexOf('Remade with')).toBeLessThan(info.indexOf('Every model'));
    expect(info).toMatch(
      new RegExp(
        `What’s new[\\s\\S]*${formatDate(day(2))}[\\s\\S]*Textures upgraded to 2048 px[\\s\\S]*` +
          `Turntables now 1080 px[\\s\\S]*${formatDate(day(40))}[\\s\\S]*Pack size 103 MB`,
      ),
    );

    const other = infoOf(stale.slug);
    expect(other).toMatch(/What’s new[\s\S]*<li[^>]*>Higher-detail models<\/li>/);
    expect(other).not.toContain('chip--updated');
    expect(other).not.toContain('aria-label="Highlights"');
    expect(other).not.toContain('pack-info__tagline');
    expect(other).toContain(stale.description);

    const lib = b.read('library.html');
    const card = (slug: string) => {
      const at = lib.indexOf(`aria-labelledby="pack-${slug}-title"`);
      return lib.slice(at, lib.indexOf('</article>', at));
    };
    expect(card(fresh.slug)).toContain('<p class="pack-card__tagline"');
    expect(card(fresh.slug)).toContain('Remade with sharper clay');
    expect(card(fresh.slug)).toContain('chip--updated');
    expect(card(stale.slug)).not.toContain('pack-card__tagline');
    expect(card(stale.slug)).not.toContain('chip--updated');
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
    const expected = packs.filter((p) => searchText(p).includes(word)).length;
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
