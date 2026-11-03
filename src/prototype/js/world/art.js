// Screen world: curated "key art" from the real project images. Never invents content: crops (<= ~1.2x), exposure lift,
// a navy lift for crushed blacks, a soft coloured rim glow, and our own title band / title card typography.
import { canvas, tex, drawCover, grain, rr, clamp } from './util.js';

// raise near-black pixels toward a navy so dark game/site shots never read as black frames
export function liftBlacks(x, w, h, amt = 0.5, col = [28, 34, 96]) {
  const d = x.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const L = (a[i] * 0.3 + a[i + 1] * 0.55 + a[i + 2] * 0.15) / 255, k = amt * Math.pow(1 - L, 2.2);
    a[i] += (col[0] - a[i]) * k; a[i + 1] += (col[1] - a[i + 1]) * k; a[i + 2] += (col[2] - a[i + 2]) * k;
  }
  x.putImageData(d, 0, 0);
}

function rimGlow(x, w, h, cols) {
  x.save(); x.globalCompositeOperation = 'screen';
  cols.forEach(([c, gx, gy, r]) => { const g = x.createRadialGradient(w * gx, h * gy, 0, w * gx, h * gy, Math.max(w, h) * r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  x.restore();
}

// curated art for a project (used by ring cards, project hero, frames)
export function keyArt(im, p, w, h, { band = false, poster = true } = {}) {
  if (poster && p.poster) return posterArt(p, w, h, band);
  const A = p.art || {}, c = canvas(w, h), x = c.getContext('2d');
  x.filter = `brightness(${A.bright ?? 1}) contrast(${A.contrast ?? 1.05}) saturate(${A.sat ?? 1.08})`;
  drawCover(x, im, 0, 0, w, h, { fx: A.fx ?? 0.5, fy: A.fy ?? p.focusY ?? 0.5, zoom: Math.min(1.2, A.zoom ?? 1) });
  x.filter = 'none';
  if (A.lift) liftBlacks(x, w, h, A.lift, A.liftCol);
  if (A.glow) rimGlow(x, w, h, A.glow);
  if (band) {
    const bh = Math.round(h * 0.26);
    x.fillStyle = 'rgba(8,6,28,.6)'; x.fillRect(0, h - bh, w, bh);   // 60% backing so the title reads on any art
    x.fillStyle = '#FFF6E8'; x.font = `${Math.round(h * 0.13)}px "Instrument Serif"`; x.textBaseline = 'alphabetic'; x.fillText(p.name, w * 0.05, h - bh * 0.42);
    x.fillStyle = '#FFE0B0'; x.font = `${Math.round(h * 0.062)}px VT323`; x.fillText(p.tag.toUpperCase(), w * 0.05, h - bh * 0.1 - h * 0.01);
  }
  grain(x, w, h, 6, 7);
  return c;
}

// our own title card for a project: gradient field, inset key art, big title, tag line
export function titleCard(im, p, w, h) {
  const c = canvas(w, h), x = c.getContext('2d');
  const games = p.cat === 'games', g = x.createLinearGradient(0, 0, w, h);
  if (p.file === 'DORMANT_RED.EXE') { g.addColorStop(0, '#2a0b1c'); g.addColorStop(0.55, '#14183f'); g.addColorStop(1, '#3a1020'); }
  else if (games) { g.addColorStop(0, '#2d5a3c'); g.addColorStop(1, '#e2c27a'); }
  else if (p.cat === 'web') { g.addColorStop(0, '#13163a'); g.addColorStop(1, '#4A6CC0'); }
  else if (p.cat === 'systems') { g.addColorStop(0, '#0f2a2c'); g.addColorStop(1, '#2E8A7C'); }
  else { g.addColorStop(0, '#E9C9A8'); g.addColorStop(1, '#B9889A'); }
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // star field / dots
  for (let i = 0; i < 140; i++) { const sx = (i * 97.3) % w, sy = (i * 57.7) % h; x.fillStyle = `rgba(255,240,230,${0.1 + (i % 5) * 0.06})`; x.fillRect(sx, sy, 2, 2); }
  if (im) {   // with an image: a lifted print of it on the right. Without (project pages): type only, so no frame repeats a screenshot
    const iw = w * 0.5, ih = iw * (im.height / im.width), ix = w * 0.46, iy = (h - Math.min(ih, h * 0.8)) / 2;
    const art = keyArt(im, p, Math.round(iw), Math.round(Math.min(ih, h * 0.8)), { poster: false });
    x.save(); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 40; x.shadowOffsetY = 16; rr(x, ix, iy, iw, Math.min(ih, h * 0.8), 18); x.fillStyle = '#000'; x.fill(); x.restore();
    x.save(); rr(x, ix, iy, iw, Math.min(ih, h * 0.8), 18); x.clip(); x.drawImage(art, ix, iy); x.restore();
  } else {
    x.save(); x.textAlign = 'right'; x.fillStyle = 'rgba(255,240,230,.16)'; x.font = `${Math.round(h * 0.34)}px VT323`; x.fillText(p.kind, w * 0.95, h * 0.9);
    x.fillStyle = 'rgba(255,224,176,.75)'; x.font = `${Math.round(h * 0.05)}px VT323`; x.fillText(p.file, w * 0.95, h * 0.12); x.restore();
  }
  const red = p.file === 'DORMANT_RED.EXE';
  x.fillStyle = red ? '#ff6a50' : '#FFF6E8'; x.font = `${Math.round(h * (red ? 0.2 : 0.15))}px ${red ? 'VT323' : '"Instrument Serif"'}`; x.textBaseline = 'alphabetic';
  if (red) { x.shadowColor = '#ff3a2a'; x.shadowBlur = 30; }
  const words = p.name.split(' '); let y = h * 0.42; const lh = h * (red ? 0.18 : 0.15);
  words.forEach((wd) => { x.fillText(wd, w * 0.06, y); y += lh; });
  x.shadowBlur = 0; x.fillStyle = '#FFE0B0'; x.font = `${Math.round(h * 0.055)}px VT323`; x.fillText(p.tag.toUpperCase(), w * 0.06, y + h * 0.02);
  grain(x, w, h, 6, 11);
  return c;
}

// a site mocked in our own browser frame (canvas): tab strip + url pill, the real screenshot, scroll offset 0..1
export function browserShot(im, url, w, h, scroll = 0) {
  const c = canvas(w, h), x = c.getContext('2d'), bar = Math.round(h * 0.075);
  x.fillStyle = '#EDE0CC'; x.fillRect(0, 0, w, bar);
  ['#E2533B', '#F2C94C', '#7FB069'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(bar * 0.6 + i * bar * 0.5, bar / 2, bar * 0.15, 0, Math.PI * 2); x.fill(); });
  x.fillStyle = '#FFF8EE'; rr(x, w * 0.14, bar * 0.2, w * 0.6, bar * 0.6, bar * 0.3); x.fill();
  x.fillStyle = '#6B5640'; x.font = `${Math.round(bar * 0.38)}px "JetBrains Mono"`; x.textBaseline = 'middle'; x.fillText(url, w * 0.16, bar / 2);
  if (im) { const s = w / im.width, ph = im.height * s, view = h - bar, off = clamp(scroll) * Math.max(0, ph - view); x.drawImage(im, 0, off / s, im.width, view / s, 0, bar, w, view); }
  return c;
}

export const artTex = (c) => tex(c);

// Dormant Red poster, rendered by us: a lit station silhouette against a red-to-amber nebula, the title in glowing type
export function posterArt(p, w, h, band = false) {
  const c = canvas(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a0c3a'); g.addColorStop(0.45, '#8a1e32'); g.addColorStop(0.8, '#e2603a'); g.addColorStop(1, '#ffb26a');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,236,220,${0.15 + (i % 5) * 0.12})`; x.fillRect((i * 97.13) % w, ((i * 61.7) % (h * 0.6)), 2, 2); }
  const neb = x.createRadialGradient(w * 0.7, h * 0.35, 0, w * 0.7, h * 0.35, w * 0.5); neb.addColorStop(0, 'rgba(255,170,120,.45)'); neb.addColorStop(1, 'rgba(255,170,120,0)'); x.fillStyle = neb; x.fillRect(0, 0, w, h);
  // the station: a ring, a spine and modules, back-lit with a warm rim
  const cx = w * 0.66, cy = h * 0.52, R = h * 0.3;
  x.save(); x.shadowColor = 'rgba(255,190,120,.9)'; x.shadowBlur = h * 0.04;
  x.strokeStyle = '#1a0a1e'; x.lineWidth = h * 0.05; x.beginPath(); x.ellipse(cx, cy, R, R * 0.36, -0.2, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#1a0a1e'; x.fillRect(cx - R * 1.3, cy - h * 0.025, R * 2.6, h * 0.05);
  [[-0.95, 0.12], [-0.55, 0.16], [0.5, 0.14], [0.9, 0.1]].forEach(([dx, s]) => { x.fillRect(cx + dx * R - h * s / 2, cy - h * s / 2, h * s, h * s); });
  x.beginPath(); x.arc(cx, cy, h * 0.1, 0, Math.PI * 2); x.fill(); x.restore();
  for (let i = 0; i < 12; i++) { x.fillStyle = i % 4 ? 'rgba(255,214,150,.9)' : 'rgba(120,230,220,.9)'; x.fillRect(cx - R * 1.2 + i * R * 0.2, cy - h * 0.006, h * 0.012, h * 0.012); }
  // a faint red warning beacon
  x.fillStyle = '#ff5a40'; x.shadowColor = '#ff3a2a'; x.shadowBlur = 20; x.beginPath(); x.arc(cx, cy - h * 0.11, h * 0.012, 0, Math.PI * 2); x.fill(); x.shadowBlur = 0;
  // title
  x.font = `${Math.round(h * 0.2)}px VT323`; x.textBaseline = 'alphabetic'; x.shadowColor = '#ff4a3a'; x.shadowBlur = h * 0.05; x.fillStyle = '#ffd2c0';
  x.fillText('DORMANT', w * 0.06, h * 0.32); x.fillText('RED', w * 0.06, h * 0.5); x.shadowBlur = 0;
  x.fillStyle = '#FFE0B0'; x.font = `${Math.round(h * 0.06)}px VT323`; x.fillText('FREE ON ITCH.IO', w * 0.06, h * 0.6);
  if (band) { const bh = Math.round(h * 0.26); x.fillStyle = 'rgba(8,6,28,.6)'; x.fillRect(0, h - bh, w, bh); x.fillStyle = '#FFF6E8'; x.font = `${Math.round(h * 0.13)}px "Instrument Serif"`; x.fillText(p.name, w * 0.05, h - bh * 0.42); x.fillStyle = '#FFE0B0'; x.font = `${Math.round(h * 0.062)}px VT323`; x.fillText(p.tag.toUpperCase(), w * 0.05, h - bh * 0.1 - h * 0.01); }
  grain(x, w, h, 6, 13);
  return c;
}

// average colour of an art canvas (for the tinted band behind a project page)
export function avgColor(c) { const t = canvas(8, 8), x = t.getContext('2d'); x.drawImage(c, 0, 0, 8, 8); const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return [r / n / 255, g / n / 255, b / n / 255]; }

// private builds: our own placeholder card (never a fake screenshot) — blueprint grid, a clay padlock, the name and a stamp
export function privateArt(p, w = 1280, h = 800) {
  const c = canvas(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2B2560'); g.addColorStop(1, '#4A3A7A'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(255,240,230,.07)'; x.lineWidth = 1; const s = Math.round(h / 16);
  for (let gx = s / 2; gx < w; gx += s) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, h); x.stroke(); }
  for (let gy = s / 2; gy < h; gy += s) { x.beginPath(); x.moveTo(0, gy); x.lineTo(w, gy); x.stroke(); }
  // padlock (flat shapes, our palette)
  const lx = w * 0.72, ly = h * 0.5, bw = h * 0.36, bh = h * 0.3;
  x.save(); x.shadowColor = 'rgba(8,6,28,.45)'; x.shadowBlur = h * 0.05; x.shadowOffsetY = h * 0.02;
  x.strokeStyle = '#E9D6B8'; x.lineWidth = h * 0.045; x.lineCap = 'round';
  x.beginPath(); x.moveTo(lx - bw * 0.3, ly - bh * 0.45); x.lineTo(lx - bw * 0.3, ly - bh * 0.75); x.arc(lx, ly - bh * 0.75, bw * 0.3, Math.PI, 0); x.lineTo(lx + bw * 0.3, ly - bh * 0.45); x.stroke();
  x.fillStyle = '#F3E7D3'; rr(x, lx - bw / 2, ly - bh * 0.5, bw, bh, h * 0.04); x.fill(); x.restore();
  x.fillStyle = '#2B2560'; x.beginPath(); x.arc(lx, ly - bh * 0.08, h * 0.03, 0, Math.PI * 2); x.fill(); x.fillRect(lx - h * 0.01, ly - bh * 0.08, h * 0.02, h * 0.07);
  // name + stamp
  x.fillStyle = '#FFE0B0'; x.font = `${Math.round(h * 0.06)}px VT323`; x.textBaseline = 'alphabetic'; x.fillText('● PRIVATE BUILD', w * 0.07, h * 0.3);
  x.fillStyle = '#FFF6E8'; x.font = `${Math.round(h * 0.12)}px "Instrument Serif"`;
  const words = p.name.split(' '), lines = []; let cur = '';
  words.forEach((wd) => { const t = cur ? cur + ' ' + wd : wd; if (x.measureText(t).width > w * 0.5 && cur) { lines.push(cur); cur = wd; } else cur = t; }); lines.push(cur);
  lines.forEach((l, i) => x.fillText(l, w * 0.07, h * 0.46 + i * h * 0.13));
  x.fillStyle = 'rgba(255,240,230,.7)'; x.font = `${Math.round(h * 0.045)}px "JetBrains Mono"`; x.fillText('NAME ONLY · NO SCREENSHOTS', w * 0.07, h * 0.46 + lines.length * h * 0.13 + h * 0.02);
  grain(x, w, h, 6, 17);
  return c;
}
