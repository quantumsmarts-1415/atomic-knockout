#!/usr/bin/env node
/**
 * 60 fps deterministic capture. Steps the sim one frame at a time and
 * screenshots the canvas, so the file is the game's real frame rate.
 *
 *   node tools/capture-clip.mjs --out clip.mp4 --ids ira,oz --script ab --frames 480
 *   node tools/capture-clip.mjs --gif --fps 30 --script moves --ids selena,oz
 *
 * The page must already be the current build. Pass --url to point at a server.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright-core');

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}
function has(flag) {
  return process.argv.includes(flag);
}

const ids = arg('--ids', 'ira,oz');
const frames = Number(arg('--frames', '480'));
const out = resolve(arg('--out', 'clip.mp4'));
const scriptName = arg('--script', 'ab');
const gif = has('--gif');
const fps = Number(arg('--fps', gif ? '30' : '60'));
const port = Number(arg('--port', process.env.PORT || '5173'));
const base = arg('--url', `http://127.0.0.1:${port}`);
const stage = arg('--stage', 'elemental-isle');
const stocks = arg('--stocks', '5');
const seed = arg('--seed', '7');
const crf = arg('--crf', '20');

const dir = join(tmpdir(), `ak-cap-${process.pid}`);
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--disable-gpu', '--no-sandbox', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (err) => console.error('PAGE', err.message));

const url = `${base}/?playtest=${ids}&stocks=${stocks}&ms=60000&seed=${seed}&stage=${stage}`;
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => {
  const b = window.game?.scene?.getScene?.('Battle');
  return b?.fighters?.length >= 2 && b.fighters.every((f) => f.body && f.rig);
}, null, { timeout: 30000 });

// Land, then hand the clock to us.
await page.evaluate(async (scriptName) => {
  const b = window.game.scene.getScene('Battle');
  window.__akBattle = b;
  window.game.loop.sleep();
  for (let i = 0; i < 80; i++) b.runSimSteps(1);
  const keepBots = scriptName === 'match';
  for (const f of b.fighters) {
    if (!keepBots) f.isBot = false;
    const slot = f.controlSlot;
    b.keymaps[slot] = {
      left: { isDown: false }, right: { isDown: false }, jump: { isDown: false },
      down: { isDown: false }, attack: { isDown: false }, special: { isDown: false },
    };
  }
}, scriptName);

console.log(`recording ${frames} frames → ${out}`);

const stride = fps >= 60 ? 1 : Math.max(1, Math.round(60 / fps));
let written = 0;
for (let frame = 0; frame < frames; frame++) {
  await page.evaluate(({ frame, scriptName }) => {
    const b = window.__akBattle;
    const hero = b.fighters[0];
    const foe = b.fighters[1];
    const keys = (f) => b.keymaps[f.controlSlot];
    const clear = (f) => {
      const k = keys(f);
      if (!k?.left) return;
      k.left.isDown = k.right.isDown = k.jump.isDown = false;
      k.down.isDown = k.attack.isDown = k.special.isDown = false;
    };
    const ground = b.stage?.groundY ?? 560;
    const pin = (f, x, face) => {
      f.body.reset(x, ground);
      f.setPosition?.(x, ground);
      f.x = x;
      f.y = ground;
      f.facing = face;
      f.body.setVelocity(0, 0);
      f.launch = null;
      f._appliedLaunch = null;
    };
    clear(hero);
    clear(foe);
    const hk = keys(hero);
    if (scriptName === 'ab') {
      // 8s: jump, whiff, hit at 0%, hit at high percent, charge release.
      if (frame === 0) { pin(hero, 460, 1); pin(foe, 820, -1); foe.percent = 0; }
      if (frame >= 20 && frame < 36) hk.jump.isDown = true;
      if (frame >= 70 && frame < 92) { hero.facing = -1; hk.left.isDown = true; hk.attack.isDown = true; }
      if (frame === 130) { pin(hero, 620, 1); pin(foe, 760, -1); foe.percent = 0; foe.stocks = 5; }
      if (frame >= 142 && frame < 168) { hk.right.isDown = true; hk.attack.isDown = true; }
      if (frame === 250) { pin(hero, 860, 1); pin(foe, 1000, -1); foe.percent = 130; foe.stocks = Math.max(foe.stocks, 1); }
      if (frame >= 262 && frame < 290) { hk.right.isDown = true; hk.attack.isDown = true; }
      if (frame === 360) { pin(hero, 520, 1); pin(foe, 900, -1); }
      if (frame >= 372 && frame < 450) hk.attack.isDown = true;
    } else if (scriptName === 'moves') {
      // charge, normal, defense, special, against a standing dummy.
      if (frame === 0) { pin(hero, 500, 1); pin(foe, 740, -1); foe.percent = 40; }
      if (frame % 220 === 0 && frame > 0) { pin(hero, 500, 1); pin(foe, 740, -1); }
      const phase = frame % 220;
      if (phase < 70) hk.attack.isDown = true;
      else if (phase >= 90 && phase < 120) { hk.right.isDown = true; hk.attack.isDown = true; }
      else if (phase >= 140 && phase < 175) hk.special.isDown = true;
      else if (phase >= 190 && phase < 215) { hk.right.isDown = true; hk.special.isDown = true; }
    } else if (scriptName === 'match') {
      // CPUs play so the camera moves, then a scripted hit at high percent
      // produces a KO the short clip can actually show.
      for (const f of b.fighters) f.isBot = frame < 360;
      if (frame === 360) {
        const ground = b.stage?.groundY ?? 560;
        pin(hero, 560, 1);
        pin(foe, 700, -1);
        foe.percent = 160;
        foe.stocks = 1;
        const third = b.fighters[2];
        if (third) {
          pin(third, 980, -1);
          third.percent = 40;
        }
      }
      if (frame >= 372 && frame < 430) {
        hk.right.isDown = true;
        hk.attack.isDown = true;
      }
    }
    if (typeof b.captureFrame === 'function') b.captureFrame();
    else b.runSimSteps(1);
  }, { frame, scriptName });
  if (frame % stride === 0) {
    const name = String(written).padStart(5, '0');
    await page.screenshot({ path: join(dir, `${name}.jpg`), type: 'jpeg', quality: 78 });
    written++;
  }
  if (frame % 60 === 0) console.log(`  frame ${frame}/${frames}`);
}

await browser.close();

mkdirSync(dirname(out), { recursive: true });
const rate = gif ? fps : 60;
const vf = gif
  ? `fps=${fps},scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`
  : 'scale=1280:720:flags=lanczos';
const ff = spawnSync('ffmpeg', [
  '-y', '-framerate', String(rate), '-i', join(dir, '%05d.jpg'),
  ...(gif ? ['-vf', vf] : ['-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', crf, '-movflags', '+faststart']),
  out,
], { stdio: 'inherit' });
rmSync(dir, { recursive: true, force: true });
if (ff.status !== 0) process.exit(ff.status ?? 1);
console.log(`wrote ${out}`);
