// Full-resolution crops for design review.
// Usage: node scripts/crop.mjs <url> <out.png> <width> <y> <height>
import { chromium } from '@playwright/test';

const [url, out, width = '1440', y = '0', height = '900'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() =>
  document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-revealed')),
);
await page.waitForTimeout(1200);
await page.screenshot({
  path: out,
  fullPage: true,
  animations: 'disabled',
  clip: { x: 0, y: Number(y), width: Number(width), height: Number(height) },
});
await browser.close();
