// Headless check of Note 3: Back/Esc/B/right-click undo a move until an action is confirmed.
//   PORT=5173 node tools/campaign-undo-check.mjs      (screenshots: /workspace/pt/campaign4_undo_*.png)
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.stack.slice(0, 300)));
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
const state = () => ev(() => { const s = window.__camp; const u = s.sel; return { mode: s.mode, x: u?.x, y: u?.y, acted: u?.acted, back: s.backBtn?.container.visible, menu: !!s.menuObjs }; });
const press = async (k) => { await page.keyboard.press(k); await sleep(250); };
const info = await ev(() => { const s = window.__camp; const b = s.battle; const u = b.players[0]; s.setCursor(u.x, u.y); s.confirm(u.x, u.y); const all = [...s.reach.stops.values()].filter((p) => p.x !== u.x || p.y !== u.y); const t = all.find((p) => { const old = [u.x, u.y]; u.x = p.x; u.y = p.y; const n = b.targetsFrom(u).length; u.x = old[0]; u.y = old[1]; return n; }) || all[0]; return { ox: u.x, oy: u.y, to: { x: t.x, y: t.y } }; });
await sleep(300);
let st = await state(); check(st.mode === 'move' && st.back, 'select -> move mode, Back button visible');
await ev((to) => { const s = window.__camp; s.setCursor(to.x, to.y); s.confirm(to.x, to.y); }, info.to);
await until(() => window.__camp.mode === 'menu', 'menu after move');
st = await state(); check(st.x === info.to.x && st.y === info.to.y && st.menu, 'moved, action menu open');
await page.screenshot({ path: '/workspace/pt/campaign4_undo_menu.png' });
for (const [name, fire] of [['Escape', () => press('Escape')], ['B key', () => press('b')], ['Back button', async () => { const p = await ev(() => { const c = window.__camp.backBtn.container; return { x: c.x, y: c.y }; }); await page.mouse.click(p.x, p.y); await sleep(300); }], ['right click', async () => { await page.mouse.click(40, 400, { button: 'right' }); await sleep(250); }]]) {
  await fire();
  st = await state();
  check(st.mode === 'move' && st.x === info.ox && st.y === info.oy && !st.acted && !st.menu, `${name}: menu -> back on the original tile, not acted`);
  // the unit's view is back on its tile too
  await ev((to) => { const s = window.__camp; s.setCursor(to.x, to.y); s.confirm(to.x, to.y); }, info.to);
  await until(() => window.__camp.mode === 'menu', 'menu again');
}
// attack target menu -> back to the menu -> back to the tile
const hasAttack = await ev(() => window.__camp.menuItems.some((i) => i.id === 'attack' && !i.disabled));
if (hasAttack) {
  await ev(() => { const s = window.__camp; s.menuSel = s.menuItems.findIndex((i) => i.id === 'attack' && !i.disabled); s.menuPick(); });
  st = await state(); check(st.mode === 'target', 'Attack -> target mode');
  await press('Escape'); st = await state(); check(st.mode === 'menu' && st.menu, 'Esc in target mode -> action menu');
} else console.log('(no attack target from this tile; skipped target step)');
await press('Escape'); st = await state(); check(st.mode === 'move' && st.x === info.ox, 'Esc again -> original tile');
await page.screenshot({ path: '/workspace/pt/campaign4_undo_back.png' });
await press('Escape'); st = await state(); check(st.mode === 'idle', 'Esc again -> deselected');
// confirming an action makes the move final
await ev((o) => { const s = window.__camp; s.setCursor(o.ox, o.oy); s.confirm(o.ox, o.oy); }, info);
await ev((to) => { const s = window.__camp; s.setCursor(to.x, to.y); s.confirm(to.x, to.y); }, info.to);
await until(() => window.__camp.mode === 'menu', 'menu 3');
await ev(() => { const s = window.__camp; s.menuSel = s.menuItems.findIndex((i) => i.id === 'wait'); s.menuPick(); });
await until(() => window.__camp.mode === 'idle' || window.__camp.battle.phase !== 'player', 'after wait');
const fin = await ev((o) => { const u = window.__camp.battle.players[0]; return { x: u.x, y: u.y, acted: u.acted }; }, info);
check(fin.acted && fin.x === info.to.x, 'Wait confirms the move: unit stays on the new tile and is done');
check(errs.length === 0, 'no page errors ' + errs.join('|'));
await browser.close();
process.exit(fails.length ? 1 : 0);
