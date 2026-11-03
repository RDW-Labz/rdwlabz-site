#!/usr/bin/env python3
"""RDW Labz workbench sound design.

Renders every sound the site uses, offline, with simple physical models
(noise-excited resonators, damped modal bodies, stepper ticks), places them
in one generated small-room impulse response, and writes 48 kHz mono files:

  sfx/<name>.ogg   (Vorbis, primary)
  sfx/<name>.mp3   (fallback for browsers without Ogg)
  sfx/report/      spectrogram + waveform PNGs, table.csv, typing demo

Run:  python3 tools/make_sounds.py        (needs numpy, scipy, matplotlib, ffmpeg)
Deterministic: every variant is seeded, so re-running gives the same files.
"""
import os, subprocess, csv, wave
import numpy as np
from scipy import signal

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', 'sfx'))
REP = os.path.join(OUT, 'report')
os.makedirs(REP, exist_ok=True)
TMP = os.path.join(REP, '_wav'); os.makedirs(TMP, exist_ok=True)

def db(x): return 10 ** (x / 20)
def T(sec): return int(round(sec * SR))
def t_axis(n): return np.arange(n) / SR

# ---------------------------------------------------------------- building blocks
def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'); return signal.sosfilt(sos, x)
def highpass(x, f, order=2):
    sos = signal.butter(order, f, 'highpass', fs=SR, output='sos'); return signal.sosfilt(sos, x)
def lowpass(x, f, order=2):
    sos = signal.butter(order, f, 'lowpass', fs=SR, output='sos'); return signal.sosfilt(sos, x)

def resonator(x, f, q):
    """Two-pole resonant filter (a struck mode excited by x)."""
    w = 2 * np.pi * f / SR; r = np.exp(-w / (2 * q))
    b = [1 - r]; a = [1, -2 * r * np.cos(w), r * r]
    return signal.lfilter(b, a, x)

def modes(n, spec, rng=None, jit=0.0):
    """Sum of exponentially damped sinusoids: spec = [(freq, decay_s, amp), ...]."""
    t = t_axis(n); y = np.zeros(n)
    for f, d, a in spec:
        if rng is not None and jit: f *= 1 + rng.uniform(-jit, jit); d *= 1 + rng.uniform(-jit, jit)
        ph = rng.uniform(0, 2 * np.pi) if rng is not None else 0
        y += a * np.exp(-t / d) * np.sin(2 * np.pi * f * t + ph)
    # 0.4 ms attack so modes never start with a step
    att = min(n, T(0.0004)); y[:att] *= np.linspace(0, 1, att)
    return y

def burst(n, rng, decay):
    return rng.standard_normal(n) * np.exp(-t_axis(n) / decay)

def place(buf, x, at, gain=1.0):
    x = x.copy(); k = max(1, len(x) // 5); x[-k:] *= np.cos(np.linspace(0, np.pi / 2, k)) ** 2   # no truncation clicks
    i = T(at); j = min(len(buf), i + len(x))
    if j > i: buf[i:j] += x[:j - i] * gain
    return buf

def fade(x, fin=0.0005, fout=0.01):
    a, b = T(fin), T(fout)
    if a: x[:a] *= np.linspace(0, 1, a)
    if b: x[-b:] *= np.linspace(1, 0, b)
    return x

# ---------------------------------------------------------------- the room + mic
def room_ir(seed=7, rt60=0.32):
    rng = np.random.default_rng(seed); n = T(0.45); ir = np.zeros(n)
    ir[0] = 1.0
    # early reflections: desk, near wall, monitor shell, ceiling
    for d_ms, g in [(1.6, .42), (3.9, .30), (6.8, .24), (9.5, .2), (13.2, .16), (17.8, .12), (23.1, .1)]:
        ir[T(d_ms / 1000)] += g * (1 if rng.random() > .5 else -1)
    # diffuse tail, darker as it decays (absorbing small room)
    t = t_axis(n); tail = rng.standard_normal(n) * np.exp(-6.91 * t / rt60) * 0.09
    tail[:T(0.012)] *= np.linspace(0, 1, T(0.012))
    lo = lowpass(tail, 5200); later = lowpass(tail, 1800)
    w = np.clip(t / 0.18, 0, 1)
    ir += lo * (1 - w) + later * w
    return ir

IR = room_ir()
def in_room(x, wet=0.14, circular=False):
    if circular:  # loops stay seamless
        n = len(x); h = np.zeros(n); h[:min(n, len(IR))] = IR[:n]
        r = np.real(np.fft.ifft(np.fft.fft(x) * np.fft.fft(h)))
        y = x * (1 - wet) + (r - x) * wet + x * wet
    else:
        r = signal.fftconvolve(x, IR)[:len(x) + T(0.3)]
        y = np.concatenate([x, np.zeros(len(r) - len(x))]) * (1 - wet) + r * wet
    # mic: gentle 35 Hz high-pass, soft air roll-off
    y = highpass(y, 35, 1) if not circular else y
    return y

def trim_tail(x, floor_db=-70):
    a = np.abs(x); thr = a.max() * db(floor_db); idx = np.where(a > thr)[0]
    end = min(len(x), (idx[-1] if len(idx) else len(x)) + T(0.01))
    return fade(x[:end].copy(), 0, 0.006)

def norm_peak(x, peak_db): return x / (np.abs(x).max() + 1e-12) * db(peak_db)
def norm_rms(x, rms_db): return x / (np.sqrt(np.mean(x ** 2)) + 1e-12) * db(rms_db)

# ---------------------------------------------------------------- keyswitches
def key_down(seed, kind='normal'):
    """Switch press: 2-5 ms broadband click, a short switch-housing resonance, the plastic
    body thock (300-700 Hz, ~30 ms) and a faint detuned spring partial. Nothing rings past ~80 ms."""
    rng = np.random.default_rng(seed); n = T(0.14); y = np.zeros(n)
    j = lambda f: f * (1 + rng.uniform(-0.12, 0.12))          # +-12 % per variant
    deep = {'normal': 1.0, 'space': 0.6, 'enter': 0.78, 'back': 0.82}[kind]
    cl = T(rng.uniform(0.002, 0.005))
    click = highpass(rng.standard_normal(cl) * np.hanning(cl), 700)
    place(y, click, 0.0, 0.9)
    place(y, modes(T(0.03), [(j(2600), 0.004, 1.0), (j(4100), 0.003, 0.5)], rng), 0.0005, 0.35)   # housing tick, damped fast
    bo = rng.uniform(0.007, 0.012) * (1.3 if kind == 'space' else 1)
    body = modes(T(0.12), [(j(330) * deep, 0.03, 1.0), (j(470) * deep, 0.026, 0.8), (j(650) * deep, 0.02, 0.55), (j(180) * deep, 0.034, 0.35), (j(1150), 0.006, 0.25)], rng)
    place(body, highpass(rng.standard_normal(T(0.004)) * np.hanning(T(0.004)), 400), 0, 0.3)
    place(y, body, bo, 0.85 if kind == 'normal' else 1.0)
    place(y, modes(T(0.09), [(rng.uniform(2800, 6500), rng.uniform(0.04, 0.08), 1.0)], rng), bo, db(-30))   # faint spring, detuned per variant
    if kind in ('space', 'enter', 'back'):
        for k in range(rng.integers(2, 4)):
            at = bo + 0.005 + k * rng.uniform(0.005, 0.009)
            place(y, modes(T(0.025), [(j(1500), 0.005, 1.0), (j(2500), 0.003, 0.6)], rng), at, db(-15 - 4 * k))
    return y

def key_up(seed, kind='normal'):
    rng = np.random.default_rng(seed + 991); n = T(0.09); y = np.zeros(n)
    j = lambda f: f * (1 + rng.uniform(-0.12, 0.12))
    deep = {'normal': 1.0, 'space': 0.62, 'enter': 0.8, 'back': 0.84}[kind]
    cl = T(rng.uniform(0.0015, 0.003))
    place(y, highpass(rng.standard_normal(cl) * np.hanning(cl), 900), 0.0, 0.45)
    place(y, modes(T(0.06), [(j(420) * deep, 0.022, 1.0), (j(610) * deep, 0.016, 0.6), (j(1500), 0.004, 0.3)], rng), rng.uniform(0.002, 0.005), 0.35)
    if kind != 'normal':
        place(y, modes(T(0.02), [(j(1600), 0.004, 1)], rng), 0.01, db(-18))
    return y

# ---------------------------------------------------------------- CRT
def crt_poweron():
    """Relay clack (10 ms) -> degauss buzz (60 Hz + harmonics to ~2 kHz, dying over 1.5 s)
    -> sparse crackle impulses 20-60 ms apart as the beam comes up. The flyback whine is added after levelling."""
    rng = np.random.default_rng(31); n = T(2.4); y = np.zeros(n); t = t_axis(n)
    clack = modes(T(0.03), [(2700, 0.0025, 1.0), (4300, 0.002, 0.6), (130, 0.008, 0.8)], rng)
    place(clack, highpass(rng.standard_normal(T(0.003)) * np.hanning(T(0.003)), 1000), 0, 0.6)
    place(y, clack, 0.0, 1.0)
    m = T(1.9); tt = t_axis(m)
    env = (1 - np.exp(-tt / 0.02)) * np.exp(-tt / 0.48)          # ~1.5 s to near silence
    buzz = sum((1 / k ** 0.7) * np.sin(2 * np.pi * 60 * k * tt + 0.7 * k) for k in range(1, 34))
    buzz = np.tanh(buzz * 0.5) * 1.4                               # a little magnetostrictive grit
    buzz = lowpass(buzz, 2100, 4) * env
    place(y, buzz, 0.03, 0.55)
    at = 0.45
    while at < 2.2:
        imp = modes(T(0.012), [(rng.uniform(2800, 5200), 0.0018, 1.0), (rng.uniform(700, 1400), 0.003, 0.4)], rng)
        dens = np.exp(-((at - 1.1) / 0.45) ** 2)
        place(y, imp, at, (0.15 + 0.35 * dens) * db(rng.uniform(-6, 6)) * (1 if rng.random() > 0.5 else -1))   # +-6 dB per impulse
        at += rng.uniform(0.02, 0.14)                                                                     # gaps 20-140 ms
    return y

def poweron_whine(n):
    t = t_axis(n); w = whine(15734, n / SR)[:n] if False else np.sin(2 * np.pi * 15734 * t)
    return w * db(-45) * np.sqrt(2) * np.clip((t - 1.0) / 1.2, 0, 1)

def whine(freq, secs=1.0):
    n = T(secs); t = t_axis(n)
    # exact integer cycles per loop -> seamless; a hair of periodic FM (flyback load wobble)
    fm = 2 * np.sin(2 * np.pi * 3 * t) / (2 * np.pi * 3)
    return np.sin(2 * np.pi * freq * t + 2 * np.pi * fm)

def periodic_noise(n, rng, shape):
    """Noise whose spectrum is shaped by shape(f); FFT-generated so it loops perfectly."""
    f = np.fft.rfftfreq(n, 1 / SR); mag = shape(f); ph = rng.uniform(0, 2 * np.pi, len(f))
    return np.fft.irfft(mag * np.exp(1j * ph), n)

def crt_hum(secs=6.0):
    rng = np.random.default_rng(41); n = T(secs); t = t_axis(n)
    y = sum(a * np.sin(2 * np.pi * 60 * k * t + rng.uniform(0, 6)) for k, a in [(1, 1.0), (2, .55), (3, .35), (4, .18), (5, .12), (6, .07), (8, .04)])
    # slow breathing of the transformer (0.5 Hz: integer cycles in 6 s)
    y *= 1 + 0.08 * np.sin(2 * np.pi * 0.5 * t)
    y += periodic_noise(n, rng, lambda f: np.where((f > 80) & (f < 900), 1 / np.maximum(f, 1) ** 0.5, 0)) * 3
    return y

def room_tone(secs=6.0):
    rng = np.random.default_rng(43); n = T(secs)
    return periodic_noise(n, rng, lambda f: np.where(f > 25, 1 / np.maximum(f, 1) ** 0.9, 0) * np.exp(-f / 2500))

# ---------------------------------------------------------------- floppy
def stepper_tick(rng):
    return modes(T(0.03), [(rng.uniform(850, 1000), 0.006, 1), (rng.uniform(1700, 2000), 0.004, .6), (rng.uniform(3200, 3700), 0.002, .35), (260, 0.01, .4)], rng)

def floppy_seek():
    rng = np.random.default_rng(51); n = T(0.75); y = np.zeros(n); t = t_axis(n)
    at = 0.03
    for k in range(14):
        place(y, stepper_tick(rng), at, 0.7 * rng.uniform(0.85, 1.1))
        at += rng.uniform(0.0085, 0.0115) if k < 9 else rng.uniform(0.02, 0.03)
    # spindle motor whir under the ticks
    whir = bandpass(rng.standard_normal(n), 280, 620) * 0.08 * np.clip(t / 0.05, 0, 1) * np.exp(-np.maximum(t - 0.5, 0) / 0.08)
    whir *= 1 + 0.3 * np.sin(2 * np.pi * 300 / 60 * 5 * t)
    y += whir
    # head load thunk
    place(y, modes(T(0.12), [(150, 0.03, 1), (230, 0.02, .6), (1400, 0.004, .3)], rng), at + 0.02, 0.9)
    return y

def floppy_insert():
    rng = np.random.default_rng(53); n = T(0.5); y = np.zeros(n)
    slide = bandpass(rng.standard_normal(T(0.12)), 900, 4000) * np.hanning(T(0.12)) * 0.12
    place(y, slide, 0.0)
    place(y, modes(T(0.08), [(1900, 0.006, 1), (3100, 0.004, .6), (520, 0.012, .5)], rng), 0.12, 0.8)     # latch
    place(y, modes(T(0.15), [(170, 0.04, 1), (260, 0.025, .6), (2400, 0.003, .3)], rng), 0.135, 0.8)   # disk drops onto the hub
    place(y, modes(T(0.05), [(1250, 0.006, 1), (2600, 0.003, .5)], rng), 0.24, 0.35)                  # shutter spring
    return y

# ---------------------------------------------------------------- UI bits
def slide_tick():
    rng = np.random.default_rng(61); n = T(0.22); y = np.zeros(n); t = t_axis(n)
    place(y, modes(T(0.05), [(1150, 0.006, 1), (2300, 0.003, .5), (90, 0.02, .6)], rng), 0.0, 0.7)
    y += highpass(rng.standard_normal(n), 3200) * 0.09 * np.exp(-t / 0.045)
    return y

def dive_whoosh(secs=1.8, pk=0.59):
    rng = np.random.default_rng(71); n = T(secs); t = t_axis(n); x = rng.standard_normal(n)
    y = np.zeros(n); blk = 240; zi = None
    for s in range(0, n, blk):
        u = (s + blk / 2) / n
        fc = 260 * (3200 / 260) ** (u ** 1.4)             # rises into the screen
        bw = fc * (0.9 - 0.55 * u)                          # narrows as it band-passes in
        sos = signal.butter(2, [max(40, fc - bw / 2), min(SR / 2 - 100, fc + bw / 2)], 'bandpass', fs=SR, output='sos')
        if zi is None: zi = signal.sosfilt_zi(sos) * 0
        y[s:s + blk], zi = signal.sosfilt(sos, x[s:s + blk], zi=zi)
    r = np.sqrt(np.convolve(y ** 2, np.ones(T(0.08)) / T(0.08), 'same')) + 1e-6; y = y / r * 0.25   # flatten the band-pass power so the envelope alone sets the peak
    u = t / secs; env = np.where(u < pk, (u / pk) ** 2.2, np.exp(-((u - pk) / 0.14) ** 2)) * np.clip((secs - t) / 0.05, 0, 1)   # peaks at 60 %: the moment the snap (1.8 s, ease-in-out to 1.2 vh) crosses the glass
    tone = np.sin(2 * np.pi * np.cumsum(180 * (3200 / 180) ** ((t / secs) ** 1.6)) / SR) * 0.04 * env
    return y * env + tone

def hover_static():
    rng = np.random.default_rng(81); n = T(0.2); t = t_axis(n)
    imp = (rng.random(n) < 1500 / SR) * rng.standard_normal(n)
    y = highpass(resonator(imp, 5200, 1.2) + 0.3 * rng.standard_normal(n) * 0.06, 2500)
    return y * np.sin(np.pi * t / t[-1]) ** 2

def glass_tap():
    rng = np.random.default_rng(83); n = T(0.18)
    y = modes(n, [(1780, 0.02, 1), (3120, 0.012, .6), (4730, 0.008, .4), (6900, 0.004, .25), (420, 0.015, .5)], rng)
    y += 0.2 * highpass(burst(n, rng, 0.0008), 2000)
    return y

def beep_error():
    n = T(0.32); t = t_axis(n)
    sq = sum(np.sin(2 * np.pi * 820 * k * t) / k for k in range(1, 12, 2))     # band-limited square
    y = lowpass(sq, 2600, 4) * np.clip(t / 0.004, 0, 1) * np.clip((t[-1] - t) / 0.01, 0, 1)
    return y

def chime_ok():
    n = T(0.6); t = t_axis(n); y = np.zeros(n)
    for at, f in [(0.0, 1046.5), (0.11, 1568.0)]:
        m = modes(T(0.45), [(f, 0.16, 1), (f * 2.0, 0.08, .25), (f * 3.01, 0.05, .1)])
        place(y, m, at, 1.0)
    return lowpass(y, 6000)

# ---------------------------------------------------------------- render + encode
SAMPLES = {}   # name -> (array, kind)
def add(name, x, peak=None, rms=None, room=0.14, loop=False):
    if loop: x = in_room(x, room, circular=True)
    else: x = trim_tail(in_room(fade(x.copy()), room))
    x = norm_rms(x, rms) if rms is not None else norm_peak(x, peak if peak is not None else -3)
    SAMPLES[name] = (x.astype(np.float32), loop)

_lv = np.random.default_rng(9)
for i in range(8): add(f'key_down_{i}', key_down(100 + i), -5 - 6 * _lv.random(), room=0.0)
for i in range(4): add(f'key_up_{i}', key_up(200 + i), -13 - 4 * _lv.random(), room=0.0)
add('key_space_down', key_down(300, 'space'), -5, room=0.0); add('key_space_up', key_up(301, 'space'), -13, room=0.0)
add('key_enter_down', key_down(310, 'enter'), -5.5, room=0.0); add('key_enter_up', key_up(311, 'enter'), -13, room=0.0)
add('key_back_down', key_down(320, 'back'), -6, room=0.0); add('key_back_up', key_up(321, 'back'), -14, room=0.0)
add('crt_poweron', crt_poweron(), -4, room=0.12)
_po = SAMPLES['crt_poweron'][0]; SAMPLES['crt_poweron'] = ((_po + poweron_whine(len(_po))).astype(np.float32), False)
add('crt_whine_15k', whine(15734), rms=-51, loop=True, room=0.0)
add('crt_hum', crt_hum(), rms=-36, loop=True, room=0.1)
add('room_tone', room_tone(), rms=-52, loop=True, room=0.0)
add('floppy_seek', floppy_seek(), -5)
add('floppy_insert', floppy_insert(), -5)
add('slide_tick', slide_tick(), -14)
add('dive_whoosh', dive_whoosh(), -6, room=0.1)
add('hover_static', hover_static(), -24)
add('glass_tap', glass_tap(), -12)
add('beep_error', beep_error(), -10, room=0.12)
add('chime_ok', chime_ok(), -12, room=0.16)

def write_wav(path, x):
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())

def encode(name, x, loop):
    wav = os.path.join(TMP, name + '.wav'); write_wav(wav, x)
    hi = name.startswith('crt_whine')
    q = '6' if hi else '3'   # higher quality keeps the 15.7 kHz partial intact
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', str(SR), '-c:a', 'libvorbis', '-q:a', q, os.path.join(OUT, name + '.ogg')], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-ac', '1', '-ar', str(SR), '-c:a', 'libmp3lame', '-b:a', '96k' if not hi else '128k', '-cutoff', '20000', os.path.join(OUT, name + '.mp3')], check=True)

# ---------------------------------------------------------------- report
def report(name, x):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    t = t_axis(len(x))
    fig, ax = plt.subplots(figsize=(6, 2), dpi=90); ax.plot(t, x, lw=0.5, color='#c2412e'); ax.set_xlim(0, t[-1]); ax.set_ylim(-1, 1)
    ax.set_title(name + ' (waveform)', fontsize=8); ax.set_xlabel('s', fontsize=7); ax.tick_params(labelsize=6); fig.tight_layout()
    fig.savefig(os.path.join(REP, name + '_wave.png')); plt.close(fig)
    fig, ax = plt.subplots(figsize=(6, 2.4), dpi=90)
    nper = 1024 if len(x) > T(0.4) else 256
    f, tt, S = signal.spectrogram(x, SR, nperseg=nper, noverlap=nper * 3 // 4)
    ax.pcolormesh(tt, f / 1000, 10 * np.log10(S + 1e-14), shading='auto', cmap='magma', vmin=-150, vmax=-50)
    ax.set_ylim(0, 20); ax.set_ylabel('kHz', fontsize=7); ax.set_xlabel('s', fontsize=7); ax.set_title(name + ' (spectrogram)', fontsize=8); ax.tick_params(labelsize=6)
    fig.tight_layout(); fig.savefig(os.path.join(REP, name + '_spec.png')); plt.close(fig)

def typing_demo():
    """10 s: room tone + hum, someone types 'help', Enter, the chime and the floppy answer."""
    rng = np.random.default_rng(5); n = T(10); y = np.zeros(n)
    hum = SAMPLES['crt_hum'][0]; tone = SAMPLES['room_tone'][0]
    y += np.resize(hum, n) + np.resize(tone, n)
    t = 0.9; rr = 0; downs = [k for k in SAMPLES if k.startswith('key_down_')]
    def hit(nm, up, at):
        g = db(rng.uniform(-2, 2)); rate = 1 + rng.uniform(-0.03, 0.03)
        for s, a in ((SAMPLES[nm][0], at), (SAMPLES[up][0], at + rng.uniform(0.07, 0.11))):
            idx = np.arange(0, len(s) - 1, rate); place(y, np.interp(idx, np.arange(len(s)), s), a, g)
    for word in ['help']:
        for ch in word:
            nm = downs[(rr + rng.integers(1, 3)) % len(downs)]; rr = downs.index(nm)
            hit(nm, f'key_up_{rng.integers(0, 4)}', t); t += rng.uniform(0.13, 0.26)
    t += 0.25; hit('key_enter_down', 'key_enter_up', t)
    place(y, SAMPLES['floppy_seek'][0], t + 0.12, 0.8); place(y, SAMPLES['chime_ok'][0], t + 0.5, 1.0)
    t += 1.6
    for ch in 'dir':
        nm = downs[rng.integers(0, len(downs))]; hit(nm, f'key_up_{rng.integers(0, 4)}', t); t += rng.uniform(0.14, 0.24)
    t += 0.2; hit('key_enter_down', 'key_enter_up', t); place(y, SAMPLES['beep_error'][0], t + 0.15, 1.0)
    t += 1.2; hit('key_space_down', 'key_space_up', t)
    return np.clip(y, -1, 1)

def key_tail_ir():
    """The 120 ms room tail the runtime adds to keys while the hum is on."""
    rng = np.random.default_rng(12); n = T(0.12); t = t_axis(n)
    ir = rng.standard_normal(n) * np.exp(-t / 0.03); ir = lowpass(ir, 4500); ir[0] = 0
    return ir / np.sqrt(np.sum(ir ** 2))

def session():
    """30 s: power-on, typing, slide ticks, hover/tap, dive in and out, more typing. Everything
    is placed with the same jitter rules the runtime uses (+-1.5 dB, +-3 % rate, no repeated variant)."""
    rng = np.random.default_rng(77); n = T(30); y = np.zeros(n); keys = np.zeros(n)
    S = lambda k: SAMPLES[k][0]
    hum_env = np.zeros(n); t = t_axis(n)
    hum_env = np.clip((t - 1.2) / 0.8, 0, 1)
    duck = np.ones(n); duck[(t > 17.4) & (t < 20.2)] = db(-15)
    duck = np.convolve(duck, np.ones(T(0.3)) / T(0.3), mode='same')
    y += np.resize(S('crt_hum'), n) * hum_env * duck + np.resize(S('room_tone'), n)
    e = t - 1.5; wenv = np.clip(e / 1.5, 0, 1) * db(-6 * np.clip((e - 1.5) / 20, 0, 1))   # same envelope as the runtime
    wduck = np.ones(n); wduck[(t > 17.4) & (t < 20.2)] = db(-10); wduck = np.convolve(wduck, np.ones(T(0.3)) / T(0.3), mode='same')
    y += np.resize(S('crt_whine_15k'), n) * wenv * wduck
    place(y, S('crt_poweron'), 0.5)
    last = [-1]
    def stretch(x, rate): idx = np.arange(0, len(x) - 1, rate); return np.interp(idx, np.arange(len(x)), x)
    def key(code, at):
        g = db(rng.uniform(-1.5, 1.5)); r = 1 + rng.uniform(-0.03, 0.03)
        if code == ' ': d, u = 'key_space_down', 'key_space_up'
        elif code == '\n': d, u = 'key_enter_down', 'key_enter_up'
        else:
            i = last[0]
            while i == last[0]: i = int(rng.integers(0, 8))
            last[0] = i; d, u = f'key_down_{i}', f'key_up_{rng.integers(0, 4)}'
        place(keys, stretch(S(d), r), at, g); place(keys, stretch(S(u), r), at + rng.uniform(0.075, 0.115), g * db(-1))
    def type_line(txt, at):
        for ch in txt: key(ch, at); at += rng.uniform(0.12, 0.24)
        return at
    t0 = type_line('help', 3.0); key('\n', t0 + 0.25); place(y, S('floppy_seek'), t0 + 0.37, db(-4)); place(y, S('chime_ok'), t0 + 0.37)
    for at in (7.6, 10.9, 14.2):
        place(y, S('slide_tick'), at)
    place(y, S('floppy_seek'), 10.92, db(-6))
    t0 = type_line('ls packs', 8.4); key('\n', t0 + 0.25); place(y, S('floppy_seek'), t0 + 0.37, db(-4)); place(y, S('chime_ok'), t0 + 0.37)
    place(y, S('hover_static'), 13.0, db(-2)); place(y, S('glass_tap'), 13.6)
    place(y, S('dive_whoosh'), 16.0, db(-4)); place(y, S('dive_whoosh')[::-1].copy(), 19.4, db(-4))
    t0 = type_line('about', 23.0); key('\n', t0 + 0.25); place(y, S('chime_ok'), t0 + 0.37)
    tail = signal.fftconvolve(keys, key_tail_ir())[:n]
    y += keys + tail * db(-14)
    return y

def loudness_report(x, name):
    import pyloudnorm as pyln
    meter = pyln.Meter(SR); lufs = meter.integrated_loudness(x)
    x = x * db(-28 - lufs)
    tp = 20 * np.log10(np.abs(signal.resample_poly(x, 4, 1)).max() + 1e-12)
    return x, meter.integrated_loudness(x), tp

if __name__ == '__main__':
    rows = []
    for name, (x, loop) in SAMPLES.items():
        encode(name, x, loop); report(name, x)
        pk = 20 * np.log10(np.abs(x).max() + 1e-12); rm = 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
        rows.append([name, f'{len(x) / SR:.3f}', f'{pk:.1f}', f'{rm:.1f}', 'loop' if loop else '', os.path.getsize(os.path.join(OUT, name + '.ogg')), os.path.getsize(os.path.join(OUT, name + '.mp3'))])
    ses = session(); ses, lufs, tp = loudness_report(ses, 'session')
    write_wav(os.path.join(TMP, 'session_30s.wav'), ses)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(TMP, 'session_30s.wav'), '-c:a', 'libvorbis', '-q:a', '4', os.path.join(REP, 'session_30s.ogg')], check=True)
    report('session_30s', ses)
    with open(os.path.join(REP, 'loudness.txt'), 'w') as f:
        f.write(f'session_30s: integrated {lufs:.1f} LUFS, true peak {tp:.1f} dBTP (4x oversampled), measured with pyloudnorm (ITU-R BS.1770-4)\n')
    print(f'session LUFS {lufs:.1f} TP {tp:.1f}')
    demo = typing_demo(); write_wav(os.path.join(TMP, 'typing_demo.wav'), demo)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', os.path.join(TMP, 'typing_demo.wav'), '-c:a', 'libvorbis', '-q:a', '4', os.path.join(REP, 'typing_demo.ogg')], check=True)
    report('typing_demo', demo)
    with open(os.path.join(REP, 'table.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['name', 'duration_s', 'peak_dBFS', 'rms_dBFS', 'loop', 'ogg_bytes', 'mp3_bytes']); w.writerows(rows)
    for r in rows: print(*r, sep='\t')
    print('total ogg', sum(r[5] for r in rows), 'total mp3', sum(r[6] for r in rows))
    import shutil; shutil.rmtree(TMP)
