# spec snapshot

spec_verified: false

## 到達試行の記録（第2-1節）

| 項目 | 内容 |
|---|---|
| checked_at_utc | 2026-09-02T03:18:26Z |
| URL 1 | https://creator.line.me/ja/guideline/animationemoji/ |
| 結果 1 | 失敗 |
| エラー 1 | `{"error_type":"EGRESS_BLOCKED","domain":"creator.line.me","message":"Access to creator.line.me is blocked by the network egress proxy."}` |
| URL 2 | https://creator.line.me/ja/review_guideline/ |
| 結果 2 | 失敗 |
| エラー 2 | `{"error_type":"EGRESS_BLOCKED","domain":"creator.line.me","message":"Access to creator.line.me is blocked by the network egress proxy."}` |
| 使用ツール | WebFetch |

**このリモート実行環境は `creator.line.me` へ到達できない。以下の値は公式ページで検証していない暫定既定値であり、
検証済みとして扱ってはならない。提出前にユーザーが公式ページで各値を確認する必要がある。**

## 暫定既定値（本プロンプト第2-1節の標準書き出し／未検証）

| 項目 | 暫定値 | 検証状態 |
|---|---|---|
| 画像形式 | APNG（RGBA、透過あり） | UNVERIFIED |
| 寸法 | 180 × 180 px | UNVERIFIED |
| DPI | 72dpi以上 | UNVERIFIED |
| 画像点数 | 40点（`001.png`〜`040.png`、3桁ゼロ埋め、欠番なし） | UNVERIFIED |
| フレーム数 | 20 | UNVERIFIED |
| 総再生時間 | 4,000ms（1周） | UNVERIFIED |
| ループ回数 | 1（`acTL` の `num_plays = 1`） | UNVERIFIED |
| 1ファイル容量 | ハード上限 300,000 bytes / 制作目標 285,000 bytes | UNVERIFIED |
| ZIP全体 | 20MB以下 | UNVERIFIED |
| ZIP直下 | `001.png`〜`040.png` ＋ タブ／メイン画像（下記 submission_files） | UNVERIFIED |

## submission_files

status: UNDETERMINED

第2-2節の未確定事項。公式ページへ到達できないため、`main.png` と `tab.png` のどちらが必要か、
およびその寸法を確定できない。**ユーザーの回答が得られるまで `LINE_READY.zip` を完成扱いにしない。**

| 候補モード | 想定構成 | 採否 |
|---|---|---|
| `emoji_main` | `001.png`〜`040.png` ＋ `main.png` | 未確定 |
| `emoji_tab` | `001.png`〜`040.png` ＋ `tab.png`（96×74px） | 未確定 |
| `custom` | ユーザー指定（`--extra-file NAME:WxH` で指定） | 未確定 |

どのモードでも共通の必須条件（確定済み）：
- `001.png`〜`040.png` の40点が欠番なくZIP直下にあること
- `__MACOSX`・`.DS_Store`・フォルダ階層・作業ファイルを含めないこと

## 差分と適用結果

公式仕様を取得できなかったため、公式仕様と本プロンプト既定値との差分は **NOT_RUN**。
到達可能になった時点で本ファイルを更新し、差分があれば公式仕様を優先して適用すること。
