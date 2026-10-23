// Code-drawn effects for moves that do not have Gemini art yet, plus the
// orbit, absorb, shell, ozone, and freeze visuals that have to stay on the
// fighter instead of playing once.

import { artFor, fxFrameIndex, fxNamed, vacancySignPoint } from './fxArt.js';
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
    syncDazzleStars(scene, fighter, time);
    drawVacancy(scene, g, fighter, time);
    drawUnquenchable(g, fighter, time);
    drawRibbon(g, fighter, time);
    drawOverclock(g, fighter, time);
    drawPane(g, fighter, time);
    drawBladeShards(g, fighter, time);
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
  const art = artFor(fighter.charDef?.id, move.name);
  const painted = !!art?.frames?.length && art.sign;
  const at = painted ? vacancySignPoint(fighter, art) : null;
  const x = at ? at.x : fighter.x + face * ((fighter.bodyW ?? 40) * 0.95);
  const y = at ? at.y : fighter.y - (fighter.bodyH ?? 80) * 0.62;
  if (!art?.frames?.length) {
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
      fontSize: painted ? '12px' : '13px',
      color: '#fff6e8',
    }).setOrigin(0.5, 0.5).setDepth(19);
    vacancyLabels.set(fighter, label);
  }
  label.setPosition(x, y);
  label.setFontSize(painted ? 12 : 13);
  label.setText(flicker ? 'VACANCY' : 'NO VACANCY');
  label.setAlpha(dim ? 0.35 : 1);
  label.setColor(flicker ? '#ffb4a2' : '#fff6e8');
}

const starHalos = new WeakMap();
let starSeq = 0;

function starSource(scene, key) {
  const image = scene.textures?.get?.(key)?.getSourceImage?.();
  if (!image || image.complete === false || !(image.width > 0)) return null;
  return image;
}

/** Vertical ovals are spun in a canvas, then squashed so the ring stays flat. */
function syncDazzleStars(scene, fighter, time) {
  const stars = artFor('maggie', 'Blinding Flare')?.stars;
  const show = (fighter.dazzleUntil > time) && fighter.dazzleColor === 0xf7fbff && stars?.frames?.length;
  let slot = starHalos.get(fighter);
  if (!show) {
    slot?.image?.destroy?.();
    if (slot) starHalos.delete(fighter);
    return;
  }
  if (!slot?.image?.scene) {
    slot?.image?.destroy?.();
    const key = `daze-ring-${++starSeq}`;
    if (!scene.textures.exists(key)) scene.textures.createCanvas(key, 8, 8);
    const image = scene.add.image(0, 0, key);
    image.setBlendMode?.('ADD');
    image.setDepth(21);
    image.setOrigin(0.5, 0.5);
    slot = { key, image };
    starHalos.set(fighter, slot);
  }
  const frame = stars.frames[fxFrameIndex(stars, time)] || stars.frames[0];
  const src = starSource(scene, frame.key);
  if (!src) {
    slot.image.setVisible(false);
    return;
  }
  const tex = scene.textures.get(slot.key);
  const fit = Math.min(1, 240 / Math.max(src.width, src.height));
  const dw = Math.max(2, Math.round(src.width * fit));
  const dh = Math.max(2, Math.round(src.height * fit));
  const side = Math.ceil(Math.hypot(dw, dh));
  if (tex.width !== side || tex.height !== side) tex.setSize(side, side);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, side, side);
  ctx.save();
  ctx.translate(side / 2, side / 2);
  ctx.rotate(time / 220);
  ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
  tex.refresh();
  const ringW = Math.max(78, (fighter.bodyW ?? 40) * 3.1);
  const squash = stars.squash > 0 ? stars.squash : 0.34;
  const ringH = ringW * squash;
  slot.image.setTexture(slot.key);
  slot.image.setVisible(true);
  slot.image.setDisplaySize(ringW, ringH);
  slot.image.rotation = 0;
  slot.image.setPosition(fighter.x, fighter.y - (fighter.bodyH ?? 80) - ringH * 0.2);
}

function drawDazzle(g, fighter, time) {
  if (!(fighter.dazzleUntil > time)) return;
  if (fighter.dazzleColor === 0xf7fbff && artFor('maggie', 'Blinding Flare')?.stars?.frames?.length) return;
  const y = fighter.y - (fighter.bodyH ?? 80) * 0.88;
  const spin = time / 160;
  const hot = fighter.dazzleColor ?? 0xfff6e8;
  const core = hot === 0xfff6e8 ? 0xff5a2a : 0xd5dee8;
  for (let i = 0; i < 5; i++) {
    const a = spin + (i / 5) * Math.PI * 2;
    const x = fighter.x + Math.cos(a) * 26;
    const yy = y + Math.sin(a) * 9;
    g.fillStyle(hot, 0.95);
    g.fillCircle(x, yy, 3.2);
    g.fillStyle(core, 0.9);
    g.fillCircle(x, yy, 1.4);
  }
}

function drawUnquenchable(g, fighter, time) {
  if (!(fighter.unquenchableUntil > time)) return;
  const move = fighter.charDef?.moves?.basicCharge;
  if (move && artFor(fighter.charDef?.id, move.name)?.frames?.length) return;
  const bodyH = fighter.bodyH ?? 80;
  const bodyW = fighter.bodyW ?? 40;
  const y = fighter.y - bodyH * 0.48;
  const flicker = 0.72 + 0.28 * Math.sin(time / 38);
  g.fillStyle(0xfff6e8, 0.14 * flicker);
  g.fillEllipse(fighter.x, y, bodyW * 1.4, bodyH * 1.12);
  g.lineStyle(2, 0xd5dee8, 0.45 * flicker);
  g.strokeEllipse(fighter.x, y, bodyW * 1.5, bodyH * 1.2);
  for (let i = 0; i < 7; i++) {
    const rise = (time / 26 + i * 18) % (bodyH * 0.95);
    const x = fighter.x + Math.sin(time / 80 + i * 1.3) * bodyW * 0.58;
    const hot = i % 2 === 0;
    g.fillStyle(hot ? 0xfff6e8 : 0xc5d0dc, 0.9);
    g.fillCircle(x, fighter.y - 6 - rise, hot ? 4.4 : 2.5);
  }
}

function drawOverclock(g, fighter, time) {
  const move = fighter.charDef?.moves?.basicCharge;
  const charging = fighter.state === 'charging' && move?.overclock;
  const buffed = (fighter.attackHasteUntil ?? 0) > time;
  if (!charging && !buffed) return;
  if (artFor(fighter.charDef?.id, move?.name)?.frames?.length) return;
  const max = move?.maxChargeMs || 1;
  const frac = charging
    ? Math.max(0, Math.min(1, (time - (fighter.chargeStart ?? time)) / max))
    : 0;
  const hot = (fighter._overheatUntil ?? 0) > time || (charging && frac >= 0.82);
  const bodyH = fighter.bodyH ?? 80;
  const bodyW = fighter.bodyW ?? 40;
  const y = fighter.y - bodyH * 0.48;
  const pulse = 0.65 + 0.35 * Math.sin(time / (hot ? 36 : 80));
  const color = hot ? 0xff4a1a : 0x4ad6ff;
  const core = hot ? 0xffd0a0 : 0xd6f6ff;
  g.lineStyle(hot ? 4 : 2, color, (hot ? 0.95 : 0.55) * pulse);
  g.strokeEllipse(fighter.x, y, bodyW * (1.5 + frac * 0.35), bodyH * (1.05 + frac * 0.12));
  if (hot) {
    g.fillStyle(0xff4a1a, 0.28 * pulse);
    g.fillEllipse(fighter.x, y, bodyW * 1.35, bodyH * 0.95);
  }
  const ticks = 6;
  for (let i = 0; i < ticks; i++) {
    const a = time / 160 + (i / ticks) * Math.PI * 2;
    const x = fighter.x + Math.cos(a) * bodyW * 0.95;
    const yy = y + Math.sin(a) * bodyH * 0.48;
    g.fillStyle(core, 0.95);
    g.fillRect(x - 4, yy - 2, hot ? 10 : 7, hot ? 4 : 2);
  }
}

function drawPane(g, fighter, time) {
  const move = fighter.state === 'defending' ? fighter.defenseMove : null;
  if (move?.vfx !== 'pane') return;
  if (artFor(fighter.charDef?.id, move.name)?.frames?.length) return;
  const dir = fighter.facing || 1;
  const bodyH = fighter.bodyH ?? 80;
  const bodyW = fighter.bodyW ?? 40;
  const x = fighter.x + dir * (bodyW * 0.9);
  const y = fighter.y - bodyH * 0.52;
  const w = 18;
  const h = bodyH * 0.92;
  const shimmer = 0.28 + 0.12 * Math.sin(time / 90);
  g.fillStyle(0xd6f6ff, shimmer);
  g.fillRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(2, 0xf7fbff, 0.9);
  g.strokeRect(x - w / 2, y - h / 2, w, h);
  g.lineStyle(1, 0x4ad6ff, 0.75);
  g.lineBetween(x - w / 2 + 3, y - h * 0.28, x + w / 2 - 3, y - h * 0.28);
  g.lineBetween(x - w / 2 + 3, y, x + w / 2 - 3, y);
  g.lineBetween(x - w / 2 + 3, y + h * 0.28, x + w / 2 - 3, y + h * 0.28);
}

function drawBladeShards(g, fighter, time) {
  if (!fighter._bladeDown) return;
  const move = fighter.charDef?.moves?.basicDirectional;
  if (artFor(fighter.charDef?.id, move?.name)?.frames?.length) return;
  const dir = fighter.facing || 1;
  const x = fighter.x + dir * ((fighter.bodyW ?? 40) * 0.55);
  const y = fighter.y - (fighter.bodyH ?? 80) * 0.58;
  for (let i = 0; i < 4; i++) {
    const a = time / 180 + i * 1.35;
    g.fillStyle(i % 2 ? 0xffffff : 0xd6f6ff, 0.92);
    g.fillRect(x + Math.cos(a) * 9 - 2, y + Math.sin(a) * 7 - 1, 5, 2);
  }
}

function drawRibbon(g, fighter, time) {
  const move = fighter.state === 'defending' ? fighter.defenseMove : null;
  if (move?.vfx !== 'ribbon') return;
  if (artFor(fighter.charDef?.id, move.name)?.frames?.length) return;
  const bodyH = fighter.bodyH ?? 80;
  const bodyW = fighter.bodyW ?? 40;
  const y = fighter.y - bodyH * 0.48;
  const spin = time / 420;
  g.lineStyle(3, 0xe7edf4, 0.92);
  g.beginPath();
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const a = spin + t * Math.PI * 6;
    const rx = bodyW * (0.5 + t * 0.4);
    const x = fighter.x + Math.cos(a) * rx;
    const yy = y + (t - 0.5) * bodyH * 0.92 + Math.sin(a) * 3;
    if (i === 0) g.moveTo(x, yy);
    else g.lineTo(x, yy);
  }
  g.strokePath();
  g.fillStyle(0xffffff, 0.95);
  g.fillCircle(fighter.x + Math.cos(spin) * bodyW * 0.7, y - bodyH * 0.15, 2.4);
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
  if (shape === 'ember') {
    gfx.fillStyle(0xfff6e8, 0.95);
    gfx.fillCircle(0, 0, r * 0.45);
    gfx.fillStyle(0xd6ffb0, 0.8);
    gfx.fillCircle(-r * 0.15, r * 0.1, r * 0.22);
    gfx.lineStyle(1.5, 0xffffff, 0.45);
    gfx.lineBetween(-r * 0.1, r * 0.35, -r * 0.35, r * 1.15);
    return true;
  }
  if (shape === 'tracer') {
    gfx.fillStyle(0xfff2c0, 0.95);
    gfx.fillTriangle(r * 1.6, 0, -r * 0.2, -r * 0.35, -r * 0.2, r * 0.35);
    gfx.fillStyle(0xfff6e8, 0.9);
    gfx.fillCircle(r * 0.7, 0, r * 0.28);
    gfx.lineStyle(2, 0xffb45a, 0.55);
    gfx.lineBetween(-r * 1.8, 0, -r * 0.15, 0);
    return true;
  }
  if (shape === 'wp') {
    gfx.fillStyle(0xfff6e8, 0.95);
    gfx.fillCircle(0, 0, r * 0.7);
    gfx.fillStyle(0xffffff, 0.85);
    gfx.fillCircle(-r * 0.15, -r * 0.12, r * 0.28);
    gfx.fillStyle(0xe8e8e8, 0.35);
    gfx.fillCircle(r * 0.45, r * 0.2, r * 0.45);
    gfx.fillCircle(-r * 0.55, r * 0.35, r * 0.32);
    return true;
  }
  if (shape === 'breath') {
    gfx.fillStyle(0xc9ecff, 0.45);
    gfx.fillTriangle(-r * 0.2, -r * 0.35, -r * 0.2, r * 0.35, r * 1.8, 0);
    gfx.lineStyle(2, 0xe8f7ff, 0.8);
    gfx.strokeTriangle(-r * 0.2, -r * 0.35, -r * 0.2, r * 0.35, r * 1.8, 0);
    return true;
  }
  if (shape === 'ring') {
    gfx.lineStyle(5, 0xd7f4ff, 0.95);
    gfx.strokeCircle(0, 0, r);
    gfx.lineStyle(2, 0xffffff, 0.55);
    gfx.strokeCircle(0, 0, r * 0.62);
    return true;
  }
  return false;
}
