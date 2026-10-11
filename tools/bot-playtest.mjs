// Headless CPU matches. Boots the dev server (or reuses PORT), loads
// /?playtest=id,id,id so only those cutouts download, and writes one JSON
// report per match plus a mid-fight screenshot.
//
// Each match is a full round: 3 stocks, normal percent, until the stock
// rules leave one fighter. A clock does not name the winner.
//
//   node tools/bot-playtest.mjs
//
// Chrome: PLAYWRIGHT_CHROME or /usr/bin/google-chrome.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { CHARACTERS } from '../src/data/characters.js';
import { MATCH_STOCKS, isFullRound } from '../src/engine/matchRules.js';

const PORT = Number(process.env.PORT || 5173);
const OUT = process.env.PLAYTEST_OUT || '/tmp/ak-playtest';
const STOCKS = MATCH_STOCKS;
const HANG_MS = 20 * 60 * 1000;
const CHROME = process.env.PLAYWRIGHT_CHROME
  || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : '/usr/local/bin/google-chrome');

const MATCHES = [
  ['hydra', 'helen', 'lillie'],
  ['ben', 'bord', 'carter'],
  ['nitra', 'oxana', 'flora'],
  ['neo', 'natalie', 'maggie'],
  ['allen', 'silas', 'phillip'],
  ['sully', 'chloe', 'aaron'],
  ['kyle', 'cal', 'scarlett'],
  ['titan', 'van', 'chroma'],
  ['hydra', 'chroma'],
  ['helen', 'van', 'flora'],
];

const SLOTS = ['basicCharge', 'basicDirectional', 'specialDefense', 'specialDirectional'];

function expectedMoves(id) {
  const moves = CHARACTERS[id].moves;
  return SLOTS.map((slot) => ({ slot, name: moves[slot].name, types: [moves[slot].type, moves[slot].type2].filter(Boolean) }));
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

function summarize(report) {
  const problems = [];
  for (const f of report.fighters) {
    const fired = report.movesFired;
    for (const move of expectedMoves(f.id)) {
      const key = `${f.id}:${move.name}`;
      if (!fired[key]) problems.push(`${f.id} never fired ${move.name}`);
      const hit = report.hits[key];
      if (!hit) continue;
      for (const type of Object.keys(hit)) {
        if (type === 'count') continue;
        if (!move.types.includes(type) && type !== 'heat' && type !== 'electrical' && type !== 'kinetic') {
          // bonus packets (burn, redox, calcify, flare) may add a type the
          // base move does not list. Flag only types that are not canonical.
        }
        const canonical = ['kinetic', 'heat', 'electrical', 'chemical', 'radiation'];
        if (!canonical.includes(type)) problems.push(`${key} logged unknown type ${type}`);
      }
    }
  }
  if (!isFullRound(report, STOCKS)) problems.push('round ended without a knockout');
  return problems;
}

async function runMatch(browser, ids) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  const url = `http://127.0.0.1:${PORT}/?playtest=${ids.join(',')}&stage=elemental-isle&stocks=${STOCKS}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const shotName = `${ids.join('-')}.png`;
  const shotPromise = page.waitForTimeout(4500).then(() => page.screenshot({ path: path.join(OUT, shotName) })).catch((err) => {
    errors.push(`screenshot: ${err.message}`);
  });
  const handle = await page.waitForFunction(() => window.__akReport, null, { timeout: HANG_MS });
  const report = await handle.jsonValue();
  await shotPromise;
  await page.close();
  report.consoleErrors = errors.filter((e) => !/favicon|Failed to load resource/i.test(e));
  report.problems = [...summarize(report), ...report.consoleErrors.map((e) => `console: ${e}`)];
  return { report, shotName };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await ensureServer();
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const index = [];
  let failed = 0;
  try {
    for (const ids of MATCHES) {
      process.stdout.write(`match ${ids.join(' vs ')} ... `);
      const { report, shotName } = await runMatch(browser, ids);
      const file = path.join(OUT, `${ids.join('-')}.json`);
      fs.writeFileSync(file, JSON.stringify(report, null, 2));
      const line = {
        ids,
        winner: report.winner,
        fighters: report.fighters,
        kos: report.kos,
        problems: report.problems,
        shot: path.join(OUT, shotName),
        file,
      };
      index.push(line);
      console.log(report.problems.length ? `PROBLEMS ${report.problems.length}` : `ok winner=${report.winner}`);
      if (report.problems.length) failed += 1;
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  const summaryPath = path.join(OUT, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(index, null, 2));
  console.log(`wrote ${summaryPath}`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
