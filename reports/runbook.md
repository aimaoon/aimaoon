# 実行順（原画到着後）

原画が `poses/` へ届いた時点から、この順で実行する。各段階の合格を確認してから次へ進む。
中断した場合は `reports/progress.json` の sha256 と実ファイルを照合して再開する（§13）。

## 0. 事前（原画なしで実行可能。実行済み）

```bash
python3 scripts/make_emoji_plan.py        # emoji-plan.json / reports/anchor-config.json
python3 scripts/check_plan_gates.py       # uniqueness-matrix.csv / collision-report.md
python3 scripts/make_design_audit.py      # design-quality-audit.csv / implementation-gates
python3 scripts/make_pose_order.py        # asset-order.md / pose-manifest.csv
python3 scripts/selftest_validators.py    # validator-selftest.txt（検査系の健全性）
```

## 1. 基準キャラクターの承認ゲート（§6）

`character-master.png` を1枚だけ受け取り、`design-brief.md` の造形・配色・視覚的フックと
照合して承認する。**承認前に他の原画を量産しない。**

## 2. ポーズ受け入れ（§8）

2×2シートで届いた場合:

```bash
python3 scripts/split_pose_sheet.py <sheet.png> --number 001 --roles P1,P2,P3,P4 --gutter 24
```

ポーズストリップを作り、実際に画像を開いて §8-3 のゲートを確認する:

```bash
python3 scripts/make_pose_strip.py poses/001 --out previews/pose-strips/001.png --sizes 180,32
```

`reports/pose-manifest.csv` の `approval` を `approved` へ更新する。
01〜32 は6枚未満、または `generated_from_single_warp=true` が1件でもあれば次へ進まない。

## 3. 第1フレーム40枚（§4）

`OUTPUT/first_frames/NNN.png` を揃えてから:

```bash
python3 scripts/make_contact_sheet.py OUTPUT/first_frames --cols 8 --cell 180 --label \
  --out previews/first-frames-180.png
python3 scripts/make_contact_sheet.py OUTPUT/first_frames --cols 8 --cell 32 --scale-to 32 \
  --out previews/first-frames-32.png
```

両方を実際に開いて確認する。ファイル名を隠した状態で感情が読めるかを見る。

## 4. 中割りとAPNG化（§9）

`OUTPUT/frames/NNN/` に20枚を揃えてから、4個ずつのバッチで:

```bash
python3 scripts/build_apng.py 001 002 003 004
```

`reports/compression-audit.csv` の `roundtrip_result` が全件 `PASS` であること。
`PASS` でない項目は完成扱いにしない。

## 5. 検査（§11）

```bash
python3 scripts/validate_apng_set.py OUTPUT/final --expected-count 40 --strict-standard \
  --json reports/apng-audit.json
python3 scripts/check_apng_jitter.py OUTPUT/final --config reports/anchor-config.json \
  --output-dir reports/jitter
python3 scripts/make_peak_compare.py OUTPUT/final/001.png --out previews/peak/001.png
python3 scripts/make_animated_sheet.py OUTPUT/final --cols 8 --cell 90 \
  --out previews/animated-contact-sheet.gif
```

`REVIEW` / `FAIL` の項目は、`reports/jitter/NNN-transitions.csv` が示すフレームペアを
180pxと32pxの両方で目視する（§0-2）。

## 6. 提出物（§10）

**先に第2-2節（`main.png` / `tab.png` の構成）を確定させること。** 未確定のまま実行しても
`validate_submission_zip.py` は `submission_files_determined` を `REVIEW` にし、PASS を返さない。

```bash
rm -f LINE_READY.zip
mkdir -p build/zip && rm -f build/zip/*
cp OUTPUT/final/0*.png build/zip/
cp OUTPUT/final/<main_or_tab>.png build/zip/
(cd build/zip && zip -X -q ../../LINE_READY.zip *.png)
unzip -l LINE_READY.zip

python3 scripts/validate_submission_zip.py LINE_READY.zip --expected-count 40 \
  --strict-standard --manifest-mode <emoji_main|emoji_tab|custom> \
  --json reports/submission-zip-audit.json
```

## 7. 進行管理

各バッチの完了ごとに:

```bash
python3 scripts/make_progress.py   # reports/progress.json / reports/manifest.json
git add -A && git commit
```

## 終了コードの意味（全検査スクリプト共通）

| コード | 意味 |
|---:|---|
| 0 | FAIL なし・REVIEW なし |
| 2 | REVIEW のみ |
| 1 | FAIL あり |
| 3 | 実行エラー |
