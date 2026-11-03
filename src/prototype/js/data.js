// Project list, in ring order (matches the Home-Carousel board).
// tag/desc/url/shots feed the screen-world project pages (js/world). url is only ever a real, live address.
// shots: the gallery, one real image per frame and never the same image twice (img is the hero/ring card, so it is never in shots).
//   { src, cap, a: width/height, f: 'browser' | 'phone' | 'box' | 'hang' (small hung frame) | undefined (plain frame), h: frame height }
//   Drop more inside-app screenshots into a project's shots array and they get their own frames; nothing else to change.
// caps: lines for the vignettes we draw ourselves (title card, clay box). film: a full video with a watchable player.
export const PROJECTS = [
  { cat: 'clay', kind: 'CLAY 3D', file: 'VIKINGS.GLB', name: 'Vikings and Dark Ages', note: 'Monks, bears, shields and longships.', img: 'img/library_packs_vikings-and-dark-ages_thumb.webp', href: '#bench', cta: 'See the packs',
    tag: 'Clay 3D · 24 models', desc: 'A clay-style 3D asset pack: monks, bears, shields and longships. One of 48 packs in our clay library.', url: '', art: { bright: 1.0 }, facts: [['Kind', 'Clay 3D asset pack'], ['Models', '24'], ['Status', 'In the library, downloads coming soon']] },
  { cat: 'games', kind: 'GAME', file: 'DORMANT_RED.EXE', name: 'Dormant Red', note: 'Restore a dead space station before your oxygen runs out. Free on itch.io.', img: 'img/projects_dormant-red-shot-1.webp', href: 'https://rdwlabz.itch.io/dormant-red', cta: 'Play on itch.io', bright: 1.55,
    tag: 'Game · Browser', desc: 'Restore a dead space station before your oxygen runs out. Move with WASD, interact with E or Space, bring three systems back online and reach the exit. Free to play on itch.io.', url: 'https://rdwlabz.itch.io/dormant-red', visit: 'Play on itch.io', poster: true, art: { fx: 0.46, fy: 0.42, zoom: 1.18, bright: 2.4, contrast: 1.12, sat: 1.3, lift: 0.85, liftCol: [96, 58, 118], glow: [['rgba(255,80,60,.55)', 0.05, 0.1, 0.55], ['rgba(80,220,200,.35)', 0.95, 0.95, 0.5]] }, dark: true, facts: [['Kind', 'Game'], ['Platform', 'Browser, on itch.io'], ['Status', 'Free on itch.io']] },
  { cat: 'web', kind: 'WEB', file: 'YOTTAIFY.COM', name: 'Yottaify', note: 'GPU cloud landing page.', img: 'img/showcase_yottaify_card-1280.webp', href: 'https://yottaify.com/', cta: 'Open project',
    tag: 'Website', desc: 'A landing page for a GPU cloud: dark, technical and built around a big exploded-view hero.', url: 'https://yottaify.com/', visit: 'Visit yottaify.com', art: { fx: 0.76, fy: 0.42, zoom: 1.2, bright: 1.85, contrast: 1.1, sat: 1.2, lift: 0.7, glow: [['rgba(255,150,70,.5)', 0.9, 0.2, 0.6], ['rgba(120,140,255,.3)', 0.1, 0.9, 0.5]] }, dark: true, facts: [['Kind', 'Website'], ['URL', 'yottaify.com'], ['Status', 'Live site']] },
  { cat: 'clay', kind: 'CLAY 3D', file: 'PREHISTORIC.GLB', name: 'Prehistoric', note: 'Cave dwellers, tortoises and stone tools.', img: 'img/library_packs_prehistoric_thumb.webp', href: '#bench', cta: 'See the packs',
    tag: 'Clay 3D · 24 models', desc: 'A clay-style 3D asset pack: cave dwellers, tortoises and stone tools. One of 48 packs in our clay library.', url: '', art: { bright: 1.0 }, facts: [['Kind', 'Clay 3D asset pack'], ['Models', '24'], ['Status', 'In the library, downloads coming soon']] },
  { cat: 'games', kind: 'GAME', file: 'PUTT_DROP.APK', name: 'Putt Drop', note: 'One-thumb mini golf for phones. Now on Google Play.', img: 'img/g/putt-card.webp', href: 'https://play.google.com/store/apps/details?id=com.rdwlabz.puttdrop', cta: 'Get it on Google Play', focusY: 0.25,
    tag: 'Game · Android', desc: 'One-thumb mini golf for phones: drag, aim and release to putt. Out now on Google Play.', url: 'https://play.google.com/store/apps/details?id=com.rdwlabz.puttdrop', visit: 'Get it on Google Play', art: { fy: 0.25, zoom: 1.0, bright: 1.03 }, facts: [['Kind', 'Game'], ['Platform', 'Android, on Google Play'], ['Status', 'On Google Play']] },
  { cat: 'web', kind: 'WEB', file: 'FORGEPIZZACO.COM', name: 'Forge Pizza Co', note: 'Menu-first site for a Harrison pizza restaurant.', img: 'img/showcase_forge-pizza-co_card-1280.webp', href: 'https://forgepizzaco.com/', cta: 'Open project',
    tag: 'Website', desc: 'A menu-first site for a wood-fired pizza restaurant in Harrison, Arkansas.', url: 'https://forgepizzaco.com/', visit: 'Visit forgepizzaco.com', art: { fx: 0.78, fy: 0.55, zoom: 1.15, bright: 1.35, sat: 1.15, lift: 0.4, glow: [['rgba(255,170,90,.35)', 0.8, 0.5, 0.5]] }, facts: [['Kind', 'Website'], ['URL', 'forgepizzaco.com'], ['Status', 'Live site']] },
  { cat: 'clay', kind: 'CLAY 3D', file: 'EGYPT.GLB', name: 'Egypt and Bronze Age', note: 'Pharaohs, jackals and bronze blades.', img: 'img/library_packs_egypt-and-bronze-age_thumb.webp', href: '#bench', cta: 'See the packs',
    tag: 'Clay 3D · 24 models', desc: 'A clay-style 3D asset pack: pharaohs, jackals and bronze blades. One of 48 packs in our clay library.', url: '', art: { bright: 1.0 }, facts: [['Kind', 'Clay 3D asset pack'], ['Models', '24'], ['Status', 'In the library, downloads coming soon']] },
  { cat: 'clay', kind: 'CLAY 3D', file: 'MODERN_II.GLB', name: 'Modern II', note: 'City life, sports and school.', img: 'img/library_packs_modern-ii_thumb.webp', href: '#bench', cta: 'See the packs',
    tag: 'Clay 3D · 24 models', desc: 'A clay-style 3D asset pack: city life, sports and school. One of 48 packs in our clay library.', url: '', art: { bright: 1.0 }, facts: [['Kind', 'Clay 3D asset pack'], ['Models', '24'], ['Status', 'In the library, downloads coming soon']] },
  { cat: 'web', kind: 'WEB', file: 'BINGOAUCTIONS.COM', name: 'BinGo Auctions', note: 'Live online auctions for a liquidation warehouse in Harrison. Bid from your phone.', img: 'img/showcase_bingo_card-1280.webp', href: 'https://bingoauctions.com/', cta: 'Open project',
    tag: 'Website · Auctions', desc: 'A live online auction platform for a liquidation warehouse in Harrison, Arkansas. Local-pickup auctions you can bid on from your phone.', url: 'https://bingoauctions.com/', visit: 'Visit bingoauctions.com', art: { fx: 0.35, fy: 0.45, zoom: 1.1, bright: 1.25, contrast: 1.06, sat: 1.12, lift: 0.35, glow: [['rgba(255,160,60,.35)', 0.15, 0.6, 0.5]] }, facts: [['Kind', 'Auction platform'], ['For', 'A liquidation warehouse in Harrison, AR'], ['URL', 'bingoauctions.com'], ['Status', 'Live site']] },
  { cat: 'web', kind: 'WEB APP', file: 'BOOKBAYTIME.COM', name: 'BookBayTime', note: 'A booking and staff app for service bays.', img: 'img/g/bookbay-card.webp', href: 'https://bookbaytime.com/', cta: 'Open project',
    tag: 'Web app · Bookings', desc: 'A booking and staff app for service bays. The live page is the staff sign-in.', url: 'https://bookbaytime.com/', visit: 'Visit bookbaytime.com', art: { fx: 0.5, fy: 0.5, zoom: 1.0, bright: 0.98, contrast: 1.08, sat: 1.15, glow: null }, facts: [['Kind', 'Booking and staff app'], ['For', 'Service bays'], ['URL', 'bookbaytime.com'], ['Status', 'Live, staff sign-in']] },
  { cat: 'web', kind: 'WEB', file: 'VERROW.AI', name: 'Verrow AI', note: 'Our partner’s site, built together. Home-video design.', img: 'img/showcase_verrow_card-1280.webp', href: 'https://verrow.ai/', cta: 'Open project',
    tag: 'Website · Partner', desc: 'The site of our partner Verrow AI, built together: a home-video design where the work sits on a shelf of VHS tapes.', url: 'https://verrow.ai/', visit: 'Visit verrow.ai', art: { fx: 0.5, fy: 0.5, zoom: 1.12, bright: 1.6, contrast: 1.08, sat: 1.15, lift: 0.6, glow: [['rgba(120,255,190,.25)', 0.5, 0.5, 0.45], ['rgba(255,90,70,.22)', 0.85, 0.5, 0.4]] }, dark: true, facts: [['Kind', 'Website'], ['For', 'Our partner, Verrow AI'], ['URL', 'verrow.ai'], ['Status', 'Live site']] },
  { cat: 'systems', kind: 'SYSTEM', file: 'SWARM_WATCH.SYS', name: 'Swarm Watch', note: 'Command center for Project Swarm. One ledger, many workers.', img: 'img/g/swarm-card.webp', href: '', cta: 'Open project',
    tag: 'System · Internal tool', desc: 'A command center for Project Swarm: one ledger, many workers. Every number on it is read from ledgers and run folders. Built with Verrow AI. It is an internal tool, so there is no public link.', url: '', art: { fx: 0.5, fy: 0.45, zoom: 1.0, bright: 1.2, contrast: 1.05, sat: 1.1, lift: 0.55, liftCol: [52, 26, 70], glow: [['rgba(255,90,180,.3)', 0.5, 0.75, 0.5]] }, dark: true, facts: [['Kind', 'Command center'], ['For', 'Project Swarm'], ['Built with', 'Verrow AI'], ['Status', 'Internal tool, no public link']] },
  { cat: 'systems', kind: 'SYSTEM', file: 'PS5_FARM.SYS', name: 'PS5 LLM farm', note: 'A rack of jailbroken PS5s, each running a local LLM as a build worker.', img: 'img/ps5_farm_rack.webp', href: '', cta: 'Open project',
    tag: 'System · Local LLMs', desc: 'A rack of jailbroken PS5s, each running a local language model. The dashboard on each one shows Qwen 27B generating at about 18 to 19 tokens a second. A frontier model orchestrates them as build workers.', url: '', art: { fx: 0.5, fy: 0.4, zoom: 1.05, bright: 1.1, contrast: 1.08, sat: 1.05, lift: 0.3 }, dark: true, facts: [['Kind', 'Local LLM build workers'], ['Hardware', 'Jailbroken PS5s on a rack'], ['Model', 'Qwen 27B, about 18–19 tokens/s'], ['Orchestrator', 'A frontier model'], ['Status', 'Internal, no public link']],
    video: { src: 'img/ps5_farm.mp4', webm: 'img/ps5_farm.webm', still: 'img/g/ps5-loop.webp', w: 960, h: 622, cap: 'The rack, running: a short muted loop.' },
    film: { src: 'img/ps5_farm_full.mp4', webm: 'img/ps5_farm_full.webm', poster: 'img/g/ps5-poster.webp', frame: 'img/g/ps5-rack2.webp', a: 720 / 860, w: 720, h: 1280, secs: 20, label: 'Watch the full video', cap: 'The full video: 20 seconds, with sound.' } },
  { cat: 'systems', kind: 'PRIVATE', file: 'RECIPES.PRV', name: 'Forge Recipe Catalog', sub: 'for Forge Pizza Co', note: 'A private recipe catalog for Forge Pizza Co. Private build, no public link.', img: 'img/g/recipes-card.webp', private: true, pull: 'Some builds stay private. The sign-in is all we show.', href: '', cta: 'Open project',
    tag: 'Private build · for Forge Pizza Co', desc: 'A private recipe catalog for Forge Pizza Co: one private place for every recipe, measured exactly, planned, shopped, prepped and costed from real vendor prices. It is a private build, so there is no public link; what we show is its sign-in page.', url: '', art: { fx: 0.5, fy: 0.45, zoom: 1.05, bright: 1.05, contrast: 1.04, sat: 1.05 }, dark: true, facts: [['Kind', 'Recipe catalog'], ['For', 'Forge Pizza Co'], ['Sign-in', 'Email link and code, no password'], ['Status', 'Private build, no public link']] },
  { cat: 'systems', kind: 'PRIVATE', file: 'CLUER_PIPE.PRV', name: 'Cluer Pipeline', note: 'A private CRM and agent workspace for Cluer Holdings. No public link.', img: 'img/g/cluer-card.webp', private: true, pull: 'A CRM with a small team of agents living inside it.', href: '', cta: 'Open project',
    tag: 'Private build', desc: 'A private CRM and agent workspace for Cluer Holdings: leads, deals and capacity, with a small team of AI agents like Scout working alongside. Private build, so there is no public link.', url: '', art: { fx: 0.5, fy: 0.5, zoom: 1.0, bright: 1.0, contrast: 1.04, sat: 1.05 }, facts: [['Kind', 'CRM + agent workspace'], ['For', 'Cluer Holdings'], ['Sign-in', 'Secure email link, no password'], ['Status', 'Private build, no public link']] },
];

// ---- gallery shots, keyed by file. Every src is a distinct real image (graded in tools7/build_img.py); img is never repeated here.
const G = 'img/g/';
const D = 1.6, M = 0.6;   // desktop 1280x800 captures, phone 600x1000 captures
const CLAY = (pk, nm, chars, mobs, one) => [
  { src: G + pk + '-inside.webp', a: 1.649, cap: `What is inside ${nm}: every character and creature, each with its triangle count.` },
  { src: G + pk + '-chars.webp', a: 1, h: 3.0, cap: `Four of the characters: ${chars}.` },
  { src: G + pk + '-box.webp', f: 'box', a: 1.1 },
  { src: G + pk + '-mobs.webp', a: 1, h: 3.3, cap: `Four of the creatures: ${mobs}.` },
  { src: G + pk + '-one.webp', f: 'hang', a: 1, h: 1.7, cap: `${one}, on its turntable.` },
];
const SHOTS = {
  'VIKINGS.GLB': CLAY('vikings-and-dark-ages', 'Vikings and Dark Ages', 'monk scribe, Saxon thane, shieldmaiden and skald bard', 'brown bear, draugr, Fenrir and frost giant', 'The Viking jarl'),
  'PREHISTORIC.GLB': CLAY('prehistoric', 'Prehistoric', 'cave child, chief elder, hero caveman and spear hunter', 'ankylosaurus, dire wolf, giant croc and giant sloth', 'The rival brute'),
  'EGYPT.GLB': CLAY('egypt-and-bronze-age', 'Egypt and Bronze Age', 'bronze smith, bronze warrior, pharaoh and priestess', 'Anubis guard, bronze golem, camel and cobra', 'The royal guard'),
  'MODERN_II.GLB': CLAY('modern-ii', 'Modern II', 'construction worker, food truck vendor, hospital nurse and school teacher', 'alley cat, capybara, city seagull and cute kaiju', 'The soccer player'),
  'DORMANT_RED.EXE': [
    { src: G + 'dormant-card.webp', a: 16 / 9, h: 3.6, cap: 'The title screen: Derelict Station Echo-9.' },
    { src: G + 'dormant-start.webp', a: 16 / 9, h: 3.0, cap: 'The start: oxygen full, three systems down.' },
    { src: G + 'dormant-run.webp', a: 16 / 9, h: 3.4, cap: 'Comms and airlock back online, power still to go, and something is moving.' },
    { src: G + 'dormant-over.webp', a: 16 / 9, h: 2.8, cap: 'Game over: the station claimed another crew member.' },
  ],
  'YOTTAIFY.COM': [
    { src: G + 'yot-pricing.webp', f: 'browser', a: D, cap: 'The pricing page: B300 rental rates, each one sourced and dated.' },
    { src: G + 'yot-power.webp', a: D, h: 3.4, cap: 'The facility page draws the power path, from the utility service to six feeders.' },
    { src: G + 'yot-m-rates.webp', f: 'phone', a: M, cap: 'On a phone, the rate table stacks into one column.' },
    { src: G + 'yot-building.webp', a: D, h: 3.0, cap: 'The building, the service and who can walk into it.' },
    { src: G + 'yot-steps.webp', a: D, h: 3.6, cap: 'Every step of a reservation, in order.' },
    { src: G + 'yot-cta.webp', a: D, h: 2.8, cap: 'B300 capacity in days, not months.' },
  ],
  'PUTT_DROP.APK': [
    { src: G + 'putt-dewdrop.webp', f: 'phone', a: 0.5625, cap: 'Hole 1, Dewdrop: par 2, with a power ring to drag back from.' },
    { src: G + 'putt-moonpool.webp', a: 0.5625, h: 3.6, cap: 'Hole 5, Moon Pool: par 3, around the water.' },
    { src: G + 'putt-icon.webp', f: 'hang', a: 1, h: 1.6, cap: 'The app icon.' },
    { src: G + 'putt-undertow.webp', a: 0.5625, h: 3.4, cap: 'Hole 9, Undertow: par 4.' },
    { src: G + 'putt-hio.webp', a: 0.5625, h: 3.6, cap: 'Hole in one: three stars.' },
    { src: G + 'putt-holes.webp', a: 0.5625, h: 3.2, cap: 'The hole list, with stars and par for every hole.' },
  ],
  'FORGEPIZZACO.COM': [
    { src: G + 'forge-menu.webp', f: 'browser', a: D, cap: 'The whole menu, with a search box and a chip for every section.' },
    { src: G + 'forge-wild.webp', a: D, h: 3.4, cap: 'A little wild: the wood fire, front and centre.' },
    { src: G + 'forge-m-fav.webp', f: 'phone', a: M, cap: 'On a phone: meet your next favorite.' },
    { src: G + 'forge-build.webp', a: D, h: 3.0, cap: 'Forge your own pie: pick a size, a sauce and the rest.' },
    { src: G + 'forge-loc.webp', a: D, h: 3.5, cap: '701 Hwy 62-65 S, with the hours and a call button.' },
  ],
  'BINGOAUCTIONS.COM': [
    { src: G + 'bingo-browse.webp', f: 'browser', a: D, cap: 'Browse: every live auction, each with its lot count and closing date.' },
    { src: G + 'bingo-lots.webp', a: D, h: 3.4, cap: 'Lots ending soon, recent wins and a shelf of categories.' },
    { src: G + 'bingo-m-cats.webp', f: 'phone', a: M, cap: 'Bid from your phone: the categories, on a small screen.' },
    { src: G + 'bingo-cats.webp', a: D, h: 3.0, cap: 'Shop by category, then get the app for push notifications.' },
    { src: G + 'bingo-auctions.webp', a: D, h: 3.6, cap: 'Live and upcoming auctions, each with its own name.' },
    { src: G + 'bingo-closed.webp', a: D, h: 2.9, cap: 'Recently closed auctions, with their results.' },
  ],
  'BOOKBAYTIME.COM': [
    { src: G + 'bookbay-m-signin.webp', a: 0.88, h: 3.4, cap: 'The same staff sign-in, on a phone: a work email, or continue with Google.' },
  ],
  'VERROW.AI': [
    { src: G + 'verrow-tapes.webp', f: 'browser', a: D, cap: 'All tapes: every piece of work on one shelf, with its status.' },
    { src: G + 'verrow-swarm.webp', a: D, h: 3.4, cap: 'The Project Swarm tape: the build system behind every Verrow project.' },
    { src: G + 'verrow-m-home.webp', f: 'phone', a: M, cap: 'On a phone: one tape at a time, front and centre.' },
    { src: G + 'verrow-auction.webp', a: D, h: 3.2, cap: 'The auction engine tape: a live bidding platform.' },
  ],
  'SWARM_WATCH.SYS': [
    { src: G + 'swarm-ledger.webp', a: 1280 / 475, h: 2.6, cap: 'Below the hive: the session log, all projects, and what the ledger shows.' },
    { src: G + 'swarm-narrow.webp', a: 800 / 1024, h: 3.7, cap: 'On a narrow screen the hive stacks: the ring on top, the project cards below.' },
  ],
  'PS5_FARM.SYS': [
    { src: 'img/ps5_farm_dash.webp', a: 1080 / 980, h: 3.4, cap: 'Each PS5 has its own dashboard: the model, and how fast it is generating.' },
    { src: G + 'ps5-fleet.webp', f: 'hang', a: 720 / 213, h: 1.5, cap: 'The fleet board: one card per PS5, with its model, its job and its speed.' },
  ],
  'RECIPES.PRV': [
    { src: G + 'recipes-m-signin.webp', f: 'phone', a: M, cap: 'The sign-in on a phone. No password: it emails a link and a code.' },
  ],
  'CLUER_PIPE.PRV': [
    { src: G + 'cluer-village.webp', f: 'phone', a: 500 / 1180, h: 4.3, cap: 'The overview: your team of agents lives in a little village you can explore.' },
    { src: G + 'cluer-agents.webp', f: 'phone', a: 500 / 1180, h: 4.3, cap: 'Agent studio: Scout enriches a new lead before anyone reads it, and cites every fact.' },
    { src: G + 'cluer-stats.webp', f: 'phone', a: 500 / 1180, h: 4.3, cap: 'Promises, open relationships and quotes at a glance, with capacity below.' },
    { src: G + 'cluer-capacity.webp', f: 'phone', a: 500 / 1180, h: 4.3, cap: 'Capacity: the GPU fleet month by month, so you know exactly what is free.' },
  ],
};
PROJECTS.forEach((p) => { p.shots = SHOTS[p.file] || []; });

// our own voice per category (pull-lines on project pages; not quotes from anyone else)
export const PULL = {
  games: 'We make the games we would stay up late to play.',
  web: 'A site should say what it is in one look, then get out of the way.',
  clay: 'Clay-style, so every prop looks like it could sit on our desk.',
  systems: 'The tools we lean on hardest are the ones we built for ourselves.',
};

export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'games', label: 'Games' },
  { id: 'web', label: 'Web' },
  { id: 'systems', label: 'Systems' },
  { id: 'clay', label: 'Clay 3D' },
];

// Clay library: the four packs with public names and art; the rest are shown as unnamed boxes.
export const LIBRARY = { packs: 48, models: 730, textures: 176, named: [0, 3, 6, 7] };
// real numbers only, for the numbers wall
export const NUMBERS = [[48, 'clay packs'], [730, 'models'], [176, 'textures'], [PROJECTS.length, 'projects in the showcase'], [2, 'games live']];
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.rdwlabz.puttdrop';
export const CONTACT = 'devops@therdw.com';
