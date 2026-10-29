// Screenshots of the move menu, forecast, charging and status indicators in the real battle scene.
//   PORT=5173 node tools/campaign-shots.mjs      -> /workspace/pt/campaign4_<name>.png
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5173;
const OUT = process.env.OUT || '/workspace/pt/campaign4_';
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.stack.slice(0, 300)));
await page.goto(`http://127.0.0.1:${PORT}/?campspeed=3`, { waitUntil: 'load' });
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = async (fn, label, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn)) return; await sleep(120); } throw new Error('timeout ' + label); };
const shot = async (n) => { await page.screenshot({ path: `${OUT}${n}.png` }); console.log('shot', n); };
await until(() => window.game?.scene?.isActive?.('Title'), 'title');
await sleep(2500); await page.keyboard.press('s'); await sleep(300); await page.keyboard.press('Enter');
await until(() => window.game.scene.isActive('Campaign'), 'menu'); await sleep(800); await page.keyboard.press('Enter');
for (let i = 0; i < 80 && !(await ev(() => window.game.scene.isActive('CampaignBattle') && !!window.__camp)); i++) { await page.keyboard.press('Enter'); await sleep(250); }
await until(() => window.__camp?.mode === 'idle' || window.__camp?.mode === 'move', 'battle idle', 180000);
for (let i = 0; i < 40 && await ev(() => !!window.__camp?.inDialogue); i++) { await sleep(500); await page.keyboard.press('Escape'); }
await until(() => window.__camp?.mode === 'idle', 'idle');
await sleep(3000); // attack clips and fx arrive
// stage: Helen (ranged) three tiles from the first enemy, Hydra beside her
await ev(() => {
  const s = window.__camp; const b = s.battle;
  const e = b.enemies[0];
  const helen = b.players.find((u) => u.id === 'helen') || b.players[1];
  const spot = [[e.x - 2, e.y], [e.x - 2, e.y + 1], [e.x - 3, e.y]].find(([x, y]) => b.tile(x, y) && Number.isFinite(b.tile(x, y).cost) && !b.unitAt(x, y));
  b.moveUnit(helen, spot[0], spot[1]); s.placeUnit(helen, spot[0], spot[1]);
  s.setCursor(helen.x, helen.y); s.confirm(helen.x, helen.y);
});
await sleep(400);
await ev(() => { const s = window.__camp; const u = s.sel; s.setCursor(u.x, u.y); s.confirm(u.x, u.y); });   // confirm on own tile -> action menu
await until(() => window.__camp.mode === 'menu', 'menu');
await sleep(500);
await shot('moves_menu');
// highlight the charge move for its info card
await ev(() => { const s = window.__camp; s.menuSel = s.menuItems.findIndex((i) => i.id === 'charge'); s.paintMenu(); });
await sleep(300); await shot('moves_menu_charge');
await ev(() => { const s = window.__camp; s.menuSel = s.menuItems.findIndex((i) => i.id === 'attack' && !i.disabled && i.move.slot === 'special'); if (s.menuSel < 0) s.menuSel = s.menuItems.findIndex((i) => i.id === 'attack' && !i.disabled); s.paintMenu(); s.menuPick(); });
await until(() => window.__camp.mode === 'target', 'target');
await sleep(400); await shot('moves_forecast');
await page.keyboard.press('Escape'); await sleep(300);
// charge: whole turn, indicator
await ev(() => { const s = window.__camp; s.menuSel = s.menuItems.findIndex((i) => i.id === 'charge'); s.menuPick(); });
await until(() => window.__camp.mode === 'idle', 'charging done');
await sleep(400);
await ev(() => { const s = window.__camp; const u = s.battle.players.find((p) => p.charging); s.setCursor(u.x, u.y); });
await sleep(400); await shot('charging');
console.log(errs.length ? 'ERRORS ' + errs.join('|') : 'no page errors');
await browser.close();
process.exit(errs.length ? 1 : 0);
