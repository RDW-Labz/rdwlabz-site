// Screen world: the long editorial project page. A cream gallery wall with clay frames on a long ledge, horizontal
// scroll (vertical cards on phones). Order: key-art hero (p.img), facts card, then one frame per real image in p.shots
// (every frame a different image, never a crop of another), our own 3D vignettes, one pull-line, the Next card.
// Gallery images load lazily as their frame comes near the camera. p.film adds a frame that opens a real video player.
import * as THREE from 'three';
import { canvas, tex, drawCover, rr, grain, clamp, lerp, Spring, range, easeOut } from './util.js';
import { clay, rbox, frameGeo, imageMat, blob, plasterTex, planksTex } from './mat.js';
import { keyArt, titleCard, avgColor } from './art.js';
import { PULL } from '../data.js';

function urlLabel(text) { const c = canvas(512, 64), x = c.getContext('2d'); x.fillStyle = '#FFF8EE'; rr(x, 0, 0, 512, 64, 32); x.fill(); x.fillStyle = '#6B5640'; x.font = '30px "JetBrains Mono"'; x.textBaseline = 'middle'; x.fillText('🔒 ' + text, 24, 34); return tex(c); }

// a hung frame's peg and two wires
function hangPeg(g, fw, fh) {
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), clay('#3a2a24')); peg.rotation.x = Math.PI / 2; peg.position.set(0, fh / 2 + 0.3, -0.2); g.add(peg);
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, Math.hypot(fw / 2, 0.3), 4), clay('#3a2a24'));
  [-1, 1].forEach((sd) => { const w2 = wire.clone(); w2.position.set(sd * fw / 4, fh / 2 + 0.15, -0.1); w2.rotation.z = -sd * (Math.PI / 2 - Math.atan2(0.3, fw / 2)); g.add(w2); });
}
// the film frame's still is dimmed a touch under its play button
function playBadge(x, w, h) {
  const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6); g.addColorStop(0, 'rgba(12,10,36,.45)'); g.addColorStop(1, 'rgba(12,10,36,.1)');
  x.fillStyle = g; x.fillRect(0, 0, w, h);   // a soft dim so the real play button (DOM, centred on the frame) reads
}

export class ProjectPage {
  constructor(ctx, idx) {
    this.ctx = ctx; this.idx = idx; const P = ctx.projects, p = P[idx], im = ctx.images[idx];
    this.p = p; this.post = { lens: 0.5, border: 1, vig: 0.22, bloom: 0.22, con: 1.04, s: 0.2 }; this.phoneLift = 0;
    this.hint = '<kbd>drag</kbd> or scroll <span class="ar">→</span> · <kbd>Esc</kbd> close';
    this.own = []; this.mob = ctx.mobile;
    const S = this.scene = new THREE.Scene(); S.background = new THREE.Color('#eadcc6');
    this.cam = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    // gallery: cream plaster wall, honey floor, warm key + soft fill
    const wt = plasterTex('#efe2cc', 21).clone(); wt.repeat.set(64, 16); wt.needsUpdate = true; this.own.push(wt);
    this.wall = new THREE.Mesh(new THREE.PlaneGeometry(160, 40), new THREE.MeshStandardMaterial({ color: '#efe4d0', roughness: 0.95 })); this.wall.position.set(40, 2, -0.9); S.add(this.wall);   // no cast shadows on the wall: no ghost duplicates
    const ft = planksTex('#b98256', 11).clone(); ft.repeat.set(40, 3); ft.needsUpdate = true; this.own.push(ft);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 14), new THREE.MeshStandardMaterial({ map: ft, roughness: 0.7 })); this.floor.rotation.x = -Math.PI / 2; this.floor.position.set(40, -3.2, 5); this.floor.receiveShadow = true; S.add(this.floor);
    S.add(new THREE.HemisphereLight('#fff6ea', '#b08060', 1.0));
    const key = this.keyL = new THREE.DirectionalLight('#ffe6c8', 2.0); key.position.set(-4, 8, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 1024); key.shadow.radius = 5; key.shadow.bias = -0.0005; S.add(key, key.target);
    { const c = key.shadow.camera; c.left = -10; c.right = 10; c.top = 8; c.bottom = -8; c.near = 1; c.far = 30; }
    // light pools painted on the wall above each frame (cheap gallery spots)
    const pc = canvas(128, 128), px = pc.getContext('2d'); const pg = px.createRadialGradient(64, 40, 4, 64, 64, 64); pg.addColorStop(0, 'rgba(255,236,200,.55)'); pg.addColorStop(1, 'rgba(255,236,200,0)'); px.fillStyle = pg; px.fillRect(0, 0, 128, 128);
    this.poolT = tex(pc, { srgb: false }); this.own.push(this.poolT);
    // ---- items
    const items = this.items = [];
    const portrait = im && im.height > im.width, A = portrait ? 9 / 16 : (im ? im.width / im.height : 1.5);
    const cat = p.cat, red = p.file === 'DORMANT_RED.EXE';
    const host = p.url ? p.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '') : '';
    // mixed sizes: large hero, medium frames, small shots hung high so 2-3 frames share each view
    items.push({ k: 'hero', h: 4.3, a: Math.min(A, 1.62) });
    items.push({ k: 'facts', w: 3.4 });
    // extra real media: a muted ambient loop (its own still under reduced motion / no codec), the full film, then the shots
    const vsrc = (() => { if (!p.video || ctx.reduced) return ''; try { const v = document.createElement('video');   // h264 mp4, or the VP9 webm twin; neither -> the still only
      if (v.canPlayType('video/mp4; codecs="avc1.42E01E"')) return p.video.src; if (p.video.webm && v.canPlayType('video/webm; codecs="vp9"')) return p.video.webm; } catch (e) { /* no video */ } return ''; })();
    if (p.video) items.push({ k: 'video', h: 3.3, a: p.video.w / p.video.h, src: p.video.still, vsrc, cap: p.video.cap });
    if (p.film) items.push({ k: 'film', h: 3.7, a: p.film.a, src: p.film.frame, cap: p.film.cap });
    const shots = (p.shots || []).map((sh) => {
      const it = { src: sh.src, cap: sh.cap, a: sh.a || 1.6 };
      if (sh.f === 'browser' && host) return { ...it, k: 'browser', h: sh.h || 3.2 };
      if (sh.f === 'phone') return { ...it, k: 'phone', h: sh.h || 3.4 };
      if (sh.f === 'box') return { ...it, k: 'box', h: sh.h || 2.8, a: 1.1, cap: sh.cap || `${p.name}, boxed: ${p.tag.replace(/^Clay 3D · /, '')}.` };
      if (sh.f === 'hang') return { ...it, k: 'shot', h: sh.h || 1.6, lift: 1.5 };
      return { ...it, k: 'shot', h: sh.h || 3.3 };
    });
    // our own title card (no screenshot in it) after the first frame, for games and systems
    if (cat === 'games' || cat === 'systems') shots.splice(Math.min(1, shots.length), 0, { k: 'title', h: 3.0, a: 1.6, cap: `${p.name}: ${p.note}` });
    // one pull-line in the middle; a hung frame never hangs off the pull card
    let mid = Math.ceil(shots.length / 2); if (shots[mid] && shots[mid].lift) mid++;
    shots.splice(Math.min(mid, shots.length), 0, { k: 'pull', w: 5.0 });
    items.push(...shots);
    // build meshes
    const S0 = Math.min(1024, im ? Math.max(im.width, im.height) : 1024);
    // a lazily filled picture: a dark card now, the real image once the frame comes near (see update)
    const lazy = (it, c, draw) => { const t = tex(c); this.own.push(t); it.load = () => { if (it.loading || !it.src) return; it.loading = true; const img = new Image(); img.decoding = 'async'; img.onload = () => { if (this.dead) return; draw(img); t.needsUpdate = true; it.loaded = true; }; img.onerror = () => {}; img.src = it.src; }; return t; };
    const dark = (w, h, col = '#1c1830') => { const c = canvas(w, h), x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, w, h); return [c, x]; };
    const frameMat = (i) => clay(i % 2 ? '#F2E6D2' : '#E9D8BC', { roughness: 0.5, clearcoat: 0.3 });
    this.frames = [];
    items.forEach((it, i) => {
      const g = it.g = new THREE.Group(); S.add(g);
      if (it.k === 'facts' || it.k === 'pull') { it.w = it.w; it.hgt = 3; return; }
      let fw = it.h * it.a, fh = it.h;
      if (it.k === 'browser') {
        const b = new THREE.Mesh(rbox(fw + 0.24, fh + 0.46, 0.2, 0.14), clay('#F1E3CE', { roughness: 0.45, clearcoat: 0.4 })); b.castShadow = true; g.add(b);
        const bar = new THREE.Mesh(rbox(fw, 0.26, 0.04, 0.06), clay('#E4D2B8')); bar.position.set(0, fh / 2 + 0.06, 0.1); g.add(bar);
        ['#E2533B', '#F2C94C', '#7FB069'].forEach((c, k) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), clay(c)); d.position.set(-fw / 2 + 0.16 + k * 0.15, fh / 2 + 0.06, 0.13); g.add(d); });
        const ut = urlLabel(host); this.own.push(ut); const ul = new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.5, fw * 0.5 / 8), new THREE.MeshBasicMaterial({ map: ut, transparent: true })); ul.position.set(0.1, fh / 2 + 0.06, 0.125); g.add(ul);
        const [c, x] = dark(1280, Math.round(1280 / it.a)), t = lazy(it, c, (img) => drawCover(x, img, 0, 0, c.width, c.height, { fy: 0 }));
        const m = imageMat(t, { bright: 1.02 }); m.uniforms.uZoom.value = 0.92; const sc = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), m); sc.position.set(0, -0.1, 0.105); g.add(sc);
        it.m = m; it.scroll = true; it.fh = fh + 0.46;
      } else if (it.k === 'phone') {
        const b = new THREE.Mesh(rbox(fw + 0.14, fh + 0.2, 0.16, 0.2, 4), clay('#2a2236', { roughness: 0.35, clearcoat: 0.6 })); b.castShadow = true; g.add(b);
        const [c, x] = dark(Math.round(1000 * it.a), 1000), t = lazy(it, c, (img) => drawCover(x, img, 0, 0, c.width, c.height, { fy: 0 }));
        const m = imageMat(t, { bright: 1.02 }); m.uniforms.uZoom.value = 1; const sc = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), m); sc.position.z = 0.085; g.add(sc);
        g.rotation.set(0, -0.25, 0.06); it.m = m; it.fh = fh + 0.2;
      } else if (it.k === 'video' || it.k === 'shot' || it.k === 'film') {
        // lazily filled: a dark card first, then the real still (or the playing loop) once it has loaded
        const [c, x] = dark(it.a >= 1 ? 1280 : Math.round(1280 * it.a), it.a >= 1 ? Math.round(1280 / it.a) : 1280);
        const t = lazy(it, c, (img) => { drawCover(x, img, 0, 0, c.width, c.height); grain(x, c.width, c.height, 5, 3); if (it.k === 'film') playBadge(x, c.width, c.height); });
        const fr = new THREE.Mesh(frameGeo(fw + 0.34, fh + 0.34, 0.14, 0.12, [fw, fh, 0.05]), it.k === 'film' ? clay('#2B2560', { roughness: 0.4, clearcoat: 0.5 }) : frameMat(i)); fr.castShadow = true; fr.receiveShadow = true; g.add(fr);
        const back = new THREE.Mesh(rbox(fw + 0.24, fh + 0.24, 0.04, 0.05), clay('#d8c5a8')); back.position.z = -0.08; g.add(back);
        const m = imageMat(t, { bright: 1.0 }); m.uniforms.uZoom.value = 0.98; g.add(new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), m));
        if (it.lift) hangPeg(g, fw, fh);
        if (it.k === 'video' && it.vsrc) {
          const v = document.createElement('video');
          Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, preload: 'auto' }); v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.crossOrigin = 'anonymous';
          v.addEventListener('playing', () => { if (this.dead || it.vt) return; const vt = new THREE.VideoTexture(v); vt.colorSpace = THREE.SRGBColorSpace; it.vt = vt; this.own.push(vt); m.uniforms.map.value = vt; m.uniforms.uDecode.value = 1; }, { once: true });
          v.addEventListener('error', () => {}, { once: true });
          v.src = it.vsrc; const pr = v.play(); if (pr && pr.catch) pr.catch(() => {});
          this.videos = (this.videos || []).concat(v);
        }
        it.m = m; it.fh = fh + 0.34; fw += 0.34;
      } else if (it.k === 'box') {
        const d = 1.6, b = new THREE.Mesh(rbox(fw, fh, d, 0.1), clay('#F3E7D3', { roughness: 0.6 })); b.castShadow = true; b.position.z = -d / 2 + 0.1; g.add(b);
        const [c, x] = dark(768, Math.round(768 / it.a), '#F3E7D3'), ah = Math.round(c.height * 0.68);
        x.fillStyle = '#EADBC4'; rr(x, 20, 20, c.width - 40, ah, 18); x.fill();
        x.fillStyle = '#1B1208'; x.font = `${Math.round(c.height * 0.11)}px "Instrument Serif"`; x.fillText(p.name, 24, c.height * 0.86); x.fillStyle = '#B5733F'; x.font = `${Math.round(c.height * 0.06)}px VT323`; x.fillText(p.tag.toUpperCase(), 24, c.height * 0.95);
        const t = lazy(it, c, (img) => { x.save(); rr(x, 20, 20, c.width - 40, ah, 18); x.clip(); drawCover(x, img, 20, 20, c.width - 40, ah, { fy: 0.45 }); x.restore(); }); const f = new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.06, fh - 0.06), new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 })); f.position.z = 0.112; g.add(f);
        g.rotation.y = -0.35; it.fh = fh;
      } else {
        const tw = it.a >= 1 ? S0 : Math.round(S0 * it.a), th = it.a >= 1 ? Math.round(S0 / it.a) : S0;
        let t;
        if (it.k === 'hero') { const hc = keyArt(im, p, Math.max(tw, 1024), Math.max(th, Math.round(1024 / it.a))); this.tint = avgColor(hc); t = tex(hc); }
        else t = tex(titleCard(null, p, 1280, 800));   // our own card: the name and tag, no screenshot
        this.own.push(t);
        const fr = new THREE.Mesh(frameGeo(fw + 0.34, fh + 0.34, 0.14, 0.12, [fw, fh, 0.05]), it.k === 'hero' && red ? clay('#2B2560', { roughness: 0.4, clearcoat: 0.5 }) : frameMat(i)); fr.castShadow = true; fr.receiveShadow = true; g.add(fr);
        const back = new THREE.Mesh(rbox(fw + 0.24, fh + 0.24, 0.04, 0.05), clay('#d8c5a8')); back.position.z = -0.08; g.add(back);
        const m = imageMat(t, { bright: 1.0 }); m.uniforms.uZoom.value = 0.96; const pic = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), m); g.add(pic);
        it.m = m; it.fh = fh + 0.34;
        if (it.k === 'hero' && red) { const glow = new THREE.Mesh(new THREE.PlaneGeometry(fw + 1.6, fh + 1.6), new THREE.MeshBasicMaterial({ map: this.poolT, color: '#ff6a50', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.z = -0.12; g.add(glow); }
        fw += 0.34;
      }
      it.fw = fw; it.w = fw;
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(fw + 2.2, (it.fh || fh) + 2.6), new THREE.MeshBasicMaterial({ map: this.poolT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.45 })); pool.position.z = -0.3; g.add(pool); it.pool = pool;
      this.frames.push(it);
    });
    // next project card
    const nIdx = (idx + 1) % P.length, np = P[nIdx], nim = ctx.images[nIdx]; this.nextIdx = nIdx;
    { const fw = 3.4, fH = 2.6, g = new THREE.Group(); S.add(g);
      const fr = new THREE.Mesh(frameGeo(fw, fH, 0.18, 0.16, [fw - 0.36, fH - 0.36, 0.06]), clay('#2B2560', { roughness: 0.4, clearcoat: 0.5 })); fr.castShadow = true; g.add(fr);
      const t = tex(keyArt(nim, np, 1024, Math.round(1024 * (fH - 0.36) / (fw - 0.36)))); this.own.push(t); const m = imageMat(t, { bright: 0.75 }); g.add(new THREE.Mesh(new THREE.PlaneGeometry(fw - 0.36, fH - 0.36), m));
      this.next = { g, m, w: fw, k: 'next' }; items.push(this.next); }
    // a thin colour band behind the whole project, tinted from its key art
    { const tc = new THREE.Color(...(this.tint || [0.8, 0.6, 0.5])); const hsl = {}; tc.getHSL(hsl); tc.setHSL(hsl.h, Math.min(0.55, hsl.s + 0.15), 0.62);
      this.band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: tc, roughness: 0.95 })); this.band.position.z = -0.86; S.add(this.band); }
    // ledge under the frames (desktop) + soft contact shadow
    this.ledge = new THREE.Mesh(rbox(1, 0.2, 1.1, 0.08), clay('#B97E58')); this.ledge.castShadow = true; this.ledge.receiveShadow = true; S.add(this.ledge);
    // overlay DOM: facts card, captions, pull-line (all real text, positioned over the 3D)
    const L = this.layer = document.createElement('div'); L.className = 'pp-layer'; (ctx.ppEl || document.body).appendChild(L);
    const facts = (p.facts || []).map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    items.forEach((it, i) => {
      if (it.k === 'facts') { it.el = Object.assign(document.createElement('div'), { className: 'pp-facts', innerHTML: `<p class="pp-ftag">THE FACTS</p><dl>${facts}</dl>${p.url ? `<a class="wr-link" href="${p.url}" target="_blank" rel="noopener">${(p.visit || 'Visit') + ' ↗'}</a>` : ''}` }); L.appendChild(it.el); }
      else if (it.k === 'pull') { it.el = Object.assign(document.createElement('blockquote'), { className: 'pp-pull', innerHTML: `<p>${p.pull || PULL[cat] || ''}</p><cite>RDW Labz, in our own words</cite>` }); L.appendChild(it.el); }
      else if (it.cap) { it.el = Object.assign(document.createElement('p'), { className: 'pp-cap' + (it.lift ? ' side' : ''), innerHTML: it.cap }); L.appendChild(it.el); }
      if (it.k === 'film') {   // a real button over the film frame: opens the player
        const b = it.btn = Object.assign(document.createElement('button'), { type: 'button', className: 'pp-play', innerHTML: `<span aria-hidden="true">▶</span> ${p.film.label || 'Watch the video'}` });
        b.setAttribute('aria-label', `${p.film.label || 'Watch the video'}: ${p.name}, ${p.film.secs} seconds, with sound`); b.addEventListener('click', () => this.openFilm(b)); L.appendChild(b);
      }
    });
    this.gx = new Spring(0, 70, 16); this.drag = null; this.vel = 0; this._v = new THREE.Vector3();
    this.layout(ctx.aspect, ctx.mobile);
  }
  layout(a, mob) {
    this.items.forEach((it) => { it.ew = 0; });
    this.cam.aspect = a; this.mob = mob; this.cam.fov = mob ? 50 : 36; this.cam.updateProjectionMatrix();
    this.z = mob ? 10.5 : 11.2;
    const visW = 2 * this.z * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * a;
    // lay items out along x (desktop) or down y (phone); phones scale frames to the column width
    let pos = 0; const gap = mob ? 1.0 : 0.7, colW = visW * 0.86;
    this.items.forEach((it) => {
      const sc = mob && it.w ? Math.min(1, colW / it.w) : 1; it.sc = sc;
      const size = mob ? (it.k === 'facts' ? 0.1 : it.k === 'pull' ? 3.4 : (it.fh || 2.6) * sc + 0.9) : it.w * sc;
      if (mob && it.k === 'facts') { it.pos = pos; if (it.g) it.g.visible = false; return; }
      // desktop: a hung UI crop overlaps the shoulder of the frame before it (a collage, not a row)
      if (!mob && it.lift) { it.pos = pos - gap - size * 0.12; pos += size * 0.38; }
      else { it.pos = pos + size / 2; pos += size + gap; }
      if (it.g) { it.g.scale.setScalar(sc); if (mob) it.g.position.set(0, -it.pos, 0.2); else it.g.position.set(it.pos, (it.lift ? it.lift : -1.15) + (it.fh || it.h || 2.6) / 2 + (it.k === 'phone' ? 0.1 : 0), it.lift ? 0.45 : 0.15); }
    });
    this.len = pos;
    if (!mob) { this.band.scale.set(pos + 24, 1.6, 1); this.band.position.set(pos / 2, 0.55, -0.86); this.band.rotation.z = 0; } else { this.band.scale.set(this.len + 24, 1.4, 1); this.band.rotation.z = Math.PI / 2; this.band.position.set(-1.6, -this.len / 2, -0.86); }
    if (!mob) { this.ledge.visible = true; this.ledge.scale.set(pos + 6, 1, 1); this.ledge.position.set(pos / 2, -1.25, 0.2); this.floor.position.y = -3.2; this.wall.position.x = pos / 2; this.keyL.position.set(pos / 2 - 4, 8, 8); this.keyL.target.position.set(pos / 2, 0, 0); { const c = this.keyL.shadow.camera; c.left = -pos / 2 - 4; c.right = pos / 2 + 4; c.updateProjectionMatrix(); } }
    else { this.ledge.visible = false; this.floor.visible = false; this.wall.position.set(0, -this.len / 2 + 10, -0.9); this.wall.rotation.z = Math.PI / 2; this.hint = '<kbd>drag</kbd> or scroll <span class="ar">↓</span> · <kbd>Esc</kbd> close'; this.keyL.position.set(-4, 6, 10); }
    // the camera starts with the hero right of the text column (desktop) / under the title (phone)
    this.x0 = mob ? this.items[0].pos - 1.6 : this.items[0].pos - visW * 0.2;
    this.max = mob ? this.next.pos - this.x0 - 1.0 : this.next.pos - this.x0;
    this.visW = visW;
  }
  update(t, dt, inp) {
    const g = this.gx; if (!this.drag) g.t = clamp(g.t, 0, this.max); g.step(dt);
    const c = this.x0 + g.x, mx = inp ? inp.mx : 0, my = inp ? inp.my : 0, now = performance.now() / 1000, R = this.ctx.reduced;
    if (this.mob) { this.cam.position.set(mx * 0.2, -c + my * 0.1, this.z); this.cam.lookAt(0, -c, 0); this.keyL.target.position.set(0, -c, 0); this.keyL.position.set(-4, -c + 6, 10); }
    else { this.cam.position.set(c + mx * 0.3, 0.9 + my * 0.15, this.z); this.cam.lookAt(c, 0.35, 0); }
    const vel = (g.x - (this.px ?? g.x)) / Math.max(dt, 1e-3); this.px = g.x;
    const near = this.mob ? 16 : this.visW * 1.4;
    this.frames.forEach((it, i) => {
      if (it.load && !it.loading && Math.abs(it.pos - c) < near) it.load();   // lazy: only frames near the camera fetch their image
      const rel = this.mob ? (it.pos - c) / 6 : (it.pos - c) / 7;
      if (it.m) { it.m.uniforms.uOff.value.set(clamp(rel, -1, 1) * -0.025, it.scroll && !R ? 0.08 * Math.cos(now * 0.4 + rel) : 0); it.m.uniforms.uSheen.value = clamp(rel, -1, 1) * 0.6; }
      if (!this.mob && it.k !== 'phone' && it.k !== 'box') it.g.rotation.y = clamp(-vel * 0.004, -0.12, 0.12) + (R ? 0 : Math.sin(now * 0.6 + i) * 0.006);
    });
    this.next.m.uniforms.uSheen.value = clamp(((this.next.pos) - c) / 6, -1, 1) * 0.6;
    this.prog = this.max > 0 ? g.x / this.max : 0;
    this.place();
    if (this.onTick) this.onTick(this);
  }
  // project overlay text onto the 3D layout
  place() {
    const W = this.ctx.W, H = this.ctx.H, v = this._v;
    this.items.forEach((it) => {
      if (it.btn) { it.g.getWorldPosition(v); v.project(this.cam); const bx = (v.x * 0.5 + 0.5) * W, by = (-v.y * 0.5 + 0.5) * H, on = bx > 0 && bx < W && by > 60 && by < H - 60; it.btn.style.visibility = on ? 'visible' : 'hidden'; it.btn.tabIndex = on ? 0 : -1; if (on) it.btn.style.transform = `translate(${bx.toFixed(1)}px,${by.toFixed(1)}px) translate(-50%,-50%)`; }
      if (!it.el) return;
      if (it.k === 'facts' || it.k === 'pull') { if (this.mob && it.k === 'facts') { it.el.style.display = 'none'; return; } v.set(this.mob ? 0 : it.pos, this.mob ? -it.pos : 0.55, 0.2); }
      else if (!this.mob && it.lift) v.set(it.pos + it.w / 2 + 0.25, it.lift + it.fh * 0.72, 0.5);   // hung frames: caption sits beside, never over the frame below
      else v.set(this.mob ? 0 : it.pos - it.w * it.sc / 2, this.mob ? -it.pos - (it.fh * it.sc) / 2 - 0.1 : (it.lift ? it.lift - 0.08 : -1.42), 0.3);
      v.project(this.cam);
      let x = (v.x * 0.5 + 0.5) * W; const y = (-v.y * 0.5 + 0.5) * H, on = x > -400 && x < W + 400 && y > -300 && y < H + 300;
      it.el.style.visibility = on ? 'visible' : 'hidden';
      if (!this.mob && on) {
        // never clip words at the frame edges: the facts card pins 56px in and fades as the gallery pushes it; captions fade before an edge
        const w = it.ew || (it.ew = it.el.offsetWidth || 300), centred = it.k === 'facts' || it.k === 'pull';
        let left = centred ? x - w / 2 : x, op;
        if (it.k === 'facts') { const push = Math.max(0, 56 - left); x += push; left += push; op = clamp(1 - push / 140) * clamp((W - 56 - left - w) / 120 + 1); }
        else op = clamp((left - 24) / 90) * clamp((W - 24 - left - w) / 90);
        it.el.style.opacity = String(op);
      }
      if (on) it.el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
      if (this.mob) it.el.style.opacity = String(clamp((y - 70) / 40) * clamp((H - 100 - y) / 40));   // fade before the header and the hint bar
    });
  }
  nextScreenPos() { const v = this.next.g.position.clone().project(this.cam); return [v.x * 0.5 + 0.5, v.y * 0.5 + 0.5]; }
  scrollBy(d) { this.gx.t = clamp(this.gx.t + d, 0, this.max); }
  scrollTo(k) { this.gx.t = clamp(k, 0, 1) * this.max; }
  wheel(e) { const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 16 : 1); this.scrollBy(d * 0.008); }
  pointer(type, e, ndc, over) {
    if (this.filmEl) return;   // the player is open: no gallery drags under it
    const coord = (ev) => (this.mob ? -ev.clientY : ev.clientX);
    if (type === 'down' && !over) { this.drag = { x: coord(e), g: this.gx.t, t: performance.now(), lx: coord(e) }; this.vel = 0; }
    else if (type === 'move' && this.drag) {
      const k = this.mob ? (this.z * 2 * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2))) / window.innerHeight : (this.z * 2 * Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * this.cam.aspect) / window.innerWidth;
      const now = performance.now(), cx = coord(e);
      this.vel = lerp(this.vel, -(cx - this.drag.lx) * k / Math.max(1e-3, (now - this.drag.t) / 1000), 0.5); this.drag.t = now; this.drag.lx = cx;
      this.gx.t = clamp(this.drag.g - (cx - this.drag.x) * k * 1.1, -0.6, this.max + 0.6); this.gx.x = lerp(this.gx.x, this.gx.t, 0.5);
    } else if (type === 'up' && this.drag) { this.gx.t = clamp(this.gx.t + clamp(this.vel, -20, 20) * 0.18, 0, this.max); this.drag = null; }
  }
  key(e) {
    if (this.filmEl) { if (e.key === 'Escape') { this.closeFilm(); return true; } return false; }   // the player gets its own keys (space, arrows)
    const step = this.max / 8;
    if (['ArrowRight', 'PageDown', 'ArrowDown'].includes(e.key)) { this.scrollBy(step); return true; }
    if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) { this.scrollBy(-step); return true; }
    if (e.key === 'Home') { this.scrollTo(0); return true; } if (e.key === 'End') { this.scrollTo(1); return true; }
    if (e.key === 'Escape') { this.onClose && this.onClose(); return true; }
    return false;
  }
  // the full film in a real <video controls> overlay: click to play with sound, no autoplay under reduced motion
  openFilm(from) {
    const f = this.p.film; if (!f || this.filmEl) return;
    const pp = this.ctx.ppEl, el = this.filmEl = document.createElement('div');
    el.className = 'pp-film'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `${this.p.name}: the full video`);
    el.innerHTML = `<div class="pp-film-box"><video controls playsinline preload="metadata" poster="${f.poster}" width="${f.w}" height="${f.h}"><source src="${f.src}" type="video/mp4">${f.webm ? `<source src="${f.webm}" type="video/webm">` : ''}</video>
      <div class="pp-film-row"><p>${f.cap || ''}</p><button type="button" class="pp-film-x">Close <span aria-hidden="true">✕</span></button></div></div>`;
    document.body.appendChild(el);
    const v = this.filmV = el.querySelector('video'), x = el.querySelector('.pp-film-x');
    this.filmFrom = from || document.activeElement; if (pp) pp.inert = true;
    x.addEventListener('click', () => this.closeFilm());
    el.addEventListener('click', (e) => { if (e.target === el) this.closeFilm(); });
    el.addEventListener('keydown', (e) => { if (e.key !== 'Tab') return; const a = v, z = x; if (e.shiftKey && document.activeElement === a) { z.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === z) { a.focus(); e.preventDefault(); } });
    requestAnimationFrame(() => el.classList.add('on'));
    v.focus({ preventScroll: true });
    if (!this.ctx.reduced) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }   // opened by a click, so sound is allowed; reduced motion waits for play
  }
  closeFilm() {
    const el = this.filmEl; if (!el) return; this.filmEl = null;
    try { this.filmV.pause(); } catch (e) { /* gone */ }
    el.remove(); this.filmV = null; if (this.ctx.ppEl) this.ctx.ppEl.inert = false;
    if (this.filmFrom && this.filmFrom.focus && this.filmFrom.isConnected) this.filmFrom.focus({ preventScroll: true });
  }
  showLayer(on) { this.layer.classList.toggle('on', on); }
  dispose() {
    this.dead = true; if (this.filmEl) { this.filmEl.remove(); this.filmEl = null; } (this.videos || []).forEach((v) => { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* gone */ } });
    this.layer.remove();
    this.scene.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material && !m.material.userData.shared) m.material.dispose(); });
    this.own.forEach((t) => t.dispose());
  }
}
