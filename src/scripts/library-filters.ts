/**
 * Library search + filter chips. Without JS every pack is listed and the tools stay hidden.
 * Groups combine with AND (one choice per group); search matches names, tags and contents.
 * State is mirrored in the URL (?q=&category=&style=&format=) and announced politely.
 */
import { prefersReduced } from './motion-state';

type Doc = Document & { startViewTransition?: (cb: () => void) => unknown };
const GROUPS = ['category', 'style', 'format'] as const;
type Group = (typeof GROUPS)[number];

export function initLibraryFilters() {
  const tools = document.querySelector<HTMLElement>('[data-lib-tools]');
  const grid = document.querySelector<HTMLElement>('[data-lib-grid]');
  if (!tools || !grid) return;
  const search = tools.querySelector<HTMLInputElement>('[data-lib-search]');
  const status = document.querySelector<HTMLElement>('[data-lib-status]');
  const none = document.querySelector<HTMLElement>('[data-lib-none]');
  const items = [...grid.querySelectorAll<HTMLElement>(':scope > li')];
  const chips = [...tools.querySelectorAll<HTMLButtonElement>('[data-facet-value]')];
  const state: Record<Group, string> & { q: string } = {
    q: '',
    category: '',
    style: '',
    format: '',
  };

  const matches = (li: HTMLElement) => {
    const d = li.dataset;
    if (state.category && d.category !== state.category) return false;
    if (state.style && d.style !== state.style) return false;
    if (state.format && !(d.formats ?? '').split(' ').includes(state.format)) return false;
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    return words.every((w) => (d.search ?? '').includes(w));
  };

  const render = (announce: boolean) => {
    let shown = 0;
    for (const li of items) {
      const ok = matches(li);
      li.hidden = !ok;
      if (ok) shown++;
    }
    for (const c of chips) {
      c.setAttribute(
        'aria-pressed',
        String(state[c.dataset.facet as Group] === c.dataset.facetValue),
      );
    }
    if (none) none.hidden = shown > 0;
    const filtered = state.q || GROUPS.some((g) => state[g]);
    if (status && announce) {
      status.textContent = !filtered
        ? `Showing all ${items.length} packs.`
        : shown === 0
          ? 'No packs match. Try fewer filters or another word.'
          : `Showing ${shown} of ${items.length} packs.`;
    }
  };

  const writeUrl = () => {
    const url = new URL(window.location.href);
    for (const k of ['q', ...GROUPS] as const) {
      if (state[k]) url.searchParams.set(k, state[k]);
      else url.searchParams.delete(k);
    }
    history.replaceState(history.state, '', url);
  };

  const commit = (animate: boolean) => {
    writeUrl();
    const doc = document as Doc;
    if (animate && doc.startViewTransition && !prefersReduced()) {
      doc.startViewTransition(() => render(true));
    } else render(true);
  };

  const onChip = (e: Event) => {
    const chip = (e.target as Element).closest<HTMLButtonElement>('[data-facet-value]');
    if (!chip) return;
    state[chip.dataset.facet as Group] = chip.dataset.facetValue ?? '';
    commit(true);
  };
  let timer = 0;
  const onInput = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      state.q = search?.value.trim() ?? '';
      commit(false);
    }, 140);
  };
  const onSubmit = (e: Event) => e.preventDefault();
  const onReset = (e: Event) => {
    if (!(e.target as Element).closest('[data-lib-reset]')) return;
    state.q = '';
    GROUPS.forEach((g) => (state[g] = ''));
    if (search) search.value = '';
    commit(true);
    search?.focus();
  };

  tools.addEventListener('click', onChip);
  tools.addEventListener('submit', onSubmit);
  search?.addEventListener('input', onInput);
  document.addEventListener('click', onReset);

  const params = new URL(window.location.href).searchParams;
  state.q = params.get('q')?.slice(0, 80) ?? '';
  if (search) search.value = state.q;
  for (const g of GROUPS) {
    const v = params.get(g) ?? '';
    state[g] = chips.some((c) => c.dataset.facet === g && c.dataset.facetValue === v) ? v : '';
  }
  render(!!(state.q || GROUPS.some((g) => state[g])));

  document.addEventListener(
    'astro:before-swap',
    () => {
      window.clearTimeout(timer);
      tools.removeEventListener('click', onChip);
      tools.removeEventListener('submit', onSubmit);
      search?.removeEventListener('input', onInput);
      document.removeEventListener('click', onReset);
    },
    { once: true },
  );
}
