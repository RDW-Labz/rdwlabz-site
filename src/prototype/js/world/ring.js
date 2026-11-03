// Beat 1: the project ring. Thick clay-framed cards stand on pegs around a slow clay turntable above the cloud sea.
// Each card is a frame layer over an image layer built from 12 clay tiles (parallax inside the window); changing project
// sends a staggered tile-flip wave around the ring. Click a card or "Open project" for the full project page.
import * as THREE from 'three';
import { TAU, clamp, lerp, Spring, canvas, tex, rr, drawCover, grain, backOut, sstep, range } from './util.js';
import { makeSky, stars, clay, rbox, rig, cloudBank, frameGeo, imageMat, blob } from './mat.js';
import { FILTERS } from '../data.js';
import { ProjectPage } from './project.js';
import { keyArt } from './art.js';
import { ed, edK } from './ui.js';

const CSS = `
.rg-ed.wr-ed{display:none!important}
.rg-ed.wr-ed{left:clamp(16px,3vw,40px);right:auto;top:clamp(250px,34vh,290px);transform:none;width:min(320px,25vw)}
.rg-ed.wr-ed::before{inset:-22px -24px;border-radius:18px;background:rgba(12,9,38,.78);box-shadow:0 18px 40px rgba(4,3,20,.35)}
.rg-ed .wr-h{font-size:clamp(40px,3.6vw,60px)}.rg-ed .lead{font-size:15.5px}.rg-ed .stat b{font-size:44px}
.rg-top{position:absolute;left:clamp(16px,3vw,40px);top:clamp(78px,11vh,104px)}
.rg-idx{font-family:"Instrument Serif",serif;font-style:italic;line-height:.8;color:#FFF6E8;text-shadow:0 6px 40px rgba(10,10,60,.5);display:flex;align-items:baseline;gap:.06em;font-size:clamp(84px,9vw,148px)}
.rg-idx .a{font-size:1em;letter-spacing:-.03em;display:inline-block}
.rg-idx .b{font-size:.4em;opacity:.7;font-style:normal;letter-spacing:.01em}
.rg-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
.rg-meta{position:absolute;left:0;right:0;bottom:clamp(54px,8vh,86px);display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 16px}
.rg-kind{font:21px/1 VT323,monospace;letter-spacing:.08em;color:#FFE0B0;margin:0;text-transform:uppercase}
.rg-name{font-family:"Instrument Serif",serif;font-weight:400;font-size:clamp(42px,4.8vw,74px);line-height:1;margin:6px 0 4px;color:#FFF6E8;text-shadow:0 4px 30px rgba(20,10,40,.55);perspective:600px;min-height:1em}
.rg-name .ch{display:inline-block;transform-origin:50% 70%;animation:rgflap .6s cubic-bezier(.2,.9,.25,1.25) both}
@keyframes rgflap{0%{transform:rotateX(-100deg) translateY(.15em);opacity:0}100%{transform:none;opacity:1}}
.rg-note{margin:0 0 14px;max-width:520px;color:rgba(255,240,235,.8);font-size:16px;text-shadow:0 1px 12px rgba(5,5,30,.9)}
.rg-ctrl{display:flex;gap:14px;align-items:center}
.rg-ctrl .wr-link{margin:0}
.rg-ticks{list-style:none;display:flex;gap:5px;margin:16px 0 0;padding:0;max-width:calc(100vw - 32px)}
.rg-ticks li{flex:0 1 auto;min-width:0}
.rg-ticks button{all:unset;cursor:pointer;width:22px;max-width:100%;height:24px;display:flex;align-items:center}
.rg-ticks button i{display:block;width:100%;height:3px;border-radius:2px;background:rgba(255,240,235,.3);transition:all .3s}
.rg-ticks button[aria-current="true"] i{background:#FFE0B0;height:5px;box-shadow:0 0 10px rgba(255,200,140,.6)}
.rg-ticks button.off i{opacity:.25}
.rg-ticks button:focus-visible i{outline:2px solid #FFB45E;outline-offset:3px}
.pp-ui{position:fixed;inset:0;z-index:7;pointer-events:none;opacity:0;visibility:hidden;transition:opacity .35s,visibility 0s .35s}
.pp-ui.on{opacity:1;visibility:visible;transition:opacity .35s}
.pp-ui .pp-col{position:absolute;left:clamp(16px,4.5vw,72px);top:50%;transform:translateY(-50%);width:min(400px,32vw);pointer-events:auto;will-change:transform}
.pp-ui .pp-tag{font:21px/1 VT323,monospace;letter-spacing:.08em;color:#B5733F;margin:0 0 10px;text-transform:uppercase}
.pp-ui h2{font-family:"Instrument Serif",serif;font-weight:400;font-size:clamp(48px,5.4vw,88px);line-height:.95;letter-spacing:-.02em;margin:0;color:#1B1208}
.pp-ui .pp-desc{color:#3A2E22;font-size:17px;line-height:1.55;margin:18px 0 0}
.pp-ui .pp-mfacts{display:none}
.pp-ui .pp-acts{display:flex;gap:12px;flex-wrap:wrap;margin-top:6px}
.pp-ui .pp-close{position:absolute;top:18px;right:clamp(16px,3vw,40px);pointer-events:auto;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border-radius:999px;background:#FFE4BF;color:#1A120A;font:600 15px "Instrument Sans",sans-serif;border:0;cursor:pointer}
.pp-ui .pp-close:focus-visible,.pp-ui .pp-next:focus-visible{outline:3px solid #FFB45E;outline-offset:3px}
.pp-ui .pp-next{position:absolute;left:0;top:0;pointer-events:auto;transform:translate(-50%,-50%);text-align:center;color:#FFF6E8;text-decoration:none;background:rgba(12,10,36,.86);border:1px solid rgba(255,240,235,.18);cursor:pointer;font:inherit;padding:16px 26px 18px;border-radius:22px;box-shadow:0 20px 50px rgba(5,5,30,.45)}
.pp-ui .pp-next small{display:block;font:20px/1 VT323,monospace;letter-spacing:.08em;color:#FFE0B0}
.pp-ui .pp-next b{display:block;font:400 clamp(34px,3.4vw,52px)/1 "Instrument Serif",serif;margin:6px 0 12px;text-shadow:0 4px 24px rgba(5,5,30,.8)}
.pp-ui .pp-next span{display:inline-flex;min-height:40px;align-items:center;padding:0 18px;border-radius:999px;background:#FFE4BF;color:#1A120A;font:600 15px "Instrument Sans",sans-serif}
.pp-ui .pp-bar{position:absolute;left:50%;bottom:58px;width:min(360px,60vw);height:22px;transform:translateX(-50%);pointer-events:auto;cursor:pointer;display:flex;align-items:center}
.pp-ui .pp-bar::before{content:"";position:absolute;left:0;right:0;height:3px;border-radius:2px;background:rgba(40,25,10,.2)}
.pp-ui .pp-bar i{position:absolute;left:0;height:3px;border-radius:2px;background:#C2412E;width:0}
.pp-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.pp-layer>*{position:absolute;left:0;top:0;will-change:transform}
.pp-facts{width:340px;margin:-150px 0 0 -170px;padding:22px 24px;border-radius:22px;background:#FFF8EE;border:1px solid rgba(60,40,20,.14);box-shadow:0 24px 60px rgba(60,40,20,.18);color:#3A2E22;pointer-events:auto}
.pp-facts .pp-ftag{margin:0 0 10px;font:20px/1 VT323,monospace;letter-spacing:.1em;color:#B5733F}
.pp-facts dl{margin:0;display:grid;gap:10px}.pp-facts dl div{display:grid;grid-template-columns:96px 1fr;gap:10px;border-top:1px solid rgba(60,40,20,.12);padding-top:9px}
.pp-facts dt{font:500 12px "JetBrains Mono",monospace;letter-spacing:.06em;text-transform:uppercase;color:#8a6a50}.pp-facts dd{margin:0;font-size:16px;color:#1B1208}
.pp-facts .wr-link{margin-top:16px}
.pp-cap{margin:12px 0 0;max-width:300px;font:15px/1.4 "Instrument Sans",sans-serif;color:#3A2E22}.pp-cap.side{margin:0;max-width:210px;font-style:italic}.pp-cap b{font:500 12px "JetBrains Mono",monospace;color:#B5733F;margin-right:6px}
.pp-play{pointer-events:auto;display:inline-flex;align-items:center;gap:10px;min-height:48px;padding:0 22px;border-radius:999px;border:0;cursor:pointer;background:#FFE4BF;color:#1A120A;font:600 16px "Instrument Sans",sans-serif;box-shadow:0 14px 34px rgba(12,10,36,.45);white-space:nowrap}
.pp-play span{color:#C2412E;font-size:14px}.pp-play:hover{background:#FFF0D8}.pp-play:focus-visible{outline:3px solid #FFB45E;outline-offset:3px}
.pp-film{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(16,11,8,.88);opacity:0;transition:opacity .25s}
.pp-film.on{opacity:1}
.pp-film-box{display:flex;flex-direction:column;align-items:center;gap:12px;max-width:100%}
.pp-film video{display:block;width:min(calc(100vw - 44px),calc((100vh - 150px) * .5625),720px);width:min(calc(100vw - 44px),calc((100dvh - 150px) * .5625),720px);height:auto;aspect-ratio:9/16;object-fit:contain;border-radius:20px;background:#0c0a1e;border:6px solid #F2E6D2;box-shadow:0 30px 80px rgba(0,0,0,.55)}
.pp-film video:focus-visible{outline:3px solid #FFB45E;outline-offset:4px}
.pp-film-row{display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;max-width:min(560px,calc(100vw - 32px))}
.pp-film-row p{margin:0;color:#F3E7D3;font:15px/1.4 "Instrument Sans",sans-serif}
.pp-film-x{flex:none;display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border-radius:999px;background:#FFE4BF;color:#1A120A;font:600 15px "Instrument Sans",sans-serif;border:0;cursor:pointer}
.pp-film-x:focus-visible{outline:3px solid #FFB45E;outline-offset:3px}
@media (prefers-reduced-motion:reduce){.pp-film{transition:none}}
.pp-pull{width:520px;margin:-90px 0 0 -260px;text-align:center}.pp-pull p{margin:0;font:italic 400 clamp(40px,3.6vw,58px)/1.05 "Instrument Serif",serif;color:#1B1208}.pp-pull cite{display:block;margin-top:14px;font:500 12px "JetBrains Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#8a6a50;font-style:normal}
#worldUI.modal .wr-hint{color:#3A2E22;text-shadow:none}#worldUI.modal .wr-hint kbd{border-color:rgba(40,25,10,.35);background:rgba(255,248,238,.8)}
.pp-ui .pp-bar:focus-visible{outline:2px solid #FFB45E;outline-offset:4px;border-radius:4px}
@media (max-width:820px){
  .rg-top{top:112px}
  .rg-idx{font-size:72px}
  .rg-chips .wr-chip{font-size:18px;padding:6px 12px}
  .rg-note{display:none}
  .rg-meta{bottom:44px}
  .rg-ticks{gap:3px}.rg-ticks button{width:18px}
  .rg-chips{gap:6px}
  .pp-ui .pp-col{top:76px;transform:none;width:auto;right:16px;left:16px}
  .pp-ui h2{font-size:44px}
  .pp-ui .pp-desc{font-size:16px;margin-top:10px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .pp-ui .pp-mfacts{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 0;padding:0;list-style:none}.pp-ui .pp-mfacts li{font:500 12px "JetBrains Mono",monospace;padding:4px 9px;border-radius:999px;background:#FFF8EE;color:#3A2E22;border:1px solid rgba(60,40,20,.15)}
  .pp-ui .pp-col{background:linear-gradient(180deg,rgba(234,220,198,.96),rgba(234,220,198,.88) 80%,rgba(234,220,198,0));padding:0 0 18px;top:64px}
  .pp-cap{max-width:none;width:86vw;margin:6px 0 0 -43vw;text-align:center;font-size:16px}
  .pp-pull{width:86vw;margin:-70px 0 0 -43vw}.pp-pull p{font-size:36px}
  .pp-ui .pp-close{top:12px}
  .pp-ui .pp-bar{bottom:40px}
}`;

const NT = [4, 3];   // tiles per card image (cols, rows)
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const say = (n, one, many) => `${NUM[n] || n} ${n === 1 ? one : many}`;
// the ring lead, counted from data.js so it never drifts
function lead(P) {
  const c = (k) => P.filter((p) => p.cat === k && !p.private).length, pr = P.filter((p) => p.private).length;
  const parts = [say(c('games'), 'game', 'games'), say(c('web'), 'website', 'websites'), say(c('systems'), 'system', 'systems'), say(c('clay'), 'clay 3D pack', 'clay 3D packs')];
  if (pr) parts.push(say(pr, 'private build', 'private builds'));
  const s = parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]; return s[0].toUpperCase() + s.slice(1);
}
const PILL = { games: '#C2412E', web: '#3B2BB0', systems: '#1F7A6E', clay: '#B5733F' };

export default {
  id: 'ring', name: 'Work',
  dom(el, ctx) {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el.innerHTML = `
      ${ed({ cls: 'rg-ed', eyebrow: 'C:\\WORK&gt; dir', title: ['Selected <em>work</em>'], lead: `${lead(ctx.projects)} on one turntable. Spin it, filter it, or open a card for the full story.`, stat: [String(ctx.projects.length), 'projects in the showcase'] })}
      <div class="rg-top"><div class="rg-idx" aria-hidden="true"><span class="a">01</span><span class="b">/ ${String(ctx.projects.length).padStart(2, '0')}</span></div>
        <div class="rg-chips" role="group" aria-label="Filter projects">${FILTERS.map((f) => `<button type="button" class="wr-chip" data-f="${f.id}" aria-pressed="${f.id === 'all'}">${f.label}</button>`).join('')}</div></div>
      <div class="rg-meta"><p class="rg-kind"></p><h2 class="rg-name" aria-live="polite"></h2><p class="rg-note"></p>
        <div class="rg-ctrl"><button type="button" id="rPrev" class="wr-btn rg-prev" aria-label="Previous project">←</button><button type="button" id="rOpen" class="wr-link rg-open">Open project</button><button type="button" id="rNext" class="wr-btn rg-next" aria-label="Next project">→</button></div>
        <ol class="rg-ticks" aria-label="Projects">${ctx.projects.map((p, i) => `<li><button type="button" data-i="${i}" aria-label="${p.name}"><i></i></button></li>`).join('')}</ol></div>`;
    const pp = document.createElement('div'); pp.className = 'pp-ui'; pp.setAttribute('role', 'dialog'); pp.setAttribute('aria-modal', 'true'); pp.setAttribute('aria-labelledby', 'ppTitle'); pp.inert = true;
    pp.innerHTML = `<button type="button" class="pp-close" aria-label="Close project">Close <span aria-hidden="true">✕</span></button>
      <div class="pp-col"><p class="pp-tag"></p><h2 id="ppTitle"></h2><p class="pp-desc"></p><ul class="pp-mfacts"></ul><div class="pp-acts"></div></div>
      <button type="button" class="pp-next"><small>Next project</small><b></b><span>Continue →</span></button>
      <div class="pp-bar" role="slider" tabindex="0" aria-label="Gallery position" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>`;
    ctx.ui.root.parentNode.insertBefore(pp, ctx.ui.root.nextSibling); ctx.ppEl = pp;
    return { el, pp, ed: el.querySelector('.rg-ed'), q: (s) => el.querySelector(s), qp: (s) => pp.querySelector(s) };
  },
  build(ctx, D) {
    const S = new THREE.Scene(), P = ctx.projects, N = P.length;
    S.add(makeSky()); S.add(stars());
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
    const L = rig(S, { keyPos: [-4, 9, 7], area: 7, keyI: 2.0, hemiI: 0.42, rimI: 1.4 });
    const clouds = cloudBank(S, [[-7, -1.6, -6, 9, 0.6], [6, -1.4, -7, 10, 0.55], [0, -2.4, -2, 12, 0.5], [-9, -2, 2, 8, 0.5], [9, -2.2, 1, 8, 0.5], [-3, 3.8, -16, 14, 0.18], [5, 4.6, -18, 16, 0.15], [0, -2.9, 5, 10, 0.45]]);
    // turntable
    const table = new THREE.Group(); S.add(table); const deck = new THREE.Group(); table.add(deck);   // deck: the disc itself, scaled to fit the ring radius
    const top = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.75, 0.34, 96, 1), clay('#C9987A')); top.position.y = -0.17; top.receiveShadow = true; deck.add(top);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(4.72, 3.9, 0.5, 96, 1), clay('#8E5E52')); under.position.y = -0.58; deck.add(under);
    const groove = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.035, 8, 160), clay('#A87A62')); groove.rotation.x = Math.PI / 2; groove.position.y = 0.0; deck.add(groove);
    const groove2 = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.03, 8, 120), clay('#A87A62')); groove2.rotation.x = Math.PI / 2; deck.add(groove2);
    { const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.16, 48), clay('#B98A6C')); hub.position.y = 0.06; hub.receiveShadow = true; hub.castShadow = true; deck.add(hub);
      for (let i = 0; i < 24; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), clay('#C99C7B')); const a = i / 24 * TAU; d.position.set(Math.sin(a) * 4.55, 0.0, Math.cos(a) * 4.55); d.scale.y = 0.5; deck.add(d); } }
    const tshadow = blob(13, 13, 0.55); tshadow.position.y = -2.4; S.add(tshadow);
    // cards
    const CW = 1.7, CH = 1.36, WW = 1.5, WH = 1.0, WY = 0.1;
    const frameG = frameGeo(CW, CH, 0.07, 0.1, [WW, WH, 0.05, 0, WY], 0.02);
    const frameM = clay('#F3E7D3', { roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.35 });
    const backG = rbox(CW - 0.06, CH - 0.06, 0.03, 0.08); const backM = clay('#DCC6A6');
    const tileBack = new THREE.MeshStandardMaterial({ color: '#E9D6B8', roughness: 0.85 }); const recessM = new THREE.MeshBasicMaterial({ color: '#2a2340' });
    const own = [];
    const cards = P.map((p, i) => {
      const im = ctx.images[i];
      const c = keyArt(im, p, 768, 512);   // curated crop, lifted blacks; no title over the art (the label strip below names the file)
      const t = tex(c); own.push(t);
      const lc = canvas(512, 96), lx = lc.getContext('2d'); lx.fillStyle = '#F3E7D3'; lx.fillRect(0, 0, 512, 96);
      lx.fillStyle = '#4A3828'; lx.font = '44px VT323'; lx.textBaseline = 'middle'; lx.fillText(p.file, 8, 50);
      lx.font = '600 22px "JetBrains Mono"'; const kw = lx.measureText(p.kind).width + 26; lx.fillStyle = p.private ? '#6B5E7A' : (PILL[p.cat] || '#B5733F'); rr(lx, 504 - kw, 30, kw, 38, 19); lx.fill(); lx.fillStyle = '#FFF6E8'; lx.fillText(p.kind, 504 - kw + 13, 50);
      const lt = tex(lc); own.push(lt);
      const outer = new THREE.Group(), lift = new THREE.Group(), card = new THREE.Group(); outer.add(lift); lift.add(card);
      const fr = new THREE.Mesh(frameG, frameM); fr.castShadow = true; fr.receiveShadow = true; card.add(fr); fr.userData.card = i;
      const bk = new THREE.Mesh(backG, backM); bk.position.z = -0.03; bk.castShadow = true; card.add(bk);
      const recess = new THREE.Mesh(new THREE.PlaneGeometry(WW, WH), recessM); recess.position.set(0, WY, -0.012); card.add(recess);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.28), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.7 })); label.position.set(0, -0.48, 0.057); card.add(label);
      const mat = imageMat(t, { bright: 1 }); mat.uniforms.uZoom.value = 0.88;
      const tiles = [];
      for (let ty = 0; ty < NT[1]; ty++) for (let tx = 0; tx < NT[0]; tx++) {
        const tw = WW / NT[0], th = WH / NT[1];
        const g = new THREE.PlaneGeometry(tw * 0.994, th * 0.994); const uv = g.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (tx + uv.getX(k)) / NT[0], (ty + uv.getY(k)) / NT[1]);
        const piv = new THREE.Group(); piv.position.set(-WW / 2 + tw * (tx + 0.5), WY - WH / 2 + th * (ty + 0.5), -0.005);
        const f = new THREE.Mesh(g, mat); f.userData.card = i; piv.add(f);
        const b = new THREE.Mesh(new THREE.PlaneGeometry(tw * 0.994, th * 0.994), tileBack); b.rotation.y = Math.PI; piv.add(b);
        card.add(piv); tiles.push({ piv, s: new Spring(0, 70, 10), d: (tx + (NT[1] - 1 - ty) * 0.7) * 0.085, at: -1 });
      }
      // peg + foot on the turntable
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.62, 12), clay('#C99C7B')); peg.position.y = -CH / 2 - 0.28; peg.castShadow = true; outer.add(peg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.07, 24), clay('#D7AC86')); foot.position.y = -CH / 2 - 0.6; foot.castShadow = true; foot.receiveShadow = true; outer.add(foot);
      table.add(outer);
      return { p, i, outer, lift, card, mat, tiles, fr, vis: new Spring(1, 110, 13), hov: new Spring(0, 160, 18), act: new Spring(0, 90, 14) };
    });
    const hovL = new THREE.PointLight('#ffd2a0', 0, 3.5, 1.6); S.add(hovL);
    const R = { r: 3.75, angle: new Spring(0, 40, 12), filter: 'all', list: P.map((_, i) => i), active: 0, drag: null, vel: 0, hover: -1, H: 1.25 };
    if (ctx.reduced) R.angle.k = 200, R.angle.c = 28;
    const step = TAU / N;
    const nameOf = (i) => P[i].name;
    // ---------------- DOM wiring ----------------
    const q = D.q, idxA = q('.rg-idx .a'), idxB = q('.rg-idx .b'), kind = q('.rg-kind'), name = q('.rg-name'), note = q('.rg-note'), open = q('.rg-open');
    const ticks = [...D.el.querySelectorAll('.rg-ticks button')], chips = [...D.el.querySelectorAll('.wr-chip')];
    function setText() {
      const i = R.list[R.active], p = P[i], n = R.list.length;
      idxA.textContent = String(R.active + 1).padStart(2, '0'); idxB.textContent = '/ ' + String(n).padStart(2, '0');
      kind.textContent = p.tag;
      name.innerHTML = ''; [...p.name].forEach((ch, k) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = ch === ' ' ? ' ' : ch; s.style.animationDelay = (k * 24) + 'ms'; name.appendChild(s); });
      name.setAttribute('aria-label', `${p.name}, ${R.active + 1} of ${n}`);
      note.textContent = p.note;
      ticks.forEach((b, k) => { b.setAttribute('aria-current', k === i ? 'true' : 'false'); b.classList.toggle('off', !R.list.includes(k)); b.tabIndex = R.list.includes(k) ? 0 : -1; });
    }
    function flipWave(dir) {
      if (ctx.reduced) return;
      const now = performance.now() / 1000;
      cards.forEach((c) => { let d = Math.abs(((c.i - R.list[R.active]) % N + N) % N); d = Math.min(d, N - d);
        c.tiles.forEach((t) => { t.at = now + t.d * (dir > 0 ? 1 : -1) + (dir > 0 ? 0 : 0.35) + d * 0.07; t.dir = dir; }); });
    }
    function goTo(li, dir) {
      li = ((li % R.list.length) + R.list.length) % R.list.length;
      if (li === R.active && !dir) return;
      const ci = R.list[li]; let cur = R.angle.t / step; let target = ci;
      target += Math.round((cur - target) / N) * N; if (dir > 0 && target < cur - 0.01) target += N; if (dir < 0 && target > cur + 0.01) target -= N;
      R.touched = true; R.angle.t = target * step; R.active = li; setText(); flipWave(dir || Math.sign(target - cur) || 1);
    }
    const stepBy = (d) => goTo(R.active + d, d);
    function setFilter(id) {
      R.touched = true; R.filter = id; const cur = R.list[R.active];
      R.list = P.map((_, i) => i).filter((i) => id === 'all' || P[i].cat === id);
      chips.forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === id ? 'true' : 'false'));
      const keep = R.list.indexOf(cur); R.active = keep >= 0 ? keep : 0; goTo(R.active, 0); setText(); flipWave(1);
    }
    q('.rg-prev').addEventListener('click', () => stepBy(-1));
    q('.rg-next').addEventListener('click', () => stepBy(1));
    open.addEventListener('click', () => openPage(R.list[R.active]));
    ticks.forEach((b) => b.addEventListener('click', () => { const i = +b.dataset.i; if (!R.list.includes(i)) setFilter('all'); goTo(R.list.indexOf(i), 0); }));
    chips.forEach((b) => b.addEventListener('click', () => setFilter(b.dataset.f)));
    setText();
    // ---------------- project page ----------------
    const api = ctx.api, pp = D.pp; let page = null, opener = null;
    const ppCol = D.qp('.pp-col'), ppNext = D.qp('.pp-next'), ppBar = D.qp('.pp-bar'), ppBarI = ppBar.querySelector('i');
    function fillPage(pg) {
      const p = pg.p; D.qp('.pp-tag').textContent = p.tag; D.qp('#ppTitle').textContent = p.name; D.qp('.pp-desc').textContent = p.desc;
      D.qp('.pp-mfacts').innerHTML = (p.facts || []).map(([k, v]) => `<li>${k}: ${v}</li>`).join('');
      const acts = D.qp('.pp-acts'); acts.innerHTML = '';
      if (p.url) { const a = document.createElement('a'); a.className = 'wr-link'; a.href = p.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = (p.visit || 'Visit') + ' ↗'; acts.appendChild(a); }
      if (p.film) { const b = document.createElement('button'); b.type = 'button'; b.className = 'wr-link'; b.textContent = '▶ ' + (p.film.label || 'Watch the video'); b.addEventListener('click', () => api.page && api.page.openFilm(b)); acts.appendChild(b); }
      if (p.cat === 'clay') { const b = document.createElement('button'); b.type = 'button'; b.className = 'wr-link ghost'; b.textContent = 'See the clay library'; b.addEventListener('click', () => { closePage(() => api.jump(api.idOf('library'))); }); acts.appendChild(b); }
      ppNext.querySelector('b').textContent = P[pg.nextIdx].name;
      ppNext.setAttribute('aria-label', `Next project: ${P[pg.nextIdx].name}`);
    }
    function mkPage(i) { const pg = new ProjectPage(ctx, i); pg.onClose = () => closePage(); pg.onTick = tickPage; return pg; }
    function tickPage(pg) {
      if (pg !== api.page) return;
      const k = pg.prog || 0, mob = ctx.mobile;
      ppCol.style.transform = mob ? `translateY(${(-k * 30).toFixed(1)}px)` : `translate(${(-k * pg.max * 90).toFixed(1)}px,-50%)`;
      ppCol.style.opacity = String(clamp(1 - k * (mob ? 6 : 3.2)));   // phones: the column clears quickly so it never sits over the first frames
      ppCol.style.visibility = k > (mob ? 0.2 : 0.4) ? 'hidden' : 'visible';
      const [sx, sy] = pg.nextScreenPos(); const vis = sx < 1.05 && sx > -0.05;
      ppNext.style.left = (sx * window.innerWidth) + 'px'; ppNext.style.top = ((1 - sy) * window.innerHeight) + 'px'; ppNext.style.visibility = vis ? 'visible' : 'hidden'; ppNext.tabIndex = vis ? 0 : -1;
      ppBarI.style.width = (k * 100).toFixed(1) + '%'; ppBar.setAttribute('aria-valuenow', String(Math.round(k * 100)));
    }
    function openPage(i) {
      if (api.busy() || api.page) return;
      opener = document.activeElement;
      const pg = mkPage(i); pg.layout(ctx.aspect, ctx.mobile); pg.update(0, 0, null);
      api.setModal(true); fillPage(pg);
      api.play(inst, pg, 'glide', 0.9, () => { api.page = pg; pp.inert = false; pp.classList.add('on'); ppCol.style.transform = ''; D.qp('.pp-close').focus({ preventScroll: true }); });
      page = pg;
    }
    function closePage(after) {
      const pg = api.page; if (!pg || api.busy()) return;
      api.page = null; pp.classList.remove('on'); pp.inert = true;
      api.play(pg, inst, 'glide', 0.75, () => { pg.dispose(); page = null; api.setModal(false); if (opener && opener.focus) opener.focus({ preventScroll: true }); after && after(); });
    }
    function nextPage() {
      const pg = api.page; if (!pg || api.busy()) return;
      const ni = pg.nextIdx, pg2 = mkPage(ni); pg2.layout(ctx.aspect, ctx.mobile); pg2.update(0, 0, null);
      const [sx, sy] = pg.nextScreenPos();
      api.page = null; pp.classList.remove('on');
      api.play(pg, pg2, 'glide', 0.7, () => { pg.dispose(); api.page = pg2; page = pg2; fillPage(pg2); pp.classList.add('on'); D.qp('.pp-close').focus({ preventScroll: true });
        if (!R.list.includes(ni)) setFilter('all'); goTo(R.list.indexOf(ni), 1); }, [clamp(sx), clamp(sy)]);
    }
    D.qp('.pp-close').addEventListener('click', () => closePage());
    ppNext.addEventListener('click', nextPage);
    ppBar.addEventListener('pointerdown', (e) => { const r = ppBar.getBoundingClientRect(); const set = (ev) => api.page && api.page.scrollTo((ev.clientX - r.left) / r.width); set(e); const mv = (ev) => set(ev); const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); e.stopPropagation(); });
    ppBar.addEventListener('keydown', (e) => { if (!api.page) return; if (e.key === 'ArrowRight') { api.page.scrollBy(api.page.max / 10); e.preventDefault(); } if (e.key === 'ArrowLeft') { api.page.scrollBy(-api.page.max / 10); e.preventDefault(); } });
    pp.addEventListener('keydown', (e) => { if (e.key === 'Tab') { const f = [...pp.querySelectorAll('a,button,[tabindex="0"]')].filter((n) => n.offsetParent !== null && n.style.visibility !== 'hidden'); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); } } });

    // ---------------- interaction ----------------
    const ray = new THREE.Raycaster(); const hitList = cards.flatMap((c) => [c.fr, ...c.tiles.map((t) => t.piv.children[0])]);
    function pick(ndc) { ray.setFromCamera(ndc, cam); const h = ray.intersectObjects(hitList, false)[0]; return h ? h.object.userData.card : -1; }
    const inst = {
      scene: S, cam, post: { lens: 1, border: 1, vig: 0.3, bloom: 0.38 }, phoneLift: 0,
      hint: '<kbd>drag</kbd> or <kbd>←</kbd><kbd>→</kbd> to browse · <kbd>Enter</kbd> open · scroll <span class="ar">↓</span>',
      openPage, closePage, nextPage, R, cards, stepBy, setFilter,
      layout(a, mob) {
        cam.aspect = a; R.mob = mob;
        if (mob) { R.r = 2.55; cam.fov = 58; R.cz = 10.6; R.cy = 2.1; R.ly = 0.55; R.H = 1.15; }
        else if (a < 1.3) { R.r = 3.2; cam.fov = 52; R.cz = 10.2; R.cy = 2.4; R.ly = 0.1; R.H = 1.2; }
        else { R.r = 3.75; cam.fov = 46; R.cz = 9.8; R.cy = 2.5; R.ly = 0.12; R.H = 1.25; }
        // more cards than the base ring holds: shrink the cards a little and widen the ring so neighbours never touch
        { const r0 = R.r, cs = N > 8 ? (mob ? 0.8 : a < 1.3 ? 0.8 : 0.84) : 1, fitR = N * CW * cs * (mob ? 1.2 : 1.28) / TAU;
          R.cs = cs; R.r = Math.max(r0, fitR); R.cz += (R.r - r0) * 0.3; const k = (R.r + 1.15) / 4.9; deck.scale.set(Math.max(1, k), 1, Math.max(1, k)); tshadow.scale.set(Math.max(1, k), Math.max(1, k), 1); }
        R.px = !mob && a >= 1.3 ? -0.6 : 0;   // desktop: the turntable sits ~60px right, clear of the intro panel
        cam.updateProjectionMatrix();
      },
      update(t, dt, inp) {
        const mx = inp ? inp.mx : 0, my = inp ? inp.my : 0;
        // camera: settles in on landing, leans down and away as you leave
        const land = clamp((t + 0.02) / 0.14), leave = sstep(0.72, 1.12, t);
        // scroll orbits the camera a little around the turntable while you browse
        const orb = ctx.reduced ? 0 : (clamp(t, 0, 0.75) - 0.35) * 0.32, dist = R.cz - land * 0.6 + leave * 2.5;
        cam.position.set(Math.sin(orb) * dist + mx * 0.5 + (R.px || 0), R.cy + my * 0.3 + (1 - land) * 0.5 + leave * 1.6, Math.cos(orb) * dist);
        cam.lookAt(mx * 0.1 + (R.px || 0), R.ly + leave * 0.2, 0);
        R.angle.step(dt);
        if (!R.drag && !ctx.reduced) table.rotation.y = -R.angle.x; else table.rotation.y = -R.angle.x;
        groove.rotation.z += dt * 0.02;
        const now = performance.now() / 1000;
        cards.forEach((c) => {
          const inList = R.list.includes(c.i); c.vis.t = inList ? 1 : 0; const v = c.vis.step(dt);
          const a = c.i * step;
          let rel = a - R.angle.x; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
          const isAct = R.list[R.active] === c.i; c.act.t = isAct ? 1 : 0; const ak = c.act.step(dt);
          c.hov.t = R.hover === c.i && !R.drag ? 1 : 0; const hk = c.hov.step(dt);
          c.outer.position.set(Math.sin(a) * R.r, (R.H - 1.28 * (1 - (R.cs || 1))) * v - (1 - v) * 0.4, Math.cos(a) * R.r);   // feet stay on the deck when cards shrink
          c.outer.rotation.y = a - rel * 0.55;
          { const sv = Math.max(0.001, v * (R.cs || 1)); c.outer.scale.set(sv, sv, sv); }
          c.outer.visible = v > 0.01;
          c.lift.position.set(0, ak * 0.16 + hk * 0.1 + (ctx.reduced ? 0 : Math.sin(now * 1.5 + c.i) * 0.02), hk * 0.18);
          c.lift.scale.setScalar(1 + ak * 0.14 + hk * 0.04);
          c.lift.rotation.x = -hk * 0.06;
          c.card.rotation.z = ctx.reduced ? 0 : Math.sin(now * 0.7 + c.i * 1.7) * 0.012;
          // parallax: the image slides inside the window against the card's view angle
          c.mat.uniforms.uOff.value.set(clamp(rel, -1, 1) * 0.045 + mx * 0.01, my * 0.01);
          c.mat.uniforms.uSheen.value = rel * 0.5;
          c.mat.uniforms.uBright.value = lerp(0.5, 0.86, clamp(1 - Math.abs(rel) / 1.6)) * (1 + hk * 0.12) * (inList ? 1 : 0.5);
          c.tiles.forEach((tl) => { if (tl.at > 0 && now >= tl.at) { tl.s.t += Math.PI * (tl.dir || 1) * 2; tl.at = -1; } tl.piv.rotation.x = tl.s.step(dt); });
        });
        if (R.hover >= 0) { const c = cards[R.hover]; c.card.getWorldPosition(hovL.position); hovL.position.y += 0.4; hovL.position.z += 0.9; }
        hovL.intensity = lerp(hovL.intensity, R.hover >= 0 && !R.drag ? 2.6 : 0, 1 - Math.exp(-dt * 10));
        clouds.update(dt, ctx.reduced);
      },
      ui(k, t) { const el = D.el; el.style.opacity = String(clamp(k * clamp((t + 0.02) / 0.1) * (1 - sstep(0.78, 0.95, t)))); R.edK = lerp(R.edK ?? 1, R.touched || t > 0.12 ? 0 : 1, 0.12); edK(D.ed, ctx.mobile ? 0 : k * R.edK); },   // intro copy fades once the ring is in use
      pointer(type, e, ndc, over) {
        if (type === 'move') {
          if (R.drag) {
            const dx = e.clientX - R.drag.lx, now = performance.now(); const d = dx * (TAU / (window.innerWidth * (R.mob ? 1.4 : 1.1)));
            R.angle.t -= d; R.angle.x -= d; R.angle.v = 0; R.vel = lerp(R.vel, -d / Math.max(0.001, (now - R.drag.t) / 1000), 0.5); R.drag.lx = e.clientX; R.drag.t = now;
            if (Math.abs(e.clientX - R.drag.x) > 6) R.drag.moved = true;
            return;
          }
          const h = over ? -1 : pick(ndc); if (h !== R.hover) { R.hover = h; } document.body.style.cursor = h >= 0 ? 'pointer' : (over ? '' : 'grab');
        } else if (type === 'down') {
          if (over) return; R.drag = { x: e.clientX, lx: e.clientX, t: performance.now(), moved: false, hit: pick(ndc) }; R.vel = 0;
        } else if (type === 'up' && R.drag) {
          const d = R.drag; R.drag = null;
          if (!d.moved) { if (d.hit >= 0) { const li = R.list.indexOf(d.hit); if (li === R.active) openPage(d.hit); else if (li >= 0) goTo(li, 0); } return; }
          const proj = R.angle.x + clamp(R.vel, -10, 10) * 0.25; let best = 0, bd = 1e9;
          R.list.forEach((ci, li) => { const tgt = ci + Math.round((proj / step - ci) / N) * N; const dd = Math.abs(tgt * step - proj); if (dd < bd) { bd = dd; best = li; } });
          const ci = R.list[best]; R.angle.t = (ci + Math.round((proj / step - ci) / N) * N) * step; if (best !== R.active) { const dir = Math.sign(R.angle.t - R.angle.x) || 1; R.active = best; setText(); flipWave(dir); }
        }
      },
      key(e) {
        if (e.key === 'ArrowRight') { stepBy(1); return true; }
        if (e.key === 'ArrowLeft') { stepBy(-1); return true; }
        if (e.key === 'Enter' && (document.activeElement === document.body || !document.activeElement)) { openPage(R.list[R.active]); return true; }
        return false;
      },
      dispose() {},   // the ring stays resident (it is the hand-off frame)
    };
    return inst;
  },
};
