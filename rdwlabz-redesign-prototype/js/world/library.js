// Beat 3: "The clay library" — a clay shelving unit; pack boxes drop onto the shelves as you scroll (squash on landing),
// the four public packs carry their real art, the rest are unnamed boxes with a "+44 more" tag. Clay odometers roll up
// to 48 packs / 730 models / 176 textures. Hover a box to tilt it and read its name.
import * as THREE from 'three';
import { clamp, lerp, range, Spring, canvas, tex, rr, drawCover, grain, rng, easeOut, backOut, TAU } from './util.js';
import { clay, rbox, rig, blob, room, pendant } from './mat.js';
import { headline, edK } from './ui.js';
import { LIBRARY, PROJECTS } from '../data.js';

// a printed catalogue page laid over the shop: ink on cream paper, running head, index with leaders, figure row
const CSS = `
.lb-page{position:absolute;left:clamp(16px,5vw,80px);top:clamp(86px,12vh,112px);bottom:clamp(70px,10vh,96px);width:min(430px,34vw);box-sizing:border-box;display:flex;flex-direction:column;
  padding:22px 30px 18px;color:#1B1208;border-radius:3px;
  background:radial-gradient(120% 80% at 20% 0%,rgba(255,252,244,.9),rgba(255,252,244,0) 60%),repeating-linear-gradient(0deg,rgba(120,90,50,.035) 0 1px,transparent 1px 3px),linear-gradient(170deg,#F7EFDF,#EFE3CB);
  box-shadow:0 1px 0 rgba(255,255,255,.6) inset,0 0 0 1px rgba(80,50,20,.12),0 30px 70px rgba(10,4,2,.55),0 6px 16px rgba(10,4,2,.3);
  --kk:clamp(0,calc(var(--k,1)*1.3),1);opacity:var(--kk);transform:translateY(calc((1 - var(--kk))*40px)) rotate(calc(-1.1deg - (1 - var(--kk))*2deg));transform-origin:30% 100%}
.lb-page::after{content:"";position:absolute;inset:10px;border:1px solid rgba(80,50,20,.16);pointer-events:none}
.lb-run{display:flex;justify-content:space-between;font:500 11px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#8a6a50;padding:0 0 10px;border-bottom:1.5px solid #1B1208;margin:0 0 18px}
.lb-page .wr-h{font-size:clamp(54px,5.4vw,92px);color:#1B1208;text-shadow:none}
.lb-page .wr-h em{color:#C2412E}
.lb-lead{margin:14px 0 0;font:400 clamp(15px,1.15vw,17px)/1.5 "Instrument Sans",sans-serif;color:#3A2E22;max-width:38ch;text-wrap:pretty}
.lb-index{list-style:none;margin:auto 0 0;padding:16px 0 0}
.lb-index li{display:flex;align-items:baseline;gap:10px;padding:6px 0;border-top:1px solid rgba(60,40,20,.14);font:italic 400 clamp(17px,1.35vw,21px)/1.2 "Instrument Serif",serif;color:#1B1208}
.lb-index li em{font:500 11px "JetBrains Mono",monospace;font-style:normal;color:#B5733F;letter-spacing:.06em;min-width:26px}
.lb-index li i{flex:1;border-bottom:1.5px dotted rgba(60,40,20,.35);transform:translateY(-4px)}
.lb-index li b{font:500 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#8a6a50;font-weight:500}
.lb-index li.more span{color:#6B4A2E}
.lb-figs{display:grid;grid-template-columns:repeat(3,1fr);margin:12px 0 0;border-top:1.5px solid #1B1208;border-bottom:1px solid rgba(60,40,20,.2)}
.lb-figs div{padding:8px 0 8px 10px;border-left:1px solid rgba(60,40,20,.16)}.lb-figs div:first-child{border-left:0;padding-left:0}
.lb-figs dt{font:500 10px "JetBrains Mono",monospace;letter-spacing:.12em;text-transform:uppercase;color:#8a6a50}
.lb-figs dd{margin:2px 0 0;font:italic 400 clamp(34px,3vw,48px)/.95 "Instrument Serif",serif;color:#C2412E}
.lb-foot{display:flex;justify-content:space-between;margin-top:10px;font:500 10px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#8a6a50}
@media (max-height:700px) and (min-width:821px){.lb-index li:nth-child(n+3):not(.more){display:none}}
@media (max-width:820px){
  .lb-page{left:12px;right:12px;top:auto;bottom:40px;width:auto;padding:16px 20px 12px;transform:translateY(calc((1 - var(--kk))*40px)) rotate(-.6deg)}
  .lb-page::after{inset:6px}
  .lb-run{margin-bottom:10px;padding-bottom:7px;font-size:10px}
  .lb-page .wr-h{font-size:clamp(40px,11vw,52px)}
  .lb-lead{font-size:15px;margin-top:8px}
  .lb-index,.lb-foot{display:none}
  .lb-figs dd{font-size:32px}
}
@media (prefers-reduced-motion:reduce){.lb-page{transform:rotate(-1.1deg)}}
`;

const PASTEL = ['#C99AAE', '#8E9BE0', '#E9B48E', '#A7C4A0', '#E4C77E', '#B6A3D9', '#E39B8C', '#9DBFD1'];

export default {
  id: 'library', name: 'Clay library',
  dom(el) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const names = LIBRARY.named.map((i) => PROJECTS[i].name);
    el.innerHTML = `<article class="lb-page" aria-label="The clay library">
      <header class="lb-run fadeup"><span>RDW Labz &middot; Clay catalogue</span><span>No. 06</span></header>
      ${headline('h2', ['The clay', '<em>library</em>'])}
      <p class="lb-lead fadeup">Forty-eight packs of clay-style 3D models, from Vikings to Modern II. Downloads are coming soon.</p>
      <ol class="lb-index fadeup">${names.map((n, i) => `<li><em>${String(i + 1).padStart(2, '0')}</em><span>${n}</span><i></i><b>front shelf</b></li>`).join('')}<li class="more"><em>+44</em><span>more packs</span><i></i><b>down the aisle</b></li></ol>
      <dl class="lb-figs fadeup"><div><dt>Packs</dt><dd>${LIBRARY.packs}</dd></div><div><dt>Models</dt><dd>${LIBRARY.models}</dd></div><div><dt>Textures</dt><dd>${LIBRARY.textures}</dd></div></dl>
      <footer class="lb-foot fadeup"><span>Hover a box to read its label</span><span>p. 06</span></footer></article>`;
    return { el, copy: el.querySelector('.lb-page') };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), own = [], P = ctx.projects, R = ctx.reduced;
    S.background = new THREE.Color('#2a1810'); S.fog = new THREE.Fog('#2a1810', 14, 34);
    const rm = room(S, { w: 30, d: 30, h: 9, cx: 0, cz: -14, floorY: -2.6, floor: '#7a5236', wall: '#6a3e2a' }); own.push(...rm.userData.own);
    // the aisle: more shelving units receding into the shop, filled with simple boxes
    const PAST = ['#C99AAE', '#8E9BE0', '#E9B48E', '#A7C4A0', '#E4C77E', '#B6A3D9', '#E39B8C', '#9DBFD1'];
    const boxG = new THREE.BoxGeometry(1, 1, 1), labG = new THREE.PlaneGeometry(1, 0.14), labM = new THREE.MeshStandardMaterial({ color: '#FFF4E4', roughness: 0.8 }), lidG = new THREE.BoxGeometry(1, 0.07, 1); let bi = 0;
    [[-6.2, -6, 0.5], [6.6, -6, -0.5], [-6.2, -13, 0.5], [6.6, -13, -0.5], [-6.2, -20, 0.5], [6.6, -20, -0.5]].forEach(([x, z, ry]) => {
      const u = new THREE.Group(); u.position.set(x, 0, z); u.rotation.y = ry; S.add(u);
      const bk = new THREE.Mesh(rbox(5.6, 5.4, 0.16, 0.05), clay('#7a4a32')); bk.position.set(0, -0.1, -0.6); u.add(bk);
      [-2.3, -0.6, 1.1, 2.5].forEach((y, k) => { const sh = new THREE.Mesh(rbox(5.8, 0.14, 1.1, 0.05), clay('#B97E58')); sh.position.set(0, y, 0); sh.receiveShadow = true; u.add(sh);
        if (k < 3) for (let q = 0; q < 6; q++) { const w = 0.55 + ((q * 7 + k) % 3) * 0.12, h = 0.6 + ((q + k) % 3) * 0.15; const b = new THREE.Mesh(boxG, clay(PAST[(bi++) % PAST.length])); b.scale.set(w, h, 0.6); b.position.set(-2.4 + q * 0.92, y + 0.07 + h / 2, 0.1); b.castShadow = true; u.add(b);
          const lab = new THREE.Mesh(labG, labM); lab.scale.set(w * 0.7, 1, 1); lab.position.set(b.position.x, y + 0.07 + h * 0.62, 0.41); u.add(lab); const lid = new THREE.Mesh(lidG, clay(PAST[(bi + 3) % PAST.length])); lid.scale.set(w + 0.03, 1, 0.63); lid.position.set(b.position.x, y + 0.07 + h - 0.03, 0.1); u.add(lid); } });
    });
    const lamps = [pendant(S, -2.4, 4.2, 1.4, { intensity: 40, shadow: true, angle: 0.9, shade: '#C2412E', target: new THREE.Vector3(-1, -1, 0) }), pendant(S, 2.6, 4.2, 1.2, { intensity: 34, angle: 0.9, shade: '#C2412E', target: new THREE.Vector3(2, -1, 0) }), pendant(S, 0, 4.4, -9, { intensity: 30, angle: 1.0, shade: '#2B2560' }), pendant(S, 0, 4.4, -16, { intensity: 26, angle: 1.0, shade: '#2B2560' })];
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
    const L = rig(S, { key: '#ffd2a0', keyPos: [-4, 8, 9], area: 7, keyI: 0.9, hemiI: 0.3, rimI: 0.5 });
    const clouds = { update() {} };
    const U = new THREE.Group(); S.add(U);
    // shelving unit
    const wood = clay('#B97E58'), woodD = clay('#9C6747');
    const SW = 8.6, SH = 5.2, SD = 1.2, shelfY = [-1.75, -0.05, 1.65];
    const back = new THREE.Mesh(rbox(SW, SH, 0.18, 0.08), clay('#8F5E44')); back.position.set(0, -0.1, -SD / 2); back.receiveShadow = true; U.add(back);
    [-1, 1].forEach((s) => { const sd = new THREE.Mesh(rbox(0.22, SH + 0.1, SD + 0.1, 0.08), wood); sd.position.set(s * SW / 2, -0.1, 0); sd.castShadow = true; sd.receiveShadow = true; U.add(sd); });
    [...shelfY.map((y) => y - 0.66), 2.5].forEach((y, i) => { const b = new THREE.Mesh(rbox(SW + 0.1, 0.16, SD + 0.12, 0.06), i === 3 ? woodD : wood); b.position.set(0, y, 0.02); b.castShadow = true; b.receiveShadow = true; U.add(b);
      if (i < 3) { const lip = new THREE.Mesh(rbox(SW - 0.1, 0.1, 0.08, 0.04), woodD); lip.position.set(0, y + 0.02, SD / 2 + 0.06); U.add(lip); } });
    const ground = blob(16, 5, 0.6); ground.position.set(0, -2.6, 0.4); U.add(ground);
    // boxes
    const inst0 = {};
    const boxes = []; const r = rng(4);
    const named = LIBRARY.named;
    const layout = [   // [shelf, x, w, h, kind] kind: index into named or -1
      [0, -3.3, 0.8, 0.95, -1], [0, -2.35, 0.7, 0.8, -1], [0, -1.45, 0.75, 1.0, -1], [0, -0.45, 0.85, 0.9, -1], [0, 0.55, 0.7, 0.75, -1], [0, 1.5, 0.8, 1.0, -1], [0, 2.5, 0.75, 0.85, -1], [0, 3.45, 0.7, 0.95, -1],
      [1, -3.05, 1.45, 1.2, 0], [1, -1.4, 1.45, 1.2, 1], [1, 0.25, 1.45, 1.2, 2], [1, 1.9, 1.45, 1.2, 3], [1, 3.35, 0.7, 0.9, -1],
      [2, -3.3, 0.75, 0.9, -1], [2, -2.4, 0.7, 1.0, -1], [2, -1.5, 0.8, 0.85, -1], [2, -0.55, 0.75, 0.95, -1], [2, 0.4, 0.7, 0.8, -1], [2, 1.35, 0.8, 1.0, -1],
    ];
    layout.forEach(([sh, x, w, h, kind], i) => {
      const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
      const isN = kind >= 0, pi = isN ? named[kind] : -1, col = isN ? '#F3E7D3' : PASTEL[i % PASTEL.length];
      const d = isN ? 0.8 : 0.55 + r() * 0.2;
      const b = new THREE.Mesh(rbox(w, h, d, 0.07), clay(col, { roughness: 0.6 })); b.castShadow = true; b.receiveShadow = true; b.position.y = h / 2; inner.add(b);
      // lid seam
      const lid = new THREE.Mesh(rbox(w + 0.02, 0.06, d + 0.02, 0.03), clay(isN ? '#E2CDAE' : col)); lid.position.y = h - 0.14; inner.add(lid);
      if (isN) {
        const p = P[pi], c = canvas(512, 512), x = c.getContext('2d');
        x.fillStyle = '#F3E7D3'; x.fillRect(0, 0, 512, 512);
        x.save(); rr(x, 20, 20, 472, 330, 22); x.clip(); drawCover(x, ctx.images[pi], 20, 20, 472, 330); x.restore();
        x.fillStyle = '#1B1208'; x.font = '44px "Instrument Serif"'; x.textBaseline = 'alphabetic';
        const words = p.name.split(' '); let ln = '', y = 404; const lines = []; words.forEach((wd) => { const tt = ln ? ln + ' ' + wd : wd; if (x.measureText(tt).width > 460) { lines.push(ln); ln = wd; } else ln = tt; }); lines.push(ln);
        lines.slice(0, 2).forEach((l, k) => x.fillText(l, 26, y + k * 44));
        x.fillStyle = '#B5733F'; x.font = '26px VT323'; x.fillText('CLAY 3D · 24 MODELS', 26, 494);
        grain(x, 512, 512, 6, i); const t = tex(c); own.push(t);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, w - 0.1), new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 }));
        f.position.set(0, h / 2 - 0.02, d / 2 + 0.003); f.scale.y = (h - 0.12) / (w - 0.1); inner.add(f);
      } else {
        // a stripe label with a blank name line: honest about being unnamed here
        const st = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 0.16), new THREE.MeshStandardMaterial({ color: '#FFF4E4', roughness: 0.8 })); st.position.set(0, h * 0.42, d / 2 + 0.003); inner.add(st);
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), new THREE.MeshStandardMaterial({ color: '#2B2560', roughness: 0.7 })); dot.position.set(-w * 0.22, h * 0.72, d / 2 + 0.003); inner.add(dot);
      }
      g.position.set(x, shelfY[sh] - 0.58, 0.05 + (isN ? 0.05 : r() * 0.12)); g.rotation.y = (r() - 0.5) * (isN ? 0.12 : 0.3);
      U.add(g);
      b.userData.box = boxes.length;
      boxes.push({ g, inner, b, isN, name: isN ? P[pi].name : 'One of 44 more packs', y0: g.position.y, ry: g.rotation.y, delay: (sh === 1 ? 0 : sh === 0 ? 0.12 : 0.22) + (x + 4) * 0.012, h, tilt: new Spring(0, 140, 12), hov: 0 });
    });
    // "+44 more" tag leaning on the top shelf
    { const c = canvas(512, 220), x = c.getContext('2d'); x.fillStyle = '#FFE4BF'; rr(x, 0, 0, 512, 220, 40); x.fill(); x.fillStyle = '#1B1208'; x.font = 'italic 130px "Instrument Serif"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+44 more', 256, 112); const t = tex(c); own.push(t);
      const tag = new THREE.Group(); const plate = new THREE.Mesh(rbox(1.6, 0.7, 0.08, 0.12), clay('#FFE4BF')); plate.castShadow = true; tag.add(plate);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.64), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); face.position.z = 0.045; tag.add(face);
      tag.position.set(2.85, shelfY[2] - 0.2, 0.25); tag.rotation.set(-0.12, -0.2, 0.05); U.add(tag); inst0.tag = tag; }
    // odometers on the top board
    const digT = Array.from({ length: 10 }, (_, n) => { const c = canvas(128, 176), x = c.getContext('2d'); x.fillStyle = '#FFF4E4'; x.fillRect(0, 0, 128, 176); x.fillStyle = '#1B1208'; x.font = '150px "Instrument Serif"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 64, 98); x.fillStyle = 'rgba(80,50,30,.15)'; x.fillRect(0, 86, 128, 3); const t = tex(c); own.push(t); return t; });
    const counters = [[LIBRARY.packs, 'PACKS', -2.7], [LIBRARY.models, 'MODELS', 0], [LIBRARY.textures, 'TEXTURES', 2.7]].map(([val, lab, cx]) => {
      const g = new THREE.Group(); g.position.set(cx, 2.6, 0.1); U.add(g);
      const base = new THREE.Mesh(rbox(1.75, 0.22, 0.7, 0.08), clay('#3B2F6E')); base.position.y = 0.11; base.castShadow = true; g.add(base);
      const c = canvas(384, 64), x = c.getContext('2d'); x.fillStyle = '#FFE0B0'; x.font = '50px VT323'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(lab, 192, 34); const lt = tex(c); own.push(lt);
      const lp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.23), new THREE.MeshBasicMaterial({ map: lt, transparent: true })); lp.position.set(0, 0.11, 0.352); g.add(lp);
      const tiles = [0, 1, 2].map((k) => { const piv = new THREE.Group(); piv.position.set((k - 1) * 0.5, 0.56, 0); g.add(piv);
        const tb = new THREE.Mesh(rbox(0.44, 0.6, 0.4, 0.07), clay('#F3E7D3')); tb.castShadow = true; piv.add(tb);
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.5), new THREE.MeshBasicMaterial({ map: digT[0], color: new THREE.Color(0.92, 0.9, 0.88) })); face.position.z = 0.203; piv.add(face);
        return { piv, face, d: 0, s: new Spring(0, 160, 14) }; });
      return { val, tiles };
    });
    const ray = new THREE.Raycaster(); const hitList = boxes.map((b) => b.b); let hover = -1;
    const inst = Object.assign(inst0, {
      scene: S, cam, post: { lens: 0.75, border: 1, vig: 0.4, bloom: 0.42, con: 1.1, s: 0.38 }, phoneLift: 0.3,
      hint: 'hover a box · scroll <span class="ar">↓</span>',
      layout(a, m) { cam.aspect = a; inst.mob = m; cam.fov = m ? 50 : 40; cam.updateProjectionMatrix(); },
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0, now = performance.now() / 1000;
        const m = inst.mob;
        const dz = m ? 15.5 : 18.0, pan = m ? lerp(-2.4, 2.4, clamp(range(t, 0.12, 0.92))) : lerp(-0.6, 0.6, t);
        const k = clamp(t);
        cam.position.set(pan + mx * 0.5, (m ? 1.2 : 1.6) - k * 0.4 + my * 0.25, dz - k * 1.4);
        cam.lookAt(pan * 0.8, m ? 0.4 : 0.35, 0);
        if (!m) { const off = 2.6; cam.position.x += off; cam.position.y += 0.5; cam.lookAt(pan * 0.8 - 2.9, 0.75, 0); }
        U.rotation.y = (m ? 0 : -0.18) + mx * 0.03;
        // drop-in with squash
        boxes.forEach((b, i) => {
          const lt = R ? 1 : clamp((t + 0.06 - b.delay) / 0.16);
          const fall = 1 - easeOut(clamp(lt / 0.7)); const land = clamp((lt - 0.7) / 0.3);
          const sq = land > 0 && land < 1 ? Math.sin(land * Math.PI) * 0.18 * (1 - land) : 0;
          b.g.position.y = b.y0 + fall * 4.5; b.inner.scale.set(1 + sq, 1 - sq * 1.4, 1 + sq); b.g.visible = lt > 0;
          b.tilt.t = hover === i ? 1 : 0; const tk = b.tilt.step(dt);
          b.inner.rotation.set(-tk * 0.22, tk * 0.35, tk * 0.06); b.inner.position.set(0, tk * 0.12, tk * 0.2);
        });
        // odometers roll up
        const ck = R ? 1 : easeOut(range(t, 0.18, 0.6));
        counters.forEach((c) => { const v = Math.round(c.val * ck), ds = String(v).padStart(3, '0');
          c.tiles.forEach((tl, k) => { const d = +ds[k]; if (d !== tl.d) { tl.d = d; tl.face.material.map = digT[d]; tl.s.x = -Math.PI * 0.5; tl.s.v = 0; } tl.s.t = 0; tl.piv.rotation.x = tl.s.step(dt); }); });
        if (inst.tag) inst.tag.rotation.z = 0.05 + (R ? 0 : Math.sin(now * 1.3) * 0.03);
        clouds.update(dt, R);
      },
      ui(k, t) { edK(D.copy, k * range(t, -0.05, 0.08) * (1 - range(t, 0.86, 0.98))); if (k < 0.5) ctx.ui.tipAt(''); },
      pointer(type, e, ndc, over) {
        if (type !== 'move') return;
        ray.setFromCamera(ndc, cam); const h = over ? null : ray.intersectObjects(hitList, false)[0];
        hover = h ? h.object.userData.box : -1;
        document.body.style.cursor = hover >= 0 ? 'pointer' : '';
        ctx.ui.tipAt(hover >= 0 ? boxes[hover].name : '', e.clientX, e.clientY);
      },
      dispose() { ctx.ui.tipAt(''); own.forEach((t) => t.dispose()); S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); },
    });
    return inst;
  },
};
