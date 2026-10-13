// Package free Clay Asset Library packs as zips and upload them to Cloudflare R2.
//
// Usage (from rdwlabz-site, with a clay-asset-packs checkout that has the full files):
//   node scripts/library/upload-r2.mjs --src ../clay-asset-packs \
//     --third-party-license ./Hunyuan3D-2.1-LICENSE.txt [--only <slug>] [--upload] [--write]
//
// Default is a dry run: builds the zips in .tmp/r2/ and prints what it would upload.
//   --upload  runs `npx wrangler r2 object put rdwlabz-assets/<key> --remote` per zip
//             (needs `npx wrangler login` first; see docs/LIBRARY.md).
//   --write   stores `download: { key, bytes, sha256 }` in each pack.json (commit that via a PR
//             in clay-asset-packs; the library sync then shows the Download button).
//
// Only packs with free: true, listed: true and a real license are packaged. Paid packs never go
// in the public bucket. Zips are deterministic (sorted names, fixed timestamps), so an unchanged
// pack keeps the same sha256 and key.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { isTodo, validatePackJson } from './validate.mjs';

export const BUCKET = 'rdwlabz-assets';
const FIXED_TIME = new Date('2026-01-01T00:00:00Z');
const OUT = resolve('.tmp/r2');

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};
const flag = (name) => process.argv.includes(name);

/** Packs that may be published as a free download. */
export const publishable = (p) => p.free === true && p.listed === true && !isTodo(p.license);

/** The model/texture pipeline needs the third-party model license + NOTICE in the zip. */
export const needsThirdPartyLicense = (p) =>
  p.aiGenerated === true && /hunyuan/i.test(p.pipeline ?? '');

export const NOTICE = [
  'Tencent Hunyuan 3D 2.1 is licensed under the Tencent Hunyuan 3D 2.1 Community License',
  'Agreement, Copyright © 2025 Tencent. All Rights Reserved. The trademark rights of',
  '“Tencent Hunyuan” are owned by Tencent or its affiliate.',
].join('\n');

export function licenseFile(p) {
  return [
    `${p.name} — RDW Labz Clay Asset Library`,
    '',
    `License: ${p.license}`,
    '',
    'Provided by RDW, LLC (RDW Labz). Questions: devops@therdw.com',
    p.aiGenerated
      ? '\nThese models are AI-generated. See NOTICE.txt for the third-party model license notice.'
      : '',
  ].join('\n');
}

function zipPack(src, p, thirdPartyLicense) {
  const stage = join(OUT, 'stage', p.slug);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  const names = [];
  const put = (rel, from, text) => {
    const to = join(stage, rel);
    mkdirSync(dirname(to), { recursive: true });
    if (from) copyFileSync(from, to);
    else writeFileSync(to, text);
    utimesSync(to, FIXED_TIME, FIXED_TIME);
    names.push(rel);
  };
  for (const f of p.files) {
    const from = join(src, f.path);
    if (!existsSync(from) || statSync(from).size !== f.bytes) {
      throw new Error(
        `${p.slug}: ${f.path} is missing or its size changed (re-run pack-manifests)`,
      );
    }
    put(f.path, from);
  }
  put('pack.json', join(src, 'packs', p.id, 'pack.json'));
  put('LICENSE.txt', null, licenseFile(p) + '\n');
  if (needsThirdPartyLicense(p)) {
    put('NOTICE.txt', null, NOTICE + '\n');
    put('THIRD-PARTY-LICENSE-Hunyuan3D-2.1.txt', thirdPartyLicense);
  }
  names.sort();
  const zip = join(OUT, `${p.slug}.zip`);
  rmSync(zip, { force: true });
  execFileSync('zip', ['-X', '-D', '-9', '-q', zip, '-@'], { cwd: stage, input: names.join('\n') });
  const buf = readFileSync(zip);
  const sha256 = createHash('sha256').update(buf).digest('hex');
  const key = `packs/${p.slug}/${p.slug}-${sha256.slice(0, 10)}.zip`;
  return { zip, key, bytes: buf.length, sha256 };
}

async function main() {
  const src = arg('--src');
  if (!src || !existsSync(join(src, 'packs'))) {
    throw new Error(
      '--src must point at a clay-asset-packs checkout with packs/, models/, textures/',
    );
  }
  const only = arg('--only');
  const thirdParty = arg('--third-party-license');
  const bucket = arg('--bucket') ?? BUCKET;
  const upload = flag('--upload');
  const write = flag('--write');
  mkdirSync(OUT, { recursive: true });

  const dirs = readdirSync(join(src, 'packs')).filter((d) =>
    existsSync(join(src, 'packs', d, 'pack.json')),
  );
  const packs = dirs.map((d) =>
    JSON.parse(readFileSync(join(src, 'packs', d, 'pack.json'), 'utf8')),
  );
  const chosen = packs.filter((p) => (!only || p.slug === only) && publishable(p));
  const skipped = packs.filter((p) => (!only || p.slug === only) && !publishable(p));
  console.log(
    `${chosen.length} free pack(s) to package; ${skipped.length} skipped (paid, unlisted or unlicensed).`,
  );
  if (!chosen.length) return;

  for (const p of chosen) {
    const errs = validatePackJson(p);
    if (errs.length) throw new Error(`${p.slug}: ${errs.join('; ')}`);
    if (needsThirdPartyLicense(p) && !(thirdParty && existsSync(thirdParty))) {
      throw new Error(
        `${p.slug} was made with Hunyuan3D: pass --third-party-license <copy of the Hunyuan3D 2.1 LICENSE>`,
      );
    }
    const z = zipPack(src, p, thirdParty);
    console.log(`${p.slug}: ${z.key} (${(z.bytes / 1e6).toFixed(1)} MB, sha256 ${z.sha256})`);
    const cmd = [
      'wrangler',
      'r2',
      'object',
      'put',
      `${bucket}/${z.key}`,
      '--file',
      z.zip,
      '--content-type',
      'application/zip',
      '--content-disposition',
      `attachment; filename="${p.slug}.zip"`,
      '--cache-control',
      'public, max-age=31536000, immutable',
      '--remote',
    ];
    if (upload) execFileSync('npx', cmd, { stdio: 'inherit' });
    else
      console.log(`  dry run: npx ${cmd.map((a) => (/[\s;"]/.test(a) ? `'${a}'` : a)).join(' ')}`);
    if (write) {
      const file = join(src, 'packs', p.id, 'pack.json');
      const json = JSON.parse(readFileSync(file, 'utf8'));
      json.download = { key: z.key, bytes: z.bytes, sha256: z.sha256 };
      writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
      console.log(`  wrote download to ${file}`);
    }
  }
  if (!upload) console.log('\nDry run only. Add --upload to send the zips to R2.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
