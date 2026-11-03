// Beat 10: get in touch — the studio's front porch at night: a warm door, a porch lamp, a clay mailbox. An envelope
// addressed to devops@therdw.com flies in and drops into the box; the flag goes up.
import * as THREE from 'three';
import { clamp, lerp, range, easeOut, easeIO, canvas, tex, rr } from './util.js';
import { clay, rbox, planksTex, plasterTex, blob, stars, makeSky } from './mat.js';
import { headline, edK } from './ui.js';

// centred composition: the door on the left, the mailbox on the right, one solid card between them on the siding.
const CSS = `
.tc-ui{position:absolute;inset:0}
.tc-card{position:absolute;left:0;right:0;top:50%;margin:-6vh auto 0;transform:translateY(-50%);width:min(440px,calc(100vw - 32px));box-sizing:border-box;text-align:center;
  padding:30px 34px 32px;border-radius:26px;background:rgba(10,12,40,.84);border:1px solid rgba(255,240,235,.14);box-shadow:0 30px 70px rgba(2,2,20,.45);opacity:clamp(0,calc(var(--k,1)*2),1)}
.tc-card .wr-eyebrow{margin-bottom:8px}
.tc-card .wr-h{font-size:clamp(50px,5vw,80px)}
.tc-card .wr-h .ln>span{transform-origin:50% 100%}
.tc-lead{margin:16px auto 0;max-width:340px;font-size:16px;line-height:1.55;color:rgba(255,240,235,.86)}
.tc-act{margin:0}.tc-act .wr-link{margin-top:20px}
@media (max-width:820px){
  .tc-card{top:auto;bottom:52px;margin:0 auto;transform:none;padding:22px 20px 24px;border-radius:22px}
  .tc-card .wr-h{font-size:clamp(40px,11.5vw,52px)}
  .tc-lead{font-size:15px;margin-top:10px}
  .tc-act .wr-link{margin-top:14px;font-size:14px}
}
`;
import { CONTACT } from '../data.js';

export default {
  id: 'touch', name: 'Get in touch',
  dom(el) {
    if (!document.getElementById('tcCSS')) { const st = document.createElement('style'); st.id = 'tcCSS'; st.textContent = CSS; document.head.appendChild(st); }
    el.innerHTML = `<div class="tc-ui"><div class="tc-card"><p class="wr-eyebrow fadeup">C:\\BENCH&gt; mail</p>${headline('h2', ['Get in <em>touch</em>'])}
      <p class="tc-lead fadeup">Software, a website, a game or an asset pack? Send one email with what it is, a few links and rough timing.</p>
      <p class="fadeup tc-act"><a class="wr-link" href="mailto:${CONTACT}">Email ${CONTACT}</a></p></div></div>`;
    return { el, ed: el.querySelector('.tc-ui') };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), own = [], R = ctx.reduced;
    S.add(makeSky({ c0: '#02021a', c1: '#0c1450', c2: '#1C2E84', c3: '#3a3070', c4: '#5a3a5a', c5: '#2a1a2a', horizon: -0.1, k: 0.9 })); S.add(stars(300, 71, 0.15, 0.45));
    S.fog = new THREE.Fog('#0c1030', 14, 40);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    S.add(new THREE.HemisphereLight('#5a6ad0', '#1a1020', 0.45));
    const moon = new THREE.DirectionalLight('#9fb4ff', 0.9); moon.position.set(6, 8, 4); S.add(moon);
    // house front: siding wall, door with a lit window, porch deck and steps
    const sc = canvas(256, 256), sx = sc.getContext('2d'); sx.fillStyle = '#4A6CC0'; sx.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 32) { sx.fillStyle = 'rgba(0,0,30,.28)'; sx.fillRect(0, y + 28, 256, 4); sx.fillStyle = 'rgba(255,255,255,.06)'; sx.fillRect(0, y, 256, 3); }
    const st = tex(sc); st.wrapS = st.wrapT = THREE.RepeatWrapping; st.repeat.set(4, 3); own.push(st);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshStandardMaterial({ map: st, roughness: 0.9 })); wall.position.set(-1, 2.0, -2.5); wall.receiveShadow = true; S.add(wall);
    const door = new THREE.Group(); door.position.set(-2.4, -0.4, -2.45); S.add(door);
    const dm = new THREE.Mesh(rbox(1.7, 3.4, 0.15, 0.06), clay('#C2412E', { clearcoat: 0.4 })); dm.position.y = 1.7; dm.castShadow = true; door.add(dm);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(2.2), toneMapped: false })); win.position.set(0, 2.5, 0.08); door.add(win);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshStandardMaterial({ color: '#d8b060', metalness: 0.8, roughness: 0.3 })); knob.position.set(0.6, 1.6, 0.12); door.add(knob);
    const frameM = clay('#F2E6D2'); [[0, 3.5, 2.0, 0.16], [-0.93, 1.7, 0.16, 3.6], [0.93, 1.7, 0.16, 3.6]].forEach(([x, y, w, h]) => { const f = new THREE.Mesh(rbox(w, h, 0.22, 0.05), frameM); f.position.set(x, y, 0.02); door.add(f); });
    const doorL = new THREE.PointLight('#ffb070', 3, 6, 1.6); doorL.position.set(0, 2.5, 0.8); door.add(doorL);
    const housePlate = (() => { const c = canvas(512, 128), x = c.getContext('2d'); x.fillStyle = '#2B2560'; rr(x, 0, 0, 512, 128, 20); x.fill(); x.fillStyle = '#FFE0B0'; x.font = '64px VT323'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('RDW LABZ · 1301', 256, 68); const t = tex(c); own.push(t); return new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 })); })();
    housePlate.position.set(-2.4, 3.75, -2.42); S.add(housePlate);
    const ft = planksTex('#8a6448', 6).clone(); ft.repeat.set(4, 2); ft.needsUpdate = true; own.push(ft);
    const deck = new THREE.Mesh(rbox(14, 0.4, 5, 0.06), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.75 })); deck.position.set(-1, -0.6, 0); deck.receiveShadow = true; S.add(deck);
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(rbox(3, 0.3, 0.6, 0.05), clay('#7a5638')); s.position.set(-2.4, -0.95 - i * 0.3, 2.8 + i * 0.6); s.receiveShadow = true; S.add(s); }
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), clay('#2e4a3a', { roughness: 1 })); lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, -1.9, 6); lawn.receiveShadow = true; S.add(lawn);
    // a doormat and a potted plant by the door
    { const mat = new THREE.Mesh(rbox(1.6, 0.04, 0.9, 0.02), clay('#B97E58')); mat.position.set(-2.4, -0.38, -1.6); mat.receiveShadow = true; S.add(mat);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 20), clay('#C2412E')); pot.position.set(-4.0, -0.1, -1.9); pot.castShadow = true; S.add(pot);
      for (let i = 0; i < 6; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), clay('#4f7a44')); lf.scale.set(0.5, 1.3, 0.5); lf.position.set(-4.0 + Math.sin(i) * 0.22, 0.45 + (i % 3) * 0.18, -1.9 + Math.cos(i) * 0.18); lf.rotation.z = Math.sin(i * 2) * 0.5; lf.castShadow = true; S.add(lf); } }
    // porch lamp
    const lamp = new THREE.Group(); lamp.position.set(-3.7, 2.6, -2.3); S.add(lamp);
    const lb = new THREE.Mesh(rbox(0.36, 0.5, 0.36, 0.06), clay('#1a1a22')); lamp.add(lb);
    const lg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.26), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd9a0').multiplyScalar(3.2), toneMapped: false })); lamp.add(lg);
    const pl = new THREE.SpotLight('#ffc888', 45, 12, 1.0, 0.8, 1.5); pl.position.set(0, 0, 0.3); pl.target.position.set(0.6, -3, 3); pl.castShadow = true; pl.shadow.mapSize.set(1024, 1024); pl.shadow.radius = 4; lamp.add(pl, pl.target);
    // mailbox on a post at the steps
    const mb = new THREE.Group(); mb.position.set(4.3, -1.9, 2.0); mb.rotation.y = -0.6; S.add(mb);
    const post = new THREE.Mesh(rbox(0.22, 1.9, 0.22, 0.04), clay('#B97E58')); post.position.y = 0.95; post.castShadow = true; mb.add(post);
    const boxG = new THREE.Group(); boxG.position.y = 2.15; mb.add(boxG);
    const bx = new THREE.Mesh(rbox(0.75, 0.6, 1.2, 0.2, 4), clay('#3B2F6E', { clearcoat: 0.5 })); bx.castShadow = true; boxG.add(bx);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.08), new THREE.MeshBasicMaterial({ color: '#0b0812' })); slot.position.set(0, 0.12, 0.61); boxG.add(slot);
    const flagP = new THREE.Group(); flagP.position.set(0.39, 0, -0.2); boxG.add(flagP);
    const flag = new THREE.Mesh(rbox(0.04, 0.5, 0.06, 0.015), clay('#E2533B')); flag.position.y = 0.2; flagP.add(flag);
    const flagT = new THREE.Mesh(rbox(0.04, 0.16, 0.26, 0.02), clay('#E2533B')); flagT.position.set(0, 0.38, 0.12); flagP.add(flagT);
    // the envelope with our address
    const ec = canvas(512, 320), ex = ec.getContext('2d'); ex.fillStyle = '#F6EBDA'; ex.fillRect(0, 0, 512, 320); ex.strokeStyle = 'rgba(120,90,60,.35)'; ex.lineWidth = 3; ex.beginPath(); ex.moveTo(0, 0); ex.lineTo(256, 170); ex.lineTo(512, 0); ex.stroke();
    ex.fillStyle = '#C2412E'; ex.beginPath(); ex.arc(256, 168, 26, 0, Math.PI * 2); ex.fill();
    ex.fillStyle = '#2B2560'; ex.font = '38px "JetBrains Mono"'; ex.textAlign = 'center'; ex.fillText(CONTACT, 256, 262); const et = tex(ec); own.push(et);
    const env = new THREE.Group(); S.add(env);
    const eb = new THREE.Mesh(rbox(0.9, 0.56, 0.03, 0.02), clay('#F6EBDA')); eb.castShadow = true; env.add(eb);
    const ef = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.55), new THREE.MeshStandardMaterial({ map: et, roughness: 0.8 })); ef.position.z = 0.017; env.add(ef);
    // fireflies by the lawn
    const n = 50, fp = new Float32Array(n * 3), seeds = []; for (let i = 0; i < n; i++) seeds.push([Math.random() * 18 - 9, -1.5 + Math.random() * 2, 1 + Math.random() * 7, Math.random() * 6]);
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
    const ff = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.1, color: new THREE.Color(2.4, 2, 1), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); S.add(ff);
    const sh = blob(1.4, 1.4, 0.6); sh.position.set(4.3, -1.89, 2.0); S.add(sh);
    const tgt = new THREE.Vector3(), from = new THREE.Vector3(-4, 3.5, 9);
    let mob = false;
    const inst = {
      scene: S, cam, post: { lens: 0.75, border: 1, vig: 0.42, bloom: 0.55, con: 1.1, s: 0.35 }, phoneLift: 0.22,
      layout(a, m) { cam.aspect = a; mob = m; cam.fov = m ? 62 : 40; cam.updateProjectionMatrix(); },
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0, now = performance.now() / 1000;
        const k = easeOut(range(t, 0, 0.45)), out = range(t, 0.85, 1.05);
        // square-on: door left of the card, mailbox right of it
        const lx = mob ? 0.2 : 1.4;
        cam.position.set(lerp(6, lx + 0.4, k) + mx * 0.5, lerp(3.4, mob ? 2.2 : 1.5, k) + my * 0.25 + out, lerp(16, mob ? 13 : 11.2, k) + out * 2);
        cam.lookAt(lerp(1, lx, k), mob ? 0.4 : 1.0, 0);
        // envelope arc into the slot
        boxG.updateMatrixWorld(true); tgt.set(0, 0.12, 0.7); boxG.localToWorld(tgt);
        const e = R ? 1 : easeIO(range(t, 0.15, 0.48));
        env.position.lerpVectors(from, tgt, e); env.position.y += Math.sin(e * Math.PI) * 1.4;
        env.rotation.set(-0.2 * (1 - e), mb.rotation.y + (1 - e) * 2.4, (1 - e) * 0.5);
        env.scale.setScalar(e > 0.97 ? Math.max(0.001, 1 - (e - 0.97) / 0.03) : 1); env.visible = e < 1;
        flagP.rotation.x = -lerp(0, Math.PI / 2, easeOut(range(t, 0.48, 0.58)));
        doorL.intensity = 3 * (R ? 1 : 0.94 + 0.06 * Math.sin(now * 7));
        for (let i = 0; i < n; i++) { const [x, y, z, p] = seeds[i]; fp[i * 3] = x + (R ? 0 : Math.sin(now * 0.4 + p) * 0.6); fp[i * 3 + 1] = y + (R ? 0 : Math.sin(now * 0.7 + p * 2) * 0.3); fp[i * 3 + 2] = z; }
        fg.attributes.position.needsUpdate = true; ff.material.opacity = R ? 0.7 : 0.45 + 0.35 * Math.sin(now * 2.5);
      },
      ui(k, t) { edK(D.ed, k * range(t, -0.05, 0.1) * (1 - range(t, 0.9, 1.0))); },
      dispose() { own.forEach((x) => x.dispose()); S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); },
    };
    return inst;
  },
};
