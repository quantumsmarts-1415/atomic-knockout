#!/usr/bin/env python3
"""Rebuild a Gemini idle sheet from raw video frames with an edge-connected
background key that keeps dark / gray bodies intact.

Why: the 2026-09-10 idle sheets (Sully, Phillip, Cal, Chloe, Aaron, Kyle...)
were keyed with a fixed colour threshold, which treated large parts of the
characters' own gray/dark armor as background and left speckled, mostly
transparent sprites.

Algorithm (per frame):
  1. Background model: fit a smooth quadratic surface per channel to the
     frame's border strip, so the gray vignette gradient is modeled instead
     of one sampled colour.
  2. Candidate background = close to the model (diff < --thresh) AND locally
     flat (Sobel gradient < --grad). The gradient gate stops the fill from
     tunneling through the character's ink outline.
  3. Connected-only: only candidate components touching the frame border are
     keyed. Enclosed candidates are kept unless they are big
     (>= --pocket-min px, e.g. the gap between the legs).
  4. Pocket fill: any transparent hole fully enclosed by the body that is
     smaller than --hole-max px is refilled (opaque), so shading grooves
     can't become pinholes.
  5. Despeckle: drop opaque islands smaller than --speck px (watermark,
     compression dots).
  6. Soft edge: 1-px alpha ramp on the silhouette boundary.
Then crop every frame to the union bbox (+pad) and pack it as a grid (cols =
ceil(sqrt(n))), the same layout as tools/build-sheet.js.

Usage: rekey_idle.py <framesDir> <out.png> --count N [--step 3] [options]
Prints the characters.js sheet fields (frameW, frameH, footY, visibleH).
"""
import argparse, glob, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def bg_model(rgb, strip):
    h, w, _ = rgb.shape
    yy, xx = np.mgrid[0:h, 0:w]
    m = np.zeros((h, w), bool)
    m[:strip] = m[-strip:] = True
    m[:, :strip] = m[:, -strip:] = True
    X = lambda x, y: np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], -1)
    xn, yn = xx / w - 0.5, yy / h - 0.5
    A = X(xn[m], yn[m])
    out = np.empty_like(rgb)
    for c in range(3):
        v = rgb[..., c][m]
        coef, *_ = np.linalg.lstsq(A, v, rcond=None)
        # one robust re-fit: drop border pixels that are not backdrop
        r = np.abs(A @ coef - v)
        keep = r < max(8.0, np.percentile(r, 80))
        coef, *_ = np.linalg.lstsq(A[keep], v[keep], rcond=None)
        out[..., c] = X(xn, yn) @ coef
    return out


def key_frame(rgb, a):
    rgb = rgb.astype(np.float32)
    model = bg_model(rgb, a.strip)
    diff = np.sqrt(((rgb - model) ** 2).sum(-1))
    lum = rgb.mean(-1)
    grad = np.hypot(ndi.sobel(lum, 0), ndi.sobel(lum, 1)) / 4.0
    cand = (diff < a.thresh) & (grad < a.grad)
    lab, n = ndi.label(cand)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(n + 1))
    keyed = np.isin(lab, border[border > 0])
    if a.pocket_min > 0:
        big = np.where(sizes >= a.pocket_min)[0]
        keyed |= np.isin(lab, big[big > 0])
    # grow keyed region through the soft anti-aliased fringe only
    fg = ~keyed
    # pocket fill: refill small enclosed transparent holes
    holes = ~fg & ndi.binary_fill_holes(fg)
    hl, hn = ndi.label(holes)
    if hn:
        hs = ndi.sum(holes, hl, index=np.arange(1, hn + 1))
        small = np.where(hs < a.hole_max)[0] + 1
        fg |= np.isin(hl, small)
    # despeckle
    fl, fn = ndi.label(fg)
    if fn:
        fs = ndi.sum(fg, fl, index=np.arange(1, fn + 1))
        keep = np.where(fs >= max(a.speck, a.keep_frac * fs.max()))[0] + 1
        fg = np.isin(fl, keep)
    alpha = fg.astype(np.float32)
    edge = fg & ~ndi.binary_erosion(fg)
    ramp = np.clip((diff - a.thresh * 0.5) / max(1.0, a.thresh), 0.35, 1.0)
    alpha[edge] = ramp[edge]
    out = np.dstack([rgb.clip(0, 255), alpha * 255]).astype(np.uint8)
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument('frames'); p.add_argument('out')
    p.add_argument('--count', type=int, required=True)
    p.add_argument('--start', type=int, default=0)
    p.add_argument('--step', type=int, default=3)
    p.add_argument('--thresh', type=float, default=22)
    p.add_argument('--grad', type=float, default=10)
    p.add_argument('--strip', type=int, default=12)
    p.add_argument('--pocket-min', type=int, default=1000)
    p.add_argument('--hole-max', type=int, default=1000)
    p.add_argument('--speck', type=int, default=400)
    p.add_argument('--keep-frac', type=float, default=0.02)
    p.add_argument('--pad', type=int, default=20)
    p.add_argument('--crop-bottom', type=int, default=0, help='ignore N px at the bottom (shadow/watermark row)')
    a = p.parse_args()
    files = sorted(glob.glob(os.path.join(a.frames, 'frame_*.png')))
    pick = [files[a.start + i * a.step] for i in range(a.count)]
    frames = [key_frame(np.array(Image.open(f).convert('RGB')), a) for f in pick]
    if a.crop_bottom:
        for f in frames: f[-a.crop_bottom:, :, 3] = 0
    H, W = frames[0].shape[:2]
    boxes = []
    for f in frames:
        ys, xs = np.nonzero(f[..., 3] > 10)
        boxes.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    x0 = max(0, min(b[0] for b in boxes) - a.pad); y0 = max(0, min(b[1] for b in boxes) - a.pad)
    x1 = min(W, max(b[2] for b in boxes) + a.pad); y1 = min(H, max(b[3] for b in boxes) + a.pad)
    fw, fh = x1 - x0, y1 - y0
    n = len(frames); cols = math.ceil(math.sqrt(n)); rows = math.ceil(n / cols)
    sheet = np.zeros((rows * fh, cols * fw, 4), np.uint8)
    foot = vis = 0
    for i, f in enumerate(frames):
        c = f[y0:y1, x0:x1]
        r, q = divmod(i, cols)
        sheet[r * fh:(r + 1) * fh, q * fw:(q + 1) * fw] = c
        ys = np.nonzero(c[..., 3] > 10)[0]
        foot += ys.max() + 1; vis += ys.max() + 1 - ys.min()
    Image.fromarray(sheet, 'RGBA').save(a.out, optimize=True)
    print(f'frameW: {fw}, frameH: {fh}, footY: {foot / n / fh:.4f}, visibleH: {round(vis / n)}, count: {n}')


if __name__ == '__main__':
    main()
