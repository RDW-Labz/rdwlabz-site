// Motion + reliability probe against a running preview.
// - Captures mid-transition frames of Home → Projects (animations slowed to 10% via CDP)
// - Navigates back and forth N times and checks document listener counts stay flat (no leaks)
// - Checks the hero loop pauses when scrolled offscreen and resumes on return
// - Checks CLS on Home via PerformanceObserver
// Usage: node scripts/motion-check.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';

const [base = 'http://localhost:4392', out = '/tmp/motion'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const cdp = await page.context().newCDPSession(page);

await page.addInitScript(() => {
  window.__cls = 0;
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
});

await page.goto(`${base}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
const cls = await page.evaluate(() => window.__cls);

// Loop pause offscreen
const pausedAtTop = await page.locator('.bench').getAttribute('data-paused');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
const pausedBottom = await page.locator('.bench').getAttribute('data-paused');
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(400);
const pausedBack = await page.locator('.bench').getAttribute('data-paused');

// Mid-transition frames
await cdp.send('Animation.enable');
await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.1 });
const click = page.locator('header nav[aria-label="Main"] a[href="/projects"]').click();
await page.waitForTimeout(900);
await page.screenshot({
  path: `${out}/vt-mid-1.png`,
  clip: { x: 0, y: 0, width: 1440, height: 600 },
});
await page.waitForTimeout(1600);
await page.screenshot({
  path: `${out}/vt-mid-2.png`,
  clip: { x: 0, y: 0, width: 1440, height: 600 },
});
await click;
await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
await page.waitForURL(/\/projects$/);
await page.waitForTimeout(800);

// Listener leak check across route changes
const countListeners = async () => {
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'document' });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
    objectId: result.objectId,
  });
  return listeners.length;
};
const counts = [];
for (let i = 0; i < 8; i++) {
  await page.locator('header nav[aria-label="Main"] a[href="/"]').click();
  await page.waitForURL(`${base}/`);
  await page.waitForTimeout(300);
  await page.locator('header nav[aria-label="Main"] a[href="/projects"]').click();
  await page.waitForURL(/\/projects$/);
  await page.waitForTimeout(300);
  counts.push(await countListeners());
}
// Filters still work after many swaps (immediately, and after settling)
await page.locator('[data-filter="games"]').click();
await page.waitForTimeout(700);
const filterImmediate = await page.locator('[data-filter="games"]').getAttribute('aria-pressed');
const urlImmediate = page.url();
await page.waitForTimeout(500);
await page.locator('[data-filter="mods"]').click();
await page.waitForTimeout(200);
const filterOk =
  (await page.locator('[data-filter="mods"]').getAttribute('aria-pressed')) === 'true';
console.log({ filterImmediate, urlImmediate });

console.log(
  JSON.stringify(
    { cls, pausedAtTop, pausedBottom, pausedBack, listenerCounts: counts, filterOk, errors },
    null,
    1,
  ),
);
await browser.close();
