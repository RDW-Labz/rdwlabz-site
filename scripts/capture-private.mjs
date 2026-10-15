// Screenshot a private build for the showcase from a LOCAL run of the app with FAKE seed data.
// Usage: node scripts/capture-private.mjs --slug <slug> --url http://localhost:3000/ --seed-data-only
// The slug must be a `"private": true` entry in src/data/showcase.json. Only localhost / LAN URLs
// are accepted, the same error/login/personal-data checks run (with no allowed contact details),
// and the images land in public/showcase/<slug>/ to be reviewed and committed by hand.
// Never copies code from the private repo and never records where the app runs. See docs/SHOWCASE.md.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { isLocalUrl, validateShowcase } from './showcase/checks.mjs';
import { captureSite } from './showcase/capture.mjs';

const { values: args } = parseArgs({
  options: {
    slug: { type: 'string' },
    url: { type: 'string' },
    'seed-data-only': { type: 'boolean', default: false },
    force: { type: 'boolean', default: true },
  },
});

const fail = (msg) => {
  console.error(`capture-private: ${msg}`);
  process.exit(1);
};
if (!args.slug || !args.url) fail('needs --slug <slug> --url <local url> --seed-data-only');
if (!isLocalUrl(args.url))
  fail(`${args.url} is not a local URL. Run the app on this machine with fake seed data.`);
if (!args['seed-data-only'])
  fail('pass --seed-data-only to confirm the app is running on fake seed data, not real users');

const data = JSON.parse(readFileSync('src/data/showcase.json', 'utf8'));
const problems = validateShowcase(data);
if (problems.length) fail(`showcase.json is invalid:\n- ${problems.join('\n- ')}`);
const entry = data.find((e) => e.slug === args.slug);
if (!entry) fail(`no "${args.slug}" entry in src/data/showcase.json`);
if (!entry.private) fail(`"${args.slug}" is not private; public sites use capture-showcase.mjs`);

const browser = await chromium.launch();
try {
  await captureSite({
    browser,
    slug: entry.slug,
    name: entry.name,
    url: args.url,
    address: 'Private build',
    allow: [],
    force: args.force,
  });
  console.log(`Saved public/showcase/${entry.slug}/. Look at every image before committing.`);
} catch (err) {
  fail(err.message);
} finally {
  await browser.close();
}
