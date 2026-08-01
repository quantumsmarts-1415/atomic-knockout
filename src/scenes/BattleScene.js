import * as Phaser from 'phaser';
import Fighter from '../engine/Fighter.js';
import { CHARACTERS } from '../data/characters.js';
import { play as sfx } from '../engine/sfx.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { phoneNet } from '../net/PhoneNet.js';
import { computeBotInput } from '../engine/BotAI.js';

const GRAVITY = 1500;
const BLAST_MARGIN = 140; // how far past the screen edge you must fly to die

// Slot numbering, decided in PlayerJoinScene: 0/1 = keyboard, 2-5 = a phone
// (PhoneNet's own connection slot), 100+seatIndex = a bot.
const BOT_SLOT_BASE = 100;

// ---------------------------------------------------------------------------
// BattleScene — the fight itself. Reads match setup (players, characters,
// palettes) from scene data so menus can configure it; falls back to a
// default Hydra vs Helen match when launched directly.
// ---------------------------------------------------------------------------
export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  init(data) {
    this.setup = data?.players?.length
      ? data
      : {
          players: [
            { charId: 'hydra', palette: 0 },
            { charId: 'helen', palette: 0 },
          ],
          stocks: 3,
        };
  }

  create() {
    this.physics.world.gravity.y = GRAVITY;
    this.matchOver = false;

    this.drawBackground();
    this.buildStage();
    this.spawnFighters();
    this.buildHud();
    this.bindKeyboard();

    this.projectiles = [];

    // pause menu hook (M4): ESC or P
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
  }

  // ------------------------------------------------------------------ stage
  drawBackground() {
    // Layered sky: night-lab gradient, distant "molecule" bubbles, soft hills
    const g = this.add.graphics();
    const top = Phaser.Display.Color.ValueToColor(0x101b33);
    const bottom = Phaser.Display.Color.ValueToColor(0x2a4a6e);
    for (let i = 0; i < 24; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 24, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (H / 24) * i, W, H / 24 + 1);
    }
    // faint element-bubble motif in the sky
    const rnd = new Phaser.Math.RandomDataGenerator(['ptg']);
    for (let i = 0; i < 26; i++) {
      const x = rnd.between(0, W);
      const y = rnd.between(0, H * 0.7);
      const r = rnd.between(6, 26);
      g.fillStyle(0x7fd4ff, rnd.realInRange(0.03, 0.09));
      g.fillCircle(x, y, r);
      g.lineStyle(1.5, 0x7fd4ff, rnd.realInRange(0.05, 0.12));
      g.strokeCircle(x, y, r);
    }
    // distant hills
    g.fillStyle(0x18294a, 1);
    g.fillEllipse(W * 0.25, H * 0.98, W * 0.9, H * 0.45);
    g.fillStyle(0x14223d, 1);
    g.fillEllipse(W * 0.85, H * 1.02, W * 0.95, H * 0.5);
  }

  buildStage() {
    // solids collide from every side; platforms are one-way (drop onto only)
    this.solids = this.physics.add.staticGroup();
    this.platforms = this.physics.add.staticGroup();

    // main floating island: x from 190 to 1090, top at y=560
    const mainW = 900;
    const mainX = W / 2;
    const mainTopY = 560;
    const island = this.add.graphics();
    // dirt body
    island.fillStyle(0x3d2f4e, 1);
    island.fillRoundedRect(mainX - mainW / 2, mainTopY, mainW, 90, { tl: 8, tr: 8, bl: 60, br: 60 });
    // grass/lab-floor top
    island.fillStyle(0x53e0a8, 1);
    island.fillRoundedRect(mainX - mainW / 2, mainTopY, mainW, 22, 8);
    island.fillStyle(0x3bb886, 1);
    island.fillRect(mainX - mainW / 2, mainTopY + 16, mainW, 6);

    // full-thickness solid body so fast falls can't tunnel through the ground
    const main = this.add.zone(mainX, mainTopY + 45, mainW, 90);
    this.physics.add.existing(main, true);
    this.solids.add(main);

    // one floating platform
    const platW = 260;
    const platX = W / 2;
    const platY = 390;
    const plat = this.add.graphics();
    plat.fillStyle(0x6a55a0, 1);
    plat.fillRoundedRect(platX - platW / 2, platY, platW, 18, 9);
    plat.fillStyle(0x8f78cc, 1);
    plat.fillRoundedRect(platX - platW / 2, platY, platW, 8, 4);

    const platform = this.add.zone(platX, platY + 9, platW, 18);
    this.physics.add.existing(platform, true);
    this.platforms.add(platform);
  }

  // --------------------------------------------------------------- fighters
  spawnFighters() {
    const spawnXs = [W / 2 - 260, W / 2 + 260, W / 2 - 100, W / 2 + 100, W / 2 - 380, W / 2 + 380];
    this.fighters = this.setup.players.map((p, i) => {
      const def = CHARACTERS[p.charId];
      const f = new Fighter(this, spawnXs[i % spawnXs.length], 480, def, p.palette ?? 0, i);
      // controlSlot: 0/1 = keyboard P1/P2, 2-5 = a phone's PhoneNet slot.
      // Carried from CharacterSelect rather than reusing the array index `i`,
      // since a dropped phone can leave slots non-contiguous (e.g. only P4
      // still connected while P3 left) and input must still reach the right
      // fighter.
      f.controlSlot = p.slot ?? i;
      f.isBot = f.controlSlot >= BOT_SLOT_BASE;
      f.stocks = this.setup.stocks ?? 3;
      f.facing = i % 2 === 0 ? 1 : -1;
      return f;
    });
    for (const f of this.fighters) {
      this.physics.add.collider(f, this.solids);
      this.physics.add.collider(f, this.platforms, undefined, (fighter, plat) => {
        // one-way platforms: collide only when the fighter's feet were at or
        // above the platform top on the PREVIOUS frame — velocity-independent,
        // so a fast fall can never tunnel through
        const b = fighter.body;
        const prevBottom = b.prev.y + b.height;
        return b.velocity.y >= 0 && prevBottom <= plat.body.top + 2;
      });
    }
  }

  bindKeyboard() {
    const kb = this.input.keyboard;
    this.keymaps = [
      // P1: WASD + F (attack) / G (special)
      {
        left: kb.addKey('A'), right: kb.addKey('D'), jump: kb.addKey('W'),
        attack: kb.addKey('F'), special: kb.addKey('G'),
      },
      // P2: arrows + K (attack) / L (special)
      {
        left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        jump: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        attack: kb.addKey('K'), special: kb.addKey('L'),
      },
    ];
  }

  // ------------------------------------------------------------------- HUD
  buildHud() {
    const n = this.fighters.length;
    // 2 players keeps the original fixed 240px-from-edge layout; 3+ spread
    // evenly across a narrower band and shrink so panels don't overlap.
    const margin = n <= 2 ? 240 : 120;
    const panelW = n <= 2 ? 260 : Math.max(150, (W - margin * 2) / (n - 1) - 20);
    const scale = panelW / 260;
    this.hud = this.fighters.map((f, i) => {
      const x = n === 1 ? W / 2 : margin + (i * (W - margin * 2)) / (n - 1);
      const pal = f.charDef.palettes[f.paletteIndex];
      // HUD chrome uses the glass-panel look; the border keeps the player's
      // own palette color (thin, not bold) since that's identity, not decor.
      const panel = this.add.graphics();
      panel.fillStyle(0xffffff, 0.03);
      panel.fillRoundedRect(x - panelW / 2, H - 96, panelW, 78, 16);
      panel.lineStyle(1.5, pal.body, 0.85);
      panel.strokeRoundedRect(x - panelW / 2, H - 96, panelW, 78, 16);

      const name = this.add.text(x - panelW / 2 + 18, H - 88, `${f.charDef.name} · ${f.charDef.symbol}${f.isBot ? ' (CPU)' : ''}`, {
        fontFamily: 'Arial Black, sans-serif', fontSize: `${Math.round(16 * scale)}px`, color: '#d8ecff',
      });
      const percent = this.add.text(x + panelW / 2 - 70 * scale, H - 82, '0%', {
        fontFamily: 'Arial Black, sans-serif', fontSize: `${Math.round(30 * scale)}px`, color: '#eaf9ff',
      }).setOrigin(0.5, 0);
      const stocks = this.add.text(x - panelW / 2 + 18, H - 52, '', {
        fontFamily: 'Arial, sans-serif', fontSize: `${Math.round(20 * scale)}px`, color: '#4ad6ff',
      });
      return { percent, stocks, name };
    });
  }

  updateHud() {
    this.fighters.forEach((f, i) => {
      const h = this.hud[i];
      h.percent.setText(`${Math.round(f.percent)}%`);
      // percent text heats up as damage rises
      const p = Phaser.Math.Clamp(f.percent / 150, 0, 1);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xffffff),
        Phaser.Display.Color.ValueToColor(0xff3b30),
        1, p,
      );
      h.percent.setColor(Phaser.Display.Color.RGBToString(col.r, col.g, col.b));
      h.stocks.setText('●'.repeat(Math.max(0, f.stocks)) + '○'.repeat(Math.max(0, (this.setup.stocks ?? 3) - f.stocks)));
    });
  }

  // ------------------------------------------------------------ combat glue
  spawnProjectile(owner, move) {
    const r = move.projectileRadius;
    const pal = owner.charDef.palettes[owner.paletteIndex];
    const orb = this.add.graphics();
    orb.fillStyle(pal.body, 0.5);
    orb.fillCircle(0, 0, r);
    orb.lineStyle(2.5, 0xffffff, 0.8);
    orb.strokeCircle(0, 0, r);
    orb.fillStyle(0xffffff, 0.55);
    orb.fillCircle(-r * 0.3, -r * 0.3, r * 0.35);
    orb.x = owner.x + owner.facing * (owner.bodyW / 2 + r + 4);
    orb.y = owner.y - owner.bodyH * 0.65;

    this.projectiles.push({
      gfx: orb, owner, move,
      vx: owner.facing * move.projectileSpeed,
      dieAt: this.time.now + move.projectileLife,
      landed: new Set(),
      radius: r,
    });
  }

  resolveBurst(owner, move) {
    // ring VFX
    const pal = owner.charDef.palettes[owner.paletteIndex];
    const cx = owner.x;
    const cy = owner.y - owner.bodyH / 2;
    const ring = this.add.graphics();
    ring.lineStyle(6, 0xffd166, 1);
    ring.strokeCircle(0, 0, 20);
    ring.setPosition(cx, cy);
    this.tweens.add({
      targets: ring, scale: move.radius / 20, alpha: 0, duration: 280,
      onComplete: () => ring.destroy(),
    });
    const flash = this.add.circle(cx, cy, move.radius * 0.55, pal.body, 0.35);
    this.tweens.add({ targets: flash, scale: 1.5, alpha: 0, duration: 220, onComplete: () => flash.destroy() });

    for (const target of this.fighters) {
      if (target === owner || !target.alive || target.state === 'ko') continue;
      const rect = target.getHurtboxRect();
      const nearest = new Phaser.Geom.Point(
        Phaser.Math.Clamp(cx, rect.left, rect.right),
        Phaser.Math.Clamp(cy, rect.top, rect.bottom),
      );
      if (Phaser.Math.Distance.Between(cx, cy, nearest.x, nearest.y) <= move.radius) {
        this.landHit(owner, target, move);
      }
    }
  }

  // launchDir: the direction the attack points (-1 / 1). Omitted for radial
  // moves like H-Burst, which launch away from the blast centre instead.
  landHit(attacker, victim, move, launchDir) {
    const dmg = victim.takeHit(attacker, move, this.time.now, launchDir);
    victim.lastHitBy = attacker;
    attacker.damageDealt += dmg;
    sfx('hit');
    this.hitSpark(victim.x, victim.y - victim.bodyH * 0.6);
    // juice: hit-pause + shake scaled by damage
    this.physics.world.pause();
    this.time.delayedCall(both(dmg), () => this.physics.world.resume());
    this.cameras.main.shake(90 + dmg * 6, 0.004 + dmg * 0.0006);

    function both(d) { return 45 + Math.min(d * 5, 70); }
  }

  hitSpark(x, y) {
    const spark = this.add.graphics();
    spark.setPosition(x, y);
    spark.fillStyle(0xffffff, 1);
    // 8-point star burst
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i + Math.PI / 8;
      const len = i % 2 === 0 ? 26 : 15;
      spark.fillTriangle(
        Math.cos(a) * len, Math.sin(a) * len,
        Math.cos(a + 0.35) * 6, Math.sin(a + 0.35) * 6,
        Math.cos(a - 0.35) * 6, Math.sin(a - 0.35) * 6,
      );
    }
    spark.setScale(0.4);
    this.tweens.add({
      targets: spark, scale: 1.15, alpha: 0, duration: 190,
      onComplete: () => spark.destroy(),
    });
  }

  // ------------------------------------------------------------------ pause
  togglePause() {
    if (this.matchOver) return;
    if (this.scene.isPaused('Battle')) return; // handled by pause scene resume
    this.scene.pause();
    this.scene.launch('PauseMenu', { resumeKey: 'Battle' });
  }

  // ----------------------------------------------------------------- update
  update(time, delta) {
    if (this.matchOver) return;

    // feed input into fighters — slots 0/1 read the keyboard, 2-5 read
    // whatever their phone last sent (or all-false if it's disconnected, so
    // a dropped phone just leaves its fighter standing idle instead of
    // crashing the match), and bots run the basic CPU controller instead of
    // any real input source.
    this.fighters.forEach((f) => {
      if (f.isBot) {
        const ai = computeBotInput(time, f, this.fighters, { minX: W / 2 - 400, maxX: W / 2 + 400 });
        f.input.left = ai.left;
        f.input.right = ai.right;
        f.input.jump = ai.jump;
        f.input.attack = ai.attack;
        f.input.special = ai.special;
        return;
      }
      const map = this.keymaps[f.controlSlot];
      if (map) {
        f.input.left = map.left.isDown;
        f.input.right = map.right.isDown;
        f.input.jump = map.jump.isDown;
        f.input.attack = map.attack.isDown;
        f.input.special = map.special.isDown;
      } else {
        const net = phoneNet.getInput(f.controlSlot);
        f.input.left = net.left;
        f.input.right = net.right;
        f.input.jump = net.up;
        f.input.attack = net.confirm;
        f.input.special = net.back;
      }
    });

    for (const f of this.fighters) f.update(time, delta);

    // melee hit detection
    for (const attacker of this.fighters) {
      const hb = attacker.getHitboxRect();
      if (!hb) continue;
      for (const victim of this.fighters) {
        if (victim === attacker || !victim.alive || victim.state === 'ko' || !victim.visible) continue;
        if (attacker.activeHit.landed.has(victim)) continue;
        if (Phaser.Geom.Rectangle.Overlaps(hb, victim.getHurtboxRect())) {
          attacker.activeHit.landed.add(victim);
          this.landHit(attacker, victim, attacker.activeHit.move, attacker.activeHit.dir);
        }
      }
    }

    // projectiles
    for (const p of this.projectiles) {
      p.gfx.x += (p.vx * delta) / 1000;
      p.gfx.y += Math.sin(time / 90) * 0.4; // gentle drift wobble
      if (time > p.dieAt || p.gfx.x < -60 || p.gfx.x > W + 60) {
        p.gfx.destroy();
        p.dead = true;
        continue;
      }
      for (const victim of this.fighters) {
        if (victim === p.owner || !victim.alive || victim.state === 'ko' || !victim.visible || p.landed.has(victim)) continue;
        const rect = victim.getHurtboxRect();
        const nx = Phaser.Math.Clamp(p.gfx.x, rect.left, rect.right);
        const ny = Phaser.Math.Clamp(p.gfx.y, rect.top, rect.bottom);
        if (Phaser.Math.Distance.Between(p.gfx.x, p.gfx.y, nx, ny) <= p.radius) {
          p.landed.add(victim);
          // a projectile shoves you the way it was travelling, even if it
          // caught you from your front
          this.landHit(p.owner, victim, p.move, Math.sign(p.vx));
          p.gfx.destroy();
          p.dead = true;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    // blast zones
    for (const f of this.fighters) {
      if (!f.alive || f.state === 'ko' || f.state === 'dead') continue;
      if (f.x < -BLAST_MARGIN || f.x > W + BLAST_MARGIN || f.y > H + BLAST_MARGIN || f.y < -BLAST_MARGIN * 2.2) {
        this.koBlast(f);
        const killer = this.lastAttackerOf(f);
        if (killer) killer.kos += 1;
        f.loseStock();
      }
    }

    this.updateHud();
    this.checkWin();
  }

  lastAttackerOf(victim) {
    // Whoever last actually hit them, tracked in landHit() — falls back to
    // "the other fighter" only for an un-hit blast-zone wander in 1v1.
    if (victim.lastHitBy && victim.lastHitBy !== victim && victim.lastHitBy.alive) return victim.lastHitBy;
    return this.fighters.find((f) => f !== victim && f.alive) ?? null;
  }

  koBlast(f) {
    sfx('ko');
    // burst of lines at the blast point, clamped on-screen
    const x = Phaser.Math.Clamp(f.x, 30, W - 30);
    const y = Phaser.Math.Clamp(f.y, 30, H - 30);
    const pal = f.charDef.palettes[f.paletteIndex];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI * 2 * i) / 10;
      const line = this.add.rectangle(x, y, 34, 5, pal.body).setRotation(a);
      this.tweens.add({
        targets: line,
        x: x + Math.cos(a) * 110,
        y: y + Math.sin(a) * 110,
        alpha: 0, scaleX: 0.2, duration: 320,
        onComplete: () => line.destroy(),
      });
    }
    this.cameras.main.shake(180, 0.012);
  }

  checkWin() {
    const alive = this.fighters.filter((f) => f.alive);
    if (alive.length > 1) return;
    this.matchOver = true;
    sfx('gameEnd');
    const winner = alive[0] ?? null;

    const banner = this.add.text(W / 2, H / 2 - 40, 'GAME!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '110px', color: '#ffffff',
      stroke: '#1c2b4a', strokeThickness: 14,
    }).setOrigin(0.5).setScale(0.2);
    this.tweens.add({ targets: banner, scale: 1, duration: 320, ease: 'Back.Out' });

    this.time.delayedCall(1800, () => {
      const results = this.fighters.map((f) => ({
        charId: f.charDef.id,
        name: f.charDef.name,
        palette: f.paletteIndex,
        stocks: f.stocks,
        kos: f.kos,
        damageDealt: Math.round(f.damageDealt),
        won: f === winner,
      }));
      if (this.scene.manager.getScene('Results')) {
        this.scene.start('Results', { results, setup: this.setup });
      } else {
        // pre-M4 fallback: restart the match
        this.scene.restart();
      }
    });
  }
}
