"""Per-stage decisions for remaster_stage.py (one function per stage).
Each function receives the stage context `c` and the helper module `R`."""
import numpy as np
from scipy import ndimage as nd


def _opaque_cov(a, x0=80, x1=1360):
    return round(float((a[:, x0:x1] > 128).mean()), 3)


def _reject_report(c, R, layer, why, key_kw=None):
    """Measure the remaster (for the report) but keep the original layer."""
    s, k, info = R.layer_register(c, layer, key_kw=key_kw, save=False)
    o = c.orig(layer + '.png')
    c.keep(layer + '.png', why, iou_stretch=info['iou_stretch'], iou_best_affine=info['iou_final'],
           on_screen_coverage_orig=_opaque_cov(o[..., 3]), on_screen_coverage_remaster=_opaque_cov(s[..., 3]))
    return s


def _paint_up_leaves(o, light=(0.55, -0.83), warm=(255, 196, 120), seed=7):
    """Light painterly treatment of flat leaf blobs: same alpha, but each leaf
    gets a slight hue jitter, soft texture, a shadowed side and a warm rim
    light from the sunset side."""
    rgb = o[..., :3].copy(); a = o[..., 3] / 255
    hgt = nd.gaussian_filter(a, 1.6)
    gy, gx = np.gradient(hgt)
    lam = np.clip(-gx * 6 * light[0] - gy * 6 * light[1], -1, 1)
    rng = np.random.default_rng(seed)
    lab, n = nd.label(a > 0.3)
    jit = rng.uniform(-0.18, 0.18, (n + 1, 3)); jit[:, 1] *= 0.6
    noise = nd.gaussian_filter(rng.normal(0, 1, a.shape), 1.2); noise /= noise.std()
    rim = np.exp(-nd.distance_transform_edt(a > 0.3) / 2.5)
    base = rgb * (1 + jit[lab]) * (1 + 0.10 * noise[..., None])
    lit = np.clip(lam, 0, 1)[..., None]; sh = np.clip(-lam, 0, 1)[..., None]
    out = base * (1 - 0.45 * sh) + (np.array(warm) - base) * 0.55 * lit * rim[..., None]
    return np.dstack([np.clip(out, 0, 255), o[..., 3]])


# ------------------------------------------------------------ Holdout Keep
def holdout_keep(c, R):
    R.do_sky(c)
    R.layer_register(c, 'far', key_kw={'interior_opaque_frac': 0.6})

    # mid: Gemini's banners are ~3x the original -> each banner refitted into
    # the original banner's box; the bird flock refitted into the flock's box
    o = c.orig('mid.png'); k, st = c.key('mid')
    out = np.zeros_like(o); fits = []
    ob = [(384, 114, 457, 300), (984, 114, 1057, 300)]
    rb = [(540, 190, 1050, 1370), (1830, 190, 2340, 1370)]
    for orect, rrect in zip(ob, rb):
        fits.append(R.fit_object(out, k, rrect, orect, mode='contain', anchor='top'))
    # flock: everything outside the banner boxes
    om = o[..., 3] > 100
    for x0, y0, x1, y1 in ob:
        om[y0 - 4:y1 + 4, x0 - 4:x1 + 4] = False
    rm = k[..., 3] > 100
    for x0, y0, x1, y1 in rb:
        rm[y0:y1, x0:x1] = False
    obox, rbx = R.bbox(om), R.bbox(rm)
    pad = 12
    fits.append(R.fit_object(out, k, (rbx[0] - pad, rbx[1] - pad, rbx[2] + pad, rbx[3] + pad), obox, mode='contain', anchor='center'))
    c.save(out, 'mid.png')
    s_stretch = R.premul_resize(k, (o.shape[1], o.shape[0]))
    c.report['mid'] = {'status': 'refitted (per-object: 2 banners + flock into the original boxes)',
                       'iou_stretch': round(R.iou(s_stretch[..., 3] / 255, o[..., 3] / 255), 3),
                       'iou_final': round(R.iou(out[..., 3] / 255, o[..., 3] / 255), 3), 'objects': fits, 'key': st}

    _reject_report(c, R, 'near', 'Gemini turned the sparse ivy fringe at the screen edges into two dense ivy '
                   'columns ~3-4x wider that reach well into the play area in front of the fighters; '
                   'cannot be thinned without re-painting. Original layout kept (thin edge frame), with a '
                   'light painterly pass (per-leaf shading, warm rim light, texture) so the flat leaves sit '
                   'better against the painted castle.')
    c.save(_paint_up_leaves(c.orig('near.png')), 'near.png')
    c.report['near']['status'] = 'ORIGINAL KEPT (light painterly shading pass)'

    # terrain: ramparts + raised keep are one painted piece; balconies separate
    k, st = c.key('terrain')
    lab, comps = R.components(k[..., 3], 3000)
    comps.sort(key=lambda q: -q['area'])
    main, balc = comps[0], sorted(comps[1:3], key=lambda q: q['x0'])
    spans = R.collision_spans(c.stage)
    ramp = next(s for s in spans if s[0] == 'solid' and s[3] == c.stage['groundY'])
    keep = next(s for s in spans if s[0] == 'solid' and s[3] != c.stage['groundY'])
    plats = sorted([s for s in spans if s[0] == 'platform'], key=lambda s: s[1])
    out = np.zeros((R.H, R.W, 4)); info = {}
    piece, _ = R.cut_piece(k, lab, main)
    m = piece[..., 3] > 128; widths = m.sum(1)
    r_top = int(np.argmax(widths >= 0.6 * widths.max()))      # rampart back edge (keep is above)
    rt0, rt1, rlx0, rlx1 = R.face_geometry(piece, r_top)
    kt0, kt1, klx0, klx1 = R.face_geometry(piece[:r_top])
    s = (ramp[2] - ramp[1] + 1) / (rlx1 - rlx0)
    # the keep's standing line must sit exactly (ramp_y - keep_y) above the
    # rampart's: drop that many surplus source rows from the keep's plain
    # brick wall, at the row pair that matches best (invisible seam)
    rs, ks = rt0 + 0.6 * (rt1 - rt0), kt0 + 0.6 * (kt1 - kt0)
    d = int(round((rs - ks) - (ramp[3] - keep[3]) / s))
    lo, hi = kt1 + 12, r_top - 8 - d
    if d > 0 and hi > lo:
        lum = piece[..., :3].mean(2) * (piece[..., 3] / 255)
        cols = slice(klx0 + 10, klx1 - 10)
        r = min(range(lo, hi), key=lambda y: np.abs(lum[y, cols] - lum[y + d, cols]).mean())
        piece = np.concatenate([piece[:r], piece[r + d:]], 0)
        info['keep_wall_rows_removed_src'] = [int(r), int(r + d)]
        r_top -= d
    info['ramparts'] = R.place_piece(out, piece, ramp[1:], ref_from=r_top, bottom=R.H + 2)
    # where did the keep land?
    kx0 = ramp[1] + (klx0 - rlx0) * s; kx1 = ramp[1] + (klx1 - rlx0) * s
    stand_r = ramp[3]
    keep_line = stand_r - (rs - d - ks) * s
    info['keep (same piece)'] = {'collision': list(keep[1:]), 'visual_lip_x': [round(kx0, 1), round(kx1, 1)],
                                 'visual_standing_y': round(keep_line, 1),
                                 'top_edge_y_at_center': int(np.argmax(out[:, 640, 3] > 128))}
    for comp, sp in zip(balc, plats):
        bp, _ = R.cut_piece(k, lab, comp)
        info[f'balcony@{int((sp[1] + sp[2]) / 2)},{int(sp[3])}'] = R.place_piece(out, bp, sp[1:])
    o = c.orig('terrain.png')
    c.save(out, 'terrain.png')
    c.report['terrain'] = {'status': 'remastered (per-piece fit to collision)',
                           'iou_stretch': round(R.iou(R.premul_resize(k, (R.W, R.H))[..., 3] / 255, o[..., 3] / 255), 3),
                           'iou_final': round(R.iou(out[..., 3] / 255, o[..., 3] / 255), 3), 'pieces': info, 'key': st}


STAGE_FUNCS = {
    'holdout-keep': holdout_keep,
}


# -------------------------------------------------------------- Neon Nexus
def neon_nexus(c, R):
    R.do_sky(c)
    R.layer_register(c, 'far')

    # mid: Gemini's saucer is the original size, but its beam became ~2x
    # longer/wider and nearly opaque, plus big bokeh orbs were added. Saucer
    # kept 1:1; beam rescaled about its top to the original beam length and
    # faded; small drone lights kept, enlarged orbs dropped. The key colour is
    # Gemini's darker off-shade green (sampled, ~RGB(1,182,3)).
    o = c.orig('mid.png'); h, w = o.shape[:2]
    k, st = c.key('mid', glow_despill=True)
    fy, fx = k.shape[0] / h, k.shape[1] / w
    out = np.zeros_like(o)
    ux0, ux1, sy0, sy1 = 700, 1400, 140, 305          # saucer rows (remaster px)
    beam = k[sy1 - 10:1320, ux0:ux1].copy()
    ob_bottom = 420                                   # original beam fades out ~y420
    bs = (ob_bottom - sy1 / fy) / ((1300 - sy1) / fy)
    bw, bh = int(round(beam.shape[1] / fx * bs)), int(round(beam.shape[0] / fy * bs))
    beam_s = R.premul_resize(beam, (bw, bh)); beam_s[..., 3] *= 0.55
    saucer = k[sy0:sy1, ux0:ux1]
    sw_, sh_ = int(round(saucer.shape[1] / fx)), int(round(saucer.shape[0] / fy))
    saucer_s = R.premul_resize(saucer, (sw_, sh_))
    cx = (ux0 + ux1) / 2 / fx
    R.over(out, beam_s, int(round(cx - bw / 2)), int(round((sy1 - 10) / fy)))
    R.over(out, saucer_s, int(round(ux0 / fx)), int(round(sy0 / fy)))
    lab, n = nd.label(nd.binary_dilation(k[..., 3] > 60, iterations=6))
    kept = dropped = 0
    for i, sl in enumerate(nd.find_objects(lab)):
        if sl[1].start < ux1 and sl[1].stop > ux0 and sl[0].start < 1320:
            continue                                  # the UFO/beam itself
        wpx = sl[1].stop - sl[1].start
        if wpx > 60:
            dropped += 1; continue
        piece = k[sl].copy(); piece[lab[sl] != i + 1] = 0
        ps = R.premul_resize(piece, (max(1, int(round(piece.shape[1] / fx))), max(1, int(round(piece.shape[0] / fy)))))
        R.over(out, ps, int(round(sl[1].start / fx)), int(round(sl[0].start / fy)))
        kept += 1
    c.save(out, 'mid.png')
    s_stretch = R.premul_resize(k, (w, h))
    c.report['mid'] = {'status': 'refitted (saucer 1:1, beam rescaled x%.2f + faded to 55%%, %d small lights kept, %d enlarged bokeh orbs dropped)' % (bs, kept, dropped),
                       'iou_stretch': round(R.iou(s_stretch[..., 3] / 255, o[..., 3] / 255), 3),
                       'iou_final': round(R.iou(out[..., 3] / 255, o[..., 3] / 255), 3), 'key': st}

    # near: rooftop antenna boxes, each refitted by its box width, feet on the original line
    o = c.orig('near.png'); k, st = c.key('near')
    out = np.zeros_like(o)
    fits = [R.fit_object(out, k, (120, 780, 380, 1260), (90, 434, 151, 563), mode='width', anchor='bottom'),
            R.fit_object(out, k, (2540, 780, 2800, 1260), (1300, 414, 1371, 563), mode='width', anchor='bottom')]
    c.save(out, 'near.png')
    s_stretch = R.premul_resize(k, (o.shape[1], o.shape[0]))
    c.report['near'] = {'status': 'refitted (per-object, 2 antenna boxes)',
                        'iou_stretch': round(R.iou(s_stretch[..., 3] / 255, o[..., 3] / 255), 3),
                        'iou_final': round(R.iou(out[..., 3] / 255, o[..., 3] / 255), 3), 'objects': fits, 'key': st}

    # terrain: full-width roof (walk-off) + two neon-sign platforms
    k, st = c.key('terrain')
    lab, comps = R.components(k[..., 3], 3000)
    main = max(comps, key=lambda q: q['area'])
    spans = R.collision_spans(c.stage)
    roof = next(s for s in spans if s[0] == 'solid')
    plats = sorted([s for s in spans if s[0] == 'platform'], key=lambda s: s[1])
    out = np.zeros((R.H, R.W, 4)); info = {}
    ROOF_Y = 1150                                       # remaster row just above the roof ledge
    rp, (rx, ry) = R.cut_piece(k, lab, main, rect=(0, ROOF_Y, k.shape[1], k.shape[0]))
    # lit concrete ledge = top face: rows 1160..1205 (front lip = dark edge)
    info['roof'] = R.place_piece(out, rp, roof[1:], face=(1160 - ry, 1205 - ry), lip=(0 - rx, k.shape[1] - rx), bottom=R.H + 2)
    roof_back = int(np.argmax(out[:, 640, 3] > 128))
    for sp, (x0, x1) in zip(plats, [(420, 1100), (1650, 2310)]):
        sp_piece, (_, py0) = R.cut_piece(k, lab, main, rect=(x0, 800, x1, 1158))
        # legs end on the roof ledge (a few px below its back edge); only the
        # legs (below the sign box, remaster row ~1084) are stretched for that
        info[f'sign@{int((sp[1] + sp[2]) / 2)},{int(sp[3])}'] = R.place_piece(out, sp_piece, sp[1:], bottom=roof_back + 6,
                                                                             split_at=1084 - py0)
    o = c.orig('terrain.png')
    c.save(out, 'terrain.png')
    c.report['terrain'] = {'status': 'remastered (per-piece fit to collision)',
                           'iou_stretch': round(R.iou(R.premul_resize(k, (R.W, R.H))[..., 3] / 255, o[..., 3] / 255), 3),
                           'iou_final': round(R.iou(out[..., 3] / 255, o[..., 3] / 255), 3), 'roof_back_edge_y': roof_back,
                           'pieces': info, 'key': st}


STAGE_FUNCS['neon-nexus'] = neon_nexus


# --------------------------------------------------------- Silicon Foundry
def silicon_foundry(c, R):
    R.do_sky(c)
    # far: Gemini added taller background stacks (IoU 0.52) but they stay
    # behind everything at the screen sides; the wafer emitters' lime halos
    # (glow over the green key) are re-hued to the discs' violet
    R.layer_register(c, 'far', key_kw={'glow_despill': True, 'glow_hue': (60, 290)})
    # mid: the pour's yellow-green halo is re-hued to molten orange
    R.layer_register(c, 'mid', key_kw={'glow_despill': True, 'glow_hue': (80, 30)})
    R.layer_register(c, 'near')

    # terrain: one slab; top face scaled to the collision span, body
    # rescaled so the hull ends where the original did (y~680)
    k, st = c.key('terrain')
    lab, comps = R.components(k[..., 3], 3000)
    main = max(comps, key=lambda q: q['area'])
    ground = next(s for s in R.collision_spans(c.stage) if s[0] == 'solid')
    o = c.orig('terrain.png')
    orig_bottom = int(np.nonzero(o[:, 640, 3] > 128)[0].max()) + 1
    out = np.zeros((R.H, R.W, 4))
    piece, _ = R.cut_piece(k, lab, main)
    info = {'slab': R.place_piece(out, piece, ground[1:], bottom=orig_bottom), 'orig_bottom_y': orig_bottom}
    c.save(out, 'terrain.png')
    c.report['terrain'] = {'status': 'remastered (per-piece fit to collision)',
                           'iou_stretch': round(R.iou(R.premul_resize(k, (R.W, R.H))[..., 3] / 255, o[..., 3] / 255), 3),
                           'iou_final': round(R.iou(out[..., 3] / 255, o[..., 3] / 255), 3), 'pieces': info, 'key': st}

    # lift (moving platform image): BattleScene draws it with its top-centre
    # at (platform.x, platform.y - 8), so the collision line is image row 8
    # and the walkable span is the image's centred 220px (platform w).
    o = c.orig('lift.png'); ow = o.shape[1]
    k, st = c.key('lift', glow_despill=True)
    lab, comps = R.components(k[..., 3], 3000)
    main = max(comps, key=lambda q: q['area'])
    piece, _ = R.cut_piece(k, lab, main)
    p = next(p for p in c.stage['platforms'] if p.get('move'))
    x0 = (ow - p['w']) / 2
    canvas = np.zeros((160, ow, 4))
    info = R.place_piece(canvas, piece, (x0, x0 + p['w'], 8), bottom=None)
    rows = np.nonzero(canvas[..., 3].max(1) > 2)[0]
    hgt = max(o.shape[0], int(rows.max()) + 2)
    canvas = canvas[:hgt]
    info['image_size'] = [ow, hgt]
    info['image_top_row_used'] = int(rows.min())
    R.Image.fromarray(np.clip(canvas + 0.5, 0, 255).astype(np.uint8), 'RGBA').save(c.out + 'lift.png', optimize=True)
    oo = np.zeros_like(canvas); oo[:o.shape[0]] = o
    c.report['lift'] = {'status': 'remastered (deck fitted to the moving collision platform)',
                        'iou_stretch': round(R.iou(np.pad(R.premul_resize(k, (ow, o.shape[0]))[..., 3], ((0, hgt - o.shape[0]), (0, 0))) / 255, oo[..., 3] / 255), 3),
                        'iou_final': round(R.iou(canvas[..., 3] / 255, oo[..., 3] / 255), 3), 'fit': info, 'key': st}


STAGE_FUNCS['silicon-foundry'] = silicon_foundry


# ------------------------------------------------------- Brimstone Caldera
def _pillar_mask(k, side, surface, xlim, extrude=40):
    """Mask of the basalt pillar on one side of Gemini's mid (remaster px):
    the keyed alpha above the lava surface (largest blob on that side),
    extruded `extrude` rows straight down into the lava (that part ends up
    behind the opaque lava band anyway)."""
    h, w = k.shape[:2]
    a = k[..., 3] > 128
    m = np.zeros((h, w), bool)
    cols = slice(0, xlim) if side == 'left' else slice(w - xlim, w)
    lab, _ = nd.label(a[:surface, cols])
    big = np.argmax(np.bincount(lab.ravel())[1:]) + 1
    m[:surface, cols] = lab == big
    m[surface:surface + extrude] = m[surface - 1]
    return m


def brimstone_caldera(c, R):
    R.do_sky(c)

    # far: Gemini's cliff mesas are ~1.8x wider / 1.3x taller than the
    # original cliffs; each refitted into the original cliff box (uniform
    # scale = geometric mean of the width/height ratios), outer edge and
    # base kept where they were
    o = c.orig('far.png'); k, st = c.key('far', glow_despill=True, glow_hue=(400, 22))
    out = np.zeros_like(o)
    fits = [R.fit_object(out, k, (0, 0, 1440, 1440), (0, 286, 341, 720), mode='geo', anchor='bottom-left'),
            R.fit_object(out, k, (1440, 0, 2880, 1440), (1110, 279, 1440, 720), mode='geo', anchor='bottom-right')]
    c.save(out, 'far.png')
    s_stretch = R.premul_resize(k, (o.shape[1], o.shape[0]))
    c.report['far'] = {'status': 'refitted (per-object, 2 cliff mesas into the original cliff boxes)',
                       'iou_stretch': round(R.iou(s_stretch[..., 3] / 255, o[..., 3] / 255), 3),
                       'iou_final': round(R.iou(out[..., 3] / 255, o[..., 3] / 255), 3), 'objects': fits, 'key': st}

    # mid: Gemini grew the two short basalt spikes into tall pillars and
    # raised/thickened the lava sea. Lava: pillar-free middle of Gemini's lava
    # band, seamlessly tiled, surface placed on the original lava line (y640);
    # pillars refitted into the original spike boxes, behind the lava.
    o = c.orig('mid.png'); h, w = o.shape[:2]
    k, st = c.key('mid', glow_despill=True)
    fy, fx = k.shape[0] / h, k.shape[1] / w
    prof = k[:, 700:2200, 3].mean(1)
    surface = int(np.argmax(prof > 250))                     # first fully-opaque lava row (remaster px)
    haze_top = int(np.argmax(prof > 8))
    out = np.zeros_like(o); fits = []
    for side, box in (('left', (39, 496, 140, 640)), ('right', (1289, 496, 1397, 640))):
        pm = _pillar_mask(k, side, surface, 700)
        pm = nd.binary_dilation(pm, iterations=2).astype(np.float64)
        rows = np.nonzero(pm.any(1))[0]
        cols = np.nonzero(pm.any(0))[0]
        rect = (int(cols.min()), int(rows.min()), int(cols.max()) + 1, surface + int(30 * fy))
        fits.append(R.fit_object(out, k, rect, box, mode='geo', anchor='bottom-left' if side == 'left' else 'bottom-right',
                                 mask=pm, fx=fx, fy=fy))
    band = k[max(haze_top - 10, 0):, 760:2120]
    band_s = R.premul_resize(band, (int(round(band.shape[1] / fx)), int(round(band.shape[0] / fy))))
    tiled, tinfo = R.tile_band(band_s, w)
    top = 640 - int(round((surface - max(haze_top - 10, 0)) / fy))
    R.over(out, tiled, 0, top)
    c.save(out, 'mid.png')
    s_stretch = R.premul_resize(k, (w, h))
    c.report['mid'] = {'status': 'refitted (lava band re-tiled onto the original lava line; pillars refitted into the original spike boxes)',
                       'iou_stretch': round(R.iou(s_stretch[..., 3] / 255, o[..., 3] / 255), 3),
                       'iou_final': round(R.iou(out[..., 3] / 255, o[..., 3] / 255), 3),
                       'lava_surface_remaster_row': surface, 'lava_band_top_y': top, 'tiling': tinfo, 'pillars': fits, 'key': st}

    _reject_report(c, R, 'near', 'The original near layer is a sparse, faint haze (max alpha 75). Gemini added solid '
                   'rock ledges along the top and bottom edges plus thick smoke (31% of the screen opaque), which '
                   'would sit in front of the fighters. Original kept.')

    # terrain: basalt slab fitted to the collision span; hull height like the original
    k, st = c.key('terrain', glow_despill=True)
    lab, comps = R.components(k[..., 3], 3000)
    main = max(comps, key=lambda q: q['area'])
    ground = next(s for s in R.collision_spans(c.stage) if s[0] == 'solid')
    o = c.orig('terrain.png')
    orig_bottom = int(np.nonzero(o[:, 640, 3] > 128)[0].max()) + 1
    out = np.zeros((R.H, R.W, 4))
    piece, (px0, py0) = R.cut_piece(k, lab, main)
    # the basalt top face is an almost untapered plane, so its rows are found
    # by brightness instead of width: it starts where the slab reaches full
    # width (below the corner crystals) and ends at the dark front-lip edge
    m = piece[..., 3] > 128; widths = m.sum(1)
    t0 = int(np.argmax(widths >= 0.9 * widths.max()))
    lum = piece[..., :3].mean(2); xs = np.nonzero(m[t0])[0]
    rowlum = np.array([lum[y, xs.min() + 200:xs.max() - 200].mean() for y in range(piece.shape[0])])
    face_lum = rowlum[t0:t0 + 30].mean()
    t1 = t0 + 30 + int(np.argmax(rowlum[t0 + 30:] < 0.7 * face_lum))
    info = {'slab': R.place_piece(out, piece, ground[1:], bottom=orig_bottom, face=(t0, t1)), 'orig_bottom_y': orig_bottom,
            'top_face_rows_remaster': [t0 + py0, t1 + py0]}
    c.save(out, 'terrain.png')
    c.report['terrain'] = {'status': 'remastered (per-piece fit to collision)',
                           'iou_stretch': round(R.iou(R.premul_resize(k, (R.W, R.H))[..., 3] / 255, o[..., 3] / 255), 3),
                           'iou_final': round(R.iou(out[..., 3] / 255, o[..., 3] / 255), 3), 'pieces': info, 'key': st}


STAGE_FUNCS['brimstone-caldera'] = brimstone_caldera
