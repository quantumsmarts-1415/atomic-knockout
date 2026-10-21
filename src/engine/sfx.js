// ---------------------------------------------------------------------------
// sfx — WebAudio synthesizer. No audio files. A compressor keeps stacked
// hits from clipping. Volumes live in localStorage (ak-master, ak-sfx).
// ---------------------------------------------------------------------------

let ctx = null;
let master = null;
let comp = null;
let duck = null;

function vol(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v == null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
  } catch {
    return fallback;
  }
}

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  if (!master) {
    master = ctx.createGain();
    master.gain.value = vol('ak-master', 0.9) * vol('ak-sfx', 1);
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    duck = ctx.createGain();
    duck.gain.value = 1;
    master.connect(comp).connect(duck).connect(ctx.destination);
  }
  return ctx;
}

function detune(freq) {
  return freq * (1 + (Math.random() - 0.5) * 0.08);
}

function tone({ freq = 440, endFreq = null, type = 'square', dur = 0.1, vol = 0.2, delay = 0 }) {
  const c = ac();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(detune(freq), t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(detune(endFreq), 1), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.12, vol = 0.25, delay = 0, lowpass = 3000, highpass = 0, type = 'lowpass' }) {
  const c = ac();
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = highpass > 0 ? 'highpass' : type;
  filt.frequency.value = highpass > 0 ? highpass : lowpass;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(gain).connect(master);
  src.start(t0);
}

function duckOthers() {
  const c = ac();
  const t = c.currentTime;
  duck.gain.cancelScheduledValues(t);
  duck.gain.setValueAtTime(0.5, t);
  duck.gain.linearRampToValueAtTime(1, t + 0.12);
}

const CLIPS = {
  kinetic: 'hit-kinetic.ogg',
  'kinetic-heavy': 'hit-kinetic-heavy.ogg',
  heat: 'hit-heat.ogg',
  electrical: 'hit-electrical.ogg',
  chemical: 'hit-chemical.ogg',
  radiation: 'hit-radiation.ogg',
  land: 'land.ogg',
  'land-heavy': 'land-heavy.ogg',
  ko: 'ko.ogg',
};

const buffers = new Map();
const loading = new Map();

function clipUrl(name) {
  return `/assets/sfx/${CLIPS[name]}`;
}

function loadClip(name) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return Promise.resolve(null);
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));
  if (loading.has(name)) return loading.get(name);
  const job = fetch(clipUrl(name))
    .then((res) => (res.ok ? res.arrayBuffer() : null))
    .then((raw) => (raw ? ac().decodeAudioData(raw) : null))
    .then((buf) => {
      if (buf) buffers.set(name, buf);
      return buf;
    })
    .catch(() => null);
  loading.set(name, job);
  return job;
}

/** Fetch and decode the CC0 hits. Playback falls back to the synth until they decode. */
export function preload() {
  return Promise.all(Object.keys(CLIPS).map((name) => loadClip(name)));
}

function playBuf(name, { vol = 0.6, rate = 1 } = {}) {
  if (typeof window === 'undefined') return false;
  const buf = buffers.get(name);
  if (!buf) {
    loadClip(name);
    return false;
  }
  const c = ac();
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buf;
  src.playbackRate.value = rate;
  gain.gain.setValueAtTime(vol, c.currentTime);
  src.connect(gain).connect(master);
  src.start();
  return true;
}

const SOUNDS = {
  jump: () => tone({ freq: 300, endFreq: 620, type: 'square', dur: 0.12, vol: 0.12 }),
  land: () => { if (!playBuf('land', { vol: 0.55, rate: 0.96 + Math.random() * 0.08 })) tone({ freq: 140, endFreq: 70, type: 'triangle', dur: 0.08, vol: 0.1 }); },
  landHeavy: () => {
    if (playBuf('land-heavy', { vol: 0.7 })) return;
    noise({ dur: 0.1, vol: 0.18, lowpass: 800 });
    tone({ freq: 90, endFreq: 40, type: 'sine', dur: 0.14, vol: 0.2 });
  },
  foot: () => tone({ freq: 180, endFreq: 90, type: 'triangle', dur: 0.04, vol: 0.035 }),
  whoosh: () => noise({ dur: 0.12, vol: 0.08, highpass: 900 }),
  hit: () => playHit(8, 'kinetic'),
  special: () => { tone({ freq: 500, endFreq: 950, type: 'sawtooth', dur: 0.18, vol: 0.12 }); tone({ freq: 750, endFreq: 1400, type: 'sine', dur: 0.22, vol: 0.1, delay: 0.05 }); },
  ko: () => { noise({ dur: 0.35, vol: 0.35, lowpass: 1800 }); tone({ freq: 320, endFreq: 40, type: 'sawtooth', dur: 0.45, vol: 0.28 }); },
  koHit: () => {
    noise({ dur: 0.2, vol: 0.22, highpass: 4000 });
    tone({ freq: 880, endFreq: 220, type: 'sawtooth', dur: 0.28, vol: 0.16 });
    noise({ dur: 0.4, vol: 0.3, lowpass: 1200, delay: 0.12 });
  },
  ledge: () => tone({ freq: 420, endFreq: 180, type: 'square', dur: 0.05, vol: 0.08 }),
  menuMove: () => tone({ freq: 620, endFreq: 860, type: 'sine', dur: 0.045, vol: 0.055 }),
  menuConfirm: () => {
    tone({ freq: 523, type: 'sine', dur: 0.07, vol: 0.08 });
    tone({ freq: 659, type: 'sine', dur: 0.08, vol: 0.08, delay: 0.06 });
    tone({ freq: 784, type: 'triangle', dur: 0.12, vol: 0.07, delay: 0.12 });
  },
  alarm: () => { tone({ freq: 660, type: 'square', dur: 0.12, vol: 0.08 }); tone({ freq: 495, type: 'square', dur: 0.12, vol: 0.08, delay: 0.13 }); },
  doorUnlock: () => { noise({ dur: 0.22, vol: 0.32, lowpass: 900 }); tone({ freq: 110, endFreq: 45, type: 'triangle', dur: 0.25, vol: 0.32 }); },
  doorSlide: () => { noise({ dur: 0.85, vol: 0.12, lowpass: 2400 }); tone({ freq: 70, endFreq: 95, type: 'sawtooth', dur: 0.8, vol: 0.05 }); },
  go: () => { tone({ freq: 523, type: 'square', dur: 0.1, vol: 0.12 }); tone({ freq: 784, type: 'square', dur: 0.22, vol: 0.12, delay: 0.09 }); },
  gameEnd: () => { tone({ freq: 392, type: 'square', dur: 0.14, vol: 0.14 }); tone({ freq: 523, type: 'square', dur: 0.14, vol: 0.14, delay: 0.14 }); tone({ freq: 659, type: 'square', dur: 0.3, vol: 0.14, delay: 0.28 }); },
  cheer: () => noise({ dur: 1.2, vol: 0.06, lowpass: 1400 }),
};

function typeTail(type, s) {
  if (type === 'heat') noise({ dur: 0.25, vol: 0.12 + 0.1 * s, highpass: 600 });
  else if (type === 'electrical') tone({ freq: 90, type: 'square', dur: 0.2, vol: 0.08 + 0.06 * s });
  else if (type === 'chemical') noise({ dur: 0.18, vol: 0.1 + 0.08 * s, highpass: 2500 });
  else if (type === 'radiation') {
    tone({ freq: 880, type: 'sine', dur: 0.4, vol: 0.08 + 0.06 * s });
    tone({ freq: 885, type: 'sine', dur: 0.4, vol: 0.05 });
  } else noise({ dur: 0.09, vol: 0.12 + 0.1 * s, highpass: 1200 });
}

function clipFor(type, dmg) {
  if (type === 'heat' || type === 'electrical' || type === 'chemical' || type === 'radiation') return type;
  return dmg >= 14 ? 'kinetic-heavy' : 'kinetic';
}

/** Sample first, synth if the clip has not decoded yet. Strength s is 0..1 from damage. */
export function playHit(dmg = 8, type = 'kinetic', ko = false) {
  try {
    const s = Math.min(1, Math.max(0, dmg / 20));
    const played = playBuf(clipFor(type, dmg), { vol: 0.42 + 0.4 * s, rate: 1.08 - 0.2 * s });
    if (!played) {
      noise({ dur: 0.008, vol: 0.18 + 0.15 * s, highpass: 2000 });
      tone({ freq: 180, endFreq: 60, type: 'sine', dur: 0.06 + 0.12 * s, vol: 0.16 + 0.2 * s });
      typeTail(type, s);
    }
    if (dmg >= 18) {
      tone({ freq: 55, type: 'sine', dur: 0.3, vol: 0.22 });
      duckOthers();
    }
    if (ko) {
      if (!playBuf('ko', { vol: 0.75 })) SOUNDS.koHit();
    }
  } catch { /* audio unavailable */ }
}

export function play(name) {
  try {
    SOUNDS[name]?.();
  } catch {
    // audio not available (no gesture yet, or unsupported) — never break the game
  }
}

export function setVolume(kind, value) {
  try { localStorage.setItem(kind === 'master' ? 'ak-master' : 'ak-sfx', String(value)); } catch { /* ignore */ }
  if (master && ctx) master.gain.value = vol('ak-master', 0.9) * vol('ak-sfx', 1);
}
