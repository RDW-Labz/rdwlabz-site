import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import {
  androidAppId,
  iosBundleId,
  steamAppId,
  modrinthId,
  curseforgeId,
  detectIds,
  guessCategory,
  categoryFromTopics,
  findRepoIcon,
  pickFiles,
} from '../scripts/sync/detect.mjs';
import {
  checkPlay,
  checkAppStore,
  checkSteam,
  checkModrinth,
  checkCurseForge,
  checkItch,
  itchUrl,
} from '../scripts/sync/stores.mjs';
import { accessibleAccent, contrast, dominantColor, processIcon } from '../scripts/sync/images.mjs';
import { checksEnv, waitForChecks } from '../scripts/wait-pr-checks.mjs';
import {
  validateOverrides,
  resolveEntry,
  mergeProjects,
  renderSummary,
  fingerprint,
  handEdited,
  prettifyName,
  syncId,
  slugify,
} from '../scripts/sync/build.mjs';

const FIX = 'tests/fixtures/sync';

/** Load a fixture folder as { repoPath: text }, dropping the `.fixture` suffix. */
function repo(dir: string): Record<string, string> {
  const root = join(FIX, dir);
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(root, p).replace(/\.fixture$/, '')] = readFileSync(p, 'utf8');
    }
  };
  walk(root);
  return out;
}
const store = (f: string) => readFileSync(join(FIX, 'stores', f), 'utf8');

/** fetch-compatible fake: maps a URL substring to [status, body]. */
function fakeHttp(routes: Record<string, [number, string]>) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const http = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const hit = Object.entries(routes).find(([k]) => url.includes(k));
    const [status, body] = hit ? hit[1] : [404, ''];
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => body,
      json: async () => JSON.parse(body),
    };
  };
  return { http, calls };
}

test.describe('sync detectors: repo files', () => {
  test('Android applicationId from Groovy and Kotlin Gradle', () => {
    expect(androidAppId(repo('gradle-groovy'))).toBe('com.rdwlabz.fixture.groovy');
    expect(androidAppId(repo('gradle-kts'))).toBe('com.rdwlabz.fixture.kts');
  });

  test('Capacitor and Expo configs give Android + iOS ids', () => {
    expect(androidAppId(repo('capacitor'))).toBe('com.rdwlabz.fixture.cap');
    expect(iosBundleId(repo('capacitor'))).toBe('com.rdwlabz.fixture.cap');
    expect(androidAppId(repo('expo-json'))).toBe('com.rdwlabz.fixture.expo');
    expect(iosBundleId(repo('expo-json'))).toBe('com.rdwlabz.fixture.expoios');
    expect(androidAppId(repo('expo-ts'))).toBe('com.rdwlabz.fixture.expots');
    expect(iosBundleId(repo('expo-ts'))).toBe('com.rdwlabz.fixture.expotsios');
  });

  test('iOS bundle id from the Xcode project skips test targets and variables', () => {
    const files = repo('ios');
    expect(iosBundleId(files)).toBe('com.rdwlabz.fixture.ios');
    const plistOnly = { 'ios/App/App/Info.plist': files['App/App/Info.plist'] };
    expect(iosBundleId(plistOnly)).toBe('com.rdwlabz.fixture.plist');
  });

  test('Steam, Modrinth and CurseForge ids', () => {
    expect(steamAppId(repo('steam'))).toBe('1234560');
    expect(modrinthId(repo('mod-props'))).toBe('AbCd1234');
    expect(curseforgeId(repo('mod-props'))).toBe('987654');
    expect(modrinthId(repo('mod-gradle'))).toBe('fixture-mod');
    expect(curseforgeId(repo('mod-gradle'))).toBe('123456');
    expect(steamAppId(repo('gradle-kts'))).toBeNull();
  });

  test('pickFiles fetches only small config files and skips vendored folders', () => {
    const tree = [
      { path: 'android/app/build.gradle', type: 'blob', size: 900 },
      { path: 'node_modules/x/app.json', type: 'blob', size: 10 },
      { path: 'ios/App/App/Info.plist', type: 'blob', size: 400 },
      { path: 'ios/AppTests/Info.plist', type: 'blob', size: 400 },
      { path: 'package.json', type: 'blob', size: 300 },
      { path: 'web/package.json', type: 'blob', size: 300 },
      { path: 'huge/build.gradle', type: 'blob', size: 900_000 },
      { path: 'src/main.ts', type: 'blob', size: 300 },
      { path: 'tests/fixtures/sync/steam/steam_appid.txt', type: 'blob', size: 8 },
      { path: 'android/app/src/test/build.gradle', type: 'blob', size: 900 },
      { path: 'examples/demo/app.json', type: 'blob', size: 300 },
      { path: 'packages/x/__fixtures__/gradle.properties', type: 'blob', size: 90 },
    ];
    expect(pickFiles(tree).sort()).toEqual(
      ['android/app/build.gradle', 'ios/App/App/Info.plist', 'package.json'].sort(),
    );
  });

  test('this site repo is not detected as a store project (its fixtures are ignored)', () => {
    const paths = execSync('git ls-files', { encoding: 'utf8' }).trim().split('\n');
    const tree = paths.map((path) => ({ path, type: 'blob', size: 1 }));
    const all = Object.fromEntries(pickFiles(tree).map((p) => [p, readFileSync(p, 'utf8')]));
    expect(Object.values(detectIds(all)).filter(Boolean)).toEqual([]);
  });

  test('category: topics first, then files, default software', () => {
    expect(categoryFromTopics(['rdwlabz', 'game'])).toBe('games');
    expect(categoryFromTopics(['rdwlabz'])).toBeNull();
    expect(guessCategory({ paths: ['src/main/resources/fabric.mod.json'] })).toBe('mods');
    expect(guessCategory({ paths: ['project.godot'] })).toBe('games');
    expect(
      guessCategory({
        paths: ['package.json'],
        files: { 'package.json': '{"dependencies":{"phaser":"4"}}' },
      }),
    ).toBe('games');
    expect(guessCategory({ paths: ['a.png', 'b.png', 'c.wav', 'd.fbx', 'e.png', 'LICENSE'] })).toBe(
      'asset-packs',
    );
    expect(guessCategory({ paths: ['src/index.ts', 'README.md'] })).toBe('software');
  });

  test('repo icon: launcher icons beat generic files; Expo icon path is honoured', () => {
    const tree = [
      { path: 'icon.png', type: 'blob', size: 100 },
      { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', type: 'blob', size: 50 },
    ];
    expect(findRepoIcon(tree)).toBe('android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png');
    const expo = [{ path: 'assets/icon.png', type: 'blob', size: 1 }];
    expect(findRepoIcon(expo, repo('expo-json'))).toBe('assets/icon.png');
    expect(findRepoIcon([{ path: 'src/a.ts', type: 'blob' }])).toBeNull();
  });
});

test.describe('sync detectors: stores', () => {
  test('Google Play: 200 = live, title and icon from the page; 404 = not listed', async () => {
    const { http } = fakeHttp({ 'id=com.ok': [200, store('play.html')] });
    const l = await checkPlay('com.ok', http);
    expect(l).toMatchObject({
      store: 'play',
      platforms: ['Android'],
      url: 'https://play.google.com/store/apps/details?id=com.ok',
      title: 'Fixture Golf & Friends',
      iconUrl: 'https://play-lh.googleusercontent.com/fixture-icon',
      live: true,
    });
    expect(await checkPlay('com.missing', http)).toBeNull();
    const { http: down } = fakeHttp({ 'id=': [503, ''] });
    await expect(checkPlay('com.ok', down)).rejects.toThrow('HTTP 503');
  });

  test('App Store lookup: trackViewUrl, artwork and release date', async () => {
    const { http } = fakeHttp({
      'bundleId=com.ok': [200, store('itunes.json')],
      'bundleId=': [200, store('itunes-empty.json')],
    });
    expect(await checkAppStore('com.ok', http)).toMatchObject({
      url: 'https://apps.apple.com/us/app/fixture-ios/id100',
      title: 'Fixture iOS',
      iconUrl: 'https://is1-ssl.mzstatic.com/fixture/512x512bb.jpg',
      releasedAt: '2026-03-04',
      platforms: ['iOS'],
    });
    expect(await checkAppStore('com.none', http)).toBeNull();
  });

  test('Steam: released vs coming soon vs missing', async () => {
    const live = await checkSteam('1234560', fakeHttp({ appids: [200, store('steam.json')] }).http);
    expect(live).toMatchObject({
      url: 'https://store.steampowered.com/app/1234560',
      platforms: ['Windows', 'Linux'],
      releasedAt: '2026-02-05',
      live: true,
      kind: 'games',
    });
    const soon = await checkSteam(
      '1234560',
      fakeHttp({ appids: [200, store('steam-soon.json')] }).http,
    );
    expect(soon).toMatchObject({ live: false, releasedAt: undefined });
    expect(
      await checkSteam('1234560', fakeHttp({ appids: [200, store('steam-missing.json')] }).http),
    ).toBeNull();
  });

  test('Modrinth: approved projects only; project type sets the category', async () => {
    const ok = await checkModrinth(
      'AbCd1234',
      fakeHttp({ modrinth: [200, store('modrinth.json')] }).http,
    );
    expect(ok).toMatchObject({
      url: 'https://modrinth.com/resourcepack/fixture-pack',
      kind: 'asset-packs',
      releasedAt: '2025-11-20',
    });
    expect(
      await checkModrinth('x', fakeHttp({ modrinth: [200, store('modrinth-draft.json')] }).http),
    ).toBeNull();
  });

  test('itch.io: public page = live listing with "Play free" button; draft (404) = none', async () => {
    const url = 'https://Btabor11.itch.io/Dormant-Red/';
    const live = await checkItch(
      url,
      fakeHttp({ 'btabor11.itch.io': [200, store('itch.html')] }).http,
    );
    expect(live).toEqual({
      store: 'itch',
      platforms: ['Web'],
      url: 'https://btabor11.itch.io/dormant-red',
      title: 'Dormant Red',
      imageUrl: 'https://img.itch.zone/aW1nLzMwNjY4Mzk1LnBuZw==/original/ZIq0dj.png',
      releasedAt: '2026-10-08',
      live: true,
      kind: 'games',
      cta: 'Play free on itch.io',
    });
    expect(await checkItch(url, fakeHttp({}).http)).toBeNull();
    await expect(checkItch(url, fakeHttp({ 'itch.io': [500, ''] }).http)).rejects.toThrow(
      'HTTP 500',
    );
  });

  test('itch.io: paid tools say "Get it", category from the page, only itch game links count', async () => {
    const paid = await checkItch(
      'https://example.itch.io/pixel-kit',
      fakeHttp({ 'example.itch.io': [200, store('itch-paid.html')] }).http,
    );
    expect(paid).toMatchObject({
      title: 'Pixel Kit',
      kind: 'software',
      platforms: ['Windows', 'Linux'],
      cta: 'Get it on itch.io',
    });
    expect(itchUrl('https://btabor11.itch.io/dormant-red')).toBe(
      'https://btabor11.itch.io/dormant-red',
    );
    for (const bad of [
      'http://btabor11.itch.io/dormant-red',
      'https://itch.io/games',
      'https://btabor11.itch.io',
      'https://btabor11.itch.io.evil.com/x',
      'https://store.steampowered.com/app/1',
      undefined,
    ]) {
      expect(itchUrl(bad), String(bad)).toBeNull();
    }
    const { http, calls } = fakeHttp({});
    expect(await checkItch('https://example.com/game', http)).toBeNull();
    expect(calls).toEqual([]);
  });

  test('CurseForge: skipped without an API key, checked with one', async () => {
    const { http, calls } = fakeHttp({ 'mods/987654': [200, store('curseforge.json')] });
    expect(await checkCurseForge('987654', http, undefined)).toBeNull();
    expect(calls).toHaveLength(0);
    expect(await checkCurseForge('987654', http, 'k')).toMatchObject({
      url: 'https://www.curseforge.com/minecraft/mc-mods/fixture-cf',
      platforms: ['Minecraft'],
      releasedAt: '2026-01-09',
    });
    expect(calls[0].headers['x-api-key']).toBe('k');
  });
});

test.describe('sync images', () => {
  test('dominant color ignores transparent and white background pixels', () => {
    const px = [];
    for (let i = 0; i < 60; i++) px.push(255, 255, 255, 255);
    for (let i = 0; i < 20; i++) px.push(20, 180, 90, 255);
    for (let i = 0; i < 40; i++) px.push(255, 0, 0, 0);
    const hex = dominantColor(new Uint8Array(px));
    expect(hex).toBe('#14b45a');
    expect(dominantColor(new Uint8Array([0, 0, 0, 0]))).toBeNull();
    // A bright logo on a big dark background wins; a tiny speck of color doesn't.
    const logo: number[] = [];
    for (let i = 0; i < 70; i++) logo.push(14, 26, 58, 255);
    for (let i = 0; i < 25; i++) logo.push(60, 242, 160, 255);
    for (let i = 0; i < 5; i++) logo.push(255, 62, 200, 255);
    expect(dominantColor(new Uint8Array(logo))).toBe('#3cf2a0');
    const grey = Array.from({ length: 10 }, () => [128, 128, 128, 255]).flat();
    expect(dominantColor(new Uint8Array(grey))).toBe('#808080');
  });

  test('accent is darkened until white text on it passes AA', () => {
    for (const c of ['#ffe14d', '#14b45a', '#3d7bff', '#ffffff']) {
      expect(contrast(accessibleAccent(c)!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
    expect(accessibleAccent('#1e1433')).toBe('#1e1433');
  });

  test('processIcon outputs a 256px WebP and an AA accent', async () => {
    const png = await sharp({
      create: { width: 600, height: 600, channels: 4, background: '#ff8a00' },
    })
      .png()
      .toBuffer();
    const { webp, accent } = await processIcon(png);
    const meta = await sharp(webp).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 256, 256]);
    expect(contrast(accent!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
    await expect(processIcon(Buffer.from('not an image'))).rejects.toThrow();
  });
});

const pub = {
  name: 'fixture-golf',
  private: false,
  description: 'A neon golf game.',
  topics: [] as string[],
};
const priv = { ...pub, name: 'secret-thing', private: true, description: 'Secret Thing: internal' };
const playLive = {
  store: 'play',
  platforms: ['Android'],
  url: 'https://play.google.com/store/apps/details?id=com.x',
  title: 'Fixture Golf',
  iconUrl: 'https://play-lh.googleusercontent.com/i',
  live: true,
};

test.describe('sync listing rules and fields', () => {
  test('never lists a repo without a store listing or the rdwlabz topic', () => {
    expect(resolveEntry({ repo: pub })).toBeNull();
    expect(resolveEntry({ repo: pub, overrides: { name: 'X' } })).toBeNull();
    expect(resolveEntry({ repo: { ...pub, topics: ['rdwlabz'] } })).toMatchObject({
      entry: { name: 'Fixture Golf', status: 'in-dev', url: null, oneLiner: 'A neon golf game.' },
    });
  });

  test('a live store listing lists it automatically, released, with store title and link', () => {
    const r = resolveEntry({
      repo: pub,
      detected: { androidId: 'com.x', iosBundleId: 'com.x' },
      listings: [playLive],
    });
    expect(r).toMatchObject({
      entry: {
        name: 'Fixture Golf',
        status: 'released',
        url: playLive.url,
        platforms: ['Android', 'iOS'],
      },
      iconSource: { kind: 'url', url: playLive.iconUrl },
    });
  });

  test('overrides win over every detected value', () => {
    const r = resolveEntry({
      repo: { ...pub, topics: ['rdwlabz', 'game'] },
      overrides: { name: 'Big Name', category: 'software', featured: true, status: 'coming-soon' },
      detected: { topicCategory: 'games' },
      listings: [playLive],
    });
    expect(r).toMatchObject({
      entry: { name: 'Big Name', category: 'software', featured: true, status: 'coming-soon' },
    });
  });

  test('private repos: no name, description or GitHub link leaks without a public store page', () => {
    expect(resolveEntry({ repo: { ...priv, topics: ['rdwlabz'] } })).toEqual({
      skip: expect.stringContaining('add "name"'),
    });
    const named = resolveEntry({
      repo: { ...priv, topics: ['rdwlabz'] },
      overrides: { name: 'Public Name' },
      ghRelease: {
        firstAt: '2026-01-01',
        url: 'https://github.com/RDW-Labz/secret-thing/releases',
      },
    });
    expect(named).toMatchObject({
      entry: { name: 'Public Name', oneLiner: 'TODO: one line', status: 'in-dev', url: null },
    });
    expect(JSON.stringify(named)).not.toMatch(/secret/i);
    const listed = resolveEntry({ repo: priv, listings: [playLive] });
    expect(listed).toMatchObject({
      entry: { name: 'Fixture Golf', oneLiner: 'Secret Thing: internal' },
    });
  });

  test('released date: store date, else first GitHub Release (public repos only)', () => {
    const r = resolveEntry({
      repo: { ...pub, topics: ['rdwlabz'] },
      ghRelease: {
        firstAt: '2026-02-02',
        url: 'https://github.com/RDW-Labz/fixture-golf/releases',
      },
    });
    expect(r).toMatchObject({ entry: { status: 'released', releasedAt: '2026-02-02' } });
    const s = resolveEntry({
      repo: pub,
      listings: [{ ...playLive, releasedAt: '2026-05-05' }],
      ghRelease: { firstAt: '2026-02-02', url: 'x' },
    });
    expect(s).toMatchObject({ entry: { releasedAt: '2026-05-05' } });
  });

  test('Steam coming-soon page lists it, links it, but keeps it in-dev', () => {
    const r = resolveEntry({
      repo: priv,
      listings: [
        {
          store: 'steam',
          platforms: ['Windows'],
          url: 'https://store.steampowered.com/app/1',
          title: 'Soon',
          live: false,
          kind: 'games',
          imageUrl: 'https://x/h.jpg',
        },
      ],
    });
    expect(r).toMatchObject({
      entry: {
        name: 'Soon',
        status: 'in-dev',
        category: 'games',
        url: 'https://store.steampowered.com/app/1',
      },
      artSource: { kind: 'url', url: 'https://x/h.jpg' },
    });
  });

  test('rdwlabz.json overrides: TODOs are ignored, bad fields dropped with warnings', () => {
    const { overrides, warnings } = validateOverrides(
      {
        name: 'TODO',
        oneLiner: 'TODO: one line',
        category: 'Games',
        url: 'http://x',
        featured: 'yes',
        accentColor: '#12ab34',
        androidId: 'com.ok.app',
      },
      { isPrivate: false, repoName: 'r' },
    );
    expect(overrides).toEqual({
      category: 'games',
      accentColor: '#12ab34',
      androidId: 'com.ok.app',
    });
    expect(warnings.join('|')).toMatch(/url.*featured/);
    const p = validateOverrides(
      { url: 'https://github.com/RDW-Labz/secret-thing' },
      { isPrivate: true, repoName: 'secret-thing' },
    );
    expect(p.overrides).toEqual({});
    expect(p.warnings[0]).toMatch(/private repo/);
    expect(
      validateOverrides({ hidden: true }, { isPrivate: false, repoName: 'r' }).overrides.hidden,
    ).toBe(true);
  });

  test('itch link in rdwlabz.json or the homepage lists it as released, with the store button', () => {
    const itch = {
      store: 'itch',
      platforms: ['Web'],
      url: 'https://btabor11.itch.io/secret-thing',
      title: 'Secret Thing',
      releasedAt: '2026-10-08',
      live: true,
      kind: 'games',
      cta: 'Play free on itch.io',
    };
    // A private repo's name in a public itch URL is fine: the page itself is public.
    const { overrides, warnings } = validateOverrides(
      { url: 'https://btabor11.itch.io/secret-thing', status: 'released', platforms: ['Web'] },
      { isPrivate: true, repoName: 'secret-thing' },
    );
    expect(warnings).toEqual([]);
    const r = resolveEntry({ repo: priv, overrides, listings: [itch] });
    expect(r).toMatchObject({
      entry: {
        name: 'Secret Thing',
        status: 'released',
        url: itch.url,
        cta: 'Play free on itch.io',
        category: 'games',
        releasedAt: '2026-10-08',
      },
    });
    // Homepage link (no override): same result.
    expect(resolveEntry({ repo: pub, listings: [itch] })).toMatchObject({
      entry: { status: 'released', url: itch.url, cta: 'Play free on itch.io' },
    });
  });

  test('itch link that is not public (draft) is never used and never lists the repo', () => {
    const { overrides } = validateOverrides(
      { url: 'https://btabor11.itch.io/secret-thing' },
      { isPrivate: true, repoName: 'secret-thing' },
    );
    expect(resolveEntry({ repo: priv, overrides, listings: [] })).toBeNull();
    const tagged = resolveEntry({
      repo: { ...priv, topics: ['rdwlabz'] },
      overrides: { ...overrides, name: 'Public Name' },
      listings: [],
    });
    expect(tagged).toMatchObject({ entry: { name: 'Public Name', url: null } });
    expect(JSON.stringify(tagged)).not.toMatch(/secret/i);
  });

  test('status label and real screenshots come from rdwlabz.json; screenshots beat store art', () => {
    const { overrides, warnings } = validateOverrides(
      {
        statusLabel: 'Coming to Google Play',
        screenshots: [
          'store/screenshots/01.png',
          { path: 'store/screenshots/02.webp', alt: 'Hole 9' },
        ],
      },
      { isPrivate: true, repoName: 'r' },
    );
    expect(warnings).toEqual([]);
    expect(overrides.screenshots).toEqual([
      { path: 'store/screenshots/01.png' },
      { path: 'store/screenshots/02.webp', alt: 'Hole 9' },
    ]);
    const r = resolveEntry({
      repo: { ...pub, topics: ['rdwlabz'] },
      overrides: { ...overrides, status: 'coming-soon' },
      listings: [{ ...playLive, live: false, imageUrl: 'https://x/art.jpg' }],
    });
    expect(r).toMatchObject({
      entry: { status: 'coming-soon', statusLabel: 'Coming to Google Play' },
      shotSources: overrides.screenshots,
      artSource: null,
    });
    for (const bad of [
      ['../secrets.png'],
      ['shot.gif'],
      ['/abs/x.png'],
      ['https://x/y.png'],
      ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'],
      [],
    ]) {
      const v = validateOverrides({ screenshots: bad }, { isPrivate: false, repoName: 'r' });
      expect(v.overrides.screenshots, JSON.stringify(bad)).toBeUndefined();
      expect(v.warnings[0]).toMatch(/screenshots/);
    }
  });

  test('hidden override removes a repo even with a store listing', () => {
    expect(
      resolveEntry({ repo: pub, overrides: { hidden: true }, listings: [playLive] }),
    ).toBeNull();
  });

  test('names, ids and slugs', () => {
    expect(prettifyName('putt-drop')).toBe('Putt Drop');
    expect(prettifyName('myCoolApp')).toBe('My Cool App');
    expect(prettifyName('RPG_ui-kit')).toBe('RPG Ui Kit');
    expect(syncId(123)).toMatch(/^gh-[0-9a-f]{12}$/);
    expect(slugify('Café Racer: 2!')).toBe('cafe-racer-2');
  });
});

const manual = {
  slug: 'hand-made',
  name: 'Hand Made',
  oneLiner: 'x',
  category: 'mods',
  status: 'released',
  platforms: [],
  url: null,
  accentColor: 'TODO',
  image: null,
  featured: false,
};

test.describe('sync merge', () => {
  test('keeps manual entries, adds, releases, keeps on error, removes, skips clashes', () => {
    const id = syncId(1);
    const entry = resolveEntry({ repo: { ...pub, topics: ['rdwlabz'] } })!;
    if (!('entry' in entry)) throw new Error('expected entry');
    const first = mergeProjects({ projects: [manual] }, [{ id, entry: entry.entry }], '2026-10-01');
    expect(first.changes.added).toEqual(['Fixture Golf']);
    expect(first.data.projects[0]).toEqual(manual);
    expect(first.data.projects[1]).toMatchObject({ addedAt: '2026-10-01', sync: { id } });

    expect(mergeProjects(first.data, [{ id, entry: entry.entry }], '2026-10-09').changed).toBe(
      false,
    );

    const kept = mergeProjects(first.data, [{ id, keep: true }], '2026-10-09');
    expect(kept.changed).toBe(false);
    expect(kept.changes.kept).toEqual(['Fixture Golf']);

    const rel = mergeProjects(
      first.data,
      [{ id, entry: { ...entry.entry, status: 'released', releasedAt: '2026-10-05' } }],
      '2026-10-09',
    );
    expect(rel.changes.released).toEqual(['Fixture Golf']);
    expect(rel.data.projects[1]).toMatchObject({ addedAt: '2026-10-01', releasedAt: '2026-10-05' });

    const clash = mergeProjects(
      first.data,
      [{ id: syncId(2), entry: { ...entry.entry, name: 'Other', slug: 'hand-made' } }],
      '2026-10-09',
    );
    expect(clash.changes.removed).toEqual(['Fixture Golf']);
    expect(clash.changes.skipped[0]).toMatch(/hand-written entry/);
    expect(clash.data.projects).toEqual([manual]);
  });

  test('hand edits to a synced entry in projects.json are never overwritten', () => {
    const id = syncId(7);
    const fromRepo = {
      slug: 'fixture-golf',
      name: 'Fixture Golf',
      oneLiner: 'From the repo.',
      category: 'games',
      status: 'in-dev',
      platforms: ['Android'],
      url: null,
      cta: 'Play free on itch.io',
      accentColor: 'TODO',
      image: null,
      featured: false,
    };
    const first = mergeProjects({ projects: [] }, [{ id, entry: fromRepo }], '2026-10-01');
    const synced = first.data.projects[0];
    expect(synced.sync.written.oneLiner).toBe(fingerprint('From the repo.'));
    expect(handEdited(synced)).toEqual([]);

    // Braden edits two fields and deletes one by hand.
    const edited = structuredClone(first.data);
    edited.projects[0].oneLiner = 'Written by hand.';
    edited.projects[0].featured = true;
    delete edited.projects[0].cta;
    expect(handEdited(edited.projects[0])).toEqual(['cta', 'featured', 'oneLiner']);

    // The repo changes too: repo-only fields update, hand-edited ones stay.
    const next = mergeProjects(
      edited,
      [{ id, entry: { ...fromRepo, oneLiner: 'New repo text.', status: 'released' } }],
      '2026-10-09',
    );
    const p = next.data.projects[0];
    expect(p).toMatchObject({
      oneLiner: 'Written by hand.',
      featured: true,
      status: 'released',
      addedAt: '2026-10-01',
    });
    expect('cta' in p).toBe(false);
    expect(p.sync.pinned).toEqual(['cta', 'featured', 'oneLiner']);
    expect(next.changes.handEdits).toEqual(['Fixture Golf: cta, featured, oneLiner']);

    // Pins persist on later runs, even though the fingerprints now match.
    const again = mergeProjects(next.data, [{ id, entry: fromRepo }], '2026-10-10');
    expect(again.data.projects[0].oneLiner).toBe('Written by hand.');

    // Removing a field from `pinned` hands it back to the sync.
    const unpinned = structuredClone(again.data);
    unpinned.projects[0].sync.pinned = ['featured'];
    const back = mergeProjects(unpinned, [{ id, entry: fromRepo }], '2026-10-11');
    expect(back.data.projects[0]).toMatchObject({ oneLiner: 'From the repo.', featured: true });
    expect(back.data.projects[0].cta).toBe('Play free on itch.io');
  });

  test('older synced entries (no fingerprints) only keep explicitly pinned fields', () => {
    const id = syncId(8);
    const fromRepo = {
      slug: 'old',
      name: 'Old',
      oneLiner: 'Repo text.',
      category: 'games',
      status: 'in-dev',
      platforms: [],
      url: null,
      accentColor: 'TODO',
      image: null,
      featured: false,
    };
    const legacy = {
      ...fromRepo,
      oneLiner: 'Hand text.',
      url: 'https://example.com/old',
      addedAt: '2026-01-01',
      sync: { id, pinned: ['url'] },
    };
    const r = mergeProjects({ projects: [legacy] }, [{ id, entry: fromRepo }], '2026-10-12');
    expect(r.data.projects[0]).toMatchObject({
      oneLiner: 'Repo text.',
      url: 'https://example.com/old',
      addedAt: '2026-01-01',
    });
  });

  test('summary lists public project names and the auto-merge rule', () => {
    const md = renderSummary(
      { added: ['Putt Drop'], updated: [], released: [], removed: [], skipped: [], kept: [] },
      ['Putt Drop: icon skipped (image HTTP 404)'],
    );
    expect(md).toContain('- Putt Drop');
    expect(md).toContain('Auto-merges only when');
    expect(md).toContain('Warnings');
  });

  test('templates are valid overrides', () => {
    for (const f of ['templates/rdwlabz.json', 'templates/putt-drop.rdwlabz.json']) {
      const { warnings } = validateOverrides(JSON.parse(readFileSync(f, 'utf8')), {
        isPrivate: true,
        repoName: 'putt-drop',
      });
      expect(warnings, f).toEqual([]);
    }
  });
});

type Check = { name: string; bucket: string };
/** Plays back one `gh pr checks` result per poll (last one repeats) on a fake clock. */
function checksScript(steps: (Check[] | Error)[]) {
  let t = 0;
  let i = 0;
  const polls: number[] = [];
  return {
    polls,
    opts: {
      list: async () => {
        polls.push(t);
        const s = steps[Math.min(i++, steps.length - 1)];
        if (s instanceof Error) throw s;
        return s;
      },
      now: () => t,
      sleep: async (ms: number) => {
        t += ms;
      },
    },
  };
}
const cf = (bucket: string) => ({ name: 'Cloudflare Pages', bucket });

test.describe('sync auto-merge: waiting for PR checks', () => {
  test('waits while the Cloudflare Pages preview is pending, then passes', async () => {
    const s = checksScript([[cf('pending')], [cf('pending')], [cf('pending')], [cf('pass')]]);
    expect(await waitForChecks(s.opts)).toMatchObject({ result: 'pass', failed: [] });
    expect(s.polls).toEqual([0, 20_000, 40_000, 60_000]);
  });

  test('waits for a check that registers after the push', async () => {
    const s = checksScript([[], [], [cf('pending')], [cf('pass')]]);
    expect(await waitForChecks(s.opts)).toMatchObject({ result: 'pass' });
    expect(s.polls).toHaveLength(4);
  });

  test('only a failed check blocks, with its name', async () => {
    const s = checksScript([
      [cf('pending'), { name: 'lint', bucket: 'pass' }],
      [cf('fail'), { name: 'lint', bucket: 'pass' }],
    ]);
    expect(await waitForChecks(s.opts)).toEqual({
      result: 'fail',
      failed: ['Cloudflare Pages'],
      pending: [],
    });
  });

  test('cancelled and skipped checks do not block', async () => {
    const s = checksScript([[cf('cancel'), { name: 'optional', bucket: 'skipping' }]]);
    expect(await waitForChecks(s.opts)).toMatchObject({ result: 'pass' });
  });

  test('still pending after 10 minutes: stops waiting and does not block', async () => {
    const s = checksScript([[cf('pending')]]);
    expect(await waitForChecks(s.opts)).toEqual({
      result: 'timeout',
      failed: [],
      pending: ['Cloudflare Pages'],
    });
    expect(s.polls.at(-1)).toBe(600_000);
  });

  test('no checks at all after the 2 minute grace period is fine', async () => {
    const s = checksScript([[]]);
    expect(await waitForChecks(s.opts)).toMatchObject({ result: 'none' });
    expect(s.polls.at(-1)).toBe(120_000);
  });

  test('lookup errors are retried; never reading the checks blocks', async () => {
    const flaky = checksScript([new Error('HTTP 502'), [cf('pass')]]);
    expect(await waitForChecks(flaky.opts)).toMatchObject({ result: 'pass' });
    const broken = checksScript([new Error('HTTP 401: Bad credentials')]);
    expect(await waitForChecks(broken.opts)).toMatchObject({
      result: 'fail',
      failed: ['checks unreadable: HTTP 401: Bad credentials'],
    });
  });

  test('checks are read with CHECKS_TOKEN, not the PR token', () => {
    const env = checksEnv({ GH_TOKEN: 'pat', CHECKS_TOKEN: 'ghs', GH_REPO: 'o/r' });
    expect(env).toEqual({ GH_TOKEN: 'ghs', GH_REPO: 'o/r' });
    expect(checksEnv({ GH_TOKEN: 'pat' })).toEqual({ GH_TOKEN: 'pat' });
  });

  for (const wf of ['sync-projects.yml', 'sync-library.yml', 'refresh-showcase.yml']) {
    test(`${wf}: GITHUB_TOKEN reads checks, RDWLABZ_PR_TOKEN creates and merges`, () => {
      const text = readFileSync(join('.github/workflows', wf), 'utf8');
      const job = text.slice(text.indexOf('\njobs:\n'));
      const perms = job.match(/\n {4}permissions:\n((?: {6}.+\n)+)/)?.[1] ?? '';
      expect(
        perms
          .trim()
          .split(/\s*\n\s*/)
          .sort(),
      ).toEqual(['checks: read', 'contents: read', 'pull-requests: read', 'statuses: read']);
      expect(text).not.toMatch(/: write/);
      const steps = job.split(/\n {6}- /);
      const step = (name: string) => steps.find((s) => s.startsWith(`name: ${name}`)) ?? '';
      const merge = step('Auto-merge');
      expect(merge).toContain('CHECKS_TOKEN: ${{ github.token }}');
      expect(merge).toContain('GH_TOKEN: ${{ secrets.RDWLABZ_PR_TOKEN }}');
      expect(merge).toContain('node scripts/wait-pr-checks.mjs');
      expect(merge).toContain('gh pr merge');
      const pr = step('Open or update');
      expect(pr).toContain('GH_TOKEN: ${{ secrets.RDWLABZ_PR_TOKEN }}');
      expect(pr).not.toContain('github.token');
    });
  }
});
