"""DDR II's own dancers, read from your disc and handed to web/dancer.js as a glTF (.glb) model.

  sound/stream/character/CHRnnn00.bin   a dancer (nnn = 201...): the same models as Hottest Party 2
                                        (a skinned body ZMB with a 46-joint skeleton + a head ZMB)
  sound/stream/character/CHRnnnvv.bin   its outfits (vv = 01, 02...): two TPLs (body, head)

hp2char.py reads the models; this file only repacks them as a binary glTF, so the dancer screen's
existing "your own model" path (bone names, retargeting to the dance) shows them unchanged.
Nothing from the disc is stored: the model is built when the game asks for it.
"""
import base64
import json
import math
import os
import re
import struct

import hp2char

DIR = ('sound', 'stream', 'character')


def folder(files):
    return os.path.join(files, *DIR)


def dancers(files):
    """-> [{id: 'nnn', outfits: [1, 2, ...]}] for every CHRnnn00.bin with at least one outfit"""
    d = folder(files)
    if not os.path.isdir(d):
        return []
    names = set(f.upper() for f in os.listdir(d))
    out = []
    for f in sorted(names):
        m = re.match(r'^CHR(\d{3})00\.BIN$', f)
        if m:
            outfits = [v for v in range(1, 25) if 'CHR%s%02d.BIN' % (m.group(1), v) in names]
            if outfits:
                out.append(dict(id=m.group(1), outfits=outfits))
    return out


def _path(files, name):
    d = folder(files)
    hit = next((f for f in os.listdir(d) if f.upper() == name.upper()), None) if os.path.isdir(d) else None
    return os.path.join(d, hit) if hit else None


def _quat(rx, ry, rz):
    """degrees, applied as Rz.Ry.Rx (hp2char's order) -> glTF quaternion [x, y, z, w]"""
    hx, hy, hz = (math.radians(a) / 2 for a in (rx, ry, rz))
    cx, sx, cy, sy, cz, sz = math.cos(hx), math.sin(hx), math.cos(hy), math.sin(hy), math.cos(hz), math.sin(hz)
    # qz * qy * qx
    return [sx * cy * cz - cx * sy * sz,
            cx * sy * cz + sx * cy * sz,
            cx * cy * sz - sx * sy * cz,
            cx * cy * cz + sx * sy * sz]


def _trs(p, r, s):
    """column-major 4x4 like stage.js M.trs"""
    d = math.pi / 180
    cx, sx, cy, sy, cz, sz = math.cos(r[0] * d), math.sin(r[0] * d), math.cos(r[1] * d), math.sin(r[1] * d), math.cos(r[2] * d), math.sin(r[2] * d)
    m00, m01, m02 = cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz
    m10, m11, m12 = cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz
    m20, m21, m22 = -sy, sx * cy, cx * cy
    return [m00 * s[0], m10 * s[0], m20 * s[0], 0, m01 * s[1], m11 * s[1], m21 * s[1], 0,
            m02 * s[2], m12 * s[2], m22 * s[2], 0, p[0], p[1], p[2], 1]


def _mul(a, b):
    return [sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4)) for c in range(4) for r in range(4)]


def _inv(m):
    """inverse of an affine column-major 4x4"""
    a = [[m[c * 4 + r] for c in range(3)] for r in range(3)]
    det = (a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0])
           + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])) or 1e-12
    inv = [[(a[(j + 1) % 3][(i + 1) % 3] * a[(j + 2) % 3][(i + 2) % 3] - a[(j + 1) % 3][(i + 2) % 3] * a[(j + 2) % 3][(i + 1) % 3]) / det
            for j in range(3)] for i in range(3)]
    t = [m[12], m[13], m[14]]
    it = [-sum(inv[r][k] * t[k] for k in range(3)) for r in range(3)]
    return [inv[0][0], inv[1][0], inv[2][0], 0, inv[0][1], inv[1][1], inv[2][1], 0,
            inv[0][2], inv[1][2], inv[2][2], 0, it[0], it[1], it[2], 1]


def glb(files, cid, outfit):
    """CHR<cid>00 + CHR<cid><outfit> -> binary glTF bytes (or None)"""
    base = _path(files, 'CHR%s00.bin' % cid)
    var = _path(files, 'CHR%s%02d.bin' % (cid, int(outfit)))
    if not base:
        return None
    c = hp2char.character(base, var)
    return to_glb(c)


def to_glb(c):
    objs = c['objects']
    bin_ = bytearray()
    views, accs = [], []

    def view(data, target=None):
        while len(bin_) % 4:
            bin_.append(0)
        views.append(dict(buffer=0, byteOffset=len(bin_), byteLength=len(data), **({'target': target} if target else {})))
        bin_.extend(data)
        return len(views) - 1

    def acc(vals, ctype, typ, n, target=None, minmax=False):
        fmt = {5126: 'f', 5123: 'H', 5121: 'B'}[ctype]
        v = view(struct.pack('<%d%s' % (len(vals), fmt), *vals), target)
        a = dict(bufferView=v, componentType=ctype, count=len(vals) // n, type=typ)
        if minmax and vals:
            a['min'] = [min(vals[k::n]) for k in range(n)]
            a['max'] = [max(vals[k::n]) for k in range(n)]
        accs.append(a)
        return len(accs) - 1

    # skeleton: every body node is a joint
    nodes = []
    for o in objs:
        nodes.append(dict(name=o['name'], translation=list(o['pos']), rotation=_quat(*o['rot']), scale=list(o['scl'])))
    kids = {}
    for i, o in enumerate(objs):
        if 0 <= o['parent'] < len(objs) and o['parent'] != i:
            kids.setdefault(o['parent'], []).append(i)
    for p, ks in kids.items():
        nodes[p]['children'] = ks
    roots = [i for i, o in enumerate(objs) if not (0 <= o['parent'] < len(objs)) or o['parent'] == i]
    world = {}

    def wm(i):
        if i not in world:
            o = objs[i]
            m = _trs(o['pos'], o['rot'], o['scl'])
            p = o['parent']
            world[i] = _mul(wm(p), m) if 0 <= p < len(objs) and p != i else m
        return world[i]
    ibm = [x for i in range(len(objs)) for x in _inv(wm(i))]
    skin = dict(joints=list(range(len(objs))), inverseBindMatrices=acc(ibm, 5126, 'MAT4', 16), skeleton=roots[0] if roots else 0)

    # textures and materials
    images, textures = [], []
    for b in c['bitmaps']:
        if b['png']:
            images.append(dict(bufferView=view(base64.b64decode(b['png'])), mimeType='image/png'))
            textures.append(dict(source=len(images) - 1, sampler=0))
        else:
            textures.append(None)
    tex_index, real = {}, []
    for i, t in enumerate(textures):
        if t:
            tex_index[i] = len(real)
            real.append(t)
    mats = []
    for m in c['materials']:
        md = dict(pbrMetallicRoughness=dict(baseColorFactor=[1, 1, 1, 1], metallicFactor=0, roughnessFactor=1), doubleSided=True)
        if m['attrs']:
            bm = c['attrs'][m['attrs'][0]]['bitmap']
            if bm in tex_index:
                md['pbrMetallicRoughness']['baseColorTexture'] = dict(index=tex_index[bm])
        if m.get('cut'):
            md['alphaMode'] = 'MASK'
            md['alphaCutoff'] = m['cut']
        mats.append(md)

    # meshes: un-indexed per material group (positions, normals and uvs have their own indices)
    prims = []
    for m in c['meshes']:
        P, N = _floats(m['pos']), _floats(m['nrm'])
        VJ, VW = _u16(m['vj']), _floats(m['vw'])
        for g in m['groups']:
            pi, ni, uv = _u16(g['pi']), _u16(g['ni']), _floats(g['uv'])
            pos, nrm, jj, ww = [], [], [], []
            for k in range(g['n']):
                p, n = pi[k], ni[k]
                pos.extend(P[p * 3:p * 3 + 3])
                nv = N[n * 3:n * 3 + 3] if n * 3 + 3 <= len(N) else (0.0, 1.0, 0.0)
                l = math.sqrt(sum(x * x for x in nv)) or 1.0
                nrm.extend(x / l for x in nv)
                jj.extend(VJ[p * 4:p * 4 + 4])
                ww.extend(VW[p * 4:p * 4 + 4])
            if not pos:
                continue
            prim = dict(attributes=dict(POSITION=acc(pos, 5126, 'VEC3', 3, 34962, True), NORMAL=acc(nrm, 5126, 'VEC3', 3, 34962),
                                        TEXCOORD_0=acc(list(uv), 5126, 'VEC2', 2, 34962),
                                        JOINTS_0=acc(jj, 5123, 'VEC4', 4, 34962), WEIGHTS_0=acc(ww, 5126, 'VEC4', 4, 34962)),
                        material=g['mat'])
            prims.append(prim)
    mesh_node = len(nodes)
    nodes.append(dict(name='dancer', mesh=0, skin=0))
    doc = dict(asset=dict(version='2.0', generator='DDR II PC'), scene=0,
               scenes=[dict(nodes=roots + [mesh_node])], nodes=nodes, skins=[skin],
               meshes=[dict(primitives=prims)], materials=mats, images=images, textures=real,
               samplers=[dict(wrapS=10497, wrapT=10497)], accessors=accs, bufferViews=views,
               buffers=[dict(byteLength=len(bin_))])
    js = json.dumps(doc).encode()
    js += b' ' * (-len(js) % 4)
    bin_ += b'\0' * (-len(bin_) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js
    out += struct.pack('<II', len(bin_), 0x004E4942) + bytes(bin_)
    return out


def _swap(b):
    return b


def _floats(s):
    b = base64.b64decode(s)
    return struct.unpack('=%df' % (len(b) // 4), b)


def _u16(s):
    b = base64.b64decode(s)
    return struct.unpack('=%dH' % (len(b) // 2), b)


if __name__ == '__main__':
    import sys
    files, cid, outfit = sys.argv[1], sys.argv[2], sys.argv[3]
    print(dancers(files))
    g = glb(files, cid, outfit)
    print(len(g) if g else None)
