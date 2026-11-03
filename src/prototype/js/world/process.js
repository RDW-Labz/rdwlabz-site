// Beat 8: "How a build goes" — a clay factory hall under skylights. A moving belt carries jobs past four stations:
// mail chute (envelope) -> press (clay block) -> sculpting arm (sculpted figure) -> Project Swarm gate (checks light,
// barrier lifts) -> packed box drops into the shipping crate. A checklist ticks at the gate; a counter counts this belt.
import * as THREE from 'three';
import { clamp, lerp, range, canvas, tex, rr, easeOut, easeIO, TAU } from './util.js';
import { clay, rbox, blob, plasterTex } from './mat.js';
import { headline, edK } from './ui.js';

const XC = -7.2, XP = -3.0, XS = 1.0, XG = 4.8, XE = 9.0, SP = 2.7, N = 8;   // stations along x, item spacing

export default {
  id: 'process', name: 'How a build goes',
  dom(el) {
    el.innerHTML = `<div class="pr-top"><p class="wr-eyebrow fadeup">C:\\LAB&gt; type HOWTO.TXT</p>${headline('h2', ['How a build <em>goes</em>'])}
      <p class="pr-lead fadeup">One email in, shaped at the bench, shipped through Project Swarm. Nothing merges until the checks pass.</p></div>
      <div class="pr-strip"><ol class="pr-list" aria-label="Gate checklist">
        <li data-k="0"><i></i><span><em>01</em>Email in</span></li>
        <li data-k="1"><i></i><span><em>02</em>Shaped at the bench</span></li>
        <li data-k="2"><i></i><span><em>03</em>Checks pass</span></li>
        <li data-k="3"><i></i><span><em>04</em>Merged and shipped</span></li></ol>
      <p class="pr-count"><b>0</b><span>shipped on <br>this belt</span></p></div>`;
    const st = document.createElement('style'); st.textContent = `
      .pr-top{position:absolute;left:0;right:0;top:clamp(80px,11vh,112px);text-align:center;color:#FFF6E8}
      .pr-top .wr-eyebrow{margin-bottom:6px}
      .pr-top .wr-h{font-size:clamp(54px,6.4vw,108px)}
      .pr-top::before{content:"";position:absolute;left:50%;top:-40px;width:min(980px,90vw);height:calc(100% + 90px);transform:translateX(-50%);z-index:-1;opacity:var(--k,1);background:radial-gradient(closest-side,rgba(14,14,34,.5),rgba(14,14,34,0));pointer-events:none}
      .pr-lead{margin:14px auto 0;max-width:520px;font-size:clamp(16px,1.2vw,18px);line-height:1.5;color:rgba(255,240,235,.9);text-shadow:0 1px 14px rgba(5,5,30,.95);text-wrap:balance}
      .pr-strip{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:6px 6px 6px 8px;border-radius:999px;background:rgba(18,16,34,.62);border:1px solid rgba(255,240,235,.16);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 14px 40px rgba(5,5,20,.35);color:#FFF0EB;white-space:nowrap;opacity:calc(.0 + var(--k,1))}
      .pr-list{display:flex;gap:2px;list-style:none;margin:0;padding:0}
      .pr-list li{display:flex;gap:8px;align-items:center;padding:7px 12px;border-radius:999px;font:500 14px/1 "Instrument Sans",sans-serif;opacity:.5;transition:opacity .3s,background .3s}
      .pr-list li em{font:500 11px "JetBrains Mono",monospace;font-style:normal;letter-spacing:.06em;color:#FFE0B0;margin-right:6px}
      .pr-list li i{width:16px;height:16px;border-radius:5px;border:1.5px solid rgba(255,240,235,.6);flex:none;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;transition:all .25s}
      .pr-list li.ok{opacity:1;background:rgba(255,240,235,.06)}.pr-list li.ok i{background:#7FB069;border-color:#7FB069;color:#10200a}.pr-list li.ok i::after{content:"✓"}
      .pr-count{display:flex;align-items:center;gap:8px;margin:0;padding:4px 16px 4px 14px;border-radius:999px;background:#FFE4BF;color:#1A120A;font:500 10px/1.15 "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase}
      .pr-count b{font:400 34px/1 VT323,monospace;color:#1A120A}
      @media (max-width:820px){
        .pr-top{top:124px;padding:0 16px}.pr-top .wr-h{font-size:clamp(42px,12vw,56px)}.pr-lead{font-size:15px;margin-top:10px}
        .pr-strip{left:16px;right:16px;bottom:44px;transform:none;flex-wrap:wrap;border-radius:18px;padding:8px;white-space:normal;justify-content:space-between}
        .pr-list{display:grid;grid-template-columns:1fr 1fr;gap:2px;flex:1 1 100%}
        .pr-list li{padding:6px 8px;font-size:13px}
        .pr-count{flex:1 1 100%;justify-content:center;margin-top:4px;border-radius:12px}
        .pr-count br{display:none}
      }`;
    document.head.appendChild(st);
    return { el, ed: el.querySelector('.pr-top'), list: el.querySelector('.pr-strip'), li: [...el.querySelectorAll('.pr-list li')], countB: el.querySelector('.pr-count b') };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), own = [], R = ctx.reduced;
    S.background = new THREE.Color('#2a3348'); S.fog = new THREE.Fog('#3a4560', 22, 52);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    // hall: concrete floor, tall walls, roof trusses with skylights
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(70, 40), new THREE.MeshStandardMaterial({ color: '#6b7488', roughness: 0.92 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, -2.6, -2); fl.receiveShadow = true; S.add(fl);
    for (let i = -6; i <= 6; i++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 40), new THREE.MeshBasicMaterial({ color: '#5a6276' })); ln.rotation.x = -Math.PI / 2; ln.position.set(i * 5, -2.59, -2); S.add(ln); }
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.3), new THREE.MeshBasicMaterial({ color: '#F2C94C' })); stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, -2.585, 2.3); S.add(stripe);
    const wt = plasterTex('#8a7a70', 13).clone(); wt.repeat.set(8, 3); wt.needsUpdate = true; own.push(wt);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(70, 18), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.95 })); wall.position.set(0, 6.4, -12); wall.receiveShadow = true; S.add(wall);
    for (let i = -5; i <= 5; i++) { const col = new THREE.Mesh(rbox(0.7, 18, 0.7, 0.06), clay('#C2412E')); col.position.set(i * 6.5, 6.4, -11.6); S.add(col); }
    // big factory windows on the back wall
    for (let i = -3; i <= 3; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#bcd2ff').multiplyScalar(1.15) })); w.position.set(i * 6.5 + 3.25, 6.2, -11.9); S.add(w);
      const gx = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 0.1), clay('#2a2236')); gx.position.set(i * 6.5 + 3.25, 6.2, -11.85); S.add(gx); const gy = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.2, 0.1), clay('#2a2236')); gy.position.set(i * 6.5 + 3.25, 6.2, -11.85); S.add(gy); }
    // skylights + light shafts (additive volumes)
    const shaftM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; void main(){ float a = smoothstep(0., .25, vUv.x) * smoothstep(1., .75, vUv.x) * mix(.02, .16, vUv.y); gl_FragColor = vec4(vec3(1., .95, .85) * a, 1.); }` });
    for (let i = -2; i <= 2; i++) { const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#e8f0ff').multiplyScalar(2.2), toneMapped: false })); sky.rotation.x = Math.PI / 2; sky.position.set(i * 7, 11, -3); S.add(sky);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 14), shaftM); sh.position.set(i * 7 + 1.6, 4, -2.2); sh.rotation.set(0, 0, 0.22); S.add(sh); }
    S.add(new THREE.HemisphereLight('#cfe0ff', '#4a4038', 0.9));
    const sun = new THREE.DirectionalLight('#fff0dc', 2.4); sun.position.set(-4, 14, 3); sun.target.position.set(1, -2, 0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 1024);
    { const c = sun.shadow.camera; c.left = -13; c.right = 13; c.top = 7; c.bottom = -7; c.near = 1; c.far = 30; } sun.shadow.radius = 4; sun.shadow.bias = -0.0006; S.add(sun, sun.target);
    const warm = new THREE.PointLight('#ffb070', 8, 10, 1.6); warm.position.set(XS, 2.5, 2); S.add(warm);
    // ---- conveyor
    const beltLen = XE - XC + 3, bx = (XE + XC) / 2 + 0.5;
    const frame = new THREE.Mesh(rbox(beltLen, 0.36, 1.7, 0.1), clay('#3B2F6E')); frame.position.set(bx, -0.36, 0); frame.castShadow = true; frame.receiveShadow = true; S.add(frame);
    const bc = canvas(64, 512), bxx = bc.getContext('2d'); bxx.fillStyle = '#25232e'; bxx.fillRect(0, 0, 64, 512); bxx.fillStyle = '#3a3846'; for (let i = 0; i < 512; i += 64) bxx.fillRect(0, i, 64, 24); bxx.fillStyle = '#F2C94C'; bxx.fillRect(0, 250, 64, 6);   // the belt seam
    const bt = tex(bc); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.repeat.set(1, beltLen / 1.0); bt.rotation = Math.PI / 2; own.push(bt);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(beltLen, 0.06, 1.35), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.75 })); belt.position.set(bx, -0.15, 0); belt.receiveShadow = true; S.add(belt);
    const boltG = new THREE.SphereGeometry(0.035, 8, 6), boltM = new THREE.MeshStandardMaterial({ color: '#c9c3d8', metalness: 0.8, roughness: 0.3 });
    for (let x = XC - 1; x < XE + 1.5; x += 2.4) [-0.75, 0.75].forEach((z) => { const leg = new THREE.Mesh(rbox(0.18, 2.3, 0.18, 0.04), clay('#2a2236')); leg.position.set(x, -1.5, z); leg.castShadow = true; S.add(leg);
      [-0.5, -2.3].forEach((y) => { const b = new THREE.Mesh(boltG, boltM); b.position.set(x, y, z + Math.sign(z) * 0.1); S.add(b); }); const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.06, 16), clay('#1a1a22')); foot.position.set(x, -2.57, z); S.add(foot); });
    for (let x = XC - 1.2; x < XE + 1.8; x += 0.8) { const b = new THREE.Mesh(boltG, boltM); b.position.set(x, -0.36, 0.86); S.add(b); }
    const rollers = []; for (let x = XC - 1.4; x < XE + 2; x += 0.5) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.72, 12), clay('#F2C94C')); r.rotation.x = Math.PI / 2; r.position.set(x, -0.33, 0); S.add(r); rollers.push(r); }
    // station signs hanging from the roof
    const sign = (txt, x) => { const c = canvas(512, 160), g = c.getContext('2d'); g.fillStyle = '#FFF0DE'; rr(g, 0, 0, 512, 160, 30); g.fill(); g.fillStyle = '#1B1208'; g.font = 'italic 92px "Instrument Serif"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 256, 86); const t = tex(c); own.push(t);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.6), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); m.position.set(x, 3.6, -0.8); S.add(m);
      [-0.8, 0.8].forEach((d) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 7, 4), clay('#1a1a22')); w.position.set(x + d, 7.4, -0.8); S.add(w); }); };
    void sign;   // step names live in the HTML strip; hanging signs would fight the centred title
    // 1: mail chute
    const chute = new THREE.Group(); chute.position.set(XC, 2.6, 0); S.add(chute);
    { const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 3.2, 32, 1, true), clay('#8E9BE0', { side: THREE.DoubleSide })); tube.position.y = 0.6; tube.castShadow = true; chute.add(tube);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.09, 12, 40), clay('#6c7ac4')); rim.rotation.x = Math.PI / 2; rim.position.y = -1.0; chute.add(rim); }
    // 2a: press
    const press = new THREE.Group(); press.position.set(XP, 0, 0); S.add(press);
    [-0.85, 0.85].forEach((z) => { const c = new THREE.Mesh(rbox(0.26, 2.8, 0.26, 0.06), clay('#3B2F6E')); c.position.set(0, 1.2, z); c.castShadow = true; press.add(c); });
    const pTop = new THREE.Mesh(rbox(0.8, 0.4, 2.0, 0.08), clay('#3B2F6E')); pTop.position.y = 2.6; pTop.castShadow = true; press.add(pTop);
    const ram = new THREE.Mesh(rbox(1.0, 0.3, 1.0, 0.08), clay('#E2A07A')); press.add(ram);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 12), new THREE.MeshStandardMaterial({ color: '#c9c3d8', metalness: 0.7, roughness: 0.3 })); press.add(rod);
    // 2b: sculpting arm (a clay robot arm with a loop tool)
    const arm = new THREE.Group(); arm.position.set(XS, -0.1, -1.4); S.add(arm);
    const aBase = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.4, 24), clay('#F2C94C')); aBase.position.y = -0.1; arm.add(aBase);
    const a1 = new THREE.Group(); a1.position.y = 0.1; arm.add(a1);
    const seg1 = new THREE.Mesh(rbox(0.26, 1.6, 0.26, 0.1), clay('#F2C94C')); seg1.position.y = 0.8; seg1.castShadow = true; a1.add(seg1);
    const a2 = new THREE.Group(); a2.position.y = 1.6; a1.add(a2);
    const seg2 = new THREE.Mesh(rbox(0.22, 1.3, 0.22, 0.09), clay('#F2C94C')); seg2.position.y = 0.65; seg2.castShadow = true; a2.add(seg2);
    const toolT = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 20), clay('#1a1a22')); toolT.position.y = 1.4; a2.add(toolT);
    [a1, a2].forEach((g) => { const j = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), clay('#2B2560')); g.add(j); });
    // 3: Project Swarm gate with three check lamps and a barrier
    const gate = new THREE.Group(); gate.position.set(XG, 0, 0); S.add(gate);
    [-1.05, 1.05].forEach((z) => { const p = new THREE.Mesh(rbox(0.3, 3.0, 0.3, 0.08), clay('#2B2560')); p.position.set(0, 1.2, z); p.castShadow = true; gate.add(p); });
    const beam = new THREE.Mesh(rbox(0.6, 0.8, 2.5, 0.12), clay('#2B2560')); beam.position.set(0, 2.85, 0); beam.castShadow = true; gate.add(beam);
    { const c = canvas(1024, 200), g = c.getContext('2d'); g.fillStyle = '#FFE0B0'; g.font = '120px VT323'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PROJECT SWARM', 512, 104); const t = tex(c); own.push(t);
      [[0.31, Math.PI / 2], [0, 0]].forEach(([dx, ry], k) => { const lab = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.45), new THREE.MeshBasicMaterial({ map: t, transparent: true })); if (k === 0) { lab.position.set(dx, 3.0, 0); lab.rotation.y = ry; } else { lab.position.set(0, 3.0, 1.26); } gate.add(lab); }); }
    const lamps = [-0.6, 0, 0.6].map((z) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffb24a', toneMapped: false })); l.position.set(z * 0.33, 2.6, 1.27); gate.add(l); return l; });
    const bar = new THREE.Group(); bar.position.set(-0.4, 0.5, 1.1); gate.add(bar);
    { const armB = new THREE.Mesh(rbox(0.12, 0.12, 2.1, 0.05), clay('#F2E6D2')); armB.position.z = -1.05; bar.add(armB); [-0.35, -1.05, -1.75].forEach((z) => { const s = new THREE.Mesh(rbox(0.13, 0.13, 0.22, 0.04), clay('#C2412E')); s.position.z = z; bar.add(s); }); }
    const gateL = new THREE.PointLight('#ffb24a', 3, 5, 1.6); gateL.position.set(0.6, 2.4, 1.8); gate.add(gateL);
    // shipping crate at the end
    const crate = new THREE.Group(); crate.position.set(XE + 1.4, -2.6, 0); S.add(crate);
    const cm = clay('#B97E58'); [[0, 0.7, 0, 2.2, 1.4, 0.12, 1.1], [0, 0.7, 0, 2.2, 1.4, 0.12, -1.1], [1.1, 0.7, 0, 0.12, 1.4, 2.2, 0], [-1.1, 0.7, 0, 0.12, 1.4, 2.2, 0], [0, 0.06, 0, 2.2, 0.12, 2.2, 0]].forEach(([x, y, z, w, h, d, oz]) => { const m = new THREE.Mesh(rbox(w, h, d, 0.04), cm); m.position.set(x, y, z + oz); m.castShadow = true; m.receiveShadow = true; crate.add(m); });
    { const c = canvas(512, 160), g = c.getContext('2d'); g.fillStyle = '#2B2560'; g.font = '110px VT323'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SHIPPED', 256, 86); const t = tex(c); own.push(t); const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8 })); m.position.set(0, 0.8, 1.17); crate.add(m); }
    const pile = []; for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(rbox(0.6, 0.55, 0.6, 0.06), clay('#E2A07A')); b.position.set(-0.5 + (i % 3) * 0.5, 0.45 + Math.floor(i / 3) * 0.5, -0.3 + (i % 2) * 0.5); b.rotation.y = i * 0.7; b.visible = false; crate.add(b); pile.push(b); }
    // wall counter (shipped on this belt)
    const cc = canvas(512, 200), cx = cc.getContext('2d'); const ct = tex(cc); own.push(ct); let shown = -1;
    const drawCount = (n) => { cx.fillStyle = '#141020'; rr(cx, 0, 0, 512, 200, 26); cx.fill(); cx.fillStyle = '#7FFFA0'; cx.font = '120px VT323'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(String(n).padStart(3, '0'), 256, 90); cx.fillStyle = '#FFE0B0'; cx.font = '34px VT323'; cx.fillText('SHIPPED · THIS BELT', 256, 168); ct.needsUpdate = true; };
    const counter = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.94), new THREE.MeshBasicMaterial({ map: ct, toneMapped: false })); counter.position.set(XE + 1.4, 3.6, -3); S.add(counter); drawCount(0);
    // ---- the items: one group per job with four forms (envelope, block, sculpted, box)
    const mkItem = () => {
      const g = new THREE.Group(); S.add(g);
      const env = new THREE.Group(); g.add(env);
      { const e = new THREE.Mesh(rbox(0.95, 0.07, 0.66, 0.03), clay('#F6EBDA')); e.castShadow = true; env.add(e); const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 20), clay('#C2412E')); seal.position.set(0, 0.05, 0.05); env.add(seal); }
      const block = new THREE.Mesh(rbox(0.75, 0.6, 0.65, 0.12), clay('#B9B2AA')); block.position.y = 0.3; block.castShadow = true; g.add(block);
      const fig = new THREE.Group(); g.add(fig);
      { const b = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), clay('#EF8A5C')); b.scale.set(1, 1.25, 1); b.position.y = 0.4; b.castShadow = true; fig.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), clay('#EF8A5C')); h.position.y = 0.88; fig.add(h);
        [-0.07, 0.07].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), clay('#241c18')); e.position.set(x, 0.92, 0.18); fig.add(e); }); }
      const box = new THREE.Group(); g.add(box);
      { const b = new THREE.Mesh(rbox(0.75, 0.66, 0.7, 0.07), clay('#E2A07A')); b.position.y = 0.33; b.castShadow = true; box.add(b); const tp = new THREE.Mesh(rbox(0.79, 0.07, 0.2, 0.02), clay('#C98F68')); tp.position.y = 0.67; box.add(tp);
        const ck = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('#7FB069').multiplyScalar(1.5), toneMapped: false })); ck.position.set(0.18, 0.4, 0.356); box.add(ck); }
      return { g, env, block, fig, box, form: -1 };
    };
    const items = Array.from({ length: N }, mkItem);
    const sh = blob(beltLen + 6, 6, 0.4); sh.position.set(bx, -2.59, 0); S.add(sh);
    const span = SP * N, X0 = XC - 1.0;
    let mob = false, prevShipped = 0;
    const inst = {
      scene: S, cam, post: { lens: 0.7, border: 1, vig: 0.3, bloom: 0.35, con: 1.08, s: 0.3 }, phoneLift: 0.04,
      layout(a, m) { cam.aspect = a; mob = m; cam.fov = m ? 66 : 40; cam.updateProjectionMatrix(); },
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0, now = performance.now() / 1000;
        const u = R ? span * 0.45 : t * span * 1.15 + now * 0.25;   // the belt runs with the scroll (plus a slow idle crawl)
        const du = u - (inst._u ?? u); inst._u = u;
        bt.offset.y -= du / 1.0 * 0.5; rollers.forEach((r) => { r.rotation.y -= du * 6; });
        const us = R ? u : t * span * 1.15; let front = null, shipped = Math.max(0, Math.floor((us - (XE - X0)) / SP) + 1);
        items.forEach((it, i) => {
          const x = X0 + ((u + i * SP) % span + span) % span;
          let y = -0.1, vis = true;
          const form = x < XP ? 0 : x < XS ? 1 : x < XG + 0.3 ? 2 : 3;
          if (x < XC + 0.05) { const k = (x - X0) / (XC + 0.05 - X0); y = -0.1 + (1 - easeOut(clamp(k))) * 2.4; }
          if (x > XE + 0.3) { const k = clamp((x - XE - 0.3) / 1.2); y = -0.1 - k * k * 1.8 + Math.sin(k * Math.PI) * 0.6; vis = k < 1; }
          // squash pop on each form change
          if (form !== it.form) { it.form = form; it.pop = 1; }
          it.pop = Math.max(0, (it.pop || 0) - dt * 3);
          const sq = Math.sin(it.pop * Math.PI) * 0.3;
          it.env.visible = form === 0; it.block.visible = form === 1; it.fig.visible = form === 2; it.box.visible = form === 3;
          it.g.position.set(Math.min(x, XE + 1.5), y, 0); it.g.scale.set(1 + sq, 1 - sq, 1 + sq); it.g.visible = vis;
          it.g.rotation.y = form === 2 ? (x - XS) * 1.2 : 0;
          if (x < XG + 0.3 && x > XS && (!front || x > front.x)) front = { x, it };
        });
        // press thumps when a block passes under it, arm sculpts near XS
        const nearP = items.some((it) => Math.abs(it.g.position.x - XP) < 0.35);
        ram.position.y = lerp(ram.position.y, nearP && !R ? 0.45 : 1.6, 1 - Math.exp(-dt * 14)); rod.position.y = ram.position.y + 0.85;
        a1.rotation.z = -0.5 + (R ? 0 : Math.sin(now * 3) * 0.15); a2.rotation.z = -1.6 + (R ? 0 : Math.sin(now * 4.4) * 0.25); arm.rotation.y = R ? 0 : Math.sin(now * 1.3) * 0.3;
        // gate: checks light as the front job approaches; barrier lifts once all are green
        const g = front ? clamp((front.x - (XG - 2.2)) / 1.9) : 0;
        lamps.forEach((l, i) => { const on = g > (i + 1) / 4; l.material.color.set(on ? '#7FFFA0' : '#ffb24a').multiplyScalar(on ? 2.6 : 1.4); });
        const ok = g > 0.8; gateL.color.set(ok ? '#7FFFA0' : '#ffb24a');
        bar.rotation.x = -lerp(0, Math.PI * 0.46, easeOut(clamp((g - 0.8) / 0.2)));
        inst.check = [true, true, g > 0.55, ok];
        if (shipped !== shown) { shown = shipped; drawCount(shipped); }
        pile.forEach((b, i) => { b.visible = i < Math.min(pile.length, shipped); });
        inst.shipped = shipped;
        // camera: elevated three-quarter view panning down the line with the scroll
        // full-bleed: the whole line sits across the frame under the title; a slow dolly follows the jobs
        const fx = mob ? lerp(XC + 4, XE - 3, clamp(t * 1.1 - 0.05)) : lerp(-0.6, 2.6, clamp(t * 1.1 - 0.05));
        cam.position.set(fx + (mob ? 1 : 0.8) + mx * 0.6, (mob ? 7.4 : 6.6) + my * 0.3, mob ? 16.5 : 14.5);
        cam.lookAt(fx, mob ? -0.4 : 0.9, -0.4);
      },
      ui(k, t) {
        const v = k * range(t, -0.05, 0.08) * (1 - range(t, 0.9, 1.0));
        edK(D.ed, v); edK(D.list, v);
        if (inst.check) D.li.forEach((li, i) => { const on = inst.check[i]; if (li.classList.contains('ok') !== on) li.classList.toggle('ok', on); });
        if (inst.shipped !== undefined && D.countB.textContent !== String(inst.shipped)) D.countB.textContent = String(inst.shipped);
      },
      dispose() { own.forEach((x) => x.dispose()); S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); },
    };
    return inst;
  },
};
