"""Tiny procedural 'painting' toolkit for stage backgrounds (numpy + PIL).

Layers are float32 RGBA arrays in [0,1], straight alpha, shape (H, W, 4).
Everything is drawn supersampled (SS) and box-filtered down for clean
anti-aliased edges, then softened with blur / noise / grading so the result
reads painted rather than vector.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 2


def hexc(c, a=1.0):
    if isinstance(c, str):
        c = int(c.lstrip('#'), 16)
    return np.array([(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255, a], np.float32)


def layer(w, h):
    return np.zeros((h, w, 4), np.float32)


def vgrad(w, h, stops):
    """stops: [(t, color)], t in 0..1 top->bottom. Opaque layer."""
    t = np.linspace(0, 1, h)[:, None]
    out = np.zeros((h, w, 4), np.float32)
    ts = [s[0] for s in stops]
    cs = np.array([hexc(s[1]) for s in stops])
    for ch in range(3):
        col = np.interp(t[:, 0], ts, cs[:, ch])
        out[..., ch] = col[:, None]
    out[..., 3] = 1
    return out


def fbm(w, h, scale=200, octaves=5, seed=0, persistence=0.5):
    rng = np.random.default_rng(seed)
    acc = np.zeros((h, w), np.float32)
    amp, tot, s = 1.0, 0.0, scale
    for _ in range(octaves):
        gw, gh = max(2, int(w / s) + 2), max(2, int(h / s) + 2)
        g = rng.random((gh, gw)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((int(gw * s), int(gh * s)), Image.BICUBIC)
        acc += amp * (np.asarray(im, np.float32)[:h, :w] / 255)
        tot += amp
        amp *= persistence
        s /= 2
    return acc / tot


def mask(w, h, draw_fn, blur=0.0):
    """draw_fn(draw, s) draws white shapes; coordinates are multiplied by s."""
    im = Image.new('L', (w * SS, h * SS), 0)
    d = ImageDraw.Draw(im)
    draw_fn(d, SS)
    im = im.resize((w, h), Image.BOX)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im, np.float32) / 255


def blur(a, r):
    if r <= 0:
        return a
    if a.ndim == 2:
        im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
        return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255
    out = np.empty_like(a)
    for c in range(a.shape[2]):
        out[..., c] = blur(a[..., c], r)
    return out


def fill(dst, m, color, alpha=1.0):
    """Paint color (rgb array/hex or HxWx3 array) through mask m (0..1)."""
    if not isinstance(color, np.ndarray) or color.ndim == 1:
        c = hexc(color) if not isinstance(color, np.ndarray) else color
        rgb = c[:3][None, None, :]
    else:
        rgb = color[..., :3]
    a = (m * alpha)[..., None]
    da = dst[..., 3:4]
    oa = a + da * (1 - a)
    with np.errstate(invalid='ignore', divide='ignore'):
        dst[..., :3] = np.where(oa > 1e-6, (rgb * a + dst[..., :3] * da * (1 - a)) / np.maximum(oa, 1e-6), dst[..., :3])
    dst[..., 3:4] = oa
    return dst


def add_light(dst, m, color, k=1.0):
    """Additive light (screen-ish) -- for opaque layers or to brighten paint."""
    c = hexc(color)[:3]
    g = (m * k)[..., None]
    dst[..., :3] = 1 - (1 - dst[..., :3]) * (1 - np.clip(c * g, 0, 1))
    return dst


def glow(dst, m, color, radius, k=1.0, alpha_too=True):
    """Soft light halo. On transparent layers the halo itself becomes
    visible paint (tinted, alpha = halo strength); on painted pixels it
    brightens additively."""
    g = np.clip(blur(m, radius) * k * 2.2, 0, 1)
    add_light(dst, g * 0.8, color, 1.0)
    if alpha_too:
        gl = np.zeros_like(dst)
        gl[..., :3] = hexc(color)[:3]
        gl[..., 3] = np.clip(g * 0.85, 0, 1) * (1 - dst[..., 3])
        a = dst[..., 3:4]
        oa = a + gl[..., 3:4]
        dst[..., :3] = np.where(oa > 1e-6, (dst[..., :3] * a + gl[..., :3] * gl[..., 3:4]) / np.maximum(oa, 1e-6), dst[..., :3])
        dst[..., 3:4] = np.clip(oa, 0, 1)
    return dst


def over(dst, src):
    a = src[..., 3:4]
    da = dst[..., 3:4]
    oa = a + da * (1 - a)
    dst[..., :3] = np.where(oa > 1e-6, (src[..., :3] * a + dst[..., :3] * da * (1 - a)) / np.maximum(oa, 1e-6), 0)
    dst[..., 3:4] = oa
    return dst


def shade(dst, m, k):
    """Multiply rgb by (1 + k*m); k<0 darkens."""
    dst[..., :3] = np.clip(dst[..., :3] * (1 + k * m[..., None]), 0, 1)
    return dst


def grain(dst, amount=0.025, seed=1, scale=1.6):
    n = fbm(dst.shape[1], dst.shape[0], scale=scale * 4, octaves=2, seed=seed) - 0.5
    dst[..., :3] = np.clip(dst[..., :3] + n[..., None] * amount * 2, 0, 1)
    return dst


def brushwork(dst, amount=0.06, seed=3):
    """Low-frequency value variation that reads like soft brush strokes."""
    h, w = dst.shape[:2]
    n = fbm(w, h, scale=90, octaves=4, seed=seed) - 0.5
    streak = fbm(w, h, scale=40, octaves=2, seed=seed + 9)
    streak = streak - 0.5
    dst[..., :3] = np.clip(dst[..., :3] * (1 + (n * 0.9 + streak * 0.35)[..., None] * amount * 2), 0, 1)
    return dst


def haze(dst, y0, y1, color, k=0.6):
    """Atmospheric haze band (stronger toward y1)."""
    h, w = dst.shape[:2]
    t = np.clip((np.arange(h) - y0) / max(1, (y1 - y0)), 0, 1)[:, None]
    t = t * t * (3 - 2 * t)
    c = hexc(color)[:3]
    m = (t * k)
    dst[..., :3] = dst[..., :3] * (1 - m[..., None]) + c * m[..., None]
    return dst


def rays(w, h, origin, angles, width_deg, length, seed=0):
    """Soft light-shaft mask fanning from origin."""
    def fn(d, s):
        ox, oy = origin
        for a in angles:
            a0, a1 = math.radians(a - width_deg / 2), math.radians(a + width_deg / 2)
            pts = [(ox * s, oy * s),
                   ((ox + math.cos(a0) * length) * s, (oy + math.sin(a0) * length) * s),
                   ((ox + math.cos(a1) * length) * s, (oy + math.sin(a1) * length) * s)]
            d.polygon(pts, fill=255)
    m = mask(w, h, fn, blur=18)
    yy = np.linspace(0, 1, h)[:, None]
    return m * (1 - yy * 0.7)


def grade(dst, lift=0.0, gamma=1.0, sat=1.0, tint=None, tint_k=0.0):
    rgb = dst[..., :3]
    rgb = np.clip(rgb * (1 - lift) + lift, 0, 1) ** gamma
    lum = (rgb @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    rgb = np.clip(lum + (rgb - lum) * sat, 0, 1)
    if tint is not None:
        rgb = rgb * (1 - tint_k) + hexc(tint)[:3] * tint_k
    dst[..., :3] = rgb
    return dst


def vignette(dst, k=0.35):
    h, w = dst.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    m = np.clip((d - 0.6) / 0.8, 0, 1)
    return shade(dst, m, -k)


def save(a, path):
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(path, optimize=True)


def lerp(a, b, t):
    return a + (b - a) * t


def scatter(rng, n, x0, x1, y0, y1):
    return [(rng.uniform(x0, x1), rng.uniform(y0, y1)) for _ in range(n)]


def save_jpg(a, path, quality=90):
    Image.fromarray((np.clip(a[..., :3], 0, 1) * 255 + 0.5).astype(np.uint8), 'RGB').save(path, quality=quality)
