# Assets — brief, provenance, license

## Asset brief (written before making assets)

| Asset | Purpose | Placement | Ratio / size | Budget | Fallback |
|---|---|---|---|---|---|
| Logo mark | Brand recognition | Header, footer, favicon, OG | 1:1 (40-unit SVG) | < 1 KB | n/a (inline SVG) |
| Lab bench | Signature hero object; category entry points | Home hero | 1:1, max 520px | 0 KB images (CSS + inline SVG) | Static final layout (reduced motion) |
| Project art | Card image | Project cards | 16:10 | ≤ 120 KB each (AVIF/WebP) when real images arrive | Generated accent gradient + stripes + category icon (0 bytes) |
| 404 illustration | Friendly dead-end | 404 | ~6:5 | inline SVG | Static tipped flask |
| Favicons | Browser/OS icons | `public/` | 32, 180, 192, 512 + SVG + ICO | < 20 KB each | SVG favicon |
| OG image | Link previews | `public/og.png` | 1200×630 | ≤ 200 KB | n/a |

No text or controls are baked into images, except the OG image, which is a link preview by nature. Its text only repeats verified facts: the name and "We build software, games, mods and asset packs."

## Inventory

| File | Made by | How | License / rights |
|---|---|---|---|
| `src/components/Logo.astro`, `public/favicon.svg` | Agent (Cursor), 2026-10-12 | Hand-written SVG | Original work for RDW Labz |
| `src/components/Icon.astro` (12 icons) | Agent, 2026-10-12 | Hand-written SVG paths | Original work for RDW Labz |
| `src/components/home/LabBench.astro` | Agent, 2026-10-12 | Inline SVG + CSS | Original work for RDW Labz |
| `src/pages/404.astro` illustration | Agent, 2026-10-12 | Inline SVG | Original work for RDW Labz |
| `public/favicon.ico`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og.png` | `node scripts/make-icons.mjs` | Rendered from `public/favicon.svg` in headless Chromium | Original work; OG uses Bricolage Grotesque + Figtree (SIL OFL 1.1) |
| Fonts: Bricolage Grotesque, Figtree | Google Fonts via Astro Fonts API (self-hosted at build) | — | SIL Open Font License 1.1 |
| Study-only fonts (dev route only, not shipped): Pixelify Sans, Space Grotesk, Unbounded, IBM Plex Mono | Google Fonts | — | SIL OFL 1.1 |

No AI-generated images, stock photos or third-party game art, logos or trademarks are used. Higgsfield and other generators were not used.

## Adding real project images

Put the files in `public/projects/<slug>.webp` (or `.avif`), 1600×1000 (16:10), at most about 120 KB each, then set `"image": "/projects/<slug>.webp"` in `src/data/projects.json`. Only use images RDW Labz owns or has rights to, and log each one here.
