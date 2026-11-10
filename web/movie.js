// THP movie player (the Wii's Motion-JPEG movies). Frames come from the server a chunk at a
// time and are decoded by the browser; the audio track (if any) is decoded once up front.
'use strict';

class Movie {
  constructor(file, opts = {}) {
    this.file = file; this.loop = !!opts.loop; this.wantAudio = !!opts.audio;
    this.frames = new Map(); this.pending = new Set(); this.info = null; this.failed = false;
    this.chunk = 30; this.last = null;
    this.ready = this.init();
  }
  async init() {
    try {
      const r = await fetch('/api/movie/info?f=' + encodeURIComponent(this.file));
      if (!r.ok) throw new Error('no movie');
      this.info = await r.json();
      if (this.wantAudio && this.info.audio) this.audio = await this.loadAudio();
      this.fetchChunk(0);
    } catch (e) { this.failed = true; }
  }
  async loadAudio() {
    const buf = await (await fetch('/api/movie/audio?f=' + encodeURIComponent(this.file))).arrayBuffer();
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    const nch = this.info.audio.channels, total = this.info.audio.samples + 20000;
    const chans = []; for (let c = 0; c < nch; c++) chans.push(new Float32Array(total));
    let p = 0, pos = 0;
    while (p + 4 <= buf.byteLength) {
      const len = dv.getUint32(p); p += 4;
      if (len >= 80) {
        const chSize = dv.getUint32(p), n = dv.getUint32(p + 4);
        for (let c = 0; c < nch; c++) {
          const coefs = new Int16Array(16);
          for (let k = 0; k < 16; k++) coefs[k] = dv.getInt16(p + 8 + c * 32 + k * 2);
          const h1 = dv.getInt16(p + 72 + c * 4), h2 = dv.getInt16(p + 74 + c * 4);
          if (pos + n <= total) DDR.dspDecode(u8, p + 80 + c * chSize, n, coefs, chans[c], pos, h1, h2);
        }
        pos += n;
      }
      p += len;
    }
    return { rate: this.info.audio.rate, chans: chans.map(c => c.subarray(0, pos)) };
  }
  async fetchChunk(start) {
    if (!this.info || start >= this.info.frames || this.pending.has(start)) return;
    this.pending.add(start);
    try {
      const buf = await (await fetch(`/api/movie/frames?f=${encodeURIComponent(this.file)}&s=${start}&n=${this.chunk}`)).arrayBuffer();
      const dv = new DataView(buf);
      const n = dv.getUint32(0);
      let p = 4;
      const jobs = [];
      for (let i = 0; i < n; i++) {
        const vl = dv.getUint32(p), al = dv.getUint32(p + 4);
        const jpg = new Uint8Array(buf, p + 8, vl);
        p += 8 + vl + al;
        const idx = start + i;
        jobs.push(createImageBitmap(new Blob([jpg], { type: 'image/jpeg' })).then(b => this.frames.set(idx, b)).catch(() => {}));
      }
      await Promise.all(jobs);
    } catch (e) { /* try again later */ }
    this.pending.delete(start);
  }
  frameAt(t) {
    if (!this.info) return null;
    const n = this.info.frames;
    let i = Math.floor(t * this.info.fps);
    if (this.loop) i = ((i % n) + n) % n; else i = Math.max(0, Math.min(n - 1, i));
    // keep about 3 seconds decoded ahead, drop what's behind
    const c = this.chunk;
    for (let k = 0; k < 3; k++) {
      let s = (Math.floor(i / c) + k) * c;
      if (this.loop) s = s % n;
      if (!this.frames.has(s) && !this.pending.has(s) && s < n) this.fetchChunk(s);
    }
    for (const [k, b] of this.frames) {
      const ahead = this.loop ? ((k - i) % n + n) % n : k - i;
      if (ahead > 150 || ahead < -15 && !this.loop) { b.close && b.close(); this.frames.delete(k); }
    }
    for (let j = i; j >= Math.max(0, i - 15); j--) if (this.frames.has(j)) { this.last = this.frames.get(j); break; }
    return this.last;
  }
  get duration() { return this.info ? this.info.frames / this.info.fps : 0; }
  close() { for (const b of this.frames.values()) b.close && b.close(); this.frames.clear(); this.closed = true; }
}

// A normal video file (custom songs: .mp4 / .webm), kept in step with the song.
// Same use as Movie: frameAt(songSeconds) -> something drawImage can draw (or null).
class VideoMovie {
  constructor(url, start = 0) {
    this.start = start; this.failed = false; this.ok = false;
    const v = this.v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    v.addEventListener('loadeddata', () => { v.width = v.videoWidth; v.height = v.videoHeight; this.ok = true; });
    v.addEventListener('error', () => { this.failed = true; });
  }
  frameAt(t) {
    const v = this.v, at = t - this.start;
    if (this.failed || !this.ok || at < 0) return null;
    if (v.duration && at >= v.duration) { if (!v.paused) v.pause(); return v; }   // hold the last frame
    // play along with the song; jump if it drifts more than a little
    if (Math.abs(v.currentTime - at) > 0.25) { try { v.currentTime = at; } catch (e) {} }
    if (v.paused) v.play().catch(() => {});
    return v;
  }
  close() { try { this.v.pause(); this.v.removeAttribute('src'); this.v.load(); } catch (e) {} }
}
