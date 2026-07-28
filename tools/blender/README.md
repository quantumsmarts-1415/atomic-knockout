# Blender character pipeline

3D model → rigged → animated → rendered to 2D sprite sheets for the Phaser
game. Nothing here runs at game time; it is an art-production step whose only
output the game cares about is `out/sheets/`.

Built and tested against **Blender 5.2.0 LTS** at
`C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`.

## Files

| File | What it is |
| --- | --- |
| `hydra_common.py` | Reusable helpers: cel-shading materials, mesh builders (loft / taper / ball / box / spike), geometric skinning, palette |
| `build_hydra.py` | Hydra's actual geometry, skeleton and animation clips. Writes `hydra.blend` |
| `render_hydra.py` | Renders previews and sprite sheets from `hydra.blend` |
| `hydra.blend` | The saved model — open this to inspect or hand-tweak |
| `out/` | Rendered previews |
| `out/sheets/` | Game-ready sprite sheets + `hydra_sheets.json` manifest |

## Commands

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python tools/blender/build_hydra.py
```

```bash
"/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b tools/blender/hydra.blend --python tools/blender/render_hydra.py -- --mode sheets --size 256 --yaw 12
```

Other `--mode` values: `turnaround`, `poses`, `strip --clip walk`.

Rendering costs roughly 6–8 seconds per frame (Freestyle outlines dominate),
so a full sheet pass of ~100 frames takes about 10 minutes.

## Conventions that matter

**Axes.** `+X` is the direction the character faces, `+Z` is up, feet at
`z = 0`. `-Y` is the character's right and the **near** side (camera side);
`+Y` is the character's left and the **far** side. The camera therefore sits
at `-Y`, which puts the character's forward on screen-right — matching the
game's "art faces right" convention.

**One rotation axis.** Every bone is rolled so its local X axis equals world
`-Y`. That makes `rotation_euler.x` the sagittal (side-view) swing for the
whole skeleton, and positive always swings a bone's tail **forward**. All
animation data is a single number per bone.

**Limb angles are absolute.** Values for `upperarm/forearm/hand` and
`thigh/shin/foot` in the clip data are absolute world angles (degrees forward
of straight down), not rotations relative to the parent. Torso values
(`hips/spine/chest/neck/head`) stay parent-relative. This matters: while the
limbs were parent-relative, a forward torso lean silently added itself to
every arm angle and the "straight punch" aimed at the ceiling.

**Skinning is geometric, not bone-heat.** `weight_to_bones()` weights each
vertex by inverse distance to a *whitelist* of bones. Bone-heat weighting is
unreliable on procedurally overlapping primitives, and an unrestricted
falloff bleeds weight across the body. The whitelist per part removes both
problems.

**Standard view transform, not AgX.** AgX is a filmic tonemap that desaturates
saturated emission; with it on, the first render came out as blue-grey mush.
Flat cel art needs the shader colours written out untouched. Emission
strengths stay at 1.0 for the same reason — anything above 1 just clips to
white.

**The facing rule** (from the vault doc, Session 2): forward direction lives
in the *silhouette*, never in decals. Applied here as a convex chest forward
with a flatter back, elbows that bow backward with hands ending forward,
boots with a forward toe box and a flush heel, and hair that sweeps up and
back.

## Adding another character

Copy `build_hydra.py`, keep `hydra_common.py` as-is, and change: the palette,
the ring tables (torso / head / boots), the hair or headgear, the joint
positions, and the `STANCE` block. The bone layout, skinning, animation
system and renderer are all character-agnostic — the clip definitions in
`CLIPS` can usually be reused verbatim and only need retiming for a
heavy character.
