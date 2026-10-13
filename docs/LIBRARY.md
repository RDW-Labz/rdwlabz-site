# Clay Asset Library

`/library` and `/library/<slug>` show the claymation packs from
[RDW-Labz/clay-asset-packs](https://github.com/RDW-Labz/clay-asset-packs). The Home page gets a
"Clay Asset Library" band with an "Enter the Library" portal, and the Projects shelf gets a
"Clay Asset Library" card (so the Asset packs category comes back on its own).

With 0 packs, the teaser, the nav link and the card disappear, and `/library` says "Coming soon".

## Data flow

```
clay-asset-packs                               rdwlabz-site
packs/<batch>/pack.json  ──push to main──►  repository_dispatch "rdwlabz-library-sync"
models/<batch>/*.glb                          │
textures/<batch>/*.png                        ▼
                                     .github/workflows/sync-library.yml
                                     scripts/build-library.mjs
                                       ├─ validate every pack.json (scripts/library/validate.mjs)
                                       ├─ hero models → web GLB (meshopt + 512 px WebP textures)
                                       ├─ thumbnail (WebP), 3 s turntable (WebM + MP4 ≤ 1.5 MB),
                                       │  256 px thumbnail per model (three.js in headless Chromium)
                                       └─ src/data/library.json + public/library/packs/<slug>/
                                     PR "bot/sync-library" → build + e2e → auto-merge if data-only
```

- **Source of truth:** `packs/<batch>/pack.json` in clay-asset-packs, made by
  `scripts/pack-manifests.mjs` there (it auto-fills names, triangles, files and sizes, and keeps
  hand-edited fields). Schema: `pack.schema.json` in that repo.
- **Only `listed: true` packs** appear. All 25 "Crew" packs (batch015–039) start unlisted with a
  review TODO, because their names riff on internet memes and existing characters.
- **Re-render only what changed:** each pack has a `sourceHash` of its source GLBs plus the
  render settings. `--force` re-renders everything (workflow_dispatch has a checkbox).
- **Previews are real renders** of the model files on a plain clay stand. Nothing is mocked.
- Locally: `node scripts/build-library.mjs --src ../clay-asset-packs` (needs ffmpeg on PATH or
  `FFMPEG=…`, and Playwright Chromium). A full run of 22 packs takes about 8 minutes on a laptop.

## Safety model (same as the project sync)

- The bot never pushes to main. It opens `bot/sync-library`, runs `npm run build` and the e2e
  suite, waits for PR checks, and squash-merges only if all are green **and** the diff touches
  nothing but `src/data/library.json` and `public/library/packs/*`. Otherwise it leaves the PR open
  with a comment.
- The site rejects bad data at build time (`validateLibrary` in `src/lib/library.ts`): odd slugs,
  media outside `/library/packs/<slug>/`, turntables over 1.5 MB, a free pack with a price, or a
  download that isn't free, licensed and on `assets.rdwlabz.com` / `pub-….r2.dev`.
- **Downloads only for packs with `free: true`, a real license, and an uploaded zip.** Everything
  else shows "Buy — coming soon" (or "Free download coming soon"), never a dead link.

## Secrets

| Repo | Secret | Access |
| --- | --- | --- |
| clay-asset-packs | `RDWLABZ_DISPATCH_TOKEN` | Fine-grained PAT, resource owner RDW-Labz, **only** rdwlabz-site, Contents: Read and write (needed for `repository_dispatch`). Without it, the workflow validates and skips the dispatch with a warning. |
| rdwlabz-site | `RDWLABZ_SYNC_TOKEN` (existing) | Must include clay-asset-packs with Contents: Read. |
| rdwlabz-site | `RDWLABZ_PR_TOKEN` (existing) | Unchanged: rdwlabz-site Contents + Pull requests write. |

## Downloads on Cloudflare R2 (Braden's steps)

Nothing below has been done. It needs a Cloudflare login, a payment method and a DNS change.

1. **Enable R2.** Cloudflare dashboard → R2 Object Storage. Cloudflare normally asks for a
   payment method before it turns R2 on, even if usage stays in the free tier. The free tier
   ([pricing page](https://developers.cloudflare.com/r2/pricing/), last updated Oct 1, 2026) is
   10 GB-month of **Standard** storage, 1M Class A (writes) and 10M Class B (reads) a month, and
   egress is free. That covers this: all 22 listed packs together are about 1.1 GB of source
   files. Keep the bucket on Standard; Infrequent Access has no free tier.
2. **Create the bucket** `rdwlabz-assets` (dashboard → Create bucket, location Automatic, or
   `npx wrangler r2 bucket create rdwlabz-assets`).
3. **Public access via a custom domain:** bucket → Settings → Custom Domains → Connect Domain →
   `assets.rdwlabz.com`. rdwlabz.com must be a zone in the same Cloudflare account; this adds the
   DNS record. Leave the r2.dev URL off for production (it's rate-limited).
4. **Decide license + price per pack** in clay-asset-packs `packs/<batch>/pack.json`: set
   `license` to the real text/name, and `free: true` for free packs (keep `price: null`). Read
   the license notes below first.
5. **Package and upload** (from rdwlabz-site, with a full clay-asset-packs checkout including
   textures):

   ```sh
   npx wrangler login
   curl -o ../Hunyuan3D-2.1-LICENSE.txt \
     https://raw.githubusercontent.com/Tencent-Hunyuan/Hunyuan3D-2.1/main/LICENSE
   node scripts/library/upload-r2.mjs --src ../clay-asset-packs \
     --third-party-license ../Hunyuan3D-2.1-LICENSE.txt           # dry run: builds zips, prints commands
   node scripts/library/upload-r2.mjs --src ../clay-asset-packs \
     --third-party-license ../Hunyuan3D-2.1-LICENSE.txt --upload --write
   ```

   Zips land in `rdwlabz-assets/packs/<slug>/<slug>-<sha>.zip`, with LICENSE.txt, NOTICE.txt and
   the Hunyuan license copy inside, and are served with `Content-Disposition: attachment` and
   immutable caching. `--write` adds `download: { key, bytes, sha256 }` to each pack.json.
6. **Open a PR in clay-asset-packs** with the updated pack.json files. Merging it fires the
   dispatch, and the site's sync PR shows the "Download free" button on those packs.

## License and IP notes (decide before selling or giving packs away)

- **Hunyuan3D 2.1 Community License** (fetched from Tencent's repo):
  - The license territory excludes the EU, the UK and South Korea. Outputs may not be used or
    distributed there.
  - Distributions must include a copy of the license and the NOTICE text. `upload-r2.mjs` does
    this and refuses to package a Hunyuan-made pack without the license file.
  - Section 3(e): when offering outputs to third parties, name the provider (RDW, LLC) and say
    Tencent isn't affiliated. That's in LICENSE.txt. The site itself only says "AI-generated",
    to keep the brand separate. Decide whether a pack page needs that line too.
  - Acceptable Use Policy: AI-generated content placed in public must be labelled as
    machine-generated. The site labels every pack "AI-generated" and explains how the models are
    made.
- **clay-asset-packs README conflict:** the README says the Hunyuan3D weights carry a
  "non-commercial licence" and the repo is "for internal prototyping". That doesn't match the 2.1
  Community License text. Check which version and weights were actually used before charging
  money.
- **Clay LoRA (Qwen-Image):** its license is unknown. Find it before any commercial use.
- **Crew packs (015–039):** they're unlisted until someone reviews their names and looks for
  third-party IP. To list one, set `listed: true` and clear `review` in its pack.json.
