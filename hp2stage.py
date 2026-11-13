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
        if n > (len(self.z) - o) // 32 or n > 512:      # not a texture table
            return []
        p = o + 16
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
            out.append(dict(color=[min(cr, 255), min(cg, 255), min(cb, 255)], tex=tex, flags=list(flags)))
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


def model(z, tpl_data, tpl_off, anim=None):
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
    for i, nd in enumerate(nodes):
        if nd['name'].startswith('OBJB_Z'):              # a box where the dancer stands: not drawn
            continue
        live = nd['name'] in an and nd['meshes']
        W = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] if live else wm(i)
        for r in nd['meshes']:
            try:
                mid, P, N, T, C, faces = m.mesh(r)
            except struct.error:
                continue
            g = (moving.setdefault(i, {}) if live else groups).setdefault(mid, ([], [], [], []))
            for corners in faces:
                for a in range(1, len(corners) - 1):           # a fan over the polygon
                    for pi, ni, ci, ti in (corners[0], corners[a], corners[a + 1]):     # position, normal, colour, uv
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
    attrs, out_mats = [], []
    for mt in mats:
        al = []
        if mt['tex'] and mt['tex'][0] < len(bitmaps) and bitmaps[mt['tex'][0]]['png']:
            attrs.append(dict(bitmap=mt['tex'][0], wrapS=1, wrapT=1))
            al = [len(attrs) - 1]
        b2 = mt['flags'][2] if len(mt['flags']) > 2 else 0
        # (0x81 / 0x83 parts are see-through: drawn blended by their texture's alpha)
        # 0x83: cut-out (alpha-tested, writes depth); 0x81: a glow, added by its texture's alpha
        out_mats.append(dict(color=mt['color'], vtx=1, alpha=0.4 if b2 == 0x81 else 1.0, flags=16 if b2 == 0x81 else 0, attrs=al,
                             cut=0.5 if b2 == 0x83 else None, addAlpha=b2 == 0x81))
    if not out_mats:                                     # effect placeholders with no materials: nothing to draw
        groups, moving = {}, {}

    def mesh_list(gs):
        return [dict(mat=min(mid, max(0, len(out_mats) - 1)), n=len(g[0]) // 3, pos=b64f(g[0]), nrm=b64f(g[1]),
                     uv=b64f(g[2]), col=b64u8(g[3])) for mid, g in gs.items() if g[0]]
    objs = [dict(name='mesh%d' % mid, type=2, flags=0, parent=-1, pos=[0, 0, 0], rot=[0, 0, 0], scl=[1, 1, 1],
                 mesh=mesh_list({mid: g})) for mid, g in groups.items() if g[0]]
    # animated nodes: their own object, moved by the ZAB's position / rotation / scale keys
    tracks = []
    for i, gs in moving.items():
        name = nodes[i]['name']
        tr = an[name]
        T, R, Sc = tr.get(0) or [(0, 0, 0, 0)], tr.get(1) or [(0, 0, 0, 0, 1)], tr.get(2) or [(0, 1, 1, 1)]
        objs.append(dict(name=name, type=2, flags=0, parent=-1, pos=list(T[0][1:4]), rot=quat_euler(*R[0][1:5]),
                         scl=list(Sc[0][1:4]), mesh=mesh_list(gs)))
        def add(ch, keys):
            if len(keys) > 1 and len(set(round(v, 4) for _, v in keys)) > 1:
                tracks.append(dict(type=2, target=name, param=0, ch=ch, curve=1, keys=[x for k in keys for x in k]))
        for c in range(3):
            add(8 + c, [(k[0], k[1 + c]) for k in T])
            add(0x1f + c, [(k[0], k[1 + c]) for k in Sc])
        eul = [(k[0], quat_euler(*k[1:5])) for k in R]
        for c in range(3):                               # keep the angles continuous across +-180
            keys, prev = [], None
            for f, e in eul:
                v = e[c]
                if prev is not None:
                    while v - prev > 180:
                        v -= 360
                    while v - prev < -180:
                        v += 360
                keys.append((f, v)); prev = v
            add(0x1c + c, keys)
    motion = dict(len=(anim or {}).get('len', 0), tracks=tracks) if tracks else None
    return dict(objects=objs, materials=out_mats, attrs=attrs, bitmaps=bitmaps, motion=motion)


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


def stage(path):
    """every ZMB in the stage with its TPL -> {models, cameras, spots}"""
    d = open(path, 'rb').read()
    top = wii_entries(d)
    if not top:
        return dict(models=[], cameras=[], spots={})
    parts = wii_entries(d, top[0][1])
    models = []
    for i, (name, off, size) in enumerate(parts):
        if d[off:off + 4] != b'ZMB ':
            continue
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
            models.append(model(d[off:off + size], d if tpl is not None else None, tpl or 0, anim))
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
