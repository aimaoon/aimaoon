"""Parametric rig for the series character "Megane no Ko" (お眼鏡の女子).

The character is authored as an articulated set of vector parts, not as a
single flat picture.  Every pose is produced by re-drawing the parts at new
joint angles, so limbs really change their connection points, joint angles,
contact state and silhouette -- there is no warping of one finished image.

Stage units are 180x180.  Anchors used by the animation layer:
    feet   (90, 164)   hip (90, 143)   neck (90, 116)
    shoulders (70, 118) / (110, 118)   head centre (90, 74)
"""
import math
from vec import (Ctx, IDENT, compose, trans, rot_about, scale_about, apply,
                 bez, chain, ellipse_pts, arc_pts, capsule, rounded_rect, SS)

# ------------------------------------------------------------------ palette
INK = (62, 53, 80, 255)         # #3E3550  violet-ink : line, hair, frame, shoes
SKIN = (247, 205, 190, 255)     # #F7CDBE  apricot-milk : skin, effect fills
LENS = (255, 243, 236, 255)     # glass tint (reads as white)
WHITE = (255, 255, 255, 255)
GLOSS = (255, 255, 255, 40)     # single soft sticker highlight

LW = 1.7                        # standard thin outline
GW = 3.0                        # glasses frame (the series hook - heavier)
BORDER_PX = 2.6                 # die-cut white sticker rim

# ---------------------------------------------------------------- skeleton
HEAD_C = (90.0, 74.0)
NECK_L = (0.0, 34.0)            # neck point in head-local space
SHOULDER = ((69.0, 117.0), (111.0, 117.0))   # (character-left, character-right)
HIP = (90.0, 143.0)
HIP_PT = ((81.5, 143.0), (98.5, 143.0))
FOOT_Y = 164.0
ARM_L1, ARM_L2, HAND_R, ARM_W = 19.0, 17.0, 6.6, 5.0
LEG_LEN, LEG_W = 15.5, 4.4

FACE_RX, FACE_RY, FACE_CY = 33.0, 31.0, 4.0
LENS_DX, LENS_CY, LENS_R = 17.8, 8.0, 16.4
BROW_Y = -13.0
MOUTH_Y = 27.0


def P(**kw):
    """Build a pose, filling in the rest-pose defaults."""
    p = dict(
        root=(0.0, 0.0), sx=1.0, sy=1.0, lean=0.0, hip_dy=0.0,
        head_rot=0.0, head_off=(0.0, 0.0),
        armL=(-13.0, -9.0), armR=(13.0, 9.0),
        handL='round', handR='round', armL_z='front', armR_z='front',
        handL_ang=None, handR_ang=None, handL_s=1.0, handR_s=1.0,
        armL_t=None, armR_t=None, armL_elbow=-1, armR_elbow=-1,
        dress_flare=1.0, shoulder_dy=0.0,
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

def face_shape():
    return ellipse_pts(0, FACE_CY, FACE_RX, FACE_RY, 72)


def hair_back_shape():
    return chain(
        bez((-44, 4), (-44, -22), (-32, -46), (0, -46)),
        bez((0, -46), (32, -46), (44, -22), (44, 4)),
        bez((44, 4), (44, 22), (41, 33), (34, 39)),
        bez((34, 39), (20, 35), (-20, 35), (-34, 39)),
        bez((-34, 39), (-41, 33), (-44, 22), (-44, 4)),
    )


def hair_front_shape():
    return chain(
        bez((-44, 4), (-44, -22), (-32, -46), (0, -46)),
        bez((0, -46), (32, -46), (44, -22), (44, 4)),
        bez((44, 4), (43, 20), (39, 30), (33, 35)),
        bez((33, 35), (32, 18), (31, 0), (29, -13)),
        bez((29, -11), (21, -17), (11, -19), (1, -18)),
        bez((1, -18), (-9, -17), (-19, -22), (-29, -16)),
        bez((-29, -13), (-31, 0), (-32, 18), (-33, 35)),
        bez((-33, 35), (-39, 30), (-43, 20), (-44, 4)),
    )


def flick_shape():
    """The flipped-out tip on the character-left side of the bob (series hook)."""
    return chain(
        bez((-38, 16), (-46, 23), (-53, 31), (-45, 41)),
        bez((-45, 41), (-43, 32), (-37, 28), (-29, 28)),
        bez((-29, 28), (-32, 23), (-35, 19), (-38, 16)),
    )


def paint_clip(c):
    """White snap clip on the character-right fringe - the styling cue that
    separates this girl from a plain bob, and still reads at 32 px."""
    prev = c.push(rot_about(-16.0, 22.0, -24.0))
    c.poly(rounded_rect(22.0, -27.4, 15.0, 3.9, 1.9), fill=WHITE, stroke=INK, w=1.5)
    c.poly(rounded_rect(22.0, -21.6, 15.0, 3.9, 1.9), fill=WHITE, stroke=INK, w=1.5)
    c.pop(prev)


def dress_shape(flare=1.0):
    f = flare
    return chain(
        bez((-22, 113), (-26 * f, 124), (-30 * f, 136), (-34 * f, 148)),
        bez((-34 * f, 148), (-17 * f, 151.5), (17 * f, 151.5), (34 * f, 148)),
        bez((34 * f, 148), (30 * f, 136), (26 * f, 124), (22, 113)),
        bez((22, 113), (8, 108.5), (-8, 108.5), (-22, 113)),
    )


# ============================================================ part painters

def paint_head(c, pose, parts):
    f = pose['face']
    if 'hair_back' in parts:
        c.poly(hair_back_shape(), fill=INK, stroke=INK, w=LW)
    if 'face' in parts:
        c.poly(face_shape(), fill=SKIN, stroke=INK, w=LW)
    if 'hair_front' in parts:
        c.poly(hair_front_shape(), fill=INK, stroke=INK, w=LW)
        c.poly(flick_shape(), fill=INK, stroke=INK, w=LW)
        if not c.border:
            c.poly(chain(arc_pts(0, -2, 39.0, 37.0, 214, 250, 18),
                         arc_pts(0, -2, 32.5, 30.5, 250, 214, 18)), fill=GLOSS)
        paint_clip(c)
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
        cx = s * LENS_DX
        c.poly(ellipse_pts(cx, LENS_CY, LENS_R, LENS_R, 56), fill=LENS, stroke=INK, w=GW)
    c.line([(-LENS_DX + LENS_R - 1, LENS_CY - 3), (LENS_DX - LENS_R + 1, LENS_CY - 3)], INK, 2.2)
    for s in (-1, 1):
        c.line([(s * (LENS_DX + LENS_R - 1), LENS_CY - 1), (s * 41, LENS_CY - 4)], INK, 2.2)
    if not c.border:
        for s in (-1, 1):
            cx = s * LENS_DX
            c.line([(cx - 9.6, LENS_CY - 4.6), (cx - 4.4, LENS_CY - 10.4)], WHITE, 2.2)
    c.pop(prev)


def _eye(c, cx, cy, style):
    if style == 'dot':
        c.dot((cx, cy), 3.7, INK)
    elif style == 'big':
        c.dot((cx, cy), 5.3, INK)
        c.dot((cx - 1.7, cy - 1.9), 1.7, WHITE)
    elif style == 'happy':                        # ^ closed, content
        c.line(arc_pts(cx, cy + 2.2, 5.6, 5.0, 190, 350, 20), INK, 2.3)
    elif style == 'closed':                       # gentle downward lid
        c.line(arc_pts(cx, cy - 2.0, 5.4, 4.4, 20, 160, 20), INK, 2.3)
    elif style == 'sleepy':
        c.line(arc_pts(cx, cy - 1.2, 5.6, 3.0, 15, 165, 20), INK, 2.4)
        c.line([(cx - 4.4, cy + 3.4), (cx + 4.4, cy + 3.4)], INK, 1.4)
    elif style == 'squeeze':                      # >< strong shut
        c.line([(cx - 5.0, cy - 4.2), (cx, cy), (cx - 5.0, cy + 4.2)], INK, 2.3)
        c.line([(cx + 5.0, cy - 4.2), (cx, cy), (cx + 5.0, cy + 4.2)], INK, 2.3)
    elif style == 'sad':
        c.dot((cx, cy + 1.6), 3.5, INK)
        c.line(arc_pts(cx, cy + 1.0, 5.2, 5.0, 200, 340, 18), INK, 2.0)
    elif style == 'sparkle':
        c.dot((cx, cy), 5.3, INK)
        c.dot((cx - 1.6, cy - 2.0), 2.0, WHITE)
        c.dot((cx + 1.9, cy + 1.9), 1.1, WHITE)
    elif style == 'x':
        c.line([(cx - 4.4, cy - 4.4), (cx + 4.4, cy + 4.4)], INK, 2.3)
        c.line([(cx + 4.4, cy - 4.4), (cx - 4.4, cy + 4.4)], INK, 2.3)
    elif style == 'swirl':
        pts = []
        for i in range(34):
            t = i / 33.0
            a = t * math.pi * 3.2
            r = 0.9 + t * 4.6
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        c.line(pts, INK, 1.9)
    elif style == 'flat':
        c.line([(cx - 4.6, cy), (cx + 4.6, cy)], INK, 2.3)
    elif style == 'small':
        c.dot((cx, cy), 2.5, INK)


def paint_eyes(c, f):
    ox, oy = f['eye_off']
    _eye(c, -LENS_DX + ox, LENS_CY + oy, f['eyeL'] or f['eye'])
    _eye(c, LENS_DX + ox, LENS_CY + oy, f['eyeR'] or f['eye'])


def paint_brows(c, f):
    st = f['brow']
    if st == 'none':
        return
    tilt = {'neutral': 0.0, 'up': -14.0, 'angry': 20.0, 'sad': -20.0,
            'flat': 0.0, 'worry': -9.0}.get(st, 0.0)
    lift = {'up': -3.0, 'angry': 1.5, 'sad': 0.5, 'worry': -1.0}.get(st, 0.0)
    for s in (-1, 1):
        x0, x1 = s * 11.0, s * 25.0
        y = BROW_Y + lift
        dy = math.tan(math.radians(tilt)) * 7.0
        if st in ('neutral', 'worry'):
            c.line(arc_pts(s * 18.0, y + 2.6 + dy * 0.4, 7.0, 3.4, 200, 340, 14), INK, 2.0)
        else:
            c.line([(x0, y + dy), (x1, y - dy)], INK, 2.1)


def paint_mouth(c, f):
    st = f['mouth']
    mx, my = f['mouth_off']
    x, y = mx, MOUTH_Y + my
    if st == 'smile':
        c.line(arc_pts(x, y - 3.4, 5.8, 5.0, 28, 152, 18), INK, 2.1)
    elif st == 'grin':
        c.line(arc_pts(x, y - 4.4, 7.6, 6.6, 25, 155, 22), INK, 2.3)
    elif st == 'w':
        c.line(arc_pts(x - 3.4, y - 2.4, 3.4, 3.0, 25, 155, 12), INK, 1.9)
        c.line(arc_pts(x + 3.4, y - 2.4, 3.4, 3.0, 25, 155, 12), INK, 1.9)
    elif st == 'o':
        c.poly(ellipse_pts(x, y, 3.6, 4.0, 28), fill=INK)
    elif st == 'open':
        c.poly(ellipse_pts(x, y + 0.5, 5.2, 5.8, 32), fill=INK)
    elif st == 'shout':
        pts = chain(bez((x - 8.2, y - 2.6), (x - 5, y - 7.0), (x + 5, y - 7.0), (x + 8.2, y - 2.6)),
                    bez((x + 8.2, y - 2.6), (x + 6, y + 8.6), (x - 6, y + 8.6), (x - 8.2, y - 2.6)))
        c.poly(pts, fill=INK)
    elif st == 'flat':
        c.line([(x - 4.6, y), (x + 4.6, y)], INK, 2.0)
    elif st == 'frown':
        c.line(arc_pts(x, y + 3.4, 5.0, 4.2, 210, 330, 18), INK, 2.1)
    elif st == 'wave':
        c.line(chain(bez((x - 6.4, y), (x - 3.6, y - 4.0), (x - 1.2, y + 2.6), (x, y - 0.4)),
                     bez((x, y - 0.4), (x + 1.4, y - 3.2), (x + 3.8, y + 3.2), (x + 6.4, y - 0.6))),
               INK, 1.9)
    elif st == 'pout':
        c.line(arc_pts(x, y + 2.6, 3.4, 3.0, 200, 340, 14), INK, 2.2)
    elif st == 'none':
        pass


def paint_cheeks(c, f):
    n = f['cheek']
    if not n:
        return
    for s in (-1, 1):
        for i in range(n):
            bx = s * 26.5 + (i - (n - 1) / 2.0) * 3.6 * s
            c.line([(bx - 2.3, 27.4), (bx + 2.3, 22.6)], INK, 1.4)


# ------------------------------------------------------------------- limbs

def _hand(c, wrist, ang, style, hs=1.0):
    hc = (wrist[0] + HAND_R * hs * math.sin(math.radians(ang)),
          wrist[1] + HAND_R * hs * math.cos(math.radians(ang)))
    prev = c.push(compose(compose(trans(*hc), rot_about(-ang, 0, 0)),
                          scale_about(hs, hs, 0, 0)))
    if style == 'thumb':
        c.poly(capsule((0.0, -0.5), (0.0, -8.6), 3.4), fill=SKIN, stroke=INK, w=LW)
        c.poly(rounded_rect(0, 1.6, 11.6, 11.0, 4.7), fill=SKIN, stroke=INK, w=LW)
    elif style == 'point':
        c.poly(capsule((0.0, -1.0), (0.0, -11.0), 3.0), fill=SKIN, stroke=INK, w=LW)
        c.poly(rounded_rect(0, 2.2, 11.0, 10.4, 4.5), fill=SKIN, stroke=INK, w=LW)
    elif style == 'fist':
        c.poly(rounded_rect(0, 0, 11.6, 11.0, 4.8), fill=SKIN, stroke=INK, w=LW)
        c.line([(-3.6, 1.6), (3.6, 1.6)], INK, 1.3)
    elif style == 'open':
        c.poly(ellipse_pts(0, 0.6, 6.2, 6.6, 40), fill=SKIN, stroke=INK, w=LW)
        for k in (-1, 0, 1):
            c.poly(capsule((k * 3.3, -2.4), (k * 4.4, -8.0), 2.4), fill=SKIN, stroke=INK, w=LW)
    else:                                              # 'round' mitten
        c.poly(ellipse_pts(0, 0, 6.2, 6.5, 44), fill=SKIN, stroke=INK, w=LW)
    c.pop(prev)


def arm_points(side, angles, shoulder_dy=0.0):
    """side: 0 = character-left (screen left), 1 = character-right."""
    a1, a2 = angles
    s = (SHOULDER[side][0], SHOULDER[side][1] + shoulder_dy)
    e = (s[0] + ARM_L1 * math.sin(math.radians(a1)),
         s[1] + ARM_L1 * math.cos(math.radians(a1)))
    a = a1 + a2
    w = (e[0] + ARM_L2 * math.sin(math.radians(a)),
         e[1] + ARM_L2 * math.cos(math.radians(a)))
    return s, e, w, a


def ik(side, hand_xy, elbow=0, shoulder_dy=0.0):
    """Solve (a1, a2) so the hand centre lands on `hand_xy`.

    The hand centre sits on the forearm axis, so the second link is taken as
    ARM_L2 + HAND_R.  `elbow` = 0 auto-picks the solution that keeps the
    elbow away from the body; +1 / -1 force it.  Targets beyond reach are
    clamped to the arm's reach circle.
    """
    s = (SHOULDER[side][0], SHOULDER[side][1] + shoulder_dy)
    l1, l2 = ARM_L1, ARM_L2 + HAND_R
    dx, dy = hand_xy[0] - s[0], hand_xy[1] - s[1]
    d = math.hypot(dx, dy)
    # keep the solver out of the ill-conditioned zone near the shoulder,
    # where a tiny target change swings the upper-arm angle wildly
    d = min(max(d, abs(l1 - l2) + 8.5), l1 + l2 - 0.35)
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


def hand_target_local(pose, side):
    """The IK target implied by a pose's stored arm angles (upper-body space)."""
    angles = arm_angles(pose, side)
    s, e, w, a = arm_points(side, angles, pose['shoulder_dy'])
    return (w[0] + HAND_R * math.sin(math.radians(a)),
            w[1] + HAND_R * math.cos(math.radians(a)))


def arm_angles(pose, side):
    """Joint angles for one arm.

    When a hand target is present it is solved per frame, so the hand travels
    a straight line between keyframes and no angle ever has to be unwrapped.
    """
    t = pose['armL_t'] if side == 0 else pose['armR_t']
    if t is None:
        return pose['armL'] if side == 0 else pose['armR']
    e = pose['armL_elbow'] if side == 0 else pose['armR_elbow']
    return ik(side, t, elbow=e, shoulder_dy=pose['shoulder_dy'])


def paint_arm(c, pose, side):
    angles = arm_angles(pose, side)
    hand = pose['handL'] if side == 0 else pose['handR']
    hang = pose['handL_ang'] if side == 0 else pose['handR_ang']
    hs = pose['handL_s'] if side == 0 else pose['handR_s']
    s, e, w, a = arm_points(side, angles, pose['shoulder_dy'])
    if hang is not None:
        a = hang
    c.poly(capsule(s, e, ARM_W), fill=SKIN, stroke=INK, w=LW)
    c.poly(capsule(e, w, ARM_W - 0.3), fill=SKIN, stroke=INK, w=LW)
    _hand(c, w, a, hand, hs)
    # puff sleeve rides the shoulder, so it follows the upper arm
    sl = (s[0] + 2.0 * math.sin(math.radians(angles[0])),
          s[1] + 2.0 * math.cos(math.radians(angles[0])))
    c.poly(ellipse_pts(sl[0], sl[1], 7.6, 7.4, 40), fill=WHITE, stroke=INK, w=LW)


def paint_legs(c, pose):
    dy = pose['hip_dy']
    for side, ang, ov in ((0, pose['legL'], pose['footL']), (1, pose['legR'], pose['footR'])):
        h = (HIP_PT[side][0], HIP_PT[side][1] + dy)
        if ov is not None:
            ank = ov
            ang = math.degrees(math.atan2(ank[0] - h[0], ank[1] - h[1]))
        else:
            ank = (h[0] + LEG_LEN * math.sin(math.radians(ang)),
                   HIP_PT[side][1] + LEG_LEN * math.cos(math.radians(ang)))
        c.poly(capsule(h, ank, LEG_W), fill=SKIN, stroke=INK, w=LW)
        c.poly(ellipse_pts(ank[0], ank[1] + 2.2, 7.6, 4.3, 40, rot=ang * 0.45),
               fill=INK, stroke=INK, w=LW)


DRESS_TOP_Y = 108.5
DRESS_HEM_Y = 151.5


def paint_torso(c, pose):
    c.poly(capsule((90, 106), (90, 116), 5.6), fill=SKIN, stroke=INK, w=LW)
    span = DRESS_HEM_Y - DRESS_TOP_Y
    f = max(0.30, (span - pose['hip_dy']) / span)
    prev = c.push(scale_about(1.0, f, 90, DRESS_TOP_Y))
    c.poly([(90 + x, y) for x, y in dress_shape(pose['dress_flare'])],
           fill=WHITE, stroke=INK, w=LW)
    c.pop(prev)
    c.line([(83.5, 112.5), (90, 118.0), (96.5, 112.5)], INK, 1.5)


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
    """World position and facing of one hand, for props held in it."""
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
    """Paint the requested parts of `pose` into context `c`."""
    body, upper, head_m = matrices(pose)
    hide = set(pose['hide'])

    back = [k for k in ('armL', 'armR') if pose[k + '_z'] == 'back']
    front = [k for k in ('armL', 'armR') if k not in back]

    if 'legs' in parts and 'legs' not in hide:
        p = c.push(body); paint_legs(c, pose); c.pop(p)
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
