// Element-true Smash Ring stats (Benjamin, Nov 3 2026, pt647u).  Reads the real element properties in tools/data/element-props.json
// (built by tools/gen-element-props.py) and writes
//   src/data/elementStats.js                         the table the Smash Ring reads (RING_FIGHTERS in statRework.js)
//   /workspace/aksheet/element_stats_2026-11-03.csv  the same table with a one-line rationale per fighter
//
// Rules kept: Weight 1-5 and Speed = 6 - Weight; each stat 0-10; Attack + Defense = 30 (24 for noble gases, which have no
// chemical stat); Hydra's and Helen's rows are copied from the sheet untouched.  (The ghost +3 is a base-damage bonus, not a stat.)
//
// How each number is derived (every score is a 0-1 percentile of the real property across all 118 elements):
//   Weight            atomic mass and density (half each, log scale), cut into five equal bands: heaviest = 5
//   Kinetic Attack    hardness (Mohs, 70%) and density (30%)
//   Kinetic Defense   density (50%) and hardness (50%)
//   Heat Attack       boiling point
//   Heat Defense      melting point
//   Electrical Attack conductivity (log)
//   Electrical Def.   insulation = 1 - conductivity score
//   Chemical Attack   reactivity = distance of Pauling electronegativity from the inert middle (2.0): fluorine, oxygen, the alkali metals
//   Chemical Defense  1 - reactivity (noble metals resist); noble gases have none
//   Radiation Attack  radioactivity: stable = 0; otherwise how short-lived the longest-lived isotope is (log half-life)
//   Radiation Def.    shielding (density 60%) plus living with radiation (radioactivity 40%)
// The 30 points (24 for noble gases) are shared out in proportion to (0.15 + score)^1.6, capped at 10 each, then rounded
// with the largest-remainder method.
import fs from 'node:fs';
import path from 'node:path';
import { REWORK_FIGHTERS } from '../src/data/statReworkData.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/data/element-props.json'), 'utf8'));
const TYPES = ['kinetic', 'heat', 'chemical', 'electrical', 'radiation'];
const FROZEN = new Set(['hydra', 'helen']);
const SHARP = Number(process.env.EL_SHARP || 1.6);
const FLOOR = Number(process.env.EL_FLOOR || 0.15);

const els = Object.values(P).sort((a, b) => a.z - b.z);
// ---- gaps (documented estimates; nothing in the databases for these) ----
for (const e of els) {
  e.estimated = [];
  if (e.mohs == null) { e.mohs = e.z <= 103 ? 2.5 : e.z <= 111 ? 4 : 1; e.estimated.push('hardness'); }
  if (e.cond == null) { e.cond = e.z <= 103 ? 2 : e.z <= 111 ? 3 : 0.5; e.estimated.push('conductivity'); }
  const noble = [2, 10, 18, 36, 54, 86].includes(e.z);
  e.noble = noble;
  if (e.en == null && !noble) { e.en = e.z <= 103 ? 1.3 : e.z <= 111 ? 1.5 : 2.0; e.estimated.push('electronegativity'); }
  if (e.z === 86) e.noble = true;
  e.radioactive = !(e.z <= 82 && e.z !== 43 && e.z !== 61);
}
const noChem = new Set(Object.entries(REWORK_FIGHTERS).filter(([, f]) => f.def.chemical == null).map(([id]) => id));

function rankPct(vals) {   // average-rank percentile 0..1 (ties share)
  const idx = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(vals.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const p = ((i + j) / 2) / (idx.length - 1);
    for (let k = i; k <= j; k++) out[idx[k][1]] = p;
    i = j + 1;
  }
  return out;
}
const L = (v) => Math.log10(Math.max(v, 1e-6));
const pMass = rankPct(els.map((e) => L(e.mass)));
const pDens = rankPct(els.map((e) => L(e.density)));
const pHard = rankPct(els.map((e) => e.mohs));
const pMelt = rankPct(els.map((e) => L(e.mp)));
const pBoil = rankPct(els.map((e) => L(e.bp ?? e.mp * 1.8)));
const pCond = rankPct(els.map((e) => (e.cond > 0 ? L(e.cond) : -6)));
const react = els.map((e) => (e.noble ? 0 : Math.abs(e.en - 2.0)));
const pReact = rankPct(react);
const radScore = els.map((e) => {
  if (!e.radioactive) return 0;
  const lt = Math.log10(Math.max(e.maxhl_s ?? 1, 1e-9));
  return Math.min(1, Math.max(0, (17.5 - lt) / 24));   // 4.5 billion years -> 0; 1 ms -> ~0.82 (clamped)
});
const pRad = radScore;

const score = {};
els.forEach((e, i) => {
  const s = {
    atk: {
      kinetic: 0.7 * pHard[i] + 0.3 * pDens[i],
      heat: pBoil[i],
      chemical: e.noble ? null : pReact[i],
      electrical: pCond[i],
      radiation: pRad[i],
    },
    def: {
      kinetic: 0.5 * pDens[i] + 0.5 * pHard[i],
      heat: pMelt[i],
      chemical: e.noble ? null : 0.15 + 0.85 * (1 - pReact[i]),
      electrical: 1 - pCond[i],
      radiation: 0.6 * pDens[i] + 0.4 * pRad[i],
    },
  };
  score[e.id] = s;
});

function allocate(s, total) {
  const slots = [];
  for (const side of ['atk', 'def']) for (const t of TYPES) if (s[side][t] != null) slots.push({ side, t, w: Math.pow(FLOOR + s[side][t], SHARP), v: 0, capped: false });
  let left = total;
  const real = new Map();
  for (let guard = 0; guard < 20; guard++) {
    const free = slots.filter((x) => !x.capped);
    const sw = free.reduce((a, x) => a + x.w, 0);
    let again = false;
    for (const x of free) {
      const v = (left * x.w) / sw;
      if (v > 10) { x.v = 10; x.capped = true; again = true; }
    }
    if (!again) { for (const x of free) x.v = (left * x.w) / sw; break; }
    left = total - slots.filter((x) => x.capped).reduce((a, x) => a + x.v, 0);
  }
  // largest remainder
  for (const x of slots) x.n = Math.min(10, Math.floor(x.v));
  let rest = total - slots.reduce((a, x) => a + x.n, 0);
  const order = slots.filter((x) => !x.capped || x.n < 10).sort((a, b) => (b.v - b.n) - (a.v - a.n));
  for (let i = 0; rest > 0 && i < order.length * 3; i++) { const x = order[i % order.length]; if (x.n < 10) { x.n++; rest--; } }
  const out = { atk: {}, def: {} };
  for (const side of ['atk', 'def']) for (const t of TYPES) out[side][t] = s[side][t] == null ? null : slots.find((x) => x.side === side && x.t === t).n;
  return out;
}

// ---- weight: five equal bands of the mass/density score ----
const wScore = els.map((e, i) => 0.5 * pMass[i] + 0.5 * pDens[i]);
const order = wScore.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
const weight = {};
order.forEach(([, i], rank) => { weight[els[i].id] = 1 + Math.min(4, Math.floor((rank * 5) / els.length)); });

const rows = {};
const csv = ['fighter_id,fighter,element,atomic_number,weight,speed,' + TYPES.map((t) => 'atk_' + t).join(',') + ',' + TYPES.map((t) => 'def_' + t).join(',') + ',sheet_weight,sheet_total_abs_change,rationale'];
const f = (n, d = 2) => (Math.abs(n) >= 1000 ? Math.round(n) : Number(n.toPrecision(3)));
for (const e of els) {
  const id = e.id;
  const sheet = REWORK_FIGHTERS[id];
  let row;
  let why;
  if (FROZEN.has(id)) {
    row = { w: sheet.w, s: sheet.s, atk: sheet.atk, def: sheet.def };
    why = "Benjamin's own row, kept exactly as set";
  } else {
    const total = noChem.has(id) ? 24 : 30;
    const a = allocate(score[id], total);
    const w = weight[id];
    row = { w, s: 6 - w, atk: a.atk, def: a.def };
    const big = [];
    for (const side of ['atk', 'def']) for (const t of TYPES) if (row[side][t] != null) big.push([row[side][t], `${t.slice(0, 4)} ${side === 'atk' ? 'Atk' : 'Def'}`]);
    big.sort((x, y) => y[0] - x[0]);
    const top = big.slice(0, 2).map((x) => `${x[1]} ${x[0]}`).join(', ');
    const state = e.state?.toLowerCase();
    const bits = [`${e.name}: ${f(e.mass)} u, ${f(e.density)} g/cm3 -> Weight ${w}`];
    bits.push(`melts ${f(e.mp)} K`);
    if (e.cond > 0) bits.push(`conducts ${f(e.cond)} MS/m`); else bits.push('insulator');
    if (e.noble) bits.push('noble gas (no chemical)'); else if (e.en != null) bits.push(`EN ${e.en}`);
    if (e.radioactive) bits.push(`radioactive (longest half-life ${e.maxhl_s >= 3.156e7 ? f(e.maxhl_s / 3.156e7) + ' y' : f(e.maxhl_s) + ' s'})`);
    bits.push(`strongest: ${top}`);
    if (e.estimated.length) bits.push(`estimated: ${e.estimated.join('/')}`);
    why = bits.join('; ');
  }
  rows[id] = row;
  let change = 0;
  for (const side of ['atk', 'def']) for (const t of TYPES) change += Math.abs((row[side][t] ?? 0) - (sheet[side][t] ?? 0));
  csv.push([id, e.fighter, e.name, e.z, row.w, row.s, ...TYPES.map((t) => row.atk[t] ?? ''), ...TYPES.map((t) => row.def[t] ?? ''), sheet.w, change, '"' + why.replace(/"/g, "'") + '"'].join(','));
}
// sanity
for (const [id, r] of Object.entries(rows)) {
  const all = [...Object.values(r.atk), ...Object.values(r.def)].filter((v) => v != null);
  const sum = all.reduce((a, b) => a + b, 0);
  const want = noChem.has(id) ? 24 : 30;
  if (sum !== want || all.some((v) => v < 0 || v > 10) || r.w + r.s !== 6) throw new Error(`${id} breaks the rules: sum ${sum}`);
}
const fmt = (o) => `{ ${TYPES.map((t) => `${t}: ${o[t]}`).join(', ')} }`;
let js = `// GENERATED by tools/gen-element-stats.mjs from tools/data/element-props.json (real element properties). Do not hand-edit.\n`;
js += `// Smash Ring only: Weight, Speed and Attack/Defense per type derived from each fighter's real element (see the header of the generator).\n`;
js += `// Hydra's and Helen's rows are Benjamin's own and are copied from the sheet unchanged. The Campaign keeps the sheet (statReworkData.js).\n`;
js += `export const ELEMENT_STATS = {\n`;
for (const e of els) {
  const r = rows[e.id];
  js += `  ${e.id}: { w: ${r.w}, s: ${r.s}, atk: ${fmt(r.atk)}, def: ${fmt(r.def)} },\n`;
}
js += `};\n`;
fs.writeFileSync(path.join(ROOT, 'src/data/elementStats.js'), js);
const csvPath = process.env.EL_CSV || '/workspace/aksheet/element_stats_2026-11-03.csv';
fs.writeFileSync(csvPath, csv.join('\n') + '\n');
console.log('wrote', csvPath);
const wc = {}; for (const r of Object.values(rows)) wc[r.w] = (wc[r.w] || 0) + 1;
console.log('weights', wc);
