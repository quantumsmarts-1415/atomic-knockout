// Screenshots of healing: Heal in the action menu, target preview, the heal FX, and a healing tile in the terrain card.
//   PORT=5173 node tools/campaign-heal-shots.mjs     (-> /workspace/pt/campaign4_heal_*.png)
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.stack.slice(0, 300)));
await page.goto(`http://127.0.0.1:${PORT}/?campspeed=1`, { waitUntil: 'load' });
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = async (fn, label, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn)) return; await sleep(120); } throw new Error('timeout ' + label); };
await until(() => window.game?.scene?.isActive?.('Title'), 'title');
await sleep(2500); await page.keyboard.press('s'); await sleep(300); await page.keyboard.press('Enter');
await until(() => window.game.scene.isActive('Campaign'), 'menu'); await sleep(800); await page.keyboard.press('Enter');
for (let i = 0; i < 80 && !(await ev(() => window.game.scene.isActive('CampaignBattle') && !!window.__camp)); i++) { await page.keyboard.press('Enter'); await sleep(250); }
await until(() => window.__camp?.mode === 'idle' || window.__camp?.mode === 'move', 'battle idle', 180000);
for (let i = 0; i < 40 && await ev(() => !!window.__camp?.inDialogue); i++) { await sleep(500); await page.keyboard.press('Escape'); }
await until(() => window.__camp?.mode === 'idle', 'idle');
await ev(() => {
  const s = window.__camp, b = s.battle;
  const helen = b.players.find((u) => u.id === 'helen'), hydra = b.players.find((u) => u.id === 'hydra');
  hydra.hp = Math.round(hydra.maxHp * 0.35);
  s.placeUnit(hydra, helen.x + 1, helen.y);
  s.views.get(hydra.uid).shownHp = hydra.hp; s.paintBar(s.views.get(hydra.uid));
  s.setCursor(helen.x, helen.y); s.confirm(helen.x, helen.y);
});
await sleep(300);
await ev(() => { const s = window.__camp; s.confirm(s.sel.x, s.sel.y); });
await until(() => window.__camp.mode === 'menu', 'menu');
await ev(() => { const s = window.__camp; s.menuSel = s.menuItems.findIndex((i) => i.id === 'heal'); s.paintMenu(); });
await sleep(300);
await page.screenshot({ path: '/workspace/pt/campaign4_heal_menu.png' });
await ev(() => window.__camp.menuPick());
await sleep(500);
await page.screenshot({ path: '/workspace/pt/campaign4_heal_target.png' });
await ev(() => { const s = window.__camp; s.confirm(s.pending.x, s.pending.y); });
for (let i = 1; i <= 3; i++) { await sleep(500); await page.screenshot({ path: `/workspace/pt/campaign4_heal_fx_${i}.png` }); }
const after = await ev(() => { const h = window.__camp.battle.players.find((u) => u.id === 'hydra'); return { hp: h.hp, max: h.maxHp }; });
console.log('hydra after heal', JSON.stringify(after));
// a village tile shows its healing in the terrain card
await ev(() => {
  const s = window.__camp, b = s.battle;
  let spot = null;
  for (let y = 0; y < b.map.h && !spot; y++) for (let x = 0; x < b.map.w; x++) if (b.tile(x, y)?.heal) { spot = { x, y }; break; }
  if (spot) { s.setCursor(spot.x, spot.y); s.refreshPanel(); }
});
await sleep(400);
await page.screenshot({ path: '/workspace/pt/campaign4_heal_terrain.png' });
console.log(errs.length ? 'ERRORS ' + errs.join('|') : 'no page errors');
await browser.close();
process.exit(errs.length ? 1 : 0);
