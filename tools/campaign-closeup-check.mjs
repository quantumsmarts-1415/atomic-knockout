// Close-up checks: HP plates at the start of a charge release, a MISS (FX on the right side, no afterimage),
// and the backdrop (terrain-matched per side, no seam). Screenshots: /workspace/pt/campaign5_closeup_*.png
//   PORT=5173 node tools/campaign-closeup-check.mjs
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push((e.stack || e.message).slice(0, 300)));
await page.goto(`http://127.0.0.1:${PORT}/?campspeed=1`, { waitUntil: 'load' });
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = async (fn, label, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn)) return; await sleep(120); } throw new Error('timeout ' + label); };
const fails = [];
const check = (ok, label) => { console.log(ok ? 'ok  ' : 'FAIL', label); if (!ok) fails.push(label); };
await until(() => window.game?.scene?.isActive?.('Title'), 'title');
await sleep(2500); await page.keyboard.press('s'); await sleep(300); await page.keyboard.press('Enter');
await until(() => window.game.scene.isActive('Campaign'), 'menu'); await sleep(800); await page.keyboard.press('Enter');
for (let i = 0; i < 80 && !(await ev(() => window.game.scene.isActive('CampaignBattle') && !!window.__camp)); i++) { await page.keyboard.press('Enter'); await sleep(250); }
await until(() => window.__camp?.mode === 'idle' || window.__camp?.mode === 'move', 'battle idle', 180000);
for (let i = 0; i < 40 && await ev(() => !!window.__camp?.inDialogue); i++) { await sleep(500); await page.keyboard.press('Escape'); }
await until(() => window.__camp?.mode === 'idle', 'idle');

// 1. charge release: plates start at the HP from before the hit
await ev(() => {
  const s = window.__camp, b = s.battle;
  const ben = b.players.find((u) => u.id === 'ben'), cal = b.enemies[0];      // a robot: the close-up draws the shared body, tinted
  const mv = ben.moves.find((m) => m.charge);
  b.rng = () => 0.3;                           // every roll hits (no crit)
  b.startCharge(ben, mv); ben.acted = false;
  window.__t = { ben: ben.uid, cal: cal.uid, calId: cal.id, calHp: cal.hp, benHp: ben.hp, samples: [] };
  window.__done = false;
  s.combat(ben, cal, mv).then(() => { window.__done = true; });
  const tick = () => {
    const pl = s.cutPlates; if (pl) window.__t.samples.push([...pl.values()].map((p) => [p.u.id, Math.round(p.shown), p.hpT.text]));
    if (!window.__done) setTimeout(tick, 30);
  };
  tick();
});
await sleep(450); await page.screenshot({ path: '/workspace/pt/campaign5_closeup_release_start.png' });
await sleep(900); await page.screenshot({ path: '/workspace/pt/campaign5_closeup_release_hit.png' });
await until(() => window.__done, 'combat 1', 30000);
const t1 = await ev(() => window.__t);
const first = t1.samples[0];
const calStart = first && first.find((p) => p[0] === t1.calId);
check(!!calStart && calStart[1] === t1.calHp, `release close-up: defender plate starts at its pre-hit HP (${calStart ? calStart[1] : '?'} vs ${t1.calHp})`);
check(t1.samples.some((smp) => smp.find((p) => p[0] === t1.calId)[1] < t1.calHp), 'release close-up: the plate then drops with the hit');

// 2. miss: FX and recoil on the defender side, no duplicate sprite
await sleep(600);
await ev(() => {
  const s = window.__camp, b = s.battle;
  b.rng = () => 0.9999;                       // every roll misses
  const lil = b.players.find((u) => u.id === 'lillie'), aar = b.enemies[1];
  lil.charging = null; lil.acted = false; aar.hp = aar.maxHp;
  const mv = lil.moves.find((m) => m.charge);
  window.__done = false;
  window.__rigs = [];
  s.combat(lil, aar, mv).then(() => { window.__done = true; });
});
let fxOnMiss = 0, maxRigs = 0, backdropSeen = false;
for (let i = 0; i < 8; i++) {
  await sleep(220);
  const r = await ev(() => {
    const s = window.__camp;
    const top = s.children.list.filter((o) => o.depth >= 120);
    return { fx: top.filter((o) => (o.blendMode === 1 || o.blendMode === 3) && o.visible && o.alpha > 0.1 && o.type === 'Image').length, rigs: s.cutViews.length, ground: top.filter((o) => o.type === 'Image' && /^cutground/.test(o.texture?.key || '')).length };
  });
  fxOnMiss += r.fx; maxRigs = Math.max(maxRigs, r.rigs); backdropSeen = backdropSeen || r.ground > 0;
  await page.screenshot({ path: `/workspace/pt/campaign5_closeup_miss_${i}.png` });
}
await until(() => window.__done, 'combat 2', 30000);
check(fxOnMiss === 0, `a missed strike shows no impact FX on the target (${fxOnMiss} FX sprites seen)`);
check(maxRigs === 2, `exactly two fighters on stage during a close-up (${maxRigs})`);
check(backdropSeen, 'the close-up ground is the blended per-side terrain');
// 3. forest vs road: the two terrains blend across the middle (no hard seam)
await sleep(600);
await ev(() => {
  const s = window.__camp, b = s.battle;
  b.rng = () => 0.3;
  const lil = b.players.find((u) => u.id === 'lillie'), aar = b.enemies[1];
  s.placeUnit(lil, 0, 0); s.placeUnit(aar, 5, 3); lil.acted = false; lil.charging = null; aar.hp = aar.maxHp;
  window.__done = false;
  s.combat(lil, aar, lil.moves[0]).then(() => { window.__done = true; });
});
await sleep(700);
const strips = await ev(() => window.__camp.children.list.filter((o) => o.depth >= 120 && o.type === 'Image' && /^cutground/.test(o.texture?.key || '')).length);
await page.screenshot({ path: '/workspace/pt/campaign5_closeup_blend.png' });
check(strips >= 10, `forest vs road: ground drawn as a blended pair (${strips} layers)`);
await until(() => window.__done, 'combat 3', 30000);
check(errs.length === 0, 'no page errors ' + errs.join('|'));
await browser.close();
process.exit(fails.length ? 1 : 0);
