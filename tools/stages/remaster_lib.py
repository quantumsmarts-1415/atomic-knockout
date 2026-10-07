"""Helpers for integrating Gemini-remastered stage layers (see remaster_integrate.py).

Gemini returns opaque images (JPEG-derived PNGs, ~2x size, slightly different
aspect) with transparent areas painted as #FF00FF. We:
  * key magenta: edge-connected flat-magenta removal + spill-based alpha with
    colour unmixing against magenta (recovers semi-transparent glass/glow and
    removes the JPEG magenta fringe), plus a residual despill near the key edge
  * register to the original layer by mask matching (affine sx/sy/tx/ty that
    maximises alpha IoU), never a blind stretch
"""
import numpy as np
from PIL import Image
from scipy import ndimage as nd

MAG = np.array([252.0, 2.0, 250.0])


def key_magenta(rgb):
    """rgb uint8 HxWx3 -> (rgba float HxWx4 with straight colour, stats)."""
    a = rgb.astype(np.float64)
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    flat = (R > 170) & (B > 170) & (G < 90) & (np.abs(R - B) < 70)
    lab, _ = nd.label(flat)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    enclosed_flat = flat & ~bg
    # spill-based alpha for magenta-hued pixels (fringe, glass over magenta)
    spill = np.minimum(R, B) - G
    hue = (R > G + 20) & (B > G + 20) & (np.abs(R - B) < 0.45 * np.maximum(R, B) + 10)
    alpha = np.where(hue, np.clip(1 - spill / 245.0, 0, 1), 1.0)
    alpha[bg] = 0
    alpha[alpha < 0.06] = 0
    am = np.maximum(alpha, 1e-3)[..., None]
    F = np.clip((a - (1 - alpha)[..., None] * MAG) / am, 0, 255)
    # residual despill: within ~24px (at 2x) of the key edge, and on every
    # semi-transparent pixel (glow halos / glass that sat over magenta)
    near = (nd.distance_transform_edt(~bg) < 24) | (alpha < 0.98)
    s = np.clip(np.minimum(F[..., 0], F[..., 2]) - F[..., 1], 0, None) * near
    F[..., 0] -= s
    F[..., 2] -= s
    interior_hue = hue & ~bg & (nd.distance_transform_edt(~bg) > 6) & (alpha < 0.9)
    stats = {
        'bg_std': [round(float(v), 1) for v in a[bg].std(0)] if bg.any() else None,
        'enclosed_flat_px': int(enclosed_flat.sum()),
        'interior_unmixed_px': int(interior_hue.sum()),
    }
    return np.dstack([F, alpha * 255]), stats


def premul_resize(rgba, size):
    """Resize straight-alpha float RGBA with premultiplication (no dark halos)."""
    al = rgba[..., 3:4] / 255.0
    pm = np.dstack([rgba[..., :3] * al, rgba[..., 3:4]])
    chans = [np.asarray(Image.fromarray(pm[..., i].astype(np.float32), 'F').resize(size, Image.LANCZOS)) for i in range(4)]
    out = np.dstack(chans).astype(np.float64)
    out[..., 3] = np.clip(out[..., 3], 0, 255)
    al2 = np.maximum(out[..., 3:4] / 255.0, 1e-4)
    out[..., :3] = np.clip(out[..., :3] / al2, 0, 255)
    out[out[..., 3] < 1] = 0
    return out


def affine_warp(img, sx, sy, tx, ty, out_shape, order=3):
    """dst(p) = src((p - t) / s), per channel; img HxW or HxWxC."""
    def one(ch):
        return nd.affine_transform(ch, [1 / sy, 1 / sx], offset=[-ty / sy, -tx / sx],
                                   output_shape=out_shape, order=order, mode='constant', cval=0.0)
    if img.ndim == 2:
        return one(img)
    return np.dstack([one(img[..., i]) for i in range(img.shape[2])])


def iou(a, b):
    a = a > 0.5
    b = b > 0.5
    u = (a | b).sum()
    return float((a & b).sum() / u) if u else 1.0


def bbox(m):
    ys, xs = np.nonzero(m)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def register(src_alpha, dst_alpha, allow_aniso=0.08, max_shift=60):
    """Affine (sx, sy, tx, ty) mapping src -> dst (same canvas size) maximising
    IoU of alpha>0.5 masks. bbox-to-bbox init, then coordinate descent at half
    resolution. allow_aniso bounds |sx/sy - 1|."""
    sm = src_alpha > 0.5 * 255 if src_alpha.max() > 1 else src_alpha > 0.5
    dm = dst_alpha > 0.5 * 255 if dst_alpha.max() > 1 else dst_alpha > 0.5
    H, W = dm.shape
    h = 2
    s_small = sm[::h, ::h].astype(float)
    d_small = dm[::h, ::h]

    def score(p):
        sx, sy, tx, ty = p
        w = affine_warp(s_small, sx, sy, tx / h, ty / h, d_small.shape, order=1)
        return iou(w, d_small)

    x0, y0, x1, y1 = bbox(sm)
    X0, Y0, X1, Y1 = bbox(dm)
    sx = (X1 - X0) / (x1 - x0)
    sy = (Y1 - Y0) / (y1 - y0)
    m = np.sqrt(sx * sy)
    sx = np.clip(sx, m * (1 - allow_aniso), m * (1 + allow_aniso))
    sy = np.clip(sy, m * (1 - allow_aniso), m * (1 + allow_aniso))
    p = [sx, sy, X0 - x0 * sx, Y0 - y0 * sy]
    cands = [[1.0, 1.0, 0.0, 0.0], p]
    best = max(cands, key=score)
    bs = score(best)
    steps = [0.02, 8.0]
    while steps[1] >= 1.0:
        improved = False
        for i in range(4):
            st = steps[0] if i < 2 else steps[1]
            for d in (-st, st):
                q = list(best)
                q[i] += d
                if abs(q[0] / q[1] - 1) > allow_aniso + 1e-9 or abs(q[2]) > max_shift * 3 or abs(q[3]) > max_shift * 3:
                    continue
                sc = score(q)
                if sc > bs + 1e-5:
                    best, bs, improved = q, sc, True
        if not improved:
            steps = [steps[0] / 2, steps[1] / 2]
    return best, bs
