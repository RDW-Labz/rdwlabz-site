/**
 * Interactive 3D preview on /library/[slug]. <model-viewer> (about 290 KB gz with three.js)
 * is imported only after the visitor asks for it, so the page itself stays light.
 * Model buttons swap the GLB. If loading fails, the still render stays and a note says so.
 */
import { prefersReduced } from './motion-state';

const DECODER = '/library/vendor/meshopt-ready.js';
const FAILED = 'The 3D preview could not load, so the still render is shown instead.';

type Model = { src: string; name: string };

export function initModelPreview() {
  const root = document.querySelector<HTMLElement>('[data-model-preview]');
  if (!root) return;
  const stage = root.querySelector<HTMLElement>('[data-model-stage]');
  const load = root.querySelector<HTMLButtonElement>('[data-model-load]');
  const status = root.querySelector<HTMLElement>('[data-model-status]');
  const pickers = [...root.querySelectorAll<HTMLButtonElement>('[data-model-src]')];
  if (!stage || !load || !root.dataset.src) return;
  let viewer: HTMLElement | null = null;
  let current: Model = { src: root.dataset.src, name: root.dataset.name ?? 'Model' };

  const say = (text: string) => {
    if (status) status.textContent = text;
  };

  const show = (m: Model) => {
    current = m;
    pickers.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modelSrc === m.src)));
    if (!viewer) return;
    root.dataset.state = 'loading';
    say(`Loading ${m.name}…`);
    viewer.setAttribute('alt', `3D preview of ${m.name}`);
    viewer.setAttribute('src', m.src);
  };

  let started = false;
  const start = async () => {
    if (started) return;
    started = true;
    root.dataset.state = 'loading';
    load.disabled = true;
    say('Loading the 3D viewer…');
    try {
      const { ModelViewerElement } = await import('@google/model-viewer');
      (ModelViewerElement as unknown as { meshoptDecoderLocation: string }).meshoptDecoderLocation =
        DECODER;
      const mv = document.createElement('model-viewer');
      mv.setAttribute('camera-controls', '');
      mv.setAttribute('touch-action', 'pan-y');
      mv.setAttribute('shadow-intensity', '1');
      mv.setAttribute('exposure', '1.1');
      mv.setAttribute('interaction-prompt', 'none');
      if (!prefersReduced()) {
        mv.setAttribute('auto-rotate', '');
        mv.setAttribute('auto-rotate-delay', '600');
      }
      mv.className = 'model-viewer';
      mv.addEventListener('load', () => {
        root.dataset.state = 'ready';
        say(`${current.name} loaded. Drag to turn it, pinch or scroll to zoom.`);
      });
      mv.addEventListener('error', () => {
        root.dataset.state = 'error';
        say(FAILED);
      });
      stage.append(mv);
      viewer = mv;
      show(current);
    } catch {
      started = false;
      root.dataset.state = 'error';
      load.disabled = false;
      say(FAILED);
    }
  };

  const onPick = (e: Event) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-model-src]');
    if (!btn?.dataset.modelSrc) return;
    const m = { src: btn.dataset.modelSrc, name: btn.dataset.modelName ?? 'Model' };
    if (viewer) show(m);
    else {
      show(m);
      void start();
    }
  };
  load.addEventListener('click', start);
  root.addEventListener('click', onPick);
  document.addEventListener(
    'astro:before-swap',
    () => {
      load.removeEventListener('click', start);
      root.removeEventListener('click', onPick);
    },
    { once: true },
  );
}
