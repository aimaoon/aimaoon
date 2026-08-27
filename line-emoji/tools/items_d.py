# -*- coding: utf-8 -*-
"""Emoji 33-40: the eight character-free symbols.

Every one of these reads as a finished mark on frame 1.  The cycle then takes
it apart -- parts fly out along their own paths -- and rebuilds it with a
collision, a landing or a staged flare-up, so the construction is the action
rather than a pulse applied to a finished picture.
"""
import math
from rig import INK, SKIN, LENS, WHITE
import fx as F
from items_a import ph, cyc, taper

ITEMS = []


def add(**kw):
    ITEMS.append(kw)


def _e(u, k='out'):
    from anim import ease
    return ease(u, k)


def gather(i, out_end=6, back_start=6, back_end=12, kind='back'):
    """1.0 = assembled, 0.0 = fully dispersed."""
    if i <= out_end:
        return 1.0 - _e(ph(i, 0, out_end), 'inout')
    return _e(ph(i, back_start, back_end), kind)


def bump(i, a, b):
    return math.sin(math.pi * ph(i, a, b))


def settle(i, start, amp, freq=1.5, decay=0.34, phase=0.0):
    """Decaying wobble after the landing, so no two tail frames are identical."""
    if i < start:
        return 0.0
    t = i - start
    return amp * math.exp(-decay * t) * math.sin(freq * t + phase)


def partial_path(pts, frac):
    """Points up to `frac` of the path, with the final point interpolated so
    the stroke grows smoothly instead of snapping point to point."""
    frac = max(0.0, min(1.0, frac))
    t = frac * (len(pts) - 1)
    n = int(t)
    out = list(pts[:n + 1])
    if n + 1 < len(pts):
        r = t - n
        p, q = pts[n], pts[n + 1]
        out.append((p[0] + (q[0] - p[0]) * r, p[1] + (q[1] - p[1]) * r))
    return out if len(out) >= 2 else list(pts[:2])


def _mix(home, launch, g, bowx=0.0, bowy=0.0):
    """Travel between launch and home along a slightly bowed path."""
    t = 1.0 - g
    arc = 4.0 * t * (1.0 - t)
    return (home[0] + (launch[0] - home[0]) * t + bowx * arc,
            home[1] + (launch[1] - home[1]) * t + bowy * arc)


# ------------------------------------------------------------------- 33 OK!
def fx33(c, p, i):
    g = gather(i, 6, 6, 12, 'back')
    sq = 1.0 + 0.13 * bump(i, 11, 15)
    o = _mix((54, 92), (12, 156), g, bowx=-16, bowy=18)
    k = _mix((92, 92), (156, 22), g, bowx=22, bowy=-14)
    e = _mix((126, 90), (104, -26), g, bowx=26, bowy=0)
    F.g_O(c, o[0], o[1] + settle(i, 12, 5.0, 1.6, 0.30), 1.60 * sq, 5.6)
    F.g_K(c, k[0], k[1] + settle(i, 12, 4.2, 1.6, 0.30, 1.1), 1.60 * sq, 5.6)
    F.g_excl(c, e[0], e[1] + settle(i, 12, 6.0, 1.6, 0.30, 2.2), 1.60 * sq, 5.6)
    b = ph(i, 11, 18)
    if 0.0 < b < 1.0:
        F.line_burst(c, 90, 92, 46 + 14 * b, 56 + 24 * b, n=6, rot=14, w=2.8 - 1.8 * b)


add(n=33, group='symbol', ja='OK!', en='OK!',
    intent='了解／返事を短く返す',
    poses=None, stops=None, eases=None,
    beat=[4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 7, 6, 3, 3, 3, 3, 3, 3, 3],
    fx=fx33,
    moving='O・K・！の3部品', fixed='なし（記号のみ）',
    motion_family='エフェクト', spatial_path='円弧', tempo='fast',
    beat_pattern='3連打', loop_return='反動',
    h_anchor='中央（組み上がり位置）', travel=True, exitable=True,
    composition='記号', deform='着地の縦つぶれ', intensity=4,
    first_frame='O・K・！が中央に組み上がった完成状態',
    peak_frame='3部品が別方向の弧を描いて戻り中央で衝突、縦につぶれて衝撃線6本が広がる',
    hook='3方向から弧を描いて集まる文字')


# ----------------------------------------------------------------- 34 heart
def fx34(c, p, i):
    lid = 0.38 + 0.62 * _e(ph(i, 3, 10), 'back') - 0.50 * _e(ph(i, 13, 19), 'inout')
    F.gift_box(c, 90, 130, 1.45, lid_dy=-27 * lid, lid_rot=-31 * lid)
    for k, (sx, off, sc) in enumerate(((0.05, 0.00, 1.00), (-0.95, 0.34, 0.80),
                                       (0.90, 0.67, 0.66))):
        u = cyc(i, off)
        if taper(u, 0.22) < 0.03:
            continue
        F.heart(c, 90 + sx * 44 * u + 5 * math.sin(u * 5.2),
                118 - 78 * u + 22 * u * u,
                (13 + 9 * sc) * (0.50 + 0.60 * u) * taper(u, 0.22), rot=sx * 30 * u)


add(n=34, group='symbol', ja='ハート', en='Heart',
    intent='好意／お礼／かわいい反応',
    poses=None, stops=None, eases=None,
    beat=[4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 5, 3, 3, 3, 3, 3, 3, 4, 4],
    fx=fx34,
    moving='箱のふたの跳ね上がり・ハート3つの別軌道', fixed='箱の本体',
    motion_family='小物', spatial_path='放物線', tempo='medium',
    beat_pattern='単発', loop_return='退出再登場',
    h_anchor='箱の本体', travel=True, exitable=True,
    composition='記号', deform='なし', intensity=3,
    first_frame='ふたの開いた小箱から3つのハートが飛び出している完成状態',
    peak_frame='ふたが27px跳ね上がり、3つのハートが左右と正面の別々の放物線へ分かれる',
    hook='ふたが跳ねて飛び出す3つのハート')


# ----------------------------------------------------------------- 35 sweat
def fx35(c, p, i):
    for k, (x0, y0, vx, off, sc) in enumerate((
            (66, 62, -26, 0.00, 1.00),
            (104, 48, 30, 0.34, 0.82),
            (88, 76, 6, 0.67, 0.64))):
        u = cyc(i, off)
        x = x0 + vx * u
        y = y0 - 26 * u + 104 * u * u
        if y > 168:
            continue
        t = taper(u, 0.20)
        if t < 0.03:
            continue
        F.drop(c, x, y, (22 - 6 * u) * sc * t, (29 - 8 * u) * sc * t,
               rot=vx * 0.5 * u)


add(n=35, group='symbol', ja='汗', en='Sweat',
    intent='あせる／気まずい／なんとも言えない',
    poses=None, stops=None, eases=None,
    beat=[3, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3],
    fx=fx35,
    moving='3粒の噴出と落下', fixed='なし（記号のみ）',
    motion_family='エフェクト', spatial_path='放物線', tempo='medium',
    beat_pattern='連続', loop_return='退出再登場',
    h_anchor='なし（画面下へ退出）', travel=True, exitable=True,
    composition='記号', deform='なし', intensity=3,
    first_frame='大きさの違う3粒の汗が、別々の高さで噴き出している完成状態',
    peak_frame='3粒がそれぞれの放物線の頂点を別のタイミングで通過し、順に下へ落ちる',
    hook='別々の始点から出る3本の放物線')


# -------------------------------------------------------------------- 36 !?
def fx36(c, p, i):
    g = gather(i, 6, 6, 12, 'back')
    sq = 1.0 + 0.16 * bump(i, 11, 15)
    e = _mix((64, 92), (62, -14), g, bowx=10, bowy=0)
    q = _mix((120, 92), (198, 104), g, bowx=0, bowy=-22)
    F.g_excl(c, e[0] + settle(i, 12, 2.6, 2.1, 0.26, 0.7),
             e[1] + settle(i, 12, 6.5, 1.7, 0.30), 2.00 * sq, 6.4)
    F.g_quest(c, q[0] + settle(i, 12, 6.0, 1.7, 0.30, 1.9), q[1], 2.00 * sq, 6.4)
    b = ph(i, 11, 18)
    if 0.0 < b < 1.0:
        F.line_burst(c, 92, 92, 42 + 16 * b, 52 + 26 * b, n=5, rot=250, w=3.0 - 1.9 * b)


add(n=36, group='symbol', ja='！？', en='What?!',
    intent='驚き／聞き返す',
    poses=None, stops=None, eases=None,
    beat=[4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 8, 6, 3, 3, 3, 3, 3, 3, 3],
    fx=fx36,
    moving='！の縦の落下・？の横からの飛来・衝突の縦つぶれ', fixed='なし（記号のみ）',
    motion_family='エフェクト', spatial_path='縦と横の交差', tempo='fast',
    beat_pattern='2連打', loop_return='反動',
    h_anchor='中央（衝突位置）', travel=True, exitable=True,
    composition='記号', deform='衝突の縦つぶれ', intensity=5,
    first_frame='！と？が中央に並んだ完成状態',
    peak_frame='上から落ちた！と横から飛来した？が中央でぶつかり、放射線5本が出る',
    hook='縦と横から来てぶつかる！と？')


# --------------------------------------------------------------- 37 question
def fx37(c, p, i):
    g = gather(i, 6, 6, 12, 'out3')
    body = F.chain(F.bez((-6.6, -5.2), (-6.2, -12.4), (6.8, -12.6), (6.4, -5.0)),
                   F.bez((6.4, -5.0), (6.0, -0.4), (0.4, 0.2), (0.2, 4.2)))
    frac = 0.30 + 0.70 * g
    wob = settle(i, 11, 3.8, 1.5, 0.26, 0.9)
    F.glyph(c, [(90 + x * 2.75, 84 + wob + y * 2.75)
                for x, y in partial_path(body, frac)], 15.0)
    hop = 17.0 * bump(i, 12, 18) + settle(i, 17, 3.4, 1.9, 0.22)
    dx = 66.0 * (1.0 - g)
    F.glyph(c, [(90 + dx, 132 - hop), (90 + dx, 132.4 - hop)], 15.0)


add(n=37, group='symbol', ja='？', en='Question mark',
    intent='疑問／どういうこと？',
    poses=None, stops=None, eases=None,
    beat=[4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 5, 5, 4, 3, 3, 3, 3, 4],
    fx=fx37,
    moving='曲線本体の描き足しと巻き戻し・点の横移動と大跳ね', fixed='なし（記号のみ）',
    motion_family='エフェクト', spatial_path='斜め', tempo='medium',
    beat_pattern='大小2拍', loop_return='通常復帰',
    h_anchor='曲線本体の中心', travel=True, exitable=False,
    composition='記号', deform='なし', intensity=3,
    first_frame='曲線と点がそろって？が完成している状態',
    peak_frame='曲線が描き上がったあと、点だけが17px大きく跳ねて所定位置に収まる',
    hook='別々に組み上がる曲線と大きく跳ねる点')


# -------------------------------------------------------------- 38 sparkles
def fx38(c, p, i):
    R = 50.0
    for k, (ang, off, sz) in enumerate(((-56.0, 0.00, 19.0), (150.0, 0.30, 15.0),
                                        (52.0, 0.62, 12.0))):
        u = cyc(i, off)
        s = math.cos(2 * math.pi * u)
        a = math.radians(ang)
        sc = 0.52 + 0.48 * abs(s)
        F.sparkle(c, 90 + R * s * math.cos(a), 90 + R * s * math.sin(a),
                  sz * sc, rot=20 * k + 120 * u)


add(n=38, group='symbol', ja='キラキラ', en='Sparkles',
    intent='ほめる／かわいい／うれしい強調',
    poses=None, stops=None, eases=None,
    beat=[3, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 3],
    fx=fx38,
    moving='星3つの飛来・中央交差・反対側への拡散', fixed='なし（記号のみ）',
    motion_family='エフェクト', spatial_path='直線交差', tempo='medium',
    beat_pattern='連続', loop_return='退出再登場',
    h_anchor='中央（交差点）', travel=True, exitable=False,
    composition='記号', deform='なし', intensity=3,
    first_frame='大きさの違う星3つが三方向に散った完成状態',
    peak_frame='3つの星が中央で交差して最小になり、そのまま反対方向へ抜けて再び開く',
    hook='3方向から交差して抜ける3つの星')


# ----------------------------------------------------------------- 39 flame
def fx39(c, p, i):
    hold = 1.0 - _e(ph(i, 0, 5), 'inout')          # collapse to an ember
    side = max(hold, _e(ph(i, 6, 11), 'out'))       # side tongues open
    core = max(hold, _e(ph(i, 8, 14), 'out3'))      # centre column rises
    fl = math.sin(i * 0.92)
    fall = 0.10 * ph(i, 15, 19)
    F.flame(c, 58 - 5 * side, 140 - 30 * side + 8 * fall,
            14 + 17 * side, 21 + 34 * side, wob=-0.5 + 0.22 * fl)
    F.flame(c, 122 + 5 * side, 142 - 28 * side + 8 * fall,
            13 + 16 * side, 19 + 32 * side, wob=0.5 - 0.22 * fl)
    F.flame(c, 90, 132 - 56 * core + 10 * fall,
            23 + 25 * core, 36 + 60 * core, wob=0.14 * fl)
    hop = bump(i, 3, 8)
    if hop > 0.05 and core < 0.30:
        F.sparkle(c, 90, 152 - 30 * hop, 7.5 + 3.0 * hop)


add(n=39, group='symbol', ja='炎・熱い', en='Fired up',
    intent='気合い／盛り上がり／応援',
    poses=None, stops=None, eases=None,
    beat=[4, 3, 3, 3, 3, 3, 3, 3, 3, 4, 6, 6, 4, 3, 3, 3, 3, 3, 3, 3],
    fx=fx39,
    moving='火種の跳ね・左右の炎の開き・中央炎の立ち上がり', fixed='なし（記号のみ）',
    motion_family='エフェクト', spatial_path='縦（3段）', tempo='medium',
    beat_pattern='3段階', loop_return='反動',
    h_anchor='炎の根元中央', travel=False, exitable=False,
    composition='記号', deform='炎のゆらぎ', intensity=4,
    first_frame='中央の炎が立ち、左右の炎も開いた3本構成の完成状態',
    peak_frame='火種が跳ねたあと左右の炎が開き、遅れて中央炎が56px立ち上がって最大になる',
    hook='3段階で立ち上がる3本の炎')


# ------------------------------------------------------------------- 40 zzz
def fx40(c, p, i):
    for k in range(3):
        u = cyc(i, 0.06 + k / 3.0)
        push = 1.0 - math.exp(-3.0 * u)
        t = taper(u, 0.22)
        if t < 0.03:
            continue
        F.g_z(c, 52 + 84 * push + 4 * k, 142 - 100 * push - 3 * k,
              (0.82 + 1.15 * u) * t, (4.0 + 2.2 * u) * t)


add(n=40, group='symbol', ja='zzz', en='zzz',
    intent='寝る／おやすみ／退屈',
    poses=None, stops=None, eases=None,
    beat=[4, 3, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3],
    fx=fx40,
    moving='z3つの押し出し・斜め上への移動・拡大', fixed='なし（記号のみ）',
    motion_family='エフェクト', spatial_path='斜め上（3本）', tempo='slow',
    beat_pattern='呼吸', loop_return='退出再登場',
    h_anchor='なし（画面外へ退出）', travel=True, exitable=True,
    composition='記号', deform='なし', intensity=2,
    first_frame='大きさの違うzが3つ、斜めのラインに連なった完成状態',
    peak_frame='先頭のzが最大サイズで右上へ抜け、後続のzが前のzの位置を押し出して引き継ぐ',
    hook='押し出されながら斜めに連なる3つのz')
