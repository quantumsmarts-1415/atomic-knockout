// ---------------------------------------------------------------------------
// Colorway rendering — the WebGL pipeline that applies a colorway to a
// fighter sprite. Kept apart from engine/colorway.js (pure math) so data and
// tools can resolve colorways in Node without pulling Phaser in.
// ---------------------------------------------------------------------------
import * as Phaser from 'phaser';

export const COLORWAY_PIPELINE = 'AkColorway';

export const COLORWAY_FRAG = `
#define SHADER_NAME AK_COLORWAY_FS
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform float uHue;
uniform float uSat;
uniform float uVal;
uniform float uProtect;
uniform vec3 uSkin;
uniform vec2 uTint;
varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 colorway(vec3 rgb) {
  vec3 hsv = rgb2hsv(rgb);
  float dh = abs(fract(hsv.x - uSkin.x + 0.5) - 0.5);
  float skin = (1.0 - smoothstep(uSkin.y * 0.6, uSkin.y, dh))
    * smoothstep(0.08, 0.18, hsv.y) * (1.0 - smoothstep(uSkin.z - 0.14, uSkin.z, hsv.y))
    * smoothstep(0.12, 0.22, hsv.z);
  skin *= uProtect;
  vec3 shifted = vec3(fract(hsv.x + uHue), clamp(hsv.y * uSat, 0.0, 1.0), clamp(hsv.z + uVal * hsv.y, 0.0, 1.0));
  if (uTint.y > 0.0) {
    float greyness = 1.0 - smoothstep(0.06, 0.20, hsv.y);
    float t = greyness * smoothstep(0.15, 0.35, hsv.z);
    shifted.x = t > 0.5 ? uTint.x : shifted.x;
    shifted.y = mix(shifted.y, uTint.y, t);
  }
  return mix(hsv2rgb(shifted), rgb, skin);
}
void main() {
  vec4 texture = texture2D(uMainSampler, outTexCoord);
  if (texture.a > 0.002) {
    vec3 straight = clamp(texture.rgb / texture.a, 0.0, 1.0);
    texture.rgb = colorway(straight) * texture.a;
  }
  vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
  vec4 color = texture * texel;
  if (outTintEffect == 1.0) {
    color.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);
  } else if (outTintEffect == 2.0) {
    color = texel;
  }
  gl_FragColor = color;
}
`;

let PipelineClass = null;

/**
 * Register the colorway pipeline on a game once. Returns false when the
 * renderer is not WebGL (Canvas falls back to the standard look).
 */
export function ensureColorwayPipeline(game) {
  const renderer = game?.renderer;
  const pipelines = renderer?.pipelines;
  if (!pipelines?.add || !renderer?.gl) return false;
  if (pipelines.has(COLORWAY_PIPELINE)) return true;
  const SinglePipeline = Phaser?.Renderer?.WebGL?.Pipelines?.SinglePipeline;
  if (!SinglePipeline) return false;
  if (!PipelineClass) {
    PipelineClass = class ColorwayPipeline extends SinglePipeline {
      constructor(g) {
        super({ game: g, fragShader: COLORWAY_FRAG });
        this._cur = null;
      }

      // One batch per distinct colorway. Sprites sharing a colorway stay in
      // the same batch; a change flushes before the uniforms move.
      onBind(gameObject) {
        super.onBind?.(gameObject);
        const cw = gameObject?.colorway ?? null;
        if (cw === this._cur) return;
        this.flush();
        this._cur = cw;
        this.set1f('uHue', cw?.hue ?? 0);
        this.set1f('uSat', cw?.sat ?? 1);
        this.set1f('uVal', cw?.val ?? 0);
        this.set1f('uProtect', cw?.protect ?? 0);
        this.set3f('uSkin', cw?.skinC ?? 0, cw?.skinW ?? 0.001, cw?.skinS ?? 0.88);
        this.set2f('uTint', cw?.tintH ?? 0, cw?.tintA ?? 0);
      }

      onBoot() {
        super.onBoot?.();
        this._cur = null;
      }
    };
  }
  pipelines.add(COLORWAY_PIPELINE, new PipelineClass(game));
  return true;
}

/** Route a sprite through the colorway pipeline (or back to normal). */
export function applyColorway(sprite, cw) {
  if (!sprite?.setPipeline) return;
  if (!cw) {
    sprite.colorway = null;
    if (sprite.pipeline?.name === COLORWAY_PIPELINE) sprite.resetPipeline?.();
    return;
  }
  const game = sprite.scene?.game;
  if (!ensureColorwayPipeline(game)) return;
  sprite.colorway = cw;
  sprite.setPipeline(COLORWAY_PIPELINE);
}
