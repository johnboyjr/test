"""Dance Dance Revolution Hottest Party 2 (Wii, USA) from an extracted disc folder.

  sys/main.dol                   the song table at 0x801d72c0 (file offset 0x1d33c0): 32 bytes per song id
                                 (name pointer, flags, -1 or BPM kind, BPM; the four levels, unlock flags)
  files/ssq/MU_DDR_nnn.ss9       song id nnn-1's chart: the same chunk format as Hottest Party 1
                                 (type 1 tempo, type 9 steps per difficulty), read with hp.py's code
  files/sound/ddr.brsar          group k = song id k's music, already an RWAR holding one RWAV (stereo,
                                 32 kHz DSP-ADPCM), the shape DDR II's songs come in
  files/sound/stream/mu_sam_nnn  the 30 second previews (BRSTM)
  files/select/selMusic.bin      the song name tabs (a TPL inside the game's WII container)
"""
import os
import re
import struct
import zlib

import hp

TPL_MAGIC = b'\x00\x20\xaf\x30'
SLOT_BASE = 2000            # HP2 songs are /api/.../2000 + id
TABLE = 0x1d33c0             # file offset of the song table in main.dol
SKIP = {47, 52}              # the two lessons (Lesson2 by DJ, Lesson by DJ)

# title, artist as the game shows them on its tabs, by song id
INFO = {
    0: ('Come Rain Come Shine', 'Jenn Cuneta'), 1: ('Tribulations', 'LCD Soundsystem'),
    2: ('Tootsee Roll', 'The Block Brothers & Hollywood J'), 3: ('We Got The Beat', "Pop n' Fresh"),
    4: ('I Want Candy', "Pop n' Fresh"), 5: ('Black or White', 'Prince Royal'),
    6: ('Walking On Sunshine', 'The Flash'), 7: ("FIVE O'Clock", 'flow'), 8: ('Red Alert', 'Basement Jaxx'),
    9: ("Can't Help Falling In Love", 'Cut N Edge'), 10: ('My Destiny', 'ASHER'), 11: ('Nite-Runner', 'FRAZ'),
    12: ('Bust A Move', 'Young MC'), 13: ("Don't You (Forget About Me)", 'NuFoundation'),
    14: ("You're The One That I Want", 'DAVE V & TAYA'), 15: ('Umbrella', 'Haley Hunt'),
    16: ('All Good Things (Come to an End)', 'Hamel & Naughty G.'), 17: ('I Ran', 'Spacebar vs. Naughty G'),
    18: ('Scramble', 'System 7'), 19: ('D.A.N.C.E.', 'Justice'), 20: ('Feel Together', 'Mickey Disco'),
    21: ('Makes Me Wonder', 'Sunshine Superman'), 22: ('Everybody Dance', 'TSMV'), 23: ('Obsession', 'Brooklyn Fire'),
    24: ('Call On Me', 'flow'), 25: ('JUST BELIEVE', 'Lea Drop feat.Marissa Ship'),
    26: ('SUPER HERO', 'DJ YOSHITAKA feat.Michaela Thurlow'), 27: ('INTO YOUR HEART (Ruffage remix)', 'NAOKI feat.YASMINE'),
    28: ('LOVING YOU (Epidemik remix)', 'TONI LEO'), 29: ('I WANT YOUR LOVE (Darwin remix)', 'GAV'),
    30: ('STAY (Joey Riot remix)', 'DANNY D'), 31: ('REACH THE SKY (Orbit1 remix)', 'TAYA'),
    32: ('No Matter What', 'jun feat.Rita Boudreau'), 33: ('escape', 'U1 & Krystal B'),
    34: ("Settin' the Scene", 'U1 night style'), 35: ('Somehow You Found Me', 'DIGI-SEQ-BAND2000'),
    36: ('Unity', 'The Remembers'), 37: ('My Love', 'NM feat.Melissa Petty'), 38: ('Desert Journey', 'dj TAKA'),
    39: ("Dreamin'", 'TOMOSUKE feat. Adreana'), 40: ('The Lonely Streets', 'DJ Yoshitaka feat.Robert "RAab" Stevenson'),
    41: ('KYOKA-SUIGETSU-ROW (DDR EDITION)', 'TËЯRA feat.Uchusentai NOIZ'), 42: ('Habibe (Antuh muhleke)', 'Wendy Parr'),
    43: ("Racing with Time (NAOKI's 999 remix)", 'jun feat.Godis (Heather Twede)'),
    44: ('Closer to my Heart (jun remix)', 'NM feat.Heather Elmer'), 45: ('We Can Win the Fight', 'D-crew feat.Matt Tucker'),
    46: ('Open Your Eyes', 'NM feat.JaY_bEe (JB Ah-Fua)'), 48: ('SILVER☆DREAM', 'jun'),
    49: ('osaka EVOLVED -MAIDO,OHKINI!- (Ver.A)', 'NAOKI underground'),
    50: ('osaka EVOLVED -MAIDO,OHKINI!- (Ver.B)', 'NAOKI underground'),
    51: ('osaka EVOLVED -MAIDO,OHKINI!- (Ver.C)', 'NAOKI underground'),
}
# each song's name tab in selMusic.bin's picture list
TAB = {k: 57 + k for k in range(47)}
TAB.update({48: 105, 49: 168, 50: 169, 51: 170})


def find_files(root):
    """(sys folder, files folder) of an extracted Hottest Party 2 disc, or None"""
    if not root or not os.path.isdir(root):
        return None
    for sysdir, files in ((root, os.path.join(root, 'files')), (os.path.join(root, 'DATA'), os.path.join(root, 'DATA', 'files')),
                          (os.path.dirname(root), root)):
        if os.path.isfile(os.path.join(files, 'ssq', 'MU_DDR_001.ss9')) and os.path.isfile(os.path.join(files, 'sound', 'ddr.brsar')) \
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
            if 'hottest party 2' in n.lower() and find_files(os.path.join(base, n)):
                return os.path.join(base, n)
    return None


def tpl_list(d, b):
    """a TPL at offset b: [(w, h, format, data offset)]"""
    cnt = struct.unpack_from('>I', d, b + 4)[0]
    out = []
    for i in range(cnt):
        ih = struct.unpack_from('>I', d, b + 12 + 8 * i)[0]
        h, w, fmt, off = struct.unpack_from('>HHII', d, b + ih)
        out.append((w, h, fmt, b + off))
    return out


def tpl_png(d, w, h, fmt, off):
    """one TPL picture as a PNG (RGB5A3 and CMPR, the formats the menus use)"""
    px = bytearray(w * h * 4)

    def put(x, y, c):
        if x < w and y < h:
            o = (y * w + x) * 4
            px[o:o + 4] = c
    if fmt == 5:
        p = off
        for ty in range(0, h, 4):
            for tx in range(0, w, 4):
                for y in range(4):
                    for x in range(4):
                        v = (d[p] << 8) | d[p + 1]
                        p += 2
                        if v & 0x8000:
                            c = bytes((((v >> 10) & 31) * 255 // 31, ((v >> 5) & 31) * 255 // 31, (v & 31) * 255 // 31, 255))
                        else:
                            c = bytes((((v >> 8) & 15) * 17, ((v >> 4) & 15) * 17, (v & 15) * 17, ((v >> 12) & 7) * 255 // 7))
                        put(tx + x, ty + y, c)
    elif fmt == 6:                    # RGBA8: 4x4 tiles, 32 bytes of alpha/red then 32 of green/blue
        p = off
        for ty in range(0, h, 4):
            for tx in range(0, w, 4):
                ar, gb = d[p:p + 32], d[p + 32:p + 64]
                p += 64
                for i in range(16):
                    put(tx + (i & 3), ty + (i >> 2), bytes((ar[2 * i + 1], gb[2 * i], gb[2 * i + 1], ar[2 * i])))
    elif fmt == 14:
        def c565(v):
            return ((v >> 11) * 255 // 31, ((v >> 5) & 63) * 255 // 63, (v & 31) * 255 // 31)
        p = off
        for ty in range(0, h, 8):
            for tx in range(0, w, 8):
                for sy in (0, 4):
                    for sx in (0, 4):
                        c0, c1, bits = struct.unpack_from('>HHI', d, p)
                        p += 8
                        a, b = c565(c0), c565(c1)
                        if c0 > c1:
                            pal = [a, b, tuple((2 * a[k] + b[k]) // 3 for k in range(3)), tuple((a[k] + 2 * b[k]) // 3 for k in range(3))]
                            al = [255] * 4
                        else:
                            pal = [a, b, tuple((a[k] + b[k]) // 2 for k in range(3)), (0, 0, 0)]
                            al = [255, 255, 255, 0]
                        for y in range(4):
                            for x in range(4):
                                v = (bits >> (30 - 2 * (y * 4 + x))) & 3
                                put(tx + sx + x, ty + sy + y, bytes(pal[v]) + bytes((al[v],)))
    else:
        return None
    return hp.png(w, h, bytes(px))


class HP2Game:
    name = 'HOTTEST PARTY 2'

    def __init__(self, root, Dol, Rsar):
        hit = find_files(root)
        if not hit:
            raise ValueError('not a Hottest Party 2 folder (needs files/ssq/MU_DDR_001.ss9 and files/sound/ddr.brsar)')
        self.root = root
        sysdir, self.files = hit
        self.sysdir = os.path.join(sysdir, 'sys')
        self.dol = open(os.path.join(sysdir, 'sys', 'main.dol'), 'rb').read()
        self.rsar = Rsar(os.path.join(self.files, 'sound', 'ddr.brsar'))
        self.tabs = {}
        self._sel = None
        self.songs = self._songs()

    def _table(self):
        """the main.dol song table: id -> (levels (beginner, basic, difficult, expert), (bpm lo, bpm hi))"""
        out = {}
        for k in range(53):
            ptr, fl, kind, bpm = struct.unpack_from('>4I', self.dol, TABLE + 32 * k)
            lv = tuple(self.dol[TABLE + 32 * k + 16:TABLE + 32 * k + 20])
            if kind == 0xFFFFFFFF:
                lo = hi = bpm
            else:
                lo, hi = sorted((bpm & 0xFFFF, bpm >> 16))
            out[k] = (lv, (lo, hi))
        return out

    def chart_raw(self, k):
        with open(os.path.join(self.files, 'ssq', 'MU_DDR_%03d.ss9' % (k + 1)), 'rb') as f:
            return f.read()

    def _songs(self):
        tab = self._table()
        out = []
        for k in sorted(INFO):
            if k in SKIP or k >= len(self.rsar.groups):
                continue
            try:
                u = self.chart_raw(k)
            except OSError:
                continue
            lvs, (lo, hi) = tab.get(k, ((0, 0, 0, 0), (0, 0)))
            keys = {p2 for typ, p2, c, b in hp.chunks(u) if typ == 9}
            # levels: beginner, basic, difficult, expert (the table's order) -> the order DIFF_ORDER lists them in
            by_diff = {4: lvs[0], 1: lvs[1], 2: lvs[2], 3: lvs[3]}
            single = [by_diff[dk] if (dk << 8 | 0x14) in keys else 0 for dk in hp.DIFF_ORDER] + [0]
            rad = {p2 >> 8: hp.radar(u, c, b) for typ, p2, c, b in hp.chunks(u) if typ == 9 and (p2 & 0xFF) == 0x14}
            radars = [rad.get(dk, [0, 0, 0, 0, 0]) for dk in hp.DIFF_ORDER] + [[0, 0, 0, 0, 0]]
            last = 0
            for typ, p2, c, b in hp.chunks(u):
                if typ == 9:
                    st = hp.hp_steps(c, b)
                    if st:
                        last = max(last, max(n[0] for n in st))
            title, artist = INFO[k]
            slot = SLOT_BASE + k
            out.append(dict(slot=slot, full=slot, short=False, cut=None, name=title, artist=artist, hpTitle=title,
                            disc='hp2', folder=self.name, single=single, double=[0, 0, 0, 0, 0],
                            bpm=[lo, hi], length=round(hp.tempo_time(u, last) + 2, 2),
                            radar=radars, preview=bool(self.preview_path(slot)), title=None,
                            jacket='/api/hp2art/%d' % slot, tab='/api/jacket/%d' % slot, alt=None, flags=0, tier=0, movie=None, ssq=k))
        return out

    def song(self, slot):
        for s in self.songs:
            if s['slot'] == slot:
                return s
        return None

    def chart(self, slot):
        s = self.song(slot)
        return hp.to_ss4(self.chart_raw(s['ssq'])) if s else None

    def audio(self, slot):
        """group k's wave data is already an RWAR (one stereo RWAV) - sent as it is"""
        s = self.song(slot)
        if not s:
            return None
        o = self.rsar.groups[s['ssq']]
        foff, fsize, woff, wsize = struct.unpack_from('>4I', self.rsar.d, o + 16)
        with open(self.rsar.path, 'rb') as f:
            f.seek(woff)
            data = f.read(wsize)
        return data if data[:4] == b'RWAR' else None

    def preview_path(self, slot):
        p = os.path.join(self.files, 'sound', 'stream', 'mu_sam_%03d.brstm' % (slot - SLOT_BASE + 1))
        return p if os.path.isfile(p) else None

    def gui(self, idx):
        """a picture from files/game/gui.tpl (the gameplay screen: gauge, score panel, judgments, banners)"""
        if not hasattr(self, '_gui'):
            self._gui = {}
            try:
                d = open(os.path.join(self.files, 'game', 'gui.tpl'), 'rb').read()
                self._guisrc = (d, tpl_list(d, 0))
            except OSError:
                self._guisrc = None
        if idx not in self._gui:
            img = None
            if self._guisrc and 0 <= idx < len(self._guisrc[1]):
                try:
                    img = tpl_png(self._guisrc[0], *self._guisrc[1][idx])
                except (struct.error, IndexError):
                    img = None
            self._gui[idx] = img
        return self._gui[idx]

    def sel(self, idx):
        """a picture from files/select/selMusic.bin (the song select: header, gold panels, difficulty bars,
        grades, the song-tab frames...)"""
        if not hasattr(self, '_selpics'):
            self._selpics = {}
        if idx not in self._selpics:
            img = None
            try:
                if not getattr(self, '_sel', None):
                    d = open(os.path.join(self.files, 'select', 'selMusic.bin'), 'rb').read()
                    self._sel = (d, tpl_list(d, 0x20))
                d, lst = self._sel
                if 0 <= idx < len(lst):
                    img = tpl_png(d, *lst[idx])
            except (OSError, struct.error, IndexError):
                img = None
            self._selpics[idx] = img
        return self._selpics[idx]

    def art(self, slot):
        """the song's picture (226x110) from files/select/select_cmn.bin: a WII container whose second
        entry holds a TPL of 115 such pictures. Picture k is song k; osaka EVOLVED Ver.A/B/C are 51-53."""
        s = self.song(slot)
        if not s:
            return None
        if not hasattr(self, '_art'):
            self._art, self._artsrc = {}, None
            try:
                import hp2stage
                d = open(os.path.join(self.files, 'select', 'select_cmn.bin'), 'rb').read()
                for _, o, sz in hp2stage.wii_entries(d):
                    if d[o:o + 4] != b'WII\0':
                        continue
                    for _, so, _ in hp2stage.wii_entries(d[o:o + sz]):
                        if d[o + so:o + so + 4] == TPL_MAGIC:
                            lst = tpl_list(d, o + so)
                            if len(lst) > 50 and sum(1 for w, h, _, _ in lst if (w, h) == (226, 110)) > 50:
                                self._artsrc = (d, lst)
            except (OSError, struct.error, IndexError, ValueError):
                self._artsrc = None
        k = s['ssq']
        i = {49: 51, 50: 52, 51: 53}.get(k, k)
        if i not in self._art:
            img = None
            if self._artsrc and i < len(self._artsrc[1]):
                try:
                    img = tpl_png(self._artsrc[0], *self._artsrc[1][i])
                except (struct.error, IndexError):
                    img = None
            self._art[i] = img
        return self._art[i]

    def jacket(self, slot):
        """the song's name tab from the song select (230x54)"""
        s = self.song(slot)
        if not s:
            return None
        k = s['ssq']
        if k not in self.tabs:
            img = None
            try:
                if self._sel is None:
                    d = open(os.path.join(self.files, 'select', 'selMusic.bin'), 'rb').read()
                    self._sel = (d, tpl_list(d, 0x20))
                d, lst = self._sel
                i = TAB.get(k)
                if i is not None and i < len(lst):
                    img = tpl_png(d, *lst[i])
            except (OSError, struct.error, IndexError):
                img = None
            self.tabs[k] = img
        return self.tabs[k]


if __name__ == '__main__':
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import server
    g = HP2Game(sys.argv[1], server.Dol, server.Rsar)
    print(len(g.songs), 'songs')
    for s in g.songs[:5] + g.songs[-4:]:
        print(s['slot'], s['name'], '/', s['artist'], s['bpm'], s['single'], s['length'])
    print('chart bytes', len(g.chart(g.songs[0]['slot'])), 'audio bytes', len(g.audio(g.songs[0]['slot']) or b''),
          'jacket', len(g.jacket(g.songs[0]['slot']) or b''))


# ---- Groove Arena: the requests' wording and the songs it unlocks, read from text/text_eng.bin ----
# entry 6 holds the 58 requests in order; entry 4 the unlock messages ('#tj' lines name the songs, in the
# order Groove Arena hands them out).
def ga_texts(files):
    import hp2stage
    p = os.path.join(files, 'text', 'text_eng.bin')
    if not os.path.isfile(p):
        return None
    d = open(p, 'rb').read()
    E = hp2stage.wii_entries(d)

    def lines(i):
        _, o, sz = E[i]
        return [x.decode('utf-8', 'replace') for x in d[o:o + sz].split(b'\0')]
    req = []
    for x in lines(6):
        t = re.sub(r'\s+', ' ', x.replace('%%', '%').replace('　', ' ')).strip()
        if re.match(r'^(Clear|Beat) ', t):
            req.append(t)
    songs = []
    for x in lines(4):
        if x.startswith('#tj'):
            songs += [re.sub(r'\s+', ' ', s).strip() for s in re.findall(r'"([^"]+)"', x)]
    return dict(requests=req, unlocks=songs) if len(req) >= 58 else None


# ---- Groove Arena's own request table, read from sys/main.dol ----
# 2 rounds x 11 arenas x 3 request slots, 60 bytes each (the game indexes it round*1980 + arena*180 +
# slot*60): kind, difficulty (0 any, 1 BASIC, 2 DIFFICULT, 3 EXPERT), a stage/group number, the condition
# and its value, then X, Y and up to 8 more numbers. An empty slot is kind 0.
#   kind 1  clear X songs              kind 2  clear X courses
#   kind 3  clear the designated songs X, Y, ...      kind 4  clear designated course X
#   kind 5  beat dancer Y in song X    kind 6  beat dancer(s) Y, ... in course X
#   kind 7  the first request (clear a song)
# condition: 1 grade (2 C, 3 B, 4 A), 2 combo over, 4 score over, 5 gauge %, 6 Boo at most,
#            7 PERFECT over, 8 GREAT over.  A dancer is level*1000 + character (levels 0-3).
GA_GRADE = {1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'AA', 6: 'AAA'}


def ga_table(root_sys):
    p = os.path.join(root_sys, 'main.dol')
    if not os.path.isfile(p):
        return None
    d = open(p, 'rb').read()
    i = d.find(struct.pack('>I', 5000000))
    while i >= 0:                                   # the 5,000,000-point requests: value at +16 of a record
        o = i - 16
        if 0 < struct.unpack_from('>I', d, o)[0] <= 7 and struct.unpack_from('>I', d, o + 4)[0] <= 3:
            while o >= 60 and struct.unpack_from('>I', d, o - 60)[0] <= 7 and struct.unpack_from('>I', d, o - 56)[0] <= 3 \
                    and struct.unpack_from('>I', d, o - 52)[0] < 0x100:
                o -= 60
            # the table starts on a round boundary: 66 records
            recs = [struct.unpack_from('>15I', d, o + 60 * k) for k in range(66)]
            if all(r[0] <= 7 and r[1] <= 3 for r in recs):
                return recs
        i = d.find(struct.pack('>I', 5000000), i + 1)
    return None


def ga_rounds(sysdir, texts):
    recs = ga_table(sysdir)
    if not recs:
        return None
    T = list(texts or [])
    out, ti = [], 0
    for rnd in range(2):
        arenas = []
        for a in range(11):
            reqs = []
            for s in range(3):
                r = recs[rnd * 33 + a * 3 + s]
                kind, diff, grp, cond, val, X, Y = r[:7]
                extra = [x for x in r[7:] if x != 0xFFFFFFFF]
                if kind == 0:
                    continue
                q = dict(kind=kind, diff=diff, stage=grp, text=T[ti] if ti < len(T) else '')
                ti += 1
                if cond == 1: q['grade'] = GA_GRADE.get(val, 'C')
                elif cond == 2: q['combo'] = val
                elif cond == 4: q['score'] = val
                elif cond == 5: q['gauge'] = val
                elif cond == 6: q['boo'] = val
                elif cond == 7: q['perfect'] = val
                elif cond == 8: q['great'] = val
                if kind in (1, 2, 7):
                    q['n'] = 1 if kind == 7 else X
                elif kind == 3:
                    q['songs'] = [x for x in [X, Y] + extra if x != 0xFFFFFFFF and x < 1000]
                elif kind == 4:
                    q['course'] = X
                elif kind == 5:
                    q['songs'] = [X]
                    q['dancers'] = [Y]
                elif kind == 6:
                    q['course'] = X
                    ds = [Y] + extra
                    q['dancers'] = [x for x in ds if x >= 1000 or x == Y][:3] if Y != 0 else [Y] + [x for x in extra if x < 0x2e][:2]
                reqs.append(q)
            arenas.append(reqs)
        out.append(arenas)
    return out
