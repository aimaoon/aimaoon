#!/usr/bin/env python3
"""§8-3 ポーズストリップ生成。P1〜P6を横一列に並べ、180pxと32pxを上下段にする。

  python3 scripts/make_pose_strip.py poses/001 --out previews/pose-strips/001.png --sizes 180,32
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw

from make_contact_sheet import checkerboard  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pose_dir")
    ap.add_argument("--out", required=True)
    ap.add_argument("--sizes", default="180,32")
    ap.add_argument("--pad", type=int, default=6)
    args = ap.parse_args()

    if not os.path.isdir(args.pose_dir):
        print(f"ERROR: not a directory: {args.pose_dir}", file=sys.stderr)
        return 3
    names = sorted(n for n in os.listdir(args.pose_dir) if n.lower().endswith(".png"))
    if not names:
        print(f"ERROR: no PNG in {args.pose_dir}", file=sys.stderr)
        return 3

    sizes = [int(s) for s in args.sizes.split(",")]
    cell = max(sizes)
    pad = args.pad
    width = len(names) * (cell + pad) + pad
    height = sum(s + pad for s in sizes) + pad + 14
    sheet = checkerboard((width, height))
    d = ImageDraw.Draw(sheet)

    y = pad
    for s in sizes:
        for i, n in enumerate(names):
            im = Image.open(os.path.join(args.pose_dir, n)).convert("RGBA")
            im = im.resize((s, s), Image.LANCZOS)
            x = pad + i * (cell + pad) + (cell - s) // 2
            sheet.paste(im, (x, y), im)
        y += s + pad
    for i, n in enumerate(names):
        d.text((pad + i * (cell + pad), height - 13), os.path.splitext(n)[0][:16],
               fill=(20, 23, 28))

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    sheet.save(args.out)
    print(f"make_pose_strip: {len(names)} poses at sizes {sizes} -> {args.out}")
    if len(names) < 6:
        print(f"  WARNING: {len(names)} poses (§8-1 requires >= 6 for 001-032)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
