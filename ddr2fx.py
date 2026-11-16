"""DDR II stage effects, lights and the dance cue sheets (main.dol + the disc files).

Effects
  game/GAME_STG_EFF.bin: ddr3_stage.TEB (63 effects, teb.py) + ge.tpl (its 47 textures) - effect bank 1.
  Each stage file can hold its own TEB + TPL (stage entry 2) - bank 5 - and AM.bin (stage entry 3):
  a ZAR table of 3-byte rows (effect, ?, on) for its EFF_03_xx spots.
  Stage models have spots: EFF_01_01..06 (six around the floor), EFF_02_01 (the middle), EFF_03_xx (the
  stage's own effects), LIGPOS_nn / LIGTAR_nn (light positions / aims), OBJSET_* (prop placements).
  260 effect slots (main.dol 0x802bd620, names filled in by 0x800f3210): slot -> (spot suffix, effect).
  Per stage (0x8028d190 + 14304 + 24 * (stage - 10) for 10-29, + 14112 + 24 * stage for 0-7; 200, 201, 19
  have their own, chosen in 0x80115e10 / 0x801160a8, copied by 0x801157cc): u32, u32 light preset mask,
  f32, -> 64 words = 8 effect groups of up to 8 slots ending 0x104 (a negative slot n means n + 260),
  -> 8 light presets of 148 bytes (only preset 0 is filled on the disc: [?, ambient, 1], intensity,
  direction-ish (1, 1, 1), mask, and its colour at +116), -> 2 floats (1.9, 21).
  The song's cue sheet asks for an effect group by number (event type 7 -> 0x80112d9c): every slot of
  that group plays its effect at its spot (0x80052e1c).

Cue sheets
  dance/DANCE_<series>_<nnn>_<part><vv>_FRE.bin beside each part's motion file: a WII container of
  [ZAR table, the part's position model, the part's camera moves (.cam, the same format as
  GAME_DEF_CAM's)]. The ZAR row is a 12-byte header (u32 count at +4) and count 52-byte events
  (merged for the song by 0x80119f0c, read by 0x8011ab4c with type accessors at 0x802918b8):
    +0 f32 time (s, at the dance's tempo)  +4 f32  +8 u32 position (4096 a measure)  +12 f32 tempo
    +16 u32/+20 f32 type 0 (motion clip, length)   +24/+28 type 1   +32/+36 type 4 (camera: one of
    this part's .cam moves -> 0x8005c540)   +40 type 5   +41 type 6 (light preset, 0x80113098)
    +42 type 7 (effect group)   +43 types 2 / 3   +44 type 8   +45 type 9   +46 type 10 (+48 f32)
"""
import base64
import os
import re
import struct

import hp2
import hp2stage
import teb

U32 = lambda d, o: struct.unpack_from('>I', d, o)[0]
U16 = lambda d, o: struct.unpack_from('>H', d, o)[0]
F32 = lambda d, o: struct.unpack_from('>f', d, o)[0]

SLOT_VA = 0x802BD620
SLOT_INIT = 0x800F3210
R13 = 0x802EE3A0
STAGE_FX = 0x8028D190


def zar_table(d, B):
    """a ZAR table -> (row size, row count, data offset)"""
    r7 = B + U32(d, B + 20)
    T = r7 + U32(d, r7 + 8)
    sidx, cnt, doff = U16(d, T), U16(d, T + 2), U32(d, T + 4)
    S = B + U32(d, B + 16)
    F = S + U32(d, S + 12)
    e = F + 8 * sidx
    rs = U16(d, e) | (d[e + 2] << 16)
    return rs, cnt, (r7 + doff) if doff else None


# ------------------------------------------------------------------ main.dol tables
def slots(dol):
    """the 260 effect slots: [spot suffix, effect] - the names are put in at run time by 0x800f3210,
    so its stores are followed here (lis / addi / lwz from r13 / stw)"""
    names = {}
    reg = {}
    a = SLOT_INIT
    for _ in range(4000):
        w = dol.u32(a)
        op, rd, ra, imm = w >> 26, (w >> 21) & 31, (w >> 16) & 31, w & 0xffff
        simm = imm - 0x10000 if imm & 0x8000 else imm
        if w == 0x4E800020:
            break
        if op == 15 and ra == 0:
            reg[rd] = (imm << 16) & 0xffffffff
        elif op == 14 and ra in reg:
            reg[rd] = (reg[ra] + simm) & 0xffffffff
        elif op == 32:                                    # lwz
            base = R13 if ra == 13 else reg.get(ra)
            if base is not None:
                ad = (base + simm) & 0xffffffff
                reg[rd] = names.get(ad, dol.u32(ad))
        elif op == 36 and ra in reg and rd in reg:        # stw
            names[(reg[ra] + simm) & 0xffffffff] = reg[rd]
        a += 4

    def cstr(p):
        try:
            b = dol.bytes(p, 16)
            return b.split(b'\0')[0].decode('latin1')
        except Exception:
            return ''
    out = []
    for k in range(260):
        p = names.get(SLOT_VA + 16 * k)
        out.append([cstr(p) if p else '', struct.unpack('>i', dol.bytes(SLOT_VA + 16 * k + 4, 4))[0]])
    return out


def stage_table(dol, n):
    if 10 <= n <= 29:
        return STAGE_FX + 14304 + 24 * (n - 10)
    if 0 <= n <= 7:
        return STAGE_FX + 14112 + 24 * n
    if n in (200, 204, 205):
        return STAGE_FX + 14784
    if n == 19:
        return STAGE_FX + 14808
    return STAGE_FX + 14832


def stage_fx(dol, n):
    """-> {groups: 8 lists of slots, light: {color, ambient}}"""
    a = stage_table(dol, n)
    w = list(struct.unpack('>IIfIII', dol.bytes(a, 24)))
    for i in (3, 4, 5):                                  # (a few stages have no tables: null / bad pointers)
        try:
            if w[i] and len(dol.bytes(w[i], 4)) != 4:
                w[i] = 0
        except Exception:
            w[i] = 0
    groups = []
    if w[3]:
        tab = struct.unpack('>64i', dol.bytes(w[3], 256))
        for gi in range(8):
            g = []
            for v in tab[gi * 8:gi * 8 + 8]:
                if v == 0x104:
                    break
                g.append(v + 260 if v < 0 else v)
            groups.append(g)
    light = None
    if w[4]:
        p = dol.bytes(w[4], 148)
        col = p[116:120]
        light = dict(color=[col[0], col[1], col[2]], ambient=round(struct.unpack_from('>f', p, 4)[0], 3),
                     power=round(struct.unpack_from('>f', p, 12)[0], 3),
                     # +8: light 0's brightness (state +20 = 255 x this, 0x801114ac): 1.0 on the song
                     # stages, 0.4 on stages 201 / 203
                     G=round(struct.unpack_from('>f', p, 8)[0], 3))
        # the light channels' colour (Dolphin memory, every London EVOLVED and Wings of an Angel dump): the
        # stage's channel table (movie/stage manager + 0x10000 - 20832, 16 bytes a channel) gives channels
        # 0-2 material white and ambient = preset 1's colour (preset 0's when preset 1 is empty), channels
        # 3-6 ambient black; 0x8004d91c puts them on the materials tagged 11-90 (channel = (tag - 11) // 10).
        # Boss stage: presets d2ffe6 / 8caadc -> ambient 8caadc from the opening on (it fades in from
        # d2ffe6 within the first second); stage 11 ffdcc8, 13 / 16 c8b4ff.
        p1 = dol.bytes(w[4] + 148, 148)
        c1 = p1[116:120] if p1[116:119] != b'\0\0\0' else col
        light['channel'] = [list(c1[:3]) + [255]] * 3 + [[0, 0, 0, 255]] * 5
    return dict(groups=groups, light=light)


# ------------------------------------------------------------------ files
def tpl_pngs(d, off):
    out = []
    for (w, h, fmt, o) in hp2.tpl_list(d, off):
        png = hp2.tpl_png(d, w, h, fmt, o)
        out.append(base64.b64encode(png).decode() if png else '')
    return out


def bank(d, b):
    """a WII container holding a TEB and its TPL -> {effects, tex}"""
    effs, tex = None, []
    for nm, o, s in hp2stage.wii_entries(d, b):
        if d[o:o + 4] == b'TEB\0':
            effs = teb.parse(d[o:o + s])
        elif d[o:o + 4] == b'\x00\x20\xaf\x30':
            tex = tpl_pngs(d, o)
    return dict(effects=effs, tex=tex) if effs else None


def chr_bank(files):
    """character/CHR_EFF.bin (boss_ddr3.TEB + 3.tpl): effect bank 6, the dancers' own effects
    (0x80118e54 loads it with the characters; 0x8005fb04 plays them at a dancer's bones)"""
    p = os.path.join(files, 'character', 'CHR_EFF.bin')
    if not os.path.isfile(p):
        return None
    return bank(open(p, 'rb').read(), 0)


def global_bank(files):
    p = os.path.join(files, 'game', 'GAME_STG_EFF.bin')
    if not os.path.isfile(p):
        return None
    d = open(p, 'rb').read()
    return bank(d, 0)


def spots(d):
    """the stage's EFF_ / LIGPOS_ / LIGTAR_ spots: name -> world matrix (16 floats, translation at 12..14)"""
    out = {}
    top = hp2stage.wii_entries(d)
    if not top:
        return out
    for nm, o, s in hp2stage.wii_entries(d, top[0][1]):
        if d[o:o + 4] != b'ZMB ':
            continue
        try:
            nodes = hp2stage.Zmb(d[o:o + s]).nodes()
        except Exception:
            continue
        world = {}

        def wm(i):
            if i in world:
                return world[i]
            nd = nodes[i]
            w = nd['m']
            if 0 <= nd['parent'] < len(nodes) and nd['parent'] != i:
                w = hp2stage.mat4mul(w, wm(nd['parent']))
            world[i] = w
            return w
        for i, nd in enumerate(nodes):
            if nd['name'].startswith(('EFF_', 'LIGPOS_', 'LIGTAR_')) and nd['name'] not in out:
                out[nd['name']] = [round(v, 4) for v in wm(i)]
    return out


def stage_effects(path, files, dol, n):
    """everything the renderer needs for a stage's effects"""
    d = open(path, 'rb').read()
    out = dict(spots=spots(d), slots=slots(dol), **stage_fx(dol, n))
    g = global_bank(files)
    if g:
        out['bank1'] = g
    if n in (200, 204, 205):
        c = chr_bank(files)
        if c:
            out['bank6'] = c
    top = hp2stage.wii_entries(d)
    if len(top) > 2 and d[top[2][1]:top[2][1] + 4] == b'WII\0':
        b5 = bank(d, top[2][1])
        if b5:
            out['bank5'] = b5
    if len(top) > 3 and d[top[3][1]:top[3][1] + 4] == b'WII\0':
        own = []
        ents = hp2stage.wii_entries(d, top[3][1])
        if len(ents) > 1 and d[ents[1][1]:ents[1][1] + 4] == b'ZAR\0':
            rs, cnt, do = zar_table(d, ents[1][1])
            if do and rs == 3:
                for i in range(cnt):
                    e, b8, on = struct.unpack_from('>bbb', d, do + 3 * i)
                    own.append(dict(effect=e, b8=b8, on=on))
        out['own'] = own
        # entry 0 (STGnnn_Prm): the stage's movie screens - u8 kind, then a name ('quarter'), read by 0x80055590:
        #   0 stage/upt01   1 bgv/<name>   2 stage/<fvo|mvo|pop|upt>_<name>0<1-3> (by play mode, random)
        #   3 stage/<name> (single02 ...)   4 zz_pv/ddr<song> (the song's own video)
        out['screen'] = _screen(d, ents)
    return out


def stage_screen(path):
    d = open(path, 'rb').read()
    top = hp2stage.wii_entries(d)
    if len(top) > 3 and d[top[3][1]:top[3][1] + 4] == b'WII\0':
        return _screen(d, hp2stage.wii_entries(d, top[3][1]))
    return None


def _screen(d, ents):
    if True:
        if ents and d[ents[0][1]:ents[0][1] + 4] == b'ZAR\0':
            try:
                B = ents[0][1]
                rs, cnt, do = zar_table(d, B)
                kind = d[do] if do else -1
                strs = [x.decode('latin1') for x in d[B:B + ents[0][2]].split(b'\0') if len(x) > 2 and x.isalnum()]
                name = [x for x in strs if x not in ('ZAR', 'WII')]
                return dict(kind=kind, name=name[-1] if name else '')
            except Exception:
                pass
    return None


def screen_movie(files, screen, slot, rnd):
    """which movie the stage's screens play (0x80055590) -> a movie path for /api/movie, or None"""
    if not screen:
        return None
    k, nm = screen.get('kind'), screen.get('name') or ''
    ok = lambda rel: rel if os.path.isfile(os.path.join(files, 'movie', rel)) else None
    # (format strings at 0x802713ec + 93 / 115 / 132-213 / 240 / 259; single01_w at +66 is another path)
    if k == 0:
        return ok('stage/upt01.thp')
    if k == 1:
        return ok('bgv/%s.thp' % nm)
    if k == 2:
        n = rnd.randint(1, 3)
        return ok('stage/upt_%s%02d.thp' % (nm, n)) or ok('stage/%s%02d.thp' % (nm, 1))
    if k == 3:
        return ok('stage/%s.thp' % nm)
    if k == 4:
        return ok('zz_pv/ddr%03d.thp' % slot) or ok('stage/quarter01.thp')
    return None


# ------------------------------------------------------------------ cue sheets
def cues(path):
    """a dance part's FRE file -> {cues: [...], cams: [...]}"""
    d = open(path, 'rb').read()
    ents = hp2stage.wii_entries(d)
    out = dict(cues=[], cams=[])
    if not ents:
        return out
    o0 = ents[0][1]
    if d[o0:o0 + 4] == b'ZAR\0':
        rs, cnt, H = zar_table(d, o0)
        if H:
            n = U32(d, H + 4)
            for i in range(min(n, (rs - 12) // 52)):
                o = H + 12 + 52 * i
                t, t2, pos, bpm, m0, f0, m1, f1, m4, f4 = struct.unpack_from('>ffIfififif', d, o)
                b = struct.unpack_from('>7b', d, o + 40)
                if pos >= 0x80000000:
                    continue                                  # the header row (time -1)
                if bpm == 0 and 0 <= pos < 4096 * 2000 and t == t and t > 0:
                    # the closing row: the part's length (seconds, and its position) - 0x80119f0c lays
                    # the parts end to end by it
                    out['end'] = dict(t=round(t, 4), m=round(pos / 4096, 4))
                    continue
                if not (0 <= pos < 4096 * 2000) or not (0 < bpm < 1000) or t != t:
                    continue                                  # (older sheets, e.g. HP1C, have another layout)
                c = dict(m=round(pos / 4096, 4), t=round(t, 3), bpm=round(bpm, 2))
                if t2 == t2 and t2 >= 0:
                    c['tt'] = round(t2, 4)                    # +4: the row's time in the whole dance's take
                if m0 >= 0:
                    c['mot'] = m0
                if m1 >= 0:
                    c['k1'] = [m1, round(f1, 3)]
                if m4 >= 0:
                    c['cam'] = [m4, round(f4, 3)]
                for k, nm in enumerate(('k5', 'light', 'fx', 'k23', 'k8', 'k9', 'k10')):
                    if b[k] >= 0:
                        c[nm] = b[k]
                if b[5] >= 0 or b[6] >= 0:
                    c['f48'] = round(F32(d, o + 48), 3)
                out['cues'].append(c)
    # entry 1: the dancers' formations (<series>_s1_pos_NN.zmb), picked by the cue column k5: node
    # s1_pos_NN_01 = the lead's spot, _02.._05 = the backups' (the silhouettes / the boss stage's other
    # dancers; a missing node = that dancer is not shown), s1_look_NN = where they face
    out['forms'] = []
    if len(ents) > 1 and d[ents[1][1]:ents[1][1] + 4] == b'WII\0':
        for nm, o, s in hp2stage.wii_entries(d, ents[1][1]):
            if d[o:o + 4] != b'ZMB ':
                continue
            groups = {}                      # (one file per formation in HP3U-HP5U; HP2U keeps them all in one)
            try:
                for nd in hp2stage.Zmb(d[o:o + s]).nodes():
                    m = re.match(r'^s\d+_(pos|look)_(\d+)(?:_(\d+))?$', nd['name'])
                    if not m:
                        continue
                    f = groups.setdefault(int(m.group(2)), dict(name='%s#%s' % (nm, m.group(2)), spots={}))
                    p = [round(v, 3) for v in nd['m'][12:15]]
                    if m.group(1) == 'look':
                        f['look'] = p
                    elif m.group(3):
                        f['spots'][int(m.group(3))] = p
            except (struct.error, IndexError, ValueError):
                pass
            out['forms'].extend(groups[k] for k in sorted(groups) if groups[k]['spots'])
    if len(ents) > 2 and d[ents[2][1]:ents[2][1] + 4] == b'WII\0':
        for nm, o, s in hp2stage.wii_entries(d, ents[2][1]):
            try:
                ln = F32(d, o)
                tr = [struct.unpack_from('>II', d, o + 4 + 8 * i) for i in range(6)]

                def keys(k, size):
                    nk, off = tr[k]
                    return [list(struct.unpack_from('>%df' % (size // 4), d, o + off + size * j)) for j in range(min(nk, 4096))]
                eye, fov, at = keys(0, 16), keys(2, 8), keys(3, 16)
                # (Hottest Party 4's sheets hold whole-song moves: HP4U_DDR054_CAM103.cam is 150.3 s)
                if eye and at and 0.1 < ln < 1000:
                    out['cams'].append(dict(hp2=True, ddr2=True, name=nm, len=ln, eye=eye, at=at, fov=fov or [[0, 60]], far=100000.0))
            except struct.error:
                pass
    return out
