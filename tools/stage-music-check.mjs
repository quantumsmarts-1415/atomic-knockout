// Headless check: starting a match plays that stage's own track (a different one per stage), it stops when the match ends.
//   PORT=5173 node tools/stage-music-check.mjs
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push((e.stack || e.message).slice(0, 400)));
const failed = [];
page.on('response', (r) => { if (r.status() >= 400 && /music/.test(r.url())) failed.push(r.url()); });
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = async (fn, arg, label, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn, arg)) return; await sleep(150); } throw new Error('timeout ' + label); };
const fails = [];
const check = (ok, label) => { console.log(ok ? 'ok  ' : 'FAIL', label); if (!ok) fails.push(label); };
await until(() => window.game?.scene?.isActive?.('Title'), null, 'title');
const status = () => ev(async () => (await import('/src/campaign/music.js')).status());
const seen = [];
for (const stageId of ['elemental-isle', 'carbon-skyhook']) {
  await ev(() => { const g = window.game; if (g.scene.isActive('Battle')) g.scene.stop('Battle'); for (const sc of g.scene.getScenes(true)) g.scene.sleep(sc.scene.key); });
  await sleep(800);
  await ev((id) => {
    const g = window.game;
    g.scene.start('Battle', { players: [{ charId: 'hydra', palette: 0 }, { charId: 'helen', palette: 0 }], stocks: 3, stageId: id });
  }, stageId);
  await until(() => window.game.scene.isActive('Battle'), null, 'battle ' + stageId);
  let st = null;
  for (let i = 0; i < 60; i++) { st = await status(); if (st.current === `stage-${stageId}`) break; await sleep(250); }
  check(st.current === `stage-${stageId}`, `${stageId}: its own track is playing (${st.current})`);
  seen.push(st.current);
  await sleep(1500);
}
check(new Set(seen).size === 2, 'different stages play different tracks');
await ev(() => { const g = window.game; g.scene.stop('Battle'); g.scene.wake('Title'); });
await sleep(1500);
const after = await status();
check(after.current !== 'stage-carbon-skyhook' && after.wanted !== 'stage-carbon-skyhook', `music stops when the match scene ends (${after.current})`);
check(failed.length === 0, 'no music file 404s ' + failed.join(','));
check(errs.length === 0, 'no page errors ' + errs.join('|'));
await browser.close();
process.exit(fails.length ? 1 : 0);
