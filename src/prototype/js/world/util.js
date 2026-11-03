// Screen world: small shared helpers (math, springs, canvas textures, image grades). No dependency on tex.js/computer.js.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIO = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const backOut = (t, s = 1.6) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
export const range = (v, a, b) => clamp((v - a) / (b - a));
export const SRGB = THREE.SRGBColorSpace;

export class Spring {
  constructor(x = 0, k = 120, c = 14) { this.x = x; this.v = 0; this.t = x; this.k = k; this.c = c; }
  step(dt) {
    const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let i = 0; i < n; i++) { const a = -this.k * (this.x - this.t) - this.c * this.v; this.v += a * h; this.x += this.v * h; }
    return this.x;
  }
  snap(v) { this.x = this.t = v; this.v = 0; }
}

export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d', { willReadFrequently: true }); return c; }   // grain + grades read pixels back

export function rr(x, X, Y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}

export function tex(c, { srgb = true, aniso = 8, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = SRGB; t.anisotropy = aniso;
  if (!mip) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}

const imgCache = new Map();
export function loadImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  imgCache.set(src, p); return p;
}

// cover-fit an image into a rect, with an optional focus point and zoom
export function drawCover(x, im, X, Y, w, h, { fx = 0.5, fy = 0.5, zoom = 1 } = {}) {
  if (!im) { x.fillStyle = '#2a2650'; x.fillRect(X, Y, w, h); return; }
  const s = Math.max(w / im.width, h / im.height) * zoom, sw = w / s, sh = h / s;
  const sx = clamp(im.width * fx - sw / 2, 0, im.width - sw), sy = clamp(im.height * fy - sh / 2, 0, im.height - sh);
  x.drawImage(im, sx, sy, sw, sh, X, Y, w, h);
}

export function grain(x, w, h, amt = 10, seed = 3) {
  return;   /* [clean-screen] no baked film grain on in-screen art */
  const r = rng(seed), d = x.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const n = (r() - 0.5) * amt; a[i] += n; a[i + 1] += n; a[i + 2] += n; }
  x.putImageData(d, 0, 0);
}

// colour-grade an image region in place: 'dusk' duotone, 'warm', 'mono', 'crt'
export function grade(x, w, h, kind) {
  const d = x.getImageData(0, 0, w, h), a = d.data;
  const lo = [28, 46, 132], mid = [185, 136, 154], hi = [255, 214, 170];
  for (let i = 0; i < a.length; i += 4) {
    let r = a[i], g = a[i + 1], b = a[i + 2]; const L = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
    if (kind === 'dusk') { const t = L < 0.5 ? L * 2 : (L - 0.5) * 2, A = L < 0.5 ? lo : mid, B = L < 0.5 ? mid : hi; r = lerp(A[0], B[0], t); g = lerp(A[1], B[1], t); b = lerp(A[2], B[2], t); }
    else if (kind === 'warm') { r = r * 1.08 + 10; g = g * 1.0 + 4; b = b * 0.86; }
    else if (kind === 'mono') { const v = Math.pow(L, 0.9) * 255; r = v * 1.04; g = v; b = v * 0.92; }
    a[i] = r; a[i + 1] = g; a[i + 2] = b;
  }
  x.putImageData(d, 0, 0);
  if (kind === 'crt') {
    x.save(); x.globalAlpha = 0.22; x.fillStyle = '#000'; for (let y = 0; y < h; y += 4) x.fillRect(0, y, w, 2); x.restore();
    x.save(); x.globalCompositeOperation = 'multiply'; for (let X = 0; X < w; X += 3) { x.fillStyle = ['#ffd6d6', '#d6ffd6', '#d6d6ff'][(X / 3) % 3]; x.fillRect(X, 0, 1, h); } x.restore();
    const g = x.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
}

export function radialTex(size = 128, inner = 'rgba(0,0,0,.8)', outer = 'rgba(0,0,0,0)', mid = null) {
  const c = canvas(size, size), x = c.getContext('2d'); const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner); if (mid) g.addColorStop(0.45, mid); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, size, size);
  return tex(c, { srgb: false });
}

let _cloudT = null;
export function cloudTex() {
  if (_cloudT) return _cloudT;
  const w = 512, h = 256, c = canvas(w, h), x = c.getContext('2d'), r = rng(19);
  for (let i = 0; i < 70; i++) {
    const cx = w * (0.18 + r() * 0.64), cy = h * (0.42 + (r() - 0.5) * 0.36 * (1 - Math.abs(cx / w - 0.5))), rad = 30 + r() * 60;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  _cloudT = tex(c); return _cloudT;
}

let _clayN = null;
// soft thumb-press / fingerprint normal map for clay surfaces (tileable value noise)
export function clayNormal() {
  if (_clayN) return _clayN;
  const S = 256, hgt = new Float32Array(S * S), r = rng(7);
  const oct = (cells, amp) => { const g = []; for (let i = 0; i < cells * cells; i++) g.push(r()); for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
    const fx = X / S * cells, fy = y / S * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const G = (a, b) => g[((b % cells) * cells + (a % cells))]; hgt[y * S + X] += amp * lerp(lerp(G(ix, iy), G(ix + 1, iy), sx), lerp(G(ix, iy + 1), G(ix + 1, iy + 1), sx), sy); } };
  oct(4, 1); oct(9, 0.5); oct(24, 0.22); oct(64, 0.08);
  const c = canvas(S, S), x = c.getContext('2d'), d = x.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
    const h0 = hgt[y * S + X], hx = hgt[y * S + (X + 1) % S], hy = hgt[((y + 1) % S) * S + X];
    let nx = (h0 - hx) * 3.2, ny = (h0 - hy) * 3.2; const i = (y * S + X) * 4;
    d.data[i] = (nx * 0.5 + 0.5) * 255; d.data[i + 1] = (ny * 0.5 + 0.5) * 255; d.data[i + 2] = 255; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0); _clayN = tex(c, { srgb: false }); _clayN.wrapS = _clayN.wrapT = THREE.RepeatWrapping; return _clayN;
}

// crisp label texture: draws via callback onto a w x h canvas
export function labelTex(w, h, draw, opts) { const c = canvas(w, h), x = c.getContext('2d'); draw(x, w, h); return tex(c, opts); }

export function disposeTree(o) {
  o.traverse((m) => {
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mt) => { if (mt.userData && mt.userData.shared) return; Object.values(mt).forEach((v) => { if (v && v.isTexture && !v.userData.shared) v.dispose(); }); mt.dispose(); });
  });
}
