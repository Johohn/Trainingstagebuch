# -*- coding: utf-8 -*-
"""
Erzeugt die App-Icons (192, 512, maskable 512) ohne externe Bibliotheken:
abgerundetes Quadrat mit Indigo->Violett-Verlauf und weissem Hantel-Symbol.
Rendering mit 3x Supersampling fuer glatte Kanten.

Aufruf:  python make_icons.py
"""
import os
import struct
import zlib

SS = 3  # Supersampling-Faktor

# Verlauf: Indigo -> Violett (diagonal)
C1 = (99, 102, 241)    # #6366F1
C2 = (168, 85, 247)    # #A855F7

# Hantel-Formen im 512er-Raum: (cx, cy, halfW, halfH, radius)
SHAPES_BASE = [
    (256, 256, 118, 13, 13),   # Stange
    (133, 256, 27, 82, 14),    # aeussere Scheibe links
    (172, 256, 15, 48, 10),    # innere Scheibe links
    (379, 256, 27, 82, 14),    # aeussere Scheibe rechts
    (340, 256, 15, 48, 10),    # innere Scheibe rechts
]


def rrect_sdf(px, py, cx, cy, hw, hh, r):
    """Signed Distance eines abgerundeten Rechtecks (<=0 bedeutet innen)."""
    qx = abs(px - cx) - hw + r
    qy = abs(py - cy) - hh + r
    outside = (max(qx, 0.0) ** 2 + max(qy, 0.0) ** 2) ** 0.5
    inside = min(max(qx, qy), 0.0)
    return outside + inside - r


def scaled_shapes(size, sym_scale):
    """Formen vom 512er-Raum auf Zielgroesse/Symbolskalierung umrechnen."""
    k = (size / 512.0) * sym_scale
    c = size / 2.0
    out = []
    for cx, cy, hw, hh, r in SHAPES_BASE:
        out.append((c + (cx - 256) * k, c + (cy - 256) * k,
                    hw * k, hh * k, r * k))
    return out


def render(size, sym_scale, rounded):
    """RGBA-Zeilen (je size * 4 Bytes) eines Icons erzeugen."""
    shapes = scaled_shapes(size, sym_scale)
    ss = size * SS
    rad = size * 0.22  # Eckradius des Hintergrund-Quadrats
    half = size / 2.0

    # Supersampled Bitmap als Liste von Zeilen: (r, g, b, a) pro Pixel
    rows = []
    for sy in range(ss):
        fy = (sy + 0.5) / SS
        row = []
        for sx in range(ss):
            fx = (sx + 0.5) / SS
            t = (fx + fy) / (2.0 * (size - 1))
            r = C1[0] + (C2[0] - C1[0]) * t
            g = C1[1] + (C2[1] - C1[1]) * t
            b = C1[2] + (C2[2] - C1[2]) * t
            a = 255.0
            if rounded and rrect_sdf(fx, fy, half, half, half, half, rad) > 0:
                a = 0.0  # ausserhalb der abgerundeten Ecken
            for cx, cy, hw, hh, rrad in shapes:
                if rrect_sdf(fx, fy, cx, cy, hw, hh, rrad) <= 0:
                    r = g = b = 255.0  # weisses Hantel-Symbol
                    break
            row.append((r, g, b, a))
        rows.append(row)

    # Box-Downsample (praemultipliziert, damit die Ecken keinen Saum bekommen)
    out_rows = []
    for y in range(size):
        line = bytearray(size * 4)
        for x in range(size):
            sr = sg = sb = sa = 0.0
            for dy in range(SS):
                row = rows[y * SS + dy]
                base = x * SS
                for dx in range(SS):
                    pr, pg, pb, pa = row[base + dx]
                    sr += pr * pa
                    sg += pg * pa
                    sb += pb * pa
                    sa += pa
            n = SS * SS
            if sa > 0:
                sr /= sa; sg /= sa; sb /= sa
            a = sa / n
            i = x * 4
            line[i] = min(255, int(sr + 0.5))
            line[i + 1] = min(255, int(sg + 0.5))
            line[i + 2] = min(255, int(sb + 0.5))
            line[i + 3] = min(255, int(a + 0.5))
        out_rows.append(bytes(line))
    return out_rows


def write_png(path, size, rows):
    """Unkomprimiertes RGBA als PNG speichern (Filter 0, zlib-Kompression)."""
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    raw = b''.join(b'\x00' + row for row in rows)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print('geschrieben:', path, os.path.getsize(path), 'Bytes')


def main():
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
    os.makedirs(out, exist_ok=True)
    write_png(os.path.join(out, 'icon-192.png'), 192,
              render(192, 1.06, rounded=True))
    write_png(os.path.join(out, 'icon-512.png'), 512,
              render(512, 1.06, rounded=True))
    write_png(os.path.join(out, 'icon-maskable-512.png'), 512,
              render(512, 0.88, rounded=False))


if __name__ == '__main__':
    main()
