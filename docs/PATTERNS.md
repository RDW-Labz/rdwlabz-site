# Patterns

Reusable bits from this build. **Validated** means it shipped here and is covered by a test or a measured check. **Experimental** means it works here but hasn't been checked beyond Chromium or in the field.

## Validated

### Project card (`src/components/ProjectCard.astro` + `ProjectArt.astro`)
- One card = one action. External links say "View project" plus a sr-only "(opens in a new tab)". Without a link, the action is a non-interactive "Link coming soon" pill, so there are never dead links.
- Missing image → generated accent art (stripes + category icon, 0 bytes) that looks intentional. Missing accent → category accent.
- Long-content safe: `overflow-wrap: anywhere` + `hyphens: auto` on titles. Tested with fixture data (20 projects, very long names).
- Evidence: e2e "placeholder projects show 'Link coming soon'"; pass 2 fixtures.

### Data-driven placeholders (`src/lib/projects.ts`)
- Every unknown is `TODO:` in JSON. One `isTodo()` gate turns it into "coming soon" UI or hides it. Contact becomes `null` (never a mailto to a TODO address).
- Build-time validation: unknown category or status and duplicate slugs throw.
- Evidence: e2e "contact: placeholder email never renders a mailto to a TODO address".

### Gradient tray sections (`src/components/Section.astro`, `.tray` in `global.css`)
- Stacked rounded-top sections with a negative top margin, so each overlaps the previous one. Each tone has its own gradient, and no two adjacent trays share one. The ink CTA band flows into the ink footer.
- `--tray-r` is 36px on mobile and 56px from 48rem.
- Evidence: pass 1 screenshots at 1440 / 768 / 390; axe contrast on every tone.

### URL-reflected filters (`src/scripts/filters.ts`, `FilterChip.astro`)
- Chips are real links (`/projects?c=mods`) with `role="button"` + `aria-pressed`. Without JS they're plain links and every project stays visible (the site is static, so `?c` is applied client-side only).
- With JS: Space/Enter/click, `history.replaceState`, a `role="status"` count, and an empty state whose reset returns focus to "All". Cards are re-queried on every filter.
- Evidence: e2e filters by click/keyboard/URL/reset, empty state, unknown `?c`, no-JS.

### Accessible mobile menu (`src/scripts/menu.ts`)
- Focus moves in and Tab is trapped. Everything outside the header is `inert`. Esc, an outside pointer, crossing to desktop width, or navigating closes the menu and restores focus. Listeners are removed on `astro:before-swap`.
- Evidence: e2e mobile menu tests.

### Motion lifecycle (`src/scripts/motion.ts`)
- Reveals are gated on a `.js` class set inline in `<head>`, so content is visible without JS.
- `[data-loop]` elements get `data-paused` when offscreen or when the tab is hidden. CSS pauses on that attribute.
- Init on `astro:page-load`, teardown on `astro:before-swap`.
- Evidence: `scripts/motion-check.mjs` (pause toggles; listener count flat over 8 round trips); e2e reduced-motion and no-JS tests.

### View-transition setup (`BaseLayout.astro`, `Header.astro`, `global.css`)
- `<ClientRouter fallback="animate">`. The header is persisted (`transition:name="site-header"`, `transition:animate="none"`).
- Main uses a custom animation object: old `vt-out` 200ms ease-in; new `vt-in` 420ms with a **120ms delay**, so the rooms don't double-expose.
- The nav pill morphs (`view-transition-name: nav-pill`). **Each nav label needs its own `view-transition-name`**, or the lifted pill paints over the text mid-morph.
- Reduced motion: `::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*)` are neutralised.
- Evidence: mid-transition frames in `docs/screenshots/motion/`; Review pass 3.

### Test kit
- `tests/site.spec.ts`. Per page: axe after forcing reveals and finishing finite animations (avoids mid-fade contrast false positives); console and network errors; 320px reflow; "every tab stop has a visible focus indicator" (outline ≥ 2px or a ring box-shadow). This last one caught a real bug.
- `scripts/budgets.mjs` (JS, CSS and fonts per page from `dist/`), `scripts/motion-check.mjs`, `scripts/fixture-build.mjs` (content extremes; always restores the data).
- Lighthouse CI uses `assertMatrix`, so a deliberately `noindex` page isn't held to the SEO gate.

### Review-pass checklist
1. **Art direction and craft**: hierarchy, type weights after the CSS reset, spacing rhythm, gradients and contrast, the signature moment at all 3 widths.
2. **UX, states and a11y**: journeys, filters (click/key/URL/no-JS), empty/coming-soon/404, fixture extremes, keyboard and focus on every stop, 320 reflow, reduced motion.
3. **Motion, perf and reliability**: slow animations to 10% (CDP `Animation.setPlaybackRate`) and screenshot mid-transition; repeat navigation and count listeners; offscreen pause; CLS; budgets; Lighthouse ×3 median; rerun everything.

## Experimental

- **Lab bench hero** (`src/components/home/LabBench.astro`): tokens positioned with `cqw`/`cqh` in a `container-type: size` box, a bob on the `translate` property, and a CSS dashed orbit ring. Measured CLS 0 in Chromium only; not checked in Safari or Firefox.
- **Filter changes inside `document.startViewTransition`** with per-card `view-transition-name` + `view-transition-class`. Chromium only. Other browsers fall back to an instant change (not verified).
- **`fallback="animate"`** for browsers without native View Transitions: not observed in such a browser.
- **Astro Fonts API** (`fontProviders.google()` self-hosted at build): works, 60 KB for 2 families. The API is new, so watch for upgrade changes.
- **Dev-only routes through an injected-route integration** (`astro.config.mjs`, gated on `dev`/`check`/`DEV_ROUTES=1`): works, but depends on how the CLI is invoked.
