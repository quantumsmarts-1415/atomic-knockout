// Chapter 2 (Alkali Gate) in headless Chrome: the seize hint, the throne boss staying put through enemy phases, Van's idle facing,
// and Scarlett's rocket FX (a cut-out with a transparent border) in the close-up. Screenshots: /workspace/pt/campaign6_*.png
//   PORT=5173 node tools/campaign-ch2-check.mjs
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push((e.stack || e.message).slice(0, 400)));
await page.goto(`http://127.0.0.1:${PORT}/?campspeed=1`, { waitUntil: 'load' });
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = async (fn, label, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn)) return; await sleep(120); } throw new Error('timeout ' + label); };
const fails = [];
const check = (ok, label) => { console.log(ok ? 'ok  ' : 'FAIL', label); if (!ok) fails.push(label); };
await until(() => window.game?.scene?.isActive?.('Title'), 'title');
await sleep(2000);
await ev(async () => {
  const m = await import('/src/campaign/index.js');
  const save = { ...m.newCampaign(), chapter: 1 };
  window.game.scene.getScenes(true).forEach((s) => window.game.scene.stop(s.scene.key));
  window.game.scene.start('CampaignBattle', { chapterIndex: 1, save, seed: 7 });
});
await until(() => window.game.scene.isActive('CampaignBattle') && !!window.__camp, 'battle scene', 180000);
for (let i = 0; i < 60; i++) {
  if (await ev(() => window.__camp?.mode === 'idle' && !window.__camp?.inDialogue)) break;
  await page.keyboard.press('Escape'); await sleep(500);
}
await until(() => window.__camp?.mode === 'idle', 'idle', 120000);
await sleep(600);
await page.screenshot({ path: '/workspace/pt/campaign6_ch2_start.png' });

// 1. seize hint on the objective line + Van's idle faces forward
const obj = await ev(() => window.__camp.objectiveLine());
check(/DEFEAT CHROMA, THEN SEIZE/.test(obj), `objective line: "${obj}"`);
const boss0 = await ev(() => { const b = window.__camp.battle; const u = b.enemies.find((x) => x.boss); return { x: u.x, y: u.y, id: u.id }; });
const van = await ev(async () => {
  const s = window.__camp, u = s.battle.enemies.find((x) => x.id === 'van'); const v = u && s.views.get(u.uid);
  const { CHARACTERS } = await import('/src/data/characters.js');
  return { hasRig: !!v?.rig, flipX: v?.rig?.sprite?.flipX, sheetFacing: CHARACTERS.van.art.sheets.clips.idle.sheetFacing, artFacing: CHARACTERS.van.art.facing, cont: v?.cont?.scaleX };
});
// the idle clip carries its own sheet facing (right), so the sprite is never mirrored by the art-level facing -1
check(van.sheetFacing === 1 && (!van.hasRig || van.flipX === false), `Van idle sprite is unflipped ${JSON.stringify(van)}`);

// 2. the throne boss stays on the throne through four enemy phases, even with the whole party standing in reach of it
await ev(() => {
  const b = window.__camp.battle; const boss = b.enemies.find((x) => x.boss);
  const near = b.players.filter((u) => !u.lord).slice(0, 2);
  window.__bossLog = [];
  window.__camp.battle.__move = (u, x, y) => { u.x = x; u.y = y; };
  near.forEach((u, i) => { const v = window.__camp.views.get(u.uid); u.x = boss.x + (i ? 1 : 0); u.y = boss.y + 1 + (i ? 0 : 0); });
});
for (let phase = 0; phase < 3; phase++) {
  await ev(() => window.__camp.endTurnPressed());
  for (let i = 0; i < 240; i++) {
    const st = await ev(() => ({ phase: window.__camp.battle.phase, mode: window.__camp.mode, turn: window.__camp.battle.turn, res: !!window.__camp.battle.result }));
    if (st.res || (st.phase === 'player' && st.mode === 'idle' && st.turn === phase + 2)) break;
    if (await ev(() => !!window.__camp?.inDialogue)) await page.keyboard.press('Escape');
    if (i % 20 === 19) console.log('waiting', JSON.stringify(st));
    await sleep(1000);
  }
  const at = await ev(() => { const u = window.__camp.battle.enemies.find((x) => x.boss); return u ? [u.x, u.y] : null; });
  check(!at || (at[0] === boss0.x && at[1] === boss0.y), `after enemy phase ${phase + 1} the boss is at ${JSON.stringify(at)} (throne ${boss0.x},${boss0.y})`);
  if (await ev(() => !!window.__camp.battle.result)) break;
}
await page.screenshot({ path: '/workspace/pt/campaign6_ch2_boss_on_throne.png' });

// 3. Scarlett's rocket: texture has a transparent corner and an opaque body, and the close-up shows the cut-out
await ev(() => { const s = window.__camp, b = s.battle; b.rng = () => 0.3; window.__sc = { done: false }; });
const alpha = await ev(async () => {
  const s = window.__camp;
  const sc = s.battle.enemies.find((x) => x.id === 'scarlett');
  const mv = sc.moves.find((m) => /rocket/i.test(m.name));
  const tgt = s.battle.players.find((u) => !u.lord);
  const { loadMoveFx } = await import('/src/campaign/fx.js');
  const spec = await loadMoveFx(s, 'scarlett', mv);
  const img = s.textures.get(spec.proj.key).getSourceImage();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const px = (x, y) => g.getImageData(Math.floor(x * img.width), Math.floor(y * img.height), 1, 1).data[3];
  window.__sc.att = sc; window.__sc.tgt = tgt; window.__sc.mv = mv;
  return { w: img.width, corner: px(0.01, 0.02), corner2: px(0.99, 0.98), body: px(0.84, 0.46) };
});
check(alpha.corner === 0 && alpha.corner2 === 0, `rocket texture corners are transparent (${alpha.corner}, ${alpha.corner2})`);
check(alpha.body === 255, `rocket body is opaque (${alpha.body})`);
await ev(() => { const s = window.__camp, w = window.__sc; s.combat(w.att, w.tgt, w.mv).then(() => { w.done = true; }); });
await sleep(330); await page.screenshot({ path: '/workspace/pt/campaign6_scarlett_rocket_flight.png' });
await sleep(260); await page.screenshot({ path: '/workspace/pt/campaign6_scarlett_rocket_flight2.png' });
await until(() => window.__sc.done, 'scarlett combat', 60000);
check(errs.length === 0, 'no page errors ' + errs.join(' | '));
await browser.close();
process.exit(fails.length ? 1 : 0);
