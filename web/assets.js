// DDR II's own graphics and sounds, pulled from the game files through the local server.
// Everything is optional: if a piece can't be loaded, the game falls back to drawn shapes.
'use strict';

const A = { ready: false, tpl: {}, img: {}, sfx: {} };

(function () {
  const tplCache = new Map();
  async function tpl(f, p = '') {
    const key = f + ':' + p;
    if (!tplCache.has(key)) {
      tplCache.set(key, (async () => {
        const r = await fetch(`/api/res?f=${f}&p=${encodeURIComponent(p)}`);
        if (!r.ok) throw new Error('missing ' + key);
        return DDR.parseTPL(await r.arrayBuffer());
      })());
    }
    return tplCache.get(key);
  }
  A.tplOf = tpl;
  async function img(f, p, i) {
    try { const t = await tpl(f, p); return t[i] ? t[i].canvas : null; } catch (e) { return null; }
  }
  async function imgs(f, p, idxs) {
    try { const t = await tpl(f, p); return idxs.map(i => t[i] ? t[i].canvas : null); } catch (e) { return idxs.map(() => null); }
  }
  function crop(c, x, y, w, h) {
    if (!c) return null;
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    o.getContext('2d').drawImage(c, x, y, w, h, 0, 0, w, h);
    return o;
  }
  A.crop = crop;
  // cut away the empty (transparent) border around a picture, e.g. a label's lettering
  function trim(c) {
    if (!c) return c;
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let k = 0; k < c.width; k++) {
      if (d[(y * c.width + k) * 4 + 3] > 24) { if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return x1 < 0 ? c : crop(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }
  A.trim = trim;

  // ------------------------------------------------------------- arrows
  // SSQ_CMN: 7 frames of grey arrows (C8, 512x320 = 8x5 cells of 64), a white mask/flash sheet,
  // freeze arrow heads + bodies. The game colours the grey arrows when drawing them.
  async function arrows() {
    let t;
    try { t = await tpl('ssq', '/0/0'); } catch (e) { return; }
    const mask = t[7] && t[7].canvas;
    if (!mask) return;
    const frames = [];
    for (let f = 0; f < 7; f++) {
      if (!t[f]) continue;
      const dirs = [];
      for (let d = 0; d < 4; d++) {
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const x = c.getContext('2d');
        x.drawImage(t[f].canvas, d * 64, 0, 64, 64, 0, 0, 64, 64);     // grey shading
        x.globalCompositeOperation = 'destination-in';
        x.drawImage(mask, d * 64, 0, 64, 64, 0, 0, 64, 64);            // shape from the mask
        dirs.push(c);
      }
      frames.push(dirs);
    }
    A.arrowGrey = frames;
    A.arrowMask = [0, 1, 2, 3].map(d => crop(mask, d * 64, 0, 64, 64));
    A.burst = [0, 1, 2, 3].map(d => crop(mask, d * 64, 64, 64, 64));
    const fz = (sheet, col) => sheet ? { head: crop(sheet.canvas, col * 64, 0, 64, 64), body: crop(sheet.canvas, col * 64, 64, 64, sheet.h - 64) } : null;
    if (t[8]) {
      A.freezeOn = [0, 1, 2, 3].map(d => fz(t[8], d));
      A.freezeOff = [0, 1, 2, 3].map(d => fz(t[8], 4 + d));
      // the body's coloured fill, recoloured the way the real game shows it (measured from the
      // game): khaki yellow, green just under the head, bright yellow while it's held
      const fill = (src, rgb) => {
        const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
        const x = c.getContext('2d'); x.drawImage(src, 0, 0);
        const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 8 || Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 40) continue;   // grey chevrons / outline stay
          const k = 1;                                                          // one flat colour (no bands)
          d[i] = Math.min(255, rgb[0] * k); d[i + 1] = Math.min(255, rgb[1] * k); d[i + 2] = Math.min(255, rgb[2] * k);
        }
        x.putImageData(im, 0, 0);
        return c;
      };
      for (const f of A.freezeOn) {
        f.bodyY = fill(f.body, [193, 195, 84]); f.bodyG = fill(f.body, [118, 197, 78]); f.bodyH = fill(f.body, [236, 240, 72]);
        f.headH = fill(f.head, [246, 246, 60]);        // the head turns yellow while it's held
      }
    }
    A.tintCache = new Map();
  }
  // tinted arrow: grey arrow x colour, keeping the white highlights
  A.arrow = function (color, frame, dir) {
    if (!A.arrowGrey) return null;
    const key = color + '|' + frame + '|' + dir;
    let c = A.tintCache.get(key);
    if (!c) {
      const src = A.arrowGrey[frame % A.arrowGrey.length][dir];
      c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, 64, 64);
      x.globalCompositeOperation = 'screen'; x.globalAlpha = 0.25; x.drawImage(src, 0, 0); x.globalAlpha = 1;
      x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0);
      A.tintCache.set(key, c);
    }
    return c;
  };

  // ---- The game's own arrow palettes (worked out from Dolphin texture dumps of the real game).
  // The arrow sheets in SSQ_CMN are C8 (palette) textures. Each pixel's low 4 bits pick a palette
  // entry: 0 = clear, 1 = outline, 2-4 = the inner bar / chevron, 5-13 = the body, dark to light.
  // The game fills those entries per note colour while playing; here is what it puts there.
  A.NOTE_RAMPS = [      // body ramps (entries 5..13) for the four note colours, at the start of a song
    [0xce8429, 0xde9429, 0xe7b539, 0xf7de4a, 0xf7f75a, 0xffff73, 0xffff8c, 0xefffad, 0xefffce],
    [0x9c315a, 0xbd3952, 0xd64a52, 0xf75a4a, 0xff7b42, 0xff8c39, 0xffb542, 0xffd642, 0xfff742],
    [0x4242b5, 0x5a39bd, 0x6b39c6, 0x8c31c6, 0xad39bd, 0xc639b5, 0xef42b5, 0xff4aa5, 0xff5a8c],
    [0x299cb5, 0x299cd6, 0x319cef, 0x3194ff, 0x428cff, 0x4a84ff, 0x637bff, 0x736bff, 0x9c63ff],
  ];
  // the step zone: light outline, a see-through middle, a dark-grey band (and the lit version)
  const greyRamp = (a, step) => [...Array(9)].map((_, i) => { const v = a + step * i; return (v << 16) | (v << 8) | v; });
  A.ZONE = { dim: { outline: 0xe7e7e7, inner: [0x11, 0x11, 0x11, 36], body: greyRamp(0x4a, 8) },
             lit: { outline: 0xe7e7e7, inner: [0x11, 0x11, 0x11, 36], body: greyRamp(0xad, 8) } };
  A.c8 = null;          // [frame] -> Uint8Array(512*320) of palette indices
  async function loadC8() {
    try {
      const r = await fetch('/api/res?f=ssq&p=' + encodeURIComponent('/0/0'));
      if (!r.ok) return;
      const dv = new DataView(await r.arrayBuffer());
      const n = dv.getUint32(4), t = dv.getUint32(8), out = [];
      for (let i = 0; i < Math.min(7, n); i++) {
        const io = dv.getUint32(t + 8 * i), h = dv.getUint16(io), w = dv.getUint16(io + 2), f = dv.getUint32(io + 4), d = dv.getUint32(io + 8);
        if (f !== 9) return;            // not C8: keep the old way
        const px = new Uint8Array(w * h);
        let o = d;
        for (let by = 0; by < h; by += 4) for (let bx = 0; bx < w; bx += 8)
          for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++, o++) px[(by + y) * w + bx + x] = dv.getUint8(o);
        out.push({ w, h, px });
      }
      A.c8 = out;
    } catch (e) { A.c8 = null; }
  }
  A.loadC8 = loadC8;
  // one 64x64 arrow from sheet `frame`, direction `dir`, cell row `row` (0 = notes, 2 = step zone),
  // coloured with pal = { outline, inner: [r,g,b,a] or 0xRRGGBB, body: [9 colours] }
  function c8Arrow(frame, dir, row, pal) {
    const sh = A.c8[frame % A.c8.length], c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), im = x.createImageData(64, 64), d = im.data;
    const rgb = v => [v >> 16 & 255, v >> 8 & 255, v & 255, 255];
    const lut = [[0, 0, 0, 0], rgb(pal.outline)];
    const inner = Array.isArray(pal.inner) ? pal.inner : rgb(pal.inner);
    lut.push(inner, inner, inner);
    for (let i = 0; i < 9; i++) lut.push(rgb(pal.body[i]));
    lut.push([0, 0, 0, 0], [0, 0, 0, 0]);
    for (let y = 0; y < 64; y++) for (let k = 0; k < 64; k++) {
      const e = lut[sh.px[(row * 64 + y) * sh.w + dir * 64 + k] & 15], o = (y * 64 + k) * 4;
      d[o] = e[0]; d[o + 1] = e[1]; d[o + 2] = e[2]; d[o + 3] = e[3];
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  // a note in colour group g (0-3), its hues turned by `shift` degrees (the rainbow drift)
  const rotHue = (v, deg) => {
    if (!deg) return v;
    let r = (v >> 16 & 255) / 255, g = (v >> 8 & 255) / 255, b = (v & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dd = mx - mn;
    let h = 0, s = 0;
    if (dd) { s = dd / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h *= 60; }
    const [R, G, B] = hslRgb(h + deg, s, l);
    return (Math.round(R) << 16) | (Math.round(G) << 8) | Math.round(B);
  };
  // flash: the inner bar is white for a moment at the start of each beat, dark grey the rest of it
  A.noteC8 = function (group, shift, frame, dir, flash) {
    if (!A.c8) return null;
    shift = (Math.round(shift / 15) * 15) % 360;   // 24 steps round the wheel keeps the cache small
    const key = 'n' + group + '|' + shift + '|' + frame + '|' + dir + (flash ? 'f' : '');
    let c = A.tintCache.get(key);
    if (!c) {
      c = c8Arrow(frame, dir, 0, { outline: 0x080808, inner: flash ? 0xffffff : 0x525252, body: A.NOTE_RAMPS[group].map(v => rotHue(v, shift)) });
      A.tintCache.set(key, c);
      if (A.tintCache.size > 3200) A.tintCache.delete(A.tintCache.keys().next().value);
    }
    return c;
  };
  A.zoneC8 = function (dir, lit) {
    if (!A.c8) return null;
    const key = 'z' + dir + (lit ? 'L' : 'D');
    let c = A.tintCache.get(key);
    if (!c) { c = c8Arrow(0, dir, 2, lit ? A.ZONE.lit : A.ZONE.dim); A.tintCache.set(key, c); }
    return c;
  };

  // The grey arrows are a shading map: the game colours them through a palette. This does the same
  // per pixel: the light rim and inner chevron stay near-white, the body takes the colour, running
  // from `top` to `bottom` down the arrow (that's how the rainbow arrows look on the Wii).
  const hex = c => { const m = /^#?(..)(..)(..)$/.exec(c); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : [255, 255, 255]; };
  const hslRgb = (h, s, l) => {
    h = ((h % 360) + 360) % 360 / 360;
    const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
  };
  A.hsl = hslRgb; A.hex = hex;
  function remap(src, fn) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'); x.drawImage(src, 0, 0);
    const im = x.getImageData(0, 0, 64, 64), d = im.data, a0 = new Uint8Array(64 * 64);
    const l0 = new Uint8Array(64 * 64);
    for (let k = 0; k < a0.length; k++) { a0[k] = d[k * 4 + 3]; l0[k] = d[k * 4]; }
    const solid = (px, py) => px >= 0 && py >= 0 && px < 64 && py < 64 && a0[py * 64 + px] > 24;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const k = i >> 2, px = k & 63, py = k >> 6;
      let edge = 0;                         // 1..4 px from the outside (the arrow's outline), else 0
      for (let r = 1; r <= 4 && !edge; r++) if (!solid(px - r, py) || !solid(px + r, py) || !solid(px, py - r) || !solid(px, py + r)) edge = r;
      // the darkest neighbour (to find the outline of the inner shape)
      let nb = 255;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (solid(px + dx, py + dy)) nb = Math.min(nb, l0[(py + dy) * 64 + px + dx]);
      const out = fn(d[i] / 255, py, edge, nb / 255);
      d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; d[i + 3] = Math.round(d[i + 3] * out[3]);
    }
    x.putImageData(im, 0, 0);
    return c;
  }
  // top / bottom: [r, g, b]
  A.arrowCol = function (top, bottom, frame, dir) {
    if (!A.arrowGrey) return null;
    const key = 'c' + top.map(Math.round) + '|' + bottom.map(Math.round) + '|' + frame + '|' + dir;
    let c = A.tintCache.get(key);
    if (!c) {
      c = remap(A.arrowGrey[frame % A.arrowGrey.length][dir], (L, y, edge) => {
        const k = Math.min(1, Math.max(0, (y - 6) / 52)), col = top.map((v, i) => v + (bottom[i] - v) * k);
        if (edge && edge <= 2 && L >= 0.8) return col.map(v => v * 0.28).concat(1);             // thin dark outline
        if (L >= 0.84) return [255, 255, 255, 1];                                  // shaft: white
        if (L >= 0.68) return col.map(v => v + (255 - v) * 0.78).concat(1);       // chevron / shaft: nearly white
        const b = 0.62 + 0.55 * (L - 0.29) / 0.39;                                 // body: the colour, lighter higher up the grey
        return col.map(v => Math.min(255, v * b)).concat(1);
      });
      A.tintCache.set(key, c);
      if (A.tintCache.size > 1500) A.tintCache.delete(A.tintCache.keys().next().value);
    }
    return c;
  };
  // the step zone: see-through arrows with a light rim, like the game's
  A.receptor = function (dir) {
    if (!A.arrowGrey) return null;
    const key = 'r|' + dir;
    let c = A.tintCache.get(key);
    if (!c) {
      // like the game's: a thin white outline, a dark-grey band, a see-through middle, and the inner
      // bar drawn as a grey outline only
      c = remap(A.arrowGrey[0][dir], (L, y, edge, nb) => {
        const lift = 1.15 - 0.3 * y / 64;
        if (L >= 0.84 && edge) return [232, 235, 240, 1];                        // outline
        if (L < 0.6) { const v = 70 + 70 * L; return [v * lift, (v + 4) * lift, (v + 14) * lift, 1]; }   // the band
        if (L >= 0.84 && nb < 0.84) return [96 * lift, 100 * lift, 110 * lift, 1];   // inner bar outline
        if (L < 0.84 && nb < 0.6) return [96 * lift, 100 * lift, 110 * lift, 1];    // inner edge of the band
        return [10, 20, 60, 0.06];                                                   // see-through
      });
      A.tintCache.set(key, c);
    }
    return c;
  };

  // ------------------------------------------------------------- HUD + judgments
  async function hud() {
    const gui = await imgs('gui', '', [28, 54, 12, 13, 14, 29, 15, 0, 22]);
    const atlas = gui[0];
    if (atlas) {
      A.judge = {
        MARVELOUS: crop(atlas, 22, 282, 366, 53), PERFECT: crop(atlas, 96, 57, 319, 53),
        GREAT: crop(atlas, 26, 113, 229, 54), GOOD: crop(atlas, 308, 113, 180, 54),
        BOO: crop(atlas, 52, 170, 117, 53), ALMOST: crop(atlas, 243, 170, 218, 53),
        COMBO: crop(atlas, 20, 225, 195, 54), OK: crop(atlas, 228, 225, 116, 54), NG: crop(atlas, 356, 225, 118, 54),
      };
      A.comboDigits = [...Array(10).keys()].map(i => crop(atlas, i * 56, 0, 56, 53));
    }
    A.img.gaugeFrame = gui[1];
    A.img.diffSmall = { 4: gui[2], 1: gui[3], 2: gui[4] };
    A.img.failed = gui[5];
    A.img.danger = gui[8];
    const bn = ['ready', 'hereWeGo', 'fullComboG', 'fullComboY', 'fullComboB', 'finishG', 'finishY', 'finishB', 'tryAgain', null, 'finished', 'fullComboP'];
    await Promise.all(bn.map(async (k, i) => { if (k) A.img[k] = await img('cmn', '/0/0/' + (i + 1), 0); }));
    A.img.comboBreak = await img('cmn', '/1/0/0', 0);
    A.img.feet = [await img('cmn', '/9', 1), await img('cmn', '/9', 2)];      // blue / red footprints (where to stand)
    A.digits = await imgs('af', '/0/0/0', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bgs = await imgs('bg', '', [0, 1]);
    A.img.playBg = bgs[0];
    A.img.stageBg = await img('pvbg', '', 0);       // the blue backdrop behind the arrows
  }

  // ------------------------------------------------------------- menus
  async function menus() {
    const res = await imgs('res', '/0/0/0/1', [0, 1]);
    A.img.resPanel = res[0];
    A.img.resTitle = await img('res', '/0/0/0/3', 0);
    A.img.jacketFrame = await img('res', '/0/0/0/0', 0);
    A.img.grades = {};
    const g1 = await imgs('res', '/0/3/0/0', [0, 1, 2, 3, 4]), g2 = await imgs('res', '/0/3/0/1', [0, 1]);
    Object.assign(A.img.grades, { A: g1[0], B: g1[1], C: g1[2], D: g1[3], E: g1[4], AAA: g2[0], AA: g2[1] });
    A.img.resFull = await imgs('res', '/0/4/0/0', [0, 1, 2, 3]);
    A.img.newRecord = await img('res', '/0/4/0/1', 0);
    A.img.diffLabel = await imgs('res', '/0/2/0/1', [0, 1, 2, 3, 4]);
    A.img.purple = await img('res', '/2', 0);
    A.img.lights = await img('sel', '/15/0/7', 0);
    A.img.rings = await img('sel', '/15/0/3', 0);
    A.img.ornament = await img('sel', '/15/0/1', 0);
    A.img.konami = await img('sel', '/12/0', 0);
    A.img.levelDigits = await imgs('mus', '/0/0/0/0', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);   // 1..10
    A.img.bpmLabel = await img('mus', '/0/0/0/1', 0);
    A.img.lenLabel = await img('mus', '/0/0/0/12', 0);
    A.img.selTitle = await img('mus', '/0/0/0/2', 0);
    A.img.diffBars = {};
    for (const [d, p] of [[4, 11], [1, 12], [2, 13], [3, 14], [6, 15]]) A.img.diffBars[d] = await imgs('mus', `/0/1/0/${p}`, [0, 1]);
    A.img.radarPanel = await imgs('mus', '/0/1/0/21', [0, 1, 2]);
    A.img.shortTag = await img('mus', '/0/1/0/23', 0);
    A.img.fullTag = await img('mus', '/0/1/0/24', 0);
    A.img.pointer = await img('mus', '/0/1/0/25', 0);
    A.img.bluePanel = await img('mus', '/0/12/0/0', 0);
    // the SELECT SONG LENGTH / SELECT DIFFICULTY pop-ups (selMusic groups 9-13)
    A.pop = {
      panel: await img('mus', '/0/12/0/0', 0), radar: await img('mus', '/0/13/0/7', 0),
      lenHead: await img('mus', '/0/12/0/1', 0), diffHead: await imgs('mus', '/0/13/0/1', [0, 1, 2]),
      cards: await imgs('mus', '/0/11/0/0', [0, 1]), cardOn: await img('mus', '/0/11/0/1', 0),
      shortTxt: await img('mus', '/0/11/0/2', 0), fullTxt: await img('mus', '/0/11/0/3', 0), box: await img('mus', '/0/11/0/4', 0),
      diff: await imgs('mus', '/0/10/0/10', [0, 1, 2, 3, 4]), ok: await img('mus', '/0/10/0/11', 0),
      badge: await imgs('mus', '/0/10/0/0', [0]).then(async b => [b[0], (await imgs('mus', '/0/10/0/1', [0]))[0]]),
      confirm: await img('mus', '/0/9/0/0', 0), star: await img('mus', '/0/3/0/0', 0),
      curBack: await img('mus', '/0/3/0/3', 0), curFrame: await img('mus', '/0/3/0/1', 0), rainbow: await img('mus', '/0/13/0/12', 0),
    };
    A.img.radarNames = {};
    for (const [k, p] of [['AIR', 2], ['CHAOS', 3], ['FREEZE', 4], ['STREAM', 5], ['VOLTAGE', 6]]) A.img.radarNames[k] = await img('mus', `/0/13/0/${p}`, 0);
    A.img.optHeader = await img('af', '/6/0', 3);
    // the options screen (select_bin group 10): bars, buttons, CONFIRM, arrows and the option/row labels
    const sel = (p, i) => img('sel', p, i);
    A.opt = {
      header: await sel('/10/0/0/0', 0), title: trim(await sel('/10/0/0/1', 0)), tab: await sel('/10/0/0/2', 0),
      btn: await sel('/10/4/0/1', 0), btnOn: await sel('/10/4/0/2', 0),
      rowBar: await sel('/10/5/0/0', 0), valBar: await sel('/10/5/0/1', 0),
      confirm: trim(await sel('/10/6/0/0', 0)), cyanBar: await sel('/10/6/0/1', 0), orangeBar: await sel('/10/6/0/2', 0),
      arrow: await sel('/10/7/0/1', 0),
      // ARROW ASSIST CONFIRM CREDIT CUT EVALUATION FREEZE-ARROW GAME-PLAY GRAPHIC GUIDELINE INDIVIDUAL-OPTIONS
      // JUMP ROTATE SAVE SCROLL SPEED USER-SUPPORT DANCE
      big: (await imgs('sel', '/10/8', [...Array(18).keys()])).map(trim),
      // AUTO-SAVE COMBO-PERFORMANCE CONFIRM CUT FULL-COMBO-APPEAL GAME-LEVEL GAME-OVER GOAL HANDCLAP JUMP MARVELOUS
      // MENU METRONOME MOVIES MUSIC-SPEED PARTY PLAYER1-4 SAVE SONG TIMING TIMING-EVALUATION VOICE COMBO ...
      small: (await imgs('sel', '/10/9', [...Array(30).keys()])).map(trim),
    };
    // song select (light blue screen) pieces
    A.img.bgShapes = await imgs('scm', '/0/1', [4, 5, 7, 8]);        // filled circle, ring, thick ring, striped circle
    A.img.headerBar = await img('mus', '/0/7/0/1', 0);
    A.img.magenta = await img('mus', '/0/5/0/0', 0);
    A.img.jacketHi = await img('mus', '/0/3/0/1', 0);
    A.img.diffPanel = await img('mus', '/0/1/0/22', 0);
    A.img.gradeSmall = await imgs('mus', '/0/1/0/18', [0, 1, 2, 3, 4, 5, 6]);   // AAA AA A B C D E
    A.img.crowns = await imgs('mus', '/0/1/0/19', [0, 1, 2, 3]);
    // gameplay meter (top panel above the arrows)
    A.img.meterPanel = await img('mfm', '/0/4', 0);
    A.img.meterGauge = await img('mfm', '/0/5', 0);
    A.img.meterBadge = await img('mfm', '/0/10', 0);
    A.img.meterBadge2 = await img('mfm', '/0/10', 1);
    A.img.meterStyle = await img('mfm', '/0/1', 0);
    A.img.meterNormal = await img('mfm', '/0/0', 0);
    A.img.meterDouble = await img('mfm', '/0/0', 6);
    A.img.meterDiff = await imgs('mfm', '/0/6', [0, 1, 2, 3, 4]);
    A.img.meterDanger = await img('mfm', '/0/8', 0);
    // results screen pieces
    A.img.resPanel1P = await img('res', '/0/0/0/1', 2);
    A.img.resPanel2P = await img('res', '/0/0/0/1', 0);     // VERSUS: 1P boxes left, 2P right
    A.img.resJacketFrame = await img('res', '/0/0/0/0', 0);
    A.img.card = await img('sel', '/2/4/0/1', 0);
    const strips = await imgs('af', '/11', [13, 15, 17, 19, 21]);
    const cut = s => s ? [...Array(10).keys()].map(i => crop(s, i * 56, 0, 56, 56)) : null;
    A.numbers = { white: cut(strips[0]), blue: cut(strips[1]), green: cut(strips[2]), gold: cut(strips[3]), sky: cut(strips[4]) };
    if (strips[0]) {   // the game's red digits aren't in this file; tint the white ones
      const red = document.createElement('canvas'); red.width = strips[0].width; red.height = strips[0].height;
      const x = red.getContext('2d');
      x.drawImage(strips[0], 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = '#ff2828'; x.fillRect(0, 0, red.width, red.height);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(strips[0], 0, 0);
      A.numbers.red = cut(red);
    }
    A.img.logo = await img('ttl', '/3/0/1', 0);
    A.img.logoGlow = await img('ttl', '/3/0/3', 0);
    A.img.copyright = await img('ttl', '/3/0/2', 0);
  }

  // ------------------------------------------------------------- sounds
  const sfxCache = new Map();
  A.playSfx = async function (name, gain = 1) {
    try {
      let notes = sfxCache.get(name);
      if (!notes || name.startsWith('VO_')) {   // announcer lines pick a random take each time
        const r = await fetch('/api/sfx?n=' + name);
        if (!r.ok) return;
        const buf = await r.arrayBuffer(), dv = new DataView(buf);
        const n = dv.getUint32(0);
        let p = 4;
        notes = [];
        for (let i = 0; i < n; i++) {
          const t = dv.getFloat32(p), ratio = dv.getFloat32(p + 4), vol = dv.getFloat32(p + 8), len = dv.getUint32(p + 12);
          const w = DDR.decodeRWAV(buf.slice(p + 16, p + 16 + len));
          notes.push({ t, ratio, vol, buf: toBuffer(w) });
          p += 16 + len;
        }
        sfxCache.set(name, notes);
      }
      const ctx = audio(), now = ctx.currentTime + 0.01;
      for (const nt of notes) {
        const src = ctx.createBufferSource(), gn = ctx.createGain();
        src.buffer = nt.buf; src.playbackRate.value = nt.ratio;
        gn.gain.value = Math.min(1.5, nt.vol * 1.6 * gain * (S.sfxVolume ?? 1));
        src.connect(gn).connect(ctx.destination);
        src.start(now + nt.t);
      }
    } catch (e) { /* no sound */ }
  };

  // judgment-coloured hit flash
  A.burstTint = function (color, dir) {
    if (!A.burst) return null;
    const key = 'b' + color + dir;
    let c = A.tintCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = color; x.fillRect(0, 0, 64, 64);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(A.burst[dir], 0, 0);
      x.globalCompositeOperation = 'lighter'; x.globalAlpha = 0.5; x.drawImage(A.burst[dir], 0, 0);
      A.tintCache.set(key, c);
    }
    return c;
  };

  A.loadTitle = async function () {
    A.img.logo = await img('ttl', '/3/0/1', 0);
    A.img.logoGlow = await img('ttl', '/3/0/3', 0);
    A.img.copyright = await img('ttl', '/3/0/2', 0);
  };

  A.load = async function () {
    await Promise.all([arrows(), loadC8(), hud(), menus()].map(p => p.catch(e => console.warn(e))));
    A.ready = true;
  };
})();
