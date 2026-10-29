// Audit: every beam / projectile / dash move's FX art must lie on the side the fighter faces (dash trails behind).
//   PORT=5173 node tools/fx-direction-audit.mjs [fighterId ...]     (writes /workspace/pt/fx_direction_audit.json)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const PORT = process.env.PORT || 5173;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push((e.stack || e.message).slice(0, 300)));
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
const sleep = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = async (fn, arg, label, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn, arg)) return true; await sleep(100); } return false; };
await until(() => window.game?.scene?.isActive?.('Title'), null, 'title');
const ids = process.argv.slice(2).length ? process.argv.slice(2) : await ev(async () => {
  const { MOVESETS } = await import('/src/data/movesets.js');
  return Object.keys(MOVESETS).filter((id) => Object.values(MOVESETS[id]).some((m) => ['beam', 'projectile', 'dash'].includes(m.kind)));
});
const out = {};
for (const id of ids) {
  await ev(() => { const g = window.game; if (g.scene.isActive('Battle')) g.scene.stop('Battle'); for (const sc of g.scene.getScenes(true)) g.scene.sleep(sc.scene.key); });
  await sleep(300);
  const other = id === 'helen' ? 'hydra' : 'helen';
  await ev(([a, b]) => window.game.scene.start('Battle', { players: [{ charId: a, palette: 0 }, { charId: b, palette: 0 }], stocks: 3, stageId: 'the-core' }), [id, other]);
  const ok = await until(() => { const s = window.game.scene.getScene('Battle'); return window.game.scene.isActive('Battle') && s.fighters?.length === 2 && s.fighters[0].body; }, null, 'battle');
  if (!ok) { out[id] = { error: 'battle did not start' }; continue; }
  await sleep(2500);
  try { out[id] = await ev(async (id) => {
    const s = window.game.scene.getScene('Battle');
    const f = s.fighters[0];
    const res = [];
    const slots = [['basicDirectional', 'basic'], ['specialDirectional', 'special']];
    for (const [key, slot] of slots) {
      const mv = f.charDef.moves[key];
      if (!mv || !['beam', 'projectile', 'dash'].includes(mv.kind)) continue;
      for (const face of [1, -1]) {
        // reset: centre the fighter, clear busy state
        const foe = s.fighters[1]; foe.x = f.x + 4000; foe.body?.setVelocity?.(0, 0);
        f.state = 'idle'; f.attackCooldownUntil = 0; f.specialCooldownUntil = 0; f.moveLock = {}; f.facing = face;
        f.x = s.cameras.main.midPoint.x; f.body?.setVelocity?.(0, 0);
        const fx0 = f.x;
        const seen = new Map();
        const before = new Set(s.children.list);
        const now = () => s.simNow ?? s.time.now;
        f.startMove(now(), mv, slot, key);
        const t0 = performance.now();
        while (performance.now() - t0 < 650) {
          for (const o of s.children.list) {
            const k = o.texture?.key;
            if (!k || !k.startsWith(`fx-${id}-`) || !o.visible || o.alpha < 0.05 || before.has(o)) continue;
            // Phaser's getBounds() mis-sides images with a negative scale, so work out where the art is drawn:
            // local x runs from -origin*W to (1-origin)*W, mirrored by the scale's sign, then rotated.
            const W = Math.abs(o.displayWidth || o.width || 0);
            const sgn = Math.sign(o.scaleX) || 1;
            const rot = o.rotation || 0;
            const half = (0.5 - (o.originX ?? 0.5)) * W * sgn;
            const cxWorld = o.x + Math.cos(rot) * half;
            const rec = { key: k, cx: Math.round((cxWorld - f.x) * face), w: Math.round(W), sx: sgn, rot: Math.round(rot * 100) / 100, originX: o.originX };
            const prev = seen.get(k);
            if (!prev || Math.abs(rec.cx) > Math.abs(prev.cx)) seen.set(k, rec);
          }
          await new Promise((r) => setTimeout(r, 25));
        }
        res.push({ move: mv.name, kind: mv.kind, face, fx: [...seen.values()], hydraFlip: f.facing });
        f.state = 'idle';
        await new Promise((r) => setTimeout(r, 700));
      }
    }
    return res;
  }, id); } catch (e) { out[id] = { error: String(e.message).slice(0, 120) }; }
  console.log(id, Array.isArray(out[id]) ? out[id].length + ' cases' : out[id].error);
  fs.writeFileSync('/workspace/pt/fx_direction_audit.json', JSON.stringify(out, null, 1));
}
fs.writeFileSync('/workspace/pt/fx_direction_audit.json', JSON.stringify(out, null, 1));
console.log(errs.length ? 'page errors: ' + errs.slice(0, 3).join(' | ') : 'no page errors');
await browser.close();
