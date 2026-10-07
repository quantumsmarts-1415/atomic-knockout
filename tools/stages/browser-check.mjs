// Headless stage smoke test (Playwright, its own Chromium -- not the shared box Chrome).
// Run from a dir with 'playwright' installed (e.g. /workspace/pw-tools) while 'PORT=5199 node server.js' runs:
//   node tools/stages/browser-check.mjs   -> screenshots in /workspace/stages-preview/
import { chromium } from 'playwright';
const OUT = '/workspace/stages-preview';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
await page.goto('http://localhost:5199/', { waitUntil: 'load' });
await page.waitForFunction(() => window.game?.scene?.isActive('Title'), null, { timeout: 600000 });
console.log('booted');

const setup = { players: [{ charId: 'natalie', palette: 0, slot: 100 }, { charId: 'sully', palette: 0, slot: 101 }], stocks: 3 };
// --- stage select: open, navigate with real key presses, screenshot
await page.evaluate((s) => window.game.scene.getScenes(true).forEach((sc) => sc.scene.stop()) || window.game.scene.start('StageSelect', s), setup);
await page.waitForFunction(() => window.game.scene.isActive('StageSelect'));
await page.waitForTimeout(600);
const nav = async (k) => { await page.keyboard.down(k); await page.waitForTimeout(150); await page.keyboard.up(k); await page.waitForTimeout(150); };
for (const k of ['ArrowDown', 'ArrowRight']) await nav(k); // -> index 4 (hydrogen-breakout)
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/stage-select.png` });
const cur = await page.evaluate(() => { const s = window.game.scene.getScene('StageSelect'); return s.entries[s.cursor]; });
console.log('stage select cursor after Down,Right:', cur);
await nav('d'); await nav('s'); await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/stage-select-2.png` });
// random tile
const randIdx = await page.evaluate(() => window.game.scene.getScene('StageSelect').entries.length - 1);
await page.evaluate((i) => { const s = window.game.scene.getScene('StageSelect'); s.cursor = i; s.refresh(); }, randIdx);
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/stage-select-random.png` });
// back -> CharacterSelect, then confirm path: pick via key F
await nav('g');
await page.waitForFunction(() => window.game.scene.isActive('CharacterSelect'));
console.log('back -> CharacterSelect ok');
await page.evaluate((s) => { window.game.scene.stop('CharacterSelect'); window.game.scene.start('StageSelect', s); }, setup);
await page.waitForFunction(() => window.game.scene.isActive('StageSelect'));
await page.waitForTimeout(1500);
await nav('ArrowDown'); await nav('ArrowRight'); await nav('Enter');
await page.waitForFunction(() => window.game.scene.isActive('Battle'), null, { timeout: 20000 });
const picked = await page.evaluate(() => window.game.scene.getScene('Battle').stage.id);
console.log('confirm -> Battle on', picked);

const ids = await page.evaluate(() => window.game.scene.getScene('Battle').constructor && (window.STAGE_IDS || null));
const stageIds = ['hydrogen-breakout', 'silicon-foundry', 'brimstone-caldera', 'neon-nexus', 'holdout-keep', 'elemental-isle', 'twin-peaks', 'the-core', 'crystal-spire'];
for (const id of stageIds) {
  await page.evaluate(({ s, id }) => { window.game.scene.getScenes(true)[0].scene.start('Battle', { ...s, stageId: id }); }, { s: setup, id });
  await page.waitForFunction((id) => window.game.scene.isActive('Battle') && window.game.scene.getScene('Battle').stage?.id === id && window.game.scene.getScene('Battle').fighters?.[0]?.body, id, { timeout: 60000 });
  const t0 = await page.evaluate(() => window.game.scene.getScene('Battle').movers?.map((m) => m.x));
  await page.waitForTimeout(9000);
  const info = await page.evaluate(() => {
    const b = window.game.scene.getScene('Battle');
    return {
      scenes: window.game.scene.getScenes(true).map((x) => x.scene.key), over: !!b.matchOver,
      parallax: b.parallax?.map((l) => Math.round(l.img.x)) ?? null,
      movers: b.movers?.map((m) => Math.round(m.x)),
      fighters: b.fighters.map((f) => ({ id: f.charDef.id, x: Math.round(f.x), y: Math.round(f.y), pct: Math.round(f.percent), stocks: f.stocks, alive: f.alive, state: f.state, hasBody: !!f.body, ground: !!(f.body && (f.body.blocked.down || f.body.touching.down)) })),
      textures: { terrain: b.textures.exists(`stage-${b.stage.id}-terrain`) },
    };
  });
  console.log(id, JSON.stringify({ movers0: t0, ...info }));
  await page.screenshot({ path: `${OUT}/battle-${id}.png` });
}
// --- moving-lift carry: drop P1 onto the foundry lift and freeze its AI
await page.evaluate((s) => window.game.scene.getScenes(true)[0].scene.start('Battle', { ...s, stageId: 'silicon-foundry' }), setup);
await page.waitForFunction(() => window.game.scene.getScene('Battle').stage?.id === 'silicon-foundry' && window.game.scene.getScene('Battle').fighters?.[0]?.body, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const carry = await page.evaluate(async () => {
  const b = window.game.scene.getScene('Battle');
  const f = b.fighters[0]; const m = b.movers[0];
  f.isBot = false; f.controlSlot = 99; // no input source -> stands still
  b.fighters[1].isBot = false; b.fighters[1].controlSlot = 98;
  f.body.reset(m.x, m.y - 40);
  await new Promise((r) => setTimeout(r, 1500));
  const a = { fx: f.x, mx: m.x, ground: f.body.blocked.down || f.body.touching.down };
  await new Promise((r) => setTimeout(r, 2500));
  return { before: a, after: { fx: f.x, mx: m.x, fy: f.y, platTop: m.y, ground: f.body.blocked.down || f.body.touching.down } };
});
console.log('carry', JSON.stringify(carry));
await page.screenshot({ path: `${OUT}/battle-silicon-foundry-lift-carry.png` });
console.log('ERRORS:', errors.length ? errors.slice(0, 20).join('\n') : 'none');
await browser.close();
