import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import {
  FONT_DISPLAY, THEME, drawFooterHints, drawMenuBackground, drawPanel, drawPortraitDisc, makeButton, textStyle,
} from '../ui/theme.js';
import { enterScene, isLeaving, showScene } from '../ui/flow.js';
import { CHARACTERS } from '../data/characters.js';
import { faceFrame, menuPortraitKey } from '../ui/portraits.js';
import { CHAPTERS, afterVictory, loadSave, newCampaign, partyForChapter, writeSave, clearSave } from '../campaign/index.js';
import { loadCampaignArt, releaseCampaignArt } from '../campaign/art.js';

/** Fighters a chapter needs on screen: party, recruits, enemies and the story's speakers. */
export function chapterFighterIds(save, chapter) {
  const ids = new Set(partyForChapter(save, chapter).map((r) => r.id));
  for (const e of chapter.enemies) ids.add(e.id);
  for (const l of [...(chapter.intro || []), ...(chapter.outro || [])]) if (l.who) ids.add(l.who);
  return [...ids];
}

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

export default class CampaignScene extends Phaser.Scene {
  constructor() {
    super('Campaign');
  }

  init(data) {
    this.incoming = data || {};
  }

  create() {
    this.busy = false;
    this.keyHandlers = [];
    drawMenuBackground(this, W, H);
    this.save = this.incoming.save || loadSave();
    if (this.incoming.after) this.showAfter(this.incoming.after);
    else this.showMenu();
    enterScene(this);
    this.events.once('shutdown', () => this.clearKeys());
  }

  // ------------------------------------------------------------- helpers
  clearKeys() {
    for (const [ev, fn] of this.keyHandlers) this.input.keyboard?.off(ev, fn);
    this.keyHandlers = [];
  }

  onKey(names, fn) {
    for (const n of [].concat(names)) {
      const ev = `keydown-${n}`;
      this.input.keyboard.on(ev, fn);
      this.keyHandlers.push([ev, fn]);
    }
  }

  clearStage() {
    this.clearKeys();
    // a button mid-press still has a tween that repaints it; stop that before it is destroyed
    this.stage?.forEach((o) => { this.tweens.killTweensOf(o); o.destroy(); });
    this.stage = [];
  }

  add2(o) {
    (this.stage ||= []).push(o);
    return o;
  }

  header(kicker, title) {
    this.add2(this.add.text(W / 2, 46, kicker, textStyle('kicker')).setOrigin(0.5, 0).setDepth(6));
    this.add2(this.add.text(W / 2, 66, title, {
      fontFamily: FONT_DISPLAY, fontSize: '40px', color: THEME.mistCss, letterSpacing: 4,
      shadow: { offsetX: 0, offsetY: 0, color: '#FF4FA3', blur: 20, fill: true },
    }).setOrigin(0.5, 0).setDepth(6));
  }

  // ---------------------------------------------------------------- menu
  showMenu() {
    this.clearStage();
    this.header('TACTICS', 'CAMPAIGN');
    const save = this.save;
    const px = 340;
    const py = 150;
    const pw = 600;
    this.add2(drawPanel(this, px, py, pw, 250, 18).setDepth(5));
    this.add2(this.add.text(px + 28, py + 22, 'CHAPTERS', textStyle('kicker')).setDepth(6));
    CHAPTERS.forEach((ch, i) => {
      const y = py + 58 + i * 58;
      const cleared = save?.cleared?.includes(ch.id);
      const current = save ? save.chapter === i : i === 0;
      const locked = save ? i > save.chapter : i > 0;
      const col = cleared ? THEME.goldCss : locked ? THEME.disabledCss : THEME.mistCss;
      this.add2(this.add.text(px + 28, y, ch.kicker, textStyle('label', { color: locked ? THEME.disabledCss : THEME.tealCss })).setDepth(6));
      this.add2(this.add.text(px + 28, y + 16, ch.title, textStyle('h3', { color: col })).setDepth(6));
      const tag = cleared ? 'CLEARED' : current ? 'NEXT' : locked ? 'LOCKED' : '';
      this.add2(this.add.text(px + pw - 28, y + 14, tag, textStyle('label', { color: col })).setOrigin(1, 0).setDepth(6));
      this.add2(this.add.text(px + pw - 28, y, ch.objective.toUpperCase(), textStyle('label')).setOrigin(1, 0).setDepth(6));
    });
    const entries = [];
    if (save && save.chapter < CHAPTERS.length) entries.push({ label: save.chapter === 0 ? 'Start Chapter 1' : `Continue: Chapter ${save.chapter + 1}`, run: () => this.beginChapter(save.chapter, save) });
    if (save && save.chapter >= CHAPTERS.length) entries.push({ label: 'Replay Chapter 3', run: () => this.beginChapter(CHAPTERS.length - 1, { ...save, chapter: CHAPTERS.length - 1, party: save.party }) });
    entries.push({ label: save ? 'New Campaign (erase save)' : 'New Campaign', run: () => { clearSave(); this.save = newCampaign(); writeSave(this.save); this.beginChapter(0, this.save); } });
    entries.push({ label: 'Back', run: () => this.backHome() });
    this.buttons = entries.map((e, i) => {
      const b = makeButton(this, { x: W / 2 - 190, y: 430 + i * 56, w: 380, h: 46, label: e.label, onPress: () => { sfx('menuConfirm'); this.time.delayedCall(260, () => { if (!isLeaving(this)) e.run(); }); } });
      b.onHover = () => this.selectBtn(i);
      this.stage.push(b.container, b.zone);
      return b;
    });
    this.sel = 0;
    this.buttons[0].setSelected(true);
    this.add2(this.footerHints([{ keys: ['W', 'S'], label: 'Choose' }, { key: 'ENTER', label: 'Select' }, { key: 'ESC', label: 'Back' }]));
    this.onKey(['UP', 'W'], () => this.moveBtn(-1));
    this.onKey(['DOWN', 'S'], () => this.moveBtn(1));
    this.onKey(['ENTER', 'SPACE', 'F', 'K'], () => this.buttons[this.sel].press());
    this.onKey(['ESC', 'BACKSPACE'], () => this.backHome());
  }

  footerHints(list) {
    const h = drawFooterHints(this, list);
    const holder = { destroy: () => { h.sep.destroy(); h.items.forEach((it) => { it.chips.forEach((c) => c.destroy()); it.label.destroy(); }); } };
    return holder;
  }

  selectBtn(i) {
    if (i === this.sel) return;
    this.buttons[this.sel].setSelected(false);
    this.sel = i;
    this.buttons[i].setSelected(true);
    sfx('menuMove');
  }

  moveBtn(d) {
    this.selectBtn((this.sel + d + this.buttons.length) % this.buttons.length);
  }

  backHome() {
    if (isLeaving(this)) return;
    releaseCampaignArt(this);
    showScene(this, 'Title');
  }

  // ------------------------------------------------------------- chapter
  beginChapter(index, save) {
    if (this.busy) return;
    this.busy = true;
    this.save = save;
    const chapter = CHAPTERS[index];
    this.clearStage();
    loadCampaignArt(this, chapterFighterIds(save, chapter), 'idle', () => {
      this.busy = false;
      this.clearStage();
      this.playStory(chapter, chapter.intro, () => {
        if (isLeaving(this)) return;
        showScene(this, 'CampaignBattle', { chapterIndex: index, save, seed: (Date.now() & 0xfffff) || 1 });
      }, true);
    }, { hud: true });
  }

  // --------------------------------------------------------------- story
  playStory(chapter, lines, onDone, titleCard = false) {
    this.clearStage();
    this.add2(this.add.text(W / 2, 30, chapter.kicker, textStyle('kicker')).setOrigin(0.5, 0).setDepth(6));
    this.add2(this.add.text(W / 2, 50, chapter.title, textStyle('h1')).setOrigin(0.5, 0).setDepth(6));
    if (titleCard) this.add2(this.add.text(W / 2, 98, `OBJECTIVE: ${chapter.objective.toUpperCase()}`, textStyle('label', { color: THEME.goldCss })).setOrigin(0.5, 0).setDepth(6));
    const boxY = 520;
    this.add2(drawPanel(this, 120, boxY, W - 240, 160, 16).setDepth(20));
    const nameT = this.add2(this.add.text(160, boxY + 18, '', textStyle('h3', { color: THEME.tealCss })).setDepth(21));
    const bodyT = this.add2(this.add.text(160, boxY + 52, '', textStyle('body', { fontSize: '19px', wordWrap: { width: W - 340 }, lineSpacing: 6 })).setDepth(21));
    const more = this.add2(this.add.text(W - 150, boxY + 140, 'ENTER ▸', textStyle('label')).setOrigin(1, 1).setDepth(21));
    this.tweens.add({ targets: more, alpha: { from: 0.3, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
    this.add2(this.footerHints([{ key: 'ENTER', label: 'Next' }, { key: 'ESC', label: 'Skip' }]));
    const figs = [];
    let i = -1;
    let typing = null;
    let finishedLine = true;
    let done = false;
    const sideOf = (who) => (chapter.enemies.some((e) => e.id === who) ? 'R' : 'L');
    const finish = () => {
      if (done) return;
      done = true;
      this.clearKeys();
      this.input.off('pointerdown', next);
      onDone();
    };
    const next = () => {
      if (done) return;
      if (typing && !finishedLine) { typing.remove(); typing = null; bodyT.setText(lines[i].text); finishedLine = true; return; }
      i += 1;
      if (i >= lines.length) { finish(); return; }
      const line = lines[i];
      const c = CHARACTERS[line.who];
      nameT.setText((c?.name || '').toUpperCase());
      const side = sideOf(line.who);
      figs.forEach((f) => f.setAlpha(0.35));
      if (c && !figs.find((f) => f.who === line.who)) {
        const x = side === 'L' ? 300 : W - 300;
        const img = placeFigure(this, c, x, boxY + 10, 470, side === 'L' ? 1 : -1);
        if (img) { img.who = line.who; img.setDepth(10); this.add2(img); figs.push(img); img.setAlpha(0); }
      }
      for (const f of figs) {
        const on = f.who === line.who;
        this.tweens.add({ targets: f, alpha: on ? 1 : 0.3, duration: 160 });
      }
      bodyT.setText('');
      finishedLine = false;
      let n = 0;
      typing = this.time.addEvent({
        delay: 16, repeat: line.text.length - 1,
        callback: () => { n += 1; bodyT.setText(line.text.slice(0, n)); if (n >= line.text.length) finishedLine = true; },
      });
      sfx('menuMove');
    };
    this.onKey(['ENTER', 'SPACE', 'F', 'K'], next);
    this.input.on('pointerdown', next);
    this.onKey(['ESC'], finish);
    next();
  }

  // ------------------------------------------------------------- results
  showAfter(after) {
    const { result, chapterIndex, survivors, fallen, levelUps, turns } = after;
    const chapter = CHAPTERS[chapterIndex];
    if (result === 'victory') {
      let save = this.save || newCampaign();
      save = afterVictory(save, chapterIndex, survivors);
      this.save = save;
      writeSave(save);
      this.playStory(chapter, chapter.outro || [], () => this.showSummary(after, true));
    } else {
      this.showSummary(after, false);
    }
  }

  showSummary(after, won) {
    this.clearStage();
    const { chapterIndex, survivors, fallen, turns, levelUps } = after;
    const chapter = CHAPTERS[chapterIndex];
    this.header(won ? 'CHAPTER CLEAR' : 'DEFEAT', chapter.title);
    const px = 260;
    const py = 150;
    const pw = W - 520;
    this.add2(drawPanel(this, px, py, pw, won ? 290 : 130, 18, won ? THEME.gold : THEME.pink).setDepth(5));
    const lines = [];
    if (won) {
      lines.push(`Turns taken: ${turns}`);
      lines.push(`Survivors: ${survivors.map((r) => CHARACTERS[r.id].name).join(', ')}`);
      lines.push(`Fallen: ${fallen.length ? fallen.map((n) => n).join(', ') : 'none'}`);
      lines.push(`Level-ups: ${levelUps.length ? levelUps.map((l) => `${l.name} → Lv ${l.level}`).join(', ') : 'none'}`);
      lines.push('Everyone is healed between chapters. Fallen fighters stay down.');
    } else {
      lines.push(after.reason === 'lord' ? 'Hydra has fallen.' : 'The whole party has fallen.');
      lines.push('Retry the chapter with the party you started it with.');
    }
    lines.forEach((t, i) => this.add2(this.add.text(px + 36, py + 36 + i * 44, t, textStyle('body', { fontSize: '18px', wordWrap: { width: pw - 72 } })).setDepth(6)));
    const entries = [];
    const finished = won && chapterIndex + 1 >= CHAPTERS.length;
    if (won && !finished) entries.push({ label: `Next: Chapter ${chapterIndex + 2}`, run: () => this.beginChapter(chapterIndex + 1, this.save) });
    if (!won) entries.push({ label: 'Retry Chapter', run: () => this.beginChapter(chapterIndex, this.save || loadSave() || newCampaign()) });
    if (finished) this.add2(this.add.text(W / 2, 470, 'THE CLOUD IS QUIET. CAMPAIGN COMPLETE.', textStyle('h2', { color: THEME.goldCss })).setOrigin(0.5).setDepth(6));
    entries.push({ label: 'Campaign Menu', run: () => this.showMenu() });
    entries.push({ label: 'Return Home', run: () => this.backHome() });
    this.buttons = entries.map((e, i) => {
      const b = makeButton(this, { x: W / 2 - 190, y: (won ? 480 : 310) + i * 54, w: 380, h: 44, label: e.label, onPress: () => { sfx('menuConfirm'); this.time.delayedCall(260, () => { if (!isLeaving(this)) e.run(); }); } });
      b.onHover = () => this.selectBtn(i);
      this.stage.push(b.container, b.zone);
      return b;
    });
    this.sel = 0;
    this.buttons[0].setSelected(true);
    this.onKey(['UP', 'W'], () => this.moveBtn(-1));
    this.onKey(['DOWN', 'S'], () => this.moveBtn(1));
    this.onKey(['ENTER', 'SPACE', 'F', 'K'], () => this.buttons[this.sel].press());
    if (won) sfx('gameEnd');
  }
}
