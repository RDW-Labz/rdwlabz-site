# RDW Labz — Site brief (v1)

## Mission

rdwlabz.com is the studio hub for **RDW Labz**, a dev team that builds software, games, mods and asset packs. In one visit it should say who we are, show what we build, and make reaching out effortless.

## Audiences

| Audience                          | What they want                                         | What they need from us                           |
| --------------------------------- | ------------------------------------------------------ | ------------------------------------------------ |
| Players                           | Find our games, see status/platforms, click out to play | Clear project cards, status chips, working links |
| Modders                           | Find our mods, know what platform/game they're for     | Category filter, platform tags                   |
| Asset-pack buyers                 | Browse packs, get to the store page                    | Category filter, outbound link per pack          |
| Potential clients / collaborators | Judge craft and range, contact us                      | Credible, organized work list + obvious email    |

## Primary jobs (in order)

1. **Understand** who RDW Labz is (≤ 5 seconds on Home).
2. **See** what we build (four categories → Projects).
3. **Reach out** (mailto, always one click away in header + footer + CTA band).

## Key journeys

1. **Land → understand → browse.** Home hero states name + what we build → "See our projects" pill → `/projects`.
2. **Player/modder finds a thing.** Home "What we build" tile (e.g. Mods) → `/projects?c=mods` (filter pre-applied) → card → outbound link (or a clear "Coming soon" state).
3. **Client scans → emails.** Home → featured projects / Projects grid → "Get in touch" (header pill, Work-with-us strip, CTA band, footer) → mailto.

## Verified facts (from BUILD-SPEC §0)

- Brand **RDW Labz**; domain **rdwlabz.com**; developer **Braden**.
- Builds software, games, mods, asset packs.
- v1 = Home, Projects, 404; contact = footer mailto only; no forms/CMS/logins/store/blog.
- No existing brand identity — we create it. Vibe: playful tech, indie-studio, still professional.
- Hosting assumed Cloudflare Pages + Cloudflare Web Analytics.

## Design assumptions (reversible, decided by the agent)

- **Light-first** palette with a dark, high-contrast footer/CTA band for section rhythm. No dark mode toggle in v1 (less surface to test; can add later).
- Brand mark is a custom SVG (no third-party marks). Project images fall back to a generated, accent-colored SVG pattern so missing art still looks intentional.
- Header "Contact" pill and every "Get in touch" CTA use the same `mailto:` from `projects.json → site.contactEmail`. While that value still starts with `TODO`, contact CTAs render as a non-interactive "Email coming soon" pill (no dead mailto to a fake address). Filling the email is a go-live blocker.
- Placeholder copy is visibly a placeholder in data (`TODO:`) and renders as tasteful "Coming soon" / neutral copy in UI — never as fake claims.
- "Work with us" strip states only what we do (the four categories) and how to reach us; no clients, stats, or testimonials.

## Open questions (placeholders until Braden answers)

- Tagline (one sentence).
- Project list: names, category, status, platforms, one-liners, links, images, accent colors.
- Contact email (currently `TODO@rdwlabz.com`).
- ~~Where rdwlabz.com DNS lives~~ Confirmed: Cloudflare (2026-10-12).
- Target launch date.
- Is there anything to say in "Work with us" beyond "we build X, email us" (e.g. availability, kinds of work)?
