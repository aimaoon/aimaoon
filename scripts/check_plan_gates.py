#!/usr/bin/env python3
"""計画段階のゲートを機械検査する。

生成物:
  reports/uniqueness-matrix.csv   §7 の17列
  reports/collision-report.md     §7 の機械検査結果 + 付録B-1 分散条件 + §7-A 構図バランス

終了コード: 0=FAILなしREVIEWなし / 2=REVIEWのみ / 1=FAILあり / 3=実行エラー
"""
import csv, collections, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_emoji_plan import ITEMS, S  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 似た意味同士で差を数える軸（§6-A / §7）
# 01-32 は §7 の列挙（構図・表情・目・口・手・体勢・身体変形・エフェクト・感情強度）をそのまま使う。
CHAR_AXES = ["composition_type", "eyes", "mouth", "hands", "posture",
             "body_deformation", "dominant_effect", "emotion_intensity"]
# 33-40 は顔・手・体勢を持たないため、同じ「最低3軸の差」を記号の属性へ写像して適用する。
# 写像の根拠は reports/collision-report.md に明記する。
SYMBOL_AXES = ["first_frame_silhouette", "spatial_path", "beat_pattern", "tempo_class",
               "dominant_visual_element", "prop_or_symbol", "dominant_effect",
               "body_deformation", "emotion_intensity"]
MIN_DIFF_AXES = 3


def rows():
    out = []
    for it in ITEMS:
        c = it["cues"]
        face = "／".join(x for x in (c["eyes"], c["brows"], c["mouth"]) if x) or "（記号のためなし）"
        hb = "／".join(x for x in (c["hands"], c["posture"]) if x) or "（記号のためなし）"
        out.append({
            "number": it["n"],
            "meaning": it["meaning"],
            "conversation_intent": it["intent"],
            "first_frame_silhouette": it["sil"],
            "face_expression": face,
            "hand_or_body_position": hb,
            "primary_motion": f'{it["mf"]}/{it["sp"]}',
            "dominant_effect": it["effect_name"] or "なし",
            "prop_or_symbol": it["prop_name"] or "なし",
            "dominant_visual_element": it["pve"],
            "composition_type": it["comp"],
            "body_deformation": it["deform"] or "なし",
            "emotion_intensity": it["intensity"],
            "distinguishing_feature": it["uniq"],
            "similar_candidate_numbers": it["similar"],
            # 差分判定用（CSVには出さない）
            "_eyes": c["eyes"], "_mouth": c["mouth"], "_hands": c["hands"], "_posture": c["posture"],
            "_spatial_path": it["sp"], "_beat_pattern": it["beat"], "_tempo_class": it["tempo"],
            "_is_symbol": it["cat"] == S,
        })
    return out


def axis_value(r, axis):
    return {"composition_type": r["composition_type"], "eyes": r["_eyes"], "mouth": r["_mouth"],
            "hands": r["_hands"], "posture": r["_posture"],
            "body_deformation": r["body_deformation"], "dominant_effect": r["dominant_effect"],
            "emotion_intensity": r["emotion_intensity"],
            "first_frame_silhouette": r["first_frame_silhouette"],
            "spatial_path": r["_spatial_path"], "beat_pattern": r["_beat_pattern"],
            "tempo_class": r["_tempo_class"],
            "dominant_visual_element": r["dominant_visual_element"],
            "prop_or_symbol": r["prop_or_symbol"]}[axis]


def axes_for(a, b):
    """比較する2件がともに記号なら記号用の軸、それ以外はキャラクター用の軸を使う。"""
    return SYMBOL_AXES if (a["_is_symbol"] and b["_is_symbol"]) else CHAR_AXES


def main():
    data = rows()
    by_num = {r["number"]: r for r in data}
    findings, reviews = [], []

    # --- §7 必須: primary_motion + first_frame_silhouette + dominant_effect が全件一意
    key3 = collections.Counter(
        (r["primary_motion"], r["first_frame_silhouette"], r["dominant_effect"]) for r in data)
    dup3 = [k for k, v in key3.items() if v > 1]
    if dup3:
        findings.append(f"motion-key 重複: {dup3}")

    # --- §7 必須: 類似候補と最低3軸の差
    for r in data:
        for cand in [x for x in r["similar_candidate_numbers"].split(",") if x]:
            other = by_num.get(cand)
            if other is None:
                findings.append(f"{r['number']}: 類似候補 {cand} が存在しない")
                continue
            axes = axes_for(r, other)
            diff = [a for a in axes if axis_value(r, a) != axis_value(other, a)]
            r.setdefault("_diffs", {})[cand] = diff
            if len(diff) < MIN_DIFF_AXES:
                findings.append(
                    f"{r['number']} vs {cand}: 差のある軸が {len(diff)} 個で "
                    f"{MIN_DIFF_AXES} 未満 ({diff})")

    for r in data:
        worst = min((len(v) for v in r.get("_diffs", {}).values()), default=None)
        r["uniqueness_result"] = "PASS" if not any(
            r["number"] in f.split(" ")[0] for f in findings) else "FAIL"
        r["_worst_diff"] = worst

    dup_var = [k for k, v in collections.Counter(
        tuple(str(i[k]) for k in ["mf", "sp", "tempo", "beat", "hold", "lr"])
        for i in ITEMS).items() if v > 1]
    if dup_var:
        findings.append(f"variation-key 重複: {dup_var}")

    # --- 付録B-1 分散条件
    fam_key = collections.Counter((i["mf"], i["sp"], i["beat"]) for i in ITEMS)
    dup_fam = [k for k, v in fam_key.items() if v > 1]
    if dup_fam:
        findings.append(f"動作ファミリー+軌道+拍数 の重複: {dup_fam}")

    tempo = collections.Counter(i["tempo"] for i in ITEMS)
    tempo_targets = {"slow": (10, 14), "medium": (14, 18), "fast": (10, 14)}
    for t, (lo, hi) in tempo_targets.items():
        if not lo <= tempo[t] <= hi:
            reviews.append(f"テンポ分散 {t}={tempo[t]} が目安 {lo}-{hi} を外れる")

    # 連番で同じテンポが3個以上続かない
    seq = [i["tempo"] for i in ITEMS]
    runs = []
    run = 1
    for idx in range(1, len(seq)):
        run = run + 1 if seq[idx] == seq[idx - 1] else 1
        if run >= 3:
            runs.append((ITEMS[idx]["n"], seq[idx], run))
    if runs:
        findings.append(f"同一テンポが3個以上連続: {runs}")

    # 主要部品の移動量 20px 以上（§9-2 / B-1）
    small = [(i["n"], i["disp"]) for i in ITEMS if i["disp"] < 20]
    if small:
        findings.append(f"主要部品の移動量が20px未満: {small}")

    # 全体移動のみの項目は0個（§3-B / §9-4）。
    # moving_parts が body だけ、または空の項目は全身移動だけで主動作を作っていることになる。
    whole = [i["n"] for i in ITEMS if not (set(i["moving"]) - {"body"})]
    if whole:
        findings.append(f"主動作が全身移動のみ（moving_parts が body だけ/空）: {whole}")

    # --- §7-A 構図バランス（タグの個数レンジ）
    tagc = collections.Counter(t for i in ITEMS for t in i["tags"])
    tag_targets = {"face_centered": (10, 14), "upper_body": (6, 10), "full_body": (10, 14),
                   "seated_lying_back": (6, 10), "deformation_or_effect_led": (6, 10),
                   "prop_acting": (4, 8)}
    for t, (lo, hi) in tag_targets.items():
        if not lo <= tagc[t] <= hi:
            findings.append(f"構図タグ {t}={tagc[t]} が {lo}-{hi} を外れる")

    # 主構図が3個以上連続しない（01-32）
    comps = [i["comp"] for i in ITEMS if i["comp"] != "symbol"]
    char_nums = [i["n"] for i in ITEMS if i["comp"] != "symbol"]
    comp_runs = []
    run = 1
    for idx in range(1, len(comps)):
        run = run + 1 if comps[idx] == comps[idx - 1] else 1
        if run >= 3:
            comp_runs.append((char_nums[idx], comps[idx], run))
    if comp_runs:
        findings.append(f"同一構図が3個以上連続: {comp_runs}")

    # --- 出力
    os.makedirs(os.path.join(ROOT, "reports"), exist_ok=True)
    cols = ["number", "meaning", "conversation_intent", "first_frame_silhouette", "face_expression",
            "hand_or_body_position", "primary_motion", "dominant_effect", "prop_or_symbol",
            "dominant_visual_element", "composition_type", "body_deformation", "emotion_intensity",
            "distinguishing_feature", "similar_candidate_numbers", "uniqueness_result"]
    with open(os.path.join(ROOT, "reports", "uniqueness-matrix.csv"), "w",
              newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(data)

    lines = ["# collision report", "",
             "本ファイルは `python3 scripts/check_plan_gates.py` の出力である。手書きの数値は含まない。", ""]
    lines += ["## §7 機械検査", "",
              "```", "motion-key duplicates: " + (str(dup3) if dup3 else "NONE"), "```", "",
              "```", "variation-key duplicates: " + (str(dup_var) if dup_var else "NONE"),
              "```", "",
              "変動キーは motion_family / spatial_path / tempo_class / beat_pattern / "
              "peak_hold_ms / loop_return_type の6項目の組み合わせ。", ""]
    lines += ["## 類似候補ごとの差分軸数（最低3軸が必要）", "",
              "01-32 は §7 の列挙（構図・表情・目・口・手・体勢・身体変形・エフェクト・感情強度）を",
              "そのまま軸に使う。33-40 は顔・手・体勢を持たないため、同じ「最低3軸の差」を",
              "記号の属性（第1フレームのシルエット・軌道・拍数・テンポ・主役要素・部品・エフェクト・",
              "変形・強度）へ写像して適用した。写像したのは軸の中身であって合格基準ではない。", "",
              "| 番号 | 類似候補 | 差のある軸数 | 差のある軸 |", "|---|---|---:|---|"]
    for r in data:
        for cand, diff in sorted(r.get("_diffs", {}).items()):
            lines.append(f"| {r['number']} | {cand} | {len(diff)} | {', '.join(diff)} |")
    lines += ["", "## 付録B-1 分散条件", "",
              "| 条件 | 実測 | 判定 |", "|---|---|---|",
              f"| 動作ファミリー+軌道+拍数 の重複 | {len(dup_fam)} 件 | "
              f"{'PASS' if not dup_fam else 'FAIL'} |",
              f"| テンポ分散 低速/中速/高速 | {tempo['slow']}/{tempo['medium']}/{tempo['fast']} "
              f"（目安 12/16/12 前後） | {'PASS' if not any('テンポ分散' in x for x in reviews) else 'REVIEW'} |",
              f"| 同一テンポの3連続 | {len(runs)} 件 | {'PASS' if not runs else 'FAIL'} |",
              f"| 主要部品の移動量20px未満 | {len(small)} 件 | {'PASS' if not small else 'FAIL'} |",
              f"| 主動作が全身移動のみの項目 | {len(whole)} 件 | {'PASS' if not whole else 'FAIL'} |",
              f"| 移動量の実際の範囲 | {min(i['disp'] for i in ITEMS)}〜{max(i['disp'] for i in ITEMS)}px | "
              f"{'PASS' if all(20 <= i['disp'] <= 60 for i in ITEMS) else 'FAIL'} |", ""]
    lines += ["## §7-A 構図バランス", "", "| 構図タグ | 個数 | 目安 | 判定 |", "|---|---:|---|---|"]
    for t, (lo, hi) in tag_targets.items():
        lines.append(f"| {t} | {tagc[t]} | {lo}〜{hi} | {'PASS' if lo <= tagc[t] <= hi else 'FAIL'} |")
    lines += ["", f"主構図の3連続: {len(comp_runs)} 件 → {'PASS' if not comp_runs else 'FAIL'}", ""]

    if findings:
        lines += ["## FAIL", ""] + [f"- {x}" for x in findings] + [""]
    if reviews:
        lines += ["## REVIEW", ""] + [f"- {x}" for x in reviews] + [""]
    if not findings and not reviews:
        lines += ["## 総合", "", "計画段階のゲートはすべて PASS。未解決の重複候補は0件。", ""]
    elif not findings:
        lines += ["## 総合", "", "FAIL は0件。REVIEW のみ（上記）。", ""]

    lines += ["## この検査で確認していないこと", "",
              "- 生成後の見た目重複・動き重複（実画像が必要。現時点では NOT_RUN）",
              "- 第1フレームの意味伝達（実画像の目視が必要。現時点では NOT_RUN）",
              "- 32px表示での取り違え（実画像が必要。現時点では NOT_RUN）", ""]

    with open(os.path.join(ROOT, "reports", "collision-report.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"uniqueness-matrix.csv: {len(data)} rows")
    print(f"FAIL={len(findings)} REVIEW={len(reviews)}")
    for x in findings[:10]:
        print("  FAIL:", x)
    for x in reviews[:10]:
        print("  REVIEW:", x)
    return 1 if findings else (2 if reviews else 0)


if __name__ == "__main__":
    sys.exit(main())
