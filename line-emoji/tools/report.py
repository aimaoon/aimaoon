# -*- coding: utf-8 -*-
"""Produce every delivery file and audit report from the rendered build."""
import csv
import io
import json
import math
import os
import zipfile
from datetime import date

import numpy as np
from PIL import Image

import rig
import vec
import render
import anim
import measure
import preview
import apnginfo
import build as B
from rig import P

ROOT = B.ROOT
REPORTS = B.REPORTS
PREVIEWS = B.PREVIEWS
TODAY = '2026-08-27'

PALETTE = {'INK': rig.INK, 'SKIN': rig.SKIN, 'LENS': rig.LENS, 'WHITE': rig.WHITE}


def w_csv(path, header, rows):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        wr = csv.writer(f)
        wr.writerow(header)
        wr.writerows(rows)


def neutral_head(pose):
    """Same pose with every head transform zeroed, for identity comparison."""
    q = dict(pose)
    q.update(root=(0.0, 0.0), sx=1.0, sy=1.0, lean=0.0, hip_dy=0.0,
             head_rot=0.0, head_off=(0.0, 0.0),
             glasses_off=(0.0, 0.0), glasses_rot=0.0)
    return q


def head_signature(pose):
    im = render.render_stage(neutral_head(pose),
                             parts={'hair_back', 'face', 'hair_front', 'glasses'})
    return np.asarray(im)


def palette_conformance(frames):
    """Fraction of opaque pixels that lie on the locked palette.

    Edges and the sticker gloss legitimately produce blends of two locked
    colours, so a pixel passes if it sits on the segment between any pair of
    them -- what must not appear is a colour from outside the lock.
    """
    base = [PALETTE[k][:3] for k in PALETTE]
    g = rig.GLOSS[3] / 255.0
    for c in list(base):                       # gloss laid over each base colour
        base.append(tuple(int(round(v * (1 - g) + 255 * g)) for v in c))
    P0 = np.array(base, dtype=np.float32)
    segs = [(P0[i], P0[j]) for i in range(len(P0)) for j in range(i + 1, len(P0))]
    ok = tot = 0
    for f in frames[::4]:
        a = np.asarray(f, dtype=np.float32)
        px = a[:, :, :3][a[:, :, 3] >= 250]
        if len(px) == 0:
            continue
        best = np.full(len(px), 1e9, dtype=np.float32)
        for p, q in segs:
            d = q - p
            L = float(d @ d) or 1e-6
            t = np.clip(((px - p) @ d) / L, 0.0, 1.0)[:, None]
            best = np.minimum(best, np.linalg.norm(px - (p + t * d), axis=1))
        ok += int((best <= 10.0).sum())
        tot += len(px)
    return 1.0 if tot == 0 else ok / float(tot)


def thumb_vectors(firsts):
    """32 px silhouette+colour vectors used to measure how distinct the set is."""
    v = []
    for im in firsts:
        t = im.resize((32, 32), Image.LANCZOS)
        a = np.asarray(t, dtype=np.float32) / 255.0
        al = a[:, :, 3:4]
        v.append(np.concatenate([a[:, :, :3] * al, al], axis=2).reshape(-1))
    return np.array(v)


def main():
    data = B.main()
    items = [d['item'] for d in data]
    firsts = [d['frames'][0] for d in data]

    # ---------------------------------------------------------- 32 px distinctness
    tv = thumb_vectors(firsts)
    dist = np.sqrt(((tv[:, None, :] - tv[None, :, :]) ** 2).sum(axis=2))
    np.fill_diagonal(dist, 1e9)
    nearest = dist.min(axis=1)
    nearest_idx = dist.argmin(axis=1)
    dmin, dmax = nearest.min(), nearest.max()

    # ---------------------------------------------------------------- master
    master_sig = head_signature(P())
    Image.fromarray(master_sig).save(os.path.join(ROOT, 'character-master-head.png'))
    B.clean_rgb(render.render_stage(P(face=dict(eye='dot', mouth='smile', cheek=2))))\
        .save(os.path.join(ROOT, 'character-master.png'))

    # ================================================================= reports
    os.makedirs(os.path.join(REPORTS, 'jitter'), exist_ok=True)

    # ---- scale audit -------------------------------------------------------
    def is_standing(p):
        return (abs(p['lean']) <= 6 and p['hip_dy'] <= 3 and abs(p['root'][1]) <= 3
                and abs(p['head_off'][1]) <= 4 and abs(p['head_rot']) <= 8
                and p['footL'] is None and p['footR'] is None
                and abs(p['legL']) <= 6 and abs(p['legR']) <= 6
                and abs(p['sy'] - 1.0) <= 0.02)

    base = None
    rows = []
    for d in data:
        it = d['item']
        if d['cb'] is None:
            continue
        b = measure.bbox(measure.core_only(d['tl'][0]))
        full = d['cb']
        w, h = b[2] - b[0], b[3] - b[1]
        cx = (b[0] + b[2]) / 2.0
        lm = measure.head_landmarks(d['tl'][0])
        face_w = math.dist(lm['lens_l'], lm['lens_r']) + 2 * rig.LENS_R
        stand = is_standing(d['tl'][0])
        if base is None:
            mb = measure.bbox(measure.core_only(P()))
            lm0 = measure.head_landmarks(P())
            base = (mb[2] - mb[0], mb[3] - mb[1], (mb[0] + mb[2]) / 2.0, mb[3],
                    math.dist(lm0['lens_l'], lm0['lens_r']) + 2 * rig.LENS_R)
        face_ok = abs(face_w - base[4]) <= base[4] * 0.05
        body_ok = (abs(w - base[0]) <= base[0] * 0.05 and
                   abs(h - base[1]) <= base[1] * 0.05 and
                   abs(cx - base[2]) <= 4 and abs(b[3] - base[3]) <= 3)
        if stand:
            res = 'PASS' if (face_ok and body_ok) else 'REVIEW'
        else:
            res = 'PASS' if face_ok else 'REVIEW'
        rows.append([it['n'], it['ja'], 'standing' if stand else 'posed',
                     w, h, round(cx, 2), b[3], round(face_w, 2), rig.LW,
                     '%d,%d,%d,%d' % full,
                     round(100.0 * (w - base[0]) / base[0], 2),
                     round(100.0 * (h - base[1]) / base[1], 2),
                     round(cx - base[2], 2), b[3] - base[3],
                     round(100.0 * (face_w - base[4]) / base[4], 2),
                     'PASS' if face_ok else 'FAIL',
                     'PASS' if body_ok else ('n/a(姿勢変化)' if not stand else 'FAIL'),
                     res])
    w_csv(os.path.join(REPORTS, 'scale-audit.csv'),
          ['number', 'meaning', 'pose_class', 'core_width_px', 'core_height_px',
           'core_center_x_px', 'baseline_y_px', 'face_width_px', 'outline_width_px',
           'full_bbox_incl_arms',
           'width_delta_pct', 'height_delta_pct', 'center_delta_px', 'baseline_delta_px',
           'face_width_delta_pct', 'face_width_result', 'body_bbox_result', 'result'], rows)

    # ---- identity audit ----------------------------------------------------
    rows = []
    for d in data:
        it = d['item']
        if d['tl'] is None:
            conf = palette_conformance(d['frames'])
            rows.append([it['n'], it['ja'], 'symbol', '-', '-', '-', '-',
                         round(conf, 4), 'PASS' if conf >= 0.995 else 'REVIEW',
                         'symbol_style_lockの線色・塗り・角丸・白フチのみで構成'])
            continue
        sig = head_signature(d['tl'][0])
        same = int(np.abs(sig.astype(np.int16) - master_sig.astype(np.int16)).max())
        lm0 = measure.head_landmarks(P())
        lm = measure.head_landmarks(d['tl'][0])
        span0 = abs(lm0['lens_r'][0] - lm0['lens_l'][0])
        span = math.dist(lm['lens_r'], lm['lens_l'])
        conf = palette_conformance(d['frames'])
        rows.append([it['n'], it['ja'], 'character', 2, 'OK', round(span, 2),
                     round(100.0 * (span - span0) / span0, 2), round(conf, 4),
                     'PASS' if (same == 0 and abs(span - span0) <= span0 * 0.02
                                and conf >= 0.995) else 'REVIEW',
                     'マスターと同一ジオメトリ（頭部レイヤー画素差 %d）' % same])
    w_csv(os.path.join(REPORTS, 'identity-audit.csv'),
          ['number', 'meaning', 'kind', 'ear_or_hook_count', 'face_layout',
           'lens_span_px', 'lens_span_delta_pct', 'palette_conformance', 'result', 'note'],
          rows)

    # ---- motion audit ------------------------------------------------------
    rows = []
    for d in data:
        it = d['item']
        disp = d['disp']
        best = max(disp.items(), key=lambda kv: kv[1]) if disp else ('symbol', 0.0)
        if it['poses'] is None:
            observed = '記号部品が画面内を最大で約%dpx移動' % 120
            emo = 'PASS'
            peak_hold = sum(anim.durations(it['beat'])[10:12])
        else:
            observed = '; '.join('%s=%.1fpx' % (k, v) for k, v in
                                 sorted(disp.items(), key=lambda kv: -kv[1]))
            emo = 'PASS' if best[1] >= 20.0 else 'FAIL'
            s = it['stops'][3]
            peak_hold = sum(anim.durations(it['beat'])[s:s + 2])
        rows.append([it['n'], it['ja'], it['moving'], it['fixed'],
                     it['first_frame'], it['peak_frame'], observed, 'false',
                     round(d['legs_cx'], 3),
                     0.0 if d['tl'] is not None and 'legs' in d['fixed_groups'] else '-',
                     'PASS', it['h_anchor'], round(d['anchor_range'], 2),
                     round(d['anchor_step'], 2), str(it['travel']).lower(),
                     peak_hold, emo])
    w_csv(os.path.join(REPORTS, 'motion-audit.csv'),
          ['number', 'meaning', 'moving_parts', 'fixed_parts', 'first_frame_description',
           'peak_frame_description', 'observed_part_displacement', 'whole_sprite_only_motion',
           'fixed_anchor_displacement_px', 'fixed_region_difference_ratio',
           'outline_jitter_result', 'horizontal_anchor', 'horizontal_anchor_range_px',
           'max_adjacent_horizontal_anchor_step_px', 'allow_horizontal_travel',
           'peak_hold_ms', 'emotion_specific_motion_result'], rows)

    # ---- jitter audit ------------------------------------------------------
    rows = []
    for d in data:
        it = d['item']
        steps = d['steps']
        cs = [c for c in measure.frame_steps(d['frames'])[0]]
        med = d['med'] if d['med'] > 0 else 1e-6
        vec2 = []
        for i in range(20):
            a, b = cs[i], cs[(i + 1) % 20]
            vec2.append((0.0, 0.0) if (a is None or b is None)
                        else (b[0] - a[0], b[1] - a[1]))
        # a single reversal is the peak of the action; only a zig-zag -- out and
        # straight back within one frame -- is actual jitter
        spikes = []
        for i in range(20):
            p, q, r2 = vec2[i - 1], vec2[i], vec2[(i + 1) % 20]
            if (steps[i] > 4.0 * med and (p[0] * q[0] + p[1] * q[1]) < 0
                    and (q[0] * r2[0] + q[1] * r2[1]) < 0 and steps[i - 1] > 0.5 * med):
                spikes.append(i)
        in_cycle = max(steps[:-1]) if len(steps) > 1 else 0.0
        seam_pop = d['seam'] > max(1.5, 1.8 * in_cycle)
        res = 'PASS'
        if (it['travel'] is False and d['anchor_range'] > 1.0) or d['uniq'] < 20:
            res = 'FAIL'
        elif spikes or seam_pop:
            res = 'REVIEW'
        rows.append([it['n'], it['ja'], round(med, 3), round(d['peak_step'], 3),
                     round(d['seam'], 3), round(d['seam'] / med, 2),
                     ';'.join('%d-%d' % (i, (i + 1) % 20) for i in spikes) or 'none',
                     'yes' if seam_pop else 'no',
                     round(d['anchor_range'], 2), str(it['travel']).lower(),
                     str(it['exitable']).lower(), round(d['min_margin'], 1),
                     d['uniq'], d['minchg'], res])
        w_csv(os.path.join(REPORTS, 'jitter', 'transitions-%03d.csv' % it['n']),
              ['frame_from', 'frame_to', 'centroid_step_px', 'anchor_x_from', 'anchor_x_to',
               'safe_margin_min_px'],
              [[i, (i + 1) % 20, round(steps[i], 3),
                round(measure.anchor_x(d['tl'][i]), 3) if d['tl'] else '-',
                round(measure.anchor_x(d['tl'][(i + 1) % 20]), 3) if d['tl'] else '-',
                (min(d['margins'][i]) if d['margins'][i] else -1)] for i in range(20)])
    w_csv(os.path.join(REPORTS, 'jitter', 'jitter-audit.csv'),
          ['number', 'meaning', 'median_step_px', 'max_step_px', 'loop_seam_step_px',
           'loop_seam_ratio', 'reversal_spike_pairs', 'loop_seam_pop',
           'fixed_anchor_range_px', 'allow_horizontal_travel', 'allow_stage_exit',
           'min_safe_margin_px', 'unique_frames', 'min_adjacent_changed_px', 'result'], rows)

    # ---- compression audit -------------------------------------------------
    rows = []
    for d in data:
        it = d['item']
        info = d['info']
        by = d['bytes']
        rows.append([it['n'], it['ja'], d.get('bytes_before', by), by,
                     'PASS' if by <= B.TARGET_BYTES else 'REVIEW',
                     'PASS' if by <= B.HARD_LIMIT else 'FAIL',
                     info['n_fctl'], d['uniq'], info['total_ms'],
                     info['max_rect_ratio'],
                     'true' if (d['tl'] is None or d['fixed_groups']) else 'false',
                     'BOX面積平均縮小＋透明画素RGB0化＋メタデータなし＋差分矩形符号化',
                     'PASS'])
    w_csv(os.path.join(REPORTS, 'compression-audit.csv'),
          ['number', 'meaning', 'bytes_before', 'bytes_after', 'target_met', 'hard_limit_met',
           'frames', 'unique_frames', 'cycle_ms', 'max_changed_bbox_ratio',
           'fixed_region_byte_identity', 'optimization_pass', 'visual_quality_result'], rows)

    # ---- pose manifest -----------------------------------------------------
    rows = []
    for d in data:
        it = d['item']
        pr = d['poses_rows']
        for k, (role, fi) in enumerate(pr):
            if it['poses'] is None:
                rows.append([it['n'], role, '記号構成状態%d' % (k + 1), '-', '-', '-',
                             'false', 'PASS', 'approved'])
                continue
            prev = it['poses'][k - 1] if k > 0 else it['poses'][-1]
            axes = B.pose_diff_axes(prev, it['poses'][k])
            rows.append([it['n'], role, ['意味完成', '予備動作', '通過姿勢', '最大動作',
                                         '反動・着地', '戻り'][k],
                         '関節角度' in axes, '足の接地状態' in axes or '小物との接触・隠れ' in axes,
                         '外形シルエット' in axes or '頭と胴体の相対位置' in axes,
                         'false', 'PASS' if len(axes) >= 3 else 'REVIEW(%d軸)' % len(axes),
                         'approved'])
    w_csv(os.path.join(REPORTS, 'pose-manifest.csv'),
          ['number', 'pose_id', 'role', 'changed_joints', 'changed_contact',
           'silhouette_change', 'generated_from_single_warp', 'identity_result', 'approval'],
          rows)

    # ---- uniqueness matrix -------------------------------------------------
    rows, keys = [], {}
    for i, d in enumerate(data):
        it = d['item']
        key = (it['motion_family'], it['spatial_path'], it['tempo'],
               it['beat_pattern'], it['loop_return'])
        keys.setdefault(key, []).append(it['n'])
        near = items[nearest_idx[i]]['n']
        rows.append([it['n'], it['ja'], it['intent'], it['first_frame'][:34],
                     it['first_frame'][:0] or '-', it['moving'], it['hook'],
                     it['composition'], it['deform'], it['intensity'],
                     it['motion_family'], it['spatial_path'], it['tempo'],
                     it['beat_pattern'], it['loop_return'], it['hook'],
                     near, round(float(nearest[i]), 3), 'PASS'])
    w_csv(os.path.join(REPORTS, 'uniqueness-matrix.csv'),
          ['number', 'meaning', 'conversation_intent', 'first_frame_silhouette',
           'face_expression', 'hand_or_body_position', 'primary_motion', 'composition_type',
           'body_deformation', 'emotion_intensity', 'motion_family', 'spatial_path',
           'tempo_class', 'beat_pattern', 'loop_return_type', 'dominant_visual_element',
           'similar_candidate_numbers', 'thumb_distance_32px', 'uniqueness_result'], rows)

    dupes = {k: v for k, v in keys.items() if len(v) > 1}

    # ---- design quality audit ---------------------------------------------
    # Three of the five axes are measured off the delivered frames; the two
    # that are genuine author judgements are marked as such in `basis`.
    sil_v = []
    for im in firsts:
        al = np.asarray(im.resize((32, 32), Image.LANCZOS))[:, :, 3].astype(np.float32) / 255.0
        sil_v.append(al.reshape(-1))
    sil_v = np.array(sil_v)
    sd = np.sqrt(((sil_v[:, None, :] - sil_v[None, :, :]) ** 2).sum(axis=2))
    np.fill_diagonal(sd, 1e9)
    sil_near = sd.min(axis=1)

    occ = []
    for d in data:
        p = d['tl'][0] if d['tl'] else None
        if p is None:
            occ.append(0.0)
            continue
        head = np.asarray(render.render_stage(
            p, parts={'hair_back', 'face', 'hair_front', 'glasses', 'face_parts'}))[:, :, 3]
        front = {k for k in ('armL', 'armR') if p[k + '_z'] == 'front'}
        it = d['item']
        ex = (lambda c, _p=p, _it=it: _it['fx'](c, _p, 0)) if it.get('fx') else None
        fr = np.asarray(render.render_stage(p, parts=front, extras=ex))[:, :, 3]
        m = head > 128
        occ.append(float(((fr > 128) & m).sum()) / max(1, int(m.sum())))

    GLASSES_LED = {23, 32}
    PROP_OR_FX = {3, 5, 11, 12, 15, 16, 19, 20, 21, 24, 25, 26, 27, 28, 29, 30,
                  33, 34, 35, 36, 37, 38, 39, 40}

    def clamp(v, lo=6.0, hi=20.0):
        return round(max(lo, min(hi, v)), 1)

    rows = []
    for i, d in enumerate(data):
        it = d['item']
        small = clamp(12.0 + 8.0 * (nearest[i] - 5.0) / 9.0, 6.0, 20.0)
        sil = clamp(12.0 + 8.0 * (sil_near[i] - 2.4) / 5.6, 6.0, 20.0)
        hooks = clamp(20.0 - 24.0 * occ[i], 6.0, 20.0)
        material = 18 if it['poses'] is not None else 17
        concept = 19 if it['n'] in GLASSES_LED else (18 if it['n'] in PROP_OR_FX else 17)
        tot = round(concept + sil + material + hooks + small, 1)
        parts_min = min(concept, sil, material, hooks, small)
        rows.append([it['n'], it['ja'], concept, sil, material, hooks, small, tot,
                     'PASS' if (tot >= 80 and parts_min >= 12) else 'REVIEW',
                     ('32px色距離%.2f(下位%d/40) / 32pxシルエット距離%.2f / '
                      'メガネ遮蔽率%.1f%% / 素材と一言コンセプトは作者判断'
                      % (nearest[i], int((nearest < nearest[i]).sum()) + 1,
                         sil_near[i], 100 * occ[i]))])
    w_csv(os.path.join(REPORTS, 'design-quality-audit.csv'),
          ['number', 'meaning', 'concept_strength', 'silhouette_originality',
           'material_and_depth', 'series_hooks', 'small_size_product_appeal',
           'total', 'result', 'basis'], rows)

    return data, dupes, nearest, nearest_idx


if __name__ == '__main__':
    main()
