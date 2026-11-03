// Atmosphere and life around the clay computer: screen halo, lit fog cone + ground pool, glass
// reflection, radial dive blur, verlet cables, dust motes, mug steam, desk props, sound.
import * as THREE from 'three';
import * as TX from './tex.js';

const V3 = THREE.Vector3;
const SRGB = THREE.SRGBColorSpace;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const NOISE = `
  float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h1(i), h1(i+vec2(1.,0.)), f.x), mix(h1(i+vec2(0.,1.)), h1(i+vec2(1.,1.)), f.x), f.y); }
  float fbm(vec2 p){ return .5*vn(p) + .3*vn(p*2.03 + 3.1) + .2*vn(p*4.1 + 7.7); }`;

// ---- fake selective bloom: a soft additive halo hugging the glass, spilling onto the bezel
export function makeHalo(DIM) {
  const m = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color() }, uK: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uK; varying vec2 vP;
      float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.)) + min(max(q.x,q.y),0.) - r; }
      void main(){ float d = sdRR(vP, vec2(.625, .45), .11);
        float s = d > 0. ? .085 : .02;               // ~40px outward at hero scale, quick fade inward
        float g = .35 * exp(-(d * d) / (s * s));
        gl_FragColor = vec4(uCol * g * uK, 1.); }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(DIM.PLANE_W * 1.55, DIM.PLANE_H * 1.7), m);
  mesh.position.set(0, DIM.SCREEN_Y, 0.336); mesh.renderOrder = 6;
  return mesh;
}

// ---- volumetric screen-light cone + ground fog pool, coloured by the screen
export function makeLightFog(DIM) {
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.7, 2.4, 40, 1, true).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color() }, uT: { value: 0 }, uK: { value: 0.12 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
    vertexShader: `varying vec3 vL; varying vec3 vN; varying vec3 vV; void main(){ vL = position; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: NOISE + `uniform vec3 uCol; uniform float uT, uK; varying vec3 vL; varying vec3 vN; varying vec3 vV;
      void main(){ float along = (vL.z + 1.2) / 2.4;          // 0 at the glass, 1 at the far end
        float rim = pow(abs(dot(vN, vV)), 1.6);
        float n = fbm(vec2(vL.x * 1.6 + uT * .05, vL.z * 1.1 - uT * .03) + vL.y);
        float a = (1. - smoothstep(.0, 1., along)) * smoothstep(.0, .08, along) * rim * (.45 + .9 * n) * uK;
        gl_FragColor = vec4(uCol * a, 1.); }`,
  }));
  cone.position.set(0, DIM.SCREEN_Y - 0.12, 0.34 + 1.2); cone.rotation.x = 0.16; cone.renderOrder = 7;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color() }, uT: { value: 0 }, uK: { value: 0.6 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `varying vec2 vU; varying vec3 vP; void main(){ vU = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: NOISE + `uniform vec3 uCol; uniform float uT, uK; varying vec2 vU; varying vec3 vP;
      void main(){ vec2 c = (vU - .5) * vec2(1., 1.5); float r = length(c);
        float n = fbm(vP.xz * 1.4 + vec2(uT * .04, -uT * .02));
        float a = smoothstep(.62, .05, r) * (.35 + .9 * n) * .5 * uK;
        gl_FragColor = vec4(uCol * a, 1.); }`,
  }));
  pool.position.set(0.25, 0.015, 2.85); pool.renderOrder = 4;
  return { cone, pool, update(col, lum, t) { [cone, pool].forEach((m) => { m.material.uniforms.uCol.value.copy(col).multiplyScalar(lum); m.material.uniforms.uT.value = t; }); } };
}

// ---- low desk fog: a few drifting fbm sheets at desk height (computer-local). They wrap the plinth and cross the
// keyboard's back edge; staggered, low-alpha sheets so no single depth intersection reads as a hard line.
export function makeLowFog() {
  const g = new THREE.Group(), mats = [];
  const defs = [
    // [x, y, z, w, h, opacity, rotY, speed]
    [0.2, 0.0, 0.62, 4.6, 0.5, 0.55, 0, 0.045],      // between plinth front and keyboard: hugs the base
    [0.0, 0.0, 0.9, 2.7, 0.42, 0.45, 0, -0.035],   // just over the keyboard's back edge (no wider than the tray: no hard ends)
    [0.0, 0.0, 1.06, 2.6, 0.36, 0.28, 0, 0.03],
    [1.3, 0.0, -0.75, 3.0, 0.46, 0.24, Math.PI / 2, 0.04],    // along the plinth's right flank
    [-1.28, 0.0, -0.9, 3.0, 0.46, 0.2, -Math.PI / 2, -0.03],  // left flank
    [0.0, 0.0, -2.35, 5.4, 0.6, 0.26, 0, 0.03],     // behind the base
  ];
  defs.forEach(([x, y, z, w, h, op, ry, sp], i) => {
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uOp: { value: op }, uK: { value: 1 }, uSeed: { value: i * 4.3 + 1.1 }, uSp: { value: sp }, uSize: { value: new THREE.Vector2(w, h) }, uCol: { value: new THREE.Color('#a69cb8') }, uTint: { value: new THREE.Color() } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: NOISE + `uniform float uT, uOp, uK, uSeed, uSp; uniform vec2 uSize; uniform vec3 uCol, uTint; varying vec2 vUv;
        void main(){ vec2 p = vUv * uSize * vec2(.9, 2.4) + vec2(uSeed - uT * uSp * 6., uSeed * .7);
          vec2 q = vec2(fbm(p * .7 + vec2(uT * .02, 0.)), fbm(p * .7 + 4.1 - uT * .015));
          float f = fbm(p + 1.4 * q);
          float y = vUv.y * uSize.y;                                     // height above the desk
          float prof = smoothstep(0., .07, y) * (1. - smoothstep(.12, uSize.y, y));   // fades to nothing at the wood and toward the top
          float edge = smoothstep(0., .3, vUv.x) * smoothstep(1., .7, vUv.x);
          float a = smoothstep(.22, .72, f) * prof * edge * uOp * uK;
          gl_FragColor = vec4(uCol * (.75 + .35 * f) + uTint * .25, a); }`,
    });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), m);
    pl.position.set(x, y, z); pl.rotation.y = ry; pl.renderOrder = 5; pl.frustumCulled = true;
    g.add(pl); mats.push(m);
  });
  g.userData.update = (t, k, tint) => { g.visible = k > 0.01; mats.forEach((m) => { m.uniforms.uT.value = t; m.uniforms.uK.value = k; if (tint) m.uniforms.uTint.value.copy(tint); }); };
  return g;
}

// ---- glass reflection: additive black dielectric (F0 .04 -> ~.15 at grazing via Fresnel) with a smudge
export function makeGlass(glassGeo, DIM) {
  const c = TX.makeCanvas(256, 256), x = c.getContext('2d'), r = TX.rng(9);
  x.fillStyle = 'rgb(22,22,22)'; x.fillRect(0, 0, 256, 256);
  x.save(); x.translate(64, 196); x.rotate(-0.5); x.filter = 'blur(2px)';
  for (let i = 0; i < 9; i++) { x.strokeStyle = `rgba(150,150,150,${0.55 - i * 0.04})`; x.lineWidth = 3; x.beginPath(); x.ellipse(0, 0, 34 - i * 3.4, 25 - i * 2.5, 0, 0.3, Math.PI * 1.9); x.stroke(); }
  x.restore();
  x.filter = 'blur(10px)'; x.fillStyle = 'rgba(90,90,90,.5)'; x.beginPath(); x.ellipse(80, 200, 50, 30, -0.4, 0, Math.PI * 2); x.fill();
  const rough = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshStandardMaterial({ color: '#000000', roughness: 1, roughnessMap: rough, metalness: 0, envMapIntensity: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const m = new THREE.Mesh(glassGeo, mat); m.position.set(0, DIM.SCREEN_Y, DIM.SCREEN_Z + 0.004); m.renderOrder = 8;
  return m;
}

// ---- radial blur centred on the screen, for the dive
export function makeRadialBlur() {
  return {
    uniforms: { tDiffuse: { value: null }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uAmt: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uC; uniform float uAmt; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ float edge = smoothstep(0., .12, min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y)));
        vec2 d = (uC - vUv) * uAmt * edge; float j = hash(gl_FragCoord.xy); vec4 acc = vec4(0.); float w = 0.;
        for (int i = 0; i < 28; i++) { float t = (float(i) + j) / 28.; float k = 1. - t * .5; acc += texture2D(tDiffuse, vUv + d * t) * k; w += k; }
        gl_FragColor = acc / w; }`,
  };
}

// ---- verlet cable: 12 segments, pinned ends, floor + plinth collision, sway, blob contact shadows
export class Rope {
  constructor(parent, mat, n = 16, r = 0.02, shadowTex) {
    this.n = n; this.r = r; this.p = []; this.o = []; this.pins = {};
    for (let i = 0; i <= n; i++) { this.p.push(new V3()); this.o.push(new V3()); }
    this.seg = new THREE.InstancedMesh(new THREE.CylinderGeometry(r, r, 1, 8, 1, true), mat, n); this.seg.castShadow = true;
    this.joint = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 8, 6), mat, n + 1); this.joint.castShadow = true;
    this.sh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.45, depthWrite: false, color: '#000' }), n + 1);
    [this.seg, this.joint, this.sh].forEach((m) => { m.frustumCulled = false; parent.add(m); });
    this.dummy = new THREE.Object3D(); this.up = new V3(0, 1, 0); this.tmp = new V3();
    this.inited = false;
  }
  // route: [[nodeIndex, V3], ...] including 0 and n; rest lengths are set piecewise between waypoints
  setRoute(route, slack) {
    this.route = route; this.rests = this.rests || new Array(this.n).fill(0.1);
    for (let k = 0; k < route.length - 1; k++) {
      const [i0, a] = route[k], [i1, b] = route[k + 1], L = a.distanceTo(b) * slack / (i1 - i0);
      for (let i = i0; i < i1; i++) this.rests[i] = L;
      if (!this.inited) for (let i = i0; i <= i1; i++) { const t = (i - i0) / (i1 - i0); this.p[i].lerpVectors(a, b, t); this.o[i].copy(this.p[i]); }
    }
    // only the plug ends are pinned (node 1 sets the exit direction out of the strain relief); the rest hangs under gravity
    this.pins = {}; const last = route[route.length - 1];
    this.pins[0] = route[0][1]; this.pins[last[0]] = last[1];
    if (!this.exit) this.exit = route[0][1].clone().add(new V3(0, -0.005, -0.07));
    this.pins[1] = this.exit; this.rests[0] = 0.07;
    this.inited = true;
  }
  update(dt, push, collide, hideFn) {
    const steps = Math.min(3, Math.max(1, Math.round(dt * 60))), h = 1 / 60, fl = collide.floorAt;
    for (let s = 0; s < steps; s++) {
      for (let i = 1; i < this.n; i++) {
        if (this.pins[i]) continue;
        const p = this.p[i], o = this.o[i];
        const onDesk = p.y <= (fl ? fl(p) : 0) + this.r + 0.004, fr = onDesk ? 0.15 : 0.96;   // desk friction: lying cable stays put
        const vx = (p.x - o.x) * fr, vy = (p.y - o.y) * 0.96, vz = (p.z - o.z) * fr;
        o.copy(p); p.x += vx + push.x * h * h; p.y += vy - 22 * h * h; p.z += vz + push.z * h * h;
      }
      for (let it = 0; it < 12; it++) {
        for (const k in this.pins) this.p[k].copy(this.pins[k]);
        for (let i = 0; i < this.n; i++) {
          const p1 = this.p[i], p2 = this.p[i + 1]; this.tmp.subVectors(p2, p1); const d = this.tmp.length() || 1e-6, diff = (d - this.rests[i]) / d * 0.5;
          const f1 = this.pins[i] ? 0 : 1, f2 = this.pins[i + 1] ? 0 : 1, sum = f1 + f2 || 1;
          p1.addScaledVector(this.tmp, diff * 2 * f1 / sum); p2.addScaledVector(this.tmp, -diff * 2 * f2 / sum);
        }
        // bend stiffness: keep second neighbours apart so the cable curves instead of kinking
        for (let i = 0; i < this.n - 1; i++) {
          const p1 = this.p[i], p3 = this.p[i + 2]; this.tmp.subVectors(p3, p1); const d = this.tmp.length() || 1e-6, minD = (this.rests[i] + this.rests[i + 1]) * (i < 7 ? 0.975 : 0.92);
          if (d < minD) { const c = (d - minD) / d * 0.5, f1 = this.pins[i] ? 0 : 1, f3 = this.pins[i + 2] ? 0 : 1, sm = f1 + f3 || 1; p1.addScaledVector(this.tmp, c * 2 * f1 / sm); p3.addScaledVector(this.tmp, -c * 2 * f3 / sm); }
        }
        for (let i = 1; i < this.n; i++) collide(this.p[i], this.r);
      }
    }
    const D = this.dummy;
    for (let i = 0; i < this.n; i++) {
      const p1 = this.p[i], p2 = this.p[i + 1]; this.tmp.subVectors(p2, p1); const L = this.tmp.length();
      D.position.addVectors(p1, p2).multiplyScalar(0.5); D.quaternion.setFromUnitVectors(this.up, this.tmp.normalize()); const hid = hideFn && hideFn(D.position); D.scale.set(hid ? 0 : 1, hid ? 0 : L, hid ? 0 : 1); D.updateMatrix(); this.seg.setMatrixAt(i, D.matrix);
    }
    for (let i = 0; i <= this.n; i++) {
      const p = this.p[i];
      const hj = hideFn && hideFn(p); D.position.copy(p); D.quaternion.identity(); D.scale.setScalar(hj ? 0 : 1); D.updateMatrix(); this.joint.setMatrixAt(i, D.matrix);
      const fy = collide.floorAt ? collide.floorAt(p) : 0, hgt = Math.max(0, p.y - fy), s = (0.11 + hgt * 0.5) * (1 - clamp(hgt / 0.5) * 0.6);
      D.position.set(p.x, fy + 0.004, p.z); D.scale.set(s, 1, s); D.updateMatrix(); this.sh.setMatrixAt(i, D.matrix);
    }
    this.seg.instanceMatrix.needsUpdate = this.joint.instanceMatrix.needsUpdate = this.sh.instanceMatrix.needsUpdate = true;
  }
}

// ---- dust motes drifting in the screen-light cone (one draw call)
export function makeDust(DIM, n = 250) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4); const r = TX.rng(4);
  for (let i = 0; i < n; i++) {
    const z = 0.4 + r() * 2.2, rad = (0.6 + (z - 0.4) * 0.45) * Math.sqrt(r()), a = r() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * rad; pos[i * 3 + 1] = DIM.SCREEN_Y - 0.1 - (z - 0.4) * 0.3 + Math.sin(a) * rad * 0.75; pos[i * 3 + 2] = z;
    seed[i * 4] = r() * 6.28; seed[i * 4 + 1] = 0.3 + r() * 0.7; seed[i * 4 + 2] = r(); seed[i * 4 + 3] = r();
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color() }, uScale: { value: 300 }, uRes: { value: new THREE.Vector2(1280, 800) }, uMaxPx: { value: 18 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `attribute vec4 seed; uniform float uT, uScale, uMaxPx; varying float vA; varying float vSoft;
      void main(){ vec3 p = position; float t = uT * seed.y * .25 + seed.x;
        p += vec3(sin(t) * .08, sin(t * .7 + seed.z * 6.) * .06 + mod(uT * .02 * seed.y + seed.w, .3) - .15, cos(t * .8) * .06);
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        float dc = -mv.z; vSoft = smoothstep(1.8, .7, dc);
        gl_PointSize = min(uMaxPx, uScale * (.005 + .006 * seed.w) / dc * (1. + 2.5 * vSoft)); vA = (.5 + .5 * sin(uT * 2. * seed.y + seed.x * 3.)) * smoothstep(.4, .75, dc) / (1. + 5. * vSoft); }`,
    fragmentShader: `uniform vec3 uCol; uniform vec2 uRes; varying float vA; varying float vSoft; void main(){ vec2 p = gl_PointCoord - .5; float d = length(p); float a = smoothstep(.5, mix(.0, .38, vSoft), d) * vA;
      vec2 nd = gl_FragCoord.xy / uRes * 2. - 1.; vec2 off = vec2(nd.x, -nd.y) * .45 * vSoft;   // optical vignetting: near discs go cat's-eye toward the frame edges
      a *= smoothstep(.5, .42, length(p + off)); a = min(a, .5); gl_FragColor = vec4(uCol * a, 1.); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 9;
  return pts;
}

// ---- steam wisp from the mug
export function makeSteam(tex) {
  const g = new THREE.Group(); const sprites = [];
  for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#e8e2ee', transparent: true, opacity: 0, depthWrite: false })); g.add(s); sprites.push(s); }
  g.userData.update = (t) => sprites.forEach((s, i) => { const k = ((t * 0.32 + i / sprites.length) % 1); s.position.set(Math.sin(k * 5 + i) * 0.05, 0.3 + k * 0.55, 0); const sc = 0.1 + k * 0.28; s.scale.set(sc, sc * 1.4, 1); s.material.opacity = 0.16 * Math.sin(k * Math.PI); s.material.rotation = k * 1.5 + i; });
  return g;
}

// ---- desk storytelling props
export function makeProps({ clay, pc, C, maxAniso, disks }) {
  const out = {};
  // sticky note on the bezel corner
  {
    const c = TX.makeCanvas(256, 230), x = c.getContext('2d'), r = TX.rng(3);
    x.fillStyle = '#FFE97A'; x.fillRect(0, 0, 256, 230); TX.fbm(x, 256, 230, r, { start: 6, octaves: 3, alpha: 0.08, mode: 'multiply' });
    x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(0, 0, 256, 34);
    x.fillStyle = '#1E2C78'; x.font = '700 75px Caveat'; x.textAlign = 'center'; x.lineWidth = 1.5; x.strokeStyle = '#1E2C78'; x.fillText('putt drop', 128, 100, 236); x.strokeText('putt drop', 128, 100, 236); x.fillText('shipped!', 128, 168, 240); x.strokeText('shipped!', 128, 168, 240);
    x.strokeStyle = '#C2412E'; x.lineWidth = 4; x.beginPath(); x.moveTo(30, 190); x.quadraticCurveTo(128, 210, 226, 188); x.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = SRGB; t.anisotropy = maxAniso;
    const g = new THREE.PlaneGeometry(0.21, 0.19, 4, 4); { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const yy = p.getY(i); if (yy < 0) p.setZ(i, (-yy) * (-yy) * 0.6); } g.computeVertexNormals(); }
    const note = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide, transparent: true }));   // fades out early in the dive (home.js) so it never crosses the nav
    note.position.set(0.72, C.BY + 0.79, C.FZ + 0.016); note.rotation.z = -0.13; note.castShadow = true; pc.add(note); out.note = note;
  }
  // floppy label "DORMANT RED v0.3" on the top disk
  if (disks) {
    const c = TX.makeCanvas(256, 152), x = c.getContext('2d');
    x.fillStyle = '#F3E9D8'; x.fillRect(0, 0, 256, 152); x.strokeStyle = 'rgba(80,90,170,.4)'; x.lineWidth = 2; for (let y = 50; y < 152; y += 26) { x.beginPath(); x.moveTo(10, y); x.lineTo(246, y); x.stroke(); }
    x.fillStyle = '#C2412E'; x.font = '700 40px Caveat'; x.fillText('DORMANT RED', 16, 44); x.fillStyle = '#2B3A8A'; x.font = '700 36px Caveat'; x.fillText('v0.3  - do not erase', 16, 98);
    const t = new THREE.CanvasTexture(c); t.colorSpace = SRGB; t.anisotropy = maxAniso;
    const lab = disks.children[disks.children.length - 1]; lab.material = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  }
  // tiny clay Viking from the pack, beside the mug
  {
    const v = new THREE.Group(); const m = (c) => clay.make(c, { map: null });
    const bod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.15, 16), m('#5B7FD6')); bod.position.y = 0.075; v.add(bod);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.009, 6, 18), m('#6E4E3A')); belt.rotation.x = Math.PI / 2; belt.position.y = 0.08; v.add(belt);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), m('#E0B48A')); head.position.y = 0.19; v.add(head);
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 12), m('#C2412E')); beard.rotation.x = Math.PI; beard.position.set(0, 0.15, 0.03); v.add(beard);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m('#9A9690')); helm.position.y = 0.2; v.add(helm);
    [-1, 1].forEach((s) => { const h = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06, 8), m('#F3E9D8')); h.position.set(s * 0.05, 0.25, 0); h.rotation.z = -s * 0.7; v.add(h); });
    const eyeM = new THREE.MeshBasicMaterial({ color: '#241c18' }); [-0.017, 0.017].forEach((x0) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), eyeM); e.position.set(x0, 0.2, 0.044); v.add(e); });
    v.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    out.viking = v; pc.add(v);
  }
  // coffee-ring stain + a loose screw by the plinth
  {
    const c = TX.makeCanvas(128, 128), x = c.getContext('2d');
    x.strokeStyle = 'rgba(70,40,18,.5)'; x.lineWidth = 5; x.beginPath(); x.arc(64, 64, 44, 0.3, Math.PI * 1.85); x.stroke();
    x.lineWidth = 2; x.strokeStyle = 'rgba(70,40,18,.3)'; x.beginPath(); x.arc(66, 62, 40, 0, Math.PI * 2); x.stroke();
    out.ring = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: (() => { const t = new THREE.CanvasTexture(c); t.colorSpace = SRGB; return t; })(), transparent: true, depthWrite: false, roughness: 0.22, metalness: 0, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }));
    out.ring.position.set(1.32, 0.004, 0.05); pc.add(out.ring);
    const sc = new THREE.Group(); const sm = clay.make('#9E7C5E', { roughness: 0.45, clearcoat: 0.2, map: null });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 10), sm); shaft.rotation.z = Math.PI / 2; sc.add(shaft);
    const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), sm); hd.rotation.z = Math.PI / 2; hd.position.x = 0.04; sc.add(hd);
    sc.position.set(-1.2, 0.022, 0.62); sc.rotation.y = 0.6; sc.traverse((o) => { if (o.isMesh) o.castShadow = true; }); pc.add(sc);
  }
  return out;
}

// ---- sound: soft clicks with pitch variety, space thock, enter rattle, CRT thunk + hum
export function makeSound() {
  let ctx = null, on = false, hum = null;
  const ensure = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } } return ctx; };
  const noise = (len) => { const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3); return b; };
  const hit = (t, freq, q, gain, len) => { const s = ctx.createBufferSource(); s.buffer = noise(len); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + len * 1.6); s.connect(f).connect(g).connect(ctx.destination); s.start(t); };
  function setHum(v) {
    if (!ctx) return;
    if (v && !hum) { const g = ctx.createGain(); g.gain.value = 0.0316; const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.frequency.value = 60; o2.frequency.value = 15734 / 128; o1.type = 'sine'; o2.type = 'triangle'; const g2 = ctx.createGain(); g2.gain.value = 0.25; o1.connect(g); o2.connect(g2).connect(g); g.connect(ctx.destination); o1.start(); o2.start(); hum = { g, o1, o2 }; }
    if (!v && hum) { hum.o1.stop(); hum.o2.stop(); hum.g.disconnect(); hum = null; }
  }
  return {
    get on() { return on; },
    toggle() { on = !on; if (on) ensure(); setHum(on); return on; },
    key(code) {
      if (!on || !ensure()) return; const t = ctx.currentTime, pv = 1 + (Math.random() * 0.08 - 0.04);
      if (code === 'Space') { hit(t, 700 * pv, 0.9, 0.22, 0.05); hit(t, 220 * pv, 0.7, 0.18, 0.07); }
      else if (code === 'Enter') { hit(t, 1500 * pv, 1.1, 0.2, 0.035); hit(t + 0.024, 2900 * pv, 2.5, 0.06, 0.02); hit(t + 0.041, 2600 * pv, 2.5, 0.04, 0.015); }
      else hit(t, 2300 * pv, 1.2, 0.17, 0.03);
    },
    thunk() { if (!on || !ensure()) return; const t = ctx.currentTime; hit(t, 140, 0.8, 0.3, 0.12); hit(t + 0.03, 4200, 3, 0.04, 0.3); },
    stop() { setHum(false); },
  };
}
