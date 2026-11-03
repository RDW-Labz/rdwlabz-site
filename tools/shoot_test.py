#!/usr/bin/env python3
"""Capture the redesign prototype and the Astro port with Playwright.

Usage:
  python3 tools/shoot_test.py --base http://localhost:8080 --out docs/redesign/before
  python3 tools/shoot_test.py --base http://localhost:4392 --out docs/redesign/after --about /about

Run the approved prototype export with `python3 -m http.server 8080` for a baseline, or point
--base at the Astro preview for the port. The prototype's test hooks (`window.__world`,
`window.__about`) are used below; the Astro port exposes the same hooks on `/` and `/about`.

Screens: home hero, the dive, every screen-world beat, the Dormant Red
project page, the PS5 full-video player, the About walk, plus the phone
(390x844) hero and project ring. Console errors and warnings are printed.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import Browser, ConsoleMessage, Page, async_playwright

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = ROOT / "docs" / "redesign" / "after"
DESKTOP = {"width": 1440, "height": 900}
PHONE = {"width": 390, "height": 844}
LAUNCH_ARGS = (
    ["--use-angle=metal"]
    if sys.platform == "darwin"
    else [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--ignore-gpu-blocklist",
    ]
)


def logs_for(page: Page, bucket: list[str]) -> None:
    def on_console(msg: ConsoleMessage) -> None:
        if msg.type in ("error", "warning"):
            bucket.append(f"{msg.type}: {msg.text[:400]}")

    page.on("console", on_console)
    page.on("pageerror", lambda err: bucket.append(f"pageerror: {str(err)[:400]}"))
    page.on("response", lambda r: bucket.append(f"HTTP {r.status} {r.url}") if r.status >= 400 else None)


async def wait_ready(page: Page) -> None:
    await page.wait_for_timeout(1200)
    # Boot overlay: click it to skip, then make sure the 8 s no-3D fallback did not win.
    boot = page.locator("#boot")
    if await boot.count():
        try:
            await boot.click(timeout=4000)
        except Exception:
            await page.evaluate("document.getElementById('boot')?.click()")
    try:
        await page.wait_for_function("window.__firstFrame > 0", timeout=90000)
    except Exception:
        if await page.locator("#site.nogl").count():
            btn = page.get_by_role("button", name="Show 3D anyway")
            if await btn.count():
                await btn.click()
                await page.wait_for_function("window.__firstFrame > 0", timeout=90000)
    await page.evaluate("(() => { const b = document.getElementById('boot'); if (b) { b.hidden = true; b.classList.add('out'); } })()")
    await page.wait_for_timeout(1200)


async def shot(page: Page, out: Path, name: str) -> None:
    path = out / f"{name}.png"
    await page.screenshot(path=str(path), timeout=120000)
    print(f"  {name}.png")


async def open_home(page: Page, base: str) -> None:
    await page.goto(f"{base}/?quality=high", wait_until="domcontentloaded")
    await wait_ready(page)
    await page.wait_for_function("!!window.__world", timeout=60000)
    await page.evaluate("window.__noSnap = 1")


async def jump_to(page: Page, y: float) -> None:
    await page.evaluate("(y) => window.scrollTo(0, y * window.innerHeight)", y)
    await page.wait_for_timeout(7000)


async def capture_home(page: Page, base: str, out: Path, prefix: str, phone: bool = False) -> None:
    print(f"{prefix} home")
    await open_home(page, base)
    await shot(page, out, f"{prefix}-home-hero")

    if not phone:
        print(f"{prefix} dive")
        await jump_to(page, 0.72)
        await shot(page, out, f"{prefix}-home-dive")

    info = await page.evaluate(
        "(() => ({ vh: innerHeight, ids: window.__world.beats.map(b => b.id) }))()"
    )
    beats = info["ids"]
    print(f"{prefix} beats: {', '.join(beats)}")
    for i, bid in enumerate(beats):
        if phone and i not in (0, 4, 10):
            continue
        await page.evaluate(
            "(i) => window.scrollTo(0, window.__world.heroY(i) * window.innerHeight)", i
        )
        await page.wait_for_timeout(9000)
        await shot(page, out, f"{prefix}-beat-{i + 1:02d}-{bid}")

    if phone:
        return

    print(f"{prefix} project page")
    await page.evaluate("(i) => window.scrollTo(0, window.__world.heroY(i) * window.innerHeight)", 0)
    await page.wait_for_timeout(7000)
    await page.evaluate("window.__world.beats[0].inst.openPage(1)")
    await page.wait_for_function("!!window.__world.page", timeout=60000)
    await page.wait_for_timeout(5000)
    await shot(page, out, f"{prefix}-project-dormant-red")

    print(f"{prefix} ps5 player")
    await page.evaluate("window.__world.beats[0].inst.closePage()")
    await page.wait_for_function("!window.__world.busy()", timeout=30000)
    await page.wait_for_timeout(1500)
    await page.evaluate("(i) => window.scrollTo(0, window.__world.heroY(i) * window.innerHeight)", 0)
    await page.wait_for_timeout(4000)
    await page.evaluate("window.__world.beats[0].inst.openPage(12)")
    await page.wait_for_function("!!window.__world.page", timeout=60000)
    await page.wait_for_timeout(4000)
    # Move to the film frame and use the real DOM play button.
    await page.evaluate("window.__world.page.scrollTo(1)")
    await page.wait_for_timeout(5000)
    play = page.locator(".pp-play")
    if not await play.count():
        await page.evaluate("window.__world.page.scrollTo(0.8)")
        await page.wait_for_timeout(4000)
    try:
        await play.click(timeout=8000)
    except Exception:
        await page.evaluate("window.__world.page.openFilm(document.querySelector('.pp-play'))")
    await page.wait_for_selector(".pp-film", timeout=10000)
    await page.wait_for_timeout(4000)
    await shot(page, out, f"{prefix}-ps5-video-player")
    await page.keyboard.press("Escape")
    await page.wait_for_timeout(1000)
    await page.evaluate("window.__world.beats[0].inst.closePage()")
    await page.wait_for_timeout(1000)


async def capture_about(page: Page, about_path: str, out: Path, prefix: str) -> None:
    print(f"{prefix} about")
    await page.goto(about_path, wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    try:
        await page.wait_for_function("!!window.__about", timeout=60000)
    except Exception:
        pass
    skip = page.locator("#aSkip")
    if await skip.count():
        try:
            await skip.click(timeout=4000)
        except Exception:
            await page.evaluate("document.getElementById('aSkip')?.click()")
    await page.wait_for_timeout(1000)
    try:
        await page.evaluate("window.__about._debug.target = 0.5")
    except Exception:
        pass
    await page.wait_for_timeout(5000)
    await shot(page, out, f"{prefix}-about-walk")
    # The plain paper version at the end of the walk.
    await page.evaluate("window.__about && (window.__about._debug.target = 1)")
    await page.wait_for_timeout(4000)
    await shot(page, out, f"{prefix}-about-end")


async def run(browser: Browser, base: str, out: Path, about_path: str) -> list[str]:
    problems: list[str] = []

    ctx = await browser.new_context(viewport=DESKTOP, reduced_motion="no-preference")
    page = await ctx.new_page()
    logs: list[str] = []
    logs_for(page, logs)
    await capture_home(page, base, out, "desktop")
    await capture_about(page, about_path, out, "desktop")
    await ctx.close()
    problems.extend(f"desktop {m}" for m in logs)

    ctx = await browser.new_context(viewport=PHONE, reduced_motion="no-preference")
    page = await ctx.new_page()
    logs = []
    logs_for(page, logs)
    await capture_home(page, base, out, "phone", phone=True)
    await ctx.close()
    problems.extend(f"phone {m}" for m in logs)

    return problems


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.environ.get("BASE_URL", "http://localhost:8080"))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--about", default=None, help="About URL (default: <base>/#about)")
    ap.add_argument("--keep", action="store_true", help="do not clear the output folder")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if not args.keep:
        for png in out.glob("*.png"):
            png.unlink()
    about = args.about or f"{args.base}/#about"

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=LAUNCH_ARGS)
        try:
            problems = await run(browser, args.base, out, about)
        finally:
            await browser.close()

    bad = [p for p in problems if not p.startswith(("desktop warning", "phone warning"))]
    if problems:
        print("\nConsole/network notes:")
        for p in problems[:40]:
            print(" ", p)
    print(f"\nScreenshots: {out}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
