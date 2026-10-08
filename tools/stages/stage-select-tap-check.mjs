// Regression check for the stage-select "lost tap" quirk: a key that goes
// down AND up within one frame must still register. Pauses the game loop,
// taps Down, Right, Enter one frame apart, and checks the Battle stage.
// Playwright's own Chromium; `PORT=xxxx node server.js` must be running.
import { chromium } from 'playwright';
const PORT = process.env.PORT || 5207;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.game?.scene?.isActive('Title'), null, { timeout: 600000 });
const setup = { players: [{ charId: 'natalie', palette: 0, slot: 100 }, { charId: 'sully', palette: 0, slot: 101 }], stocks: 3 };
await page.evaluate((s) => { window.game.scene.getScenes(true)[0].scene.start('StageSelect', s); }, setup);
await page.waitForFunction(() => window.game.scene.isActive('StageSelect'));
await page.waitForTimeout(500);
await page.evaluate(() => { window.game.loop.sleep(); window.__t = performance.now(); window.__step = (n = 1) => { for (let i = 0; i < n; i++) { window.__t += 16.67; window.game.step(window.__t, 16.67); } }; });
const tap = async (k) => { await page.keyboard.press(k); await page.evaluate(() => window.__step(1)); };
const before = await page.evaluate(() => window.game.scene.getScene('StageSelect').entries[window.game.scene.getScene('StageSelect').cursor]);
await tap('ArrowDown');
await tap('ArrowRight');
const shown = await page.evaluate(() => { const s = window.game.scene.getScene('StageSelect'); return s.entries[s.cursor]; });
await tap('Enter');
await page.evaluate(() => window.__step(60));
const landed = await page.evaluate(() => window.game.scene.getScene('Battle')?.stage?.id ?? null);
console.log(JSON.stringify({ case: 'one tap per frame', port: PORT, before, cursorAfterDownRight: shown, battle: landed, ok: shown === 'hydrogen-breakout' && landed === 'hydrogen-breakout' }));
// harsher: all three taps inside ONE frame
await page.evaluate((s) => { window.game.registry.remove('lastStageId'); window.game.scene.getScenes(true)[0].scene.start('StageSelect', s); window.__step(5); }, setup);
for (const k of ['ArrowDown', 'ArrowRight', 'Enter']) await page.keyboard.press(k);
await page.evaluate(() => window.__step(60));
const landed2 = await page.evaluate(() => window.game.scene.isActive('Battle') ? window.game.scene.getScene('Battle').stage.id : null);
console.log(JSON.stringify({ case: 'three taps in one frame', port: PORT, battle: landed2, ok: landed2 === 'hydrogen-breakout' }));
await browser.close();
