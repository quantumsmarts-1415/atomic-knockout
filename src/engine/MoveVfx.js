// Code-driven move effects. Body clips stay on idle/walk unless a real
// attack sheet exists; these read the move from across the stage.
import { canonicalType } from '../data/balance.js';
import { artFor, drawFxOneShot, fxAnchor, fxGameplayScale, meleeContactPoint, spawnFxDetonate, wantsContactSpark } from './fxArt.js';
import { coatSpec } from './coat.js';

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

function sparkle(scene, x, y, color, n) {
  if (!scene.juice?.sparkle) return false;
  scene.juice.sparkle(x, y, color, n);
  return true;
}

function ring(scene, x, y, color, radius, width = 4) {
  if (sparkle(scene, x, y, color, Math.max(4, Math.round((radius || 40) / 18)))) return null;
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
  if (sparkle(scene, x, y, color, Math.min(8, n))) return;
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
  if (sparkle(scene, x, y, color, 5)) return;
  const core = scene.add.circle?.(x, y, 8, color, 0.55);
  if (core) die(scene, core, 180);
  ring(scene, x, y, color, 36, 2);
}

function beam(scene, fighter, color, length, move) {
  if (!scene.add?.rectangle) return;
  const dir = fighter.facing || 1;
  const w = Math.max(40, length);
  const y = fighter.y - (fighter.bodyH ?? 80) * 0.62;
  const x = fighter.x + dir * w / 2;
  if (move?.tubeCharge) {
    const frac = move._chargeFrac ?? 0;
    const halo = scene.add.rectangle(x, y, w, 18 + frac * 10, color, 0.22 + frac * 0.28);
    halo.setBlendMode?.('ADD');
    die(scene, halo, 240);
    const core = scene.add.rectangle(x, y, w, 4, 0xfff6e8, 0.65 + frac * 0.3);
    core.setBlendMode?.('ADD');
    die(scene, core, 200);
  }
  const rect = scene.add.rectangle(x, y, w, 14, color, 0.85);
  rect.setBlendMode?.('ADD');
  die(scene, rect, 220);
  burst(scene, fighter.x + dir * w, y, 0xfff6e8, 6, 40);
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

function supernovaBlast(scene, x, y, radius, color) {
  const r = Math.max(18, radius || 64);
  const disc = scene.add.circle?.(x, y, r, 0xfff6d8, 0.38);
  if (disc) {
    disc.setBlendMode?.('ADD');
    disc.setDepth?.(15);
    die(scene, disc, 280);
  }
  const core = scene.add.circle?.(x, y, r * 0.42, color, 0.62);
  if (core) {
    core.setBlendMode?.('ADD');
    core.setDepth?.(16);
    die(scene, core, 200);
  }
  const edge = scene.add.circle?.(x, y, Math.max(10, r * 0.28), 0xfff6d8, 0);
  if (!edge) return;
  edge.setStrokeStyle?.(Math.max(4, r * 0.045), 0xfff1c9, 0.95);
  edge.setBlendMode?.('ADD');
  edge.setDepth?.(16);
  const end = r / Math.max(10, r * 0.28);
  if (!scene.tweens) { edge.destroy?.(); return; }
  scene.tweens.add({
    targets: edge, scale: end, alpha: 0, duration: 320,
    onComplete: () => edge.destroy(),
  });
}

const chargeGlows = new WeakMap();

/** A glow that grows with hold time, so a charge reads before it fires. */
export function syncChargeGlow(scene) {
  if (!scene?.fighters || scene.simFast || !scene.add?.graphics) return;
  for (const fighter of scene.fighters) {
    let glow = chargeGlows.get(fighter);
    const move = fighter.charDef?.moves?.basicCharge;
    const charging = fighter.state === 'charging' && fighter.chargeStart != null && move;
    if (!charging) {
      if (glow) {
        glow.destroy?.();
        chargeGlows.delete(fighter);
      }
      continue;
    }
    if (!glow?.scene) {
      glow = scene.add.graphics().setDepth(6);
      glow.setBlendMode?.('ADD');
      chargeGlows.set(fighter, glow);
    }
    const max = move.maxChargeMs || 1;
    const frac = Math.max(0, Math.min(1, ((scene.simNow ?? 0) - fighter.chargeStart) / max));
    const tubeArt = move.tubeCharge ? artFor(fighter.charDef?.id, move.name) : null;
    if (move.tubeCharge && (tubeArt?.frames?.length || tubeArt?.charge?.frames?.length)) {
      glow.clear();
      continue;
    }
    if (move.tubeCharge) {
      const len = (move.beamLen ?? 150) * (1 + ((move.chargeLengthMult ?? 1) - 1) * frac);
      const dir = fighter.facing || 1;
      const bodyH = fighter.bodyH ?? 80;
      const y = fighter.y - bodyH * 0.62;
      const x0 = fighter.x + dir * (fighter.bodyW ?? 40) * 0.35;
      glow.clear();
      glow.lineStyle(16, 0xff5a2a, 0.16 + frac * 0.3);
      glow.lineBetween(x0, y, x0 + dir * len, y);
      glow.lineStyle(5, 0xfff6e8, 0.35 + frac * 0.6);
      glow.lineBetween(x0, y, x0 + dir * len, y);
      glow.fillStyle(0xff5a2a, 0.08 + frac * 0.28);
      glow.fillCircle(fighter.x, fighter.y - bodyH * 0.5, 14 + frac * 20);
      glow.fillStyle(0xfff6e8, 0.2 + frac * 0.5);
      glow.fillCircle(fighter.x, fighter.y - bodyH * 0.55, 7 + frac * 7);
      continue;
    }
    const painted = artFor(fighter.charDef?.id, move.name);
    const minR = painted?.reach > 0 ? painted.reach : (move.radius ?? 48);
    const reach = minR * (1 + ((move.chargeRadiusMult ?? 1) - 1) * frac);
    const y = fighter.y - (fighter.bodyH ?? 80) * 0.55;
    glow.clear();
    glow.fillStyle(0xff5a1f, 0.12 + frac * 0.18);
    glow.fillCircle(fighter.x, y, reach * 0.72);
    glow.fillStyle(0xfff6d8, 0.2 + frac * 0.38);
    glow.fillCircle(fighter.x, y, Math.max(12, reach * 0.26));
    glow.lineStyle(3, 0xfff6d8, 0.28 + frac * 0.5);
    glow.strokeCircle(fighter.x, y, reach);
  }
}

function shieldBubble(scene, fighter, color) {
  const y = fighter.y - (fighter.bodyH ?? 80) * 0.5;
  const c = scene.add.circle?.(fighter.x, y, (fighter.bodyW ?? 40) * 0.95, color, 0.18);
  if (!c) return;
  c.setStrokeStyle?.(2, color, 0.65);
  die(scene, c, 500);
}

export function playVfx(scene, fighter, move, phase = 'release', extra = {}) {
  if (!scene?.add || !fighter || scene.simFast) return;
  if (coatSpec(move) && (phase === 'defense' || phase === 'letgo')) return;
  if (phase === 'letgo') {
    const art = artFor(fighter.charDef?.id, move?.name);
    if (!art?.releaseFlash || !art.frames?.length) return;
    const y = fighter.y - (fighter.bodyH ?? 80) * 0.5;
    drawFxOneShot(scene, fighter, move, fighter.x, y, 1);
    return;
  }
  if (phase === 'release' || phase === 'defense') {
    const art = artFor(fighter.charDef?.id, move?.name);
    if (phase === 'release' && art?.objectType === 'beam' && art.frames?.length && !extra?.fired) return;
    if (art?.anchor === 'trail' || art?.anchor === 'ground-front' || art?.anchor === 'body' || art?.anchor === 'front' || art?.anchor === 'lance') return;
    if (art?.detonate && move?.kind === 'burst') {
      spawnFxDetonate(scene, fighter, move, extra.x ?? fighter.x, extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.55));
      return;
    }
    if (art?.detonate && move?.kind === 'projectile') return;
    const replaced = art?.frames?.length
      && art.objectType !== 'projectile'
      && art.objectType !== 'thrown'
      && art.objectType !== 'slash arc'
      && art.objectType !== 'extend';
    if (replaced && !(phase === 'defense' && art.releaseFlash)) {
      // A burst is drawn once, at the blast, when resolveBurst supplies a point.
      if (move.kind === 'burst' && extra?.x == null) return;
      const anchor = fxAnchor(fighter, move);
      const x = anchor?.x ?? extra.x ?? fighter.x;
      const y = anchor?.y ?? extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.55);
      const scale = anchor?.scale ?? fxGameplayScale(move, art);
      if (drawFxOneShot(scene, fighter, move, x, y, scale)) return;
    }
    if (art?.frames?.length && (art.objectType === 'slash arc' || art.objectType === 'extend')) return;
  }
  const color = extra.color ?? colorOf(move);
  let x = extra.x ?? fighter.x;
  let y = extra.y ?? fighter.y - (fighter.bodyH ?? 80) * 0.55;
  let contact = false;
  if (phase === 'release' && extra?.x == null && wantsContactSpark(fighter, move)) {
    const tip = meleeContactPoint(fighter, move);
    x = tip.x;
    y = tip.y;
    contact = true;
  }
  const style = move?.vfx ?? move?.kind ?? 'strike';

  if (phase === 'charge') {
    const painted = artFor(fighter.charDef?.id, move?.name);
    const heldArt = painted?.charge?.frames?.length || painted?.orbit?.frames?.length
      || painted?.anchor === 'lance' || painted?.anchor === 'feet';
    if (!heldArt && style !== 'supernova') gather(scene, x, y - 10, color);
    return;
  }
  if (phase === 'fizzle') {
    burst(scene, x, y, 0x99aabb, 4, 20);
    return;
  }
  if (phase === 'defense') {
    if (artFor(fighter.charDef?.id, move?.name)?.releaseFlash) return;
    if (style === 'wall' || style === 'cement') {
      const dir = fighter.facing || 1;
      column(scene, fighter.x + dir * ((fighter.bodyW ?? 40) / 2 + 16), fighter.y, color, 120);
      return;
    }
    if (style === 'sign') return;
    if (style === 'bubble' || style === 'shield') {
      if (move?.powersCharge || move?.chargeMs || move?.lingerImmune) return;
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
      supernovaBlast(scene, x, y, move.radius ?? 64, color);
      scene.cameras?.main?.shake(160, Math.min(0.02, 0.004 + (move.radius ?? 64) / 12000));
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
      beam(scene, fighter, color, (move.beamLen ?? 180) * (move._beamScale ?? 1), move);
      break;
    case 'staff': {
      const tip = meleeContactPoint(fighter, move);
      const dir = fighter.facing || 1;
      const x0 = fighter.x + dir * (fighter.bodyW ?? 40) * 0.15;
      const y0 = fighter.y - (fighter.bodyH ?? 80) * 0.42;
      const dx = tip.x - x0;
      const dy = tip.y - y0;
      const len = Math.max(24, Math.hypot(dx, dy));
      const midX = (x0 + tip.x) / 2;
      const midY = (y0 + tip.y) / 2;
      const rot = Math.atan2(dy, dx);
      const tube = scene.add.rectangle?.(midX, midY, len, 8, color, 0.9);
      const core = scene.add.rectangle?.(midX, midY, len * 0.92, 3, 0xfff6e8, 0.95);
      for (const piece of [tube, core]) {
        if (!piece) continue;
        piece.rotation = rot;
        piece.setBlendMode?.('ADD');
        die(scene, piece, 180);
      }
      burst(scene, tip.x, tip.y, 0xfff6e8, 8, 34);
      break;
    }
    case 'flash': {
      const r = Math.max(36, move.radius ?? 100);
      const disc = scene.add.circle?.(x, y, r, color, 0.32);
      if (disc) {
        disc.setBlendMode?.('ADD');
        die(scene, disc, 240);
      }
      const core = scene.add.circle?.(x, y, r * 0.28, 0xfff6e8, 0.88);
      if (core) {
        core.setBlendMode?.('ADD');
        die(scene, core, 160);
      }
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const ray = scene.add.rectangle?.(
          x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, r * 0.5, 4, color, 0.75,
        );
        if (!ray) continue;
        ray.rotation = a;
        ray.setBlendMode?.('ADD');
        die(scene, ray, 200);
      }
      ring(scene, x, y, 0xfff6e8, r, 4);
      break;
    }
    case 'dash':
    case 'fire':
      burst(scene, x, y, color, 12, 110);
      ring(scene, x, y, color, 40, 3);
      break;
    case 'ice':
      burst(scene, x, y, 0xbff6ff, 8, 60);
      ring(scene, x, y, 0xe8fbff, 50, 3);
      break;
    case 'tide': {
      const dir = fighter.facing || 1;
      const feet = fighter.y - 6;
      const splash = scene.add.circle?.(x + dir * 24, feet, 18, 0x7ec8ff, 0.6);
      if (splash) die(scene, splash, 240);
      for (let i = 0; i < 5; i++) {
        const flame = scene.add.circle?.(
          x + dir * (30 + i * 14), feet - 8 - (i % 2) * 10, 7 + i * 2, i < 2 ? 0xfff0c2 : 0xd6303a, 0.75,
        );
        if (flame) die(scene, flame, 300);
      }
      break;
    }
    case 'cryo':
      burst(scene, x, y, 0xd8fbff, 12, 80);
      ring(scene, x, y, 0xbff6ff, move.radius ?? 78, 4);
      break;
    case 'lance': {
      const dir = fighter.facing || 1;
      const len = move.rangeW ?? 90;
      const streak = scene.add.rectangle?.(x + dir * len * 0.3, y, len, 8, 0x37d67a, 0.9);
      if (streak) die(scene, streak, 180);
      break;
    }
    case 'spin': {
      const arc = scene.add.circle?.(x + (fighter.facing || 1) * 22, y, 30, 0xffe7b0, 0.12);
      if (arc) {
        arc.setStrokeStyle?.(3, 0xfff4d2, 0.85);
        die(scene, arc, 200);
      }
      break;
    }
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
        burst(scene, contact ? x : x + (fighter.facing || 1) * 24, y, color, 7, 50);
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
