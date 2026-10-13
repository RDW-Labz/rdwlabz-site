import { existsSync } from 'node:fs';
import { join } from 'node:path';
import data from '../data/library.json' with { type: 'json' };
import { ASSET_ID, SLUG, isTodo } from '../../scripts/library/validate.mjs';

export type AssetKind = 'character' | 'creature' | 'prop';

export interface LibraryAsset {
  id: string;
  name: string;
  kind: AssetKind;
  triangles: number | null;
  /** 256 px image (render or concept image); null when upstream has none. */
  thumb: string | null;
}

export interface LibraryPack {
  slug: string;
  id: string;
  name: string;
  description: string;
  category: string;
  style: string;
  tags: string[];
  formats: string[];
  triangles: { total: number; min: number; max: number; average: number } | null;
  totalBytes: number;
  fileCount: number;
  accent: string;
  assets: LibraryAsset[];
  textures: { id: string; name: string; maps: string[] }[];
  /** Web-optimized GLBs of the hero models, for the 3D preview. */
  viewer: { id: string; name: string; src: string; bytes: number }[];
  media: {
    /** render: our studio render of the GLBs. concept: the images the models were made from. */
    kind: 'render' | 'concept';
    thumb: { src: string; width: number; height: number };
    webm: string | null;
    mp4: string | null;
    webmBytes: number | null;
    mp4Bytes: number | null;
  };
  aiGenerated: boolean;
  pipeline: string | null;
  license: string;
  sourceHash: string;
}

export const VIDEO_MAX_BYTES = 1_500_000;

/** Rejects library.json that could ship a broken or unsafe page. Throws at build time. */
export function validateLibrary(raw: { packs: unknown[] }): LibraryPack[] {
  const slugs = new Set<string>();
  return (raw.packs as LibraryPack[]).map((p) => {
    const fail = (msg: string) => {
      throw new Error(`library.json: "${p.slug}" ${msg}`);
    };
    if (!SLUG.test(p.slug)) fail('has an invalid slug');
    if (slugs.has(p.slug)) fail('is a duplicate slug');
    slugs.add(p.slug);
    if (!p.name?.trim()) fail('has no name');
    if (!p.assets?.length) fail('lists no assets');
    const base = `/library/packs/${p.slug}/`;
    const own = (src: string) =>
      typeof src === 'string' && src.startsWith(base) && !src.includes('..');
    for (const a of p.assets) {
      if (!ASSET_ID.test(a.id)) fail(`asset "${a.id}" has an invalid id`);
      if (a.thumb !== null && !own(a.thumb)) fail(`asset "${a.id}" thumb is outside ${base}`);
    }
    const media = [p.media.thumb.src, ...p.viewer.map((v) => v.src)];
    if (p.media.webm !== null || p.media.mp4 !== null) media.push(p.media.webm!, p.media.mp4!);
    if (!media.every(own)) fail(`has media outside ${base}`);
    if ((p.media.webmBytes ?? 0) > VIDEO_MAX_BYTES || (p.media.mp4Bytes ?? 0) > VIDEO_MAX_BYTES) {
      fail('has a turntable over 1.5 MB');
    }
    if (!['render', 'concept'].includes(p.media.kind)) fail('has an unknown media kind');
    // Downloads are off: the store isn't open yet, so no pack may carry a download or a price.
    const raw = p as unknown as Record<string, unknown>;
    if (raw.download || raw.price || raw.free) fail('has a download, price or free flag');
    return p;
  });
}

// Typed loosely: an empty `packs` array in the JSON would otherwise infer as never[].
export const packs: LibraryPack[] = validateLibrary(data as unknown as { packs: unknown[] });

export const licenseText = (p: Pick<LibraryPack, 'license'>): string | null =>
  isTodo(p.license) ? null : p.license;

export function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} MB`;
  return `${Math.max(1, Math.round(n / 1e3))} KB`;
}

export const formatCount = (n: number): string => n.toLocaleString('en-US');

export const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`;

export interface Facet {
  id: 'category' | 'style' | 'format';
  label: string;
  options: { value: string; count: number }[];
}

/** Filter groups. A group is dropped when no option narrows the list (e.g. every pack has GLB). */
export function facets(list: LibraryPack[]): Facet[] {
  const count = (values: string[][]) => {
    const m = new Map<string, number>();
    for (const vs of values) for (const v of new Set(vs)) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m].map(([value, n]) => ({ value, count: n }));
  };
  const groups: Facet[] = [
    { id: 'category', label: 'Theme', options: count(list.map((p) => [p.category])) },
    { id: 'style', label: 'Style', options: count(list.map((p) => [p.style])) },
    { id: 'format', label: 'Format', options: count(list.map((p) => p.formats)) },
  ];
  return groups.filter((g) => g.options.some((o) => o.count < list.length));
}

/** Lowercased text the library search matches against. */
export const searchText = (p: LibraryPack): string =>
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
    .toLowerCase();

export const kindCounts = (p: LibraryPack) => ({
  character: p.assets.filter((a) => a.kind === 'character').length,
  creature: p.assets.filter((a) => a.kind === 'creature').length,
  prop: p.assets.filter((a) => a.kind === 'prop').length,
});

export interface LibraryVideo {
  webm?: string;
  mp4?: string;
  webmPortrait?: string;
  mp4Portrait?: string;
  poster?: string;
}

/**
 * Real clips dropped into public/library/video/ (docs/LIBRARY-VIDEOS.md), checked at build time.
 * null until a file lands; pages then use their CSS placeholder animation.
 */
export function libraryVideo(name: 'teaser-loop' | 'portal' | 'hero-loop'): LibraryVideo | null {
  const dir = join(process.cwd(), 'public/library/video');
  const has = (f: string) => existsSync(join(dir, f));
  const v: LibraryVideo = {};
  if (has(`${name}.webm`)) v.webm = `/library/video/${name}.webm`;
  if (has(`${name}.mp4`)) v.mp4 = `/library/video/${name}.mp4`;
  if (has(`${name}-portrait.webm`)) v.webmPortrait = `/library/video/${name}-portrait.webm`;
  if (has(`${name}-portrait.mp4`)) v.mp4Portrait = `/library/video/${name}-portrait.mp4`;
  for (const ext of ['webp', 'jpg']) {
    if (!v.poster && has(`${name}-poster.${ext}`))
      v.poster = `/library/video/${name}-poster.${ext}`;
  }
  return v.webm || v.mp4 ? v : null;
}

export const modelCount = (list: LibraryPack[]) => list.reduce((n, p) => n + p.assets.length, 0);
