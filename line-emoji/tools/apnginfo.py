"""Read APNG structure straight from the chunk stream, so the audits check
the delivered bytes rather than what the encoder was asked for."""
import struct


def read(path):
    raw = open(path, 'rb').read()
    assert raw[:8] == b'\x89PNG\r\n\x1a\n', 'not a PNG'
    i, out = 8, dict(path=path, bytes=len(raw), frames=[], num_plays=None,
                     num_frames=None, width=None, height=None, colour=None,
                     bitdepth=None, text_chunks=[])
    while i < len(raw):
        ln = struct.unpack('>I', raw[i:i + 4])[0]
        typ = raw[i + 4:i + 8]
        data = raw[i + 8:i + 8 + ln]
        if typ == b'IHDR':
            w, h, bd, ct = struct.unpack('>IIBB', data[:10])
            out.update(width=w, height=h, bitdepth=bd, colour=ct)
        elif typ == b'acTL':
            nf, npl = struct.unpack('>II', data[:8])
            out.update(num_frames=nf, num_plays=npl)
        elif typ == b'fcTL':
            (_sq, fw, fh, fx, fy, dn, dd, dop, bop) = struct.unpack('>IIIIIHHBB', data[:26])
            dd = dd or 100
            out['frames'].append(dict(w=fw, h=fh, x=fx, y=fy,
                                      ms=round(1000.0 * dn / dd),
                                      dispose=dop, blend=bop))
        elif typ in (b'tEXt', b'zTXt', b'iTXt', b'tIME', b'pHYs'):
            out['text_chunks'].append(typ.decode())
        i += 12 + ln
    return out


def summary(path):
    a = read(path)
    fr = a['frames']
    area = a['width'] * a['height']
    return dict(bytes=a['bytes'], w=a['width'], h=a['height'],
                colour=a['colour'], bitdepth=a['bitdepth'],
                n_fctl=len(fr), num_frames=a['num_frames'],
                num_plays=a['num_plays'], total_ms=sum(f['ms'] for f in fr),
                max_rect_ratio=round(max((f['w'] * f['h']) / area for f in fr), 4),
                mean_rect_ratio=round(sum((f['w'] * f['h']) / area for f in fr) / len(fr), 4),
                meta=sorted(set(a['text_chunks'])))


if __name__ == '__main__':
    import sys, json
    for p in sys.argv[1:]:
        print(json.dumps(summary(p), ensure_ascii=False))
