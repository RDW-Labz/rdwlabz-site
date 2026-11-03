// Beat 2: "What we build" — a long night workshop with three workbenches, flown past one by one under pendant lamps.
// SOFTWARE: clay-framed app windows whose charts stand out of the glass as 3D clay; a clay cursor clicks around.
// WEBSITES: two browser windows with our real Yottaify and Forge Pizza Co shots.
// GAMES: a Dormant Red arcade cabinet and a Putt Drop phone with a tiny golf ball rolling to the cup.
import * as THREE from 'three';
import { clamp, lerp, sstep, smoother, range, canvas, tex, rr, drawCover, grain, TAU, easeOut, backOut } from './util.js';
import { clay, rbox, rig, imageMat, blob, rrShape, room, pendant, nightWindow } from './mat.js';
import { ed, edK } from './ui.js';
import { makeGame } from './game.js';
import { keyArt } from './art.js';
import { PLAY_URL, PROJECTS } from '../data.js';
const LIVE_SITES = PROJECTS.filter((p) => p.cat === 'web' && p.url).length;

const ST = [0, 18, 36];                    // station x
const WIN = [[0.13, 0.4], [0.4, 0.68], [0.68, 1.01]];   // station windows in beat progress

// a workbench: wooden top with a coloured clay mat, four legs down to the floor (table surface at local y ~0.2)
function island(top, rock) {
  const g = new THREE.Group();
  const tp = new THREE.Mesh(rbox(6.6, 0.3, 3.5, 0.08), clay('#9c6a4a', { roughness: 0.6 })); tp.position.y = 0.05; tp.castShadow = true; tp.receiveShadow = true; g.add(tp);
  const mat = new THREE.Mesh(rbox(5.6, 0.04, 2.7, 0.03), clay(top, { roughness: 0.8 })); mat.position.y = 0.21; mat.receiveShadow = true; g.add(mat);
  [[-3, -1.5], [3, -1.5], [-3, 1.5], [3, 1.5]].forEach(([x, z]) => { const l = new THREE.Mesh(rbox(0.22, 1.35, 0.22, 0.05), clay(rock)); l.position.set(x, -0.72, z); l.castShadow = true; g.add(l); });
  const shelf = new THREE.Mesh(rbox(6.0, 0.08, 3.0, 0.03), clay(rock)); shelf.position.y = -0.95; shelf.receiveShadow = true; g.add(shelf);
  return g;
}

// clay app window: body, title bar with three dots, a screen plane (basic = it glows like a screen)
function appWin(w, h, body, t, { bar = '#2B2560', title = '' } = {}) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(rbox(w, h, 0.16, 0.1), clay(body, { roughness: 0.55, clearcoat: 0.3 })); b.castShadow = true; b.receiveShadow = true; g.add(b);
  const tb = new THREE.Mesh(rbox(w - 0.12, 0.2, 0.04, 0.05), clay(bar)); tb.position.set(0, h / 2 - 0.17, 0.08); g.add(tb);
  ['#E2533B', '#F2C94C', '#7FB069'].forEach((c, i) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), clay(c)); d.position.set(-w / 2 + 0.2 + i * 0.12, h / 2 - 0.17, 0.11); d.scale.z = 0.5; g.add(d); });
  if (title) { const c = canvas(512, 64), x = c.getContext('2d'); x.fillStyle = '#FFF0E0'; x.font = '40px VT323'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(title, 256, 34); const tt = tex(c);
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.2), new THREE.MeshBasicMaterial({ map: tt, transparent: true, depthWrite: false })); tl.position.set(0, h / 2 - 0.17, 0.105); g.add(tl); }
  const sw = w - 0.16, sh = h - 0.44;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), t.isTexture ? new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(0.86, 0.86, 0.86) }) : t); scr.position.set(0, -0.14, 0.081); g.add(scr);
  g.userData = { sw, sh, scr };
  return g;
}

function dashTex() {
  const W = 1024, H = 600, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#F7EFE4'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#2B2560'; x.fillRect(0, 0, 150, H);
  for (let i = 0; i < 6; i++) { x.fillStyle = i === 1 ? '#E2A07A' : 'rgba(255,240,230,.35)'; rr(x, 40, 70 + i * 70, 70, 14, 7); x.fill(); }
  x.fillStyle = '#E4D6C3'; rr(x, 190, 36, 260, 22, 11); x.fill(); rr(x, 190, 68, 160, 14, 7); x.fill();
  [['#4A6CC0', 190], ['#E2A07A', 465], ['#B9889A', 740]].forEach(([col, X]) => { x.fillStyle = '#FFFFFF'; rr(x, X, 110, 250, 110, 16); x.fill(); x.fillStyle = col; rr(x, X + 20, 132, 50, 50, 12); x.fill(); x.fillStyle = '#E4D6C3'; rr(x, X + 90, 140, 130, 16, 8); x.fill(); rr(x, X + 90, 170, 90, 12, 6); x.fill(); });
  x.fillStyle = '#FFFFFF'; rr(x, 190, 245, 800, 325, 18); x.fill();
  x.strokeStyle = '#EDE2D2'; x.lineWidth = 2; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(220, 290 + i * 60); x.lineTo(960, 290 + i * 60); x.stroke(); }
  return tex(c);
}
function lineTex() {
  const W = 640, H = 420, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#1F1B4A'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(160,170,255,.16)'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(30, 60 + i * 60); x.lineTo(W - 30, 60 + i * 60); x.stroke(); }
  x.fillStyle = 'rgba(255,230,210,.35)'; rr(x, 30, 22, 160, 16, 8); x.fill();
  return tex(c);
}
function toggleTex() {
  const W = 512, H = 420, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#F3E7D3'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) { x.fillStyle = '#D9C7AE'; rr(x, 34, 50 + i * 120, 170, 18, 9); x.fill(); rr(x, 34, 80 + i * 120, 110, 12, 6); x.fill(); }
  return tex(c);
}
function browserTex(im, url) {
  const W = 1280, H = 860, c = canvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#EDE0CC'; x.fillRect(0, 0, W, 60);
  x.fillStyle = '#FFF8EE'; rr(x, 140, 12, 760, 38, 19); x.fill();
  x.fillStyle = '#6B5640'; x.font = '26px "JetBrains Mono"'; x.textBaseline = 'middle'; x.fillText('🔒 ' + url, 166, 32);
  ['#E2533B', '#F2C94C', '#7FB069'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(30 + i * 30, 31, 9, 0, TAU); x.fill(); });
  drawCover(x, im, 0, 60, W, H - 60, { fy: 0 }); grain(x, W, H, 6, 4);
  return tex(c);
}

export default {
  id: 'build', name: 'What we build',
  dom(el) {
    el.innerHTML = ed({ cls: 'top bd-intro', eyebrow: 'C:\\LAB&gt; dir /what', title: ['What we', '<em>build</em>'],
        lead: 'Three kinds of work leave this bench: software people use daily, websites that say it in one look, and games we would play ourselves.',
        second: 'Everything on these benches is something we actually built; the screenshots are real captures.',
        stat: ['3', 'kinds of work on the bench'], fig: 'Fig. 2 — the night shift' }) +
      ed({ cls: 'bd-s0', eyebrow: '01 · SOFTWARE', tag: 'h3', title: ['Software', '<em>that runs</em>'],
        lead: 'Apps, dashboards and back ends a business opens every morning. Simple enough that nobody needs a manual.',
        second: 'Some of this work we build together with our partner, Verrow AI.',
        stat: ['1', 'bench, from sketch to shipped'], fig: 'Fig. 2a — a dashboard, in clay' }) +
      ed({ cls: 'right bd-s1', eyebrow: '02 · WEBSITES', tag: 'h3', title: ['Websites', '<em>with a pulse</em>'],
        lead: 'Fast, to-the-point sites. On this bench: Yottaify, a GPU cloud landing page, and Forge Pizza Co, a wood-fired pizza spot in Harrison. Both live, both real captures. The rest are on the work ring.',
        stat: [String(LIVE_SITES), 'live sites in the work ring'], fig: 'Fig. 2b — two browsers, real pages',
        acts: '<a class="wr-link" href="https://yottaify.com/" target="_blank" rel="noopener">Yottaify ↗</a><a class="wr-link ghost" href="https://forgepizzaco.com/" target="_blank" rel="noopener">Forge Pizza Co ↗</a>' }) +
      ed({ cls: 'right bd-s2', eyebrow: '03 · GAMES', tag: 'h3', title: ['Games', '<em>to play</em>'],
        lead: 'Dormant Red is free on itch.io. Putt Drop is one-thumb mini golf, out now on Google Play.',
        second: 'You can play both a little further down.',
        stat: ['2', 'games live'], fig: 'Fig. 2c — the arcade corner',
        acts: `<a class="wr-link" href="https://rdwlabz.itch.io/dormant-red" target="_blank" rel="noopener">Play Dormant Red ↗</a><a class="wr-link ghost" href="${PLAY_URL}" target="_blank" rel="noopener">Putt Drop on Google Play ↗</a>` });
    return { el, parts: ['.bd-intro', '.bd-s0', '.bd-s1', '.bd-s2'].map((s) => el.querySelector(s)) };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), own = [];
    S.background = new THREE.Color('#0b0a1c'); S.fog = new THREE.Fog('#0b0a1c', 18, 46);
    const rm = room(S, { w: 66, d: 22, h: 10, cx: 18, cz: -4, floorY: -2.6, floor: '#5a3e2c', wall: '#232454' }); own.push(...rm.userData.own);
    ST.forEach((x, i) => { const w = nightWindow(S, x + (i === 1 ? -3.6 : 3.6), 3.6, -5.94, 3.2, 2.5, { seed: 3 + i }); own.push(...w.userData.own); });
    // wall shelves with jars and spools between the windows
    [9, 27].forEach((x) => { const sh = new THREE.Mesh(rbox(4.2, 0.14, 0.6, 0.04), clay('#7a5236')); sh.position.set(x, 2.4, -5.65); sh.castShadow = true; S.add(sh);
      ['#E2A07A', '#8E9BE0', '#F2C94C', '#C99AAE', '#7FB069'].forEach((c, k) => { const j = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42 + (k % 2) * 0.2, 16), clay(c)); j.position.set(x - 1.6 + k * 0.8, 2.7 + (k % 2) * 0.1, -5.6); j.castShadow = true; S.add(j); }); });
    const lamps = ST.map((x) => pendant(S, x, 4.6, 0.4, { intensity: 46, shadow: true, angle: 0.9, target: new THREE.Vector3(x, -1, 0.2) }));
    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
    const L = rig(S, { key: '#9fb4ff', keyPos: [-5, 9, 7], area: 8, keyI: 0.55, hemiI: 0.22, rimI: 0.6, shadow: 0 });
    const clouds = { update() {} };
    const groups = ST.map((x, i) => { const g = new THREE.Group(); g.position.x = x; S.add(g); const is = island(['#8E9BE0', '#E9B48E', '#C99AAE'][i], ['#6c5a8c', '#9c6a58', '#7d5a74'][i]); is.position.y = -1.3; g.add(is); return g; });
    // floating clay bits between the islands: they stream past during the fly-overs
    const bits = [];
    // ---------- SOFTWARE ----------
    const sw = groups[0]; const dT = dashTex(), lT = lineTex(), tT = toggleTex(); own.push(dT, lT, tT);
    const dash = appWin(3.6, 2.4, '#F3E7D3', dT, { title: 'dashboard' }); dash.position.set(-0.3, 1.0, 0); dash.rotation.y = 0.12; sw.add(dash);
    const bars = []; { const { sw: W2, sh: H2 } = dash.userData; const cols = ['#4A6CC0', '#E2A07A', '#B9889A', '#4A6CC0', '#E2A07A', '#7FB069', '#B9889A'];
      const base = -0.14 - H2 / 2 + H2 * (35 / 600); const left = -W2 / 2 + W2 * (230 / 1024), span = W2 * (720 / 1024);
      [0.35, 0.6, 0.45, 0.8, 0.55, 0.95, 0.7].forEach((v, i) => { const b = new THREE.Mesh(rbox(0.22, 1, 0.22, 0.05), clay(cols[i])); b.castShadow = true; b.position.set(left + span * (i + 0.5) / 7, base, 0.2); b.userData = { v: v * H2 * 0.52, base }; dash.add(b); bars.push(b); }); }
    const lw = appWin(2.1, 1.5, '#2B2560', lT, { bar: '#4A3F8F', title: 'signal' }); lw.position.set(2.15, 2.1, -0.9); lw.rotation.y = -0.3; sw.add(lw);
    const pts = [0.1, 0.35, 0.25, 0.55, 0.45, 0.75, 0.62, 0.9].map((v, i, a) => new THREE.Vector3(-0.85 + i * 1.7 / (a.length - 1), -0.62 + v * 0.8, 0.18));
    const lineCurve = new THREE.CatmullRomCurve3(pts); const lineMesh = new THREE.Mesh(new THREE.TubeGeometry(lineCurve, 80, 0.03, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFC48A').multiplyScalar(2.2) })); lw.add(lineMesh);
    const dots = pts.map((p) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), clay('#FFE0B0')); d.position.copy(p); lw.add(d); return d; });
    const tw = appWin(1.6, 1.45, '#F3E7D3', tT, { bar: '#B9889A', title: 'settings' }); tw.position.set(-2.4, 2.3, -0.7); tw.rotation.y = 0.35; sw.add(tw);
    const toggles = [0, 1, 2].map((i) => { const g = new THREE.Group(); g.position.set(0.32, 0.38 - i * 0.29 - 0.14, 0.12); const pill = new THREE.Mesh(rbox(0.42, 0.2, 0.08, 0.1), clay('#D8C7B0', { unique: true })); g.add(pill); const k = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), clay('#FFF6E8')); k.position.z = 0.05; k.castShadow = true; g.add(k); tw.add(g); return { g, pill, k, on: i !== 1 }; });
    const donut = new THREE.Group(); donut.position.set(2.5, 0.25, 0.9); sw.add(donut);
    [[0.42, '#4A6CC0'], [0.28, '#E2A07A'], [0.18, '#B9889A'], [0.12, '#7FB069']].reduce((a0, [f, c]) => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 14, 40, f * TAU - 0.06), clay(c)); m.rotation.z = a0; m.castShadow = true; donut.add(m); return a0 + f * TAU; }, 0);
    donut.rotation.x = -0.5;
    const cursor = new THREE.Mesh(new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, -0.42); s.lineTo(0.1, -0.32); s.lineTo(0.18, -0.5); s.lineTo(0.25, -0.46); s.lineTo(0.17, -0.29); s.lineTo(0.3, -0.29); s.closePath(); return s; })(), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 }), clay('#FFF6E8')); cursor.castShadow = true; sw.add(cursor);
    // ---------- WEBSITES ----------
    const wb = groups[1];
    const yT = browserTex(ctx.images[2], 'yottaify.com'), fT = browserTex(ctx.images[5], 'forgepizzaco.com'); own.push(yT, fT);
    const mkBrowser = (t, w) => { const h = w * 860 / 1280; const g = new THREE.Group(); const b = new THREE.Mesh(rbox(w + 0.2, h + 0.2, 0.18, 0.12), clay('#F1E3CE', { roughness: 0.5, clearcoat: 0.35 })); b.castShadow = true; b.receiveShadow = true; g.add(b);
      const m = imageMat(t, { bright: 1.0 }); m.uniforms.uZoom.value = 1; const sc = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); sc.position.z = 0.092; g.add(sc); g.userData.m = m;
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 12), clay('#9c6a58')); stand.position.y = -h / 2 - 0.6; stand.castShadow = true; g.add(stand); return g; };
    const by = mkBrowser(yT, 3.6); by.position.set(-1.1, 1.35, -0.6); by.rotation.y = 0.28; wb.add(by);
    const bf = mkBrowser(fT, 3.0); bf.position.set(1.7, 0.95, 0.9); bf.rotation.y = -0.22; wb.add(bf);
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 32), clay('#E2A07A')); badge.rotation.x = Math.PI / 2; badge.position.set(3.25, 2.25, 1.2); badge.castShadow = true; wb.add(badge);
    { const c = canvas(128, 128), x = c.getContext('2d'); x.strokeStyle = '#1A120A'; x.lineWidth = 12; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(40, 88); x.lineTo(88, 40); x.moveTo(52, 40); x.lineTo(88, 40); x.lineTo(88, 76); x.stroke(); const t = tex(c); own.push(t); const f = new THREE.Mesh(new THREE.CircleGeometry(0.3, 32), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.7 })); f.position.set(3.25, 2.25, 1.26); wb.add(f); badge.userData.face = f; }
    // ---------- GAMES ----------
    const gm = groups[2];
    const cab = new THREE.Group(); cab.position.set(-1.6, -2.6, -2.5); cab.rotation.y = 0.18; gm.add(cab);
    const cabM = clay('#3B2F6E', { roughness: 0.5, clearcoat: 0.3 }), trimM = clay('#C2412E');
    const body = new THREE.Mesh(rbox(1.7, 3.3, 1.3, 0.08), cabM); body.position.y = 1.65; body.castShadow = true; body.receiveShadow = true; cab.add(body);
    [-0.86, 0.86].forEach((x) => { const t = new THREE.Mesh(rbox(0.06, 3.32, 1.32, 0.03), trimM); t.position.set(x, 1.65, 0); cab.add(t); });
    const panel = new THREE.Mesh(rbox(1.6, 0.16, 0.7, 0.05), clay('#2B2560')); panel.position.set(0, 1.42, 0.85); panel.rotation.x = 0.35; panel.castShadow = true; cab.add(panel);
    const stick = new THREE.Group(); stick.position.set(-0.35, 1.55, 0.85); stick.rotation.x = 0.35; cab.add(stick);
    { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8), clay('#1a1a22')); s.position.y = 0.14; stick.add(s); const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), clay('#E2533B', { clearcoat: 0.6 })); b.position.y = 0.3; stick.add(b); }
    [[0.15, '#F2C94C'], [0.42, '#7FB069']].forEach(([x, c]) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 20), clay(c, { clearcoat: 0.6 })); b.position.set(x, 1.53, 0.86); b.rotation.x = 0.35; cab.add(b); });
    const game = makeGame(640, 480); own.push(game.tex);   // the cabinet plays our 3 s attract loop
    const drM = imageMat(game.tex, { bright: 1.5 }); drM.uniforms.uZoom.value = 1;
    const drShot = tex(keyArt(ctx.images[1], ctx.projects[1], 960, 720, { poster: false })); own.push(drShot);   // the real Dormant Red screen, lifted
    const crt = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.02), drM); crt.position.set(0, 2.35, 0.655); crt.rotation.x = -0.12; cab.add(crt);
    const bezel = new THREE.Mesh(new THREE.ExtrudeGeometry(rrShape(1.6, 1.26, 0.1, [1.36, 1.02, 0.12]), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), clay('#1d1838')); bezel.position.set(0, 2.35, 0.63); bezel.rotation.x = -0.12; cab.add(bezel);
    const marqT = (() => { const c = canvas(1024, 220), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, '#2a0f18'); g.addColorStop(1, '#14060c'); x.fillStyle = g; x.fillRect(0, 0, 1024, 220);
      x.font = '150px VT323'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = '#ff4a3a'; x.shadowBlur = 30; x.fillStyle = '#ff6a50'; x.fillText('DORMANT RED', 512, 116); x.shadowBlur = 0; x.fillStyle = '#ffd2c0'; x.fillText('DORMANT RED', 512, 116); return tex(c); })(); own.push(marqT);
    const marq = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.34), new THREE.MeshBasicMaterial({ map: marqT, color: new THREE.Color(1.6, 1.6, 1.6) })); marq.position.set(0, 3.1, 0.66); cab.add(marq);
    const marqBox = new THREE.Mesh(rbox(1.72, 0.44, 0.3, 0.06), cabM); marqBox.position.set(0, 3.1, 0.5); cab.add(marqBox);
    const glowL = new THREE.PointLight('#ff6a50', 2.2, 3.5, 1.8); glowL.position.set(0, 2.6, 1.4); cab.add(glowL);
    // Putt Drop phone + clay putting green
    const ph = new THREE.Group(); ph.position.set(1.75, 0.55, 0.4); ph.rotation.set(-0.12, -0.35, 0.06); gm.add(ph);
    const pBody = new THREE.Mesh(rbox(1.08, 2.0, 0.12, 0.16, 4), clay('#F2E6D2', { roughness: 0.45, clearcoat: 0.5 })); pBody.castShadow = true; ph.add(pBody);
    const pdT = (() => { const c = canvas(540, 960), x = c.getContext('2d'); drawCover(x, ctx.images[4], 0, 0, 540, 960); return tex(c); })(); own.push(pdT);
    const pdM = imageMat(pdT, { bright: 1.0 }); pdM.uniforms.uZoom.value = 1;
    const pScr = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 1.67), pdM); pScr.position.z = 0.062; ph.add(pScr);
    const green = new THREE.Group(); green.position.set(1.6, -1.12, 1.9); gm.add(green);
    const gShape = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, 0.12, 48), clay('#7FB069')); gShape.scale.z = 0.62; gShape.receiveShadow = true; gShape.castShadow = true; green.add(gShape);
    const cup = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), new THREE.MeshBasicMaterial({ color: '#141018' })); cup.rotation.x = -Math.PI / 2; cup.position.set(0.62, 0.065, -0.1); green.add(cup);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), clay('#FFF6E8')); pole.position.set(0.62, 0.4, -0.1); green.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshStandardMaterial({ color: '#E2533B', side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(0.75, 0.66, -0.1); green.add(flag);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.35, clearcoat: 0.6 })); ball.castShadow = true; green.add(ball);
    const ballPath = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.8, 0.13, 0.25), new THREE.Vector3(-0.3, 0.13, 0.3), new THREE.Vector3(0.2, 0.13, 0.05), new THREE.Vector3(0.62, 0.13, -0.1)]);

    // ---------- secondary props per bench ----------
    { // software: mug, keyboard, sticky notes
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.42, 20), clay('#7FA88E')); mug.position.set(-2.4, -0.88, 0.9); mug.castShadow = true; sw.add(mug);
      const kb = new THREE.Mesh(rbox(2.0, 0.1, 0.6, 0.05), clay('#E9D6B8')); kb.position.set(0.2, -1.02, 1.1); kb.castShadow = true; sw.add(kb);
      for (let i = 0; i < 14; i++) { const k = new THREE.Mesh(rbox(0.11, 0.06, 0.11, 0.02), clay('#FFF6E8')); k.position.set(-0.55 + (i % 7) * 0.13, -0.95, 0.98 + Math.floor(i / 7) * 0.15); sw.add(k); }
      ['#F2C94C', '#E39B8C', '#A7C4A0'].forEach((c, i) => { const n = new THREE.Mesh(rbox(0.5, 0.5, 0.02, 0.02), clay(c)); n.position.set(2.0 + i * 0.6, -1.07, 1.2 - i * 0.2); n.rotation.set(-Math.PI / 2, 0, 0.2 - i * 0.2); sw.add(n); }); }
    { // websites: a phone showing the Forge page, colour swatches
      const p2 = new THREE.Group(); p2.position.set(-2.4, -0.55, 1.0); p2.rotation.set(-0.5, 0.4, 0); wb.add(p2);
      p2.add(new THREE.Mesh(rbox(0.5, 0.95, 0.06, 0.08), clay('#2a2236')));
      const pt = (() => { const c = canvas(270, 520), x = c.getContext('2d'); drawCover(x, ctx.images[5], 0, 0, 270, 520, { fx: 0.32 }); return tex(c); })(); own.push(pt);
      const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.86), new THREE.MeshBasicMaterial({ map: pt })); ps.position.z = 0.032; p2.add(ps);
      ['#1C2E84', '#E2A07A', '#d8f070', '#141018'].forEach((c, i) => { const sw2 = new THREE.Mesh(rbox(0.36, 0.03, 0.52, 0.02), clay(c)); sw2.position.set(2.1 + i * 0.22, -1.06 + i * 0.03, 1.15); sw2.rotation.y = 0.3 - i * 0.12; wb.add(sw2); }); }
    { // games: a clay controller and a stack of floppies
      const ctl = new THREE.Group(); ctl.position.set(-0.4, -0.95, 1.2); ctl.rotation.y = 0.3; gm.add(ctl);
      const cb = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 6, 16), clay('#3B2F6E')); cb.rotation.z = Math.PI / 2; cb.scale.z = 0.6; cb.castShadow = true; ctl.add(cb);
      [['#E2533B', 0.22, 0.05], ['#F2C94C', 0.36, -0.06]].forEach(([c, x, z]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), clay(c)); b.position.set(x, 0.12, z); ctl.add(b); });
      const dp = new THREE.Mesh(rbox(0.18, 0.05, 0.18, 0.02), clay('#1a1a22')); dp.position.set(-0.3, 0.12, 0); ctl.add(dp);
      ['#2B2560', '#C2412E', '#4A6CC0'].forEach((c, i) => { const f = new THREE.Mesh(rbox(0.6, 0.05, 0.6, 0.02), clay(c)); f.position.set(-2.0, -1.03 + i * 0.055, 0.7 + i * 0.02); f.rotation.y = i * 0.12; f.castShadow = true; gm.add(f); }); }
    const cp = new THREE.Vector3(), cl = new THREE.Vector3(); let mob = false, asp = 1;
    // camera stops: [pos, look] per stop, relative offsets; desktop puts the copy beside the props
    function stop(i) {
      if (i < 0) return mob ? [new THREE.Vector3(18, 9, 52), new THREE.Vector3(18, -1.5, 0)] : [new THREE.Vector3(12.5, 6.0, 34), new THREE.Vector3(12.2, 1.4, 0)];
      const x = ST[i], side = i === 0 ? -1 : 1, sh = i === 2 ? 3.1 : i === 1 ? 3.1 : 2.2, dz = i === 1 ? 10.8 : 9.4;   // copy on the left for 0 and 2, right for 1
      return mob ? (i === 2 ? [new THREE.Vector3(x + 0.3, 0.6, 15.5), new THREE.Vector3(x + 0.3, -1.4, 0)] : [new THREE.Vector3(x, 2.2, 13.5), new THREE.Vector3(x, 1.75, 0)]) : [new THREE.Vector3(x + side * 1.2, 1.6, dz), new THREE.Vector3(x + side * sh, 0.9, 0)];
    }
    const inst = {
      scene: S, cam, post: { lens: 0.85, border: 1, vig: 0.42, bloom: 0.5, con: 1.12, s: 0.4 }, phoneLift: 0.24,
      layout(a, m) { cam.aspect = a; asp = a; mob = m; cam.fov = m ? 50 : (a < 1.3 ? 48 : 42); cam.updateProjectionMatrix(); },
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0, now = performance.now() / 1000, R = ctx.reduced;
        // camera: intro wide shot -> hold at each station -> fly to the next with a pull-back arc and a bank
        const k0 = smoother(range(t, 0.04, 0.16)), k1 = smoother(range(t, 0.36, 0.44)), k2 = smoother(range(t, 0.64, 0.72));
        const [p0, l0] = stop(-1), [p1, l1] = stop(0), [p2, l2] = stop(1), [p3, l3] = stop(2);
        cp.copy(p0).lerp(p1, k0); cl.copy(l0).lerp(l1, k0);
        if (k1 > 0) { cp.lerp(p2, k1); cl.lerp(l2, k1); } if (k2 > 0) { cp.lerp(p3, k2); cl.lerp(l3, k2); }
        const arc = Math.sin(k1 * Math.PI) + Math.sin(k2 * Math.PI);
        cp.z += arc * 3.2; cp.y += arc * 0.8;
        // slow drift inside each hold so the stations keep moving under scroll
        const hold = (w) => range(t, w[0], w[1]);
        const drift = t < 0.4 ? hold(WIN[0]) : t < 0.68 ? hold(WIN[1]) : hold(WIN[2]);
        cp.x += (drift - 0.5) * 1.1; cp.z -= drift * 0.8;
        cam.position.set(cp.x + mx * 0.45, cp.y + my * 0.3, cp.z); cam.lookAt(cl);
        cam.rotateZ(((k1 - (k1 > 0 && k1 < 1 ? 0 : 0)) * (1 - k1) + k2 * (1 - k2)) * -0.35);
        // software: bars grow, line draws in, toggles flip, cursor tours
        const s0 = range(t, 0.1, 0.34);
        bars.forEach((b, i) => { const g = R ? 1 : backOut(clamp(s0 * 1.6 - i * 0.08), 1.3); const h = Math.max(0.01, b.userData.v * g); b.scale.y = h; b.position.y = b.userData.base + h / 2; });
        const dl = R ? 1 : clamp(s0 * 1.5); lineMesh.geometry.setDrawRange(0, Math.floor(dl * lineMesh.geometry.index.count / 3) * 3); dots.forEach((d, i) => d.scale.setScalar(dl > i / dots.length ? 1 : 0.001));
        toggles.forEach((tg, i) => { const on = s0 > 0.3 + i * 0.15 ? !tg.on : tg.on; const k = tg.kk = lerp(tg.kk ?? (tg.on ? 1 : 0), on ? 1 : 0, 1 - Math.exp(-dt * 12)); tg.k.position.x = lerp(-0.11, 0.11, k); tg.pill.material.color.set('#D8C7B0').lerp(new THREE.Color('#7FB069'), k); });
        donut.rotation.z = R ? 0 : now * 0.3 + s0 * 2;
        { const route = [[-0.2, 0.6, 0.5], [0.9, 0.3, 0.6], [-2.2, 2.0, 0.2], [2.1, 2.0, -0.4], [-0.2, 0.6, 0.5]], u = (R ? 0.2 : (s0 * 1.4 + now * 0.05)) % 1 * (route.length - 1), a = Math.floor(u), f = u - a, e = f * f * (3 - 2 * f);
          cursor.position.set(lerp(route[a][0], route[a + 1][0], e), lerp(route[a][1], route[a + 1][1], e) + 0.25, lerp(route[a][2], route[a + 1][2], e) + 0.6); cursor.scale.setScalar(f > 0.92 ? 0.85 : 1); }
        dash.position.y = 1.0 + (R ? 0 : Math.sin(now * 0.8) * 0.04); lw.position.y = 2.1 + (R ? 0 : Math.sin(now * 0.7 + 1) * 0.05); tw.position.y = 2.3 + (R ? 0 : Math.sin(now * 0.9 + 2) * 0.05);
        // websites: pages scroll a little inside the browser, badge spins
        const s1 = range(t, 0.38, 0.68);
        by.userData.m.uniforms.uZoom.value = 0.86; bf.userData.m.uniforms.uZoom.value = 0.86;
        by.userData.m.uniforms.uOff.value.set(0, R ? 0 : 0.07 * Math.cos(now * 0.45 + s1 * 3)); bf.userData.m.uniforms.uOff.value.set(0, R ? 0 : 0.07 * Math.cos(now * 0.38 + 1.5 - s1 * 3));   // pages scroll by.userData.m.uniforms.uSheen.value = s1 - 0.5; bf.userData.m.uniforms.uSheen.value = 0.5 - s1;
        by.rotation.y = 0.28 + (s1 - 0.5) * 0.12; bf.rotation.y = -0.22 - (s1 - 0.5) * 0.1; by.position.y = 1.35 + (R ? 0 : Math.sin(now * 0.7) * 0.05);
        badge.rotation.y = R ? 0 : now * 1.2; badge.userData.face.rotation.y = badge.rotation.y; badge.userData.face.position.set(3.25 + Math.sin(badge.rotation.y) * 0.06, 2.25, 1.2 + Math.cos(badge.rotation.y) * 0.06);
        // games: ball rolls to the cup on a loop, stick wiggles, the CRT flickers
        const s2 = range(t, 0.66, 1.0);
        const bt = R ? 1 : ((now * 0.32 + s2 * 1.5) % 1.25);
        if (bt < 1) { const e = 1 - Math.pow(1 - bt, 2.2); ballPath.getPointAt(e, ball.position); ball.rotation.z -= dt * 6 * (1 - e); ball.visible = true; }
        else { ball.position.set(0.62, 0.13 - (bt - 1) * 0.6, -0.1); ball.visible = bt < 1.08; }
        flag.rotation.y = R ? 0 : Math.sin(now * 3) * 0.2;
        game.update(dt, now); drM.uniforms.map.value = R || Math.floor(now / 3) % 2 ? drShot : game.tex; stick.rotation.z = R ? 0 : Math.sin(now * 5) * 0.25; drM.uniforms.uBright.value = 1.25 * (R ? 1 : 0.96 + 0.04 * Math.sin(now * 40));
        glowL.intensity = 2.2 * (R ? 1 : 0.9 + 0.1 * Math.sin(now * 13));
        ph.rotation.y = -0.35 + (R ? 0 : Math.sin(now * 0.6) * 0.05);
        bits.forEach((m, i) => { if (!R) { m.rotation.x += dt * m.userData.sp; m.rotation.y += dt * m.userData.sp * 0.7; } m.position.y += R ? 0 : Math.sin(now + i) * 0.002; });
        clouds.update(dt, R);
        inst._t = t;
      },
      ui(k, t) {
        const a = [range(t, -0.04, 0.02) * (1 - range(t, 0.135, 0.15)), range(t, 0.15, 0.2) * (1 - range(t, 0.35, 0.39)), range(t, 0.43, 0.48) * (1 - range(t, 0.63, 0.67)), range(t, 0.71, 0.76) * (1 - range(t, 0.96, 1.0))];
        D.parts.forEach((p, i) => edK(p, a[i] * k));
      },
      dispose() { own.forEach((t) => t.dispose()); S.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); }); },
    };
    return inst;
  },
};
