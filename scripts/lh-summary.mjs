// Prints category scores + LCP/CLS/TBT for each Lighthouse CI run, marking the median run.
import { readFileSync } from 'node:fs';

const dir = '.lighthouseci/reports';
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, 'utf8'));

for (const run of manifest) {
  const lhr = JSON.parse(readFileSync(run.jsonPath, 'utf8'));
  const scores = Object.entries(lhr.categories)
    .map(([k, v]) => `${k}=${Math.round(v.score * 100)}`)
    .join(' ');
  const a = lhr.audits;
  console.log(
    `${run.url}${run.isRepresentativeRun ? ' (median)' : ''}  ${scores}  ` +
      `LCP=${Math.round(a['largest-contentful-paint'].numericValue)}ms ` +
      `TBT=${Math.round(a['total-blocking-time'].numericValue)}ms ` +
      `CLS=${a['cumulative-layout-shift'].numericValue.toFixed(3)}`,
  );
}
