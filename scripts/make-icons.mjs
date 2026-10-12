// Renders favicon PNGs, favicon.ico (PNG-in-ICO) and the Open Graph image from our own SVG mark.
// Usage: node scripts/make-icons.mjs   (needs Playwright Chromium + Google Fonts reachable for
// Figtree). OG copy comes from src/data/projects.json, so rerun it when categories or the
// company change.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { buildPhrase, site } from '../src/lib/projects.ts';

const svg = readFileSync('public/favicon.svg', 'utf8');
const tagline = `We build ${buildPhrase}.`;
const byline = `A brand of ${site.company} · Harrison, AR`;
const bagel = readFileSync('src/assets/fonts/BagelFatOne-Latin.woff2').toString('base64');
const browser = await chromium.launch();

async function renderIcon(size, path, pad = 0, bg = 'transparent') {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<html><body style="margin:0;background:${bg};display:grid;place-items:center;width:${size}px;height:${size}px">
      <div style="width:${size - pad * 2}px;height:${size - pad * 2}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div>
    </body></html>`,
  );
  const buf = await page.screenshot({ omitBackground: bg === 'transparent' });
  writeFileSync(path, buf);
  await page.close();
  return buf;
}

const png32 = await renderIcon(32, 'public/favicon-32.png');
await renderIcon(180, 'public/apple-touch-icon.png', 18, '#fff6ea');
await renderIcon(192, 'public/icon-192.png', 0);
await renderIcon(512, 'public/icon-512.png', 0);

// ICO container with one embedded 32×32 PNG.
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
const entry = Buffer.alloc(16);
entry.writeUInt8(32, 0);
entry.writeUInt8(32, 1);
entry.writeUInt8(0, 2);
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png32.length, 8);
entry.writeUInt32LE(22, 12);
writeFileSync('public/favicon.ico', Buffer.concat([header, entry, png32]));

// Open Graph 1200×630: wordmark on the bench gradient. Text only states verified facts.
const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.setContent(`<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@600&display=block" rel="stylesheet">
<style>
  @font-face{font-family:'Bagel Fat One';src:url(data:font/woff2;base64,${bagel}) format('woff2');font-display:block}
  body{margin:0;width:1200px;height:630px;background:#fff6ea radial-gradient(circle at 1px 1px,rgb(30 20 51/.12) 1px,transparent 0) 0 0/22px 22px;font-family:'Figtree';color:#1e1433;display:grid;place-items:center}
  .card{width:1080px;height:510px;border-radius:56px;border:3px solid #1e1433;box-shadow:0 12px 0 #1e1433;background:linear-gradient(145deg,#ffd77a,#ff8a5c 55%,#ff5fa2);display:flex;align-items:center;gap:56px;padding:0 72px;box-sizing:border-box}
  .mark{width:200px;height:200px;flex:none;border-radius:60px;background:#fff;border:3px solid #1e1433;box-shadow:0 8px 0 #1e1433;display:grid;place-items:center}
  .mark svg{width:150px;height:150px}
  h1{margin:0;font-family:'Bagel Fat One';font-weight:400;font-size:132px;line-height:.9;letter-spacing:-.02em}
  p{margin:22px 0 0;font-size:40px;font-weight:600;line-height:1.15;max-width:15em}
  .by{margin-top:14px;font-size:28px;opacity:.85;max-width:none;white-space:nowrap}
</style></head><body><div class="card"><div class="mark">${svg}</div><div><h1>RDW Labz</h1><p>${tagline}</p><p class="by">${byline}</p></div></div></body></html>`);
await og.evaluate(() => document.fonts.ready);
await og.waitForTimeout(300);
await og.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('icons + og written');
