#!/usr/bin/env python3
"""§9-8 / §9-9 APNGの書き出しと容量最適化。

  python3 scripts/build_apng.py 001 [002 ...] [--frames-root OUTPUT/frames]
  python3 scripts/build_apng.py --all

入力: OUTPUT/frames/NNN/ に 20枚の 180x180 RGBA PNG（ファイル名の昇順がフレーム順）
出力: OUTPUT/final/NNN.png と reports/compression-audit.csv

書き出したAPNGは必ず読み戻して元フレームと画素一致を検証する（§9-8）。
一致しない場合は disposal / blend の組み合わせを変えて再検証し、一致するまで完成扱いにしない。
apngasm / oxipng が無い環境では Pillow + 自前の最適化で代替し、その事実を
compression-audit.csv の optimization_pass へ記録する。
"""
import argparse
import csv
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import apnglib  # noqa: E402

TARGET_BYTES = 285000
HARD_LIMIT_BYTES = 300000

# 試す disposal / blend の組み合わせ。先頭が §9-8 の既定。
DISPOSAL = getattr(Image, "Disposal", None)
COMBOS = [
    ("OP_BACKGROUND/SOURCE", (DISPOSAL.OP_BACKGROUND if DISPOSAL else 1), 0),
    ("OP_NONE/OVER", (DISPOSAL.OP_NONE if DISPOSAL else 0), 1),
    ("OP_NONE/SOURCE", (DISPOSAL.OP_NONE if DISPOSAL else 0), 0),
    ("OP_PREVIOUS/OVER", (DISPOSAL.OP_PREVIOUS if DISPOSAL else 2), 1),
]


def load_source_frames(d):
    names = sorted(n for n in os.listdir(d) if n.lower().endswith(".png"))
    frames = [Image.open(os.path.join(d, n)).convert("RGBA") for n in names]
    return frames, names


def normalize(frames):
    """透明画素の RGB を 0 へ正規化する（§9-8 / §9-9 手順1）。"""
    return [apnglib.normalize_transparent(f) for f in frames]


def changed_bbox_ratio(frames):
    """前フレームとの差分矩形が全体に占める最大比率（§9-9 の指標）。"""
    worst = 0.0
    h, w = np.asarray(frames[0]).shape[:2]
    for a, b in zip(frames, frames[1:]):
        d = np.abs(np.asarray(a, np.int16) - np.asarray(b, np.int16)).max(axis=2) > 2
        if not d.any():
            continue
        ys, xs = np.where(d)
        r = ((xs.max() - xs.min() + 1) * (ys.max() - ys.min() + 1)) / float(w * h)
        worst = max(worst, r)
    return worst


def fixed_region_identical(frames, fixed_mask_path):
    """固定領域が全フレームでバイト一致しているか（§9-9）。マスクが無ければ None。"""
    if not fixed_mask_path or not os.path.isfile(fixed_mask_path):
        return None
    mask = np.asarray(Image.open(fixed_mask_path).convert("L")) > 127
    if not mask.any():
        return None
    base = np.asarray(frames[0])
    for f in frames[1:]:
        if not np.array_equal(np.asarray(f)[mask], base[mask]):
            return False
    return True


def write_with_roundtrip(frames, durations, out_path):
    """§9-8 の組み合わせを順に試し、ラウンドトリップに合格した最小の出力を採用する。"""
    tried = []
    best = None
    tmp = out_path + ".try"
    for label, dis, blend in COMBOS:
        try:
            frames[0].save(tmp, format="PNG", save_all=True, append_images=frames[1:],
                           duration=durations, loop=1, disposal=dis, blend=blend,
                           default_image=False, optimize=False, dpi=(72, 72))
        except Exception as exc:                                # noqa: BLE001
            tried.append(f"{label}:write_error({type(exc).__name__})")
            continue
        diff, err = apnglib.roundtrip_max_diff(frames, tmp)
        size = os.path.getsize(tmp)
        if err is not None:
            tried.append(f"{label}:{err}")
        elif diff > 1:
            tried.append(f"{label}:roundtrip_diff={diff}")
        else:
            tried.append(f"{label}:OK({size}B,diff={diff})")
            if best is None or size < best[1]:
                if best is not None:
                    os.remove(best[2])
                keep = out_path + f".keep{len(tried)}"
                shutil.copyfile(tmp, keep)
                best = (label, size, keep, diff)
            continue
    if os.path.exists(tmp):
        os.remove(tmp)
    if best is None:
        return None, tried
    shutil.move(best[2], out_path)
    return best, tried


def build_one(number, plan_items, frames_root, out_dir, anchor_cfg):
    src_dir = os.path.join(frames_root, number)
    row = {"number": number}
    if not os.path.isdir(src_dir):
        row.update({"optimization_pass": "NOT_RUN", "roundtrip_result": "NOT_RUN",
                    "visual_quality_result": "NOT_RUN",
                    "bytes_before": "", "bytes_after": "", "target_met": "NOT_RUN",
                    "hard_limit_met": "NOT_RUN", "frames": 0, "unique_frames": 0,
                    "cycle_ms": "", "max_changed_bbox_ratio": "",
                    "fixed_region_byte_identity": "NOT_RUN",
                    "note": f"source frames not found: {src_dir}"})
        return row

    item = plan_items[number]
    durations = item["frame_durations_ms"]
    frames, names = load_source_frames(src_dir)
    if len(frames) != len(durations):
        row.update({"optimization_pass": "FAIL", "roundtrip_result": "NOT_RUN",
                    "visual_quality_result": "NOT_RUN", "bytes_before": "", "bytes_after": "",
                    "target_met": "FAIL", "hard_limit_met": "FAIL", "frames": len(frames),
                    "unique_frames": "", "cycle_ms": sum(durations),
                    "max_changed_bbox_ratio": "", "fixed_region_byte_identity": "NOT_RUN",
                    "note": f"{len(frames)} source frames vs {len(durations)} durations"})
        return row

    passes = []
    if shutil.which("oxipng") is None and shutil.which("apngasm") is None:
        passes.append("pillow_fallback(no apngasm/oxipng)")

    # 手順1: 透明画素のRGB正規化
    frames = normalize(frames)
    passes.append("transparent_rgb_normalize")

    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{number}.png")

    # 手順2: 差分矩形・blend・disposal の最適化（ラウンドトリップ合格が前提）
    best, tried = write_with_roundtrip(frames, durations, out_path)
    if best is None:
        row.update({"optimization_pass": "FAIL", "roundtrip_result": "FAIL",
                    "visual_quality_result": "NOT_RUN", "bytes_before": "", "bytes_after": "",
                    "target_met": "FAIL", "hard_limit_met": "FAIL", "frames": len(frames),
                    "unique_frames": "", "cycle_ms": sum(durations),
                    "max_changed_bbox_ratio": "", "fixed_region_byte_identity": "NOT_RUN",
                    "note": "no disposal/blend combo passed roundtrip: " + "; ".join(tried)})
        return row
    label, size_before, _keep, diff = best
    passes.append(f"disposal_blend={label}")

    # 手順1続き: メタデータ削除
    apnglib.strip_metadata(out_path)
    passes.append("strip_metadata")
    size_after = os.path.getsize(out_path)

    # メタデータ削除後も再度ラウンドトリップを確認する
    diff2, err2 = apnglib.roundtrip_max_diff(frames, out_path)
    roundtrip = "PASS" if (err2 is None and diff2 is not None and diff2 <= 1) else "FAIL"

    arrs = apnglib.frames_as_arrays(apnglib.load_frames(out_path))
    uniq = len(set(apnglib.frame_hash(a) for a in arrs))
    ratio = changed_bbox_ratio(frames)
    mask_path = (anchor_cfg.get("items", {}).get(number, {}) or {}).get("fixed_mask")
    fixed_ok = fixed_region_identical(frames, mask_path)

    row.update({
        "bytes_before": size_before,
        "bytes_after": size_after,
        "target_met": "PASS" if size_after <= TARGET_BYTES else "REVIEW",
        "hard_limit_met": "PASS" if size_after <= HARD_LIMIT_BYTES else "FAIL",
        "frames": len(arrs),
        "unique_frames": uniq,
        "cycle_ms": sum(durations),
        "max_changed_bbox_ratio": round(ratio, 4),
        "fixed_region_byte_identity": ("NOT_RUN" if fixed_ok is None
                                       else ("PASS" if fixed_ok else "FAIL")),
        "optimization_pass": " + ".join(passes),
        "roundtrip_result": roundtrip,
        "visual_quality_result": "NOT_RUN",
        "note": "; ".join(tried),
    })
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("numbers", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--plan", default=os.path.join(ROOT, "emoji-plan.json"))
    ap.add_argument("--anchor-config", default=os.path.join(ROOT, "reports", "anchor-config.json"))
    ap.add_argument("--frames-root", default=os.path.join(ROOT, "OUTPUT", "frames"))
    ap.add_argument("--out-dir", default=os.path.join(ROOT, "OUTPUT", "final"))
    ap.add_argument("--csv", default=os.path.join(ROOT, "reports", "compression-audit.csv"))
    args = ap.parse_args()

    with open(args.plan, encoding="utf-8") as f:
        plan = json.load(f)
    items = {i["number"]: i for i in plan["items"]}
    anchor_cfg = {}
    if os.path.isfile(args.anchor_config):
        with open(args.anchor_config, encoding="utf-8") as f:
            anchor_cfg = json.load(f)

    numbers = sorted(items) if (args.all or not args.numbers) else args.numbers
    rows = [build_one(n, items, args.frames_root, args.out_dir, anchor_cfg) for n in numbers]

    cols = ["number", "bytes_before", "bytes_after", "target_met", "hard_limit_met", "frames",
            "unique_frames", "cycle_ms", "max_changed_bbox_ratio", "fixed_region_byte_identity",
            "optimization_pass", "roundtrip_result", "visual_quality_result", "note"]
    os.makedirs(os.path.dirname(os.path.abspath(args.csv)), exist_ok=True)
    with open(args.csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in cols})

    built = [r for r in rows if r.get("roundtrip_result") == "PASS"]
    print(f"build_apng: {len(built)}/{len(rows)} built with roundtrip PASS")
    for r in rows:
        if r.get("roundtrip_result") != "PASS":
            print(f"  {r['number']}: {r.get('roundtrip_result')} :: {r.get('note','')[:120]}")
    return 0 if built and len(built) == len(rows) else (2 if not built else 1)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:                                     # noqa: BLE001
        import traceback
        traceback.print_exc()
        sys.exit(3)
