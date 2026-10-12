# Art direction

Studies live on the dev-only route `/_studies` (`src/dev/studies/`). Screenshots: `docs/screenshots/studies/study-{a,b,c}-{desktop,mobile}.png` (Playwright, 1440×900 and 390×844, captured 2026-10-12).

## The three studies

| | A — Workbench | B — Arcade cartridge | C — Blueprint |
|---|---|---|---|
| Concept | The studio is a lab bench; the mark is a flask that "spawns" the four things we make | A retro console booting up; projects are cartridges | An engineering drawing; projects are spec sheets |
| Type | Bricolage Grotesque (display) + Figtree (body) | Pixelify Sans + Space Grotesk | Unbounded + IBM Plex Mono |
| Palette | Warm paper, plum-ink, tomato, sun, per-category brights | Night navy, neon lime/pink/cyan | Blueprint blue grid, navy ink, safety orange |
| Composition | Split hero, chunky outlined "sticker" objects, stacked rounded trays | Centered arcade marquee, synthwave horizon, cartridge grid | Split hero, annotated exploded diagram, numbered sheets |
| Imagery | Thick-outline SVG objects, stripes, offset solid shadows | Pixel art, scanlines, glow | Thin linework, dimension lines, grids |
| Interaction | Springy lift + tilt, shadow grows in accent | Cartridge "inserts" upward with glow | Calm lift, precise |
| Motion character | Bouncy spawn, idle wobble/bubbles | Stepped typing, blink, glitch | Line draw-in, fades |

## Scoring (1–5, from the rendered screenshots)

| Criterion | A | B | C |
|---|---|---|---|
| Fit for players/modders | 4 | 5 | 2 |
| Fit for clients | 4 | 2 | 5 |
| 5-second clarity | 5 | 3 | 4 |
| Distinctiveness | 4 | 3 | 4 |
| Owner taste (§2: rounded, pills, gradients, motion, characterful type) | 5 | 3 | 3 |
| Feasibility / performance | 5 | 4 | 5 |
| **Total** | **27** | **20** | **23** |

## Decision: **A — Workbench**

Why:
- It's the only one that reads as both "fun indie studio" and "competent team you can hire". B is great for players but the dark neon/synthwave look is close to the generic gamer template and weak for clients; C is credible but cold, and a mono body font hurts long-form readability.
- **Legibility problem in B:** in the pixel face, "LABZ" reads as "LAB2" at hero size. That's disqualifying for a brand name.
- A hits every owner-taste item natively: chunky rounded radii, pill buttons/chips, warm gradient trays that clearly separate sections, a characterful variable display face, and a signature animation that *explains the business* (the lab makes four kinds of things).
- Everything is CSS + inline SVG: no image weight, themeable, crisp.

Borrowed from the others: C's **numbered labels** (01–04) for the "What we build" tiles to add organization; B's **status-light** idea becomes the small dot in status chips.

Fixes needed vs the study (found in screenshots): headings were rendering at 400 because Tailwind preflight resets heading weight → set weights explicitly in tokens; the auto-fill grid left an empty 4th column at 1440 with 3 cards → use explicit responsive column counts; the bright tomato fails AA under white text (3.31:1) → primary button uses tomato-700.

---

# Art-direction spec (Workbench)

## Design thesis

**RDW Labz is a workbench where things get made.** Every surface is a sturdy, rounded object with a thick plum-ink outline and a solid offset shadow, like stickers and toy parts laid on warm paper. Color comes from the things we make (each category and each project has its own accent); the frame stays calm so the work pops.

## Palette roles (light only in v1)

| Token | Hex | Role |
|---|---|---|
| `ink` | `#1e1433` | Text, outlines, offset shadows, dark bands |
| `ink-soft` | `#544a6b` | Secondary text (≥ 6:1 on every light surface) |
| `paper` | `#fff6ea` | Page background (with 22px dot grid) |
| `surface` | `#ffffff` | Cards, header, chips |
| `cream` | `#ffe7c7` | Active nav, subtle fills |
| `tomato` | `#ff4d2e` | Brand accent — decoration only (fails AA under white text) |
| `tomato-700` | `#d4321a` | Primary button bg (white text 4.92:1), links |
| `sun` | `#ffc23d` | Highlights, eyebrow chip, accents on dark |
| Category accents | software `#3d7bff`, games `#ff4d2e`, mods `#16b67e`, asset-packs `#b04cf0` | Tiles, icons, card fallbacks when `accentColor` is TODO |

Contrast checked with `node scripts/contrast.mjs` (WCAG 2.x formula). Text on gradients always uses `ink`/`ink-soft`, which pass on both gradient endpoints.

## Gradients (section separation)

Sections are **trays**: full-bleed panels with `rounded-t-[56px]` (36px mobile), a 2px ink top border, and their own soft vertical gradient. Each tray overlaps the one above by its radius so the page reads as stacked objects.

- `grad-bench` 145° `#ffd77a → #ff8a5c → #ff5fa2` — hero bench only (signature object, no text on it).
- `grad-peach` 180° `#ffe0bd → #ffd2e1` — "What we build".
- `grad-mint` 180° `#d9f7e8 → #dfe8ff` — "Featured projects" / Projects grid.
- `ink band` `#1e1433` + two radial glows (tomato, sun at ≤ 35% opacity) — CTA band + footer.

Rule: never two adjacent trays with the same gradient; no purple-to-blue "AI" gradients.

## Type

- Display: **Bricolage Grotesque** variable (wght 400–800, `wdth` axis via `font-variation-settings`), tight tracking (−0.02 to −0.045em).
- Body/UI: **Figtree** variable (400–700).
- Two families total; both self-hosted woff2 via Astro Fonts API, `font-display: swap`, metric-matched fallbacks.

| Step | Size (clamp) | Use |
|---|---|---|
| `display` | 64 → 132px, lh 0.88, 800 | Hero wordmark |
| `h1` | 44 → 80px, lh 0.95, 800 | Page titles |
| `h2` | 34 → 56px, lh 1, 800 | Section titles |
| `h3` | 22 → 26px, lh 1.15, 700 | Card titles |
| `lead` | 20 → 30px, lh 1.2, 600 | Tagline, intros |
| `body` | 17px, lh 1.55 | Paragraphs |
| `small` | 14px | Meta |
| `chip` | 13px, 700 | Chips |

## Grid, spacing, radii

- Container max 1240px, gutters `clamp(16px, 4vw, 48px)`.
- 4px base spacing scale; section padding 64–96px desktop, 48–56px mobile.
- Columns: tiles 4 → 2 → 1; project cards 3 → 2 → 1.
- Radii: `sm` 12, `md` 20, `lg` 32 (cards), `xl` 48 (bench, trays mobile 36/desktop 56), `pill` 999.
- Borders: 2px ink on objects; 1.5px on chips.
- Elevation: solid offset shadows only (`0 4px 0`, `0 6px 0`, `0 10px 0` in ink or accent). No blurry drop shadows, no glass.

## Illustration treatment

- Custom inline SVG only: rounded strokes (2px), filled shapes with ink outline, flat brand colors, stripes for texture.
- Missing project images → generated accent art: accent → accent-darkened diagonal gradient + 45° white stripes + large category icon. Looks intentional, costs 0 bytes.
- Never third-party game art/logos.

## Motion principles

1. **Explain, don't decorate:** motion shows the lab *making* things (spawn) and the page *moving between rooms* (transitions).
2. **Feedback is instant** (≤ 120ms): hover/press/focus never wait.
3. **Springy, short:** `--ease-spring: cubic-bezier(.34,1.56,.64,1)`, `--ease-out: cubic-bezier(.22,1,.36,1)`; durations 120 / 200 / 320 / 600 / 900ms.
4. **Content first:** text is never hidden behind an animation; reveals start from `opacity: .001` only when JS is present (`.js` class) and finish within 600ms.
5. **Reduced motion is a real version:** no spawn/wobble/bob/tilt, no view-transition slides (cross-fade only), reveals off.

## Signature moments

### 1. The lab bench spawn (hero)
- **Purpose:** in one glance, show that RDW Labz makes four kinds of things. The four tokens are real links to `/projects?c=<category>`.
- **Trigger:** first paint of Home (CSS animation, no JS needed).
- **Timing:** tokens spring from the flask, 900ms `ease-spring`, 140ms stagger, starting at 150ms. Then a slow idle bob (4s) on tokens + flask wobble + bubbles.
- **Interrupt/reverse:** none needed (one-shot); hovering a token lifts it instantly.
- **Cost:** CSS transforms/opacity only (compositor). Idle loops pause when the bench is offscreen (IntersectionObserver toggles `data-paused`) and when the tab is hidden.
- **Fallback:** reduced motion / no-animation → tokens rendered at final positions, static. No JS → animation still runs once, loops just never pause (cheap).

### 2. Sticker project cards
- **Purpose:** each project feels like its own object; accent color makes the grid varied but systematic.
- **Trigger:** hover and `:focus-within`.
- **Timing:** lift −6px + rotate −1.2°, shadow 6 → 12px in accent, 160ms `ease-spring`. Press: shadow collapses to 2px (80ms).
- **Interrupt/reverse:** CSS transitions reverse naturally.
- **Cost:** transform + box-shadow on one element.
- **Fallback:** reduced motion → no tilt/lift, outline + shadow color change only.

### Page transitions (owner requirement)
- **Purpose:** visible, smooth sense of moving between rooms.
- **Trigger:** internal navigation via Astro `<ClientRouter />` (View Transitions).
- **Timing:** old main fades/slides down 12px out (200ms), new main slides up from 24px in (420ms `ease-out`). Header persists; the active-nav pill **morphs** between Home and Projects (`view-transition-name: nav-pill`).
- **Interrupt/reverse:** browser handles; back/forward plays the same animation.
- **Cost:** browser-native snapshots.
- **Fallback:** unsupported browsers → normal navigation (Astro fallback `animate`/none). Reduced motion → instant cross-fade.

### Filter transitions (Projects)
- **Purpose:** show cards leaving/arriving when a filter changes rather than a jarring jump.
- **Trigger:** filter chip activation.
- **Timing:** `document.startViewTransition` around the DOM update; cards morph to new positions (~300ms).
- **Fallback:** no API or reduced motion → instant update. No JS → all projects shown, chips are plain links to `?c=…`.

### Scroll reveals
- **Purpose:** staged disclosure of each tray's content.
- **Trigger:** IntersectionObserver (threshold 0.15), once per element, then unobserved.
- **Timing:** translateY 24px → 0 + opacity, 600ms `ease-out`, 60ms stagger.
- **Fallback:** no JS or reduced motion → visible immediately. No scroll hijacking.
