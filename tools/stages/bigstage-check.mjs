// Headless check for the big camera stage (Carbon Skyhook): a bot-vs-bot
// match stepped at a fixed 60 fps (so ~60 s of game time regardless of how
// slow headless rendering is), logging camera zoom, which surface each bot
// stands on, KOs (who/what caused them), stuck bots and whether the camera
// kept both fighters in frame. Screenshots -> /workspace/stages-preview/big-stage/
// Playwright's own Chromium (not the shared box Chrome). Copy next to a
// 'playwright' install and run while `PORT=5207 node server.js` is up:
//   node bigstage-check.mjs [charA charB seconds tag]
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const OUT = '/workspace/stages-preview/big-stage';
const PORT = process.env.PORT || 5207;
const [A = 'natalie', B = 'sully', SECS = '60', TAG = 'match'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.game?.scene?.isActive('Title'), null, { timeout: 600000 });

const setup = { players: [{ charId: A, palette: 0, slot: 100 }, { charId: B, palette: 1, slot: 101 }], stocks: 3, stageId: 'carbon-skyhook' };
await page.evaluate((s) => { window.game.scene.getScenes(true)[0].scene.start('Battle', s); }, setup);
await page.waitForFunction(() => window.game.scene.getScene('Battle')?.stage?.id === 'carbon-skyhook' && window.game.scene.getScene('Battle').fighters?.[0]?.body, null, { timeout: 60000 });

// take over the clock: fixed 16.67 ms steps
await page.evaluate(async () => {
  const g = window.game;
  g.loop.sleep();
  const nav = await import('/src/engine/BotNav.js');
  const b = g.scene.getScene('Battle');
  b.tweens.setLagSmooth(16.67, 16.67);
  window.__t = performance.now();
  window.__log = { samples: [], kos: [], nodesVisited: [new Set(), new Set()], edges: [{}, {}], prev: null, lastHitAt: [0, 0], stillSince: [0, 0], stillAt: [null, null], stuck: [], offFrame: 0, frames: 0 };
  window.__stepN = (n) => {
    const L = window.__log;
    for (let i = 0; i < n; i++) {
      window.__t += 16.67;
      g.step(window.__t, 16.67);
      L.frames++;
      const t = b.time.now;
      const cam = b.cameras.main;
      const v = cam.worldView;
      b.fighters.forEach((f, k) => {
        const p = L.prev?.[k];
        if (p && f.percent > p.pct + 0.01) L.lastHitAt[k] = t;
        if (p && f.stocks < p.stocks) {
          L.kos.push({ t: Math.round(t), who: f.charDef.id, at: { x: Math.round(p.x), y: Math.round(p.y) }, pct: Math.round(p.pct),
            lastHitAgoMs: L.lastHitAt[k] ? Math.round(t - L.lastHitAt[k]) : null, selfDestruct: !L.lastHitAt[k] || t - L.lastHitAt[k] > 4000,
            edge: p.edge, recovering: p.recovering });
          L.lastHitAt[k] = 0;
        }
        const grounded = f.body && (f.body.blocked.down || f.body.touching.down);
        if (f.alive && f.visible && grounded && b.nav) {
          const n = nav.nodeAt(b.nav, f.x, f.y);
          if (n) L.nodesVisited[k].add(n.id);
        }
        if (f._ai?.lastEdge) { const ty = f._ai.lastEdge.split('>')[0]; L.edges[k][ty] = (L.edges[k][ty] ?? 0) + 1; }
        // stuck: <40px of movement in 6 s while alive and not in hitstun
        if (f.alive && f.visible) {
          const sa = L.stillAt[k];
          if (!sa || Math.hypot(f.x - sa.x, f.y - sa.y) > 40) { L.stillAt[k] = { x: f.x, y: f.y }; L.stillSince[k] = t; }
          else if (t - L.stillSince[k] > 6000) { L.stuck.push({ t: Math.round(t), who: f.charDef.id, x: Math.round(f.x), y: Math.round(f.y), edge: f._ai?.lastEdge }); L.stillSince[k] = t; }
        }
        // in frame? (only counts while inside the world -- outside it the camera is clamped and shows an arrow)
        if (f.alive && f.visible && f.x > 0 && f.x < 2560 && f.y > 60 && f.y < 1440) {
          if (f.x < v.x || f.x > v.right || f.y - f.bodyH < v.y - 40 || f.y > v.bottom + 5) L.offFrame++;
        }
      });
      L.prev = b.fighters.map((f) => ({ x: f.x, y: f.y, pct: f.percent, stocks: f.stocks, edge: f._ai?.lastEdge, recovering: f._ai?.recovering }));
      if (L.frames % 15 === 0) L.samples.push({ t: Math.round(t), zoom: +cam.zoom.toFixed(3), sx: Math.round(v.x), sy: Math.round(v.y), f: b.fighters.map((f) => [Math.round(f.x), Math.round(f.y), f.stocks, Math.round(f.percent)]) });
      if (b.matchOver) break;
    }
    return { t: Math.round(b.time.now), over: !!b.matchOver, zoom: b.cameras.main.zoom, f: b.fighters.map((f) => ({ id: f.charDef.id, x: Math.round(f.x), y: Math.round(f.y), st: f.stocks, pct: Math.round(f.percent), edge: f._ai?.lastEdge })) };
  };
});

const shots = [];
if (process.env.CAMDEMO) {
  // scripted camera poses (CPUs paused): how far apart -> how far out
  const poses = [
    ['together', [[900, 1170], [1010, 1170]]],
    ['deck-to-dock', [[560, 1110], [1700, 1170]]],
    ['summit-vs-deck', [[1065, 550], [1500, 1170]]],
    ['dock-to-dock', [[330, 1110], [2230, 1110]]],
    ['summit-vs-east-dock', [[1065, 550], [2230, 1110]]],
  ];
  const report = [];
  for (const [name, pos] of poses) {
    const r = await page.evaluate((pos) => {
      const b = window.game.scene.getScene('Battle');
      b.fighters.forEach((f, i) => { f.isBot = false; f.controlSlot = 90 + i; f.body.reset(pos[i][0], pos[i][1]); });
      const zs = [];
      let maxDz = 0; let maxPan = 0; let prev = null;
      for (let i = 0; i < 150; i++) {
        window.__stepN(1);
        b.fighters.forEach((f, k) => { if (Math.abs(f.x - pos[k][0]) > 2) f.body.reset(pos[k][0], f.y); }); // pin x
        const c = b.cameras.main;
        if (prev) { maxDz = Math.max(maxDz, Math.abs(c.zoom - prev.z)); maxPan = Math.max(maxPan, Math.hypot(c.midPoint.x - prev.x, c.midPoint.y - prev.y)); }
        prev = { z: c.zoom, x: c.midPoint.x, y: c.midPoint.y };
        zs.push(c.zoom);
      }
      const c = b.cameras.main; const v = c.worldView;
      const inView = b.fighters.every((f) => f.x >= v.x && f.x <= v.right && f.y - f.bodyH >= v.y - 2 && f.y <= v.bottom);
      return { zoom: +c.zoom.toFixed(3), view: [Math.round(v.x), Math.round(v.y), Math.round(v.width), Math.round(v.height)], inView, inWorld: v.x >= -0.5 && v.y >= -0.5 && v.right <= 2560.5 && v.bottom <= 1440.5, maxDzPerFrame: +maxDz.toFixed(4), maxPanPxPerFrame: +maxPan.toFixed(1), zoomAfter10: +zs[9].toFixed(3) };
    }, pos);
    const file = `camera_${String(report.length + 1).padStart(2, '0')}_${name}_zoom${r.zoom.toFixed(2)}.png`;
    await page.screenshot({ path: `${OUT}/${file}` });
    report.push({ name, file, ...r });
    console.log(name, JSON.stringify(r));
  }
  writeFileSync(`${OUT}/camera_log.json`, JSON.stringify({ report, errors }, null, 1));
  await browser.close();
  process.exit(0);
}
const frames = Math.round(Number(SECS) * 60);
for (let done = 0; done < frames; done += 150) {
  const r = await page.evaluate((n) => window.__stepN(n), Math.min(150, frames - done));
  const name = `${TAG}_${String(Math.round(r.t / 1000)).padStart(2, '0')}s_zoom${r.zoom.toFixed(2)}.png`;
  await page.screenshot({ path: `${OUT}/${name}` });
  shots.push({ name, t: r.t, zoom: r.zoom });
  console.log(`t=${(r.t / 1000).toFixed(1)}s zoom=${r.zoom.toFixed(2)}`, r.f.map((f) => `${f.id}(${f.x},${f.y}) st${f.st} ${f.pct}% [${f.edge}]`).join(' | '));
  if (r.over) break;
}
const log = await page.evaluate(() => {
  const L = window.__log;
  const z = L.samples.map((s) => s.zoom);
  return { frames: L.frames, seconds: +(L.frames / 60).toFixed(1), zoomMin: Math.min(...z), zoomMax: Math.max(...z),
    kos: L.kos, stuck: L.stuck, offFrameFighterFrames: L.offFrame,
    nodesVisited: L.nodesVisited.map((s) => [...s].sort((a, b) => a - b)), edgeFrames: L.edges,
    final: window.game.scene.getScene('Battle').fighters.map((f) => ({ id: f.charDef.id, stocks: f.stocks, kos: f.kos, pct: Math.round(f.percent) })),
    samples: L.samples };
});
writeFileSync(`${OUT}/${TAG}_log.json`, JSON.stringify({ setup, shots, errors, ...log }, null, 1));
console.log(JSON.stringify({ ...log, samples: undefined, errors }, null, 1));
await browser.close();
