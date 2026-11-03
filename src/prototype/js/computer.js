// The clay workbench computer: chamfered CRT monitor with a deep tapering back housing, hood seam,
// base plinth, curved glass, brand plate, floppy drive, power button + LED, vents, screws, baked
// crease AO + grime decals, and a wedge keyboard with sculpted, dished caps carrying canvas legends.
// All original geometry and art.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TX from './tex.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
const SRGB = THREE.SRGBColorSpace;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// Monitor layout (pc-local units). The screen centre stays at y 1.26 so the dive math is unchanged.
export const DIM = {
  MY: 1.2, SCREEN_Y: 1.26, SCREEN_Z: 0.205,
  OPEN_W: 1.24, OPEN_H: 0.88, PLANE_W: 1.36, PLANE_H: 1.0, BEZ_W: 2.04, BEZ_H: 1.86,
};

function rrShape(w, h, r, cx = 0, cy = 0, path = false) {
  const s = path ? new THREE.Path() : new THREE.Shape(); const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function rrPath(x, X, Y, w, h, r) {
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}
function rrRing(w, h, r, seg) {
  const pts = [];
  const cs = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5]];
  cs.forEach(([cx, cy, a0]) => { for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } });
  return pts;
}
// Loft through rounded-rect rings (front -> back). Outward winding, seamless planar UVs.
function loft(rings, seg = 6) {
  const N = 4 * (seg + 1);
  const pos = [], uv = [], idx = [];
  const col = [];
  const yMin = Math.min(...rings.map((q) => q.cy - q.h / 2)), yMax = Math.max(...rings.map((q) => q.cy + q.h / 2));
  rings.forEach(({ z, w, h, r, cy }) => {
    rrRing(w, h, r, seg).forEach(([x, y]) => {
      pos.push(x, y + cy, z); uv.push((x + z) * 0.5, (y + cy + z) * 0.5);
      const t = (y + cy - yMin) / (yMax - yMin);
      const ao = 1 - 0.2 * Math.pow(1 - clamp(t / 0.35), 2) - 0.08 * Math.exp(-Math.pow((t - 0.665) / 0.04, 2)) - 0.1 * clamp((-z - 1.6) / 0.9);
      const yl = clamp((t - 0.7) / 0.3);   // ~8% yellowing toward the top
      col.push(ao, ao * (1 - 0.035 * yl), ao * (1 - 0.14 * yl));
    });
  });
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < N; k++) {
      const a = i * N + k, b = i * N + ((k + 1) % N), d = (i + 1) * N + k, c = (i + 1) * N + ((k + 1) % N);
      idx.push(a, d, b, b, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function boxUV(g, k) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v; if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[i * 2] = u * k; uv[i * 2 + 1] = v * k;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
function smoothed(g, k) { g.deleteAttribute('uv'); g.deleteAttribute('normal'); const m = mergeVertices(g, 1e-4); m.computeVertexNormals(); return boxUV(m, k); }
function dimpleMat(color, s2 = 0.1) {   // shallow sink mark: radial height -> normal map, faded at the rim
  if (!dimpleMat.t) { const S = 64, h = new Float32Array(S * S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const r = Math.hypot(x - S / 2 + 0.5, y - S / 2 + 0.5) / (S / 2); h[y * S + x] = -Math.exp(-r * r * 4); }
    dimpleMat.t = new THREE.CanvasTexture(heightToNormal(h, S, 14)); dimpleMat.a = radialTex(64); }
  return new THREE.MeshPhysicalMaterial({ color, normalMap: dimpleMat.t, normalScale: new THREE.Vector2(s2, s2), alphaMap: dimpleMat.a, transparent: true, depthWrite: false, roughness: 0.42, ior: 1.49, specularIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -3 });
}
function softRectTex(size = 256, pad = 0.16, rFrac = 0.18) {
  const c = TX.makeCanvas(size, size), x = c.getContext('2d'); const p = size * pad;
  x.filter = `blur(${Math.round(p * 0.45)}px)`; x.fillStyle = '#000'; rrPath(x, p, p, size - 2 * p, size - 2 * p, size * rFrac); x.fill();
  return new THREE.CanvasTexture(c);
}
function radialTex(size = 128) {
  const c = TX.makeCanvas(size, size), x = c.getContext('2d'); const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

// ---- photoreal procedural PBR sets (generated once per page load, cached)
const PBR = {};
function heightToNormal(h, size, strength) {
  const out = TX.makeCanvas(size, size), ox = out.getContext('2d'), id = ox.createImageData(size, size), d = id.data;
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ox.putImageData(id, 0, 0); return out;
}
function canvasLum(c) { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, h = new Float32Array(n); for (let i = 0; i < n; i++) h[i] = d[i * 4] / 255; return h; }
function texOf(c, maxAniso, srgb, rep = 1) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = SRGB; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = maxAniso; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; return t; }
export function plasticMaps(maxAniso) {
  if (PBR.plastic) return PBR.plastic;
  const B = TX.bakedMany('plastic', ['albedo', 'rough', 'normal'], () => {
  const S = 2048, r = TX.rng(41);
  // albedo: subtle mottling (neutral, multiplied by the material colour; yellowing/grime come from vertex AO + decals)
  const al = TX.makeCanvas(S, S), ax = al.getContext('2d');
  ax.fillStyle = '#ffffff'; ax.fillRect(0, 0, S, S);
  TX.fbm(ax, S, S, r, { start: 6, octaves: 6, alpha: 0.09, falloff: 0.62, mode: 'multiply' });
  TX.fbm(ax, S, S, r, { start: 160, octaves: 2, alpha: 0.03, mode: 'multiply' });
  // roughness 0.45-0.7 with fingerprint smudges and polished patches
  const ro = TX.makeCanvas(S, S), rx = ro.getContext('2d');
  rx.fillStyle = 'rgb(150,150,150)'; rx.fillRect(0, 0, S, S);
  TX.fbm(rx, S, S, r, { start: 4, octaves: 4, alpha: 0.22, falloff: 0.5 });
  // soft polished touch zones (large, blurred, low contrast): ring-shaped smudges here read as streaks in reflections
  for (let k = 0; k < 14; k++) { const x0 = r() * S, y0 = r() * S, rad = 80 + r() * 160; const g = rx.createRadialGradient(x0, y0, 0, x0, y0, rad); g.addColorStop(0, 'rgba(110,110,110,.35)'); g.addColorStop(1, 'rgba(110,110,110,0)'); rx.fillStyle = g; rx.fillRect(x0 - rad, y0 - rad, rad * 2, rad * 2); }
  rx.filter = 'none';
  // normal: high-frequency orange peel + faint scratches
  const hc = TX.makeCanvas(S, S), hx = hc.getContext('2d');
  hx.fillStyle = '#808080'; hx.fillRect(0, 0, S, S);
  TX.noiseLayer(hx, S, S, 700, 0.55, r); TX.noiseLayer(hx, S, S, 380, 0.35, r); TX.noiseLayer(hx, S, S, 90, 0.12, r);
  for (let k = 0; k < 160; k++) { const x0 = r() * S, y0 = r() * S, l = 20 + r() * 140, a = r() * Math.PI; hx.strokeStyle = 'rgba(40,40,40,.55)'; hx.lineWidth = 1 + r(); hx.beginPath(); hx.moveTo(x0, y0); hx.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); hx.stroke(); }
  const nm = heightToNormal(canvasLum(hc), S, 2.2);
  return { albedo: al, rough: ro, normal: nm }; });
  PBR.plastic = { map: texOf(B.albedo, maxAniso, true, 1.5), rough: texOf(B.rough, maxAniso, false, 1.5), normal: texOf(B.normal, maxAniso, false, 3) };
  return PBR.plastic;
}
export function keycapMaps(maxAniso) {
  if (PBR.cap) return PBR.cap;
  const B = TX.bakedMany('keycap', ['normal'], () => { const S = 512, r = TX.rng(52), hc = TX.makeCanvas(S, S), hx = hc.getContext('2d');
    hx.fillStyle = '#808080'; hx.fillRect(0, 0, S, S); TX.noiseLayer(hx, S, S, 256, 0.6, r); TX.noiseLayer(hx, S, S, 128, 0.3, r);
    return { normal: heightToNormal(canvasLum(hc), S, 1.6) }; });
  PBR.cap = { normal: texOf(B.normal, maxAniso, false, 6) };
  return PBR.cap;
}
export function brushedMetal(maxAniso) {
  if (PBR.metal) return PBR.metal;
  const S = 512, c = TX.makeCanvas(S, S), x = c.getContext('2d'), r = TX.rng(63);
  x.fillStyle = 'rgb(95,95,95)'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) { const y = r() * S, v = 60 + r() * 90; x.fillStyle = `rgba(${v},${v},${v},.35)`; x.fillRect(0, y, S, 0.6 + r() * 1.4); }
  const rough = texOf(c, maxAniso, false, 1);
  PBR.metal = new THREE.MeshPhysicalMaterial({ color: '#c4bfb6', metalness: 1, roughness: 0.75, roughnessMap: rough, anisotropy: 0.8, anisotropyRotation: 0, envMapIntensity: 1.0 });
  return PBR.metal;
}
// varnished plank desk: albedo grain + plank tones, roughness (worn varnish), normal (grain + plank grooves)
export function woodMaps(maxAniso) {
  if (PBR.wood) return PBR.wood;
  const B = TX.bakedMany('wood', ['albedo', 'rough', 'normal'], () => {
  const S = 2048, r = TX.rng(77), G = 64, lat = new Float32Array(G * G).map(() => r());
  const vn = (x, y, p) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const X0 = ((xi % p) + p) % p, X1 = (X0 + 1) % p, Y0 = ((yi % p) + p) % p, Y1 = (Y0 + 1) % p;
    const a = lat[Y0 * G + X0], b = lat[Y0 * G + X1], c = lat[Y1 * G + X0], d = lat[Y1 * G + X1]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const PL = 6, ph = S / PL, tones = [], cuts = [];
  for (let i = 0; i < PL; i++) { tones.push(0.82 + r() * 0.3); cuts.push(r() * S); }
  const al = TX.makeCanvas(S, S), ro = TX.makeCanvas(S, S);
  const ad = al.getContext('2d').createImageData(S, S), rd = ro.getContext('2d').createImageData(S, S), h = new Float32Array(S * S);
  const c0 = [0.36, 0.235, 0.15], c1 = [0.2, 0.12, 0.07];
  for (let y = 0; y < S; y++) {
    const pi = Math.floor(y / ph), py = (y % ph) / ph, tone = tones[pi];
    for (let x = 0; x < S; x++) {
      const fx = x / S, fy = y / S;
      const warp = vn(fx * 2, fy * 6, 2) * 1.2 + vn(fx * 8, fy * 12, 8) * 0.25;   // gentle, long waves: straight-sawn grain
      const ring = (fy * 90 + pi * 3.1 + warp * 1.1 + vn(fx * 4, fy * 200, 4) * 0.25) % 1;
      const late = Math.pow(Math.abs(ring * 2 - 1), 6);            // dark latewood bands
      const pore = vn(fx * 64, fy * 1024 / 16, 64) > 0.78 ? 0.6 : 0; // open pores along the grain
      const fleck = vn(fx * 8, fy * 48, 8);
      const gap = Math.min(py, 1 - py) * ph < 1.6 ? 1 : 0;
      const joint = Math.abs(((x - cuts[pi] + S) % S)) < 1.5 ? 1 : 0;
      let t = 0.35 + 0.45 * late + 0.15 * fleck + 0.12 * pore;
      const i = y * S + x, k = i * 4;
      for (let ch = 0; ch < 3; ch++) { let v = (c0[ch] + (c1[ch] - c0[ch]) * t) * tone; if (gap || joint) v *= 0.35; ad.data[k + ch] = Math.min(255, v * 255); }
      ad.data[k + 3] = 255;
      let rv = 0.42 + 0.12 * fleck + 0.15 * late + 0.1 * pore + 0.12 * vn(fx * 6, fy * 6, 6); if (gap || joint) rv = 0.9;
      rd.data[k] = rd.data[k + 1] = rd.data[k + 2] = Math.min(255, rv * 255); rd.data[k + 3] = 255;
      h[i] = 0.5 - 0.12 * late - 0.25 * pore - (gap || joint ? 0.5 : 0) + 0.05 * fleck;
    }
  }
  al.getContext('2d').putImageData(ad, 0, 0); ro.getContext('2d').putImageData(rd, 0, 0);
  const nm = heightToNormal(h, S, 1.6);
  return { albedo: al, rough: ro, normal: nm }; });
  PBR.wood = { map: texOf(B.albedo, maxAniso, true, 1), rough: texOf(B.rough, maxAniso, false, 1), normal: texOf(B.normal, maxAniso, false, 1) };
  return PBR.wood;
}
// Triplanar sampling in object space: no UV seams or stretch on rounded/lofted shells.
// Albedo, roughness and the orange-peel normal are blended from three axis projections.
const TRI_K = 2.2;
// cool back-left rim on the case shells (view-space Fresnel, masked to edges facing up-left): separates the cream
// silhouette from the fog without a real light washing the desk. home.js drives the colour/strength.
export const RIM = { col: { value: new THREE.Color('#b8c2ff') }, k: { value: 1 } };
// fine detail tile: isotropic micro-stipple + faint directional moulding grain (along the draw direction)
export function detailNormal(maxAniso) {
  if (PBR.detail) return PBR.detail;
  const B = TX.bakedMany('detail', ['normal'], () => {
  const S = 512, r = TX.rng(91), h = new Float32Array(S * S);
  const c = TX.makeCanvas(S, S), x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
  TX.noiseLayer(x, S, S, 256, 0.5, r); TX.noiseLayer(x, S, S, 128, 0.25, r);
  for (let i = 0; i < 900; i++) { const y = r() * S, v = 110 + r() * 40; x.fillStyle = `rgba(${v},${v},${v},.22)`; x.fillRect(0, y, S, 0.7 + r()); }   // grain streaks
  const d = x.getImageData(0, 0, S, S).data; for (let i = 0; i < S * S; i++) h[i] = d[i * 4] / 255;
  return { normal: heightToNormal(h, S, 1.2) }; });
  PBR.detail = texOf(B.normal, maxAniso, false, 1);
  return PBR.detail;
}
function triplanar(m) {
  m.userData.tri = true;
  m.onBeforeCompile = (sh) => {
    // case shells (rim) read as smooth moulded ABS: mottling, roughness variation and micro stipple at reduced strength
    const sm = !!m.userData.rim, kAlb = sm ? '.4' : '1.', kRo = sm ? '.2' : '.45', kDet = sm ? '.025' : '.08';
    sh.uniforms.uTriK = { value: TRI_K }; sh.uniforms.tDetail = { value: PBR.detail || null };
    if (m.userData.rim) { sh.uniforms.uRimCol = RIM.col; sh.uniforms.uRimK = RIM.k;
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRimCol; uniform float uRimK;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { vec3 V = normalize(vViewPosition); float f = pow(1. - clamp(dot(normal, V), 0., 1.), 3.);
          float side = clamp(dot(normalize(normal.xy + 1e-4), normalize(vec2(-.62, .78))) * .75 + .35, 0., 1.);
          totalEmissiveRadiance += uRimCol * f * side * uRimK * .8; }`); }
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTriP; varying vec3 vTriN; varying vec3 vTX; varying vec3 vTY; varying vec3 vTZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriP = position; vTriN = normal; vTX = normalize(normalMatrix * vec3(1.,0.,0.)); vTY = normalize(normalMatrix * vec3(0.,1.,0.)); vTZ = normalize(normalMatrix * vec3(0.,0.,1.));');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vTriP; varying vec3 vTriN; varying vec3 vTX; varying vec3 vTY; varying vec3 vTZ; uniform float uTriK; uniform sampler2D tDetail;
      vec3 triW(){ vec3 w = pow(abs(normalize(vTriN)), vec3(4.)); return w / (w.x + w.y + w.z); }
      vec4 tri(sampler2D t, float rep){ vec3 w = triW(); vec3 p = vTriP * uTriK * rep;
        return texture2D(t, p.zy) * w.x + texture2D(t, p.xz) * w.y + texture2D(t, p.xy) * w.z; }`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        diffuseColor *= mix(vec4(1.), tri(map, 1.5), ${kAlb});
      #endif
        { float up = normalize(vTriN).y;   // sun-faded, slightly yellowed top; protected, cooler underside
          diffuseColor.rgb *= mix(vec3(.94, .955, .975), vec3(1.035, 1.02, .975), smoothstep(-.6, .9, up)); }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness;\n#ifdef USE_ROUGHNESSMAP\n roughnessFactor *= mix(1., tri(roughnessMap, .35).g / .59, ' + kRo + ');   /* broad, half-strength variation: fine roughness detail streaked the hood reflections */\n#endif')
      .replace('#include <normal_fragment_maps>', `#ifdef USE_NORMALMAP
        { vec3 w = triW(); vec3 p = vTriP * uTriK * 3.;
          vec2 nx = (texture2D(normalMap, p.zy).xy * 2. - 1.) * normalScale, ny = (texture2D(normalMap, p.xz).xy * 2. - 1.) * normalScale, nz = (texture2D(normalMap, p.xy).xy * 2. - 1.) * normalScale;
          vec3 d = vec3(0., nx.y, nx.x) * w.x + vec3(ny.x, 0., ny.y) * w.y + vec3(nz.x, nz.y, 0.) * w.z;   // object-space perturbation
          normal = normalize(normal + vTX * d.x + vTY * d.y + vTZ * d.z);
          // micro detail at ~18x the base tile (0.08 strength): kills the CG-smooth look up close
          vec3 q = vTriP * uTriK * 18.; vec2 ex = texture2D(tDetail, q.zy).xy * 2. - 1., ey = texture2D(tDetail, q.xz).xy * 2. - 1., ez = texture2D(tDetail, q.xy).xy * 2. - 1.;
          vec3 dd = (vec3(0., ex.y, ex.x) * w.x + vec3(ey.x, 0., ey.y) * w.y + vec3(ez.x, ez.y, 0.) * w.z) * ${kDet};
          normal = normalize(normal + vTX * dd.x + vTY * dd.y + vTZ * dd.z); }
      #endif`);
  };
  m.customProgramCacheKey = () => 'tri' + (m.userData.rim ? 'r' : '') + (m.map ? 1 : 0) + (m.normalMap ? 1 : 0) + (m.roughnessMap ? 1 : 0) + (m.vertexColors ? 1 : 0);
  return m;
}
export function makeClay(maxAniso) {
  const P = plasticMaps(maxAniso); detailNormal(maxAniso);
  const make = (color, o = {}) => triplanar(new THREE.MeshPhysicalMaterial({
    color, map: P.map, normalMap: P.normal, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: P.rough, roughness: 0.74, metalness: 0,   // ABS: 0.38-0.48 through the smudge map
    ior: 1.49, specularIntensity: 0.6, clearcoat: 0, envMapIntensity: 0.45, ...o,
  }));
  return { bump: null, rough: P.rough, grime: P.map, normal: P.normal, make };
}

// One-time light bake at load: render the computer's depth from 64 directions (orthographic, float RT),
// then for every vertex of the large shells count which directions it can see. Upward escapes = sky,
// downward escapes = the warm desk (bounce). Result multiplies into vertex colours. ~64 small renders.
export function bakeComputerLight(renderer, C, { dirs = 64, size = 384, strength = 0.8 } = {}) {
  const pc = C.pc; const t0 = performance.now();
  let rt; try { rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.FloatType, depthBuffer: true }); } catch (e) { return 0; }
  const depthMat = new THREE.ShaderMaterial({ side: THREE.DoubleSide, vertexShader: `varying float vZ; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vZ; void main(){ gl_FragColor = vec4(vZ, 0., 0., 1.); }` });
  const scene = new THREE.Scene(); scene.overrideMaterial = depthMat;
  const parent = pc.parent; const savedPos = pc.position.clone(), savedRot = pc.rotation.clone(), savedScale = pc.scale.clone();
  pc.position.set(0, 0, 0); pc.rotation.set(0, 0, 0); pc.scale.setScalar(1);
  const hidden = [];
  pc.traverse((o) => { if (!o.visible) return; const m = Array.isArray(o.material) ? o.material[0] : o.material; if (o.isPoints || o.isLine || o.isSprite || (m && (m.transparent || m.isShaderMaterial || m.isMeshBasicMaterial))) { hidden.push(o); o.visible = false; } });
  scene.add(pc); pc.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pc), sph = box.getBoundingSphere(new THREE.Sphere());
  const R = sph.radius * 1.05, cam = new THREE.OrthographicCamera(-R, R, R, -R, 0.01, R * 4);
  // targets: big unique shells with their own geometry
  const targets = [];
  pc.traverse((o) => { if (!o.isMesh || !o.visible || !o.geometry || !o.material || Array.isArray(o.material) || o.material.isShaderMaterial) return; const n = o.geometry.attributes.position.count; if (n < 200 || n > 80000 || o.userData.noBake) return;
    if (o.parent && o.parent.parent === C.kb && o.parent !== C.kb) return; targets.push(o); });   // keycaps share geometry: skip
  C.keyMeshes.forEach((k) => { const i = targets.indexOf(k); if (i >= 0) targets.splice(i, 1); });
  const acc = targets.map((m) => ({ m, n: m.geometry.attributes.position.count, sky: new Float32Array(m.geometry.attributes.position.count), desk: new Float32Array(m.geometry.attributes.position.count), w: new Float32Array(m.geometry.attributes.position.count) }));
  // pre-baked factors (tex/lightbake.bin from tools/bake_textures.py): apply and skip the GPU readback loop.
  // Without the file the bake is skipped at runtime (it is a multi-second CPU+readback job); bake mode computes it.
  const bin = TX.bakedBin('lightbake'), fac = acc.map((a) => new Float32Array(a.n * 3));
  let have = false;
  if (bin && !TX.bakeMode) { const h = new Uint32Array(bin, 0, 1 + acc.length);
    if (h[0] === acc.length && acc.every((a, i) => h[1 + i] === a.n)) { const q = new Uint8Array(bin, 4 * (1 + acc.length)); let o = 0; fac.forEach((f) => { for (let i = 0; i < f.length; i++) f[i] = q[o++] / 200; }); have = true; } }
  const finish = (how) => { hidden.forEach((o) => { o.visible = true; }); scene.remove(pc); if (parent) parent.add(pc); pc.position.copy(savedPos); pc.rotation.copy(savedRot); pc.scale.copy(savedScale); pc.updateMatrixWorld(true); rt.dispose(); depthMat.dispose(); return { ms: Math.round(performance.now() - t0), meshes: acc.length, how }; };
  const applyFac = () => acc.forEach((a, ai) => { const g = a.m.geometry, f = fac[ai]; let col = g.attributes.color;
    if (!col) { col = new THREE.BufferAttribute(new Float32Array(a.n * 3).fill(1), 3); g.setAttribute('color', col); }
    for (let i = 0; i < a.n; i++) col.setXYZ(i, col.getX(i) * f[i * 3], col.getY(i) * f[i * 3 + 1], col.getZ(i) * f[i * 3 + 2]);
    col.needsUpdate = true;
    if (!a.m.material.vertexColors) { const old = a.m.material, nm = old.clone(); if (old.userData.tri) triplanar(nm); nm.vertexColors = true; a.m.material = nm; } });
  if (have) { applyFac(); return finish('file'); }
  if (!TX.bakeMode) return finish('skipped');
  const P = acc.map((a) => { const g = a.m.geometry, pos = g.attributes.position, nor = g.attributes.normal, n = a.n, wp = new Float32Array(n * 3), wn = new Float32Array(n * 3);
    const v = new V3(), nn = new V3(), nm = new THREE.Matrix3().getNormalMatrix(a.m.matrixWorld);
    for (let i = 0; i < n; i++) { nn.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); v.fromBufferAttribute(pos, i).applyMatrix4(a.m.matrixWorld).addScaledVector(nn, 0.012);
      wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z; wn[i * 3] = nn.x; wn[i * 3 + 1] = nn.y; wn[i * 3 + 2] = nn.z; }
    return { wp, wn }; });
  const buf = new Float32Array(size * size * 4), d = new V3(), up = new V3(0, 1, 0), right = new V3(), upv = new V3();
  const ga = Math.PI * (3 - Math.sqrt(5));
  try {
    for (let k = 0; k < dirs; k++) {
      const y = 1 - (k + 0.5) / dirs * 2, rr = Math.sqrt(1 - y * y), th = ga * k; d.set(Math.cos(th) * rr, y, Math.sin(th) * rr);   // direction a ray escapes TO
      cam.position.copy(sph.center).addScaledVector(d, R * 2); cam.lookAt(sph.center); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam); renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      const inv = cam.matrixWorldInverse.elements;
      acc.forEach((a, ai) => { const { wp, wn } = P[ai];
        for (let i = 0; i < a.n; i++) { const nd = wn[i * 3] * d.x + wn[i * 3 + 1] * d.y + wn[i * 3 + 2] * d.z; if (nd <= 0) continue;
          const x = wp[i * 3], yy = wp[i * 3 + 1], z = wp[i * 3 + 2];
          const vx = inv[0] * x + inv[4] * yy + inv[8] * z + inv[12], vy = inv[1] * x + inv[5] * yy + inv[9] * z + inv[13], vz = -(inv[2] * x + inv[6] * yy + inv[10] * z + inv[14]);
          const px = Math.floor((vx / R * 0.5 + 0.5) * size), py = Math.floor((vy / R * 0.5 + 0.5) * size); if (px < 0 || py < 0 || px >= size || py >= size) continue;
          const zm = buf[(py * size + px) * 4]; const vis = zm === 0 || vz <= zm + 0.03;
          a.w[i] += nd; if (vis) { if (d.y > -0.05 || yy + d.y * 3 > 0) a.sky[i] += nd; else a.desk[i] += nd; } }   // a downward escape lands on the desk
      });
    }
  } finally { renderer.setRenderTarget(null); }
  acc.forEach((a, ai) => { const f = fac[ai];
    for (let i = 0; i < a.n; i++) { const w = a.w[i] || 1, ao = (a.sky[i] + 0.55 * a.desk[i]) / w, bf = a.desk[i] / w;
      const k = 1 - strength + strength * Math.min(1, 0.25 + 0.95 * ao);
      f[i * 3] = k * (1 + 0.1 * bf); f[i * 3 + 1] = k * (1 + 0.04 * bf); f[i * 3 + 2] = k * (1 - 0.03 * bf); } });
  { // hand the factors to the bake script
    const n = acc.reduce((s2, a) => s2 + a.n * 3, 0), buf2 = new ArrayBuffer(4 * (1 + acc.length) + n), h = new Uint32Array(buf2, 0, 1 + acc.length), q = new Uint8Array(buf2, 4 * (1 + acc.length));
    h[0] = acc.length; acc.forEach((a, i) => { h[1 + i] = a.n; }); let o = 0; fac.forEach((f) => { for (let i = 0; i < f.length; i++) q[o++] = Math.max(0, Math.min(255, Math.round(f[i] * 200))); });
    window.__bakeOut.lightbake = q.length ? new Uint8Array(buf2) : null; }
  applyFac();
  window.__bakeDone = true;
  return finish('computed');
}

// Baked crease AO, grime, moulding line and edge wear for the bezel front (one decal texture).
function bezelDecal(maxAniso, BY, SCREEN_Y, chinY) {
  const FW = 1.96, FH = 1.78, CW = 1024, CH = Math.round(1024 * FH / FW), s = CW / FW;
  const P = (x, y) => [(x + FW / 2) * s, (BY + FH / 2 - y) * s];
  const c = TX.makeCanvas(CW, CH), g = c.getContext('2d'), r = TX.rng(13);
  const layer = () => { const t = TX.makeCanvas(CW, CH); return [t, t.getContext('2d')]; };
  // mottled grime
  { const [t, x] = layer(); TX.fbm(x, CW, CH, r, { start: 10, octaves: 4, alpha: 0.7, color: [40, 28, 18] }); g.globalAlpha = 0.09; g.drawImage(t, 0, 0); g.globalAlpha = 1; }
  // darker lower front
  { const gr = g.createLinearGradient(0, CH * 0.62, 0, CH); gr.addColorStop(0, 'rgba(34,22,12,0)'); gr.addColorStop(1, 'rgba(34,22,12,.2)'); g.fillStyle = gr; g.fillRect(0, 0, CW, CH); }
  const halo = (draw, blur, alpha) => { const [t, x] = layer(); x.filter = `blur(${blur}px)`; x.strokeStyle = `rgba(14,8,4,${alpha})`; x.fillStyle = `rgba(14,8,4,${alpha})`; x.lineWidth = blur * 1.4; draw(x); g.drawImage(t, 0, 0); };
  const rect = (x, cx, cy, w, h, rr) => { const [X, Y] = P(cx - w / 2, cy + h / 2); rrPath(x, X, Y, w * s, h * s, rr * s); };
  // glass recess
  halo((x) => { rect(x, 0, SCREEN_Y, 1.42, 1.06, 0.15); x.stroke(); }, 18, 0.55);
  // plate, floppy bezel, power button, screws
  halo((x) => { rect(x, -0.6, chinY + 0.02, 0.44, 0.18, 0.03); x.stroke(); }, 9, 0.5);
  halo((x) => { rect(x, 0.24, chinY + 0.02, 0.68, 0.17, 0.03); x.stroke(); }, 9, 0.5);
  halo((x) => { const [X, Y] = P(0.78, chinY + 0.02); x.beginPath(); x.arc(X, Y, 0.07 * s, 0, Math.PI * 2); x.stroke(); }, 7, 0.55);
  // faint sink marks: shallow dished rings around each screw boss
  [[-0.84, 0.75], [0.84, 0.75], [-0.84, -0.75], [0.84, -0.75]].forEach(([sx, sy]) => { const [X, Y] = P(sx, BY + sy);
    const rg = g.createRadialGradient(X, Y - 2, 0.03 * s, X, Y, 0.09 * s); rg.addColorStop(0, 'rgba(30,18,8,0)'); rg.addColorStop(0.55, 'rgba(30,18,8,.09)'); rg.addColorStop(0.8, 'rgba(255,240,215,.05)'); rg.addColorStop(1, 'rgba(255,240,215,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(X, Y, 0.09 * s, 0, Math.PI * 2); g.fill(); });
  // hairline scratches around the floppy slot
  { const [X, Y] = P(0.24, chinY + 0.02); for (let k = 0; k < 26; k++) { const x0 = X + (r() - 0.5) * 0.8 * s, y0 = Y + (r() - 0.5) * 0.24 * s, l = 6 + r() * 30, a = (r() - 0.5) * 0.7;
      g.strokeStyle = r() > 0.4 ? 'rgba(255,244,226,.22)' : 'rgba(40,26,14,.18)'; g.lineWidth = 0.6 + r() * 0.5; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * l, y0 + Math.sin(a) * l); g.stroke(); } }
  halo((x) => { [[-0.84, 0.75], [0.84, 0.75], [-0.84, -0.75], [0.84, -0.75]].forEach(([sx, sy]) => { const [X, Y] = P(sx, BY + sy); x.beginPath(); x.arc(X, Y, 0.03 * s, 0, Math.PI * 2); x.fill(); }); }, 4, 0.5);
  // cut the opening (the glass shows through)
  g.globalCompositeOperation = 'destination-out'; rect(g, 0, SCREEN_Y, 1.42, 1.06, 0.15); g.fill(); g.globalCompositeOperation = 'source-over';
  // moulding line ~0.06 inside the outer edge: a dark groove with a lit lower lip
  { const [X, Y] = P(-0.92, BY + 0.83); rrPath(g, X, Y, 1.84 * s, 1.66 * s, 0.22 * s); g.lineWidth = 2.2; g.strokeStyle = 'rgba(30,18,8,.5)'; g.stroke();
    rrPath(g, X + 1.6, Y + 1.8, 1.84 * s, 1.66 * s, 0.22 * s); g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,236,210,.28)'; g.stroke(); }
  // edge wear: lighter, broken highlights along the outer bevel
  { const [X, Y] = P(-0.98, BY + 0.89); g.save(); g.setLineDash([180, 30, 260, 60, 90, 40]); g.filter = 'blur(1.5px)'; rrPath(g, X + 3, Y + 3, 1.96 * s - 6, 1.78 * s - 6, 0.26 * s); g.lineWidth = 5; g.strokeStyle = 'rgba(255,238,214,.1)'; g.stroke(); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = SRGB; t.anisotropy = maxAniso;
  return t;
}

// ------------------------------------------------------------------ keyboard layout
const U = 0.148, GAP = 0.026, KH = 0.07, DISH = 0.0065, TAPER = 0.014;
const C_CREAM = '#E9DCC6', C_ORANGE = '#E0845A', C_GREEN = '#7FAE96';
const ROWS = [
  [['Escape', 'esc', 1, C_ORANGE], ['Digit1', '1'], ['Digit2', '2'], ['Digit3', '3'], ['Digit4', '4'], ['Digit5', '5'], ['Digit6', '6'], ['Digit7', '7'], ['Digit8', '8'], ['Digit9', '9'], ['Digit0', '0'], ['Minus', '-'], ['Equal', '='], ['Backspace', 'back', 2]],
  [['Tab', 'tab', 1.5], ['KeyQ', 'Q'], ['KeyW', 'W'], ['KeyE', 'E'], ['KeyR', 'R'], ['KeyT', 'T'], ['KeyY', 'Y'], ['KeyU', 'U'], ['KeyI', 'I'], ['KeyO', 'O'], ['KeyP', 'P'], ['BracketLeft', '['], ['BracketRight', ']'], ['Backslash', '\\', 1.5]],
  [['CapsLock', 'caps', 1.75], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'], ['KeyF', 'F'], ['KeyG', 'G'], ['KeyH', 'H'], ['KeyJ', 'J'], ['KeyK', 'K'], ['KeyL', 'L'], ['Semicolon', ';'], ['Quote', "'"], ['Enter', 'enter', 2.25, C_GREEN]],
  [['ShiftLeft', 'shift', 1.25], ['KeyZ', 'Z'], ['KeyX', 'X'], ['KeyC', 'C'], ['KeyV', 'V'], ['KeyB', 'B'], ['KeyN', 'N'], ['KeyM', 'M'], ['Comma', ','], ['Period', '.'], ['Slash', '/'], ['ShiftRight', 'shift', 1.75], ['ArrowUp', '↑', 1], ['RDW', 'rdw', 1]],
  [['ControlLeft', 'ctrl', 1.25], ['Fn', 'fn', 1.25], ['AltLeft', 'alt', 1.25], ['Space', '', 6.25], ['AltRight', 'alt', 1.25], [null, null, 0.75], ['ArrowLeft', '←', 1], ['ArrowDown', '↓', 1], ['ArrowRight', '→', 1]],
];
const ROW_TILT = [0.045, 0.025, 0.0, -0.025, -0.04];   // sculpted, stepped profile (about +-2-3.5 deg)
const ROW_STEP = [0.004, 0.002, 0.0, 0.001, 0.002];

function capGeometry(wu) {
  const w = wu * U - GAP, d = U - GAP;
  const g = new RoundedBoxGeometry(w, KH, d, 2, 0.02);
  const p = g.attributes.position, n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  const a = w / 2 - TAPER, b = d / 2 - TAPER;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = clamp((y + KH / 2) / KH);
    x -= Math.sign(x) * TAPER * t; z -= Math.sign(z) * TAPER * t * 1.1;
    const top = n.getY(i) > 0.98;
    if (top) {
      const fx = clamp(1 - (x * x) / (a * a), 0, 1), fz = clamp(1 - (z * z) / (b * b), 0, 1);
      y -= DISH * fx * fz;
      const nx = -DISH * (2 * x / (a * a)) * fz, nz = -DISH * (2 * z / (b * b)) * fx;
      const l = Math.hypot(nx, 1, nz); n.setXYZ(i, -nx / l, 1 / l, -nz / l);
    }
    p.setXYZ(i, x, y, z);
    const shade = top ? 1 : 0.85 + 0.12 * clamp((t - 0.35) / 0.6);   // sides ~15% darker cream   // darker sides, crisp shadow gaps
    col[i * 3] = shade; col[i * 3 + 1] = top ? 1 : shade * 0.9; col[i * 3 + 2] = top ? 1 : shade * 0.9;   // sides toward neutral warm grey (#6f665c), not olive   // sides: darker cream, nudged off olive
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.userData = { a, b };
  return g;
}

function legendAtlas(maxAniso) {
  const AW = 2048, AH = 1024, CH = 128;
  const cv = TX.makeCanvas(AW, AH), x = cv.getContext('2d');
  let cx = 0, cy = 0; const cells = {};
  ROWS.flat().forEach(([code, label, wu = 1, color]) => {
    if (!code || !label) return;
    const cw = Math.round(wu * 128);
    if (cx + cw > AW) { cx = 0; cy += CH; }
    const ink = color ? '#FFF4E4' : '#0C0704';
    x.save(); x.translate(cx, cy);
    x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = color ? 'rgba(80,40,20,.5)' : 'rgba(58,44,32,.45)'; x.shadowBlur = 2.5;
    const single = label.length === 1;
    x.font = single ? '600 82px "JetBrains Mono"' : '600 38px "JetBrains Mono"';
    if (!color) { x.lineJoin = 'round'; x.strokeStyle = 'rgba(12,7,4,.55)'; x.lineWidth = single ? 5 : 3; x.__edge = true; } else x.__edge = false;   /* ink-edge darkening keeps >=3:1 under the screen wash */
    if (label === 'rdw') { x.font = 'italic 52px "Instrument Serif"'; x.fillText('RDW', cw / 2, CH / 2 + 2); }
    else if (single) { if (x.__edge) x.strokeText(label, cw / 2, CH / 2 + 3); x.fillText(label, cw / 2, CH / 2 + 3); }
    else { x.textAlign = 'left'; if (x.__edge) x.strokeText(label, 16, CH - 30); x.fillText(label, 16, CH - 30); }
    x.restore();
    cells[code] = [cx, cy, cw, CH];
    cx += cw;
  });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = SRGB; t.anisotropy = maxAniso; t.minFilter = THREE.LinearMipmapLinearFilter;
  // same glyphs in white for the hover glow
  const gc = TX.makeCanvas(AW, AH), gx = gc.getContext('2d'); gx.drawImage(cv, 0, 0); gx.globalCompositeOperation = 'source-in'; gx.fillStyle = '#fff'; gx.fillRect(0, 0, AW, AH);
  const glow = new THREE.CanvasTexture(gc); glow.colorSpace = SRGB; glow.anisotropy = maxAniso;
  return { tex: t, glow, cells, AW, AH };
}

// ------------------------------------------------------------------ build
export function buildComputer({ maxAniso, clay }) {
  const pc = new THREE.Group();
  const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const bezelMat = clay.make('#E2D6BF');   // warm light cream ABS (~#d8cbb2 after the baked AO): pops off the lavender room
  const body = clay.make('#D9CCB3', { vertexColors: true });
  const plinthMat = clay.make('#B9AD96');
  const bodyShade = clay.make('#C9BBA0');
  const lipMat = clay.make('#3E2C22', { roughness: 0.92, clearcoat: 0, envMapIntensity: 0.2 });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#160f0a', roughness: 0.9 });
  const ventMat = new THREE.MeshStandardMaterial({ color: '#2a231e', roughness: 0.95 });   // vents hold a little dust
  const plateMat = clay.make('#8C6C50', { clearcoat: 0.1 });
  [bezelMat, body, plinthMat, bodyShade].forEach((m) => { m.userData.rim = true; m.normalScale.set(0.05, 0.05); });   // smoother case plastic: orange peel at ~40%
  const { SCREEN_Y } = DIM;
  const BY = DIM.MY - 0.1; // bezel centre
  const chinY = BY - 0.64;
  const FZ = 0.16 + 0.12 + 0.045; // bezel front face
  const DEPTH_END = -2.45;

  // ---- front bezel: chamfered slab with the screen opening, recessed inner lip
  {
    const outer = rrShape(1.96, 1.78, 0.26);
    outer.holes.push(rrShape(1.42, 1.06, 0.15, 0, SCREEN_Y - BY, true));
    const g = new THREE.ExtrudeGeometry(outer, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.04, bevelSegments: 8, curveSegments: 48 });
    const bez = shadowy(new THREE.Mesh(smoothed(g, 2.2), bezelMat)); bez.position.set(0, BY, 0.16); pc.add(bez);
    const lipS = rrShape(1.42, 1.06, 0.15, 0, 0);
    lipS.holes.push(rrShape(1.27, 0.92, 0.11, 0, 0, true));
    const lg = new THREE.ExtrudeGeometry(lipS, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.012, bevelSegments: 3, curveSegments: 32 });
    const lip = shadowy(new THREE.Mesh(lg, lipMat)); lip.position.set(0, SCREEN_Y, 0.17); pc.add(lip);
    const cav = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.12), darkMat); cav.position.set(0, SCREEN_Y, 0.13); pc.add(cav);
    // baked AO / grime / moulding / wear decal on the bezel face
    const dec = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.78), new THREE.MeshStandardMaterial({ map: bezelDecal(maxAniso, BY, SCREEN_Y, chinY), transparent: true, depthWrite: false, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -2 }));
    dec.position.set(0, BY, FZ + 0.0012); dec.receiveShadow = true; pc.add(dec);
  }
  // screen spill on the inner lip, tinted by the live screen colour (set by the caller)
  const lipGlowMat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color('#ffffff') }, uK: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uK; varying vec2 vP;
      float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
      void main(){ float d = sdRR(vP, vec2(.635, .46), .11); float c = length(max(abs(vP) - vec2(.42, .26), 0.));
        float a = exp(-max(d, 0.) * 125.) * uK * (1. - .75 * smoothstep(.0, .2, c));
        gl_FragColor = vec4(uCol * a * .35, 1.); }`,
  });
  {
    const s = rrShape(1.42, 1.06, 0.15, 0, 0); s.holes.push(rrShape(1.27, 0.92, 0.11, 0, 0, true));
    const lg = new THREE.Mesh(new THREE.ShapeGeometry(s, 20), lipGlowMat); lg.position.set(0, SCREEN_Y, 0.262); pc.add(lg);
  }
  // ---- housing: straight section, then a deep CRT back tapering ~25%
  {
    const rings = [
      { z: 0.19, w: 1.98, h: 1.8, r: 0.27, cy: BY },
      { z: -0.3, w: 1.97, h: 1.79, r: 0.27, cy: BY },
      { z: -0.52, w: 1.9, h: 1.74, r: 0.29, cy: BY + 0.01 },
      { z: -1.3, w: 1.7, h: 1.56, r: 0.29, cy: BY + 0.03 },
      { z: -2.2, w: 1.52, h: 1.38, r: 0.27, cy: BY + 0.05 },
      { z: DEPTH_END, w: 1.46, h: 1.32, r: 0.26, cy: BY + 0.06 },
    ];
    // densify along z (~0.08 u steps, linear between key rings so the shape is unchanged): long thin quads split on the diagonal
    // made the env reflection on the rounded hood break into diagonal streaks
    const dense = [];
    for (let i = 0; i < rings.length - 1; i++) { const A = rings[i], B = rings[i + 1], n = Math.max(1, Math.ceil(Math.abs(A.z - B.z) / 0.08));
      for (let k = 0; k < n; k++) { const t = k / n, e = t, m = (a, b) => a + (b - a) * e; dense.push({ z: A.z + (B.z - A.z) * t, w: m(A.w, B.w), h: m(A.h, B.h), r: m(A.r, B.r), cy: m(A.cy, B.cy) }); } }
    dense.push(rings[rings.length - 1]);
    pc.add(shadowy(new THREE.Mesh(boxUV(loft(dense, 16), 2.2), body)));
    const cap = shadowy(new THREE.Mesh(new THREE.ShapeGeometry(rrShape(1.46, 1.32, 0.26), 8), clay.make('#C4B69B')));
    cap.rotation.y = Math.PI; cap.position.set(0, BY + 0.06, DEPTH_END); pc.add(cap);
    const inlet = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.14, 0.04, 2, 0.02), darkMat); inlet.position.set(0.22, BY - 0.12, DEPTH_END - 0.015); pc.add(inlet);
    // hood-to-body seam: an inset groove a third of the way down each side, following the taper
    const seamY = BY + 0.9 - 1.8 / 3;
    [-1, 1].forEach((sd) => {
      const pos = [], idx = [];
      rings.slice(0, -1).forEach(({ z, w }, i) => {
        const x = sd * (w / 2 + 0.0025);
        pos.push(x, seamY + 0.0022, z, x, seamY - 0.0022, z);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      });
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gg.setIndex(idx); gg.computeVertexNormals();
      pc.add(new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ color: '#2a1c12', roughness: 0.9, side: THREE.DoubleSide })));
      const pp = [], pi = [];
      rings.slice(0, -1).forEach(({ z, w }, i) => { const x = sd * (w / 2 + 0.0035); pp.push(x, seamY - 0.0035, z, x, seamY - 0.0055, z); if (i) { const a = (i - 1) * 2; pi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } });
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setIndex(pi); pg.computeVertexNormals();
      pc.add(new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ color: '#E2D2B4', roughness: 0.3, side: THREE.DoubleSide })));
    });
  }
  // ---- panel gap: a dark seam where the bezel meets the case
  { const gp = loft([{ z: 0.125, w: 1.995, h: 1.815, r: 0.275, cy: BY }, { z: 0.1, w: 1.99, h: 1.81, r: 0.275, cy: BY }], 10); pc.add(new THREE.Mesh(gp, new THREE.MeshStandardMaterial({ color: '#120c08', roughness: 0.9, side: THREE.DoubleSide }))); }
  // ---- rear label sticker (our own text)
  {
    const c = TX.makeCanvas(1024, 560), x = c.getContext('2d'), r = TX.rng(88);
    x.fillStyle = '#E4D8BC'; x.fillRect(0, 0, 1024, 560); TX.fbm(x, 1024, 560, r, { start: 6, octaves: 3, alpha: 0.08, mode: 'multiply' });
    x.shadowColor = 'rgba(26,22,20,.45)'; x.shadowBlur = 1.6;   // slight ink bleed
    x.fillStyle = 'rgba(26,22,20,.9)'; x.font = '700 54px "JetBrains Mono"'; x.fillText('RDW LABZ', 40, 82);
    x.font = '500 34px "JetBrains Mono"'; x.fillText('MODEL WB-26 · HARRISON AR', 40, 140); x.fillText('SERIAL  WB26-0001-AR', 40, 190);
    x.fillText('INPUT  CLAY + COFFEE', 40, 240); x.font = '500 26px "JetBrains Mono"'; x.fillStyle = '#6a5a4a'; x.fillText('DO NOT OPEN. NO USER-SERVICEABLE BLOBS INSIDE.', 40, 300);
    for (let i = 0; i < 60; i++) { const w = 2 + (r() * 3 | 0) * 2; x.fillStyle = '#2b2420'; if (r() > 0.35) x.fillRect(40 + i * 9, 360, w, 120); }
    x.font = '500 22px "JetBrains Mono"'; x.fillStyle = '#2b2420'; x.fillText('WB26 0001 AR', 120, 510);
    // tiny icons: lightning bolt, blob, recycle-ish loop
    x.lineWidth = 6; x.strokeStyle = '#2b2420';
    x.translate(-70, 0); x.beginPath(); x.moveTo(770, 360); x.lineTo(740, 420); x.lineTo(770, 420); x.lineTo(745, 480); x.stroke();
    x.beginPath(); x.moveTo(820, 480); x.bezierCurveTo(805, 420, 830, 365, 860, 360); x.bezierCurveTo(890, 365, 915, 420, 900, 480); x.closePath(); x.stroke();
    x.beginPath(); x.arc(985, 420, 38, 0.4, Math.PI * 1.8); x.stroke(); x.beginPath(); x.moveTo(1010, 390); x.lineTo(1022, 410); x.lineTo(1000, 412); x.stroke(); x.setTransform(1, 0, 0, 1, 0, 0);
    x.strokeStyle = 'rgba(43,36,32,.35)'; x.lineWidth = 3; x.strokeRect(12, 12, 1000, 536);
    x.shadowBlur = 0;
    // scuff across the barcode
    x.save(); x.translate(300, 420); x.rotate(-0.22); for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(228,216,188,${0.25 + r() * 0.5})`; x.lineWidth = 1 + r() * 3; x.beginPath(); const y0 = (r() - 0.5) * 34; x.moveTo(-200 + r() * 40, y0); x.lineTo(160 + r() * 60, y0 + (r() - 0.5) * 6); x.stroke(); } x.restore();
    // faint dust film, heavier toward the bottom edge
    TX.fbm(x, 1024, 560, r, { start: 40, octaves: 3, alpha: 0.07, color: [200, 190, 172] });
    { const dg = x.createLinearGradient(0, 300, 0, 560); dg.addColorStop(0, 'rgba(190,178,158,0)'); dg.addColorStop(1, 'rgba(190,178,158,.16)'); x.fillStyle = dg; x.fillRect(0, 0, 1024, 560); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = SRGB; t.anisotropy = maxAniso;
    const lg = new THREE.PlaneGeometry(0.62, 0.34, 10, 6);
    { const p = lg.attributes.position; for (let i = 0; i < p.count; i++) { const nx = p.getX(i) / 0.31, ny = p.getY(i) / 0.17, k = Math.max(0, (nx + ny - 1.5) / 0.5); p.setZ(i, 0.03 * k * k); } lg.computeVertexNormals(); }   // one lifted corner
    const lab = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ map: t, color: '#cfc7b8', roughness: 0.85, envMapIntensity: 0.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    lab.castShadow = true;
    lab.rotation.y = Math.PI; lab.position.set(-0.22, BY + 0.28, DEPTH_END - 0.002); pc.add(lab);
    // power-cord strain reliefs where the cables leave the case
    const relM = new THREE.MeshStandardMaterial({ color: '#2a201c', roughness: 0.7 });
    // rear vent slots (recessed, dark) + four case screws
    { const c = TX.makeCanvas(64, 512), x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#030202'); g.addColorStop(0.5, '#0a0605'); g.addColorStop(1, '#070504'); x.fillStyle = g; x.fillRect(0, 0, 64, 512);
      const rg = x.createRadialGradient(32, 300, 0, 32, 300, 220); rg.addColorStop(0, 'rgba(255,96,36,.28)'); rg.addColorStop(1, 'rgba(255,96,36,0)'); x.fillStyle = rg; x.fillRect(0, 0, 64, 512);   // heater glow behind
      x.fillStyle = 'rgba(0,0,0,.85)'; for (let yy = 8; yy < 512; yy += 14) for (let xx = 6; xx < 64; xx += 14) { x.fillRect(xx - 3, yy - 3, 9, 9); }   // perforated grille 4 mm in
      x.fillStyle = 'rgba(0,0,0,.9)'; x.fillRect(0, 0, 64, 26);   // upper lip shadow (6 mm depth)
      const dg = x.createLinearGradient(0, 470, 0, 512); dg.addColorStop(0, 'rgba(150,138,122,0)'); dg.addColorStop(1, 'rgba(150,138,122,.55)'); x.fillStyle = dg; x.fillRect(0, 470, 64, 42);   // dust on the lower lip
      const vt = new THREE.CanvasTexture(c); vt.colorSpace = SRGB;
      const vm = new THREE.MeshBasicMaterial({ map: vt, polygonOffset: true, polygonOffsetFactor: -2 });
      for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.29), vm); f.rotation.y = Math.PI; f.position.set(0.2 + i * 0.062, BY + 0.27, DEPTH_END - 0.0062); pc.add(f); }
      [[-0.58, 0.52], [0.58, 0.52], [-0.58, -0.5], [0.58, -0.5]].forEach(([sx, sy]) => { const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), dimpleMat('#A69373', 0.2)); dm.rotation.y = Math.PI; /* ~6 mm dimple (core) with a soft rim */ dm.position.set(sx + (sx > 0 ? -0.05 : 0.05), BY + sy + (sy > 0 ? -0.045 : 0.045), DEPTH_END - 0.0012); pc.add(dm); }); }
    { const vs = new RoundedBoxGeometry(0.034, 0.3, 0.02, 2, 0.012); for (let i = 0; i < 7; i++) { const v = new THREE.Mesh(vs, ventMat); v.position.set(0.2 + i * 0.062, BY + 0.27, DEPTH_END + 0.004); pc.add(v); }
      const sg = new THREE.CylinderGeometry(0.026, 0.026, 0.014, 20), slotG = new THREE.BoxGeometry(0.036, 0.006, 0.004), sm = new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.8 });
      [[-0.58, 0.52], [0.58, 0.52], [-0.58, -0.5], [0.58, -0.5]].forEach(([sx, sy], i) => { const sc = shadowy(new THREE.Mesh(sg, brushedMetal(maxAniso))); sc.rotation.x = Math.PI / 2; sc.position.set(sx, BY + sy, DEPTH_END - 0.006); pc.add(sc);
        const sl = new THREE.Mesh(slotG, sm); sl.position.set(sx, BY + sy, DEPTH_END - 0.0135); sl.rotation.z = 0.4 + i * 0.9; pc.add(sl); }); }
    [0.32, -0.32].forEach((x0) => { const rel = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.045, 0.12, 16), relM)); rel.rotation.x = Math.PI / 2; rel.position.set(x0, BY - 0.12, DEPTH_END - 0.06); pc.add(rel); });
  }
  // ---- vents on top and both sides
  {
    const slot = new RoundedBoxGeometry(0.045, 0.02, 0.36, 2, 0.008);
    // (no top vents: at hero distance the nine slots read as stripes across the hood; side + rear vents carry the airflow)
    const sslot = new RoundedBoxGeometry(0.02, 0.04, 0.34, 2, 0.008);
    [-1, 1].forEach((sd) => {
      const back = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.52, 0.4, 3, 0.012), ventMat); back.position.set(sd * 0.978, BY - 0.15, -0.05); pc.add(back);
      for (let i = 0; i < 6; i++) { const slat = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.035, 0.38, 3, 0.01), body)); slat.position.set(sd * 0.988, BY + 0.06 - i * 0.084, -0.05); slat.rotation.z = sd * 0.35; pc.add(slat); }
    });
  }
  // ---- chin: embossed RDW plate, floppy drive with eject, power button, LED, screws
  let led, fled, pcPower;
  {
    const c = TX.makeCanvas(512, 192), x = c.getContext('2d');
    x.fillStyle = '#8C6C50'; x.fillRect(0, 0, 512, 192);
    x.font = 'italic 150px "Instrument Serif"'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(40,24,10,.6)'; x.fillText('RDW', 258, 104);
    x.fillStyle = '#E8D3B4'; x.fillText('RDW', 252, 98);
    { const sr = TX.rng(77); x.lineCap = 'round'; for (let i = 0; i < 9; i++) { const sx0 = 330 + sr() * 120, sy0 = 120 + sr() * 50; x.strokeStyle = `rgba(232,211,180,${0.18 + sr() * 0.2})`; x.lineWidth = 1 + sr() * 2; x.beginPath(); x.moveTo(sx0, sy0); x.lineTo(sx0 + 20 + sr() * 50, sy0 - 4 + sr() * 10); x.stroke(); } }
    const t = new THREE.CanvasTexture(c); t.colorSpace = SRGB; t.anisotropy = maxAniso;
    const bc = TX.makeCanvas(512, 192), bx = bc.getContext('2d');
    bx.fillStyle = '#000'; bx.fillRect(0, 0, 512, 192); bx.font = 'italic 150px "Instrument Serif"'; bx.textAlign = 'center'; bx.textBaseline = 'middle'; bx.fillStyle = '#fff'; bx.fillText('RDW', 252, 98);
    bx.filter = 'blur(1.2px)'; bx.drawImage(bc, 0, 0);
    const bt = new THREE.CanvasTexture(bc);
    const plate = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.16, 0.03, 2, 0.012), plateMat)); plate.position.set(-0.6, chinY + 0.02, FZ + 0.006); pc.add(plate);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.1425), new THREE.MeshStandardMaterial({ map: t, bumpMap: bt, bumpScale: 2.2, roughness: 0.5 }));
    face.position.set(-0.6, chinY + 0.02, FZ + 0.0225); pc.add(face);
    const fbz = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.15, 0.03, 2, 0.02), bodyShade)); fbz.position.set(0.24, chinY + 0.02, FZ + 0.004); pc.add(fbz);
    const fslot = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.028, 0.02, 1, 0.008), darkMat); fslot.position.set(0.18, chinY + 0.035, FZ + 0.016); pc.add(fslot);
    { const shM = new THREE.MeshPhysicalMaterial({ color: '#c9c4bb', metalness: 1, roughness: 0.35, anisotropy: 0.85, anisotropyRotation: 0, roughnessMap: brushedMetal(maxAniso).roughnessMap, envMapIntensity: 1.4 });
      const sh = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.02, 0.004, 1, 0.002), shM));
      { const sc = TX.makeCanvas(256, 16), sx = sc.getContext('2d'); const g = sx.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, 'rgba(255,250,240,1)'); g.addColorStop(0.55, 'rgba(255,250,240,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = g; sx.fillRect(0, 6, 256, 2);
        const st = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.012), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false }));
        st.position.set(0.18, chinY + 0.037, FZ + 0.0299); st.rotation.x = -0.12; pc.add(st); }   /* thin anisotropic streak along the brushing */
      sh.position.set(0.18, chinY + 0.035, FZ + 0.0275); sh.rotation.x = -0.12; pc.add(sh);   // sprung shutter, tipped in a hair
      const ic = TX.makeCanvas(256, 64), ix = ic.getContext('2d'); const g = ix.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(0.5, 'rgba(0,0,0,.2)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ix.fillStyle = g; ix.fillRect(0, 0, 256, 64);
      const ins = new THREE.Mesh(new THREE.PlaneGeometry(0.47, 0.016), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ic), transparent: true, depthWrite: false })); ins.position.set(0.18, chinY + 0.042, FZ + 0.0302); pc.add(ins);
      const tc = TX.makeCanvas(384, 128), tx = tc.getContext('2d'); tx.fillStyle = '#000'; tx.fillRect(0, 0, 384, 128); tx.font = '700 92px "JetBrains Mono"'; tx.textAlign = 'center'; tx.textBaseline = 'middle';
      tx.fillStyle = '#fff'; tx.fillText('1.44', 192, 68); tx.filter = 'blur(1.5px)'; tx.drawImage(tc, 0, 0); tx.filter = 'none';
      const ac = TX.makeCanvas(384, 128), ax = ac.getContext('2d'); ax.filter = 'blur(6px)'; for (let k = 0; k < 3; k++) ax.drawImage(tc, 0, 0);   // alpha hugs the glyphs: no visible patch
      const bm = new THREE.CanvasTexture(tc);
      const m144 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.06), new THREE.MeshPhysicalMaterial({ color: '#C9BBA0', bumpMap: bm, bumpScale: 3, alphaMap: new THREE.CanvasTexture(ac), transparent: true, depthWrite: false, roughness: 0.42, ior: 1.49, specularIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -3 }));
      m144.position.set(0.05, chinY - 0.022, FZ + 0.0195); pc.add(m144); }
    const ej = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.04, 0.03, 4, 0.01), brushedMetal(maxAniso))); ej.position.set(0.5, chinY + 0.0, FZ + 0.02); pc.add(ej);
    { const c = TX.makeCanvas(256, 256), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
      [[96, 120, 0.4], [170, 150, -0.3]].forEach(([cx, cy, rot]) => { x.save(); x.translate(cx, cy); x.rotate(rot); for (let i = 1; i < 16; i++) { x.strokeStyle = `rgba(255,255,255,${0.55 * (1 - i / 17)})`; x.lineWidth = 1.6; x.beginPath(); x.ellipse(0, 0, i * 3.1, i * 4.2, 0, 0.2 + i * 0.3, Math.PI * 2 - 0.4); x.stroke(); } x.restore(); });
      x.filter = 'blur(0.8px)'; x.drawImage(c, 0, 0); x.filter = 'none';
      // greasy whorls: faint face-on, a hazy sheen at grazing angles (Fresnel)
      const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), new THREE.ShaderMaterial({ uniforms: { tM: { value: new THREE.CanvasTexture(c) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `uniform sampler2D tM; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float m = texture2D(tM, vUv).r; float g = 1. - clamp(dot(vN, vV), 0., 1.);
          gl_FragColor = vec4(vec3(.62, .58, .52) * m * (.08 + 1.4 * pow(g, 1.2)), 1.); }` }));
      fp.position.set(0.7, chinY + 0.07, FZ + 0.0025); pc.add(fp); }
    const pb = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.035, 28), clay.make('#D8C7AA', { roughness: 0.45, clearcoat: 0.45, clearcoatRoughness: 0.2 }))); pb.rotation.x = Math.PI / 2; pb.position.set(0.78, chinY + 0.02, FZ + 0.012); pc.add(pb); pcPower = pb;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 8, 28), lipMat); ring.position.set(0.78, chinY + 0.02, FZ + 0.002); pc.add(ring);
    led = new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#7dffb0').multiplyScalar(3.2), toneMapped: false }));
    led.position.set(0.66, chinY + 0.02, FZ + 0.004); pc.add(led);
    { const dome = new THREE.Mesh(new THREE.SphereGeometry(0.017, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#c8ffd8', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.5, transparent: true, opacity: 0.32, envMapIntensity: 1.2, depthWrite: false }));
      dome.rotation.x = Math.PI / 2; dome.position.set(0.66, chinY + 0.02, FZ + 0.002); dome.scale.set(1, 0.7, 1); pc.add(dome);
      const dr = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0035, 8, 28), new THREE.MeshStandardMaterial({ color: '#120d0a', roughness: 0.5 })); dr.position.set(0.66, chinY + 0.02, FZ + 0.002); pc.add(dr); }
    fled = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb24a').multiplyScalar(0.25), toneMapped: false }));
    fled.position.set(0.46, chinY + 0.068, FZ + 0.021); pc.add(fled);
    const sMat = brushedMetal(maxAniso);
    [[-0.84, 0.75], [0.84, 0.75], [-0.84, -0.75], [0.84, -0.75]].forEach(([sx, sy], i) => {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.012, 18), sMat); s.rotation.x = Math.PI / 2; s.position.set(sx, BY + sy, FZ + 0.004); pc.add(s);
      const slt = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.006, 0.004), darkMat); slt.position.set(sx, BY + sy, FZ + 0.011); slt.rotation.z = 0.5 + i; pc.add(slt);
      const dm = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), dimpleMat('#C8B392')); dm.position.set(sx + (sx > 0 ? -0.06 : 0.06), BY + sy + (sy > 0 ? -0.05 : 0.05), FZ + 0.0016); pc.add(dm);
    });
  }
  // ---- chunky base plinth (4% wider than the body), swivel stand, contact shadows
  const rad = radialTex(128), soft = softRectTex(256, 0.16, 0.16);
  {
    const PL_W = 1.98 * 1.04, PL_D = 2.55, PL_H = 0.1, PL_Z = -0.825;
    const plinth = shadowy(new THREE.Mesh(new RoundedBoxGeometry(PL_W, PL_H, PL_D, 6, 0.03), plinthMat)); plinth.position.set(0, PL_H / 2, PL_Z); pc.add(plinth);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(PL_W * 1.12, PL_D * 1.1), new THREE.MeshBasicMaterial({ map: soft, transparent: true, opacity: 0.55, depthWrite: false, color: '#000' }));
    desk.rotation.x = -Math.PI / 2; desk.position.set(0, 0.003, PL_Z); pc.add(desk);
    const prof = [[0, 0], [0.62, 0], [0.665, 0.018], [0.66, 0.05], [0.6, 0.075], [0.42, 0.09], [0.3, 0.11], [0.25, 0.15], [0.24, 0.2], [0.27, 0.22], [0, 0.22]];
    const st = shadowy(new THREE.Mesh(new THREE.LatheGeometry(prof.map((q) => new THREE.Vector2(q[0], q[1])), 56), bodyShade));
    st.scale.set(1, 1, 0.82); st.position.set(0, PL_H, -0.42); pc.add(st);
    const bolt = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6), brushedMetal(maxAniso))); bolt.rotation.x = Math.PI / 2; bolt.position.set(0, PL_H + 0.06, -0.42 + 0.6 * 0.82 + 0.005); pc.add(bolt);
    // rubber feet under the plinth corners
    const rub = new THREE.MeshStandardMaterial({ color: '#1e1a18', roughness: 0.9 });
    const footSh = new THREE.MeshBasicMaterial({ map: rad, transparent: true, opacity: 0.75, depthWrite: false, color: '#000' });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.012, 20), rub); f.position.set(sx * (PL_W / 2 - 0.12), 0.006, PL_Z + sz * (PL_D / 2 - 0.14)); pc.add(f);
      const fs = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), footSh); fs.rotation.x = -Math.PI / 2; fs.position.set(f.position.x, 0.0025, f.position.z); pc.add(fs); });
    { const tight = new THREE.Mesh(new THREE.PlaneGeometry(PL_W + 0.1, PL_D + 0.1), new THREE.MeshBasicMaterial({ map: softRectTex(256, 0.05, 0.05), transparent: true, opacity: 0.6, depthWrite: false, color: '#000' }));
      tight.rotation.x = -Math.PI / 2; tight.position.set(0, 0.0035, PL_Z); pc.add(tight); }
    const join = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.7), new THREE.MeshBasicMaterial({ map: rad, transparent: true, opacity: 0.6, depthWrite: false, color: '#000' }));
    join.rotation.x = -Math.PI / 2; join.position.set(0, PL_H + 0.002, -0.5); pc.add(join);
    const foot = new THREE.Mesh(new THREE.PlaneGeometry(1.98 * 1.2, 2.3 * 1.2), new THREE.MeshBasicMaterial({ map: soft, transparent: true, opacity: 0.5, depthWrite: false, color: '#000' }));
    foot.rotation.x = -Math.PI / 2; foot.position.set(0, PL_H + 0.003, -0.95); pc.add(foot);
  }

  // ---- curved CRT glass (shader material assigned by the caller)
  const glassGeo = new THREE.PlaneGeometry(DIM.PLANE_W, DIM.PLANE_H, 28, 20);
  {
    const p = glassGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (DIM.PLANE_W / 2), y = p.getY(i) / (DIM.PLANE_H / 2); p.setZ(i, 0.05 * (1 - 0.55 * x * x - 0.55 * y * y)); }
    glassGeo.computeVertexNormals();
  }

  // ---- thick-glass cues over the CRT face: edge tint + corner internal-reflection darkening (multiply),
  // and dust specks that only light up where the glass catches a highlight (additive, Fresnel x light angle)
  {
    const gm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `varying vec2 vUv; void main(){ vec2 q = abs(vUv - .5) * 2.; float e = max(q.x, q.y), c = q.x * q.y;
        vec3 m = mix(vec3(1.), vec3(.86, .93, .9), smoothstep(.8, 1., e)) * (1. - .22 * smoothstep(.45, .95, c)); gl_FragColor = vec4(m, 1.); }` });
    const edge = new THREE.Mesh(glassGeo, gm); edge.position.set(0, DIM.SCREEN_Y, DIM.SCREEN_Z + 0.002); edge.renderOrder = 4; pc.add(edge);
    const dc = TX.makeCanvas(512, 512), dx = dc.getContext('2d'), r = TX.rng(23);
    for (let i = 0; i < 160; i++) { const a = 0.25 + r() * 0.75; dx.fillStyle = `rgba(255,255,255,${a})`; dx.beginPath(); dx.arc(r() * 512, r() * 512, 0.5 + r() * r() * 1.8, 0, 6.283); dx.fill(); }
    for (let i = 0; i < 6; i++) { dx.strokeStyle = 'rgba(255,255,255,.35)'; dx.lineWidth = 0.6; dx.beginPath(); const x0 = r() * 512, y0 = r() * 512; dx.moveTo(x0, y0); dx.lineTo(x0 + (r() - 0.5) * 18, y0 + (r() - 0.5) * 18); dx.stroke(); }   // lint fibres
    const dm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { tD: { value: new THREE.CanvasTexture(dc) } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform sampler2D tD; varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
        void main(){ float d = texture2D(tD, vUv).r; vec3 L = normalize(vec3(-3.2, 4.2, 4.2) - vW);   // key light direction (world)
          float spec = pow(max(dot(normalize(vN), normalize(L + vV)), 0.), 24.); float fres = .04 + .96 * pow(1. - max(dot(vN, vV), 0.), 5.);
          float a = d * smoothstep(.15, .7, spec) * .45; /* specks show only where the glass catches the key light */ gl_FragColor = vec4(vec3(1., .97, .93) * a, 1.); }` });
    const dust = new THREE.Mesh(glassGeo, dm); dust.position.set(0, DIM.SCREEN_Y, DIM.SCREEN_Z + 0.0045); dust.renderOrder = 5; pc.add(dust);
  }
  // ---- keyboard: wedge case (front 0.06 / back 0.165, ~6 deg) with a front lip
  const kb = new THREE.Group(); kb.position.set(0, 0.02, 1.32); pc.add(kb);
  const TRAY_W = 2.48, TRAY_D = 1.02;
  {
    const sh = new THREE.Shape();   // profile in (u = -z, y)
    sh.moveTo(-0.51, 0); sh.lineTo(0.51, 0); sh.lineTo(0.51, 0.165); sh.lineTo(-0.44, 0.067); sh.lineTo(-0.465, 0.088); sh.lineTo(-0.51, 0.074); sh.lineTo(-0.51, 0);
    const g = new THREE.ExtrudeGeometry(sh, { depth: TRAY_W - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 5, curveSegments: 4 });
    g.rotateY(Math.PI / 2); g.translate(-(TRAY_W - 0.04) / 2, 0, 0);
    { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5); }
    kb.add(shadowy(new THREE.Mesh(smoothed(g, 2.2), clay.make('#3a2418', { roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.4 }))));   // smoked walnut, satin (~0.35)
    { const gk = new THREE.Mesh(new RoundedBoxGeometry(TRAY_W + 0.035, 0.024, TRAY_D + 0.035, 2, 0.01), new THREE.MeshStandardMaterial({ color: '#0e0b0a', roughness: 0.85 }));
      gk.position.set(0, -0.008, 0); gk.receiveShadow = true; kb.add(gk); }   // 3 mm dark rubber gasket where the case meets the desk
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(TRAY_W * 1.06 * 1.3, TRAY_D * 1.06 * 1.3), new THREE.MeshBasicMaterial({ map: soft, transparent: true, opacity: 0.4, depthWrite: false, color: '#000' }));
    cs.rotation.x = -Math.PI / 2; cs.position.set(0, -0.017, 0); kb.add(cs);
    const rubK = new THREE.MeshStandardMaterial({ color: '#1e1a18', roughness: 0.9 });
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => { const f = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.025, 0.06, 2, 0.01), rubK); f.position.set(sx * 1.05, -0.012, sz * 0.42); kb.add(f);
      const fs = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.14), new THREE.MeshBasicMaterial({ map: radialTex(64), transparent: true, opacity: 0.7, depthWrite: false, color: '#000' })); fs.rotation.x = -Math.PI / 2; fs.position.set(f.position.x, -0.0175, f.position.z); kb.add(fs); });
    { const tk = new THREE.Mesh(new THREE.PlaneGeometry(TRAY_W + 0.08, TRAY_D + 0.08), new THREE.MeshBasicMaterial({ map: softRectTex(256, 0.05, 0.05), transparent: true, opacity: 0.6, depthWrite: false, color: '#000' }));
      tk.rotation.x = -Math.PI / 2; tk.position.set(0, -0.0172, 0); kb.add(tk); }
  }
  const SLOPE = Math.atan((0.165 - 0.067) / 0.95);
  const keyDeck = new THREE.Group(); keyDeck.position.set(0, 0.119 + 0.02, -0.064); keyDeck.rotation.x = SLOPE; kb.add(keyDeck);
  let capsLed;
  {
    // deck plate: darker, inset into the shell with a dark seam; a little cavity dust in the key gaps
    const c = TX.makeCanvas(512, 256), x = c.getContext('2d'), r = TX.rng(17); x.fillStyle = '#1f150f'; x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(190,176,156,${0.04 + r() * 0.08})`; x.fillRect(r() * 512, r() * 256, 1 + r() * 1.5, 1 + r() * 1.5); }
    const dt = new THREE.CanvasTexture(c); dt.colorSpace = SRGB; dt.anisotropy = maxAniso;
    const seam = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 0.94), new THREE.MeshBasicMaterial({ color: '#0d0907' })); seam.rotation.x = -Math.PI / 2; seam.position.set(0, 0.0012, -0.035); keyDeck.add(seam);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(2.33, 0.004, 0.91, 1, 0.0015), new THREE.MeshStandardMaterial({ map: dt, roughness: 0.75 })); plate.position.set(0, 0.0022, -0.035); plate.receiveShadow = true; keyDeck.add(plate);
    capsLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb24a').multiplyScalar(0.12), toneMapped: false }));
    capsLed.position.set(1.06, 0.0052, -0.425); keyDeck.add(capsLed);
    const bc2 = TX.makeCanvas(256, 64), bx2 = bc2.getContext('2d'); bx2.fillStyle = '#2b201a'; bx2.fillRect(0, 0, 256, 64); bx2.font = 'italic 46px "Instrument Serif"'; bx2.textAlign = 'center'; bx2.textBaseline = 'middle';
    bx2.fillStyle = 'rgba(0,0,0,.6)'; bx2.fillText('RDW', 130, 35); bx2.fillStyle = '#d9c4a2'; bx2.fillText('RDW', 128, 32);
    const bt2 = new THREE.CanvasTexture(bc2); bt2.colorSpace = SRGB; bt2.anisotropy = maxAniso;
    const badge = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.05, 0.006, 1, 0.002), [0, 0, 0, 0, new THREE.MeshStandardMaterial({ map: bt2, roughness: 0.35, metalness: 0.3 }), new THREE.MeshStandardMaterial({ color: '#2b201a' })].map((m) => m || new THREE.MeshStandardMaterial({ color: '#2b201a', roughness: 0.4 })));
    badge.position.set(-0.95, 0.04, 0.513); kb.add(badge);
    const dc = TX.makeCanvas(256, 128), dx = dc.getContext('2d'); dx.filter = 'blur(3px)'; dx.strokeStyle = 'rgba(205,195,180,.5)'; dx.lineWidth = 5; rrPath(dx, 10, 10, 236, 108, 10); dx.stroke();
    const dring = new THREE.Mesh(new THREE.PlaneGeometry(TRAY_W + 0.1, TRAY_D + 0.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(dc), transparent: true, opacity: 0.1, depthWrite: false }));
    dring.rotation.x = -Math.PI / 2; dring.position.set(0.05, -0.0168, -0.04); kb.add(dring);   // where the keyboard sat before it was nudged
  }
  const atlas = legendAtlas(maxAniso);
  const capMats = {};
  const KC = keycapMaps(maxAniso);
  const wornMat = (c) => capMats['w' + c] || (capMats['w' + c] = new THREE.MeshPhysicalMaterial({ color: c, vertexColors: true, roughness: 0.32, clearcoat: 0.35, clearcoatRoughness: 0.25, normalMap: KC.normal, normalScale: new THREE.Vector2(0.06, 0.06), envMapIntensity: 0.6 }));
  const capMat = (c) => capMats[c] || (capMats[c] = new THREE.MeshPhysicalMaterial({ color: c, vertexColors: true, roughness: 0.6, clearcoat: 0, normalMap: KC.normal, normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 0.25 }));
  const decalMat = new THREE.MeshPhysicalMaterial({ map: atlas.tex, transparent: true, roughness: 0.9, specularIntensity: 0.15, envMapIntensity: 0.05, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  const geoCache = {};
  const keys = {}; const keyMeshes = [];
  ROWS.forEach((row, ri) => {
    let xu = 0; const z = -0.36 + ri * U + 0.064;
    row.forEach(([code, label, wu = 1, color]) => {
      if (!code) { xu += wu; return; }
      const cx = (xu + wu / 2) * U - 7.5 * U;
      const g = geoCache[wu] || (geoCache[wu] = capGeometry(wu));
      const grp = new THREE.Group(); grp.position.set(cx, KH / 2 - 0.012 + ROW_STEP[ri], z); grp.rotation.x = ROW_TILT[ri]; keyDeck.add(grp);
      const worn = ['Space', 'Enter', 'KeyE', 'KeyA', 'KeyS', 'KeyT', 'KeyN', 'KeyO', 'Backspace', 'KeyR'].includes(code);
      const cap = new THREE.Mesh(g, worn ? wornMat(color || C_CREAM) : capMat(color || C_CREAM)); cap.castShadow = true; cap.receiveShadow = true; grp.add(cap);
      if (label && atlas.cells[code]) {
        const { a, b } = g.userData;
        const dw = a * 2 * 0.92, dd = b * 2 * 0.92;
        const dg = new THREE.PlaneGeometry(dw, dd, 8, 8); dg.rotateX(-Math.PI / 2);
        const dp = dg.attributes.position, duv = dg.attributes.uv;
        const [x0, y0, cw, ch] = atlas.cells[code];
        for (let i = 0; i < dp.count; i++) {
          const x = dp.getX(i), zz = dp.getZ(i);
          dp.setY(i, KH / 2 - DISH * (1 - Math.abs(x) / a) * (1 - Math.abs(zz) / b) + 0.002);   // follows the cap's coarse (linear) dish so no part of the legend sinks into it
          const u = duv.getX(i), v = duv.getY(i);
          duv.setXY(i, (x0 + u * cw) / atlas.AW, 1 - (y0 + (1 - v) * ch) / atlas.AH);
        }
        const dm = new THREE.Mesh(dg, decalMat); dm.renderOrder = 2; grp.add(dm); grp.userData.decal = dm;
      }
      if (code === 'Space') {   // a slight bow along the long spacebar
        const g2 = cap.geometry.clone(), p = g2.attributes.position, hw = (wu * U - GAP) / 2;
        for (let i = 0; i < p.count; i++) { const xx = p.getX(i) / hw; p.setY(i, p.getY(i) - 0.004 * (1 - xx * xx)); }
        cap.geometry = g2;   // keep the dished normals: recomputing them on the coarse cap faceted the bar
      }
      const k = { code, label, grp, cap, decal: grp.userData.decal, y0: grp.position.y, off: 0, v: 0, upAt: 0, hover: 0 };
      cap.userData.key = k; keys[code] = k; keyMeshes.push(cap);
      xu += wu;
    });
  });

  const ropeAnchors = { monitorKb: new V3(0.32, BY - 0.12, DEPTH_END - 0.12), monitorLamp: new V3(-0.32, BY - 0.12, DEPTH_END - 0.12), kbBack: new V3(0.95, 0.1, 0.8) };

  const TRAVEL = 0.0125;
  function pressKey(code, now) { const k = keys[code]; if (!k) return null; k.downAt = now; k.v = 0; return k; }
  function update(now, dt, reduced) {
    for (const code in keys) {
      const k = keys[code];
      const td = k.downAt !== undefined ? now - k.downAt : 9;
      if (td < 0.05) { k.off = -TRAVEL * (reduced ? 1 : td / 0.05); k.v = 0; }
      else if (reduced) k.off = td < 0.12 ? -TRAVEL : 0;
      else { const n = Math.ceil(dt * 480), h = dt / n; for (let i = 0; i < n; i++) { const acc = -2200 * k.off - 52 * k.v; k.v += acc * h; k.off += k.v * h; } }
      k.hover += ((k.hoverT ? 1 : 0) - k.hover) * Math.min(1, dt * 14);
      k.grp.position.y = k.y0 + k.off + 0.004 * k.hover;   // the key under the cursor lifts ~0.5 mm
    }
  }

  return { pc, glassGeo, keys, keyMeshes, pressKey, update, led, fled, kb, lipGlowMat, ropeAnchors, BY, FZ, capsLed, powerBtn: pcPower, decalMat, hoverDecalMat: new THREE.MeshBasicMaterial({ map: atlas.glow, color: '#ffc98e', transparent: true, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }) };
}

// ------------------------------------------------------------------ screen "OS": slideshow + status line + terminal
const PHOS = [['#FFC27A', '#FFE4BF'], ['#8CF5A0', '#C9FFD2'], ['#E8EEF6', '#FFFFFF']];
const CMDS = ['help', 'work', 'projects', 'about', 'contact', 'boot', 'play dormant', 'putt', 'ls', 'ls packs', 'open vikings', 'lumpy', 'date', 'color', 'clear'];
export class ScreenOS {
  constructor(images, projects, reduced) {
    this.W = 1024; this.H = 768;
    this.SS = 2; this.canvas = TX.makeCanvas(this.W * this.SS, this.H * this.SS); this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = SRGB; this.tex.minFilter = THREE.LinearMipmapLinearFilter; this.tex.anisotropy = 16;
    this.prevCanvas = TX.makeCanvas(256, 192);
    this.prevTex = new THREE.CanvasTexture(this.prevCanvas); this.prevTex.colorSpace = SRGB;
    this.reduced = reduced;
    this.items = projects.map((p, i) => ({ p, im: images[i], avg: avgColor(images[i]), lum: rawLum(images[i]), dark: p.name === 'Dormant Red' })).filter((it) => !it.p.private && it.im);   // private builds have no screenshot to show
    this.counts = { all: projects.length, games: 0, web: 0, systems: 0, clay: 0 }; projects.forEach((p) => { this.counts[p.cat] = (this.counts[p.cat] || 0) + 1; });
    this.packs = projects.filter((p) => p.cat === 'clay').map((p) => p.name);
    this.cur = 0; this.nextCut = 2.8; this.cutT = -10;
    this.buf = ''; this.lines = []; this.lastOut = []; this.lastType = -10; this.typing = false;
    this.hist = []; this.hi = -1; this.phos = 0; this.anim = null; this.hover = false;
    this.dirty = true; this.cursorOn = true; this.t = 0; this.test = null;
  }
  get avg() { return this.test ? this.test.col : this.items[this.cur].avg; }
  get base() {   // minimum phosphor glow so dark slides still light the room
    if (this.test) return this.test.col.clone().multiplyScalar(0.25);
    const it = this.items[this.cur]; return it.dark ? new THREE.Color(0.06, 0.1, 0.38) : new THREE.Color(0, 0, 0);   // bright slides need no floor (it flattened their shadows)
  }
  get rawLum() { if (this.test) { const c = this.test.col; return 0.3 * c.r + 0.55 * c.g + 0.15 * c.b; } const it = this.items[this.cur]; return it.dark ? 0.3 : it.lum; }
  get flicker() { const d = this.t - this.cutT; return this.reduced ? 0 : clamp(1 - d / 0.09); }
  get prevK() { const d = this.t - this.cutT; return this.reduced ? 0 : 0.15 * Math.exp(-Math.max(0, d) / 0.12); }
  setTest(css) { this.test = css ? { css, col: new THREE.Color(css) } : null; this.dirty = true; }
  hold(i) { this.cur = i; this.nextCut = 1e9; this.cutT = -10; this.dirty = true; }
  startTyping() { this.typing = true; this.lastType = this.t; this.dirty = true; }
  stopTyping() { this.typing = false; this.buf = ''; this.anim = null; this.lastType = this.t - 10; this.dirty = true; }
  update(t) {
    this.t = t;
    if (t >= this.nextCut && !this.typing && !this.test) {
      const pc = this.prevCanvas.getContext('2d'); pc.drawImage(this.canvas, 0, 0, 256, 192); this.prevTex.needsUpdate = true;
      this.cur = (this.cur + 1) % this.items.length; this.cutT = t;
      this.nextCut = t + (this.reduced ? 4 : 2.5 + Math.random() * 1.0); this.dirty = true;
    }
    const cOn = this.typing || this.anim ? Math.floor(t * 2.2) % 2 === 0 : true;   // blink only while typing: idle redraws (full 2x texture uploads) caused periodic hitches
    if (cOn !== this.cursorOn) { this.cursorOn = cOn; this.dirty = true; }
    if (this.anim) { this.dirty = true; if (t - this.anim.t0 > this.anim.dur) { this.lines.push(...(this.anim.after || [])); this.anim = null; } }
    if (this.dirty) { this.draw(); this.dirty = false; this.tex.needsUpdate = true; }
  }
  type(ch) { if (this.buf.length < 22) this.buf += ch; this.lastType = this.t; this.hi = -1; this.dirty = true; }
  back() { this.buf = this.buf.slice(0, -1); this.lastType = this.t; this.dirty = true; }
  complete() { const b = this.buf.toLowerCase(); if (!b) return; const m = CMDS.filter((c) => c.startsWith(b)); if (m.length === 1) this.buf = m[0]; else if (m.length > 1) { this.lines.push(m.join('  ').toUpperCase()); this.lines = this.lines.slice(-30); } this.dirty = true; }
  histStep(d) { if (!this.hist.length) return; this.hi = this.hi < 0 ? (d < 0 ? this.hist.length - 1 : -1) : this.hi + d; if (this.hi >= this.hist.length || this.hi < 0) { this.hi = -1; this.buf = ''; } else this.buf = this.hist[this.hi]; this.dirty = true; }
  setHover(h) { if (h !== this.hover) { this.hover = h; this.dirty = true; } }
  enter() {
    const cmd = this.buf.trim().toLowerCase().replace(/\s+/g, ' '); this.buf = ''; this.lastType = this.t; this.dirty = true; this.hi = -1;
    if (cmd) { this.hist.push(cmd); this.hist = this.hist.slice(-20); }
    this.lines.push('> ' + cmd);
    let action = null, out = [];
    if (!cmd) { /* blank line */ }
    else if (cmd === 'help') out = ['WORK  ABOUT  CONTACT  BOOT', 'PLAY DORMANT   PUTT', 'LS   LS PACKS   OPEN VIKINGS', 'LUMPY  DATE  COLOR  CLEAR', 'TAB completes, UP/DOWN history', 'ESC stops typing'];
    else if (cmd === 'work' || cmd === 'projects') { out = ['LOADING WORK...']; action = 'work'; }
    else if (cmd === 'about') { out = ['OPENING ABOUT...']; action = 'about'; }
    else if (cmd === 'contact') { out = ['NEW_PROJECT.TXT...']; action = 'contact'; }
    else if (cmd === 'boot') { out = ['REBOOTING...']; action = 'boot'; }
    else if (cmd === 'clear') { this.lines = []; }
    else if (cmd === 'date') out = [new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()];
    else if (cmd === 'color') { this.phos = (this.phos + 1) % PHOS.length; out = ['PHOSPHOR: ' + ['AMBER', 'GREEN', 'WHITE'][this.phos]]; }
    else if (cmd === 'lumpy') { out = ['hop! hop!']; action = 'lumpy'; }
    else if (cmd === 'ls') { const n = this.counts; out = [`${n.all} PROJECTS ON THE RING`, `${n.games} GAMES  ${n.web} WEB  ${n.systems} SYSTEMS`, `${n.clay} CLAY PACKS (+${48 - n.clay} IN LIB)`, 'TYPE WORK TO SPIN IT']; }
    else if (cmd === 'ls packs') out = [...this.packs.map((n) => n.toUpperCase().replace(/ AND /g, ' & ') + '.GLB'), `+${48 - this.packs.length} MORE IN THE LIBRARY`];
    else if (cmd === 'harrison') out = ['    /\\        /\\  /\\', '   /  \\  /\\  /  \\/  \\   _', '  /    \\/  \\/        \\_/ \\', ' ~~~~ HARRISON, AR ~~~~~~~~'];
    else if (cmd === 'play dormant' || cmd === 'play dormant red') { this.anim = { kind: 'dormant', t0: this.t, dur: 10, after: ['PLAY FREE: RDWLABZ.ITCH.IO'] }; }
    else if (cmd === 'putt') { this.anim = { kind: 'putt', t0: this.t, dur: 3.2, after: ['HOLE IN ONE!  (PUTT DROP, ON GOOGLE PLAY)'] }; }
    else if (cmd === 'open vikings') { this.anim = { kind: 'wire', t0: this.t, dur: 8, after: ['VIKINGS AND DARK AGES: 24 MODELS'] }; }
    else out = ['Bad command or file name'];
    this.lines.push(...out); this.lastOut = out.length ? out : (this.anim ? [cmd.toUpperCase()] : []);
    this.lines = this.lines.slice(-30);
    return action;
  }
  drawAnim(x, SX, top, SW, SB) {
    const a = this.anim, e = this.t - a.t0, ph = PHOS[this.phos];
    x.save(); x.fillStyle = ph[0]; x.font = '44px VT323'; x.textBaseline = 'alphabetic';
    const cxm = SX + SW / 2;
    if (a.kind === 'dormant') {
      const frames = [
        ['   .  *    DORMANT RED   .', '        .        *', '  O2 ............ 21%', '  [####################]'],
        ['  *   STATION OFFLINE  .', '     __/=====\\__', '    |  []   []  |  .', '  O2 ............ 14%'],
        ['  .  RESTORE POWER  *', '     __/=====\\__', '    |  [*]  [*] |', '  O2 ............ 09%'],
        ['    BEFORE THE AIR', '        RUNS OUT', '  O2 ............ 03%', '  [#.................]'],
      ];
      const f = frames[Math.min(frames.length - 1, Math.floor(e / 2.5))];
      x.fillStyle = '#FF7A6A'; f.forEach((l, i) => x.fillText(l, SX + 30, top + 70 + i * 52));
      x.fillStyle = ph[0]; x.fillText('PLAY DORMANT  ' + '#'.repeat(Math.floor(e)) + '.'.repeat(10 - Math.floor(e)), SX + 30, SB - 30);
    } else if (a.kind === 'putt') {
      const p = Math.min(1, e / 2.4), bx = SX + 60 + p * (SW - 200);
      x.fillText('PUTT DROP', SX + 30, top + 70);
      x.fillText('_'.repeat(30), SX + 30, top + 250);
      x.fillText('|>', SX + SW - 120, top + 190); x.fillText('|', SX + SW - 112, top + 220);
      x.fillText(p < 1 ? 'o' : ' ', bx, top + 240 - Math.sin(p * Math.PI) * 30);
      if (p >= 1) { x.fillStyle = PHOS[this.phos][1]; x.font = '60px VT323'; x.fillText('HOLE IN ONE!', SX + 160, top + 340); }
    } else if (a.kind === 'wire') {
      // simple longship wireframe, spinning
      const V = [[-1.4, 0, 0], [1.4, 0, 0], [-1, -0.35, 0.4], [1, -0.35, 0.4], [-1, -0.35, -0.4], [1, -0.35, -0.4], [-1.2, 0.35, 0], [1.2, 0.35, 0], [0, 0.0, 0], [0, 1.3, 0], [0.7, 0.9, 0], [0.7, 0.3, 0]];
      const E = [[0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [4, 5], [2, 4], [3, 5], [0, 6], [1, 7], [8, 9], [9, 10], [10, 11], [11, 8], [2, 6], [4, 6], [3, 7], [5, 7]];
      const ang = e * 1.2, ca = Math.cos(ang), sa = Math.sin(ang), sc = 150, cy = top + 230;
      const P = V.map(([vx, vy, vz]) => { const rx = vx * ca - vz * sa, rz = vx * sa + vz * ca; const k = 3 / (3 + rz); return [cxm + rx * sc * k, cy - vy * sc * k]; });
      x.strokeStyle = ph[0]; x.lineWidth = 3; x.shadowColor = ph[0]; x.shadowBlur = 8;
      E.forEach(([i, j]) => { x.beginPath(); x.moveTo(P[i][0], P[i][1]); x.lineTo(P[j][0], P[j][1]); x.stroke(); });
      x.shadowBlur = 0; x.fillText('VIKINGS.GLB', SX + 30, top + 70);
    }
    x.restore();
  }
  draw() {
    const { ctx: x, W, H } = this; x.setTransform(this.SS, 0, 0, this.SS, 0, 0); x.imageSmoothingQuality = 'high'; const it = this.items[this.cur]; const ph = PHOS[this.phos];
    if (this.test) { x.fillStyle = this.test.css; x.fillRect(0, 0, W, H); }
    else {
      x.save();
      if (it.dark) { x.fillStyle = '#0a1240'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'lighten'; }
      // graded slide is cached per item+typing state: the per-pixel canvas filter runs once per cut, not on every redraw
      const bk = this.cur + (this.typing ? 't' : '') + (it.im && it.im.width);
      if (this._bgKey !== bk) { this._bgKey = bk; if (!this._bg) this._bg = TX.makeCanvas(W * this.SS, H * this.SS); const bx = this._bg.getContext('2d'); bx.setTransform(this.SS, 0, 0, this.SS, 0, 0); bx.imageSmoothingQuality = 'high'; bx.clearRect(0, 0, W, H);
        bx.filter = `saturate(1.25) contrast(1.08) brightness(${it.p.bright ? 1.45 : 0.94})${this.typing ? ' blur(1px)' : ''}`; TX.drawCover(bx, it.im, 0, 0, W, H, it.p.focusY ?? 0.5); bx.filter = 'none'; }
      x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(this._bg, 0, 0); x.setTransform(this.SS, 0, 0, this.SS, 0, 0);
      x.restore();
    }
    const SX = 86, SY = 72, SW = W - SX * 2, SB = H - 68;
    x.fillStyle = 'rgba(4,4,16,.7)'; x.fillRect(SX, SY, SW, 52);
    x.font = '40px VT323'; x.textBaseline = 'middle';
    x.fillStyle = ph[0]; x.fillText('WORKBENCH OS 2.6', SX + 16, SY + 27);
    x.textAlign = 'right';
    if (this.typing) { x.fillStyle = '#BFF5C8'; x.fillText('TYPING — ESC TO EXIT', SX + SW - 16, SY + 27); }
    else if (this.hover) { x.fillStyle = '#FFFFFF'; x.fillText('CLICK TO ENTER ▸', SX + SW - 16, SY + 27); }
    else { x.fillStyle = '#FFF0D8'; x.fillText(this.test ? 'TEST' : it.p.file, SX + SW - 16, SY + 27); }
    x.textAlign = 'left';
    const cursor = (tx, ty, size) => { if (!this.cursorOn) return; const w = x.measureText(tx).width; x.fillRect(SX + 18 + w + 4, ty - size * 0.72, size * 0.46, size * 0.82); };
    if (this.typing) {
      const fs = 60, lh = 62, top = SY + 62;
      x.fillStyle = 'rgba(4,4,16,.88)'; x.fillRect(SX, top - 6, SW, SB - top + 6);
      if (this.anim) { this.drawAnim(x, SX, top, SW, SB); return; }
      x.font = `${fs}px VT323`; x.textBaseline = 'alphabetic';
      let y = top + 48;
      this.lines.slice(-8).forEach((l) => { x.fillStyle = l.startsWith('Bad') ? '#FF9A7A' : (l.startsWith('>') ? ph[1] : ph[0]); x.fillText(l, SX + 18, y); y += lh; });
      const prompt = 'BENCH> ' + this.buf;
      x.fillStyle = ph[1]; x.fillText(prompt, SX + 18, y); cursor(prompt, y, fs);
    } else {
      x.fillStyle = 'rgba(4,4,16,.7)'; x.fillRect(SX, SB - 70, SW, 70);
      x.font = '54px VT323'; x.textBaseline = 'alphabetic'; x.fillStyle = ph[1];
      const prompt = 'BENCH> '; x.fillText(prompt, SX + 18, SB - 18); if (this.cursorOn) { const w = x.measureText(prompt).width; x.fillRect(SX + 18 + w + 4, SB - 18 - 44, 12, 50); }
      x.textAlign = 'right'; x.fillStyle = 'rgba(255,228,191,.8)'; x.font = '42px VT323'; x.fillText('type HELP', SX + SW - 18, SB - 20); x.textAlign = 'left';
    }
  }
}

function rawLum(im) {
  if (!im) return 0.5;
  const c = TX.makeCanvas(16, 12), x = c.getContext('2d'); x.drawImage(im, 0, 0, 16, 12);
  let d; try { d = x.getImageData(0, 0, 16, 12).data; } catch (e) { return 0.5; }
  let s = 0; for (let i = 0; i < d.length; i += 4) s += (0.3 * d[i] + 0.55 * d[i + 1] + 0.15 * d[i + 2]) / 255; return Math.max(0.25, s / (d.length / 4));
}
function avgColor(im) {
  if (!im) return new THREE.Color(0.6, 0.5, 0.7);
  const c = TX.makeCanvas(16, 12), x = c.getContext('2d'); x.drawImage(im, 0, 0, 16, 12);
  let d; try { d = x.getImageData(0, 0, 16, 12).data; } catch (e) { return new THREE.Color(0.6, 0.5, 0.7); }
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) { const w = 0.3 + (d[i] + d[i + 1] + d[i + 2]) / 765; r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w; }
  const col = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
  const hsl = {}; col.getHSL(hsl); col.setHSL(hsl.h, Math.min(1, hsl.s * 1.35 + 0.08), 0.62);
  return col;
}
