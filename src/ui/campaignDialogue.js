// Fire Emblem-style conversation: big portraits on the left and right, a name plate
// that follows the speaker, typewriter text, advance / skip, narration lines.
// Used before and after battles (CampaignScene) and mid-battle (CampaignBattleScene).
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import { FONT_DISPLAY, THEME, drawPanel, drawPortraitDisc, textStyle } from './theme.js';
import { CHARACTERS } from '../data/characters.js';
import { faceFrame, menuPortraitKey } from './portraits.js';

/** A standing figure: the painted cut when it is clean, otherwise frame 0 of the idle sheet. */
export function placeFigure(scene, charDef, x, footY, height, faceDir) {
  const art = charDef.art;
  const k = menuPortraitKey(charDef);
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
