"""DDR II sound effects and announcer lines from the NW4R sound archive.

Menu sounds and the announcer are sequence sounds: a tiny sequence picks an instrument
(program) and plays a note; the bank maps the program to a wave in the group's wave
archive. This runs the sequence (including its random choices) and returns the notes to play.
"""
import random, struct

U = lambda d, o: struct.unpack_from('>I', d, o)[0]


class SoundIndex:
    def __init__(self, path, info, ib):
        self.path, self.d, self.ib = path, info, ib
        d = info

        def table(ref):
            t = ib + U(d, ref + 4)
            return [ib + U(d, t + 4 + 8 * i + 4) for i in range(U(d, t))]
        self.sounds = table(ib + 0)
        self.banks = table(ib + 8)
        self.groups = table(ib + 32)
        self.names = {}
        self._group_of_file = None
        self.cache = {}

    def set_strings(self, strings):
        for i, o in enumerate(self.sounds):
            sid = U(self.d, o)
            if sid < len(strings):
                self.names[strings[sid]] = i

    def group_of_file(self, fid):
        if self._group_of_file is None:
            m = {}
            d = self.d
            for o in self.groups:
                goff, gsize, woff, wsize = struct.unpack_from('>4I', d, o + 16)
                it = self.ib + U(d, o + 36)
                for k in range(U(d, it)):
                    io = self.ib + U(d, it + 4 + 8 * k + 4)
                    f, off, size, wo, ws = struct.unpack_from('>5I', d, io)
                    m.setdefault(f, (goff + off, size, woff + wo, ws))
            self._group_of_file = m
        return self._group_of_file.get(fid)

    def read(self, off, n):
        with open(self.path, 'rb') as f:
            f.seek(off)
            return f.read(n)

    def file_bytes(self, fid):
        k = ('f', fid)
        if k not in self.cache:
            loc = self.group_of_file(fid)
            self.cache[k] = (self.read(loc[0], loc[1]), loc) if loc else (None, None)
        return self.cache[k]

    def rwar(self, woff, wsize):
        k = ('w', woff)
        if k not in self.cache:
            self.cache[k] = self.read(woff, wsize)
        return self.cache[k]

    # ------------------------------------------------------------------ sequence
    def play(self, name):
        """-> list of notes: {t (s), wave (RWAV bytes), key, root, vel, vol, tune}"""
        i = self.names.get(name)
        if i is None:
            return []
        so = self.sounds[i]
        d = self.d
        typ, vol = d[so + 22], d[so + 20]
        if typ != 1:
            return []
        fid = U(d, so + 4)
        det = self.ib + U(d, so + 28)
        start, bank_id = struct.unpack_from('>II', d, det)
        seq, _ = self.file_bytes(fid)
        bo = self.banks[bank_id]
        bnk, bloc = self.file_bytes(U(d, bo + 4))
        if seq is None or bnk is None:
            return []
        war = self.rwar(bloc[2], bloc[3])
        base = U(seq, 0x10) + 0x0C
        notes = self.run(seq, base, start)
        out = []
        for t, prg, key, vel, v in notes:
            inst = self.instrument(bnk, prg, key)
            if not inst:
                continue
            wave = self.wave(war, inst['wave'])
            if wave:
                out.append(dict(t=t, wave=wave, key=key, root=inst['root'], vel=vel, vol=(v / 127.0) * (inst['vol'] / 127.0) * (vol / 127.0),
                                tune=inst['tune']))
        return out

    def run(self, seq, base, start):
        pc = base + start
        vars_ = [0] * 32
        stack, notes = [], []
        t, prg, vol, flag = 0.0, 0, 127, True
        tick = 60.0 / (120 * 48)
        steps = 0

        def varlen(p):
            v = 0
            while True:
                b = seq[p]; p += 1
                v = (v << 7) | (b & 0x7F)
                if not b & 0x80:
                    return v, p
        while steps < 2000 and 0 <= pc < len(seq):
            steps += 1
            c = seq[pc]; pc += 1
            mode, cond = None, True
            while c in (0xA0, 0xA1, 0xA2):
                if c == 0xA2:
                    cond = flag
                else:
                    mode = c
                c = seq[pc]; pc += 1

            def arg(kind, p):
                """read an argument of the given kind, honouring a random/variable prefix"""
                if mode == 0xA0:
                    lo, hi = struct.unpack_from('>hh', seq, p)
                    return random.randint(min(lo, hi), max(lo, hi)), p + 4
                if mode == 0xA1:
                    return vars_[seq[p] & 31], p + 1
                if kind == 'u8':
                    return seq[p], p + 1
                if kind == 's16':
                    return struct.unpack_from('>h', seq, p)[0], p + 2
                if kind == 'var':
                    return varlen(p)
                return 0, p
            if c < 0x80:
                vel = seq[pc]; pc += 1
                ln, pc = arg('var', pc)
                if cond:
                    notes.append((t, prg, c, vel, vol))
            elif c == 0x80:
                w, pc = arg('var', pc)
                if cond:
                    t += w * tick
            elif c == 0x81:
                p_, pc = arg('var', pc)
                if cond:
                    prg = p_
            elif c == 0x88:
                pc += 4
            elif c in (0x89, 0x8A):
                tgt = (seq[pc] << 16) | (seq[pc + 1] << 8) | seq[pc + 2]; pc += 3
                if cond:
                    if c == 0x8A:
                        stack.append(pc)
                    pc = base + tgt
            elif 0xB0 <= c <= 0xDF:
                v, pc = arg('u8', pc)
                if cond and c == 0xC1:
                    vol = v
            elif 0xE0 <= c <= 0xEF:
                v, pc = arg('s16', pc)
            elif c == 0xF0:
                sub = seq[pc]; pc += 1
                var = seq[pc] & 31; pc += 1
                v, pc = arg('s16', pc)
                if not cond:
                    continue
                if sub == 0x80: vars_[var] = v
                elif sub == 0x81: vars_[var] += v
                elif sub == 0x82: vars_[var] -= v
                elif sub == 0x83: vars_[var] *= v
                elif sub == 0x84: vars_[var] = int(vars_[var] / v) if v else 0
                elif sub == 0x86: vars_[var] = random.randint(0, v) if v >= 0 else random.randint(v, 0)
                elif sub == 0x8B: vars_[var] = vars_[var] % v if v else 0
                elif sub == 0x90: flag = vars_[var] == v
                elif sub == 0x91: flag = vars_[var] >= v
                elif sub == 0x92: flag = vars_[var] > v
                elif sub == 0x93: flag = vars_[var] <= v
                elif sub == 0x94: flag = vars_[var] < v
                elif sub == 0x95: flag = vars_[var] != v
            elif c == 0xFD:
                if cond:
                    if not stack:
                        break
                    pc = stack.pop()
            elif c == 0xFE:
                pc += 2
            elif c == 0xFF:
                if cond:
                    if stack:
                        pc = stack.pop()
                    else:
                        break
            elif 0xF0 < c < 0xFD:
                pass
            else:
                pass
        return notes

    def instrument(self, bnk, prg, key):
        data = U(bnk, 0x10)
        db = data + 8
        n = U(bnk, data + 8)
        if prg >= n:
            return None
        ref = db + 4 + 8 * prg

        def resolve(ref, depth=0):
            if depth > 4:
                return None
            typ, off = bnk[ref + 1], U(bnk, ref + 4)
            p = db + off
            if typ == 1:
                wave = struct.unpack_from('>i', bnk, p)[0]
                return dict(wave=wave, root=bnk[p + 12], vol=bnk[p + 13], tune=struct.unpack_from('>f', bnk, p + 16)[0])
            if typ == 2:      # key ranges
                cnt = bnk[p]
                keys = bnk[p + 1:p + 1 + cnt]
                rb = (p + 1 + cnt + 3) & ~3
                for k, top in enumerate(keys):
                    if key <= top:
                        return resolve(rb + 8 * k, depth + 1)
                return None
            if typ == 3:      # index table
                lo, hi = bnk[p], bnk[p + 1]
                if lo <= key <= hi:
                    return resolve(p + 4 + 8 * (key - lo), depth + 1)
                return None
            return None
        return resolve(ref)

    @staticmethod
    def wave(war, idx):
        if war[:4] != b'RWAR':
            return None
        tabl = U(war, 0x10)
        n = U(war, tabl + 8)
        if not 0 <= idx < n:
            return None
        off, size = struct.unpack_from('>II', war, tabl + 12 + 12 * idx + 4)
        data = U(war, 0x18)
        return war[data + off:data + off + size]
