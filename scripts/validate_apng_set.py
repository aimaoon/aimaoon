#!/usr/bin/env python3
"""§11-2 APNG40個の単体検査。

使い方:
  python3 scripts/validate_apng_set.py <APNG_DIR> --expected-count 40 --strict-standard \
      [--json reports/apng-audit.json] [--frames 20] [--cycle-ms 4000] [--loops 1]

判定は PASS / REVIEW / FAIL / NOT_RUN の4値。
終了コード: 0=FAILなしREVIEWなし / 2=REVIEWのみ / 1=FAILあり / 3=実行エラー
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import apnglib  # noqa: E402

TARGET_BYTES = 285000
HARD_LIMIT_BYTES = 300000
NAME_RE = re.compile(r"^(\d{3})\.png$")

RANK = {"PASS": 0, "NOT_RUN": 1, "REVIEW": 2, "FAIL": 3}


def worst(*vals):
    return max(vals, key=lambda v: RANK[v])


def check_one(path, number, args, frames_root):
    checks = {}

    def put(name, result, detail):
        checks[name] = {"result": result, "detail": detail}

    info = apnglib.ApngInfo(path)

    # 寸法
    ok = (info.width, info.height) == (180, 180)
    put("dimensions", "PASS" if ok else "FAIL", f"{info.width}x{info.height} (expected 180x180)")

    # 形式: PNGカラータイプ6（RGBA）／インターレースなし
    ok = info.is_rgba and info.interlace == 0
    put("format_rgba_no_interlace", "PASS" if ok else "FAIL",
        f"color_type={info.color_type} (expect 6), interlace={info.interlace} (expect 0)")

    # APNG構造
    if not info.has_actl:
        put("apng_structure", "FAIL", "acTL chunk missing (not an APNG)")
    else:
        ok = info.num_frames == args.frames and info.num_plays == args.loops
        put("apng_structure", "PASS" if ok else "FAIL",
            f"num_frames={info.num_frames} (expect {args.frames}), "
            f"num_plays={info.num_plays} (expect {args.loops})")

    # 総再生時間（delay_den=0 は 1/100 秒として解釈する）
    total = info.total_duration_ms
    ok = abs(total - args.cycle_ms) < 1e-9
    put("total_duration_ms", "PASS" if ok else "FAIL",
        f"{total:.3f}ms from {len(info.delays)} fcTL (expect exactly {args.cycle_ms}ms)")

    # フレーム画素の展開
    try:
        frames = apnglib.load_frames(path)
        arrs = apnglib.frames_as_arrays(frames)
    except Exception as exc:                                    # noqa: BLE001
        put("frame_decode", "FAIL", f"decode error: {exc}")
        return checks, "FAIL"
    put("frame_decode", "PASS", f"{len(arrs)} composited frames")

    if len(arrs) != args.frames:
        put("frame_count", "FAIL", f"{len(arrs)} decoded frames (expect {args.frames})")
    else:
        put("frame_count", "PASS", f"{len(arrs)} frames")

    # 固有フレーム数
    hashes = [apnglib.frame_hash(a) for a in arrs]
    uniq = len(set(hashes))
    ok = uniq >= args.frames - 1
    put("unique_frames", "PASS" if ok else "FAIL",
        f"{uniq} unique of {len(arrs)} (expect >= {args.frames - 1})")

    # 連続同一（§11-2 の表に従い2組以上で FAIL。1組は §9-1 が禁じる水増しに当たるため REVIEW）
    adj = sum(1 for a, b in zip(hashes, hashes[1:]) if a == b)
    if adj >= 2:
        put("adjacent_identical", "FAIL", f"{adj} adjacent identical pairs (>=2)")
    elif adj == 1:
        put("adjacent_identical", "REVIEW",
            f"{adj} adjacent identical pair; §9-1 forbids padding such as F19==F20")
    else:
        put("adjacent_identical", "PASS", "0 adjacent identical pairs")

    # 容量の3帯域
    b = info.bytes
    if b > HARD_LIMIT_BYTES:
        put("file_size", "FAIL", f"{b} bytes > {HARD_LIMIT_BYTES}")
    elif b > TARGET_BYTES:
        put("file_size", "REVIEW", f"{b} bytes in {TARGET_BYTES + 1}..{HARD_LIMIT_BYTES}")
    else:
        put("file_size", "PASS", f"{b} bytes <= {TARGET_BYTES}")

    # 透明画素の RGB
    bad = [i + 1 for i, a in enumerate(arrs) if not apnglib.transparent_rgb_clean(a)]
    put("transparent_rgb_zero", "PASS" if not bad else "REVIEW",
        "all alpha==0 pixels have RGB=0" if not bad else f"frames with non-zero RGB: {bad[:10]}")

    # メタデータ
    put("no_metadata", "PASS" if not info.meta_chunks else "REVIEW",
        "none" if not info.meta_chunks else f"present: {info.meta_chunks}")

    # DPI（§10 の必須確認項目。pHYs が無ければ判定不能）
    dpi = info.dpi
    if dpi is None:
        put("dpi", "NOT_RUN", "no pHYs chunk with unit=meter; dpi cannot be determined from file")
    else:
        put("dpi", "PASS" if min(dpi) >= 71.9 else "REVIEW", f"{dpi[0]:.2f}x{dpi[1]:.2f} dpi")

    # 安全域（allow_stage_exit の項目は呼び出し側で除外する）
    margins = [apnglib.min_edge_margin(a) for a in arrs]
    empty = [i + 1 for i, m in enumerate(margins) if m is None]
    real = [m for m in margins if m is not None]
    if empty:
        put("safe_area", "FAIL", f"frames with no visible pixels: {empty[:10]}")
    else:
        mn = min(real)
        put("safe_area", "PASS" if mn >= args.safe_area else "FAIL",
            f"min edge margin {mn}px (expect >= {args.safe_area})")

    # ラウンドトリップ（元フレームが OUTPUT/frames/NNN/ に無ければ NOT_RUN）
    src_dir = os.path.join(frames_root, number) if frames_root else None
    if not src_dir or not os.path.isdir(src_dir):
        put("roundtrip", "NOT_RUN", f"source frames not found at {src_dir or '(unset)'}")
    else:
        from PIL import Image
        names = sorted(n for n in os.listdir(src_dir) if n.lower().endswith(".png"))
        if len(names) != len(arrs):
            put("roundtrip", "FAIL", f"{len(names)} source frames vs {len(arrs)} decoded")
        else:
            src = [Image.open(os.path.join(src_dir, n)).convert("RGBA") for n in names]
            d, err = apnglib.roundtrip_max_diff(src, path)
            if err:
                put("roundtrip", "FAIL", err)
            else:
                put("roundtrip", "PASS" if d <= 1 else "FAIL", f"max pixel diff {d} (allow <= 1)")

    result = "PASS"
    for c in checks.values():
        result = worst(result, c["result"])
    return checks, result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("apng_dir")
    ap.add_argument("--expected-count", type=int, default=40)
    ap.add_argument("--strict-standard", action="store_true")
    ap.add_argument("--json")
    ap.add_argument("--frames", type=int, default=20)
    ap.add_argument("--cycle-ms", type=int, default=4000)
    ap.add_argument("--loops", type=int, default=1)
    ap.add_argument("--safe-area", type=int, default=8)
    ap.add_argument("--frames-root", default="OUTPUT/frames",
                    help="ラウンドトリップ照合用の元フレーム置き場")
    args = ap.parse_args()

    if not os.path.isdir(args.apng_dir):
        print(f"ERROR: not a directory: {args.apng_dir}", file=sys.stderr)
        return 3

    present = sorted(n for n in os.listdir(args.apng_dir) if NAME_RE.match(n))
    expected = [f"{i:03d}.png" for i in range(1, args.expected_count + 1)]
    missing = [n for n in expected if n not in present]
    extra = [n for n in present if n not in expected]

    items, summary_counts = [], {"PASS": 0, "REVIEW": 0, "FAIL": 0, "NOT_RUN": 0}
    seq_result = "PASS" if (not missing and not extra) else "FAIL"

    for name in present:
        number = name[:3]
        try:
            checks, result = check_one(os.path.join(args.apng_dir, name), number,
                                       args, args.frames_root)
        except Exception as exc:                                # noqa: BLE001
            checks = {"open": {"result": "FAIL", "detail": f"{type(exc).__name__}: {exc}"}}
            result = "FAIL"
        items.append({"number": number, "checks": checks, "result": result})
        summary_counts[result] += 1

    out = {
        "items": items,
        "summary": {
            "apng_dir": args.apng_dir,
            "expected_count": args.expected_count,
            "found": len(present),
            "missing": missing,
            "extra": extra,
            "sequence_result": seq_result,
            "counts": summary_counts,
            "strict_standard": bool(args.strict_standard),
            "frames": args.frames, "cycle_ms": args.cycle_ms, "loops": args.loops,
        },
    }
    if args.json:
        os.makedirs(os.path.dirname(os.path.abspath(args.json)), exist_ok=True)
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"validate_apng_set: {len(present)} files in {args.apng_dir}")
    print(f"  sequence: {seq_result} (missing={len(missing)} extra={len(extra)})")
    print("  " + " ".join(f"{k}={v}" for k, v in summary_counts.items()))
    shown = 0
    for it in items:
        if it["result"] in ("FAIL", "REVIEW") and shown < 10:
            bad = [f"{k}={v['result']}" for k, v in it["checks"].items()
                   if v["result"] in ("FAIL", "REVIEW")]
            print(f"  {it['number']}: {it['result']} :: {', '.join(bad)}")
            shown += 1

    if seq_result == "FAIL" or summary_counts["FAIL"]:
        return 1
    if summary_counts["REVIEW"]:
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:                                     # noqa: BLE001
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(3)
