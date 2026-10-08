"""Integrate the Gemini remaster of Hydrogen Breakout into art-src/stages/hydrogen-breakout.

  python3 tools/stages/remaster_hydrogen.py [--report out.json]

Inputs : /workspace/stage-remaster/hydrogen-breakout/remastered/{sky,far,mid,near,terrain}.png
Writes : art-src/stages/hydrogen-breakout/{sky.jpg,far.png,mid.png,terrain.png} (+ thumb/preview)
Layers whose layout drifted too far keep the original art (see DECISIONS).
"""
import json, os, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(__file__))
from remaster_lib import key_magenta, premul_resize, affine_warp, iou, register

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = '/workspace/stage-remaster/hydrogen-breakout/remastered/'
OUT = os.path.join(ROOT, 'art-src/stages/hydrogen-breakout/')
BACKUP = '/workspace/stage-remaster/hydrogen-breakout/originals/'
if not os.path.exists('/tmp/stages.json'):
    import subprocess
    subprocess.run(['node', '-e', "import('%s/src/data/stages.js').then(m=>require('fs').writeFileSync('/tmp/stages.json',JSON.stringify(m.STAGES)))" % ROOT], check=True)
STAGE = next(s for s in json.load(open('/tmp/stages.json')) if s['id'] == 'hydrogen-breakout')
report = {}


def load_orig(name):
    return np.array(Image.open(BACKUP + name).convert('RGBA')).astype(np.float64)


def save_rgba(arr, path):
    Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(path, optimize=True)


# ----------------------------------------------------------------- sky (opaque)
def edges(gray):
    g = nd.gaussian_filter(gray, 1.5)
    return np.hypot(nd.sobel(g, 0), nd.sobel(g, 1))


def ncc(a, b):
    a = a - a.mean(); b = b - b.mean()
    return float((a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9))


def do_sky():
    o = np.array(Image.open(BACKUP + 'sky.jpg').convert('RGB')).astype(np.float64)
    H, W = o.shape[:2]
    r = np.array(Image.open(SRC + 'sky.png').convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float64)
    eo, er = edges(o.mean(2)[::2, ::2]), edges(r.mean(2)[::2, ::2])
    best, bs = [1.0, 1.0, 0.0, 0.0], ncc(eo, er)
    base = bs
    st = [0.02, 8.0]
    while st[1] >= 1:
        imp = False
        for i in range(4):
            for d in (-1, 1):
                q = list(best); q[i] += d * (st[0] if i < 2 else st[1])
                # must still cover the canvas (no empty border): s >= 1 and |t| small
                if q[0] < 1 or q[1] < 1 or q[0] > 1.08 or q[1] > 1.08:
                    continue
                if not (W * (1 - q[0]) <= q[2] <= 0 and H * (1 - q[1]) <= q[3] <= 0):
                    continue
                w = affine_warp(er, q[0], q[1], q[2] / 2, q[3] / 2, eo.shape, order=1)
                sc = ncc(eo, w)
                if sc > bs + 1e-4:
                    best, bs, imp = q, sc, True
        if not imp:
            st = [st[0] / 2, st[1] / 2]
    out = affine_warp(r, *best, (H, W), order=3)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT + 'sky.jpg', quality=90)
    report['sky'] = {'status': 'remastered', 'edge_ncc_stretch': round(base, 3), 'edge_ncc_registered': round(bs, 3),
                     'affine': [round(v, 3) for v in best]}


# ---------------------------------------------------------------- far (keyed)
def do_far():
    o = load_orig('far.png'); H, W = o.shape[:2]
    k, st = key_magenta(np.array(Image.open(SRC + 'far.png').convert('RGB')))
    s = premul_resize(k, (W, H))
    i0 = iou(s[..., 3] / 255, o[..., 3] / 255)
    p, i1 = register(s[..., 3], o[..., 3])
    if i1 > i0 + 0.005:
        s = affine_warp(s, *p, (H, W), order=3); s[..., 3] = np.clip(s[..., 3], 0, 255)
    else:
        p = [1, 1, 0, 0]
    save_rgba(s, OUT + 'far.png')
    report['far'] = {'status': 'remastered', 'iou_stretch': round(i0, 3), 'iou_final': round(max(i0, i1), 3),
                     'affine': [round(v, 3) for v in p], 'key': st}


# ------------------------------------------- mid: per-band uniform fit + tiling
def bands(alpha, thr=0.05):
    r = (alpha > 128).mean(1) > thr
    out, s0 = [], None
    for y, v in enumerate(r):
        if v and s0 is None: s0 = y
        if not v and s0 is not None: out.append((s0, y)); s0 = None
    if s0 is not None: out.append((s0, len(r)))
    return out


def tile_band(band, width, xfade=16):
    """Repeat a horizontally periodic band to `width` with a seam chosen where
    the content matches best, crossfading the seam."""
    h, w = band.shape[:2]
    lum = band[..., :3].mean(2) * band[..., 3] / 255
    best = None
    for P in range(int(w * 0.55), w - xfade - 2):
        for x0 in range(0, w - P - xfade, 4):
            c = np.abs(lum[:, x0:x0 + xfade] - lum[:, x0 + P:x0 + P + xfade]).mean()
            if best is None or c < best[0]:
                best = (c, P, x0)
    _, P, x0 = best
    reps = []
    tile = band[:, x0:x0 + P + xfade].copy()
    out = np.zeros((h, width + P + xfade, 4))
    x = 0
    while x < width:
        seg = tile.copy()
        if x > 0:   # crossfade the first xfade columns with the previous tile's tail
            wgt = np.linspace(0, 1, xfade)[None, :, None]
            seg[:, :xfade] = out[:, x:x + xfade] * (1 - wgt) + seg[:, :xfade] * wgt
        out[:, x:x + P + xfade] = seg
        reps.append(x)
        x += P
    return out[:, :width], {'period_px': P, 'seam_cost': round(float(best[0]), 2), 'tiles': len(reps)}


def do_mid():
    o = load_orig('mid.png'); H, W = o.shape[:2]
    k, st = key_magenta(np.array(Image.open(SRC + 'mid.png').convert('RGB')))
    sx_full = k.shape[1] / W
    stretch = premul_resize(k, (W, H))
    i_stretch = iou(stretch[..., 3] / 255, o[..., 3] / 255)
    ob = bands(o[..., 3]); rb = bands(stretch[..., 3])
    # merge the original's two pipe bands (pipe + rail under it) into one
    ob = [ob[0], (ob[1][0], ob[-1][1])]
    out = np.zeros((H, W, 4)); fit = []
    for (oy0, oy1), (ry0, ry1) in zip(ob, rb):
        s = (oy1 - oy0) / (ry1 - ry0)          # uniform scale vs stretch coords
        fy0, fy1 = int(ry0 * k.shape[0] / H) - 8, int(ry1 * k.shape[0] / H) + 8
        crop = k[max(fy0, 0):fy1]
        bw = int(round(k.shape[1] / sx_full * s)); bh = int(round(crop.shape[0] / (k.shape[0] / H) * s))
        band = premul_resize(crop, (bw, bh))
        band_t, tinfo = tile_band(band, W)
        # place so the band's opaque extent lands on the original band
        rr = bands(band_t[..., 3], 0.05)
        top = oy0 - rr[0][0] if rr else oy0
        y0 = max(top, 0); y1 = min(top + bh, H)
        seg = band_t[y0 - top:y1 - top]
        a = seg[..., 3:4] / 255
        out[y0:y1, :, :3] = seg[..., :3] * a + out[y0:y1, :, :3] * (1 - a)
        out[y0:y1, :, 3] = np.maximum(out[y0:y1, :, 3], seg[..., 3])
        fit.append({'orig_band': [oy0, oy1], 'remaster_band': [ry0, ry1], 'uniform_scale': round(s, 3), **tinfo})
    i_fit = iou(out[..., 3] / 255, o[..., 3] / 255)
    save_rgba(out, OUT + 'mid.png')
    report['mid'] = {'status': 'remastered (per-band uniform fit + tiling)', 'iou_stretch': round(i_stretch, 3),
                     'iou_final': round(i_fit, 3), 'bands': fit, 'key': st}


# ----------------------------------------------------------------- near
def do_near():
    o = load_orig('near.png'); H, W = o.shape[:2]
    k, st = key_magenta(np.array(Image.open(SRC + 'near.png').convert('RGB')))
    s = premul_resize(k, (W, H))
    i0 = iou(s[..., 3] / 255, o[..., 3] / 255)
    p, i1 = register(s[..., 3], o[..., 3])
    cover_o = float((o[..., 3] > 128)[:, 80:1360].mean()); cover_r = float((s[..., 3] > 128)[:, 80:1360].mean())
    report['near'] = {'status': 'REJECTED - original kept', 'iou_stretch': round(i0, 3), 'iou_best_affine': round(i1, 3),
                      'on_screen_coverage_orig': round(cover_o, 3), 'on_screen_coverage_remaster': round(cover_r, 3),
                      'why': 'Gemini replaced the thin off-screen edge pillars + cables with huge bulkhead doors '
                             '(~360px wide each side) that would cover the outer ~22% of the screen in front of '
                             'the fighters; layout changed / objects added.', 'key': st}
    save_rgba(s, '/workspace/stage-remaster/hydrogen-breakout/rejected_near_keyed.png')


# ------------------------------------------------------------- terrain
def components(alpha, min_area):
    lab, _ = nd.label(nd.binary_dilation(alpha > 10, iterations=4))
    comps = []
    for i, sl in enumerate(nd.find_objects(lab)):
        solid = (alpha[sl] > 128) & (lab[sl] == i + 1)
        if solid.sum() < min_area:
            continue
        ys, xs = np.nonzero(solid)
        comps.append({'lab': i + 1, 'sl': sl, 'x0': sl[1].start + xs.min(), 'x1': sl[1].start + xs.max() + 1,
                      'y0': sl[0].start + ys.min(), 'y1': sl[0].start + ys.max() + 1, 'area': int(solid.sum())})
    return lab, comps


def lip_geometry(piece, oy0, oy1):
    """Perspective top face of a piece: back edge row t0, front-lip row t1 (first
    row reaching ~full width, i.e. where the trapezoid face meets the front
    face), and the lip row's x extent (the walkable span)."""
    m = piece[..., 3] > 128
    widths = m.sum(1)
    t0 = oy0
    wmax = widths[oy0:oy0 + max(8, int(0.45 * (oy1 - oy0)))].max()
    t1 = next(y for y in range(oy0, oy1) if widths[y] >= 0.985 * wmax)
    xs = np.nonzero(m[t1])[0]
    return t0, t1, xs.min(), xs.max() + 1


def do_terrain():
    o = load_orig('terrain.png'); H, W = o.shape[:2]
    k, st = key_magenta(np.array(Image.open(SRC + 'terrain.png').convert('RGB')))
    fy, fx = k.shape[0] / H, k.shape[1] / W
    lab, comps = components(k[..., 3], 3000)
    comps.sort(key=lambda c: -c['area'])
    main, plats = comps[0], sorted(comps[1:4], key=lambda c: (c['y0'], c['x0']))
    # collision surfaces (exact)
    g = STAGE['groundY']
    ground = next(s for s in STAGE['solids'] if 'h' not in s)
    targets = [('main', main, ground['x'] - ground['w'] / 2, ground['x'] + ground['w'] / 2, g)]
    pl = sorted(STAGE['platforms'], key=lambda p: (p['y'], p['x']))
    for c, p in zip(plats, pl):
        targets.append((f"plat@{p['x']},{p['y']}", c, p['x'] - p['w'] / 2, p['x'] + p['w'] / 2, p['y']))
    out = np.zeros((H, W, 4)); info = {}
    for name, c, cx0, cx1, cy in targets:
        sl = c['sl']
        piece = k[sl].copy()
        piece[lab[sl] != c['lab']] = 0
        # the visual walkable face spans exactly the collision width (+1px like the original)
        oy0 = c['y0'] - sl[0].start
        t0, t1, lx0, lx1 = lip_geometry(piece, oy0, c['y1'] - sl[0].start)
        s = (cx1 - cx0 + 1) / (lx1 - lx0)
        ox0 = lx0
        face = t1 - t0
        if name == 'main':
            # vertical 3-slice in source rows (relative to the top edge): keep
            # top face + hazard trim, the blue light-strip band, and the
            # chamfered bottom lip; drop the two plain panel rows between.
            h = c['y1'] - c['y0']
            r = lambda f: oy0 + int(round(f * h))
            keep = [(0, r(74 / 380)), (r(152 / 380), r(198 / 380)), (r(326 / 380), oy0 + h + 6)]
            parts = [piece[max(a, 0):b] for a, b in keep]
            piece = np.concatenate(parts, 0)
            info_slices = [[int(a - oy0), int(b - oy0)] for a, b in keep]
        nh, nw = int(round(piece.shape[0] * s)), int(round(piece.shape[1] * s))
        sc = premul_resize(piece, (nw, nh))
        # placement: front-lip left end -> cx0; the collision line sits 60% of
        # the way from the face's back edge to its front lip, so feet read as
        # planted on the deck (not perched on its back edge)
        face_px = face * s
        lift = int(round(0.60 * face_px))
        px = int(round(cx0 - ox0 * s)); py = int(round(cy - lift - oy0 * s))
        y0, y1 = max(py, 0), min(py + nh, H); x0, x1 = max(px, 0), min(px + nw, W)
        seg = sc[y0 - py:y1 - py, x0 - px:x1 - px]
        a = seg[..., 3:4] / 255
        out[y0:y1, x0:x1, :3] = seg[..., :3] * a + out[y0:y1, x0:x1, :3] * (1 - a)
        out[y0:y1, x0:x1, 3] = np.maximum(out[y0:y1, x0:x1, 3], seg[..., 3])
        # verify: over the collision span, the top face band [top edge, front lip] contains cy
        cols = range(int(cx0) + 6, int(cx1) - 6)
        tops = []
        for x in cols:
            col = out[:, x, 3] > 128
            ys = np.nonzero(col[max(0, int(cy) - 40):int(cy) + 40])[0]
            tops.append(int(cy) - 40 + int(ys[0]) if len(ys) else None)
        tops_ok = [t for t in tops if t is not None]
        # where the front lip landed (must span the collision width)
        lip_y = py + int(round(t1 * s))
        lipcols = np.nonzero(out[min(lip_y + 1, H - 1), :, 3] > 128)[0]
        lipcols = lipcols[(lipcols >= cx0 - 20) & (lipcols <= cx1 + 20)]
        info[name] = {'scale_vs_2x_src': round(s, 4), 'collision': [cx0, cx1, cy], 'lip_y': lip_y,
                      'lip_x': [int(lipcols.min()), int(lipcols.max()) + 1] if len(lipcols) else None,
                      'top_face_px': round(face_px, 1), 'top_edge_y': [min(tops_ok), max(tops_ok)] if tops_ok else None,
                      'collision_line_between_back_edge_and_lip': bool(py + t0 * s <= cy <= lip_y),
                      'max_gap_above_visual_px': int(max(0, max(tops_ok) - cy)) if tops_ok else None,
                      'cols_where_surface_top_at_or_above_collision': f"{sum(1 for t in tops_ok if t <= cy)}/{len(tops)}",
                      'cols_with_surface': f'{len(tops_ok)}/{len(tops)}', 'bottom_y': py + nh}
        if name == 'main':
            info[name]['slices_src_rows'] = info_slices
    i_stretch = iou(premul_resize(k, (W, H))[..., 3] / 255, o[..., 3] / 255)
    save_rgba(out, OUT + 'terrain.png')
    report['terrain'] = {'status': 'remastered (per-piece fit to collision)', 'iou_stretch': round(i_stretch, 3),
                         'iou_final': round(iou(out[..., 3] / 255, o[..., 3] / 255), 3), 'pieces': info, 'key': st}


if __name__ == '__main__':
    os.makedirs(BACKUP, exist_ok=True)
    for f in ['sky.jpg', 'far.png', 'mid.png', 'near.png', 'terrain.png', 'thumb.jpg', 'preview.jpg']:
        if not os.path.exists(BACKUP + f):
            shutil.copy(OUT + f, BACKUP + f)
    for fn in (do_sky, do_far, do_mid, do_near, do_terrain):
        fn(); print(fn.__name__, 'done', flush=True)
    rp = sys.argv[sys.argv.index('--report') + 1] if '--report' in sys.argv else '/workspace/stage-remaster/hydrogen-breakout/integration_report.json'
    json.dump(report, open(rp, 'w'), indent=2, default=lambda v: v.item() if hasattr(v, 'item') else str(v))
    print(json.dumps(report, indent=1, default=lambda v: v.item() if hasattr(v, 'item') else str(v)))
