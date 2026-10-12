# Progress

| Date       | Milestone                  | Status | Notes |
| ---------- | -------------------------- | ------ | ----- |
| 2026-10-12 | 1. Scaffold + checks       | Done   | Astro 7.3.8, Tailwind 4.3.3 (Vite plugin), TS 6.0.3, ESLint 10 + astro/jsx-a11y-x, Prettier, Playwright 1.64 + axe, Lighthouse CI 0.15. `seed/projects.json` → `src/data/projects.json`. |

| 2026-10-12 | 2. Brief                   | Done   | `docs/BRIEF.md`: audiences, jobs, 3 journeys, facts, assumptions, open questions. |

| 2026-10-12 | 3. Art direction            | Done   | 3 studies on `/_studies` (Workbench / Arcade cartridge / Blueprint), screenshots in `docs/screenshots/studies/`. Picked **A — Workbench** (27/20/23). Spec in `docs/ART-DIRECTION.md`. |
| 2026-10-12 | 4. Tokens + primitives     | Done   | Tokens in `src/styles/global.css` (`@theme` + CSS vars). Primitives: Button, ContactButton, Chip, FilterChip, ProjectCard, ProjectArt, Section (tray), Header (+ mobile menu w/ focus trap), Footer, Logo, Icon, BaseLayout (ClientRouter, SEO, fonts). `/_gallery` screenshots in `docs/screenshots/gallery/`. |
| 2026-10-12 | 5. Pages + SEO + analytics | Done   | Home (hero/LabBench, What we build tiles, featured, Work with us, CTA band), Projects (URL-reflected filters, live status, empty state, no-JS links), 404, canonical/OG/favicons/manifest/robots/sitemap, CF Web Analytics snippet gated on `PUBLIC_CF_BEACON_TOKEN`. `npx playwright test --project=e2e`: 23/23 pass (run twice). |
| 2026-10-12 | 6. Review passes 1–3       | Done   | See `docs/REVIEWS.md`. Pass 3: fixed the nav-label occlusion during the pill morph and the transition double exposure. Lighthouse medians 100/100/100/100 on `/` and `/projects` (404: 100/100/100, SEO 63 by design). JS ≤ 7.0 KB gz, fonts 60 KB / 2 families, CLS 0. e2e 29/29. |
| 2026-10-12 | 7. Preflight + handoff     | Done   | Final screenshots in `docs/screenshots/` (home/projects/404 × desktop/tablet/mobile). `docs/PREFLIGHT.md` (overall: PARTIALLY VERIFIED, not launch-ready: content TODOs + screen reader, cross-browser, field checks not run), `docs/PATTERNS.md`, README rewritten. Final rerun: lint clean, build OK (0 errors), e2e 29/29. |
| 2026-10-12 | Content update 1          | Done   | DNS confirmed on Cloudflare. Putt Drop added (Games, in-dev, Android, featured; link and one-liner TODO). Placeholder projects removed and never counted; empty categories show "Coming soon"; Home uses the filler card. Email, tagline and project 2 were blank in the request, so they stay TODO. Lint clean, build 0 errors, e2e 30/30, Lighthouse medians unchanged (100s; 404 SEO 63). |

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
- Playwright/Lighthouse run outside the sandbox (the sandbox misreports CPU arch to Playwright), with `PLAYWRIGHT_BROWSERS_PATH=$HOME/Library/Caches/ms-playwright` (a browser copy inside the project was broken: missing ICU data → browser disconnects).

## Next

- Braden: fill in the content TODOs, run a screen-reader and Safari/iOS spot-check, then follow the go-live steps in the README.

## Blockers / needs from Braden

- Content: tagline, real projects (names, blurbs, links, images, accents), category blurbs, work-with-us line, contact email, launch date. (DNS is confirmed on Cloudflare.) See `docs/PREFLIGHT.md`.
