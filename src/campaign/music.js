// Campaign music: looping themes with crossfades, plus short stingers that duck the music.
// Separate AudioContext from sfx.js, so fight mode audio is untouched; nothing here runs unless a campaign scene asks.
// Level = ak-master x ak-music (default 0.6); M in the campaign toggles ak-music-mute.
export const TRACKS = {
  title: { loop: true },
  story: { loop: true },
  camp: { loop: true },
  map_player: { loop: true },
  map_enemy: { loop: true },
  boss: { loop: true },
  victory: { loop: false, len: 7.6 },
  defeat: { loop: false, len: 11.9 },
  levelup: { loop: false, len: 2.9 },
};

const DIR = 'assets/campaign/music/';
let ctx = null;
let out = null; // master (volume + mute)
let bus = null; // music bus (ducked by stingers)
let ext = null;
const buffers = new Map();
const loading = new Map();
let current = null; // { name, src, gain }
let wanted = null; // what should be playing once any stinger is over
let stingerUntil = 0;
let watcher = null;

function num(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    if (v == null || v === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
  } catch { return fallback; }
}

export function level() {
  let muted = false;
  try { muted = localStorage.getItem('ak-music-mute') === '1'; } catch { /* ignore */ }
  return muted ? 0 : num('ak-master', 0.9) * num('ak-music', 0.6);
}

export function isMuted() {
  try { return localStorage.getItem('ak-music-mute') === '1'; } catch { return false; }
}

export function toggleMute() {
  const m = !isMuted();
  try { localStorage.setItem('ak-music-mute', m ? '1' : '0'); } catch { /* ignore */ }
  refresh();
  return m;
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    out = ctx.createGain();
    out.gain.value = level();
    bus = ctx.createGain();
    bus.connect(out);
    out.connect(ctx.destination);
    const a = document.createElement('audio');
    ext = a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Re-read the volume settings (called on a timer while the campaign is up, and after a mute toggle). */
export function refresh() {
  if (ctx && out) out.gain.setTargetAtTime(level(), ctx.currentTime, 0.05);
}

function load(name) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name));
  if (loading.has(name)) return loading.get(name);
  const c = ac();
  if (!c) return Promise.resolve(null);
  const p = fetch(`${DIR}${name}.${ext}`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((ab) => new Promise((res, rej) => c.decodeAudioData(ab, res, rej)))
    .then((b) => { buffers.set(name, b); return b; })
    .catch(() => null)
    .finally(() => loading.delete(name));
  loading.set(name, p);
  return p;
}

/** Start fetching tracks early so a switch does not wait for the network. */
export function preload(names) {
  for (const n of names) load(n);
}

/** Make this the background theme (crossfades from the current one). Waits out a playing stinger. */
export async function playMusic(name, { fade = 1.4 } = {}) {
  wanted = name;
  if (!TRACKS[name]?.loop) return;
  if (current && current.name === name && !current.ending) return;
  if (performance.now() < stingerUntil) return; // the stinger's end starts `wanted`
  const c = ac();
  if (!c) return;
  const buf = await load(name);
  if (!buf || wanted !== name || (current && current.name === name && !current.ending)) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + fade);
  src.connect(g).connect(bus);
  src.start(t);
  const old = current;
  current = { name, src, gain: g };
  if (old) endTrack(old, fade * 0.9);
}

function endTrack(tr, fade) {
  if (!ctx || tr.ending) return;
  tr.ending = true;
  const t = ctx.currentTime;
  tr.gain.gain.cancelScheduledValues(t);
  tr.gain.gain.setValueAtTime(tr.gain.gain.value, t);
  tr.gain.gain.linearRampToValueAtTime(0, t + fade);
  try { tr.src.stop(t + fade + 0.05); } catch { /* already stopped */ }
}

export function stopMusic(fade = 0.8) {
  wanted = null;
  if (current) { endTrack(current, fade); current = null; }
}

/**
 * A one-shot jingle. `duck` is how far the background theme dips while it plays (1 = unchanged, 0 = silent);
 * `hold` makes the background wait for the stinger to finish (victory / defeat) before the next theme starts.
 */
export async function stinger(name, { duck = 0.25, hold = false, vol = 1 } = {}) {
  const meta = TRACKS[name];
  const c = ac();
  if (!c || !meta) return;
  const buf = await load(name);
  if (!buf) return;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(out);
  src.start(t);
  const len = buf.duration;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(duck, t + 0.12);
  const back = hold ? len : Math.min(len, 2.4);
  bus.gain.setValueAtTime(duck, t + Math.max(0, back - 0.1));
  bus.gain.linearRampToValueAtTime(1, t + back + 0.9);
  if (hold) {
    if (current) { endTrack(current, 0.25); current = null; }
    stingerUntil = performance.now() + len * 1000;
    setTimeout(() => { stingerUntil = 0; if (wanted) playMusic(wanted, { fade: 1.2 }); }, len * 1000 + 50);
  }
}

/**
 * Stop the music once the player has left the campaign (no campaign scene active for a moment).
 * Call once from a campaign scene; it keeps itself going until the campaign is closed.
 */
export function watch(game) {
  if (watcher) return;
  let away = 0;
  watcher = setInterval(() => {
    refresh();
    const here = ['Campaign', 'CampaignBattle'].some((k) => game.scene.isActive(k));
    away = here ? 0 : away + 1;
    if (away >= 3) {
      stopMusic(0.6);
      clearInterval(watcher);
      watcher = null;
    }
  }, 500);
}

/** For tests and the playtest: what is playing right now. */
export function status() {
  return { current: current?.name || null, wanted, level: level(), muted: isMuted(), ctx: ctx ? ctx.state : null, stinger: performance.now() < stingerUntil };
}
