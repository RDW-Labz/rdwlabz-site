import { existsSync } from 'node:fs';
import { join } from 'node:path';
import data from '../data/showcase.json' with { type: 'json' };
import shotsData from '../data/showcase-shots.json' with { type: 'json' };
import { validateShowcase } from '../../scripts/showcase/checks.mjs';

/** One site in src/data/showcase.json (format in docs/SHOWCASE.md). */
export interface ShowcaseEntry {
  slug: string;
  name: string;
  url?: string | null;
  kind: 'web';
  blurb: string;
  tags: string[];
  private: boolean;
  publicContact?: string[];
}

type Size = { width: number; height: number; bytes: number };
/** Written by scripts/capture-showcase.mjs / capture-private.mjs. */
type Shots = Record<string, { captured: string; files: Record<string, Size> }>;

export interface ShowcaseItem {
  slug: string;
  name: string;
  /** Live site; null for private builds (never linked). */
  href: string | null;
  /** "yottaify.com", shown under the card. */
  host: string | null;
  blurb: string;
  tags: string[];
  private: boolean;
  image: {
    src: string;
    srcset: string;
    width: number;
    height: number;
    alt: string;
  } | null;
}

const problems = validateShowcase(data);
if (problems.length) throw new Error(`src/data/showcase.json:\n- ${problems.join('\n- ')}`);

const shots = shotsData as Shots;
const publicDir = join(process.cwd(), 'public');

function image(e: ShowcaseEntry): ShowcaseItem['image'] {
  const files = shots[e.slug]?.files;
  const small = files?.['card-640'];
  const large = files?.['card-1280'];
  const base = `/showcase/${e.slug}`;
  if (!small || !large || !existsSync(join(publicDir, base, 'card-640.webp'))) return null;
  return {
    src: `${base}/card-640.webp`,
    srcset: `${base}/card-640.webp ${small.width}w, ${base}/card-1280.webp ${large.width}w`,
    width: small.width,
    height: small.height,
    alt: e.private
      ? `Screenshot of ${e.name} running on sample data`
      : `Screenshot of the ${e.name} home page`,
  };
}

export const showcase: ShowcaseItem[] = (data as ShowcaseEntry[]).map((e) => ({
  slug: e.slug,
  name: e.name,
  href: e.private ? null : (e.url ?? null),
  host: e.private || !e.url ? null : new URL(e.url).host.replace(/^www\./, ''),
  blurb: e.blurb,
  tags: e.tags,
  private: e.private,
  image: image(e),
}));
