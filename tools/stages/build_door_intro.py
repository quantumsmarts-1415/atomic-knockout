"""Build the Hydrogen Breakout match-intro blast doors from the rejected Gemini
near layer (bulkhead doors) -> art-src/stages/hydrogen-breakout/intro_door_{left,right}.png

  python3 tools/stages/build_door_intro.py

Gemini's doors only cover ~350px of each screen edge (plus the hatch), so each
closed door (640x720, the doors meet at x=640) is completed with an inner slab
tiled from the door's own riveted rib texture (crossfaded seams), a weathered
hazard-stripe edge at the centre seam, and matching floor mist. Everything
is opaque, so the closed doors cover the full 1280x720 screen with no gaps.
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(__file__))
from remaster_lib import key_magenta, premul_resize
from paintlib import fbm

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
RAW = '/workspace/stage-remaster/hydrogen-breakout/remastered/near.png'
OUT = os.path.join(ROOT, 'art-src/stages/hydrogen-breakout/')
W, H = 640, 720
HAZ = 30  # hazard edge width


def tile(patch, w, h, xf=14, yf=90):
    """Tile an RGB float patch to (h, w) with linear crossfades at the seams."""
    ph, pw = patch.shape[:2]
    def run(arr, n, axis, f):
        step = arr.shape[axis] - f
        reps = int(np.ceil((n - f) / step)) + 1
        out = np.take(arr, range(arr.shape[axis]), axis=axis)
        for _ in range(reps):
            a = np.moveaxis(out, axis, 0); b = np.moveaxis(arr, axis, 0)
            ramp = np.linspace(0, 1, f).reshape((f,) + (1,) * (a.ndim - 1))
            blend = a[-f:] * (1 - ramp) + b[:f] * ramp
            out = np.moveaxis(np.concatenate([a[:-f], blend, b[f:]], 0), 0, axis)
        return np.take(out, range(n), axis=axis)
    return run(run(patch, w, 1, xf), h, 0, yf)


def hazard(h, w, flip, seed):
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    d = (xx * (-1 if flip else 1) + yy) / (w * 1.25)
    stripe = (np.floor(d) % 2 == 0)
    # soft-edged stripes
    frac = d - np.floor(d)
    edge = np.clip(np.minimum(frac, 1 - frac) * 40, 0, 1)
    yel = np.array([178, 138, 40.0]); blk = np.array([24, 24, 27.0])
    col = np.where(stripe[..., None], yel, blk)
    col = col * (0.75 + 0.25 * edge[..., None])
    g = fbm(w, h, scale=24, octaves=5, seed=seed)  # grime/wear
    wear = np.clip((g - 0.45) * 2.5, 0, 1)[..., None]
    col = col * (1 - 0.55 * wear) + np.array([70, 66, 60.0]) * 0.55 * wear
    # metal bevel: highlight on the outer side, dark lip at the seam
    x = xx / (w - 1)
    if flip:
        x = 1 - x
    shade = 1.0 + 0.35 * np.exp(-((x - 0.06) / 0.05) ** 2) - 0.55 * np.clip((x - 0.85) / 0.15, 0, 1)
    return np.clip(col * shade[..., None], 0, 255)


def build(side):
    raw = np.array(Image.open(RAW).convert('RGB'))
    half = raw.shape[1] // 2
    piece_raw = raw[:, :half] if side == 'left' else raw[:, half:]
    k, _ = key_magenta(piece_raw)
    s = H / raw.shape[0]
    piece = premul_resize(k, (int(round(piece_raw.shape[1] * s)), H))
    # keep the outer 640px (Gemini's art only reaches ~580px incl. the hatch)
    piece = piece[:, :W] if side == 'left' else piece[:, -W:]
    pw = piece.shape[1]
    # rib texture patch from the door's riveted vertical ribs (below the pipe,
    # above the floor mist), in the 2x source then scaled
    if side == 'left':
        patch = k[480:1180, 430:660, :3]
    else:
        patch = k[480:1180, -660:-430, :3]
    patch = premul_resize(np.dstack([patch, np.full(patch.shape[:2], 255.0)]), (int(patch.shape[1] * s), int(patch.shape[0] * s)))[..., :3]
    slab = tile(patch, W, H)
    # slab sits a touch darker than the frame (recessed) with a top-down falloff
    yy = np.linspace(0, 1, H)[:, None, None]
    slab = slab * (0.78 + 0.1 * yy)
    canvas = slab.copy()
    # place Gemini's door piece at the outer edge, over the slab
    a = piece[..., 3:4] / 255
    if side == 'left':
        canvas[:, :pw] = piece[..., :3] * a + canvas[:, :pw] * (1 - a)
    else:
        canvas[:, W - pw:] = piece[..., :3] * a + canvas[:, W - pw:] * (1 - a)
    # drop shadow of the piece's inner edge onto the slab (depth)
    m = np.zeros((H, W))
    if side == 'left':
        m[:, :pw] = piece[..., 3] / 255
        sh = nd.shift(nd.gaussian_filter(m, 6), (0, 8), order=1)
    else:
        m[:, W - pw:] = piece[..., 3] / 255
        sh = nd.shift(nd.gaussian_filter(m, 6), (0, -8), order=1)
    canvas = canvas * (1 - 0.45 * np.clip(sh - m, 0, 1))[..., None]
    # hazard edge at the seam
    hz = hazard(H, HAZ, side == 'right', seed=11 if side == 'left' else 12)
    if side == 'left':
        canvas[:, W - HAZ:] = hz
        canvas[:, W - HAZ - 3:W - HAZ] *= 0.45   # groove between slab and edge
    else:
        canvas[:, :HAZ] = hz
        canvas[:, HAZ:HAZ + 3] *= 0.45
    # floor mist continuing the door art's own fog across the slab
    g = fbm(W, H, scale=90, octaves=4, seed=5 if side == 'left' else 6)
    mist = np.clip((yy[..., 0] - 0.78) / 0.22, 0, 1) * (0.25 + 0.35 * g)
    canvas = canvas * (1 - mist[..., None]) + np.array([150, 175, 190.0]) * mist[..., None]
    out = np.dstack([np.clip(canvas, 0, 255), np.full((H, W), 255.0)])
    Image.fromarray(out.astype(np.uint8), 'RGBA').convert('RGB').save(OUT + f'intro_door_{side}.jpg', quality=90)
    return out


if __name__ == '__main__':
    L = build('left'); R = build('right')
    full = np.concatenate([L, R], 1)
    assert full.shape[:2] == (720, 1280) and full[..., 3].min() == 255, 'closed doors must fully cover the screen'
    Image.fromarray(full[..., :3].astype(np.uint8)).save('/workspace/stage-remaster/hydrogen-breakout/doors_closed.png')
    print('ok: doors cover 1280x720, alpha min', full[..., 3].min())
