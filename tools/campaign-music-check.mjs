// Headless check: the close-up scene plays the battle track and the phase theme resumes after; a KO plays a defeat
// sting; with the battle files missing nothing breaks (the phase theme keeps playing).
//   PORT=5173 node tools/campaign-music-check.mjs
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const fails = [];
const check = (ok, label) => { console.log(ok ? 'ok  ' : 'FAIL', label); if (!ok) fails.push(label); };

async function run(missing) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
  if (missing) await page.route(/music\/(battle|defeat_player|defeat_enemy)\./, (r) => r.fulfill({ status: 404, body: 'no' }));
  await page.goto(`http://127.0.0.1:${PORT}/?campspeed=3`, { waitUntil: 'load' });
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
  await sleep(2500); // let the phase theme and the preloads arrive
  const seen = new Set();
  const names = async () => ev(async () => { const m = await import('/src/campaign/music.js'); return m.status().current; });
  const base = await names();
  console.log(missing ? '[files missing]' : '[files present]', 'phase theme:', base);
  check(!!base && base !== 'battle', 'a phase theme is playing before the fight');
  // stage a fight: put a player next to an enemy, make the enemy weak so it falls, and play it through the real combat()
  await ev(() => {
    const s = window.__camp; const b = s.battle;
    const a = b.players[1]; const d = b.enemies[0];
    a.power = 99;
    b.moveUnit(a, d.x - 1, d.y); s.placeUnit(a, d.x - 1, d.y);
    d.hp = 1;
    window.__fight = s.combat(a, d).then(() => { window.__fightDone = true; });
  });
  const t0 = Date.now();
  let sawStinger = false;
  while (!(await ev(() => window.__fightDone)) && Date.now() - t0 < 90000) {
    const st = await ev(async () => { const m = await import('/src/campaign/music.js'); return m.status().current; });
    if (st) seen.add(st);
    await sleep(150);
  }
  await sleep(1800);
  const after = await names();
  if (!missing) check(seen.has('battle'), 'close-up plays the battle track (saw: ' + [...seen].join(',') + ')');
  else check(!seen.has('battle') && seen.size > 0, 'with the battle file missing the phase theme keeps playing (saw: ' + [...seen].join(',') + ')');
  check(after === base, `phase theme resumes after the close-up (${after})`);
  check(errs.length === 0, 'no page errors ' + errs.join('|'));
  await page.close();
}
await run(false);
await run(true);
await browser.close();
process.exit(fails.length ? 1 : 0);
