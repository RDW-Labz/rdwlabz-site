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
| 2026-10-12 | Preview deploy            | Done   | Pushed to private repo github.com/RDW-Labz/rdwlabz-site (commit emails set to the GitHub noreply address). Direct-upload preview on Cloudflare Pages project `rdwlabz-site` (account "Shadetreerocketsurgeon84@gmail.com's Account", production branch `main`, nothing deployed to production): https://preview.rdwlabz-site.pages.dev. `/`, `/projects` return 200, unknown paths return the branded 404, and previews send `x-robots-tag: noindex`. No custom domain or DNS changes. |
| 2026-10-12 | Round 2: motion + type    | Done   | Headings in **Bagel Fat One** (picked from a 3-font study on `/_studies#type`; 24 KB Latin subset, fonts 43 KB total). Hero word cycler, wordmark pop, pop-in headings, swaying bench with fizz and hover reactions, parallax, tile wiggle, sticker-peel cards, rising cards, scroll-driven tray slide, scroll-progress bar, and a Pause animations toggle. Everything is off under reduced motion. Lab activity strip on Home (build time). |
| 2026-10-12 | Round 2: project tracker  | Done   | `scripts/sync-projects.mjs` (opt-in via `rdwlabz.json`, validation, private-repo guard, merge, auto-`released`), `.github/workflows/sync-projects.yml` (daily + manual, PR only), templates, README how-to. Not run on GitHub yet: needs the `RDWLABZ_SYNC_TOKEN` secret. PR step later switched to `RDWLABZ_PR_TOKEN` (the enterprise blocks `GITHUB_TOKEN` from creating PRs); `GITHUB_TOKEN` is now read-only. |
| 2026-10-12 | Round 2: checks           | Done   | Lint clean; build 0 errors; e2e 36/36 + sync 7/7 + screenshots 9/9; budgets OK (JS ≤ 7.3 KB gz); motion-check CLS 0, no leaks; Lighthouse medians 100s (404 SEO 63 by design). See `docs/REVIEWS.md` Round 2. Not pushed or deployed. |
| 2026-10-12 | Contact email             | Done   | `site.contactEmail` = `devops@therdw.com`; all contact spots are real mailto links (header pill, mobile menu, hero, new Work with us button, CTA band, footer, new 404 button). e2e 40/40 + sync 7/7 + screenshots 9/9. |
| 2026-10-12 | Putt Drop moves to sync   | Done   | Opened [RDW-Labz/putt-drop#1](https://github.com/RDW-Labz/putt-drop/pull/1) adding `rdwlabz.json` (not merged). Removed the hand-written entry; the shelf is empty until the first sync PR merges. Added a proper empty-shelf state (no "0" badges, no self-link) and made tests data-agnostic. e2e 56 pass, 1 skipped (the shelf-has-projects variant). |
| 2026-10-12 | Fully automatic tracker   | Done (local) | Lists repos with a public store listing (Play, App Store, Steam, Modrinth, CurseForge with key) or the `rdwlabz` topic; `rdwlabz.json` is optional overrides. Auto-fills name, description, category, platforms, link, status, release date, icon (WebP) and AA-safe accent. Private repos never leak names/descriptions/links before a public store page. Cache + fail-soft per repo. Workflow every 6 h, manual, and `repository_dispatch: rdwlabz-sync`; auto-merges green data-only PRs with `RDWLABZ_PR_TOKEN`. putt-drop got the `rdwlabz` topic; overrides-only PR [RDW-Labz/putt-drop#2](https://github.com/RDW-Labz/putt-drop/pull/2). Lint clean, build 0 errors, tests 76 passed / 1 skipped (27 sync tests with fixtures). Live dry run: lists Putt Drop via the topic. |
| 2026-10-12 | Sync PR #2 fix            | Done (local) | Sync run 38311256964 left PR #2 open: the home axe test (`smoke.spec.ts`) scanned mid-fade hero tokens (a race that also failed 9/10 locally on main's data); it now settles motion first like `site.spec.ts` (shared `tests/helpers.ts`). The PR's "Rogue Snow: Everwinter" was a false listing: the detector read this repo's own test fixtures (Steam id 1234560 belongs to another developer's game). Detectors now ignore test/fixture/example/sample folders; regression test scans this repo's real file list. Live dry run: only Putt Drop. Lint clean, build 0 errors, e2e 68 passed / 1 skipped; axe tests 40/40 on repeat. |
| 2026-10-12 | Sync PR step fix          | Done (local) | Run 38312654078 failed with git exit 128: `git add -- public/projects` errors when no synced images exist yet (folder absent). The PR step now adds `public/projects` only when git sees files there. Reproduced the 128 locally with a missing path; YAML parses. Closed stale PR #2 (false Rogue Snow entry); the next run opens a fresh PR. |

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

- Braden: create the `RDWLABZ_SYNC_TOKEN` and `RDWLABZ_PR_TOKEN` secrets, add `rdwlabz.json` to the Putt Drop repo, deploy a new preview, then fill in the content TODOs, run a screen-reader and Safari/iOS spot-check, then follow the go-live steps in the README.

## Blockers / needs from Braden

- Content: tagline, real projects (names, blurbs, links, images, accents), category blurbs, work-with-us line, launch date. (DNS is confirmed on Cloudflare.) See `docs/PREFLIGHT.md`.
