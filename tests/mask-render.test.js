// Masks must sit on the pixels the browser actually drew.
// The check reads the canvas back: sprite pixels versus the overlay cells
// at the same screen position. A shift of a few dozen pixels fails it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const { PNG } = require('pngjs');

const BASE = process.env.AK_URL || 'http://127.0.0.1:5173';

const CASES = [
  { id: 'sully', pose: 'idle', facing: 1 },
  { id: 'sully', pose: 'idle', facing: -1 },
  { id: 'sully', pose: 'crouch', facing: 1 },
  { id: 'sully', pose: 'jump', facing: 1 },
  { id: 'hog', pose: 'idle', facing: 1 },
  { id: 'hog', pose: 'idle', facing: -1 },
  { id: 'hog', pose: 'attack', facing: 1 },
  { id: 'hog', pose: 'attack', facing: -1 },
  { id: 'hog', pose: 'idle', facing: 1, nudge: 36 },
  { id: 'hydra', pose: 'walk', facing: 1, frame: 4 },
  { id: 'boar', pose: 'idle', facing: 1 },
  { id: 'boar', pose: 'attack', facing: 1 },
  { id: 'maggie', pose: 'idle', facing: 1 },
  { id: 'chroma', pose: 'idle', facing: 1 },
];

function paintMask(w, h, cells, view, zoom, dx) {
  const mask = new Uint8Array(w * h);
  let n = 0;
  const vx = view.x;
  const vy = view.y;
  for (const c of cells) {
    const x0 = Math.max(0, Math.floor((c.x + dx - vx) * zoom));
    const y0 = Math.max(0, Math.floor((c.y - vy) * zoom));
    const x1 = Math.min(w, Math.ceil((c.x + c.w + dx - vx) * zoom));
    const y1 = Math.min(h, Math.ceil((c.y + c.h - vy) * zoom));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const k = y * w + x;
        if (!mask[k]) { mask[k] = 1; n++; }
      }
    }
  }
  return { mask, n };
}

function iou(sprite, mask) {
  let inter = 0;
  let sn = 0;
  let mn = 0;
  let sx = 0;
  let sy = 0;
  let mx = 0;
  let my = 0;
  let x0 = 1e9;
  let x1 = -1;
  for (let i = 0; i < sprite.length; i++) {
    const s = sprite[i];
    const m = mask[i];
    if (s) {
      sn++;
      sx += i % sprite.w;
      sy += (i / sprite.w) | 0;
      const x = i % sprite.w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
    }
    if (m) {
      mn++;
      mx += i % sprite.w;
      my += (i / sprite.w) | 0;
    }
    if (s && m) inter++;
  }
  const union = sn + mn - inter;
  return {
    iou: union ? inter / union : 0,
    cover: sn ? inter / sn : 0,
    sn,
    mn,
    scx: sn ? sx / sn : 0,
    mcx: mn ? mx / mn : 0,
    width: Math.max(1, x1 - x0),
  };
}

function score(png, cells, view, zoom, dx) {
  const w = png.width;
  const h = png.height;
  const sprite = new Uint8Array(w * h);
  sprite.w = w;
  const data = png.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 240 && g < 40 && b > 240) continue;
      sprite[y * w + x] = 1;
    }
  }
  const painted = paintMask(w, h, cells, view, zoom, dx);
  const pixel = iou(sprite, painted.mask);
  const grown = new Uint8Array(sprite.length);
  grown.w = w;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!sprite[y * w + x]) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx2 = -1; dx2 <= 1; dx2++) {
          const xx = x + dx2;
          if (xx < 0 || xx >= w) continue;
          grown[yy * w + xx] = 1;
        }
      }
    }
  }
  pixel.edge = iou(grown, painted.mask).iou;
  return pixel;
}

async function serverUp() {
  try {
    const res = await fetch(BASE, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function boot(browser, id) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(`${BASE}/?playtest=${id}&ms=900000&stage=elemental-isle`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__akBattle?.fighters?.length, null, { timeout: 90000 });
  await page.evaluate(() => {
    const scene = window.__akBattle;
    const f = scene.fighters[0];
    scene.matchOver = true;
    scene.showBoxes = false;
    scene.updateCamera = () => {};
    scene.renderInterp = () => {};
    for (const child of scene.children.list) {
      if (child !== f) child.setVisible?.(false);
    }
    const cam = scene.cameras.main;
    cam.setBackgroundColor(0xff00ff);
    cam.setZoom(1.5);
    cam.centerOn(640, 450);
  });
  page.__errors = errors;
  return page;
}

async function measure(page, spec) {
  await page.evaluate(async (spec) => {
    const { bodyCenterBias } = await import('/src/engine/masks.js');
    const scene = window.__akBattle;
    const f = scene.fighters[0];
    const facing = spec.facing || 1;
    f.alive = true;
    f.visible = true;
    f.setVisible(true);
    f.facing = facing;
    f.rig.facing = facing;
    f.rig.moveKey = null;
    f.rig.x = spec.nudge || 0;
    f.rig.y = 0;
    f.body.reset(640, 520);
    f.x = 640;
    f.y = 520;
    f.prevX = 640;
    f.prevY = 520;
    scene.renderInterp = () => { f.rig.x = spec.nudge || 0; f.rig.y = 0; };
    const pose = spec.pose;
    if (pose === 'attack') {
      f.state = 'attack';
      f.frameData = { startup: 3, active: 6, recovery: 6 };
      f.attackFrame = 3;
      f.rig.frameData = f.frameData;
      f.rig.attackFrame = 3;
      f.rig.animate(0.016, 'attack', 1);
    } else if (pose === 'walk') {
      f.state = 'walk';
      f.rig.animate(0.016, 'walk', 1);
      if (spec.frame != null) {
        const key = `${f.charDef.art.key}-walk`;
        f.rig.sprite.setTexture(key, spec.frame);
        f.rig.rememberMask('walk', spec.frame);
      }
    } else if (pose === 'crouch') {
      f.state = 'jumpsquat';
      f.rig.animate(0.016, 'jumpsquat', 1);
    } else if (pose === 'jump') {
      f.state = 'jump';
      f.rig.vy = 280;
      f.rig.animate(0.016, 'jump', 1);
    } else {
      f.state = 'idle';
      f.rig.animate(0.016, 'idle', 1);
      f.rig.sprite.setTexture(`${f.charDef.art.key}-idle`, 0);
      f.rig.rememberMask('idle', 0);
      f.rig._pose = { rot: 0, sx: 1, sy: 1, x: 0, y: 0 };
      // The idle body is centered on the feet. The sprite has to sit on that
      // same slide or the overlay reads the wide side as a miss.
      f.rig.sprite.x = f.rig.sheetMode ? bodyCenterBias(f.charDef.id) : 0;
      f.rig.sprite.y = 0;
      f.rig.sprite.rotation = 0;
      f.rig.sprite.setScale(f.rig._layoutScale, f.rig._layoutScale);
    }
    f.rig.x = spec.nudge || 0;
    f.setVisible(true);
    f.rig.sprite?.setVisible?.(true);
  }, spec);
  // The snapshot reads the canvas. A throttled headless frame can still be
  // showing the previous pose, which is a mirror of this one and fails the
  // edge check by a hair. Wait until the browser has actually painted.
  const shot = await page.evaluate(async () => {
    const masks = await import('/src/engine/masks.js');
    const scene = window.__akBattle;
    const f = scene.fighters[0];
    const cam = scene.cameras.main;
    // Phaser advances the spritesheet on its own clock. One extra idle frame
    // against the mask we just pinned fails the edge check, and only on some
    // paints. Stop the clip and show that exact frame, then let it draw.
    const lock = () => {
      const spr = f.rig?.sprite;
      if (!spr) return;
      spr.anims?.stop();
      if (spr.anims) spr.anims.timeScale = 0;
      const key = `${f.charDef.art.key}-${f.rig.maskClip || 'idle'}`;
      if (scene.textures.exists(key)) spr.setTexture(key, f.rig.maskFrame || 0);
    };
    lock();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    lock();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return new Promise((resolve) => {
      scene.game.renderer.snapshot((img) => {
        resolve({
          src: img.src,
          cells: masks.debugCells(f),
          clip: f.rig.maskClip,
          frame: f.rig.maskFrame,
          zoom: cam.zoom,
          view: { x: cam.worldView.x, y: cam.worldView.y, w: cam.worldView.width, h: cam.worldView.height },
        });
      });
    });
  });
  const png = PNG.sync.read(Buffer.from(shot.src.replace(/^data:image\/png;base64,/, ''), 'base64'));
  const raw = score(png, shot.cells, shot.view, shot.zoom, 0);
  const shifted = score(png, shot.cells, shot.view, shot.zoom, 48);
  return {
    ...spec, ...raw, shifted: shifted.iou, clip: shot.clip, frame: shot.frame, cells: shot.cells.length,
  };
}

test('drawn sprites overlap their mask cells', async () => {
  assert.ok(await serverUp(), `dev server not reachable at ${BASE}`);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const rows = [];
  try {
    let page = null;
    let current = null;
    for (const spec of CASES) {
      if (spec.id !== current) {
        if (page) await page.close();
        page = await boot(browser, spec.id);
        current = spec.id;
      }
      const row = await measure(page, spec);
      rows.push(row);
      const label = `${row.id} ${row.pose} face ${row.facing} ${row.clip}:${row.frame}`;
      row.label = label;
      row.drift = Math.abs(row.scx - row.mcx) / row.width;
    }
    const bad = rows.filter((r) => r.sn < 500 || r.cells < 10 || r.drift >= 0.08 || r.cover <= 0.9 || r.edge <= 0.8 || r.iou <= 0.75 || r.shifted >= 0.55);
    assert.deepEqual(bad.map((r) => `${r.label} edge ${r.edge.toFixed(3)} pixel ${r.iou.toFixed(3)} cover ${(r.cover * 100).toFixed(0)}% drift ${(r.drift * 100).toFixed(1)}% shift ${r.shifted.toFixed(3)}`), []);
    assert.equal(page.__errors.length, 0, page.__errors.join('\n'));
  } finally {
    console.log(rows.map((r) => `${r.id} ${r.pose} f${r.facing}${r.nudge ? ' nudge' : ''} pixel ${r.iou.toFixed(3)} edge ${r.edge.toFixed(3)} cover ${(r.cover * 100).toFixed(0)}%`).join('\n'));
    await browser.close();
  }
});

test('a hidden fighter contributes no overlay cells', async () => {
  assert.ok(await serverUp(), `dev server not reachable at ${BASE}`);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    await page.goto(`${BASE}/?playtest=sully,hog&ms=900000&stage=elemental-isle`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__akBattle?.fighters?.length === 2, null, { timeout: 90000 });
    const counts = await page.evaluate(async () => {
      const masks = await import('/src/engine/masks.js');
      const scene = window.__akBattle;
      scene.matchOver = true;
      scene.showBoxes = true;
      const hog = scene.fighters.find((f) => f.charDef.id === 'hog');
      hog.setVisible(false);
      hog.state = 'ko';
      scene.drawDebug();
      return {
        sully: masks.debugCells(scene.fighters.find((f) => f.charDef.id === 'sully')).length,
        hog: masks.debugCells(hog).length,
      };
    });
    assert.ok(counts.sully > 10);
    assert.equal(counts.hog, 0);
  } finally {
    await browser.close();
  }
});
