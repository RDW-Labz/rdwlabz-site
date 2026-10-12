# rdwlabz.com

Website for RDW Labz: software, games, mods and asset packs. It's built with Astro (static output), TypeScript and Tailwind CSS 4, and is intended for Cloudflare Pages.

Pages: `/` Home, `/projects` Projects, and a branded 404. Contact is a footer/CTA mailto, shown as "Email coming soon" until a real address is set.

## Run locally

Requires Node 22.12+.12+.

```sh
npm install
npm run dev        # http://localhost:4321 (also serves the dev-only /_gallery and /_studies)
npm run build      # astro check + static build to dist/
npm run preview    # serve dist/
```

Checks:

```sh
npm run lint                          # ESLint + Prettier
npm test                              # Playwright: e2e + screenshots (builds and previews on :4392)
npx playwright test --project=e2e     # e2e only (axe, keyboard, filters, menu, SEO, no-JS, reduced motion)
npm run lhci                          # Lighthouse CI: mobile, 3 runs, median asserted (preview on :4393)
node scripts/budgets.mjs              # JS / CSS / font weight per page (run after a build)
node scripts/motion-check.mjs http://localhost:4392 /tmp/motion   # transition frames, listener leaks, CLS (needs a running preview)
```

If Playwright can't find a browser, run `npx playwright install chromium`.

## Add or edit a project

Everything lives in `src/data/projects.json`. Replace the `TODO` placeholders; don't invent details.

```json
{
  "slug": "my-mod",
  "name": "My Mod",
  "oneLiner": "One sentence on what it is.",
  "category": "mods",
  "status": "released",
  "platforms": ["PC"],
  "url": "https://example.com/my-mod",
  "accentColor": "#12a150",
  "image": "/projects/my-mod.webp",
  "featured": true
}
```

- `category`: `software` | `games` | `mods` | `asset-packs`
- `status`: `released` | `in-dev` | `coming-soon`
- `url`: `null` shows "Link coming soon"
- `accentColor`: a hex code, or `TODO` to use the category color
- `image`: `null` uses generated card art
- `featured: true` puts the project on Home (at most 6 are shown)

Images go in `public/projects/` (16:10, about 1600×1000, ≤ 120 KB, WebP or AVIF). Only use images RDW Labz has rights to; no third-party game art or logos. Log each one in `docs/ASSETS.md`.

The `site` block holds the tagline, contact email, launch date and an optional "work with us" line. Any value starting with `TODO` is hidden or replaced with a "coming soon" state. Build-time validation fails on an unknown category or status, or a duplicate slug.

## Analytics

Cloudflare Web Analytics is included only when `PUBLIC_CF_BEACON_TOKEN` is set at build time (as a Cloudflare Pages environment variable). Without it, no analytics script ships.

## Go live (Braden only; the agent doesn't push, deploy or touch DNS)

1. Push this repo to your Git host.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo. Build command `npm run build`, output directory `dist`, Node 22.12+.
3. Custom domains → add `rdwlabz.com` (and `www` if you want it), then follow the DNS prompts. If DNS isn't on Cloudflare, add the CNAME it shows at your DNS host.
4. Web Analytics → add the site → copy the token → set `PUBLIC_CF_BEACON_TOKEN` in the Pages project's environment variables → redeploy.
5. Before launch, fill in the TODOs in `src/data/projects.json` (see `docs/PREFLIGHT.md`).

## Docs

- `docs/BUILD-SPEC.md`: spec (source of truth)
- `docs/PLAN.md`: scope
- `docs/BRIEF.md`: brief
- `docs/ART-DIRECTION.md`: the chosen direction (Workbench) and why
- `docs/REVIEWS.md`: the three review passes
- `docs/PREFLIGHT.md`: launch checklist with honest statuses
- `docs/PATTERNS.md`: reusable patterns
- `docs/ASSETS.md`: asset provenance
- `docs/PROGRESS.md`: milestone log
- Screenshots: `docs/screenshots/`
