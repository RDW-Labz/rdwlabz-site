// Core screenshot pipeline for the web-projects showcase, shared by capture-showcase.mjs (live
// public sites) and capture-private.mjs (a local run of a private app with fake seed data).
//
// Per site: desktop 1440x900 @2x and mobile 390x844 @3x, each above the fold and full page.
// Waits for network idle and fonts, declines cookie banners, hides chat widgets, and refuses to
// save anything if the page is an error, a login wall, or shows personal data.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findPersonalData, pageProblem } from './checks.mjs';
import { diffRatio, encodeWebp, ogHtml } from './images.mjs';

export const OUT_DIR = 'public/showcase';
export const SHOTS_JSON = 'src/data/showcase-shots.json';
export const FONT = 'src/assets/fonts/BagelFatOne-Latin.woff2';
/** A refresh only replaces a site's images when one differs visibly by more than this. */
export const CHANGE_THRESHOLD = 0.02;
/** Full-page shots stop here (CSS px) so very long pages stay legible under 400 KB. */
const FULL_MAX_CSS_HEIGHT = 9000;

export const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, scale: 2, mobile: false },
  { name: 'mobile', width: 390, height: 844, scale: 3, mobile: true },
];
/** The four shots compared for change; card and OG images are derived from `desktop`. */
const PRIMARY = ['desktop', 'desktop-full', 'mobile', 'mobile-full'];

export class CaptureError extends Error {}

const CONSENT_CONTAINERS = [
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="consent" i]',
  '[class*="consent" i]',
  '[id*="gdpr" i]',
  '[class*="gdpr" i]',
  '[aria-label*="cookie" i]',
  '[aria-label*="consent" i]',
  '#onetrust-banner-sdk',
  '#CybotCookiebotDialog',
  '#usercentrics-root',
  '.cc-window',
  '.fc-consent-root',
].join(',');
const DECLINE =
  /^\s*(?:decline(?: all)?|reject(?: all)?|deny(?: all)?|refuse(?: all)?|(?:only )?necessary(?: (?:cookies )?only)?|essential(?: cookies)? only|use necessary cookies only|no,? thanks|close|dismiss|got it|×|✕)\s*$/i;
/** Known cookie banners that may survive a click (or have no decline button): hide them. */
const CONSENT_HIDE = [
  '#onetrust-consent-sdk',
  '#CybotCookiebotDialog',
  '#usercentrics-root',
  '.cc-window',
  '.fc-consent-root',
  '#cookie-law-info-bar',
  '.cky-consent-container',
  '#cmplz-cookiebanner-container',
  '#truste-consent-track',
];
const CHAT_HIDE = [
  '#intercom-container',
  '.intercom-lightweight-app',
  'iframe[src*="intercom"]',
  '#crisp-chatbox',
  '.crisp-client',
  '#drift-widget',
  '#drift-frame-controller',
  '#drift-frame-chat',
  '#hubspot-messages-iframe-container',
  '#tawkchat-container',
  'iframe[src*="tawk.to"]',
  'iframe#launcher',
  '#launcher',
  'iframe[title*="messaging" i]',
  'iframe[title*="chat" i]',
  '[id^="tidio"]',
  '#chat-widget-container',
  '.fb_dialog',
  '.fb-customerchat',
  '[class*="chat-widget" i]',
  '[id*="chat-widget" i]',
  '#gorgias-chat-container',
  '.zsiq_floatmain',
];

const settle = async (page, ms) => {
  await page.waitForLoadState('networkidle', { timeout: ms }).catch(() => {});
};

async function dismissConsent(page, log) {
  for (const frame of page.frames()) {
    const scoped = frame
      .locator(CONSENT_CONTAINERS)
      .locator('button, a, [role="button"], input[type="button"]');
    const anywhere = frame.getByRole('button', {
      name: /^(?:reject|decline|deny|refuse)(?: all)?$/i,
    });
    for (const candidates of [anywhere, scoped]) {
      const n = Math.min(await candidates.count().catch(() => 0), 60);
      for (let i = 0; i < n; i++) {
        const el = candidates.nth(i);
        const label = (
          (await el.innerText().catch(() => '')) ||
          (await el.getAttribute('aria-label').catch(() => '')) ||
          (await el.getAttribute('value').catch(() => '')) ||
          ''
        ).trim();
        if (!DECLINE.test(label) || !(await el.isVisible().catch(() => false))) continue;
        await el.click({ timeout: 3000 }).catch(() => {});
        log(`  declined cookie banner ("${label}")`);
        await page.waitForTimeout(600);
        return;
      }
    }
  }
}

/** Runs in the page: visible text inside [top, bottom) in page coordinates, one line per node. */
function visibleTextIn([top, bottom]) {
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent?.trim();
    const el = n.parentElement;
    if (!text || !el || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
      continue;
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    const y = r.top + window.scrollY;
    if (r.width > 0 && r.height > 0 && y < bottom && y + r.height > top) out.push(text);
  }
  for (const el of document.querySelectorAll('input, textarea, select')) {
    const v = /** @type {HTMLInputElement} */ (el).value;
    if (v && el.checkVisibility()) out.push(v);
  }
  return out.join('\n');
}

async function shootViewport(browser, url, vp, allow, log) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.scale,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'America/Chicago',
  });
  const page = await context.newPage();
  try {
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    } catch (err) {
      throw new CaptureError(`${vp.name}: could not load (${err.message.split('\n')[0]})`);
    }
    await settle(page, 20_000);
    await page.evaluate(() => document.fonts.ready);
    await dismissConsent(page, log);
    await page.addStyleTag({
      content: `${[...CONSENT_HIDE, ...CHAT_HIDE].join(',')}{display:none!important}
        html{scroll-behavior:auto!important}`,
    });

    const info = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      headings: [...document.querySelectorAll('h1')].map((h) => h.textContent?.trim() ?? ''),
      passwordFields: [...document.querySelectorAll('input[type="password"]')].filter((el) =>
        el.checkVisibility(),
      ).length,
      bodyText: document.body?.innerText ?? '',
    }));
    const problem = pageProblem({ status: response?.status() ?? 0, ...info });
    if (problem) throw new CaptureError(`${vp.name}: ${problem}`);

    // Above the fold.
    const foldText = await page.evaluate(visibleTextIn, [0, vp.height]);
    const foldPii = findPersonalData(foldText, allow);
    if (foldPii.length)
      throw new CaptureError(`${vp.name}: personal data in shot: ${foldPii.map((p) => p.value)}`);
    const fold = await page.screenshot({ type: 'png' });

    // Full page: scroll through once so lazy images and reveal-on-scroll content load.
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < Math.min(total, FULL_MAX_CSS_HEIGHT); y += vp.height * 0.8) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, 8_000);
    await page.evaluate(() => document.fonts.ready);
    const height = Math.min(
      await page.evaluate(() => document.documentElement.scrollHeight),
      FULL_MAX_CSS_HEIGHT,
    );
    const fullText = await page.evaluate(visibleTextIn, [0, height]);
    const fullPii = findPersonalData(fullText, allow);
    if (fullPii.length)
      throw new CaptureError(
        `${vp.name}-full: personal data in shot: ${fullPii.map((p) => p.value)}`,
      );
    const full = await page.screenshot({
      type: 'png',
      fullPage: true,
      clip: { x: 0, y: 0, width: vp.width, height },
    });
    return { fold, full };
  } finally {
    await context.close();
  }
}

export function readShots() {
  return existsSync(SHOTS_JSON) ? JSON.parse(readFileSync(SHOTS_JSON, 'utf8')) : {};
}

export function writeShots(shots) {
  const sorted = Object.fromEntries(Object.entries(shots).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(SHOTS_JSON, `${JSON.stringify(sorted, null, 2)}\n`);
}

/**
 * Capture one site. Writes nothing unless every shot passed the checks AND (with `force`, or when
 * images are missing, or when one primary shot differs by more than CHANGE_THRESHOLD).
 * @param {{ browser: import('playwright').Browser, slug: string, name: string, url: string,
 *   address: string, allow?: string[], force?: boolean, log?: (m: string) => void }} o
 *   `address` is what the OG card's URL bar shows.
 * @returns {Promise<{ changed: boolean, diffs: Record<string, number> }>}
 */
export async function captureSite({
  browser,
  slug,
  name,
  url,
  address,
  allow = [],
  force = false,
  log = console.log,
}) {
  const dir = join(OUT_DIR, slug);
  const files = {};
  for (const vp of VIEWPORTS) {
    log(`  ${vp.name} ${vp.width}x${vp.height} @${vp.scale}x`);
    const { fold, full } = await shootViewport(browser, url, vp, allow, log);
    files[vp.name] = await encodeWebp(fold);
    files[`${vp.name}-full`] = await encodeWebp(full);
  }

  const diffs = {};
  for (const key of PRIMARY) {
    const old = join(dir, `${key}.webp`);
    diffs[key] = existsSync(old) ? await diffRatio(readFileSync(old), files[key].buf) : 1;
  }
  const changed = force || Object.values(diffs).some((d) => d > CHANGE_THRESHOLD);
  const pct = Object.entries(diffs).map(([k, d]) => `${k} ${(d * 100).toFixed(1)}%`);
  log(`  visible change: ${pct.join(', ')}${changed ? '' : ' (kept the old images)'}`);
  if (!changed) return { changed, diffs };

  for (const width of [640, 1280]) {
    files[`card-${width}`] = await encodeWebp(files.desktop.buf, { width, maxBytes: 150 * 1024 });
  }
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  try {
    await page.setContent(ogHtml({ name, address, shot: files['card-1280'].buf, fontPath: FONT }), {
      waitUntil: 'load',
    });
    await page.evaluate(() => document.fonts.ready);
    files.og = await encodeWebp(await page.screenshot({ type: 'png' }));
  } finally {
    await page.close();
  }

  mkdirSync(dir, { recursive: true });
  const meta = {};
  for (const [key, f] of Object.entries(files)) {
    writeFileSync(join(dir, `${key}.webp`), f.buf);
    meta[key] = { width: f.width, height: f.height, bytes: f.buf.length };
  }
  const shots = readShots();
  shots[slug] = { captured: new Date().toISOString().slice(0, 10), files: meta };
  writeShots(shots);
  return { changed, diffs };
}
