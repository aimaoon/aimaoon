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
 ("concept_strength", 18,
  "一文の商品コンセプト『縫い目がほどけたり締まったりして、気持ちを表すカワウソ』が動物名と"
  "『かわいい』に頼らず成立しており、しかも感情表現の機構そのものが商品コンセプトになっている。"
  "ステッチの5状態（tight / loose / frayed / red / wave）が40種類の展開軸を直接与える。"
  "減点2: カワウソというモチーフ選択はコンセプトに必須ではなく、他の動物でも同じ機構が成立する。"
  "モチーフとコンセプトの結合が弱い。"),
 ("silhouette_originality", 15,
  "輪郭が実線ではなくブランケットステッチという処理は、実線輪郭が支配的な一覧の中で明確に浮く。"
  "頭が全体の約半分を占める2頭身と、先に玉結びのある太い尻尾が外形を作る。"
  "減点5: 2頭身の丸い動物シルエットそのものは一般的であり、独自性の大半は"
  "『輪郭処理』が担っていてシルエットではない。32px ではステッチが潰れるため、"
  "小サイズでは普通の丸い動物の輪郭に近づく。"),
 ("material_and_depth", 17,
  "フェルトと刺繍糸という素材を、ブランケットステッチ・ボタンの目・頭頂から鼻への縫い合わせ線・"
  "エフェクトの糸端という4つの縫製痕で一貫して示している。装飾ではなく構造として素材を表現している。"
  "減点3: 容量制約からフラット描画を強制したため、フェルトの厚み感は切り口の1段影だけに依存し、"
  "立体感は控えめになる。素材の説得力を質感ではなく形状に全振りしている。"),
 ("series_hooks", 18,
  "視覚的フックが4つ（ステッチの輪郭・ボタンの目・縫い合わせ線・首元のリボン）あり、"
  "いずれも主要造形の一部である（§6-C 点検項目4）。"
  "特にステッチはアニメーションの担い手を兼ねており、動かしても失われないどころか主役になる。"
  "減点2: 32px で確実に残るのはボタンの目とシルエットの2つで、フック4つのうち半分は小サイズで失われる。"),
 ("small_size_product_appeal", 14,
  "藍のステッチとクリーム／タンのフェルトは高コントラストで、ベタ塗り10色は輪郭を明瞭に保つ。"
  "減点6: **実測に基づく減点である。** 受領した案Bシートの1体目を32pxへ縮小して目視した結果、"
  "ステッチの輪郭が斑点状に潰れ、判別できた要素はボタンの目1つのみだった。"
  "§6-C の実装ゲートは『最低2つ』を求めており、この時点では未達である。"
  "フラット描画と線の整理で改善は見込めるが、改善後の再測定を経るまで高い点は付けられない。"),
]

# 採点とは別の実装ゲート（§6-C 後半）。実画像が無い段階では判定できないものを NOT_RUN として明示する。
GATES = [
 ("32px表示で目・口・主役要素・シルエットのうち最低2つを即座に認識できる", "REVIEW",
  "受領した案Bシート（テクスチャあり）の1体目を32pxへ縮小して目視した実測では、"
  "判別できたのはボタンの目1つのみで基準の2つに未達。フラット描画版での再測定が必要。"
  "詳細は reports/art-style-feasibility.md。"),
 ("視覚的フック4つのうち最低2つが 01-32 の各第1フレームで確認できる", "NOT_RUN",
  "第1フレーム40枚が未生成。style-lock.json の visual_hooks_gate として要件だけ確定済み。"),
 ("濃い輪郭と塗りのコントラストが白・黒・淡色の背景上で判別できる", "NOT_RUN",
  "previews/bg-check.png が未生成。3背景での並置確認は実画像が必要。"),
 ("最大動作を想定しても上下左右8pxの安全域を確保できる構図である", "PASS",
  "十分条件 d <= 164 - max(w,h) を scripts/check_plan_gates.py が全40件で機械検査し違反0件。"
  "立ち姿 96x108 で上限56px、最大の 016 やったー(54px) が成立する。"
  "意図的に超過させると FAIL を返すことを確認済み。"
  "実APNGに対する毎フレームの見切れ判定は check_apng_jitter.py が別途行う。"),
 ("端へ寄せること自体が意味ではない絵文字を、見栄えだけのために端へ配置しない", "PASS",
  "allow_stage_exit を全40件で false とし、横移動は 012（半歩移動）と記号6件に限定した。"
  "横移動する8件はすべて expected_anchor_path を登録済みで、経路との差2px以内を機械検査する。"),
 ("小さな装飾を増やさず、主役要素・ポーズ・素材感・光学サイズを優先している", "PASS",
  "style-lock.json の texture_rule でフラット描画を明示し、紙の粒子・フェルトの繊維・布目・"
  "にじみ・粒状ノイズ・ディザ・動くグラデーション・半透明グロー・ぼかし影を禁止した。"
  "この制約は美観ではなく実測（テクスチャ版 1,179,874 bytes / 上限 300,000）に基づく。"),

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
