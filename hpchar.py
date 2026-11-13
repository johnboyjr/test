"""Hottest Party's dancers, for web/stage.js.

  files/data/c_NNN.bin     a character: a skinned HSF model (skeleton + 'envelopes' that tie each vertex
                           to one, two or several joints) and its textures
  files/data/c_000_NN.bin  song NN's dance: a copy of the chart, two camera paths for the whole song,
                           then the dance itself in parts that play one after another from the start

The model's vertices are turned into per-vertex joint weights (up to 4) and the dance is resampled to
30 frames a second, so the browser only has to pose the skeleton and blend.
"""
import base64, struct
from array import array
from hpstage import Hsf, entries, b64f

JOINT_CH = {0x1c: 'rx', 0x1d: 'ry', 0x1e: 'rz', 0x08: 'px', 0x09: 'py', 0x0a: 'pz'}


def weights(h, k, nverts, nnrms):
    """envelope set k (one per vertex buffer) -> per vertex [(joint, weight)...] and the same for normals"""
    u = h.u
    co, cc = h.sec['cenv']
    vw = [[] for _ in range(nverts)]
    nw = [[] for _ in range(nnrms)]

    def put(lst, start, cnt, pairs):
        for i in range(start, min(start + cnt, len(lst))):
            lst[i] = list(pairs)
    b = co + 36 * k
    name, sd, dd, md, sc, dc, mc, vc, cpc = struct.unpack_from('>9I', u, b)
    base = co + 36 * cc
    # the weight lists come after every set's tables
    wbase = base + max(struct.unpack_from('>I', u, co + 36 * j + 12)[0] + 16 * struct.unpack_from('>I', u, co + 36 * j + 24)[0]
                       for j in range(cc))
    for i in range(sc):
        tgt, p, pc, n, ncnt = struct.unpack_from('>IHHHH', u, base + sd + 12 * i)
        put(vw, p, pc, [(tgt, 1.0)])
        put(nw, n, ncnt, [(tgt, 1.0)])
    for i in range(dc):
        t1, t2, wc, wo = struct.unpack_from('>IIII', u, base + dd + 16 * i)
        for j in range(wc):
            w, p, pc, n, ncnt = struct.unpack_from('>fHHHH', u, wbase + wo + 12 * j)
            put(vw, p, pc, [(t1, w), (t2, 1 - w)])
            put(nw, n, ncnt, [(t1, w), (t2, 1 - w)])
    for i in range(mc):
        wc, p, pc, n, ncnt, wo = struct.unpack_from('>IHHHHI', u, base + md + 16 * i)
        pairs = [struct.unpack_from('>If', u, wbase + wo + 8 * j) for j in range(wc)]
        put(vw, p, pc, pairs)
        put(nw, n, ncnt, pairs)
    return vw, nw


def pack4(ws):
    """[(joint, w)...] per vertex -> flat joints (4 per vertex) and weights (4 per vertex)"""
    J, W = [], []
    for pairs in ws:
        pairs = sorted(pairs, key=lambda x: -x[1])[:4]
        s = sum(w for j, w in pairs) or 1.0
        pairs = [(j, w / s) for j, w in pairs] + [(0, 0.0)] * (4 - len(pairs))
        for j, w in pairs:
            J.append(j)
            W.append(w)
    return J, W


def character(path):
    u = entries(open(path, 'rb').read())[0]
    h = Hsf(u)
    objs = h.objects()
    verts = h.buffers('vertex', '>3f', 12)
    nrms = h.buffers('normal', '>3f', 12) if h.sec['cenv'][1] else \
        [[(a / 127.0, b / 127.0, c / 127.0) for a, b, c in buf] for buf in h.buffers('normal', '>3b', 3)]
    sts = h.buffers('st', '>2f', 8)
    cols = h.buffers('color', '>4B', 4)
    fcs = h.faces()
    mats, attrs = h.materials()
    meshes = []
    for o in objs:
        if o['type'] != 2 or not (0 <= o['face'] < len(fcs)) or not (0 <= o['vert'] < len(verts)):
            continue
        V, N = verts[o['vert']], nrms[o['nrm']] if 0 <= o['nrm'] < len(nrms) else []
        T = sts[o['st']] if 0 <= o['st'] < len(sts) else []
        C = cols[o['col']] if 0 <= o['col'] < len(cols) else []
        groups = {}
        for t, mat, idx in fcs[o['face']]:
            if t == 2:
                tris = [(idx[0], idx[1], idx[2])]
            elif t == 3:
                tris = [(idx[0], idx[1], idx[2]), (idx[1], idx[3], idx[2])]
            else:
                tris = [(idx[j], idx[j + 1], idx[j + 2]) if j % 2 == 0 else (idx[j + 1], idx[j], idx[j + 2]) for j in range(len(idx) - 2)]
            g = groups.setdefault(mat, ([], [], [], []))
            for tri in tris:
                for pi, ni, ci, ti in tri:
                    g[0].append(pi if 0 <= pi < len(V) else 0)
                    g[1].append(ni if 0 <= ni < len(N) else 0)
                    g[2].extend(T[ti] if 0 <= ti < len(T) else (0, 0))
                    g[3].extend(C[ci] if 0 <= ci < len(C) else (255, 255, 255, 255))
        meshes.append(dict(obj=objs.index(o), vbuf=o['vert'], nv=len(V), nn=len(N),
                           pos=b64f([x for v in V for x in v]), nrm=b64f([x for v in N for x in v]),
                           groups=[dict(mat=m, n=len(g[0]), pi=base64.b64encode(array('H', g[0]).tobytes()).decode(),
                                        ni=base64.b64encode(array('H', g[1]).tobytes()).decode(),
                                        uv=b64f(g[2]), col=base64.b64encode(bytes(g[3])).decode())
                                   for m, g in groups.items()]))
    # skinning: one envelope set per vertex buffer
    for m in meshes:
        k = m.pop('vbuf')
        if 0 <= k < h.sec['cenv'][1]:
            vw, nw = weights(h, k, m['nv'], m['nn'])
            vj, vwt = pack4(vw)
            nj, nwt = pack4(nw)
            m.update(vj=base64.b64encode(array('H', vj).tobytes()).decode(), vw=b64f(vwt),
                     nj=base64.b64encode(array('H', nj).tobytes()).decode(), nw=b64f(nwt))
    skel = [dict(name=o['name'], type=o['type'], parent=o['parent'], pos=o['pos'], rot=o['rot'], scl=o['scl']) for o in objs]
    return dict(objects=skel, meshes=meshes, materials=mats, attrs=attrs, bitmaps=h.bitmaps())


def sample(tr, f):
    k = tr['keys']
    if not isinstance(k, list):
        return k
    st = 4 if tr['curve'] == 2 else 2
    n = len(k) // st
    lo, hi = 0, n - 1
    if f <= k[0]:
        return k[1]
    if f >= k[(n - 1) * st]:
        return k[(n - 1) * st + 1]
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if k[mid * st] <= f:
            lo = mid
        else:
            hi = mid
    t0, v0, t1, v1 = k[lo * st], k[lo * st + 1], k[hi * st], k[hi * st + 1]
    u = (f - t0) / ((t1 - t0) or 1)
    if st == 2:
        return v0 + (v1 - v0) * u
    dt = t1 - t0
    m0, m1 = k[lo * st + 3] * dt, k[hi * st + 2] * dt
    u2, u3 = u * u, u * u * u
    return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * m1


def rel_data(path):
    """a Wii .rel module: its data section (section 4) with the module's own pointers filled in"""
    d = open(path, 'rb').read()
    ns, sio = struct.unpack_from('>II', d, 0xc)
    secs = [struct.unpack_from('>II', d, sio + 8 * i) for i in range(ns)]
    relo, impo, imps = struct.unpack_from('>III', d, 0x24)
    off, size = secs[4]
    data = bytearray(d[off & ~1:(off & ~1) + size])
    for k in range(imps // 8):
        mod, roff = struct.unpack_from('>II', d, impo + 8 * k)
        p, cur, pos = roff, None, 0
        while True:
            o, t, sec, add = struct.unpack_from('>HBBI', d, p)
            p += 8
            if t == 203:
                break
            if t == 202:
                cur, pos = sec, 0
                continue
            pos += o
            if t == 1 and cur == 4 and mod != 0 and sec == 4:      # a pointer inside this module's data
                struct.pack_into('>I', data, pos, add)
    return bytes(data)


_TIMELINES = {}


def timeline(d000, song):
    """the game's dance timeline for a song (files/dll/d000Dll.rel): one entry per measure where something
    changes: [measure, lead dancer's part, backup dancers' part] (part = entry in c_000_NN.bin, -1 = carry on)"""
    if d000 not in _TIMELINES:
        try:
            _TIMELINES[d000] = rel_data(d000)
        except (OSError, struct.error):
            _TIMELINES[d000] = None
    data = _TIMELINES[d000]
    if not data or not (0 <= song < 52):
        return None
    p = struct.unpack_from('>I', data, 0x1ca48 + 4 * song)[0]
    out = []
    for _ in range(400):
        if p + 20 > len(data):
            break
        m, fl, a, ad, b, bd = struct.unpack_from('>HHIIII', data, p)
        if fl & 0x8000:
            break
        out.append([m, a & 0xffff if a != 0xffffffff else -1, b & 0xffff if b != 0xffffffff else -1])
        p += 72
    return out or None


def dance(path, d000=None, song=None, fps=30):
    """the song's dance parts (each resampled to `fps` per 2 seconds-at-120-BPM, i.e. 60 per measure),
    the game's timeline of which part each group dances when, and the camera"""
    parts = entries(open(path, 'rb').read())
    cams, clips = [], {}
    for k, u in enumerate(parts):
        if k == 0 or u[:3] != b'HSF':
            continue
        m = Hsf(u).motion()
        if not m:
            continue
        if all(t['param'] == 7 or str(t['target']).startswith('camera') for t in m['tracks']):
            cams.append(m)
            continue
        joints = {}
        for t in m['tracks']:
            if t['type'] == 2 and t['ch'] in JOINT_CH and t['param'] != 7 and isinstance(t['target'], str) \
                    and not t['target'].endswith('Shape') and not t['target'].startswith('camera'):
                joints.setdefault(t['target'], {})[JOINT_CH[t['ch']]] = t
        n = int(m['len'] * fps / 60) + 1
        tracks = {j: {ch: b64f([sample(t, i * 60.0 / fps) for i in range(n)]) for ch, t in chs.items()} for j, chs in joints.items()}
        clips[k] = dict(frames=n, tracks=tracks)
    tl = timeline(d000, song) if d000 and song is not None else None
    if not tl:            # no timeline: the parts one after another, a measure every 120 frames
        tl, at = [], 0.0
        for k in sorted(clips):
            tl.append([at, k, k])
            at += clips[k]['frames'] / (fps * 2.0)
    return dict(fps=fps, perMeasure=fps * 2, clips=clips, timeline=tl, cameras=cams)


if __name__ == '__main__':
    import json, sys, time
    t = time.time()
    c = character(sys.argv[1])
    print('character objects', len(c['objects']), 'meshes', len(c['meshes']), 'KB', len(json.dumps(c)) // 1024, round(time.time() - t, 2))
    if len(sys.argv) > 2:
        t = time.time()
        d = dance(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None, int(sys.argv[4]) if len(sys.argv) > 4 else None)
        print('dance clips', len(d['clips']), 'timeline', d['timeline'][:6], 'cams', len(d['cameras']), 'KB', len(json.dumps(d)) // 1024, round(time.time() - t, 2))
