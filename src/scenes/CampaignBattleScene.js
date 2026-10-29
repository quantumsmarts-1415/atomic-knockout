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
import { tileKey, attackClipName, loadCampaignArt, sheetKey } from '../campaign/art.js';
import { basicMove } from '../campaign/units.js';

const TILE = 64;
const MAPX = 8;
const MAPY = 56;
const PANEL_X = 1040;
const FLIPPABLE = new Set(['plain', 'water', 'floor']);
const HP_PLAYER = 0x3ef0e0;
const HP_ENEMY = 0xff4f5f;
const FEET = 54;

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
    // Attack clips stream in behind the map. Until one arrives that unit lunges instead.
    loadCampaignArt(this, this.battle.units.map((u) => u.id), 'attack', () => { this.attackReady = true; });
    const lord = this.battle.units.find((u) => u.lord);
    this.setCursor(lord.x, lord.y);
    this.startPlayerPhase(true);
  }

  cleanup() {
    for (const [ev, fn] of this.keyHandlers) this.input.keyboard?.off(ev, fn);
    this.keyHandlers = [];
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
        else if (id === 'road') img.setFlipX(rnd.pick([true, false]));
        this.tileImgs.push(img);
      }
    }
    const g = this.add.graphics().setDepth(1);
    g.lineStyle(1, 0x07060e, 0.28);
    for (let c = 0; c <= map.w; c++) g.lineBetween(tx(c), MAPY, tx(c), MAPY + map.h * TILE);
    for (let r = 0; r <= map.h; r++) g.lineBetween(MAPX, ty(r), MAPX + map.w * TILE, ty(r));
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
    const col = u.team === 'player' ? 0x35a8ff : 0xff4f5f;
    ring.fillStyle(col, 0.28);
    ring.fillEllipse(0, -2, 52, 16);
    ring.lineStyle(2, col, 0.9);
    ring.strokeEllipse(0, -2, 52, 16);
    cont.add(ring);
    let rig = null;
    if (this.textures.exists(sheetKey(charDef.art, 'idle'))) {
      rig = new Rig(this, charDef, 0);
      rig.baseScale = 82 / (charDef.art.height || 130);
      rig.facing = u.team === 'player' ? 1 : -1;
      cont.add(rig);
    } else {
      const f = this.add.circle(0, -30, 20, col, 0.9);
      cont.add(f);
    }
    const bar = this.add.graphics();
    cont.add(bar);
    const flag = u.lord ? this.add.text(0, -92, '★', { fontFamily: FONT_DISPLAY, fontSize: '16px', color: THEME.goldCss }).setOrigin(0.5) : null;
    if (flag) cont.add(flag);
    const view = { u, cont, rig, bar, shownHp: u.hp, grey: false, atk: null, t: Math.random() * 3 };
    this.views.set(u.uid, view);
    this.paintBar(view);
    this.sortDepth(view);
    return view;
  }

  sortDepth(v) {
    v.cont.setDepth(10 + v.cont.y / 10);
  }

  paintBar(v) {
    const g = v.bar;
    g.clear();
    const w = 50;
    const x = -w / 2;
    const y = 4;
    g.fillStyle(0x000000, 0.75);
    g.fillRect(x - 1, y - 1, w + 2, 8);
    const frac = Phaser.Math.Clamp(v.shownHp / v.u.maxHp, 0, 1);
    g.fillStyle(v.u.team === 'player' ? HP_PLAYER : HP_ENEMY, 1);
    g.fillRect(x, y, w * frac, 6);
    g.fillStyle(0xffffff, 0.2);
    g.fillRect(x, y, w * frac, 2);
  }

  setGrey(v, on) {
    v.grey = on;
    v.cont.setAlpha(on ? 0.62 : 1);
    v.rig?.setFlash(on ? 0x7a7a8a : null);
  }

  update(_t, dtMs) {
    const dt = Math.min(0.05, dtMs / 1000) * this.speed;
    for (const v of this.views.values()) {
      if (!v.rig || !v.rig.active) continue;
      if (v.atk) {
        v.atk.t += dt;
        const f = Math.min(v.atk.fd.visible - 1, Math.floor((v.atk.t / v.atk.dur) * v.atk.fd.visible));
        v.rig.attackFrame = Math.max(0, f);
        v.rig.animate(dt, 'attack', 1);
        if (v.atk.t >= v.atk.dur) { v.rig.moveKey = null; v.rig.frameData = null; v.rig.attackFrame = 0; v.rig.currentClip = null; v.atk = null; }
      } else {
        v.rig.animate(dt, 'idle', 1);
      }
    }
    this.pollGamepad();
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
    this.add.text(x + 8, H - 62, 'Left click: select / confirm\nRight click, Esc: cancel\nArrows / WASD: cursor', textStyle('caption', { fontSize: '11px', lineSpacing: 4 })).setDepth(20);
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
    this.turnText.setText(`TURN ${b.turn}  ·  ${b.phase === 'player' ? 'PLAYER PHASE' : 'ENEMY PHASE'}`);
    if (u) {
      const c = CHARACTERS[u.id];
      const ring = u.team === 'player' ? 0x35a8ff : 0xff4f5f;
      this.pAdd(drawPortraitDisc(this, x + 34, y + 38, 64, {
        textureKey: menuPortraitKey(c), face: faceFrame(this, c), n: c.atomicNumber, sym: c.symbol, ring,
      }));
      this.pAdd(this.add.text(x + 78, y + 8, u.name.toUpperCase(), textStyle('h3', { fontSize: '17px' })));
      this.pAdd(this.add.text(x + 78, y + 30, `Lv ${u.level}  ${u.team === 'player' ? 'ALLY' : u.boss ? 'BOSS' : 'ENEMY'}`, textStyle('label', { color: u.team === 'player' ? THEME.tealCss : THEME.pinkCss })));
      this.pAdd(this.add.text(x + 78, y + 46, u.moveName, textStyle('caption', { fontSize: '12px' })));
      y += 86;
      const bar = this.add.graphics();
      bar.fillStyle(0x000000, 0.7);
      bar.fillRect(x, y, 206, 12);
      bar.fillStyle(u.team === 'player' ? HP_PLAYER : HP_ENEMY, 1);
      bar.fillRect(x + 1, y + 1, 204 * Phaser.Math.Clamp(u.hp / u.maxHp, 0, 1), 10);
      this.pAdd(bar);
      this.pAdd(this.add.text(x + 4, y + 16, `HP ${u.hp} / ${u.maxHp}`, textStyle('mono')));
      y += 40;
      const stats = [['POW', u.power], ['DEF', u.def], ['SPD', u.spd], ['MOV', u.mov], ['RNG', u.range[0] === u.range[1] ? u.range[0] : `${u.range[0]}-${u.range[1]}`]];
      stats.forEach(([k, v], i) => {
        const cx = x + (i % 3) * 70;
        const cy = y + Math.floor(i / 3) * 38;
        this.pAdd(this.add.text(cx, cy, k, textStyle('label')));
        this.pAdd(this.add.text(cx, cy + 14, String(v), textStyle('h3', { fontSize: '19px' })));
      });
      y += 84;
      if (u.team === 'player') {
        this.pAdd(this.add.text(x, y, `EXP ${u.xp} / ${XP_PER_LEVEL}`, textStyle('label')));
        const xb = this.add.graphics();
        xb.fillStyle(0x000000, 0.7);
        xb.fillRect(x, y + 16, 206, 6);
        xb.fillStyle(THEME.gold, 1);
        xb.fillRect(x, y + 16, 206 * (u.xp / XP_PER_LEVEL), 6);
        this.pAdd(xb);
      }
    }
    // terrain card
    const t = b.tile(this.cursor.x, this.cursor.y);
    const ty0 = 404;
    this.pAdd(drawPanel(this, PANEL_X, ty0, 216, 92, 12, THEME.teal, 0.35));
    const thumb = this.add.image(PANEL_X + 8 + 32, ty0 + 46, tileKey(t.id)).setDisplaySize(56, 56);
    this.pAdd(thumb);
    this.pAdd(this.add.text(PANEL_X + 78, ty0 + 12, t.name.toUpperCase(), textStyle('h3', { fontSize: '15px' })));
    const info = Number.isFinite(t.cost) ? `Move cost ${t.cost}\nDefense +${t.def}\nAvoid +${t.avoid}${t.heal ? '\nHeals' : ''}` : 'Impassable';
    this.pAdd(this.add.text(PANEL_X + 78, ty0 + 34, info, textStyle('caption', { fontSize: '11px', lineSpacing: 2 })));
    // counts
    this.pAdd(this.add.text(x, ty0 + 104, `ALLIES ${b.players.length}   FOES ${b.enemies.length}`, textStyle('mono')));
    this.endBtn?.container.setVisible(b.phase === 'player' && !b.result);
    this.endBtn?.zone.setVisible(b.phase === 'player' && !b.result);
  }

  showForecast(att, def) {
    this.hideForecast();
    const f = this.battle.forecastFor(att, def);
    const x = PANEL_X;
    const y = 64;
    const objs = [];
    const add = (o) => { o.setDepth(30); objs.push(o); return o; };
    const solid = this.add.graphics();
    solid.fillStyle(THEME.ink, 1);
    solid.fillRoundedRect(x, y, 216, 330, 12);
    add(solid);
    add(drawPanel(this, x, y, 216, 330, 12, THEME.gold, 0.9));
    add(this.add.text(x + 108, y + 10, 'FORECAST', textStyle('kicker')).setOrigin(0.5, 0));
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
    if (f.att.mult > 1.05) notes.push('Element: effective');
    else if (f.att.mult < 0.95) notes.push('Element: resisted');
    const tile = this.battle.tile(def.x, def.y);
    if (tile.def || tile.avoid) notes.push(`${tile.name}: +${tile.def} DEF, +${tile.avoid} avoid`);
    add(this.add.text(x + 12, y + 238, notes.join('\n'), textStyle('caption', { fontSize: '11px', lineSpacing: 3, wordWrap: { width: 192 } })));
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
    kb(['ESC', 'X', 'BACKSPACE'], () => this.cancel());
    kb(['E', 'TAB'], (ev) => { ev?.preventDefault?.(); this.endTurnPressed(); });
  }

  tileAt(p) {
    const c = Math.floor((p.x - MAPX) / TILE);
    const r = Math.floor((p.y - MAPY) / TILE);
    const { map } = this.battle;
    return c >= 0 && r >= 0 && c < map.w && r < map.h ? { x: c, y: r } : null;
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
      if (u && this.targets.includes(u)) {
        if (this.pending === u) this.doAttack(u);
        else { this.pending = u; this.showForecast(this.sel, u); this.paintRanges({ attack: this.atkSet, targets: [u] }); }
      } else if (fromKey && !u && this.targets.length) {
        // keyboard: cycle to the first target when the cursor isn't on one
        const t = this.targets[0];
        this.setCursor(t.x, t.y);
        this.pending = t;
        this.showForecast(this.sel, t);
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

  async walk(u, path) {
    const v = this.views.get(u.uid);
    for (const step of path.slice(1)) {
      if (v.rig) v.rig.facing = step.x < Math.round((v.cont.x - MAPX - TILE / 2) / TILE) ? -1 : step.x > Math.round((v.cont.x - MAPX - TILE / 2) / TILE) ? 1 : v.rig.facing;
      const hop = this.tween({ targets: v.cont, x: tx(step.x) + TILE / 2, y: ty(step.y) + FEET, duration: 110, ease: 'Sine.easeInOut', onUpdate: () => this.sortDepth(v) });
      this.tween({ targets: v.rig || v.cont, y: '-=6', duration: 55, yoyo: true });
      await hop;
    }
    this.battle.moveUnit(u, path[path.length - 1].x, path[path.length - 1].y);
    this.sortDepth(v);
  }

  async moveSelected(x, y) {
    const u = this.sel;
    this.mode = 'busy';
    this.paintRanges();
    const path = this.battle.pathFor(u, { x, y }, this.reach);
    await this.walk(u, path);
    this.setCursor(x, y);
    this.openMenu();
  }

  // ----------------------------------------------------------- action menu
  openMenu() {
    const b = this.battle;
    const u = this.sel;
    this.mode = 'menu';
    this.targets = b.targetsFrom(u);
    const items = [];
    if (this.targets.length) items.push({ id: 'attack', label: 'Attack' });
    if (b.canSeize(u)) items.push({ id: 'seize', label: 'Seize' });
    items.push({ id: 'wait', label: 'Wait' });
    this.menuItems = items;
    this.menuSel = 0;
    const objs = [];
    const w = 132;
    const rowH = 36;
    const h = items.length * rowH + 12;
    let mx = tx(u.x) + TILE + 6;
    if (mx + w > MAPX + b.map.w * TILE) mx = tx(u.x) - w - 6;
    let my = Math.min(ty(u.y), MAPY + b.map.h * TILE - h);
    const bg = drawPanel(this, mx, my, w, h, 10, THEME.gold, 0.9).setDepth(70);
    objs.push(bg);
    this.menuRows = items.map((it, i) => {
      const row = this.add.text(mx + 16, my + 6 + i * rowH + rowH / 2, it.label.toUpperCase(), { fontFamily: FONT_DISPLAY, fontSize: '15px', color: THEME.mistCss, letterSpacing: 2 }).setOrigin(0, 0.5).setDepth(71);
      const zone = this.add.zone(mx, my + 6 + i * rowH, w, rowH).setOrigin(0, 0).setDepth(72).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => { this.menuSel = i; this.paintMenu(); });
      zone.on('pointerdown', (p) => { if (p.leftButtonDown()) { this.menuSel = i; this.menuPick(); } });
      objs.push(row, zone);
      return row;
    });
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
    this.menuRows.forEach((r, i) => r.setColor(i === this.menuSel ? THEME.goldCss : THEME.mistCss));
  }

  menuMove(d) {
    this.menuSel = (this.menuSel + d + this.menuItems.length) % this.menuItems.length;
    this.paintMenu();
    sfx('menuMove');
  }

  closeMenu() {
    this.menuObjs?.forEach((o) => o.destroy());
    this.menuObjs = null;
    this.menuSelG?.destroy();
    this.menuSelG = null;
  }

  menuPick() {
    const it = this.menuItems[this.menuSel];
    if (!it) return;
    sfx('menuConfirm');
    this.closeMenu();
    if (it.id === 'wait') this.finishAction(this.sel);
    else if (it.id === 'seize') { this.mode = 'busy'; this.paintRanges(); this.battle.seize(this.sel); this.finishAction(this.sel, true); }
    else if (it.id === 'attack') {
      this.mode = 'target';
      this.pending = null;
      const u = this.sel;
      this.atkSet = new Map(ringTiles(this.battle.map, u.x, u.y, u.range[0], u.range[1]).map((t) => [key(t.x, t.y), t]));
      this.paintRanges({ attack: this.atkSet, targets: this.targets });
      const t = this.targets[0];
      this.pending = t;
      this.setCursor(t.x, t.y);
      this.showForecast(u, t);
      this.paintRanges({ attack: this.atkSet, targets: [t] });
    }
  }

  // --------------------------------------------------------------- combat
  async doAttack(target) {
    const att = this.sel;
    this.mode = 'busy';
    this.hideForecast();
    this.paintRanges();
    await this.combat(att, target);
    this.finishAction(att, true);
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

  async combat(att, def) {
    const b = this.battle;
    const va = this.views.get(att.uid);
    const vd = this.views.get(def.uid);
    if (va.rig) va.rig.facing = def.x < att.x ? -1 : def.x > att.x ? 1 : va.rig.facing;
    if (vd.rig) vd.rig.facing = att.x < def.x ? -1 : att.x > def.x ? 1 : vd.rig.facing;
    const before = new Map([[att.uid, att.hp], [def.uid, def.hp]]);
    const res = b.attack(att, def);
    // the state already holds the final HP; the bars catch up strike by strike
    va.shownHp = before.get(att.uid);
    vd.shownHp = before.get(def.uid);
    for (const strike of res.log) {
      const sv = strike.by === 'att' ? va : vd;
      const tv = strike.by === 'att' ? vd : va;
      await this.strike(sv, tv, strike);
    }
    for (const k of res.killed) {
      const v = this.views.get(k.uid);
      sfx('ko');
      await this.tween({ targets: v.cont, alpha: 0, y: v.cont.y - 14, duration: 420 });
      v.cont.destroy();
      this.views.delete(k.uid);
    }
    for (const x of res.xp) {
      const v = this.views.get(x.unit.uid);
      if (!v) continue;
      this.floatText(v.cont.x, v.cont.y - 90, `EXP +${x.amount}`, THEME.goldCss, 15);
      await this.wait(380);
      for (const lu of x.levelUps) {
        this.levelUps.push({ name: x.unit.name, level: lu.level });
        const g = lu.gains;
        const parts = [`HP+${g.hp}`, g.power && 'POW+1', g.def && 'DEF+1', g.spd && 'SPD+1'].filter(Boolean).join('  ');
        sfx('go');
        await this.banner(`LEVEL UP  ${x.unit.name.toUpperCase()}  Lv ${lu.level}`, parts, THEME.gold);
      }
    }
    this.refreshPanel();
  }

  async strike(sv, tv, s) {
    const a = sv.u;
    const clip = sv.rig && this.clipLoaded(a);
    const dx = Math.sign(tv.cont.x - sv.cont.x) || 1;
    sfx('whoosh');
    const dur = 0.55;
    if (clip) {
      const mv = basicMove(CHARACTERS[a.id]);
      const fd = frameData(mv?.duration ?? 250, mv?.cooldown ?? 380, mv || {}, 1000 / 60);
      sv.rig.moveKey = 'basicDirectional';
      sv.rig.moveSlot = 'basic';
      sv.rig.frameData = fd;
      sv.rig.attackFrame = 0;
      sv.atk = { t: 0, dur, fd };
    }
    const home = sv.cont.x;
    this.tween({ targets: sv.cont, x: home + dx * 16, duration: 140, yoyo: true, ease: 'Sine.easeOut', hold: 60 });
    await this.wait(dur * 1000 * 0.42);
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

  floatText(x, y, text, color, size = 20) {
    const t = this.add.text(x, y, text, { fontFamily: FONT_DISPLAY, fontSize: `${size}px`, color, stroke: '#07060E', strokeThickness: 5 }).setOrigin(0.5).setDepth(90);
    this.tweens.add({ targets: t, y: y - 34, alpha: { from: 1, to: 0 }, duration: 900 / this.speed, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  async banner(title, sub, color = THEME.teal) {
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
  }

  // --------------------------------------------------------------- phases
  async startPlayerPhase(first = false) {
    const b = this.battle;
    this.mode = 'busy';
    const healed = b.startPhase('player');
    for (const v of this.views.values()) this.setGrey(v, false);
    this.refreshPanel();
    await this.banner('PLAYER PHASE', first ? this.chapter.objective : `Turn ${b.turn}`, 0x35a8ff);
    for (const h of healed) {
      const v = this.views.get(h.unit.uid);
      if (v) { v.shownHp = h.unit.hp; this.paintBar(v); this.floatText(v.cont.x, v.cont.y - 80, `+${h.amount}`, '#53E0A8', 20); }
    }
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
    this.mode = 'busy';
    const healed = b.endPlayerPhase();
    this.refreshPanel();
    await this.banner('ENEMY PHASE', `Turn ${b.turn}`, 0xff4f5f);
    for (const h of healed) {
      const v = this.views.get(h.unit.uid);
      if (v) { v.shownHp = h.unit.hp; this.paintBar(v); this.floatText(v.cont.x, v.cont.y - 80, `+${h.amount}`, '#53E0A8', 20); }
    }
    let guard = 0;
    while (!b.result && guard++ < 40) {
      const u = b.nextEnemy();
      if (!u) break;
      const plan = b.plan(u);
      const v = this.views.get(u.uid);
      this.setCursor(u.x, u.y);
      if (plan.to.x !== u.x || plan.to.y !== u.y) {
        const reach = b.reachFor(u);
        await this.walk(u, b.pathFor(u, plan.to, reach));
      }
      if (plan.target) {
        this.setCursor(plan.target.x, plan.target.y);
        await this.wait(260);
        await this.combat(u, plan.target);
      } else b.wait(u);
      u.acted = true;
      if (v && u.alive) this.setGrey(v, true);
      await this.wait(160);
    }
    if (b.result) { this.finish(); return; }
    for (const v of this.views.values()) this.setGrey(v, false);
    b.endEnemyPhase();
    await this.startPlayerPhase();
  }

  // --------------------------------------------------------------- result
  async finish() {
    const b = this.battle;
    this.mode = 'busy';
    this.paintRanges();
    const won = b.result === 'victory';
    sfx(won ? 'gameEnd' : 'alarm');
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
