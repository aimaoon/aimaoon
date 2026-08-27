# -*- coding: utf-8 -*-
"""Emoji 13-24: bright feelings and reactions (character)."""
from rig import P, ik, INK, SKIN, LENS, WHITE
import rig
import fx as F
from items_a import ph, cyc, taper, REST_L, REST_R

ITEMS = []


def add(**kw):
    ITEMS.append(kw)


# ------------------------------------------------------------------ 13 jump
def fx13(c, p, i):
    u = ph(i, 8, 13)
    if 0.0 < u < 1.0:
        for k in (-1, 1):
            F.sparkle(c, 90 + k * (48 + 14 * u), 60 - 10 * u, 9.0 - 3.4 * u)
    v = ph(i, 14, 19)
    if 0.0 < v < 1.0:
        for k in (-1, 1):
            F.puff(c, 90 + k * (20 + 16 * v), 157 - 2 * v, 3.8 + 4.2 * v)


add(n=13, group='bright', ja='やったー', en='Yay!',
    intent='喜ぶ／成功を伝える',
    poses=[
        P(root=(0, -11), armR=ik(1, (142, 92)), armL=ik(0, (38, 92)),
          handR='open', handL='open', handR_ang=26, handL_ang=-26,
          legL=-24, legR=24, face=dict(eye='happy', brow='up', mouth='shout', cheek=2)),
        P(root=(0, 0), hip_dy=13, footL=(80, 158), footR=(100, 158),
          armR=ik(1, (124, 140)), armL=ik(0, (56, 140)), lean=7, head_off=(0, 3),
          face=dict(eye='squeeze', brow='up', mouth='flat', cheek=2)),
        P(root=(0, -4), hip_dy=2, armR=ik(1, (136, 112)), armL=ik(0, (44, 112)),
          handR='open', handL='open', legL=-8, legR=8, lean=2,
          face=dict(eye='dot', brow='up', mouth='o', cheek=2)),
        P(root=(0, -14), armR=ik(1, (146, 78)), armL=ik(0, (34, 78)),
          handR='open', handL='open', handR_ang=36, handL_ang=-36,
          legL=-38, legR=38, dress_flare=1.10, head_off=(0, -2),
          face=dict(eye='happy', brow='up', mouth='shout', cheek=2)),
        P(root=(0, -6), armR=ik(1, (138, 104)), armL=ik(0, (42, 104)),
          handR='open', handL='open', legL=-14, legR=14,
          face=dict(eye='happy', brow='up', mouth='open', cheek=2)),
        P(root=(0, 1), hip_dy=8, footL=(81, 158), footR=(99, 158),
          armR=ik(1, (130, 128)), armL=ik(0, (50, 128)), lean=4,
          face=dict(eye='happy', brow='up', mouth='grin', cheek=2)),
    ],
    stops=[0, 3, 6, 9, 13, 16], eases=['in', 'anticip', 'out3', 'in', 'out', 'settle'],
    beat=[3, 3, 3, 3, 2, 2, 2, 2, 2, 6, 5, 3, 3, 3, 3, 3, 4, 4, 4, 4],
    fx=fx13,
    moving='全身の上下・両腕・両脚・スカート', fixed='内部リグ・左右位置',
    motion_family='全身', spatial_path='縦', tempo='fast',
    beat_pattern='単発', loop_return='反動',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='全身と大きなポーズ', deform='スカートの開き', intensity=5,
    first_frame='空中で両手両脚を開き、口を大きく開けて喜んでいる',
    peak_frame='跳躍の最高点で体が14px浮き、手脚が最大に開き、頭上左右に星が飛ぶ',
    hook='空中で開いた手脚と着地の砂ぼこり')


# ----------------------------------------------------------------- 14 clap
def fx14(c, p, i):
    u = 0.30 + 0.70 * ph(i, 9, 14) - 0.30 * ph(i, 16, 19)
    F.line_burst(c, 90, 112, 12 + 20 * u, 21 + 32 * u, n=8, rot=22, w=2.8 - 1.5 * u)
    F.sparkle(c, 120 + 10 * u, 94 - 8 * u, 12.0 - 3.4 * u)
    F.sparkle(c, 60 - 10 * u, 98 - 6 * u, 10.0 - 3.0 * u)


add(n=14, group='bright', ja='わーい・拍手', en='Applause',
    intent='ほめる／祝う／拍手',
    poses=[
        P(armR=ik(1, (118, 104)), armL=ik(0, (62, 104)), handR='open', handL='open',
          handR_ang=142, handL_ang=218, head_rot=-4, head_off=(0, -1), shoulder_dy=-1,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (118, 106)), armL=ik(0, (62, 106)), handR='open', handL='open',
          handR_ang=140, handL_ang=220, head_rot=2,
          face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (129, 102)), armL=ik(0, (51, 102)), handR='open', handL='open',
          handR_ang=134, handL_ang=226, head_rot=4, shoulder_dy=-2,
          face=dict(eye='dot', mouth='o', cheek=2)),
        P(armR=ik(1, (98, 113)), armL=ik(0, (82, 113)), handR='open', handL='open',
          handR_ang=152, handL_ang=208, head_rot=-6, sy=0.975, head_off=(0, 2),
          face=dict(eye='happy', mouth='shout', cheek=2)),
        P(armR=ik(1, (112, 109)), armL=ik(0, (68, 109)), handR='open', handL='open',
          handR_ang=144, handL_ang=216, head_rot=-2,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (104, 111)), armL=ik(0, (76, 111)), handR='open', handL='open',
          handR_ang=148, handL_ang=212, head_rot=-4,
          face=dict(eye='happy', mouth='grin', cheek=2)),
    ],
    stops=[0, 3, 6, 9, 13, 16], eases=['out', 'inout', 'out', 'in', 'out', 'inout'],
    beat=[3, 2, 3, 3, 3, 3, 3, 3, 2, 6, 5, 3, 2, 3, 3, 3, 3, 3, 3, 3],
    fx=fx14,
    moving='両腕・両手の間隔・肩・胴体の縦つぶれ', fixed='両足・腰・頭の位置',
    motion_family='両手', spatial_path='横', tempo='fast',
    beat_pattern='3連打', loop_return='通常復帰',
    h_anchor='胴体中心', travel=False, exitable=False,
    composition='上半身中心', deform='胴体の縦つぶれ', intensity=4,
    first_frame='両手を打ち合わせた直後の位置で、口を開けて笑っている',
    peak_frame='左右に開いた手が中央で衝突し、衝撃線8本ときらめき2つが出る',
    hook='開いて閉じる手の間隔と衝突の衝撃線')


# ----------------------------------------------------------------- 15 love
def fx15(c, p, i):
    s = 38.0 + 15.0 * ph(i, 6, 10) - 10.0 * ph(i, 10, 15)
    F.heart(c, 90, 116, s)
    u = ph(i, 9, 18)
    if u > 0.0:
        for k, sd in ((-1, 0.0), (1, 0.28), (-1, 0.55)):
            uk = max(0.0, min(1.0, (u - sd) * 1.9))
            if uk > 0.0:
                F.heart(c, 90 + k * (22 + 26 * uk), 96 - 44 * uk, 13 - 5 * uk,
                        rot=k * 18)


add(n=15, group='bright', ja='大好き', en='Love it',
    intent='好意を伝える／お礼を強めに',
    poses=[
        P(armR=ik(1, (119, 113)), armL=ik(0, (61, 113)), handR='open', handL='open',
          handR_ang=156, handL_ang=204, head_rot=-6, head_off=(0, -2),
          face=dict(eye='happy', mouth='w', cheek=3)),
        P(armR=ik(1, (101, 124)), armL=ik(0, (79, 124)), handR='open', handL='open',
          handR_ang=164, handL_ang=196, head_rot=-1, head_off=(0, 2),
          face=dict(eye='dot', mouth='smile', cheek=3)),
        P(armR=ik(1, (110, 119)), armL=ik(0, (70, 119)), handR='open', handL='open',
          handR_ang=158, handL_ang=202, head_rot=-3,
          face=dict(eye='happy', mouth='w', cheek=3)),
        P(armR=ik(1, (126, 110)), armL=ik(0, (54, 110)), handR='open', handL='open',
          handR_ang=150, handL_ang=210, head_rot=-8, head_off=(0, -4), lean=-4,
          face=dict(eye='sparkle', mouth='grin', cheek=3)),
        P(armR=ik(1, (117, 115)), armL=ik(0, (63, 115)), handR='open', handL='open',
          handR_ang=156, handL_ang=204, head_rot=-5, lean=-1,
          face=dict(eye='sparkle', mouth='w', cheek=3)),
        P(armR=ik(1, (111, 118)), armL=ik(0, (69, 118)), handR='open', handL='open',
          handR_ang=159, handL_ang=201, head_rot=-4,
          face=dict(eye='happy', mouth='w', cheek=3)),
    ],
    stops=[0, 3, 6, 10, 14, 17], eases=['inout', 'in', 'out3', 'settle', 'inout', 'inout'],
    beat=[4, 3, 3, 3, 3, 3, 2, 2, 2, 6, 6, 3, 3, 3, 3, 3, 3, 3, 4, 4],
    fx=fx15,
    moving='ハート本体の大きさ・両腕・飛び出すハート3つ', fixed='両足・腰・胴体',
    motion_family='エフェクト', spatial_path='円弧', tempo='medium',
    beat_pattern='呼吸', loop_return='戻らず保持',
    h_anchor='胴体中心', travel=False, exitable=False,
    composition='身体変形またはエフェクトが主役', deform='なし', intensity=4,
    first_frame='大きなハートを両手で抱え、猫口とチーク3本の幸せ顔',
    peak_frame='ハートが最大まで鼓動して腕が押し広げられ、小さなハート3つが別軌道で飛び出す',
    hook='抱えたハートの鼓動と飛び出す3つのハート')


# ------------------------------------------------------------- 16 amazing
def fx16(c, p, i):
    if 3 <= i <= 5:                       # arm is behind the back here
        return
    hr, _ = rig.hand_world(p, 1)
    sc = 1.0 if i < 3 else 0.62 + 0.55 * ph(i, 6, 10)
    F.star5(c, hr[0] + 3, hr[1] - 12, 15 * sc, rot=-90 + 16 * ph(i, 6, 11))
    u = ph(i, 9, 15)
    if 0.0 < u < 1.0:
        for k, a in ((0, 1.0), (1, 0.7), (2, 0.5)):
            F.sparkle(c, hr[0] - 26 - 12 * u + 12 * k, hr[1] - 34 - 12 * u + 14 * k,
                      (8.0 - 3.0 * u) * a)


add(n=16, group='bright', ja='すごい！', en='Amazing!',
    intent='感心する／すごいと伝える',
    poses=[
        P(armR=ik(1, (138, 84)), armL=REST_L, handR='round', head_rot=-6, lean=-2,
          face=dict(eye='sparkle', brow='up', mouth='open', cheek=2)),
        P(armR=ik(1, (112, 150)), armL=REST_L, handR='round', head_rot=4, lean=4,
          head_off=(0, 3), face=dict(eye='dot', brow='neutral', mouth='smile', cheek=2)),
        P(armR=ik(1, (134, 128)), armL=REST_L, handR='round', head_rot=0, lean=2,
          face=dict(eye='big', brow='up', mouth='o', cheek=2)),
        P(armR=ik(1, (143, 70)), armL=ik(0, (52, 132)), handR='round',
          head_rot=-12, lean=-6, head_off=(1, -3), root=(0, -4),
          face=dict(eye='sparkle', brow='up', mouth='shout', cheek=2)),
        P(armR=ik(1, (140, 86)), armL=ik(0, (54, 140)), handR='round',
          head_rot=-8, lean=-3, face=dict(eye='sparkle', brow='up', mouth='open', cheek=2)),
        P(armR=ik(1, (139, 82)), armL=REST_L, handR='round', head_rot=-7, lean=-2,
          face=dict(eye='sparkle', brow='up', mouth='open', cheek=2)),
    ],
    stops=[0, 3, 6, 10, 14, 17], eases=['inout', 'in', 'out3', 'back', 'out', 'inout'],
    beat=[4, 3, 3, 3, 3, 2, 2, 2, 2, 3, 7, 6, 3, 2, 3, 3, 3, 3, 3, 4],
    fx=fx16,
    moving='右腕・肩・上半身・星・きらめき', fixed='両足・腰・左腕（前半）',
    motion_family='小物', spatial_path='円弧', tempo='medium',
    beat_pattern='単発', loop_return='戻らず保持',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='全身と大きなポーズ', deform='上半身の反り', intensity=4,
    first_frame='星を顔の横に掲げ、目がきらめき口が開いた感心の表情',
    peak_frame='背中へ回した腕が振り上がり、星が頭より高く最大サイズで掲げられ、きらめき3つが散る',
    hook='背中から取り出して掲げる星')


# ---------------------------------------------------------------- 17 laugh
def fx17(c, p, i):
    u = ph(i, 8, 14)
    if 0.0 < u < 1.0:
        for k in (-1, 1):
            for j in range(2):
                x = 90 + k * (46 + 12 * u + j * 9)
                c.line([(x, 66 - 8 * u - j * 6), (x + k * 9, 60 - 10 * u - j * 6)],
                       INK, 2.4 - 1.0 * u - 0.4 * j)


add(n=17, group='bright', ja='笑う', en='Laughing',
    intent='笑う／面白いと伝える',
    poses=[
        P(armR=ik(1, (104, 134)), armL=ik(0, (76, 134)), lean=14, head_rot=9,
          head_off=(0, 6), face=dict(eye='happy', mouth='shout', cheek=3)),
        P(armR=ik(1, (106, 128)), armL=ik(0, (74, 128)), lean=-4, head_rot=-4,
          head_off=(0, -6), face=dict(eye='happy', mouth='grin', cheek=3)),
        P(armR=ik(1, (105, 131)), armL=ik(0, (75, 131)), lean=5, head_rot=2,
          head_off=(0, 0), face=dict(eye='squeeze', mouth='shout', cheek=3)),
        P(armR=ik(1, (103, 138)), armL=ik(0, (77, 138)), lean=19, head_rot=14,
          head_off=(0, 14), hip_dy=6, sy=0.97,
          face=dict(eye='squeeze', mouth='shout', cheek=3)),
        P(armR=ik(1, (105, 130)), armL=ik(0, (75, 130)), lean=2, head_rot=0,
          head_off=(0, -3), face=dict(eye='squeeze', mouth='shout', cheek=3)),
        P(armR=ik(1, (104, 135)), armL=ik(0, (76, 135)), lean=13, head_rot=9,
          head_off=(0, 8), face=dict(eye='happy', mouth='shout', cheek=3)),
    ],
    stops=[0, 3, 5, 8, 12, 16], eases=['out', 'in', 'out', 'in', 'out', 'inout'],
    beat=[3, 2, 2, 3, 2, 2, 4, 4, 2, 2, 3, 3, 2, 2, 3, 3, 3, 3, 3, 3],
    fx=fx17,
    moving='上半身の折れ・頭・両手（お腹）・笑い線', fixed='両足・接地',
    motion_family='全身', spatial_path='縦', tempo='fast',
    beat_pattern='4交互', loop_return='通常復帰',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='全身と大きなポーズ', deform='上半身の折れ', intensity=4,
    first_frame='お腹を両手で押さえて前に折れ、目を細めて大口で笑っている',
    peak_frame='上体が最も深く折れて頭が14px沈み、左右に笑い線が4本飛ぶ',
    hook='お腹を抱えて折れる上体と笑い線')


# ----------------------------------------------------------------- 18 shy
def fx18(c, p, i):
    grow = 1.0 + 0.34 * ph(i, 7, 11) - 0.34 * ph(i, 11, 17)
    for k, sd in ((-1, 0.0), (1, 0.26), (-1, 0.52), (1, 0.76)):
        uk = cyc(i, sd)
        if taper(uk) < 0.03:
            continue
        F.puff(c, 90 + k * (32 + 13 * uk), 66 - 36 * uk,
               (3.6 + 6.6 * uk) * grow * taper(uk))


add(n=18, group='bright', ja='照れる', en='Bashful',
    intent='照れる／ほめられた返事',
    poses=[
        P(armR=ik(1, (120, 97)), armL=ik(0, (60, 97)), handR='open', handL='open',
          handR_ang=170, handL_ang=190, head_rot=-11, shoulder_dy=-2, head_off=(-1, -1),
          face=dict(eye='happy', brow='worry', mouth='wave', cheek=3)),
        P(armR=ik(1, (123, 110)), armL=ik(0, (57, 110)), handR='open', handL='open',
          handR_ang=176, handL_ang=184, head_rot=-2, head_off=(0, 3),
          face=dict(eye='dot', brow='worry', mouth='pout', cheek=3)),
        P(armR=ik(1, (122, 104)), armL=ik(0, (58, 104)), handR='open', handL='open',
          handR_ang=174, handL_ang=186, head_rot=4,
          face=dict(eye='dot', brow='worry', mouth='wave', cheek=3)),
        P(armR=ik(1, (119, 96)), armL=ik(0, (61, 96)), handR='open', handL='open',
          handR_ang=168, handL_ang=192, head_rot=17, head_off=(2, -3),
          sy=0.975, sx=1.02, face=dict(eye='squeeze', brow='worry', mouth='w', cheek=3)),
        P(armR=ik(1, (120, 99)), armL=ik(0, (60, 99)), handR='open', handL='open',
          handR_ang=170, handL_ang=190, head_rot=-14, head_off=(-2, -1),
          face=dict(eye='squeeze', brow='worry', mouth='w', cheek=3)),
        P(armR=ik(1, (121, 100)), armL=ik(0, (59, 100)), handR='open', handL='open',
          handR_ang=172, handL_ang=188, head_rot=-6,
          face=dict(eye='happy', brow='worry', mouth='wave', cheek=3)),
    ],
    stops=[0, 3, 6, 10, 14, 17], eases=['inout', 'inout', 'out', 'inout', 'out', 'inout'],
    beat=[4, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5, 3, 3, 3, 4, 3, 3, 3, 3, 3],
    fx=fx18,
    moving='頭の左右傾き・両手（頬）・湯気4つ', fixed='両足・腰・胴体の左右位置',
    motion_family='頭', spatial_path='円弧', tempo='medium',
    beat_pattern='2拍交互', loop_return='通常復帰',
    h_anchor='胴体中心', travel=False, exitable=False,
    composition='顔アップ寄り', deform='頭のわずかな横つぶれ', intensity=3,
    first_frame='両手を頬に当て、波形の口とチーク3本、湯気が出はじめている',
    peak_frame='頭が17度まで傾いて手が頬を押し、湯気が4つとも大きく立ちのぼる',
    hook='頬に当てた両手と左右に振れる頭')


# ---------------------------------------------------------------- 19 cheer
def fx19(c, p, i):
    hr, _ = rig.hand_world(p, 1)
    u = ph(i, 7, 14)                      # the flame lags the fist on purpose
    v = ph(i, 14, 19)
    g = u - 0.55 * v
    F.flame(c, hr[0] - 19, hr[1] + 6, 17 + 6 * g, 25 + 16 * g, wob=-0.5)
    F.flame(c, hr[0] + 17, hr[1] + 4, 15 + 6 * g, 23 + 15 * g, wob=0.5)
    F.flame(c, hr[0] - 1, hr[1] - 8, 23 + 10 * g, 36 + 30 * g, wob=0.1)


add(n=19, group='bright', ja='応援・ファイト', en='Cheering you on',
    intent='応援する／励ます',
    poses=[
        P(armR=ik(1, (138, 80)), armL=REST_L, handR='fist', handR_ang=0,
          head_rot=-6, face=dict(eye='big', brow='angry', mouth='shout', cheek=2)),
        P(armR=ik(1, (126, 124)), armL=REST_L, handR='fist', handR_ang=-8,
          head_rot=3, lean=-3, head_off=(0, 3),
          face=dict(eye='flat', brow='angry', mouth='flat', cheek=2)),
        P(armR=ik(1, (130, 108)), armL=REST_L, handR='fist', handR_ang=-4,
          head_rot=0, face=dict(eye='dot', brow='angry', mouth='o', cheek=2)),
        P(armR=ik(1, (137, 72)), armL=ik(0, (58, 140)), handR='fist', handR_ang=2,
          head_rot=-9, lean=-5, root=(0, -4), shoulder_dy=-3,
          face=dict(eye='big', brow='angry', mouth='shout', cheek=2)),
        P(armR=ik(1, (133, 86)), armL=ik(0, (57, 146)), handR='fist', handR_ang=0,
          head_rot=-6, lean=-2, face=dict(eye='big', brow='angry', mouth='shout', cheek=2)),
        P(armR=ik(1, (132, 92)), armL=REST_L, handR='fist', handR_ang=0,
          head_rot=-4, face=dict(eye='big', brow='angry', mouth='open', cheek=2)),
    ],
    stops=[0, 3, 6, 9, 14, 17], eases=['out', 'anticip', 'in', 'back', 'out', 'inout'],
    beat=[4, 3, 3, 3, 2, 2, 2, 2, 2, 7, 6, 3, 3, 3, 3, 3, 3, 3, 4, 4],
    fx=fx19,
    moving='右腕・拳・肩・炎（遅れて追従）', fixed='両足・腰・左腕（前半）',
    motion_family='片腕', spatial_path='縦', tempo='fast',
    beat_pattern='遅延2拍', loop_return='反動',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='上半身中心', deform='なし', intensity=5,
    first_frame='拳を顔の横まで上げ、つり眉と大口で気合いを入れている',
    peak_frame='拳が肩から突き上がって最高点に達し、遅れて炎3本が最大まで立ちのぼる',
    hook='突き上げる拳と遅れて立つ炎')


# ------------------------------------------------------------- 20 surprise
def fx20(c, p, i):
    u = ph(i, 4, 11)
    v = ph(i, 11, 18)
    s = 1.05 + 0.65 * u - 0.28 * v
    F.g_excl(c, 52 - 6 * u, 56 - 8 * u, s, 4.4)
    F.g_quest(c, 128 + 8 * u, 54 - 6 * u, s * 0.95, 4.4)
    if 0.0 < u < 1.0:
        F.line_burst(c, 90, 84, 42 + 10 * u, 52 + 16 * u, n=5, rot=250, w=2.6 - 1.4 * u)


add(n=20, group='bright', ja='びっくり', en='Whoa!',
    intent='驚く／意外な報告への反応',
    poses=[
        P(armR=ik(1, (134, 104)), armL=ik(0, (46, 104)), handR='open', handL='open',
          handR_ang=60, handL_ang=-60, lean=-9, head_rot=-6, head_off=(0, -3),
          face=dict(eye='big', brow='up', mouth='shout', cheek=0)),
        P(armR=ik(1, (122, 126)), armL=ik(0, (58, 126)), handR='round', handL='round',
          lean=2, head_rot=0, head_off=(0, 2), sy=0.97,
          face=dict(eye='dot', brow='neutral', mouth='flat', cheek=0)),
        P(armR=ik(1, (130, 112)), armL=ik(0, (50, 112)), handR='open', handL='open',
          lean=-4, head_rot=-3, face=dict(eye='big', brow='up', mouth='o', cheek=0)),
        P(armR=ik(1, (144, 90)), armL=ik(0, (36, 90)), handR='open', handL='open',
          handR_ang=76, handL_ang=-76, lean=-17, head_rot=-12, head_off=(0, -7),
          root=(0, -3), face=dict(eye='big', brow='up', mouth='shout', cheek=0)),
        P(armR=ik(1, (132, 108)), armL=ik(0, (48, 108)), handR='open', handL='open',
          lean=5, head_rot=4, head_off=(0, 3),
          face=dict(eye='big', brow='up', mouth='open', cheek=0)),
        P(armR=ik(1, (135, 102)), armL=ik(0, (45, 102)), handR='open', handL='open',
          lean=-6, head_rot=-4, face=dict(eye='big', brow='up', mouth='open', cheek=0)),
    ],
    stops=[0, 3, 5, 8, 12, 16], eases=['out', 'anticip', 'in', 'out3', 'back', 'settle'],
    beat=[3, 2, 2, 2, 2, 2, 2, 2, 7, 6, 4, 3, 3, 3, 3, 3, 3, 3, 3, 4],
    fx=fx20,
    moving='上半身の反り・両腕・頭・！と？', fixed='両足・接地',
    motion_family='全身', spatial_path='斜め', tempo='fast',
    beat_pattern='単発', loop_return='反動',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='全身と大きなポーズ', deform='上半身の反り', intensity=5,
    first_frame='上体をのけぞらせ両手を開いて上げ、目を見開いて口を開けている',
    peak_frame='のけぞりが最大になり、！と？が左右へ離れながら最大化し放射線が出る',
    hook='のけぞる上体と左右へ飛ぶ！？')


# ----------------------------------------------------------------- 21 idea
def fx21(c, p, i):
    hr, _ = rig.hand_world(p, 1)
    on = 0.0 if 3 <= i <= 8 else 1.0
    bx, by = hr[0] + 2, hr[1] - 23
    F.bulb(c, bx, by, 1.26, on=on)
    u = 0.25 + 0.75 * ph(i, 9, 15)
    if on:
        F.line_burst(c, bx, by - 2, 15 + 6 * u, 21 + 9 * u, n=6, rot=15, w=2.6 - 1.2 * u)


add(n=21, group='bright', ja='ひらめき', en='Got an idea',
    intent='思いついた／提案する',
    poses=[
        P(armR=ik(1, (134, 86)), armL=REST_L, handR='point', handR_ang=0,
          head_rot=-8, face=dict(eye='sparkle', brow='up', mouth='o', cheek=2)),
        P(armR=ik(1, (122, 134)), armL=REST_L, handR='point', handR_ang=-12,
          head_rot=6, head_off=(0, 4), lean=4,
          face=dict(eye='closed', brow='worry', mouth='flat', cheek=2)),
        P(armR=ik(1, (126, 116)), armL=REST_L, handR='point', handR_ang=-6,
          head_rot=2, head_off=(0, 1),
          face=dict(eye='dot', brow='neutral', mouth='flat', cheek=2)),
        P(armR=ik(1, (130, 92)), armL=REST_L, handR='point', handR_ang=4,
          head_rot=-10, head_off=(0, -4), lean=-4, root=(0, -3),
          face=dict(eye='sparkle', brow='up', mouth='shout', cheek=2)),
        P(armR=ik(1, (129, 98)), armL=REST_L, handR='point', handR_ang=2,
          head_rot=-7, lean=-1, face=dict(eye='sparkle', brow='up', mouth='open', cheek=2)),
        P(armR=ik(1, (129, 95)), armL=REST_L, handR='point', handR_ang=0,
          head_rot=-6, face=dict(eye='sparkle', brow='up', mouth='o', cheek=2)),
    ],
    stops=[0, 4, 7, 10, 14, 17], eases=['inout', 'in', 'inout', 'back', 'out', 'inout'],
    beat=[4, 3, 3, 3, 4, 3, 2, 2, 2, 2, 7, 6, 3, 2, 3, 3, 3, 3, 3, 4],
    fx=fx21,
    moving='右腕・人差し指・電球の点灯・頭', fixed='両足・腰・左腕・胴体',
    motion_family='小物', spatial_path='縦', tempo='medium',
    beat_pattern='単発', loop_return='戻らず保持',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='上半身中心', deform='なし', intensity=3,
    first_frame='人差し指を立て、頭上の電球が灯り、目がきらめいている',
    peak_frame='指が最高点で止まり電球が点灯して放射線6本が広がる',
    hook='立てた指と点灯する電球')


# ---------------------------------------------------------------- 22 happy
def fx22(c, p, i):
    u = ph(i, 4, 13)
    for k in (0, 1, 2):
        a0 = 150 + 70 * k + 120 * u
        r = 52 + 6 * k
        c.line(F.arc_pts(90, 118, r, r * 0.44, a0, a0 + 26, 10), INK, 2.4 - 0.6 * k)


add(n=22, group='bright', ja='うれしい', en='So happy',
    intent='うれしい気持ち／軽く浮かれる',
    poses=[
        P(armR=ik(1, (136, 108)), armL=ik(0, (48, 122)), handR='open', handL='open',
          handR_ang=70, handL_ang=-40, legL=-30, footR=(101, 158), lean=-5,
          head_rot=-8, dress_flare=1.16,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (124, 136)), armL=ik(0, (56, 136)), legL=0, legR=0, lean=0,
          head_rot=2, hip_dy=4, dress_flare=1.0,
          face=dict(eye='dot', mouth='smile', cheek=2)),
        P(armR=ik(1, (132, 118)), armL=ik(0, (50, 128)), handR='open', handL='open',
          legL=-14, lean=-2, head_rot=-3, dress_flare=1.08,
          face=dict(eye='happy', mouth='smile', cheek=2)),
        P(armR=ik(1, (143, 96)), armL=ik(0, (40, 114)), handR='open', handL='open',
          handR_ang=84, handL_ang=-56, legL=-46, footR=(102, 158), lean=-9,
          head_rot=-14, root=(0, -5), dress_flare=1.30,
          face=dict(eye='happy', mouth='shout', cheek=2)),
        P(armR=ik(1, (137, 106)), armL=ik(0, (46, 120)), handR='open', handL='open',
          legL=-24, lean=-5, head_rot=-9, root=(0, -1), dress_flare=1.18,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (133, 114)), armL=ik(0, (50, 126)), handR='open', handL='open',
          legL=-12, lean=-2, head_rot=-5, dress_flare=1.09,
          face=dict(eye='happy', mouth='grin', cheek=2)),
    ],
    stops=[0, 4, 7, 11, 15, 18], eases=['inout', 'in', 'out', 'settle', 'out', 'inout'],
    beat=[4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 3, 6, 5, 3, 3, 3, 3, 3, 4, 4],
    fx=fx22,
    moving='片脚の持ち上げ・両腕・スカートの開き・頭', fixed='軸足の接地',
    motion_family='足', spatial_path='円', tempo='medium',
    beat_pattern='大小2拍', loop_return='通常復帰',
    h_anchor='軸足', travel=False, exitable=False,
    composition='座り・寝姿・斜め向き', deform='スカートの大きな開き', intensity=4,
    first_frame='片脚を上げてスカートを翻し、両手を開いた回りはじめの姿勢',
    peak_frame='上げた脚が最大まで持ち上がりスカートが1.30倍に開き、回転軌跡の弧が3本回る',
    hook='翻るスカートと持ち上げた片脚')


# -------------------------------------------------------------- 23 sparkle
def fx23(c, p, i):
    u = 0.30 + 0.70 * ph(i, 9, 15) - 0.30 * ph(i, 17, 19)
    for k, (dx, dy, sc) in enumerate(((26, -14, 1.0), (-30, -20, 0.78), (4, -30, 0.6))):
        F.sparkle(c, 112 + dx * (0.5 + 0.9 * u), 74 + dy * (0.5 + 1.0 * u),
                  (16.0 - 4.0 * u) * sc, rot=12 * k)
    fl = ph(i, 10, 13) * (1.0 - ph(i, 13, 16))
    if fl > 0.02:
        c.line([(100, 70), (100 + 24 * fl, 70 - 9 * fl)], WHITE, 3.4)


add(n=23, group='bright', ja='キラキラ・決まった', en='Looking sharp',
    intent='ドヤ顔／決まった／かっこいい',
    poses=[
        P(armR=ik(1, (108, 96)), armL=REST_L, handR='point', handR_ang=44,
          head_rot=-6, glasses_off=(0, -1),
          face=dict(eye='happy', brow='up', mouth='smile', cheek=2)),
        P(armR=ik(1, (116, 126)), armL=REST_L, handR='point', handR_ang=10,
          head_rot=3, glasses_off=(0, 6), head_off=(0, 2),
          face=dict(eye='sleepy', brow='worry', mouth='flat', cheek=2)),
        P(armR=ik(1, (108, 106)), armL=REST_L, handR='point', handR_ang=26,
          head_rot=1, glasses_off=(0, 4),
          face=dict(eye='dot', brow='neutral', mouth='flat', cheek=2)),
        P(armR=ik(1, (100, 84)), armL=REST_L, handR='point', handR_ang=52,
          head_rot=-9, glasses_off=(0, -3), glasses_rot=-3, lean=-3,
          face=dict(eye='happy', brow='up', mouth='grin', cheek=2)),
        P(armR=ik(1, (114, 96)), armL=REST_L, handR='point', handR_ang=36,
          head_rot=-6, glasses_off=(0, -2), lean=-1,
          face=dict(eye='happy', brow='up', mouth='grin', cheek=2)),
        P(armR=ik(1, (110, 100)), armL=REST_L, handR='point', handR_ang=30,
          head_rot=-5, glasses_off=(0, -1),
          face=dict(eye='happy', brow='up', mouth='smile', cheek=2)),
    ],
    stops=[0, 4, 7, 11, 15, 18], eases=['inout', 'in', 'inout', 'back', 'out', 'inout'],
    beat=[4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 3, 7, 6, 3, 3, 3, 3, 3, 3, 4],
    fx=fx23,
    moving='右手（メガネのブリッジ）・メガネの上下・きらめき3つ', fixed='両足・腰・胴体・左腕',
    motion_family='小物', spatial_path='斜め', tempo='medium',
    beat_pattern='単発', loop_return='戻らず保持',
    h_anchor='顔中心', travel=False, exitable=False,
    composition='顔アップ寄り', deform='なし', intensity=3,
    first_frame='指をメガネのブリッジに添え、レンズが光ってきらめきが1つ出ている',
    peak_frame='メガネが押し上げられてレンズに白い閃光が走り、きらめき3つが外へ広がる',
    hook='押し上げるメガネとレンズの閃光')


# ---------------------------------------------------------------- 24 music
def fx24(c, p, i):
    for k, (sd, sx, sc) in enumerate(((0.0, 1, 1.0), (0.34, -1, 0.84), (0.67, 1, 0.70))):
        uk = cyc(i, sd)
        if taper(uk) < 0.03:
            continue
        F.note(c, 90 + sx * (32 + 26 * uk), 104 - 60 * uk, 11.5 * sc * taper(uk),
               rot=-16 + 36 * uk * sx)


add(n=24, group='bright', ja='ノリノリ', en='Feeling the beat',
    intent='気分がいい／楽しくノる',
    poses=[
        P(armR=ik(1, (128, 116)), armL=ik(0, (54, 128)), handR='open', handL='open',
          handR_ang=130, handL_ang=-150, head_rot=-13, head_off=(-2, 0),
          shoulder_dy=-2, face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (122, 128)), armL=ik(0, (58, 118)), handR='open', handL='open',
          head_rot=9, head_off=(2, 1), shoulder_dy=1,
          face=dict(eye='happy', mouth='smile', cheek=2)),
        P(armR=ik(1, (126, 120)), armL=ik(0, (56, 124)), handR='open', handL='open',
          head_rot=-4, head_off=(-1, 0), face=dict(eye='dot', mouth='o', cheek=2)),
        P(armR=ik(1, (133, 108)), armL=ik(0, (48, 134)), handR='open', handL='open',
          handR_ang=138, handL_ang=-158, head_rot=-21, head_off=(-4, -2),
          shoulder_dy=-4, sx=1.02, face=dict(eye='happy', mouth='shout', cheek=2)),
        P(armR=ik(1, (120, 130)), armL=ik(0, (60, 114)), handR='open', handL='open',
          head_rot=16, head_off=(3, 1), shoulder_dy=2,
          face=dict(eye='happy', mouth='grin', cheek=2)),
        P(armR=ik(1, (127, 118)), armL=ik(0, (55, 126)), handR='open', handL='open',
          head_rot=-9, head_off=(-2, 0), face=dict(eye='happy', mouth='grin', cheek=2)),
    ],
    stops=[0, 3, 6, 9, 13, 16], eases=['inout', 'inout', 'inout', 'out', 'inout', 'inout'],
    beat=[3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    fx=fx24,
    moving='頭の左右振り・肩・両腕・音符3つ', fixed='両足・腰・接地',
    motion_family='頭', spatial_path='横', tempo='fast',
    beat_pattern='連続', loop_return='通常復帰',
    h_anchor='両足中央', travel=False, exitable=False,
    composition='上半身中心', deform='頭のわずかな横のび', intensity=3,
    first_frame='頭を左へ振り肩を上げ、音符が飛びはじめている',
    peak_frame='頭が21度まで振り切れて肩が最も上がり、音符3つが別軌道で斜め上へ抜ける',
    hook='リズムで振れる頭と3つの音符')
