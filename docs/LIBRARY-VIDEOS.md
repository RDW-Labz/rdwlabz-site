# Clay Asset Library videos (Higgsfield brief)

Three decorative clips for the Clay Asset Library. Until the files exist, the site plays its
built-in CSS placeholders (`ClayBlobs.astro` and the vortex in `PortalOverlay.astro`), so nothing
is blocked on these.

| Clip | Where it plays | Shape | Length | Loops? |
| --- | --- | --- | --- | --- |
| (a) Teaser loop | Home, "Clay Asset Library" band, full width behind the panel | 16:9 and 9:16 | 8 s | yes, seamless |
| (b) Portal | Full screen after "Enter the Library" is clicked | 16:9 and 9:16 | 2.5 s (2–3 s) | no, plays once |
| (c) Hero loop | `/library` hero, in a rounded 4:3 box (5:2 on phones) | 16:9 only | 8 s | yes, seamless |

All three are muted, have no text, and are `aria-hidden` decoration. The site never plays them
under reduced motion, Data Saver, or "Pause animations". A failed or missing file falls back to
the CSS placeholder.

## Shared look (put this in every prompt)

> Claymation stop-motion, handmade plasticine with visible fingerprints and soft tool marks,
> slightly imperfect shapes, 12 frames per second stop-motion feel, warm soft studio lighting with
> gentle shadows, shallow depth of field, playful and cosy. Colour palette: deep ink purple
> #1e1433, warm paper cream #fff6ea, tomato red #ff4d2e, sunflower yellow #ffc23d, grape purple
> #b04cf0, mint green #16b67e, sky blue #3d7bff, bubblegum pink #ff5fa2. No text, no letters, no
> logos, no watermarks, no existing characters, no brands, no real people.

Negative prompt (where the model supports it): `text, letters, logo, watermark, signature,
photorealistic, CGI plastic sheen, glossy 3D render, human face close-up, famous character,
brand, UI, frame border, flicker`.

Workflow that tends to give clean loops:

1. Make one keyframe image first (same prompt, 16:9, and 9:16 where needed).
2. Animate it with image-to-video. If the model offers a start frame and an end frame, use the
   same image for both: that gives a seamless loop.
3. Generate a few takes and keep the calmest one; jitter reads as "broken" behind text.
4. Export the highest-quality MP4 Higgsfield offers, then encode with the commands below.

## (a) Home teaser loop

Prompt:

> [shared look] A cosy claymation workshop tabletop seen from a low three-quarter angle. Small
> clay figures (a knight, a dinosaur, a pirate, a cowboy) stand on round cream clay bases while
> soft plasticine blobs in the palette colours slowly squash, roll and morph around them. Gentle
> slow camera drift to the right, then back. Background softly out of focus, deep ink purple with
> warm pink and yellow glows. Calm, slow, looping motion.

Specs:

- 16:9 master at 1920×1080 or larger, and a separate 9:16 master at 1080×1920.
- 8 s, seamless: the last frame must match the first. Loop point at 0 s.
- **Safe zones (16:9):** a white panel covers the left ~45% of the frame, from 8% to 92% height;
  three pack cards sit over the right-centre. Keep the busiest motion in the top-right and
  bottom-right corners and along the bottom edge. Nothing important in the left half.
- **Safe zones (9:16):** the cards sit in the top 25% and the panel fills the middle to the
  bottom (about 30%–95% height). Put motion in the top 25% and the side margins.
- Overall darker values (ink purple base) so the white panel and cards pop.

## (b) Portal transition

Prompt:

> [shared look] Starting on a dark ink purple #1e1433 frame, a ring of colourful plasticine
> coils (tomato, sunflower, mint, sky, grape, pink) twists open in the centre like a clay portal.
> The camera pushes forward through the spinning clay rings into a bright warm cream and peach
> light. Fast but smooth, energetic, ends on an almost flat bright cream frame.

Specs:

- 16:9 at 1920×1080 and 9:16 at 1080×1920.
- 2.5 s (keep it between 2 and 3 s). Plays once and does not loop.
- **First frame:** solid ink purple #1e1433. It cuts in over the same colour, so there's no flash.
- **Last frame:** nearly flat cream/peach (#fff6ea → #ffe0bd). The library page fades in from
  it.
- **Safe zones:** a label pill sits just below centre (about 50–75% height, centre 60% width),
  and a "Skip" button sits in the bottom-right corner (bottom-right 25% × 15%). Keep the portal
  centre slightly above the middle of the frame.
- The site cuts the clip off after 3.5 s no matter what, and any click or Esc skips it.

## (c) Library hero loop

Prompt:

> [shared look] A slow claymation turntable shelf: a round cream clay display stand rotating
> gently, with a few small clay models (a knight, a dinosaur, a ship) on it, while plasticine
> blobs in the palette colours bob around in the background. Light, airy background in blush pink
> #ffd2e1 to peach #ffe0bd to cream #fff1dc. Calm, slow, looping motion.

Specs:

- 16:9 only, 1920×1080 or larger. The hero box is landscape on every screen, so a 9:16 file
  isn't used.
- 8 s, seamless loop (last frame = first frame).
- **Safe zones:** the box crops to 4:3 on desktop (keep subjects in the centre 75% of the width)
  and to 5:2 on phones (keep subjects in the middle 60% of the height). No text sits on this
  clip, so no other safe zone.
- Light values, so the clip reads as "the shop" next to the dark home teaser.

## Encoding and file names

Drop the files in `public/library/video/` with exactly these names, then run `npm run build`.
The pages pick them up automatically, and `node scripts/budgets.mjs` checks the sizes.

| File | Size limit |
| --- | --- |
| `teaser-loop.webm`, `teaser-loop.mp4` (16:9, 1280×720) | 2.5 MB each |
| `teaser-loop-portrait.webm`, `teaser-loop-portrait.mp4` (9:16, 720×1280) | 2.5 MB each |
| `teaser-loop-poster.webp` (first frame, 1280×720) | 120 KB |
| `portal.webm`, `portal.mp4` (16:9, 1280×720) | 1.5 MB each |
| `portal-portrait.webm`, `portal-portrait.mp4` (9:16, 720×1280) | 1.5 MB each |
| `hero-loop.webm`, `hero-loop.mp4` (16:9, 1280×720) | 2.5 MB each |
| `hero-loop-poster.webp` (first frame) | 120 KB |

If a loop isn't seamless, crossfade its last second into its first (here for an 8 s clip; the
offset is length − 2):

```sh
ffmpeg -i teaser-master.mp4 -filter_complex \
  "[0:v]trim=start=1,setpts=PTS-STARTPTS[body];[0:v]trim=end=1,setpts=PTS-STARTPTS[head];[body][head]xfade=transition=fade:duration=1:offset=6" \
  -an teaser-looped.mp4
```

Encode (swap names and `scale=720:-2` for portrait; raise `-crf` if a file is over its limit):

```sh
# WebM (VP9)
ffmpeg -i teaser-looped.mp4 -an -vf "scale=1280:-2,fps=24" -c:v libvpx-vp9 -b:v 0 -crf 40 \
  -row-mt 1 -deadline good teaser-loop.webm
# MP4 (H.264), Safari fallback
ffmpeg -i teaser-looped.mp4 -an -vf "scale=1280:-2,fps=24" -c:v libx264 -crf 28 -preset slow \
  -pix_fmt yuv420p -movflags +faststart teaser-loop.mp4
# Poster (first frame)
ffmpeg -i teaser-looped.mp4 -frames:v 1 -vf "scale=1280:-2" -c:v libwebp -quality 70 \
  teaser-loop-poster.webp
```

The portal clip has no poster: the overlay's ink background is its first frame.

## Rights

These clips are AI-generated decoration. Check that Higgsfield's terms for your plan allow
commercial use of the output before shipping. Don't prompt for existing characters, brands or
art styles of specific studios.
