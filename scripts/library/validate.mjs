// Validation for the Clay Asset Library. The site never trusts upstream pack.json blindly:
// slugs and asset ids become file names, so they are checked strictly before use.
// Pure functions (tested in tests/library.spec.ts).

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const ASSET_ID = /^[a-z0-9_]{1,64}$/;
export const isTodo = (v) => typeof v !== 'string' || !v.trim() || /^TODO/i.test(v.trim());

/** Hosts a download link may point at (the R2 bucket's custom domain or its r2.dev URL). */
export const DOWNLOAD_HOSTS = [/^assets\.rdwlabz\.com$/, /^pub-[0-9a-f]{32}\.r2\.dev$/];

export function isAllowedDownload(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && DOWNLOAD_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** Problems with an upstream packs/<batch>/pack.json (empty array = usable). */
export function validatePackJson(p) {
  const errs = [];
  const need = (ok, msg) => ok || errs.push(msg);
  if (!p || typeof p !== 'object' || Array.isArray(p)) return ['not an object'];
  need(p.schemaVersion === 1, 'schemaVersion must be 1');
  need(/^batch\d{3}$/.test(p.id ?? ''), 'id must look like batch001');
  need(
    typeof p.slug === 'string' && SLUG.test(p.slug) && p.slug.length <= 60,
    'slug must be kebab-case',
  );
  need(str(p.name, 120), 'name must be 1-120 chars');
  need(str(p.description, 400), 'description must be 1-400 chars');
  need(str(p.category, 40), 'category must be 1-40 chars');
  need(str(p.style, 40), 'style must be 1-40 chars');
  need(Array.isArray(p.tags) && p.tags.every((t) => str(t, 40)), 'tags must be short strings');
  need(
    Array.isArray(p.formats) &&
      p.formats.length > 0 &&
      p.formats.every((f) => /^[A-Z0-9]{2,6}$/.test(f)),
    'formats must be like ["GLB"]',
  );
  need(typeof p.free === 'boolean', 'free must be a boolean');
  need(
    p.price === null || (typeof p.price === 'number' && p.price >= 0),
    'price must be null or ≥ 0',
  );
  need(!(p.free === true && p.price), 'a free pack cannot have a price');
  need(typeof p.listed === 'boolean', 'listed must be a boolean');
  need(typeof p.license === 'string', 'license must be a string');
  need(p.free !== true || !isTodo(p.license), 'a free pack needs a real license');
  need(
    !(p.listed && typeof p.review === 'string' && isTodo(p.review)),
    'listed with an open review',
  );
  need(p.aiGenerated === true || p.aiGenerated === false, 'aiGenerated must be a boolean');
  const assets = Array.isArray(p.assets) ? p.assets : [];
  need(assets.length > 0 && assets.length <= 200, 'assets must have 1-200 entries');
  const ids = new Set();
  for (const a of assets) {
    need(ASSET_ID.test(a?.id ?? ''), `asset id "${a?.id}" is not snake_case`);
    need(!ids.has(a?.id), `duplicate asset id "${a?.id}"`);
    ids.add(a?.id);
    need(str(a?.name, 80), `asset ${a?.id}: name must be 1-80 chars`);
    need(['character', 'creature', 'prop'].includes(a?.kind), `asset ${a?.id}: bad kind`);
    need(
      typeof a?.file === 'string' && /^models\/batch\d{3}\/[a-z0-9_]+\.glb$/.test(a.file),
      `asset ${a?.id}: file must be models/<batch>/<id>.glb`,
    );
    need(
      a?.triangles === null || (Number.isInteger(a?.triangles) && a.triangles > 0),
      `asset ${a?.id}: bad triangles`,
    );
  }
  need(
    Array.isArray(p.hero) &&
      p.hero.length > 0 &&
      p.hero.length <= 3 &&
      p.hero.every((h) => ids.has(h)),
    'hero must list 1-3 asset ids',
  );
  need(Array.isArray(p.textures), 'textures must be an array');
  const files = Array.isArray(p.files) ? p.files : [];
  need(files.length > 0, 'files must not be empty');
  need(
    files.every(
      (f) =>
        typeof f?.path === 'string' &&
        !f.path.includes('..') &&
        Number.isInteger(f?.bytes) &&
        f.bytes > 0,
    ),
    'files must be { path, bytes } with safe paths',
  );
  need(Number.isInteger(p.totalBytes) && p.totalBytes > 0, 'totalBytes must be a positive integer');
  if (p.download !== null && p.download !== undefined) {
    const d = p.download;
    need(
      typeof d?.key === 'string' && /^packs\/[a-z0-9-]+\/[A-Za-z0-9._-]+\.zip$/.test(d.key),
      'download.key is malformed',
    );
    need(Number.isInteger(d?.bytes) && d.bytes > 0, 'download.bytes must be a positive integer');
    need(/^[0-9a-f]{64}$/.test(d?.sha256 ?? ''), 'download.sha256 must be hex');
  }
  return errs;
}

/** A pack offers a download only when it is free, licensed, uploaded, and on an allowed host. */
export function downloadFor(p, base) {
  if (p.free !== true || isTodo(p.license) || !p.download) return null;
  const url = new URL(p.download.key, base).href;
  if (!isAllowedDownload(url)) return null;
  return { url, bytes: p.download.bytes, sha256: p.download.sha256 };
}
