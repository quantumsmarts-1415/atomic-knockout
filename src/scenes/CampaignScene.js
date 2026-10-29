import * as Phaser from 'phaser';
import { GAME_WIDTH as W, GAME_HEIGHT as H } from '../main.js';
import { play as sfx } from '../engine/sfx.js';
import {
  FONT_DISPLAY, THEME, drawFooterHints, drawMenuBackground, drawPanel, drawPortraitDisc, makeButton, textStyle,
} from '../ui/theme.js';
import { enterScene, isLeaving, showScene } from '../ui/flow.js';
import { CHARACTERS } from '../data/characters.js';
import { faceFrame, menuPortraitKey } from '../ui/portraits.js';
import { CHAPTERS, PROLOGUE, supportsFor, afterVictory, chapterSpeakers, loadSave, newCampaign, partyForChapter, writeSave, clearSave } from '../campaign/index.js';
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
    this.header('TACTICS', 'CHAPTER SELECT');
    const save = this.save;
    const progress = save ? save.chapter : 0;
    const px = 250;
    const py = 112;
    const pw = W - 500;
    const rowH = 36;
    this.add2(drawPanel(this, px, py, pw, 50 + CHAPTERS.length * rowH, 18).setDepth(5));
    const cleared = save?.cleared?.length || 0;
    this.add2(this.add.text(px + 28, py + 16, `CHAPTERS  ·  ${cleared} / ${CHAPTERS.length} CLEARED`, textStyle('kicker')).setDepth(6));
    this.items = [];
    CHAPTERS.forEach((ch, i) => {
      const y = py + 42 + i * rowH;
      const isCleared = save?.cleared?.includes(ch.id);
      const current = i === progress && progress < CHAPTERS.length;
      const locked = i > progress;
      const col = isCleared ? THEME.goldCss : locked ? THEME.disabledCss : THEME.mistCss;
      const hl = this.add.graphics().setDepth(5.5).setVisible(false);
      hl.fillStyle(THEME.teal, 0.14); hl.fillRoundedRect(px + 12, y - 2, pw - 24, rowH - 2, 8);
      hl.lineStyle(1.5, THEME.teal, 0.9); hl.strokeRoundedRect(px + 12, y - 2, pw - 24, rowH - 2, 8);
      this.add2(hl);
      this.add2(this.add.text(px + 30, y + 4, `${i + 1}`, textStyle('label', { color: locked ? THEME.disabledCss : THEME.tealCss, fontSize: '16px' })).setDepth(6));
      this.add2(this.add.text(px + 62, y - 1, locked ? '???' : ch.title, textStyle('h3', { color: col })).setDepth(6));
      this.add2(this.add.text(px + 62, y + 17, (locked ? 'LOCKED  ·  CLEAR CHAPTER ' + i + ' TO OPEN' : ch.objective.toUpperCase()), textStyle('label', { color: locked ? THEME.disabledCss : THEME.dimCss, fontSize: '10px' })).setDepth(6));
      const tag = isCleared ? (current ? 'CLEARED  ·  REPLAY' : 'CLEARED  ·  REPLAY') : current ? 'NEXT  ▸' : locked ? '🔒' : '';
      this.add2(this.add.text(px + pw - 28, y + 8, tag === '🔒' ? 'LOCKED' : tag, textStyle('label', { color: col })).setOrigin(1, 0).setDepth(6));
      if (locked) return;
      const zone = this.add.zone(px + pw / 2, y + rowH / 2 - 1, pw - 24, rowH - 2).setDepth(7).setInteractive({ useHandCursor: true });
      this.stage.push(zone);
      const item = {
        kind: 'row',
        setSelected: (on) => hl.setVisible(on),
        press: () => this.pickChapter(i),
      };
      zone.on('pointerover', () => this.selectBtn(this.items.indexOf(item)));
      zone.on('pointerdown', () => item.press());
      this.items.push(item);
    });
    const rowCount = this.items.length;
    const newSupports = supportsFor(save).filter((s) => !(save?.seenSupports || []).includes(s.id)).length;
    const entries = [];
    if (save && supportsFor(save).length) entries.push({ label: `Camp Conversations${newSupports ? ` (${newSupports} new)` : ''}`, run: () => this.showCamp() });
    entries.push({ label: save ? 'New Campaign (erase save)' : 'New Campaign', run: () => { clearSave(); this.save = newCampaign(); writeSave(this.save); this.beginChapter(0, this.save); } });
    entries.push({ label: 'Back', run: () => this.backHome() });
    const by = py + 50 + CHAPTERS.length * rowH + 12;
    entries.forEach((e, i) => {
      const b = makeButton(this, { x: W / 2 - 190, y: by + i * 46, w: 380, h: 40, label: e.label, onPress: () => { sfx('menuConfirm'); this.time.delayedCall(260, () => { if (!isLeaving(this)) e.run(); }); } });
      b.onHover = () => this.selectBtn(rowCount + i);
      this.stage.push(b.container, b.zone);
      this.items.push(b);
    });
    this.buttons = this.items;
    this.sel = Math.min(progress, rowCount - 1);
    this.items[this.sel].setSelected(true);
    this.add2(this.footerHints([{ keys: ['W', 'S'], label: 'Choose' }, { key: 'ENTER', label: 'Select' }, { key: 'ESC', label: 'Back' }]));
    this.onKey(['UP', 'W'], () => this.moveBtn(-1));
    this.onKey(['DOWN', 'S'], () => this.moveBtn(1));
    this.onKey(['ENTER', 'SPACE', 'F', 'K'], () => this.items[this.sel].press());
    this.onKey(['ESC', 'BACKSPACE'], () => this.backHome());
  }

  /** The next chapter plays for real; a cleared one is a replay that leaves the save alone. */
  pickChapter(i) {
    sfx('menuConfirm');
    const save = this.save || newCampaign();
    this.time.delayedCall(260, () => { if (!isLeaving(this)) this.beginChapter(i, save); });
  }

  // ---------------------------------------------------------------- camp
  /** Base conversations between chapters: short talks between party members. */
  showCamp() {
    this.clearStage();
    this.header('BASE CAMP', 'CAMP CONVERSATIONS');
    const save = this.save;
    const list = supportsFor(save);
    const seen = new Set(save?.seenSupports || []);
    const px = 250;
    const py = 120;
    const pw = W - 500;
    const rowH = 44;
    this.add2(drawPanel(this, px, py, pw, 28 + list.length * rowH + 14, 18).setDepth(5));
    this.items = [];
    list.forEach((sp, i) => {
      const y = py + 20 + i * rowH;
      const hl = this.add.graphics().setDepth(5.5).setVisible(false);
      hl.fillStyle(THEME.teal, 0.14); hl.fillRoundedRect(px + 12, y - 2, pw - 24, rowH - 2, 8);
      hl.lineStyle(1.5, THEME.teal, 0.9); hl.strokeRoundedRect(px + 12, y - 2, pw - 24, rowH - 2, 8);
      this.add2(hl);
      const names = sp.pair.map((id) => CHARACTERS[id]?.name || id).join('  &  ');
      this.add2(this.add.text(px + 32, y, sp.title, textStyle('h3', { color: seen.has(sp.id) ? THEME.mistCss : THEME.goldCss })).setDepth(6));
      this.add2(this.add.text(px + 32, y + 20, names.toUpperCase(), textStyle('label', { color: THEME.dimCss, fontSize: '10px' })).setDepth(6));
      this.add2(this.add.text(px + pw - 28, y + 12, seen.has(sp.id) ? 'SEEN' : 'NEW', textStyle('label', { color: seen.has(sp.id) ? THEME.dimCss : THEME.tealCss })).setOrigin(1, 0).setDepth(6));
      const zone = this.add.zone(px + pw / 2, y + rowH / 2 - 1, pw - 24, rowH - 2).setDepth(7).setInteractive({ useHandCursor: true });
      this.stage.push(zone);
      const item = { setSelected: (on) => hl.setVisible(on), press: () => this.playSupport(sp) };
      zone.on('pointerover', () => this.selectBtn(this.items.indexOf(item)));
      zone.on('pointerdown', () => item.press());
      this.items.push(item);
    });
    const rowCount = this.items.length;
    const back = makeButton(this, { x: W / 2 - 190, y: py + 28 + list.length * rowH + 30, w: 380, h: 40, label: 'Back to Chapters', onPress: () => { sfx('menuConfirm'); this.time.delayedCall(200, () => this.showMenu()); } });
    back.onHover = () => this.selectBtn(rowCount);
    this.stage.push(back.container, back.zone);
    this.items.push(back);
    this.buttons = this.items;
    const firstNew = list.findIndex((sp) => !seen.has(sp.id));
    this.sel = firstNew >= 0 ? firstNew : 0;
    this.items[this.sel].setSelected(true);
    this.add2(this.footerHints([{ keys: ['W', 'S'], label: 'Choose' }, { key: 'ENTER', label: 'Listen' }, { key: 'ESC', label: 'Back' }]));
    this.onKey(['UP', 'W'], () => this.moveBtn(-1));
    this.onKey(['DOWN', 'S'], () => this.moveBtn(1));
    this.onKey(['ENTER', 'SPACE', 'F', 'K'], () => this.items[this.sel].press());
    this.onKey(['ESC', 'BACKSPACE'], () => this.showMenu());
  }

  playSupport(sp) {
    if (this.busy) return;
    this.busy = true;
    sfx('menuConfirm');
    const ids = sp.pair.concat(sp.lines.map((l) => l.who).filter(Boolean));
    loadCampaignArt(this, ids, 'idle', () => {
      this.busy = false;
      const done = () => {
        const seen = new Set(this.save?.seenSupports || []);
        seen.add(sp.id);
        this.save = { ...this.save, seenSupports: [...seen] };
        writeSave(this.save);
        this.showCamp();
      };
      this.playStory({ kicker: 'CAMP CONVERSATION', title: sp.title, objective: null, enemies: [] }, sp.lines, done, false);
    }, { hud: true });
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
      // a replay of a cleared chapter is practice: the save keeps its progress
      const practice = chapterIndex < save.chapter;
      if (!practice) {
        save = afterVictory(save, chapterIndex, survivors);
        this.save = save;
        writeSave(save);
      }
      this.playStory(chapter, chapter.outro || [], () => this.showSummary({ ...after, practice }, true));
    } else {
      this.showSummary(after, false);
    }
  }

  showSummary(after, won) {
    this.clearStage();
    const { chapterIndex, survivors, fallen, turns, levelUps } = after;
    const chapter = CHAPTERS[chapterIndex];
    this.header(won ? (after.practice ? 'REPLAY CLEAR' : 'CHAPTER CLEAR') : 'DEFEAT', chapter.title);
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
      lines.push(after.practice ? 'Practice run: your saved campaign is unchanged.' : 'Everyone is healed between chapters. Fallen fighters stay down.');
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
    const finished = won && !after.practice && chapterIndex + 1 >= CHAPTERS.length;
    if (won && !finished && !after.practice) entries.push({ label: `Next: Chapter ${chapterIndex + 2}`, run: () => this.beginChapter(chapterIndex + 1, this.save) });
    if (!won) entries.push({ label: 'Retry Chapter', run: () => this.beginChapter(chapterIndex, this.save || loadSave() || newCampaign()) });
    if (finished) this.add2(this.add.text(W / 2, 476, 'THE STATIC FADES. CAMPAIGN COMPLETE.', textStyle('h2', { color: THEME.goldCss })).setOrigin(0.5).setDepth(6));
    const newTalks = supportsFor(this.save).filter((sp) => !(this.save?.seenSupports || []).includes(sp.id)).length;
    if (won && newTalks) entries.push({ label: `Camp Conversations (${newTalks} new)`, run: () => this.showCamp() });
    entries.push({ label: 'Chapter Select', run: () => this.showMenu() });
    entries.push({ label: 'Return Home', run: () => this.backHome() });
    this.buttons = entries.map((e, i) => {
      const b = makeButton(this, { x: W / 2 - 190, y: (won ? (finished ? 508 : 478) : 310) + i * 52, w: 380, h: 44, label: e.label, onPress: () => { sfx('menuConfirm'); this.time.delayedCall(260, () => { if (!isLeaving(this)) e.run(); }); } });
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
