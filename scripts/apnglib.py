#!/usr/bin/env python3
"""APNG のチャンク解析と合成後フレーム展開。検査スクリプト共通の基盤。

依存は Python 3 + Pillow + numpy のみ（§11 共通ルール）。
"""
import hashlib
import struct
import zlib

import numpy as np
from PIL import Image, ImageSequence

PNG_SIG = b"\x89PNG\r\n\x1a\n"
META_CHUNKS = {b"tEXt", b"iTXt", b"zTXt", b"eXIf"}


def iter_chunks(data: bytes):
    """PNG のチャンクを (type, data) で順に返す。"""
    if not data.startswith(PNG_SIG):
        raise ValueError("not a PNG file")
    pos = len(PNG_SIG)
    while pos + 8 <= len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        ctype = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        yield ctype, body
        pos += 12 + length
        if ctype == b"IEND":
            break


class ApngInfo:
    """1ファイル分の構造情報。画素は持たない。"""

    def __init__(self, path):
        self.path = path
        with open(path, "rb") as f:
            raw = f.read()
        self.bytes = len(raw)
        self.width = self.height = None
        self.bit_depth = self.color_type = self.interlace = None
        self.num_frames = self.num_plays = None
        self.delays = []            # (delay_num, delay_den)
        self.meta_chunks = []
        self.phys = None            # (ppu_x, ppu_y, unit)
        self.has_actl = False
        self.chunk_types = []

        for ctype, body in iter_chunks(raw):
            self.chunk_types.append(ctype.decode("latin1"))
            if ctype == b"IHDR":
                (self.width, self.height, self.bit_depth, self.color_type,
                 _comp, _filt, self.interlace) = struct.unpack(">IIBBBBB", body[:13])
            elif ctype == b"acTL":
                self.has_actl = True
                self.num_frames, self.num_plays = struct.unpack(">II", body[:8])
            elif ctype == b"fcTL":
                dn, dd = struct.unpack(">HH", body[20:24])
                self.delays.append((dn, dd))
            elif ctype == b"pHYs":
                self.phys = struct.unpack(">IIB", body[:9])
            elif ctype in META_CHUNKS:
                self.meta_chunks.append(ctype.decode("latin1"))

    @property
    def total_duration_ms(self):
        """全 fcTL の delay 合計をms で返す。delay_den=0 は 1/100 秒（APNG仕様）。"""
        total = 0.0
        for dn, dd in self.delays:
            den = 100 if dd == 0 else dd
            total += dn * 1000.0 / den
        return total

    @property
    def dpi(self):
        """pHYs から dpi を求める。unit=1(メートル) のときのみ意味を持つ。"""
        if not self.phys:
            return None
        ppu_x, ppu_y, unit = self.phys
        if unit != 1:
            return None
        return (ppu_x * 0.0254, ppu_y * 0.0254)

    @property
    def is_rgba(self):
        return self.color_type == 6


def load_frames(path):
    """disposal / blend を適用した合成後の RGBA フレーム列を返す。"""
    im = Image.open(path)
    return [f.convert("RGBA") for f in ImageSequence.Iterator(im)]


def frames_as_arrays(frames):
    return [np.asarray(f, dtype=np.uint8) for f in frames]


def frame_hash(arr):
    return hashlib.sha256(arr.tobytes()).hexdigest()


def alpha_bbox(arr, alpha_threshold=8):
    """alpha > threshold の画素の外接矩形 (x0, y0, x1, y1) を返す。無ければ None。"""
    mask = arr[..., 3] > alpha_threshold
    if not mask.any():
        return None
    ys, xs = np.where(mask)
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def min_edge_margin(arr, alpha_threshold=8):
    """キャンバス端からの最小余白px。中身が無ければ None。"""
    bb = alpha_bbox(arr, alpha_threshold)
    if bb is None:
        return None
    x0, y0, x1, y1 = bb
    h, w = arr.shape[:2]
    return min(x0, y0, w - 1 - x1, h - 1 - y1)


def transparent_rgb_clean(arr):
    """alpha==0 の画素の RGB がすべて 0 か。"""
    m = arr[..., 3] == 0
    if not m.any():
        return True
    return bool((arr[..., :3][m] == 0).all())


def write_apng(frames, durations, out_path, loop=1, dpi=(72, 72)):
    """Pillow で APNG を書き出す（§9-8）。apngasm が無い環境の既定経路。"""
    assert len(frames) == len(durations)
    disposal = getattr(Image, "Disposal", None)
    dis = disposal.OP_BACKGROUND if disposal else 1
    frames[0].save(
        out_path, format="PNG", save_all=True, append_images=frames[1:],
        duration=durations, loop=loop, disposal=dis, blend=0,
        default_image=False, optimize=False, dpi=dpi,
    )


def roundtrip_max_diff(frames, path):
    """書き出した APNG を読み戻し、元フレームとの最大画素差を返す（§9-8）。"""
    decoded = load_frames(path)
    if len(decoded) != len(frames):
        return None, f"frame count {len(decoded)} != {len(frames)}"
    worst = 0
    for i, (a, b) in enumerate(zip(frames, decoded)):
        d = np.abs(np.asarray(a, np.int16) - np.asarray(b, np.int16)).max()
        if d > worst:
            worst = int(d)
    return worst, None


def normalize_transparent(img):
    """透明画素の RGB を 0 へ正規化する（§9-8）。"""
    a = np.array(img.convert("RGBA"))
    a[a[..., 3] == 0, :3] = 0
    return Image.fromarray(a)


def strip_metadata(path):
    """tEXt/iTXt/zTXt/eXIf チャンクを取り除いて上書きする。"""
    with open(path, "rb") as f:
        raw = f.read()
    out = bytearray(PNG_SIG)
    for ctype, body in iter_chunks(raw):
        if ctype in META_CHUNKS:
            continue
        out += struct.pack(">I", len(body)) + ctype + body
        out += struct.pack(">I", zlib.crc32(ctype + body) & 0xFFFFFFFF)
    with open(path, "wb") as f:
        f.write(bytes(out))
