// ---------------------------------------------------------------------------
// Feel — every Smash-style timing and presentation constant, in one place.
// Gameplay formulas here run in the fast sim. Visual systems read the same
// numbers but must no-op when scene.simFast is set.
// ---------------------------------------------------------------------------

export const STEP_MS = 1000 / 60;

export const FEEL = {
  stepMs: STEP_MS,

  // Hitlag, Ultimate: floor(clamp((d*0.65+6)*h*e, 0, 30))
  hitlagDmg: 0.65,
  hitlagBase: 6,
  hitlagCap: 30,
  hitlagElectric: 1.5,
  hitlagPlayers: { 3: 0.925, 4: 0.862 },
  hitlagPlayerMin: 10,
  hitlagMultiHit: 0.4,
  hitlagCreep: 0.05,
  koHitlagMult: 1.5,

  // Knockback. kbRaw is the existing (base+percent*growth)/weight*scale.
  // Dividing by kbUnit maps it onto Smash units, where ~100 is a solid hit
  // and 80 is the tumble line. Lower kbUnit = more launch and more hitstun.
  kbUnit: 14.7,
  pxPerUnit: 10.4,
  launchPerUnit: 0.03,
  launchDecay: 0.051,
  hitstunPerUnit: 0.4,
  tumbleAt: 80,
  trailAt: 60,
  balloonHitstun: 32,
  balloonDecay: 1.6,
  balloonCap: 20,
  diMaxDeg: 10,
  angleKinetic: 40,
  angleBurst: 50,
  angleLift: 80,
  sakuraiLow: 80,

  // Attack frame data, derived from the move's duration and cooldown.
  startupFrac: 0.30,
  activeFrac: 0.18,
  activeMin: 2,
  activeMax: 5,
  endlagFromCooldown: 18,
  idleBlendFrames: 4,

  // Input and movement.
  bufferFrames: 9,
  jumpSquat: 3,
  shortHop: 0.62,
  fastFallSpeed: 1100,
  landingSoft: 2,
  landingHard: 4,
  landingHardVy: 700,
  landingAerial: 8,
  reverseFrames: 2,

  ledgeW: 34,
  ledgeH: 40,
  ledgeIntang: 30,
  ledgeMax: 300,

  // Pose spring. k and damp are per 60 Hz frame, scaled by dt.
  poseK: 600,
  poseDamp: 0.72,

  // Trauma shake (screen pixels before the zoom correction).
  traumaDecay: 1.6,
  traumaMax: 14,
  traumaRot: 0.8 * Math.PI / 180,
  traumaReduced: 0.4,

  // Camera.
  camPadX: 180,
  camPadTop: 220,
  camPadBottom: 120,
  camLook: 0.12,
  camMax1: 1.35,
  camMaxMulti: 1.15,
  camPosTau: 160,
  camZoomOutTau: 180,
  camZoomInTau: 700,
  camDead: 0.06,
  koZoom: 1.6,
  koZoomFrames: 6,

  // Big moments, in real rendered frames.
  koSlow: 0.25,
  koSlowFrames: 24,
  koRampFrames: 12,
  stockSlow: 0.5,
  stockSlowFrames: 10,

  particleCap: 400,
};

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Sim frames of hitlag. dmg is the damage just dealt. */
export function hitlagFrames(dmg, { hitlagMult = 1, type, type2, players = 2, ko = false } = {}) {
  if (!(dmg > 0)) return 0;
  const electric = type === 'electrical' || type2 === 'electrical';
  const e = electric ? FEEL.hitlagElectric : 1;
  let frames = Math.floor(clamp((dmg * FEEL.hitlagDmg + FEEL.hitlagBase) * hitlagMult * e, 0, FEEL.hitlagCap));
  if (ko) frames = Math.min(FEEL.hitlagCap, Math.floor(frames * FEEL.koHitlagMult));
  const factor = FEEL.hitlagPlayers[players];
  if (factor && frames > FEEL.hitlagPlayerMin) frames = Math.floor(frames * factor);
  return frames;
}

/**
 * startup / active / recovery from the existing duration and cooldown.
 * Total commitment (duration + cooldown) is unchanged; part of the cooldown
 * becomes visible endlag.
 */
export function frameData(durationMs, cooldownMs = 0, move = {}, stepMs = STEP_MS) {
  const durF = Math.max(1, Math.round((durationMs ?? stepMs) / stepMs));
  const coolF = Math.max(0, Math.round((cooldownMs ?? 0) / stepMs));
  let active = move.activeF ?? clamp(Math.round(durF * FEEL.activeFrac), FEEL.activeMin, FEEL.activeMax);
  let startup = move.startupF ?? Math.round(durF * FEEL.startupFrac);
  if (startup < 1) startup = 1;
  if (startup + active > durF) {
    active = Math.min(active, Math.max(1, durF - 1));
    startup = Math.max(1, durF - active);
  }
  const recoveryBase = Math.max(0, durF - startup - active);
  const extra = move.endlagF != null ? 0 : Math.min(coolF, FEEL.endlagFromCooldown);
  const recovery = move.endlagF ?? (recoveryBase + extra);
  const visible = startup + active + recovery;
  const total = durF + coolF;
  return { startup, active, recovery, visible, total, durF, coolF, extra };
}

/** Which cell of a 4–6 frame attack strip to show. `frame` is 0-based. */
export function stripIndex(count, fd, frame) {
  const n = Math.max(1, count | 0);
  const f = Math.max(0, frame | 0);
  const { startup, active, recovery } = fd;
  const last = n - 1;
  if (f < startup * 0.6) return 0;
  if (f < startup) return Math.min(1, last);
  if (f < startup + Math.min(2, active)) return Math.min(2, last);
  const contactEnd = startup + active + recovery * 0.35;
  if (f < contactEnd) return Math.min(3, last);
  if (n >= 6 && f >= startup + active + recovery * 0.8) return last;
  return Math.min(4, last);
}

/** 0–1 blend into idle over the last few recovery frames. */
export function idleBlend(fd, frame) {
  const end = fd.startup + fd.active + fd.recovery;
  const left = end - frame;
  if (left >= FEEL.idleBlendFrames || left < 0) return 0;
  const t = 1 - left / FEEL.idleBlendFrames;
  return t * t * (3 - 2 * t);
}

export function knockbackRaw(base, growth, percent, weight, scale) {
  const w = Math.max(weight || 1, 0.05);
  return ((base + percent * (growth ?? 0)) / w) * scale;
}

/** Smash-style units from the existing knockback number. */
export function smashUnits(kbRaw) {
  return Math.max(0, kbRaw) / FEEL.kbUnit;
}

export function hitstunFrames(units) {
  return Math.max(0, Math.floor(units * FEEL.hitstunPerUnit));
}

/** Radians, screen space (negative is up). `dir` is applied by the caller. */
export function launchAngle(move, grounded, units) {
  const deg = move?.angleDeg;
  if (deg === 361) {
    if (grounded && units < FEEL.sakuraiLow) return 0;
    return -FEEL.angleKinetic * Math.PI / 180;
  }
  if (move?.lift) return -FEEL.angleLift * Math.PI / 180;
  const use = deg ?? (move?.kind === 'burst' ? FEEL.angleBurst : FEEL.angleKinetic);
  return -use * Math.PI / 180;
}

/** px/s launch velocity. angle is the screen-space angle; dir is ±1. */
export function launchVelocity(units, angle, dir = 1) {
  const perFrame = units * FEEL.launchPerUnit * FEEL.pxPerUnit;
  const speed = perFrame * (1000 / STEP_MS);
  return {
    x: Math.cos(angle) * speed * (dir || 1),
    y: Math.sin(angle) * speed,
    speed,
  };
}

/** Rotate `angle` by at most diMaxDeg toward the stick's perpendicular. */
export function applyDI(angle, sx, sy, maxDeg = FEEL.diMaxDeg) {
  const mag = Math.hypot(sx, sy);
  if (mag < 0.2) return angle;
  const px = -Math.sin(angle);
  const py = Math.cos(angle);
  const along = (sx * px + sy * py) / mag;
  return angle + clamp(along, -1, 1) * (maxDeg * Math.PI / 180);
}

/** Decay a launch vector by one sim frame. Returns null when it is spent. */
export function decayLaunch(launch) {
  if (!launch) return null;
  let speed = Math.hypot(launch.x, launch.y);
  if (speed < 8) return null;
  let dec = FEEL.launchDecay * FEEL.pxPerUnit * (1000 / STEP_MS);
  if (launch.balloonLeft > 0) {
    dec *= FEEL.balloonDecay;
    launch.balloonLeft -= 1;
  }
  const next = Math.max(0, speed - dec);
  if (next <= 8) return null;
  const s = next / speed;
  launch.x *= s;
  launch.y *= s;
  return launch;
}

/**
 * True when the launch carries the fighter past a blast line.
 * Own vertical velocity takes gravity; the launch vector does not.
 */
export function leavesBlast(x, y, vx, vy, gravity, blast, frames = 100) {
  if (!blast) return false;
  let lx = vx;
  let ly = vy;
  let ownVy = 0;
  let px = x;
  let py = y;
  const dt = STEP_MS / 1000;
  for (let i = 0; i < frames; i++) {
    const spent = decayLaunch({ x: lx, y: ly, balloonLeft: 0 });
    lx = spent ? spent.x : 0;
    ly = spent ? spent.y : 0;
    ownVy += gravity * dt;
    px += lx * dt;
    py += (ly + ownVy) * dt;
    if (px < blast.left || px > blast.right || py > blast.bottom || py < blast.top) return true;
  }
  return false;
}

export function spring(cur, vel, target, dt) {
  const frames = Math.max(dt, 0) * (1000 / STEP_MS);
  const step = Math.max(dt, 1 / 240);
  vel += (target - cur) * FEEL.poseK * step;
  vel *= Math.pow(FEEL.poseDamp, frames || 1);
  cur += vel * step;
  return { cur, vel };
}

/** Pose targets. facing is ±1. phase is startup|active|recovery|idle. */
export function poseTarget(state, ctx) {
  const facing = ctx.facing || 1;
  const phase = ctx.phase;
  const neutral = { rot: 0, sx: 1, sy: 1, x: 0, y: 0 };
  if (state === 'jumpsquat' || ctx.landing) {
    return { rot: 0, sx: 1.14, sy: 0.86, x: 0, y: 4 };
  }
  if (state === 'jump') return { rot: -0.06 * facing, sx: 0.94, sy: 1.08, x: 0, y: 0 };
  if (state === 'fall') {
    if (Math.abs(ctx.vy || 0) < 120) return neutral;
    return { rot: 0.05 * facing, sx: 0.98, sy: 1.03, x: 0, y: 0 };
  }
  if (state === 'hurt') {
    if ((ctx.units || 0) > FEEL.tumbleAt) return { rot: ctx.spin || 0, sx: 1, sy: 1, x: 0, y: 0 };
    return { rot: 0.25 * (ctx.hurtSign || 1), sx: 1.06, sy: 0.94, x: 0, y: 0 };
  }
  if (state === 'ledge') return { rot: 0.35 * facing, sx: 1, sy: 1, x: 0, y: -6 };
  if (state === 'charging') {
    const pulse = 1 - 0.04 * Math.sin((ctx.t || 0) * 20);
    return { rot: -0.04 * facing, sx: 1.06, sy: pulse, x: -4 * facing, y: 2 };
  }
  if (state === 'defending') return { rot: 0, sx: 0.96, sy: 1 + Math.sin((ctx.t || 0) * 6) * 0.02, x: 0, y: 0 };
  if (state === 'attack') {
    if (phase === 'startup') return { rot: -0.08 * facing, sx: 1.08, sy: 0.92, x: -6 * facing, y: 0 };
    if (phase === 'active') return { rot: 0.10 * facing, sx: 0.96, sy: 1.06, x: 14 * facing, y: 0 };
    return { rot: 0, sx: 1, sy: 1, x: 0, y: 0 };
  }
  if (state === 'walk') {
    const s = Math.sin(ctx.step || 0);
    return { rot: s * 0.03 * facing, sx: 1, sy: 1, x: 0, y: -Math.abs(s) * 3 };
  }
  const bob = Math.sin((ctx.t || 0) * Math.PI);
  return { rot: 0, sx: 1, sy: 1 + bob * 0.015, x: 0, y: bob * 1.2 };
}

/** A press is still buffered when it is at most bufferFrames old. */
export function bufferFresh(nowFrame, pressFrame) {
  const age = nowFrame - pressFrame;
  return age >= 0 && age <= FEEL.bufferFrames;
}

/** Latest buffered press, priority special > attack > jump. */
export function takeBuffered(buffer, nowFrame) {
  const fresh = (buffer || []).filter((b) => bufferFresh(nowFrame, b.frame));
  for (const button of ['special', 'attack', 'jump']) {
    for (let i = fresh.length - 1; i >= 0; i--) {
      if (fresh[i].button === button) return fresh[i];
    }
  }
  return null;
}

export function attackPhase(fd, frame) {
  if (!fd) return 'idle';
  if (frame < fd.startup) return 'startup';
  if (frame < fd.startup + fd.active) return 'active';
  return 'recovery';
}

/** Trauma offset in world pixels, plus a small rotation. */
export function traumaOffset(trauma, timeSec, zoom, mode) {
  const scale = mode === 'off' ? 0 : mode === 'reduced' ? FEEL.traumaReduced : 1;
  const shake = trauma * trauma * scale;
  if (shake <= 0.0001) return { x: 0, y: 0, rot: 0 };
  const z = Math.max(zoom || 1, 0.2);
  const n1 = Math.sin(timeSec * 25) + 0.5 * Math.sin(timeSec * 53 + 1.7);
  const n2 = Math.cos(timeSec * 23) + 0.5 * Math.sin(timeSec * 47 + 0.4);
  // Divide by zoom so the shake occupies the same screen pixels near or far.
  return {
    x: (FEEL.traumaMax * shake * n1) / z,
    y: (FEEL.traumaMax * shake * n2 * 0.65) / z,
    rot: FEEL.traumaRot * shake * n1,
  };
}

export function traumaForHit(dmg, ko) {
  if (ko) return 0.7;
  if (!(dmg >= 10)) return 0;
  if (dmg > 18) return 0.45;
  return 0.25;
}

export function percentColor(percent) {
  const stops = [
    { p: 0, c: [255, 255, 255] },
    { p: 50, c: [255, 230, 80] },
    { p: 100, c: [255, 140, 40] },
    { p: 150, c: [255, 50, 50] },
  ];
  const p = Math.max(0, percent || 0);
  let i = 0;
  while (i < stops.length - 2 && p > stops[i + 1].p) i++;
  const a = stops[i];
  const b = stops[Math.min(i + 1, stops.length - 1)];
  const t = b.p === a.p ? 0 : clamp((p - a.p) / (b.p - a.p), 0, 1);
  const c = a.c.map((v, k) => Math.round(v + (b.c[k] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const TYPE_COLOR = {
  kinetic: 0xfff1c4,
  physical: 0xfff1c4,
  heat: 0xff6a1a,
  electrical: 0x6ec6ff,
  chemical: 0x4dff78,
  radiation: 0x7dffe0,
};
