// Beat 5: Putt Drop — a single clay mini-hole in a golden-hour pocket park. Drag back from anywhere and release to putt
// (or press Putt for an assisted shot). Simple 2D physics on the green: friction, rail bounces, lip-outs, the drop.
import * as THREE from 'three';
import { clamp, lerp, range, easeOut, rng, TAU } from './util.js';
import { makeSky, clay, rbox, rig, cloudBank, blob } from './mat.js';
import { ed, edK } from './ui.js';
import { PLAY_URL } from '../data.js';

const GW = 6.4, GD = 3.0, BR = 0.1, CUP = new THREE.Vector2(2.3, 0.35), CR = 0.17, START = new THREE.Vector2(-2.5, -0.2), FR = 1.7;

export default {
  id: 'putt', name: 'Putt Drop',
  dom(el) {
    el.innerHTML = ed({ cls: 'right hint pt-ed', eyebrow: 'C:\\GAMES&gt; run putt_drop.apk', title: ['Putt', '<em>Drop</em>'],
      lead: 'One-thumb mini golf, out now on Google Play. Drag back anywhere on the green and release to putt.',
      second: 'No mouse? Press Putt for a fair shot.',
      acts: `<button type="button" class="wr-link pt-go">⛳ Putt</button><button type="button" class="wr-link ghost pt-reset">Reset</button><a class="wr-link ghost" href="${PLAY_URL}" target="_blank" rel="noopener">Get it on Google Play ↗</a>` });
    const live = document.createElement('p'); live.className = 'sr'; live.setAttribute('aria-live', 'polite'); el.appendChild(live);
    const badge = document.createElement('div'); badge.className = 'pt-badge'; badge.setAttribute('aria-hidden', 'true'); el.appendChild(badge);
    const st = document.createElement('style'); st.textContent = `
.pt-ed.wr-ed{right:clamp(40px,6vw,96px);width:min(400px,31vw)}
.pt-ed.wr-ed::before{inset:-30px -34px;border-radius:24px;background:rgba(10,10,30,.56);box-shadow:0 20px 50px rgba(5,5,30,.25)}
.pt-ed .wr-h{font-size:clamp(50px,5.2vw,88px)}
.pt-ed .acts .wr-link{padding:0 16px}
@media (max-width:820px){.pt-ed.wr-ed{right:0;width:auto}}
.pt-badge{position:absolute;left:50%;top:22%;transform:translate(-50%,-50%) scale(.6);font:400 clamp(48px,6vw,92px)/1 "Instrument Serif",serif;font-style:italic;color:#FFF6E8;text-shadow:0 6px 40px rgba(60,30,10,.6);opacity:0;transition:opacity .3s,transform .5s cubic-bezier(.2,.9,.25,1.4);pointer-events:none;white-space:nowrap}.pt-badge.on{opacity:1;transform:translate(-50%,-50%) scale(1)}`;
    document.head.appendChild(st);
    return { el, ed: el.querySelector('.wr-ed'), go: el.querySelector('.pt-go'), reset: el.querySelector('.pt-reset'), live, badge };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), R = ctx.reduced, r = rng(12);
    S.add(makeSky({ c0: '#2a3c8c', c1: '#5a78c8', c2: '#9fb4e0', c3: '#f2c49a', c4: '#ffd9a8', c5: '#e8a070', horizon: -0.05 }));
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    const L = rig(S, { key: '#ffc890', keyI: 2.6, keyPos: [-8, 5, 3], area: 7, hemiI: 0.4, rimI: 1.2 });
    const clouds = cloudBank(S, [[-10, 6, -24, 16, 0.6], [8, 7, -26, 18, 0.55], [0, 9, -30, 22, 0.4]], ['#ffe6cc', '#ffd2b0', '#fff0dc']);
    // park ground + green
    const ground = new THREE.Mesh(new THREE.CircleGeometry(22, 64), clay('#4a7040', { roughness: 0.9 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; S.add(ground);
    const greenShape = new THREE.Shape(); { const w = GW / 2 + 0.25, d = GD / 2 + 0.25, rr = 0.9; greenShape.moveTo(-w + rr, -d); greenShape.lineTo(w - rr, -d); greenShape.quadraticCurveTo(w, -d, w, -d + rr); greenShape.lineTo(w, d - rr); greenShape.quadraticCurveTo(w, d, w - rr, d); greenShape.lineTo(-w + rr, d); greenShape.quadraticCurveTo(-w, d, -w, d - rr); greenShape.lineTo(-w, -d + rr); greenShape.quadraticCurveTo(-w, -d, -w + rr, -d); }
    const green = new THREE.Mesh(new THREE.ExtrudeGeometry(greenShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.05, bevelSegments: 3 }), clay('#72b05e', { roughness: 0.85 }));
    green.rotation.x = -Math.PI / 2; green.position.y = 0; green.receiveShadow = true; S.add(green);
    const TOP = 0.17;
    // rails
    const railM = clay('#E9C9A8');
    [[0, -GD / 2 - 0.15, GW + 0.6, 0.18], [0, GD / 2 + 0.15, GW + 0.6, 0.18], [-GW / 2 - 0.15, 0, 0.18, GD + 0.12], [GW / 2 + 0.15, 0, 0.18, GD + 0.12]].forEach(([x, z, w, d]) => { const m = new THREE.Mesh(rbox(w, 0.22, d, 0.08), railM); m.position.set(x, TOP + 0.08, z); m.castShadow = true; S.add(m); });
    // cup, flag, tee mat
    const cup = new THREE.Mesh(new THREE.CircleGeometry(CR, 32), new THREE.MeshBasicMaterial({ color: '#0d0b10' })); cup.rotation.x = -Math.PI / 2; cup.position.set(CUP.x, TOP + 0.003, CUP.y); S.add(cup);
    const cupRim = new THREE.Mesh(new THREE.TorusGeometry(CR, 0.015, 8, 32), clay('#f6f0e6')); cupRim.rotation.x = Math.PI / 2; cupRim.position.set(CUP.x, TOP + 0.005, CUP.y); S.add(cupRim);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.4, 8), clay('#FFF6E8')); pole.position.set(CUP.x, TOP + 0.7, CUP.y); pole.castShadow = true; S.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3, 8, 1), new THREE.MeshStandardMaterial({ color: '#E2533B', side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(CUP.x + 0.24, TOP + 1.25, CUP.y); flag.castShadow = true; S.add(flag);
    const tee = new THREE.Mesh(rbox(0.6, 0.03, 0.6, 0.02), clay('#5a8a4a')); tee.position.set(START.x, TOP + 0.01, START.y); S.add(tee);
    // ball + aim arrow
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BR, 28, 20), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 0.7 })); ball.castShadow = true; S.add(ball);
    const bsh = blob(0.36, 0.36, 0.5); S.add(bsh);
    const arrow = new THREE.Group(); S.add(arrow); arrow.visible = false;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFE0B0').multiplyScalar(1.4), toneMapped: false })); shaft.rotation.z = -Math.PI / 2; arrow.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 16), shaft.material); head.rotation.z = -Math.PI / 2; arrow.add(head);
    // park props: bushes, lollipop trees, a bench, a little fence
    for (let i = 0; i < 16; i++) { const a = Math.PI + (i / 16) * Math.PI, rad = 7 + r() * 5, b = new THREE.Mesh(new THREE.SphereGeometry(0.5 + r() * 0.6, 18, 14), clay(['#5f8f4e', '#7aa860', '#4f7a44'][i % 3])); b.position.set(Math.cos(a) * rad, 0.3, Math.sin(a) * rad - 3); b.scale.y = 0.7; b.castShadow = true; S.add(b); }
    for (let i = 0; i < 7; i++) { const t = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.6, 8), clay('#7a5236')); tr.position.y = 0.8; t.add(tr); const top = new THREE.Mesh(new THREE.SphereGeometry(0.9 + r() * 0.4, 18, 14), clay(['#e8a070', '#c99aae', '#7aa860'][i % 3])); top.position.y = 2.1; top.castShadow = true; t.add(top); t.position.set(-9 + i * 3 + r(), 0, -7 - r() * 4); S.add(t); }
    { const bench = new THREE.Group(); const seat = new THREE.Mesh(rbox(1.8, 0.1, 0.5, 0.04), clay('#B97E58')); seat.position.y = 0.5; bench.add(seat); const back = new THREE.Mesh(rbox(1.8, 0.4, 0.08, 0.04), clay('#B97E58')); back.position.set(0, 0.85, -0.22); bench.add(back); [-0.8, 0.8].forEach((x) => { const l = new THREE.Mesh(rbox(0.08, 0.5, 0.45, 0.03), clay('#3a2a24')); l.position.set(x, 0.25, 0); bench.add(l); }); bench.position.set(-4.6, 0, -3.2); bench.rotation.y = 0.5; bench.traverse((m) => { if (m.isMesh) m.castShadow = true; }); S.add(bench); }
    for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(rbox(0.1, 0.6, 0.06, 0.03), clay('#FFF6E8')); p.position.set(-6 + i * 0.9, 0.3, 4.6); p.castShadow = true; S.add(p); }
    const shadowCam = L.key.shadow.camera; shadowCam.left = -6; shadowCam.right = 6; shadowCam.top = 6; shadowCam.bottom = -6; shadowCam.updateProjectionMatrix();

    // ---------------- physics ----------------
    const pos = START.clone(), vel = new THREE.Vector2(); let state = 'ready', strokes = 0, sink = 0, msgT = 0;
    const say = (m) => { D.live.textContent = m; };
    const badge = (txt) => { D.badge.textContent = txt; D.badge.classList.toggle('on', !!txt); };
    function reset() { pos.copy(START); vel.set(0, 0); state = 'ready'; strokes = 0; sink = 0; badge(''); say('Ball on the tee. Strokes: 0'); }
    function shoot(v) { if (state !== 'ready') return; vel.copy(v); state = 'rolling'; strokes++; say(`Stroke ${strokes}.`); }
    function assisted() { const d = CUP.clone().sub(pos), dist = d.length(); const sp = Math.sqrt(2 * FR * dist) * 1.06; shoot(d.normalize().multiplyScalar(sp)); }
    D.go.onclick = () => { if (state === 'done') reset(); assisted(); };
    D.reset.onclick = reset;
    function physics(dt) {
      if (state === 'rolling') {
        const sp = vel.length(); if (sp > 0) { const nsp = Math.max(0, sp - FR * dt); vel.multiplyScalar(nsp / sp); }
        pos.addScaledVector(vel, dt);
        const lx = GW / 2 - BR, lz = GD / 2 - BR;
        if (pos.x < -lx) { pos.x = -lx; vel.x = -vel.x * 0.7; } if (pos.x > lx) { pos.x = lx; vel.x = -vel.x * 0.7; }
        if (pos.y < -lz) { pos.y = -lz; vel.y = -vel.y * 0.7; } if (pos.y > lz) { pos.y = lz; vel.y = -vel.y * 0.7; }
        const dc = pos.distanceTo(CUP);
        if (dc < CR) {
          if (vel.length() < 2.4) { state = 'sinking'; sink = 0; }
          else { const n = pos.clone().sub(CUP).normalize(); vel.addScaledVector(n, 0.6); vel.multiplyScalar(0.85); }   // lip-out
        }
        if (vel.length() < 0.02 && state === 'rolling') { vel.set(0, 0); state = 'ready'; say(`Stopped. Strokes: ${strokes}. Drag again to putt.`); }
      } else if (state === 'sinking') {
        sink += dt; pos.lerp(CUP, Math.min(1, dt * 10));
        if (sink > 0.5) { state = 'done'; msgT = 3; badge(strokes === 1 ? 'Drop! In one.' : `Drop! ${strokes} strokes.`); say(strokes === 1 ? 'Hole in one.' : `In the cup in ${strokes} strokes.`); }
      } else if (state === 'done') { msgT -= dt; if (msgT <= 0) reset(); }
    }
    reset();
    // ---------------- input ----------------
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP), hit = new THREE.Vector3();
    let drag = null;
    const ground3 = (ndc) => { ray.setFromCamera(ndc, cam); return ray.ray.intersectPlane(plane, hit) ? new THREE.Vector2(hit.x, hit.z) : null; };
    let mob = false;
    const inst = {
      scene: S, cam, post: { lens: 0.7, border: 1, vig: 0.4, bloom: 0.3, con: 1.16, s: 0.45 }, phoneLift: 0.24,
      hint: '<kbd>drag back</kbd> and release to putt · scroll <span class="ar">↓</span>',
      layout(a, m) { cam.aspect = a; mob = m; cam.fov = m ? 62 : 38; cam.updateProjectionMatrix(); },
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0, now = performance.now() / 1000;
        const k = easeOut(range(t, 0, 0.42)), out = range(t, 0.82, 1.05);
        // desktop: the course fills the left ~60%, the copy panel sits clear on the right over the park
        cam.position.set(lerp(-6.5, mob ? -0.4 : 0.6, k) + mx * 0.4, lerp(7.5, mob ? 7.0 : 7.6, k) + my * 0.2 + out * 2, lerp(12, mob ? 7.6 : 8.8, k) + out * 3);
        cam.lookAt(mob ? 0 : 3.0, -0.6, mob ? 0 : 0.1);
        physics(Math.min(dt, 1 / 30));
        const sy = state === 'sinking' ? -sink * 0.4 : 0;
        ball.position.set(pos.x, TOP + BR + sy, pos.y); ball.rotation.z -= vel.x * dt / BR; ball.rotation.x += vel.y * dt / BR; ball.visible = state !== 'done';
        bsh.position.set(pos.x, TOP + 0.004, pos.y); bsh.visible = ball.visible;
        // flag waves; lifts a little when the ball drops
        const fp = flag.geometry.attributes.position; for (let i = 0; i < fp.count; i++) { const x0 = (i % 9) / 8; fp.setZ(i, R ? 0 : Math.sin(now * 4 - x0 * 3) * 0.05 * x0); } fp.needsUpdate = true;
        flag.position.y = TOP + 1.25 + (state === 'done' ? 0.1 : 0); pole.position.y = TOP + 0.7 + (state === 'done' ? 0.1 : 0);
        clouds.update(dt, R);
        if (drag && drag.cur) {
          const v = drag.start.clone().sub(drag.cur), pw = clamp(v.length(), 0, 2.4);
          arrow.visible = pw > 0.08; if (arrow.visible) { const ang = Math.atan2(v.y, v.x); arrow.position.set(pos.x, TOP + BR, pos.y); arrow.rotation.set(0, -ang, 0); const L2 = 0.3 + pw * 0.9; shaft.scale.y = L2; shaft.position.x = L2 / 2 + 0.12; head.position.x = L2 + 0.22; }
        } else arrow.visible = false;
      },
      ui(k, t) { edK(D.ed, k * range(t, -0.05, 0.12) * (1 - range(t, 0.9, 1.0))); if (k < 0.5) D.badge.classList.remove('on'); },
      pointer(type, e, ndc, over) {
        if (type === 'down' && !over) { if (state === 'done') reset(); if (state !== 'ready') return; const g = ground3(ndc); if (g) drag = { start: g, cur: g }; }
        else if (type === 'move') { if (drag) { const g = ground3(ndc); if (g) drag.cur = g; } document.body.style.cursor = over ? '' : (drag ? 'grabbing' : 'grab'); }
        else if (type === 'up' && drag) { const v = drag.start.clone().sub(drag.cur), pw = clamp(v.length(), 0, 2.4); drag = null; if (pw > 0.1) shoot(v.normalize().multiplyScalar(pw * 2.4)); }
      },
      key(e) { if ((e.key === 'Enter' || e.key === ' ') && document.activeElement === document.body) { if (state === 'done') reset(); assisted(); return true; } return false; },
      dispose() { D.go.onclick = null; D.reset.onclick = null; badge(''); document.body.style.cursor = ''; S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); },
    };
    return inst;
  },
};
