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
