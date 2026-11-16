"""Hottest Party 2's stages (files/stage/STGnnn.bin) for web/stage.js.

A stage file is a WII container (see hp2.wii_entries): entry 0 holds the named parts, pairs of
  NAME.zmb   a model ('ZMB GC'): texture names, materials, a node tree, meshes
  NAME.tpl   its textures (a standard TPL, in the order the model names them)
plus .zab animations (not read yet) and '@@' blocks.

ZMB layout (offsets from the 'ZMB ' magic, big-endian):
  0x18 textures   u32 count, then 32-byte names
  0x1c materials  u32 count, f32, u32 offset -> 0x50-byte records (r, g, b as u32, f32, flag bytes,
                  u32 texture count, u32 offset of the texture index list)
  0x20 nodes      u32 count, f32, u32 offset -> 0xa0-byte records (32-byte name, 4x4 matrix at +0x30
                  (row vectors, translation last), bounding box at +0x70/+0x80, parent at +0x94,
                  mesh count/offset at +0x98/+0x9c)
  mesh            0x40 bytes: id (= material), 0, faces, positions, 0, normals, uvs, colours,
                  then offsets of faces, positions, (weights), normals, uvs, colours
  face            u16 kind, u16 corners, then offsets of the corners' position / normal / colour /
                  uv index lists (u32 each)
The node matrices are applied to the vertices here, so the renderer gets each mesh where it stands.
"""
import base64
import struct
from array import array

import hp2
import hp


def b64f(vals):
    return base64.b64encode(array('f', vals).tobytes()).decode()


def b64u8(vals):
    return base64.b64encode(bytes(vals)).decode()


def wii_entries(d, b=0):
    """a WII container at b: [(name, offset, size)] (names when the container has them)"""
    mag, ver, cnt, named = struct.unpack_from('>4sfII', d, b)
    if mag != b'WII\0':
        return []
    offs = struct.unpack_from('>%dI' % (cnt * 2), d, b + 16)
    names = []
    if named:
        p = b + 16 + 8 * cnt
        area = min(offs[0::2]) - 16 - 8 * cnt if cnt else 0
        st = 64                                          # DDR II: fixed 64-byte name slots (then padding)
        if cnt and cnt * st <= area < cnt * st + 64 and all(32 <= d[p + st * i] < 127 for i in range(cnt)):
            return [(d[p + st * i:p + st * (i + 1)].split(b'\0')[0].decode('latin1'), b + offs[2 * i], offs[2 * i + 1]) for i in range(cnt)]
        for i in range(cnt):
            n = d[p:d.index(b'\0', p)].decode('latin1')
            names.append(n)
            p += 24 if len(n) < 24 else 16 * ((len(n) + 16) // 16)
    out = []
    for i in range(cnt):
        out.append((names[i] if i < len(names) else '', b + offs[2 * i], offs[2 * i + 1]))
    return out


def mat_mul_point(m, p):
    x, y, z = p
    return (x * m[0] + y * m[4] + z * m[8] + m[12], x * m[1] + y * m[5] + z * m[9] + m[13], x * m[2] + y * m[6] + z * m[10] + m[14])


def mat_mul_dir(m, n):
    x, y, z = n
    v = (x * m[0] + y * m[4] + z * m[8], x * m[1] + y * m[5] + z * m[9], x * m[2] + y * m[6] + z * m[10])
    s = (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) ** 0.5 or 1.0
    return (v[0] / s, v[1] / s, v[2] / s)


def mat4mul(a, b):
    """a then b (row vectors)"""
    return [sum(a[r * 4 + k] * b[k * 4 + c] for k in range(4)) for r in range(4) for c in range(4)]


class Zmb:
    def __init__(self, z):
        if z[:4] != b'ZMB ':
            raise ValueError('not a ZMB model')
        self.z = z

    def u32(self, o):
        return struct.unpack_from('>I', self.z, o)[0]

    def textures(self):
        o = self.u32(0x18)
        if not 0 < o < len(self.z) - 4:
            return []
        n = self.u32(o)
        p = o + 16
        if n > (len(self.z) - o) // 32 or n > 512:      # DDR II: u16 pictures, u16 names, u32 0, u32 offset
            n = struct.unpack_from('>H', self.z, o + 2)[0]
            p = self.u32(o + 8)
            if not 0 < p < len(self.z) or n > (len(self.z) - p) // 32:
                return []
        out = []
        for i in range(n):
            s = self.z[p:p + 32]
            out.append(s[:s.index(b'\0')].decode('latin1') if b'\0' in s else s.decode('latin1'))
            p += 32
        return out

    def materials(self):
        o = self.u32(0x1c)
        if not 0 < o < len(self.z) - 12:
            return []
        n, _, p = struct.unpack_from('>IfI', self.z, o)
        if n > 1024 or p + 0x38 * n > len(self.z):
            return []
        # records are 0x50 bytes in Hottest Party 2's stages, 0x38 in its characters, and either in
        # Hottest Party 3's stages: the texture lists are laid out one after another, so the record
        # whose list follows the first one's tells the size
        stride = 0x50
        if n > 1 and p + 0x18 + 0x50 + 4 <= len(self.z):
            n0, t0 = struct.unpack_from('>II', self.z, p + 0x14)
            for st in (0x38, 0x50):
                if struct.unpack_from('>I', self.z, p + st + 0x18)[0] == t0 + 4 * (n0 & 0xFFFF):
                    stride = st
                    break
        if p + stride * n > len(self.z):
            return []
        out = []
        for i in range(n):
            r = p + stride * i
            cr, cg, cb = struct.unpack_from('>3I', self.z, r)
            if cr > 255 or cg > 255:                     # Hottest Party 3: the colour is RGBA bytes
                cr, cg, cb = self.z[r], self.z[r + 1], self.z[r + 2]
            flags = self.z[r + 0x10:r + 0x14]
            ntex, toff = struct.unpack_from('>II', self.z, r + 0x14)
            ntex &= 0xFFFF                               # (HP3 keeps a flag in the top byte)
            tex = [self.u32(toff + 4 * k) for k in range(min(ntex, 4))] if 0 < toff < len(self.z) else []
            m = dict(color=[min(cr, 255), min(cg, 255), min(cb, 255)], tex=tex, flags=list(flags),
                     raw=self.z[r:r + 48], stride=stride)
            if stride == 0x50:
                # DDR II: +32 / +36 texture scroll speeds, +48 / +52 the texture flipbook's frame times,
                # +58 / +60 texture-offset keys (see DDR2_SPEC.md: 0x801576fc, 0x8015713c)
                su, sv = struct.unpack_from('>ff', self.z, r + 32)
                nt, to = struct.unpack_from('>II', self.z, r + 48)
                nk, ko = struct.unpack_from('>hI', self.z, r + 58)
                if 0 < toff < len(self.z) and ntex <= 256:
                    m['texall'] = [self.u32(toff + 4 * k) for k in range(ntex)]
                if 1 < nt <= 256 and 0 < to and to + 4 * nt <= len(self.z):
                    m['times'] = [self.u32(to + 4 * k) for k in range(nt)]
                if 0 < nk <= 64 and 0 < ko and ko + 16 * nk <= len(self.z):
                    m['keys'] = [list(struct.unpack_from('>3f', self.z, ko + 16 * k)) + [self.z[ko + 16 * k + 12], self.z[ko + 16 * k + 13]]
                                 for k in range(nk)]
                m['speed'] = [su, sv]
            out.append(m)
        return out

    def nodes(self):
        o = self.u32(0x20)
        if not 0 < o < len(self.z) - 12:
            return []
        n, _, p = struct.unpack_from('>IfI', self.z, o)
        if n > 4096 or p + 0xa0 * n > len(self.z):
            return []
        out = []
        for i in range(n):
            r = p + 0xa0 * i
            nm = self.z[r:r + 32]
            name = nm[:nm.index(b'\0')].decode('shift_jis', 'replace') if b'\0' in nm else ''
            m = list(struct.unpack_from('>16f', self.z, r + 0x30))
            parent = struct.unpack_from('>i', self.z, r + 0x94)[0]
            nm_, mo = struct.unpack_from('>II', self.z, r + 0x98)
            meshes = [mo + 0x40 * k for k in range(nm_)] if 0 < mo < len(self.z) and nm_ < 4096 else []
            out.append(dict(name=name, m=m, parent=parent, meshes=meshes))
        return out

    def mesh(self, r):
        z = self.z
        (mid, _, nf, npos, _, nnrm, nuv, ncol, fo, po, wo, no, uo, co) = struct.unpack_from('>14I', z, r)
        P = [struct.unpack_from('>3f', z, po + 12 * i) for i in range(npos)]
        N = [struct.unpack_from('>3f', z, no + 12 * i) for i in range(nnrm)] if no else []
        T = [struct.unpack_from('>2f', z, uo + 8 * i) for i in range(nuv)] if uo else []
        C = [tuple(z[co + 4 * i:co + 4 * i + 4]) for i in range(ncol)] if co else []
        faces = []
        p = fo
        for _ in range(nf):
            kind, nc = struct.unpack_from('>HH', z, p)
            lists = struct.unpack_from('>4I', z, p + 4)
            p += 20
            corners = []
            for k in range(nc):
                corners.append(tuple(self.u32(lst + 4 * k) if lst else 0 for lst in lists))
            faces.append(corners)
        return mid, P, N, T, C, faces


def strip(corners):
    """a ZMB face is a triangle strip (checked against the stored normals: every triangle of every stage
    and dancer model faces the same way as its corners' normals when read as a strip, about half do when
    read as a fan) -> its triangles, all wound the same way"""
    return [(corners[i], corners[i + 1], corners[i + 2]) if i % 2 == 0 else (corners[i + 1], corners[i], corners[i + 2])
            for i in range(len(corners) - 2)]


def zab(z):
    """a ZAB animation ('ZAB GC'): u32 node count at 0xc, length in frames (1/60 s) at 0x10, node list
    offset at 0x20. Each node: 0x40 bytes (32-byte name, then at +0x34 track count and at +0x3c the
    track list). Each track: kind (0 position, 1 rotation quaternion, 2 scale), key size, key count,
    offset; keys are (u32 frame, values...)"""
    if z[:4] != b'ZAB ':
        return None
    n, ln = struct.unpack_from('>II', z, 0xc)
    lo = struct.unpack_from('>I', z, 0x20)[0]
    nodes = {}
    for i in range(min(n, 4096)):
        r = lo + 0x40 * i
        if r + 0x40 > len(z):
            break
        nm = z[r:r + 32]
        name = nm[:nm.index(b'\0')].decode('latin1') if b'\0' in nm else nm.decode('latin1')
        nt, _, to = struct.unpack_from('>III', z, r + 0x34)
        tr = {}
        for k in range(min(nt, 8)):
            kind, ks, nk, ko = struct.unpack_from('>4I', z, to + 16 * k)
            nv = ks // 4 - 1
            if nv < 1 or ko + ks * nk > len(z):
                continue
            keys = []
            for j in range(min(nk, 20000)):
                f = struct.unpack_from('>I', z, ko + ks * j)[0]
                keys.append((f,) + struct.unpack_from('>%df' % nv, z, ko + ks * j + 4))
            tr[kind] = keys
        nodes[name] = tr
    return dict(len=ln, nodes=nodes)


def quat_euler(x, y, z, w):
    """a quaternion -> rotation in degrees about X, Y, Z for Rz.Ry.Rx (the renderer's order)"""
    import math
    m00 = 1 - 2 * (y * y + z * z)
    m10 = 2 * (x * y + z * w)
    m20 = 2 * (x * z - y * w)
    m21 = 2 * (y * z + x * w)
    m22 = 1 - 2 * (x * x + y * y)
    ry = math.asin(max(-1.0, min(1.0, -m20)))
    rx = math.atan2(m21, m22)
    rz = math.atan2(m10, m00)
    return [math.degrees(rx), math.degrees(ry), math.degrees(rz)]


def euler_track(R):
    """quaternion keys [(frame, x, y, z, w)] -> continuous X/Y/Z angle keys [(frame, [rx, ry, rz])]"""
    import math
    out, prev, qp = [], None, None
    for i, k in enumerate(R):
        q = list(k[1:5])
        samples = [(k[0], q)]
        if qp is not None:
            f0, a = R[i - 1][0], qp
            d = sum(x * y for x, y in zip(a, q))
            if d < 0:                                   # the shorter way round
                q = [-v for v in q]; d = -d
            ang = 2 * math.degrees(math.acos(max(-1.0, min(1.0, d))))
            n = max(1, int(math.ceil(ang / 10)))
            samples = []
            th = math.acos(max(-1.0, min(1.0, d)))
            for j in range(1, n + 1):
                t = j / n
                if th < 1e-6:
                    v = [x + (y - x) * t for x, y in zip(a, q)]
                else:
                    s0, s1 = math.sin((1 - t) * th) / math.sin(th), math.sin(t * th) / math.sin(th)
                    v = [x * s0 + y * s1 for x, y in zip(a, q)]
                samples.append((f0 + (k[0] - f0) * t, v))
        qp = q
        for f, v in samples:
            e1 = quat_euler(*v)
            e2 = [e1[0] + 180, 180 - e1[1], e1[2] + 180]
            best = None
            for e in (e1, e2):
                e = list(e)
                if prev is not None:
                    for c in range(3):
                        e[c] += 360 * round((prev[c] - e[c]) / 360)
                cost = sum(abs(e[c] - prev[c]) for c in range(3)) if prev is not None else (0 if e is e1 else 1)
                if best is None or cost < best[0]:
                    best = (cost, e)
            prev = best[1]
            out.append((round(f, 3), [round(x, 4) for x in prev]))
    return out


def model(z, tpl_data, tpl_off, anim=None, ddr2=False):
    """one ZMB model and its textures -> the renderer's model dict"""
    m = Zmb(z)
    tex_names = m.textures()
    mats = m.materials()
    nodes = m.nodes()
    # world matrix of each node (parents first)
    world = {}

    def wm(i):
        if i in world:
            return world[i]
        nd = nodes[i]
        w = nd['m']
        if 0 <= nd['parent'] < len(nodes) and nd['parent'] != i:
            w = mat4mul(w, wm(nd['parent']))
        world[i] = w
        return w
    groups = {}
    moving = {}                                          # node index -> its own groups (animated nodes)
    an = (anim or {}).get('nodes', {})
    skin_of = {}                                         # skinning node index -> slot (0-3)
    for i, nd in enumerate(nodes):
        live = nd['name'] in an and nd['meshes']
        W = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] if live else wm(i)
        for r in nd['meshes']:
            try:
                mid, P, N, T, C, faces = m.mesh(r)
            except struct.error:
                continue
            g = (moving.setdefault(i, {}) if live else groups).setdefault(mid, ([], [], [], [], [], []))
            # skinned parts (the boss tunnel, bound to Dummy01-03): per position, (count, offset) at the
            # mesh's +0x28 -> 64-byte entries (32-byte node name, +56 node index, +60 weight); only for
            # nodes the stage's ZAB moves
            sk = None
            if ddr2 and an:
                try:
                    wo = struct.unpack_from('>I', z, r + 0x28)[0]
                    if wo:
                        sk = []
                        for pi0 in range(len(P)):
                            n_, o_ = struct.unpack_from('>II', z, wo + 8 * pi0)
                            ws = []
                            for k in range(min(n_, 4)):
                                ni_, w_ = struct.unpack_from('>If', z, o_ + 64 * k + 56)
                                if 0 <= ni_ < len(nodes) and nodes[ni_]['name'] in an:
                                    if ni_ not in skin_of and len(skin_of) < 4:
                                        skin_of[ni_] = len(skin_of)
                                    if ni_ in skin_of:
                                        ws.append((skin_of[ni_], w_))
                            sk.append(ws)
                        if not any(sk):
                            sk = None
                except struct.error:
                    sk = None
            for corners in faces:
                for tri in strip(corners):                     # each face is a triangle strip
                    for pi, ni, ci, ti in tri:                 # position, normal, colour, uv
                        ws = (sk[pi] if sk and pi < len(sk) else [])[:3]
                        ws = ws + [(0, 0.0)] * (3 - len(ws))
                        g[4].extend(j for j, _ in ws)
                        g[5].extend(w for _, w in ws)
                        g[0].extend(mat_mul_point(W, P[pi]) if pi < len(P) else (0, 0, 0))
                        g[1].extend(mat_mul_dir(W, N[ni]) if ni < len(N) else (0, 1, 0))
                        u, v = T[ti] if ti < len(T) else (0, 0)
                        g[2].extend((u, v))
                        g[3].extend(C[ci] if ci < len(C) else (255, 255, 255, 255))
    # textures: the TPL's pictures, in the order the model names them
    bitmaps = []
    if tpl_data is not None:
        for i, (w, h, fmt, off) in enumerate(hp2.tpl_list(tpl_data, tpl_off)):
            png = hp2.tpl_png(tpl_data, w, h, fmt, off)
            bitmaps.append(dict(name=tex_names[i] if i < len(tex_names) else '', w=w, h=h,
                                png=base64.b64encode(png).decode() if png else ''))
    for b in bitmaps if not ddr2 else []:               # monitor.tga left plain white: the stage's movie screen
        if b['name'].lower().startswith('monitor') and 'mask' not in b['name'].lower() and b.get('png') and _all_white(b['png']):
            b['screen'] = True
    # the video-screen rooms (STG103/104/107) also lay a strip of the screens' picture on the floor (a
    # plain white picture with no name of its own, UVs on the bottom band of the image, faded to black by
    # its vertex colours toward the middle): the screens' reflection
    if not ddr2 and any(b.get('screen') for b in bitmaps):
        for b in bitmaps:
            if not b['name'] and b.get('png') and _all_white(b['png']):
                b['screen'] = True
    attrs, out_mats = [], []
    for mt in mats:
        al = []
        if mt['tex'] and mt['tex'][0] < len(bitmaps) and bitmaps[mt['tex'][0]]['png']:
            attrs.append(dict(bitmap=mt['tex'][0], wrapS=1, wrapT=1))
            al = [len(attrs) - 1]
        b2 = mt['flags'][2] if len(mt['flags']) > 2 else 0
        om = dict(color=mt['color'], vtx=1, alpha=0.4 if b2 == 0x81 else 1.0, flags=16 if b2 == 0x81 else 0, attrs=al,
                  cut=0.5 if b2 == 0x83 else None, addAlpha=b2 == 0x81, blend=b2 in (1, 3))
        raw = mt.get('raw') or b''
        if ddr2 and len(raw) >= 32:
            # DDR II's material record, as main.dol's model renderer (0x8014fac8) uses it:
            # +0 material RGBA, +4 ambient RGBA, +16 lit, +18 blend kind (low 7 bits; bit 7: alpha test
            # at 0 instead of 160), +19 special shader, +31 texture scroll (see DDR2_SPEC.md)
            # +40 (s16) tag: 11-90 = light channel (tag - 11) // 10 (0x8004d77c); 91-100 = its textures show
            # the stage's movie (0x8004d91c -> 0x8014e8d0 replaces them with the movie player's picture)
            tag = struct.unpack_from('>h', raw, 40)[0] if len(raw) >= 42 else 0
            # the model loader (0x8014c6cc) sets the colours to white when byte +23 is set (the low byte of
            # the +20 light-mask word: 1 in nearly every stage material); otherwise, with the global flag
            # at r13-31336 set (1 in the Dolphin dumps), it scales them by 255 / 149
            if raw[23]:
                cm, ca = [255, 255, 255, 255], [255, 255, 255, 255]
            else:
                sc = lambda c: [min(255, int(v * 255 / 149)) for v in c[:3]] + [255]
                cm, ca = sc(raw[0:4]), sc(raw[4:8])
            om['gx'] = dict(mat=cm, amb=ca, lit=raw[16], kind=raw[18] & 0x7F,
                            a0=raw[18] >> 7, sh=raw[19], tag=tag, movie=1 if 91 <= tag <= 100 else 0)
            # the texture flipbook (0x801576fc): the shown texture is the first in the list whose frame
            # time is past the material's clock (60 a second, wrapped at the last time)
            ta, tt = mt.get('texall') or [], mt.get('times') or []
            if len(tt) > 1 and len(ta) >= len(tt) and all(t < len(bitmaps) for t in ta[:len(tt)]):
                fa = []
                for t in ta[:len(tt)]:
                    attrs.append(dict(bitmap=t, wrapS=1, wrapT=1))
                    fa.append(len(attrs) - 1)
                om['gx']['flip'] = dict(a=fa, t=tt)
            # the texture scroll (raw +31 set; 0x8015713c into the texture matrix 0x80157fe4 loads):
            # offset (-u speed, v speed) * 60 * seconds, or the +60 keys (time, u, v) when present
            if raw[31] and 'speed' in mt:
                ks = mt.get('keys')
                om['gx']['scroll'] = dict(speed=mt.get('speed') or [0, 0], keys=ks or None)
        out_mats.append(om)
    if not out_mats:                                     # effect placeholders with no materials: nothing to draw
        groups, moving = {}, {}

    def mesh_list(gs):
        out = []
        for mid, g in gs.items():
            if not g[0]:
                continue
            e = dict(mat=min(mid, max(0, len(out_mats) - 1)), n=len(g[0]) // 3, pos=b64f(g[0]), nrm=b64f(g[1]),
                     uv=b64f(g[2]), col=b64u8(g[3]))
            if skin_of and any(g[5]):
                e['sj'], e['sw'] = b64f(g[4]), b64f(g[5])
            out.append(e)
        return out
    objs = [dict(name='mesh%d' % mid, type=2, flags=0, parent=-1, pos=[0, 0, 0], rot=[0, 0, 0], scl=[1, 1, 1],
                 mesh=mesh_list({mid: g})) for mid, g in groups.items() if g[0]]
    # animated nodes: their own object, moved by the ZAB's position / rotation / scale keys
    tracks = []
    # (an animated node under another animated node - the island's tonearm: DRAW04_hari02 under
    # DRAW03_hari01 - moves with it; under a still node it gets that node's matrix as 'pre')
    obj_of = {ni: len(objs) + k for k, ni in enumerate(moving)}
    for i, gs in moving.items():
        name = nodes[i]['name']
        tr = an[name]
        T, R, Sc = tr.get(0) or [(0,) + tuple(nodes[i]['m'][12:15])], tr.get(1) or [(0, 0, 0, 0, 1)], tr.get(2) or [(0, 1, 1, 1)]
        pa = nodes[i]['parent']
        o = dict(name=name, type=2, flags=0, parent=obj_of.get(pa, -1), pos=list(T[0][1:4]), rot=quat_euler(*R[0][1:5]),
                 scl=list(Sc[0][1:4]), mesh=mesh_list(gs))
        if pa not in obj_of and 0 <= pa < len(nodes) and pa != i:
            pw = wm(pa)
            if any(abs(a - b) > 1e-6 for a, b in zip(pw, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])):
                o['pre'] = [round(v, 6) for v in pw]
        objs.append(o)
        def add(ch, keys):
            if len(keys) > 1 and len(set(round(v, 4) for _, v in keys)) > 1:
                tracks.append(dict(type=2, target=name, param=0, ch=ch, curve=1, keys=[x for k in keys for x in k]))
        for c in range(3):
            add(8 + c, [(k[0], k[1 + c]) for k in T])
            add(0x1f + c, [(k[0], k[1 + c]) for k in Sc])
        # the rotation keys are quaternions, played by the shortest turn between keys (a spinning part -
        # the boss island's record - turns past 180 between keys): sampled every 10 degrees or less, and
        # each sample's angles chosen from the two equivalent X/Y/Z sets to follow on from the last one
        eul = euler_track(R)
        for c in range(3):
            add(0x1c + c, [(f, e[c]) for f, e in eul])
    motion = dict(len=(anim or {}).get('len', 0), tracks=tracks) if tracks else None
    out = dict(objects=objs, materials=out_mats, attrs=attrs, bitmaps=bitmaps, motion=motion)
    if skin_of:
        # the skinning nodes and their parents: each one's own matrix in the file and the ZAB's position /
        # rotation / scale keys for it, parents first (vertex = sum of weight x node's world now x
        # inverse(its world in the file) x position)
        chain, order = {}, []

        def add_node(ni_):
            if ni_ in chain:
                return chain[ni_]
            pa = nodes[ni_]['parent']
            pk = add_node(pa) if 0 <= pa < len(nodes) and pa != ni_ else -1
            tr = an.get(nodes[ni_]['name'], {})
            chain[ni_] = len(order)
            order.append(dict(name=nodes[ni_]['name'], parent=pk, m=[round(v, 6) for v in nodes[ni_]['m']],
                              T=[list(k) for k in tr.get(0, [])], R=[list(k) for k in tr.get(1, [])],
                              S=[list(k) for k in tr.get(2, [])]))
            return chain[ni_]
        slots = [None] * len(skin_of)
        for ni_, slot in skin_of.items():
            slots[slot] = add_node(ni_)
        out['skin'] = dict(len=(anim or {}).get('len', 0), nodes=order, slots=slots)
    return out


def cameras(d, b):
    """the stage's camera moves (the '@@' blocks in the second part of the file): each block holds six
    tracks (key count, offset): 0 eye (t, x, y, z), 1 turn (t + 4 floats), 2 field of view (t, deg),
    3 the point looked at (t, x, y, z), 4 and 5 (t, value) - times in seconds"""
    out = []

    def walk(o):
        if d[o:o + 4] == b'WII\0':
            for nm, o2, s2 in wii_entries(d, o):
                walk(o2)
        elif d[o:o + 4] == b'@@\0\0' or struct.unpack_from('>f', d, o)[0] == 3.0:
            try:
                tr = [struct.unpack_from('>II', d, o + 4 + 8 * i) for i in range(6)]

                def keys(k, size):
                    n, off = tr[k]
                    return [list(struct.unpack_from('>%df' % (size // 4), d, o + off + size * j)) for j in range(min(n, 4096))]
                eye, fov, at = keys(0, 16), keys(2, 8), keys(3, 16)
                far = keys(5, 8)
                if eye and at:
                    ln = max(eye[-1][0], at[-1][0], 0.1)
                    out.append(dict(hp2=True, len=ln, eye=eye, at=at, fov=fov or [[0, 45]],
                                    far=max(1000.0, far[0][1]) if far else 100000.0))
            except struct.error:
                pass
    for nm, o, s in wii_entries(d, b):
        walk(o)
    return out


def _all_white(png):
    """is this picture plain white? (our own PNGs: RGBA, filter 0 on every row - see hp.png; no PIL,
    which the player's PC may not have)"""
    try:
        import base64
        import zlib
        raw = base64.b64decode(png) if isinstance(png, str) else png
        p, idat, w = 8, b'', 0
        while p + 8 <= len(raw):
            n = struct.unpack_from('>I', raw, p)[0]
            t = raw[p + 4:p + 8]
            if t == b'IHDR':
                w = struct.unpack_from('>I', raw, p + 8)[0]
            elif t == b'IDAT':
                idat += raw[p + 8:p + 8 + n]
            p += 12 + n
        px = zlib.decompress(idat)
        row = 1 + w * 4
        for y in range(len(px) // row):
            r = px[y * row + 1:(y + 1) * row]
            for i in range(0, len(r), 4):
                if r[i] < 250 or r[i + 1] < 250 or r[i + 2] < 250:
                    return False
        return w > 0
    except Exception:
        return False


def stage(path, ddr2=False):
    """every ZMB in the stage with its TPL -> {models, cameras, spots}"""
    d = open(path, 'rb').read()
    top = wii_entries(d)
    if not top:
        return dict(models=[], cameras=[], spots={})
    parts = wii_entries(d, top[0][1])
    models = []
    # DDR II names its parts: DRAW_ (the stage), BG_ (the background), COL_ (not drawn: it holds the
    # spots - EFF_, LIGPOS_, LIGTAR_, OBJSET_<prop>_nn), OBJA_ / OBJB_<x>_<prop>_<suffix> (props, drawn
    # at each OBJSET_<prop>_nn spot)
    objset = {}
    for name, off, size in parts:
        if d[off:off + 4] == b'ZMB ' and name.startswith('COL_'):
            try:
                nodes = Zmb(d[off:off + size]).nodes()
            except Exception:
                continue
            world = {}

            def wm(i):
                if i not in world:
                    nd = nodes[i]
                    w = nd['m']
                    if 0 <= nd['parent'] < len(nodes) and nd['parent'] != i:
                        w = mat4mul(w, wm(nd['parent']))
                    world[i] = w
                return world[i]
            for i, nd in enumerate(nodes):
                if nd['name'].startswith('OBJSET_'):
                    key = nd['name'][7:].rsplit('_', 1)[0]
                    objset.setdefault(key, []).append([round(v, 5) for v in wm(i)])
    for i, (name, off, size) in enumerate(parts):
        if d[off:off + 4] != b'ZMB ':
            continue
        if name.startswith('COL_'):
            continue
        inst = None
        if name.startswith(('OBJA_', 'OBJB_')):
            bits = name.split('_')
            inst = objset.get('_'.join(bits[2:-1])) if len(bits) > 3 else None   # (no spot: drawn where it is)
        tpl, anim = None, None
        for nm2, o2, s2 in parts[i + 1:i + 3]:          # its textures (and animation) come right after it
            if d[o2:o2 + 4] == b'\x00\x20\xaf\x30' and tpl is None:
                tpl = o2
            elif d[o2:o2 + 4] == b'ZAB ' and anim is None:
                try:
                    anim = zab(d[o2:o2 + s2])
                except struct.error:
                    anim = None
            elif d[o2:o2 + 4] == b'ZMB ':
                break
        try:
            md = model(d[off:off + size], d if tpl is not None else None, tpl or 0, anim, ddr2)
            md['name'] = name
            if inst:
                md['inst'] = inst
                # (a prop's plain white texture is where the game shows a movie: movieBox, pv screens)
                for b in md['bitmaps'] if not ddr2 else []:
                    if b.get('png') and _all_white(b['png']):
                        b['screen'] = True
            models.append(md)
        except (struct.error, ValueError, IndexError):
            continue
    cams = cameras(d, top[1][1]) if len(top) > 1 else []
    return dict(models=models, cameras=cams, spots={})


if __name__ == '__main__':
    import json
    import sys
    s = stage(sys.argv[1])
    for k, m in enumerate(s['models']):
        print('model', k, 'objects', len(m['objects']), 'tris', sum(g['n'] // 3 for o in m['objects'] for g in o['mesh']),
              'materials', len(m['materials']), 'textures', [(b['name'], b['w'], b['h'], bool(b['png'])) for b in m['bitmaps']])
    print('KB', len(json.dumps(s)) // 1024)


def ddr2_cameras(path):
    """DDR II's own gameplay camera moves (game/GAME_DEF_CAM.bin): three WII groups (86 / 48 / 22 moves).
    Each move: f32 length in seconds, then six tracks (key count, offset) laid out like HP2's '@@'
    blocks: 0 eye (t, x, y, z), 2 field of view (t, deg), 3 the point looked at (t, x, y, z).
    The game asks its camera manager for a move by code (main.dol 0x8005c540): 1xx/2xx/3xx a set one,
    700/800/900 a random one; here every move is available to the random pick."""
    d = open(path, 'rb').read()
    out = []
    for gi, (nm, go, gs) in enumerate(wii_entries(d)):
        if d[go:go + 4] != b'WII\0':
            continue
        for n2, o, s2 in wii_entries(d, go):
            try:
                ln = struct.unpack_from('>f', d, o)[0]
                tr = [struct.unpack_from('>II', d, o + 4 + 8 * i) for i in range(6)]

                def keys(k, size):
                    n, off = tr[k]
                    return [list(struct.unpack_from('>%df' % (size // 4), d, o + off + size * j)) for j in range(min(n, 4096))]
                eye, fov, at = keys(0, 16), keys(2, 8), keys(3, 16)
                if eye and at and 0.1 < ln < 60:
                    out.append(dict(hp2=True, ddr2=True, group=gi, len=ln, eye=eye, at=at, fov=fov or [[0, 60]], far=100000.0))
            except struct.error:
                pass
    return out


def intro_cameras(path):
    """the boss stage's opening camera moves: STGnnn's second WII entry, the STG201_CAM00_0n.cam moves
    (f32 length in seconds, then the same six tracks as GAME_DEF_CAM): 3 s + 4 s + 3 s, played in turn"""
    d = open(path, 'rb').read()
    top = wii_entries(d)
    if len(top) < 2:
        return []
    out = []
    for nm, o, s2 in wii_entries(d, top[1][1]):
        if d[o:o + 4] == b'WII\0' or s2 < 0x40:
            continue
        try:
            ln = struct.unpack_from('>f', d, o)[0]
            tr = [struct.unpack_from('>II', d, o + 4 + 8 * i) for i in range(6)]

            def keys(k, size):
                n, off = tr[k]
                return [list(struct.unpack_from('>%df' % (size // 4), d, o + off + size * j)) for j in range(min(n, 4096))]
            eye, fov, at = keys(0, 16), keys(2, 8), keys(3, 16)
            if eye and at and 0.1 < ln < 60:
                out.append(dict(hp2=True, ddr2=True, name=nm, len=ln, eye=eye, at=at, fov=fov or [[0, 45]]))
        except struct.error:
            pass
    return out


def appeal_cameras(path):
    """the combo performance's camera moves (game/GAME_APL_CAM0n.bin, n = the song's style + 1): ten
    moves in a WII container, one per combo motion (GAME_APL_MOT01's clips: types 0-4 x 2) - lengths
    1, 1, 2, 2, 3, 3, 3, 3, 1.67, 1.67 s, matching the clips' 60-180 frames; the same move format as
    GAME_DEF_CAM (f32 length, six tracks: 0 eye, 2 field of view, 3 the point looked at)"""
    d = open(path, 'rb').read()
    out = []
    for nm, o, s2 in wii_entries(d):
        try:
            ln = struct.unpack_from('>f', d, o)[0]
            tr = [struct.unpack_from('>II', d, o + 4 + 8 * i) for i in range(6)]

            def keys(k, size):
                n, off = tr[k]
                return [list(struct.unpack_from('>%df' % (size // 4), d, o + off + size * j)) for j in range(min(n, 4096))]
            eye, fov, at = keys(0, 16), keys(2, 8), keys(3, 16)
            out.append(dict(hp2=True, ddr2=True, len=ln, eye=eye, at=at, fov=fov or [[0, 45]], far=100000.0) if eye and at and 0.1 < ln < 60 else None)
        except struct.error:
            out.append(None)
    return out
