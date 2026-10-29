// Every painted stage's background layers must cover the whole camera view at every zoom and scroll the camera can reach
// (no black strip beside the art). Starts each stage in a match and measures the layer images against the view.
//   PORT=5173 node tools/stage-bg-check.mjs
import { chromium } from 'playwright-core';
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push((e.stack || e.message).slice(0, 300)));
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = async (fn, arg, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn, arg)) return true; await sleep(100); } return false; };
await until(() => window.game?.scene?.isActive?.('Title'));
const ids = await ev(async () => (await import('/src/data/stages.js')).STAGES.filter((s) => s.art?.layers?.length).map((s) => s.id));
const fails = [];
for (const id of ids) {
  await ev(() => { const g = window.game; if (g.scene.isActive('Battle')) g.scene.stop('Battle'); for (const sc of g.scene.getScenes(true)) g.scene.sleep(sc.scene.key); });
  await sleep(300);
  await ev((stageId) => window.game.scene.start('Battle', { players: [{ charId: 'hydra', palette: 0 }, { charId: 'helen', palette: 0 }], stocks: 3, stageId }), id);
  await until(() => { const s = window.game.scene.getScene('Battle'); return window.game.scene.isActive('Battle') && s.camRig && s.children.list.length > 20; });
  await sleep(2500);
  const r = await ev(() => {
    const s = window.game.scene.getScene('Battle');
    const rig = s.camRig, cam = s.cameras.main;
    const layers = s.children.list.filter((o) => o.type === "Image" && /layer0/.test(o.texture?.key || "") && o.scrollFactorX < 1 && o.scrollFactorX > 0);
    const W = 1280, H = 720, miss = [];
    const rb = rig.bounds;
    for (const zoom of [rig.minZoom, (rig.minZoom + rig.maxZoom) / 2, rig.maxZoom]) {
      const vw = W / zoom, vh = H / zoom;
      for (const sx of [rb.left, rb.right - vw]) for (const sy of [rb.top, rb.bottom - vh]) {
        // the camera clamps its scroll to the bounds, so these are the extreme views it can show
        const sxc = Math.min(Math.max(sx, rb.left), Math.max(rb.left, rb.right - vw)), syc = Math.min(Math.max(sy, rb.top), Math.max(rb.top, rb.bottom - vh));
        for (const img of layers) {
          const L = img.x - sxc * img.scrollFactorX, T = img.y - syc * img.scrollFactorY;
          const R = L + img.displayWidth, B = T + img.displayHeight;
          if (L > sxc + 0.5 || T > syc + 0.5 || R < sxc + vw - 0.5 || B < syc + vh - 0.5) miss.push({ layer: img.texture.key, zoom: +zoom.toFixed(2), sx: Math.round(sxc), sy: Math.round(syc), L: Math.round(L), R: Math.round(R), vw: Math.round(vw) });
        }
      }
    }
    return { minZoom: rig.minZoom, bounds: rig.bounds, layers: layers.length, miss: miss.slice(0, 3), missCount: miss.length };
  });
  const ok = r.layers > 0 && r.missCount === 0;
  console.log(ok ? 'ok  ' : 'FAIL', `${id}: ${r.layers} layers cover the view (minZoom ${r.minZoom.toFixed(2)}, bounds ${JSON.stringify(r.bounds)})${ok ? '' : ' ' + JSON.stringify(r.miss)}`);
  if (!ok) fails.push(id);
  if (id === 'neon-nexus') await page.screenshot({ path: '/workspace/pt/campaign5_stage_neon_nexus_full.png' });
}
console.log(errs.length ? 'FAIL page errors ' + errs.join('|') : 'ok   no page errors');
await browser.close();
process.exit(fails.length || errs.length ? 1 : 0);
