#!/usr/bin/env node
// Auto project tracker. Lists a RDW Labz repo on the site only if the repo opts in with a
// `rdwlabz.json` file at its root (see templates/rdwlabz.json). Merges those entries into
// src/data/projects.json; hand-written entries (no `sync` key) are never touched.
//
// Privacy: repo names, URLs and code are never written or logged. Synced entries are keyed by
// a hash of the numeric repo id; logs and the PR summary mention only the public project name.
//
// Usage:
//   RDWLABZ_SYNC_TOKEN=... node scripts/sync-projects.mjs [--dry-run] [--org RDW-Labz] [--summary out.md]
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CATEGORIES = ['software', 'games', 'mods', 'asset-packs'];
export const STATUSES = ['released', 'in-dev', 'coming-soon'];
const DATA_PATH = fileURLToPath(new URL('../src/data/projects.json', import.meta.url));
const API = 'https://api.github.com';
const MAX_FILE_BYTES = 10_000;

const isTodo = (v) => typeof v === 'string' && v.trim().toUpperCase().startsWith('TODO');
const isHttps = (v) => {
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

/** Stable public id for a repo: never reveals its name. */
export const syncId = (repoId) =>
  'gh-' + createHash('sha256').update(String(repoId)).digest('hex').slice(0, 12);

export const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** "Asset packs" / "asset_packs" / "ASSET-PACKS" → "asset-packs". */
const normCategory = (v) =>
  typeof v === 'string'
    ? v
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
    : v;

/** Would this link reveal a private repo's name (or point at its code)? */
function leaksRepo(value, repoName) {
  if (typeof value !== 'string' || !isHttps(value)) return false;
  const { hostname, pathname } = new URL(value);
  const githubHost = /(^|\.)github\.com$|(^|\.)githubusercontent\.com$|(^|\.)github\.io$/.test(
    hostname,
  );
  return githubHost || pathname.toLowerCase().includes(repoName.toLowerCase());
}

/**
 * Validate one rdwlabz.json. Returns { entry } or { errors }.
 * @param {unknown} raw parsed JSON
 * @param {{ isPrivate: boolean, repoName: string }} repo
 */
export function validateEntry(raw, repo) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { errors: ['not an object'] };
  const r = /** @type {Record<string, unknown>} */ (raw);
  const str = (k, max, { todo = false } = {}) => {
    const v = r[k];
    if (typeof v !== 'string' || !v.trim()) errors.push(`${k}: required text`);
    else if (v.length > max) errors.push(`${k}: max ${max} characters`);
    else if (!todo && isTodo(v)) errors.push(`${k}: must be real, not TODO`);
    return typeof v === 'string' ? v.trim() : '';
  };

  const name = str('name', 80);
  const oneLiner = str('oneLiner', 160, { todo: true });
  const category = normCategory(r.category);
  if (!CATEGORIES.includes(category)) errors.push(`category: one of ${CATEGORIES.join(', ')}`);
  const status = r.status;
  if (!STATUSES.includes(status)) errors.push(`status: one of ${STATUSES.join(', ')}`);

  const platforms = r.platforms ?? [];
  if (
    !Array.isArray(platforms) ||
    platforms.length > 8 ||
    platforms.some((p) => typeof p !== 'string' || !p.trim() || p.length > 30)
  )
    errors.push('platforms: list of up to 8 short names');

  const url = r.url ?? null;
  if (url !== null && !(typeof url === 'string' && (isHttps(url) || isTodo(url))))
    errors.push('url: https link, "TODO" or null');

  const image = r.image ?? null;
  if (
    image !== null &&
    !(typeof image === 'string' && (isHttps(image) || /^\/projects\/[\w./-]+$/.test(image)))
  )
    errors.push('image: https link, /projects/... path, or null');

  const accentColor = r.accentColor ?? 'TODO';
  if (!(
    typeof accentColor === 'string' &&
    (/^#[0-9a-f]{6}$/i.test(accentColor) || isTodo(accentColor))
  ))
    errors.push('accentColor: #rrggbb or "TODO"');

  const featured = r.featured ?? false;
  if (typeof featured !== 'boolean') errors.push('featured: true or false');

  if (repo.isPrivate) {
    if (leaksRepo(url, repo.repoName)) errors.push('url: would expose a private repo');
    if (leaksRepo(image, repo.repoName)) errors.push('image: would expose a private repo');
  }

  const slug = r.slug === undefined ? slugify(name) : r.slug;
  if (typeof slug !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    errors.push('slug: lowercase-words-with-dashes');

  if (errors.length) return { errors };
  return {
    entry: {
      slug,
      name,
      oneLiner,
      category,
      status,
      platforms: platforms.map((p) => p.trim()),
      url,
      accentColor,
      image,
      featured,
    },
  };
}

const strip = (p) => {
  const rest = { ...p };
  delete rest.addedAt;
  return JSON.stringify(rest);
};

/**
 * Merge synced entries into projects.json data. Pure: returns new data + a change list.
 * @param {{ projects: any[] }} data current projects.json
 * @param {{ id: string, entry: any, releasedAt?: string | null }[]} found valid opted-in repos
 * @param {string} today YYYY-MM-DD
 */
export function mergeProjects(data, found, today) {
  const manual = data.projects.filter((p) => !p.sync);
  const previous = new Map(data.projects.filter((p) => p.sync).map((p) => [p.sync.id, p]));
  const taken = new Set(manual.map((p) => p.slug));
  /** @type {Record<'added' | 'updated' | 'released' | 'removed' | 'skipped', string[]>} */
  const changes = { added: [], updated: [], released: [], removed: [], skipped: [] };
  const synced = [];

  for (const { id, entry, releasedAt } of found) {
    if (taken.has(entry.slug)) {
      changes.skipped.push(
        `${entry.name}: slug "${entry.slug}" is already used${
          manual.some((p) => p.slug === entry.slug)
            ? ' by a hand-written entry (delete that entry to let the repo manage it)'
            : ''
        }`,
      );
      continue;
    }
    taken.add(entry.slug);
    const prev = previous.get(id);
    const next = {
      ...entry,
      ...(releasedAt ? { status: 'released' } : {}),
      addedAt: prev?.addedAt ?? today,
      ...(releasedAt ? { releasedAt } : {}),
      sync: { id },
    };
    synced.push(next);
    if (!prev) changes.added.push(next.name);
    else if (strip(prev) !== strip(next)) changes.updated.push(next.name);
    if (next.releasedAt && next.releasedAt !== prev?.releasedAt) changes.released.push(next.name);
    previous.delete(id);
  }
  for (const gone of previous.values()) changes.removed.push(gone.name);

  synced.sort((a, b) => a.name.localeCompare(b.name));
  const next = { ...data, projects: [...manual, ...synced] };
  const changed = JSON.stringify(next.projects) !== JSON.stringify(data.projects);
  return { data: next, changes, changed };
}

/** Markdown for the PR body. Project names only; never repo names. */
export function renderSummary(changes) {
  const lines = ['Automated sync from `rdwlabz.json` files in RDW-Labz repos.', ''];
  const section = (title, items) => {
    if (!items.length) return;
    lines.push(`**${title}**`, ...items.map((i) => `- ${i}`), '');
  };
  section('New', changes.added);
  section('Updated', changes.updated);
  section('Released', changes.released);
  section('Removed (repo opted out or file deleted)', changes.removed);
  section('Skipped (fix the rdwlabz.json)', changes.skipped);
  lines.push('Review the preview build before merging. This bot never pushes to main or deploys.');
  return lines.join('\n') + '\n';
}

async function gh(path, token, accept = 'application/vnd.github+json') {
  const res = await fetch(API + path, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'rdwlabz-sync',
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status} (${res.statusText})`);
  return res;
}

async function listRepos(org, token) {
  const repos = [];
  for (let page = 1; ; page++) {
    const res = await gh(`/orgs/${org}/repos?type=all&per_page=100&page=${page}`, token);
    if (!res) throw new Error(`Organization "${org}" not found or not visible to the token`);
    const batch = await res.json();
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
}

async function collect(org, token) {
  const found = [];
  const skipped = [];
  for (const repo of await listRepos(org, token)) {
    if (repo.disabled) continue;
    const id = syncId(repo.id);
    const path = `/repos/${repo.full_name.split('/').map(encodeURIComponent).join('/')}`;
    const file = await gh(
      `${path}/contents/rdwlabz.json`,
      token,
      'application/vnd.github.raw+json',
    );
    if (!file) continue;
    const text = await file.text();
    let parsed;
    try {
      if (text.length > MAX_FILE_BYTES) throw new Error('too large');
      parsed = JSON.parse(text);
    } catch {
      skipped.push(`repo ${id}: rdwlabz.json is not valid JSON or is over 10 KB`);
      continue;
    }
    const { entry, errors } = validateEntry(parsed, {
      isPrivate: repo.private,
      repoName: repo.name,
    });
    if (!entry) {
      const label =
        typeof parsed?.name === 'string' && !isTodo(parsed.name) ? parsed.name : `repo ${id}`;
      skipped.push(`${label.slice(0, 80)}: ${errors.join('; ')}`);
      continue;
    }
    const release = await gh(`${path}/releases/latest`, token);
    const releasedAt = release ? ((await release.json()).published_at?.slice(0, 10) ?? null) : null;
    found.push({ id, entry, releasedAt });
  }
  return { found, skipped };
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

  const data = JSON.parse(await readFile(DATA_PATH, 'utf8'));
  const { found, skipped } = await collect(org, token);
  const today = new Date().toISOString().slice(0, 10);
  const result = mergeProjects(data, found, today);
  result.changes.skipped.unshift(...skipped);

  const summary = renderSummary(result.changes);
  console.log(`Opted-in repos: ${found.length}. Changed: ${result.changed}.`);
  console.log(summary);
  if (summaryPath) await writeFile(summaryPath, summary);
  if (result.changed && !dryRun) {
    await writeFile(DATA_PATH, JSON.stringify(result.data, null, 2) + '\n');
    console.log('Wrote src/data/projects.json');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    // Error text comes from our own messages or HTTP status lines, never repo contents.
    console.error(`sync-projects: ${e.message}`);
    process.exit(1);
  });
}
