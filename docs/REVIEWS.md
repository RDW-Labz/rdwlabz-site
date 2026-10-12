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
