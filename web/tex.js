// GameCube/Wii TPL texture sets -> canvases. Handles every format the game uses
// (I4, I8, IA4, IA8, RGB565, RGB5A3, RGBA8, C4, C8, C14X2, CMPR).
'use strict';

(function () {
  const BLK = { 0: [8, 8, 4], 1: [8, 4, 8], 2: [8, 4, 8], 3: [4, 4, 16], 4: [4, 4, 16], 5: [4, 4, 16],
                6: [4, 4, 32], 8: [8, 8, 4], 9: [8, 4, 8], 10: [4, 4, 16], 14: [8, 8, 4] };

  function c5a3(v, out, o) {
    if (v & 0x8000) {
      out[o] = ((v >> 10) & 31) * 255 / 31; out[o + 1] = ((v >> 5) & 31) * 255 / 31;
      out[o + 2] = (v & 31) * 255 / 31; out[o + 3] = 255;
    } else {
      out[o] = ((v >> 8) & 15) * 17; out[o + 1] = ((v >> 4) & 15) * 17;
      out[o + 2] = (v & 15) * 17; out[o + 3] = ((v >> 12) & 7) * 255 / 7;
    }
  }
  function c565(v, out, o) {
    const r = (v >> 11) & 31, g = (v >> 5) & 63, b = v & 31;
    out[o] = (r << 3) | (r >> 2); out[o + 1] = (g << 2) | (g >> 4); out[o + 2] = (b << 3) | (b >> 2); out[o + 3] = 255;
  }

  function palette(dv, n, fmt, off) {
    const p = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      const v = dv.getUint16(off + i * 2);
      if (fmt === 0) { p[i * 4] = p[i * 4 + 1] = p[i * 4 + 2] = v & 255; p[i * 4 + 3] = v >> 8; }
      else if (fmt === 1) c565(v, p, i * 4);
      else c5a3(v, p, i * 4);
    }
    return p;
  }

  function decode(dv, w, h, fmt, off, pal) {
    const [bw, bh] = BLK[fmt];
    const px = new Uint8ClampedArray(w * h * 4);
    const u8 = new Uint8Array(dv.buffer, dv.byteOffset);
    let p = off;
    const put = (x, y, fn) => { if (x < w && y < h) fn((y * w + x) * 4); };
    for (let ty = 0; ty < h; ty += bh) for (let tx = 0; tx < w; tx += bw) {
      if (fmt === 14) {
        for (let sy = 0; sy < 8; sy += 4) for (let sx = 0; sx < 8; sx += 4) {
          const v0 = (u8[p] << 8) | u8[p + 1], v1 = (u8[p + 2] << 8) | u8[p + 3];
          const c = new Uint8ClampedArray(16);
          c565(v0, c, 0); c565(v1, c, 4);
          for (let k = 0; k < 3; k++) {
            if (v0 > v1) { c[8 + k] = (2 * c[k] + c[4 + k]) / 3; c[12 + k] = (c[k] + 2 * c[4 + k]) / 3; }
            else { c[8 + k] = (c[k] + c[4 + k]) / 2; c[12 + k] = 0; }
          }
          c[11] = 255; c[15] = v0 > v1 ? 255 : 0;
          for (let y = 0; y < 4; y++) {
            const row = u8[p + 4 + y];
            for (let x = 0; x < 4; x++) {
              const i = ((row >> (6 - 2 * x)) & 3) * 4;
              put(tx + sx + x, ty + sy + y, o => { px[o] = c[i]; px[o + 1] = c[i + 1]; px[o + 2] = c[i + 2]; px[o + 3] = c[i + 3]; });
            }
          }
          p += 8;
        }
        continue;
      }
      if (fmt === 6) {
        for (let k = 0; k < 16; k++) {
          const x = tx + (k & 3), y = ty + (k >> 2);
          put(x, y, o => { px[o + 3] = u8[p + 2 * k]; px[o] = u8[p + 2 * k + 1]; px[o + 1] = u8[p + 32 + 2 * k]; px[o + 2] = u8[p + 33 + 2 * k]; });
        }
        p += 64;
        continue;
      }
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        const X = tx + x, Y = ty + y;
        let o = (Y * w + X) * 4;
        const inside = X < w && Y < h;
        if (fmt === 0 || fmt === 8) {
          const b = u8[p + (x >> 1)], v = (x & 1) ? b & 15 : b >> 4;
          if (inside) {
            if (fmt === 0) { px[o] = px[o + 1] = px[o + 2] = px[o + 3] = v * 17; }
            else { px[o] = pal[v * 4]; px[o + 1] = pal[v * 4 + 1]; px[o + 2] = pal[v * 4 + 2]; px[o + 3] = pal[v * 4 + 3]; }
          }
          if (x === bw - 1) p += 4;
        } else if (fmt === 1 || fmt === 9) {
          const v = u8[p++];
          if (inside) {
            if (fmt === 1) { px[o] = px[o + 1] = px[o + 2] = px[o + 3] = v; }
            else { px[o] = pal[v * 4]; px[o + 1] = pal[v * 4 + 1]; px[o + 2] = pal[v * 4 + 2]; px[o + 3] = pal[v * 4 + 3]; }
          }
        } else if (fmt === 2) {
          const v = u8[p++];
          if (inside) { px[o] = px[o + 1] = px[o + 2] = (v & 15) * 17; px[o + 3] = (v >> 4) * 17; }
        } else if (fmt === 3) {
          if (inside) { px[o] = px[o + 1] = px[o + 2] = u8[p + 1]; px[o + 3] = u8[p]; }
          p += 2;
        } else {
          const v = (u8[p] << 8) | u8[p + 1]; p += 2;
          if (inside) {
            if (fmt === 4) c565(v, px, o);
            else if (fmt === 5) c5a3(v, px, o);
            else { const i = (v & 0x3fff) * 4; px[o] = pal[i]; px[o + 1] = pal[i + 1]; px[o + 2] = pal[i + 2]; px[o + 3] = pal[i + 3]; }
          }
        }
      }
    }
    return px;
  }

  function toCanvas(px, w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').putImageData(new ImageData(px, w, h), 0, 0);
    return c;
  }

  // TPL bytes -> [{w, h, fmt, canvas, px}]
  DDR.parseTPL = function (buf, opts = {}) {
    const dv = new DataView(buf);
    if (dv.getUint32(0) !== 0x0020AF30) throw new Error('not a TPL');
    const n = dv.getUint32(4), t = dv.getUint32(8), out = [];
    for (let i = 0; i < n; i++) {
      const io = dv.getUint32(t + 8 * i), po = dv.getUint32(t + 8 * i + 4);
      const h = dv.getUint16(io), w = dv.getUint16(io + 2), fmt = dv.getUint32(io + 4), doff = dv.getUint32(io + 8);
      let pal = null;
      if (po) pal = palette(dv, dv.getUint16(po), dv.getUint32(po + 4), dv.getUint32(po + 8));
      if (!BLK[fmt] || w < 1 || h < 1) { out.push(null); continue; }
      const px = decode(dv, w, h, fmt, doff, pal);
      out.push({ w, h, fmt, px, canvas: opts.noCanvas ? null : toCanvas(px, w, h) });
    }
    return out;
  };
  DDR.toCanvas = toCanvas;
})();
