/**
 * Site-wide "Pause animations" state (WCAG 2.2.2). Stored in localStorage, applied before
 * paint by BaseLayout, and announced with an `rdw:motion` event so every toggle and looping
 * video on the page stays in sync.
 */
const KEY = 'rdw-motion';
export const MOTION_EVENT = 'rdw:motion';

export const isPaused = () => document.documentElement.dataset.motion === 'paused';
export const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Data Saver / Lite mode: no autoplaying video. */
export const saveData = () =>
  !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

export function setPaused(paused: boolean) {
  if (paused) document.documentElement.dataset.motion = 'paused';
  else delete document.documentElement.dataset.motion;
  try {
    localStorage.setItem(KEY, paused ? 'paused' : 'on');
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
  document.dispatchEvent(new CustomEvent(MOTION_EVENT));
}
