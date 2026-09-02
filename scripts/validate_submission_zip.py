#!/usr/bin/env python3
"""§11-3 提出ZIPの検査。ZIP内の実体に対して §11-2 と同じ検査を再実行する。

使い方:
  python3 scripts/validate_submission_zip.py LINE_READY.zip --expected-count 40 \
      --strict-standard --manifest-mode <emoji_main|emoji_tab|custom> \
      [--extra-file main.png:180x180] [--json reports/submission-zip-audit.json]

終了コード: 0=FAILなしREVIEWなし / 2=REVIEWのみ / 1=FAILあり / 3=実行エラー
"""
import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import zipfile
from types import SimpleNamespace

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import apnglib  # noqa: E402
from validate_apng_set import check_one, RANK  # noqa: E402

NAME_RE = re.compile(r"^(\d{3})\.png$")
MAX_ZIP_BYTES = 20 * 1024 * 1024
JUNK_NAMES = {".DS_Store", "Thumbs.db", "desktop.ini"}

# --manifest-mode ごとの既定の静止画像。寸法は --extra-file で上書きできる。
# emoji_main の 180x180 は第2-2節が未確定のための暫定値であり、公式確認済みの値ではない。
MODE_DEFAULTS = {
    "emoji_main": [("main.png", (180, 180))],
    "emoji_tab": [("tab.png", (96, 74))],
    "custom": [],
}


def parse_extra(spec):
    m = re.match(r"^([^:]+):(\d+)x(\d+)$", spec)
    if not m:
        raise argparse.ArgumentTypeError(f"--extra-file expects NAME:WxH, got {spec!r}")
    return m.group(1), (int(m.group(2)), int(m.group(3)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("zip_path")
    ap.add_argument("--expected-count", type=int, default=40)
    ap.add_argument("--strict-standard", action="store_true")
    ap.add_argument("--manifest-mode", required=True,
                    choices=["emoji_main", "emoji_tab", "custom"])
    ap.add_argument("--extra-file", action="append", type=parse_extra, default=[])
    ap.add_argument("--json")
    ap.add_argument("--frames", type=int, default=20)
    ap.add_argument("--cycle-ms", type=int, default=4000)
    ap.add_argument("--loops", type=int, default=1)
    ap.add_argument("--safe-area", type=int, default=8)
    ap.add_argument("--spec-snapshot", default="reports/spec-snapshot.md")
    args = ap.parse_args()

    if args.manifest_mode == "custom" and not args.extra_file:
        print("ERROR: --manifest-mode custom requires at least one --extra-file NAME:WxH",
              file=sys.stderr)
        return 3
    if not os.path.isfile(args.zip_path):
        print(f"ERROR: no such file: {args.zip_path}", file=sys.stderr)
        return 3

    zip_checks = {}

    def put(name, result, detail):
        zip_checks[name] = {"result": result, "detail": detail}

    size = os.path.getsize(args.zip_path)
    put("zip_size", "PASS" if size <= MAX_ZIP_BYTES else "FAIL",
        f"{size} bytes (limit {MAX_ZIP_BYTES})")

    try:
        zf = zipfile.ZipFile(args.zip_path)
    except zipfile.BadZipFile as exc:
        put("zip_open", "FAIL", f"BadZipFile: {exc}")
        summary = {"counts": {"FAIL": 1}, "result": "FAIL"}
        print("validate_submission_zip: FAIL (unreadable zip)")
        return 1
    put("zip_open", "PASS", "opened")

    bad = zf.testzip()
    put("zip_testzip", "PASS" if bad is None else "FAIL",
        "None" if bad is None else f"first bad file: {bad}")

    infos = zf.infolist()
    names = [i.filename for i in infos]

    dir_entries = [i.filename for i in infos if i.is_dir()]
    nested = [n for n in names if "/" in n.rstrip("/")]
    put("flat_layout", "PASS" if not dir_entries and not nested else "FAIL",
        f"dir_entries={dir_entries[:5]} nested={nested[:5]}")

    junk = [n for n in names
            if n.startswith("__MACOSX/") or os.path.basename(n) in JUNK_NAMES
            or os.path.basename(n).startswith(".")]
    put("no_junk_files", "PASS" if not junk else "FAIL",
        "none" if not junk else f"{junk[:8]}")

    expected_static = list(MODE_DEFAULTS[args.manifest_mode])
    for nm, dims in args.extra_file:                 # --extra-file は既定を上書き/追加する
        expected_static = [(n, d) for (n, d) in expected_static if n != nm] + [(nm, dims)]

    expected_seq = [f"{i:03d}.png" for i in range(1, args.expected_count + 1)]
    expected_all = expected_seq + [n for n, _ in expected_static]
    flat = [os.path.basename(n) for n in names if not n.endswith("/")]
    missing = [n for n in expected_all if n not in flat]
    extra = [n for n in flat if n not in expected_all]
    put("file_manifest", "PASS" if not missing and not extra else "FAIL",
        f"expected {len(expected_all)} files; missing={missing[:8]} extra={extra[:8]}")
    put("file_count", "PASS" if len(flat) == len(expected_all) else "FAIL",
        f"{len(flat)} entries (expect {len(expected_all)} = {args.expected_count} + "
        f"{len(expected_static)} static)")

    non_png = [n for n in flat if not n.lower().endswith(".png")]
    put("png_only", "PASS" if not non_png else "FAIL",
        "none" if not non_png else f"{non_png[:8]}")

    # 第2-2節が未確定のまま PASS を出さない
    snap = args.spec_snapshot
    if os.path.isfile(snap):
        text = open(snap, encoding="utf-8").read()
        undetermined = "spec_verified: false" in text or "status: UNDETERMINED" in text
        put("submission_files_determined", "REVIEW" if undetermined else "PASS",
            f"{snap}: submission_files/spec still unverified; ZIP must not be treated as final"
            if undetermined else f"{snap}: spec verified")
    else:
        put("submission_files_determined", "NOT_RUN", f"{snap} not found")

    tmp = tempfile.mkdtemp(prefix="zipcheck-")
    items = []
    try:
        zf.extractall(tmp)
        sub = SimpleNamespace(frames=args.frames, cycle_ms=args.cycle_ms, loops=args.loops,
                              safe_area=args.safe_area)
        for name in sorted(n for n in flat if NAME_RE.match(n)):
            p = os.path.join(tmp, name)
            try:
                checks, result = check_one(p, name[:3], sub, None)
            except Exception as exc:                            # noqa: BLE001
                checks = {"open": {"result": "FAIL", "detail": f"{type(exc).__name__}: {exc}"}}
                result = "FAIL"
            items.append({"number": name[:3], "checks": checks, "result": result})

        # 静止画像は単一フレームPNGであること（APNGでないこと）
        for nm, dims in expected_static:
            p = os.path.join(tmp, nm)
            if not os.path.isfile(p):
                put(f"static:{nm}", "FAIL", "missing")
                continue
            info = apnglib.ApngInfo(p)
            probs = []
            if info.has_actl:
                probs.append("has acTL (is an APNG)")
            if (info.width, info.height) != dims:
                probs.append(f"{info.width}x{info.height} != {dims[0]}x{dims[1]}")
            put(f"static:{nm}", "PASS" if not probs else "FAIL",
                "single-frame PNG with expected size" if not probs else "; ".join(probs))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
        zf.close()

    counts = {"PASS": 0, "REVIEW": 0, "FAIL": 0, "NOT_RUN": 0}
    for c in zip_checks.values():
        counts[c["result"]] += 1
    item_counts = {"PASS": 0, "REVIEW": 0, "FAIL": 0, "NOT_RUN": 0}
    for it in items:
        item_counts[it["result"]] += 1

    overall = "PASS"
    for c in list(zip_checks.values()) + [{"result": it["result"]} for it in items]:
        if RANK[c["result"]] > RANK[overall]:
            overall = c["result"]

    out = {"zip": args.zip_path, "manifest_mode": args.manifest_mode,
           "zip_checks": zip_checks, "items": items,
           "summary": {"zip_check_counts": counts, "item_counts": item_counts,
                       "result": overall, "expected_files": expected_all}}
    if args.json:
        os.makedirs(os.path.dirname(os.path.abspath(args.json)), exist_ok=True)
        with open(args.json, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"validate_submission_zip: {args.zip_path} mode={args.manifest_mode}")
    print("  zip checks: " + " ".join(f"{k}={v}" for k, v in counts.items()))
    print("  items:      " + " ".join(f"{k}={v}" for k, v in item_counts.items()))
    for k, v in zip_checks.items():
        if v["result"] in ("FAIL", "REVIEW"):
            print(f"  {k}: {v['result']} :: {v['detail']}")

    if counts["FAIL"] or item_counts["FAIL"]:
        return 1
    if counts["REVIEW"] or item_counts["REVIEW"] or counts["NOT_RUN"] or item_counts["NOT_RUN"]:
        return 2
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:                                     # noqa: BLE001
        print(f"ERROR: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(3)
