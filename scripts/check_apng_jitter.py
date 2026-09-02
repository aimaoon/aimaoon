#!/usr/bin/env python3
"""§11-1 アンカーのブレ・見切れ・固定領域の検査。

使い方:
  python3 scripts/check_apng_jitter.py <APNG_DIR> --config reports/anchor-config.json \
      --output-dir reports/jitter [--items 001,002] [--fail-on review]

対象は <APNG_DIR> 内の 001.png〜040.png のみ。tab.png / main.png は除外する。
終了コード: 0=FAILなしREVIEWなし / 2=REVIEWのみ / 1=FAILあり / 3=実行エラー
"""
import argparse
import csv
import json
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import apnglib  # noqa: E402

NAME_RE = re.compile(r"^(\d{3})\.png$")
RANK = {"PASS": 0, "NOT_RUN": 1, "REVIEW": 2, "FAIL": 3}


def worst(*vals):
    return max(vals, key=lambda v: RANK[v])


def ssd_map(frame, template, tmpl_alpha, x0, y0, radius):
    """テンプレートを ±radius で全探索し、アルファ重み付き RGB の SSD マップを返す。"""
    th, tw = template.shape[:2]
    h, w = frame.shape[:2]
    size = 2 * radius + 1
    out = np.full((size, size), np.inf, dtype=np.float64)
    wsum = float(tmpl_alpha.sum()) + 1e-9
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            sx, sy = x0 + dx, y0 + dy
            if sx < 0 or sy < 0 or sx + tw > w or sy + th > h:
                continue
            patch = frame[sy:sy + th, sx:sx + tw, :3].astype(np.float64)
            diff = patch - template
            out[dy + radius, dx + radius] = float((tmpl_alpha * (diff ** 2)).sum() / wsum)
    return out


def parabolic(y_minus, y_zero, y_plus):
    """3点の放物線フィットでサブピクセル補正量を返す。"""
    denom = y_minus - 2.0 * y_zero + y_plus
    if abs(denom) < 1e-12:
        return 0.0
    delta = 0.5 * (y_minus - y_plus) / denom
    return float(np.clip(delta, -1.0, 1.0))


def track(frames, roi, radius):
    """フレーム1の ROI をテンプレートに、各フレームのサブピクセル座標と信頼度を返す。"""
    x, y, w, h = roi
    f0 = frames[0]
    template = f0[y:y + h, x:x + w, :3].astype(np.float64)
    alpha = (f0[y:y + h, x:x + w, 3:4].astype(np.float64) / 255.0)
    if alpha.sum() < 1e-6:                      # ROI が完全に透明ならアルファ重みを外す
        alpha = np.ones_like(alpha)

    coords, confs = [], []
    for fr in frames:
        m = ssd_map(fr, template, alpha, x, y, radius)
        if not np.isfinite(m).any():
            coords.append((float(x), float(y)))
            confs.append(0.0)
            continue
        idx = int(np.nanargmin(np.where(np.isfinite(m), m, np.inf)))
        gy, gx = divmod(idx, m.shape[1])
        best = m[gy, gx]

        # second best: 最小位置から2px以上離れた点の最小値（隣接画素は同じ谷なので除く）
        yy, xx = np.mgrid[0:m.shape[0], 0:m.shape[1]]
        far = (np.abs(yy - gy) > 1) | (np.abs(xx - gx) > 1)
        cand = np.where(far & np.isfinite(m), m, np.inf)
        second = float(cand.min()) if np.isfinite(cand).any() else float("inf")
        conf = 0.0 if not np.isfinite(second) or second <= 0 else float(1.0 - best / second)
        conf = max(0.0, min(1.0, conf))

        sub_x = sub_y = 0.0
        if 0 < gx < m.shape[1] - 1 and np.isfinite(m[gy, gx - 1]) and np.isfinite(m[gy, gx + 1]):
            sub_x = parabolic(m[gy, gx - 1], best, m[gy, gx + 1])
        if 0 < gy < m.shape[0] - 1 and np.isfinite(m[gy - 1, gx]) and np.isfinite(m[gy + 1, gx]):
            sub_y = parabolic(m[gy - 1, gx], best, m[gy + 1, gx])

        coords.append((x + (gx - radius) + sub_x, y + (gy - radius) + sub_y))
        confs.append(conf)
    return coords, confs


def check_item(path, number, cfg, defaults, out_dir, expected_frames=20):
    d = defaults
    item = cfg.get(number, {})
    roi = item.get("anchor_roi")
    radius = int(item.get("anchor_search_px", d["anchor_search_px"]))
    travel = bool(item.get("allow_horizontal_travel", False))
    stage_exit = bool(item.get("allow_stage_exit", False))
    safe = int(item.get("safe_area_px", d["safe_area_px"]))
    expected_path = item.get("expected_anchor_path")
    fixed_mask_path = item.get("fixed_mask")

    row = {"number": number, "horizontal_anchor": item.get("horizontal_anchor", ""),
           "allow_horizontal_travel": travel, "allow_stage_exit": stage_exit}
    reasons = []
    result = "PASS"

    frames = apnglib.frames_as_arrays(apnglib.load_frames(path))
    row["frames"] = len(frames)
    if len(frames) != expected_frames:
        result = "FAIL"
        reasons.append(f"frame count {len(frames)} != {expected_frames}")

    if roi is None:
        row.update({"anchor_confidence_min": "", "horizontal_anchor_range_px": "",
                    "max_adjacent_horizontal_anchor_step_px": "", "loop_boundary_step_px": ""})
        reasons.append("anchor_roi not configured")
        result = worst(result, "REVIEW")
        coords = confs = None
    else:
        coords, confs = track(frames, roi, radius)
        xs = [c[0] for c in coords]
        rng = max(xs) - min(xs)
        row["anchor_confidence_min"] = round(min(confs), 4)
        row["horizontal_anchor_range_px"] = round(rng, 3)

        if min(confs) < d["match_confidence_min"]:
            result = worst(result, "REVIEW")
            reasons.append(f"anchor confidence {min(confs):.3f} < {d['match_confidence_min']}")

        if not travel:
            if rng > d["max_anchor_range_px"]:
                result = "FAIL"
                reasons.append(f"horizontal anchor range {rng:.2f}px > {d['max_anchor_range_px']}")
        else:
            if not expected_path:
                result = "FAIL"
                reasons.append("allow_horizontal_travel=true but expected_anchor_path missing")
            elif len(expected_path) != len(coords):
                result = "FAIL"
                reasons.append(f"expected_anchor_path length {len(expected_path)} != {len(coords)}")
            else:
                devs = [float(np.hypot(c[0] - e[0], c[1] - e[1]))
                        for c, e in zip(coords, expected_path)]
                row["max_expected_path_deviation_px"] = round(max(devs), 3)
                if max(devs) > 2.0:
                    result = "FAIL"
                    reasons.append(f"expected_anchor_path deviation {max(devs):.2f}px > 2px")

        steps = [float(np.hypot(b[0] - a[0], b[1] - a[1])) for a, b in zip(coords, coords[1:])]
        med = float(np.median(steps)) if steps else 0.0
        mx = max(steps) if steps else 0.0
        row["max_adjacent_horizontal_anchor_step_px"] = round(mx, 3)
        if steps and mx > med * d["jitter_step_ratio"] and mx > d["jitter_step_min_px"]:
            result = "FAIL"
            reasons.append(f"jitter: max step {mx:.2f}px > median {med:.2f} x "
                           f"{d['jitter_step_ratio']} and > {d['jitter_step_min_px']}")

        loop_step = float(np.hypot(coords[0][0] - coords[-1][0], coords[0][1] - coords[-1][1]))
        row["loop_boundary_step_px"] = round(loop_step, 3)
        if steps and loop_step > med * d["jitter_step_ratio"] and loop_step > d["jitter_step_min_px"]:
            result = "FAIL"
            reasons.append(f"loop boundary step {loop_step:.2f}px > median {med:.2f} x "
                           f"{d['jitter_step_ratio']}")

    # 固定領域
    if not fixed_mask_path or not os.path.isfile(fixed_mask_path):
        row["fixed_region_difference_ratio"] = "NOT_RUN"
        row["mean_fixed_displacement_px"] = "NOT_RUN"
        result = worst(result, "NOT_RUN")
        reasons.append(f"fixed_mask not found: {fixed_mask_path}")
    else:
        from PIL import Image
        mask = np.asarray(Image.open(fixed_mask_path).convert("L")) > 127
        base = frames[0]
        ratios, disps = [], []
        ys, xs_ = np.where(mask)
        if ys.size == 0:
            row["fixed_region_difference_ratio"] = "NOT_RUN"
            row["mean_fixed_displacement_px"] = "NOT_RUN"
            result = worst(result, "NOT_RUN")
            reasons.append("fixed_mask is empty")
        else:
            bx0, bx1, by0, by1 = xs_.min(), xs_.max() + 1, ys.min(), ys.max() + 1
            sub_roi = [int(bx0), int(by0), int(bx1 - bx0), int(by1 - by0)]
            for fr in frames[1:]:
                diff = np.abs(fr.astype(np.int16) - base.astype(np.int16)).max(axis=2)
                ratios.append(float((diff[mask] > 2).mean()))
            fcoords, _ = track(frames, sub_roi, max(4, radius // 2))
            for c in fcoords[1:]:
                disps.append(float(np.hypot(c[0] - fcoords[0][0], c[1] - fcoords[0][1])))
            mr = max(ratios) if ratios else 0.0
            md = float(np.mean(disps)) if disps else 0.0
            row["fixed_region_difference_ratio"] = round(mr, 6)
            row["mean_fixed_displacement_px"] = round(md, 4)
            if mr > 0.005:
                result = "FAIL"
                reasons.append(f"fixed region difference ratio {mr:.4f} > 0.005")
            if md > d["max_mean_fixed_displacement_px"]:
                result = "FAIL"
                reasons.append(f"mean fixed displacement {md:.3f}px > "
                               f"{d['max_mean_fixed_displacement_px']}")

    # 見切れ
    margins = [apnglib.min_edge_margin(a, d["alpha_threshold"]) for a in frames]
    real = [m for m in margins if m is not None]
    row["min_safe_margin_px"] = min(real) if real else ""
    if not stage_exit:
        if not real:
            result = "FAIL"
            reasons.append("no visible pixels in any frame")
        elif min(real) < safe:
            result = "FAIL"
            bad = [i + 1 for i, m in enumerate(margins) if m is not None and m < safe]
            reasons.append(f"safe area violated on frames {bad[:8]} (min {min(real)}px < {safe}px)")

    row["result"] = result
    row["reasons"] = "; ".join(reasons)

    # 遷移CSV
    os.makedirs(out_dir, exist_ok=True)
    tpath = os.path.join(out_dir, f"{number}-transitions.csv")
    with open(tpath, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["from_frame", "to_frame", "anchor_dx_px", "anchor_dy_px", "step_px",
                    "changed_pixel_ratio", "bbox_margin_px", "flag"])
        n = len(frames)
        for i in range(n):
            j = (i + 1) % n
            if coords:
                dx = coords[j][0] - coords[i][0]
                dy = coords[j][1] - coords[i][1]
                step = float(np.hypot(dx, dy))
            else:
                dx = dy = step = ""
            ch = float((np.abs(frames[j].astype(np.int16) -
                               frames[i].astype(np.int16)).max(axis=2) > 2).mean())
            marg = margins[j] if margins[j] is not None else ""
            flag = ""
            if not stage_exit and margins[j] is not None and margins[j] < safe:
                flag = "SAFE_AREA"
            if isinstance(step, float) and step > d["jitter_step_min_px"] and not travel:
                flag = (flag + "|" if flag else "") + "STEP"
            if j == 0:
                flag = (flag + "|" if flag else "") + "LOOP_BOUNDARY"
            w.writerow([i + 1, j + 1,
                        round(dx, 3) if dx != "" else "",
                        round(dy, 3) if dy != "" else "",
                        round(step, 3) if step != "" else "",
                        round(ch, 6), marg, flag])
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("apng_dir")
    ap.add_argument("--config", required=True)
    ap.add_argument("--output-dir", default="reports/jitter")
    ap.add_argument("--items")
    ap.add_argument("--fail-on", choices=["fail", "review"], default="fail")
    ap.add_argument("--frames", type=int, default=20)
    args = ap.parse_args()

    if not os.path.isdir(args.apng_dir):
        print(f"ERROR: not a directory: {args.apng_dir}", file=sys.stderr)
        return 3
    with open(args.config, encoding="utf-8") as f:
        cfg_all = json.load(f)
    defaults = cfg_all.get("defaults", {})
    cfg = cfg_all.get("items", {})

    wanted = set(args.items.split(",")) if args.items else None
    names = sorted(n for n in os.listdir(args.apng_dir)
                   if NAME_RE.match(n) and (wanted is None or n[:3] in wanted))

    rows = []
    for name in names:
        number = name[:3]
        try:
            rows.append(check_item(os.path.join(args.apng_dir, name), number,
                                   cfg, defaults, args.output_dir, args.frames))
        except Exception as exc:                                # noqa: BLE001
            rows.append({"number": number, "result": "FAIL",
                         "reasons": f"{type(exc).__name__}: {exc}"})

    os.makedirs(args.output_dir, exist_ok=True)
    cols = ["number", "frames", "anchor_confidence_min", "horizontal_anchor",
            "horizontal_anchor_range_px", "max_adjacent_horizontal_anchor_step_px",
            "loop_boundary_step_px", "fixed_region_difference_ratio",
            "mean_fixed_displacement_px", "min_safe_margin_px", "allow_horizontal_travel",
            "allow_stage_exit", "result", "reasons"]
    with open(os.path.join(args.output_dir, "jitter-audit.csv"), "w",
              newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    counts = {"PASS": 0, "REVIEW": 0, "FAIL": 0, "NOT_RUN": 0}
    for r in rows:
        counts[r["result"]] = counts.get(r["result"], 0) + 1
    print(f"check_apng_jitter: {len(rows)} items in {args.apng_dir}")
    print("  " + " ".join(f"{k}={v}" for k, v in counts.items()))
    shown = 0
    for r in rows:
        if r["result"] in ("FAIL", "REVIEW") and shown < 10:
            print(f"  {r['number']}: {r['result']} :: {r.get('reasons','')}")
            shown += 1

    if counts["FAIL"]:
        return 1
    if counts["REVIEW"] or (args.fail_on == "review" and counts["NOT_RUN"]):
        return 2
    if counts["NOT_RUN"]:
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:                                     # noqa: BLE001
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(3)
