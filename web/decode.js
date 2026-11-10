// Decoders for DDR II's Wii data: DSP-ADPCM audio (RWAR / BRSTM), textures (TPL CMPR / RGB5A3)
// and step charts (ss4). Everything works on ArrayBuffers fetched from the local server.
'use strict';

const DDR = (typeof module !== 'undefined') ? module.exports : (window.DDR = {});

function be(buf) { return new DataView(buf); }

// ---------------------------------------------------------------- DSP-ADPCM
function dspDecode(u8, start, nsamples, coefs, out, outPos, h1, h2) {
  // decodes nsamples from frame-aligned data at u8[start], returns [h1, h2]
  let p = start, k = 0;
  while (k < nsamples) {
    const ps = u8[p];
    const ci = ps >> 4, sc = 1 << (ps & 15);
    const c1 = coefs[ci * 2], c2 = coefs[ci * 2 + 1];
    for (let i = 0; i < 14 && k < nsamples; i++) {
      const b = u8[p + 1 + (i >> 1)];
      let nb = (i & 1) ? (b & 15) : (b >> 4);
      if (nb >= 8) nb -= 16;
      let x = ((nb * sc) << 11) + 1024 + c1 * h1 + c2 * h2;
      x >>= 11;
      if (x > 32767) x = 32767; else if (x < -32768) x = -32768;
      out[outPos + k] = x / 32768;
      h2 = h1; h1 = x; k++;
    }
    p += 8;
  }
  return [h1, h2];
}

DDR.dspDecode = (...a) => dspDecode(...a);

function readCoefs(dv, off) {
  const c = new Int16Array(16);
  for (let i = 0; i < 16; i++) c[i] = dv.getInt16(off + i * 2);
  return c;
}

// NW4R RWAR (wave archive) -> first wave, as {rate, chans: [Float32Array]}
DDR.decodeRWAR = function (buf) {
  const dv = be(buf), u8 = new Uint8Array(buf);
  const tabl = dv.getUint32(0x10), data = dv.getUint32(0x18);
  const woff = data + dv.getUint32(tabl + 12 + 4);
  return decodeRWAV(dv, u8, woff);
};

DDR.decodeRWAV = (buf) => decodeRWAV(new DataView(buf), new Uint8Array(buf), 0);

function decodeRWAV(dv, u8, base) {
  const wi = base + dv.getUint32(base + 0x10) + 8;
  const nch = dv.getUint8(wi + 2), rate = dv.getUint16(wi + 4);
  const loopEnd = dv.getUint32(wi + 12), chtab = dv.getUint32(wi + 16), dloc = dv.getUint32(wi + 20);
  const n = Math.floor((loopEnd - 2) / 16) * 14 + (loopEnd - 2) % 16 + 1;
  const data0 = wi + dloc + 8;
  const chans = [];
  for (let c = 0; c < nch; c++) {
    const ci = wi + dv.getUint32(wi + chtab + 4 * c);
    const doff = dv.getUint32(ci), aoff = dv.getUint32(ci + 4);
    const out = new Float32Array(n);
    dspDecode(u8, data0 + doff, n, readCoefs(dv, wi + aoff), out, 0, 0, 0);
    chans.push(out);
  }
  return { rate, chans };
}

// BRSTM (previews) -> {rate, chans, loopStart}
DDR.decodeBRSTM = function (buf) {
  const dv = be(buf), u8 = new Uint8Array(buf);
  const head = dv.getUint32(0x10), hb = head + 8;
  const h1 = hb + dv.getUint32(hb + 4), h3 = hb + dv.getUint32(hb + 20);
  const codec = dv.getUint8(h1), nch = dv.getUint8(h1 + 2), rate = dv.getUint16(h1 + 4);
  if (codec !== 2) throw new Error('unsupported BRSTM codec ' + codec);
  const loopStart = dv.getUint32(h1 + 8), n = dv.getUint32(h1 + 12), dataOff = dv.getUint32(h1 + 16);
  const nblocks = dv.getUint32(h1 + 20), bsize = dv.getUint32(h1 + 24), spb = dv.getUint32(h1 + 28);
  const lastSamples = dv.getUint32(h1 + 36), lastPad = dv.getUint32(h1 + 40);
  const chn = dv.getUint8(h3);
  const coefs = [];
  for (let c = 0; c < chn; c++) {
    const ci = hb + dv.getUint32(h3 + 4 + 8 * c + 4);
    coefs.push(readCoefs(dv, hb + dv.getUint32(ci + 4)));
  }
  const chans = [], hist = [];
  for (let c = 0; c < nch; c++) { chans.push(new Float32Array(n)); hist.push([0, 0]); }
  let pos = dataOff, s = 0;
  for (let b = 0; b < nblocks; b++) {
    const last = b === nblocks - 1;
    const size = last ? lastPad : bsize, cnt = last ? lastSamples : spb;
    for (let c = 0; c < nch; c++) {
      hist[c] = dspDecode(u8, pos, cnt, coefs[c], chans[c], s, hist[c][0], hist[c][1]);
      pos += size;
    }
    s += cnt;
  }
  return { rate, chans, loopStart };
};

// ---------------------------------------------------------------- textures
// server sends: u16 w, u16 h, u32 fmt, u32 len, data
DDR.decodeTexture = function (buf) {
  const dv = be(buf);
  const w = dv.getUint16(0), h = dv.getUint16(2), fmt = dv.getUint32(4);
  const u8 = new Uint8Array(buf, 12);
  const px = new Uint8ClampedArray(w * h * 4);
  if (fmt === 14) cmpr(u8, w, h, px); else if (fmt === 5) rgb5a3(u8, w, h, px);
  else throw new Error('texture format ' + fmt);
  return { w, h, px };
};

function c565(v) {
  const r = (v >> 11) & 31, g = (v >> 5) & 63, b = v & 31;
  return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
}

function cmpr(u8, w, h, px) {
  let p = 0;
  const pal = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let ty = 0; ty < h; ty += 8)
    for (let tx = 0; tx < w; tx += 8)
      for (let sy = 0; sy < 8; sy += 4)
        for (let sx = 0; sx < 8; sx += 4) {
          const v0 = (u8[p] << 8) | u8[p + 1], v1 = (u8[p + 2] << 8) | u8[p + 3];
          const a = c565(v0), b = c565(v1);
          pal[0] = [a[0], a[1], a[2], 255]; pal[1] = [b[0], b[1], b[2], 255];
          if (v0 > v1) {
            pal[2] = [(2 * a[0] + b[0]) / 3, (2 * a[1] + b[1]) / 3, (2 * a[2] + b[2]) / 3, 255];
            pal[3] = [(a[0] + 2 * b[0]) / 3, (a[1] + 2 * b[1]) / 3, (a[2] + 2 * b[2]) / 3, 255];
          } else {
            pal[2] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, 255];
            pal[3] = [0, 0, 0, 0];
          }
          for (let y = 0; y < 4; y++) {
            const row = u8[p + 4 + y];
            for (let x = 0; x < 4; x++) {
              const X = tx + sx + x, Y = ty + sy + y;
              if (X >= w || Y >= h) continue;
              const c = pal[(row >> (6 - 2 * x)) & 3], o = (Y * w + X) * 4;
              px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3];
            }
          }
          p += 8;
        }
}

function rgb5a3(u8, w, h, px) {
  let p = 0;
  for (let ty = 0; ty < h; ty += 4)
    for (let tx = 0; tx < w; tx += 4)
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++, p += 2) {
          const v = (u8[p] << 8) | u8[p + 1], X = tx + x, Y = ty + y;
          if (X >= w || Y >= h) continue;
          const o = (Y * w + X) * 4;
          if (v & 0x8000) {
            px[o] = ((v >> 10) & 31) * 255 / 31; px[o + 1] = ((v >> 5) & 31) * 255 / 31;
            px[o + 2] = (v & 31) * 255 / 31; px[o + 3] = 255;
          } else {
            px[o] = ((v >> 8) & 15) * 17; px[o + 1] = ((v >> 4) & 15) * 17;
            px[o + 2] = (v & 15) * 17; px[o + 3] = ((v >> 12) & 7) * 255 / 7;
          }
        }
}

// ---------------------------------------------------------------- charts
// Units: 4096 per measure (1024 per beat). Tempo chunk maps units -> ticks (tps per second).
DDR.parseSS4 = function (buf) {
  const dv = new DataView(buf);
  let p = 0;
  const out = { tempo: null, charts: {} };
  while (p + 12 <= buf.byteLength) {
    const size = dv.getUint32(p, true), type = dv.getUint16(p + 4, true);
    const p2 = dv.getUint16(p + 6, true), n = dv.getUint32(p + 8, true);
    if (!size) break;
    if (type === 1) {
      const offs = [], ticks = [];
      for (let i = 0; i < n; i++) { offs.push(dv.getInt32(p + 12 + 4 * i, true)); ticks.push(dv.getInt32(p + 12 + 4 * (n + i), true)); }
      out.tempo = { offs, secs: ticks.map(t => t / p2) };
    } else if (type === 16) {
      const notes = [];
      const base = p + 12 + 4 * n;              // n panel bytes, then a 4-byte flag per note
      const fbase = (base + n + 3) & ~3;          // (flags are 4-byte aligned; 0x100 = freeze end)
      for (let i = 0; i < n; i++) {
        const flag = dv.getUint32(fbase + 4 * i);
        notes.push({ off: dv.getInt32(p + 12 + 4 * i, true), lane: dv.getUint8(base + i), end: flag !== 0 });
      }
      out.charts[p2] = notes;
    }
    p += size;
  }
  return out;
};

// tempo helpers
DDR.Timing = class {
  constructor(t) { this.o = t.offs; this.s = t.secs; }
  timeOf(off) {  // units -> seconds
    const o = this.o, s = this.s, n = o.length;
    let i = 0;
    while (i < n - 2 && off >= o[i + 1]) i++;
    if (o[i + 1] === o[i]) return s[i + 1];
    return s[i] + (off - o[i]) * (s[i + 1] - s[i]) / (o[i + 1] - o[i]);
  }
  offAt(t) {  // seconds -> units (stops hold the position still)
    const o = this.o, s = this.s, n = o.length;
    let i = 0;
    while (i < n - 2 && t >= s[i + 1]) i++;
    if (s[i + 1] === s[i]) return o[i + 1];
    return o[i] + (t - s[i]) * (o[i + 1] - o[i]) / (s[i + 1] - s[i]);
  }
  bpmAt(t) {
    const o = this.o, s = this.s, n = o.length;
    let i = 0;
    while (i < n - 2 && t >= s[i + 1]) i++;
    const ds = s[i + 1] - s[i];
    return ds > 0 ? (o[i + 1] - o[i]) / 1024 / ds * 60 : 0;
  }
};

// chart key: (difficulty << 8) | style. difficulty 4 beginner, 1 basic, 2 difficult, 3 expert;
// style 0x14 single (lanes 0-3), 0x18 double (lanes 0-7)
DDR.buildNotes = function (ss4, key) {
  const raw = ss4.charts[key];
  if (!raw) return null;
  const timing = new DDR.Timing(ss4.tempo);
  const sorted = raw.map((n, i) => Object.assign({ i }, n)).sort((a, b) => a.off - b.off || a.i - b.i);
  const notes = [], lastInLane = {};
  for (const r of sorted) {
    if (r.end) {
      const head = lastInLane[r.lane];
      if (head && head.endOff === undefined) {
        head.endOff = r.off; head.endT = timing.timeOf(r.off);
        continue;
      }
    }
    const n = { off: r.off, t: timing.timeOf(r.off), lane: r.lane };
    notes.push(n);
    lastInLane[r.lane] = n;
  }
  return { notes, timing };
};
