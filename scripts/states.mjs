// Captures interactive states for review: open mobile menu, keyboard focus, filtered projects.
// Usage: node scripts/states.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';

const [base = 'http://localhost:4392', out = '/tmp/states'] = process.argv.slice(2);
const browser = await chromium.launch();

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mobile.goto(`${base}/`);
await mobile.locator('[data-menu-toggle]').click();
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: `${out}/menu-open-390.png` });
await mobile.goto(`${base}/projects?c=games`);
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: `${out}/projects-games-390.png` });

const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desk.goto(`${base}/`);
for (let i = 0; i < 6; i++) await desk.keyboard.press('Tab');
await desk.waitForTimeout(300);
await desk.screenshot({
  path: `${out}/focus-1440.png`,
  clip: { x: 0, y: 0, width: 1440, height: 700 },
});
await desk.goto(`${base}/projects`);
for (let i = 0; i < 6; i++) await desk.keyboard.press('Tab');
await desk.waitForTimeout(300);
await desk.screenshot({
  path: `${out}/focus-chip-1440.png`,
  clip: { x: 0, y: 300, width: 1440, height: 300 },
});

await browser.close();
