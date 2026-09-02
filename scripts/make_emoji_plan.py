#!/usr/bin/env python3
"""emoji-plan.json と reports/anchor-config.json を生成する。

仕様書 §3-1 のスキーマ、付録A（意味・第1フレーム・主動作）、付録B（動作バリエーション）を
単一のデータ表から展開する。手書きのJSONを置かないのは §0-1（捏造の禁止）に従うため。

出力:
  emoji-plan.json
  reports/anchor-config.json
"""
import json, os, sys

CANVAS = 180
SAFE = 8
TARGET_BYTES = 285000
HARD_LIMIT_BYTES = 300000

# 基準立ち姿のランドマーク（style-lock.json の size_lock から導出した公称値）
# character-master.png 未生成のため実測ではなく設計目標値。progress.json で provisional と記録する。
BASE_LANDMARKS = {
    "ear_l": [64, 52], "ear_r": [116, 52],      # 側頭部の鰭状突起
    "eye_l": [76, 62], "eye_r": [104, 62],
    "nose": [90, 70], "mouth": [90, 76],
    "foot_l": [76, 150], "foot_r": [104, 150],
    "tail": [120, 124],                          # 3枚板の尾ひれ
}

STAND_BBOX = {"w": 96, "h": 118, "cx": 90, "baseline_y": 150}
SEAT_BBOX  = {"w": 104, "h": 92, "cx": 90, "baseline_y": 150}
LIE_BBOX   = {"w": 128, "h": 74, "cx": 90, "baseline_y": 150}

ROI_FEET   = [78, 138, 24, 20]   # 接地足
ROI_HIP    = [78, 116, 24, 18]   # 腰
ROI_TORSO  = [78, 104, 24, 18]   # 胴体中心
ROI_SEAT   = [76, 132, 28, 22]   # 尻・接地面
ROI_LIE    = [62, 138, 56, 18]   # 横向きの接地面

# ---------------------------------------------------------------- 表示時間

# §9-1 標準配分: 予備動作10-20% / 本動作25-40% / 決めの静止10-20% / 反動と戻り30-45%
SEG_A = {"slow": 680, "medium": 560, "fast": 440}   # F01-F05 第1フレーム表示 + 予備動作
SEG_B = {"slow": 1220, "medium": 1400, "fast": 1560}  # F06-F09 本動作
WA = [0.34, 0.20, 0.17, 0.15, 0.14]   # F01 を長く取り、予備動作へ向けて加速
WB = [0.31, 0.26, 0.23, 0.20]         # 本動作は加速（表示時間は短くなる）
WD = [0.22, 0.28, 0.27, 0.23]         # 反動はいったん伸びてから収束
WE = [0.42, 0.36, 0.22]               # 戻りは減速し、F20 を短くしてループを閉じる


def _split(total, weights, floor=60):
    raw = [total * w for w in weights]
    out = [max(floor, int(round(v))) for v in raw]
    diff = total - sum(out)
    i = out.index(max(out))
    out[i] += diff
    if min(out) < floor:
        raise ValueError("frame duration below floor")
    return out


def build_durations(tempo, hold, short_c, beat):
    """20要素・合計ちょうど4000ms の表示時間配列を作る。"""
    seg_c = hold + 3 * short_c
    a, b = SEG_A[tempo], SEG_B[tempo]
    de = 4000 - a - b - seg_c
    d = int(round(de * 0.68))
    e = de - d

    # §9-1 の帯域を満たしているか（合格判定は数値比較で行う）
    assert 400 <= a <= 800, f"anticipation {a} out of 10-20%"
    assert 1000 <= b <= 1600, f"main action {b} out of 25-40%"
    assert 400 <= seg_c <= 800, f"peak hold segment {seg_c} out of 10-20%"
    assert 1200 <= de <= 1800, f"recoil+return {de} out of 30-45%"

    fa = _split(a, WA)
    fb = _split(b, WB)
    # 決めの静止位置を動作ごとに変える（三段構成は決めを後ろへ寄せる）
    hold_slot = 2 if "three_stage" in beat else 1
    fc = [short_c] * 4
    fc[hold_slot] = hold
    fd = _split(d, WD)
    fe = _split(e, WE)

    out = fa + fb + fc + fd + fe
    assert len(out) == 20, len(out)
    assert sum(out) == 4000, sum(out)
    return out, hold_slot + 10  # 1-indexed の決めフレーム番号


# ---------------------------------------------------------------- アンカー経路

def smoothstep(t):
    return t * t * (3 - 2 * t)


def build_path(controls):
    """制御点 [(frame_1indexed, x, y), ...] から20フレーム分の期待座標を作る。"""
    controls = sorted(controls)
    path = []
    for f in range(1, 21):
        if f <= controls[0][0]:
            path.append([float(controls[0][1]), float(controls[0][2])])
            continue
        if f >= controls[-1][0]:
            path.append([float(controls[-1][1]), float(controls[-1][2])])
            continue
        for (f0, x0, y0), (f1, x1, y1) in zip(controls, controls[1:]):
            if f0 <= f <= f1:
                t = smoothstep((f - f0) / (f1 - f0))
                path.append([round(x0 + (x1 - x0) * t, 2), round(y0 + (y1 - y0) * t, 2)])
                break
    assert len(path) == 20
    return path


# ---------------------------------------------------------------- 40個の表
# comp: 主構図（連続3個以上の禁止判定に使う） / tags: 構図タグ（§7-A の個数レンジ判定に使う）
# mf=motion_family sp=spatial_path lr=loop_return_type
# 付録A（意味・第1フレーム・主動作・固有要素）と付録B（ファミリー・軌道・テンポ・拍数・戻り方）を反映する。

C = "conversation"; P = "positive"; T = "trouble"; S = "symbol"

ITEMS = [
 dict(n="001", meaning="ありがとう", cat=C, comp="full_body", tags=["full_body"],
  mf="ceremonial_full_body", sp="arc_pitch_forward", tempo="medium", beat="single",
  hold=600, short_c=60, lr="slow_return", disp=34, search=8,
  moving=["head","body","left_arm","right_arm","lure_light"], fixed=["legs_or_feet"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="腰から折れる上半身と、遅れて垂れる提灯",
  cues=dict(eyes="穏やかに細めた三日月", brows="わずかに下げた水平", mouth="小さく閉じた弧",
            cheeks="淡い赤み", hands="両手を胸元へ寄せて重ねる", posture="直立からわずかに前傾",
            prop="", effect="提灯が静かに灯る"),
  story=["胸元で両手を重ね、正面を向いた完成した感謝の姿勢",
         "背筋をわずかに反らして力を溜め、提灯が上へ揺れる",
         "腰を支点に上半身が前へ倒れる途中。頭は膝方向を向く",
         "最も深いお辞儀。頭頂が34px下がり、提灯が前方へ垂れる",
         "上半身が戻り始め、提灯だけが遅れて前で揺れる",
         "直立に近づき、提灯が振り子の余韻で小さく戻る"],
  pat="F01 と F12 の頭頂Y座標が34px以上異なる",
  intent="感謝を丁寧に伝える", sil="直立・胸元で手を重ねた縦長",
  effect_name="提灯の点灯", prop_name="", deform="腰から上の前傾",
  intensity="中", uniq="儀礼的で深すぎない感謝のお辞儀", similar="003"),

 dict(n="002", meaning="お願い", cat=C, comp="face_centered", tags=["face_centered","upper_body"],
  mf="depth_hand_push", sp="z_axis_forward", tempo="medium", beat="two_stage_accel",
  hold=420, short_c=70, lr="no_elastic_return", disp=30, search=8,
  moving=["left_arm","right_arm","head","face_parts"], fixed=["legs_or_feet","body","tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="顔の前で合わせた両手",
  cues=dict(eyes="上目づかいの大きな丸", brows="八の字に上げる", mouth="すぼめた小さな楕円",
            cheeks="淡い赤み", hands="顔の前で合掌", posture="やや前かがみ",
            prop="", effect="提灯が控えめに明滅"),
  story=["顔の前で両手を合わせ、上目づかいで正面を見る完成ポーズ",
         "合掌したまま手をわずかに引き、肘を絞って溜める",
         "肘が伸び始め、合掌が顔の前から離れて前方へ出る",
         "合掌が最も手前へ30px押し出され、指先が拡大して見える",
         "肘が緩んで手が戻り始めるが、弾性を付けずに減速する",
         "顔の前の位置へ静かに収まり、上目づかいが残る"],
  pat="F01 と F11 の合掌先端の見かけ幅が30px以上拡大する",
  intent="頼みごとをする", sil="顔前で合掌した縦長",
  effect_name="提灯の明滅", prop_name="", deform="肘の伸展",
  intensity="中", uniq="依頼専用の上目づかい", similar="001"),

 dict(n="003", meaning="ごめん", cat=C, comp="seated_lying_back", tags=["seated_lying_back","full_body"],
  mf="low_full_body_sink", sp="vertical_descend_deep", tempo="slow", beat="single_deep",
  hold=620, short_c=58, lr="long_hold_slow_return", disp=42, search=8,
  moving=["head","body","left_arm","right_arm","lure_light"], fixed=["legs_or_feet"],
  ha="hip", roi=ROI_SEAT, travel=False, bbox=SEAT_BBOX, hip=[90,140], sh=[90,110],
  pve="床に着いた両手と最も低い頭",
  cues=dict(eyes="固く閉じる", brows="強く下げた八の字", mouth="への字に結ぶ",
            cheeks="", hands="床の前方へ両手をつく", posture="正座から深く頭を下げた完成状態",
            prop="", effect="提灯が消えかける"),
  story=["正座し、床へ両手をつき、頭を深く下げた完成した謝罪の姿勢",
         "背中をわずかに起こして息を吸い、提灯が一度だけ強く灯る",
         "肩と頭が前下方へ落ちる途中。肘が曲がり床との距離が縮む",
         "40個中最も低い姿勢。頭頂が42px沈み、提灯が床に触れる",
         "頭が数px戻るが、肩はまだ落ちたまま余韻を残す",
         "背中が起き始め、提灯が弱く灯り直す"],
  pat="F01 と F12 の頭頂Y座標が42px以上異なる",
  intent="深く謝る", sil="正座して床へ伏せた横長の低い塊",
  effect_name="提灯の消灯と再点灯", prop_name="", deform="上半身の深い沈み込み",
  intensity="強", uniq="40個中最も低い姿勢", similar="001,025"),

 dict(n="004", meaning="了解", cat=C, comp="face_centered", tags=["face_centered","upper_body"],
  mf="single_arm_snap", sp="diagonal_arc_up", tempo="fast", beat="single_snap",
  hold=300, short_c=62, lr="snap_stop_short_recoil", disp=36, search=8,
  moving=["right_arm","head","face_parts"], fixed=["legs_or_feet","body","left_arm","tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="額の横で止まった右手",
  cues=dict(eyes="きりっと開いた横長", brows="鋭く上げる", mouth="真一文字",
            cheeks="", hands="右手を額の横へ当てる", posture="胸を張った直立",
            prop="", effect="提灯が一瞬だけ強く光る"),
  story=["右手を額の横へ当て、正面を見据えた完成した敬礼",
         "手を頬の横まで下げ、肘を体側へ絞って溜める",
         "肘が開き、手が斜め上へ弧を描いて上がる途中",
         "額の横で急停止。手先が36px移動し、提灯が最大光量になる",
         "反動で体だけが小さく沈み、手は額の位置を保つ",
         "肩の力が抜け、手がわずかに緩んで敬礼の形へ収まる"],
  pat="F01 と F11 の右手先端が斜め上へ36px以上移動する",
  intent="指示を受けた返事", sil="片手を額へ当てた直立",
  effect_name="提灯の閃光", prop_name="", deform="",
  intensity="中", uniq="40個中唯一の敬礼", similar="005"),

 dict(n="005", meaning="はい", cat=C, comp="full_body", tags=["full_body"],
  mf="head_vertical", sp="vertical_oscillate", tempo="medium", beat="double_uneven",
  hold=380, short_c=68, lr="double_nod_settle", disp=28, search=8,
  moving=["head","lure_light","right_arm","face_parts"], fixed=["legs_or_feet","body","left_arm"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="真上へ伸ばした右手と頭の上下",
  cues=dict(eyes="大きく開いた丸", brows="上げた水平", mouth="開いた小さな楕円",
            cheeks="", hands="右手を真上へまっすぐ上げる", posture="背筋を伸ばした直立",
            prop="", effect="提灯が上向きに灯る"),
  story=["右手を真上へ上げ、正面を見た完成した挙手",
         "顎をわずかに上げ、首の後ろを伸ばして溜める",
         "頭が前下方へ落ちる途中。挙手した腕は位置を保つ",
         "1回目の大きなうなずき。頭頂が28px沈む",
         "頭が戻り、間を置いて2回目の小さなうなずきへ入る",
         "小さくうなずいた余韻から正面へ戻る"],
  pat="F01 と F11 の頭頂Y座標が28px以上異なり、うなずきの深さが2回で異なる",
  intent="はっきり返事をする", sil="片手を真上へ伸ばした最も縦長の直立",
  effect_name="提灯の上向き点灯", prop_name="", deform="首の屈伸",
  intensity="中", uniq="縦長の挙手", similar="004"),

 dict(n="006", meaning="いいね", cat=C, comp="upper_body", tags=["upper_body"],
  mf="forward_pop", sp="z_axis_scale_pop", tempo="fast", beat="single_pop",
  hold=340, short_c=66, lr="overshoot_settle", disp=38, search=8,
  moving=["right_arm","face_parts","head"], fixed=["legs_or_feet","body","left_arm","tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="手前へ突き出した大きな親指",
  cues=dict(eyes="細めた笑い目", brows="上げた水平", mouth="開いた笑いの弧",
            cheeks="赤み", hands="右手の親指を立てて手前へ出す", posture="やや胸を張る",
            prop="", effect="提灯が明るく灯る"),
  story=["親指を立てた右手を手前へ出し、笑顔で正面を見た完成ポーズ",
         "手を胸の奥へ引き、肘を絞って親指を小さく見せる",
         "肘が伸び、親指が奥から手前へ向かって拡大し始める",
         "親指が最大サイズで手前へ突き出る。見かけ幅が38px拡大する",
         "行き過ぎた分がわずかに戻り、小さくオーバーシュートする",
         "収束して安定した親指の位置へ落ち着く"],
  pat="F01 と F11 の親指の見かけ幅が38px以上拡大する",
  intent="肯定・称賛", sil="親指を手前へ突き出した上半身",
  effect_name="提灯の点灯", prop_name="", deform="奥行き方向の拡大",
  intensity="中", uniq="手前へ拡大する親指", similar="022"),
]

ITEMS += [
 dict(n="007", meaning="ダメ", cat=C, comp="face_centered", tags=["face_centered"],
  mf="lateral_refusal", sp="horizontal_sweep_head", tempo="medium", beat="double_round_trip",
  hold=360, short_c=72, lr="center_stop", disp=26, search=8,
  moving=["head","lure_light","face_parts"], fixed=["legs_or_feet","body","left_arm","right_arm"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="胸の前で組んだ大きなX",
  cues=dict(eyes="固く閉じる", brows="強く下げる", mouth="への字に結ぶ",
            cheeks="", hands="両腕を胸前で大きなXに組む", posture="正面向きの直立",
            prop="", effect="提灯が赤みを帯びて灯る"),
  story=["両腕を胸前で大きなXに組み、目を閉じた完成した拒否",
         "頭を右へわずかに傾けて溜める。腕のXは動かさない",
         "頭が左へ振れる途中。提灯が遅れて追従する",
         "頭が左端まで26px振れ切る。Xの位置は1pxも動かない",
         "頭が右端へ振れ戻り、2往復目に入る",
         "中央で明確に止まり、提灯の揺れだけが残る"],
  pat="F01 と F11 の頭中心X座標が26px以上異なり、腕のXは固定領域として画素一致する",
  intent="断る・否定する", sil="胸前に大きなXを組んだ直立",
  effect_name="赤い提灯", prop_name="", deform="",
  intensity="強", uniq="中央の大きなX", similar="008"),

 dict(n="008", meaning="待って", cat=C, comp="face_centered", tags=["face_centered","upper_body"],
  mf="dual_hand_halt", sp="z_axis_forward_dual", tempo="fast", beat="single_halt",
  hold=320, short_c=64, lr="body_only_recoil", disp=32, search=8,
  moving=["left_arm","right_arm","body","head"], fixed=["legs_or_feet","tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="正面へ開いた両手のひら",
  cues=dict(eyes="真剣に見開いた丸", brows="下げて寄せる", mouth="小さく開いた楕円",
            cheeks="", hands="両手のひらを正面へ開いて出す", posture="やや前傾",
            prop="", effect="提灯が短く明滅"),
  story=["両手のひらを正面へ開いて出した完成した制止のポーズ",
         "両肘を体側へ引き、手のひらを胸の奥へ引き寄せて溜める",
         "両肘が同時に伸び、手のひらが奥から手前へ進む途中",
         "両手が32px手前へ突き出て急停止。手のひらが最大に見える",
         "手は止まったまま、胴体だけが反動で後ろへ小さく揺れる",
         "胴体が戻り、手のひらの位置が安定する"],
  pat="F01 と F11 の両手のひらの見かけ幅が32px以上拡大し、停止が1フレーム以上保持される",
  intent="相手を止める", sil="両手のひらを正面へ開いた上半身",
  effect_name="提灯の明滅", prop_name="", deform="胴体の反動",
  intensity="強", uniq="開いた両手の制止", similar="007,002"),

 dict(n="009", meaning="おつかれ", cat=C, comp="seated_lying_back", tags=["seated_lying_back","prop_acting"],
  mf="prop_acting_drink", sp="arc_to_mouth", tempo="slow", beat="three_stage",
  hold=560, short_c=62, lr="asymmetric_three_step", disp=30, search=8,
  moving=["left_arm","right_arm","head","prop","effect"], fixed=["legs_or_feet","body"],
  ha="hip", roi=ROI_SEAT, travel=False, bbox=SEAT_BBOX, hip=[90,140], sh=[90,110],
  pve="両手で抱えた湯気の立つマグ",
  cues=dict(eyes="穏やかに細める", brows="力を抜いた水平", mouth="小さく閉じる",
            cheeks="淡い赤み", hands="両手でマグを胸元に抱える", posture="脱力した座り姿",
            prop="ソフビ成型のマグ（抜き穴つき）", effect="湯気が3筋"),
  story=["座って両手でマグを抱え、湯気が立つ完成した休息の姿勢",
         "肘をわずかに開き、マグを胸元から浮かせて溜める",
         "マグが弧を描いて口元へ上がる途中。湯気が斜めに流れる",
         "マグが口に触れ30px上がる。一口飲み、湯気が最も濃くなる",
         "マグが胸元へ下り、息を吐いて湯気が横へ広がる",
         "肩が下がって脱力し、マグの位置が最初より低く収まる"],
  pat="F01 と F12 のマグ中心Y座標が30px以上異なる",
  intent="ねぎらう", sil="座ってマグを抱えた低い塊",
  effect_name="湯気3筋", prop_name="マグ", deform="肩の下降",
  intensity="弱", uniq="マグと脱力した座り姿", similar="019"),

 dict(n="010", meaning="おはよう", cat=C, comp="full_body", tags=["full_body","deformation_or_effect_led"],
  mf="vertical_stretch", sp="vertical_extend", tempo="medium", beat="single_slow_start",
  hold=440, short_c=74, lr="slow_rise_fast_release", disp=40, search=12,
  moving=["body","head","left_arm","right_arm","lure_light"], fixed=["legs_or_feet"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="真上へ伸び切った全身",
  cues=dict(eyes="半分閉じた眠気の残る線", brows="上げた八の字", mouth="開いたあくびの楕円",
            cheeks="", hands="両手を頭上へ伸ばす", posture="全身を縦へ伸ばす",
            prop="", effect="提灯がゆっくり灯り始める"),
  story=["両手を頭上へ伸ばし、全身を縦へ伸ばした完成した伸びの姿勢",
         "膝と背中を曲げてしゃがみ込み、全身を縮めて溜める",
         "膝が伸び、胴体が上へ持ち上がる途中。腕はまだ曲がっている",
         "全身が最も伸び切り、頭頂が40px上がる。目が開き提灯が灯る",
         "力が急に抜け、肩と腕が落ちて胴体が縮む",
         "自然な立ち姿へ戻り、提灯が灯ったまま残る"],
  pat="F01 と F11 の全身高さが40px以上変化する",
  intent="朝のあいさつ", sil="全身を縦へ伸ばした40個中最も縦長",
  effect_name="提灯の点灯", prop_name="", deform="全身の伸縮",
  intensity="中", uniq="最も縦長のシルエット", similar="005"),

 dict(n="011", meaning="おやすみ", cat=C, comp="seated_lying_back", tags=["seated_lying_back","prop_acting"],
  mf="embrace_pull_in", sp="inward_converge", tempo="slow", beat="three_stage_slow",
  hold=580, short_c=64, lr="hold_sleep_pose", disp=26, search=8,
  moving=["left_arm","right_arm","head","tail_fin","prop"], fixed=["legs_or_feet","body"],
  ha="contact_line", roi=ROI_LIE, travel=False, bbox=LIE_BBOX, hip=[96,150], sh=[80,132],
  pve="抱き込んだ枕と沈んだ頬",
  cues=dict(eyes="閉じた弧", brows="力を抜いた水平", mouth="小さく閉じる",
            cheeks="枕に押されて沈む", hands="枕を両腕で抱える", posture="横向きに寝る",
            prop="ソフビ成型の枕（抜き穴つき）", effect="提灯が最小光量"),
  story=["横向きに寝て枕を抱え、目を閉じた完成した就寝の姿勢",
         "両腕を開いて枕から少し離し、体をわずかに反らす",
         "腕が枕を胸へ引き寄せる途中。尾ひれが体から離れる",
         "枕を最も強く抱き込み、頭と頬が26px沈む。尾ひれが体へ巻き付く",
         "腕の力が緩み、枕がわずかに戻るが頭は沈んだまま",
         "呼吸ひとつ分だけ胸が上下し、睡眠姿勢のまま保持する"],
  pat="F01 と F12 の頭中心Y座標が26px以上沈み、尾ひれ先端が別軌道で動く",
  intent="就寝のあいさつ", sil="横向きに寝て枕を抱えた最も横長",
  effect_name="提灯の減光", prop_name="枕", deform="頬と頭の沈み込み",
  intensity="弱", uniq="枕・横向き・抱き込みと沈み込み", similar="019,025"),

 dict(n="012", meaning="またね", cat=C, comp="full_body", tags=["full_body"],
  mf="wave_and_exit", sp="horizontal_travel_wave", tempo="medium", beat="double_wave",
  hold=400, short_c=76, lr="edge_then_reset", disp=44, search=10,
  moving=["right_arm","body","legs_or_feet","head","face_parts"], fixed=["tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=True, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="高く上げて左右へ振る右手",
  cues=dict(eyes="片目をウインク", brows="上げた水平", mouth="開いた笑いの弧",
            cheeks="赤み", hands="右手を高く上げる", posture="やや斜め向きの直立",
            prop="", effect="提灯が明るく灯る"),
  story=["右手を高く上げ、片目をウインクした完成した別れのポーズ",
         "手を右へ寄せて溜め、体重を右足へ移す",
         "手が左へ振れる途中。同時に足が半歩分だけ横へ進み始める",
         "手が左端まで44px振れ切る。体は半歩横へ移動している",
         "手が右へ振れ戻り、2回目の手振りに入る",
         "足がゆっくり元の位置へ戻り、手が上げたまま静止する"],
  pat="F01 と F11 の右手先端X座標が44px以上異なり、足元アンカーが expected_anchor_path に沿う",
  intent="別れのあいさつ", sil="片手を高く上げた斜め向きの直立",
  effect_name="提灯の点灯", prop_name="", deform="",
  intensity="中", uniq="40個中唯一の手振りと半歩移動", similar="005",
  path=[(1,90,150),(5,92,150),(9,102,150),(13,112,150),(17,103,150),(20,91,150)]),
]

ITEMS += [
 dict(n="013", meaning="にっこり", cat=P, comp="face_centered", tags=["face_centered"],
  mf="dual_arm_bloom", sp="outward_arc_spread", tempo="slow", beat="single_bloom",
  hold=540, short_c=66, lr="open_hold_long", disp=30, search=8,
  moving=["left_arm","right_arm","face_parts","cheeks"], fixed=["legs_or_feet","body","tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="左右へ開いた両手と三日月の目",
  cues=dict(eyes="三日月に細めた笑い目", brows="穏やかに上げる", mouth="小さく閉じた笑いの弧",
            cheeks="頬横に淡い赤み", hands="両手を頬の横へ開く", posture="正面向きの直立",
            prop="", effect="提灯が柔らかく灯る"),
  story=["両手を頬の横へ開き、三日月の目で微笑む完成ポーズ",
         "胸の前で両腕を交差させ、肩を内へ絞って溜める",
         "両腕が左右へ弧を描いて開き始める。頬の赤みが濃くなる",
         "両手先が30px外へ開き切る。笑顔と頬が最も開いた状態",
         "腕がわずかに内へ戻るが、笑顔は開いたまま保持する",
         "腕が頬の横の定位置へ静かに収まる"],
  pat="F01 と F12 の両手先端の間隔が30px以上拡大する",
  intent="やわらかい笑顔で応じる", sil="両手を頬横へ開いた直立",
  effect_name="提灯の柔光", prop_name="", deform="頬の膨らみ",
  intensity="弱", uniq="静かな感情でも手の軌道を大きく見せる", similar="023"),

 dict(n="014", meaning="爆笑", cat=P, comp="upper_body", tags=["upper_body","deformation_or_effect_led"],
  mf="fore_aft_rotation", sp="pitch_oscillate", tempo="fast", beat="triple",
  hold=280, short_c=68, lr="varied_three_beat", disp=36, search=10,
  moving=["body","head","left_arm","right_arm","lure_light"], fixed=["legs_or_feet"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="腹を抱えて折れ曲がった上半身",
  cues=dict(eyes="強く閉じた への字", brows="強く上げる", mouth="大きく開いた笑いの口",
            cheeks="濃い赤み", hands="両手で腹を抱える", posture="横に広がった前屈",
            prop="", effect="提灯が激しく揺れる"),
  story=["両手で腹を抱え、大口で笑う横広の完成ポーズ",
         "上半身を後ろへ反らして溜め、提灯が後方へ倒れる",
         "上半身が前へ倒れる途中。腕は腹に固定されたまま",
         "最も深い前屈。頭頂が36px下がり提灯が前方へ振れる",
         "のけぞりへ切り返し、2拍目・3拍目の高さと間隔を変える",
         "3拍目の後に減速し、腹を抱えた姿勢へ戻る"],
  pat="F01 と F11 の頭頂Y座標が36px以上異なり、3拍の振幅が互いに異なる",
  intent="大笑いする", sil="腹を抱えた横広の前屈",
  effect_name="提灯の揺動", prop_name="", deform="上半身の前後回転",
  intensity="強", uniq="腹を抱える横広ポーズ", similar="015"),

 dict(n="015", meaning="うれしい", cat=P, comp="full_body", tags=["full_body"],
  mf="repeated_hop", sp="vertical_double_leap", tempo="fast", beat="double_leap",
  hold=260, short_c=70, lr="small_then_large_land", disp=46, search=28,
  moving=["body","head","legs_or_feet","left_arm","right_arm","tail_fin"], fixed=[],
  ha="body_center", roi=ROI_TORSO, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="宙に浮いた足と胸前の両拳",
  cues=dict(eyes="開いた笑い目", brows="上げた水平", mouth="開いた笑いの弧",
            cheeks="赤み", hands="胸の前に小さな両拳", posture="立位からの跳躍準備",
            prop="", effect="提灯が上へなびく"),
  story=["胸前に両拳を構え、笑顔で立つ完成した喜びの姿勢",
         "膝を曲げてしゃがみ、拳を下へ引いて溜める",
         "膝が伸びて足が床から離れる途中。尾ひれが下へ流れる",
         "2回目の大ジャンプ最高点。胴体が46px上がり足裏が完全に見える",
         "膝を曲げて着地し、胴体が潰れて衝撃を受ける",
         "潰れから戻り、拳を胸前へ構え直す"],
  pat="F01 と F11 の胴体中心Y座標が46px以上異なり、1回目と2回目の跳躍高さが異なる",
  intent="喜びを表す", sil="宙に浮いて足裏が見える全身",
  effect_name="提灯のなびき", prop_name="", deform="着地の潰れ",
  intensity="中", uniq="高さの違う2回の跳躍", similar="016"),

 dict(n="016", meaning="やったー", cat=P, comp="full_body", tags=["full_body"],
  mf="grand_jump", sp="vertical_ballistic", tempo="medium", beat="single_ballistic",
  hold=460, short_c=72, lr="airborne_pause_squash_land", disp=54, search=32,
  moving=["body","head","legs_or_feet","left_arm","right_arm","tail_fin","lure_light"], fixed=[],
  ha="body_center", roi=ROI_TORSO, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="真上へ伸ばした両手と空中姿勢",
  cues=dict(eyes="輝く星形に近い大きな目", brows="強く上げる", mouth="大きく開いた歓喜の口",
            cheeks="濃い赤み", hands="両手を真上へ上げる", posture="バンザイの直立",
            prop="", effect="提灯が最大光量"),
  story=["両手を真上へ上げ、輝く目で立つ完成したバンザイ",
         "深くしゃがみ込み、両手を下へ振り下ろして溜める",
         "足が床から離れ、両手が上へ振り上がる途中",
         "最高点で一瞬止まる。胴体が54px上がり手足が最も開く",
         "膝を曲げて着地し、胴体が縦に潰れる",
         "潰れから戻り、バンザイの形へ立ち上がる"],
  pat="F01 と F12 の胴体中心Y座標が54px以上異なり、最高点で1フレーム以上静止する",
  intent="達成を喜ぶ", sil="両手を真上へ伸ばした空中姿勢",
  effect_name="提灯の最大発光", prop_name="", deform="着地の縦潰れ",
  intensity="強", uniq="両手バンザイと空中姿勢", similar="015"),

 dict(n="017", meaning="大好き", cat=P, comp="upper_body", tags=["upper_body","prop_acting"],
  mf="catch_and_embrace", sp="descend_then_inward", tempo="medium", beat="three_stage_catch",
  hold=480, short_c=78, lr="hold_embrace", disp=40, search=8,
  moving=["left_arm","right_arm","prop","head","face_parts"], fixed=["legs_or_feet","body","tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="体の前で抱えた大きなハート",
  cues=dict(eyes="幸せに閉じた弧", brows="穏やかに上げる", mouth="小さく閉じた笑い",
            cheeks="濃い赤み", hands="大きなハートを両腕で抱える", posture="やや後傾の直立",
            prop="ソフビ成型の大きなハート（抜き穴つき）", effect=""),
  story=["体の前で大きなハートを抱え、幸せそうに目を閉じた完成ポーズ",
         "両腕を左右へ大きく開き、ハートが上方へ離れる",
         "ハートが上から落下し、開いた両腕がそれを受けに向かう途中",
         "両腕がハートを受け止める。腕先が40px移動し接触が生まれる",
         "受けた勢いで上半身がわずかに沈み、ハートが胸へ寄る",
         "ハートを胸へ強く抱きしめ、その姿勢を保持する"],
  pat="F01 と F12 の両腕先端が40px以上移動し、ハートと腕の接触状態が変化する",
  intent="強い好意を伝える", sil="体前面に大きなハートを抱えた上半身",
  effect_name="", prop_name="大きなハート", deform="受け止めの沈み込み",
  intensity="強", uniq="体前面の大きなハートと抱擁動作", similar="034,021"),

 dict(n="018", meaning="照れる", cat=P, comp="face_centered", tags=["face_centered"],
  mf="conceal_reveal", sp="face_occlusion_toggle", tempo="slow", beat="asymmetric_double",
  hold=520, short_c=60, lr="long_hide_quick_peek", disp=24, search=8,
  moving=["left_arm","right_arm","face_parts","head"], fixed=["legs_or_feet","body","tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="頬に当てた両手と濃く染まった頬",
  cues=dict(eyes="伏し目の弧", brows="八の字に上げる", mouth="小さくすぼめる",
            cheeks="最も濃い赤み", hands="両手を頬へ当てる", posture="肩をすぼめた直立",
            prop="", effect="提灯が淡いピンクに灯る"),
  story=["両手を頬へ当て、伏し目で頬を濃く染めた完成ポーズ",
         "肩をさらにすぼめ、手を頬から顔の中央へ寄せて溜める",
         "両手が顔全体を覆いに向かう途中。指の隙間が閉じていく",
         "両手で顔を完全に隠す。手先が24px移動し目が見えなくなる",
         "右手だけを大きく開き、片目で素早く覗く",
         "再び手で顔を隠し、頬の赤みだけが残る"],
  pat="F01 と F12 の顔の露出面積が24px相当以上減少し、F15 で片目だけが露出する",
  intent="照れを表す", sil="両手で顔を覆った直立",
  effect_name="ピンクの提灯", prop_name="", deform="肩のすぼめ",
  intensity="中", uniq="顔を隠す・覗くの別ポーズ", similar="030"),
]

ITEMS += [
 dict(n="019", meaning="ほっとする", cat=P, comp="seated_lying_back", tags=["seated_lying_back"],
  mf="release_and_slump", sp="outward_then_descend", tempo="slow", beat="three_stage_release",
  hold=565, short_c=70, lr="end_in_slumped_pose", disp=32, search=8,
  moving=["left_arm","right_arm","head","body","effect"], fixed=["legs_or_feet"],
  ha="hip", roi=ROI_SEAT, travel=False, bbox=SEAT_BBOX, hip=[90,140], sh=[90,110],
  pve="床へ下ろした両手と吐き出す白い息",
  cues=dict(eyes="閉じた安堵の弧", brows="力を抜いて下げる", mouth="小さく開いて息を吐く",
            cheeks="", hands="胸の前で両手を軽く重ねる", posture="肩を落とした座り姿",
            prop="", effect="白い息が横へ1筋"),
  story=["座って胸前に両手を重ね、肩を落として目を閉じた完成した安堵",
         "胸の前で手をわずかに持ち上げ、息を吸い込む",
         "両手が左右へ開きながら下がる途中。肩が落ち始める",
         "両手先が32px外下へ開き切って床に着き、白い息が横へ流れる",
         "頭と肩がさらに深く沈み、息が薄れていく",
         "沈んだ姿勢のまま、手だけが体側へ静かに寄る"],
  pat="F01 と F12 の両手先端が32px以上下外へ移動し、頭と肩が12px以上沈む",
  intent="安心したことを伝える", sil="座って両手を床へ下ろした低い塊",
  effect_name="白い息", prop_name="", deform="肩と頭の沈み込み",
  intensity="弱", uniq="手の開放と脱力した座り姿", similar="009,025"),

 dict(n="020", meaning="わくわく", cat=P, comp="upper_body", tags=["upper_body"],
  mf="lean_and_piston", sp="alternating_forward_thrust", tempo="fast", beat="accelerating_quad",
  hold=290, short_c=64, lr="accelerate_then_sudden_stop", disp=34, search=10,
  moving=["left_arm","right_arm","body","legs_or_feet","head"], fixed=["tail_fin"],
  ha="hip", roi=ROI_HIP, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="交互に前へ突き出す両拳",
  cues=dict(eyes="大きく見開いた丸", brows="高く上げる", mouth="開いた期待の楕円",
            cheeks="赤み", hands="胸の前に両拳を構える", posture="前傾姿勢",
            prop="", effect="提灯が細かく明滅"),
  story=["胸前に両拳を構え、大きな丸目で前傾した完成した期待の姿勢",
         "上半身をさらに前へ寄せ、左拳を胸の奥へ引いて溜める",
         "左拳が前へ出て、同時に左足が踏み替わる途中",
         "4拍目で両拳を同時に34px前へ突き出し、そこで突然止まる",
         "止まった位置から拳が胸へ戻り、足の踏み替えが収まる",
         "前傾を保ったまま両拳を構え直す"],
  pat="F01 と F11 の拳先端が34px以上前へ移動し、拍ごとに表示時間が短くなる",
  intent="期待や高揚を伝える", sil="前傾して両拳を構えた上半身",
  effect_name="提灯の高速明滅", prop_name="", deform="",
  intensity="強", uniq="前傾と手足の4拍交互動作", similar="032"),

 dict(n="021", meaning="感動", cat=P, comp="face_centered", tags=["face_centered","deformation_or_effect_led"],
  mf="tear_catch_return", sp="arc_up_then_return", tempo="slow", beat="three_stage_tear",
  hold=500, short_c=72, lr="hold_at_chest", disp=36, search=8,
  moving=["left_arm","right_arm","effect","face_parts"], fixed=["legs_or_feet","body","tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="胸に重ねた両手と一粒の涙",
  cues=dict(eyes="潤んだ大きな目にハイライト2点", brows="八の字に上げる", mouth="小さく閉じた笑み",
            cheeks="淡い赤み", hands="両手を胸に重ねる", posture="やや上を向いた直立",
            prop="", effect="右目に一粒の涙（抜き穴つき）"),
  story=["胸に両手を重ね、潤んだ目で微笑む完成した感動の姿勢",
         "肩をわずかに上げ、胸の手を浮かせて息を止める",
         "両手が大きな弧を描いて目元へ上がる途中。涙が膨らむ",
         "手が目元に届き36px移動。落ちてきた涙を手で受ける",
         "手が涙を持ったまま胸へ戻り始め、笑みが深くなる",
         "両手を胸へ重ね直し、その姿勢を保持する"],
  pat="F01 と F12 の両手先端が36px以上上方へ移動し、涙の位置が別軌道で変化する",
  intent="心を動かされたことを伝える", sil="胸に手を重ね上を向いた直立",
  effect_name="一粒の涙", prop_name="", deform="",
  intensity="中", uniq="笑顔・一粒の涙・手の往復軌道", similar="026,017"),

 dict(n="022", meaning="すごい", cat=P, comp="upper_body", tags=["upper_body","full_body","prop_acting"],
  mf="retrieve_and_raise", sp="behind_to_overhead", tempo="medium", beat="three_stage_retrieve",
  hold=450, short_c=66, lr="hold_star_forward", disp=52, search=10,
  moving=["right_arm","left_arm","body","head","prop"], fixed=["legs_or_feet"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="頭上へ掲げた大きな星",
  cues=dict(eyes="星形の瞳", brows="高く上げる", mouth="大きく開いた感嘆の口",
            cheeks="", hands="右手に大きな星を持ち掲げる", posture="上半身をひねった直立",
            prop="ソフビ成型の大きな星（抜き穴つき）", effect=""),
  story=["右手で大きな星を頭上へ掲げ、星形の瞳で見上げた完成ポーズ",
         "空の右手を背中の後ろへ回し、上半身を反対へひねって溜める",
         "背後から星をつかんだ右手が体側を通って上がる途中",
         "腕と上半身を大きく動かし、星を頭上へ52px掲げ切る",
         "掲げた勢いで上半身が反対へ振れ、星が遅れて追従する",
         "星を前方へ突き出した決めの位置で静止する"],
  pat="F01 と F12 の星中心が52px以上移動し、右手が背面から頭上へ経路を変える",
  intent="強い称賛を伝える", sil="頭上に大きな星を掲げた上半身",
  effect_name="", prop_name="大きな星", deform="上半身のひねり",
  intensity="強", uniq="背後から現れる大きな星", similar="038,006"),

 dict(n="023", meaning="拍手", cat=P, comp="face_centered", tags=["face_centered","upper_body"],
  mf="symmetric_clap", sp="lateral_open_close", tempo="fast", beat="triple_short_short_long",
  hold=270, short_c=72, lr="short_short_long", disp=28, search=8,
  moving=["left_arm","right_arm","face_parts"], fixed=["legs_or_feet","body","head","tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="胸の前で開閉する左右対称の両手",
  cues=dict(eyes="細めた笑い目", brows="上げた水平", mouth="開いた笑いの弧",
            cheeks="赤み", hands="胸の前に開いた両手を置く", posture="正面向きの直立",
            prop="", effect="打点に小さな衝撃線"),
  story=["胸の前に開いた両手を置き、笑顔で正面を向いた完成ポーズ",
         "両手を左右へ大きく引き離し、肘を外へ張って溜める",
         "両手が中央へ向かって同時に近づく途中",
         "両手が中央で合わさる。左右の間隔が28px縮まり衝撃線が出る",
         "反動で再び開き、2拍目・3拍目へ入る",
         "3拍目の間隔を長く取り、開いた手の位置で静止する"],
  pat="F01 と F11 の左右の手の間隔が28px以上変化し、3拍の間隔が短・短・長になる",
  intent="称賛・祝福", sil="胸前で両手を開いた左右対称の直立",
  effect_name="衝撃線", prop_name="", deform="",
  intensity="中", uniq="左右対称の手の開閉", similar="013,008"),

 dict(n="024", meaning="応援", cat=P, comp="upper_body", tags=["upper_body","deformation_or_effect_led"],
  mf="upward_thrust", sp="diagonal_extend_up", tempo="fast", beat="single_thrust",
  hold=330, short_c=74, lr="overshoot_flame_lag", disp=42, search=10,
  moving=["right_arm","body","effect","head"], fixed=["legs_or_feet","left_arm"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="斜め上へ突き上げた拳と背後の炎",
  cues=dict(eyes="強く見開いた丸", brows="鋭く下げて力む", mouth="大きく開いた掛け声の口",
            cheeks="", hands="右拳を高く上げる", posture="胸を張った直立",
            prop="", effect="背後に三層の炎（抜き穴つき）"),
  story=["右拳を高く上げ、背後に炎が立つ完成した応援のポーズ",
         "拳を肩の下まで引き下げ、膝と背中をたわめて溜める",
         "肩から拳が斜め上へ伸び始め、炎の根元が持ち上がる",
         "拳が42px突き上がり、炎が最も高く立つ。行き過ぎて反る",
         "拳が行き過ぎた分だけ戻り、炎だけが遅れて揺れ続ける",
         "拳が定位置へ収まり、炎が最後に収束する"],
  pat="F01 と F11 の拳先端が斜め上へ42px以上移動し、炎の収束が拳より遅れる",
  intent="相手を励ます", sil="片拳を高く上げ背後に炎が立つ上半身",
  effect_name="三層の炎", prop_name="", deform="",
  intensity="強", uniq="片拳と炎", similar="039,016"),
]

ITEMS += [
 dict(n="025", meaning="悲しい", cat=T, comp="full_body", tags=["full_body","deformation_or_effect_led"],
  mf="hand_drop_body_sink", sp="vertical_descend_staged", tempo="slow", beat="double_sink",
  hold=610, short_c=62, lr="long_low_hold", disp=30, search=10,
  moving=["left_arm","right_arm","head","body","lure_light"], fixed=["legs_or_feet"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="力なく垂れた両手と丸めた背中",
  cues=dict(eyes="下を向いた伏し目", brows="強く下げた八の字", mouth="小さなへの字",
            cheeks="", hands="胸の前で両手を弱く合わせる", posture="背中を丸めた直立",
            prop="", effect="提灯が消えかける"),
  story=["背中を丸め、胸前に力なく手を置いて視線を落とした完成ポーズ",
         "肩をわずかに上げ、息を吸って一度だけ持ち上がる",
         "両手が胸から下へ落ち始め、肩と頭が同時に下がる途中",
         "1段目の沈み込み。頭・肩・胴体が30px沈み、手が体側へ垂れる",
         "間を置いて2段目にさらに沈み、最も低い姿勢になる",
         "最低位置で長く止まり、ごくわずかに戻り始める"],
  pat="F01 と F12 の頭頂Y座標が30px以上沈み、涙を使わずに沈み込みだけで悲しみを示す",
  intent="落胆を伝える", sil="背中を丸め手が垂れた縦に縮んだ直立",
  effect_name="提灯の消灯", prop_name="", deform="全身の段階的沈み込み",
  intensity="中", uniq="涙を使わない大きな沈み込み", similar="026,031"),

 dict(n="026", meaning="泣く", cat=T, comp="face_centered", tags=["face_centered"],
  mf="wipe_and_drip", sp="diagonal_wipe", tempo="medium", beat="single_continuous",
  hold=430, short_c=68, lr="new_single_tear", disp=28, search=8,
  moving=["right_arm","effect","face_parts","head"], fixed=["legs_or_feet","body","left_arm","tail_fin"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="右目から落ちる一粒の涙",
  cues=dict(eyes="潤んだ目、右目に涙", brows="八の字に上げる", mouth="への字に歪む",
            cheeks="", hands="右手を目元へ添える", posture="やや前かがみ",
            prop="", effect="一粒の涙（抜き穴つき）"),
  story=["右手を目元へ添え、右目から一粒の涙がこぼれる完成ポーズ",
         "手を頬の下へ下げ、涙が目の縁で膨らむ",
         "手が斜め上へ動いて目元へ向かう途中。涙が頬を伝い始める",
         "手が涙を拭い切る。手先が28px移動し涙が消える",
         "手が頬から離れて下がり、目の縁に新しい涙が生まれる",
         "新しい涙が一粒だけこぼれ、手が目元へ戻る"],
  pat="F01 と F11 の右手先端が斜めに28px以上移動し、涙の有無が切り替わる",
  intent="悲しみ・泣く", sil="片手を目元へ添えた直立",
  effect_name="一粒の涙", prop_name="", deform="",
  intensity="中", uniq="涙は常に1粒だけ", similar="021,025"),

 dict(n="027", meaning="怒る", cat=T, comp="full_body", tags=["full_body","deformation_or_effect_led"],
  mf="percussive_full_body", sp="stomp_and_burst", tempo="fast", beat="double_percussive",
  hold=310, short_c=70, lr="offset_fist_and_foot", disp=32, search=10,
  moving=["left_arm","right_arm","legs_or_feet","effect","face_parts"], fixed=["body"],
  ha="hip", roi=ROI_HIP, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="体側で握った両拳と赤い怒り記号",
  cues=dict(eyes="つり上げた鋭い目", brows="強く下げて寄せる", mouth="歯を食いしばる",
            cheeks="", hands="体側で両拳を強く握る", posture="踏ん張った直立",
            prop="", effect="頭上に赤い怒り記号（抜き穴つき）"),
  story=["体側で両拳を握り、歯を食いしばった完成した怒りのポーズ",
         "両拳を後方へ引き、片足を持ち上げて溜める",
         "拳が下へ振り下ろされる途中。足はまだ空中にある",
         "拳が32px振り下ろされ、怒り記号が破裂して最大になる",
         "拳から遅れて片足が床を踏む。記号が飛び散る",
         "拳と足が別々に収まり、記号が小さく残る"],
  pat="F01 と F11 の拳先端が32px以上移動し、拳と足の最大点フレームが一致しない",
  intent="怒りを伝える", sil="両拳を体側で握った踏ん張り姿勢",
  effect_name="赤い怒り記号の破裂", prop_name="", deform="",
  intensity="強", uniq="正面の両拳と赤い怒り記号", similar="028,024"),

 dict(n="028", meaning="イライラ", cat=T, comp="full_body", tags=["full_body"],
  mf="localized_repetition", sp="single_limb_tap", tempo="fast", beat="triple_tap",
  hold=250, short_c=66, lr="third_beat_strong", disp=24, search=8,
  moving=["legs_or_feet","tail_fin"], fixed=["body","head","left_arm","right_arm"],
  ha="body_center", roi=ROI_TORSO, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="組んだ腕と床を叩く片足",
  cues=dict(eyes="細めた横目", brows="片方だけ上げる", mouth="への字に結ぶ",
            cheeks="", hands="胸の前で腕を組む", posture="片足を前へ出した直立",
            prop="", effect="足元に小さな衝撃線"),
  story=["腕を組み、横目で片足を前へ出した完成したいらだちの姿勢",
         "前の足のつま先だけを持ち上げて溜める。上半身は動かさない",
         "足が下へ振り下ろされる途中。腕組みは画素単位で固定",
         "足が床を24px分の振り幅で叩く。衝撃線が出る",
         "足が再び上がり、2拍目・3拍目と続く",
         "3拍目だけ強く叩き、足が床に着いたまま止まる"],
  pat="F01 と F11 の足先Y座標が24px以上異なり、上半身が固定領域として画素一致する",
  intent="いらだちを伝える", sil="腕を組んだ直立に片足だけが動く",
  effect_name="衝撃線", prop_name="", deform="",
  intensity="中", uniq="腕組みと足踏み", similar="027,032"),

 dict(n="029", meaning="すねる", cat=T, comp="seated_lying_back", tags=["seated_lying_back","full_body"],
  mf="body_turn_glance_back", sp="yaw_rotation", tempo="slow", beat="three_stage_turn",
  hold=590, short_c=68, lr="three_silhouette_hold", disp=38, search=8,
  moving=["body","head","tail_fin","left_arm","right_arm"], fixed=["legs_or_feet"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="背を向けた体と肩越しに振り返る顔",
  cues=dict(eyes="横目で振り返る", brows="片方を下げる", mouth="頬を膨らませてすぼめる",
            cheeks="大きく膨らむ", hands="体の前で腕を組む", posture="背を向けかけた斜め向き",
            prop="", effect="尾ひれが払われる"),
  story=["斜めに背を向け、肩越しに横目で振り返って頬を膨らませた完成ポーズ",
         "いったん正面を向き直し、頬をさらに膨らませて溜める",
         "体が正面から背面へ回転する途中。尾ひれが遠心力で開く",
         "完全に背を向ける。体幅が38px変化し尾ひれが払われ切る",
         "尾ひれが体側へ戻り、肩がわずかに落ちる",
         "頭だけが肩越しに戻り、横目で振り返る"],
  pat="F01 と F12 の体幅が38px以上変化し、正面・背面・肩越しの3シルエットが区別できる",
  intent="拗ねる・不満を示す", sil="40個中唯一の後ろ向きと肩越しの振り返り",
  effect_name="尾ひれの払い", prop_name="", deform="頬の膨らみ",
  intensity="中", uniq="唯一の後ろ向きと振り返り", similar="028"),

 dict(n="030", meaning="困る", cat=T, comp="face_centered", tags=["face_centered"],
  mf="search_gesture", sp="triangular_gaze_path", tempo="medium", beat="three_stage_gaze",
  hold=410, short_c=74, lr="gaze_order_no_retrace", disp=26, search=8,
  moving=["right_arm","head","face_parts","lure_light"], fixed=["legs_or_feet","body","left_arm"],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="頭をかく右手と八の字の眉",
  cues=dict(eyes="困った半開きの目", brows="八の字に強く下げる", mouth="斜めに歪んだ小さな口",
            cheeks="", hands="右手を頭へ、左手を下げる", posture="非対称に傾いた直立",
            prop="", effect="提灯が力なく揺れる"),
  story=["右手を頭へ当て、左手を下げ、八の字眉で困った完成ポーズ",
         "手を頭頂へ寄せ、首をわずかに右へ傾けて溜める",
         "手が頭をかき始め、視線が左へ動く途中",
         "手が26px動いて最も強く頭をかく。視線が右へ移る",
         "視線が上へ移り、手のかく動きが小さくなる",
         "同じ角度を戻らず、手が頭に触れたまま静止する"],
  pat="F01 と F11 の右手先端が26px以上移動し、視線が左→右→上の順で往復しない",
  intent="困惑を伝える", sil="片手を頭へ当てた非対称の直立",
  effect_name="提灯の弱い揺れ", prop_name="", deform="",
  intensity="中", uniq="非対称の頭かき", similar="018,031"),

 dict(n="031", meaning="不安", cat=T, comp="seated_lying_back", tags=["seated_lying_back","deformation_or_effect_led"],
  mf="clutch_and_shrink", sp="inward_and_down", tempo="medium", beat="uneven_triple",
  hold=470, short_c=62, lr="tremor_as_support_only", disp=30, search=10,
  moving=["left_arm","right_arm","body","head","effect","legs_or_feet"], fixed=[],
  ha="feet_center", roi=ROI_FEET, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="胸の前で固く組んだ両手",
  cues=dict(eyes="揺れる小さな瞳", brows="八の字に強く上げる", mouth="歯を見せた緊張の口",
            cheeks="", hands="胸の前で両手を固く組む", posture="膝を曲げて縮こまる",
            prop="", effect="汗が2粒（抜き穴つき）"),
  story=["膝を曲げて縮こまり、胸前で両手を固く組んだ完成した不安の姿勢",
         "両手を体から離れた位置まで開き、膝を伸ばして溜める",
         "両手が胸へ向かって引き寄せられる途中。膝が曲がり始める",
         "両手が胸で固く組まれる。手先が30px移動し肩と膝が最も縮む",
         "縮んだ姿勢のまま汗が2粒、別々の方向へ落ちる",
         "震えを補助動作として残しつつ、縮こまった姿勢を保つ"],
  pat="F01 と F12 の両手先端が30px以上移動し、頭と肩が12px以上沈み、震えは主動作でない",
  intent="不安を伝える", sil="膝を曲げて縮こまった小さな塊",
  effect_name="2粒の汗", prop_name="", deform="全身の縮こまり",
  intensity="中", uniq="手の大移動・縮こまる姿勢・歯を見せた緊張顔", similar="025,032"),

 dict(n="032", meaning="焦る", cat=T, comp="full_body", tags=["full_body","deformation_or_effect_led"],
  mf="alternating_panic", sp="alternating_lateral_burst", tempo="fast", beat="triple_max_speed",
  hold=240, short_c=72, lr="alternation_led", disp=36, search=10,
  moving=["left_arm","right_arm","legs_or_feet","effect","head"], fixed=["body"],
  ha="hip", roi=ROI_HIP, travel=False, bbox=STAND_BBOX, hip=[90,124], sh=[90,88],
  pve="ばらばらに上げた両手と飛び散る汗",
  cues=dict(eyes="小さく縮んだ瞳", brows="強く上げて寄せる", mouth="大きく開いた慌ての口",
            cheeks="", hands="両手を高さ違いで上げる", posture="前傾して踏み出す",
            prop="", effect="汗が4粒、外向きに飛ぶ（抜き穴つき）"),
  story=["両手を高さ違いに上げ、前傾して汗を飛ばす完成した焦りのポーズ",
         "左手だけを下げて引き、体重を前へ移して溜める",
         "左手が振り上がり、続いて右手が動き始める途中",
         "左手・右手に続いて両手を同時に36px振り上げ、汗が最も多く飛ぶ",
         "手が下がり、汗が外向きの別軌道で落ちていく",
         "左右の交互性を残したまま、手が高さ違いの位置へ戻る"],
  pat="F01 と F11 の両手先端が36px以上移動し、左右の最大点フレームが一致しない",
  intent="焦りを伝える", sil="前傾して両手を高さ違いに上げた全身",
  effect_name="4粒の汗", prop_name="", deform="",
  intensity="強", uniq="前傾・手足の交互性・多数の汗", similar="020,031"),
]

SYMBOL_BBOX = {"w": 104, "h": 104, "cx": 90, "baseline_y": 140}
NO_CUES = dict(eyes="", brows="", mouth="", cheeks="", hands="", posture="", prop="", effect="")

ITEMS += [
 dict(n="033", meaning="OK!", cat=S, comp="symbol", tags=["symbol"],
  mf="glyph_assembly", sp="multi_arc_converge", tempo="fast", beat="three_stage_assembly",
  hold=350, short_c=76, lr="collide_squash_long_hold", disp=58, search=14,
  moving=["glyph_o","glyph_k","glyph_excl"], fixed=[],
  ha="glyph_o_center", roi=[42,74,28,28], travel=True, bbox=SYMBOL_BBOX, hip=None, sh=None,
  pve="太い丸文字で組み上がった OK!",
  cues=dict(NO_CUES, effect="3文字が衝突する瞬間の衝撃線", prop="ソフビ成型の英字3パーツ（各抜き穴つき）"),
  story=["O・K・! が中央で完成し、読みやすく並んだ状態",
         "3文字が左上・右下・上へ別方向に離れ、画面の外周寄りへ散る",
         "3文字が別々の弧を描いて中央へ接近する途中",
         "中央で衝突し、3文字が横方向に一度つぶれる。衝撃線が出る",
         "つぶれから戻り、文字がわずかに離れて反動する",
         "完成形の位置と字形へ収束し、長く静止する"],
  pat="F01 と F12 の O の中心が58px以上移動し、衝突フレームで字幅が縮む",
  intent="了承を文末に添える", sil="横並びの太い英字3文字",
  effect_name="衝突の衝撃線", prop_name="英字3パーツ", deform="衝突時の横つぶれ",
  intensity="中", uniq="40個中唯一の英字と商品固有の太い丸文字", similar="036",
  path=[(1,56,88),(4,30,44),(8,36,56),(12,56,88),(15,50,83),(20,56,88)]),

 dict(n="034", meaning="ハート", cat=S, comp="symbol", tags=["symbol","prop_acting"],
  mf="container_release", sp="staggered_arc_emit", tempo="medium", beat="three_stage_emit",
  hold=490, short_c=64, lr="depth_split_stop", disp=46, search=10,
  moving=["heart_l","heart_m","heart_s","box_lid"], fixed=["box_body"],
  ha="box_center", roi=[72,124,36,24], travel=False, bbox=SYMBOL_BBOX, hip=None, sh=None,
  pve="斜めに並んだ大中小3つのハート",
  cues=dict(NO_CUES, effect="", prop="ソフビ成型の小箱と3つのハート（各抜き穴つき）"),
  story=["大中小3つのハートが斜めに並んだ完成状態。下に小箱がある",
         "3つのハートが小箱の中へ収まり、蓋が閉じる",
         "蓋が開き、大ハートが先に、中・小が時間差で飛び出す途中",
         "3つが別々の弧で最も高く広がる。大が46px上昇し手前に来る",
         "中・小が奥へ分かれ、大だけがわずかに手前で止まる",
         "3つが斜めの完成配置へ落ち着き、蓋が閉じる"],
  pat="F01 と F12 の大ハート中心が46px以上移動し、3つの最大点フレームが互いに異なる",
  intent="好意を文末に添える", sil="斜めに並んだ大中小3つのハート",
  effect_name="", prop_name="小箱と3つのハート", deform="",
  intensity="中", uniq="箱の開閉・3個の時間差と上昇軌道", similar="017,038"),

 dict(n="035", meaning="汗", cat=S, comp="symbol", tags=["symbol"],
  mf="burst_and_fall", sp="parabolic_scatter", tempo="medium", beat="triple_droplet",
  hold=390, short_c=70, lr="per_drop_landing", disp=50, search=14,
  moving=["drop_1","drop_2","drop_3"], fixed=[],
  ha="drop_1_center", roi=[48,62,24,24], travel=True, bbox=SYMBOL_BBOX, hip=None, sh=None,
  pve="外向きに並んだ大中小3粒の汗",
  cues=dict(NO_CUES, effect="", prop="ソフビ成型の水滴3粒（各抜き穴つき）"),
  story=["大中小3粒の汗が外向きに並んだ完成状態",
         "3粒が中央下の1点へ集まり、噴き出す直前まで縮む",
         "1粒目が上へ噴き出し、2粒目・3粒目が左右へ飛ぶ途中",
         "3粒が最も広がる。1粒目が50px移動し放物線の頂点に達する",
         "3粒がそれぞれ別の放物線で落下し、下端8px手前で消える",
         "3粒が外向きの完成配置へ戻る"],
  pat="F01 と F12 の1粒目中心が50px以上移動し、3粒の着地フレームが互いに異なる",
  intent="困りや焦りを文末に添える", sil="外向きに散った3粒の水滴",
  effect_name="", prop_name="水滴3粒", deform="噴出時の縦伸び",
  intensity="中", uniq="水色の3粒と異なる軌道", similar="032,038",
  path=[(1,60,74),(4,66,50),(8,50,38),(12,46,84),(16,42,124),(18,50,100),(20,59,76)]),

 dict(n="036", meaning="!?", cat=S, comp="symbol", tags=["symbol"],
  mf="dual_impact", sp="orthogonal_collide", tempo="fast", beat="double_impact",
  hold=230, short_c=74, lr="offset_recoil_return", disp=54, search=16,
  moving=["mark_excl","mark_quest"], fixed=[],
  ha="mark_excl_center", roi=[62,66,24,28], travel=True, bbox=SYMBOL_BBOX, hip=None, sh=None,
  pve="重なった太い感嘆符と疑問符",
  cues=dict(NO_CUES, effect="衝突点の衝撃線", prop="ソフビ成型の ! と ?（各抜き穴つき）"),
  story=["朱赤の ! とミントの ? が中央で重なった完成状態",
         "! が画面上方へ、? が右方向へ大きく離れる",
         "! が上から落下し、? が横から飛び込む途中",
         "中央で直交して衝突。! が54px移動し両記号がつぶれる",
         "衝突後に両記号の位置がずれて別方向へ反動する",
         "重なった完成状態へ戻る。震えだけでは終わらせない"],
  pat="F01 と F11 の ! 中心が54px以上移動し、! と ? の進入方向が直交する",
  intent="驚きを文末に添える", sil="直交して重なる2つの太い約物",
  effect_name="衝突の衝撃線", prop_name="! と ?", deform="衝突時のつぶれ",
  intensity="強", uniq="朱赤の ! とミントの ? の2方向動作", similar="033,037",
  path=[(1,74,80),(4,74,40),(8,74,54),(11,74,80),(15,70,86),(20,74,80)]),

 dict(n="037", meaning="？", cat=S, comp="symbol", tags=["symbol"],
  mf="draw_and_join", sp="bottom_up_plus_drop", tempo="medium", beat="three_stage_join",
  hold=370, short_c=78, lr="dot_bounce_settle", disp=40, search=14,
  moving=["curve","dot"], fixed=[],
  ha="curve_center", roi=[76,78,28,28], travel=True, bbox=SYMBOL_BBOX, hip=None, sh=None,
  pve="傾いた大きな疑問符",
  cues=dict(NO_CUES, effect="", prop="ソフビ成型の曲線本体と点（各抜き穴つき）"),
  story=["大きな疑問符が傾いて完成した状態",
         "曲線本体が下端まで下がり、点が上方へ離れる",
         "曲線本体が下から上へ描かれるように現れる途中",
         "点が上から落ちて曲線の下へ結合し、曲線が40px上昇し切る",
         "結合直後に点だけが一度大きく跳ねる",
         "点が落ち着き、傾いた完成形へ収束する"],
  pat="F01 と F12 の曲線本体中心が40px以上移動し、点が曲線と別軌道で跳ねる",
  intent="疑問を文末に添える", sil="傾いた単独の大きな疑問符",
  effect_name="", prop_name="曲線本体と点", deform="",
  intensity="弱", uniq="曲線と点の組み立て", similar="036",
  path=[(1,88,92),(4,88,132),(8,88,110),(12,88,92),(16,88,86),(20,88,92)]),

 dict(n="038", meaning="キラキラ", cat=S, comp="symbol", tags=["symbol"],
  mf="arrival_and_cross", sp="crossing_curves", tempo="medium", beat="three_stage_cross",
  hold=455, short_c=62, lr="spread_then_sync_flash", disp=60, search=16,
  moving=["star_l","star_m","star_s"], fixed=[],
  ha="star_l_center", roi=[58,58,28,28], travel=True, bbox=SYMBOL_BBOX, hip=None, sh=None,
  pve="異なる角度で光る大中小3つの星",
  cues=dict(NO_CUES, effect="", prop="ソフビ成型の星3つ（各抜き穴つき）"),
  story=["大中小3つの星が異なる角度で並んだ完成状態",
         "3つの星が左下・右下・上の画面外周寄りへ離れる",
         "3つが別々の曲線を描いて中央へ飛来する途中",
         "中央で3つの軌道が交差する。大星が60px移動する",
         "交差後に3方向へ広がっていく",
         "広がり切った位置で3つが同時に発光し、完成配置へ戻る"],
  pat="F01 と F12 の大星中心が60px以上移動し、3つの軌道が中央で交差する",
  intent="称賛や輝きを文末に添える", sil="角度の異なる3つの星",
  effect_name="同時発光", prop_name="星3つ", deform="",
  intensity="中", uniq="星の飛来・交差・分散", similar="022,034",
  path=[(1,72,72),(4,34,132),(8,52,104),(12,90,88),(16,116,60),(20,72,72)]),

 dict(n="039", meaning="炎", cat=S, comp="symbol", tags=["symbol","deformation_or_effect_led"],
  mf="ignite_and_unfold", sp="rooted_upward_bloom", tempo="fast", beat="three_stage_ignite",
  hold=345, short_c=68, lr="root_fixed_tip_diverge", disp=48, search=12,
  moving=["flame_c","flame_l","flame_r"], fixed=["ember"],
  ha="ember_center", roi=[78,128,24,20], travel=False, bbox=SYMBOL_BBOX, hip=None, sh=None,
  pve="立ち上がった朱赤・黄・ミントの三層炎",
  cues=dict(NO_CUES, effect="", prop="ソフビ成型の火種と三層の炎（各抜き穴つき）"),
  story=["朱赤・黄・ミントの三層炎が立った完成状態",
         "炎が消え、下端に小さな火種だけが残って縮む",
         "火種が跳ね、左右の炎が根元から開き始める途中",
         "中央炎が最も高く立ち上がる。先端が48px上昇する",
         "先端だけが左右へ分かれて揺れ、根元は動かない",
         "三層が揃った完成形へ収束する"],
  pat="F01 と F11 の中央炎先端が48px以上上昇し、火種の位置が固定領域として画素一致する",
  intent="熱意や応援を文末に添える", sil="根元が細く先端が三層に開く縦長の炎",
  effect_name="", prop_name="火種と三層の炎", deform="炎先端の分岐",
  intensity="強", uniq="火種から三層炎への展開", similar="024"),

 dict(n="040", meaning="zzz", cat=S, comp="symbol", tags=["symbol"],
  mf="push_and_drift", sp="diagonal_ascend_chain", tempo="slow", beat="three_stage_push",
  hold=530, short_c=66, lr="sequential_fade_from_top", disp=44, search=14,
  moving=["z1","z2","z3"], fixed=[],
  ha="z1_center", roi=[54,104,24,24], travel=True, bbox=SYMBOL_BBOX, hip=None, sh=None,
  pve="斜め上へ並んだ z・zz・zzz",
  cues=dict(NO_CUES, effect="", prop="ソフビ成型の小文字 z 3つ（各抜き穴つき）"),
  story=["z・zz・zzz が斜め上へ並んだ完成状態",
         "3つの z が下端の1点へ重なり、最小サイズまで縮む",
         "1つ目の z が次の z を押し出しながら斜め上へ進む途中",
         "3つが別軌道へ分かれ切る。1つ目が44px上昇する",
         "上の z から順に薄れて消えていく",
         "下から新しい z が現れ、斜めの完成配置へ戻る"],
  pat="F01 と F12 の1つ目の z 中心が44px以上移動し、3文字の軌道が互いに分岐する",
  intent="眠気を文末に添える", sil="斜めに連なる3つの小文字",
  effect_name="", prop_name="小文字 z 3つ", deform="",
  intensity="弱", uniq="40個中唯一の小文字・押し出しと分岐軌道", similar="035",
  path=[(1,66,116),(4,60,138),(8,64,124),(12,72,104),(16,82,80),(20,66,116)]),
]


# ---------------------------------------------------------------- 出力

def build_plan():
    items = []
    for it in ITEMS:
        durations, _peak_frame = build_durations(it["tempo"], it["hold"], it["short_c"], it["beat"])
        has_char = it["cat"] != S
        items.append({
            "number": it["n"],
            "meaning": it["meaning"],
            "category": it["cat"],
            "has_character": has_char,
            "first_frame_emotion_cues": it["cues"],
            "target_character_bbox": it["bbox"],
            "primary_visual_element": it["pve"],
            "moving_parts": it["moving"],
            "fixed_parts": it["fixed"],
            "anchor_points": ({"hip": it["hip"], "shoulder": it["sh"]} if has_char else {}),
            "horizontal_anchor": it["ha"],
            "anchor_roi": it["roi"],
            "anchor_search_px": it["search"],
            "allow_horizontal_travel": it["travel"],
            "allow_stage_exit": False,
            "character_identity_landmarks": (dict(BASE_LANDMARKS) if has_char else {}),
            "keyframe_storyboard": {f"P{i+1}": s for i, s in enumerate(it["story"])},
            "primary_action_test": it["pat"],
            "motion_family": it["mf"],
            "spatial_path": it["sp"],
            "tempo_class": it["tempo"],
            "beat_pattern": it["beat"],
            "peak_hold_ms": it["hold"],
            "loop_return_type": it["lr"],
            "major_part_displacement_px": it["disp"],
            "safe_area_px": SAFE,
            "whole_sprite_only_motion": False,
            "frame_durations_ms": durations,
            "target_bytes": TARGET_BYTES,
            "hard_limit_bytes": HARD_LIMIT_BYTES,
            "fixed_region_byte_identity": True,
            "full_frame_redraw": False,
        })
    return {"project": "retro-sofubi-daiou", "spec_ref": "reports/spec-snapshot.md", "items": items}


def build_anchor_config():
    cfg = {
        "defaults": {
            "anchor_search_px": 8,
            "max_anchor_range_px": 1.0,
            "max_mean_fixed_displacement_px": 0.5,
            "safe_area_px": SAFE,
            "alpha_threshold": 8,
            "jitter_step_ratio": 4.0,
            "jitter_step_min_px": 2.0,
            "match_confidence_min": 0.90,
        },
        "items": {},
    }
    for it in ITEMS:
        entry = {
            "anchor_roi": it["roi"],
            "horizontal_anchor": it["ha"],
            "allow_horizontal_travel": it["travel"],
            "allow_stage_exit": False,
            "fixed_mask": f"masks/{it['n']}-fixed.png",
            "expected_anchor_path": (build_path(it["path"]) if it.get("path") else None),
            "safe_area_px": SAFE,
            "anchor_search_px": it["search"],
        }
        if it["travel"] and entry["expected_anchor_path"] is None:
            raise ValueError(f"{it['n']}: allow_horizontal_travel=true requires expected_anchor_path")
        cfg["items"][it["n"]] = entry
    cfg["_note"] = ("expected_anchor_path は計画上の意図経路であり実測ではない（path_source: planned）。"
                    "原画とAPNGが揃った後、check_apng_jitter.py がこの経路との差を2px以内で検査する。"
                    "fixed_mask は masks/ 配下に未生成。ファイルが無い間、固定領域検査は NOT_RUN となる。")
    return cfg


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    plan = build_plan()
    cfg = build_anchor_config()
    with open(os.path.join(root, "emoji-plan.json"), "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
    os.makedirs(os.path.join(root, "reports"), exist_ok=True)
    with open(os.path.join(root, "reports", "anchor-config.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print(f"wrote emoji-plan.json ({len(plan['items'])} items)")
    print(f"wrote reports/anchor-config.json ({len(cfg['items'])} items)")


if __name__ == "__main__":
    main()
