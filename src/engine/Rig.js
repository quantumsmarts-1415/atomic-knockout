import * as Phaser from 'phaser';
import { sheetKey, use3dSheets, clipDisplayLayout, positiveFinite } from '../scenes/BootScene.js';
import { clipPose, moveClipFor, moveTextureKey } from './moveClip.js';
import { stripIndex, idleBlend, followThroughBlend, guardIdleBlend, attackPhase, poseTarget, FEEL } from './feel.js';
import { authoredClipName, sheetFrameIndex, sheetMeta } from './moveSheet.js';
import { applyColorway } from './colorwayPipeline.js';
import { bodyCenterBias } from './masks.js';

// ---------------------------------------------------------------------------
// Rig — the code-drawn vector cartoon character.
//
// Each character is assembled from separately drawn parts (head, torso, arms,
// legs) generated from Phaser Graphics into textures, then animated
// procedurally (walk cycles, attack swings, squash/stretch) by rotating and
// offsetting the parts each frame. This is the cutout-rig approach from the
// build doc, with palettes as pure data — any palette swap just regenerates
// textures in the new colors.
// ---------------------------------------------------------------------------

function texKey(charId, paletteIndex, part) {
  return `rig-${charId}-p${paletteIndex}-${part}`;
}

export function ensureRigTextures(scene, charDef, paletteIndex) {
  const pal = charDef.palettes[paletteIndex % charDef.palettes.length];
  const b = charDef.body;
  const mk = (part, w, h, draw) => {
    const key = texKey(charDef.id, paletteIndex, part);
    if (scene.textures.exists(key)) return;
    const g = scene.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  };

  // --- torso, drawn as a true profile facing RIGHT: a nearly straight back
  // edge on the left and a convex chest curve on the right, so the body's
  // silhouette agrees with the face direction (no decals needed).
  mk('torso', b.torsoWidth + 10, b.torsoHeight + 8, (g) => {
    const w = b.torsoWidth + 10;
    const h = b.torsoHeight + 8;
    // outline silhouette: flat back slab + chest ellipse
    g.fillStyle(pal.accent, 1);
    g.fillRoundedRect(0, 0, w * 0.58, h, { tl: 9, bl: 12, tr: 0, br: 0 });
    g.fillEllipse(w * 0.42, h / 2, w * 1.12, h);
    // body fill, inset
    g.fillStyle(pal.body, 1);
    g.fillRoundedRect(2.5, 2.5, w * 0.58 - 2.5, h - 5, { tl: 7, bl: 10, tr: 0, br: 0 });
    g.fillEllipse(w * 0.42, h / 2, w * 1.12 - 5, h - 5);
    // subtle spine shade at the back
    g.fillStyle(pal.accent, 0.35);
    g.fillRect(2.5, 4, 3.5, h - 8);
    // soft highlight tracing the chest curve
    g.lineStyle(2.2, 0xffffff, 0.2);
    g.beginPath();
    g.arc(w * 0.42, h / 2, (w * 1.12 - 8) / 2, Phaser.Math.DegToRad(-55), Phaser.Math.DegToRad(55));
    g.strokePath();
    // belt with the buckle set forward
    g.fillStyle(pal.accent, 1);
    g.fillRect(2.5, h - 12, w - 8, 6.5);
    g.fillStyle(0xf2c14e, 1);
    g.fillRoundedRect(w * 0.62, h - 13, 8, 8, 2);
  });

  // --- head: circle with eyes, smile, and a little cap of body color
  const hr = b.headRadius;
  mk('head', hr * 2 + 6, hr * 2 + 6, (g) => {
    const c = hr + 3;
    g.fillStyle(pal.accent, 1);
    g.fillCircle(c, c, hr + 3);
    g.fillStyle(pal.skin, 1);
    g.fillCircle(c, c, hr);
    // cap (top third in body color)
    g.fillStyle(pal.body, 1);
    g.slice(c, c, hr, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(340), false);
    g.fillPath();
    // eyes
    g.fillStyle(0xffffff, 1);
    g.fillCircle(c - hr * 0.38, c + hr * 0.05, hr * 0.28);
    g.fillCircle(c + hr * 0.38, c + hr * 0.05, hr * 0.28);
    g.fillStyle(pal.eye, 1);
    g.fillCircle(c - hr * 0.32, c + hr * 0.08, hr * 0.14);
    g.fillCircle(c + hr * 0.44, c + hr * 0.08, hr * 0.14);
    // smile
    g.lineStyle(2.5, pal.eye, 1);
    g.beginPath();
    g.arc(c, c + hr * 0.38, hr * 0.32, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
    g.strokePath();
  });

  // --- arm, drawn hanging naturally in profile facing RIGHT: the elbow
  // bows backward (left) and the hand ends forward (right), like a real
  // relaxed arm — this is what makes the limb read as front-facing.
  mk('arm', b.armWidth + 18, b.armLength + b.armWidth + 6, (g) => {
    const aw = b.armWidth;
    const al = b.armLength;
    const cx = aw / 2 + 5;
    const xAt = (t) => cx - 4 * Math.sin(Math.PI * t) + 5 * t;
    const yAt = (t) => 2 + (al - 2) * t;
    g.fillStyle(pal.accent, 1);
    for (let t = 0; t <= 1.001; t += 0.08) g.fillCircle(xAt(t), yAt(t), aw / 2 + 1.3);
    g.fillStyle(pal.body, 1);
    for (let t = 0; t <= 1.001; t += 0.08) g.fillCircle(xAt(t), yAt(t), aw / 2);
    // fist ending forward (no thumb, per Benjamin)
    const hx = xAt(1) + 1;
    const hy = al + 2;
    const hr2 = aw / 2 + 1.5;
    g.fillStyle(pal.skin, 1);
    g.fillCircle(hx, hy, hr2);
  });

  // --- leg: limb in accent color with a boot.
  // Drawn facing RIGHT: heel flush with the back of the leg, toe box
  // clearly extending forward, toe-cap highlight on the leading edge.
  mk('leg', b.legWidth + 12, b.legLength + 10, (g) => {
    g.fillStyle(pal.accent, 1);
    g.fillRoundedRect(2, 0, b.legWidth, b.legLength, b.legWidth / 2);
    // back-edge shading
    g.fillStyle(pal.eye, 0.25);
    g.fillRoundedRect(2, 0, 3.5, b.legLength, 2);
    // boot with forward toe box
    g.fillStyle(pal.eye, 1);
    g.fillRoundedRect(2, b.legLength - 3, b.legWidth + 9, 9, { tl: 2, bl: 2, tr: 5, br: 5 });
    // toe-cap highlight
    g.fillStyle(0xffffff, 0.28);
    g.fillRoundedRect(b.legWidth + 4, b.legLength - 2, 5, 4, 2);
  });

  // --- antenna orb (hydrogen's "electron")
  if (b.antenna) {
    mk('antenna', 12, 22, (g) => {
      g.lineStyle(2.5, pal.accent, 1);
      g.lineBetween(6, 22, 6, 8);
      g.fillStyle(pal.body, 1);
      g.fillCircle(6, 6, 5.5);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(4.5, 4.5, 2);
    });
  }
}

export class Rig extends Phaser.GameObjects.Container {
  constructor(scene, charDef, paletteIndex) {
    super(scene, 0, 0);
    this.charDef = charDef;
    this.paletteIndex = paletteIndex;

    const art = charDef.art;

    // Sheet mode: 3D-rendered sprite sheets with real per-frame limb
    // animation. Falls through to the modes below if the sheets are missing
    // or art.use3d is off.
    if (use3dSheets(charDef) && scene.textures.exists(sheetKey(art, 'idle'))) {
      this.sheetMode = true;
      this.sheets = art.sheets;
      this.art = art;
      this.sprite = scene.add.sprite(0, 0, sheetKey(art, 'idle'));
      // origin y = the ground line inside the frame, so container y = feet
      this.applyClipLayout(art.sheets.clips.idle);
      // one-time correction for the source render's native orientation
      // (same as sprite mode below) -- separate from this.facing, which
      // tracks which way the fighter is currently moving in-game.
      if ((art.facing ?? 1) === -1) this.sprite.setFlipX(true);
      this.applyPaletteTint(scene, charDef, paletteIndex);
      this.add(this.sprite);
      this.currentClip = null;
      this.animT = Math.random() * 10;
      this.attackSwing = 0;
      this.moveSlot = 'basic';
      this.facing = 1;
      this.baseScale = 1;
      return;
    }

    // Sprite mode: if a real character render is loaded, use it as a single
    // puppet-animated image (bob/lean/lunge/squash). Characters without art
    // keep the code-drawn cutout rig below.
    if (art && scene.textures.exists(art.key)) {
      this.spriteMode = true;
      this.sprite = scene.add.image(0, 0, art.key).setOrigin(0.5, 1);
      // Fit the cutout to art.height. applyPose must reuse this scale — passing
      // 1 used to blow the full-res portrait up to screen-filling size on the
      // character select screen until sheets finished loading.
      const fit = (art.height ?? 160) / Math.max(1, this.sprite.height || 1);
      this._layoutScale = fit;
      this.sprite.setScale(fit);
      if ((art.facing ?? 1) === -1) this.sprite.setFlipX(true);
      this.applyPaletteTint(scene, charDef, paletteIndex);
      this.add(this.sprite);
      this.animT = Math.random() * 10;
      this.attackSwing = 0;
      this.facing = 1;
      this.baseScale = 1;
      return;
    }

    ensureRigTextures(scene, charDef, paletteIndex);

    const b = charDef.body;
    const k = (part) => texKey(charDef.id, paletteIndex, part);

    // Joint layout (origin of container = feet center-ish / body center).
    // Torso center sits at y = -torsoHeight/2 - legLength.
    const torsoCY = -(b.legLength + b.torsoHeight / 2);
    this.torsoCY = torsoCY;

    // Layering per Benjamin: the leading-side (+x) arm renders BEHIND the
    // torso, and the trailing-side (-x) arm renders in the foreground.
    this.backArm = scene.add.image(b.torsoWidth / 2 - 3, torsoCY - b.torsoHeight / 2 + 12, k('arm'))
      .setOrigin(0.5, 0.12);
    this.backLeg = scene.add.image(-b.torsoWidth / 4, -b.legLength + 2, k('leg'))
      .setOrigin(0.5, 0.08);
    this.frontLeg = scene.add.image(b.torsoWidth / 4, -b.legLength + 2, k('leg'))
      .setOrigin(0.5, 0.08);
    this.torso = scene.add.image(0, torsoCY, k('torso')).setOrigin(0.5, 0.5);
    this.symbolText = scene.add.text(0, torsoCY + 2, charDef.symbol, {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '17px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(0.9);
    this.head = scene.add.image(0, torsoCY - b.torsoHeight / 2 - b.headRadius + 4, k('head'))
      .setOrigin(0.5, 0.6);
    this.frontArm = scene.add.image(-b.torsoWidth / 2 + 3, torsoCY - b.torsoHeight / 2 + 12, k('arm'))
      .setOrigin(0.5, 0.12);

    const parts = [this.backArm, this.backLeg, this.frontLeg, this.torso, this.symbolText, this.head, this.frontArm];
    if (b.antenna) {
      this.antenna = scene.add.image(0, this.head.y - b.headRadius - 2, k('antenna')).setOrigin(0.5, 1);
      parts.push(this.antenna);
    }
    this.add(parts);

    this.baseHeadY = this.head.y;
    this.animT = Math.random() * 10; // desync idle bobs between fighters
    this.attackSwing = 0; // 0..1 progress of attack swing, driven by Fighter
    this.facing = 1;      // 1 = right, -1 = left (owner sets this)
    this.baseScale = 1;   // menus can enlarge previews without animate() fighting them
  }

  // Alternate colors on raster art are colorways (engine/colorwayPipeline.js):
  // a hue remap in the fragment shader, with skin tones masked out. The old
  // flat tint toward the palette color washed every cut toward white, so
  // tint is left alone here and stays free for hit flashes.
  applyPaletteTint(scene, charDef, paletteIndex) {
    this.paletteTint = null;
    const pal = charDef.palettes?.[paletteIndex % (charDef.palettes?.length || 1)];
    this.colorway = (paletteIndex > 0 && pal?.colorway) || null;
    this.applyColorwayTo(this.sprite);
  }

  /** Route one of this rig's body sprites through the colorway pipeline. */
  applyColorwayTo(spr) {
    if (!spr || !this.colorway) return;
    applyColorway(spr, this.colorway);
  }

  applyClipLayout(clipDef) {
    // One scale and one foot line per clip, so the head-to-feet body stays
    // art.height and the shoes stay on the fighter origin. The gameplay
    // hurtbox is art.bodyW/bodyH on that same origin. It does not follow
    // the raw cell, and this scale does not change it.
    let layout;
    try {
      layout = clipDisplayLayout(this.sheets, clipDef);
    } catch (err) {
      console.error(`Skipping clip layout for ${this.charDef.id}: ${err.message}`);
      return;
    }
    const displayH = this.art.height ?? 160;
    if (!positiveFinite(displayH)) {
      console.error(`Skipping clip layout for ${this.charDef.id}: invalid art.height ${displayH}`);
      return;
    }
    this.sprite.setOrigin(0.5, layout.footY);
    this._layoutScale = positiveFinite(layout.displayScale) ? layout.displayScale : displayH / layout.visibleH;
    this.sprite.setScale(this._layoutScale);
  }

  // Approx full display height, used for physics body sizing.
  static heightOf(charDef) {
    if (charDef.art?.bodyH) return charDef.art.bodyH;
    const b = charDef.body;
    return b.legLength + b.torsoHeight + b.headRadius * 2 + 2;
  }

  static widthOf(charDef) {
    if (charDef.art?.bodyW) return charDef.art.bodyW;
    return charDef.body.torsoWidth + 14;
  }

  setFlash(color) {
    if (this.spriteMode || this.sheetMode) {
      if (color === null) {
        if (this.paletteTint) this.sprite.setTint(this.paletteTint);
        else this.sprite.clearTint();
      } else this.sprite.setTint(color);
      return;
    }
    const parts = [this.torso, this.head, this.frontArm, this.backArm, this.frontLeg, this.backLeg];
    for (const p of parts) {
      if (color === null) p.clearTint();
      else p.setTint(color);
    }
  }

  /**
   * Procedural animation. state: 'idle' | 'walk' | 'jump' | 'fall' |
   * 'attack' | 'hurt' | 'ko'. speedFactor 0..1 scales the walk cycle.
   */
  // A shipped strip replaces the idle telegraph for this move. Effects stay
  // on the scene, above this container, so the body clip never covers them.
  showMoveClip(state) {
    const key = this.moveKey;
    const clip = key ? moveClipFor(this.charDef?.id, key) : null;
    const tex = clip ? moveTextureKey(this.charDef.id, key) : null;
    const posing = clip && tex && this.scene.textures.exists(tex)
      && (state === 'attack' || state === 'charging' || state === 'defending');
    if (!posing) {
      this._posingClips = false;
      this.clipA?.setVisible(false);
      this.clipB?.setVisible(false);
      this.sprite?.setVisible?.(true);
      return false;
    }
    const pose = clipPose(this.poseT ?? this.attackSwing ?? 0, clip.frames);
    const displayH = this.art?.height ?? this.charDef?.art?.height ?? 160;
    // visibleH is the head-to-feet body in the cell, same convention as sheets.
    const layout = positiveFinite(clip.displayScale)
      ? clip.displayScale
      : (positiveFinite(displayH) && positiveFinite(clip.visibleH) ? displayH / clip.visibleH : 1);
    const ensure = (slot) => {
      if (this[slot]) return this[slot];
      const spr = this.scene.add.sprite(0, 0, tex, 0);
      if ((this.art?.facing ?? this.charDef?.art?.facing ?? 1) === -1) spr.setFlipX(true);
      this.applyColorwayTo(spr);
      this.add(spr);
      this[slot] = spr;
      return spr;
    };
    // Frame choice stays on the strip. Position and scale are the pose layer,
    // applied afterwards, so a still strip (n >= 4) still winds up and lunges.
    const paint = (spr, frame, alpha) => {
      spr.setVisible(alpha > 0.001);
      spr.setAlpha(alpha);
      spr.setTexture(tex, frame);
      spr.setOrigin(0.5, clip.footY);
    };
    if (this.sprite) this.sprite.setVisible(false);
    this._clipLayout = layout;
    this._posingClips = true;
    const blend = pose.mode === 'tween' ? pose.blend : 0;
    paint(ensure('clipA'), pose.frame, 1 - blend);
    paint(ensure('clipB'), pose.frameB, blend);
    return true;
  }

  blendToIdle(amount) {
    if (!this.sprite || !this.sheetMode) return;
    if (!(amount > 0.02) && !this.fadeSprite) return;
    if (!this.fadeSprite) {
      const key = this.sprite.texture?.key;
      if (!key || !this.scene?.add?.sprite) return;
      this.fadeSprite = this.scene.add.sprite(0, 0, key);
      this.applyColorwayTo(this.fadeSprite);
      this.add(this.fadeSprite);
      this.fadeSprite.setVisible(false);
    }
    if (!(amount > 0.02) || !this.sheets?.clips?.idle) {
      this.fadeSprite.setVisible(false);
      this.sprite.setAlpha(1);
      return;
    }
    const idle = this.sheets.clips.idle;
    this.fadeSprite.setTexture(sheetKey(this.art, 'idle'), 0);
    this.fadeSprite.setOrigin(0.5, idle.footY ?? 1);
    this.fadeSprite.setVisible(true).setAlpha(amount);
    this.sprite.setAlpha(1 - amount * 0.75);
  }

  rememberMask(clip, frame) {
    this.maskClip = clip || 'idle';
    this.maskFrame = frame | 0;
  }

  applyPose(dt, state, layout) {
    if (state !== 'attack' && state !== 'defending') this.blendToIdle(0);
    const fd = this.frameData;
    const frame = this.attackFrame || 0;
    const phase = fd ? attackPhase(fd, frame) : 'idle';
    let recT = 1;
    if (fd && phase === 'recovery') {
      const recStart = fd.startup + fd.active;
      const recLen = Math.max(1, fd.recovery || 1);
      recT = Math.min(1, Math.max(0, (frame - recStart) / recLen));
    }
    // An authored move sheet already has its foot travel. One origin per
    // clip, and no extra lunge or squash on top of it.
    if (this._authoredSheet) {
      this._pose = { rot: 0, sx: 1, sy: 1, x: 0, y: 0 };
    } else {
      const target = poseTarget(state, {
        facing: this.facing || 1,
        phase,
        recT,
        t: this.animT || 0,
        step: (this.animT || 0) * 10,
        units: this.hurtUnits || 0,
        hurtSign: this.hurtSign || 1,
        tripped: !!this.tripped,
        landing: this.landing > 0,
        vy: this.vy || 0,
      });
      // Snap to the target. The old spring moved ~1px per frame, so a 3-frame
      // wind-up never left neutral and the lunge was invisible.
      this._pose = {
        rot: target.rot || 0,
        sx: target.sx ?? 1,
        sy: target.sy ?? 1,
        x: target.x || 0,
        y: target.y || 0,
      };
    }
    const base = layout || this._layoutScale || 1;
    // Sheet art only. The flat cutout is a different drawing and stays put.
    const bias = (this.sheetMode || this._posingClips) ? bodyCenterBias(this.charDef?.id) : 0;
    const paint = (spr, def) => {
      if (!spr?.setScale) return;
      spr.x = this._pose.x + bias;
      spr.y = this._pose.y;
      spr.rotation = this._pose.rot;
      spr.setScale(base * this._pose.sx, base * this._pose.sy);
      // The clip's own sheet facing wins. Idle and walk keep art.facing.
      // Re-apply it every pose so a frame change cannot leave her backward.
      const native = def?.sheetFacing ?? this.art?.facing ?? this.charDef?.art?.facing ?? 1;
      spr.setFlipX(native === -1);
    };
    if (this._posingClips) {
      paint(this.clipA, null);
      paint(this.clipB, null);
    } else {
      paint(this.sprite, this.sheets?.clips?.[this.currentClip]);
      if (this.fadeSprite?.visible) {
        const idle = this.sheets?.clips?.idle;
        const idleScale = idle?.displayScale > 0 ? idle.displayScale : base;
        this.fadeSprite.x = bias;
        this.fadeSprite.y = 0;
        this.fadeSprite.rotation = 0;
        this.fadeSprite.setScale(idleScale, idleScale);
        const native = idle?.sheetFacing ?? this.art?.facing ?? this.charDef?.art?.facing ?? 1;
        this.fadeSprite.setFlipX(native === -1);
      }
    }
    if (state === 'hurt' && (this.hurtUnits || 0) > FEEL.tumbleAt) {
      this._spin = (this._spin || 0) + (dt || 0.016) * 9 * (this.hurtSign || 1);
      this.rotation = this._spin;
    } else {
      this.rotation = 0;
    }
    // Facing lives on the container. Pose scale stays on the sprite so the
    // next frame's layout scale cannot multiply the lunge back in.
    this.commitScale();
  }

  commitScale(squashX = 1, squashY = 1) {
    const base = this.baseScale || 1;
    if (this.puddle) {
      const wob = 1 + Math.sin((this.animT || 0) * 7) * 0.06;
      this.setScale((this.facing || 1) * base * 1.5 * wob, base * 0.24);
      return;
    }
    this.setScale((this.facing || 1) * base * squashX, base * squashY);
  }

  animate(dt, state, speedFactor = 1) {
    if (this.holdFrame) return;
    const pace = this.animPace > 0 ? this.animPace : 1;
    this.animT += dt * pace;
    const t = this.animT;
    this._authoredSheet = false;
    this.sheetClip = null;
    this.sheetFrame = 0;

    if (this.showMoveClip(state)) {
      this.rememberMask('idle', 0);
      this.applyPose(dt, state, this._clipLayout || 1);
      return;
    }

    if (this.sheetMode) {
      const authored = authoredClipName(this.charDef?.id, state, this.moveKey);
      const meta = authored ? sheetMeta(this.charDef.id, authored) : null;
      // A charge or guard can play a range of another clip. The shown clip
      // keeps that clip's cell, sole, and anchors.
      const shown = meta?.plays && this.sheets.clips[meta.plays] ? meta.plays : authored;
      if (shown && this.sheets.clips[shown] && meta) {
        const info = this.sheets.clips[shown];
        const i = sheetFrameIndex(meta, {
          state,
          fd: this.frameData,
          attackFrame: this.attackFrame || 0,
          comboStep: this.comboStep || 0,
          animT: this.animT,
          held: this.defenseT,
        });
        this.sprite.anims.stop();
        this.sprite.setTexture(sheetKey(this.art, shown), i);
        if (this.currentClip !== shown) this.applyClipLayout(info);
        this.currentClip = shown;
        this.sheetClip = shown;
        this.sheetFrame = i;
        this._authoredSheet = true;
        const blend = (this.frameData && state === 'attack')
          ? (meta.blendIdle
            ? followThroughBlend(this.frameData, this.attackFrame || 0)
            : idleBlend(this.frameData, this.attackFrame || 0))
          : (state === 'defending' && meta.blendIdle ? guardIdleBlend(this.poseT) : 0);
        this.blendToIdle(blend);
        this.rememberMask(shown, i);
        this.sprite.anims.timeScale = this.animPace > 0 ? this.animPace : 1;
        this.applyPose(dt, state, this._layoutScale || 1);
        return;
      }
      // 'attack' covers both move slots; pick the clip the move actually is.
      // Charge, defense, and specials with no sheet of their own play the
      // attack clip under the effect layer.
      const wanted = state === 'attack'
        ? (this.moveSlot === 'special' ? 'special' : 'attack')
        : state;
      let def = this.sheets.clips[wanted] ? wanted : 'idle';
      const moveState = state === 'attack' || state === 'charging' || state === 'defending';
      // An authored attack sheet belongs to that one move. Other slots with
      // no sheet of their own stay on idle instead of borrowing it.
      if (def === 'idle' && moveState && this.sheets.clips.attack && !sheetMeta(this.charDef?.id, 'attack')) {
        def = 'attack';
      }
      const info = this.sheets.clips[def];

      let frameIndex = this.sprite?.anims?.currentFrame?.index ?? 0;
      if ((def === 'attack' || def === 'special') && moveState) {
        // Wind-up, strike, hold the contact pose, then follow through.
        // Charge holds the load frame. Defense holds the contact frame.
        let i;
        if (state === 'charging') i = Math.min(1, info.count - 1);
        else if (state === 'defending') i = Math.min(3, info.count - 1);
        else if (this.frameData && state === 'attack') i = stripIndex(info.count, this.frameData, this.attackFrame || 0);
        else {
          const progress = state === 'attack' ? (this.attackSwing ?? 0) : (this.poseT ?? this.attackSwing ?? 0);
          i = Phaser.Math.Clamp(Math.floor(progress * info.count), 0, info.count - 1);
        }
        this.sprite.anims.stop();
        this.sprite.setTexture(sheetKey(this.art, def), i);
        if (this.currentClip !== def) this.applyClipLayout(info);
        this.currentClip = def;
        frameIndex = i;
        const blend = (this.frameData && state === 'attack') ? idleBlend(this.frameData, this.attackFrame || 0) : 0;
        this.blendToIdle(blend);
      } else if (this.currentClip !== def) {
        this.currentClip = def;
        this.applyClipLayout(info);
        this.sprite.anims.play(sheetKey(this.art, def), true);
        frameIndex = this.sprite?.anims?.currentFrame?.index ?? 0;
      }
      this.rememberMask(def, frameIndex);

      // Feet follow ground speed. The old 0.55 floor held every slow walk
      // on the same long pose; a very slow walk is allowed to be slow.
      const pace = this.animPace > 0 ? this.animPace : 1;
      this.sprite.anims.timeScale = (def === 'walk'
        ? Phaser.Math.Clamp(speedFactor, 0.2, 1.8)
        : 1) * pace;

      // Layout scale is the body's fitted size. Never read it back from
      // scaleX: applyPose writes the pose into that value.
      if (moveState && sheetMeta(this.charDef?.id, def)) this._authoredSheet = true;
      this.applyPose(dt, state, this._layoutScale || 1);
      return;
    }

    this.rememberMask('idle', 0);
    if (this.spriteMode) {
      if (state === 'ko') {
        this.rotation += dt * 14;
        this.setScale(this.facing * this.baseScale, this.baseScale);
        return;
      }
      this.applyPose(dt, state, this._layoutScale || 1);
      return;
    }

    const b = this.charDef.body;

    // reset squash each frame; states below may override
    let squashX = 1;
    let squashY = 1;

    switch (state) {
      case 'walk': {
        const w = Math.sin(t * 13 * Math.max(0.4, speedFactor));
        this.frontLeg.rotation = w * 0.6;
        this.backLeg.rotation = -w * 0.6;
        this.frontArm.rotation = -w * 0.5 + this.attackSwing * -2.1;
        this.backArm.rotation = w * 0.5;
        this.head.y = this.baseHeadY + Math.abs(Math.cos(t * 13)) * -1.5;
        this.torso.rotation = w * 0.03;
        break;
      }
      case 'jump': {
        this.frontLeg.rotation = -0.45;
        this.backLeg.rotation = 0.35;
        this.frontArm.rotation = -2.4 + this.attackSwing * -0.5;
        this.backArm.rotation = 2.4;
        squashY = 1.06;
        squashX = 0.95;
        break;
      }
      case 'fall': {
        this.frontLeg.rotation = 0.25;
        this.backLeg.rotation = -0.2;
        this.frontArm.rotation = -0.9 + this.attackSwing * -1.6;
        this.backArm.rotation = 0.9;
        squashY = 0.97;
        break;
      }
      case 'attack': {
        // attackSwing goes 0 -> 1 over the move duration (set by Fighter)
        const s = Math.sin(this.attackSwing * Math.PI);
        this.frontArm.rotation = -0.4 - s * 2.2;
        this.backArm.rotation = 0.3 + s * 0.6;
        this.torso.rotation = -s * 0.18;
        this.frontLeg.rotation = s * 0.2;
        this.backLeg.rotation = -s * 0.25;
        break;
      }
      case 'charging': {
        const bob = Math.sin(t * 16);
        this.frontArm.rotation = -0.4 + bob * 0.15;
        this.backArm.rotation = 0.4 - bob * 0.15;
        this.head.y = this.baseHeadY + bob * 2;
        break;
      }
      case 'defending': {
        this.frontArm.rotation = -1.4;
        this.backArm.rotation = 1.4;
        this.torso.rotation = 0.08;
        squashX = 1.06;
        squashY = 0.9;
        break;
      }
      case 'hurt': {
        this.frontArm.rotation = 1.2;
        this.backArm.rotation = -1.2;
        this.frontLeg.rotation = 0.5;
        this.backLeg.rotation = -0.5;
        this.torso.rotation = 0.15;
        squashX = 1.08;
        squashY = 0.92;
        break;
      }
      case 'ko': {
        this.rotation += dt * 14; // whole-body spin
        return; // skip idle-restore below
      }
      case 'idle':
      default: {
        const bob = Math.sin(t * 3.2);
        this.frontLeg.rotation = 0;
        this.backLeg.rotation = 0;
        this.frontArm.rotation = bob * 0.06 + this.attackSwing * -2.1;
        this.backArm.rotation = -bob * 0.06;
        this.torso.rotation = 0;
        this.head.y = this.baseHeadY + bob * 1.6;
        squashY = 1 + bob * 0.012;
        break;
      }
    }
    this.rotation = 0;
    this.commitScale(squashX, squashY);
    // keep the chest symbol readable when the rig is mirrored
    this.symbolText.scaleX = this.facing < 0 ? -1 : 1;
    if (this.antenna) {
      this.antenna.rotation = Math.sin(t * 5) * 0.25;
    }
  }
}
