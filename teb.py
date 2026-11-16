"""Konami 'TEB' particle effects (DDR II: GAME_STG_EFF.bin ddr3_stage.TEB, each stage's own TEB,
GAME_APL_EFF.bin concent.TEB, the 2D game effects).  Read from main.dol's effect code
(CzanEffMng / EffMath 0x80179ae0, part loader 0x801796ac, spawn 0x8017ac48 / 0x8017ade0 / 0x8017b010,
particle step 0x8017b2bc, draw 0x8017cb28).  Big-endian; every offset is from the TEB start.

  header: 'TEB\\0', f32 version (0 = old layout, 0.01 = new), +0x10 u32 effect table, +0x14 u16 count
  effect (16 bytes): u32 node list, u32 0, u8 node count
  node (8 bytes): u8 child, u8 brother (0 = none), u8 type (0 = transform, 1 = particle part), u8 0, u32 data
  transform node: u32 flags, u32 key-track list
  key-track list: u32 count, u32 offset of 20-byte tracks {u32 key count, u32 keys, f32 ?, f32 end time,
     u32 flags}; keys are 32 bytes [?, x, y, z, rx, ry, rz, ?], evenly spaced over the end time
  part header (new 52 bytes / old 48): u32 flags, then offsets of its blocks (0 = none):
     +4 emitter (flag 0x1)  +8 acceleration (0x2)  +12 look (0x4)  +16 child link (0x8)  +20 light (0x10)
     +24 rotation (0x20)  +28 scale (0x40)  +32 sphere shape  +36 ring shape  [+40 ? new only]
     +40/+44 key tracks, then a byte: emitter shape 0 box / 1 sphere / 2 ring
     other flags: 0x80 particles move with the emitter, 0x200 no depth test, 0x400 flip cells,
                  0x800 particles loop instead of dying
"""
import struct

F = lambda d, o: struct.unpack_from('>f', d, o)[0]
U = lambda d, o: struct.unpack_from('>I', d, o)[0]
H = lambda d, o: struct.unpack_from('>H', d, o)[0]
S16 = lambda d, o: struct.unpack_from('>h', d, o)[0]


def r(v, n=4):
    return round(v, n)


def curve(b, off, n):
    return [[r(F(b, off + 8 * i)), r(F(b, off + 8 * i + 4))] for i in range(n)] if off and n else []


def tracks(b, off):
    """key tracks: u32 count, u32 offset of 20-byte entries {u32 key count, u32 keys, f32 ?, f32 end, u32 flags};
    keys are 32 bytes (8 floats: [?, x, y, z, rx, ry, rz, ?]); they are evenly spaced over end"""
    if not off:
        return []
    out = []
    n, eo = U(b, off), U(b, off + 4)
    for i in range(min(n, 16)):
        e = eo + 20 * i
        nk, ko = U(b, e), U(b, e + 4)
        if nk > 1024:
            continue
        keys = [[r(F(b, ko + 32 * k + 4 * j)) for j in range(8)] for k in range(nk)]
        out.append(dict(end=r(F(b, e + 12)), flags=U(b, e + 16), keys=keys))
    return out


def part(b, p, old):
    fl = U(b, p)
    o = [U(b, p + 4 * i) for i in range(11)]
    lst = o[10] if old else U(b, p + 44)
    shape = b[p + 44] if old else b[p + 48]
    q = dict(flags=fl, shape=shape, keys=tracks(b, lst))
    if fl & 1 and o[1]:
        m = o[1]
        q['emit'] = dict(life=r(F(b, m)), lifeVar=r(F(b, m + 4)), interval=r(F(b, m + 8)),
                         box=[r(F(b, m + 12)), r(F(b, m + 16)), r(F(b, m + 20))],
                         cone=[r(F(b, m + 24)), r(F(b, m + 28)), r(F(b, m + 32))],
                         speed=r(F(b, m + 36)), speedVar=r(F(b, m + 40)),
                         max=S16(b, m + 44), burst=S16(b, m + 46), bill=b[m + 50])
    if fl & 2 and o[2]:
        a = o[2]
        q['accel'] = dict(dir=[r(F(b, a + 4 * i)) for i in range(3)], angVar=[r(F(b, a + 12 + 4 * i)) for i in range(3)],
                          v=r(F(b, a + 24)), var=r(F(b, a + 28)))
    if fl & 4 and o[3]:
        t = o[3]
        tf = U(b, t)
        nsz, nal, blend, ncol = b[t + 36], b[t + 37], b[t + 38], b[t + 42]
        look = dict(flags=tf, size0=[r(F(b, t + 8)), r(F(b, t + 12))], size1=[r(F(b, t + 16)), r(F(b, t + 20))],
                    sizeCurve=curve(b, U(b, t + 24), nsz), alphaCurve=curve(b, U(b, t + 28), nal),
                    blend=blend, tex=S16(b, t + 40), rndLo=b[t + 43], rndHi=b[t + 44])
        co = U(b, t + 4)
        if tf & 0x20:                                  # colour keys over the particle's life (time in %)
            look['colorKeys'] = [[b[co + 8 * i + 4]] + list(b[co + 8 * i:co + 8 * i + 4]) for i in range(ncol)] if co else []
        else:                                          # a palette (the game picks one entry per emitter)
            look['palette'] = [list(b[co + 4 * i:co + 4 * i + 4]) for i in range(max(1, ncol))] if co else []
        if tf & 2 and U(b, t + 32):
            c = U(b, t + 32)
            look['cells'] = dict(texW=H(b, c), cellW=H(b, c + 2), time=r(F(b, c + 4)), count=b[c + 8])
        q['look'] = look
    if fl & 8 and o[4]:
        q['child'] = dict(v=r(F(b, o[4])), count=b[o[4] + 4])
    if fl & 0x10 and o[5]:
        q['light'] = dict(v=r(F(b, o[5])), b=b[o[5] + 4])
    if fl & 0x20 and o[6]:
        s = o[6]
        q['rot'] = [r(F(b, s + 4 * i)) for i in range(8)]   # angle, var, spin, var, spin accel, var, orbit, orbit accel
    if fl & 0x40 and o[7]:
        q['scale'] = [r(F(b, o[7])), r(F(b, o[7] + 4))]
    if shape == 1 and o[8]:
        q['sphere'] = dict(flags=U(b, o[8]), r=[r(F(b, o[8] + 4 + 4 * i)) for i in range(3)])
    if shape == 2 and o[9]:
        q['ring'] = dict(flags=U(b, o[9]), r=[r(F(b, o[9] + 4 + 4 * i)) for i in range(3)])
    return q


def parse(b):
    """-> list of effects; each effect is a list of nodes {child, brother, type, ...}"""
    if b[:4] != b'TEB\0':
        return []
    old = F(b, 4) == 0
    tab, n = U(b, 0x10), H(b, 0x14)
    out = []
    for e in range(n):
        lo, cnt = U(b, tab + 16 * e), b[tab + 16 * e + 8]
        nodes = []
        for k in range(cnt):
            ch, br, ty = b[lo + 8 * k], b[lo + 8 * k + 1], b[lo + 8 * k + 2]
            p = U(b, lo + 8 * k + 4)
            nd = dict(child=ch, brother=br, type=ty)
            try:
                if ty == 1:
                    nd.update(part(b, p, old))
                else:
                    nd['keys'] = tracks(b, U(b, p + 4))
            except (struct.error, IndexError):
                nd['bad'] = True
            nodes.append(nd)
        out.append(nodes)
    return out


if __name__ == '__main__':
    import sys
    import json
    d = open(sys.argv[1], 'rb').read()
    o = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    effs = parse(d[o:])
    print(len(effs), 'effects')
    for i, e in enumerate(effs[:int(sys.argv[3]) if len(sys.argv) > 3 else 99]):
        print(i, json.dumps(e)[:1500])
