"""Cabinet lights through an Ultimarc PAC Drive (16 outputs per board, up to 4 boards).

Uses Ultimarc's own PacDrive DLL from their SDK (http://www.ultimarc.com/PacDriveSDK.zip):
PacDrive64.dll for 64-bit Python, PacDrive32.dll for 32-bit. Put it next to this program (or pick
it in Options > LIGHTS). Functions used: PacInitialize() -> number of boards,
PacSetLEDStates(board, 16 bits), PacShutdown().
"""
import ctypes, glob, os, struct, threading

HERE = os.path.dirname(os.path.abspath(__file__))
BITS = struct.calcsize('P') * 8
NAMES = ('PacDrive64.dll', 'PacDrive.dll') if BITS == 64 else ('PacDrive32.dll', 'PacDrive.dll')


class Lights:
    def __init__(self):
        self.dll = None
        self.path = None
        self.boards = 0
        self.msg = 'Not started.'
        self.want = [0, 0, 0, 0]      # wanted bits per board
        self.sent = [None] * 4
        self.cv = threading.Condition()
        self.thread = None

    def find(self, picked=None):
        if picked and os.path.isfile(picked):
            return picked
        home = os.path.expanduser('~')
        pats = []
        for base in (HERE, os.path.join(home, 'Downloads'), os.path.join(home, 'Desktop')):
            for n in NAMES:
                pats += [os.path.join(base, n), os.path.join(base, '*', n), os.path.join(base, '*', '*', n),
                         os.path.join(base, '*', '*', '*', n)]
        for p in pats:
            hits = sorted(glob.glob(p))
            if hits:
                return hits[0]
        return None

    def start(self, picked=None):
        """load the DLL and find the boards; safe to call again (e.g. after picking the DLL)"""
        if os.name != 'nt':
            self.msg = 'The PAC Drive works on Windows only.'
            return False
        path = self.find(picked)
        if not path:
            self.msg = ('%s not found. Get it from Ultimarc\'s PacDrive SDK and put it next to DDR II PC '
                        '(or pick it here).' % NAMES[0])
            return False
        try:
            if self.dll is not None:
                try:
                    self.dll.PacShutdown()
                except Exception:
                    pass
            dll = ctypes.WinDLL(path)
            dll.PacInitialize.restype = ctypes.c_int
            dll.PacSetLEDStates.argtypes = [ctypes.c_int, ctypes.c_ushort]
            dll.PacSetLEDStates.restype = ctypes.c_bool
            n = dll.PacInitialize()
        except (OSError, AttributeError) as ex:
            self.msg = 'Could not load %s (%s). Use the %d-bit DLL.' % (os.path.basename(path), ex, BITS)
            return False
        self.dll, self.path, self.boards = dll, path, int(n)
        self.sent = [None] * 4
        self.msg = ('%d PAC Drive board%s found.' % (n, '' if n == 1 else 's')) if n else 'No PAC Drive found (is it plugged in?).'
        if self.thread is None:
            self.thread = threading.Thread(target=self.run, daemon=True)
            self.thread.start()
        return n > 0

    def set(self, bits):
        """bits: one int per board (16 outputs each, bit 0 = output 1)"""
        with self.cv:
            for i in range(4):
                self.want[i] = int(bits[i]) & 0xFFFF if i < len(bits) else 0
            self.cv.notify()

    def run(self):
        while True:
            with self.cv:
                self.cv.wait_for(lambda: self.want != self.sent)
                want = list(self.want)
            for i in range(min(self.boards, 4)):
                if want[i] != self.sent[i]:
                    try:
                        self.dll.PacSetLEDStates(i, want[i])
                    except Exception as ex:
                        self.msg = 'PAC Drive error: %s' % ex
            with self.cv:
                self.sent = want if self.boards else list(self.want)

    def status(self):
        return {'ok': self.boards > 0, 'boards': self.boards, 'dll': self.path, 'msg': self.msg}


LIGHTS = Lights()
