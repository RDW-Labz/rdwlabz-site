# Progress

| Date       | Milestone                  | Status | Notes |
| ---------- | -------------------------- | ------ | ----- |
| 2026-10-12 | 1. Scaffold + checks       | Done   | Astro 7.3.8, Tailwind 4.3.3 (Vite plugin), TS 6.0.3, ESLint 10 + astro/jsx-a11y-x, Prettier, Playwright 1.64 + axe, Lighthouse CI 0.15. `seed/projects.json` → `src/data/projects.json`. |

| 2026-10-12 | 2. Brief                   | Done   | `docs/BRIEF.md`: audiences, jobs, 3 journeys, facts, assumptions, open questions. |

| 2026-10-12 | 3. Art direction            | Done   | 3 studies on `/_studies` (Workbench / Arcade cartridge / Blueprint), screenshots in `docs/screenshots/studies/`. Picked **A — Workbench** (27/20/23). Spec in `docs/ART-DIRECTION.md`. |

## Baseline (step 1, run 2026-10-12)

- `npm run lint`: pass (0 ESLint problems, Prettier clean).
- `npm run build` (incl. `astro check`): pass, 0 errors / 0 warnings / 0 hints. Only `/index.html` emitted (dev routes excluded).
- `npx playwright test --project=e2e`: 3/3 pass (heading + no console errors, axe WCAG 2.2 AA tags = 0 violations, `/_studies` + `/_gallery` 404 in prod).
- Lighthouse CI (lab, mobile default, 3 runs, `/` only — the stub page): median Perf 100 / A11y 100 / BP 96 / SEO 100, LCP 903 ms, CLS 0.
- `npm audit --omit=dev`: 0 vulnerabilities. Full `npm audit`: 17 dev-only (transitive via `@lhci/cli`); not shipped.

## Decisions

- TypeScript pinned to 6.0.x: `@astrojs/check` and `typescript-eslint` don't support TS 7 yet.
- `eslint-plugin-jsx-a11y-x` instead of `eslint-plugin-jsx-a11y` (the original doesn't support ESLint 10).
- Dev-only routes via an injected-route integration in `astro.config.mjs` (Astro ignores `_`-prefixed page files).
- Dedicated ports + `reuseExistingServer: false`: another local project was already serving on 4322 and tests hit it.

## Environment notes (agent sandbox only)

- Set `ASTRO_TELEMETRY_DISABLED=1` in the sandbox (telemetry writes outside the workspace).
- Playwright/Lighthouse run outside the sandbox (the sandbox misreports CPU arch to Playwright).

## Next

- Step 4: tokens + primitives + `/_gallery`.

## Blockers / needs from Braden

- See "Open questions" in PLAN.md (tagline, project list, contact email, DNS host, launch date).
