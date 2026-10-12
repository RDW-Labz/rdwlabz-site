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
- `url`: `null` shows "Link coming soon" (released) or "Not out yet"
- `statusLabel` (optional): replaces the status chip text, e.g. "Coming to Google Play"
- `cta` (optional): button text, e.g. "Play free on itch.io" (default "View project")
- `screenshots` (optional): up to 4 `{ "src", "width", "height", "alt" }` real screenshots; shown instead of the art
- `accentColor`: a hex code, or `TODO` to use the category color
- `image`: `null` uses generated card art
- `featured: true` puts the project on Home (at most 6 are shown)

Categories with no projects are hidden everywhere (home, filter chips, counts, hero copy). With one active category, Home shows it as the main section.

Images go in `public/projects/` (16:10, about 1600×1000, ≤ 120 KB, WebP or AVIF). Only use images RDW Labz has rights to; no third-party game art or logos. Log each one in `docs/ASSETS.md`.

### Auto project tracker (fully automatic)

**What gets listed** (RDW-Labz org only; nothing else, ever):
- Any repo whose app has a **public store listing**, found from ids in the repo's default branch: Android `applicationId` (Gradle, Capacitor, Expo) on Google Play, iOS bundle id (Xcode project, Info.plist, Capacitor, Expo) on the App Store, `steam_appid.txt` on Steam, and Modrinth or CurseForge project ids (Gradle or `gradle.properties`).
- Any repo with a public **itch.io** page as its `url` in `rdwlabz.json` or as the repo homepage (e.g. `https://you.itch.io/game`). A draft or unpublished page counts as nothing. Listed as `released`, with the itch platforms and a "Play free on itch.io" button (free) or "Get it on itch.io" (paid).
- Any repo with the GitHub topic **`rdwlabz`**, for in-dev work.

**How fields are filled** (an optional `rdwlabz.json` at the repo root overrides any of them):

| Field | Source |
|---|---|
| name | Store title once listed, otherwise the repo name prettified (`putt-drop` → "Putt Drop") |
| oneLiner | Repo description |
| category | Repo topics (`game`, `mod`, `asset-pack`, `software`), then the store type, then a guess from files (Godot/Unity/Phaser → games, Fabric/Forge/Paper → mods, assets-only → asset packs), else software |
| status, url, platforms | A live store page means `released` with the store link and its platforms. A public repo with a GitHub Release is `released`, linked to its releases page. Otherwise `in-dev` with no link |
| releasedAt | Store release date, otherwise the first GitHub Release |
| icon | Store icon, or the app icon in the repo (Android mipmap, iOS AppIcon, `assets/icon.png`, ...), saved as a 256 px WebP in `public/projects/<slug>-icon.webp`. Steam header images become card art (`<slug>-art.webp`) |
| accentColor | The icon's dominant color, darkened until white on it passes WCAG AA (4.5:1) |

**Privacy:** for a private repo, its name, description and GitHub links are only used once the app has a public store page. Until then it needs `"name"` in `rdwlabz.json` (the run says so in the PR) and gets no description. Entries are keyed by a hash of the repo id, so repo names never appear in the data, logs or PR.

**`rdwlabz.json` (optional):** any of `name`, `oneLiner`, `category`, `status`, `statusLabel`, `platforms`, `url`, `image`, `accentColor`, `featured`, `slug`, `screenshots`, store ids (`androidId`, `iosBundleId`, `steamAppId`, `modrinthId`, `curseforgeId`), or `"hidden": true` to keep a repo off the site. `TODO` values are ignored. See `templates/`. `screenshots` is a list of up to 4 image paths in the repo (`"store/shot.png"` or `{ "path": "...", "alt": "..." }`); each is saved as `public/projects/<slug>-shot-N.webp` (fits 960×960) and replaces store art. Real captures only, never mockups or AI images.

**Hand edits always win:** each synced entry keeps a short fingerprint of what the sync last wrote (`sync.written`). Change or delete a field in `projects.json` by hand and the next run notices, keeps your value, and adds the field to `sync.pinned` (listed in the PR as "Hand edits kept"). To hand a field back to the sync, remove it from `sync.pinned`. Order: hand edit > `rdwlabz.json` > detected.

Preview a repo branch before merging its `rdwlabz.json`: `npm run sync -- --dry-run --ref putt-drop=my-branch`.

**When it runs:** every 6 hours, from Actions → Sync projects → Run workflow, or instantly from another repo or a publishing pipeline:

```bash
gh api repos/RDW-Labz/rdwlabz-site/dispatches -f event_type=rdwlabz-sync
```

(The caller's token needs Contents write on rdwlabz-site; `RDWLABZ_PR_TOKEN` works.)

**What happens next:** the run opens or updates one PR from `bot/sync-projects`. If the build and e2e tests pass **and** the PR only touches `src/data/projects.json` and `public/projects/*`, it merges itself. Otherwise it stays open with a comment saying why. It never pushes to main directly and never deploys. Hand-written entries in `projects.json` are left alone.

**Reliability:** store lookups and repo scans are cached between runs (`.sync-cache/`, via the Actions cache). A repo or store that errors keeps its previous entry and is retried next run. Only "can't list the org" fails the run.

Local dry run (writes nothing): `RDWLABZ_SYNC_TOKEN=$(gh auth token) npm run sync -- --dry-run`. Code: `scripts/sync-projects.mjs` + `scripts/sync/`; tests with fixtures: `tests/sync-projects.spec.ts`.

The workflow needs two repository secrets (in rdwlabz-site → Settings → Secrets and variables → Actions). Both are fine-grained personal access tokens with resource owner **RDW-Labz**:

| Secret | Repository access | Permissions | Used for |
|---|---|---|---|
| `RDWLABZ_SYNC_TOKEN` | All repositories | Contents: **Read-only** (Metadata read is automatic) | Reading repo files, topics, `rdwlabz.json` and releases |
| `RDWLABZ_PR_TOKEN` | Only `rdwlabz-site` | Contents: **Read and write**, Pull requests: **Read and write** | Pushing the `bot/sync-projects` branch, opening the PR and auto-merging it |

The built-in `GITHUB_TOKEN` is read-only here, because the enterprise policy doesn't let it create PRs. PRs therefore appear as opened by the owner of `RDWLABZ_PR_TOKEN`. Set an expiry on both tokens and renew them before it hits; when one expires, the run fails with a clear error. Optional third secret: `CURSEFORGE_API_KEY` (CurseForge's API needs a key from a CurseForge account); without it, CurseForge ids are noted in the PR but not checked.

The `site` block holds the tagline, contact email, launch date and an optional "work with us" line. Any value starting with `TODO` is hidden or replaced with a "coming soon" state. Build-time validation fails on an unknown category or status, or a duplicate slug.

## Analytics

Cloudflare Web Analytics is included only when `PUBLIC_CF_BEACON_TOKEN` is set at build time (as a Cloudflare Pages environment variable). Without it, no analytics script ships.

## Go live (Braden only; the agent doesn't push, deploy or touch DNS)

1. Push this repo to your Git host.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect the repo. Build command `npm run build`, output directory `dist`, Node 22.12+.
3. Custom domains → add `rdwlabz.com` (and `www` if you want it), DNS is already on Cloudflare, so the record is created for you when you confirm.
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
