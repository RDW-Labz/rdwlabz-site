/**
 * Home hero:
 * - "We build [word]" cycler (letters flip in, colored per category)
 * - parallax on the lab bench: pointer on desktop, scroll on touch
 * - "Pause animations" toggle (WCAG 2.2.2), remembered in localStorage
 * Nothing runs under reduced motion, while paused, offscreen or in a hidden tab.
 */
import {
  MOTION_EVENT,
  isPaused as paused,
  prefersReduced as reduced,
  setPaused,
} from './motion-state';

let teardown: (() => void) | null = null;

export function initHero() {
  teardown?.();
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const bench = document.querySelector<HTMLElement>('[data-bench]');
  if (!hero || !bench) return;
  const cleanups: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(
    target: Window | HTMLElement,
    type: K,
    fn: (e: WindowEventMap[K]) => void,
  ) => {
    target.addEventListener(type, fn as EventListener, { passive: true });
    cleanups.push(() => target.removeEventListener(type, fn as EventListener));
  };
  const live = () => !reduced() && !paused() && !document.hidden && bench.dataset.paused !== 'true';

  // Pause toggle
  const toggle = document.querySelector<HTMLButtonElement>('[data-motion-toggle]');
  const label = toggle?.querySelector<HTMLElement>('[data-motion-label]');
  const sync = () => {
    toggle?.setAttribute('aria-pressed', String(paused()));
    if (label) label.textContent = paused() ? 'Play animations' : 'Pause animations';
  };
  if (toggle) {
    sync();
    const onToggle = () => setPaused(!paused());
    const onChange = () => {
      sync();
      if (paused()) setVars(0, 0);
    };
    toggle.addEventListener('click', onToggle);
    document.addEventListener(MOTION_EVENT, onChange);
    cleanups.push(() => {
      toggle.removeEventListener('click', onToggle);
      document.removeEventListener(MOTION_EVENT, onChange);
    });
  }

  // Word cycler
  const words = [...hero.querySelectorAll<HTMLElement>('[data-word]')];
  if (words.length > 1) {
    let i = 0;
    const timer = window.setInterval(() => {
      if (!live()) return;
      const prev = words.find((w) => w.classList.contains('is-off'));
      prev?.classList.remove('is-off');
      words[i].classList.replace('is-on', 'is-off');
      i = (i + 1) % words.length;
      words[i].classList.add('is-on');
    }, 2400);
    cleanups.push(() => window.clearInterval(timer));
  }

  // Parallax
  let frame = 0;
  let tx = 0;
  let ty = 0;
  function setVars(x: number, y: number) {
    bench!.style.setProperty('--px', x.toFixed(3));
    bench!.style.setProperty('--py', y.toFixed(3));
  }
  const schedule = (x: number, y: number) => {
    tx = Math.max(-1, Math.min(1, x));
    ty = Math.max(-1, Math.min(1, y));
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        setVars(tx, ty);
      });
  };
  if (window.matchMedia('(pointer: fine)').matches) {
    on(hero, 'pointermove', (e) => {
      if (!live()) return;
      const r = bench.getBoundingClientRect();
      schedule(
        (e.clientX - (r.left + r.width / 2)) / (r.width / 2),
        (e.clientY - (r.top + r.height / 2)) / (r.height / 2),
      );
    });
    on(hero, 'pointerleave', () => schedule(0, 0));
  } else {
    on(window, 'scroll', () => {
      if (!live()) return;
      const r = bench.getBoundingClientRect();
      schedule(0, ((r.top + r.height / 2 - innerHeight / 2) / innerHeight) * -1.6);
    });
  }

  teardown = () => {
    cleanups.forEach((fn) => fn());
    cancelAnimationFrame(frame);
    teardown = null;
  };
  document.addEventListener('astro:before-swap', () => teardown?.(), { once: true });
}
