// Headless playtest of the campaign: title -> campaign menu -> story -> battle -> chapter results,
// driving the real scene methods the mouse/keyboard handlers call.
import { chromium } from '/workspace/ak-pt/node_modules/playwright-core/index.mjs';
const PORT = process.env.PORT || 5199;
const MAXCH = Number(process.env.MAXCH || 3);
const log = (...a) => console.log(new Date().toISOString().slice(14, 23), ...a);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/404/.test(m.text())) errs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on('crash', () => console.log('PAGE CRASH')); page.on('close', () => console.log('PAGE CLOSE')); page.on('pageerror', (e) => errs.push('pageerror: ' + e.stack.slice(0, 400)));
await page.goto(`http://127.0.0.1:${PORT}/?campspeed=8`, { waitUntil: 'load' });
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (n) => { await page.screenshot({ path: `/workspace/pt/campaign_${n}.png` }); log('shot', n); };
const until = async (fn, label, ms = 120000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn, arg)) return; await sleep(150); } throw new Error('timeout: ' + label + ' ' + await ev(() => window.game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key).join(','))); };
const active = (k) => ev((k) => window.game.scene.isActive(k), k);

await until(() => window.game?.scene.isActive('Title'), 'title');
await sleep(3000);
await page.keyboard.press('s'); await sleep(300);
await shot('0_title');
await page.keyboard.press('Enter');
await until(() => window.game.scene.isActive('Campaign'), 'campaign menu');
await sleep(1500);
await shot('1_menu');
await page.keyboard.press('Enter'); // Start Chapter 1 (New Campaign)

async function story(label, shots) {
  await until(() => { const c = window.game.scene.getScene('Campaign'); return c.scene.isActive() && !c.busy && c.load.list.size === 0 && (c.stage || []).some((o) => o.type === 'Text' && /^(OBJECTIVE|NEXT|ENTER)/.test(o.text)); }, 'story ' + label, 180000);
  await sleep(2500);
  if (shots) await shot(shots);
}

let chapterShots = { 1: ['2_story', '3_map'], 2: ['10_story_ch2', '11_map_ch2'], 3: ['20_story_ch3', '21_map_ch3'] };
let ch = 1;
let attempts = 0;
const summary = [];

while (ch <= MAXCH && attempts < 6) {
  attempts++;
  await story(`ch${ch}`, chapterShots[ch]?.[0]);
  chapterShots[ch] && (chapterShots[ch][0] = null);
  for (let i = 0; i < 14; i++) { if (await active('CampaignBattle')) break; await page.mouse.click(640, 250); await sleep(250); await page.mouse.click(640, 250); await sleep(350); log('story click', i, await ev(() => window.game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key).join(','))); }
  await until(() => window.game.scene.isActive('CampaignBattle') && ['idle', 'move'].includes(window.__camp?.mode), 'battle idle', 120000);
  await sleep(600);
  if (await ev(() => window.__camp.mode === 'move')) { await page.keyboard.press('Escape'); await sleep(300); }
  await sleep(600);
  if (chapterShots[ch]?.[1]) { await shot(chapterShots[ch][1]); chapterShots[ch][1] = null; }

  if (attempts >= 3) { await ev(() => { for (const u of window.__camp.battle.players) { u.power += 8; u.maxHp += 25; u.hp += 25; u.def += 3; } }); log('TEST-ONLY buff applied to players (script player is naive)'); }
  let firstTurn = ch === 1 && attempts === 1;
  let guard = 0;
  while (guard++ < 40) {
    const res = await ev(() => window.__camp?.battle?.result || null);
    if (res || !(await active('CampaignBattle'))) break;
    await until(() => !window.__camp || window.__camp.battle.result || (window.__camp.mode === 'idle' && window.__camp.battle.phase === 'player'), 'player turn', 120000);
    if (await ev(() => !window.__camp || !!window.__camp.battle.result)) break;
    const ids = await ev(() => window.__camp.battle.players.map((u) => u.uid));
    for (const uid of ids) {
      const info = await ev(async (uid) => {
        const s = window.__camp; const b = s.battle;
        const u = b.units.find((x) => x.uid === uid);
        if (!u || !u.alive || u.acted || b.result) return { skip: true };
        const grid = await import('/src/campaign/grid.js');
        const lord = u.lord;
        let plan = lord ? null : b.plan(u);
        if (lord) {
          // the lord only fights what walks up; in seize chapters he heads for the throne once the guards are thinned
          const reach = b.reachFor(u);
          let target = null;
          for (const st of reach.stops.values()) for (const t of grid.ringTiles(b.map, st.x, st.y, u.range[0], u.range[1])) { const f = b.unitAt(t.x, t.y); if (f && f.team === 'enemy' && !target) { target = { f, st }; } }
          if (b.chapter.win === 'seize' && b.enemies.length <= 3) {
            const field = grid.distanceField(b.map, [{ x: b.chapter.seize[0], y: b.chapter.seize[1] }]);
            let best = null; for (const st of reach.stops.values()) { const d = field.get(`${st.x},${st.y}`); if (d != null && (!best || d < best.d)) best = { st, d }; }
            plan = { to: best ? { x: best.st.x, y: best.st.y } : { x: u.x, y: u.y }, target: null };
          } else plan = { to: target ? { x: target.st.x, y: target.st.y } : { x: u.x, y: u.y }, target: target ? target.f : null };
        }
        return { plan: { to: plan.to, target: plan.target ? { x: plan.target.x, y: plan.target.y } : null }, x: u.x, y: u.y, name: u.name };
      }, uid);
      if (info.skip) continue;
      // select
      await ev(({ x, y }) => { const s = window.__camp; s.setCursor(x, y); s.confirm(x, y); }, info);
      await sleep(60);
      if (firstTurn === true && info.name) {
        await shot('4_select_ranges'); firstTurn = 'move';
      }
      // move or open menu
      const moved = info.plan.to.x !== info.x || info.plan.to.y !== info.y;
      await ev(({ to, x, y, moved }) => { const s = window.__camp; if (moved) { s.setCursor(to.x, to.y); s.confirm(to.x, to.y); } else { s.confirm(x, y); } }, { to: info.plan.to, x: info.x, y: info.y, moved });
      await until(() => !window.__camp || window.__camp.mode === 'menu', 'menu', 20000);
      if (firstTurn === 'move') { await sleep(150); await shot('5_action_menu'); firstTurn = 'menu'; }
      if (info.plan.target) {
        await ev(() => { const s = window.__camp; s.menuSel = s.menuItems.findIndex((i) => i.id === 'attack'); s.menuPick(); });
        await sleep(200);
        if (firstTurn === 'menu') { await shot('6_forecast'); firstTurn = 'done'; }
        await ev(({ x, y }) => { const s = window.__camp; s.setCursor(x, y); s.confirm(x, y); if (s.mode === 'target') s.confirm(x, y); }, info.plan.target);
        if (firstTurn === 'done' && ch === 1) { await sleep(450); await shot('7_battle_anim'); firstTurn = 'x'; }
      } else {
        await ev(() => { const s = window.__camp; const i = s.menuItems.findIndex((it) => it.id === (s.battle.canSeize(s.sel) ? 'seize' : 'wait')); s.menuSel = i; s.menuPick(); });
      }
      await until(() => !window.__camp || window.__camp.battle.result || window.__camp.mode === 'idle', 'after action', 60000);
      if (await ev(() => !window.__camp || !!window.__camp.battle.result)) break;
    }
    if (await ev(() => !window.__camp || !!window.__camp.battle.result)) break;
    if (ch === 1 && attempts === 1 && guard === 1) {
      await shot('8_before_end_turn');
      await page.keyboard.press('e');
      await sleep(2500);
      await shot('9_enemy_phase');
    } else await page.keyboard.press('e');
    await sleep(300);
  }
  const res = await ev(() => window.__camp?.battle?.result);
  const turns = await ev(() => window.__camp?.battle?.turn);
  log(`chapter ${ch} attempt ${attempts}:`, res, 'turns', turns);
  summary.push({ ch, attempt: attempts, result: res, turns });
  // results screen
  await until(() => window.game.scene.isActive('Campaign') && !window.__camp, 'results scene', 60000);
  if (res === 'victory') {
    // outro story, then summary
    const hasSum = () => ev(() => { const c = window.game.scene.getScene('Campaign'); return (c.stage || []).some((o) => o.type === 'Text' && /CHAPTER CLEAR/.test(o.text)); });
    for (let i = 0; i < 30 && !(await hasSum()); i++) { await page.keyboard.press('Enter'); await sleep(700); if (i === 1) await shot(`${30 + ch}_outro_story`); }
    await sleep(800);
    await shot(`${30 + ch}_victory_summary`);
    if (ch >= MAXCH) break;
    ch++;
    await page.keyboard.press('Enter'); // Next chapter
  } else {
    await until(() => { const c = window.game.scene.getScene('Campaign'); return (c.stage || []).some((o) => o.type === 'Text' && /DEFEAT/.test(o.text)); }, 'defeat', 30000);
    await sleep(800);
    await shot(`${40 + ch}_defeat`);
    await page.keyboard.press('Enter'); // Retry chapter
  }
}
console.log('SUMMARY', JSON.stringify(summary));
console.log('ERRORS', JSON.stringify(errs.slice(0, 10)));
await browser.close();
