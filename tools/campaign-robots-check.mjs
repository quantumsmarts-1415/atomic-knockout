// Campaign robots in headless Chrome: every robot shares one body and wears its element's colour (map, panel, close-up),
// waves arrive with a flash and the same tint, Silas's cell and the Overseer appear in the last chapter.
// Screenshots: $SHOTS (default /workspace/aksheet/shots)    PORT=5173 node tools/campaign-robots-check.mjs
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5173;
const SHOTS = process.env.SHOTS || '/workspace/aksheet/shots';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push((e.stack || e.message).slice(0, 400)));
const bad = [];
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
await page.goto(`http://127.0.0.1:${PORT}/?campspeed=4`, { waitUntil: 'load' });
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = async (fn, label, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn)) return; await sleep(120); } throw new Error('timeout ' + label); };
const fails = [];
const check = (ok, label) => { console.log(ok ? 'ok  ' : 'FAIL', label); if (!ok) fails.push(label); };
await until(() => window.game?.scene?.isActive?.('Title'), 'title');
await sleep(2000);

async function openChapter(index, party) {
  await ev(async ({ index, party }) => {
    const m = await import('/src/campaign/index.js');
    let save = m.newCampaign();
    for (const id of party) if (!save.party.some((r) => r.id === id)) save.party.push(m.makeRecord(id, 3));
    save = { ...save, chapter: index };
    // what the Campaign scene does before a chapter: load the idle sheets of everyone on this chapter's stage (robots: the one shared body)
    const { chapterFighterIds } = await import('/src/scenes/CampaignScene.js');
    const { loadCampaignArt } = await import('/src/campaign/art.js');
    const host = window.game.scene.getScenes(true)[0];
    await new Promise((res) => loadCampaignArt(host, chapterFighterIds(save, m.CHAPTERS[index]), 'idle', res));
    window.game.scene.getScenes(true).forEach((s) => window.game.scene.stop(s.scene.key));
    window.game.scene.start('CampaignBattle', { chapterIndex: index, save, seed: 7 });
  }, { index, party });
  await until(() => window.game.scene.isActive('CampaignBattle') && !!window.__camp, 'battle scene', 180000);
  for (let i = 0; i < 80; i++) {
    if (await ev(() => window.__camp?.mode === 'idle' && !window.__camp?.inDialogue)) break;
    await page.keyboard.press('Escape'); await sleep(400);
  }
  await until(() => window.__camp?.mode === 'idle', 'idle', 120000);
  await sleep(1500); // let the idle sheets and walk/attack clips stream in
}

const robotViews = () => ev(() => {
  const s = window.__camp;
  return [...s.views.values()].filter((v) => v.u.robot).map((v) => ({
    id: v.u.id, name: v.u.name, tint: v.u.tint, hasRig: !!v.rig, body: v.rig?.charDef?.id, spriteTint: v.rig?.sprite?.tintTopLeft, tinted: v.rig?.sprite?.isTinted, scale: v.u.scale,
  }));
});

// 1. chapter 1: Nitrogen-Bots, one shared body, tinted
await openChapter(0, []);
let rv = await robotViews();
check(rv.length >= 3, `chapter 1 shows ${rv.length} robots`);
check(rv.every((r) => r.hasRig), 'every robot has a drawn body (placeholder or final art)');
check(new Set(rv.map((r) => r.body)).size === 1, `all robots share one body (${[...new Set(rv.map((r) => r.body))]})`);
check(rv.every((r) => r.tinted && r.spriteTint === r.tint), `every robot sprite wears its element colour 0x${rv[0]?.tint.toString(16)}`);
await ev(() => { const s = window.__camp; const u = s.battle.enemies[0]; s.setCursor(u.x, u.y); });
await sleep(400);
await page.screenshot({ path: `${SHOTS}/robots_ch1_start.png` });
const panel = await ev(() => { const s = window.__camp; const u = s.battle.enemies[0]; return s.panel.objs.map((o) => o.text).filter(Boolean).join(' | '); });
check(/NITROGEN-BOT/.test(panel) && /ROBOT/.test(panel), `panel names the robot: ${panel.slice(0, 80)}`);

// 2. a wave arrives with a flash and the same tint; a quick win never skips it
await ev(async () => {
  const s = window.__camp, b = s.battle;
  window.__wave = { before: b.enemies.length };
  for (const e of b.enemies) { e.alive = false; e.hp = 0; const v = s.views.get(e.uid); if (v) { v.cont.destroy(); s.views.delete(e.uid); } }
  window.__wave.result = b.updateResult();
  const list = b.checkEvents('death', { unit: b.units[0] });
  window.__wave.fired = list.length;
  s.runEvents(list).then(() => { window.__wave.done = true; });
});
await sleep(900);
await page.screenshot({ path: `${SHOTS}/robots_ch1_wave.png` });
for (let i = 0; i < 40 && !(await ev(() => window.__wave.done)); i++) { await page.keyboard.press('Escape'); await sleep(300); }
const w = await ev(() => window.__wave);
check(w.result === null && w.fired === 1, `clearing the field does not win; it calls the wave (result=${w.result}, fired=${w.fired})`);
rv = await robotViews();
check(rv.length >= 1 && rv.every((r) => r.tinted && r.spriteTint === r.tint), 'the wave robots arrive tinted');

// 3. a robot attacking: close-up draws the tinted body (two fighters on stage), no errors
await ev(() => {
  const s = window.__camp, b = s.battle;
  b.rng = () => 0.3;
  const foe = b.enemies[0], tgt = b.players.find((u) => !u.lord);
  window.__cut = { foe: foe.uid, tints: [], done: false };
  s.combat(foe, tgt, foe.moves.find((m) => m.attack && !m.charge)).then(() => { window.__cut.done = true; });
  const tick = () => { for (const v of s.cutViews) if (v.u.robot) window.__cut.tints.push([v.rig.sprite?.tintTopLeft, v.u.tint]); if (!window.__cut.done) setTimeout(tick, 50); };
  tick();
});
await sleep(700);
await page.screenshot({ path: `${SHOTS}/robots_ch1_closeup.png` });
await until(() => window.__cut.done, 'robot combat', 60000);
const cut = await ev(() => window.__cut);
check(cut.tints.length > 0 && cut.tints.every(([a, b]) => a === b), `close-up robot wears its colour (${cut.tints.length} samples)`);

// 4. last chapter: a rainbow of tints, the Overseer boss and Silas's cell
await openChapter(9, ['helen', 'titan', 'fey', 'nitra', 'oxana', 'natalie', 'kyle']);
rv = await robotViews();
const tints = new Set(rv.map((r) => r.tint));
check(tints.size >= 6, `the Master Core army wears ${tints.size} different element colours`);
check(rv.every((r) => r.tinted && r.spriteTint === r.tint), 'every Master Core robot is tinted');
const boss = rv.find((r) => r.name === 'The Overseer');
check(!!boss && boss.scale === 1.5, 'the Overseer is the big master robot');
const cell = await ev(() => { const u = window.__camp.battle.units.find((x) => x.team === 'npc'); return u ? `${u.id}@${u.x},${u.y}` : null; });
check(cell === 'silas@9,1', `Silas waits in his cell (${cell})`);
const obj = await ev(() => window.__camp.objectiveLine());
check(/DEFEAT THE OVERSEER/.test(obj), `objective line: ${obj}`);
await page.screenshot({ path: `${SHOTS}/robots_ch10_start.png` });
check(errs.length === 0, 'no page errors ' + errs.join(' | '));
check(bad.length === 0, 'no failed requests ' + [...new Set(bad)].join(' | '));
await browser.close();
process.exit(fails.length ? 1 : 0);
