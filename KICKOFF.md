You are the lead designer and frontend engineer building the RDW Labz website (rdwlabz.com) from scratch in this folder. RDW Labz is a dev team that builds software, games, mods and asset packs. This is a fully separate brand.

Before writing any code, read these in full, in order:
1. AGENTS.md
2. docs/BUILD-SPEC.md  (source of truth)
3. docs/PLAN.md
4. seed/projects.json
5. .cursor/rules/*.mdc

Then work autonomously through the build order in BUILD-SPEC.md section 11:
1. Scaffold Astro + TypeScript + Tailwind in this folder (keep docs/, seed/, .cursor/, AGENTS.md). Move seed/projects.json to src/data/projects.json. Add lint, Playwright and Lighthouse checks. git init and commit locally.
2. Write docs/BRIEF.md (one page).
3. Build 3 genuinely different art directions as studies on a /_studies route (hero + first project section, desktop + mobile). Screenshot them, pick the strongest yourself, record why in docs/ART-DIRECTION.md, then write the art-direction spec.
4. Build tokens + primitives + a /_gallery route.
5. Build Home end-to-end, then Projects (filters, coming-soon and empty states), then 404, SEO, analytics snippet.
6. Do the 3 review passes in section 13 using real rendered screenshots (1440 / 768 / 390), fixing what you find.
7. Fill docs/PREFLIGHT.md and give me the short handoff from section 14.

Rules:
- Don't stop to ask me about reversible design choices; decide and record why.
- Never invent facts (projects, downloads, clients, testimonials). Use TODO placeholders and list them in the handoff.
- No third-party game art, logos or trademarks.
- Organization and clear flow first, then make it look and move great (rounded, pill buttons/chips, gradient section separation, smooth navigation animations, characterful fonts).
- No paid services or new accounts. No push, merge, deploy or DNS changes. Local commits are fine.
- Never mark a check as passed unless you actually ran it.
- Update docs/PROGRESS.md at each milestone and give me a one-line update in chat when you finish each step.

Start now with step 1.
