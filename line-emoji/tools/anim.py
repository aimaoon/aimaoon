"""Timeline, interpolation and APNG export.

Twenty frames per emoji.  The six approved poses P1..P6 are waypoints; the
in-between frames are produced by interpolating each part's angle / offset /
deformation, never by cross-fading two finished pictures.
"""
import math
from PIL import Image
import rig
import render

FRAMES = 20
CYCLE_MS = 4000

_NUM_SCALAR = ('sx', 'sy', 'lean', 'hip_dy', 'head_rot', 'legL', 'legR',
               'glasses_rot', 'handL_s', 'handR_s', 'dress_flare', 'shoulder_dy')
_NUM_TUPLE = ('root', 'head_off', 'armL', 'armR', 'glasses_off')
_OPT_TUPLE = ('footL', 'footR', 'armL_t', 'armR_t')
_OPT_SCALAR = ('handL_ang', 'handR_ang')
_DISCRETE = ('handL', 'handR', 'armL_z', 'armR_z', 'hide',
             'armL_elbow', 'armR_elbow')
_FACE_NUM = ('eye_off', 'mouth_off')
_FACE_DISC = ('eye', 'eyeL', 'eyeR', 'brow', 'mouth', 'cheek')


# ------------------------------------------------------------------ easing

def ease(u, kind='inout'):
    u = min(1.0, max(0.0, u))
    if kind == 'linear':
        return u
    if kind == 'in':
        return u * u
    if kind == 'out':
        return 1.0 - (1.0 - u) ** 2
    if kind == 'out3':
        return 1.0 - (1.0 - u) ** 3
    if kind == 'inout':
        return 0.5 - 0.5 * math.cos(math.pi * u)
    if kind == 'back':                       # overshoots then comes back
        s = 1.70158
        return 1.0 + (s + 1.0) * (u - 1.0) ** 3 + s * (u - 1.0) ** 2
    if kind == 'anticip':                    # dips backwards first
        s = 1.70158
        return u * u * ((s + 1.0) * u - s)
    if kind == 'settle':                     # damped overshoot
        if u >= 1.0:
            return 1.0
        return 1.0 - math.cos(u * math.pi * 1.5) * math.exp(-3.4 * u)
    return u


def _lerp(a, b, u):
    return a + (b - a) * u


def lerp_pose(a, b, u):
    p = dict(a)
    for k in _NUM_SCALAR:
        p[k] = _lerp(a[k], b[k], u)
    for k in _NUM_TUPLE:
        p[k] = tuple(_lerp(x, y, u) for x, y in zip(a[k], b[k]))
    for k in _OPT_TUPLE:
        if a[k] is None or b[k] is None:
            p[k] = a[k] if u < 0.5 else b[k]
        else:
            p[k] = tuple(_lerp(x, y, u) for x, y in zip(a[k], b[k]))
    for k in _OPT_SCALAR:
        if a[k] is None or b[k] is None:
            p[k] = a[k] if u < 0.5 else b[k]
        else:
            p[k] = _lerp(a[k], b[k], u)
    for k in _DISCRETE:
        p[k] = a[k] if u < 0.5 else b[k]
    fa, fb = a['face'], b['face']
    f = dict(fa)
    for k in _FACE_NUM:
        f[k] = tuple(_lerp(x, y, u) for x, y in zip(fa[k], fb[k]))
    for k in _FACE_DISC:
        f[k] = fa[k] if u < 0.5 else fb[k]
    p['face'] = f
    return p


# --------------------------------------------------------------- timeline

def timeline(poses, stops, eases):
    """Return the 20 interpolated poses for one emoji.

    `stops` are the frame indices where P1..P6 land; the cycle closes by
    returning to P1 at virtual frame 20.
    """
    keys = list(zip(stops, poses)) + [(FRAMES, poses[0])]
    out = []
    for i in range(FRAMES):
        seg = 0
        while seg + 1 < len(keys) and i >= keys[seg + 1][0]:
            seg += 1
        f0, p0 = keys[seg]
        f1, p1 = keys[min(seg + 1, len(keys) - 1)]
        u = 0.0 if f1 == f0 else (i - f0) / float(f1 - f0)
        out.append(lerp_pose(p0, p1, ease(u, eases[min(seg, len(eases) - 1)])))
    return out


def durations(beat):
    """Turn 20 relative weights into 20 integer ms that sum to exactly 4000."""
    assert len(beat) == FRAMES
    tot = float(sum(beat))
    raw = [CYCLE_MS * w / tot for w in beat]
    out = [max(20, int(round(r))) for r in raw]
    diff = CYCLE_MS - sum(out)
    order = sorted(range(FRAMES), key=lambda i: -out[i])
    k = 0
    while diff != 0:
        i = order[k % FRAMES]
        step = 1 if diff > 0 else -1
        if out[i] + step >= 20:
            out[i] += step
            diff -= step
        k += 1
    assert sum(out) == CYCLE_MS
    return out


# ----------------------------------------------------------------- export

def render_frames(item, size=180):
    """Render the 20 delivery frames for one item definition."""
    poses = item.get('poses')
    fxfn = item.get('fx')
    frames = []
    if poses is None:                                   # symbol-only emoji
        for i in range(FRAMES):
            frames.append(render.render_stage(
                rig.P(), parts=set(),
                extras=(lambda c, _i=i: fxfn(c, None, _i)), size=size))
        return frames, None
    tl = timeline(poses, item['stops'], item['eases'])
    for i, p in enumerate(tl):
        extras = None
        if fxfn is not None:
            extras = (lambda c, _p=p, _i=i: fxfn(c, _p, _i))
        frames.append(render.render_stage(p, extras=extras, size=size))
    return frames, tl


def save_apng(frames, durs, path, loop=1):
    frames[0].save(path, save_all=True, append_images=frames[1:],
                   duration=durs, loop=loop, disposal=0, blend=0,
                   optimize=False)
