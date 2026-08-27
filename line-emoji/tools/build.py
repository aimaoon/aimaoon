# -*- coding: utf-8 -*-
"""Render the 40 emoji, run every gate, and write the delivery folder."""
import csv
import json
import math
import os
import shutil
import sys
import numpy as np
from PIL import Image

import rig
import render
import anim
import measure
import preview
import apnginfo
from rig import P

import items_a
import items_b
import items_c
import items_d

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'LINE_READY')
POSES = os.path.join(ROOT, 'poses')
REPORTS = os.path.join(ROOT, 'reports')
PREVIEWS = os.path.join(ROOT, 'previews')

ITEMS = items_a.ITEMS + items_b.ITEMS + items_c.ITEMS + items_d.ITEMS
assert len(ITEMS) == 40 and [x['n'] for x in ITEMS] == list(range(1, 41))

TARGET_BYTES = 285000
HARD_LIMIT = 300000
SAFE_PX = 8

POSE_ROLES = ['P1-first', 'P2-anticipation', 'P3-transit', 'P4-peak',
              'P5-recoil', 'P6-return']
SYMBOL_ROLES = ['S1-complete', 'S2-release', 'S3-apart', 'S4-rebuild', 'S5-impact']
SYMBOL_FRAMES = [0, 4, 7, 10, 12]


def clean_rgb(im):
    """Zero the RGB of fully transparent pixels so they compress flat."""
    a = np.array(im)
    a[a[:, :, 3] == 0] = (0, 0, 0, 0)
    return Image.fromarray(a, 'RGBA')


def build_one(it):
    n = it['n']
    frames, tl = anim.render_frames(it)
    frames = [clean_rgb(f) for f in frames]
    durs = anim.durations(it['beat'])
    path = os.path.join(OUT, '%03d.png' % n)
    anim.save_apng(frames, durs, path, loop=1)
    return frames, tl, durs, path


def save_poses(it, frames, tl):
    n = it['n']
    d = os.path.join(POSES, '%03d' % n)
    os.makedirs(d, exist_ok=True)
    rows = []
    if tl is None:                                    # symbol
        for k, fi in enumerate(SYMBOL_FRAMES):
            frames[fi].save(os.path.join(d, SYMBOL_ROLES[k] + '.png'))
            rows.append((SYMBOL_ROLES[k], fi))
        return rows
    for k, p in enumerate(it['poses']):
        ex = (lambda c, _p=p, _k=k: it['fx'](c, _p, it['stops'][_k])) if it.get('fx') else None
        im = clean_rgb(render.render_stage(p, extras=ex))
        im.save(os.path.join(d, POSE_ROLES[k] + '.png'))
        rows.append((POSE_ROLES[k], it['stops'][k]))
    return rows


def pose_diff_axes(a, b):
    """Which authored axes actually differ between two poses."""
    axes = []
    if a['armL_t'] != b['armL_t'] or a['armR_t'] != b['armR_t']:
        axes.append('関節角度')
    if (rig.hand_world(a, 0)[0] != rig.hand_world(b, 0)[0] or
            rig.hand_world(a, 1)[0] != rig.hand_world(b, 1)[0]):
        axes.append('手足の接続位置')
    if a['legL'] != b['legL'] or a['legR'] != b['legR'] or a['footL'] != b['footL'] \
            or a['footR'] != b['footR'] or a['hip_dy'] != b['hip_dy']:
        axes.append('足の接地状態')
    if a['head_rot'] != b['head_rot'] or a['head_off'] != b['head_off'] \
            or a['lean'] != b['lean']:
        axes.append('頭と胴体の相対位置')
    if a['face'] != b['face']:
        axes.append('顔パーツ')
    if a['handL'] != b['handL'] or a['handR'] != b['handR'] \
            or a['handL_s'] != b['handR_s'] or a['glasses_off'] != b['glasses_off']:
        axes.append('小物との接触・隠れ')
    if a['dress_flare'] != b['dress_flare'] or a['sx'] != b['sx'] or a['sy'] != b['sy'] \
            or a['shoulder_dy'] != b['shoulder_dy'] or a['root'] != b['root']:
        axes.append('外形シルエット')
    return axes


def harmonize_arms(item):
    """Pin one elbow orientation per arm and switch that arm to hand targets.

    The solver picks whichever elbow sits furthest from the body, which is
    right for a single pose but flips as the hand crosses shoulder height --
    and a flip swings the forearm through a wild arc between keyframes.
    Pinning the orientation and tweening the hand position instead of the
    joint angles removes both that flip and the long-way-round sweeps that
    equivalent angles a full turn apart would otherwise cause.  Every hand
    stays exactly where it was authored.
    """
    if item.get('poses') is None:
        return
    for side, key in ((0, 'armL'), (1, 'armR')):
        signs = [1 if p[key][1] >= 0 else -1 for p in item['poses']]
        elbow = -1 if sum(signs) >= 0 else 1
        for p in item['poses']:
            p[key + '_t'] = rig.hand_target_local(p, side)
            p[key + '_elbow'] = elbow


for _it in ITEMS:
    harmonize_arms(_it)


def main():
    for d in (OUT, POSES):
        shutil.rmtree(d, ignore_errors=True)
    for d in (OUT, POSES, REPORTS, os.path.join(REPORTS, 'jitter'), PREVIEWS):
        os.makedirs(d, exist_ok=True)

    data = []
    for it in ITEMS:
        frames, tl, durs, path = build_one(it)
        poses_rows = save_poses(it, frames, tl)
        info = apnginfo.summary(path)

        # ---- geometry
        if tl is not None:
            char = [measure.char_only(p) for p in tl]
            cb = measure.bbox(char[0])
            disp = measure.part_displacements(tl)
            axr = [measure.anchor_x(p) for p in tl]
            anchor_range = max(axr) - min(axr)
            anchor_step = max(abs(axr[(i + 1) % len(axr)] - axr[i]) for i in range(len(axr)))
            groups = {g: measure.group_identical(tl, g) for g in measure.GROUPS}
            fixed_groups = [g for g, v in groups.items() if v == 0]
            moving_groups = [g for g, v in groups.items() if v != 0]
            legs_cx = measure.group_centroid_range(tl, 'legs')[0]
        else:
            char, cb, disp = None, None, {}
            anchor_range = anchor_step = 0.0
            groups, fixed_groups, moving_groups, legs_cx = {}, [], [], 0.0

        margins = [measure.safe_margins(f) for f in frames]
        usable = [m for m in margins if m]
        min_margin = min(min(m) for m in usable) if usable else -1
        cs, steps = measure.frame_steps(frames)
        med = sorted(steps)[len(steps) // 2]
        peak_step = max(steps)
        seam = steps[-1]
        uniq = measure.unique_frames(frames)
        minchg = measure.min_adjacent_change(frames)
        by = os.path.getsize(path)

        data.append(dict(item=it, frames=frames, tl=tl, durs=durs, path=path,
                         info=info, cb=cb, disp=disp, anchor_range=anchor_range,
                         anchor_step=anchor_step, groups=groups,
                         fixed_groups=fixed_groups, moving_groups=moving_groups,
                         legs_cx=legs_cx, margins=margins, min_margin=min_margin,
                         steps=steps, med=med, peak_step=peak_step, seam=seam,
                         uniq=uniq, minchg=minchg, bytes=by, poses_rows=poses_rows))
        print('%03d %-14s %6d B  frames=%2d uniq=%2d safe=%4.1f anchor=%.2f' %
              (it['n'], it['ja'], by, len(frames), uniq, min_margin, anchor_range))
    return data


if __name__ == '__main__':
    d = main()
    import pickle
    with open(os.path.join(ROOT, 'build', 'data.pkl'), 'wb') as f:
        pickle.dump([{k: v for k, v in x.items() if k not in ('frames', 'item', 'tl')}
                     for x in d], f)
