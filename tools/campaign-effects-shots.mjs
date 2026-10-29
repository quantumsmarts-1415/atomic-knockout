// Screenshots of move effects on the campaign map: status pills, the stun-immunity indicator, move FX in a strike.
//   PORT=5173 node tools/campaign-effects-shots.mjs     (-> /workspace/pt/campaign4_effects_*.png)
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
// 1. pills + panel: an enemy that is stunned, a player who just lost a turn (immune), one burning and slowed
await ev(() => {
  const s = window.__camp, b = s.battle;
  const [p0, p1] = b.players, e0 = b.enemies[0];
  e0.stunned = true; e0.status.burn = { dmg: 4, turns: 2 };
  p0.stunImmune = true; p0.status.guard = { turns: 1, mult: 0.5 };
  p1.status.slow = { turns: 2 }; p1.status.weaken = { turns: 2, mult: 0.75 };
  for (const u of [p0, p1, e0]) s.paintTags(s.views.get(u.uid));
  s.setCursor(p0.x, p0.y); s.refreshPanel();
});
await sleep(500);
await page.screenshot({ path: '/workspace/pt/campaign4_effects_immune.png' });
await ev(() => { const s = window.__camp, e = s.battle.enemies[0]; s.setCursor(e.x, e.y); s.refreshPanel(); });
await sleep(400);
await page.screenshot({ path: '/workspace/pt/campaign4_effects_stunned.png' });
// 2. a real strike with FX: put a player next to an enemy, strike with a move that carries FX art
const shot = await ev(async () => {
  const s = window.__camp, b = s.battle;
  const att = b.players[0], def = b.enemies[0];
  att.stunImmune = false; def.stunned = false;
  const m = att.moves.find((x) => x.dmg && !x.charge && !x.action && x.range && x.range[1] >= 1) || att.moves[0];
  return { name: m.name, key: m.key };
});
console.log('strike move', JSON.stringify(shot));
await ev(() => {
  const s = window.__camp, b = s.battle, att = b.players[0], def = b.enemies[0];
  s.setCursor(def.x, def.y);
  const m = att.moves.find((x) => x.key === window.__strikeKey) || att.moves[0];
  window.__strike = s.combat(att, def, att.moves.find((x) => x.dmg && !x.charge && !x.action) || att.moves[0]);
});
for (let i = 1; i <= 4; i++) { await sleep(450); await page.screenshot({ path: `/workspace/pt/campaign4_effects_strike_${i}.png` }); }
await ev(() => window.__strike);
console.log(errs.length ? 'ERRORS ' + errs.join('|') : 'no page errors');
await browser.close();
process.exit(errs.length ? 1 : 0);
