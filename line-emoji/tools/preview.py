"""Contact-sheet helpers used while authoring and for the delivered previews."""
from PIL import Image, ImageDraw
import anim
import render
import rig


def strip(item, size=150, frames=None):
    """P1..P6 pose strip (or the 20 rendered frames) side by side."""
    if frames is None:
        frames = []
        for k, p in enumerate(item['poses']):
            ex = (lambda c, _p=p, _k=k: item['fx'](c, _p, item['stops'][_k])) if item.get('fx') else None
            frames.append(render.render_stage(p, extras=ex))
    s = Image.new('RGB', (size * len(frames), size + 34), (246, 246, 250))
    d = ImageDraw.Draw(s)
    for i, im in enumerate(frames):
        s.paste(render.flatten_on(im.resize((size, size), Image.LANCZOS)), (i * size, 0))
        t = im.resize((32, 32), Image.LANCZOS)
        s.paste(render.flatten_on(t), (i * size + size // 2 - 16, size + 1))
        d.line([(i * size, 0), (i * size, size + 34)], fill=(212, 212, 220))
    return s


def grid(images, cols, cell, bg=(255, 255, 255), labels=None, pad=0):
    rows = (len(images) + cols - 1) // cols
    s = Image.new('RGB', (cols * (cell + pad) + pad, rows * (cell + pad) + pad), bg)
    for i, im in enumerate(images):
        x = pad + (i % cols) * (cell + pad)
        y = pad + (i // cols) * (cell + pad)
        s.paste(render.flatten_on(im.resize((cell, cell), Image.LANCZOS), bg + (255,)), (x, y))
    return s
