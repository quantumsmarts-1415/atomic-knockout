// Headless stage-intro check + true-speed frame capture (Playwright's own Chromium).
// From a dir with 'playwright' installed, with 'PORT=5199 node server.js' running:
//   node tools/stages/intro-check.mjs http://localhost:5199/ [captureOnly]
// Frames -> /tmp/rm/introframes (ffmpeg -framerate 30 -i f%03d.png ... door_intro.mp4)
import { chromium } from 'playwright';
const base = process.argv[2];
const FR = '/tmp/rm/introframes';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
await page.goto(base);
await page.waitForFunction(() => window.game?.scene?.isActive('Title'), null, { timeout: 600000 });
const setup = { players: [{ charId: 'natalie', palette: 0, slot: 100 }, { charId: 'sully', palette: 0, slot: 101 }], stocks: 3, stageId: 'hydrogen-breakout' };

// ---- A: deterministic 30fps capture (loop paused, stepped by hand)
await page.evaluate((s) => {
  const g = window.game;
  g.scene.getScenes(true)[0].scene.start('Battle', s);
  g.loop.sleep();
  window.__t = performance.now();
}, setup);
const log = [];
const DT = 1000 / 30;
for (let i = 0; i < 96; i++) {
  const st = await page.evaluate((dt) => {
    const g = window.game;
    window.__t += dt;
    g.step(window.__t, dt);
    const b = g.scene.getScene('Battle');
    if (!b?.fighters) return { ready: false };
    // capture only: tweens normally run on wall-clock time; make each step
    // advance them by exactly dt so the recording is true-speed
    if (!b.__lagSet) { b.tweens.setLagSmooth(dt, dt); b.__lagSet = true; }
    return {
      ready: true, introActive: !!b.intro?.active, sceneT: Math.round(b.time.now),
      inputs: b.fighters.map((f) => Object.values(f.input).some(Boolean)),
      pos: b.fighters.map((f) => [Math.round(f.x), Math.round(f.y)]),
      states: b.fighters.map((f) => f.state),
    };
  }, DT);
  log.push(st);
  await page.screenshot({ path: `${FR}/f${String(i).padStart(3, '0')}.png` });
}
const ready = log.filter((l) => l.ready);
const introFrames = ready.filter((l) => l.introActive);
const openAt = ready.findIndex((l) => !l.introActive);
console.log('A frames', log.length, 'intro active frames', introFrames.length, `(~${Math.round(introFrames.length * DT)}ms)`,
  'any input during intro:', introFrames.some((l) => l.inputs.some(Boolean)),
  'x drift during intro:', introFrames.length ? JSON.stringify([introFrames[0].pos, introFrames.at(-1).pos]) : '-',
  'states at open:', JSON.stringify(ready[openAt]?.states), 'pos 1.4s after open:', JSON.stringify(ready.at(-1)?.pos), 'input after open', JSON.stringify(ready.at(-1)?.inputs));
await page.evaluate(() => window.game.loop.wake());

if (process.argv[3] === 'captureOnly') { console.log('ERRORS:', errors.length ? errors.join(' | ') : 'none'); await browser.close(); process.exit(0); }
// ---- B: real-time skip with the attack key
await page.evaluate((s) => { window.game.scene.getScenes(true)[0].scene.start('Battle', s); }, setup);
await page.waitForFunction(() => window.game.scene.getScene('Battle')?.intro?.active, null, { timeout: 30000 });
await page.waitForTimeout(250);
const beforeSkip = await page.evaluate(() => { const b = window.game.scene.getScene('Battle'); return { active: b.intro.active, t: Math.round(b.time.now), doors: b.children.list.filter((o) => o.depth >= 1000).length }; });
await page.keyboard.down('f'); await page.waitForTimeout(150); await page.keyboard.up('f');
await page.waitForTimeout(250);
const afterSkip = await page.evaluate(() => { const b = window.game.scene.getScene('Battle'); return { active: b.intro.active, t: Math.round(b.time.now), doorImgs: b.children.list.filter((o) => o.depth === 1000).length }; });
await page.screenshot({ path: '/tmp/rm/intro_after_skip.png' });
await page.waitForTimeout(4000);
const play = await page.evaluate(() => window.game.scene.getScene('Battle').fighters.map((f) => ({ x: Math.round(f.x), pct: Math.round(f.percent), state: f.state })));
console.log('B skip: before', JSON.stringify(beforeSkip), 'after', JSON.stringify(afterSkip), 'gameplay 4s later', JSON.stringify(play));

// ---- C: phone attack skips too
await page.evaluate((s) => { window.game.scene.getScenes(true)[0].scene.start('Battle', { ...s, players: [{ charId: 'natalie', palette: 0, slot: 2 }, { charId: 'sully', palette: 0, slot: 101 }] }); }, setup);
await page.waitForFunction(() => window.game.scene.getScene('Battle')?.intro?.active, null, { timeout: 30000 });
await page.waitForTimeout(200);
await page.evaluate(async () => { const { phoneNet } = await import('/src/net/PhoneNet.js'); phoneNet.inputBySlot.set(2, { left: false, right: false, up: false, down: false, confirm: true, back: false }); });
await page.waitForTimeout(300);
const phone = await page.evaluate(async () => { const { phoneNet } = await import('/src/net/PhoneNet.js'); phoneNet.inputBySlot.delete(2); return window.game.scene.getScene('Battle').intro.active; });
console.log('C phone skip -> intro active:', phone);

// ---- D: stage without an intro is unaffected
await page.evaluate((s) => { window.game.scene.getScenes(true)[0].scene.start('Battle', { ...s, stageId: 'neon-nexus' }); }, setup);
await page.waitForFunction(() => window.game.scene.getScene('Battle')?.stage?.id === 'neon-nexus' && window.game.scene.getScene('Battle').fighters, null, { timeout: 30000 });
await page.waitForTimeout(2500);
const d = await page.evaluate(() => { const b = window.game.scene.getScene('Battle'); return { intro: b.intro, inputs: b.fighters.map((f) => Object.values(f.input).some(Boolean)), pos: b.fighters.map((f) => Math.round(f.x)) }; });
console.log('D neon-nexus intro:', d.intro, 'bots acting:', JSON.stringify(d));
console.log('ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
