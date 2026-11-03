#!/usr/bin/env python3
"""Pre-bake the heavy procedural maps and the computer light bake.

Runs the site's own canvas generators once in headless Chromium (window.__BAKE = true makes
tex.js hand every generated canvas to this script, and computer.js export the vertex light
bake), then writes:
  tex/<name>.webp      case / keycap / desk / detail / wall maps
  tex/lightbake.png    per-vertex AO + desk-bounce factors (Uint8 /200, packed in RGB)
  tex/env_rgb.png, env_m.png   the room's filtered (PMREM) environment as RGBM
Usage: python3 tools/bake_textures.py   (needs python playwright + chromium)
"""
import asyncio, base64, os, sys, mimetypes
from playwright.async_api import async_playwright

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')) + '/'
OUT = ROOT + 'tex/'
Q = {'normal': 0.92, 'albedo': 0.9, 'rough': 0.85}
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]

async def handler(route):
    u = route.request.url
    if u.startswith('http://site.local/'):
        path = ROOT + u[len('http://site.local/'):].split('#')[0].split('?')[0]
        if path.endswith('/'): path += 'index.html'
        try:
            body = open(path, 'rb').read(); ct = mimetypes.guess_type(path)[0] or 'application/octet-stream'
            if path.endswith('.js'): ct = 'text/javascript'
            await route.fulfill(status=200, body=body, headers={'content-type': ct})
        except Exception:
            await route.fulfill(status=404, body='nf')
    else:
        await route.continue_()

async def main():
    os.makedirs(OUT, exist_ok=True)
    page_html = ROOT + 'bake.html'
    with open(page_html, 'w') as f:   # the publishable index.html wrapped as a document
        f.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>')
        f.write(open(ROOT + 'index.html').read()); f.write('</body></html>')
    try:
        async with async_playwright() as pw:
            px = os.environ.get('HTTPS_PROXY')
            b = await pw.chromium.launch(args=ARGS, proxy={'server': px} if px else None)
            ctx = await b.new_context(viewport={'width': 1280, 'height': 800}); await ctx.route('**/*', handler)
            await ctx.add_init_script('window.__BAKE = true;')
            pg = await ctx.new_page(); pg.set_default_timeout(600000)
            await pg.goto('http://site.local/bake.html?quality=high')
            await pg.wait_for_function('window.__bakeDone === true', timeout=600000, polling=1000)
            await pg.wait_for_function('window.__bakeOut && window.__bakeOut.env_rgb && window.__bakeOut.wenv_rgb', timeout=600000, polling=1000)   # the world env is built just after the first frame
            names = await pg.evaluate('Object.keys(window.__bakeOut)')
            for n in names:
                if n == 'lightbake':
                    b64 = await pg.evaluate("(() => { const u = window.__bakeOut.lightbake; let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); })()")
                    raw = base64.b64decode(b64); data = len(raw).to_bytes(4, 'little') + raw   # packed into a lossless PNG (servable media type)
                    from PIL import Image; W = 1024; H = -(-len(data) // (3 * W)); data += bytes(W * H * 3 - len(data))
                    Image.frombytes('RGB', (W, H), data).save(OUT + 'lightbake.png', optimize=True); continue
                if n.startswith('env_') or n.startswith('wenv_'):
                    url = await pg.evaluate(f"window.__bakeOut[{n!r}].toDataURL('image/png')")
                    open(OUT + n + '.png', 'wb').write(base64.b64decode(url.split(',', 1)[1])); continue
                kind = n.rsplit('_', 1)[-1]; q = Q.get(kind, 0.88)
                url = await pg.evaluate(f"window.__bakeOut[{n!r}].toDataURL('image/webp', {q})")
                open(OUT + n + '.webp', 'wb').write(base64.b64decode(url.split(',', 1)[1]))
            await b.close()
    finally:
        os.remove(page_html)
    tot = 0
    for f in sorted(os.listdir(OUT)):
        sz = os.path.getsize(OUT + f); tot += sz; print(f'{f:28s} {sz/1024:8.1f} KB')
    print(f'total {tot/1024/1024:.2f} MB')

asyncio.run(main())
