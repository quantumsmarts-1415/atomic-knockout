// Code-driven move effects. Body clips stay on idle/walk unless a real
// attack sheet exists; these read the move from across the stage.
import { canonicalType } from '../data/balance.js';
import { anodizeTint, takingDps } from './kit.js';
import { artFor, breakFrames, cascadePulseArt, chargeFrac, drawFxOneShot, fxAnchor, fxGameplayScale, groundTop, impactRadiusScale, meleeContactPoint, retireShots, reverseFrameOrder, slashNeedsCodeFlash, spawnAimedBeam, spawnFxDetonate, spawnFxSprite, spawnNozzleCone, spawnSeepPath, spawnStageSpan, wantsContactSpark } from './fxArt.js';
import { sheetDrawsWeapon, sheetFxPoint, sheetReleasePoint } from './moveSheet.js';
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

function die(scene, obj, ms = 160) {
  if (!obj || !scene?.tweens) return;
  scene.tweens.add({
    targets: obj, alpha: 0, scale: (obj.scale ?? 1) * 1.2, duration: ms,
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
    die(scene, halo, 120);
    const core = scene.add.rectangle(x, y, w, 4, 0xfff6e8, 0.65 + frac * 0.3);
    core.setBlendMode?.('ADD');
    die(scene, core, 100);
  }
  const rect = scene.add.rectangle(x, y, w, 14, color, 0.85);
  rect.setBlendMode?.('ADD');
  die(scene, rect, 110);
  burst(scene, fighter.x + dir * w, y, 0xfff6e8, 6, 40);
}

function column(scene, x, y, color, h = 110) {
  if (!scene.add?.rectangle) return;
  const rect = scene.add.rectangle(x, y - h / 2, 18, h, color, 0.8);
  die(scene, rect, 160);
  burst(scene, x, y - h, 0xfff1c9, 5, 30);
}

function mushroom(scene, x, y, color) {
  const cap = scene.add.circle?.(x, y - 36, 28, color, 0.75);
  const stem = scene.add.rectangle?.(x, y - 8, 16, 40, 0xfff6e8, 0.8);
  if (cap) die(scene, cap, 180);
  if (stem) die(scene, stem, 180);
  ring(scene, x, y, color, 70, 5);
}

function supernovaBlast(scene, x, y, radius, color) {
  const r = Math.max(18, radius || 64);
  const disc = scene.add.circle?.(x, y, r, 0xfff6d8, 0.38);
  if (disc) {
    disc.setBlendMode?.('ADD');
    disc.setDepth?.(15);
    die(scene, disc, 140);
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
    targets: edge, scale: end, alpha: 0, duration: 150,
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
    if (move.rain) {
      const painted = artFor(fighter.charDef?.id, move.name);
      if (painted?.frames?.length) {
        glow.clear();
        continue;
      }
      const spread = (move.rainSpread ?? 220) * (1 + ((move.chargeSpreadMult ?? move.chargeRadiusMult ?? 1) - 1) * frac);
      const ground = fighter.y - 6;
      const dir = fighter.facing || 1;
      glow.clear();
      glow.lineStyle(2, 0xd6ffb0, 0.25 + frac * 0.55);
      glow.strokeEllipse(fighter.x + dir * spread * 0.12, ground, 36 + spread * 0.85, 14 + frac * 8);
      const y0 = fighter.y - 24;
      const y1 = fighter.y - 70 - frac * 50;
      glow.lineStyle(3, 0xfff6e8, 0.35 + frac * 0.45);
      glow.lineBetween(fighter.x, y0, fighter.x, y1);
      glow.fillStyle(0xe8ffc0, 0.4 + frac * 0.4);
      glow.fillCircle(fighter.x, y1, 4 + frac * 3);
      continue;
    }
    if (move.buff?.unquenchable) {
      const painted = artFor(fighter.charDef?.id, move.name);
      if (painted?.spriteAura) {
        glow.clear();
        continue;
      }
      const bodyH = fighter.bodyH ?? 80;
      const y = fighter.y - bodyH * 0.5;
      const r = 16 + frac * 28;
      glow.clear();
      glow.fillStyle(0xfff6e8, 0.12 + frac * 0.28);
      glow.fillCircle(fighter.x, y, r);
      glow.lineStyle(2, 0xd5dee8, 0.35 + frac * 0.5);
      glow.strokeCircle(fighter.x, y, r * 1.15);
      glow.fillStyle(0xffffff, 0.25 + frac * 0.45);
      glow.fillCircle(fighter.x, y - 4, 6 + frac * 8);
      continue;
    }
    if (move.overclock) {
      const painted = artFor(fighter.charDef?.id, move.name);
      if (painted?.frames?.length) {
        glow.clear();
        continue;
      }
      const bodyH = fighter.bodyH ?? 80;
      const bodyW = fighter.bodyW ?? 40;
      const y = fighter.y - bodyH * 0.5;
      const hot = frac >= 0.82;
      const cool = hot ? 0xff6a2a : 0x4ad6ff;
      const core = hot ? 0xfff2e0 : 0xd6f6ff;
      glow.clear();
      glow.lineStyle(2, cool, 0.35 + frac * 0.55);
      glow.strokeEllipse(fighter.x, y, bodyW * (1.1 + frac * 0.7), bodyH * (0.7 + frac * 0.35));
      glow.fillStyle(core, 0.08 + frac * 0.22);
      glow.fillCircle(fighter.x, y, 10 + frac * 16);
      const ticks = 8;
      for (let i = 0; i < ticks; i++) {
        const a = frac * 4 + (i / ticks) * Math.PI * 2;
        const rx = bodyW * (0.7 + frac * 0.5);
        const ry = bodyH * (0.28 + frac * 0.16);
        glow.fillStyle(hot ? 0xfff2e0 : 0xd6f6ff, 0.45 + frac * 0.5);
        glow.fillRect(fighter.x + Math.cos(a) * rx - 3, y + Math.sin(a) * ry - 1, 6, 2);
      }
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
    if (painted?.anchor === 'feet' || painted?.charge?.anchor === 'feet' || painted?.anchor === 'aura' || painted?.charge?.frames?.length) {
      glow.clear();
      continue;
    }
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

function drawBinaryDigit(scene, fighter, x, y, digit) {
  fighter._binaryDigit?.destroy?.();
  const g = scene.add.graphics?.();
  if (!g) return;
  fighter._binaryDigit = g;
  g.setPosition?.(x, y);
  g.setDepth?.(30);
  g.fillStyle(0x071820, 1);
  g.fillRoundedRect?.(-22, -34, 44, 68, 8);
  g.lineStyle(3, 0x6ecbff, 1);
  g.strokeRoundedRect?.(-22, -34, 44, 68, 8);
  g.fillStyle(0xf4fbff, 1);
  if (digit === '0') {
    g.lineStyle(5, 0xf4fbff, 1);
    g.strokeEllipse(0, 0, 22, 40);
  } else {
    g.fillRect(-5, -22, 10, 40);
    g.fillRect(-12, 16, 24, 6);
    g.fillTriangle?.(-14, -22, -5, -22, -5, -10);
  }
  die(scene, g, 280);
}

function sprayShards(scene, x, y) {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.2;
    const shard = scene.add.rectangle?.(
      x + Math.cos(a) * 12, y + Math.sin(a) * 8, i % 2 ? 9 : 6, 3, i % 2 ? 0xffffff : 0xd6f6ff, 0.92,
    );
    if (!shard) continue;
    shard.rotation = a;
    shard.setBlendMode?.('ADD');
    die(scene, shard, 240);
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
  if (!scene?.add || !fighter || scene.simFast || move?._noVfx) return;
  // The battle scene owns a beam's sprite and recrops it to the hit each frame.
  if (move?._suppressBeamArt && phase === 'release') return;
  if (phase === 'recoil' || phase === 'reflect') {
    const painted = artFor(fighter.charDef?.id, move?.name);
    const side = phase === 'recoil' ? painted?.recoil : painted?.reflect;
    if (side?.frames?.length) {
      const x = extra.x ?? fighter.x;
      const y = extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.5);
      spawnFxSprite(scene, { ...side, _rot: extra.aim ?? 0 }, x, y, 1, 1);
    }
    return;
  }
  if (phase === 'fizz') {
    const fizz = artFor(fighter.charDef?.id, move?.name)?.fizz;
    if (fizz?.frames?.length) spawnFxSprite(scene, fizz, fighter.x, fighter.y, 1);
    return;
  }
  if (phase === 'ignite') {
    const y = fighter.y - (fighter.bodyH ?? 80) * 0.5;
    const art = artFor(fighter.charDef?.id, move?.name);
    if (art?.ignite?.frames?.length) {
      spawnFxSprite(scene, art.ignite, fighter.x, y, 1);
      return;
    }
    burst(scene, fighter.x, y, 0xfff6e8, 16, 78);
    ring(scene, fighter.x, y, 0xfff6e8, (fighter.bodyH ?? 80) * 0.75, 3);
    return;
  }
  if (phase === 'letgo') {
    const art = artFor(fighter.charDef?.id, move?.name);
    if (art?.condense?.frames?.length) {
      const y = fighter.y - (fighter.bodyH ?? 80) * 0.5;
      const s = art.condense.scale > 0 ? art.condense.scale : 1;
      spawnFxSprite(scene, art.condense, fighter.x, y, s, 1);
      return;
    }
    if (art?.reverseOnRelease && art.frames?.length) {
      const face = fighter.facing || 1;
      const x = fighter.x + face * (move?.offsetX ?? (fighter.bodyW ?? 40) * 0.9);
      spawnFxSprite(scene, {
        ...art,
        order: reverseFrameOrder(art.frames.length),
        loop: false,
        hold: null,
      }, x, fighter.y, 1, 1);
      return;
    }
    const rise = (art?.puddle || (art?.breakFrom ?? -1) >= 0) ? breakFrames(art) : null;
    if (rise?.frames?.length) {
      const fps = rise.fps > 0 ? rise.fps : 8;
      const atFeet = !!(art.puddle || art.anchor === 'ground');
      const y = atFeet ? fighter.y : fighter.y - (fighter.bodyH ?? 80) * 0.5;
      if (art.puddle) {
        fighter._puddleRiseUntil = (scene.simNow ?? 0) + (rise.frames.length / fps) * 1000 + 80;
      }
      spawnFxSprite(scene, { ...rise, pivotX: art.pivotX, pivotY: art.pivotY }, fighter.x, y, 1);
      if (art.burst?.frames?.length) {
        const chest = fighter.y - (fighter.bodyH ?? 80) * 0.5;
        spawnFxSprite(scene, art.burst, fighter.x, chest, 1);
      }
      return;
    }
    if (art?.burst?.frames?.length && move?.sponge) {
      const y = fighter.y - (fighter.bodyH ?? 80) * 0.45;
      spawnFxSprite(scene, art.burst, fighter.x + (fighter.facing || 1) * 28, y, 1, fighter.facing || 1);
      return;
    }
    if (coatSpec(move)) return;
    if (!art?.releaseFlash || !art.frames?.length) return;
    const y = fighter.y - (fighter.bodyH ?? 80) * 0.5;
    drawFxOneShot(scene, fighter, move, fighter.x, y, 1);
    return;
  }
  if (coatSpec(move) && phase === 'defense') return;
  if (phase === 'absorb') {
    const art = artFor(fighter.charDef?.id, move?.name);
    const x = extra.x ?? fighter.x;
    const y = extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.5);
    if (art?.absorb?.frames?.length) {
      spawnFxSprite(scene, art.absorb, x, y, 1, fighter.facing || 1);
      return;
    }
    if (art?.frames?.length) drawFxOneShot(scene, fighter, move, x, y, 1);
    return;
  }
  if (phase === 'warn') {
    const cue = artFor(fighter.charDef?.id, move?.name)?.warn;
    if (cue?.frames?.length) {
      const y = fighter.y - (fighter.bodyH ?? 80) * 0.5;
      spawnFxSprite(scene, cue, fighter.x, y, cue.scale > 0 ? cue.scale : 1, 1);
    }
    return;
  }
  if (phase === 'cleanse' || phase === 'block' || phase === 'pierce' || phase === 'linger' || phase === 'wave') {
    const art = artFor(fighter.charDef?.id, move?.name);
    const side = phase === 'cleanse' ? art?.cleanse
      : phase === 'block' ? art?.block
        : phase === 'pierce' ? art?.pierce
          : phase === 'wave' ? art?.wave
            : art?.linger;
    if (side?.frames?.length) {
      const x = extra.x ?? fighter.x;
      const y = extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.5);
      const face = extra.face || fighter.facing || 1;
      spawnFxSprite(scene, side, x, y, side.scale > 0 ? side.scale : 1, face);
    }
    return;
  }
  if (phase === 'release' || phase === 'defense') {
    const art = artFor(fighter.charDef?.id, move?.name);
    if (phase === 'release' && move?.hideProjectile && !art?.frames?.length && art?.splash?.frames?.length) return;
    if (phase === 'release' && art?.steps?.length) {
      const idx = move?._pulseStep;
      const step = art.steps[idx];
      if (idx == null || !step?.frames?.length) return;
      const fitted = impactRadiusScale(move, step);
      const s = fitted != null ? fitted : (step.scale > 0 ? step.scale : 1);
      // The body pulses are a few pixels. The step sheet is the hit, played
      // out before the next one and then replaced so the shrink stays readable.
      const played = cascadePulseArt(step, idx, art.steps.length);
      played._shotTag = `cascade-pulse:${fighter?.id ?? fighter?.charDef?.id ?? 'mac'}`;
      retireShots(played._shotTag);
      spawnFxSprite(
        scene,
        played,
        extra.x ?? fighter.x,
        extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.5),
        s,
        1,
      );
      return;
    }
    if (phase === 'release' && move?.aimStick && extra?.fired) {
      spawnAimedBeam(scene, fighter, move);
      return;
    }
    if (phase === 'release' && art?.unit?.frames?.length && extra?.fired) {
      spawnNozzleCone(scene, fighter, move);
      return;
    }
    if (phase === 'release' && art?.objectType === 'beam' && art.frames?.length && !extra?.fired) return;
    if (phase === 'release' && art?.releaseImpact && art.impact?.frames?.length) {
      const posed = sheetReleasePoint(fighter, 'melee') || sheetFxPoint(fighter, 'melee');
      const face = fighter.facing || 1;
      const at = posed || {
        x: fighter.x + face * (fighter.bodyW ?? 40) * 0.85,
        y: fighter.y - (fighter.bodyH ?? 80) * 0.52,
      };
      spawnFxSprite(scene, art.impact, at.x, at.y, 1, face);
    }
    if (art?.anchor === 'pin') return;
    if (phase === 'release' && move?.geyser) return;
    if (phase === 'release' && !art?.frames?.length && art?.impact?.frames?.length) return;
    if (phase === 'release' && move?.kind === 'mine' && extra?.x == null) return;
    // A held shell (the hohlraum) stays on her body. The detonation is the burst side.
    if (phase === 'release' && art?.anchor === 'body' && art.burst?.frames?.length && extra?.x != null) {
      const s = art.burst.scale > 0 ? art.burst.scale : 1;
      spawnFxSprite(scene, art.burst, extra.x, extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.5), s);
      return;
    }
    if (phase === 'defense' && art?.launch?.frames?.length) {
      spawnFxSprite(scene, art.launch, fighter.x, fighter.y - (fighter.bodyH ?? 80) * 0.45, 1, 1);
    }
    if (art?.anchor === 'trail' || art?.anchor === 'ground-front' || art?.anchor === 'body' || art?.anchor === 'front' || art?.anchor === 'head' || art?.anchor === 'lance' || art?.anchor === 'aura' || art?.anchor === 'afterimage' || (art?.anchor === 'ground' && art.loop)) return;
    if (move?.kind === 'zone' && move.zone?.trap && art?.frames?.length) return;
    // The lingering sheet is the zone itself. A release oneshot would stack a second copy.
    if (move?.zone?.sheet && art?.loop && art?.frames?.length) return;
    if (move?.kind === 'zone' && move.zone?.sheet && art?.frames?.length) return;
    // A looping floor sheet is held on the fighter. A one-shot ground burst still draws.
    if (phase === 'defense' && art?.anchor === 'ground' && (art.loop || art.hold?.frames?.length) && art.frames?.length) return;
    // A crumble or melt is held on the feet, then the rise plays on letgo.
    if (phase === 'defense' && art?.puddle && art.frames?.length) return;
    if (art?.detonate && move?.kind === 'burst') {
      spawnFxDetonate(scene, fighter, move, extra.x ?? fighter.x, extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.55));
      return;
    }
    if (art?.detonate && move?.kind === 'projectile') return;
    // A painted shot stays on the projectile. An ignite (Violet Ember) draws the
    // burst side at the blast, or the shot sheet itself when there is no side.
    if ((art?.objectType === 'projectile' || art?.objectType === 'thrown') && art.frames?.length) {
      if (art.stageFit) {
        spawnStageSpan(scene, fighter, art);
        return;
      }
      if (phase === 'release' && move?.kind === 'burst' && extra?.x != null && (move.igniteDamage != null || move.explodeRadius != null)) {
        const painted = art.impact?.frames?.length ? art.impact : art.burst?.frames?.length ? art.burst : art;
        const fitted = impactRadiusScale(move, painted);
        const s = fitted != null ? fitted : (painted.scale > 0 ? painted.scale : 1);
        spawnFxSprite(
          scene,
          painted,
          extra.x,
          extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.45),
          s,
          fighter.facing || 1,
        );
      }
      return;
    }
    const replaced = art?.frames?.length
      && art.objectType !== 'projectile'
      && art.objectType !== 'thrown'
      && art.objectType !== 'slash arc'
      && art.objectType !== 'extend';
    if (replaced && !(phase === 'defense' && art.releaseFlash)) {
      if (art.stageFit) {
        spawnStageSpan(scene, fighter, art);
        return;
      }
      // A burst is drawn once, at the blast, when resolveBurst supplies a point.
      // A leap vanishes at the old spot; the landing flash is spawned after the teleport.
      if ((move.kind === 'burst' || move.kind === 'dive') && extra?.x == null) {
        // Rising Sun's palm thrust is a soft pose. Draw the burst on that
        // hand when the sheet releases, instead of waiting for the blast tick.
        const onPalm = extra?.fromSheet && move?.name === 'Rising Sun' && art?.frames?.length;
        if (!onPalm) {
          if (move.leap && art?.frames?.length) {
            drawFxOneShot(scene, fighter, move, fighter.x, fighter.y - (fighter.bodyH ?? 80) * 0.5, 1);
          }
          return;
        }
      }
      if (phase === 'release' && move?.leap && extra?.x != null) return;
      const anchor = fxAnchor(fighter, move);
      const landed = extra?.x != null && !!(move?.predict || move?.landAt);
      let x = landed ? extra.x : (anchor?.x ?? extra.x ?? fighter.x);
      let y = landed ? extra.y : (anchor?.y ?? extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.55));
      if (extra?.fromSheet && art?.anchor !== 'body' && !landed) {
        const kind = art?.anchor === 'ground' ? 'ground' : 'shot';
        const posed = sheetReleasePoint(fighter, kind) || sheetFxPoint(fighter, kind);
        if (posed) { x = posed.x; y = posed.y; }
      }
      const selfBlast = move?._selfBlast > 0 ? move._selfBlast : 0;
      const fitted = selfBlast ? null : impactRadiusScale(move, art);
      let scale = selfBlast || (fitted != null ? fitted : (anchor?.scale ?? fxGameplayScale(move, art)));
      if (selfBlast) {
        x = fighter.x;
        y = fighter.y - (fighter.bodyH ?? 80) * 0.5;
      } else if (art.scaleTo === 'radius' && art.anchor !== 'ground') {
        // The sheet release already sits on the toss hand. A chest line
        // would drop Nitroglycerin and End of the Table onto the torso.
        const onHand = extra?.fromSheet
          && (move?.name === 'Nitroglycerin Vial' || move?.name === 'End of the Table');
        if (!onHand) y = fighter.y - (fighter.bodyH ?? 80) * 0.5;
      }
      if ((art.anchor === 'fist' || art.anchor === 'contact') && extra?.x == null) {
        const tip = meleeContactPoint(fighter, move);
        x = tip.x;
        y = tip.y;
      }
      if (move?.riseUnder && art.anchor === 'ground') {
        x = fighter.x;
        y = groundTop(scene, fighter.x, fighter.y);
        spawnSeepPath(scene, fighter, art);
      }
      if (move._chainImpact && art.impact?.frames?.length) {
        const s = art.impact.scale > 0 ? art.impact.scale : 1;
        spawnFxSprite(scene, art.impact, x, y, s, fighter.facing || 1);
        return;
      }
      if (drawFxOneShot(scene, fighter, move, x, y, scale)) {
        if (art.wave?.frames?.length) {
          const ratio = move?._baseRadius > 0 && move?.radius > 0 ? move.radius / move._baseRadius : 1;
          const waveScale = art.wave.scale > 0
            ? art.wave.scale * (art.wave.scaleWith === 'radius' ? ratio : 1)
            : (0.5 + 0.5 * chargeFrac(move));
          const waveFace = art.wave.flip ? (fighter.facing || 1) : 1;
          spawnFxSprite(scene, art.wave, x, y, waveScale, waveFace);
        }
        if (art.gas?.frames?.length) spawnFxSprite(scene, art.gas, x, y, scale);
        if (move.vfx === 'binary') {
          drawBinaryDigit(scene, fighter, x, y, move._retried ? '0' : '1');
        }
        return;
      }
    }
    if (art?.oneshot && art.frames?.length && (art.objectType === 'slash arc' || art.objectType === 'extend')) {
      const face = fighter.facing || 1;
      let x = extra.x ?? fighter.x + face * (fighter.bodyW ?? 40) * 0.2;
      let y = extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.55);
      if (extra.x == null && art.anchor === 'ground') y = fighter.y;
      if (extra.x == null && (art.anchor === 'contact' || art.anchor === 'fist')) {
        const tip = meleeContactPoint(fighter, move);
        x = tip.x;
        y = tip.y;
      }
      const fitted = impactRadiusScale(move, art);
      const shot = drawFxOneShot(scene, fighter, move, x, y, fitted != null ? fitted : 1);
      if (shot) {
        if (move.sharpen) shot.image?.setTint?.(anodizeTint(fighter._sharpen, move.sharpen));
        else if (move.bonusWhileDps && takingDps(fighter, scene.simNow ?? 0)) shot.image?.setTint?.(0xffcd5a);
        return;
      }
    }
    if (art?.frames?.length && (art.objectType === 'slash arc' || art.objectType === 'extend')) {
      // The slash sheet replaces the generic spark. A wheel with no baked
      // strike (keepSlash) still gets the code hit flash at the fist.
      if (slashNeedsCodeFlash(art)) {
        const color = extra.color ?? colorOf(move);
        const tip = meleeContactPoint(fighter, move);
        burst(scene, tip.x, tip.y, color, 8, 56);
        burst(scene, tip.x, tip.y, 0xfff8e8, 4, 20);
      }
      return;
    }
  }
  const color = extra.color ?? colorOf(move);
  let x = extra.x ?? fighter.x;
  let y = extra.y ?? fighter.y - (fighter.bodyH ?? 80) * 0.55;
  let contact = false;
  if (phase === 'release' && (extra?.fromSheet || extra?.x == null)) {
    const posed = sheetFxPoint(fighter, 'melee') || sheetReleasePoint(fighter, 'melee');
    if (posed) { x = posed.x; y = posed.y; contact = true; }
  }
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
      || painted?.anchor === 'lance' || painted?.anchor === 'feet' || painted?.anchor === 'aura' || painted?.spriteAura;
    if (!heldArt && style !== 'supernova' && !move?.overclock) gather(scene, x, y - 10, color);
    return;
  }
  if (phase === 'fizzle') {
    const painted = artFor(fighter.charDef?.id, move?.name);
    if (painted?.fizzle?.frames?.length) {
      spawnFxSprite(scene, painted.fizzle, fighter.x, fighter.y - (fighter.bodyH ?? 80) * 0.45, 1);
      return;
    }
    burst(scene, x, y, move?.fizzleTint ?? 0x99aabb, 4, 20);
    return;
  }
  if (phase === 'defense') {
    if (artFor(fighter.charDef?.id, move?.name)?.releaseFlash) return;
    if (style === 'wall' || style === 'cement') {
      const dir = fighter.facing || 1;
      column(scene, fighter.x + dir * ((fighter.bodyW ?? 40) / 2 + 16), fighter.y, color, 120);
      return;
    }
    if (style === 'sign' || style === 'ribbon' || style === 'pane') return;
    if (style === 'bubble' || style === 'shield') {
      if (move?.powersCharge || move?.chargeMs || move?.lingerImmune) return;
      if (artFor(fighter.charDef?.id, move?.name)?.shatter?.frames?.length) return;
      shieldBubble(scene, fighter, color);
      return;
    }
    ring(scene, x, fighter.y - (fighter.bodyH ?? 80) * 0.5, color, 48, 3);
    return;
  }
  if (phase === 'hit') {
    const painted = artFor(fighter.charDef?.id, move?.name);
    if (painted?.impact?.frames?.length) {
      const s = painted.impact.scale > 0 ? painted.impact.scale : 1;
      spawnFxSprite(scene, painted.impact, x, y, s);
      return;
    }
    burst(scene, x, y, color, 8, 70);
    return;
  }
  if (phase === 'break') {
    const burst = breakFrames(artFor(fighter.charDef?.id, move?.name));
    if (!burst?.frames?.length) return;
    const y = extra.y ?? (fighter.y - (fighter.bodyH ?? 80) * 0.5);
    const x = extra.x ?? fighter.x;
    const aimed = (burst.pivotX ?? 0.5) < 0.05;
    const face = aimed ? (fighter.facing || 1) : 1;
    const scale = impactRadiusScale(move, burst) ?? 1;
    spawnFxSprite(scene, burst, x, y, scale, face);
    if (extra.both && !aimed) spawnFxSprite(scene, burst, extra.otherX ?? x, extra.otherY ?? y, scale);
    return;
  }
  if (phase === 'shatter') {
    if (coatSpec(move)?.flake) return;
    const burst = breakFrames(artFor(fighter.charDef?.id, move?.name));
    if (burst) {
      spawnFxSprite(scene, burst, x, y, 1, extra.face || 1);
      if (extra.both) {
        const ox = extra.otherX ?? x + (fighter.facing || 1) * 48;
        const oy = extra.otherY ?? y;
        spawnFxSprite(scene, burst, ox, oy, 1);
      }
      return;
    }
    sprayShards(scene, x, y);
    if (extra.both) {
      const dir = fighter.facing || 1;
      sprayShards(scene, x + dir * 42, y);
      sprayShards(scene, fighter.x - dir * 18, y);
    }
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
    case 'gust': {
      if (artFor(fighter.charDef?.id, move?.name)?.frames?.length) break;
      for (let i = 0; i < 4; i++) {
        const streak = scene.add.rectangle?.(x + (fighter.facing || 1) * (20 + i * 18), y, 28, 3, 0xd7f4ff, 0.7);
        if (streak) die(scene, streak, 200);
      }
      break;
    }
    case 'laser':
    case 'beam':
      beam(scene, fighter, color, (move.beamLen ?? 180) * (move._beamScale ?? 1), move);
      break;
    case 'thermite': {
      const dir = fighter.facing || 1;
      const len = (move.beamLen ?? 130) * (move._beamScale ?? 1);
      const y = fighter.y - (fighter.bodyH ?? 80) * 0.58;
      const x0 = fighter.x + dir * (fighter.bodyW ?? 40) * 0.3;
      for (let i = 0; i < 7; i++) {
        const ang = (i - 3) * 0.14;
        const dx = Math.cos(ang) * len * dir;
        const dy = Math.sin(ang) * len * 0.28;
        const streak = scene.add.rectangle?.(x0 + dx * 0.45, y + dy * 0.45, len * 0.72, i % 2 ? 4 : 2, i % 2 ? 0xfff4e0 : 0xff6a1a, 0.8);
        if (streak) {
          streak.rotation = Math.atan2(dy, dx);
          streak.setBlendMode?.('ADD');
          die(scene, streak, 200);
        }
      }
      burst(scene, x0 + dir * len * 0.85, y, 0xfff6e8, 8, 34);
      break;
    }
    case 'whip': {
      if (sheetDrawsWeapon(fighter)) break;
      const tip = meleeContactPoint(fighter, move);
      const dir = fighter.facing || 1;
      const x0 = fighter.x + dir * (fighter.bodyW ?? 40) * 0.25;
      const y0 = fighter.y - (fighter.bodyH ?? 80) * 0.5;
      const span = Math.max(24, Math.hypot(tip.x - x0, tip.y - y0));
      const cable = scene.add.rectangle?.((x0 + tip.x) / 2, (y0 + tip.y) / 2, span, 3, 0xd5dde8, 0.9);
      if (cable) {
        cable.rotation = Math.atan2(tip.y - y0, tip.x - x0);
        cable.setBlendMode?.('ADD');
        die(scene, cable, 160);
      }
      burst(scene, tip.x, tip.y, 0xd6e8ff, 8, 26);
      burst(scene, tip.x, tip.y, 0xfff6e8, 4, 14);
      break;
    }
    case 'vortex': {
      const yBody = fighter.y - (fighter.bodyH ?? 80) * 0.45;
      ring(scene, fighter.x, yBody, 0xd5dde6, move.radius ?? 90, 4);
      ring(scene, fighter.x, yBody, 0xf4f7fb, (move.radius ?? 90) * 0.55, 2);
      burst(scene, fighter.x, yBody, 0xe7edf4, 8, 36);
      break;
    }
    case 'magnesium': {
      const yBody = fighter.y - (fighter.bodyH ?? 80) * 0.5;
      burst(scene, fighter.x, yBody, 0xfff6e8, 14, 64);
      ring(scene, fighter.x, yBody, 0xd5dee8, (fighter.bodyH ?? 80) * 0.7, 3);
      break;
    }
    case 'overclock': {
      const hot = (move._chargeFrac ?? 0) >= 0.98;
      const yBody = fighter.y - (fighter.bodyH ?? 80) * 0.5;
      const color = hot ? 0xff6a2a : 0x4ad6ff;
      const core = hot ? 0xfff2e0 : 0xd6f6ff;
      const ringG = scene.add.graphics?.();
      if (ringG) {
        ringG.lineStyle(3, color, 0.9);
        ringG.strokeEllipse(0, 0, 28, 18);
        ringG.setPosition(fighter.x, yBody);
        ringG.setBlendMode?.('ADD');
        die(scene, ringG, hot ? 280 : 200);
      }
      burst(scene, fighter.x, yBody, core, 10, hot ? 70 : 40);
      break;
    }
    case 'crystal': {
      const tip = meleeContactPoint(fighter, move);
      const dir = fighter.facing || 1;
      const x0 = fighter.x + dir * (fighter.bodyW ?? 40) * 0.22;
      const y0 = fighter.y - (fighter.bodyH ?? 80) * 0.62;
      const span = Math.max(28, Math.hypot(tip.x - x0, tip.y - y0));
      const midX = (x0 + tip.x) / 2;
      const midY = (y0 + tip.y) / 2;
      const ang = Math.atan2(tip.y - y0, tip.x - x0);
      const blade = scene.add.rectangle?.(midX, midY, span, 8, 0xd6f6ff, 0.88);
      if (blade) {
        blade.rotation = ang;
        blade.setBlendMode?.('ADD');
        die(scene, blade, 150);
      }
      const edge = scene.add.rectangle?.(midX, midY, span * 0.92, 2, 0xffffff, 0.95);
      if (edge) {
        edge.rotation = ang;
        edge.setBlendMode?.('ADD');
        die(scene, edge, 120);
      }
      break;
    }
    case 'binary': {
      const r = move.radius ?? 80;
      const yBody = fighter.y - (fighter.bodyH ?? 80) * 0.45;
      const digit = move._retried ? '0' : '1';
      const wave = scene.add.graphics?.();
      if (wave) {
        wave.lineStyle(4, 0x6ecbff, 0.95);
        wave.strokeCircle(0, 0, 16);
        wave.lineStyle(2, 0xe8f7ff, 0.8);
        wave.strokeCircle(0, 0, 10);
        wave.setPosition(fighter.x, yBody);
        wave.setBlendMode?.('ADD');
        if (scene.tweens) {
          scene.tweens.add({
            targets: wave, scale: Math.max(1.4, r / 16), alpha: 0, duration: 300,
            onComplete: () => wave.destroy(),
          });
        } else wave.destroy?.();
      }
      drawBinaryDigit(scene, fighter, fighter.x, yBody, digit);
      break;
    }
    case 'phosphor': {
      const painted = artFor(fighter.charDef?.id, move?.name);
      if (painted?.frames?.length || painted?.launch?.frames?.length) break;
      const y0 = fighter.y - 28;
      const y1 = fighter.y - (fighter.bodyH ?? 80) - 48;
      const streak = scene.add.rectangle?.(fighter.x, (y0 + y1) / 2, 5, Math.abs(y0 - y1), 0xfff6e8, 0.85);
      if (streak) {
        streak.setBlendMode?.('ADD');
        die(scene, streak, 280);
      }
      const head = scene.add.circle?.(fighter.x, y1, 8, 0xf4ffe8, 0.95);
      if (head) {
        head.setBlendMode?.('ADD');
        die(scene, head, 320);
      }
      for (let i = 0; i < 5; i++) {
        const spark = scene.add.circle?.(
          fighter.x + (i % 2 ? 5 : -5), y0 + (y1 - y0) * (i / 5), 2.5, 0xd6ffb0, 0.8,
        );
        if (!spark) continue;
        spark.setBlendMode?.('ADD');
        die(scene, spark, 180 + i * 30);
      }
      break;
    }
    case 'tracer': {
      if (artFor(fighter.charDef?.id, move?.name)?.frames?.length) break;
      const dir = fighter.facing || 1;
      const muzzle = scene.add.circle?.(fighter.x + dir * 28, y, 6, 0xfff6e8, 0.9);
      if (muzzle) {
        muzzle.setBlendMode?.('ADD');
        die(scene, muzzle, 80);
      }
      break;
    }
    case 'wp': {
      const painted = artFor(fighter.charDef?.id, move?.name);
      if (painted?.frames?.length || painted?.impact?.frames?.length) break;
      burst(scene, x, y, 0xfff6e8, 8, 28);
      break;
    }
    case 'flare': {
      const tip = meleeContactPoint(fighter, move);
      burst(scene, tip.x, tip.y, 0xfff6e8, 11, 40);
      burst(scene, tip.x, tip.y, 0xd5dee8, 6, 22);
      ring(scene, tip.x, tip.y, 0xfff6e8, 26, 2);
      break;
    }
    case 'whiteout': {
      const r = Math.max(48, move.radius ?? 90);
      const disc = scene.add.circle?.(x, y, r, 0xfff6e8, 0.55);
      if (disc) {
        disc.setBlendMode?.('ADD');
        die(scene, disc, 220);
      }
      const core = scene.add.circle?.(x, y, r * 0.32, 0xffffff, 0.92);
      if (core) {
        core.setBlendMode?.('ADD');
        die(scene, core, 140);
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const ray = scene.add.rectangle?.(
          x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.72, 3, 0xf4f7ff, 0.85,
        );
        if (!ray) continue;
        ray.rotation = a;
        ray.setBlendMode?.('ADD');
        die(scene, ray, 180);
      }
      break;
    }
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
      if (artFor(fighter.charDef?.id, move?.name)?.frames?.length) break;
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
