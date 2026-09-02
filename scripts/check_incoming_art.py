#!/usr/bin/env python3
"""受領した原画が発注仕様を満たすかを検査する（モードDの受け入れ検査）。

  python3 scripts/check_incoming_art.py <PNG...> [--expect-size 720]
  python3 scripts/check_incoming_art.py poses/001/*.png --json reports/incoming-art-audit.json

style-lock.json の配色・寸法・安全域を基準に、透過／配色逸脱／ざらつき／寸法／
本体サイズ／安全域を機械検査する。焼き込み文字の有無は自動判定できないため NOT_RUN とし、
目視で確認する項目として報告する。

終了コード: 0=FAILなしREVIEWなし / 2=REVIEWのみ / 1=FAILあり / 3=実行エラー
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
RANK = {"PASS": 0, "NOT_RUN": 1, "REVIEW": 2, "FAIL": 3}

# パレット外と判定する色差のしきい値（各チャンネルの最大差）。
# アンチエイリアスの中間色は許容するため、面として支配的かどうかで判定する。
COLOR_TOL = 28
# 不透明部のユニーク色数がこれを超えたら、フラット描画ではなくテクスチャが残っている。
# フラットな10色描画ならアンチエイリアスを含めても数百程度に収まる。
TEXTURE_UNIQUE_LIMIT = 1200
TEXTURE_REVIEW_LIMIT = 400


def worst(*v):
    return max(v, key=lambda x: RANK[x])


def load_lock():
    with open(os.path.join(ROOT, "style-lock.json"), encoding="utf-8") as f:
        lock = json.load(f)
    pal = {**lock["base_colors"], **lock["effect_colors"]}
    rgb = np.array([[int(v[1:3], 16), int(v[3:5], 16), int(v[5:7], 16)]
                    for v in pal.values()], dtype=np.int16)
    return lock, list(pal.keys()), rgb


def check(path, lock, names, palette, expect_size, safe_ratio):
    checks = {}

    def put(k, r, d):
        checks[k] = {"result": r, "detail": d}

    im = Image.open(path)
    put("format", "PASS" if im.format == "PNG" else "FAIL", f"format={im.format}")

    has_alpha = im.mode in ("RGBA", "LA") or "transparency" in im.info
    a = np.array(im.convert("RGBA"))
    alpha = a[..., 3]
    if not has_alpha or alpha.min() == 255:
        put("transparency", "FAIL",
            f"mode={im.mode}, alpha min={int(alpha.min())} — 透過が無い")
    else:
        corners = [alpha[0, 0], alpha[0, -1], alpha[-1, 0], alpha[-1, -1]]
        ratio = float((alpha == 0).mean())
        if max(corners) > 8:
            put("transparency", "FAIL",
                f"四隅のalpha={[int(c) for c in corners]} — 背景が透過していない")
        else:
            put("transparency", "PASS",
                f"透過画素 {ratio:.1%}, 四隅alpha={[int(c) for c in corners]}")

    put("dimensions", "PASS" if im.size == (expect_size, expect_size) else "FAIL",
        f"{im.width}x{im.height} (expect {expect_size}x{expect_size})")

    opaque = alpha > 200
    if not opaque.any():
        put("content", "FAIL", "不透明画素が無い")
        return checks, "FAIL"
    px = a[..., :3][opaque].astype(np.int16)

    uniq = len(np.unique(px, axis=0))
    if uniq > TEXTURE_UNIQUE_LIMIT:
        put("flat_rendering", "FAIL",
            f"不透明部のユニーク色数 {uniq} > {TEXTURE_UNIQUE_LIMIT} — "
            f"粒状テクスチャが残っている（フラット描画ではない）")
    elif uniq > TEXTURE_REVIEW_LIMIT:
        put("flat_rendering", "REVIEW",
            f"不透明部のユニーク色数 {uniq}（目安 <= {TEXTURE_REVIEW_LIMIT}）")
    else:
        put("flat_rendering", "PASS", f"不透明部のユニーク色数 {uniq}")

    # パレット適合: 各画素を最も近いロック色と比べ、許容差を超える画素の割合
    d = np.abs(px[:, None, :] - palette[None, :, :]).max(axis=2).min(axis=1)
    off = float((d > COLOR_TOL).mean())
    if off > 0.15:
        put("palette", "FAIL",
            f"パレット外の画素 {off:.1%} > 15%（許容差 ±{COLOR_TOL}/ch）")
    elif off > 0.05:
        put("palette", "REVIEW", f"パレット外の画素 {off:.1%}（許容差 ±{COLOR_TOL}/ch）")
    else:
        put("palette", "PASS", f"パレット外の画素 {off:.1%}")

    # 安全域と本体サイズ
    ys, xs = np.where(alpha > 8)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    margin = min(x0, y0, im.width - 1 - x1, im.height - 1 - y1)
    need = int(round(im.height * safe_ratio))
    put("safe_area", "PASS" if margin >= need else "FAIL",
        f"最小余白 {margin}px (expect >= {need}px)")

    sl = lock["size_lock"]
    scale = expect_size / 180.0
    th = sl["target_character_height_px"] * scale
    tw = sl["target_character_width_px"] * scale
    h, w = y1 - y0 + 1, x1 - x0 + 1
    hd = abs(h - th) / th * 100
    wd = abs(w - tw) / tw * 100
    tol = sl["tolerances"]["height_pct"]
    # 小物やエフェクトを含む外接矩形なので、超過側は REVIEW に留める
    put("body_size", "PASS" if hd <= tol and wd <= tol else "REVIEW",
        f"外接矩形 {w}x{h}px, 目標 {tw:.0f}x{th:.0f}px, ずれ 幅{wd:.1f}% 高{hd:.1f}% "
        f"(許容 ±{tol}%。小物込みの矩形のため超過は要目視)")

    put("no_baked_text", "NOT_RUN",
        "画像内の文字の有無は自動判定できない。previews のコンタクトシートで目視する")

    r = "PASS"
    for c in checks.values():
        r = worst(r, c["result"])
    return checks, r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+")
    ap.add_argument("--expect-size", type=int, default=720)
    ap.add_argument("--safe-ratio", type=float, default=8 / 180.0,
                    help="安全域が画像の高さに占める割合（既定 8/180）")
    ap.add_argument("--json")
    args = ap.parse_args()

    lock, names, palette = load_lock()
    items, counts = [], {"PASS": 0, "REVIEW": 0, "FAIL": 0, "NOT_RUN": 0}
    for p in args.images:
        if not os.path.isfile(p):
            items.append({"path": p, "result": "FAIL",
                          "checks": {"open": {"result": "FAIL", "detail": "no such file"}}})
            counts["FAIL"] += 1
            continue
        try:
            checks, r = check(p, lock, names, palette, args.expect_size, args.safe_ratio)
        except Exception as exc:                                # noqa: BLE001
            checks = {"open": {"result": "FAIL", "detail": f"{type(exc).__name__}: {exc}"}}
            r = "FAIL"
        items.append({"path": p, "result": r, "checks": checks})
        counts[r] += 1

    if args.json:
        os.makedirs(os.path.dirname(os.path.abspath(args.json)), exist_ok=True)
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump({"items": items, "summary": {"counts": counts,
                                                   "palette": names,
                                                   "expect_size": args.expect_size}},
                      f, ensure_ascii=False, indent=2)

    print(f"check_incoming_art: {len(items)} images")
    print("  " + " ".join(f"{k}={v}" for k, v in counts.items()))
    for it in items:
        if it["result"] != "PASS":
            print(f"  {os.path.basename(it['path'])}: {it['result']}")
            for k, v in it["checks"].items():
                if v["result"] in ("FAIL", "REVIEW"):
                    print(f"      {k}: {v['result']} :: {v['detail']}")
    if counts["FAIL"]:
        return 1
    if counts["REVIEW"] or counts["NOT_RUN"]:
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:                                     # noqa: BLE001
        import traceback
        traceback.print_exc()
        sys.exit(3)
