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

export const featuredProjects = (): DisplayProject[] =>
  projects.filter((p) => p.featured).map(displayProject);

export const allProjects = (): DisplayProject[] => projects.map(displayProject);

export const countIn = (id: CategoryId): number => projects.filter((p) => p.category === id).length;

export const countLabel = (n: number): string =>
  n === 0 ? 'Nothing here yet' : `${n} project${n === 1 ? '' : 's'}`;

/** Category blurb from data, or null while it is still TODO (UI then shows only the count). */
export const categoryBlurb = (c: Category): string | null => (isTodo(c.blurb) ? null : c.blurb);

/** Verified fallback copy (BUILD-SPEC §0) until Braden supplies a tagline. */
export const tagline = isTodo(site.tagline)
  ? 'We build software, games, mods and asset packs.'
  : site.tagline;

/** null while the contact email is still a placeholder: UI shows "Email coming soon". */
export const contactHref: string | null = isTodo(site.contactEmail)
  ? null
  : `mailto:${site.contactEmail}`;
