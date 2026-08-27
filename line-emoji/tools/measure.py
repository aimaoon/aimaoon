"""Empirical measurement of the rendered frames.

Nothing here trusts a declaration in the item table: part groups are rendered
in isolation and compared pixel-for-pixel, so "this part is fixed" is a
measured fact rather than an assertion.
"""
import math
import numpy as np
from PIL import Image
import rig
import render
from rig import P

GROUPS = {
    'head': {'hair_back', 'face', 'hair_front', 'glasses', 'face_parts'},
    'torso': {'torso'},
    'legs': {'legs'},
    'armL': {'armL'},
    'armR': {'armR'},
}


def alpha(im):
    return np.asarray(im.split()[-1], dtype=np.uint8)


def bbox(im, thr=8):
    a = alpha(im)
    ys, xs = np.nonzero(a > thr)
    if len(xs) == 0:
        return None
    return (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)


def centroid(im, thr=8):
    a = alpha(im).astype(np.float64)
    a[a <= thr] = 0.0
    t = a.sum()
    if t <= 0:
        return None
    ys, xs = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    return (float((xs * a).sum() / t), float((ys * a).sum() / t))


def safe_margins(im):
    b = bbox(im)
    if b is None:
        return None
    w, h = im.size
    return (b[0], b[1], w - b[2], h - b[3])          # left, top, right, bottom


CORE = {'hair_back', 'face', 'hair_front', 'glasses', 'face_parts', 'torso', 'legs'}


def char_only(pose, size=180):
    """The character body alone -- props and effects excluded by construction."""
    return render.render_stage(pose, size=size)


def core_only(pose, size=180):
    """Head, torso and legs without the arms.

    Apparent character size is what the scale lock is protecting; an arm
    reaching sideways widens the bounding box without the character being
    drawn any larger, so the arms are measured separately.
    """
    return render.render_stage(pose, parts=CORE, size=size)


def group_render(pose, group, size=180):
    return render.render_stage(pose, parts=GROUPS[group], size=size)


def group_identical(poses, group):
    """Max per-pixel difference of one part group across the timeline."""
    ref = np.asarray(group_render(poses[0], group), dtype=np.int16)
    worst = 0
    for p in poses[1:]:
        cur = np.asarray(group_render(p, group), dtype=np.int16)
        worst = max(worst, int(np.abs(cur - ref).max()))
        if worst > 0:
            break
    return worst


def group_centroid_range(poses, group):
    cs = [centroid(group_render(p, group)) for p in poses]
    cs = [c for c in cs if c]
    if not cs:
        return 0.0, 0.0
    xs = [c[0] for c in cs]
    ys = [c[1] for c in cs]
    return (max(xs) - min(xs), max(ys) - min(ys))


def anchor_x(pose):
    """World x of the mid-foot anchor, computed from the pose transform."""
    body, _, _ = rig.matrices(pose)
    return rig.apply(body, (90.0, rig.FOOT_Y))[0]


def head_landmarks(pose):
    _, _, hm = rig.matrices(pose)
    pts = {
        'lens_l': (-rig.LENS_DX, rig.LENS_CY),
        'lens_r': (rig.LENS_DX, rig.LENS_CY),
        'chin': (0.0, rig.FACE_CY + rig.FACE_RY),
        'crown': (0.0, -46.0),
        'flick_tip': (-45.0, 41.0),
        'clip': (22.0, -24.0),
    }
    return {k: rig.apply(hm, v) for k, v in pts.items()}


def hand_track(poses):
    out = []
    for p in poses:
        out.append((rig.hand_world(p, 0)[0], rig.hand_world(p, 1)[0]))
    return out


def max_travel(points):
    m = 0.0
    for i in range(len(points)):
        for j in range(i + 1, len(points)):
            m = max(m, math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]))
    return m


def part_displacements(poses):
    """Largest travel of each meaning-bearing landmark over the cycle."""
    hl = [h[0] for h in hand_track(poses)]
    hr = [h[1] for h in hand_track(poses)]
    lm = [head_landmarks(p) for p in poses]
    return {
        'hand_L': max_travel(hl),
        'hand_R': max_travel(hr),
        'head_crown': max_travel([l['crown'] for l in lm]),
        'chin': max_travel([l['chin'] for l in lm]),
        'lens_r': max_travel([l['lens_r'] for l in lm]),
    }


def frame_steps(frames):
    """Adjacent-frame centroid steps including the loop seam 19 -> 0."""
    cs = [centroid(f) for f in frames]
    steps = []
    for i in range(len(cs)):
        a, b = cs[i], cs[(i + 1) % len(cs)]
        if a is None or b is None:
            steps.append(0.0)
        else:
            steps.append(math.hypot(b[0] - a[0], b[1] - a[1]))
    return cs, steps


def unique_frames(frames):
    seen = set()
    for f in frames:
        seen.add(np.asarray(f).tobytes())
    return len(seen)


def min_adjacent_change(frames):
    """Smallest pixel-change between neighbouring frames, to catch padding."""
    worst = None
    arrs = [np.asarray(f, dtype=np.int16) for f in frames]
    for i in range(len(arrs)):
        d = np.abs(arrs[i] - arrs[(i + 1) % len(arrs)])
        changed = int((d.max(axis=2) > 6).sum())
        worst = changed if worst is None else min(worst, changed)
    return worst
