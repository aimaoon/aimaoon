"""Props, effects and symbol glyphs.

Everything here obeys `symbol_style_lock`: apricot-milk fill, violet-ink
outline at LW, white die-cut rim, rounded corners, one light source from the
upper left -- so the eight character-free emoji read as the same product as
the thirty-two character ones.
"""
import math
from vec import (bez, chain, ellipse_pts, arc_pts, capsule, rounded_rect,
                 star_pts, heart_pts, drop_pts, trans, rot_about, compose,
                 scale_about)
from rig import INK, SKIN, LENS, WHITE, LW, BORDER_PX

GLYPH_W = 5.4          # ink-weight of a symbol stroke core


def _fill(c, pts, fill=SKIN, w=LW, closed=True):
    c.poly(pts, fill=fill, stroke=INK, w=w, closed=closed)


# ------------------------------------------------------------- soft objects

def heart(c, cx, cy, s, rot=0.0, fill=SKIN):
    _fill(c, heart_pts(cx, cy, s, rot), fill)


def drop(c, cx, cy, w, h, rot=0.0, fill=LENS):
    """Water: tear or sweat.  Near-white so it never reads as skin."""
    _fill(c, drop_pts(cx, cy, w, h, rot), fill)


def sparkle(c, cx, cy, r, rot=0.0, fill=SKIN):
    _fill(c, star_pts(cx, cy, r, r * 0.30, 4, rot, pinch=0.62), fill)


def star5(c, cx, cy, r, rot=-90.0, fill=SKIN):
    _fill(c, star_pts(cx, cy, r, r * 0.47, 5, rot), fill)


def anger(c, cx, cy, s, rot=0.0):
    """The four-stroke irritation mark."""
    prev = c.push(compose(trans(cx, cy), rot_about(rot, 0, 0)))
    for a, b in (((-s, -s * 0.42), (s * 0.62, -s * 0.42)),
                 ((-s * 0.62, s * 0.42), (s, s * 0.42)),
                 ((-s * 0.42, -s), (-s * 0.42, s * 0.62)),
                 ((s * 0.42, -s * 0.62), (s * 0.42, s))):
        c.line([a, b], INK, s * 0.36)
    c.pop(prev)


def flame(c, cx, cy, w, h, wob=0.0, fill=SKIN):
    """Single tongue of flame: pinched waist, licking tip, `wob` bends it."""
    t = (w * 0.30) * wob
    pts = chain(
        bez((t, -h / 2), (w * 0.30 + t, -h * 0.26), (w * 0.10, -h * 0.20), (w * 0.26, -h * 0.04)),
        bez((w * 0.26, -h * 0.04), (w * 0.52, h * 0.14), (w * 0.44, h * 0.44), (0, h / 2)),
        bez((0, h / 2), (-w * 0.44, h * 0.44), (-w * 0.52, h * 0.14), (-w * 0.26, -h * 0.04)),
        bez((-w * 0.26, -h * 0.04), (-w * 0.10, -h * 0.20), (-w * 0.30 + t, -h * 0.26), (t, -h / 2)),
    )
    _fill(c, [(cx + x, cy + y) for x, y in pts], fill)


def puff(c, cx, cy, r, fill=WHITE):
    """Little cloud puff used for steam and dust."""
    _fill(c, ellipse_pts(cx, cy, r, r * 0.82, 40), fill)


def note(c, cx, cy, s, rot=0.0, fill=SKIN):
    prev = c.push(compose(trans(cx, cy), rot_about(rot, 0, 0)))
    c.poly(ellipse_pts(-s * 0.34, s * 0.62, s * 0.46, s * 0.36, 32, rot=-22),
           fill=fill, stroke=INK, w=LW)
    c.poly(capsule((s * 0.10, s * 0.58), (s * 0.10, -s * 0.86), s * 0.15),
           fill=fill, stroke=INK, w=LW)
    c.poly(capsule((s * 0.10, -s * 0.80), (s * 0.62, -s * 0.56), s * 0.17),
           fill=fill, stroke=INK, w=LW)
    c.pop(prev)


def line_burst(c, cx, cy, r0, r1, n=8, rot=0.0, w=2.0, color=INK):
    for k in range(n):
        a = math.radians(rot + k * 360.0 / n)
        c.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)),
                (cx + r1 * math.cos(a), cy + r1 * math.sin(a))], color, w)


def speed_lines(c, x0, y, n=3, ln=14, gap=6, w=2.2, color=INK):
    for k in range(n):
        yy = y + (k - (n - 1) / 2.0) * gap
        c.line([(x0, yy), (x0 - ln * (1.0 - 0.18 * abs(k - (n - 1) / 2.0)), yy)], color, w)


# ------------------------------------------------------------------- props

def _obj(c, cx, cy, s, rot=0.0):
    return c.push(compose(compose(trans(cx, cy), rot_about(rot, 0, 0)),
                          scale_about(s, s, 0, 0)))


def mug(c, cx, cy, s=1.0, rot=0.0):
    prev = _obj(c, cx, cy, s, rot)
    c.line(arc_pts(6.6, -0.4, 4.8, 4.8, -80, 80, 18), INK, 2.4)
    c.poly(chain(bez((-7.4, -7.0), (-7.0, -1.0), (-6.2, 5.0), (-5.2, 8.2)),
                 bez((-5.2, 8.2), (-2.0, 9.6), (2.0, 9.6), (5.2, 8.2)),
                 bez((5.2, 8.2), (6.2, 5.0), (7.0, -1.0), (7.4, -7.0)),
                 bez((7.4, -7.0), (2.5, -8.4), (-2.5, -8.4), (-7.4, -7.0))),
           fill=WHITE, stroke=INK, w=LW)
    c.pop(prev)


def bag(c, cx, cy, s=1.0, rot=0.0):
    prev = _obj(c, cx, cy, s, rot)
    c.line(arc_pts(0, -6.4, 5.6, 5.6, 192, 348, 18), INK, 2.2)
    c.poly(rounded_rect(0, 1.8, 20.0, 15.0, 3.4), fill=SKIN, stroke=INK, w=LW)
    c.line([(-9.2, 1.8), (9.2, 1.8)], INK, 1.5)
    c.pop(prev)


def thermometer(c, cx, cy, s=1.0, rot=0.0):
    prev = _obj(c, cx, cy, s, rot)
    c.poly(capsule((0, -9.0), (0, 6.0), 2.8), fill=WHITE, stroke=INK, w=LW)
    c.poly(ellipse_pts(0, 8.2, 4.4, 4.4, 30), fill=SKIN, stroke=INK, w=LW)
    c.pop(prev)


def pillow(c, cx, cy, s=1.0, rot=0.0, fill=WHITE):
    prev = _obj(c, cx, cy, s, rot)
    c.poly(rounded_rect(0, 0, 40.0, 21.0, 8.5), fill=fill, stroke=INK, w=LW)
    c.line([(-12.0, -4.4), (-6.5, -6.6)], INK, 1.5)
    c.pop(prev)


def laptop(c, cx, cy, s=1.0, glow=0.0):
    prev = _obj(c, cx, cy, s, 0.0)
    p = c.push(rot_about(-16.0, 0, 2.0))
    c.poly(rounded_rect(0, -8.6, 27.0, 19.0, 2.6),
           fill=(WHITE if glow > 0.5 else LENS), stroke=INK, w=LW)
    if glow > 0.5:
        c.line([(-9.0, -12.0), (5.0, -12.0)], INK, 1.4)
        c.line([(-9.0, -7.6), (2.0, -7.6)], INK, 1.4)
    c.pop(p)
    c.poly(rounded_rect(0, 3.4, 33.0, 5.2, 2.2), fill=WHITE, stroke=INK, w=LW)
    c.pop(prev)


def bulb(c, cx, cy, s=1.0, on=1.0):
    prev = _obj(c, cx, cy, s, 0.0)
    c.poly(rounded_rect(0, 7.6, 8.2, 5.6, 1.9), fill=WHITE, stroke=INK, w=LW)
    c.poly(ellipse_pts(0, -2.0, 8.2, 8.8, 40),
           fill=(SKIN if on > 0.5 else WHITE), stroke=INK, w=LW)
    c.pop(prev)


def gift_box(c, cx, cy, s=1.0, lid_dy=0.0, lid_rot=0.0):
    prev = _obj(c, cx, cy, s, 0.0)
    c.poly(rounded_rect(0, 7.0, 28.0, 19.0, 3.2), fill=WHITE, stroke=INK, w=LW)
    c.line([(0, -1.4), (0, 16.0)], INK, 2.2)
    p = c.push(compose(trans(0, lid_dy), rot_about(lid_rot, -2.0, -3.6)))
    c.poly(rounded_rect(0, -3.6, 32.0, 8.6, 2.6), fill=SKIN, stroke=INK, w=LW)
    c.pop(p)
    c.pop(prev)


# ------------------------------------------------------------------ glyphs

def glyph(c, pts, w=GLYPH_W, closed=False):
    """Outlined symbol stroke: white rim, ink edge, apricot core."""
    if c.border:
        c.line(pts, WHITE, w + 2 * LW + 2 * BORDER_PX, closed=closed)
        return
    c.line(pts, INK, w + 2 * LW, closed=closed)
    c.line(pts, SKIN, w, closed=closed)


def g_O(c, cx, cy, s=1.0, w=GLYPH_W):
    glyph(c, [(cx + x * s, cy + y * s) for x, y in ellipse_pts(0, 0, 7.6, 9.8, 40)],
          w * s, closed=True)


def g_K(c, cx, cy, s=1.0, w=GLYPH_W):
    glyph(c, [(cx + x * s, cy + y * s) for x, y in [(-6.2, -10.0), (-6.2, 10.0)]], w * s)
    glyph(c, [(cx + x * s, cy + y * s) for x, y in [(6.4, -10.2), (-5.6, 0.4)]], w * s)
    glyph(c, [(cx + x * s, cy + y * s) for x, y in [(-5.6, 0.0), (6.8, 10.2)]], w * s)


def g_excl(c, cx, cy, s=1.0, w=GLYPH_W, split=0.0):
    glyph(c, [(cx + x * s, cy + y * s) for x, y in [(0, -11.0), (0, 3.4)]], w * s)
    d = split * s
    glyph(c, [(cx, cy + (9.6 + d) * s), (cx, cy + (9.9 + d) * s)], w * s)


def g_quest(c, cx, cy, s=1.0, w=GLYPH_W, dot_dy=0.0):
    body = chain(bez((-6.6, -5.2), (-6.2, -12.4), (6.8, -12.6), (6.4, -5.0)),
                 bez((6.4, -5.0), (6.0, -0.4), (0.4, 0.2), (0.2, 4.2)))
    glyph(c, [(cx + x * s, cy + y * s) for x, y in body], w * s)
    glyph(c, [(cx + 0.2 * s, cy + (10.4 + dot_dy) * s),
              (cx + 0.2 * s, cy + (10.7 + dot_dy) * s)], w * s)


def g_z(c, cx, cy, s=1.0, w=GLYPH_W):
    glyph(c, [(cx + x * s, cy + y * s) for x, y in [(-6.4, -7.0), (6.4, -7.0)]], w * s)
    glyph(c, [(cx + x * s, cy + y * s) for x, y in [(6.4, -7.0), (-6.4, 7.0)]], w * s)
    glyph(c, [(cx + x * s, cy + y * s) for x, y in [(-6.4, 7.0), (6.4, 7.0)]], w * s)
