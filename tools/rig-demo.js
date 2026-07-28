import { PARTS, ROOT } from './hydra-parts.js';

const SRC = '../art-src/hydra-cut.png';
const RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Slicing — done live in the browser off the single render. Each part gets its
// polygon masked out (with a soft edge so cuts don't alias), then cropped to
// its bounding box. Pivots are rebased into the cropped image's coordinates.
// ---------------------------------------------------------------------------

function slice(img, def) {
  const w = img.width;
  const h = img.height;

  const mask = document.createElement('canvas');
  mask.width = w; mask.height = h;
  const mc = mask.getContext('2d');
  mc.filter = 'blur(1.5px)';
  mc.fillStyle = '#fff';
  mc.beginPath();
  def.poly.forEach(([x, y], i) => (i ? mc.lineTo(x, y) : mc.moveTo(x, y)));
  mc.closePath();
  mc.fill();

  const full = document.createElement('canvas');
  full.width = w; full.height = h;
  const fc = full.getContext('2d');
  fc.drawImage(img, 0, 0);
  fc.globalCompositeOperation = 'destination-in';
  fc.drawImage(mask, 0, 0);

  // crop to the part's real extents
  const data = fc.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 6) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 1; } // empty polygon guard

  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  out.getContext('2d').drawImage(full, x0, y0, cw, ch, 0, 0, cw, ch);

  return { canvas: out, ox: x0, oy: y0 };
}

// Everything the polygons DIDN'T claim — mostly Hydra's big flame aura, which
// belongs to no limb. Without this it just disappears when the rig is
// assembled. Drawn as a static backdrop behind the parts so the silhouette
// still reads like the original render.
function sliceLeftover(img, defs) {
  const w = img.width;
  const h = img.height;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.filter = 'blur(2px)';
  ctx.fillStyle = '#fff';
  for (const def of Object.values(defs)) {
    ctx.beginPath();
    def.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }
  return { canvas: cv, ox: 0, oy: 0 };
}

// ---------------------------------------------------------------------------
// Rig — a tree of parts. Each part's "base" rotation is the difference between
// the angle it should rest at and the angle it was drawn at, which is what
// cancels the render's baked-in action pose. Animation adds on top of that.
// ---------------------------------------------------------------------------

export class Rig {
  constructor(img) {
    this.img = img;
    this.parts = {};
    for (const [name, def] of Object.entries(PARTS)) {
      const cut = slice(img, def);
      const drawn = Math.atan2(def.tip[1] - def.pivot[1], def.tip[0] - def.pivot[0]);
      this.parts[name] = {
        name, def, cut,
        base: def.neutral * RAD - drawn, // pose-cancelling correction
        rot: 0,                          // per-frame animation, radians
        children: [],
      };
    }
    this.roots = [];
    for (const p of Object.values(this.parts)) {
      if (p.def.parent) this.parts[p.def.parent].children.push(p);
      else this.roots.push(p);
    }
    // z-order is global, so a leading-side leg can sit in front of the torso
    // while its parent hangs off the root.
    this.order = Object.values(this.parts).sort((a, b) => a.def.z - b.def.z);
    this.leftover = sliceLeftover(img, PARTS);
    this.t = Math.random() * 10;
    this.attackSwing = 0;
  }

  // Absolute transform of every part, resolved parent-first.
  solve() {
    const out = {};
    const walk = (p, px, py, prot) => {
      const rot = prot + p.base + p.rot;
      const [jx, jy] = p.def.pivot;
      let x = px, y = py;
      if (p.def.parent) {
        // joint offset expressed inside the parent's un-rotated source frame
        const [ppx, ppy] = this.parts[p.def.parent].def.pivot;
        const dx = jx - ppx;
        const dy = jy - ppy;
        x = px + dx * Math.cos(prot) - dy * Math.sin(prot);
        y = py + dx * Math.sin(prot) + dy * Math.cos(prot);
      } else {
        x = jx - ROOT[0];
        y = jy - ROOT[1];
      }
      out[p.name] = { x, y, rot };
      for (const c of p.children) walk(c, x, y, rot);
    };
    for (const r of this.roots) walk(r, 0, 0, 0);
    return out;
  }

  draw(ctx, cx, cy, scale, opts = {}) {
    const tf = this.solve();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale * (opts.flip ? -1 : 1), scale);
    if (this.bodyScaleX || this.bodyScaleY) {
      ctx.scale(this.bodyScaleX ?? 1, this.bodyScaleY ?? 1);
    }
    ctx.translate(0, this.bodyOffsetY ?? 0);
    ctx.rotate(this.bodyRot ?? 0);

    if (opts.aura !== false) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      const { canvas, ox, oy } = this.leftover;
      ctx.drawImage(canvas, ox - ROOT[0], oy - ROOT[1]);
      ctx.restore();
    }

    for (const p of this.order) {
      const t = tf[p.name];
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      const { canvas, ox, oy } = p.cut;
      ctx.drawImage(canvas, ox - p.def.pivot[0], oy - p.def.pivot[1]);
      if (opts.showPivots) {
        ctx.fillStyle = '#ff2d6f';
        ctx.beginPath();
        ctx.arc(0, 0, 6 / scale + 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Animation. Mirrors the state machine already in src/engine/Rig.js so the
  // motion here is what the real game would produce.
  // -------------------------------------------------------------------------
  animate(dt, state) {
    this.t += dt;
    const t = this.t;
    const P = this.parts;
    const set = (n, v) => { P[n].rot = v; };

    this.bodyRot = 0;
    this.bodyOffsetY = 0;
    this.bodyScaleX = 1;
    this.bodyScaleY = 1;

    switch (state) {
      case 'walk': {
        const w = Math.sin(t * 9);
        const w2 = Math.sin(t * 9 - 0.8); // knees lag the hips
        set('thighFront', w * 0.62);
        set('shinFront', Math.max(0, -w2) * 0.85);
        set('thighBack', -w * 0.62);
        set('shinBack', Math.max(0, w2) * 0.85);
        set('upperArmFront', -w * 0.5);
        set('forearmFront', -0.35 + Math.max(0, -w) * 0.3);
        set('upperArmBack', w * 0.5);
        set('forearmBack', -0.35 + Math.max(0, w) * 0.3);
        set('torso', w * 0.035);
        set('head', -w * 0.03);
        this.bodyOffsetY = -Math.abs(Math.cos(t * 9)) * 7;
        break;
      }
      case 'jump': {
        set('thighFront', -0.5); set('shinFront', 0.75);
        set('thighBack', 0.3); set('shinBack', 0.5);
        set('upperArmFront', -1.9); set('forearmFront', -0.7);
        set('upperArmBack', 1.7); set('forearmBack', -0.5);
        set('torso', -0.05); set('head', 0.05);
        this.bodyScaleY = 1.06; this.bodyScaleX = 0.95;
        break;
      }
      case 'fall': {
        set('thighFront', 0.3); set('shinFront', 0.35);
        set('thighBack', -0.25); set('shinBack', 0.5);
        set('upperArmFront', -0.9); set('forearmFront', -0.9);
        set('upperArmBack', 0.85); set('forearmBack', -0.8);
        set('torso', 0.05);
        this.bodyScaleY = 0.97;
        break;
      }
      case 'attack': {
        const s = Math.sin(this.attackSwing * Math.PI);
        const wind = Math.sin(Math.min(this.attackSwing, 0.25) * 4 * Math.PI * 0.5);
        set('upperArmFront', -0.35 + wind * 0.5 - s * 1.9);
        set('forearmFront', -0.9 + s * 1.5);
        set('upperArmBack', 0.3 + s * 0.7);
        set('forearmBack', -0.3 - s * 0.4);
        set('torso', -s * 0.2);
        set('head', s * 0.12);
        set('thighFront', s * 0.22);
        set('shinFront', 0);
        set('thighBack', -s * 0.28);
        set('shinBack', s * 0.3);
        this.bodyOffsetY = -s * 2;
        break;
      }
      case 'hurt': {
        set('upperArmFront', 1.2); set('forearmFront', -0.9);
        set('upperArmBack', -1.1); set('forearmBack', -0.8);
        set('thighFront', 0.45); set('shinFront', 0.4);
        set('thighBack', -0.5); set('shinBack', 0.6);
        set('torso', 0.18); set('head', 0.25);
        this.bodyScaleX = 1.07; this.bodyScaleY = 0.93;
        break;
      }
      case 'ko': {
        this.bodyRot = (this.bodyRot ?? 0);
        this.koRot = (this.koRot ?? 0) + dt * 12;
        this.bodyRot = this.koRot;
        set('upperArmFront', -1.6); set('forearmFront', -0.6);
        set('upperArmBack', 1.6); set('forearmBack', -0.6);
        set('thighFront', -0.35); set('shinFront', 0.7);
        set('thighBack', 0.35); set('shinBack', 0.7);
        set('torso', 0.1); set('head', -0.15);
        break;
      }
      case 'idle':
      default: {
        const bob = Math.sin(t * 3.2);
        const breathe = Math.sin(t * 3.2 - 0.5);
        set('thighFront', 0); set('shinFront', 0);
        set('thighBack', 0); set('shinBack', 0);
        set('upperArmFront', bob * 0.05 - 0.06);
        set('forearmFront', -0.25 + breathe * 0.07);
        set('upperArmBack', -bob * 0.05 + 0.06);
        set('forearmBack', -0.25 - breathe * 0.07);
        set('torso', bob * 0.012);
        set('head', -bob * 0.025);
        this.bodyOffsetY = bob * 2.2;
        this.bodyScaleY = 1 + bob * 0.008;
        break;
      }
    }
    if (state !== 'ko') this.koRot = 0;
  }
}

// ---------------------------------------------------------------------------
// The single-image puppet the game uses today, replicated for side-by-side
// comparison (src/engine/Rig.js sprite mode).
// ---------------------------------------------------------------------------

export class SpritePuppet {
  constructor(img) { this.img = img; this.t = Math.random() * 10; this.attackSwing = 0; }

  animate(dt, state) {
    this.t += dt;
    const t = this.t;
    let sx = 1, sy = 1;
    this.dx = 0; this.dy = 0; this.rot = 0;
    switch (state) {
      case 'walk':
        this.dy = -Math.abs(Math.sin(t * 10)) * 4;
        this.rot = Math.sin(t * 10) * 0.035; break;
      case 'jump': this.rot = -0.06; sy = 1.05; sx = 0.96; break;
      case 'fall': this.rot = 0.045; sy = 0.97; break;
      case 'attack': {
        const s = Math.sin(this.attackSwing * Math.PI);
        this.rot = -s * 0.17; this.dx = s * 11; sx = 1 + s * 0.05; break;
      }
      case 'hurt': this.rot = 0.22; sx = 1.06; sy = 0.94; break;
      case 'ko': this.koRot = (this.koRot ?? 0) + dt * 14; this.rot = this.koRot; break;
      case 'idle':
      default: {
        const bob = Math.sin(t * 3.2);
        this.dy = bob * 2.2; this.rot = bob * 0.015; sy = 1 + bob * 0.008; break;
      }
    }
    if (state !== 'ko') this.koRot = 0;
    this.sx = sx; this.sy = sy;
  }

  draw(ctx, cx, cy, scale) {
    const img = this.img;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale * this.sx, scale * this.sy);
    ctx.translate(this.dx, this.dy);
    ctx.rotate(this.rot);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}

export function loadImage(src = SRC) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error(`could not load ${src}`));
    i.src = src;
  });
}

export { PARTS, ROOT };
