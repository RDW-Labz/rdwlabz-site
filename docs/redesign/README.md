# Redesign port: before / after

Baseline is the approved prototype served with `python3 -m http.server`; the "after" set is the
Astro production build. Both were captured with `tools/shoot_test.py` (Playwright, 1440×900 desktop
and 390×844 phone) at `?quality=high`, so the screen-world renders at the top preset.

| Screen | Before (prototype) | After (Astro) | Notes |
| --- | --- | --- | --- |
| Home hero | [before](before/desktop-home-hero.png) | [after](after/desktop-home-hero.png) | Same layout/copy/props; only the monitor slideshow frame and idle motion differ. |
| The dive | [before](before/desktop-home-dive.png) | [after](after/desktop-home-dive.png) | Same camera path; turntable angle is time-based. |
| 01 ring | [before](before/desktop-beat-01-ring.png) | [after](after/desktop-beat-01-ring.png) | Same ring and cards; turntable rotation differs. |
| 02 build | [before](before/desktop-beat-02-build.png) | [after](after/desktop-beat-02-build.png) | Same copy and props; cursor/animations differ. |
| 03 studio | [before](before/desktop-beat-03-studio.png) | [after](after/desktop-beat-03-studio.png) | Same layout. |
| 04 arcade | [before](before/desktop-beat-04-arcade.png) | [after](after/desktop-beat-04-arcade.png) | Same layout. |
| 05 putt | [before](before/desktop-beat-05-putt.png) | [after](after/desktop-beat-05-putt.png) | Pixel-identical. |
| 06 library | [before](before/desktop-beat-06-library.png) | [after](after/desktop-beat-06-library.png) | Pixel-identical. |
| 07 numbers | [before](before/desktop-beat-07-numbers.png) | [after](after/desktop-beat-07-numbers.png) | Pixel-identical. |
| 08 process | [before](before/desktop-beat-08-process.png) | [after](after/desktop-beat-08-process.png) | Same layout; looping props differ. |
| 09 friends | [before](before/desktop-beat-09-friends.png) | [after](after/desktop-beat-09-friends.png) | Same layout. |
| 10 touch | [before](before/desktop-beat-10-touch.png) | [after](after/desktop-beat-10-touch.png) | Same layout. |
| 11 harrison | [before](before/desktop-beat-11-harrison.png) | [after](after/desktop-beat-11-harrison.png) | Same layout. |
| Project page | [before](before/desktop-project-dormant-red.png) | [after](after/desktop-project-dormant-red.png) | Same facts and gallery. |
| PS5 video player | [before](before/desktop-ps5-video-player.png) | [after](after/desktop-ps5-video-player.png) | Same player; the video frame/poster differs. |
| About walk | [before](before/desktop-about-walk.png) | [after](after/desktop-about-walk.png) | Same diorama; puppet/camera idle differs. |
| About end | [before](before/desktop-about-end.png) | [after](after/desktop-about-end.png) | Same plain paper version. |
| Phone hero | [before](before/phone-home-hero.png) | [after](after/phone-home-hero.png) | Forced `?quality=high` 3D phone layout. |
| Phone ring | [before](before/phone-beat-01-ring.png) | [after](after/phone-beat-01-ring.png) | Same phone ring. |
| Phone putt | [before](before/phone-beat-05-putt.png) | [after](after/phone-beat-05-putt.png) | Pixel-identical. |
| Phone harrison | [before](before/phone-beat-11-harrison.png) | [after](after/phone-beat-11-harrison.png) | Same layout. |

Measured mean absolute error (RGB, 0–255) is 0.0–2.4 for the static beats and pages. The larger
deltas (home dive, PS5 player, phone hero) are animation/video frames: the screen-world turntable,
the hero monitor slideshow and the film playback all advance with wall-clock time.

## Differences from the prototype

- **Phone default:** phones get the approved static workbench (the prototype's own no-WebGL
  fallback) with an "Open the 3D workbench" button; the 3D phone layout is still one tap away and
  `?quality=high` forces it. This is the only way the mobile Lighthouse budget stayed above 70 on
  the throttled profile.
- **Legacy hash links:** `/#about` and `/#about-rest` redirect to `/about` and `/about#about-rest`.
- **Deep link:** `/about#about-rest` renders the plain paper version immediately, without waiting for
  the diorama to build.
- **Small performance adaptations on low-power phones:** 512/256 px pre-baked maps, no shadow pass,
  no post chain at the lowest preset, and the screen world builds on the dive rather than at load.
  These do not affect the forced `?quality=high` screenshots.
- **Fonts** are self-hosted Latin subsets of the same families (Caveat, Instrument Sans, Instrument
  Serif, JetBrains Mono, Patrick Hand, VT323) instead of the prototype's Google Fonts request.

## Verification

- `npm run build`: pass (`astro check` + build + Cloudflare Pages limits).
- `npm run lint`: pass.
- `npm test`: 183 passed, 9 skipped (the old library-portal entry point and the desktop 3D home
  review shot; the latter is covered by this screenshot set).
- Lighthouse CI mobile (3 runs, median): `/` 99 performance / 100 accessibility / 100 best
  practices / 100 SEO; `/projects` 100 / 100 / 100 / 100; `/library` 99 / 100 / 100 / 100; a pack
  page 100 / 100 / 100 / 100. `/` uses the phone static fallback in that profile.
