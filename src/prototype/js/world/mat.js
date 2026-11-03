// Screen world: shared look — dusk sky, clay + paper materials, light rig, clouds, soft contact shadows.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clayNormal, cloudTex, radialTex, rng } from './util.js';
import { bakedImage, bakeMode, decodeEnv, exportEnv } from '../tex.js';

export const PAL = { night: '#03031A', deep: '#1C2E84', blue: '#4A6CC0', mauve: '#B9889A', peach: '#E2A07A', cream: '#F3E9D8', ink: '#1B1208' };

let envTex = null;
export function worldEnv(renderer) {
  if (envTex) return envTex;
  /* [startup] pre-baked (tex/wenv_*.png): no PMREM shader compile + GPU blur at runtime; PMREM is the fallback / bake path */
  const ba = bakedImage('wenv_rgb'), bb = bakedImage('wenv_m');
  if (ba && bb && !bakeMode) { envTex = decodeEnv(ba, bb, new THREE.DataTexture(new Uint16Array(4), 1, 1, THREE.RGBAFormat, THREE.HalfFloatType)); envTex.userData.shared = true; return envTex; }
  const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), skyMat({ k: 0.9 })));
  const p = (geo, col, k, pos) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); env.add(m); };
  p(new THREE.PlaneGeometry(8, 5), '#ffd9b0', 3.2, new THREE.Vector3(-8, 9, 8));   // warm key softbox
  p(new THREE.PlaneGeometry(12, 2), '#9fb4ff', 1.4, new THREE.Vector3(10, 3, -6)); // cool rim strip
  p(new THREE.CircleGeometry(5, 24), '#ffe6cc', 0.8, new THREE.Vector3(0, 16, 0));
  const rt = pm.fromScene(env, 0.03); exportEnv(renderer, rt, 'wenv'); envTex = rt.texture; envTex.userData.shared = true; pm.dispose();
  return envTex;
}

// dusk gradient dome; stops are y-thresholds of the view direction
export function skyMat({ c0 = PAL.night, c1 = PAL.deep, c2 = PAL.blue, c3 = PAL.mauve, c4 = PAL.peach, c5 = '#6a4652', k = 1, horizon = 0 } = {}) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { c0: { value: new THREE.Color(c0) }, c1: { value: new THREE.Color(c1) }, c2: { value: new THREE.Color(c2) }, c3: { value: new THREE.Color(c3) }, c4: { value: new THREE.Color(c4) }, c5: { value: new THREE.Color(c5) }, uK: { value: k }, uH: { value: horizon } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 c0,c1,c2,c3,c4,c5; uniform float uK, uH; varying vec3 vDir;
      void main(){ float y = vDir.y - uH;
        vec3 col = mix(c5, c4, smoothstep(-.32, -.12, y));
        col = mix(col, c3, smoothstep(-.12, -.02, y));
        col = mix(col, c2, smoothstep(-.03, .14, y));
        col = mix(col, c1, smoothstep(.1, .34, y));
        col = mix(col, c0, smoothstep(.32, .78, y));
        col *= uK;
        col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453) - .5) / 255.;
        gl_FragColor = vec4(col, 1.); }`,
  });
}

export function makeSky(opts) { const m = new THREE.Mesh(new THREE.SphereGeometry(150, 48, 24), skyMat(opts)); m.renderOrder = -10; m.frustumCulled = false; return m; }

export function stars(n = 320, seed = 77, minY = 0.15, size = 0.5) {
  const r = rng(seed), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const th = r() * Math.PI * 2, y = minY + r() * (1 - minY), rr = Math.sqrt(1 - y * y); pos[i * 3] = Math.cos(th) * rr * 120; pos[i * 3 + 1] = y * 120; pos[i * 3 + 2] = Math.sin(th) * rr * 120; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const t = radialTex(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)', 'rgba(255,255,255,.35)');
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: t, transparent: true, depthWrite: false, color: '#fff4e8', fog: false }));
  p.frustumCulled = false; return p;
}

const clayCache = new Map();
export function clay(color, o = {}) {
  const { unique, ...rest } = o;
  const key = color + JSON.stringify(rest);
  if (!unique && clayCache.has(key)) return clayCache.get(key);
  const n = clayNormal(); n.userData.shared = true;
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.72, metalness: 0, normalMap: n, normalScale: new THREE.Vector2(0.28, 0.28), sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffe2c8'), clearcoat: 0.06, clearcoatRoughness: 0.5, envMapIntensity: 0.7, ...rest });
  m.userData.shared = !unique;
  if (!unique) clayCache.set(key, m);
  return m;
}

export function rbox(w, h, d, r = 0.04, seg = 3) { return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)); }

// standard dusk light rig: warm key with soft shadows, sky/ground hemi, cool rim, peach kicker
export function rig(scene, { key = '#ffd9b4', keyI = 2.6, keyPos = [-5, 8, 6], target = [0, 0, 0], shadow = 1024, area = 8, hemiI = 0.9, rimI = 1.6 } = {}) {
  const hemi = new THREE.HemisphereLight('#9db3ff', '#b98a8f', hemiI); scene.add(hemi);
  const k = new THREE.DirectionalLight(key, keyI); k.position.set(...keyPos); k.target.position.set(...target); scene.add(k, k.target);
  if (shadow) { k.castShadow = true; k.shadow.mapSize.set(shadow, shadow); const c = k.shadow.camera; c.left = -area; c.right = area; c.top = area; c.bottom = -area; c.near = 0.5; c.far = 40; k.shadow.bias = -0.0006; k.shadow.normalBias = 0.03; k.shadow.radius = 5; k.shadow.blurSamples = 12; }
  const rim = new THREE.DirectionalLight('#a9bcff', rimI); rim.position.set(6, 4, -6); scene.add(rim);
  const kick = new THREE.DirectionalLight('#ffb48a', 0.7); kick.position.set(4, -2, 5); scene.add(kick);
  return { hemi, key: k, rim, kick };
}

export function cloudBank(scene, defs, tint = ['#F6C3A0', '#E7A9A2', '#F2B48E', '#C99AB6', '#FFDDBB'], seed = 31) {
  const r = rng(seed), list = [];
  defs.forEach(([x, y, z, w, op]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex(), color: tint[Math.floor(r() * tint.length)], transparent: true, opacity: (op ?? 0.5) * 0.62, depthWrite: false, fog: false }));
    sp.scale.set(w, w * 0.42, 1); sp.position.set(x, y, z); sp.userData = { v: (0.04 + r() * 0.1) * (r() < 0.5 ? -1 : 1), x0: x }; scene.add(sp); list.push(sp);
  });
  cloudTex().userData.shared = true;
  return { list, update(dt, reduced) { if (reduced) return; list.forEach((s) => { s.position.x += s.userData.v * dt; if (Math.abs(s.position.x - s.userData.x0) > 6) s.userData.v *= -1; }); } };
}

let blobT = null;
export function blob(w, d, op = 0.5) {
  if (!blobT) { blobT = radialTex(128, 'rgba(0,0,0,.85)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.4)'); blobT.userData.shared = true; }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, opacity: op, depthWrite: false, color: '#0c0820' }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1; return m;
}

// rounded-rect Shape (centered)
export function rrShape(w, h, r, hole = null) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  if (hole) { const [hw, hh, hr, ox = 0, oy = 0] = hole, p = new THREE.Path(), a = -hw / 2 + ox, b = -hh / 2 + oy;
    p.moveTo(a + hr, b); p.quadraticCurveTo(a, b, a, b + hr); p.lineTo(a, b + hh - hr); p.quadraticCurveTo(a, b + hh, a + hr, b + hh); p.lineTo(a + hw - hr, b + hh); p.quadraticCurveTo(a + hw, b + hh, a + hw, b + hh - hr); p.lineTo(a + hw, b + hr); p.quadraticCurveTo(a + hw, b, a + hw - hr, b); p.lineTo(a + hr, b);
    s.holes.push(p); }
  return s;
}

// thick frame with a window: extruded rounded rect with a rounded hole and bevelled edges
export function frameGeo(w, h, d, r, win, bevel = 0.018) {
  const g = new THREE.ExtrudeGeometry(rrShape(w, h, r, win), { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -d / 2); g.computeVertexNormals(); return g;
}

// image plane material with brightness + per-card parallax offset (UV zoom around a moving center)
export function imageMat(texture, { bright = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: texture }, uOff: { value: new THREE.Vector2() }, uZoom: { value: 0.9 }, uBright: { value: bright }, uSheen: { value: 0 }, uFade: { value: 1 }, uDecode: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D map; uniform vec2 uOff; uniform float uZoom, uBright, uSheen, uFade, uDecode; varying vec2 vUv;
      void main(){ vec2 uv = .5 + (vUv - .5) * uZoom + uOff; vec3 c = texture2D(map, uv).rgb;
        if (uDecode > .5) c = pow(c, vec3(2.2));   // video textures arrive sRGB-encoded (three skips the hardware decode for video)
        float sh = smoothstep(.35, 0., abs(vUv.x * .7 + vUv.y * .5 - .55 - uSheen)) * .035;
        float vig = smoothstep(.9, .35, length((vUv - .5) * vec2(1.1, 1.3)));
        c = c * uBright * (.86 + .14 * vig) + sh;
        gl_FragColor = vec4(mix(vec3(.11, .1, .2), c, uFade), 1.);
        #include <colorspace_fragment>
      }`,
  });
}

// ---------------- interiors: each beat gets its own place, not the same sky ----------------
import { canvas as _cv, tex as _tx, rng as _rng } from './util.js';
const _texCache = new Map();
// wooden planks (colour map), tiled
export function planksTex(base = '#6b4a35', seed = 3, n = 8) {
  const key = 'pl' + base + seed; if (_texCache.has(key)) return _texCache.get(key);
  const c = _cv(512, 512), x = c.getContext('2d'), r = _rng(seed), col = new THREE.Color(base);
  for (let i = 0; i < n; i++) { const k = 0.82 + r() * 0.3; x.fillStyle = `rgb(${col.r * 255 * k | 0},${col.g * 255 * k | 0},${col.b * 255 * k | 0})`; x.fillRect(0, (i * 512) / n, 512, 512 / n);
    x.fillStyle = 'rgba(20,10,5,.35)'; x.fillRect(0, (i * 512) / n, 512, 2); x.fillRect(((i * 211) % 512), (i * 512) / n, 2, 512 / n);
    for (let g = 0; g < 14; g++) { x.fillStyle = `rgba(30,15,5,${0.04 + r() * 0.05})`; x.fillRect(0, (i * 512) / n + r() * 512 / n, 512, 1); } }
  const t = _tx(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.userData.shared = true; _texCache.set(key, t); return t;
}
// soft plaster / painted wall
export function plasterTex(base = '#2a2c55', seed = 5) {
  const key = 'ps' + base + seed; if (_texCache.has(key)) return _texCache.get(key);
  // seamless, fine, low-contrast plaster (dabs wrap across edges so tiles never show a seam)
  const N = 512, c = _cv(N, N), x = c.getContext('2d'), r = _rng(seed); x.fillStyle = base; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 2600; i++) { const lt = r() < 0.5; x.fillStyle = `rgba(${lt ? '255,240,230' : '10,8,20'},${0.008 + r() * 0.014})`; const s = 3 + r() * 14, px = r() * N, py = r() * N;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { if (px + ox + s < 0 || px + ox - s > N || py + oy + s < 0 || py + oy - s > N) continue; x.beginPath(); x.arc(px + ox, py + oy, s, 0, Math.PI * 2); x.fill(); } }
  const t = _tx(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.userData.shared = true; _texCache.set(key, t); return t;
}
export function room(S, { w = 30, d = 16, h = 9, cx = 0, cz = -4, floorY = -2.6, floor = '#6b4a35', wall = '#2a2c55', sideWalls = true, ceiling = false } = {}) {
  const g = new THREE.Group(); S.add(g);
  const ft = planksTex(floor).clone(); ft.repeat.set(w / 4, d / 4); ft.needsUpdate = true;
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.75, metalness: 0, envMapIntensity: 0.5 })); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, floorY, cz + d / 2 - 2); fl.receiveShadow = true; g.add(fl);
  const wt = plasterTex(wall).clone(); wt.repeat.set(w / 6, h / 6); wt.needsUpdate = true;
  const wm = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95, envMapIntensity: 0.4 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wm); back.position.set(cx, floorY + h / 2, cz - 2); back.receiveShadow = true; g.add(back);
  const skirting = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.08), clay('#3a2a24')); skirting.position.set(cx, floorY + 0.15, cz - 1.96); g.add(skirting);
  if (sideWalls) [-1, 1].forEach((sd) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(d, h), wm); m.position.set(cx + sd * w / 2, floorY + h / 2, cz + d / 2 - 2); m.rotation.y = -sd * Math.PI / 2; m.receiveShadow = true; g.add(m); });
  if (ceiling) { const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: '#1a1530', roughness: 1 })); c.rotation.x = Math.PI / 2; c.position.set(cx, floorY + h, cz + d / 2 - 2); g.add(c); }
  g.userData = { floor: fl, back, own: [ft, wt] };
  return g;
}
// hanging pendant lamp with a warm pool of light
export function pendant(S, x, y, z, { color = '#ffc890', intensity = 26, shade = '#2B2560', drop = 2.2, angle = 0.75, shadow = false, target = null } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); S.add(g);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, drop, 6), new THREE.MeshStandardMaterial({ color: '#1a1414' })); cord.position.y = drop / 2; g.add(cord);
  const sh = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.42, 28, 1, true), clay(shade, { side: THREE.DoubleSide })); sh.position.y = -0.05; g.add(sh);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(5), toneMapped: false })); bulb.position.y = -0.18; g.add(bulb);
  const L = new THREE.SpotLight(color, intensity, 14, angle, 0.7, 1.6); L.position.set(0, -0.2, 0); g.add(L); g.add(L.target);
  L.target.position.set(0, -6, 0); if (target) { L.target.position.copy(target).sub(g.position); }
  if (shadow) { L.castShadow = true; L.shadow.mapSize.set(1024, 1024); L.shadow.bias = -0.0008; L.shadow.radius = 4; L.shadow.camera.near = 0.3; L.shadow.camera.far = 14; }
  return { g, L, bulb };
}
// a window with a night (or dusk) sky + moon painted behind the frame
export function nightWindow(S, x, y, z, w = 3, h = 2.4, { dusk = false, seed = 7 } = {}) {
  const g = new THREE.Group(); g.position.set(x, y, z); S.add(g);
  const c = _cv(512, 410), cx = c.getContext('2d'), r = _rng(seed), gr = cx.createLinearGradient(0, 0, 0, 410);
  if (dusk) { gr.addColorStop(0, '#1C2E84'); gr.addColorStop(0.6, '#B9889A'); gr.addColorStop(1, '#E2A07A'); } else { gr.addColorStop(0, '#05041f'); gr.addColorStop(1, '#1C2E84'); }
  cx.fillStyle = gr; cx.fillRect(0, 0, 512, 410);
  for (let i = 0; i < 90; i++) { cx.fillStyle = `rgba(255,244,230,${0.3 + r() * 0.6})`; cx.fillRect(r() * 512, r() * 300, 2, 2); }
  if (!dusk) { cx.fillStyle = '#FFF0DC'; cx.shadowColor = '#FFE6C0'; cx.shadowBlur = 30; cx.beginPath(); cx.arc(380, 110, 34, 0, Math.PI * 2); cx.fill(); cx.shadowBlur = 0; }
  cx.fillStyle = dusk ? '#4a3a6a' : '#0d0d2a'; cx.beginPath(); cx.moveTo(0, 410); for (let X = 0; X <= 512; X += 16) cx.lineTo(X, 330 + Math.sin(X * 0.02 + seed) * 22 + r() * 8); cx.lineTo(512, 410); cx.fill();
  const t = _tx(c);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.15, 1.15, 1.2), toneMapped: true })); g.add(pane);
  const fm = clay('#3a2a24');
  [[0, h / 2 + 0.08, w + 0.3, 0.16], [0, -h / 2 - 0.08, w + 0.3, 0.16], [-w / 2 - 0.08, 0, 0.16, h + 0.3], [w / 2 + 0.08, 0, 0.16, h + 0.3], [0, 0, 0.08, h], [0, 0, w, 0.08]].forEach(([px, py, bw, bh]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.14), fm); b.position.set(px, py, 0.05); g.add(b); });
  const sill = new THREE.Mesh(rbox(w + 0.5, 0.12, 0.4, 0.04), fm); sill.position.set(0, -h / 2 - 0.2, 0.18); g.add(sill);
  g.userData.own = [t];
  return g;
}
