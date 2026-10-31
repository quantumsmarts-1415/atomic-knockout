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
