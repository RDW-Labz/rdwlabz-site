/**
 * Background loops ([data-loop-media]): the <video> is created only when it may play (on screen,
 * tab visible, motion not paused or reduced, no Data Saver), so nothing downloads otherwise.
 * A failed video is removed and the poster / CSS placeholder stays. [data-loop-toggle] buttons
 * flip the site-wide pause state.
 */
import { MOTION_EVENT, isPaused, prefersReduced, saveData, setPaused } from './motion-state';

let teardown: (() => void) | null = null;

export function initLoopVideos() {
  teardown?.();
  const cleanups: (() => void)[] = [];
  const holders = [...document.querySelectorAll<HTMLElement>('[data-loop-media]')];
  const toggles = [...document.querySelectorAll<HTMLButtonElement>('[data-loop-toggle]')];
  const visible = new Map<HTMLElement, boolean>();
  const allowed = () => !prefersReduced() && !isPaused() && !saveData() && !document.hidden;

  const pick = (el: HTMLElement) => {
    const portrait = window.matchMedia('(max-aspect-ratio: 4/5)').matches;
    const d = el.dataset;
    const webm = (portrait && d.webmPortrait) || d.webm;
    const mp4 = (portrait && d.mp4Portrait) || d.mp4;
    const probe = document.createElement('video');
    if (webm && probe.canPlayType('video/webm; codecs="vp9"')) return webm;
    return mp4 ?? webm ?? null;
  };

  const update = () => {
    for (const el of holders) {
      const src = el.dataset.failed ? null : pick(el);
      let video = el.querySelector<HTMLVideoElement>('video');
      if (!src) continue;
      if (allowed() && visible.get(el)) {
        if (!video) {
          video = document.createElement('video');
          Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto' });
          video.setAttribute('aria-hidden', 'true');
          video.setAttribute('tabindex', '-1');
          if (el.dataset.poster) video.poster = el.dataset.poster;
          video.addEventListener('playing', () => el.classList.add('is-playing'), { once: true });
          video.addEventListener('error', () => {
            el.dataset.failed = '1';
            el.classList.remove('is-playing');
            video?.remove();
          });
          video.src = src;
          el.append(video);
        }
        video.play().catch(() => {
          /* autoplay refused: the poster / placeholder stays */
        });
      } else {
        video?.pause();
      }
    }
    for (const t of toggles) {
      t.setAttribute('aria-pressed', String(isPaused()));
      const label = t.querySelector('[data-loop-label]');
      if (label) label.textContent = isPaused() ? 'Play animations' : 'Pause animations';
    }
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) visible.set(e.target as HTMLElement, e.isIntersecting);
      update();
    });
    holders.forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());
  } else {
    holders.forEach((el) => visible.set(el, true));
  }

  const onToggle = () => setPaused(!isPaused());
  toggles.forEach((t) => t.addEventListener('click', onToggle));
  document.addEventListener(MOTION_EVENT, update);
  document.addEventListener('visibilitychange', update);
  cleanups.push(() => {
    toggles.forEach((t) => t.removeEventListener('click', onToggle));
    document.removeEventListener(MOTION_EVENT, update);
    document.removeEventListener('visibilitychange', update);
  });
  update();

  teardown = () => {
    cleanups.forEach((fn) => fn());
    holders.forEach((el) => el.querySelector('video')?.pause());
    teardown = null;
  };
  document.addEventListener('astro:before-swap', () => teardown?.(), { once: true });
}
