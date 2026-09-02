#!/usr/bin/env python3
"""§14 previews/animated-contact-sheet.gif を作る。ffmpeg が無い環境のため Pillow で生成する。

  python3 scripts/make_animated_sheet.py OUTPUT/final --cols 8 --cell 90 \
      --out previews/animated-contact-sheet.gif

40個を同時再生し、全体が同じ周期で一斉に膨張・収縮して見えないかを確認する（付録A-6 項目7）。
"""
import argparse
import os
import re
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import apnglib  # noqa: E402
from make_contact_sheet import checkerboard  # noqa: E402

NAME_RE = re.compile(r"^(\d{3})\.png$")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("apng_dir")
    ap.add_argument("--cols", type=int, default=8)
    ap.add_argument("--cell", type=int, default=90)
    ap.add_argument("--steps", type=int, default=40, help="GIFの総フレーム数")
    ap.add_argument("--cycle-ms", type=int, default=4000)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    if not os.path.isdir(args.apng_dir):
        print(f"ERROR: not a directory: {args.apng_dir}", file=sys.stderr)
        return 3
    names = sorted(n for n in os.listdir(args.apng_dir) if NAME_RE.match(n))
    if not names:
        print(f"ERROR: no NNN.png in {args.apng_dir}", file=sys.stderr)
        return 3

    # 各絵文字を「時刻→フレーム」で引けるようにする
    clips = []
    for n in names:
        path = os.path.join(args.apng_dir, n)
        frames = apnglib.load_frames(path)
        info = apnglib.ApngInfo(path)
        acc, t = [], 0.0
        for dn, dd in info.delays:
            den = 100 if dd == 0 else dd
            t += dn * 1000.0 / den
            acc.append(t)
        if not acc:
            acc = [args.cycle_ms * (i + 1) / len(frames) for i in range(len(frames))]
        clips.append((frames, acc, acc[-1]))

    cols = args.cols
    rows = (len(names) + cols - 1) // cols
    cell = args.cell
    size = (cols * cell, rows * cell)

    out_frames = []
    for s in range(args.steps):
        t = args.cycle_ms * s / args.steps
        sheet = checkerboard(size, cell=6)
        for i, (frames, acc, total) in enumerate(clips):
            tt = t % total
            idx = next((k for k, e in enumerate(acc) if tt < e), len(frames) - 1)
            im = frames[idx].resize((cell, cell), Image.LANCZOS)
            sheet.paste(im, ((i % cols) * cell, (i // cols) * cell), im)
        out_frames.append(sheet.convert("P", palette=Image.ADAPTIVE, colors=128))

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    dur = int(round(args.cycle_ms / args.steps))
    out_frames[0].save(args.out, save_all=True, append_images=out_frames[1:],
                       duration=dur, loop=0, optimize=True)
    print(f"make_animated_sheet: {len(names)} emoji, {args.steps} steps "
          f"@{dur}ms -> {args.out} ({os.path.getsize(args.out)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
