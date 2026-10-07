"""Integrate the Gemini remasters of the painted stages (after Hydrogen
Breakout, see remaster_hydrogen.py) into art-src/stages/<id>/.

  python3 tools/stages/remaster_stage.py <stage-id> [<stage-id> ...]

Inputs : /workspace/stage-remaster/<id>/remastered/*.png  (Gemini, opaque, ~2x)
         /workspace/stage-remaster/<id>/src/*              (pre-remaster originals)
         key colour per layer = the colour in the file name that was sent to
         Gemini (<layer>_on_<magenta|green|blue>.png)
Writes : art-src/stages/<id>/{sky.jpg,far.png,mid.png,near.png,terrain.png,
         [lift.png],thumb.jpg,preview.jpg}
         /workspace/stage-remaster/<id>/integration_report.json

Same rules as Hydrogen: every keyed layer is registered to the original by
mask matching (never a blind stretch) and its alpha IoU vs the original is
reported. Objects Gemini enlarged are refitted to the original object's box;
layers that can't be fitted without covering the play area keep the original.
Terrain is rebuilt piece by piece against the collision data in
src/data/stages.js: each walkable face is scaled to its collision span and the
collision line sits 60% of the way from the face's back edge to its front lip.
"""
import json, os, shutil, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, os.path.dirname(__file__))
from remaster_lib import key_chroma, premul_resize, affine_warp, iou, register

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LW, H, W = 1440, 720, 1280
OX = (LW - W) // 2
_stages_cache = '/tmp/stages_remaster.json'
subprocess.run(['node', '-e', "import('%s/src/data/stages.js').then(m=>require('fs').writeFileSync('%s',JSON.stringify(m.STAGES)))"
                % (ROOT, _stages_cache)], check=True)
ALL_STAGES = {s['id']: s for s in json.load(open(_stages_cache))}


class Ctx:
    def __init__(self, sid):
        self.id = sid
        self.stage = ALL_STAGES[sid]
        self.base = f'/workspace/stage-remaster/{sid}/'
        self.rem = self.base + 'remastered/'
        self.src = self.base + 'src/'
        self.out = os.path.join(ROOT, f'art-src/stages/{sid}/')
        self.kinds = {f.split('_on_')[0]: f.split('_on_')[1][:-4] for f in os.listdir(self.base) if '_on_' in f}
        self.report = {}

    def orig(self, name):
        return np.array(Image.open(self.src + name).convert('RGBA')).astype(np.float64)

    def key(self, layer, **kw):
        rgb = np.array(Image.open(self.rem + layer + '.png').convert('RGB'))
        return key_chroma(rgb, self.kinds[layer], **kw)

    def save(self, arr, name):
        Image.fromarray(np.clip(arr + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(self.out + name, optimize=True)

    def keep(self, name, why, **extra):
        shutil.copyfile(self.src + name, self.out + name)   # byte-identical original
        self.report[name.split('.')[0]] = {'status': 'ORIGINAL KEPT', 'why': why, **extra}


def over(dst, src, x, y):
    """alpha-over src (straight RGBA float) onto dst at integer (x, y), clipped."""
    h, w = src.shape[:2]
    Hd, Wd = dst.shape[:2]
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, Wd), min(y + h, Hd)
    if x1 <= x0 or y1 <= y0:
        return
    seg = src[y0 - y:y1 - y, x0 - x:x1 - x]
    a = seg[..., 3:4] / 255
    da = dst[y0:y1, x0:x1, 3:4] / 255
    oa = a + da * (1 - a)
    dst[y0:y1, x0:x1, :3] = (seg[..., :3] * a + dst[y0:y1, x0:x1, :3] * da * (1 - a)) / np.maximum(oa, 1e-6)
    dst[y0:y1, x0:x1, 3:4] = oa * 255


def bbox(m):
    ys, xs = np.nonzero(m)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


# ------------------------------------------------------------------- sky
def edges(gray):
    g = nd.gaussian_filter(gray, 1.5)
    return np.hypot(nd.sobel(g, 0), nd.sobel(g, 1))


def ncc(a, b):
    a = a - a.mean(); b = b - b.mean()
    return float((a * b).sum() / (np.sqrt((a * a).sum() * (b * b).sum()) + 1e-9))


def do_sky(c):
    """Opaque sky: edge-NCC registration constrained to keep the canvas covered."""
    o = np.array(Image.open(c.src + 'sky.jpg').convert('RGB')).astype(np.float64)
    h, w = o.shape[:2]
    r = np.array(Image.open(c.rem + 'sky.png').convert('RGB').resize((w, h), Image.LANCZOS)).astype(np.float64)
    eo, er = edges(o.mean(2)[::2, ::2]), edges(r.mean(2)[::2, ::2])
    best, bs = [1.0, 1.0, 0.0, 0.0], ncc(eo, er)
    base = bs
    st = [0.02, 8.0]
    while st[1] >= 1:
        imp = False
        for i in range(4):
            for d in (-1, 1):
                q = list(best); q[i] += d * (st[0] if i < 2 else st[1])
                if q[0] < 1 or q[1] < 1 or q[0] > 1.08 or q[1] > 1.08:
                    continue
                if not (w * (1 - q[0]) <= q[2] <= 0 and h * (1 - q[1]) <= q[3] <= 0):
                    continue
                wv = affine_warp(er, q[0], q[1], q[2] / 2, q[3] / 2, eo.shape, order=1)
                sc = ncc(eo, wv)
                if sc > bs + 1e-4:
                    best, bs, imp = q, sc, True
        if not imp:
            st = [st[0] / 2, st[1] / 2]
    out = affine_warp(r, *best, (h, w), order=3)
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(c.out + 'sky.jpg', quality=90)
    c.report['sky'] = {'status': 'remastered', 'edge_ncc_stretch': round(base, 3), 'edge_ncc_registered': round(bs, 3),
                       'affine': [round(v, 3) for v in best]}


# ------------------------------------------------- keyed layer: registration
def layer_register(c, layer, key_kw=None, save=True, status='remastered', **extra):
    o = c.orig(layer + '.png'); h, w = o.shape[:2]
    k, st = c.key(layer, **(key_kw or {}))
    s = premul_resize(k, (w, h))
    i0 = iou(s[..., 3] / 255, o[..., 3] / 255)
    if (o[..., 3] > 128).any() and (s[..., 3] > 128).any():
        p, i1 = register(s[..., 3], o[..., 3])
    else:                       # e.g. a faint haze layer (no alpha > 0.5): nothing to register
        p, i1 = [1, 1, 0, 0], i0
    if i1 > i0 + 0.005:
        s = affine_warp(s, *p, (h, w), order=3); s[..., 3] = np.clip(s[..., 3], 0, 255)
        s[s[..., 3] < 1] = 0
    else:
        p, i1 = [1, 1, 0, 0], i0
    info = {'status': status, 'iou_stretch': round(i0, 3), 'iou_final': round(i1, 3),
            'affine': [round(float(v), 3) for v in p], 'key': st, **extra}
    if save:
        c.save(s, layer + '.png')
        c.report[layer] = info
    return s, k, info


# ------------------------------------------------ keyed layer: object refit
def fit_object(dst, k, rem_rect, orig_box, mode='contain', anchor='bottom', mask=None, fx=2.0, fy=2.0):
    """Cut the object inside rem_rect (remaster px) and scale it uniformly into
    orig_box (layer px, the original object's opaque bbox).
    mode: contain | height | width | geo ; anchor: bottom | top | center |
    bottom-left | bottom-right (which edge of the boxes coincide)."""
    x0, y0, x1, y1 = rem_rect
    crop = k[y0:y1, x0:x1].copy()
    if mask is not None:
        crop[..., 3] *= mask[y0:y1, x0:x1]
    bx0, by0, bx1, by1 = bbox(crop[..., 3] > 128)
    rw, rh = (bx1 - bx0) / fx, (by1 - by0) / fy       # object size in layer px if just stretched
    ox0, oy0, ox1, oy1 = orig_box
    sw, sh = (ox1 - ox0) / rw, (oy1 - oy0) / rh
    s = {'contain': min(sw, sh), 'height': sh, 'width': sw, 'geo': float(np.sqrt(sw * sh))}[mode]
    nw, nh = max(1, int(round(crop.shape[1] / fx * s))), max(1, int(round(crop.shape[0] / fy * s)))
    sc = premul_resize(crop, (nw, nh))
    kx, ky = nw / crop.shape[1], nh / crop.shape[0]
    obx0, oby0, obx1, oby1 = bx0 * kx, by0 * ky, bx1 * kx, by1 * ky
    if anchor in ('bottom', 'bottom-left', 'bottom-right'):
        py = oy1 - oby1
    elif anchor == 'top':
        py = oy0 - oby0
    else:
        py = (oy0 + oy1) / 2 - (oby0 + oby1) / 2
    if anchor == 'bottom-left':
        px = ox0 - obx0
    elif anchor == 'bottom-right':
        px = ox1 - obx1
    else:
        px = (ox0 + ox1) / 2 - (obx0 + obx1) / 2
    over(dst, sc, int(round(px)), int(round(py)))
    return {'rem_rect': [int(v) for v in rem_rect], 'orig_box': [int(v) for v in orig_box], 'mode': mode, 'anchor': anchor,
            'scale_vs_stretch': round(s, 3), 'placed_box': [int(round(px + obx0)), int(round(py + oby0)), int(round(px + obx1)), int(round(py + oby1))]}


# ------------------------------------------------------------- terrain fit
def components(alpha, min_area, dil=4):
    lab, _ = nd.label(nd.binary_dilation(alpha > 10, iterations=dil))
    comps = []
    for i, sl in enumerate(nd.find_objects(lab)):
        solid = (alpha[sl] > 128) & (lab[sl] == i + 1)
        if solid.sum() < min_area:
            continue
        ys, xs = np.nonzero(solid)
        comps.append({'lab': i + 1, 'sl': sl, 'x0': sl[1].start + xs.min(), 'x1': sl[1].start + xs.max() + 1,
                      'y0': sl[0].start + ys.min(), 'y1': sl[0].start + ys.max() + 1, 'area': int(solid.sum())})
    return lab, comps


def cut_piece(k, lab, comp, rect=None):
    """RGBA crop of one component (others zeroed), trimmed to its opaque bbox (+2px)."""
    sl = comp['sl']
    piece = k[sl].copy()
    piece[lab[sl] != comp['lab']] = 0
    if rect is not None:   # optional sub-rectangle in remaster px
        yy, xx = np.mgrid[sl[0], sl[1]]
        rx0, ry0, rx1, ry1 = rect
        piece[~((xx >= rx0) & (xx < rx1) & (yy >= ry0) & (yy < ry1))] = 0
    x0, y0, x1, y1 = bbox(piece[..., 3] > 128)
    y0, x0 = max(y0 - 2, 0), max(x0 - 2, 0)
    return piece[y0:y1 + 2, x0:x1 + 2], (sl[1].start + x0, sl[0].start + y0)


def face_geometry(piece, ref_from=0):
    """Perspective top face of the widest part at/after row ref_from:
    t0 = back edge (first row >= 50% of max width), t1 = front lip (first row
    reaching ~full width), lip x extent = the walkable span."""
    m = piece[..., 3] > 128
    widths = m.sum(1)
    wmax = widths[ref_from:].max()
    t0 = ref_from + int(np.argmax(widths[ref_from:] >= 0.5 * wmax))
    win = widths[t0:t0 + max(8, int(0.45 * (len(widths) - t0)))]
    wtop = win.max()
    t1 = t0 + int(np.argmax(win >= 0.985 * wtop))
    xs = np.nonzero(m[t1])[0]
    return t0, t1, int(xs.min()), int(xs.max()) + 1


def place_piece(dst, piece, span, lift_frac=0.6, bottom=None, ref_from=0, body_pad=None, face=None, lip=None, split_at=None):
    """Scale a 2x terrain piece so its front lip spans the collision width and
    its collision line sits lift_frac from back edge to lip. If `bottom` is
    given, the body below the top face is rescaled vertically (same width) so
    the hull ends at that y (keeps hull height like the original / reaches the
    screen bottom)."""
    cx0, cx1, cy = span
    t0, t1, lx0, lx1 = face_geometry(piece, ref_from)
    if face is not None:      # manual top-face rows (e.g. full-width roof: no taper to detect)
        t0, t1 = face
        xs = np.nonzero(piece[t1, :, 3] > 128)[0]
        lx0, lx1 = int(xs.min()), int(xs.max()) + 1
    if lip is not None:       # manual walkable extent in piece px (e.g. runs off both image edges)
        lx0, lx1 = lip
    s = (cx1 - cx0 + 1) / (lx1 - lx0)
    nw = int(round(piece.shape[1] * s))
    stand = t0 + lift_frac * (t1 - t0)
    py = cy - stand * s
    px = cx0 - lx0 * s
    split = min(piece.shape[0], t1 + (body_pad if body_pad is not None else max(6, int(0.5 * (t1 - t0)))))
    if split_at is not None:  # rows above keep uniform scale; only rows below (e.g. sign legs) stretch
        split = split_at
    top_h = int(round(split * s))
    parts = [premul_resize(piece[:split], (nw, max(top_h, 1)))]
    sy_body = s
    if split < piece.shape[0]:
        body_h = int(round((piece.shape[0] - split) * s))
        if bottom is not None:
            body_h = int(round(bottom - (py + top_h)))
            sy_body = body_h / (piece.shape[0] - split)
        parts.append(premul_resize(piece[split:], (nw, max(body_h, 1))))
    sc = np.concatenate(parts, 0)
    ipx, ipy = int(round(px)), int(round(py))
    over(dst, sc, ipx, ipy)
    lip_y = ipy + int(round(t1 * s))
    tops = []
    for x in range(int(cx0) + 6, int(cx1) - 6):
        if not (0 <= x < dst.shape[1]):
            continue
        col = dst[max(0, int(cy) - 40):int(cy) + 40, x, 3] > 128
        ys = np.nonzero(col)[0]
        tops.append(max(0, int(cy) - 40) + int(ys[0]) if len(ys) else None)
    ok = [t for t in tops if t is not None]
    lipcols = np.nonzero(dst[min(lip_y + 1, dst.shape[0] - 1), :, 3] > 128)[0]
    lipcols = lipcols[(lipcols >= cx0 - 20) & (lipcols <= cx1 + 20)]
    return {'scale_vs_2x_src': round(s, 4), 'body_vscale_vs_uniform': round(sy_body / s, 3), 'collision': [cx0, cx1, cy],
            'lip_y': lip_y, 'lip_x': [int(lipcols.min()), int(lipcols.max()) + 1] if len(lipcols) else None,
            'top_face_px': round((t1 - t0) * s, 1), 'top_edge_y': [min(ok), max(ok)] if ok else None,
            'collision_line_between_back_edge_and_lip': bool(ipy + t0 * s <= cy + 0.5 and cy <= lip_y + 0.5),
            'max_gap_above_visual_px': int(max(0, max(ok) - cy)) if ok else None,
            'cols_where_surface_top_at_or_above_collision': f"{sum(1 for t in ok if t <= cy)}/{len(tops)}",
            'bottom_y': ipy + sc.shape[0]}


def collision_spans(st):
    g = st['groundY']
    out = []
    for s in st['solids']:
        out.append(('solid', s['x'] - s['w'] / 2, s['x'] + s['w'] / 2, s.get('y', g)))
    for p in st['platforms']:
        out.append(('platform', p['x'] - p['w'] / 2, p['x'] + p['w'] / 2, p['y']))
    return out


# ------------------------------------------------------- composite / thumbs
def composite(c, out_dir=None, with_lift=True):
    d = out_dir or c.out
    canvas = Image.new('RGBA', (W, H))
    for name in ('sky.jpg', 'far.png', 'mid.png', 'near.png'):
        im = Image.open(d + name).convert('RGBA')
        canvas.alpha_composite(im.crop((OX, 0, OX + W, H)))
    canvas.alpha_composite(Image.open(d + 'terrain.png'))
    if with_lift and os.path.exists(d + 'lift.png'):
        lift = Image.open(d + 'lift.png')
        p = next(p for p in c.stage['platforms'] if p.get('move'))
        canvas.alpha_composite(lift, (int(p['x'] - lift.width / 2), int(p['y'] - 8)))
    return canvas


def write_thumbs(c):
    canvas = composite(c)
    crop = canvas.crop((80, 90, 1200, 720))
    crop.convert('RGB').resize((640, 360), Image.LANCZOS).save(c.out + 'preview.jpg', quality=90)
    crop.convert('RGB').resize((256, 144), Image.LANCZOS).save(c.out + 'thumb.jpg', quality=90)
    canvas.convert('RGB').save(c.base + 'composite_after.png')
    composite(c, c.src).convert('RGB').save(c.base + 'composite_before.png')


# =========================================================== per-stage
def tile_band(band, width, xfade=16):
    """Repeat a horizontally periodic band (as in remaster_hydrogen.py)."""
    h, w = band.shape[:2]
    lum = band[..., :3].mean(2) * band[..., 3] / 255
    best = None
    for P in range(int(w * 0.55), w - xfade - 2, 2):
        for x0 in range(0, w - P - xfade, 4):
            cst = np.abs(lum[:, x0:x0 + xfade] - lum[:, x0 + P:x0 + P + xfade]).mean()
            if best is None or cst < best[0]:
                best = (cst, P, x0)
    _, P, x0 = best
    tile = band[:, x0:x0 + P + xfade].copy()
    out = np.zeros((h, width + P + xfade, 4))
    x, n = 0, 0
    while x < width:
        seg = tile.copy()
        if x > 0:
            wgt = np.linspace(0, 1, xfade)[None, :, None]
            seg[:, :xfade] = out[:, x:x + xfade] * (1 - wgt) + seg[:, :xfade] * wgt
        out[:, x:x + P + xfade] = seg
        x += P; n += 1
    return out[:, :width], {'period_px': P, 'seam_cost': round(float(best[0]), 2), 'tiles': n}


from remaster_stages_conf import STAGE_FUNCS  # noqa: E402  (per-stage decisions)


if __name__ == '__main__':
    for sid in sys.argv[1:]:
        c = Ctx(sid)
        STAGE_FUNCS[sid](c, sys.modules[__name__])
        write_thumbs(c)
        json.dump(c.report, open(c.base + 'integration_report.json', 'w'), indent=2,
                  default=lambda v: v.item() if hasattr(v, 'item') else str(v))
        print(json.dumps(c.report, indent=1, default=lambda v: v.item() if hasattr(v, 'item') else str(v)))
