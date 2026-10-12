import data from '../data/projects.json';

export type CategoryId = 'software' | 'games' | 'mods' | 'asset-packs';
export type Status = 'released' | 'in-dev' | 'coming-soon';

export interface Category {
  id: CategoryId;
  label: string;
  blurb: string;
}

export interface Project {
  slug: string;
  name: string;
  oneLiner: string;
  category: CategoryId;
  status: Status;
  platforms: string[];
  url: string | null;
  accentColor: string;
  image: string | null;
  featured: boolean;
  /** YYYY-MM-DD the project first appeared on the site. */
  addedAt?: string;
  /** YYYY-MM-DD of the latest GitHub Release (set by scripts/sync-projects.mjs). */
  releasedAt?: string;
  /** Present only on entries managed by scripts/sync-projects.mjs. Manual entries have none. */
  sync?: { id: string };
}

export interface SiteInfo {
  name: string;
  domain: string;
  tagline: string;
  contactEmail: string;
  launchDate: string;
  workWithUs: string;
}

const CATEGORY_IDS: readonly CategoryId[] = ['software', 'games', 'mods', 'asset-packs'];
const STATUSES: readonly Status[] = ['released', 'in-dev', 'coming-soon'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A value still waiting on real content from Braden. */
export const isTodo = (value: string | null | undefined): boolean =>
  !value || value.trim().toUpperCase().startsWith('TODO');

function validate(raw: typeof data): { projects: Project[]; categories: Category[] } {
  const slugs = new Set<string>();
  const projects = raw.projects.map((p) => {
    if (!CATEGORY_IDS.includes(p.category as CategoryId)) {
      throw new Error(`projects.json: "${p.slug}" has unknown category "${p.category}"`);
    }
    if (!STATUSES.includes(p.status as Status)) {
      throw new Error(`projects.json: "${p.slug}" has unknown status "${p.status}"`);
    }
    if (slugs.has(p.slug)) throw new Error(`projects.json: duplicate slug "${p.slug}"`);
    slugs.add(p.slug);
    for (const key of ['addedAt', 'releasedAt'] as const) {
      const v = (p as Partial<Project>)[key];
      if (v !== undefined && !DATE.test(v)) {
        throw new Error(`projects.json: "${p.slug}" ${key} must be YYYY-MM-DD, got "${v}"`);
      }
    }
    return p as Project;
  });
  return { projects, categories: raw.categories as Category[] };
}

const validated = validate(data);

export const categories: Category[] = validated.categories;
export const projects: Project[] = validated.projects;
export const site: SiteInfo = data.site;

export const categoryLabel = (id: CategoryId): string =>
  categories.find((c) => c.id === id)?.label ?? id;

export const statusLabel: Record<Status, string> = {
  released: 'Released',
  'in-dev': 'In development',
  'coming-soon': 'Coming soon',
};

/** Accent fallbacks per category, used when a project's accentColor is still TODO. */
export const categoryAccent: Record<CategoryId, string> = {
  software: '#2f6bff',
  games: '#ff4d2e',
  mods: '#12a150',
  'asset-packs': '#c026d3',
};

const HEX = /^#[0-9a-f]{6}$/i;

export function projectAccent(p: Project): string {
  return HEX.test(p.accentColor) ? p.accentColor : categoryAccent[p.category];
}

/** UI-safe view of a project: TODO fields become neutral placeholder copy, never fake facts. */
export function displayProject(p: Project) {
  const placeholder = isTodo(p.name);
  return {
    ...p,
    placeholder,
    title: placeholder ? 'Something’s brewing' : p.name,
    blurb: isTodo(p.oneLiner) ? 'Details coming soon.' : p.oneLiner,
    accent: projectAccent(p),
    href: p.url && !isTodo(p.url) ? p.url : null,
    categoryText: categoryLabel(p.category),
    statusText: statusLabel[p.status],
  };
}

export type DisplayProject = ReturnType<typeof displayProject>;

/** Entries whose name is still TODO are never shown or counted. */
const realProjects = projects.filter((p) => !isTodo(p.name));

export const featuredProjects = (): DisplayProject[] =>
  realProjects.filter((p) => p.featured).map(displayProject);

export const allProjects = (): DisplayProject[] => realProjects.map(displayProject);

export const countIn = (id: CategoryId): number =>
  realProjects.filter((p) => p.category === id).length;

export const pluralProjects = (n: number): string => `${n} project${n === 1 ? '' : 's'}`;

export const countLabel = (n: number): string => (n === 0 ? 'Coming soon' : pluralProjects(n));

/** Category blurb from data, or null while it is still TODO (UI then shows only the count). */
export const categoryBlurb = (c: Category): string | null => (isTodo(c.blurb) ? null : c.blurb);

export interface ActivityItem {
  kind: 'release' | 'new';
  date: string;
  project: DisplayProject;
}

/** Latest "new project" / "release" events, newest first. Built at build time from the data. */
export function labActivity(limit = 3): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const p of realProjects) {
    const d = displayProject(p);
    if (p.releasedAt) items.push({ kind: 'release', date: p.releasedAt, project: d });
    if (p.addedAt) items.push({ kind: 'new', date: p.addedAt, project: d });
  }
  return items
    .sort((a, b) => b.date.localeCompare(a.date) || (a.kind === 'release' ? -1 : 1))
    .slice(0, limit);
}

/** Text-safe (≥ 4.5:1 on paper) versions of the category accents, for colored words. */
export const categoryInk: Record<CategoryId, string> = {
  software: '#1f4fd1',
  games: '#c42d14',
  mods: '#0b7a3e',
  'asset-packs': '#9c1fa8',
};

/** The real tagline, or null while it is TODO (the hero then shows only the verified line). */
export const customTagline: string | null = isTodo(site.tagline) ? null : site.tagline;

/** Verified fallback copy (BUILD-SPEC §0) until Braden supplies a tagline. */
export const tagline = isTodo(site.tagline)
  ? 'We build software, games, mods and asset packs.'
  : site.tagline;

/** null while the contact email is still a placeholder: UI shows "Email coming soon". */
export const contactHref: string | null = isTodo(site.contactEmail)
  ? null
  : `mailto:${site.contactEmail}`;
