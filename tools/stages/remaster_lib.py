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


# --------------------------------------------------------------------------
# Generic chroma key (magenta / green / blue) used by remaster_stage.py.
# Unlike key_magenta (kept as-is so the Hydrogen integration reproduces), the
# key colour is SAMPLED from the image's own edge-connected background and
# smoothed into a per-pixel field, so off-shade or slightly graded keys (e.g.
# Neon Nexus' darker green mid) unmix correctly.
def _spill(a, kind):
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    if kind == 'magenta':
        return np.minimum(R, B) - G
    if kind == 'green':
        return G - np.maximum(R, B)
    if kind == 'blue':
        return B - np.maximum(R, G)
    raise ValueError(kind)


def _despill(F, kind, s_mask, strong=None):
    """Remove residual key tint. `strong` (0..1 per pixel) blends from the
    standard limit (key channel <= max of the others) to the average limit
    (key channel <= mean of the others), which turns Gemini's yellow-green /
    pink glow halos back into the warm or neutral glow they were meant to be."""
    F = F.copy()
    R, G, B = F[..., 0], F[..., 1], F[..., 2]
    st = 0 if strong is None else strong
    if kind == 'magenta':
        s = np.clip(np.minimum(R, B) - G, 0, None) * s_mask
        F[..., 0] -= s; F[..., 2] -= s
        if strong is not None:
            # translucent smoke/glow unmixed from magenta comes out salmon/
            # pink; pull it to a warm grey (B <= G, R <= 1.3 G + 15)
            R2, G2, B2 = F[..., 0], F[..., 1], F[..., 2]
            F[..., 0] = R2 - st * np.clip(R2 - (1.3 * G2 + 15), 0, None) * s_mask
            F[..., 2] = B2 - st * np.clip(B2 - G2, 0, None) * s_mask
    elif kind == 'green':
        lim = (1 - st) * np.maximum(R, B) + st * (R + B) / 2
        s = np.clip(G - lim, 0, None) * s_mask
        F[..., 1] -= s
    else:
        lim = (1 - st) * np.maximum(R, G) + st * (R + G) / 2
        s = np.clip(B - lim, 0, None) * s_mask
        F[..., 2] -= s
    return F


def key_chroma(rgb, kind, edge_band=10, interior_opaque_frac=1.0, flat_tol=45, glow_despill=False, glow_hue=None):
    """rgb uint8 HxWx3 -> (straight-alpha float RGBA HxWx4, stats).

    1. flat key = pixels within `flat_tol` of the sampled key colour; only the
       components touching the image border count as guaranteed background
    2. a smooth per-pixel key field K is built from that background
       (normalised Gaussian convolution) so gradients/vignettes are followed
    3. alpha from spill relative to K's spill (soft edges, smoke, glows, JPEG
       fringe are unmixed, like key_magenta). interior_opaque_frac < 1 keeps
       pixels deeper than `edge_band` inside a shape opaque unless strongly
       key-coloured (protects key-tinted paint, e.g. moss on a green key)
    4. unmix the colour against K, then despill near the edge and on every
       semi-transparent pixel (glow_despill: stronger on soft glow halos)."""
    a = rgb.astype(np.float64)
    sp = _spill(a, kind)
    border_px = np.concatenate([a[:3].reshape(-1, 3), a[-3:].reshape(-1, 3), a[:, :3].reshape(-1, 3), a[:, -3:].reshape(-1, 3)])
    bsp = _spill(border_px, kind)
    K0 = np.median(border_px[bsp > 0.5 * bsp.max()], 0)
    dist = np.sqrt(((a - K0) ** 2).sum(2))
    flat = dist < flat_tol
    lab, _ = nd.label(flat)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])
    sig = max(a.shape[:2]) / 40
    wts = nd.gaussian_filter(bg.astype(np.float64), sig)
    K = np.dstack([nd.gaussian_filter(a[..., i] * bg, sig) for i in range(3)]) / np.maximum(wts, 1e-6)[..., None]
    K[wts < 1e-3] = K0
    spK = np.maximum(_spill(K, kind), 40)
    araw = np.clip(1 - sp / (0.97 * spK), 0, 1)
    hue = sp > 12
    d_bg = nd.distance_transform_edt(~bg)
    interior = d_bg > edge_band
    a_int = np.clip(araw / interior_opaque_frac, 0, 1)
    alpha = np.where(hue, np.where(interior, a_int, araw), 1.0)
    # fade faint key-coloured haze to zero as it approaches the flat-key
    # tolerance, so smoke/glow does not end in a hard contour where the
    # edge-connected background starts
    ramp = np.clip((dist - flat_tol) / (1.5 * flat_tol), 0, 1)
    alpha = np.where(hue, alpha * np.maximum(ramp, alpha > 0.6), alpha)
    alpha[bg] = 0
    alpha[alpha < 0.06] = 0
    am = np.maximum(alpha, 1e-3)[..., None]
    F = np.clip((a - (1 - alpha)[..., None] * K) / am, 0, 255)
    strong = np.clip((0.99 - alpha) / 0.2, 0, 1) if glow_despill else None
    F = _despill(F, kind, ((d_bg < 2.4 * edge_band) | (alpha < 0.98)).astype(np.float64), strong)
    if glow_despill:
        # the faintest unmixed pixels have unreliable (over-amplified) colour:
        # fade their saturation out so glows end in a neutral wisp, not a rim
        wsat = np.clip(alpha / 0.35, 0, 1)[..., None]
        grey = F.mean(2, keepdims=True)
        F = np.where(alpha[..., None] > 0, F * wsat + grey * (1 - wsat), F)
    if glow_hue is not None:
        # Gemini paints warm glows/smoke over a green key as yellow-green
        # halos and over magenta as pink plumes. Within `band` px of the
        # background, rotate those key-tinted hues (green: 42-170 deg,
        # magenta: 280-12 deg, i.e. pink..salmon) to the glow's own hue, keeping sat/value.
        band, target = glow_hue
        h0, h1 = (42, 170) if kind == 'green' else (280, 372) if kind == 'magenta' else (170, 260)
        F = _rehue(F, (d_bg < band) & (alpha > 0), h0, h1, target)
    stats = {
        'key_kind': kind,
        'key_sampled_rgb': [int(round(v)) for v in K0],
        'bg_std': [round(float(v), 1) for v in a[bg].std(0)] if bg.any() else None,
        'bg_px_frac': round(float(bg.mean()), 3),
        'semi_transparent_px': int(((alpha > 0) & (alpha < 0.98)).sum()),
    }
    return np.dstack([F, alpha * 255]), stats


def _rehue(F, zone, h0, h1, target):
    r, g, b = [F[..., i] / 255 for i in range(3)]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn
    hue = np.zeros_like(mx)
    m = d > 1e-6
    rm = m & (mx == r); gm = m & (mx == g) & ~rm; bm = m & ~rm & ~gm
    hue[rm] = (60 * ((g - b)[rm] / d[rm])) % 360
    hue[gm] = 60 * ((b - r)[gm] / d[gm]) + 120
    hue[bm] = 60 * ((r - g)[bm] / d[bm]) + 240
    if h1 > 360:   # range wraps through 0 deg
        hue = np.where(hue < h1 - 360, hue + 360, hue)
    sel = zone & m & (hue >= h0) & (hue <= h1)
    # smooth weight: full inside, fades over 10 deg at the range ends
    wgt = np.clip(np.minimum(hue - h0, h1 - hue) / 8, 0, 1) * sel
    v, sat = mx, np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    hh = target / 60.0
    i = np.floor(hh) % 6; f = hh - np.floor(hh)
    p_, q_, t_ = v * (1 - sat), v * (1 - sat * f), v * (1 - sat * (1 - f))
    table = {0: (v, t_, p_), 1: (q_, v, p_), 2: (p_, v, t_), 3: (p_, q_, v), 4: (t_, p_, v), 5: (v, p_, q_)}
    nr, ng, nb = table[int(i)]
    new = np.dstack([nr, ng, nb]) * 255
    return F * (1 - wgt[..., None]) + new * wgt[..., None]
