// Beat 4: Dormant Red teaser — a clay arcade cabinet in a dark neon arcade room, running a playable 10-second loop
// (game.js) in Dormant Red's dark-space colours. Play with arrows / WASD / drag; link out to itch.io.
import * as THREE from 'three';
import { clamp, lerp, range, canvas, tex, easeOut } from './util.js';
import { clay, rbox, room, rrShape, blob } from './mat.js';
import { headline, edK } from './ui.js';
import { makeGame } from './game.js';

const ITCH = 'https://rdwlabz.itch.io/dormant-red';

// centered composition: one-line title over the cabinet, the cabinet framed in the middle, a compact pill of copy + play below.
const CSS = `
.ar-ui{position:absolute;inset:0}
.ar-top{position:absolute;left:0;right:0;top:clamp(78px,10.5vh,104px);text-align:center}
.ar-top .wr-eyebrow{margin-bottom:6px}
.ar-top .wr-h{font-size:clamp(52px,5.6vw,92px)}
.ar-top .wr-h .ln>span{transform-origin:50% 100%}
.ar-foot{position:absolute;left:0;right:0;margin:0 auto;bottom:clamp(58px,8.5vh,76px);width:fit-content;max-width:calc(100vw - 32px);box-sizing:border-box;display:flex;align-items:center;gap:18px;
  padding:10px 10px 10px 24px;border-radius:999px;background:rgba(12,8,26,.78);border:1px solid rgba(255,240,235,.14);box-shadow:0 16px 40px rgba(0,0,0,.35)}
.ar-foot p{margin:0}
.ar-lead{max-width:340px;font-size:15px;line-height:1.4;color:rgba(255,240,235,.88)}
.ar-acts{display:flex;gap:8px;flex:none}
.ar-acts .wr-link{margin:0;min-height:44px}
@media (max-width:820px){
  .ar-top{top:128px}
  .ar-top .wr-h{font-size:clamp(42px,12vw,56px)}
  .ar-foot{left:16px;right:16px;width:auto;bottom:58px;flex-direction:column;align-items:stretch;gap:12px;padding:16px;border-radius:20px}
  .ar-acts .wr-link{flex:1;justify-content:center}
}
`;

function neon(text, col, w = 1024, h = 200) {
  const c = canvas(w, h), x = c.getContext('2d'); x.font = `${h * 0.72}px VT323`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = col; x.shadowBlur = 34; x.fillStyle = col; x.fillText(text, w / 2, h / 2 + 6); x.shadowBlur = 0; x.fillStyle = '#fff0ea'; x.fillText(text, w / 2, h / 2 + 6);
  return tex(c);
}

export default {
  id: 'arcade', name: 'Dormant Red',
  dom(el) {
    if (!document.getElementById('arCSS')) { const st = document.createElement('style'); st.id = 'arCSS'; st.textContent = CSS; document.head.appendChild(st); }
    el.innerHTML = `<div class="ar-ui"><div class="ar-top"><p class="wr-eyebrow fadeup">C:\\GAMES&gt; run dormant_red.exe</p>${headline('h2', ['Dormant <em>Red</em>'])}</div>
      <div class="ar-foot fadeup"><p class="ar-lead">A browser game about a dead space station and a shrinking oxygen bar. Free on itch.io.</p>
        <p class="ar-acts"><button type="button" class="wr-link ar-play" aria-pressed="false">▶ Play 10 s</button><a class="wr-link ghost" href="${ITCH}" target="_blank" rel="noopener">itch.io ↗</a></p></div></div>`;
    return { el, ed: el.querySelector('.ar-ui'), play: el.querySelector('.ar-play') };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), own = [], R = ctx.reduced;
    S.background = new THREE.Color('#0a0716'); S.fog = new THREE.Fog('#0a0716', 10, 30);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    const rm = room(S, { w: 26, d: 18, h: 9, floor: '#2a2140', wall: '#1d1838', floorY: -2.6 }); own.push(...rm.userData.own);
    S.add(new THREE.HemisphereLight('#6a5ad0', '#200a18', 0.5));
    const key = new THREE.SpotLight('#ff5a48', 60, 20, 0.6, 0.6, 1.4); key.position.set(-5, 5, 5); key.target.position.set(0, 0, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 4; S.add(key, key.target);
    const teal = new THREE.SpotLight('#40e0d0', 40, 20, 0.6, 0.7, 1.4); teal.position.set(6, 4, 3); teal.target.position.set(0, 0, 0); S.add(teal, teal.target);
    // neon signs on the back wall
    const n1 = neon('ARCADE', '#ff4a3a'); own.push(n1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.37), new THREE.MeshBasicMaterial({ map: n1, transparent: true, color: new THREE.Color(2, 2, 2), toneMapped: false, depthWrite: false, fog: false })); sign.position.set(3.9, 1.5, -5.9); sign.scale.setScalar(0.6); S.add(sign);
    const n2 = neon('PLAY 10 S', '#40e0d0', 512, 140); own.push(n2);
    const sign2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.7), new THREE.MeshBasicMaterial({ map: n2, transparent: true, color: new THREE.Color(1.8, 1.8, 1.8), toneMapped: false, depthWrite: false, fog: false })); sign2.visible = false; S.add(sign2);
    // the cabinet
    const cab = new THREE.Group(); cab.position.set(0, -2.6, -0.5); cab.rotation.y = -0.14; S.add(cab);
    const cabM = clay('#3B2F6E', { roughness: 0.45, clearcoat: 0.4 }), trimM = clay('#C2412E', { clearcoat: 0.4 });
    const body = new THREE.Mesh(rbox(2.0, 4.0, 1.6, 0.1), cabM); body.position.y = 2.0; body.castShadow = true; body.receiveShadow = true; cab.add(body);
    [-1.01, 1.01].forEach((x) => { const t = new THREE.Mesh(rbox(0.07, 4.02, 1.62, 0.03), trimM); t.position.set(x, 2.0, 0); cab.add(t); });
    const panel = new THREE.Mesh(rbox(1.9, 0.18, 0.85, 0.06), clay('#2B2560')); panel.position.set(0, 1.72, 1.05); panel.rotation.x = 0.35; panel.castShadow = true; cab.add(panel);
    const stick = new THREE.Group(); stick.position.set(-0.45, 1.86, 1.05); stick.rotation.x = 0.35; cab.add(stick);
    { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8), clay('#1a1a22')); s.position.y = 0.16; stick.add(s); const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), clay('#E2533B', { clearcoat: 0.6 })); b.position.y = 0.34; stick.add(b); }
    const btns = [[0.2, '#F2C94C'], [0.52, '#7FB069']].map(([x, c]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 20), clay(c, { clearcoat: 0.6 })); b.position.set(x, 1.84, 1.07); b.rotation.x = 0.35; cab.add(b); return b; });
    const game = makeGame(640, 480);
    const scrM = new THREE.ShaderMaterial({ toneMapped: false, uniforms: { map: { value: game.tex }, uT: { value: 0 }, uB: { value: 2.0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `uniform sampler2D map; uniform float uT, uB; varying vec2 vUv;
        void main(){ vec2 c = vUv - .5; vec2 uv = .5 + c * (1. + dot(c, c) * .18); vec3 col = texture2D(map, uv).rgb;
          col *= .86 + .14 * sin(gl_FragCoord.y * 1.6); col *= smoothstep(.75, .3, length(c * vec2(1., 1.2)));
          float m = step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);
          gl_FragColor = vec4(col * uB * m + vec3(.02,.03,.06), 1.); }` });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), scrM); scr.position.set(0, 2.9, 0.81); scr.rotation.x = -0.12; cab.add(scr);
    const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(rrShape(1.86, 1.46, 0.12, [1.6, 1.2, 0.14]), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), clay('#1d1838')); bezel.position.set(0, 2.9, 0.78); bezel.rotation.x = -0.12; cab.add(bezel);
    const mq = neon('DORMANT RED', '#ff4a3a', 1024, 220); own.push(mq);
    const marq = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 0.4), new THREE.MeshBasicMaterial({ map: mq, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false })); marq.position.set(0, 3.82, 0.82); cab.add(marq);
    const glow = new THREE.PointLight('#5b8cff', 4, 4, 1.6); glow.position.set(0, 2.9, 1.8); cab.add(glow);
    const sh = blob(2.8, 2.2, 0.7); sh.position.y = 0.01; cab.add(sh);
    // second, dark cabinet + stools for the room
    const cab2 = new THREE.Mesh(rbox(1.9, 3.8, 1.5, 0.1), clay('#2a2236')); cab2.position.set(-4.4, -0.7, -3.4); cab2.rotation.y = 0.35; cab2.castShadow = true; S.add(cab2);
    const scr2 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.0), new THREE.MeshBasicMaterial({ color: '#102040' })); scr2.position.set(-4.4 + Math.sin(0.35) * 0.76, 0.1, -3.4 + Math.cos(0.35) * 0.76); scr2.rotation.y = 0.35; S.add(scr2);
    [[-1.4, 1.6], [3.6, 1.4]].forEach(([x, z]) => { const st = new THREE.Group(); const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 24), clay('#C2412E')); seat.position.y = 1.1; seat.castShadow = true; st.add(seat); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.1, 10), clay('#1a1a22')); leg.position.y = 0.55; st.add(leg); st.position.set(x, -2.6, z); S.add(st); });
    // drifting dust in the neon
    const dust = (() => { const n = 120, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 14; p[i * 3 + 1] = Math.random() * 6 - 2.5; p[i * 3 + 2] = (Math.random() - 0.5) * 8; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.03, color: '#ffb0a0', transparent: true, opacity: 0.5, depthWrite: false })); })(); S.add(dust);

    // play controls
    const keys = {}; let playing = false;
    const setPlay = (on) => {
      if (on === playing) return; playing = on; D.play.setAttribute('aria-pressed', String(on)); D.play.textContent = on ? '■ Stop' : '▶ Play 10 s';
      if (on) game.start(); else game.stop(); ctx.api.lock(on); game.input.tx = null;
    };
    D.play.onclick = () => setPlay(!playing);
    const ray = new THREE.Raycaster(); let dragging = false;
    const axis = () => { game.input.x = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0); game.input.y = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0); };
    const toGame = (ndc) => { ray.setFromCamera(ndc, cam); const h = ray.intersectObject(scr, false)[0]; if (!h) return false; game.input.tx = h.uv.x * 640; game.input.ty = (1 - h.uv.y) * 480; return true; };
    let mob = false;
    const inst = {
      scene: S, cam, post: { lens: 0.75, border: 1, vig: 0.42, bloom: 0.62, con: 1.12, s: 0.35 }, phoneLift: 0.22,
      get hint() { return playing ? '<kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> or drag to steer · <kbd>Esc</kbd> stop' : 'press <kbd>Play</kbd> · scroll <span class="ar">↓</span>'; },
      layout(a, m) { cam.aspect = a; mob = m; cam.fov = m ? 60 : 40; cam.updateProjectionMatrix(); sign.visible = !m; },   // phone: the wall sign would sit under the chapter label
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0, now = performance.now() / 1000;
        const k = easeOut(range(t, 0, 0.45)), out = range(t, 0.8, 1.05);
        // walk up to the cabinet, then lean in a little at the hero moment
        // cabinet framed dead centre, title above it, the copy pill below
        cam.position.set(lerp(-3.5, mob ? 0.15 : 0.5, k) + mx * 0.4 + out * 2, lerp(2.4, 0.5, k) + my * 0.2, lerp(13, mob ? 10 : 10.2, k) + out * 2.5);
        cam.lookAt(0, lerp(0.6, mob ? 1.5 : -0.42, k), -0.5);
        game.update(dt, now);
        scrM.uniforms.uB.value = 2.0 * (R ? 1 : 0.97 + 0.03 * Math.sin(now * 40));
        stick.rotation.z = playing ? -game.input.x * 0.35 : (R ? 0 : Math.sin(now * 3) * 0.2); stick.rotation.x = 0.35 + (playing ? game.input.y * 0.3 : 0);
        btns.forEach((b, i) => { b.position.y = 1.84 - (playing && Math.floor(now * 4 + i) % 3 === 0 ? 0.02 : 0); });
        sign.material.color.setScalar(R ? 2 : 2 * (Math.sin(now * 23) > -0.92 ? 1 : 0.4));
        dust.rotation.y = R ? 0 : now * 0.02;
        if (playing && t > 0.95) setPlay(false);
      },
      ui(k, t) { edK(D.ed, k * range(t, -0.05, 0.12) * (1 - range(t, 0.9, 1.0))); if (k < 0.5 && playing) setPlay(false); },
      pointer(type, e, ndc, over) {
        if (!playing) { if (type === 'move') document.body.style.cursor = ''; return; }
        if (type === 'down' && !over) dragging = toGame(ndc) || dragging;
        else if (type === 'move' && (dragging || e.pointerType === 'mouse')) toGame(ndc);
        else if (type === 'up') { dragging = false; }
      },
      key(e) {
        if (e.key === 'Escape' && playing) { setPlay(false); return true; }
        if (!playing) return false;
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = true; game.input.tx = null; axis(); return true; }
        return false;
      },
      keyup(e) { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false; axis(); },
      dispose() { if (playing) setPlay(false); D.play.onclick = null; own.forEach((x) => x.dispose()); game.tex.dispose(); S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); },
    };
    return inst;
  },
};
