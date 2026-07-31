"""
Builds Helen (Helium) -- modelled, rigged and animated procedurally.

Run:
  blender --background --python tools/blender/build_helen.py

Writes tools/blender/helen.blend.

Design targets, from Benjamin's Gemini render in art-src/helen-cut.png:
  pearlescent noble-gas girl -- rounded anime proportions, flowing pale
  white/blue "gas" hair that streams up and back like rising bubbles, a
  lavender-and-gold dress with a stand collar and a round gem brooch at the
  throat, a layered bubble skirt flaring at the hip, bare arms and legs, a
  gold bubble cuff at each wrist, and gold-trimmed winged boots.

Facing rule (see the vault doc, Session 2; also tools/blender/README.md):
  forward direction lives in the SILHOUETTE, not in decals. Every profile
  below keeps a gentle convex front / flatter back, elbows bow back with
  hands ending forward, and boots have a forward toe box with a flush heel.

Reuses the shared rig/animation/skinning machinery from hydra_common.py
unchanged -- only the palette, geometry, joint tables and pose data below
are character-specific, per tools/blender/README.md's "adding another
character" section.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from hydra_common import (  # noqa: E402
    M, MAT, SAG_AXIS, add_subsurf, ball, box, build_materials, eye, hand,
    loft, spike, taper, weight_to_bones,
)

HERE = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(HERE, "helen.blend")

# Half-offsets: NEAR side is -Y (toward the camera), FAR side is +Y.
NEAR, FAR = -1.0, 1.0

SHOULDER_Y = 0.165
HIP_Y = 0.078

PARTS = []  # (object, [bone whitelist])


def register(ob, bones, subsurf=1):
    if subsurf:
        add_subsurf(ob, levels=subsurf, render_levels=subsurf + 1)
    PARTS.append((ob, bones))
    return ob


# ==========================================================================
# Palette -- pearlescent lavender/blue + gold, sampled from
# art-src/helen-cut.png. Kept separate from hydra_common.PALETTE so the two
# characters never share a color table; build_materials() takes it directly.
# ==========================================================================

HELEN_PALETTE = {
    "skin":    (0.99, 0.93, 0.87),
    "hair":    (0.87, 0.93, 1.00),
    "hair_tip": (0.64, 0.78, 1.00),
    "dress":   (0.56, 0.50, 0.85),
    "dress_lt": (0.75, 0.71, 0.97),
    "trim":    (0.95, 0.79, 0.34),
    "boot":    (0.63, 0.68, 0.92),
    "sole":    (0.91, 0.93, 0.98),
    "wing":    (0.90, 0.94, 1.00),
    "sclera":  (0.99, 0.99, 1.00),
    "iris":    (0.28, 0.60, 0.94),
    "pupil":   (0.10, 0.13, 0.25),
    "blush":   (0.99, 0.71, 0.75),
    # soft grey-violet, NOT near-black -- Hydra's near-black brow read as a
    # scowling smudge; Helen's expression should be calm, so lighten it.
    "dark":    (0.34, 0.31, 0.47),
}

HELEN_EMISSIVE = {
    "gem":       ((0.80, 0.92, 1.00), 0.55),
    "highlight": ((1.00, 1.00, 1.00), 0.55),
}


# ==========================================================================
# 1. DRESS -- fitted bodice, stand collar, gold placket + brooch
# ==========================================================================

def build_dress():
    d = M("dress")
    rings = [
        # z,     x-off, half-width, forward depth, back depth
        (1.010, 0.000, 0.104, 0.090, 0.086),   # waist / skirt seam
        (1.080, 0.002, 0.090, 0.082, 0.076),   # waist (nipped in)
        (1.150, 0.003, 0.094, 0.086, 0.076),
        (1.230, 0.003, 0.102, 0.092, 0.078),   # chest (gentle convex front)
        (1.310, 0.001, 0.110, 0.096, 0.082),
        (1.390, -0.002, 0.098, 0.076, 0.086),  # clavicle taper
        (1.448, -0.006, 0.080, 0.058, 0.074),  # shoulder shelf
    ]
    r = [{"c": (x, 0.0, z), "w": w, "df": df, "db": db}
         for z, x, w, df, db in rings]
    ob = loft("helen_dress", r, [d] * (len(r) - 1))
    return register(ob, ["hips", "spine", "chest", "neck"])


def build_waistband():
    t = M("trim")
    r = [
        {"c": (0.006, 0.0, 0.988), "w": 0.104, "df": 0.092, "db": 0.086},
        {"c": (0.006, 0.0, 1.010), "w": 0.108, "df": 0.096, "db": 0.088},
    ]
    ob = loft("helen_waistband", r, [t], cap0=False, cap1=False)
    return register(ob, ["hips", "spine"])


def build_collar():
    t = M("trim")
    r = [
        {"c": (-0.006, 0.0, 1.448), "w": 0.078, "df": 0.058, "db": 0.070},
        {"c": (-0.008, 0.0, 1.492), "w": 0.070, "df": 0.052, "db": 0.062},
        {"c": (-0.010, 0.0, 1.520), "w": 0.062, "df": 0.046, "db": 0.056},
    ]
    ob = loft("helen_collar", r, [t, t])
    return register(ob, ["chest", "neck"])


def build_gem():
    ob = ball("helen_gem", (0.078, 0.0, 1.415), 0.024, M("gem"),
              scale=(0.85, 0.85, 0.85))
    return register(ob, ["chest", "neck"], subsurf=0)


def build_placket():
    ob = box("helen_placket", (0.092, 0.0, 1.180), (0.010, 0.010, 0.150),
             M("trim"), rot=(0, -4, 0))
    return register(ob, ["spine", "chest"], subsurf=0)


def build_shoulder_caps():
    objs = []
    for side, y in (("N", NEAR * SHOULDER_Y), ("F", FAR * SHOULDER_Y)):
        far = side == "F"
        ob = ball("helen_shoulder_" + side, (-0.002, y * 0.97, 1.448), 0.062,
                  M("dress_lt", far), scale=(0.95, 0.85, 0.78))
        objs.append(register(ob, ["chest", "shoulder." + side,
                                  "upperarm." + side], subsurf=0))
        trim = ball("helen_shoulder_trim_" + side,
                    (-0.002, y * 0.98, 1.408), 0.058,
                    M("trim", far), scale=(0.90, 0.80, 0.22))
        objs.append(register(trim, ["shoulder." + side, "upperarm." + side],
                             subsurf=0))
    return objs


# ==========================================================================
# 2. SKIRT -- two staggered rings of overlapping bubbles, flaring at the hip
# ==========================================================================

# Hand-placed like Hydra's HAIR_SPIKES, not procedurally generated, so each
# bubble's size/overlap can be art-directed. (x, y, z, radius).
SKIRT_BALLS = [
    # upper ring -- tighter, close under the waistband
    (0.086, 0.000, 0.970, 0.052),
    (0.070, -0.078, 0.965, 0.048),
    (0.070, 0.078, 0.965, 0.048),
    (0.030, -0.128, 0.955, 0.044),
    (0.030, 0.128, 0.955, 0.044),
    (-0.030, -0.110, 0.958, 0.042),
    (-0.030, 0.110, 0.958, 0.042),
    (-0.080, 0.000, 0.960, 0.046),
    # lower ring -- wider flare, bigger bubbles (matches the render's tutu)
    (0.110, 0.000, 0.895, 0.062),
    (0.095, -0.095, 0.885, 0.058),
    (0.095, 0.095, 0.885, 0.058),
    (0.045, -0.155, 0.865, 0.052),
    (0.045, 0.155, 0.865, 0.052),
    (-0.020, -0.135, 0.860, 0.048),
    (-0.020, 0.135, 0.860, 0.048),
    (-0.070, 0.000, 0.862, 0.050),
]


def build_skirt():
    objs = []
    for i, (x, y, z, r) in enumerate(SKIRT_BALLS):
        far = y > 1e-6
        ob = ball("helen_skirt_%02d" % i, (x, y, z), r, M("dress_lt", far),
                  scale=(1.05, 1.0, 0.92))
        objs.append(register(ob, ["hips", "spine"], subsurf=0))
    return objs


# ==========================================================================
# 3. HEAD, FACE, HAIR
# ==========================================================================

def build_neck():
    s = M("skin")
    r = [
        {"c": (0.002, 0.0, 1.452), "w": 0.052, "df": 0.050, "db": 0.050},
        {"c": (0.004, 0.0, 1.500), "w": 0.046, "df": 0.046, "db": 0.046},
        {"c": (0.006, 0.0, 1.548), "w": 0.044, "df": 0.044, "db": 0.044},
    ]
    ob = loft("helen_neck", r, [s, s])
    return register(ob, ["chest", "neck", "head"])


def build_head():
    s = M("skin")
    rings = [
        # z,     x-off, half-w, fwd,   back -- rounder cranium than Hydra's
        (1.548, 0.014, 0.036, 0.052, 0.052),
        (1.572, 0.012, 0.062, 0.084, 0.074),
        (1.600, 0.008, 0.082, 0.100, 0.092),
        (1.636, 0.002, 0.094, 0.108, 0.106),
        (1.680, 0.000, 0.100, 0.106, 0.118),
        (1.730, 0.000, 0.099, 0.096, 0.122),
        (1.780, 0.000, 0.086, 0.080, 0.110),
        (1.822, 0.000, 0.056, 0.050, 0.078),
        (1.848, 0.000, 0.020, 0.018, 0.032),
    ]
    r = [{"c": (x, 0.0, z), "w": w, "df": df, "db": db}
         for z, x, w, df, db in rings]
    ob = loft("helen_head", r, [s] * (len(r) - 1))
    return register(ob, ["head"])


def build_face():
    objs = []
    nose = ball("helen_nose", (0.096, 0.0, 1.630), 0.020, M("skin"),
                scale=(1.0, 0.60, 0.55), rot=(0, 22, 0))
    objs.append(register(nose, ["head"], subsurf=0))

    # soft closed smile -- gently upturned, not the angry Hydra scowl-mouth
    mouth = ball("helen_mouth", (0.092, NEAR * 0.018, 1.606), 0.016,
                 M("dark"), scale=(0.55, 1.05, 0.20), rot=(0, 6, -22))
    objs.append(register(mouth, ["head"], subsurf=0))

    for side, y in (("N", NEAR * 0.058), ("F", FAR * 0.058)):
        far = side == "F"
        yaw = -18.0 if side == "N" else 18.0
        y_sign = NEAR if side == "N" else FAR
        mats = {"sclera": M("sclera", far), "iris": M("iris", far),
                "pupil": M("pupil", far), "highlight": M("highlight", far)}
        eye_objs = eye("helen_eye_" + side, (0.076, y, 1.658), mats,
                       y_sign=y_sign, size=0.046, rot=(0, 8, yaw))
        for ob in eye_objs:
            objs.append(register(ob, ["head"], subsurf=0))

        # gentle brow, angled up-and-out instead of scowling down
        brow = ball("helen_brow_" + side, (0.072, y * 1.02, 1.690), 0.044,
                    M("dark", far), scale=(0.90, 0.55, 0.18), rot=(0, 12, yaw))
        objs.append(register(brow, ["head"], subsurf=0))

        blush = ball("helen_blush_" + side, (0.066, y * 1.15, 1.616), 0.028,
                     M("blush", far), scale=(0.75, 0.85, 0.55))
        objs.append(register(blush, ["head"], subsurf=0))
    return objs


# Hand-placed like Hydra's HAIR_SPIKES, but the DIRECTIONS all point the same
# general way (up and back) instead of radiating outward like a starburst --
# that's what separates "flowing" hair from Hydra's spiky silhouette. A big
# curve exaggerates the sweep and a high flare keeps each lock fat until the
# very tip instead of tapering to a needle point.
# (base xyz, direction, length, base radius)
HAIR_STRANDS = [
    ((0.000, 0.000, 1.838), (-0.10, 0.00, 0.99), 0.60, 0.040),
    ((0.020, -0.045, 1.826), (0.05, -0.25, 0.97), 0.56, 0.036),
    ((0.020, 0.045, 1.826), (0.05, 0.25, 0.97), 0.56, 0.036),
    ((-0.030, -0.065, 1.808), (-0.15, -0.35, 0.92), 0.58, 0.034),
    ((-0.030, 0.065, 1.808), (-0.15, 0.35, 0.92), 0.58, 0.034),
    ((-0.060, 0.000, 1.784), (-0.35, 0.00, 0.94), 0.62, 0.032),
    ((-0.075, -0.040, 1.744), (-0.45, -0.15, 0.88), 0.46, 0.028),
    ((-0.075, 0.040, 1.744), (-0.45, 0.15, 0.88), 0.46, 0.028),
    # forward-framing bangs, keep the face from reading bald from the front
    ((0.070, -0.030, 1.720), (0.55, -0.10, 0.35), 0.16, 0.024),
    ((0.070, 0.030, 1.720), (0.55, 0.10, 0.35), 0.16, 0.024),
    ((0.080, 0.000, 1.750), (0.60, 0.00, 0.55), 0.18, 0.026),
]


def build_hair():
    objs = []
    cap = [
        {"c": (0.008, 0.0, 1.660), "w": 0.098, "df": 0.094, "db": 0.116},
        {"c": (0.004, 0.0, 1.720), "w": 0.104, "df": 0.098, "db": 0.122},
        {"c": (0.000, 0.0, 1.780), "w": 0.100, "df": 0.088, "db": 0.118},
        {"c": (0.000, 0.0, 1.826), "w": 0.070, "df": 0.062, "db": 0.088},
        {"c": (0.000, 0.0, 1.850), "w": 0.028, "df": 0.026, "db": 0.038},
    ]
    h = M("hair")
    objs.append(register(loft("helen_hair_cap", cap, [h] * 4), ["head"]))

    for i, (base, d, length, r) in enumerate(HAIR_STRANDS):
        back = d[0] < 0.3
        curve = (-0.09 if back else 0.02, d[1] * -0.02, 0.03)
        ob = spike("helen_hair_%02d" % i, base, d, length, r,
                   M("hair"), M("hair_tip"), curve=curve,
                   flare=3.2, tip_frac=0.50, n=10)
        objs.append(register(ob, ["head", "hair"], subsurf=0))
    return objs


# ==========================================================================
# 4. ARMS -- bare skin, gold bubble cuff, a real hand (no clay-ball fist)
# ==========================================================================

ARM_JOINTS = {
    "N": {"shoulder": (0.000, NEAR * SHOULDER_Y, 1.445),
          "elbow": (-0.036, NEAR * 0.188, 1.170),
          "wrist": (0.040, NEAR * 0.176, 0.958),
          "fist": (0.062, NEAR * 0.172, 0.908)},
    "F": {"shoulder": (0.000, FAR * SHOULDER_Y, 1.445),
          "elbow": (-0.036, FAR * 0.188, 1.170),
          "wrist": (0.040, FAR * 0.176, 0.958),
          "fist": (0.062, FAR * 0.172, 0.908)},
}


def build_arm(side):
    far = side == "F"
    j = ARM_JOINTS[side]
    objs = []

    upper = taper("helen_upperarm_" + side, j["shoulder"], j["elbow"],
                  [(0.00, 0.052), (0.30, 0.046), (0.65, 0.041),
                   (1.00, 0.038)],
                  [M("skin", far)] * 3, bulge_f=1.04)
    objs.append(register(upper, ["shoulder." + side, "upperarm." + side]))

    fore = taper("helen_forearm_" + side, j["elbow"], j["wrist"],
                 [(0.00, 0.038), (0.35, 0.036), (0.70, 0.032),
                  (1.00, 0.028)],
                 [M("skin", far)] * 3, bulge_f=1.03)
    objs.append(register(fore, ["forearm." + side, "hand." + side]))

    cuff = ball("helen_cuff_" + side, j["wrist"], 0.040, M("trim", far),
                scale=(1.0, 1.0, 0.34))
    objs.append(register(cuff, ["forearm." + side, "hand." + side],
                         subsurf=0))

    thumb_side = NEAR if side == "N" else FAR
    hand_ob = hand("helen_hand_" + side, j["fist"], M("skin", far),
                   size=0.062, curl=0.35, rot=(0, -8, 0),
                   thumb_side=thumb_side)
    objs.append(register(hand_ob, ["hand." + side]))
    return objs


# ==========================================================================
# 5. LEGS AND BOOTS -- bare legs, winged gold-trimmed boots
# ==========================================================================

LEG_JOINTS = {
    "N": {"hip": (0.003, NEAR * HIP_Y, 1.000),
          "knee": (0.008, NEAR * 0.088, 0.520),
          "ankle": (0.000, NEAR * 0.092, 0.148)},
    "F": {"hip": (0.003, FAR * HIP_Y, 1.000),
          "knee": (0.008, FAR * 0.088, 0.520),
          "ankle": (0.000, FAR * 0.092, 0.148)},
}


def build_leg(side):
    far = side == "F"
    j = LEG_JOINTS[side]
    objs = []

    thigh = taper("helen_thigh_" + side, j["hip"], j["knee"],
                  [(0.00, 0.082), (0.35, 0.072), (0.70, 0.062),
                   (1.00, 0.056)],
                  [M("skin", far)] * 3, bulge_f=1.05)
    objs.append(register(thigh, ["hips", "thigh." + side]))

    shin = taper("helen_shin_" + side, j["knee"], j["ankle"],
                 [(0.00, 0.054), (0.30, 0.048), (0.65, 0.040),
                  (1.00, 0.032)],
                 [M("skin", far)] * 3, bulge_f=1.02)
    objs.append(register(shin, ["thigh." + side, "shin." + side]))
    return objs


def build_boot(side):
    far = side == "F"
    y = LEG_JOINTS[side]["ankle"][1]
    b, sole, trim = M("boot", far), M("sole", far), M("trim", far)
    rings = [
        (0.000, 0.028, 0.046, 0.098, 0.060),
        (0.020, 0.028, 0.050, 0.100, 0.064),
        (0.050, 0.018, 0.046, 0.086, 0.060),
        (0.088, 0.006, 0.042, 0.064, 0.054),
        (0.128, 0.000, 0.040, 0.050, 0.048),
        (0.168, 0.000, 0.044, 0.052, 0.052),
    ]
    r = [{"c": (x, y, z), "w": w, "df": df, "db": db}
         for z, x, w, df, db in rings]
    ob = loft("helen_boot_" + side, r, [sole, b, b, b, trim])
    objs = [register(ob, ["shin." + side, "foot." + side])]

    strap = box("helen_strap_" + side, (0.024, y, 0.112),
               (0.110, 0.100, 0.016), trim)
    objs.append(register(strap, ["foot." + side], subsurf=0))

    # small wing fin on the outer ankle -- a flattened, fanned bubble. Its
    # own pale "wing" material (not the strap's gold) is what keeps it from
    # visually merging into the strap into one blob.
    wing_sgn = NEAR if side == "N" else FAR
    wing = ball("helen_wing_" + side, (-0.030, y + wing_sgn * 0.030, 0.155),
               0.075, M("wing", far), scale=(1.7, 0.09, 0.95),
               rot=(0, 18, -30 * wing_sgn))
    objs.append(register(wing, ["foot." + side], subsurf=0))
    return objs


# ==========================================================================
# 6. ARMATURE -- same bone layout convention as Hydra, Helen's proportions
# ==========================================================================

BONES = [
    # name,         head,                         tail,                        parent
    ("root",        (0.000, 0.0, 0.950),          (0.000, 0.0, 1.010),         None),
    ("hips",        (0.000, 0.0, 1.010),          (0.000, 0.0, 1.100),         "root"),
    ("spine",       (0.000, 0.0, 1.100),          (0.000, 0.0, 1.270),         "hips"),
    ("chest",       (0.000, 0.0, 1.270),          (0.000, 0.0, 1.452),         "spine"),
    ("neck",        (0.000, 0.0, 1.452),          (0.004, 0.0, 1.548),         "chest"),
    ("head",        (0.004, 0.0, 1.548),          (0.000, 0.0, 1.848),         "neck"),
    ("hair",        (-0.018, 0.0, 1.800),         (-0.150, 0.0, 1.980),        "head"),
]

for _s, _sgn in (("N", NEAR), ("F", FAR)):
    BONES += [
        ("shoulder." + _s, (0.000, _sgn * 0.058, 1.458),
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
         (0.120, _sgn * 0.092, 0.040), "shin." + _s),
    ]


def build_armature():
    arm_data = bpy.data.armatures.new("HelenRig")
    arm = bpy.data.objects.new("HelenRig", arm_data)
    bpy.context.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")

    for name, head, tail, parent in BONES:
        eb = arm_data.edit_bones.new(name)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
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
# Positive = the bone's tail moves FORWARD (+X, the way she faces).

STANCE = {
    # A calm, floaty hover -- weight barely settled, nothing clenched.
    # Noticeably gentler than Hydra's loaded fighter crouch, matching the
    # "floaty, calm" tagline and the 0.62 gravityScale / 2 air-jumps kit.
    "root": {"loc": (0.006, 0.0, -0.010)},
    "hips": 1.0,
    "spine": 2.0,
    "chest": -1.5,
    "neck": 1.0,
    "head": -3.0,
    "hair": 5.0,
    "shoulder.N": 3.0,
    "shoulder.F": -2.0,
    "upperarm.N": -8.0, "forearm.N": 20.0, "hand.N": 6.0,
    "upperarm.F": -12.0, "forearm.F": 26.0, "hand.F": 8.0,
    "thigh.N": 8.0, "shin.N": -4.0, "foot.N": 48.0,
    "thigh.F": -6.0, "shin.F": -10.0, "foot.F": 42.0,
}


def blend(base, over):
    out = dict(base)
    for k, v in over.items():
        if k == "stretch":
            out["stretch"] = dict(base.get("stretch", {}))
            out["stretch"].update(v)
        elif k == "root":
            loc = dict(base.get("root", {})).get("loc", (0, 0, 0))
            add = v.get("loc", (0, 0, 0))
            out["root"] = {"loc": tuple(a + b for a, b in zip(loc, add)),
                           "rot": v.get("rot", base.get("root", {})
                                        .get("rot", 0.0))}
        else:
            out[k] = base.get(k, 0.0) + v
    return out


def d(**kw):
    return kw


CLIPS = []


def clip(name, loop, keys):
    CLIPS.append({"name": name, "loop": loop, "keys": keys})


clip("idle", True, [
    (1, {}),
    (7, {"root": {"loc": (0.0, 0.0, 0.014)}, "spine": 1.0, "chest": 1.0,
         "neck": -1.0, "head": 1.0, "hair": -3.0,
         "upperarm.N": 2.0, "forearm.N": -2.0,
         "upperarm.F": 1.0, "forearm.F": -2.0,
         "thigh.N": -1.0, "thigh.F": 1.0}),
    (13, {"spine": -0.5, "chest": -0.5, "hair": 2.0}),
    (19, {"root": {"loc": (0.0, 0.0, 0.010)}, "spine": 0.8, "chest": 0.8,
          "neck": -0.6, "head": 0.6, "hair": -2.0,
          "upperarm.N": 1.0, "upperarm.F": 0.5}),
    (25, {}),
])

clip("walk", True, [  # a light glide-step, not a hard jog -- she's floaty
    (1, {"spine": 3.0,
         "thigh.N": 16.0, "shin.N": -10.0, "foot.N": 6.0,
         "thigh.F": -18.0, "shin.F": -12.0, "foot.F": 4.0,
         "upperarm.N": -18.0, "forearm.N": -14.0,
         "upperarm.F": 18.0, "forearm.F": -22.0,
         "root": {"loc": (0.0, 0.0, 0.020)}, "hair": -6.0}),
    (5, {"spine": 4.0,
         "thigh.N": -6.0, "shin.N": -26.0, "foot.N": 12.0,
         "thigh.F": 4.0, "shin.F": -2.0, "foot.F": -4.0,
         "upperarm.N": 0.0, "forearm.N": -6.0,
         "upperarm.F": 0.0, "forearm.F": -12.0,
         "root": {"loc": (0.0, 0.0, -0.010)}, "hair": 4.0}),
    (9, {"spine": 3.0,
         "thigh.N": -18.0, "shin.N": -12.0, "foot.N": 4.0,
         "thigh.F": 16.0, "shin.F": -10.0, "foot.F": 6.0,
         "upperarm.N": 18.0, "forearm.N": -22.0,
         "upperarm.F": -18.0, "forearm.F": -14.0,
         "root": {"loc": (0.0, 0.0, 0.020)}, "hair": -6.0}),
    (13, {"spine": 4.0,
          "thigh.N": 4.0, "shin.N": -2.0, "foot.N": -4.0,
          "thigh.F": -6.0, "shin.F": -26.0, "foot.F": 12.0,
          "upperarm.N": 0.0, "forearm.N": -12.0,
          "upperarm.F": 0.0, "forearm.F": -6.0,
          "root": {"loc": (0.0, 0.0, -0.010)}, "hair": 4.0}),
    (17, {"spine": 3.0,
          "thigh.N": 16.0, "shin.N": -10.0, "foot.N": 6.0,
          "thigh.F": -18.0, "shin.F": -12.0, "foot.F": 4.0,
          "upperarm.N": -18.0, "forearm.N": -14.0,
          "upperarm.F": 18.0, "forearm.F": -22.0,
          "root": {"loc": (0.0, 0.0, 0.020)}, "hair": -6.0}),
])

clip("jump", False, [
    (1, {}),
    (3, {"root": {"loc": (0.0, 0.0, -0.040)}, "spine": 6.0, "chest": 3.0,
         "thigh.N": 14.0, "shin.N": -30.0, "thigh.F": 8.0, "shin.F": -26.0,
         "foot.N": 16.0, "foot.F": 14.0,
         "upperarm.N": -30.0, "forearm.N": -34.0,
         "upperarm.F": -34.0, "forearm.F": -40.0, "hair": 10.0}),
    (6, {"root": {"loc": (0.0, 0.0, 0.060)}, "spine": -6.0, "chest": -4.0,
         "neck": -4.0, "head": 3.0, "hair": -20.0,
         "thigh.N": -10.0, "shin.N": -2.0, "thigh.F": -12.0, "shin.F": -4.0,
         "foot.N": -10.0, "foot.F": -12.0,
         "upperarm.N": 40.0, "forearm.N": -36.0,
         "upperarm.F": 36.0, "forearm.F": -40.0}),
    (10, {"root": {"loc": (0.0, 0.0, 0.030)}, "spine": -2.0, "hair": -24.0,
          "thigh.N": 18.0, "shin.N": -30.0, "thigh.F": -4.0, "shin.F": -14.0,
          "foot.N": 10.0, "foot.F": -6.0,
          "upperarm.N": 18.0, "forearm.N": -24.0,
          "upperarm.F": 22.0, "forearm.F": -28.0}),
])

clip("fall", True, [
    (1, {"root": {"loc": (0.0, 0.0, 0.030)}, "spine": -4.0, "neck": -4.0,
         "head": 3.0, "hair": -26.0,
         "thigh.N": 16.0, "shin.N": -20.0, "thigh.F": -14.0, "shin.F": -10.0,
         "foot.N": 8.0, "foot.F": -8.0,
         "upperarm.N": 36.0, "forearm.N": -30.0,
         "upperarm.F": 42.0, "forearm.F": -34.0}),
    (7, {"root": {"loc": (0.0, 0.0, 0.038)}, "spine": -2.0, "neck": -4.0,
         "head": 3.0, "hair": -20.0,
         "thigh.N": 10.0, "shin.N": -14.0, "thigh.F": -18.0, "shin.F": -6.0,
         "foot.N": 4.0, "foot.F": -4.0,
         "upperarm.N": 40.0, "forearm.N": -26.0,
         "upperarm.F": 38.0, "forearm.F": -30.0}),
    (13, {"root": {"loc": (0.0, 0.0, 0.030)}, "spine": -4.0, "neck": -4.0,
          "head": 3.0, "hair": -26.0,
          "thigh.N": 16.0, "shin.N": -20.0, "thigh.F": -14.0, "shin.F": -10.0,
          "foot.N": 8.0, "foot.F": -8.0,
          "upperarm.N": 36.0, "forearm.N": -30.0,
          "upperarm.F": 42.0, "forearm.F": -34.0}),
])

clip("attack", False, [  # Balloon Bop -- a light near-hand tap, not a jab
    (1, {}),
    (3, {"root": {"loc": (-0.014, 0.0, 0.010)}, "spine": -4.0, "chest": -2.0,
         "hair": 6.0,
         "upperarm.N": -30.0, "forearm.N": 30.0,  # hand drawn up and back
         "upperarm.F": -6.0, "forearm.F": 14.0,
         "thigh.N": 2.0, "thigh.F": -4.0}),
    (6, {"root": {"loc": (0.055, 0.0, -0.006)}, "spine": 8.0, "chest": 4.0,
         "neck": -3.0, "hair": -10.0,
         "upperarm.N": 58.0, "forearm.N": -20.0, "hand.N": -6.0,
         "upperarm.F": -16.0, "forearm.F": -8.0,
         "thigh.N": 10.0, "shin.N": -4.0, "thigh.F": -12.0,
         "stretch": {"upperarm.N": 1.06, "forearm.N": 1.10}}),
    (8, {"root": {"loc": (0.040, 0.0, -0.004)}, "spine": 5.0, "chest": 2.0,
         "hair": -6.0,
         "upperarm.N": 46.0, "forearm.N": -16.0,
         "upperarm.F": -12.0, "forearm.F": -4.0,
         "thigh.N": 6.0, "thigh.F": -8.0}),
    (12, {}),
])

clip("special", False, [  # Noble Gust -- gather, then push a gust forward
    (1, {}),
    (5, {"root": {"loc": (-0.016, 0.0, -0.020)}, "spine": 6.0, "chest": 4.0,
         "neck": -2.0, "head": 2.0, "hair": 10.0,
         "upperarm.N": -20.0, "forearm.N": 40.0,
         "upperarm.F": -20.0, "forearm.F": 40.0,
         "thigh.N": 6.0, "shin.N": -10.0,
         "thigh.F": 6.0, "shin.F": -10.0}),
    (9, {"root": {"loc": (0.030, 0.0, 0.010)}, "spine": -6.0, "chest": -3.0,
         "neck": -2.0, "head": 2.0, "hair": -16.0,
         # both hands push forward together -- reads as releasing an orb,
         # not a Hydra-style radial self-detonation
         "upperarm.N": 46.0, "forearm.N": -8.0, "hand.N": -10.0,
         "upperarm.F": 46.0, "forearm.F": -8.0, "hand.F": -10.0,
         "thigh.N": -6.0, "shin.N": 4.0,
         "thigh.F": -6.0, "shin.F": 4.0,
         "stretch": {"forearm.N": 1.08, "forearm.F": 1.08}}),
    (12, {"root": {"loc": (0.014, 0.0, 0.004)}, "spine": -2.0, "hair": -8.0,
          "upperarm.N": 30.0, "forearm.N": -4.0,
          "upperarm.F": 30.0, "forearm.F": -4.0}),
    (16, {}),
])

clip("hurt", False, [
    (1, {}),
    (3, {"root": {"loc": (-0.040, 0.0, 0.012)}, "spine": -14.0, "chest": -8.0,
         "neck": -10.0, "head": 8.0, "hair": 18.0,
         "upperarm.N": -34.0, "forearm.N": -48.0,
         "upperarm.F": -38.0, "forearm.F": -52.0,
         "thigh.N": 14.0, "shin.N": -10.0,
         "thigh.F": -8.0, "shin.F": -14.0}),
    (6, {"root": {"loc": (-0.020, 0.0, 0.0)}, "spine": -6.0, "chest": -4.0,
         "neck": -5.0, "head": 4.0, "hair": 10.0,
         "upperarm.N": -16.0, "forearm.N": -24.0,
         "upperarm.F": -18.0, "forearm.F": -26.0}),
    (10, {}),
])

clip("ko", False, [  # floaty tumble away, slower spin than Hydra's KO
    (1, {}),
    (3, {"root": {"loc": (-0.020, 0.0, 0.050), "rot": -36.0},
         "spine": -10.0, "neck": -10.0, "head": 6.0, "hair": 20.0,
         "upperarm.N": -40.0, "forearm.N": -56.0,
         "upperarm.F": -44.0, "forearm.F": -60.0,
         "thigh.N": 20.0, "shin.N": -20.0, "thigh.F": 6.0, "shin.F": -26.0}),
    (9, {"root": {"loc": (-0.045, 0.0, 0.095), "rot": -160.0},
         "spine": -8.0, "neck": -8.0, "hair": 30.0,
         "upperarm.N": -48.0, "forearm.N": -50.0,
         "upperarm.F": -50.0, "forearm.F": -54.0,
         "thigh.N": 24.0, "shin.N": -16.0, "thigh.F": 2.0, "shin.F": -30.0}),
    (15, {"root": {"loc": (-0.070, 0.0, 0.130), "rot": -280.0},
          "spine": -9.0, "neck": -8.0, "hair": 26.0,
          "upperarm.N": -44.0, "forearm.N": -52.0,
          "upperarm.F": -48.0, "forearm.F": -56.0,
          "thigh.N": 22.0, "shin.N": -18.0, "thigh.F": 4.0, "shin.F": -28.0}),
])


PARENT_OF = {name: parent for name, _h, _t, parent in BONES}

ABSOLUTE_BONES = {
    "upperarm.N", "forearm.N", "hand.N", "upperarm.F", "forearm.F", "hand.F",
    "thigh.N", "shin.N", "foot.N", "thigh.F", "shin.F", "foot.F",
}

REST_WORLD = {}
for _n, _h, _t, _p in BONES:
    _dx, _dz = _t[0] - _h[0], _t[2] - _h[2]
    REST_WORLD[_n] = math.degrees(math.atan2(_dx, -_dz))

POSE_ORDER = [name for name, _h, _t, _p in BONES]


def apply_pose(arm, pose):
    for pb in arm.pose.bones:
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.location = (0.0, 0.0, 0.0)
        pb.scale = (1.0, 1.0, 1.0)

    for name, amount in pose.get("stretch", {}).items():
        if name in arm.pose.bones:
            arm.pose.bones[name].scale.y = amount

    deviation = {}
    for name in POSE_ORDER:
        if name not in arm.pose.bones:
            continue
        pb = arm.pose.bones[name]
        val = pose.get(name, None)
        parent = PARENT_OF[name]
        parent_dev = deviation.get(parent, 0.0) if parent else 0.0

        if isinstance(val, dict):
            loc = val.get("loc", (0.0, 0.0, 0.0))
            pb.location = (-loc[1], loc[2], -loc[0])
            local = val.get("rot", 0.0)
        elif name in ABSOLUTE_BONES:
            target = REST_WORLD[name] if val is None else float(val)
            local = (target - REST_WORLD[name]) - parent_dev
        else:
            local = 0.0 if val is None else float(val)

        pb.rotation_euler.x = math.radians(local)
        deviation[name] = parent_dev + local


STRETCH_BONES = ("upperarm.N", "forearm.N", "hand.N",
                 "upperarm.F", "forearm.F", "hand.F")


def key_pose(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert("rotation_euler", index=0, frame=frame)
        if pb.name == "root":
            pb.keyframe_insert("location", frame=frame)
        if pb.name in STRETCH_BONES:
            pb.keyframe_insert("scale", index=1, frame=frame)


def build_actions(arm):
    arm.animation_data_create()
    made = {}
    for c in CLIPS:
        act = bpy.data.actions.new("helen_" + c["name"])
        act.use_fake_user = True
        arm.animation_data.action = act
        for frame, delta in c["keys"]:
            apply_pose(arm, blend(STANCE, delta))
            key_pose(arm, frame)
        frames = [f for f, _ in c["keys"]]
        made[c["name"]] = {"action": act, "start": min(frames),
                           "end": max(frames), "loop": c["loop"]}
    arm.animation_data.action = made["idle"]["action"]
    return made


# ==========================================================================
# 8. SCENE -- same camera/lighting conventions as Hydra, for a matching look
# ==========================================================================

def setup_scene():
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.fps = 24

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
    lst.color = (0.15, 0.10, 0.28)
    lst.thickness = 1.6

    world = bpy.data.worlds.new("HelenWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.24, 0.40, 0.62, 1.0)
    bg.inputs[1].default_value = 0.15
    sc.world = world

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
    a = math.radians(yaw_deg)
    cam.location = (distance * math.sin(a), -distance * math.cos(a), target_z)
    cam.rotation_euler = (math.radians(90.0), 0.0, a)


def report_reach(arm, clips, yaw_deg=12.0, ortho_scale=2.60, frame_px=256,
                 display_h=172.0, visible_h_px=213.0):
    a = math.radians(yaw_deg)
    px_per_unit = (frame_px / ortho_scale) * (display_h / visible_h_px)

    def screen_x(v):
        return v.x * math.cos(a) + v.y * math.sin(a)

    out = []
    for name in ("idle", "attack", "special"):
        info = clips[name]
        arm.animation_data.action = info["action"]
        best = None
        for f in range(info["start"], info["end"] + 1):
            bpy.context.scene.frame_set(f)
            bpy.context.view_layer.update()
            tip = arm.matrix_world @ arm.pose.bones["hand.N"].tail
            sx = screen_x(tip)
            if best is None or sx > best[1]:
                best = (f, sx)
        out.append("%s: frame %d, fist %.3fu = %.0fpx from centre"
                   % (name, best[0], best[1], best[1] * px_per_unit))
    arm.animation_data.action = clips["idle"]["action"]
    bpy.context.scene.frame_set(1)
    print("HELEN_REACH %.2f px/unit | %s" % (px_per_unit, " | ".join(out)))


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.armatures,
                 bpy.data.actions, bpy.data.lights, bpy.data.cameras):
        for item in list(coll):
            coll.remove(item)


def main():
    clear_scene()
    build_materials(HELEN_PALETTE, HELEN_EMISSIVE, prefix="helen")

    build_dress()
    build_waistband()
    build_skirt()
    build_collar()
    build_gem()
    build_placket()
    build_shoulder_caps()
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
    report_reach(arm, clips)

    print("HELEN_PARTS %d" % len(PARTS))
    print("HELEN_CLIPS %s" % ",".join(
        "%s:%d-%d" % (k, v["start"], v["end"]) for k, v in clips.items()))
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print("HELEN_SAVED %s" % BLEND_PATH)


if __name__ == "__main__":
    main()
