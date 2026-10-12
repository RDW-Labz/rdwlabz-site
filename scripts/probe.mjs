// Debug helper: load a URL in headless Chromium and print console errors, page errors and crashes.
// Usage: node scripts/probe.mjs http://localhost:4391/_gallery [width]
import { chromium } from '@playwright/test';

const [url, width = '1440'] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
page.on(
  'console',
  (m) => ['error', 'warning'].includes(m.type()) && console.log(`[${m.type()}]`, m.text()),
);
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('crash', () => console.log('[crash]'));
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url(), r.failure()?.errorText));
await page.goto(url, { waitUntil: 'networkidle' });
console.log('height', await page.evaluate(() => document.body.scrollHeight));
await page.waitForTimeout(1500);
console.log('ok');
await browser.close();
