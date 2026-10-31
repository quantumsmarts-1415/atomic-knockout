import test from 'node:test';
import assert from 'node:assert';
import { CHARACTERS } from '../src/data/characters.js';
import { MOVESETS } from '../src/data/movesets.js';

// Lobbed shots that do not burst on landing must live long enough to come
// down to the floor; otherwise they expire in mid-air above a standing
// opponent's head (Phillip, Aurelius and Bianca did).
const G = 1200;
const RELEASE_H = 150;

function flightMs(lob) {
  const v = typeof lob === 'number' ? lob : (lob.vy ?? 460);
  const g = typeof lob === 'object' ? (lob.g ?? G) : G;
  return ((v + Math.sqrt(v * v + 2 * g * RELEASE_H)) / g) * 1000;
}

test('plain lobbed projectiles reach the floor before they expire', () => {
  const bad = [];
  for (const [id, set] of Object.entries(MOVESETS)) {
    for (const [key, move] of Object.entries(set)) {
      if (move.kind !== 'projectile' || move.lob == null || move.landBurst || move.explodeOnly) continue;
      if (move.hatch) continue;
      const need = flightMs(move.lob);
      if (need > (move.projectileLife ?? 0)) bad.push(`${id}.${key} ${move.name} needs ${Math.round(need)}ms has ${move.projectileLife}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('Phillip, Aurelius and Bianca lobs come down within their life', () => {
  for (const [id, key] of [['phillip', 'specialDirectional'], ['aurelius', 'specialDirectional'], ['bianca', 'specialDirectional']]) {
    const m = MOVESETS[id][key];
    assert.ok(flightMs(m.lob) <= m.projectileLife, `${id} ${flightMs(m.lob)} > ${m.projectileLife}`);
  }
});

test('Nick Meteorite Drop dives down into the 100-250px band in front of him', () => {
  const m = MOVESETS.nick.specialDirectional;
  // spawn: skyLead behind the muzzle, skyHeight above it; held for delayMs, then falls with accel.
  const muzzleX = 40;
  let x = muzzleX - m.skyLead;
  let h = m.skyHeight + 90; // muzzle sits ~90px above the floor
  let vy = m.fallSpeed;
  const dt = 1 / 240;
  while (h > 0) { vy += m.fallAccel * dt; h -= vy * dt; x += m.projectileSpeed * dt; }
  assert.ok(x >= 150 && x <= 300, `lands at ${Math.round(x)}`);
});

test('every lobbed or thrown move flies flat: tiny rise, long even range', () => {
  const bad = [];
  let n = 0;
  for (const [id, set] of Object.entries(MOVESETS)) {
    for (const [key, move] of Object.entries(set)) {
      if (move.kind !== 'projectile' || move.lob == null) continue;
      n++;
      const v = typeof move.lob === 'number' ? move.lob : (move.lob.vy ?? 460);
      const g = typeof move.lob === 'object' ? (move.lob.g ?? G) : G;
      const rise = (v * v) / (2 * g);
      const t = (v + Math.sqrt(v * v + 2 * g * RELEASE_H)) / g;
      const range = move.projectileSpeed * t;
      if (rise > 25 || range < 300 || range > 480 || t * 1000 > move.projectileLife) {
        bad.push(`${id}.${key} ${move.name} rise ${Math.round(rise)} range ${Math.round(range)} t ${Math.round(t * 1000)}ms life ${move.projectileLife}`);
      }
    }
  }
  assert.ok(n >= 11, `only ${n} lob moves`);
  assert.deepEqual(bad, []);
});
