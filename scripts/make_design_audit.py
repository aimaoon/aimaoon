#!/usr/bin/env python3
"""§6-C デザイン独自性・商品力ゲートの採点を出力する。

出力:
  reports/design-quality-audit.csv          （列: axis,score,max,reason ＋ 合計行）
  reports/design-implementation-gates.md    （採点とは別の実装ゲート。実画像が要るものは NOT_RUN）

合否: 合計80点未満、またはいずれか1項目が12点未満は不合格。
注意: ここでの点数は style-lock.json / design-brief.md に定義した設計内容に対する設計判断であり、
      画素の実測値ではない。実画像を要する判定は本スクリプトでは採点せず、実装ゲート側へ NOT_RUN として出す。
"""
import csv, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PASS_TOTAL, PASS_AXIS, MAX = 80, 12, 20

AXES = [
 ("concept_strength", 17,
  "一文の商品コンセプト『昭和の怪獣ソフビが、日常会話のときだけ手のひらサイズになって返事をする』が "
  "動物名と『かわいい』を使わずに成立し、想定購入者（レトロ玩具層）と結び付いている。"
  "減点3: 『レトロソフビ』と『深海生物』の二段構えで、頭頂の提灯が読めないと深海の要素が伝わらない依存がある。"),
 ("silhouette_originality", 16,
  "頭でっかち三角に頭頂の提灯が1本立つ外形は、丸い動物系が支配的な一覧の中で輪郭だけで区別できる。"
  "尾ひれ3枚板が背面の非対称を作る。"
  "減点4: 三頭身デフォルメ自体は一般的な様式で、唯一性の大半を提灯突起1点が担っている。"
  "提灯が隠れる構図（018 顔を覆う等）では輪郭の独自性が下がる。"),
 ("material_and_depth", 17,
  "マット塩ビという素材を、パーティングライン・可動ボール4箇所・エフェクトのガス抜き穴という "
  "3つの成型痕で一貫して示しており、装飾ではなく造形として素材を表現している。"
  "1段影と1段ハイライトに限定したことで §9-9 の容量設計とも矛盾しない。"
  "減点3: 光沢とグラデーションを禁じた結果、奥行きの階調表現は重なり順と輪郭に依存し、立体感は控えめになる。"),
 ("series_hooks", 18,
  "視覚的フックが4つ（提灯・パーティングライン・可動ボール・吹き付け帯）あり、"
  "いずれも装飾の追加ではなく主要造形へ組み込まれている（§6-C 点検項目4）。"
  "可動ボールは §8-2 のリグの支点そのもので、動かしても失われない。"
  "減点2: 吹き付け帯は背面側にあるため、正面構図の一部では見えず、実質3つで運用される場面がある。"),
 ("small_size_product_appeal", 15,
  "墨黒3px輪郭・深緑ベタ・蛍光オレンジの高コントラスト配色で、32px でも三角シルエットと提灯は残る想定。"
  "減点5: 可動ボール（直径約8px想定）とパーティングライン（3px）は 32px 表示で潰れる可能性が高く、"
  "4つのフックのうち小サイズで確実に残るのは提灯とシルエットの2つに絞られる。"
  "実表示での確認は実画像が必要なため未実施であり、この減点は保守的な見積もりである。"),
]

# 採点とは別の実装ゲート（§6-C 後半）。実画像が無い段階では判定できないものを NOT_RUN として明示する。
GATES = [
 ("32px表示で目・口・主役要素・シルエットのうち最低2つを即座に認識できる", "NOT_RUN",
  "previews/first-frames-32.png が未生成。原画（調達モードD）の到着後に測定する。"),
 ("視覚的フック3つのうち最低2つが 01-32 の各第1フレームで確認できる", "NOT_RUN",
  "第1フレーム40枚が未生成。style-lock.json の visual_hooks_gate として要件だけ確定済み。"),
 ("濃い輪郭と塗りのコントラストが白・黒・淡色の背景上で判別できる", "NOT_RUN",
  "previews/bg-check.png が未生成。3背景での並置確認は実画像が必要。"),
 ("最大動作を想定しても上下左右8pxの安全域を確保できる構図である", "PLANNED",
  "emoji-plan.json の全40件で safe_area_px=8 を指定し、"
  "主要部品移動量を24〜60pxに収めた（付録B-1 の20〜60px帯域内）。"
  "実際の見切れ判定は check_apng_jitter.py が実APNGに対して行う。"),
 ("端へ寄せること自体が意味ではない絵文字を、見栄えだけのために端へ配置しない", "PLANNED",
  "allow_stage_exit を全40件で false とし、横移動は 012（半歩移動）と記号6件に限定した。"),
 ("小さな装飾を増やさず、主役要素・ポーズ・素材感・光学サイズを優先している", "PASS",
  "style-lock.json の texture_rule で粒状ノイズ・ディザ・動くグラデーション・"
  "半透明グロー・ぼかし影を明示的に禁止し、forbidden_changes に10色パレット外の色の追加を含めた。"),
]


def main():
    rows = [{"axis": a, "score": s, "max": MAX, "reason": r} for a, s, r in AXES]
    total = sum(r["score"] for r in rows)
    low = [r["axis"] for r in rows if r["score"] < PASS_AXIS]
    verdict = "PASS" if (total >= PASS_TOTAL and not low) else "FAIL"
    rows.append({"axis": "TOTAL", "score": total, "max": MAX * len(AXES),
                 "reason": f"合格条件: 合計{PASS_TOTAL}点以上 かつ 各項目{PASS_AXIS}点以上 → {verdict}"
                           + (f" / {PASS_AXIS}点未満の項目: {low}" if low else "")})

    os.makedirs(os.path.join(ROOT, "reports"), exist_ok=True)
    with open(os.path.join(ROOT, "reports", "design-quality-audit.csv"), "w",
              newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["axis", "score", "max", "reason"])
        w.writeheader()
        w.writerows(rows)

    lines = ["# design implementation gates (§6-C 後半)", "",
             "本ファイルは `python3 scripts/make_design_audit.py` の出力である。", "",
             "採点（`reports/design-quality-audit.csv`）とは別に満たすべき実装ゲート。",
             "**実画像を要する項目は、原画が1枚も無い現時点では `NOT_RUN` であり `PASS` と書かない（§0-1）。**", "",
             "| ゲート | 判定 | 根拠 |", "|---|---|---|"]
    for g, v, why in GATES:
        lines.append(f"| {g} | `{v}` | {why} |")
    counts = {}
    for _, v, _ in GATES:
        counts[v] = counts.get(v, 0) + 1
    lines += ["", "## 集計", "",
              "  ".join(f"{k}={v}" for k, v in sorted(counts.items())), "",
              "`PLANNED` は計画JSONで数値として指定済みだが、実APNGに対する測定はまだ行っていない状態を指す。", ""]
    with open(os.path.join(ROOT, "reports", "design-implementation-gates.md"), "w",
              encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"design-quality-audit.csv: total={total}/{MAX*len(AXES)} verdict={verdict}")
    for r in rows[:-1]:
        print(f"  {r['axis']}: {r['score']}/{MAX}")
    print("design-implementation-gates.md:", "  ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    return 0 if verdict == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
