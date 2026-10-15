# Web projects showcase

The "Web projects" section on `/` and `/projects` shows sites we built, with real screenshots
that refresh automatically.

## Data: `src/data/showcase.json`

```json
{
  "slug": "forge-pizza-co",
  "name": "Forge Pizza Co",
  "url": "https://forgepizzaco.com/",
  "kind": "web",
  "blurb": "Written only from the site's own title, meta description and hero text.",
  "tags": ["Restaurant", "Menu"],
  "private": false,
  "publicContact": ["(870) 517-5028"]
}
```

- `slug`: lowercase-dashed, unique; names the image folder `public/showcase/<slug>/`.
- `url`: public `https://` only. Private entries must **not** have one (it would only reveal where
  the build lives).
- `blurb`: ≤ 280 chars, plain text, no contact details. No invented claims: no clients, numbers or
  results the site itself doesn't state.
- `tags`: up to 4 short strings.
- `publicContact` (optional, public entries only): exact contact strings the site itself
  publishes as its **business** contact (a restaurant's phone number). They're exempt from the
  personal-data check; anything else still fails. Never list a person's own number or email.

The build validates the file (`scripts/showcase/checks.mjs`) and fails on any problem.

## Screenshots: `scripts/capture-showcase.mjs`

```sh
node scripts/capture-showcase.mjs             # every public entry
node scripts/capture-showcase.mjs --only yottaify --force
```

Per site: desktop 1440×900 @2x and mobile 390×844 @3x, each above the fold and full page (full
page stops at 9,000 CSS px). It waits for network idle and fonts, clicks a cookie banner's
"decline/reject/close", hides known chat widgets, uses reduced motion so reveal animations are
finished, then saves WebP (≤ 400 KB each; quality drops first, then size) to
`public/showcase/<slug>/`:

| File                         | What                                                 |
| ---------------------------- | ---------------------------------------------------- |
| `desktop.webp`, `mobile.webp` | above the fold                                      |
| `desktop-full.webp`, `mobile-full.webp` | full page                                 |
| `card-640.webp`, `card-1280.webp` | card images (from `desktop`)                    |
| `og.webp`                    | 1200×630 card: desktop shot in a browser frame, brand colors |

Sizes and the capture date go to `src/data/showcase-shots.json`.

**It fails loudly** (exit 1, site keeps its old images) when a page:

- returns HTTP ≥ 400, or its title/h1 reads like an error or a bot challenge;
- shows a password field, redirects to a login path, or asks to sign in;
- shows an email, phone number or street address anywhere in the captured area (visible text and
  form values), other than its `publicContact`.

**Only visible changes are committed.** Each new shot is compared with the old one (scaled to
320 px, greyscale, blurred; a pixel counts when it moves > 32/255). A site's files are rewritten
only when one shot differs by more than 2%, or the page height changed by more than 2%.

## Automation: `.github/workflows/refresh-showcase.yml`

Weekly (Mondays 09:17 UTC) and on manual run ("force" replaces every shot). Captures, then, if
anything changed, builds, runs e2e, and opens `bot/refresh-showcase` with `RDWLABZ_PR_TOKEN`. It
auto-merges through the same check-wait flow as the library sync: build and e2e green, the diff
touches only `src/data/showcase-shots.json` and `public/showcase/*`, and `wait-pr-checks.mjs`
(reading checks with `GITHUB_TOKEN`) sees no failed check. Otherwise it comments and leaves the PR
open. A failed capture turns the run red and opens no PR.

## Private projects

**Never make a private repo public, and never copy its code, data or URLs into this repo.**

1. Add an entry with `"private": true` and no `url`. The card says "Private build: demo on
   request" and has no link. Without screenshots it shows a placeholder.
2. Run the app **on your machine** with **fake seed data only**: made-up names (Jane Example), no
   real customers, no production database or API keys. Keep emails, phone numbers and street
   addresses off the captured screens entirely: the check rejects them even when they're fake.
3. Capture:

   ```sh
   node scripts/capture-private.mjs --slug secret-app --url http://localhost:3000/ --seed-data-only
   ```

   It only accepts localhost/LAN URLs, requires `--seed-data-only` as a confirmation, and runs the
   same error/login/personal-data checks with **no** exemptions. The OG card's address bar says
   "Private build", never the local URL.

4. Look at every image in `public/showcase/<slug>/` yourself (the check catches contact details,
   not names or other personal info), then commit them by hand.

The weekly refresh never touches private entries' images; removing the entry from
`showcase.json` deletes them on the next refresh.
