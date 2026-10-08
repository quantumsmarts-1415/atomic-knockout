"""Painters for stages 2-5 (foundry, caldera, neon city, holdout keep)."""
import math
import numpy as np
from PIL import Image
from paintlib import *

LW, H, W = 1440, 720, 1280


def ell(d, k, cx, cy, rx, ry, **kw):
    d.ellipse([(cx - rx) * k, (cy - ry) * k, (cx + rx) * k, (cy + ry) * k], **kw)


def poly(d, k, pts, **kw):
    d.polygon([(x * k, y * k) for x, y in pts], **kw)


def rect(d, k, x0, y0, x1, y1, **kw):
    d.rectangle([x0 * k, y0 * k, x1 * k, y1 * k], **kw)


# ======================================================= 2. Silicon Foundry
def silicon_foundry(stage, out, paint_terrain, paint_platform):
    rng = np.random.default_rng(202)
    sky = vgrad(LW, H, [(0, '#0c0610'), (0.4, '#24101e'), (0.75, '#4a1c22'), (1, '#7a3018')])
    # circuit traces on the back wall
    tr = mask(LW, H, lambda d, k: [d.line([(x * k, y * k) for x, y in path], fill=255, width=max(1, int(1.6 * k)))
                                  for path in [[(sx, sy), (sx + dx, sy), (sx + dx + 30, sy + 30), (sx + dx + 30, sy + 30 + dy)]
                                               for sx, sy, dx, dy in [(rng.uniform(0, LW), rng.uniform(0, 420), rng.uniform(40, 200), rng.uniform(30, 160)) for _ in range(70)]]])
    add_light(sky, tr, '#ff4fa0', 0.16)
    nodes = mask(LW, H, lambda d, k: [ell(d, k, rng.uniform(0, LW), rng.uniform(0, 420), 3, 3, fill=255) for _ in range(90)])
    add_light(sky, nodes, '#ff7fc0', 0.4)
    # the AI core: a red eye in a ring of machinery
    cx, cy = 720, 150
    for r, col, k2 in [(150, '#2a0c14', 1), (120, '#3a1018', 1), (92, '#14060a', 1)]:
        m = mask(LW, H, lambda d, k, r=r: ell(d, k, cx, cy, r, r, fill=255))
        fill(sky, m, col, 0.95)
    ring = mask(LW, H, lambda d, k: [ell(d, k, cx, cy, 120, 120, outline=255, width=int(3 * k)), ell(d, k, cx, cy, 92, 92, outline=255, width=int(2 * k))])
    add_light(sky, ring, '#ff3a3a', 0.6)
    spokes = mask(LW, H, lambda d, k: [d.line([((cx + math.cos(a) * 96) * k, (cy + math.sin(a) * 96) * k), ((cx + math.cos(a) * 146) * k, (cy + math.sin(a) * 146) * k)], fill=255, width=int(5 * k)) for a in np.linspace(0, 2 * math.pi, 16, endpoint=False)])
    fill(sky, spokes, '#5a1820', 0.9)
    eye = mask(LW, H, lambda d, k: ell(d, k, cx, cy, 34, 34, fill=255))
    fill(sky, eye, '#ff2a2a')
    add_light(sky, blur(eye, 40), '#ff2020', 1.0)
    add_light(sky, blur(eye, 110), '#ff3020', 0.5)
    pupil = mask(LW, H, lambda d, k: ell(d, k, cx, cy, 10, 22, fill=255))
    fill(sky, pupil, '#ffe0c0')
    # furnace glow along the bottom
    fg = mask(LW, H, lambda d, k: ell(d, k, 720, 820, 900, 300, fill=255), blur=60)
    add_light(sky, fg, '#ff8a2a', 0.6)
    brushwork(sky, 0.06, 21); grain(sky, 0.015, 21)
    save_jpg(sky, f'{out}/sky.jpg')

    far = layer(LW, H)
    # wafer stacks / silos
    for sx, sw, sh in [(110, 150, 430), (380, 120, 360), (1060, 130, 380), (1330, 160, 440)]:
        m = mask(LW, H, lambda d, k, sx=sx, sw=sw, sh=sh: [rect(d, k, sx - sw / 2, H - sh, sx + sw / 2, H), ell(d, k, sx, H - sh, sw / 2, 18, fill=255)] if False else
                 [d.rectangle([(sx - sw / 2) * k, (H - sh) * k, (sx + sw / 2) * k, H * k], fill=255), ell(d, k, sx, H - sh, sw / 2, 18, fill=255)])
        fill(far, m, '#1e0c14')
        bands = mask(LW, H, lambda d, k, sx=sx, sw=sw, sh=sh: [d.rectangle([(sx - sw / 2) * k, y * k, (sx + sw / 2) * k, (y + 4) * k], fill=255) for y in range(H - sh + 30, H, 46)])
        fill(far, bands * m, '#3a1a22')
        win = mask(LW, H, lambda d, k, sx=sx, sw=sw, sh=sh: [d.rectangle([(sx - 8) * k, y * k, (sx + 8) * k, (y + 14) * k], fill=255) for y in range(H - sh + 50, H - 120, 46)])
        fill(far, win, '#ff9a4a'); glow(far, win, '#ff7a2a', 10, 0.6)
    # robotic arms holding glowing wafers
    for bx, flip in [(250, 1), (1190, -1)]:
        j1 = (bx, 470); j2 = (bx + flip * 120, 300); j3 = (bx + flip * 250, 260)
        arm = mask(LW, H, lambda d, k: [d.line([(j1[0] * k, j1[1] * k), (j2[0] * k, j2[1] * k)], fill=255, width=int(30 * k)),
                                       d.line([(j2[0] * k, j2[1] * k), (j3[0] * k, j3[1] * k)], fill=255, width=int(22 * k)),
                                       ell(d, k, *j1, 30, 30, fill=255), ell(d, k, *j2, 22, 22, fill=255),
                                       d.rectangle([(bx - 50) * k, 470 * k, (bx + 50) * k, 720 * k], fill=255)])
        fill(far, arm, '#2a1018')
        jl = mask(LW, H, lambda d, k: [ell(d, k, *j1, 8, 8, fill=255), ell(d, k, *j2, 6, 6, fill=255)])
        fill(far, jl, '#ff5a3a'); glow(far, jl, '#ff4020', 10, 0.8)
        wafer = mask(LW, H, lambda d, k: ell(d, k, j3[0] + flip * 40, j3[1] + 6, 62, 14, fill=255))
        xx = np.linspace(0, 1, LW)[None, :]
        irid = np.stack([0.55 + 0.35 * np.sin(xx * 40 + 0), 0.45 + 0.35 * np.sin(xx * 40 + 2), 0.65 + 0.3 * np.sin(xx * 40 + 4)], -1) * np.ones((H, 1, 1))
        fill(far, wafer, irid.astype(np.float32))
        glow(far, wafer, '#ffb0f0', 18, 0.35)
    haze(far, 0, 720, '#3a1420', 0.3)
    band = np.exp(-((np.arange(H) - 400) / 150.0) ** 2)[:, None] * far[..., 3]
    far[..., :3] = far[..., :3] * (1 - 0.3 * band[..., None]) + hexc('#4a1c22')[:3] * 0.3 * band[..., None]
    brushwork(far, 0.05, 22); grain(far, 0.015, 22)
    save(far, f'{out}/far.png')

    mid = layer(LW, H)
    # crucible pouring molten silicon on the left
    cru = mask(LW, H, lambda d, k: poly(d, k, [(60, 130), (210, 130), (190, 220), (80, 220)], fill=255))
    fill(mid, cru, '#1a0a0e')
    lip = mask(LW, H, lambda d, k: ell(d, k, 135, 132, 76, 10, fill=255))
    fill(mid, lip, '#ffcf7a'); glow(mid, lip, '#ff9a2a', 20, 0.8)
    stream = mask(LW, H, lambda d, k: poly(d, k, [(196, 140), (212, 140), (226, 720), (206, 720)], fill=255))
    fill(mid, stream, '#ffd27a'); glow(mid, stream, '#ff8a20', 26, 1.0)
    chains = mask(LW, H, lambda d, k: [d.line([(x * k, 0), (x * k, (rng.uniform(60, 150)) * k)], fill=255, width=int(3 * k)) for x in (420, 470, 980, 1040, 1300)])
    fill(mid, chains, '#14080c')
    hooks = mask(LW, H, lambda d, k: [d.arc([(x - 12) * k, 140 * k, (x + 12) * k, 168 * k], 0, 200, fill=255, width=int(4 * k)) for x in (470, 1040)])
    fill(mid, hooks, '#14080c')
    # conveyor with wafers, low in the frame (below the deck line)
    conv = mask(LW, H, lambda d, k: [d.rounded_rectangle([0, 616 * k, LW * k, 640 * k], radius=12 * k, fill=255)] +
                [ell(d, k, x, 628, 9, 9, fill=255) for x in range(10, LW, 34)])
    fill(mid, conv, '#120709')
    wafers = mask(LW, H, lambda d, k: [ell(d, k, x, 610, 26, 6, fill=255) for x in range(40, LW, 120)])
    fill(mid, wafers, '#c8a0ff', 0.9); glow(mid, wafers, '#ff9ae8', 8, 0.4)
    haze(mid, 200, 720, '#4a1c22', 0.2)
    grain(mid, 0.015, 23)
    save(mid, f'{out}/mid.png')

    near = layer(LW, H)
    gird = mask(LW, H, lambda d, k: [d.rectangle([0, 0, 60 * k, 720 * k], fill=255), d.rectangle([(LW - 60) * k, 0, LW * k, 720 * k], fill=255),
                                    d.rectangle([0, 0, LW * k, 34 * k], fill=255)] +
                [d.line([(x * k, 34 * k), ((x + 60) * k, 0)], fill=255, width=int(6 * k)) for x in range(60, LW - 60, 60)])
    fill(near, gird, '#0a0406')
    rimm = mask(LW, H, lambda d, k: [d.rectangle([56 * k, 34 * k, 60 * k, 720 * k], fill=255), d.rectangle([(LW - 60) * k, 34 * k, (LW - 56) * k, 720 * k], fill=255)])
    fill(near, rimm, '#ff7a3a', 0.6)
    smoke = fbm(LW, H, 140, 4, 29) * np.clip((np.arange(H)[:, None] - 540) / 180, 0, 1)
    fill(near, np.clip((smoke - 0.38) * 1.5, 0, 1), '#6a3a3a', 0.4)
    save(near, f'{out}/near.png')

    def detail(tmp, m, x0, x1, y, bot, is_ground, rng):
        seams = mask(W, H, lambda d, k: [d.line([(x * k, (y + 18) * k), ((x - 20) * k, bot * k)], fill=255, width=max(1, int(2 * k))) for x in np.arange(x0 + 80, x1, 110)])
        fill(tmp, seams * m, '#ff8a3a', 0.85); glow(tmp, seams * m, '#ff6a20', 6, 0.6, alpha_too=False)
        bolts = mask(W, H, lambda d, k: [ell(d, k, x, y + 34, 3, 3, fill=255) for x in np.arange(x0 + 25, x1, 40)])
        add_light(tmp, bolts * m, '#c09080', 0.6)
    def trim(tmp, m, x0, x1, y, cap_h, rng):
        grate = mask(W, H, lambda d, k: [d.line([(x * k, (y + 3) * k), (x * k, (y + cap_h - 2) * k)], fill=255, width=max(1, int(1.4 * k))) for x in np.arange(x0 + 6, x1, 8)])
        shade(tmp, grate * m, -0.35)
    mat = dict(body_top='#3a1e24', body_bot='#12080a', cap_col='#6a4a48', cap_hi='#f0c8a8', cap=14, depth=120, taper=60,
               detail=detail, trim=trim, plat_body='#2a1a1c', plat_cap='#7a5a52')
    terr = paint_terrain(stage, mat)
    save(terr, f'{out}/terrain.png')
    # hover lift sprite: platform + thruster glow below
    p = next(p for p in stage['platforms'] if p.get('move'))
    lw, lh = p['w'] + 40, 70
    lift = layer(lw, lh)
    x0, x1 = 20, 20 + p['w']
    body = mask(lw, lh, lambda d, k: d.rounded_rectangle([x0 * k, 8 * k, x1 * k, 26 * k], radius=5 * k, fill=255))
    fill(lift, body, '#3a2420')
    cap = mask(lw, lh, lambda d, k: d.rounded_rectangle([x0 * k, 8 * k, x1 * k, 14 * k], radius=3 * k, fill=255))
    fill(lift, cap, '#9a7a6a')
    hz = mask(lw, lh, lambda d, k: [poly(d, k, [(x, 18), (x + 8, 18), (x + 14, 24), (x + 6, 24)], fill=255) for x in range(x0 + 6, x1 - 10, 16)])
    fill(lift, hz, '#f2b632', 0.85)
    th = mask(lw, lh, lambda d, k: [d.rounded_rectangle([(cx - 16) * k, 26 * k, (cx + 16) * k, 34 * k], radius=3 * k, fill=255) for cx in (x0 + 40, x1 - 40)])
    fill(lift, th, '#201010')
    jet = mask(lw, lh, lambda d, k: [poly(d, k, [(cx - 12, 34), (cx + 12, 34), (cx + 4, 64), (cx - 4, 64)], fill=255) for cx in (x0 + 40, x1 - 40)], blur=3)
    fill(lift, jet, '#ffb05a', 0.85); glow(lift, jet, '#ff7a20', 8, 0.7)
    save(lift, f'{out}/lift.png')


# ===================================================== 3. Brimstone Caldera
def brimstone_caldera(stage, out, paint_terrain, paint_platform):
    rng = np.random.default_rng(303)
    sky = vgrad(LW, H, [(0, '#120606'), (0.35, '#3a120a'), (0.65, '#8a3412'), (0.85, '#d86a1a'), (1, '#ffb040')])
    clouds = fbm(LW, H, 260, 5, 31)
    cm = np.clip((clouds - 0.45) * 2.2, 0, 1) * np.clip(1 - np.arange(H)[:, None] / 500, 0, 1)
    fill(sky, cm, '#2a0e0a', 0.85)
    add_light(sky, np.clip((clouds - 0.6) * 3, 0, 1) * np.clip(np.arange(H)[:, None] / 400, 0, 1), '#ff6a20', 0.35)
    # volcano silhouette with eruption
    vol = mask(LW, H, lambda d, k: poly(d, k, [(260, 720), (600, 300), (660, 280), (780, 284), (850, 310), (1220, 720)], fill=255))
    fill(sky, vol, '#2a0c08')
    shade(sky, vol * np.linspace(0, 0.4, H)[:, None], 0.0)
    lava = mask(LW, H, lambda d, k: [d.line([(x * k, y * k) for x, y in path], fill=255, width=int(6 * k)) for path in [
        [(700, 286), (690, 360), (650, 430), (630, 520), (590, 620), (560, 720)],
        [(760, 290), (790, 380), (830, 470), (900, 580), (960, 720)]]], blur=1)
    fill(sky, lava, '#ff7a1a'); add_light(sky, blur(lava, 14), '#ff5a10', 0.8)
    plume = fbm(LW, H, 90, 5, 33)
    pm = mask(LW, H, lambda d, k: poly(d, k, [(660, 290), (790, 290), (980, -20), (440, -20)], fill=255), blur=40) * np.clip((plume - 0.3) * 2.2, 0, 1)
    fill(sky, pm, '#3a1a14', 0.9)
    crater = mask(LW, H, lambda d, k: ell(d, k, 720, 286, 70, 14, fill=255))
    fill(sky, crater, '#ffd060'); add_light(sky, blur(crater, 60), '#ff7020', 1.0); add_light(sky, blur(crater, 160), '#ff5010', 0.5)
    # distant jagged ridges
    ridge = mask(LW, H, lambda d, k: poly(d, k, [(0, 720), (0, 520)] + [(x, 500 + 40 * math.sin(x / 70) + rng.uniform(-25, 25)) for x in range(0, LW + 40, 40)] + [(LW, 720)], fill=255))
    fill(sky, ridge, '#3a120a', 0.9)
    brushwork(sky, 0.06, 34); grain(sky, 0.015, 34)
    save_jpg(sky, f'{out}/sky.jpg')

    far = layer(LW, H)
    # sulfur crystal clusters + fumaroles on mid-distance cliffs
    cliffs = mask(LW, H, lambda d, k: [poly(d, k, [(0, 720), (0, 380), (120, 360), (230, 420), (300, 520), (340, 720)], fill=255),
                                      poly(d, k, [(LW, 720), (LW, 360), (1310, 380), (1210, 430), (1140, 540), (1110, 720)], fill=255)])
    fill(far, cliffs, '#241008')
    shade(far, cliffs * np.clip(fbm(LW, H, 60, 3, 35) - 0.5, -0.5, 0.5) * 2, 0.4)
    for cx, cy, s, n in [(150, 400, 1.0, 7), (1300, 400, 1.1, 8), (260, 470, 0.7, 5), (1180, 480, 0.7, 5)]:
        cr = mask(LW, H, lambda d, k, cx=cx, cy=cy, s=s, n=n: [poly(d, k, [(cx + dx - 9 * s, cy), (cx + dx + 9 * s, cy), (cx + dx + 4 * s + lean, cy - hgt * s), (cx + dx - 2 * s + lean, cy - hgt * s - 8 * s)], fill=255)
                                                          for dx, hgt, lean in [(rng.uniform(-40, 40) * s, rng.uniform(40, 110), rng.uniform(-20, 20)) for _ in range(n)]])
        fill(far, cr, '#e8c020')
        shade(far, cr * np.linspace(0.3, -0.3, LW)[None, :], 0.6)
        glow(far, cr, '#ffe060', 14, 0.35)
    vents = mask(LW, H, lambda d, k: [ell(d, k, x, y, 60, 120, fill=255) for x, y in [(220, 270), (1250, 260)]], blur=30)
    fill(far, vents * fbm(LW, H, 50, 4, 36), '#e8d070', 0.35)
    haze(far, 0, 720, '#8a3412', 0.25)
    grain(far, 0.015, 37)
    save(far, f'{out}/far.png')

    mid = layer(LW, H)
    # lava lake below the slab
    lake = mask(LW, H, lambda d, k: d.rectangle([0, 640 * k, LW * k, 720 * k], fill=255))
    n = fbm(LW, H, 40, 4, 38)
    col = np.stack([np.ones((H, LW)), 0.35 + 0.45 * n, 0.08 + 0.15 * n], -1).astype(np.float32)
    fill(mid, lake, col)
    crust = np.clip((n - 0.55) * 4, 0, 1) * lake
    fill(mid, crust, '#3a1008', 0.85)
    glow(mid, lake, '#ff6a10', 30, 0.6)
    # rock pillars rising from the lake on the flanks
    pil = mask(LW, H, lambda d, k: [poly(d, k, [(30, 720), (50, 520), (90, 500), (130, 540), (150, 720)], fill=255),
                                   poly(d, k, [(LW - 30, 720), (LW - 60, 510), (LW - 100, 495), (LW - 140, 540), (LW - 160, 720)], fill=255)])
    fill(mid, pil, '#1a0806')
    rim = mask(LW, H, lambda d, k: [poly(d, k, [(50, 520), (90, 500), (94, 506), (56, 526)], fill=255), poly(d, k, [(LW - 60, 510), (LW - 100, 495), (LW - 104, 501), (LW - 66, 516)], fill=255)])
    fill(mid, rim, '#ff8a3a', 0.8)
    save(mid, f'{out}/mid.png')

    near = layer(LW, H)
    ash = fbm(LW, H, 160, 4, 39)
    fill(near, np.clip((ash - 0.5) * 1.5, 0, 1) * np.clip(1 - np.arange(H)[:, None] / 260, 0, 1), '#2a1410', 0.5)
    heat = fbm(LW, H, 80, 3, 40) * np.clip((np.arange(H)[:, None] - 560) / 160, 0, 1)
    fill(near, np.clip((heat - 0.3) * 1.4, 0, 1), '#ff9a40', 0.25)
    save(near, f'{out}/near.png')

    def detail(tmp, m, x0, x1, y, bot, is_ground, rng):
        cracks = mask(W, H, lambda d, k: [d.line([(x * k, (y + 18) * k), ((x + rng.uniform(-30, 30)) * k, (y + 50) * k), ((x + rng.uniform(-40, 40)) * k, bot * k)], fill=255, width=max(1, int(2.2 * k))) for x in np.arange(x0 + 50, x1, 85)])
        fill(tmp, cracks * m, '#ff7a1a'); glow(tmp, cracks * m, '#ff5a10', 7, 0.8, alpha_too=False)
        cols = mask(W, H, lambda d, k: [d.line([(x * k, (y + 16) * k), (x * k, bot * k)], fill=255, width=max(1, int(1.2 * k))) for x in np.arange(x0 + 20, x1, 34)])
        shade(tmp, cols * m, -0.3)
        hot = np.clip((np.arange(H)[:, None] - (bot - 40)) / 40, 0, 1) * m
        add_light(tmp, hot, '#ff6a20', 0.5)
    def trim(tmp, m, x0, x1, y, cap_h, rng):
        cr = mask(W, H, lambda d, k: [poly(d, k, [(cx - 7, y + 2), (cx + 7, y + 2), (cx + 3 + lean, y - 20), (cx - 2 + lean, y - 26)], fill=255)
                                     for cx, lean in [(x0 + 18, -6), (x0 + 34, 4), (x0 + 46, -2), (x1 - 20, 6), (x1 - 36, -4), (x1 - 50, 2)]])
        fill(tmp, cr, '#f0c828'); shade(tmp, cr * np.linspace(0.3, -0.3, W)[None, :], 0.5)
    mat = dict(body_top='#3a1a12', body_bot='#140806', cap_col='#5a3426', cap_hi='#f0b080', cap=14, depth=130, taper=80,
               detail=detail, trim=trim, plat_body='#2a1410', plat_cap='#6a4030')
    terr = paint_terrain(stage, mat)
    save(terr, f'{out}/terrain.png')


# =========================================================== 4. Neon Nexus
def neon_nexus(stage, out, paint_terrain, paint_platform):
    rng = np.random.default_rng(404)
    sky = vgrad(LW, H, [(0, '#05030f'), (0.4, '#140a30'), (0.75, '#3a1660'), (1, '#6a2a7a')])
    stars = mask(LW, H, lambda d, k: [ell(d, k, rng.uniform(0, LW), rng.uniform(0, 280), 0.9, 0.9, fill=255) for _ in range(160)])
    add_light(sky, stars, '#e0d8ff', 0.6)
    moon = mask(LW, H, lambda d, k: ell(d, k, 1120, 120, 52, 52, fill=255))
    fill(sky, moon, '#f0e0ff'); add_light(sky, blur(moon, 50), '#b090ff', 0.5)
    # three depths of skyline
    for depth, (ymin, ymax, col, win, wcol) in enumerate([(260, 420, '#1e1240', 0.25, '#8a6aff'), (330, 470, '#160c30', 0.45, '#ff8ad8'), (400, 520, '#0e0820', 0.6, '#7ae8ff')]):
        xs = 0
        blds = []
        while xs < LW:
            bw = rng.uniform(50, 120); top = rng.uniform(ymin, ymax); blds.append((xs, xs + bw, top)); xs += bw + rng.uniform(0, 14)
        m = mask(LW, H, lambda d, k: [d.rectangle([x0 * k, t * k, x1 * k, H * k], fill=255) for x0, x1, t in blds] +
                 [d.rectangle([((x0 + x1) / 2 - 2) * k, (t - rng.uniform(10, 50)) * k, ((x0 + x1) / 2 + 2) * k, t * k], fill=255) for x0, x1, t in blds[::3]])
        fill(sky, m, col)
        wm = mask(LW, H, lambda d, k: [d.rectangle([(x0 + 6 + i * 12) * k, (t + 10 + j * 16) * k, (x0 + 12 + i * 12) * k, (t + 18 + j * 16) * k], fill=255)
                                      for x0, x1, t in blds for i in range(int((x1 - x0 - 10) / 12)) for j in range(int((H - t) / 16)) if rng.random() < win * 0.5])
        add_light(sky, wm * m, wcol, 0.55)
        haze(sky, 200, 720, '#4a1e6a', 0.18)
    # neon signs in the distance
    for sx, sy, col, txt in [(220, 360, '#ff4fd8', 'Ne'), (700, 300, '#4ff0ff', 'Ar'), (1180, 340, '#ffd04f', 'Kr')]:
        box = mask(LW, H, lambda d, k, sx=sx, sy=sy: d.rounded_rectangle([(sx - 40) * k, (sy - 28) * k, (sx + 40) * k, (sy + 28) * k], radius=8 * k, outline=255, width=int(3 * k)))
        add_light(sky, box, col, 0.9); add_light(sky, blur(box, 16), col, 0.6)
    brushwork(sky, 0.05, 41); grain(sky, 0.015, 41)
    save_jpg(sky, f'{out}/sky.jpg')

    far = layer(LW, H)
    # mid towers with vertical neon tubes
    for x0, x1, t, col in [(30, 190, 250, '#ff4fd8'), (1250, 1420, 230, '#4ff0ff'), (420, 520, 330, '#a06aff'), (920, 1030, 320, '#ffd04f')]:
        m = mask(LW, H, lambda d, k: d.rectangle([x0 * k, t * k, x1 * k, H * k], fill=255))
        fill(far, m, '#120a26')
        tube = mask(LW, H, lambda d, k: [d.rectangle([(x0 + 10) * k, (t + 20) * k, (x0 + 14) * k, (H - 60) * k], fill=255), d.rectangle([(x1 - 14) * k, (t + 20) * k, (x1 - 10) * k, (H - 60) * k], fill=255)])
        fill(far, tube, col); glow(far, tube, col, 14, 0.7)
        wm = mask(LW, H, lambda d, k: [d.rectangle([(x0 + 24 + i * 16) * k, (t + 30 + j * 22) * k, (x0 + 32 + i * 16) * k, (t + 42 + j * 22) * k], fill=255)
                                      for i in range(int((x1 - x0 - 40) / 16)) for j in range(int((H - t - 60) / 22)) if rng.random() < 0.4])
        add_light(far, wm * m, '#ffe8b0', 0.5)
    haze(far, 0, 720, '#3a1660', 0.25)
    band = np.exp(-((np.arange(H) - 400) / 150.0) ** 2)[:, None] * far[..., 3]
    far[..., :3] = far[..., :3] * (1 - 0.3 * band[..., None]) + hexc('#3a1660')[:3] * 0.3 * band[..., None]
    grain(far, 0.015, 42)
    save(far, f'{out}/far.png')

    mid = layer(LW, H)
    # hovering traffic lights / airship
    ship = mask(LW, H, lambda d, k: [ell(d, k, 520, 120, 90, 22, fill=255), d.rectangle([480 * k, 138 * k, 560 * k, 150 * k], fill=255)])
    fill(mid, ship, '#1a1030')
    sl = mask(LW, H, lambda d, k: [ell(d, k, x, 120, 3, 3, fill=255) for x in range(450, 600, 18)])
    fill(mid, sl, '#ff8ad8'); glow(mid, sl, '#ff4fd8', 8, 0.8)
    beam = mask(LW, H, lambda d, k: poly(d, k, [(510, 150), (530, 150), (600, 420), (440, 420)], fill=255), blur=10)
    fill(mid, beam, '#d8b0ff', 0.12)
    cars = mask(LW, H, lambda d, k: [ell(d, k, x, y, 6, 2, fill=255) for x, y in scatter(rng, 30, 0, LW, 180, 280)])
    fill(mid, cars, '#ffe0a0'); glow(mid, cars, '#ffb050', 5, 0.6)
    save(mid, f'{out}/mid.png')

    near = layer(LW, H)
    # rooftop clutter at the screen edges (antennas, AC units) -- behind the roof line
    cl = mask(LW, H, lambda d, k: [d.rectangle([90 * k, 520 * k, 150 * k, 562 * k], fill=255), d.rectangle([1300 * k, 512 * k, 1370 * k, 562 * k], fill=255),
                                  d.line([(120 * k, 520 * k), (120 * k, 440 * k)], fill=255, width=int(3 * k)), d.line([(1335 * k, 512 * k), (1335 * k, 420 * k)], fill=255, width=int(3 * k))])
    fill(near, cl, '#0a0616')
    tip = mask(LW, H, lambda d, k: [ell(d, k, 120, 438, 4, 4, fill=255), ell(d, k, 1335, 418, 4, 4, fill=255)])
    fill(near, tip, '#ff3a5a'); glow(near, tip, '#ff2a4a', 12, 1.0)
    save(near, f'{out}/near.png')

    def detail(tmp, m, x0, x1, y, bot, is_ground, rng):
        # building facade below the roof: windows lit in neon tints
        win = mask(W, H, lambda d, k: [d.rectangle([(x + 6) * k, (yy + 6) * k, (x + 30) * k, (yy + 28) * k], fill=255)
                                      for x in np.arange(x0 + 20, x1 - 30, 46) for yy in np.arange(y + 40, H, 44)])
        cols = np.zeros((H, W, 3), np.float32) + hexc('#2a1a50')[:3]
        lit = mask(W, H, lambda d, k: [d.rectangle([(x + 6) * k, (yy + 6) * k, (x + 30) * k, (yy + 28) * k], fill=255)
                                      for x in np.arange(x0 + 20, x1 - 30, 46) for yy in np.arange(y + 40, H, 44) if rng.random() < 0.45])
        fill(tmp, win * m, '#160e2c')
        tint = np.zeros((H, W, 3), np.float32)
        xx = np.arange(W)[None, :]
        tint[...] = np.where(((xx // 46) % 3 == 0)[..., None], hexc('#ff8ad8')[:3], np.where(((xx // 46) % 3 == 1)[..., None], hexc('#ffcf8a')[:3], hexc('#7ae8ff')[:3]))
        fill(tmp, blur(lit, 1.0) * m, tint, 0.45)
        neon = mask(W, H, lambda d, k: d.rectangle([x0 * k, (y + 22) * k, x1 * k, (y + 25) * k], fill=255)) * m
        fill(tmp, neon, '#ff5fe0'); glow(tmp, neon, '#ff3fd0', 8, 0.8, alpha_too=False)
    def trim(tmp, m, x0, x1, y, cap_h, rng):
        pass
    def plat_trim(tmp, x0, x1, y, th):
        # sign face hanging below the walkable top, glowing letters
        face = mask(W, H, lambda d, k: d.rounded_rectangle([(x0 + 10) * k, (y + th) * k, (x1 - 10) * k, (y + th + 56) * k], radius=6 * k, fill=255))
        fill(tmp, face, '#160c2a')
        cx = (x0 + x1) / 2
        col = '#4ff0ff' if cx < 640 else '#ff5fe0'
        rim = mask(W, H, lambda d, k: d.rounded_rectangle([(x0 + 14) * k, (y + th + 4) * k, (x1 - 14) * k, (y + th + 52) * k], radius=5 * k, outline=255, width=int(2 * k)))
        fill(tmp, rim, col); glow(tmp, rim, col, 10, 0.7)
        bars = mask(W, H, lambda d, k: [d.rounded_rectangle([(cx - 60 + i * 26) * k, (y + th + 16) * k, (cx - 46 + i * 26) * k, (y + th + 40) * k], radius=4 * k, outline=255, width=int(2 * k)) for i in range(5)])
        fill(tmp, bars, col); glow(tmp, bars, col, 8, 0.5)
        legs = mask(W, H, lambda d, k: [d.rectangle([(x0 + 30) * k, (y + th + 56) * k, (x0 + 36) * k, 560 * k], fill=255), d.rectangle([(x1 - 36) * k, (y + th + 56) * k, (x1 - 30) * k, 560 * k], fill=255)])
        fill(tmp, legs, '#0e0820')
    mat = dict(body_top='#1e1438', body_bot='#0c0818', cap_col='#3a3050', cap_hi='#d8c8ff', cap=12, to_bottom=True,
               detail=detail, trim=trim, plat_body='#241a3a', plat_cap='#5a4a7a', plat_trim=plat_trim)
    terr = paint_terrain(stage, mat)
    save(terr, f'{out}/terrain.png')


# ========================================================= 5. Holdout Keep
def holdout_keep(stage, out, paint_terrain, paint_platform):
    rng = np.random.default_rng(505)
    sky = vgrad(LW, H, [(0, '#1e2448'), (0.35, '#4a4a78'), (0.6, '#c27a6a'), (0.78, '#f0a860'), (1, '#ffd890')])
    sun = mask(LW, H, lambda d, k: ell(d, k, 980, 385, 64, 64, fill=255))
    fill(sky, sun, '#fff0c0'); add_light(sky, blur(sun, 60), '#ffc070', 0.8); add_light(sky, blur(sun, 200), '#ff9a50', 0.45)
    add_light(sky, rays(LW, H, (980, 385), list(range(180, 360, 18)), 4, 900), '#ffd8a0', 0.12)
    clouds = fbm(LW, H, 220, 5, 51)
    cm = np.clip((clouds - 0.5) * 2.5, 0, 1) * np.exp(-((np.arange(H)[:, None] - 220) / 120) ** 2)
    fill(sky, cm, '#e8a0a0', 0.55)
    fill(sky, np.clip((clouds - 0.62) * 3, 0, 1) * np.exp(-((np.arange(H)[:, None] - 200) / 100) ** 2), '#fff0e0', 0.4)
    # far mountains
    for yb, col, amp, seed in [(470, '#6a5a88', 70, 1), (520, '#4a3e6a', 50, 2)]:
        r2 = np.random.default_rng(seed)
        pts = [(x, yb - amp * (0.5 + 0.5 * math.sin(x / 110 + seed)) - r2.uniform(0, 30)) for x in range(-20, LW + 60, 40)]
        m = mask(LW, H, lambda d, k, pts=pts: poly(d, k, [(-20, 720)] + pts + [(LW + 60, 720)], fill=255))
        fill(sky, m, col)
    haze(sky, 380, 720, '#e0a080', 0.25)
    brushwork(sky, 0.06, 52); grain(sky, 0.015, 52)
    save_jpg(sky, f'{out}/sky.jpg')

    far = layer(LW, H)
    # the kingdom's castle town: towers with conical roofs and lit windows
    towers = [(140, 70, 300), (300, 50, 360), (470, 90, 260), (1000, 80, 270), (1170, 56, 340), (1320, 74, 290)]
    for tx, tw, top in towers:
        m = mask(LW, H, lambda d, k, tx=tx, tw=tw, top=top: [d.rectangle([(tx - tw / 2) * k, top * k, (tx + tw / 2) * k, H * k], fill=255),
                                                          poly(d, k, [(tx - tw / 2 - 8, top), (tx + tw / 2 + 8, top), (tx, top - tw * 1.3)], fill=255)])
        fill(far, m, '#3a2e52')
        lit = mask(LW, H, lambda d, k, tx=tx, tw=tw, top=top: poly(d, k, [(tx + 4, top), (tx + tw / 2 + 8, top), (tx, top - tw * 1.3)], fill=255))
        fill(far, lit, '#8a5a6a', 0.7)
        win = mask(LW, H, lambda d, k, tx=tx, top=top: [d.rounded_rectangle([(tx - 5) * k, (top + 30 + j * 46) * k, (tx + 5) * k, (top + 48 + j * 46) * k], radius=4 * k, fill=255) for j in range(4)])
        fill(far, win, '#ffd890'); glow(far, win, '#ffb050', 10, 0.6)
        flag = mask(LW, H, lambda d, k, tx=tx, tw=tw, top=top: [d.line([(tx * k, (top - tw * 1.3) * k), (tx * k, (top - tw * 1.3 - 30) * k)], fill=255, width=int(2 * k)),
                                                             poly(d, k, [(tx, top - tw * 1.3 - 30), (tx + 26, top - tw * 1.3 - 24), (tx, top - tw * 1.3 - 16)], fill=255)])
        fill(far, flag, '#d84a4a')
    wall = mask(LW, H, lambda d, k: [d.rectangle([0, 470 * k, LW * k, H * k], fill=255)] + [d.rectangle([x * k, 456 * k, (x + 18) * k, 470 * k], fill=255) for x in range(0, LW, 30)])
    fill(far, wall, '#2e2444')
    haze(far, 0, 720, '#c08080', 0.3)
    band = np.exp(-((np.arange(H) - 400) / 150.0) ** 2)[:, None] * far[..., 3]
    far[..., :3] = far[..., :3] * (1 - 0.25 * band[..., None]) + hexc('#c08080')[:3] * 0.25 * band[..., None]
    brushwork(far, 0.05, 53); grain(far, 0.015, 53)
    save(far, f'{out}/far.png')

    mid = layer(LW, H)
    # banners hanging from the keep + birds
    for bx in (420, 1020):
        ban = mask(LW, H, lambda d, k, bx=bx: poly(d, k, [(bx - 28, 120), (bx + 28, 120), (bx + 28, 300), (bx, 280), (bx - 28, 300)], fill=255))
        fill(mid, ban, '#8a2a3a')
        emb = mask(LW, H, lambda d, k, bx=bx: [ell(d, k, bx, 190, 14, 14, outline=255, width=int(3 * k)), d.line([(bx * k, 172 * k), (bx * k, 208 * k)], fill=255, width=int(3 * k))])
        fill(mid, emb, '#f0c860')
        pole = mask(LW, H, lambda d, k, bx=bx: d.rectangle([(bx - 36) * k, 114 * k, (bx + 36) * k, 120 * k], fill=255))
        fill(mid, pole, '#3a2a20')
    birds = mask(LW, H, lambda d, k: [d.line([((x - 8) * k, (y - 3) * k), (x * k, y * k), ((x + 8) * k, (y - 3) * k)], fill=255, width=max(1, int(1.6 * k))) for x, y in scatter(rng, 9, 600, 900, 140, 230)])
    fill(mid, birds, '#3a2a40')
    save(mid, f'{out}/mid.png')

    near = layer(LW, H)
    ivy = mask(LW, H, lambda d, k: [ell(d, k, x, y, rng.uniform(6, 14), rng.uniform(5, 10), fill=255) for x, y in scatter(rng, 170, 70, 170, 0, 720) + scatter(rng, 170, LW - 170, LW - 70, 0, 720)])
    fill(near, ivy, '#2a3a2a', 0.95)
    leafhi = mask(LW, H, lambda d, k: [ell(d, k, x, y, 4, 3, fill=255) for x, y in scatter(rng, 80, 70, 170, 0, 720) + scatter(rng, 80, LW - 170, LW - 70, 0, 720)])
    fill(near, leafhi * ivy, '#7a9a5a', 0.7)
    save(near, f'{out}/near.png')

    def detail(tmp, m, x0, x1, y, bot, is_ground, rng):
        rows = mask(W, H, lambda d, k: [d.line([(x0 * k, yy * k), (x1 * k, yy * k)], fill=255, width=max(1, int(1.6 * k))) for yy in np.arange(y + 16 + 26, bot, 26)])
        joints = mask(W, H, lambda d, k: [d.line([(x * k, yy * k), (x * k, (yy + 26) * k)], fill=255, width=max(1, int(1.6 * k)))
                                         for j, yy in enumerate(np.arange(y + 16, bot, 26)) for x in np.arange(x0 + (24 if j % 2 else 0), x1, 48)])
        shade(tmp, (rows + joints).clip(0, 1) * m, -0.4)
        stones = fbm(W, H, 24, 2, 54)
        shade(tmp, (stones - 0.5) * m, 0.35)
        moss = np.clip((fbm(W, H, 30, 3, 55) - 0.6) * 3, 0, 1) * np.clip(1 - (np.arange(H)[:, None] - y) / 60, 0, 1) * m
        fill(tmp, moss, '#5a7a3a', 0.6)
        warm = np.clip(np.linspace(-0.2, 0.25, W)[None, :], 0, 1) * m
        add_light(tmp, warm, '#ffb070', 0.25)
    def trim(tmp, m, x0, x1, y, cap_h, rng):
        pass
    def plat_trim(tmp, x0, x1, y, th):
        brk = mask(W, H, lambda d, k: [poly(d, k, [(x0 + 12, y + th), (x0 + 30, y + th), (x0 + 22, y + th + 34)], fill=255), poly(d, k, [(x1 - 12, y + th), (x1 - 30, y + th), (x1 - 22, y + th + 34)], fill=255)])
        fill(tmp, brk, '#4a3a3a')
        ban = mask(W, H, lambda d, k: poly(d, k, [((x0 + x1) / 2 - 20, y + th), ((x0 + x1) / 2 + 20, y + th), ((x0 + x1) / 2 + 20, y + th + 46), ((x0 + x1) / 2, y + th + 36), ((x0 + x1) / 2 - 20, y + th + 46)], fill=255))
        fill(tmp, ban, '#8a2a3a')
    mat = dict(body_top='#7a6a7a', body_bot='#3a2e3e', cap_col='#a89098', cap_hi='#ffe8d0', cap=14, to_bottom=True,
               detail=detail, trim=trim, plat_body='#5a4a52', plat_cap='#b09aa0', plat_trim=plat_trim)
    terr = paint_terrain(stage, mat)
    save(terr, f'{out}/terrain.png')
