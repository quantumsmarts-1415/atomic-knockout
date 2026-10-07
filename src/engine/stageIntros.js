// ---------------------------------------------------------------------------
// Per-stage match intros (optional). A stage opts in with
//   intro: { type: 'doors', art: { doorLeft: 'x.jpg', doorRight: 'y.jpg' } }
// in data/stages.js (art files live in stage.art.dir and are loaded by
// loadStageArt as stage-<id>-intro-<name>). BattleScene calls
// startStageIntro() once the stage is built; while the returned controller is
// .active, fighter input is frozen. Handlers build their own display objects,
// clean them up, and call done() exactly once -- that's when gameplay unlocks.
// Add new intro types to STAGE_INTROS.
// ---------------------------------------------------------------------------
import * as Phaser from 'phaser';
import { stageKey } from '../data/stages.js';
import { play as sfx } from './sfx.js';
import { FONT_DISPLAY } from '../ui/theme.js';

const DEPTH = 1000; // above the stage, fighters and HUD

export const STAGE_INTROS = {
  doors: doorsIntro,
};

export function introKey(stage, name) {
  return stageKey(stage, `intro-${name}`);
}

/** Starts stage.intro if it has a known handler; returns a controller
 *  { active, skip() } or null when the stage has no intro. */
export function startStageIntro(scene, stage, { onDone } = {}) {
  const def = stage.intro;
  const handler = def && STAGE_INTROS[def.type];
  if (!handler) return null;
  const ctl = { active: true, skip() {} };
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    ctl.active = false;
    onDone?.();
  };
  try {
    handler(scene, stage, def, ctl, done);
  } catch (err) {
    console.error(`stage intro '${def.type}' failed: ${err.message}`);
    done();
  }
  return ctl;
}

/** The "GO!" banner shown when an intro hands over to gameplay. */
export function showGo(scene) {
  const { width: W, height: H } = scene.scale;
  const t = scene.add.text(W / 2, H / 2 - 30, 'GO!', {
    fontFamily: FONT_DISPLAY, fontSize: '120px', color: '#ffffff',
    stroke: '#0b3b5c', strokeThickness: 12,
  }).setOrigin(0.5).setDepth(DEPTH + 10).setScale(1.7).setAlpha(0);
  sfx('go');
  scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, alpha: 0, scale: 1.15, delay: 650, duration: 300, onComplete: () => t.destroy() });
}

function steamTexture(scene) {
  const key = 'fx-steam-puff';
  if (scene.textures.exists(key)) return key;
  const c = scene.textures.createCanvas(key, 64, 64);
  const ctx = c.getContext();
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, 'rgba(235,245,250,0.9)');
  g.addColorStop(0.5, 'rgba(210,225,235,0.35)');
  g.addColorStop(1, 'rgba(200,215,225,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  c.refresh();
  return key;
}

// ------------------------------------------------------------ blast doors
// Closed doors cover the screen -> red alarm pulses -> unlock thunk (shake +
// steam from the seam) -> doors slide apart -> stop thunk -> GO!  ~1.5s.
function doorsIntro(scene, stage, def, ctl, done) {
  const { width: W, height: H } = scene.scale;
  const kl = introKey(stage, 'doorLeft');
  const kr = introKey(stage, 'doorRight');
  if (!scene.textures.exists(kl) || !scene.textures.exists(kr)) { done(); return; }
  const T = { alarm: 520, unlock: 520, slideAt: 620, slide: 850, ...(def.timing ?? {}) };

  const objs = [];
  const timers = [];
  const tweens = [];
  const add = (o) => { objs.push(o); return o; };
  const left = add(scene.add.image(0, 0, kl).setOrigin(0, 0).setDepth(DEPTH));
  const right = add(scene.add.image(W / 2, 0, kr).setOrigin(0, 0).setDepth(DEPTH));
  // red alarm: screen wash + the doors' blue light strips turning red
  const wash = add(scene.add.rectangle(W / 2, H / 2, W, H, 0xff1e10).setDepth(DEPTH + 1)
    .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
  const stripX = def.stripInset ?? 66;
  const stripL = add(scene.add.rectangle(stripX, H / 2, 16, H, 0xff3a24).setDepth(DEPTH + 1)
    .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
  const stripR = add(scene.add.rectangle(W - stripX, H / 2, 16, H, 0xff3a24).setDepth(DEPTH + 1)
    .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
  const steam = scene.add.particles(0, 0, steamTexture(scene), {
    emitting: false, lifespan: { min: 600, max: 1100 }, speed: { min: 60, max: 220 },
    angle: { min: 0, max: 360 }, scale: { start: 1.0, end: 3.6 }, alpha: { start: 0.9, end: 0 },
    gravityY: -60, rotate: { min: 0, max: 360 },
  }).setDepth(DEPTH + 2);
  objs.push(steam);
  const puff = (x, n) => { for (let i = 0; i < n; i++) steam.explode(1, x + Phaser.Math.Between(-14, 14), Phaser.Math.Between(10, H - 10)); };

  sfx('alarm');
  tweens.push(scene.tweens.add({ targets: [wash], alpha: 0.24, duration: T.alarm / 4, yoyo: true, repeat: 1 }));
  tweens.push(scene.tweens.add({ targets: [stripL, stripR], alpha: 0.95, duration: T.alarm / 4, yoyo: true, repeat: 1 }));
  timers.push(scene.time.delayedCall(T.alarm / 2, () => sfx('alarm')));

  timers.push(scene.time.delayedCall(T.unlock, () => {
    scene.cameras.main.shake(180, 0.007);
    sfx('doorUnlock');
    puff(W / 2, 48);
  }));

  timers.push(scene.time.delayedCall(T.slideAt, () => {
    sfx('doorSlide');
    tweens.push(scene.tweens.add({ targets: left, x: -W / 2 - 40, duration: T.slide, ease: 'Cubic.easeInOut' }));
    tweens.push(scene.tweens.add({ targets: [stripL], x: stripX - W / 2 - 40, alpha: 0, duration: T.slide, ease: 'Cubic.easeInOut' }));
    tweens.push(scene.tweens.add({ targets: [stripR], x: W - stripX + W / 2 + 40, alpha: 0, duration: T.slide, ease: 'Cubic.easeInOut' }));
    tweens.push(scene.tweens.add({
      targets: right, x: W + 40, duration: T.slide, ease: 'Cubic.easeInOut',
      onUpdate: (tw) => { if (Math.random() < 0.45 && tw.progress < 0.7) { puff(left.x + W / 2, 2); puff(right.x, 2); } },
      onComplete: () => finish(true),
    }));
  }));

  let ended = false;
  function finish(natural) {
    if (ended) return;
    ended = true;
    timers.forEach((t) => t.remove(false));
    tweens.forEach((t) => t.stop());
    if (natural) scene.cameras.main.shake(110, 0.004);
    else scene.cameras.main.resetFX();
    sfx('doorUnlock');
    // let any live steam drift out, then clean up
    objs.forEach((o) => { if (o !== steam) o.destroy(); });
    scene.time.delayedCall(natural ? 900 : 0, () => steam.destroy());
    done();
    showGo(scene);
  }
  ctl.skip = () => finish(false);
}
