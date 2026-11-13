"""Songs from a second disc: Dance Dance Revolution Hottest Party (Wii, USA).

Everything comes from the user's own extracted disc (only read, never changed):
  sys/main.dol             the song table (title, BPM, which chart file)
  files/data/ssq.bin       the step charts (zlib-packed SSQ), converted here to DDR II's chart shape
  files/sound/ddr.brsar    the music (one wave group per song, same format DDR II uses)
  files/sound/stream/mu_sam_NNN.brstm   previews
  files/data/selcom.bin    the song banners (226x110 RGB5A3 textures)

Hand markers are left out: in the charts they're a tag on an arrow (the game's 'hand markers off' charts
are the same arrows with the tag cleared), so every arrow stays a normal step.
"""
import os, re, struct, zlib

SLOT_BASE = 1000            # HP songs are /api/.../1000 + n so they never clash with DDR II's slots

# Levels (Beginner/Basic/Difficult/Expert) and artists as the game shows them (source: RemyWiki)
INFO = {
    "1,2 Step": ("LADY-S", [1, 2, 4, 6]),
    "99 Red Ballons": ("M-CREW project", [2, 5, 7, 8]),
    "Clocks": ("T.R.MASTER MC", [1, 2, 4, 6]),
    "Finally": ("CLUB 90's", [1, 4, 5, 8]),
    "Gonna Make You Sweat (Everybody Dance Now)": ("RAVE ATTACKERS", [2, 4, 5, 8]),
    "Hot Stuff": ("DISCO QUEEN", [1, 4, 7, 9]),
    "Karma Chameleon": ("happy happy cores", [2, 4, 7, 8]),
    "Nothing But You": ("TRANCE JACK", [1, 3, 6, 8]),
    "Rhythm Is a Dancer": ("SPOTS", [1, 4, 6, 8]),
    "Summertime": ("Eazin'", [1, 3, 4, 7]),
    "The Sign": ("Honey Sweets", [1, 3, 5, 7]),
    "You Spin Me 'Round(Like a Record)": ("M.A.N", [2, 3, 6, 8]),
    "Far Away": ("Traveler", [1, 3, 6, 8]),
    "Lips of an Angel": ("JET ROCKERS", [1, 2, 6, 7]),
    "Call On Me": ("2000's STARS", [2, 5, 6, 9]),
    "Buried a Lie": ("COOLS K", [2, 4, 5, 7]),
    "Disco Inferno": ("OK・OK・OK", [1, 3, 5, 8]),
    "Always (Microbots Trance Dance Mix)": ("MAN'S COOL", [1, 2, 4, 8]),
    "Little L": ("Single Funk", [1, 3, 5, 7]),
    "Yo,Excuse Me Miss": ("Smooth-1", [1, 2, 4, 6]),
    "Gypsy woman": ("neo-GRUV", [1, 3, 5, 7]),
    "Caught Up": ("Stopped Cold", [1, 3, 5, 7]),
    "I Don't Feel Like Dancin'": ("Life Aloud", [1, 3, 5, 7]),
    "Blue Monday": ("wg", [1, 3, 5, 7]),
    "Too Little,Too Late": ("Okokoro", [2, 3, 6, 9]),
    "unappreciated": ("Wrapped Up", [1, 4, 5, 8]),
    "Lesson by DJ": ("U.T.D & Friends", [1, 1, 0, 0]),
    "LOVE SHINE (Body Grooverz 2006 mix)": ("W.W.S", [1, 5, 7, 9]),
    "BREAK DOWN! (World Version)": ("ELE ROCKS", [1, 4, 7, 8]),
    "1998 (Sparky 2006)": ("J-RAVERS", [1, 5, 7, 9]),
    "CANDY (UFO mix)": ("The Sweetest", [2, 4, 7, 9]),
    "B4U (The Acolyte mix)": ("J-RAVERS", [1, 3, 6, 8]),
    "Confession": ("trance star", [1, 3, 6, 9]),
    "let it out": ("true dreamer", [1, 2, 5, 8]),
    "will": ("NAOKI", [1, 3, 5, 7]),
    "little steps": ("Freeman", [2, 4, 6, 9]),
    "Touchin'": ("The Lonely Hearts", [1, 2, 5, 7]),
    "I'm Flying Away": ("Stepper", [2, 5, 7, 9]),
    "We Will Live Together": ("Happy CoreMAN", [2, 5, 6, 9]),
    "Heavens and the Earth": ("The Lonely Hearts", [2, 3, 5, 8]),
    "Moving On": ("J.J. Pops", [1, 3, 5, 8]),
    "Here I Go Again": ("NM feat. Malaya", [1, 3, 4, 6]),
    "the beat": ("Sparky", [2, 4, 6, 9]),
    "Beautiful Inside": ("NM feat. Alison Wade", [1, 3, 5, 8]),
    "Mess With My Emotions": ("Latenighter", [1, 4, 6, 8]),
    "THE REASON": ("Black Rose Garden", [1, 3, 7, 9]),
    "SUPER SAMURAI": ("jun", [2, 6, 8, 10]),
    "Such A Feeling": ("U1", [1, 3, 5, 8]),
    "Hold Tight": ("800 slopes", [1, 4, 5, 8]),
    "tokyoEVOLVED": ("NAOKI underground", [3, 7, 9, 10]),
}
NICE_TITLE = {"99 Red Ballons": "99 Red Balloons", "BREAK DOWN! (World Version)": "BRE∀K DOWN! (World Version)",
              "Beautiful Inside": "Beautiful Inside (Cube::Hard Mix)",
              "You Spin Me 'Round(Like a Record)": "You Spin Me 'Round (Like a Record)",
              "Yo,Excuse Me Miss": "Yo, Excuse Me Miss"}
DIFF_ORDER = (4, 1, 2, 3)        # beginner, basic, difficult, expert (chart key = diff << 8 | 0x14)


def find_files(root):
    """files folder of an extracted Hottest Party disc (root, root/files, root/DATA/files), or None"""
    if not root or not os.path.isdir(root):
        return None
    for sysdir, files in ((root, os.path.join(root, 'files')), (os.path.join(root, 'DATA'), os.path.join(root, 'DATA', 'files')),
                          (os.path.dirname(root), root)):
        if os.path.isfile(os.path.join(files, 'data', 'ssq.bin')) and os.path.isfile(os.path.join(files, 'sound', 'ddr.brsar')) \
                and os.path.isfile(os.path.join(sysdir, 'sys', 'main.dol')):
            return sysdir, files
    return None


def default_folder():
    home = os.path.expanduser('~')
    for base in (os.path.join(home, 'Downloads'), os.path.join(home, 'Desktop'), home):
        try:
            names = sorted(os.listdir(base))
        except OSError:
            continue
        for n in names:
            if 'hottest party' in n.lower() and find_files(os.path.join(base, n)):
                return os.path.join(base, n)
    return None


def packed(d):
    """the container used by ssq.bin / selcom.bin: count, offsets, then (usize, 7, usize, csize, zlib) per entry"""
    n = struct.unpack_from('>I', d, 0)[0]
    offs = list(struct.unpack_from('>%dI' % n, d, 4)) + [len(d)]
    return n, offs


def lzss(src, size):
    """Hudson's LZSS (packing type 1): a 1 KB ring that starts at 0x3be, flag bits low first"""
    win = bytearray(1024)
    wp, out, p, flag = 0x3be, bytearray(), 0, 0
    while len(out) < size and p < len(src):
        flag >>= 1
        if not flag & 0x100:
            flag = 0xff00 | src[p]
            p += 1
        if flag & 1:
            b = src[p]
            p += 1
            out.append(b)
            win[wp] = b
            wp = (wp + 1) & 1023
        else:
            if p + 1 >= len(src):
                break
            pos, ln = src[p] | ((src[p + 1] & 0xc0) << 2), (src[p + 1] & 0x3f) + 3
            p += 2
            for k in range(ln):
                b = win[(pos + k) & 1023]
                out.append(b)
                win[wp] = b
                wp = (wp + 1) & 1023
    return bytes(out[:size])


def unpack(d, offs, i):
    usz, kind = struct.unpack_from('>2I', d, offs[i])
    if kind == 1:
        return lzss(d[offs[i] + 8:offs[i + 1]], usz)
    csz = struct.unpack_from('>I', d, offs[i] + 12)[0]
    return zlib.decompress(d[offs[i] + 16:offs[i] + 16 + csz])


def chunks(u):
    p, out = 0, []
    while p + 12 <= len(u):
        size, typ, p2, count = struct.unpack_from('<IHHH', u, p)
        if not size:
            break
        out.append((typ, p2, count, u[p + 12:p + size]))
        p += size
    return out


def hp_steps(count, body):
    """type-9 step chunk -> [(offset, lane mask, freeze_end)]. Per note: a lane mask byte, then one tag byte per
    lane (hand markers etc.); mask 0 = a freeze end whose lanes come from the FREZ block (3 bytes each)."""
    offs = struct.unpack_from('<%di' % count, body, 4)
    p, notes, ends = 4 + 4 * count, [], []
    for i in range(count):
        m = body[p]
        p += 1
        if m:
            p += bin(m).count('1')
            notes.append([offs[i], m & 15, False])
        else:
            ends.append(len(notes))
            notes.append([offs[i], 0, True])
    if ends:
        fz = body.find(b'FREZ')
        for j, k in enumerate(ends):
            notes[k][1] = body[fz + 8 + 3 * j] & 15 if fz >= 0 and fz + 8 + 3 * j < len(body) else 0
    return [n for n in notes if n[1]]


def to_ss4(u):
    """an HP chart -> DDR II's ss4 (tempo chunk type 1, step chunks type 16) for the game's own parser"""
    out = []
    for typ, p2, count, body in chunks(u):
        if typ == 1:
            out.append(struct.pack('<IHHI', 12 + len(body), 1, p2, count) + body)
        elif typ == 9 and (p2 & 0xFF) == 0x14 and (p2 >> 8) in DIFF_ORDER:
            rows = []
            for off, mask, end in hp_steps(count, body):
                for lane in range(4):
                    if mask >> lane & 1:
                        rows.append((off, lane, 0x100 if end else 0))
            rows.sort(key=lambda r: r[0])
            n = len(rows)
            b = struct.pack('<%di' % n, *[r[0] for r in rows]) + bytes(r[1] for r in rows)
            b += b'\0' * ((-(12 + len(b))) % 4)
            b += struct.pack('>%dI' % n, *[r[2] for r in rows])
            out.append(struct.pack('<IHHI', 12 + len(b), 16, p2, n) + b)
    return b''.join(out)


def tempo_time(u, off):
    for typ, p2, count, body in chunks(u):
        if typ == 1:
            o = struct.unpack_from('<%di' % count, body, 0)
            t = struct.unpack_from('<%di' % count, body, 4 * count)
            i = 0
            while i < count - 2 and off >= o[i + 1]:
                i += 1
            if o[i + 1] == o[i]:
                return t[i + 1] / p2
            return (t[i] + (off - o[i]) * (t[i + 1] - t[i]) / (o[i + 1] - o[i])) / p2
    return 0


def png(w, h, rgba):
    def chunk(t, b):
        return struct.pack('>I', len(b)) + t + b + struct.pack('>I', zlib.crc32(t + b) & 0xffffffff)
    raw = b''.join(b'\0' + rgba[y * w * 4:(y + 1) * w * 4] for y in range(h))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + \
        chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b'')


def rgb5a3_png(t):
    """selcom texture: record at 0x58 = (code, ?, w, h, size, data offset); 4x4 tiles of RGB5A3"""
    code, _, w, h, size, off = struct.unpack_from('>HHHHII', t, 0x58)
    px = bytearray(w * h * 4)
    p = off
    for ty in range(0, h, 4):
        for tx in range(0, w, 4):
            for y in range(4):
                for x in range(4):
                    v = (t[p] << 8) | t[p + 1]
                    p += 2
                    X, Y = tx + x, ty + y
                    if X >= w or Y >= h:
                        continue
                    o = (Y * w + X) * 4
                    if v & 0x8000:
                        px[o:o + 4] = bytes((((v >> 10) & 31) * 255 // 31, ((v >> 5) & 31) * 255 // 31, (v & 31) * 255 // 31, 255))
                    else:
                        px[o:o + 4] = bytes((((v >> 8) & 15) * 17, ((v >> 4) & 15) * 17, (v & 15) * 17, ((v >> 12) & 7) * 255 // 7))
    return png(w, h, bytes(px))


def radar(u, count, body):
    """groove radar the way DDR II's own numbers come out (fitted on DDR II's charts):
    [chaos, stream, voltage, air, freeze]"""
    st = hp_steps(count, body)
    taps = [n for n in st if not n[2]]
    if not taps:
        return [0, 0, 0, 0, 0]
    offs = sorted(n[0] for n in taps)
    secs = max(1.0, tempo_time(u, offs[-1]) - tempo_time(u, offs[0]))
    n = len(offs)
    npm = n / secs * 60
    j = peak = 0
    for i in range(n):
        while offs[i] - offs[j] >= 4096:
            j += 1
        peak = max(peak, i - j + 1)
    jumps = sum(1 for x in taps if bin(x[1]).count('1') > 1) / n
    frozen, last = 0, {}
    for off, mask, end in sorted(st):
        for lane in range(4):
            if mask >> lane & 1:
                if end and lane in last:
                    frozen += off - last.pop(lane)
                elif not end:
                    last[lane] = off
    frz = frozen / max(1, offs[-1] - offs[0])
    off8 = sum(1 for o in offs if o % 512) / n
    clip = lambda v: int(max(0, min(200, round(v))))
    return [clip(0.35 * off8 * npm), clip(0.2645 * npm), clip(5 * peak), clip(2.5 * jumps * npm), clip(169 * frz)]


def tex_png(t, which=0):
    """one of Hottest Party's 2D pictures (ddrmodesel.bin, selcom.bin, arrow.bin ...). The header lists
    sprites and the pictures they cut from; picture records (20 bytes each, from the offset at 0x10) are
    (format, palette size, w, h, size, palette/data offset, data offset). Formats: 0x10xx RGB5A3,
    0x08xx 8-bit and 0x04xx 4-bit colour-indexed (RGB5A3 palette first, then the pixels)"""
    hdr = struct.unpack_from('>I', t, 0x10)[0] + 20 * which
    code, npal, w, h, size, off, doff = struct.unpack_from('>HHHHIII', t, hdr)
    bits = code >> 8
    if bits not in (4, 8, 0x10) or not (0 < w <= 2048 and 0 < h <= 2048):
        return None
    px = bytearray(w * h * 4)

    def col(v):
        if v & 0x8000:
            return bytes((((v >> 10) & 31) * 255 // 31, ((v >> 5) & 31) * 255 // 31, (v & 31) * 255 // 31, 255))
        return bytes((((v >> 8) & 15) * 17, ((v >> 4) & 15) * 17, (v & 15) * 17, ((v >> 12) & 7) * 255 // 7))
    if bits == 0x10:
        p = off
        for ty in range(0, h, 4):
            for tx in range(0, w, 4):
                for y in range(4):
                    for x in range(4):
                        v = (t[p] << 8) | t[p + 1]
                        p += 2
                        X, Y = tx + x, ty + y
                        if X < w and Y < h:
                            o = (Y * w + X) * 4
                            px[o:o + 4] = col(v)
        return png(w, h, bytes(px))
    npal = 1 << bits
    pal = [col((t[off + 2 * i] << 8) | t[off + 2 * i + 1]) if off + 2 * i + 1 < len(t) else bytes(4) for i in range(npal)]
    p = doff
    tw, th = (8, 4) if bits == 8 else (8, 8)
    for ty in range(0, h, th):
        for tx in range(0, w, tw):
            for y in range(th):
                for x in range(0, tw, 1 if bits == 8 else 2):
                    if bits == 8:
                        vals = ((x, t[p]),)
                        p += 1
                    else:
                        b = t[p]
                        p += 1
                        vals = ((x, b >> 4), (x + 1, b & 15))
                    for xx, v in vals:
                        X, Y = tx + xx, ty + y
                        if X < w and Y < h:
                            o = (Y * w + X) * 4
                            px[o:o + 4] = pal[v]
    return png(w, h, bytes(px))


def tex_index_png(t, which=0):
    """a colour-indexed picture's raw palette numbers (red = index), for pictures whose palette the
    game rewrites while it plays (the arrows)"""
    hdr = struct.unpack_from('>I', t, 0x10)[0] + 20 * which
    code, npal, w, h, size, off, doff = struct.unpack_from('>HHHHIII', t, hdr)
    if code >> 8 != 8:
        return None
    px = bytearray(w * h * 4)
    p = doff
    for ty in range(0, h, 4):
        for tx in range(0, w, 8):
            for y in range(4):
                for x in range(8):
                    X, Y = tx + x, ty + y
                    if X < w and Y < h:
                        o = (Y * w + X) * 4
                        px[o:o + 4] = bytes((t[p], 0, 0, 255))
                    p += 1
    return png(w, h, bytes(px))


class HPGame:
    name = 'HOTTEST PARTY'

    def __init__(self, root, Dol, Rsar):
        hit = find_files(root)
        if not hit:
            raise ValueError('Not an extracted Hottest Party disc: ' + root)
        self.root = root
        sysdir, self.files = hit
        self.dol = Dol(os.path.join(sysdir, 'sys', 'main.dol'))
        self.rsar = Rsar(os.path.join(self.files, 'sound', 'ddr.brsar'))
        self.ssq = open(os.path.join(self.files, 'data', 'ssq.bin'), 'rb').read()
        self.n_ssq, self.ssq_offs = packed(self.ssq)
        self.banners = {}
        self.songs = self._songs()

    def _table(self):
        """records of {flags<<16|id, ssq<<16|n, bpm (or lo<<16|hi), title ptr}, found by the first title"""
        d = self.dol.d
        p = d.find(b'1,2 Step\0')
        if p < 0:
            raise ValueError('This main.dol is not Hottest Party (USA).')
        va = self.dol.va(p)
        rec = d.find(struct.pack('>I', va))
        if rec < 12:
            raise ValueError('Hottest Party song table not found.')
        base = rec - 12
        out = []
        for k in range(64):
            fid, sq, bpm, tptr = struct.unpack_from('>4I', d, base + 16 * k)
            title = self.dol.cstr(tptr) if tptr else ''
            if not title or (sq >> 16) >= self.n_ssq:
                break
            out.append((k, fid & 0xFFFF, sq >> 16, bpm, title))
        return out

    def _songs(self):
        out = []
        self.hidden = []
        for k, sid, sq, bpm, title in self._table():
            try:
                u = self.chart_raw(sq)
            except (zlib.error, struct.error):
                continue
            keys = {p2 for typ, p2, c, b in chunks(u) if typ == 9}
            artist, lv = INFO.get(title, ('', None))
            if lv is None:                        # not in the list: a rough level from the step count
                lv = []
                for dk in DIFF_ORDER:
                    c = [x for x in chunks(u) if x[0] == 9 and x[1] == (dk << 8 | 0x14)]
                    lv.append(max(1, min(10, round(len(hp_steps(c[0][2], c[0][3])) / 45))) if c else 0)
            single = [lv[i] if (DIFF_ORDER[i] << 8 | 0x14) in keys else 0 for i in range(4)] + [0]
            rad = {p2 >> 8: radar(u, c, b) for typ, p2, c, b in chunks(u) if typ == 9 and (p2 & 0xFF) == 0x14}
            radars = [rad.get(dk, [0, 0, 0, 0, 0]) for dk in DIFF_ORDER] + [[0, 0, 0, 0, 0]]
            last = 0
            for typ, p2, c, b in chunks(u):
                if typ == 9:
                    st = hp_steps(c, b)
                    if st:
                        last = max(last, st[-1][0], max(n[0] for n in st))
            lo, hi = (bpm >> 16, bpm & 0xFFFF) if bpm > 0xFFFF else (bpm, bpm)
            slot = SLOT_BASE + k
            name = NICE_TITLE.get(title, title)
            # the three tokyoEVOLVED charts
            same = [s for s in out if s['hpTitle'] == title]
            if same:
                name = '%s (TYPE%d)' % (name, len(same) + 1)
                if len(same) == 1:
                    same[0]['name'] += ' (TYPE1)'
            # "Lesson by DJ" (the tutorial's song) isn't in the song list: Groove Circuit's first request uses it
            (self.hidden if title == 'Lesson by DJ' else out).append(dict(slot=slot, full=slot, short=False, cut=None, name=name, artist=artist, hpTitle=title,
                            disc='hp', folder=self.name, single=single, double=[0, 0, 0, 0, 0],
                            bpm=[min(lo, hi), max(lo, hi)], length=round(tempo_time(u, last) + 2, 2),
                            radar=radars, preview=bool(self.preview_path(slot)), title=None,
                            jacket='/api/jacket/%d' % slot, alt=None, flags=0, tier=0, movie=None, ssq=sq))
        return out

    def song(self, slot):
        for s in self.songs + getattr(self, 'hidden', []):
            if s['slot'] == slot:
                return s
        return None

    def chart_raw(self, sq):
        return unpack(self.ssq, self.ssq_offs, sq)

    def chart(self, slot):
        s = self.song(slot)
        return to_ss4(self.chart_raw(s['ssq'])) if s else None

    def audio(self, slot):
        """the song's group holds an RWSD (wave info) plus raw DSP-ADPCM data; it's wrapped up here as an
        RWAR holding one RWAV, the shape DDR II's songs come in, so the player decodes it the same way"""
        s = self.song(slot)
        o = self.rsar.groups[s['ssq']]
        foff, fsize, woff, wsize = struct.unpack_from('>4I', self.rsar.d, o + 16)
        with open(self.rsar.path, 'rb') as f:
            f.seek(foff)
            rwsd = f.read(fsize)
            f.seek(woff)
            data = f.read(wsize)
        wave = struct.unpack_from('>I', rwsd, 0x18)[0]
        wsz = struct.unpack_from('>I', rwsd, wave + 4)[0]
        info = bytearray(rwsd[wave + 0x10:wave + wsz])       # first wave's info, channel table and coefficients
        info += b'\0' * ((-len(info)) % 32)
        # RWAV: header 0x20, info block (wi = 0x18 + 8), then the data (dloc: data0 = wi + dloc + 8)
        struct.pack_into('>I', info, 20, len(info) - 8)
        rwav = bytearray(0x20) + info + data
        rwav[0:4] = b'RWAV'
        struct.pack_into('>I', rwav, 0x10, 0x18)
        rwar = bytearray(0x40)
        rwar[0:4] = b'RWAR'
        struct.pack_into('>I', rwar, 0x10, 0x20)        # TABL
        struct.pack_into('>I', rwar, 0x18, 0x40)        # DATA (the RWAV starts here: entry offset 0)
        return bytes(rwar + rwav)

    def preview_path(self, slot):
        n = min(slot - SLOT_BASE + 1, 50)
        p = os.path.join(self.files, 'sound', 'stream', 'mu_sam_%03d.brstm' % n)
        return p if os.path.isfile(p) else None

    def stage_list(self):
        """the game's dance stages in the order they unlock (Stage 1, Stage 2 ...): a list of stg file
        numbers in main.dol (0x801ab5d0, -1 at the end). Free Play dances on the stage you pick, or on
        one of these at random."""
        if getattr(self, '_stages', None) is None:
            out = []
            try:
                for i in range(64):
                    v = struct.unpack('>i', self.dol.bytes(0x801ab5d0 + 4 * i, 4))[0]
                    if v < 0:
                        break
                    out.append(v)
            except (struct.error, TypeError):
                out = []
            ok = [n for n in out if os.path.isfile(os.path.join(self.files, 'data', 'stg%02d.bin' % n))]
            self._stages = ok if len(ok) >= 10 else [n for n in range(1, 51) if os.path.isfile(os.path.join(self.files, 'data', 'stg%02d.bin' % n))]
        return self._stages

    def stage_path(self, slot, choice=None):
        """choice: 'random' (like the game when you don't pick one) or a stage number 1.. in the game's order"""
        import random
        lst = self.stage_list()
        if not lst:
            return None
        n = lst[int(choice) - 1] if isinstance(choice, str) and choice.isdigit() and 1 <= int(choice) <= len(lst) else random.choice(lst)
        p = os.path.join(self.files, 'data', 'stg%02d.bin' % n)
        return p if os.path.isfile(p) else None

    def dance_path(self, slot):
        """the song's dance and camera: c_000_NN.bin, NN = the song's number + 1"""
        s = self.song(slot)
        p = s and os.path.join(self.files, 'data', 'c_000_%02d.bin' % (s['ssq'] + 1))
        return p if p and os.path.isfile(p) else None

    def char_path(self, cid):
        p = os.path.join(self.files, 'data', 'c_%s.bin' % cid)
        return p if os.path.isfile(p) else None

    def ui(self, name, idx):
        """a menu picture from data/<name>.bin (as a PNG), cached"""
        if not hasattr(self, '_ui'):
            self._ui, self._uifiles = {}, {}
        key = (name, idx)
        if key not in self._ui:
            img = None
            try:
                if name not in self._uifiles:
                    d = open(os.path.join(self.files, 'data', name + '.bin'), 'rb').read()
                    self._uifiles[name] = (d, packed(d))
                d, (n, offs) = self._uifiles[name]
                if 0 <= idx < n:
                    img = tex_png(unpack(d, offs, idx))
            except (OSError, zlib.error, struct.error, IndexError):
                img = None
            self._ui[key] = img
        return self._ui[key]

    def ui_index(self, name, idx):
        """the palette numbers of a colour-indexed menu picture (see tex_index_png), cached"""
        if not hasattr(self, '_uix'):
            self._uix = {}
        key = (name, idx)
        if key not in self._uix:
            img = None
            try:
                d = open(os.path.join(self.files, 'data', name + '.bin'), 'rb').read()
                n, offs = packed(d)
                if 0 <= idx < n:
                    img = tex_index_png(unpack(d, offs, idx))
            except (OSError, zlib.error, struct.error, IndexError):
                img = None
            self._uix[key] = img
        return self._uix[key]

    def logo(self):
        """the Hottest Party logo (data/ddrmodesel.bin, picture 12)"""
        if getattr(self, '_logo', None) is None:
            try:
                d = open(os.path.join(self.files, 'data', 'ddrmodesel.bin'), 'rb').read()
                n, offs = packed(d)
                self._logo = rgb5a3_png(unpack(d, offs, 12))
            except (OSError, zlib.error, struct.error, IndexError):
                self._logo = b''
        return self._logo or None

    def jacket(self, slot):
        s = self.song(slot)
        if not s:
            return None
        k = min(s['ssq'], 49)
        if k not in self.banners:
            path = os.path.join(self.files, 'data', 'selcom.bin')
            try:
                d = open(path, 'rb').read()
                n, offs = packed(d)
                self.banners[k] = rgb5a3_png(unpack(d, offs, 8 + k)) if 8 + k < n else None
            except (OSError, zlib.error, struct.error):
                self.banners[k] = None
        return self.banners[k]


# ---- Groove Circuit: the requests' wording, read from mess/messdata_eng.bin ----
# The game's text uses its own codes for some characters (0x10 is a space and so on); the requests are two
# runs of 25 lines: round 1 starts at "Clear 1 designated song." and round 2 at "Clear 3 designated songs
# on Difficult...". Each is the first venue's one request, then three per venue (N songs, N designated
# songs, the Venue Master) for the other eight, in venue order.
_MCHR = {0x10: ' ', 0x82: ',', 0x85: '.', 0xc1: "'", 0xc2: '!', 0xc3: '?', 0xc0: '"', 0x0a: ' ',
         ord(']'): '(', ord('^'): ')', ord('='): '-'}


def _mtext(b):
    out, i = '', 0
    while i < len(b):
        c = b[i]
        if c == 0x1e:                     # a colour code and its argument
            i += 2
            continue
        out += _MCHR.get(c, chr(c) if 32 <= c < 127 else '')
        i += 1
    return re.sub(r'\s+', ' ', out).strip()


def gc_requests(files):
    p = os.path.join(files, 'mess', 'messdata_eng.bin')
    if not os.path.isfile(p):
        return None
    d = open(p, 'rb').read()
    lines = []
    for m in re.finditer(rb'\xff\x00\xff', d):
        e = d.find(b'\0', m.end())
        lines.append(_mtext(d[m.end():e if e > 0 else len(d)]))
    def run(first):
        i = next((k for k, t in enumerate(lines) if t.startswith(first)), None)
        return lines[i:i + 25] if i is not None and len(lines) >= i + 25 else None
    r1, r2 = run('Clear 1 designated song'), run('Clear 3 designated songs on Difficult')
    return dict(round1=r1, round2=r2) if r1 and r2 else None
