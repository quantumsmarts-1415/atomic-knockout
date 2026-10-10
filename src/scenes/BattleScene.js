import * as Phaser from 'phaser';
import Fighter from '../engine/Fighter.js';
import { CHARACTERS } from '../data/characters.js';
import { STAGES, stageKey, getStageBlast, getStageSpawns, getStageBounds, getStageWorld, moverPosition } from '../data/stages.js';
import { play as sfx } from '../engine/sfx.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { showScene } from '../ui/flow.js';
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, PLAYER_COLORS, THEME } from '../ui/theme.js';
import { phoneNet } from '../net/PhoneNet.js';
import { computeBotInput } from '../engine/BotAI.js';
import { buildNavGraph } from '../engine/BotNav.js';
import { startStageIntro } from '../engine/stageIntros.js';
import { playVfx, projectileStyle } from '../engine/MoveVfx.js';
import { cleanse } from '../engine/kit.js';
import { mulberry32 } from '../engine/rng.js';
import { hudLayout, fitLabelSize } from '../ui/hudLayout.js';
import { Juice } from '../engine/juice.js';
import { FEEL, frameZoom, percentColor } from '../engine/feel.js';
import {
  resolvePush, projectileSpriteSize, hurtHitsCircle, hurtHitsRect, strikeHits, projectileHits,
  debugCells, debugHitCells, slashPolyline, projectileShape, maskShown,
} from '../engine/boxes.js';

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
    this.reportPublished = false;
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
      fallThroughs: [],
    };
    this.lowestY = {};
    this.collisionMs = 0;
    this.collisionSteps = 0;
    this.rng = this.setup.seed == null ? null : mulberry32(this.setup.seed);
    this.simSpeed = Math.max(1, this.setup.simSpeed || 1);
    this.simFast = this.simSpeed > 1;
    this.timeScale = 1;
    this.visualT = 0;
    this.juice = this.simFast ? null : new Juice(this);
    window.__akBattle = this;
    // Real-time play and the fast sim share one 60 Hz clock. The render loop
    // no longer steps arcade bodies: a hitch used to advance bot timers by
    // wall-clock time while physics only integrated once, and the old fast
    // sim integrated twice per tick and dropped heavies through the floor.
    this.physics.disableUpdate();
    this.stepMs = this.physics.world._frameTimeMS;
    this.tickAccum = 0;
    this.time.timeScale = 0;
    this.time.now = 0;
    this.matchStart = 0;
    this.simNow = 0;
    if (this.setup.playtestMs) {
      this.playtestUntil = this.setup.playtestMs;
      window.__akReport = null;
    }

    // optional per-stage match intro (engine/stageIntros.js): fighters are
    // frozen while it plays (+200ms so a skip press can't become an attack);
    // confirm (F/K/Enter/Space, phone attack) or a click skips it.
    this.introLockUntil = 0;
    // Timed CPU matches skip the stage intro so the clock is all fighting.
    this.intro = this.setup.playtestMs ? null : startStageIntro(this, this.stage, {
      // Stamp the sim clock. Phaser writes the loop timestamp into time.now
      // on every frame while our clock scale is 0, and the doors' "GO" tween
      // finishes on that frame — so time.now here is how long the game has
      // been open, not how long the round has been running. A match started
      // from the menus would stay input-locked until sim time caught up.
      onDone: () => { this.introLockUntil = this.simNow + 200; },
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
    this.showBoxes = false;
    this.boxGfx = this.add.graphics().setDepth(80);
    this.input.keyboard.on('keydown-H', () => { this.showBoxes = !this.showBoxes; });
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
    const stageCam = this.stage.camera || {};
    const cfg = {
      padX: FEEL.camPadX, padTop: FEEL.camPadTop, padBottom: FEEL.camPadBottom,
      lerpMs: FEEL.camPosTau, zoomOutMs: FEEL.camZoomOutTau, zoomInMs: FEEL.camZoomInTau,
      ...stageCam,
    };
    const { width: WW, height: WH } = this.world;
    const players = this.setup.players?.length || 2;
    const feelCap = players >= 3 ? FEEL.camMaxMulti : FEEL.camMax1;
    // A stage maxZoom is a ceiling (Carbon Skyhook must still show its
    // whole world). It does not raise the close-fight cap.
    const cap = stageCam.maxZoom != null ? Math.min(feelCap, stageCam.maxZoom) : feelCap;
    const minZoom = Math.min(1, Math.max(W / WW, H / WH, stageCam.minZoom ?? 0));
    this.camRig = {
      cfg, minZoom, maxZoom: Math.max(minZoom, cap),
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
      const blast = this.blast;
      const lead = FEEL.camBlastLead;
      for (const f of live) {
        const vx = f.body?.velocity?.x || 0;
        const vy = f.body?.velocity?.y || 0;
        // Launches stay in the box and pull it toward the blast line they
        // are flying at, so the trajectory stays framed. The zoom eases;
        // nobody is dropped after a few frames.
        let leadX = vx * FEEL.camLook;
        let leadY = vy * FEEL.camLook;
        const flying = !!f.launch;
        if (blast && flying) {
          if (vx < -200 || f.x < blast.left + lead) leadX -= lead;
          if (vx > 200 || f.x > blast.right - lead) leadX += lead;
          if (vy < -200 || f.y < blast.top + lead) leadY -= lead;
          if (vy > 200 || f.y > blast.bottom - lead) leadY += lead * 0.8;
        }
        const fx = Phaser.Math.Clamp(f.x + leadX, 0, WW);
        const fy = Phaser.Math.Clamp(f.y + leadY, 0, WH);
        x0 = Math.min(x0, fx - f.bodyW / 2); x1 = Math.max(x1, fx + f.bodyW / 2);
        y0 = Math.min(y0, fy - f.bodyH); y1 = Math.max(y1, fy);
      }
      if (x0 === Infinity) {
        tx = rig.cx; ty = rig.cy; tz = rig.zoom;
      } else {
        x0 -= cfg.padX ?? FEEL.camPadX; x1 += cfg.padX ?? FEEL.camPadX;
        y0 -= cfg.padTop ?? FEEL.camPadTop; y1 += cfg.padBottom ?? FEEL.camPadBottom;
        const boxCx = (x0 + x1) / 2;
        const boxCy = (y0 + y1) / 2;
        const spanX = Math.max(FEEL.camMinSpanX, x1 - x0);
        const spanY = Math.max(FEEL.camMinSpanY, y1 - y0);
        const cap = this.koZoom || rig.maxZoom;
        tz = frameZoom(spanX, spanY, W, H, rig.minZoom, cap);
        tx = boxCx;
        ty = boxCy;
        const dead = (W / Math.max(rig.zoom, 0.2)) * FEEL.camDead;
        if (Math.abs(tx - rig.cx) < dead) tx = rig.cx;
        if (Math.abs(ty - rig.cy) < dead) ty = rig.cy;
      }
    }
    if (this.koVictim && this.koZoom) {
      this.koPoint = {
        x: this.koVictim.x,
        y: this.koVictim.y - this.koVictim.bodyH * 0.5,
      };
    }
    if (this.koPoint && this.koZoom) {
      tx = this.koPoint.x;
      ty = this.koPoint.y;
      tz = Math.max(tz, this.koZoom);
    }
    const first = rig.first;
    rig.first = false;
    const ko = this.koPoint && this.koZoom;
    const zMs = ko
      ? FEEL.koZoomTau
      : (tz < rig.zoom ? (cfg.zoomOutMs ?? FEEL.camZoomOutTau) : (cfg.zoomInMs ?? FEEL.camZoomInTau));
    rig.zoom += (tz - rig.zoom) * (first ? 1 : 1 - Math.exp(-Math.max(0, delta) / zMs));
    const hw = W / (2 * rig.zoom);
    const hh = H / (2 * rig.zoom);
    const k = first ? 1 : 1 - Math.exp(-delta / (cfg.lerpMs ?? 200));
    rig.cx += (Phaser.Math.Clamp(tx, hw, WW - hw) - rig.cx) * k;
    rig.cy += (Phaser.Math.Clamp(ty, hh, WH - hh) - rig.cy) * k;
    rig.cx = Phaser.Math.Clamp(rig.cx, hw, Math.max(hw, WW - hw));
    rig.cy = Phaser.Math.Clamp(rig.cy, hh, Math.max(hh, WH - hh));
    const shake = this.juice?.shakeOffset(this.visualT || 0, rig.zoom) || { x: 0, y: 0, rot: 0 };
    this.cameras.main.setZoom(rig.zoom).centerOn(rig.cx + shake.x, rig.cy + shake.y).setRotation(shake.rot || 0);
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
      const top = topY;
      this.ledges ??= [];
      this.ledges.push({ x: s.x - s.w / 2, y: top, facing: 1 });
      this.ledges.push({ x: s.x + s.w / 2, y: top, facing: -1 });
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
      this.ledges ??= [];
      this.ledges.push({ x: p.x - p.w / 2, y: p.y, facing: 1 });
      this.ledges.push({ x: p.x + p.w / 2, y: p.y, facing: -1 });
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
    const slots = hudLayout(this.fighters.length, W, H);
    this.hud = this.fighters.map((f, i) => {
      const slot = slots[i];
      const { panelW, top } = slot;
      const scale = panelW / 260;
      const pip = PLAYER_COLORS[i % PLAYER_COLORS.length];
      // Reactor shell sized by hudLayout so 3–6 players stay on screen.
      // The border is the seat color so it stays distinct from palette choices.
      const panel = this.add.graphics();
      const px = slot.left;
      const py = top;
      const ph = slot.panelH;
      panel.fillStyle(THEME.shell, 0.92);
      panel.fillRoundedRect(px, py, panelW, ph, ph / 2);
      panel.lineStyle(6, pip, 0.35);
      panel.strokeRoundedRect(px - 2, py - 2, panelW + 4, ph + 4, ph / 2 + 2);
      panel.lineStyle(2.5, pip, 1);
      panel.strokeRoundedRect(px, py, panelW, ph, ph / 2);

      const label = `${f.charDef.name} · ${f.charDef.symbol}${f.isBot ? ' (CPU)' : ''}`;
      const percentSize = Math.max(18, Math.round(26 * scale));
      const nameMax = panelW - 28 - percentSize * 2.4;
      const name = this.add.text(px + 18, py + 10, label, {
        fontFamily: FONT_BODY,
        fontSize: `${fitLabelSize(label, nameMax, Math.round(15 * scale))}px`,
        color: THEME.mistCss,
      });
      const percent = this.add.text(slot.right - 18, py + 8, '0%', {
        fontFamily: FONT_DISPLAY, fontSize: `${percentSize}px`, color: THEME.mistCss,
      }).setOrigin(1, 0);
      const stocks = this.add.text(px + 18, py + 40, '', {
        fontFamily: FONT_MONO, fontSize: `${Math.round(16 * scale)}px`, color: THEME.tealCss,
      });
      return { percent, stocks, name };
    });
  }

  updateHud() {
    if (this.simFast) return;
    this.fighters.forEach((f, i) => {
      const h = this.hud[i];
      const shown = Math.round(f.percent);
      if (h.shown !== shown) {
        if (shown > (h.shown ?? 0)) {
          h.punch = 1;
          if (shown - (h.shown ?? 0) >= 15 && !this.simFast) {
            const floater = this.add.text(h.percent.x, h.percent.y + 28, `+${shown - (h.shown ?? 0)}`, {
              fontFamily: FONT_DISPLAY, fontSize: '18px', color: THEME.goldCss,
            }).setOrigin(1, 0).setScrollFactor(0).setDepth(40);
            this.tweens.add({
              targets: floater, y: floater.y - 28, alpha: 0, duration: 500, ease: 'Quad.easeOut',
              onComplete: () => floater.destroy(),
            });
          }
        }
        h.shown = shown;
      }
      h.percent.setText(`${shown}%`);
      h.percent.setColor(percentColor(f.percent));
      if (h.punch > 0) {
        h.punch = Math.max(0, h.punch - 0.12);
        const s = 1 + 0.35 * h.punch;
        h.percent.setScale(s);
        h.percent.x = (h.percentX ?? h.percent.x) + Math.sin(h.punch * 20) * 3 * h.punch;
      } else if (h.percentX == null) {
        h.percentX = h.percent.x;
      }
      h.stocks.setText('●'.repeat(Math.max(0, f.stocks)) + '○'.repeat(Math.max(0, (this.setup.stocks ?? 3) - f.stocks)));
    });
  }

  // ------------------------------------------------------------ combat glue
  dropProjectileZone(p) {
    if (!p?.move?.dropZone || p.dropped) return;
    p.dropped = true;
    this.spawnZone(p.owner, p.move.dropZone, p.gfx.x, p.gfx.y);
  }

  consumeZones(fighter, spec) {
    if (!this.zones?.length || !spec) return 0;
    let n = 0;
    const radius = spec.radius ?? 140;
    const want = spec.type;
    for (const z of this.zones) {
      if (z.dead || z.owner === fighter) continue;
      const toxic = z.spec?.type === 'chemical' || z.spec?.onHit?.poison;
      if (want && z.spec?.type !== want && !(want === 'chemical' && toxic)) continue;
      const d = Math.hypot(z.x - fighter.x, z.y - (fighter.y - fighter.bodyH * 0.4));
      if (d > radius + (z.radius ?? 0) * 0.4) continue;
      z.dead = true;
      z.gfx?.destroy?.();
      n += 1;
    }
    if (n) {
      fighter.bonusHits = (fighter.bonusHits ?? 0) + n;
      fighter.bonusPacket = {
        type: spec.bonusType ?? 'heat',
        damage: spec.bonus ?? 3,
        hitsName: fighter.charDef?.moves?.basicCharge?.name,
      };
    }
    return n;
  }

  dropPins(fighter) {
    for (const p of this.projectiles ?? []) {
      if (p.pinOwner !== fighter || p.dead) continue;
      p.move = { ...p.move, explodeOnly: false, dropZone: null, igniteAt: 0 };
      p.gfx?.destroy?.();
      p.dead = true;
    }
  }

  sweepMarked(owner, move, already) {
    if (!move?.hitMarked || !owner) return;
    const now = this.time.now;
    for (const target of this.fighters) {
      if (already?.has(target) || target === owner || !target.alive || target.state === 'ko') continue;
      if (target.mark !== move.hitMarked || !(target.markUntil > now)) continue;
      if (target.markedBy !== owner.charDef?.id) continue;
      this.landHit(owner, target, { ...move, hitMarked: null });
    }
  }

  spawnProjectile(owner, move) {
    if (move.rain > 1 && !move._rainChild) {
      const n = move.rain | 0;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : (i / (n - 1) - 0.5);
        this.spawnProjectile(owner, {
          ...move,
          rain: 0,
          _rainChild: true,
          _vy: 260 + (i % 3) * 40,
          projectileSpeed: 70 + Math.abs(t) * 220,
          _flip: t < 0,
        });
      }
      return;
    }
    if (move.fanTypes?.length && !move._fanChild) {
      const types = move.fanTypes;
      const spread = move.fanSpread ?? 200;
      for (let i = 0; i < types.length; i++) {
        const t = types.length === 1 ? 0 : (i / (types.length - 1) - 0.5);
        this.spawnProjectile(owner, {
          ...move, fanTypes: null, _fanChild: true, _vy: t * spread,
          type: types[i], type2: undefined, damage2: undefined,
        });
      }
      return;
    }
    if (move.alsoBehind && !move._behindChild) {
      this.spawnProjectile(owner, { ...move, alsoBehind: false, _behindChild: true });
      this.spawnProjectile(owner, { ...move, alsoBehind: false, _behindChild: true, _flip: true });
      return;
    }
    if (move.fan > 1 && !move._fanChild) {
      const n = move.fan | 0;
      const spread = move.fanSpread ?? 220;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : (i / (n - 1) - 0.5);
        this.spawnProjectile(owner, { ...move, fan: null, _fanChild: true, _vy: t * spread });
      }
      return;
    }
    const style = projectileStyle(move);
    const r = style.radius;
    let vy = move._vy ?? 0;
    if (move.ground) vy = Math.max(vy, 180);
    if (move.lob != null && move._vy == null) {
      const up = typeof move.lob === 'number' ? move.lob : (move.lob.vy ?? 460);
      vy = -Math.abs(up);
    }
    if (!move._vy && move.angleable) {
      if (owner.input?.jump) vy = -240;
      else if (owner.input?.down) vy = 220;
    }
    const face = move._flip ? -owner.facing : owner.facing;
    const x = move._from?.x ?? (owner.x + face * (owner.bodyW / 2 + r + 4));
    let y = move._from?.y ?? (owner.y - owner.bodyH * 0.65);
    if (move.fromAbove) y -= 220;
    if (move._rainChild) y -= 160;
    if (this.simFast) {
      this.projectiles.push({
        gfx: { x, y, destroy() {} },
        owner, move,
        vx: face * move.projectileSpeed,
        vy: move.fromAbove ? (move.fallSpeed ?? 420) : vy,
        dieAt: this.time.now + move.projectileLife,
        born: this.time.now,
        armAt: move.delayMs ? this.time.now + move.delayMs : 0,
        landed: new Set(),
        radius: r,
        spriteW: projectileSpriteSize(move).w,
        spriteH: projectileSpriteSize(move).h,
      });
      return;
    }
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
        orb.fillStyle(fill, 0.4);
        orb.fillEllipse(0, 0, r * 1.7, r * 2.1);
        orb.lineStyle(2, fill, 0.95);
        orb.strokeEllipse(0, 0, r * 1.7, r * 2.1);
        orb.fillStyle(0xfff6e4, 0.7);
        orb.fillCircle(0, -r * 0.15, r * 0.22);
      } else if (style.shape === 'wave') {
        orb.lineStyle(4, fill, 0.9);
        orb.beginPath();
        orb.moveTo(-r, 0);
        orb.lineTo(r, -r * 0.45);
        orb.lineTo(r * 0.2, 0);
        orb.lineTo(r, r * 0.45);
        orb.strokePath();
      } else {
        // Traveling star in the element color. A white ring and a white
        // dot read as a placeholder at any zoom.
        const star = (len, hot) => {
          orb.fillStyle(hot ? 0xfff4d2 : fill, hot ? 0.95 : 0.92);
          for (let i = 0; i < 4; i++) {
            const a = (Math.PI / 2) * i + (hot ? 0.4 : -0.2);
            const L = hot ? len * 0.5 : len;
            orb.fillTriangle(
              Math.cos(a) * L, Math.sin(a) * L,
              Math.cos(a + 0.55) * L * 0.28, Math.sin(a + 0.55) * L * 0.28,
              Math.cos(a - 0.55) * L * 0.28, Math.sin(a - 0.55) * L * 0.28,
            );
          }
        };
        star(r * 1.45, false);
        star(r * 0.75, true);
        orb.fillStyle(fill, 1);
        orb.fillCircle(0, 0, Math.max(2, r * 0.22));
      }
    }
    orb.x = x;
    orb.y = y;

    this.projectiles.push({
      gfx: orb, owner, move,
      vx: face * move.projectileSpeed,
      vy: move.fromAbove ? (move.fallSpeed ?? 420) : vy,
      dieAt: this.time.now + move.projectileLife,
      born: this.time.now,
      armAt: move.delayMs ? this.time.now + move.delayMs : 0,
      landed: new Set(),
      radius: r,
      spriteW: projectileSpriteSize(move).w,
      spriteH: projectileSpriteSize(move).h,
    });
  }

  resolveBurst(owner, move, at) {
    const cx = at?.x ?? owner.x + (owner.facing || 1) * (move.offsetX ?? 0);
    const cy = at?.y ?? owner.y - owner.bodyH / 2;
    playVfx(this, owner, move, 'release', { x: cx, y: cy });

    let hits = 0;
    const struck = new Set();
    for (const target of this.fighters) {
      if (!move.includeSelf && target === owner) continue;
      if (!target.alive || target.state === 'ko') continue;
      if (move.unseen && target !== owner) {
        const ahead = (target.x - owner.x) * (owner.facing || 1);
        const dy = Math.abs((target.y - (target.bodyH ?? 0) * 0.4) - (owner.y - (owner.bodyH ?? 0) * 0.5));
        if (ahead > 30 && dy < 90 && ahead < 340) continue;
      }
      if (hurtHitsCircle(target, cx, cy, move.radius ?? 70)) {
        this.landHit(owner, target, move);
        struck.add(target);
        hits += 1;
      }
    }
    this.sweepMarked(owner, move, struck);
    if (move.missRetry && hits === 0 && !move._retried) {
      this.time.delayedCall(180, () => {
        if (owner.alive) this.resolveBurst(owner, { ...move, _retried: true, missRetry: false });
      });
    }
    if (move.igniteGases && this.zones?.length) {
      const sparks = [];
      for (const z of this.zones) {
        if (z.dead) continue;
        const reach = (move.radius ?? 80) + (z.radius ?? 0);
        if (Phaser.Math.Distance.Between(cx, cy, z.x, z.y) <= reach) {
          sparks.push({ x: z.x, y: z.y, radius: Math.max(36, (z.radius ?? 40) * 0.65) });
        }
      }
      for (const s of sparks) {
        this.resolveBurst(owner, {
          ...move,
          igniteGases: false,
          bonusVsState: null,
          type: 'heat',
          damage: move.gasCloud ?? 6,
          type2: undefined,
          damage2: undefined,
          radius: s.radius,
          chain: null,
          zone: null,
        }, { x: s.x, y: s.y });
      }
    }
    if (move.chain && !move._chained) {
      const spots = move.chain.fromHits && struck.size
        ? [...struck].map((f) => ({ x: f.x, y: f.y - (f.bodyH ?? 80) * 0.4 }))
        : [null];
      for (const spot of spots) {
        for (let i = 1; i <= move.chain.count; i++) {
          const echo = {
            ...move,
            _chained: true,
            chain: null,
            unseen: false,
            damage: move.chain.damage ?? (move.damage ?? 0) * (move.chain.scale ?? 0.6),
            damage2: move.chain.type ? undefined : move.damage2,
            type: move.chain.type ?? move.type,
            type2: move.chain.type ? undefined : move.type2,
            radius: (move.radius ?? 70) * (move.chain.radiusScale ?? (0.7 + i * 0.15)),
          };
          this.time.delayedCall((move.chain.delay ?? 160) * i, () => {
            if (owner.alive) this.resolveBurst(owner, echo, spot || undefined);
          });
        }
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
    const struck = new Set();
    for (const target of this.fighters) {
      if (target === owner || !target.alive || target.state === 'ko') continue;
      if (hurtHitsRect(target, rect)) {
        this.landHit(owner, target, move, owner.facing);
        struck.add(target);
      }
    }
    this.sweepMarked(owner, move, struck);
  }

  spawnZone(owner, spec, x, y) {
    const radius = spec.radius ?? 70;
    if (this.simFast) {
      this.zones.push({
        owner, spec, x, y, radius,
        gfx: { destroy() {} },
        until: this.time.now + (spec.ms ?? 1600),
        next: this.time.now + (spec.delay ?? 0),
      });
      return;
    }
    const color = spec.color ?? 0xff8844;
    const gfx = this.add.circle(x, y, radius, color, 0.28);
    gfx.setStrokeStyle?.(2, color, 0.8);
    this.zones.push({
      owner, spec, x, y, radius, gfx,
      until: this.time.now + (spec.ms ?? 1600),
      next: this.time.now + (spec.delay ?? 0),
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
      if (z.spec.cleanseOwner && z.owner && !z.cleansed) {
        const rect = z.owner.getHurtboxRect?.();
        if (rect) {
          const nx = Phaser.Math.Clamp(z.x, rect.left, rect.right);
          const ny = Phaser.Math.Clamp(z.y, rect.top, rect.bottom);
          if (Phaser.Math.Distance.Between(z.x, z.y, nx, ny) <= z.radius) {
            z.cleansed = true;
            cleanse(z.owner, z.spec.cleanseOwner);
          }
        }
      }
      const tickDamage = z.tickDamage ?? z.spec.damage;
      z.tickDamage = (tickDamage ?? 0) + (z.spec.ramp ?? 0);
      for (const target of this.fighters) {
        if (target === z.owner || !target.alive || target.state === 'ko') continue;
        if (!hurtHitsCircle(target, z.x, z.y, z.radius)) continue;
        this.landHit(z.owner, target, {
          name: z.spec.name ?? 'zone',
          type: z.spec.type,
          damage: tickDamage,
          baseKnockback: z.spec.knockback ?? 40,
          knockbackGrowth: z.spec.growth ?? 0.4,
          onHit: z.spec.onHit,
          bonusVsId: z.spec.bonusVsId,
          kind: 'burst',
          hitlagMult: 0,
          _projectile: true,
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
    const roundMap = (bag) => {
      const out = {};
      for (const [type, amount] of Object.entries(bag ?? {})) out[type] = Math.round(amount);
      return out;
    };
    const fighters = this.fighters.map((f) => ({
      id: f.charDef.id,
      name: f.charDef.name,
      stocks: f.stocks,
      percent: Math.round(f.percent),
      kos: f.kos,
      damageDealt: Math.round(f.damageDealt),
      damageTaken: Math.round(f.damageTaken),
      dealtByType: roundMap(f.dealtByType),
      takenByType: roundMap(f.takenByType),
      alive: f.alive,
    }));
    const ranked = [...fighters].sort((a, b) => (b.stocks - a.stocks) || (a.percent - b.percent) || (b.damageDealt - a.damageDealt));
    const now = this.simNow ?? this.time.now;
    return {
      stage: this.stage.id,
      matchStart: Math.round(this.matchStart ?? 0),
      elapsedMs: Math.round(now - (this.matchStart ?? now)),
      winner: ranked[0]?.name ?? null,
      winnerId: ranked[0]?.id ?? null,
      fighters,
      movesFired: this.matchReport.movesFired,
      hits: this.matchReport.hits,
      kos: this.matchReport.kos,
      errors: this.matchReport.errors,
      fallThroughs: this.matchReport.fallThroughs,
      lowestY: Object.fromEntries(Object.entries(this.lowestY).map(([id, y]) => [id, Math.round(y)])),
      seed: this.setup.seed ?? null,
      collisionMs: Math.round((this.collisionMs || 0) * 100) / 100,
      collisionSteps: this.collisionSteps || 0,
      collisionUs: this.collisionSteps ? Math.round((this.collisionMs * 1000) / this.collisionSteps) : 0,
    };
  }

  publishPlaytestReport() {
    if (this.reportPublished) return;
    this.reportPublished = true;
    const report = this.buildPlaytestReport();
    window.__akReport = report;
    console.log(`AK_REPORT ${JSON.stringify(report)}`);
    window.__akResolve?.(report);
  }

  landHit(attacker, victim, move, launchDir) {
    const dmg = victim.takeHit(attacker, move, this.time.now, launchDir);
    if (dmg > 0) this.noteHit(attacker, victim, move);
    if (attacker !== victim) victim.lastHitBy = attacker;
    // Hitlag lives on the fighters (feel.js). The world clock keeps moving
    // so other players, projectiles and the stage do not freeze.
  }

  beginFinish(victim, info) {
    if (this.simFast || this.finishing) return;
    this.finishing = true;
    const finalBlow = !!(info?.final);
    this.finishFinal = finalBlow;
    // Hold the hit, then drop into slow motion. The zoom tracks the victim.
    this.timeScale = 0;
    this.freezeLeft = FEEL.koFreezeFrames;
    this.finishLeft = finalBlow ? FEEL.koSlowFrames : FEEL.stockSlowFrames;
    this.koZoom = FEEL.koZoom;
    this.koVictim = victim;
    this.koPoint = { x: victim.x, y: victim.y - victim.bodyH * 0.5 };
    this.juice?.addTrauma(0.7);
    const color = info?.charged && !finalBlow ? 0x16325a : (finalBlow ? 0xff3a2a : 0x3a6cff);
    this.juice?.koMoment(color, this.blastSide(victim));
    if (!this.simFast) sfx('koHit');
  }

  /** Which screen edge a launch is heading for. */
  blastSide(victim) {
    const blast = this.blast;
    if (blast) {
      const scores = [
        ['left', victim.x - blast.left],
        ['right', blast.right - victim.x],
        ['top', victim.y - blast.top],
        ['bottom', blast.bottom - victim.y],
      ];
      scores.sort((a, b) => a[1] - b[1]);
      return scores[0][0];
    }
    const vx = victim.body?.velocity?.x || 0;
    const vy = victim.body?.velocity?.y || 0;
    if (Math.abs(vx) >= Math.abs(vy)) return vx < 0 ? 'left' : 'right';
    return vy < 0 ? 'top' : 'bottom';
  }

  hitSpark(x, y) {
    if (this.simFast) return;
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
  // One rendered frame. Gameplay itself is runSimSteps at a fixed 60 Hz.
  // Fast sims ignore this and get pumped by the tournament driver.
  update() {
    if (this.simFast) return;
    const raw = this.game.loop.rawDelta || this.stepMs;
    this.present(Math.min(raw, this.stepMs * 5));
  }

  /** One rendered frame. Slow-motion scales how much sim time it contains. */
  captureFrame() {
    this.present(this.stepMs);
  }

  present(dt) {
    this.visualT += dt / 1000;
    if (this.freezeLeft > 0) {
      this.timeScale = 0;
      this.freezeLeft -= 1;
      if (this.freezeLeft <= 0) {
        this.timeScale = this.finishFinal ? FEEL.koSlow : FEEL.stockSlow;
      }
    } else if (this.finishLeft > 0) {
      this.finishLeft -= 1;
      if (this.finishLeft <= 0) {
        this.ramping = FEEL.koRampFrames;
        this.koZoom = null;
        this.koPoint = null;
        this.koVictim = null;
      }
    } else if (this.ramping > 0) {
      this.ramping -= 1;
      const t = 1 - this.ramping / FEEL.koRampFrames;
      const from = this.timeScale < 0.4 ? FEEL.koSlow : FEEL.stockSlow;
      this.timeScale = from + (1 - from) * t;
      if (this.ramping <= 0) {
        this.timeScale = 1;
        this.finishing = false;
      }
    }
    if (this.tweens) this.tweens.timeScale = this.timeScale || 1;
    this.tickAccum += dt * (this.timeScale || 1);
    let guard = 0;
    while (this.tickAccum >= this.stepMs && guard < 5) {
      this.tickAccum -= this.stepMs;
      this.runSimSteps(1);
      guard++;
    }
    this.renderInterp();
    for (const f of this.fighters || []) f.tickHitFlash?.();
    this.juice?.update(dt / 1000);
    this.juice?.syncStrikes?.();
    this.drawDebug();
    if (!this.simFast) this.updateCamera(dt);
  }

  drawDebug() {
    if (!this.boxGfx) return;
    this.boxGfx.clear();
    if (!this.showBoxes) return;
    for (const f of this.fighters || []) {
      if (!maskShown(f)) continue;
      this.boxGfx.fillStyle(0x3dff7a, 0.38);
      for (const r of debugCells(f)) this.boxGfx.fillRect(r.x, r.y, r.w, r.h);
      const push = f.getPushbox?.();
      if (push) {
        this.boxGfx.lineStyle(2, 0x4aa3ff, 0.95);
        this.boxGfx.strokeRect(push.x, push.y, push.width, push.height);
      }
      this.boxGfx.fillStyle(0xff4040, 0.55);
      for (const r of debugHitCells(f)) this.boxGfx.fillRect(r.x, r.y, r.w, r.h);
      const slash = slashPolyline(f, 14);
      if (slash?.pts?.length) {
        this.boxGfx.lineStyle(Math.max(3, slash.thick * 0.35), 0xff4040, 0.95);
        this.boxGfx.beginPath();
        slash.pts.forEach((p, i) => (i ? this.boxGfx.lineTo(p.x, p.y) : this.boxGfx.moveTo(p.x, p.y)));
        this.boxGfx.strokePath();
      }
    }
    for (const p of this.projectiles || []) {
      if (p.dead || !p.gfx) continue;
      this.strokeProjectile(p);
    }
  }

  strokeProjectile(p) {
    const shape = projectileShape(p);
    this.boxGfx.lineStyle(2, 0xff4040, 1);
    if (shape.kind === 'poly') {
      const c = Math.cos(shape.rot || 0);
      const s = Math.sin(shape.rot || 0);
      this.boxGfx.beginPath();
      shape.points.forEach((pt, i) => {
        const x = shape.x + pt[0] * c - pt[1] * s;
        const y = shape.y + pt[0] * s + pt[1] * c;
        if (i) this.boxGfx.lineTo(x, y);
        else this.boxGfx.moveTo(x, y);
      });
      this.boxGfx.closePath();
      this.boxGfx.strokePath();
      return;
    }
    this.boxGfx.strokeEllipse(shape.x, shape.y, (shape.rx || 8) * 2, (shape.ry || 8) * 2);
  }

  renderInterp() {
    const alpha = this.stepMs ? Math.min(1, Math.max(0, this.tickAccum / this.stepMs)) : 1;
    for (const f of this.fighters || []) {
      if (f.prevX == null || !f.rig) continue;
      f.rig.x = (f.prevX + (f.x - f.prevX) * alpha) - f.x + (f._shakeX || 0);
      f.rig.y = (f.prevY + (f.y - f.prevY) * alpha) - f.y + (f._shakeY || 0);
    }
  }

  // One tick of the shared clock: timers, then Phaser's own world update
  // (a single integration — preUpdate already moves the body, so nothing
  // here may call world.step() as well), then hit detection.
  runSimSteps(count) {
    const stepMs = this.stepMs;
    const n = count ?? this.simSpeed;
    const world = this.physics.world;
    for (let i = 0; i < n; i++) {
      if (this.reportPublished) return;
      for (const f of this.fighters || []) {
        f.prevX = f.x;
        f.prevY = f.y;
      }
      this.simNow += stepMs;
      this.time.preUpdate();
      this.time.timeScale = 1;
      this.time.update(this.simNow, stepMs);
      this.time.timeScale = 0;
      if (!this.matchOver) {
        world._elapsed = 0;
        world.update(this.simNow, stepMs);
      }
      this.stepMatch(this.simNow, stepMs);
      world.postUpdate();
    }
  }

  stepMatch(time, delta) {
    if (!this.simFast) {
      this.updateAmbient(time, delta);
      this.updateParallax(delta);
    }
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
    const introLocked = this.intro?.active || this.simNow < this.introLockUntil;
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
    const collisionStart = globalThis.performance.now();
    resolvePush(this.fighters);
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
          if (hurtHitsRect(target, rect)) {
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
      if (!attacker.activeHit) continue;
      for (const victim of this.fighters) {
        if (victim === attacker || !victim.alive || victim.state === 'ko' || !victim.visible) continue;
        const hit = attacker.activeHit;
        if (!hit) break;
        if (hit.landed.has(victim)) continue;
        if (hit.next && time < (hit.next.get(victim) ?? 0)) continue;
        if (strikeHits(attacker, victim)) {
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
            const hb = attacker.getHitboxRect();
            const tip = hb ? (hit.dir === 1 ? hb.right : hb.left) : attacker.x;
            if (hb && Math.abs(victim.x - tip) < hb.width * 0.38) {
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
      if (p.move.lob && !p.pinned) {
        const g = typeof p.move.lob === 'object' ? (p.move.lob.g ?? 1200) : 1200;
        p.vy += g * delta / 1000;
      }
      if (p.move.arc && !p.pinned && p.vy) {
        p.vy += Math.sign(p.vy) * p.move.arc * delta / 1000;
      }
      if (p.move.dragMetals && !p.pinned) {
        const reach = p.move.dragRadius ?? 88;
        for (const f of this.fighters) {
          if (f === p.owner || !f.alive || !f.body || !f.charDef?.combat?.metal) continue;
          if (Math.hypot(f.x - p.gfx.x, (f.y - f.bodyH * 0.5) - p.gfx.y) > reach) continue;
          f.body.setVelocityX(f.body.velocity.x * 0.82 + p.vx * 0.18);
          f.body.setVelocityY(f.body.velocity.y * 0.9 + p.vy * 0.06);
        }
      }
      if (p.move.homing && !p.pinned) {
        let best = null;
        let bestD = Infinity;
        for (const f of this.fighters) {
          if (f === p.owner || !f.alive || f.state === 'ko' || f.state === 'dead') continue;
          const d = Math.hypot(f.x - p.gfx.x, (f.y - f.bodyH * 0.5) - p.gfx.y);
          if (d < bestD) { bestD = d; best = f; }
        }
        if (best) {
          const speed = Math.hypot(p.vx, p.vy) || p.move.projectileSpeed || 300;
          const dx = best.x - p.gfx.x;
          const dy = (best.y - best.bodyH * 0.5) - p.gfx.y;
          const len = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, (p.move.homing === true ? 4 : p.move.homing) * delta / 1000);
          p.vx += ((dx / len) * speed - p.vx) * k;
          p.vy += ((dy / len) * speed - p.vy) * k;
        }
      }
      if (!p.pinned) {
        for (const f of this.fighters) {
          const reach = f.state === 'defending' ? f.defenseMove?.pinProjectiles : 0;
          if (!reach || f === p.owner || !f.alive) continue;
          if (Math.hypot(f.x - p.gfx.x, (f.y - f.bodyH * 0.5) - p.gfx.y) > reach) continue;
          p.pinned = true;
          p.pinOwner = f;
          p.vx = 0;
          p.vy = 0;
          p.move = { ...p.move, damage: 0, damage2: 0, explodeOnly: false, dropZone: null, igniteAt: 0, homing: 0 };
          break;
        }
      }
      if (!p.dead) {
        for (const f of this.fighters) {
          const pull = f.state === 'attack' && f.currentMove?.attractProjectiles;
          if (!pull || f === p.owner || !f.alive) continue;
          if (Math.abs(f.x - p.gfx.x) > 220 || Math.abs(f.y - p.gfx.y) > 160) continue;
          p.vx += Math.sign(f.x - p.gfx.x || 1) * pull;
          p.vy += Math.sign((f.y - f.bodyH * 0.5) - p.gfx.y || 1) * pull * 0.35;
          if (Math.abs(f.x - p.gfx.x) < 28 && Math.abs((f.y - f.bodyH * 0.5) - p.gfx.y) < 40) {
            p.gfx.destroy();
            p.dead = true;
          }
          break;
        }
      }
      if (p.dead) continue;
      if (!p.slowed) {
        for (const f of this.fighters) {
          if (f.state !== 'defending' || !f.defenseMove?.slowProjectiles) continue;
          if (Math.abs(f.x - p.gfx.x) < 110 && Math.abs(f.y - p.gfx.y) < 110) {
            const mul = f.defenseMove.slowProjectiles;
            p.vx *= mul;
            p.vy *= mul;
            p.slowed = true;
            break;
          }
        }
      }
      if (p.move.orbitMs && !p.orbited && time < p.born + p.move.orbitMs && p.owner?.alive) {
        const ang = ((time - p.born) / p.move.orbitMs) * Math.PI * 2;
        const rad = p.move.orbitRadius ?? 52;
        p.gfx.x = p.owner.x + Math.cos(ang) * rad;
        p.gfx.y = p.owner.y - (p.owner.bodyH ?? 80) * 0.5 + Math.sin(ang) * rad * 0.45;
        p.vx = (p.owner.facing || 1) * (p.move.projectileSpeed ?? 400);
        p.vy = 0;
      } else if (p.move.orbitMs && !p.orbited) {
        p.orbited = true;
      }
      if (p.move.pulse && !p.pinned && time >= (p.pulseAt ?? p.born)) {
        p.pulseAt = time + (p.move.pulse.every ?? 400);
        if (time > p.born + 40) {
          this.resolveBurst(p.owner, {
            name: p.move.name,
            type: p.move.pulse.type ?? p.move.type,
            damage: p.move.pulse.damage ?? 2,
            radius: p.move.pulse.radius ?? 48,
            baseKnockback: 30,
            knockbackGrowth: 0.4,
            kind: 'burst',
          }, { x: p.gfx.x, y: p.gfx.y });
        }
      }
      if (p.pinned) p.gfx.y += (90 * delta) / 1000;
      else if (!(p.move.orbitMs && !p.orbited && time < p.born + p.move.orbitMs)) {
        p.gfx.x += (p.vx * delta) / 1000;
        p.gfx.y += (p.vy * delta) / 1000 + Math.sin(time / 90) * 0.25;
      }
      if (p.move.ricochet && !p.pinned) {
        const cap = p.move.ricochet === true ? 2 : p.move.ricochet;
        if ((p.bounces ?? 0) < cap) {
          const solids = (this.stage?.solids ?? []).filter((s) => s.h == null);
          const deck = solids.find((s) => p.gfx.x >= s.x - s.w / 2 - 8 && p.gfx.x <= s.x + s.w / 2 + 8);
          if (deck) {
            const left = deck.x - deck.w / 2 + 16;
            const right = deck.x + deck.w / 2 - 16;
            if (p.gfx.x < left || p.gfx.x > right) {
              p.vx *= -1;
              p.gfx.x = Phaser.Math.Clamp(p.gfx.x, left, right);
              p.bounces = (p.bounces ?? 0) + 1;
              p.landed = new Set();
            }
          }
        }
      }
      const off = p.gfx.x < -80 || p.gfx.x > this.world.width + 80 || p.gfx.y > this.world.height + 80;
      if (time > p.dieAt || off) {
        if (p.move.explodeOnly && !p.pinned) this.resolveBurst(p.owner, { ...p.move, radius: p.move.explodeRadius ?? 70, kind: 'burst' }, { x: p.gfx.x, y: p.gfx.y });
        if (!p.pinned) this.dropProjectileZone(p);
        p.gfx.destroy();
        p.dead = true;
        continue;
      }
      if (p.move.igniteAt && !p.ignited && !p.pinned && time >= p.born + p.move.projectileLife * p.move.igniteAt) {
        p.ignited = true;
        this.resolveBurst(p.owner, {
          ...p.move,
          kind: 'burst',
          type: p.move.igniteType ?? 'heat',
          damage: p.move.igniteDamage ?? p.move.damage,
          type2: undefined,
          damage2: undefined,
          radius: p.move.igniteRadius ?? 52,
          igniteAt: 0,
          onHit: p.move.igniteOnHit ?? p.move.onHit,
        }, { x: p.gfx.x, y: p.gfx.y });
        p.gfx.destroy();
        p.dead = true;
        continue;
      }
      if (p.pinned || (p.armAt && time < p.armAt)) continue;
      for (const victim of this.fighters) {
        if (victim === p.owner || !victim.alive || victim.state === 'ko' || !victim.visible || p.landed.has(victim)) continue;
        if (!projectileHits(p, victim)) continue;
        const def = victim.defenseMove;
        const perfect = def?.reflectProjectiles === 'perfect'
          && time - (victim.defenseStart ?? time) <= (def.perfectMs ?? 200);
        const metalShot = !!(p.owner?.charDef?.combat?.metal);
        const reflect = def?.reflectProjectiles === true || perfect || (def?.reflectMetals && metalShot);
        if (victim.state === 'defending' && reflect) {
          this.landHit(victim, p.owner, p.move, -Math.sign(p.vx) || victim.facing);
          p.gfx.destroy();
          p.dead = true;
          break;
        }
        p.landed.add(victim);
        let shot = p.move;
        if (shot.tipBonus && p.owner && Math.abs(p.gfx.x - p.owner.x) >= (shot.tipAt ?? 260)) {
          shot = { ...shot, damage: (shot.damage ?? 0) + shot.tipBonus };
        }
        if (shot.slowHit) {
          const sp = Math.hypot(p.vx, p.vy);
          const mul = Math.min(2.2, 280 / Math.max(80, sp));
          shot = { ...shot, damage: (shot.damage ?? 0) * mul, damage2: shot.damage2 != null ? shot.damage2 * mul : shot.damage2 };
        }
        if (victim.state === 'defending' && victim.defenseMove?.softenProjectiles) {
          const mul = victim.defenseMove.softenProjectiles;
          shot = { ...shot, damage: (shot.damage ?? 0) * mul, damage2: shot.damage2 != null ? shot.damage2 * mul : shot.damage2 };
        }
        if (p.move.explodeOnly) {
          this.resolveBurst(p.owner, { ...p.move, radius: p.move.explodeRadius ?? 70, kind: 'burst' }, { x: p.gfx.x, y: p.gfx.y });
          p.gfx.destroy();
          p.dead = true;
          break;
        }
        // a projectile shoves you the way it was travelling
        this.landHit(p.owner, victim, { ...shot, _projectile: true }, Math.sign(p.vx) || p.owner.facing);
        this.dropProjectileZone(p);
        if (p.move.splitOnHit && !p._splitChild && p.owner) {
          const spread = p.move.splitSpread ?? 150;
          const child = {
            ...p.move,
            splitOnHit: null,
            damage: p.move.splitDamage ?? p.move.damage,
            delayMs: 40,
            _splitChild: true,
            _from: { x: p.gfx.x + Math.sign(p.vx || 1) * 18, y: p.gfx.y },
          };
          this.spawnProjectile(p.owner, { ...child, _vy: -spread * 0.35 });
          this.spawnProjectile(p.owner, { ...child, _vy: spread * 0.35 });
          p._splitChild = true;
        }
        if (!p.move.pierce) {
          p.gfx.destroy();
          p.dead = true;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.collisionMs += globalThis.performance.now() - collisionStart;
    this.collisionSteps += 1;

    // blast zones
    for (const f of this.fighters) {
      if (!f.alive || f.state === 'ko' || f.state === 'dead') continue;
      const b = this.blast;
      const low = this.lowestY[f.charDef.id];
      if (low == null || f.y > low) this.lowestY[f.charDef.id] = f.y;
      if (f.x < b.left || f.x > b.right || f.y > b.bottom || f.y < b.top) {
        // A stock lost with essentially no damage is the floor-tunnel signature.
        if ((f.damageTaken ?? 0) < 5 && f.percent < 5) {
          this.matchReport.fallThroughs.push({
            victim: f.charDef.id,
            y: Math.round(f.y),
            t: Math.round(time),
          });
        }
        this.koBlast(f);
        const killer = this.lastAttackerOf(f);
        if (killer) killer.kos += 1;
        this.matchReport?.kos.push({
          victim: f.charDef.id,
          killer: killer?.charDef.id ?? null,
          t: Math.round(time),
          percent: Math.round(f.percent),
        });
        f.loseStock();
      }
    }

    if (!this.simFast) this.updateHud();
    this.checkWin();
  }

  lastAttackerOf(victim) {
    // Whoever last actually hit them, tracked in landHit() — falls back to
    // "the other fighter" only for an un-hit blast-zone wander in 1v1.
    if (victim.lastHitBy && victim.lastHitBy !== victim && victim.lastHitBy.alive) return victim.lastHitBy;
    return this.fighters.find((f) => f !== victim && f.alive) ?? null;
  }

  koBlast(f) {
    if (this.simFast) return;
    sfx('ko');
    sfx('cheer');
    this.juice?.koLine(f);
    this.juice?.addTrauma(0.5);
    // The exit burst is juice.koLine plus the screen-edge flash from
    // beginFinish. Both fade on the render clock, including while a
    // capture has the Phaser tween clock asleep.
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
    if (this.hud) {
      for (const h of this.hud) {
        h.percent?.setVisible(false);
        h.stocks?.setVisible(false);
        h.name?.setVisible(false);
      }
    }

    this.time.delayedCall(600, () => {
      const banner = this.asUi(() => this.add.text(W / 2, H / 2 - 40, 'GAME!', {
        fontFamily: FONT_DISPLAY, fontSize: '96px', color: THEME.goldCss,
        stroke: THEME.voidCss, strokeThickness: 10,
      }).setOrigin(0.5).setScale(0.2));
      this.tweens.add({ targets: banner, scale: 1, duration: 320, ease: 'Back.Out' });
    });

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
        showScene(this, 'Results', { results, setup: this.setup });
      } else {
        // pre-M4 fallback: restart the match
        this.scene.restart();
      }
    });
  }
}
