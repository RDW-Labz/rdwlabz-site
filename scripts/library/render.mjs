// Headless previews for the Clay Asset Library: three.js in Playwright's Chromium renders the
// real models on a clay turntable; ffmpeg encodes the frames. Nothing here is mocked: every
// thumbnail and video frame is a render of the pack's own GLB files.
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PAGE = fileURLToPath(new URL('./render-page.html', import.meta.url));
const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';

export const VIDEO_MAX_BYTES = 1_500_000;
export const TURNTABLE = { seconds: 3, fps: 30, width: 640, height: 480 };
export const THUMB = { width: 800, height: 600 };
export const ASSET_THUMB = 256;
/** Bump when the studio look changes, so every preview is re-rendered. */
export const RENDER_VERSION = 1;

const hex = (h) => h.match(/[0-9a-f]{2}/gi).map((x) => parseInt(x, 16));
const mix = (a, b, t) =>
  '#' +
  hex(a)
    .map((v, i) => Math.round(v * (1 - t) + hex(b)[i] * t))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');

function studio(accent) {
  return {
    b1: mix(accent, '#fff6ea', 0.84),
    b2: mix(accent, '#fff6ea', 0.6),
    disc: '#ffe7c7',
    rim: '#1e1433',
  };
}

export async function createRenderer() {
  const models = new Map();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end(await readFile(PAGE));
      }
      if (url.pathname.startsWith('/m/') && models.has(url.pathname)) {
        res.writeHead(200, { 'content-type': 'model/gltf-binary' });
        return res.end(models.get(url.pathname));
      }
      if (url.pathname.startsWith('/three/') && !url.pathname.includes('..')) {
        const file = join(ROOT, 'node_modules', url.pathname.slice(1));
        res.writeHead(200, { 'content-type': 'text/javascript' });
        return res.end(await readFile(file));
      }
      res.writeHead(404).end();
    } catch {
      res.writeHead(500).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base);
  await page.waitForFunction(() => window.ready === true);
  let n = 0;

  async function setup(glbs, size, accent) {
    models.clear();
    const urls = glbs.map((g) => {
      const path = `/m/${n++}.glb`;
      models.set(path, Buffer.from(g));
      return path;
    });
    errors.length = 0;
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.evaluate((o) => /** @type {any} */ (window).setup(o), {
      models: urls,
      ...size,
      ...studio(accent),
    });
    if (errors.length) throw new Error(`render page: ${errors.join('; ')}`);
  }
  const shot = async (deg) => {
    await page.evaluate((d) => /** @type {any} */ (window).frame(d), deg);
    return page.locator('#stage').screenshot({ type: 'png' });
  };

  return {
    /** Pack card art: thumbnail (WebP) + seamless turntable loop (WebM + MP4, each ≤ 1.5 MB). */
    async renderPack(glbs, accent, out) {
      await setup(glbs, THUMB, accent);
      const start = -24;
      await writeFile(
        out.thumb,
        await sharp(await shot(start))
          .webp({ quality: 80 })
          .toBuffer(),
      );
      const frames = TURNTABLE.seconds * TURNTABLE.fps;
      const dir = await mkdtemp(join(tmpdir(), 'rdw-turntable-'));
      try {
        for (let i = 0; i < frames; i++) {
          const png = await shot(start + (360 * i) / frames);
          await writeFile(join(dir, `${String(i).padStart(4, '0')}.png`), png);
        }
        await encode(dir, out.webm, out.mp4);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    /** One model, small square WebP for the pack's contents list. */
    async renderAsset(glb, accent) {
      await setup([glb], { width: ASSET_THUMB * 2, height: ASSET_THUMB * 2 }, accent);
      const png = await shot(-24);
      return sharp(png).resize(ASSET_THUMB, ASSET_THUMB).webp({ quality: 76 }).toBuffer();
    },
    async close() {
      await browser.close();
      server.close();
    },
  };
}

async function encode(dir, webm, mp4) {
  const input = [
    '-y',
    '-loglevel',
    'error',
    '-framerate',
    String(TURNTABLE.fps),
    '-i',
    join(dir, '%04d.png'),
  ];
  const scale = ['-vf', `scale=${TURNTABLE.width}:${TURNTABLE.height}:flags=lanczos`, '-an'];
  for (let attempt = 0, crf = 0; attempt < 4; attempt++, crf += 4) {
    await run(FFMPEG, [
      ...input,
      ...scale,
      '-c:v',
      'libvpx-vp9',
      '-b:v',
      '0',
      '-crf',
      String(38 + crf),
      '-row-mt',
      '1',
      '-deadline',
      'good',
      '-cpu-used',
      '2',
      '-pix_fmt',
      'yuv420p',
      webm,
    ]);
    await run(FFMPEG, [
      ...input,
      ...scale,
      '-c:v',
      'libx264',
      '-crf',
      String(27 + crf),
      '-preset',
      'slow',
      '-profile:v',
      'high',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      mp4,
    ]);
    const sizes = await Promise.all([stat(webm), stat(mp4)]);
    if (sizes.every((s) => s.size <= VIDEO_MAX_BYTES)) return;
  }
  throw new Error(`turntable over ${VIDEO_MAX_BYTES} bytes even at high compression`);
}
