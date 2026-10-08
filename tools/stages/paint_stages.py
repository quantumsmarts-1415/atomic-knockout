#!/usr/bin/env python3
"""Paints the parallax background layers, terrain, thumbnails and previews
for the story stages in src/data/stages.js.

  node -e "import('./src/data/stages.js').then(m=>require('fs').writeFileSync('/tmp/stages.json',JSON.stringify(m.STAGES)))"
  python3 tools/stages/paint_stages.py /tmp/stages.json [stage-id ...]

Outputs art-src/stages/<id>/sky.jpg, {far,mid,near,terrain}.png (+ lift.png
for the foundry), thumb.jpg (256x144) and preview.jpg (640x360). Layers are
1440 wide (80px parallax margin each side); terrain is 1280x720 and lines
up 1:1 with the stage geometry. Camera stages (stage.world, e.g. Carbon
Skyhook -- painters3.py) instead paint every layer and the terrain at the
world size (2560x1440), in world coordinates, so they stack 1:1 at full
zoom-out. The original four stages get thumbnails and previews only (drawn
from their theme colors + geometry).
Deterministic (fixed seeds), so re-running reproduces the same art.
"""
import json, math, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from paintlib import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
LW, H, W = 1440, 720, 1280
OX = (LW - W) // 2  # layer x offset of the stage's x=0


def world_size(stage):
    w = stage.get('world') or {}
    return w.get('width', W), w.get('height', H)


# ----------------------------------------------------------------- terrain
def ground_shape(s, stage, depth, taper):
    """Polygon for a ground solid: flat top, sides tapering into an island."""
    x0, x1 = s['x'] - s['w'] / 2, s['x'] + s['w'] / 2
    y = s.get('y', stage['groundY'])
    return x0, x1, y


def paint_terrain(stage, mat):
    # canvas = the stage (1280x720, or the world on big camera stages)
    TW, TH = world_size(stage)
    t = layer(TW, TH)
    gy = stage['groundY']
    rng = np.random.default_rng(7)
    for s in stage['solids']:
        is_ground = 'h' not in s
        x0, x1 = s['x'] - s['w'] / 2, s['x'] + s['w'] / 2
        y = s.get('y', gy)
        depth = (mat.get('depth', 110) if is_ground else s['h'])
        full = is_ground and mat.get('to_bottom')
        bot = TH if full else y + depth
        taper = 0 if (full or not is_ground) else mat.get('taper', 70)

        def body(d, k, x0=x0, x1=x1, y=y, bot=bot, taper=taper):
            if taper:
                pts = [(x0, y), (x1, y), (x1 - 10, y + 30), (x1 - taper, bot - 20),
                       (x1 - taper - 40, bot), (x0 + taper + 40, bot), (x0 + taper, bot - 20), (x0 + 10, y + 30)]
            else:
                pts = [(x0, y), (x1, y), (x1, bot), (x0, bot)]
            d.polygon([(px * k, py * k) for px, py in pts], fill=255)
        m = mask(TW, TH, body)
        yy = np.arange(TH)[:, None].astype(np.float32)
        tt = np.clip((yy - y) / max(1, bot - y), 0, 1)
        col = np.zeros((TH, TW, 3), np.float32)
        c0, c1 = hexc(mat['body_top'])[:3], hexc(mat['body_bot'])[:3]
        col[:] = (c0 * (1 - tt[..., None]) + c1 * tt[..., None])
        tmp = layer(TW, TH)
        fill(tmp, m, col)
        mat['detail'](tmp, m, x0, x1, y, bot, is_ground, rng)
        # cap / walking surface
        cap_h = mat.get('cap', 16)
        capm = mask(TW, TH, lambda d, k: d.rectangle([x0 * k, y * k, x1 * k, (y + cap_h) * k], fill=255)) * m
        fill(tmp, capm, mat['cap_col'])
        hi = mask(TW, TH, lambda d, k: d.rectangle([x0 * k, y * k, x1 * k, (y + 3) * k], fill=255)) * m
        fill(tmp, hi, mat['cap_hi'])
        # contact shadow under the cap lip
        sh = mask(TW, TH, lambda d, k: d.rectangle([x0 * k, (y + cap_h) * k, x1 * k, (y + cap_h + 10) * k], fill=255), blur=4) * m
        shade(tmp, sh, -0.45)
        if mat.get('trim'):
            mat['trim'](tmp, m, x0, x1, y, cap_h, rng)
        # bottom/side ambient occlusion + rim
        ao = np.clip((yy - y) / max(1, bot - y), 0, 1) ** 1.5
        shade(tmp, ao[:, :] * m, -0.5)
        grain(tmp, 0.02, seed=11)
        over(t, tmp)
    for p in stage['platforms']:
        if p.get('move'):
            continue
        paint_platform(t, p['x'], p['y'], p['w'], mat)
    return t


def paint_platform(t, cx, y, w, mat, ox=0):
    x0, x1 = cx - w / 2 + ox, cx + w / 2 + ox
    th = mat.get('plat_h', 18)
    tmp = layer(t.shape[1], t.shape[0])
    m = mask(t.shape[1], t.shape[0], lambda d, k: d.rounded_rectangle([x0 * k, y * k, x1 * k, (y + th) * k], radius=5 * k, fill=255))
    fill(tmp, m, mat['plat_body'])
    cap = mask(t.shape[1], t.shape[0], lambda d, k: d.rounded_rectangle([x0 * k, y * k, x1 * k, (y + 6) * k], radius=3 * k, fill=255))
    fill(tmp, cap, mat['plat_cap'])
    hi = mask(t.shape[1], t.shape[0], lambda d, k: d.rectangle([(x0 + 4) * k, y * k, (x1 - 4) * k, (y + 1.6) * k], fill=255))
    fill(tmp, hi, mat['cap_hi'])
    if mat.get('plat_trim'):
        mat['plat_trim'](tmp, x0, x1, y, th)
    # soft drop shadow below the platform (onto the background)
    sh = mask(t.shape[1], t.shape[0], lambda d, k: d.ellipse([(x0 + 10) * k, (y + th) * k, (x1 - 10) * k, (y + th + 16) * k], fill=255), blur=6)
    sl = layer(t.shape[1], t.shape[0]); fill(sl, sh, '#000000', 0.35)
    over(t, sl)
    over(t, tmp)


# ===================================================== 1. Hydrogen Breakout
def hydrogen_breakout(stage, out):
    rng = np.random.default_rng(101)
    # --- sky: the vast containment hall back wall
    sky = vgrad(LW, H, [(0, '#050c18'), (0.45, '#0d2236'), (0.8, '#16384f'), (1, '#1d4a60')])
    hexm = mask(LW, H, lambda d, k: [d.regular_polygon(((60 + (i % 2) * 52 + j * 104) * k, (40 + i * 60) * k, 34 * k), 6, outline=255, width=max(1, int(1.2 * k)))
                                     for i in range(12) for j in range(15)])
    add_light(sky, hexm * np.linspace(0.04, 0.12, H)[:, None], '#59c8ff')
    # high windows + god rays
    for wx in (300, 720, 1140):
        win = mask(LW, H, lambda d, k, wx=wx: d.rounded_rectangle([(wx - 70) * k, 20 * k, (wx + 70) * k, 120 * k], radius=10 * k, fill=255))
        add_light(sky, win, '#bfefff', 0.55)
        add_light(sky, blur(win, 30), '#5fd0ff', 0.5)
    r = rays(LW, H, (720, -60), [70, 82, 95, 108], 7, 900)
    add_light(sky, r, '#7fdcff', 0.22)
    add_light(sky, rays(LW, H, (300, -60), [72, 88], 6, 800), '#7fdcff', 0.12)
    add_light(sky, rays(LW, H, (1140, -60), [92, 108], 6, 800), '#7fdcff', 0.12)
    # distant gantry silhouettes
    g = mask(LW, H, lambda d, k: [d.rectangle([(x) * k, 150 * k, (x + 16) * k, 720 * k], fill=255) for x in range(40, LW, 180)] +
             [d.rectangle([0, 230 * k, LW * k, 240 * k], fill=255), d.rectangle([0, 380 * k, LW * k, 388 * k], fill=255)])
    fill(sky, g, '#14324a', 0.65)
    haze(sky, 300, 720, '#2a6a84', 0.45)
    # the containment pit under the deck: cold glow rising from below
    pit = mask(LW, H, lambda d, k: d.ellipse([200 * k, 600 * k, 1240 * k, 900 * k], fill=255), blur=70)
    add_light(sky, pit, '#4fd8ff', 0.55)
    brushwork(sky, 0.05, 5); grain(sky, 0.015)
    save_jpg(sky, f'{out}/sky.jpg')

    # --- far: giant containment tubes, one shattered (Hydra's)
    far = layer(LW, H)
    tubes = [(150, False), (420, False), (720, True), (1020, False), (1290, False)]
    for tx, broken in tubes:
        tw = 150
        x0, x1 = tx - tw / 2, tx + tw / 2
        base = mask(LW, H, lambda d, k, x0=x0, x1=x1: [d.rectangle([(x0 - 22) * k, 520 * k, (x1 + 22) * k, 720 * k], fill=255),
                                                      d.rectangle([(x0 - 18) * k, 70 * k, (x1 + 18) * k, 120 * k], fill=255)])
        fill(far, base, '#0f2233')
        shade(far, base * np.linspace(0, 1, H)[:, None], -0.4)
        rim = mask(LW, H, lambda d, k, x0=x0, x1=x1: [d.rectangle([(x0 - 22) * k, 520 * k, (x1 + 22) * k, 524 * k], fill=255),
                                                     d.rectangle([(x0 - 18) * k, 116 * k, (x1 + 18) * k, 120 * k], fill=255)])
        fill(far, rim, '#4fa8c8', 0.8)
        glass = mask(LW, H, lambda d, k, x0=x0, x1=x1: d.rounded_rectangle([x0 * k, 120 * k, x1 * k, 520 * k], radius=30 * k, fill=255))
        xx = np.linspace(-1, 1, LW)[None, :]
        if not broken:
            liquid = np.zeros((H, LW, 3), np.float32)
            yy = np.linspace(0, 1, H)[:, None]
            c = hexc('#1fa8d8')[:3] * (0.55 + 0.45 * yy[..., None]) + 0 * xx[..., None]
            fill(far, glass, c, 0.82)
            # bubbles inside
            bm = mask(LW, H, lambda d, k, x0=x0, x1=x1: [d.ellipse([(bx - r) * k, (by - r) * k, (bx + r) * k, (by + r) * k], outline=255, width=max(1, int(1.5 * k)))
                                                        for bx, by, r in [(rng.uniform(x0 + 15, x1 - 15), rng.uniform(140, 500), rng.uniform(3, 9)) for _ in range(26)]])
            add_light(far, bm, '#d8f6ff', 0.7)
            # specimen silhouette
            sil = mask(LW, H, lambda d, k: [d.ellipse([(tx - 20) * k, 230 * k, (tx + 20) * k, 275 * k], fill=255),
                                           d.rounded_rectangle([(tx - 28) * k, 270 * k, (tx + 28) * k, 400 * k], radius=18 * k, fill=255),
                                           d.rounded_rectangle([(tx - 22) * k, 395 * k, (tx + 22) * k, 480 * k], radius=10 * k, fill=255)], blur=3)
            fill(far, sil, '#0b3a52', 0.75)
            glow(far, glass, '#3fd4ff', 24, 0.35)
        else:
            fill(far, glass, '#0a1a28', 0.55)
            # jagged broken glass
            shard = mask(LW, H, lambda d, k: [d.polygon([(px * k, py * k) for px, py in pts], fill=255) for pts in [
                [(x0, 520), (x0, 330), (x0 + 30, 380), (x0 + 22, 440), (x0 + 55, 470), (x0 + 50, 520)],
                [(x1, 520), (x1, 300), (x1 - 26, 350), (x1 - 18, 410), (x1 - 60, 455), (x1 - 40, 520)],
                [(x0, 120), (x1, 120), (x1, 190), (x1 - 40, 170), (x0 + 70, 230), (x0 + 30, 180), (x0, 210)]]])
            fill(far, shard, '#5fc4e4', 0.45)
            edge = blur(shard, 1.2) - blur(shard, 3)
            add_light(far, np.clip(edge * 4, 0, 1), '#e8fbff', 0.8)
            # escaping hydrogen glow
            gas = mask(LW, H, lambda d, k: d.ellipse([(tx - 140) * k, 200 * k, (tx + 140) * k, 560 * k], fill=255), blur=60)
            add_light(far, gas, '#9fe8ff', 0.5)
            far[..., 3] = np.maximum(far[..., 3], gas * 0.5)
            warn = mask(LW, H, lambda d, k: d.ellipse([(tx - 10) * k, 86 * k, (tx + 10) * k, 106 * k], fill=255))
            fill(far, warn, '#ff4d4d'); glow(far, warn, '#ff3030', 26, 1.6)
        hl = mask(LW, H, lambda d, k, x0=x0: d.rounded_rectangle([(x0 + 16) * k, 140 * k, (x0 + 26) * k, 500 * k], radius=5 * k, fill=255), blur=2)
        add_light(far, hl * glass, '#ffffff', 0.35)
        # pipes into ceiling
        pm = mask(LW, H, lambda d, k, tx=tx: [d.rectangle([(tx - 8) * k, 0, (tx + 8) * k, 72 * k], fill=255),
                                             d.rectangle([(tx - 40) * k, 0, (tx - 30) * k, 72 * k], fill=255),
                                             d.rectangle([(tx + 30) * k, 0, (tx + 40) * k, 72 * k], fill=255)])
        fill(far, pm, '#0c1d2b')
    haze(far, 0, 720, '#1d4a60', 0.35)
    # play-band haze keeps the fighters' area calm
    band = np.exp(-((np.arange(H) - 400) / 150.0) ** 2)[:, None] * far[..., 3]
    far[..., :3] = far[..., :3] * (1 - 0.35 * band[..., None]) + hexc('#1d4a60')[:3] * 0.35 * band[..., None]
    brushwork(far, 0.05, 6); grain(far, 0.015, 2)
    save(far, f'{out}/far.png')

    # --- mid: catwalks, trusses, monitors, warning beacons
    mid = layer(LW, H)
    cat = mask(LW, H, lambda d, k: [d.rectangle([0, 200 * k, LW * k, 210 * k], fill=255)] +
               [d.line([(x * k, 210 * k), ((x + 40) * k, 234 * k)], fill=255, width=int(3 * k)) for x in range(0, LW, 40)] +
               [d.line([(x * k, 234 * k), ((x + 40) * k, 210 * k)], fill=255, width=int(3 * k)) for x in range(0, LW, 40)] +
               [d.rectangle([0, 232 * k, LW * k, 238 * k], fill=255)] +
               [d.rectangle([x * k, 150 * k, (x + 4) * k, 200 * k], fill=255) for x in range(0, LW, 60)] +
               [d.rectangle([0, 150 * k, LW * k, 154 * k], fill=255)])
    fill(mid, cat, '#0a1a28', 0.85)
    for mx in (210, 600, 880, 1230):
        mon = mask(LW, H, lambda d, k, mx=mx: d.rounded_rectangle([(mx - 46) * k, 160 * k, (mx + 46) * k, 196 * k], radius=4 * k, fill=255))
        fill(mid, mon, '#0f3d55')
        lines = mask(LW, H, lambda d, k, mx=mx: [d.rectangle([(mx - 38) * k, (166 + i * 6) * k, (mx - 38 + rng.uniform(20, 76)) * k, (168 + i * 6) * k], fill=255) for i in range(5)])
        add_light(mid, lines, '#7ff0ff', 0.9)
        glow(mid, mon, '#33c8ff', 14, 0.6)
    for bx in (90, 520, 960, 1350):
        b = mask(LW, H, lambda d, k, bx=bx: d.ellipse([(bx - 7) * k, 136 * k, (bx + 7) * k, 150 * k], fill=255))
        fill(mid, b, '#ffb03a'); glow(mid, b, '#ff9a20', 22, 1.4)
    pipes = mask(LW, H, lambda d, k: [d.rounded_rectangle([0, 610 * k, LW * k, 636 * k], radius=12 * k, fill=255),
                                     d.rounded_rectangle([0, 645 * k, LW * k, 657 * k], radius=6 * k, fill=255)] +
                 [d.rectangle([x * k, 606 * k, (x + 14) * k, 640 * k], fill=255) for x in range(30, LW, 150)])
    fill(mid, pipes, '#0a1824')
    pipehi = mask(LW, H, lambda d, k: d.rectangle([0, 614 * k, LW * k, 617 * k], fill=255))
    fill(mid, pipehi * pipes, '#3a8aa8', 0.6)
    haze(mid, 250, 720, '#173e55', 0.25)
    grain(mid, 0.015, 3)
    save(mid, f'{out}/mid.png')

    # --- near: framing columns with cables + low steam
    near = layer(LW, H)
    cols = mask(LW, H, lambda d, k: [d.rectangle([0, 0, 70 * k, 720 * k], fill=255), d.rectangle([(LW - 70) * k, 0, LW * k, 720 * k], fill=255),
                                    d.polygon([(70 * k, 0), (170 * k, 0), (70 * k, 110 * k)], fill=255),
                                    d.polygon([((LW - 70) * k, 0), ((LW - 170) * k, 0), ((LW - 70) * k, 110 * k)], fill=255)])
    fill(near, cols, '#050b12')
    edge = mask(LW, H, lambda d, k: [d.rectangle([66 * k, 110 * k, 70 * k, 720 * k], fill=255), d.rectangle([(LW - 70) * k, 110 * k, (LW - 66) * k, 720 * k], fill=255)])
    fill(near, edge, '#3fb8e0', 0.7); glow(near, edge, '#3fb8e0', 10, 0.5)
    cab = mask(LW, H, lambda d, k: [d.arc([(40) * k, -200 * k, 520 * k, 160 * k], 20, 160, fill=255, width=int(5 * k)),
                                   d.arc([(LW - 520) * k, -220 * k, (LW - 40) * k, 150 * k], 20, 160, fill=255, width=int(6 * k))])
    fill(near, cab, '#04090f')
    steam = fbm(LW, H, 120, 4, 9) * np.clip((np.arange(H)[:, None] - 520) / 200, 0, 1)
    fill(near, np.clip((steam - 0.35) * 1.6, 0, 1), '#bfeaff', 0.35)
    save(near, f'{out}/near.png')

    # --- terrain: steel lab deck, hazard stripes, cyan light strip
    def detail(tmp, m, x0, x1, y, bot, is_ground, rng):
        panels = mask(W, H, lambda d, k: [d.line([(x * k, (y + 20) * k), (x * k, bot * k)], fill=255, width=max(1, int(1.5 * k))) for x in np.arange(x0 + 60, x1, 90)] +
                      [d.line([(x0 * k, (y + 52) * k), (x1 * k, (y + 52) * k)], fill=255, width=max(1, int(1.5 * k)))])
        shade(tmp, panels * m, -0.35)
        rivets = mask(W, H, lambda d, k: [d.ellipse([(x - 2) * k, (y + 30 - 2) * k, (x + 2) * k, (y + 30 + 2) * k], fill=255) for x in np.arange(x0 + 30, x1, 45)])
        add_light(tmp, rivets * m, '#9cc8dc', 0.5)
        strip = mask(W, H, lambda d, k: d.rectangle([(x0 + 30) * k, (y + 62) * k, (x1 - 30) * k, (y + 66) * k], fill=255)) * m
        fill(tmp, strip, '#7ff0ff'); glow(tmp, strip, '#33c8ff', 8, 0.8)
    def trim(tmp, m, x0, x1, y, cap_h, rng):
        stripes = mask(W, H, lambda d, k: [d.polygon([((x) * k, (y + cap_h) * k), ((x + 14) * k, (y + cap_h) * k), ((x + 24) * k, (y + cap_h + 8) * k), ((x + 10) * k, (y + cap_h + 8) * k)], fill=255)
                                          for xs in ((x0 + 6, x0 + 110), (x1 - 110, x1 - 6)) for x in np.arange(xs[0], xs[1], 26)])
        fill(tmp, stripes * m, '#f2b632', 0.9)
    def plat_trim(tmp, x0, x1, y, th):
        lm = mask(W, H, lambda d, k: d.rectangle([(x0 + 14) * k, (y + 11) * k, (x1 - 14) * k, (y + 13) * k], fill=255))
        fill(tmp, lm, '#7ff0ff'); glow(tmp, lm, '#33c8ff', 6, 0.7)
    mat = dict(body_top='#2a3e4f', body_bot='#0e1822', cap_col='#5d7688', cap_hi='#d6eef8', cap=16, depth=120, taper=60,
               detail=detail, trim=trim, plat_body='#22323f', plat_cap='#6a8597', plat_trim=plat_trim)
    terr = paint_terrain(stage, mat)
    save(terr, f'{out}/terrain.png')
    return mat


import painters2 as P2
import painters3 as P3
STAGE_PAINTERS = {
    'hydrogen-breakout': hydrogen_breakout,
    'silicon-foundry': lambda st, out: P2.silicon_foundry(st, out, paint_terrain, paint_platform),
    'brimstone-caldera': lambda st, out: P2.brimstone_caldera(st, out, paint_terrain, paint_platform),
    'neon-nexus': lambda st, out: P2.neon_nexus(st, out, paint_terrain, paint_platform),
    'holdout-keep': lambda st, out: P2.holdout_keep(st, out, paint_terrain, paint_platform),
    'carbon-skyhook': lambda st, out: P3.carbon_skyhook(st, out, paint_terrain, paint_platform),
}


# --------------------------------------------------------- thumbs/previews
def composite(stage, out, mat=None):
    if stage.get('camera'):
        return composite_world(stage, out)
    canvas = Image.new('RGBA', (W, H))
    for name in ('sky.jpg', 'far.png', 'mid.png', 'near.png'):
        im = Image.open(f'{out}/{name}').convert('RGBA')
        canvas.alpha_composite(im.crop((OX, 0, OX + W, H)))
    canvas.alpha_composite(Image.open(f'{out}/terrain.png'))
    if os.path.exists(f'{out}/lift.png'):
        lift = Image.open(f'{out}/lift.png')
        p = next(p for p in stage['platforms'] if p.get('move'))
        canvas.alpha_composite(lift, (int(p['x'] - lift.width / 2), int(p['y'] - 8)))
    return canvas


def composite_world(stage, out):
    # camera stages: world-sized layers stack 1:1 (that's the full zoom-out view)
    TW, TH = world_size(stage)
    canvas = Image.new('RGBA', (TW, TH))
    for name in ('sky.jpg', 'far.png', 'mid.png', 'near.png', 'terrain.png'):
        canvas.alpha_composite(Image.open(f'{out}/{name}').convert('RGBA'))
    if os.path.exists(f'{out}/lift.png'):
        lift = Image.open(f'{out}/lift.png').convert('RGBA')
        p = next(p for p in stage['platforms'] if p.get('move'))
        y = min(p['move'].get('stops', [p['y']]))  # show the lift up at the summit stop
        canvas.alpha_composite(lift, (int(p['x'] - lift.width / 2), int(y - 8)))
    return canvas


def write_thumbs(canvas, out):
    if canvas.width != W:
        # camera stage: 16:9 frame on the playable area (drops the top sky)
        w = canvas.width * 0.84
        x0 = (canvas.width - w) / 2
        h = w * 9 / 16
        crop = canvas.crop((int(x0), int(canvas.height - h), int(x0 + w), canvas.height))
        crop.convert('RGB').resize((640, 360), Image.LANCZOS).save(f'{out}/preview.jpg', quality=90)
        crop.convert('RGB').resize((256, 144), Image.LANCZOS).save(f'{out}/thumb.jpg', quality=90)
        return
    # 16:9 frame on the action area (drops the top of the sky), kept inside
    # the 1280x720 canvas so nothing pads with black
    crop = canvas.crop((80, 90, 1200, 720))
    crop.convert('RGB').resize((640, 360), Image.LANCZOS).save(f'{out}/preview.jpg', quality=90)
    crop.convert('RGB').resize((256, 144), Image.LANCZOS).save(f'{out}/thumb.jpg', quality=90)


def legacy_canvas(stage):
    """Original procedural look (gradient sky + bubbles + hills + flat terrain)."""
    th = stage['theme']
    c = vgrad(W, H, [(0, '#%06x' % th['skyTop']), (1, '#%06x' % th['skyBottom'])])
    rng = np.random.default_rng(3)
    b = mask(W, H, lambda d, k: [d.ellipse([(x - r) * k, (y - r) * k, (x + r) * k, (y + r) * k], fill=255) for x, y, r in
                                [(rng.uniform(0, W), rng.uniform(0, H * 0.7), rng.uniform(6, 26)) for _ in range(26)]])
    add_light(c, b, '#7fd4ff', 0.07)
    hills = mask(W, H, lambda d, k: d.ellipse([(W * 0.25 - W * 0.45) * k, (H * 0.98 - H * 0.225) * k, (W * 0.25 + W * 0.45) * k, (H * 0.98 + H * 0.225) * k], fill=255))
    fill(c, hills, '#%06x' % th['hills'][0])
    hills = mask(W, H, lambda d, k: d.ellipse([(W * 0.85 - W * 0.475) * k, (H * 1.02 - H * 0.25) * k, (W * 0.85 + W * 0.475) * k, (H * 1.02 + H * 0.25) * k], fill=255))
    fill(c, hills, '#%06x' % th['hills'][1])
    gy = stage['groundY']
    for s in stage['solids']:
        y = s.get('y', gy); h = s.get('h', 90)
        m = mask(W, H, lambda d, k: d.rounded_rectangle([(s['x'] - s['w'] / 2) * k, y * k, (s['x'] + s['w'] / 2) * k, (y + h) * k], radius=8 * k, fill=255))
        fill(c, m, '#3d2f4e')
        m2 = mask(W, H, lambda d, k: d.rounded_rectangle([(s['x'] - s['w'] / 2) * k, y * k, (s['x'] + s['w'] / 2) * k, (y + (22 if 'h' not in s else 10)) * k], radius=6 * k, fill=255))
        fill(c, m2, '#53e0a8')
    for p in stage['platforms']:
        m = mask(W, H, lambda d, k: d.rounded_rectangle([(p['x'] - p['w'] / 2) * k, p['y'] * k, (p['x'] + p['w'] / 2) * k, (p['y'] + 18) * k], radius=9 * k, fill=255))
        fill(c, m, '#6a55a0')
        m2 = mask(W, H, lambda d, k: d.rounded_rectangle([(p['x'] - p['w'] / 2) * k, p['y'] * k, (p['x'] + p['w'] / 2) * k, (p['y'] + 8) * k], radius=4 * k, fill=255))
        fill(c, m2, '#8f78cc')
    return Image.fromarray((np.clip(c, 0, 1) * 255).astype(np.uint8), 'RGBA')


def main():
    stages = json.load(open(sys.argv[1]))
    only = set(sys.argv[2:])
    for st in stages:
        if only and st['id'] not in only:
            continue
        out = os.path.join(ROOT, 'art-src', 'stages', st['id'])
        os.makedirs(out, exist_ok=True)
        if st['id'] in STAGE_PAINTERS:
            STAGE_PAINTERS[st['id']](st, out)
            canvas = composite(st, out)
        else:
            canvas = legacy_canvas(st)
        write_thumbs(canvas, out)
        canvas.convert('RGB').save(f'/tmp/stage_full_{st["id"]}.png')
        print('painted', st['id'])


if __name__ == '__main__':
    main()
