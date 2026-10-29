// Screenshot a fighter's move mid-flight facing both ways:  node tools/fx-direction-shot.mjs wolf specialDirectional [ms]
import { chromium } from 'playwright-core';
const [id, key, ms = '250'] = process.argv.slice(2);
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForFunction(() => window.game?.scene?.isActive?.('Title'), null, { timeout: 60000 });
await page.evaluate((id) => window.game.scene.start('Battle', { players: [{ charId: id, palette: 0 }, { charId: id === 'helen' ? 'hydra' : 'helen', palette: 0 }], stocks: 3, stageId: 'the-core' }), id);
await page.waitForFunction(() => { const s = window.game.scene.getScene('Battle'); return s?.fighters?.length === 2 && s.fighters[0].body; }, null, { timeout: 60000 });
await page.waitForTimeout(7000);
for (const face of [1, -1]) {
  await page.evaluate(async ([face, key]) => {
    const s = window.game.scene.getScene('Battle'); const f = s.fighters[0]; const foe = s.fighters[1];
    foe.x = f.x + 4000 * face; f.state = 'idle'; f.attackCooldownUntil = 0; f.specialCooldownUntil = 0; f.moveLock = {}; f.facing = face; f.x = 640; f.body.setVelocity(0, 0);
    const mv = f.charDef.moves[key];
    f.startMove(s.simNow ?? s.time.now, mv, /^special/.test(key) ? 'special' : 'basic', key);
  }, [face, key]);
  await page.waitForTimeout(Number(ms));
  await page.screenshot({ path: `/workspace/pt/fxdir_${id}_${key}_${face > 0 ? 'right' : 'left'}.png` });
  await page.waitForTimeout(1200);
}
await browser.close();
