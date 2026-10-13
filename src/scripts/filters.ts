/**
 * Projects filter. Chips are real links (`?c=<id>`) so everything works without JS;
 * with JS they become toggle buttons that filter in place, reflect the choice in the URL,
 * announce the result, and animate with a View Transition when supported.
 */
type Doc = Document & { startViewTransition?: (cb: () => void) => unknown };

export function initFilters() {
  const group = document.querySelector<HTMLElement>('[data-filters]');
  const grid = document.querySelector<HTMLElement>('[data-project-grid]');
  if (!group || !grid) return;

  const chips = [...group.querySelectorAll<HTMLAnchorElement>('[data-filter]')];
  const items = () => [...grid.querySelectorAll<HTMLElement>(':scope > li')];
  const status = document.querySelector<HTMLElement>('[data-filter-status]');
  const valid = new Set(chips.map((c) => c.dataset.filter));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const chipLabel = (id: string) => chips.find((c) => c.dataset.filter === id)?.dataset.label ?? id;

  const apply = (id: string, announce: boolean) => {
    let shown = 0;
    for (const li of items()) {
      const match = id === 'all' || li.dataset.category === id;
      li.hidden = !match;
      if (match) shown++;
    }
    for (const c of chips) c.setAttribute('aria-pressed', String(c.dataset.filter === id));
    if (status && announce) {
      const noun = `project${shown === 1 ? '' : 's'}`;
      status.textContent =
        id === 'all'
          ? `Showing ${shown === 1 ? '' : 'all '}${shown} ${noun}.`
          : `Showing ${shown} ${noun} in ${chipLabel(id)}.`;
    }
  };

  const select = (id: string) => {
    const url = new URL(window.location.href);
    if (id === 'all') url.searchParams.delete('c');
    else url.searchParams.set('c', id);
    history.replaceState(history.state, '', url);
    const doc = document as Doc;
    if (doc.startViewTransition && !reduced) doc.startViewTransition(() => apply(id, true));
    else apply(id, true);
  };

  const onClick = (e: MouseEvent) => {
    const chip = (e.target as Element).closest<HTMLAnchorElement>('[data-filter]');
    if (!chip || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    select(chip.dataset.filter ?? 'all');
  };
  const onKey = (e: KeyboardEvent) => {
    // role="button" links must also respond to Space.
    const chip = (e.target as Element).closest<HTMLAnchorElement>('[data-filter]');
    if (!chip || e.key !== ' ') return;
    e.preventDefault();
    select(chip.dataset.filter ?? 'all');
  };
  group.addEventListener('click', onClick);
  group.addEventListener('keydown', onKey);

  const initial = new URL(window.location.href).searchParams.get('c') ?? 'all';
  apply(valid.has(initial) ? initial : 'all', initial !== 'all');

  document.addEventListener(
    'astro:before-swap',
    () => {
      group.removeEventListener('click', onClick);
      group.removeEventListener('keydown', onKey);
    },
    { once: true },
  );
}
