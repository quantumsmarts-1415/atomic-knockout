// ---------------------------------------------------------------------------
// Match cards: the warm-up card before a round, the GO! hand-off, and the
// GAME banner at the end. Same type, palette, and motion as the menus. All
// objects are built through scene.asUi when the scene has one, so camera
// stages draw them in screen space.
// ---------------------------------------------------------------------------
import { FONT_DISPLAY, FONT_MONO, MOTION, PLAYER_COLORS, PLAYER_COLORS_CSS, THEME } from './theme.js';

const DEPTH = 1000; // above the stage, fighters and HUD
const ui = (scene, fn) => (scene.asUi ? scene.asUi(fn) : fn());

/**
 * Warm-up card: arena name, the lineup, the stock rule. Returns the display
 * objects and the subset that fades on the way out; the caller owns timing.
 */
export function buildMatchCard(scene, { stageName, fighters = [], stocks }) {
  return ui(scene, () => {
    const { width: W, height: H } = scene.scale;
    const objs = [];
    const add = (o) => { objs.push(o); return o; };
    const cy = H / 2 - 10;

    const veil = add(scene.add.rectangle(W / 2, H / 2, W, H, THEME.void, 0.92).setDepth(DEPTH));
    const g = add(scene.add.graphics().setDepth(DEPTH + 1));
    g.lineStyle(1, THEME.mist, 0.2);
    g.lineBetween(W / 2 - 260, cy - 86, W / 2 - 12, cy - 86);
    g.lineBetween(W / 2 + 12, cy - 86, W / 2 + 260, cy - 86);
    g.fillStyle(THEME.gold, 1);
    g.fillCircle(W / 2, cy - 86, 2.5);
    g.lineStyle(1, THEME.mist, 0.2);
    g.lineBetween(W / 2 - 260, cy + 14, W / 2 + 260, cy + 14);
    g.fillStyle(THEME.gold, 0.06);
    g.fillCircle(W / 2, cy - 20, 170);

    const kicker = add(scene.add.text(W / 2, cy - 66, 'ARENA', {
      fontFamily: FONT_MONO, fontSize: '12px', color: THEME.tealCss, letterSpacing: 5,
    }).setOrigin(0.5).setDepth(DEPTH + 2));
    const title = add(scene.add.text(W / 2, cy - 28, String(stageName || 'READY').toUpperCase(), {
      fontFamily: FONT_DISPLAY, fontSize: '44px', color: THEME.mistCss, letterSpacing: 3,
      shadow: { offsetX: 0, offsetY: 0, color: '#F0C14A', blur: 18, fill: true },
    }).setOrigin(0.5).setDepth(DEPTH + 2));

    // lineup: colored seat dot + name, VS between for small matches
    const items = fighters.map((f, i) => ({
      name: String(f?.charDef?.name ?? f?.name ?? '?').toUpperCase() + (f?.isBot ? ' · CPU' : ''),
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      css: PLAYER_COLORS_CSS[i % PLAYER_COLORS_CSS.length],
    }));
    const texts = items.map((it) => add(scene.add.text(0, 0, it.name, {
      fontFamily: FONT_DISPLAY, fontSize: fighters.length > 3 ? '15px' : '20px', color: THEME.mistCss, letterSpacing: 1,
    }).setOrigin(0, 0.5).setDepth(DEPTH + 2)));
    const vsGap = fighters.length <= 4 ? 54 : 30;
    const total = texts.reduce((s, t) => s + 18 + t.width, 0) + vsGap * Math.max(0, texts.length - 1);
    let x = W / 2 - total / 2;
    const lineY = cy + 46;
    const dots = add(scene.add.graphics().setDepth(DEPTH + 2));
    texts.forEach((t, i) => {
      dots.fillStyle(items[i].color, 1);
      dots.fillCircle(x + 5, lineY, 5);
      t.setPosition(x + 18, lineY);
      x += 18 + t.width;
      if (i < texts.length - 1) {
        if (fighters.length <= 4) {
          add(scene.add.text(x + vsGap / 2, lineY, 'VS', {
            fontFamily: FONT_MONO, fontSize: '12px', color: THEME.dimCss, letterSpacing: 2,
          }).setOrigin(0.5).setDepth(DEPTH + 2));
        }
        x += vsGap;
      }
    });

    const rule = stocks ? `${stocks} STOCK${stocks === 1 ? '' : 'S'}  ·  LAST ONE STANDING` : 'LAST ONE STANDING';
    const foot = add(scene.add.text(W / 2, cy + 92, rule, {
      fontFamily: FONT_MONO, fontSize: '12px', color: THEME.goldCss, letterSpacing: 3,
    }).setOrigin(0.5).setDepth(DEPTH + 2));

    // entrance: veil snaps, the type settles in from a few pixels below
    const rows = [[kicker], [title], [dots, ...texts, ...objs.filter((o) => o.text === 'VS')], [foot]];
    rows.forEach((row, i) => {
      for (const o of row) {
        o.setAlpha(0);
        scene.tweens.add({ targets: o, alpha: 1, y: o.y, duration: MOTION.slow, delay: 60 + i * 55, ease: MOTION.easeOut });
        o.y += 12;
      }
    });
    g.setAlpha(0);
    scene.tweens.add({ targets: g, alpha: 1, duration: MOTION.slow, delay: 40 });
    veil.setAlpha(0);
    scene.tweens.add({ targets: veil, alpha: 0.92, duration: MOTION.quick });

    return { objs, fadeTargets: objs };
  });
}

/** GO!: a light band sweeps through the middle while the word pops. */
export function showGo(scene) {
  ui(scene, () => {
    const { width: W, height: H } = scene.scale;
    const cy = H / 2 - 30;
    const band = scene.add.rectangle(W / 2, cy, W, 120, THEME.void, 0.55).setDepth(DEPTH + 9).setScale(1, 0.1);
    const flare = scene.add.rectangle(W / 2, cy, W, 3, THEME.teal, 0.9).setDepth(DEPTH + 9).setScale(0, 1);
    const t = scene.add.text(W / 2, cy, 'GO!', {
      fontFamily: FONT_DISPLAY, fontSize: '120px', color: THEME.goldCss,
      stroke: THEME.voidCss, strokeThickness: 12,
    }).setOrigin(0.5).setDepth(DEPTH + 10).setScale(1.7).setAlpha(0);
    scene.tweens.add({ targets: band, scaleY: 1, duration: MOTION.base, ease: MOTION.easeOut });
    scene.tweens.add({ targets: flare, scaleX: 1, duration: MOTION.base, ease: MOTION.easeOut });
    scene.tweens.add({ targets: flare, y: cy + 62, alpha: 0, delay: MOTION.base, duration: MOTION.slow, ease: MOTION.easeIn });
    scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 200, ease: MOTION.pop });
    scene.tweens.add({
      targets: [t, band], alpha: 0, delay: 650, duration: 300,
      onComplete: () => { t.destroy(); band.destroy(); flare.destroy(); },
    });
    scene.tweens.add({ targets: t, scale: 1.15, delay: 650, duration: 300 });
  });
}

/**
 * GAME banner: a dark band crosses the screen, GAME lands in gold, and the
 * winner's name follows in their seat color. Objects are left on screen;
 * the scene changes underneath them.
 */
export function showGameBanner(scene, { winnerName = null, seat = 0 } = {}) {
  return ui(scene, () => {
    const { width: W, height: H } = scene.scale;
    const cy = H / 2 - 40;
    const band = scene.add.rectangle(-W / 2, cy, W, 170, THEME.void, 0.78).setDepth(DEPTH + 9);
    const edgeTop = scene.add.rectangle(-W / 2, cy - 85, W, 2, THEME.gold, 0.8).setDepth(DEPTH + 9);
    const edgeBot = scene.add.rectangle(W * 1.5, cy + 85, W, 2, THEME.gold, 0.8).setDepth(DEPTH + 9);
    const word = scene.add.text(W / 2, cy - 12, 'GAME', {
      fontFamily: FONT_DISPLAY, fontSize: '96px', color: THEME.goldCss, letterSpacing: 6,
      stroke: THEME.voidCss, strokeThickness: 10,
    }).setOrigin(0.5).setDepth(DEPTH + 10).setScale(0.2).setAlpha(0);
    const sub = winnerName ? scene.add.text(W / 2, cy + 58, `${String(winnerName).toUpperCase()} WINS`, {
      fontFamily: FONT_DISPLAY, fontSize: '22px', color: PLAYER_COLORS_CSS[seat % PLAYER_COLORS_CSS.length], letterSpacing: 3,
      stroke: THEME.voidCss, strokeThickness: 6,
    }).setOrigin(0.5).setDepth(DEPTH + 10).setAlpha(0) : null;
    scene.tweens.add({ targets: [band, edgeTop], x: W / 2, duration: MOTION.slow, ease: MOTION.easeOut });
    scene.tweens.add({ targets: edgeBot, x: W / 2, duration: MOTION.slow, ease: MOTION.easeOut });
    scene.tweens.add({ targets: word, scale: 1, alpha: 1, duration: 320, delay: 120, ease: MOTION.pop });
    if (sub) scene.tweens.add({ targets: sub, alpha: 1, y: sub.y - 6, duration: MOTION.slow, delay: 420, ease: MOTION.easeOut });
    return { band, word, sub };
  });
}
