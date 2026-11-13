"""DDR II PC - local server.

Reads the extracted Dance Dance Revolution II (USA, Wii) files on request and serves
them to the browser game in web/. Nothing is converted or copied; the game folder is
only ever read. Standard library only.
"""
import json, os, struct, sys, threading, time, traceback, webbrowser, subprocess, re, math
from sfx import SoundIndex
import dance
import custom
import hp
import hp2
import hp3
import hp2stage
import hpstage
import hpchar
import hp2char
import ddr2char
from lights import LIGHTS
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, unquote, parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, 'web')
SAVE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'save.json')
CUSTOM_DIR = os.path.join(HERE, 'Custom Songs')
LIB = None


def library():
    global LIB
    if LIB is None:
        LIB = custom.Library(CUSTOM_DIR)
    return LIB
SETTINGS = os.path.join(HERE, 'settings.json')
PORT = 8767

DB_VA = 0x802A44A8          # song table (US, SUREA4)
DB_STRIDE = 412
DB_COUNT = 200
SNDTAB_VA = 0x8027A5B8      # per slot: group, music sound, voice sound, 0, 0
CUSTOM_FLAG = 0x80000000


def log(*a):
    msg = time.strftime('%H:%M:%S ') + ' '.join(str(x) for x in a)
    print(msg, flush=True)
    try:
        with open(os.path.join(HERE, 'log.txt'), 'a', encoding='utf-8') as f:
            f.write(msg + '\n')
    except OSError:
        pass


# ------------------------------------------------------------------ settings
def load_settings():
    try:
        with open(SETTINGS, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_settings(s):
    tmp = SETTINGS + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(s, f, indent=1)
    os.replace(tmp, SETTINGS)


# ------------------------------------------------------------------ game files
def locate(root):
    """Return (main.dol path, files root) for an extracted disc, or None."""
    if not root or not os.path.isdir(root):
        return None
    cands = [(os.path.join(root, 'sys', 'main.dol'), root),
             (os.path.join(root, 'sys', 'main.dol'), os.path.join(root, 'files')),
             (os.path.join(root, 'DATA', 'sys', 'main.dol'), os.path.join(root, 'DATA', 'files'))]
    for dol, files in cands:
        if os.path.isfile(dol) and os.path.isfile(os.path.join(files, 'sound', 'DDRHP5_SOUND.brsar')):
            return dol, files
    for depth in (1, 2):                       # e.g. a disc extracted into a sub-folder
        for dp, dirs, _ in os.walk(root):
            if dp[len(root):].count(os.sep) >= depth:
                dirs[:] = []
                continue
            for d in dirs:
                hit = locate_here(os.path.join(dp, d))
                if hit:
                    return hit
    return None


def locate_here(root):
    for dol, files in [(os.path.join(root, 'sys', 'main.dol'), root),
                       (os.path.join(root, 'sys', 'main.dol'), os.path.join(root, 'files'))]:
        if os.path.isfile(dol) and os.path.isfile(os.path.join(files, 'sound', 'DDRHP5_SOUND.brsar')):
            return dol, files
    return None


def default_game_folder():
    home = os.path.expanduser('~')
    for base in (os.path.join(home, 'Downloads'), os.path.join(home, 'Desktop'), home):
        if not os.path.isdir(base):
            continue
        for name in sorted(os.listdir(base)):
            if 'revolution ii' in name.lower():
                p = os.path.join(base, name)
                if locate(p):
                    return p
    return None


class Dol:
    def __init__(self, path):
        self.d = open(path, 'rb').read()
        d = self.d
        self.secs = [s for s in zip(struct.unpack_from('>18I', d, 0), struct.unpack_from('>18I', d, 0x48),
                                    struct.unpack_from('>18I', d, 0x90)) if s[2]]

    def off(self, va):
        for o, a, s in self.secs:
            if a <= va < a + s:
                return o + va - a
        return None

    def u32(self, va):
        return struct.unpack_from('>I', self.d, self.off(va))[0]

    def va(self, off):
        for o, a, s in self.secs:
            if o <= off < o + s:
                return a + off - o
        return None

    def bytes(self, va, n):
        o = self.off(va)
        return self.d[o:o + n]

    def cstr(self, va):
        o = self.off(va)
        if o is None:
            return ''
        return self.d[o:self.d.index(b'\0', o)].decode('latin1')


class Rsar:
    """Just enough of the NW4R sound archive index to find songs and previews."""

    def __init__(self, path):
        self.path = path
        with open(path, 'rb') as f:
            hdr = f.read(0x40)
            symb, symb_sz, info, info_sz = struct.unpack_from('>4I', hdr, 0x10)
            f.seek(info)
            self.d = f.read(info_sz)
            f.seek(symb)
            sy = f.read(symb_sz)
        st = 8 + struct.unpack_from('>I', sy, 8)[0]
        self.strings = []
        for i in range(struct.unpack_from('>I', sy, st)[0]):
            o = 8 + struct.unpack_from('>I', sy, st + 4 + 4 * i)[0]
            self.strings.append(sy[o:sy.index(b'\0', o)].decode('latin1'))
        self.ib = 8
        U = lambda o: struct.unpack_from('>I', self.d, o)[0]
        self.U = U

        def table(ref):
            t = self.ib + U(ref + 4)
            return [self.ib + U(t + 4 + 8 * i + 4) for i in range(U(t))]
        self.sounds = table(self.ib + 0)
        self.files = table(self.ib + 24)
        self.groups = table(self.ib + 32)

    def sound_file(self, i):
        return self.U(self.sounds[i] + 4)

    def file_ext(self, i):
        ext = self.U(self.files[i] + 16)
        if not ext:
            return None
        o = self.ib + ext
        return self.d[o:self.d.index(b'\0', o)].decode('latin1')

    def group_wave(self, g):
        o = self.groups[g]
        woff, wsize = struct.unpack_from('>II', self.d, o + 24)
        return woff, wsize


def wii_entries(d, base):
    n = struct.unpack_from('>I', d, base + 8)[0]
    return [struct.unpack_from('>II', d, base + 0x10 + 8 * i) for i in range(n)]


class Art:
    """Jacket (/9) and title (/10) textures in 2Dcommon/comAF_US.bin."""

    def __init__(self, path):
        self.d = open(path, 'rb').read()
        ents = wii_entries(self.d, 0)
        self.tpl = {'jacket': ents[9][0], 'title': ents[10][0]}

    def image(self, kind, idx):
        d, a = self.d, self.tpl[kind]
        n, table = struct.unpack_from('>II', d, a + 4)
        if not 0 <= idx < n:
            return None
        io = struct.unpack_from('>I', d, a + table + 8 * idx)[0]
        h, w, fmt, off = struct.unpack_from('>HHII', d, a + io)
        if w <= 8 or h <= 8:
            return None
        bw, bh = {14: (8, 8), 5: (4, 4)}.get(fmt, (0, 0))
        if not bw:
            return None
        size = ((w + bw - 1) // bw) * ((h + bh - 1) // bh) * {14: 32, 5: 32}[fmt]
        data = d[a + off:a + off + size]
        return struct.pack('>HHII', w, h, fmt, len(data)) + data


# Files the browser may read pieces of (graphics), by short name. US versions first.
RES_FILES = {
    'gui': ['game/gui_us.tpl', 'game/gui.tpl'],
    'cmn': ['game/GAME_CMN_US.bin'],
    'mfm': ['game/METER_FM_US.bin'],
    'ssq': ['ssq/SSQ_CMN.bin'],
    'bg': ['game/bg.tpl'],
    'pvbg': ['game/pv_bg.tpl'],
    'res': ['select/selResult_us.bin'],
    'mus': ['select/selMusic_us.bin'],
    'sel': ['select/select_bin_us.bin'],
    'scm': ['select/select_cmn.bin'],
    'ttl': ['select/selTitle_US.bin', 'select/selTitle_us.bin'],
    'af': ['2Dcommon/comAF_US.bin'],
    'eff': ['game/GAME_APL_EFF.bin'],
}


class Resources:
    """Hands out pieces of the game's WII containers (usually TPL texture sets)."""

    def __init__(self, files):
        self.files = files
        self.cache = {}

    def data(self, key):
        if key not in self.cache:
            for rel in RES_FILES.get(key, []):
                p = os.path.join(self.files, rel.replace('/', os.sep))
                if os.path.isfile(p):
                    with open(p, 'rb') as f:
                        self.cache[key] = f.read()
                    break
            else:
                self.cache[key] = None
        return self.cache[key]

    def get(self, key, path):
        d = self.data(key)
        if d is None:
            return None
        base, size = 0, len(d)
        for part in [x for x in path.split('/') if x]:
            if d[base:base + 4] != b'WII\0':
                return None
            ents = wii_entries(d, base)
            i = int(part)
            if not 0 <= i < len(ents):
                return None
            o, size = ents[i]
            base += o
        return d[base:base + size]


class Thp:
    """THP movie (Motion-JPEG frames, optional DSP-ADPCM audio)."""

    def __init__(self, path):
        self.path = path
        with open(path, 'rb') as f:
            h = f.read(0x30)
            (magic, ver, maxbuf, maxaudio, fps, nframes, first, datasize, comp_off, _, data_off,
             last_off) = struct.unpack('>4sIIIfIIIIIII', h)
            if magic != b'THP\0':
                raise ValueError('not a THP movie')
            f.seek(comp_off)
            c = f.read(0x60)
        ncomp = struct.unpack_from('>I', c, 0)[0]
        self.types = [t for t in c[4:4 + 16][:ncomp]]
        p = 20
        self.w = self.h = 0
        self.audio = None
        for t in self.types:
            if t == 0:
                self.w, self.h = struct.unpack_from('>II', c, p); p += 12 if ver >= 0x11000 else 8
            elif t == 1:
                nch, freq, nsamp = struct.unpack_from('>III', c, p)
                self.audio = {'channels': nch, 'rate': freq, 'samples': nsamp}
                p += 16 if ver >= 0x11000 else 12
        self.fps, self.n, self.first, self.data_off = fps, nframes, first, data_off
        self.frames = None

    def index(self):
        if self.frames is None:
            fr = []
            with open(self.path, 'rb') as f:
                off, size = self.data_off, self.first
                hdr = 8 + 4 * len(self.types)
                for _ in range(self.n):
                    f.seek(off)
                    h = f.read(hdr)
                    if len(h) < hdr:
                        break
                    nxt = struct.unpack_from('>I', h, 0)[0]
                    sizes = struct.unpack_from('>%dI' % len(self.types), h, 8)
                    fr.append((off + hdr, sizes))
                    off += size
                    size = nxt
            self.frames = fr
        return self.frames

    def info(self):
        return {'fps': self.fps, 'frames': self.n, 'w': self.w, 'h': self.h, 'audio': self.audio}

    @staticmethod
    def fix_jpeg(v):
        # THP leaves out JPEG byte stuffing in the scan data; browsers need it back.
        i = 2
        while i + 4 <= len(v) and v[i] == 0xFF:
            m = v[i + 1]
            ln = (v[i + 2] << 8) | v[i + 3]
            if m == 0xDA:
                sos = i + 2 + ln
                end = v.rfind(b'\xff\xd9')
                if end < sos:
                    end = len(v)
                return v[:sos] + v[sos:end].replace(b'\xff', b'\xff\x00') + b'\xff\xd9'
            i += 2 + ln
        return v

    def audio_blocks(self):
        """All audio blocks back to back (each: u32 length + block)."""
        fr = self.index()
        ai = self.types.index(1)
        out = []
        with open(self.path, 'rb') as f:
            for off, sizes in fr:
                f.seek(off + sum(sizes[:ai]))
                b = f.read(sizes[ai])
                out.append(struct.pack('>I', len(b)) + b)
        return b''.join(out)

    def chunk(self, start, count, want_audio):
        fr = self.index()
        out = []
        with open(self.path, 'rb') as f:
            for k in range(start, min(start + count, len(fr))):
                off, sizes = fr[k]
                f.seek(off)
                blob = f.read(sum(sizes))
                p = 0
                vid, aud = b'', b''
                for t, sz in zip(self.types, sizes):
                    part = blob[p:p + sz]; p += sz
                    if t == 0:
                        vid = self.fix_jpeg(part)
                    elif t == 1 and want_audio:
                        aud = part
                out.append(struct.pack('>II', len(vid), len(aud)) + vid + aud)
        return struct.pack('>I', len(out)) + b''.join(out)


class Game:
    def __init__(self, root):
        loc = locate(root)
        if not loc:
            raise ValueError('Could not find sys/main.dol and sound/DDRHP5_SOUND.brsar in ' + root)
        self.root = root
        self.dol_path, self.files = loc
        self.dol = Dol(self.dol_path)
        self.rsar = Rsar(os.path.join(self.files, 'sound', 'DDRHP5_SOUND.brsar'))
        self.art = Art(os.path.join(self.files, '2Dcommon', 'comAF_US.bin'))
        self.res = Resources(self.files)
        self.sfx = SoundIndex(self.rsar.path, self.rsar.d, self.rsar.ib)
        self.sfx.set_strings(self.rsar.strings)
        self.movies = {}
        if self.dol.cstr(self.dol.u32(DB_VA)) == '':
            raise ValueError('This main.dol is not the US version of DDR II (SUREA4).')
        self.songs = self._songs()
        log('game folder', root, 'songs', len(self.songs))

    def entry(self, slot):
        return self.dol.bytes(DB_VA + (slot - 1) * DB_STRIDE, DB_STRIDE)

    def sound_row(self, slot):
        return struct.unpack('>5I', self.dol.bytes(SNDTAB_VA + (slot - 1) * 20, 20))

    def chart_keys(self, slot):
        """difficulty/style keys present in a chart file (e.g. 0x614 = Challenge single)"""
        keys = set()
        try:
            with open(self.chart_path(slot), 'rb') as f:
                d = f.read()
        except OSError:
            return keys
        p = 0
        while p + 12 <= len(d):
            size, typ, p2 = struct.unpack_from('<IHH', d, p)
            if not size:
                break
            if typ == 16:
                keys.add(p2)
            p += size
        return keys

    def song_info(self, slot, e):
        """levels / radar for one version. Index 4 is CHALLENGE (level at +208, radar at +188)."""
        keys = self.chart_keys(slot)
        chal = e[208]
        single = list(e[164:168]) + [chal if 0x614 in keys else 0]
        double = list(e[204:208]) + [chal if 0x618 in keys else 0]
        bpm = struct.unpack_from('>I', e, 28)[0]
        bmin, bmax = (bpm >> 16, bpm & 0xFFFF) if bpm > 0xFFFF else (bpm, bpm)
        return dict(slot=slot, single=single, double=double,
                    bpm=[min(bmin, bmax), max(bmin, bmax)], length=round(struct.unpack_from('>f', e, 36)[0], 2),
                    radar=[list(e[168 + 5 * k:173 + 5 * k]) for k in range(5)],
                    preview=bool(self.preview_path(slot)), title=slot - 1)

    def has_audio(self, slot):
        try:
            return self.rsar.group_wave(self.sound_row(slot)[0])[1] >= 200000
        except (IndexError, struct.error):
            return False

    def bgm_path(self, name):
        i = self.sfx.names.get(name)
        if i is None:
            return None
        fid = struct.unpack_from('>I', self.sfx.d, self.sfx.sounds[i] + 4)[0]
        p = self.rsar.file_ext(fid)
        if not p or 'DUMMY' in p.upper() or 'MUTE' in p.upper():
            return None
        full = os.path.join(self.files, 'sound', p.replace('/', os.sep))
        return full if os.path.isfile(full) else None

    def chart_path(self, slot):
        return os.path.join(self.files, 'ssq', 'ss4', 'MU_DDR_%03d.ss4' % slot)

    def preview_path(self, slot):
        for s in (slot, slot - 1 if slot % 2 == 0 else slot + 1):
            try:
                p = self.rsar.file_ext(self.rsar.sound_file(16 + s))
            except (IndexError, struct.error):
                continue
            if p and 'dummy' not in p.lower():
                full = os.path.join(self.files, 'sound', p.replace('/', os.sep))
                if os.path.isfile(full):
                    return full
        return None

    def movie_list(self, sub):
        d = os.path.join(self.files, 'movie', sub)
        try:
            return sorted(n for n in os.listdir(d) if n.lower().endswith('.thp'))
        except OSError:
            return []

    def song_movie(self, slot):
        """The song's own video if the disc has one (licensed songs), else one of the background loops."""
        pv = 'ddr%03d.thp' % slot
        if os.path.isfile(os.path.join(self.files, 'movie', 'zz_pv', pv)):
            return {'file': 'zz_pv/' + pv, 'sync': True}
        bgv = self.movie_list('bgv')
        if bgv:
            return {'file': 'bgv/' + bgv[(slot // 2) % len(bgv)], 'sync': False}
        return None

    def movie(self, rel):
        rel = rel.replace('\\', '/')
        if '..' in rel or not re.match(r'^[A-Za-z0-9_/]+\.thp$', rel):
            raise ValueError('bad movie name')
        if rel not in self.movies:
            self.movies[rel] = Thp(os.path.join(self.files, 'movie', rel.replace('/', os.sep)))
        return self.movies[rel]

    def _songs(self):
        out = []
        titles = {}
        for slot in range(1, DB_COUNT + 1):
            e = self.entry(slot)
            titles[slot] = struct.unpack_from('>I', e, 0)[0]
        for full in range(2, DB_COUNT + 1, 2):        # full version = even slot, cut = slot - 1
            fe = self.entry(full)
            tptr = struct.unpack_from('>I', fe, 0)[0]
            name = self.dol.cstr(tptr)
            # (DUMMY_music: a placeholder left on the disc, never shown in the real game)
            if not name or name in ('music',) or name.startswith('lesson') or 'DUMMY' in name.upper():
                continue
            # Many Konami songs only exist as the short (cut) version: their full slot has no charts.
            slot = full
            if not any(fe[164:168]) and not any(fe[204:208]):
                ce = self.entry(full - 1)
                if titles.get(full - 1) == tptr and (any(ce[164:168]) or any(ce[204:208])):
                    slot = full - 1
            e = self.entry(slot)
            flags = struct.unpack_from('>I', e, 4)[0]
            if not os.path.isfile(self.chart_path(slot)) or not self.has_audio(slot):
                continue
            info = self.song_info(slot, e)
            # songs with both versions: the short one becomes the SHORT tab
            alt = None
            if slot == full:
                c = full - 1
                ce = self.entry(c)
                if titles.get(c) == tptr and (any(ce[164:168]) or any(ce[204:208])) \
                        and os.path.isfile(self.chart_path(c)) and self.has_audio(c):
                    alt = self.song_info(c, ce)
                    alt['jacket'] = c - 1
            cut = full - 1 if slot == full and titles.get(full - 1) == tptr and os.path.isfile(self.chart_path(full - 1)) else None
            song = dict(full=full, short=slot != full, cut=cut, name=name, flags=flags,
                        tier=struct.unpack_from('>i', fe, 24)[0], movie=self.song_movie(full),
                        jacket=(cut or slot) - 1, alt=alt)
            song.update(info)
            out.append(song)
        return out

    def audio(self, slot):
        woff, wsize = self.rsar.group_wave(self.sound_row(slot)[0])
        with open(self.rsar.path, 'rb') as f:
            f.seek(woff)
            return f.read(wsize)


# ------------------------------------------------------------------ http
STAGE_CACHE = {}
STATE = {'game': None, 'error': None, 'hp': None, 'hpError': None, 'hp2': None, 'hp2Error': None, 'hp3': None, 'hp3Error': None}
LOCK = threading.Lock()


def open_hp(path):
    """the Hottest Party disc (extracted folder): its songs go in their own folder on the song list"""
    with LOCK:
        try:
            STATE['hp'] = hp.HPGame(path, Dol, Rsar)
            STATE['hpError'] = None
            s = load_settings()
            s['hp_folder'] = path
            s.pop('hp_off', None)
            save_settings(s)
            log('Hottest Party folder', path, 'songs', len(STATE['hp'].songs))
        except Exception as ex:
            STATE['hp'] = None
            STATE['hpError'] = str(ex)
            log('Hottest Party open failed:', ex)


def open_hp2(path):
    """the Hottest Party 2 disc (extracted folder): its songs are the third game's"""
    with LOCK:
        try:
            STATE['hp2'] = hp2.HP2Game(path, Dol, Rsar)
            STATE['hp2Error'] = None
            s = load_settings()
            s['hp2_folder'] = path
            s.pop('hp2_off', None)
            save_settings(s)
            log('Hottest Party 2 folder', path, 'songs', len(STATE['hp2'].songs))
        except Exception as ex:
            STATE['hp2'] = None
            STATE['hp2Error'] = str(ex)
            log('Hottest Party 2 open failed:', ex)


def open_hp3(path):
    """the Hottest Party 3 disc (extracted folder): its songs are the fourth game's"""
    with LOCK:
        try:
            hp3.Thp = Thp
            STATE['hp3'] = hp3.HP3Game(path, Dol, Rsar)
            STATE['hp3Error'] = None
            s = load_settings()
            s['hp3_folder'] = path
            s.pop('hp3_off', None)
            save_settings(s)
            log('Hottest Party 3 folder', path, 'songs', len(STATE['hp3'].songs))
        except Exception as ex:
            STATE['hp3'] = None
            STATE['hp3Error'] = str(ex)
            log('Hottest Party 3 open failed:', ex)


def all_songs(g):
    out = list(g.songs)
    h = STATE['hp']
    if h:
        bgv = g.movie_list('bgv')
        for i, s in enumerate(h.songs):
            s = dict(s)
            if bgv:
                s['movie'] = {'file': 'bgv/' + bgv[i % len(bgv)], 'sync': False}
            out.append(s)
    h2 = STATE['hp2']
    if h2:
        bgv = g.movie_list('bgv')
        for i, s in enumerate(h2.songs):
            s = dict(s)
            if bgv:
                s['movie'] = {'file': 'bgv/' + bgv[(i * 7) % len(bgv)], 'sync': False}
            out.append(s)
    h3 = STATE['hp3']
    if h3:
        bgv = g.movie_list('bgv')
        for i, s in enumerate(h3.songs):
            s = dict(s)
            s['movie'] = s.pop('movieHP3', None) or ({'file': 'bgv/' + bgv[(i * 5) % len(bgv)], 'sync': False} if bgv else None)
            out.append(s)
    return out


def open_game(path):
    with LOCK:
        try:
            STATE['game'] = Game(path)
            STATE['error'] = None
            s = load_settings()
            s['game_folder'] = path
            save_settings(s)
        except Exception as ex:
            STATE['game'] = None
            STATE['error'] = str(ex)
            log('open failed:', ex)


# ------------------------------------------------------------------ first-run setup: disc + ffmpeg
GAME_FILES = os.path.join(HERE, 'Game Files')        # where the disc's files are copied out to
DISC_EXTS = ('.iso', '.wbfs', '.rvz', '.gcz', '.ciso', '.wia')
SETUP = {'busy': False, 'msg': ''}


def find_dolphin_tool():
    """DolphinTool.exe (it comes with Dolphin): from settings, or Dolphin's usual places"""
    p = load_settings().get('dolphin_tool')
    if p and os.path.isfile(p):
        return p
    import glob
    home = os.path.expanduser('~')
    pats = [os.path.join(HERE, 'DolphinTool.exe'), os.path.join(HERE, '*', 'DolphinTool.exe')]
    for base in (os.path.join(home, 'Downloads'), os.path.join(home, 'Desktop'), os.path.join(home, 'Documents'),
                 os.environ.get('ProgramFiles', r'C:\Program Files'), os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'),
                 os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Programs')):
        pats += [os.path.join(base, '*olphin*', 'DolphinTool.exe'), os.path.join(base, '*olphin*', '*', 'DolphinTool.exe')]
    for pat in pats:
        hits = sorted(glob.glob(pat))
        if hits:
            return hits[-1]
    import shutil
    return shutil.which('DolphinTool')


def ffmpeg_ok():
    return custom.ffmpeg() is not None


def setup_status():
    st = load_settings()
    g = STATE['game']
    return {'gameOk': g is not None, 'folder': g.root if g else st.get('game_folder'), 'iso': st.get('iso'),
            'ffmpeg': custom.ffmpeg(), 'ffmpegOk': ffmpeg_ok(), 'ffmpegSkip': bool(st.get('ffmpeg_skip')),
            'dolphinTool': find_dolphin_tool(), 'busy': SETUP['busy'], 'msg': SETUP['msg'], 'error': STATE['error'],
            'hpOk': STATE['hp'] is not None, 'hpFolder': STATE['hp'].root if STATE['hp'] else st.get('hp_folder'),
            'hpSongs': len(STATE['hp'].songs) if STATE['hp'] else 0, 'hpError': STATE['hpError'],
            'hp2Ok': STATE['hp2'] is not None, 'hp2Folder': STATE['hp2'].root if STATE['hp2'] else st.get('hp2_folder'),
            'hp2Songs': len(STATE['hp2'].songs) if STATE['hp2'] else 0, 'hp2Error': STATE['hp2Error'],
            'hp3Ok': STATE['hp3'] is not None, 'hp3Folder': STATE['hp3'].root if STATE['hp3'] else st.get('hp3_folder'),
            'hp3Songs': len(STATE['hp3'].songs) if STATE['hp3'] else 0, 'hp3Error': STATE['hp3Error']}


HP_FILES = os.path.join(HERE, 'Game Files (Hottest Party)')


def use_hp_disc(iso):
    """Hottest Party disc: same as use_disc - copied out once with DolphinTool, the disc is only read"""
    for cand in (os.path.dirname(iso), HP_FILES):
        marker = os.path.join(cand, '.from_disc')
        same = cand != HP_FILES or (os.path.isfile(marker) and open(marker, encoding='utf-8').read().strip() == iso)
        if same and hp.find_files(cand):
            open_hp(cand)
            SETUP['msg'] = 'Hottest Party added.' if STATE['hp'] else 'That folder could not be read: %s' % STATE['hpError']
            return
    tool = find_dolphin_tool()
    if not tool:
        SETUP['msg'] = 'DolphinTool.exe was not found. Press D and pick the DolphinTool.exe in your Dolphin folder.'
        return
    SETUP['busy'] = True
    SETUP['msg'] = 'Copying Hottest Party\'s files out of the disc (a few minutes, once only)...'

    def work():
        try:
            import shutil
            if os.path.isdir(HP_FILES):
                shutil.rmtree(HP_FILES, ignore_errors=True)
            os.makedirs(HP_FILES, exist_ok=True)
            flags = 0x08000000 if os.name == 'nt' else 0
            r = subprocess.run([tool, 'extract', '-i', iso, '-o', HP_FILES, '-g', '-q'],
                               capture_output=True, text=True, creationflags=flags)
            if not hp.find_files(HP_FILES):
                r = subprocess.run([tool, 'extract', '-i', iso, '-o', HP_FILES, '-q'],
                                   capture_output=True, text=True, creationflags=flags)
            if not hp.find_files(HP_FILES):
                SETUP['msg'] = 'Could not copy the files out of that disc. ' + ((r.stderr or r.stdout or '').strip()[:200])
                return
            with open(os.path.join(HP_FILES, '.from_disc'), 'w', encoding='utf-8') as f:
                f.write(iso)
            open_hp(HP_FILES)
            SETUP['msg'] = 'Hottest Party added.' if STATE['hp'] else 'The disc was copied but could not be read: %s' % STATE['hpError']
        except Exception as ex:
            SETUP['msg'] = 'Copying failed: %s' % ex
        finally:
            SETUP['busy'] = False
    threading.Thread(target=work, daemon=True).start()


def disc_kind(path):
    """'hp' for a Hottest Party disc image, 'ddr2' for DDR II, None if it can't tell (the game ID
    sits near the start of .iso / .wbfs / .rvz / .wia / .ciso images)"""
    try:
        with open(path, 'rb') as f:
            head = f.read(0x10000)
    except OSError:
        return None
    if re.search(rb'RDD[EPJ]A4', head):
        return 'hp'
    if re.search(rb'SURE[A-Z0-9]{2}', head):
        return 'ddr2'
    return None


def use_disc(iso):
    """Read the game from a Wii disc image. The disc itself is only read, never changed: its files
    are copied out once (with Dolphin's DolphinTool) into 'Game Files' next to this program."""
    s = load_settings(); s['iso'] = iso; save_settings(s)
    # already extracted right next to the disc image (or here before)?
    for cand in (os.path.dirname(iso), GAME_FILES):
        marker = os.path.join(cand, '.from_disc')
        same = cand != GAME_FILES or (os.path.isfile(marker) and open(marker, encoding='utf-8').read().strip() == iso)
        if same and locate(cand):
            open_game(cand)
            SETUP['msg'] = 'Ready.' if STATE['game'] else 'That folder could not be read: %s' % STATE['error']
            return
    tool = find_dolphin_tool()
    if not tool:
        SETUP['msg'] = ('DolphinTool.exe was not found. It comes with Dolphin: press D and pick the '
                        'DolphinTool.exe in your Dolphin folder.')
        return
    SETUP['busy'] = True
    SETUP['msg'] = 'Copying the game\'s files out of the disc (a few minutes, once only)...'

    def work():
        try:
            import shutil
            if os.path.isdir(GAME_FILES):
                shutil.rmtree(GAME_FILES, ignore_errors=True)
            os.makedirs(GAME_FILES, exist_ok=True)
            flags = 0x08000000 if os.name == 'nt' else 0
            r = subprocess.run([tool, 'extract', '-i', iso, '-o', GAME_FILES, '-g', '-q'],
                               capture_output=True, text=True, creationflags=flags)
            if not locate(GAME_FILES):           # older DolphinTool: no -g, take the whole disc
                r = subprocess.run([tool, 'extract', '-i', iso, '-o', GAME_FILES, '-q'],
                                   capture_output=True, text=True, creationflags=flags)
            if not locate(GAME_FILES):
                SETUP['msg'] = 'Could not copy the files out of that disc. ' + ((r.stderr or r.stdout or '').strip()[:200])
                log('extract failed:', r.returncode, r.stdout[-500:], r.stderr[-500:])
                return
            with open(os.path.join(GAME_FILES, '.from_disc'), 'w', encoding='utf-8') as f:
                f.write(iso)
            open_game(GAME_FILES)
            SETUP['msg'] = 'Ready.' if STATE['game'] else 'The disc was copied but could not be read: %s' % STATE['error']
        except Exception as ex:
            SETUP['msg'] = 'Copying failed: %s' % ex
            log('extract failed:', ex)
        finally:
            SETUP['busy'] = False
    threading.Thread(target=work, daemon=True).start()


def pick_path(title, filt):
    """Windows file picker; filt like 'Wii discs (*.iso;*.wbfs)|*.iso;*.wbfs'"""
    if os.name != 'nt':
        return None
    ps = ("Add-Type -AssemblyName System.Windows.Forms;"
          "$f=New-Object System.Windows.Forms.OpenFileDialog;"
          "$f.Title='%s';$f.Filter='%s|All files (*.*)|*.*';"
          "if($f.ShowDialog() -eq 'OK'){$f.FileName}") % (title.replace("'", "''"), filt)
    r = subprocess.run(['powershell', '-NoProfile', '-STA', '-Command', ps],
                       capture_output=True, text=True, creationflags=0x08000000)
    return r.stdout.strip() or None


def apply_ffmpeg_setting():
    p = load_settings().get('ffmpeg')
    custom.FFMPEG = p if p and os.path.isfile(p) else None


def pick_file():
    """Windows file picker for a dancer model (.glb / .gltf)"""
    if os.name != 'nt':
        return None
    ps = ("Add-Type -AssemblyName System.Windows.Forms;"
          "$f=New-Object System.Windows.Forms.OpenFileDialog;"
          "$f.Title='Pick a dancer model (.glb or .gltf)';"
          "$f.Filter='3D models (*.glb;*.gltf)|*.glb;*.gltf';"
          "if($f.ShowDialog() -eq 'OK'){$f.FileName}")
    r = subprocess.run(['powershell', '-NoProfile', '-STA', '-Command', ps],
                       capture_output=True, text=True, creationflags=0x08000000)
    return r.stdout.strip() or None


def pick_songs(kind):
    """Windows picker: kind 'files' -> .sm/.ssc files (several at once), 'folder' -> one folder"""
    if os.name != 'nt':
        return []
    if kind == 'folder':
        ps = ("Add-Type -AssemblyName System.Windows.Forms;"
              "$f=New-Object System.Windows.Forms.FolderBrowserDialog;"
              "$f.Description='Pick a song folder or a pack of song folders (StepMania .sm / .ssc)';"
              "if($f.ShowDialog() -eq 'OK'){$f.SelectedPath}")
    else:
        ps = ("Add-Type -AssemblyName System.Windows.Forms;"
              "$f=New-Object System.Windows.Forms.OpenFileDialog;"
              "$f.Title='Pick StepMania songs (.sm or .ssc)';$f.Multiselect=$true;"
              "$f.Filter='StepMania songs (*.sm;*.ssc)|*.sm;*.ssc';"
              "if($f.ShowDialog() -eq 'OK'){$f.FileNames -join \"`n\"}")
    r = subprocess.run(['powershell', '-NoProfile', '-STA', '-Command', ps],
                       capture_output=True, text=True, creationflags=0x08000000)
    return [p.strip() for p in r.stdout.splitlines() if p.strip()]


DANCE_CACHE = {}


def pick_folder():
    if os.name != 'nt':
        return None
    ps = ("Add-Type -AssemblyName System.Windows.Forms;"
          "$f=New-Object System.Windows.Forms.FolderBrowserDialog;"
          "$f.Description='Pick your extracted Dance Dance Revolution II folder';"
          "if($f.ShowDialog() -eq 'OK'){$f.SelectedPath}")
    r = subprocess.run(['powershell', '-NoProfile', '-STA', '-Command', ps],
                       capture_output=True, text=True, creationflags=0x08000000)
    return r.stdout.strip() or None


MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css', '.png': 'image/png', '.json': 'application/json'}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, body, ctype='application/octet-stream'):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
            ctype = 'application/json'
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def send_file_range(self, path, ctype):
        """a file with Range support, so the browser can seek in videos"""
        size = os.path.getsize(path)
        rng = re.match(r'bytes=(\d*)-(\d*)', self.headers.get('Range') or '')
        start, end = 0, size - 1
        if rng and (rng.group(1) or rng.group(2)):
            if rng.group(1):
                start = int(rng.group(1)); end = int(rng.group(2)) if rng.group(2) else size - 1
            else:
                start = max(0, size - int(rng.group(2)))
            end = min(end, size - 1)
        n = max(0, end - start + 1)
        self.send_response(206 if rng and (rng.group(1) or rng.group(2)) else 200)
        self.send_header('Content-Type', ctype)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Length', str(n))
        if rng and (rng.group(1) or rng.group(2)):
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.end_headers()
        with open(path, 'rb') as f:
            f.seek(start)
            left = n
            while left > 0:
                chunk = f.read(min(1 << 20, left))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                left -= len(chunk)

    def do_GET(self):
        try:
            u = urlparse(self.path)
            self.query = {k: v[0] for k, v in parse_qs(u.query).items()}
            self.route_get(unquote(u.path))
        except Exception as ex:
            log('GET', self.path, 'failed:', ex, traceback.format_exc())
            self.send(500, {'error': str(ex)})

    def do_POST(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            body = json.loads(self.rfile.read(n) or b'{}')
            self.route_post(urlparse(self.path).path, body)
        except Exception as ex:
            log('POST', self.path, 'failed:', ex, traceback.format_exc())
            self.send(500, {'error': str(ex)})

    def route_get(self, p):
        g = STATE['game']
        q = self.query
        if p == '/' or p.startswith('/web/'):
            name = 'index.html' if p == '/' else p[5:]
            full = os.path.normpath(os.path.join(WEB, name))
            if not full.startswith(WEB) or not os.path.isfile(full):
                return self.send(404, 'not found', 'text/plain')
            return self.send(200, open(full, 'rb').read(), MIME.get(os.path.splitext(full)[1], 'application/octet-stream'))
        if p == '/api/status':
            return self.send(200, {'ok': g is not None, 'error': STATE['error'],
                                   'folder': g.root if g else load_settings().get('game_folder')})
        if p == '/api/settings':
            return self.send(200, load_settings())
        if p == '/api/setup':
            return self.send(200, setup_status())
        if p == '/api/lights':
            return self.send(200, LIGHTS.status())
        if g is None:
            return self.send(409, {'error': 'no game folder'})
        if p == '/api/songs':
            return self.send(200, all_songs(g))
        if p == '/api/save':
            try:
                with open(SAVE, encoding='utf-8') as f:
                    return self.send(200, json.load(f))
            except (OSError, ValueError):
                return self.send(200, {})
        if p == '/api/res':
            d = g.res.get(q.get('f', ''), q.get('p', ''))
            return self.send(200, d) if d else self.send(404, {'error': 'no such resource'})
        def movie_of(f):
            if f.startswith('hp3:'):
                if not STATE['hp3']:
                    raise ValueError('no Hottest Party 3')
                return STATE['hp3'].movie(f[4:])
            return g.movie(f)
        if p == '/api/movie/info':
            try:
                return self.send(200, movie_of(q.get('f', '')).info())
            except (OSError, ValueError) as ex:
                return self.send(404, {'error': str(ex)})
        if p == '/api/movie/frames':
            m = movie_of(q.get('f', ''))
            return self.send(200, m.chunk(int(q.get('s', 0)), min(240, int(q.get('n', 30))), q.get('a') == '1'))
        if p == '/api/sfx':
            name = q.get('n', '')
            if not re.match(r'^(SE|VO)_[A-Z0-9_]+$', name):
                return self.send(400, {'error': 'bad name'})
            notes = g.sfx.play(name)
            parts = [struct.pack('>I', len(notes))]
            for n in notes:
                ratio = 2 ** ((n['key'] - n['root']) / 12.0) * (n['tune'] or 1.0)
                parts.append(struct.pack('>fffI', n['t'], ratio, n['vol'], len(n['wave'])) + n['wave'])
            return self.send(200, b''.join(parts))
        if p.startswith('/api/bgm/'):
            path = g.bgm_path(p.rsplit('/', 1)[1])
            return self.send(200, open(path, 'rb').read()) if path else self.send(404, {'error': 'no bgm'})
        if p == '/api/movie/audio':
            m = movie_of(q.get('f', ''))
            return self.send(200, m.audio_blocks()) if m.audio else self.send(404, {'error': 'no audio'})
        if p == '/api/custom/songs':
            lib = library()
            return self.send(200, {'folders': lib.folders(), 'songs': lib.public()})
        m = re.match(r'^/api/custom/video/(c[0-9a-f]{10})$', p)
        if m:
            s = library().songs.get(m.group(1))
            path = s and s.get('_video')
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no video'})
            return self.send_file_range(path, custom.MIME.get(os.path.splitext(path)[1].lower(), 'video/mp4'))
        m = re.match(r'^/api/custom/(chart|audio|image|bg)/(c[0-9a-f]{10})$', p)
        if m:
            s = library().songs.get(m.group(2))
            if not s:
                return self.send(404, {'error': 'no such song'})
            if m.group(1) == 'chart':
                return self.send(200, custom.convert(s['_file'])[0])
            path = s['_music'] if m.group(1) == 'audio' else s.get('_bg') if m.group(1) == 'bg' else s['_image']
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'missing file'})
            return self.send(200, open(path, 'rb').read(), custom.MIME.get(os.path.splitext(path)[1].lower(), 'application/octet-stream'))
        # DDR II's own dancers, built from your disc as a .glb when asked for (see ddr2char.py)
        if p == '/api/ddr2chars':
            g = STATE.get('game')
            return self.send(200, ddr2char.dancers(g.files) if g else [])
        m = re.match(r'^/api/ddr2char/(\d{3})/(\d{1,2})$', p)
        if m:
            g = STATE.get('game')
            key = ('ddr2char', m.group(1), int(m.group(2)))
            if key not in STAGE_CACHE:
                try:
                    data = ddr2char.glb(g.files, m.group(1), m.group(2)) if g else None
                except Exception as ex:
                    log('ddr2 dancer', m.group(1), 'failed:', ex)
                    data = None
                if not data:
                    return self.send(404, {'error': 'no dancer'})
                if len(STAGE_CACHE) > 8:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                STAGE_CACHE[key] = data
            return self.send(200, STAGE_CACHE[key], 'model/gltf-binary')
        if p == '/api/dancermodel':
            path = load_settings().get('dancer_model')
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no model'})
            return self.send(200, open(path, 'rb').read())
        if p == '/api/dancermodel/res':
            # files a .gltf points to (its .bin and textures), only from the model's own folder
            path = load_settings().get('dancer_model')
            if not path:
                return self.send(404, {'error': 'no model'})
            folder = os.path.dirname(os.path.abspath(path))
            full = os.path.normpath(os.path.join(folder, q.get('u', '')))
            if not full.startswith(folder + os.sep) or not os.path.isfile(full):
                return self.send(404, {'error': 'not found'})
            return self.send(200, open(full, 'rb').read())
        m = re.match(r'^/api/dance/(\d+)$', p)
        if m:
            slot = int(m.group(1))
            if slot not in DANCE_CACHE:
                if len(DANCE_CACHE) > 3:
                    DANCE_CACHE.pop(next(iter(DANCE_CACHE)))
                try:
                    DANCE_CACHE[slot] = dance.dance_for(g.files, g.dol, slot)
                except (OSError, struct.error, ValueError) as ex:
                    log('dance', slot, 'failed:', ex)
                    DANCE_CACHE[slot] = None
            d = DANCE_CACHE[slot]
            return self.send(200, d) if d else self.send(404, {'error': 'no dance'})
        if p == '/api/menumovie':
            for rel in ('select/OP.thp', 'select/OP43.thp'):
                if os.path.isfile(os.path.join(g.files, 'movie', rel.replace('/', os.sep))):
                    return self.send(200, {'file': rel})
            return self.send(404, {'error': 'none'})
        m = re.match(r'^/api/hp(dance|char)/(\d+)$', p)
        if m:
            h = STATE['hp']
            if not h:
                return self.send(404, {'error': 'no disc'})
            if m.group(1) == 'dance':
                path = h.dance_path(int(m.group(2)))
            else:
                path = h.char_path(m.group(2)) if re.match(r'^\d{3}$', m.group(2)) else None
            if not path:
                return self.send(404, {'error': 'not found'})
            if path not in STAGE_CACHE:
                if len(STAGE_CACHE) > 8:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                if m.group(1) == 'dance':
                    d000 = os.path.join(h.files, 'dll', 'd000Dll.rel')
                    data = hpchar.dance(path, d000 if os.path.isfile(d000) else None, h.song(int(m.group(2)))['ssq'])
                else:
                    data = hpchar.character(path)
                STAGE_CACHE[path] = json.dumps(data).encode()
            return self.send(200, STAGE_CACHE[path], 'application/json')
        # Hottest Party 2's (and 3's) dancers: /api/hp2char/<base CHR number xy0>/<outfit 1-4>, /api/hp2dance/<slot>
        # (HP3 keeps its models in sound/stream/character, like DDR II; the same reader works for them)
        m = re.match(r'^/api/hp([23])(char/(\d{2})0/(\d)|dance/(\d+))$', p)
        if m:
            g2 = STATE.get('hp' + m.group(1))
            m = re.match(r'^/api/hp[23](char/(\d{2})0/(\d)|dance/(\d+))$', p)
            if not g2:
                return self.send(404, {'error': 'no disc'})
            if m.group(2):
                cd = os.path.join(g2.files, 'character')
                if not os.path.isdir(cd):
                    cd = os.path.join(g2.files, 'sound', 'stream', 'character')
                path = os.path.join(cd, 'CHR%s0.bin' % m.group(2))
                outfit = os.path.join(cd, 'CHR%s%s.bin' % (m.group(2), m.group(3)))
                key = outfit
            else:
                s = g2.song(int(m.group(4)))
                path = s and os.path.join(g2.files, 'motion', 'MOT010_SSQ%03d.bin' % (s['ssq'] + 1))
                key = path
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'not found'})
            if key not in STAGE_CACHE:
                if len(STAGE_CACHE) > 8:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                try:
                    if m.group(2):
                        data = hp2char.character(path, outfit)
                    else:
                        bpm = s.get('bpm') or [120]
                        data = hp2char.dance(path, (bpm[0] if isinstance(bpm, list) else bpm) or 120)
                except Exception as ex:
                    log('hp2', p, 'failed:', ex)
                    return self.send(404, {'error': str(ex)})
                STAGE_CACHE[key] = json.dumps(data).encode()
            return self.send(200, STAGE_CACHE[key], 'application/json')
        m = re.match(r'^/api/hpbgm/(\d{3})$', p)
        if m:
            h = STATE['hp']
            d = h and os.path.join(h.files, 'sound', 'stream')
            hit = d and next((f for f in os.listdir(d) if f.lower() == 'mu_bgm_%s.brstm' % m.group(1)), None)
            return self.send(200, open(os.path.join(d, hit), 'rb').read()) if hit else self.send(404, {'error': 'no bgm'})
        m = re.match(r'^/api/hpidx/(arrow)/(\d+)$', p)
        if m:
            h = STATE['hp']
            img = h and h.ui_index(m.group(1), int(m.group(2)))
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        m = re.match(r'^/api/hpui/(ddrmodesel|selcom|win|playersel|chrsel|ctrsel|ddrresultsp|gamemes|matcheck|effect|arrow)/(\d+)$', p)
        if m:
            h = STATE['hp']
            img = h and h.ui(m.group(1), int(m.group(2)))
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        if p == '/api/hpimg/logo':
            h = STATE['hp']
            img = h and h.logo()
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no logo'})
        if p == '/api/hpstages':
            h = STATE['hp']
            return self.send(200, h.stage_list() if h else [])
        if p == '/api/hpmenu':
            h = STATE['hp']
            path = h and os.path.join(h.files, 'data', 'win.bin')
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no menu'})
            if 'menu' not in STAGE_CACHE:
                STAGE_CACHE['menu'] = json.dumps(hpstage.menu(path)).encode()
            return self.send(200, STAGE_CACHE['menu'], 'application/json')
        if p == '/api/hp1gc':                      # GROOVE CIRCUIT (Hottest Party's requests, from its disc)
            h = STATE['hp']
            r = hp.gc_requests(h.files) if h else None
            if r:
                hid = getattr(h, 'hidden', [])
                r['lesson'] = hid[0]['slot'] if hid else None
                r['lessonSong'] = hid[0] if hid else None
            return self.send(200, r)
        if p == '/api/hp2ga':                      # GROOVE ARENA (Hottest Party 2's requests, from its disc)
            h2 = STATE['hp2']
            r = hp2.ga_texts(h2.files) if h2 else None
            if r:
                r['rounds'] = hp2.ga_rounds(h2.sysdir, r['requests'])     # the game's own table (main.dol)
            return self.send(200, r)
        if p == '/api/lessons':                    # DDR SCHOOL (Hottest Party 3's lessons)
            h3 = STATE['hp3']
            return self.send(200, h3.lessons() if h3 else [])
        m = re.match(r'^/api/hp3(art/(\d+)|sel/([0-9.]+))$', p)
        if m:
            h3 = STATE['hp3']
            img = h3 and (h3.art(int(m.group(2))) if m.group(2) else h3.sel([int(x) for x in m.group(3).split('.') if x]))
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        m = re.match(r'^/api/hp2art/(\d+)$', p)
        if m:
            h2 = STATE['hp2']
            img = h2 and h2.art(int(m.group(1)))
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        m = re.match(r'^/api/hp2(gui|sel)/(\d+)$', p)
        if m:
            h2 = STATE['hp2']
            img = h2 and (h2.gui if m.group(1) == 'gui' else h2.sel)(int(m.group(2)))
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        # Hottest Party 2's and 3's stages (the same formats): /api/hp2stages, /api/hp3stage/NNN ...
        m = re.match(r'^/api/hp([23])stages$', p)
        if m:
            h2 = STATE['hp' + m.group(1)]
            d = h2 and os.path.join(h2.files, 'stage')
            names = sorted(n[3:6] for n in os.listdir(d) if re.match(r'^STG\d{3}\.bin$', n)) if d and os.path.isdir(d) else []
            # (Hottest Party 3's 2xx stages put the camera inside their sky dome: left out until that's sorted)
            return self.send(200, [n for n in names if n != '000' and not (m.group(1) == '3' and n.startswith('2'))])
        m = re.match(r'^/api/hp([23])stage/(\d{3})$', p)
        if m:
            h2 = STATE['hp' + m.group(1)]
            path = h2 and os.path.join(h2.files, 'stage', 'STG%s.bin' % m.group(2))
            if not path or not os.path.isfile(path):
                return self.send(404, {'error': 'no stage'})
            if path not in STAGE_CACHE:
                if len(STAGE_CACHE) > 2:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                STAGE_CACHE[path] = json.dumps(hp2stage.stage(path)).encode()
            return self.send(200, STAGE_CACHE[path], 'application/json')
        m = re.match(r'^/api/hpstage/(\d+)$', p)
        if m:
            h = STATE['hp']
            path = h and h.stage_path(int(m.group(1)), q.get('stage', 'random'))
            if h and re.match(r'^\d\d$', q.get('n', '')):          # a stage by its number (for testing)
                path = os.path.join(h.files, 'data', 'stg%s.bin' % q['n'])
                path = path if os.path.isfile(path) else None
            if not path:
                return self.send(404, {'error': 'no stage'})
            if path not in STAGE_CACHE:
                if len(STAGE_CACHE) > 2:
                    STAGE_CACHE.pop(next(iter(STAGE_CACHE)))
                STAGE_CACHE[path] = json.dumps(hpstage.stage(path)).encode()
            return self.send(200, STAGE_CACHE[path], 'application/json')
        m = re.match(r'^/api/(chart|audio|preview|jacket|title)/(\d+)$', p)
        if m and int(m.group(2)) >= hp.SLOT_BASE:
            kind, n = m.group(1), int(m.group(2))
            h = STATE['hp3'] if n >= hp3.SLOT_BASE else STATE['hp2'] if n >= hp2.SLOT_BASE else STATE['hp']
            if not h or not h.song(n):
                return self.send(404, {'error': 'no such song'})
            if kind == 'chart':
                return self.send(200, h.chart(n))
            if kind == 'audio':
                return self.send(200, h.audio(n))
            if kind == 'preview':
                path = h.preview_path(n)
                return self.send(200, open(path, 'rb').read()) if path else self.send(404, {'error': 'no preview'})
            img = h.jacket(n) if kind == 'jacket' else None
            return self.send(200, img, 'image/png') if img else self.send(404, {'error': 'no image'})
        if m:
            kind, n = m.group(1), int(m.group(2))
            if kind == 'chart':
                path = g.chart_path(n)
                return self.send(200, open(path, 'rb').read()) if os.path.isfile(path) else self.send(404, {'error': 'no chart'})
            if kind == 'audio':
                return self.send(200, g.audio(n))
            if kind == 'preview':
                path = g.preview_path(n)
                return self.send(200, open(path, 'rb').read()) if path else self.send(404, {'error': 'no preview'})
            img = g.art.image('jacket' if kind == 'jacket' else 'title', n)
            return self.send(200, img) if img else self.send(404, {'error': 'no image'})
        self.send(404, {'error': 'unknown'})

    def route_post(self, p, body):
        if p == '/api/save':
            tmp = SAVE + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(body, f, indent=1)
            os.replace(tmp, SAVE)
            return self.send(200, {'ok': True})
        if p == '/api/settings':
            s = load_settings()
            s.update(body)
            save_settings(s)
            return self.send(200, {'ok': True})
        if p == '/api/dancermodel':
            # {pick: true} opens a file window; {path: ''} goes back to the built-in dancer
            path = pick_file() if body.get('pick') else body.get('path', '')
            if path is None:
                return self.send(200, {'ok': False, 'path': load_settings().get('dancer_model', '')})
            s = load_settings()
            s['dancer_model'] = path
            save_settings(s)
            return self.send(200, {'ok': True, 'path': path})
        if p == '/api/custom':
            # {create: name} | {delete: folder} | {remove: song id} | {import: folder, pick: 'files'|'folder'} | {import, paths}
            lib = library()
            try:
                if 'create' in body:
                    return self.send(200, {'ok': True, 'folder': lib.create(body['create'])})
                if 'delete' in body:
                    lib.delete(body['delete'])
                    return self.send(200, {'ok': True})
                if 'remove' in body:
                    lib.remove(body['remove'])
                    return self.send(200, {'ok': True})
                if 'import' in body:
                    paths = body.get('paths') or pick_songs(body.get('pick', 'files'))
                    if not paths:
                        return self.send(200, {'ok': False, 'error': 'Nothing picked.'})
                    added, skipped, noconv = lib.import_paths(body['import'], paths)
                    return self.send(200, {'ok': True, 'added': added, 'skipped': skipped, 'noVideo': noconv})
                if 'rescan' in body:
                    lib.scan()
                    return self.send(200, {'ok': True})
            except (OSError, ValueError) as ex:
                return self.send(200, {'ok': False, 'error': str(ex)})
            return self.send(400, {'error': 'bad request'})
        if p == '/api/lights':
            if 'bits' in body:
                LIGHTS.set(body['bits'])
                return self.send(200, {'ok': True})
            if body.get('pick'):
                path = pick_path('Pick PacDrive64.dll (from Ultimarc\'s PacDrive SDK)', 'PacDrive DLL (PacDrive*.dll)|PacDrive*.dll')
                if path:
                    st = load_settings(); st['pacdrive_dll'] = path; save_settings(st)
                    LIGHTS.start(path)
            elif body.get('start'):
                LIGHTS.start(load_settings().get('pacdrive_dll'))
            return self.send(200, LIGHTS.status())
        if p == '/api/setup':
            what = body.get('pick')
            if SETUP['busy']:
                return self.send(200, setup_status())
            if what == 'iso':
                path = body.get('path') or pick_path('Pick your Dance Dance Revolution II (USA) Wii disc',
                                                     'Wii discs (*.iso;*.wbfs;*.rvz;*.gcz;*.ciso;*.wia)|*.iso;*.wbfs;*.rvz;*.gcz;*.ciso;*.wia')
                if path and disc_kind(path) == 'hp':
                    use_hp_disc(path)           # the Hottest Party disc picked on this row: add it as the extra disc
                elif path:
                    use_disc(path)
                else:
                    SETUP['msg'] = 'No disc picked.'
            elif what == 'ffmpeg':
                path = body.get('path') or pick_path('Pick ffmpeg.exe', 'ffmpeg (ffmpeg.exe)|ffmpeg.exe')
                if path and os.path.isfile(path):
                    st = load_settings(); st['ffmpeg'] = path; st.pop('ffmpeg_skip', None); save_settings(st)
                    apply_ffmpeg_setting()
                    SETUP['msg'] = 'ffmpeg found.' if ffmpeg_ok() else 'That file is not ffmpeg.exe.'
                else:
                    SETUP['msg'] = 'No ffmpeg picked.'
            elif what == 'dolphintool':
                path = body.get('path') or pick_path('Pick DolphinTool.exe (in your Dolphin folder)', 'DolphinTool (DolphinTool.exe)|DolphinTool.exe')
                if path and os.path.isfile(path):
                    st = load_settings(); st['dolphin_tool'] = path; save_settings(st)
                    SETUP['msg'] = 'DolphinTool found. Now pick your disc.'
            elif what == 'folder':
                path = body.get('path') or pick_folder()
                if path and hp3.find_files(path) and not locate_here(path):
                    open_hp3(path)                # a Hottest Party 3 folder: added as the fourth game
                    SETUP['msg'] = ('Hottest Party 3 added (%d songs).' % len(STATE['hp3'].songs)) if STATE['hp3'] \
                        else 'That folder could not be read: %s' % STATE['hp3Error']
                elif path and hp2.find_files(path) and not locate_here(path):
                    open_hp2(path)                # a Hottest Party 2 folder: added as the third game
                    SETUP['msg'] = ('Hottest Party 2 added (%d songs).' % len(STATE['hp2'].songs)) if STATE['hp2'] \
                        else 'That folder could not be read: %s' % STATE['hp2Error']
                elif path and hp.find_files(path) and not locate_here(path):
                    open_hp(path)                 # a Hottest Party folder: added as the extra disc
                    SETUP['msg'] = ('Hottest Party added (%d songs).' % len(STATE['hp'].songs)) if STATE['hp'] \
                        else 'That folder could not be read: %s' % STATE['hpError']
                elif path:
                    old = STATE['game']
                    open_game(path)
                    if not STATE['game'] and old:     # keep the game that was working
                        err = STATE['error']
                        STATE['game'] = old
                        SETUP['msg'] = 'That folder could not be read (%s). Still using %s.' % (err, old.root)
                    else:
                        SETUP['msg'] = 'Ready.' if STATE['game'] else 'That folder could not be read: %s' % STATE['error']
            elif what in ('hpiso', 'hpfolder'):
                if what == 'hpiso':
                    path = body.get('path') or pick_path('Pick your Dance Dance Revolution Hottest Party (USA) Wii disc',
                                                         'Wii discs (*.iso;*.wbfs;*.rvz;*.gcz;*.ciso;*.wia)|*.iso;*.wbfs;*.rvz;*.gcz;*.ciso;*.wia')
                    if path and disc_kind(path) == 'ddr2':
                        SETUP['msg'] = 'That is the DDR II disc - pick the Hottest Party one on this row.'
                        path = 'x'
                    elif path:
                        use_hp_disc(path)
                else:
                    path = body.get('path') or pick_folder()
                    if path:
                        open_hp(path)
                        SETUP['msg'] = 'Hottest Party added.' if STATE['hp'] else 'That folder could not be read: %s' % STATE['hpError']
                if not path:
                    SETUP['msg'] = 'Nothing picked.'
            elif what == 'hp2folder':
                path = body.get('path') or pick_folder()
                if path:
                    open_hp2(path)
                    SETUP['msg'] = ('Hottest Party 2 added (%d songs).' % len(STATE['hp2'].songs)) if STATE['hp2'] \
                        else 'That folder could not be read: %s' % STATE['hp2Error']
                else:
                    SETUP['msg'] = 'Nothing picked.'
            elif what == 'hp3folder':
                path = body.get('path') or pick_folder()
                if path:
                    open_hp3(path)
                    SETUP['msg'] = ('Hottest Party 3 added (%d songs).' % len(STATE['hp3'].songs)) if STATE['hp3'] \
                        else 'That folder could not be read: %s' % STATE['hp3Error']
                else:
                    SETUP['msg'] = 'Nothing picked.'
            elif what == 'hp3remove':
                STATE['hp3'] = None
                st = load_settings(); st.pop('hp3_folder', None); st['hp3_off'] = True; save_settings(st)
                SETUP['msg'] = 'Hottest Party 3 songs removed from the list (your disc and files are untouched).'
            elif what == 'hp2remove':
                STATE['hp2'] = None
                st = load_settings(); st.pop('hp2_folder', None); st['hp2_off'] = True; save_settings(st)
                SETUP['msg'] = 'Hottest Party 2 songs removed from the list (your disc and files are untouched).'
            elif what == 'hpremove':
                STATE['hp'] = None
                st = load_settings(); st.pop('hp_folder', None); st['hp_off'] = True; save_settings(st)
                SETUP['msg'] = 'Hottest Party songs removed from the list (your disc and files are untouched).'
            elif what == 'skipffmpeg':
                st = load_settings(); st['ffmpeg_skip'] = True; save_settings(st)
            return self.send(200, setup_status())
        if p == '/api/game':
            path = body.get('path') or pick_folder()
            if path:
                open_game(path)
            g = STATE['game']
            return self.send(200, {'ok': g is not None, 'error': STATE['error'], 'folder': path})
        self.send(404, {'error': 'unknown'})


def main():
    apply_ffmpeg_setting()
    try:
        LIGHTS.start(load_settings().get('pacdrive_dll'))
        log('lights:', LIGHTS.msg)
    except Exception as ex:
        log('lights failed:', ex)
    folder = load_settings().get('game_folder') or default_game_folder()
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if args:
        folder = args[0]
    if folder:
        open_game(folder)
    st = load_settings()
    hpf = st.get('hp_folder') or (None if st.get('hp_off') else hp.default_folder())
    if hpf:
        open_hp(hpf)
    hp2f = st.get('hp2_folder') or (None if st.get('hp2_off') else hp2.default_folder())
    if hp2f:
        open_hp2(hp2f)
    hp3.Thp = Thp
    hp3f = st.get('hp3_folder') or (None if st.get('hp3_off') else hp3.default_folder())
    if hp3f:
        open_hp3(hp3f)
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), H)
    url = 'http://127.0.0.1:%d/' % PORT
    log('DDR II PC running at', url, '- close this window to quit')
    if '--no-browser' not in sys.argv:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    srv.serve_forever()


if __name__ == '__main__':
    main()
