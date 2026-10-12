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

  teardown = () => {
    observers.forEach((o) => o.disconnect());
    document.removeEventListener('visibilitychange', apply);
    teardown = null;
  };
  document.addEventListener('astro:before-swap', () => teardown?.(), { once: true });
}
