// Screenshot a fighter idle (and mid-walk, mid-attack) facing right and left on the-core:
//   node tools/fighter-facing-shot.mjs van [outPrefix]   -> /workspace/pt/<prefix>_{idle,walk,attack}_{right,left}.png
import { chromium } from 'playwright-core';
const [id, prefix = `facing_${process.argv[2]}`] = process.argv.slice(2);
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForFunction(() => window.game?.scene?.isActive?.('Title'), null, { timeout: 60000 });
await page.evaluate((id) => window.game.scene.start('Battle', { players: [{ charId: id, palette: 0 }, { charId: id === 'helen' ? 'hydra' : 'helen', palette: 0 }], stocks: 3, stageId: 'the-core' }), id);
await page.waitForFunction(() => { const s = window.game.scene.getScene('Battle'); return s?.fighters?.length === 2 && s.fighters[0].body; }, null, { timeout: 60000 });
await page.waitForTimeout(7000);
const out = {};
for (const face of [1, -1]) {
  const side = face > 0 ? 'right' : 'left';
  const setup = (mv) => page.evaluate(async ([face, mv]) => {
    const s = window.game.scene.getScene('Battle'); const f = s.fighters[0], foe = s.fighters[1];
    f.state = 'idle'; f.attackCooldownUntil = 0; f.moveLock = {}; f.facing = face; f.x = 640; f.body.setVelocity(0, 0);
    foe.x = 640 + 260 * face; foe.body.setVelocity(0, 0);
    if (mv) f.startMove(s.simNow ?? s.time.now, f.charDef.moves[mv], 'basic', mv);
  }, [face, mv]);
  await setup(null); await page.waitForTimeout(600);
  await page.screenshot({ path: `/workspace/pt/${prefix}_idle_${side}.png` });
  out[`idle_${side}`] = await page.evaluate(() => { const f = window.game.scene.getScene('Battle').fighters[0]; return { facing: f.facing, flipX: f.rig?.sprite?.flipX, clip: f.rig?.currentClip, cscale: Math.sign(f.rig?.scaleX) }; });
  await page.waitForTimeout(900);
  await setup('basicDirectional'); await page.waitForTimeout(170);
  await page.screenshot({ path: `/workspace/pt/${prefix}_attack_${side}.png` });
  await page.waitForTimeout(1200);
}
console.log(JSON.stringify(out));
await browser.close();
