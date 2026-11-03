// About: paper diorama walk (unlit cut-paper planes on 4 depth layers, spline camera, Lumpy the stick puppet).
import * as THREE from 'three';
import * as TX from './tex.js';

const V3 = THREE.Vector3;
const SRGB = THREE.SRGBColorSpace;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const INK = '#3A3A36';
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// z layers (panda-style): wall, far, mid props, puppets, front
const Z = { wall: -2.75, far: -2.62, mid: -2.3, puppet: -1.4, front: -0.3 };

// ------------------------------------------------------------------ painter
function painter(ctx, r) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  return {
    shape(pts, fill, { lw = 4.5, hatch = true, jit = 2.2, ink = INK, grainFill = true } = {}) {
      ctx.save();
      TX.wobblyPath(ctx, pts, r, jit, true); ctx.clip();
      if (typeof fill === 'function') fill(ctx); else if (grainFill) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); TX.paperFill(ctx, cw, ch, fill, r, hatch); ctx.restore(); } else { ctx.fillStyle = fill; ctx.fill(); }
      ctx.restore();
      if (lw > 0) {
        ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = lw;
        TX.wobblyPath(ctx, pts, r, jit, true); ctx.stroke();
        ctx.globalAlpha = 0.3; ctx.lineWidth = lw * 0.5; TX.wobblyPath(ctx, pts, r, jit * 1.8, true); ctx.stroke();
        ctx.restore();
      }
    },
    line(pts, lw = 4, color = INK, jit = 1.6) {
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = color; ctx.lineWidth = lw;
      TX.wobblyPath(ctx, pts, r, jit, false); ctx.stroke(); ctx.restore();
    },
    text(s, x, y, font, color = INK, { align = 'center', rot = 0, base = 'middle' } = {}) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(s, 0, 0); ctx.restore();
    },
    dot(x, y, rad, color = INK) { ctx.save(); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); ctx.restore(); },
  };
}

// Paint a cut-paper element: art + white paper edge + separate soft shadow texture.
function paintCutout(wU, hU, paint, { px = 150, edge = 5, seed = 1 } = {}) {
  const M = 26;
  const w = Math.ceil(wU * px), h = Math.ceil(hU * px);
  const cw = w + 2 * M, ch = h + 2 * M;
  const art = TX.makeCanvas(cw, ch), a = art.getContext('2d');
  a.translate(M, M);
  const r = TX.rng(seed);
  paint(a, px, r, painter(a, r), w, h);
  const sil = TX.makeCanvas(cw, ch), s = sil.getContext('2d');
  for (let i = 0; i < 16; i++) { const an = (i / 16) * TAU; s.drawImage(art, Math.cos(an) * edge, Math.sin(an) * edge); }
  s.globalCompositeOperation = 'source-in'; s.fillStyle = '#FBFAF5'; s.fillRect(0, 0, cw, ch);
  s.globalCompositeOperation = 'source-over'; s.drawImage(art, 0, 0);
  const sh = TX.makeCanvas(cw, ch), x = sh.getContext('2d');
  x.shadowColor = 'rgba(55,42,30,.5)'; x.shadowBlur = 16; x.shadowOffsetX = cw * 2; x.drawImage(sil, -cw * 2, 0);
  return { sil, sh, wU: cw / px, hU: ch / px };
}

// ------------------------------------------------------------------ props (all original art, painted here)
const P = {};
P.lumpy = (c, px, r, H, w, h) => {
  const pts = [];
  const bez = (p0, p1, p2, p3, n) => { for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } };
  bez([w * 0.1, h], [w * -0.02, h * 0.45], [w * 0.2, h * 0.1], [w * 0.5, h * 0.02], 14);
  bez([w * 0.5, h * 0.02], [w * 0.8, h * 0.12], [w * 1.0, h * 0.5], [w * 0.9, h], 14);
  pts.push([w * 0.5, h * 1.01]);
  H.shape(pts, '#EF8A5C', { lw: 5 });
  H.dot(w * 0.4, h * 0.42, w * 0.045); H.dot(w * 0.6, h * 0.42, w * 0.045);
  c.save(); c.globalAlpha = 0.35; H.dot(w * 0.28, h * 0.53, w * 0.06, '#E2533B'); H.dot(w * 0.72, h * 0.53, w * 0.06, '#E2533B'); c.restore();
  H.line(TX.ellipsePts(w * 0.5, h * 0.5, w * 0.12, h * 0.07, 10, 0.3, Math.PI - 0.3), 4.5);
};
P.cart = (c, px, r, H, w, h) => {
  H.line([[0, h * 0.42], [w * 0.3, h * 0.42]], 5);
  H.shape(TX.ellipsePts(w * 0.65, h * 0.2, w * 0.18, h * 0.14, 16), '#9B6A45', { lw: 4 });
  H.shape(TX.rrPts(w * 0.3, h * 0.22, w * 0.66, h * 0.55, 8, 12), '#E3BF94', { lw: 4.5 });
  H.line([[w * 0.33, h * 0.42], [w * 0.93, h * 0.42]], 2.5, 'rgba(58,58,54,.45)');
};
P.wheel = (c, px, r, H, w, h) => {
  H.shape(TX.ellipsePts(w / 2, h / 2, w * 0.46, h * 0.46, 20), '#F6F1E6', { lw: 4.5, hatch: false });
  H.dot(w / 2, h / 2, w * 0.1);
  H.line([[w * 0.5, h * 0.12], [w * 0.5, h * 0.88]], 2.5); H.line([[w * 0.12, h * 0.5], [w * 0.88, h * 0.5]], 2.5);
};
P.cloud = (c, px, r, H, w, h) => {
  const base = h * 0.9, pts = [[w * 0.06, base], [w * 0.94, base]];
  const arcs = [[0.8, 0.16, 0.5], [0.58, 0.24, 0.75], [0.36, 0.2, 0.62], [0.17, 0.13, 0.45]];
  arcs.forEach(([cx, rr, k]) => { for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; pts.push([w * cx + Math.cos(a) * w * rr, base - Math.sin(a) * h * k * 1.05]); } });
  H.shape(pts, '#FBFBF8', { lw: 4, ink: '#6B6E73', hatch: true });
};
P.bush = (c, px, r, H, w, h) => {
  const base = h * 0.98, pts = [[w * 0.03, base], [w * 0.97, base]];
  const arcs = [[0.82, 0.15, 0.62], [0.6, 0.18, 0.9], [0.38, 0.18, 0.8], [0.16, 0.14, 0.6]];
  arcs.forEach(([cx, rr, k]) => { for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; pts.push([w * cx + Math.cos(a) * w * rr, base - Math.sin(a) * h * k]); } });
  H.shape(pts, '#8DB57A', { lw: 4, ink: '#3E5236' });
  for (let i = 0; i < 6; i++) H.line([[w * (0.2 + r() * 0.6), h * (0.4 + r() * 0.4)], [w * (0.22 + r() * 0.6), h * (0.35 + r() * 0.4)]], 2, 'rgba(50,80,40,.45)');
};
P.grass = (c, px, r, H, w, h) => { for (let i = 0; i < 5; i++) { const x = w * (0.15 + i * 0.17); H.line([[x, h], [x + (r() - 0.5) * w * 0.25, h * (0.1 + r() * 0.3)]], 4, '#4F7A45'); } };
P.mountains = (tint, edge) => (c, px, r, H, w, h) => {
  const peaks = [[0, h], [w * 0.12, h * 0.45], [w * 0.22, h * 0.7], [w * 0.38, h * 0.08], [w * 0.52, h * 0.55], [w * 0.63, h * 0.3], [w * 0.78, h * 0.62], [w * 0.88, h * 0.35], [w, h]];
  H.shape(TX.polyPts(peaks, 18), tint, { lw: 3.5, ink: edge });
  const back = [[w * 0.2, h], [w * 0.3, h * 0.5], [w * 0.45, h], [w * 0.6, h * 0.45], [w * 0.74, h]];
  c.save(); c.globalAlpha = 0.5; H.line(back, 3, edge); c.restore();
};
P.balloon = (c, px, r, H, w, h) => {
  const env = []; for (let i = 0; i <= 28; i++) { const a = (i / 28) * TAU; const k = Math.sin(a) > 0 ? 1 : 0.85; env.push([w * 0.5 + Math.cos(a) * w * 0.44, h * 0.34 + Math.sin(a) * h * 0.3 * k + (Math.sin(a) > 0 ? Math.sin(a) * h * 0.06 : 0)]); }
  H.shape(env, (x) => { x.fillStyle = '#FBE3C8'; x.fillRect(-50, -50, w + 100, h + 100); x.fillStyle = '#EF8A5C'; for (let i = -2; i < 3; i += 2) { x.beginPath(); x.ellipse(w * 0.5 + i * w * 0.11, h * 0.36, w * 0.06, h * 0.34, 0, 0, TAU); x.fill(); } });
  H.line([[w * 0.3, h * 0.66], [w * 0.4, h * 0.82]], 3); H.line([[w * 0.7, h * 0.66], [w * 0.6, h * 0.82]], 3);
  H.shape(TX.rrPts(w * 0.36, h * 0.82, w * 0.28, h * 0.16, 4, 10), '#C9A27C', { lw: 4 });
};
P.polaroid = (img, cap = 'our clay models!') => (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(0, h * 0.04, w, h * 0.96, 6, 18), '#FFFFFF', { lw: 2.5, hatch: false, ink: 'rgba(58,58,54,.5)' });
  c.save(); c.beginPath(); c.rect(w * 0.06, h * 0.1, w * 0.88, h * 0.66); c.clip(); TX.drawCover(c, img, w * 0.06, h * 0.1, w * 0.88, h * 0.66); c.restore();
  H.text(cap, w * 0.48, h * 0.87, `700 ${Math.round(h * 0.085)}px Caveat`, INK, { rot: -0.05 });
  H.shape(TX.ellipsePts(w * 0.5, h * 0.05, w * 0.045, w * 0.045, 12), '#E2533B', { lw: 3, hatch: false });
};
P.bench = (c, px, r, H, w, h) => {
  const top = h * 0.42;
  H.line([[w * 0.1, top], [w * 0.1, h]], 7); H.line([[w * 0.9, top], [w * 0.9, h]], 7);
  H.shape(TX.rrPts(w * 0.02, top - h * 0.02, w * 0.96, h * 0.1, 6, 14), '#C9A27C', { lw: 4.5 });
  // clay computer on the bench
  H.shape(TX.rrPts(w * 0.36, h * 0.0, w * 0.28, top - h * 0.02, 22, 12), '#E8C495', { lw: 4.5 });
  H.shape(TX.rrPts(w * 0.395, h * 0.06, w * 0.21, top * 0.62, 12, 12), '#3B2414', { lw: 3.5, hatch: false });
  H.text('RDW', w * 0.5, h * 0.06 + top * 0.32, `italic 700 ${Math.round(h * 0.12)}px Caveat`, '#FFB45E');
  H.shape(TX.ellipsePts(w * 0.25, top - h * 0.1, w * 0.04, w * 0.04, 14), '#5B7FD6', { lw: 4 });
  H.shape(TX.polyPts([[w * 0.74, top - h * 0.02], [w * 0.78, top - h * 0.24], [w * 0.82, top - h * 0.02]], 10), '#7FB59A', { lw: 4 });
  H.text('the RDW bench', w * 0.5, top + h * 0.22, `700 ${Math.round(h * 0.13)}px Caveat`, INK, { rot: -0.02 });
};
P.signpost = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(w * 0.44, h * 0.12, w * 0.07, h * 0.88, 3, 14), '#9B6A45', { lw: 4 });
  const pts = [[w * 0.03, h * 0.12], [w * 0.8, h * 0.12], [w * 0.98, h * 0.24], [w * 0.8, h * 0.36], [w * 0.03, h * 0.36]];
  H.shape(TX.polyPts(pts, 14), '#DDE9FB', { lw: 5 });
  H.text('Verrow AI', w * 0.44, h * 0.245, `700 ${Math.round(h * 0.13)}px Caveat`, '#2F5BD3', { rot: -0.02 });
  for (let i = 0; i < 3; i++) H.line([[w * (0.36 + i * 0.1), h], [w * (0.33 + i * 0.12), h * 0.93]], 3.5, '#4F7A45');
};
P.tower = (c, px, r, H, w, h) => {
  const tY = h * 0.08, tH = h * 0.3;
  H.line([[w * 0.2, tY + tH], [w * 0.12, h]], 6); H.line([[w * 0.8, tY + tH], [w * 0.88, h]], 6);
  H.line([[w * 0.38, tY + tH], [w * 0.36, h]], 4, 'rgba(58,58,54,.55)'); H.line([[w * 0.62, tY + tH], [w * 0.64, h]], 4, 'rgba(58,58,54,.55)');
  H.line([[w * 0.18, tY + tH + h * 0.05], [w * 0.86, h * 0.8]], 3.5); H.line([[w * 0.82, tY + tH + h * 0.05], [w * 0.14, h * 0.8]], 3.5);
  H.line([[w * 0.16, h * 0.72], [w * 0.84, h * 0.72]], 3.5);
  const tank = []; for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; tank.push([w * 0.5 + Math.cos(a) * w * 0.42, tY + h * 0.06 + Math.sin(a) * h * 0.05]); }
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; tank.push([w * 0.5 + Math.cos(a) * w * 0.42, tY + tH + Math.sin(a) * h * 0.04]); }
  tank.reverse();
  H.shape(tank, '#CDD3DC', { lw: 5 });
  H.shape(TX.polyPts([[w * 0.1, tY + h * 0.06], [w * 0.5, tY - h * 0.04], [w * 0.9, tY + h * 0.06]], 12), '#AEB7C4', { lw: 4 });
  H.line([[w * 0.5, tY - h * 0.04], [w * 0.5, tY - h * 0.08]], 4);
  H.text('HARRISON', w * 0.5, tY + tH * 0.6, `700 ${Math.round(w * 0.15)}px Caveat`, INK, { rot: -0.03 });
};
P.arcade = (img) => (c, px, r, H, w, h) => {
  const body = [[w * 0.1, h * 0.04], [w * 0.9, h * 0.04], [w * 0.95, h * 0.1], [w * 0.95, h * 0.56], [w * 1.0, h * 0.68], [w * 0.96, h * 0.7], [w * 0.96, h], [w * 0.04, h], [w * 0.04, h * 0.7], [w * 0.0, h * 0.68], [w * 0.05, h * 0.56], [w * 0.05, h * 0.1]];
  H.shape(TX.polyPts(body, 16), '#3B37C8', { lw: 5 });
  H.shape(TX.rrPts(w * 0.1, h * 0.07, w * 0.8, h * 0.1, 4, 12), '#F6E9D6', { lw: 3.5, hatch: false });
  H.text('DORMANT RED', w * 0.5, h * 0.122, `${Math.round(h * 0.072)}px VT323`, '#C2412E');
  H.shape(TX.rrPts(w * 0.12, h * 0.2, w * 0.76, h * 0.34, 10, 12), '#15100c', { lw: 4.5, hatch: false });
  c.save(); c.beginPath(); c.rect(w * 0.16, h * 0.23, w * 0.68, h * 0.28); c.clip(); c.filter = 'brightness(1.6) contrast(1.15) saturate(1.2)'; TX.drawCover(c, img, w * 0.16, h * 0.23, w * 0.68, h * 0.28); c.restore();
  H.shape(TX.polyPts([[w * 0.0, h * 0.68], [w * 0.08, h * 0.58], [w * 0.92, h * 0.58], [w * 1.0, h * 0.68]], 12), '#EADFCC', { lw: 4 });
  H.line([[w * 0.28, h * 0.64], [w * 0.28, h * 0.6]], 4); H.shape(TX.ellipsePts(w * 0.28, h * 0.585, w * 0.05, w * 0.05, 12), '#E2533B', { lw: 3.5, hatch: false });
  H.shape(TX.ellipsePts(w * 0.6, h * 0.635, w * 0.045, w * 0.04, 12), '#F2C94C', { lw: 3.5, hatch: false });
  H.shape(TX.ellipsePts(w * 0.74, h * 0.625, w * 0.045, w * 0.04, 12), '#7FB59A', { lw: 3.5, hatch: false });
  H.shape(TX.rrPts(w * 0.32, h * 0.77, w * 0.36, h * 0.14, 4, 10), '#2C2898', { lw: 4, hatch: false });
  H.line([[w * 0.44, h * 0.81], [w * 0.44, h * 0.87]], 5, '#F2C94C'); H.line([[w * 0.56, h * 0.81], [w * 0.56, h * 0.87]], 5, '#F2C94C');
};
P.green = (c, px, r, H, w, h) => {
  const top = h * 0.55;
  const turf = []; for (let i = 0; i <= 30; i++) { const a = Math.PI + (i / 30) * Math.PI; turf.push([w * 0.5 + Math.cos(a) * w * 0.48, top + Math.sin(a) * h * 0.16 + Math.sin(i * 0.7) * 2]); }
  turf.push([w * 0.98, h * 0.86]); turf.push([w * 0.02, h * 0.86]);
  H.shape(turf, (x) => { x.fillStyle = '#86C474'; x.fillRect(-50, -50, w + 100, h + 100); x.fillStyle = 'rgba(255,255,255,.14)'; for (let i = 0; i < 9; i += 2) x.fillRect(w * (i / 9), 0, w / 9, h); x.fillStyle = '#5E9E55'; x.fillRect(-50, top + h * 0.02, w + 100, h); });
  H.shape(TX.ellipsePts(w * 0.68, top - h * 0.04, w * 0.05, h * 0.025, 14), '#1d1a16', { lw: 2.5, hatch: false });
  H.line([[w * 0.68, top - h * 0.05], [w * 0.68, h * 0.02]], 4);
  H.shape(TX.polyPts([[w * 0.68, h * 0.03], [w * 0.86, h * 0.1], [w * 0.68, h * 0.18]], 10), '#E2533B', { lw: 4 });
  H.shape(TX.ellipsePts(w * 0.3, top - h * 0.03, w * 0.025, w * 0.025, 12), '#FFFFFF', { lw: 3, hatch: false });
  H.line([[w * 0.16, top - h * 0.36], [w * 0.24, top - h * 0.02]], 4); H.line([[w * 0.24, top - h * 0.02], [w * 0.29, top - h * 0.03]], 6);
  H.shape(TX.rrPts(w * 0.36, h * 0.66, w * 0.3, h * 0.13, 4, 10), '#FFF8E8', { lw: 3.5, hatch: false });
  H.text('PUTT DROP', w * 0.51, h * 0.728, `700 ${Math.round(h * 0.1)}px Caveat`, '#2F5BD3');
};
P.pine = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(w * 0.44, h * 0.8, w * 0.12, h * 0.2, 2, 10), '#8A5C3C', { lw: 3.5 });
  for (let i = 0; i < 3; i++) {
    const y0 = h * (0.06 + i * 0.22), y1 = h * (0.42 + i * 0.2), hw = w * (0.26 + i * 0.1);
    H.shape(TX.polyPts([[w * 0.5, y0], [w * 0.5 + hw, y1], [w * 0.5 - hw, y1]], 12), i % 2 ? '#5F8E62' : '#4F7A55', { lw: 4, ink: '#2E3A26' });
  }
};
P.river = (c, px, r, H, w, h) => {
  const pts = [[0, h]]; for (let i = 0; i <= 60; i++) pts.push([(i / 60) * w, h * 0.25 + Math.sin(i * 0.9) * h * 0.08]); pts.push([w, h]);
  H.shape(pts, '#8FC3E8', { lw: 4, ink: '#3F5E78' });
  for (let i = 0; i < 26; i++) { const x = r() * w * 0.95, y = h * (0.45 + r() * 0.4); H.line([[x, y], [x + w * 0.012, y - 4], [x + w * 0.024, y], [x + w * 0.036, y - 4]], 2.5, 'rgba(255,255,255,.75)'); }
};
P.canoe = (c, px, r, H, w, h) => {
  const hull = []; for (let i = 0; i <= 20; i++) { const t = i / 20; hull.push([w * (0.02 + t * 0.96), h * 0.5 + Math.sin(t * Math.PI) * h * 0.42]); }
  hull.push([w * 0.9, h * 0.5]); hull.push([w * 0.1, h * 0.5]);
  H.shape(hull, '#C2412E', { lw: 4.5 });
  H.line([[w * 0.1, h * 0.55], [w * 0.9, h * 0.55]], 3, '#F6E9D6');
  H.line([[w * 0.6, h * 0.02], [w * 0.74, h * 0.8]], 4); H.shape(TX.ellipsePts(w * 0.75, h * 0.88, w * 0.03, h * 0.12, 10), '#C9A27C', { lw: 3 });
};
P.kiln = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(w * 0.62, h * 0.0, w * 0.14, h * 0.3, 3, 10), '#A8664A', { lw: 4 });
  const dome = []; for (let i = 0; i <= 26; i++) { const a = Math.PI + (i / 26) * Math.PI; dome.push([w * 0.5 + Math.cos(a) * w * 0.46, h * 0.62 + Math.sin(a) * h * 0.5]); }
  dome.push([w * 0.96, h]); dome.push([w * 0.04, h]);
  H.shape(dome, (x) => { x.fillStyle = '#C9805A'; x.fillRect(-50, -50, w + 100, h + 100); x.strokeStyle = 'rgba(90,40,20,.35)'; x.lineWidth = 2; for (let yy = h * 0.2; yy < h; yy += h * 0.09) { x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); for (let xx = ((yy / (h * 0.09)) % 2) * w * 0.08; xx < w; xx += w * 0.16) { x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx, yy + h * 0.09); x.stroke(); } } });
  const door = []; for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; door.push([w * 0.5 + Math.cos(a) * w * 0.18, h * 0.72 + Math.sin(a) * h * 0.18]); }
  door.push([w * 0.68, h]); door.push([w * 0.32, h]);
  H.shape(door, (x) => { const g = x.createRadialGradient(w * 0.5, h * 0.85, 4, w * 0.5, h * 0.85, w * 0.25); g.addColorStop(0, '#FFE6A0'); g.addColorStop(0.5, '#FFB45E'); g.addColorStop(1, '#E2533B'); x.fillStyle = g; x.fillRect(-50, -50, w + 100, h + 100); }, { lw: 4.5 });
};
P.crate = (figs) => (c, px, r, H, w, h) => {
  const top = h * 0.36;
  // tiny clay figures peeking out
  H.shape(TX.ellipsePts(w * 0.2, top - h * 0.06, w * 0.08, h * 0.12, 14), '#8A5A3A', { lw: 3.5 });
  H.dot(w * 0.15, top - h * 0.16, w * 0.025, '#8A5A3A'); H.dot(w * 0.25, top - h * 0.16, w * 0.025, '#8A5A3A');
  H.shape(TX.polyPts([[w * 0.36, top], [w * 0.42, top - h * 0.24], [w * 0.48, top]], 8), '#6B4A2E', { lw: 3.5 });
  H.shape(TX.ellipsePts(w * 0.42, top - h * 0.27, w * 0.035, w * 0.035, 10), '#E0B48A', { lw: 3 });
  H.shape(TX.ellipsePts(w * 0.6, top - h * 0.05, w * 0.06, h * 0.09, 12), '#EF8A5C', { lw: 3.5 });
  H.shape(TX.polyPts([[w * 0.72, top], [w * 0.74, top - h * 0.2], [w * 0.82, top - h * 0.22], [w * 0.84, top]], 8), '#5B7FD6', { lw: 3.5 });
  H.line([[w * 0.73, top - h * 0.14], [w * 0.83, top - h * 0.14]], 3, '#F2C94C');
  H.shape(TX.rrPts(w * 0.03, top, w * 0.94, h - top, 4, 14), '#D9A66B', { lw: 5 });
  for (let i = 1; i < 3; i++) H.line([[w * 0.05, top + (h - top) * i / 3], [w * 0.95, top + (h - top) * i / 3]], 2.5, 'rgba(90,55,25,.5)');
  H.text('48 PACKS', w * 0.5, top + (h - top) * 0.52, `700 ${Math.round(h * 0.2)}px Caveat`, '#5A3517', { rot: -0.03 });
};
P.puff = (c, px, r, H, w, h) => {
  const pts = []; for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU; const rr = 1 + 0.16 * Math.abs(Math.sin(a * 3)); pts.push([w / 2 + Math.cos(a) * w * 0.4 * rr, h / 2 + Math.sin(a) * h * 0.34 * rr]); }
  H.shape(pts, '#EEEBE6', { lw: 3, ink: '#8C8A86' });
};
P.pencil = (c, px, r, H, w, h) => {
  const y0 = h * 0.2, y1 = h * 0.8;
  H.shape(TX.rrPts(0, y0, w * 0.07, y1 - y0, 6, 8), '#F2A6B4', { lw: 4 });
  H.shape(TX.polyPts([[w * 0.07, y0], [w * 0.12, y0], [w * 0.12, y1], [w * 0.07, y1]], 8), '#BFC3C9', { lw: 4 });
  H.shape(TX.polyPts([[w * 0.12, y0], [w * 0.82, y0], [w * 0.82, y1], [w * 0.12, y1]], 18), '#F2C94C', { lw: 4.5 });
  H.line([[w * 0.13, h * 0.5], [w * 0.81, h * 0.5]], 2, 'rgba(160,110,20,.6)');
  H.shape(TX.polyPts([[w * 0.82, y0], [w * 0.97, h * 0.5], [w * 0.82, y1]], 10), '#EAD2A8', { lw: 4.5 });
  H.shape(TX.polyPts([[w * 0.93, h * 0.4], [w * 1.0, h * 0.5], [w * 0.93, h * 0.6]], 6), '#3A3A36', { lw: 2 });
};
P.eraser = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(0, 0, w * 0.4, h, 10, 10), '#8FAEE8', { lw: 4.5 });
  H.shape(TX.rrPts(w * 0.38, 0, w * 0.62, h, 10, 10), '#F2A6B4', { lw: 4.5 });
};
P.miniSign = (txt) => (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(w * 0.46, h * 0.4, w * 0.08, h * 0.6, 2, 10), '#9B6A45', { lw: 3.5 });
  H.shape(TX.rrPts(w * 0.04, h * 0.04, w * 0.92, h * 0.4, 6, 12), '#FFF8E8', { lw: 4 });
  H.text(txt, w * 0.5, h * 0.24, `700 ${Math.round(h * 0.2)}px Caveat`, '#2E5B3A');
};

P.pencilCup = (c, px, r, H, w, h) => {
  const top = h * 0.5;
  [['#F2C94C', 0.3, -0.12, 0.02], ['#2F5BD3', 0.46, 0.02, 0.0], ['#C2412E', 0.6, 0.14, 0.06], ['#7FB59A', 0.72, 0.24, 0.16]].forEach(([col, x0, lean, y0]) => {
    const bx = w * x0, by = h * y0, tx = bx + lean * w;
    H.line([[bx + w * 0.02, top + h * 0.1], [tx + w * 0.02, by + h * 0.08]], w * 0.085, INK, 1);
    H.line([[bx + w * 0.02, top + h * 0.1], [tx + w * 0.02, by + h * 0.08]], w * 0.06, col, 1);
    H.shape(TX.polyPts([[tx - w * 0.01, by + h * 0.09], [tx + w * 0.02, by], [tx + w * 0.05, by + h * 0.09]], 6), '#EAD2A8', { lw: 3, hatch: false });
  });
  H.shape(TX.rrPts(w * 0.12, top, w * 0.76, h * 0.5, 10, 14), '#E6896B', { lw: 5 });
  for (let i = 0; i < 3; i++) H.line([[w * 0.14, top + h * (0.12 + i * 0.13)], [w * 0.86, top + h * (0.12 + i * 0.13)]], 4, 'rgba(255,240,220,.7)');
  H.text('RDW', w * 0.5, top + h * 0.3, `700 ${Math.round(h * 0.1)}px Caveat`, '#5A2F1F', { rot: -0.04 });
};
P.lamp = (c, px, r, H, w, h) => {
  H.shape(TX.ellipsePts(w * 0.34, h * 0.95, w * 0.26, h * 0.045, 16), '#3B37C8', { lw: 4 });
  H.line([[w * 0.34, h * 0.93], [w * 0.2, h * 0.5], [w * 0.52, h * 0.16]], 12, INK, 1);
  H.line([[w * 0.34, h * 0.93], [w * 0.2, h * 0.5], [w * 0.52, h * 0.16]], 7, '#5B7FD6', 1);
  H.dot(w * 0.2, h * 0.5, w * 0.04); H.dot(w * 0.52, h * 0.16, w * 0.04);
  H.shape(TX.polyPts([[w * 0.46, h * 0.08], [w * 0.64, h * 0.04], [w * 0.98, h * 0.3], [w * 0.7, h * 0.4]], 12), '#F2C94C', { lw: 5 });
  H.shape(TX.ellipsePts(w * 0.84, h * 0.36, w * 0.08, h * 0.04, 12, 0, Math.PI), '#FFF4C8', { lw: 3, hatch: false });
};
P.pizza = (c, px, r, H, w, h) => {
  for (let i = 0; i < 3; i++) {
    const y = h * (0.72 - i * 0.24), off = (i % 2 ? 0.03 : -0.02) * w;
    H.shape(TX.rrPts(w * 0.06 + off, y, w * 0.88, h * 0.24, 4, 12), i === 2 ? '#F3DDB4' : '#E9CFA0', { lw: 4.5 });
    H.line([[w * 0.1 + off, y + h * 0.07], [w * 0.9 + off, y + h * 0.07]], 2.5, 'rgba(120,80,40,.45)');
  }
  H.text('hot pizza!', w * 0.5, h * 0.32, `700 ${Math.round(h * 0.14)}px Caveat`, '#C2412E', { rot: -0.04 });
  for (let i = 0; i < 3; i++) { const x = w * (0.3 + i * 0.2); H.line([[x, h * 0.2], [x + w * 0.03, h * 0.12], [x - w * 0.02, h * 0.06], [x + w * 0.02, 0]], 3.5, 'rgba(120,120,120,.7)'); }
};
P.tray = (c, px, r, H, w, h) => {
  [[0.18, -0.12, '#FFF8E8'], [0.42, 0.08, '#DDE9FB'], [0.62, -0.05, '#FFF2A6']].forEach(([x0, rot, col], i) => {
    c.save(); c.translate(w * (x0 + 0.13), h * 0.3); c.rotate(rot); c.translate(-w * 0.13, -h * 0.25);
    H.shape(TX.rrPts(0, 0, w * 0.28, h * 0.42, 4, 10), col, { lw: 4, hatch: false });
    H.line([[w * 0.01, h * 0.02], [w * 0.14, h * 0.22], [w * 0.27, h * 0.02]], 3.5);
    if (i === 1) H.dot(w * 0.14, h * 0.22, w * 0.025, '#E2533B');
    c.restore();
  });
  H.shape(TX.polyPts([[w * 0.02, h * 0.5], [w * 0.98, h * 0.5], [w * 0.92, h], [w * 0.08, h]], 14), '#C9A27C', { lw: 5 });
  H.text('inbox', w * 0.5, h * 0.76, `700 ${Math.round(h * 0.22)}px Caveat`, '#5A3517', { rot: -0.03 });
};
P.paperPlane = (c, px, r, H, w, h) => {
  H.shape(TX.polyPts([[0, h * 0.55], [w, h * 0.1], [w * 0.36, h * 0.72]], 12), '#FFFFFF', { lw: 4, hatch: false });
  H.shape(TX.polyPts([[w * 0.36, h * 0.72], [w, h * 0.1], [w * 0.44, h * 0.98]], 12), '#DDE9FB', { lw: 4, hatch: false });
  for (let i = 0; i < 3; i++) H.line([[-w * 0.02 - i * w * 0.0, h * (0.66 + i * 0.1)], [w * (0.12 - i * 0.03), h * (0.64 + i * 0.1)]], 3, 'rgba(58,58,54,.45)');
};
P.toolbench = (c, px, r, H, w, h) => {
  const top = h * 0.4;
  H.line([[w * 0.1, top], [w * 0.08, h]], 8); H.line([[w * 0.9, top], [w * 0.92, h]], 8);
  H.line([[w * 0.09, h * 0.8], [w * 0.91, h * 0.8]], 5);
  H.shape(TX.rrPts(w * 0.02, top, w * 0.96, h * 0.1, 5, 14), '#B98A5C', { lw: 5 });
  // small laptop
  H.shape(TX.polyPts([[w * 0.12, top], [w * 0.16, top - h * 0.3], [w * 0.42, top - h * 0.3], [w * 0.42, top]], 10), '#3B2414', { lw: 4, hatch: false });
  H.shape(TX.rrPts(w * 0.18, top - h * 0.26, w * 0.21, h * 0.2, 3, 8), '#8FC3E8', { lw: 2.5, hatch: false });
  H.text('</>', w * 0.285, top - h * 0.16, `700 ${Math.round(h * 0.12)}px Caveat`, '#2F5BD3');
  H.shape(TX.rrPts(w * 0.08, top - h * 0.03, w * 0.38, h * 0.04, 2, 8), '#7A6A5A', { lw: 3, hatch: false });
  // hammer and screwdriver
  H.line([[w * 0.52, top - h * 0.02], [w * 0.66, top - h * 0.14]], 7, '#9B6A45');
  H.shape(TX.rrPts(w * 0.62, top - h * 0.26, w * 0.12, h * 0.1, 3, 8), '#9AA3AE', { lw: 4, hatch: false });
  H.line([[w * 0.72, top - h * 0.03], [w * 0.86, top - h * 0.05]], 4, '#9AA3AE');
  H.shape(TX.rrPts(w * 0.8, top - h * 0.09, w * 0.1, h * 0.07, 3, 8), '#E2533B', { lw: 3.5, hatch: false });
  // clay blob
  H.shape(TX.ellipsePts(w * 0.5, top - h * 0.05, w * 0.045, h * 0.06, 12), '#EF8A5C', { lw: 3 });
};
P.rocket = (c, px, r, H, w, h) => {
  const bodyTop = h * 0.02, bodyBot = h * 0.72;
  H.line([[w * 0.18, h * 0.74], [w * 0.06, h]], 6); H.line([[w * 0.82, h * 0.74], [w * 0.94, h]], 6);
  H.line([[w * 0.1, h * 0.9], [w * 0.9, h * 0.9]], 4);
  H.shape(TX.polyPts([[w * 0.32, bodyBot - h * 0.18], [w * 0.08, bodyBot], [w * 0.32, bodyBot]], 8), '#C2412E', { lw: 4.5 });
  H.shape(TX.polyPts([[w * 0.68, bodyBot - h * 0.18], [w * 0.92, bodyBot], [w * 0.68, bodyBot]], 8), '#C2412E', { lw: 4.5 });
  const b = []; for (let i = 0; i <= 16; i++) { const t = i / 16; b.push([w * 0.5 - Math.sin(t * Math.PI * 0.5 + 0.1) * w * 0.2, bodyTop + t * (bodyBot - bodyTop)]); }
  for (let i = 16; i >= 0; i--) { const t = i / 16; b.push([w * 0.5 + Math.sin(t * Math.PI * 0.5 + 0.1) * w * 0.2, bodyTop + t * (bodyBot - bodyTop)]); }
  H.shape(b, '#F6F1E6', { lw: 5 });
  H.shape(TX.ellipsePts(w * 0.5, h * 0.3, w * 0.09, w * 0.09, 14), '#8FC3E8', { lw: 4, hatch: false });
  H.line([[w * 0.34, h * 0.5], [w * 0.66, h * 0.5]], 3, '#C2412E');
  H.text('SWARM', w * 0.5, h * 0.58, `700 ${Math.round(w * 0.12)}px Caveat`, '#2F5BD3', { rot: -Math.PI / 2 + 0.02 });
};
P.flame = (c, px, r, H, w, h) => {
  H.shape(TX.polyPts([[w * 0.1, 0], [w * 0.9, 0], [w * 0.62, h * 0.55], [w * 0.5, h], [w * 0.38, h * 0.55]], 10), '#FFB45E', { lw: 3.5, ink: '#C2412E' });
  H.shape(TX.polyPts([[w * 0.3, 0], [w * 0.7, 0], [w * 0.5, h * 0.55]], 8), '#FFE6A0', { lw: 0 });
};
P.mailbox = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(w * 0.42, h * 0.48, w * 0.14, h * 0.52, 3, 12), '#9B6A45', { lw: 4.5 });
  const top = h * 0.1, bot = h * 0.52, x0 = w * 0.06, x1 = w * 0.86;
  const pts = []; for (let i = 0; i <= 14; i++) { const a = Math.PI + (i / 14) * Math.PI; pts.push([(x0 + x1) / 2 + Math.cos(a) * (x1 - x0) / 2, top + (h * 0.16) + Math.sin(a) * h * 0.16]); }
  pts.push([x1, bot]); pts.push([x0, bot]);
  H.shape(pts, '#5B7FD6', { lw: 5 });
  H.shape(TX.rrPts(x0 + w * 0.04, top + h * 0.06, w * 0.24, bot - top - h * 0.1, 10, 10), '#4A6BC0', { lw: 3.5, hatch: false });
  H.text('RDW', (x0 + x1) / 2 + w * 0.12, top + h * 0.25, `700 ${Math.round(h * 0.11)}px Caveat`, '#FFF8E8', { rot: -0.03 });
  H.line([[x0 + w * 0.3, bot - h * 0.06], [x1 - w * 0.06, bot - h * 0.06]], 3, 'rgba(255,255,255,.5)');
  for (let i = 0; i < 3; i++) H.line([[w * (0.3 + i * 0.14), h], [w * (0.26 + i * 0.16), h * 0.92]], 3.5, '#4F7A45');
};
P.flag = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(w * 0.0, h * 0.4, w * 0.82, h * 0.2, 3, 8), '#9AA3AE', { lw: 3.5, hatch: false });
  H.shape(TX.rrPts(w * 0.62, 0, w * 0.36, h * 0.6, 4, 8), '#E2533B', { lw: 4 });
};
P.envelope = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(0, 0, w, h, 4, 8), '#FFF8E8', { lw: 4, hatch: false });
  H.line([[w * 0.02, h * 0.04], [w * 0.5, h * 0.55], [w * 0.98, h * 0.04]], 3.5);
  H.dot(w * 0.5, h * 0.55, w * 0.07, '#E2533B');
};
P.doodle = (kind) => (c, px, r, H, w, h) => {
  if (kind === 'heart') { const pts = []; for (let i = 0; i <= 30; i++) { const t = (i / 30) * TAU; pts.push([w / 2 + w * 0.4 * Math.pow(Math.sin(t), 3), h * 0.45 - h * 0.35 * (0.8 * Math.cos(t) - 0.3 * Math.cos(2 * t) - 0.15 * Math.cos(3 * t))]); } H.shape(pts, '#EF8A5C', { lw: 3.5, hatch: false }); }
  if (kind === 'star') { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 0.2 : 0.46; pts.push([w / 2 + Math.cos(a) * w * rr, h / 2 + Math.sin(a) * h * rr]); } H.shape(TX.polyPts([...pts, pts[0]].slice(0, 10), 8), '#F2C94C', { lw: 3.5, hatch: false }); }
};

// per-stop foreground props (sit just behind Lumpy so they never cover it)
P.stool = (c, px, r, H, w, h) => {
  H.shape(TX.ellipsePts(w * 0.5, h * 0.95, w * 0.38, h * 0.045, 14), '#9AA3AE', { lw: 3.5, hatch: false });
  H.shape(TX.rrPts(w * 0.44, h * 0.2, w * 0.12, h * 0.74, 3, 10), '#C9CDD3', { lw: 4, hatch: false });
  H.line([[w * 0.22, h * 0.64], [w * 0.78, h * 0.64]], 5, '#9AA3AE');
  H.shape(TX.rrPts(w * 0.04, h * 0.03, w * 0.92, h * 0.2, 14, 14), '#C2412E', { lw: 4.5 });
  H.line([[w * 0.12, h * 0.1], [w * 0.88, h * 0.1]], 2.5, 'rgba(255,255,255,.55)');
};
P.mug = (c, px, r, H, w, h) => {
  const hd = TX.ellipsePts(w * 0.74, h * 0.56, w * 0.18, h * 0.17, 12, -Math.PI / 2, Math.PI / 2);
  H.line(hd, 9, INK, 1); H.line(hd, 5, '#F6F1E6', 1);
  H.shape(TX.rrPts(w * 0.06, h * 0.28, w * 0.64, h * 0.7, 8, 12), '#F6F1E6', { lw: 4.5 });
  H.text('RDW', w * 0.38, h * 0.62, `700 ${Math.round(h * 0.22)}px Caveat`, '#C2412E', { rot: -0.05 });
  for (let i = 0; i < 2; i++) { const x = w * (0.28 + i * 0.2); H.line([[x, h * 0.22], [x + w * 0.05, h * 0.13], [x - w * 0.03, h * 0.06], [x + w * 0.02, 0]], 3, 'rgba(120,120,120,.7)'); }
};
P.golfbag = (c, px, r, H, w, h) => {
  [[0.3, '#9AA3AE'], [0.5, '#C9CDD3'], [0.7, '#9AA3AE']].forEach(([x, col], i) => {
    H.line([[w * x, h * 0.3], [w * (x + (i - 1) * 0.06), h * 0.08]], 4, INK);
    H.shape(TX.rrPts(w * (x + (i - 1) * 0.06) - w * 0.08, h * 0.02, w * 0.18, h * 0.07, 3, 8), col, { lw: 3, hatch: false });
  });
  H.shape(TX.rrPts(w * 0.16, h * 0.24, w * 0.68, h * 0.74, 14, 14), '#2F5BD3', { lw: 4.5 });
  H.shape(TX.rrPts(w * 0.12, h * 0.24, w * 0.76, h * 0.1, 4, 10), '#F6F1E6', { lw: 3.5, hatch: false });
  H.line([[w * 0.84, h * 0.36], [w * 0.98, h * 0.6], [w * 0.84, h * 0.84]], 4, '#3A3A36');
  H.dot(w * 0.4, h * 0.95, w * 0.06, '#FFFFFF');
};
P.pots = (c, px, r, H, w, h) => {
  const pot = (x0, y0, pw, ph, col) => {
    H.shape(TX.polyPts([[x0, y0], [x0 + pw, y0], [x0 + pw * 0.86, y0 + ph], [x0 + pw * 0.14, y0 + ph]], 10), col, { lw: 4 });
    H.shape(TX.rrPts(x0 - pw * 0.05, y0 - ph * 0.08, pw * 1.1, ph * 0.18, 3, 8), col, { lw: 3.5 });
  };
  pot(w * 0.04, h * 0.55, w * 0.46, h * 0.42, '#C9805A');
  pot(w * 0.52, h * 0.6, w * 0.42, h * 0.37, '#E0A878');
  pot(w * 0.28, h * 0.16, w * 0.4, h * 0.36, '#B5694A');
  H.shape(TX.ellipsePts(w * 0.48, h * 0.12, w * 0.08, h * 0.08, 10), '#EF8A5C', { lw: 3 });
};
P.rock = (c, px, r, H, w, h) => {
  const pts = []; for (let i = 0; i <= 22; i++) { const a = Math.PI + (i / 22) * Math.PI; pts.push([w * 0.5 + Math.cos(a) * w * 0.46, h * 0.98 + Math.sin(a) * h * 0.66 * (1 + 0.1 * Math.sin(i))]); }
  H.shape(pts, '#B8B4AA', { lw: 4.5, ink: '#5E5B54' });
  H.line([[w * 0.3, h * 0.6], [w * 0.42, h * 0.52]], 2.5, 'rgba(60,60,55,.45)');
  for (let i = 0; i < 4; i++) H.line([[w * (0.72 + i * 0.06), h], [w * (0.7 + i * 0.08), h * 0.55]], 3.5, '#4F7A45');
};
P.stump = (c, px, r, H, w, h) => {
  [[0.24, -1], [0.76, 1], [0.5, 0.2]].forEach(([x, d]) => H.shape(TX.polyPts([[w * (x - 0.08), h * 0.75], [w * (x + 0.08), h * 0.75], [w * (x + 0.06 + d * 0.2), h * 0.99], [w * (x - 0.04 + d * 0.2), h * 0.99]], 8), '#7A4E32', { lw: 3.5 }));
  H.shape(TX.rrPts(w * 0.2, h * 0.3, w * 0.6, h * 0.55, 6, 12), '#8A5C3C', { lw: 4.5 });
  H.shape(TX.ellipsePts(w * 0.5, h * 0.3, w * 0.3, h * 0.08, 16), '#E3BF94', { lw: 4 });
  H.line(TX.ellipsePts(w * 0.5, h * 0.3, w * 0.17, h * 0.045, 14), 2.5, 'rgba(120,70,40,.6)');
  for (let i = 0; i < 3; i++) H.line([[w * (0.3 + i * 0.16), h * 0.45], [w * (0.31 + i * 0.16), h * 0.78]], 2.5, 'rgba(60,35,20,.4)');
  H.line([[w * 0.86, h * 0.98], [w * 0.86, h * 0.76]], 4, '#F6F1E6');
  H.shape(TX.ellipsePts(w * 0.86, h * 0.76, w * 0.1, h * 0.07, 12, Math.PI, TAU), '#E2533B', { lw: 3.5, hatch: false });
};
P.boxes = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(w * 0.04, h * 0.44, w * 0.92, h * 0.54, 3, 12), '#D9A66B', { lw: 4.5 });
  H.line([[w * 0.5, h * 0.44], [w * 0.5, h * 0.62]], 6, 'rgba(240,225,190,.9)');
  H.shape(TX.rrPts(w * 0.2, h * 0.04, w * 0.6, h * 0.4, 3, 12), '#E3BF94', { lw: 4.5 });
  H.text('↑ ↑', w * 0.5, h * 0.24, `700 ${Math.round(h * 0.2)}px Caveat`, '#5A3517');
  H.text('this side up', w * 0.5, h * 0.78, `700 ${Math.round(h * 0.13)}px Caveat`, '#5A3517', { rot: -0.03 });
};
P.peel = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(w * 0.42, h * 0.02, w * 0.16, h * 0.62, 6, 10), '#C9A27C', { lw: 4 });
  H.shape(TX.rrPts(w * 0.06, h * 0.56, w * 0.88, h * 0.42, 22, 14), '#E3BF94', { lw: 4.5 });
  H.dot(w * 0.5, h * 0.08, w * 0.05);
};
P.cone = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(w * 0.02, h * 0.86, w * 0.96, h * 0.12, 3, 10), '#E2533B', { lw: 4 });
  H.shape(TX.polyPts([[w * 0.42, h * 0.02], [w * 0.58, h * 0.02], [w * 0.84, h * 0.86], [w * 0.16, h * 0.86]], 12), '#F28A3C', { lw: 4.5 });
  H.shape(TX.polyPts([[w * 0.33, h * 0.32], [w * 0.67, h * 0.32], [w * 0.72, h * 0.48], [w * 0.28, h * 0.48]], 8), '#FFF8E8', { lw: 2.5, hatch: false });
  H.shape(TX.polyPts([[w * 0.25, h * 0.6], [w * 0.75, h * 0.6], [w * 0.79, h * 0.72], [w * 0.21, h * 0.72]], 8), '#FFF8E8', { lw: 2.5, hatch: false });
};
P.cactus = (c, px, r, H, w, h) => {
  H.shape(TX.rrPts(w * 0.4, h * 0.08, w * 0.22, h * 0.6, 20, 12), '#7FB59A', { lw: 4 });
  H.shape(TX.rrPts(w * 0.16, h * 0.26, w * 0.14, h * 0.26, 12, 10), '#7FB59A', { lw: 3.5 });
  H.line([[w * 0.28, h * 0.48], [w * 0.42, h * 0.48]], 7, '#7FB59A');
  H.dot(w * 0.51, h * 0.06, w * 0.05, '#EF8A5C');
  H.shape(TX.polyPts([[w * 0.2, h * 0.62], [w * 0.82, h * 0.62], [w * 0.74, h * 0.98], [w * 0.28, h * 0.98]], 10), '#F2A6B4', { lw: 4.5 });
  H.line([[w * 0.22, h * 0.7], [w * 0.8, h * 0.7]], 3, 'rgba(255,255,255,.6)');
};
// flat bits lying on the mat
P.clip = (c, px, r, H, w, h) => {
  const p = [[w * 0.9, h * 0.75], [w * 0.1, h * 0.75], [w * 0.04, h * 0.5], [w * 0.1, h * 0.25], [w * 0.95, h * 0.25], [w * 0.98, h * 0.5], [w * 0.94, h * 0.68], [w * 0.25, h * 0.62], [w * 0.22, h * 0.5], [w * 0.25, h * 0.38], [w * 0.8, h * 0.38]];
  H.line(p, 6, '#7E8792', 1); H.line(p, 2.5, '#DDE2E8', 1);
};
P.tack = (col) => (c, px, r, H, w, h) => { H.shape(TX.ellipsePts(w / 2, h / 2, w * 0.44, h * 0.44, 16), col, { lw: 3.5, hatch: false }); H.dot(w * 0.38, h * 0.38, w * 0.1, 'rgba(255,255,255,.7)'); };
P.scrap = (txt, col) => (c, px, r, H, w, h) => {
  H.shape(TX.polyPts([[w * 0.02, h * 0.08], [w * 0.5, 0], [w * 0.98, h * 0.06], [w * 0.95, h * 0.94], [w * 0.4, h], [w * 0.04, h * 0.92]], 10), '#FFF8E8', { lw: 2.5, hatch: false, ink: 'rgba(58,58,54,.5)' });
  H.text(txt, w * 0.5, h * 0.52, `700 ${Math.round(h * 0.5)}px Caveat`, col, { rot: -0.05 });
};

// ------------------------------------------------------------------ module
export async function startAbout({ canvas, reduced }) {
  const aboutEl = document.getElementById('about');
  const loader = document.getElementById('aLoader');
  const walk = document.getElementById('walk');
  const labels = document.getElementById('walkLabels');
  const pill = document.getElementById('walkPill');
  const walkBar = document.getElementById('walkBar');
  const rest = document.getElementById('aboutRest');
  loader.hidden = false; loader.classList.remove('out');
  aboutEl.classList.remove('plain');

  // route-scoped CSS: the walk is the whole page; the "plain version" (#aboutRest) only shows on request
  const css = document.createElement('style');
  css.id = 'aboutWalkCSS';
  css.textContent = `
    #site:not(.nogl) #about:not(.plain) #aboutRest{display:none}
    #site[data-route="about"]:not(.nogl) #about:not(.plain){height:100vh;overflow:hidden}
    #about .afoot{background:none!important;color:#5E5E58!important;clip-path:none!important;font-size:15px!important;min-height:0!important;padding-top:12px!important;padding-bottom:18px!important;margin-top:0!important}
    #about .afoot a{color:#2F5BD3!important}
    #walkLabels{position:absolute;inset:0;overflow:hidden;pointer-events:none}
    #walkLabels .sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap}
    #walkLabels .wl{position:absolute;left:0;top:0;transform-origin:50% 50%;pointer-events:auto;font-family:'Caveat',cursive;font-weight:700;font-size:30px;line-height:1;color:#2F5BD3;text-decoration:underline;text-decoration-style:wavy;text-decoration-color:rgba(47,91,211,.6);text-decoration-thickness:2px;text-underline-offset:7px;padding:6px 6px 10px;white-space:nowrap;will-change:transform;background:none;border:0;cursor:pointer;visibility:hidden}
    #walkLabels .wl:hover{color:#1D3F9E}
    #walkLabels .wl:focus-visible{outline:3px dashed #2F5BD3;outline-offset:4px;border-radius:6px}
    #walkLabels .wl.btn{background:#EF8A5C;color:#2B2B2B;text-decoration:none;font-size:34px;padding:12px 26px 14px;border-radius:4px;clip-path:polygon(2% 6%,30% 0,62% 5%,98% 0,100% 50%,97% 96%,64% 100%,30% 95%,0 100%,1% 50%);filter:drop-shadow(0 0 0 #FBFAF5)}
    #walkLabels .wlwrap{position:absolute;left:0;top:0;pointer-events:none;filter:drop-shadow(3px 3px 0 #FBFAF5) drop-shadow(-2px -2px 0 #FBFAF5) drop-shadow(8px 10px 10px rgba(50,40,30,.35))}
    #walkLabels .wlwrap .wl{position:static;visibility:visible;display:inline-block}
    #walkLabels .wl.back{color:#3A3A36;text-decoration-color:rgba(58,58,54,.5);font-size:26px}
    #walkLabels .wl.note{pointer-events:none;text-shadow:0 0 3px #F3F1EA,0 0 6px #F3F1EA;cursor:default;text-decoration:none;font-family:'Patrick Hand',cursive;font-weight:400;font-size:19px;color:#3A3A36;padding:2px}
    #walkLabels .wl.note.fine{font-size:13px;color:#6A6862}
    #walk .skiprest{background:none;font-size:17px;text-decoration:underline;opacity:.75}
    #walk .pill{background:rgba(58,52,46,.82)}
    @media (max-width:600px){ #walk .pill{bottom:24px;right:auto;left:50%;transform:translateX(-50%)} #walk .walkbar{display:none} #walk .skiprest{bottom:auto;top:84px} }
  `;
  document.head.appendChild(css);

  // ---------- loader animation ----------
  const ink = document.getElementById('pencilInk'), hopper = document.getElementById('hopper'), hopBody = document.getElementById('hopBody'), pctEl = document.getElementById('aPct');
  const L = ink.getTotalLength(); ink.style.strokeDasharray = `${L} ${L}`;
  const inkS = { x: 0, v: 0 };
  let loadTarget = 0, loadShown = 0, loaderAlive = true, loaderDone = false;
  const t0 = performance.now();
  function loaderTick() {
    if (!loaderAlive) return;
    const t = (performance.now() - t0) / 1000;
    const rate = loadTarget >= 1 ? 2.2 : 1.1;
    loadShown = Math.min(loadTarget, loadShown + rate * (1 / 60));
    inkS.v += (loadShown - inkS.x) * 0.12; inkS.v *= 0.72; inkS.x += inkS.v;
    ink.style.strokeDashoffset = String(L * (1 - clamp(inkS.x, 0, 1.02)));
    const p = ink.getPointAtLength(L * clamp(inkS.x, 0, 1));
    const hop = reduced ? 0 : Math.abs(Math.sin(t * 7)) * 16;
    hopper.setAttribute('transform', `translate(${p.x},${p.y - 4})`);
    hopBody.setAttribute('transform', `translate(0,${-hop}) rotate(${reduced ? 0 : Math.sin(t * 7) * 6})`);
    pctEl.textContent = Math.round(loadShown * 100) + '%';
    if (loadShown >= 1 && !loaderDone) { loaderDone = true; const ph = M0 || matchMedia('(hover: none)').matches; setTimeout(hideLoader, reduced ? 300 : ph ? 250 : 1500); }
    requestAnimationFrame(loaderTick);
  }
  requestAnimationFrame(loaderTick);
  function hideLoader() { loader.classList.add('out'); setTimeout(() => { loaderAlive = false; loader.hidden = true; }, matchMedia('(hover: none)').matches ? 450 : 1000); }
  const onSkip = (e) => { e.preventDefault(); e.stopPropagation(); loadTarget = 1; loadShown = 1; if (!loaderDone) { loaderDone = true; hideLoader(); } };
  const onPlain = (e) => { onSkip(e); setTimeout(() => goRest(), 50); };
  document.getElementById('aSkip').addEventListener('click', onSkip);
  const blockWhileLoading = (e) => { if (loaderAlive && !loader.classList.contains('out')) e.preventDefault(); };
  window.addEventListener('wheel', blockWhileLoading, { passive: false });
  loader.addEventListener('touchmove', blockWhileLoading, { passive: false });
  document.getElementById('aPlain').addEventListener('click', onPlain);

  try { await Promise.race([Promise.all(['700 40px Caveat', '500 40px Caveat', '30px VT323', '20px "Patrick Hand"'].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 2000))]); } catch (e) { /* ok */ }
  loadTarget = 0.12; await nextFrame();

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(DPR);
  renderer.toneMapping = THREE.NoToneMapping; // flat, painted look
  renderer.outputColorSpace = SRGB;
  let W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H, false);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#F3F1EA');
  const cam = new THREE.PerspectiveCamera(35, W / H, 0.1, 200);
  const tanF = Math.tan(THREE.MathUtils.degToRad(17.5));

  const tex = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = SRGB; t.anisotropy = maxAniso; return t; };
  const basic = (t, extra = {}) => new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.02, depthWrite: true, side: THREE.DoubleSide, ...extra });
  const clickables = [];

  // cutout factory: plane + offset shadow plane behind it, anchored at bottom centre
  function cutout(paint, wU, hU, pos, { px = 150, seed = 1, rotY = 0, rotZ = 0, shadow = [0.08, -0.06], floorShadow = false, href = null, parent = scene } = {}) {
    const art = paintCutout(wU, hU, paint, { px, seed });
    const g = new THREE.Group(); g.position.set(pos[0], pos[1], pos[2]); g.rotation.y = rotY; g.rotation.z = rotZ;
    const geo = new THREE.PlaneGeometry(art.wU, art.hU);
    const main = new THREE.Mesh(geo, basic(tex(art.sil)));
    main.position.y = hU / 2; main.renderOrder = 2; g.add(main);
    if (shadow) {
      const sm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex(art.sh), transparent: true, depthWrite: false, opacity: 0.85 }));
      sm.position.set(shadow[0], hU / 2 + shadow[1], -0.05); sm.renderOrder = 1; g.add(sm);
    }
    if (floorShadow) {
      const fs = new THREE.Mesh(new THREE.PlaneGeometry(wU * 1.05, 0.5), new THREE.MeshBasicMaterial({ map: floorShadowTex, transparent: true, depthWrite: false, opacity: 0.6 }));
      fs.rotation.x = -Math.PI / 2; fs.position.set(0.05, 0.004 - pos[1], 0.02); fs.renderOrder = 1; g.add(fs);
    }
    if (href) { main.userData.href = href; clickables.push(main); }
    parent.add(g);
    return g;
  }
  const floorShadowTex = (() => { const c = TX.makeCanvas(256, 64), x = c.getContext('2d'); x.translate(128, 32); x.scale(1, 0.25); const g = x.createRadialGradient(0, 0, 0, 0, 0, 128); g.addColorStop(0, 'rgba(30,50,35,.55)'); g.addColorStop(1, 'rgba(30,50,35,0)'); x.fillStyle = g; x.fillRect(-128, -128, 256, 256); return tex(c); })();

  // hand-lettering written straight onto the paper wall (canvas text, wrapped to a width in world units)
  // phone layout is decided once at start: narrower text columns, lifted above the props
  const M0 = window.innerWidth / window.innerHeight < 0.85;
  const LET = { big: [M0 ? 0.42 : 0.5, 'cav', 0.95], title: [0.34, 'cav', 1.02], body: [0.185, 'ph', 1.3], small: [0.13, 'ph', 1.3] };
  const meas = TX.makeCanvas(8, 8).getContext('2d');
  function letter(blocks, { x, y, w, rot = 0, align = 'left', px = 230, seed = 1, mx, my, mw }) {
    if (M0) { x = mx ?? x; y = my ?? y + 0.4; w = mw ?? Math.min(w, 2.4); rot *= 0.5; }
    const r = TX.rng(seed);
    const font = (k) => { const [sz, f] = LET[k]; const p = Math.round(sz * px); return f === 'cav' ? `700 ${p}px Caveat` : `${p}px "Patrick Hand"`; };
    const Wpx = Math.ceil(w * px); const lines = []; let yy = 0;
    blocks.forEach((b) => {
      meas.font = font(b.k); const lh = LET[b.k][0] * LET[b.k][2] * px;
      const out = []; let cur = '';
      b.t.split(' ').forEach((wd) => { const test = cur ? cur + ' ' + wd : wd; if (meas.measureText(test).width > Wpx && cur) { out.push(cur); cur = wd; } else cur = test; });
      if (cur) out.push(cur);
      out.forEach((l) => { lines.push({ l, k: b.k, c: b.c || '#2E2D2A', y: yy + lh * 0.52, u: b.u }); yy += lh; });
      yy += (b.gap ?? 0.08) * px;
    });
    const pad = 24, cw = Wpx + pad * 2, ch = Math.ceil(yy) + pad * 2;
    const cv = TX.makeCanvas(cw, ch), c = cv.getContext('2d');
    c.translate(pad, pad); c.textBaseline = 'middle'; c.textAlign = align;
    const ax = align === 'center' ? Wpx / 2 : 0;
    lines.forEach((ln) => {
      c.save(); c.translate(ax, ln.y + (r() - 0.5) * 3); c.rotate((r() - 0.5) * 0.016);
      c.font = font(ln.k); c.fillStyle = ln.c; c.globalAlpha = 0.94; c.fillText(ln.l, 0, 0);
      if (ln.u) { const lw = c.measureText(ln.l).width, x0 = align === 'center' ? -lw / 2 : 0, yU = LET[ln.k][0] * px * 0.52; c.strokeStyle = ln.c; c.lineWidth = Math.max(3, px * 0.018); c.lineCap = 'round'; c.globalAlpha = 0.8; TX.wobblyPath(c, [[x0, yU], [x0 + lw * 0.5, yU + 4], [x0 + lw, yU - 2]], r, 2, false); c.stroke(); }
      c.restore();
    });
    const t = tex(cv);
    const wU = cw / px, hU = ch / px;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wU, hU), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.position.set(x, y + pad / px - hU / 2, Z.wall + 0.02); m.rotation.z = rot; scene.add(m);
    return { x, top: y, bottom: y - (ch - pad * 2) / px };
  }

  // ---------- wall: lined paper ----------
  const WX0 = -14, WX1 = 86, WC = (WX0 + WX1) / 2, WW = WX1 - WX0;
  {
    const c = TX.makeCanvas(512, 468), x = c.getContext('2d'), r = TX.rng(2);
    x.fillStyle = '#f1efe8'; x.fillRect(0, 0, 512, 468);
    TX.grain(x, 512, 468, 13, r);
    x.fillStyle = '#b9c8e6'; for (let y = 39; y < 468; y += 78) x.fillRect(0, y, 512, 2);
    const t = tex(c); t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(WW / 2, 6); t.anisotropy = maxAniso;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(WW, 12), new THREE.MeshBasicMaterial({ map: t }));
    wall.position.set(WC, 6, Z.wall); scene.add(wall);
    const sc = TX.makeCanvas(4, 256), sx = sc.getContext('2d'); const g = sx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,250,235,.0)'); g.addColorStop(0.7, 'rgba(120,100,80,0)'); g.addColorStop(1, 'rgba(90,80,60,.22)');
    sx.fillStyle = g; sx.fillRect(0, 0, 4, 256);
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(WW, 12), new THREE.MeshBasicMaterial({ map: tex(sc), transparent: true, depthWrite: false }));
    shade.position.set(WC, 6, Z.wall + 0.005); scene.add(shade);
    for (let mx = -8.4; mx < WX1; mx += 17.3) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 12), new THREE.MeshBasicMaterial({ color: '#e9a0a0' })); m.position.set(mx, 6, Z.wall + 0.01); scene.add(m); }
    const base = new THREE.Mesh(new THREE.PlaneGeometry(WW, 0.14), new THREE.MeshBasicMaterial({ color: '#E3D3B4' })); base.position.set(WC, 0.07, Z.wall + 0.02); scene.add(base);
  }
  // ---------- floor: green cutting mat in perspective ----------
  const MZ0 = Z.wall, MZ1 = 16;
  {
    const S = 1024, U = 4; // texture tile = 4 x 4 units
    const c = TX.makeCanvas(S, S), x = c.getContext('2d'), r = TX.rng(4);
    x.fillStyle = '#5E9C7E'; x.fillRect(0, 0, S, S);
    TX.fbm(x, S, S, r, { start: 6, octaves: 3, alpha: 0.05, mode: 'multiply' });
    const pu = S / U;
    x.strokeStyle = 'rgba(225,245,230,.28)'; x.lineWidth = 1.6;
    for (let i = 0; i < U * 4; i++) { const p = i * pu / 4; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.moveTo(0, p); x.lineTo(S, p); x.stroke(); }
    x.strokeStyle = 'rgba(235,250,238,.62)'; x.lineWidth = 3.2;
    for (let i = 0; i < U; i++) { const p = i * pu + 1.6; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.moveTo(0, p); x.lineTo(S, p); x.stroke(); }
    x.strokeStyle = 'rgba(235,250,238,.22)'; x.lineWidth = 1.6; x.setLineDash([14, 10]);
    x.beginPath(); x.moveTo(0, S); x.lineTo(S, 0); x.stroke(); x.setLineDash([]);
    TX.grain(x, S, S, 9, r);
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(WW / U, (MZ1 - MZ0) / U);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(WW, MZ1 - MZ0), new THREE.MeshBasicMaterial({ map: t }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(WC, 0, (MZ0 + MZ1) / 2); scene.add(floor);
    // soft light falloff (brighter by the wall, darker toward the viewer)
    const gc = TX.makeCanvas(4, 256), gx = gc.getContext('2d'); const gg = gx.createLinearGradient(0, 0, 0, 256);
    gg.addColorStop(0, 'rgba(255,255,240,.16)'); gg.addColorStop(0.35, 'rgba(255,255,240,0)'); gg.addColorStop(1, 'rgba(20,45,30,.3)');
    gx.fillStyle = gg; gx.fillRect(0, 0, 4, 256);
    const fo = new THREE.Mesh(new THREE.PlaneGeometry(WW, MZ1 - MZ0), new THREE.MeshBasicMaterial({ map: tex(gc), transparent: true, depthWrite: false }));
    fo.rotation.x = -Math.PI / 2; fo.position.set(WC, 0.002, (MZ0 + MZ1) / 2); scene.add(fo);
    // ruler edge along the back of the mat, numbered every unit
    const RW = 8192, rc = TX.makeCanvas(RW, 96), rx = rc.getContext('2d'); const ppu = RW / WW;
    rx.fillStyle = '#4E8A6D'; rx.fillRect(0, 0, RW, 96);
    rx.fillStyle = 'rgba(240,252,242,.9)'; rx.font = '700 30px "Patrick Hand"'; rx.textAlign = 'center'; rx.textBaseline = 'middle';
    for (let u = 0; u <= WW * 4; u++) { const px = u * ppu / 4, major = u % 4 === 0; rx.fillRect(px - 1, 0, major ? 3 : 2, major ? 34 : (u % 2 ? 14 : 22)); if (major) rx.fillText(String(u / 4), px, 64); }
    const ruler = new THREE.Mesh(new THREE.PlaneGeometry(WW, 0.32), new THREE.MeshBasicMaterial({ map: tex(rc) }));
    ruler.rotation.x = -Math.PI / 2; ruler.position.set(WC, 0.003, Z.wall + 0.18); scene.add(ruler);
    // Lumpy's path: a strip of paper tape with a dashed "cut here" line and little chevrons (tile = 4 units, seamless)
    const TW = 1024, TH = 150, pc = TX.makeCanvas(TW, TH), px2 = pc.getContext('2d'), pr = TX.rng(9);
    const edge = (y0, k) => { const p = []; for (let i = 0; i <= 64; i++) { const xx = (i / 64) * TW; p.push([xx, y0 + Math.sin((i / 64) * TAU * 5 + k) * 3 + Math.sin((i / 64) * TAU * 13 + k * 2) * 2]); } return p; };
    const top = edge(14, 0), bot = edge(TH - 14, 1.7);
    px2.beginPath(); top.forEach(([a, b], i) => (i ? px2.lineTo(a, b) : px2.moveTo(a, b))); for (let i = bot.length - 1; i >= 0; i--) px2.lineTo(bot[i][0], bot[i][1]); px2.closePath();
    px2.fillStyle = 'rgba(238,226,198,.92)'; px2.fill();
    px2.save(); px2.clip(); TX.grain(px2, TW, TH, 10, pr); px2.restore();
    px2.strokeStyle = 'rgba(120,95,60,.35)'; px2.lineWidth = 2.5; px2.beginPath(); top.forEach(([a, b], i) => (i ? px2.lineTo(a, b) : px2.moveTo(a, b))); px2.stroke(); px2.beginPath(); bot.forEach(([a, b], i) => (i ? px2.lineTo(a, b) : px2.moveTo(a, b))); px2.stroke();
    px2.strokeStyle = 'rgba(194,65,46,.7)'; px2.lineWidth = 4; px2.setLineDash([32, 32]); px2.beginPath(); px2.moveTo(0, TH * 0.62); px2.lineTo(TW, TH * 0.62); px2.stroke(); px2.setLineDash([]);
    px2.strokeStyle = 'rgba(58,58,54,.45)'; px2.lineWidth = 4; px2.lineCap = 'round';
    [128, 640].forEach((cx) => { px2.beginPath(); px2.moveTo(cx - 10, TH * 0.24); px2.lineTo(cx + 8, TH * 0.36); px2.lineTo(cx - 10, TH * 0.48); px2.stroke(); });
    const pt = tex(pc); pt.wrapS = THREE.RepeatWrapping; pt.repeat.set(WW / 4, 1);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(WW, 1.0), new THREE.MeshBasicMaterial({ map: pt, transparent: true, depthWrite: false }));
    path.rotation.x = -Math.PI / 2; path.position.set(WC, 0.0035, -0.62); path.renderOrder = 1; scene.add(path);
  }
  loadTarget = 0.25; await nextFrame();

  // ---------- images ----------
  const [imgClay, imgDR, imgForge] = await Promise.all([TX.loadImage('img/library_packs_vikings-and-dark-ages_thumb.webp'), TX.loadImage('img/projects_dormant-red-shot-1.webp'), TX.loadImage('img/showcase_forge-pizza-co_card-1280.webp')]);

  // ---------- world, left to right ----------
  const anim = []; // per-frame life
  const END_X = 70.3;
  // far layer: a continuous paper mountain range
  for (let i = 0, x = -10; x < WX1; i++, x += 6.4) {
    const ozark = x > 29 && x < 43;
    const h = 1.0 + ((i * 7) % 5) * 0.17, w = 7.4 + ((i * 3) % 4) * 0.5;
    cutout(P.mountains(ozark ? '#B4C9BC' : (i % 2 ? '#CADBB9' : '#C3D6C6'), ozark ? '#5F7A6E' : '#6E7F62'), w, h, [x, 0.02, Z.far], { seed: 1 + i, px: 100, shadow: [0.06, -0.03] });
  }
  // clouds: one row in view on desktop, a higher row that fills tall (phone) screens
  // clouds: one low row tucked above the lettering (hidden on phones, where the top is trimmed)
  const clouds = [];
  for (let i = 0, x = -6; x < WX1; i++, x += 5.3) {
    const w = 0.78 + (i % 4) * 0.08, cx0 = x + (i % 2) * 0.8;
    if (cx0 > 54 && cx0 < 73) continue; // the end blocks sit higher; keep that sky clear
    const g = cutout(P.cloud, w * 1.15, w * 0.5, [cx0, 2.97 + (i % 2) * 0.06, Z.mid - 0.15], { seed: 40 + i, px: 120, shadow: [0.12, -0.1] });
    clouds.push(g);
    anim.push((t) => { g.position.x = x + (i % 2) * 0.8 + Math.sin(t * 0.12 + i) * 0.25; });
  }
  loadTarget = 0.35; await nextFrame();
  {
    const hb = cutout(P.balloon, 0.7, 1.12, [-3.1, 2.0, Z.mid + 0.1], { seed: 8, px: 180, shadow: [0.14, -0.12] });
    const string = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 5), new THREE.MeshBasicMaterial({ color: '#8C8A86' }));
    string.position.set(0, 1.12 + 2.5, -0.01); hb.add(string);
    anim.push((t) => { hb.rotation.z = Math.sin(t * 0.7) * 0.05; hb.position.y = 2.0 + Math.sin(t * 0.5) * 0.06; });
    const g = cutout(P.balloon, 0.8, 1.3, [33.4, 2.35, Z.mid], { seed: 9, px: 170, shadow: [0.14, -0.12] });
    anim.push((t) => { g.position.y = 2.35 + Math.sin(t * 0.4) * 0.14; g.rotation.z = Math.sin(t * 0.6) * 0.04; });
    const pl = cutout(P.paperPlane, 1.05, 0.55, [M0 ? 55.4 : 54.2, 2.25, Z.mid + 0.2], { seed: 10, px: 170, rotZ: 0.12, shadow: [0.12, -0.12] });
    const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 4), new THREE.MeshBasicMaterial({ color: '#8C8A86' })); ps.position.set(0.1, 0.4 + 2, -0.01); pl.add(ps);
    anim.push((t) => { pl.position.y = 2.25 + Math.sin(t * 0.8) * 0.06; pl.rotation.z = 0.12 + Math.sin(t * 0.9) * 0.05; });
  }

  // floor props (mid / puppet layers) with small yaw so they catch the eye differently
  const prop = (paint, w, h, x, z, o = {}) => cutout(paint, w, h, [x, 0, z], { floorShadow: true, shadow: [0.09, -0.02], ...o });
  // stop: hello
  cutout(P.polaroid(imgClay), 1.5, 1.6, [2.75, 1.15, Z.wall + 0.06], { seed: 3, px: 220, rotZ: 0.07, shadow: [0.07, -0.08] });
  prop(P.pencilCup, 1.25, 2.05, -3.4, -1.95, { seed: 4, px: 170, rotY: 0.08 });
  prop(P.bench, 3.0, 1.35, 6.0, -1.95, { seed: 11, px: 170, rotY: 0.05 });
  loadTarget = 0.45; await nextFrame();
  // stop: games
  prop(P.arcade(imgDR), 1.55, 2.8, 9.6, -1.8, { seed: 14, px: 210, rotY: 0.14, href: 'https://rdwlabz.itch.io/dormant-red' });
  prop(P.green, 3.6, 1.9, 16.4, -1.45, { seed: 15, px: 160, rotY: -0.1 });
  // stop: clay packs
  prop(P.kiln, 2.3, 2.6, 21.0, -2.0, { seed: 30, px: 160, rotY: 0.08 });
  prop(P.crate(), 1.5, 1.15, 23.7, -1.2, { seed: 31, px: 190, rotY: -0.14 });
  const puffs = [0, 1, 2, 3].map((i) => cutout(P.puff, 0.5, 0.42, [21.4, 2.6, -2.05], { seed: 33 + i, px: 150, shadow: null }));
  prop(P.miniSign('→ Harrison'), 1.3, 1.05, 26.3, -1.55, { seed: 25, px: 160, rotY: 0.1 });
  loadTarget = 0.55; await nextFrame();
  // stop: Harrison + Ozarks
  prop(P.tower, 1.7, 2.85, 28.8, -2.05, { seed: 13, px: 150, rotY: 0.1 });
  [[31.7, 0.9, 1.6], [33.6, 1.1, 2.4], [34.8, 0.85, 1.85], [38.6, 1.15, 2.5], [39.7, 0.85, 1.9]].forEach(([x, w, h], i) => prop(P.pine, w, h, x, -2.15 + (i % 2) * 0.12, { seed: 20 + i, px: 140, rotY: (i % 2 ? 0.15 : -0.12) }));
  prop(P.miniSign('the Ozarks'), 1.25, 0.95, 36.0, -1.6, { seed: 26, px: 160, rotY: 0.1 });
  cutout(P.river, 10, 0.7, [36.8, -0.02, -1.3], { seed: 26, px: 120, shadow: [0.04, -0.02] });
  const canoe = cutout(P.canoe, 1.5, 0.55, [34, 0.08, -1.25], { seed: 27, px: 170, shadow: [0.05, -0.03] });
  // stop: partner
  prop(P.signpost, 1.9, 2.5, 43.4, -1.7, { seed: 12, px: 170, rotY: -0.12, href: 'https://verrow.ai/' });
  prop(P.lamp, 1.5, 2.3, 41.5, -2.05, { seed: 16, px: 160, rotY: 0.1 });
  prop(P.miniSign('partners'), 1.3, 1.0, 47.5, -1.5, { seed: 38, px: 160, rotY: -0.08 });
  cutout(P.polaroid(imgForge, 'Forge Pizza Co'), 2.1, 1.75, [50.4, 1.2, Z.wall + 0.06], { seed: 17, px: 200, rotZ: -0.05, shadow: [0.07, -0.08] });
  prop(P.pizza, 1.2, 0.95, 51.3, -1.35, { seed: 18, px: 180, rotY: -0.1 });
  loadTarget = 0.65; await nextFrame();
  // stop: process
  prop(P.tray, 1.4, 1.0, 56.4, -1.5, { seed: 19, px: 180, rotY: 0.08 });
  prop(P.toolbench, 2.4, 1.08, 59.6, -1.9, { seed: 28, px: 170, rotY: -0.06 });
  const rocket = prop(P.rocket, 1.15, 2.7, 64.4, -2.0, { seed: 29, px: 170, rotY: 0.06 });
  const flame = cutout(P.flame, 0.36, 0.42, [0, 0.02, 0.02], { seed: 32, px: 170, parent: rocket, shadow: null });
  flame.children[0].position.y = 0.21 + 0.36; flame.position.y = 0;
  // stop: say hi
  // stop: say hi. The mailbox post stands right beside Lumpy at the end of the walk.
  const mailbox = prop(P.mailbox, 1.0, 1.42, END_X + (M0 ? 1.12 : 2.05), -1.3, { seed: 34, px: 190, rotY: -0.06 });
  const flag = cutout(P.flag, 0.36, 0.26, [0.36, 0.92, 0.03], { seed: 35, px: 190, parent: mailbox, shadow: null });
  flag.children[0].position.x = 0.18; flag.rotation.z = -1.2;
  if (M0) mailbox.scale.setScalar(0.78);
  prop(P.pine, 1.1, 2.4, 74.9, -2.15, { seed: 36, px: 140, rotY: -0.1 });
  prop(P.pine, 0.85, 1.8, 76.1, -2.0, { seed: 37, px: 140, rotY: 0.12 });
  // a few bushes on the back half of the mat, behind Lumpy (no fixed front row)
  [-4.8, 3.4, 20.0, 27.4, 41.0, 49.4, 55.0, 66.6, 73.6].forEach((x, i) => {
    const w = 1.0 + ((i * 5) % 4) * 0.15;
    const g = cutout(P.bush, w, w * 0.44, [x, 0, -1.62 - (i % 2) * 0.12], { seed: 50 + i, px: 130, floorShadow: true, shadow: [0.06, -0.02] });
    const f = 2.89 + (i % 5) * 0.06;
    anim.push((t) => { g.scale.y = 0.94 + 0.06 * Math.sin(t * f + i); });
  });
  for (let i = 0, x = -5; x < 78; i++, x += 2.9) cutout(P.grass, 0.36, 0.28, [x + (i % 2) * 0.6, 0, -1.65 + (i % 3) * 0.16], { seed: 70 + i, px: 140, shadow: null });
  // per-stop foreground: one prop next to Lumpy at each stop, just behind it so Lumpy is never covered
  const STOPS_X = [M0 ? 0 : -0.45, 6.0, 12.3, 16.6, 24.4, 31.3, 36.9, 46.0, 53.1, 56.5, 59.6, 62.6, END_X];
  const FG = [
    [P.cactus, 0.55, 0.8, 0], [P.mug, 0.6, 0.62, 6.0], [P.stool, 0.62, 0.82, 12.3], [P.golfbag, 0.5, 1.0, 16.6],
    [P.pots, 0.75, 0.78, 24.4], [P.rock, 0.8, 0.5, 31.3], [P.stump, 0.85, 0.78, 36.9], [P.boxes, 0.8, 0.86, 46.0],
    [P.peel, 0.48, 1.05, 53.1], [P.cone, 0.48, 0.6, 59.6],
  ];
  FG.forEach(([paint, w, h, x], i) => prop(paint, w, h, x + (M0 ? 0.98 : 0.6), -1.22, { seed: 300 + i, px: 200, rotY: (i % 2 ? 0.08 : -0.08) }));
  // flat bits lying on the mat in front (below Lumpy's feet, so they can't hide it)
  const flat = (paint, w, h, x, z, rz, seed) => { const g = cutout(paint, w, h, [x, 0.006, z], { seed, px: 170, rotZ: 0, shadow: null }); g.rotation.set(-Math.PI / 2, 0, rz); return g; };
  flat(P.pencil, 1.9, 0.24, -2.4, 0.15, 0.1, 80);
  flat(P.eraser, 0.62, 0.26, 4.4, 0.05, -0.25, 81);
  flat(P.clip, 0.5, 0.22, 10.6, -0.1, 0.5, 82);
  flat(P.tack('#E2533B'), 0.16, 0.16, 14.6, -0.25, 0, 83);
  flat(P.scrap('fore!', '#2F5BD3'), 0.7, 0.36, 18.2, 0.05, 0.12, 84);
  flat(P.tack('#F2C94C'), 0.16, 0.16, 22.6, -0.2, 0, 85);
  flat(P.scrap('AR', '#2E5B3A'), 0.5, 0.32, 29.6, 0.1, -0.15, 86);
  flat(P.clip, 0.5, 0.22, 39.2, 0.0, -0.4, 87);
  flat(P.pencil, 1.8, 0.23, 44.0, 0.2, -0.08, 88);
  flat(P.scrap('ok!', '#C2412E'), 0.55, 0.32, 57.8, 0.05, 0.1, 89);
  flat(P.tack('#5B7FD6'), 0.16, 0.16, 63.2, -0.2, 0, 90);
  flat(P.scrap('hi!', '#C2412E'), 0.55, 0.32, 69.0, 0.12, -0.12, 91);
  // nearer bits: only reach the frame on tall phone screens, where more of the mat shows
  const NEAR = [[P.eraser, 0.8, 0.34], [P.clip, 0.6, 0.26], [P.pencil, 2.2, 0.28], [P.tack('#E2533B'), 0.2, 0.2], [P.scrap('→', '#2F5BD3'), 0.7, 0.4], [P.tack('#F2C94C'), 0.2, 0.2]];
  STOPS_X.forEach((x, i) => { const [pa, w, h] = NEAR[i % NEAR.length]; flat(pa, w, h, x - 0.7 + ((i * 7) % 5) * 0.32, 0.9 + ((i * 3) % 4) * 0.28, ((i * 5) % 7 - 3) * 0.12, 400 + i); if (i % 2) flat(P.tack(['#5B7FD6', '#7FB59A', '#EF8A5C'][i % 3]), 0.18, 0.18, x + 0.9, 1.7, 0, 420 + i); });
  loadTarget = 0.75; await nextFrame();

  // ---------- wall lettering (the copy) ----------
  const RED = '#C2412E', BLUE = '#2F5BD3', GREEN = '#2E5B3A';
  letter([{ k: 'big', t: "Hi! We're RDW Labz" }, { k: 'body', t: 'We build software, websites, games and clay-style 3D in Harrison, Arkansas.' }], { x: -0.45, y: 2.8, w: 3.9, seed: 1, rot: 0.02, mx: 0 });
  letter([{ k: 'title', t: 'what we do', c: RED, u: true }, { k: 'body', t: '· custom software & websites' }, { k: 'body', t: '· games: Dormant Red, Putt Drop' }, { k: 'body', t: '· 48 packs of clay-style 3D' }], { x: 6.0, y: 2.8, w: 3.2, seed: 2, rot: -0.015 });
  const lDR = letter([{ k: 'title', t: 'Dormant Red', c: RED }, { k: 'body', t: 'our browser game: restore a dead space station before the oxygen runs out.' }], { x: 12.3, y: 2.75, w: 2.7, seed: 3, rot: 0.02 });
  letter([{ k: 'title', t: 'Putt Drop', c: BLUE }, { k: 'body', t: 'one-thumb mini golf for phones, now on Google Play.' }], { x: 16.6, y: 2.75, w: 3.0, seed: 4, rot: -0.02 });
  letter([{ k: 'title', t: 'fresh from the kiln', c: RED }, { k: 'body', t: '48 clay-style 3D packs: 730 models, 176 textures. Downloads coming soon.' }], { x: 24.4, y: 2.75, w: 2.9, seed: 5, rot: 0.015 });
  letter([{ k: 'title', t: 'Harrison, AR', c: GREEN, u: true }, { k: 'body', t: 'our home town, up in the Ozarks.' }], { x: 31.3, y: 2.75, w: 2.4, seed: 6, rot: -0.02 });
  letter([{ k: 'title', t: 'the Ozarks', c: GREEN }, { k: 'body', t: 'rivers, pines and quiet roads: where we think up the next build.' }], { x: 36.9, y: 2.8, w: 3.0, seed: 7, rot: 0.02 });
  const lV = letter([{ k: 'title', t: 'our partner: Verrow AI', c: BLUE, u: true }, { k: 'body', t: 'a software and AI automation studio here in Harrison. We build together.' }, { k: 'small', t: 'custom software for crews in the field · AI automation and agent systems · creators of Project Swarm' }], { x: 46.0, y: 2.8, w: 3.2, seed: 8, rot: -0.015 });
  const lF = letter([{ k: 'title', t: 'built together', c: RED }, { k: 'body', t: 'a menu-first website for a woodfired pizza place right here in Harrison, made with Verrow AI.' }], { x: 53.1, y: 2.75, w: 2.3, seed: 9, rot: 0.02 });
  letter([{ k: 'big', t: 'how a build goes' }], { x: 59.6, y: 3.2, w: 5.5, align: 'center', seed: 10, mx: 56.5, my: 3.26, mw: 2.6 });
  letter([{ k: 'title', t: '1. tell us', c: RED }, { k: 'body', t: 'email us the idea, some links that show the vibe, and rough timing.' }], { x: 56.5, y: 2.68, w: 2.5, seed: 11, rot: -0.02, my: 2.78 });
  letter([{ k: 'title', t: '2. we build', c: RED }, { k: 'body', t: 'we plan it with you and build it, bringing in Verrow AI when a build needs extra hands.' }], { x: 59.6, y: 2.68, w: 2.9, seed: 12, rot: 0.015, my: 3.2 });
  letter([{ k: 'title', t: '3. it ships', c: RED }, { k: 'body', t: 'through Project Swarm: nothing merges until the checks pass.' }], { x: 62.6, y: 2.68, w: 2.3, seed: 13, rot: -0.015, my: 3.2 });
  const lHi = letter([{ k: 'big', t: 'Say hi to the lab!' }, { k: 'body', t: 'software, a website, a game or an asset pack: tell us about it.' }], { x: 70.3, y: 3.1, w: 3.6, align: 'center', seed: 14, rot: 0.01, my: 3.2, mw: 2.7 });
  [[4.2, 1.15, 'heart'], [19.2, 2.55, 'star'], [43.6, 2.75, 'star'], [67.9, 2.7, 'heart']].forEach(([x, y, k], i) => { const g = cutout(P.doodle(k), 0.34, 0.32, [x, y, Z.wall + 0.03], { seed: 200 + i, px: 170, shadow: null }); anim.push((t) => { g.rotation.z = Math.sin(t * 1.3 + i) * 0.12; }); });
  loadTarget = 0.85; await nextFrame();

  // ---------- Lumpy (stick puppet with cart) ----------
  const lumpy = new THREE.Group(); scene.add(lumpy);
  const body = cutout(P.lumpy, 0.95, 1.2, [0, 0, 0], { seed: 90, px: 200, parent: lumpy, shadow: [0.07, -0.03] });
  { const cs = new THREE.Mesh(new THREE.PlaneGeometry(0.95 * 0.7, 1.2 * 0.12), new THREE.MeshBasicMaterial({ map: floorShadowTex, transparent: true, opacity: 0.45, depthWrite: false }));
    cs.rotation.x = -Math.PI / 2; cs.position.set(0.02, 0.006, 0.02); cs.renderOrder = 1; lumpy.add(cs); }
  const cartG = new THREE.Group(); cartG.position.x = 0.82; lumpy.add(cartG);
  const cart = cutout(P.cart, 0.95, 0.6, [0.72 - 0.82, 0.16, 0.02], { seed: 91, px: 200, parent: cartG, shadow: [0.05, -0.02] });
  const acc = {
    headset: cutout((c, px, r, H, w, h) => {
      H.line(TX.ellipsePts(w * 0.5, h * 0.62, w * 0.42, h * 0.55, 18, Math.PI * 1.02, Math.PI * 1.98), 9, INK);
      H.line(TX.ellipsePts(w * 0.5, h * 0.62, w * 0.42, h * 0.55, 18, Math.PI * 1.02, Math.PI * 1.98), 5, '#3B37C8');
      H.shape(TX.rrPts(0, h * 0.5, w * 0.17, h * 0.42, 8, 8), '#3B37C8', { lw: 4 });
      H.shape(TX.rrPts(w * 0.83, h * 0.5, w * 0.17, h * 0.42, 8, 8), '#3B37C8', { lw: 4 });
      H.line([[w * 0.9, h * 0.9], [w * 0.8, h * 1.0], [w * 0.62, h * 1.02]], 4, INK);
      H.dot(w * 0.6, h * 1.02, w * 0.035, '#C2412E');
    }, 1.08, 0.62, [0, 0.48, 0.03], { seed: 101, px: 170, parent: body, shadow: null }),
    cap: cutout((c, px, r, H, w, h) => {
      const d = []; for (let i = 0; i <= 14; i++) { const a = Math.PI + (i / 14) * Math.PI; d.push([w * 0.4 + Math.cos(a) * w * 0.36, h * 0.8 + Math.sin(a) * h * 0.7]); }
      d.push([w * 0.98, h * 0.82]); d.push([w * 0.98, h * 0.98]); d.push([w * 0.04, h * 0.98]);
      H.shape(d, '#F6F1E6', { lw: 4.5 });
      H.line([[w * 0.06, h * 0.78], [w * 0.97, h * 0.82]], 3, INK);
      H.dot(w * 0.4, h * 0.12, w * 0.03, '#C2412E');
      H.shape(TX.ellipsePts(w * 0.4, h * 0.5, w * 0.08, h * 0.16, 10), '#7FB59A', { lw: 2.5, hatch: false });
    }, 0.86, 0.34, [0.04, 0.98, 0.03], { seed: 102, px: 190, parent: body, shadow: null }),
    paddle: cutout((c, px, r, H, w, h) => {
      H.shape(TX.rrPts(w * 0.42, 0, w * 0.16, h * 0.62, 6, 10), '#C9A27C', { lw: 4 });
      H.shape(TX.ellipsePts(w * 0.5, h * 0.8, w * 0.42, h * 0.2, 16), '#C2412E', { lw: 4.5 });
      H.shape(TX.rrPts(w * 0.36, h * 0.0, w * 0.28, h * 0.08, 4, 6), '#3A3A36', { lw: 2, hatch: false });
    }, 0.34, 1.35, [-0.55, 0.05, 0.03], { seed: 103, px: 170, rotZ: -0.25, parent: body, shadow: null }),
    mitts: cutout((c, px, r, H, w, h) => {
      [[0, 1], [w * 0.74, -1]].forEach(([x0, f]) => {
        H.shape(TX.rrPts(x0, h * 0.18, w * 0.26, h * 0.78, 14, 8), '#E2533B', { lw: 4 });
        H.shape(TX.ellipsePts(x0 + (f > 0 ? w * 0.04 : w * 0.22), h * 0.36, w * 0.06, h * 0.12, 10), '#E2533B', { lw: 3.5 });
        H.shape(TX.rrPts(x0 - w * 0.01, h * 0.84, w * 0.28, h * 0.14, 4, 6), '#F3E9D8', { lw: 3, hatch: false });
      });
    }, 1.25, 0.42, [0, 0.28, 0.03], { seed: 104, px: 170, parent: body, shadow: null }),
    letter: cutout(P.envelope, 0.5, 0.34, [0.42, 0.3, 0.04], { seed: 105, px: 190, rotZ: 0.25, parent: body, shadow: null }),
    pencil: cutout(P.pencil, 1.25, 0.16, [-0.05, 0.42, -0.02], { seed: 106, px: 190, rotZ: 0.75, parent: body, shadow: null }),
    bubble: cutout((c, px, r, H, w, h) => {
      H.shape(TX.polyPts([[w * 0.12, h * 0.98], [w * 0.2, h * 0.62], [w * 0.36, h * 0.7]], 6), '#FFFFFF', { lw: 3.5, hatch: false });
      H.shape(TX.ellipsePts(w * 0.55, h * 0.4, w * 0.43, h * 0.36, 18), '#FFFFFF', { lw: 4, hatch: false });
      H.text('hi!', w * 0.55, h * 0.42, `700 ${Math.round(h * 0.46)}px Caveat`, '#C2412E', { rot: -0.06 });
    }, 0.62, 0.46, [0.52, 0.98, 0.04], { seed: 107, px: 190, parent: body, shadow: null }),
    map: cutout((c, px, r, H, w, h) => {
      H.shape(TX.polyPts([[0, h * 0.06], [w * 0.33, 0], [w * 0.66, h * 0.06], [w, 0], [w, h * 0.94], [w * 0.66, h], [w * 0.33, h * 0.94], [0, h]], 8), '#FFF8E8', { lw: 3.5, hatch: false });
      H.line([[w * 0.33, 0], [w * 0.33, h * 0.94]], 2, 'rgba(58,58,54,.35)'); H.line([[w * 0.66, h * 0.06], [w * 0.66, h]], 2, 'rgba(58,58,54,.35)');
      H.shape(TX.ellipsePts(w * 0.3, h * 0.4, w * 0.18, h * 0.2, 10), '#B4D2A2', { lw: 0 });
      H.line([[w * 0.05, h * 0.75], [w * 0.4, h * 0.6], [w * 0.7, h * 0.72], [w * 0.95, h * 0.5]], 3, '#5B9BD6');
      H.dot(w * 0.62, h * 0.34, w * 0.05, '#E2533B');
    }, 0.6, 0.42, [0.3, 0.2, 0.04], { seed: 108, px: 190, rotZ: 0.12, parent: body, shadow: null }),
    glasses: cutout((c, px, r, H, w, h) => {
      H.line(TX.ellipsePts(w * 0.31, h * 0.52, w * 0.15, h * 0.36, 16), 6, INK, 1);
      H.line(TX.ellipsePts(w * 0.69, h * 0.52, w * 0.15, h * 0.36, 16), 6, INK, 1);
      H.line([[w * 0.45, h * 0.46], [w * 0.55, h * 0.46]], 5, INK, 1);
      H.line([[w * 0.16, h * 0.44], [w * 0.02, h * 0.36]], 4, INK, 1); H.line([[w * 0.84, h * 0.44], [w * 0.98, h * 0.36]], 4, INK, 1);
    }, 0.5, 0.2, [0, 0.596, 0.035], { seed: 109, px: 200, parent: body, shadow: null }),
    slice: cutout((c, px, r, H, w, h) => {
      H.shape(TX.polyPts([[w * 0.06, h * 0.12], [w * 0.94, h * 0.12], [w * 0.5, h * 0.98]], 10), '#F2C94C', { lw: 4 });
      H.shape(TX.rrPts(w * 0.02, 0, w * 0.96, h * 0.18, 8, 10), '#D9A66B', { lw: 4 });
      H.dot(w * 0.36, h * 0.36, w * 0.08, '#C2412E'); H.dot(w * 0.6, h * 0.42, w * 0.07, '#C2412E'); H.dot(w * 0.48, h * 0.66, w * 0.06, '#C2412E');
    }, 0.4, 0.46, [0.44, 0.22, 0.04], { seed: 110, px: 190, rotZ: -0.35, parent: body, shadow: null }),
    hardhat: cutout((c, px, r, H, w, h) => {
      const d = []; for (let i = 0; i <= 14; i++) { const a = Math.PI + (i / 14) * Math.PI; d.push([w * 0.5 + Math.cos(a) * w * 0.38, h * 0.82 + Math.sin(a) * h * 0.74]); }
      d.push([w * 0.99, h * 0.84]); d.push([w * 0.99, h * 0.98]); d.push([w * 0.01, h * 0.98]); d.push([w * 0.01, h * 0.84]);
      H.shape(d, '#F2C94C', { lw: 4.5 });
      H.shape(TX.rrPts(w * 0.44, h * 0.08, w * 0.12, h * 0.76, 4, 8), '#E8B83A', { lw: 2.5, hatch: false });
    }, 0.92, 0.36, [0.0, 0.97, 0.03], { seed: 111, px: 190, parent: body, shadow: null }),
    wrench: cutout((c, px, r, H, w, h) => {
      H.shape(TX.rrPts(w * 0.36, h * 0.2, w * 0.28, h * 0.78, 8, 10), '#9AA3AE', { lw: 4, hatch: false });
      H.shape(TX.polyPts([[w * 0.06, h * 0.0], [w * 0.3, h * 0.0], [w * 0.34, h * 0.12], [w * 0.66, h * 0.12], [w * 0.7, 0], [w * 0.94, 0], [w * 0.9, h * 0.2], [w * 0.62, h * 0.3], [w * 0.38, h * 0.3], [w * 0.1, h * 0.2]], 8), '#9AA3AE', { lw: 4, hatch: false });
    }, 0.3, 0.8, [-0.56, 0.12, 0.03], { seed: 112, px: 190, rotZ: 0.3, parent: body, shadow: null }),
  };
  Object.values(acc).forEach((g) => { g.visible = false; });
  // one stop per wall block: what Lumpy wears/holds there, whether it pulls the cart, and its idle pose
  const STOPS = [
    { x: M0 ? 0 : -0.45, acc: ['bubble'], cart: true, pose: 'wave' },
    { x: 6.0, acc: ['pencil'], cart: false, pose: 'walk' },
    { x: 12.3, acc: ['headset'], cart: false, pose: 'hop' },
    { x: 16.6, acc: ['cap'], cart: false, pose: 'lean' },
    { x: 24.4, acc: ['mitts'], cart: true, pose: 'walk' },
    { x: 31.3, acc: ['map'], cart: false, pose: 'look' },
    { x: 36.9, acc: ['paddle'], cart: false, pose: 'row' },
    { x: 46.0, acc: ['glasses'], cart: true, pose: 'look' },
    { x: 53.1, acc: ['slice'], cart: false, pose: 'hop' },
    { x: 56.5, acc: ['hardhat'], cart: true, pose: 'walk' },
    { x: 59.6, acc: ['hardhat', 'wrench'], cart: false, pose: 'lean' },
    { x: 62.6, acc: ['hardhat'], cart: false, pose: 'hop' },
    { x: END_X, acc: ['letter'], cart: false, pose: 'wave' },
  ];
  const stopAt = (cx) => { let bi = 0, bd = 1e9; STOPS.forEach((st, i) => { const d = Math.abs(st.x - cx); if (d < bd) { bd = d; bi = i; } }); return bi; };
  let poseRot = 0;
  const wheels = [0.66, 0.98].map((x, i) => {
    const g = cutout(P.wheel, 0.26, 0.26, [x - 0.82, 0.0, 0.05], { seed: 92 + i, px: 200, parent: cartG, shadow: null });
    g.children[0].position.y = 0.13; return g;
  });
  lumpy.position.z = -0.95;
  loadTarget = 0.95; await nextFrame();

  // ---------- DOM: screen-reader copy + the few real links, pinned to the wall ----------
  const style = document.createElement('style');
  style.textContent = '';
  labels.appendChild(style);
  const sr = document.createElement('div'); sr.className = 'sr';
  sr.innerHTML = `<h2>Hi! We're RDW Labz</h2><p>We build software, websites, games and clay-style 3D in Harrison, Arkansas.</p>
    <h3>What we do</h3><ul><li>Custom software and websites</li><li>Games: Dormant Red and Putt Drop</li><li>48 packs of clay-style 3D models</li></ul>
    <h3>Dormant Red</h3><p>Our browser game: restore a dead space station before the oxygen runs out.</p>
    <h3>Putt Drop</h3><p>One-thumb mini golf for phones, now on Google Play.</p>
    <h3>Fresh from the kiln</h3><p>48 clay-style 3D packs: 730 models, 176 textures. Downloads coming soon.</p>
    <h3>Harrison, AR</h3><p>Our home town, up in the Ozarks. Rivers, pines and quiet roads: where we think up the next build.</p>
    <h3>Our partner: Verrow AI</h3><p>A software and AI automation studio here in Harrison. We build together. Custom software for crews in the field, AI automation and agent systems, creators of Project Swarm.</p>
    <h3>Built together</h3><p>Forge Pizza Co: a menu-first website for a woodfired pizza place right here in Harrison, made with Verrow AI.</p>
    <h3>How a build goes</h3><ol><li>Tell us: email us the idea, some links that show the vibe, and rough timing.</li><li>We build: we plan it with you and build it, bringing in Verrow AI when a build needs extra hands.</li><li>It ships: through Project Swarm, nothing merges until the checks pass.</li></ol>
    <h3>Say hi to the lab!</h3><p>Software, a website, a game or an asset pack: tell us about it. devops@therdw.com</p><p>© 2026 RDW, LLC · 1301 N Main St, Harrison, AR 72601</p>`;
  labels.appendChild(sr);
  const LINKS = [
    { x: lDR.x + (M0 ? 0 : 0.6), y: lDR.bottom - 0.22, html: 'play it free on itch.io ↗', href: 'https://rdwlabz.itch.io/dormant-red', ext: true },
    { x: lV.x + (M0 ? 0 : 0.6), y: lV.bottom - (M0 ? 0.08 : 0.14), html: 'visit Verrow AI ↗', href: 'https://verrow.ai/', ext: true },
    { x: lF.x + (M0 ? 0 : 0.4), y: lF.bottom - 0.2, html: 'forgepizzaco.com ↗', href: 'https://forgepizzaco.com/', ext: true },
    { x: lHi.x, y: lHi.bottom - 0.36, html: 'email us →', href: 'mailto:devops@therdw.com', btn: true },
    { x: lHi.x, y: lHi.bottom - (M0 ? 0.98 : 1.06), html: '↺ walk back to the start', back: true },
    { x: lHi.x, y: lHi.bottom - 1.42, html: '© 2026 RDW, LLC · 1301 N Main St, Harrison, AR 72601', note: 'fine' },
  ].filter((n) => !(M0 && n.note === 'fine')); // phones: the fine print lives in the plain version
  const linkEls = LINKS.map((n) => {
    let el;
    if (n.note) { el = document.createElement('span'); el.className = 'wl note ' + n.note; el.setAttribute('aria-hidden', 'true'); }
    else if (n.back) { el = document.createElement('button'); el.type = 'button'; el.className = 'wl back'; el.addEventListener('click', () => { if (reduced) { target = 0; prog = 0; } else rewind = true; }); }
    else { el = document.createElement('a'); el.className = 'wl' + (n.btn ? ' btn' : ''); el.href = n.href; if (n.ext) { el.target = '_blank'; el.rel = 'noopener'; } }
    el.innerHTML = n.html;
    let host = el;
    if (n.btn) { host = document.createElement('div'); host.className = 'wlwrap'; host.appendChild(el); }
    labels.appendChild(host);
    if (!n.note) el.addEventListener('focus', () => { touchIn(); target = progAtX(mobile ? nearStop(n.x) : n.x); if (reduced) prog = target; });
    return { n, el: host };
  });
  const skipRest = document.getElementById('skipRest');
  const oldSkipText = skipRest.textContent; skipRest.textContent = 'plain version';
  loadTarget = 1;

  // ---------- camera path (centripetal Catmull-Rom) ----------
  const pts = [[0, 2.0, 5.9], [7, 2.08, 6.2], [14, 1.95, 5.7], [21, 2.1, 6.1], [28, 2.0, 5.8], [35, 2.12, 6.2], [42, 1.96, 5.7], [49, 2.08, 6.1], [56, 2.0, 5.9], [63, 2.1, 6.15], [END_X, 2.0, 5.9]];
  let curve, look;
  const yawKeys = [[0, -0.06], [0.15, 0.05], [0.3, -0.03], [0.42, 0.06], [0.55, -0.04], [0.68, 0.05], [0.8, -0.04], [1, 0.0]];
  const pitchKeys = [[0, 0.0], [0.2, -0.05], [0.35, 0.04], [0.5, -0.03], [0.65, 0.04], [0.8, -0.03], [1, 0]];
  const keyAt = (keys, p) => { for (let i = 0; i < keys.length - 1; i++) { if (p <= keys[i + 1][0]) { const t = (p - keys[i][0]) / (keys[i + 1][0] - keys[i][0]); const s = t * t * (3 - 2 * t); return lerp(keys[i][1], keys[i + 1][1], s); } } return keys[keys.length - 1][1]; };
  let mobile = false, lumpyOff = -1.5, xs = [];
  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false); cam.aspect = W / H; cam.updateProjectionMatrix();
    const asp = W / H; mobile = asp < 0.85;
    // pull back on narrow screens so a prop still fits the width; lift a little to keep the mat in perspective
    // phones: ~1.4x closer than "fit a prop", so the copy reads big; the walk then snaps stop to stop
    const d = Math.max(8.0, 4.3 / (2 * tanF * asp) / (mobile ? 1.4 : 1)), dz = d - 8.0, dy = dz * 0.12;
    lumpyOff = mobile ? -0.55 : -Math.min(1.5, 0.22 * 2 * tanF * asp * d + 0.1);
    clouds.forEach((g) => { g.visible = !mobile; });
    curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new V3(x, y + dy, z + dz)), false, 'centripetal');
    xs = []; const v = new V3(); for (let i = 0; i <= 200; i++) { curve.getPointAt(i / 200, v); xs.push(v.x); }
    lumpy.scale.setScalar(mobile ? 0.98 : 1);
  }
  const xAt = (p) => { const f = clamp(p) * 200, i = Math.min(199, Math.floor(f)); return lerp(xs[i], xs[i + 1], f - i); };
  const nearStop = (x) => STOPS[stopAt(x)].x;
  let lastIn = 0, lastDir = 0;
  const touchIn = (dir = 0) => { lastIn = performance.now(); if (dir) lastDir = Math.sign(dir); };
  function progAtX(x) { for (let i = 0; i < xs.length - 1; i++) if (xs[i + 1] >= x) return clamp((i + (x - xs[i]) / Math.max(1e-6, xs[i + 1] - xs[i])) / 200); return 1; }
  layout();

  // ---------- input ----------
  let target = 0, prog = 0;
  const isPlain = () => aboutEl.classList.contains('plain');
  const inWalk = () => window.scrollY < 4 && !loaderAlive;
  const onWheel = (e) => {
    if (!inWalk()) return;
    rewind = false;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (isPlain() && d > 0 && target >= 1 && prog > 0.985) return; // plain version: let the page scroll on
    e.preventDefault(); touchIn(d);
    target = clamp(target + Math.sign(d) * 0.0085 * Math.max(0.15, Math.min(Math.abs(d) / 100, 1)));
  };
  let drag = null;
  const onDown = (e) => {
    if (e.target.closest('a,button')) return;
    drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId }; rewind = false;
  };
  const onMove = (e) => {
    mouseNDC.x = (e.clientX / W) * 2 - 1; mouseNDC.y = -((e.clientY / H) * 2 - 1);
    if (!drag) { hoverCheck(); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const d = e.pointerType === 'touch' ? (-dx - dy) : -dx;
    if (Math.abs(d) > 0.5) touchIn(d);
    target = clamp(target + d / (W * (e.pointerType === 'touch' ? 3.2 : 4.5)));
  };
  const onUp = (e) => {
    if (drag && drag.moved < 6) clickCheck(e);
    drag = null;
  };
  const onKey = (e) => {
    if (!inWalk() || e.target.closest && e.target.closest('input,textarea')) return;
    if (mobile && ['ArrowRight', 'ArrowDown', 'PageDown', 'ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
      // phones/narrow windows: arrows hop stop to stop
      e.preventDefault(); touchIn();
      const fwd = ['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key), i = stopAt(xAt(target)), j = clamp(i + (fwd ? 1 : -1), 0, STOPS.length - 1);
      target = progAtX(STOPS[j].x); return;
    }
    if (['ArrowRight', 'ArrowDown', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.target.closest('a,button'))) { if (isPlain() && target >= 1 && prog > 0.985) return; e.preventDefault(); target = clamp(target + (e.key === 'PageDown' ? 0.1 : 0.04)); }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); target = clamp(target - (e.key === 'PageUp' ? 0.1 : 0.04)); }
    if (e.key === 'Home') { e.preventDefault(); target = 0; }
    if (e.key === 'End') { e.preventDefault(); target = 1; }
  };
  window.addEventListener('wheel', onWheel, { passive: false });
  walk.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  let rz = 0; const onResize = () => { clearTimeout(rz); rz = setTimeout(layout, 100); };
  window.addEventListener('resize', onResize);

  const ray = new THREE.Raycaster(), mouseNDC = new THREE.Vector2(-9, -9);
  function pick() { ray.setFromCamera(mouseNDC, cam); const hit = ray.intersectObjects(clickables, false)[0]; return hit && hit.object.userData.href; }
  function hoverCheck() { walk.style.cursor = pick() ? 'pointer' : ''; }
  function clickCheck(e) { mouseNDC.x = (e.clientX / W) * 2 - 1; mouseNDC.y = -((e.clientY / H) * 2 - 1); const h = pick(); if (h) window.open(h, '_blank', 'noopener'); }

  // plain version: un-hide the static page below the walk and scroll to it
  function goRest() {
    aboutEl.classList.add('plain');
    target = 1; prog = Math.max(prog, 0.999);
    requestAnimationFrame(() => { const y = rest.getBoundingClientRect().top + window.scrollY; window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' }); });
  }
  const onSkipRest = (e) => { e.preventDefault(); e.stopPropagation(); goRest(); };
  skipRest.addEventListener('click', onSkipRest);

  // ---------- loop ----------
  const parEls = [...document.querySelectorAll('#aboutRest [data-par]')];
  const clock = new THREE.Clock();
  let raf = 0, alive = true, t = 0, lastLx = 0;
  const pos = new V3(), tgt = new V3(), camPos = new V3(), camLook = new V3(), p3 = new V3(), v3 = new V3();
  const lerpK = (k, dt) => 1 - Math.pow(1 - k, dt * 60);
  // wall/mat seam sits at 76% of the viewport height (60% on phones, which zoom in)
  const hzAt = (hz) => Math.atan((2 * hz - 1) * tanF);
  let rewind = false;
  let first = true;
  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 20); t += dt;
    const visible = window.scrollY < H * 1.05;
    if (rewind) { target = Math.max(0, target - dt * 0.45); if (target <= 0) rewind = false; }
    // phones: once input pauses, glide to the nearest stop (nudged the way you were going) so a block is always framed
    if (mobile && !drag && !rewind && !loaderAlive && !isPlain() && performance.now() - lastIn > 450) {
      const sp = progAtX(nearStop(xAt(target) + lastDir * 0.9)); lastDir = 0;
      if (Math.abs(sp - target) > 1e-4) target = sp;
    }
    prog = lerp(prog, target, reduced ? 1 : lerpK(0.1, dt));
    document.getElementById('site').classList.toggle('paperbar', window.scrollY > H * 0.6);
    walkBar.style.width = (prog * 100).toFixed(1) + '%';
    pill.style.opacity = prog < 0.02 ? '1' : '0';
    if (!visible && !first) return;

    curve.getPointAt(clamp(prog), pos);
    const yaw = keyAt(yawKeys, prog), pitch = keyAt(pitchKeys, prog);
    if (first) { camPos.copy(pos); }
    camPos.lerp(pos, reduced ? 1 : lerpK(0.1, dt));
    // aim so the wall base lands on the horizon line whatever the camera height/distance
    const dW = camPos.z - Z.wall, th = Math.atan(camPos.y / dW) - hzAt(mobile ? 0.6 : 0.76);
    tgt.set(camPos.x + (mobile ? 0 : yaw * 3), camPos.y - dW * Math.tan(th) + pitch * 0.25, Z.wall);
    camLook.copy(tgt); first = false;
    cam.position.copy(camPos);
    if (!reduced) { cam.position.x += mouseNDC.x * 0.05 * (drag ? 0 : 1); cam.position.y += mouseNDC.y * 0.03 * (drag ? 0 : 1); }
    cam.lookAt(camLook);

    // Lumpy walks beside the camera, a puppet with a sine bob
    const lx = camPos.x + lumpyOff;
    const v = (lx - lastLx) / Math.max(dt, 1e-3); lastLx = lx;
    lumpy.position.x = lx;
    const st = STOPS[stopAt(camPos.x)];
    for (const k in acc) { const on = st.acc.includes(k); if (acc[k].visible !== on) { acc[k].visible = on; acc[k].userData.pop = on ? 0 : 1; }
      if (on) { acc[k].userData.pop = Math.min(1, (acc[k].userData.pop || 0) + dt * 4); const pp = acc[k].userData.pop; acc[k].scale.setScalar(reduced ? 1 : 0.6 + 0.4 * (1 - Math.pow(1 - pp, 3)) + Math.sin(pp * Math.PI) * 0.12); } }
    { const want = st.cart ? 1 : 0; const cs = cartG.userData.s ?? 1; const ns = reduced ? want : lerp(cs, want, lerpK(0.12, dt)); cartG.userData.s = ns; cartG.visible = ns > 0.03; cartG.scale.setScalar(Math.max(0.001, ns)); }
    const moving = Math.min(Math.abs(v) * 2, 1), idle = 1 - moving;
    let bob = 0, rz = 0;
    if (!reduced) {
      bob = Math.abs(Math.sin(t * 9)) * 0.08 * moving + Math.sin(t * 1.8) * 0.015;
      rz = Math.sin(t * 9) * 0.06 * moving + Math.sin(t * 2) * 0.004;
      if (st.pose === 'hop') { const k = Math.max(0, Math.sin(t * 3.4)); bob += k * k * 0.17 * idle; }
      if (st.pose === 'wave') rz += Math.sin(t * 3.2) * 0.1 * idle;
      if (st.pose === 'row') rz += Math.sin(t * 1.8) * 0.07 * idle;
    }
    poseRot = lerp(poseRot, ({ lean: 0.12, look: -0.08 })[st.pose] || 0, reduced ? 1 : lerpK(0.08, dt));
    body.position.y = bob; body.rotation.z = rz + poseRot;
    acc.paddle.rotation.z = -0.25 + (reduced ? 0 : Math.sin(t * 1.8) * 0.3 * idle);
    acc.bubble.position.y = 0.98 + (reduced ? 0 : Math.sin(t * 2.4) * 0.03);
    cart.position.y = 0.16 + (reduced ? 0 : Math.abs(Math.sin(t * 9 + 1)) * 0.02 * moving);
    wheels.forEach((w, i) => { w.children[0].rotation.z = -lx / 0.13 + i; w.rotation.z = reduced ? 0 : Math.sin(t * 11 + i) * 0.05 * moving; });

    // canoe drifts with the walk, kiln smoke puffs rise, the rocket hums, the mailbox flag pops up at the end
    const cx = camPos.x;
    const cw = clamp((cx - 31) / 9);
    canoe.position.x = 33 + cw * 6.5; canoe.position.y = 0.08 + (reduced ? 0 : Math.sin(t * 2.2) * 0.03); canoe.rotation.z = reduced ? 0 : Math.sin(t * 1.7) * 0.04;
    puffs.forEach((g, i) => { const k = reduced ? 0.3 + i * 0.15 : ((t * 0.25 + i / 4) % 1); g.position.set(21.4 + Math.sin(k * 5 + i) * 0.2 + k * 0.4, 2.55 + k * 1.6, -2.05); g.scale.setScalar((0.6 + k * 1.1) * (1 - Math.pow(k, 4))); });
    const near = clamp(1 - Math.abs(cx - 63.5) / 3);
    rocket.position.y = reduced ? 0 : near * (0.05 + Math.sin(t * 20) * 0.01);
    flame.scale.setScalar(0.3 + near * (0.7 + (reduced ? 0 : Math.sin(t * 25) * 0.08)));
    const up = clamp((cx - (END_X - 3.5)) / 3);
    flag.rotation.z = lerp(flag.rotation.z, -1.2 + up * 1.2, reduced ? 1 : lerpK(0.08, dt));
    if (!reduced) anim.forEach((f) => f(t));

    renderer.render(scene, cam);

    // pin the links to their spot on the wall
    linkEls.forEach(({ n, el }) => {
      p3.set(n.x, n.y, Z.wall + 0.05);
      const dist = p3.distanceTo(cam.position);
      const s = H / (2 * dist * tanF) / 100;
      v3.copy(p3).project(cam);
      const X = (v3.x * 0.5 + 0.5) * W, Y = (-v3.y * 0.5 + 0.5) * H;
      if (!el._w) { el._w = el.offsetWidth || 200; }
      const off = X < -el._w * s || X > W + el._w * s;
      el.style.visibility = off ? 'hidden' : 'visible';
      if (el.firstChild && el.className === 'wlwrap') el.firstChild.style.visibility = off ? 'hidden' : 'visible';
      if (!off) el.style.transform = `translate3d(${X.toFixed(1)}px,${Y.toFixed(1)}px,0) translate(-50%,-50%) scale(${s.toFixed(3)})`;
    });
  }
  frame();

  const handle = {
    anchor(h) {
      if (h === '#about-rest') { loadTarget = 1; if (!loaderDone) { loaderDone = true; hideLoader(); } setTimeout(goRest, 60); }
    },
    stop() {
      alive = false; loaderAlive = false; cancelAnimationFrame(raf);
      window.removeEventListener('wheel', onWheel); window.removeEventListener('wheel', blockWhileLoading); loader.removeEventListener('touchmove', blockWhileLoading); walk.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize);
      document.getElementById('aSkip').removeEventListener('click', onSkip); document.getElementById('aPlain').removeEventListener('click', onPlain);
      skipRest.removeEventListener('click', onSkipRest); skipRest.textContent = oldSkipText;
      labels.innerHTML = ''; css.remove(); aboutEl.classList.remove('plain');
      renderer.dispose();
    },
    _debug: { get prog() { return prog; }, set target(v) { target = v; prog = v; touchIn(); } },
  };
  window.__about = handle;
  return handle;
}
