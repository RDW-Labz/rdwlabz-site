# AGENTS.md — RDW Labz website

Greenfield site for **rdwlabz.com** — RDW Labz, a dev team that builds software, games, mods and asset packs. No UI exists yet. Fully separate from any other company or site.

**Read first, in order:**
1. `docs/BUILD-SPEC.md` — full build spec (source of truth)
2. `docs/PLAN.md` — approved scope
3. `src/data/projects.json` — project data (moved from `seed/`)

**Stack:** Astro + TypeScript + Tailwind, Cloudflare Pages (assumed), Cloudflare Web Analytics.
**Pages (v1):** `/` Home, `/projects` Projects, 404. Contact = footer mailto only.

**Hard rules**
- Don't invent facts (projects, downloads, players, clients, testimonials, links). Use `TODO:` placeholders.
- No third-party game art, logos or trademarks without confirmed rights.
- Organization and user flow before visual flair.
- WCAG 2.2 AA + real reduced-motion support.
- No paid services or new accounts without asking.
- Don't push, merge, deploy, or touch DNS. Local commits are OK.
- Keep `docs/PROGRESS.md` current.

**Commands:** `npm run dev` · `npm run build` (astro check + build) · `npm run preview` · `npm run lint` (ESLint + Prettier) · `npm test` (Playwright vs production build) · `PW_DEV=1 npm run test:shots` (screenshots incl. dev-only routes) · `npm run lhci` (Lighthouse CI, mobile, 3 runs) then `node scripts/lh-summary.mjs`.
Dev-only routes: `/_studies`, `/_gallery` (injected only in `astro dev`; never in the production build).
Ports: dev tests 4391, prod tests 4392, Lighthouse 4393 (`reuseExistingServer` is off on purpose).
