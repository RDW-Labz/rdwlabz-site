import { test } from '@playwright/test';

/**
 * Real rendered screenshots for reviews. Not assertions.
 * SHOTS=studies  → each /_studies direction (needs PW_DEV=1)
 * SHOTS=site     → site pages at 1440 / 768 / 390 (default)
 * SHOT_DIR       → output dir (default docs/screenshots)
 */
test.setTimeout(120_000);

const mode = process.env.SHOTS ?? 'site';
const outDir = process.env.SHOT_DIR ?? 'docs/screenshots';

const widths = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

if (mode === 'studies') {
  for (const study of ['a', 'b', 'c']) {
    for (const vp of ['desktop', 'mobile'] as const) {
      test(`study ${study} ${vp}`, async ({ page }) => {
        await page.setViewportSize(widths[vp]);
        await page.goto('/_studies');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(2200);
        await page
          .locator(`[data-study="${study}"]`)
          .screenshot({ path: `${outDir}/studies/study-${study}-${vp}.png` });
      });
    }
  }
}

if (mode === 'site') {
  const pages = (
    process.env.SHOT_PAGES ??
    '/,/projects,/about,/privacy,/404,/library,/library/medieval-knights,/library/clay-hero-crew'
  ).split(',');
  for (const path of pages) {
    for (const vp of Object.keys(widths) as (keyof typeof widths)[]) {
      test(`page ${path} ${vp}`, async ({ page }) => {
        // The live 3D desktop home is covered by tools/shoot_test.py; a full-page capture of it
        // would wait on a continuously rendering canvas.
        test.skip(path === '/' && vp === 'desktop', '3D home is captured by tools/shoot_test.py');
        await page.setViewportSize(widths[vp]);
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        // Reveal everything that is scroll-triggered so full-page shots show real content.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 400) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(1500);
        const name =
          path === '/' ? 'home' : path.replace(/\//g, '-').replace(/^-/, '').replace(/[?=&]/g, '_');
        await page.screenshot({ path: `${outDir}/${name}-${vp}.png`, fullPage: true });
      });
    }
  }
}
