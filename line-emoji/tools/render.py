"""Frame renderer: paints the die-cut border pass and the art pass, then
reduces the 4x working canvas down to the 180px delivery size."""
from PIL import Image
import vec
from vec import Ctx, new_layer, reduce_to_stage, PXL
import rig


def render_layers(pose, parts=None, extras=None, extras_border=True):
    """Render one pose to a full-resolution RGBA layer (720x720).

    `extras` is an optional callable(ctx) drawing props / effects in stage
    coordinates; it is invoked in both the border pass and the art pass so
    props get the same sticker rim as the character.
    """
    parts = rig.FIXED_SET if parts is None else parts
    img = new_layer()

    b = Ctx(img, border=True, border_px=rig.BORDER_PX)
    rig.paint(b, pose, parts)
    if extras and extras_border:
        extras(b)

    a = Ctx(img, border=False)
    rig.paint(a, pose, parts)
    if extras:
        extras(a)
    return img


def render_stage(pose, parts=None, extras=None, size=180):
    return reduce_to_stage(render_layers(pose, parts, extras), size)


def flatten_on(img, bg=(255, 255, 255, 255)):
    out = Image.new('RGBA', img.size, bg)
    out.alpha_composite(img)
    return out.convert('RGB')
