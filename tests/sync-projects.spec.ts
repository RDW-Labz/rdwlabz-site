import { test, expect } from '@playwright/test';
import {
  validateEntry,
  mergeProjects,
  renderSummary,
  syncId,
  slugify,
} from '../scripts/sync-projects.mjs';

const pub = { isPrivate: false, repoName: 'putt-drop' };
const priv = { isPrivate: true, repoName: 'secret-thing' };
const good = {
  name: 'Putt Drop',
  oneLiner: 'TODO: one line',
  category: 'Games',
  status: 'in-dev',
  platforms: ['Android'],
  url: 'TODO',
  accentColor: 'TODO',
  image: null,
  featured: true,
};
const manual = {
  slug: 'hand-made',
  name: 'Hand Made',
  oneLiner: 'x',
  category: 'mods',
  status: 'released',
  platforms: [],
  url: null,
  accentColor: 'TODO',
  image: null,
  featured: false,
};

test.describe('sync-projects', () => {
  test('accepts a valid file and normalizes category + slug', () => {
    const { entry, errors } = validateEntry(good, pub);
    expect(errors).toBeUndefined();
    expect(entry).toMatchObject({ slug: 'putt-drop', category: 'games', featured: true });
  });

  test('rejects missing/TODO names, bad enums, bad links and wrong types', () => {
    const { errors } = validateEntry(
      {
        ...good,
        name: 'TODO',
        category: 'tools',
        status: 'done',
        url: 'http://x.dev',
        accentColor: 'red',
        featured: 'yes',
        image: 'C:/a.png',
      },
      pub,
    );
    expect(errors?.join('|')).toMatch(/name.*category.*status.*url.*image.*accentColor.*featured/);
    expect(validateEntry([], pub).errors).toBeTruthy();
    expect(validateEntry(null, pub).errors).toBeTruthy();
  });

  test('private repos cannot leak their name or code links', () => {
    expect(
      validateEntry({ ...good, url: 'https://github.com/RDW-Labz/secret-thing' }, priv).errors,
    ).toContain('url: would expose a private repo');
    expect(
      validateEntry({ ...good, image: 'https://raw.githubusercontent.com/x/y/main/a.png' }, priv)
        .errors,
    ).toContain('image: would expose a private repo');
    expect(
      validateEntry({ ...good, url: 'https://play.google.com/store' }, priv).entry,
    ).toBeTruthy();
  });

  test('ids are hashes, never repo names', () => {
    expect(syncId(123)).toMatch(/^gh-[0-9a-f]{12}$/);
    expect(syncId(123)).toBe(syncId(123));
    expect(slugify('Café Racer: 2!')).toBe('cafe-racer-2');
  });

  test('merge keeps manual entries, adds, releases, removes, and skips slug clashes', () => {
    const id = syncId(1);
    const entry = validateEntry(good, pub).entry!;
    const first = mergeProjects({ projects: [manual] }, [{ id, entry }], '2026-10-01');
    expect(first.changed).toBe(true);
    expect(first.changes.added).toEqual(['Putt Drop']);
    expect(first.data.projects[0]).toEqual(manual);
    expect(first.data.projects[1]).toMatchObject({ addedAt: '2026-10-01', sync: { id } });

    const same = mergeProjects(first.data, [{ id, entry }], '2026-10-09');
    expect(same.changed).toBe(false);

    const rel = mergeProjects(first.data, [{ id, entry, releasedAt: '2026-10-05' }], '2026-10-09');
    expect(rel.changes.released).toEqual(['Putt Drop']);
    expect(rel.data.projects[1]).toMatchObject({
      status: 'released',
      releasedAt: '2026-10-05',
      addedAt: '2026-10-01',
    });

    const clash = mergeProjects(
      first.data,
      [{ id: syncId(2), entry: { ...entry, name: 'Other', slug: 'hand-made' } }],
      '2026-10-09',
    );
    expect(clash.changes.removed).toEqual(['Putt Drop']);
    expect(clash.changes.skipped[0]).toMatch(/hand-written entry/);
    expect(clash.data.projects).toEqual([manual]);
  });

  test('summary lists project names only', () => {
    const md = renderSummary({
      added: ['Putt Drop'],
      updated: [],
      released: [],
      removed: [],
      skipped: [],
    });
    expect(md).toContain('- Putt Drop');
    expect(md).toContain('never pushes to main');
  });

  test('templates pass validation', async () => {
    const fs = await import('node:fs/promises');
    for (const f of ['templates/rdwlabz.json', 'templates/putt-drop.rdwlabz.json']) {
      const { errors } = validateEntry(JSON.parse(await fs.readFile(f, 'utf8')), pub);
      expect(errors, f).toBeUndefined();
    }
  });
});
