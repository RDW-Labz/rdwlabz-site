// Image helpers for the showcase: size-capped WebP encoding, a perceptual diff (so a refresh only
// commits images that changed visibly) and the 1200x630 browser-mockup OG card.
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

export const MAX_BYTES = 400 * 1024;
/** WebP can't go past 16383 px on a side. */
const WEBP_MAX = 16383;

/**
 * Encode to WebP under `maxBytes`: lower the quality first, then shrink in 15% steps.
 * @returns {Promise<{ buf: Buffer, width: number, height: number }>}
 */
export async function encodeWebp(input, { maxBytes = MAX_BYTES, width } = {}) {
  const meta = await sharp(input).metadata();
  let w = Math.min(width ?? meta.width, meta.width);
  const fit = Math.min(1, WEBP_MAX / Math.max(w, (meta.height * w) / meta.width));
  w = Math.floor(w * fit);
  for (let step = 0; step < 12; step++) {
    for (const quality of [82, 72, 62, 52]) {
      const { data, info } = await sharp(input)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality, effort: 5, smartSubsample: true })
        .toBuffer({ resolveWithObject: true });
      if (data.length <= maxBytes) return { buf: data, width: info.width, height: info.height };
    }
    w = Math.floor(w * 0.85);
  }
  throw new Error(`could not get the image under ${Math.round(maxBytes / 1024)} KB`);
}

/**
 * Share of pixels that differ visibly between two images (0..1). Both are scaled to 320 px wide,
 * greyscaled and lightly blurred, so encoder noise and sub-pixel font rendering don't count; a
 * pixel counts as changed when its brightness moves more than 32/255. A different aspect ratio
 * (page got taller or shorter by > 2%) counts as fully changed.
 */
export async function diffRatio(a, b) {
  const [ma, mb] = await Promise.all([sharp(a).metadata(), sharp(b).metadata()]);
  const ra = ma.height / ma.width;
  const rb = mb.height / mb.width;
  if (Math.abs(ra - rb) / ra > 0.02) return 1;
  const width = 320;
  const height = Math.max(1, Math.round(width * ra));
  const px = (img) =>
    sharp(img).resize(width, height, { fit: 'fill' }).greyscale().blur(1).raw().toBuffer();
  const [pa, pb] = await Promise.all([px(a), px(b)]);
  let changed = 0;
  for (let i = 0; i < pa.length; i++) if (Math.abs(pa[i] - pb[i]) > 32) changed++;
  return changed / pa.length;
}

const esc = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** HTML for the OG card: the desktop shot in a browser frame on the brand paper, in brand colors. */
export function ogHtml({ name, address, shot, fontPath }) {
  const font = readFileSync(fontPath).toString('base64');
  const img = `data:image/webp;base64,${shot.toString('base64')}`;
  return `<!doctype html><html><head><style>
  @font-face { font-family: Bagel; src: url(data:font/woff2;base64,${font}) format('woff2'); }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; }
  body { background: #fff6ea; font-family: system-ui, sans-serif; color: #1e1433;
    display: grid; grid-template-columns: 330px 1fr; align-items: center; gap: 36px; padding: 0 0 0 64px; }
  .copy { display: grid; gap: 18px; }
  .lab { font: 700 20px/1 system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #d4321a; }
  h1 { font: 400 64px/1.02 Bagel, system-ui, sans-serif; overflow-wrap: anywhere; }
  .brand { font: 700 22px/1 system-ui, sans-serif; color: #544a6b; }
  .win { width: 820px; border: 4px solid #1e1433; border-radius: 22px 0 0 22px; border-right: 0;
    background: #fff; box-shadow: -10px 12px 0 #ff4d2e; overflow: hidden; translate: 0 6px; }
  .bar { display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 18px;
    background: #ffe7c7; border-bottom: 4px solid #1e1433; }
  .dot { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #1e1433; }
  .url { flex: 1; margin-left: 14px; height: 30px; border-radius: 15px; background: #fff;
    border: 2px solid #1e1433; font: 600 16px/26px system-ui, sans-serif; padding: 0 14px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .shot { display: block; width: 100%; height: 470px; object-fit: cover; object-position: top left; }
  </style></head><body>
  <div class="copy"><p class="lab">Web project</p><h1>${esc(name)}</h1><p class="brand">RDW Labz</p></div>
  <div class="win"><div class="bar"><span class="dot" style="background:#ff4d2e"></span><span class="dot" style="background:#ffc23d"></span><span class="dot" style="background:#16b67e"></span><span class="url">${esc(address)}</span></div>
  <img class="shot" src="${img}" alt=""></div>
  </body></html>`;
}
