// Beat 3: the clay studio — a photo cyclorama with softboxes; Lumpy (our studio mascot) turns on a turntable while three
// render passes (wireframe, plain clay, painted) slide up the figure with the scroll, split by glowing cut rings.
import * as THREE from 'three';
import { clamp, lerp, range, easeOut, canvas, tex, TAU } from './util.js';
import { clay, rbox, blob } from './mat.js';
import { ed, edK } from './ui.js';

const FH = 2.6;   // figure height
function figure(mats) {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.62, 0], [0.7, 0.1], [0.74, 0.35], [0.72, 0.65], [0.64, 0.95], [0.52, 1.3], [0.38, 1.65], [0.24, 1.95], [0.11, 2.2], [0, 2.32]].map(([x, y]) => new THREE.Vector2(x, y));
  const bodyG = new THREE.LatheGeometry(prof, 48, 0, TAU);
  { const p = bodyG.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) - 0.22 * Math.pow(y / 2.32, 3)); } bodyG.computeVertexNormals(); }
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); m.castShadow = true; g.add(m); return m; };
  add(bodyG, mats.body, 0, 0, 0);
  const eye = new THREE.SphereGeometry(0.09, 16, 12);
  add(eye, mats.ink, -0.2, 1.18, 0.6, 1, 1.2, 0.6); add(eye, mats.ink, 0.2, 1.18, 0.6, 1, 1.2, 0.6);
  add(new THREE.TorusGeometry(0.15, 0.03, 8, 20, Math.PI), mats.ink, 0, 1.0, 0.64, 1, 1, 1, 0.2, 0, Math.PI);
  const ch = new THREE.SphereGeometry(0.11, 14, 10);
  add(ch, mats.blush, -0.38, 1.02, 0.52, 1, 0.7, 0.4); add(ch, mats.blush, 0.38, 1.02, 0.52, 1, 0.7, 0.4);
  const arm = new THREE.CapsuleGeometry(0.1, 0.45, 6, 12);
  add(arm, mats.body, -0.72, 0.62, 0.1, 1, 1, 1, 0, 0, -0.9); add(arm, mats.body, 0.72, 0.62, 0.1, 1, 1, 1, 0, 0, 0.9);
  const foot = new THREE.SphereGeometry(0.2, 16, 12);
  add(foot, mats.body, -0.3, 0.06, 0.25, 1.2, 0.5, 1.4); add(foot, mats.body, 0.3, 0.06, 0.25, 1.2, 0.5, 1.4);
  // a tiny sculpting tool in its hand
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), mats.tool, 0.98, 0.95, 0.1, 1, 1, 1, 0, 0, -0.5);
  add(new THREE.TorusGeometry(0.08, 0.015, 6, 16), mats.tool, 1.14, 1.22, 0.1, 1, 1, 1, 0, 0, -0.5);
  return g;
}

export default {
  id: 'studio', name: 'Clay studio',
  dom(el) {
    el.innerHTML = ed({ cls: 'hint', eyebrow: 'C:\\STUDIO&gt; render lumpy', title: ['The clay', '<em>studio</em>'],
      lead: 'Every model comes together in passes: wire for shape, clay for light, paint until it reads across a room. Meet Lumpy, our mascot.',
      second: 'Scroll to slide the passes up and down the figure.',
      stat: ['730', 'models in the clay library'], fig: 'Fig. 3 — wire, clay, paint' }) +
      ['WIRE', 'CLAY', 'PAINT'].map((s) => `<span class="st-tag" aria-hidden="true">${s}</span>`).join('');
    const st = document.createElement('style'); st.textContent = `.st-tag{position:absolute;left:0;top:0;transform:translate(14px,-50%);font:20px/1 VT323,monospace;letter-spacing:.1em;color:#0b0a1c;background:#FFE0B0;padding:4px 9px;border-radius:999px;box-shadow:0 6px 18px rgba(0,0,0,.35);opacity:0;transition:opacity .3s}.st-tag.on{opacity:1}@media (max-width:820px){.st-tag{font-size:16px}}`;
    document.head.appendChild(st);
    return { el, ed: el.querySelector('.wr-ed'), tags: [...el.querySelectorAll('.st-tag')] };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), own = [], R = ctx.reduced;
    ctx.renderer.localClippingEnabled = true;
    S.background = new THREE.Color('#0d1430');
    const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    // cyclorama: floor curving up into the back wall, teal-to-navy gradient
    const cyc = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 0); const pts = []; for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI / 2; pts.push(new THREE.Vector2(-8 + 4 * (1 - Math.cos(a)) * 0 + Math.sin(a) * 4, 4 - Math.cos(a) * 4)); }
      const g = new THREE.PlaneGeometry(30, 1, 1, 40); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = (p.getY(i) + 0.5); const a = clamp((v - 0.35) / 0.4) * Math.PI / 2; const z = v < 0.35 ? 8 - v / 0.35 * 8 : -Math.sin(a) * 4; const y = v < 0.35 ? 0 : (1 - Math.cos(a)) * 4 + (v > 0.75 ? (v - 0.75) * 30 : 0); p.setXYZ(i, p.getX(i), y, z - (v > 0.75 ? 0 : 0)); } g.computeVertexNormals(); return g; })();
    const cycM = new THREE.MeshStandardMaterial({ color: '#27406e', roughness: 0.95 }); const cy = new THREE.Mesh(cyc, cycM); cy.position.set(0, -1.6, -2); cy.receiveShadow = true; S.add(cy);
    S.add(new THREE.HemisphereLight('#a8c0ff', '#1a1430', 0.55));
    const key = new THREE.SpotLight('#ffe2c4', 70, 18, 0.5, 0.7, 1.3); key.position.set(-4, 5, 4); key.target.position.set(0, -0.2, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 5; key.shadow.bias = -0.0006; S.add(key, key.target);
    const fill = new THREE.SpotLight('#9fd0ff', 30, 18, 0.6, 0.8, 1.4); fill.position.set(5, 3, 3); fill.target.position.set(0, 0, 0); S.add(fill, fill.target);
    const rim = new THREE.DirectionalLight('#ffb48a', 1.6); rim.position.set(2, 4, -5); S.add(rim);
    // softboxes (visible emissive panels on stands)
    const mkSoft = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.add(g);
      const box = new THREE.Mesh(rbox(1.6, 2.0, 0.3, 0.08), clay('#1a1a22')); box.position.y = 2.2; g.add(box);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.85), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2e0').multiplyScalar(1.15), toneMapped: false })); face.position.set(0, 2.2, 0.16); g.add(face);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.8, 8), clay('#1a1a22')); pole.position.y = -0.2; g.add(pole);
      [0, 2.1, 4.2].forEach((a) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), clay('#1a1a22')); l.position.set(Math.sin(a) * 0.35, -1.45, Math.cos(a) * 0.35); l.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); g.add(l); }); };
    mkSoft(-6.4, 0.2, 0.8); mkSoft(4.8, 0.6, -0.8);
    // turntable
    const tt = new THREE.Group(); tt.position.y = -1.6; S.add(tt);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.3, 64), clay('#2B2560', { clearcoat: 0.4 })); base.position.y = 0.15; base.castShadow = true; base.receiveShadow = true; tt.add(base);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.08, 64), clay('#E9D6B8')); plate.position.y = 0.34; plate.receiveShadow = true; tt.add(plate);
    for (let i = 0; i < 36; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.12), clay('#C2412E')); const a = (i / 36) * TAU; d.position.set(Math.sin(a) * 1.5, 0.31, Math.cos(a) * 1.5); d.rotation.y = a; tt.add(d); }
    const spin = new THREE.Group(); spin.position.y = 0.38; tt.add(spin);
    // three passes of the figure, clipped into bands
    const cA = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), cB1 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), cB2 = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), cC = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const paint = { body: clay('#EF8A5C', { unique: true, clippingPlanes: [cA], clipShadows: true }), ink: new THREE.MeshStandardMaterial({ color: '#241c18', roughness: 0.35, clippingPlanes: [cA] }), blush: new THREE.MeshStandardMaterial({ color: '#E2533B', roughness: 0.6, clippingPlanes: [cA] }), tool: new THREE.MeshStandardMaterial({ color: '#B97E58', roughness: 0.5, clippingPlanes: [cA] }) };
    const grey = new THREE.MeshStandardMaterial({ color: '#b9b2aa', roughness: 0.62, clippingPlanes: [cB1, cB2], clipShadows: true });
    const wire = new THREE.MeshBasicMaterial({ color: new THREE.Color('#8fb4ff').multiplyScalar(1.6), wireframe: true, toneMapped: false, clippingPlanes: [cC] });
    const F1 = figure(paint), F2 = figure({ body: grey, ink: grey, blush: grey, tool: grey }), F3 = figure({ body: wire, ink: wire, blush: wire, tool: wire });
    F3.traverse((m) => { if (m.isMesh) m.castShadow = false; });
    spin.add(F1, F2, F3);
    const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE0B0').multiplyScalar(2.2), toneMapped: false });
    const cutA = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.012, 6, 64), ringM), cutB = cutA.clone(); cutA.rotation.x = cutB.rotation.x = Math.PI / 2; spin.add(cutA, cutB);
    const sh = blob(3.6, 3.6, 0.55); sh.position.y = 0.01; tt.add(sh);
    // side table with tools + a reference sketch on an easel
    const tbl = new THREE.Group(); tbl.position.set(3.0, -1.6, -1.2); tbl.rotation.y = -0.5; S.add(tbl);
    const top = new THREE.Mesh(rbox(1.6, 0.1, 0.9, 0.04), clay('#B97E58')); top.position.y = 1.0; top.castShadow = true; top.receiveShadow = true; tbl.add(top);
    [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), clay('#3a2a24')); l.position.set(x, 0.5, z); tbl.add(l); });
    [['#EF8A5C', -0.45], ['#8E9BE0', -0.1], ['#7FB069', 0.25]].forEach(([c, x]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), clay(c)); b.position.set(x, 1.15, 0.05); b.scale.y = 0.75; b.castShadow = true; tbl.add(b); });
    const tool = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), clay('#E9D6B8')); tool.rotation.z = Math.PI / 2; tool.position.set(0.3, 1.08, 0.3); tbl.add(tool);
    const sk = canvas(512, 640), sx = sk.getContext('2d'); sx.fillStyle = '#F6EEDD'; sx.fillRect(0, 0, 512, 640); sx.strokeStyle = 'rgba(60,50,70,.75)'; sx.lineWidth = 3;
    sx.beginPath(); sx.moveTo(256, 120); sx.bezierCurveTo(160, 260, 140, 420, 170, 520); sx.lineTo(340, 520); sx.bezierCurveTo(372, 420, 352, 260, 256, 120); sx.stroke();
    sx.beginPath(); sx.arc(222, 330, 10, 0, TAU); sx.arc(290, 330, 10, 0, TAU); sx.stroke(); sx.beginPath(); sx.arc(256, 370, 26, 0.2, Math.PI - 0.2); sx.stroke();
    sx.strokeStyle = 'rgba(60,50,70,.25)'; for (let i = 0; i < 9; i++) { sx.beginPath(); sx.moveTo(120, 140 + i * 45); sx.lineTo(390, 140 + i * 45); sx.stroke(); }
    sx.fillStyle = '#6a5a7a'; sx.font = '34px VT323'; sx.fillText('LUMPY · REF 01', 150, 590); const skt = tex(sk); own.push(skt);
    const easel = new THREE.Group(); easel.position.set(-3.1, -1.6, -1.4); easel.rotation.y = 0.55; S.add(easel);
    [-0.45, 0.45].forEach((x) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 8), clay('#B97E58')); l.position.set(x, 1.25, 0); l.rotation.z = -x * 0.12; easel.add(l); });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.38), new THREE.MeshStandardMaterial({ map: skt, roughness: 0.9 })); card.position.set(0, 1.75, 0.06); card.rotation.x = -0.1; card.castShadow = true; easel.add(card);

    const tagP = new THREE.Vector3();
    let mob = false;
    const inst = {
      scene: S, cam, post: { lens: 0.7, border: 1, vig: 0.38, bloom: 0.45, con: 1.12, s: 0.38 }, phoneLift: 0.24,
      layout(a, m) { cam.aspect = a; mob = m; cam.fov = m ? 52 : 36; cam.updateProjectionMatrix(); },
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0, now = performance.now() / 1000;
        const k = easeOut(range(t, 0, 0.4)), out = range(t, 0.85, 1.05);
        const ox = mob ? 0 : 1.7;   // figure sits right of the copy on desktop
        cam.position.set(ox * 0 - 1.6 * (1 - k) + mx * 0.5 - ox, lerp(2.6, 0.9, k) + my * 0.3 + out, lerp(13, mob ? 10.5 : 8.6, k) + out * 2);
        cam.lookAt(-ox, -0.1, 0);
        spin.rotation.y = (R ? 0.4 : now * 0.35) + t * 3;
        // bands: wire on top, clay in the middle, paint at the bottom; the cuts rise with the scroll
        const a = lerp(-0.1, FH + 0.1, clamp((t - 0.12) / 0.7)), b = lerp(0.6, FH + 0.4, clamp((t - 0.05) / 0.7));
        cA.constant = a; cB1.constant = -a; cB2.constant = b; cC.constant = -b;
        // planes live in world space: offset by the spin group's world y
        const wy = tt.position.y + spin.position.y; cA.constant += wy; cB1.constant -= wy; cB2.constant += wy; cC.constant -= wy;
        cutA.position.y = a; cutB.position.y = b; cutA.visible = a > 0 && a < FH; cutB.visible = b > 0 && b < FH;
        const sc = (h) => 0.75 * Math.sin(clamp(h / FH) * Math.PI * 0.95 + 0.15) + 0.15; cutA.scale.setScalar(sc(a)); cutB.scale.setScalar(sc(b));
        inst._bands = [[b, FH], [a, b], [0, a]];
      },
      ui(k, t) {
        edK(D.ed, k * range(t, -0.05, 0.1) * (1 - range(t, 0.9, 1.0)));
        const vis = k > 0.98 && inst._bands; const W = ctx.W, H = ctx.H;
        D.tags.forEach((el, i) => {
          if (!vis) { el.classList.remove('on'); return; }
          const [lo, hi] = inst._bands[i], on = hi - lo > 0.18; el.classList.toggle('on', on);
          if (on) { tagP.set(1.0, (lo + hi) / 2, 0); spin.parent.localToWorld(tagP.add(spin.position)); tagP.project(cam); const lift = 0; el.style.left = ((tagP.x * 0.5 + 0.5) * W).toFixed(0) + 'px'; el.style.top = ((-tagP.y * 0.5 + 0.5 - lift) * H).toFixed(0) + 'px'; }
        });
      },
      dispose() { D.tags.forEach((el) => el.classList.remove('on')); own.forEach((x) => x.dispose()); S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); },
    };
    return inst;
  },
};
