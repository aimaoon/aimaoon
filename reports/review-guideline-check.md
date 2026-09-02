# 審査ガイドラインの自主点検（§2-3）

**前提:** `https://creator.line.me/ja/review_guideline/` は EGRESS_BLOCKED で到達できていない
（`reports/spec-snapshot.md` 参照）。本点検は本プロンプト §2-3 が列挙する観点に対する自主点検であり、
**公式ガイドライン原文との突き合わせは行えていない。**

**審査通過は保証できない。** 以下は本制作で実施した点検の結果であり、審査結果ではない。

## 段階別の点検

凡例: `PASS` = 実施して合格 / `NOT_RUN` = 実画像が無く未実施 / `REVIEW` = 判断保留 / `PLANNED` = 計画で規定済み・実測前

### 企画段階

| 観点 | 判定 | 根拠 |
|---|---|---|
| 形式 | `PLANNED` | 40点・180×180・APNG・20フレーム・4000ms・ループ1 を emoji-plan.json で全件指定。ただし公式仕様は未検証（暫定既定値） |
| 視認性 | `PLANNED` | 32px での視認性を §6-C の実装ゲートに置き、design-implementation-gates.md で `NOT_RUN` として管理 |
| 文字 | `PASS` | 画像内の文字は記号 33-40 の英字・約物のみ（`OK!` `!?` `?` `zzz`）。日本語表記と機種依存文字を style-lock.json の text_language で禁止 |
| 重複 | `PASS` | uniqueness-matrix.csv 40行で motion-key・variation-key ともに重複0件。類似候補は全件で3軸以上の差 |
| モラル | `PASS` | 40件の意味は日常会話用途のみ。暴力・性的表現・差別的表現・危険行為を含む項目なし |
| 広告 | `PASS` | 販売情報テキストに URL・告知文言・宣伝誘導を含まない（store-listing-text.md の自主点検） |
| 権利 | `PASS` | 実在の商品・キャラクター・ロゴ・ブランド・実在人物・特定作家の絵柄を参照しない旨を style-lock.json の copyright_safety_notes に固定。「レトロソフビ」は一般的な様式、「深海生物」は生物カテゴリ |
| AI利用申告 | `REVIEW` | モードDである事実は確定。使用した画像生成ツール名が未確定のため、申告文を確定できない |

### 画像段階

| 観点 | 判定 | 根拠 |
|---|---|---|
| 形式 | `NOT_RUN` | 画像未生成。validate_apng_set.py が寸法・カラータイプ6・インターレース・acTL を検査する準備は完了 |
| 視認性 | `NOT_RUN` | previews/first-frames-32.png が未生成 |
| 文字 | `NOT_RUN` | 記号8個の実画像が未生成 |
| 重複 | `NOT_RUN` | 生成後の見た目重複・動き重複の判定は実画像が必要 |
| モラル | `NOT_RUN` | 実画像の目視が必要 |
| 権利 | `NOT_RUN` | 実画像が既存作品と類似していないかの確認は実画像が必要 |

### テキスト段階

| 観点 | 判定 | 根拠 |
|---|---|---|
| 文字 | `PASS` | store-listing-text.md にURL・告知文言・機種依存文字なし |
| 広告 | `PASS` | 同上 |
| 画像との整合 | `NOT_RUN` | 画像未生成のため説明文と画像の矛盾を確認できない |
| Creator's name / Copyright | `REVIEW` | ユーザー本人の情報が未記入。Claude が推測して埋めない |

### ZIP段階

| 観点 | 判定 | 根拠 |
|---|---|---|
| 形式 | `NOT_RUN` | LINE_READY.zip 未生成 |
| ファイル構成 | `REVIEW` | 第2-2節の `main.png` / `tab.png` 構成が未確定。validate_submission_zip.py は未確定の間 ZIP を PASS にしない |
| ゴミファイル | `PLANNED` | `__MACOSX/`・`.DS_Store`・`Thumbs.db`・隠しファイル・非PNGの検査を実装済み。自己テストで `__MACOSX/` 入りZIPが FAIL することを確認済み |

## ユーザーが外部で確認すべき項目

1. 公式のアニメーション絵文字制作ガイドで、画像数・寸法・DPI・容量・フレーム数・再生時間・ループ数を確認する
2. 提出ZIP直下に必要な静止画像（`main.png` / `tab.png`）とその寸法を確認する
3. 絵文字審査ガイドラインの原文を確認する（本点検は原文と突き合わせていない）
4. AI利用申告の要否と記載方法を確認する
5. Creator's name と Copyright を記入する
