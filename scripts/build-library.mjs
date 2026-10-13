#!/usr/bin/env node
// Builds the Clay Asset Library data and previews from a checkout of RDW-Labz/clay-asset-packs.
// Every folder under models/ with .glb files is a pack; nothing upstream has to be hand-written.
//
// Per pack (models/<id>/):
//   name, counts   manifests/<id>.json when present, else the latest commit message touching the
//                  folder ("batchNNN: Name (N models, N textures)"), else the folder name
//   card media     "render": packs with texture sets or an offline viewer get a real render of
//                  their hero models (800×600 WebP + 3 s turntable, scripts/library/render.mjs)
//                  "concept": other packs use previews/<id>/*.jpg (the images the models were made
//                  from) and previews/<id>/*.gif turntables when the gif is a real animation
//   3D viewer      web-optimized GLBs of up to 3 hero models from models/<id>/
// Previews are rebuilt only when a pack's source files (or the studio look) change.
// Downloads are off for every pack: nothing here emits a download, price or buy link.
//
// Usage: node scripts/build-library.mjs --src ../clay-asset-packs [--sha <commit>] [--force]
//        [--only <slug>] [--summary out.md] [--data path.json] [--out dir]
// Needs ffmpeg (FFMPEG=path to override); "render" packs also need Playwright's Chromium.
import { execFile, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { optimizeGlb } from './library/optimize.mjs';
import { RENDER_VERSION, THUMB, VIDEO_MAX_BYTES, createRenderer } from './library/render.mjs';
import { ASSET_ID, SLUG } from './library/validate.mjs';

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** Bump when optimizeGlb's output changes. */
const OPTIMIZE_VERSION = 1;
/** Bump when concept-card media (thumb/turntable/asset images) change. */
const CONCEPT_VERSION = 1;
const PIPELINE =
  'Qwen-Image 2.1 (clay LoRA) image, Hunyuan3D 2.1 shape, Hunyuan Paint texture, cleaned mesh';
const LICENSE = 'TODO: license for buyers (also check the Hunyuan3D 2.1 Community License terms)';

/** Era themes, first match wins. */
const ERA_THEMES = [
  [/arctic|polar/i, 'Arctic'],
  [/dinosaur|prehistoric|stone age|ice age|neolithic/i, 'Prehistoric'],
  [/egypt|bronze age|greece|rome|mesopotamia|persia/i, 'Ancient world'],
  [/viking|medieval|dark ages|norse|knight/i, 'Medieval'],
  [/japan|samurai|feudal|china|mongol/i, 'Feudal Asia'],
  [/pirate|age of sail|renaissance/i, 'Age of Sail'],
  [/wild west|industrial|frontier|steam/i, 'Wild West'],
  [/modern|city life/i, 'Modern day'],
];

/** Theme chip for a pack title: crew packs get their own groups, everything else an era. */
export function themeOf(title) {
  if (/\bcrew\b|\bgods?\b/i.test(title)) {
    if (/\bgods?\b|\bhero\b|\bidols?\b/i.test(title)) return 'Heroes & Gods';
    if (/trend|toys?\b|gaming|youtuber|dance|block-build/i.test(title)) return 'Trend Toys';
    return 'Clay Crews';
  }
  return ERA_THEMES.find(([re]) => re.test(title))?.[1] ?? 'Other';
}

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
  'Clay Crews': '#16b67e',
  'Trend Toys': '#ff5fa2',
  'Heroes & Gods': '#ffc23d',
};

const KIND = { char: 'character', mob: 'creature', prop: 'prop' };

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export function slugify(s) {
  const words = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  let out = '';
  for (const w of words) {
    if ((out + '-' + w).length > 48 && out) break;
    out = out ? `${out}-${w}` : w;
  }
  return out;
}

export const humanize = (id) => {
  const s = id.replace(/^(char|mob|prop|clay|tex)_/, '').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "batch048" -> "Batch 048", "wild_west_ii" -> "Wild West II". */
export function prettify(folder) {
  return folder
    .replace(/^([a-z]+)(\d+)$/i, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) =>
      /^(i{1,3}|iv|vi{0,3}|ix|x)$/i.test(w)
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ');
}

/** "batch048: Clay Hero Crew (4 models, 4 textures)" -> { title, models, textures } */
export function parseCommitTitle(subject, id) {
  const m = subject.match(
    /^([\w-]+):\s*(.+?)\s*\((\d+)\s+models?(?:,\s*(\d+)\s+textures?)?\)\s*$/i,
  );
  if (!m || m[1].toLowerCase() !== id.toLowerCase()) return null;
  return { title: m[2], models: Number(m[3]), textures: m[4] ? Number(m[4]) : 0 };
}

function commitTitle(src, id) {
  try {
    const log = execFileSync(
      'git',
      ['-C', src, 'log', '--format=%s', '-n', '50', '--', `models/${id}`, `manifests/${id}.json`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    for (const line of log.split('\n')) {
      const t = parseCommitTitle(line.trim(), id);
      if (t) return t;
    }
  } catch {
    // Not a git checkout (or no history): fall back to the folder name.
  }
  return null;
}

/** Triangles in a .glb (TRIANGLES primitives of meshes used by nodes), from its JSON chunk. */
export function glbTriangles(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const len = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
  const uses = new Map();
  for (const n of json.nodes ?? []) {
    if (n.mesh !== undefined) uses.set(n.mesh, (uses.get(n.mesh) ?? 0) + 1);
  }
  let tris = 0;
  for (const [mi, count] of uses) {
    for (const p of json.meshes[mi].primitives) {
      if ((p.mode ?? 4) !== 4) continue;
      const acc = json.accessors[p.indices ?? p.attributes.POSITION];
      tris += (acc.count / 3) * count;
    }
  }
  return Math.round(tris);
}

/**
 * Null when the first mesh's vertex positions look like a real model, else the problem.
 * Catches files whose binary chunk is misaligned (positions read as ±1e38 garbage).
 */
export function glbGeometryProblem(buf) {
  const jl = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jl).toString('utf8'));
  const binStart = 20 + jl + 8;
  const prim = json.meshes?.[0]?.primitives?.[0];
  const acc = json.accessors?.[prim?.attributes?.POSITION];
  if (!acc || acc.componentType !== 5126) return null;
  const view = json.bufferViews?.[acc.bufferView];
  if (!view) return 'POSITION has no buffer view';
  const start = binStart + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = view.byteStride ?? 12;
  const n = Math.min(acc.count, 2000);
  if (start + (n - 1) * stride + 12 > buf.length)
    return 'vertex data runs past the end of the file';
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const v = buf.readFloatLE(start + i * stride + c * 4);
      if (!Number.isFinite(v) || Math.abs(v) > 1e5) return 'vertex positions are corrupt';
    }
  }
  return null;
}

export function describe(assets, textures) {
  const by = (k) => assets.filter((a) => a.kind === k).length;
  const parts = [
    by('character') && plural(by('character'), 'character'),
    by('creature') && plural(by('creature'), 'creature'),
    by('prop') && plural(by('prop'), 'prop'),
  ].filter(Boolean);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  let s = `${plural(assets.length, 'claymation-style 3D model')} (${list})`;
  if (textures.length) {
    s += `, plus ${plural(textures.length, 'tileable 1024 px texture')} (albedo, normal and roughness maps)`;
  }
  return `${s}.`;
}

async function listFiles(dir) {
  try {
    return (await readdir(dir, { withFileTypes: true }))
      .filter((d) => d.isFile())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Every folder directly under models/ that holds .glb files, read into a pack description. */
export async function readPacks(src) {
  const modelsDir = join(src, 'models');
  const dirs = (await readdir(modelsDir, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();
  let viewers = new Set();
  try {
    const out = execFileSync('git', ['-C', src, 'ls-tree', '--name-only', 'HEAD', 'viewers/'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    viewers = new Set(out.split('\n').filter(Boolean));
  } catch {
    // No git: only checked-out viewers count.
  }
  const warnings = [];
  const packs = [];
  for (const id of dirs) {
    const glbs = (await listFiles(join(modelsDir, id))).filter((f) => f.endsWith('.glb')).sort();
    if (!glbs.length) continue;
    let manifest = null;
    const mPath = join(src, 'manifests', `${id}.json`);
    if (existsSync(mPath)) {
      try {
        manifest = JSON.parse(await readFile(mPath, 'utf8'));
      } catch {
        warnings.push(`manifests/${id}.json is not valid JSON; used the folder instead`);
      }
    }
    const commit = manifest?.title ? null : commitTitle(src, id);
    const title = (manifest?.title ?? commit?.title ?? prettify(id)).trim();
    const meta = new Map((manifest?.models ?? []).map((m) => [m.id, m]));
    const assets = [];
    for (const f of glbs) {
      const assetId = f.replace(/\.glb$/, '');
      if (!ASSET_ID.test(assetId)) {
        warnings.push(`models/${id}/${f}: file name is not snake_case; skipped`);
        continue;
      }
      const file = join(modelsDir, id, f);
      const buf = await readFile(file);
      let triangles = null;
      let broken = null;
      try {
        triangles = glbTriangles(buf);
        broken = glbGeometryProblem(buf);
      } catch (e) {
        broken = `unreadable (${e.message})`;
      }
      if (broken) {
        // Still listed (concept image + name) but never offered in the 3D viewer.
        warnings.push(`models/${id}/${f}: ${broken}; no 3D preview or triangle count`);
        triangles = null;
      }
      const preview = join(src, 'previews', id, `${assetId}.jpg`);
      const gif = join(src, 'previews', id, `${assetId}.gif`);
      assets.push({
        id: assetId,
        name: humanize(assetId),
        kind: KIND[meta.get(assetId)?.category ?? assetId.split('_')[0]] ?? 'prop',
        file,
        bytes: buf.length,
        hash: sha256(buf),
        triangles: triangles || null,
        broken,
        watertight: meta.has(assetId) ? /^closed/.test(meta.get(assetId).mesh ?? '') : null,
        preview: existsSync(preview) ? preview : null,
        gif: existsSync(gif) ? gif : null,
      });
    }
    if (!assets.length) {
      warnings.push(`models/${id}: no readable models; skipped`);
      continue;
    }
    const texRoot = join(src, 'textures', id);
    const textures = [];
    const texFiles = [];
    if (existsSync(texRoot)) {
      for (const set of (await readdir(texRoot, { withFileTypes: true })).filter((d) =>
        d.isDirectory(),
      )) {
        const pngs = (await listFiles(join(texRoot, set.name)))
          .filter((f) => f.endsWith('.png'))
          .sort();
        if (!pngs.length) continue;
        textures.push({
          id: set.name,
          name: humanize(set.name),
          maps: pngs.map((f) => f.replace(/_\d+\.png$/, '').replace(/\.png$/, '')),
        });
        for (const f of pngs) texFiles.push(statSync(join(texRoot, set.name, f)).size);
      }
    }
    const category = themeOf(title);
    const usable = assets.filter((a) => !a.broken);
    const pick = (kind, pref) =>
      usable.find((a) => a.kind === kind && pref.test(a.id))?.id ??
      usable.find((a) => a.kind === kind)?.id;
    let hero = [pick('character', /hero/), pick('creature', /./), pick('prop', /./)].filter(
      Boolean,
    );
    if (hero.length < Math.min(3, usable.length)) {
      for (const a of usable) if (hero.length < 3 && !hero.includes(a.id)) hero.push(a.id);
    }
    const counted = assets.map((a) => a.triangles).filter(Number.isInteger);
    const hasViewer = viewers.has(`viewers/${id}.html`);
    packs.push({
      id,
      slug: slugify(title.split(/[:(]/)[0]) || slugify(id),
      name: title,
      description: describe(assets, textures),
      category,
      style: 'Claymation',
      tags: [
        ...new Set(
          [
            assets.some((a) => a.kind === 'character') && 'characters',
            assets.some((a) => a.kind === 'creature') && 'creatures',
            assets.some((a) => a.kind === 'prop') && 'props',
            textures.length > 0 && 'textures',
            assets.every((a) => a.watertight) && 'watertight',
            category.toLowerCase(),
            'claymation',
          ].filter(Boolean),
        ),
      ],
      formats: ['GLB', ...(textures.length ? ['PNG'] : [])],
      triangles: counted.length
        ? {
            total: counted.reduce((s, n) => s + n, 0),
            min: Math.min(...counted),
            max: Math.max(...counted),
            average: Math.round(counted.reduce((s, n) => s + n, 0) / counted.length),
          }
        : null,
      totalBytes: assets.reduce((s, a) => s + a.bytes, 0) + texFiles.reduce((s, n) => s + n, 0),
      fileCount: assets.length + texFiles.length,
      accent: THEME_ACCENT[category] ?? '#b04cf0',
      hero,
      assets,
      textures,
      // Packs that shipped with textures or an offline viewer have the full kit: render their
      // card art. Others use their concept images (if there are none, render after all).
      mediaKind:
        usable.length && (hasViewer || textures.length || !assets.some((a) => a.preview))
          ? 'render'
          : 'concept',
    });
    if (!usable.length && !assets.some((a) => a.preview)) {
      warnings.push(
        `models/${id}: no readable model and no preview image, so nothing to show; skipped`,
      );
      packs.pop();
    }
  }
  const seen = new Map();
  for (const p of packs) {
    if (seen.has(p.slug)) p.slug = `${p.slug}-${p.id.replace(/^batch/, '')}`;
    if (!SLUG.test(p.slug) || seen.has(p.slug)) p.slug = slugify(p.id);
    seen.set(p.slug, p.id);
  }
  return { packs, warnings };
}

/** A gif counts as a turntable only if it really animates (some upstream gifs are 1-frame stubs). */
async function gifFrames(path) {
  if (statSync(path).size < 10_000) return 0;
  const meta = await sharp(path, { animated: true }).metadata();
  return meta.pages ?? 1;
}

/** Square concept image -> 4:3 card: the image centered over a soft, blurred copy of itself. */
async function conceptThumb(jpg) {
  const { width, height } = THUMB;
  const bg = await sharp(jpg)
    .resize(width, height, { fit: 'cover' })
    .blur(28)
    .modulate({ brightness: 1.04 })
    .toBuffer();
  const fg = await sharp(jpg).resize(height, height, { fit: 'cover' }).toBuffer();
  return sharp(bg)
    .composite([{ input: fg, left: Math.round((width - height) / 2), top: 0 }])
    .webp({ quality: 80 })
    .toBuffer();
}

async function gifToVideo(gif, accent, webm, mp4) {
  const pad = `scale=-2:480:flags=lanczos,pad=640:480:(ow-iw)/2:(oh-ih)/2:color=${accent.replace('#', '0x')},format=yuv420p`;
  const input = ['-y', '-loglevel', 'error', '-i', gif, '-vf', pad, '-an'];
  for (let attempt = 0, step = 0; attempt < 4; attempt++, step += 4) {
    await run(FFMPEG, [
      ...input,
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      String(38 + step),
      '-row-mt',
      '1',
      webm,
    ]);
    await run(FFMPEG, [
      ...input,
      ...[
        '-c:v',
        'libx264',
        '-crf',
        String(27 + step),
        '-preset',
        'slow',
        '-movflags',
        '+faststart',
        mp4,
      ],
    ]);
    if (statSync(webm).size <= VIDEO_MAX_BYTES && statSync(mp4).size <= VIDEO_MAX_BYTES) return;
  }
  throw new Error(`turntable over ${VIDEO_MAX_BYTES} bytes even at high compression`);
}

async function main() {
  const src = arg('--src');
  if (!src || !existsSync(join(src, 'models'))) {
    throw new Error('--src must point at a clay-asset-packs checkout (with models/)');
  }
  const DATA = arg('--data') ?? join(ROOT, 'src/data/library.json');
  const OUT = arg('--out') ?? join(ROOT, 'public/library/packs');
  const only = arg('--only');
  const force = process.argv.includes('--force');
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
    const dir = join(OUT, p.slug);
    const web = `/library/packs/${p.slug}`;
    const byId = new Map(p.assets.map((a) => [a.id, a]));
    try {
      let hash;
      let outputs;
      if (p.mediaKind === 'render') {
        // Same inputs as before, so packs rendered earlier keep their previews.
        hash = sha256(
          JSON.stringify({
            r: RENDER_VERSION,
            o: OPTIMIZE_VERSION,
            accent: p.accent,
            hero: p.hero,
            files: p.assets.map((a) => [a.id, a.hash]),
          }),
        );
        outputs = [
          'thumb.webp',
          'turntable.webm',
          'turntable.mp4',
          ...p.assets.map((a) => `assets/${a.id}.webp`),
        ];
      } else {
        const previews = [];
        for (const a of p.assets) {
          if (a.preview) previews.push([a.id, 'jpg', sha256(await readFile(a.preview))]);
          if (a.gif) previews.push([a.id, 'gif', sha256(await readFile(a.gif))]);
        }
        hash = sha256(
          JSON.stringify({
            c: CONCEPT_VERSION,
            o: OPTIMIZE_VERSION,
            accent: p.accent,
            hero: p.hero,
            files: p.assets.map((a) => [a.id, a.hash]),
            previews,
          }),
        );
        outputs = [
          'thumb.webp',
          ...p.assets.filter((a) => a.preview).map((a) => `assets/${a.id}.webp`),
        ];
      }
      outputs.push(...p.hero.map((h) => `${h}.glb`));
      const fresh =
        !force && old?.sourceHash === hash && outputs.every((f) => existsSync(join(dir, f)));
      let media = old?.media;
      let viewer = old?.viewer;
      if (!fresh) {
        await rm(dir, { recursive: true, force: true });
        await mkdir(join(dir, 'assets'), { recursive: true });
        if (p.mediaKind === 'render') {
          renderer ??= await createRenderer();
          const studio = await Promise.all(
            p.hero.map(async (h) =>
              optimizeGlb(await readFile(byId.get(h).file), { texture: 1024 }),
            ),
          );
          await renderer.renderPack(studio, p.accent, {
            thumb: join(dir, 'thumb.webp'),
            webm: join(dir, 'turntable.webm'),
            mp4: join(dir, 'turntable.mp4'),
          });
          for (const a of p.assets) {
            const small = await optimizeGlb(await readFile(a.file), { texture: 512 });
            await writeFile(
              join(dir, 'assets', `${a.id}.webp`),
              await renderer.renderAsset(small, p.accent),
            );
          }
          media = {
            kind: 'render',
            thumb: { src: `${web}/thumb.webp`, width: THUMB.width, height: THUMB.height },
            webm: `${web}/turntable.webm`,
            mp4: `${web}/turntable.mp4`,
            webmBytes: statSync(join(dir, 'turntable.webm')).size,
            mp4Bytes: statSync(join(dir, 'turntable.mp4')).size,
          };
        } else {
          const lead =
            p.hero.map((h) => byId.get(h)).find((a) => a.preview) ??
            p.assets.find((a) => a.preview);
          await writeFile(join(dir, 'thumb.webp'), await conceptThumb(lead.preview));
          for (const a of p.assets.filter((x) => x.preview)) {
            await writeFile(
              join(dir, 'assets', `${a.id}.webp`),
              await sharp(a.preview)
                .resize(256, 256, { fit: 'cover' })
                .webp({ quality: 76 })
                .toBuffer(),
            );
          }
          media = {
            kind: 'concept',
            thumb: { src: `${web}/thumb.webp`, width: THUMB.width, height: THUMB.height },
            webm: null,
            mp4: null,
            webmBytes: null,
            mp4Bytes: null,
          };
          const spin = [lead, ...p.assets].find((a) => a.gif);
          if (spin && (await gifFrames(spin.gif)) >= 8) {
            await gifToVideo(
              spin.gif,
              p.accent,
              join(dir, 'turntable.webm'),
              join(dir, 'turntable.mp4'),
            );
            Object.assign(media, {
              webm: `${web}/turntable.webm`,
              mp4: `${web}/turntable.mp4`,
              webmBytes: statSync(join(dir, 'turntable.webm')).size,
              mp4Bytes: statSync(join(dir, 'turntable.mp4')).size,
            });
          }
        }
        viewer = [];
        for (const h of p.hero) {
          const glb = await optimizeGlb(await readFile(byId.get(h).file), { texture: 512 });
          await writeFile(join(dir, `${h}.glb`), glb);
          viewer.push({ id: h, src: `${web}/${h}.glb`, bytes: glb.length });
        }
        changes.rendered.push(p.name);
      }
      const entry = {
        slug: p.slug,
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        style: p.style,
        tags: p.tags,
        formats: p.formats,
        triangles: p.triangles,
        totalBytes: p.totalBytes,
        fileCount: p.fileCount,
        accent: p.accent,
        assets: p.assets.map((a) => ({
          id: a.id,
          name: a.name,
          kind: a.kind,
          triangles: a.triangles,
          thumb: existsSync(join(dir, 'assets', `${a.id}.webp`))
            ? `${web}/assets/${a.id}.webp`
            : null,
        })),
        textures: p.textures,
        viewer: viewer.map((v) => ({
          id: v.id,
          src: v.src,
          bytes: v.bytes,
          name: byId.get(v.id).name,
        })),
        media: { kind: media.kind ?? 'render', ...media },
        aiGenerated: true,
        pipeline: PIPELINE,
        license: LICENSE,
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
      'Generated by scripts/build-library.mjs from RDW-Labz/clay-asset-packs (models/, manifests/, previews/, textures/). Edit there, not here.',
    source: { repo: 'RDW-Labz/clay-asset-packs', sha: arg('--sha') ?? prev.source?.sha ?? null },
    packs: result,
  };
  await mkdir(join(DATA, '..'), { recursive: true });
  await writeFile(DATA, JSON.stringify(data, null, 2) + '\n');

  const models = result.reduce((n, p) => n + p.assets.length, 0);
  const lines = ['## Clay Asset Library sync', ''];
  const list = (title, xs) => xs.length && lines.push(`**${title}:** ${xs.join(', ')}`, '');
  list('Added', changes.added);
  list('Updated', changes.updated);
  list('Removed', changes.removed);
  list('Previews built', changes.rendered);
  lines.push(`${result.length} packs, ${models} models. Downloads are off for every pack.`);
  if (warnings.length) lines.push('', '**Warnings**', ...warnings.map((w) => `- ${w}`));
  const summary = lines.join('\n') + '\n';
  console.log(summary);
  const summaryPath = arg('--summary');
  if (summaryPath) await writeFile(summaryPath, summary);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`build-library: ${e.message}`);
    process.exit(1);
  });
}
