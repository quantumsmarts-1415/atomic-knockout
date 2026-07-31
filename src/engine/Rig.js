import * as Phaser from 'phaser';
import { sheetKey, use3dSheets } from '../scenes/BootScene.js';

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
      this.sprite.setOrigin(0.5, art.sheets.footY);
      this.sprite.setScale((art.height ?? 160) / art.sheets.visibleH);
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
  animate(dt, state, speedFactor = 1) {
    this.animT += dt;
    const t = this.animT;

    if (this.sheetMode) {
      // 'attack' covers both move slots; pick the clip the move actually is
      const clip = state === 'attack'
        ? (this.moveSlot === 'special' ? 'special' : 'attack')
        : state;
      const def = this.sheets.clips[clip] ? clip : 'idle';
      const info = this.sheets.clips[def];

      if (def === 'attack' || def === 'special') {
        // Scrub these by the move's own progress rather than playing them at
        // a fixed frame rate, so the swing always lines up with move.duration
        // no matter how the move is retuned in characters.js.
        const i = Phaser.Math.Clamp(
          Math.floor(this.attackSwing * info.count), 0, info.count - 1,
        );
        this.sprite.anims.stop();
        this.sprite.setTexture(sheetKey(this.art, def), i);
        this.currentClip = def;
      } else if (this.currentClip !== def) {
        this.currentClip = def;
        this.sprite.anims.play(sheetKey(this.art, def), true);
      }

      // the run cycle speeds up and slows down with actual ground speed
      this.sprite.anims.timeScale = def === 'walk'
        ? Phaser.Math.Clamp(speedFactor, 0.55, 1.6)
        : 1;

      // the KO clip already tumbles him, so don't spin the container too
      this.rotation = 0;
      this.setScale(this.facing * this.baseScale, this.baseScale);
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
          this.sprite.x = s * 11; // forward lunge
          sx = 1 + s * 0.05;
          break;
        }
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
