// Screen world: a tiny original 10-second loop in Dormant Red's dark-space look, drawn on a canvas (used as a CRT
// texture). Steer the ship, dodge drifting debris, keep the oxygen bar alive for 10 seconds. "attract" mode plays itself.
import * as THREE from 'three';
import { canvas, rng, clamp } from './util.js';

export function makeGame(W = 640, H = 480) {
  const c = canvas(W, H), x = c.getContext('2d'), r = rng(9);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  const stars = Array.from({ length: 70 }, () => [r() * W, r() * H, 0.2 + r() * 0.8]);
  const G = { canvas: c, tex: t, mode: 'attract', input: { x: 0, y: 0, tx: null, ty: null }, best: 0, msg: '', msgT: 0, onState: null };
  let ship, rocks, time, spawn, hit, done, acc = 0;
  const reset = () => { ship = { x: W * 0.22, y: H * 0.55, vx: 0, vy: 0 }; rocks = []; time = 10; spawn = 0; hit = 0; done = 0; };
  reset();
  G.start = () => { G.mode = 'play'; reset(); G.msg = 'GO'; G.msgT = 0.8; G.onState && G.onState('play'); };
  G.stop = () => { G.mode = 'attract'; reset(); G.onState && G.onState('attract'); };
  function step(dt) {
    const play = G.mode === 'play';
    if (!hit && !done) time -= dt;
    // steering: keyboard axis or a pointer target; attract mode dodges the nearest rock
    let ax = G.input.x, ay = G.input.y;
    if (play && G.input.tx !== null) { ax = clamp((G.input.tx - ship.x) / 60, -1, 1); ay = clamp((G.input.ty - ship.y) / 60, -1, 1); }
    if (!play) { const n = rocks.filter((k) => k.x > ship.x - 20 && k.x < ship.x + 170).sort((a, b) => Math.abs(a.y - ship.y) - Math.abs(b.y - ship.y))[0]; ay = n ? (n.y > ship.y ? -1 : 1) * (Math.abs(n.y - ship.y) < 70 ? 1 : 0) : (H * 0.55 - ship.y) / 120; ax = (W * 0.24 - ship.x) / 120; }
    ship.vx += (ax * 260 - ship.vx) * Math.min(1, dt * 8); ship.vy += (ay * 260 - ship.vy) * Math.min(1, dt * 8);
    ship.x = clamp(ship.x + ship.vx * dt, 24, W - 24); ship.y = clamp(ship.y + ship.vy * dt, 70, H - 30);
    spawn -= dt; if (spawn <= 0 && !done) { spawn = 0.28 + r() * 0.22; rocks.push({ x: W + 20, y: 80 + r() * (H - 110), v: 150 + r() * 170, rad: 9 + r() * 14, a: r() * 6, s: (r() - 0.5) * 3 }); }
    rocks.forEach((k) => { k.x -= k.v * dt; k.a += k.s * dt; });
    rocks = rocks.filter((k) => k.x > -40);
    if (!hit && !done) for (const k of rocks) { const dx = k.x - ship.x, dy = k.y - ship.y; if (dx * dx + dy * dy < (k.rad + 10) * (k.rad + 10)) { hit = 1.2; G.msg = 'HULL HIT'; G.msgT = 1.2; break; } }
    if (hit) { hit -= dt; if (hit <= 0) reset(); }
    if (time <= 0 && !done) { done = 1.8; G.best = Math.max(G.best, 10); G.msg = 'OXYGEN HELD · 10.0 s'; G.msgT = 1.8; }
    if (done) { done -= dt; if (done <= 0) reset(); }
    G.msgT = Math.max(0, G.msgT - dt);
  }
  function draw(now) {
    { const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1a1650'); g.addColorStop(0.6, '#2a1a5a'); g.addColorStop(1, '#5a2040'); x.fillStyle = g; x.fillRect(0, 0, W, H); const n = x.createRadialGradient(W * 0.75, H * 0.3, 0, W * 0.75, H * 0.3, W * 0.5); n.addColorStop(0, 'rgba(255,120,90,.28)'); n.addColorStop(1, 'rgba(255,120,90,0)'); x.fillStyle = n; x.fillRect(0, 0, W, H); }
    stars.forEach(([sx, sy, b]) => { x.fillStyle = `rgba(200,220,255,${b * 0.6})`; x.fillRect((sx - now * 20 * b) % W + (sx - now * 20 * b < 0 ? W : 0), sy, 2, 2); });
    // station hull outline (like the game's dark-room walls)
    x.strokeStyle = 'rgba(70,110,160,.55)'; x.lineWidth = 3; x.strokeRect(10, 60, W - 20, H - 70);
    x.fillStyle = 'rgba(40,70,110,.6)'; x.fillRect(W * 0.6, 120, 10, 140); x.fillRect(W * 0.38, H - 150, 10, 110);
    // oxygen bar + systems text
    x.fillStyle = '#9fd3ff'; x.font = '22px VT323'; x.fillText('OXYGEN', 24, 30);
    x.strokeStyle = '#9fd3ff'; x.lineWidth = 2; x.strokeRect(100, 14, 220, 20); x.fillStyle = '#4fb6ff'; x.fillRect(102, 16, 216 * clamp(time / 10), 16);
    x.fillStyle = '#e8eef8'; x.fillText(G.mode === 'play' ? `${Math.max(0, time).toFixed(1)} s` : 'DEMO', 332, 30);
    x.fillStyle = 'rgba(232,238,248,.8)'; x.fillText(G.mode === 'play' ? 'ARROWS / WASD / DRAG' : 'PRESS PLAY', W - 230, 30);
    // debris
    rocks.forEach((k) => { x.save(); x.translate(k.x, k.y); x.rotate(k.a); x.fillStyle = '#6b6f82'; x.beginPath(); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, rr = k.rad * (0.75 + ((i * 37) % 10) / 30); x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.fill(); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(-k.rad * 0.3, -k.rad * 0.4, k.rad * 0.4, k.rad * 0.25); x.restore(); });
    // ship: the game's little blue pod with a nose
    const blink = hit && Math.floor(now * 14) % 2;
    if (!blink) { x.fillStyle = '#5b8cff'; x.beginPath(); x.arc(ship.x, ship.y, 11, 0, Math.PI * 2); x.fill(); x.fillStyle = '#c8d6ff'; x.beginPath(); x.moveTo(ship.x - 22, ship.y - 8); x.lineTo(ship.x - 10, ship.y); x.lineTo(ship.x - 22, ship.y + 8); x.fill();
      x.fillStyle = 'rgba(255,170,80,.8)'; x.fillRect(ship.x - 30 - Math.random() * 6, ship.y - 2, 8, 4); }
    if (hit) { x.fillStyle = `rgba(255,60,50,${0.25 * hit})`; x.fillRect(0, 0, W, H); }
    if (G.msgT > 0) { x.fillStyle = hit ? '#ff6a50' : '#7FFFA0'; x.font = '54px VT323'; x.textAlign = 'center'; x.fillText(G.msg, W / 2, H / 2); x.textAlign = 'left'; }
  }
  G.update = (dt, now) => { acc += dt; if (acc < 1 / 40) return; step(Math.min(acc, 0.05)); acc = 0; draw(now); t.needsUpdate = true; };
  draw(0); t.needsUpdate = true;
  return G;
}
