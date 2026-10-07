"""Painter for the big camera stage (Carbon Skyhook) -- same code-painted
toolkit as the other story stages, but every layer is world-sized
(2560x1440) and painted in world coordinates: at full zoom-out the layers
stack 1:1 (BattleScene offsets each by its scrollFactor so that holds).

  sky.jpg   opaque: high-altitude dusk, stars, moon, the planet's limb and
            a sunset-lit cloud sea far below
  far.png   distant peaks through the clouds, other skyhook tethers, a faint
            orbital ring
  mid.png   the station's lattice towers, docking ring, cargo stacks
  near.png  big girders/cable bundles framing the top corners, low cloud
  terrain.png  the playable decks/platforms (1:1 with the geometry), the
            lift shaft rails and the carbon-nanotube tether
  lift.png  the cargo climber (moving platform), walkable top at row 8
Layers stay separate so a Gemini remaster can redo each one.
"""
import math
import numpy as np
from PIL import Image
from paintlib import *


def carbon_skyhook(stage, out, paint_terrain, paint_platform):
    WW, WH = stage['world']['width'], stage['world']['height']
    M = lambda fn, b=0: mask(WW, WH, fn, blur=b)
    rng = np.random.default_rng(61)
    HZ = 900  # horizon (planet limb) height at the center of the world

    # =================================================================== sky
    hz = HZ / WH
    sky = vgrad(WW, WH, [(0, '#04060e'), (hz * 0.28, '#0a1029'), (hz * 0.56, '#18214a'), (hz * 0.78, '#36386a'),
                         (hz * 0.89, '#7a4f72'), (hz * 0.95, '#d0735e'), (hz * 0.98, '#f2a865'), (hz, '#ffd08a'),
                         (hz + 0.03, '#c98e7e'), (hz + 0.15, '#6d6690'), (1, '#3c4170')])
    # stars, fading out toward the horizon glow
    pts = [(rng.uniform(0, WW), rng.uniform(0, HZ * 0.8), rng.uniform(0.6, 1.9)) for _ in range(900)]
    st = M(lambda d, k: [d.ellipse([(x - r) * k, (y - r) * k, (x + r) * k, (y + r) * k], fill=255) for x, y, r in pts])
    fade = np.clip(1 - np.arange(WH) / (HZ * 0.85), 0, 1)[:, None] ** 1.4
    add_light(sky, st * fade, '#e8f0ff', 0.85)
    big = [(rng.uniform(0, WW), rng.uniform(0, HZ * 0.55)) for _ in range(26)]
    bs = M(lambda d, k: [d.ellipse([(x - 2.4) * k, (y - 2.4) * k, (x + 2.4) * k, (y + 2.4) * k], fill=255) for x, y in big])
    glow(sky, bs * fade, '#bcd4ff', 5, 0.7, alpha_too=False)
    # milky band
    band = fbm(WW, WH, 260, 5, 3) * M(lambda d, k: d.polygon([(0, 120 * k), (WW * k, 520 * k), (WW * k, 760 * k), (0, 330 * k)], fill=255), 90)
    add_light(sky, np.clip(band - 0.25, 0, 1) * fade, '#8f9ed8', 0.35)
    # moon
    mx, my, mr = 790, 200, 80
    moon = M(lambda d, k: d.ellipse([(mx - mr) * k, (my - mr) * k, (mx + mr) * k, (my + mr) * k], fill=255))
    glow(sky, moon, '#c9d6ff', 60, 0.45, alpha_too=False)
    mcol = np.zeros((WH, WW, 3), np.float32); mcol[:] = hexc('#e6e9f5')[:3]
    fill(sky, moon, mcol)
    crat = fbm(WW, WH, 40, 3, 17)
    shade(sky, moon * np.clip(crat - 0.45, 0, 1) * 1.6, -0.35)
    term = M(lambda d, k: d.ellipse([(mx - mr + 34) * k, (my - mr - 10) * k, (mx + mr + 60) * k, (my + mr + 10) * k], fill=255), 10)
    shade(sky, moon * term, -0.55)
    # planet limb: a huge arc; everything under it is the cloud sea
    R = 5200
    cy = HZ + R
    limb = M(lambda d, k: d.ellipse([(WW / 2 - R) * k, (HZ) * k, (WW / 2 + R) * k, (HZ + 2 * R) * k], fill=255), 2)
    rim = M(lambda d, k: d.ellipse([(WW / 2 - R) * k, (HZ - 6) * k, (WW / 2 + R) * k, (HZ + 2 * R - 6) * k], outline=255, width=int(7 * k)), 4)
    glow(sky, rim, '#ffd59a', 40, 0.9, alpha_too=False)
    glow(sky, rim, '#ff9a6a', 120, 0.5, alpha_too=False)
    yy = np.arange(WH)[:, None].astype(np.float32)
    xx = np.arange(WW)[None, :].astype(np.float32)
    depth = np.clip((yy - HZ) / (WH - HZ), 0, 1)
    c1 = fbm(WW, WH, 140, 5, 21)
    c2 = fbm(WW, WH, 50, 3, 22)
    # flatten noise vertically so clouds read as a receding sea
    cl = np.clip((c1 * 0.75 + c2 * 0.35) - 0.38, 0, 1) * 1.8
    sun_x = 1780
    sunlit = np.exp(-((xx - sun_x) / 900) ** 2) * (1 - depth) ** 1.2
    ccol = np.zeros((WH, WW, 3), np.float32)
    lo, mid_, hi = hexc('#2f3561')[:3], hexc('#8a7aa8')[:3], hexc('#ffc79a')[:3]
    tcl = np.clip(cl, 0, 1)[..., None]
    base = lo * (1 - tcl) + mid_ * tcl
    ccol[:] = base * (1 - sunlit[..., None] * 0.6) + hi * (sunlit[..., None] * 0.6 * tcl + 0.0)
    fill(sky, limb, ccol)
    haze(sky, HZ - 30, HZ + 140, '#e9a07c', 0.35)
    shade(sky, limb * depth, -0.25)
    # sun glare on the horizon
    sun = M(lambda d, k: d.ellipse([(sun_x - 60) * k, (HZ - 40) * k, (sun_x + 60) * k, (HZ + 30) * k], fill=255), 12)
    glow(sky, sun, '#fff0c0', 80, 0.9, alpha_too=False)
    glow(sky, sun, '#ffb070', 260, 0.5, alpha_too=False)
    # high cirrus streaks
    ci = fbm(WW, WH, 220, 4, 31)
    streak = np.clip(ci - 0.55, 0, 1) * np.exp(-((yy - (HZ - 180)) / 110) ** 2)
    add_light(sky, streak * 2.2, '#f3b38e', 0.5)
    brushwork(sky, 0.05, seed=5)
    grain(sky, 0.015, seed=6)
    save_jpg(sky, f'{out}/sky.jpg', 88)

    # =================================================================== far
    far = layer(WW, WH)
    # distant peaks through the cloud sea, rim-lit from the sunset
    peaks = []
    for cx, w, h in [(260, 520, 210), (700, 380, 150), (1090, 460, 120), (1520, 420, 170), (1980, 560, 240), (2380, 400, 160)]:
        pts = [(cx - w / 2, HZ + 110)]
        n = 7
        for i in range(1, n):
            t = i / n
            py = HZ + 110 - h * (1 - abs(t - 0.5) * 2) ** 0.8 + rng.uniform(-14, 14)
            pts.append((cx - w / 2 + w * t, py))
        pts.append((cx + w / 2, HZ + 110))
        peaks.append(pts)
    pm = M(lambda d, k: [d.polygon([(x * k, y * k) for x, y in p], fill=255) for p in peaks], 1)
    pcol = np.zeros((WH, WW, 3), np.float32)
    pcol[:] = (hexc('#3a3a66')[:3] * (1 - depth[..., None] * 0) )
    fill(far, pm, pcol)
    snow = fbm(WW, WH, 30, 3, 41)
    rimm = pm * np.clip((xx - 0) / WW, 0, 1) * 0  # placeholder
    lit = M(lambda d, k: [d.polygon([(x * k, y * k) for x, y in p], fill=255) for p in peaks], 0)
    shifted = np.roll(lit, -6, axis=1)
    edge = np.clip(lit - shifted, 0, 1)  # right-facing slopes catch the sun
    add_light(far, blur(edge, 3) * 2.0 * pm, '#ffb88a', 0.9)
    shade(far, pm * np.clip(snow - 0.5, 0, 1), 0.4)
    # cloud skirt over the peak bases
    skirt = np.clip(fbm(WW, WH, 90, 4, 43) - 0.35, 0, 1) * np.exp(-((yy - (HZ + 110)) / 40) ** 2) * 2
    fill(far, np.clip(skirt, 0, 1), '#b49ab8', 0.85)
    # other skyhooks far away: hair-thin tethers with climber lights
    for tx, top, a in [(360, 0, 0.55), (2210, 0, 0.5), (1640, 0, 0.25)]:
        tm = M(lambda d, k, tx=tx: d.line([(tx * k, top * k), ((tx + 6) * k, (HZ + 90) * k)], fill=255, width=max(1, int(2 * k))))
        fill(far, tm, '#9aa2d4', a)
        lights = M(lambda d, k, tx=tx: [d.ellipse([(tx + 6 * yy_ / (HZ + 90) - 3) * k, (yy_ - 3) * k, (tx + 6 * yy_ / (HZ + 90) + 3) * k, (yy_ + 3) * k], fill=255)
                                       for yy_ in rng.uniform(80, HZ, 4)])
        glow(far, lights, '#9fe8ff', 8, 0.8)
    # faint orbital ring arcing over the sky
    ring = M(lambda d, k: [d.arc([-900 * k, 140 * k, (WW + 900) * k, 1500 * k], 196, 344, fill=255, width=int(5 * k)),
                           d.arc([-900 * k, 160 * k, (WW + 900) * k, 1520 * k], 196, 344, fill=255, width=int(2 * k))])
    fill(far, ring, '#8d97c8', 0.35)
    rl = M(lambda d, k: [d.ellipse([(x - 2.5) * k, (y - 2.5) * k, (x + 2.5) * k, (y + 2.5) * k], fill=255)
                         for x, y in [(WW / 2 + (WW / 2 + 900) * math.cos(math.radians(a)), 830 + 680 * math.sin(math.radians(a))) for a in range(200, 344, 9)]])
    glow(far, rl, '#aee9ff', 6, 0.8)
    haze(far, HZ - 400, HZ + 200, '#7a6e98', 0.25)
    save(far, f'{out}/far.png')

    # =================================================================== mid
    mid = layer(WW, WH)
    steel_d, steel_l = '#1d2338', '#4a5878'

    def lattice_tower(x0, x1, top, bot, seed):
        r = np.random.default_rng(seed)
        def fn(d, k):
            w = max(1, int(5 * k))
            d.line([(x0 * k, top * k), (x0 * k, bot * k)], fill=255, width=int(10 * k))
            d.line([(x1 * k, top * k), (x1 * k, bot * k)], fill=255, width=int(10 * k))
            step = (x1 - x0) * 1.1
            y = top
            while y < bot:
                d.line([(x0 * k, y * k), (x1 * k, (y + step) * k)], fill=255, width=w)
                d.line([(x1 * k, y * k), (x0 * k, (y + step) * k)], fill=255, width=w)
                d.line([(x0 * k, y * k), (x1 * k, y * k)], fill=255, width=w)
                y += step
            # crown
            d.polygon([((x0 - 20) * k, top * k), ((x1 + 20) * k, top * k), ((x1 + 6) * k, (top - 40) * k), ((x0 - 6) * k, (top - 40) * k)], fill=255)
        m = M(fn, 0.6)
        fill(mid, m, steel_d)
        hl = M(lambda d, k: d.line([((x0 + 3) * k, top * k), ((x0 + 3) * k, bot * k)], fill=255, width=max(1, int(2 * k))))
        fill(mid, hl, steel_l, 0.8)
        # beacons + aviation strip lights
        bc = M(lambda d, k: d.ellipse([((x0 + x1) / 2 - 7) * k, (top - 58) * k, ((x0 + x1) / 2 + 7) * k, (top - 44) * k], fill=255))
        glow(mid, bc, '#ff4a3a', 14, 1.0); fill(mid, bc, '#ffd0c0')
        ls = M(lambda d, k: [d.ellipse([(xx_ - 3) * k, (y - 3) * k, (xx_ + 3) * k, (y + 3) * k], fill=255)
                             for y in np.arange(top + 120, bot, 160) for xx_ in (x0, x1)])
        glow(mid, ls, '#ffb35a', 7, 0.8); fill(mid, ls, '#ffe2b0')

    lattice_tower(150, 300, 170, WH + 20, 1)
    lattice_tower(WW - 300, WW - 150, 170, WH + 20, 2)
    # stay cables from the tower crowns toward the shaft head
    cab = M(lambda d, k: [d.line([(225 * k, 150 * k), (1120 * k, 400 * k)], fill=255, width=int(3 * k)),
                          d.line([((WW - 225) * k, 150 * k), (1440 * k, 400 * k)], fill=255, width=int(3 * k)),
                          d.line([(225 * k, 420 * k), (1100 * k, 420 * k)], fill=255, width=int(2 * k)),
                          d.line([((WW - 225) * k, 420 * k), (1460 * k, 420 * k)], fill=255, width=int(2 * k))])
    fill(mid, cab, '#3b4566', 0.7)
    # docking ring around the tether, above the summit
    rx, ry, rcx, rcy = 560, 105, WW / 2, 300
    ringm = M(lambda d, k: d.ellipse([(rcx - rx) * k, (rcy - ry) * k, (rcx + rx) * k, (rcy + ry) * k], outline=255, width=int(30 * k)), 0.6)
    rcol = np.zeros((WH, WW, 3), np.float32)
    rcol[:] = (hexc('#2a3150')[:3] * (1 - np.clip((yy - (rcy - ry)) / (2 * ry), 0, 1)[..., None]) + hexc('#151a2c')[:3] * np.clip((yy - (rcy - ry)) / (2 * ry), 0, 1)[..., None])
    fill(mid, ringm, rcol)
    ringhi = M(lambda d, k: d.ellipse([(rcx - rx + 4) * k, (rcy - ry + 4) * k, (rcx + rx - 4) * k, (rcy + ry - 4) * k], outline=255, width=int(3 * k)))
    fill(mid, ringhi * (yy < rcy), '#8ea2c8', 0.7)
    rl = M(lambda d, k: [d.ellipse([(rcx + (rx - 15) * math.cos(a) - 4) * k, (rcy + (ry - 15) * math.sin(a) - 4) * k,
                                    (rcx + (rx - 15) * math.cos(a) + 4) * k, (rcy + (ry - 15) * math.sin(a) + 4) * k], fill=255)
                         for a in np.linspace(0, 2 * math.pi, 28, endpoint=False)])
    glow(mid, rl, '#5fe2ff', 10, 0.9); fill(mid, rl, '#d8fbff')
    # spokes from the ring to the tether hub
    sp = M(lambda d, k: [d.line([(rcx * k, rcy * k), ((rcx + rx * math.cos(a)) * k, (rcy + ry * math.sin(a)) * k)], fill=255, width=int(4 * k))
                         for a in (math.pi * 0.15, math.pi * 0.85, math.pi * 1.15, math.pi * 1.85)])
    fill(mid, sp, '#273050', 0.85)
    # hex (carbon/graphene) emblems on the towers
    def hexagon(cx, cy, r):
        return [(cx + r * math.cos(math.radians(60 * i + 30)), cy + r * math.sin(math.radians(60 * i + 30))) for i in range(6)]
    for cx in (225, WW - 225):
        hm = M(lambda d, k, cx=cx: d.polygon([(x * k, y * k) for x, y in hexagon(cx, 640, 62)], fill=255))
        fill(mid, hm, '#10182a', 0.95)
        ho = M(lambda d, k, cx=cx: d.polygon([(x * k, y * k) for x, y in hexagon(cx, 640, 62)], outline=255, width=int(4 * k)))
        fill(mid, ho, '#5fe2ff'); glow(mid, ho, '#33b8ff', 10, 0.6)
        # a little benzene-ring lattice inside
        inner = M(lambda d, k, cx=cx: [d.polygon([(x * k, y * k) for x, y in hexagon(cx + dx, 640 + dy, 17)], outline=255, width=int(2.5 * k))
                                      for dx, dy in [(0, 0), (29.4, 17), (-29.4, 17), (0, -34), (29.4, -17), (-29.4, -17), (0, 34)]])
        fill(mid, inner * hm, '#9ff0ff', 0.9)
    # cargo stacks out past the deck ends (fills the off-stage sides)
    def containers(x0, x1, base, seed):
        r = np.random.default_rng(seed)
        cols = ['#7a3b2e', '#2e5d7a', '#8a6a2a', '#3d6b4a', '#5a4a7a']
        x = x0
        while x < x1 - 60:
            w = r.uniform(110, 170)
            hgt = r.integers(1, 4)
            for j in range(hgt):
                y1_ = base - j * 58
                c = cols[r.integers(0, len(cols))]
                cm = M(lambda d, k, x=x, w=w, y1_=y1_: d.rectangle([x * k, (y1_ - 54) * k, min(x + w, x1) * k, y1_ * k], fill=255))
                fill(mid, cm, c)
                rib = M(lambda d, k, x=x, w=w, y1_=y1_: [d.line([(xx_ * k, (y1_ - 50) * k), (xx_ * k, (y1_ - 4) * k)], fill=255, width=max(1, int(2 * k)))
                                                         for xx_ in np.arange(x + 8, min(x + w, x1) - 4, 12)])
                shade(mid, rib, -0.3)
            x += w + r.uniform(4, 30)
    containers(0, 270, 1250, 5)
    containers(WW - 270, WW, 1250, 6)
    plat = M(lambda d, k: [d.rectangle([0, 1250 * k, 300 * k, 1290 * k], fill=255), d.rectangle([(WW - 300) * k, 1250 * k, WW * k, 1290 * k], fill=255)])
    fill(mid, plat, '#1a2034')
    haze(mid, 700, WH, '#5a5a86', 0.35)
    grain(mid, 0.015, seed=8)
    save(mid, f'{out}/mid.png')

    # =================================================================== near
    near = layer(WW, WH)
    def girder(p0, p1, w, seed):
        (ax, ay), (bx, by) = p0, p1
        ang = math.atan2(by - ay, bx - ax)
        nx, ny = -math.sin(ang) * w / 2, math.cos(ang) * w / 2
        body = M(lambda d, k: d.polygon([((ax + nx) * k, (ay + ny) * k), ((bx + nx) * k, (by + ny) * k), ((bx - nx) * k, (by - ny) * k), ((ax - nx) * k, (ay - ny) * k)], fill=255), 0.5)
        fill(near, body, '#0d1120')
        L = math.hypot(bx - ax, by - ay)
        holes = M(lambda d, k: [d.polygon([((ax + math.cos(ang) * s - nx * 0.6 + math.cos(ang) * o) * k, (ay + math.sin(ang) * s - ny * 0.6 + math.sin(ang) * o) * k)
                                            for o, sgn in ((0, 1), (w * 0.9, 1), (w * 0.45, -1))]
                                           , fill=255) for s in np.arange(w * 0.3, L - w, w * 1.1)], 0.5)
        fill(near, holes * body, '#232a44')
        edge = M(lambda d, k: d.line([((ax - nx) * k, (ay - ny) * k), ((bx - nx) * k, (by - ny) * k)], fill=255, width=max(1, int(3 * k))))
        fill(near, edge, '#6a7aa0', 0.7)
    girder((-40, 40), (560, 230), 70, 1)
    girder((-40, 330), (300, 120), 46, 2)
    girder((WW + 40, 40), (WW - 560, 230), 70, 3)
    girder((WW + 40, 330), (WW - 300, 120), 46, 4)
    # sagging cable bundles hanging off the girders
    def cable(x0, y0, x1, y1, sag, wdt):
        pts = [(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)) for t in np.linspace(0, 1, 40)]
        return M(lambda d, k: d.line([(x * k, y * k) for x, y in pts], fill=255, width=int(wdt * k)), 0.5)
    for c in [cable(420, 190, 760, 120, 160, 6), cable(470, 205, 820, 110, 210, 4), cable(WW - 420, 190, WW - 760, 120, 160, 6), cable(WW - 470, 205, WW - 820, 110, 210, 4)]:
        fill(near, c, '#0a0d18')
    hook = M(lambda d, k: [d.line([(610 * k, 175 * k), (610 * k, 330 * k)], fill=255, width=int(4 * k)), d.rectangle([592 * k, 330 * k, 628 * k, 352 * k], fill=255),
                           d.line([((WW - 610) * k, 175 * k), ((WW - 610) * k, 300 * k)], fill=255, width=int(4 * k)), d.rectangle([(WW - 628) * k, 300 * k, (WW - 592) * k, 322 * k], fill=255)])
    fill(near, hook, '#0d1120')
    warn = M(lambda d, k: [d.ellipse([(604) * k, 336 * k, 616 * k, 348 * k], fill=255), d.ellipse([(WW - 616) * k, 306 * k, (WW - 604) * k, 318 * k], fill=255)])
    glow(near, warn, '#ffb33a', 9, 0.9); fill(near, warn, '#fff0c0')
    # low cloud drifting through the bottom of the frame
    lowc = np.clip(fbm(WW, WH, 120, 5, 71) - 0.42, 0, 1) * np.clip((yy - 1260) / 140, 0, 1) * 2.0
    fill(near, np.clip(lowc, 0, 1), '#c7b9d8', 0.75)
    save(near, f'{out}/near.png')

    # =============================================================== terrain
    def detail(tmp, m, x0, x1, y, bot, is_ground, r):
        # graphene hex lattice pressed into the carbon-composite body
        hexes = []
        s = 26
        for j, yy_ in enumerate(np.arange(y + 34, bot, s * 0.87)):
            for xx_ in np.arange(x0 + (j % 2) * s / 2, x1, s):
                hexes.append([(xx_ + s * 0.5 * math.cos(math.radians(60 * i + 30)), yy_ + s * 0.5 * math.sin(math.radians(60 * i + 30))) for i in range(6)])
        hm = M(lambda d, k: [d.polygon([(px * k, py * k) for px, py in h], outline=255, width=max(1, int(1.2 * k))) for h in hexes])
        shade(tmp, hm * m, 0.28)
        seams = M(lambda d, k: [d.line([(xx_ * k, (y + 20) * k), (xx_ * k, bot * k)], fill=255, width=max(1, int(2 * k))) for xx_ in np.arange(x0 + 120, x1 - 40, 240)])
        shade(tmp, seams * m, -0.4)
        if is_ground:
            strip = M(lambda d, k: d.rectangle([(x0 + 40) * k, (y + 40) * k, (x1 - 40) * k, (y + 44) * k], fill=255)) * m
            fill(tmp, strip, '#7ff4ff'); glow(tmp, strip, '#2ec8ff', 9, 0.8)
            # thruster pods under the floating deck
            pods = [(xx_, bot - 26) for xx_ in np.arange(x0 + 220, x1 - 150, 260)]
            pm_ = M(lambda d, k: [d.rounded_rectangle([(px - 34) * k, (py - 30) * k, (px + 34) * k, (py + 14) * k], radius=10 * k, fill=255) for px, py in pods])
            fill(tmp, pm_, '#151926')
            flame = M(lambda d, k: [d.ellipse([(px - 20) * k, (py + 6) * k, (px + 20) * k, (py + 22) * k], fill=255) for px, py in pods], 2)
            glow(tmp, flame, '#58d8ff', 14, 1.0); fill(tmp, flame, '#e4fbff')
        else:
            # hazard edge on the ledges
            pass

    def trim(tmp, m, x0, x1, y, cap_h, r):
        stripes = M(lambda d, k: [d.polygon([(x * k, (y + cap_h) * k), ((x + 14) * k, (y + cap_h) * k), ((x + 24) * k, (y + cap_h + 8) * k), ((x + 10) * k, (y + cap_h + 8) * k)], fill=255)
                                  for xs in ((x0 + 6, x0 + 100), (x1 - 100, x1 - 6)) for x in np.arange(xs[0], xs[1], 26)])
        fill(tmp, stripes * m, '#f2b632', 0.9)
        lamps = M(lambda d, k: [d.ellipse([(x - 3) * k, (y + 5) * k, (x + 3) * k, (y + 11) * k], fill=255) for x in np.arange(x0 + 40, x1 - 20, 80)])
        glow(tmp, lamps, '#7ff4ff', 6, 0.7)

    def plat_trim(tmp, x0, x1, y, th):
        lm = M(lambda d, k: d.rectangle([(x0 + 12) * k, (y + 11) * k, (x1 - 12) * k, (y + 13) * k], fill=255))
        fill(tmp, lm, '#7ff4ff'); glow(tmp, lm, '#33c8ff', 6, 0.7)
        grate = M(lambda d, k: [d.line([(x * k, (y + 7) * k), (x * k, (y + th - 2) * k)], fill=255, width=max(1, int(1.2 * k))) for x in np.arange(x0 + 10, x1 - 6, 9)])
        shade(tmp, grate, -0.3)

    mat = dict(body_top='#2c3346', body_bot='#0f121b', cap_col='#66708a', cap_hi='#e4eefa', cap=16, depth=210, taper=130,
               detail=detail, trim=trim, plat_body='#20283a', plat_cap='#77839d', plat_trim=plat_trim)

    terr = layer(WW, WH)
    # carbon-nanotube tether down the middle (behind everything walkable)
    tcx = 1280
    tm = M(lambda d, k: d.rectangle([(tcx - 11) * k, 0, (tcx + 11) * k, 1190 * k], fill=255))
    tcol = np.zeros((WH, WW, 3), np.float32)
    tcol[:] = hexc('#141826')[:3]
    fill(terr, tm, tcol)
    core = M(lambda d, k: d.rectangle([(tcx - 2) * k, 0, (tcx + 2) * k, 1190 * k], fill=255))
    fill(terr, core, '#7ff4ff', 0.75); glow(terr, core, '#2ec8ff', 10, 0.55)
    tw = M(lambda d, k: [d.line([((tcx - 11) * k, y * k), ((tcx + 11) * k, (y + 22) * k)], fill=255, width=max(1, int(1.5 * k))) for y in range(0, 1190, 18)])
    shade(terr, tw * tm, 0.5)
    pulses = M(lambda d, k: [d.ellipse([(tcx - 6) * k, (y - 10) * k, (tcx + 6) * k, (y + 10) * k], fill=255) for y in (90, 260, 410)])
    glow(terr, pulses, '#9ff8ff', 14, 1.0); fill(terr, pulses, '#ffffff', 0.9)
    # lift shaft: rails from the head frame down to the lower deck
    rails = M(lambda d, k: [d.rectangle([1146 * k, 400 * k, 1158 * k, 1180 * k], fill=255), d.rectangle([1402 * k, 400 * k, 1414 * k, 1180 * k], fill=255)])
    fill(terr, rails, '#3a4560')
    railhi = M(lambda d, k: [d.rectangle([1147 * k, 400 * k, 1149 * k, 1180 * k], fill=255), d.rectangle([1403 * k, 400 * k, 1405 * k, 1180 * k], fill=255)])
    fill(terr, railhi, '#a9b8d8', 0.8)
    haz = M(lambda d, k: [d.rectangle([x0_ * k, y * k, (x0_ + 12) * k, (y + 12) * k], fill=255) for x0_ in (1146, 1402) for y in range(404, 1180, 48)])
    fill(terr, haz, '#f2b632', 0.85)
    # head frame high above the summit (decor -- nothing to collide with)
    head = M(lambda d, k: [d.rectangle([1130 * k, 388 * k, 1430 * k, 404 * k], fill=255),
                           d.polygon([(1130 * k, 388 * k), (1180 * k, 350 * k), (1380 * k, 350 * k), (1430 * k, 388 * k)], outline=255, width=int(5 * k))])
    fill(terr, head, '#3a4560')
    clamp = M(lambda d, k: d.ellipse([(tcx - 30) * k, 362 * k, (tcx + 30) * k, 410 * k], fill=255))
    fill(terr, clamp, '#222a3e')
    cring = M(lambda d, k: d.ellipse([(tcx - 30) * k, 362 * k, (tcx + 30) * k, 410 * k], outline=255, width=int(4 * k)))
    fill(terr, cring, '#7ff4ff'); glow(terr, cring, '#2ec8ff', 10, 0.7)
    # stair towers: two posts behind each stair run
    posts = M(lambda d, k: [d.rectangle([(x - 4) * k, 790 * k, (x + 4) * k, 1120 * k], fill=255) for x in (372, 688, WW - 372, WW - 688)])
    fill(terr, posts, '#252d42', 0.95)
    braces = M(lambda d, k: [d.line([(x0_ * k, y * k), (x1_ * k, (y + 64) * k)], fill=255, width=max(1, int(3 * k)))
                             for x0_, x1_ in ((372, 688), (688, 372), (WW - 372, WW - 688), (WW - 688, WW - 372)) for y in range(800, 1060, 128)])
    fill(terr, braces, '#1d2436', 0.8)
    # upper-deck struts down to the shaft rails
    struts = M(lambda d, k: [d.line([(1000 * k, 820 * k), (1150 * k, 940 * k)], fill=255, width=int(7 * k)),
                             d.line([((WW - 1000) * k, 820 * k), (1410 * k, 940 * k)], fill=255, width=int(7 * k))])
    fill(terr, struts, '#252d42')
    ground = paint_terrain(stage, mat)
    over(terr, ground)
    save(terr, f'{out}/terrain.png')

    # ================================================================== lift
    lp = next(p for p in stage['platforms'] if p.get('move'))
    LWd, LH = lp['w'] + 20, 96
    lift = layer(LWd, LH)
    LM = lambda fn, b=0: mask(LWd, LH, fn, blur=b)
    ox = 10
    pad = LM(lambda d, k: d.rounded_rectangle([ox * k, 8 * k, (ox + lp['w']) * k, 30 * k], radius=6 * k, fill=255))
    fill(lift, pad, '#2a3348')
    cap = LM(lambda d, k: d.rounded_rectangle([ox * k, 8 * k, (ox + lp['w']) * k, 15 * k], radius=3 * k, fill=255))
    fill(lift, cap, '#8090ac')
    hi = LM(lambda d, k: d.rectangle([(ox + 4) * k, 8 * k, (ox + lp['w'] - 4) * k, 9.5 * k], fill=255))
    fill(lift, hi, '#eaf4ff')
    stripes = LM(lambda d, k: [d.polygon([(x * k, 19 * k), ((x + 12) * k, 19 * k), ((x + 20) * k, 27 * k), ((x + 8) * k, 27 * k)], fill=255) for x in range(ox + 4, ox + lp['w'] - 16, 22)])
    fill(lift, stripes, '#f2b632', 0.9)
    under = LM(lambda d, k: d.polygon([((ox + 30) * k, 30 * k), ((ox + lp['w'] - 30) * k, 30 * k), ((ox + lp['w'] / 2 + 46) * k, 84 * k), ((ox + lp['w'] / 2 - 46) * k, 84 * k)], fill=255))
    fill(lift, under, '#171d2c')
    truss = LM(lambda d, k: [d.line([((ox + 40 + i * 40) * k, 32 * k), ((ox + lp['w'] / 2 + (i - 2) * 18) * k, 80 * k)], fill=255, width=max(1, int(2 * k))) for i in range(5)])
    fill(lift, truss, '#3c4864')
    hub = LM(lambda d, k: d.ellipse([(LWd / 2 - 26) * k, 58 * k, (LWd / 2 + 26) * k, 94 * k], fill=255))
    fill(lift, hub, '#20283a')
    hring = LM(lambda d, k: d.ellipse([(LWd / 2 - 26) * k, 58 * k, (LWd / 2 + 26) * k, 94 * k], outline=255, width=int(3 * k)))
    fill(lift, hring, '#7ff4ff'); glow(lift, hring, '#2ec8ff', 6, 0.8)
    lamps = LM(lambda d, k: [d.ellipse([(x - 4) * k, 34 * k, (x + 4) * k, 42 * k], fill=255) for x in (ox + 14, ox + lp['w'] - 14)])
    glow(lift, lamps, '#ffb33a', 6, 1.0); fill(lift, lamps, '#fff2c8')
    save(lift, f'{out}/lift.png')
    return mat
