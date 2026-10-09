import * as Phaser from 'phaser';
import { sheetKey, use3dSheets, clipDisplayLayout, positiveFinite } from '../scenes/BootScene.js';
import { clipPose, moveClipFor, moveTextureKey } from './moveClip.js';
import { stripIndex, idleBlend, attackPhase, poseTarget, spring, FEEL } from './feel.js';

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
      this.sprite.setScale((art.height ?? 160) / this.sprite.height);
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

  // Palette variants on raster art: tint toward the palette color. (True
  // palette swaps would need per-color remapping — revisit if tints look bad.)
  applyPaletteTint(scene, charDef, paletteIndex) {
    if (paletteIndex <= 0) return;
    const pal = charDef.palettes[paletteIndex % charDef.palettes.length];
    const c = Phaser.Display.Color.ValueToColor(pal.body);
    const mix = Phaser.Display.Color.GetColor(
      Math.round(c.red + (255 - c.red) * 0.55),
      Math.round(c.green + (255 - c.green) * 0.55),
      Math.round(c.blue + (255 - c.blue) * 0.55),
    );
    this.sprite.setTint(mix);
    this.paletteTint = mix;
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
      this.add(spr);
      this[slot] = spr;
      return spr;
    };
    const paint = (spr, frame, alpha) => {
      spr.setVisible(alpha > 0.001);
      spr.setAlpha(alpha);
      spr.setTexture(tex, frame);
      spr.setOrigin(0.5, clip.footY);
      spr.setScale(layout * pose.scaleX, layout * pose.scaleY);
      spr.x = pose.lunge;
      spr.y = pose.y;
    };
    if (this.sprite) this.sprite.setVisible(false);
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

  applyPose(dt, state, layout) {
    if (state !== 'attack') this.blendToIdle(0);
    const phase = this.frameData ? attackPhase(this.frameData, this.attackFrame || 0) : 'idle';
    const target = poseTarget(state, {
      facing: this.facing || 1,
      phase,
      t: this.animT || 0,
      step: (this.animT || 0) * 10,
      units: this.hurtUnits || 0,
      hurtSign: this.hurtSign || 1,
      landing: this.landing > 0,
    });
    this._pose ??= { rot: 0, sx: 1, sy: 1, x: 0, y: 0 };
    this._poseV ??= { rot: 0, sx: 0, sy: 0, x: 0, y: 0 };
    for (const k of ['rot', 'sx', 'sy', 'x', 'y']) {
      const stepped = spring(this._pose[k], this._poseV[k], target[k] ?? 0, dt || 0.016);
      this._pose[k] = stepped.cur;
      this._poseV[k] = stepped.vel;
    }
    this.sprite.x = this._pose.x;
    this.sprite.y = this._pose.y;
    this.sprite.rotation = this._pose.rot;
    this.sprite.setScale(layout * this._pose.sx, layout * this._pose.sy);
    if (this.fadeSprite?.visible) {
      this.fadeSprite.x = this.sprite.x;
      this.fadeSprite.y = this.sprite.y;
      this.fadeSprite.setScale(layout * this._pose.sx, layout * this._pose.sy);
    }
    if (state === 'hurt' && (this.hurtUnits || 0) > FEEL.tumbleAt) {
      this._spin = (this._spin || 0) + (dt || 0.016) * 9 * (this.hurtSign || 1);
      this.rotation = this._spin;
    } else {
      this.rotation = 0;
    }
    this.setScale((this.facing || 1) * (this.baseScale || 1), this.baseScale || 1);
  }

  animate(dt, state, speedFactor = 1) {
    this.animT += dt;
    const t = this.animT;

    if (this.showMoveClip(state)) {
      this.rotation = 0;
      this.setScale(this.facing * this.baseScale, this.baseScale);
      return;
    }

    if (this.sheetMode) {
      // 'attack' covers both move slots; pick the clip the move actually is.
      // Charge, defense, and specials with no sheet of their own play the
      // attack clip under the effect layer.
      const wanted = state === 'attack'
        ? (this.moveSlot === 'special' ? 'special' : 'attack')
        : state;
      let def = this.sheets.clips[wanted] ? wanted : 'idle';
      const moveState = state === 'attack' || state === 'charging' || state === 'defending';
      if (def === 'idle' && moveState && this.sheets.clips.attack) def = 'attack';
      const info = this.sheets.clips[def];

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
        const blend = (this.frameData && state === 'attack') ? idleBlend(this.frameData, this.attackFrame || 0) : 0;
        this.blendToIdle(blend);
      } else if (this.currentClip !== def) {
        this.currentClip = def;
        this.applyClipLayout(info);
        this.sprite.anims.play(sheetKey(this.art, def), true);
      }

      // Feet follow ground speed. The old 0.55 floor held every slow walk
      // on the same long pose; a very slow walk is allowed to be slow.
      this.sprite.anims.timeScale = def === 'walk'
        ? Phaser.Math.Clamp(speedFactor, 0.2, 1.8)
        : 1;

      // the KO clip already tumbles him, so don't spin the container too
      this.rotation = 0;
      this.setScale(this.facing * this.baseScale, this.baseScale);
      // No attack/charge/defend sheet: stay on the idle clip. A small
      // telegraph marks the state; the move itself is the effects layer.
      // Do not scrub idle frames as if they were a swing.
      const layout = this._layoutScale ?? (Math.abs(this.sprite.scaleX) || 1);
      this.applyPose(dt, state, layout);
      return;
    }

    if (this.spriteMode) {
      let sx = 1;
      let sy = 1;
      this.sprite.x = 0;
      switch (state) {
        case 'walk':
          this.sprite.y = -Math.abs(Math.sin(t * 10)) * 4;
          this.sprite.rotation = Math.sin(t * 10) * 0.035;
          break;
        case 'jump':
          this.sprite.y = 0; this.sprite.rotation = -0.06;
          sy = 1.05; sx = 0.96;
          break;
        case 'fall':
          this.sprite.y = 0; this.sprite.rotation = 0.045;
          sy = 0.97;
          break;
        case 'attack': {
          const s = Math.sin(this.attackSwing * Math.PI);
          this.sprite.y = 0;
          this.sprite.rotation = -s * 0.17;
          this.sprite.x = s * 11; // forward lunge of the cutout; not a drawn attack pose
          sx = 1 + s * 0.05;
          break;
        }
        case 'charging':
          this.sprite.y = Math.sin(t * 16) * 3;
          this.sprite.rotation = Math.sin(t * 10) * 0.05;
          break;
        case 'defending':
          this.sprite.y = 2;
          this.sprite.rotation = 0;
          sx = 0.94;
          sy = 0.88;
          break;
        case 'hurt':
          this.sprite.y = 0; this.sprite.rotation = 0.22;
          sx = 1.06; sy = 0.94;
          break;
        case 'ko':
          this.rotation += dt * 14;
          this.setScale(this.facing * this.baseScale, this.baseScale);
          return;
        case 'idle':
        default: {
          const bob = Math.sin(t * 3.2);
          this.sprite.y = bob * 2.2;
          this.sprite.rotation = bob * 0.015;
          sy = 1 + bob * 0.008;
          break;
        }
      }
      this.rotation = 0;
      this.setScale(this.facing * this.baseScale * sx, this.baseScale * sy);
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
    this.setScale(this.facing * this.baseScale * squashX, this.baseScale * squashY);
    // keep the chest symbol readable when the rig is mirrored
    this.symbolText.scaleX = this.facing < 0 ? -1 : 1;
    if (this.antenna) {
      this.antenna.rotation = Math.sin(t * 5) * 0.25;
    }
  }
}
