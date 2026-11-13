"""DanceDanceRevolution Hottest Party 3 (Wii), read from your extracted disc. Same engine as Hottest
Party 2, so this builds on hp2.py; what's different:

  sys/main.dol                     the song table: 140-byte records {name ptr, flags, kind, bpm,
                                   levels (beginner, basic, difficult, expert), ...}; it's found by
                                   the record that points at the short name "disturbia"
  files/ssq/ss9/MU_DDR_nnn.ss9     the step charts (song k = nnn k+1), the same format as HP2's
  files/sound/DDRHP3_SOUND.brsar   group k = song k's music (an RWAR), like HP2's ddr.brsar
  files/sound/stream/MU_SAM_nnn    the previews
  files/text/text_eng.bin          song titles: the credits ("Title" ... Performed by ...) and the
                                   unlock messages (NEW SONG!! "Title"); matched to the table's
                                   short names, so nothing is typed in here
  files/select/selMusic_us.bin     the song select pictures (US)
"""
import os
import re
import struct

import hp
import hp2
import hp2stage

SLOT_BASE = 3000            # HP3 songs are /api/.../3000 + id
SKIP = {55, 56, 57}         # the three lessons
COUNT = 62                  # ids 0..61 are songs (62 on are lesson steps)
STRIDE = 140
Thp = None                  # server.py hands over its THP movie reader


def find_files(root):
    """(sys folder, files folder) of an extracted Hottest Party 3 disc, or None"""
    if not root or not os.path.isdir(root):
        return None
    for sysdir, files in ((root, os.path.join(root, 'files')), (os.path.join(root, 'DATA'), os.path.join(root, 'DATA', 'files')),
                          (os.path.dirname(root), root)):
        if os.path.isfile(os.path.join(files, 'ssq', 'ss9', 'MU_DDR_001.ss9')) \
                and os.path.isfile(os.path.join(files, 'sound', 'DDRHP3_SOUND.brsar')) \
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
            if 'hottest party 3' in n.lower() and find_files(os.path.join(base, n)):
                return os.path.join(base, n)
    return None


# artists of the songs the text file doesn't credit (as their name bars on the disc show them)
ARTISTS = {
    24: 'Moby', 25: 'Danny Tenaglia', 30: 'NAOKI', 31: 'U1 feat. Tammy S. Hansen', 32: 'Black Rose Garden',
    33: 'NAOKI feat. Aleisha G', 34: 'TOMOSUKE feat. Adreana', 35: 'D-crew with VAL TIATIA', 36: 'Cheryl Horrocks',
    37: 'NM feat. Mr. E.', 38: 'Carlos Coco Garcia', 39: 'NAOKI feat. Anna Kaelin', 40: 'TЁЯRA', 41: 'TAG feat. Angie Lee',
    42: 'nc ft. NRG Factory', 43: 'NAOKI feat. Aleisha G', 44: 'jun feat. Sonnet', 45: 'jun', 46: 'TAG underground',
    47: 'TAG underground', 48: 'TAG underground', 49: 'jun', 50: 'WHITE WALL', 51: 'NM', 52: 'nc ft.Eddie Kay',
    53: 'Lea Drop feat. McCall Clark', 54: 'Brenda', 58: 'NAOKI', 59: 'NAOKI', 60: 'Various Artists', 61: 'Various Artists',
}


def _norm(s):
    s = s.lower().replace('♥', ' ').replace('’', '').replace("'", '')
    return re.sub(r'[^a-z0-9 ]', '', s)


class HP3Game(hp2.HP2Game):
    name = 'HOTTEST PARTY 3'
    disc = 'hp3'

    def __init__(self, root, Dol, Rsar):
        hit = find_files(root)
        if not hit:
            raise ValueError('not a Hottest Party 3 folder (needs files/ssq/ss9/MU_DDR_001.ss9 and files/sound/DDRHP3_SOUND.brsar)')
        self.root = root
        sysdir, self.files = hit
        self.dol = open(os.path.join(sysdir, 'sys', 'main.dol'), 'rb').read()
        self.rsar = Rsar(os.path.join(self.files, 'sound', 'DDRHP3_SOUND.brsar'))
        self.tabs = {}
        self._sel = None
        self.songs = self._songs()

    # ---- main.dol
    def _sections(self):
        d = self.dol
        return list(zip(struct.unpack_from('>18I', d, 0), struct.unpack_from('>18I', d, 0x48), struct.unpack_from('>18I', d, 0x90)))

    def _a2o(self, a):
        for of, ad, sz in self._sections():
            if sz and ad <= a < ad + sz:
                return of + a - ad
        return None

    def _o2a(self, o):
        for of, ad, sz in self._sections():
            if sz and of <= o < of + sz:
                return ad + o - of
        return None

    def _table_start(self):
        d = self.dol
        o = d.find(b'disturbia\0')
        a = self._o2a(o) if o >= 0 else None
        if a is None:
            return None
        key = struct.pack('>I', a)
        i = d.find(key)
        while i >= 0 and i % 4:
            i = d.find(key, i + 1)
        return i if i >= 0 else None

    def _table(self):
        """id -> (levels (beginner, basic, difficult, expert), (bpm lo, bpm hi), short name)"""
        out = {}
        t = self._table_start()
        if t is None:
            return out
        for k in range(COUNT):
            e = t + STRIDE * k
            ptr, fl, kind, bpm = struct.unpack_from('>4I', self.dol, e)
            lv = tuple(self.dol[e + 16:e + 20])
            if bpm < 0x10000:
                lo = hi = bpm
            else:                                    # a BPM range: two u16s
                lo, hi = sorted((bpm & 0xFFFF, bpm >> 16))
            o = self._a2o(ptr)
            short = self.dol[o:self.dol.find(b'\0', o)].decode('latin1') if o is not None else ''
            out[k] = (lv, (lo, hi), short)
        return out

    # ---- titles from the disc's English text
    def _titles(self):
        titles = {}
        try:
            d = open(os.path.join(self.files, 'text', 'text_eng.bin'), 'rb').read()
            parts = []
            for _, o, sz in hp2stage.wii_entries(d):
                parts += [p.decode('utf-8', 'replace') for p in d[o:o + sz].split(b'\0') if len(p) > 1]
        except (OSError, struct.error):
            return titles
        cur = None
        for p in parts:
            m = re.search(r'(?:(.+?)\s+-\s+)?#cm[“"](.+?)[”"]#ca', p)
            if m:
                cur = m.group(2).strip()
                titles.setdefault(cur, (m.group(1) or '').strip())
                continue
            m = re.match(r'Performed by\s*(.+)', p.replace('\xa0', ' '))
            if m and cur and not titles[cur]:
                titles[cur] = m.group(1).strip()
        for p in parts:
            m = re.search(r'NEW SONG!!\n"(.+?)"', p, re.S)
            if m:
                titles.setdefault(m.group(1).replace('\n', ' '), '')
        return titles

    def _name(self, short, titles, used):
        s = _norm(short).strip()
        if s.startswith('roppongi') or s.startswith('hottest p'):
            return None
        best, bl = None, 0
        for t in titles:
            n = _norm(t)
            l = 0
            while l < min(len(s), len(n)) and s[l] == n[l]:
                l += 1
            if l > bl or (l == bl and best in used):
                best, bl = t, l
        return best if bl >= min(5, len(s)) else None

    def _songs(self):
        tab = self._table()
        titles = self._titles()
        used = set()
        out = []
        for k in range(COUNT):
            if k in SKIP or k not in tab or k >= len(self.rsar.groups):
                continue
            try:
                u = self.chart_raw(k)
            except OSError:
                continue
            lvs, (lo, hi), short = tab[k]
            keys = {p2 for typ, p2, c, b in hp.chunks(u) if typ == 9}
            if not keys:
                continue
            by_diff = {4: lvs[0], 1: lvs[1], 2: lvs[2], 3: lvs[3]}
            single = [by_diff[dk] if (dk << 8 | 0x14) in keys else 0 for dk in hp.DIFF_ORDER] + [0]
            if not any(single):
                continue
            rad = {p2 >> 8: hp.radar(u, c, b) for typ, p2, c, b in hp.chunks(u) if typ == 9 and (p2 & 0xFF) == 0x14}
            radars = [rad.get(dk, [0, 0, 0, 0, 0]) for dk in hp.DIFF_ORDER] + [[0, 0, 0, 0, 0]]
            last = 0
            for typ, p2, c, b in hp.chunks(u):
                if typ == 9:
                    st = hp.hp_steps(c, b)
                    if st:
                        last = max(last, max(n[0] for n in st))
            title = self._name(short, titles, used)
            sn = _norm(short).strip()
            if sn.startswith('roppongi'):
                title, artist = 'roppongi EVOLVED Ver.' + 'ABC'[int(sn[-1]) - 1] if sn[-1] in '123' else 'roppongi EVOLVED', ''
            elif sn.startswith('hottest p'):
                title, artist = 'HOTTEST PARTY' + (' 2' if sn.endswith('2') else ''), ''
            elif title:
                used.add(title)
                artist = titles.get(title, '')
            else:
                title, artist = short.strip().title(), ''
            artist = artist or ARTISTS.get(k, '')
            slot = SLOT_BASE + k
            out.append(dict(slot=slot, full=slot, short=False, cut=None, name=title, artist=artist, hpTitle=title,
                            movieHP3=self.song_movie(k), disc='hp3', folder=self.name, single=single, double=[0, 0, 0, 0, 0],
                            bpm=[lo, hi], length=round(hp.tempo_time(u, last) + 2, 2),
                            radar=radars, preview=bool(self.preview_path(slot)), title=None,
                            jacket='/api/hp3art/%d' % slot, tab='/api/jacket/%d' % slot, alt=None, flags=0, tier=0, movie=None, ssq=k))
        return out

    # ---- movies: files/movie/pv/dddNNN.thp is song NNN-1's music video (the licensed songs and the two
    # HOTTEST PARTY medleys); the others play one of the stage loops (movie/stage), as the game does
    def movie_list(self, sub):
        d = os.path.join(self.files, 'movie', sub)
        try:
            return sorted(n for n in os.listdir(d) if n.lower().endswith('.thp') and not n.lower().startswith('cd'))
        except OSError:
            return []

    def song_movie(self, k):
        pv = 'ddr%03d.thp' % (k + 1)
        if os.path.isfile(os.path.join(self.files, 'movie', 'pv', pv)):
            return {'file': 'hp3:pv/' + pv, 'sync': True}
        loops = self.movie_list('stage')
        if loops:
            return {'file': 'hp3:stage/' + loops[(k * 7) % len(loops)], 'sync': False}
        return None

    def movie(self, rel):
        rel = rel.replace('\\', '/')
        if '..' in rel or not re.match(r'^[A-Za-z0-9_/]+\.thp$', rel):
            raise ValueError('bad movie name')
        if not hasattr(self, 'movies'):
            self.movies = {}
        if rel not in self.movies:
            self.movies[rel] = Thp(os.path.join(self.files, 'movie', rel.replace('/', os.sep)))
        return self.movies[rel]

    # ---- DDR SCHOOL: files/ssq/Lss9/LESSONnn.ss9 (1-6 STEP, 7-13 GIMMICK, 14-18 HAND LESSON), all at
    # 125 BPM over the lesson music (sound group 57, "Lesson2 by DJ"); the teacher's words for each are
    # text_eng.bin entry 14, line n (read from your disc, shown before the lesson)
    LESSON_BASE = 3900
    LESSON_GROUP = 57

    def lessons(self):
        if hasattr(self, '_lessons'):
            return self._lessons
        words = []
        try:
            d = open(os.path.join(self.files, 'text', 'text_eng.bin'), 'rb').read()
            _, o, sz = hp2stage.wii_entries(d)[14]
            words = [p.decode('utf-8', 'replace') for p in d[o:o + sz].split(b'\0') if len(p) > 3]
        except (OSError, IndexError, struct.error):
            words = []
        out = []
        for n in range(1, 19):
            path = os.path.join(self.files, 'ssq', 'Lss9', 'LESSON%02d.ss9' % n)
            if not os.path.isfile(path):
                continue
            kind, k = ('STEP LESSON', n) if n <= 6 else ('GIMMICK LESSON', n - 6) if n <= 13 else ('HAND LESSON', n - 13)
            text = words[n] if n < len(words) else ''
            text = re.sub(r'#[a-z]{2}', '', text)
            out.append(dict(slot=self.LESSON_BASE + n, n=n, name='%s %d' % (kind, k), kind=kind, artist='DDR SCHOOL', words=text,
                            disc='hp3', lesson=n, single=[1, 0, 0, 0, 0], double=[0, 0, 0, 0, 0], bpm=[125, 125],
                            radar=[[0] * 5] * 5, preview=False, jacket=None, title=None, movie=None, folder=self.name))
        self._lessons = out
        return out

    def song(self, slot):
        if self.LESSON_BASE < slot <= self.LESSON_BASE + 18:
            return next((l for l in self.lessons() if l['slot'] == slot), None)
        return super().song(slot)

    def chart(self, slot):
        s = self.song(slot)
        if s and s.get('lesson'):
            with open(os.path.join(self.files, 'ssq', 'Lss9', 'LESSON%02d.ss9' % s['lesson']), 'rb') as f:
                return hp.to_ss4(f.read())
        return super().chart(slot)

    def audio(self, slot):
        s = self.song(slot)
        if s and s.get('lesson'):
            o = self.rsar.groups[self.LESSON_GROUP]
            foff, fsize, woff, wsize = struct.unpack_from('>4I', self.rsar.d, o + 16)
            with open(self.rsar.path, 'rb') as f:
                f.seek(woff)
                data = f.read(wsize)
            return data if data[:4] == b'RWAR' else None
        return super().audio(slot)

    def chart_raw(self, k):
        with open(os.path.join(self.files, 'ssq', 'ss9', 'MU_DDR_%03d.ss9' % (k + 1)), 'rb') as f:
            return f.read()

    def preview_path(self, slot):
        d = os.path.join(self.files, 'sound', 'stream')
        want = 'mu_sam_%03d.brstm' % (slot - SLOT_BASE + 1)
        try:
            hit = next((f for f in os.listdir(d) if f.lower() == want), None)
        except OSError:
            hit = None
        return os.path.join(d, hit) if hit else None

    # ---- pictures. HP3 nests its pictures in WII containers several levels deep; a picture is named by
    # the path of entry numbers down to its TPL, then the picture's number in it (e.g. 0.0.0.4.0)
    def _pic(self, rel, path):
        if not hasattr(self, '_files'):
            self._files, self._pics = {}, {}
        key = (rel, tuple(path))
        if key in self._pics:
            return self._pics[key]
        img = None
        try:
            if rel not in self._files:
                self._files[rel] = open(os.path.join(self.files, *rel.split('/')), 'rb').read()
            d = self._files[rel]
            o, sz = 0, len(d)
            for i in path[:-1]:
                o2, sz2 = hp2stage.wii_entries(d[o:o + sz])[i][1:]
                o, sz = o + o2, sz2
            if d[o:o + 4] == b'\x00\x20\xaf\x30':
                lst = hp2.tpl_list(d, o)
                if 0 <= path[-1] < len(lst):
                    img = hp2.tpl_png(d, *lst[path[-1]])
        except (OSError, IndexError, struct.error, ValueError):
            img = None
        self._pics[key] = img
        return img

    def art(self, slot):
        """the song's picture (256x256): files/2Dcommon/comAF_US.bin entry 8, picture k = song k"""
        s = self.song(slot)
        return self._pic('2Dcommon/comAF_US.bin', [8, s['ssq']]) if s else None

    def jacket(self, slot):
        """the song's name bar (232x42, title and artist): comAF_US.bin entry 9, picture k = song k"""
        s = self.song(slot)
        return self._pic('2Dcommon/comAF_US.bin', [9, s['ssq']]) if s else None

    def sel(self, path):
        """a song select picture from files/select/selMusic_us.bin by its path"""
        return self._pic('select/selMusic_us.bin', [0] + list(path))


if __name__ == '__main__':
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import server
    g = HP3Game(sys.argv[1], server.Dol, server.Rsar)
    for s in g.songs:
        print(s['slot'], repr(s['name']), '|', s['artist'], s['bpm'], s['single'], s['preview'], round(s['length']))
    print(len(g.songs), 'songs')
