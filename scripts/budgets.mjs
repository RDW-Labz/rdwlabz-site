// Measures shipped weight per page from dist/: JS (gzip), CSS (gzip), fonts (raw woff2), HTML.
// Budgets (BUILD-SPEC §12): JS ≤ 60 KB gz/page, fonts ≤ 2 families / ≤ 120 KB, hero media ≤ 200 KB.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const dist = 'dist';
const gz = (p) => gzipSync(readFileSync(p)).length;
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

const pages = readdirSync(dist).filter((f) => f.endsWith('.html'));
let fail = false;

for (const page of pages) {
  const html = readFileSync(join(dist, page), 'utf8');
  const scripts = new Set();
  // Entry modules + their static imports.
  const queue = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const m of html.matchAll(/import\s*["']([^"']+\.js)["']/g)) queue.push(m[1]);
  for (const m of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
    for (const i of m[1].matchAll(/from\s*["']([^"']+\.js)["']|import\s*["']([^"']+\.js)["']/g))
      queue.push(i[1] ?? i[2]);
  }
  while (queue.length) {
    const src = queue.shift();
    if (!src.startsWith('/') || scripts.has(src)) continue;
    const p = join(dist, src);
    if (!existsSync(p)) continue;
    scripts.add(src);
    const code = readFileSync(p, 'utf8');
    for (const i of code.matchAll(/(?:from|import)\s*["'](\.\/[^"']+\.js)["']/g)) {
      queue.push(join(src, '..', i[1]));
    }
  }
  const inlineJs = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .join('');
  const jsGz =
    [...scripts].reduce((s, src) => s + gz(join(dist, src)), 0) + gzipSync(inlineJs).length;
  const css = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((m) => m[1]);
  const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1])
    .join('');
  const cssGz = css.reduce((s, c) => s + gz(join(dist, c)), 0) + gzipSync(inlineCss).length;
  const fonts = new Set(
    [...html.matchAll(/url\("?(\/_astro\/fonts\/[^")]+)"?\)/g)].map((m) => m[1]),
  );
  const fontBytes = [...fonts].reduce((s, f) => s + statSync(join(dist, f)).size, 0);
  const families = new Set(
    [...html.matchAll(/font-family:\s*"?([^";,]+?)-[0-9a-f]{16}"?[;}]/g)].map((m) => m[1]),
  );
  const ok = jsGz <= 60 * 1024 && fontBytes <= 120 * 1024 && families.size <= 2;
  if (!ok) fail = true;
  console.log(
    `${ok ? 'OK  ' : 'OVER'} ${page.padEnd(14)} JS ${kb(jsGz).padStart(8)} gz (${scripts.size} files) · CSS ${kb(cssGz).padStart(8)} gz · fonts ${kb(fontBytes).padStart(8)} (${fonts.size} files, ${families.size} families: ${[...families].join(', ')}) · HTML ${kb(gz(join(dist, page)))} gz`,
  );
}
process.exit(fail ? 1 : 0);
