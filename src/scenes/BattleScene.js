import * as Phaser from 'phaser';
import Fighter from '../engine/Fighter.js';
import { CHARACTERS } from '../data/characters.js';
import { STAGES, stageKey, getStageBlast, getStageSpawns, getStageBounds, getStageWorld, moverPosition } from '../data/stages.js';
import { play as sfx } from '../engine/sfx.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { phoneNet } from '../net/PhoneNet.js';
import { computeBotInput } from '../engine/BotAI.js';
import { buildNavGraph } from '../engine/BotNav.js';
import { startStageIntro } from '../engine/stageIntros.js';
import { playVfx, projectileStyle } from '../engine/MoveVfx.js';

const GRAVITY = 1500;

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
    // Falls back to a random stage rather than always the first one, so
    // launching Battle directly (no StageSelect) for testing still shows
    // stage variety instead of always Elemental Isle.
    this.stage = STAGES.find((s) => s.id === this.setup.stageId)
      ?? Phaser.Utils.Array.GetRandom(STAGES);
  }

  create() {
    this.physics.world.gravity.y = GRAVITY;
    this.matchOver = false;
    // KO lines and CPU ledge bounds come from the stage (data/stages.js);
    // the original four stages keep their old values via the defaults.
    this.blast = getStageBlast(this.stage);
    if (this.stage.art) {
      const b = getStageBounds(this.stage);
      this.botBounds = { minX: b.minX + 60, maxX: b.maxX - 60 };
    } else {
      this.botBounds = { minX: W / 2 - 400, maxX: W / 2 + 400 };
    }

    // big stages opt in to a follow camera (stage.camera); everything else
    // keeps the fixed 1280x720 view
    this.world = getStageWorld(this.stage);
    this.setupCamera();
    // multi-level CPU path-finding (stage.botNav, engine/BotNav.js)
    this.nav = this.stage.botNav ? buildNavGraph(this.stage) : null;

    this.drawBackground();
    this.buildStage();
    this.spawnFighters();
    this.asUi(() => this.buildHud());
    if (this.camRig) this.offscreenG = this.asUi(() => this.add.graphics().setDepth(900));
    this.updateCamera(0);
    this.bindKeyboard();

    this.projectiles = [];
    this.zones = [];
    this.matchReport = {
      movesFired: {},
      hits: {},
      kos: [],
      errors: [],
    };
    if (this.setup.playtestMs) {
      this.playtestUntil = this.time.now + this.setup.playtestMs;
      window.__akReport = null;
    }

    // optional per-stage match intro (engine/stageIntros.js): fighters are
    // frozen while it plays (+200ms so a skip press can't become an attack);
    // confirm (F/K/Enter/Space, phone attack) or a click skips it.
    this.introLockUntil = 0;
    // Timed CPU matches skip the stage intro so the clock is all fighting.
    this.intro = this.setup.playtestMs ? null : startStageIntro(this, this.stage, {
      onDone: () => { this.introLockUntil = this.time.now + 200; },
    });
    if (this.intro) {
      const skip = () => { if (this.intro?.active) this.intro.skip(); };
      const SKIP_KEYS = new Set(['KeyF', 'KeyK', 'Enter', 'Space']);
      this.input.keyboard.on('keydown', (e) => { if (SKIP_KEYS.has(e.code)) skip(); });
      this.input.on('pointerdown', skip);
      this.introPhonePrev = {};
    }

    // pause menu hook (M4): ESC or P
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
  }

  // ----------------------------------------------------------------- camera
  // Camera stages: the main camera follows/zooms over the world, a second
  // fixed camera draws the HUD/banners. Every display object renders on
  // exactly one of them: world objects are hidden from the UI camera as
  // they're added, and anything built inside asUi() (or passed to markUi())
  // is hidden from the main camera instead. Non-camera stages: no-ops.
  setupCamera() {
    this.camRig = null;
    this.uiCam = null;
    const cfg = this.stage.camera;
    if (!cfg) return;
    const { width: WW, height: WH } = this.world;
    const minZoom = Math.min(1, Math.max(W / WW, H / WH, cfg.minZoom ?? 0));
    this.camRig = {
      cfg, minZoom, maxZoom: Math.max(minZoom, cfg.maxZoom ?? 1),
      zoom: minZoom, cx: WW / 2, cy: WH / 2, first: true, uiMode: false,
    };
    const main = this.cameras.main;
    main.setBounds(0, 0, WW, WH).setZoom(minZoom).centerOn(WW / 2, WH / 2);
    this.uiCam = this.cameras.add(0, 0, W, H).setName('ui');
    const route = (go) => {
      if (this.camRig.uiMode) main.ignore(go);
      else this.uiCam.ignore(go);
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, route);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, route));
  }

  /** Run fn with every object it adds drawn by the UI (screen) camera. */
  asUi(fn) {
    if (!this.camRig) return fn();
    const prev = this.camRig.uiMode;
    this.camRig.uiMode = true;
    try { return fn(); } finally { this.camRig.uiMode = prev; }
  }

  /** Move an already-added object to the UI camera. */
  markUi(go) {
    if (!this.camRig) return go;
    go.cameraFilter &= ~this.uiCam.id;
    this.cameras.main.ignore(go);
    return go;
  }

  // Frame every live fighter: bounding box + padding -> zoom (clamped to
  // [whole-world, maxZoom]) and center (clamped so the view never leaves
  // the world), both eased; zooming out is quicker than zooming back in so
  // a launched fighter doesn't leave the frame.
  updateCamera(delta) {
    const rig = this.camRig;
    if (!rig) return;
    const { width: WW, height: WH } = this.world;
    const cfg = rig.cfg;
    const live = (this.fighters ?? []).filter((f) => f.alive && f.visible && f.state !== 'ko' && f.state !== 'dead');
    let tz = rig.minZoom;
    let tx = WW / 2;
    let ty = WH / 2;
    if (live.length) {
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
      for (const f of live) {
        const fx = Phaser.Math.Clamp(f.x, 0, WW);
        const fy = Phaser.Math.Clamp(f.y, 0, WH);
        x0 = Math.min(x0, fx - f.bodyW / 2); x1 = Math.max(x1, fx + f.bodyW / 2);
        y0 = Math.min(y0, fy - f.bodyH); y1 = Math.max(y1, fy);
      }
      x0 -= cfg.padX ?? 240; x1 += cfg.padX ?? 240;
      y0 -= cfg.padTop ?? 220; y1 += cfg.padBottom ?? 130;
      tz = Phaser.Math.Clamp(Math.min(W / (x1 - x0), H / (y1 - y0)), rig.minZoom, rig.maxZoom);
      tx = (x0 + x1) / 2;
      ty = (y0 + y1) / 2;
    }
    const first = rig.first;
    rig.first = false;
    const zMs = tz < rig.zoom ? (cfg.zoomOutMs ?? 220) : (cfg.zoomInMs ?? 650);
    rig.zoom += (tz - rig.zoom) * (first ? 1 : 1 - Math.exp(-delta / zMs));
    const hw = W / (2 * rig.zoom);
    const hh = H / (2 * rig.zoom);
    const k = first ? 1 : 1 - Math.exp(-delta / (cfg.lerpMs ?? 200));
    rig.cx += (Phaser.Math.Clamp(tx, hw, WW - hw) - rig.cx) * k;
    rig.cy += (Phaser.Math.Clamp(ty, hh, WH - hh) - rig.cy) * k;
    rig.cx = Phaser.Math.Clamp(rig.cx, hw, WW - hw);
    rig.cy = Phaser.Math.Clamp(rig.cy, hh, WH - hh);
    this.cameras.main.setZoom(rig.zoom).centerOn(rig.cx, rig.cy);
    this.drawOffscreenMarkers(live);
  }

  // Fighters outside the view (past the world edge, flying toward a blast
  // line) get a palette-colored arrow at the screen edge.
  drawOffscreenMarkers(live) {
    const g = this.offscreenG;
    if (!g) return;
    g.clear();
    const rig = this.camRig;
    for (const f of live) {
      const sx = (f.x - rig.cx) * rig.zoom + W / 2;
      const sy = (f.y - f.bodyH / 2 - rig.cy) * rig.zoom + H / 2;
      if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) continue;
      const mx = Phaser.Math.Clamp(sx, 30, W - 30);
      const my = Phaser.Math.Clamp(sy, 30, H - 30);
      const a = Math.atan2(sy - my, sx - mx);
      const col = f.charDef.palettes[f.paletteIndex].body;
      g.fillStyle(0x0b1424, 0.75).fillCircle(mx, my, 17);
      g.lineStyle(3, col, 1).strokeCircle(mx, my, 17);
      const tip = (r, da) => [mx + Math.cos(a + da) * r, my + Math.sin(a + da) * r];
      const [ax, ay] = tip(28, 0); const [bx, by] = tip(19, 0.5); const [cx2, cy2] = tip(19, -0.5);
      g.fillStyle(col, 1).fillTriangle(ax, ay, bx, by, cx2, cy2);
    }
  }

  // ------------------------------------------------------------------ stage
  drawBackground() {
    // Painted stages: stacked parallax layers (sky -> near), each 1440px
    // wide so they can slide up to +-80px as the fighters move without
    // showing an edge. See updateParallax().
    const art = this.stage.art;
    if (art && this.camRig && this.textures.exists(stageKey(this.stage, 'layer0'))) {
      // camera stages: world-sized layers on a scrollFactor (par). Offset by
      // (1-par) x the half-view overshoot at full zoom-out, each layer covers
      // the view at every zoom/scroll -- and at full zoom-out they stack 1:1
      // with the terrain, which is how they're painted.
      const mx = W / (2 * this.camRig.minZoom) - W / 2;
      const my = H / (2 * this.camRig.minZoom) - H / 2;
      art.layers.forEach((l, i) => {
        this.add.image(-(1 - l.par) * mx, -(1 - l.par) * my, stageKey(this.stage, `layer${i}`))
          .setOrigin(0, 0).setScrollFactor(l.par);
      });
      this.parallax = null;
      this.buildAmbient(art.ambient);
      return;
    }
    if (art && this.textures.exists(stageKey(this.stage, 'layer0'))) {
      this.parallax = art.layers.map((l, i) => ({
        img: this.add.image(W / 2, H / 2, stageKey(this.stage, `layer${i}`)),
        par: l.par,
      }));
      this.parallaxFocusX = W / 2;
      this.buildAmbient(art.ambient);
      return;
    }
    this.parallax = null;
    // Layered sky: night-lab gradient (per-stage theme color), distant
    // "molecule" bubbles, soft hills.
    const { skyTop, skyBottom, hills } = this.stage.theme;
    const g = this.add.graphics();
    const top = Phaser.Display.Color.ValueToColor(skyTop);
    const bottom = Phaser.Display.Color.ValueToColor(skyBottom);
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
    g.fillStyle(hills[0], 1);
    g.fillEllipse(W * 0.25, H * 0.98, W * 0.9, H * 0.45);
    g.fillStyle(hills[1], 1);
    g.fillEllipse(W * 0.85, H * 1.02, W * 0.95, H * 0.5);
  }

  // Builds solids/platforms from this.stage's data (see data/stages.js).
  // solids collide from every side (ground pieces, obstacles); platforms
  // are one-way (drop onto only, matched to the collider callback below).
  buildStage() {
    this.solids = this.physics.add.staticGroup();
    this.platforms = this.physics.add.staticGroup();
    const groundY = this.stage.groundY;
    this.movers = [];
    this.moverClock = 0;
    // Painted stages draw all static terrain as one image lined up 1:1 with
    // the geometry; physics zones below are built the same either way.
    const painted = !!(this.stage.art?.terrain && this.textures.exists(stageKey(this.stage, 'terrain')));
    if (painted) this.add.image(0, 0, stageKey(this.stage, 'terrain')).setOrigin(0, 0);

    for (const s of this.stage.solids) {
      const isGround = s.h === undefined; // ground pieces span down from groundY; obstacles give their own h
      const h = s.h ?? 90;
      const topY = s.y ?? groundY;
      const g = this.add.graphics();
      if (painted) {
        // terrain image already covers it
      } else if (isGround) {
        g.fillStyle(0x3d2f4e, 1);
        g.fillRoundedRect(s.x - s.w / 2, topY, s.w, h, { tl: 8, tr: 8, bl: 60, br: 60 });
        g.fillStyle(0x53e0a8, 1);
        g.fillRoundedRect(s.x - s.w / 2, topY, s.w, 22, 8);
        g.fillStyle(0x3bb886, 1);
        g.fillRect(s.x - s.w / 2, topY + 16, s.w, 6);
      } else {
        // a standalone obstacle (e.g. The Core's pillar) -- same lab-floor
        // cap on top, solid dirt body, no rounded "island underside" since
        // it doesn't float.
        g.fillStyle(0x3d2f4e, 1);
        g.fillRoundedRect(s.x - s.w / 2, topY, s.w, h, 6);
        g.fillStyle(0x53e0a8, 1);
        g.fillRoundedRect(s.x - s.w / 2, topY, s.w, 10, 4);
      }
      const zone = this.add.zone(s.x, topY + h / 2, s.w, h);
      this.physics.add.existing(zone, true);
      this.solids.add(zone);
    }

    for (const p of this.stage.platforms) {
      let visual = null;
      if (p.move && this.textures.exists(stageKey(this.stage, 'moving'))) {
        visual = this.add.image(p.x, p.y - 8, stageKey(this.stage, 'moving')).setOrigin(0.5, 0);
      } else if (!painted || p.move) {
        const g = this.add.graphics();
        g.fillStyle(0x6a55a0, 1);
        g.fillRoundedRect(-p.w / 2, 0, p.w, 18, 9);
        g.fillStyle(0x8f78cc, 1);
        g.fillRoundedRect(-p.w / 2, 0, p.w, 8, 4);
        g.setPosition(p.x, p.y);
        visual = g;
      }

      const zone = this.add.zone(p.x, p.y + 9, p.w, 18);
      this.physics.add.existing(zone, true);
      this.platforms.add(zone);
      if (p.move) this.movers.push({ def: p, zone, visual, x: p.x, y: p.y });
      // an elevator's lift image hangs below its walkable top -- keep it
      // behind the fighters but above the terrain (it already is: added later)
    }
  }

  // Moving platforms swing on a sine wave (platforms[].move) and carry
  // anyone standing on them. The clock only advances while physics is
  // running, so hit-pause freezes the lift along with everything else.
  updateMovingPlatforms(delta) {
    if (!this.movers?.length || this.physics.world.isPaused) return;
    this.moverClock += delta;
    for (const m of this.movers) {
      // sine swing or elevator stops (data/stages.js moverPosition)
      const { x: nx, y: ny } = moverPosition(m.def, this.moverClock);
      const dx = nx - m.x;
      const dy = ny - m.y;
      const top = m.zone.body.top;
      const left = m.zone.body.left;
      const right = m.zone.body.right;
      for (const f of this.fighters ?? []) {
        if (!f.alive || !f.body?.enable) continue;
        const b = f.body;
        const standing = (b.touching.down || b.blocked.down) && Math.abs(b.bottom - top) <= 4
          && f.x >= left - 4 && f.x <= right + 4;
        if (standing) { f.x += dx; f.y += dy; }
      }
      m.x = nx; m.y = ny;
      m.zone.setPosition(nx, ny + 9);
      m.zone.body.updateFromGameObject();
      // the lift image's walkable top sits 8px below its top edge
      m.visual?.setPosition(nx, m.visual.type === 'Image' ? ny - 8 : ny);
    }
  }

  // Painted-stage parallax: layers slide opposite the fighters' midpoint,
  // nearer layers more (par), clamped to the 80px margin painted into them.
  updateParallax(delta) {
    if (!this.parallax) return;
    const live = (this.fighters ?? []).filter((f) => f.alive && f.visible);
    const target = live.length ? live.reduce((a, f) => a + f.x, 0) / live.length : W / 2;
    const k = 1 - Math.exp(-delta / 400);
    this.parallaxFocusX += (Phaser.Math.Clamp(target, 0, W) - this.parallaxFocusX) * k;
    for (const l of this.parallax) {
      l.img.x = W / 2 + Phaser.Math.Clamp(-(this.parallaxFocusX - W / 2) * l.par, -78, 78);
    }
  }

  // Lightweight ambient motion for painted stages (one Graphics redrawn per
  // frame, <= ~70 particles): bubbles, sparks, embers, rain, petals.
  buildAmbient(cfg) {
    this.ambient = null;
    if (!cfg) return;
    const rnd = new Phaser.Math.RandomDataGenerator([this.stage.id]);
    const { width: AW, height: AH } = this.world;
    const parts = Array.from({ length: cfg.count }, () => ({
      x: rnd.between(0, AW), y: rnd.between(0, AH), s: rnd.realInRange(0.5, 1), ph: rnd.realInRange(0, Math.PI * 2),
    }));
    this.ambient = { cfg, parts, g: this.add.graphics(), rnd };
  }

  updateAmbient(time, delta) {
    const a = this.ambient;
    if (!a) return;
    const dt = delta / 1000;
    const { kind, color } = a.cfg;
    const { width: AW, height: AH } = this.world;
    a.g.clear();
    for (const p of a.parts) {
      if (kind === 'bubbles') { p.y -= 28 * p.s * dt; p.x += Math.sin(time / 700 + p.ph) * 0.3; }
      else if (kind === 'embers') { p.y -= 46 * p.s * dt; p.x += Math.sin(time / 500 + p.ph) * 0.5; }
      else if (kind === 'sparks') { p.y += 120 * p.s * dt; p.x += 20 * dt * Math.sin(p.ph); }
      else if (kind === 'rain') { p.y += 620 * p.s * dt; p.x -= 120 * p.s * dt; }
      else if (kind === 'petals') { p.y += 30 * p.s * dt; p.x += (24 + Math.sin(time / 900 + p.ph) * 18) * dt; }
      if (p.y < -20) { p.y = AH + 10; p.x = a.rnd.between(0, AW); }
      if (p.y > AH + 20) { p.y = -10; p.x = a.rnd.between(0, AW + 120); }
      if (p.x < -20) p.x = AW + 10; else if (p.x > AW + 40) p.x = -10;
      const flick = 0.55 + 0.45 * Math.sin(time / 180 + p.ph * 3);
      if (kind === 'bubbles') {
        a.g.lineStyle(1.2, color, 0.35 * p.s); a.g.strokeCircle(p.x, p.y, 2 + 4 * p.s);
        a.g.fillStyle(0xffffff, 0.25 * p.s); a.g.fillCircle(p.x - p.s, p.y - p.s, 1.1);
      } else if (kind === 'embers' || kind === 'sparks') {
        a.g.fillStyle(color, (kind === 'embers' ? 0.75 : 0.9) * flick * p.s); a.g.fillCircle(p.x, p.y, 1 + 1.6 * p.s);
      } else if (kind === 'rain') {
        a.g.lineStyle(1, color, 0.22 * p.s); a.g.lineBetween(p.x, p.y, p.x + 4, p.y - 18 * p.s);
      } else if (kind === 'petals') {
        a.g.fillStyle(color, 0.7 * p.s); a.g.fillEllipse(p.x, p.y, 6 * p.s, 3 * p.s);
      }
    }
  }

  // --------------------------------------------------------------- fighters
  spawnFighters() {
    const spawns = getStageSpawns(this.stage);
    this.fighters = this.setup.players.map((p, i) => {
      const def = CHARACTERS[p.charId];
      const sp = spawns[i % spawns.length];
      const f = new Fighter(this, sp.x, sp.y, def, p.palette ?? 0, i);
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
        // Holding down phases through floating platforms entirely (not the
        // main stage -- that's this.solids, a separate collider above).
        if (fighter.input.down) return false;
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
      // P1: WASD + F (attack) / G (special). S was unused before the
      // 2026-08-05 move-architecture change -- now it's the "down" direction
      // for the basic/special neutral-vs-directional gating (see Fighter.js).
      {
        left: kb.addKey('A'), right: kb.addKey('D'), jump: kb.addKey('W'), down: kb.addKey('S'),
        attack: kb.addKey('F'), special: kb.addKey('G'),
      },
      // P2: arrows + K (attack) / L (special). DOWN arrow was unused before
      // the same change.
      {
        left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
        right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
        jump: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
        down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
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
    const style = projectileStyle(move);
    const r = style.radius;
    const pal = owner.charDef.palettes[owner.paletteIndex];
    const orb = this.add.graphics();
    if (move.visualShape === 'spearhead') {
      // Oriented lance/spearhead shape instead of the generic orb -- points
      // in the direction of travel (Titan's Aero Lance).
      orb.fillStyle(pal.body, 0.9);
      orb.lineStyle(2, 0xffffff, 0.9);
      orb.beginPath();
      orb.moveTo(r * 1.6, 0);
      orb.lineTo(-r * 0.6, -r * 0.7);
      orb.lineTo(-r * 0.2, 0);
      orb.lineTo(-r * 0.6, r * 0.7);
      orb.closePath();
      orb.fillPath();
      orb.strokePath();
      orb.fillStyle(0xffffff, 0.6);
      orb.fillCircle(r * 0.4, 0, r * 0.25);
      orb.rotation = owner.facing === -1 ? Math.PI : 0;
    } else {
      const fill = style.fill ?? pal.body;
      if (style.shape === 'balloon') {
        orb.fillStyle(fill, 0.35);
        orb.fillEllipse(0, 0, r * 1.7, r * 2.1);
        orb.lineStyle(2, 0xffffff, 0.85);
        orb.strokeEllipse(0, 0, r * 1.7, r * 2.1);
        orb.fillStyle(0xffffff, 0.7);
        orb.fillCircle(-r * 0.3, -r * 0.45, r * 0.28);
      } else if (style.shape === 'wave') {
        orb.lineStyle(4, fill, 0.9);
        orb.beginPath();
        orb.moveTo(-r, 0);
        orb.lineTo(r, -r * 0.45);
        orb.lineTo(r * 0.2, 0);
        orb.lineTo(r, r * 0.45);
        orb.strokePath();
      } else {
        orb.fillStyle(fill, 0.55);
        orb.fillCircle(0, 0, r);
        orb.lineStyle(2.5, 0xffffff, 0.8);
        orb.strokeCircle(0, 0, r);
        orb.fillStyle(0xffffff, 0.55);
        orb.fillCircle(-r * 0.3, -r * 0.3, r * 0.35);
      }
    }
    orb.x = owner.x + owner.facing * (owner.bodyW / 2 + r + 4);
    orb.y = owner.y - owner.bodyH * 0.65;

    let vy = 0;
    if (move.angleable) {
      if (owner.input?.jump) vy = -240;
      else if (owner.input?.down) vy = 220;
    }
    this.projectiles.push({
      gfx: orb, owner, move,
      vx: owner.facing * move.projectileSpeed,
      vy,
      dieAt: this.time.now + move.projectileLife,
      born: this.time.now,
      landed: new Set(),
      radius: r,
    });
  }

  resolveBurst(owner, move, at) {
    const cx = at?.x ?? owner.x + (owner.facing || 1) * (move.offsetX ?? 0);
    const cy = at?.y ?? owner.y - owner.bodyH / 2;
    playVfx(this, owner, move, 'release', { x: cx, y: cy });

    let hits = 0;
    for (const target of this.fighters) {
      if (!move.includeSelf && target === owner) continue;
      if (!target.alive || target.state === 'ko') continue;
      const rect = target.getHurtboxRect();
      const nearest = new Phaser.Geom.Point(
        Phaser.Math.Clamp(cx, rect.left, rect.right),
        Phaser.Math.Clamp(cy, rect.top, rect.bottom),
      );
      if (Phaser.Math.Distance.Between(cx, cy, nearest.x, nearest.y) <= (move.radius ?? 70)) {
        this.landHit(owner, target, move);
        hits += 1;
      }
    }
    if (move.missRetry && hits === 0 && !move._retried) {
      this.time.delayedCall(180, () => {
        if (owner.alive) this.resolveBurst(owner, { ...move, _retried: true, missRetry: false });
      });
    }
    if (move.chain && !move._chained) {
      for (let i = 1; i <= move.chain.count; i++) {
        const echo = {
          ...move,
          _chained: true,
          chain: null,
          damage: (move.damage ?? 0) * (move.chain.scale ?? 0.6),
          radius: (move.radius ?? 70) * (0.7 + i * 0.15),
        };
        this.time.delayedCall((move.chain.delay ?? 160) * i, () => {
          if (owner.alive) this.resolveBurst(owner, echo);
        });
      }
    }
  }

  resolveBeam(owner, move) {
    const len = (move.beamLen ?? 160) * (move._beamScale ?? 1);
    const thick = move.beamThick ?? 20;
    const x = owner.facing === 1 ? owner.x + owner.bodyW * 0.2 : owner.x - owner.bodyW * 0.2 - len;
    const y = owner.y - owner.bodyH * 0.62;
    const rect = new Phaser.Geom.Rectangle(x, y - thick / 2, len, thick);
    playVfx(this, owner, move, 'release');
    for (const target of this.fighters) {
      if (target === owner || !target.alive || target.state === 'ko') continue;
      if (Phaser.Geom.Rectangle.Overlaps(rect, target.getHurtboxRect())) {
        this.landHit(owner, target, move, owner.facing);
      }
    }
  }

  spawnZone(owner, spec, x, y) {
    const radius = spec.radius ?? 70;
    const color = spec.color ?? 0xff8844;
    const gfx = this.add.circle(x, y, radius, color, 0.28);
    gfx.setStrokeStyle?.(2, color, 0.8);
    this.zones.push({
      owner, spec, x, y, radius, gfx,
      until: this.time.now + (spec.ms ?? 1600),
      next: this.time.now,
    });
  }

  updateZones(time) {
    for (const z of this.zones) {
      if (time >= z.until) {
        z.gfx.destroy();
        z.dead = true;
        continue;
      }
      if (time < z.next) continue;
      z.next = time + (z.spec.tick ?? 400);
      for (const target of this.fighters) {
        if (target === z.owner || !target.alive || target.state === 'ko') continue;
        const rect = target.getHurtboxRect();
        const nx = Phaser.Math.Clamp(z.x, rect.left, rect.right);
        const ny = Phaser.Math.Clamp(z.y, rect.top, rect.bottom);
        if (Phaser.Math.Distance.Between(z.x, z.y, nx, ny) > z.radius) continue;
        this.landHit(z.owner, target, {
          name: z.spec.name ?? 'zone',
          type: z.spec.type,
          damage: z.spec.damage,
          baseKnockback: 40,
          knockbackGrowth: 0.4,
          kind: 'burst',
        });
        if (z.spec.slide) {
          target.slipperyUntil = time + 280;
          target.slipperyMult = 1.45;
        }
      }
    }
    this.zones = this.zones.filter((z) => !z.dead);
  }

  // launchDir: the direction the attack points (-1 / 1). Omitted for radial
  // moves like H-Burst, which launch away from the blast centre instead.
  noteMove(fighter, move) {
    const key = `${fighter.charDef.id}:${move.name}`;
    this.matchReport.movesFired[key] = (this.matchReport.movesFired[key] ?? 0) + 1;
  }

  noteDot(fighter, type, amount) {
    const key = `${fighter.charDef?.id ?? '?'}:burn`;
    const bucket = this.matchReport.hits[key] ?? { count: 0 };
    bucket.count += 1;
    bucket[type] = (bucket[type] ?? 0) + amount;
    this.matchReport.hits[key] = bucket;
  }

  noteHit(attacker, victim, move) {
    const key = `${attacker.charDef?.id ?? '?'}:${move.name}`;
    const bucket = this.matchReport.hits[key] ?? { count: 0 };
    bucket.count += 1;
    for (const p of victim.lastPackets ?? []) {
      bucket[p.type] = (bucket[p.type] ?? 0) + p.dealt;
    }
    this.matchReport.hits[key] = bucket;
  }

  buildPlaytestReport() {
    const fighters = this.fighters.map((f) => ({
      id: f.charDef.id,
      name: f.charDef.name,
      stocks: f.stocks,
      percent: Math.round(f.percent),
      kos: f.kos,
      damageDealt: Math.round(f.damageDealt),
      alive: f.alive,
    }));
    const ranked = [...fighters].sort((a, b) => (b.stocks - a.stocks) || (a.percent - b.percent) || (b.damageDealt - a.damageDealt));
    return {
      stage: this.stage.id,
      elapsedMs: this.setup.playtestMs,
      winner: ranked[0]?.name ?? null,
      fighters,
      movesFired: this.matchReport.movesFired,
      hits: this.matchReport.hits,
      kos: this.matchReport.kos,
      errors: this.matchReport.errors,
    };
  }

  publishPlaytestReport() {
    if (this.reportPublished) return;
    this.reportPublished = true;
    const report = this.buildPlaytestReport();
    window.__akReport = report;
    console.log(`AK_REPORT ${JSON.stringify(report)}`);
  }

  landHit(attacker, victim, move, launchDir) {
    const dmg = victim.takeHit(attacker, move, this.time.now, launchDir);
    if (dmg > 0) this.noteHit(attacker, victim, move);
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
    this.updateAmbient(time, delta);
    this.updateParallax(delta);
    this.updateCamera(delta);
    if (this.playtestUntil && !this.reportPublished && time >= this.playtestUntil) {
      this.matchOver = true;
      this.publishPlaytestReport();
    }
    if (this.matchOver) return;
    this.updateMovingPlatforms(delta);
    if (this.nav) for (const L of this.nav.lifts) this.nav.setLiftY(L.mover, this.movers[L.mover].y);

    // feed input into fighters — slots 0/1 read the keyboard, 2-5 read
    // whatever their phone last sent (or all-false if it's disconnected, so
    // a dropped phone just leaves its fighter standing idle instead of
    // crashing the match), and bots run the basic CPU controller instead of
    // any real input source.
    const introLocked = this.intro?.active || this.time.now < this.introLockUntil;
    if (this.intro?.active) {
      // phone attack button skips the intro (edge-triggered)
      for (const f of this.fighters) {
        if (f.isBot || this.keymaps[f.controlSlot]) continue;
        const c = phoneNet.getInput(f.controlSlot).confirm;
        if (c && !this.introPhonePrev[f.controlSlot]) this.intro.skip();
        this.introPhonePrev[f.controlSlot] = c;
      }
    }
    this.fighters.forEach((f) => {
      if (introLocked) {
        f.input.left = f.input.right = f.input.jump = f.input.down = false;
        f.input.attack = f.input.special = false;
        return;
      }
      if (f.isBot) {
        const ai = computeBotInput(time, f, this.fighters, this.botBounds, this.nav);
        f.input.left = ai.left;
        f.input.right = ai.right;
        f.input.jump = ai.jump;
        // Nav bots hold down briefly to drop through a platform. The scripted
        // offense in BotAI clears it again while a charge or defense is held.
        f.input.down = !!ai.down;
        f.input.attack = ai.attack;
        f.input.special = ai.special;
        return;
      }
      const map = this.keymaps[f.controlSlot];
      if (map) {
        f.input.left = map.left.isDown;
        f.input.right = map.right.isDown;
        f.input.jump = map.jump.isDown;
        f.input.down = map.down.isDown;
        f.input.attack = map.attack.isDown;
        f.input.special = map.special.isDown;
      } else {
        const net = phoneNet.getInput(f.controlSlot);
        f.input.left = net.left;
        f.input.right = net.right;
        f.input.jump = net.up;
        // PhoneNet/controller.html already carry a real "down" button end to
        // end (net.down) -- it just wasn't read into fighter input before the
        // 2026-08-05 move-architecture change.
        f.input.down = net.down;
        f.input.attack = net.confirm;
        f.input.special = net.back;
      }
    });

    for (const f of this.fighters) f.update(time, delta);
    this.updateZones(time);

    // `wall`-kind defensive moves (e.g. Hydra's Dual Flame Wall) are also an
    // active hazard: two zones flanking the fighter that damage anyone who
    // touches them, once per activation (tracked in f.wallLanded).
    for (const f of this.fighters) {
      if (f.state !== 'defending' || f.defenseMove?.kind !== 'wall') continue;
      const m = f.defenseMove;
      const y = f.y - f.bodyH * (m.wallYFrac ?? 0.75);
      const front = f.facing === 1 ? f.x + f.bodyW / 2 : f.x - f.bodyW / 2 - m.wallRangeW;
      const sides = m.frontOnly
        ? [front]
        : [f.x - f.bodyW / 2 - m.wallRangeW, f.x + f.bodyW / 2];
      for (const wx of sides) {
        const rect = new Phaser.Geom.Rectangle(wx, y - m.wallRangeH / 2, m.wallRangeW, m.wallRangeH);
        for (const target of this.fighters) {
          if (target === f || !target.alive || target.state === 'ko' || f.wallLanded.has(target)) continue;
          if (Phaser.Geom.Rectangle.Overlaps(rect, target.getHurtboxRect())) {
            f.wallLanded.add(target);
            if (m.wallRootMs && time - (f.defenseStart ?? time) < m.wallRootMs) {
              target.rootedUntil = time + 480;
            }
            this.landHit(f, target, {
              name: m.name,
              damage: m.wallDamage, type: m.wallType,
              baseKnockback: m.wallKnockback, knockbackGrowth: m.wallKnockbackGrowth ?? 0,
              kind: 'burst', // radial launch -- away from the wall, like a burst
            });
          }
        }
      }
    }

    // melee hit detection
    for (const attacker of this.fighters) {
      const hb = attacker.getHitboxRect();
      if (!hb) continue;
      for (const victim of this.fighters) {
        if (victim === attacker || !victim.alive || victim.state === 'ko' || !victim.visible) continue;
        const hit = attacker.activeHit;
        if (hit.landed.has(victim)) continue;
        if (hit.next && time < (hit.next.get(victim) ?? 0)) continue;
        if (Phaser.Geom.Rectangle.Overlaps(hb, victim.getHurtboxRect())) {
          const cap = hit.move.multiHit ?? 1;
          const n = (hit.counts?.get(victim) ?? 0) + 1;
          hit.counts ??= new Map();
          hit.counts.set(victim, n);
          if (n >= cap) hit.landed.add(victim);
          else {
            hit.next ??= new Map();
            hit.next.set(victim, time + 90);
          }
          let swing = hit.move;
          if (swing.sweetSpot) {
            const tip = hit.dir === 1 ? hb.right : hb.left;
            if (Math.abs(victim.x - tip) < hb.width * 0.38) {
              swing = { ...swing, damage: (swing.damage ?? 0) + swing.sweetSpot };
            }
          }
          this.landHit(attacker, victim, swing, hit.dir);
        }
      }
    }

    // projectiles
    for (const p of this.projectiles) {
      if (p.move.returns && !p.returning && time > p.born + p.move.projectileLife * 0.45) {
        p.vx *= -1;
        p.returning = true;
        p.landed = new Set();
      }
      p.gfx.x += (p.vx * delta) / 1000;
      p.gfx.y += (p.vy * delta) / 1000 + Math.sin(time / 90) * 0.25;
      const off = p.gfx.x < -80 || p.gfx.x > this.world.width + 80 || p.gfx.y > this.world.height + 80;
      if (time > p.dieAt || off) {
        if (p.move.explodeOnly) this.resolveBurst(p.owner, { ...p.move, radius: p.move.explodeRadius ?? 70, kind: 'burst' }, { x: p.gfx.x, y: p.gfx.y });
        p.gfx.destroy();
        p.dead = true;
        continue;
      }
      for (const victim of this.fighters) {
        if (victim === p.owner || !victim.alive || victim.state === 'ko' || !victim.visible || p.landed.has(victim)) continue;
        const rect = victim.getHurtboxRect();
        const nx = Phaser.Math.Clamp(p.gfx.x, rect.left, rect.right);
        const ny = Phaser.Math.Clamp(p.gfx.y, rect.top, rect.bottom);
        if (Phaser.Math.Distance.Between(p.gfx.x, p.gfx.y, nx, ny) > p.radius) continue;
        const def = victim.defenseMove;
        const perfect = def?.reflectProjectiles === 'perfect'
          && time - (victim.defenseStart ?? time) <= (def.perfectMs ?? 200);
        if (victim.state === 'defending' && (def?.reflectProjectiles === true || perfect)) {
          this.landHit(victim, p.owner, p.move, -Math.sign(p.vx) || victim.facing);
          p.gfx.destroy();
          p.dead = true;
          break;
        }
        p.landed.add(victim);
        if (p.move.explodeOnly) {
          this.resolveBurst(p.owner, { ...p.move, radius: p.move.explodeRadius ?? 70, kind: 'burst' }, { x: p.gfx.x, y: p.gfx.y });
          p.gfx.destroy();
          p.dead = true;
          break;
        }
        // a projectile shoves you the way it was travelling
        this.landHit(p.owner, victim, p.move, Math.sign(p.vx) || p.owner.facing);
        if (!p.move.pierce) {
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
      const b = this.blast;
      if (f.x < b.left || f.x > b.right || f.y > b.bottom || f.y < b.top) {
        this.koBlast(f);
        const killer = this.lastAttackerOf(f);
        if (killer) killer.kos += 1;
        this.matchReport?.kos.push({
          victim: f.charDef.id,
          killer: killer?.charDef.id ?? null,
          t: Math.round(time),
        });
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
    // burst of lines at the blast point, clamped on-screen (to the camera
    // view on camera stages -- same as the screen everywhere else)
    const v = this.camRig ? this.cameras.main.worldView : { x: 0, y: 0, right: W, bottom: H };
    const x = Phaser.Math.Clamp(f.x, v.x + 30, v.right - 30);
    const y = Phaser.Math.Clamp(f.y, v.y + 30, v.bottom - 30);
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
    if (this.setup.playtestMs) {
      this.publishPlaytestReport();
      return;
    }
    sfx('gameEnd');
    const winner = alive[0] ?? null;

    const banner = this.asUi(() => this.add.text(W / 2, H / 2 - 40, 'GAME!', {
      fontFamily: 'Arial Black, sans-serif', fontSize: '110px', color: '#ffffff',
      stroke: '#1c2b4a', strokeThickness: 14,
    }).setOrigin(0.5).setScale(0.2));
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
