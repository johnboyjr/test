"""Custom songs: StepMania .sm / .ssc songs kept in folders you make ("Rock", "Anime"...).

Layout (next to the program):   Custom Songs/<folder>/<song folder>/<song>.sm + music + pictures
Importing copies a song's whole folder in, so the originals are left alone.

Charts are turned into the same shape the game's own charts use (DDR.buildNotes reads it):
  {'tempo': {'offs': [...], 'secs': [...]}, 'charts': {key: [{'off', 'lane', 'end'?}, ...]}}
with 1024 units per beat and key = (difficulty << 8) | (0x14 single / 0x18 double).
"""
import hashlib, os, re, shutil, subprocess

UNITS = 1024
DIFF = {'beginner': 4, 'easy': 1, 'basic': 1, 'light': 1, 'medium': 2, 'another': 2, 'standard': 2,
        'trick': 2, 'hard': 3, 'heavy': 3, 'maniac': 3, 'expert': 3, 'challenge': 6, 'oni': 6, 'smaniac': 6}
ORDER = [4, 1, 2, 3, 6]          # the game's difficulty rows
STYLE = {'dance-single': 0x14, 'dance-double': 0x18}
AUDIO = ('.ogg', '.mp3', '.wav', '.m4a', '.oga', '.opus', '.flac')
IMAGES = ('.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp')
PLAYABLE = ('.mp4', '.m4v', '.webm', '.ogv')                     # videos the browser plays as-is
CONVERT = ('.avi', '.mpg', '.mpeg', '.wmv', '.flv', '.mkv', '.mov') # older formats: turned into .mp4 with ffmpeg
VIDEO = PLAYABLE + CONVERT
MIME = {'.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.opus': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
        '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.bmp': 'image/bmp', '.webp': 'image/webp',
        '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg'}
BAD = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def clean_name(name):
    name = BAD.sub('', (name or '').strip()).strip(' .')
    return name[:40]


# ------------------------------------------------------------------ reading .sm / .ssc
def read_text(path):
    raw = open(path, 'rb').read()
    for enc in ('utf-8-sig', 'cp1252', 'latin-1'):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    return raw.decode('latin-1', 'replace')


def tags(text):
    """-> list of (TAG, value) in file order (comments removed)"""
    text = re.sub(r'//[^\n]*', '', text)
    return [(m.group(1).upper(), m.group(2).strip()) for m in re.finditer(r'#([A-Za-z0-9_]+)\s*:([^;]*);', text, re.S)]


def parse(path):
    """song file -> {'meta': {...}, 'charts': [{'type', 'diff', 'meter', 'notes'}]}"""
    t = tags(read_text(path))
    meta, charts, cur = {}, [], None
    for k, v in t:
        if k == 'NOTEDATA':                       # .ssc: a new chart starts
            cur = {}
            charts.append(cur)
            continue
        if cur is not None:
            if k == 'STEPSTYPE': cur['type'] = v.strip().lower()
            elif k == 'DIFFICULTY': cur['diff'] = v.strip().lower()
            elif k == 'METER': cur['meter'] = v.strip()
            elif k == 'NOTES': cur['notes'] = v
            elif k in ('BPMS', 'STOPS', 'OFFSET'): cur[k.lower()] = v   # per-chart timing (rare)
            continue
        if k == 'NOTES':                          # .sm: type:desc:difficulty:meter:radar:notes
            parts = v.split(':', 5)
            if len(parts) == 6:
                charts.append({'type': parts[0].strip().lower(), 'diff': parts[2].strip().lower(),
                               'meter': parts[3].strip(), 'notes': parts[5]})
            continue
        meta.setdefault(k, v)
    return {'meta': meta, 'charts': charts}


def pairs(s):
    out = []
    for item in (s or '').split(','):
        if '=' in item:
            a, b = item.split('=', 1)
            try:
                out.append((float(a), float(b)))
            except ValueError:
                pass
    return out


def tempo(meta):
    """BPM changes and stops -> the game's tempo table (music seconds at 1024 units per beat)"""
    bpms = sorted(pairs(meta.get('BPMS'))) or [(0.0, 120.0)]
    stops = sorted(pairs(meta.get('STOPS', '')) + pairs(meta.get('DELAYS', '')))
    try:
        offset = float(meta.get('OFFSET', '0') or 0)
    except ValueError:
        offset = 0.0
    if bpms[0][0] > 0:
        bpms.insert(0, (0.0, bpms[0][1]))
    events = sorted([(b, 0, v) for b, v in bpms] + [(b, 1, v) for b, v in stops])
    offs, secs = [0], [-offset]
    beat, t, bpm = 0.0, -offset, bpms[0][1]
    for b, kind, v in events:
        if b > beat:
            t += (b - beat) * 60.0 / max(bpm, 1e-3)
            beat = b
            offs.append(round(beat * UNITS)); secs.append(t)
        if kind == 0:
            bpm = v if v > 0 else bpm
        elif v > 0:
            t += v
            offs.append(round(beat * UNITS)); secs.append(t)
    # a far point at the end so times past the last change keep going
    offs.append(round((beat + 4000) * UNITS)); secs.append(t + 4000 * 60.0 / max(bpm, 1e-3))
    return {'offs': offs, 'secs': secs}, [b for _, b in bpms]


def notes(text, lanes):
    """note data -> [{'off', 'lane'} (+ 'end': True for a hold's end)]"""
    out = []
    for m, measure in enumerate(text.split(',')):
        rows = [r.strip() for r in measure.split('\n') if r.strip()]
        rows = [r for r in rows if len(r) >= lanes]
        n = len(rows)
        for i, row in enumerate(rows):
            off = round((m * 4 + i * 4 / n) * UNITS)
            for lane in range(lanes):
                c = row[lane]
                if c in '124':                        # tap, hold head, roll head (played as a hold)
                    out.append({'off': off, 'lane': lane})
                elif c == '3':                        # hold / roll end
                    out.append({'off': off, 'lane': lane, 'end': True})
                # M (mines), L (lifts), F (fakes) are left out
    return out


def convert(path):
    song = parse(path)
    tp, bpms = tempo(song['meta'])
    charts, levels = {}, {'single': [0] * 5, 'double': [0] * 5}
    edits = []
    for c in song['charts']:
        style = STYLE.get(c.get('type'))
        if not style or 'notes' not in c:
            continue
        d = DIFF.get(c.get('diff', ''))
        if d is None:
            edits.append((style, c))
            continue
        key = (d << 8) | style
        if key in charts:
            continue
        charts[key] = notes(c['notes'], 4 if style == 0x14 else 8)
        try:
            meter = int(float(c.get('meter') or 0))
        except ValueError:
            meter = 0
        levels['single' if style == 0x14 else 'double'][ORDER.index(d)] = max(1, meter)
    # an Edit chart fills an empty CHALLENGE row
    for style, c in edits:
        key = (6 << 8) | style
        if key not in charts:
            charts[key] = notes(c['notes'], 4 if style == 0x14 else 8)
            levels['single' if style == 0x14 else 'double'][4] = max(1, int(float(c.get('meter') or 1)))
    return {'tempo': tp, 'charts': {str(k): v for k, v in charts.items()}}, levels, bpms


# ------------------------------------------------------------------ the library
FFMPEG = None          # the ffmpeg.exe picked at setup (set by the server)


def ffmpeg():
    """ffmpeg on this PC (the one picked at setup, next to the program, or on PATH), or None"""
    if FFMPEG and os.path.isfile(FFMPEG):
        return FFMPEG
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(here, 'ffmpeg.exe'), os.path.join(here, 'ffmpeg', 'bin', 'ffmpeg.exe')):
        if os.path.isfile(p):
            return p
    return shutil.which('ffmpeg')


def to_mp4(src, dest):
    """convert an old video to .mp4 (H.264, no sound - the song's music plays instead)"""
    exe = ffmpeg()
    if not exe:
        return False
    flags = 0x08000000 if os.name == 'nt' else 0
    r = subprocess.run([exe, '-y', '-loglevel', 'error', '-i', src, '-an', '-c:v', 'libx264', '-preset', 'veryfast',
                        '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dest],
                       capture_output=True, creationflags=flags)
    return r.returncode == 0 and os.path.isfile(dest)


def video_of(meta, sdir, tp):
    """the song's background video: (path, start in music seconds) or (None, 0)"""
    picks = []
    for k in ('BGCHANGES', 'BGCHANGES1', 'ANIMATIONS'):
        for item in (meta.get(k) or '').split(','):
            parts = item.strip().split('=')
            if len(parts) >= 2:
                try:
                    picks.append((float(parts[0]), parts[1].strip()))
                except ValueError:
                    pass
    picks.append((0.0, meta.get('BACKGROUND', '')))
    for beat, name in picks:
        if not name.lower().endswith(VIDEO):
            continue
        base = os.path.splitext(name)[0]
        for cand in (name, base + '.mp4'):              # an old format may have been converted on import
            f = find_file(sdir, cand, None)
            if f and f.lower().endswith(PLAYABLE):
                return f, seconds_at(tp, round(beat * UNITS))
    f = find_file(sdir, '', PLAYABLE)                    # a lone video in the song's folder
    return (f, 0.0) if f else (None, 0.0)


def song_file(folder):
    """the chart file in a song folder (.ssc preferred)"""
    try:
        names = os.listdir(folder)
    except OSError:
        return None
    for ext in ('.ssc', '.sm'):
        for n in sorted(names):
            if n.lower().endswith(ext):
                return os.path.join(folder, n)
    return None


def find_file(folder, name, exts):
    """a file named in the song (case-insensitive), or the first file with one of these extensions"""
    try:
        names = os.listdir(folder)
    except OSError:
        return None
    if name:
        for n in names:
            if n.lower() == name.lower():
                return os.path.join(folder, n)
    return None if exts is None else next((os.path.join(folder, n) for n in sorted(names) if n.lower().endswith(exts)), None)


def _named(folder, words):
    try:
        names = sorted(os.listdir(folder))
    except OSError:
        return None
    for n in names:
        low = os.path.splitext(n)[0].lower()
        if n.lower().endswith(IMAGES) and any(low.endswith(w) or low == w.strip('-_ ') for w in words):
            return os.path.join(folder, n)
    return None


def jacket_file(folder):
    return _named(folder, ('-jacket', '_jacket', ' jacket', '-jk', '_jk', 'jacket', 'jk'))


def bg_file(folder):
    return _named(folder, ('-bg', '_bg', ' bg', 'bg', 'background'))


class Library:
    def __init__(self, root):
        self.root = root
        os.makedirs(root, exist_ok=True)
        self.songs = {}
        self.scan()

    def folders(self):
        try:
            return sorted(n for n in os.listdir(self.root) if os.path.isdir(os.path.join(self.root, n)))
        except OSError:
            return []

    def scan(self):
        songs = {}
        for folder in self.folders():
            fpath = os.path.join(self.root, folder)
            for name in sorted(os.listdir(fpath)):
                sdir = os.path.join(fpath, name)
                f = song_file(sdir) if os.path.isdir(sdir) else None
                if not f:
                    continue
                try:
                    info = self.info(folder, name, sdir, f)
                except Exception as ex:          # a broken file shouldn't hide the rest
                    print('custom song skipped:', sdir, ex)
                    continue
                songs[info['slot']] = info
        self.songs = songs
        return songs

    def info(self, folder, name, sdir, f):
        song = parse(f)
        m = song['meta']
        chart, levels, bpms = convert(f)
        sid = 'c' + hashlib.sha1(('%s/%s' % (folder, name)).lower().encode('utf-8')).hexdigest()[:10]
        music = find_file(sdir, m.get('MUSIC', ''), AUDIO)
        # artwork: a real jacket if there is one (the JACKET tag, or a file named like *-jacket.png /
        # *-jk.png); else the banner, which the game shows over the song's background
        jacket = find_file(sdir, m.get('JACKET', ''), None) or jacket_file(sdir)
        banner = find_file(sdir, m.get('BANNER', ''), None)
        bg = find_file(sdir, m.get('BACKGROUND', ''), None) or bg_file(sdir)
        art = 'jacket' if jacket else 'banner' if banner else 'bg' if bg else None
        if not jacket:
            jacket = banner or bg or find_file(sdir, '', IMAGES)
        last = 0.0
        tp = chart['tempo']
        for notes_ in chart['charts'].values():
            if notes_:
                last = max(last, max(n['off'] for n in notes_))
        length = seconds_at(tp, last) + 2.0 if last else 90.0
        def num(k, d):
            try:
                return float(m.get(k, d) or d)
            except ValueError:
                return d
        video, vstart = video_of(m, sdir, tp)
        title = m.get('TITLETRANSLIT') or m.get('TITLE') or name
        return {
            'slot': sid, 'custom': True, 'folder': folder, 'dir': name,
            'name': title, 'artist': m.get('ARTISTTRANSLIT') or m.get('ARTIST') or '',
            'single': levels['single'], 'double': levels['double'],
            'bpm': [round(min(bpms)), round(max(bpms))] if bpms else [120, 120], 'length': round(length, 2),
            'radar': [], 'preview': bool(music), 'title': None, 'jacket': '/api/custom/image/' + sid if jacket else None,
            'art': art, 'artBg': '/api/custom/bg/' + sid if (art == 'banner' and bg) else None,
            'sample': [num('SAMPLESTART', 30.0), num('SAMPLELENGTH', 12.0)],
            'video': '/api/custom/video/' + sid if video else None, 'videoStart': round(vstart, 3),
            '_file': f, '_music': music, '_image': jacket, '_bg': bg, '_video': video,
        }

    def public(self):
        return [{k: v for k, v in s.items() if not k.startswith('_')} for s in self.songs.values()]

    # -------------------------------------------------------------- changes
    def create(self, name):
        name = clean_name(name)
        if not name:
            raise ValueError('Folder names need at least one letter or number.')
        os.makedirs(os.path.join(self.root, name), exist_ok=True)
        return name

    def delete(self, name):
        p = os.path.join(self.root, clean_name(name))
        if os.path.isdir(p) and os.path.dirname(os.path.abspath(p)) == os.path.abspath(self.root):
            shutil.rmtree(p)
        self.scan()

    def remove(self, sid):
        s = self.songs.get(sid)
        if s:
            p = os.path.join(self.root, s['folder'], s['dir'])
            if os.path.dirname(os.path.dirname(os.path.abspath(p))) == os.path.abspath(self.root):
                shutil.rmtree(p)
        self.scan()

    def import_paths(self, folder, paths):
        """copy each picked song (a .sm/.ssc file, a song folder, or a pack of song folders) into `folder`"""
        folder = clean_name(folder)
        dest_root = os.path.join(self.root, folder)
        if not folder or not os.path.isdir(dest_root):
            raise ValueError('That folder does not exist.')
        song_dirs = []
        for p in paths:
            if os.path.isfile(p) and p.lower().endswith(('.sm', '.ssc')):
                song_dirs.append(os.path.dirname(p))
            elif os.path.isdir(p):
                for base, dirs, files in os.walk(p):
                    if base[len(p):].count(os.sep) > 3:
                        dirs[:] = []
                        continue
                    if any(f.lower().endswith(('.sm', '.ssc')) for f in files):
                        song_dirs.append(base)
                        dirs[:] = []
        added, skipped, noconv = [], [], 0
        for sd in dict.fromkeys(song_dirs):
            name = clean_name(os.path.basename(os.path.normpath(sd))) or 'Song'
            dest = os.path.join(dest_root, name)
            if os.path.exists(dest):
                skipped.append(name)
                continue
            # only what a song needs: its chart files, music and pictures (not videos or other songs)
            os.makedirs(dest)
            for n in os.listdir(sd):
                src = os.path.join(sd, n)
                if not os.path.isfile(src):
                    continue
                low = n.lower()
                if low.endswith(('.sm', '.ssc') + AUDIO + IMAGES + PLAYABLE):
                    shutil.copy2(src, os.path.join(dest, n))
                elif low.endswith(CONVERT):                # old video formats: make an .mp4 copy if ffmpeg is here
                    if not to_mp4(src, os.path.join(dest, os.path.splitext(n)[0] + '.mp4')):
                        noconv += 1
            added.append(name)
        self.scan()
        return added, skipped, noconv


def seconds_at(tp, off):
    o, s = tp['offs'], tp['secs']
    i = 0
    while i < len(o) - 2 and off >= o[i + 1]:
        i += 1
    if o[i + 1] == o[i]:
        return s[i + 1]
    return s[i] + (off - o[i]) * (s[i + 1] - s[i]) / (o[i + 1] - o[i])
