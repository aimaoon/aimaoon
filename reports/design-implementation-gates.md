# design implementation gates (§6-C 後半)

本ファイルは `python3 scripts/make_design_audit.py` の出力である。

採点（`reports/design-quality-audit.csv`）とは別に満たすべき実装ゲート。
**実画像を要する項目は、原画が1枚も無い現時点では `NOT_RUN` であり `PASS` と書かない（§0-1）。**

| ゲート | 判定 | 根拠 |
|---|---|---|
| 32px表示で目・口・主役要素・シルエットのうち最低2つを即座に認識できる | `NOT_RUN` | previews/first-frames-32.png が未生成。原画（調達モードD）の到着後に測定する。 |
| 視覚的フック3つのうち最低2つが 01-32 の各第1フレームで確認できる | `NOT_RUN` | 第1フレーム40枚が未生成。style-lock.json の visual_hooks_gate として要件だけ確定済み。 |
| 濃い輪郭と塗りのコントラストが白・黒・淡色の背景上で判別できる | `NOT_RUN` | previews/bg-check.png が未生成。3背景での並置確認は実画像が必要。 |
| 最大動作を想定しても上下左右8pxの安全域を確保できる構図である | `PLANNED` | emoji-plan.json の全40件で safe_area_px=8 を指定し、主要部品移動量を24〜60pxに収めた（付録B-1 の20〜60px帯域内）。実際の見切れ判定は check_apng_jitter.py が実APNGに対して行う。 |
| 端へ寄せること自体が意味ではない絵文字を、見栄えだけのために端へ配置しない | `PLANNED` | allow_stage_exit を全40件で false とし、横移動は 012（半歩移動）と記号6件に限定した。 |
| 小さな装飾を増やさず、主役要素・ポーズ・素材感・光学サイズを優先している | `PASS` | style-lock.json の texture_rule で粒状ノイズ・ディザ・動くグラデーション・半透明グロー・ぼかし影を明示的に禁止し、forbidden_changes に10色パレット外の色の追加を含めた。 |

## 集計

NOT_RUN=3  PASS=1  PLANNED=2

`PLANNED` は計画JSONで数値として指定済みだが、実APNGに対する測定はまだ行っていない状態を指す。
