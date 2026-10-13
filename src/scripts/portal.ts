/**
 * "Enter the Library" portal: a 2–3 s full-screen clip plays as the loading screen while
 * /library prefetches, then a View Transition swaps in the library.
 * - Plays at most once per session; later clicks navigate straight away.
 * - Skippable: click anywhere, the Skip button, or Esc.
 * - Reduced motion: a short fade instead of the clip.
 * - Never blocks: a missing/failed video navigates at once, and a hard cap ends it at 3.5 s.
 * - Data Saver, or no clip yet: the CSS placeholder plays instead (no download).
 */
import { navigate } from 'astro:transitions/client';
import { prefetch } from 'astro:prefetch';
import { prefersReduced, saveData } from './motion-state';

const SEEN = 'rdw-portal-seen';
export const PLACEHOLDER_MS = 2400;
export const HARD_CAP_MS = 3500;
const FADE_MS = 260;

function once(): boolean {
  try {
    const seen = sessionStorage.getItem(SEEN) === '1';
    sessionStorage.setItem(SEEN, '1');
    return !seen;
  } catch {
    return true;
  }
}

function clipFor(el: HTMLElement): string | null {
  const d = el.dataset;
  const portrait = window.matchMedia('(max-aspect-ratio: 4/5)').matches;
  const webm = (portrait && d.webmPortrait) || d.webm;
  const mp4 = (portrait && d.mp4Portrait) || d.mp4;
  if (webm && document.createElement('video').canPlayType('video/webm; codecs="vp9"')) return webm;
  return mp4 || webm || null;
}

export function initPortal() {
  const overlay = document.querySelector<HTMLElement>('[data-portal-overlay]');
  const links = [...document.querySelectorAll<HTMLAnchorElement>('a[data-portal]')];
  if (!overlay || !links.length) return;
  const skip = overlay.querySelector<HTMLButtonElement>('[data-portal-skip]');

  const play = (href: string) => {
    const reduced = prefersReduced();
    overlay.hidden = false;
    overlay.dataset.state = reduced ? 'fade' : 'portal';
    const timers: number[] = [];
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener('keydown', onKey);
      overlay.removeEventListener('click', go);
      overlay.querySelector('video')?.pause();
      overlay.dataset.state = 'leaving';
      navigate(href);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        go();
      }
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', go);
    skip?.focus({ preventScroll: true });

    if (reduced) {
      timers.push(window.setTimeout(go, FADE_MS));
      return;
    }
    timers.push(window.setTimeout(go, HARD_CAP_MS));
    const src = saveData() ? null : clipFor(overlay);
    if (!src) {
      timers.push(window.setTimeout(go, PLACEHOLDER_MS));
      return;
    }
    const video = document.createElement('video');
    Object.assign(video, { muted: true, playsInline: true, preload: 'auto' });
    video.setAttribute('aria-hidden', 'true');
    video.className = 'portal__video';
    video.addEventListener('ended', go);
    video.addEventListener('error', go);
    video.addEventListener('playing', () => overlay.classList.add('has-video'), { once: true });
    video.src = src;
    overlay.prepend(video);
    video.play().catch(go);
  };

  const onClick = (e: MouseEvent) => {
    const link = (e.target as Element).closest<HTMLAnchorElement>('a[data-portal]');
    if (!link || e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const href = link.pathname + link.search;
    prefetch(href, { ignoreSlowConnection: true });
    if (once()) play(href);
    else navigate(href);
  };
  // Capture phase: runs before the ClientRouter's own link handler would navigate.
  document.addEventListener('click', onClick, true);
  document.addEventListener(
    'astro:before-swap',
    () => document.removeEventListener('click', onClick, true),
    { once: true },
  );
}
