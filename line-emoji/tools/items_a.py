# -*- coding: utf-8 -*-
"""Emoji 01-12: the conversation basics (character)."""
from rig import P, ik, INK, SKIN, LENS, WHITE
import rig
import fx as F

ITEMS = []


def add(**kw):
    ITEMS.append(kw)


def ph(i, a, b):
    if i <= a:
        return 0.0
    if i >= b:
        return 1.0
    return (i - a) / float(b - a)


def taper(u, edge=0.17):
    """Grow a particle in at the start of its life and shrink it out at the
    end, so the point where it wraps back to its source is invisible."""
    return max(0.0, min(1.0, u / edge)) * max(0.0, min(1.0, (1.0 - u) / edge))


def cyc(i, offset=0.0, period=20.0):
    """Phase 0..1 of a continuously emitting particle, so effects are already
    mid-flight on frame 1 instead of starting from nothing."""
    return ((i / period) + offset) % 1.0


REST_L = ik(0, (56, 154))
REST_R = ik(1, (124, 154))


# ---------------------------------------------------------------- 01 hello
def fx01(c, p, i):
    u = 0.35 + 0.65 * ph(i, 8, 13) - 0.35 * ph(i, 15, 19)
    for k in (0, 1):
        r = 18 + 13 * u + k * 10
        a0 = 192 + 26 * k
        c.line(F.arc_pts(132, 74, r, r, a0, a0 + 34, 10), INK, 2.6 - 0.5 * k)


add(n=1, group='basic', ja='こんにちは', en='Hello',
    intent='会話のはじまり／挨拶を返す',
    poses=[
        P(armR=ik(1, (144, 78)), armL=REST_L, handR='open', handR_ang=-14, head_rot=-7,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (146, 101)), armL=REST_L, handR='open', handR_ang=14, head_rot=-1,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (133, 86)), armL=REST_L, handR='open', handR_ang=-12, head_rot=-6,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (119, 78)), armL=REST_L, handR='open', handR_ang=-30, head_rot=-10,
          lean=-2, face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (143, 96)), armL=REST_L, handR='open', handR_ang=12, head_rot=-2,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (134, 87)), armL=REST_L, handR='open', handR_ang=-10, head_rot=-6,
          face=dict(eye='happy', mouth='grin', cheek=2)),
    ],
    stops=[0, 3, 6, 10, 14, 17], eases=['out', 'inout', 'out', 'settle', 'inout', 'inout'],
    beat=[3, 2, 2, 3, 2, 2, 3, 4, 3, 2, 6, 5, 2, 2, 3, 3, 2, 2, 2, 3],
    fx=fx01,
    moving='右腕・右手・頭', fixed='両足・腰・胴体・左腕',
    motion_family='片腕', spatial_path='横円弧', tempo='medium',
    beat_pattern='大小2拍', loop_return='通常復帰',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='上半身中心', deform='なし', intensity=3,
    first_frame='開いた手のひらを顔の横に上げ、目は笑いの弧、口は大きめの笑み',
    peak_frame='手が内側上へ振り切られ、頭が反対へ10度傾き、手の横に振り軌跡の弧が2本出る',
    hook='開いた手のひらと振り軌跡')


# -------------------------------------------------------------- 02 morning
def fx02(c, p, i):
    u = ph(i, 8, 16)
    if 0.0 < u < 1.0:
        for k in range(2):
            s = 4.5 + 7.0 * u + k * 2.0
            F.puff(c, 104 + 13 * u + k * 9, 100 - 16 * u - k * 7, s)


add(n=2, group='basic', ja='おはよう', en='Good morning',
    intent='朝の挨拶／起きた報告',
    poses=[
        P(armR=ik(1, (112, 88)), armL=ik(0, (44, 112)), handL='open', handL_ang=-40,
          head_rot=6, face=dict(eye='sleepy', brow='worry', mouth='o', cheek=2)),
        P(armR=ik(1, (120, 134)), armL=ik(0, (60, 134)), hip_dy=6, head_off=(0, 3),
          face=dict(eye='closed', brow='worry', mouth='flat', cheek=2)),
        P(armR=ik(1, (134, 106)), armL=ik(0, (48, 106)), handL='open', handR='open',
          head_off=(0, -1), face=dict(eye='closed', brow='up', mouth='o', cheek=2)),
        P(armR=ik(1, (147, 74)), armL=ik(0, (33, 74)), handL='open', handR='open',
          handR_ang=40, handL_ang=-40, lean=-5, head_rot=-9, head_off=(0, -5),
          root=(0, -3), dress_flare=1.05,
          face=dict(eye='squeeze', brow='up', mouth='shout', cheek=2)),
        P(armR=ik(1, (141, 101)), armL=ik(0, (39, 101)), handL='open', handR='open',
          lean=0, head_off=(0, 1), face=dict(eye='closed', brow='worry', mouth='o', cheek=2)),
        P(armR=ik(1, (116, 92)), armL=ik(0, (52, 130)), handR='open',
          head_rot=4, face=dict(eye='sleepy', brow='worry', mouth='smile', cheek=2)),
    ],
    stops=[0, 3, 6, 10, 15, 18], eases=['in', 'inout', 'out3', 'settle', 'inout', 'out'],
    beat=[4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 6, 3, 2, 2, 3, 3, 3, 3, 4],
    fx=fx02,
    moving='両腕・上半身・頭・口', fixed='両足・接地',
    motion_family='両手', spatial_path='斜め上', tempo='slow',
    beat_pattern='呼吸', loop_return='戻らず保持',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='全身と大きなポーズ', deform='上半身の伸び', intensity=2,
    first_frame='眠そうな半目、片手で目をこすり、もう片手は半分上がっている',
    peak_frame='両腕が斜め上へ伸び切り、上体が反り、大あくびの口とあくびの息が2つ出る',
    hook='伸びきった両腕とあくびの息')


# ----------------------------------------------------------- 03 good night
def fx03(c, p, i):
    hl, _ = rig.hand_world(p, 0)
    hr, _ = rig.hand_world(p, 1)
    mx, my = (hl[0] + hr[0]) / 2.0, (hl[1] + hr[1]) / 2.0
    squash = 1.0 - 0.16 * ph(i, 8, 11) + 0.16 * ph(i, 11, 15)
    prev = c.push(rig.scale_about(1.0 + (1.0 - squash) * 0.5, squash, mx, my + 8))
    F.pillow(c, mx, my + 3, 1.05, fill=SKIN)
    c.pop(prev)
    pop = 1.0 + 0.30 * ph(i, 10, 12) - 0.30 * ph(i, 12, 16)
    for k in range(3):
        uk = cyc(i, 0.06 + 0.33 * k)
        t = taper(uk)
        if t < 0.03:
            continue
        F.g_z(c, 118 + 22 * uk, 100 - 50 * uk, (0.58 + 0.38 * uk) * pop * t,
              (3.2 + 1.4 * uk) * t)


add(n=3, group='basic', ja='おやすみ', en='Good night',
    intent='就寝の挨拶／会話を終える',
    poses=[
        P(armR=ik(1, (106, 118)), armL=ik(0, (74, 118)), lean=10, head_rot=15,
          head_off=(-2, 7), face=dict(eye='closed', brow='worry', mouth='smile', cheek=2)),
        P(armR=ik(1, (106, 116)), armL=ik(0, (74, 116)), lean=4, head_rot=3,
          head_off=(-1, -7), face=dict(eye='sleepy', brow='worry', mouth='o', cheek=2)),
        P(armR=ik(1, (106, 117)), armL=ik(0, (74, 117)), lean=7, head_rot=9,
          head_off=(-2, -1), face=dict(eye='closed', brow='worry', mouth='flat', cheek=2)),
        P(armR=ik(1, (107, 121)), armL=ik(0, (73, 121)), lean=15, head_rot=21,
          head_off=(-3, 13), face=dict(eye='closed', brow='worry', mouth='smile', cheek=2)),
        P(armR=ik(1, (106, 119)), armL=ik(0, (74, 119)), lean=12, head_rot=17,
          head_off=(-3, 8), face=dict(eye='closed', brow='worry', mouth='smile', cheek=2)),
        P(armR=ik(1, (104, 122)), armL=ik(0, (76, 122)), lean=11, head_rot=16,
          head_off=(-2, 9), shoulder_dy=2,
          face=dict(eye='sleepy', brow='worry', mouth='o', cheek=2)),
    ],
    stops=[0, 4, 7, 11, 14, 17], eases=['out', 'inout', 'in', 'settle', 'out', 'inout'],
    beat=[5, 4, 3, 3, 4, 3, 2, 2, 2, 2, 6, 5, 3, 3, 4, 4, 4, 4, 4, 5],
    fx=fx03,
    moving='頭・上半身・枕・zzz', fixed='両足・腰・手の位置',
    motion_family='頭', spatial_path='縦', tempo='slow',
    beat_pattern='単発', loop_return='反動',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='上半身中心', deform='枕のつぶれ', intensity=2,
    first_frame='胸の前の枕に頭をあずけ、目を閉じてzzzが小さく出ている',
    peak_frame='頭が枕へ落ち切って枕がつぶれ、zzzが3つとも大きく斜め上へ抜ける',
    hook='つぶれる枕と3連のzzz')


# ---------------------------------------------------------------- 04 thanks
def fx04(c, p, i):
    u = ph(i, 9, 14)
    if 0.0 < u < 1.0:
        for k, s in ((-1, 1.0), (1, 0.8)):
            F.sparkle(c, 90 + k * (34 + 10 * u), 58 - 8 * u, (7.5 - 3.0 * u) * s)


add(n=4, group='basic', ja='ありがとう', en='Thank you',
    intent='お礼／感謝を伝える',
    poses=[
        P(armR=ik(1, (100, 134)), armL=ik(0, (80, 134)), lean=15, head_rot=11,
          head_off=(0, 14), hip_dy=5,
          face=dict(eye='happy', mouth='smile', cheek=2)),
        P(armR=ik(1, (103, 126)), armL=ik(0, (77, 126)), lean=-4, head_rot=-3,
          head_off=(0, -5), face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (101, 129)), armL=ik(0, (79, 129)), lean=5, head_rot=3,
          head_off=(0, 3), face=dict(eye='happy', mouth='smile', cheek=2)),
        P(armR=ik(1, (99, 133)), armL=ik(0, (81, 133)), lean=17, head_rot=13,
          head_off=(0, 17), hip_dy=7,
          face=dict(eye='happy', mouth='smile', cheek=2)),
        P(armR=ik(1, (99, 132)), armL=ik(0, (81, 132)), lean=14, head_rot=11,
          head_off=(0, 13), hip_dy=5, face=dict(eye='happy', mouth='smile', cheek=2)),
        P(armR=ik(1, (100, 128)), armL=ik(0, (80, 128)), lean=5, head_rot=3,
          head_off=(0, 4), face=dict(eye='happy', mouth='smile', cheek=2)),
    ],
    stops=[0, 3, 6, 9, 14, 17], eases=['out', 'anticip', 'in', 'settle', 'out', 'inout'],
    beat=[4, 3, 3, 3, 2, 2, 2, 3, 3, 7, 6, 4, 3, 3, 3, 3, 3, 3, 3, 4],
    fx=fx04,
    moving='上半身・頭・両腕', fixed='両足・接地',
    motion_family='全身', spatial_path='縦', tempo='medium',
    beat_pattern='単発', loop_return='通常復帰',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='全身と大きなポーズ', deform='上半身の沈み', intensity=3,
    first_frame='両手を前で合わせ、上体を傾けて頭を下げた会釈の姿勢',
    peak_frame='上体と頭がさらに深く沈み込み、頭の左右にきらめきが2つ広がる',
    hook='深い会釈と2つのきらめき')


# ----------------------------------------------------------------- 05 sorry
def fx05(c, p, i):
    u = ph(i, 0, 9)
    v = ph(i, 9, 16)
    if v <= 0.0:
        F.drop(c, 132 - 2 * u, 64 + 6 * u, 12 + 4 * u, 16 + 6 * u, rot=8)
    else:
        F.drop(c, 132, 72 + 60 * v, 15 - 5 * v, 21 - 7 * v, rot=8)


add(n=5, group='basic', ja='ごめんね', en='Sorry',
    intent='謝る／お詫びする',
    poses=[
        P(armR=ik(1, (101, 96)), armL=REST_L, handR='open', handR_ang=0,
          head_rot=10, head_off=(-2, 5), lean=7,
          face=dict(eye='squeeze', brow='sad', mouth='wave', cheek=3)),
        P(armR=ik(1, (105, 108)), armL=REST_L, handR='open', handR_ang=-10,
          head_rot=3, head_off=(-1, -4), lean=-2,
          face=dict(eye='sad', brow='sad', mouth='pout', cheek=3)),
        P(armR=ik(1, (102, 100)), armL=REST_L, handR='open', handR_ang=-4,
          head_rot=7, head_off=(-2, 2), lean=4,
          face=dict(eye='squeeze', brow='sad', mouth='wave', cheek=3)),
        P(armR=ik(1, (99, 88)), armL=REST_L, handR='open', handR_ang=8,
          head_rot=17, head_off=(-3, 17), lean=17, hip_dy=5,
          face=dict(eye='squeeze', brow='sad', mouth='flat', cheek=3)),
        P(armR=ik(1, (100, 92)), armL=REST_L, handR='open', handR_ang=4,
          head_rot=13, head_off=(-3, 10), lean=11,
          face=dict(eye='squeeze', brow='sad', mouth='wave', cheek=3)),
        P(armR=ik(1, (101, 95)), armL=REST_L, handR='open', handR_ang=2,
          head_rot=11, head_off=(-2, 6), lean=8,
          face=dict(eye='sad', brow='sad', mouth='wave', cheek=3)),
    ],
    stops=[0, 3, 6, 9, 13, 16], eases=['inout', 'anticip', 'in', 'out', 'settle', 'inout'],
    beat=[4, 3, 3, 3, 3, 2, 2, 3, 3, 6, 5, 3, 3, 3, 3, 3, 4, 4, 4, 4],
    fx=fx05,
    moving='頭・上半身・右手・汗', fixed='両足・腰・左腕',
    motion_family='全身', spatial_path='縦', tempo='medium',
    beat_pattern='大小2拍', loop_return='反動',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='上半身中心', deform='上半身の沈み', intensity=3,
    first_frame='右手を顔の前に立て、眉を下げ口は波形、頬に3本線と汗が1粒',
    peak_frame='頭が深く下がって手が顔の高さに残り、汗が顔の横から下へ落ちる',
    hook='顔の前に立てた片手と落ちる汗')


# ------------------------------------------------------------ 06 nice2meet
add(n=6, group='basic', ja='よろしく', en='Nice to meet you',
    intent='挨拶／依頼のはじめ／握手',
    poses=[
        P(armR=ik(1, (132, 122)), armL=REST_L, handR='open', handR_ang=95, handR_s=1.48,
          head_rot=-3, face=dict(eye='happy', mouth='smile', cheek=2)),
        P(armR=ik(1, (114, 128)), armL=REST_L, handR='open', handR_ang=70, handR_s=1.10,
          head_rot=2, lean=-3, face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (126, 124)), armL=REST_L, handR='open', handR_ang=88, handR_s=1.28,
          head_rot=-1, face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (145, 120)), armL=REST_L, handR='open', handR_ang=100, handR_s=1.85,
          head_rot=-6, lean=5, face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (136, 121)), armL=REST_L, handR='open', handR_ang=96, handR_s=1.60,
          head_rot=-4, lean=2, face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (133, 122)), armL=REST_L, handR='open', handR_ang=94, handR_s=1.45,
          head_rot=-3, face=dict(eye='happy', mouth='smile', cheek=2)),
    ],
    stops=[0, 4, 7, 11, 15, 18], eases=['inout', 'anticip', 'out3', 'settle', 'out', 'inout'],
    beat=[4, 3, 3, 3, 3, 2, 2, 2, 2, 2, 3, 7, 6, 3, 3, 3, 3, 4, 4, 4],
    fx=None,
    moving='右腕・右手（奥行き）・上半身', fixed='両足・腰・左腕・顔中心',
    motion_family='片腕', spatial_path='奥行き', tempo='medium',
    beat_pattern='単発', loop_return='戻らず保持',
    h_anchor='胴体中心', travel=False, exitable=False,
    composition='上半身中心', deform='手の遠近拡大', intensity=3,
    first_frame='右手を前へ差し出して開き、握手を求める笑顔',
    peak_frame='腕が伸び切り、手が手前へ大きく突き出て上体も前へ出る',
    hook='手前へ突き出した大きな手のひら')


# -------------------------------------------------------------------- 07 OK
def fx07(c, p, i):
    u = ph(i, 9, 14)
    if 0.0 < u < 1.0:
        for k in (-1, 1):
            F.line_burst(c, 90 + k * 46, 84, 8 + 12 * u, 15 + 20 * u, n=3,
                         rot=90 + k * 34, w=2.6 - 1.4 * u)


add(n=7, group='basic', ja='はーい・了解', en='Yes! / Got it',
    intent='返事／了解する',
    poses=[
        P(armR=ik(1, (134, 86)), armL=ik(0, (46, 86)), handR='open', handL='open',
          handR_ang=8, handL_ang=-8, root=(0, -4), legL=-3, legR=3, head_rot=0,
          face=dict(eye='happy', mouth='shout', cheek=2)),
        P(armR=ik(1, (126, 142)), armL=ik(0, (54, 142)), handR='open', handL='open',
          handR_ang=20, handL_ang=-20, hip_dy=5, head_off=(0, 3),
          face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (132, 116)), armL=ik(0, (48, 116)), handR='open', handL='open',
          handR_ang=14, handL_ang=-14, head_off=(0, 1),
          face=dict(eye='dot', mouth='o', cheek=2)),
        P(armR=ik(1, (139, 76)), armL=ik(0, (41, 76)), handR='open', handL='open',
          handR_ang=4, handL_ang=-4, root=(0, -8), legL=-6, legR=6,
          head_off=(0, -2), shoulder_dy=-3,
          face=dict(eye='happy', mouth='shout', cheek=2)),
        P(armR=ik(1, (133, 92)), armL=ik(0, (47, 92)), handR='open', handL='open',
          handR_ang=10, handL_ang=-10, root=(0, -1),
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (134, 84)), armL=ik(0, (46, 84)), handR='open', handL='open',
          handR_ang=8, handL_ang=-8, root=(0, -3),
          face=dict(eye='happy', mouth='grin', cheek=2)),
    ],
    stops=[0, 3, 6, 9, 13, 17], eases=['out', 'anticip', 'in', 'back', 'out', 'inout'],
    beat=[4, 3, 3, 4, 3, 2, 2, 2, 2, 7, 6, 4, 3, 2, 3, 3, 3, 3, 3, 4],
    fx=fx07,
    moving='両腕・両手・全身の上下・肩', fixed='接地の左右位置・顔の中心',
    motion_family='両手', spatial_path='縦', tempo='fast',
    beat_pattern='単発', loop_return='反動',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='全身と大きなポーズ', deform='つま先立ち', intensity=4,
    first_frame='両手をぱっと挙げて口を開き、元気に返事をしている状態',
    peak_frame='両手が最高点まで跳ね上がり体が8px浮き、手の外側に衝撃線が3本ずつ出る',
    hook='左右対称に跳ね上がる両手')


# --------------------------------------------------------------- 08 thumbs
def fx08(c, p, i):
    u = ph(i, 9, 14)
    if 0.0 < u < 1.0:
        for k in (-1, 1):
            c.line([(128 + k * 3, 84 - 12 * u), (128 + k * 9, 70 - 20 * u)], INK, 2.6 - 1.4 * u)


add(n=8, group='basic', ja='いいね', en='Nice / Like',
    intent='賛成／ほめる',
    poses=[
        P(armR=ik(1, (128, 104)), armL=REST_L, handR='thumb', handR_ang=0,
          head_rot=3, face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (120, 130)), armL=REST_L, handR='thumb', handR_ang=-14,
          head_rot=6, lean=-3, face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (126, 114)), armL=REST_L, handR='thumb', handR_ang=-6,
          head_rot=4, face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (133, 88)), armL=REST_L, handR='thumb', handR_ang=4, handR_s=1.45,
          head_rot=-2, lean=4, face=dict(eye='happy', mouth='shout', cheek=2)),
        P(armR=ik(1, (129, 100)), armL=REST_L, handR='thumb', handR_ang=2, handR_s=1.14,
          head_rot=1, lean=1, face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (126, 112)), armL=ik(0, (58, 148)), handR='thumb', handR_ang=-4,
          handR_s=1.04, head_rot=0, lean=1,
          face=dict(eye='dot', mouth='smile', cheek=2)),
    ],
    stops=[0, 3, 6, 9, 13, 17], eases=['out', 'anticip', 'in', 'back', 'out', 'inout'],
    beat=[4, 3, 3, 3, 2, 2, 2, 2, 2, 7, 6, 4, 3, 3, 3, 3, 3, 4, 4, 4],
    fx=fx08,
    moving='右腕・親指・上半身', fixed='両足・腰・左腕',
    motion_family='片腕', spatial_path='縦', tempo='fast',
    beat_pattern='単発', loop_return='反動',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='上半身中心', deform='手の遠近拡大', intensity=4,
    first_frame='胸の高さで親指を立て、自信のある笑顔',
    peak_frame='腕が引かれた位置から突き上がり、親指が大きく手前上へ、勢い線が2本',
    hook='突き上がる大きな親指')


# --------------------------------------------------------------- 09 nodding
def fx09(c, p, i):
    u = ph(i, 5, 9)
    for k in (0, 1):
        a0 = 200 + 30 * k
        r = 15 + 7 * k
        c.line(F.arc_pts(74 - 4 * k, 44 + 10 * u, r, r * 0.8, a0, a0 + 34, 10),
               INK, 2.3 - 0.6 * k)


add(n=9, group='basic', ja='うんうん', en='Nodding yes',
    intent='同意／うんうんと聞く',
    poses=[
        P(armR=ik(1, (124, 150)), armL=ik(0, (56, 150)), head_rot=11, head_off=(0, 10),
          shoulder_dy=1, face=dict(eye='happy', mouth='smile', cheek=2)),
        P(armR=ik(1, (127, 144)), armL=ik(0, (53, 144)), head_rot=-6, head_off=(0, -8),
          shoulder_dy=-3, face=dict(eye='dot', mouth='flat', cheek=2)),
        P(armR=ik(1, (125, 147)), armL=ik(0, (55, 147)), head_rot=2, head_off=(0, 0),
          shoulder_dy=-1, face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (122, 153)), armL=ik(0, (58, 153)), head_rot=19, head_off=(0, 17),
          shoulder_dy=3, face=dict(eye='happy', mouth='w', cheek=2)),
        P(armR=ik(1, (127, 145)), armL=ik(0, (53, 145)), head_rot=-5, head_off=(0, -6),
          shoulder_dy=-2, face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (123, 151)), armL=ik(0, (57, 151)), head_rot=15, head_off=(0, 13),
          shoulder_dy=2, face=dict(eye='happy', mouth='smile', cheek=2)),
    ],
    stops=[0, 3, 5, 8, 12, 15], eases=['out', 'inout', 'in', 'out', 'in', 'out'],
    beat=[3, 2, 2, 3, 2, 2, 2, 5, 4, 2, 2, 3, 3, 2, 2, 4, 3, 3, 3, 3],
    fx=fx09,
    moving='頭・肩', fixed='両足・腰・胴体・両腕',
    motion_family='頭', spatial_path='縦', tempo='medium',
    beat_pattern='4交互', loop_return='通常復帰',
    h_anchor='顔中心', travel=False, exitable=False,
    composition='顔アップ寄り', deform='なし', intensity=2,
    first_frame='あごを引いて目を細めて笑い、頭上にうなずきの軌跡が2本',
    peak_frame='頭が最も深く下がり、肩が上がり、軌跡の弧が下へ伸びる',
    hook='うなずきの軌跡と深い一拍')


# ---------------------------------------------------------------- 10 please
def fx10(c, p, i):
    u = 0.30 + 0.70 * ph(i, 9, 15)
    for k, s in ((-1, 1.0), (1, 0.78), (0, 0.58)):
        F.sparkle(c, 90 + k * (34 + 8 * u), 54 - 10 * u - 12 * abs(k),
                  (13.0 - 4.0 * u) * s)


add(n=10, group='basic', ja='おねがい', en='Please',
    intent='お願いする／頼む',
    poses=[
        P(armR=ik(1, (95, 98)), armL=ik(0, (85, 98)), head_rot=-8, head_off=(0, -2),
          face=dict(eye='big', brow='sad', mouth='pout', cheek=3, eye_off=(0, -2))),
        P(armR=ik(1, (97, 132)), armL=ik(0, (83, 132)), head_rot=0, head_off=(0, 4),
          face=dict(eye='dot', brow='sad', mouth='flat', cheek=3)),
        P(armR=ik(1, (95, 114)), armL=ik(0, (85, 114)), head_rot=-3, head_off=(0, 0),
          face=dict(eye='big', brow='sad', mouth='pout', cheek=3)),
        P(armR=ik(1, (94, 92)), armL=ik(0, (86, 92)), head_rot=-12, head_off=(0, -8),
          root=(0, -5), legL=-4, legR=4,
          face=dict(eye='sparkle', brow='sad', mouth='pout', cheek=3, eye_off=(0, -3))),
        P(armR=ik(1, (95, 98)), armL=ik(0, (85, 98)), head_rot=-8, head_off=(0, -4),
          root=(0, -1), face=dict(eye='sparkle', brow='sad', mouth='pout', cheek=3)),
        P(armR=ik(1, (95, 102)), armL=ik(0, (85, 102)), head_rot=-7, head_off=(0, -3),
          face=dict(eye='big', brow='sad', mouth='pout', cheek=3)),
    ],
    stops=[0, 4, 7, 10, 14, 17], eases=['inout', 'anticip', 'out3', 'settle', 'inout', 'out'],
    beat=[4, 3, 3, 3, 3, 3, 2, 2, 2, 2, 7, 6, 3, 3, 3, 3, 3, 3, 3, 4],
    fx=fx10,
    moving='両腕・頭・つま先・目', fixed='腰・胴体・接地の左右位置',
    motion_family='両手', spatial_path='縦', tempo='medium',
    beat_pattern='単発', loop_return='戻らず保持',
    h_anchor='胴体中心', travel=False, exitable=False,
    composition='上半身中心', deform='つま先立ち', intensity=3,
    first_frame='胸の前で両手を合わせ、上目づかいの大きな目と下がり眉',
    peak_frame='合わせた手があごの高さまで上がり、つま先立ちになって目がきらめき、頭上に星3つ',
    hook='あごまで上がる合わせ手ときらめく目')


# ------------------------------------------------------------ 11 going out
def fx11(c, p, i):
    hl, ang = rig.hand_world(p, 0)
    F.bag(c, hl[0] - 2, hl[1] + 11, 0.86, rot=-8 + 10 * (i % 4) / 3.0)
    u = ph(i, 0, 13)
    F.speed_lines(c, 60 - 16 * u, 118, n=3, ln=13 + 12 * u, gap=9, w=2.4)


add(n=11, group='basic', ja='いってきます', en='Heading out',
    intent='外出の報告／出発',
    poses=[
        P(armR=ik(1, (128, 116)), armL=ik(0, (68, 138)), legL=36, legR=-34, lean=8,
          root=(0, -2), head_rot=-4, handR='open', handR_ang=60,
          face=dict(eye='happy', mouth='open', cheek=2)),
        P(armR=ik(1, (118, 128)), armL=ik(0, (74, 128)), legL=6, legR=-8, lean=4,
          hip_dy=6, head_rot=-1, handR='open',
          face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (132, 110)), armL=ik(0, (64, 142)), legL=-26, legR=30, lean=9,
          root=(4, -7), head_rot=-5, handR='open',
          face=dict(eye='happy', mouth='open', cheek=2)),
        P(armR=ik(1, (138, 104)), armL=ik(0, (60, 146)), legL=42, legR=-40, lean=12,
          root=(13, -4), head_rot=-7, handR='open', handR_ang=52, dress_flare=1.08,
          face=dict(eye='happy', mouth='shout', cheek=2)),
        P(armR=ik(1, (130, 114)), armL=ik(0, (66, 140)), legL=-30, legR=34, lean=9,
          root=(8, -6), head_rot=-4, handR='open',
          face=dict(eye='happy', mouth='open', cheek=2)),
        P(armR=ik(1, (124, 122)), armL=ik(0, (70, 134)), legL=16, legR=-14, lean=5,
          root=(2, -1), head_rot=-2, handR='open',
          face=dict(eye='happy', mouth='smile', cheek=2)),
    ],
    stops=[0, 3, 6, 10, 14, 17], eases=['out', 'in', 'out', 'inout', 'out', 'inout'],
    beat=[3, 2, 2, 2, 2, 2, 2, 3, 3, 3, 5, 4, 2, 2, 3, 3, 3, 3, 3, 4],
    fx=fx11,
    moving='両脚・両腕・胴体・カバン・全身の横移動', fixed='内部リグ（顔・耳・線幅）',
    motion_family='足', spatial_path='横', tempo='fast',
    beat_pattern='連続', loop_return='退出再登場なしの往復',
    h_anchor='なし（横移動あり）', travel=True, exitable=False,
    composition='全身と大きなポーズ', deform='スカートのなびき', intensity=4,
    first_frame='カバンを提げて片脚を前に踏み出した走り出しの姿勢、動き線つき',
    peak_frame='歩幅が最大になり体が右へ13px進み、スカートが開いて動き線が伸びる',
    hook='大きな歩幅とカバンの揺れ')


# ------------------------------------------------------------ 12 good work
def fx12(c, p, i):
    hr, ang = rig.hand_world(p, 1)
    F.mug(c, hr[0] + 1, hr[1] - 10, 1.46, rot=-8 + 16 * ph(i, 6, 12))
    for k in range(2):
        uk = cyc(i, 0.10 + 0.5 * k)
        if taper(uk) < 0.03:
            continue
        F.puff(c, hr[0] - 3 + 7 * uk, hr[1] - 20 - 30 * uk,
               (3.2 + 5.6 * uk) * taper(uk))


add(n=12, group='basic', ja='おつかれさま', en='Good work today',
    intent='ねぎらい／乾杯・ひと息',
    poses=[
        P(armR=ik(1, (131, 94)), armL=REST_L, head_rot=-7,
          face=dict(eye='happy', mouth='smile', cheek=2)),
        P(armR=ik(1, (126, 132)), armL=REST_L, head_rot=1,
          face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (126, 120)), armL=REST_L, head_rot=-1,
          face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (132, 90)), armL=REST_L, head_rot=-11, head_off=(1, -2), lean=-4,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (130, 98)), armL=REST_L, head_rot=-7, lean=-1,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (125, 106)), armL=REST_L, head_rot=-5,
          face=dict(eye='happy', mouth='smile', cheek=2)),
    ],
    stops=[0, 4, 7, 11, 15, 18], eases=['inout', 'anticip', 'out3', 'settle', 'inout', 'out'],
    beat=[4, 3, 3, 3, 3, 3, 2, 2, 2, 3, 3, 6, 6, 3, 3, 3, 3, 3, 4, 4],
    fx=fx12,
    moving='右腕・マグ・湯気・頭', fixed='両足・腰・左腕・胴体',
    motion_family='小物', spatial_path='縦', tempo='slow',
    beat_pattern='大小2拍', loop_return='戻らず保持',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='上半身中心', deform='なし', intensity=2,
    first_frame='マグを胸の高さに持ち、湯気が上がるやわらかい笑顔',
    peak_frame='マグを顔の横まで掲げ、頭が反対へ傾き、湯気が2つ大きく立ちのぼる',
    hook='掲げたマグと立ちのぼる湯気')
