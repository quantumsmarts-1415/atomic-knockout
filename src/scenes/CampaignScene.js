import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import {
  FONT_DISPLAY, THEME, drawFooterHints, drawMenuBackground, drawPanel, drawPortraitDisc, makeButton, textStyle,
} from '../ui/theme.js';
import { enterScene, isLeaving, showScene } from '../ui/flow.js';
import { CHARACTERS } from '../data/characters.js';
import { faceFrame, menuPortraitKey } from '../ui/portraits.js';
import { CHAPTERS, PROLOGUE, afterVictory, chapterSpeakers, loadSave, newCampaign, partyForChapter, writeSave, clearSave } from '../campaign/index.js';
import { playDialogue } from '../ui/campaignDialogue.js';
import { loadCampaignArt, releaseCampaignArt, tileKey } from '../campaign/art.js';

/** Fighters a chapter needs on screen: party, recruits, enemies and the story's speakers. */
export function chapterFighterIds(save, chapter) {
  const ids = new Set(partyForChapter(save, chapter).map((r) => r.id));
  for (const e of chapter.enemies) ids.add(e.id);
  for (const id of chapterSpeakers(chapter)) ids.add(id);
  if (chapter.id === CHAPTERS[0].id) for (const l of PROLOGUE.lines) if (l.who) ids.add(l.who);
  return [...ids];
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
    this.speed = Number(new URLSearchParams(window.location.search).get('campspeed')) || 1;
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
    const px = 250;
    const py = 116;
    const pw = W - 500;
    const rowH = 38;
    this.add2(drawPanel(this, px, py, pw, 62 + CHAPTERS.length * rowH, 18).setDepth(5));
    this.add2(this.add.text(px + 28, py + 18, 'CHAPTERS', textStyle('kicker')).setDepth(6));
    CHAPTERS.forEach((ch, i) => {
      const y = py + 46 + i * rowH;
      const cleared = save?.cleared?.includes(ch.id);
      const current = save ? save.chapter === i : i === 0;
      const locked = save ? i > save.chapter : i > 0;
      const col = cleared ? THEME.goldCss : locked ? THEME.disabledCss : THEME.mistCss;
      this.add2(this.add.text(px + 28, y + 4, `${i + 1}`, textStyle('label', { color: locked ? THEME.disabledCss : THEME.tealCss, fontSize: '16px' })).setDepth(6));
      this.add2(this.add.text(px + 60, y, locked ? '???' : ch.title, textStyle('h3', { color: col })).setDepth(6));
      this.add2(this.add.text(px + 60, y + 19, ch.objective.toUpperCase(), textStyle('label', { color: locked ? THEME.disabledCss : THEME.dimCss, fontSize: '10px' })).setDepth(6));
      const tag = cleared ? 'CLEARED' : current ? 'NEXT' : locked ? 'LOCKED' : '';
      this.add2(this.add.text(px + pw - 28, y + 8, tag, textStyle('label', { color: col })).setOrigin(1, 0).setDepth(6));
    });
    const entries = [];
    if (save && save.chapter < CHAPTERS.length) entries.push({ label: save.chapter === 0 ? 'Start Chapter 1' : `Continue: Chapter ${save.chapter + 1}`, run: () => this.beginChapter(save.chapter, save) });
    if (save && save.chapter >= CHAPTERS.length) entries.push({ label: 'Replay Final Chapter', run: () => this.beginChapter(CHAPTERS.length - 1, { ...save, chapter: CHAPTERS.length - 1, party: save.party }) });
    entries.push({ label: save ? 'New Campaign (erase save)' : 'New Campaign', run: () => { clearSave(); this.save = newCampaign(); writeSave(this.save); this.beginChapter(0, this.save); } });
    entries.push({ label: 'Back', run: () => this.backHome() });
    this.buttons = entries.map((e, i) => {
      const b = makeButton(this, { x: W / 2 - 190, y: 106 + 62 + CHAPTERS.length * 38 + 14 + i * 50, w: 380, h: 44, label: e.label, onPress: () => { sfx('menuConfirm'); this.time.delayedCall(260, () => { if (!isLeaving(this)) e.run(); }); } });
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
      const goBattle = () => showScene(this, 'CampaignBattle', { chapterIndex: index, save: this.save, seed: (Date.now() & 0xfffff) || 1 });
      const intro = () => this.playStory(chapter, chapter.intro, goBattle, true);
      if (index === 0 && !save.prologueSeen) {
        this.save = { ...save, prologueSeen: true };
        writeSave(this.save);
        this.playStory({ ...PROLOGUE, objective: null, enemies: [] }, PROLOGUE.lines, intro, false);
      } else intro();
    }, { hud: true });
  }

  // --------------------------------------------------------------- story
  enemyIdsFor(chapter) {
    const ids = new Set(chapter.enemies.map((e) => e.id));
    for (const ev of chapter.events || []) for (const sp of ev.spawn || []) if ((sp.team || 'enemy') === 'enemy') ids.add(sp.id);
    return [...ids];
  }

  /** A conversation over a chapter title card. onDone runs after it ends or is skipped. */
  playStory(chapter, lines, onDone, titleCard = false) {
    this.clearStage();
    this.add2(this.add.text(W / 2, 30, chapter.kicker, textStyle('kicker')).setOrigin(0.5, 0).setDepth(6));
    this.add2(this.add.text(W / 2, 50, chapter.title, textStyle('h1')).setOrigin(0.5, 0).setDepth(6));
    if (titleCard && chapter.objective) this.add2(this.add.text(W / 2, 98, `OBJECTIVE: ${chapter.objective.toUpperCase()}`, textStyle('label', { color: THEME.goldCss })).setOrigin(0.5, 0).setDepth(6));
    // a strip of this chapter's ground behind the figures
    const ground = ['plain', 'road', 'floor'].find((t) => this.textures.exists(tileKey(t)));
    if (ground) {
      const y0 = 470;
      for (let x = 0; x < W; x += 128) for (let y = y0; y < H; y += 128) this.add2(this.add.image(x + 64, y + 64, tileKey(ground)).setDisplaySize(128, 128).setAlpha(0.28).setDepth(2));
    }
    this.playing = true;
    playDialogue(this, { lines, enemyIds: this.enemyIdsFor(chapter), speed: this.speed || 1, tag: titleCard ? 'BEFORE THE BATTLE' : null }).then(() => {
      this.playing = false;
      if (!isLeaving(this)) onDone();
    });
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
    this.add2(drawPanel(this, px, py, pw, won ? 310 : 130, 18, won ? THEME.gold : THEME.pink).setDepth(5));
    const lines = [];
    if (won) {
      lines.push(`Turns taken: ${turns}`);
      lines.push(`Survivors: ${survivors.map((r) => CHARACTERS[r.id].name).join(', ')}`);
      lines.push(`Fallen: ${fallen.length ? fallen.map((n) => n).join(', ') : 'none'}`);
      const topLv = new Map();
      for (const l of levelUps) topLv.set(l.name, Math.max(topLv.get(l.name) || 0, l.level));
      lines.push(`Level-ups: ${topLv.size ? [...topLv].map(([n, lv]) => `${n} → Lv ${lv}`).join(', ') : 'none'}`);
      lines.push('Everyone is healed between chapters. Fallen fighters stay down.');
    } else {
      lines.push(after.reason === 'lord' ? 'Hydra has fallen.' : 'The whole party has fallen.');
      lines.push('Retry the chapter with the party you started it with.');
    }
    let ly = py + 30;
    lines.forEach((t) => {
      const tx = this.add2(this.add.text(px + 36, ly, t, textStyle('body', { fontSize: '17px', wordWrap: { width: pw - 72 }, lineSpacing: 4 })).setDepth(6));
      ly += tx.height + 14;
    });
    const entries = [];
    const finished = won && chapterIndex + 1 >= CHAPTERS.length;
    if (won && !finished) entries.push({ label: `Next: Chapter ${chapterIndex + 2}`, run: () => this.beginChapter(chapterIndex + 1, this.save) });
    if (!won) entries.push({ label: 'Retry Chapter', run: () => this.beginChapter(chapterIndex, this.save || loadSave() || newCampaign()) });
    if (finished) this.add2(this.add.text(W / 2, 470, 'THE STATIC FADES. CAMPAIGN COMPLETE.', textStyle('h2', { color: THEME.goldCss })).setOrigin(0.5).setDepth(6));
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
