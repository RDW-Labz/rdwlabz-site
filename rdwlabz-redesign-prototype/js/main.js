// Router, boot overlay, smooth scroll and WebGL detection.

const site = document.getElementById('site');
const homeEl = document.getElementById('home');
const aboutEl = document.getElementById('about');
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
  const total = reduced ? 600 : 1300;
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

function hideBoot() { const b = document.getElementById('boot'); b.hidden = true; }

// ---------- routing ----------
async function go(route) {
  if (route === currentRoute) return;
  if (current) { try { current.stop(); } catch (e) { /* ignore */ } current = null; }
  if (lenis) { lenis.destroy(); lenis = null; }
  currentRoute = route;
  site.dataset.route = route;
  homeEl.hidden = route !== 'home';
  aboutEl.hidden = route !== 'about';
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

function routeOf(h) { return h === '#about' || h === '#about-rest' ? 'about' : 'home'; }

async function applyRoute() {
  const h = location.hash;
  switching = switching.then(() => go(routeOf(h))).catch((e) => console.warn(e));
  await switching;
  if (current && current.anchor) current.anchor(h);
}

function setHash(h) {
  try { history.pushState(null, '', h || (location.pathname + location.search)); }
  catch (e) { location.hash = h; return; }
  applyRoute();
}

document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  e.preventDefault();
  const h = a.getAttribute('href');
  setHash(h === '#top' ? '' : h);
});
window.addEventListener('popstate', applyRoute);
window.addEventListener('hashchange', applyRoute);

// First load
(async () => {
  const route = routeOf(location.hash);
  if (route === 'home' && GL) {
    const boot = runBoot();
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
    await go('home');
    await boot;
    if (current && current.bootDone) current.bootDone();
    if (current && current.anchor) current.anchor(location.hash);
  } else {
    await applyRoute();
  }
})();

// Lenis RAF is driven here so every route shares one clock.
function raf(t) { if (lenis) lenis.raf(t); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
export function getLenis() { return lenis; }
