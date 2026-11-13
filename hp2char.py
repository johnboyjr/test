"""Hottest Party 2's dancers, for web/stage.js (the same shape hpchar.py gives for Hottest Party).

  files/character/CHRxy0.bin   a dancer: a WII container with two ZMB models
                                 0  the body: a 44-joint skeleton (Hips, legs, Spine, arms, fingers,
                                    Neck, Head, mii_head) and one skinned mesh node (n_01_body)
                                 1  the head: a rigid model (face, eyes, mouth) worn on mii_head
  files/character/CHRxyN.bin   outfit N of that dancer: two TPLs (body texture, head textures)
  files/motion/MOT010_SSQnnn.bin  song nnn's dance: ZAB clips that play one after another from the
                                 start of the song, 60 frames a second

Skin weights: each mesh's weight offset leads to one (count, offset) pair per position; each
influence is 0x40 bytes: a 32-byte joint name ... and the weight (f32) at +0x3c.
Positions are in model space (the bind pose), so the browser poses the skeleton and blends.
"""
import base64
import math
import os
import struct
from array import array

import hp2
import hp2stage as S
from hp2stage import Zmb, wii_entries, b64f, zab, quat_euler


def u16b64(v):
    return base64.b64encode(array('H', v).tobytes()).decode()


def mesh(z, r):
    """like Zmb.mesh, for character meshes: header word 1's high half = extra uv sets per corner"""
    Z = z.z
    (mid, kind, nf, npos, _, nnrm, nuv, ncol, fo, po, wo, no, uo, co) = struct.unpack_from('>14I', Z, r)
    extra = kind >> 16
    P = [struct.unpack_from('>3f', Z, po + 12 * i) for i in range(npos)]
    N = [struct.unpack_from('>3f', Z, no + 12 * i) for i in range(nnrm)] if no else []
    T = [struct.unpack_from('>2f', Z, uo + 8 * i) for i in range(nuv)] if uo else []
    C = [tuple(Z[co + 4 * i:co + 4 * i + 4]) for i in range(ncol)] if co else []
    faces, p = [], fo
    for _ in range(nf):
        k, nc = struct.unpack_from('>HH', Z, p)
        lists = struct.unpack_from('>%dI' % (4 + extra), Z, p + 4)
        p += 20 + 12 * extra                         # (extra uv set offset, then two zero words)
        faces.append([tuple(struct.unpack_from('>I', Z, lst + 4 * c)[0] if lst else 0 for lst in lists[:4])
                      for c in range(nc)])
    W = []
    if wo:
        for i in range(npos):
            cnt, off = struct.unpack_from('>II', Z, wo + 8 * i)
            inf = []
            for j in range(min(cnt, 8)):
                e = off + 0x40 * j
                nm = Z[e:e + 32]
                inf.append((nm[:nm.index(b'\0')].decode('latin1'), struct.unpack_from('>f', Z, e + 0x3c)[0]))
            W.append(inf)
    return mid, P, N, T, C, faces, W


def decompose(m):
    """a ZMB node matrix (row vectors, translation last) -> pos, rotation in degrees (Rz.Ry.Rx), scale"""
    s = [math.sqrt(m[4 * r] ** 2 + m[4 * r + 1] ** 2 + m[4 * r + 2] ** 2) or 1.0 for r in range(3)]
    R = [[m[4 * r + c] / s[r] for c in range(3)] for r in range(3)]      # R[r] = image of axis r
    m00, m10, m20 = R[0][0], R[0][1], R[0][2]
    m21, m22 = R[1][2], R[2][2]
    ry = math.asin(max(-1.0, min(1.0, -m20)))
    if abs(m20) < 0.9999:
        rx = math.atan2(m21, m22)
        rz = math.atan2(m10, m00)
    else:                                                    # gimbal lock: put it all in x
        rz = 0.0
        rx = math.atan2(-R[2][1], R[1][1])
    return [m[12], m[13], m[14]], [math.degrees(rx), math.degrees(ry), math.degrees(rz)], s


def pack4(ws):
    J, Wt = [], []
    for pairs in ws:
        pairs = sorted(pairs, key=lambda x: -x[1])[:4]
        t = sum(w for _, w in pairs) or 1.0
        pairs = [(j, w / t) for j, w in pairs] + [(0, 0.0)] * (4 - len(pairs))
        for j, w in pairs:
            J.append(j)
            Wt.append(w)
    return J, Wt


def _tpls(path):
    """an outfit file -> its TPLs as (data, offset)"""
    d = open(path, 'rb').read()
    return [(d, o) for _, o, _ in wii_entries(d)]


def _bitmaps(tpl, names):
    out = []
    if not tpl:
        return out
    d, off = tpl
    for i, (w, h, fmt, o) in enumerate(hp2.tpl_list(d, off)):
        png = hp2.tpl_png(d, w, h, fmt, o)
        out.append(dict(name=names[i] if i < len(names) else '', w=w, h=h,
                        png=base64.b64encode(png).decode() if png else ''))
    return out


def character(base, outfit=None):
    """CHRxy0.bin (+ an outfit CHRxyN.bin) -> {objects, meshes, materials, attrs, bitmaps}"""
    d = open(base, 'rb').read()
    es = wii_entries(d)
    body = Zmb(d[es[0][1]:es[0][1] + es[0][2]])
    head = Zmb(d[es[1][1]:es[1][1] + es[1][2]]) if len(es) > 1 else None
    tpls = _tpls(outfit) if outfit and os.path.isfile(outfit) else []

    nodes = body.nodes()
    index = {n['name']: i for i, n in enumerate(nodes)}
    world = {}

    def wm(i):
        if i not in world:
            w = nodes[i]['m']
            p = nodes[i]['parent']
            if 0 <= p < len(nodes) and p != i:
                w = S.mat4mul(w, wm(p))
            world[i] = w
        return world[i]
    objects = []
    for n in nodes:
        pos, rot, scl = decompose(n['m'])
        objects.append(dict(name=n['name'], type=2 if n['meshes'] else 0, parent=n['parent'], pos=pos, rot=rot, scl=scl))

    # textures: body pictures, then head pictures; attrs = one per picture
    bitmaps = _bitmaps(tpls[0] if tpls else None, body.textures())
    nb = len(bitmaps)
    bitmaps += _bitmaps(tpls[1] if len(tpls) > 1 else None, head.textures() if head else [])
    attrs = [dict(bitmap=i, wrapS=1, wrapT=1) for i in range(len(bitmaps))]
    materials = []

    def mats_of(model):
        """character materials: 0x38-byte records (RGBA bytes x3, f32, 4 flag bytes, texture count,
        offset of the texture index list)"""
        Z = model.z
        o = model.u32(0x1c)
        n, _, p = struct.unpack_from('>IfI', Z, o)
        out = []
        for i in range(min(n, 64)):
            r = p + 0x38 * i
            nt, to = struct.unpack_from('>II', Z, r + 0x14)
            out.append(dict(flags=list(Z[r + 0x10:r + 0x14]),
                            tex=[model.u32(to + 4 * k) for k in range(min(nt, 4))] if 0 < to < len(Z) else []))
        return out
    mtab = {id(body): mats_of(body), id(head): mats_of(head) if head else []}

    def mat_for(model, mid, base_tex, layer=None):
        ms = mtab[id(model)]
        mt = ms[mid] if mid < len(ms) else None
        tex = mt['tex'][0] if mt and mt['tex'] else None
        if layer:                                    # the head's eyes / mouth: picked at run time (blinks)
            tex = next((i for i, t in enumerate(head.textures()) if layer in t), tex)
        a = base_tex + tex if tex is not None and base_tex + tex < len(bitmaps) and bitmaps[base_tex + tex]['png'] else None
        b2 = mt['flags'][2] if mt and len(mt['flags']) > 2 else 0
        materials.append(dict(color=[255, 255, 255], vtx=1, alpha=1.0, flags=0, attrs=[a] if a is not None else [],
                              cut=0.5 if (b2 == 3 or layer) else None))
        return len(materials) - 1

    meshes = []

    def build(model, node_index, rows, base_tex, rigid_joint=None, place=None):
        for r in rows:
            try:
                mid, P, N, T, C, faces, W = mesh(model, r)
            except struct.error:
                continue
            if place:
                P = [S.mat_mul_point(place, p) for p in P]
                N = [S.mat_mul_dir(place, n) for n in N]
            layer = {1: 'eye01', 2: 'mouth01'}.get(mid) if model is head else None   # eyes, mouth (front of the face)
            mat = mat_for(model, mid, base_tex, layer)
            pi, ni, uv, col = [], [], [], []
            nw = [[] for _ in N]
            for corners in faces:
                for a in range(1, len(corners) - 1):
                    for p, n, c, t in (corners[0], corners[a], corners[a + 1]):
                        pi.append(p if p < len(P) else 0)
                        ni.append(n if n < len(N) else 0)
                        uv.extend(T[t] if t < len(T) else (0, 0))
                        col.extend(C[c] if c < len(C) else (255, 255, 255, 255))
                        if W and p < len(W) and n < len(N) and not nw[n]:
                            nw[n] = W[p]
            if not pi:
                continue
            m = dict(obj=node_index, nv=len(P), nn=len(N), pos=b64f([x for v in P for x in v]),
                     nrm=b64f([x for v in N for x in v]),
                     groups=[dict(mat=mat, n=len(pi), pi=u16b64(pi), ni=u16b64(ni), uv=b64f(uv),
                                  col=base64.b64encode(bytes(col)).decode())])
            if W:
                vw = [[(index.get(nm, 0), w) for nm, w in inf] for inf in W]
                nww = [[(index.get(nm, 0), w) for nm, w in inf] or [(0, 1.0)] for inf in nw]
            else:
                vw = [[(rigid_joint, 1.0)]] * len(P)
                nww = [[(rigid_joint, 1.0)]] * len(N)
            vj, vwt = pack4(vw)
            nj, nwt = pack4(nww)
            m.update(vj=u16b64(vj), vw=b64f(vwt), nj=u16b64(nj), nw=b64f(nwt))
            meshes.append(m)

    for i, n in enumerate(nodes):
        if n['meshes']:
            build(body, i, n['meshes'], 0, rigid_joint=i)
    if head:
        mj = index.get('mii_head', index.get('Head', 0))
        for n in head.nodes():
            if n['meshes']:
                build(head, mj, n['meshes'], nb, rigid_joint=mj, place=S.mat4mul(n['m'], wm(mj)))
    return dict(objects=objects, meshes=meshes, materials=materials, attrs=attrs, bitmaps=bitmaps)


def dance(path, bpm, fps=30):
    """a song's MOT010_SSQnnn.bin -> {clips, timeline, perMeasure} for stage.js: the clips play one
    after another from the start of the song, in real time (60 frames a second in the file)"""
    d = open(path, 'rb').read()
    clips, tl, at = {}, [], 0.0
    per_measure = fps * 240.0 / (bpm or 120)                 # samples per measure at this tempo
    for k, (_, o, sz) in enumerate(wii_entries(d)):
        a = zab(d[o:o + sz])
        if not a or not a['len']:
            continue
        n = int(a['len'] * fps / 60) + 1
        tracks = {}
        for name, tr in a['nodes'].items():
            chs = {}
            T, R = tr.get(0), tr.get(1)
            if T:
                for c, ch in enumerate(('px', 'py', 'pz')):
                    chs[ch] = b64f([_lin(T, i * 60.0 / fps, c) for i in range(n)])
            if R:
                eul = [quat_euler(*_slerp(R, i * 60.0 / fps)) for i in range(n)]
                for c, ch in enumerate(('rx', 'ry', 'rz')):
                    vals, prev = [], None
                    for e in eul:
                        v = e[c]
                        if prev is not None:
                            while v - prev > 180:
                                v -= 360
                            while v - prev < -180:
                                v += 360
                        vals.append(v)
                        prev = v
                    chs[ch] = b64f(vals)
            if chs:
                tracks[name] = chs
        clips[k] = dict(frames=n, tracks=tracks)
        tl.append([at, k, k])
        at += (a['len'] / 60.0) * (bpm or 120) / 240.0       # its length in measures
    return dict(fps=fps, perMeasure=per_measure, clips=clips, timeline=tl, cameras=[])


def _seg(keys, f):
    if f <= keys[0][0]:
        return keys[0], keys[0], 0.0
    if f >= keys[-1][0]:
        return keys[-1], keys[-1], 0.0
    lo, hi = 0, len(keys) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if keys[mid][0] <= f:
            lo = mid
        else:
            hi = mid
    a, b = keys[lo], keys[hi]
    return a, b, (f - a[0]) / ((b[0] - a[0]) or 1)


def _lin(keys, f, c):
    a, b, u = _seg(keys, f)
    return a[1 + c] + (b[1 + c] - a[1 + c]) * u


def _slerp(keys, f):
    a, b, u = _seg(keys, f)
    qa, qb = a[1:5], b[1:5]
    dot = sum(x * y for x, y in zip(qa, qb))
    if dot < 0:
        qb, dot = [-x for x in qb], -dot
    if dot > 0.9995:
        q = [x + (y - x) * u for x, y in zip(qa, qb)]
    else:
        th = math.acos(dot)
        s = math.sin(th)
        wa, wb = math.sin((1 - u) * th) / s, math.sin(u * th) / s
        q = [x * wa + y * wb for x, y in zip(qa, qb)]
    l = math.sqrt(sum(x * x for x in q)) or 1.0
    return [x / l for x in q]


if __name__ == '__main__':
    import json, sys, time
    t = time.time()
    c = character(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print(len(c['objects']), 'joints', len(c['meshes']), 'meshes', len(c['bitmaps']), 'pictures',
          len(json.dumps(c)) // 1024, 'KB', round(time.time() - t, 2), 's')
