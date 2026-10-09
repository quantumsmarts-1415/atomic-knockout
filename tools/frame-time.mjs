#!/usr/bin/env node
// 4-player frame-time check. Boots a live match (the real rAF loop, not the
// sim fast-forward) and samples Phaser's frame delta for a few seconds.
//
//   node tools/frame-time.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright-core');

const port = Number(process.env.PORT || 5173);
const ids = process.env.FRAME_IDS || 'sarge,ira,thor,zora';
const seconds = Number(process.env.FRAME_SECONDS || 4);
const out = process.env.FRAME_OUT || '/opt/cursor/artifacts/wave6/frame-time-4p.jpg';
mkdirSync('/opt/cursor/artifacts/wave6', { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--disable-gpu', '--no-sandbox', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
const url = `http://127.0.0.1:${port}/?playtest=${ids}&stocks=3&ms=60000&seed=11&stage=elemental-isle`;
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const b = window.game?.scene?.getScene?.('Battle');
  return b?.fighters?.length >= 4 && b.fighters.every((f) => f.body && f.rig);
}, null, { timeout: 60000 });

const report = await page.evaluate(async (seconds) => {
  const loop = window.game.loop;
  const samples = [];
  const start = performance.now();
  await new Promise((resolve) => {
    const tick = () => {
      samples.push(loop.delta);
      if (performance.now() - start >= seconds * 1000) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  samples.sort((a, b) => a - b);
  const at = (p) => samples[Math.min(samples.length - 1, Math.round((samples.length - 1) * p))];
  const b = window.game.scene.getScene('Battle');
  return {
    n: samples.length,
    fighters: b.fighters.map((f) => f.charDef.id),
    min: at(0),
    p50: at(0.5),
    p95: at(0.95),
    max: at(1),
    actualFps: Math.round(loop.actualFps),
  };
}, seconds);

await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
await browser.close();
const summary = { ...report, pageErrors: errors.length, errors: errors.slice(0, 3) };
console.log(JSON.stringify(summary));
if (errors.length || !(report.n >= seconds * 20) || report.p95 > 50) {
  console.error('4-player frame time is outside the check');
  process.exit(1);
}
