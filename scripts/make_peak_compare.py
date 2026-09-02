#!/usr/bin/env python3
"""§9-7 第1フレームと最大動作フレームの並置比較。

  python3 scripts/make_peak_compare.py OUTPUT/final/001.png --peak-frame 12 \
      --out previews/peak/001.png

上段に180px、下段に32pxを並べ、右端にシルエット差分を出す。
--peak-frame 未指定なら emoji-plan.json の frame_durations_ms から最長フレームを選ぶ。
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import apnglib  # noqa: E402
from make_contact_sheet import checkerboard  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("apng")
    ap.add_argument("--peak-frame", type=int, help="1-indexed")
    ap.add_argument("--out", required=True)
    ap.add_argument("--plan", default=os.path.join(ROOT, "emoji-plan.json"))
    args = ap.parse_args()

    if not os.path.isfile(args.apng):
        print(f"ERROR: no such file: {args.apng}", file=sys.stderr)
        return 3
    frames = apnglib.frames_as_arrays(apnglib.load_frames(args.apng))
    number = os.path.splitext(os.path.basename(args.apng))[0]

    peak = args.peak_frame
    if peak is None and os.path.isfile(args.plan):
        with open(args.plan, encoding="utf-8") as f:
            plan = json.load(f)
        item = next((i for i in plan["items"] if i["number"] == number), None)
        if item:
            d = item["frame_durations_ms"]
            peak = d.index(max(d)) + 1
    if peak is None:
        peak = len(frames) // 2
    peak = max(1, min(len(frames), peak))

    a, b = frames[0], frames[peak - 1]

    # 右パネル: 橙=第1フレームのみ / 緑=最大動作のみ / 黒=両方に共通（固定部位）
    overlay = np.zeros_like(a)
    ma, mb = a[..., 3] > 8, b[..., 3] > 8
    overlay[ma] = (255, 106, 43, 200)
    overlay[mb] = (31, 94, 82, 220)
    overlay[ma & mb] = (20, 23, 28, 255)

    cell, small, pad = 180, 32, 8
    sheet = checkerboard((cell * 3 + pad * 4, cell + small + pad * 3))
    for i, arr in enumerate([a, b, overlay]):
        img = Image.fromarray(arr)
        sheet.paste(img, (pad + i * (cell + pad), pad), img)
        thumb = img.resize((small, small), Image.LANCZOS)
        sheet.paste(thumb, (pad + i * (cell + pad) + (cell - small) // 2, cell + pad * 2), thumb)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    sheet.save(args.out)
    print(f"make_peak_compare: {number} F01 vs F{peak:02d} -> {args.out}")
    print("  左=第1フレーム 中=最大動作 右=シルエット重ね（橙=第1のみ 緑=最大のみ 黒=共通）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
