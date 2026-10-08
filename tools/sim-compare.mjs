// One seeded match, two clocks.
// Real-time uses the normal Phaser loop (?playtest=). Fast sim pumps 60 Hz
// steps (?sim=1). Same fighters, stage, stocks, duration, and seed.
//
//   node tools/sim-compare.mjs

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = Number(process.env.PORT || 5173);
const MS = Number(process.env.SIM_MS || 5000);
const STOCKS = 3;
const SEED = Number(process.env.SIM_SEED || 42);
const IDS = (process.env.SIM_IDS || 'chroma,helen').split(',');
const STAGE = 'elemental-isle';
const CHROME = process.env.PLAYWRIGHT_CHROME
  || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : '/usr/local/bin/google-chrome');

async function serverUp() {
  try {
    return (await fetch(`http://127.0.0.1:${PORT}/`)).ok;
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

function brief(report) {
  return {
    winnerId: report.winnerId,
    fallThroughs: report.fallThroughs ?? [],
    lowestY: report.lowestY ?? {},
    fighters: (report.fighters ?? []).map((f) => ({
      id: f.id,
      stocks: f.stocks,
      percent: f.percent,
      damageDealt: f.damageDealt,
      damageTaken: f.damageTaken,
    })),
    kos: report.kos ?? [],
  };
}

async function main() {
  const server = await ensureServer();
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  try {
    const live = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const liveUrl = `http://127.0.0.1:${PORT}/?playtest=${IDS.join(',')}&stage=${STAGE}&stocks=${STOCKS}&ms=${MS}&seed=${SEED}`;
    await live.goto(liveUrl, { waitUntil: 'domcontentloaded' });
    await live.waitForFunction(() => window.__akReport, null, { timeout: MS + 20000 });
    const liveReport = brief(await live.evaluate(() => window.__akReport));

    const sim = await browser.newPage({ viewport: { width: 480, height: 270 } });
    await sim.goto(`http://127.0.0.1:${PORT}/?sim=1&stage=${STAGE}&stocks=${STOCKS}&ms=${MS}&seed=${SEED}`, { waitUntil: 'domcontentloaded' });
    await sim.waitForFunction(() => window.__akReady === true);
    const simReport = brief(await sim.evaluate(async ({ ids, ms, stocks, seed, stage }) => {
      return await window.__akRun({ ids, ms, stocks, seed, stageId: stage, speed: 30 });
    }, { ids: IDS, ms: MS, stocks: STOCKS, seed: SEED, stage: STAGE }));

    console.log('REAL', JSON.stringify(liveReport, null, 2));
    console.log('FAST', JSON.stringify(simReport, null, 2));

    const problems = [];
    if (liveReport.fallThroughs.length) problems.push(`real-time fall-throughs: ${JSON.stringify(liveReport.fallThroughs)}`);
    if (simReport.fallThroughs.length) problems.push(`fast-sim fall-throughs: ${JSON.stringify(simReport.fallThroughs)}`);
    if (liveReport.winnerId !== simReport.winnerId) problems.push(`winner ${liveReport.winnerId} vs ${simReport.winnerId}`);
    for (const liveF of liveReport.fighters) {
      const simF = simReport.fighters.find((f) => f.id === liveF.id);
      if (!simF) { problems.push(`missing ${liveF.id}`); continue; }
      if (liveF.stocks !== simF.stocks) problems.push(`${liveF.id} stocks ${liveF.stocks} vs ${simF.stocks}`);
      const dealtGap = Math.abs(liveF.damageDealt - simF.damageDealt);
      const takenGap = Math.abs(liveF.damageTaken - simF.damageTaken);
      if (dealtGap > 25) problems.push(`${liveF.id} dealt ${liveF.damageDealt} vs ${simF.damageDealt}`);
      if (takenGap > 25) problems.push(`${liveF.id} taken ${liveF.damageTaken} vs ${simF.damageTaken}`);
      const low = simReport.lowestY[liveF.id] ?? 0;
      if (low > 800 && (simF.damageTaken ?? 0) < 5) problems.push(`${liveF.id} fast-sim lowestY ${low} with almost no damage`);
    }
    if (problems.length) {
      console.log('DIFF');
      for (const p of problems) console.log(' -', p);
      process.exitCode = 1;
    } else {
      console.log('MATCH similar outcome, no fall-throughs');
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
