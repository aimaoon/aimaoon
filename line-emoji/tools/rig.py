"""Parametric rig for the series character "Megane no Ko" (お眼鏡の女子).

Bust-up edition.  LINE emoji are read at 24-32 px, so the character is framed
head-and-shoulders: the face fills the top half of the canvas, the line is
thin and warm, and the whole set is monochrome except for the occasional
solid-black top that gives the sheet its rhythm.

Stage units are 180x180.  Anchors used by the animation layer:
    head centre (90, 66)   neck (90, 104)   chest pivot (90, 150)
    shoulders (58, 124) / (122, 124)
"""
import math
from vec import (Ctx, IDENT, compose, trans, rot_about, scale_about, apply,
                 bez, chain, ellipse_pts, arc_pts, capsule, rounded_rect,
                 tapered, SS)

# ------------------------------------------------------------------ palette
INK = (38, 35, 42, 255)         # #26232A  the single drawing colour
PAPER = (255, 255, 255, 255)    # everything is white with a line on it
ACCENT = INK                    # the set is monochrome; kept for the fx layer
LENS = PAPER
WHITE = PAPER
SKIN = PAPER
GLOSS = (38, 35, 42, 22)

LW = 2.0                        # the single warm thin line
GW = 2.0                        # glasses frame
BORDER_PX = 2.2                 # white rim so the ink reads on dark chats

# ---------------------------------------------------------------- skeleton
HEAD_C = (90.0, 62.0)
HEAD_RX, HEAD_RY = 27.5, 30.5   # face oval
NECK_L = (0.0, 46.0)            # neck point in head-local space
SHOULDER = ((60.0, 130.0), (120.0, 130.0))
HIP = (90.0, 158.0)             # chest pivot for leaning
HIP_PT = ((78.0, 158.0), (102.0, 158.0))
FOOT_Y = 174.0                  # bottom of the garment
ARM_L1, ARM_L2, HAND_R, ARM_W = 33.0, 29.0, 7.6, 6.6
LEG_LEN, LEG_W = 0.0, 0.0       # bust-up: no legs
WAIST_Y, SKIRT_HEM_Y = 130.0, 174.0

FACE_RX, FACE_RY, FACE_CY = HEAD_RX, HEAD_RY, 2.0
LENS_DX, LENS_CY, LENS_R = 11.5, 5.0, 9.6
BROW_Y = -9.0
MOUTH_Y = 19.0


def P(**kw):
    """Build a pose, filling in the rest-pose defaults."""
    p = dict(
        root=(0.0, 0.0), sx=1.0, sy=1.0, lean=0.0, hip_dy=0.0,
        head_rot=0.0, head_off=(0.0, 0.0),
        armL=(-18.0, -14.0), armR=(18.0, 14.0),
        handL='round', handR='round', armL_z='back', armR_z='back',
        handL_ang=None, handR_ang=None, handL_s=1.0, handR_s=1.0,
        armL_t=None, armR_t=None, armL_elbow=-1, armR_elbow=-1,
        dress_flare=1.0, shoulder_dy=0.0, top='white',
        legL=0.0, legR=0.0, footL=None, footR=None,
        face=None, glasses_off=(0.0, 0.0), glasses_rot=0.0,
        hide=(),
    )
    p.update(kw)
    f = dict(eye='dot', eyeL=None, eyeR=None, eye_off=(0.0, 0.0),
             brow='neutral', mouth='smile', cheek=2, mouth_off=(0.0, 0.0))
    if p['face']:
        f.update(p['face'])
    p['face'] = f
    return p


# =========================================================== part geometry

def hair_outer_shape():
    """A soft full bob.  The silhouette is deliberately a little uneven --
    perfect arcs are what made the earlier pass look mechanical."""
    return chain(
        bez((-43.0, 8.0), (-46.0, -18.0), (-33.0, -46.0), (-6.0, -48.0)),
        bez((-6.0, -48.0), (21.0, -50.0), (44.5, -27.0), (43.0, 4.0)),
        bez((43.0, 4.0), (45.0, 20.0), (43.0, 36.0), (38.0, 49.0)),
        bez((38.0, 49.0), (32.5, 45.0), (29.0, 36.0), (27.0, 25.0)),
        bez((27.0, 25.0), (25.0, 39.0), (16.0, 48.0), (1.0, 48.5)),
        bez((1.0, 48.5), (-14.0, 48.0), (-23.0, 39.0), (-25.5, 25.0)),
        bez((-25.5, 25.0), (-27.5, 36.0), (-31.0, 45.0), (-37.0, 48.0)),
        bez((-37.0, 48.0), (-41.5, 35.0), (-43.5, 21.0), (-43.0, 8.0)),
    )


def face_shape():
    return ellipse_pts(0.0, FACE_CY, FACE_RX, FACE_RY, 72)


def jaw_path():
    """Only the jaw shows; the hair covers the rest of the face outline."""
    return chain(
        bez((-24.0, 6.0), (-25.0, 18.0), (-16.5, 30.0), (0.0, 31.6)),
        bez((0.0, 31.6), (16.5, 30.0), (25.0, 18.0), (24.0, 6.0)),
    )


def hairline_path():
    """A rounded fringe with the parting a little right of centre."""
    return chain(
        bez((-38.6, 0.0), (-38.0, -14.0), (-29.0, -22.0), (-17.0, -24.0)),
        bez((-17.0, -23.5), (-7.0, -25.5), (2.0, -21.0), (7.5, -15.0)),
        bez((7.5, -15.0), (14.0, -22.0), (24.0, -21.0), (31.0, -15.0)),
        bez((31.0, -15.0), (35.4, -11.0), (37.8, -6.0), (38.6, -0.5)),
    )


def fringe_shape():
    """Fill for the fringe; only `hairline_path` is stroked, so the temples
    have no seam."""
    return chain(
        bez((-43.0, 8.0), (-46.0, -18.0), (-33.0, -46.0), (-6.0, -48.0)),
        bez((-6.0, -48.0), (21.0, -50.0), (44.5, -27.0), (43.0, 4.0)),
        bez((43.0, 4.0), (41.0, 2.0), (39.6, 0.6), (38.6, -0.5)),
        bez((38.6, -0.5), (37.5, -6.0), (35.0, -11.0), (31.0, -15.0)),
        bez((31.0, -15.0), (24.0, -21.0), (14.0, -22.0), (7.5, -15.0)),
        bez((7.5, -15.0), (2.0, -21.0), (-7.0, -25.5), (-17.0, -23.5)),
        bez((-17.0, -23.5), (-29.0, -21.0), (-37.0, -13.0), (-38.6, 0.0)),
        bez((-38.6, 0.0), (-40.0, 1.0), (-41.6, 4.0), (-43.0, 8.0)),
    )


def strand_paths():
    """A few soft strokes that follow the parting, not radiating spokes."""
    return [
        chain(bez((6.0, -18.0), (0.0, -28.0), (-10.0, -34.0), (-21.0, -34.0))),
        chain(bez((5.0, -17.0), (-2.0, -24.0), (-11.0, -27.0), (-20.0, -26.5))),
        chain(bez((9.0, -18.0), (16.0, -28.0), (25.0, -31.0), (33.0, -27.0))),
        chain(bez((-36.0, 15.0), (-37.5, 26.0), (-36.5, 36.0), (-34.0, 44.0))),
        chain(bez((36.0, 13.0), (37.5, 24.0), (36.5, 34.0), (34.0, 43.0))),
    ]


def top_shape(flare=1.0):
    """A soft sweater with sloping shoulders, cut off inside the frame."""
    f = flare
    return chain(
        bez((-19.0, 112.0), (-31.0 * f, 118.0), (-40.0 * f, 136.0), (-42.0 * f, 175.0)),
        bez((-42.0 * f, 175.0), (-18.0, 178.0), (18.0, 178.0), (42.0 * f, 175.0)),
        bez((42.0 * f, 175.0), (40.0 * f, 136.0), (31.0 * f, 118.0), (19.0, 112.0)),
        bez((19.0, 112.0), (10.0, 107.0), (-10.0, 107.0), (-19.0, 112.0)),
    )


def collar_path():
    return chain(bez((-11.5, 109.0), (-7.5, 119.0), (7.5, 119.0), (11.5, 109.0)))


def skirt_shape(flare=1.0):
    return top_shape(flare)


# ============================================================ part painters

def paint_head(c, pose, parts):
    f = pose['face']
    if 'hair_back' in parts:
        c.poly(hair_outer_shape(), fill=PAPER, stroke=INK, w=LW)
    if 'face' in parts:
        c.poly(face_shape(), fill=PAPER)
        c.line(jaw_path(), INK, LW)
    if 'hair_front' in parts:
        c.poly(fringe_shape(), fill=PAPER)
        c.line(hairline_path(), INK, LW)
        for s in strand_paths():
            c.line(s, INK, LW * 0.66)
    if 'glasses' in parts:
        paint_glasses(c, pose)
    if 'face_parts' in parts:
        paint_eyes(c, f)
        paint_brows(c, f)
        paint_mouth(c, f)
        paint_cheeks(c, f)


def paint_glasses(c, pose):
    gx, gy = pose['glasses_off']
    prev = c.push(compose(trans(gx, gy), rot_about(pose['glasses_rot'], 0, LENS_CY)))
    for s in (-1, 1):
        c.poly(ellipse_pts(s * LENS_DX, LENS_CY, LENS_R, LENS_R * 0.95, 48),
               fill=LENS, stroke=INK, w=GW)
    c.line([(-LENS_DX + LENS_R - 1.0, LENS_CY - 2.0),
            (LENS_DX - LENS_R + 1.0, LENS_CY - 2.0)], INK, GW * 0.9)
    for s in (-1, 1):
        c.line([(s * (LENS_DX + LENS_R - 1.0), LENS_CY - 2.0),
                (s * 26.0, LENS_CY - 4.0)], INK, GW * 0.9)
    c.pop(prev)


def _eye(c, cx, cy, style):
    if style == 'dot':
        c.poly(ellipse_pts(cx, cy, 2.5, 3.1, 24), fill=INK)
    elif style == 'big':
        c.poly(ellipse_pts(cx, cy, 3.2, 4.0, 26), fill=INK)
    elif style == 'happy':                       # the set's default smile-eye
        c.line(arc_pts(cx, cy + 1.8, 4.2, 3.6, 198, 342, 18), INK, 2.0)
    elif style == 'closed':
        c.line(arc_pts(cx, cy - 1.2, 4.0, 2.6, 18, 162, 16), INK, 2.0)
    elif style == 'sleepy':
        c.line(arc_pts(cx, cy - 0.6, 4.2, 1.7, 14, 166, 16), INK, 2.0)
    elif style == 'squeeze':
        c.line([(cx - 3.4, cy - 2.8), (cx, cy), (cx - 3.4, cy + 2.8)], INK, 1.9)
        c.line([(cx + 3.4, cy - 2.8), (cx, cy), (cx + 3.4, cy + 2.8)], INK, 1.9)
    elif style == 'sad':
        c.poly(ellipse_pts(cx, cy + 1.0, 2.4, 3.0, 22), fill=INK)
        c.line(arc_pts(cx, cy + 0.2, 3.8, 3.4, 202, 338, 14), INK, 1.8)
    elif style == 'sparkle':
        c.poly(ellipse_pts(cx, cy, 3.2, 4.0, 26), fill=INK)
        c.dot((cx - 1.0, cy - 1.2), 1.2, PAPER)
    elif style == 'x':
        c.line([(cx - 3.0, cy - 3.0), (cx + 3.0, cy + 3.0)], INK, 1.9)
        c.line([(cx + 3.0, cy - 3.0), (cx - 3.0, cy + 3.0)], INK, 1.9)
    elif style == 'swirl':
        pts = []
        for i in range(28):
            t = i / 27.0
            a = t * math.pi * 3.0
            rr = 0.5 + t * 3.2
            pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
        c.line(pts, INK, 1.6)
    elif style == 'flat':
        c.line([(cx - 3.2, cy), (cx + 3.2, cy)], INK, 2.0)
    elif style == 'small':
        c.dot((cx, cy), 1.8, INK)


def paint_eyes(c, f):
    ox, oy = f['eye_off']
    _eye(c, -LENS_DX + ox, LENS_CY + oy, f['eyeL'] or f['eye'])
    _eye(c, LENS_DX + ox, LENS_CY + oy, f['eyeR'] or f['eye'])


def paint_brows(c, f):
    st = f['brow']
    if st in ('none', 'neutral'):
        return
    tilt = {'up': -15.0, 'angry': 20.0, 'sad': -20.0, 'flat': 0.0,
            'worry': -9.0}.get(st, 0.0)
    for s in (-1, 1):
        x0, x1 = s * 6.5, s * 17.0
        dy = math.tan(math.radians(tilt)) * 5.2
        c.line([(x0, BROW_Y + dy), (x1, BROW_Y - dy)], INK, 1.8)


def paint_mouth(c, f):
    st = f['mouth']
    mx, my = f['mouth_off']
    x, y = mx, MOUTH_Y + my
    if st == 'smile':
        c.line(arc_pts(x, y - 2.2, 3.6, 3.0, 30, 150, 14), INK, 1.8)
    elif st == 'grin':
        c.line(arc_pts(x, y - 3.0, 5.0, 4.4, 26, 154, 16), INK, 1.9)
    elif st == 'w':
        c.line(arc_pts(x - 2.6, y - 1.8, 2.6, 2.3, 25, 155, 10), INK, 1.7)
        c.line(arc_pts(x + 2.6, y - 1.8, 2.6, 2.3, 25, 155, 10), INK, 1.7)
    elif st == 'o':
        c.poly(ellipse_pts(x, y, 2.3, 2.7, 24), fill=INK)
    elif st == 'open':
        c.poly(chain(bez((-5.0, -1.6), (-3.2, -4.4), (3.2, -4.4), (5.0, -1.6)),
                     bez((5.0, -1.6), (4.0, 5.4), (-4.0, 5.4), (-5.0, -1.6))),
               fill=INK) if False else c.poly(
            [(x + a, y + b) for a, b in
             chain(bez((-5.0, -1.6), (-3.2, -4.6), (3.2, -4.6), (5.0, -1.6)),
                   bez((5.0, -1.6), (4.2, 5.6), (-4.2, 5.6), (-5.0, -1.6)))],
            fill=INK)
    elif st == 'shout':
        c.poly([(x + a, y + b) for a, b in
                chain(bez((-7.0, -2.2), (-4.6, -6.2), (4.6, -6.2), (7.0, -2.2)),
                      bez((7.0, -2.2), (5.6, 8.0), (-5.6, 8.0), (-7.0, -2.2)))],
               fill=INK)
    elif st == 'flat':
        c.line([(x - 3.6, y), (x + 3.6, y)], INK, 1.8)
    elif st == 'frown':
        c.line(arc_pts(x, y + 2.8, 4.0, 3.4, 210, 330, 14), INK, 1.9)
    elif st == 'wave':
        c.line(chain(bez((x - 5.2, y), (x - 3.0, y - 3.2), (x - 1.0, y + 2.2), (x, y - 0.4)),
                     bez((x, y - 0.4), (x + 1.2, y - 2.8), (x + 3.2, y + 2.6), (x + 5.2, y - 0.4))),
               INK, 1.7)
    elif st == 'pout':
        c.line(arc_pts(x, y + 2.2, 2.8, 2.4, 200, 340, 12), INK, 1.9)


def paint_cheeks(c, f):
    n = f['cheek']
    if not n:
        return
    for s in (-1, 1):
        for k in range(min(n, 3)):
            c.line([(s * (19.5 + k * 3.6) - 1.2, 15.5), (s * (19.5 + k * 3.6) + 1.2, 11.5)],
                   INK, 1.5)


# ------------------------------------------------------------------- limbs

def _hand(c, wrist, ang, style, hs=1.0):
    hc = (wrist[0] + HAND_R * hs * math.sin(math.radians(ang)),
          wrist[1] + HAND_R * hs * math.cos(math.radians(ang)))
    prev = c.push(compose(compose(trans(*hc), rot_about(-ang, 0, 0)),
                          scale_about(hs, hs, 0, 0)))
    if style == 'thumb':
        c.poly(capsule((0.0, -1.0), (0.0, -9.6), 2.8), fill=PAPER, stroke=INK, w=LW)
        c.poly(rounded_rect(0, 1.6, 11.2, 11.0, 4.6), fill=PAPER, stroke=INK, w=LW)
    elif style == 'point':
        c.poly(capsule((0.0, -1.2), (0.0, -12.0), 2.6), fill=PAPER, stroke=INK, w=LW)
        c.poly(rounded_rect(0, 2.0, 10.8, 10.4, 4.4), fill=PAPER, stroke=INK, w=LW)
    elif style == 'fist':
        c.poly(rounded_rect(0, 0, 11.4, 10.8, 4.6), fill=PAPER, stroke=INK, w=LW)
        c.line([(-3.4, 1.4), (3.4, 1.4)], INK, 1.4)
    elif style == 'open':
        c.poly(chain(bez((-6.2, 3.4), (-7.4, -3.0), (-5.0, -8.0), (-2.6, -9.6)),
                     bez((-2.6, -9.6), (0.0, -11.0), (3.4, -10.0), (5.2, -7.0)),
                     bez((5.2, -7.0), (7.2, -3.4), (7.0, 2.0), (5.2, 5.2)),
                     bez((5.2, 5.2), (2.0, 7.4), (-3.6, 6.6), (-6.2, 3.4))),
               fill=PAPER, stroke=INK, w=LW)
        for k in (-1, 0, 1):
            c.line([(k * 2.9, -8.4 + abs(k) * 1.6), (k * 3.3, -3.0 + abs(k) * 0.8)],
                   INK, 1.5)
    else:
        c.poly(ellipse_pts(0, 0, 6.0, 6.6, 36), fill=PAPER, stroke=INK, w=LW)
    c.pop(prev)


def ik(side, hand_xy, elbow=0, shoulder_dy=0.0):
    """Solve (a1, a2) so the hand centre lands on `hand_xy`."""
    s = (SHOULDER[side][0], SHOULDER[side][1] + shoulder_dy)
    l1, l2 = ARM_L1, ARM_L2 + HAND_R
    dx, dy = hand_xy[0] - s[0], hand_xy[1] - s[1]
    d = math.hypot(dx, dy)
    d = min(max(d, abs(l1 - l2) + 14.0), l1 + l2 - 0.8)
    th = math.degrees(math.atan2(dx, dy))
    al = math.degrees(math.acos(max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))))
    be = math.degrees(math.acos(max(-1.0, min(1.0, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)))))
    if elbow == 0:
        best, bx = 1, None
        for e in (1, -1):
            ex = s[0] + l1 * math.sin(math.radians(th + e * al))
            out = (ex - 90.0) if side == 1 else (90.0 - ex)
            if bx is None or out > bx:
                best, bx = e, out
        elbow = best
    return (th + elbow * al, -elbow * (180.0 - be))


def arm_angles(pose, side):
    t = pose['armL_t'] if side == 0 else pose['armR_t']
    if t is None:
        return pose['armL'] if side == 0 else pose['armR']
    e = pose['armL_elbow'] if side == 0 else pose['armR_elbow']
    return ik(side, t, elbow=e, shoulder_dy=pose['shoulder_dy'])


def arm_points(side, angles, shoulder_dy=0.0):
    a1, a2 = angles
    s = (SHOULDER[side][0], SHOULDER[side][1] + shoulder_dy)
    e = (s[0] + ARM_L1 * math.sin(math.radians(a1)),
         s[1] + ARM_L1 * math.cos(math.radians(a1)))
    a = a1 + a2
    w = (e[0] + ARM_L2 * math.sin(math.radians(a)),
         e[1] + ARM_L2 * math.cos(math.radians(a)))
    return s, e, w, a


def hand_target_local(pose, side):
    angles = arm_angles(pose, side)
    s, e, w, a = arm_points(side, angles, pose['shoulder_dy'])
    return (w[0] + HAND_R * math.sin(math.radians(a)),
            w[1] + HAND_R * math.cos(math.radians(a)))


def paint_arm(c, pose, side):
    angles = arm_angles(pose, side)
    hand = pose['handL'] if side == 0 else pose['handR']
    hang = pose['handL_ang'] if side == 0 else pose['handR_ang']
    hs = pose['handL_s'] if side == 0 else pose['handR_s']
    s, e, w, a = arm_points(side, angles, pose['shoulder_dy'])
    if hang is not None:
        a = hang
    fill = INK if pose['top'] == 'black' else PAPER
    mid = ((s[0] + e[0]) / 2.0, (s[1] + e[1]) / 2.0)
    mid2 = ((e[0] + w[0]) / 2.0, (e[1] + w[1]) / 2.0)
    # the sleeve is the arm: one soft tapering shape from shoulder to cuff
    c.poly(tapered([s, mid, e, mid2, w],
                   [ARM_W + 3.0, ARM_W + 1.6, ARM_W, ARM_W - 1.4, ARM_W - 2.6]),
           fill=fill, stroke=INK, w=LW)
    _hand(c, w, a, hand, hs)


def paint_legs(c, pose):
    return                                   # bust-up: nothing below the frame


def paint_torso(c, pose):
    fill = INK if pose['top'] == 'black' else PAPER
    c.poly([(90 + x, y) for x, y in
            chain(bez((-7.0, 92.0), (-7.4, 100.0), (-9.0, 106.0), (-11.5, 110.0)),
                  bez((-11.5, 110.0), (-4.0, 112.0), (4.0, 112.0), (11.5, 110.0)),
                  bez((11.5, 110.0), (9.0, 106.0), (7.4, 100.0), (7.0, 92.0)))],
           fill=PAPER, stroke=INK, w=LW)
    c.poly([(90 + x, y) for x, y in top_shape(pose['dress_flare'])],
           fill=fill, stroke=INK, w=LW)
    c.line([(90 + x, y) for x, y in collar_path()],
           PAPER if pose['top'] == 'black' else INK, LW)


# ========================================================= frame assembly

FIXED_SET = {'hair_back', 'face', 'hair_front', 'glasses', 'face_parts',
             'torso', 'legs', 'armL', 'armR'}


def matrices(pose):
    """(body, upper, head) group transforms for this pose."""
    body = compose(trans(*pose['root']), scale_about(pose['sx'], pose['sy'], 90, FOOT_Y))
    hipw = (HIP[0], HIP[1] + pose['hip_dy'])
    upper = compose(compose(body, trans(0.0, pose['hip_dy'])), rot_about(pose['lean'], *hipw))
    head_m = compose(upper, compose(trans(HEAD_C[0] + pose['head_off'][0],
                                          HEAD_C[1] + pose['head_off'][1]),
                                    rot_about(pose['head_rot'], *NECK_L)))
    return body, upper, head_m


def hand_world(pose, side):
    angles = arm_angles(pose, side)
    hang = pose['handL_ang'] if side == 0 else pose['handR_ang']
    hs = pose['handL_s'] if side == 0 else pose['handR_s']
    s, e, w, a = arm_points(side, angles, pose['shoulder_dy'])
    if hang is not None:
        a = hang
    hc = (w[0] + HAND_R * hs * math.sin(math.radians(a)),
          w[1] + HAND_R * hs * math.cos(math.radians(a)))
    _, upper, _ = matrices(pose)
    return apply(upper, hc), a


def paint(c, pose, parts=FIXED_SET):
    body, upper, head_m = matrices(pose)
    hide = set(pose['hide'])
    back = [k for k in ('armL', 'armR') if pose[k + '_z'] == 'back']
    front = [k for k in ('armL', 'armR') if k not in back]
    for k in back:
        if k in parts and k not in hide:
            p = c.push(upper); paint_arm(c, pose, 0 if k == 'armL' else 1); c.pop(p)
    if 'torso' in parts and 'torso' not in hide:
        p = c.push(upper); paint_torso(c, pose); c.pop(p)
    hp = [k for k in ('hair_back', 'face', 'hair_front', 'glasses', 'face_parts')
          if k in parts and k not in hide]
    if hp:
        p = c.push(head_m); paint_head(c, pose, set(hp)); c.pop(p)
    for k in front:
        if k in parts and k not in hide:
            p = c.push(upper); paint_arm(c, pose, 0 if k == 'armL' else 1); c.pop(p)
