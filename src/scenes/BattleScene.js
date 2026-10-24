import * as Phaser from 'phaser';
import Fighter from '../engine/Fighter.js';
import { CHARACTERS } from '../data/characters.js';
import { STAGES, stageKey, getStageBlast, getStageSpawns, getStageBounds, getStageWorld, loadStageArt, moverPosition } from '../data/stages.js';
import { play as sfx, preload as preloadSfx } from '../engine/sfx.js';
import { beginMatchWarmup } from '../engine/matchWarmup.js';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { showScene } from '../ui/flow.js';
import { FONT_DISPLAY, FONT_MONO, PLAYER_COLORS, THEME, drawCard, drawPortraitDisc } from '../ui/theme.js';
import { faceFrame, menuPortraitKey } from '../ui/portraits.js';
import { showGameBanner } from '../ui/banners.js';
import { phoneNet } from '../net/PhoneNet.js';
import { fighterInputForSlot, isGamepadSlot, padBySlot, pollGamepads, rumbleSlot } from '../engine/gamepad.js';
import { computeBotInput } from '../engine/BotAI.js';
import { buildNavGraph } from '../engine/BotNav.js';
import { defaultStageIntro, startStageIntro } from '../engine/stageIntros.js';
import { playVfx, projectileStyle, syncChargeGlow } from '../engine/MoveVfx.js';
import { paintShot, syncMoveFx, tickChargeOrbits } from '../engine/moveFx.js';
import { syncCoats } from '../engine/coatView.js';
import { syncAuras } from '../engine/auraView.js';
import { applyDot, applyOnHit, cleanse, fighterInView, fighterOnSwapLine, markedStrikeTargets, sheetFrameAt, slowHitScale, withRedFrame, withShatter } from '../engine/kit.js';
import { resolvePacket } from '../data/balance.js';
import { fanVelocity, inPinZone, MINE_SHARDS, nearestInFront } from '../engine/batch3.js';
import { mulberry32 } from '../engine/rng.js';
import { hudLayout, fitLabelSize } from '../ui/hudLayout.js';
import { Juice } from '../engine/juice.js';
import { FEEL, cameraFrame, containFrame, openingZoom, percentColor } from '../engine/feel.js';
import { clockEndsRound } from '../engine/matchRules.js';
import { clipBeam, segmentHitsSolid, stageSolids } from '../engine/beamClip.js';
import { shotEndOf, shotIgnoresGround, shotRemovedOnFighter, shotStoppedBySolid } from '../engine/shotEnd.js';
import {
  resolvePush, pushSolids, resolveGrab, projectileSpriteSize, hurtHitsCircle, hurtHitsRect, strikeHits, projectileHits,
  debugCells, debugHitCells, debugDashCells, slashPolyline, slashRibbon, projectileShape, maskShown,
} from '../engine/boxes.js';
import { artFor, beamDrawScale, cloudIgnitionScale, collectFxArt, flareEmbers, fxAnchor, fxBurstHits, fxFrameIndex, fxNamed, fxProjectileView, fxWallTest, groundTop, handheldUnit, overhandToss, placeFxImage, rodOrbitPoint, spawnContactFx, spawnFlareShower, spawnFxDetonate, spawnFxSprite, spawnJumpArc, spawnMoveExtra, stepFxProjectile, stepPlacedFx, stickAim, syncFxActors, throwGrowth, tickGeysers } from '../engine/fxArt.js';
import { bodySheetMuzzle, sheetFxPoint, sheetReleasePoint } from '../engine/moveSheet.js';
import { loadRosterArt, registerSheetAnims, repackOversizedSheets } from './BootScene.js';

const GRAVITY = 1500;
const HUD_DEPTH = 950; // under the match cards (1000), over everything in the arena

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

  preload() {
    // The tournament starts Battle and steps it before the loader can finish.
    // Fast sims only need the portraits Boot already fetched.
    if ((this.setup?.simSpeed || 1) > 1) return;
    const roster = (this.setup?.players || [])
      .map((p) => CHARACTERS[p.charId])
      .filter(Boolean);
    loadRosterArt(this.load, roster, (key) => this.textures.exists(key));
    // One arena. Boot only fetched thumbnails, so the painted layers, the
    // terrain, and the intro doors arrive with this match.
    loadStageArt(this.load, [this.stage], (key) => this.textures.exists(key));
    // Decode hits and effects while the loader is still on the sheets, so
    // the match card is not the first thing to touch them.
    preloadSfx();
    void collectFxArt(this, roster);
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
    const roster = (this.setup?.players || [])
      .map((p) => CHARACTERS[p.charId])
      .filter(Boolean);
    registerSheetAnims(this, roster);
    if (!this.setup.playtestMs) repackOversizedSheets(this, roster);
    this.spawnFighters();
    this.asUi(() => this.buildHud());
    if (this.camRig) this.offscreenG = this.asUi(() => this.add.graphics().setDepth(900));
    this.updateCamera(0);
    this.bindKeyboard();

    this.projectiles = [];
    this.beams = [];
    this.lingeringWalls = [];
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
    if (!this.simFast) preloadSfx();
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
    // Headless rounds publish a report when the stock rules end them.
    // playtestMs marks that match. It is not a clock, and it must not
    // name a winner when time runs out.
    if (this.setup.playtestMs) window.__akReport = null;

    // Per-stage match intro (engine/stageIntros.js): fighters are frozen
    // while it plays (+200ms so a skip press can't become an attack);
    // confirm (F/K/Enter/Space, phone attack) or a click skips the hold.
    // The card stays up until sheets, FX, and the colorway shader have been
    // uploaded, including on a playtest URL. A fast sim skips that beat.
    this.introLockUntil = 0;
    this.roundLive = false;
    if (!this.simFast) this.matchWarmup = beginMatchWarmup(this);
    this.intro = this.simFast ? null : startStageIntro(this, {
      ...this.stage,
      intro: defaultStageIntro(this.stage),
    }, {
      // Stamp the sim clock. Phaser writes the loop timestamp into time.now
      // on every frame while our clock scale is 0, and the doors' "GO" tween
      // finishes on that frame — so time.now here is how long the game has
      // been open, not how long the round has been running. A match started
      // from the menus would stay input-locked until sim time caught up.
      onDone: () => {
        this.introLockUntil = this.simNow + 200;
        this.roundLive = true;
      },
    });
    if (!this.intro) this.roundLive = true;
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
    const whole = Math.max(W / WW, H / WH);
    // Big painted stages stop at the whole world so the art still covers
    // the view. A normal stage can open a little past its edges, into the
    // blast zone, when a fighter is up there.
    const blast = this.blast || { left: 0, top: 0, right: WW, bottom: WH };
    const bounds = this.stage.camera
      ? { left: 0, top: 0, right: WW, bottom: WH }
      : {
        left: Math.min(0, blast.left),
        top: Math.min(0, blast.top),
        right: Math.max(WW, blast.right),
        bottom: Math.max(WH, blast.bottom),
      };
    const blastFit = Math.min(W / (bounds.right - bounds.left), H / (bounds.bottom - bounds.top));
    const minZoom = this.stage.camera
      ? Math.min(1, Math.max(whole, stageCam.minZoom ?? 0))
      : Math.min(whole, Math.max(blastFit, 0.5));
    const maxZoom = Math.max(minZoom, cap);
    const startZoom = openingZoom(minZoom, maxZoom);
    this.camRig = {
      cfg, minZoom, maxZoom, bounds,
      zoom: startZoom, cx: WW / 2, cy: WH / 2, first: true, uiMode: false,
    };
    const main = this.cameras.main;
    const sky = this.stage.theme?.skyTop;
    if (sky != null) main.setBackgroundColor(sky);
    main.setBounds(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top)
      .setZoom(startZoom).centerOn(WW / 2, WH / 2);
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

  // Frame every live fighter. Standard zoom is the baseline; zoom in only
  // when the group is close, and zoom out when that would crop someone.
  // Hits and KOs do not change zoom. The center and zoom ease; zooming out
  // is quicker than zooming in. A hard contain keeps a fast launch on
  // screen while the frame catches up. The view never leaves the world.
  updateCamera(delta) {
    const rig = this.camRig;
    if (!rig) return;
    const { width: WW, height: WH } = this.world;
    const cfg = rig.cfg;
    const live = (this.fighters ?? []).filter((f) => f.alive && f.visible && f.state !== 'ko' && f.state !== 'dead');
    const bodies = live.map((f) => ({ x: f.x, y: f.y, w: f.bodyW, h: f.bodyH }));
    let tz = rig.minZoom;
    let tx = WW / 2;
    let ty = WH / 2;
    const frame = cameraFrame(bodies, W, H, rig.minZoom, rig.maxZoom, {
      padX: cfg.padX, padTop: cfg.padTop, padBottom: cfg.padBottom,
    });
    if (frame) {
      tz = frame.zoom;
      tx = frame.cx;
      ty = frame.cy;
      const dead = (W / Math.max(rig.zoom, 0.2)) * FEEL.camDead;
      if (Math.abs(tx - rig.cx) < dead) tx = rig.cx;
      if (Math.abs(ty - rig.cy) < dead) ty = rig.cy;
    }
    const first = rig.first;
    rig.first = false;
    const zMs = tz < rig.zoom
      ? (cfg.zoomOutMs ?? FEEL.camZoomOutTau)
      : (cfg.zoomInMs ?? FEEL.camZoomInTau);
    rig.zoom += (tz - rig.zoom) * (first ? 1 : 1 - Math.exp(-Math.max(0, delta) / zMs));
    const k = first ? 1 : 1 - Math.exp(-Math.max(0, delta) / (cfg.lerpMs ?? 200));
    rig.cx += (tx - rig.cx) * k;
    rig.cy += (ty - rig.cy) * k;
    if (bodies.length) {
      const edge = FEEL.camEdge;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const b of bodies) {
        x0 = Math.min(x0, b.x - b.w / 2 - edge);
        x1 = Math.max(x1, b.x + b.w / 2 + edge);
        y0 = Math.min(y0, b.y - b.h - edge);
        y1 = Math.max(y1, b.y + edge * 0.5);
      }
      const held = containFrame(rig.zoom, rig.cx, rig.cy, { x0, y0, x1, y1 }, W, H, rig.minZoom);
      rig.zoom = held.zoom;
      rig.cx = held.cx;
      rig.cy = held.cy;
    }
    const hw = W / (2 * rig.zoom);
    const hh = H / (2 * rig.zoom);
    const b = rig.bounds;
    rig.cx = Phaser.Math.Clamp(rig.cx, b.left + hw, Math.max(b.left + hw, b.right - hw));
    rig.cy = Phaser.Math.Clamp(rig.cy, b.top + hh, Math.max(b.top + hh, b.bottom - hh));
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
    // Cover the blast zone too, so a zoom-out that follows a high launch
    // still has sky instead of a hard edge at the top of the stage.
    const blast = this.blast || { left: 0, top: 0, right: W, bottom: H };
    const x0 = Math.min(0, blast.left);
    const y0 = Math.min(0, blast.top);
    const bw = Math.max(W, blast.right) - x0;
    const bh = Math.max(H, blast.bottom) - y0;
    for (let i = 0; i < 24; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 24, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(x0, y0 + (bh / 24) * i, bw, bh / 24 + 1);
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
    void collectFxArt(this);
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
  // One card per fighter (ui/theme.js drawCard): portrait disc in the seat
  // color, name + element symbol, the damage numeral, and stock pips.
  buildHud() {
    const slots = hudLayout(this.fighters.length, W, H);
    const stocksMax = this.setup.stocks ?? 3;
    this.hud = this.fighters.map((f, i) => {
      const slot = slots[i];
      const { panelW, top } = slot;
      const scale = panelW / 260;
      const compact = panelW < 200;
      const pip = PLAYER_COLORS[i % PLAYER_COLORS.length];
      const px = slot.left;
      const py = top;
      const ph = slot.panelH;
      const panel = this.add.graphics().setDepth(HUD_DEPTH);
      drawCard(panel, px, py, panelW, ph, { accent: pip, radius: 16, edge: 0 });
      panel.lineStyle(1.5, pip, 0.8);
      panel.strokeRoundedRect(px, py, panelW, ph, 16);

      const def = f.charDef;
      const d = compact ? 44 : 56;
      const disc = drawPortraitDisc(this, px + 10 + d / 2, py + ph / 2, d, {
        textureKey: menuPortraitKey(def), face: faceFrame(this, def), n: def.atomicNumber, sym: def.symbol, ring: pip, depth: HUD_DEPTH + 1,
      });
      const textX = px + 20 + d;
      const percentSize = Math.max(20, Math.round(30 * scale));
      const nameMax = panelW - (textX - px) - percentSize * 2.6;
      const label = def.name.toUpperCase();
      const name = this.add.text(textX, py + 14, label, {
        fontFamily: FONT_DISPLAY,
        fontSize: `${fitLabelSize(label, nameMax, Math.round(14 * scale), 10)}px`,
        color: THEME.mistCss, letterSpacing: 1,
      }).setDepth(HUD_DEPTH + 1);
      const sym = this.add.text(name.x + name.width + 8, py + 16, `${def.symbol}${f.isBot ? ' · CPU' : ''}`, {
        fontFamily: FONT_MONO, fontSize: `${Math.max(9, Math.round(11 * scale))}px`, color: THEME.dimCss, letterSpacing: 1,
      }).setDepth(HUD_DEPTH + 1);
      const percent = this.add.text(slot.right - 16, py + ph / 2 + 2, '0%', {
        fontFamily: FONT_DISPLAY, fontSize: `${percentSize}px`, color: THEME.mistCss,
        stroke: THEME.voidCss, strokeThickness: 3,
      }).setOrigin(1, 0.5).setDepth(HUD_DEPTH + 2);
      const stocks = this.add.graphics().setDepth(HUD_DEPTH + 1);
      const h = { panel, disc, name, sym, percent, stocks, pip, pipX: textX, pipY: py + ph - 20, stocksMax, pipsShown: -1 };
      this.paintStocks(h, f.stocks);
      return h;
    });
  }

  paintStocks(h, count) {
    if (h.pipsShown === count) return;
    h.pipsShown = count;
    const g = h.stocks;
    g.clear();
    const r = 4.5;
    for (let s = 0; s < h.stocksMax; s++) {
      const x = h.pipX + r + s * (r * 2 + 7);
      if (s < count) {
        g.fillStyle(h.pip, 1);
        g.fillCircle(x, h.pipY, r);
        g.lineStyle(1, 0xffffff, 0.25);
        g.strokeCircle(x, h.pipY, r);
      } else {
        g.lineStyle(1.25, h.pip, 0.35);
        g.strokeCircle(x, h.pipY, r - 0.5);
      }
    }
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
            const floater = this.add.text(h.percent.x, h.percent.y - 22, `+${shown - (h.shown ?? 0)}`, {
              fontFamily: FONT_DISPLAY, fontSize: '18px', color: THEME.goldCss,
              stroke: THEME.voidCss, strokeThickness: 3,
            }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(HUD_DEPTH + 3);
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
      this.paintStocks(h, Math.max(0, f.stocks));
      const dim = !f.alive;
      if (h.dim !== dim) {
        h.dim = dim;
        [h.panel, h.disc, h.name, h.sym, h.percent, h.stocks].forEach((o) => o.setAlpha(dim ? 0.45 : 1));
      }
    });
  }

  // ------------------------------------------------------------ combat glue
  dropProjectileZone(p) {
    if (!p?.move?.dropZone || p.dropped) return;
    p.dropped = true;
    let y = p.gfx.y;
    if (p.move.dropZone.feet) y = groundTop(this, p.gfx.x, p.gfx.y + 80);
    this.spawnZone(p.owner, p.move.dropZone, p.gfx.x, y, p.move);
  }

  /** Painted blast. An explode-only shot stays on its burst unless it splinters. */
  detonateProjectile(p) {
    if (!p || p._detonated || p.pinned) return;
    if (p.move?.explodeOnly && !p.move.splinter) return;
    const art = artFor(p.owner?.charDef?.id, p.move?.name);
    if (!art?.detonate?.frames?.length) return;
    p._detonated = true;
    spawnFxDetonate(this, p.owner, p.move, p.gfx.x, p.gfx.y);
  }

  consumeZones(fighter, spec) {
    if (!this.zones?.length || !spec) return 0;
    let n = 0;
    const radius = spec.radius ?? 140;
    const want = spec.type;
    for (const z of this.zones) {
      if (z.dead || z.owner === fighter) continue;
      const toxic = z.spec?.type === 'chemical' || z.spec?.onHit?.poison;
      const gas = !!(z.spec?.gas || z.spec?.cloud);
      if (spec.gas) {
        if (!gas) continue;
      } else if (want && z.spec?.type !== want && !(want === 'chemical' && toxic)) continue;
      const d = Math.hypot(z.x - fighter.x, z.y - (fighter.y - fighter.bodyH * 0.4));
      if (d > radius + (z.radius ?? 0) * 0.4) continue;
      z.dead = true;
      z.gfx?.destroy?.();
      if (z.spec?.endsDefense && z.owner?.state === 'defending') {
        z.owner.state = 'idle';
        z.owner.defenseMove = null;
        z.owner.alpha = 1;
        z.owner._hazeFade = false;
      }
      n += 1;
    }
    if (n && spec.stackPercent) {
      const max = spec.stackMax ?? 3;
      fighter.catalystStacks = Math.min(max, (fighter.catalystStacks ?? 0) + n);
      fighter.catalystPer = spec.stackPercent;
    } else if (n) {
      fighter.bonusHits = (fighter.bonusHits ?? 0) + n;
      fighter.bonusPacket = {
        type: spec.bonusType ?? 'heat',
        damage: spec.bonus ?? 3,
        hitsName: fighter.charDef?.moves?.basicCharge?.name,
      };
    }
    return n;
  }

  attachPinLock(p, fighter) {
    if (p?.pinLock || this.simFast || !p?.gfx) return;
    const art = artFor(fighter?.charDef?.id, fighter?.defenseMove?.name);
    if (!art?.frames?.length || art.anchor !== 'pin') return;
    const img = placeFxImage(this, art, p.gfx.x, p.gfx.y, 1);
    if (!img) return;
    img.setDepth?.(18);
    p.pinLock = img;
    p.pinLockArt = art;
    p.pinLockBorn = this.time?.now ?? 0;
  }

  stepPinLock(p, time) {
    if (!p?.pinLock) this.attachPinLock(p, p.pinOwner);
    if (!p?.pinLock?.setPosition || !p.gfx) return;
    stepPlacedFx(p.pinLock, p.pinLockArt, (time ?? 0) - (p.pinLockBorn ?? 0), 1);
    p.pinLock.setPosition(p.gfx.x, p.gfx.y);
  }

  clearPinLock(p) {
    p?.pinLock?.destroy?.();
    if (p) p.pinLock = null;
  }

  dropPins(fighter) {
    const fling = !!fighter.defenseMove?.catchMetals;
    for (const p of this.projectiles ?? []) {
      if (p.pinOwner !== fighter || p.dead) continue;
      if (fling && p.caught && p.gfx) {
        const dir = Math.sign((p.gfx.x ?? fighter.x) - fighter.x) || (fighter.facing || 1);
        this.clearPinLock(p);
        p.pinned = false;
        p.pinOwner = null;
        p.caught = false;
        p.owner = fighter;
        p.vx = dir * (p._caughtSpeed || 460);
        p.vy = -20;
        p.landed = new Set();
        p.dieAt = (this.time?.now ?? 0) + 700;
        continue;
      }
      p.move = { ...p.move, explodeOnly: false, dropZone: null, igniteAt: 0 };
      p.dead = true;
      p.pinOwner = null;
      this.clearPinLock(p);
      if (this.tweens?.add && p.gfx?.y != null && !this.simFast) {
        this.tweens.add({
          targets: p.gfx, y: p.gfx.y + 40, alpha: 0, duration: 200,
          onComplete: () => p.gfx?.destroy?.(),
        });
      } else {
        p.gfx?.destroy?.();
      }
    }
  }

  stepCan(p) {
    const spec = p.move?.can;
    if (!spec || !p.gfx) return false;
    const solids = (this.stage?.solids ?? []).filter((s) => s.h == null);
    const deck = solids.find((s) => p.gfx.x >= s.x - s.w / 2 && p.gfx.x <= s.x + s.w / 2);
    const floorY = deck ? (deck.y ?? this.stage?.groundY) : null;
    if (!deck || floorY == null) return false;
    const onFloor = p.gfx.y >= floorY - 4 && (p.vy ?? 0) >= 0;
    if (onFloor && !p._onFloor) {
      p._onFloor = true;
      p.floorHits = (p.floorHits ?? 0) + 1;
      if (p.floorHits > (spec.floor ?? 1)) {
        p.gfx?.destroy?.();
        p.dead = true;
        return true;
      }
      p.gfx.y = floorY - 6;
      p.vy = -Math.abs(p.vy || p.move.projectileSpeed || 280) * (spec.bounce ?? 0.72);
      playVfx(this, p.owner, p.move, 'hit', { x: p.gfx.x, y: floorY });
    } else if (!onFloor) p._onFloor = false;
    const left = deck.x - deck.w / 2 + 16;
    const right = deck.x + deck.w / 2 - 16;
    const outside = p.gfx.x < left || p.gfx.x > right;
    if (outside && !p._onWall) {
      p._onWall = true;
      p.wallHits = (p.wallHits ?? 0) + 1;
      if (p.wallHits > (spec.walls ?? 2)) {
        p.gfx?.destroy?.();
        p.dead = true;
        return true;
      }
      p.vx *= -1;
      p.gfx.x = Phaser.Math.Clamp(p.gfx.x, left, right);
      p.landed = new Set();
      playVfx(this, p.owner, p.move, 'hit', { x: p.gfx.x, y: p.gfx.y });
    } else if (!outside) p._onWall = false;
    return false;
  }

  spawnMine(owner, move) {
    this.mines = this.mines ?? [];
    const max = move.mineMax ?? 1;
    const owned = this.mines.filter((m) => !m.dead && m.owner === owner && m.move?.name === move.name);
    while (owned.length >= max) {
      const old = owned.shift();
      old.dead = true;
      old.gfx?.destroy?.();
    }
    const face = owner.facing || 1;
    const x = owner.x + face * (move.mineRange ?? 140);
    const y = owner.y;
    const arm = (this.time?.now ?? 0) + (move.mineArmMs ?? 500);
    const gfx = this.simFast || !this.add?.circle
      ? { x, y, destroy() {} }
      : this.add.circle(x, y - 10, 8, move.vfxColor ?? 0xf0e6c8, 0.95);
    gfx.setDepth?.(12);
    this.mines.push({ owner, move, x, y, arm, gfx, dead: false });
  }

  updateMines(time) {
    if (!this.mines?.length) return;
    for (const m of this.mines) {
      if (m.dead) continue;
      if (!m.owner?.alive) {
        m.dead = true;
        m.gfx?.destroy?.();
        continue;
      }
      if (time < m.arm) continue;
      for (const f of this.fighters) {
        if (f === m.owner || !f.alive || f.state === 'ko' || f.state === 'dead') continue;
        if (Math.hypot(f.x - m.x, f.y - m.y) > 36) continue;
        this.burstMine(m);
        break;
      }
    }
    this.mines = this.mines.filter((m) => !m.dead);
  }

  burstMine(m) {
    m.dead = true;
    m.gfx?.destroy?.();
    const speed = m.move.shardSpeed ?? 380;
    playVfx(this, m.owner, m.move, 'release', { x: m.x, y: m.y - 12 });
    for (const dir of MINE_SHARDS) {
      this.spawnProjectile(m.owner, {
        ...m.move,
        kind: 'projectile',
        shotEnd: 'despawn',
        damage: m.move.damage,
        projectileSpeed: speed,
        projectileLife: m.move.projectileLife ?? 420,
        projectileRadius: m.move.projectileRadius ?? 6,
        _vx: dir.x * speed,
        _vy: dir.y * speed,
        _from: { x: m.x, y: m.y - 16 },
        fan: null,
      });
    }
  }

  yankFront(owner, move) {
    const range = move.yankRange ?? move.yankMax ?? 200;
    const target = nearestInFront(owner, this.fighters, range);
    if (!target) return;
    const face = owner.facing || 1;
    const destX = owner.x + face * 46;
    target.body?.reset?.(destX, owner.y);
    target.body?.setVelocity?.(0, 0);
    this.landHit(owner, target, {
      name: move.name,
      type: move.type ?? 'chemical',
      damage: move.damage ?? 0,
      baseKnockback: move.baseKnockback ?? 40,
      knockbackGrowth: move.knockbackGrowth ?? 1,
      kind: 'melee',
    });
  }

  clearOwnedZones(owner, name) {
    for (const z of this.zones ?? []) {
      if (z.dead || z.owner !== owner) continue;
      if (name && z.spec?.name !== name) continue;
      z.dead = true;
      z.gfx?.destroy?.();
    }
  }

  pourWall(fighter, move, time) {
    const y = fighter.y - fighter.bodyH * (move.wallYFrac ?? 0.75);
    const front = fighter.facing === 1
      ? fighter.x + fighter.bodyW / 2
      : fighter.x - fighter.bodyW / 2 - move.wallRangeW;
    const sides = move.frontOnly
      ? [front]
      : [fighter.x - fighter.bodyW / 2 - move.wallRangeW, fighter.x + fighter.bodyW / 2];
    this.lingeringWalls = this.lingeringWalls ?? [];
    const art = artFor(fighter.charDef?.id, move.name);
    const face = fighter.facing || 1;
    for (const wx of sides) {
      const cx = wx + (move.wallRangeW ?? 34) / 2;
      const shell = placeFxImage(this, art, cx, fighter.y, face);
      const goo = placeFxImage(this, art?.linger, cx, fighter.y, face);
      shell?.setDepth?.(11);
      goo?.setDepth?.(12);
      this.lingeringWalls.push({
        owner: fighter, move, wx, y, born: time, until: time + move.wallLingerMs, landed: new Set(),
        shell, goo, art, face,
      });
    }
  }

  touchWall(owner, move, wx, y, landed, born, time) {
    const rect = new Phaser.Geom.Rectangle(wx, y - move.wallRangeH / 2, move.wallRangeW, move.wallRangeH);
    for (const target of this.fighters) {
      if (target === owner || !target.alive || target.state === 'ko' || landed.has(target)) continue;
      const artHit = fxWallTest(owner, move, target, time);
      if (artHit === true || (artHit == null && hurtHitsRect(target, rect))) {
        landed.add(target);
        if (move.wallRootMs && time - born < move.wallRootMs) target.rootedUntil = time + 480;
        this.landHit(owner, target, {
          name: move.name,
          damage: move.wallDamage, type: move.wallType,
          baseKnockback: move.wallKnockback, knockbackGrowth: move.wallKnockbackGrowth ?? 0,
          kind: 'burst',
        });
      }
    }
  }

  leaveTracer(p, time) {
    if (!(p?.move?.trailMs > 0) || this.simFast || p.dead) return;
    if (time - (p._trailAt ?? 0) < 28) return;
    p._trailAt = time;
    const stamp = p.gfx?.texture?.key;
    if (stamp && this.add?.image) {
      const ghost = this.add.image(p.gfx.x, p.gfx.y, stamp);
      ghost.setOrigin?.(p.gfx.originX ?? 0.5, p.gfx.originY ?? 0.5);
      if (p.gfx.displayWidth) ghost.setDisplaySize(p.gfx.displayWidth, p.gfx.displayHeight);
      ghost.rotation = p.gfx.rotation || 0;
      ghost.setBlendMode?.('ADD');
      ghost.setAlpha?.(0.5);
      ghost.setDepth?.(14);
      this.tweens?.add?.({
        targets: ghost, alpha: 0, duration: p.move.trailMs,
        onComplete: () => ghost.destroy(),
      });
      return;
    }
    const streak = this.add.rectangle(p.gfx.x, p.gfx.y, 18, 3, p.move.vfxColor ?? 0xfff2c0, 0.72);
    streak.setBlendMode?.('ADD');
    streak.rotation = Math.atan2(p.vy || 0, p.vx || 1);
    this.tweens?.add?.({
      targets: streak, alpha: 0, duration: p.move.trailMs,
      onComplete: () => streak.destroy(),
    });
  }

  sweepMarked(owner, move, already) {
    const now = this.time.now;
    for (const target of markedStrikeTargets(owner, move, this.fighters, now, already)) {
      this.landHit(owner, target, { ...move, hitMarked: null, hitsRevealed: true });
    }
  }

  spawnBarrelFlash(owner, move) {
    const art = artFor(owner?.charDef?.id, move?.name)?.muzzle;
    if (!art?.frames?.length || this.simFast) return;
    const face = owner.facing || 1;
    // Machine Gun and Shotgun are empty-hand gestures. The flash is the weapon.
    const posed = sheetFxPoint(owner, 'shot') || sheetReleasePoint(owner, 'shot');
    const x = posed?.x ?? owner.x + face * (owner.bodyW ?? 40) * 0.85;
    const y = posed?.y ?? owner.y - (owner.bodyH ?? 80) * 0.48;
    const rot = art.randomRot ? (Math.random() - 0.5) * 0.8 : 0;
    const flip = art.randomFlip && Math.random() < 0.5 ? -face : face;
    spawnFxSprite(this, { ...art, _rot: rot }, x, y, 1, flip);
  }

  /** A one-frame shove, or a short slide when the move asks for recoilMs. */
  kickRecoil(owner, move) {
    if (!move?.recoilSelf || !owner?.body?.setVelocityX) return;
    if (move._fanChild || move._ghost || move._salvoChild) return;
    const vx = -(owner.facing || 1) * move.recoilSelf;
    owner.body.setVelocityX(vx);
    if (move.recoilMs > 0) {
      owner._recoilUntil = (this.simNow ?? this.time?.now ?? 0) + move.recoilMs;
      owner._recoilVX = vx;
    }
  }

  nearOwnerCleanse(p) {
    const reach = p.move?.nearCleanse;
    const owner = p.owner;
    if (!(reach > 0) || !owner || p._nearDone || !p.gfx) return false;
    const d = Math.hypot(owner.x - p.gfx.x, (owner.y - (owner.bodyH ?? 80) * 0.35) - p.gfx.y);
    if (d > reach) return false;
    p._nearDone = true;
    cleanse(owner, ['poison']);
    playVfx(this, owner, p.move, 'hit', { x: p.gfx.x, y: p.gfx.y });
    return true;
  }

  holdOutlines() {
    for (const fighter of this.fighters) {
      if (fighter.state !== 'defending' || !fighter.defenseMove?.outline || !fighter.alive) continue;
      const rx = (fighter.bodyW ?? 40) * 0.8;
      const ry = (fighter.bodyH ?? 80) * 0.46;
      const cy = fighter.y - (fighter.bodyH ?? 80) * 0.48;
      for (const other of this.fighters) {
        if (other === fighter || !other.alive || other.state === 'ko' || !other.body) continue;
        const oy = other.y - (other.bodyH ?? 80) * 0.4;
        const dx = other.x - fighter.x;
        const dy = oy - cy;
        const nx = dx / Math.max(12, rx);
        const ny = dy / Math.max(12, ry);
        if (nx * nx + ny * ny >= 1) continue;
        const len = Math.hypot(nx, ny) || 0.001;
        const px = (nx / len) * rx;
        const py = (ny / len) * ry;
        other.body.reset(fighter.x + px, other.y + (cy + py - oy));
        other.body.setVelocity((nx / len) * 160, Math.min(other.body.velocity.y, -20));
      }
    }
  }

  catchInSpiral(p, host, time) {
    const cy = host.y - (host.bodyH ?? 80) * 0.45;
    const ang = Math.atan2((p.gfx?.y ?? host.y) - cy, (p.gfx?.x ?? host.x) - host.x);
    const speed = Math.hypot(p.vx, p.vy) || p.move?.projectileSpeed || 420;
    p.spiraling = true;
    p.spiralFrom = time;
    p.spiralMs = 500;
    p.spiralHost = host;
    p.spiralAng = ang;
    p._exitSpeed = speed;
    p._exitAng = ang + Math.PI;
    p.vx = 0;
    p.vy = 0;
    const trail = artFor(host.charDef?.id, host.defenseMove?.name)?.reflect;
    if (trail?.frames?.length) spawnFxSprite(this, trail, host.x, cy, 1, 1);
  }

  /** Dee plates: the real shot rides the spiral, then leaves along the way it came in from. */
  stepSpiralReflect(p, time) {
    const host = p.spiralHost;
    const release = () => {
      p.spiraling = false;
      p._spiraled = true;
      const speed = p._exitSpeed || p.move?.projectileSpeed || 420;
      const ang = p._exitAng || 0;
      p.vx = Math.cos(ang) * speed;
      p.vy = Math.sin(ang) * speed * 0.35;
      if (host?.alive) {
        p.owner = host;
        p.landed = new Set();
        p.dieAt = time + (p.move?.projectileLife ?? 480);
      }
      return false;
    };
    if (!host?.alive || host.state === 'ko' || host.state === 'dead' || !p.gfx) return release();
    const t = Math.min(1, (time - (p.spiralFrom ?? time)) / (p.spiralMs || 500));
    const cy = host.y - (host.bodyH ?? 80) * 0.45;
    const r0 = Math.max(36, (host.bodyW ?? 40) * 1.05);
    let x;
    let y;
    if (t < 0.75) {
      const u = t / 0.75;
      const ang = (p.spiralAng || 0) + 1.15 * Math.PI * 2 * u;
      const r = r0 * (1.05 - 0.35 * u);
      x = host.x + Math.cos(ang) * r;
      y = cy + Math.sin(ang) * r * 0.7;
    } else {
      const u = (t - 0.75) / 0.25;
      const r = r0 * 0.7 + u * 110;
      x = host.x + Math.cos(p._exitAng || 0) * r;
      y = cy + Math.sin(p._exitAng || 0) * r * 0.45;
    }
    p.gfx.x = x;
    p.gfx.y = y;
    stepFxProjectile(p, time);
    if (t < 1) return true;
    return release();
  }

  bounceOffOutline(p, victim) {
    const cx = victim.x;
    const cy = victim.y - (victim.bodyH ?? 80) * 0.48;
    const dx = p.gfx.x - cx;
    const dy = p.gfx.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const vn = p.vx * nx + p.vy * ny;
    if (vn < 0) {
      p.vx -= 2 * vn * nx;
      p.vy -= 2 * vn * ny;
    } else if (Math.hypot(p.vx, p.vy) < 40) {
      p.vx = nx * 220;
      p.vy = ny * 220;
    }
    const rx = (victim.bodyW ?? 40) * 0.9;
    const ry = (victim.bodyH ?? 80) * 0.5;
    p.gfx.x = cx + nx * (rx + 10);
    p.gfx.y = cy + ny * (ry + 10);
    const art = artFor(victim.charDef?.id, victim.defenseMove?.name)?.reflect;
    if (art?.frames?.length) {
      spawnFxSprite(this, { ...art, _rot: Math.atan2(ny, nx) }, p.gfx.x, p.gfx.y, 1, 1);
    }
  }

  bounceAroundStage(p) {
    const w = this.world?.width > 0 ? this.world.width : 1280;
    const top = 48;
    let bounced = false;
    let nx = 0;
    let ny = 0;
    if (p.gfx.x < 28) {
      p.gfx.x = 28;
      p.vx = Math.abs(p.vx || 200);
      bounced = true;
      nx = 1;
    } else if (p.gfx.x > w - 28) {
      p.gfx.x = w - 28;
      p.vx = -Math.abs(p.vx || 200);
      bounced = true;
      nx = -1;
    }
    if (p.gfx.y < top) {
      p.gfx.y = top;
      p.vy = Math.abs(p.vy || 200);
      bounced = true;
      ny = 1;
    } else {
      const gy = groundTop(this, p.gfx.x, p.gfx.y + 80);
      if (p.gfx.y > gy - 16) {
        p.gfx.y = gy - 18;
        p.vy = -Math.abs(p.vy || 240);
        bounced = true;
        ny = -1;
      }
    }
    if (!bounced) return;
    p.bounces = (p.bounces ?? 0) + 1;
    const spark = artFor(p.owner?.charDef?.id, p.move?.name)?.spark;
    if (spark?.frames?.length) {
      spawnFxSprite(this, { ...spark, _rot: Math.atan2(ny, nx || Math.sign(p.vx || 1)) }, p.gfx.x, p.gfx.y, 1, 1);
    }
    const owner = p.owner;
    if (!owner) return;
    let best = null;
    let bestD = Infinity;
    for (const other of this.fighters) {
      if (other === owner || !other.alive || other.state === 'ko' || p.landed?.has(other)) continue;
      if (fighterInView(owner, other)) continue;
      const d = Math.hypot(other.x - p.gfx.x, (other.y - (other.bodyH ?? 80) * 0.45) - p.gfx.y);
      if (d < bestD) { bestD = d; best = other; }
    }
    if (!best) return;
    const speed = Math.max(180, Math.hypot(p.vx, p.vy));
    const tx = best.x - p.gfx.x;
    const ty = (best.y - (best.bodyH ?? 80) * 0.45) - p.gfx.y;
    const tl = Math.hypot(tx, ty) || 1;
    p.vx = p.vx * 0.55 + (tx / tl) * speed * 0.45;
    p.vy = p.vy * 0.55 + (ty / tl) * speed * 0.45;
    const keep = Math.hypot(p.vx, p.vy) || 1;
    p.vx = (p.vx / keep) * speed;
    p.vy = (p.vy / keep) * speed;
  }

  spawnProjectile(owner, move) {
    if (move.rain > 1 && !move._rainChild) {
      const art = artFor(owner?.charDef?.id, move.name);
      const face0 = owner.facing || 1;
      // Phosphor Flare is an overhand toss at 60°. The launch art leaves the
      // release-frame hand, and the same ember curtain falls from its tip.
      const tossed = move.vfx === 'phosphor';
      let fromX = owner.x + face0 * (owner.bodyW ?? 40) * 0.15;
      let fromY = owner.y - (owner.bodyH ?? 80) * 0.62;
      let toss = null;
      if (tossed) {
        const hand = sheetReleasePoint(owner, 'shot');
        if (hand) { fromX = hand.x; fromY = hand.y; }
        const launchH = art?.launch?.frames?.[0]?.displayH;
        const len = launchH > 0 ? launchH : (owner.bodyH || 118) * 2;
        toss = overhandToss(fromX, fromY, face0, len);
      } else {
        const hand = sheetReleasePoint(owner, 'shot');
        if (hand) { fromX = hand.x; fromY = hand.y; }
      }
      if (art?.launch?.frames?.length) {
        const img = spawnFxSprite(this, art.launch, fromX, fromY, 1, face0);
        if (img && toss) img.rotation = toss.rotation;
      }
      const launch = () => {
        if (!owner?.alive) return;
        if (art?.ember?.frames?.length) {
          const layout = flareEmbers(move, owner.bodyH || 118, Math.floor((this.time?.now || 0) + owner.x));
          const origin = toss ? { x: toss.x, y: toss.y } : null;
          spawnFlareShower(this, owner, move, layout, origin);
          const n = move.rain | 0;
          const face = owner.facing || 1;
          const originX = toss ? toss.x : owner.x + face * (owner.bodyW ?? 40) * 0.2;
          const top = toss ? toss.y : owner.y - layout.height;
          for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0 : (i / (n - 1) - 0.5);
            const drift = (i % 2 ? 1 : -1) * (8 + (i % 3) * 3);
            this.spawnProjectile(owner, {
              ...move,
              rain: 0,
              rainDelay: 0,
              _rainChild: true,
              projectileRadius: layout.radius,
              _from: { x: originX + t * layout.width, y: top },
              _vy: 270 + (i % 3) * 30,
              projectileSpeed: Math.abs(drift),
              _flip: Math.sign(drift) !== Math.sign(face),
            });
          }
          return;
        }
        if (art?.shower?.frames?.length) {
          const img = spawnFxSprite(
            this, art.shower,
            fromX,
            fromY,
            1, face0,
          );
          if (img && art.shower.tilt) img.rotation = face0 * art.shower.tilt;
        }
        const n = move.rain | 0;
        const spread = move.rainSpread ?? 220;
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0 : (i / (n - 1) - 0.5);
          this.spawnProjectile(owner, {
            ...move,
            rain: 0,
            rainDelay: 0,
            _rainChild: true,
            _vy: 260 + (i % 3) * 40,
            projectileSpeed: 70 + Math.abs(t) * spread,
            _flip: t < 0,
          });
        }
      };
      if (move.rainDelay > 0 && this.time?.delayedCall) this.time.delayedCall(move.rainDelay, launch);
      else launch();
      return;
    }
    if (move.salvo > 1 && !move._salvoChild) {
      const n = move.salvo | 0;
      const gap = move.salvoGap ?? 80;
      for (let i = 0; i < n; i++) {
        const child = { ...move, salvo: 0, _salvoChild: true, _salvoIndex: i + 1, _salvoCount: n };
        const go = () => { if (owner?.alive) this.spawnProjectile(owner, child); };
        if (i === 0 || !this.time?.delayedCall) go();
        else this.time.delayedCall(i * gap, go);
      }
      return;
    }
    if (move.fanTypes?.length && !move._fanChild) {
      const types = move.fanTypes;
      const spread = move.fanSpread ?? 200;
      const speed = move.projectileSpeed ?? 400;
      const aim = stickAim(owner);
      const base = Math.atan2(aim.y, aim.x);
      for (let i = 0; i < types.length; i++) {
        if (move.fanDeg > 0) {
          const vel = fanVelocity(speed, i, types.length, move.fanDeg);
          const ang = base + Math.atan2(vel.vy, vel.vx);
          this.spawnProjectile(owner, {
            ...move,
            fanTypes: null,
            fanDeg: 0,
            _fanChild: true,
            _vx: Math.cos(ang) * speed,
            _vy: Math.sin(ang) * speed,
            _shard: types[i],
            type: types[i],
            type2: undefined,
            damage2: undefined,
          });
        } else {
          const t = types.length === 1 ? 0 : (i / (types.length - 1) - 0.5);
          this.spawnProjectile(owner, {
            ...move, fanTypes: null, _fanChild: true, _vy: t * spread,
            type: types[i], type2: undefined, damage2: undefined,
          });
        }
      }
      return;
    }
    if (move.alsoBehind && !move._behindChild) {
      const splitArt = artFor(owner.charDef?.id, move.name);
      const splitY = owner.y - (owner.bodyH ?? 80) * 0.5;
      if (splitArt?.frames?.length) {
        spawnFxSprite(this, splitArt, owner.x, splitY, splitArt.scale > 0 ? splitArt.scale : 1, owner.facing || 1);
      }
      if (splitArt?.burst?.frames?.length) {
        const burstScale = splitArt.burst.scale > 0 ? splitArt.burst.scale : 1;
        spawnFxSprite(this, splitArt.burst, owner.x, splitY, burstScale, 1);
      }
      this.spawnProjectile(owner, { ...move, alsoBehind: false, _behindChild: true });
      this.spawnProjectile(owner, { ...move, alsoBehind: false, _behindChild: true, _flip: true });
      return;
    }
    if (move.orbitRelease && !move._orbitChild) {
      spawnMoveExtra(this, owner, move, 'burst', owner.x, owner.y - owner.bodyH * 0.45, 1);
      const spec = move.orbitWhileCharging || {};
      const n = spec.count || 8;
      const rad = spec.radius ?? 76;
      const spin = (this.time.now / (spec.period ?? 900)) * Math.PI * 2;
      const speed = move.projectileSpeed || 480;
      for (let i = 0; i < n; i++) {
        const ang = spin + (i / n) * Math.PI * 2;
        const ox = Math.cos(ang);
        const oy = Math.sin(ang);
        const want = Math.sign(ox) || owner.facing || 1;
        this.spawnProjectile(owner, {
          ...move,
          orbitRelease: false,
          fan: null,
          _orbitChild: true,
          _from: { x: owner.x + ox * rad, y: owner.y - owner.bodyH * 0.45 + oy * rad * 0.62 },
          _vy: oy * speed * 0.7,
          projectileSpeed: Math.max(80, Math.abs(ox) * speed),
          _flip: want !== (owner.facing || 1),
        });
      }
      return;
    }
    if (move.fan > 1 && !move._fanChild) {
      if (move.barrelFlash) this.spawnBarrelFlash(owner, move);
      this.kickRecoil(owner, move);
      const n = move.fan | 0;
      const spread = move.fanSpread ?? 220;
      const speed = move.projectileSpeed ?? 400;
      for (let i = 0; i < n; i++) {
        if (move.fanDeg > 0) {
          const vel = fanVelocity(speed, i, n, move.fanDeg);
          const face = owner.facing || 1;
          this.spawnProjectile(owner, {
            ...move,
            fan: null,
            _fanChild: true,
            _vx: face * vel.vx,
            _vy: vel.vy,
          });
        } else {
          const t = n === 1 ? 0 : (i / (n - 1) - 0.5);
          this.spawnProjectile(owner, {
            ...move, fan: null, _fanChild: true, _vy: t * spread, _hideArt: !!move.oneArt,
          });
        }
      }
      // The volley sheet is the whole fan, so it flies straight down the aim line.
      if (move.oneArt && !(move.fanDeg > 0)) {
        this.spawnProjectile(owner, {
          ...move, fan: null, _fanChild: true, _vy: 0, _ghost: true,
        });
      }
      return;
    }
    if (move._salvoChild) this.spawnBarrelFlash(owner, move);
    this.kickRecoil(owner, move);
    const style = projectileStyle(move);
    const r = style.radius;
    let vy = move._vy ?? 0;
    if (move.ground && !move.floor) vy = Math.max(vy, 180);
    if (move.lob != null && move._vy == null) {
      const up = typeof move.lob === 'number' ? move.lob : (move.lob.vy ?? 460);
      vy = -Math.abs(up);
    }
    if (!move._vy && move.angleable) {
      if (owner.input?.jump) vy = -240;
      else if (owner.input?.down) vy = 220;
    }
    const face = move._flip ? -owner.facing : owner.facing;
    const posed = move._from ? null : sheetReleasePoint(owner, move.roll ? 'roll' : 'shot');
    let x = move._from?.x ?? posed?.x ?? (owner.x + face * (owner.bodyW / 2 + r + 4));
    let y = move._from?.y ?? posed?.y ?? (move.roll ? owner.y : owner.y - owner.bodyH * 0.65);
    if (posed && owner?.charDef?.id === 'duke' && move?.name === 'Heavy Ion Bolt') {
      // The bolt is centered on its cell and the bright core starts behind
      // that center. Step it forward so the tail leaves the braced palm.
      const bolt = artFor(owner.charDef.id, move.name)?.frames?.[0];
      if (bolt?.displayW > 0) x += face * bolt.displayW * (0.5 - 70 / 256);
    }
    if (move.floor) {
      y = groundTop(this, x, owner.y + 4);
      vy = 0;
    }
    let dropVx = null;
    if (move.fromAbove) {
      y -= move.skyHeight ?? 220;
      // Start behind the aim point so a diagonal dive crosses into the fight.
      if (move.skyLead) x -= face * move.skyLead;
      if (move.dropOn) {
        let best = null;
        let bestD = Infinity;
        for (const other of this.fighters) {
          if (other === owner || !other.alive || other.state === 'ko') continue;
          const d = Math.hypot(other.x - owner.x, other.y - owner.y);
          if (d < bestD) { bestD = d; best = other; }
        }
        if (best) {
          x = best.x;
          y = best.y - (move.skyHeight ?? 280);
          dropVx = 0;
        }
      }
    }
    if (move._rainChild && move._from == null) y -= 160;
    if (!move._orbitChild && !move._fanChild && !move._rainChild && !move._behindChild && !move._salvoChild && !move._splitChild) {
      spawnMoveExtra(this, owner, move, 'splash', x, y, face);
    }
    const shotArt = artFor(owner.charDef?.id, move.name);
    if (!this.simFast && shotArt?.muzzle?.frames?.length) {
      spawnMoveExtra(this, owner, move, 'muzzle', x, y, face);
    } else if (move.visualShape === 'tracer' && !this.simFast && !shotArt?.frames?.length) {
      const flash = this.add.circle(x, y, 7, 0xfff6e8, 0.9);
      flash.setBlendMode?.('ADD');
      this.tweens?.add?.({
        targets: flash, alpha: 0, scale: 1.8, duration: 70,
        onComplete: () => flash.destroy(),
      });
    }
    const born = this.time.now;
    const shotVx = dropVx != null ? dropVx : (move._vx != null ? move._vx : face * move.projectileSpeed);
    const shot = {
      owner, move,
      vx: shotVx,
      vy: move.fromAbove ? (move.fallSpeed ?? 420) : vy,
      dieAt: born + move.projectileLife,
      born,
      armAt: move.delayMs ? born + move.delayMs : 0,
      landed: new Set(),
      bornX: x,
      radius: r,
      spriteW: projectileSpriteSize(move).w,
      spriteH: projectileSpriteSize(move).h,
    };
    if (this.simFast) {
      const art = artFor(owner.charDef?.id, move.name);
      const frame = art?.hit === false ? null : art?.frames?.[0];
      this.projectiles.push({
        ...shot,
        gfx: { x, y, destroy() {} },
        fxMask: frame?.mask,
      });
      return;
    }
    const rainArt = artFor(owner.charDef?.id, move.name);
    if (move._rainChild && (rainArt?.shower?.frames?.length || rainArt?.ember?.frames?.length)) {
      this.projectiles.push({ ...shot, gfx: { x, y, destroy() {} } });
      return;
    }
    if (rainArt?.stageFit) {
      this.projectiles.push({ ...shot, gfx: { x, y, destroy() {} } });
      return;
    }
    if (move._hideArt || move.hideProjectile) {
      this.projectiles.push({ ...shot, gfx: { x, y, destroy() {} } });
      return;
    }
    const painted = fxProjectileView(this, owner, move, x, y);
    if (painted) {
      this.projectiles.push({ ...shot, ...painted });
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
    } else if (!paintShot(orb, move, r)) {
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
      vx: shotVx,
      vy: move.fromAbove ? (move.fallSpeed ?? 420) : vy,
      dieAt: this.time.now + move.projectileLife,
      born: this.time.now,
      armAt: move.delayMs ? this.time.now + move.delayMs : 0,
      landed: new Set(),
      bornX: x,
      radius: r,
      spriteW: projectileSpriteSize(move).w,
      spriteH: projectileSpriteSize(move).h,
    });
  }

  swapAlongLine(fighter) {
    if (!fighter?.body) return;
    const target = fighterOnSwapLine(fighter, this.fighters, this.world?.width ?? 0);
    this.drawSwapLine(fighter);
    if (!target?.body || target === fighter) return;
    const ax = target.x;
    const ay = target.y;
    target.body.reset(fighter.x, fighter.y);
    fighter.body.reset(ax, ay);
    target.body.setVelocity?.(0, 0);
    fighter.body.setVelocity?.(0, 0);
    const art = artFor(fighter.charDef?.id, fighter.defenseMove?.name);
    if (art?.frames?.length) {
      spawnFxSprite(this, art, fighter.x, fighter.y - (fighter.bodyH ?? 80) * 0.5, 1, 1);
    }
  }

  drawSwapLine(fighter) {
    const art = fxNamed('ruth/metathesis-line');
    const frame = art?.frames?.[0];
    if (!frame || !this.add?.image || this.simFast) return;
    const face = fighter.facing || 1;
    const y = fighter.y - (fighter.bodyH ?? 80) * 0.45;
    const far = face > 0 ? (this.world?.width ?? fighter.x) : 0;
    const span = Math.max(8, Math.abs(far - fighter.x));
    const x = Math.min(fighter.x, far);
    const img = this.add.image(x, y, frame.key);
    img.setOrigin(0, 0.5);
    img.setDisplaySize(span, 16);
    img.setDepth(12);
    img.setBlendMode?.(frame.blend === 'add' ? 'ADD' : 'NORMAL');
    this.tweens?.add?.({
      targets: img, alpha: 0, duration: 460,
      onComplete: () => img.destroy?.(),
    });
  }

  throwRods(owner, coat, glow) {
    const spec = coat?.releaseRods;
    if (!spec || !owner) return;
    const face = owner.facing || 1;
    const speed = spec.projectileSpeed ?? 440;
    const now = this.simNow ?? this.time?.now ?? 0;
    for (let i = 0; i < 2; i++) {
      const at = rodOrbitPoint(owner, now, i, spec);
      this.spawnProjectile(owner, {
        name: coat.name,
        kind: 'projectile',
        type: glow ? (spec.glowType ?? 'radiation') : (spec.type ?? 'kinetic'),
        damage: spec.damage ?? 4,
        vfx: 'spark',
        vfxColor: glow ? 0xc6ffb0 : 0xd8dde4,
        projectileSpeed: speed,
        projectileRadius: spec.projectileRadius ?? 11,
        projectileLife: spec.projectileLife ?? 500,
        baseKnockback: spec.baseKnockback ?? 64,
        knockbackGrowth: spec.knockbackGrowth ?? 1.1,
        _vx: face * speed,
        _vy: 0,
        _from: { x: at.x, y: at.y },
        _rodGlow: !!glow,
      });
    }
  }

  resolveBurst(owner, move, at) {
    if (move?.chain?.knockback != null && !move._chained) {
      move = {
        ...move,
        baseKnockback: 0,
        knockbackGrowth: 0,
        noKnockback: true,
        noFlinch: true,
        onHit: move.onHit ? { ...move.onHit, stun: 0, freeze: 0 } : move.onHit,
      };
    }
    if (move.spikes && !move._spikeChild) {
      const n = move.spikes.count ?? 4;
      const gap = move.spikes.gap ?? 32;
      const face = owner.facing || 1;
      const ground = groundTop(this, owner.x, owner.y);
      const share = (move.damage ?? 0) / n;
      for (let i = 0; i < n; i++) {
        const x = owner.x + face * ((move.spikes.start ?? 28) + i * gap);
        this.resolveBurst(owner, {
          ...move,
          spikes: null,
          _spikeChild: true,
          multiHit: n,
          _hitIndex: i + 1,
          damage: share,
          radius: move.spikes.radius ?? move.radius,
          _noVfx: i > 0,
          landAt: true,
        }, { x, y: ground });
      }
      return;
    }
    const cx = at?.x ?? owner.x + (owner.facing || 1) * (move.offsetX ?? 0);
    const cy = at?.y ?? owner.y - owner.bodyH / 2;
    if (!move._noVfx) playVfx(this, owner, move, 'release', { x: cx, y: cy, fromSheet: at == null });

    let hits = 0;
    const struck = new Set();
    for (const target of this.fighters) {
      if (!move.includeSelf && target === owner) continue;
      if (!target.alive || target.state === 'ko') continue;
      if (move.metalsOnly && !target.charDef?.combat?.metal) continue;
      if (target.state === 'defending' && target.defenseMove?.untargetable) continue;
      if (move.coneDeg > 0 && target !== owner) {
        const facing = owner.facing || 1;
        const dx = (target.x - cx) * facing;
        const dy = target.y - cy;
        if (dx < 0) continue;
        const ang = Math.abs(Math.atan2(dy, Math.max(1, dx))) * (180 / Math.PI);
        if (ang > move.coneDeg / 2) continue;
      }
      if (move.unseen && fighterInView(owner, target)) continue;
      const fxHit = fxBurstHits(this, owner, move, cx, cy, target);
      if (fxHit === true || (fxHit == null && hurtHitsCircle(target, cx, cy, move.radius ?? 70))) {
        this.landHit(owner, target, move);
        struck.add(target);
        hits += 1;
      }
    }
    this.sweepMarked(owner, move, struck);
    if (move.missRetry && hits === 0 && !move._retried) {
      this.time.delayedCall(move.retryMs ?? 180, () => {
        if (owner.alive) this.resolveBurst(owner, { ...move, _retried: true, missRetry: false });
      });
    }
    if (move.igniteGases && this.zones?.length) {
      const sparks = [];
      const ignite = artFor(owner?.charDef?.id, move.name)?.ignite;
      for (const z of this.zones) {
        if (z.dead || !(z.spec?.gas || z.spec?.cloud)) continue;
        const reach = (move.radius ?? 80) + (z.radius ?? 0);
        if (Phaser.Math.Distance.Between(cx, cy, z.x, z.y) <= reach) {
          sparks.push(z);
        }
      }
      for (const z of sparks) {
        const radius = Math.max(36, (z.radius ?? 40) * 0.65);
        this.resolveBurst(owner, {
          ...move,
          igniteGases: false,
          bonusVsState: null,
          _noVfx: true,
          type: 'heat',
          damage: move.gasCloud ?? 6,
          type2: undefined,
          damage2: undefined,
          radius,
          chain: null,
          zone: null,
        }, { x: z.x, y: z.y });
        if (ignite?.frames?.length && !this.simFast) {
          const sheet = ignite.frames[0].displayW || 615;
          spawnFxSprite(this, ignite, z.x, z.y, cloudIgnitionScale(z.radius, sheet, 0.6));
        }
      }
    }
    if (move.chain?.jump && !move._chained && struck.size) {
      const reach = move.chain.reach ?? 280;
      const arc = artFor(owner?.charDef?.id, move.name)?.arc;
      for (const hit of struck) {
        const near = [];
        for (const other of this.fighters) {
          if (other === owner || other === hit || !other.alive || other.state === 'ko') continue;
          const d = Math.hypot(other.x - hit.x, other.y - hit.y);
          if (d <= reach) near.push({ other, d });
        }
        near.sort((a, b) => a.d - b.d);
        for (let i = 0; i < move.chain.count; i++) {
          const target = near[i]?.other || near[0]?.other || null;
          const from = { x: hit.x, y: hit.y - (hit.bodyH ?? 80) * 0.4 };
          const spot = target
            ? { x: target.x, y: target.y - (target.bodyH ?? 80) * 0.4 }
            : from;
          const echo = {
            ...move,
            _chained: true,
            chain: null,
            unseen: false,
            damage: move.chain.damage ?? (move.damage ?? 0) * (move.chain.scale ?? 0.6),
            damage2: move.chain.type ? undefined : move.damage2,
            type: move.chain.type ?? move.type,
            type2: move.chain.type ? undefined : move.type2,
            radius: (move.radius ?? 70) * (move.chain.radiusScale ?? 0.7),
          };
          this.time.delayedCall((move.chain.delay ?? 160) * (i + 1), () => {
            if (!owner.alive) return;
            if (arc && target) spawnJumpArc(this, arc, from.x, from.y, spot.x, spot.y);
            this.resolveBurst(owner, echo, spot);
          });
        }
      }
    } else if (move.chain && !move._chained) {
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
            _chainImpact: !!move.chain.useImpact,
          };
          if (move.chain.knockback != null) {
            echo.baseKnockback = move.chain.knockback;
            echo.knockbackGrowth = move.chain.growth ?? echo.knockbackGrowth;
            echo.noKnockback = false;
            echo.noFlinch = false;
          }
          this.time.delayedCall((move.chain.delay ?? 160) * i, () => {
            if (owner.alive) this.resolveBurst(owner, echo, spot || undefined);
          });
        }
      }
    }
  }

  resolveBeam(owner, move) {
    if (!owner || !move) return;
    const spec = this.beamSpec(owner, move);
    if (!spec) return;
    const now = this.time?.now ?? 0;
    const stepMs = this.stepMs || (1000 / 60);
    const activeMs = Math.max(stepMs, (owner.frameData?.active || 1) * stepMs);
    playVfx(this, owner, { ...move, _suppressBeamArt: true }, 'release', { fired: true });
    if (move.pierce && Math.abs(spec.dy) <= 0.2) {
      const left = spec.dx >= 0 ? spec.x : spec.x - spec.maxLen;
      this.placePassBands(owner, move, left, spec.y, spec.maxLen, spec.thick);
    }
    this.beams ??= [];
    this.beams.push({
      owner,
      move,
      hitUntil: now + activeMs,
      until: owner.stateUntil > now ? owner.stateUntil : now + activeMs,
      born: now,
      landed: new Set(),
      wallFlashed: false,
      swept: false,
      steps: 0,
      gfx: null,
      streaks: null,
    });
  }

  /** Muzzle, direction, and full reach before anything is in the way. */
  beamSpec(owner, move) {
    const bodyW = owner.bodyW ?? 40;
    const bodyH = owner.bodyH ?? 80;
    const worldW = this.world?.width > 0 ? this.world.width : 1280;
    const muzzle = bodySheetMuzzle(owner);
    if (move.aimStick) {
      const aim = stickAim(owner);
      return {
        x: muzzle?.x ?? owner.x + aim.x * bodyW * 0.35,
        y: muzzle?.y ?? owner.y - bodyH * 0.58 + aim.y * bodyH * 0.12,
        dx: aim.x,
        dy: aim.y,
        maxLen: Math.min(move.beamCap ?? 1100, (move.beamLen ?? 420) * (move._beamScale || 1)),
        thick: move.beamThick ?? 36,
      };
    }
    const nozzleArt = artFor(owner.charDef?.id, move.name);
    if (nozzleArt?.unit?.frames?.length) {
      const held = handheldUnit(owner, nozzleArt.unit);
      const face = owner.facing === 1 ? 1 : -1;
      return {
        x: held.nozzle.x,
        y: held.nozzle.y,
        dx: face,
        dy: 0,
        maxLen: (move.beamLen ?? 520) * (move._beamScale ?? 1),
        thick: move.beamThick ?? 160,
      };
    }
    const face = owner.facing === 1 ? 1 : -1;
    const rawLen = (move.beamLen ?? 160) * (move._beamScale ?? 1);
    let maxLen = move.beamCap > 0 ? Math.min(move.beamCap, rawLen) : rawLen;
    const muzzleX = owner.x + face * bodyW * 0.2;
    if (move.stageWide || move.spanStage) {
      maxLen = face > 0 ? Math.max(48, worldW - muzzleX) : Math.max(48, muzzleX);
    }
    const thick = move.beamThick ?? 20;
    return {
      x: muzzle?.x ?? muzzleX,
      y: muzzle?.y ?? (move.ground ? owner.y - thick * 0.5 : owner.y - bodyH * 0.62),
      dx: face,
      dy: 0,
      maxLen,
      thick,
    };
  }

  stepBeams(time) {
    if (!this.beams?.length) return;
    const solids = stageSolids(this.stage, this.stage?.groundY ?? 560);
    this._clipSolids = solids;
    const keep = [];
    for (const beam of this.beams) {
      const owner = beam.owner;
      const ended = !owner?.alive || owner.state === 'ko' || time > beam.until
        || (beam.steps > 0 && (owner.state !== 'attack' || owner.currentMove !== beam.move));
      if (ended) {
        this.dropBeamGfx(beam);
        continue;
      }
      beam.steps += 1;
      const spec = this.beamSpec(owner, beam.move);
      const blockers = [];
      for (const solid of solids) blockers.push({ kind: 'solid', ground: solid.ground, box: solid });
      for (const target of this.fighters) {
        if (target === owner || !target.alive || target.state === 'ko') continue;
        if (target.state === 'defending' && target.defenseMove?.untargetable) continue;
        const hb = target.getHurtboxRect?.();
        if (!hb || !(hb.width > 0) || !(hb.height > 0)) continue;
        blockers.push({
          kind: 'fighter',
          target,
          box: { left: hb.x, right: hb.x + hb.width, top: hb.y, bottom: hb.y + hb.height },
        });
      }
      const clip = clipBeam(spec, blockers, { pierce: !!beam.move.pierce });
      this.paintBeam(beam, spec, clip);
      const dir = Math.sign(spec.dx) || owner.facing || 1;
      if (time <= beam.hitUntil) {
        if (beam.move.pierce) {
          for (const hit of clip.hits) {
            if (beam.landed.has(hit.target)) continue;
            beam.landed.add(hit.target);
            this.landHit(owner, hit.target, { ...beam.move, _hitAt: hit.point }, dir);
          }
        } else if (clip.hit?.kind === 'fighter' && !beam.landed.has(clip.hit.target)) {
          beam.landed.add(clip.hit.target);
          this.landHit(owner, clip.hit.target, { ...beam.move, _hitAt: clip.point }, dir);
        } else if (clip.hit?.kind === 'solid' && !beam.wallFlashed) {
          beam.wallFlashed = true;
          spawnContactFx(this, owner, null, { ...beam.move, _hitAt: clip.point });
        }
      }
      if (!beam.swept) {
        beam.swept = true;
        this.sweepMarked(owner, beam.move, beam.landed);
      }
      keep.push(beam);
    }
    this.beams = keep;
  }

  paintBeam(beam, spec, clip) {
    if (this.simFast || !this.add) return;
    const reach = Math.max(0, clip?.length ?? 0);
    const art = artFor(beam.owner?.charDef?.id, beam.move?.name);
    const frame = art?.frames?.length
      ? (art.frames[fxFrameIndex(art, (this.time?.now ?? 0) - (beam.born ?? 0))] || art.frames[0])
      : null;
    if (frame?.key && this.add.image) {
      this.dropBeamStreaks(beam);
      if (!beam.gfx?.scene) {
        beam.gfx = this.add.image(spec.x, spec.y, frame.key);
        beam.gfx.setDepth?.(16);
        beam.gfx.setOrigin?.(0, 0.5);
      }
      const srcW = beam.gfx.width || frame.displayW || 1;
      const srcH = beam.gfx.height || frame.displayH || 1;
      const fullW = frame.displayW > 0 ? frame.displayW : srcW;
      const fullH = frame.displayH > 0 ? frame.displayH : srcH;
      const maxLen = spec.maxLen > 0 ? spec.maxLen : fullW;
      const frac = Math.max(0, Math.min(1, reach / maxLen));
      const scale = beamDrawScale(beam.move);
      const height = art.stageFit ? Math.max(4, maxLen * (fullH / fullW)) : Math.max(4, fullH * scale);
      beam.gfx.setTexture?.(frame.key);
      beam.gfx.setOrigin?.(0, 0.5);
      beam.gfx.setCrop?.(0, 0, Math.max(1, (beam.gfx.width || srcW) * frac), beam.gfx.height || srcH);
      beam.gfx.setDisplaySize?.(Math.max(4, reach), height);
      beam.gfx.setPosition?.(spec.x, spec.y);
      beam.gfx.rotation = Math.atan2(spec.dy || 0, spec.dx || 1);
      beam.gfx.setVisible?.(reach > 1);
      const blend = art.blend === 'add' || art.blend === 'additive' || frame.blend === 'add' || frame.blend === 'additive';
      if (blend) beam.gfx.setBlendMode?.('ADD');
      return;
    }
    if (beam.move?.vfx === 'thermite' && this.add.rectangle) {
      beam.gfx?.destroy?.();
      beam.gfx = null;
      this.paintThermite(beam, spec, reach);
      return;
    }
    this.dropBeamStreaks(beam);
    if (!this.add.rectangle) return;
    if (!beam.gfx?.scene) {
      beam.gfx = this.add.rectangle(spec.x, spec.y, 8, spec.thick || 14, beam.move?.vfxColor ?? 0xfff6e8, 0.85);
      beam.gfx.setOrigin?.(0, 0.5);
      beam.gfx.setBlendMode?.('ADD');
      beam.gfx.setDepth?.(16);
    }
    beam.gfx.setPosition?.(spec.x, spec.y);
    beam.gfx.setSize?.(Math.max(4, reach), spec.thick || 14);
    beam.gfx.rotation = Math.atan2(spec.dy || 0, spec.dx || 1);
    beam.gfx.setVisible?.(reach > 1);
  }

  paintThermite(beam, spec, reach) {
    const n = 7;
    if (!beam.streaks) {
      beam.streaks = [];
      for (let i = 0; i < n; i++) {
        const streak = this.add.rectangle(spec.x, spec.y, 8, i % 2 ? 4 : 2, i % 2 ? 0xfff4e0 : 0xff6a1a, 0.8);
        streak.setOrigin?.(0, 0.5);
        streak.setBlendMode?.('ADD');
        streak.setDepth?.(16);
        beam.streaks.push(streak);
      }
    }
    const ang0 = Math.atan2(spec.dy || 0, spec.dx || 1);
    for (let i = 0; i < n; i++) {
      const turn = (i - 3) * 0.14;
      const streak = beam.streaks[i];
      streak.setPosition?.(spec.x, spec.y);
      streak.setSize?.(Math.max(4, reach * 0.72), i % 2 ? 4 : 2);
      streak.rotation = ang0 + turn;
      streak.setVisible?.(reach > 1);
    }
  }

  dropBeamStreaks(beam) {
    if (!beam?.streaks) return;
    for (const streak of beam.streaks) streak.destroy?.();
    beam.streaks = null;
  }

  dropBeamGfx(beam) {
    beam?.gfx?.destroy?.();
    if (beam) beam.gfx = null;
    this.dropBeamStreaks(beam);
  }

  /** Pin a sticky shot to a fighter or a wall and leave its radiation there. */
  pinStuckShot(p, x, y, time, host) {
    p.gfx.x = x;
    p.gfx.y = y;
    p.vx = 0;
    p.vy = 0;
    if (host) {
      p.stuck = host;
      p.stuckOx = x - host.x;
      p.stuckOy = y - host.y;
    } else {
      p.stuck = { _anchor: true, x, y, alive: true, state: 'idle' };
      p.stuckOx = 0;
      p.stuckOy = 0;
    }
    p.dieAt = time + (p.move?.stickMs ?? p.move?.onHit?.root ?? p.move?.onHit?.muteMs ?? 2600);
    this.attachStuckHazard(p);
  }

  /** The sticky zone follows whatever the shot attached to, for the shot's whole life. */
  attachStuckHazard(p) {
    const spec = p.move?.zone;
    if (!spec?.onStick || p._stuckZone) return;
    p._stuckZone = true;
    this.spawnZone(p.owner, { ...spec, useDetonate: true, sheet: true }, p.gfx.x, p.gfx.y, p.move);
    const z = this.zones[this.zones.length - 1];
    if (!z) return;
    z.host = p.stuck;
    z.ox = p.stuck?._anchor ? 0 : p.gfx.x - p.stuck.x;
    z.oy = p.stuck?._anchor ? 0 : p.gfx.y - p.stuck.y;
    p.zone = z;
  }

  dropStuckZone(p) {
    const z = p?.zone;
    if (!z || z.dead) return;
    z.dead = true;
    z.gfx?.destroy?.();
    z.aura?.destroy?.();
    z.aura = null;
  }

  /** Stop a free-flying shot on a wall. A sticky shot stays on the wall. Linger and pierce keep going. */
  projectileHitsWall(p, prevX, prevY, time) {
    if (!p || p.dead || p.pinned || p.stuck || !p.gfx) return false;
    const stick = shotEndOf(p.move) === 'stick';
    if (!stick && !shotStoppedBySolid(p.move)) return false;
    if (p.armAt && time < p.armAt) return false;
    const solids = this._clipSolids || [];
    if (!solids.length) return false;
    const radius = p.radius ?? p.move?.projectileRadius ?? 12;
    const wall = segmentHitsSolid(prevX, prevY, p.gfx.x, p.gfx.y, radius, solids, {
      ignoreGround: shotIgnoresGround(p.move),
    });
    if (!wall) return false;
    for (const victim of this.fighters) {
      if (victim === p.owner || !victim.alive || victim.state === 'ko' || !victim.visible) continue;
      if (victim.state === 'defending' && (victim.defenseMove?.untargetable || victim.defenseMove?.intangible)) continue;
      if (p.landed?.has?.(victim)) continue;
      if (projectileHits(p, victim)) return false;
    }
    p.gfx.x = wall.x;
    p.gfx.y = wall.y;
    if (stick) {
      this.pinStuckShot(p, wall.x, wall.y, time, null);
      return true;
    }
    if (p.move.explodeOnly) {
      this.resolveBurst(p.owner, { ...p.move, radius: p.move.explodeRadius ?? 70, kind: 'burst' }, { x: wall.x, y: wall.y });
    } else {
      this.detonateProjectile(p);
      spawnContactFx(this, p.owner, null, { ...p.move, _hitAt: { x: wall.x, y: wall.y } });
    }
    this.dropProjectileZone(p);
    p.gfx.destroy?.();
    p.dead = true;
    return true;
  }

  /** Faint pass-through marks where a penetrating beam crosses a wall or a block. */
  placePassBands(owner, move, x, y, len, thick) {
    if (!move?.passBands || this.simFast || !this.add?.rectangle) return;
    const left = x;
    const right = x + len;
    const spots = [];
    for (const s of this.stage?.solids || []) {
      if (!(s?.h > 24) || !(s.w > 0)) continue;
      const sLeft = s.x - s.w / 2;
      const sRight = s.x + s.w / 2;
      if (right < sLeft || left > sRight) continue;
      const top = (s.y ?? 0) - s.h;
      const bot = s.y ?? 0;
      if (y < top - 8 || y > bot + 8) continue;
      spots.push(Math.max(left, Math.min(right, s.x)));
    }
    for (const target of this.fighters || []) {
      if (target === owner || !target.alive) continue;
      const blocking = target.state === 'defending' && target.defenseMove
        && (target.defenseMove.kind === 'block' || target.defenseMove.blocks || target.defenseMove.kind === 'wall');
      if (!blocking) continue;
      if (target.x < left || target.x > right) continue;
      spots.push(target.x);
    }
    for (const at of spots) {
      const band = this.add.rectangle(at, y, 8, Math.max(28, thick * 2.4), 0xdff6ff, 0.62);
      band.setBlendMode?.('ADD');
      band.setDepth?.(18);
      this.tweens?.add?.({
        targets: band, alpha: 0, duration: 160,
        onComplete: () => band.destroy(),
      });
    }
  }

  spawnZone(owner, spec, x, y, move) {
    const radius = spec.radius ?? 70;
    if (spec.solo && owner) {
      for (const z of this.zones) {
        if (z.dead || z.owner !== owner || z.spec?.name !== spec.name) continue;
        z.dead = true;
        z.gfx?.destroy?.();
        z.gfx = { destroy() {} };
      }
    }
    if (this.simFast) {
      this.zones.push({
        owner, spec, x, y, radius,
        gfx: { destroy() {} },
        until: this.time.now + (spec.ms ?? 1600),
        next: this.time.now + (spec.delay ?? 0),
      });
      return;
    }
    const painted = artFor(owner?.charDef?.id, move?.name || spec.name || owner?.currentMove?.name);
    if (spec.trap && painted?.frames?.length) {
      const face = owner?.facing || 1;
      const gfx = placeFxImage(this, painted, x, y, face);
      gfx?.setDepth?.(5);
      this.zones.push({
        owner, spec, x, y, radius,
        gfx: gfx || { destroy() {} },
        art: painted, face,
        born: this.time.now,
        until: this.time.now + (spec.ms ?? 1600),
        next: this.time.now + (spec.delay ?? 0),
      });
      return;
    }
    const stain = painted?.stain;
    if (stain?.frames?.length && !spec.sheet) {
      const gy = groundTop(this, x, y);
      const frame = stain.frames[0];
      const gfx = this.add.image(x, gy, frame.key);
      gfx.setOrigin(stain.pivotX ?? 0.5, stain.pivotY ?? 1);
      gfx.setDisplaySize(frame.displayW, frame.displayH);
      gfx.setDepth(4);
      const blend = frame.blend || stain.blend;
      if (blend === 'add') gfx.setBlendMode?.('ADD');
      else if (blend === 'screen') gfx.setBlendMode?.('SCREEN');
      this.zones.push({
        owner, spec, x, y: gy, radius, gfx,
        stain, stainBorn: this.time.now,
        until: this.time.now + (spec.ms ?? 1600),
        next: this.time.now + (spec.delay ?? 0),
      });
      return;
    }
    const sheetArt = spec.useDetonate && painted?.detonate?.frames?.length
      ? painted.detonate
      : (spec.useHold && painted?.hold?.frames?.length ? painted.hold : painted);
    if (spec.sheet && sheetArt?.frames?.length) {
      const face = owner?.facing || 1;
      const gfx = placeFxImage(this, sheetArt, x, y, face);
      gfx?.setDepth?.(6);
      let aura = null;
      if (painted?.stain?.frames?.length) {
        aura = placeFxImage(this, painted.stain, x, y, 1);
        aura?.setDepth?.(5);
      }
      this.zones.push({
        owner, spec, x, y, radius,
        gfx: gfx || { destroy() {} },
        art: sheetArt, face,
        aura, auraArt: painted.stain || null, auraBorn: this.time.now,
        born: this.time.now,
        until: this.time.now + (spec.ms ?? 1600),
        next: this.time.now + (spec.delay ?? 0),
      });
      return;
    }
    if (painted?.frames?.length) {
      this.zones.push({
        owner, spec, x, y, radius,
        gfx: { destroy() {} },
        until: this.time.now + (spec.ms ?? 1600),
        next: this.time.now + (spec.delay ?? 0),
      });
      return;
    }
    const color = spec.color ?? 0xff8844;
    const gfx = spec.trap
      ? this.add.ellipse(x, y, radius * 2.4, Math.max(8, radius * 0.55), color, 0.92)
      : this.add.circle(x, y, radius, color, 0.28);
    gfx.setStrokeStyle?.(2, spec.trap ? 0x6a4a10 : color, spec.trap ? 0.95 : 0.8);
    this.zones.push({
      owner, spec, x, y, radius, gfx,
      until: this.time.now + (spec.ms ?? 1600),
      next: this.time.now + (spec.delay ?? 0),
    });
  }

  updateZones(time) {
    for (const z of this.zones) {
      if (z.art && z.gfx?.scene) {
        const elapsed = time - (z.born || time);
        stepPlacedFx(z.gfx, z.art, elapsed, z.face || 1);
        if (z.art.maxAlpha > 0) z.gfx.setAlpha?.(z.art.maxAlpha);
        if (z.art.scaleIn > 0 && z.gfx.setScale) {
          const grow = Math.min(1, elapsed / z.art.scaleIn);
          const s = 0.3 + 0.7 * grow;
          const fadeMs = z.art.fadeMs > 0 ? z.art.fadeMs : 0;
          let alpha = 1;
          if (fadeMs > 0) {
            const left = (z.until || time) - time;
            if (left < fadeMs) alpha = Math.max(0, left / fadeMs);
          }
          const face = (z.face || 1) < 0 ? -1 : 1;
          z.gfx.setScale(face * Math.abs(z.gfx.scaleX || 1) * s, Math.abs(z.gfx.scaleY || 1) * s);
          z.gfx.setAlpha?.(alpha);
        }
      }
      if (z.aura?.scene && z.auraArt) stepPlacedFx(z.aura, z.auraArt, time - (z.auraBorn || time), 1);
      if (z.stain?.frames?.length && z.gfx?.setTexture) {
        const frame = z.stain.frames[fxFrameIndex(z.stain, time - (z.stainBorn || time))] || z.stain.frames[0];
        z.gfx.setTexture(frame.key);
        z.gfx.setDisplaySize(frame.displayW, frame.displayH);
        if (z.stain.pulse) {
          const wave = 0.55 + 0.45 * Math.sin((time - (z.stainBorn || time)) * 0.008);
          z.gfx.setAlpha?.(wave);
        }
      }
      if (z.host) {
        if (!z.host._anchor && (!z.host.alive || z.host.state === 'ko' || z.host.state === 'dead')) {
          z.until = time;
        } else {
          z.x = z.host.x + (z.ox || 0);
          z.y = z.host.y + (z.oy || 0);
          z.gfx?.setPosition?.(z.x, z.y);
        }
      }
      if (z.spec?.drift && z.gfx?.scene) {
        const dt = Math.min(40, time - (z._driftAt ?? time));
        z._driftAt = time;
        z.x += (z.face || 1) * z.spec.drift * dt / 1000;
        z.gfx.setPosition?.(z.x, z.y);
      }
      if (z.spec?.follow && z.owner?.alive) {
        z.x = z.owner.x;
        z.y = z.owner.y - (z.owner.bodyH ?? 80) * 0.35;
        z.gfx?.setPosition?.(z.x, z.y);
      }
      if (time >= z.until) {
        z.gfx.destroy();
        z.aura?.destroy?.();
        z.aura = null;
        z.dead = true;
        continue;
      }
      if (z.spec.trap) {
        if (time < z.next) continue;
        let ownerOn = false;
        for (const target of this.fighters) {
          if (!target.alive || target.state === 'ko') continue;
          if (!hurtHitsCircle(target, z.x, z.y, z.radius)) continue;
          if (target === z.owner && !z.live) {
            ownerOn = true;
            continue;
          }
          this.landHit(z.owner, target, {
            name: z.spec.name ?? 'trap',
            type: z.spec.type,
            damage: z.spec.damage ?? 1,
            type2: z.spec.type2,
            damage2: z.spec.damage2,
            baseKnockback: z.spec.knockback ?? 220,
            knockbackGrowth: z.spec.growth ?? 2,
            angleDeg: z.spec.angleDeg ?? 0,
            kind: 'melee',
            trip: !!z.spec.trip,
            tripMs: z.spec.tripMs,
          });
          if (z.art?.burst?.frames?.length) {
            spawnFxSprite(this, z.art.burst, z.x, z.y, 1, z.face || 1);
          }
          z.gfx?.destroy?.();
          z.aura?.destroy?.();
          z.aura = null;
          z.dead = true;
          break;
        }
        if (!ownerOn) z.live = true;
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
      const stuckBody = z.host && !z.host._anchor ? [z.host] : this.fighters;
      for (const target of stuckBody) {
        if (target === z.owner || !target.alive || target.state === 'ko') continue;
        if (target !== z.host && !hurtHitsCircle(target, z.x, z.y, z.radius)) continue;
        if (z.spec.gas && target.state === 'defending' && target.defenseMove?.absorbGas) {
          if (time >= (target._spongeAt ?? 0)) {
            target._spongeAt = time + 1000;
            const heal = target.defenseMove.cloudHeal ?? 1;
            target.percent = Math.max(0, (target.percent ?? 0) - heal);
            target.absorbedGas = true;
          }
          continue;
        }
        if (z.spec.percentOnly) {
          const dealt = z.spec.flat
            ? (tickDamage ?? 0)
            : resolvePacket(
              tickDamage, z.spec.type, z.owner?.charDef?.combat, target.charDef?.combat,
            );
          applyDot(target, dealt, z.spec.type || 'chemical');
          if (z.spec.onHit) applyOnHit(z.owner, target, { name: z.spec.name, onHit: z.spec.onHit }, time);
          continue;
        }
        if (z.spec.statusCling && z.owner?.charDef?.id) {
          const until = time + 480;
          if (!target.clingFrom || target.clingFrom.until < until) {
            target.clingFrom = { id: z.owner.charDef.id, move: z.spec.statusCling, until };
          }
          target._poisonLevel = (target._poisonLevel ?? 0) + 1;
        }
        this.landHit(z.owner, target, {
          name: z.spec.name ?? 'zone',
          type: z.spec.type,
          damage: tickDamage,
          type2: z.spec.type2,
          damage2: z.spec.damage2,
          baseKnockback: z.spec.knockback ?? 40,
          knockbackGrowth: z.spec.growth ?? 0.4,
          onHit: z.spec.onHit,
          bonusVsId: z.spec.bonusVsId,
          fixed: !!z.spec.fixed,
          kind: 'burst',
          hitlagMult: 0,
          _projectile: true,
          // Standing in a cloud is damage over time: percent only.
          dot: true,
        });
        if (z.spec.slide) {
          target.slipperyUntil = time + 280;
          target.slipperyMult = 1.45;
        }
      }
    }
    this.zones = this.zones.filter((z) => {
      if (!z.dead) return true;
      z.aura?.destroy?.();
      z.aura = null;
      return false;
    });
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
    if (dmg > 0) {
      if (!move.dot) spawnContactFx(this, attacker, victim, move);
      this.noteHit(attacker, victim, move);
      if (!move.dot && !this.simFast) {
        rumbleSlot(victim.controlSlot, {
          duration: 150,
          strong: Math.min(1, 0.4 + dmg / 28),
          weak: 0.35,
        });
      }
    }
    if (attacker !== victim) victim.lastHitBy = attacker;
    // Hitlag lives on the fighters (feel.js). The world clock keeps moving
    // so other players, projectiles and the stage do not freeze.
  }

  beginFinish(victim, info) {
    if (this.simFast || this.finishing) return;
    this.finishing = true;
    const finalBlow = !!(info?.final);
    this.finishFinal = finalBlow;
    // Hold the hit, then drop into slow motion. The camera stays on the
    // group; a KO does not punch the zoom in on the victim.
    this.timeScale = 0;
    this.freezeLeft = FEEL.koFreezeFrames;
    this.finishLeft = finalBlow ? FEEL.koSlowFrames : FEEL.stockSlowFrames;
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
    // No pausing while the match card / stage intro is still playing.
    if (this.intro?.active) return;
    if (this.scene.isPaused('Battle')) return; // handled by pause scene resume
    this.scene.pause();
    const stocksMax = this.setup.stocks ?? 3;
    this.scene.launch('PauseMenu', {
      resumeKey: 'Battle',
      stageName: this.stage?.name || '',
      fighters: (this.fighters || []).map((f) => ({
        name: f.charDef?.name || 'Fighter',
        symbol: f.charDef?.symbol || '',
        percent: Math.round(f.percent || 0),
        stocks: f.stocks ?? 0,
        stocksMax,
      })),
    });
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
    syncFxActors(this);
    syncChargeGlow(this);
    syncMoveFx(this);
    syncCoats(this);
    syncAuras(this);
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
      for (const r of debugDashCells(f)) this.boxGfx.fillRect(r.x, r.y, r.w, r.h);
      const ribbon = slashRibbon(f, 14);
      if (ribbon?.outer?.length) {
        this.boxGfx.fillStyle(0xff4040, 0.5);
        this.boxGfx.beginPath();
        ribbon.outer.forEach((p, i) => (i ? this.boxGfx.lineTo(p.x, p.y) : this.boxGfx.moveTo(p.x, p.y)));
        for (let i = ribbon.inner.length - 1; i >= 0; i--) this.boxGfx.lineTo(ribbon.inner[i].x, ribbon.inner[i].y);
        this.boxGfx.closePath();
        this.boxGfx.fillPath();
      }
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
    this.boxGfx.fillStyle(0xff4040, 0.5);
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
      this.boxGfx.fillPath();
      this.boxGfx.strokePath();
      return;
    }
    const w = (shape.rx || 8) * 2;
    const h = (shape.ry || 8) * 2;
    this.boxGfx.fillEllipse(shape.x, shape.y, w, h);
    this.boxGfx.strokeEllipse(shape.x, shape.y, w, h);
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
    if (clockEndsRound() && this.setup.playtestMs && !this.reportPublished && time >= this.setup.playtestMs) {
      this.matchOver = true;
      this.publishPlaytestReport();
    }
    if (this.matchOver) return;
    this.updateMovingPlatforms(delta);
    if (this.nav) for (const L of this.nav.lifts) this.nav.setLiftY(L.mover, this.movers[L.mover].y);

    // feed input into fighters — slots 0/1 read the keyboard, 20+ read a
    // gamepad, 2-5 read whatever their phone last sent (or all-false if it's
    // disconnected, so a dropped phone just leaves its fighter standing idle
    // instead of crashing the match), and bots run the CPU controller.
    const introLocked = this.intro?.active || this.simNow < this.introLockUntil;
    if (!this.simFast) pollGamepads();
    if (this.intro?.active) {
      // phone attack, or X/Square on a gamepad, skips the intro (edge-triggered)
      for (const f of this.fighters) {
        if (f.isBot || this.keymaps[f.controlSlot]) continue;
        const c = isGamepadSlot(f.controlSlot)
          ? fighterInputForSlot(f.controlSlot).attack
          : phoneNet.getInput(f.controlSlot).confirm;
        if (c && !this.introPhonePrev[f.controlSlot]) this.intro.skip();
        this.introPhonePrev[f.controlSlot] = c;
      }
    }
    let padPause = false;
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
        // Down is held for the whole drop, including the scripted charge, so a
        // one-way platform cannot catch the bot on the next frame.
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
      } else if (isGamepadSlot(f.controlSlot)) {
        const pad = fighterInputForSlot(f.controlSlot);
        f.input.left = pad.left;
        f.input.right = pad.right;
        f.input.jump = pad.jump;
        f.input.down = pad.down;
        f.input.attack = pad.attack;
        f.input.special = pad.special;
        if (padBySlot(f.controlSlot)?.input.pause) padPause = true;
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
    if (padPause && !this.prevPadPause) this.togglePause();
    this.prevPadPause = padPause;

    for (const f of this.fighters) f.update(time, delta);
    this.holdOutlines();
    tickChargeOrbits(this, time);
    tickGeysers(this, time);
    const collisionStart = globalThis.performance.now();
    this.pushBlockers ??= pushSolids(this.stage, this.stage?.groundY);
    resolvePush(this.fighters, this.pushBlockers);
    resolveGrab(this.fighters, time, FEEL);
    this.stepBeams(time);
    this.updateZones(time);
    this.updateMines(time);

    // `wall`-kind defensive moves (e.g. Hydra's Dual Flame Wall) are also an
    // active hazard: two zones flanking the fighter that damage anyone who
    // touches them, once per activation (tracked in f.wallLanded).
    for (const f of this.fighters) {
      if (f.state !== 'defending' || f.defenseMove?.kind !== 'wall' || f.defenseMove.wallLingerMs) continue;
      const m = f.defenseMove;
      const y = f.y - f.bodyH * (m.wallYFrac ?? 0.75);
      const front = f.facing === 1 ? f.x + f.bodyW / 2 : f.x - f.bodyW / 2 - m.wallRangeW;
      const sides = m.frontOnly
        ? [front]
        : [f.x - f.bodyW / 2 - m.wallRangeW, f.x + f.bodyW / 2];
      for (const wx of sides) this.touchWall(f, m, wx, y, f.wallLanded, f.defenseStart ?? time, time);
    }
    if (this.lingeringWalls?.length) {
      const keep = [];
      for (const w of this.lingeringWalls) {
        if (time >= w.until) {
          w.shell?.destroy?.();
          w.goo?.destroy?.();
          continue;
        }
        const elapsed = time - w.born;
        if (w.shell && w.art) stepPlacedFx(w.shell, w.art, elapsed, w.face || 1);
        if (w.goo && w.art?.linger) stepPlacedFx(w.goo, w.art.linger, elapsed, w.face || 1);
        this.touchWall(w.owner, w.move, w.wx, w.y, w.landed, w.born, time);
        keep.push(w);
      }
      this.lingeringWalls = keep;
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
            hit.next.set(victim, time + (hit.move.hitGap ?? 90));
          }
          let swing = hit.move;
          if (swing.combo) {
            attacker._comboHit = true;
            attacker._comboUntil = time + (swing.combo.window ?? 480);
          }
          if (swing.sweetSpot) {
            const hb = attacker.getHitboxRect();
            const tip = hb ? (hit.dir === 1 ? hb.right : hb.left) : attacker.x;
            if (hb && Math.abs(victim.x - tip) < hb.width * 0.38) {
              swing = { ...swing, damage: (swing.damage ?? 0) + swing.sweetSpot };
            }
          }
          swing = { ...swing, _hitIndex: n };
          if (n >= 2 && hit.move.echoTint) this.juice?.afterimage?.(attacker, hit.move.echoAlpha || 0.45);
          if (swing.shatter) {
            const hb = attacker.getHitboxRect();
            const tip = hb ? (hit.dir === 1 ? hb.right : hb.left) : victim.x;
            swing = withShatter(swing);
            attacker._bladeDown = true;
            playVfx(this, attacker, swing, 'shatter', {
              x: tip,
              y: victim.y - (victim.bodyH ?? 80) * 0.45,
            });
          }
          this.landHit(attacker, victim, swing, hit.dir);
        }
      }
    }

    // projectiles
    this._clipSolids = stageSolids(this.stage, this.stage?.groundY ?? 560);
    for (const p of this.projectiles) {
      const prevX = p.gfx?.x ?? 0;
      const prevY = p.gfx?.y ?? 0;
      if (p.slowFx?.scene && p.gfx) {
        stepPlacedFx(p.slowFx, p.slowArt, time - (p.slowBorn || time), 1);
        p.slowFx.setPosition(p.gfx.x, p.gfx.y);
        p.slowFx.setScale(0.5);
      }
      if (p.move.returns && !p.returning && time > p.born + p.move.projectileLife * 0.45) {
        p.vx *= -1;
        if (p.move.aimStick) p.vy *= -1;
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
          if (f.state === 'defending' && f.defenseMove?.untargetable) continue;
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
          const pin = f.state === 'defending' ? f.defenseMove?.pinProjectiles : 0;
          if (!pin || f === p.owner || !f.alive) continue;
          if (!inPinZone(f, p.gfx.x, p.gfx.y, pin)) continue;
          p.pinned = true;
          p.pinFreeze = !!f.defenseMove?.pinFreeze;
          p.pinOwner = f;
          this.attachPinLock(p, f);
          p.vx = 0;
          p.vy = 0;
          p.move = { ...p.move, damage: 0, damage2: 0, explodeOnly: false, dropZone: null, igniteAt: 0, homing: 0 };
          break;
        }
      }
      if (!p.dead && p.move.pullProjectiles > 0 && !p.pinned) {
        const reach = p.move.pullProjectiles;
        const strength = p.move.pullStrength ?? 18;
        for (const other of this.projectiles) {
          if (other === p || other.dead || other.pinned || !other.gfx) continue;
          const dx = p.gfx.x - other.gfx.x;
          const dy = p.gfx.y - other.gfx.y;
          const dist = Math.hypot(dx, dy);
          if (!(dist > 0.5) || dist > reach) continue;
          other.vx += (dx / dist) * strength;
          other.vy += (dy / dist) * strength;
          if (dist < (p.radius ?? 16) + (other.radius ?? 12)) {
            other.gfx.destroy?.();
            other.dead = true;
          }
        }
      }
      if (!p.dead) {
        for (const f of this.fighters) {
          const pull = (f.state === 'attack' && f.currentMove?.attractProjectiles)
            || (f.state === 'defending' && f.defenseMove?.attractProjectiles);
          if (!pull || f === p.owner || !f.alive) continue;
          const strength = typeof pull === 'number' ? pull : 16;
          if (Math.abs(f.x - p.gfx.x) > 220 || Math.abs(f.y - p.gfx.y) > 160) continue;
          p.vx += Math.sign(f.x - p.gfx.x || 1) * strength;
          p.vy += Math.sign((f.y - f.bodyH * 0.5) - p.gfx.y || 1) * strength * 0.35;
          if (Math.abs(f.x - p.gfx.x) < 28 && Math.abs((f.y - f.bodyH * 0.5) - p.gfx.y) < 40) {
            // Banking Absorb: credit the soaked shot into her charge bank.
            if (f.state === 'defending' && f.defenseMove?.powersCharge) {
              const dmg = (p.move?.damage ?? 0) + (p.move?.damage2 ?? 0);
              if (dmg > 0) {
                const cap = f.charDef.moves.basicCharge?.bankCap ?? 18;
                f._storedCharge = Math.min(cap, (f._storedCharge ?? 0) + dmg * 0.6);
              }
              playVfx(this, f, f.defenseMove, 'absorb', { x: p.gfx.x, y: p.gfx.y });
            }
            p.gfx.destroy();
            p.dead = true;
          }
          break;
        }
      }
      if (p.dead) {
        this.clearPinLock(p);
        continue;
      }
      if (p.stuck) {
        const host = p.stuck;
        const gone = !host?.alive || host.state === 'ko' || host.state === 'dead';
        if (gone || time > p.dieAt) {
          this.dropStuckZone(p);
          p.gfx.destroy();
          p.dead = true;
          continue;
        }
        p.gfx.x = host.x + p.stuckOx;
        p.gfx.y = host.y + p.stuckOy;
        stepFxProjectile(p, time);
        if (p.pinFoot) p.gfx.rotation = p.stickRot;
        continue;
      }
      if (p.spiraling && this.stepSpiralReflect(p, time)) continue;
      if (!p.slowed) {
        for (const f of this.fighters) {
          if (f.state !== 'defending') continue;
          const def = f.defenseMove;
          const mul = def?.slowMetals ?? def?.slowProjectiles;
          if (!(mul > 0 && mul < 1)) continue;
          if (def.slowMetals && !p.owner?.charDef?.combat?.metal) continue;
          if (Math.abs(f.x - p.gfx.x) < 110 && Math.abs(f.y - p.gfx.y) < 110) {
            p.vx *= mul;
            p.vy *= mul;
            p.slowed = true;
            const field = artFor(f.charDef?.id, def.name)?.field;
            if (field?.frames?.length && !p.slowFx) {
              p.slowFx = placeFxImage(this, field, p.gfx.x, p.gfx.y, 1);
              p.slowFx?.setDepth?.(8);
              p.slowArt = field;
              p.slowBorn = time;
            }
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
      const holdSky = p.armAt && time < p.armAt && p.move.fromAbove;
      if (p.pinned) {
        if (!p.pinFreeze) p.gfx.y += (90 * delta) / 1000;
        this.stepPinLock(p, time);
      }
      else if (holdSky) {
        // A delayed call-down stays overhead until its timer, then falls.
      } else if (p.move.roll || p.move.floor) {
        p.gfx.x += (p.vx * delta) / 1000;
        p.vy = 0;
        if (p.move.floor) {
          const gy = groundTop(this, p.gfx.x, p.gfx.y + 24);
          p.gfx.y = gy - (p.fxDisplayH || 0) * (p.move.floorLift ?? 0);
        }
        stepFxProjectile(p, time);
      } else if (!(p.move.orbitMs && !p.orbited && time < p.born + p.move.orbitMs)) {
        if (p.move.fromAbove && p.move.fallAccel) {
          p.vy += (p.move.fallAccel * delta) / 1000;
        }
        p.gfx.x += (p.vx * delta) / 1000;
        p.gfx.y += (p.vy * delta) / 1000 + Math.sin(time / 90) * 0.25;
        stepFxProjectile(p, time);
        this.leaveTracer(p, time);
        if (p.move.stageBounce && !p.pinned) this.bounceAroundStage(p);
      }
      if (p.move.can && !p.pinned && this.stepCan(p)) continue;
      else if (p.move.ricochet && !p.pinned) {
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
      if (p.carried && p.move.carry && !p.pinned) {
        const want = p.move.multiHit ?? 1;
        for (const carried of p.carried) {
          if (!carried.alive || !carried.body || carried.state === 'ko') continue;
          if ((p.counts?.get(carried) ?? 0) >= want) continue;
          carried.body.setVelocity(p.vx * 0.95, Math.min(-28, carried.body.velocity.y));
        }
      }
      if (p.hatchAt && !p._hatched && time >= p.hatchAt) {
        p._hatched = true;
        p._showHot = true;
        this.resolveBurst(p.owner, {
          ...p.move,
          radius: p.move.explodeRadius ?? 58,
          kind: 'burst',
          hatch: null,
          landBurst: null,
          _noVfx: true,
        }, { x: p.gfx.x, y: p.gfx.y });
        p.gfx.destroy();
        p.dead = true;
        continue;
      }
      if (p.move.landBurst && p.move.lob && !p.pinned && !p._hatched && p.vy > 20) {
        const gy = groundTop(this, p.gfx.x, p.gfx.y + 48);
        if (p.gfx.y >= gy - 8) {
          p.gfx.y = gy;
          if (p.move.hatch) {
            p.pinned = true;
            p.pinFreeze = true;
            p.vx = 0;
            p.vy = 0;
            p.hatchAt = time + (p.move.hatch.ms ?? 1000);
            p.dieAt = p.hatchAt + 240;
            const heat = artFor(p.owner?.charDef?.id, p.move.name)?.hot;
            if (heat?.frames?.length) spawnFxSprite(this, heat, p.gfx.x, gy, 1, 1);
            continue;
          }
          if (p.move.explodeOnly) {
            this.resolveBurst(p.owner, { ...p.move, radius: p.move.explodeRadius ?? 70, kind: 'burst' }, { x: p.gfx.x, y: gy });
            this.dropProjectileZone(p);
            p.gfx.destroy();
            p.dead = true;
            continue;
          }
        }
      }
      if (this.projectileHitsWall(p, prevX, prevY, time)) continue;
      const off = p.gfx.x < -80 || p.gfx.x > this.world.width + 80 || p.gfx.y > this.world.height + 80;
      if (time > p.dieAt || off) {
        if (!off && this.nearOwnerCleanse(p)) {
          p.gfx.destroy();
          p.dead = true;
          continue;
        }
        if (p.move.pop && p.carried && !p.pinned) {
          for (const carried of p.carried) {
            if (!carried.alive || carried.state === 'ko') continue;
            this.landHit(p.owner, carried, {
              name: p.move.name,
              type: p.move.pop.type ?? p.move.type2 ?? p.move.type,
              damage: p.move.pop.damage ?? 4,
              baseKnockback: p.move.pop.knockback ?? 240,
              knockbackGrowth: p.move.pop.growth ?? 4,
              lift: true,
              kind: 'burst',
            });
          }
        }
        const missed = !!(p.move.fizzleOnMiss && !(p.landed && p.landed.size));
        if (missed && !off && !p.move._ghost) {
          playVfx(this, p.owner, p.move, 'fizzle', { x: p.gfx.x, y: p.gfx.y });
        } else if (p.move.explodeOnly && !p.pinned && !p.move._ghost) this.resolveBurst(p.owner, { ...p.move, radius: p.move.explodeRadius ?? 70, kind: 'burst' }, { x: p.gfx.x, y: p.gfx.y });
        else if (!off && !p.move._ghost) this.detonateProjectile(p);
        if (!p.pinned && !p.move._ghost) this.dropProjectileZone(p);
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
      if (p.move._ghost || p.pinned || (p.armAt && time < p.armAt)) continue;
      for (const victim of this.fighters) {
        if (victim === p.owner || !victim.alive || victim.state === 'ko' || !victim.visible || p.landed.has(victim)) continue;
        if (victim.state === 'defending' && victim.defenseMove?.untargetable) continue;
        if (victim.state === 'defending' && victim.defenseMove?.intangible) continue;
        if (p.next && time < (p.next.get(victim) ?? 0)) continue;
        if (p.move.unseen && fighterInView(p.owner, victim)) continue;
        if (!projectileHits(p, victim)) continue;
        if (victim.state === 'defending' && victim.defenseMove?.outline && !p.pinned) {
          this.bounceOffOutline(p, victim);
          continue;
        }
        if (this.nearOwnerCleanse(p)) {
          p.gfx.destroy();
          p.dead = true;
          break;
        }
        const def = victim.defenseMove;
        const perfect = def?.reflectProjectiles === 'perfect'
          && time - (victim.defenseStart ?? time) <= (def.perfectMs ?? 200);
        const metalShot = !!(p.owner?.charDef?.combat?.metal);
        if (victim.state === 'defending' && def?.catchMetals && metalShot && !p.pinned) {
          p.pinned = true;
          p.pinOwner = victim;
          this.attachPinLock(p, victim);
          p.caught = true;
          p._caughtSpeed = Math.hypot(p.vx, p.vy) || p.move.projectileSpeed || 420;
          p.vx = 0;
          p.vy = 0;
          break;
        }
        const reflect = def?.reflectProjectiles === true || perfect || (def?.reflectMetals && metalShot);
        if (victim.state === 'defending' && reflect && def?.spiralReflect && !p.spiraling && !p._spiraled) {
          this.catchInSpiral(p, victim, time);
          break;
        }
        if (victim.state === 'defending' && reflect) {
          this.landHit(victim, p.owner, { ...p.move, _hitAt: { x: p.gfx.x, y: p.gfx.y } }, -Math.sign(p.vx) || victim.facing);
          this.detonateProjectile(p);
          p.gfx.destroy();
          p.dead = true;
          break;
        }
        const want = p.move.multiHit ?? 1;
        const n = (p.counts?.get(victim) ?? 0) + 1;
        p.counts ??= new Map();
        p.counts.set(victim, n);
        if (n >= want) p.landed.add(victim);
        else {
          p.next ??= new Map();
          p.next.set(victim, time + (p.move.hitGap ?? 170));
        }
        let shot = p.move;
        if (p.move.carry && n >= want) {
          shot = { ...shot, lift: true, baseKnockback: shot.popKnockback ?? shot.baseKnockback ?? 220 };
        }
        if (shot.tipBonus && p.owner && Math.abs(p.gfx.x - p.owner.x) >= (shot.tipAt ?? 260)) {
          shot = { ...shot, damage: (shot.damage ?? 0) + shot.tipBonus };
        }
        if (shot.growWithDistance && p.bornX != null) {
          const grown = throwGrowth(Math.abs(p.gfx.x - p.bornX), shot.growWithDistance);
          shot = {
            ...shot,
            damage: (shot.damage ?? 0) * grown.damageMult,
            damage2: shot.damage2 != null ? shot.damage2 * grown.damageMult : shot.damage2,
          };
        }
        if (shot.slowHit) {
          const mul = slowHitScale(Math.hypot(p.vx, p.vy));
          shot = {
            ...shot,
            damage: (shot.damage ?? 0) * mul,
            damage2: shot.damage2 != null ? shot.damage2 * mul : shot.damage2,
            _slowMul: mul,
          };
        }
        if (victim.state === 'defending' && victim.defenseMove?.softenProjectiles) {
          const mul = victim.defenseMove.softenProjectiles;
          shot = { ...shot, damage: (shot.damage ?? 0) * mul, damage2: shot.damage2 != null ? shot.damage2 * mul : shot.damage2 };
        }
        if (shot.redFrames) shot = withRedFrame(shot, sheetFrameAt(shot, p.born, time, p._fxFrame));
        if (p.move.explodeOnly) {
          this.resolveBurst(p.owner, { ...p.move, radius: p.move.explodeRadius ?? 70, kind: 'burst' }, { x: p.gfx.x, y: p.gfx.y });
          if (p.move.splinter) this.detonateProjectile(p);
          p.gfx.destroy();
          p.dead = true;
          break;
        }
        // a projectile shoves you the way it was travelling
        const counted = p.move._salvoIndex
          ? { ...shot, multiHit: p.move._salvoCount, _hitIndex: p.move._salvoIndex }
          : { ...shot, _hitIndex: n };
        this.landHit(p.owner, victim, { ...counted, _projectile: true, _travel: p.vx, _hitAt: { x: p.gfx.x, y: p.gfx.y } }, Math.sign(p.vx) || p.owner.facing);
        if (p.move.stick && n >= want) {
          if (p.move.pinFoot) {
            const face = Math.sign((victim.x ?? 0) - (p.owner?.x ?? victim.x)) || p.owner?.facing || 1;
            p.pinFoot = true;
            p.stickRot = Math.atan2(1, face * 0.45);
            this.pinStuckShot(p, victim.x, victim.y, time, victim);
          } else {
            this.pinStuckShot(p, p.gfx.x, p.gfx.y, time, victim);
          }
          break;
        }
        if (p.move.carry && victim.body && n < want) {
          victim.body.setVelocity(p.vx * 0.9, Math.min(victim.body.velocity.y, -60));
          p.carried ??= new Set();
          p.carried.add(victim);
        }
        this.dropProjectileZone(p);
        if (p.move.splitOnHit && !p._splitChild && p.owner) {
          const child = {
            ...p.move,
            splitOnHit: null,
            damage: p.move.splitDamage ?? p.move.damage,
            delayMs: 40,
            _splitChild: true,
            _from: { x: p.gfx.x + Math.sign(p.vx || 1) * 18, y: p.gfx.y },
          };
          if (p.move.splitDeg > 0) {
            const speed = Math.hypot(p.vx, p.vy) || p.move.projectileSpeed || 400;
            const base = Math.atan2(p.vy || 0, p.vx || 1);
            const turn = p.move.splitDeg * Math.PI / 180;
            for (const ang of [base - turn, base + turn]) {
              this.spawnProjectile(p.owner, {
                ...child,
                _vx: Math.cos(ang) * speed,
                _vy: Math.sin(ang) * speed,
              });
            }
          } else {
            const spread = p.move.splitSpread ?? 150;
            this.spawnProjectile(p.owner, { ...child, _vy: -spread * 0.35 });
            this.spawnProjectile(p.owner, { ...child, _vy: spread * 0.35 });
          }
          p._splitChild = true;
        }
        if (shotRemovedOnFighter(p.move) && n >= want) {
          this.detonateProjectile(p);
          p.gfx.destroy();
          p.dead = true;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter((p) => {
      if (p.dead) p.slowFx?.destroy?.();
      return !p.dead;
    });
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
        for (const o of [h.panel, h.disc, h.name, h.sym, h.percent, h.stocks]) o?.setVisible(false);
      }
    }

    this.time.delayedCall(600, () => {
      showGameBanner(this, { winnerName: winner?.charDef.name ?? null, seat: winner ? this.fighters.indexOf(winner) : 0 });
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
