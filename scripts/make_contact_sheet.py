#!/usr/bin/env python3
"""コンタクトシート生成（§0-2 / §4）。目視確認は必ずこの1枚を Read ツールで開いて行う。

  python3 scripts/make_contact_sheet.py OUTPUT/first_frames --cols 8 --cell 180 \
      --out previews/first-frames-180.png
  python3 scripts/make_contact_sheet.py OUTPUT/first_frames --cols 8 --cell 32 \
      --scale-to 32 --out previews/first-frames-32.png
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw

CHECKER = ((238, 238, 238), (214, 214, 214))


def checkerboard(size, cell=8):
    img = Image.new("RGB", size, CHECKER[0])
    d = ImageDraw.Draw(img)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=CHECKER[1])
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src_dir")
    ap.add_argument("--cols", type=int, default=8)
    ap.add_argument("--cell", type=int, default=180, help="セルの一辺px")
    ap.add_argument("--scale-to", type=int, help="画像をこのサイズへ縮小してからセルへ中央配置する")
    ap.add_argument("--pad", type=int, default=4)
    ap.add_argument("--label", action="store_true", help="ファイル名の番号を焼き込む")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    if not os.path.isdir(args.src_dir):
        print(f"ERROR: not a directory: {args.src_dir}", file=sys.stderr)
        return 3
    names = sorted(n for n in os.listdir(args.src_dir) if n.lower().endswith(".png"))
    if not names:
        print(f"ERROR: no PNG in {args.src_dir}", file=sys.stderr)
        return 3

    cols = args.cols
    rows = (len(names) + cols - 1) // cols
    cw = ch = args.cell + args.pad * 2
    sheet = checkerboard((cols * cw, rows * ch))
    draw = ImageDraw.Draw(sheet)

    for i, n in enumerate(names):
        im = Image.open(os.path.join(args.src_dir, n)).convert("RGBA")
        if args.scale_to:
            im = im.resize((args.scale_to, args.scale_to), Image.LANCZOS)
        elif im.size != (args.cell, args.cell):
            im = im.resize((args.cell, args.cell), Image.LANCZOS)
        cx = (i % cols) * cw + args.pad + (args.cell - im.width) // 2
        cy = (i // cols) * ch + args.pad + (args.cell - im.height) // 2
        sheet.paste(im, (cx, cy), im)
        if args.label:
            draw.text(((i % cols) * cw + 3, (i // cols) * ch + 2), n[:3], fill=(20, 23, 28))

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    sheet.save(args.out)
    print(f"make_contact_sheet: {len(names)} images -> {args.out} ({sheet.width}x{sheet.height})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
