// Code-drawn effects for moves that do not have Gemini art yet, plus the
// orbit, absorb, shell, ozone, and freeze visuals that have to stay on the
// fighter instead of playing once.

import { artFor, fxNamed } from './fxArt.js';
import { coatSpec } from './coat.js';
import { FONT_DISPLAY } from '../ui/theme.js';

function orbitSpec(fighter) {
  const move = fighter.charDef?.moves?.basicCharge;
  const spec = move?.orbitWhileCharging;
  if (!spec) return null;
  if (fighter.state === 'charging') return spec;
  const winding = fighter.state === 'attack'
    && fighter.currentMove?.name === move.name
    && (fighter.attackFrame ?? 0) < (fighter.frameData?.startup ?? 1);
  return winding ? spec : null;
}

export function tickChargeOrbits(scene, time) {
  if (!scene?.fighters) return;
  for (const fighter of scene.fighters) {
    const spec = orbitSpec(fighter);
    if (!spec) continue;
    const n = spec.count ?? 8;
    const rad = spec.radius ?? 76;
    const spin = (time / (spec.period ?? 900)) * Math.PI * 2;
    fighter._orbitCd ??= new Map();
    for (const target of scene.fighters) {
      if (target === fighter || !target.alive || target.state === 'ko' || target.state === 'dead') continue;
      let touch = false;
      for (let i = 0; i < n; i++) {
        const ang = spin + (i / n) * Math.PI * 2;
        const x = fighter.x + Math.cos(ang) * rad;
        const y = fighter.y - fighter.bodyH * 0.45 + Math.sin(ang) * rad * 0.62;
        const dx = target.x - x;
        const dy = (target.y - target.bodyH * 0.45) - y;
        if (dx * dx + dy * dy < (spec.touch ?? 22) ** 2) touch = true;
      }
      if (!touch || (fighter._orbitCd.get(target) ?? 0) > time) continue;
      fighter._orbitCd.set(target, time + (spec.gap ?? 300));
      scene.landHit(fighter, target, {
        name: fighter.charDef.moves.basicCharge.name,
        type: spec.type ?? 'kinetic',
        damage: spec.damage ?? 2,
        baseKnockback: spec.knockback ?? 36,
        knockbackGrowth: 0.3,
        kind: 'burst',
        hitlagMult: 0.35,
      });
    }
  }
}

export function syncMoveFx(scene) {
  if (!scene?.add || scene.simFast) return;
  const time = scene.simNow ?? 0;
  if (!scene._moveFx) scene._moveFx = scene.add.graphics().setDepth(18);
  const g = scene._moveFx;
  g.clear();
  for (const fighter of scene.fighters || []) {
    drawOrbit(g, fighter, time);
    drawAbsorb(g, fighter, time);
    drawMirror(g, fighter);
    drawShell(g, fighter, time);
    drawOzone(g, fighter, time);
    drawLance(g, fighter, time);
    drawFreeze(g, fighter, time);
    drawDazzle(g, fighter, time);
    drawVacancy(scene, g, fighter, time);
  }
}

const vacancyLabels = new WeakMap();

function drawVacancy(scene, g, fighter, time) {
  const move = fighter.state === 'defending' ? fighter.defenseMove : null;
  let label = vacancyLabels.get(fighter);
  if (!move?.vacancySign) {
    label?.destroy?.();
    if (label) vacancyLabels.delete(fighter);
    return;
  }
  const held = time - (fighter.defenseStart ?? time);
  const warn = move.vacancyAt ?? (move.duration ?? 900) * 0.62;
  const flicker = held >= warn;
  const dim = flicker && Math.floor(time / 70) % 2 === 0;
  const face = fighter.facing || 1;
  const x = fighter.x + face * ((fighter.bodyW ?? 40) * 0.95);
  const y = fighter.y - (fighter.bodyH ?? 80) * 0.62;
  if (!artFor(fighter.charDef?.id, move.name)?.frames?.length) {
    const w = 108;
    const h = 40;
    const alpha = dim ? 0.28 : 0.95;
    g.lineStyle(4, 0xff5a2a, alpha);
    g.strokeRect(x - w / 2, y - h / 2, w, h);
    g.lineStyle(2, 0xfff6e8, alpha * 0.85);
    g.strokeRect(x - w / 2 + 5, y - h / 2 + 5, w - 10, h - 10);
  }
  if (!label?.scene) {
    label?.destroy?.();
    label = scene.add.text(x, y, '', {
      fontFamily: FONT_DISPLAY,
      fontSize: '13px',
      color: '#fff6e8',
    }).setOrigin(0.5, 0.5).setDepth(19);
    vacancyLabels.set(fighter, label);
  }
  label.setPosition(x, y);
  label.setText(flicker ? 'VACANCY' : 'NO VACANCY');
  label.setAlpha(dim ? 0.35 : 1);
  label.setColor(flicker ? '#ffb4a2' : '#fff6e8');
}

function drawDazzle(g, fighter, time) {
  if (!(fighter.dazzleUntil > time)) return;
  const y = fighter.y - (fighter.bodyH ?? 80) * 0.88;
  const spin = time / 160;
  for (let i = 0; i < 5; i++) {
    const a = spin + (i / 5) * Math.PI * 2;
    const x = fighter.x + Math.cos(a) * 26;
    const yy = y + Math.sin(a) * 9;
    g.fillStyle(0xfff6e8, 0.95);
    g.fillCircle(x, yy, 3.2);
    g.fillStyle(0xff5a2a, 0.9);
    g.fillCircle(x, yy, 1.4);
  }
}

function drawMirror(g, fighter) {
  const move = fighter.state === 'defending' ? fighter.defenseMove : null;
  if (!move?.reflectTypes?.length) return;
  if (artFor(fighter.charDef?.id, move.name)?.frames?.length) return;
  const dir = fighter.facing || 1;
  const x = fighter.x + dir * (fighter.bodyW * 0.72);
  const y = fighter.y - fighter.bodyH * 0.55;
  const h = fighter.bodyH * 0.72;
  g.fillStyle(0xb7f5cf, 0.35);
  g.fillRect(x - 5, y - h / 2, 10, h);
  g.lineStyle(2, 0xe9fff3, 0.95);
  g.strokeRect(x - 5, y - h / 2, 10, h);
  g.fillStyle(0xffffff, 0.75);
  g.fillRect(x - 2, y - h * 0.22, 3, h * 0.28);
}

function drawOrbit(g, fighter, time) {
  const spec = orbitSpec(fighter);
  if (!spec) return;
  const painted = artFor(fighter.charDef?.id, fighter.charDef?.moves?.basicCharge?.name);
  if (painted?.orbit?.frames?.length) return;
  const n = spec.count ?? 8;
  const rad = spec.radius ?? 76;
  const spin = (time / (spec.period ?? 900)) * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const ang = spin + (i / n) * Math.PI * 2;
    const x = fighter.x + Math.cos(ang) * rad;
    const y = fighter.y - fighter.bodyH * 0.45 + Math.sin(ang) * rad * 0.62;
    diamond(g, x, y, 7, 0xf4fbff, 0.95);
    diamond(g, x, y, 3, 0xb9fff2, 0.9);
  }
}

function drawAbsorb(g, fighter, time) {
  const move = fighter.state === 'defending' ? fighter.defenseMove : null;
  if (!move?.powersCharge) return;
  if (artFor(fighter.charDef?.id, move.name)?.frames?.length) return;
  const pulse = 1 + Math.sin(time / 140) * 0.08;
  const r = fighter.bodyH * 0.62 * pulse;
  const y = fighter.y - fighter.bodyH * 0.48;
  g.lineStyle(3, 0xf2f6ff, 0.8);
  g.strokeCircle(fighter.x, y, r);
  g.lineStyle(2, 0xd6303a, 0.55);
  g.strokeCircle(fighter.x, y, r * 0.78);
  g.fillStyle(0xfff4f6, 0.08);
  g.fillCircle(fighter.x, y, r);
}

function drawShell(g, fighter, time) {
  const move = fighter.state === 'defending' ? fighter.defenseMove : null;
  if (!move?.chargeMs) return;
  if (coatSpec(move)) return;
  if (artFor(fighter.charDef?.id, move.name)?.frames?.length) return;
  const t = Math.min(1, Math.max(0, (time - (fighter.defenseStart ?? time)) / move.chargeMs));
  const plates = 6;
  const y = fighter.y - fighter.bodyH * 0.5;
  const rx = fighter.bodyW * 0.85;
  const ry = fighter.bodyH * 0.55;
  for (let i = 0; i < plates; i++) {
    if ((i + 1) / plates > t + 0.01) continue;
    const a0 = -Math.PI / 2 + (i / plates) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / plates - 0.12;
    g.lineStyle(4, 0x9eb4c8, 0.9);
    g.beginPath();
    g.arc(fighter.x, y, Math.max(rx, ry), a0, a1, false);
    g.strokePath();
  }
}

function drawOzone(g, fighter, time) {
  if (!(fighter.lingerImmuneUntil > time)) return;
  if (!fighter.lingerImmune?.includes('radiation')) return;
  const ward = fighter.charDef?.moves?.specialDefense;
  if (coatSpec(ward)) return;
  if (ward && artFor(fighter.charDef?.id, ward.name)?.frames?.length) return;
  const y = fighter.y - fighter.bodyH * 0.5;
  const pulse = 1 + Math.sin(time / 260) * 0.04;
  g.lineStyle(3, 0x8eb6ff, 0.75);
  g.strokeEllipse(fighter.x, y, fighter.bodyW * 1.3 * pulse, fighter.bodyH * 1.15 * pulse);
  g.fillStyle(0x6a8cff, 0.08);
  g.fillEllipse(fighter.x, y, fighter.bodyW * 1.3 * pulse, fighter.bodyH * 1.15 * pulse);
}

function drawLance(g, fighter, time) {
  const move = fighter.state === 'charging' ? fighter.charDef?.moves?.basicCharge : null;
  if (move?.vfx !== 'lance') return;
  if (artFor(fighter.charDef?.id, move.name)?.frames?.length) return;
  const max = move.maxChargeMs || 1;
  const frac = Math.min(1, Math.max(0, (time - (fighter.chargeStart ?? time)) / max));
  const len = 28 + frac * (fighter.bodyH * 1.6);
  const dir = fighter.facing || 1;
  const x = fighter.x + dir * (fighter.bodyW * 0.4);
  const y = fighter.y - fighter.bodyH * 0.55;
  g.fillStyle(0x1f8a4c, 0.95);
  g.fillTriangle(x, y - 6, x, y + 6, x + dir * len, y);
  g.fillStyle(0xd8ffe8, 0.9);
  g.fillTriangle(x + dir * len * 0.45, y - 3, x + dir * len * 0.45, y + 3, x + dir * len, y);
}

function drawFreeze(g, fighter, time) {
  if (!(fighter.frozenUntil > time)) return;
  if (fxNamed('nitra/_freeze')?.frames?.length) return;
  const y = fighter.y - fighter.bodyH * 0.55;
  g.fillStyle(0xd8fbff, 0.16);
  g.fillEllipse(fighter.x, y, fighter.bodyW * 1.1, fighter.bodyH * 0.9);
  g.lineStyle(2, 0xe8ffff, 0.8);
  g.strokeEllipse(fighter.x, y, fighter.bodyW * 1.1, fighter.bodyH * 0.9);
  for (let i = 0; i < 4; i++) {
    const puffY = y - 10 - ((time / 18 + i * 14) % (fighter.bodyH * 0.8));
    g.fillStyle(0xf4ffff, 0.35);
    g.fillCircle(fighter.x + Math.sin(time / 200 + i) * 16, puffY, 6 + (i % 2) * 3);
  }
}

function diamond(g, x, y, r, color, alpha) {
  g.fillStyle(color, alpha);
  g.fillTriangle(x, y - r, x + r * 0.62, y, x, y + r);
  g.fillTriangle(x, y - r, x - r * 0.62, y, x, y + r);
}

/** Returns true when this shot has its own drawn shape. */
export function paintShot(gfx, move, r) {
  const shape = move?.visualShape;
  if (!shape || !gfx?.fillStyle) return false;
  if (shape === 'diamond') {
    diamond(gfx, 0, 0, r * 1.3, 0xf7fbff, 1);
    diamond(gfx, 0, 0, r * 0.45, 0xbfffea, 0.95);
    return true;
  }
  if (shape === 'tornado') {
    gfx.lineStyle(3, 0xd7f4ff, 0.9);
    gfx.beginPath();
    gfx.moveTo(0, r * 1.4);
    gfx.lineTo(r * 0.85, -r * 1.3);
    gfx.lineTo(-r * 0.85, -r * 1.3);
    gfx.closePath();
    gfx.strokePath();
    gfx.lineStyle(2, 0xffffff, 0.7);
    gfx.beginPath();
    gfx.arc(0, -r * 0.2, r * 0.7, 0, Math.PI * 1.4);
    gfx.strokePath();
    return true;
  }
  if (shape === 'disc') {
    gfx.lineStyle(3, 0x37d67a, 0.95);
    gfx.strokeCircle(0, 0, r);
    gfx.fillStyle(0xd5dde6, 0.85);
    gfx.fillEllipse(0, 0, r * 1.7, r * 0.55);
    return true;
  }
  if (shape === 'breath') {
    gfx.fillStyle(0xc9ecff, 0.45);
    gfx.fillTriangle(-r * 0.2, -r * 0.35, -r * 0.2, r * 0.35, r * 1.8, 0);
    gfx.lineStyle(2, 0xe8f7ff, 0.8);
    gfx.strokeTriangle(-r * 0.2, -r * 0.35, -r * 0.2, r * 0.35, r * 1.8, 0);
    return true;
  }
  return false;
}
