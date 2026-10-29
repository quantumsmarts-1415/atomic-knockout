"""Tiny numpy synth + sequencer used to compose the campaign music (original material, no samples).
Voices: band-limited wavetable pulse/saw/triangle, FM bell, filtered noise drums, convolution reverb."""
import re
import numpy as np
from scipy.signal import lfilter, fftconvolve, butter

SR = 44100
_NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def midi(name):
    m = re.fullmatch(r'([A-G])([#b]?)(-?\d)', name)
    if not m:
        raise ValueError(name)
    n = _NAMES[m.group(1)] + (1 if m.group(2) == '#' else -1 if m.group(2) == 'b' else 0)
    return 12 * (int(m.group(3)) + 1) + n


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


CHORDS = {'': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'm7': [0, 3, 7, 10], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7], 'dim': [0, 3, 6]}


def chord(name, octave=3):
    m = re.fullmatch(r'([A-G][#b]?)(.*)', name)
    root = midi(m.group(1) + str(octave))
    return [root + i for i in CHORDS[m.group(2)]]


def parse_bar(s):
    """'C5:1 E5:.5 r:.5' -> [(beat, dur, midi|None)]"""
    out, b = [], 0.0
    for tok in s.split():
        n, d = tok.split(':')
        d = float(d)
        if n != 'r':
            out.append((b, d, midi(n)))
        b += d
    return out, b


# ---------------------------------------------------------------- wavetables
_N = 2048
_tables = {}


def _table(kind, m):
    key = (kind, int(round(m)))
    if key in _tables:
        return _tables[key]
    f = hz(key[1])
    nh = max(1, int(min(SR / 2 * 0.92, 15000) / f))
    ph = np.arange(_N) / _N * 2 * np.pi
    k = np.arange(1, nh + 1)[:, None]
    if kind == 'saw':
        w = (np.sin(k * ph) / k).sum(0) * (2 / np.pi)
    elif kind.startswith('pulse'):
        d = float(kind[5:]) / 100
        a = 2 / (k * np.pi) * np.sin(k * np.pi * d)
        w = (a * np.cos(k * (ph - np.pi * d))).sum(0)
    elif kind == 'tri':
        ko = k[k[:, 0] % 2 == 1]
        w = ((((ko - 1) / 2) % 2 * -2 + 1) / ko ** 2 * np.sin(ko * ph)).sum(0) * (8 / np.pi ** 2)
    else:
        w = np.sin(ph)
    w = w / max(1e-9, np.abs(w).max())
    _tables[key] = w
    return w


def osc(kind, m, n, detune=0.0, vib=0.0, vib_hz=5.5, vib_delay=0.15, phase0=0.0):
    f = hz(m) * 2 ** (detune / 1200)
    t = np.arange(n) / SR
    fr = f * (1 + (vib * np.clip((t - vib_delay) / 0.3, 0, 1) * np.sin(2 * np.pi * vib_hz * t) if vib else 0))
    ph = (np.cumsum(np.broadcast_to(fr, (n,)) / SR) + phase0) % 1.0
    w = _table(kind, m)
    x = ph * _N
    i = x.astype(int)
    fr_ = x - i
    return w[i] * (1 - fr_) + w[(i + 1) % _N] * fr_


def adsr(n_hold, a, d, s, r, curve=1.0):
    nt = n_hold + int(r * SR)
    t = np.arange(nt) / SR
    hold = n_hold / SR
    env = np.where(t < a, t / max(a, 1e-4), 1.0)
    env = np.where((t >= a) & (t < a + d), 1.0 - (1.0 - s) * ((t - a) / max(d, 1e-4)) ** curve, env)
    env = np.where(t >= a + d, s, env)
    rel = np.clip(1.0 - (t - hold) / max(r, 1e-4), 0, 1)
    env = np.where(t > hold, env * rel, env)
    return env


def lp(x, fc, order=2):
    b, a = butter(order, min(fc, SR * 0.45) / (SR / 2))
    return lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = butter(order, fc / (SR / 2), 'high')
    return lfilter(b, a, x)


# ---------------------------------------------------------------- instruments (mono)
def _n(dur):
    return int(dur * SR)


def lead(m, dur, vel):          # chiptune lead: thin pulse + a touch of vibrato
    n = _n(dur)
    x = 0.6 * osc('pulse25', m, n + _n(0.12), vib=0.003) + 0.35 * osc('pulse50', m, n + _n(0.12), detune=6, vib=0.003)
    return x[:n + _n(0.08)] * adsr(n, 0.004, 0.09, 0.62, 0.08) * vel


def horn(m, dur, vel):          # brass-ish: filtered saw + pulse, slow-ish attack
    n = _n(dur)
    tot = n + _n(0.15)
    x = 0.65 * osc('saw', m, tot, vib=0.002) + 0.35 * osc('pulse50', m, tot, detune=-5)
    x = lp(x, 2600 + 2200 * vel)
    return x * adsr(n, 0.05, 0.16, 0.8, 0.15) * vel


def stab(m, dur, vel):          # short punchy brass
    n = _n(min(dur, 0.35))
    tot = n + _n(0.1)
    x = 0.7 * osc('saw', m, tot) + 0.3 * osc('saw', m, tot, detune=9)
    x = lp(x, 3800)
    return x * adsr(n, 0.01, 0.12, 0.5, 0.1) * vel


def strings(m, dur, vel):
    n = _n(dur)
    tot = n + _n(0.6)
    x = sum(osc('saw', m, tot, detune=d, vib=0.002, vib_hz=5 + i * 0.4) for i, d in enumerate((-9, 0, 9))) / 3
    x = lp(x, 2300)
    return x * adsr(n, 0.3, 0.2, 0.9, 0.6) * vel


def pad(m, dur, vel):           # soft airy pad
    n = _n(dur)
    tot = n + _n(0.9)
    x = 0.6 * osc('tri', m, tot, detune=-5) + 0.6 * osc('tri', m, tot, detune=5) + 0.25 * osc('sine', m + 12, tot)
    return lp(x, 1800) * adsr(n, 0.7, 0.3, 0.9, 0.9) * vel


def choir(m, dur, vel):         # "ooh"-like: sine stack with formant-ish bumps
    n = _n(dur)
    tot = n + _n(0.7)
    f = hz(m)
    t = np.arange(tot) / SR
    v = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.2) / 0.4, 0, 1)
    x = np.zeros(tot)
    for k in range(1, 12):
        fk = f * k
        if fk > 5000:
            break
        form = np.exp(-((fk - 700) / 420) ** 2) + 0.5 * np.exp(-((fk - 1150) / 300) ** 2) + 0.05
        x += form / k ** 0.6 * np.sin(2 * np.pi * np.cumsum(f * v * k / SR))
    return x / 3 * adsr(n, 0.4, 0.2, 0.9, 0.7) * vel


def bass(m, dur, vel):
    n = _n(dur)
    tot = n + _n(0.08)
    x = lp(osc('saw', m, tot), 700) * 0.7 + 0.6 * osc('sine', m, tot)
    return x * adsr(n, 0.004, 0.14, 0.65, 0.08) * vel


def pluck(m, dur, vel):
    n = _n(max(dur, 0.2))
    x = 0.6 * osc('pulse12', m, n) + 0.5 * osc('tri', m + 12, n)
    t = np.arange(n) / SR
    return lp(x, 4200) * np.exp(-t * 7.5) * vel * 0.9


def flute(m, dur, vel):
    n = _n(dur)
    tot = n + _n(0.12)
    x = osc('tri', m, tot, vib=0.004, vib_delay=0.1) + 0.3 * osc('sine', m + 12, tot)
    x += 0.03 * hp(np.random.default_rng(int(m)).standard_normal(tot), 3000)
    return lp(x, 4000) * adsr(n, 0.06, 0.1, 0.8, 0.12) * vel


def bell(m, dur, vel):          # FM bell: the "atomic sparkle"
    n = _n(max(dur, 1.4))
    t = np.arange(n) / SR
    f = hz(m)
    idx = 2.2 * np.exp(-t * 3.0)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t))
    x += 0.35 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t * 4)
    return x * np.exp(-t * 2.2) * vel * 0.55


def subbass(m, dur, vel):       # pure low sine with a hint of 2nd harmonic: the weight under everything
    n = _n(dur)
    tot = n + _n(0.12)
    x = osc('sine', m, tot) + 0.22 * osc('sine', m + 12, tot)
    return x * adsr(n, 0.01, 0.2, 0.9, 0.12) * vel


def distbass(m, dur, vel):      # driving, overdriven saw bass
    n = _n(dur)
    tot = n + _n(0.06)
    x = 0.8 * osc('saw', m, tot) + 0.5 * osc('pulse25', m, tot, detune=-7)
    x = np.tanh(lp(x, 900) * 3.4) * 0.8
    x = lp(x, 1800)
    return x * adsr(n, 0.004, 0.1, 0.75, 0.06) * vel


def lowbrass(m, dur, vel):      # dark, heavy brass stab / swell
    n = _n(dur)
    tot = n + _n(0.2)
    x = 0.7 * osc('saw', m, tot, vib=0.002) + 0.5 * osc('saw', m, tot, detune=12) + 0.3 * osc('pulse50', m - 12, tot)
    x = np.tanh(lp(x, 1500 + 900 * vel) * 1.8)
    return x * adsr(n, 0.04, 0.2, 0.7, 0.2) * vel * 0.8


def dist2(m, dur, vel):         # crushing bass: hard-clipped saw + square an octave down, a clean sine sub underneath
    n = _n(dur)
    tot = n + _n(0.05)
    x = 0.8 * osc('saw', m, tot) + 0.6 * osc('pulse50', m - 12, tot) + 0.4 * osc('saw', m, tot, detune=-11)
    x = np.clip(lp(x, 1100) * 6.0, -1, 1) * 0.55
    x = lp(x, 2400) + 0.7 * osc('sine', m - 12 if m > 36 else m, tot)
    return x * adsr(n, 0.003, 0.08, 0.85, 0.05) * vel


def brasshit(m, dur, vel):      # huge stacked low-brass stab: three detuned saws + octave below, saturated
    n = _n(dur)
    tot = n + _n(0.22)
    x = sum(osc('saw', m, tot, detune=d) for d in (-14, 0, 14)) / 2 + 0.7 * osc('saw', m - 12, tot) + 0.4 * osc('pulse25', m + 12, tot)
    x = np.tanh(lp(x, 2200 + 1400 * vel) * 2.4) * 0.8
    return x * adsr(n, 0.015, 0.16, 0.75, 0.22) * vel


def choirhit(m, dur, vel):      # shouted choir stab with a bite of saw on top
    n = _n(dur)
    tot = n + _n(0.4)
    f = hz(m)
    t = np.arange(tot) / SR
    x = np.zeros(tot)
    for k in range(1, 14):
        fk = f * k
        if fk > 6000:
            break
        form = np.exp(-((fk - 800) / 380) ** 2) + 0.8 * np.exp(-((fk - 1250) / 330) ** 2) + 0.2 * np.exp(-((fk - 2800) / 500) ** 2) + 0.04
        x += form / k ** 0.5 * np.sin(2 * np.pi * np.cumsum(np.full(tot, f * k) / SR) + 0.3 * k)
    x = x / 3 + 0.25 * lp(osc('saw', m, tot), 2000)
    return np.tanh(x * 1.6) * adsr(n, 0.02, 0.15, 0.7, 0.4) * vel


INSTR = dict(dist2=dist2, brasshit=brasshit, choirhit=choirhit, subbass=subbass, distbass=distbass, lowbrass=lowbrass, lead=lead, horn=horn, stab=stab, strings=strings, pad=pad, choir=choir, bass=bass, pluck=pluck, flute=flute, bell=bell)


# ---------------------------------------------------------------- drums
def _rng(seed):
    return np.random.default_rng(seed)


def kick(vel):
    t = np.arange(_n(0.28)) / SR
    f = 48 + 120 * np.exp(-t * 28)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11)
    return (x + 0.25 * np.exp(-t * 90) * _rng(1).standard_normal(len(t))) * vel


def snare(vel):
    t = np.arange(_n(0.22)) / SR
    nz = hp(_rng(2).standard_normal(len(t)), 1500) * np.exp(-t * 20)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 28)
    return (0.75 * nz + 0.5 * tone) * vel


def hat(vel, open_=False):
    n = _n(0.25 if open_ else 0.06)
    t = np.arange(n) / SR
    return hp(_rng(3).standard_normal(n), 7000) * np.exp(-t * (14 if open_ else 70)) * vel * 0.5


def tom(vel, m=45):
    t = np.arange(_n(0.7)) / SR
    f = hz(m) * (1 + 0.6 * np.exp(-t * 18))
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.2) + 0.15 * hp(_rng(4).standard_normal(len(t)), 800) * np.exp(-t * 60)) * vel


def crash(vel):
    n = _n(2.4)
    t = np.arange(n) / SR
    return hp(_rng(5).standard_normal(n), 4000) * np.exp(-t * 2.0) * vel * 0.55


def taiko(vel):
    t = np.arange(_n(1.1)) / SR
    f = 52 + 70 * np.exp(-t * 22)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.2)
    skin = lp(_rng(6).standard_normal(len(t)), 900) * np.exp(-t * 38) * 0.6
    return (body + skin) * vel * 1.1


def bigsnare(vel):
    t = np.arange(_n(0.4)) / SR
    nz = hp(_rng(8).standard_normal(len(t)), 900) * np.exp(-t * 11)
    tone = np.sin(2 * np.pi * (170 + 60 * np.exp(-t * 40)) * t) * np.exp(-t * 18)
    return (0.8 * nz + 0.7 * tone) * vel


def kick2(vel):                 # tighter, harder double-kick: short body, beater click
    t = np.arange(_n(0.22)) / SR
    f = 42 + 150 * np.exp(-t * 38)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 13)
    click = hp(_rng(11).standard_normal(len(t)), 2500) * np.exp(-t * 160) * 0.35
    return np.tanh((x + click) * 1.5) * vel


def impact(vel):                # cinematic hit: falling sub boom + noise burst
    t = np.arange(_n(2.6)) / SR
    f = 34 + 90 * np.exp(-t * 9)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    burst = lp(_rng(12).standard_normal(len(t)), 2500) * np.exp(-t * 7) * 0.7
    return np.tanh((boom * 1.6 + burst)) * vel


def riser(vel):                 # 4-second noise sweep that builds up to the next downbeat
    n = _n(4.0)
    t = np.arange(n) / SR
    nz = _rng(13).standard_normal(n)
    out = np.zeros(n)
    for a, b in ((0, n // 4), (n // 4, n // 2), (n // 2, 3 * n // 4), (3 * n // 4, n)):
        k = int(300 + 6500 * (a / n) ** 1.5)
        out[a:b] = lp(nz, k)[a:b]
    return out * (t / 4.0) ** 2.2 * vel * 0.9


DRUM = dict(kick2=kick2, impact=impact, riser=riser, tomhi=lambda v: tom(v, 57), tommid=lambda v: tom(v, 50), taiko=taiko, bigsnare=bigsnare, kick=kick, snare=snare, hat=hat, ohat=lambda v: hat(v, True), tom=tom, tomlo=lambda v: tom(v, 38), crash=crash)


# ---------------------------------------------------------------- mixing
def pan_gains(p):
    a = (p + 1) * np.pi / 4
    return np.cos(a), np.sin(a)


class Mix:
    def __init__(self, bpm, bars, tail=4.0):
        self.bpm, self.bars = bpm, bars
        self.spb = 60.0 / bpm
        self.total = int(bars * 4 * self.spb * SR)
        self.buf_len = self.total + int(tail * SR)
        self.dry = np.zeros((2, self.buf_len))
        self.wet = np.zeros((2, self.buf_len))

    def add(self, mono, beat, gain=1.0, pan=0.0, send=0.2):
        s = int(round(beat * self.spb * SR))
        if s >= self.buf_len:
            return
        e = min(self.buf_len, s + len(mono))
        seg = mono[:e - s] * gain
        l, r = pan_gains(pan)
        self.dry[0, s:e] += seg * l
        self.dry[1, s:e] += seg * r
        if send:
            self.wet[0, s:e] += seg * l * send
            self.wet[1, s:e] += seg * r * send

    def note(self, inst, m, beat, dur_beats, vel=0.8, gain=1.0, pan=0.0, send=0.2):
        self.add(INSTR[inst](m, dur_beats * self.spb, vel), beat, gain, pan, send)

    def drum(self, name, beat, vel=0.8, gain=1.0, pan=0.0, send=0.1):
        self.add(DRUM[name](vel), beat, gain, pan, send)

    def render(self, loop=True, rt=1.9, wet=1.0):
        n = int(rt * SR)
        t = np.arange(n) / SR
        rng = np.random.default_rng(7)
        ir = [lp(rng.standard_normal(n), 5000) * np.exp(-t * 3.2 / rt * 1.6) for _ in range(2)]
        ir = np.array(ir)
        ir[:, :int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        ir /= np.sqrt((ir ** 2).sum(1, keepdims=True)) * 3.2
        w = np.stack([fftconvolve(self.wet[c], ir[c]) for c in range(2)])
        out = np.zeros((2, self.buf_len + n - 1))
        out[:, :self.buf_len] += self.dry
        out += w * wet
        if loop:
            tl = out.shape[1] - self.total
            fold = out[:, self.total:]
            out = out[:, :self.total].copy()
            out[:, :tl] += fold
            return out
        # one-shot: trim silence at the end, short fade
        env = np.abs(out).max(0)
        last = np.nonzero(env > 1e-3)[0]
        out = out[:, :(last[-1] + 1 if len(last) else len(env))]
        k = min(out.shape[1], int(0.25 * SR))
        out[:, -k:] *= np.linspace(1, 0, k)
        return out
