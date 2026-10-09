#!/usr/bin/env node
/**
 * After a 30s bot match, afterimages and hit effects must be back in the pool.
 * Writes one still of the stage once they have faded.
 *
 *   node tools/juice-clean.mjs
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright-core');

const port = Number(process.env.PORT || 5173);
const out = process.env.JUICE_OUT || '/opt/cursor/artifacts/polish/stage-clean.jpg';
mkdirSync('/opt/cursor/artifacts/polish', { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--disable-gpu', '--no-sandbox', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (err) => console.error('PAGE', err.message));
const url = `http://127.0.0.1:${port}/?playtest=ira,thor&stocks=3&ms=60000&seed=3&stage=elemental-isle`;
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const b = window.game?.scene?.getScene?.('Battle');
  return b?.fighters?.length >= 2 && b.fighters.every((f) => f.body && f.rig) && b.juice;
}, null, { timeout: 30000 });

const report = await page.evaluate(async () => {
  const b = window.game.scene.getScene('Battle');
  window.game.loop.sleep();
  // 30s at 60 Hz, with the CPUs fighting. captureFrame steps the sim and the juice.
  let peak = 0;
  for (let i = 0; i < 1800; i++) {
    b.captureFrame();
    peak = Math.max(peak, b.juice.effectCount());
  }
  const mid = b.juice.effectCount();
  for (const f of b.fighters) f.isBot = false;
  // Nothing new spawns. A dozen frames is the fade; give it forty.
  for (let i = 0; i < 40; i++) b.captureFrame();
  const renderer = window.game.renderer;
  renderer.preRender();
  window.game.scene.render(renderer);
  renderer.postRender();
  renderer.gl?.flush?.();
  return {
    peak,
    mid,
    after: b.juice.effectCount(),
    pool: b.juice.pool.length,
    live: b.juice.pool.filter((p) => p.active).length,
    arcs: b.juice.arcs.length,
  };
});
console.log(JSON.stringify(report));
await page.screenshot({ path: out, type: 'jpeg', quality: 80 });
await browser.close();
if (!(report.peak > 0) || report.after > 4) {
  console.error(`effects did not spawn and clear: ${JSON.stringify(report)}`);
  process.exit(1);
}
console.log(`clean frame ${out}`);
