// Screen world orchestrator: the long journey inside the CRT. Beats are staged 3D scenes laid end to end on the scroll;
// each renders into its own target and a transition shader composites A -> B at the seams. Beats build lazily as they
// near and are disposed when far. The project page is a modal "channel" on top of the ring.
import * as THREE from 'three';
import { clamp, lerp, range, smoother, easeIO } from './util.js';
import { smoothJump } from '../jump.js';
import { makeTransMat, MODES } from './trans.js';
import { makeStage } from './trans3d.js';
import { makeUI } from './ui.js';
import { worldEnv } from './mat.js';
import ring from './ring.js';
import build from './build.js';
import library from './library.js';
import process from './process.js';
import friends from './friends.js';
import harrison from './harrison.js';
import studio from './studio.js';
import arcade from './arcade.js';
import putt from './putt.js';
import numbers from './numbers.js';
import touch from './touch.js';

export const S0 = 0.97;        // page scroll (in viewport heights) where the world starts
export const EXIT = 1.25;      // vh of pull-back through the glass (handled by home.js) after the last beat
const T = 1.0;                 // vh width of a scroll transition window ([smooth] wider = gentler)
const DWELL = 0.6;             // vh of scroll held still at each beat's hero moment
const T3D = { channel: 1, floppy: 1, squash: 1 };   // transitions staged as 3D events (trans3d.js)

// len in viewport heights; hero = fraction of the beat where the dwell + snap point sits
const DEFS = [
  { mod: ring, len: 1.8, hero: 0.2, out: 'glide' },
  { mod: build, len: 4.6, hero: 0.27, out: 'glide' },
  { mod: studio, len: 2.0, hero: 0.5, out: 'glide' },
  { mod: arcade, len: 2.0, hero: 0.45, out: 'glide' },
  { mod: putt, len: 2.0, hero: 0.45, out: 'glide' },
  { mod: library, len: 2.1, hero: 0.5, out: 'glide' },
  { mod: numbers, len: 1.5, hero: 0.5, out: 'glide' },
  { mod: process, len: 2.5, hero: 0.55, out: 'glide' },
  { mod: friends, len: 1.8, hero: 0.5, out: 'glide' },
  { mod: touch, len: 1.6, hero: 0.5, out: 'glide' },
  { mod: harrison, len: 2.4, hero: 0.55, out: null },
];

export function createWorld({ renderer, reduced, lenis, images, projects, home, getDPR, mobile }) {
  const beats = []; let acc = 0;
  DEFS.forEach((d, i) => { beats.push({ i, id: d.mod.id, name: d.mod.name, mod: d.mod, len: d.len, hero: d.hero, start: acc, out: d.out, inst: null }); acc += d.len; });
  // beat-local progress with a flat dwell around the hero moment: lv (vh into the beat) -> 0..1
  const prog = (b, lv) => { const h = b.hero * b.len, e = lv < h - DWELL / 2 ? lv : lv < h + DWELL / 2 ? h - DWELL / 2 : lv - DWELL; return e / (b.len - DWELL); };
  const total = acc;
  let envT = null; const getEnv = () => envT || (envT = worldEnv(renderer));   // [startup] PMREM built lazily, with the first beat
  let W = window.innerWidth, H = window.innerHeight, DPR = getDPR(), isMobile = mobile;
  const mk = () => new THREE.WebGLRenderTarget(Math.round(W * DPR), Math.round(H * DPR), { type: THREE.HalfFloatType, samples: isMobile ? 0 : (DPR > 1.5 ? 2 : 4) });
  const rtA = mk(), rtB = mk();
  const tm = makeTransMat();
  const flat = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), tm); quad.frustumCulled = false; flat.scene.add(quad);
  let stage = null; const getStage = () => stage || (stage = makeStage()); let staged = false;
  const display = { get scene() { return staged ? getStage().scene : flat.scene; }, get cam() { return staged ? getStage().cam : flat.cam; } };

  const api = {
    total, beats, S0, EXIT, display, modal: false, active: false, reduced, lenis,
    jump(i, off = 0.3) {
      const vh = window.innerHeight, b = beats[i], y = (S0 + b.start + (off === 0.3 ? b.hero * b.len : off)) * vh;
      smoothJump(lenis, y, { reduced });
    },
    images, projects,
  };
  const ui = makeUI(home, beats, (i) => api.jump(i));
  const ctx = { renderer, get env() { return getEnv(); }, reduced, images, projects, ui, api, get mobile() { return isMobile; }, get aspect() { return W / H; }, get W() { return W; }, get H() { return H; } };
  api.ctx = ctx;
  // DOM for every beat is built up front (cheap, accessible); 3D is built lazily
  beats.forEach((b) => { b.dom = b.mod.dom ? b.mod.dom(ui.panels[b.id], ctx) : null; });

  function ensure(i) { const b = beats[i]; if (!b || b.inst) return; b.inst = b.mod.build(ctx, b.dom); if (!b.inst.scene.environment) b.inst.scene.environment = getEnv(); b.inst.layout && b.inst.layout(W / H, isMobile); }
  function drop(i) { const b = beats[i]; if (!b || !b.inst || i === 0) return; if (b.inst.ui) b.inst.ui(0, 0); ui.panelVis(b.id, false); b.inst.dispose(); b.inst = null; }

  // ---------- time-driven transitions (project page open/close/next) ----------
  let tr = null;   // { a, b, mode, t, dur, done }
  api.play = (a, b, mode, dur, done, c) => { tr = { a, b, mode, t: 0, dur: reduced ? 0.001 : dur, done }; tm.uniforms.uC.value.set(...(c || [0.5, 0.5])); };
  api.busy = () => !!tr;
  // a playable beat holds the page still while you play (scroll + phone pan go to the game)
  api.lock = (on) => { const gl = document.getElementById('gl'); if (gl) gl.style.touchAction = on ? 'none' : ''; if (lenis) { if (on) lenis.stop(); else lenis.start(); } else document.documentElement.style.overflow = on ? 'hidden' : ''; api.locked = on; };
  api.setModal = (on) => {
    api.modal = on;
    ui.root.classList.toggle('modal', on); document.getElementById('site').classList.toggle('wmodal', on);   // hide the chapter rail + nav links under the page
    const gl = document.getElementById('gl'); if (gl) gl.style.touchAction = on ? 'none' : '';   // phone: drag the gallery, not the page
    if (on) { if (lenis) lenis.stop(); else document.documentElement.style.overflow = 'hidden'; }
    else { if (lenis) lenis.start(); else document.documentElement.style.overflow = ''; }
  };

  // ---------- state ----------
  let sw = 0, cur = 0, pend = null, view = null;   // view = what is shown (beat instance or the project page)
  const state = { A: null, B: null, mode: 0, p: 0 };
  api.preload = () => { ensure(0); warm(1); };
  /* [smooth] build the remaining beats one per idle slice (and compile their shaders) so scrolling never hitches on a lazy build */
  const idle = (f) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 200));
  function warm(i) { if (i >= beats.length) return; idle(() => { try { if (!beats[i].inst) { ensure(i); const b = beats[i].inst; /* mobile drops far beats while this idle warm runs; compileAsync's poll would then read a disposed program */ if (b && renderer.compileAsync && !isMobile) renderer.compileAsync(b.scene, b.cam).catch(() => {}); } } catch (e) { console.warn('warm', e); } if (!(isMobile && i > 2)) warm(i + 1); }); }   // [startup] the host calls this after its first frame; update() also builds beats on demand

  api.update = (s, dt, inp) => {
    sw = s - S0;
    const t = clamp(sw, 0, total + EXIT);
    // current beat + seam
    let i = beats.findIndex((b) => t < b.start + b.len); if (i < 0) i = beats.length - 1;
    cur = i;
    for (let k = 0; k < beats.length; k++) { if (Math.abs(k - i) <= 1 || (k === i + 2 && t > beats[i].start + beats[i].len - 0.9)) ensure(k); else if (isMobile && Math.abs(k - i) > 2) drop(k); }
    let A = beats[i], B = null, p = 0, mode = 0;
    const endI = A.start + A.len; if (!tr) tm.uniforms.uC.value.set(0.5, 0.5);
    if (A.out && t > endI - T / 2) { B = beats[i + 1]; p = range(t, endI - T / 2, endI + T / 2); mode = MODES[A.out]; }
    else if (i > 0 && t < A.start + T / 2) { B = A; A = beats[i - 1]; p = range(t, A.start + A.len - T / 2, A.start + A.len + T / 2); mode = MODES[A.out]; }
    if (reduced && B) { if (p < 0.5) B = null; else { A = B; B = null; } p = 0; mode = 0; }
    // update visible beats
    const upd = (b) => b && b.inst && b.inst.update(prog(b, t - b.start), dt, inp, t - b.start);
    upd(A); if (B) upd(B);
    // ring always ticks its springs (cheap) so the hand-off frame is live
    if (beats[0].inst && A !== beats[0] && B !== beats[0] && t < 0.3) upd(beats[0]);
    // DOM panels: visible for the beat(s) on screen
    beats.forEach((b) => { const on = api.active && !api.modal && (b === A || b === B); ui.panelVis(b.id, on); if (b.inst && b.inst.ui) b.inst.ui(on ? (b === B ? clamp((p - 0.55) / 0.45) : b === A && B ? clamp(1 - p / 0.4) : 1) : 0, prog(b, t - b.start)); });
    ui.setBeat(B && p > 0.5 ? B.i : A.i, clamp(t / total));
    ui.show(api.active);
    state.A = A.inst; state.B = B ? B.inst : null; state.p = B && T3D[A.out] ? p : smoother(p); state.mode = B ? mode : 0; state.m3 = B && T3D[A.out] ? A.out : null;
    // modal page on top
    if (tr) {
      tr.t += dt; const k = clamp(tr.t / tr.dur);
      if (tr.a.update && tr.a !== state.A) tr.a.update(0, dt, inp); if (tr.b.update && tr.b !== state.A) tr.b.update(0, dt, inp);
      state.A = tr.a; state.B = tr.b; state.p = easeIO(k); state.mode = MODES[tr.mode]; state.m3 = T3D[tr.mode] ? tr.mode : null;
      if (k >= 1) { const d = tr.done; tr = null; state.A = null; d && d(); }
    }
    if (!tr && api.page) { api.page.update(0, dt, inp); state.A = api.page; state.B = null; state.mode = 0; state.m3 = null; }
    if (!state.A) state.A = A.inst;
    view = state.mode ? (state.p < 0.5 ? state.A : state.B) : state.A;
    // hints
    const hv = api.page ? api.page.hint : (view && view.hint) || 'scroll <span class="ar">↓</span>';
    ui.hint(api.active ? hv : '');
    tm.uniforms.uTime.value += dt;
  };

  const tmpFov = { v: 0 };
  // zoom < 1 widens the beat camera so the part of the CRT visible at the dive hand-off shows the full frame
  function renderInst(inst, rt, zoom) {
    const cam = inst.cam, fov = zoom && zoom !== 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / zoom)) : 0;
    // phone: copy sits in the lower part of the screen, so lift the 3D into the upper part (view offset)
    const lift = isMobile ? (inst.phoneLift ?? 0.2) : 0;
    if (lift) cam.setViewOffset(W, H, 0, H * lift, W, H); else if (cam.view && cam.view.enabled) cam.clearViewOffset();
    if (fov) { tmpFov.v = cam.fov; cam.fov = fov; }
    if (fov || lift) cam.updateProjectionMatrix();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x03031a, 1); renderer.clear(); renderer.render(inst.scene, cam);
    if (fov) { cam.fov = tmpFov.v; cam.updateProjectionMatrix(); }
  }
  // render the current world frame into the display quad's inputs (zoom: see renderInst)
  api.prepare = (fov) => {
    if (!state.A) return;
    renderInst(state.A, rtA, fov);
    tm.uniforms.tA.value = rtA.texture;
    staged = false;
    if (state.mode && state.B) {
      renderInst(state.B, rtB, fov); tm.uniforms.tB.value = rtB.texture; tm.uniforms.uMode.value = state.mode; tm.uniforms.uP.value = state.p;
      if (state.m3) { staged = true; getStage().set(state.m3, state.p, rtA.texture, rtB.texture); }
    } else tm.uniforms.uMode.value = 0;
    renderer.setRenderTarget(null);
  };
  api.renderInto = (target, fov) => { api.prepare(fov); renderer.setRenderTarget(target); renderer.render(display.scene, display.cam); renderer.setRenderTarget(null); };

  // per-beat post look (lens, border) blended across seams
  api.post = () => {
    const pa = (state.A && state.A.post) || {}, pb = (state.B && state.B.post) || {}, k = state.mode ? state.p : 0;
    const g = (key, d) => lerp(pa[key] ?? d, pb[key] ?? d, k);
    return { lens: g('lens', 1), border: g('border', 1), vig: g('vig', 0.3), bloom: g('bloom', 0.38), ca: g('ca', 1.6), con: g('con', 1.1), s: g('s', 0.35) };
  };

  api.resize = (w, h, dpr, mob) => {
    W = w; H = h; DPR = dpr; isMobile = mob;
    rtA.setSize(Math.round(W * DPR), Math.round(H * DPR)); rtB.setSize(Math.round(W * DPR), Math.round(H * DPR));
    tm.uniforms.uAspect.value = W / H; tm.uniforms.uRes.value.set(W, H); if (stage) stage.resize(W / H);
    beats.forEach((b) => b.inst && b.inst.layout && b.inst.layout(W / H, isMobile));
    if (api.page && api.page.layout) api.page.layout(W / H, isMobile);
  };
  api.resize(W, H, DPR, isMobile);
  api.setActive = (on) => { api.active = on; ui.show(on); if (!on) { beats.forEach((b) => ui.panelVis(b.id, false)); ui.tipAt(''); } };
  api.current = () => cur;
  api.view = () => view;

  // ---------- input routing ----------
  const ndc = new THREE.Vector2();
  const overUI = (e) => e.target && e.target.closest && e.target.closest('a,button,input,#nav,.wr-rail,.pp-ui');
  const target = () => (api.page || (state.mode ? null : view));
  const onMove = (e) => { if (!api.active) return; ndc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1); const v = target(); if (v && v.pointer) v.pointer('move', e, ndc, overUI(e)); };
  const onDown = (e) => { if (!api.active || (e.button !== undefined && e.button !== 0)) return; ndc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1); const v = target(); if (v && v.pointer) v.pointer('down', e, ndc, overUI(e)); };
  const onUp = (e) => { if (!api.active) return; const v = target(); if (v && v.pointer) v.pointer('up', e, ndc, overUI(e)); };
  const onKey = (e) => {
    if (!api.active) return;
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    const v = api.page || view;
    if (v && v.key && v.key(e)) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  const onKeyUp = (e) => { if (!api.active) return; const v = api.page || view; if (v && v.keyup) v.keyup(e); };
  const onWheel = (e) => { if (!api.modal || !api.page) return; e.preventDefault(); e.stopImmediatePropagation(); api.page.wheel && api.page.wheel(e); };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey, { capture: true }); window.addEventListener('keyup', onKeyUp);
  window.addEventListener('wheel', onWheel, { capture: true, passive: false });

  api.dispose = () => {
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKey, { capture: true }); window.removeEventListener('keyup', onKeyUp); if (api.locked) api.lock(false); window.removeEventListener('wheel', onWheel, { capture: true });
    if (api.modal) api.setModal(false);
    beats.forEach((b) => { if (b.inst) b.inst.dispose(); b.inst = null; });
    if (api.page && api.page.dispose) api.page.dispose();
    if (lenis && lenis.off) lenis.off('scroll', onLenis); clearTimeout(snapT);
    rtA.dispose(); rtB.dispose(); tm.dispose(); if (stage) stage.dispose(); ui.dispose();
  };
  // ---------- snap points: when scrolling settles near a beat's hero moment, glide onto it (inside its dwell) ----------
  let snapT = 0;
  const trySnap = () => {
    return;   /* [smooth] no auto-snap: it fought the user's scroll and felt glitchy */
    if (!api.active || api.modal || reduced || !lenis || window.__noSnap) return;
    const vh = window.innerHeight, t = window.scrollY / vh - S0;
    for (const b of beats) {
      const h = b.start + b.hero * b.len, d = t - h;
      if (Math.abs(d) < 0.55 && Math.abs(d) > DWELL * 0.45) { lenis.scrollTo((S0 + h) * vh, { duration: 0.7, easing: easeIO }); return; }
    }
  };
  const onLenis = () => { clearTimeout(snapT); snapT = setTimeout(trySnap, 260); };
  if (lenis && lenis.on) lenis.on('scroll', onLenis);
  api.idOf = (id) => beats.findIndex((b) => b.id === id);
  api.heroY = (i) => S0 + beats[i].start + beats[i].hero * beats[i].len;
  window.__world = api;
  return api;
}
