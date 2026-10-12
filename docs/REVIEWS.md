# Post-build review passes

All passes use real Playwright renders of the **production build** (`astro build && astro preview`) at 1440, 768 and 390 px wide. Final screenshots are in `docs/screenshots/`.

## Pass 1: Art direction and craft (2026-10-12)

Checked hierarchy, type, spacing, color, gradients, alignment and consistency with `docs/ART-DIRECTION.md`, plus the signature moment.

| # | Finding | Fix |
|---|---|---|
| 1 | The hero orbit ring rendered as chunky dash blocks that competed with the tokens | Replaced the SVG ellipse with a thin 2px dashed CSS ring at 28% ink that slowly rotates (60 s per turn, paused offscreen and under reduced motion) |
| 2 | "Labz" in the hero wasn't brand-colored, though the header wordmark is | Hero "Labz" now uses `tomato-700` (4.59:1 on paper; large text) |
| 3 | The "Indie dev lab" eyebrow is an unverified claim (we don't know RDW Labz calls itself indie) | Changed to "Hello from the lab" |
| 4 | At 768 the bench filled most of the screen | Bench capped at 440px between 30rem and 60rem |
| 5 | At 390 the four category tiles stacked into about 1,000px of scrolling | Tiles are a 2×2 grid on mobile with fluid icon, label and padding |
| 6 | At 390 the three placeholder cards were very tall and repetitive | Card art is 2:1 below 40rem (16:10 above) |
| 7 | (from the studies) Heading weights collapsed to 400 under Tailwind preflight | Base layer sets `font-weight: 800` on h1–h4 |
| 8 | The `wdth` axis setting did nothing, because only the `wght` axis is loaded | Removed it and documented this in the spec |

Kept as is: the tray stacking (clear separation, no two adjacent identical gradients), the sticker cards, the CTA band flowing into the ink footer.

Re-rendered at 1440, 768 and 390 after the fixes, and they look as intended.

## Pass 2: UX, states and accessibility (2026-10-12)

Checked the three journeys from `docs/BRIEF.md`, filters, the empty, coming-soon and 404 states, long content, keyboard, focus, zoom/reflow and reduced motion.

To test content extremes, `node scripts/fixture-build.mjs twenty|one` builds the site with fixture data (20 projects including a very long name, blurb and platform list, missing accents and images, and an empty Asset packs category; or a single project) and then always restores `src/data/projects.json`. The fixtures are never committed as data.

| # | Finding | Fix |
|---|---|---|
| 1 | **A focused, selected filter chip had no focus ring**: the `aria-pressed` rule overrode the `:focus-visible` box-shadow. Caught by the new "every tab stop has a visible focus indicator" test | Added a `[aria-pressed='true']:focus-visible` rule that keeps the focus ring |
| 2 | With one featured project, Home had a large empty area beside the card | A dashed "More on the shelf" card links to /projects and fills the remaining columns (only when there are fewer than 3) |
| 3 | With many featured flags, Home could show an unbounded list | Home shows at most 6 featured projects |
| 4 | At 390 the five filter chips wrapped onto 3 rows | Compact chip padding below 30rem → 2 rows, still ≥ 44px tall |
| 5 | Very long single words broke without a hyphen | `hyphens: auto` on card titles (plus the existing `overflow-wrap: anywhere`) |
| 6 | The empty-state test showed the filter script cached the card list | The script re-queries cards on each filter |
| 7 | Axe "contrast" failures were false positives taken mid-fade | The test finishes reveals and finite animations before analyzing; real colors pass |

Verified (automated, `npx playwright test --project=e2e`, 29/29 pass):
- Axe (WCAG 2.0/2.1/2.2 A+AA tags, including target-size) reports 0 violations on `/`, `/projects` and the 404.
- No console errors and no failed requests on any page.
- One h1, landmarks, skip link first in tab order, title and description on every page.
- Every tab stop has a visible focus indicator on all three pages.
- Reflow at 320px (equivalent to 400% zoom at 1280px) causes no horizontal scrolling on any page.
- Journey 1: the hero CTA links to /projects. Journey 2: a tile opens /projects?c=mods with the filter pre-applied, using client-side navigation. Journey 3: every contact CTA becomes a mailto once the email is set, and never points at a TODO address.
- Filters work by click, Space and Enter. The URL updates. An unknown `?c=` falls back to All. The live region announces the count. The empty state's reset returns focus to the "All" chip.
- The mobile menu moves focus inside, traps Tab, closes on Esc and returns focus, makes the page inert while open, and closes on navigation.
- With JS off, content is visible and the filters are plain links.
- With reduced motion, reveals show immediately and the hero tokens are static.

Checked manually from screenshots: the open mobile menu, focus rings (hero token, selected chip), the filtered view at 390, the empty state at 390, 20 projects at 1440, and the 1-project filler at 1440.

**Not performed:** testing with a real screen reader (VoiceOver/NVDA). The semantics were checked with axe and the accessibility snapshot only, so full WCAG conformance is not claimed.

## Pass 3: Motion, performance and reliability (2026-10-12)

Checked page transitions, the nav-pill morph, loops, listener cleanup, CLS, budgets and Lighthouse on the production build.

Tools: `node scripts/budgets.mjs` (reads `dist/`), and `node scripts/motion-check.mjs <url> <outDir>` (slows animations to 10% through CDP to capture mid-transition frames, round-trips Home ↔ Projects 8 times while counting `document` listeners, checks the hero loop pauses offscreen, and measures CLS).

| # | Finding | Fix |
|---|---|---|
| 1 | **During the route change the nav pill covered the link labels**, so "Projects" was blank for the 420 ms morph. The named pill is lifted above the header snapshot | Each nav label has its own `view-transition-name` (`nav-text-<id>`), so labels paint above the moving pill |
| 2 | The old and new page contents were double-exposed early in the transition, because the fade-out and slide-in started together | The slide-in has a 120 ms delay, so the old room mostly clears first |
| 3 | The budget script found only one font family (the regex expected a quoted name) | Regex fixed. It now reports both families |
| 4 | Lighthouse can't audit the real 404 response (it refuses non-2xx documents) | The 404 page is audited at `/404`. Its SEO score (63) comes from the intended `noindex`, so SEO is reported but not gated for that URL |

Mid-transition frames after the fixes: `docs/screenshots/motion/route-change-early.png` and `route-change-late.png`.

Verified (all run on 2026-10-12):
- **Budgets** (`scripts/budgets.mjs`): JS is 6.4 KB gz on Home and 404 and 7.0 KB gz on Projects (budget 60). Fonts: 2 families (Bricolage Grotesque, Figtree), 2 woff2 files, 60.0 KB (budget 2 families / 120 KB). Hero media: the hero has no raster media (CSS + inline SVG). CSS is 8.0–10.9 KB gz.
- **Lighthouse CI** (`npm run lhci`, mobile default, 3 runs, median): `/` scored 100/100/100/100, `/projects` 100/100/100/100, and `/404` 100/100/100 with SEO 63 (noindex). LCP was about 1.5 s, TBT 0 ms and CLS 0.000 on all three. All assertions passed.
- **CLS** measured in-browser on Home with a PerformanceObserver: 0.
- **Loops**: the hero bench gets `data-paused="true"` when scrolled offscreen and `"false"` when back in view.
- **Listener cleanup**: the `document` listener count stays at 16 for all 8 Home ↔ Projects round trips (no growth). No page errors or console errors.
- **Filters after repeated navigation** work, including a click that lands before init finishes: it falls back to a client navigation to `?c=games`, which selects the right chip.
- **Reduced motion**: the global block neutralises all `::view-transition-*` animations, reveals and loops. This is covered by the e2e reduced-motion test.
- Re-ran `npm run lint` (clean), `astro check` (0 errors, 0 warnings, 0 hints) and `npx playwright test --project=e2e` (29/29 pass) after the fixes.

**Not performed:** a field (RUM) performance check on real devices; there's no deployed site. A throttled real-device check is not done either. The Lighthouse numbers are lab numbers from localhost.
