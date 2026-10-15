// Re-capture screenshots of every public site in src/data/showcase.json.
// Usage: node scripts/capture-showcase.mjs [--only <slug>] [--force] [--summary <file.md>]
// Writes public/showcase/<slug>/*.webp and src/data/showcase-shots.json, but only for sites whose
// images changed visibly (> 2%), unless --force. Private entries are skipped (see
// capture-private.mjs and docs/SHOWCASE.md). Exits 1 if any site fails a check (error page, login
// wall, personal data): that site keeps its old images and the failure is listed.
import { chromium } from '@playwright/test';
import { existsSync, readFileSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { validateShowcase } from './showcase/checks.mjs';
import { OUT_DIR, captureSite, readShots, writeShots } from './showcase/capture.mjs';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    force: { type: 'boolean', default: false },
    summary: { type: 'string' },
  },
});

const data = JSON.parse(readFileSync('src/data/showcase.json', 'utf8'));
const problems = validateShowcase(data);
if (problems.length) {
  console.error(`showcase.json is invalid:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

// Images for sites no longer listed go away; private builds' images are captured by hand, so stay.
const listed = new Set(data.map((e) => e.slug));
const removed = [];
if (!args.only && existsSync(OUT_DIR)) {
  for (const slug of readdirSync(OUT_DIR)) {
    if (!listed.has(slug)) {
      rmSync(join(OUT_DIR, slug), { recursive: true, force: true });
      removed.push(slug);
    }
  }
  const shots = readShots();
  for (const slug of Object.keys(shots)) if (!listed.has(slug)) delete shots[slug];
  writeShots(shots);
}

const targets = data.filter((e) => !e.private && (!args.only || e.slug === args.only));
const results = [];
const browser = await chromium.launch();
try {
  for (const e of targets) {
    console.log(`${e.slug}: ${e.url}`);
    try {
      const r = await captureSite({
        browser,
        slug: e.slug,
        name: e.name,
        url: e.url,
        address: new URL(e.url).host,
        allow: e.publicContact ?? [],
        force: args.force,
      });
      results.push({ slug: e.slug, ...r });
    } catch (err) {
      console.error(`::error::${e.slug}: ${err.message}`);
      results.push({ slug: e.slug, error: err.message });
    }
  }
} finally {
  await browser.close();
}

const pct = (d) => `${(d * 100).toFixed(1)}%`;
const lines = ['## Showcase refresh', ''];
for (const r of results) {
  if (r.error) lines.push(`- **${r.slug}: FAILED**: ${r.error} (old images kept)`);
  else {
    const worst = Math.max(...Object.values(r.diffs));
    lines.push(
      `- ${r.slug}: ${r.changed ? 'updated' : 'unchanged'} (largest change ${pct(worst)})`,
    );
  }
}
for (const slug of removed) lines.push(`- ${slug}: removed (no longer in showcase.json)`);
if (args.summary) writeFileSync(args.summary, `${lines.join('\n')}\n`);
console.log(`\n${lines.join('\n')}`);
if (results.some((r) => r.error)) process.exit(1);
