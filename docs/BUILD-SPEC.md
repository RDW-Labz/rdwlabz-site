# RDW Labz Website — Build Spec (source of truth)

> Read fully before writing code. `.cursor/rules/` holds the short always-on version. `docs/PLAN.md` is the approved scope. `seed/projects.json` is the starting project data.

## 0. Project facts (verified — do not contradict)

- **Brand:** **RDW Labz** — a dev team that builds software, games, mods, asset packs and more.
- **Site:** **rdwlabz.com**. No UI exists yet. **Greenfield** build in a **new repo**.
- **Fully separate** from any other company or site. No references, links, logos or styling from other businesses.
- **Developer:** Braden.
- **Site job:** studio hub + project showcase + way to reach out.
- **Audience:** players, modders and buyers of our games/mods/asset packs, AND potential clients/collaborators checking our work.
- **Pages in v1:** Home (`/`) and Projects (`/projects`). Plus a shared header, footer and a 404 page.
- **Contact:** footer `mailto:` link only. No form, no backend.
- **Brand identity:** none exists. Create it (RDW Labz wordmark + icon mark, palette, fonts).
- **Vibe:** **playful tech** — bright, friendly, moving, game/indie-studio feel, still professional for clients.
- **Project list and links:** added later. Ship placeholder states that look intentional.

Out of v1: contact form, About/team, blog/devlog, CMS, logins, store/checkout, per-project detail pages.

## 1. Mission and quality bar

Act as lead product designer, art director, UX architect, motion designer and frontend lead. **Build the site**; do not stop at an audit, moodboard or static mockup.

Make it feel authored for RDW Labz, not a template: strong typography, composition, color, custom illustration, purposeful motion. Quality = visual distinction + clear organization + accessibility + responsiveness + speed + maintainable code, together. Never trade a core requirement for spectacle.

Defaults: make reversible creative decisions yourself; complete at least three real post-build review passes; verify every completion claim.

## 2. Owner's design taste (hard requirements)

- **Organization and user flow come first.** Visual flair never comes before that.
- Wants: smooth rounded edges, **pill buttons and chips**, **color gradients that separate sections from the background**, **visible animations when navigating**, clean **characterful/novelty display fonts**.
- Dislikes: rigid, harsh, flat "bland slop" — sharp boxes, no section separation, default fonts, no motion.
- Avoid the generic AI-site look: reflexive purple gradients, interchangeable card grids, random glass effects, big empty areas. These are allowed only when they earn their place.

## 3. Discover and brief (short)

New repo, so discovery is light. Write `docs/BRIEF.md` (one page) with:
- Mission, audiences, primary jobs (understand who RDW Labz is → see what we build → reach out).
- Key journeys: (1) visitor lands on Home → understands who we are in 5 seconds → opens Projects; (2) player/modder finds a game, mod or asset pack → clicks out to it; (3) potential client scans our work → emails us.
- Verified facts (section 0), design assumptions you made, and open questions.

**Do not invent** customers, download counts, stats, testimonials, revenue, clients, team members or project details. Use clearly marked placeholders (`TODO:` in data, tasteful "Coming soon" in UI) for anything unknown: tagline, project list, project blurbs, links, images, contact email.

## 4. Stack (decided)

- **Astro + TypeScript**, **Tailwind CSS**, small motion layer (CSS + View Transitions API + Motion One or similar; check current docs and versions before installing).
- **Cloudflare Pages** hosting (assumed — confirm where rdwlabz.com DNS lives), auto-build from GitHub, preview URL per PR.
- **Cloudflare Web Analytics** (no cookie banner).
- All projects in **`src/data/projects.json`** (name, slug, one-liner, category `software|games|mods|asset-packs`, status `released|in-dev|coming-soon`, platform tags, url or null, accent color, image path). Home and Projects both read from it. Adding a project = one edit.
- Fonts from Google Fonts or self-hosted, subset, `font-display: swap`.
- Keep dependencies minimal. No component library unless justified.

## 5. Art direction

Before building broadly, create **three genuinely different directions** for a playful-tech indie dev studio. Each differs in design logic, not just color: concept, type pairing, palette, composition, imagery/illustration style, interaction language, motion character.

Render all three as quick studies of the **Home hero + first project section**, desktop and mobile, on a local `/_studies` route (excluded from production build). Pick the strongest yourself using: fit for both audiences, clarity, distinctiveness, owner's taste (section 2), feasibility, performance. Record why in `docs/ART-DIRECTION.md`.

Then write a compact spec in that file: design thesis, palette roles (light + dark if you do dark), type scale, grid, spacing, radii (rounded, pill), gradient rules for section separation, illustration treatment, motion principles. Name **one or two signature moments**, e.g.:
- A hero where the RDW Labz mark acts like a lab/workbench: project types (software, game, mod, asset pack) snap together or "spawn" out of it.
- Project cards that take on each project's accent color and lift/tilt playfully on hover/focus.

Each project card uses its own accent color so the Projects page feels varied but stays one system.

## 6. Design system

Build semantic tokens (Tailwind theme + CSS variables): color, type, spacing, radii, borders, elevation, z-layers, motion (durations, easings, springs).

Primitives the site actually uses: Button (pill: primary, secondary, ghost), Chip (filter + status), ProjectCard, Section (with gradient separation), Header/Nav (with mobile menu), Footer, Link, Logo, Icon set. Cover default, hover, focus-visible, active, selected, disabled states.

Make a small `/_gallery` route (excluded from production) showing every primitive and state.

## 7. Pages and UX

**Home**
1. Hero: name, one-line tagline (placeholder until provided), signature animation, two pill CTAs: "See our projects" → `/projects`, "Get in touch" → mailto.
2. What we build: 4 tiles — Software, Games, Mods, Asset packs (placeholder copy, no invented claims). Each links to `/projects?c=<category>`.
3. Featured projects: items with `featured: true` in `projects.json`.
4. Work with us: short strip for clients/collaborators (only verified facts; otherwise placeholder).
5. CTA band → email.

**Projects**
1. Intro line.
2. Filter chips: All, Software, Games, Mods, Asset packs (keyboard-operable, URL-reflected e.g. `?c=mods`).
3. Project grid: image, name, one-liner, category chip, status chip, platform tags, link button. `url: null` → "Coming soon" state, not a dead button.
4. Empty state when a filter has no projects.

**Shared:** sticky header (logo, Home, Projects, pill Contact), footer (mailto, © year RDW Labz), 404 page in the brand style, skip link.

Give each Home section a distinct narrative role and layout; don't repeat the same card grid. Test extremes: 1 project, 20 projects, very long names/blurbs, missing images, a category with zero projects.

## 8. Motion system

Use motion to tell the story: who we are → what we build → see the projects → reach out. Scroll-triggered reveals and staged disclosure are fine; **no scroll hijacking**, no trapped sections, no custom cursor, no hover-only info.

- Page transitions: Astro View Transitions (owner wants visible navigation animation).
- For each big effect write in `docs/ART-DIRECTION.md`: purpose, trigger, duration/easing, interrupt/reverse behavior, cost, fallback.
- Everyday feedback (hover, press, focus) is instant. Never delay content to show off animation.
- `prefers-reduced-motion`: real static/reduced versions. Pause offscreen and background animation. Clean up listeners/observers.
- Content must be fully readable if JS or animation fails.

## 9. Assets

- Prefer **custom SVG illustration and CSS/SVG motion** (light, crisp, themeable).
- Higgsfield/Kling or other generators are optional and only if already set up and free to use. **No new paid spend** without asking Braden.
- Write an asset brief before making assets (purpose, placement, ratios, crops, file budget, fallback).
- No text or controls baked into images. Optimize (AVIF/WebP, responsive sizes). Record provenance and license in `docs/ASSETS.md`. Don't use downloaded images unless clearly licensed.
- Project images/screenshots: placeholders until provided. Never use third-party game art, logos or trademarks (e.g. a game a mod targets) unless Braden confirms we have rights.

## 10. Execution (Cursor agent)

- You (the Cursor agent) do the work directly in this repo. Use Cursor background/parallel agents only if they are actually available, and only for tasks with separate files.
- One owner each for: design tokens/Tailwind config, header/nav, `package.json`/lockfile. Never have two agents edit these at once.
- Don't sit idle waiting on a long command; pick up the next non-conflicting task.
- Use only free/included tools and models. **No paid services, API keys or accounts** without asking Braden.
- Never put secrets in code, logs, screenshots or docs.
- Never pretend a tool, model or check ran. Report what actually happened.
- Keep `docs/PROGRESS.md` updated at each milestone (what's done, what's next, blockers).

## 11. Build order

1. Scaffold the Astro project **in this folder** (keep `docs/`, `seed/`, `.cursor/`, `AGENTS.md`; move `seed/projects.json` to `src/data/projects.json`) with TS, Tailwind, lint/format, Playwright, Lighthouse CI. Record baseline.
2. Three direction studies → pick → art-direction spec.
3. Tokens + primitives + `/_gallery`.
4. Home end-to-end (desktop + mobile) — validate direction in the real app.
5. Projects page + filters + states, `projects.json`.
6. 404, SEO (titles, meta, Open Graph image, favicon set, sitemap, robots), analytics snippet.
7. Three review passes (section 13).
8. Preflight + handoff.

## 12. Accessibility and performance

- **WCAG 2.2 AA**: semantic HTML, landmarks, keyboard nav, visible focus, contrast (check text on gradients!), 200% zoom/reflow, 24px+ targets, accessible mobile menu with focus trap/restore, reduced motion.
- Run axe (or similar) + manual keyboard pass. Don't claim full conformance from a score. Note any screen-reader checks not performed.
- Budgets (set before heavy visuals, don't loosen later): JS per page ≤ 60 KB gz, fonts ≤ 2 families / ≤ 120 KB, hero media ≤ 200 KB, CLS ≈ 0.
- Targets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1. Lighthouse (production build, mobile profile, 3 runs, report median) ≥ 90 on Performance, Accessibility, Best Practices, SEO. Label lab vs field numbers honestly.

## 13. Three post-build passes (the first build doesn't count)

Each pass: look at the rendered site (Playwright screenshots desktop 1440, tablet 768, mobile 390), list findings, fix, re-render, retest. If nothing needs fixing, record what you checked.

1. **Art direction & craft:** hierarchy, type, spacing, color, gradients, alignment, consistency with spec. Strengthen the signature moment; cut weak or overdone bits.
2. **UX, states & accessibility:** journeys from section 3, filters, empty/coming-soon/404 states, long content, keyboard, focus, zoom, reduced motion.
3. **Motion, performance & reliability:** motion in action incl. reverse scroll and route changes, low-power fallback, production build, console errors, layout shift, missing assets, cleanup. Confirm no regressions.

Rerun affected checks after the last change.

## 14. Preflight and handoff

Keep `docs/PREFLIGHT.md` table: criterion | scope | status (PASS / FAIL / BLOCKED / NOT RUN / N/A + reason) | evidence | open issue. Cover: scope, design-system consistency, journeys and states, responsive, a11y + reduced motion, motion fallbacks, budgets, lint/type/test/build, console/network errors, asset rights, all three passes.

Never delete tests, weaken assertions or mark unrun checks green. If not everything passes, say **NOT READY / PARTIALLY VERIFIED** with exact blockers.

**Permissions:** You may create the local repo and commit locally. **Do not push, merge, deploy to the live domain, or touch DNS** — Braden merges himself, and go-live needs his OK. Ask before any paid spend.

**Final handoff (short):**
- What was built and why; selected direction + screenshots (desktop/mobile) in `docs/screenshots/`.
- How to run locally and how to add a project.
- Findings and fixes from all three passes.
- Lighthouse/budget results (lab).
- Preflight status.
- Open questions / placeholders still needing real content: tagline, project list + blurbs + links + images, contact email, launch date.
- Go-live steps: connect repo to Cloudflare Pages, attach rdwlabz.com, enable Web Analytics.

Only list paths, URLs and numbers that actually exist.

## 15. Reusable outputs

Save useful patterns (project card, gradient section, view-transition setup, review-pass checklist) as a short project-local `docs/PATTERNS.md`. Mark validated vs experimental. No secrets or unlicensed assets.

**Final standard:** striking at first glance, clear in 5 seconds, fun for players and modders, credible for clients, and technically solid under inspection.
