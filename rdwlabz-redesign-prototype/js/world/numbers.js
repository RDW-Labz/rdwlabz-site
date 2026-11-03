// Beat 7: the numbers wall — a sunlit pegboard in a cream morning room (window light falls through a cookie onto the
// wall). Five clay plaques count up to the only numbers we can stand behind.
import * as THREE from 'three';
import { clamp, lerp, range, easeOut, canvas, tex, rr, backOut } from './util.js';
import { clay, rbox, plasterTex, planksTex, blob } from './mat.js';
import { headline, edK } from './ui.js';
import { NUMBERS } from '../data.js';

const COLS = ['#E2A07A', '#8E9BE0', '#C99AAE', '#7FB069', '#F2C94C'];

// centered hero layout: the counts are crisp HTML type pinned onto the clay plaques (projected each frame),
// a one-line title on top and one line of copy at the foot.
const CSS = `
.nb-ui{position:absolute;inset:0;color:#1B1208}
.nb-top{position:absolute;left:0;right:0;top:clamp(84px,12.5vh,124px);text-align:center}
.nb-top .wr-eyebrow{color:#9A5A2E;text-shadow:none;margin-bottom:8px}
.nb-top .wr-h{font-size:clamp(46px,5vw,84px);color:#1B1208;text-shadow:0 2px 30px rgba(255,244,226,.7)}
.nb-top .wr-h em{color:#C2412E}
.nb-nums{list-style:none;margin:0;padding:0}
.nb-n{position:absolute;left:0;top:0;--h:120px;width:var(--w,200px);height:var(--h);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--h)*.03);
  --kk:clamp(0,calc(var(--k,1)*1.6 - var(--d,0)),1);opacity:var(--kk);will-change:transform}
.nb-n b{font:italic 400 calc(var(--h)*.74)/.84 "Instrument Serif",serif;letter-spacing:-.03em;color:#1B1208;font-variant-numeric:lining-nums}
.nb-n span{font:500 max(9px,calc(var(--h)*.085))/1.15 "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#7A5434;white-space:nowrap}
.nb-ui .nb-foot{position:absolute;left:50%;bottom:clamp(58px,9vh,84px);transform:translateX(-50%) translateY(calc((1 - var(--kk))*18px));margin:0;width:max-content;max-width:calc(100vw - 32px);text-align:center;
  font:italic 400 clamp(20px,1.7vw,26px)/1.3 "Instrument Serif",serif;color:#3A2E22}
@media (max-width:820px){
  .nb-top{top:118px}
  .nb-n span{white-space:normal;text-align:center;max-width:90%;letter-spacing:.08em}
  .nb-top .wr-h{font-size:clamp(40px,11vw,52px)}
  .nb-ui .nb-foot{bottom:56px;width:auto;left:16px;right:16px;transform:translateY(calc((1 - var(--kk))*18px));font-size:19px;padding:10px 14px;border-radius:14px;background:rgba(255,246,232,.9);box-shadow:0 10px 30px rgba(40,20,10,.25)}
}
@media (prefers-reduced-motion:reduce){.nb-ui .nb-foot{transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce) and (max-width:820px){.nb-ui .nb-foot{transform:none}}
`;

export default {
  id: 'numbers', name: 'By the numbers',
  dom(el) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el.innerHTML = `<div class="nb-ui">
      <header class="nb-top"><p class="wr-eyebrow fadeup">C:\\LAB&gt; stats --real</p>${headline('h2', ['By the <em>numbers</em>'])}</header>
      <ol class="nb-nums" aria-label="By the numbers">${NUMBERS.map(([n, l]) => `<li class="nb-n"><b aria-hidden="true">0</b><span>${l}</span><i class="sr">${n} ${l}</i></li>`).join('')}</ol>
      <p class="nb-foot fadeup">Counted, not guessed. The wall updates as the library grows.</p></div>`;
    const ui = el.querySelector('.nb-ui');
    return { el, ed: ui, nums: [...el.querySelectorAll('.nb-n')], numB: [...el.querySelectorAll('.nb-n b')] };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), own = [], R = ctx.reduced;
    S.background = new THREE.Color('#efe2cc');
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    // room: cream plaster wall, honey floor
    // warm painted beadboard: vertical boards with a groove and a bead highlight
    const bc = canvas(512, 512), bx = bc.getContext('2d'); bx.fillStyle = '#ecd2a2'; bx.fillRect(0, 0, 512, 512);
    for (let x0 = 0; x0 < 512; x0 += 32) { bx.fillStyle = 'rgba(120,80,40,.28)'; bx.fillRect(x0, 0, 2, 512); bx.fillStyle = 'rgba(255,248,230,.45)'; bx.fillRect(x0 + 3, 0, 2, 512); bx.fillStyle = 'rgba(150,100,50,.06)'; bx.fillRect(x0 + 6, 0, 12, 512); }
    const wt = tex(bc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(10, 3); own.push(wt);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 })); wall.position.set(0, 3, -1.2); wall.receiveShadow = true; S.add(wall);
    const ft = planksTex('#c08a5a', 4).clone(); ft.repeat.set(10, 4); ft.needsUpdate = true; own.push(ft);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.7 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -3.4, 5); floor.receiveShadow = true; S.add(floor);
    S.add(new THREE.HemisphereLight('#fff4e6', '#c09070', 0.7));
    // morning sun through a window: a spotlight with a mullion cookie, casting real shadows
    const ck = canvas(256, 256), cx = ck.getContext('2d'); cx.fillStyle = '#000'; cx.fillRect(0, 0, 256, 256); cx.fillStyle = '#fff';
    [[30, 30], [134, 30], [30, 134], [134, 134]].forEach(([x, y]) => cx.fillRect(x, y, 92, 92)); const cookie = tex(ck); own.push(cookie);
    const sun = new THREE.SpotLight('#ffe2b0', 95, 40, 0.42, 0.25, 1.2); sun.position.set(-9, 8, 9); sun.target.position.set(1, 0.5, -1.2); sun.map = cookie; sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 3; sun.shadow.bias = -0.0005; S.add(sun, sun.target);
    const bounce = new THREE.DirectionalLight('#ffd8b0', 0.6); bounce.position.set(4, -2, 6); S.add(bounce);
    // pegboard
    const pc = canvas(512, 256), px = pc.getContext('2d'); px.fillStyle = '#c99a6e'; px.fillRect(0, 0, 512, 256); px.fillStyle = 'rgba(60,35,20,.55)'; for (let y = 8; y < 256; y += 16) for (let x = 8; x < 512; x += 16) { px.beginPath(); px.arc(x, y, 2.4, 0, Math.PI * 2); px.fill(); }
    const pt = tex(pc); own.push(pt);
    const board = new THREE.Mesh(rbox(11, 5.5, 0.12, 0.06), [null].map(() => new THREE.MeshStandardMaterial({ map: pt, roughness: 0.85 }))[0]); board.position.set(0.6, 0.6, -1.1); board.receiveShadow = true; board.castShadow = true; S.add(board);
    // plaques
    const shT = (() => { const c = canvas(128, 128), x = c.getContext('2d'); x.filter = 'blur(10px)'; x.fillStyle = '#000'; rr(x, 22, 22, 84, 84, 14); x.fill(); return tex(c, { srgb: false }); })(); own.push(shT);
    const plaques = NUMBERS.map(([n, label], i) => {
      const c = canvas(512, 300), x = c.getContext('2d'); const t = tex(c); own.push(t);
      x.fillStyle = '#FFF6E8'; x.fillRect(0, 0, 512, 300); x.fillStyle = 'rgba(120,80,40,.07)'; for (let k = 0; k < 300; k += 6) x.fillRect(0, k, 512, 1); x.fillStyle = COLS[i]; x.globalAlpha = 0.5; x.fillRect(0, 286, 512, 14); x.globalAlpha = 1; t.needsUpdate = true;   // blank card: the count is crisp HTML on top
      const g = new THREE.Group(); const big = i < 3;
      const w = big ? 2.9 : 3.4, h = big ? 1.95 : 1.85;
      g.position.set(big ? -3.0 + i * 3.25 : -1.0 + (i - 3) * 3.7, big ? 1.65 : -0.75, -0.95); g.userData.d = g.position.clone(); S.add(g);
      const pl = new THREE.Mesh(rbox(w, h, 0.18, 0.12), clay(COLS[i], { roughness: 0.55, clearcoat: 0.3 })); pl.castShadow = true; pl.receiveShadow = true; g.add(pl);
      const csh = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.9, h + 0.9), new THREE.MeshBasicMaterial({ map: shT, transparent: true, opacity: 0.55, depthWrite: false, color: '#3a2010' })); csh.position.set(0.1, -0.16, -0.12); g.add(csh);   // soft card shadow
      const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, (w - 0.3) * 300 / 512), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })); face.position.z = 0.092; g.add(face);
      [-w / 2 + 0.3, w / 2 - 0.3].forEach((x2) => { const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 10), clay('#3a2a24')); peg.rotation.x = Math.PI / 2; peg.position.set(x2, h / 2 + 0.06, -0.05); g.add(peg); });
      return { g, n, v: -1, i, w, h, big };
    });
    // props: a potted plant, a ladder, a clay stool
    const pot = new THREE.Group(); pot.position.set(-6.5, -3.4, 0.4); S.add(pot);
    const potM = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.9, 24), clay('#C2412E')); potM.position.y = 0.45; potM.castShadow = true; pot.add(potM);
    for (let i = 0; i < 7; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), clay('#5f8f4e')); lf.position.set(Math.sin(i * 0.9) * 0.4, 1.2 + (i % 3) * 0.35, Math.cos(i * 0.9) * 0.3); lf.scale.set(0.5, 1.2, 0.5); lf.rotation.z = Math.sin(i) * 0.5; lf.castShadow = true; pot.add(lf); }
    const lad = new THREE.Group(); lad.position.set(7.4, -3.4, -0.6); lad.rotation.z = 0.12; S.add(lad);
    [-0.4, 0.4].forEach((x) => { const r = new THREE.Mesh(rbox(0.12, 6, 0.12, 0.04), clay('#B97E58')); r.position.set(x, 3, 0); r.castShadow = true; lad.add(r); });
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8), clay('#B97E58')); s.rotation.z = Math.PI / 2; s.position.set(0, 0.5 + i * 0.8, 0); lad.add(s); }
    const sh = blob(14, 3, 0.25); sh.position.set(0.6, -3.39, 0); S.add(sh);
    let mob = false; const V = new THREE.Vector3();
    const inst = {
      scene: S, cam, post: { lens: 0.55, border: 1, vig: 0.22, bloom: 0.25, con: 1.06, s: 0.25 }, phoneLift: 0,
      layout(a, m) { cam.aspect = a; mob = m; cam.fov = m ? 62 : 36; cam.updateProjectionMatrix();
        // phone: a 2-column grid on a taller board (desktop keeps the 3 + 2 wall)
        const MG = [[-1.25, 3.7], [1.95, 3.7], [-1.25, 1.45], [1.95, 1.45], [0.35, -0.8]];
        plaques.forEach((p) => { if (m) p.g.position.set(MG[p.i][0], MG[p.i][1], -0.95); else p.g.position.copy(p.g.userData.d); });
        if (m) { board.scale.set(0.66, 1.55, 1); board.position.set(0.35, 1.45, -1.1); } else { board.scale.set(1, 1, 1); board.position.set(0.6, 0.6, -1.1); }
      },
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0;
        const k = easeOut(range(t, 0, 0.45));
        // dead-on and centred: the wall is the page
        const cx = mob ? 0.35 : 0.25, cy = mob ? 1.45 : 0.55;
        cam.position.set(cx + lerp(-1.2, 0, k) + mx * 0.3, cy + (mob ? 0.2 : 0.75) + lerp(0.8, 0, k) + my * 0.18, lerp(mob ? 19 : 20, mob ? 13.6 : 13.6, k) - range(t, 0.5, 1) * 0.6);
        cam.lookAt(cx, cy + (mob ? 0.35 : 0.62), -1);
        plaques.forEach((p) => {
          const lt = R ? 1 : range(t, 0.02 + p.i * 0.05, 0.3 + p.i * 0.05);
          p.v = Math.round(p.n * easeOut(lt));
          const pop = R ? 1 : backOut(range(t, p.i * 0.06, 0.12 + p.i * 0.06), 1.8);
          p.g.scale.setScalar(Math.max(0.001, pop)); p.g.rotation.z = (1 - clamp(pop)) * 0.3 + Math.sin(p.i * 2.1) * 0.02;
        });
      },
      ui(k, t) {
        edK(D.ed, k * range(t, -0.05, 0.1) * (1 - range(t, 0.9, 1.0)));
        if (!D.ed._on && D.ed.style.visibility === 'hidden') return;
        const W = window.innerWidth, H = window.innerHeight;
        cam.updateMatrixWorld();
        plaques.forEach((p) => {
          const s = p.g.scale.x, fh = (p.w - 0.3) * 300 / 512;
          V.set(0, 0, 0.1); p.g.localToWorld(V); V.project(cam); const x = (V.x + 1) / 2 * W, y = (1 - V.y) / 2 * H;
          V.set(0, fh / 2, 0.1); p.g.localToWorld(V); V.project(cam); const yt = (1 - V.y) / 2 * H;
          V.set((p.w - 0.3) / 2, 0, 0.1); p.g.localToWorld(V); V.project(cam); const xr = (V.x + 1) / 2 * W;
          const h = Math.max(1, (y - yt) * 2), w = Math.max(1, (xr - x) * 2), el = D.nums[p.i];
          el.style.transform = `translate(${(x - w / 2).toFixed(1)}px,${(y - h / 2).toFixed(1)}px) rotate(${(-p.g.rotation.z * 57.3).toFixed(2)}deg)`;
          const hs = h.toFixed(0) + 'px'; if (el._h !== hs) { el._h = hs; el.style.setProperty('--h', hs); el.style.setProperty('--w', w.toFixed(0) + 'px'); el.style.setProperty('--d', String(p.i * 0.12)); }
          el.style.visibility = s > 0.2 ? '' : 'hidden';
          const vs = String(p.v); if (D.numB[p.i].textContent !== vs) D.numB[p.i].textContent = vs;
        });
      },
      dispose() { own.forEach((x) => x.dispose()); S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); },
    };
    return inst;
  },
};
