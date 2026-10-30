// Headless UI checks on chapter 1: enemies are not dimmed in the player phase, menu text fits, per-move reach,
// back-line units are clickable by their sprite, Enter confirms an attack in two presses (menu, then target).
// Screenshots: /workspace/pt/campaign5_ui_*.png     PORT=5173 node tools/campaign-ui-check.mjs
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push((e.stack || e.message).slice(0, 300)));
await page.goto(`http://127.0.0.1:${PORT}/?campspeed=6`, { waitUntil: 'load' });
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

// 1. nobody dims except units that have acted
const dims = () => ev(() => { const s = window.__camp; return [...s.views.values()].map((v) => ({ id: v.u.id, team: v.u.team, acted: v.u.acted, grey: !!v.grey, alpha: v.cont.alpha })); });
let d = await dims();
check(d.every((v) => !v.grey && v.alpha === 1), 'start of chapter: nothing dimmed');
await ev(() => window.__camp.endTurnPressed());
for (let i = 0; i < 240; i++) {
  const st = await ev(() => ({ phase: window.__camp.battle.phase, mode: window.__camp.mode, turn: window.__camp.battle.turn }));
  if (st.phase === 'player' && st.mode === 'idle' && st.turn === 2) break;
  if (await ev(() => !!window.__camp?.inDialogue)) await page.keyboard.press('Escape');
  if (i % 20 === 19) console.log('waiting', JSON.stringify(st));
  await sleep(1000);
}
await sleep(600);
d = await dims();
check(d.filter((v) => v.team === 'enemy').every((v) => !v.grey && v.alpha === 1), 'player phase: enemy units are not dimmed (even though they acted last phase)');
check(d.filter((v) => v.team === 'player' && !v.acted).every((v) => !v.grey && v.alpha === 1), 'player phase: ready allies are not dimmed');
await page.screenshot({ path: '/workspace/pt/campaign5_ui_player_phase_enemies_clear.png' });
// after acting, that unit (and only it) dims
await ev(() => { const s = window.__camp; const u = s.battle.players[0]; s.setCursor(u.x, u.y); s.confirm(u.x, u.y); });
await sleep(200);
await ev(() => { const s = window.__camp; s.confirm(s.sel.x, s.sel.y); });
await until(() => window.__camp.mode === 'menu', 'menu');
await ev(() => { const s = window.__camp; s.menuSel = s.menuItems.findIndex((i) => i.id === 'wait'); s.menuPick(); });
await sleep(500);
d = await dims();
check(d.filter((v) => v.grey).length === 1 && d.find((v) => v.grey).team === 'player', 'a unit that has acted dims, and only that one');

// 2. reach: Ben's Precision Strike is range 1 (a diagonal is 2 away), Gyro Disc 1-3 (sheet range 3); the menu says so
const reach = await ev(() => {
  const s = window.__camp, b = s.battle;
  const ben = b.players.find((u) => u.id === 'ben'), foe = b.enemies[0];
  s.placeUnit(ben, 5, 1); ben.acted = false;
  s.placeUnit(foe, 6, 2);                                            // diagonal: Manhattan distance 2
  s.setCursor(ben.x, ben.y); s.confirm(ben.x, ben.y); s.confirm(ben.x, ben.y);
  return true;
});
await until(() => window.__camp.mode === 'menu', 'ben menu');
const items = await ev(() => window.__camp.menuItems.filter((i) => i.move).map((i) => ({ label: i.label, tag: i.tag, disabled: !!i.disabled, note: i.note })));
const ps = items.find((i) => /precision/i.test(i.label)), gd = items.find((i) => /gyro/i.test(i.label));
check(ps && ps.disabled && /range 1/.test(ps.note) && /diagonal/.test(ps.note) && /R1$/.test(ps.tag), `diagonal foe: Precision Strike is out of reach and says why (${ps && ps.note})`);
check(gd && !gd.disabled && /R1-3$/.test(gd.tag), "diagonal foe: Gyro Disc (range 1-3) is available");
// 3. menu text fits next to its tag
const fit = await ev(() => window.__camp.menuRows.map((r, i) => { const it = window.__camp.menuItems[i]; return { label: it.label, right: r.x + r.width, limit: window.__camp.menuGeo.mx + window.__camp.menuGeo.w - 14 }; }));
check(fit.every((f) => f.right <= f.limit), 'menu: no label runs past the menu box');
await page.screenshot({ path: '/workspace/pt/campaign5_ui_menu_ranges.png' });
// Enter twice: menu item, then the target
await ev(() => { const s = window.__camp; s.menuSel = s.menuItems.findIndex((i) => /gyro/i.test(i.label)); s.paintMenu(); });
await page.keyboard.press('Enter'); await sleep(250);
check(await ev(() => window.__camp.mode === 'target' && !!window.__camp.pending), 'Enter on the move opens the forecast on the first target');
await page.keyboard.press('Enter'); await sleep(250);
check(await ev(() => window.__camp.mode === 'busy'), 'second Enter attacks (no third press)');
await until(() => window.__camp.mode === 'idle' || window.__camp.battle.phase !== 'player', 'after attack', 120000);

// 4. back-line sprites: a click on a sprite that overhangs the tile above selects that unit
await sleep(500);
const pick = await ev(() => {
  const s = window.__camp, b = s.battle;
  const rdy = b.players.filter((u) => !u.acted && u.alive).sort((a, c) => c.y - a.y)[0];
  const v = s.views.get(rdy.uid);
  const above = b.unitAt(rdy.x, rdy.y - 1);
  s.mode = 'idle';
  const hit = s.tileAt({ x: v.cont.x, y: v.cont.y - 60 });          // the sprite's head, drawn over the tile above
  return { want: { x: rdy.x, y: rdy.y }, got: hit, aboveFree: !above };
});
check(!pick.aboveFree || (pick.got.x === pick.want.x && pick.got.y === pick.want.y), 'clicking a back-line unit\'s head picks that unit, not the empty tile above');
check(errs.length === 0, 'no page errors ' + errs.join('|'));
await browser.close();
process.exit(fails.length ? 1 : 0);
