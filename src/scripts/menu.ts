/**
 * Mobile menu disclosure: focus moves into the menu, Tab is trapped inside the header,
 * Esc / outside click / resize-to-desktop close it and focus returns to the toggle.
 * The rest of the page is made `inert` while open.
 */
let cleanup: (() => void) | null = null;

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function initMenu() {
  cleanup?.();
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  const toggle = header?.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const menu = header?.querySelector<HTMLElement>('[data-menu]');
  if (!header || !toggle || !menu) return;

  const outside = () =>
    [...document.body.children].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !el.contains(header),
    );

  const setOpen = (open: boolean, restoreFocus = true) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    outside().forEach((el) => (el.inert = open));
    if (open) menu.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    else if (restoreFocus) toggle.focus();
  };
  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  const onToggle = () => setOpen(!isOpen());
  const onKey = (e: KeyboardEvent) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [toggle, ...menu.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  const onPointer = (e: PointerEvent) => {
    if (isOpen() && !header.contains(e.target as Node)) setOpen(false, false);
  };
  const mq = window.matchMedia('(min-width: 48rem)');
  const onMq = () => mq.matches && isOpen() && setOpen(false, false);

  toggle.addEventListener('click', onToggle);
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerdown', onPointer);
  mq.addEventListener('change', onMq);

  cleanup = () => {
    if (isOpen()) setOpen(false, false);
    toggle.removeEventListener('click', onToggle);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerdown', onPointer);
    mq.removeEventListener('change', onMq);
    cleanup = null;
  };
  document.addEventListener('astro:before-swap', () => cleanup?.(), { once: true });
}
