"""Hottest Party's 3D dance stages (files/data/stgNN.bin), read for the in-browser stage renderer.

Each stgNN.bin is a list of zlib-packed HSF models (Hudson's format, version HSFV037): the background,
the stage floor and props, each followed by its animation, then where the dancers stand, then the
camera moves. Here they're turned into one JSON for web/stage.js: geometry as base64 float arrays,
textures as PNGs, the object tree, and the animation curves.
"""
import base64, math, struct, zlib
from array import array

NAMES = ('scene color material attribute vertex normal st face object bitmap palette motion cenv skeleton '
         'part cluster shape mapAttr matrix symbol string').split()


def entries(d):
    n = struct.unpack_from('>I', d, 0)[0]
    offs = list(struct.unpack_from('>%dI' % n, d, 4)) + [len(d)]
    out = []
    for i in range(n):
        usz, kind, _, csz = struct.unpack_from('>4I', d, offs[i])
        out.append(zlib.decompress(d[offs[i] + 16:offs[i] + 16 + csz]))
    return out


def rgb5a3(v):
    if v & 0x8000:
        return (((v >> 10) & 31) * 255 // 31, ((v >> 5) & 31) * 255 // 31, (v & 31) * 255 // 31, 255)
    return (((v >> 8) & 15) * 17, ((v >> 4) & 15) * 17, (v & 15) * 17, ((v >> 12) & 7) * 255 // 7)


def rgb565(v):
    return (((v >> 11) & 31) * 255 // 31, ((v >> 5) & 63) * 255 // 63, (v & 31) * 255 // 31, 255)


def ia8(v):
    return (v & 255, v & 255, v & 255, v >> 8)


def png(w, h, px):
    def chunk(t, b):
        return struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xffffffff)
    raw = b''.join(b'\0' + bytes(px[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + \
        chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b'')


def b64f(vals):
    return base64.b64encode(array('f', vals).tobytes()).decode()


def b64u8(vals):
    return base64.b64encode(bytes(vals)).decode()


class Hsf:
    def __init__(self, u):
        self.u = u
        self.sec = {n: struct.unpack_from('>ii', u, 8 + 8 * i) for i, n in enumerate(NAMES)}

    def s(self, off):
        u, so = self.u, self.sec['string'][0]
        try:
            return u[so + off:u.index(b'\0', so + off)].decode('latin1')
        except ValueError:
            return ''

    def buffers(self, name, fmt, size):
        u = self.u
        o, c = self.sec[name]
        base = o + 12 * c
        out = []
        for i in range(c):
            nm, n, d = struct.unpack_from('>IiI', u, o + 12 * i)
            out.append([struct.unpack_from(fmt, u, base + d + size * k) for k in range(n)])
        return out

    def faces(self):
        u = self.u
        o, c = self.sec['face']
        base = o + 12 * c
        out = []
        for i in range(c):
            nm, n, d = struct.unpack_from('>IiI', u, o + 12 * i)
            p = base + d
            strips = p + 48 * n
            fl = []
            for k in range(n):
                q = p + 48 * k
                typ, mat = struct.unpack_from('>hh', u, q)
                t = typ & 7
                if t == 4:
                    idx = [struct.unpack_from('>4h', u, q + 4 + 8 * j) for j in range(3)]
                    cnt, sd = struct.unpack_from('>II', u, q + 28)
                    idx += [struct.unpack_from('>4h', u, strips + 8 * (sd + j)) for j in range(cnt)]
                elif t == 3:
                    idx = [struct.unpack_from('>4h', u, q + 4 + 8 * j) for j in range(4)]
                elif t == 2:
                    idx = [struct.unpack_from('>4h', u, q + 4 + 8 * j) for j in range(3)]
                else:
                    continue
                fl.append((t, mat & 0x7fff, idx))
            out.append(fl)
        return out

    def palettes(self):
        u = self.u
        po, pc = self.sec['palette']
        base = po + 16 * pc
        out = []
        for i in range(pc):
            name, fmt, n, data = struct.unpack_from('>IIII', u, po + 16 * i)
            vals = struct.unpack_from('>%dH' % n, u, base + data)
            f = {1: ia8, 2: rgb565, 3: rgb5a3}.get(fmt, rgb5a3)
            out.append([f(v) for v in vals])
        return out

    def bitmaps(self):
        u = self.u
        bo, bc = self.sec['bitmap']
        base = bo + 32 * bc
        pals = self.palettes() if self.sec['palette'][1] else []
        out = []
        for i in range(bc):
            name, maxlod, fmt, pix, w, h, psz = struct.unpack_from('>IIBBHHH', u, bo + 32 * i)
            palidx, unk, data = struct.unpack_from('>iII', u, bo + 32 * i + 20)
            p = base + data
            px = bytearray(w * h * 4)

            def put(x, y, c):
                if x < w and y < h:
                    o = (y * w + x) * 4
                    px[o:o + 4] = bytes(c)
            try:
                if fmt in (9, 10) or pix in (4, 8) and palidx >= 0 and pals and fmt not in (7,):
                    pal = pals[palidx] if 0 <= palidx < len(pals) else [(255, 255, 255, 255)] * 256
                    if pix == 8:
                        for ty in range(0, h, 4):
                            for tx in range(0, w, 8):
                                for y in range(4):
                                    for x in range(8):
                                        v = u[p]
                                        p += 1
                                        put(tx + x, ty + y, pal[v] if v < len(pal) else (0, 0, 0, 0))
                    else:
                        for ty in range(0, h, 8):
                            for tx in range(0, w, 8):
                                for y in range(8):
                                    for x in range(0, 8, 2):
                                        b = u[p]
                                        p += 1
                                        put(tx + x, ty + y, pal[b >> 4] if (b >> 4) < len(pal) else (0, 0, 0, 0))
                                        put(tx + x + 1, ty + y, pal[b & 15] if (b & 15) < len(pal) else (0, 0, 0, 0))
                elif fmt == 6:
                    for ty in range(0, h, 4):
                        for tx in range(0, w, 4):
                            ar, gb = u[p:p + 32], u[p + 32:p + 64]
                            p += 64
                            for k in range(16):
                                put(tx + k % 4, ty + k // 4, (ar[2 * k + 1], gb[2 * k], gb[2 * k + 1], ar[2 * k]))
                elif fmt in (4, 5):
                    f = rgb565 if fmt == 4 else rgb5a3
                    for ty in range(0, h, 4):
                        for tx in range(0, w, 4):
                            for y in range(4):
                                for x in range(4):
                                    put(tx + x, ty + y, f((u[p] << 8) | u[p + 1]))
                                    p += 2
                elif fmt == 7:          # CMPR
                    for ty in range(0, h, 8):
                        for tx in range(0, w, 8):
                            for sy in (0, 4):
                                for sx in (0, 4):
                                    v0, v1 = struct.unpack_from('>HH', u, p)
                                    a, b = rgb565(v0), rgb565(v1)
                                    if v0 > v1:
                                        pal = [a, b, tuple((2 * a[j] + b[j]) // 3 for j in range(3)) + (255,),
                                               tuple((a[j] + 2 * b[j]) // 3 for j in range(3)) + (255,)]
                                    else:
                                        pal = [a, b, tuple((a[j] + b[j]) // 2 for j in range(3)) + (255,), (0, 0, 0, 0)]
                                    for y in range(4):
                                        row = u[p + 4 + y]
                                        for x in range(4):
                                            put(tx + sx + x, ty + sy + y, pal[(row >> (6 - 2 * x)) & 3])
                                    p += 8
                else:
                    px = bytearray(b'\xff' * (w * h * 4))
            except (IndexError, struct.error):
                pass
            out.append(dict(name=self.s(name), w=w, h=h, png=base64.b64encode(png(w, h, px)).decode()))
        return out

    def materials(self):
        u = self.u
        mo, mc = self.sec['material']
        ao, ac = self.sec['attribute']
        so = self.sec['symbol'][0]
        attrs = []
        for i in range(ac):
            b = ao + 132 * i
            ws, wt = struct.unpack_from('>II', u, b + 0x64)
            bmp = struct.unpack_from('>i', u, b + 0x80)[0]
            attrs.append(dict(bitmap=bmp, wrapS=ws, wrapT=wt))
        out = []
        for i in range(mc):
            b = mo + 60 * i
            vtx = u[b + 0xa]
            col = list(u[b + 0xe:b + 0x11])
            inv = struct.unpack_from('>f', u, b + 0x1c)[0]
            flags, nat, ap = struct.unpack_from('>IIi', u, b + 0x30)
            alist = [struct.unpack_from('>i', u, so + 4 * (ap + k))[0] for k in range(nat)] if nat and ap >= 0 else []
            out.append(dict(color=col, vtx=vtx, alpha=round(1 - inv, 3), flags=flags, attrs=alist))
        return out, attrs

    def objects(self):
        u = self.u
        oo, oc = self.sec['object']
        so = self.sec['symbol'][0]
        out = []
        for i in range(oc):
            b = oo + 0x144 * i
            name, typ, const, flags, parent, nch, ch = struct.unpack_from('>IIIIiIi', u, b)
            base = struct.unpack_from('>9f', u, b + 0x1c)
            face, vert, nrm, col, st, mat, attr = struct.unpack_from('>7i', u, b + 0x104)
            out.append(dict(name=self.s(name), type=typ, flags=flags, parent=parent,
                            pos=[round(x, 3) for x in base[0:3]], rot=[round(x, 3) for x in base[3:6]],
                            scl=[round(x, 4) for x in base[6:9]], face=face, vert=vert, nrm=nrm, col=col, st=st))
        return out

    def motion(self):
        u = self.u
        mo, mc = self.sec['motion']
        if not mc:
            return None
        name, ntr, tr, ln = struct.unpack_from('>IIIf', u, mo)
        tb = mo + 16 * mc
        db = tb + 16 * ntr
        tracks = []
        for k in range(ntr):
            typ, start, target, param, ch, curve, nk, data = struct.unpack_from('>BBHHHHHI', u, tb + 16 * k)
            if curve == 4:
                keys = round(struct.unpack_from('>f', u, tb + 16 * k + 12)[0], 4)
            elif curve == 1:
                keys = [round(x, 4) for j in range(nk) for x in struct.unpack_from('>2f', u, db + data + 8 * j)]
            elif curve == 2:
                keys = [round(x, 5) for j in range(nk) for x in struct.unpack_from('>4f', u, db + data + 16 * j)]
            else:
                continue
            if typ == 10:
                tgt = param                      # attribute index
            elif target != 0xffff:
                tgt = self.s(target)
            else:
                tgt = None
            tracks.append(dict(type=typ, target=tgt, param=param, ch=ch, curve=curve, keys=keys))
        return dict(len=ln, tracks=tracks)

    def model(self):
        """objects with their geometry (triangles per material) for the renderer"""
        if not self.sec['object'][1]:
            return None
        verts = self.buffers('vertex', '>3f', 12)
        nrm_c = self.sec['normal']
        # normals: floats when the model has skinning envelopes, else s8 (x/64)
        if self.sec['cenv'][1]:
            nrms = self.buffers('normal', '>3f', 12)
        else:
            nrms = [[(a / 64.0, b / 64.0, c / 64.0) for a, b, c in buf] for buf in self.buffers('normal', '>3b', 3)]
        sts = self.buffers('st', '>2f', 8)
        cols = self.buffers('color', '>4B', 4)
        fcs = self.faces()
        mats, attrs = self.materials()
        objs = self.objects()
        for o in objs:
            if o['type'] != 2 or not (0 <= o['face'] < len(fcs)):
                continue
            V = verts[o['vert']] if 0 <= o['vert'] < len(verts) else []
            N = nrms[o['nrm']] if 0 <= o['nrm'] < len(nrms) else []
            T = sts[o['st']] if 0 <= o['st'] < len(sts) else []
            C = cols[o['col']] if 0 <= o['col'] < len(cols) else []
            groups = {}
            for t, mat, idx in fcs[o['face']]:
                if t == 2:
                    tris = [(idx[0], idx[1], idx[2])]
                elif t == 3:
                    tris = [(idx[0], idx[1], idx[2]), (idx[1], idx[3], idx[2])]
                else:
                    tris = []
                    for j in range(len(idx) - 2):
                        tris.append((idx[j], idx[j + 1], idx[j + 2]) if j % 2 == 0 else (idx[j + 1], idx[j], idx[j + 2]))
                g = groups.setdefault(mat, ([], [], [], []))
                for tri in tris:
                    for pi, ni, ci, ti in tri:
                        g[0].extend(V[pi] if 0 <= pi < len(V) else (0, 0, 0))
                        g[1].extend(N[ni] if 0 <= ni < len(N) else (0, 1, 0))
                        g[2].extend(T[ti] if 0 <= ti < len(T) else (0, 0))
                        g[3].extend(C[ci] if 0 <= ci < len(C) else (255, 255, 255, 255))
            o['mesh'] = [dict(mat=m, n=len(g[0]) // 3, pos=b64f(g[0]), nrm=b64f(g[1]), uv=b64f(g[2]), col=b64u8(g[3]))
                         for m, g in groups.items()]
        for k in ('face', 'vert', 'nrm', 'col', 'st'):
            for o in objs:
                o.pop(k, None)
        return dict(objects=objs, materials=mats, attrs=attrs, bitmaps=self.bitmaps(), motion=self.motion())


def stage(path):
    """the whole stage: its models (each with its own animation) and the camera moves"""
    parts = [Hsf(u) for u in entries(open(path, 'rb').read())]
    models, cameras, spots, i = [], [], {}, 0
    while i < len(parts):
        h = parts[i]
        m = h.model() if h.sec['object'][1] else None
        nxt = parts[i + 1] if i + 1 < len(parts) and not parts[i + 1].sec['object'][1] else None
        if m:
            names = [o['name'] for o in m['objects']]
            if any(n.startswith('look') or n.startswith('chr') for n in names):
                objs = m['objects']
                for k, o in enumerate(objs):         # where the dancers stand
                    if o['name'].startswith(('chr', 'look')) and o['type'] != 2:
                        p, q, n = list(o['pos']), o['parent'], 0
                        while 0 <= q < len(objs) and n < 50:
                            p = [p[j] + objs[q]['pos'][j] for j in range(3)]
                            q, n = objs[q]['parent'], n + 1
                        spots[o['name']] = p
                i += 2 if nxt else 1
                continue
            if any(n.startswith('cam_int') for n in names):
                i += 2 if nxt else 1          # where the dancers stand / a camera rig: not drawn
                continue
            if nxt is not None:
                mo = nxt.motion()
                if mo and mo['tracks']:
                    m['motion'] = mo
                i += 1
            models.append(m)
        else:
            mo = h.motion()
            if mo and any(t['param'] == 7 for t in mo['tracks']):
                cameras.append(mo)
        i += 1
    return dict(models=models, cameras=cameras, spots=spots)


if __name__ == '__main__':
    import json, sys, time
    t = time.time()
    s = stage(sys.argv[1])
    j = json.dumps(s)
    print('models', len(s['models']), 'cameras', len(s['cameras']), 'json KB', len(j) // 1024, 'secs', round(time.time() - t, 2))


def menu(path):
    """the menus' moving background (data/win.bin): the gridded sphere and the turning circles"""
    parts = entries(open(path, 'rb').read())
    models = []
    for u in parts:
        if u[:3] != b'HSF':
            continue
        m = Hsf(u).model()
        if m:
            models.append(m)
    return dict(models=models, cameras=[])
