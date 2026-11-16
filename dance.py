"""DDR II dance motions (the choreography the game's dancers perform).

dance/DANCE_<series>_<nnn>_<part><vv>_MOT_010.bin holds one-measure motion clips ("ZAB"):
144 frames each (36 frames per beat). A dance is its S01 part (intro), loops of its L parts,
then E01 (ending). Which dance a song gets is in dance_for (the game's own rule, read from main.dol).

Only motion is read here: per-bone position / rotation keys. No character models.
"""
import os, random, struct

import ddr2fx

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
    # every clip is one measure, whatever its frame count (144 in HP2U's files, 84-120 in the others):
    # its keys are put on the 144-frame measure the player samples (FRAMES_PER_BEAT x 4)
    n = U(z, 0x10)
    if n and n != FRAMES_PER_BEAT * 4:
        k = FRAMES_PER_BEAT * 4 / n
        for tr in tracks.values():
            for ch, w in (('p', 4), ('r', 5)):
                v = tr.get(ch)
                if v:
                    for i in range(0, len(v), w):
                        v[i] = round(v[i] * k, 3)
    return tracks


def read_part(path):
    d = open(path, 'rb').read()
    return [c for c in (clip(d[o:o + s]) for o, s in wii_entries(d) if s) if c]


SONG_DB_VA, SONG_STRIDE = 0x802A44A8, 412
FIXED_VA = 0x80291258            # 68-byte rows: key (= song slot + 1), flags, 4 x (mask u16, pad, series, number)


def song_info(dol, slot):
    """-> (flags, bpm) from the song DB"""
    b = dol.bytes(SONG_DB_VA + SONG_STRIDE * slot, 32)
    return struct.unpack_from('>I', b, 4)[0], struct.unpack_from('>H', b, 30)[0]


def fixed(dol):
    out = {}
    for i in range(64):
        b = dol.bytes(FIXED_VA + 68 * i, 68)
        key = struct.unpack_from('>I', b, 0)[0]
        if not 0 < key < 3000:
            break
        parts = [struct.unpack_from('>HHII', b, 16 + 12 * k) for k in range(4)]
        out[key] = parts
    return out


def _bit(mask, rng):
    bits = [v + 1 for v in range(16) if mask >> v & 1]
    return rng.choice(bits) if bits else 1


def _mt(seed):
    """the game's random numbers for the dance pick (0x80128ce4 / 0x80128d38: MT19937)"""
    mt = [seed & 0xffffffff]
    for i in range(1, 624):
        mt.append((0x6c078965 * (mt[-1] ^ (mt[-1] >> 30)) + i) & 0xffffffff)
    idx = [624]

    def nxt():
        if idx[0] >= 624:
            for i in range(624):
                y = (mt[i] & 0x80000000) | (mt[(i + 1) % 624] & 0x7fffffff)
                mt[i] = mt[(i + 397) % 624] ^ (y >> 1) ^ (0x9908b0df if y & 1 else 0)
            idx[0] = 0
        y = mt[idx[0]]; idx[0] += 1
        y ^= y >> 11
        y ^= (y << 7) & 0x9d2c5680
        y ^= (y << 15) & 0xefc60000
        return y ^ (y >> 18)
    return nxt


def pool_picks(rows, base):
    """0x80119844 for a pool song: each of the five part slots (0 S, 1-3 the three loops, 4 E) is picked
    on its own - a new MT19937 seeded with base - slot (base + slot when base >= 0xffff0000), a pool row =
    rand % rows, then one of that row's files for the slot (S mask +8, L mask +10, E mask +12 of the 16-byte
    row): the (rand % set bits + 1)-th set bit. So the parts come from different dances, and two loop
    slots can be the same file (Dolphin, Wings of an Angel: S HP3U_037_S01, L HP3U_045_L03 /
    HP3U_037_L02 / HP3U_037_L02, E HP3U_031_E01; its full version S HP3U_002_S01, L HP3U_034_L04 /
    HP3U_045_L02 / HP3U_041_L02, E HP2U_036_E01). -> [(series, number, part letter, file number) x 5]"""
    out = []
    for k in range(5):
        seed = (base + k if base >= 0xffff0000 else base - k) & 0xffffffff
        r = _mt(seed)
        ser, num, ms, ml, me = rows[r() % len(rows)]
        mask = ms if k == 0 else me if k == 4 else ml
        bits = [v + 1 for v in range(16) if mask >> v & 1] or [1]
        out.append((ser, num, 'S' if k == 0 else 'E' if k == 4 else 'L', bits[r() % len(bits)]))
    return out


def pool_base(rng):
    """the seed base (0x8003d46c, set as each song loads): rand() * rand() + 0x12345678, C rand 0..32767"""
    return (rng.randrange(32768) * rng.randrange(32768) + 0x12345678) & 0xffffffff


def _cue(path):
    f = path.replace('_MOT_010.bin', '_FRE.bin')
    try:
        return ddr2fx.cues(f) if os.path.isfile(f) else None
    except Exception:
        return None


def pool_dance(folder, rows, base):
    return pool_dance_parts(folder, pool_picks(rows, base))


def pool_dance_parts(folder, picks):
    """a pool dance from its five picks [(series, number, part letter, file number)] - the picks made by
    pool_picks, or ones read from a Dolphin dump (camtrace's checks)"""
    paths = [os.path.join(folder, 'DANCE_%s_%03d_%s%02d_MOT_010.bin' % p) for p in picks]
    if not all(os.path.isfile(p) for p in paths):
        return None
    S, L, E = paths[0], paths[1:4], paths[4]
    return {'name': '+'.join(sorted({'%s_%03d' % p[:2] for p in picks})), 'framesPerBeat': FRAMES_PER_BEAT,
            'lOrder': 'cycle', 'clock': 'seconds', 'parts': ['%s_%03d_%s%02d' % p for p in picks],
            'S': read_part(S), 'L': [read_part(p) for p in L], 'E': read_part(E),
            'cues': {'S': _cue(S), 'L': [_cue(p) for p in L], 'E': _cue(E)}}


def lesson_dance(folder, tag='001L', series='HP4U'):
    """DDR SCHOOL's step lessons: the dance HP4U_001L - S01, L01-L03, E01 (Dolphin camtrace of Step Lesson 1:
    its cue sheets' cameras HP4U_DDR001L_CAM101-107 and HP4U_DEF_CAM_05_40 / 78 / 81 were the ones loaded),
    on the chart's clock in seconds like a song's own dance"""
    base = os.path.join(folder, 'DANCE_%s_%s_' % (series, tag))
    name = lambda part, v: base + '%s%02d_MOT_010.bin' % (part, v)
    S, L, E = name('S', 1), [name('L', v) for v in (1, 2, 3)], name('E', 1)
    if not all(os.path.isfile(p) for p in [S, E] + L):
        return None
    return {'name': '%s_%s' % (series, tag), 'framesPerBeat': FRAMES_PER_BEAT, 'lOrder': 'cycle', 'clock': 'seconds',
            'parts': ['%s_%s_%s' % (series, tag, x) for x in ('S01', 'L01', 'L02', 'L03', 'E01')],
            'S': read_part(S), 'L': [read_part(p) for p in L], 'E': read_part(E),
            'cues': {'S': _cue(S), 'L': [_cue(p) for p in L], 'E': _cue(E)}}


def dance_for(files, dol, slot, seed=None):
    """the dance the game uses for this song (main.dol 0x80119844):
    song flag 0x200000 -> a random dance from the BPM pool (< 120, 120-140, > 140), its intro / loops /
    ending picked at random from that dance's masks; otherwise flag 0x40 (songs with their own video)
    -> HP2U_008; otherwise the song's own dance from the fixed table (key = slot + 1)."""
    rng = random.Random(seed)              # a new pick every play, as the game (pool_base)
    folder = os.path.join(files, 'dance')
    if 800 < slot <= 806:                  # the step lessons (server LESSON_BASE + n)
        d = lesson_dance(folder)
        if d:
            return d
    fixed_slots = None
    try:
        flags, bpm = song_info(dol, slot) if 1 <= slot <= 200 else (0x200000, 130)
    except Exception:
        flags, bpm = 0x200000, 130
    cands = []
    if flags & 0x200000:
        # each part from its own pool row (pool_picks), on the song's own tempo in seconds: every part
        # keeps its file's tempo and the parts are laid end to end by their lengths (Dolphin: the dance
        # controller's time = chart seconds; Wings of an Angel (175 BPM) danced parts of 170, 160 and 150)
        rows = pools(dol)[0 if bpm < 120 else 1 if bpm <= 140 else 2]
        for _ in range(8):
            d = pool_dance(folder, rows, pool_base(rng))
            if d:
                return d
        cands = rows[:]
    elif flags & 0x40:
        cands = [('HP2U', 8, 1, 0xffff, 1)]
    else:
        row = fixed(dol).get(slot + 1)
        if row:
            ser = SERIES[row[0][2]] if row[0][2] < len(SERIES) else 'HP2U'
            num = row[0][3] % 1000
            lm = 0
            for m, _, _, _ in row[1:]:
                lm |= m
            # (the row's entries 1-3 are the song's three loop slots, each a mask whose lowest bit is
            # the L file: London EVOLVED's rows say L01, L02, L03)
            fixed_slots = [m for m, _, _, _ in row[1:4] if m]
            cands = [(ser, num, row[0][0] or 1, lm or 1, 1)]
    cands += [r for pool in pools(dol) for r in pool]      # only if that dance's files are missing
    for series, num, ms, ml, me in cands:
        base = os.path.join(folder, 'DANCE_%s_%03d_' % (series, num))
        name = lambda part, v: base + '%s%02d_MOT_010.bin' % (part, v)
        s_v, e_v = _bit(ms, rng), _bit(me, rng)
        if not os.path.isfile(name('S', s_v)):
            s_v = 1
        if not os.path.isfile(name('E', e_v)):
            e_v = 1
        if not (os.path.isfile(name('S', s_v)) and os.path.isfile(name('E', e_v))):
            continue
        # the three loop slots (0x80119844 loads S, three L files and E; 0x80119f0c then plays the L
        # slots in turn - 1, 2, 3, 1, 2, ... - from the end of S to the start of E): a fixed song's own
        # three, otherwise each slot a random variant from the dance's L mask
        if fixed_slots and (series, num) == cands[0][:2]:
            picks = [min(v + 1 for v in range(16) if m >> v & 1) for m in fixed_slots]
        else:
            have = [v + 1 for v in range(16) if ml >> v & 1 and os.path.isfile(name('L', v + 1))]
            picks = [rng.choice(have) for _ in range(3)] if have else []
        loops = [name('L', v) for v in picks if os.path.isfile(name('L', v))]
        if not loops:
            continue
        # each part's cue sheet (effects, lights, camera moves) is beside its motion: <part><vv>_FRE.bin
        def cue(p):
            f = p.replace('_MOT_010.bin', '_FRE.bin')
            try:
                return ddr2fx.cues(f) if os.path.isfile(f) else None
            except Exception:
                return None
        return {'name': '%s_%03d' % (series, num), 'framesPerBeat': FRAMES_PER_BEAT, 'lOrder': 'cycle',
                # (a song's own dance runs on the chart's clock in seconds at its own tempo: camtrace)
                'clock': 'seconds' if fixed_slots and (series, num) == cands[0][:2] else 'beats',
                'S': read_part(name('S', s_v)), 'L': [read_part(p) for p in loops], 'E': read_part(name('E', e_v)),
                'cues': {'S': cue(name('S', s_v)), 'L': [cue(p) for p in loops], 'E': cue(name('E', e_v))}}
    return None
