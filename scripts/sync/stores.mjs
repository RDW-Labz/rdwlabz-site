// Public store checks. Each returns a listing { store, platform(s), url, title, iconUrl?,
// imageUrl?, releasedAt?, live, kind? } or null when there's no public listing.
// `http(url, init)` is fetch-compatible so tests can pass fixtures.

const UA = 'RDW-Labz/rdwlabz-site project sync (devops@therdw.com)';
const day = (d) => {
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString().slice(0, 10);
};
const decode = (s) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
const meta = (html, prop) =>
  html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, 'i'))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+property="${prop}"`, 'i'))?.[1];

async function get(http, url, init = {}) {
  const res = await http(url, {
    ...init,
    headers: { 'User-Agent': UA, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/** Google Play: the details page returns 200 only for live public listings. */
export async function checkPlay(id, http) {
  const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}`;
  const res = await get(http, `${url}&hl=en_US&gl=US`);
  if (!res) return null;
  const html = await res.text();
  const title = decode(meta(html, 'og:title') ?? '').replace(/\s+-\s+Apps on Google Play$/i, '');
  return {
    store: 'play',
    platforms: ['Android'],
    url,
    title: title || undefined,
    iconUrl: meta(html, 'og:image') ? decode(meta(html, 'og:image')) : undefined,
    live: true,
  };
}

/** Apple App Store via the public iTunes lookup API. */
export async function checkAppStore(bundleId, http) {
  const res = await get(
    http,
    `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=us`,
  );
  const app = res && (await res.json()).results?.[0];
  if (!app?.trackViewUrl) return null;
  return {
    store: 'app-store',
    platforms: ['iOS'],
    url: app.trackViewUrl.replace(/\?.*$/, ''),
    title: app.trackName,
    iconUrl: app.artworkUrl512 ?? app.artworkUrl100,
    releasedAt: day(app.releaseDate),
    live: true,
  };
}

/** Steam store page via the public appdetails API. "Coming soon" pages count as listed, not released. */
export async function checkSteam(appId, http) {
  const res = await get(
    http,
    `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`,
  );
  const entry = res && (await res.json())?.[appId];
  if (!entry?.success || !entry.data) return null;
  const d = entry.data;
  const p = d.platforms ?? {};
  return {
    store: 'steam',
    platforms: [p.windows && 'Windows', p.mac && 'macOS', p.linux && 'Linux'].filter(Boolean),
    url: `https://store.steampowered.com/app/${appId}`,
    title: d.name,
    imageUrl: d.header_image,
    releasedAt: d.release_date?.coming_soon ? undefined : day(d.release_date?.date),
    live: !d.release_date?.coming_soon,
    kind: 'games',
  };
}

const MODRINTH_KIND = {
  mod: 'mods',
  plugin: 'mods',
  datapack: 'mods',
  modpack: 'mods',
  resourcepack: 'asset-packs',
  shader: 'asset-packs',
};

/** Modrinth public API. Drafts, unlisted and private projects don't count. */
export async function checkModrinth(id, http) {
  const res = await get(http, `https://api.modrinth.com/v2/project/${encodeURIComponent(id)}`);
  const p = res && (await res.json());
  if (!p?.slug || !['approved', 'archived'].includes(p.status)) return null;
  return {
    store: 'modrinth',
    platforms: ['Minecraft'],
    url: `https://modrinth.com/${p.project_type ?? 'project'}/${p.slug}`,
    title: p.title,
    iconUrl: p.icon_url ?? undefined,
    releasedAt: day(p.published),
    live: true,
    kind: MODRINTH_KIND[p.project_type] ?? 'mods',
  };
}

/** CurseForge needs an API key (free, but tied to an account), so it only runs when one is set. */
export async function checkCurseForge(id, http, apiKey) {
  if (!apiKey) return null;
  const res = await get(http, `https://api.curseforge.com/v1/mods/${id}`, {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
  });
  const m = res && (await res.json())?.data;
  if (!m?.links?.websiteUrl || m.status !== 4 || m.isAvailable === false) return null;
  return {
    store: 'curseforge',
    platforms: [m.gameId === 432 ? 'Minecraft' : 'PC'],
    url: m.links.websiteUrl,
    title: m.name,
    iconUrl: m.logo?.url,
    releasedAt: day(m.dateReleased),
    live: true,
    kind: m.classId === 12 ? 'asset-packs' : 'mods',
  };
}

/** Store order for picking the main link/title/icon when a project is in several stores. */
export const STORE_ORDER = ['play', 'app-store', 'steam', 'modrinth', 'curseforge'];
