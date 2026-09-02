# 販売情報（§12）

**未確定項目あり。** Creator's name と Copyright はユーザー本人の情報が必要なため、
プレースホルダのままにしてある。登録前に必ず差し替えること（下記「要記入」参照）。

画像が未生成のため、**説明文と画像の整合はまだ検証していない**（`NOT_RUN`）。
原画到着後、第1フレーム40枚と照合して矛盾がないか再確認する。

---

## 日本語

### タイトル

```
縫い目で話すカワウソ ステッチ
```

### 説明文

```
フェルトを縫い合わせて作られたカワウソ「ステッチ」です。
気持ちが動くと、体のまわりを1周している縫い目のほうが先に変わります。

うれしいと縫い目がきゅっと締まり、眠いとゆるみ、
照れると少しほどけて糸の先が飛び出します。おこったときは糸が朱色に変わります。

あいさつ、お礼、あやまり、よろこび、こまりごとまで、キャラクター32種。
文末にそのまま置ける記号8種も、同じ藍の糸でかがってあります。
どのパーツからも、糸の先が1本だけ出ています。
```

### メイン画像候補（4個）

| 候補 | 番号 | 理由 |
|---|---|---|
| 第1候補 | 027 怒る | 糸が藍から朱へ変わる瞬間で、この商品の仕組みが1枚で伝わる。色の対比も一覧で最も強い |
| 第2候補 | 016 やったー | 両手を真上へ上げた空中姿勢。縫い目が最も強く張り、シルエットが最も大きく展開する |
| 第3候補 | 018 照れる | 頬の縫い目がほつれて糸端が出る。「ほどける」側の仕組みを見せられる唯一の候補 |
| 第4候補 | 001 ありがとう | 正面に近い基準姿勢で、頭身比・ボタンの目・縫い合わせ線・リボンの4フックが同時に写る |

第1候補と第3候補を並べると「締まる」と「ほどける」の対が伝わるため、
一覧の中で商品の仕組みを最短で説明できる。

---

## English

### Title

```
STITCH the Felt Otter
```

### Description

```
STITCH is an otter sewn together from felt.
When its mood changes, the blanket stitch running around its body changes first.

Happy, and the stitches pull tight. Sleepy, and they go slack.
Embarrassed, and a few come loose with thread ends poking out.
Angry, and the thread turns scarlet.

32 character emoji covering greetings, thanks, apologies, delight and small troubles,
plus 8 symbols you can drop straight at the end of a sentence, hemmed in the same navy thread.
Every piece has exactly one thread end left hanging.
```

---

## 要記入（ユーザー本人の情報が必要）

| 項目 | 現在の値 | 必要な対応 |
|---|---|---|
| Creator's name | `<未記入>` | LINE Creators Market に登録している表示名を記入する |
| Copyright | `<未記入>` | 権利表記（例: `(C) <年> <権利者名>`）を記入する。Claude が本人情報を推測して埋めることはしない |

---

## AI使用申告

調達モードD（`reports/asset-pipeline.md`）に基づく事実の記載。

```
本作品の原画（キャラクターおよび記号）は、制作者が画像生成ツールを用いて作成しました。
アニメーション設計、部位分離、中割り、APNG生成、および各種検査は
Claude Code（Anthropic の CLI ツール）を用いて行いました。
```

**未確定:** 実際に使用した画像生成ツールの名称は、原画受領時にユーザーから聴取して確定する。
申告欄にツール名の記載が必要な場合は、上記本文へ追記すること。事実が確定するまで具体名を書かない。

---

## テキストの自主点検

| 点検項目 | 結果 |
|---|---|
| URL を含まない | PASS |
| 告知文言・宣伝誘導を含まない | PASS |
| 機種依存文字を含まない | PASS（丸数字・ローマ数字合字・単位合字・(株)等を使用していない） |
| 誤記 | 目視確認済み |
| 画像と説明文の整合 | `NOT_RUN`（画像未生成） |
| 説明文が実装と一致しているか | 縫い目の5状態（tight / loose / frayed / red / wave）は style-lock.json の `emotion_stitch_mechanic` と一致。糸端1本の署名は `signature_effect_style` と一致 |
