# -*- coding: utf-8 -*-
"""Emoji 25-32: the difficult feelings (character)."""
from rig import P, ik, INK, SKIN, LENS, WHITE
import rig
import fx as F
from items_a import ph, cyc, taper, REST_L, REST_R

ITEMS = []


def add(**kw):
    ITEMS.append(kw)


# ------------------------------------------------------------------ 25 cry
def fx25(c, p, i):
    """Both cheeks stream; length, width and fall distance all change."""
    grow = 0.55 + 0.85 * ph(i, 5, 10) - 0.45 * ph(i, 12, 18)
    for k in (-1, 1):
        x = 90 + k * 30
        F.drop(c, x, 103 + 9 * grow, 11 + 7 * grow, 15 + 13 * grow, rot=k * 6)
        for j in range(2):
            u = cyc(i, 0.15 + 0.5 * j + 0.25 * (k > 0))
            t = taper(u)
            if t < 0.03:
                continue
            F.drop(c, x + k * (5 + 9 * u), 120 + 42 * u,
                   (8 - 3 * u) * (0.7 + grow * 0.5) * t,
                   (11 - 4 * u) * (0.7 + grow * 0.5) * t, rot=k * 12)


add(n=25, group='trouble', ja='泣く', en='Crying',
    intent='悲しい／泣きたい気持ち',
    poses=[
        P(armR=ik(1, (120, 92)), armL=ik(0, (60, 100)), handR='open', handL='open',
          handR_ang=176, handL_ang=184, head_rot=4, lean=1, face=dict(eye='squeeze', brow='sad', mouth='frown', cheek=0)),
        P(armR=ik(1, (120, 116)), armL=REST_L, handR='round', head_rot=2, lean=0,
          face=dict(eye='sad', brow='sad', mouth='pout', cheek=0)),
        P(armR=ik(1, (116, 104)), armL=REST_L, handR='open', handR_ang=170,
          head_rot=-2, lean=-2, face=dict(eye='sad', brow='sad', mouth='open', cheek=0)),
        P(armR=ik(1, (124, 92)), armL=ik(0, (56, 92)), handR='open', handL='open',
          handR_ang=178, handL_ang=182, head_rot=-9, lean=-8, head_off=(0, -4),
          face=dict(eye='squeeze', brow='sad', mouth='shout', cheek=0)),
        P(armR=ik(1, (108, 94)), armL=ik(0, (60, 108)), handR='open', handL='round',
          handR_ang=190, head_rot=8, lean=2,
          face=dict(eye='squeeze', brow='sad', mouth='wave', cheek=0)),
        P(armR=ik(1, (116, 98)), armL=REST_L, handR='open', handR_ang=174,
          head_rot=4, lean=1, face=dict(eye='sad', brow='sad', mouth='frown', cheek=0)),
    ],
    stops=[0, 3, 6, 10, 14, 17], eases=['inout', 'in', 'out3', 'out', 'in', 'inout'],
    beat=[4, 3, 3, 3, 3, 2, 2, 2, 3, 6, 5, 3, 3, 3, 4, 3, 3, 3, 3, 4],
    fx=fx25,
    moving='涙の量と落下・拭う右手・頭・上半身', fixed='両足・腰',
    motion_family='エフェクト', spatial_path='縦', tempo='medium',
    beat_pattern='連続', loop_return='通常復帰',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='顔アップ寄り', deform='なし', intensity=4,
    first_frame='両目から涙がこぼれ、片手を目もとに当てて眉が下がっている',
    peak_frame='のけぞって大口で泣き、両手が目もとに上がり涙が最大量で流れ落ちる',
    hook='両目から流れ落ちる涙と拭う手')


# ---------------------------------------------------------------- 26 gloom
def fx26(c, p, i):
    n = 5
    g = 0.5 + 0.9 * ph(i, 5, 11) - 0.35 * ph(i, 13, 19)
    for k in range(n):
        x = 62 + k * 14
        c.line([(x, 34 + 3 * ((k % 2) == 0)), (x, 34 + (17 + 12 * g) * (0.7 + 0.3 * (k % 2)))],
               INK, 2.6)


add(n=26, group='trouble', ja='落ち込む', en='Feeling down',
    intent='落ち込む／がっかり',
    poses=[
        P(hip_dy=8, footL=(80, 158), footR=(100, 158), lean=10, head_rot=11,
          head_off=(0, 6), armR=ik(1, (104, 142)), armL=ik(0, (76, 142)),
          face=dict(eye='closed', brow='sad', mouth='frown', cheek=0)),
        P(hip_dy=3, footL=(81, 158), footR=(99, 158), lean=4, head_rot=4,
          head_off=(0, 0), armR=ik(1, (110, 138)), armL=ik(0, (70, 138)),
          face=dict(eye='sad', brow='sad', mouth='flat', cheek=0)),
        P(hip_dy=8, footL=(80, 158), footR=(100, 158), lean=9, head_rot=8,
          head_off=(0, 5), armR=ik(1, (106, 141)), armL=ik(0, (74, 141)),
          face=dict(eye='closed', brow='sad', mouth='frown', cheek=0)),
        P(hip_dy=10, footL=(80, 158), footR=(100, 158), lean=11, head_rot=14,
          head_off=(0, 12), armR=ik(1, (101, 148)), armL=ik(0, (79, 148)),
          face=dict(eye='closed', brow='sad', mouth='flat', cheek=0)),
        P(hip_dy=11, footL=(79, 158), footR=(101, 158), lean=12, head_rot=13,
          head_off=(0, 10), armR=ik(1, (102, 146)), armL=ik(0, (78, 146)),
          face=dict(eye='closed', brow='sad', mouth='frown', cheek=0)),
        P(hip_dy=9, footL=(80, 158), footR=(100, 158), lean=11, head_rot=12,
          head_off=(0, 8), armR=ik(1, (103, 145)), armL=ik(0, (77, 145)),
          face=dict(eye='closed', brow='sad', mouth='frown', cheek=0)),
    ],
    stops=[0, 4, 7, 11, 15, 18], eases=['inout', 'out', 'in', 'in', 'out', 'inout'],
    beat=[5, 4, 3, 3, 3, 3, 3, 3, 3, 3, 6, 6, 4, 4, 4, 4, 4, 4, 5, 5],
    fx=fx26,
    moving='腰の沈み・上半身・頭・どんより線', fixed='両足の接地点',
    motion_family='全身', spatial_path='縦', tempo='slow',
    beat_pattern='単発', loop_return='戻らず保持',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='全身と大きなポーズ', deform='膝の沈み込み', intensity=3,
    first_frame='ひざを折って沈み込み、頭を垂れて上からどんより線が降りている',
    peak_frame='腰が10px沈んで頭が最も低くなり、どんより線が最長まで伸びる',
    hook='沈み込む姿勢と頭上のどんより線')


# ---------------------------------------------------------------- 27 angry
def fx27(c, p, i):
    s = 8.5 + 5.5 * ph(i, 6, 10) - 2.0 * ph(i, 12, 17)
    F.anger(c, 128, 46, s, rot=8)
    F.anger(c, 54, 54, s * 0.72, rot=-14)
    u = ph(i, 9, 14)
    if 0.0 < u < 1.0:
        for k in (-1, 1):
            F.speed_lines(c, 90 + k * 46, 150, n=2, ln=(9 + 12 * u) * k, gap=8, w=2.4 - u)


add(n=27, group='trouble', ja='怒る', en='Angry',
    intent='怒る／抗議する',
    poses=[
        P(armR=ik(1, (124, 104)), armL=ik(0, (56, 104)), handR='fist', handL='fist',
          handR_ang=20, handL_ang=-20, head_rot=0, sy=0.985,
          face=dict(eye='flat', brow='angry', mouth='pout', cheek=3)),
        P(armR=ik(1, (130, 88)), armL=ik(0, (50, 88)), handR='fist', handL='fist',
          handR_ang=8, handL_ang=-8, head_off=(0, -4), root=(0, -3), shoulder_dy=-3,
          face=dict(eye='squeeze', brow='angry', mouth='flat', cheek=3)),
        P(armR=ik(1, (126, 100)), armL=ik(0, (54, 100)), handR='fist', handL='fist',
          head_off=(0, -1), face=dict(eye='flat', brow='angry', mouth='pout', cheek=3)),
        P(armR=ik(1, (120, 134)), armL=ik(0, (60, 134)), handR='fist', handL='fist',
          handR_ang=30, handL_ang=-30, head_off=(0, 7), hip_dy=5, sy=0.955,
          face=dict(eye='squeeze', brow='angry', mouth='shout', cheek=3)),
        P(armR=ik(1, (124, 116)), armL=ik(0, (56, 116)), handR='fist', handL='fist',
          head_off=(0, -2), root=(0, -2),
          face=dict(eye='flat', brow='angry', mouth='shout', cheek=3)),
        P(armR=ik(1, (125, 108)), armL=ik(0, (55, 108)), handR='fist', handL='fist',
          head_off=(0, 1), face=dict(eye='flat', brow='angry', mouth='pout', cheek=3)),
    ],
    stops=[0, 3, 6, 9, 13, 16], eases=['out', 'anticip', 'in', 'in', 'out', 'settle'],
    beat=[4, 3, 3, 3, 2, 2, 2, 2, 2, 7, 6, 4, 3, 3, 3, 3, 3, 3, 3, 4],
    fx=fx27,
    moving='両拳の上下・肩・胴体の縦つぶれ・怒りマーク', fixed='接地の左右位置・顔の中心',
    motion_family='両手', spatial_path='縦', tempo='fast',
    beat_pattern='大小2拍', loop_return='反動',
    h_anchor='胴体中心', travel=False, exitable=False,
    composition='上半身中心', deform='胴体の縦つぶれ', intensity=5,
    first_frame='両拳を握って構え、つり眉とへの字口、頭の横に怒りマークが2つ',
    peak_frame='両拳が振り下ろされて体が沈み、怒りマークが最大化し足元に衝撃線が出る',
    hook='振り下ろす両拳と2つの怒りマーク')


# -------------------------------------------------------------- 28 troubled
def fx28(c, p, i):
    slide = ph(i, 7, 14)
    F.drop(c, 130 + 4 * slide, 58 + 30 * slide, 12 + 5 * slide - 4 * slide * slide,
           17 + 7 * slide - 6 * slide * slide, rot=10)


add(n=28, group='trouble', ja='困った', en='Hmm, tricky',
    intent='困る／判断に迷う',
    poses=[
        P(armR=ik(1, (116, 104)), armL=REST_L, handR='round', head_rot=-13,
          head_off=(-2, 0), face=dict(eye='sleepy', brow='worry', mouth='wave', cheek=2)),
        P(armR=ik(1, (118, 112)), armL=REST_L, handR='round', head_rot=-3,
          head_off=(0, 2), face=dict(eye='dot', brow='worry', mouth='flat', cheek=2)),
        P(armR=ik(1, (117, 108)), armL=REST_L, handR='round', head_rot=5,
          head_off=(1, 1), face=dict(eye='dot', brow='worry', mouth='wave', cheek=2)),
        P(armR=ik(1, (114, 100)), armL=REST_L, handR='round', head_rot=19,
          head_off=(4, -2), shoulder_dy=-2,
          face=dict(eye='squeeze', brow='worry', mouth='pout', cheek=2)),
        P(armR=ik(1, (117, 106)), armL=REST_L, handR='round', head_rot=-8,
          head_off=(-1, 1), face=dict(eye='sleepy', brow='worry', mouth='wave', cheek=2)),
        P(armR=ik(1, (116, 103)), armL=REST_L, handR='round', head_rot=-15,
          head_off=(-2, 0), face=dict(eye='sleepy', brow='worry', mouth='wave', cheek=2)),
    ],
    stops=[0, 4, 7, 11, 15, 18], eases=['inout', 'inout', 'inout', 'out', 'in', 'inout'],
    beat=[4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 5, 3, 3, 3, 3, 4, 4, 4],
    fx=fx28,
    moving='頭の傾き・右手（ほお）・汗のふくらみと滑落', fixed='両足・腰・胴体・左腕',
    motion_family='頭', spatial_path='円弧', tempo='slow',
    beat_pattern='大小2拍', loop_return='通常復帰',
    h_anchor='胴体中心', travel=False, exitable=False,
    composition='顔アップ寄り', deform='なし', intensity=2,
    first_frame='頭を左へかしげて手をほおに当て、波形の口と汗が1粒',
    peak_frame='頭が反対へ19度かしぎ、汗がふくらんで顔の横を滑り落ちる',
    hook='左右にかしぐ頭と滑り落ちる汗')


# --------------------------------------------------------------- 29 worn out
def fx29(c, p, i):
    u = cyc(i, 0.0)
    F.puff(c, 126 + 26 * u, 98 - 24 * u, 3.4 + 7.0 * u)
    g = 0.6 + 0.9 * ph(i, 6, 11)
    q = cyc(i, 0.25)
    if taper(q) >= 0.03:
        F.puff(c, 124 + 15 * q, 94 - 30 * q,
               (4.0 + 5.6 * g) * (0.62 + 0.5 * q) * taper(q))


add(n=29, group='trouble', ja='疲れた', en='Worn out',
    intent='疲労を伝える／もう限界',
    poses=[
        P(lean=13, head_rot=16, head_off=(0, 10), hip_dy=6,
          armR=ik(1, (108, 145)), armL=ik(0, (72, 145)), shoulder_dy=4,
          face=dict(eye='sleepy', brow='sad', mouth='o', cheek=0)),
        P(lean=8, head_rot=6, head_off=(0, 2), hip_dy=1,
          armR=ik(1, (114, 140)), armL=ik(0, (66, 140)), shoulder_dy=-2,
          face=dict(eye='closed', brow='sad', mouth='flat', cheek=0)),
        P(lean=13, head_rot=11, head_off=(0, 7), hip_dy=4,
          armR=ik(1, (113, 141)), armL=ik(0, (67, 141)), shoulder_dy=1,
          face=dict(eye='sleepy', brow='sad', mouth='o', cheek=0)),
        P(lean=10, head_rot=16, head_off=(0, 12), hip_dy=6,
          armR=ik(1, (110, 145)), armL=ik(0, (70, 145)), shoulder_dy=5,
          face=dict(eye='closed', brow='sad', mouth='o', cheek=0)),
        P(lean=11, head_rot=15, head_off=(0, 10), hip_dy=6,
          armR=ik(1, (111, 144)), armL=ik(0, (69, 144)), shoulder_dy=4,
          face=dict(eye='closed', brow='sad', mouth='flat', cheek=0)),
        P(lean=11, head_rot=14, head_off=(0, 8), hip_dy=5,
          armR=ik(1, (111, 143)), armL=ik(0, (69, 143)), shoulder_dy=3,
          face=dict(eye='sleepy', brow='sad', mouth='o', cheek=0)),
    ],
    stops=[0, 5, 8, 12, 15, 18], eases=['out', 'inout', 'in', 'in', 'out', 'inout'],
    beat=[5, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 6, 6, 4, 4, 4, 4, 4, 4, 5],
    fx=fx29,
    moving='上半身の脱力・頭・肩の落ち・ためいき', fixed='両足の接地点・両腕の下垂位置',
    motion_family='全身', spatial_path='縦', tempo='slow',
    beat_pattern='呼吸', loop_return='戻らず保持',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='全身と大きなポーズ', deform='上半身の脱力', intensity=3,
    first_frame='がっくりと前へ脱力し、腕を垂らしてためいきをついている',
    peak_frame='上体が最も深く脱力して腰が7px沈み、ためいきが最大まで広がる',
    hook='垂れ下がる腕と大きなためいき')


# ----------------------------------------------------------------- 30 sick
def fx30(c, p, i):
    _, _, hm = rig.matrices(p)
    prev = c.push(hm)
    F.thermometer(c, 8, 30, 1.42, rot=-58)
    c.pop(prev)
    for k in (-1, 1):
        u = cyc(i, 0.2 + 0.5 * (k > 0))
        t = taper(u)
        if t < 0.03:
            continue
        F.drop(c, 90 + k * (40 + 12 * u), 62 + 26 * u,
               (9 - 3 * u) * t, (12 - 4 * u) * t, rot=k * 16)


add(n=30, group='trouble', ja='体調不良', en='Not feeling well',
    intent='具合が悪い／休みたい',
    poses=[
        P(lean=-8, head_rot=-14, head_off=(-4, 2), armR=ik(1, (120, 140)),
          armL=ik(0, (60, 140)), legL=-5, legR=-5,
          face=dict(eye='swirl', brow='sad', mouth='wave', cheek=0)),
        P(lean=3, head_rot=5, head_off=(2, 1), armR=ik(1, (124, 138)),
          armL=ik(0, (64, 142)), legL=2, legR=2,
          face=dict(eye='swirl', brow='sad', mouth='flat', cheek=0)),
        P(lean=-3, head_rot=-5, head_off=(-1, 2), armR=ik(1, (121, 141)),
          armL=ik(0, (61, 141)), legL=-2, legR=-2,
          face=dict(eye='swirl', brow='sad', mouth='wave', cheek=0)),
        P(lean=12, head_rot=21, head_off=(7, 3), armR=ik(1, (130, 134)),
          armL=ik(0, (70, 146)), legL=7, legR=7, hip_dy=4,
          face=dict(eye='swirl', brow='sad', mouth='pout', cheek=0)),
        P(lean=-11, head_rot=-19, head_off=(-6, 3), armR=ik(1, (114, 146)),
          armL=ik(0, (54, 136)), legL=-6, legR=-6, hip_dy=3,
          face=dict(eye='swirl', brow='sad', mouth='wave', cheek=0)),
        P(lean=5, head_rot=9, head_off=(3, 2), armR=ik(1, (123, 139)),
          armL=ik(0, (63, 143)), legL=3, legR=3,
          face=dict(eye='swirl', brow='sad', mouth='wave', cheek=0)),
    ],
    stops=[0, 3, 6, 10, 14, 17], eases=['inout', 'inout', 'inout', 'inout', 'inout', 'inout'],
    beat=[4, 4, 4, 3, 3, 3, 3, 3, 3, 4, 5, 4, 3, 3, 4, 4, 3, 3, 3, 4],
    fx=fx30,
    moving='上半身の左右ふらつき・頭・体温計（頭に追従）・汗', fixed='両足の接地点',
    motion_family='全身', spatial_path='横', tempo='slow',
    beat_pattern='連続', loop_return='通常復帰',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='全身と大きなポーズ', deform='上半身のふらつき', intensity=4,
    first_frame='体温計をくわえてふらつき、目がぐるぐるで汗が飛んでいる',
    peak_frame='上体と頭が右へ最大までふらつき、体温計が追従して傾き汗が外へ飛ぶ',
    hook='くわえた体温計とぐるぐる目')


# ---------------------------------------------------------------- 31 dunno
def fx31(c, p, i):
    u = ph(i, 6, 11)
    for k in (-1, 1):
        for j in range(2):
            x = 90 + k * (44 + 10 * u + j * 8)
            c.line([(x, 62 - 6 * u - j * 5), (x + k * 7, 56 - 8 * u - j * 5)],
                   INK, 2.3 - 0.9 * u - 0.3 * j)


add(n=31, group='trouble', ja='わからない', en='No idea',
    intent='わからない／お手上げ',
    poses=[
        P(armR=ik(1, (136, 116)), armL=ik(0, (44, 116)), handR='open', handL='open',
          handR_ang=200, handL_ang=160, shoulder_dy=-4, head_rot=-9,
          face=dict(eye='closed', brow='sad', mouth='wave', cheek=0)),
        P(armR=ik(1, (126, 140)), armL=ik(0, (54, 140)), handR='round', handL='round',
          shoulder_dy=1, head_rot=-2, head_off=(0, 2),
          face=dict(eye='dot', brow='worry', mouth='flat', cheek=0)),
        P(armR=ik(1, (132, 126)), armL=ik(0, (48, 126)), handR='open', handL='open',
          shoulder_dy=-1, head_rot=-5,
          face=dict(eye='dot', brow='sad', mouth='wave', cheek=0)),
        P(armR=ik(1, (145, 104)), armL=ik(0, (35, 104)), handR='open', handL='open',
          handR_ang=206, handL_ang=154, shoulder_dy=-7, head_rot=-14, head_off=(0, 3),
          face=dict(eye='closed', brow='sad', mouth='pout', cheek=0)),
        P(armR=ik(1, (138, 112)), armL=ik(0, (42, 112)), handR='open', handL='open',
          shoulder_dy=-3, head_rot=-11,
          face=dict(eye='closed', brow='sad', mouth='wave', cheek=0)),
        P(armR=ik(1, (137, 114)), armL=ik(0, (43, 114)), handR='open', handL='open',
          shoulder_dy=-4, head_rot=-10,
          face=dict(eye='closed', brow='sad', mouth='wave', cheek=0)),
    ],
    stops=[0, 3, 6, 10, 14, 17], eases=['inout', 'anticip', 'out', 'settle', 'inout', 'inout'],
    beat=[4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 5, 3, 3, 3, 3, 3, 4, 4, 4],
    fx=fx31,
    moving='両腕の開き・肩のすくめ・頭', fixed='両足・腰・接地',
    motion_family='両手', spatial_path='横', tempo='medium',
    beat_pattern='単発', loop_return='戻らず保持',
    h_anchor='胴体中心', travel=False, exitable=False,
    composition='上半身中心', deform='肩のすくめ', intensity=3,
    first_frame='両手のひらを上に向けて左右に開き、肩をすくめて眉が下がっている',
    peak_frame='両手が最大まで開いて肩が7px上がり、肩の外側に無言線が4本出る',
    hook='てのひらを上に開いた両手と上がる肩')


# ---------------------------------------------------------------- 32 sleepy
def fx32(c, p, i):
    pop = 1.0 + 0.28 * ph(i, 9, 12) - 0.28 * ph(i, 12, 17)
    for k in range(2):
        u = cyc(i, 0.1 + 0.5 * k)
        t = taper(u)
        if t < 0.03:
            continue
        F.g_z(c, 128 + 26 * u, 74 - 44 * u, (0.55 + 0.40 * u) * pop * t,
              (3.2 + 1.4 * u) * t)


add(n=32, group='trouble', ja='眠い', en='Sleepy',
    intent='眠い／限界が近い',
    poses=[
        P(head_rot=11, head_off=(-2, 7), lean=5, glasses_off=(0, 6), glasses_rot=-4,
          armR=REST_R, armL=REST_L,
          face=dict(eye='sleepy', brow='worry', mouth='o', cheek=0)),
        P(head_rot=-7, head_off=(0, -8), lean=-3, glasses_off=(0, -1), glasses_rot=0,
          armR=REST_R, armL=REST_L,
          face=dict(eye='big', brow='up', mouth='flat', cheek=0)),
        P(head_rot=4, head_off=(-1, 2), lean=2, glasses_off=(0, 3), glasses_rot=-2,
          armR=REST_R, armL=REST_L,
          face=dict(eye='sleepy', brow='worry', mouth='flat', cheek=0)),
        P(head_rot=21, head_off=(-4, 19), lean=11, glasses_off=(1, 12), glasses_rot=-8,
          armR=REST_R, armL=REST_L, shoulder_dy=2,
          face=dict(eye='closed', brow='worry', mouth='o', cheek=0)),
        P(head_rot=-3, head_off=(0, -4), lean=-1, glasses_off=(0, 1), glasses_rot=-1,
          armR=REST_R, armL=REST_L,
          face=dict(eye='big', brow='up', mouth='flat', cheek=0)),
        P(head_rot=14, head_off=(-3, 11), lean=6, glasses_off=(0, 8), glasses_rot=-5,
          armR=REST_R, armL=REST_L,
          face=dict(eye='sleepy', brow='worry', mouth='o', cheek=0)),
    ],
    stops=[0, 4, 7, 11, 14, 17], eases=['in', 'out3', 'in', 'in', 'out3', 'in'],
    beat=[5, 4, 4, 4, 3, 3, 3, 3, 3, 6, 5, 3, 2, 2, 4, 4, 4, 4, 4, 4],
    fx=fx32,
    moving='頭の落下と跳ね起き・メガネのずり落ち・zzz', fixed='両足・腰・胴体・両腕',
    motion_family='頭', spatial_path='縦', tempo='slow',
    beat_pattern='大小2拍', loop_return='反動',
    h_anchor='胴体中心', travel=False, exitable=False,
    composition='顔アップ寄り', deform='なし', intensity=3,
    first_frame='半目でこっくりと頭が落ち、メガネが鼻までずり下がってzzzが出ている',
    peak_frame='頭が19px落ち切ってメガネが12px下がり、はっと跳ね起きる直前でzzzがふくらむ',
    hook='ずり落ちるメガネとこっくり船を漕ぐ頭')
