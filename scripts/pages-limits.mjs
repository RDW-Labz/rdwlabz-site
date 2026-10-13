// Fails the build if the output wouldn't deploy to Cloudflare Pages: at most 20,000 files and
// 25 MiB per file (https://developers.cloudflare.com/pages/platform/limits/). Warns at 80%.
// Usage: node scripts/pages-limits.mjs [dist]
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const MAX_FILES = 20_000;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** @returns {{ files: number, biggest: { path: string, bytes: number } | null, problems: string[], warnings: string[] }} */
export function checkPagesLimits(dir) {
  let files = 0;
  let biggest = null;
  const problems = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        files++;
        const bytes = statSync(p).size;
        if (!biggest || bytes > biggest.bytes) biggest = { path: relative(dir, p), bytes };
        if (bytes > MAX_FILE_BYTES)
          problems.push(
            `${relative(dir, p)} is ${(bytes / 1048576).toFixed(1)} MiB (limit 25 MiB)`,
          );
      }
    }
  };
  walk(dir);
  if (files > MAX_FILES) problems.push(`${files} files (limit ${MAX_FILES})`);
  const warnings = [];
  if (files > MAX_FILES * 0.8) warnings.push(`${files} files, over 80% of the ${MAX_FILES} limit`);
  if (biggest && biggest.bytes > MAX_FILE_BYTES * 0.8)
    warnings.push(`${biggest.path} is over 80% of the 25 MiB file limit`);
  return { files, biggest, problems, warnings };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const dir = process.argv[2] ?? 'dist';
  const r = checkPagesLimits(dir);
  for (const w of r.warnings) console.warn(`pages-limits: warning: ${w}`);
  if (r.problems.length) {
    for (const p of r.problems) console.error(`pages-limits: ${p}`);
    process.exit(1);
  }
  console.log(
    `pages-limits: OK, ${r.files} files, largest ${r.biggest?.path} (${((r.biggest?.bytes ?? 0) / 1048576).toFixed(2)} MiB)`,
  );
}
