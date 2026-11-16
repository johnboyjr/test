"""Records DDR II's 3D camera every frame while you play in Dolphin, so DDR II PC can be checked against
the real game number by number (not by eye from screenshots).

Setup (once):
    py -m pip install dolphin-memory-engine

Use:
    1. Start Dolphin and DDR II.
    2. Double-click camtrace.bat (or run:  py camtrace.py ) in the DDR II PC folder.
    3. Play one song. Press Enter the moment the song's first arrow line / music starts (type a note,
       e.g. the song's name), and again at anything worth marking.
    4. Press Ctrl+C after the song. Send the newest folder in 'camtrace' (zip it).

What it saves (it only reads memory, never changes anything):
    cam.bin      every frame, 300 bytes: time (f64, little-endian), the camera block's address (u32), the
                 camera block (256 bytes: the point the dance's camera moves are relative to, the stage's
                 travel, the eye, the target, the field of view) and the dance controller's first 32 bytes
                 (its chart time and position). Both are found through the game's own pointers (0x808a2558
                 -> camera, 0x808a258c -> dance controller), so normal songs and the boss both record.
    marks.txt    your marks (time + note)
    snap_*.bin.z the whole of MEM1 every 10 s and at each mark (for the dancers, the stage's clocks and the
                 camera move playing)
"""
import os
import struct
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

CAM_PTR, CTL_PTR, CAM_SIZE, CTL_SIZE = 0x808a2558, 0x808a258c, 0x100, 0x20
MEM1, SIZE = 0x80000000, 0x01800000
SNAP_EVERY = 10.0
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'camtrace', time.strftime('%Y%m%d_%H%M%S'))


def hook():
    print('Looking for Dolphin (start DDR II in Dolphin if it isn\'t running)...')
    while True:
        dme.hook()
        if dme.is_hooked():
            print('Found Dolphin.')
            return
        time.sleep(1.0)


def snap(t0, tag):
    try:
        data = dme.read_bytes(MEM1, SIZE)
    except Exception:
        return
    name = 'snap_t%07.2f_%s.bin.z' % (time.time() - t0, tag)
    with open(os.path.join(OUT, name), 'wb') as f:
        f.write(zlib.compress(data, 6))
    print('  saved', name)


def main():
    os.makedirs(OUT, exist_ok=True)
    hook()
    print('Recording to', OUT)
    print('Press Enter to mark a moment (then type a short note), Ctrl+C to stop.\n')
    marks = []

    def keys():
        while True:
            try:
                input()
                marks.append(input('  note: ').strip() or 'mark')
            except EOFError:
                return
    threading.Thread(target=keys, daemon=True).start()
    t0 = time.time()
    last, nxt, frames = None, time.time() + SNAP_EVERY, 0
    with open(os.path.join(OUT, 'cam.bin'), 'wb') as cam, open(os.path.join(OUT, 'marks.txt'), 'a', encoding='utf-8') as mk:
        try:
            while True:
                try:
                    ca = struct.unpack('>I', dme.read_bytes(CAM_PTR, 4))[0]
                    co = struct.unpack('>I', dme.read_bytes(CTL_PTR, 4))[0]
                    if not (0x80000000 <= ca < 0x81800000 - CAM_SIZE):
                        time.sleep(0.004)
                        continue
                    blk = struct.pack('>I', ca) + dme.read_bytes(ca, CAM_SIZE)
                    blk += dme.read_bytes(co, CTL_SIZE) if 0x80000000 <= co < 0x81800000 - CTL_SIZE else bytes(CTL_SIZE)
                except Exception:
                    if not dme.is_hooked():
                        hook()
                    time.sleep(0.1)
                    continue
                if blk != last:                       # a new frame
                    cam.write(struct.pack('<d', time.time() - t0) + blk)
                    last = blk
                    frames += 1
                while marks:
                    note = marks.pop(0)
                    mk.write('%.3f\t%s\n' % (time.time() - t0, note)); mk.flush()
                    snap(t0, 'mark')
                if time.time() >= nxt:
                    snap(t0, 'auto')
                    nxt = time.time() + SNAP_EVERY
                time.sleep(0.004)
        except KeyboardInterrupt:
            print('\nStopped: %d camera frames in %s' % (frames, OUT))
            input('Press Enter to close.')


if __name__ == '__main__':
    main()
