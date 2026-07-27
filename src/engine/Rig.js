import * as Phaser from 'phaser';

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

  // --- torso: rounded body with belt + darker outline
  mk('torso', b.torsoWidth + 8, b.torsoHeight + 8, (g) => {
    g.fillStyle(pal.accent, 1);
    g.fillRoundedRect(0, 0, b.torsoWidth + 8, b.torsoHeight + 8, 14);
    g.fillStyle(pal.body, 1);
    g.fillRoundedRect(3, 3, b.torsoWidth + 2, b.torsoHeight + 2, 12);
    // belt
    g.fillStyle(pal.accent, 1);
    g.fillRect(3, b.torsoHeight - 8, b.torsoWidth + 2, 6);
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

  // --- arm: rounded limb in body color with skin hand
  mk('arm', b.armWidth + 4, b.armLength + b.armWidth + 4, (g) => {
    g.fillStyle(pal.accent, 1);
    g.fillRoundedRect(0, 0, b.armWidth + 4, b.armLength + 4, (b.armWidth + 4) / 2);
    g.fillStyle(pal.body, 1);
    g.fillRoundedRect(1.5, 1.5, b.armWidth + 1, b.armLength + 1, (b.armWidth + 1) / 2);
    g.fillStyle(pal.skin, 1);
    g.fillCircle((b.armWidth + 4) / 2, b.armLength + 1, b.armWidth / 2 + 1.5);
  });

  // --- leg: limb in accent color with rounded foot
  mk('leg', b.legWidth + 6, b.legLength + 10, (g) => {
    g.fillStyle(pal.accent, 1);
    g.fillRoundedRect(1, 0, b.legWidth, b.legLength, b.legWidth / 2);
    g.fillStyle(pal.eye, 1); // dark shoe
    g.fillRoundedRect(0, b.legLength - 4, b.legWidth + 6, 10, 5);
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
    ensureRigTextures(scene, charDef, paletteIndex);

    const b = charDef.body;
    const k = (part) => texKey(charDef.id, paletteIndex, part);

    // Joint layout (origin of container = feet center-ish / body center).
    // Torso center sits at y = -torsoHeight/2 - legLength.
    const torsoCY = -(b.legLength + b.torsoHeight / 2);
    this.torsoCY = torsoCY;

    this.backArm = scene.add.image(-b.torsoWidth / 2 + 3, torsoCY - b.torsoHeight / 2 + 12, k('arm'))
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
    this.frontArm = scene.add.image(b.torsoWidth / 2 - 3, torsoCY - b.torsoHeight / 2 + 12, k('arm'))
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

  // Approx full display height, used for physics body sizing.
  static heightOf(charDef) {
    const b = charDef.body;
    return b.legLength + b.torsoHeight + b.headRadius * 2 + 2;
  }

  static widthOf(charDef) {
    return charDef.body.torsoWidth + 14;
  }

  setFlash(color) {
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
    if (this.antenna) {
      this.antenna.rotation = Math.sin(t * 5) * 0.25;
    }
  }
}
