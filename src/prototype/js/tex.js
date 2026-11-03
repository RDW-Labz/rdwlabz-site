// Procedural canvas textures shared by both scenes. Everything is painted in code.
import * as THREE from 'three';

export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ---------- pre-baked textures ----------
// Heavy procedural maps are rendered once offline (tools/bake_textures.py) into tex/*.webp.
// At load they are fetched and decoded off the main thread; the generator code only runs as a
// fallback if a file is missing. In bake mode (window.__BAKE) the generators run and their canvases
// are handed to the bake script.
export const BAKED = ['wenv_rgb.png', 'wenv_m.png', 'plastic_albedo', 'plastic_rough', 'plastic_normal', 'keycap_normal', 'wood_albedo', 'wood_rough', 'wood_normal', 'detail_normal', 'wall_1536x768_3', 'env_rgb.png', 'env_m.png', 'lightbake.png'];
const WORLD_BAKED = ['wenv_rgb.png', 'wenv_m.png'];
const HERO_BAKED = BAKED.filter((n) => !WORLD_BAKED.includes(n));
const BAKE = typeof window !== 'undefined' && window.__BAKE ? (window.__bakeOut = window.__bakeOut || {}) : null;
const cache = {};
let preloading = null, worldPreloading = null;
export const bakeMode = !!BAKE;
// bytes packed into a lossless PNG's RGB channels (first 4 bytes = length, little endian)
export function bakedBin(name) {
  const im = cache[name]; if (!im || im instanceof ArrayBuffer) return im || null;
  try { const c = makeCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, im.width, im.height).data;
    const rgb = new Uint8Array(im.width * im.height * 3); for (let i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
    const n = rgb[0] | (rgb[1] << 8) | (rgb[2] << 16) | (rgb[3] << 24); if (n <= 0 || n > rgb.length - 4) return null;
    const out = new Uint8Array(n); out.set(rgb.subarray(4, 4 + n)); cache[name] = out.buffer; return out.buffer; } catch (e) { return null; }
}
export function bakedImage(name) { return cache[name] || null; }
// software GL: halve the big maps once at load (4x less upload + mip work); the look is unchanged at 60 % render scale
let liteMax = 0;
export function setLite(on) { liteMax = on ? 1024 : 0; }
function fit(im) {
  if (!liteMax || !im || !(im.width > liteMax)) return im;
  const k = liteMax / im.width, c = makeCanvas(liteMax, Math.round(im.height * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c;
}
function preloadSet(list, capMs, dir) {
  if (BAKE) return Promise.resolve();
  const one = (f) => new Promise((res) => {
    const n = f.replace(/\.png$/, ''), im = new Image(); im.decoding = 'async';
    im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { cache[n] = im; res(); }); };
    im.onerror = () => res(); im.src = `${dir}${/\.png$/.test(f) ? f : f + '.webp'}`;
  });
  return Promise.race([Promise.all(list.map(one)), new Promise((r) => setTimeout(r, capMs))]);
}
/** Textures the workbench hero needs now. `dir` picks the full or the pre-sized sets. */
export function preloadBaked(capMs = 12000, dir = 'tex/') {
  if (preloading) return preloading;
  preloading = preloadSet(HERO_BAKED, capMs, dir);
  return preloading;
}
/** The screen-world environment. Loaded after the first frame so it never blocks the hero. */
export function preloadWorld(capMs = 9000, dir = 'tex/') {
  if (worldPreloading) return worldPreloading;
  worldPreloading = preloadSet(WORLD_BAKED, capMs, dir);
  return worldPreloading;
}
// keys -> canvas-or-image. Uses the baked files when every one is present, else runs gen() once.
export function bakedMany(prefix, keys, gen) {
  const names = keys.map((k) => (k ? `${prefix}_${k}` : prefix));
  if (!BAKE && names.every((n) => cache[n])) return Object.fromEntries(keys.map((k, i) => [k || 'img', fit(cache[names[i]])]));
  const out = gen();
  if (BAKE) keys.forEach((k, i) => { BAKE[names[i]] = out[k || 'img']; });
  return out;
}

// ---------- baked PMREM environments: RGBM (range 16) PNG pair <-> CubeUV half-float texture ----------
// decodeEnv fills the texture in a few chunks (yields between them); the texture object is usable at once.
export function decodeEnv(a, b, into = null) {
  const w = a.width, h = a.height, c = makeCanvas(w, h), x = c.getContext('2d');
  x.drawImage(a, 0, 0); const A = x.getImageData(0, 0, w, h).data; x.clearRect(0, 0, w, h); x.drawImage(b, 0, 0); const B = x.getImageData(0, 0, w, h).data;
  const out = new Uint16Array(w * h * 4), tH = THREE.DataUtils.toHalfFloat, one = tH(1), n = w * h, step = Math.ceil(n / 32);
  const t = into || new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  if (into) { t.image = { data: out, width: w, height: h }; }
  t.mapping = THREE.CubeUVReflectionMapping; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.colorSpace = THREE.LinearSRGBColorSpace;
  const done = (async () => {
    for (let s0 = 0; s0 < n; s0 += step) {
      for (let i = s0, e = Math.min(n, s0 + step); i < e; i++) { const k = i * 4, m = B[k] / 255 * 16 / 255; out[k] = tH(A[k] * m); out[k + 1] = tH(A[k + 1] * m); out[k + 2] = tH(A[k + 2] * m); out[k + 3] = one; }
      await new Promise((r) => setTimeout(r, 0));
    }
    t.needsUpdate = true; return t;
  })();
  return into ? t : done;
}
export function exportEnv(renderer, rt, prefix) {
  if (!BAKE) return;
  const gl = renderer.getContext(), w = rt.width, h = rt.height, f = new Float32Array(w * h * 4);
  const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, f); renderer.setRenderTarget(prev);
  const ca = makeCanvas(w, h), cb = makeCanvas(w, h), ia = ca.getContext('2d').createImageData(w, h), ib = cb.getContext('2d').createImageData(w, h);
  for (let i = 0; i < w * h; i++) { const k = i * 4, mx = Math.max(f[k], f[k + 1], f[k + 2], 1e-6), M = Math.min(255, Math.max(1, Math.ceil(mx / 16 * 255))), sc = M / 255 * 16;
    ia.data[k] = Math.round(Math.min(1, f[k] / sc) * 255); ia.data[k + 1] = Math.round(Math.min(1, f[k + 1] / sc) * 255); ia.data[k + 2] = Math.round(Math.min(1, f[k + 2] / sc) * 255); ia.data[k + 3] = 255;
    ib.data[k] = ib.data[k + 1] = ib.data[k + 2] = M; ib.data[k + 3] = 255; }
  ca.getContext('2d').putImageData(ia, 0, 0); cb.getContext('2d').putImageData(ib, 0, 0);
  BAKE[prefix + '_rgb'] = ca; BAKE[prefix + '_m'] = cb;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  c.getContext('2d', { willReadFrequently: true });   // CPU-backed: pixel reads (grain, height->normal) no longer stall on a GPU readback
  return c;
}

// One octave of value noise: a tiny random canvas scaled up with smoothing.
export function noiseLayer(ctx, w, h, cells, alpha, rand, mode = 'source-over', color = null) {
  const cw = Math.max(2, Math.round(cells)), ch = Math.max(2, Math.round(cells * h / w));
  const sc = makeCanvas(cw, ch); const sx = sc.getContext('2d');
  const id = sx.createImageData(cw, ch);
  for (let i = 0; i < cw * ch; i++) {
    const v = rand() * 255;
    if (color) { id.data[i * 4] = color[0]; id.data[i * 4 + 1] = color[1]; id.data[i * 4 + 2] = color[2]; id.data[i * 4 + 3] = v; }
    else { id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
  }
  sx.putImageData(id, 0, 0);
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = mode;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sc, 0, 0, w, h); ctx.restore();
}

export function fbm(ctx, w, h, rand, { start = 4, octaves = 6, alpha = 0.5, falloff = 0.62, mode = 'source-over', color = null } = {}) {
  let a = alpha, cells = start;
  for (let o = 0; o < octaves; o++) { noiseLayer(ctx, w, h, cells, a, rand, mode, color); cells *= 2; a *= falloff; }
}

// Per-pixel grain (fine paper/clay tooth).
export function grain(ctx, w, h, amount, rand, mono = true) {
  const id = ctx.getImageData(0, 0, w, h); const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    if (mono) { d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    else { d[i] += n; d[i + 1] += (rand() - 0.5) * amount; d[i + 2] += (rand() - 0.5) * amount; }
  }
  ctx.putImageData(id, 0, 0);
}

// Clay albedo + bump + roughness: broad hand-pressed dents and fingerprints, kept low-frequency so
// the bezel never shimmers (no per-pixel grain in the height map).
export function clayMaps(size = 512, seed = 7) {
  const r = rng(seed);
  const bump = makeCanvas(size, size), b = bump.getContext('2d');
  b.fillStyle = '#808080'; b.fillRect(0, 0, size, size);
  fbm(b, size, size, r, { start: 2, octaves: 3, alpha: 0.3, falloff: 0.5 });
  for (let i = 0; i < 14; i++) { // broad thumb dents
    const x = r() * size, y = r() * size, rad = 50 + r() * 90;
    const g = b.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() < 0.7;
    g.addColorStop(0, dark ? 'rgba(50,50,50,.4)' : 'rgba(210,210,210,.3)'); g.addColorStop(1, 'rgba(128,128,128,0)');
    b.fillStyle = g; b.beginPath(); b.ellipse(x, y, rad, rad * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2); b.fill();
  }
  const prints = [];
  for (let i = 0; i < 5; i++) { // fingerprints: wide ridges
    const x = r() * size, y = r() * size, rot = r() * Math.PI, rx = 46 + r() * 30;
    prints.push([x, y, rot, rx]);

  }
  // soften: blur pass so the height field has no sub-texel detail
  const soft = makeCanvas(size, size), sx = soft.getContext('2d');
  sx.filter = 'blur(2px)'; sx.drawImage(bump, 0, 0); sx.filter = 'none';
  if (sx.getImageData(size / 2, size / 2, 1, 1).data[3] === 0) sx.drawImage(bump, 0, 0); // filter unsupported

  // roughness: pressed fingerprint ridges are a little smoother
  const rough = makeCanvas(size, size), q = rough.getContext('2d');
  q.fillStyle = 'rgb(214,214,214)'; q.fillRect(0, 0, size, size);
  fbm(q, size, size, r, { start: 3, octaves: 2, alpha: 0.12, falloff: 0.5 });
  prints.forEach(([x, y, rot, rx]) => {
    q.save(); q.translate(x, y); q.rotate(rot);
    q.scale(1 / 3, 1 / 3); for (let k = 0; k < 7; k++) { q.strokeStyle = k % 2 ? 'rgba(180,180,180,.35)' : 'rgba(230,230,230,.2)'; q.lineWidth = 3.5; q.beginPath(); q.ellipse(0, 0, rx - k * 6, (rx - k * 6) * 0.72, 0, 0.3, Math.PI * 2 - 0.6); q.stroke(); }
    q.restore();
  });

  const col = makeCanvas(size, size), c = col.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, size, size);
  fbm(c, size, size, r, { start: 2, octaves: 3, alpha: 0.1, falloff: 0.6, mode: 'multiply' });
  c.globalAlpha = 0.14; c.globalCompositeOperation = 'multiply'; c.drawImage(soft, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  return { bump: soft, color: col, rough };
}

// Dark warm grungy wall: dirt clouds, drips, grime. Big single canvas, no tiling seams.
export function grungeWall(w = 1024, h = 512, seed = 3, base = '#2a1f19') {
  return bakedMany(`wall_${w}x${h}_${seed}`, [''], () => ({ img: grungeWallGen(w, h, seed, base) })).img;
}
function grungeWallGen(w, h, seed, base) {
  const r = rng(seed);
  const cv = makeCanvas(w, h), x = cv.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  fbm(x, w, h, r, { start: 5, octaves: 4, alpha: 0.32, mode: 'multiply' });
  fbm(x, w, h, r, { start: 3, octaves: 3, alpha: 0.12, mode: 'screen' });
  for (let i = 0; i < 70; i++) { // drips / streaks
    const px = r() * w, py = r() * h * 0.6, len = 30 + r() * 160;
    const g = x.createLinearGradient(px, py, px, py + len);
    g.addColorStop(0, 'rgba(10,6,4,.0)'); g.addColorStop(0.3, 'rgba(10,6,4,.22)'); g.addColorStop(1, 'rgba(10,6,4,0)');
    x.fillStyle = g; x.fillRect(px, py, 1 + r() * 3, len);
  }
  for (let i = 0; i < 18; i++) { // stains
    const px = r() * w, py = r() * h, rad = 20 + r() * 120;
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, `rgba(${r() < 0.5 ? '0,0,0' : '90,60,40'},.18)`); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  // grunge specks x50-ish
  fbm(x, w, h, r, { start: 64, octaves: 2, alpha: 0.12, mode: 'overlay' });
  grain(x, w, h, 14, r);
  return cv;
}

// Soft smoke puff (premultiplied-looking white with alpha).
export function smokeTexture(size = 256, seed = 11) {
  const r = rng(seed);
  const cv = makeCanvas(size, size), x = cv.getContext('2d');
  for (let i = 0; i < 28; i++) {
    const a = r() * Math.PI * 2, d = r() * size * 0.22;
    const px = size / 2 + Math.cos(a) * d, py = size / 2 + Math.sin(a) * d * 0.7, rad = size * (0.12 + r() * 0.2);
    const g = x.createRadialGradient(px, py, 0, px, py, rad);
    g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, size, size);
  }
  // wispy breakup
  x.globalCompositeOperation = 'destination-out';
  fbm(x, size, size, r, { start: 4, octaves: 3, alpha: 0.5, color: [0, 0, 0] });
  x.globalCompositeOperation = 'destination-in';
  const m = x.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = m; x.fillRect(0, 0, size, size);
  return cv;
}

// Sky cloud: wide soft bank.
export function cloudTexture(w = 512, h = 256, seed = 5) {
  const r = rng(seed);
  const cv = makeCanvas(w, h), x = cv.getContext('2d');
  for (let i = 0; i < 40; i++) {
    const px = w * (0.15 + r() * 0.7), py = h * (0.4 + r() * 0.25), rad = h * (0.15 + r() * 0.3);
    const g = x.createRadialGradient(px, py - rad * 0.2, 0, px, py, rad);
    g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(0.6, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
  }
  x.globalCompositeOperation = 'destination-out';
  fbm(x, w, h, r, { start: 6, octaves: 3, alpha: 0.35, color: [0, 0, 0] });
  // soft elliptical edge so sprites never show their rectangle
  x.globalCompositeOperation = 'destination-in';
  x.save(); x.translate(w / 2, h / 2); x.scale(1, h / w);
  const m = x.createRadialGradient(0, 0, w * 0.15, 0, 0, w * 0.5);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = m; x.fillRect(-w / 2, -w / 2, w, w); x.restore();
  return cv;
}

export function dotTexture(size = 64) {
  const cv = makeCanvas(size, size), x = cv.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return cv;
}

// Image helpers
export function loadImage(src) {
  return new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

export function drawCover(ctx, im, x, y, w, h, focusY = 0.5) {
  if (!im) { ctx.fillStyle = '#2a2440'; ctx.fillRect(x, y, w, h); return; }
  const ir = im.width / im.height, r = w / h;
  let sw = im.width, sh = im.height, sx = 0, sy = 0;
  if (ir > r) { sw = im.height * r; sx = (im.width - sw) / 2; }
  else { sh = im.width / r; sy = (im.height - sh) * focusY; }
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}

// ---------- hand-drawn helpers (About diorama) ----------
// Wobbly closed path through points, with slight per-point jitter.
export function wobblyPath(ctx, pts, rand, jit = 2, closed = true) {
  const p = pts.map(([x, y]) => [x + (rand() - 0.5) * jit, y + (rand() - 0.5) * jit]);
  ctx.beginPath();
  if (!closed) {
    ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    return;
  }
  const n = p.length;
  const m0 = [(p[n - 1][0] + p[0][0]) / 2, (p[n - 1][1] + p[0][1]) / 2];
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  ctx.closePath();
}

// Points of a rounded rectangle, densely sampled for wobble.
export function rrPts(x, y, w, h, r, step = 14) {
  const pts = [];
  const seg = (x0, y0, x1, y1) => { const l = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(l / step)); for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]); };
  const arc = (cx, cy, a0) => { for (let i = 0; i < 4; i++) { const a = a0 + i / 4 * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  seg(x + r, y, x + w - r, y); arc(x + w - r, y + r, -Math.PI / 2);
  seg(x + w, y + r, x + w, y + h - r); arc(x + w - r, y + h - r, 0);
  seg(x + w - r, y + h, x + r, y + h); arc(x + r, y + h - r, Math.PI / 2);
  seg(x, y + h - r, x, y + r); arc(x + r, y + r, Math.PI);
  return pts;
}

export function ellipsePts(cx, cy, rx, ry, n = 28, a0 = 0, a1 = Math.PI * 2) {
  const pts = []; for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return pts;
}

export function polyPts(list, step = 14) {
  const pts = [];
  for (let k = 0; k < list.length; k++) {
    const [x0, y0] = list[k], [x1, y1] = list[(k + 1) % list.length];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i < n; i++) pts.push([x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]);
  }
  return pts;
}

// Fill a path region with paper grain + soft hatching (call after the shape path is set as clip).
export function paperFill(ctx, w, h, color, rand, hatch = true) {
  ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  fbm(ctx, w, h, rand, { start: 8, octaves: 3, alpha: 0.10, mode: 'multiply' });
  if (hatch) {
    ctx.save(); ctx.globalAlpha = 0.10; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    for (let i = -h; i < w; i += 7) { ctx.beginPath(); ctx.moveTo(i + rand() * 2, 0); ctx.lineTo(i + h * 0.5 + rand() * 3, h); ctx.stroke(); }
    ctx.restore();
  }
}
