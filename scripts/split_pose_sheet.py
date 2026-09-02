#!/usr/bin/env python3
"""2×2ポーズシートを個別のポーズ原画へ分割する（§8 の「原則2×2の4ポーズシート」対応）。

  python3 scripts/split_pose_sheet.py sheet.png --number 001 --roles P1,P2,P3,P4
  python3 scripts/split_pose_sheet.py sheet.png --number 001 --roles P1,P2,P3,P4 --gutter 24

マスは左上→右上→左下→右下の順に --roles へ対応させる。
分割後、各マスに描画があるか（空マスでないか）と、
キャラクターがマスをまたいでいないか（外周ガターに画素が無いか）を検査する。
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

ROLE_SLUG = {"P1": "first", "P2": "anticipation", "P3": "transit",
             "P4": "peak", "P5": "recoil", "P6": "return",
             "S1": "complete", "S2": "appear", "S3": "approach",
             "S4": "join", "S5": "scatter"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("--number", required=True)
    ap.add_argument("--roles", required=True, help="左上,右上,左下,右下 の順（例 P1,P2,P3,P4）")
    ap.add_argument("--out-root", default="poses")
    ap.add_argument("--gutter", type=int, default=0,
                    help="各マスの外周でまたぎを検査する幅px（0で検査しない）")
    ap.add_argument("--alpha-threshold", type=int, default=8)
    args = ap.parse_args()

    roles = [r.strip() for r in args.roles.split(",") if r.strip()]
    if len(roles) != 4:
        print(f"ERROR: --roles expects exactly 4 entries, got {len(roles)}", file=sys.stderr)
        return 3
    unknown = [r for r in roles if r not in ROLE_SLUG]
    if unknown:
        print(f"ERROR: unknown role(s) {unknown}; known: {sorted(ROLE_SLUG)}", file=sys.stderr)
        return 3
    if not os.path.isfile(args.sheet):
        print(f"ERROR: no such file: {args.sheet}", file=sys.stderr)
        return 3

    im = Image.open(args.sheet).convert("RGBA")
    if im.width % 2 or im.height % 2:
        print(f"ERROR: sheet {im.width}x{im.height} is not evenly divisible into 2x2",
              file=sys.stderr)
        return 3
    cw, ch = im.width // 2, im.height // 2

    out_dir = os.path.join(args.out_root, args.number)
    os.makedirs(out_dir, exist_ok=True)

    problems = []
    for idx, role in enumerate(roles):
        x = (idx % 2) * cw
        y = (idx // 2) * ch
        cell = im.crop((x, y, x + cw, y + ch))
        arr = np.asarray(cell)
        visible = arr[..., 3] > args.alpha_threshold
        if not visible.any():
            problems.append(f"{role}: empty cell (no pixels above alpha {args.alpha_threshold})")
        elif args.gutter > 0:
            g = args.gutter
            edge = np.zeros_like(visible)
            edge[:g, :] = edge[-g:, :] = edge[:, :g] = edge[:, -g:] = True
            if (visible & edge).any():
                problems.append(f"{role}: content reaches the {g}px gutter "
                                f"(the pose may straddle cells)")
        path = os.path.join(out_dir, f"{role}-{ROLE_SLUG[role]}.png")
        cell.save(path)
        print(f"  wrote {path} ({cw}x{ch})")

    print(f"split_pose_sheet: {args.sheet} -> {out_dir} ({len(roles)} cells of {cw}x{ch})")
    for p in problems:
        print(f"  WARNING: {p}")
    return 1 if problems else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:                                     # noqa: BLE001
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(3)
