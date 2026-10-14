# Clay Asset Library

`/library` and `/library/<slug>` show every claymation pack in
[RDW-Labz/clay-asset-packs](https://github.com/RDW-Labz/clay-asset-packs). The Home page gets a
"Clay Asset Library" band with an "Enter the Library" portal, and the Projects shelf gets a
"Clay Asset Library" card (so the Asset packs category comes back on its own).

With 0 packs, the teaser, the nav link and the card disappear, and `/library` says "Coming soon".

**Every pack is preview only.** There are no download, buy or price fields in the data at all
(the build fails if one shows up), and every pack says "Downloads coming soon".

## Data flow

```
clay-asset-packs (main)                        rdwlabz-site
models/<batch>/*.glb        ──push to main──►  repository_dispatch "rdwlabz-library-sync"
manifests/<batch>.json (optional)              (+ every 6 hours, + on demand)
previews/<batch>/*.jpg, *.gif                    │
textures/<batch>/<set>/*.png                     ▼
viewers/<batch>.html (only checked for presence) .github/workflows/sync-library.yml
                                       scripts/build-library.mjs
                                         ├─ one pack per models/<batch>/ folder that has GLBs
                                         ├─ hero models → web GLB (meshopt + 512 px WebP textures)
                                         ├─ card image, turntable (WebM + MP4 ≤ 1.5 MB),
                                         │  256 px image per model
                                         └─ src/data/library.json + public/library/packs/<slug>/
                                       PR "bot/sync-library" → build + e2e → auto-merge if data-only
```

- **Automatic:** a new `models/batchNNN/` folder on main becomes a pack on the next sync. No
  manifest or pack.json is needed. A folder removed upstream disappears with its previews.
- **Names and counts:** from `manifests/<batch>.json` (`title`, per-model `category`) when it
  exists; otherwise from the latest commit that touched the folder, in the form
  `batchNNN: Name (N models, N textures)`; otherwise from the folder name ("Batch 060"). Model
  counts are the GLBs actually in the folder.
- **Pack copy (optional):** see [Manifest copy fields](#manifest-copy-fields). Without it, the
  description is built from the counts, as before.
- **Themes (filter chips):** era themes from the title (Prehistoric, Ancient world, Medieval,
  Feudal Asia, Age of Sail, Wild West, Modern day, Arctic), and for the crew packs: **Heroes &
  Gods** (gods, heroes, idols), **Trend Toys** (trend, toys, gaming, YouTuber, dance,
  block-build) and **Clay Crews** (every other crew). See `themeOf()` in the script.
- **Two kinds of card image:**
  - `render`: packs with textures or an offline viewer (batch001–014, 040–047) get a real
    three.js render of the models on a clay stand, a 3 s turntable and a render per model.
  - `concept`: packs without (the crew packs, batch015–039 and 048) use their
    `previews/<batch>/*.jpg` concept images; the card turns on hover only if the pack has a real
    animated `.gif` (8+ frames). The pack page labels these "concept image" and its 3D preview
    still loads the real GLBs.
- **Broken models:** a GLB whose vertex data can't be read (for example batch048, whose binary
  chunk is misaligned) stays listed with its concept image, gets no triangle count and isn't
  offered in 3D. The sync summary lists it under Warnings. If no model in a pack is usable, the
  pack page says the 3D preview isn't ready yet.
- **Cloudflare Pages limits** (25 MiB per file, 20,000 files): each 3D-preview GLB must fit in
  20 MiB. If one doesn't, the sync decimates it in steps (20k, 8k, then 2k triangles, smaller
  textures) and lists it under "Decimated for the web" in the PR; if it still doesn't fit, the
  model stays listed but isn't offered in 3D, under "Skipped or broken files". `npm run build`
  then checks the whole `dist/` with `scripts/pages-limits.mjs` and fails over either limit
  (today: about 1,050 files, largest under 1 MiB).
- **Skipped files are listed in the PR:** corrupt or unreadable GLBs, non-snake_case file names
  and empty folders go under "Skipped or broken files" in the sync PR body.
- **Re-render only what changed:** each pack has a `sourceHash` of its GLBs, previews and the
  render settings. `--force` re-renders everything (workflow_dispatch has a checkbox).
- Locally: `node scripts/build-library.mjs --src ../clay-asset-packs` (needs ffmpeg on PATH or
  `FFMPEG=…`, and Playwright Chromium). The checkout needs `models`, `manifests`, `previews` and
  `textures`, plus history for the commit-message fallback. A full re-render of the 22 render
  packs takes about 8 minutes; the concept packs take seconds.

## Manifest copy fields

Use these to show a quality upgrade on the site. Add any of them to
`clay-asset-packs/manifests/batchNNN.json` next to `title` and `models`, and push to main. The
next sync copies them into `src/data/library.json`.

```json
{
  "title": "Prehistoric",
  "tagline": "Re-sculpted cave crew with real fur and stone detail",
  "description": "Every model was re-sculpted at a higher resolution and re-textured, and the turntables are now rendered in HD.",
  "highlights": ["Higher-res turntables", "Sharper textures"],
  "updated": "2026-10-14",
  "models": []
}
```

| Field         | Type                         | Limit                       | Where it shows                                                                     | When missing                    |
| ------------- | ---------------------------- | --------------------------- | ---------------------------------------------------------------------------------- | ------------------------------- |
| `tagline`     | string, one line             | 120 characters              | Pack page under the title; pack card under the title                               | Nothing shown                   |
| `description` | string, short paragraph      | 400 characters              | Pack page above the stats (replaces the generated text); page meta description     | Generated from the counts       |
| `highlights`  | array of short strings       | 6 items, 40 characters each | Pack page, chips between the description and the stats                             | Nothing shown                   |
| `updated`     | `YYYY-MM-DD` (calendar date) | a real date                 | "Updated Oct 14, 2026" badge on the pack page and card for 30 days after that date | No badge                        |

- **Plain text only.** HTML tags, comments, `<script>`/`<style>` blocks and control characters
  are removed, entities are decoded (`&amp;` → `&`), and whitespace is collapsed. Longer text is
  cut at a word with "…". Duplicate or empty highlights are dropped. The site checks the same
  rules again at build time.
- **Bad values never break the sync.** A wrong type, an empty string or a date that isn't
  `YYYY-MM-DD` is skipped (that field falls back), and the PR body lists it under Warnings
  (`manifests/batchNNN.json: "updated" is not a YYYY-MM-DD date; ignored`).
- **The 30 days count from the site build**, not from the visitor's clock. The site is static, so
  the badge stays up until the next deploy after day 30; any sync or push to main rebuilds it.
- These fields don't change the previews, so editing them doesn't re-render anything. The sync
  lists the pack under "Updated" in the PR.

## Safety model (same as the project sync)

- The bot never pushes to main. It opens `bot/sync-library`, runs `npm run build` and the e2e
  suite, waits for PR checks, and squash-merges only if all are green **and** the diff touches
  nothing but `src/data/library.json` and `public/library/packs/*`. Otherwise it leaves the PR open
  with a comment.
- The site rejects bad data at build time (`validateLibrary` in `src/lib/library.ts`): odd slugs,
  media outside `/library/packs/<slug>/`, turntables over 1.5 MB, an unknown media kind, or any
  `download`, `price` or `free` field.

## Secrets

| Repo | Secret | Access |
| --- | --- | --- |
| clay-asset-packs | `LIBRARY_DISPATCH_TOKEN` | Fine-grained PAT, resource owner RDW-Labz, **only** rdwlabz-site, Contents: Read and write (needed for `repository_dispatch`). Without it, the push still shows up within 6 hours through the scheduled sync. |
| rdwlabz-site | `RDWLABZ_SYNC_TOKEN` (existing) | Must include clay-asset-packs with Contents: Read. |
| rdwlabz-site | `RDWLABZ_PR_TOKEN` (existing) | Unchanged: rdwlabz-site Contents + Pull requests write. Creates and merges the PR only. |
| rdwlabz-site | `GITHUB_TOKEN` (built in) | Nothing to set up. Job permissions `contents`, `pull-requests`, `checks`, `statuses`: read. Reads the PR's checks before auto-merge, since fine-grained PATs can't read check runs. |

## License and IP notes (decide before selling or giving packs away)

- **Downloads are off.** Turning them on later needs a license per pack, hosting (for example
  Cloudflare R2, which needs a payment method) and a code change here; nothing is set up.
- **Hunyuan3D 2.1 Community License** (fetched from Tencent's repo):
  - The license territory excludes the EU, the UK and South Korea. Outputs may not be used or
    distributed there.
  - Distributions must include a copy of the license and the NOTICE text.
  - Section 3(e): when offering outputs to third parties, name the provider (RDW, LLC) and say
    Tencent isn't affiliated.
  - Acceptable Use Policy: AI-generated content placed in public must be labelled as
    machine-generated. The site labels every pack "AI-generated" and explains how the models are
    made.
- **clay-asset-packs README conflict:** the README says the Hunyuan3D weights carry a
  "non-commercial licence" and the repo is "for internal prototyping". That doesn't match the 2.1
  Community License text. Check which version and weights were actually used before charging
  money.
- **Clay LoRA (Qwen-Image):** its license is unknown. Find it before any commercial use.
- **Crew packs (015–039, 048) are public now, by Braden's call.** Some names and designs riff on
  other people's characters or memes, for example "Cappuccina ballerina" and other
  "brainrot" characters, "Red crewmate", "Green boom creature", the toilet-camera/speaker crew,
  the "noob", "obby" and blocky crews, and "Plumber and crew". Review those before selling them;
  renaming in clay-asset-packs flows through on the next sync.
