// Code-driven move effects. Body clips stay on idle/walk unless a real
// attack sheet exists; these read the move from across the stage.
import { canonicalType } from '../data/balance.js';

export const TYPE_COLORS = {
  kinetic: 0xffe7b0,
  heat: 0xff5a1f,
  electrical: 0x6ecbff,
  chemical: 0xc6f25a,
  radiation: 0x7dffc0,
};

function colorOf(move) {
  return move?.vfxColor ?? TYPE_COLORS[canonicalType(move?.type)] ?? 0xfff4e0;
}

function die(scene, obj, ms = 280) {
  if (!obj || !scene?.tweens) return;
  scene.tweens.add({
    targets: obj, alpha: 0, scale: (obj.scale ?? 1) * 1.35, duration: ms,
    onComplete: () => obj.destroy?.(),
  });
}

function ring(scene, x, y, color, radius, width = 4) {
  if (!scene.add?.graphics) return null;
  const g = scene.add.graphics();
  g.lineStyle?.(width, color, 0.95);
  g.strokeCircle?.(0, 0, 12);
  g.setPosition?.(x, y);
  if (!scene.tweens) { g.destroy?.(); return g; }
  scene.tweens.add({
    targets: g, scale: Math.max(1.2, radius / 12), alpha: 0, duration: 320,
    onComplete: () => g.destroy(),
  });
  return g;
}

function burst(scene, x, y, color, n = 10, speed = 140) {
  if (!scene.add?.circle) return;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    const dot = scene.add.circle(x, y, 3 + (i % 3), color, 0.9);
    scene.tweens?.add({
      targets: dot,
      x: x + Math.cos(a) * speed,
      y: y + Math.sin(a) * speed * 0.75,
      alpha: 0,
      duration: 260 + (i % 4) * 40,
      onComplete: () => dot.destroy(),
    });
  }
}

function gather(scene, x, y, color) {
  const core = scene.add.circle?.(x, y, 8, color, 0.55);
  if (core) die(scene, core, 180);
  ring(scene, x, y, color, 36, 2);
}

function beam(scene, fighter, color, length) {
  if (!scene.add?.rectangle) return;
  const dir = fighter.facing || 1;
  const w = Math.max(40, length);
  const rect = scene.add.rectangle(
    fighter.x + dir * w / 2,
    fighter.y - (fighter.bodyH ?? 80) * 0.62,
    w, 14, color, 0.85,
  );
  rect.setBlendMode?.('ADD');
  die(scene, rect, 220);
  burst(scene, fighter.x + dir * w, fighter.y - (fighter.bodyH ?? 80) * 0.62, color, 6, 40);
}

function column(scene, x, y, color, h = 110) {
  if (!scene.add?.rectangle) return;
  const rect = scene.add.rectangle(x, y - h / 2, 18, h, color, 0.8);
  die(scene, rect, 360);
  burst(scene, x, y - h, 0xfff1c9, 5, 30);
}

function mushroom(scene, x, y, color) {
  const cap = scene.add.circle?.(x, y - 36, 28, color, 0.75);
  const stem = scene.add.rectangle?.(x, y - 8, 16, 40, 0xfff6e8, 0.8);
  if (cap) die(scene, cap, 420);
  if (stem) die(scene, stem, 420);
  ring(scene, x, y, color, 70, 5);
}

function shieldBubble(scene, fighter, color) {
  const y = fighter.y - (fighter.bodyH ?? 80) * 0.5;
  const c = scene.add.circle?.(fighter.x, y, (fighter.bodyW ?? 40) * 0.95, color, 0.18);
  if (!c) return;
  c.setStrokeStyle?.(3, 0xffffff, 0.8);
  die(scene, c, 500);
}

export function playVfx(scene, fighter, move, phase = 'release', extra = {}) {
  if (!scene?.add || !fighter) return;
  const color = extra.color ?? colorOf(move);
  const x = extra.x ?? fighter.x;
  const y = extra.y ?? fighter.y - (fighter.bodyH ?? 80) * 0.55;
  const style = move?.vfx ?? move?.kind ?? 'strike';

  if (phase === 'charge') {
    gather(scene, x, y - 10, color);
    return;
  }
  if (phase === 'fizzle') {
    burst(scene, x, y, 0x99aabb, 4, 20);
    return;
  }
  if (phase === 'defense') {
    if (style === 'wall' || style === 'cement') {
      const dir = fighter.facing || 1;
      column(scene, fighter.x + dir * ((fighter.bodyW ?? 40) / 2 + 16), fighter.y, color, 120);
      return;
    }
    if (style === 'bubble' || style === 'shield') {
      shieldBubble(scene, fighter, color);
      return;
    }
    ring(scene, x, fighter.y - (fighter.bodyH ?? 80) * 0.5, color, 48, 3);
    return;
  }
  if (phase === 'hit') {
    burst(scene, x, y, color, 8, 70);
    return;
  }

  switch (style) {
    case 'supernova':
      ring(scene, x, y, 0xfff6d8, move.radius ?? 90, 8);
      ring(scene, x, y, color, (move.radius ?? 90) * 0.62, 5);
      burst(scene, x, y, 0xfff6d8, 16, 180);
      scene.cameras?.main?.shake(160, 0.01);
      break;
    case 'mushroom':
      mushroom(scene, x, y, color);
      burst(scene, x, y, color, 12, 90);
      break;
    case 'balloon':
      shieldBubble(scene, { x, y: y + 20, bodyH: 40, bodyW: move.projectileRadius ?? 20 }, 0xbfefff);
      break;
    case 'gust':
      for (let i = 0; i < 4; i++) {
        const streak = scene.add.rectangle?.(x + (fighter.facing || 1) * (20 + i * 18), y, 28, 3, 0xd7f4ff, 0.7);
        if (streak) die(scene, streak, 200);
      }
      break;
    case 'laser':
    case 'beam':
      beam(scene, fighter, color, (move.beamLen ?? 180) * (move._beamScale ?? 1));
      break;
    case 'dash':
    case 'fire':
      burst(scene, x, y, color, 12, 110);
      ring(scene, x, y, color, 40, 3);
      break;
    case 'ice':
      burst(scene, x, y, 0xbff6ff, 8, 60);
      ring(scene, x, y, 0xe8fbff, 50, 3);
      break;
    case 'acid':
    case 'cloud':
      for (let i = 0; i < 6; i++) {
        const puff = scene.add.circle?.(x + (i - 2.5) * 14, y + 10, 12 + (i % 3) * 4, color, 0.35);
        if (puff) die(scene, puff, 500);
      }
      break;
    case 'spark':
      burst(scene, x, y, color, 14, 100);
      break;
    case 'wall':
      column(scene, x, fighter.y, color, 130);
      break;
    default:
      if (move?.kind === 'burst' || move?.kind === 'dive') {
        ring(scene, x, y, color, move.radius ?? 70, 5);
        burst(scene, x, y, color, 10, 120);
      } else if (move?.kind === 'projectile') {
        burst(scene, x, y, color, 6, 40);
      } else {
        burst(scene, x + (fighter.facing || 1) * 24, y, color, 7, 50);
      }
  }
}

export function projectileStyle(move) {
  return {
    fill: colorOf(move),
    radius: move.projectileRadius ?? 12,
    shape: move.vfx === 'balloon' ? 'balloon' : move.vfx === 'gust' ? 'wave' : 'orb',
  };
}
