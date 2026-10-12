// Pure core of the project tracker: listing rules, field resolution, privacy, merge, summary.
import { createHash } from 'node:crypto';
import { STORE_ORDER, itchUrl } from './stores.mjs';

export const CATEGORIES = ['software', 'games', 'mods', 'asset-packs'];
export const STATUSES = ['released', 'in-dev', 'coming-soon'];
export const LIST_TOPIC = 'rdwlabz';

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

/** "putt-drop" → "Putt Drop", "myCoolApp" → "My Cool App", "rpg_ui-kit" → "Rpg Ui Kit". */
export const prettifyName = (repoName) =>
  repoName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');

const normCategory = (v) =>
  typeof v === 'string'
    ? v
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
    : v;

/** Would this link reveal a private repo's name (or point at its code)? */
export function leaksRepo(value, repoName) {
  if (typeof value !== 'string' || !isHttps(value)) return false;
  const { hostname, pathname } = new URL(value);
  const githubHost = /(^|\.)github\.com$|(^|\.)githubusercontent\.com$|(^|\.)github\.io$/.test(
    hostname,
  );
  return githubHost || pathname.toLowerCase().includes(repoName.toLowerCase());
}

const REPO_IMAGE = /^[\w][\w ./-]*\.(png|jpe?g|webp)$/i;

const ID_FIELDS = {
  androidId: /^[A-Za-z][\w]*(\.[A-Za-z][\w-]*)+$/,
  iosBundleId: /^[A-Za-z][\w]*(\.[A-Za-z][\w-]*)+$/,
  steamAppId: /^\d{3,10}$/,
  modrinthId: /^[\w-]{2,64}$/,
  curseforgeId: /^\d{3,10}$/,
};

/**
 * rdwlabz.json is optional and holds overrides only. TODO values count as "not set".
 * Bad fields are dropped with a warning instead of failing the repo.
 * @returns {{ overrides: Record<string, any>, warnings: string[] }}
 */
export function validateOverrides(raw, repo) {
  const overrides = {};
  const warnings = [];
  if (raw === null || raw === undefined) return { overrides, warnings };
  if (typeof raw !== 'object' || Array.isArray(raw))
    return { overrides, warnings: ['rdwlabz.json is not an object; ignored'] };
  const set = (k, ok, v, msg) => {
    if (raw[k] === undefined || raw[k] === null || isTodo(raw[k])) return;
    if (ok) overrides[k] = v;
    else warnings.push(`${k}: ${msg}; ignored`);
  };
  const text = (k, max) => {
    const v = raw[k];
    set(
      k,
      typeof v === 'string' && v.trim() && v.length <= max,
      v?.trim?.(),
      `text up to ${max} characters`,
    );
  };
  text('name', 80);
  text('oneLiner', 240);
  text('statusLabel', 40);
  const cat = normCategory(raw.category);
  set('category', CATEGORIES.includes(cat), cat, `one of ${CATEGORIES.join(', ')}`);
  set('status', STATUSES.includes(raw.status), raw.status, `one of ${STATUSES.join(', ')}`);
  const pl = raw.platforms;
  set(
    'platforms',
    Array.isArray(pl) &&
      pl.length <= 8 &&
      pl.every((p) => typeof p === 'string' && p.trim() && p.length <= 30),
    pl?.map?.((p) => p.trim?.()),
    'list of up to 8 short names',
  );
  set('url', typeof raw.url === 'string' && isHttps(raw.url), raw.url, 'https link');
  set(
    'image',
    typeof raw.image === 'string' &&
      (isHttps(raw.image) || /^\/projects\/[\w./-]+$/.test(raw.image)),
    raw.image,
    'https link or /projects/... path',
  );
  set(
    'accentColor',
    typeof raw.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accentColor),
    raw.accentColor,
    '#rrggbb',
  );
  set('featured', typeof raw.featured === 'boolean', raw.featured, 'true or false');
  set('hidden', typeof raw.hidden === 'boolean', raw.hidden, 'true or false');
  set(
    'slug',
    typeof raw.slug === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw.slug),
    raw.slug,
    'lowercase-words-with-dashes',
  );
  for (const [k, re] of Object.entries(ID_FIELDS))
    set(k, typeof raw[k] === 'string' && re.test(raw[k]), raw[k], 'not a valid id');
  const shots = Array.isArray(raw.screenshots)
    ? raw.screenshots.map((s) => (typeof s === 'string' ? { path: s } : s))
    : raw.screenshots;
  set(
    'screenshots',
    Array.isArray(shots) &&
      shots.length >= 1 &&
      shots.length <= 4 &&
      shots.every(
        (s) =>
          s &&
          typeof s.path === 'string' &&
          REPO_IMAGE.test(s.path) &&
          !s.path.split('/').includes('..') &&
          (s.alt === undefined || (typeof s.alt === 'string' && s.alt.length <= 160)),
      ),
    shots?.map?.((s) => (s.alt ? { path: s.path, alt: s.alt.trim() } : { path: s.path })),
    'list of up to 4 repo image paths (png/jpg/webp), optionally { "path", "alt" }',
  );

  if (repo.isPrivate) {
    for (const k of ['url', 'image']) {
      // A store page link is checked for being public before use (see resolveEntry).
      if (k === 'url' && itchUrl(overrides.url)) continue;
      if (leaksRepo(overrides[k], repo.repoName)) {
        delete overrides[k];
        warnings.push(`${k}: would expose a private repo; ignored`);
      }
    }
  }
  return { overrides, warnings };
}

const byStore = (a, b) => STORE_ORDER.indexOf(a.store) - STORE_ORDER.indexOf(b.store);
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const minDate = (ds) => ds.filter(Boolean).sort()[0];

/**
 * Decide whether a repo is listed and fill every field. Overrides always win.
 * @param {{
 *   repo: { name: string, private: boolean, description?: string | null, topics?: string[] },
 *   overrides?: Record<string, any>,
 *   detected?: { androidId?: string|null, iosBundleId?: string|null, topicCategory?: string|null, fileCategory?: string, iconPath?: string|null },
 *   listings?: any[],
 *   ghRelease?: { firstAt: string, url: string } | null,
 * }} input
 * @returns {{ skip: string } | { entry: any, iconSource: any, artSource: any } | null}
 *   null = not listed (silently ignored).
 */
export function resolveEntry({
  repo,
  overrides: o = {},
  detected = {},
  listings = [],
  ghRelease = null,
}) {
  if (o.hidden) return null;
  const stores = [...listings].sort(byStore);
  const live = stores.filter((l) => l.live);
  const tagged = (repo.topics ?? []).includes(LIST_TOPIC);
  if (!stores.length && !tagged) return null;

  // A public store page makes the project public even if the repo is private.
  const isPublic = !repo.private || stores.length > 0;
  const primary = live[0] ?? stores[0];

  const name = o.name ?? primary?.title ?? (isPublic ? prettifyName(repo.name) : null);
  if (!name)
    return {
      skip: 'private repo with no public store listing; add "name" to its rdwlabz.json to list it',
    };

  const ghReleased = !repo.private && !!ghRelease;
  const released = live.length > 0 || ghReleased;
  const status = o.status ?? (released ? 'released' : 'in-dev');
  const description =
    isPublic && repo.description?.trim() ? repo.description.trim().slice(0, 160) : null;

  // An itch link in rdwlabz.json only counts once the page is confirmed public.
  const overrideUrl =
    itchUrl(o.url) && !stores.some((l) => l.store === 'itch' && l.url === itchUrl(o.url))
      ? undefined
      : o.url;
  const url = overrideUrl ?? primary?.url ?? (ghReleased ? ghRelease.url : null);
  const ctaListing = live.find((l) => l.cta && l.url === (itchUrl(url) ?? url));

  const entry = {
    slug: o.slug ?? slugify(name),
    name,
    oneLiner: o.oneLiner ?? description ?? 'TODO: one line',
    category:
      o.category ?? detected.topicCategory ?? primary?.kind ?? detected.fileCategory ?? 'software',
    status,
    platforms:
      o.platforms ??
      uniq([
        ...stores.flatMap((l) => l.platforms ?? []),
        detected.androidId && 'Android',
        detected.iosBundleId && 'iOS',
      ]),
    url,
    accentColor: o.accentColor ?? 'TODO',
    image: o.image ?? null,
    featured: o.featured ?? false,
  };
  if (o.statusLabel) entry.statusLabel = o.statusLabel;
  if (ctaListing) entry.cta = ctaListing.cta;
  if (status === 'released') {
    const at = minDate(live.map((l) => l.releasedAt)) ?? ghRelease?.firstAt;
    if (at) entry.releasedAt = at;
  }
  const iconListing = live.find((l) => l.iconUrl) ?? stores.find((l) => l.iconUrl);
  const iconSource = iconListing
    ? { kind: 'url', url: iconListing.iconUrl }
    : detected.iconPath
      ? { kind: 'repo', path: detected.iconPath }
      : null;
  const shotSources = o.screenshots ?? [];
  const artListing = o.image || shotSources.length ? null : stores.find((l) => l.imageUrl);
  const artSource = artListing ? { kind: 'url', url: artListing.imageUrl } : null;
  return { entry, iconSource, artSource, shotSources };
}

const comparable = (p) => {
  const rest = { ...p };
  delete rest.addedAt;
  delete rest.sync;
  return JSON.stringify(rest);
};

/** Short fingerprint of a field value, so the next run can tell a hand edit from its own output. */
export const fingerprint = (value) =>
  createHash('sha256')
    .update(JSON.stringify(value) ?? 'undefined')
    .digest('hex')
    .slice(0, 8);

/**
 * Fields a person changed by hand in projects.json since the sync last wrote the entry.
 * Explicit `sync.pinned` fields always count; otherwise a field counts when its value no longer
 * matches the fingerprint the sync recorded (or it was added by hand). Entries written before
 * fingerprints existed have no record, so only their pinned fields count.
 */
export function handEdited(prev) {
  const pinned = new Set(prev?.sync?.pinned ?? []);
  const written = prev?.sync?.written;
  if (written) {
    for (const [k, v] of Object.entries(prev)) {
      if (k === 'sync' || k === 'addedAt') continue;
      if (written[k] !== fingerprint(v)) pinned.add(k);
    }
    for (const k of Object.keys(written)) if (!(k in prev)) pinned.add(k);
  }
  return [...pinned].sort();
}

/**
 * Merge synced entries into projects.json. Pure. Hand-written entries (no `sync`) are untouched,
 * and hand-edited fields of synced entries are kept (see handEdited).
 * `found` items are { id, entry } for fresh data, or { id, keep: true } to keep the previous
 * entry as-is after a temporary error.
 */
export function mergeProjects(data, found, today) {
  const manual = data.projects.filter((p) => !p.sync);
  const previous = new Map(data.projects.filter((p) => p.sync).map((p) => [p.sync.id, p]));
  const taken = new Set(manual.map((p) => p.slug));
  /** @type {Record<'added' | 'updated' | 'released' | 'removed' | 'skipped' | 'kept' | 'handEdits', string[]>} */
  const changes = {
    added: [],
    updated: [],
    released: [],
    removed: [],
    skipped: [],
    kept: [],
    handEdits: [],
  };
  const synced = [];
  const removedEntries = [];

  for (const item of found) {
    const prev = previous.get(item.id);
    if (item.keep) {
      if (prev) {
        synced.push(prev);
        taken.add(prev.slug);
        changes.kept.push(prev.name);
        previous.delete(item.id);
      }
      continue;
    }
    // Hand edits in projects.json beat both the repo's overrides and detected values.
    const fields = { ...item.entry };
    const pinned = handEdited(prev);
    for (const k of pinned) {
      if (k in prev) fields[k] = prev[k];
      else delete fields[k];
    }
    if (taken.has(fields.slug)) {
      changes.skipped.push(
        `${fields.name}: slug "${fields.slug}" is already used${
          manual.some((p) => p.slug === fields.slug)
            ? ' by a hand-written entry (delete that entry to let the repo manage it)'
            : ''
        }`,
      );
      continue;
    }
    taken.add(fields.slug);
    if (pinned.length) changes.handEdits.push(`${fields.name}: ${pinned.join(', ')}`);
    const written = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fingerprint(v)]));
    const next = {
      ...fields,
      addedAt: prev?.addedAt ?? today,
      sync: { id: item.id, ...(pinned.length ? { pinned } : {}), written },
    };
    synced.push(next);
    if (!prev) changes.added.push(next.name);
    else if (comparable(prev) !== comparable(next)) changes.updated.push(next.name);
    if (next.releasedAt && next.releasedAt !== prev?.releasedAt) changes.released.push(next.name);
    previous.delete(item.id);
  }
  for (const gone of previous.values()) {
    changes.removed.push(gone.name);
    removedEntries.push(gone);
  }

  synced.sort((a, b) => a.name.localeCompare(b.name));
  const next = { ...data, projects: [...manual, ...synced] };
  const changed = JSON.stringify(next.projects) !== JSON.stringify(data.projects);
  return { data: next, changes, changed, removedEntries };
}

/** Markdown for the PR body. Public project names only; never repo names. */
export function renderSummary(changes, warnings = []) {
  const lines = [
    'Automated sync of RDW-Labz projects (store listings, itch.io pages + `rdwlabz` topic).',
    '',
  ];
  const section = (title, items) => {
    if (!items?.length) return;
    lines.push(`**${title}**`, ...items.map((i) => `- ${i}`), '');
  };
  section('New', changes.added);
  section('Updated', changes.updated);
  section('Released', changes.released);
  section('Removed (no store listing or topic any more)', changes.removed);
  section('Kept previous data (temporary error, will retry)', changes.kept);
  section('Skipped', changes.skipped);
  section('Hand edits kept (remove from `sync.pinned` to hand back)', changes.handEdits);
  section('Warnings', warnings);
  lines.push(
    'Auto-merges only when the build and tests pass and only `src/data/projects.json` and `public/projects/*` changed. Never deploys.',
  );
  return lines.join('\n') + '\n';
}
