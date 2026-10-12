/**
 * Small motion layer:
 * - scroll reveals for [data-reveal] (once each, then unobserved)
 * - pauses looping [data-loop] animations while offscreen or while the tab is hidden
 * Everything is torn down before each client-side navigation.
 */
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let teardown: (() => void) | null = null;

export function initMotion() {
  teardown?.();
  const observers: IntersectionObserver[] = [];

  const reveals = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (reduced() || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-revealed'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-revealed');
          io.unobserve(e.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -5% 0px' },
    );
    reveals.forEach((el) => io.observe(el));
    observers.push(io);
  }

  const loops = document.querySelectorAll<HTMLElement>('[data-loop]');
  const visible = new Map<Element, boolean>();
  const apply = () => {
    loops.forEach((el) => {
      el.dataset.paused = String(document.hidden || !visible.get(el));
    });
  };
  if ('IntersectionObserver' in window && loops.length) {
    const loopIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => visible.set(e.target, e.isIntersecting));
      apply();
    });
    loops.forEach((el) => loopIo.observe(el));
    observers.push(loopIo);
  }
  document.addEventListener('visibilitychange', apply);

  // Scroll progress fallback where CSS scroll timelines are missing (or reduced motion is on).
  const bar = document.querySelector<HTMLElement>('[data-scroll-progress]');
  let frame = 0;
  const onScroll = () => {
    if (frame || !bar) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      bar.style.setProperty('--sp', max > 0 ? (scrollY / max).toFixed(4) : '0');
    });
  };
  const cssDriven = CSS.supports('animation-timeline: scroll()') && !reduced();
  if (bar && !cssDriven) {
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  teardown = () => {
    observers.forEach((o) => o.disconnect());
    document.removeEventListener('visibilitychange', apply);
    window.removeEventListener('scroll', onScroll);
    cancelAnimationFrame(frame);
    teardown = null;
  };
  document.addEventListener('astro:before-swap', () => teardown?.(), { once: true });
}
