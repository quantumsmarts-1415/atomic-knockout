// ---------------------------------------------------------------------------
// sfx — tiny WebAudio synthesizer. All sounds are generated in code, so the
// game ships zero audio files. AudioContext is created lazily on first play
// (browsers require a user gesture before audio can start).
// ---------------------------------------------------------------------------

let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, endFreq = null, type = 'square', dur = 0.1, vol = 0.2, delay = 0 }) {
  const c = ac();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.12, vol = 0.25, delay = 0, lowpass = 3000 }) {
  const c = ac();
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = lowpass;
  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(gain).connect(c.destination);
  src.start(t0);
}

const SOUNDS = {
  jump: () => tone({ freq: 300, endFreq: 620, type: 'square', dur: 0.12, vol: 0.12 }),
  hit: () => { noise({ dur: 0.09, vol: 0.3, lowpass: 4500 }); tone({ freq: 160, endFreq: 70, type: 'triangle', dur: 0.12, vol: 0.3 }); },
  special: () => { tone({ freq: 500, endFreq: 950, type: 'sawtooth', dur: 0.18, vol: 0.12 }); tone({ freq: 750, endFreq: 1400, type: 'sine', dur: 0.22, vol: 0.1, delay: 0.05 }); },
  ko: () => { noise({ dur: 0.35, vol: 0.35, lowpass: 1800 }); tone({ freq: 400, endFreq: 40, type: 'sawtooth', dur: 0.45, vol: 0.28 }); },
  menuMove: () => tone({ freq: 520, type: 'square', dur: 0.05, vol: 0.07 }),
  menuConfirm: () => { tone({ freq: 520, type: 'square', dur: 0.07, vol: 0.1 }); tone({ freq: 780, type: 'square', dur: 0.09, vol: 0.1, delay: 0.07 }); },
  gameEnd: () => { tone({ freq: 392, type: 'square', dur: 0.14, vol: 0.14 }); tone({ freq: 523, type: 'square', dur: 0.14, vol: 0.14, delay: 0.14 }); tone({ freq: 659, type: 'square', dur: 0.3, vol: 0.14, delay: 0.28 }); },
};

export function play(name) {
  try {
    SOUNDS[name]?.();
  } catch {
    // audio not available (no gesture yet, or unsupported) — never break the game
  }
}
