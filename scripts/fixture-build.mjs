// Build the site with test data to check extremes, then ALWAYS restore the real projects.json.
// Usage: node scripts/fixture-build.mjs <one|twenty>   → output in dist/ (then `astro preview`)
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const kind = process.argv[2] ?? 'twenty';
const file = 'src/data/projects.json';
const original = readFileSync(file, 'utf8');
const data = JSON.parse(original);
const cats = ['software', 'games', 'mods', 'asset-packs'];
const statuses = ['released', 'in-dev', 'coming-soon'];

const make = (i, over = {}) => ({
  slug: `fixture-${i}`,
  name: `Fixture project ${i}`,
  oneLiner: `Fixture one-liner number ${i}.`,
  category: cats[i % 4],
  status: statuses[i % 3],
  platforms: i % 2 ? ['Windows', 'Linux'] : [],
  url: i % 3 === 0 ? 'https://example.com' : null,
  accentColor:
    i % 5 === 0 ? 'TODO' : ['#3d7bff', '#ff4d2e', '#16b67e', '#b04cf0', '#f59e0b'][i % 5],
  image: null,
  featured: i < 4,
  ...over,
});

if (kind === 'one') {
  data.projects = [make(1, { category: 'games', featured: true })];
} else {
  data.projects = Array.from({ length: 20 }, (_, i) =>
    i === 2
      ? make(i, {
          name: 'Supercalifragilisticexpialidocious-Mega-Toolkit Deluxe Edition With An Extremely Long Name',
          oneLiner:
            'An intentionally very long one-liner that keeps going well past what any sane blurb should be, to make sure wrapping, spacing and the action button all stay tidy inside the card.',
          platforms: ['Windows', 'macOS', 'Linux', 'Steam Deck', 'Web', 'Android', 'iOS', 'Switch'],
        })
      : make(i, i >= 16 ? { category: 'games' } : {}),
  );
  // Leave "asset-packs" empty to exercise the empty state.
  data.projects = data.projects.map((p) =>
    p.category === 'asset-packs' ? { ...p, category: 'software' } : p,
  );
}

try {
  writeFileSync(file, JSON.stringify(data, null, 2));
  execSync('npx astro build', {
    stdio: 'inherit',
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
} finally {
  writeFileSync(file, original);
  console.log('restored', file);
}
