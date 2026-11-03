// Router, boot overlay, smooth scroll and WebGL detection for the real routes:
// `/` is the 3D home and `/about` is the paper walk. Hash links stay same-page anchors.

const site = document.getElementById('site');
const homeEl = document.getElementById('home');
const aboutEl = document.getElementById('about');
const isAboutPage = !!aboutEl && !homeEl;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// cheap capability check (creating a probe context costs ~0.4 s on software GL); a real failure later falls back via catch
function hasGL() { return !!(window.WebGL2RenderingContext || window.WebGLRenderingContext); }
const GL = hasGL() && !/[?&]nogl/.test(location.search);
if (!GL) site.classList.add('nogl');

let current = null, currentRoute = null, lenis = null, switching = Promise.resolve();

function freshCanvas() {
  const old = document.getElementById('gl');
  const c = document.createElement('canvas');
  c.id = 'gl'; c.setAttribute('aria-hidden', 'true');
  old.replaceWith(c);
  return c;
}

// ---------- boot overlay (home, first load) ----------
function runBoot() {
  const boot = document.getElementById('boot');
  const pre = document.getElementById('bootLines');
  const bar = document.querySelector('#bootBar i');
  const lines = [
    'RDW WORKBENCH OS 2.6',
    '(C) 2026 RDW, LLC  HARRISON, AR',
    'CLAY.SYS ............ OK',
    'PACKS 48 / MODELS 730 / TEX 176',
    'WARMING THE KILN ...',
  ];
  const phone = matchMedia('(hover: none)').matches || window.innerWidth < 800;
  const total = reduced ? 500 : phone ? 750 : 1300;
  const t0 = performance.now();
  let done = false;
  return new Promise((resolve) => {
    const finish = () => {
      if (done) return; done = true;
      boot.classList.add('out');
      window.removeEventListener('keydown', finish); boot.removeEventListener('click', finish);
      setTimeout(() => { boot.hidden = true; }, 500);
      resolve();
    };
    window.addEventListener('keydown', finish); boot.addEventListener('click', finish);
    setTimeout(finish, Math.min(2000, total + 600));   // hard cap on its own clock: never waits on rAF
    // and a compositor-driven fade that completes by 2 s even if the main thread is busy building the scene
    try { const st = document.createElement('style'); st.textContent = '@keyframes bootAutoOut{to{opacity:0;visibility:hidden}}'; (document.head || document.body).appendChild(st);
      boot.style.animation = `bootAutoOut .35s ease ${Math.min(2000, total + 600) - 350}ms forwards`; } catch (e) { /* timer above still hides it */ }
    const tick = () => {
      if (done) return;
      const p = Math.min(1, (performance.now() - t0) / total);
      const chars = Math.floor(p * 1.15 * lines.join('\n').length);
      pre.textContent = lines.join('\n').slice(0, chars) + (Math.floor(performance.now() / 250) % 2 ? '_' : ' ');
      bar.style.width = (p * 100).toFixed(1) + '%';
      if (p >= 1) setTimeout(finish, 120); else requestAnimationFrame(tick);
    };
    tick();
  });
}

function hideBoot() { const b = document.getElementById('boot'); if (b) b.hidden = true; }

// ---------- routing ----------
async function go(route) {
  if (route === currentRoute) return;
  if (current) { try { current.stop(); } catch (e) { /* ignore */ } current = null; }
  if (lenis) { lenis.destroy(); lenis = null; }
  currentRoute = route;
  site.dataset.route = route;
  if (homeEl) homeEl.hidden = route !== 'home';
  if (aboutEl) aboutEl.hidden = route !== 'about';
  window.scrollTo(0, 0);
  if (!GL) { hideBoot(); return; }
  const canvas = freshCanvas();
  try {
    if (route === 'home') {
      if (!reduced) {
        try { const { default: Lenis } = await import('lenis'); lenis = new Lenis({ lerp: 0.1, smoothWheel: true, syncTouch: false }); }
        catch (e) { lenis = null; } // native scroll still works
      }
      const m = await import('./home.js');
      current = await m.startHome({ canvas, reduced, lenis }); window.__cur = current; // TEMP-DEBUG
    } else {
      hideBoot();
      const m = await import('./about.js');
      current = await m.startAbout({ canvas, reduced });
    }
  } catch (e) {
    // three.js could not load or WebGL failed: fall back to the static HTML version
    console.warn('3D unavailable, showing static version', e);
    site.classList.add('nogl'); hideBoot();
    const l = document.getElementById('aLoader'); if (l) l.hidden = true;
  }
}

function applyAnchor() {
  const h = location.hash;
  if (h === '#main') { const m = document.getElementById('main'); if (m) { m.focus({ preventScroll: true }); m.scrollIntoView(); } return; }
  if (current && current.anchor) return current.anchor(h);
  // Static fallback pages still honour the nav landmarks.
  if (h === '' || h === '#top') { window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); return; }
  if (h === '#about-rest') { document.getElementById('about-rest')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); return; }
  const target = h === '#work' || h === '#bench' ? document.getElementById('bench') : h === '#contact' ? document.getElementById('contact') : null;
  if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}

function add3DLink() {
  if (document.getElementById('open3d')) return;
  const a = document.createElement('a');
  a.id = 'open3d';
  a.href = '/?quality=high';
  a.textContent = 'Open the 3D workbench';
  a.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:60;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,240,235,.35);background:rgba(20,15,13,.9);color:#F3E9D8;font:500 13px "Instrument Sans",system-ui,sans-serif;text-decoration:none';
  document.body.appendChild(a);
}

function addWalkLink() {
  if (document.getElementById('openwalk')) return;
  const a = document.createElement('a');
  a.id = 'openwalk';
  a.href = '/about?walk=1';
  a.textContent = 'Open the paper walk';
  a.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:60;padding:10px 14px;border-radius:999px;border:1px solid rgba(60,45,30,.3);background:rgba(243,241,234,.94);color:#2b2b2b;font:600 13px "Patrick Hand",cursive;text-decoration:none';
  document.body.appendChild(a);
}

function setHash(h) {
  const url = h ? h : location.pathname + location.search;
  try { history.pushState(null, '', url); }
  catch (e) { location.hash = h; return; }
  applyAnchor();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  if (a.id === 'aSkip' || a.id === 'aPlain' || a.id === 'skipRest') return; // about.js owns these
  const h = a.getAttribute('href');
  e.preventDefault();
  setHash(h === '#top' ? '' : h);
});
window.addEventListener('popstate', applyAnchor);
window.addEventListener('hashchange', applyAnchor);

// First load
(async () => {
  // Old hash deep links from the prototype still land on the real About route.
  if (!isAboutPage && (location.hash === '#about' || location.hash === '#about-rest')) {
    location.replace('/about' + (location.hash === '#about-rest' ? '#about-rest' : ''));
    return;
  }
  const route = isAboutPage ? 'about' : 'home';
  site.dataset.route = route;
  // Phones get the approved static workbench by default (the 3D scene is a desktop-class
  // experience); the button opts into the full WebGL home. ?quality=… also opts in.
  if (route === 'home' && (matchMedia('(hover: none)').matches || window.innerWidth < 800) && !new URLSearchParams(location.search).has('quality')) {
    site.classList.add('nogl');
    hideBoot();
    add3DLink();
    applyAnchor();
    return;
  }
  if (route === 'about') {
    const phone = matchMedia('(hover: none)').matches || window.innerWidth < 800;
    const forceWalk = new URLSearchParams(location.search).has('walk');
    // Phones (and any ?plain deep link) get the paper version immediately; the walk is one tap away.
    if (aboutEl && (location.hash === '#about-rest' || (phone && !forceWalk))) {
      site.classList.add('nogl');
      aboutEl.classList.add('plain');
      hideBoot();
      if (phone && !forceWalk) addWalkLink();
      applyAnchor();
      return;
    }
    await go('about');
    applyAnchor();
    return;
  }
  if (GL) {
    const phone = matchMedia('(hover: none)').matches || window.innerWidth < 800;
    const boot = phone ? Promise.resolve() : runBoot();
    if (phone) hideBoot();   // phones: show the hero immediately; the 3D fades in behind it
    // hard fallback: no 3D frame 8 s after load -> static page with a way back to the 3D one
    setTimeout(() => {
      if (window.__firstFrame || currentRoute !== 'home' || site.classList.contains('nogl')) return;
      site.classList.add('nogl'); hideBoot();
      const a = document.createElement('button'); a.type = 'button'; a.textContent = 'Show 3D anyway';
      a.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:60;padding:10px 14px;border-radius:999px;border:1px solid rgba(255,240,235,.35);background:rgba(20,15,13,.9);color:#F3E9D8;font:500 13px "Instrument Sans",system-ui,sans-serif;cursor:pointer';
      a.onclick = () => { site.classList.remove('nogl'); a.remove(); };
      document.body.appendChild(a);
      // slow but alive (e.g. software GL): switch back by itself as soon as the first 3D frame lands
      const back = setInterval(() => { if (!document.body.contains(a)) { clearInterval(back); return; } if (window.__firstFrame) { clearInterval(back); a.click(); } }, 250);
    }, 8000);
    // Paint the hero shell before pulling the heavy 3D bundle onto the main thread,
    // so the largest text is committed even on a throttled phone.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await go('home');
    await boot;
    if (current && current.bootDone) current.bootDone();
    if (current && current.anchor) current.anchor(location.hash);
  } else {
    await go('home');
  }
})();

// Lenis RAF is driven here so every route shares one clock.
function raf(t) { if (lenis) lenis.raf(t); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
export function getLenis() { return lenis; }
