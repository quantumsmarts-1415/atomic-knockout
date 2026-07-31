"""
Renders Helen from tools/blender/helen.blend.

  blender -b tools/blender/helen.blend --python tools/blender/render_helen.py \
      -- --mode turnaround --size 512
  blender -b ... -- --mode poses --size 512
  blender -b ... -- --mode sheets --size 256 --yaw 15

See render_hydra.py for the full mode docs -- this is the same renderer,
retargeted at Helen's rig/action names.
"""

import argparse
import json
import math
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)
from build_helen import aim_camera  # noqa: E402

OUT_ROOT = os.path.join(HERE, "out")


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--mode", default="turnaround")
    p.add_argument("--size", type=int, default=512)
    p.add_argument("--yaw", type=float, default=15.0)
    p.add_argument("--clip", default="idle")
    p.add_argument("--out", default=OUT_ROOT)
    return p.parse_args(argv)


def scene_setup(size, yaw):
    sc = bpy.context.scene
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    ls = sc.view_layers[0].freestyle_settings.linesets[0].linestyle
    ls.thickness = max(1.0, size / 320.0 * 1.5)
    aim_camera(bpy.data.objects["SideCam"], yaw_deg=yaw)
    return sc


def rig():
    return bpy.data.objects["HelenRig"]


def clips():
    out = {}
    for act in bpy.data.actions:
        if not act.name.startswith("helen_"):
            continue
        rng = act.frame_range
        out[act.name[len("helen_"):]] = {
            "action": act,
            "start": int(round(rng[0])),
            "end": int(round(rng[1])),
        }
    return out


def render_to(path, sc):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path if os.path.exists(path) else path + ".png"


def load_rgba(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return buf.reshape(h, w, 4)[::-1]  # Blender stores bottom-up


def save_rgba(arr, path):
    h, w, _ = arr.shape
    img = bpy.data.images.new("sheet", width=w, height=h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def compose(paths, cols, path):
    tiles = [load_rgba(p) for p in paths]
    th, tw, _ = tiles[0].shape
    rows = int(math.ceil(len(tiles) / cols))
    sheet = np.zeros((rows * th, cols * tw, 4), dtype=np.float32)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        sheet[r * th:(r + 1) * th, c * tw:(c + 1) * tw] = t
    save_rgba(sheet, path)
    return {"cols": cols, "rows": rows, "frameW": tw, "frameH": th,
            "count": len(tiles)}


# --------------------------------------------------------------------------

def mode_turnaround(a):
    sc = scene_setup(a.size, a.yaw)
    cam = bpy.data.objects["SideCam"]
    rig().animation_data.action = clips()["idle"]["action"]
    sc.frame_set(1)
    tmp = os.path.join(a.out, "_tmp")
    paths = []
    for yaw in (0, 15, 30, 55, 90, 180):
        aim_camera(cam, yaw_deg=yaw)
        paths.append(render_to(os.path.join(tmp, "turn_%03d.png" % yaw), sc))
    info = compose(paths, 6, os.path.join(a.out, "helen_turnaround.png"))
    print("OUT %s %s" % (os.path.join(a.out, "helen_turnaround.png"), info))


def mode_poses(a):
    sc = scene_setup(a.size, a.yaw)
    cs = clips()
    picks = [("idle", 1), ("walk", 5), ("walk", 13), ("jump", 3),
             ("jump", 6), ("fall", 1), ("attack", 6), ("special", 5),
             ("special", 9), ("hurt", 3), ("ko", 9)]
    tmp = os.path.join(a.out, "_tmp")
    paths = []
    for name, frame in picks:
        rig().animation_data.action = cs[name]["action"]
        sc.frame_set(frame)
        paths.append(render_to(
            os.path.join(tmp, "pose_%s_%02d.png" % (name, frame)), sc))
    info = compose(paths, 6, os.path.join(a.out, "helen_poses.png"))
    print("OUT %s %s" % (os.path.join(a.out, "helen_poses.png"), info))


def mode_strip(a):
    sc = scene_setup(a.size, a.yaw)
    cs = clips()
    c = cs[a.clip]
    rig().animation_data.action = c["action"]
    tmp = os.path.join(a.out, "_tmp")
    paths = []
    for f in range(c["start"], c["end"] + 1):
        sc.frame_set(f)
        paths.append(render_to(
            os.path.join(tmp, "%s_%03d.png" % (a.clip, f)), sc))
    cols = min(len(paths), 8)
    out = os.path.join(a.out, "helen_%s_strip.png" % a.clip)
    info = compose(paths, cols, out)
    print("OUT %s %s" % (out, info))


CLIP_STEP = {
    "idle": 2, "walk": 1, "jump": 1, "fall": 2,
    "attack": 1, "special": 1, "hurt": 1, "ko": 1,
}


def mode_sheets(a):
    sc = scene_setup(a.size, a.yaw)
    cs = clips()
    tmp = os.path.join(a.out, "_tmp")
    mpath = os.path.join(a.out, "sheets", "helen_sheets.json")

    only = None if a.clip in ("all", "") else a.clip
    manifest = {"yaw": a.yaw, "frameW": a.size, "frameH": a.size,
                "fps": 12, "clips": {}}
    if only and os.path.exists(mpath):
        with open(mpath) as fh:
            manifest = json.load(fh)

    for name, c in sorted(cs.items()):
        if only and name != only:
            continue
        rig().animation_data.action = c["action"]
        step = CLIP_STEP.get(name, 1)
        end = c["end"] - 1 if name in ("idle", "walk", "fall") else c["end"]
        frames = list(range(c["start"], end + 1, step))
        paths = []
        for f in frames:
            sc.frame_set(f)
            paths.append(render_to(
                os.path.join(tmp, "sheet_%s_%03d.png" % (name, f)), sc))
        cols = min(len(paths), 8)
        out = os.path.join(a.out, "sheets", "helen_%s.png" % name)
        info = compose(paths, cols, out)
        info["loop"] = name in ("idle", "walk", "fall")
        manifest["clips"][name] = info
        print("SHEET %s %s" % (out, info))
    with open(mpath, "w") as fh:
        json.dump(manifest, fh, indent=2)
    print("OUT %s" % mpath)


MODES = {"turnaround": mode_turnaround, "poses": mode_poses,
         "strip": mode_strip, "sheets": mode_sheets}


def main():
    a = parse_args()
    os.makedirs(a.out, exist_ok=True)
    MODES[a.mode](a)


if __name__ == "__main__":
    main()
