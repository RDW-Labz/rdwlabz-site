#!/usr/bin/env node
// Automatic project tracker for rdwlabz.com.
//
// A RDW-Labz repo is listed only if (a) its app has a public store listing (Google Play,
// App Store, Steam, Modrinth, CurseForge) found from ids in the repo, or a public itch.io page
// linked from rdwlabz.json `url` or the repo homepage, or (b) it has the GitHub topic `rdwlabz`.
// An optional `rdwlabz.json` at the repo root overrides any field. Nothing else is ever listed.
// Hand edits to synced entries in projects.json are kept. Pure logic lives in scripts/sync/
// (tested in tests/sync-projects.spec.ts).
//
// Privacy: private repo names, descriptions and links are used only once the app has a public
// store page. Entries are keyed by a hash of the repo id; logs and the PR body only use public
// project names.
//
// Fail soft: a repo that errors keeps its previous entry; only "can't list the org" aborts.
//
// Usage: RDWLABZ_SYNC_TOKEN=... node scripts/sync-projects.mjs [--dry-run] [--org RDW-Labz] [--summary out.md]
//        [--ref repo=branch ...]  (read that repo's rdwlabz.json + screenshots from a branch, e.g. an open PR)
//        (optional CURSEFORGE_API_KEY enables CurseForge checks)
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  categoryFromTopics,
  detectIds,
  findRepoIcon,
  guessCategory,
  pickFiles,
} from './sync/detect.mjs';
import {
  checkAppStore,
  checkCurseForge,
  checkItch,
  checkModrinth,
  checkPlay,
  checkSteam,
  itchUrl,
} from './sync/stores.mjs';
import { processArt, processIcon, processShot } from './sync/images.mjs';
import {
  mergeProjects,
  renderSummary,
  resolveEntry,
  syncId,
  validateOverrides,
} from './sync/build.mjs';

export * from './sync/build.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA_PATH = `${ROOT}src/data/projects.json`;
const ASSET_DIR = `${ROOT}public/projects`;
const CACHE_PATH = `${ROOT}.sync-cache/cache.json`;
const API = 'https://api.github.com';
const STORE_FRESH_MS = 5 * 3600_000;
const STORE_STALE_MS = 14 * 24 * 3600_000;
const MAX_IMAGE_BYTES = 5_000_000;
const GENERATED = /^[a-z0-9-]+-(icon|art|shot-\d)\.webp$/;

const ENTRY_ORDER = [
  'slug',
  'name',
  'oneLiner',
  'category',
  'status',
  'statusLabel',
  'platforms',
  'url',
  'cta',
  'accentColor',
  'image',
  'icon',
  'screenshots',
  'featured',
  'releasedAt',
];
const ordered = (e) =>
  Object.fromEntries(ENTRY_ORDER.filter((k) => e[k] !== undefined).map((k) => [k, e[k]]));

function makeGh(token) {
  return async function gh(path, accept = 'application/vnd.github+json') {
    const res = await fetch(API + path, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: accept,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'rdwlabz-sync',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 404 || res.status === 409) return null; // missing / empty repo
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return res;
  };
}

async function listRepos(gh, org) {
  const repos = [];
  for (let page = 1; ; page++) {
    const res = await gh(`/orgs/${org}/repos?type=all&per_page=100&page=${page}`);
    if (!res) throw new Error(`Organization "${org}" not found or not visible to the token`);
    const batch = await res.json();
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
}

async function loadCache() {
  try {
    return { scans: {}, stores: {}, assets: {}, ...JSON.parse(await readFile(CACHE_PATH, 'utf8')) };
  } catch {
    return { scans: {}, stores: {}, assets: {} };
  }
}

/** Store lookups with a short cache; on error fall back to a stale result if we have one. */
async function cachedStore(cache, key, fn) {
  const hit = cache.stores[key];
  if (hit && Date.now() - hit.at < STORE_FRESH_MS) return hit.value;
  try {
    const value = await fn();
    cache.stores[key] = { at: Date.now(), value };
    return value;
  } catch (e) {
    if (hit && Date.now() - hit.at < STORE_STALE_MS) return hit.value;
    throw new Error(`store check failed (${key.split(':')[0]}): ${e.message}`);
  }
}

async function scanRepo(gh, repo, cache) {
  const hit = cache.scans[repo.id];
  if (hit && hit.pushedAt === repo.pushed_at) return hit.result;
  const base = `/repos/${repo.full_name.split('/').map(encodeURIComponent).join('/')}`;
  const treeRes = await gh(
    `${base}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`,
  );
  const tree = treeRes ? ((await treeRes.json()).tree ?? []) : [];
  const files = {};
  for (const path of pickFiles(tree)) {
    const enc = path.split('/').map(encodeURIComponent).join('/');
    const res = await gh(`${base}/contents/${enc}`, 'application/vnd.github.raw+json');
    if (res) files[path] = await res.text();
  }
  const iconPath = findRepoIcon(tree, files);
  const result = {
    ids: detectIds(files),
    fileCategory: guessCategory({ paths: tree.map((f) => f.path), files }),
    iconPath,
    iconSha: iconPath ? tree.find((f) => f.path === iconPath)?.sha : null,
  };
  cache.scans[repo.id] = { pushedAt: repo.pushed_at, result };
  return result;
}

async function firstRelease(gh, repo) {
  const base = `/repos/${repo.full_name.split('/').map(encodeURIComponent).join('/')}`;
  const res = await gh(`${base}/releases?per_page=100`);
  const list = res ? (await res.json()).filter((r) => !r.draft && !r.prerelease) : [];
  if (!list.length) return null;
  const firstAt = list
    .map((r) => r.published_at?.slice(0, 10))
    .filter(Boolean)
    .sort()[0];
  return firstAt ? { firstAt, url: `${repo.html_url}/releases` } : null;
}

async function download(url) {
  if (!/^https:\/\//.test(url)) throw new Error('image url must be https');
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`image HTTP ${res.status}`);
  if (!/^image\//.test(res.headers.get('content-type') ?? 'image/'))
    throw new Error('not an image');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error('image too large');
  return buf;
}

async function writeIfChanged(path, buf, dryRun) {
  if (existsSync(path) && Buffer.compare(await readFile(path), buf) === 0) return false;
  if (!dryRun) {
    await mkdir(ASSET_DIR, { recursive: true });
    await writeFile(path, buf);
  }
  return true;
}

/** Fetch + optimise one asset, reusing the previous output when the source hasn't changed. */
async function asset({ cache, slug, kind, source, load, dryRun }) {
  const file = `${slug}-${kind}.webp`;
  const path = `${ASSET_DIR}/${file}`;
  const key = `${slug}:${kind}`;
  const sourceKey = source.kind === 'url' ? source.url : `repo:${source.sha ?? source.path}`;
  const prev = cache.assets[key];
  if (prev?.source === sourceKey && existsSync(path))
    return { ...prev.meta, publicPath: `/projects/${file}`, accent: prev.accent, changed: false };
  const buf = await load();
  const process = kind === 'icon' ? processIcon : kind === 'art' ? processArt : processShot;
  const out = await process(buf);
  const changed = await writeIfChanged(path, out.webp, dryRun);
  const meta = out.width ? { width: out.width, height: out.height } : undefined;
  cache.assets[key] = { source: sourceKey, accent: out.accent, meta };
  return { ...meta, publicPath: `/projects/${file}`, accent: out.accent, changed };
}

async function processRepo(ctx, repo) {
  const { gh, cache, dryRun, curseforgeKey, refs } = ctx;
  const base = `/repos/${repo.full_name.split('/').map(encodeURIComponent).join('/')}`;
  const ref = refs[repo.name] ? `?ref=${encodeURIComponent(refs[repo.name])}` : '';
  const repoFile = (path, accept) =>
    gh(`${base}/contents/${path.split('/').map(encodeURIComponent).join('/')}${ref}`, accept);
  const warnings = [];

  const fileRes = await repoFile('rdwlabz.json', 'application/vnd.github.raw+json');
  let raw = null;
  if (fileRes) {
    const text = await fileRes.text();
    try {
      raw = text.length <= 10_000 ? JSON.parse(text) : null;
      if (raw === null) warnings.push('rdwlabz.json is over 10 KB; ignored');
    } catch {
      warnings.push('rdwlabz.json is not valid JSON; ignored');
    }
  }
  const { overrides, warnings: w } = validateOverrides(raw, {
    isPrivate: repo.private,
    repoName: repo.name,
  });
  warnings.push(...w);
  if (overrides.hidden) return { result: null, warnings };

  const scan = await scanRepo(gh, repo, cache);
  const ids = { ...scan.ids };
  for (const k of Object.keys(ids)) if (overrides[k]) ids[k] = overrides[k];

  const http = (url, init) => fetch(url, init);
  const itchPage = itchUrl(overrides.url) ?? itchUrl(repo.homepage);
  const checks = [
    ids.androidId &&
      cachedStore(cache, `play:${ids.androidId}`, () => checkPlay(ids.androidId, http)),
    ids.iosBundleId &&
      cachedStore(cache, `app-store:${ids.iosBundleId}`, () =>
        checkAppStore(ids.iosBundleId, http),
      ),
    ids.steamAppId &&
      cachedStore(cache, `steam:${ids.steamAppId}`, () => checkSteam(ids.steamAppId, http)),
    ids.modrinthId &&
      cachedStore(cache, `modrinth:${ids.modrinthId}`, () => checkModrinth(ids.modrinthId, http)),
    ids.curseforgeId &&
      (curseforgeKey
        ? cachedStore(cache, `curseforge:${ids.curseforgeId}`, () =>
            checkCurseForge(ids.curseforgeId, http, curseforgeKey),
          )
        : (warnings.push('CurseForge id found, but CURSEFORGE_API_KEY is not set; not checked'),
          null)),
    itchPage && cachedStore(cache, `itch:${itchPage}`, () => checkItch(itchPage, http)),
  ].filter(Boolean);
  const listings = (await Promise.all(checks)).filter(Boolean);

  const topics = repo.topics ?? [];
  const resolved = resolveEntry({
    repo: { name: repo.name, private: repo.private, description: repo.description, topics },
    overrides,
    detected: {
      androidId: ids.androidId,
      iosBundleId: ids.iosBundleId,
      topicCategory: categoryFromTopics(topics),
      fileCategory: scan.fileCategory,
      iconPath: scan.iconPath,
    },
    listings,
    ghRelease: listings.length || topics.includes('rdwlabz') ? await firstRelease(gh, repo) : null,
  });
  if (!resolved || 'skip' in resolved) return { result: resolved, warnings };

  const { entry, iconSource, artSource, shotSources } = resolved;
  let assetsChanged = false;
  let accent = null;
  entry.icon = null;
  if (iconSource) {
    try {
      const src = iconSource.kind === 'repo' ? { ...iconSource, sha: scan.iconSha } : iconSource;
      const load =
        src.kind === 'url'
          ? () => download(src.url)
          : async () => {
              const enc = src.path.split('/').map(encodeURIComponent).join('/');
              const res = await gh(`${base}/contents/${enc}`, 'application/vnd.github.raw');
              if (!res) throw new Error('icon file missing');
              return Buffer.from(await res.arrayBuffer());
            };
      const a = await asset({ cache, slug: entry.slug, kind: 'icon', source: src, load, dryRun });
      entry.icon = a.publicPath;
      accent = a.accent;
      assetsChanged ||= a.changed;
    } catch (e) {
      warnings.push(`icon skipped (${e.message})`);
    }
  }
  if (artSource) {
    try {
      const a = await asset({
        cache,
        slug: entry.slug,
        kind: 'art',
        source: artSource,
        load: () => download(artSource.url),
        dryRun,
      });
      entry.image = a.publicPath;
      accent ??= a.accent;
      assetsChanged ||= a.changed;
    } catch (e) {
      warnings.push(`card art skipped (${e.message})`);
    }
  }
  const shots = [];
  for (const [i, s] of shotSources.entries()) {
    try {
      const a = await asset({
        cache,
        slug: entry.slug,
        kind: `shot-${i + 1}`,
        // Re-check on every push to the repo (or ref): cheap, and catches replaced files.
        source: { kind: 'repo', sha: `${s.path}@${refs[repo.name] ?? repo.pushed_at}` },
        load: async () => {
          const res = await repoFile(s.path, 'application/vnd.github.raw');
          if (!res) throw new Error(`${s.path} not found`);
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > MAX_IMAGE_BYTES) throw new Error(`${s.path} is over 5 MB`);
          return buf;
        },
        dryRun,
      });
      shots.push({
        src: a.publicPath,
        width: a.width,
        height: a.height,
        alt: s.alt ?? `${entry.name} screenshot ${i + 1}`,
      });
      assetsChanged ||= a.changed;
    } catch (e) {
      warnings.push(`screenshot skipped (${e.message})`);
    }
  }
  if (shots.length) entry.screenshots = shots;
  if (!overrides.accentColor && accent) entry.accentColor = accent;
  return { result: { entry: ordered(entry) }, warnings, assetsChanged };
}

/** Delete generated icons/art that no project references any more. */
async function pruneAssets(projects, dryRun) {
  if (!existsSync(ASSET_DIR)) return [];
  const used = new Set(
    projects
      .flatMap((p) => [p.icon, p.image, ...(p.screenshots ?? []).map((s) => s.src)])
      .filter(Boolean),
  );
  const stale = (await readdir(ASSET_DIR)).filter(
    (f) => GENERATED.test(f) && !used.has(`/projects/${f}`),
  );
  if (!dryRun) await Promise.all(stale.map((f) => unlink(`${ASSET_DIR}/${f}`)));
  return stale;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

async function main() {
  const token = process.env.RDWLABZ_SYNC_TOKEN;
  if (!token) throw new Error('RDWLABZ_SYNC_TOKEN is not set');
  const org = arg('--org') ?? 'RDW-Labz';
  const dryRun = process.argv.includes('--dry-run');
  const summaryPath = arg('--summary');
  const gh = makeGh(token);
  const cache = await loadCache();
  const refs = Object.fromEntries(
    process.argv
      .flatMap((a, i) => (a === '--ref' ? [process.argv[i + 1] ?? ''] : []))
      .map((r) => r.split('='))
      .filter(([repo, branch]) => repo && branch),
  );
  const ctx = { gh, cache, dryRun, curseforgeKey: process.env.CURSEFORGE_API_KEY, refs };

  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const prevById = new Map(data.projects.filter((p) => p.sync).map((p) => [p.sync.id, p]));
  const found = [];
  const warnings = [];
  const skipped = [];
  let assetsChanged = false;

  for (const repo of await listRepos(gh, org)) {
    if (repo.disabled) continue;
    const id = syncId(repo.id);
    const prev = prevById.get(id);
    try {
      const { result, warnings: w, assetsChanged: a } = await processRepo(ctx, repo);
      const label = result?.entry?.name ?? prev?.name ?? `repo ${id}`;
      warnings.push(...w.map((x) => `${label}: ${x}`));
      assetsChanged ||= !!a;
      if (result && 'skip' in result) skipped.push(`${label}: ${result.skip}`);
      else if (result) found.push({ id, entry: result.entry });
    } catch (e) {
      // One bad repo never breaks the run: keep what we had and retry next time.
      if (prev) found.push({ id, keep: true });
      warnings.push(`${prev?.name ?? `repo ${id}`}: check failed, will retry (${e.message})`);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const result = mergeProjects(data, found, today);
  result.changes.skipped.unshift(...skipped);
  const pruned = await pruneAssets(result.data.projects, dryRun);

  const summary = renderSummary(result.changes, warnings);
  console.log(
    `Listed: ${found.length}. Data changed: ${result.changed}. Assets changed: ${assetsChanged || pruned.length > 0}.`,
  );
  console.log(summary);
  if (summaryPath) await writeFile(summaryPath, summary);
  if (!dryRun) {
    await mkdir(`${ROOT}.sync-cache`, { recursive: true });
    await writeFile(CACHE_PATH, JSON.stringify(cache));
    if (result.changed) {
      await writeFile(DATA_PATH, JSON.stringify(result.data, null, 2) + '\n');
      console.log('Wrote src/data/projects.json');
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    // Messages come from our own code or HTTP status lines, never repo contents.
    console.error(`sync-projects: ${e.message}`);
    process.exit(1);
  });
}
