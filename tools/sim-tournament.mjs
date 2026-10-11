// Headless CPU tournament. One browser page loads every cutout via ?sim=1,
// then restarts Battle for each match and pumps fixed 60 Hz steps.
//
// Every match is a full round: 3 stocks, normal percent, and it runs until
// the stock rules leave one fighter. That takes at least one knockout.
// There is no match clock and no time-out win.
//
//   npm run sim
//   SIM_LIMIT=2 SIM_TAG=smoke npm run sim
//   SIM_PAIR=1 SIM_ONLY=helen,tara npm run sim   # just those matchups, with a pair log
//
// Writes an aggregate JSON (win rate, damage, KO time, damage by type)
// to SIM_OUT (default /tmp/ak-sim/<tag>.json). Duels and 3-player FFAs
// are scored separately.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { ROSTER } from '../src/data/characters.js';
import { MATCH_STOCKS, isFullRound } from '../src/engine/matchRules.js';

const PORT = Number(process.env.PORT || 5173);
const OUT = process.env.SIM_OUT || '/tmp/ak-sim';
const TAG = process.env.SIM_TAG || 'run';
const STOCKS = MATCH_STOCKS;
const REPS = Number(process.env.SIM_REPS || 3);
const PAGES = Math.max(1, Number(process.env.SIM_PAGES || 4));
const LIMIT = Number(process.env.SIM_LIMIT || 0);
const STAGE = process.env.SIM_STAGE || 'elemental-isle';
const CHROME = process.env.PLAYWRIGHT_CHROME
  || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : '/usr/local/bin/google-chrome');

const IDS = ROSTER.map((c) => c.id);
const ONLY = (process.env.SIM_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const PAIR = process.env.SIM_PAIR === '1';
const TYPES = ['kinetic', 'heat', 'electrical', 'chemical', 'radiation'];

const TRIOS = [
  ['hydra', 'helen', 'lillie'],
  ['ben', 'bord', 'carter'],
  ['nitra', 'oxana', 'flora'],
  ['neo', 'natalie', 'maggie'],
  ['allen', 'silas', 'phillip'],
  ['sully', 'chloe', 'aaron'],
  ['kyle', 'cal', 'scarlett'],
  ['titan', 'van', 'chroma'],
  ['tara', 'wolf', 'rex'],
  ['oz', 'pit', 'chroma'],
  ['tara', 'hydra', 'helen'],
  ['wolf', 'van', 'titan'],
  ['caesar', 'barry', 'brock'],
  ['aurelius', 'talia', 'bianca'],
  ['polonius', 'tate', 'ray'],
  ['agatha', 'cody', 'collin'],
  ['cooper', 'ceres', 'europa'],
  ['dizzy', 'erin', 'thor'],
  ['ace', 'ray', 'polonius'],
  ['caesar', 'helen', 'aurelius'],
  ['frank', 'manny', 'fey'],
  ['nick', 'molly', 'paula'],
  ['haley', 'ira', 'hog'],
  ['gail', 'indy', 'pablo'],
  ['arsenio', 'iona', 'krypto'],
  ['lana', 'goldie', 'holly'],
  ['lucy', 'frank', 'pablo'],
  ['krypto', 'hydra', 'helen'],
  ['percy', 'rhoda', 'ronan'],
  ['ruben', 'ruth', 'saab'],
  ['sam', 'sandy', 'selena'],
  ['sterling', 'terra', 'tessa'],
  ['tex', 'thule', 'xander'],
  ['yara', 'yvette', 'zane'],
  ['selena', 'ronan', 'sterling'],
  ['yara', 'zane', 'thule'],
  ['duke', 'flo', 'ogden'],
  ['ford', 'boar', 'roger'],
  ['gertrude', 'nadia', 'niobe'],
  ['prometheus', 'zora', 'einstein'],
  ['copernicus', 'fermi', 'ogden'],
  ['sarge', 'mae', 'mac'],
  ['liv', 'tess', 'ogden'],
  ['sarge', 'liv', 'ira'],
];

function matchSeed(kind, ids, rep) {
  let h = 2166136261;
  const s = `${kind}:${rep}:${ids.join(',')}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) || 1;
}

function sampleJobs() {
  const n = Number(process.env.SIM_SAMPLE || 0);
  if (!(n > 0) || !ONLY.length) return null;
  const others = IDS.filter((id) => !ONLY.includes(id));
  const list = [];
  for (const id of ONLY) {
    const picks = [];
    let cursor = 2166136261;
    for (let i = 0; i < id.length; i++) cursor = Math.imul(cursor ^ id.charCodeAt(i), 16777619) >>> 0;
    while (picks.length < Math.min(n, others.length)) {
      cursor = (Math.imul(cursor, 1664525) + 1013904223) >>> 0;
      const opp = others[cursor % others.length];
      if (!picks.includes(opp)) picks.push(opp);
    }
    for (const opp of picks) {
      list.push({ kind: 'duel', ids: [id, opp], seed: matchSeed('sample', [id, opp], 0) });
    }
  }
  return list;
}

function jobs() {
  const sampled = sampleJobs();
  if (sampled) return LIMIT > 0 ? sampled.slice(0, LIMIT) : sampled;
  const list = [];
  for (let i = 0; i < IDS.length; i++) {
    for (let j = i + 1; j < IDS.length; j++) {
      if (ONLY.length && !ONLY.includes(IDS[i]) && !ONLY.includes(IDS[j])) continue;
      if (PAIR && ONLY.length && !(ONLY.includes(IDS[i]) && ONLY.includes(IDS[j]))) continue;
      for (let r = 0; r < REPS; r++) {
        const pair = r % 2 === 0 ? [IDS[i], IDS[j]] : [IDS[j], IDS[i]];
        list.push({ kind: 'duel', ids: pair, seed: matchSeed('duel', pair, r) });
      }
    }
  }
  if (!ONLY.length) for (const trio of TRIOS) {
    for (let r = 0; r < 2; r++) {
      const ids = r % 2 === 0 ? trio : [trio[1], trio[2], trio[0]];
      list.push({ kind: 'ffa', ids, seed: matchSeed('ffa', ids, r) });
    }
  }
  return LIMIT > 0 ? list.slice(0, LIMIT) : list;
}

function blank() {
  return {
    matches: 0,
    wins: 0,
    damageDealt: 0,
    damageTaken: 0,
    koScored: 0,
    koScoredTime: 0,
    koSuffered: 0,
    koSufferedTime: 0,
    dealtByType: Object.fromEntries(TYPES.map((t) => [t, 0])),
    takenByType: Object.fromEntries(TYPES.map((t) => [t, 0])),
  };
}

const koPercents = { sum: 0, n: 0 };
const koHist = {};
const clock = { finished: 0, timedOut: 0, koTimeSum: 0, koTimeN: 0, elapsedSum: 0, elapsedMax: 0, collisionUsSum: 0, collisionN: 0 };

function addMatch(table, report) {
  if (!isFullRound(report, STOCKS)) {
    clock.timedOut += 1;
    throw new Error('round ended without a knockout');
  }
  const start = report.matchStart ?? 0;
  for (const f of report.fighters) {
    const row = table[f.id] ?? (table[f.id] = blank());
    row.matches += 1;
    if (report.winnerId === f.id) row.wins += 1;
    row.damageDealt += f.damageDealt ?? 0;
    row.damageTaken += f.damageTaken ?? 0;
    for (const t of TYPES) {
      row.dealtByType[t] += f.dealtByType?.[t] ?? 0;
      row.takenByType[t] += f.takenByType?.[t] ?? 0;
    }
  }
  for (const ko of report.kos ?? []) {
    const dt = Math.max(0, (ko.t ?? start) - start);
    if (ko.killer && table[ko.killer]) {
      table[ko.killer].koScored += 1;
      table[ko.killer].koScoredTime += dt;
    }
    if (ko.victim && table[ko.victim]) {
      table[ko.victim].koSuffered += 1;
      table[ko.victim].koSufferedTime += dt;
    }
    if (Number.isFinite(ko.percent)) {
      koPercents.sum += ko.percent;
      koPercents.n += 1;
      clock.koTimeSum += dt;
      clock.koTimeN += 1;
      const bucket = Math.floor(ko.percent / 20) * 20;
      koHist[bucket] = (koHist[bucket] || 0) + 1;
    }
  }
  clock.finished += 1;
  const elapsed = report.elapsedMs ?? 0;
  clock.elapsedSum += elapsed;
  if (Number.isFinite(report.collisionUs)) {
    clock.collisionUsSum += report.collisionUs;
    clock.collisionN += 1;
  }
  if (elapsed > clock.elapsedMax) clock.elapsedMax = elapsed;
}

function finish(table) {
  const rows = [];
  for (const id of IDS) {
    const row = table[id] ?? blank();
    const n = row.matches || 1;
    const avg = (bag) => Object.fromEntries(TYPES.map((t) => [t, Math.round((bag[t] ?? 0) / n)]));
    rows.push({
      id,
      matches: row.matches,
      wins: row.wins,
      winRate: row.matches ? row.wins / row.matches : 0,
      avgDamageDealt: Math.round(row.damageDealt / n),
      avgDamageTaken: Math.round(row.damageTaken / n),
      avgKoTimeScored: row.koScored ? Math.round(row.koScoredTime / row.koScored) : null,
      avgKoTimeSuffered: row.koSuffered ? Math.round(row.koSufferedTime / row.koSuffered) : null,
      kosScored: row.koScored,
      kosSuffered: row.koSuffered,
      avgDealtByType: avg(row.dealtByType),
      avgTakenByType: avg(row.takenByType),
    });
  }
  rows.sort((a, b) => b.winRate - a.winRate || a.id.localeCompare(b.id));
  return rows;
}

function markdown(rows) {
  const lines = [
    '| fighter | matches | win% | KOs | KOd | dealt | taken | KO time (ms) | dealt by type |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---|',
  ];
  for (const r of rows) {
    const types = TYPES.map((t) => `${t.slice(0, 4)} ${r.avgDealtByType[t]}`).join(', ');
    const ko = r.avgKoTimeScored == null ? '—' : String(r.avgKoTimeScored);
    lines.push(`| ${r.id} | ${r.matches} | ${(r.winRate * 100).toFixed(1)} | ${r.kosScored} | ${r.kosSuffered} | ${r.avgDamageDealt} | ${r.avgDamageTaken} | ${ko} | ${types} |`);
  }
  return lines.join('\n');
}

async function serverUp() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/`);
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await serverUp()) return null;
  const child = spawn('node', ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await serverUp()) return child;
    await new Promise((r) => setTimeout(r, 150));
  }
  child.kill();
  throw new Error('dev server did not start');
}

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
  page.setDefaultTimeout(300000);
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(`http://127.0.0.1:${PORT}/?sim=1&stage=${STAGE}&stocks=${STOCKS}&speed=8`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => window.__akReady === true);
  return { page, errors };
}

async function runOne(slot, job) {
  const report = await slot.page.evaluate(async ({ ids, stocks, stage, seed }) => {
    return await window.__akRun({ ids, stocks, stageId: stage, speed: 30, seed });
  }, { ids: job.ids, stocks: STOCKS, stage: STAGE, seed: job.seed });
  report.consoleErrors = slot.errors.splice(0).filter((e) => !/favicon|Failed to load resource/i.test(e));
  return report;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const queue = jobs();
  const server = await ensureServer();
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ],
  });
  const duels = {};
  const ffas = {};
  const failures = [];
  const pairLog = [];
  let done = 0;
  const started = Date.now();
  try {
    const slots = [];
    for (let i = 0; i < Math.min(PAGES, queue.length); i++) slots.push(await openPage(browser));
    let cursor = 0;
    async function worker(slot) {
      while (cursor < queue.length) {
        const index = cursor;
        cursor += 1;
        const job = queue[index];
        try {
          const report = await runOne(slot, job);
          if (job.kind === 'ffa') addMatch(ffas, report);
          else addMatch(duels, report);
          if (PAIR && job.kind === 'duel') {
            pairLog.push({
              ids: job.ids.join(' vs '),
              winner: report.winnerId,
              dealt: Object.fromEntries((report.fighters ?? []).map((f) => [f.id, Math.round(f.damageDealt ?? 0)])),
            });
          }
          if (report.consoleErrors?.length) {
            failures.push({ ids: job.ids, errors: report.consoleErrors.slice(0, 3) });
          }
        } catch (err) {
          failures.push({ ids: job.ids, errors: [String(err.message || err)] });
          try { await slot.page.close(); } catch { /* page already gone */ }
          Object.assign(slot, await openPage(browser));
        }
        done += 1;
        if (done % 20 === 0 || done === queue.length) {
          const sec = ((Date.now() - started) / 1000).toFixed(0);
          console.log(`progress ${done}/${queue.length} in ${sec}s failures=${failures.length}`);
        }
      }
    }
    await Promise.all(slots.map((slot) => worker(slot)));
    for (const slot of slots) await slot.page.close().catch(() => {});
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  const duelRows = finish(duels);
  const ffaRows = finish(ffas);
  const outside = duelRows.filter((r) => r.matches >= 6 && (r.winRate < 0.4 || r.winRate > 0.6));
  const payload = {
    tag: TAG,
    stage: STAGE,
    rule: 'full round until one fighter remains',
    stocks: STOCKS,
    reps: REPS,
    matches: queue.length,
    failures,
    avgKoPercent: koPercents.n ? Math.round(koPercents.sum / koPercents.n) : null,
    avgCollisionUs: clock.collisionN ? Math.round(clock.collisionUsSum / clock.collisionN) : null,
    koCount: koPercents.n,
    koHist,
    avgKoTimeMs: clock.koTimeN ? Math.round(clock.koTimeSum / clock.koTimeN) : null,
    matchesFinished: clock.finished,
    matchesTimedOut: clock.timedOut,
    avgElapsedMs: (clock.finished + clock.timedOut)
      ? Math.round(clock.elapsedSum / (clock.finished + clock.timedOut))
      : null,
    maxElapsedMs: clock.elapsedMax,
    outside,
    duels: duelRows,
    ffa: ffaRows,
    duelTable: markdown(duelRows),
    ffaTable: markdown(ffaRows),
  };
  const file = path.join(OUT, `${TAG}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  const played = (rows) => markdown(rows.filter((r) => r.matches > 0));
  if (pairLog.length) {
    console.log('\nPAIRS');
    for (const row of pairLog) console.log(`${row.ids} -> ${row.winner} ${JSON.stringify(row.dealt)}`);
  }
  console.log(`\nDUELS\n${played(duelRows)}`);
  if (ffaRows.some((r) => r.matches)) console.log(`\nFFA\n${played(ffaRows)}`);
  console.log(`\nwrote ${file}`);
  console.log(`avg KO% ${payload.avgKoPercent}  collision ${payload.avgCollisionUs} µs/step  outside ${outside.length}`);
  if (failures.length) console.log(`failures ${failures.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
