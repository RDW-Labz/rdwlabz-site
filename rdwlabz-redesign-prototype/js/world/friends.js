// Beat 9: "Built with friends" — a dusk rooftop: our bench and Verrow AI's bench, linked by a cable. A packet runs from
// our bench to theirs and, when it lands, a finished (generic, our own mock) site pops up. A plain wordmark, no logos.
import * as THREE from 'three';
import { clamp, lerp, range, canvas, tex, rr, easeOut, backOut, rng, TAU } from './util.js';
import { makeSky, stars, clay, rbox, blob, planksTex } from './mat.js';
import { headline, edK } from './ui.js';

// the skyline gets the full width; the title runs along the bottom with one line of copy and a quiet text link.
const CSS = `
.fr-ui{position:absolute;inset:0}
.fr-ui::before{content:"";position:absolute;left:0;right:0;bottom:0;height:44%;opacity:var(--k,1);background:linear-gradient(180deg,rgba(14,8,24,0),rgba(14,8,24,.62) 55%,rgba(14,8,24,.82));pointer-events:none}
.fr-bar{position:absolute;left:clamp(16px,5.5vw,88px);right:clamp(16px,5.5vw,88px);bottom:clamp(58px,9vh,84px);display:flex;align-items:flex-end;justify-content:space-between;gap:40px}
.fr-l .wr-eyebrow{margin-bottom:8px}
.fr-l .wr-h{font-size:clamp(54px,6.4vw,104px);white-space:nowrap}
.fr-r{margin:0 0 .5em;max-width:340px;font-size:16px;line-height:1.5;color:rgba(255,240,235,.84);text-align:right;text-shadow:0 1px 14px rgba(5,5,30,.9)}
.fr-link{display:inline-block;margin-top:6px;color:#FFE0B0;font:500 14px/1 "JetBrains Mono",monospace;letter-spacing:.04em;text-decoration:none;border-bottom:1px solid rgba(255,224,176,.45);padding:4px 0}
.fr-link:hover{border-bottom-color:#FFE0B0}
.fr-link:focus-visible{outline:3px solid #FFB45E;outline-offset:3px;border-radius:2px}
@media (max-width:820px){
  .fr-ui::before{height:52%}
  .fr-bar{left:16px;right:16px;bottom:52px;flex-direction:column;align-items:flex-start;gap:10px}
  .fr-l .wr-h{font-size:clamp(40px,11.5vw,54px);white-space:normal}
  .fr-r{text-align:left;max-width:none;margin:0}
  .fr-link{min-height:24px;padding:10px 0 6px}
}
`;

function bench(name, accent, screenCol, own) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(rbox(2.4, 0.16, 1.2, 0.06), clay('#B97E58')); top.position.y = 0.95; top.castShadow = true; top.receiveShadow = true; g.add(top);
  [[-1.05, -0.45], [1.05, -0.45], [-1.05, 0.45], [1.05, 0.45]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.95, 10), clay('#7a5236')); l.position.set(x, 0.47, z); l.castShadow = true; g.add(l); });
  const mon = new THREE.Mesh(rbox(1.2, 0.88, 0.5, 0.12), clay('#F2E6D2', { roughness: 0.5, clearcoat: 0.3 })); mon.position.set(-0.2, 1.5, -0.1); mon.castShadow = true; g.add(mon);
  const c = canvas(256, 192), x = c.getContext('2d'); x.fillStyle = '#0b0a24'; x.fillRect(0, 0, 256, 192);
  for (let i = 0; i < 7; i++) { x.fillStyle = i % 3 === 0 ? screenCol : 'rgba(255,240,230,.45)'; rr(x, 22 + (i % 2) * 18, 24 + i * 22, 60 + ((i * 53) % 120), 10, 5); x.fill(); }
  const t = tex(c); own.push(t);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.64), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false })); scr.position.set(-0.2, 1.52, 0.152); g.add(scr);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.2, 18), clay(accent)); mug.position.set(0.75, 1.13, 0.2); g.add(mug);
  // plain wordmark sign (neutral type, no logo)
  const sc = canvas(512, 140), sx = sc.getContext('2d'); sx.fillStyle = '#FFF0DE'; rr(sx, 0, 0, 512, 140, 30); sx.fill(); sx.fillStyle = '#1B1208'; sx.font = '600 70px "Instrument Sans"'; sx.textAlign = 'center'; sx.textBaseline = 'middle'; sx.fillText(name, 256, 74); const st = tex(sc); own.push(st);
  const sg = new THREE.Group(); sg.position.set(0, 2.55, -0.1); g.add(sg);
  const pl = new THREE.Mesh(rbox(1.8, 0.5, 0.08, 0.12), clay('#FFF0DE')); pl.castShadow = true; sg.add(pl);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1.74, 0.48), new THREE.MeshStandardMaterial({ map: st, roughness: 0.7 })); f.position.z = 0.043; sg.add(f);
  [-0.6, 0.6].forEach((xx) => { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), clay('#7a5236')); s.position.set(xx, 2.15, -0.1); g.add(s); });
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 16), clay('#2B2560')); port.rotation.z = Math.PI / 2; g.add(port);
  return { g, port, scr };
}

export default {
  id: 'friends', name: 'Built with friends',
  dom(el) {
    if (!document.getElementById('frCSS')) { const st = document.createElement('style'); st.id = 'frCSS'; st.textContent = CSS; document.head.appendChild(st); }
    el.innerHTML = `<div class="fr-ui"><div class="fr-bar"><div class="fr-l"><p class="wr-eyebrow fadeup">C:\\LAB&gt; ping verrow.ai</p>${headline('h2', ['Built with <em>friends</em>'])}</div>
      <p class="fr-r fadeup"><span>Verrow AI is our partner for custom software and AI systems.</span> <a class="fr-link" href="https://verrow.ai/" target="_blank" rel="noopener">verrow.ai ↗</a></p></div></div>`;
    return { el, ed: el.querySelector('.fr-ui') };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), own = [], R = ctx.reduced, r = rng(21);
    S.add(makeSky({ c0: '#120a3a', c1: '#3a2a8a', c2: '#8a5aa8', c3: '#e88a7a', c4: '#ffb27a', c5: '#ff9a6a', horizon: -0.04 })); S.add(stars(160, 41, 0.45, 0.4));
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
    S.add(new THREE.HemisphereLight('#c0a8ff', '#3a2030', 0.7));
    const sun = new THREE.DirectionalLight('#ffb07a', 2.4); sun.position.set(10, 4, -12); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); { const c = sun.shadow.camera; c.left = -10; c.right = 10; c.top = 8; c.bottom = -8; c.far = 40; } sun.shadow.radius = 4; S.add(sun);
    const fill = new THREE.DirectionalLight('#9fb4ff', 0.7); fill.position.set(-6, 6, 8); S.add(fill);
    // roof deck, parapet, water tank, vents
    const rt = planksTex('#5a4a5e', 8).clone(); rt.repeat.set(6, 4); rt.needsUpdate = true; own.push(rt);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), new THREE.MeshStandardMaterial({ map: rt, roughness: 0.9 })); roof.rotation.x = -Math.PI / 2; roof.position.set(0, -1.4, -1); roof.receiveShadow = true; S.add(roof);
    const par = clay('#8a6a7a'); [[0, -9, 26, 0.4], [-13, -1, 0.4, 16], [13, -1, 0.4, 16]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(rbox(w, 0.9, d, 0.08), par); m.position.set(x, -0.95, z); m.castShadow = true; m.receiveShadow = true; S.add(m); });
    const tank = new THREE.Group(); tank.position.set(-8.5, -1.4, -6.5); S.add(tank);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.2, 24), clay('#9c6a4a')); tb.position.y = 3.3; tb.castShadow = true; tank.add(tb);
    const tr = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.8, 24), clay('#6a4a3a')); tr.position.y = 4.8; tank.add(tr);
    [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), clay('#2a2236')); l.position.set(x, 1.1, z); tank.add(l); });
    [[6, -6], [8, -3.5]].forEach(([x, z]) => { const v = new THREE.Mesh(rbox(1.4, 1.0, 1.4, 0.1), clay('#b8b0c8')); v.position.set(x, -0.9, z); v.castShadow = true; S.add(v); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.06, 20), clay('#2a2236')); f.position.set(x, -0.38, z); S.add(f); });
    // radio antenna with a blinking tip
    const ant = new THREE.Group(); ant.position.set(9.5, -1.4, -7); S.add(ant);
    { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 6, 8), clay('#2a2236')); m.position.y = 3; ant.add(m); [1.5, 3, 4.4].forEach((y, i) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4 - i * 0.35, 6), clay('#2a2236')); r.rotation.z = Math.PI / 2; r.position.y = y; ant.add(r); });
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4a3a').multiplyScalar(3), toneMapped: false })); tip.position.y = 6.05; ant.add(tip); ant.userData.tip = tip; }
    // skyline: clay blocks with lit windows, far below the parapet
    const winM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(1.8), toneMapped: false });
    for (let i = 0; i < 26; i++) { const w = 1.5 + r() * 2.5, h = 3 + r() * 9, x = -40 + i * 3.3 + r(), z = -26 - r() * 18; const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 2), clay(['#3a2a5a', '#4a3a6a', '#2a2050'][i % 3])); b.position.set(x, -6 + h / 2, z); S.add(b);
      for (let k = 0; k < 6; k++) if (r() < 0.5) { const wm = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.3), winM); wm.position.set(x - w / 2 + 0.3 + r() * (w - 0.6), -6 + 1 + r() * (h - 2), z + 1.01); S.add(wm); } }
    // string lights across the roof
    const bulbM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(3), toneMapped: false });
    [[[-12, 3.2, -8], [12, 3.0, -8]], [[-12, 2.6, -8], [-2, 2.8, 4]]].forEach(([a, b]) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); for (let i = 0; i <= 22; i++) { const u = i / 22, p = A.clone().lerp(B, u); p.y -= Math.sin(u * Math.PI) * 0.9; const bb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bulbM); bb.position.copy(p); S.add(bb); } });
    // the two benches + cable
    const A = bench('RDW Labz', '#E9B48E', '#FFB45E', own), B = bench('Verrow AI', '#8E9BE0', '#9FB4FF', own);
    A.g.position.set(-3.8, -1.4, 0.2); A.g.rotation.y = 0.3; S.add(A.g);
    B.g.position.set(3.8, -1.4, -0.6); B.g.rotation.y = -0.3; S.add(B.g);
    A.port.position.set(1.22, 0.95, 0); B.port.position.set(-1.22, 0.95, 0);
    S.updateMatrixWorld(true);
    const pa = A.port.getWorldPosition(new THREE.Vector3()), pb = B.port.getWorldPosition(new THREE.Vector3());
    const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24; const p = pa.clone().lerp(pb, u); p.y -= Math.sin(u * Math.PI) * 1.2; p.z += Math.sin(u * Math.PI) * 1.4; pts.push(p); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 140, 0.05, 10), new THREE.MeshStandardMaterial({ color: '#2a2236', roughness: 0.5 })); cable.castShadow = true; S.add(cable);
    const packet = new THREE.Mesh(rbox(0.22, 0.22, 0.22, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd09a').multiplyScalar(3), toneMapped: false })); S.add(packet);
    const trail = Array.from({ length: 6 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 - i * 0.007, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb07a').multiplyScalar(2.4 - i * 0.3), toneMapped: false, transparent: true, opacity: 1 - i * 0.15 })); S.add(m); return m; });
    const pl = new THREE.PointLight('#ffc890', 3, 3.5, 1.6); S.add(pl);
    // the shipped site: our own generic mock, rising from Verrow's bench
    const sc = canvas(640, 420), sx = sc.getContext('2d'); sx.fillStyle = '#F7EFE4'; sx.fillRect(0, 0, 640, 420); sx.fillStyle = '#EDE0CC'; sx.fillRect(0, 0, 640, 40);
    ['#E2533B', '#F2C94C', '#7FB069'].forEach((c, i) => { sx.fillStyle = c; sx.beginPath(); sx.arc(22 + i * 22, 20, 7, 0, TAU); sx.fill(); });
    sx.fillStyle = '#2B2560'; rr(sx, 30, 70, 300, 34, 10); sx.fill(); sx.fillStyle = '#E4D6C3'; rr(sx, 30, 120, 260, 16, 8); sx.fill(); rr(sx, 30, 146, 200, 16, 8); sx.fill();
    sx.fillStyle = '#E2A07A'; rr(sx, 30, 186, 140, 40, 20); sx.fill(); sx.fillStyle = '#8E9BE0'; rr(sx, 360, 66, 250, 170, 16); sx.fill();
    [0, 1, 2].forEach((i) => { sx.fillStyle = '#FFFFFF'; rr(sx, 30 + i * 200, 266, 180, 120, 14); sx.fill(); sx.fillStyle = ['#4A6CC0', '#E2A07A', '#B9889A'][i]; rr(sx, 46 + i * 200, 282, 40, 40, 10); sx.fill(); });
    const stt = tex(sc); own.push(stt);
    const site = new THREE.Group(); S.add(site);
    const sf = new THREE.Mesh(rbox(2.3, 1.55, 0.1, 0.08), clay('#F1E3CE', { clearcoat: 0.4 })); site.add(sf);
    const ss = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.42), new THREE.MeshBasicMaterial({ map: stt, toneMapped: false })); ss.position.z = 0.052; site.add(ss);
    const tag = (() => { const c = canvas(256, 80), x = c.getContext('2d'); x.fillStyle = '#7FB069'; rr(x, 0, 0, 256, 80, 40); x.fill(); x.fillStyle = '#fff'; x.font = '44px VT323'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SHIPPED ✓', 128, 44); const t = tex(c); own.push(t); return new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.25), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false })); })();
    tag.position.set(0.8, 0.86, 0.08); site.add(tag);
    const siteBase = B.g.localToWorld(new THREE.Vector3(0.2, 3.9, -0.2));
    let mob = false;
    const inst = {
      scene: S, cam, post: { lens: 0.75, border: 1, vig: 0.36, bloom: 0.55, con: 1.1, s: 0.35 }, phoneLift: 0.22,
      layout(a, m) { cam.aspect = a; mob = m; cam.fov = m ? 66 : 40; cam.updateProjectionMatrix(); },
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0, now = performance.now() / 1000, tt = clamp(t);
        // the packet runs RDW -> Verrow between 0.15 and 0.5, then loops slowly
        const pk = R ? 1 : t < 0.5 ? range(t, 0.15, 0.5) : ((now * 0.25) % 1);
        curve.getPointAt(clamp(easeOut(pk)), packet.position); packet.rotation.set(now, now * 1.3, 0); packet.visible = pk > 0.01 && pk < 0.99;
        trail.forEach((m, i) => { curve.getPointAt(clamp(easeOut(pk) - (i + 1) * 0.015), m.position); m.visible = packet.visible; });
        pl.position.copy(packet.position); pl.intensity = packet.visible ? 3 : 0;
        const up = R ? 1 : backOut(range(t, 0.48, 0.62), 1.6);
        site.position.copy(siteBase); site.position.y += -1.2 + up * 1.2 + (R ? 0 : Math.sin(now * 1.2) * 0.04); site.scale.setScalar(Math.max(0.001, up)); site.rotation.y = -0.35;
        tag.visible = up > 0.9;
        ant.userData.tip.visible = R || Math.sin(now * 3) > 0;
        const ang = lerp(-0.18, 0.2, tt), d = mob ? 19 : 13.5;
        // centred: the skyline runs edge to edge, benches sit mid-frame above the title band
        cam.position.set(Math.sin(ang) * d + mx * 0.6, (mob ? 4.4 : 2.4) + my * 0.3 - tt * 0.4, Math.cos(ang) * d + 1);
        cam.lookAt(0, mob ? 1.0 : 0.2, -0.5);
      },
      ui(k, t) { edK(D.ed, k * range(t, -0.05, 0.1) * (1 - range(t, 0.88, 0.98))); },
      dispose() { own.forEach((x) => x.dispose()); S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); },
    };
    return inst;
  },
};
