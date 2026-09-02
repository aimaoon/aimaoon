#!/usr/bin/env python3
"""§11-4 検査スクリプトの自己テスト。

既知の不良データに対して検査が期待どおり FAIL / REVIEW を返すことを確認する。
「常に PASS を返す実装」になっていないことを先に証明するためのもので、
これに通らないスクリプトは検査に使ってはならない。

  python3 scripts/selftest_validators.py
出力: reports/validator-selftest.txt
終了コード: 0=全ケース期待どおり / 1=期待と異なるケースあり / 3=実行エラー
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from types import SimpleNamespace

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import apnglib  # noqa: E402
from validate_apng_set import check_one  # noqa: E402

W = H = 180
SAFE_RECT = (20, 30, 160, 170)   # ノイズを置いてよい範囲（安全域8pxの内側）
ANCHOR_ROI = [30, 120, 24, 20]   # 静止ブロックの位置


def base_frames(n=20, jitter_px=0, edge_frame=None, identical=False):
    """静止アンカーブロック + 上下に動くブロック の合成フレームを作る。"""
    frames = []
    for i in range(n):
        a = np.zeros((H, W, 4), np.uint8)
        # 静止アンカー（jitter_px を与えると毎フレーム左右へずれる）
        dx = (jitter_px if i % 2 else -jitter_px)
        x = ANCHOR_ROI[0] + dx
        a[ANCHOR_ROI[1]:ANCHOR_ROI[1] + ANCHOR_ROI[3], x:x + ANCHOR_ROI[2]] = (31, 94, 82, 255)
        # 可動ブロック（identical のときは動かさない）。
        # 正弦波だと折り返しで同じ座標が再出現し固有フレーム数が20を割るため、
        # 20フレームすべてで異なる位置になる単調な傾きを使う。
        top = 40 if identical else 12 + i * 3
        a[top:top + 36, 100:140] = (255, 106, 43, 255)
        if edge_frame is not None and i == edge_frame:
            # 端から3pxの位置へ寄せたブロックを1フレームだけ置く
            a[3:20, 3:20] = (226, 69, 58, 255)
        frames.append(Image.fromarray(a))
    return frames


def even_durations(n=20, total=4000):
    d = [total // n] * n
    d[0] += total - sum(d)
    # 均等を避け、合計は維持する
    d[0] -= 40
    d[1] += 40
    return d


def build(path, frames, durations, loop=1, dpi=(72, 72)):
    apnglib.write_apng(frames, durations, path, loop=loop, dpi=dpi)
    return path


def build_sized(path, lo, hi):
    """ファイルサイズが (lo, hi] に入る 20フレーム・4000ms のAPNGを作る。"""
    x0, y0, x1, y1 = SAFE_RECT
    capacity = (x1 - x0) * (y1 - y0)
    rng = np.random.default_rng(7)

    def make(npix):
        frames = []
        for i in range(20):
            a = np.zeros((H, W, 4), np.uint8)
            a[ANCHOR_ROI[1]:ANCHOR_ROI[1] + ANCHOR_ROI[3],
              ANCHOR_ROI[0]:ANCHOR_ROI[0] + ANCHOR_ROI[2]] = (31, 94, 82, 255)
            if npix > 0:
                flat = np.zeros((capacity, 4), np.uint8)
                k = min(npix, capacity)
                flat[:k, :3] = rng.integers(0, 256, size=(k, 3), dtype=np.uint8)
                flat[:k, 3] = 255
                a[y0:y1, x0:x1] = flat.reshape(y1 - y0, x1 - x0, 4)
            frames.append(Image.fromarray(a))
        build(path, frames, even_durations())
        return os.path.getsize(path)

    left, right = 0, capacity
    best = None
    for _ in range(24):
        mid = (left + right) // 2
        size = make(mid)
        if size <= lo:
            left = mid + 1
        elif size > hi:
            right = mid - 1
        else:
            best = (mid, size)
            break
        if left > right:
            break
    if best is None:
        size = make(min(max(left, 0), capacity))
        best = (left, size)
    return best[1]


class Case:
    def __init__(self, name, expect, got, detail):
        self.name, self.expect, self.got, self.detail = name, expect, got, detail

    @property
    def ok(self):
        return self.expect == self.got


def apng_check(path, name, frames_root=None):
    args = SimpleNamespace(frames=20, cycle_ms=4000, loops=1, safe_area=8)
    return check_one(path, name, args, frames_root)


def jitter_run(tmp, apng_dir, cfg_path, items=None):
    cmd = [sys.executable, os.path.join(HERE, "check_apng_jitter.py"), apng_dir,
           "--config", cfg_path, "--output-dir", os.path.join(tmp, "jitter")]
    if items:
        cmd += ["--items", items]
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, p.stdout + p.stderr


def main():
    tmp = tempfile.mkdtemp(prefix="selftest-")
    cases = []
    try:
        good_dir = os.path.join(tmp, "good")
        os.makedirs(good_dir)

        # --- 1. 正常なAPNG
        good = os.path.join(good_dir, "001.png")
        gframes = base_frames()
        build(good, gframes, even_durations())
        # ラウンドトリップ照合用の元フレーム
        fr_root = os.path.join(tmp, "frames")
        os.makedirs(os.path.join(fr_root, "001"))
        for i, f in enumerate(gframes):
            f.save(os.path.join(fr_root, "001", f"{i + 1:02d}.png"))
        checks, result = apng_check(good, "001", fr_root)
        cases.append(Case("正常な20フレーム・4000ms・loop1・180px", "PASS", result,
                          json.dumps({k: v["result"] for k, v in checks.items()},
                                     ensure_ascii=False)))

        # 固定マスク（静止アンカーだけを白にする）
        mask = np.zeros((H, W), np.uint8)
        mask[ANCHOR_ROI[1]:ANCHOR_ROI[1] + ANCHOR_ROI[3],
             ANCHOR_ROI[0]:ANCHOR_ROI[0] + ANCHOR_ROI[2]] = 255
        mask_path = os.path.join(tmp, "fixed.png")
        Image.fromarray(mask).save(mask_path)

        cfg = {"defaults": {"anchor_search_px": 8, "max_anchor_range_px": 1.0,
                            "max_mean_fixed_displacement_px": 0.5, "safe_area_px": 8,
                            "alpha_threshold": 8, "jitter_step_ratio": 4.0,
                            "jitter_step_min_px": 2.0, "match_confidence_min": 0.90},
               "items": {"001": {"anchor_roi": ANCHOR_ROI, "horizontal_anchor": "block",
                                 "allow_horizontal_travel": False, "allow_stage_exit": False,
                                 "fixed_mask": mask_path, "expected_anchor_path": None,
                                 "safe_area_px": 8}}}
        cfg_path = os.path.join(tmp, "anchor.json")
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump(cfg, f)
        rc, out = jitter_run(tmp, good_dir, cfg_path)
        cases.append(Case("正常なAPNG（check_apng_jitter）", 0, rc, out.strip().replace("\n", " / ")))

        # --- 2. 19フレーム
        p = os.path.join(tmp, "f19.png")
        build(p, base_frames(19), even_durations(19))
        checks, _ = apng_check(p, "002")
        cases.append(Case("19フレームのAPNG（フレーム数）", "FAIL",
                          checks["apng_structure"]["result"], checks["apng_structure"]["detail"]))

        # --- 3. 合計3960ms
        p = os.path.join(tmp, "d3960.png")
        build(p, base_frames(), even_durations(20, 3960))
        checks, _ = apng_check(p, "003")
        cases.append(Case("合計3960msのAPNG（総再生時間）", "FAIL",
                          checks["total_duration_ms"]["result"],
                          checks["total_duration_ms"]["detail"]))

        # --- 4. num_plays=2
        p = os.path.join(tmp, "plays2.png")
        build(p, base_frames(), even_durations(), loop=2)
        checks, _ = apng_check(p, "004")
        cases.append(Case("num_plays=2のAPNG（ループ数）", "FAIL",
                          checks["apng_structure"]["result"], checks["apng_structure"]["detail"]))

        # --- 5. 全フレーム同一
        p = os.path.join(tmp, "same.png")
        build(p, base_frames(identical=True), even_durations())
        checks, _ = apng_check(p, "005")
        cases.append(Case("全フレーム同一のAPNG（固有フレーム数）", "FAIL",
                          checks["unique_frames"]["result"], checks["unique_frames"]["detail"]))

        # --- 6. アンカーを毎フレーム±2pxずらす
        jd = os.path.join(tmp, "jit")
        os.makedirs(jd)
        build(os.path.join(jd, "001.png"), base_frames(jitter_px=2), even_durations())
        rc, out = jitter_run(tmp, jd, cfg_path)
        cases.append(Case("アンカーを毎フレーム±2pxずらしたAPNG（横位置レンジ）", 1, rc,
                          out.strip().replace("\n", " / ")))

        # --- 7. 1フレームだけ端から3px
        p = os.path.join(tmp, "edge.png")
        build(p, base_frames(edge_frame=7), even_durations())
        checks, _ = apng_check(p, "007")
        cases.append(Case("1フレームだけ端から3pxまで寄せたAPNG（安全域）", "FAIL",
                          checks["safe_area"]["result"], checks["safe_area"]["detail"]))

        # --- 8. 310,000 bytes 相当
        p = os.path.join(tmp, "big.png")
        sz = build_sized(p, 300_000, 340_000)
        checks, _ = apng_check(p, "008")
        cases.append(Case("300,000 bytes 超のPNG（容量）", "FAIL",
                          checks["file_size"]["result"], f"{sz} bytes :: "
                          + checks["file_size"]["detail"]))

        # --- 9. 290,000 bytes 相当
        p = os.path.join(tmp, "mid.png")
        sz = build_sized(p, 285_000, 300_000)
        checks, _ = apng_check(p, "009")
        cases.append(Case("285,001〜300,000 bytes のPNG（容量）", "REVIEW",
                          checks["file_size"]["result"], f"{sz} bytes :: "
                          + checks["file_size"]["detail"]))

        # --- 10. __MACOSX/ を含むZIP
        zp = os.path.join(tmp, "bad.zip")
        with zipfile.ZipFile(zp, "w") as z:
            for i in range(1, 41):
                z.write(good, f"{i:03d}.png")
            m = Image.fromarray(np.zeros((180, 180, 4), np.uint8))
            mp = os.path.join(tmp, "main.png")
            m.save(mp)
            z.write(mp, "main.png")
            z.writestr("__MACOSX/._001.png", b"junk")
        pr = subprocess.run([sys.executable, os.path.join(HERE, "validate_submission_zip.py"),
                             zp, "--expected-count", "40", "--strict-standard",
                             "--manifest-mode", "emoji_main",
                             "--spec-snapshot", "/nonexistent"],
                            capture_output=True, text=True)
        cases.append(Case("__MACOSX/ を含むZIP（validate_submission_zip）", 1, pr.returncode,
                          (pr.stdout + pr.stderr).strip().replace("\n", " / ")))

        # --- 出力
        os.makedirs(os.path.join(ROOT, "reports"), exist_ok=True)
        lines = ["# validator selftest (§11-4)", "",
                 "`python3 scripts/selftest_validators.py` の出力。",
                 "既知の不良データに対して検査が期待どおり FAIL / REVIEW を返すことの確認である。", "",
                 "| # | フィクスチャ | 期待 | 実際 | 判定 |", "|---:|---|---|---|---|"]
        for i, c in enumerate(cases, 1):
            lines.append(f"| {i} | {c.name} | `{c.expect}` | `{c.got}` | "
                         f"{'OK' if c.ok else 'MISMATCH'} |")
        lines += ["", "## 各ケースの詳細", ""]
        for i, c in enumerate(cases, 1):
            # 一時ディレクトリ名は実行ごとに変わるため、差分ノイズを避けて正規化する
            detail = c.detail.replace(tmp, "<tmp>")
            lines += [f"### {i}. {c.name}", "", "```", detail[:1500], "```", ""]
        npass = sum(1 for c in cases if c.ok)
        lines += ["## 集計", "",
                  f"{npass}/{len(cases)} ケースが期待どおり。",
                  "", "期待どおり FAIL しないスクリプトは検査に使ってはならない（§11-4）。", ""]
        with open(os.path.join(ROOT, "reports", "validator-selftest.txt"), "w",
                  encoding="utf-8") as f:
            f.write("\n".join(lines))

        for i, c in enumerate(cases, 1):
            print(f"{'OK  ' if c.ok else 'MISS'} {i:2d}. {c.name}: expect={c.expect} got={c.got}")
        print(f"{npass}/{len(cases)} as expected")
        return 0 if npass == len(cases) else 1
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:                                     # noqa: BLE001
        import traceback
        traceback.print_exc()
        sys.exit(3)
