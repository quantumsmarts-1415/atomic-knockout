// ---------------------------------------------------------------------------
// Colorways — hand-tuned hue remaps for raster fighter art.
//
// The old alternates tinted the whole sprite toward a flat color, which
// washed every cut toward white. A colorway instead rotates hue in HSV space
// on the GPU, so shading, outlines, and contrast survive untouched:
//   - hue      the rotation (data authors a *target* hue for the fighter's
//              dominant color; the shift is derived from that)
//   - sat/val  gentle saturation multiplier and a brightness nudge that only
//              touches colored pixels (greys, whites, and blacks stay put)
//   - protect  skin tones (a narrow warm band at moderate saturation) are
//              masked out so a blue jacket can turn crimson without turning
//              the face green
//   - tint     for fighters who are mostly grey/white, a soft colorize of the
//              low-saturation pixels so the alternate actually reads
//
// `shiftPixel` is the CPU mirror of the fragment shader. Tools use it to
// preview a colorway, the UI uses it for swatches, and the tests use it to
// pin the shader's behavior.
// ---------------------------------------------------------------------------

// Default skin band: warm hues (24° center, ±16°) below a saturation
// ceiling. Painted skin in this roster sits around S 0.4–0.7; hair, flame,
// and dyed cloth run hotter than that and fall outside the band.
export const SKIN_DEFAULT = { center: 24, width: 16, satMax: 0.88 };

export function hsvFromRgb(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max > 1e-6 ? d / max : 0, max];
}

export function rgbFromHsv(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (((i % 6) + 6) % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
const fract = (x) => x - Math.floor(x);

/**
 * Resolve an authored alternate into shader-ready numbers.
 * `base` and `alt.hue` are degrees; `skin` is 0..1 or a band object.
 */
export function resolveColorway(spec, alt) {
  if (!alt) return null;
  const base = spec.base ?? 0;
  const target = alt.hue ?? base;
  const shift = fract((target - base) / 360);
  const skinSpec = alt.skin ?? spec.skin ?? 1;
  let protect = 1;
  let band = SKIN_DEFAULT;
  if (typeof skinSpec === 'number') protect = clamp01(skinSpec);
  else if (skinSpec && typeof skinSpec === 'object') {
    protect = clamp01(skinSpec.strength ?? 1);
    band = { ...SKIN_DEFAULT, ...skinSpec };
  } else if (!skinSpec) protect = 0;
  const tint = alt.tint ?? spec.tint ?? null;
  return {
    hue: shift,
    sat: alt.sat ?? 1,
    val: alt.val ?? 0,
    protect,
    skinC: fract(band.center / 360),
    skinW: Math.max(0.001, band.width / 360),
    skinS: clamp01(band.satMax),
    tintH: tint ? fract(tint[0] / 360) : 0,
    tintA: tint ? clamp01(tint[1]) : 0,
  };
}

/** CPU mirror of the fragment shader. rgb in 0..1, returns 0..1. */
export function shiftPixel(rgb, cw) {
  if (!cw) return rgb;
  const [h, s, v] = hsvFromRgb(rgb[0], rgb[1], rgb[2]);
  const dh = Math.abs(fract(h - cw.skinC + 0.5) - 0.5);
  let skin = (1 - smoothstep(cw.skinW * 0.6, cw.skinW, dh))
    * smoothstep(0.08, 0.18, s) * (1 - smoothstep(cw.skinS - 0.14, cw.skinS, s))
    * smoothstep(0.12, 0.22, v);
  skin *= cw.protect;
  let sh = fract(h + cw.hue);
  let ss = clamp01(s * cw.sat);
  const sv = clamp01(v + cw.val * s);
  if (cw.tintA > 0) {
    const greyness = 1 - smoothstep(0.06, 0.20, s);
    const t = greyness * smoothstep(0.15, 0.35, v);
    sh = t > 0.5 ? cw.tintH : sh;
    ss = ss + (cw.tintA - ss) * t;
  }
  const out = rgbFromHsv(sh, ss, sv);
  return [
    out[0] + (rgb[0] - out[0]) * skin,
    out[1] + (rgb[1] - out[1]) * skin,
    out[2] + (rgb[2] - out[2]) * skin,
  ];
}

/** Hex swatch for a colorway: the fighter's base chip pushed through the same math. */
export function swatchFor(baseHex, cw) {
  const rgb = [(baseHex >> 16 & 255) / 255, (baseHex >> 8 & 255) / 255, (baseHex & 255) / 255];
  const out = shiftPixel(rgb, cw);
  return (Math.round(clamp01(out[0]) * 255) << 16) | (Math.round(clamp01(out[1]) * 255) << 8) | Math.round(clamp01(out[2]) * 255);
}
