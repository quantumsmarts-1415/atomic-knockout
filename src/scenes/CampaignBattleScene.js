import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx, playHit } from '../engine/sfx.js';
import {
  FONT_DISPLAY, FONT_MONO, THEME, drawFooterHints, drawPanel, drawPortraitDisc, makeButton, textStyle,
} from '../ui/theme.js';
import { enterScene, isLeaving, showScene } from '../ui/flow.js';
import { CHARACTERS } from '../data/characters.js';
import { faceFrame, menuPortraitKey } from '../ui/portraits.js';
import { Rig } from '../engine/Rig.js';
import { frameData } from '../engine/feel.js';
import { authoredClipName } from '../engine/moveSheet.js';
import { createBattle, CHAPTERS, XP_PER_LEVEL, autoplayPhase } from '../campaign/index.js';
import { TERRAIN } from '../campaign/terrain.js';
import { key, ringTiles } from '../campaign/grid.js';
import { tileKey, attackClipName, loadCampaignArt, sheetKey, walkReady, releaseWalk } from '../campaign/art.js';
import { basicMove } from '../campaign/units.js';
import { healAmount, describeMove, effectText } from '../campaign/moves.js';
import { statusTags } from '../campaign/status.js';
import { loadMoveFx, playMoveFx, releaseMoveFx } from '../campaign/fx.js';
import { playMusic, stinger, watch, preload, toggleMute, createMapRotation, MAP_PLAYER_ROTATION, STINGER_BOOST } from '../campaign/music.js';
import { playDialogue, playBossCard } from '../ui/campaignDialogue.js';

const TILE = 64;
const MAPX = 8;
const MAPY = 56;
const PANEL_X = 1040;
const FLIPPABLE = new Set(['plain', 'water', 'floor']);
const HP_PLAYER = 0x3ef0e0;
const HP_ENEMY = 0xff4f5f;
const FEET = 54;
const UNIT_H = 102;

const rangeLabel = (m) => (m.range[0] === m.range[1] ? `${m.range[0]}` : `${m.range[0]}-${m.range[1]}`);
const reachNote = (m) => `Out of reach: range ${rangeLabel(m)}${m.range[1] === 1 ? ' (adjacent tiles only; a diagonal is 2 away)' : ''}`;
/** Shrink a label (down to 10px) and then ellipsise it so it never runs past `maxW`. */
function fitText(t, maxW) {
  let size = parseInt(t.style.fontSize, 10) || 14;
  while (t.width > maxW && size > 10) { size -= 1; t.setFontSize(`${size}px`); }
  if (t.width > maxW) {
    let txt = t.text;
    while (txt.length > 3 && t.width > maxW) { txt = txt.slice(0, -1); t.setText(`${txt.trimEnd()}…`); }
  }
  return t;
}
const tx = (c) => MAPX + c * TILE;
const ty = (r) => MAPY + r * TILE;

export default class CampaignBattleScene extends Phaser.Scene {
  constructor() {
    super('CampaignBattle');
  }

  init(data) {
    this.incoming = data || {};
  }

  // ---------------------------------------------------------------- setup
  create() {
    const { chapterIndex, save, seed } = this.incoming;
    this.chapterIndex = chapterIndex ?? 0;
    this.chapter = CHAPTERS[this.chapterIndex];
    this.save = save;
    this.battle = createBattle(save, this.chapterIndex, seed);
    this.mode = 'busy';
    this.cursor = { x: 0, y: 0 };
    this.views = new Map();
    this.levelUps = [];
    this.cutViews = [];
    this.cutOn = new URLSearchParams(window.location.search).get('cut') !== '0';
    this.speed = Number(new URLSearchParams(window.location.search).get('campspeed')) || 1;
    this.keyHandlers = [];
    this.padPrev = {};
    this.cameras.main.setBackgroundColor(THEME.voidCss);
    this.drawBackdrop();
    this.drawMap();
    this.drawOverlays();
    this.buildPanel();
    this.buildViews();
    this.bindInput();
    this.hints = drawFooterHints(this, [
      { keys: ['←', '↑', '↓', '→'], label: 'Cursor' }, { key: 'ENTER', label: 'Select' }, { key: 'ESC', label: 'Back' }, { key: 'E', label: 'End turn' },
    ], { y: H - 14, width: 1024 + MAPX * 2 });
    enterScene(this);
    this.events.once('shutdown', () => this.cleanup());
    window.__camp = this;
    this.bossMusic = false;
    this.mapRotation = createMapRotation(this.chapterIndex);
    this.playerPhaseAt = 0;
    watch(this.game);
    preload([this.mapRotation.current(), 'map_enemy', 'battle', 'defeat_player', 'defeat_enemy', ...MAP_PLAYER_ROTATION, ...(this.chapter.win === 'boss' || (this.chapter.events || []).some((e) => e.card) ? ['boss'] : [])]);
    // Attack clips stream in behind the map. Until one arrives that unit lunges instead.
    this.noWalk = /[?&]nowalk\b/.test(window.location.search);
    loadCampaignArt(this, this.battle.units.map((u) => u.id), 'attack', () => { this.attackReady = true; });
    const lord = this.battle.units.find((u) => u.lord);
    this.setCursor(lord.x, lord.y);
    this.startPlayerPhase(true);
  }

  cleanup() {
    for (const [ev, fn] of this.keyHandlers) this.input.keyboard?.off(ev, fn);
    this.keyHandlers = [];
    releaseMoveFx(this);
    if (window.__camp === this) window.__camp = null;
  }

  wait(ms) {
    return new Promise((res) => this.time.delayedCall(Math.max(1, ms / this.speed), res));
  }

  tween(cfg) {
    return new Promise((res) => this.tweens.add({ ...cfg, duration: Math.max(1, (cfg.duration || 0) / this.speed), onComplete: () => res() }));
  }

  // ------------------------------------------------------------- drawing
  drawBackdrop() {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(THEME.void, 1);
    g.fillRect(0, 0, W, H);
    g.fillStyle(THEME.ink, 1);
    g.fillRect(0, 0, W, 52);
    g.lineStyle(1, THEME.teal, 0.35);
    g.lineBetween(0, 52, W, 52);
    this.titleText = this.add.text(18, 14, `${this.chapter.kicker}  ·  ${this.chapter.title.toUpperCase()}`, textStyle('h3')).setDepth(5);
    this.objText = this.add.text(W / 2 + 10, 17, `OBJECTIVE: ${this.chapter.objective.toUpperCase()}`, textStyle('label', { color: THEME.goldCss })).setOrigin(0.5, 0).setDepth(5);
    this.turnText = this.add.text(W - 18, 14, '', textStyle('h3', { color: THEME.tealCss })).setOrigin(1, 0).setDepth(5);
  }

  drawMap() {
    const { map } = this.battle;
    this.tileImgs = [];
    const rnd = new Phaser.Math.RandomDataGenerator([String(this.chapterIndex + 7)]);
    for (let r = 0; r < map.h; r++) {
      for (let c = 0; c < map.w; c++) {
        const id = map.tiles[r][c];
        const img = this.add.image(tx(c) + TILE / 2, ty(r) + TILE / 2, tileKey(id)).setDisplaySize(TILE, TILE).setDepth(0);
        if (FLIPPABLE.has(id)) img.setFlip(rnd.pick([true, false]), rnd.pick([true, false]));
        else if (id === 'road') {
          const horiz = map.tiles[r][c - 1] === 'road' || map.tiles[r][c + 1] === 'road';
          const vert = map.tiles[r - 1]?.[c] === 'road' || map.tiles[r + 1]?.[c] === 'road';
          if (horiz && !vert) img.setAngle(90);
          img.setFlipX(rnd.pick([true, false]));
        }
        this.tileImgs.push(img);
      }
    }
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1, 0x07060e, 0.28);
    for (let c = 0; c <= map.w; c++) g.lineBetween(tx(c), MAPY, tx(c), MAPY + map.h * TILE);
    for (let r = 0; r <= map.h; r++) g.lineBetween(MAPX, ty(r), MAPX + map.w * TILE, ty(r));
    // Escape gate
    for (const [ex, ey] of this.chapter.exit || []) {
      const gm = this.add.graphics().setDepth(2);
      gm.lineStyle(3, THEME.gold, 0.95);
      gm.strokeRect(tx(ex) + 3, ty(ey) + 3, TILE - 6, TILE - 6);
      gm.fillStyle(THEME.gold, 0.22);
      gm.fillRect(tx(ex) + 3, ty(ey) + 3, TILE - 6, TILE - 6);
      const ar = this.add.text(tx(ex) + TILE / 2, ty(ey) + TILE / 2, '⇧', { fontFamily: FONT_DISPLAY, fontSize: '34px', color: THEME.goldCss, stroke: '#07060E', strokeThickness: 4 }).setOrigin(0.5).setDepth(2);
      this.tweens.add({ targets: [gm, ar], alpha: { from: 0.45, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    }
    // Seize / boss marker
    const s = this.chapter.seize;
    if (s) {
      this.seizeMark = this.add.graphics().setDepth(2);
      this.seizeMark.lineStyle(2, THEME.gold, 0.9);
      this.seizeMark.strokeRect(tx(s[0]) + 3, ty(s[1]) + 3, TILE - 6, TILE - 6);
      this.tweens.add({ targets: this.seizeMark, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    }
  }

  drawOverlays() {
    this.rangeG = this.add.graphics().setDepth(3);
    this.pathG = this.add.graphics().setDepth(4);
    this.cursorG = this.add.graphics().setDepth(60);
    this.threatShown = null;
  }

  paintRanges({ move = null, attack = null, targets = null } = {}) {
    const g = this.rangeG;
    g.clear();
    const fill = (set, color, alpha) => {
      g.fillStyle(color, alpha);
      for (const t of set.values()) g.fillRect(tx(t.x) + 1, ty(t.y) + 1, TILE - 2, TILE - 2);
    };
    if (attack) fill(attack, 0xff4f5f, 0.34);
    if (move) {
      fill(move, 0x35a8ff, 0.42);
      g.lineStyle(1.5, 0x9fd8ff, 0.6);
      for (const t of move.values()) g.strokeRect(tx(t.x) + 2, ty(t.y) + 2, TILE - 4, TILE - 4);
    }
    if (targets) {
      g.lineStyle(3, 0xffd166, 1);
      for (const u of targets) g.strokeRect(tx(u.x) + 2, ty(u.y) + 2, TILE - 4, TILE - 4);
    }
  }

  paintCursor() {
    const g = this.cursorG;
    g.clear();
    const { x, y } = this.cursor;
    g.lineStyle(3, THEME.gold, 1);
    const L = 16;
    const px = tx(x);
    const py = ty(y);
    for (const [cx, cy, dx, dy] of [[px, py, 1, 1], [px + TILE, py, -1, 1], [px, py + TILE, 1, -1], [px + TILE, py + TILE, -1, -1]]) {
      g.lineBetween(cx, cy, cx + dx * L, cy);
      g.lineBetween(cx, cy, cx, cy + dy * L);
    }
  }

  setCursor(x, y, sound = false) {
    const { map } = this.battle;
    x = Phaser.Math.Clamp(x, 0, map.w - 1);
    y = Phaser.Math.Clamp(y, 0, map.h - 1);
    if (this.cursor.x === x && this.cursor.y === y && this.cursor.painted) return;
    this.cursor = { x, y, painted: true };
    this.paintCursor();
    if (sound) sfx('menuMove');
    this.refreshPanel();
  }

  // --------------------------------------------------------------- units
  buildViews() {
    for (const u of this.battle.units) this.addView(u);
  }

  addView(u) {
    const charDef = CHARACTERS[u.id];
    const cont = this.add.container(tx(u.x) + TILE / 2, ty(u.y) + FEET);
    const ring = this.add.graphics();
    const col = u.lord ? 0xffd166 : u.team === 'player' ? 0x35a8ff : u.team === 'npc' ? 0x53e0a8 : 0xff4f5f;
    ring.fillStyle(col, u.lord ? 0.4 : 0.28);
    ring.fillEllipse(0, -2, u.lord ? 60 : 52, u.lord ? 19 : 16);
    ring.lineStyle(u.lord ? 3 : 2, col, 0.95);
    ring.strokeEllipse(0, -2, u.lord ? 60 : 52, u.lord ? 19 : 16);
    cont.add(ring);
    let rig = null;
    if (this.textures.exists(sheetKey(charDef.art, 'idle'))) {
      rig = new Rig(this, charDef, 0);
      rig.baseScale = UNIT_H / (charDef.art.height || 130);
      rig.facing = u.team === 'enemy' ? -1 : 1;
      cont.add(rig);
    } else {
      const f = this.add.circle(0, -30, 20, col, 0.9);
      cont.add(f);
    }
    const bar = this.add.graphics();
    cont.add(bar);
    let badge = null;
    if (u.lord) {
      // gold crest at the feet (right of the HP bar) plus a floating crown over the head
      badge = this.add.container(0, 0);
      const crest = this.add.graphics();
      crest.fillStyle(0x1a1330, 1); crest.fillCircle(34, 8, 10);
      crest.lineStyle(2, 0xffd166, 1); crest.strokeCircle(34, 8, 10);
      badge.add(crest);
      badge.add(this.add.text(34, 8, '★', { fontFamily: FONT_DISPLAY, fontSize: '14px', color: THEME.goldCss }).setOrigin(0.5));
      const crown = this.add.text(0, -UNIT_H - 14, '♛', { fontFamily: FONT_DISPLAY, fontSize: '20px', color: THEME.goldCss, stroke: '#07060E', strokeThickness: 4 }).setOrigin(0.5);
      badge.add(crown);
      this.tweens.add({ targets: crown, y: crown.y - 5, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      cont.add(badge);
    }
    const view = { u, cont, rig, bar, badge, shownHp: u.hp, grey: false, atk: null, t: Math.random() * 6, moving: false };
    this.views.set(u.uid, view);
    this.paintBar(view);
    this.sortDepth(view);
    return view;
  }

  /** Re-skin a unit's view after it changes sides (a recruit). */
  rebuildView(u) {
    const old = this.views.get(u.uid);
    if (old) { this.tweens.killTweensOf(old.cont); old.cont.destroy(); this.views.delete(u.uid); }
    return this.addView(u);
  }

  sortDepth(v) {
    v.cont.setDepth(10 + v.cont.y / 10);
  }

  /** Small pills under the HP bar: charging, stun, stun immunity, guard, power up, burn, slow, ... */
  paintTags(v) {
    if (!v) return;
    if (v.tags) { v.tags.list.forEach((t) => this.tweens.killTweensOf(t)); v.tags.destroy(); }
    const u = v.u;
    const list = u.alive ? statusTags(u) : [];
    if (!list.length) { v.tags = null; return; }
    const c = this.add.container(0, 20);
    list.slice(0, 4).forEach((tag, i) => {
      const txt = this.add.text(0, i * 17 + 8, tag.label, { fontFamily: FONT_DISPLAY, fontSize: '11px', color: tag.color, letterSpacing: 1 }).setOrigin(0.5, 0.5);
      // a pill under the HP bar, centred on the unit, so the label reads as part of it
      const bg = this.add.graphics();
      const pw = txt.width + 14;
      bg.fillStyle(0x07060e, 0.85); bg.fillRoundedRect(-pw / 2, i * 17, pw, 16, 8);
      bg.lineStyle(1, Phaser.Display.Color.HexStringToColor(tag.color).color, 0.9); bg.strokeRoundedRect(-pw / 2, i * 17, pw, 16, 8);
      c.add(bg); c.add(txt);
      if (tag.id === 'charging') this.tweens.add({ targets: [txt, bg], alpha: 0.45, duration: 380, yoyo: true, repeat: -1 });
    });
    v.cont.add(c);
    v.tags = c;
  }

  paintBar(v) {
    this.paintTags(v);
    const g = v.bar;
    g.clear();
    const w = 50;
    const x = -w / 2;
    const y = 4;
    g.fillStyle(0x000000, 0.75);
    g.fillRect(x - 1, y - 1, w + 2, 8);
    const frac = Phaser.Math.Clamp(v.shownHp / v.u.maxHp, 0, 1);
    g.fillStyle(v.u.team === 'enemy' ? HP_ENEMY : HP_PLAYER, 1);
    g.fillRect(x, y, w * frac, 6);
    g.fillStyle(0xffffff, 0.2);
    g.fillRect(x, y, w * frac, 2);
  }

  setGrey(v, on) {
    v.grey = on;
    v.cont.setAlpha(on ? 0.62 : 1);
    v.rig?.setFlash(on ? 0x7a7a8a : null);
  }

  animateView(v, dt, bob = true) {
    if (!v.rig || !v.rig.active) return;
    if (v.atk) {
      v.atk.t += dt;
      const f = Math.min(v.atk.fd.visible - 1, Math.floor((v.atk.t / v.atk.dur) * v.atk.fd.visible));
      v.rig.attackFrame = Math.max(0, f);
      v.rig.animate(dt, 'attack', 1);
      if (v.atk.t >= v.atk.dur) { v.rig.moveKey = null; v.rig.frameData = null; v.rig.attackFrame = 0; v.rig.currentClip = null; v.atk = null; }
    } else if (v.moving && v.walkOn) {
      v.rig.animate(dt, 'walk', 1);
    } else {
      v.rig.animate(dt, 'idle', 1);
    }
    if (bob && !v.atk && !v.moving) {
      v.t += dt;
      v.rig.y = v.grey ? 0 : -Math.abs(Math.sin(v.t * 2.4)) * 2.2;
    }
  }

  update(_t, dtMs) {
    const dt = Math.min(0.05, dtMs / 1000) * this.speed;
    for (const v of this.views.values()) this.animateView(v, dt, true);
    for (const v of this.cutViews) this.animateView(v, dt, false);
    this.pollGamepad();
    if (this.backBtn) this.backBtn.container.setVisible(this.battle.phase === 'player' && !this.battle.result && ['move', 'menu', 'target'].includes(this.mode));
  }

  /** Does this fighter have its attack clip in memory yet? */
  clipLoaded(u) {
    const c = CHARACTERS[u.id];
    const name = attackClipName(c);
    return !!name && this.textures.exists(sheetKey(c.art, name));
  }

  // ---------------------------------------------------------------- panel
  buildPanel() {
    const x = PANEL_X;
    this.add.graphics().setDepth(4).fillStyle(THEME.ink, 0.9).fillRect(x - 8, 52, W - x + 8, H - 52);
    this.panel = { objs: [] };
    this.endBtn = makeButton(this, { x: x + 4, y: H - 118, w: 208, h: 44, label: 'End Turn', keyHint: 'E', onPress: () => { sfx('menuConfirm'); this.endTurnPressed(); }, depth: 20 });
    this.backBtn = makeButton(this, { x: x + 4, y: H - 168, w: 208, h: 40, label: 'Back', keyHint: 'B', onPress: () => { sfx('menuMove'); this.cancel(); }, depth: 20 });
    this.backBtn.container.setVisible(false);
    this.add.text(x + 8, H - 62, 'Left click: select / confirm\nRight click, Esc, B: cancel\nArrows / WASD: cursor', textStyle('caption', { fontSize: '11px', lineSpacing: 4 })).setDepth(20);
    this.refreshPanel();
  }

  clearPanelObjs() {
    this.panel.objs.forEach((o) => o.destroy());
    this.panel.objs = [];
  }

  pAdd(o) {
    o.setDepth(20);
    this.panel.objs.push(o);
    return o;
  }

  refreshPanel() {
    if (!this.panel) return;
    this.clearPanelObjs();
    const b = this.battle;
    const x = PANEL_X + 4;
    const u = b.unitAt(this.cursor.x, this.cursor.y) || (this.sel && this.sel.alive ? null : null);
    let y = 64;
    this.turnText.setText(`TURN ${b.turn}${this.chapter.win === 'defend' ? ` / ${this.chapter.turns}` : ''}  ·  ${b.phase === 'player' ? 'PLAYER PHASE' : 'ENEMY PHASE'}`);
    if (u) {
      const c = CHARACTERS[u.id];
      const ring = u.team === 'player' ? 0x35a8ff : u.team === 'npc' ? 0x53e0a8 : 0xff4f5f;
      this.pAdd(drawPortraitDisc(this, x + 34, y + 38, 64, {
        textureKey: menuPortraitKey(c), face: faceFrame(this, c), n: c.atomicNumber, sym: c.symbol, ring,
      }));
      this.pAdd(this.add.text(x + 78, y + 8, u.name.toUpperCase(), textStyle('h3', { fontSize: '17px' })));
      this.pAdd(this.add.text(x + 78, y + 30, `Lv ${u.level}  ${u.team === 'player' ? 'ALLY' : u.team === 'npc' ? 'NEUTRAL' : u.boss ? 'BOSS' : 'ENEMY'}`, textStyle('label', { color: u.team === 'enemy' ? THEME.pinkCss : THEME.tealCss })));
      this.pAdd(this.add.text(x + 78, y + 46, u.moveName, textStyle('caption', { fontSize: '12px' })));
      y += 86;
      const bar = this.add.graphics();
      bar.fillStyle(0x000000, 0.7);
      bar.fillRect(x, y, 206, 12);
      bar.fillStyle(u.team === 'enemy' ? HP_ENEMY : HP_PLAYER, 1);
      bar.fillRect(x + 1, y + 1, 204 * Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1), 10);
      this.pAdd(bar);
      this.pAdd(this.add.text(x + 4, y + 16, `HP ${u.hp} / ${u.maxHp}`, textStyle('mono')));
      y += 40;
      const stats = [['DMG+', u.power], ['DEF', u.def], ['SPD', u.spd], ['MOV', u.mov], ['RNG', u.range[0] === u.range[1] ? u.range[0] : `${u.range[0]}-${u.range[1]}`]];
      stats.forEach(([k, v], i) => {
        const cx = x + (i % 3) * 70;
        const cy = y + Math.floor(i / 3) * 38;
        this.pAdd(this.add.text(cx, cy, k, textStyle('label')));
        this.pAdd(this.add.text(cx, cy + 14, String(v), textStyle('h3', { fontSize: '19px' })));
      });
      y += 80;
      if (u.team === 'player') {
        this.pAdd(this.add.text(x, y, `EXP ${u.xp} / ${XP_PER_LEVEL}`, textStyle('label')));
        const xb = this.add.graphics();
        xb.fillStyle(0x000000, 0.7);
        xb.fillRect(x, y + 16, 206, 6);
        xb.fillStyle(THEME.gold, 1);
        xb.fillRect(x, y + 16, 206 * (u.xp / XP_PER_LEVEL), 6);
        this.pAdd(xb);
        y += 26;
      }
      // status effects with their turns left
      const tags = statusTags(u);
      if (tags.length) {
        let tx = x;
        for (const t of tags) {
          const st = (u.status || {})[t.id];
          const label = st && st.turns ? `${t.label} ${st.turns}` : t.label;
          const txt = this.add.text(tx, y, label, textStyle('mono', { fontSize: '10px', color: t.color }));
          this.pAdd(txt);
          tx += txt.width + 8;
          if (tx > x + 190) { tx = x; y += 13; }
        }
        y += 18;
      }
      // the fighter's moves, with cooldowns
      for (const m of u.moves) {
        const cd = u.cd[m.key] || 0;
        const tag = m.action === 'heal' ? `HEAL R${rangeLabel(m)}` : m.action === 'guard' ? 'GRD' : m.action === 'power' ? 'PWR' : m.charge ? `CHG ${m.dmg} R${rangeLabel(m)}` : `${m.dmg} R${rangeLabel(m)}`;
        const col = cd > 0 ? THEME.disabledCss : THEME.mistCss;
        const tagT = this.add.text(x + 204, y, tag, textStyle('mono', { fontSize: '11px', color: col })).setOrigin(1, 0);
        const nameT = this.add.text(x, y, `${m.name}${cd > 0 ? ` (${cd})` : ''}`, textStyle('caption', { fontSize: '11px', color: col }));
        fitText(nameT, 204 - tagT.width - 8);
        this.pAdd(nameT);
        this.pAdd(tagT);
        y += 14;
      }
    }
    // terrain card
    const t = b.tile(this.cursor.x, this.cursor.y);
    const ty0 = 404;
    this.pAdd(drawPanel(this, PANEL_X, ty0, 216, 92, 12, THEME.teal, 0.35));
    const thumb = this.add.image(PANEL_X + 8 + 32, ty0 + 46, tileKey(t.id)).setDisplaySize(56, 56);
    this.pAdd(thumb);
    this.pAdd(this.add.text(PANEL_X + 78, ty0 + 12, t.name.toUpperCase(), textStyle('h3', { fontSize: '15px' })));
    const info = Number.isFinite(t.cost) ? `Move cost ${t.cost}\nDefense +${t.def}\nAvoid +${t.avoid}${t.heal ? `\nHeals ${Math.round(t.heal * 100)}%/turn` : ''}` : 'Impassable';
    this.pAdd(this.add.text(PANEL_X + 78, ty0 + 34, info, textStyle('caption', { fontSize: '11px', lineSpacing: 2 })));
    // counts
    this.pAdd(this.add.text(x, ty0 + 104, `ALLIES ${b.players.length}   FOES ${b.enemies.length}`, textStyle('mono')));
    this.pAdd(this.add.text(x, ty0 + 126, this.objectiveLine(), textStyle('label', { color: THEME.goldCss, wordWrap: { width: 206 } })));
    this.endBtn?.container.setVisible(b.phase === 'player' && !b.result);
    this.endBtn?.zone.setVisible(b.phase === 'player' && !b.result);
  }

  objectiveLine() {
    const b = this.battle;
    const c = this.chapter;
    if (c.win === 'defend') return `HOLD: ${Math.max(0, c.turns - b.turn + 1)} turn(s) to survive`;
    if (c.win === 'escape') return 'GET HYDRA TO THE GOLD GATE';
    if (c.win === 'seize') return 'HYDRA TO THE GOLD TILE';
    if (c.win === 'boss') return `DEFEAT ${(CHARACTERS[c.enemies.find((e) => e.boss)?.id]?.name || 'THE BOSS').toUpperCase()}`;
    return 'ROUT ALL ENEMIES';
  }

  showForecast(att, def, move = null) {
    this.hideForecast();
    const f = this.battle.forecastFor(att, def, move);
    const x = PANEL_X;
    const y = 64;
    const objs = [];
    const add = (o) => { o.setDepth(30); objs.push(o); return o; };
    const solid = this.add.graphics();
    solid.fillStyle(THEME.ink, 1);
    solid.fillRoundedRect(x, y, 216, 330, 12);
    add(solid);
    add(drawPanel(this, x, y, 216, 330, 12, THEME.gold, 0.9));
    add(this.add.text(x + 108, y + 10, f.move ? f.move.name.toUpperCase() : 'FORECAST', textStyle('kicker', { fontSize: '13px' })).setOrigin(0.5, 0));
    const cols = [{ u: att, f: f.att, hits: f.attHits, cx: x + 58 }, { u: def, f: f.def, hits: f.defHits, cx: x + 160 }];
    cols.forEach(({ u, f: s, hits, cx }) => {
      add(this.add.text(cx, y + 36, u.name.toUpperCase(), textStyle('h3', { fontSize: '14px', color: u.team === 'player' ? THEME.tealCss : THEME.pinkCss })).setOrigin(0.5, 0));
      const rows = [
        ['HP', `${u.hp}`],
        ['DMG', s ? `${s.dmg}${hits > 1 ? ` ×${hits}` : ''}` : '—'],
        ['HIT', s ? `${s.hit}%` : '—'],
        ['CRIT', s ? `${s.crit}%` : '—'],
      ];
      rows.forEach(([k, v], i) => {
        add(this.add.text(cx, y + 70 + i * 40, k, textStyle('label')).setOrigin(0.5, 0));
        add(this.add.text(cx, y + 84 + i * 40, v, textStyle('h3', { fontSize: '18px' })).setOrigin(0.5, 0));
      });
    });
    const notes = [];
    if (!f.def) notes.push('No counterattack');
    if (f.attHits === 2) notes.push(`${att.name} strikes twice`);
    if (f.defHits === 2) notes.push(`${def.name} strikes twice`);
    for (const e of f.move?.effects || []) notes.push(effectText(e));
    if (f.move?.charge) notes.push('Fully charged release');
    if (f.att.mult > 1.05) notes.push('Element: effective');
    else if (f.att.mult < 0.95) notes.push('Element: resisted');
    const tile = this.battle.tile(def.x, def.y);
    if (tile.def || tile.avoid) notes.push(`${tile.name}: +${tile.def} DEF, +${tile.avoid} avoid`);
    add(this.add.text(x + 12, y + 228, notes.join('\n'), textStyle('caption', { fontSize: '10px', lineSpacing: 2, wordWrap: { width: 192 } })));
    add(this.add.text(x + 108, y + 308, 'ENTER / click again to attack', textStyle('label', { fontSize: '9px' })).setOrigin(0.5, 1));
    this.forecastObjs = objs;
  }

  hideForecast() {
    if (!this.forecastObjs) return;
    this.forecastObjs.forEach((o) => o.destroy());
    this.forecastObjs = null;
    this.refreshPanel();
  }

  // ---------------------------------------------------------------- input
  bindInput() {
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p) => {
      const c = this.tileAt(p);
      if (c) this.setCursor(c.x, c.y);
    });
    this.input.on('pointerdown', (p) => {
      if (p.rightButtonDown()) { this.cancel(); return; }
      const c = this.tileAt(p);
      if (c) { this.setCursor(c.x, c.y); this.confirm(c.x, c.y); }
    });
    const kb = (names, fn) => {
      for (const n of [].concat(names)) { const ev = `keydown-${n}`; this.input.keyboard.on(ev, fn); this.keyHandlers.push([ev, fn]); }
    };
    kb(['LEFT', 'A'], () => this.arrow(-1, 0));
    kb(['RIGHT', 'D'], () => this.arrow(1, 0));
    kb(['UP', 'W'], () => this.arrow(0, -1));
    kb(['DOWN', 'S'], () => this.arrow(0, 1));
    kb(['ENTER', 'SPACE', 'Z', 'F', 'K'], () => this.confirm(this.cursor.x, this.cursor.y, true));
    kb(['ESC', 'X', 'BACKSPACE', 'B'], () => this.cancel());
    kb(['M'], () => this.toast(`Music: ${toggleMute() ? 'OFF' : 'ON'}`));
    kb(['C'], () => { this.cutOn = !this.cutOn; this.toast(`Battle scenes: ${this.cutOn ? 'ON' : 'OFF'}`); });
    kb(['E', 'TAB'], (ev) => { ev?.preventDefault?.(); this.endTurnPressed(); });
  }

  toast(text) {
    const t = this.add.text(MAPX + 512, MAPY + 20, text, textStyle('label', { fontSize: '14px', color: THEME.goldCss })).setOrigin(0.5).setDepth(98);
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 10, delay: 900, duration: 400, onComplete: () => t.destroy() });
  }

  tileAt(p) {
    const c = Math.floor((p.x - MAPX) / TILE);
    const r = Math.floor((p.y - MAPY) / TILE);
    const { map } = this.battle;
    if (!(c >= 0 && r >= 0 && c < map.w && r < map.h)) return null;
    // Sprites are taller than a tile, so a unit standing one row below paints over this tile's lower half:
    // when the tile itself is empty, a click on that sprite picks the unit (back-line units stay clickable).
    if ((this.mode === 'idle' || this.mode === 'target') && !this.battle.unitAt(c, r)) {
      const below = this.battle.unitAt(c, r + 1);
      const v = below && this.views.get(below.uid);
      if (v && Math.abs(p.x - v.cont.x) <= 24 && p.y >= v.cont.y - (UNIT_H - 14) && p.y < ty(r + 1)) return { x: c, y: r + 1 };
    }
    return { x: c, y: r };
  }

  arrow(dx, dy) {
    if (this.mode === 'menu') { this.menuMove(dy); return; }
    if (this.mode === 'busy' || this.battle.result) return;
    this.setCursor(this.cursor.x + dx, this.cursor.y + dy, true);
  }

  pollGamepad() {
    const pads = navigator.getGamepads?.() || [];
    const p = [...pads].find((g) => g && g.connected);
    if (!p) return;
    const b = (i) => !!p.buttons[i]?.pressed;
    const ax = p.axes[0] || 0;
    const ay = p.axes[1] || 0;
    const now = {
      left: b(14) || ax < -0.6, right: b(15) || ax > 0.6, up: b(12) || ay < -0.6, down: b(13) || ay > 0.6,
      a: b(0), bb: b(1), start: b(9),
    };
    const edge = (k) => now[k] && !this.padPrev[k];
    if (edge('left')) this.arrow(-1, 0);
    if (edge('right')) this.arrow(1, 0);
    if (edge('up')) this.arrow(0, -1);
    if (edge('down')) this.arrow(0, 1);
    if (edge('a')) this.confirm(this.cursor.x, this.cursor.y, true);
    if (edge('bb')) this.cancel();
    if (edge('start')) this.endTurnPressed();
    this.padPrev = now;
  }

  // ----------------------------------------------------------- selection
  confirm(x, y, fromKey = false) {
    const b = this.battle;
    if (b.result || b.phase !== 'player') return;
    if (this.mode === 'menu') { if (fromKey) this.menuPick(); return; }
    if (this.mode === 'busy') return;
    const u = b.unitAt(x, y);
    if (this.mode === 'idle') {
      if (u && u.team === 'player' && !u.acted) this.selectUnit(u);
      else if (u) this.inspectThreat(u);
      else this.clearThreat();
      return;
    }
    if (this.mode === 'move') {
      const sel = this.sel;
      if (u === sel) { this.openMenu(); return; }
      if (u && u.team === 'player' && !u.acted) { this.deselect(); this.selectUnit(u); return; }
      if (this.reach.stops.has(key(x, y))) { this.moveSelected(x, y); return; }
      this.cancel();
      return;
    }
    if (this.mode === 'target') {
      const healing = this.curMove?.action === 'heal';
      const preview = (t) => { if (healing) this.previewHeal(t); else this.showForecast(this.sel, t, this.curMove); };
      if (u && this.targets.includes(u)) {
        if (this.pending === u) (healing ? this.doHeal(u) : this.doAttack(u));
        else { this.pending = u; preview(u); this.paintRanges({ attack: this.atkSet, targets: [u] }); }
      } else if (fromKey && !u && this.targets.length) {
        // keyboard: cycle to the first target when the cursor isn't on one
        const t = this.targets[0];
        this.setCursor(t.x, t.y);
        this.pending = t;
        preview(t);
      } else this.cancel();
    }
  }

  cancel() {
    const b = this.battle;
    if (b.result || b.phase !== 'player') return;
    if (this.mode === 'target') { this.hideForecast(); this.pending = null; this.closeMenu(); this.openMenu(); return; }
    if (this.mode === 'menu') {
      this.closeMenu();
      this.placeUnit(this.sel, this.origin.x, this.origin.y);
      this.reach = b.reachFor(this.sel);
      this.mode = 'move';
      this.showMoveRange();
      return;
    }
    if (this.mode === 'move') { this.deselect(); return; }
    if (this.mode === 'idle') this.clearThreat();
  }

  selectUnit(u) {
    this.ensureWalk(u.id);
    this.sel = u;
    this.origin = { x: u.x, y: u.y };
    this.reach = this.battle.reachFor(u);
    this.mode = 'move';
    this.clearThreat();
    this.showMoveRange();
    sfx('menuConfirm');
  }

  deselect() {
    this.sel = null;
    this.mode = 'idle';
    this.hideForecast();
    this.paintRanges();
    this.pathG.clear();
  }

  showMoveRange() {
    const u = this.sel;
    const move = this.reach.stops;
    const attack = new Map();
    for (const s of move.values()) {
      for (const t of ringTiles(this.battle.map, s.x, s.y, u.range[0], u.range[1])) {
        const k = key(t.x, t.y);
        if (!move.has(k)) attack.set(k, t);
      }
    }
    this.paintRanges({ move, attack });
  }

  inspectThreat(u) {
    const reach = this.battle.reachFor(u);
    const move = new Map();
    for (const [k, v] of reach.all) move.set(k, v);
    const attack = new Map();
    for (const s of reach.stops.values()) {
      for (const t of ringTiles(this.battle.map, s.x, s.y, u.range[0], u.range[1])) {
        const k = key(t.x, t.y);
        if (!move.has(k)) attack.set(k, t);
      }
    }
    this.threatShown = u;
    this.paintRanges({ attack: new Map([...attack, ...move]) });
  }

  clearThreat() {
    if (this.threatShown) { this.threatShown = null; this.paintRanges(); }
  }

  placeUnit(u, x, y) {
    this.battle.moveUnit(u, x, y);
    const v = this.views.get(u.uid);
    v.cont.setPosition(tx(x) + TILE / 2, ty(y) + FEET);
    this.sortDepth(v);
  }

  /** Glide along the whole path at a steady pace (eased at both ends), hopping with each tile. */
  /** Walk sheets are huge, so load them one fighter at a time and keep only a few. Until one is ready, units glide. */
  /** Give a not-yet-loaded walk sheet a short chance to arrive before the unit moves (otherwise it glides). */
  async waitWalk(id, ms) {
    this.ensureWalk(id);
    const t0 = performance.now();
    while (this.attackReady && !walkReady(this, id) && performance.now() - t0 < ms && (this.walkBusy || this.walkQueue?.length)) await new Promise((r) => setTimeout(r, 60));
  }

  ensureWalk(id) {
    if (this.noWalk || !this.attackReady || walkReady(this, id)) return;
    this.walkQueue = this.walkQueue || [];
    if (!this.walkQueue.includes(id) && this.walkBusy !== id) this.walkQueue.push(id);
    this.pumpWalk();
  }

  pumpWalk() {
    if (this.walkBusy || !this.walkQueue?.length || !this.scene.isActive()) return;
    const id = this.walkQueue.shift();
    this.walkBusy = id;
    loadCampaignArt(this, [id], 'walk', () => {
      this.walkBusy = null;
      this.touchWalk(id);
      this.pumpWalk();
    });
  }

  touchWalk(id) {
    this.walkLru = (this.walkLru || []).filter((x) => x !== id);
    this.walkLru.push(id);
    while (this.walkLru.length > 4) {
      const old = this.walkLru.find((x) => { const u = this.battle.units.find((q) => q.id === x); const w = u && this.views.get(u.uid); return !(w && w.moving); });
      if (!old) break;
      this.walkLru = this.walkLru.filter((x) => x !== old);
      releaseWalk(this, old);
    }
  }

  async walk(u, path) {
    const v = this.views.get(u.uid);
    if (!v || path.length < 2) { this.battle.moveUnit(u, path[path.length - 1].x, path[path.length - 1].y); return; }
    const pts = path.map((p) => ({ x: tx(p.x) + TILE / 2, y: ty(p.y) + FEET }));
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push({ a: pts[i - 1], b: pts[i], l, from: total }); total += l; }
    const SPEED = 430; // px per second
    const dur = (total / SPEED) * 1000 + 90;
    v.moving = true;
    v.walkOn = !!(v.rig && walkReady(this, u.id));
    if (v.walkOn) { v.rig.currentClip = null; this.touchWalk(u.id); }
    let lastDust = 0;
    await new Promise((res) => {
      const counter = this.tweens.addCounter({
        from: 0, to: 1, duration: Math.max(1, dur / this.speed), ease: 'Sine.easeInOut',
        onUpdate: () => {
          const d = counter.getValue() * total;
          const seg = segs.find((sg) => d <= sg.from + sg.l) || segs[segs.length - 1];
          const f = Phaser.Math.Clamp((d - seg.from) / seg.l, 0, 1);
          v.cont.x = seg.a.x + (seg.b.x - seg.a.x) * f;
          v.cont.y = seg.a.y + (seg.b.y - seg.a.y) * f;
          if (v.rig) {
            if (seg.b.x !== seg.a.x) v.rig.facing = seg.b.x > seg.a.x ? 1 : -1;
            if (!v.walkOn) {
              v.rig.y = -Math.abs(Math.sin((d / TILE) * Math.PI)) * 7;
              v.rig.rotation = Math.sin((d / TILE) * Math.PI * 2) * 0.03 * (v.rig.facing || 1);
            }
          }
          if (d - lastDust > TILE * 0.55) { lastDust = d; this.dust(v.cont.x, v.cont.y); }
          this.sortDepth(v);
        },
        onComplete: () => res(),
      });
    });
    v.moving = false;
    if (v.walkOn) { v.walkOn = false; v.rig.currentClip = null; }
    if (v.rig) { v.rig.y = 0; v.rig.rotation = 0; }
    v.cont.setPosition(pts[pts.length - 1].x, pts[pts.length - 1].y);
    this.battle.moveUnit(u, path[path.length - 1].x, path[path.length - 1].y);
    this.sortDepth(v);
  }

  dust(x, y) {
    const c = this.add.circle(x + Phaser.Math.Between(-6, 6), y - 2, Phaser.Math.Between(3, 5), 0xe8f6ff, 0.45).setDepth(9);
    this.tweens.add({ targets: c, y: c.y - 8, alpha: 0, scale: 1.8, duration: 380 / this.speed, onComplete: () => c.destroy() });
  }

  burst(x, y, color = 0xffd166, n = 12, spread = 80, depth = 92) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.4 + Math.random() * 0.8);
      const c = this.add.circle(x, y, 2 + Math.random() * 3, color, 1).setDepth(depth);
      this.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d - 12, alpha: 0, scale: 0.2, duration: (360 + Math.random() * 300) / this.speed, ease: 'Cubic.easeOut', onComplete: () => c.destroy() });
    }
  }

  async moveSelected(x, y) {
    const u = this.sel;
    this.mode = 'busy';
    this.paintRanges();
    const path = this.battle.pathFor(u, { x, y }, this.reach);
    await this.walk(u, path);
    this.setCursor(x, y);
    // Move-triggered story events wait until the action is confirmed, so Back can still undo the move.
    this.openMenu();
  }

  // ----------------------------------------------------------- action menu
  openMenu() {
    const b = this.battle;
    const u = this.sel;
    this.mode = 'menu';
    this.targets = b.targetsFrom(u);
    const items = [];
    if (u.charging) {
      const rel = b.chargedMove(u);
      const has = rel && b.targetsFrom(u, u.x, u.y, rel).length > 0;
      items.push({ id: 'release', move: rel, label: `Release ${rel.name}`, tag: `${rel.dmg} R${rangeLabel(rel)}`, disabled: !has, note: has ? '' : reachNote(rel) });
      items.push({ id: 'cancelCharge', label: 'Cancel Charge', info: ['Stop charging and act normally this turn.'] });
    } else {
      for (const m of u.moves) {
        const block = b.moveBlock(u, m);
        if (m.action === 'attack' && !m.charge) {
          const has = b.targetsFrom(u, u.x, u.y, m).length > 0;
          items.push({ id: 'attack', move: m, label: m.name, tag: `${m.dmg} R${rangeLabel(m)}`, disabled: !!block || !has, note: block || (has ? '' : reachNote(m)) });
        } else if (m.action === 'attack') {
          items.push({ id: 'charge', move: m, label: m.name, tag: `CHG R${rangeLabel(m)}`, disabled: !!block, note: block || '' });
        } else if (m.action === 'power') {
          items.push({ id: 'power', move: m, label: m.name, tag: 'PWR', disabled: !!block, note: block || '' });
        } else if (m.action === 'heal') {
          const has = b.healTargets(u, u.x, u.y, m).length > 0;
          items.push({ id: 'heal', move: m, label: m.name, tag: '+HP', disabled: !!block || !has, note: block || (has ? '' : 'No wounded ally in range') });
        } else if (m.action === 'guard') {
          items.push({ id: 'guard', move: m, label: m.name, tag: 'GRD', disabled: !!block, note: block || '' });
        }
      }
    }
    if (b.canSeize(u)) items.push({ id: 'seize', label: 'Seize' });
    if (b.canEscape(u)) items.push({ id: 'escape', label: 'Escape' });
    this.talkList = b.talkTargets(u);
    if (this.talkList.length) items.push({ id: 'talk', label: 'Talk' });
    items.push({ id: 'wait', label: 'Wait', info: [u.charging ? 'Hold position and keep the charge.' : 'End this unit\'s turn.'] });
    this.menuItems = items;
    this.menuSel = Math.max(0, items.findIndex((it) => !it.disabled));
    const objs = [];
    const w = 270;
    const rowH = 32;
    const h = items.length * rowH + 12;
    const infoW = 262;
    const mapRight = MAPX + b.map.w * TILE;
    let mx = tx(u.x) + TILE + 6;
    let infoLeft = false;
    if (mx + w + infoW + 6 > mapRight) { infoLeft = mx + w > mapRight - 20; if (mx + w > mapRight) mx = tx(u.x) - w - 6; }
    let my = Math.min(ty(u.y), MAPY + b.map.h * TILE - h);
    my = Math.max(my, MAPY + 4);
    const bg = drawPanel(this, mx, my, w, h, 10, THEME.gold, 0.9).setDepth(70);
    objs.push(bg);
    this.menuRows = items.map((it, i) => {
      let tagW = 0;
      if (it.tag) {
        const tagT = this.add.text(mx + w - 14, my + 6 + i * rowH + rowH / 2, it.tag, textStyle('mono', { fontSize: '12px', color: THEME.dimCss })).setOrigin(1, 0.5).setDepth(71);
        tagW = tagT.width + 10;
        objs.push(tagT);
      }
      const row = this.add.text(mx + 14, my + 6 + i * rowH + rowH / 2, it.label.toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: '14px', color: THEME.mistCss, letterSpacing: 1 }).setOrigin(0, 0.5).setDepth(71);
      fitText(row, w - 28 - tagW);
      const zone = this.add.zone(mx, my + 6 + i * rowH, w, rowH).setOrigin(0, 0).setDepth(72).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => { this.menuSel = i; this.paintMenu(); });
      zone.on('pointerdown', (p) => { if (p.leftButtonDown()) { this.menuSel = i; this.menuPick(); } });
      objs.push(row, zone);
      return row;
    });
    // move info card beside the menu
    const ix = infoLeft || mx + w + 6 + infoW > mapRight + 40 ? mx - infoW - 6 : mx + w + 6;
    this.menuInfoBg = drawPanel(this, ix, my, infoW, 176, 10, THEME.teal, 0.9).setDepth(70);
    this.menuInfoT = this.add.text(ix + 12, my + 10, '', textStyle('caption', { fontSize: '12px', lineSpacing: 4, wordWrap: { width: infoW - 24 } })).setDepth(71);
    objs.push(this.menuInfoBg, this.menuInfoT);
    this.menuObjs = objs;
    this.menuSelG = this.add.graphics().setDepth(70.5);
    this.menuGeo = { mx, my, w, rowH };
    this.paintMenu();
    this.paintRanges({ attack: new Map(ringTiles(b.map, u.x, u.y, u.range[0], u.range[1]).map((t) => [key(t.x, t.y), t])), targets: this.targets });
  }

  paintMenu() {
    const { mx, my, w, rowH } = this.menuGeo;
    const g = this.menuSelG;
    g.clear();
    g.fillStyle(THEME.shellOn, 0.9);
    g.fillRoundedRect(mx + 6, my + 6 + this.menuSel * rowH, w - 12, rowH - 2, 6);
    this.menuRows.forEach((r, i) => r.setColor(this.menuItems[i].disabled ? THEME.disabledCss : i === this.menuSel ? THEME.goldCss : THEME.mistCss));
    const it = this.menuItems[this.menuSel];
    const lines = it?.move ? describeMove(it.move) : (it?.info || []);
    if (it?.note) lines.push(`(${it.note})`);
    this.menuInfoT?.setText(lines.join('\n'));
  }

  menuMove(d) {
    const n = this.menuItems.length;
    let i = this.menuSel;
    for (let k = 0; k < n; k++) {
      i = (i + d + n) % n;
      if (!this.menuItems[i].disabled) break;
    }
    this.menuSel = i;
    this.paintMenu();
    sfx('menuMove');
  }

  closeMenu() {
    this.menuObjs?.forEach((o) => o.destroy());
    this.menuObjs = null;
    this.menuInfoT = null;
    this.menuInfoBg = null;
    this.menuSelG?.destroy();
    this.menuSelG = null;
  }

  menuPick() {
    const it = this.menuItems[this.menuSel];
    if (!it) return;
    if (it.disabled) { this.toast(it.note || 'Not available'); return; }
    sfx('menuConfirm');
    const u = this.sel;
    if (it.id === 'cancelCharge') { this.battle.cancelCharge(u); this.paintTags(this.views.get(u.uid)); this.closeMenu(); this.openMenu(); return; }
    this.closeMenu();
    if (it.id === 'wait') this.commitMove().then((over) => { if (!over) this.finishAction(this.sel); });
    else if (it.id === 'escape') { this.mode = 'busy'; this.paintRanges(); this.commitMove().then((over) => { if (over) return; this.battle.escape(this.sel); this.finishAction(this.sel, true); }); }
    else if (it.id === 'talk') this.commitMove().then((over) => { if (!over) this.doTalk(this.talkList[0]); });
    else if (it.id === 'seize') { this.mode = 'busy'; this.paintRanges(); this.commitMove().then((over) => { if (over) return; this.battle.seize(this.sel); this.finishAction(this.sel, true); }); }
    else if (it.id === 'charge') this.selfAction(it.move, () => { this.battle.startCharge(u, it.move); return `CHARGING ${it.move.name.toUpperCase()}`; }, '#FFD166');
    else if (it.id === 'guard') this.selfAction(it.move, () => { this.battle.guard(u, it.move); return `${it.move.name.toUpperCase()}`; }, '#35A8FF');
    else if (it.id === 'power') this.selfAction(it.move, () => { this.battle.powerUp(u, it.move); return `${it.move.name.toUpperCase()}!`; }, '#FF9A3C');
    else if (it.id === 'heal') {
      const move = it.move;
      this.mode = 'target';
      this.curMove = move;
      this.targets = this.battle.healTargets(u, u.x, u.y, move);
      this.atkSet = new Map(ringTiles(this.battle.map, u.x, u.y, move.range[0], move.range[1]).map((t) => [key(t.x, t.y), t]));
      this.pending = this.targets[0];
      this.setCursor(this.pending.x, this.pending.y);
      this.previewHeal(this.pending);
      this.paintRanges({ attack: this.atkSet, targets: [this.pending] });
    } else if (it.id === 'attack' || it.id === 'release') {
      const move = it.move;
      this.mode = 'target';
      this.curMove = move;
      this.pending = null;
      this.targets = this.battle.targetsFrom(u, u.x, u.y, move);
      this.atkSet = new Map(ringTiles(this.battle.map, u.x, u.y, move.range[0], move.range[1]).map((t) => [key(t.x, t.y), t]));
      this.paintRanges({ attack: this.atkSet, targets: this.targets });
      const t = this.targets[0];
      this.pending = t;
      this.setCursor(t.x, t.y);
      this.showForecast(u, t, move);
      this.paintRanges({ attack: this.atkSet, targets: [t] });
    }
  }

  /** The fighting game's FX for an enemy's guard or charge, played on the unit. */
  async enemySelfFx(u, move, v) {
    this.paintTags(v);
    const spec = await this.fxSpec(u, move);
    const at = { x: v.cont.x, y: v.cont.y - 50 };
    await playMoveFx(this, spec, { from: at, to: at, ref: UNIT_H, depth: 92, speed: this.speed, self: true });
  }

  /** Charge, guard and power up: the move is the whole action. */
  async selfAction(move, apply, color) {
    const u = this.sel;
    this.mode = 'busy';
    this.paintRanges();
    if (await this.commitMove()) return;
    const label = apply();
    const v = this.views.get(u.uid);
    this.paintTags(v);
    this.floatText(v.cont.x, v.cont.y - 100, label, color, 18);
    this.burst(v.cont.x, v.cont.y - 40, Phaser.Display.Color.HexStringToColor(color).color, 14, 60);
    const spec = await this.fxSpec(u, move);
    await Promise.all([this.wait(480), playMoveFx(this, spec, { from: { x: v.cont.x, y: v.cont.y - 50 }, to: { x: v.cont.x, y: v.cont.y - 50 }, ref: UNIT_H, depth: 92, speed: this.speed, self: true })]);
    this.finishAction(u, true);
  }

  // --------------------------------------------------------------- combat
  async doAttack(target) {
    const att = this.sel;
    this.mode = 'busy';
    this.hideForecast();
    this.paintRanges();
    if (await this.commitMove()) return;
    await this.combat(att, target, this.curMove);
    this.finishAction(att, true);
  }

  previewHeal(t) {
    this.hideForecast();
    this.toast(`${t.name}: +${healAmount(t)} HP  (${t.hp} -> ${t.hp + healAmount(t)} / ${t.maxHp})`);
  }

  async doHeal(target) {
    const healer = this.sel;
    this.mode = 'busy';
    this.paintRanges();
    if (await this.commitMove()) return;
    await this.healAction(healer, target, this.curMove);
    this.finishAction(healer, true);
  }

  /** A healer restores an ally: the fighter's guard FX plays on the ally, green numbers float up. */
  async healAction(healer, target, move) {
    const b = this.battle;
    const vh = this.views.get(healer.uid);
    const vt = this.views.get(target.uid);
    if (vh?.rig) vh.rig.facing = target.x < healer.x ? -1 : target.x > healer.x ? 1 : vh.rig.facing;
    const res = b.heal(healer, target, move);
    this.floatText(vh.cont.x, vh.cont.y - 100, move.name.toUpperCase(), '#53E0A8', 16);
    sfx('menuConfirm');
    const spec = await this.fxSpec(healer, move.fxFrom || move);
    const at = { x: vt.cont.x, y: vt.cont.y - 50 };
    await Promise.all([this.wait(520), playMoveFx(this, spec, { from: at, to: at, ref: UNIT_H, depth: 92, speed: this.speed, self: true })]);
    this.burst(vt.cont.x, vt.cont.y - 40, 0x53e0a8, 16, 60);
    vt.shownHp = target.hp;
    this.paintBar(vt);
    this.floatText(vt.cont.x, vt.cont.y - 80, `+${res.amount}`, '#53E0A8', 22);
    await this.wait(420);
    if (res.xp) await this.showXpGain([res.xp]);
    this.refreshPanel();
  }

  /** The move is final once an action is confirmed: only now do move-triggered events fire. True when the battle ended. */
  async commitMove() {
    this.mode = 'busy';
    await this.runEvents(this.battle.checkEvents('move'));
    if (this.battle.result) { this.finish(); return true; }
    return false;
  }

  finishAction(u, already = false) {
    const b = this.battle;
    if (!already) b.wait(u);
    u.acted = true;
    const v = this.views.get(u.uid);
    if (v && u.alive) this.setGrey(v, true);
    this.sel = null;
    this.pathG.clear();
    this.paintRanges();
    this.hideForecast();
    this.refreshPanel();
    if (b.result) { this.finish(); return; }
    this.mode = 'idle';
    if (b.players.every((p) => p.acted)) this.endTurnPressed(true);
  }

  async combat(att, def, move = null) {
    const b = this.battle;
    const va = this.views.get(att.uid);
    const vd = this.views.get(def.uid);
    if (va.rig) va.rig.facing = def.x < att.x ? -1 : def.x > att.x ? 1 : va.rig.facing;
    if (vd.rig) vd.rig.facing = att.x < def.x ? -1 : att.x > def.x ? 1 : vd.rig.facing;
    const before = new Map([[att.uid, att.hp], [def.uid, def.hp]]);
    const res = b.attack(att, def, move);
    // the state already holds the final HP; the bars catch up strike by strike
    va.shownHp = before.get(att.uid);
    vd.shownHp = before.get(def.uid);
    if (this.cutOn && va.rig && vd.rig) {
      // the close-up has its own track; the phase theme resumes after (a missing file just leaves the phase theme on)
      playMusic('battle', { fade: 0.4 });
      try { await this.cutaway(att, def, res, before); } finally { this.phaseMusic(this.phaseTrack || 'map_enemy'); }
      va.shownHp = att.hp; vd.shownHp = def.hp;
      this.paintBar(va); this.paintBar(vd);
    } else {
      for (const strike of res.log) {
        const sv = strike.by === 'att' ? va : vd;
        const tv = strike.by === 'att' ? vd : va;
        await this.strike(sv, tv, strike);
      }
    }
    await this.showEffects(res.effects);
    for (const k of res.killed) {
      const v = this.views.get(k.uid);
      sfx('ko');
      if (!b.result) stinger(k.team === 'player' ? 'defeat_player' : 'defeat_enemy', { duck: 0.3, vol: STINGER_BOOST });
      if (v) {
        this.burst(v.cont.x, v.cont.y - 40, 0xff4f5f, 16, 70);
        await this.tween({ targets: v.cont, alpha: 0, y: v.cont.y - 14, duration: 420 });
        v.cont.destroy();
        this.views.delete(k.uid);
      }
      await this.runEvents(b.checkEvents('death', { unit: k }));
    }
    await this.showXpGain(res.xp);
    this.refreshPanel();
  }

  async showXpGain(list) {
    for (const x of list) {
      const v = this.views.get(x.unit.uid);
      if (!v) continue;
      this.floatText(v.cont.x, v.cont.y - UNIT_H - 8, `EXP +${x.amount}`, THEME.goldCss, 15);
      await this.wait(380);
      for (const lu of x.levelUps) {
        this.levelUps.push({ name: x.unit.name, level: lu.level });
        const g = lu.gains;
        const parts = [`HP+${g.hp}`, g.power && 'POW+1', g.def && 'DEF+1', g.spd && 'SPD+1'].filter(Boolean).join('  ');
        sfx('go');
        this.levelUpFx(v);
        await this.banner(`LEVEL UP  ${x.unit.name.toUpperCase()}  Lv ${lu.level}`, parts, THEME.gold);
      }
    }
  }

  /** Pillar of light, a ring that rises off the feet, and sparkles. */
  levelUpFx(v) {
    stinger('levelup', { duck: 0.45 });
    const { x, y } = v.cont;
    const pillar = this.add.rectangle(x, y - 60, 60, 160, 0xffd166, 0.0).setDepth(80).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: pillar, alpha: { from: 0.55, to: 0 }, scaleX: { from: 1, to: 0.3 }, scaleY: { from: 0.6, to: 1.4 }, duration: 900 / this.speed, onComplete: () => pillar.destroy() });
    for (let i = 0; i < 3; i++) {
      const ring = this.add.ellipse(x, y - 4, 40, 14).setStrokeStyle(3, 0xffd166, 1).setDepth(81);
      this.tweens.add({ targets: ring, y: y - 96, scaleX: 1.7, alpha: 0, duration: (700 + i * 170) / this.speed, delay: (i * 140) / this.speed, onComplete: () => ring.destroy() });
    }
    this.burst(x, y - 50, 0xfff2b0, 22, 90, 82);
    v.rig?.setFlash(0xffffff);
    this.time.delayedCall(180 / this.speed, () => v.rig?.setFlash(v.grey ? 0x7a7a8a : null));
  }

  /** Start the fighter's attack clip on a view (map or cutaway). Returns false when the clip is not loaded yet. */
  startAttack(v, dur, _move = null) {
    if (!v.rig || !this.clipLoaded(v.u)) return false;
    const mv = basicMove(CHARACTERS[v.u.id]);
    const fd = frameData(mv?.duration ?? 250, mv?.cooldown ?? 380, mv || {}, 1000 / 60);
    v.rig.moveKey = 'basicDirectional';
    v.rig.moveSlot = 'basic';
    v.rig.frameData = fd;
    v.rig.attackFrame = 0;
    v.atk = { t: 0, dur, fd };
    return true;
  }

  /** Close-up of the exchange: both fighters large, attack clips, hit / crit / miss / KO effects. */
  async cutaway(att, def, res, before) {
    const depth = 120;
    const objs = [];
    const add = (o, d = 0) => { o.setDepth(depth + d); objs.push(o); return o; };
    const PY = 96;
    const PH = 524;
    const FOOT = 560;
    const veil = add(this.add.rectangle(W / 2, H / 2, W, H, 0x04030a, 0.97), 0);
    veil.setAlpha(0);
    const stage = this.add.graphics();
    stage.fillGradientStyle(0x14102a, 0x14102a, 0x2a1d4a, 0x2a1d4a, 1);
    stage.fillRect(0, PY, W, FOOT - 70 - PY);
    add(stage, 1);
    // ground: the terrain under each fighter
    const mapA = this.battle.tile(att.x, att.y);
    const mapD = this.battle.tile(def.x, def.y);
    // The ground under each fighter is that fighter's own terrain, blended across the middle so there is no seam.
    const GY = FOOT - 70;
    const texKeys = [];
    const groundTex = (t) => {
      const key = `cutground-${t.id}-${this.cutSeq = (this.cutSeq || 0) + 1}`;
      const rt = this.make.renderTexture({ x: 0, y: 0, width: W, height: 160, add: false });
      for (let x = 0; x < W; x += 160) {
        const img = this.make.image({ key: tileKey(t.id), add: false }).setDisplaySize(160, 160);
        if (t.id === 'road') img.setAngle(90);
        rt.draw(img, x + 80, 80);
        img.destroy();
      }
      rt.saveTexture(key);
      texKeys.push(key);
      add(rt, 0);
      rt.setVisible(false);
      return key;
    };
    const keyA = groundTex(mapA);
    const baseA = add(this.add.image(0, GY, keyA).setOrigin(0, 0), 2);
    void baseA;
    if (mapD.id !== mapA.id) {
      const keyD = groundTex(mapD);
      const TW = 260; const STEPS = 13; const sw = TW / STEPS; const x0 = W / 2 - TW / 2;
      for (let i = 0; i < STEPS; i++) {
        const strip = this.add.image(0, GY, keyD).setOrigin(0, 0).setCrop(x0 + i * sw, 0, sw + 1, 160).setAlpha((i + 1) / (STEPS + 1));
        add(strip, 2.1);
      }
      add(this.add.image(0, GY, keyD).setOrigin(0, 0).setCrop(x0 + TW, 0, W - x0 - TW, 160), 2.2);
    }
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0);
    shade.fillRect(0, FOOT - 70, W, 60);
    add(shade, 3);
    const rim = this.add.graphics();
    rim.lineStyle(3, THEME.teal, 0.8);
    rim.lineBetween(0, PY, W, PY); rim.lineBetween(0, PY + PH, W, PY + PH);
    add(rim, 4);
    // fighters
    const mk = (u, x, face) => {
      const c = CHARACTERS[u.id];
      const rig = new Rig(this, c, 0);
      rig.baseScale = 270 / (c.art.height || 130);
      rig.facing = face;
      rig.setPosition(x + face * -160, FOOT);
      this.add.existing(rig);
      add(rig, 10);
      const v = { u, rig, atk: null, grey: false, t: 0, moving: true, home: x };
      this.cutViews.push(v);
      return v;
    };
    const A = mk(att, 330, 1);
    const D = mk(def, W - 330, -1);
    // info plates
    const plates = new Map();
    this.cutPlates = plates;
    const mkPlate = (u, x, left) => {
      const g = this.add.graphics();
      const col = u.team === 'enemy' ? HP_ENEMY : HP_PLAYER;
      const px = x; const py = PY + 18; const pw = 400;
      g.fillStyle(THEME.ink, 0.95); g.fillRoundedRect(px, py, pw, 76, 12);
      g.lineStyle(2, u.team === 'enemy' ? THEME.pink : THEME.teal, 1); g.strokeRoundedRect(px, py, pw, 76, 12);
      add(g, 20);
      add(this.add.text(px + 16, py + 8, u.name.toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: '20px', color: THEME.mistCss, letterSpacing: 2 }), 21);
      add(this.add.text(px + pw - 16, py + 12, `Lv ${u.level}`, textStyle('label', { color: u.team === 'enemy' ? THEME.pinkCss : THEME.tealCss })).setOrigin(1, 0), 21);
      const bar = this.add.graphics();
      add(bar, 21);
      const hpT = add(this.add.text(px + 16, py + 54, '', textStyle('mono', { fontSize: '13px' })), 21);
      const plate = { u, bar, hpT, px, py, pw, col, shown: before.get(u.uid) };
      plates.set(u.uid, plate);
      return plate;
    };
    const paintPlate = (pl) => {
      pl.bar.clear();
      pl.bar.fillStyle(0x000000, 0.8); pl.bar.fillRect(pl.px + 16, pl.py + 38, pl.pw - 32, 12);
      pl.bar.fillStyle(pl.col, 1); pl.bar.fillRect(pl.px + 17, pl.py + 39, (pl.pw - 34) * Phaser.Math.Clamp(pl.shown / pl.u.maxHp, 0, 1), 10);
      pl.bar.fillStyle(0xffffff, 0.2); pl.bar.fillRect(pl.px + 17, pl.py + 39, (pl.pw - 34) * Phaser.Math.Clamp(pl.shown / pl.u.maxHp, 0, 1), 3);
      pl.hpT.setText(`HP ${Math.max(0, Math.round(pl.shown))} / ${pl.u.maxHp}`);
    };
    const plA = mkPlate(att, 40, true);
    const plD = mkPlate(def, W - 440, false);
    paintPlate(plA); paintPlate(plD);
    const setPlate = (pl, hp) => new Promise((resolve) => {
      const o = { v: pl.shown };
      this.tweens.add({ targets: o, v: hp, duration: 360 / this.speed, onUpdate: () => { pl.shown = o.v; paintPlate(pl); }, onComplete: () => { pl.shown = hp; paintPlate(pl); resolve(); } });
    });
    // intro
    this.tween({ targets: veil, alpha: 0.97, duration: 170 });
    await Promise.all([A, D].map((v) => this.tween({ targets: v.rig, x: v.home, duration: 260, ease: 'Cubic.easeOut' })));
    A.moving = false; D.moving = false;
    await this.wait(160);
    const hpNow = new Map([[att.uid, before.get(att.uid)], [def.uid, before.get(def.uid)]]);
    const pendingFx = [];
    for (const s of res.log) {
      const sv = s.by === 'att' ? A : D;
      const tv = s.by === 'att' ? D : A;
      const dir = sv === A ? 1 : -1;
      const startX = sv.home;
      const dur = 0.58;
      sfx('whoosh');
      if (s.by === 'def') {
        const ct0 = this.add.text(sv.rig.x, FOOT - 330, 'COUNTER', { fontFamily: FONT_DISPLAY, fontSize: '26px', color: '#FFD166', stroke: '#07060E', strokeThickness: 6, letterSpacing: 4 }).setOrigin(0.5).setDepth(depth + 41);
        objs.push(ct0);
        this.tweens.add({ targets: ct0, y: ct0.y - 24, alpha: 0, duration: 900 / this.speed, delay: 200 / this.speed });
      }
      const fxSpec = await this.fxSpec(sv.u, s.move);
      sv.rig.facing = dir; tv.rig.facing = -dir;
      const clip = this.startAttack(sv, dur, s.move);
      this.tween({ targets: sv.rig, x: startX + dir * (clip ? 70 : 110), duration: 190, ease: 'Cubic.easeOut' });
      await this.wait(dur * 1000 * 0.45);
      if (fxSpec) {
        const fxp = playMoveFx(this, fxSpec, { from: { x: sv.rig.x + dir * 70, y: FOOT - 150 }, to: { x: tv.rig.x, y: FOOT - 140 }, face: dir, ref: 270, depth: depth + 35, speed: this.speed, miss: !s.hit });
        if (fxSpec.proj) await fxp; else pendingFx.push(fxp);
      }
      const tx0 = tv.home;
      if (s.hit) {
        playHit(s.dmg, 'kinetic', s.killed);
        tv.rig.setFlash(s.crit ? 0xffd166 : 0xff6a6a);
        this.time.delayedCall(120 / this.speed, () => tv.rig?.active && tv.rig.setFlash(null));
        this.tween({ targets: tv.rig, x: tx0 + dir * (s.crit ? 52 : 26), duration: 90, yoyo: !s.killed, ease: 'Sine.easeOut' });
        const cx = tv.rig.x;
        this.burst(cx, FOOT - 130, s.crit ? 0xffd166 : 0xffffff, s.crit ? 26 : 12, s.crit ? 150 : 90, depth + 40);
        const dmgT = this.add.text(cx, FOOT - 250, `${s.dmg}`, { fontFamily: FONT_DISPLAY, fontSize: s.crit ? '84px' : '56px', color: s.crit ? '#FFD166' : '#FFFFFF', stroke: '#07060E', strokeThickness: 8 }).setOrigin(0.5).setDepth(depth + 41);
        objs.push(dmgT);
        dmgT.setScale(0.4);
        this.tweens.add({ targets: dmgT, scale: 1, duration: 140 / this.speed, ease: 'Back.easeOut' });
        this.tweens.add({ targets: dmgT, y: dmgT.y - 50, alpha: 0, delay: 520 / this.speed, duration: 380 / this.speed });
        if (s.crit) {
          const flash = add(this.add.rectangle(W / 2, H / 2, W, H, 0xfff2b0, 0.55), 30);
          this.tweens.add({ targets: flash, alpha: 0, duration: 300 / this.speed });
          const ct = add(this.add.text(W / 2, PY + 140, 'CRITICAL!', { fontFamily: FONT_DISPLAY, fontSize: '46px', color: '#FFD166', stroke: '#07060E', strokeThickness: 8, letterSpacing: 6 }).setOrigin(0.5), 42);
          ct.setScale(0.5);
          this.tweens.add({ targets: ct, scale: 1.1, duration: 160 / this.speed, ease: 'Back.easeOut' });
          this.tweens.add({ targets: ct, alpha: 0, delay: 650 / this.speed, duration: 260 / this.speed });
          this.cameras.main.shake(260 / this.speed, 0.012);
          sfx('koHit');
        } else this.cameras.main.shake(130 / this.speed, 0.005);
        hpNow.set(tv.u.uid, s.targetHp);
        await setPlate(plates.get(tv.u.uid), s.targetHp);
        if (s.killed) {
          sfx('ko');
          this.tween({ targets: tv.rig, x: tv.rig.x + dir * 90, y: FOOT - 10, rotation: dir * 1.3, alpha: 0, duration: 650, ease: 'Cubic.easeIn' });
          this.burst(tv.rig.x, FOOT - 100, 0xff4f5f, 24, 130, depth + 40);
        }
      } else {
        this.tween({ targets: tv.rig, x: tx0 + dir * 70, duration: 110, yoyo: true, ease: 'Sine.easeOut' });
        const mt = this.add.text(tv.rig.x, FOOT - 230, 'MISS', { fontFamily: FONT_DISPLAY, fontSize: '40px', color: '#9A91B0', stroke: '#07060E', strokeThickness: 6 }).setOrigin(0.5).setDepth(depth + 41);
        objs.push(mt);
        this.tweens.add({ targets: mt, y: mt.y - 40, alpha: 0, duration: 800 / this.speed });
      }
      await this.wait(dur * 1000 * 0.55 + (s.crit ? 420 : 140));
      if (sv.atk) sv.atk.t = sv.atk.dur;
      if (!s.killed || s.by !== 'att' && false) await this.tween({ targets: sv.rig, x: startX, duration: 170, ease: 'Sine.easeInOut' });
      if (s.killed) break;
    }
    await Promise.all(pendingFx);
    await this.wait(320);
    await this.tween({ targets: objs.filter((o) => o !== veil), alpha: 0, duration: 160 });
    await this.tween({ targets: veil, alpha: 0, duration: 120 });
    this.cutViews = this.cutViews.filter((v) => v !== A && v !== D);
    this.cutPlates = null;
    objs.forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); });
    for (const k of texKeys) if (this.textures.exists(k)) this.textures.remove(k);
  }

  async strike(sv, tv, s) {
    const dx = Math.sign(tv.cont.x - sv.cont.x) || 1;
    sfx('whoosh');
    const dur = 0.55;
    this.startAttack(sv, dur, s.move);
    const fxSpec = await this.fxSpec(sv.u, s.move);
    const home = sv.cont.x;
    this.tween({ targets: sv.cont, x: home + dx * 16, duration: 140, yoyo: true, ease: 'Sine.easeOut', hold: 60 });
    await this.wait(dur * 1000 * 0.42);
    if (fxSpec) {
      const fxp = playMoveFx(this, fxSpec, { from: { x: sv.cont.x + dx * 20, y: sv.cont.y - 50 }, to: { x: tv.cont.x, y: tv.cont.y - 50 }, face: dx, ref: UNIT_H, depth: 92, speed: this.speed, miss: !s.hit });
      if (fxSpec.proj) await fxp;
    }
    // impact
    const pct = tv.u.maxHp;
    if (s.hit) {
      playHit(s.dmg, 'kinetic', s.killed);
      tv.shownHp = s.targetHp;
      tv.rig?.setFlash(0xff6a6a);
      this.time.delayedCall(110 / this.speed, () => tv.rig?.setFlash(tv.grey ? 0x7a7a8a : null));
      this.tween({ targets: tv.cont, x: tv.cont.x + dx * 8, duration: 70, yoyo: true });
      this.floatText(tv.cont.x, tv.cont.y - 80, `${s.dmg}`, s.crit ? '#FFD166' : '#FFFFFF', s.crit ? 30 : 22);
      if (s.crit) { this.floatText(tv.cont.x, tv.cont.y - 108, 'CRITICAL!', '#FFD166', 14); this.cameras.main.shake(160 / this.speed, 0.004); }
      this.paintBar(tv);
    } else {
      this.floatText(tv.cont.x, tv.cont.y - 80, 'MISS', '#9A91B0', 18);
      this.tween({ targets: tv.cont, x: tv.cont.x - dx * 14, duration: 90, yoyo: true });
    }
    await this.wait(dur * 1000 * 0.58 + 120);
    if (sv.atk) { sv.atk.t = sv.atk.dur; }
    void pct;
  }

  /** The move's FX art, loaded on demand; gives up after a moment so a slow file never stalls a fight. */
  async fxSpec(u, move) {
    if (!move) return null;
    try { return await Promise.race([loadMoveFx(this, u.id, move), new Promise((r) => setTimeout(() => r(null), 1500))]); } catch { return null; }
  }

  /** Show what a strike did besides damage: stun, burn, knockback, lifesteal... */
  async showEffects(list) {
    const label = {
      stun: ['STUNNED!', '#FF6FA8'], immune: ['STUN IMMUNE', '#D6E4FF'], burn: ['BURNING', '#FF7A3C'], poison: ['POISONED', '#9AE04A'],
      slow: ['SLOWED', '#7CC8FF'], freeze: ['FROZEN', '#BFF0FF'], root: ['ROOTED', '#C9A15A'], blind: ['BLINDED', '#E8E8A0'],
      weaken: ['WEAKENED', '#B79CFF'], vulnerable: ['EXPOSED', '#FF6F6F'], interrupt: ['CHARGE BROKEN', '#FFD166'], strip: ['STRIPPED', '#FFD166'],
      push: ['KNOCKED BACK', '#FFFFFF'], pull: ['PULLED IN', '#FFFFFF'],
    };
    for (const e of list || []) {
      const v = this.views.get(e.unit.uid);
      if (!v) continue;
      const head = v.cont.y - 100;
      if (e.type === 'lifesteal') this.floatText(v.cont.x, head, `+${e.amount}`, '#53E0A8', 22);
      else if (e.type === 'recoil' || e.type === 'thorns') this.floatText(v.cont.x, head, `-${e.amount}`, '#FF9A3C', 22);
      else if (label[e.type]) this.floatText(v.cont.x, head, label[e.type][0], label[e.type][1], 17);
      if ((e.type === 'push' || e.type === 'pull') && e.to) {
        await this.tween({ targets: v.cont, x: tx(e.to.x) + TILE / 2, y: ty(e.to.y) + FEET, duration: 180, ease: 'Cubic.easeOut' });
        this.sortDepth(v);
      }
      v.shownHp = e.unit.hp;
      this.paintBar(v);
      await this.wait(e.type === 'immune' || e.type === 'stun' ? 420 : 240);
    }
  }

  /** Start-of-phase events: lost turns to a stun, burn / poison damage, regeneration, and anyone the damage KOs. */
  async showPhaseEvents() {
    const b = this.battle;
    for (const e of b.phaseEvents || []) {
      const v = this.views.get(e.unit.uid);
      if (!v) continue;
      const head = v.cont.y - 100;
      if (e.type === 'skip') { this.floatText(v.cont.x, head, 'STUNNED · TURN LOST', '#FF6FA8', 16); sfx('menuMove'); this.setGrey(v, true); await this.wait(520); }
      else if (e.type === 'burnTick' || e.type === 'poisonTick') {
        sfx('hit');
        this.floatText(v.cont.x, head, `-${e.amount}`, e.type === 'burnTick' ? '#FF7A3C' : '#9AE04A', 22);
        v.rig?.setFlash(e.type === 'burnTick' ? 0xff7a3c : 0x9ae04a);
        this.time.delayedCall(160 / this.speed, () => v.rig?.active && v.rig.setFlash(v.grey ? 0x7a7a8a : null));
        await this.wait(380);
      } else if (e.type === 'regenTick') { this.floatText(v.cont.x, head, `+${e.amount}`, '#53E0A8', 22); await this.wait(300); }
      else if (e.type === 'dotKill') {
        sfx('ko');
        this.burst(v.cont.x, v.cont.y - 40, 0xff4f5f, 16, 70);
        await this.tween({ targets: v.cont, alpha: 0, y: v.cont.y - 14, duration: 420 });
        v.cont.destroy();
        this.views.delete(e.unit.uid);
        await this.runEvents(b.checkEvents('death', { unit: e.unit }));
        continue;
      }
      v.shownHp = e.unit.hp;
      this.paintBar(v);
    }
    b.phaseEvents = [];
  }

  floatText(x, y, text, color, size = 20) {
    const t = this.add.text(x, y, text, { fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color, stroke: '#07060E', strokeThickness: 5 }).setOrigin(0.5).setDepth(90);
    this.tweens.add({ targets: t, y: y - 34, alpha: { from: 1, to: 0 }, duration: 900 / this.speed, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  async banner(title, sub, color = THEME.teal) {
    this.bannerText = title;
    const g = this.add.graphics().setDepth(95);
    g.fillStyle(THEME.void, 0.78);
    g.fillRect(0, 290, W, 120);
    g.lineStyle(2, color, 0.9);
    g.lineBetween(0, 290, W, 290);
    g.lineBetween(0, 410, W, 410);
    const t = this.add.text(W / 2, 330, title, { fontFamily: FONT_DISPLAY, fontSize: '34px', color: '#E8F6FF', letterSpacing: 5 }).setOrigin(0.5).setDepth(96);
    const s = sub ? this.add.text(W / 2, 376, sub, textStyle('mono', { fontSize: '16px' })).setOrigin(0.5).setDepth(96) : null;
    const objs = [g, t, s].filter(Boolean);
    objs.forEach((o) => o.setAlpha(0));
    await this.tween({ targets: objs, alpha: 1, duration: 160 });
    await this.wait(sub ? 900 : 650);
    await this.tween({ targets: objs, alpha: 0, duration: 160 });
    objs.forEach((o) => o.destroy());
    this.bannerText = null;
  }

  // --------------------------------------------------------------- story events
  enemyIds() {
    return [...new Set([...this.battle.units.filter((u) => u.team === 'enemy').map((u) => u.id), ...this.chapter.enemies.map((e) => e.id)])];
  }

  /** Mid-battle conversation over a dimmed map. */
  async talkScene(lines, tag = null) {
    if (!lines?.length) return;
    const prev = this.mode;
    this.mode = 'busy';
    this.hideForecast();
    this.inDialogue = true;
    await playDialogue(this, { lines, enemyIds: this.enemyIds(), dim: 0.62, depth: 200, speed: this.speed, tag });
    this.inDialogue = false;
    this.mode = prev;
  }

  /** Show newly arrived units, then play the event's lines. */
  async runEvents(list) {
    for (const { event, lines, spawned } of list || []) {
      const prev = this.mode;
      this.mode = 'busy';
      if (spawned.length) {
        sfx('go');
        for (const u of spawned) {
          const v = this.addView(u);
          v.cont.setAlpha(0);
          this.setCursor(u.x, u.y);
          this.burst(v.cont.x, v.cont.y - 40, u.team === 'enemy' ? 0xff4f5f : 0x35a8ff, 18, 90);
          this.tweens.add({ targets: v.cont, alpha: 1, y: { from: v.cont.y - 26, to: v.cont.y }, duration: 420 / this.speed, ease: 'Bounce.easeOut' });
        }
        await this.wait(560);
      }
      if (event.card) { this.bossMusic = true; playMusic('boss', { fade: 0.6 }); this.inDialogue = true; await playBossCard(this, { card: event.card, depth: 190, speed: this.speed }); this.inDialogue = false; }
      await this.talkScene(lines, event.when?.near ? 'ENCOUNTER' : event.when?.death ? 'LAST WORDS' : spawned.length ? 'REINFORCEMENTS' : 'STORY');
      this.mode = prev;
      this.refreshPanel();
    }
  }

  async doTalk(npc) {
    const u = this.sel;
    this.mode = 'busy';
    this.paintRanges();
    this.hideForecast();
    const r = this.battle.talk(u, npc);
    await this.talkScene(r.lines, 'RECRUIT');
    const v = this.rebuildView(npc);
    this.burst(v.cont.x, v.cont.y - 40, 0x53e0a8, 20, 90);
    this.floatText(v.cont.x, v.cont.y - UNIT_H - 8, `${npc.name} joins!`, '#53E0A8', 20);
    sfx('go');
    await this.wait(700);
    this.finishAction(u, true);
  }

  // --------------------------------------------------------------- phases
  /** Phase themes; once a boss has made its entrance the boss theme holds for the rest of the chapter. */
  phaseMusic(name) {
    this.phaseTrack = name;
    playMusic(this.bossMusic ? 'boss' : name, { fade: this.bossMusic ? 1.0 : 1.3 });
  }

  async startPlayerPhase(first = false) {
    const b = this.battle;
    this.playerPhaseAt = performance.now();
    this.phaseMusic(this.mapRotation.current());
    this.mode = 'busy';
    // the very first player phase starts here; later ones were already started by endEnemyPhase() (ticking twice would double cooldowns and stuns)
    const healed = first ? b.startPhase('player') : (b.lastHealed || []);
    // only player units that have already acted (a stun cost them the turn) dim; enemies keep `acted` from their own phase
    for (const v of this.views.values()) this.setGrey(v, v.u.team === 'player' && v.u.acted && v.u.alive);
    this.refreshPanel();
    await this.banner('PLAYER PHASE', first ? this.chapter.objective : (this.chapter.win === 'defend' ? `Turn ${b.turn} of ${this.chapter.turns}` : `Turn ${b.turn}`), 0x35a8ff);
    if (first) await this.runEvents(b.checkEvents('start'));
    await this.runEvents(b.checkEvents('turn'));
    for (const h of healed) {
      const v = this.views.get(h.unit.uid);
      if (v) { v.shownHp = h.unit.hp; this.paintBar(v); this.floatText(v.cont.x, v.cont.y - 80, `+${h.amount}`, '#53E0A8', 20); }
    }
    await this.showPhaseEvents();
    if (b.result) { this.finish(); return; }
    this.mode = 'idle';
    this.refreshPanel();
  }

  endTurnPressed(auto = false) {
    const b = this.battle;
    if (b.result || b.phase !== 'player' || this.mode === 'busy') return;
    if (this.mode === 'menu') this.closeMenu();
    if (this.sel && this.origin) this.placeUnit(this.sel, this.origin.x, this.origin.y);
    this.deselect();
    this.runEnemyPhase();
  }

  async runEnemyPhase() {
    const b = this.battle;
    this.mapRotation.heard((performance.now() - this.playerPhaseAt) / 1000);
    this.phaseMusic('map_enemy');
    this.mode = 'busy';
    const healed = b.endPlayerPhase();
    this.refreshPanel();
    await this.banner('ENEMY PHASE', `Turn ${b.turn}`, 0xff4f5f);
    await this.runEvents(b.checkEvents('enemyTurn'));
    for (const h of healed) {
      const v = this.views.get(h.unit.uid);
      if (v) { v.shownHp = h.unit.hp; this.paintBar(v); this.floatText(v.cont.x, v.cont.y - 80, `+${h.amount}`, '#53E0A8', 20); }
    }
    await this.showPhaseEvents();
    let guard = 0;
    while (!b.result && guard++ < 40) {
      const u = b.nextEnemy();
      if (!u) break;
      const plan = b.plan(u);
      const v = this.views.get(u.uid);
      if (plan.cancelCharge) { b.cancelCharge(u); this.paintTags(v); }
      this.setCursor(u.x, u.y);
      if (plan.to.x !== u.x || plan.to.y !== u.y) {
        const reach = b.reachFor(u);
        await this.waitWalk(u.id, 1800);
        await this.walk(u, b.pathFor(u, plan.to, reach));
        await this.runEvents(b.checkEvents('move'));
      }
      if (plan.heal) {
        this.setCursor(plan.heal.ally.x, plan.heal.ally.y);
        await this.wait(260);
        await this.healAction(u, plan.heal.ally, plan.heal.move);
      } else if (plan.target) {
        this.setCursor(plan.target.x, plan.target.y);
        await this.wait(260);
        await this.combat(u, plan.target, plan.move);
      } else if (plan.guard) { b.guard(u, plan.guard); this.floatText(v.cont.x, v.cont.y - 100, `${plan.guard.name.toUpperCase()}!`, '#35A8FF', 20); await this.enemySelfFx(u, plan.guard, v); await this.wait(300); }
      else if (plan.charge) { b.startCharge(u, plan.charge); this.floatText(v.cont.x, v.cont.y - 100, `CHARGING ${plan.charge.name.toUpperCase()}`, '#FFD166', 18); sfx('menuConfirm'); await this.enemySelfFx(u, plan.charge, v); await this.wait(360); }
      else b.wait(u);
      this.paintTags(v);
      u.acted = true;
      if (v && u.alive) this.setGrey(v, true);
      await this.wait(160);
    }
    if (b.result) { this.finish(); return; }
    for (const v of this.views.values()) this.setGrey(v, false);
    b.endEnemyPhase();
    if (b.result) { this.finish(); return; }
    await this.startPlayerPhase();
  }

  // --------------------------------------------------------------- result
  async finish() {
    const b = this.battle;
    this.mode = 'busy';
    this.paintRanges();
    const won = b.result === 'victory';
    sfx(won ? 'gameEnd' : 'alarm');
    this.bossMusic = false;
    stinger(won ? 'victory' : 'defeat', { hold: true, duck: 0 });
    await this.banner(won ? 'VICTORY' : 'DEFEAT', won ? this.chapter.title : 'Hydra has fallen', won ? THEME.gold : 0xff4f5f);
    const lord = b.units.find((u) => u.lord);
    const survivors = b.commit();
    this.time.delayedCall(200, () => {
      if (isLeaving(this)) return;
      showScene(this, 'Campaign', {
        save: this.save,
        after: {
          result: b.result,
          chapterIndex: this.chapterIndex,
          survivors,
          fallen: b.fallen().map((u) => u.name),
          levelUps: this.levelUps,
          turns: b.turn,
          reason: lord && !lord.alive ? 'lord' : 'party',
        },
      });
    });
  }
}
