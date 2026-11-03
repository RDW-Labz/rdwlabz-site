// Beat 6: "Made in Harrison, Arkansas" — layered clay Ozark ridges at dusk, a river catching the last light, a few
// lit clay houses, fireflies, and a map pin that drops and settles. The camera then holds while home.js pulls back
// out through the glass to the desk.
import * as THREE from 'three';
import { clamp, lerp, range, rng, canvas, tex, rr, easeOut, backOut, TAU } from './util.js';
import { makeSky, stars, clay, rbox, rig, blob, cloudBank } from './mat.js';
import { headline, edK } from './ui.js';
import { CONTACT } from '../data.js';

function ridge(w, base, amp, seed, segs = 120) {
  const r = rng(seed), ph = [r() * TAU, r() * TAU, r() * TAU], s = new THREE.Shape();
  s.moveTo(-w / 2, -8);
  for (let i = 0; i <= segs; i++) { const x = -w / 2 + (w * i) / segs, u = x / w; const y = base + amp * (0.55 * Math.sin(u * 7 + ph[0]) + 0.3 * Math.sin(u * 15 + ph[1]) + 0.15 * Math.sin(u * 31 + ph[2])) * (0.75 + 0.25 * Math.cos(u * 3)); s.lineTo(x, y); }
  s.lineTo(w / 2, -8); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.16, bevelSegments: 3, curveSegments: 4 });
  return g;
}

export default {
  id: 'harrison', name: 'Harrison, AR',
  dom(el) {
    const st = document.createElement('style'); st.textContent = `
      .hr-low{position:absolute;left:50%;bottom:clamp(64px,9.5vh,92px);transform:translateX(-50%);width:min(980px,calc(100vw - 32px));text-align:center;color:#FFF6E8}
      .hr-low::before{content:"";position:absolute;left:50%;top:-50px;width:130%;height:calc(100% + 120px);transform:translateX(-50%);z-index:-1;opacity:var(--k,1);background:radial-gradient(closest-side,rgba(8,8,34,.62),rgba(8,8,34,0));pointer-events:none}
      .hr-low .wr-h{font-size:clamp(50px,5.8vw,98px);white-space:nowrap}
      .hr-low .wr-h .ln{display:inline-block}
      .hr-line{margin:14px auto 0;font-size:clamp(16px,1.25vw,19px);line-height:1.45;color:rgba(255,240,235,.9);text-shadow:0 1px 14px rgba(5,5,30,.95)}
      .hr-line b{font:500 .82em "JetBrains Mono",monospace;letter-spacing:.04em;color:#FFE0B0;white-space:nowrap}
      .hr-act{margin:4px 0 0}
      @media (max-width:820px){
        .hr-low{bottom:44px;left:16px;right:16px;width:auto;transform:none}
        .hr-low::before{width:150%;top:-80px}
        .hr-low .wr-h{font-size:clamp(42px,12vw,56px);white-space:normal}
        .hr-low .wr-h .ln{display:block}
        .hr-line{font-size:15px;margin-top:10px}
      }`;
    document.head.appendChild(st);
    el.innerHTML = `<div class="hr-low">${headline('h2', ['Made in <em>Harrison, Arkansas</em>'])}
      <p class="hr-line fadeup">A small Ozarks studio at <b>1301 N Main St, Harrison, AR 72601</b>. Everything here was made in town.</p>
      <p class="hr-act fadeup"><a class="wr-link" href="mailto:${CONTACT}">${CONTACT} <span aria-hidden="true">→</span></a></p></div>`;
    return { el, copy: el.querySelector('.hr-low') };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), own = [], R = ctx.reduced;
    const sky = makeSky({ c0: '#04031a', c1: '#1C2E84', c2: '#4A6CC0', c3: '#B9889A', c4: '#E2A07A', c5: '#E2A07A', horizon: -0.1 }); S.add(sky);
    // day -> dusk -> night palettes for the sky dome (c0..c5)
    const PALS = [['#3a6ad0', '#5a8ae0', '#9cc0f0', '#f0d8b8', '#ffe2b0', '#f0c890'], ['#1C2E84', '#4A6CC0', '#8a7ab8', '#B9889A', '#E2A07A', '#E2A07A'], ['#02021a', '#0a1250', '#1C2E84', '#3a3070', '#5a3a5a', '#3a2a4a']].map((p) => p.map((c) => new THREE.Color(c)));
    const skyU = sky.material.uniforms, keys = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5'];
    const st = stars(420, 61, 0.18, 0.55); S.add(st);
    S.fog = new THREE.Fog('#9a7f9c', 14, 46); const fogDay = new THREE.Color('#b8c8e0'), fogDusk = new THREE.Color('#9a7f9c'), fogNight = new THREE.Color('#1a1a40');
    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    const L = rig(S, { key: '#ffc8a0', keyPos: [10, 6, -14], area: 14, keyI: 1.5, hemiI: 0.6, rimI: 1.0, shadow: 0 });
    // low sun glow on the horizon (it sets as the scroll runs)
    let sunG = null;
    { const c = canvas(512, 256), x = c.getContext('2d'); x.translate(256, 128); x.scale(1, 0.5); const g = x.createRadialGradient(0, 0, 0, 0, 0, 256); g.addColorStop(0, 'rgba(255,214,170,.95)'); g.addColorStop(0.35, 'rgba(240,170,140,.4)'); g.addColorStop(1, 'rgba(200,140,150,0)'); x.fillStyle = g; x.fillRect(-256, -256, 512, 512); const t = tex(c); own.push(t);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(90, 26), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false })); m.position.set(6, -1, -60); S.add(m); sunG = m; }
    // moon
    const moon = new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFF0DC').multiplyScalar(1.6), fog: false })); moon.position.set(-14, 13, -50); S.add(moon);
    // ridges: far (hazy, light) to near (deep)
    const cols = ['#C79AA6', '#A385A6', '#7E74A6', '#56589A', '#373D80', '#252A62'];
    const ridges = cols.map((c, i) => { const m = new THREE.Mesh(ridge(80, 1.6 - i * 0.55, 2.6 - i * 0.25, 7 + i * 3), clay(c, { roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color('#ffc8a8') })); m.position.set(0, -2.5, -34 + i * 5.6); m.receiveShadow = true; S.add(m); return m; });
    // river ribbon in the valley, catching the sky
    { const pts = [[-12, 6], [-6, 3.2], [-2, 4.6], [2, 2.2], [6, 3.4], [12, 0.8]].map(([x, z]) => new THREE.Vector3(x, -3.0, z - 6));
      const cu = new THREE.CatmullRomCurve3(pts); const pp = cu.getSpacedPoints(80); const geo = new THREE.BufferGeometry(); const pos = [], uv = [], idx = [];
      pp.forEach((p, i) => { const tn = cu.getTangentAt(i / 80); const n = new THREE.Vector3(-tn.z, 0, tn.x).multiplyScalar(0.35 + 0.25 * Math.sin(i * 0.2)); pos.push(p.x + n.x, p.y, p.z + n.z, p.x - n.x, p.y, p.z - n.z); uv.push(i / 80, 0, i / 80, 1); if (i < 80) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); });
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const rm = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, fog: false, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
        fragmentShader: `uniform float uT; varying vec2 vUv; void main(){ float s = .5 + .5 * sin(vUv.x * 90. - uT * 2.); vec3 c = mix(vec3(.85,.6,.55), vec3(1.,.82,.66), s * smoothstep(.0,.5,vUv.y) * smoothstep(1.,.5,vUv.y)); gl_FragColor = vec4(c * 1.05, 1.); }` });
      const river = new THREE.Mesh(geo, rm); river.renderOrder = 2; S.add(river); S.userData.river = rm; }
    // valley floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), clay('#2e2f6c', { roughness: 0.95 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -3.05, -6); floor.receiveShadow = true; S.add(floor);
    // little town: clay houses with lit windows
    const town = new THREE.Group(); town.position.set(1.2, -3.0, -4.4); S.add(town);
    // the water tower: a simple original clay landmark
    const tower = new THREE.Group(); tower.position.set(-1.6, 0, -1.2); town.add(tower);
    { const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.7, 28), clay('#b8bcc8')); tk.position.y = 2.25; tk.castShadow = true; tower.add(tk);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 12, 0, TAU, 0, Math.PI / 2), clay('#9aa0b0')); cap.position.y = 2.6; cap.scale.y = 0.5; tower.add(cap);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 12, 0, TAU, Math.PI / 2, Math.PI / 2), clay('#9aa0b0')); bowl.position.y = 1.9; bowl.scale.y = 0.45; tower.add(bowl);
      [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.95, 8), clay('#6a6e80')); l.position.set(x * 1.1, 0.95, z * 1.1); l.rotation.set(z * 0.08, 0, -x * 0.08); tower.add(l); });
      const c = canvas(512, 128), x = c.getContext('2d'); x.fillStyle = '#2B2560'; x.font = '84px VT323'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('HARRISON', 256, 70); const tt = tex(c); own.push(tt);
      const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.625, 0.625, 0.3, 28, 1, true, -0.9, 1.8), new THREE.MeshStandardMaterial({ map: tt, transparent: true, roughness: 0.7 })); lab.position.y = 2.25; tower.add(lab);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff4a3a').multiplyScalar(3), toneMapped: false, fog: false })); beacon.position.y = 2.95; tower.add(beacon); tower.userData.beacon = beacon; }
    const r = rng(9); const winM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc27a').multiplyScalar(2.6), fog: false });
    const houses = [];
    for (let i = 0; i < 11; i++) {
      const h = new THREE.Group(); const w = 0.45 + r() * 0.35, ht = 0.35 + r() * 0.4;
      const body = new THREE.Mesh(rbox(w, ht, 0.45, 0.04), clay(['#E9C9A8', '#D7AC86', '#C99AAE', '#F2E6D2'][i % 4])); body.position.y = ht / 2; body.castShadow = true; h.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 0.32, 4), clay(['#8f4a3f', '#5a3f6e', '#3B2F6E'][i % 3])); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.7; roof.position.y = ht + 0.15; h.add(roof);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), winM); win.position.set(-w * 0.18, ht * 0.55, 0.228); h.add(win);
      if (w > 0.6) { const w2 = win.clone(); w2.position.x = w * 0.18; h.add(w2); }
      const a = (i / 11) * TAU * 0.9, rad = 0.6 + r() * 1.6; h.position.set(Math.cos(a) * rad * 1.5, 0, Math.sin(a) * rad * 0.6); h.rotation.y = (r() - 0.5) * 0.8;
      town.add(h); houses.push(h);
    }
    // trees: clay lollipops on the near hills
    for (let i = 0; i < 26; i++) { const t = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 6), clay('#5a3f3a')); tr.position.y = 0.15; t.add(tr);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.22 + r() * 0.12, 12, 10), clay(['#3f5a6e', '#4a4a7e', '#2f4a5e'][i % 3])); top.position.y = 0.42; top.scale.y = 1.25; t.add(top);
      t.position.set(-9 + r() * 18, -3.02, -1 - r() * 8); if (Math.abs(t.position.x - 1.2) < 2.6 && t.position.z < -2 && t.position.z > -6) t.position.x += 4; S.add(t); }
    // the pin
    const pin = new THREE.Group(); town.add(pin); pin.position.set(0, 0, 0.3);
    const pinM = clay('#E2533B', { clearcoat: 0.7, clearcoatRoughness: 0.2, roughness: 0.45 });
    { const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 20), pinM); head.position.y = 1.5; head.castShadow = true; pin.add(head);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.05, 32), pinM); cone.rotation.x = Math.PI; cone.position.y = 0.72; pin.add(cone);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), clay('#FFF0DE')); dot.position.set(0, 1.52, 0.33); dot.scale.z = 0.5; pin.add(dot); }
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.38, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd2a8').multiplyScalar(2), transparent: true, depthWrite: false, fog: false })); ripple.rotation.x = -Math.PI / 2; ripple.position.y = 0.04; town.add(ripple);
    const pinSh = blob(1.2, 1.2, 0.6); pinSh.position.y = 0.03; town.add(pinSh);
    const pinL = new THREE.PointLight('#ffb48a', 3, 5, 1.6); pinL.position.set(0, 2.2, 1.2); town.add(pinL);
    // fireflies
    const N = 70, fpos = new Float32Array(N * 3), fseed = []; for (let i = 0; i < N; i++) { fseed.push([r() * 16 - 8, r() * 1.6 - 2.8, -r() * 8 + 1, r() * TAU]); }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    const ft = (() => { const c = canvas(64, 64), x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(0.3, 'rgba(255,220,120,.5)'); g.addColorStop(1, 'rgba(255,200,100,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return tex(c, { srgb: false }); })(); own.push(ft);
    const ff = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.22, map: ft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(2.2, 1.9, 1.1), fog: false })); S.add(ff);
    const clouds = cloudBank(S, [[-14, 6, -40, 22, 0.22], [12, 8, -44, 24, 0.2], [0, 10, -48, 26, 0.12]]);
    const inst = {
      scene: S, cam, post: { lens: 0.8, border: 1, vig: 0.36, bloom: 0.45, con: 1.08, s: 0.3 }, phoneLift: 0.28,
      layout(a, m) { cam.aspect = a; inst.mob = m; cam.fov = m ? 58 : 50; cam.updateProjectionMatrix(); },
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0, now = performance.now() / 1000, tt = clamp(t);
        const k = easeOut(range(t, 0, 0.75));
        // day (0) -> dusk (0.45) -> night (0.85)
        const dn = R ? 0.6 : clamp(t / 0.85), a = clamp(dn / 0.5), b = clamp((dn - 0.5) / 0.5);
        keys.forEach((kk, i) => { skyU[kk].value.copy(PALS[0][i]).lerp(PALS[1][i], a).lerp(PALS[2][i], b); });
        S.fog.color.copy(fogDay).lerp(fogDusk, a).lerp(fogNight, b);
        L.key.intensity = lerp(2.6, 1.5, a) * lerp(1, 0.25, b); L.key.color.set('#fff0d8').lerp(new THREE.Color('#ffb07a'), a); L.hemi.intensity = lerp(1.1, 0.6, a) * lerp(1, 0.5, b);
        winM.color.set('#ffc27a').multiplyScalar(lerp(0.2, 2.6, clamp(dn * 1.6 - 0.4)));
        moon.material.color.set('#FFF0DC').multiplyScalar(lerp(0.2, 1.6, b)); sunG.material.opacity = 1 - b; sunG.position.y = lerp(4, -2, dn);
        tower.userData.beacon.visible = R || Math.sin(now * 3) > 0 || dn < 0.5;
        // desktop: centred on the town, low over the valley; the town sits in the upper-middle and the copy below it
        if (inst.mob) { cam.position.set(lerp(-1.5, 0.6, k) + mx * 0.6, lerp(3.4, 0.4, k) + my * 0.3, lerp(13, 7.2, k) + 2.2); cam.lookAt(lerp(0, 1.1, k), lerp(0.6, -2.0, k), -8); }
        else { cam.position.set(lerp(-0.4, 1.2, k) + mx * 0.5, lerp(3.0, -0.3, k) + my * 0.25, lerp(13, 5.6, k)); cam.lookAt(lerp(0.6, 1.2, k), lerp(0.2, -4.4, k), -8); }
        ridges.forEach((m, i) => { m.position.x = (R ? 0 : mx * (i - 3) * 0.12) + (tt - 0.5) * (5 - i) * 0.25; });
        // pin drop + bounce
        const pd = R ? 1 : range(t, 0.12, 0.34);
        pin.position.y = (1 - backOut(pd, 2.2)) * 6 + (pd >= 1 && !R ? Math.sin(now * 2) * 0.06 : 0);
        pin.rotation.y = R ? 0 : now * 0.6;
        const sq = pd > 0.55 && pd < 0.85 ? Math.sin((pd - 0.55) / 0.3 * Math.PI) * 0.18 : 0; pin.scale.set(1 + sq, 1 - sq, 1 + sq);
        const rp = R ? 0 : ((now * 0.6) % 1); ripple.scale.setScalar(1 + rp * 3); ripple.material.opacity = pd >= 1 ? (1 - rp) * 0.8 : 0;
        pinSh.material.opacity = 0.6 * pd;
        // fireflies drift and blink
        for (let i = 0; i < N; i++) { const [x, y, z, p] = fseed[i]; fpos[i * 3] = x + (R ? 0 : Math.sin(now * 0.4 + p) * 0.6); fpos[i * 3 + 1] = y + (R ? 0 : Math.sin(now * 0.7 + p * 2) * 0.3); fpos[i * 3 + 2] = z + (R ? 0 : Math.cos(now * 0.3 + p) * 0.5); }
        fg.attributes.position.needsUpdate = true; ff.material.opacity = (0.4 + 0.6 * range(t, 0.2, 0.5)) * (R ? 1 : 0.75 + 0.25 * Math.sin(now * 3));
        S.userData.river.uniforms.uT.value = R ? 0 : now;
        st.material.opacity = clamp((dn - 0.45) * 2);
        clouds.update(dt, R);
      },
      ui(k, t) { edK(D.copy, k * range(t, 0.04, 0.2) * (1 - range(t, 1.02, 1.3))); },
      dispose() { own.forEach((x) => x.dispose()); S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); },
    };
    return inst;
  },
};
