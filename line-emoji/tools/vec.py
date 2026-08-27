"""Minimal deterministic 2-D vector drawing on top of Pillow.

All geometry is authored in 180x180 "stage" units (floats) and rasterised at
SS times that resolution, then box/Lanczos-reduced by the caller.  Every
primitive is pure and deterministic, which is what lets the pipeline reuse
byte-identical layers for parts that do not move.
"""
import math
from PIL import Image, ImageDraw

SS = 4                      # supersample factor
STAGE = 180                 # final canvas edge, px
PXL = STAGE * SS            # working canvas edge, px

IDENT = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def compose(m, n):
    """Return the affine that applies n first, then m."""
    a1, b1, c1, d1, e1, f1 = m
    a2, b2, c2, d2, e2, f2 = n
    return (a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1)


def trans(dx, dy):
    return (1.0, 0.0, 0.0, 1.0, float(dx), float(dy))


def rot_about(deg, cx, cy):
    r = math.radians(deg)
    co, si = math.cos(r), math.sin(r)
    return (co, si, -si, co,
            cx - co * cx + si * cy,
            cy - si * cx - co * cy)


def scale_about(sx, sy, cx, cy):
    return (float(sx), 0.0, 0.0, float(sy), cx - sx * cx, cy - sy * cy)


def apply(m, p):
    a, b, c, d, e, f = m
    return (a * p[0] + c * p[1] + e, b * p[0] + d * p[1] + f)


# ---------------------------------------------------------------- primitives

def bez(p0, p1, p2, p3, n=18):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1.0 - t
        out.append((u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]))
    return out


def chain(*segs):
    """Concatenate point lists, dropping the duplicated joint points."""
    out = []
    for s in segs:
        if out and s and abs(out[-1][0] - s[0][0]) < 1e-9 and abs(out[-1][1] - s[0][1]) < 1e-9:
            out.extend(s[1:])
        else:
            out.extend(s)
    return out


def ellipse_pts(cx, cy, rx, ry, n=64, rot=0.0):
    r = math.radians(rot)
    cr, sr = math.cos(r), math.sin(r)
    out = []
    for i in range(n):
        t = 2 * math.pi * i / n
        x, y = rx * math.cos(t), ry * math.sin(t)
        out.append((cx + x * cr - y * sr, cy + x * sr + y * cr))
    return out


def arc_pts(cx, cy, rx, ry, a0, a1, n=28):
    out = []
    for i in range(n + 1):
        t = math.radians(a0 + (a1 - a0) * i / n)
        out.append((cx + rx * math.cos(t), cy + ry * math.sin(t)))
    return out


def capsule(p0, p1, r, n=18):
    ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
    pts = []
    for i in range(n + 1):
        t = ang - math.pi / 2 + math.pi * i / n
        pts.append((p1[0] + r * math.cos(t), p1[1] + r * math.sin(t)))
    for i in range(n + 1):
        t = ang + math.pi / 2 + math.pi * i / n
        pts.append((p0[0] + r * math.cos(t), p0[1] + r * math.sin(t)))
    return pts


def tapered(pts, widths, n=10):
    """Outline of a limb: a polyline with a half-width at each point.

    Drawing an arm as one tapering shape rather than stacked capsules is what
    separates a fashion-illustration line from a balloon-animal one.
    """
    import math as _m
    left, right = [], []
    m = len(pts)
    for i, (p, w) in enumerate(zip(pts, widths)):
        if i == 0:
            dx, dy = pts[1][0] - p[0], pts[1][1] - p[1]
        elif i == m - 1:
            dx, dy = p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]
        else:
            dx = pts[i + 1][0] - pts[i - 1][0]
            dy = pts[i + 1][1] - pts[i - 1][1]
        L = _m.hypot(dx, dy) or 1e-6
        nx, ny = -dy / L, dx / L
        left.append((p[0] + nx * w, p[1] + ny * w))
        right.append((p[0] - nx * w, p[1] - ny * w))
    ang = _m.atan2(pts[-1][1] - pts[-2][1], pts[-1][0] - pts[-2][0])
    cap = [(pts[-1][0] + widths[-1] * _m.cos(ang - _m.pi / 2 + _m.pi * k / n),
            pts[-1][1] + widths[-1] * _m.sin(ang - _m.pi / 2 + _m.pi * k / n))
           for k in range(n + 1)]
    return left + cap + right[::-1]


def rounded_rect(cx, cy, w, h, r, n=8):
    x0, y0, x1, y1 = cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2
    r = min(r, w / 2, h / 2)
    return chain(
        arc_pts(x1 - r, y0 + r, r, r, -90, 0, n),
        arc_pts(x1 - r, y1 - r, r, r, 0, 90, n),
        arc_pts(x0 + r, y1 - r, r, r, 90, 180, n),
        arc_pts(x0 + r, y0 + r, r, r, 180, 270, n),
    )


def star_pts(cx, cy, r_out, r_in, points=4, rot=0.0, pinch=0.0):
    """A 4- or 5-point star.  `pinch` bows the arms inward (sparkle look)."""
    out = []
    n = points * 2
    for i in range(n):
        a = math.radians(rot) + math.pi * i / points
        r = r_out if i % 2 == 0 else r_in
        out.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    if pinch <= 0:
        return out
    smooth = []
    for i in range(n):
        p, q = out[i], out[(i + 1) % n]
        mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        cx2 = cx + (mx - cx) * (1.0 - pinch)
        cy2 = cy + (my - cy) * (1.0 - pinch)
        smooth.extend(bez(p, ((p[0] + cx2) / 2, (p[1] + cy2) / 2),
                          ((q[0] + cx2) / 2, (q[1] + cy2) / 2), q, 6)[:-1])
    return smooth


def heart_pts(cx, cy, s, rot=0.0):
    top = (0.0, -0.30 * s)
    pts = chain(
        bez(top, (0.34 * s, -0.86 * s), (1.06 * s, -0.32 * s), (0.0, 0.62 * s), 20),
        bez((0.0, 0.62 * s), (-1.06 * s, -0.32 * s), (-0.34 * s, -0.86 * s), top, 20),
    )
    r = math.radians(rot)
    cr, sr = math.cos(r), math.sin(r)
    return [(cx + x * cr - y * sr, cy + x * sr + y * cr) for x, y in pts]


def drop_pts(cx, cy, w, h, rot=0.0):
    """Tear / sweat drop: round belly, tangent shoulders, pointed tip."""
    r = max(w / 2.0, 1e-3)
    d = max(h - r, r * 1.05, 1e-3)
    phi = math.degrees(math.acos(min(0.999, r / d)))
    bc = h / 2.0 - r
    pts = arc_pts(0.0, bc, r, r, -90.0 + phi, 270.0 - phi, 40)
    pts.append((0.0, -h / 2.0))
    rr = math.radians(rot)
    cr, sr = math.cos(rr), math.sin(rr)
    return [(cx + x * cr - y * sr, cy + x * sr + y * cr) for x, y in pts]


# ------------------------------------------------------------------- context

class Ctx:
    """Drawing context with an affine stack and a white 'die-cut' pass mode."""

    def __init__(self, img, border=False, border_px=0.0):
        self.img = img
        self.d = ImageDraw.Draw(img, 'RGBA')
        self.m = IDENT
        self.border = border
        self.bpx = border_px

    # -- transform stack
    def push(self, m):
        prev = self.m
        self.m = compose(self.m, m)
        return prev

    def pop(self, prev):
        self.m = prev

    def dev(self, p):
        a, b, c, d, e, f = self.m
        return ((a * p[0] + c * p[1] + e) * SS, (b * p[0] + d * p[1] + f) * SS)

    # -- primitives
    def poly(self, pts, fill=None, stroke=None, w=1.7, closed=True):
        if self.border:
            if fill is None and stroke is None:
                return
            bw = (w if stroke else 0.0) + 2.0 * self.bpx
            P = [self.dev(p) for p in pts]
            if fill is not None:
                self.d.polygon(P, fill=(255, 255, 255, 255))
            self._line(P + ([P[0]] if closed else []), (255, 255, 255, 255), bw)
            return
        P = [self.dev(p) for p in pts]
        if fill is not None:
            self.d.polygon(P, fill=fill)
        if stroke is not None:
            self._line(P + ([P[0]] if closed else []), stroke, w)

    def line(self, pts, color, w=1.7, closed=False):
        if self.border:
            P = [self.dev(p) for p in pts]
            self._line(P + ([P[0]] if closed else []), (255, 255, 255, 255), w + 2.0 * self.bpx)
            return
        P = [self.dev(p) for p in pts]
        self._line(P + ([P[0]] if closed else []), color, w)

    def dot(self, p, r, color):
        if self.border:
            color, r = (255, 255, 255, 255), r + self.bpx
        q = self.dev(p)
        rr = r * SS
        self.d.ellipse([q[0] - rr, q[1] - rr, q[0] + rr, q[1] + rr], fill=color)

    def _line(self, P, color, w):
        ww = max(1, int(round(w * SS)))
        if len(P) >= 2:
            self.d.line(P, fill=color, width=ww, joint='curve')
        r = ww / 2.0
        for q in (P[0], P[-1]):
            self.d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=color)


def new_layer():
    return Image.new('RGBA', (PXL, PXL), (0, 0, 0, 0))


def reduce_to_stage(img, size=STAGE):
    """Area-average the SS-times canvas down to delivery size.

    BOX is exact area sampling for an integer ratio: identical on screen to
    Lanczos for flat-colour art, with no ringing, and it yields ~140 distinct
    RGBA values per frame instead of ~6500 -- which is what keeps the APNGs
    inside the 300 KB ceiling.
    """
    return img.resize((size, size), Image.BOX)
