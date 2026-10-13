import type { Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeCategories, allProjects, buildPhrase, categories, site } from '../src/lib/projects';

/** Measure final colors, not mid-fade: finish reveals, entrance animations and transitions. */
export async function settleMotion(page: Page) {
  await page.addStyleTag({ content: '*{transition:none!important}' });
  await page.evaluate(() => {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed'));
    document.getAnimations().forEach((a) => {
      if (a.effect?.getTiming().iterations !== Infinity) a.finish();
    });
  });
}

/** What the site should show, computed from the same data the build uses. */
export const shelf = {
  active: activeCategories.map((c) => c.id),
  activeLabels: activeCategories.map((c) => c.label),
  hidden: categories.filter((c) => !activeCategories.includes(c)).map((c) => c.id),
  projects: allProjects(),
  phrase: buildPhrase,
  site,
};

/**
 * `astro build` into outDir with extra env (fixture data). Builds share .astro/.prerender, so
 * parallel workers take turns through a lock directory (a stale lock expires after 5 min).
 */
export function astroBuild(outDir: string, env: Record<string, string>) {
  const lock = join(tmpdir(), 'rdwlabz-astro-build.lock');
  const until = Date.now() + 300_000;
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      try {
        if (Date.now() - statSync(lock).mtimeMs > 300_000) rmSync(lock, { recursive: true });
      } catch {
        /* released meanwhile */
      }
      if (Date.now() > until) throw new Error('timed out waiting for another fixture build');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  try {
    execFileSync('npx', ['astro', 'build', '--outDir', outDir], {
      env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', ...env },
      stdio: 'pipe',
    });
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
