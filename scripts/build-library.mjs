#!/usr/bin/env node
// Builds the Clay Asset Library data and previews from a checkout of RDW-Labz/clay-asset-packs.
//
// Reads packs/<batch>/pack.json, keeps only valid packs with listed: true, and writes
// src/data/library.json plus public/library/packs/<slug>/:
//   thumb.webp            real render of the pack's hero models (800×600)
//   turntable.webm/.mp4   3 s seamless turntable of the same models (each ≤ 1.5 MB)
//   <asset>.glb           web previews of the hero models (meshopt, 512 px WebP textures)
//   assets/<asset>.webp   256 px render of every model in the pack
// Previews are re-rendered only when a pack's model files (or the studio look) change.
// Download links are added only for free packs with a real license and an uploaded zip.
//
// Usage: node scripts/build-library.mjs --src ../clay-asset-packs [--sha <commit>] [--force]
//        [--only <slug>] [--summary out.md] [--download-base https://assets.rdwlabz.com/]
// Needs ffmpeg (FFMPEG=path to override) and Playwright's Chromium.
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimizeGlb } from './library/optimize.mjs';
import { RENDER_VERSION, THUMB, createRenderer } from './library/render.mjs';
import { downloadFor, validatePackJson } from './library/validate.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = join(ROOT, 'src/data/library.json');
const OUT = join(ROOT, 'public/library/packs');
const DEFAULT_DOWNLOAD_BASE = 'https://assets.rdwlabz.com/';
/** Bump when optimizeGlb's output changes. */
const OPTIMIZE_VERSION = 1;

/** Card accents per theme (brand palette); anything else gets grape. */
export const THEME_ACCENT = {
  Prehistoric: '#ff8a5c',
  'Ancient world': '#ffc23d',
  Medieval: '#b04cf0',
  'Feudal Asia': '#16b67e',
  'Age of Sail': '#1aa3b8',
  'Wild West': '#ff4d2e',
  'Modern day': '#ff5fa2',
  Arctic: '#3d7bff',
};

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function readPacks(src) {
  const dir = join(src, 'packs');
  const out = [];
  const warnings = [];
  for (const batch of (await readdir(dir)).sort()) {
    const file = join(dir, batch, 'pack.json');
    if (!existsSync(file)) continue;
    let p;
    try {
      p = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      warnings.push(`${batch}: pack.json is not valid JSON; skipped`);
      continue;
    }
    const errs = validatePackJson(p);
    if (errs.length) {
      warnings.push(`${batch}: skipped (${errs.slice(0, 3).join('; ')})`);
      continue;
    }
    if (p.listed) out.push(p);
  }
  const seen = new Set();
  const packs = out.filter((p) => {
    if (seen.has(p.slug)) {
      warnings.push(`${p.id}: duplicate slug "${p.slug}"; skipped`);
      return false;
    }
    seen.add(p.slug);
    return true;
  });
  return { packs, warnings };
}

async function main() {
  const src = arg('--src');
  if (!src || !existsSync(join(src, 'packs'))) {
    throw new Error('--src must point at a clay-asset-packs checkout (with packs/ and models/)');
  }
  const only = arg('--only');
  const force = process.argv.includes('--force');
  const base = arg('--download-base') ?? process.env.LIBRARY_DOWNLOAD_BASE ?? DEFAULT_DOWNLOAD_BASE;
  const prev = existsSync(DATA) ? JSON.parse(await readFile(DATA, 'utf8')) : { packs: [] };
  const prevBySlug = new Map(prev.packs.map((p) => [p.slug, p]));
  const { packs, warnings } = await readPacks(src);
  const changes = { added: [], updated: [], removed: [], rendered: [] };
  let renderer = null;
  const result = [];

  for (const p of packs) {
    const old = prevBySlug.get(p.slug);
    if (only && p.slug !== only) {
      if (old) result.push(old);
      continue;
    }
    const accent = THEME_ACCENT[p.category] ?? '#b04cf0';
    const dir = join(OUT, p.slug);
    const web = `/library/packs/${p.slug}`;
    try {
      const sources = new Map();
      for (const a of p.assets) {
        const abs = join(src, a.file);
        if (!existsSync(abs)) throw new Error(`${a.file} is missing from the checkout`);
        sources.set(a.id, await readFile(abs));
      }
      const hash = sha256(
        JSON.stringify({
          r: RENDER_VERSION,
          o: OPTIMIZE_VERSION,
          accent,
          hero: p.hero,
          files: p.assets.map((a) => [a.id, sha256(sources.get(a.id))]),
        }),
      );
      const outputs = [
        'thumb.webp',
        'turntable.webm',
        'turntable.mp4',
        ...p.hero.map((h) => `${h}.glb`),
        ...p.assets.map((a) => `assets/${a.id}.webp`),
      ];
      const fresh =
        !force && old?.sourceHash === hash && outputs.every((f) => existsSync(join(dir, f)));
      let viewer = old?.viewer;
      if (!fresh) {
        renderer ??= await createRenderer();
        await rm(dir, { recursive: true, force: true });
        await mkdir(join(dir, 'assets'), { recursive: true });
        const studio = await Promise.all(
          p.hero.map((h) => optimizeGlb(sources.get(h), { texture: 1024 })),
        );
        await renderer.renderPack(studio, accent, {
          thumb: join(dir, 'thumb.webp'),
          webm: join(dir, 'turntable.webm'),
          mp4: join(dir, 'turntable.mp4'),
        });
        viewer = [];
        for (const h of p.hero) {
          const glb = await optimizeGlb(sources.get(h), { texture: 512 });
          await writeFile(join(dir, `${h}.glb`), glb);
          viewer.push({ id: h, src: `${web}/${h}.glb`, bytes: glb.length });
        }
        for (const a of p.assets) {
          const small = await optimizeGlb(sources.get(a.id), { texture: 512 });
          await writeFile(
            join(dir, 'assets', `${a.id}.webp`),
            await renderer.renderAsset(small, accent),
          );
        }
        changes.rendered.push(p.name);
      }
      const names = new Map(p.assets.map((a) => [a.id, a.name]));
      const entry = {
        slug: p.slug,
        id: p.id,
        name: p.name.trim(),
        description: p.description.trim(),
        category: p.category.trim(),
        style: p.style.trim(),
        tags: p.tags,
        formats: p.formats,
        triangles: p.triangles,
        totalBytes: p.totalBytes,
        fileCount: p.files.length,
        accent,
        assets: p.assets.map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          triangles: a.triangles,
          thumb: `${web}/assets/${a.id}.webp`,
        })),
        textures: p.textures.map((t) => ({ id: t.id, name: t.name, maps: t.maps })),
        viewer: viewer.map((v) => ({ ...v, name: names.get(v.id) })),
        media: {
          thumb: { src: `${web}/thumb.webp`, width: THUMB.width, height: THUMB.height },
          webm: `${web}/turntable.webm`,
          mp4: `${web}/turntable.mp4`,
          webmBytes: statSync(join(dir, 'turntable.webm')).size,
          mp4Bytes: statSync(join(dir, 'turntable.mp4')).size,
        },
        aiGenerated: p.aiGenerated,
        pipeline: typeof p.pipeline === 'string' ? p.pipeline : null,
        license: p.license,
        free: p.free,
        price: p.price,
        download: downloadFor(p, base),
        sourceHash: hash,
      };
      if (!old) changes.added.push(p.name);
      else if (JSON.stringify(old) !== JSON.stringify(entry)) changes.updated.push(p.name);
      result.push(entry);
    } catch (e) {
      warnings.push(`${p.name}: ${e.message}${old ? '; kept the previous version' : '; skipped'}`);
      if (old) result.push(old);
    }
  }
  await renderer?.close();

  const keep = new Set(result.map((p) => p.slug));
  for (const p of prev.packs) if (!keep.has(p.slug)) changes.removed.push(p.name);
  if (existsSync(OUT)) {
    for (const d of await readdir(OUT))
      if (!keep.has(d)) await rm(join(OUT, d), { recursive: true });
  }

  const data = {
    _note:
      'Generated by scripts/build-library.mjs from RDW-Labz/clay-asset-packs packs/*/pack.json. Edit pack.json there, not this file.',
    source: { repo: 'RDW-Labz/clay-asset-packs', sha: arg('--sha') ?? prev.source?.sha ?? null },
    packs: result,
  };
  await writeFile(DATA, JSON.stringify(data, null, 2) + '\n');

  const lines = ['## Clay Asset Library sync', ''];
  const list = (title, xs) => xs.length && lines.push(`**${title}:** ${xs.join(', ')}`, '');
  list('Added', changes.added);
  list('Updated', changes.updated);
  list('Removed', changes.removed);
  list('Previews rendered', changes.rendered);
  lines.push(
    `${result.length} listed packs, ${result.filter((p) => p.download).length} with downloads.`,
  );
  if (warnings.length) lines.push('', '**Warnings**', ...warnings.map((w) => `- ${w}`));
  const summary = lines.join('\n') + '\n';
  console.log(summary);
  const summaryPath = arg('--summary');
  if (summaryPath) await writeFile(summaryPath, summary);
}

main().catch((e) => {
  console.error(`build-library: ${e.message}`);
  process.exit(1);
});
