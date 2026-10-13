/**
 * Pack cards spin on hover or keyboard focus: the turntable <video> is created on first
 * intent (nothing downloads before), plays while hovered/focused and rewinds on leave.
 * Off under reduced motion, paused motion and Data Saver; the WebP poster stays.
 */
import { isPaused, prefersReduced, saveData } from './motion-state';

export function initTurntables() {
  const cards = [...document.querySelectorAll<HTMLElement>('[data-turntable]')];
  if (!cards.length) return;
  const webmOk = document.createElement('video').canPlayType('video/webm; codecs="vp9"') !== '';
  const allowed = () => !prefersReduced() && !isPaused() && !saveData();
  const cleanups: (() => void)[] = [];

  for (const card of cards) {
    const media = card.querySelector<HTMLElement>('[data-turntable-media]');
    if (!media) continue;
    const start = () => {
      if (!allowed() || media.dataset.failed) return;
      let video = media.querySelector('video');
      if (!video) {
        video = document.createElement('video');
        Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto' });
        video.setAttribute('aria-hidden', 'true');
        video.setAttribute('tabindex', '-1');
        video.addEventListener('playing', () => media.classList.add('is-spinning'));
        video.addEventListener('error', () => {
          media.dataset.failed = '1';
          media.classList.remove('is-spinning');
          video?.remove();
        });
        video.src = (webmOk && media.dataset.webm) || media.dataset.mp4 || '';
        media.append(video);
      }
      video.play().catch(() => {
        /* refused: poster stays */
      });
    };
    const stop = () => {
      const video = media.querySelector('video');
      if (!video) return;
      video.pause();
      video.currentTime = 0;
      media.classList.remove('is-spinning');
    };
    const onOut = (e: FocusEvent) => {
      if (!card.contains(e.relatedTarget as Node)) stop();
    };
    card.addEventListener('pointerenter', start);
    card.addEventListener('pointerleave', stop);
    card.addEventListener('focusin', start);
    card.addEventListener('focusout', onOut);
    cleanups.push(() => {
      card.removeEventListener('pointerenter', start);
      card.removeEventListener('pointerleave', stop);
      card.removeEventListener('focusin', start);
      card.removeEventListener('focusout', onOut);
    });
  }
  document.addEventListener('astro:before-swap', () => cleanups.forEach((fn) => fn()), {
    once: true,
  });
}
