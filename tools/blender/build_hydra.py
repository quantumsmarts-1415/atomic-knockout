"""
Builds Hydra (Hydrogen) -- modelled, rigged and animated procedurally.

Run:
  blender --background --python tools/blender/build_hydra.py

Writes tools/blender/hydra.blend.

Design targets, from the Gemini render in art-src/hydra-cut.png:
  anime/Smash-Ultimate proportions, spiky blue flame hair with orange tips,
  open blue jacket with a white "H" panel, bare chest + abs, bandaged near
  fist, armoured far gauntlet, dark navy armoured pants, chunky boots,
  glowing orange eyes.

Flames are deliberately NOT modelled (except the hair, which is part of the
silhouette). They are handled as in-game Phaser particle VFX so the sprite
bounds stay tight around the hurtbox.

Facing rule (see the vault doc, Session 2): forward direction lives in the
SILHOUETTE, not in decals. Every profile below has a convex chest forward and
a flatter back, elbows bow backward with hands ending forward, and boots have
a forward toe box with a flush heel.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from hydra_common import (  # noqa: E402
    M, MAT, SAG_AXIS, add_subsurf, ball, box, build_materials, loft, loft_arc,
    spike, taper, weight_to_bones,
)

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(HERE, "hydra.blend")

# Half-offsets: NEAR side is -Y (toward the camera), FAR side is +Y.
NEAR, FAR = -1.0, 1.0

SHOULDER_Y = 0.183
HIP_Y = 0.086

PARTS = []  # (object, [bone whitelist])


def register(ob, bones, subsurf=1):
    if subsurf:
        add_subsurf(ob, levels=subsurf, render_levels=subsurf + 1)
    PARTS.append((ob, bones))
    return ob


# ==========================================================================
# 1. TORSO -- convex chest forward, flat back
# ==========================================================================

def build_torso():
    s = M("skin")
    rings = [
        # z,     x-off, half-width, forward depth, back depth
        (0.955, 0.000, 0.108, 0.092, 0.096),   # pelvis base
        (1.010, 0.000, 0.121, 0.101, 0.099),   # hips
        (1.075, 0.002, 0.100, 0.091, 0.085),   # waist (nipped in)
        (1.140, 0.004, 0.104, 0.098, 0.082),   # lower abs
        (1.215, 0.004, 0.114, 0.107, 0.082),   # upper abs
        (1.300, 0.002, 0.136, 0.119, 0.084),   # lower chest (bulges +X)
        (1.385, 0.000, 0.156, 0.119, 0.088),   # chest
        (1.455, -0.004, 0.150, 0.101, 0.091),  # clavicle
        (1.505, -0.006, 0.118, 0.076, 0.079),  # shoulder shelf
    ]
    r = [{"c": (x, 0.0, z), "w": w, "df": df, "db": db}
         for z, x, w, df, db in rings]
    ob = loft("hydra_torso", r, [s] * (len(r) - 1))
    return register(ob, ["hips", "spine", "chest", "neck"])


def build_belt():
    b = M("belt")
    r = [
        {"c": (0.002, 0.0, 1.038), "w": 0.114, "df": 0.098, "db": 0.094},
        {"c": (0.002, 0.0, 1.072), "w": 0.117, "df": 0.100, "db": 0.096},
        {"c": (0.002, 0.0, 1.088), "w": 0.108, "df": 0.094, "db": 0.090},
    ]
    ob = loft("hydra_belt", r, [b, b], cap0=False, cap1=False)
    return register(ob, ["hips", "spine"])


def build_emblem():
    """The little orange flame crest on his chest, angled toward the camera."""
    ob = ball("hydra_emblem", (0.118, -0.040, 1.300), 0.038, M("emblem"),
              scale=(0.45, 0.80, 1.20))
    return register(ob, ["chest"], subsurf=0)


# ==========================================================================
# 2. JACKET -- open shell over the back and sides, lapels forward
# ==========================================================================

def build_jacket():
    j = M("jacket")
    rings = [
        (1.055, 0.128, 0.114, 0.106),
        (1.130, 0.124, 0.120, 0.104),
        (1.215, 0.134, 0.128, 0.104),
        (1.300, 0.156, 0.140, 0.106),
        (1.385, 0.176, 0.140, 0.110),
        (1.455, 0.170, 0.124, 0.113),
        (1.508, 0.136, 0.098, 0.101),
    ]
    r = [{"c": (0.0, 0.0, z), "w": w, "df": df, "db": db}
         for z, w, df, db in rings]
    # The opening has to be wide (+-64 degrees) for the bare chest to survive
    # a SIDE view -- a narrow front opening is invisible once the camera is
    # 78 degrees off the character's front.
    t0 = math.radians(64.0)
    t1 = math.radians(296.0)
    ob = loft_arc("hydra_jacket", r, [j] * (len(r) - 1), t0, t1, n=20)
    mod = ob.modifiers.new(name="Solidify", type="SOLIDIFY")
    mod.thickness = 0.020
    mod.offset = 1.0
    return register(ob, ["hips", "spine", "chest", "neck"])


def build_collar():
    t = M("jacket_lt")
    r = [
        {"c": (-0.010, 0.0, 1.470), "w": 0.096, "df": 0.070, "db": 0.086},
        {"c": (-0.012, 0.0, 1.532), "w": 0.104, "df": 0.074, "db": 0.096},
        {"c": (-0.014, 0.0, 1.566), "w": 0.098, "df": 0.070, "db": 0.092},
    ]
    ob = loft_arc("hydra_collar", r, [t, t],
                  math.radians(30.0), math.radians(330.0), n=18)
    mod = ob.modifiers.new(name="Solidify", type="SOLIDIFY")
    mod.thickness = 0.016
    mod.offset = 1.0
    return register(ob, ["chest", "neck"])


def build_lapels():
    """Two flared front panels riding the open edge of the jacket.

    The near one carries the white H plate -- placed with its normal facing
    -Y so it reads face-on from the side-view camera instead of edge-on.
    """
    objs = []
    for side, sgn in (("N", NEAR), ("F", FAR)):
        far = side == "F"
        # rides the arc endpoint of the jacket, NOT the chest centreline, so
        # it never covers the strip of bare skin the side view depends on
        r = [
            {"c": (0.058, sgn * 0.115, 1.062), "w": 0.030, "df": 0.028,
             "db": 0.034},
            {"c": (0.064, sgn * 0.118, 1.200), "w": 0.032, "df": 0.030,
             "db": 0.036},
            {"c": (0.072, sgn * 0.147, 1.330), "w": 0.038, "df": 0.032,
             "db": 0.040},
            {"c": (0.070, sgn * 0.157, 1.430), "w": 0.040, "df": 0.030,
             "db": 0.040},
            {"c": (0.052, sgn * 0.127, 1.502), "w": 0.030, "df": 0.024,
             "db": 0.034},
        ]
        mats = [M("jacket", far)] * 4
        ob = loft("hydra_lapel_" + side, r, mats, n=10)
        objs.append(register(ob, ["spine", "chest"]))

    # The H panel lives on the OUTSIDE of the near shoulder, not on the chest:
    # anywhere on the chest it ends up buried behind the guard arm, whereas
    # the outer deltoid is visible in the side view in every single pose.
    plate = box("hydra_hplate", (-0.004, NEAR * 0.262, 1.446),
                (0.082, 0.012, 0.080), M("panel"), rot=(0, 0, 0))
    objs.append(register(plate, ["shoulder.N", "upperarm.N"], subsurf=0))

    d = M("dark")
    for dx, sz in ((-0.019, (0.012, 0.010, 0.054)),
                   (0.019, (0.012, 0.010, 0.054)),
                   (0.0, (0.031, 0.010, 0.012))):
        ob = box("hydra_H", (-0.004 + dx, NEAR * 0.270, 1.446), sz, d)
        objs.append(register(ob, ["shoulder.N", "upperarm.N"], subsurf=0))
    return objs


def build_shoulder_pads():
    objs = []
    for side, y in (("N", NEAR * SHOULDER_Y), ("F", FAR * SHOULDER_Y)):
        far = side == "F"
        ob = ball("hydra_shoulder_" + side, (-0.004, y * 0.98, 1.452), 0.078,
                  M("jacket", far), scale=(0.92, 0.86, 0.80))
        objs.append(register(ob, ["chest", "shoulder." + side,
                                  "upperarm." + side], subsurf=0))
        trim = ball("hydra_shoulder_trim_" + side,
                    (-0.004, y * 0.99, 1.404), 0.076,
                    M("trim", far), scale=(0.90, 0.80, 0.24))
        objs.append(register(trim, ["shoulder." + side, "upperarm." + side],
                             subsurf=0))
    return objs


# ==========================================================================
# 3. HEAD, FACE, HAIR
# ==========================================================================

def build_neck():
    s = M("skin")
    r = [
        {"c": (0.004, 0.0, 1.478), "w": 0.058, "df": 0.056, "db": 0.056},
        {"c": (0.006, 0.0, 1.530), "w": 0.050, "df": 0.050, "db": 0.050},
        {"c": (0.008, 0.0, 1.580), "w": 0.048, "df": 0.048, "db": 0.048},
    ]
    ob = loft("hydra_neck", r, [s, s])
    return register(ob, ["chest", "neck", "head"])


def build_head():
    s = M("skin")
    rings = [
        # z,     x-off, half-w, fwd,   back
        (1.574, 0.018, 0.040, 0.058, 0.058),
        (1.598, 0.015, 0.068, 0.090, 0.078),
        (1.626, 0.010, 0.086, 0.104, 0.096),
        (1.660, 0.003, 0.095, 0.112, 0.108),
        (1.702, 0.000, 0.101, 0.107, 0.118),
        (1.751, 0.000, 0.098, 0.097, 0.120),
        (1.803, 0.000, 0.081, 0.077, 0.105),
        (1.843, 0.000, 0.049, 0.046, 0.071),
        (1.866, 0.000, 0.017, 0.016, 0.028),
    ]
    r = [{"c": (x, 0.0, z), "w": w, "df": df, "db": db}
         for z, x, w, df, db in rings]
    ob = loft("hydra_head", r, [s] * (len(r) - 1))
    return register(ob, ["head"])


def build_face():
    objs = []
    # anime nose -- a small forward point, essential for the side-view read
    # Facial features are smooth ellipsoids that half-embed in the skull, not
    # boxes stuck on the surface -- the box version read as glued-on chips.
    nose = ball("hydra_nose", (0.104, 0.0, 1.648), 0.030,
                M("skin"), scale=(1.15, 0.65, 0.60), rot=(0, 26, 0))
    objs.append(register(nose, ["head"], subsurf=0))

    mouth = ball("hydra_mouth", (0.098, NEAR * 0.024, 1.622), 0.020,
                 M("dark"), scale=(0.55, 1.15, 0.22), rot=(0, 10, -16))
    objs.append(register(mouth, ["head"], subsurf=0))

    # No ears: at 150 px tall they added a stray circle on the cheek and read
    # as noise. The hair would cover them anyway.
    for side, y in (("N", NEAR * 0.064), ("F", FAR * 0.064)):
        far = side == "F"
        yaw = -30.0 if side == "N" else 30.0
        # glowing orange eye, tipped down at the front like an angry anime eye
        # and pushed far enough out of the skull to survive a full profile
        eye = ball("hydra_eye_" + side, (0.082, y, 1.682), 0.050,
                   M("eye", far), scale=(0.88, 0.62, 0.44), rot=(0, 10, yaw))
        objs.append(register(eye, ["head"], subsurf=0))
        # heavy scowling brow, angled harder than the eye -- this is the
        # feature that actually reads at sprite size
        brow = ball("hydra_brow_" + side, (0.078, y * 1.04, 1.716), 0.052,
                    M("dark", far), scale=(0.95, 0.62, 0.24),
                    rot=(0, 26, yaw))
        objs.append(register(brow, ["head"], subsurf=0))
    return objs


HAIR_SPIKES = [
    # (base xyz, direction, length, base radius)
    ((-0.022, 0.000, 1.862), (-0.14, 0.00, 0.99), 0.30, 0.062),
    ((0.044, -0.048, 1.838), (0.34, -0.24, 0.91), 0.25, 0.054),
    ((0.044, 0.048, 1.838), (0.34, 0.24, 0.91), 0.25, 0.054),
    ((-0.068, -0.056, 1.828), (-0.42, -0.28, 0.86), 0.27, 0.056),
    ((-0.068, 0.056, 1.828), (-0.42, 0.28, 0.86), 0.27, 0.056),
    ((-0.106, 0.000, 1.792), (-0.72, 0.00, 0.69), 0.29, 0.058),
    ((-0.116, -0.052, 1.730), (-0.86, -0.20, 0.47), 0.25, 0.050),
    ((-0.116, 0.052, 1.730), (-0.86, 0.20, 0.47), 0.25, 0.050),
    # forward crest + fringe: stops the face reading bald from the front
    ((0.092, 0.000, 1.806), (0.62, 0.00, 0.78), 0.21, 0.048),
    ((0.104, -0.046, 1.756), (0.86, -0.16, 0.20), 0.13, 0.036),
    ((0.104, 0.046, 1.756), (0.86, 0.16, 0.20), 0.13, 0.036),
]


def build_hair():
    objs = []
    # The cap's FRONT depth is deliberately smaller than the skull's, so it
    # tucks inside the forehead and leaves the face clear; the front spikes
    # supply the fringe instead.
    cap = [
        {"c": (0.006, 0.0, 1.700), "w": 0.104, "df": 0.100, "db": 0.126},
        {"c": (0.002, 0.0, 1.756), "w": 0.108, "df": 0.104, "db": 0.130},
        {"c": (0.000, 0.0, 1.812), "w": 0.103, "df": 0.092, "db": 0.125},
        {"c": (0.000, 0.0, 1.848), "w": 0.075, "df": 0.066, "db": 0.094},
        {"c": (0.000, 0.0, 1.872), "w": 0.031, "df": 0.029, "db": 0.043},
    ]
    h = M("hair")
    objs.append(register(loft("hydra_hair_cap", cap, [h] * 4), ["head"]))

    for i, (base, d, length, r) in enumerate(HAIR_SPIKES):
        # Spikes stay fat then taper hard (flare) so they read as flame licks
        # rather than punk needles, and they sweep up and BACK, which doubles
        # as a forward cue for the silhouette.
        back = d[0] < 0.3
        curve = (-0.055 if back else 0.020, 0.0, 0.045)
        # 0.85 length: the first pass made the hair a starburst nearly as wide
        # as the torso, which shrank the face at sprite size
        ob = spike("hydra_hair_%02d" % i, base, d, length * 0.85, r,
                   M("hair"), M("hair_tip"), curve=curve,
                   flare=2.2, tip_frac=0.40, n=10)
        objs.append(register(ob, ["head", "hair"], subsurf=0))
    return objs


# ==========================================================================
# 4. ARMS -- elbow bows backward, hand ends forward
# ==========================================================================

ARM_JOINTS = {
    "N": {"shoulder": (0.000, NEAR * SHOULDER_Y, 1.452),
          "elbow": (-0.048, NEAR * 0.212, 1.158),
          "wrist": (0.046, NEAR * 0.198, 0.918),
          "fist": (0.082, NEAR * 0.194, 0.860)},
    "F": {"shoulder": (0.000, FAR * SHOULDER_Y, 1.452),
          "elbow": (-0.048, FAR * 0.212, 1.158),
          "wrist": (0.046, FAR * 0.198, 0.918),
          "fist": (0.082, FAR * 0.194, 0.860)},
}


def build_arm(side):
    far = side == "F"
    j = ARM_JOINTS[side]
    objs = []

    # upper arm: jacket sleeve
    upper = taper("hydra_upperarm_" + side, j["shoulder"], j["elbow"],
                  [(0.00, 0.070), (0.25, 0.059), (0.60, 0.053),
                   (1.00, 0.051)],
                  [M("jacket", far)] * 3, bulge_f=1.06)
    objs.append(register(upper, ["shoulder." + side, "upperarm." + side]))

    cuff = ball("hydra_cuff_" + side, j["elbow"], 0.056, M("trim", far),
                scale=(1.0, 1.0, 0.42))
    objs.append(register(cuff, ["upperarm." + side, "forearm." + side],
                         subsurf=0))

    if side == "N":
        # near forearm: bandage wrap -- alternating radii read as wrapping
        prof = [(0.00, 0.052), (0.14, 0.058), (0.28, 0.053), (0.42, 0.059),
                (0.56, 0.054), (0.70, 0.060), (0.85, 0.055), (1.00, 0.048)]
        mats = [M("bandage")] * (len(prof) - 1)
        fore = taper("hydra_forearm_N", j["elbow"], j["wrist"], prof, mats,
                     bulge_f=1.04)
        objs.append(register(fore, ["forearm.N", "hand.N"]))
    else:
        # far forearm: armoured gauntlet, chunkier
        prof = [(0.00, 0.058), (0.30, 0.072), (0.70, 0.074), (1.00, 0.062)]
        mats = [M("armor", True)] * 3
        fore = taper("hydra_forearm_F", j["elbow"], j["wrist"], prof, mats,
                     bulge_f=1.14)
        objs.append(register(fore, ["forearm.F", "hand.F"]))
        plate = box("hydra_gauntlet_plate",
                    (j["elbow"][0] * 0.4 + j["wrist"][0] * 0.6,
                     FAR * 0.262,
                     j["elbow"][2] * 0.45 + j["wrist"][2] * 0.55),
                    (0.052, 0.024, 0.140), M("trim", True), rot=(0, -16, 0))
        objs.append(register(plate, ["forearm.F"], subsurf=0))

    fist_mat = M("skin", far)
    fist = ball("hydra_fist_" + side, j["fist"], 0.070, fist_mat,
                scale=(1.10, 0.94, 1.00))
    objs.append(register(fist, ["hand." + side], subsurf=0))
    # forward knuckle box: the fist's own forward cue
    knuck = box("hydra_knuckle_" + side,
                (j["fist"][0] + 0.042, j["fist"][1], j["fist"][2] + 0.008),
                (0.040, 0.098, 0.070), M("skin", far), rot=(0, -10, 0))
    objs.append(register(knuck, ["hand." + side], subsurf=1))
    return objs


# ==========================================================================
# 5. LEGS AND BOOTS -- toe box forward, heel flush
# ==========================================================================

LEG_JOINTS = {
    "N": {"hip": (0.004, NEAR * HIP_Y, 1.000),
          "knee": (0.010, NEAR * 0.094, 0.502),
          "ankle": (0.000, NEAR * 0.098, 0.150)},
    "F": {"hip": (0.004, FAR * HIP_Y, 1.000),
          "knee": (0.010, FAR * 0.094, 0.502),
          "ankle": (0.000, FAR * 0.098, 0.150)},
}


def build_leg(side):
    far = side == "F"
    j = LEG_JOINTS[side]
    objs = []

    thigh = taper("hydra_thigh_" + side, j["hip"], j["knee"],
                  [(0.00, 0.113), (0.30, 0.101), (0.65, 0.088),
                   (1.00, 0.078)],
                  [M("pants", far)] * 3, bulge_f=1.08)
    objs.append(register(thigh, ["hips", "thigh." + side]))

    shin = taper("hydra_shin_" + side, j["knee"], j["ankle"],
                 [(0.00, 0.077), (0.22, 0.085), (0.55, 0.070),
                  (1.00, 0.050)],
                 [M("pants", far)] * 3, bulge_f=1.02)
    objs.append(register(shin, ["thigh." + side, "shin." + side]))

    # hexagonal knee plate on the FRONT of the knee
    knee = box("hydra_knee_" + side, (0.078, j["knee"][1], 0.512),
               (0.058, 0.122, 0.110), M("armor", far), rot=(0, -8, 0))
    objs.append(register(knee, ["thigh." + side, "shin." + side], subsurf=1))

    # thigh side panel, matching the render's blue stripe
    stripe = box("hydra_stripe_" + side,
                 (0.062, j["hip"][1] * 1.18, 0.760),
                 (0.036, 0.026, 0.260), M("pants_lt", far), rot=(0, 4, 0))
    objs.append(register(stripe, ["thigh." + side], subsurf=1))
    return objs


def build_boot(side):
    far = side == "F"
    y = LEG_JOINTS[side]["ankle"][1]
    b, sole, trim = M("boot", far), M("sole", far), M("trim", far)
    rings = [
        (0.000, 0.038, 0.060, 0.138, 0.076),
        (0.026, 0.038, 0.064, 0.140, 0.080),
        (0.062, 0.024, 0.061, 0.122, 0.078),
        (0.104, 0.008, 0.057, 0.088, 0.072),
        (0.150, 0.000, 0.055, 0.066, 0.064),
        (0.196, 0.000, 0.060, 0.068, 0.070),
    ]
    r = [{"c": (x, y, z), "w": w, "df": df, "db": db}
         for z, x, w, df, db in rings]
    ob = loft("hydra_boot_" + side, r, [sole, b, b, b, trim])
    objs = [register(ob, ["shin." + side, "foot." + side])]
    strap = box("hydra_strap_" + side, (0.030, y, 0.128),
                (0.150, 0.128, 0.020), trim)
    objs.append(register(strap, ["foot." + side], subsurf=0))
    return objs


# ==========================================================================
# 6. ARMATURE
# ==========================================================================

BONES = [
    # name,         head,                         tail,                        parent
    ("root",        (0.000, 0.0, 0.950),          (0.000, 0.0, 1.010),         None),
    ("hips",        (0.000, 0.0, 1.010),          (0.000, 0.0, 1.110),         "root"),
    ("spine",       (0.000, 0.0, 1.110),          (0.000, 0.0, 1.290),         "hips"),
    ("chest",       (0.000, 0.0, 1.290),          (0.000, 0.0, 1.480),         "spine"),
    ("neck",        (0.000, 0.0, 1.480),          (0.006, 0.0, 1.568),         "chest"),
    ("head",        (0.006, 0.0, 1.568),          (0.000, 0.0, 1.866),         "neck"),
    ("hair",        (-0.020, 0.0, 1.815),         (-0.165, 0.0, 2.005),        "head"),
]

for _s, _sgn in (("N", NEAR), ("F", FAR)):
    BONES += [
        ("shoulder." + _s, (0.000, _sgn * 0.060, 1.462),
         ARM_JOINTS[_s]["shoulder"], "chest"),
        ("upperarm." + _s, ARM_JOINTS[_s]["shoulder"],
         ARM_JOINTS[_s]["elbow"], "shoulder." + _s),
        ("forearm." + _s, ARM_JOINTS[_s]["elbow"],
         ARM_JOINTS[_s]["wrist"], "upperarm." + _s),
        ("hand." + _s, ARM_JOINTS[_s]["wrist"],
         ARM_JOINTS[_s]["fist"], "forearm." + _s),
        ("thigh." + _s, LEG_JOINTS[_s]["hip"],
         LEG_JOINTS[_s]["knee"], "hips"),
        ("shin." + _s, LEG_JOINTS[_s]["knee"],
         LEG_JOINTS[_s]["ankle"], "thigh." + _s),
        ("foot." + _s, LEG_JOINTS[_s]["ankle"],
         (0.130, _sgn * 0.098, 0.040), "shin." + _s),
    ]


def build_armature():
    arm_data = bpy.data.armatures.new("HydraRig")
    arm = bpy.data.objects.new("HydraRig", arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")

    for name, head, tail, parent in BONES:
        eb = arm_data.edit_bones.new(name)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        # Roll every bone so its local X axis == world -Y. After this, ONE
        # euler channel (rotation_euler.x) is the side-view swing for the
        # whole rig, and positive always swings the tail forward (+X).
        direction = (Vector(tail) - Vector(head)).normalized()
        target_z = SAG_AXIS.cross(direction)
        if target_z.length > 1e-6:
            eb.align_roll(target_z.normalized())
        eb.use_connect = False
    for name, _h, _t, parent in BONES:
        if parent:
            arm_data.edit_bones[name].parent = arm_data.edit_bones[parent]

    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    return arm


# ==========================================================================
# 7. POSES AND ANIMATION
# ==========================================================================
#
# Every value below is a sagittal swing in DEGREES on rotation_euler.x.
# Positive = the bone's tail moves FORWARD (+X, the way he faces).
# "loc" entries are world-ish offsets on the root bone.

STANCE = {
    # A light-fighter guard: weight forward, knees loaded, fists out in front
    # of the chest rather than folded across it (the first pass read as
    # "arms crossed"). Staggered legs give the side view a real read.
    "root": {"loc": (0.010, 0.0, -0.028)},
    # torso values are relative to the parent bone (natural for a spine)
    "hips": 2.0,
    "spine": 4.0,
    "chest": -3.0,
    # chin UP: the accumulated torso lean was tipping his face at the floor
    "neck": 2.0,
    "head": -8.0,
    "hair": -6.0,
    "shoulder.N": 6.0,
    "shoulder.F": -4.0,
    # limb values are ABSOLUTE world angles: degrees forward of straight down.
    # The rear (far) hand is pulled up to the cheek so it clears the lead arm
    # in a side view instead of hiding behind it.
    "upperarm.N": 4.0, "forearm.N": 132.0, "hand.N": 96.0,
    "upperarm.F": -8.0, "forearm.F": 165.0, "hand.F": 130.0,
    "thigh.N": 18.0, "shin.N": -6.0, "foot.N": 50.0,
    "thigh.F": -16.0, "shin.F": -30.0, "foot.F": 25.0,
}

# Sanity check for the limb numbers above and the deltas below:
#   elbow interior angle = 180 - (forearm - upperarm); knee likewise. Keep it
#   inside roughly 15..178 or the joint folds through itself.
#   foot 50 is flat on the floor; below 50 points the toe down.


def blend(base, over):
    out = dict(base)
    for k, v in over.items():
        if k == "root":
            loc = dict(base.get("root", {})).get("loc", (0, 0, 0))
            add = v.get("loc", (0, 0, 0))
            out["root"] = {"loc": tuple(a + b for a, b in zip(loc, add)),
                           "rot": v.get("rot", base.get("root", {})
                                        .get("rot", 0.0))}
        else:
            out[k] = base.get(k, 0.0) + v
    return out


def d(**kw):
    """Shorthand: d(spine=8, **{'thigh.N': -20}) -> delta dict."""
    return kw


# --- clip definitions ------------------------------------------------------
# Each clip is (name, loop?, [(frame, delta_dict), ...]).

CLIPS = []


def clip(name, loop, keys):
    CLIPS.append({"name": name, "loop": loop, "keys": keys})


clip("idle", True, [
    (1, {}),
    (7, {"root": {"loc": (0.0, 0.0, -0.014)}, "spine": 2.0, "chest": 2.0,
         "neck": -2.0, "head": 2.0, "hair": 5.0,
         "upperarm.N": 3.0, "forearm.N": 4.0,
         "upperarm.F": 2.0, "forearm.F": 3.0,
         "thigh.N": -2.0, "shin.N": 2.0, "thigh.F": 2.0}),
    (13, {"spine": -1.0, "chest": -1.0, "neck": 1.0, "head": -1.0,
          "hair": -2.0, "upperarm.N": -2.0, "upperarm.F": -1.0}),
    (19, {"root": {"loc": (0.0, 0.0, -0.010)}, "spine": 1.5, "chest": 1.5,
          "neck": -1.0, "head": 1.0, "hair": 4.0,
          "upperarm.N": 2.0, "forearm.N": 3.0, "upperarm.F": 1.0,
          "thigh.N": -1.0}),
    (25, {}),
])

clip("walk", True, [
    # a quick jog -- Hydra is the fast light one (speed 340 in characters.js)
    (1, {"spine": 4.0,
         "thigh.N": 14.0, "shin.N": -12.0, "foot.N": 6.0,
         "thigh.F": -20.0, "shin.F": -14.0, "foot.F": 4.0,
         "upperarm.N": -26.0, "forearm.N": -22.0,
         "upperarm.F": 26.0, "forearm.F": -34.0,
         "root": {"loc": (0.0, 0.0, 0.012)}}),
    (5, {"spine": 5.0,
         "thigh.N": -8.0, "shin.N": -34.0, "foot.N": 14.0,
         "thigh.F": 6.0, "shin.F": -4.0, "foot.F": -6.0,
         "upperarm.N": 0.0, "forearm.N": -10.0,
         "upperarm.F": 0.0, "forearm.F": -18.0,
         "root": {"loc": (0.0, 0.0, -0.026)}, "hair": 8.0}),
    (9, {"spine": 4.0,
         "thigh.N": -20.0, "shin.N": -14.0, "foot.N": 4.0,
         "thigh.F": 14.0, "shin.F": -12.0, "foot.F": 6.0,
         "upperarm.N": 26.0, "forearm.N": -34.0,
         "upperarm.F": -26.0, "forearm.F": -22.0,
         "root": {"loc": (0.0, 0.0, 0.012)}}),
    (13, {"spine": 5.0,
          "thigh.N": 6.0, "shin.N": -4.0, "foot.N": -6.0,
          "thigh.F": -8.0, "shin.F": -34.0, "foot.F": 14.0,
          "upperarm.N": 0.0, "forearm.N": -18.0,
          "upperarm.F": 0.0, "forearm.F": -10.0,
          "root": {"loc": (0.0, 0.0, -0.026)}, "hair": 8.0}),
    (17, {"spine": 4.0,
          "thigh.N": 14.0, "shin.N": -12.0, "foot.N": 6.0,
          "thigh.F": -20.0, "shin.F": -14.0, "foot.F": 4.0,
          "upperarm.N": -26.0, "forearm.N": -22.0,
          "upperarm.F": 26.0, "forearm.F": -34.0,
          "root": {"loc": (0.0, 0.0, 0.012)}}),
])

clip("jump", False, [
    (1, {}),
    (3, {"root": {"loc": (0.0, 0.0, -0.075)}, "spine": 10.0, "chest": 4.0,
         "thigh.N": 22.0, "shin.N": -44.0, "thigh.F": 12.0, "shin.F": -40.0,
         "foot.N": 22.0, "foot.F": 18.0,
         "upperarm.N": -40.0, "forearm.N": -60.0,
         "upperarm.F": -44.0, "forearm.F": -70.0}),
    (6, {"root": {"loc": (0.0, 0.0, 0.055)}, "spine": -8.0, "chest": -6.0,
         "neck": -6.0, "head": 4.0, "hair": -24.0,
         "thigh.N": -14.0, "shin.N": -4.0, "thigh.F": -18.0, "shin.F": -6.0,
         "foot.N": -16.0, "foot.F": -18.0,
         "upperarm.N": 50.0, "forearm.N": -55.0,
         "upperarm.F": 46.0, "forearm.F": -60.0}),
    (10, {"root": {"loc": (0.0, 0.0, 0.030)}, "spine": -2.0, "hair": -30.0,
          "thigh.N": 34.0, "shin.N": -52.0, "thigh.F": -8.0, "shin.F": -22.0,
          "foot.N": 16.0, "foot.F": -12.0,
          "upperarm.N": 24.0, "forearm.N": -40.0,
          "upperarm.F": 30.0, "forearm.F": -46.0}),
])

clip("fall", True, [
    (1, {"root": {"loc": (0.0, 0.0, 0.024)}, "spine": -6.0, "neck": -8.0,
         "head": 6.0, "hair": -34.0,
         "thigh.N": 26.0, "shin.N": -34.0, "thigh.F": -24.0, "shin.F": -18.0,
         "foot.N": 10.0, "foot.F": -14.0,
         "upperarm.N": 58.0, "forearm.N": -50.0,
         "upperarm.F": 66.0, "forearm.F": -56.0}),
    (7, {"root": {"loc": (0.0, 0.0, 0.030)}, "spine": -3.0, "neck": -8.0,
         "head": 6.0, "hair": -28.0,
         "thigh.N": 18.0, "shin.N": -26.0, "thigh.F": -30.0, "shin.F": -12.0,
         "foot.N": 6.0, "foot.F": -10.0,
         "upperarm.N": 64.0, "forearm.N": -44.0,
         "upperarm.F": 60.0, "forearm.F": -50.0}),
    (13, {"root": {"loc": (0.0, 0.0, 0.024)}, "spine": -6.0, "neck": -8.0,
          "head": 6.0, "hair": -34.0,
          "thigh.N": 26.0, "shin.N": -34.0, "thigh.F": -24.0, "shin.F": -18.0,
          "foot.N": 10.0, "foot.F": -14.0,
          "upperarm.N": 58.0, "forearm.N": -50.0,
          "upperarm.F": 66.0, "forearm.F": -56.0}),
])

clip("attack", False, [  # Proton Jab -- lead (near) fist
    (1, {}),
    (3, {"root": {"loc": (-0.026, 0.0, 0.0)}, "spine": -7.0, "chest": -4.0,
         "neck": 3.0, "hair": 10.0,
         "upperarm.N": -29.0, "forearm.N": -25.0,   # fist chambered at the ribs
         "upperarm.F": 8.0, "forearm.F": -6.0,
         "thigh.N": 6.0, "thigh.F": -6.0}),
    (6, {"root": {"loc": (0.055, 0.0, -0.012)}, "spine": 12.0, "chest": 6.0,
         "neck": -4.0, "head": 3.0, "hair": -18.0,
         # arm 82 / forearm 88 = elbow near-straight, fist driving level
         "upperarm.N": 78.0, "forearm.N": -47.0, "hand.N": -10.0,
         "upperarm.F": -34.0, "forearm.F": -40.0,
         "thigh.N": 14.0, "shin.N": -8.0,
         "thigh.F": -18.0, "shin.F": 8.0, "foot.F": 14.0}),
    (8, {"root": {"loc": (0.045, 0.0, -0.010)}, "spine": 10.0, "chest": 5.0,
         "hair": -12.0,
         "upperarm.N": 72.0, "forearm.N": -49.0, "hand.N": -10.0,
         "upperarm.F": -30.0, "forearm.F": -36.0,
         "thigh.N": 12.0, "thigh.F": -16.0}),
    (12, {}),
])

clip("special", False, [  # H-Burst -- gather, then radial detonation
    (1, {}),
    (5, {"root": {"loc": (-0.020, 0.0, -0.048)}, "spine": 14.0,
         "chest": 8.0, "neck": -6.0, "head": 6.0, "hair": 14.0,
         "upperarm.N": 16.0, "forearm.N": 6.0,
         "upperarm.F": 18.0, "forearm.F": 2.0,
         "thigh.N": 18.0, "shin.N": -26.0,
         "thigh.F": 14.0, "shin.F": -30.0, "foot.F": 16.0}),
    (9, {"root": {"loc": (0.010, 0.0, 0.040)}, "spine": -18.0,
         "chest": -10.0, "neck": -12.0, "head": 10.0, "hair": -30.0,
         # both arms snap straight and drive down and back as it detonates
         "upperarm.N": -49.0, "forearm.N": -175.0, "hand.N": -70.0,
         "upperarm.F": -44.0, "forearm.F": -195.0, "hand.F": -75.0,
         "thigh.N": -16.0, "shin.N": 8.0,
         "thigh.F": -22.0, "shin.F": 6.0}),
    (12, {"root": {"loc": (0.0, 0.0, 0.008)}, "spine": -8.0, "chest": -4.0,
          "hair": -16.0,
          "upperarm.N": -20.0, "forearm.N": -80.0,
          "upperarm.F": -24.0, "forearm.F": -92.0}),
    (16, {}),
])

clip("hurt", False, [
    (1, {}),
    (3, {"root": {"loc": (-0.055, 0.0, 0.010)}, "spine": -20.0,
         "chest": -12.0, "neck": -16.0, "head": 12.0, "hair": 26.0,
         "upperarm.N": -52.0, "forearm.N": -74.0,
         "upperarm.F": -58.0, "forearm.F": -80.0,
         "thigh.N": 24.0, "shin.N": -18.0,
         "thigh.F": -10.0, "shin.F": -24.0, "foot.F": 18.0}),
    (6, {"root": {"loc": (-0.030, 0.0, 0.0)}, "spine": -10.0, "chest": -6.0,
         "neck": -8.0, "head": 6.0, "hair": 16.0,
         "upperarm.N": -26.0, "forearm.N": -40.0,
         "upperarm.F": -30.0, "forearm.F": -46.0}),
    (10, {}),
])

clip("ko", False, [
    (1, {}),
    (3, {"root": {"loc": (-0.030, 0.0, 0.060), "rot": -50.0},
         "spine": -16.0, "neck": -14.0, "head": 10.0, "hair": 30.0,
         "upperarm.N": -64.0, "forearm.N": -84.0,
         "upperarm.F": -70.0, "forearm.F": -90.0,
         "thigh.N": 30.0, "shin.N": -30.0, "thigh.F": 10.0, "shin.F": -40.0}),
    (9, {"root": {"loc": (-0.060, 0.0, 0.110), "rot": -230.0},
         "spine": -12.0, "neck": -12.0, "hair": 40.0,
         "upperarm.N": -74.0, "forearm.N": -76.0,
         "upperarm.F": -78.0, "forearm.F": -84.0,
         "thigh.N": 36.0, "shin.N": -24.0, "thigh.F": 4.0, "shin.F": -46.0}),
    (15, {"root": {"loc": (-0.090, 0.0, 0.150), "rot": -410.0},
          "spine": -14.0, "neck": -12.0, "hair": 34.0,
          "upperarm.N": -68.0, "forearm.N": -80.0,
          "upperarm.F": -74.0, "forearm.F": -88.0,
          "thigh.N": 32.0, "shin.N": -28.0, "thigh.F": 8.0, "shin.F": -42.0}),
])


PARENT_OF = {name: parent for name, _h, _t, parent in BONES}

# Bones whose pose value is an ABSOLUTE world sagittal angle (degrees from
# straight down, positive = forward) rather than a rotation relative to the
# parent. Without this, a torso lean silently adds itself to every arm angle
# and a "straight punch" ends up aimed at the ceiling.
ABSOLUTE_BONES = {
    "upperarm.N", "forearm.N", "hand.N", "upperarm.F", "forearm.F", "hand.F",
    "thigh.N", "shin.N", "foot.N", "thigh.F", "shin.F", "foot.F",
}

# Rest world angle of each bone, derived from the skeleton itself so the two
# can never drift apart.
REST_WORLD = {}
for _n, _h, _t, _p in BONES:
    _dx, _dz = _t[0] - _h[0], _t[2] - _h[2]
    REST_WORLD[_n] = math.degrees(math.atan2(_dx, -_dz))

# Root first, then parents before children.
POSE_ORDER = [name for name, _h, _t, _p in BONES]


def apply_pose(arm, pose):
    for pb in arm.pose.bones:
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.location = (0.0, 0.0, 0.0)

    deviation = {}  # accumulated rotation from rest, root -> this bone
    for name in POSE_ORDER:
        if name not in arm.pose.bones:
            continue
        pb = arm.pose.bones[name]
        val = pose.get(name, None)
        parent = PARENT_OF[name]
        parent_dev = deviation.get(parent, 0.0) if parent else 0.0

        if isinstance(val, dict):
            loc = val.get("loc", (0.0, 0.0, 0.0))
            # root bone points +Z, so its local axes are (X=-Yw, Y=+Zw, Z=-Xw)
            pb.location = (-loc[1], loc[2], -loc[0])
            local = val.get("rot", 0.0)
        elif name in ABSOLUTE_BONES:
            target = REST_WORLD[name] if val is None else float(val)
            local = (target - REST_WORLD[name]) - parent_dev
        else:
            local = 0.0 if val is None else float(val)

        pb.rotation_euler.x = math.radians(local)
        deviation[name] = parent_dev + local


def key_pose(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert("rotation_euler", index=0, frame=frame)
        if pb.name == "root":
            pb.keyframe_insert("location", frame=frame)


def build_actions(arm):
    arm.animation_data_create()
    made = {}
    for c in CLIPS:
        act = bpy.data.actions.new("hydra_" + c["name"])
        act.use_fake_user = True
        arm.animation_data.action = act
        for frame, delta in c["keys"]:
            apply_pose(arm, blend(STANCE, delta))
            key_pose(arm, frame)
        frames = [f for f, _ in c["keys"]]
        made[c["name"]] = {"action": act, "start": min(frames),
                           "end": max(frames), "loop": c["loop"]}
    # leave the rig on idle
    arm.animation_data.action = made["idle"]["action"]
    return made


# ==========================================================================
# 8. SCENE
# ==========================================================================

def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.fps = 24

    # Standard, NOT AgX. AgX is a filmic tonemap: it desaturates saturated
    # emission badly and turned the first test render into blue-grey mush.
    # Flat cel art wants the shader colours written out untouched.
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.view_settings.gamma = 1.0

    sc.render.use_freestyle = True
    vl = sc.view_layers[0]
    vl.freestyle_settings.crease_angle = math.radians(140.0)
    fs = vl.freestyle_settings
    if not fs.linesets:
        fs.linesets.new("outline")
    ls = fs.linesets[0]
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_crease = True
    ls.select_edge_mark = False
    lst = ls.linestyle
    lst.color = (0.035, 0.075, 0.15)
    lst.thickness = 1.6

    world = bpy.data.worlds.new("HydraWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.24, 0.40, 0.62, 1.0)
    bg.inputs[1].default_value = 0.15
    sc.world = world

    # Sun energy is tuned against the cel ramp stops (0.26 / 0.78): a white
    # diffuse surface facing the key reads ~0.85, a 45-degree surface ~0.65,
    # and the shadow side ~0.15, which lands one band in each.
    key = bpy.data.lights.new("Key", type="SUN")
    key.energy = 2.2
    key.angle = math.radians(6.0)
    key_ob = bpy.data.objects.new("Key", key)
    bpy.context.collection.objects.link(key_ob)
    direction = Vector((-0.55, 0.50, -0.67)).normalized()
    key_ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    key_ob.location = (1.6, -1.5, 2.4)

    rim = bpy.data.lights.new("Rim", type="SUN")
    rim.energy = 1.0
    rim_ob = bpy.data.objects.new("Rim", rim)
    bpy.context.collection.objects.link(rim_ob)
    rdir = Vector((0.62, 0.30, -0.30)).normalized()
    rim_ob.rotation_euler = rdir.to_track_quat("-Z", "Y").to_euler()
    rim_ob.location = (-1.8, -1.0, 1.6)

    cam_data = bpy.data.cameras.new("SideCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 2.60
    cam = bpy.data.objects.new("SideCam", cam_data)
    bpy.context.collection.objects.link(cam)
    sc.camera = cam
    aim_camera(cam, yaw_deg=15.0)
    return sc, cam


def aim_camera(cam, yaw_deg=15.0, target_z=0.950, distance=8.0):
    """Place the ortho camera on a ring around the character.

    yaw 0 = dead-on profile. Positive yaw swings the camera toward his front,
    giving the slight 3/4 that Benjamin's Gemini renders use.
    """
    a = math.radians(yaw_deg)
    cam.location = (distance * math.sin(a), -distance * math.cos(a), target_z)
    cam.rotation_euler = (math.radians(90.0), 0.0, a)


# ==========================================================================

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures,
                 bpy.data.actions, bpy.data.lights, bpy.data.cameras):
        for item in list(coll):
            coll.remove(item)


def main():
    clear_scene()
    build_materials()

    build_torso()
    build_belt()
    build_emblem()
    build_jacket()
    build_collar()
    build_lapels()
    build_shoulder_pads()
    build_neck()
    build_head()
    build_face()
    build_hair()
    for side in ("F", "N"):          # far side first so it draws behind
        build_arm(side)
        build_leg(side)
        build_boot(side)

    arm = build_armature()
    for ob, bones in PARTS:
        weight_to_bones(ob, arm, bones)

    clips = build_actions(arm)
    setup_scene()

    print("HYDRA_PARTS %d" % len(PARTS))
    print("HYDRA_CLIPS %s" % ",".join(
        "%s:%d-%d" % (k, v["start"], v["end"]) for k, v in clips.items()))
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print("HYDRA_SAVED %s" % BLEND_PATH)


if __name__ == "__main__":
    main()
