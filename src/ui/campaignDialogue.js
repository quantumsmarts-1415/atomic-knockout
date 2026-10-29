// Fire Emblem-style conversation: big portraits on the left and right, a name plate
// that follows the speaker, typewriter text, advance / skip, narration lines.
// Used before and after battles (CampaignScene) and mid-battle (CampaignBattleScene).
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { FONT_DISPLAY, THEME, drawPanel, drawPortraitDisc, textStyle } from './theme.js';
import { CHARACTERS } from '../data/characters.js';
import { faceFrame, menuPortraitKey } from './portraits.js';

/** A standing figure: the painted cut when it is clean, otherwise frame 0 of the idle sheet. */
// fighters whose painted cut is a different design from their in-game sheets: use the sheet so the figure
// matches the map unit and the face disc
const PREFER_SHEET = new Set(['lillie']);

export function placeFigure(scene, charDef, x, footY, height, faceDir) {
  const art = charDef.art;
  const k = PREFER_SHEET.has(charDef.id) ? null : menuPortraitKey(charDef);
  let img = null;
  if (k && scene.textures.exists(k)) {
    img = scene.add.image(x, footY, k).setOrigin(0.5, 1);
    img.setScale(height / img.height);
  } else if (art?.sheets && scene.textures.exists(`${art.key}-idle`)) {
    const s = art.sheets;
    img = scene.add.image(x, footY, `${art.key}-idle`, 0).setOrigin(0.5, s.footY);
    img.setScale(height / (s.visibleH ?? s.frameH));
  }
  if (img && (art?.facing ?? 1) !== faceDir) img.setFlipX(true);
  return img;
}

const BOX_Y = 520;
const FIG_H = 450;

/**
 * Play a conversation. Resolves when it ends or is skipped.
 *   lines   [{ who, text, side? }]  who null = narration
 *   sideOf  (id) => 'L' | 'R'       default: allies left, everyone else right
 *   dim     darken what is behind (mid-battle)  0..1
 *   depth   base depth (default 200)
 */
export function playDialogue(scene, { lines, enemyIds = [], dim = 0, depth = 200, speed = 1, tag = null } = {}) {
  return new Promise((resolve) => {
    // Who stands where: foes right, friends left; if nobody in the scene is a foe, friends alternate sides.
    const foes = new Set(enemyIds);
    const speakers = [...new Set(lines.map((l) => l.who).filter(Boolean))];
    const anyFoe = speakers.some((id) => foes.has(id));
    const sideMap = new Map();
    let friends = 0;
    for (const id of speakers) {
      if (foes.has(id)) sideMap.set(id, 'R');
      else if (anyFoe) sideMap.set(id, 'L');
      else { sideMap.set(id, friends % 2 === 0 ? 'L' : 'R'); friends += 1; }
    }
    const sideOf = (id) => sideMap.get(id) || 'L';
    const slots = { L: [], R: [] }; // ids standing on each side, oldest first (max 2)
    const slotX = (side, n) => (side === 'L' ? [250, 470][n] : [W - 250, W - 470][n]);
    const objs = [];
    const add = (o, d = 0) => { o.setDepth(depth + d); objs.push(o); return o; };
    if (dim > 0) {
      const veil = scene.add.rectangle(W / 2, H / 2, W, H, 0x050410, dim).setInteractive();
      add(veil, 0);
      veil.setAlpha(0);
      scene.tweens.add({ targets: veil, alpha: dim, duration: 180 / speed });
    }
    // lower strip so portraits do not float
    const strip = scene.add.graphics();
    strip.fillStyle(0x07060e, 0.55);
    strip.fillRect(0, BOX_Y - 36, W, H - BOX_Y + 36);
    add(strip, 1);
    add(drawPanel(scene, 90, BOX_Y, W - 180, 170, 16), 20);
    const plate = add(scene.add.container(0, 0), 22);
    const nameT = add(scene.add.text(0, 0, '', { fontFamily: FONT_DISPLAY, fontSize: '20px', color: THEME.tealCss, letterSpacing: 3 }), 24);
    const bodyT = add(scene.add.text(190, BOX_Y + 52, '', textStyle('body', { fontSize: '20px', wordWrap: { width: W - 380 }, lineSpacing: 7 })), 24);
    const more = add(scene.add.text(W - 130, BOX_Y + 154, '▼', textStyle('label', { fontSize: '16px', color: THEME.goldCss })).setOrigin(1, 1), 24);
    scene.tweens.add({ targets: more, alpha: { from: 0.25, to: 1 }, duration: 520, yoyo: true, repeat: -1 });
    const hint = add(scene.add.text(W / 2, H - 18, 'ENTER / click: next      ESC: skip scene', textStyle('caption', { fontSize: '12px', color: THEME.dimCss || '#8a82a8' })).setOrigin(0.5, 1), 24);
    // skip chip
    const skipBg = add(scene.add.graphics(), 30);
    skipBg.fillStyle(THEME.ink, 0.9); skipBg.fillRoundedRect(W - 150, 14, 132, 34, 10);
    skipBg.lineStyle(1.5, THEME.teal, 0.8); skipBg.strokeRoundedRect(W - 150, 14, 132, 34, 10);
    const skipT = add(scene.add.text(W - 84, 31, 'SKIP  ▸▸', textStyle('label', { fontSize: '14px' })).setOrigin(0.5), 31);
    const skipZone = scene.add.zone(W - 84, 31, 132, 34).setDepth(depth + 32).setInteractive({ useHandCursor: true });
    if (tag) add(scene.add.text(W / 2, 62, tag, textStyle('kicker', { color: THEME.goldCss })).setOrigin(0.5, 0), 31);

    const figs = new Map();
    let i = -1;
    let typing = null;
    let typed = true;
    let done = false;
    let skipClick = false;
    let pad = {};

    let curDisc = null;
    const showName = (c, side, enemy) => {
      plate.removeAll(true);
      if (curDisc) { const k = objs.indexOf(curDisc); if (k >= 0) objs.splice(k, 1); curDisc.destroy(); curDisc = null; }
      if (!c) { nameT.setText(''); return; }
      const left = side === 'L';
      const x = left ? 120 : W - 120 - 280;
      const col = enemy ? THEME.pink : THEME.teal;
      const g = scene.add.graphics();
      g.fillStyle(THEME.ink, 1); g.fillRoundedRect(x, BOX_Y - 30, 280, 44, 12);
      g.lineStyle(2, col, 1); g.strokeRoundedRect(x, BOX_Y - 30, 280, 44, 12);
      plate.add(g);
      const disc = drawPortraitDisc(scene, x + 28, BOX_Y - 8, 46, { textureKey: menuPortraitKey(c), face: faceFrame(scene, c), n: c.atomicNumber, sym: c.symbol, ring: col, depth: depth + 23 });
      objs.push(disc);
      curDisc = disc;
      nameT.setPosition(x + 60, BOX_Y - 20).setText(c.name.toUpperCase()).setColor(enemy ? THEME.pinkCss : THEME.tealCss);
    };

    const finish = () => {
      if (done) return;
      done = true;
      typing?.remove();
      scene.input.keyboard?.off('keydown', onKey);
      scene.input.off('pointerdown', onPointer);
      scene.events.off('update', onUpdate);
      scene.tweens.add({
        targets: objs, alpha: 0, duration: 140 / speed,
        onComplete: () => { objs.forEach((o) => { scene.tweens.killTweensOf(o); o.destroy(); }); skipZone.destroy(); resolve(); },
      });
    };

    const next = () => {
      if (done) return;
      const cur = lines[i];
      if (cur && !typed) { typing?.remove(); typing = null; bodyT.setText(cur.text); typed = true; return; }
      i += 1;
      if (i >= lines.length) { finish(); return; }
      const line = lines[i];
      const c = line.who ? CHARACTERS[line.who] : null;
      const side = c ? (line.side || sideOf(line.who)) : 'L';
      const enemy = c ? foes.has(line.who) : false;
      showName(c, side, enemy);
      bodyT.setX(c ? 190 : 150).setWordWrapWidth(c ? W - 380 : W - 300).setFontStyle(c ? '' : 'italic');
      bodyT.setColor(c ? THEME.mistCss : THEME.goldCss);
      if (c && !figs.has(line.who)) {
        const list = slots[side];
        if (list.length >= 2) {
          const old = list.shift();
          const f = figs.get(old);
          figs.delete(old);
          if (f) { scene.tweens.killTweensOf(f); scene.tweens.add({ targets: f, alpha: 0, duration: 140 / speed, onComplete: () => { const k = objs.indexOf(f); if (k >= 0) objs.splice(k, 1); f.destroy(); } }); }
          list.forEach((id, n) => { const g = figs.get(id); if (g) g.baseX = slotX(side, n); });
        }
        list.push(line.who);
        const x = slotX(side, list.length - 1);
        const img = placeFigure(scene, c, x, BOX_Y + 8, FIG_H, side === 'L' ? 1 : -1);
        if (img) {
          img.setDepth(depth + 10).setAlpha(0);
          img.baseX = x; img.baseY = img.y; img.side = side;
          img.x = x + (side === 'L' ? -60 : 60);
          objs.push(img);
          figs.set(line.who, img);
        }
      }
      for (const [id, f] of figs) {
        const on = id === line.who;
        scene.tweens.killTweensOf(f);
        scene.tweens.add({ targets: f, alpha: on ? 1 : 0.28, x: f.baseX, y: on ? f.baseY - 6 : f.baseY, duration: 200 / speed, ease: 'Sine.easeOut' });
        f.setTint(on ? 0xffffff : 0x8a8aa0);
        f.setDepth(depth + (on ? 12 : 10));
      }
      bodyT.setText('');
      typed = false;
      let n = 0;
      typing = scene.time.addEvent({
        delay: Math.max(4, 22 / speed), repeat: line.text.length - 1,
        callback: () => { n += 1; bodyT.setText(line.text.slice(0, n)); if (n >= line.text.length) typed = true; },
      });
      sfx('menuMove');
    };

    const onKey = (ev) => {
      const k = ev.code;
      if (k === 'Escape') finish();
      else if (['Enter', 'Space', 'KeyZ', 'KeyF', 'KeyK', 'NumpadEnter'].includes(k)) next();
      ev.preventDefault?.();
    };
    const onPointer = () => { if (skipClick) { skipClick = false; return; } next(); };
    skipZone.on('pointerdown', () => { skipClick = true; finish(); });
    const onUpdate = () => {
      const p = [...(navigator.getGamepads?.() || [])].find((g) => g && g.connected);
      if (!p) return;
      const a = !!p.buttons[0]?.pressed; const b = !!(p.buttons[1]?.pressed || p.buttons[9]?.pressed);
      if (a && !pad.a) next();
      if (b && !pad.b) finish();
      pad = { a, b };
    };
    scene.input.keyboard?.on('keydown', onKey);
    scene.input.on('pointerdown', onPointer);
    scene.events.on('update', onUpdate);
    // keep the panel/hint tidy
    void hint; void skipT;
    next();
  });
}

/**
 * A boss entrance: the screen darkens, red bands sweep in, the boss stands up large with a name
 * slam and an epithet. Resolves after a beat, or at once on Enter / click / Esc.
 *   card { id, name, epithet }
 */
export function playBossCard(scene, { card, depth = 190, speed = 1 } = {}) {
  return new Promise((resolve) => {
    const charDef = CHARACTERS[card.id];
    const objs = [];
    const add = (o, d = 0) => { o.setDepth(depth + d); objs.push(o); return o; };
    const veil = add(scene.add.rectangle(W / 2, H / 2, W, H, 0x05030c, 1).setAlpha(0), 0);
    scene.tweens.add({ targets: veil, alpha: 0.88, duration: 260 / speed });
    const band = (y, h, col, a, fromX, delay) => {
      const r = scene.add.rectangle(fromX, y, W * 1.3, h, col, a).setRotation(-0.06).setDepth(depth + 1);
      objs.push(r);
      scene.tweens.add({ targets: r, x: W / 2, duration: 420 / speed, delay: delay / speed, ease: 'Cubic.easeOut' });
    };
    band(H * 0.50, 190, 0xa3203a, 0.82, -W, 60);
    band(H * 0.50 + 118, 10, 0xffd166, 0.95, W * 2, 140);
    band(H * 0.50 - 118, 10, 0xffd166, 0.95, -W * 2, 140);
    const fig = charDef ? placeFigure(scene, charDef, W * 0.78, H - 24, 560, -1) : null;
    if (fig) {
      add(fig, 3);
      fig.setAlpha(0).setX(W * 0.78 + 160);
      scene.tweens.add({ targets: fig, alpha: 1, x: W * 0.78, duration: 520 / speed, delay: 200 / speed, ease: 'Cubic.easeOut' });
    }
    const tag = add(scene.add.text(120, H * 0.5 - 86, 'BOSS', textStyle('kicker', { color: '#FFD166', fontSize: '18px' })).setAlpha(0), 4);
    const name = add(scene.add.text(120, H * 0.5 - 62, card.name, { fontFamily: FONT_DISPLAY, fontSize: '88px', color: '#FFFFFF', stroke: '#2a0610', strokeThickness: 8 }).setAlpha(0).setScale(1.6), 4);
    const epi = add(scene.add.text(124, H * 0.5 + 54, card.epithet, textStyle('h3', { color: '#FFE9C2', fontSize: '24px' })).setAlpha(0), 4);
    scene.tweens.add({ targets: tag, alpha: 1, duration: 200 / speed, delay: 380 / speed });
    scene.tweens.add({ targets: name, alpha: 1, scale: 1, duration: 260 / speed, delay: 420 / speed, ease: 'Back.easeOut', onStart: () => { sfx('go'); scene.cameras.main.shake(260 / speed, 0.006); } });
    scene.tweens.add({ targets: epi, alpha: 1, duration: 360 / speed, delay: 760 / speed });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      scene.input.keyboard?.off('keydown', onKey);
      zone.destroy();
      scene.tweens.add({ targets: objs, alpha: 0, duration: 240 / speed, onComplete: () => { objs.forEach((o) => o.destroy()); resolve(); } });
    };
    const onKey = (e) => { if (['Enter', ' ', 'Escape'].includes(e.key)) finish(); };
    scene.input.keyboard?.on('keydown', onKey);
    const zone = scene.add.zone(W / 2, H / 2, W, H).setDepth(depth + 40).setInteractive();
    zone.on('pointerdown', finish);
    scene.time.delayedCall(2900 / speed, finish);
  });
}
