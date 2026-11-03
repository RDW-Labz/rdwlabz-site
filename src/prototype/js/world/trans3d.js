// Screen world: transitions as physical 3D events, rendered in their own little stage around the two beat renders.
// channel  a clay CRT pulls back into view, its picture collapses to a glowing line and dot, the next channel blooms open
// floppy   the frame shrinks onto a clay floppy's label and flies out; the next floppy, carrying the next world, slides in
// squash   a fingerprinted clay slab presses down over the frame, squashes, and lifts away on the next world
import * as THREE from 'three';
import { clamp, lerp, range, easeIO, easeOut, canvas, tex, rng } from './util.js';
import { clay, rbox } from './mat.js';

const FOV = 40, D = 1 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));   // distance where a 2-unit-tall plane fills the view

function fingerprintNormal() {
  // three thumb-sized dents pressed into the clay, each with soft loop ridges inside (not ripple rings across the slab)
  const S = 512, c = canvas(S, S), x = c.getContext('2d');
  const hgt = new Float32Array(S * S);
  const prints = [[0.3, 0.62, 0.4], [0.64, 0.4, -0.5], [0.74, 0.74, 0.2]];
  for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
    const u = X / S, v = y / S; let h = 0;
    prints.forEach(([cx, cy, ang]) => {
      const ca = Math.cos(ang), sa = Math.sin(ang), dx = u - cx, dy = v - cy, lx = (dx * ca + dy * sa) / 0.075, ly = (-dx * sa + dy * ca) / 0.105;
      const d = Math.sqrt(lx * lx + ly * ly); if (d > 1.25) return;
      const bowl = Math.pow(Math.max(0, 1 - d * d), 1.5);   // the dent itself
      const loop = Math.sqrt(lx * lx + Math.pow(ly + 0.35 * (1 - lx * lx), 2));   // arched loop ridges, like a real print
      const rim = Math.exp(-Math.pow((d - 1.05) / 0.12, 2)) * 0.35;   // clay pushed up around the edge
      h += -bowl * 1.2 + bowl * 0.14 * Math.sin(loop * 34) + rim;
    });
    hgt[y * S + X] = h;
  }
  const d = x.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let X = 0; X < S; X++) {
    const h0 = hgt[y * S + X], hx = hgt[y * S + Math.min(S - 1, X + 1)], hy = hgt[Math.min(S - 1, y + 1) * S + X], i = (y * S + X) * 4;
    d.data[i] = ((h0 - hx) * 6 * 0.5 + 0.5) * 255; d.data[i + 1] = ((h0 - hy) * 6 * 0.5 + 0.5) * 255; d.data[i + 2] = 255; d.data[i + 3] = 255;
  }
  x.putImageData(d, 0, 0); return tex(c, { srgb: false });
}

// one rounded block that later splits three ways along jagged lines meeting off-centre
const SPLIT_C = [0.08, -0.04], SPLIT_E = [[-0.5, 0.22], [0.32, 0.5], [0.18, -0.5]];
function jag(a, b, seed) {
  const pts = [], n = 7, px = -(b[1] - a[1]), py = b[0] - a[0], L = Math.hypot(px, py) || 1;
  for (let k = 0; k <= n; k++) { const t = k / n, o = k === 0 || k === n ? 0 : (((k * 37 + seed * 11) % 7) - 3) / 3 * 0.04; pts.push([a[0] + (b[0] - a[0]) * t + px / L * o, a[1] + (b[1] - a[1]) * t + py / L * o]); }
  return pts;
}
function crackPaths() { return SPLIT_E.map((e, i) => jag(SPLIT_C, e, i + 1)); }
function slabGeo(pts, bevel) {
  const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.6 - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.7, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -0.3 + bevel);
  const P = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < P.count; i++) uv.setXY(i, P.getX(i) + 0.5, P.getY(i) + 0.5);
  g.computeVertexNormals(); return g;
}
function shardShapes() {
  const [P1, P2, P3] = crackPaths(), rev = (a) => a.slice().reverse();
  return [
    [...P1, [-0.5, 0.5], ...rev(P2).slice(0, -1)],
    [...P2, [0.5, 0.5], [0.5, -0.5], ...rev(P3).slice(0, -1)],
    [...P3, [-0.5, -0.5], ...rev(P1).slice(0, -1)],
  ];
}

const screenMat = () => new THREE.ShaderMaterial({
  toneMapped: false,
  uniforms: { map: { value: null }, uSx: { value: 1 }, uSy: { value: 1 }, uGlow: { value: 0 }, uAspect: { value: 1 }, uAfter: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D map; uniform float uSx, uSy, uGlow, uAspect, uAfter; varying vec2 vUv;
    void main(){ vec2 c = vUv - .5; vec2 q = c / vec2(max(uSx, .001), max(uSy, .001));
      float inside = step(abs(q.x), .5) * step(abs(q.y), .5);
      vec3 img = texture2D(map, q + .5).rgb * (1. + uGlow * 3.);
      float line = exp(-pow(c.y / max(uSy * .5, .002), 2.) ) * exp(-pow(c.x * uAspect / max(uSx * uAspect * .5, .004), 6.));
      float aft = uAfter * exp(-pow(c.y / .0035, 2.)) * smoothstep(.5, .3, abs(c.x));   // phosphor afterglow line
      vec3 col = img * inside + vec3(1., .93, .85) * line * uGlow * 4. + vec3(1., .8, .62) * aft * 2.2;
      gl_FragColor = vec4(col, 1.); }`,
});

export function makeStage() {
  const S = new THREE.Scene(); S.background = new THREE.Color('#06051a');
  const cam = new THREE.PerspectiveCamera(FOV, 1, 0.05, 50);
  S.add(new THREE.HemisphereLight('#9db3ff', '#3a2a40', 0.8));
  const key = new THREE.DirectionalLight('#ffd9b4', 2.4); key.position.set(-3, 4, 5); S.add(key);
  const rim = new THREE.DirectionalLight('#a9bcff', 1.4); rim.position.set(4, 2, -3); S.add(rim);
  const glowL = new THREE.PointLight('#ffe6d0', 0, 6, 1.5); glowL.position.set(0, 0, 1.2); S.add(glowL);
  // full-frame plane (shows A or B when no prop owns the frame)
  const bgMat = new THREE.MeshBasicMaterial({ toneMapped: false }); const bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat); S.add(bg);
  // studio floor + back glow for the moments the props are seen whole
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#15122e', roughness: 0.9 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; S.add(floor);

  // ---- CRT
  const tv = new THREE.Group(); S.add(tv);
  const cab = new THREE.Mesh(rbox(1, 1, 1, 0.12), clay('#D9A574', { roughness: 0.55, clearcoat: 0.3, unique: true })); tv.add(cab);
  const bezel = new THREE.Mesh(rbox(1, 1, 0.05, 0.06), clay('#2a2236', { unique: true })); tv.add(bezel);
  const scrM = screenMat(); const scr = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), scrM); tv.add(scr);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 20), clay('#3a2f2a')); knob.rotation.x = Math.PI / 2; tv.add(knob);
  // ---- floppies (two, so one leaves while the other arrives)
  const mkFloppy = (col) => { const g = new THREE.Group(); const body = new THREE.Mesh(rbox(1.5, 1.56, 0.07, 0.05), clay(col, { roughness: 0.5, clearcoat: 0.4, unique: true })); g.add(body);
    const sh = new THREE.Mesh(rbox(0.78, 0.5, 0.085, 0.03), new THREE.MeshStandardMaterial({ color: '#b8bcc6', metalness: 0.8, roughness: 0.35 })); sh.position.set(0.08, 0.53, 0); g.add(sh);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.36), new THREE.MeshBasicMaterial({ color: '#141018' })); slot.position.set(0.2, 0.55, 0.044); g.add(slot);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.8), new THREE.MeshBasicMaterial({ toneMapped: false })); lab.position.set(0, -0.22, 0.037); g.add(lab);
    const notch = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ color: '#141018' })); notch.position.set(-0.64, -0.68, 0.037); g.add(notch);
    S.add(g); return { g, lab }; };
  const fA = mkFloppy('#2B2560'), fB = mkFloppy('#C2412E');
  // ---- clay slab
  const fp = fingerprintNormal(); fp.wrapS = fp.wrapT = THREE.ClampToEdgeWrapping;
  const slabM = new THREE.MeshPhysicalMaterial({ color: '#E2A07A', roughness: 0.62, normalMap: fp, normalScale: new THREE.Vector2(0.9, 0.9), sheen: 0.5, sheenColor: new THREE.Color('#ffe2c8'), clearcoat: 0.1 });
  const slab = new THREE.Group(); S.add(slab);
  const blockShape = (() => { const r = 0.12, pts = []; [[0.5, 0.5, 0], [-0.5, 0.5, 1], [-0.5, -0.5, 2], [0.5, -0.5, 3]].forEach(([cx, cy, q]) => { for (let k = 0; k <= 4; k++) { const an = (q + k / 4) * Math.PI / 2; pts.push([cx - Math.sign(cx) * r + Math.cos(an) * r, cy - Math.sign(cy) * r + Math.sin(an) * r]); } }); return pts; })();
  const block = new THREE.Mesh(slabGeo(blockShape, 0.09), slabM); slab.add(block);
  const shards = shardShapes().map((pts) => { const m = new THREE.Mesh(slabGeo(pts, 0.03), slabM); const cx = pts.reduce((s2, q) => s2 + q[0], 0) / pts.length, cy = pts.reduce((s2, q) => s2 + q[1], 0) / pts.length; m.userData.dir = [cx - SPLIT_C[0], cy - SPLIT_C[1]]; slab.add(m); return m; });
  // the crack, drawn along the same three jagged lines the shards break on
  const crackC = canvas(1024, 1024), ccx = crackC.getContext('2d'); ccx.strokeStyle = '#4a2214'; ccx.lineWidth = 7; ccx.lineJoin = 'round';
  crackPaths().forEach((P) => { ccx.beginPath(); P.forEach(([x, y], i) => { const X = (x + 0.5) * 1024, Y = (0.5 - y) * 1024; i ? ccx.lineTo(X, Y) : ccx.moveTo(X, Y); }); ccx.stroke(); });
  const crackT = tex(crackC); const crack = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: crackT, transparent: true, depthWrite: false })); crack.position.z = 0.32; slab.add(crack);
  // soft contact shadow cast on the scene behind the slab
  const shC = canvas(256, 256), shx = shC.getContext('2d'); shx.filter = 'blur(18px)'; shx.fillStyle = '#000'; shx.fillRect(40, 40, 176, 176);
  const shT = tex(shC); const slabSh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shT, transparent: true, opacity: 0, depthWrite: false })); S.add(slabSh);

  let a = 1;
  const all = [tv, fA.g, fB.g, slab, slabSh, floor, crack];
  return {
    scene: S, cam,
    resize(aspect) { a = aspect; cam.aspect = a; cam.updateProjectionMatrix(); bg.scale.set(2 * a, 2, 1); scrM.uniforms.uAspect.value = a;
      fA.lab.scale.set(1, 1.26 / 0.8 / a, 1); fB.lab.scale.set(1, 1.26 / 0.8 / a, 1); },
    set(mode, p, tA, tB) {
      all.forEach((o) => { o.visible = false; }); bg.visible = true; glowL.intensity = 0;
      cam.position.set(0, 0, D); cam.lookAt(0, 0, 0); cam.rotation.z = 0;
      if (mode === 'channel') {
        tv.visible = true; floor.visible = true; bg.visible = false;
        // cabinet sized around a screen of 2a x 2; screen face at z=0
        cab.scale.set(2 * a + 0.5, 2.5, 1.6); cab.position.set(0, -0.05, -0.85); bezel.scale.set(2 * a + 0.16, 2.16, 1); bezel.position.z = -0.02;
        scr.scale.set(2 * a, 2, 1); scr.position.z = 0.012; knob.position.set(a + 0.08, -1.12, 0.0);
        const out = easeIO(range(p, 0, 0.2)), back = easeIO(range(p, 0.8, 1));
        const zoom = Math.max(0, out - back);
        cam.position.set(zoom * 1.1, zoom * 0.7, D + zoom * 5.6);   // the tube fills ~40% of the frame cam.lookAt(0, -0.1 * zoom, 0);
        let sx = 1, sy = 1, glow = 0;
        if (p < 0.5) { const k = range(p, 0.2, 0.42); sy = lerp(1, 0.006, easeOut(clamp(k * 1.6))); sx = lerp(1, 0.012, clamp((k - 0.55) / 0.45)); glow = clamp(k * 1.3) * (1 - range(p, 0.44, 0.5)); scrM.uniforms.map.value = tA; }
        else { const k = range(p, 0.58, 0.8); sx = lerp(0.012, 1, clamp(k / 0.45)); sy = lerp(0.006, 1, easeOut(clamp((k - 0.4) / 0.6))); glow = (1 - clamp(k * 1.2)) * range(p, 0.5, 0.58); scrM.uniforms.map.value = tB; }
        glow = Math.max(glow, 0.9 * clamp(1 - Math.abs(p - 0.5) / 0.09));   // the phosphor dot lingers through the cut
        scrM.uniforms.uAfter.value = range(p, 0.3, 0.36) * (1 - range(p, 0.44, 0.56));
        scrM.uniforms.uSx.value = sx; scrM.uniforms.uSy.value = sy; scrM.uniforms.uGlow.value = glow; glowL.intensity = glow * 4;
        if (p > 0.47 && p < 0.53) cam.position.x += Math.sin(p * 400) * 0.02;   // the knob's click
      } else if (mode === 'floppy') {
        floor.visible = true; bg.visible = false;
        const pull = Math.sin(clamp(p) * Math.PI); cam.position.set(0, pull * 0.6, D + pull * 2.9); cam.lookAt(0, -pull * 0.15, 0);
        // label (1.26 wide) fills the frame when scale = 2a/1.26; centre the label on the origin
        const full = (2 * a) / 1.26;
        const put = (f, s, x, y, z, rz, ry) => { f.g.visible = true; f.g.scale.setScalar(s); f.g.position.set(x - 0 * s, y + 0.22 * s, z); f.g.rotation.set(0, ry, rz); };
        fA.lab.material.map = tA; fB.lab.material.map = tB; fA.lab.material.needsUpdate = fB.lab.material.needsUpdate = true;
        if (p < 0.62) { const k = easeIO(range(p, 0, 0.32)), fly = easeIO(range(p, 0.32, 0.62)); put(fA, lerp(full, 0.9, k), lerp(0, 3.6, fly), lerp(0, -1.0, fly), lerp(0, 0.4, k) - fly * 0.5, -fly * 0.7, fly * 0.6); }
        if (p > 0.38) { const k = easeIO(range(p, 0.68, 1)), fly = easeIO(range(p, 0.38, 0.68)); put(fB, lerp(0.9, full, k), lerp(-3.6, 0, fly), lerp(1.0, 0, fly), lerp(-0.5, 0.4, fly) * (1 - k), (1 - fly) * 0.7, -(1 - fly) * 0.6); }
      } else if (mode === 'squash') {
        // drop (0-.3) -> squash on impact, thickness .3 / spread 1.4 (.3-.46) -> hold, thumbprint lit (.46-.56) -> cracks open (.56-1)
        bg.visible = true; bgMat.map = p < 0.5 ? tA : tB; bgMat.needsUpdate = true;
        slab.visible = true; slabSh.visible = true;
        const W = 2 * a + 0.3, Hh = 2.3;
        const drop = easeIO(range(p, 0, 0.3)), imp = range(p, 0.3, 0.46), open = easeIO(range(p, 0.56, 1));
        const sq = Math.sin(clamp(imp) * Math.PI * 0.5);   // into the squash, then holds
        const rebound = Math.sin(clamp((p - 0.46) / 0.1) * Math.PI) * 0.06;
        const spread = 1 + 0.4 * sq - rebound * 0.5, thick = 1 - 0.7 * sq + rebound;
        const bz = lerp(0.2, 0.12, drop), sw = W * spread / 2.05, shh = Hh * spread / 2.35;   // the squashed slab covers ~80%: its edge and shadow stay in view
        slab.position.set(0, lerp(3.6, 0, drop), bz);
        slab.scale.set(sw, shh, Math.max(0.05, thick));
        const split = p >= 0.56; block.visible = !split; shards.forEach((m) => { m.visible = split; const [dx, dy] = m.userData.dir; m.position.set(dx * open * 3.2, dy * open * 3.2 - open * open * 1.2, open * 0.4); m.rotation.set(-dy * open * 0.6, dx * open * 0.7, (dx - dy) * open * 0.35); });
        crack.visible = p > 0.46 && !split; crack.material.opacity = range(p, 0.46, 0.53);
        const shk = clamp(drop * 1.2) * (1 - open);
        slabSh.scale.set(sw * 1.25 * (1.2 - 0.2 * drop), shh * 1.25 * (1.2 - 0.2 * drop), 1); slabSh.position.set(0.05 + (1 - drop) * 0.2, slab.position.y * 0.6 - 0.12, 0.02); slabSh.material.opacity = 0.6 * shk;
      } else { bgMat.map = tA; bgMat.needsUpdate = true; }
    },
    dispose() { S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); fp.dispose(); crackT.dispose(); shT.dispose(); },
  };
}
