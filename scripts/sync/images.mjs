// Icon/art optimisation and accent color. Pure color helpers are exported for tests.
import sharp from 'sharp';

const INK = [30, 20, 51]; // --color-ink #1e1433

export const toHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
export const fromHex = (h) =>
  h
    .replace('#', '')
    .match(/../g)
    .map((x) => parseInt(x, 16));
const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a, b) => {
  const [x, y] = [lum(fromHex(a)), lum(fromHex(b))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/**
 * Signature color of an icon's RGBA pixels: among colors covering at least 8% of the opaque
 * pixels, the most vivid one (so a bright logo beats a dark or white background). Falls back
 * to the most common color for greyscale icons.
 * @param {Uint8Array} rgba
 */
export function dominantColor(rgba) {
  const buckets = new Map();
  let total = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bkt = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bkt.r += r;
    bkt.g += g;
    bkt.b += b;
    bkt.n++;
    buckets.set(key, bkt);
    total++;
  }
  if (!total) return null;
  const colors = [...buckets.values()].map((k) => {
    const c = [k.r / k.n, k.g / k.n, k.b / k.n];
    const max = Math.max(...c);
    const min = Math.min(...c);
    const chroma = max === 0 ? 0 : ((max - min) / max) * (max / 255);
    return { c, share: k.n / total, chroma };
  });
  const vivid = colors.filter((x) => x.share >= 0.08 && x.chroma >= 0.15);
  const best = vivid.length
    ? vivid.sort((a, b) => Math.sqrt(b.share) * b.chroma - Math.sqrt(a.share) * a.chroma)[0]
    : colors.sort((a, b) => b.share - a.share)[0];
  return toHex(best.c);
}

/**
 * Darken toward ink until white text/icons on it pass AA (≥ 4.5:1). The site puts white
 * icons and the ink-outlined sticker on the accent, so this keeps every use readable.
 */
export function accessibleAccent(hex, min = 4.5) {
  if (!hex) return null;
  const c = fromHex(hex);
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const mixed = toHex(c.map((v, i) => v + (INK[i] - v) * t));
    if (contrast(mixed, '#ffffff') >= min) return mixed;
  }
  return toHex(INK);
}

/** 256×256 WebP app icon + accent color. Rejects anything that isn't a decodable image. */
export async function processIcon(buf) {
  const img = sharp(buf, { limitInputPixels: 40_000_000, density: 300 }).rotate();
  const webp = await img
    .clone()
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();
  const raw = await img.clone().resize(32, 32, { fit: 'cover' }).ensureAlpha().raw().toBuffer();
  return { webp, accent: accessibleAccent(dominantColor(raw)) };
}

/** 800×500 (16:10) WebP card art, e.g. a Steam header image. */
export async function processArt(buf) {
  const img = sharp(buf, { limitInputPixels: 40_000_000 }).rotate();
  const webp = await img
    .clone()
    .resize(800, 500, { fit: 'cover' })
    .webp({ quality: 80, effort: 5 })
    .toBuffer();
  const raw = await img.clone().resize(32, 32, { fit: 'cover' }).ensureAlpha().raw().toBuffer();
  return { webp, accent: accessibleAccent(dominantColor(raw)) };
}
