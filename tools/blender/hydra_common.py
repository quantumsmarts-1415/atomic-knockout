"""
Shared helpers for the Hydra Blender pipeline.

Coordinate convention for this project:
  +X = the direction the character FACES (forward)
  +Y = the character's LEFT  (this is the FAR side from the camera)
  -Y = the character's RIGHT (this is the NEAR side to the camera)
  +Z = up, feet sit at z = 0

Because the game's convention is "art faces right", the camera sits on -Y
looking toward +Y, which puts the character's forward (+X) on screen-right.

Every bone is rolled so that its local X axis equals world -Y. That means a
single value -- rotation_euler.x -- is the sagittal (side-view) swing for every
bone in the rig, and POSITIVE swings the bone's tail FORWARD (+X).
"""

import math
import bmesh
import bpy
from mathutils import Vector

RN = 16  # verts per loft ring

# --------------------------------------------------------------------------
# Palette -- sampled from Benjamin's Gemini render (art-src/hydra-cut.png)
# --------------------------------------------------------------------------

PALETTE = {
    "skin":       (0.58, 0.88, 1.00),
    "skin_dk":    (0.20, 0.55, 0.88),
    "hair":       (0.13, 0.64, 1.00),
    "hair_tip":   (1.00, 0.38, 0.02),
    "jacket":     (0.05, 0.34, 0.80),
    "jacket_lt":  (0.30, 0.70, 1.00),
    "panel":      (0.94, 0.98, 1.00),
    "trim":       (0.66, 0.80, 0.92),
    "pants":      (0.05, 0.11, 0.26),
    "pants_lt":   (0.10, 0.32, 0.66),
    "armor":      (0.60, 0.78, 0.94),
    "bandage":    (0.84, 0.90, 0.96),
    "boot":       (0.08, 0.16, 0.34),
    "sole":       (0.70, 0.82, 0.92),
    "belt":       (0.74, 0.85, 0.94),
    "dark":       (0.03, 0.07, 0.16),
}

# Strength stays at 1.0: with the Standard view transform anything above 1
# just clips to white, which turned the orange eyes into pale yellow blobs.
EMISSIVE = {
    "eye":     ((1.00, 0.46, 0.06), 1.0),
    "emblem":  ((1.00, 0.40, 0.04), 1.0),
    "glow":    ((0.35, 0.82, 1.00), 1.0),
}

# Shadows are tinted toward this instead of just going darker -- flat
# multiplied shadows read grey and muddy at sprite size.
SHADOW_TINT = (0.06, 0.22, 0.52)
SHADOW_TINT_MIX = 0.34

OUTLINE_COLOR = (0.035, 0.075, 0.15)

# Filled by build_materials(); maps material name -> slot index.
MAT = {}
MAT_LIST = []


# --------------------------------------------------------------------------
# Materials -- three-tone cel shading via Shader-to-RGB (EEVEE only)
# --------------------------------------------------------------------------

def _cel_material(name, base, shadow_mul=0.55, light_mul=1.12):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    diff = nt.nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)

    s2rgb = nt.nodes.new("ShaderNodeShaderToRGB")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.interpolation = "CONSTANT"

    shadow = tuple(
        min(1.0, c * shadow_mul) * (1.0 - SHADOW_TINT_MIX)
        + t * SHADOW_TINT_MIX * (0.35 + 0.65 * c)
        for c, t in zip(base, SHADOW_TINT))
    light = tuple(min(1.0, c * light_mul + 0.05) for c in base)
    cr.elements[0].position = 0.0
    cr.elements[0].color = (*shadow, 1.0)
    cr.elements[1].position = 0.26
    cr.elements[1].color = (*base, 1.0)
    hi = cr.elements.new(0.78)
    hi.color = (*light, 1.0)

    emit = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")

    nt.links.new(diff.outputs[0], s2rgb.inputs[0])
    nt.links.new(s2rgb.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], emit.inputs["Color"])
    nt.links.new(emit.outputs[0], out.inputs["Surface"])
    return mat


def _emissive_material(name, color, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*color, 1.0)
    emit.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(emit.outputs[0], out.inputs["Surface"])
    return mat


def build_materials(palette=None, emissive=None, prefix="hydra"):
    """Create every material twice: normal, and a '.far' twin that is darker.

    Side-view sprites go mushy when the far arm and leg are the same value as
    the near ones, so the character's LEFT-side parts (+Y, away from camera)
    get the darkened twin. This is the 3D equivalent of the standard 2D
    side-scroller trick.

    palette/emissive default to this module's Hydra tables so existing calls
    are unaffected; pass a character's own dicts to reuse this function for a
    different palette (prefix keeps Blender's material list readable when
    more than one character's .blend is open at once).
    """
    palette = PALETTE if palette is None else palette
    emissive = EMISSIVE if emissive is None else emissive
    MAT.clear()
    MAT_LIST.clear()

    def add(name, mat):
        MAT[name] = len(MAT_LIST)
        MAT_LIST.append(mat)

    for name, base in palette.items():
        add(name, _cel_material(prefix + "_" + name, base))
        far = tuple(c * 0.70 for c in base)
        add(name + ".far", _cel_material(prefix + "_" + name + "_far", far))

    for name, (color, strength) in emissive.items():
        add(name, _emissive_material(prefix + "_" + name, color, strength))
        add(name + ".far", _emissive_material(
            prefix + "_" + name + "_far",
            tuple(c * 0.7 for c in color), strength * 0.6))

    return MAT_LIST


def M(name, far=False):
    """Material slot index, automatically picking the darkened far-side twin."""
    key = name + ".far" if far else name
    return MAT[key]


# --------------------------------------------------------------------------
# Mesh construction
# --------------------------------------------------------------------------

def _finish(bm, name, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for mat in MAT_LIST:
        me.materials.append(mat)
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def ring_points(c, w, df, db, n=RN, squash=1.0):
    """One horizontal cross-section.

    c  = (x, y, z) centre
    w  = half-width across Y
    df = depth FORWARD  (+X)  -- make this larger than db for a convex chest
    db = depth BACKWARD (-X)  -- make this smaller for a flat back
    """
    pts = []
    for i in range(n):
        t = 2.0 * math.pi * i / n
        ct, st = math.cos(t), math.sin(t)
        d = df if ct >= 0.0 else db
        # squash < 1 flattens the profile into a slab (used for plates)
        pts.append((c[0] + d * ct, c[1] + w * st * squash, c[2]))
    return pts


def loft(name, rings, bands, n=RN, cap0=True, cap1=True, smooth=True):
    """Bridge a stack of cross-sections into a closed tube.

    rings = [dict(c=(x,y,z), w=, df=, db=), ...] bottom to top
    bands = material index per gap between rings (len == len(rings) - 1)
    """
    bm = bmesh.new()
    ringv = []
    for r in rings:
        pts = ring_points(r["c"], r["w"], r["df"], r["db"], n,
                          r.get("squash", 1.0))
        ringv.append([bm.verts.new(p) for p in pts])

    for k in range(len(rings) - 1):
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new((ringv[k][i], ringv[k][j],
                              ringv[k + 1][j], ringv[k + 1][i]))
            f.material_index = bands[k]

    if cap0:
        bm.faces.new(ringv[0]).material_index = bands[0]
    if cap1:
        bm.faces.new(ringv[-1]).material_index = bands[-1]

    return _finish(bm, name, smooth)


def loft_arc(name, rings, bands, t0, t1, n=RN, smooth=True):
    """Open shell version of loft() -- an arc of each cross-section only.

    Used for the open jacket: it wraps the back and sides and stops short of
    the chest so the bare torso shows through, exactly like the render.
    """
    bm = bmesh.new()
    ringv = []
    for r in rings:
        pts = []
        for i in range(n):
            t = t0 + (t1 - t0) * i / (n - 1)
            ct, st = math.cos(t), math.sin(t)
            d = r["df"] if ct >= 0.0 else r["db"]
            pts.append((r["c"][0] + d * ct, r["c"][1] + r["w"] * st,
                        r["c"][2]))
        ringv.append([bm.verts.new(p) for p in pts])

    for k in range(len(rings) - 1):
        for i in range(n - 1):
            f = bm.faces.new((ringv[k][i], ringv[k][i + 1],
                              ringv[k + 1][i + 1], ringv[k + 1][i]))
            f.material_index = bands[k]

    return _finish(bm, name, smooth)


def taper(name, p0, p1, profile, mat, n=RN, bulge_f=1.0, smooth=True):
    """A limb: sheared loft from p0 to p1.

    profile = [(t, radius), ...] with t running 0 -> 1 along the segment.
    bulge_f scales the FORWARD depth so limbs can read convex-front.
    Rings stay horizontal, which is fine for the near-vertical limbs here and
    keeps the topology dead simple.
    """
    a, b = Vector(p0), Vector(p1)
    rings, bands = [], []
    for t, r in profile:
        c = a.lerp(b, t)
        rings.append({"c": (c.x, c.y, c.z), "w": r,
                      "df": r * bulge_f, "db": r})
    mats = mat if isinstance(mat, list) else [mat] * (len(profile) - 1)
    bands = mats
    return loft(name, rings, bands, n=n, smooth=smooth)


def ball(name, center, radius, mat, scale=(1, 1, 1), segments=16, rings=10,
         rot=(0, 0, 0)):
    from mathutils import Euler
    e = Euler((math.radians(rot[0]), math.radians(rot[1]),
               math.radians(rot[2])), "XYZ").to_matrix()
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings,
                              radius=radius)
    for v in bm.verts:
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
        v.co = e @ v.co
        v.co.x += center[0]
        v.co.y += center[1]
        v.co.z += center[2]
    for f in bm.faces:
        f.material_index = mat
    return _finish(bm, name)


def box(name, center, size, mat, rot=(0, 0, 0), smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    from mathutils import Euler
    e = Euler((math.radians(rot[0]), math.radians(rot[1]),
               math.radians(rot[2])), "XYZ").to_matrix()
    for v in bm.verts:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
        v.co = e @ v.co
        v.co.x += center[0]
        v.co.y += center[1]
        v.co.z += center[2]
    for f in bm.faces:
        f.material_index = mat
    return _finish(bm, name, smooth)


def hand(name, center, mat, size=0.072, curl=0.65, rot=(0, 0, 0),
         thumb_side=1.0):
    """A stylized hand: a palm block + four two-segment fingers + a thumb.

    A bare sphere reads as a claymation ball at sprite scale -- this gives
    the silhouette actual fingers instead. Local +X (before `rot`) is the
    direction the fingers point. `curl` bends the fingertip segment toward
    local -Z: 0.0 is a flat open hand, ~1.0 folds it into a fist. Put the
    thumb on the character's LEADING side (thumb_side = NEAR or FAR) per the
    facing rule -- it is the forward-cue that keeps the hand from reading
    backwards.
    """
    from mathutils import Euler
    bm = bmesh.new()

    def add_block(lcenter, lsize, extra_rot=(0, 0, 0)):
        rr = (rot[0] + extra_rot[0], rot[1] + extra_rot[1],
              rot[2] + extra_rot[2])
        m = Euler((math.radians(rr[0]), math.radians(rr[1]),
                   math.radians(rr[2])), "XYZ").to_matrix()
        res = bmesh.ops.create_cube(bm, size=1.0)
        for v in res["verts"]:
            v.co.x *= lsize[0]
            v.co.y *= lsize[1]
            v.co.z *= lsize[2]
            v.co = m @ v.co
            v.co.x += center[0] + lcenter[0]
            v.co.y += center[1] + lcenter[1]
            v.co.z += center[2] + lcenter[2]

    # palm: a flattened paddle, fingers attach along its forward (+X) edge
    add_block((size * 0.30, 0.0, 0.0), (size * 0.58, size * 0.86, size * 0.40))

    n = 4
    spread = size * 0.70
    bend = curl * 78.0
    for i in range(n):
        fy = (i - (n - 1) / 2.0) * (spread / (n - 1))
        knuckle_x = size * 0.56
        seg = size * 0.30
        # first knuckle segment stays straight out from the palm
        add_block((knuckle_x + seg * 0.5, fy, 0.0),
                  (seg, size * 0.135, size * 0.155))
        # second segment folds toward -Z by `curl`, pivoting at the knuckle
        tip_x = knuckle_x + seg + seg * 0.45 * math.cos(math.radians(bend))
        tip_z = -seg * 0.45 * math.sin(math.radians(bend))
        add_block((tip_x, fy, tip_z), (seg * 0.85, size * 0.125, size * 0.145),
                  extra_rot=(0, bend, 0))

    # thumb: shorter, thicker, angled out to the leading side and forward
    add_block((size * 0.26, thumb_side * size * 0.44, -size * 0.04),
              (size * 0.28, size * 0.165, size * 0.19),
              extra_rot=(0, -24.0 * thumb_side, 0))

    for f in bm.faces:
        f.material_index = mat
    return _finish(bm, name, smooth=True)


def eye(name, center, mats, y_sign=-1.0, size=0.052, rot=(0, 0, 0)):
    """A layered anime eye: sclera + iris + pupil + a bright highlight dot.

    A single flat-colored ball reads as a featureless smudge at sprite
    scale (Hydra's original problem) -- stacking four small layers along the
    eye's own forward axis gives it a real pupil and a catchlight instead.
    mats = {'sclera':, 'iris':, 'pupil':, 'highlight':} material slot
    indices. y_sign = NEAR (-1) or FAR (+1), used only to mirror the
    highlight's small offset toward the character's front.
    """
    cx, cy, cz = center
    objs = [ball(name + "_sclera", center, size, mats["sclera"],
                scale=(0.85, 0.62, 0.50), rot=rot)]
    objs.append(ball(name + "_iris", (cx + size * 0.55, cy, cz), size * 0.60,
                     mats["iris"], scale=(0.50, 0.90, 0.90), rot=rot))
    objs.append(ball(name + "_pupil", (cx + size * 0.72, cy, cz), size * 0.28,
                     mats["pupil"], scale=(0.55, 0.85, 0.85), rot=rot))
    objs.append(ball(name + "_hi",
                     (cx + size * 0.80, cy - y_sign * size * 0.16,
                      cz + size * 0.24),
                     size * 0.14, mats["highlight"]))
    return objs


def spike(name, base, direction, length, base_r, mat_lo, mat_hi,
          curve=(0, 0, 0), n=8, steps=7, tip_frac=0.42, flare=1.0):
    """A hair spike: tapered, gently curved, tip uses a second material.

    flare > 1 keeps the spike fat for longer before it tapers, which is what
    makes it read as a flame lick rather than a punk needle.
    """
    d = Vector(direction).normalized()
    c = Vector(curve)
    bm = bmesh.new()
    ringv = []
    for s in range(steps + 1):
        t = s / steps
        r = base_r * (1.0 - t ** flare) ** 0.85
        r = max(r, 0.0016)
        p = Vector(base) + d * (length * t) + c * (t * t)
        # ring plane roughly perpendicular to d
        up = Vector((0, 0, 1))
        if abs(d.dot(up)) > 0.95:
            up = Vector((1, 0, 0))
        e1 = d.cross(up).normalized()
        e2 = d.cross(e1).normalized()
        pts = []
        for i in range(n):
            a = 2.0 * math.pi * i / n
            pts.append(p + e1 * (r * math.cos(a)) + e2 * (r * math.sin(a)))
        ringv.append([bm.verts.new(tuple(q)) for q in pts])

    tip_start = int(round(steps * (1.0 - tip_frac)))
    for k in range(steps):
        m = mat_hi if k >= tip_start else mat_lo
        for i in range(n):
            j = (i + 1) % n
            f = bm.faces.new((ringv[k][i], ringv[k][j],
                              ringv[k + 1][j], ringv[k + 1][i]))
            f.material_index = m
    bm.faces.new(ringv[0]).material_index = mat_lo
    bm.faces.new(ringv[-1]).material_index = mat_hi
    return _finish(bm, name)


# --------------------------------------------------------------------------
# Rigging
# --------------------------------------------------------------------------

SAG_AXIS = Vector((0.0, -1.0, 0.0))  # world -Y == every bone's local X


def dist_point_segment(p, a, b):
    ab = b - a
    denom = ab.dot(ab)
    if denom < 1e-12:
        return (p - a).length
    t = max(0.0, min(1.0, (p - a).dot(ab) / denom))
    return (p - (a + ab * t)).length


def weight_to_bones(ob, arm, bone_names, power=3.5, max_influences=3):
    """Geometric skinning: weight by inverse distance to a whitelist of bones.

    Bone-heat weighting is fragile on procedurally overlapping primitives, and
    an unrestricted distance falloff bleeds across the body (a hand near the
    hip picks up thigh weight). Restricting each part to the bones that could
    plausibly drive it removes both problems.
    """
    segs = []
    for name in bone_names:
        bone = arm.data.bones[name]
        segs.append((name, Vector(bone.head_local), Vector(bone.tail_local)))
        if name not in ob.vertex_groups:
            ob.vertex_groups.new(name=name)

    for v in ob.data.vertices:
        p = Vector(v.co)
        ds = sorted(((dist_point_segment(p, h, t), nm) for nm, h, t in segs),
                    key=lambda x: x[0])[:max_influences]
        raw = [(1.0 / (d ** power + 1e-5), nm) for d, nm in ds]
        total = sum(w for w, _ in raw)
        for w, nm in raw:
            ob.vertex_groups[nm].add([v.index], w / total, "REPLACE")

    mod = ob.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm
    ob.parent = arm


def add_subsurf(ob, levels=1, render_levels=2):
    mod = ob.modifiers.new(name="Subdivision", type="SUBSURF")
    mod.levels = levels
    mod.render_levels = render_levels
    # keep the modifier last so skinning happens first
    return mod


# --------------------------------------------------------------------------
# Animation
# --------------------------------------------------------------------------

def action_fcurves(action, slot=None):
    """Blender 5.x layered actions: fcurves live inside a channelbag."""
    layer = action.layers[0]
    strip = layer.strips[0]
    if slot is None:
        slot = action.slots[0]
    return strip.channelbag(slot).fcurves


def set_interpolation(action, mode="BEZIER", easing="AUTO"):
    try:
        for fc in action_fcurves(action):
            for kp in fc.keyframe_points:
                kp.interpolation = mode
                kp.easing = easing
    except Exception:
        pass
