// Headless playtest of the whole campaign through the real scenes: title -> Campaign -> prologue/intro dialogue
// -> battle (player + enemy phases, dialogue events, cutaway) -> summary -> next chapter.
// The scripted player is deliberately naive (everyone attacks what is in reach), so after a defeat the script
// applies a TEST-ONLY stat buff to the player's units to keep moving. Screenshots: /workspace/pt/campaign2_*.png
//   PORT=5199 MAXCH=8 SPEED=4 node tools/campaign-playtest.mjs
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5199;
const MAXCH = Number(process.env.MAXCH || 8);
const SPEED = process.env.SPEED || 4;
const OUT = process.env.OUT || '/workspace/pt/campaign2_';
const log = (...a) => console.log(new Date().toISOString().slice(14, 23), ...a);
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/404/.test(m.text())) errs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.stack.slice(0, 400)));
page.on('crash', () => console.log('PAGE CRASH'));
await page.goto(`http://127.0.0.1:${PORT}/?campspeed=${SPEED}`, { waitUntil: 'load' });
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const taken = new Set();
const shot = async (n, once = true) => { if (once && taken.has(n)) return; taken.add(n); await page.screenshot({ path: `${OUT}${n}.png` }); log('shot', n); };
const until = async (fn, label, ms = 120000, arg) => { const t = Date.now(); while (Date.now() - t < ms) { if (await page.evaluate(fn, arg)) return; await sleep(120); } throw new Error('timeout: ' + label + ' ' + await ev(() => window.game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key).join(','))); };
// like until(), but skips any conversation that opens meanwhile (events fire from moves, kills and phases)
const untilSkip = async (fn, label, ms = 120000) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await ev(fn)) return;
    if (await ev(() => !!window.__camp?.inDialogue)) { await sleep(900); await page.keyboard.press('Escape'); await sleep(600); } else await sleep(120);
  }
  throw new Error('timeout: ' + label);
};
const active = (k) => ev((k) => window.game.scene.isActive(k), k);

await until(() => window.game?.scene?.isActive?.('Title'), 'title');
await sleep(2500);
await page.keyboard.press('s'); await sleep(300);
await shot('title');
await page.keyboard.press('Enter');
await until(() => window.game.scene.isActive('Campaign'), 'campaign menu');
await sleep(1200);
await shot('menu');
await page.keyboard.press('Enter'); // New Campaign

// Poll for visual moments while the script plays.
let stopPoll = false;
(async () => {
  while (!stopPoll) {
    try {
      const st = await ev(() => { const c = window.__camp; return c ? { cut: c.cutViews.length, banner: c.bannerText, dlg: !!c.inDialogue, ch: c.chapterIndex + 1, mode: c.mode } : null; });
      if (st?.cut) { await sleep(180); await shot(`cutaway_${taken.has('cutaway_a') ? (taken.has('cutaway_b') ? 'c' : 'b') : 'a'}`); }
      if (st?.banner && /LEVEL UP/.test(st.banner)) { await sleep(150); await shot('levelup'); }
      if (st?.dlg) { await sleep(900); await shot(`event_ch${st.ch}`); }
    } catch { /* page navigating */ }
    await sleep(150);
  }
})();

async function skipStory(chLabel) {
  // prologue + intro (Campaign scene) -> until the battle scene is up
  let shots = 0;
  for (let i = 0; i < 80; i++) {
    if (await ev(() => window.game.scene.isActive('CampaignBattle') && !!window.__camp)) return;
    const playing = await ev(() => !!window.game.scene.getScene('Campaign')?.playing);
    if (playing) {
      if (shots < 2) { await sleep(700); await shot(`${chLabel}_story_${shots}`); shots++; }
      await page.keyboard.press('Enter'); await sleep(120);
      if (i % 5 === 4) await page.keyboard.press('Escape');
    }
    await sleep(250);
  }
  throw new Error('story did not end');
}

const summary = [];
let ch = 1; let attempts = 0; let chAttempts = 0;
while (ch <= MAXCH && attempts < 24) {
  attempts++; chAttempts++;
  await skipStory(`ch${ch}`);
  await until(() => window.game.scene.isActive('CampaignBattle') && ['idle', 'move'].includes(window.__camp?.mode), 'battle idle', 180000);
  await sleep(500);
  if (await ev(() => window.__camp.mode === 'move')) { await page.keyboard.press('Escape'); await sleep(300); }
  await shot(`map_ch${ch}`);
  if (chAttempts >= 2) {
    const k = chAttempts - 1;
    await ev((k) => { for (const u of window.__camp.battle.players) { u.power += 5 * k; u.maxHp += 15 * k; u.hp += 15 * k; u.def += 2 * k; } }, k);
    log(`TEST-ONLY buff x${k} applied to the player's units (naive script player)`);
  }
  let guard = 0;
  while (guard++ < 60) {
    // clear dialogue
    for (let i = 0; i < 40 && await ev(() => !!window.__camp?.inDialogue); i++) { await sleep(900); await page.keyboard.press('Escape'); await sleep(500); }
    const res = await ev(() => window.__camp?.battle?.result || null);
    if (res || !(await active('CampaignBattle'))) break;
    await untilSkip(() => !window.__camp || window.__camp.battle.result || (window.__camp.mode === 'idle' && window.__camp.battle.phase === 'player'), 'player turn', 240000);
    if (await ev(() => !!window.__camp?.inDialogue)) continue;
    if (await ev(() => !window.__camp || !!window.__camp.battle.result)) break;
    const ids = await ev(() => window.__camp.battle.players.map((u) => u.uid));
    for (const uid of ids) {
      if (await ev(() => !!window.__camp?.inDialogue)) { guard--; break; }
      const info = await ev(async (uid) => {
        const s = window.__camp; const b = s.battle;
        const u = b.units.find((x) => x.uid === uid);
        if (!u || !u.alive || u.acted || b.result || u.team !== 'player') return { skip: true };
        const grid = await import('/src/campaign/grid.js');
        const c = b.chapter;
        let plan = b.plan(u);
        if (u.lord) {
          const reach = b.reachFor(u);
          let goal = null;
          if (c.win === 'escape' && b.turn >= 2) goal = { x: c.exit[0][0], y: c.exit[0][1] };
          if (c.win === 'seize' && (b.enemies.length <= 3 || b.turn >= 10)) goal = { x: c.seize[0], y: c.seize[1] };
          if (goal) {
            const field = grid.distanceField(b.map, [goal]);
            let best = null; for (const st of reach.stops.values()) { const d = field.get(`${st.x},${st.y}`); if (d != null && (!best || d < best.d)) best = { st, d }; }
            plan = { to: best ? { x: best.st.x, y: best.st.y } : { x: u.x, y: u.y }, target: null };
          } else {
            let target = null;
            for (const st of reach.stops.values()) for (const t of grid.ringTiles(b.map, st.x, st.y, u.range[0], u.range[1])) { const f = b.unitAt(t.x, t.y); if (f && f.team === 'enemy' && !target) target = { f, st }; }
            plan = { to: target ? { x: target.st.x, y: target.st.y } : { x: u.x, y: u.y }, target: target ? target.f : null };
          }
        }
        return { plan: { to: plan.to, target: plan.target ? { x: plan.target.x, y: plan.target.y } : null }, x: u.x, y: u.y, name: u.name };
      }, uid);
      if (info.skip) continue;
      await ev(({ x, y }) => { const s = window.__camp; s.setCursor(x, y); s.confirm(x, y); }, info);
      await sleep(60);
      if (!taken.has('ranges')) await shot('ranges');
      const moved = info.plan.to.x !== info.x || info.plan.to.y !== info.y;
      await ev(({ to, x, y, moved }) => { const s = window.__camp; if (moved) { s.setCursor(to.x, to.y); s.confirm(to.x, to.y); } else { s.confirm(x, y); } }, { to: info.plan.to, x: info.x, y: info.y, moved });
      await untilSkip(() => !window.__camp || window.__camp.mode === 'menu' || window.__camp.battle.result, 'menu', 120000);
      if (await ev(() => !window.__camp || window.__camp.battle.result || window.__camp.mode !== 'menu')) { if (await ev(() => !window.__camp || !!window.__camp.battle.result)) break; continue; }
      if (!taken.has('menu')) { await sleep(120); await shot('menu_actions'); }
      if (info.plan.target) {
        await ev(() => { const s = window.__camp; s.menuSel = s.menuItems.findIndex((i) => i.id === 'attack'); s.menuPick(); });
        await sleep(220);
        if (!taken.has('forecast')) await shot('forecast');
        await ev(({ x, y }) => { const s = window.__camp; s.setCursor(x, y); s.confirm(x, y); if (s.mode === 'target') s.confirm(x, y); }, info.plan.target);
      } else {
        await ev(() => { const s = window.__camp; const want = s.battle.canSeize(s.sel) ? 'seize' : s.battle.canEscape(s.sel) ? 'escape' : 'wait'; s.menuSel = s.menuItems.findIndex((it) => it.id === want); s.menuPick(); });
      }
      await untilSkip(() => !window.__camp || window.__camp.battle.result || window.__camp.mode === 'idle', 'after action', 240000);
      if (await ev(() => !window.__camp || !!window.__camp.battle.result)) break;
    }
    if (await ev(() => !window.__camp || !!window.__camp.battle.result)) break;
    if (await ev(() => !!window.__camp.inDialogue)) continue;
    if (await ev(() => window.__camp.mode === 'idle' && window.__camp.battle.phase === 'player')) {
      if (ch === 1 && attempts === 1 && guard === 1) await shot('before_end_turn');
      await page.keyboard.press('e');
      if (ch === 1 && attempts === 1 && guard === 1) { await sleep(2200); await shot('enemy_phase'); }
    }
    await sleep(250);
  }
  const res = await ev(() => window.__camp?.battle?.result);
  const turns = await ev(() => window.__camp?.battle?.turn);
  log(`chapter ${ch} attempt ${chAttempts}:`, res, 'turns', turns);
  summary.push({ ch, attempt: chAttempts, result: res, turns });
  await until(() => window.game.scene.isActive('Campaign') && !window.__camp, 'results scene', 90000);
  if (res === 'victory') {
    const hasSum = () => ev(() => { const c = window.game.scene.getScene('Campaign'); return (c.stage || []).some((o) => o.type === 'Text' && /CHAPTER CLEAR/.test(o.text)); });
    for (let i = 0; i < 60 && !(await hasSum()); i++) { await sleep(700); if (await ev(() => !!window.game.scene.getScene('Campaign').playing)) { if (i === 3) await shot(`ch${ch}_outro`); await page.keyboard.press('Enter'); } }
    await sleep(800);
    await shot(`ch${ch}_victory_summary`);
    if (ch >= MAXCH) break;
    ch++; chAttempts = 0;
    await page.keyboard.press('Enter'); // Next chapter
  } else {
    await until(() => { const c = window.game.scene.getScene('Campaign'); return (c.stage || []).some((o) => o.type === 'Text' && /DEFEAT/.test(o.text)); }, 'defeat', 30000);
    await sleep(800);
    await shot(`defeat_ch${ch}`);
    await page.keyboard.press('Enter'); // Retry chapter
  }
}
stopPoll = true;
console.log('SUMMARY', JSON.stringify(summary));
console.log('ERRORS', JSON.stringify(errs.slice(0, 10)));
await browser.close();
