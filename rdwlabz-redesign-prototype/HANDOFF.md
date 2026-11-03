# RDW Labz redesign — handoff

This folder is the approved working prototype of the new rdwlabz.com. Your job is to port it into this Astro repo, not redesign it. Match it 1:1.

## Run the prototype
    cd rdwlabz-redesign-prototype && python3 -m http.server 8080
    open http://localhost:8080/            (home)    http://localhost:8080/#about   (about)
Test hooks: `?quality=high` locks top quality. `window.__world`, `window.__about` exist for scripted screenshots (see tools/shoot_test.py, Playwright).

## What it is
- **Home (`/`)** — styled after shader.se: 3D retro computer on a desk in a lavender-fog room (three.js 0.169 + EffectComposer: GTAO, DOF, SMAA, selective bloom, custom final grade). Scroll dives the camera into the monitor; inside is a "screen world" of 11 beats (js/world/*.js): ring (work turntable, 15 projects), build, studio, arcade, putt, library, numbers, process, friends (Verrow AI), touch (contact), harrison. Each project opens a gallery page (js/world/project.js) with distinct real screenshots per frame; PS5 farm has a full video player.
- **About (`/about`)** — styled after Mr. Panda: paper-diorama sideways walk with mascot Lumpy (js/about.js), ends at a mailbox with the email button.
- Typed terminal on the hero monitor (`help`, `work`, `about`, `contact`, `ls`…) in js/computer.js.
- Sound is off by default (js/sound.js, sfx/*.ogg|mp3).
- Fallbacks: no-WebGL static page, reduced motion, phone layout (≤820px), auto quality scaler.

## File map
- `index.html` — full standalone page (CSS + markup + importmap). Fonts from Google Fonts; three/lenis from jsDelivr importmap.
- `js/main.js` boot + hash routing (`#about`), `js/home.js` room/dive/post, `js/computer.js` CRT/ScreenOS, `js/fx.js` props/fog, `js/tex.js` textures, `js/jump.js` nav fades, `js/data.js` ALL project content + shots, `js/world/*` screen-world beats.
- `img/` screenshots (img/g/ = gallery), `tex/` pre-baked textures, `sfx/` sounds, `tools/` bake scripts (textures, sounds) + Playwright shooter.

## Content rules (do not break)
- Only true facts. No invented clients, years, metrics or quotes.
- Verrow AI (https://verrow.ai/) is the partner: offer the link, never push people there.
- Contact: devops@therdw.com. Putt Drop is live on Google Play (com.rdwlabz.puttdrop). Dormant Red is free on itch.io.
- Private builds (Cluer Pipeline, Forge Recipe Catalog) have NO public links.
- Art stays original. No grain/scanline/CRT-curvature on the monitor screen (owner rejected it).
