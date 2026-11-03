// Workbench sound: offline-rendered samples (tools/make_sounds.py) played through WebAudio.
// Off by default; nothing is fetched until the visitor turns sound on.
const BASE = 'sfx/';
const KEY_DOWN = 8, KEY_UP = 4;
const NAMES = [
  ...Array.from({ length: KEY_DOWN }, (_, i) => `key_down_${i}`), ...Array.from({ length: KEY_UP }, (_, i) => `key_up_${i}`),
  'key_space_down', 'key_space_up', 'key_enter_down', 'key_enter_up', 'key_back_down', 'key_back_up',
  'crt_poweron', 'crt_whine_15k', 'crt_hum', 'room_tone', 'floppy_seek', 'floppy_insert',
  'slide_tick', 'dive_whoosh', 'hover_static', 'glass_tap', 'beep_error', 'chime_ok',
];
const dB = (x) => Math.pow(10, x / 20);
const rnd = (a, b) => a + Math.random() * (b - a);

export function makeSound({ reduced = false, mobile = false } = {}) {
  let ctx = null, on = false, loading = null, vol = 0.8, whineOn = true, whineT0 = 0;
  const buf = {}; let rev = null;
  let master, comp, bus = {}, loops = {}, keyVerb = null, keySend = null;
  let lastDown = -1, lastRelease = 0, lastHover = 0, hidden = false, prevLum = 0, spike = 0;
  const ext = (() => { try { const a = document.createElement('audio'); return a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3'; } catch (e) { return 'mp3'; } })();

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return false; } }
    master = ctx.createGain(); master.gain.value = vol;
    // gentle glue compressor feeding a brick-wall-ish limiter
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.15;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.06;
    master.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
    for (const [k, g] of [['keys', 0.9], ['crt', 0.8], ['floppy', 0.7], ['ui', 0.7], ['amb', 1.0]]) { bus[k] = ctx.createGain(); bus[k].gain.value = g; bus[k].connect(master); }
    // keys get a short (120 ms) room tail, only while the CRT hum is running
    try {
      const n = Math.round(ctx.sampleRate * 0.12), ir = ctx.createBuffer(2, n, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0; for (let i = 1; i < n; i++) { lp += 0.45 * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-i / (ctx.sampleRate * 0.03)); } }
      keyVerb = ctx.createConvolver(); keyVerb.buffer = ir; keySend = ctx.createGain(); keySend.gain.value = 0;
      bus.keys.connect(keySend); keySend.connect(keyVerb); keyVerb.connect(master);
    } catch (e) { keySend = null; }
    return true;
  }
  async function load(name) {
    const r = await fetch(BASE + name + '.' + ext); if (!r.ok) throw new Error(name);
    const ab = await r.arrayBuffer();
    return new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
  }
  function loadAll() {
    if (loading) return loading;
    // the power-on and the keys first, the rest after
    const first = ['crt_poweron', 'key_down_0', 'key_down_1', 'key_up_0', 'crt_hum', 'room_tone'];
    const rest = NAMES.filter((n) => !first.includes(n));
    const grab = (n) => load(n).then((b) => { buf[n] = b; }).catch(() => { /* a missing sample just stays silent */ });
    loading = Promise.all(first.map(grab)).then(() => Promise.all(rest.map(grab))).then(() => {
      if (buf.dive_whoosh) {   // the way back is the whoosh reversed
        const b = buf.dive_whoosh; rev = ctx.createBuffer(1, b.length, b.sampleRate);
        const s = b.getChannelData(0), d = rev.getChannelData(0); for (let i = 0; i < s.length; i++) d[i] = s[s.length - 1 - i];
      }
    });
    return loading;
  }
  function play(name, { busName = 'ui', gain = 0, rate = 1, pan = 0, when = 0, b = null } = {}) {
    if (!on || !ctx || hidden) return null;
    const buffer = b || buf[name]; if (!buffer) return null;
    const src = ctx.createBufferSource(); src.buffer = buffer; src.playbackRate.value = rate;
    const g = ctx.createGain(); g.gain.value = dB(gain);
    src.connect(g);
    if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(bus[busName]); } else g.connect(bus[busName]);
    src.start(ctx.currentTime + Math.max(0, when));
    return src;
  }
  function loop(name, busName, gain) {
    if (loops[name] || !buf[name]) return;
    const src = ctx.createBufferSource(); src.buffer = buf[name]; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(bus[busName]); src.start();
    g.gain.setTargetAtTime(dB(gain), ctx.currentTime, 0.4);
    loops[name] = { src, g, base: gain };
  }
  function unloop(name) { const l = loops[name]; if (!l) return; l.g.gain.setTargetAtTime(0, ctx.currentTime, 0.08); const s = l.src; setTimeout(() => { try { s.stop(); } catch (e) { /* stopped */ } }, 400); delete loops[name]; }
  function startAmbience() {
    loop('room_tone', 'amb', 0);
    if (!mobile) loop('crt_hum', 'crt', 0);
    setWhine(whineOn);
  }
  function setWhine(m) {
    whineOn = !!m; if (!on || !ctx) return;
    unloop('crt_whine_15k');
    if (mobile || m === 'off') return;
    whineT0 = ctx.currentTime; loop('crt_whine_15k', 'crt', -99);   // the sample sits at -51 dBFS; update() shapes the level
  }

  const onVis = () => { hidden = document.hidden; if (!ctx) return; if (hidden) ctx.suspend(); else if (on) ctx.resume(); };
  document.addEventListener('visibilitychange', onVis);

  return {
    get on() { return on; },
    get ready() { return !!loading; },
    get loaded() { return Object.keys(buf).length + '/' + NAMES.length + ' ' + ext + ' ' + (ctx ? ctx.state : '-') + ' loops:' + Object.keys(loops).join(','); },
    async toggle() {
      on = !on;
      if (on) {
        if (!ctx && !build()) { on = false; return false; }
        if (ctx.state === 'suspended') ctx.resume();
        const first = !loading;
        await loadAll().catch(() => {});
        if (!on) return false;
        startAmbience();
        if (first) this.powerOn();
      } else if (ctx) {
        Object.keys(loops).forEach(unloop);
        setTimeout(() => { if (!on && ctx) ctx.suspend(); }, 450);
      }
      return on;
    },
    setVolume(v) { vol = v; if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    get volume() { return vol; },
    setWhine,
    get whine() { return whineOn; },
    // ---- events
    key(code, pan = 0) {
      if (!on) return;
      const now = ctx.currentTime;
      // fast repeats get a little quieter and never identical
      const burst = now - lastRelease < 0.09 ? -1.5 : 0;
      let d, u;
      if (code === 'Space') { d = 'key_space_down'; u = 'key_space_up'; }
      else if (code === 'Enter' || code === 'NumpadEnter') { d = 'key_enter_down'; u = 'key_enter_up'; }
      else if (code === 'Backspace') { d = 'key_back_down'; u = 'key_back_up'; }
      else { let i; do { i = Math.floor(Math.random() * KEY_DOWN); } while (i === lastDown && KEY_DOWN > 1); lastDown = i; d = `key_down_${i}`; u = `key_up_${Math.floor(Math.random() * KEY_UP)}`; }
      const rate = 1 + rnd(-0.03, 0.03), g = rnd(-1.5, 1.5) + burst, jit = rnd(0, 0.004);
      play(d, { busName: 'keys', gain: g, rate, pan, when: jit });
      play(u, { busName: 'keys', gain: g - 1, rate: rate * rnd(0.99, 1.01), pan, when: jit + rnd(0.075, 0.115) });
      lastRelease = now;
    },
    powerOn() { play('crt_poweron', { busName: 'crt', gain: -2 }); if (loops.crt_whine_15k) whineT0 = ctx.currentTime + 1.0; },
    boot() { play('floppy_insert', { busName: 'floppy', pan: 0.1 }); play('crt_poweron', { busName: 'crt', gain: -3, when: 0.35 }); play('floppy_seek', { busName: 'floppy', gain: -3, when: 1.2, pan: 0.1 }); },
    seek() { play('floppy_seek', { busName: 'floppy', gain: -4, rate: rnd(0.97, 1.03), pan: 0.1 }); },
    slide() { play('slide_tick', { busName: 'crt', gain: rnd(-1, 1) }); },
    dive(dir) { if (reduced) return; play(null, { busName: 'ui', gain: -4, b: dir > 0 ? buf.dive_whoosh : rev }); },
    hover() { const t = performance.now(); if (t - lastHover < 600) return; lastHover = t; play('hover_static', { busName: 'ui', gain: -2 }); },
    tap(pan = 0) { play('glass_tap', { busName: 'ui', pan, rate: rnd(0.98, 1.02) }); },
    result(ok) { if (ok) play('chime_ok', { busName: 'ui', when: 0.12 }); else play('beep_error', { busName: 'ui', gain: -2, when: 0.08 }); },
    // per frame: hum fades in the room, ducks inside the screen, spikes with screen brightness
    update({ room = 1, lum = 0.5, inside = 0 }) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      // the flyback load jumps when the picture goes bright: a soft +4 dB hum swell that settles in ~0.6 s
      if (lum - prevLum > 0.18) spike = 1; prevLum = lum; spike *= 0.93;
      const h = loops.crt_hum; if (h) h.g.gain.setTargetAtTime(dB(-2) * room * (1 - 0.85 * inside) * (0.75 + 0.5 * lum) * (1 + 0.6 * spike), t, 0.08);
      if (keySend) keySend.gain.setTargetAtTime(loops.crt_hum ? dB(-12) : 0, t, 0.2);
      const r = loops.room_tone; if (r) r.g.gain.setTargetAtTime(dB(-1) * (0.6 + 0.4 * room) * (1 - 0.6 * inside), t, 0.3);
      // flyback whine: fades in over 1.5 s after power-on, then settles 6 dB lower over 20 s; -10 dB inside the screen
      const w = loops.crt_whine_15k; if (w) { const e = t - whineT0, fin = Math.min(1, e / 1.5), settle = dB(-6 * Math.min(1, Math.max(0, e - 1.5) / 20));
        w.g.gain.setTargetAtTime(fin * settle * (room > 0.5 ? 1 : 0.6) * dB(-10 * inside), t, 0.15); }
    },
    stop() {
      on = false; document.removeEventListener('visibilitychange', onVis);
      if (ctx) { Object.keys(loops).forEach(unloop); setTimeout(() => { try { ctx.close(); } catch (e) { /* closed */ } }, 450); }
    },
  };
}
