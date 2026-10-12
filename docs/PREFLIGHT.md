# Preflight

**Overall: PARTIALLY VERIFIED. Not ready to launch.** Every check the agent could run passes. Launch is blocked on real content (the site currently shows only "coming soon" placeholders, and there's no contact email) and on checks that need a human or a deployed site (screen reader, real devices, other browsers, field metrics).

Last updated 2026-10-12 at commit `292850b` (plus the step 7 docs commit). Unless noted, everything ran against the **production build** (`astro build && astro preview`) in Playwright Chromium.

Status key: PASS · FAIL · BLOCKED · NOT RUN · N/A (with reason)

| Criterion | Scope | Status | Evidence | Open issue |
|---|---|---|---|---|
| Scope matches v1 | Home, Projects, 404; footer mailto only; no forms, CMS, logins, store or blog | PASS | `dist/` contains only `index.html`, `projects.html`, `404.html` + assets. The e2e test "dev-only routes are not in the production build" passes | — |
| No invented facts | All copy and data | PASS | Every unknown is a `TODO:` in `src/data/projects.json` and renders as "coming soon" UI. The hero eyebrow was changed from "Indie dev lab" to "Hello from the lab" (Review pass 1 #3) | Real content is needed (see the TODOs below) |
| Contact never points at a placeholder | Header, hero, CTA band, footer | PASS | e2e "contact: placeholder email never renders a mailto to a TODO address" | The contact email is still TODO, so there is currently **no working contact route** |
| Design-system consistency | Tokens, primitives, all pages | PASS (manual review) | `/_gallery` (dev only) with screenshots in `docs/screenshots/gallery/`. Review pass 1 checked the pages against `docs/ART-DIRECTION.md` | — |
| Journeys and states | 3 journeys from `docs/BRIEF.md`; filters; empty, coming-soon and 404 states; long and short content | PASS | e2e tile → filter journey, filters by click/Space/Enter/URL/reset, empty state, unknown `?c=`, 404 status and page. Fixture builds (`scripts/fixture-build.mjs twenty\|one`) reviewed in pass 2 | — |
| Responsive | 1440 / 768 / 390 and 320 reflow | PASS | `docs/screenshots/{home,projects,404}-{desktop,tablet,mobile}.png`. e2e reflow at 320px with no horizontal scroll on all 3 pages | — |
| Accessibility: automated | WCAG 2.0/2.1/2.2 A+AA axe rules, on all 3 pages | PASS | e2e axe: 0 violations. Contrast spot-checks with `scripts/contrast.mjs` (lowest text pair 4.59:1) | Axe doesn't prove conformance |
| Accessibility: keyboard and focus | Tab order, visible focus, menu trap/restore, skip link | PASS (scripted) | e2e: every tab stop has a visible focus indicator; skip link is first; mobile menu traps focus, closes on Esc and restores focus, page is inert while it's open | This was a scripted Playwright pass, not a human keyboard session |
| Accessibility: screen reader | VoiceOver / NVDA | NOT RUN | — | Needs a human test before claiming WCAG 2.2 AA |
| Reduced motion | Reveals, loops, view transitions, filters | PASS | e2e "reveals are visible immediately and hero tokens are static". The global reduced-motion block covers `::view-transition-*`, and filters skip `startViewTransition` | — |
| Motion fallbacks | No JS, offscreen, hidden tab, unsupported View Transitions | PASS (no-JS, offscreen) / NOT RUN (hidden-tab pause; browsers without View Transitions) | e2e no-JS test (content visible, filters are plain links). `scripts/motion-check.mjs`: bench `data-paused` toggles true offscreen and false on return | The `visibilitychange` pause is implemented but untested. `fallback="animate"` hasn't been checked in a browser that lacks View Transitions |
| Route-change motion | Header pill morph, room swap | PASS | Mid-transition frames in `docs/screenshots/motion/`. Two glitches fixed in Review pass 3 | — |
| Cleanup and reliability | Listeners across repeated client navigation | PASS | `scripts/motion-check.mjs`: `document` listener count stays at 16 over 8 round trips; 0 page or console errors | — |
| Budgets | JS ≤ 60 KB gz/page; fonts ≤ 2 families / ≤ 120 KB; hero media ≤ 200 KB; CLS ≈ 0 | PASS | `node scripts/budgets.mjs`: JS 6.4 / 7.0 / 6.4 KB gz; fonts 60.0 KB, 2 families; the hero has no raster media; CLS 0 (in-browser and Lighthouse) | — |
| Lighthouse (lab) | Mobile profile, 3 runs, median: `/`, `/projects`, `/404` | PASS | `npm run lhci`: `/` and `/projects` scored 100/100/100/100; `/404` scored 100/100/100 with SEO 63 (intended `noindex`, not gated). LCP about 1.5 s, TBT 0 ms, CLS 0 | Lab numbers from localhost only |
| Field performance (LCP / INP / CLS) | Real users | NOT RUN | — | Needs a deployed site + Web Analytics |
| Cross-browser and real devices | Safari, Firefox, iOS, Android | NOT RUN | Only Playwright Chromium was used | Spot-check before launch |
| Lint / types / tests / build | Whole repo | PASS | `npm run lint` clean; `astro check` 0 errors, 0 warnings, 0 hints; `astro build` OK; `npx playwright test --project=e2e` 29/29 | — |
| Console and network errors | All 3 pages + client navigation | PASS | e2e collects `pageerror`, console errors and failed requests on every page; the motion probe reports 0 errors | — |
| SEO basics | Titles, descriptions, canonical, OG/Twitter, favicons, manifest, sitemap, robots | PASS | e2e "SEO: canonical, OG tags, sitemap, robots, favicons" | `public/og.png` text is hard-coded in `scripts/make-icons.mjs` ("We build software, games, mods and asset packs."). To change it for a new tagline, edit the script and rerun it |
| Analytics | Cloudflare Web Analytics | BLOCKED | The snippet renders only when `PUBLIC_CF_BEACON_TOKEN` is set at build time | Needs Braden to enable Web Analytics and set the token in Cloudflare Pages |
| Asset rights | All images, icons, fonts | PASS | `docs/ASSETS.md`: all art is original SVG/CSS; fonts are SIL OFL 1.1; no third-party game art, logos or trademarks; no AI or stock imagery | Log real project images in `docs/ASSETS.md` when they're added |
| Secrets | Code, logs, docs | PASS | No keys or tokens in the repo; the beacon token is env-only | — |
| Dependency audit | `npm audit` | PASS (prod) | `npm audit --omit=dev`: 0. Full audit: 17 dev-only issues through `@lhci/cli` (not shipped) | — |
| Review pass 1: art direction and craft | 1440 / 768 / 390 | PASS | `docs/REVIEWS.md`: 8 findings fixed | — |
| Review pass 2: UX, states and a11y | 1440 / 768 / 390 + fixtures | PASS | `docs/REVIEWS.md`: 7 findings fixed | — |
| Review pass 3: motion, perf and reliability | Production build | PASS | `docs/REVIEWS.md`: 4 findings fixed | — |
| Deploy / DNS | Cloudflare Pages, rdwlabz.com | N/A | Out of the agent's permissions; Braden does this | See the go-live steps in the README |

## Content still TODO (in `src/data/projects.json` unless noted)

- `site.tagline` (the UI falls back to "We build software, games, mods and asset packs.")
- `site.contactEmail` (currently `TODO@rdwlabz.com`; every contact CTA shows "Email coming soon")
- `site.launchDate`
- `site.workWithUs` (an optional line; hidden while TODO)
- The real project list. The 4 entries are placeholders: name, one-liner, status, platforms, url, accentColor, image, featured.
- Category blurbs (4, currently hidden while TODO)
- The DNS host for rdwlabz.com (open question in `docs/PLAN.md`)
