"""DDR II dance motions (the choreography the game's dancers perform).

dance/DANCE_<series>_<nnn>_<part><vv>_MOT_010.bin holds one-measure motion clips ("ZAB"):
144 frames each (36 frames per beat). A dance is its S01 part (intro), loops of its L parts,
then E01 (ending). The game picks the dance from one of three pools by song number (tables at
0x80290f88 in main.dol): song < 120, 120-139, or 140 and up.

Only motion is read here: per-bone position / rotation keys. No character models.
"""
import os, random, struct

U = lambda d, o: struct.unpack_from('>I', d, o)[0]
POOL_VA = 0x80290f88
SERIES = ['HP2U', 'HP3U', 'HP3J', 'HP4U', 'HP5U']
FRAMES_PER_BEAT = 36


def pools(dol):
    """-> three lists of (series, number, S mask, L mask, E mask)"""
    out = []
    for off, n in ((0, 12), (192, 13), (400, 13)):
        rows = []
        for i in range(n):
            s, num, ms, ml, me, _ = struct.unpack('>IIHHHH', dol.bytes(POOL_VA + off + 16 * i, 16))
            if s < len(SERIES):
                rows.append((SERIES[s], num, ms, ml, me))
        out.append(rows)
    return out


def wii_entries(d):
    n = U(d, 8)
    return [struct.unpack_from('>II', d, 0x10 + 8 * i) for i in range(n)]


def clip(z):
    """one ZAB clip -> {bone: {'p': [f, x, y, z, ...], 'r': [f, x, y, z, w, ...]}}"""
    if z[:4] != b'ZAB ':
        return None
    tracks = {}
    for t in range(U(z, 0xC)):
        to = 0x30 + t * 0x40
        name = z[to:to + 0x30].split(b'\0')[0].decode('ascii', 'replace')
        off = U(z, to + 0x3C)
        tr = {}
        for c in range(3):
            cid, stride, count, ko = struct.unpack_from('>IIII', z, off + 16 * c)
            if cid == 2:          # scale: always 1 in these files
                continue
            vals = []
            for k in range(count):
                o = ko + k * stride
                vals.append(U(z, o))
                vals.extend(round(v, 4) for v in struct.unpack_from('>%df' % (stride // 4 - 1), z, o + 4))
            tr['p' if cid == 0 else 'r'] = vals
        tracks[name] = tr
    return tracks


def read_part(path):
    d = open(path, 'rb').read()
    return [c for c in (clip(d[o:o + s]) for o, s in wii_entries(d) if s) if c]


def dance_for(files, dol, song_no, seed=None):
    """the dance the game would use for this song number -> {'name', 'S': [...], 'L': [[...]...], 'E': [...]}"""
    rows = pools(dol)[0 if song_no < 120 else 1 if song_no < 140 else 2]
    rng = random.Random(song_no if seed is None else seed)
    order = rows[:]
    rng.shuffle(order)
    folder = os.path.join(files, 'dance')
    for series, num, ms, ml, me in order:
        base = os.path.join(folder, 'DANCE_%s_%03d_' % (series, num))
        name = lambda part, v: base + '%s%02d_MOT_010.bin' % (part, v)
        if not (os.path.isfile(name('S', 1)) and os.path.isfile(name('E', 1))):
            continue
        loops = [name('L', v + 1) for v in range(16) if ml >> v & 1 and os.path.isfile(name('L', v + 1))]
        if not loops:
            continue
        return {'name': '%s_%03d' % (series, num), 'framesPerBeat': FRAMES_PER_BEAT,
                'S': read_part(name('S', 1)), 'L': [read_part(p) for p in loops], 'E': read_part(name('E', 1))}
    return None
