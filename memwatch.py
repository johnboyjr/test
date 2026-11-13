"""Records the game's memory while you play in Dolphin, so the DDR II PC project can study it afterwards.

Setup (once):
    py -m pip install dolphin-memory-engine

Use:
    1. Start Dolphin and the game (Hottest Party 2, Hottest Party or DDR II).
    2. Double-click memwatch.bat (or run:  py memwatch.py ) in the DDR II PC folder.
    3. Play normally for about 10 minutes: menus, song select, a few songs, results.
       - Every 15 seconds a snapshot of the game's memory (MEM1 24 MB + MEM2 64 MB) is saved, compressed.
       - Press Enter in this window at any moment worth marking (a song starting, the results
         screen, picking a dancer...) and type a short note: an extra snapshot is saved with it.
    4. Press Ctrl+C to stop. Everything is in the 'memwatch' folder next to this file.

It only reads memory; it never changes anything in Dolphin or the game.
"""
import os
import sys
import threading
import time
import zlib

try:
    import dolphin_memory_engine as dme
except ImportError:
    print('This needs the dolphin-memory-engine package. Run:  py -m pip install dolphin-memory-engine')
    input('Press Enter to close.')
    sys.exit(1)

EVERY = 15.0                      # seconds between automatic snapshots
MEM1, SIZE = 0x80000000, 0x01800000
MEM2, SIZE2 = 0x90000000, 0x04000000   # the Wii's second memory (64 MB): charts, models, dance moves live here
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'memwatch', time.strftime('%Y%m%d_%H%M%S'))


def hook():
    print('Looking for Dolphin (start the game in Dolphin if it isn\'t running)...')
    while True:
        dme.hook()
        if dme.is_hooked():
            try:
                gid = dme.read_bytes(MEM1, 6).decode('ascii', 'replace')
            except Exception:
                gid = '??????'
            print('Found Dolphin, game', gid)
            return gid
        time.sleep(1.0)


def snapshot(n, t0, note=''):
    for _ in range(3):
        try:
            data = dme.read_bytes(MEM1, SIZE)
            try:
                data2 = b''.join(dme.read_bytes(MEM2 + o, 0x400000) for o in range(0, SIZE2, 0x400000))
            except Exception:
                data2 = b''
            break
        except Exception:
            if not dme.is_hooked():
                hook()
            time.sleep(0.5)
    else:
        print('  could not read memory, skipped')
        return
    t = time.time() - t0
    name = 'snap_%04d_t%05d.bin.z' % (n, int(t))
    with open(os.path.join(OUT, name), 'wb') as f:
        f.write(zlib.compress(data, 6))
    if data2:
        with open(os.path.join(OUT, name.replace('snap_', 'mem2_')), 'wb') as f:
            f.write(zlib.compress(data2, 6))
    with open(os.path.join(OUT, 'log.txt'), 'a', encoding='utf-8') as f:
        f.write('%s\t%.1f\t%s\n' % (name, t, note))
    print('  saved %s%s' % (name, ('  (' + note + ')') if note else ''))


def main():
    os.makedirs(OUT, exist_ok=True)
    gid = hook()
    with open(os.path.join(OUT, 'log.txt'), 'a', encoding='utf-8') as f:
        f.write('game\t%s\tstarted %s\n' % (gid, time.strftime('%Y-%m-%d %H:%M:%S')))
    print('Recording to', OUT)
    print('Press Enter to mark a moment (then type a short note), Ctrl+C to stop.\n')
    t0, n = time.time(), [0]
    lock = threading.Lock()
    marks = []

    def keys():
        while True:
            try:
                input()
                note = input('  note: ').strip() or 'mark'
            except EOFError:
                return
            marks.append(note)
    threading.Thread(target=keys, daemon=True).start()
    nxt = time.time()
    try:
        while True:
            while marks:
                with lock:
                    n[0] += 1
                    snapshot(n[0], t0, marks.pop(0))
            if time.time() >= nxt:
                with lock:
                    n[0] += 1
                    snapshot(n[0], t0)
                nxt = time.time() + EVERY
            time.sleep(0.1)
    except KeyboardInterrupt:
        print('\nStopped. %d snapshots in %s' % (n[0], OUT))
        input('Press Enter to close.')


if __name__ == '__main__':
    main()
