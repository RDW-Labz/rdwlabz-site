// [smooth] long jumps (nav links, chapter rail) fade through black and land instantly, instead of
// scrubbing at speed through every beat and transition in between (that read as glitchy).
let el = null, busy = false;
function veil() {
  if (el) return el;
  el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#07060a;opacity:0;pointer-events:none;transition:opacity .28s cubic-bezier(.4,0,.2,1)';
  document.body.appendChild(el);
  return el;
}
const frames = (n) => new Promise((r) => { const f = () => (n-- <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
export function smoothJump(lenis, y, { reduced = false, near = 1.6, duration } = {}) {
  const vh = window.innerHeight, d = Math.abs(y - window.scrollY) / vh;
  if (reduced) { if (lenis) lenis.scrollTo(y, { immediate: true }); else window.scrollTo(0, y); return; }
  if (d <= near) {   // short hops still glide
    if (lenis) lenis.scrollTo(y, { duration: duration ?? Math.min(1.4, 0.7 + d * 0.35), easing: (t) => 1 - Math.pow(1 - t, 3) });
    else window.scrollTo({ top: y, behavior: 'smooth' });
    return;
  }
  if (busy) return; busy = true;
  const v = veil(); v.style.opacity = '1';
  setTimeout(async () => {
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y);
    await frames(3);
    v.style.opacity = '0'; busy = false;
  }, 300);
}
