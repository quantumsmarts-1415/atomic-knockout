// Re-run the melee reach sweep:
//   node tools/hit-reach.mjs
//   node tools/hit-reach.mjs --pair aaron,titan
import { CHARACTERS } from '../src/data/characters.js';
import { BODY_BIAS, STRIKE_MIRRORS } from '../src/engine/masks.js';
import { idleHalfWidth, sweepHitReach } from '../src/engine/hitReach.js';

const arg = process.argv.find((a) => a.startsWith('--pair'));
const pair = arg ? (arg.split('=')[1] || process.argv[process.argv.indexOf(arg) + 1]) : null;
const ids = pair ? pair.split(',').filter((id) => CHARACTERS[id]) : null;

const skewed = Object.entries(BODY_BIAS)
  .map(([id, dx]) => ({ id, dx: Math.round(dx) }))
  .filter((row) => Math.abs(row.dx) >= 8)
  .sort((a, b) => Math.abs(b.dx) - Math.abs(a.dx));

console.log(`body slides ${Object.keys(BODY_BIAS).length}, |dx|>=8 ${skewed.length}`);
console.log(skewed.slice(0, 12).map((row) => `${row.id}:${row.dx}`).join(' '));
console.log(`backward strikes mirrored ${STRIKE_MIRRORS.length}`);

const t0 = Date.now();
const report = ids
  ? sweepHitReach({ attackers: [ids[0]], defenders: ids.slice(1) })
  : sweepHitReach();
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const never = report.issues.filter((row) => row.kind === 'never');
const one = report.issues.filter((row) => row.kind === 'one-side');
console.log(`checked ${report.checked} placements in ${secs}s`);
console.log(`never ${never.length}  one-side ${one.length}`);
const show = (rows) => {
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.attacker} ${row.move} ${row.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > 24) break;
    console.log(`  ${row.attacker} ${row.move} vs ${row.defender} ${row.kind}`);
  }
  console.log(`  unique moves ${seen.size}`);
};
if (never.length) { console.log('never:'); show(never); }
if (one.length) { console.log('one-side:'); show(one); }
if (!never.length && !one.length) console.log('every tested melee connects from both sides');
