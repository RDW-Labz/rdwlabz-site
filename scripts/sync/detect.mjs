// Pure detectors: read a repo's file list + a few small config files, return store ids,
// a category guess and the best app-icon path. No network here (see stores.mjs).

const SKIP_DIR = /(^|\/)(node_modules|Pods|build|dist|\.gradle|\.git|vendor|Library|Temp)\//;
const PKG = /^[A-Za-z][\w]*(\.[A-Za-z][\w-]*)+$/;

/** Config files worth fetching, by basename. */
const CONFIG_NAMES = new Set([
  'build.gradle',
  'build.gradle.kts',
  'gradle.properties',
  'app.json',
  'app.config.js',
  'app.config.ts',
  'app.config.json',
  'capacitor.config.json',
  'capacitor.config.ts',
  'project.pbxproj',
  'Info.plist',
  'steam_appid.txt',
  'fabric.mod.json',
  'quilt.mod.json',
]);

const base = (p) => p.slice(p.lastIndexOf('/') + 1);
const depth = (p) => p.split('/').length;

/**
 * Pick which files to download. `tree` is GitHub's recursive tree: [{ path, type, size }].
 * @param {{ path: string, type: string, size?: number }[]} tree
 */
export function pickFiles(tree, max = 20) {
  const picked = tree
    .filter((f) => f.type === 'blob' && !SKIP_DIR.test(f.path) && (f.size ?? 0) <= 300_000)
    .filter((f) => {
      const b = base(f.path);
      if (b === 'package.json') return f.path === 'package.json';
      if (b === 'Info.plist') return !/tests?\//i.test(f.path) && /(^|\/)ios\//i.test(f.path);
      return CONFIG_NAMES.has(b) && depth(f.path) <= 6;
    })
    .map((f) => f.path)
    .sort((a, b) => depth(a) - depth(b));
  return picked.slice(0, max);
}

const firstMatch = (text, re) => text.match(re)?.[1];
const files = (all, name) =>
  Object.entries(all)
    .filter(([p]) => base(p) === name)
    .sort(([a], [b]) => depth(a) - depth(b));
const parseJson = (t) => {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
};

/** Android applicationId: Gradle (app module first) > Capacitor > Expo. */
export function androidAppId(all) {
  const gradle = [...files(all, 'build.gradle'), ...files(all, 'build.gradle.kts')].sort(
    ([a], [b]) => Number(/(^|\/)app\//.test(b)) - Number(/(^|\/)app\//.test(a)),
  );
  for (const [, t] of gradle) {
    const id = firstMatch(t, /applicationId\s*(?:=\s*)?["']([\w.]+)["']/);
    if (id && PKG.test(id)) return id;
  }
  return capacitorId(all) ?? expoIds(all).android ?? null;
}

/** iOS bundle id: Xcode project > Info.plist > Capacitor > Expo. */
export function iosBundleId(all) {
  for (const [, t] of files(all, 'project.pbxproj')) {
    const ids = [...t.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = "?([\w.-]+)"?;/g)]
      .map((m) => m[1])
      .filter((id) => PKG.test(id) && !/tests?$/i.test(id) && !/\.(widget|extension)/i.test(id));
    if (ids.length) return ids.sort((a, b) => a.length - b.length)[0];
  }
  for (const [, t] of files(all, 'Info.plist')) {
    const id = firstMatch(t, /<key>CFBundleIdentifier<\/key>\s*<string>([^<$]+)<\/string>/);
    if (id && PKG.test(id.trim())) return id.trim();
  }
  return capacitorId(all) ?? expoIds(all).ios ?? null;
}

function capacitorId(all) {
  for (const [, t] of files(all, 'capacitor.config.json')) {
    const id = parseJson(t)?.appId;
    if (typeof id === 'string' && PKG.test(id)) return id;
  }
  for (const [, t] of files(all, 'capacitor.config.ts')) {
    const id = firstMatch(t, /appId\s*:\s*["']([\w.]+)["']/);
    if (id && PKG.test(id)) return id;
  }
  return null;
}

function expoIds(all) {
  const out = { android: null, ios: null };
  for (const name of ['app.json', 'app.config.json']) {
    for (const [, t] of files(all, name)) {
      const j = parseJson(t);
      const cfg = j?.expo ?? j;
      out.android ??= PKG.test(cfg?.android?.package ?? '') ? cfg.android.package : null;
      out.ios ??= PKG.test(cfg?.ios?.bundleIdentifier ?? '') ? cfg.ios.bundleIdentifier : null;
    }
  }
  for (const name of ['app.config.js', 'app.config.ts']) {
    for (const [, t] of files(all, name)) {
      out.android ??= firstMatch(t, /package\s*:\s*["']([\w.]+)["']/) ?? null;
      out.ios ??= firstMatch(t, /bundleIdentifier\s*:\s*["']([\w.]+)["']/) ?? null;
    }
  }
  return out;
}

export function steamAppId(all) {
  for (const [, t] of files(all, 'steam_appid.txt')) {
    const id = firstMatch(t, /^\s*(\d{3,10})\s*$/);
    if (id) return id;
  }
  return null;
}

const gradleTexts = (all) =>
  [...files(all, 'build.gradle'), ...files(all, 'build.gradle.kts')].map(([, t]) => t);
const propsTexts = (all) => files(all, 'gradle.properties').map(([, t]) => t);

/** Modrinth project id or slug (Minotaur `modrinth { projectId = ... }` or gradle.properties). */
export function modrinthId(all) {
  for (const t of propsTexts(all)) {
    const id = firstMatch(t, /^\s*modrinth(?:_project)?_id\s*=\s*([\w-]+)\s*$/m);
    if (id) return id;
  }
  for (const t of gradleTexts(all)) {
    const id = firstMatch(t, /modrinth\s*\{[\s\S]*?projectId(?:\.set\()?\s*=?\s*["']([\w-]+)["']/);
    if (id) return id;
  }
  return null;
}

/** CurseForge numeric project id (gradle.properties or a `curseforge { }` block). */
export function curseforgeId(all) {
  for (const t of propsTexts(all)) {
    const id = firstMatch(t, /^\s*(?:curseforge|cf)(?:_project)?_id\s*=\s*(\d{3,})\s*$/m);
    if (id) return id;
  }
  for (const t of gradleTexts(all)) {
    const id = firstMatch(t, /curseforge\s*\{[\s\S]*?(?:projectId|id)\s*(?:=|\()?\s*["']?(\d{3,})/);
    if (id) return id;
  }
  return null;
}

export function detectIds(all) {
  return {
    androidId: androidAppId(all),
    iosBundleId: iosBundleId(all),
    steamAppId: steamAppId(all),
    modrinthId: modrinthId(all),
    curseforgeId: curseforgeId(all),
  };
}

const TOPIC_CATEGORY = {
  game: 'games',
  games: 'games',
  mod: 'mods',
  mods: 'mods',
  'minecraft-mod': 'mods',
  'asset-pack': 'asset-packs',
  'asset-packs': 'asset-packs',
  assets: 'asset-packs',
  software: 'software',
  app: 'software',
  tool: 'software',
};
const ASSET_EXT =
  /\.(png|jpe?g|webp|gif|psd|aseprite|ase|kra|svg|fbx|obj|blend|glb|gltf|wav|ogg|mp3|flac|ttf|otf|tga|exr)$/i;
const CODE_EXT = /\.(js|ts|tsx|jsx|mjs|java|kt|kts|swift|cs|cpp|c|h|py|rs|go|gd|lua|dart|rb)$/i;
const GAME_DEPS =
  /"(phaser|pixi\.js|excalibur|kaboom|kaplay|@babylonjs\/core|three|playcanvas|melonjs)"\s*:/;

/** @param {string[]} [topics] */
export function categoryFromTopics(topics = []) {
  for (const t of topics) if (TOPIC_CATEGORY[t]) return TOPIC_CATEGORY[t];
  return null;
}

/**
 * Topics win; then file signals; default software.
 * @param {{ topics?: string[], paths?: string[], files?: Record<string, string> }} input
 */
export function guessCategory({ topics = [], paths = [], files: all = {} }) {
  const fromTopics = categoryFromTopics(topics);
  if (fromTopics) return fromTopics;
  const has = (re) => paths.some((p) => re.test(p));
  if (
    has(
      /(^|\/)(fabric|quilt)\.mod\.json$|(^|\/)META-INF\/(neoforge\.)?mods\.toml$|(^|\/)(paper-)?plugin\.yml$|\.es[mp]$/,
    )
  )
    return 'mods';
  if (
    has(
      /(^|\/)project\.godot$|(^|\/)ProjectSettings\/ProjectVersion\.txt$|\.uproject$|(^|\/)steam_appid\.txt$/,
    )
  )
    return 'games';
  if (GAME_DEPS.test(all['package.json'] ?? '')) return 'games';
  const blobs = paths.filter((p) => !SKIP_DIR.test(p));
  const assets = blobs.filter((p) => ASSET_EXT.test(p)).length;
  if (blobs.length >= 5 && !blobs.some((p) => CODE_EXT.test(p)) && assets / blobs.length >= 0.6)
    return 'asset-packs';
  return 'software';
}

const ICON_RANKS = [
  /(^|\/)res\/mipmap-xxxhdpi\/ic_launcher\.(png|webp)$/,
  /AppIcon\.appiconset\/[^/]*1024[^/]*\.png$/i,
  /(^|\/)(assets|resources)\/icon(-only)?\.png$/,
  /(^|\/)res\/mipmap-xxhdpi\/ic_launcher\.(png|webp)$/,
  /(^|\/)src\/main\/resources\/(assets\/[\w-]+\/)?(icon|logo)\.png$/,
  /(^|\/)(public|static)\/(icon|app-icon|logo)(-512)?\.png$/,
  /^icon\.(png|svg)$/,
];

/** Best app icon in the repo: platform launcher icons first, then common locations. */
export function findRepoIcon(tree, all = {}) {
  const blobs = tree.filter((f) => f.type === 'blob' && !SKIP_DIR.test(f.path));
  const expoIcon = (() => {
    const j = parseJson(all['app.json'] ?? '');
    const icon = (j?.expo ?? j)?.icon;
    return typeof icon === 'string' ? icon.replace(/^\.\//, '') : null;
  })();
  if (expoIcon && blobs.some((f) => f.path === expoIcon)) return expoIcon;
  for (const re of ICON_RANKS) {
    const hits = blobs.filter((f) => re.test(f.path)).sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
    if (hits.length) return hits[0].path;
  }
  return null;
}
