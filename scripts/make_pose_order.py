#!/usr/bin/env python3
"""調達モードD（別環境で原画生成）のための発注書と、ポーズ台帳の雛形を出力する。

出力:
  reports/asset-order.md     ユーザーが別環境で生成すべき原画の一覧と各ポーズの指示
  reports/pose-manifest.csv  §8-1 の台帳。原画未着のため判定列は NOT_RUN で初期化する

emoji-plan.json / style-lock.json / design-brief.md を唯一の入力とし、手書きの重複記述を作らない。
"""
import csv
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

POSE_ROLES = [
    ("P1", "first", "意味が完成している第1フレーム"),
    ("P2", "anticipation", "予備動作（本動作と逆方向、または力を溜める変化）"),
    ("P3", "transit", "動作途中・通過姿勢（合成ではなく描かれた中間姿勢）"),
    ("P4", "peak", "意味が最も強い最大動作"),
    ("P5", "recoil", "反動・着地・受け止め（作用の結果）"),
    ("P6", "return", "元へ戻るための別ポーズ（逆再生コピーにしない）"),
]
SYMBOL_ROLES = [
    ("S1", "complete", "完成状態（第1フレーム）"),
    ("S2", "appear", "部品出現・分散"),
    ("S3", "approach", "接近"),
    ("S4", "join", "衝突または結合"),
    ("S5", "scatter", "反動または分散"),
]

RENDER_PX = 720   # §9-5: 180px の4倍で描き、最終段階で LANCZOS 縮小する


def main():
    with open(os.path.join(ROOT, "emoji-plan.json"), encoding="utf-8") as f:
        plan = json.load(f)
    with open(os.path.join(ROOT, "style-lock.json"), encoding="utf-8") as f:
        lock = json.load(f)
    items = plan["items"]
    chars = [i for i in items if i["has_character"]]
    syms = [i for i in items if not i["has_character"]]

    n_pose = len(chars) * len(POSE_ROLES)
    n_body = len(chars)
    n_sym = len(syms) * len(SYMBOL_ROLES)
    total = 1 + n_pose + n_body + n_sym

    L = []
    a = L.append
    a("# 原画発注書（調達モードD：別環境で生成）")
    a("")
    a("本ファイルは `python3 scripts/make_pose_order.py` の出力である。")
    a("emoji-plan.json / style-lock.json を唯一の入力とし、内容を二重管理しない。")
    a("")
    a("## 役割分担")
    a("")
    a("| 担当 | 作業 |")
    a("|---|---|")
    a("| **あなた（別環境）** | 下記の原画を生成し、指定パスへ配置する |")
    a("| Claude（本セッション） | マスク抽出・部位分離・リグ・中割り・APNG化・容量最適化・"
      "全検査・プレビュー生成・提出物作成 |")
    a("")
    a("Claude はコードで円・楕円・多角形を組み合わせてキャラクターを描き起こさない（§0-5 の禁止事項）。")
    a("原画が届くまで、01〜32 の第1フレームもアニメーションも作れない。")
    a("")
    a("## 必要枚数")
    a("")
    a("| 種別 | 枚数 | 内訳 |")
    a("|---|---:|---|")
    a(f"| 基準キャラクター | 1 | `character-master.png` |")
    a(f"| 専用ポーズ原画 | {n_pose} | {len(chars)}個 × P1〜P6 の6ポーズ |")
    a(f"| 本体のみ版（採寸用） | {n_body} | {len(chars)}個 × P1 から小物とエフェクトを除いたもの |")
    a(f"| 記号の状態原画 | {n_sym} | {len(syms)}個 × S1〜S5 の5状態 |")
    a(f"| **合計** | **{total}** | |")
    a("")
    a("§8-1 は 01〜32 について各6枚を必須とし、4枚への省略を禁じている。"
      "`dedicated_pose_count` が6未満の項目があるとアニメーション工程へ進めない。")
    a("")
    a("## 共通制作ルール（全枚数に適用）")
    a("")
    a(f"- **解像度 {RENDER_PX}×{RENDER_PX}px**。最終180pxの4倍で描き、Claude 側が "
      "`Image.LANCZOS` で180pxへ縮小する（§9-5）。")
    a("- **背景は透過**、または均一なクロマキー。透過後に緑縁・白縁が出ないこと。")
    a("- **文字・ラベル・透かし・不要な影を入れない。**")
    a("- 全ポーズでキャラクター本体を**同じ見かけの大きさ・基準位置**にする。"
      "ポーズごとに拡大縮小して構図を整えない。")
    a("- ポーズはセル番号ではなく**共通ステージ座標**へ配置する。"
      "2×2シートで作る場合も、各マスの中でキャラクターを中央揃えし直さない（§9-5）。")
    a("- 全ポーズが**上下左右8px（720px換算で32px）の安全域**に収まること。最大動作でも見切れない。")
    a("")
    a("### 2×2シートで生成する場合")
    a("")
    a(f"1マス {RENDER_PX}px の 2×2（全体 {RENDER_PX*2}×{RENDER_PX*2}px）で生成してよい。")
    a("各マスを均等にし、十分なガターを設け、何もマスをまたがせないこと。")
    a("配置後、Claude 側で `python3 scripts/split_pose_sheet.py <sheet.png> --number NNN "
      "--roles P1,P2,P3,P4` により個別ファイルへ分割する。")
    a("")
    a("## 基準キャラクター `character-master.png`")
    a("")
    a(f"- {RENDER_PX}×{RENDER_PX}px、透過、正面向きの直立、無表情に近い基本状態")
    a(f"- 商品コンセプト: {lock['one_sentence_product_concept']}")
    a(f"- 造形: {lock['silhouette']}")
    a(f"- 頭身: {lock['proportions']['note']}")
    a(f"- 素材: {lock['material_concept']}")
    a(f"- 線: {lock['line_color']} / {lock['line_width_rule']}")
    a("- 配色（この10色から出ない）:")
    for k, v in {**lock["base_colors"], **lock["effect_colors"]}.items():
        a(f"  - `{v}` {k}")
    a("- 必ず入れる視覚的フック:")
    for h in lock["visual_hooks"]:
        a(f"  - **{h['name']}** — {h['note']}")
    a("- 陰影は1段のみ。光源は左上45度。光沢・グラデーション・粒状テクスチャ・"
      "ぼかし影・半透明グローを使わない。")
    a("")
    a("**この1枚が承認されるまで、他の原画を量産しないこと。** 以後この画像が唯一の同一性基準になる。")
    a("")
    a("## 採寸用「本体のみ版」について")
    a("")
    a("`poses/NNN/P1-body.png` として、P1 から**小物・エフェクト・提灯の発光リング**を取り除いた版を1枚。")
    a("§5 のサイズ統一は主役だけのマスクで測るため、これが無いと "
      "`reports/scale-audit.csv` が算出できない（小物込みの外接矩形で測ってはならない）。")
    a("提灯そのものは本体の一部として**残す**。除くのは発光リングとエフェクトパーツだけ。")
    a("")
    a("## 記号 33〜40 について")
    a("")
    a("キャラクターを描かず、`symbol_style_lock` に従う。")
    a(f"- 線色 `{lock['symbol_style_lock']['line_color']}` / "
      f"線幅 {lock['symbol_style_lock']['line_width_px']}px / "
      f"角の丸み {lock['symbol_style_lock']['corner_radius_px']}px")
    a(f"- 光学面積の目標 {lock['symbol_style_lock']['optical_area_px2']}px²"
      f"（±{lock['symbol_style_lock']['optical_area_tolerance_pct']}%）、"
      f"文字系は cap height {lock['symbol_style_lock']['cap_height_px']}px")
    a("- 各パーツに**ガス抜き穴を1つ**入れる（シリーズの署名）")
    a("- 8個を色違いにしない。完成記号の変形だけで済ませず、最低5状態を作る。")
    a("")
    a("---")
    a("")
    a("# 個別指示")
    a("")

    for it in items:
        n = it["number"]
        a(f"## {n} {it['meaning']}")
        a("")
        a(f"- 主役要素: {it['primary_visual_element']}")
        a(f"- 動作: `{it['motion_family']}` / 軌道 `{it['spatial_path']}` / "
          f"テンポ `{it['tempo_class']}` / 拍 `{it['beat_pattern']}`")
        a(f"- 主要部品の移動量: **{it['major_part_displacement_px']}px**（180px換算）")
        a(f"- 動かす部位: {', '.join(it['moving_parts']) or '（なし）'}")
        a(f"- 動かさない部位: {', '.join(it['fixed_parts']) or '（なし）'}")
        if it["has_character"]:
            c = it["first_frame_emotion_cues"]
            a(f"- 第1フレームの表情: 目={c['eyes']} / 眉={c['brows']} / 口={c['mouth']}"
              + (f" / 頬={c['cheeks']}" if c["cheeks"] else ""))
            a(f"- 第1フレームの体勢: 手={c['hands']} / 姿勢={c['posture']}")
            if c["prop"]:
                a(f"- 小物: {c['prop']}")
            if c["effect"]:
                a(f"- エフェクト: {c['effect']}")
        else:
            c = it["first_frame_emotion_cues"]
            if c["prop"]:
                a(f"- 部品: {c['prop']}")
            if c["effect"]:
                a(f"- エフェクト: {c['effect']}")
        a(f"- 合格判定: {it['primary_action_test']}")
        a("")
        roles = POSE_ROLES if it["has_character"] else SYMBOL_ROLES
        a("| ファイル | 役割 | 描く内容 |")
        a("|---|---|---|")
        for idx, (pid, slug, role) in enumerate(roles):
            desc = it["keyframe_storyboard"].get(f"P{idx+1}", "")
            a(f"| `poses/{n}/{pid}-{slug}.png` | {role} | {desc} |")
        if it["has_character"]:
            a(f"| `poses/{n}/P1-body.png` | 採寸用 | P1 から小物・エフェクト・"
              f"発光リングを除いた本体のみ |")
        a("")
        a("連続するポーズ間で、`手足の接続位置` / `関節角度` / `頭と胴体の相対位置` / "
          "`足の接地状態` / `顔パーツ` / `小物との接触` / `外形シルエット` のうち、"
          "動作に関係する**最低3項目**を変えること。")
        a("全体の平行移動・回転・拡大縮小だけの画像は別ポーズと数えない。")
        a("")

    with open(os.path.join(ROOT, "reports", "asset-order.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(L))

    # --- §8-1 ポーズ台帳の雛形
    rows = []
    for it in items:
        roles = POSE_ROLES if it["has_character"] else SYMBOL_ROLES
        for pid, slug, role in roles:
            rows.append({
                "number": it["number"], "pose_id": pid, "role": role,
                "changed_joints": "NOT_RUN", "changed_contact": "NOT_RUN",
                "silhouette_change": "NOT_RUN", "generated_from_single_warp": "NOT_RUN",
                "identity_result": "NOT_RUN", "approval": "pending",
            })
    cols = ["number", "pose_id", "role", "changed_joints", "changed_contact",
            "silhouette_change", "generated_from_single_warp", "identity_result", "approval"]
    with open(os.path.join(ROOT, "reports", "pose-manifest.csv"), "w",
              newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    print(f"asset-order.md: {len(items)} items, {total} images requested")
    print(f"pose-manifest.csv: {len(rows)} rows (all NOT_RUN / pending — 原画未着)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
