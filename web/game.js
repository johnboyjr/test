// DDR II PC - game. Screens: title, setup, select, options, controls, loading, play, results.
'use strict';

const W = 1280, H = 720;
const cv = document.getElementById('screen');
const g = cv.getContext('2d');
const input = new Input();
const AUTO = new URLSearchParams(location.search).has('auto');
const AUTO_HELD = {};

// ---------------------------------------------------------------- settings
const DEFAULTS = {
  style: 'single', diff: 1, speed: 2, appearance: 'visible', turn: 'off', freezes: true,
  offset: 0, gauge: 'normal', marvelous: true, unlocks: 'off', menuMusic: true, short: false, videoSize: 'wii', screen: 'wide', voice: true, menuSounds: true, movies: true, colors: 'rainbow', bindings: null, sort: 'game', dancer: true, dancerCustom: false, dancerModel: '', ngBreaksCombo: false, jump: true, cut: false, guideline: false, evaluation: true, gameLevel: 'medium', freezeGuide: true,
  lights: true, lightMap: null,     // PAC Drive outputs (1-64) per panel; null = P1 L D U R on 1-4, P2 on 5-8, P3 9-12, P4 13-16
};
let S = Object.assign({}, DEFAULTS);
let saveTimer = 0;
function saveSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api('/api/settings', { pc: S }), 300);
  if (DATA.current) writeSave();       // keep the player's own options with their data
}

// ---------------------------------------------------------------- records, DDR points, unlocks
// Play points come from the game's table (0x8027a4ac): one row per difficulty, D..AAA (E/failed = 0).
const PLAY_POINTS = [[1000, 1500, 2000, 2500, 3500, 10000], [1500, 2000, 3000, 4000, 6000, 15000],
                     [2000, 3000, 4000, 5000, 7000, 20000], [3000, 4000, 5000, 7000, 10000, 25000],
                     [4000, 5000, 7000, 10000, 15000, 30000]];
const GRADE_ORDER = ['D', 'C', 'B', 'A', 'AA', 'AAA'];
// The "ANY SONG" challenge task shown by the game (bonus points for a cleared song)
const TASKS = [
  ['Clear on BEGINNER or higher', 500, r => !r.failed],
  ['Clear with the Dance Gauge at 60% or higher', 250, r => !r.failed && r.life >= 600],
  ['Clear with a MAX COMBO of 50 or higher', 500, r => !r.failed && r.maxCombo >= 50],
  ['Clear with RANK C or higher', 250, r => !r.failed && GRADE_ORDER.indexOf(r.grade) >= 1],
];
// DDR points unlock schedule (from RemyWiki's DanceDanceRevolution II page; it matches the game:
// Diamond Night at 15,000, then the EMI outfit at 37,500). Songs are by the game's song number.
// Outfits, Mii parts and courses aren't in DDR II PC, but they still count as the "next" goal.
const UNLOCKS = [
  [15000, 'Diamond Night', [64]], [37500, 'Outfit "EMI"'], [60000, 'Summer Fairytale', [66]], [82500, 'Outfit "DISCO"'],
  [105000, 'Surrender (PureFocus remix)', [68]], [127500, 'Outfit "RUBY"'], [150000, 'Dance Partay', [72]],
  [172500, 'Outfit "YUNI"'], [195000, 'Tell Me What To Do', [74]], [217500, 'Outfit "RAGE"'],
  [240000, 'real-high-SPEED', [106]], [262500, 'Wings of an Angel (Fly With Me)', [84]], [285000, 'Mii Character'],
  [307500, 'Mii BODY A-6'], [330000, 'El ritmo te controla', [86]], [352000, 'Mii BODY B-6'],
  [375000, 'In The Air', [92]], [397500, 'Mii BODY D-3, E-3'], [420000, 'in love wit you', [104]],
  [442500, 'Mii BODY A-7'], [465000, 'Sky Is The Limit', [108]], [487500, 'Mii BODY B-7'], [510000, 'GOLD RUSH', [122]],
  [532500, 'Mii BODY C-10'], [555000, 'smooooch', [124]], [577500, 'Mii BODY D-4, E-4'],
  [600000, 'ZETA ~The World of Prime Numbers and the Transcendental Being~', [126]], [622500, 'Mii BODY A-8'],
  [645000, "I'm so Happy", [132]], [667500, 'Character "RENA"'], [690000, 'Theory of Eternity', [134]],
  [712500, 'Mii BODY B-8'], [735000, 'oarfish', [150]], [757500, 'Mii BODY C-11'], [780000, 'someday...', [200]],
  [802500, 'Mii BODY D-5, E-5'], [825000, 'aftershock!!', [156]], [847500, 'Outfit "RENA"'],
  [870000, 'dirty digital', [158]], [892500, 'Mii BODY A-9'], [915000, 'Dummy', [160]], [937500, 'Mii BODY B-9'],
  [960000, 'sakura storm', [162]], [982500, 'Mii BODY C-12'], [1005000, 'Your Angel', [164]], [1027500, 'Mii BODY A-10'],
  [1050000, 'All My Love', [166]], [1072500, 'Mii BODY B-10'], [1095000, 'Poseidon (kors k mix)', [168]],
  [1117500, 'Mii BODY C-13'], [1140000, 'CG Project', [170]], [1162500, 'Mii BODY C-14'],
  [1185000, 'KISS KISS KISS AKBK MIX', [174]], [1207500, 'Mii BODY C-15'], [1230000, 'Decade', [178]],
  [1252500, 'Mii BODY C-16'], [1297500, 'FIRE FIRE', [180]], [1320000, 'Mii BODY C-17'],
  [1365000, "Dazzlin' Darlin", [184]], [1387500, 'Mii BODY C-18'], [1410000, "Dazzlin' Darlin -AKBKmix-", [182]],
  [1432500, 'Mii BODY C-19'], [1455000, 'MEI', [186]], [1477500, 'Mii BODY C-20'], [1500000, 'Second Heaven', [188]],
  [1522500, 'Mii BODY C-21'], [1545000, 'VANESSA', [190]], [1567500, 'Mii BODY C-22'], [1590000, 'YELLOW CANDY', [192]],
  [1612500, 'Mii BODY C-23'], [1635000, 'She is my wife', [194]], [1657500, 'Mii BODY C-24'], [1680000, 'DROP', [196]],
  [1702500, 'Shiny World', [120]], [1725000, 'UNBELIEVABLE (Sparky remix)', [82]], [1747500, 'Sakura Sunrise', [112]],
  [1770000, 'Pierce The Sky', [114]], [1792500, 'DELTA MAX', [154]], [1815000, '888', [152]], [1837500, 'New Decade', [110]],
  [1860000, 'Anti-Matter', [172]], [1882500, 'POSSESSION', [118]], [1905000, 'London EVOLVED', [94, 96, 98]],
  [1927500, 'Valkyrie dimension', [116]], [1950000, 'HOTTEST PARTY', [144]], [1972500, 'HOTTEST PARTY 2', [146]],
  [1995000, 'HOTTEST PARTY 3', [148]], [2000000, 'DanceDanceRevolution', [136]],
];
// Replicant D-action: the game's boss folder, in the order the game adds its songs (game song numbers)
const RDA = [120, 112, 114, 152, 154, 110, 172, 118, [94, 96, 98], 116];
const RDA_COLORS = ['#ffd84a', '#ff7ab8', '#4ad8ff', '#c08bff', '#ff9a3c', '#7dff8a', '#ff4d5e', '#4f8bff', '#e8e8e8', '#d0103a'];
function rdaIndex(song) { const s = song && (song.full || song.slot); return RDA.findIndex(r => Array.isArray(r) ? r.includes(s) : r === s); }
// a medal = AA or better on any chart of that song (either version)
function hasMedal(song, prof = SAVE) {
  if (!prof || !prof.records) return false;
  const slots = new Set([song.slot, song.full, song.alt && song.alt.slot].filter(Boolean));
  return Object.entries(prof.records).some(([k, r]) => slots.has(+k.split(':')[0]) && (r.grade === 'AA' || r.grade === 'AAA'));
}
// favorite songs (the star), kept in each player's data
function favKey(song) { return String(song.full || song.slot); }
function isFav(song, prof = SAVE) { return !!(prof && prof.favorites && prof.favorites.includes(favKey(song))); }
function toggleFav(song) {
  const f = SAVE.favorites = SAVE.favorites || [], k = favKey(song), i = f.indexOf(k);
  if (i >= 0) f.splice(i, 1); else f.push(k);
  writeSave();
  return i < 0;
}
function drawStar(x, y, r, fill, alpha = 1) {
  g.save(); g.globalAlpha = alpha; g.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = Math.max(1.5, r * 0.14); g.strokeStyle = '#7a3a00'; g.stroke();
  g.restore();
}
function medals(prof = SAVE) {
  return RDA.map((r, i) => SONGS.some(s => rdaIndex(s) === i && hasMedal(s, prof)));
}
const UNLOCK_AT = {};
for (const [pts, , slots] of UNLOCKS) for (const sl of slots || []) UNLOCK_AT[sl] = pts;
// Player data, like the game's user data: each player has their own DDR points, records and
// play options (speed, style, turn...). Controls, audio offset and screen settings are shared.
const PROFILE_OPTS = ['style', 'diff', 'speed', 'appearance', 'turn', 'freezes', 'marvelous', 'colors', 'gauge', 'lastSlot', 'short', 'ngBreaksCombo', 'jump', 'cut', 'guideline', 'evaluation'];
let DATA = { profiles: {}, current: null };
let SAVE = { points: 0, records: {} };          // the current player's data
async function loadSave() {
  try {
    const s = await api('/api/save') || {};
    if (s.profiles) DATA = Object.assign({ profiles: {}, current: null }, s);
    else if (s.records || s.points) DATA = { profiles: { PLAYER: { points: s.points || 0, records: s.records || {}, opts: {} } }, current: 'PLAYER' };
  } catch (e) {}
  if (DATA.current && DATA.profiles[DATA.current]) usePlayer(DATA.current, false);
}
function usePlayer(name, apply = true) {
  const p = DATA.profiles[name];
  if (!p) return;
  p.points = p.points || 0; p.records = p.records || {}; p.opts = p.opts || {};
  DATA.current = name; SAVE = p;
  if (apply) for (const k of PROFILE_OPTS) if (k in p.opts) S[k] = p.opts[k];
}
let saveDataTimer = 0;
function writeSave() {
  if (DATA.current && DATA.profiles[DATA.current]) {
    const o = DATA.profiles[DATA.current].opts;
    for (const k of PROFILE_OPTS) if (S[k] !== undefined) o[k] = S[k];
  }
  clearTimeout(saveDataTimer);
  saveDataTimer = setTimeout(() => api('/api/save', DATA).catch(() => {}), 200);
}
function recKey(slot, style, diff) { return `${slot}:${style}:${diff}`; }
function recordOf(song, diff = S.diff, style = styleNow(), prof = SAVE) { return prof && prof.records ? prof.records[recKey(song.slot, style, diff)] || null : null; }
function isLocked(song, points = SAVE.points) {
  if (S.unlocks !== 'on') return false;
  const at = UNLOCK_AT[song.full || song.slot];
  return at !== undefined && points < at;
}
// the next goal after this many points: {at, label}
function nextUnlock(points = SAVE.points) {
  const u = UNLOCKS.find(([pts]) => pts > points);
  return u ? { at: u[0], label: u[1] } : null;
}
// what opened up between two point totals (songs that are on the disc, plus the other items by name)
function unlockedBetween(before, after) {
  return UNLOCKS.filter(([pts]) => pts > before && pts <= after)
    .map(([pts, label, slots]) => ({ label, songs: (slots || []).map(sl => SONGS.find(s => (s.full || s.slot) === sl)).filter(Boolean) }));
}

async function api(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) throw new Error(path + ': ' + r.status);
  return r.headers.get('Content-Type').includes('json') ? r.json() : r.arrayBuffer();
}
async function bin(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + ': ' + r.status);
  return r.arrayBuffer();
}

// ---------------------------------------------------------------- canvas scaling
// 'wide' shows the 16:9 picture (with bars on a 4:3 monitor); '4:3' squeezes it to fill a 4:3 shape
// the way a Wii set to 16:9 looks on a 4:3 TV
function fit() {
  const aspect = S.screen === '4:3' ? 4 / 3 : W / H;
  const h = Math.min(innerHeight, innerWidth / aspect), w = h * aspect;
  cv.style.width = Math.floor(w) + 'px';
  cv.style.height = Math.floor(h) + 'px';
  cv.style.marginTop = Math.floor((innerHeight - h) / 2) + 'px';
}
addEventListener('resize', fit); fit();
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
}
addEventListener('keydown', e => { if (e.code === 'F11' || e.code === 'KeyF' && e.altKey) { e.preventDefault(); toggleFullscreen(); } });

// ---------------------------------------------------------------- audio
let actx = null;
function audio() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
function toBuffer(dec) {
  const ctx = audio();
  const b = ctx.createBuffer(dec.chans.length, dec.chans[0].length, dec.rate);
  dec.chans.forEach((c, i) => b.copyToChannel(c, i));
  return b;
}
function outLatency() { return actx ? (actx.outputLatency || actx.baseLatency || 0) : 0; }
// map a performance.now() timestamp to the audio context clock
function ctxTimeAt(perf) {
  if (actx.getOutputTimestamp) {
    const ts = actx.getOutputTimestamp();
    if (ts.performanceTime) return ts.contextTime + (perf - ts.performanceTime) / 1000 + outLatency();
  }
  return actx.currentTime + (perf - performance.now()) / 1000;
}

// ---------------------------------------------------------------- images
const imgCache = new Map();
const ART_BG = {};               // custom song picture URL -> its background picture (for banners)
function texture(kind, idx) {          // kind: jacket | title; idx can also be a picture's URL (custom songs)
  const key = kind + idx;
  if (imgCache.has(key)) return imgCache.get(key);
  const entry = { img: null };
  imgCache.set(key, entry);
  if (idx === null || idx === undefined) { entry.missing = true; return entry; }
  if (typeof idx === 'string' && idx.startsWith('/')) {
    const im = new Image();
    im.onload = () => {        // squared off like the game's jackets
      const c = document.createElement('canvas'), x = c.getContext('2d'), s = Math.min(im.width, im.height);
      c.width = c.height = 256;
      if (im.width / im.height > 1.6) {
        // a banner (no jacket): it goes across the middle of the song's background picture
        const banner = () => { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 128 - 128 * im.height / im.width - 6, 256, 256 * im.height / im.width + 12);
          x.drawImage(im, 0, 128 - 128 * im.height / im.width, 256, 256 * im.height / im.width); entry.img = c; };
        x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
        const bgUrl = ART_BG[idx];
        if (bgUrl) {
          const bg = new Image();
          bg.onload = () => { const b = Math.min(bg.width, bg.height); x.drawImage(bg, (bg.width - b) / 2, (bg.height - b) / 2, b, b, 0, 0, 256, 256); banner(); };
          bg.onerror = banner; bg.src = bgUrl;
          return;
        }
        banner();
        return;
      }
      x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, 256, 256);
      entry.img = c;
    };
    im.onerror = () => { entry.missing = true; };
    im.src = idx;
    return entry;
  }
  bin(`/api/${kind}/${idx}`).then(buf => {
    const t = DDR.decodeTexture(buf);
    const c = document.createElement('canvas');
    c.width = t.w; c.height = t.h;
    c.getContext('2d').putImageData(new ImageData(t.px, t.w, t.h), 0, 0);
    entry.img = c;
  }).catch(() => { entry.missing = true; });
  return entry;
}

// arrow sprites
// arrow colours by rhythm (quarter, eighth, sixteenth, ...), used to tint the game's grey arrows
const TINT = { 4: '#ff3838', 8: '#3c6cff', 16: '#ffd426', 12: '#c048ff', 24: '#ff5ac8', 32: '#2ee070', 0: '#30e0ff', flat: '#ff3838' };
const NOTE_COLORS = {
  4: ['#ff4040', '#ffd0d0'], 8: ['#3a7bff', '#cfe0ff'], 16: ['#ffd000', '#fff4b0'],
  12: ['#c040ff', '#efd0ff'], 24: ['#ff60c0', '#ffd0ee'], 32: ['#30d060', '#d0ffe0'], 0: ['#40e0ff', '#d0f8ff'],
};
const ROT = [Math.PI / 2, 0, Math.PI, -Math.PI / 2];   // left, down, up, right (sprite points down)
function arrowPath(c, s) {
  c.beginPath();
  c.moveTo(0, s * 0.46);
  c.lineTo(s * 0.46, 0);
  c.lineTo(s * 0.2, 0);
  c.lineTo(s * 0.2, -s * 0.44);
  c.lineTo(-s * 0.2, -s * 0.44);
  c.lineTo(-s * 0.2, 0);
  c.lineTo(-s * 0.46, 0);
  c.closePath();
}
const spriteCache = new Map();
function sprite(kind, size) {
  const key = kind + size;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  x.translate(size / 2, size / 2);
  if (kind === 'receptor' || kind === 'flash') {
    arrowPath(x, size * 0.92);
    x.lineWidth = size * 0.07;
    x.strokeStyle = kind === 'flash' ? '#ffffff' : '#9aa4b8';
    x.fillStyle = kind === 'flash' ? 'rgba(255,255,255,0.55)' : 'rgba(40,50,70,0.55)';
    x.fill(); x.stroke();
  } else {
    const [main, light] = NOTE_COLORS[kind] || NOTE_COLORS[0];
    const gr = x.createLinearGradient(0, -size / 2, 0, size / 2);
    gr.addColorStop(0, light); gr.addColorStop(0.55, main); gr.addColorStop(1, main);
    arrowPath(x, size * 0.92);
    x.fillStyle = gr; x.fill();
    x.lineWidth = size * 0.06; x.strokeStyle = '#ffffff'; x.stroke();
    x.lineWidth = size * 0.025; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.stroke();
  }
  spriteCache.set(key, c);
  return c;
}
function quant(off) {
  const r = ((off % 1024) + 1024) % 1024;
  if (r === 0) return 4;
  if (r % 512 === 0) return 8;
  if (r % 256 === 0) return 16;
  if (r % 128 === 0) return 32;
  if (Math.abs(r * 3 % 1024) < 2 || Math.abs(r * 3 % 1024 - 1024) < 2) return 12;
  if (Math.abs(r * 6 % 1024) < 3 || Math.abs(r * 6 % 1024 - 1024) < 3) return 24;
  return 0;
}

// ---------------------------------------------------------------- drawing helpers
function text(s, x, y, size = 24, color = '#fff', align = 'left', weight = 'bold') {
  g.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.lineWidth = Math.max(2, size / 8); g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(s, x, y); g.fillStyle = color; g.fillText(s, x, y);
}
function panel(x, y, w, h, a = 0.55) {
  if (A.img.bluePanel) { g.drawImage(A.img.bluePanel, x, y, w, h); return; }
  g.fillStyle = `rgba(10,20,45,${a})`;
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(120,170,255,0.6)'; g.lineWidth = 2; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
}
function background(t) {
  if (A.img.purple) {
    g.drawImage(A.img.purple, 0, 0, W, H);
    if (A.img.lights) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 1.3);
      g.drawImage(A.img.lights, 0, 0, W, H * 0.75);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    return;
  }
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#0b2a6b'); gr.addColorStop(1, '#03091c');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
// the song select / options look: light blue with white circles, rings and stripes (the game builds it the same way)
const BG_SHAPES = [
  [0, 120, 250, 330, 0.30], [1, 300, 120, 260, 0.45], [2, 1010, 80, 300, 0.40], [0, 1180, 330, 280, 0.25],
  [3, 820, 560, 300, 0.22], [1, 520, 600, 380, 0.30], [2, 120, 620, 220, 0.35], [0, 700, 200, 180, 0.22],
  [1, 1220, 640, 240, 0.40], [3, 380, 330, 200, 0.18],
];
// Behind the menus: big see-through blue silhouettes dancing (our own dancer, the disc's moves)
const MenuDancers = {
  state: 'idle', ch: null, tint: null,
  load() {
    if (this.state !== 'idle' || !window.Dancer3D || !SONGS.length) return;
    this.state = 'loading';
    const s = SONGS.find(x => !x.custom) || SONGS[0];
    api('/api/dance/' + danceNo(s)).then(d => { this.ch = d ? Dancer3D.prepare(d, 7) : null; this.state = this.ch ? 'ready' : 'none'; })
      .catch(() => { this.state = 'none'; });
  },
  draw(t, spots) {
    if (S.dancer === false) return;
    this.load();
    if (this.state !== 'ready') return;
    for (const [cx, bottom, h, a, lag, flip] of spots) {
      let cv;
      try { cv = Dancer3D.render(this.ch, 8 + (t * 2 + lag) % 120, 1e6, { builtIn: true }); } catch (e) { this.state = 'none'; return; }
      if (!cv) return;
      if (!this.tint) this.tint = document.createElement('canvas');
      const c = this.tint; c.width = cv.width; c.height = cv.height;
      const x = c.getContext('2d');
      x.drawImage(cv, 0, 0); x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#1b56b4'; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over';
      const w = h * cv.width / cv.height;
      g.save(); g.globalAlpha = a; g.translate(cx, bottom - h);
      if (flip) { g.scale(-1, 1); }
      g.drawImage(c, -w / 2, 0, w, h); g.restore();
    }
  },
};
function menuBackground(t) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#9eeafc'); gr.addColorStop(0.55, '#7fd8f6'); gr.addColorStop(1, '#5cc4ee');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // soft diagonal light bands in the lower half
  g.save();
  g.globalAlpha = 0.18; g.fillStyle = '#ffffff';
  for (let k = 0; k < 7; k++) {
    const x = ((k * 230 + t * 20) % (W + 400)) - 200;
    g.beginPath(); g.moveTo(x, H); g.lineTo(x + 60, H); g.lineTo(x + 360, 380); g.lineTo(x + 300, 380); g.fill();
  }
  g.restore();
  const shapes = A.img.bgShapes || [];
  BG_SHAPES.forEach(([k, x, y, size, a], i) => {
    const im = shapes[k];
    const dx = Math.sin(t * 0.3 + i) * 12, dy = Math.cos(t * 0.25 + i * 1.7) * 10;
    if (im) { g.globalAlpha = a; g.drawImage(im, x + dx - size / 2, y + dy - size / 2, size, size); g.globalAlpha = 1; }
    else {
      g.globalAlpha = a; g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = size * 0.12;
      g.beginPath(); g.arc(x + dx, y + dy, size * 0.4, 0, Math.PI * 2);
      if (k === 0) g.fill(); else g.stroke();
      g.globalAlpha = 1;
    }
  });
}

// draw an image centred at (x, y), scaled
function blit(img, x, y, scale = 1, alpha = 1) {
  if (!img) return false;
  g.globalAlpha = alpha;
  g.drawImage(img, x - img.width * scale / 2, y - img.height * scale / 2, img.width * scale, img.height * scale);
  g.globalAlpha = 1;
  return true;
}
// a number drawn with one of the game's digit sets (array of 10 images)
function digits(set, str, x, y, h, align = 'right', gap = -0.12) {
  if (!set || !set[0]) return false;
  const imgs = [...str].map(ch => set[+ch]);
  if (imgs.some(i => !i)) return false;
  const ws = imgs.map(i => i.width * h / i.height), total = ws.reduce((a, b) => a + b, 0) + gap * h * (imgs.length - 1);
  let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  imgs.forEach((im, k) => { g.drawImage(im, cx, y - h / 2, ws[k], h); cx += ws[k] + gap * h; });
  return true;
}
function sfx(name, gain) {
  if (!A.ready || (name.startsWith('VO_') && S.voice === false) || (name.startsWith('SE_') && S.menuSounds === false)) return;
  A.playSfx(name, gain);
}

// ---------------------------------------------------------------- scenes
let scene = null;
function go(s) {
  if (scene && scene.leave) scene.leave();
  scene = s;
  if (s.enter) s.enter();
  Bgm.want(s.bgm || null);
}
// menu music (the game's MU_BGM_FREE loop on menu screens; song select uses the previews like the game)
const Bgm = {
  cur: null, src: null, gain: null, cache: new Map(),
  async want(name) {
    if (S.menuMusic === false) name = null;
    if (name === this.cur) return;
    this.cur = name;
    if (this.src) { const s = this.src, gn = this.gain; try { gn.gain.setTargetAtTime(0, actx.currentTime, 0.15); s.stop(actx.currentTime + 0.8); } catch (e) {} this.src = null; }
    if (!name || !actx) return;
    try {
      let buf = this.cache.get(name);
      if (!buf) { buf = toBuffer(DDR.decodeBRSTM(await bin('/api/bgm/' + name))); this.cache.set(name, buf); }
      if (this.cur !== name || this.src) return;
      const src = actx.createBufferSource(), gn = actx.createGain();
      src.buffer = buf; src.loop = true;
      gn.gain.setValueAtTime(0, actx.currentTime); gn.gain.linearRampToValueAtTime(0.55, actx.currentTime + 0.6);
      src.connect(gn).connect(actx.destination); src.start();
      this.src = src; this.gain = gn;
    } catch (e) { /* no music */ }
  },
};

input.on((action, pressed, t, menuKey) => { if (scene && scene.input) scene.input(action, pressed, t, menuKey); });
addEventListener('keydown', e => { if (scene && scene.key) scene.key(e); });

let SONGS = [];
let CUSTOM_FOLDERS = [];
// the game's songs, then your custom songs (Custom Songs folder), each marked with its folder
async function loadSongs() {
  const game = await api('/api/songs');
  let extra = [];
  try {
    const c = await api('/api/custom/songs');
    CUSTOM_FOLDERS = c.folders || [];
    for (const cs of c.songs || []) if (cs.jacket && cs.artBg) ART_BG[cs.jacket] = cs.artBg;
    extra = (c.songs || []).sort((a, b) => CUSTOM_FOLDERS.indexOf(a.folder) - CUSTOM_FOLDERS.indexOf(b.folder) || a.name.localeCompare(b.name));
  } catch (e) { CUSTOM_FOLDERS = []; }
  return game.concat(extra);
}
// which section of the song list a song is in: the game's songs, Replicant D-action, or a custom folder
// the RANDOM entry at the start of the song list: Enter picks a song for you
const RANDOM_SONG = { random: true, slot: 'random', name: 'RANDOM', artist: '', bpm: ['???', '???'], length: 0,
  single: [0, 0, 0, 0, 0], double: [0, 0, 0, 0, 0], radar: [], jacket: null, title: null };
function sectionOf(song) { return !song ? '' : song.random ? 'random' : song.folderTile ? 'folders' : song.custom ? 'folder:' + song.folder : rdaIndex(song) >= 0 ? 'rda' : 'game'; }
function danceNo(song) { return song.custom ? parseInt(song.slot.slice(1, 7), 16) % 119 + 1 : song.slot; }
const DIFFS = [[4, 'BEGINNER', '#6cf'], [1, 'BASIC', '#fd4'], [2, 'DIFFICULT', '#f55'], [3, 'EXPERT', '#4e6'], [6, 'CHALLENGE', '#c6f']];
// Player 2 (VERSUS): joins on song select. null = one player. {name: their user data or null for a guest, diff}
let P2 = null;
function styleNow() { return S.style; }            // VERSUS follows the Style option: Single (2 mats) or Double (4 mats)
function levelsOf(song) { return styleNow() === 'double' ? song.double : song.single; }
function chartKey(diff) { return (diff << 8) | (styleNow() === 'double' ? 0x18 : 0x14); }
function p2Profile() { return P2 && P2.name ? DATA.profiles[P2.name] || null : null; }
// player 2 plays with their own saved options (a guest uses player 1's)
function p2Opts() {
  const prof = p2Profile(), o = Object.assign({}, S);
  if (prof && prof.opts) for (const k of PROFILE_OPTS) if (k in prof.opts) o[k] = prof.opts[k];
  if (P2 && P2.opts) Object.assign(o, P2.opts);           // changed for player 2 on the options screen
  return o;
}

// ---- title
const Title = {
  t0: 0, movie: null, loadingMsg: '',
  enter() {
    this.t0 = performance.now();
    if (!A.img.logo && A.loadTitle) A.loadTitle();
    if (!this.movie) {
      fetch('/api/menumovie').then(r => r.ok ? r.json() : null).then(m => { if (m && m.file) this.movie = new Movie(m.file, { loop: true }); }).catch(() => {});
    }
  },
  draw(t) {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const fr = this.movie && this.movie.frameAt((performance.now() - this.t0) / 1000);
    if (fr) {
      const s = Math.max(W / fr.width, H / fr.height);
      g.drawImage(fr, W / 2 - fr.width * s / 2, H / 2 - fr.height * s / 2, fr.width * s, fr.height * s);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, W, H);
    } else background(t);
    if (A.img.logo) {
      if (A.img.logoGlow) { g.globalCompositeOperation = 'lighter'; blit(A.img.logoGlow, W / 2, 190, 2.4, 0.6 + 0.3 * Math.sin(t * 2)); g.globalCompositeOperation = 'source-over'; }
      blit(A.img.logo, W / 2, 190, 1.5);
      if (A.img.copyright) blit(A.img.copyright, W / 2, 680, 1.1);
    } else {
      text('DANCE DANCE REVOLUTION II', W / 2, 120, 58, '#ffffff', 'center');
    }
    if (this.loadingMsg) text(this.loadingMsg, W / 2, 560, 26, '#cfe3ff', 'center');
    else if ((t * 2 | 0) % 2 === 0) text('PRESS START (Enter) or click', W / 2, 560, 30, '#ffffff', 'center');
    text('F11: full screen', W - 20, 700, 14, '#ccd', 'right', 'normal');
  },
  async begin() {
    if (this.busy) return;
    this.busy = true;
    audio();
    try {
      const st = await api('/api/status');
      const set = await api('/api/settings');
      if (set.pc) S = Object.assign({}, DEFAULTS, set.pc);
      if (S.colorsV !== 2) { S.colors = 'rainbow'; S.colorsV = 2; }   // Rainbow is the game's default
      input.setBindings(S.bindings);
      if (S.dancerCustom && S.dancerModel && window.Dancer3D) Dancer3D.useModel('/api/dancermodel');
      let su = null;
      try { su = await api('/api/setup'); } catch (e) {}
      if (!st.ok || (su && !su.ffmpegOk && !su.ffmpegSkip)) { this.busy = false; return go(Setup.with(st.ok ? '' : st.error)); }
      SONGS = await loadSongs();
      await loadSave();
      if (!A.ready) { this.loadingMsg = 'Loading the game\'s graphics...'; await A.load(); this.loadingMsg = ''; }
      sfx('SE_SYS_DECIDE01');
      go(Players);
    } catch (e) { go(Setup.with(String(e))); }
    this.busy = false;
  },
  leave() { if (this.movie) { this.movie.close(); this.movie = null; } },
  input(a, p) { if (p && a === 'START') this.begin(); },
  click() { this.begin(); },
};

// ---- players (user data)
const Players = {
  bgm: 'MU_BGM_FREE',
  i: 0, typing: null, confirmDel: null, msg: '',
  names() { return Object.keys(DATA.profiles); },
  enter() {
    const n = this.names();
    this.i = Math.max(0, n.indexOf(DATA.current));
    this.typing = n.length ? null : ''; this.confirmDel = null; this.msg = '';
  },
  choose(name) {
    usePlayer(name); fit(); writeSave(); saveSettings();
    sfx('SE_SYS_DECIDE01');
    go(Style);
  },
  input(a, p) {
    if (!p || this.typing !== null) return;
    const n = this.names(), count = n.length + 1;
    if (this.confirmDel) {
      if (a === 'START') {
        delete DATA.profiles[this.confirmDel];
        if (DATA.current === this.confirmDel) { DATA.current = null; SAVE = { points: 0, records: {} }; }
        api('/api/save', DATA).catch(() => {});
        this.msg = 'Deleted ' + this.confirmDel + '.'; this.i = 0;
      }
      this.confirmDel = null; return;
    }
    if (a === 'P1U' || a === 'P2U') { this.i = (this.i + count - 1) % count; sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1D' || a === 'P2D') { this.i = (this.i + 1) % count; sfx('SE_SYS_SELECT01'); }
    else if (a === 'START') { if (this.i < n.length) this.choose(n[this.i]); else { this.typing = ''; sfx('SE_SYS_DECIDE02'); } }
    else if (a === 'OPTIONS' && this.i < n.length) this.confirmDel = n[this.i];
    else if (a === 'BACK' && DATA.current) { go(Select); }
  },
  key(e) {
    if (this.typing === null) return;
    e.preventDefault();
    if (e.code === 'Escape') { this.typing = this.names().length ? null : ''; return; }
    if (e.code === 'Backspace') { this.typing = this.typing.slice(0, -1); return; }
    if (e.code === 'Enter') {
      const name = this.typing.trim();
      if (!name) return;
      if (DATA.profiles[name]) { this.msg = name + ' already exists.'; return; }
      DATA.profiles[name] = { points: 0, records: {}, opts: {} };
      this.typing = null;
      this.choose(name);
      return;
    }
    if (e.key.length === 1 && /[A-Za-z0-9 .!?\\-]/.test(e.key) && this.typing.length < 8) this.typing += e.key.toUpperCase();
  },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('USER DATA', 210, 44, 34, '#fff', 'center');
    const n = this.names();
    panel(320, 110, 640, 500);
    if (this.typing !== null) {
      text('NEW PLAYER', 640, 170, 30, '#ffd23c', 'center');
      text('Type a name (up to 8 letters), then press Enter', 640, 230, 20, '#fff', 'center', 'normal');
      g.fillStyle = 'rgba(0,20,70,0.85)'; g.fillRect(420, 280, 440, 70);
      text(this.typing + ((t * 2 | 0) % 2 ? '_' : ' '), 640, 315, 40, '#fff', 'center');
      text(n.length ? 'Esc: back' : '', 640, 400, 18, '#cfe', 'center', 'normal');
    } else {
      const rows = n.concat(['+ NEW PLAYER']);
      const top = Math.max(0, Math.min(rows.length - 8, this.i - 4));
      rows.slice(top, top + 8).forEach((name, k) => {
        const i = top + k, y = 160 + k * 54, on = i === this.i;
        if (on) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(350, y - 24, 580, 48); }
        text(name, 380, y, 28, on ? '#ffd23c' : '#fff');
        if (i < n.length) {
          const p = DATA.profiles[name];
          text(String(p.points || 0) + ' pts', 900, y - 6, 20, '#ffe86a', 'right');
          text(Object.keys(p.records || {}).length + ' charts played', 900, y + 15, 14, '#dff', 'right', 'normal');
        }
      });
      if (this.confirmDel) {
        g.fillStyle = 'rgba(80,0,20,0.92)'; g.fillRect(400, 300, 480, 110);
        text(`Delete ${this.confirmDel}'s data?`, 640, 335, 26, '#fff', 'center');
        text('Enter: delete    any other key: keep', 640, 375, 18, '#fcc', 'center', 'normal');
      }
    }
    if (this.msg) text(this.msg, 640, 640, 20, '#0d3770', 'center');
    text('Enter: choose    Tab: delete player    Up/Down: move', 640, 690, 18, '#0d3770', 'center', 'normal');
  },
};

// ---- setup: where the Wii disc and ffmpeg are (asked at start until both are set)
const Setup = {
  msg: '', i: 0, st: null, polling: false,
  with(m) { this.msg = m || ''; this.refresh(); return this; },
  async refresh() {
    try { this.st = await api('/api/setup'); } catch (e) { this.st = null; }
    if (this.st && this.st.msg) this.msg = this.st.msg;
    if (this.st && this.st.busy && !this.polling) {
      this.polling = true;
      const tick = async () => { await this.refresh(); if (this.st && this.st.busy && scene === this) setTimeout(tick, 1000); else this.polling = false; };
      setTimeout(tick, 1000);
    }
  },
  rows() {
    const st = this.st || {};
    return [
      { key: 'iso', label: 'Wii disc (DDR II USA)', value: st.gameOk ? 'reading from ' + (st.folder || '') : st.iso || 'not set', ok: !!st.gameOk },
      { key: 'ffmpeg', label: 'ffmpeg.exe', value: st.ffmpeg || (st.ffmpegSkip ? 'skipped' : 'not set'), ok: !!st.ffmpegOk },
      { key: 'folder', label: 'or: an extracted game folder', value: '', ok: null },
      { key: 'go', label: 'START', value: st.gameOk ? '' : 'pick the disc first', ok: null },
    ];
  },
  draw(t) {
    menuBackground(t);
    if (A.img && A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('SETUP', 210, 44, 34, '#fff', 'center');
    panel(190, 110, 900, 520);
    text('Where are your files?', 640, 160, 34, '#fff', 'center');
    text('Your disc is only read, never changed. Its files are copied out once into "Game Files".', 640, 198, 17, '#cfe3ff', 'center', 'normal');
    const rows = this.rows();
    rows.forEach((r, k) => {
      const y = 250 + k * 78, on = this.i === k;
      g.fillStyle = on ? 'rgba(255,140,30,0.35)' : 'rgba(0,20,70,0.6)'; g.fillRect(230, y, 820, 62);
      if (on) { g.strokeStyle = '#ff9a20'; g.lineWidth = 3; g.strokeRect(230, y, 820, 62); }
      text(r.label, 250, y + 22, 22, r.key === 'go' && !(this.st && this.st.gameOk) ? '#889' : '#fff');
      if (r.value) text(r.value.length > 70 ? '...' + r.value.slice(-67) : r.value, 250, y + 46, 15, '#bcd', 'left', 'normal');
      if (r.ok === true) text('OK', 1020, y + 31, 24, '#5f8', 'right');
      else if (r.ok === false) text('NEEDED', 1020, y + 31, 18, r.key === 'ffmpeg' ? '#fd6' : '#f88', 'right');
    });
    if (this.st && this.st.busy) text('Working' + '.'.repeat(1 + ((t * 2) | 0) % 3), 640, 580, 20, '#ffd23c', 'center');
    if (this.msg) text(this.msg.slice(0, 120), 640, 605, 17, '#ffd', 'center', 'normal');
    text('Up/Down choose   Enter pick   K skip ffmpeg   D pick DolphinTool.exe', 640, 690, 16, '#dde', 'center', 'normal');
    text('ffmpeg is used for custom-song videos and pictures. Unzip the ffmpeg download first, then pick bin\\ffmpeg.exe inside it.', 640, 664, 14, '#cde', 'center', 'normal');
  },
  async act(what) {
    if (this.st && this.st.busy) return;
    if (what === 'go') {
      if (!(this.st && this.st.gameOk)) { this.msg = 'Pick your Wii disc first.'; return; }
      if (!this.st.ffmpegOk && !this.st.ffmpegSkip) { await api('/api/setup', { pick: 'skipffmpeg' }); }
      sfx('SE_SYS_DECIDE01');
      SONGS = await loadSongs(); await loadSave();
      if (!A.ready) await A.load();
      return go(Players);
    }
    this.msg = what === 'folder' ? 'A folder window should open (it may be behind the browser)...' : 'A file window should open (it may be behind the browser)...';
    try { this.st = await api('/api/setup', { pick: what }); } catch (e) { this.msg = String(e); return; }
    this.msg = this.st.msg || '';
    if (this.st.busy) this.refresh();
    if (what === 'iso' && this.st.gameOk && !this.st.ffmpegOk && !this.st.ffmpegSkip) this.i = 1;
    else if (this.st.gameOk && (this.st.ffmpegOk || this.st.ffmpegSkip)) this.i = 3;
  },
  input(a, p) {
    if (!p) return;
    if (a === 'P1U' || a === 'P2U') { this.i = (this.i + 3) % 4; sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1D' || a === 'P2D') { this.i = (this.i + 1) % 4; sfx('SE_SYS_SELECT01'); }
    else if (a === 'START') this.act(this.rows()[this.i].key);
  },
  key(e) {
    if (e.code === 'KeyK') { api('/api/setup', { pick: 'skipffmpeg' }).then(() => this.refresh()); this.msg = 'ffmpeg skipped (custom-song videos in old formats will not play).'; }
    if (e.code === 'KeyD') this.act('dolphintool');
  },
  click() { this.act(this.rows()[this.i].key); },
};

function hasDouble(s) { return (s.double || []).some(v => v > 0) || !!(s.alt && (s.alt.double || []).some(v => v > 0)); }

// ---- style select, before the song list: SINGLE, DOUBLE, 2 PLAYERS (one mat each) or
// 2 PLAYERS DOUBLE (two mats each, four in all)
const STYLES = [
  { name: 'SINGLE', sub: '1 player - 1 mat', style: 'single', two: false, mats: [1] },
  { name: 'DOUBLE', sub: '1 player - 2 mats', style: 'double', two: false, mats: [2] },
  { name: '2 PLAYERS', sub: '1 mat each', style: 'single', two: true, mats: [1, 1] },
  { name: '2 PLAYERS DOUBLE', sub: '2 mats each - 4 mats', style: 'double', two: true, mats: [2, 2] },
];
const Style = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0,
  enter() { this.i = (S.style === 'double' ? 1 : 0) + (P2 ? 2 : 0); this.at = performance.now(); },
  input(a, p) {
    if (!p) return;
    if (/^P[1-4][LU]$/.test(a)) { if (this.i > 0) { this.i--; sfx('SE_SYS_SELECT01'); } }
    else if (/^P[1-4][RD]$/.test(a)) { if (this.i < STYLES.length - 1) { this.i++; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'START') {
      const st = STYLES[this.i];
      S.style = st.style; saveSettings();
      sfx('SE_SYS_DECIDE01');
      Select.query = '';
      if (!st.two) P2 = null;
      go(Select); sfx('VO_NAR_SELECTMUSIC');
      if (st.two) { Select.openJoin(); Select.join.fromStyle = true; Select.join.list = Select.join.list.filter(x => x !== '1 PLAYER ONLY'); }
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); P2 = null; go(Players); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('SELECT STYLE', 210, 44, 34, '#fff', 'center');
    const k = clamp((performance.now() - this.at) / 250);
    let nS = 0, nD = 0;
    for (const s of SONGS) { if (isLocked(s)) continue; nS++; if (hasDouble(s)) nD++; }
    const w = 270, h = 400, gap = 24, x0 = 640 - (STYLES.length * w + (STYLES.length - 1) * gap) / 2;
    STYLES.forEach((st, i) => {
      const on = this.i === i, x = x0 + i * (w + gap), y = 150 + (1 - k) * 40;
      g.save(); g.globalAlpha = k;
      if (on) { g.fillStyle = `rgba(255,138,30,${0.75 + 0.25 * Math.sin(t * 6)})`; g.fillRect(x - 10, y - 10, w + 20, h + 20); }
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, on ? '#3aa0ff' : '#2a6cc0'); gr.addColorStop(1, on ? '#1446b0' : '#123a80');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x, y, w, h);
      const words = st.name.split(' ').length > 2 ? ['2 PLAYERS', 'DOUBLE'] : [st.name];
      words.forEach((wd, j) => text(wd, x + w / 2, y + 48 + j * 38 - (words.length - 1) * 12, words.length > 1 ? 30 : 36, on ? '#ffd23c' : '#fff', 'center'));
      // the mats: a 3x3 grid each, arrow panels lit; a gap between the two players
      const cell = 18, mw = cell * 3, mg = 6, pg = 22;
      const widths = st.mats.map(m => m * mw + (m - 1) * mg), total = widths.reduce((a2, b2) => a2 + b2, 0) + (st.mats.length - 1) * pg;
      let mx = x + w / 2 - total / 2;
      st.mats.forEach((m, pi) => {
        for (let q = 0; q < m; q++) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
          const arrow = (r + c) % 2 === 1;
          g.fillStyle = arrow ? (on ? (pi ? '#ff9ad0' : '#ffe066') : '#c8d8f0') : 'rgba(0,10,40,0.6)';
          g.fillRect(mx + q * (mw + mg) + c * cell + 1, y + 150 + r * cell + 1, cell - 2, cell - 2);
        }
        if (st.mats.length > 1) text((pi + 1) + 'P', mx + widths[pi] / 2, y + 222, 16, '#fff', 'center');
        mx += widths[pi] + pg;
      });
      text(st.sub, x + w / 2, y + 285, 17, '#e6f2ff', 'center', 'normal');
      text((st.style === 'double' ? nD : nS) + ' songs', x + w / 2, y + 335, 24, '#fff', 'center');
      g.restore();
    });
    text('Left/Right: choose    Enter: OK    Esc: back', W / 2, 690, 16, '#0d3770', 'center', 'normal');
  },
};

// ---- song select
const Select = {
  idx: 0, moved: 0, previewFor: -1, previewSrc: null, previewGain: null, previewCache: new Map(),
  // hold left / right (keys or a mat panel) to keep scrolling: a pause, then faster and faster
  held: 0, heldSince: 0, nextRep: 0, reps: 0,
  update() {
    const now = performance.now();
    if (this.okAt && now - this.okAt > 450) { this.launch(); return; }
    if (this.stage || this.join || this.typing !== null || !this.order || this.order.length < 2) { this.held = 0; return; }
    const side = d => ['P1', 'P2', 'P3', 'P4'].some(p => input.isDown(p + d)) || !!input.down['k:Arrow' + (d === 'L' ? 'Left' : 'Right')];
    const d = side('L') && !side('R') ? -1 : side('R') && !side('L') ? 1 : 0;
    if (d !== this.held) { this.held = d; this.heldSince = now; this.nextRep = now + 380; this.reps = 0; return; }
    if (d && now >= this.nextRep) {
      this.move(d); sfx('SE_SYS_SELECT01');
      this.reps++; this.nextRep = now + (this.reps < 6 ? 110 : 65);
    }
  },
  enter() {
    this.okAt = 0; this.slot = 4;
    if (!SONGS.length) return;
    // a custom song played last time: come back inside its folder
    const last = S.lastSlot && SONGS.find(s => s.custom && s.slot === S.lastSlot);
    if (last && this.inFolder === undefined) this.inFolder = last.folder;
    this.buildOrder();
    this.order = this.filtered(this.query);
    if (!this.order.length) { this.query = ''; this.order = this.fullOrder; }   // the songs changed under the search
    this.typing = null; this.stage = null;
    this.idx = Math.min(this.idx, this.order.length - 1);
    if (S.lastSlot) { const i = this.order.findIndex(s => s.slot === S.lastSlot || s.full === S.lastSlot || (s.alt && s.alt.slot === S.lastSlot)); if (i >= 0) this.idx = i; }
    this.fixDiff();
    this.moved = performance.now();
  },
  leave() { this.stopPreview(); this.typing = null; },
  // the list: RANDOM, then a tile for each of your custom folders, then the game's songs
  // (Replicant D-action together at the end, in the game's order). Inside a folder: just its songs.
  inFolder: undefined,
  buildOrder() {
    // in Double, songs with no Double charts are left out
    const all = SONGS.filter(s => !isLocked(s) && (styleNow() !== 'double' || hasDouble(s)));
    const game = all.filter(s => !s.custom);
    const gameOrder = game.filter(s => rdaIndex(s) < 0).concat(game.filter(s => rdaIndex(s) >= 0).sort((a, b) => rdaIndex(a) - rdaIndex(b)));
    const customs = all.filter(s => s.custom);
    this.allSongs = gameOrder.concat(customs);                  // what a search looks through
    if (this.inFolder) {
      this.fullOrder = customs.filter(s => s.folder === this.inFolder);
      if (!this.fullOrder.length) this.inFolder = null;
      else return;
    }
    const tiles = CUSTOM_FOLDERS.map(f => ({ folderTile: true, folder: f, slot: 'folder:' + f, name: f, artist: '',
      count: customs.filter(s => s.folder === f).length, bpm: ['---', '---'], length: 0,
      single: [0, 0, 0, 0, 0], double: [0, 0, 0, 0, 0], radar: [], jacket: null, title: null }));
    this.fullOrder = [RANDOM_SONG].concat(tiles, gameOrder.length ? gameOrder : customs);
  },
  openFolder(tile) {
    if (!tile.count) { this.note = 'The folder "' + tile.folder + '" is empty - import songs into it from Custom Songs'; this.noteAt = performance.now(); sfx('SE_SYS_ERROR'); return; }
    sfx('SE_SYS_DECIDE01');
    this.inFolder = tile.folder; this.query = ''; this.favOnly = false;
    this.buildOrder(); this.order = this.fullOrder;
    this.idx = 0; this.slot = 0; this.lastDir = 1; this.scrolled = false;
    this.moved = performance.now(); this.stopPreview(); this.fixDiff();
  },
  closeFolder() {
    const f = this.inFolder;
    sfx('SE_SYS_WINDOWOUT');
    this.inFolder = null; this.query = ''; this.favOnly = false;
    this.buildOrder(); this.order = this.fullOrder;
    const i = this.order.findIndex(s => s.folderTile && s.folder === f);
    this.idx = i >= 0 ? i : 0; this.slot = Math.min(4, this.idx); this.lastDir = -1; this.scrolled = true;
    this.moved = performance.now(); this.stopPreview(); this.fixDiff();
  },
  // ---- search: song name, artist, or custom folder; every word typed has to match
  query: '', typing: null,
  hay(s) {
    if (!s._hay) s._hay = [s.name, s.artist, s.folder, s.alt && s.alt.name].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
    return s._hay;
  },
  filtered(q) {
    const words = (q || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    // favorites and searches look through every song, folders included
    const every = this.inFolder ? this.fullOrder : (this.allSongs || this.fullOrder);
    const base = this.favOnly ? every.filter(s => isFav(s)) : words.length ? every : this.fullOrder;
    if (!words.length) return base;
    return base.filter(s => { const h = this.hay(s), hs = h.replace(/ /g, ''); return words.every(w => h.includes(w) || hs.includes(w)); });
  },
  applySearch(q) {
    const cur = this.order && this.order[this.idx];
    const list = this.filtered(q);
    if (!list.length) { this.noMatch = true; return; }        // keep showing the last results
    this.noMatch = false;
    this.query = q; this.order = list;
    const i = cur ? list.indexOf(cur) : -1;
    this.idx = i >= 0 ? i : 0;
    this.moved = performance.now(); this.stopPreview(); this.fixDiff();
  },
  // the selected song in the chosen version (SHORT tab = the game's cut version)
  song() {
    const s = this.order[this.idx];
    if (!s) return s;
    if (S.short && s.alt) return Object.assign({}, s, s.alt, { isShort: true, movie: s.movie });   // the short version keeps the song's video
    return Object.assign({}, s, { isShort: !!s.short });
  },
  hasBoth() { const s = this.order[this.idx]; return !!(s && s.alt); },
  validDiff(diff) {
    const lv = levelsOf(this.song());
    if (lv[DIFFS.findIndex(d => d[0] === diff)]) return diff;
    const ok = DIFFS.find((d, i) => lv[i]);
    return ok ? ok[0] : diff;
  },
  fixDiff() {
    S.diff = this.validDiff(S.diff);
    if (P2) P2.diff = this.validDiff(P2.diff);
  },
  lastDir: 0,
  // like the game, the cursor walks along the row of jackets; the row only scrolls at its ends
  slot: 4,
  move(d) {
    this.lastDir = d;
    const ns = this.slot + d;
    this.scrolled = ns < 0 || ns > 8;
    this.slot = Math.max(0, Math.min(8, ns));
    this.idx = (this.idx + d + this.order.length) % this.order.length;
    this.moved = performance.now();
    this.stopPreview();
    this.fixDiff();
  },
  stepDiff(cur, d) {
    const lv = levelsOf(this.song());
    let i = DIFFS.findIndex(x => x[0] === cur);
    for (let k = 0; k < DIFFS.length; k++) { i = Math.max(0, Math.min(DIFFS.length - 1, i + d)); if (lv[i]) break; }
    return lv[i] ? DIFFS[i][0] : cur;
  },
  changeDiff(d, who = 0) {
    if (who === 1 && P2) { P2.diff = this.stepDiff(P2.diff, d); return; }
    const n = this.stepDiff(S.diff, d);
    if (n !== S.diff) { S.diff = n; saveSettings(); }
  },
  // player 2 joins (or changes who they are / leaves): a small list of user data
  openJoin() {
    const names = Object.keys(DATA.profiles).filter(n => n !== DATA.current);
    const list = ['GUEST', ...names];
    if (P2) list.push('1 PLAYER ONLY');
    this.join = { list, i: Math.max(0, P2 ? list.indexOf(P2.name || 'GUEST') : 0) };
    sfx('SE_SYS_WINDOWIN');
  },
  joinInput(a) {
    const j = this.join, n = j.list.length;
    if (/^P[12]U$/.test(a)) { j.i = (j.i + n - 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (/^P[12]D$/.test(a)) { j.i = (j.i + 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (a === 'START' || a === 'P2START') {
      const pick = j.list[j.i];
      if (pick === '1 PLAYER ONLY') P2 = null;
      else {
        const name = pick === 'GUEST' ? null : pick, prof = name && DATA.profiles[name];
        const want = prof && prof.opts && prof.opts.diff !== undefined ? prof.opts.diff : (P2 ? P2.diff : S.diff);
        P2 = { name, diff: want };
      }
      this.join = null; this.fixDiff(); sfx('SE_SYS_DECIDE01');
    } else if (a === 'BACK') { const back = this.join.fromStyle && !P2; this.join = null; sfx('SE_SYS_WINDOWOUT'); if (back) go(Style); }
  },
  key(e) {
    if (this.typing !== null) {                          // typing a search
      e.preventDefault();
      if (e.code === 'Escape') { this.typing = null; this.noMatch = false; this.applySearch(''); sfx('SE_SYS_WINDOWOUT'); return; }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { this.typing = null; this.noMatch = false; sfx('SE_SYS_DECIDE01'); return; }
      if (e.code === 'Backspace') this.typing = this.typing.slice(0, -1);
      else if (e.key.length === 1 && this.typing.length < 30) this.typing += e.key;
      else return;
      this.applySearch(this.typing);
      return;
    }
    if (this.stage) return;
    if (e.code === 'KeyQ' && !e.repeat && !this.join) {        // star / unstar this song
      const s = this.order[this.idx];
      if (!s || s.random || s.folderTile) return;
      const on = toggleFav(s);
      sfx(on ? 'SE_SYS_DECIDE02' : 'SE_SYS_WINDOWOUT');
      this.note = on ? '★ Added to your favorites' : 'Removed from your favorites'; this.noteAt = performance.now();
      if (this.favOnly && !on) { const list = this.filtered(this.query); if (list.length) { this.order = list; this.idx = Math.min(this.idx, list.length - 1); this.fixDiff(); } else { this.favOnly = false; this.applySearch(this.query); } }
      return;
    }
    if (e.code === 'KeyW' && !e.repeat && !this.join) {        // favorites only, and back
      const want = !this.favOnly;
      if (want && !this.fullOrder.some(s => isFav(s))) { this.note = 'No favorites yet - press Q to star a song'; this.noteAt = performance.now(); sfx('SE_SYS_ERROR'); return; }
      this.favOnly = want; const cur = this.order[this.idx];
      let list = this.filtered(this.query);
      if (!list.length) { this.query = ''; list = this.filtered(''); }
      this.order = list; const i = list.indexOf(cur); this.idx = i >= 0 ? i : 0;
      this.moved = performance.now(); this.stopPreview(); this.fixDiff(); sfx('SE_SYS_SELECT02');
      return;
    }
    if ((e.key === '/' || e.code === 'KeyS') && !e.repeat && !this.join) { e.preventDefault(); this.typing = this.query || ''; this.noMatch = false; sfx('SE_SYS_WINDOWIN'); return; }
    if (e.code === 'Digit2' && !e.repeat && !this.join) { this.openJoin(); }
    if (e.code === 'KeyF' && !e.repeat && !this.join) {      // jump to the next section (game songs, Replicant D-action, your folders)
      const cur = sectionOf(this.order[this.idx]);
      let i = this.order.findIndex((s, k) => k > this.idx && sectionOf(s) !== cur);
      if (i < 0) i = 0;
      if (i !== this.idx) { this.lastDir = 1; this.idx = i; this.moved = performance.now(); this.stopPreview(); this.fixDiff(); sfx('SE_SYS_SELECT02'); }
    }
    if (e.code === 'KeyR' && !e.repeat && !this.join) {      // jump to Replicant D-action and back
      const inRda = rdaIndex(this.order[this.idx]) >= 0;
      const i = inRda ? 0 : this.order.findIndex(s => rdaIndex(s) >= 0);
      if (i >= 0 && i !== this.idx) { this.lastDir = inRda ? -1 : 1; this.idx = i; this.moved = performance.now(); this.stopPreview(); this.fixDiff(); sfx('SE_SYS_SELECT02'); }
    }
  },
  stopPreview() {
    if (this.previewSrc) {
      const src = this.previewSrc, gn = this.previewGain;
      try { gn.gain.setTargetAtTime(0, actx.currentTime, 0.05); src.stop(actx.currentTime + 0.3); } catch (e) {}
    }
    this.previewSrc = null; this.previewFor = -1;
  },
  async startPreview(song) {
    this.previewFor = song.slot;
    try {
      let buf = this.previewCache.get(song.slot);
      if (!buf) {
        buf = song.custom ? await customPreview(song) : toBuffer(DDR.decodeBRSTM(await bin('/api/preview/' + song.slot)));
        this.previewCache.set(song.slot, buf);
        if (this.previewCache.size > 12) this.previewCache.delete(this.previewCache.keys().next().value);
      }
      if (this.previewFor !== song.slot || scene !== this) return;
      const ctx = audio(), src = ctx.createBufferSource(), gn = ctx.createGain();
      src.buffer = buf; src.loop = true;
      gn.gain.setValueAtTime(0, ctx.currentTime); gn.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 0.4);
      src.connect(gn).connect(ctx.destination); src.start();
      this.previewSrc = src; this.previewGain = gn;
    } catch (e) { /* no preview */ }
  },
  input(a, p) {
    if (!p) return;
    if (this.typing !== null) return;                   // keys go to the search box
    if (this.join) { this.joinInput(a); return; }
    if (this.stage) { this.stageInput(a); return; }
    if (a === 'BACK' && this.query) { this.applySearch(''); sfx('SE_SYS_WINDOWOUT'); return; }
    if (a === 'BACK' && this.inFolder && !this.favOnly) { this.closeFolder(); return; }
    if (a === 'BACK' && !this.favOnly) { sfx('SE_SYS_WINDOWOUT'); this.stopPreview(); go(Style); return; }
    // in VERSUS each player picks their own difficulty: player 2 is the P2 side (Single) or P3/P4 (Double)
    let who = 0;
    const pm = /^P([1-4])([LDUR])$/.exec(a);
    if (pm) {
      const n = +pm[1];
      if (P2) who = styleNow() === 'double' ? (n >= 3 ? 1 : 0) : (n === 2 ? 1 : 0);
      a = 'P1' + pm[2];
    }
    if (a === 'P1L' || a === 'P2L') { this.move(-1); sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1R' || a === 'P2R') { this.move(1); sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1U' || a === 'P2U') { this.changeDiff(-1, who); sfx('SE_SYS_SELECT02'); }
    else if (a === 'P1D' || a === 'P2D') { this.changeDiff(1, who); sfx('SE_SYS_SELECT02'); }
    else if (a === 'P2START') this.openJoin();
    else if (a === 'START' && this.order[this.idx] && this.order[this.idx].folderTile) { this.openFolder(this.order[this.idx]); return; }
    else if (a === 'START' && this.order[this.idx] && this.order[this.idx].random) {
      const pool = this.order.map((s2, i) => i).filter(i => !this.order[i].random && (levelsOf(this.order[i]).some(v => v > 0) || (this.order[i].alt && levelsOf(Object.assign({}, this.order[i], this.order[i].alt)).some(v => v > 0))));
      if (!pool.length) { sfx('SE_SYS_ERROR'); return; }
      this.idx = pool[Math.floor(Math.random() * pool.length)];
      this.lastDir = 1; this.scrolled = true; this.moved = performance.now(); this.stopPreview(); this.fixDiff();
      sfx('SE_SYS_DECIDE01');
      this.note = 'RANDOM picked: ' + this.order[this.idx].name; this.noteAt = performance.now();
      return;
    }
    else if (a === 'START') {
      if (!levelsOf(this.song()).some(v => v > 0) && !(this.hasBoth() && levelsOf(Object.assign({}, this.order[this.idx], this.order[this.idx].alt)).some(v => v > 0))) {
        this.note = 'No ' + styleNow() + ' charts for this song'; this.noteAt = performance.now(); sfx('SE_SYS_ERROR'); return;
      }
      sfx('SE_SYS_DECIDE01');
      // like the game: songs with two versions ask SHORT / FULL first, then the difficulty
      if (this.hasBoth()) { this.stage = 'length'; this.lenPick = S.short ? 0 : 1; }
      else this.stage = 'diff';
      this.stageAt = performance.now();
    }
    else if (a === 'OPTIONS') { sfx('SE_SYS_WINDOWIN'); go(Options); }
    else if (a === 'SWITCH') {
      if (!this.hasBoth()) return;
      S.short = !S.short; saveSettings(); sfx('SE_SYS_SELECT02');
      this.stopPreview(); this.moved = performance.now(); this.fixDiff();
    }
  },
  // after a song is picked: 'length' (SHORT / FULL pop-up) then 'diff' (choose the difficulty, Enter starts)
  stage: null,
  stageInput(a) {
    let who = 0;
    const pm = /^P([1-4])([LDUR])$/.exec(a);
    if (pm) { const n = +pm[1]; if (P2) who = styleNow() === 'double' ? (n >= 3 ? 1 : 0) : (n === 2 ? 1 : 0); a = 'P1' + pm[2]; }
    if (this.stage === 'length') {
      if (/^P1[LRUD]$/.test(a) || a === 'SWITCH') { this.lenPick = 1 - this.lenPick; sfx('SE_SYS_SELECT01'); }
      else if (a === 'START') {
        const short = this.lenPick === 0;
        if (S.short !== short) { S.short = short; saveSettings(); this.stopPreview(); this.moved = performance.now(); }
        this.fixDiff();
        if (!levelsOf(this.song()).some(v => v > 0)) { this.note = 'No ' + styleNow() + ' charts for this version'; this.noteAt = performance.now(); sfx('SE_SYS_ERROR'); return; }
        sfx('SE_SYS_DECIDE01'); this.stage = 'diff'; this.stageAt = performance.now();
      } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.stage = null; }
      return;
    }
    // choosing the difficulty
    if (a === 'P1U') { this.changeDiff(-1, who); sfx('SE_SYS_SELECT02'); }
    else if (a === 'P1D') { this.changeDiff(1, who); sfx('SE_SYS_SELECT02'); }
    else if (a === 'START') {
      if (this.okAt) return;
      sfx('SE_SYS_DECIDE01');
      this.okAt = performance.now();           // "OK" shows on the button for a moment, like the game
    } else if (a === 'BACK' && !this.okAt) { sfx('SE_SYS_WINDOWOUT'); this.stage = this.hasBoth() ? 'length' : null; this.stageAt = performance.now(); }
  },
  launch() {
    {
      this.okAt = 0;
      this.stage = null;
      S.lastSlot = this.song().slot; saveSettings();
      const next = Loading.with(this.song());
      // before a VERSUS game on dance mats, make sure each mat is the right player (once, or after a mat is plugged in)
      go(P2 && input.padCount() >= 2 && (!input.matsChecked || input.padsChanged) && MatCheck.rolesFor(true).length >= 2 ? MatCheck.with(next, true) : next);
    }
  },
  drawStage(t) {
    const k = clamp((performance.now() - this.stageAt) / 150), P = A.pop || {};
    const pw = 624, ph = 468, px = W / 2 - pw / 2, py = H / 2 - ph / 2 + 6;
    const mmss = v => { const n = Math.round(v || 0); return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); };
    const pulse = 0.75 + 0.25 * Math.sin(t * 7);
    g.fillStyle = `rgba(0,10,40,${0.7 * k})`; g.fillRect(0, 0, W, H);
    g.save();
    // the game's pop-ups fill most of the screen
    g.translate(W / 2, H / 2); g.scale(1.37, 1.37); g.translate(-W / 2, -H / 2 - 6);
    const back = this.stage === 'diff' ? P.radar : P.panel;
    if (back) g.drawImage(back, px, py, pw, ph);
    else { g.fillStyle = '#1d5fc8'; g.fillRect(px, py, pw, ph); }
    const head = (im, label) => { if (!blit(im, W / 2, py + 34, 1)) text(label, W / 2, py + 34, 26, '#fff', 'center'); };
    const footer = items => items.forEach(([key, label], i) => {
      const x = px + pw / 2 + (i - (items.length - 1) / 2) * 170, y = py + ph - 36;
      text(key, x - 8, y, 12, '#ffe86a', 'right'); text(label, x - 2, y, 13, '#fff');
    });
    if (this.stage === 'length') {
      // SELECT SONG LENGTH: two cards, the chosen one sitting in an orange frame
      const s = this.order[this.idx];
      head(P.lenHead, 'SELECT SONG LENGTH');
      [[s.alt.length, P.shortTxt, 'SHORT SONG'], [s.length, P.fullTxt, 'FULL SONG']].forEach(([len, nm, label], i) => {
        const cw = 480, ch = 152, cx = W / 2 - cw / 2, cy = py + 92 + i * 172, on = this.lenPick === i;
        if (on) { g.save(); g.globalAlpha = k * pulse; if (P.cardOn) g.drawImage(P.cardOn, cx - 10, cy - 10, cw + 20, ch + 20); else { g.fillStyle = '#ff7a10'; g.fillRect(cx - 10, cy - 10, cw + 20, ch + 20); } g.restore(); }
        if (P.cards && P.cards[i]) g.drawImage(P.cards[i], cx, cy, cw, ch);
        else { g.fillStyle = '#e4f3ff'; g.fillRect(cx, cy, cw, ch); }
        if (!on) { g.fillStyle = 'rgba(20,40,80,0.35)'; g.fillRect(cx, cy, cw, ch); }
        // the icon is on the left of SHORT and on the right of FULL
        const tx = i === 0 ? cx + 300 : cx + 180;
        if (!blit(nm, tx, cy + 56, 0.82)) text(label, tx, cy + 56, 30, '#334', 'center');
        const bx = tx - 20, by = cy + 98;
        text('Song Length', bx - 6, by + 14, 15, '#14306e', 'right');
        if (P.box) g.drawImage(P.box, bx, by, 130, 28); else { g.fillStyle = '#3a4250'; g.fillRect(bx, by, 130, 28); }
        text(mmss(len), bx + 65, by + 15, 19, '#fff', 'center');
      });
      footer([['Up/Down', 'SELECT'], ['Enter', 'OK'], ['Esc', 'BACK']]);
    } else {
      // SELECT DIFFICULTY: the song on the left with its radar, big difficulty buttons on the right
      const song = this.song(), lv = levelsOf(song), both = this.hasBoth();
      head(P.diffHead && P.diffHead[both ? (song.isShort ? 1 : 2) : 0], 'SELECT DIFFICULTY');
      const ti = texture('title', song.title), lx = px + 157;
      if (ti.img) { const sc = Math.min(1.05, 280 / ti.img.width, 48 / ti.img.height); g.drawImage(ti.img, lx - ti.img.width * sc / 2, py + 102 - ti.img.height * sc / 2, ti.img.width * sc, ti.img.height * sc); }
      else { text(song.name.slice(0, 26), lx, py + 108, 18, '#fff', 'center'); if (song.artist) text(song.artist.slice(0, 32), lx, py + 128, 13, '#dff', 'center', 'normal'); }
      const bpm = song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + '-' + song.bpm[1];
      // BPM and length: the labels, then the value in a grey box, in a heavy outlined lettering like the game's
      const outl = (str, x, y, size, col, align, italic) => {
        g.font = `${italic ? 'italic ' : ''}900 ${size}px Georgia, 'Times New Roman', serif`; g.textAlign = align; g.textBaseline = 'middle';
        g.lineJoin = 'round'; g.strokeStyle = '#111'; g.lineWidth = size / 4.5; g.strokeText(str, x, y);
        g.fillStyle = col; g.fillText(str, x, y);
      };
      [[A.img.bpmLabel, 'BPM', bpm, 148, false], [A.img.lenLabel, 'Song Length', mmss(song.length), 178, true]].forEach(([im, label, val, y, it]) => {
        // the game's label picture already has its grey box on the right
        if (im) { const sc = 266 / im.width; g.drawImage(im, px + 24, py + y - im.height * sc / 2, im.width * sc, im.height * sc); }
        else {
          outl(label, px + 92, py + y, 16, '#fff', 'center');
          g.fillStyle = '#41444c'; g.fillRect(px + 159, py + y - 12, 132, 24);
        }
        outl(val, px + 280, py + y + 1, 19, '#fff', 'right', it);
      });
      if (P.radar) this.drawRadar(song, px + 168, py + 331, 1, [[168, 246], [275, 296], [243, 402], [94, 402], [62, 296]].map(([x, y]) => [px + x, py + y]));
      else this.drawRadar(song, lx, py + 322, 1.05);
      // the buttons, with the level on each; the chosen one gets an orange frame, the player's badge
      // beside it, and "OK" once it's confirmed
      // only the difficulties the song has, centred in the column; the chosen one is a little bigger with
      // a glowing orange frame and the player's badge beside it, and shows "OK" once confirmed
      const rows = DIFFS.map((x, i) => i).filter(i => lv[i] > 0), step = 73;
      const top = py + 255 - (rows.length * step - 16) / 2;
      rows.forEach((i, r) => {
        const [d, name] = DIFFS[i], on = S.diff === d, on2 = P2 && P2.diff === d;
        const sc = on ? 1.12 : 1, bw = 156 * sc, bh = 57 * sc, cx = px + 475, cy = top + r * step + 28;
        const bx = cx - bw / 2, by = cy - bh / 2;
        if (on || on2) {
          g.save(); g.shadowColor = on ? '#ff8a10' : '#ff4fa0'; g.shadowBlur = 14;
          g.strokeStyle = on ? `rgba(255,${this.okAt ? 120 : 110 + 40 * pulse},20,1)` : `rgba(255,90,160,${pulse})`; g.lineWidth = 5;
          g.beginPath(); g.roundRect ? g.roundRect(bx - 5, by - 5, bw + 10, bh + 10, 10) : g.rect(bx - 5, by - 5, bw + 10, bh + 10); g.stroke();
          g.restore();
        }
        if (P.diff && P.diff[i]) g.drawImage(P.diff[i], bx, by, bw, bh); else { g.fillStyle = DIFFS[i][2]; g.fillRect(bx, by, bw, bh); text(name, bx + 10, by + 16, 15, '#fff'); }
        const str = String(lv[i]).padStart(2, '0'), ny = by + bh * 0.3, fs = 19 * sc;
        outl(str[0], bx + bw * 0.845, ny, fs, str[0] === '0' ? 'rgba(255,255,255,0.35)' : '#fff', 'center');
        outl(str[1], bx + bw * 0.935, ny, fs, '#fff', 'center');
        if (on && this.okAt) { if (!blit(P.ok, bx + bw - 30, by + bh - 15, 1)) text('OK', bx + bw - 30, by + bh - 15, 18, '#ffe14d', 'center'); }
        if (on && !blit(P.badge && P.badge[0], bx + bw + 24, cy, 0.5)) text('1', bx + bw + 24, cy, 18, '#fff', 'center');
        if (on2 && !blit(P.badge && P.badge[1], bx - 24, cy, 0.5)) text('2', bx - 24, cy, 18, '#fff', 'center');
      });
      footer([['Up/Down', 'DIFFICULTY'], ['Enter', 'START'], ['Esc', 'BACK']]);
    }
    g.restore();
  },
  draw(t) {
    menuBackground(t);
    if (!this.order || !this.order.length) { text('No songs found in the game folder.', W / 2, H / 2, 30, '#fff', 'center'); return; }
    const song = this.song(), rda = rdaIndex(song);
    if (rda >= 0) {                 // the boss folder: a darker, red-tinted screen
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(40,0,25,0.78)'); gr.addColorStop(1, 'rgba(110,0,30,0.62)');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
    if (performance.now() - this.moved > 350 && this.previewFor !== song.slot && song.preview) this.startPreview(song);
    // header tab
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    else { g.fillStyle = '#2a7fd6'; g.fillRect(0, 0, 440, 78); }
    if (rda >= 0) { g.fillStyle = 'rgba(120,0,30,0.55)'; g.fillRect(0, 0, 432, 74); text('REPLICANT D-ACTION', 216, 44, 30, '#ffd6e0', 'center'); }
    else if (this.inFolder || song.custom) { const f = this.inFolder || song.folder; g.fillStyle = 'rgba(10,60,40,0.5)'; g.fillRect(0, 0, 432, 74); text(f.toUpperCase(), 216, 38, 30, '#e8fff4', 'center'); text(this.inFolder ? 'YOUR FOLDER   Esc: back to all songs' : 'CUSTOM SONGS', 216, 64, 13, '#bfffe0', 'center', 'normal'); }
    else if (!blit(A.img.selTitle, 222, 50, 1.45)) text('SELECT MUSIC', 222, 50, 34, '#fff', 'center');
    // title + BPM / length (top right)
    const ti = texture('title', song.title);
    if (ti.img) g.drawImage(ti.img, 640 - ti.img.width * 0.85, 30, ti.img.width * 1.7, ti.img.height * 1.7);
    else { text(song.name.slice(0, 34), 640, song.artist ? 50 : 66, 28, '#fff', 'center'); if (song.artist) text(song.artist.slice(0, 44), 640, 86, 18, '#dff', 'center'); }
    const bpm = song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + '-' + song.bpm[1];
    const len = Math.round(song.length);
    const info = [[A.img.bpmLabel, 'BPM', bpm, 58], [A.img.lenLabel, 'Song Length', song.random ? '??:??' : song.folderTile ? '--:--' : `${String(Math.floor(len / 60)).padStart(2, '0')}:${String(len % 60).padStart(2, '0')}`, 92]];
    for (const [im, label, val, y] of info) {
      const sc = 1.32, x = 820;
      if (im) g.drawImage(im, x, y - 11 * sc, im.width * sc, im.height * sc);
      else text(label, x, y, 20, '#124');
      text(val, x + 186 * sc, y + 1, 24, '#fff', 'right');
    }
    // jacket row, like the game: nine places in a row; the cursor (a bigger jacket in an orange and
    // yellow frame) walks along it and the row scrolls only when the cursor reaches either end
    const since = Math.min(1, (performance.now() - this.moved) / 140);
    const n = this.order.length, big = 205, tw = 116, th = 130, step = 106, gap = 10, tileY = 160, bigY = 118;
    const slot = n <= 9 ? this.idx : Math.min(this.slot, n - 1), slide = n > 9 && this.scrolled ? (1 - since) * this.lastDir * step : 0;
    const x0 = 640 - (8 * step + big + 2 * gap) / 2;
    const xAt = p => p < slot ? x0 + p * step : p === slot ? x0 + slot * step + gap : x0 + (p - 1) * step + big + 2 * gap;
    const tile = (p, s2) => {
      const x = xAt(p) + slide;
      if (x < -tw || x > W) return;
      const jk = texture('jacket', s2.jacket), sk = p < slot ? 0.045 : -0.045;
      g.save(); g.transform(1, sk, 0, 1, x, tileY - (p < slot ? 0 : sk * tw));
      g.fillStyle = '#000'; g.fillRect(-3, -3, tw + 6, th + 6);
      if (s2.random) this.drawRandomTile(0, 0, tw, th, t);
      else if (s2.folderTile) this.drawFolderTile(0, 0, tw, th, s2);
      else if (jk.img) g.drawImage(jk.img, 0, 0, tw, th); else { g.fillStyle = '#123'; g.fillRect(0, 0, tw, th); text(s2.name.slice(0, 12), tw / 2, th / 2, 11, '#fff', 'center', 'normal'); }
      const gr = g.createLinearGradient(0, 0, 0, th);
      gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, tw, th);
      if (isFav(s2)) drawStar(16, 16, 12, '#ffd23c');
      g.restore();
    };
    const at = p => this.order[((this.idx - slot + p) % n + n) % n];
    const count = Math.min(9, n);
    // far ones first so the tiles nearer the cursor overlap them
    for (let p = 0; p < slot; p++) tile(p, at(p));
    for (let p = count - 1; p > slot; p--) tile(p, at(p));
    const pop = 0.92 + 0.08 * since, jk = texture('jacket', song.jacket), cx = xAt(slot) + big / 2;
    g.save(); g.translate(cx, bigY + big / 2); g.scale(pop, pop);
    const P = A.pop || {};
    if (P.curBack) g.drawImage(P.curBack, -big / 2 - 16, -big / 2 - 16, big + 32, big + 32);
    else { g.fillStyle = '#ff6a10'; g.fillRect(-big / 2 - 12, -big / 2 - 12, big + 24, big + 24); }
    g.fillStyle = '#000'; g.fillRect(-big / 2 - 2, -big / 2 - 2, big + 4, big + 4);
    if (song.random) this.drawRandomTile(-big / 2, -big / 2, big, big, t);
    else if (song.folderTile) this.drawFolderTile(-big / 2, -big / 2, big, big, song);
    else if (jk.img) g.drawImage(jk.img, -big / 2, -big / 2, big, big); else text(song.name.slice(0, 16), 0, 0, 15, '#fff', 'center');
    if (P.curFrame) g.drawImage(P.curFrame, -big / 2 - 6, -big / 2 - 6, big + 12, big + 12);
    if (isFav(song)) drawStar(-big / 2 + 26, -big / 2 + 28, 20, '#ffd23c');
    g.restore();
    // pink arrows and the position bar under the row
    const bob = Math.sin(t * 6) * 4;
    if (A.img.magenta) {
      g.save(); g.translate(282 - bob, 335); g.scale(-0.55, 0.55); blit(A.img.magenta, 0, 0); g.restore();
      blit(A.img.magenta, 1003 + bob, 335, 0.55);
    }
    g.fillStyle = 'rgba(70,80,95,0.7)'; g.fillRect(341, 360, 604, 4);
    const pos = n > 1 ? this.idx / (n - 1) : 0;
    g.fillStyle = '#ff6a1a'; g.fillRect(341 + pos * (604 - 44), 359, 44, 6);
    // radar with the SHORT / FULL tabs, and the difficulty panel beside it
    const isCut = !!song.isShort, both = this.hasBoth();
    if (both && A.img.shortTag && A.img.fullTag) {      // only songs with both versions show the tabs
      g.globalAlpha = isCut ? 1 : 0.55; g.drawImage(A.img.shortTag, 272, 374, 178, isCut ? 32 : 28);
      g.globalAlpha = !isCut ? 1 : 0.55; g.drawImage(A.img.fullTag, 451, 374, 178, !isCut ? 32 : 28);
      g.globalAlpha = 1;
    }
    this.drawRadar(song, 451, 528, 1.42);
    // SORT tab above the difficulties (the song order: DEFAULT is the game's own order)
    if (this.stage !== 'diff') {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(686, 388, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#14306e'; g.fillRect(680, 386, 12, 4);
      text('SORT', 721, 388, 15, '#14306e', 'center');
      g.fillStyle = '#2b2f38'; g.fillRect(762, 374, 182, 28);
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.strokeRect(762, 374, 182, 28);
      text(this.favOnly ? 'FAVORITE' : this.query ? 'SEARCH' : 'DEFAULT', 853, 388, 15, '#fff', 'center');
    }
    if (A.img.diffPanel) g.drawImage(A.img.diffPanel, 629, 405, 383, 232);
    else panel(629, 405, 383, 232);
    const lv = levelsOf(song);
    // like the game, only the difficulties the song has, from the top
    const shown = DIFFS.map((x, i) => i).filter(i => lv[i] > 0);
    DIFFS.forEach(([d, name, col], i) => {
      const row = shown.indexOf(i);
      if (row < 0) return;
      const y = 414 + row * 43, x = 652, w = 338, h = 40, on = S.diff === d, has = true;
      const bars = A.img.diffBars && A.img.diffBars[d];
      if (bars && bars[0]) g.drawImage(has ? bars[0] : bars[1], x, y, w, h);
      else { g.fillStyle = has ? '#0b2470' : '#335'; g.fillRect(x, y, w, h); text(name, x + 120, y + h / 2, 22, col, 'center'); }
      if (has) {                                   // the level with a dim leading zero, like the game's
        const str = String(lv[i]).padStart(2, '0');
        text(str[1], x + w - 10, y + h / 2 + 1, 30, '#ffffff', 'right');
        text(str[0], x + w - 30, y + h / 2 + 1, 30, str[0] === '0' ? 'rgba(255,255,255,0.35)' : '#ffffff', 'right');
      }
      const rec = has ? recordOf(song, d) : null;
      if (rec && rec.grade) {
        const gi = ['AAA', 'AA', 'A', 'B', 'C', 'D', 'E'].indexOf(rec.grade);
        if (rec.fc && A.img.crowns) blit(A.img.crowns[rec.fc === 5 ? 2 : rec.fc === 4 ? 0 : 1], x + 4, y + h / 2 - 6, 0.7);
        if (!blit(A.img.gradeSmall && A.img.gradeSmall[gi], x + 44, y + h / 2 + 2, 0.8)) text(rec.grade, x + 40, y + h / 2, 20, '#4fb4ff', 'center');
      }
      if (on) {
        g.strokeStyle = `rgba(255,255,255,${0.75 + 0.25 * Math.sin(t * 8)})`; g.lineWidth = 4;
        g.strokeRect(x - 3, y - 2, w + 6, h + 4);
        g.fillStyle = P2 ? '#5ad0ff' : '#fff'; g.beginPath(); g.moveTo(x - 30 + bob, y + h / 2 - 11); g.lineTo(x - 13 + bob, y + h / 2); g.lineTo(x - 30 + bob, y + h / 2 + 11); g.fill();
        if (P2) text('1P', x - 42 + bob, y + h / 2, 14, '#0d3770', 'center');
      }
      if (P2 && P2.diff === d) {                   // player 2's cursor on the right
        g.strokeStyle = `rgba(255,120,170,${0.75 + 0.25 * Math.sin(t * 8 + 1)})`; g.lineWidth = 3;
        g.strokeRect(x - 7, y - 5, w + 14, h + 10);
        g.fillStyle = '#ff5c9a'; g.beginPath(); g.moveTo(x + w + 30 - bob, y + h / 2 - 11); g.lineTo(x + w + 13 - bob, y + h / 2); g.lineTo(x + w + 30 - bob, y + h / 2 + 11); g.fill();
      }
    });
    // DDR points (bottom left, like the game)
    g.fillStyle = 'rgba(20,40,150,0.9)'; g.fillRect(28, 636, 150, 22);
    text('DDR POINTS', 103, 647, 15, '#fff', 'center');
    text(String(SAVE.points).padStart(7, '0') + ' pts', 28, 678, 24, '#ffe86a');
    // help: two rows of four dark buttons, like the game's
    const help = [[['Enter', 'CONFIRM'], ['Esc', 'BACK'], ['←→', 'MUSIC'], ['Q', 'FAVORITE']],
                  [['Tab', 'OPTIONS'], ['S', 'SEARCH'], ['F', 'FOLDER'], ['2', P2 ? 'PLAYER 2' : '2P JOIN']]];
    help.forEach((row, r) => row.forEach(([k, v], i) => {
      const x = 590 + i * 154, y = 652 + r * 27;
      g.fillStyle = 'rgba(48,62,86,0.92)'; g.beginPath(); g.roundRect ? g.roundRect(x, y - 12, 148, 24, 5) : g.rect(x, y - 12, 148, 24); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.5; g.stroke();
      text(k, x + 22, y, 11, '#ffe86a', 'center');
      text(v, x + 92, y, 14, '#fff', 'center');
    }));
    if (this.note && performance.now() - this.noteAt < 2000) text(this.note, 400, 620, 18, '#c00030', 'center');
    if (this.favOnly && this.typing === null && !this.query) {
      g.fillStyle = 'rgba(80,50,0,0.78)'; g.fillRect(212, 646, 368, 40);
      g.strokeStyle = '#ffd23c'; g.lineWidth = 2; g.strokeRect(212, 646, 368, 40);
      drawStar(234, 666, 11, '#ffd23c');
      text('FAVORITES', 254, 666, 20, '#fff');
      text(`${this.order.length} song${this.order.length === 1 ? '' : 's'}   W: show all`, 570, 666, 13, '#ffe9b0', 'right', 'normal');
    }
    if (this.typing !== null || this.query) {
      const on = this.typing !== null, q = on ? this.typing : this.query;
      g.fillStyle = on ? 'rgba(10,30,80,0.92)' : 'rgba(10,30,80,0.75)'; g.fillRect(212, 646, 368, 40);
      g.strokeStyle = on ? '#ffd23c' : 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.strokeRect(212, 646, 368, 40);
      text('SEARCH', 226, 666, 14, '#9fd8ff');
      text(q + (on && (t * 2 | 0) % 2 ? '_' : ''), 292, 666, 20, '#fff');
      const info = this.noMatch ? 'no match' : `${this.order.length} song${this.order.length === 1 ? '' : 's'}`;
      text(info, 570, 659, 13, this.noMatch ? '#ff9090' : '#cfe', 'right', 'normal');
      text(on ? 'Enter: done  Esc: clear' : 'S: change  Esc: clear', 570, 676, 11, '#9fb8d8', 'right', 'normal');
    }
    if (this.stage) this.drawStage(t);
    if (this.join) {
      const j = this.join, bh = 120 + j.list.length * 44;
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ff7aa8'; g.fillRect(440, 300 - bh / 2 - 8, 400, bh + 16);
      g.fillStyle = '#16307a'; g.fillRect(448, 300 - bh / 2, 384, bh);
      text('PLAYER 2', 640, 300 - bh / 2 + 36, 30, '#ffc0d8', 'center');
      j.list.forEach((name, i) => {
        const y = 300 - bh / 2 + 84 + i * 44, on = i === j.i;
        if (on) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(470, y - 19, 340, 38); }
        let label = name;
        if (name !== 'GUEST' && name !== '1 PLAYER ONLY') label += `   ${DATA.profiles[name].points || 0} pts`;
        text(label, 640, y, 22, on ? '#ffd23c' : '#fff', 'center');
      });
      text('Enter: choose    Esc: cancel', 640, 300 + bh / 2 - 22, 15, '#cfe', 'center', 'normal');
    }
  },
  // the 10 Replicant D-action medals (AA or better on each song); the current song's is ringed
  drawMedals(rda, t) {
    const got = medals(), x0 = 42, y0 = 420;
    g.fillStyle = rda >= 0 ? 'rgba(30,0,15,0.72)' : 'rgba(10,40,90,0.55)'; g.fillRect(x0 - 16, y0 - 34, 236, 158);
    text('REPLICANT D-ACTION', x0 + 102, y0 - 16, 15, rda >= 0 ? '#ffc4d4' : '#fff', 'center');
    RDA_COLORS.forEach((c, i) => {
      const x = x0 + 12 + (i % 5) * 44, y = y0 + 22 + Math.floor(i / 5) * 46;
      g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2);
      if (got[i]) {
        const gr = g.createRadialGradient(x - 5, y - 6, 2, x, y, 17);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, c); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
        g.fillStyle = gr; g.fill();
      } else { g.fillStyle = 'rgba(0,0,0,0.45)'; g.fill(); g.strokeStyle = c; g.globalAlpha = 0.45; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1; }
      if (i === rda) { g.beginPath(); g.arc(x, y, 21, 0, Math.PI * 2); g.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(t * 6)})`; g.lineWidth = 3; g.stroke(); }
    });
    text(`${got.filter(Boolean).length} / 10 medals   R: ${rda >= 0 ? 'back' : 'go there'}`, x0 + 102, y0 + 110, 13, rda >= 0 ? '#ffc4d4' : '#0d3770', 'center', 'normal');
  },
  // one of your custom folders: a folder shape with its name and how many songs are in it
  drawFolderTile(x, y, w, h, f) {
    const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#1fc27a'); gr.addColorStop(1, '#0a6e48');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    const fw = w * 0.62, fh = h * 0.38, fx = x + (w - fw) / 2, fy = y + h * 0.14;
    g.fillStyle = '#ffd65a'; g.fillRect(fx, fy, fw * 0.4, fh * 0.2); g.fillRect(fx, fy + fh * 0.14, fw, fh * 0.86);
    g.fillStyle = '#ffe89a'; g.fillRect(fx, fy + fh * 0.32, fw, fh * 0.68);
    const nm = f.folder.toUpperCase(), size = Math.max(10, Math.min(w * 0.16, w * 1.5 / Math.max(6, nm.length)));
    text(nm.length > 14 ? nm.slice(0, 13) + '…' : nm, x + w / 2, y + h * 0.7, Math.round(size), '#fff', 'center');
    text(f.count + (f.count === 1 ? ' song' : ' songs'), x + w / 2, y + h * 0.87, Math.round(w * 0.085), '#d6ffe9', 'center', 'normal');
  },
  drawRandomTile(x, y, w, h, t) {
    const P = A.pop || {};
    if (P.rainbow) g.drawImage(P.rainbow, x, y, w, h);
    else { const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#3cf'); gr.addColorStop(0.5, '#a3f'); gr.addColorStop(1, '#f3a'); g.fillStyle = gr; g.fillRect(x, y, w, h); }
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, y, w, h * 0.45);
    text('?', x + w / 2, y + h * 0.45, h * 0.5, `hsl(${(t * 90) % 360},100%,96%)`, 'center');
    text('RANDOM', x + w / 2, y + h * 0.84, Math.round(w * 0.15), '#fff', 'center');
  },
  // bare: draw onto the pop-up's own radar disc (cx, cy = the disc centre; names on its grey pills)
  drawRadar(song, cx, cy, sc, bare) {
    const panelImg = A.img.radarPanel && A.img.radarPanel[Select.hasBoth() ? 1 : 0];   // pink when the song has SHORT / FULL, else blue
    if (!panelImg && !bare) return;
    if (!bare) g.drawImage(panelImg, cx - 125 * sc, cy - 90 * sc, 250 * sc, 180 * sc);
    // radar bytes per difficulty: chaos, stream, voltage, air, freeze (checked against the real game)
    // Like the game, every difficulty is outlined in its colour; the selected one is filled.
    const ox = cx, oy = bare ? cy : cy + (103 - 90) * sc, R = bare ? 50 : 46 * sc;
    const slots = [[125, 37], [207, 77], [185, 162], [66, 162], [44, 77]];
    const RCOL = { 4: '#40e0ff', 1: '#ffe040', 2: '#ff50c8', 3: '#40f070', 6: '#c070ff' };
    const lv = levelsOf(song);
    const shape = r => {
      const vals = [r[1], r[0], r[4], r[3], r[2]];          // stream (top), chaos, freeze, air, voltage - clockwise
      g.beginPath();
      vals.forEach((v, k) => {
        const ang = -Math.PI / 2 + k * 2 * Math.PI / 5, rr = R * Math.min(1, Math.max(0.03, v / 100));
        const x = ox + Math.cos(ang) * rr, y = oy + Math.sin(ang) * rr;
        if (k) g.lineTo(x, y); else g.moveTo(x, y);
      });
      g.closePath();
    };
    const order = [['STREAM'], ['CHAOS'], ['FREEZE'], ['AIR'], ['VOLTAGE']];
    DIFFS.forEach(([d], i) => {
      const r = (song.radar || [])[i];
      if (!r || !(lv[i] > 0)) return;
      shape(r);
      if (d === S.diff) { g.fillStyle = RCOL[d] + '66'; g.fill(); g.lineWidth = 3; }
      else g.lineWidth = 1.5;
      g.strokeStyle = RCOL[d]; g.stroke();
    });
    order.forEach(([name], k) => {
      const [sx, sy] = slots[k];
      if (bare) { const [bx, by] = bare[k]; blit(A.img.radarNames && A.img.radarNames[name], bx, by, 0.75); }
      else blit(A.img.radarNames && A.img.radarNames[name], cx + (sx - 125) * sc, cy + (sy - 90) * sc, sc * 0.9);
    });
  },
};

// ---- options
const SPEEDS = []; for (let v = 0.25; v <= 8.001; v += 0.25) SPEEDS.push(+v.toFixed(2));
// The options screen, laid out like DDR II's: a grid of option buttons; each opens a page with a row per
// player (player options) or a list of settings, a CONFIRM button and a help line. Labels are the game's
// own pictures where it has one (big = button labels, small = row labels), else text.
const ON_OFF = [true, false], OFF_ON = [false, true];
const yesNo = v => v ? 'ON' : 'OFF';
const OPT_PAGES = [
  { big: 15, name: 'SPEED', help: 'How fast the arrows scroll up the screen.', player: { key: 'speed', values: SPEEDS, fmt: v => 'x' + (v % 1 === 0 ? v.toFixed(1) : v) } },
  { name: 'APPEARANCE', help: 'HIDDEN: arrows vanish near the top. SUDDEN: they appear late. STEALTH: you can\'t see them.', player: { key: 'appearance', values: ['visible', 'hidden', 'sudden', 'stealth'] } },
  { big: 12, name: 'ROTATE', help: 'Changes the direction of the steps (MIRROR, LEFT, RIGHT, or SHUFFLE at random).', player: { key: 'turn', values: ['off', 'mirror', 'left', 'right', 'shuffle'], fmt: v => v === 'off' ? 'NORMAL' : v.toUpperCase() } },
  { big: 0, name: 'ARROW', help: 'Arrow colours: RAINBOW (the game\'s default), RHYTHM (colour by note timing) or FLAT.', player: { key: 'colors', values: ['rainbow', 'rhythm', 'flat'] } },
  { big: 6, name: 'FREEZE ARROW', help: 'OFF turns freeze arrows into normal arrows.', player: { key: 'freezes', values: ON_OFF, fmt: yesNo } },
  { big: 11, name: 'JUMP', help: 'OFF leaves one arrow where two would be stepped at the same time.', player: { key: 'jump', values: ON_OFF, fmt: yesNo } },
  { big: 4, name: 'CUT', help: 'ON leaves out every step that isn\'t on a quarter-note beat.', player: { key: 'cut', values: OFF_ON, fmt: yesNo } },
  { big: 9, name: 'GUIDELINE', help: 'Shows a line across the arrows at every measure.', player: { key: 'guideline', values: OFF_ON, fmt: yesNo } },
  { big: 5, name: 'EVALUATION', help: 'Shows the judgment (MARVELOUS, PERFECT...) and the combo while you play.', player: { key: 'evaluation', values: ON_OFF, fmt: yesNo } },
  { name: 'MARVELOUS', help: 'ON uses the MARVELOUS judgment; OFF counts those steps as PERFECT.', player: { key: 'marvelous', values: ON_OFF, fmt: yesNo } },
  { name: 'N.G. COMBO', help: 'Whether letting go of a freeze arrow (N.G.) breaks your combo. The real DDR II keeps it (OFF).', player: { key: 'ngBreaksCombo', values: OFF_ON, fmt: yesNo } },
  { name: 'GAME OVER', help: 'NORMAL: the song ends when your Dance Gauge runs out. OFF: you can\'t fail.', player: { key: 'gauge', values: ['normal', 'no fail'], fmt: v => v === 'normal' ? 'NORMAL' : 'OFF' } },
  { big: 7, name: 'GAME PLAY', help: 'Style, how hard the Dance Gauge is, the announcer and song unlocks.', rows: [
    { name: 'STYLE', key: 'style', values: ['single', 'double'] },
    { small: 5, name: 'GAME LEVEL', key: 'gameLevel', values: ['easy', 'medium', 'hard', 'very hard'] },
    { small: 24, name: 'VOICE', key: 'voice', values: ON_OFF, fmt: yesNo },
    { name: 'FREEZE GUIDE', key: 'freezeGuide', values: ON_OFF, fmt: yesNo },
    { name: 'SONG UNLOCKS', key: 'unlocks', values: ['off', 'on'] },
  ] },
  { big: 8, name: 'GRAPHIC', help: 'Song videos, where they show, and the screen shape.', rows: [
    { small: 13, name: 'MOVIES', key: 'movies', values: ON_OFF, fmt: yesNo },
    { name: 'VIDEO SIZE', key: 'videoSize', values: ['wii', 'full'], fmt: v => v === 'wii' ? 'WII MONITOR' : 'FULL SCREEN' },
    { name: 'SCREEN', key: 'screen', values: ['wide', '4:3'], fmt: v => v === 'wide' ? '16:9' : '4:3' },
    { name: 'FULL SCREEN', action: 'fullscreen', fmt: () => 'F11' },
  ] },
  { big: 17, name: 'DANCE', help: 'The dancer on songs without a video, and your own dancer model (.glb / .gltf).', rows: [
    { small: 29, name: 'DANCER', key: 'dancer', values: ON_OFF, fmt: yesNo },
    { name: 'DANCER MODEL', action: 'model' },
  ] },
  { name: 'SOUND', help: 'Menu sounds and music, and the audio timing offset (raise it if arrows feel early).', rows: [
    { name: 'MENU SOUNDS', key: 'menuSounds', values: ON_OFF, fmt: yesNo },
    { name: 'MENU MUSIC', key: 'menuMusic', values: ON_OFF, fmt: yesNo },
    { small: 22, name: 'TIMING', key: 'offset', step: 5, min: -500, max: 500, fmt: v => (v > 0 ? '+' : '') + v + ' ms' },
  ] },
  { name: 'LIGHTS', help: 'Cabinet lights through an Ultimarc PAC Drive: a panel lights up while you step on it.', rows: [
    { name: 'LIGHTS', key: 'lights', values: ON_OFF, fmt: yesNo },
    { name: 'LIGHT TEST', action: 'lighttest', fmt: () => 'ENTER' },
    { name: 'PAC DRIVE DLL', action: 'pacdll', fmt: () => Options.lightMsg ? (Options.lightOk ? 'FOUND' : 'NOT FOUND') : 'ENTER' },
    { name: 'RESET PINS', action: 'lightreset', fmt: () => 'ENTER' },
  ].concat([1, 2, 3, 4].flatMap(pl => [['L', 'LEFT'], ['D', 'DOWN'], ['U', 'UP'], ['R', 'RIGHT']].map(([d, nm]) =>
    ({ name: 'P' + pl + ' ' + nm, light: 'P' + pl + d })))) },
  { name: 'CUSTOM SONGS', help: 'Make folders and import StepMania songs.', action: () => go(CustomSongs) },
  { name: 'PLAYER DATA', help: 'Pick, make or delete players.', action: () => go(Players) },
  { name: 'CONTROLS', help: 'Set up keys, dance mats and controllers.', action: () => go(Controls) },
  { name: 'DANCE MATS', help: 'Step on each mat so the game knows which mat is which player.', action: () => go(MatCheck.with(Options, false)) },
  { name: 'GAME FOLDER', help: 'Pick your Wii disc, an extracted DDR II folder, or ffmpeg.', action: () => go(Setup.with('')) },
];
const Options = {
  bgm: 'MU_BGM_FREE',
  i: 0, page: null, row: 0,
  enter() { this.page = null; this.modelMsg = ''; },
  cols: 3,
  // per-player value: player 0 = S (player 1's options); player 1 = player 2's own options
  pget(key, who) { return who ? p2Opts()[key] : S[key]; },
  pset(key, who, v) {
    if (!who) { S[key] = v; saveSettings(); return; }
    P2.opts = P2.opts || {}; P2.opts[key] = v;
    const prof = p2Profile();
    if (prof) { prof.opts = prof.opts || {}; prof.opts[key] = v; writeSave(); }
  },
  // rows on the open page: [{label, get(), change(d), action?}]
  rows() {
    const pg = OPT_PAGES[this.page];
    if (pg.player) {
      const p = pg.player, who = P2 ? [0, 1] : [0];
      return who.map(w => ({ small: 16 + w, name: 'PLAYER ' + (w + 1), sub: w === 0 ? DATA.current : (P2.name || 'GUEST'),
        get: () => (p.fmt || (v => String(v).toUpperCase()))(this.pget(p.key, w)),
        change: d => { const vs = p.values; let j = vs.indexOf(this.pget(p.key, w)); j = Math.max(0, Math.min(vs.length - 1, (j < 0 ? 0 : j) + d)); this.pset(p.key, w, vs[j]); } }));
    }
    return pg.rows.map(r => r.light ? ({ name: r.name,
      // which PAC Drive pin (output) lights this arrow: 1-16 on board 1, 17-32 on board 2... or OFF
      get: () => { const o = Lights.outputOf(r.light); return o ? 'PIN ' + (o > 16 ? (o - 1 >> 4) + 1 + '-' + ((o - 1 & 15) + 1) : o) : 'OFF'; },
      change: d => {
        const map = Object.assign({}, S.lightMap || {});
        let o = Lights.outputOf(r.light) + d;
        if (o < 0) o = 64; if (o > 64) o = 0;
        map[r.light] = o || -1;                 // -1 = no light
        S.lightMap = map; Lights.last = ''; saveSettings();
      },
      action: null,
    }) : ({ small: r.small, name: r.name,
      get: () => r.action === 'model' ? (S.dancerCustom && S.dancerModel ? S.dancerModel.split(/[\\/]/).pop().toUpperCase() : 'BUILT-IN')
                : r.action ? (r.fmt ? r.fmt() : '') : (r.fmt || (v => String(v).toUpperCase()))(S[r.key]),
      change: d => {
        if (r.action === 'model') { if (S.dancerModel) { S.dancerCustom = !S.dancerCustom; Dancer3D.useModel(S.dancerCustom ? '/api/dancermodel' : ''); saveSettings(); } return; }
        if (r.action) return;
        if (r.step) S[r.key] = Math.max(r.min, Math.min(r.max, (S[r.key] || 0) + d * r.step));
        else { const vs = r.values; let j = vs.indexOf(S[r.key]); j = Math.max(0, Math.min(vs.length - 1, (j < 0 ? 0 : j) + d)); S[r.key] = vs[j]; }
        if (r.key === 'screen') fit();
        if (r.key === 'menuMusic') { Bgm.cur = undefined; Bgm.want(this.bgm); }
        saveSettings();
      },
      action: r.action === 'fullscreen' ? () => toggleFullscreen() : r.action === 'model' ? () => this.pickModel()
            : r.action === 'lighttest' ? () => this.lightCall({ start: true }, true)
            : r.action === 'pacdll' ? () => this.lightCall({ pick: true })
            : r.action === 'lightreset' ? () => { S.lightMap = null; saveSettings(); Lights.last = ''; this.lightMsg = 'Pins back to: P1 L D U R on 1-4, P2 on 5-8, P3 on 9-12, P4 on 13-16.'; } : null }));
  },
  async lightCall(body, test) {
    this.lightMsg = 'Working...';
    try { const r = await api('/api/lights', body); this.lightOk = r.ok; this.lightMsg = r.msg; } catch (e) { this.lightMsg = String(e); }
    if (test) { Lights.last = ''; Lights.test = performance.now(); if (this.lightOk) this.lightMsg += '  Lighting outputs 1 to 16 in turn...'; }
  },
  input(a, p) {
    if (!p) return;
    const dir = /^P[1-4]([LDUR])$/.exec(a);
    const d = dir ? dir[1] : null;
    if (this.page === null) {                                // the grid of options
      const n = OPT_PAGES.length, c = this.cols;
      if (d === 'L') this.i = (this.i + n - 1) % n;
      else if (d === 'R') this.i = (this.i + 1) % n;
      else if (d === 'U') this.i = this.i - c >= 0 ? this.i - c : this.i + c * Math.floor((n - 1 - this.i) / c);
      else if (d === 'D') this.i = this.i + c < n ? this.i + c : this.i % c;
      else if (a === 'START') {
        const pg = OPT_PAGES[this.i];
        sfx('SE_SYS_DECIDE02');
        if (pg.action) { saveSettings(); pg.action(); }
        else { this.page = this.i; this.row = 0; this.modelMsg = ''; }
        return;
      } else if (a === 'BACK' || a === 'OPTIONS') { sfx('SE_SYS_WINDOWOUT'); saveSettings(); go(Select); return; }
      else return;
      sfx('SE_SYS_SELECT01');
      return;
    }
    const rows = this.rows(), n = rows.length + 1;            // + CONFIRM
    if (d === 'U') { this.row = (this.row + n - 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (d === 'D') { this.row = (this.row + 1) % n; sfx('SE_SYS_SELECT01'); }
    else if ((d === 'L' || d === 'R') && this.row < rows.length) { rows[this.row].change(d === 'L' ? -1 : 1); sfx('SE_SYS_SELECT02'); }
    else if (a === 'START') {
      if (this.row < rows.length && rows[this.row].action) { rows[this.row].action(); return; }
      sfx('SE_SYS_DECIDE01'); this.page = null;           // CONFIRM: back to the grid (changes are already kept)
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.page = null; }
  },
  async pickModel() {
    this.modelMsg = 'A file window should open (it may be behind the browser)...';
    try {
      const r = await api('/api/dancermodel', { pick: true });
      if (r.ok && r.path) {
        S.dancerModel = r.path; S.dancerCustom = true; saveSettings();
        this.modelMsg = 'Loading model...';
        await Dancer3D.useModel('/api/dancermodel?v=' + Date.now());
        this.modelMsg = Dancer3D.customErr ? 'Could not use that model: ' + Dancer3D.customErr : 'Using ' + r.path.split(/[\\/]/).pop();
      } else this.modelMsg = 'No model chosen.';
    } catch (e) { this.modelMsg = String(e.message || e); }
  },
  // a label: the game's picture if it has one, else bold text in the same style
  label(img, name, x, y, h, color = '#14306e', align = 'center') {
    if (img) {
      const s = h / img.height, w = img.width * s;
      g.drawImage(img, align === 'center' ? x - w / 2 : x, y - h / 2, w, h);
      return;
    }
    g.save();
    g.font = `bold ${Math.round(h * 1.15)}px "Segoe UI", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
    g.lineWidth = 4; g.strokeStyle = color === '#fff' ? '#14306e' : '#fff'; g.strokeText(name, x, y);
    g.fillStyle = color; g.fillText(name, x, y);
    g.restore();
  },
  frame(t) {
    menuBackground(t);
    g.fillStyle = 'rgba(10,60,160,0.28)'; g.fillRect(0, 0, W, H);
    MenuDancers.draw(t, [[1010, 780, 860, 0.55, 0, false], [250, 760, 700, 0.4, 3, true]]);
    const O = A.opt || {};
    // header: OPTIONS, and a tab naming the open option
    if (O.header) g.drawImage(O.header, -20, 6, 460, 62); else { g.fillStyle = '#2a7fd6'; g.fillRect(0, 6, 440, 62); }
    this.label(O.title, 'OPTIONS', 214, 37, 24, '#fff');
    const pg = this.page === null ? null : OPT_PAGES[this.page];
    if (pg) {
      if (O.tab) g.drawImage(O.tab, 470, 14, 330, 48); else { g.fillStyle = '#2a7fd6'; g.fillRect(470, 14, 330, 48); }
      this.label(pg.big !== undefined && O.big ? O.big[pg.big] : null, pg.name, 635, 38, 18);
    }
    if (DATA.current) text('PLAYER: ' + DATA.current + (P2 ? '   2P: ' + (P2.name || 'GUEST') : ''), W - 30, 38, 18, '#0d3770', 'right');
  },
  helpBox(msg) {
    g.fillStyle = 'rgba(20,70,170,0.85)'; g.fillRect(120, 596, 1040, 62);
    g.strokeStyle = 'rgba(200,240,255,0.9)'; g.lineWidth = 2; g.strokeRect(120, 596, 1040, 62);
    text(msg, 146, 627, 19, '#fff', 'left', 'normal');
  },
  draw(t) {
    this.frame(t);
    const O = A.opt || {};
    if (this.page === null) {
      // the grid of option buttons
      const c = this.cols, bw = 330, bh = 56, gx = 120 + (1040 - c * bw - (c - 1) * 25) / 2, rowsVis = 7;
      const r0 = Math.max(0, Math.min(Math.ceil(OPT_PAGES.length / c) - rowsVis, Math.floor(this.i / c) - 3));
      OPT_PAGES.forEach((pg, i) => {
        const r = Math.floor(i / c) - r0;
        if (r < 0 || r >= rowsVis) return;
        const x = gx + (i % c) * (bw + 25), y = 92 + r * 70, on = i === this.i;
        const im = on ? O.btnOn : O.btn;
        if (im) g.drawImage(im, x, y, bw, bh); else { g.fillStyle = on ? '#ff8a1e' : '#1e6fe0'; g.fillRect(x, y, bw, bh); }
        if (on) { g.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(t * 7)})`; g.lineWidth = 3; g.strokeRect(x - 2, y - 2, bw + 4, bh + 4); }
        this.label(pg.big !== undefined && O.big ? O.big[pg.big] : null, pg.name, x + bw / 2, y + bh / 2, 20, pg.big !== undefined ? '#14306e' : '#fff');
      });
      this.helpBox(OPT_PAGES[this.i].help);
      text('Arrows: choose    Enter: open    Esc: back to song select', W / 2, 690, 16, '#0d3770', 'center', 'normal');
      return;
    }
    // one option's page, like the game: each row is one cyan bar with the label on the left and the value
    // in the bar's own dark slot on the right (slot = x 284-524, y 7-37 of the 530 x 42 bar); then CONFIRM
    const rows = this.rows(), bw = 780, bh = 62, x0 = W / 2 - bw / 2, y0 = 112, rh = 74;
    const sx = bw / 530, sy = bh / 42, slotL = x0 + 284 * sx, slotR = x0 + 524 * sx, slotT = 7 * sy, slotH = 30 * sy;
    // long pages scroll: at most 6 lines on screen (CONFIRM counts as one)
    const vis = 6, top = Math.max(0, Math.min(rows.length + 1 - vis, this.row - 2));
    if (top > 0) text('▲', W / 2, y0 - 22, 18, '#0d3770', 'center');
    if (top + vis < rows.length + 1) text('▼', W / 2, y0 + vis * rh - 6, 18, '#0d3770', 'center');
    rows.forEach((r, k) => {
      if (k < top || k >= top + vis) return;
      const y = y0 + (k - top) * rh, on = k === this.row;
      if (on) { g.fillStyle = '#ff8a1e'; g.beginPath(); g.roundRect ? g.roundRect(x0 - 7, y - 7, bw + 14, bh + 14, 10) : g.rect(x0 - 7, y - 7, bw + 14, bh + 14); g.fill(); }
      if (O.rowBar) g.drawImage(O.rowBar, x0, y, bw, bh); else { g.fillStyle = '#7fe0ff'; g.fillRect(x0, y, bw, bh); }
      if (O.valBar) g.drawImage(O.valBar, slotL, y + slotT, slotR - slotL, slotH); else { g.fillStyle = '#10307a'; g.fillRect(slotL, y + slotT, slotR - slotL, slotH); }
      const lx = x0 + 142 * sx;                                   // the label, centred on the bar's left part
      this.label(r.small !== undefined && O.small ? O.small[r.small] : null, r.name, lx, y + bh / 2 - (r.sub ? 7 : 0), 18, '#fff');
      if (r.sub) text(r.sub, lx, y + bh / 2 + 17, 12, '#14306e', 'center', 'normal');
      // the value in gold, like the game's
      g.save(); g.font = 'bold 26px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 4; g.strokeStyle = '#3a2400'; g.strokeText(r.get(), (slotL + slotR) / 2, y + slotT + slotH / 2 + 1);
      g.fillStyle = '#ffd23c'; g.fillText(r.get(), (slotL + slotR) / 2, y + slotT + slotH / 2 + 1); g.restore();
      if (on) {
        const bob = Math.sin(t * 8) * 2, ay = y + slotT + slotH / 2, s = slotH / (O.arrow ? O.arrow.height : 40) * 1.05;
        if (O.arrow) {
          g.save(); g.translate(slotL + 4 - bob, ay); g.scale(-s, s); g.drawImage(O.arrow, -O.arrow.width / 2, -O.arrow.height / 2); g.restore();
          g.save(); g.translate(slotR + 18 + bob, ay); g.scale(s, s); g.drawImage(O.arrow, -O.arrow.width / 2, -O.arrow.height / 2); g.restore();
        } else { text('<', slotL + 4 - bob, ay, 28, '#ff40c0', 'center'); text('>', slotR + 18 + bob, ay, 28, '#ff40c0', 'center'); }
      }
    });
    // CONFIRM: a short cyan bar under the rows, the word in pink
    const cy = y0 + (rows.length - top) * rh, cOn = this.row === rows.length, cw = bw * 0.55, cShow = rows.length < top + vis;
    if (cShow) {
    if (cOn) { g.fillStyle = '#ff8a1e'; g.beginPath(); g.roundRect ? g.roundRect(x0 - 7, cy - 7, cw + 14, bh + 14, 10) : g.rect(x0 - 7, cy - 7, cw + 14, bh + 14); g.fill(); }
    if (O.cyanBar) g.drawImage(O.cyanBar, x0, cy, cw, bh); else { g.fillStyle = '#7fe0ff'; g.fillRect(x0, cy, cw, bh); }
    this.label(O.confirm, 'CONFIRM', x0 + cw / 2, cy + bh / 2, 22, '#ff3ca0');
    }
    const pg = OPT_PAGES[this.page];
    const row = rows[this.row];
    let help = cOn ? 'Keep these settings and go back.' : pg.help;
    if (row && pg.rows && pg.rows[this.row] && pg.rows[this.row].action === 'model') help = this.modelMsg || 'Enter: pick a .glb / .gltf model.  Left/Right: built-in dancer or your model.';
    if (row && pg.rows && pg.rows[this.row] && /lighttest|pacdll/.test(pg.rows[this.row].action || '')) help = this.lightMsg || 'P1 arrows light outputs 1-4 (L D U R), P2 5-8, P3 9-12, P4 13-16. Enter: test / pick the DLL.';
    if (row && pg.rows && pg.rows[this.row] && pg.rows[this.row].light) help = 'Left/Right: pick the PAC Drive pin for this arrow (the chosen pin lights up). OFF: no light. Pins past 16 are on a 2nd board.';
    if (row && pg.rows && pg.rows[this.row] && pg.rows[this.row].action === 'lightreset') help = this.lightMsg || 'Enter: put every arrow back on the standard pins.';
    this.helpBox(help);
    text('Up/Down: choose    Left/Right: change    Enter: confirm    Esc: back', W / 2, 690, 16, '#0d3770', 'center', 'normal');
  },
};

// ---- controls
const Controls = {
  bgm: 'MU_BGM_FREE',
  i: 0, waiting: false, msg: '',
  input(a, p, t, menuKey) {
    if (!p || this.waiting) return;
    if (a === 'P1U') this.i = (this.i + ACTIONS.length) % (ACTIONS.length + 1);
    else if (a === 'P1D') this.i = (this.i + 1) % (ACTIONS.length + 1);
    else if (a === 'START') {
      if (this.i === ACTIONS.length) { go(Options); return; }
      this.waiting = true; this.msg = 'Press the key, button or panel for ' + ACTIONS[this.i][1] + '  (wait 5 s to cancel)';
      const act = ACTIONS[this.i][0];
      const timer = setTimeout(() => { input.capture = null; this.waiting = false; this.msg = 'Cancelled.'; }, 5000);
      input.capture = b => {
        clearTimeout(timer);
        const list = input.bindings[act] || (input.bindings[act] = []);
        if (!list.some(x => Input.id(x) === Input.id(b))) list.push(b);
        S.bindings = input.bindings; saveSettings();
        this.waiting = false; this.msg = 'Added ' + bindName(b) + ' to ' + ACTIONS[this.i][1];
      };
    } else if (a === 'OPTIONS') {
      if (this.i < ACTIONS.length) {
        const act = ACTIONS[this.i][0];
        input.bindings[act] = [];
        S.bindings = input.bindings; saveSettings();
        this.msg = 'Cleared ' + ACTIONS[this.i][1];
      }
    } else if (a === 'BACK') { sfx('SE_SYS_CANCEL'); go(Options); }
  },
  key(e) {
    if (this.waiting) return;
    if (e.code === 'Delete' && this.i < ACTIONS.length) { this.input('OPTIONS', true); }
    if (e.code === 'KeyR' && e.ctrlKey) { e.preventDefault(); input.setBindings(null); S.bindings = null; saveSettings(); this.msg = 'Reset to defaults.'; }
  },
  draw(t) {
    menuBackground(t);
    text('CONTROLS', 40, 40, 34);
    panel(140, 80, 1000, 580);
    const rows = 12, top = Math.max(0, Math.min(ACTIONS.length + 1 - rows, this.i - 6));
    if (top > 0) text('\u25b2', 640, 90, 16, '#fff', 'center');
    if (top + rows < ACTIONS.length + 1) text('\u25bc', 640, 600, 16, '#fff', 'center');
    ACTIONS.forEach(([act, name], i) => {
      if (i < top || i >= top + rows) return;
      const y = 115 + (i - top) * 40, on = i === this.i;
      if (on) { g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(150, y - 20, 980, 40); }
      text(name, 180, y, 24, on ? '#ffd23c' : '#fff');
      const list = (input.bindings[act] || []).map(bindName).join(',  ') || '(none)';
      text(list.slice(0, 70), 420, y, 20, '#9fe', 'left', 'normal');
    });
    const y = 115 + (ACTIONS.length - top) * 40, on = this.i === ACTIONS.length;
    if (ACTIONS.length < top + rows) {
      if (on) { g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(150, y - 20, 980, 40); }
      text('Done', 180, y, 24, on ? '#ffd23c' : '#fff');
    }
    if (this.msg) text(this.msg, W / 2, 625, 20, this.waiting ? '#ffd23c' : '#cfe', 'center', 'normal');
    text('Enter: add a binding   Tab or Delete: clear   Ctrl+R: reset all   Esc: back   (arrow keys/Enter/Esc always work in menus)',
         W / 2, 690, 16, '#789', 'center', 'normal');
  },
};


// ---- custom songs: your own folders ("Rock", "Anime"...) of StepMania songs
const CustomSongs = {
  bgm: 'MU_BGM_FREE',
  folder: null, i: 0, typing: null, confirm: null, msg: '', busy: false,
  enter() { this.folder = null; this.i = 0; this.typing = null; this.confirm = null; this.msg = ''; this.refresh(); },
  async refresh() {
    try { const c = await api('/api/custom/songs'); this.folders = c.folders || []; this.songs = c.songs || []; }
    catch (e) { this.folders = []; this.songs = []; this.msg = 'Could not read the Custom Songs folder.'; }
  },
  async leave() { SONGS = await loadSongs(); },        // song select picks up the changes
  rows() {
    if (this.folder === null) return (this.folders || []).map(f => ({ kind: 'folder', name: f })).concat([{ kind: 'new', name: '+ NEW FOLDER' }]);
    const list = (this.songs || []).filter(s => s.folder === this.folder).sort((a, b) => a.name.localeCompare(b.name));
    return [{ kind: 'files', name: '+ IMPORT SONGS (.sm / .ssc files)' }, { kind: 'pack', name: '+ IMPORT A FOLDER OF SONGS' }]
      .concat(list.map(s => ({ kind: 'song', name: s.name, song: s })), [{ kind: 'delfolder', name: '- DELETE THIS FOLDER' }]);
  },
  async post(body) {
    this.busy = true;
    try { return await api('/api/custom', body); } finally { this.busy = false; await this.refresh(); }
  },
  async input(a, p) {
    if (!p || this.typing !== null || this.busy) return;
    const rows = this.rows(), r = rows[this.i];
    if (this.confirm) {
      const c = this.confirm; this.confirm = null;
      if (a !== 'START') return;
      if (c.kind === 'folder') { await this.post({ delete: c.name }); this.msg = 'Deleted the ' + c.name + ' folder.'; this.i = 0; this.folder = null; if (Select.inFolder === c.name) Select.inFolder = null; }
      else { await this.post({ remove: c.song.slot }); this.msg = 'Removed ' + c.song.name + '.'; this.i = Math.max(0, this.i - 1); }
      return;
    }
    if (/^P[12]U$/.test(a)) { this.i = (this.i + rows.length - 1) % rows.length; sfx('SE_SYS_SELECT01'); }
    else if (/^P[12]D$/.test(a)) { this.i = (this.i + 1) % rows.length; sfx('SE_SYS_SELECT01'); }
    else if (a === 'START' && r) {
      sfx('SE_SYS_DECIDE01');
      if (r.kind === 'new') { this.typing = ''; this.msg = ''; }
      else if (r.kind === 'delfolder') { this.confirm = { kind: 'folder', name: this.folder }; }
      else if (r.kind === 'folder') { this.folder = r.name; this.i = 0; this.msg = ''; }
      else if (r.kind === 'files' || r.kind === 'pack') {
        this.msg = 'A window should open (it may be behind the browser)...';
        const res = await this.post({ import: this.folder, pick: r.kind === 'pack' ? 'folder' : 'files' });
        if (!res.ok) this.msg = res.error || 'Nothing imported.';
        else this.msg = `Imported ${res.added.length} song${res.added.length === 1 ? '' : 's'}` + (res.skipped.length ? ` (${res.skipped.length} already here)` : '') + '.'
                      + (res.noVideo ? `  ${res.noVideo} old-format video${res.noVideo === 1 ? '' : 's'} skipped (install ffmpeg to convert them).` : '');
      }
    } else if (a === 'OPTIONS' && r && (r.kind === 'folder' || r.kind === 'song')) { this.confirm = r; }
    else if (a === 'BACK') {
      sfx('SE_SYS_WINDOWOUT');
      if (this.folder !== null) { const f = this.folder; this.folder = null; this.i = Math.max(0, (this.folders || []).indexOf(f)); }
      else go(Options);
    }
  },
  key(e) {
    if (this.typing === null) return;
    e.preventDefault();
    if (e.code === 'Escape') { this.typing = null; return; }
    if (e.code === 'Backspace') { this.typing = this.typing.slice(0, -1); return; }
    if (e.code === 'Enter') {
      const name = this.typing.trim();
      if (!name) return;
      this.typing = null;
      this.post({ create: name }).then(r => {
        if (!r.ok) { this.msg = r.error || 'Could not make that folder.'; return; }
        this.folder = r.folder; this.i = 0; this.msg = 'Made the ' + r.folder + ' folder. Now import some songs.';
      });
      return;
    }
    if (e.key.length === 1 && /[A-Za-z0-9 &'!().,_+-]/.test(e.key) && this.typing.length < 24) this.typing += e.key;
  },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text(this.folder === null ? 'CUSTOM SONGS' : this.folder.toUpperCase(), 210, 44, 30, '#fff', 'center');
    panel(240, 100, 800, 540);
    if (this.typing !== null) {
      text('NEW FOLDER', 640, 170, 30, '#ffd23c', 'center');
      text('Type a name (like Rock or Anime), then press Enter', 640, 225, 20, '#fff', 'center', 'normal');
      g.fillStyle = 'rgba(0,20,70,0.85)'; g.fillRect(400, 270, 480, 66);
      text(this.typing + ((t * 2 | 0) % 2 ? '_' : ' '), 640, 303, 34, '#fff', 'center');
      text('Esc: cancel', 640, 380, 18, '#cfe', 'center', 'normal');
      return;
    }
    const rows = this.rows(), n = 10, top = Math.max(0, Math.min(rows.length - n, this.i - 5));
    if (this.folder === null && !(this.folders || []).length) text('No folders yet. Make one, then import songs into it.', 640, 150, 20, '#fff', 'center', 'normal');
    rows.slice(top, top + n).forEach((r, k) => {
      const i = top + k, y = (this.folder === null && !(this.folders || []).length ? 200 : 140) + k * 46, on = i === this.i;
      if (on) { g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(270, y - 20, 740, 40); }
      const col = r.kind === 'song' || r.kind === 'folder' ? '#fff' : '#9fffd0';
      text(r.name.slice(0, 44), 300, y, 24, on ? '#ffd23c' : col);
      if (r.kind === 'folder') {
        const cnt = (this.songs || []).filter(s => s.folder === r.name).length;
        text(cnt + (cnt === 1 ? ' song' : ' songs'), 980, y, 18, '#dff', 'right', 'normal');
      } else if (r.kind === 'song') {
        const lv = r.song.single.map((v, j) => v ? DIFFS[j][1][0] + v : '').filter(Boolean).join(' ');
        text(lv, 980, y, 15, '#dff', 'right', 'normal');
      }
    });
    if (this.confirm) {
      g.fillStyle = 'rgba(80,0,20,0.94)'; g.fillRect(360, 300, 560, 120);
      const what = this.confirm.kind === 'folder' ? `Delete the ${this.confirm.name} folder and its songs?` : `Remove ${this.confirm.song.name.slice(0, 30)}?`;
      text(what, 640, 340, 22, '#fff', 'center');
      text('(only DDR II PC\'s copy - your original files stay)   Enter: yes   other: no', 640, 380, 15, '#fcc', 'center', 'normal');
    }
    if (this.busy) text('Working...', 640, 610, 20, '#0d3770', 'center');
    else if (this.msg) text(this.msg, 640, 610, 20, '#0d3770', 'center');
    text(this.folder === null ? 'Enter: open / new folder    Tab: delete folder    Esc: back'
                              : 'Enter: import    Tab: remove song    Esc: back to folders', 640, 690, 17, '#0d3770', 'center', 'normal');
  },
};

// ---- how freeze arrows work (shown before a BEGINNER song that has them)
const Explain = {
  seen: new Set(),
  with(next) { this.next = next; return this; },
  enter() { this.t0 = performance.now(); sfx('SE_SYS_WINDOWIN'); },
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_DECIDE01'); go(this.next); } },
  draw(t) {
    // laid out like the game's: header, the title on the left, the step zone with two freeze arrows
    // on the right with labels pointing at them, and the instruction under it
    // a dark backdrop with big concentric rings
    const bg = g.createRadialGradient(640, 380, 40, 640, 380, 760);
    bg.addColorStop(0, '#2a3b52'); bg.addColorStop(0.5, '#162436'); bg.addColorStop(1, '#070d16');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (const [r, w, c] of [[90, 18, 'rgba(60,140,220,0.35)'], [170, 10, 'rgba(0,0,0,0.45)'], [250, 26, 'rgba(255,255,255,0.05)'], [340, 8, 'rgba(0,0,0,0.5)'], [430, 30, 'rgba(255,255,255,0.04)'], [540, 12, 'rgba(0,0,0,0.45)']]) {
      g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.arc(640, 380, r, 0, Math.PI * 2); g.stroke();
    }
    const hx = 330, hw = 620;
    g.fillStyle = 'rgba(90,100,120,0.9)'; g.fillRect(hx - 8, -10, hw + 16, 82);
    const hg = g.createLinearGradient(0, 0, 0, 62);
    hg.addColorStop(0, '#9fd8ff'); hg.addColorStop(0.5, '#3d9ef0'); hg.addColorStop(1, '#1f6fd0');
    g.fillStyle = hg; g.fillRect(hx, -4, hw, 66);
    g.strokeStyle = '#0d3f9a'; g.lineWidth = 3; g.strokeRect(hx, -4, hw, 66);
    text('Explanation of Freeze Arrow', 640, 29, 34, '#fff', 'center');
    const title = (str, x, y, size, col) => {
      g.font = `bold ${size}px Georgia, serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.strokeStyle = '#5a1000'; g.lineWidth = size / 5; g.strokeText(str, x, y);
      g.fillStyle = col; g.fillText(str, x, y);
    };
    const og = g.createLinearGradient(0, 85, 0, 125); og.addColorStop(0, '#ffe24a'); og.addColorStop(1, '#ff6a00');
    title('Freeze Arrow', 190, 105, 40, og);
    // the step zone (4 lanes) with freeze arrows on left and right
    const size = 76, lx = [574, 646, 718, 790], ry = 118;
    lx.forEach((x, l) => { if (A.arrowGrey && A.arrowGrey[0][l]) g.drawImage(A.arrowGrey[0][l], x - size / 2, ry - size / 2, size, size); });
    const t1 = performance.now() / 1000;
    [[0, 395], [3, 410]].forEach(([l, end]) => {
      const fz = A.freezeOn && A.freezeOn[l], y = ry + 42 + Math.sin(t1 * 2 + l) * 2;
      if (fz && fz.body) Dancer.prototype.drawFreeze(fz, lx[l], y, end, size, false);
      else { g.fillStyle = '#9fe05a'; g.fillRect(lx[l] - 30, y, 60, end - y); }
      if (fz && fz.head) g.drawImage(fz.head, lx[l] - size / 2, y - size / 2, size, size);
    });
    // red labels with arrows pointing at the freeze arrows
    const callout = (x, y, pts) => {
      g.font = 'bold 26px Georgia, serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeText('Freeze Arrow', x, y);
      g.fillStyle = '#e8101a'; g.fillText('Freeze Arrow', x, y);
      g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke();
      g.strokeStyle = '#e8101a'; g.lineWidth = 3; g.stroke();
      const [ax, ay] = pts[pts.length - 1], [bx, by] = pts[pts.length - 2], an = Math.atan2(ay - by, ax - bx);
      g.fillStyle = '#e8101a'; g.beginPath(); g.moveTo(ax + Math.cos(an) * 6, ay + Math.sin(an) * 6);
      g.lineTo(ax + Math.cos(an + 2.6) * 16, ay + Math.sin(an + 2.6) * 16); g.lineTo(ax + Math.cos(an - 2.6) * 16, ay + Math.sin(an - 2.6) * 16); g.fill();
    };
    callout(330, 182, [[330, 192], [540, 192]]);
    callout(510, 262, [[510, 272], [720, 272], [770, 222]]);
    // the instruction, with a blue arrow beside it
    ['When a Freeze Arrow appears,', 'press and hold down the', 'corresponding button.'].forEach((ln, i) =>
      text(ln, 190, 440 + i * 38, 28, '#fff', 'left'));
    const blue = A.arrow && A.arrow('#3cb4ff', 0, 0); if (blue) g.drawImage(blue, 545, 448, 66, 66);
    // what happens next (this game's own note)
    text('Held to the end: O.K.     Let go too soon: N.G. (the Dance Gauge drops)', 190, 580, 18, '#cfe8ff', 'left', 'normal');
    // after a moment the prompt to go on appears
    if (performance.now() - this.t0 > 1500) {
      const a = 0.65 + 0.35 * Math.sin(performance.now() / 250);
      g.globalAlpha = a; g.fillStyle = '#36c24a'; g.beginPath(); g.arc(1086, 676, 10, 0, Math.PI * 2); g.fill();
      text("Let's dance!", 1104, 677, 20, '#ffe86a', 'left'); g.globalAlpha = 1;
      text('Enter', 1086, 652, 12, '#cfe8ff', 'center', 'normal');
    }
  },
};

// ---- dance mat check: step on each mat so the game knows which mat is which player
const MatCheck = {
  bgm: 'MU_BGM_FREE',
  // the mats to find, in order. game = a VERSUS game is about to start (else: from Options)
  rolesFor(game) {
    const dbl = styleNow() === 'double';
    let list;
    if (game && dbl) list = [['P1', 'PLAYER 1', 'LEFT mat'], ['P2', 'PLAYER 1', 'RIGHT mat'], ['P3', 'PLAYER 2', 'LEFT mat'], ['P4', 'PLAYER 2', 'RIGHT mat']];
    else if (game) list = [['P1', 'PLAYER 1', 'mat'], ['P2', 'PLAYER 2', 'mat']];
    else list = [['P1', 'P1 arrows', 'mat'], ['P2', 'P2 arrows', 'mat'], ['P3', 'P3 arrows', 'mat'], ['P4', 'P4 arrows', 'mat']];
    const seen = new Set(), out = [];
    for (const [k, who, what] of list) {
      const pad = input.padOf(k);
      if (pad === null || seen.has(pad)) continue;       // on keys, or the same device as an earlier mat
      seen.add(pad); out.push({ k, who, what, pad });
    }
    return out;
  },
  with(next, game) { this.next = next; this.game = game; return this; },
  enter() {
    this.roles = this.rolesFor(this.game);
    this.i = 0; this.map = {}; this.msg = ''; this.doneAt = 0;
    if (!this.roles.length) { this.msg = 'No dance mats are mapped yet. Map them in Options > Controls first.'; return; }
    input.padWatch = real => this.found(real);
  },
  leave() { input.padWatch = null; },
  found(real) {
    if (this.doneAt) return;
    if (real in this.map) { this.msg = 'That mat is already ' + this.labelOf(this.map[real]) + '. Step on the next one.'; sfx('SE_SYS_ERROR'); return; }
    this.map[real] = this.roles[this.i].pad;
    this.msg = ''; sfx('SE_SYS_DECIDE01');
    if (++this.i >= this.roles.length) {
      input.padWatch = null; input.setPadMap(this.map);
      this.doneAt = performance.now();
    }
  },
  labelOf(pad) { const r = this.roles.find(r => r.pad === pad); return r ? `${r.who}'s ${r.what}` : 'taken'; },
  update() { if (this.doneAt && performance.now() - this.doneAt > 700) go(this.next); },
  input(a, p, t, menuKey) {
    if (!p) return;
    if (a === 'BACK' && !this.doneAt) { sfx('SE_SYS_WINDOWOUT'); input.matsChecked = true; input.padsChanged = false; go(this.next); }   // keep the mats as they are
  },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('DANCE MATS', 210, 44, 34, '#fff', 'center');
    panel(240, 110, 800, 500);
    if (!this.roles.length) { text(this.msg, 640, 340, 22, '#fff', 'center', 'normal'); text('Esc: back', 640, 560, 18, '#cfe', 'center', 'normal'); return; }
    const r = this.roles[Math.min(this.i, this.roles.length - 1)];
    if (this.doneAt) text('All mats ready!', 640, 200, 40, '#ffd23c', 'center');
    else {
      text(r.who, 640, 175, 40, r.who.startsWith('PLAYER 2') ? '#ff8ab8' : '#7fd8ff', 'center');
      text('Step on your ' + r.what, 640, 230, 32, '#fff', 'center');
      text('(any arrow)', 640, 268, 18, '#cfe', 'center', 'normal');
    }
    this.roles.forEach((x, i) => {
      const y = 330 + i * 46, done = i < this.i, on = i === this.i && !this.doneAt;
      if (on) { g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(380, y - 20, 520, 40); }
      text(`${x.who}  ${x.what}`, 410, y, 24, on ? '#ffd23c' : '#fff');
      text(done ? 'OK' : on && (t * 2 | 0) % 2 ? '...' : '', 870, y, 24, '#7f7', 'right');
    });
    if (this.msg) text(this.msg, 640, 540, 18, '#ffd0d0', 'center', 'normal');
    text('Esc: skip (keep the mats as they are)', 640, 585, 16, '#cfe', 'center', 'normal');
  },
};

// a custom song's music, decoded by the browser (ogg / mp3 / wav ...)
async function customAudio(song) {
  return audio().decodeAudioData(await bin('/api/custom/audio/' + song.slot));
}
// the song's sample section (SAMPLESTART / SAMPLELENGTH) as its own buffer, for song select
async function customPreview(song) {
  const full = await customAudio(song), sr = full.sampleRate;
  const [st, len] = song.sample || [30, 12];
  const a = Math.max(0, Math.min(full.length - 1, Math.floor(st * sr))), n = Math.max(1, Math.min(full.length - a, Math.floor((len || 12) * sr)));
  const out = audio().createBuffer(full.numberOfChannels, n, sr);
  for (let c = 0; c < full.numberOfChannels; c++) out.copyToChannel(full.getChannelData(c).subarray(a, a + n), c);
  return out;
}

// ---- loading
const Loading = {
  song: null, msg: '', err: '',
  with(song) { this.song = song; return this; },
  async enter() {
    this.msg = 'Loading...'; this.err = '';
    const song = this.song;
    try {
      const [chartBuf, audioBuf, dance] = await Promise.all([
        song.custom ? api('/api/custom/chart/' + song.slot) : bin('/api/chart/' + song.slot),
        song.custom ? customAudio(song) : bin('/api/audio/' + song.slot),
        S.dancer && window.Dancer3D ? api('/api/dance/' + danceNo(song)).catch(() => null) : null]);
      this.dance = dance;
      this.msg = 'Decoding...';
      await new Promise(r => setTimeout(r, 20));
      const ss4 = song.custom ? chartBuf : DDR.parseSS4(chartBuf);      // custom charts come already in the game's shape
      const charts = [{ diff: S.diff, o: S, prof: DATA.profiles[DATA.current] || null, name: DATA.current || 'PLAYER' }];
      if (P2) charts.push({ diff: P2.diff, o: p2Opts(), prof: p2Profile(), name: P2.name || 'GUEST' });
      for (const c of charts) {
        c.built = DDR.buildNotes(ss4, chartKey(c.diff));
        if (!c.built) throw new Error('This difficulty has no chart.');
      }
      const music = song.custom ? audioBuf : toBuffer(DDR.decodeRWAR(audioBuf));
      if (scene !== this) return;
      const play = Play.with(song, charts, music, this.dance);
      // like the game: before a BEGINNER song with freeze arrows, explain them (once per player per session)
      const who = charts.filter(c => c.diff === 4 && c.built.notes.some(n => n.endT !== undefined) && !Explain.seen.has(c.name || '?'));
      if (S.freezeGuide !== false && S.freezes !== false && who.length) { who.forEach(c => Explain.seen.add(c.name || '?')); go(Explain.with(play)); }
      else go(play);
    } catch (e) { this.err = String(e.message || e); }
  },
  input(a, p) { if (p && a === 'BACK') go(Select); },
  draw(t) {
    menuBackground(t);
    const jk = texture('jacket', this.song.jacket);
    if (jk.img) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(W / 2 - 152, 138, 304, 304); g.drawImage(jk.img, W / 2 - 150, 140, 300, 300); }
    const ti = texture('title', this.song.title);
    if (ti.img) g.drawImage(ti.img, W / 2 - ti.img.width, 470, ti.img.width * 2, ti.img.height * 2);
    else if (this.song.custom) text(this.song.name, W / 2, 500, 30, '#fff', 'center');
    text(this.err ? 'Could not load: ' + this.err : this.msg, W / 2, 600, 24, this.err ? '#f88' : '#cfe', 'center', 'normal');
  },
};

// ---- gameplay
// Timing and scoring rules read from DDR II's main.dol (normal arrows, normal play mode).
// Times in the game are ticks of 1/150 s (the charts' tick rate). Window table 0x8026f638, row 0:
//   early limits (Almost, Good, Great, Perfect, Marvelous) = -25, -25, -16, -6, -2
//   late  limits                                           =  30,  30,  15,  7,  2
// A step not hit by +30 ticks is a BOO. Judgment ids as the game uses them: 0 BOO .. 5 MARVELOUS.
const TPS = 150;
const J_NAMES = ['BOO', 'ALMOST', 'GOOD', 'GREAT', 'PERFECT', 'MARVELOUS'];
const J_COLORS = ['#ff4060', '#c77dff', '#4dc3ff', '#4dff7a', '#ffe14d', '#ffffff'];
const WIN_EARLY = [-25, -25, -16, -6, -2], WIN_LATE = [30, 30, 15, 7, 2];
const SEARCH_EARLY = WIN_EARLY[0] / TPS, SEARCH_LATE = WIN_LATE[0] / TPS;
function judgeOf(dtSec) {           // dt = press time - step time (seconds); same checks as 0x8002d484
  const d = dtSec * TPS;
  let j = 5;
  for (let k = 4; k >= 0; k--) {
    if (d >= WIN_EARLY[k] && d <= WIN_LATE[k]) return j;
    j--;
  }
  return 0;
}
// Score (0x80037dd4, mode 0): 100000 * sum(weight * count) / (2 * (steps + freezes)), floored, then x10.
const SCORE_W = [0, 0, 0, 1, 2, 2];       // BOO ALMOST GOOD GREAT PERFECT MARVELOUS
const SCORE_FREEZE_OK = 2, SCORE_DEN = 2;
// Dance level for the grade (0x80037f4c): same shape with these weights, as a percent.
const GRADE_W = [-2, -1, 0, 1, 2, 2], GRADE_OK = 2, GRADE_NG = -2;
// Grade cut-offs per difficulty (0x8026f7d0): AAA, AA, A, B, C (else D)
const GRADE_CUTS = { 0: [100, 87, 77, 67, 47], 1: [100, 85, 75, 65, 45], 2: [100, 87, 77, 67, 53], 3: [100, 90, 80, 70, 56], 4: [100, 90, 80, 70, 56] };
const GRADE_NAMES = ['AAA', 'AA', 'A', 'B', 'C', 'D'];
// Life gauge (0x8003806c / 0x800381fc): starts at 500, max 1000, fail below 1.
// Change per judgment by difficulty (0x8026f8d0): [PERFECT/MARVELOUS, GREAT, GOOD/ALMOST, BOO]
const LIFE_DELTA = { 0: [18, 13, 0, -40], 1: [18, 13, 0, -40], 2: [14, 9, 0, -40], 3: [11, 7, 0, -40], 4: [11, 7, 0, -40] };
// Loss multiplier by how many BOO/ALMOST in a row (0x8026f8a0), index = streak - 1, capped at 10
const LOSS_STREAK = [2.0, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.4, 1.2, 1.3, 1.5];
const DIFF_SLOT = { 4: 0, 1: 1, 2: 2, 3: 3, 6: 4 };   // chart difficulty -> the game's difficulty index
const FREEZE_GRACE = 0.02;   // main.dol (0x80039e4c) checks the panel every frame with no timer: a release longer than one frame (1/60 s) is N.G.

// One dancer: their chart, options, judgments, score and life. Play runs one, or two in VERSUS.
const DIRS = ['L', 'D', 'U', 'R'];
class Dancer {
  constructor(idx, song, built, diff, o, prof, name, lanes) {
    this.idx = idx; this.song = song; this.diff = diff; this.o = o; this.prof = prof; this.name = name;
    this.lanes = lanes; this.style = lanes === 8 ? 'double' : 'single';
    const map = turnMap(lanes, o.turn);
    let notes = built.notes.map(n => ({ off: n.off, t: n.t, lane: map[n.lane], endOff: o.freezes ? n.endOff : undefined,
                                        endT: o.freezes ? n.endT : undefined, done: false, q: quant(n.off) }));
    if (o.cut) notes = notes.filter(n => n.q === 4);                     // CUT: quarter-note steps only
    if (o.jump === false) {                                             // JUMP OFF: one arrow per moment
      const seen = new Set();
      notes = notes.filter(n => { if (seen.has(n.off)) return false; seen.add(n.off); return true; });
    }
    this.notes = notes;
    this.timing = built.timing;
    // rows: notes at the same moment are judged together
    this.rows = [];
    let cur = null;
    for (const n of this.notes) {
      if (!cur || cur.off !== n.off) { cur = { off: n.off, t: n.t, notes: [], hit: 0, judged: false }; this.rows.push(cur); }
      cur.notes.push(n); n.row = cur;
    }
    this.freezeTotal = this.notes.filter(n => n.endT !== undefined).length;
    this.counts = { MARVELOUS: 0, PERFECT: 0, GREAT: 0, GOOD: 0, ALMOST: 0, BOO: 0, OK: 0, NG: 0 };
    this.jc = [0, 0, 0, 0, 0, 0];
    this.slot = DIFF_SLOT[diff] ?? 1;
    this.score = 0; this.combo = 0; this.maxCombo = 0; this.life = 500; this.missRun = 0; this.failed = false;
    this.den = SCORE_DEN * Math.max(1, this.rows.length + this.freezeTotal);
    this.judgeText = null; this.okText = null; this.flash = new Array(lanes).fill(-9); this.holding = [];
    this.bursts = [];
    this.lastNoteT = Math.max(0, ...this.notes.map(n => n.endT || n.t));
  }
  now() { return Play.now(); }
  press(lane, t) {
    this.flash[lane] = this.now();
    // nearest unjudged note in this lane within the window
    let best = null;
    for (const n of this.notes) {
      if (n.done || n.lane !== lane) continue;
      const dt = t - n.t;
      if (dt < SEARCH_EARLY) break;
      if (dt <= SEARCH_LATE && (!best || Math.abs(dt) < Math.abs(t - best.t))) best = n;
    }
    if (!best) return;
    best.done = true; best.hitT = t;
    const row = best.row;
    row.hit++;
    if (best.endT !== undefined) { best.holding = true; this.holding.push(best); }
    // a jump is judged when its last panel goes down, by that press's timing
    if (row.hit === row.notes.length) this.judgeRow(row, judgeOf(t - row.t));
  }
  judgeRow(row, j) {
    row.judged = true;
    if (j === 5 && !this.o.marvelous) j = 4;            // Marvelous option off: counts as Perfect
    this.jc[j]++; this.counts[J_NAMES[j]]++;
    // combo continues on GOOD or better; BOO/ALMOST break it and count toward the loss streak
    if (j >= 2) { this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.missRun = 0; }
    else { this.combo = 0; this.missRun++; }
    this.updateScore();
    if (j >= 3 || j === 0) this.lifeChange(j >= 4 ? 0 : j === 3 ? 1 : 3);
    this.judgeText = { name: J_NAMES[j], color: J_COLORS[j], at: this.now() };
    if (j >= 2) for (const n of row.notes) this.bursts.push({ lane: n.lane, at: this.now(), color: J_COLORS[j] });
    if (this.combo > 0 && this.combo % 100 === 0) {
      const c = Math.min(this.combo, 1000);
      sfx(this.combo > 1000 ? 'VO_NAR_COMBOOVER' : `VO_NAR_${c}COMBO`);
    }
  }
  fullCombo() {   // 0 none, 3 great, 4 perfect, 5 marvelous (combo kept through every step, no N.G.)
    if (this.jc[0] || this.jc[1] || this.counts.NG || this.failed) return 0;
    if (this.jc[2]) return 0;
    return this.jc[3] ? 3 : this.jc[4] ? 4 : 5;
  }
  updateScore() {
    let num = SCORE_FREEZE_OK * this.counts.OK;
    for (let k = 0; k < 6; k++) num += SCORE_W[k] * this.jc[k];
    this.score = Math.floor(100000 * num / this.den) * 10;
  }
  lifeChange(col) {
    let d = LIFE_DELTA[this.slot][col];
    // GAME LEVEL: MEDIUM is the game's own table; the others scale it (gain, loss)
    const lv = { easy: [1.5, 0.6], medium: [1, 1], hard: [0.8, 1.4], 'very hard': [0.6, 1.8] }[S.gameLevel] || [1, 1];
    d *= d > 0 ? lv[0] : lv[1];
    if (d < 0) {
      if (this.life >= 1000) d *= 2.0; else if (this.life >= 700) d *= 1.2; else if (this.life >= 300) d *= 0.9;
      if (this.combo >= 200) d *= 2.0; else if (this.combo >= 100) d *= 1.8; else if (this.combo >= 50) d *= 1.2;
      d *= LOSS_STREAK[Math.max(0, Math.min(10, this.missRun - 1))];
    }
    d = Math.trunc(d);
    if (this.life > 0) this.life += d;
    if (this.life < 1) {
      this.life = 0;
      if (this.o.gauge === 'normal' && !this.failed) { this.failed = true; this.failAt = this.now(); }
    }
    if (this.life > 1000) this.life = 1000;
    if (this.o.gauge !== 'normal' && this.life < 1) this.life = 1;
  }
  freezeNG(n, t, silent) {
    n.holding = false; n.freezeNG = true; this.counts.NG++;
    this.lifeChange(3);
    // the real DDR II keeps the combo through a freeze N.G. (tested on the Wii game); Options can make it break
    if (this.o.ngBreaksCombo) this.combo = 0;
    if (!silent) this.okText = { name: 'NG', lane: n.lane, at: t };
  }
  grade() {
    if (this.failed) return 'E';
    let num = GRADE_OK * this.counts.OK + GRADE_NG * this.counts.NG;
    for (let k = 0; k < 6; k++) num += GRADE_W[k] * this.jc[k];
    const pct = Math.trunc(100 * num / this.den);
    const cuts = GRADE_CUTS[this.slot];
    for (let i = 0; i < 5; i++) if (pct >= cuts[i]) return GRADE_NAMES[i];
    return 'D';
  }
  // misses and freeze arrows; held(lane) says whether that panel is down
  update(t, held) {
    for (const row of this.rows) {
      if (row.t > t - SEARCH_LATE) break;
      if (!row.judged) {
        for (const n of row.notes) if (!n.done) { n.done = true; n.missed = true; if (n.endT !== undefined) this.freezeNG(n, t, true); }
        this.judgeRow(row, 0);
      }
    }
    for (const n of this.holding) {
      if (!n.holding) continue;
      if (held(n.lane)) n.lastHeld = t;
      else if (t - (n.lastHeld || n.hitT) > FREEZE_GRACE && t < n.endT) this.freezeNG(n, t, false);
      if (n.holding && t >= n.endT) {
        n.holding = false; n.freezeOK = true; this.counts.OK++; this.updateScore(); this.lifeChange(0);
        this.okText = { name: 'OK', lane: n.lane, at: t };
        this.bursts.push({ lane: n.lane, at: t, color: '#ffe84a' });     // the head flashes as it goes, like the game
      }
    }
    this.holding = this.holding.filter(n => n.holding);
  }
  // lanes, arrows, flashes, judgment and combo. x0 = left edge of the lanes
  draw(t, x0, lw, ry, held, ended) {
    const lanes = this.lanes, size = lw - 6, o = this.o;
    // the lane area: translucent blue with white lane lines, like the game
    g.fillStyle = 'rgba(16,52,170,0.55)'; g.fillRect(x0 - 4, 0, lanes * lw + 8, H);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(x0 - 6, 0, 3, H); g.fillRect(x0 + lanes * lw + 3, 0, 3, H);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let l = 1; l < lanes; l++) g.fillRect(x0 + l * lw - 1, 0, 2, H);
    const offNow = this.timing.offAt(t);
    const beat = (((offNow % 1024) + 1024) % 1024) / 1024;
    const aframe = Math.min(6, Math.floor(beat * 7));
    const beatPx = lw * o.speed;
    const yOf = off => ry + (off - offNow) / 1024 * beatPx;
    const dirOf = l => l % 4;
    // GUIDELINE: a line across the lanes at every measure
    if (o.guideline) {
      g.fillStyle = 'rgba(255,255,255,0.45)';
      for (let m = Math.floor(offNow / 4096) * 4096; ; m += 4096) {
        const y = yOf(m);
        if (y > H) break;
        if (y > ry) g.fillRect(x0 - 4, y - 1, lanes * lw + 8, 2);
      }
    }
    // step zone
    for (let l = 0; l < lanes; l++) {
      const x = x0 + l * lw + lw / 2, d = dirOf(l);
      const down = t - this.flash[l] < 0.08 || held(l);
      const grey = (A.zoneC8 && A.zoneC8(d, false)) || (A.receptor ? A.receptor(d) : A.arrowGrey && A.arrowGrey[0][d]);
      if (grey) {
        const sc = down ? 0.9 : 1;
        g.globalAlpha = 1; g.drawImage(grey, x - size * sc / 2, ry - size * sc / 2, size * sc, size * sc);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = down ? 0.55 : 0.35 * (1 - beat);
        g.drawImage(A.arrowMask[d], x - size * sc / 2, ry - size * sc / 2, size * sc, size * sc);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      } else drawArrow(down ? 'flash' : 'receptor', x, ry, d, size);
    }
    // judgment: about a second on screen, then a quick fade. The combo count stays up for as long
    // as the combo lasts (gone when a step is missed). Both are drawn under the arrows.
    const jAge = this.judgeText ? t - this.judgeText.at : 9;
    if (!ended && o.evaluation !== false) {
      const cx = x0 + lanes * lw / 2, cy = 352;
      if (jAge < 1.0) {
        const k = Math.min(1, jAge * 14), fa = jAge > 0.85 ? (1 - jAge) / 0.15 : 1;
        const im = A.judge && A.judge[this.judgeText.name];
        const sc = (lanes === 8 ? 0.95 : 0.8) * (1.15 - 0.15 * k);
        g.globalAlpha = fa;
        if (!blit(im, cx, cy, sc, fa)) text(this.judgeText.name, cx, cy, 46, this.judgeText.color, 'center');
        g.globalAlpha = 1;
      }
      if (this.combo >= 4) {
        const ok = digits(A.comboDigits, String(this.combo), cx + 8, cy + 62, 50, 'right', -0.32);
        if (ok) blit(A.judge.COMBO, cx + 14 + 97 * 0.8, cy + 64, 0.8);
        else text(this.combo + ' COMBO', cx, cy + 60, 30, '#fff', 'center');
      }
    }
    // notes (far ones first)
    const bottom = H + lw;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      if (n.done && !n.missed && !n.holding) continue;     // hit arrows disappear
      let y = yOf(n.off);
      const yEnd = n.endT !== undefined ? yOf(n.endOff) : y;
      if (y > bottom) continue;
      if (yEnd < -lw) continue;
      const x = x0 + n.lane * lw + lw / 2, d = dirOf(n.lane);
      if (n.holding) y = ry;
      if (n.missed && n.endT === undefined && y < -lw) continue;
      let alpha = 1;
      if (o.appearance === 'hidden') alpha = clamp((y - 260) / 80);
      else if (o.appearance === 'sudden') alpha = clamp((520 - y) / 80);
      else if (o.appearance === 'stealth') alpha = 0;
      // a missed step goes grey and fades away as it passes the step zone (it doesn't linger under
      // the score panel)
      if (n.missed) alpha *= 0.5 * clamp((Math.max(y, n.endT !== undefined ? yEnd : y) - (ry - lw * 0.6)) / (lw * 0.6));
      if (alpha <= 0) continue;
      g.globalAlpha = alpha;
      if (n.endT !== undefined && yEnd > y) {
        const fz = (n.freezeNG || n.missed) ? A.freezeOff : A.freezeOn;
        if (fz && fz[d] && fz[d].body) this.drawFreeze(fz[d], x, y, yEnd, size, n.holding);
        else {
          g.fillStyle = n.holding ? 'rgba(120,255,140,0.95)' : 'rgba(60,200,90,0.8)';
          g.fillRect(x - size * 0.32, y, size * 0.64, yEnd - y);
        }
      }
      if (n.endT !== undefined && A.freezeOn && A.freezeOn[d]) {
        const fz = (n.freezeNG || n.missed) ? A.freezeOff : A.freezeOn;
        g.drawImage(n.holding && fz[d].headH ? fz[d].headH : fz[d].head, x - size / 2, y - size / 2, size, size);
      } else {
        // the game's palettes: the four note colours by timing (beat, 8th, 16th, other). On RAINBOW
        // (the game's default) every colour goes once round the colour wheel each measure, the hue
        // falling (cyan, green, yellow, orange, red, pink, violet...) - measured from the real game
        const group = n.q === 4 ? 0 : n.q === 8 ? 1 : n.q === 16 ? 2 : 3;
        let sp = null;
        if (A.c8) {
          const shift = o.colors === 'rainbow' ? -360 * ((((offNow / 4096) % 1) + 1) % 1) : 0;
          sp = A.noteC8(o.colors === 'flat' ? 0 : group, shift, aframe, d, beat < 0.2);   // (measured: white for ~1/5 of each beat)
        } else {
          let top, bot;
          if (o.colors === 'flat' || o.colors === 'rhythm') { const c = A.hex(o.colors === 'flat' ? TINT.flat : TINT[n.q] || TINT[0]); top = c; bot = c.map(v => v * 0.7); }
          else { const base = n.q === 4 ? 28 : n.q === 8 ? 222 : 288; const hue = Math.round((base + Math.max(0, (n.off - offNow) / 1024) * 55) / 10) * 10 % 360; top = A.hsl(hue, 1, 0.55); bot = A.hsl(hue + 50, 1, 0.5); }
          sp = A.arrowCol ? A.arrowCol(top, bot, aframe, d) : null;
        }
        if (sp) g.drawImage(sp, x - size / 2, y - size / 2, size, size);
        else drawArrow(o.colors === 'flat' ? 4 : n.q, x, y, d, size);
      }
      g.globalAlpha = 1;
    }
    // hit flashes
    this.bursts = this.bursts.filter(b => t - b.at < 0.2);
    if (A.burst) {
      g.globalCompositeOperation = 'lighter';
      for (const b of this.bursts) {
        const k = (t - b.at) / 0.2, x = x0 + b.lane * lw + lw / 2, sc = size * (1.1 + 0.5 * k);
        g.globalAlpha = 0.8 * (1 - k);
        g.drawImage(A.burstTint(b.color, dirOf(b.lane)), x - sc / 2, ry - sc / 2, sc, sc);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    for (const n of this.holding) if (n.holding && A.burst) {
      const x = x0 + n.lane * lw + lw / 2;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 40);
      g.drawImage(A.arrowMask[dirOf(n.lane)], x - size / 2, ry - size / 2, size, size);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    // judgment + combo
    if (this.okText && t - this.okText.at < 0.5) {
      const im = A.judge && A.judge[this.okText.name];
      const x = x0 + this.okText.lane * lw + lw / 2;
      if (!blit(im, x, ry + lw * 0.95, lanes === 8 ? 0.5 : 0.6))
        text(this.okText.name, x, ry + lw * 0.9, 26, this.okText.name === 'OK' ? '#ffe14d' : '#ff4060', 'center');
    }
  }
  drawFreeze(fz, x, y, yEnd, size, active) {
    const sc = size / 64, bh = fz.body.height;
    // like the game: khaki yellow, fading from green just under the head; bright yellow while held
    const body = active ? (fz.bodyH || fz.body) : (fz.bodyY || fz.body);
    const tailH = 64, tailSrc = bh - tailH;          // the last 64 rows of the body texture are the tail
    // the tail always ends where the freeze ends; while it's held the arrow is eaten up from the
    // head, so near the end only the bottom of the tail shows under the head, then nothing
    const top = y, tailTop = yEnd - tailH * sc * 0.5;
    const P = 128, from = tailSrc - P;
    const column = (img, clipTop, clipBottom) => {
      if (clipBottom <= clipTop) return;
      g.save(); g.beginPath(); g.rect(x - size / 2 - 1, clipTop, size + 2, clipBottom - clipTop); g.clip();
      for (let yy = tailTop; yy > clipTop - 1; yy -= P * sc) g.drawImage(img, 0, from, 64, P, x - size / 2, yy - P * sc, size, P * sc);
      g.restore();
    };
    column(body, top, tailTop);
    g.save(); g.beginPath(); g.rect(x - size / 2 - 1, top, size + 2, H); g.clip();
    g.drawImage(body, 0, tailSrc, 64, tailH, x - size / 2, tailTop, size, tailH * sc);
    g.restore();
    if (fz.bodyG && tailTop > top) {          // green from the head, fading to yellow about halfway down
      const gh = Math.min(tailTop - top, (tailTop - top) * 0.55 + size * 0.3), orig = g.globalAlpha, a0 = orig * (active ? 0.45 : 1);
      for (let k = 0; k < 12; k++) {
        const y0 = top + gh * k / 12, y1 = top + gh * (k + 1) / 12;
        g.globalAlpha = a0 * (1 - k / 12);
        column(fz.bodyG, y0, y1);
      }
      g.globalAlpha = orig;
    }
  }
  // the life gauge panel above the lanes
  drawHud(x0, width, t, badge, two) {
    const life = this.life / 1000;
    const di = DIFFS.findIndex(d => d[0] === this.diff);
    const px = x0 + width / 2 - 183, py = 30, pw = 366, ph = 112;
    if (A.img.meterPanel) g.drawImage(A.img.meterPanel, px, py, pw, ph);
    else { g.fillStyle = 'rgba(60,140,230,0.9)'; g.fillRect(px, py, pw, ph); }
    const pb = this.idx === 1 ? A.img.meterBadge2 : A.img.meterBadge;        // the game's blue 1 / red 2 badges
    if (!blit(pb, px + 14, py + 50, 1.15) && this.idx === 1) { g.fillStyle = '#e8508c'; g.beginPath(); g.arc(px + 14, py + 50, 20, 0, Math.PI * 2); g.fill(); text('2', px + 14, py + 51, 22, '#fff', 'center'); }
    const dl = A.img.meterDiff && A.img.meterDiff[di];
    if (!blit(dl, px + pw / 2 + 26, py + 22, 1.15)) text(DIFFS[di][1], px + pw / 2 + 26, py + 22, 18, DIFFS[di][2], 'center');
    // LED gauge, like the game's (measured from the real game): once a measure the lit pills turn
    // from green to cyan in a quick sweep from the tip leftwards, stay cyan, then turn back to green
    // in a slower, sparkly sweep, again from the tip. The last pill fills from the bottom, and a
    // full gauge cycles through the rainbow.
    const gx = px + 78, gy = py + 38, gs = 1.5, fr = A.img.meterGauge;
    if (fr) g.drawImage(fr, gx, gy, fr.width * gs, fr.height * gs);
    const N = 22, units = life * N, full = life >= 1, lit = Math.max(1, Math.ceil(units));
    const mph = (((this.timing.offAt(t) / 4096) % 1) + 1) % 1;
    const GREEN = 'rgb(48,214,122)', CYAN = 'rgb(34,186,232)';
    for (let k = 0; k < N; k++) {
      const x = gx + (8.5 + 8 * k) * gs, y = gy + 10 * gs, rx = 3.1 * gs, ry = 4.4 * gs;
      const part = Math.max(0, Math.min(1, units - k));
      if (part <= 0) continue;
      let col;
      if (full) col = `hsl(${((k * 17 - t * 260) % 360 + 360) % 360},95%,55%)`;
      else {
        const fromTip = (lit - 1 - k) / Math.max(1, lit);        // 0 at the tip .. ~1 at the left end
        let cyan;
        if (mph < 0.15) cyan = fromTip < mph / 0.15;
        else if (mph < 0.62) cyan = true;
        else if (mph < 0.95) {
          const front = (mph - 0.62) / 0.33, behind = front - fromTip;
          const spark = ((k * 7919 + Math.floor(t * 20) * 104729) % 97) / 97;
          cyan = behind < 0 ? true : behind < 0.2 ? spark < 0.5 : false;
        } else cyan = false;
        col = cyan ? CYAN : GREEN;
      }
      g.save();
      g.beginPath(); g.rect(x - rx - 1, y + ry - 2 * ry * part, 2 * rx + 2, 2 * ry * part + 1); g.clip();
      g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - 0.6 * gs, y - 1.6 * gs, rx * 0.5, ry * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    // score in the dark box under the gauge
    const sx = gx + 182 * gs, sy = gy + 32 * gs;
    if (!digits(A.numbers && A.numbers.white, String(this.score).padStart(7, '0'), sx, sy, 30, 'right', -0.3))
      text(String(this.score).padStart(7, '0'), sx, sy, 26, '#fff', 'right');
    if (two && this.name) text(this.name, px + 44, py + ph - 16, 16, '#0d3770', 'left');
    if (life < 0.3 && life > 0 && (t * 3 | 0) % 2 === 0) blit(A.img.meterDanger || A.img.danger, x0 + width / 2, py + ph + 18, 1.2);
    // style badge (one player on a 4-panel chart)
    if (badge && A.img.meterStyle) {
      const bx = x0 + width + 160, by = 74;
      blit(A.img.meterStyle, bx, by, 1.4);
      blit(A.img.meterNormal, bx, by - 14, 1.1);
    }
  }
}

const Play = {
  // charts: [{built, diff, o, prof, name}] - one per player
  with(song, charts, music, dance) {
    this.song = song; this.music = music; this.dance = dance || null;
    this.two = charts.length > 1;
    const lanes = S.style === 'double' ? 8 : 4;
    this.lanes = lanes;
    this.ps = charts.map((c, i) => new Dancer(i, song, c.built, c.diff, c.o, c.prof, c.name, lanes));
    this.ended = null; this.saidReady = false; this.saidGo = false;
    for (const k in AUTO_HELD) delete AUTO_HELD[k];
    this.lastNoteT = Math.max(...this.ps.map(p => p.lastNoteT));
    this.endT = Math.max(music.duration - 0.2, this.lastNoteT + 1.5);
    return this;
  },
  enter() {
    const ctx = audio();
    this.src = ctx.createBufferSource();
    this.src.buffer = this.music;
    this.gain = ctx.createGain();
    this.src.connect(this.gain).connect(ctx.destination);
    this.t0 = ctx.currentTime + 4.6;      // room for the song card before READY
    this.src.start(this.t0);
    this.quitHeld = 0;
    this.movie = this.song.custom ? (this.song.video && S.movies !== false ? new VideoMovie(this.song.video, this.song.videoStart || 0) : null)
               : this.song.movie && this.song.movie.sync && S.movies !== false ? new Movie(this.song.movie.file, { loop: !this.song.movie.sync }) : null;
    // the dancer (none for two Double players: no room)
    this.choreo = null;
    if (this.dance && S.dancer && !(this.two && this.lanes === 8)) {
      try { this.choreo = Dancer3D.prepare(this.dance, this.song.slot); } catch (e) { console.error('dancer', e); }
    }
  },
  // where the dancer stands: [centre x, top y, width]
  dancerSpot() {
    if (this.two) return [W / 2, 300, 300];
    if (this.lanes === 8) return [1100, 270, 330];
    return [900, 150, 440];
  },
  drawDancer(t) {
    if (!this.choreo) return;
    // like the game: a song with a video shows its video monitor, not a dancer
    // (also while the video is still loading, so the dancer doesn't flash up before it)
    if (this.movie && !this.movie.failed) return;
    const tm = this.ps[0].timing, beat = tm.offAt(t) / 1024, end = tm.offAt(this.lastNoteT) / 1024;
    let cv = null;
    try { cv = Dancer3D.render(this.choreo, beat, end); } catch (e) { console.error('dancer', e); this.choreo = null; return; }
    if (!cv) return;
    const [cx, top, w] = this.dancerSpot(), h = w * cv.height / cv.width;
    // a soft floor shadow, then the dancer
    g.fillStyle = 'rgba(0,0,30,0.35)'; g.beginPath(); g.ellipse(cx, top + h * 0.885, w * 0.22, w * 0.045, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(cv, cx - w / 2, top, w, h);
  },
  leave() { try { this.src.stop(); } catch (e) {} if (this.movie) { this.movie.close(); this.movie = null; } },
  // song time for a context time; offset > 0 moves the arrows later
  songTime(ctxT) { return ctxT - outLatency() - this.t0 - S.offset / 1000; },
  now() { return this.songTime(actx.currentTime); },
  // a pad action -> [dancer, lane]. VERSUS: each side is its own player. One player: both sides
  // play the same 4 lanes, or the two halves of a Double chart.
  route(a) {
    const m = /^P([1-4])([LDUR])$/.exec(a);
    if (!m) return null;
    const side = +m[1] - 1, d = DIRS.indexOf(m[2]);
    if (this.two && this.lanes === 8) return [this.ps[side >> 1], (side & 1) * 4 + d];   // 4 mats
    if (side > 1) return null;
    if (this.two) return [this.ps[side], d];
    if (this.lanes === 8) return [this.ps[0], side * 4 + d];
    return [this.ps[0], d];
  },
  heldBy(p, l) {
    if (AUTO) return (AUTO_HELD[p.idx + ':' + l] || 0) > this.now();
    const d = DIRS[l % 4];
    if (this.two && this.lanes === 8) return input.isDown(`P${p.idx * 2 + (l < 4 ? 1 : 2)}${d}`);
    if (this.two) return input.isDown(`P${p.idx + 1}${d}`);
    if (this.lanes === 8) return input.isDown(`P${l < 4 ? 1 : 2}${d}`);
    return input.isDown('P1' + d) || input.isDown('P2' + d);
  },
  input(a, pressed, perf, menuKey) {
    if (menuKey) return;
    if (a === 'BACK') { this.quitHeld = pressed ? performance.now() : 0; return; }
    const r = this.route(a);
    if (!r || !pressed) return;
    r[0].press(r[1], this.songTime(ctxTimeAt(perf)));
  },
  fadeOut() {
    try { this.gain.gain.setTargetAtTime(0, actx.currentTime, 0.6); } catch (e) {}
  },
  update() {
    const t = this.now();
    for (const p of this.ps) {
      if (AUTO) {
        for (const n of p.notes) {
          if (n.t > t) break;
          if (!n.done) { AUTO_HELD[p.idx + ':' + n.lane] = n.endT !== undefined ? n.endT : 0; p.press(n.lane, n.t); }
        }
      }
      p.update(t, l => this.heldBy(p, l));
    }
    if (!this.saidReady && t > -3.0) { this.saidReady = true; sfx('VO_NAR_INGAMEREADY'); }
    if (!this.saidGo && t > -1.3) { this.saidGo = true; sfx('VO_NAR_INGAMEHEREWEGO'); }
    if (this.quitHeld && performance.now() - this.quitHeld > 800) { go(Select); return; }
    // the song stops when every player has failed, or after the last step
    if (!this.ended && this.ps.every(p => p.failed && t - p.failAt > 0.2)) { this.ended = { kind: 'failed', at: t }; this.fadeOut(); }
    if (!this.ended && t > this.lastNoteT + 0.6) {
      this.ended = { kind: 'finish', at: t };
      if (this.ps.some(p => p.fullCombo())) sfx('SE_DDR_FULLCOMBO');
    }
    if (this.ended && !this.ended.faded && t - this.ended.at > 2.2) { this.ended.faded = true; this.fadeOut(); }
    if ((this.ended && t - this.ended.at > 3.6) || t > this.endT + 1) go(Results.with(this));
  },
  // before READY the song's card flies out of the video screen like the game's: it starts tiny at
  // the screen's top-left, tumbles up and round in an arc (white back first, flipping to the
  // front), lands over the bottom-right of the screen with a slight tilt, and stays until READY ends
  drawSongCard(t) {
    const k = t + 4.6;                       // seconds since the song screen came up
    if (k < 0.25) return;
    const f = clamp((k - 0.25) / 1.1), out = clamp((t + 1.4) / 0.3);
    const ease = v => 1 - Math.pow(1 - v, 3), e = ease(f);
    const solo = !(this.two || this.lanes === 8);
    // the screen the card comes out of (the video monitor's place) and where it lands
    const sx0 = solo ? 600 : W / 2 - 120, sy0 = solo ? 215 : 260;
    const ex = solo ? 900 : W / 2 + 120, ey = solo ? 420 : 430;
    // a curved path: out of the screen, up over the top, round and down onto its spot
    const c1x = solo ? 920 : W / 2 + 100, c1y = 40, c2x = solo ? 1140 : W / 2 + 330, c2y = 150;
    const bz = (a, b, c, d, u) => (1 - u) ** 3 * a + 3 * (1 - u) ** 2 * u * b + 3 * (1 - u) * u * u * c + u ** 3 * d;
    const cx = bz(sx0, c1x, c2x, ex, e), cy = bz(sy0, c1y, c2y, ey, e);
    const sc = 0.04 + 0.96 * ease(clamp(f * 1.25)), rot = -0.9 * (1 - e) - 0.12;
    const flip = Math.cos(Math.PI * (1 - clamp(f * 1.15)));        // -1 = back, 1 = front
    const sz = 210, w = sz + 50, h = sz + 84, r = 30, x = -w / 2, y = -h / 2;
    const jk = texture('jacket', this.song.jacket), ti = texture('title', this.song.title);
    g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(sc * Math.max(0.04, Math.abs(flip)), sc);
    g.globalAlpha = 1 - out;
    const rr = (x0, y0, ww, hh) => { g.beginPath(); g.roundRect ? g.roundRect(x0, y0, ww, hh, r) : g.rect(x0, y0, ww, hh); };
    // thickness: the card's darker side
    g.fillStyle = '#8a1aa8'; rr(x + 10, y + 12, w, h); g.fill();
    if (flip < 0) {                                   // the back: white with a pink rim
      g.fillStyle = '#e255f0'; rr(x, y, w, h); g.fill();
      g.fillStyle = '#ffffff'; rr(x + 10, y + 10, w - 20, h - 20); g.fill();
    } else {
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, '#f27af5'); gr.addColorStop(1, '#c42fe0');
      g.fillStyle = gr; rr(x, y, w, h); g.fill();
      g.fillStyle = '#ffffff'; rr(x + 8, y + 8, w - 16, h - 16); g.fill();
      g.fillStyle = gr; rr(x + 14, y + 14, w - 28, h - 28); g.fill();
      const jx = -sz / 2 - 6, jy = y + 18;
      g.fillStyle = '#000'; g.fillRect(jx - 4, jy - 4, sz + 8, sz + 8);
      if (jk.img) g.drawImage(jk.img, jx, jy, sz, sz);
      if (ti.img) { const s2 = Math.min(1, (w - 30) / ti.img.width); g.drawImage(ti.img, -ti.img.width * s2 / 2, jy + sz + 6, ti.img.width * s2, ti.img.height * s2); }
      else text(this.song.name.slice(0, 24), 0, jy + sz + 26, 17, '#fff', 'center');
    }
    g.restore(); g.globalAlpha = 1;
  },
  // where each player's lanes go
  layout() {
    if (this.lanes === 8 && this.two) return [{ lw: 66, x0: 40 }, { lw: 66, x0: W - 40 - 8 * 66 }];
    if (this.lanes === 8) return [{ lw: 70, x0: W / 2 - 4 * 70 }];
    if (!this.two) return [{ lw: 96, x0: 92 }];
    return [{ lw: 96, x0: 92 }, { lw: 96, x0: W - 92 - 4 * 96 }];
  },
  draw(t0) {
    const t = this.now();
    // background: the song's video (or a background loop), else the game's gameplay backdrop
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const fr = this.movie && !this.movie.failed ? this.movie.frameAt(Math.max(0, t)) : null;
    if (fr && S.videoSize === 'full') {
      const sc = Math.max(W / fr.width, H / fr.height);
      g.globalAlpha = 0.85;
      g.drawImage(fr, W / 2 - fr.width * sc / 2, H / 2 - fr.height * sc / 2, fr.width * sc, fr.height * sc);
      g.globalAlpha = 1;
    } else if (A.img.stageBg || A.img.playBg) {
      g.drawImage(A.img.stageBg || A.img.playBg, 0, 0, W, H);
      if (fr && !(this.two && this.lanes === 8)) {      // (no room for the monitor between two Double players)
        // the Wii shows song videos on a monitor beside the player (in the middle for Double and VERSUS)
        // a fixed 16:9 screen in a frosted frame (the video is fitted inside it, black bars around)
        const mw = this.lanes === 8 ? 640 : this.two ? 320 : 606, mh = Math.round(mw * 349 / 606);
        const mx = this.lanes === 8 || this.two ? W / 2 - mw / 2 : 569;
        const my = this.lanes === 8 ? H / 2 - mh / 2 + 40 : this.two ? H / 2 - mh / 2 + 70 : 188;
        g.fillStyle = 'rgba(205,225,255,0.55)'; g.fillRect(mx - 17, my - 12, mw + 34, mh + 24);
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.strokeRect(mx - 17, my - 12, mw + 34, mh + 24);
        g.fillStyle = '#000'; g.fillRect(mx, my, mw, mh);
        const fs = Math.min(mw / fr.width, mh / fr.height), fw = fr.width * fs, fh = fr.height * fs;
        g.drawImage(fr, mx + (mw - fw) / 2, my + (mh - fh) / 2, fw, fh);
        const gl = g.createLinearGradient(mx, my, mx + mw, my + mh);
        gl.addColorStop(0, 'rgba(255,255,255,0.12)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)');
        g.fillStyle = gl; g.fillRect(mx, my, mw, mh);
      }
    } else {
      const jk = texture('jacket', this.song.jacket);
      if (jk.img) { g.globalAlpha = 0.18; g.drawImage(jk.img, 0, -280, W, W); g.globalAlpha = 1; }
    }
    this.drawDancer(t);
    const ry = 196, lay = this.layout();
    this.ps.forEach((p, i) => {
      const { lw, x0 } = lay[i], width = p.lanes * lw, cx = x0 + width / 2;
      p.draw(t, x0, lw, ry, l => this.heldBy(p, l), this.ended);
      // before the song, footprints show where to stand: the outer panels, then the inner ones,
      // back and forth, then all four blink and they're gone (like the game)
      if (t < -2.4 && A.img.feet && A.img.feet[0]) {
        const k = t + 4.6, ft = A.img.feet[p.idx === 1 ? 1 : 0], fs = lw * 0.8;
        const all = k > 1.75, on = all ? ((k * 8) | 0) % 2 === 0 : true, outer = ((k / 0.45) | 0) % 2 === 0;
        if (on) for (let l = 0; l < p.lanes; l++) {
          const inner = l % 4 === 1 || l % 4 === 2;
          if (!all && inner === outer) continue;
          g.drawImage(ft, x0 + lw * (l + 0.5) - fs / 2, ry - fs / 2, fs, fs);
        }
      }
      p.drawHud(x0, width, t, !this.two && this.lanes === 4, this.two);
      // each player's ending banner (centred when playing alone)
      const bx = this.two ? cx : W / 2, bs = this.two ? 0.78 : 1.25;
      if (this.ended) {
        const k = clamp((t - this.ended.at) * 5), sc = bs * (1.4 - 0.4 * k), fc = p.fullCombo();
        const kind = p.failed ? 'failed' : fc ? 'fc' : 'finish';
        const im = kind === 'failed' ? (A.img.failed || A.img.tryAgain)
                 : kind === 'fc' ? (fc === 5 ? A.img.fullComboB : fc === 4 ? A.img.fullComboY : A.img.fullComboG)
                 : A.img.finishY;
        const label = kind === 'failed' ? 'FAILED' : kind === 'fc' ? 'FULL COMBO' : 'FINISH!!';
        if (!blit(im, bx, H / 2, sc, k)) text(label, bx, H / 2, this.two ? 40 : 64, '#ffd23c', 'center');
      } else if (p.failed) blit(A.img.failed, bx, H / 2, this.two ? 0.75 : 1.2);
    });
    // banners
    if (t < -1.1) this.drawSongCard(t);
    if (t < -1.4 && t > -3.0) { if (!blit(A.img.ready, W / 2, H / 2, 1.2, clamp((t + 3.0) * 4))) text('READY', W / 2, H / 2, 56, '#ffd23c', 'center'); }
    else if (t >= -1.4 && t < 0.3) { if (!blit(A.img.hereWeGo, W / 2, H / 2, 1.2, clamp((0.3 - t) * 3))) text('HERE WE GO!', W / 2, H / 2, 56, '#ffd23c', 'center'); }
    if (this.quitHeld) text('Hold Esc to quit', W / 2, H - 30, 20, '#fff', 'center', 'normal');
  },
};
function clamp(v) { return Math.max(0, Math.min(1, v)); }
function drawArrow(kind, x, y, dir, size) {
  const sp = sprite(kind, size);
  g.save(); g.translate(x, y); g.rotate(ROT[dir]); g.drawImage(sp, -size / 2, -size / 2); g.restore();
}
function turnMap(lanes, turn = S.turn) {
  const id = [...Array(lanes).keys()];
  const per = (m) => lanes === 8 ? [...m, ...m.map(v => v + 4)] : m;
  switch (turn) {
    case 'mirror': return per([3, 2, 1, 0]);
    case 'left': return per([1, 3, 0, 2]);     // rotate 90° to the left
    case 'right': return per([2, 0, 3, 1]);
    case 'shuffle': {
      const m = [0, 1, 2, 3];
      for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
      return per(m);
    }
    default: return id;
  }
}

// ---- results
const Results = {
  bgm: 'MU_BGM_FREE',
  with(play) { this.play = play; this.ps = play && play.ps; return this; },
  input(a, p) {
    if (!p || (a !== 'START' && a !== 'BACK')) return;
    sfx('SE_SYS_DECIDE01');
    const q = (this.awards || []).filter(Boolean);      // each player with user data gets their points card
    go(q.length ? Points.with(q[0], q.slice(1)) : Select);
  },
  // records, play points and challenge-task bonus into the player's own data (guests keep nothing)
  award(p) {
    const prof = p.prof;
    if (!prof) return null;
    prof.points = prof.points || 0; prof.records = prof.records || {};
    const key = recKey(p.song.slot, p.style, p.diff), old = prof.records[key];
    const r = { failed: p.failed, life: p.life, maxCombo: p.maxCombo, grade: p.gr };
    const gi = GRADE_ORDER.indexOf(p.gr);
    const play = p.failed || gi < 0 ? 0 : PLAY_POINTS[p.slot][gi];
    const tasks = TASKS.map(([label, pts, test]) => ({ label, pts, done: !!test(r) }));
    const bonus = tasks.reduce((n, k) => n + (k.done ? k.pts : 0), 0);
    const before = prof.points;
    p.newRecord = !old || p.score > old.score;
    const hadMedal = rdaIndex(p.song) >= 0 && hasMedal(p.song, prof);
    const rank = gr => ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'].indexOf(gr);
    prof.records[key] = {
      score: Math.max(p.score, old ? old.score : 0),
      grade: !old || rank(p.gr) > rank(old.grade) ? p.gr : old.grade,
      fc: Math.max(p.fc || 0, old ? old.fc || 0 : 0),
      plays: (old ? old.plays || 0 : 0) + 1,
    };
    prof.points = before + play + bonus;
    p.newMedal = rdaIndex(p.song) >= 0 && !hadMedal && hasMedal(p.song, prof);
    // what the new total unlocks (player 1's points decide the song list; shown only when unlocking is on)
    const unlocked = p.idx === 0 && S.unlocks === 'on' ? unlockedBetween(before, prof.points).filter(u => u.songs.length) : [];
    return { who: this.ps.length > 1 ? `PLAYER ${p.idx + 1}  ${p.name}` : null, play, bonus, tasks, before, after: prof.points, unlocked };
  },
  enter() {
    if (!this.ps || !this.ps.length) { go(Select); return; }
    this.t0 = performance.now();
    this.gradeShown = false;
    for (const p of this.ps) { p.gr = p.grade(); p.fc = p.fullCombo(); p.newRecord = false; p.newMedal = false; }
    sfx('SE_RES_RESULTAPP');
    this.awards = this.ps.map(p => this.award(p));
    writeSave();
  },
  update() {
    const el = (performance.now() - this.t0) / 1000;
    if (!this.gradeShown && el > 1.2) {
      this.gradeShown = true;
      // the announcer calls the better of the two results in VERSUS
      const rank = gr => ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'].indexOf(gr);
      const p = this.ps.reduce((a, b) => rank(b.gr) > rank(a.gr) || (b.gr === a.gr && b.score > a.score) ? b : a);
      const gr = p.gr;
      sfx(gr === 'AAA' ? 'SE_RES_RESULTAAA' : gr === 'AA' ? 'SE_RES_RESULTAA' : gr === 'A' || gr === 'B' ? 'SE_RES_RESULTAB' : gr === 'E' ? 'SE_RES_RESULTE' : 'SE_RES_RESULTCD');
      const vo = p.fc ? 'VO_NAR_RESULTFULL' : gr === 'E' ? (p.slot >= 2 ? 'VO_NAR_RESULTEHARD' : 'VO_NAR_RESULTEEASY') : 'VO_NAR_RESULT' + gr;
      setTimeout(() => sfx(vo), 700);
    }
  },
  draw(t) {
    menuBackground(t);
    g.fillStyle = 'rgba(0,55,75,0.5)'; g.fillRect(0, 0, W, H);       // the game dims the menu backdrop to teal here
    const ps = this.ps, two = ps.length > 1, song = ps[0].song, el = (performance.now() - this.t0) / 1000;
    // RESULTS tab
    g.fillStyle = 'rgba(160,170,180,0.9)'; g.fillRect(468, -6, 344, 84);
    g.fillStyle = '#2f8fe0'; g.fillRect(476, -6, 328, 76);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(476, -6, 328, 30);
    if (!blit(A.img.resTitle, 640, 44, 1.25)) text('RESULTS', 640, 44, 36, '#fff', 'center');
    // grade cards: player 1 left of the jacket (far left and far right in VERSUS)
    ps.forEach(p => this.drawCard(p, two ? (p.idx ? 1044 : 40) : 252, el));
    // jacket in its frame
    const jx = 532, jy = 89, jw = 222, jh = 238;
    if (A.img.resJacketFrame) g.drawImage(A.img.resJacketFrame, jx, jy, jw, jh);
    else { g.fillStyle = '#333'; g.fillRect(jx, jy, jw, jh); }
    const jk = texture('jacket', song.jacket);
    if (jk.img) g.drawImage(jk.img, jx + 18, jy + 12, jw - 36, jw - 36);
    text(two ? (this.play.lanes === 8 ? 'DOUBLE VERSUS' : 'VERSUS') : this.play.lanes === 8 ? 'DOUBLE STYLE' : 'NORMAL STYLE', jx + jw / 2, jy + jh - 18, 18, '#fff', 'center');
    // counts panel: the game's 1-player panel (boxes left, labels right) or its VERSUS panel (1P left, 2P right)
    const sc = 1.48, py = 346;
    const panelImg = two ? A.img.resPanel2P : A.img.resPanel1P, px = two ? 322 : 330;
    if (panelImg) g.drawImage(panelImg, 0, 0, 284 + (two ? 146 : 0), 198, px, py, (284 + (two ? 146 : 0)) * sc, 198 * sc);
    ps.forEach(p => this.drawCounts(p, px + (p.idx ? 416 : 141) * sc, py, sc, el));
    if (!two) {
      // song title on the right where the game shows the dancer
      const ti = texture('title', song.title);
      if (ti.img) g.drawImage(ti.img, 1010 - ti.img.width * 0.75, 420, ti.img.width * 1.5, ti.img.height * 1.5);
      else if (song.custom) { text(song.name.slice(0, 26), 1010, 440, 24, '#fff', 'center'); if (song.artist) text(song.artist.slice(0, 32), 1010, 468, 16, '#dff', 'center', 'normal'); }
      text('Speed x' + ps[0].o.speed, 1010, 500, 18, '#dff', 'center', 'normal');
      if (ps[0].failed) blit(A.img.failed, 1010, 300, 0.8, clamp(el - 1.2));
    } else {
      const ti = texture('title', song.title);
      if (ti.img) g.drawImage(ti.img, 640 - ti.img.width * 0.6, 652, ti.img.width * 1.2, ti.img.height * 1.2);
      else if (song.custom) text(song.name.slice(0, 40), 640, 668, 22, '#fff', 'center');
    }
    // DDR points (each player's own total)
    const pts = (p, x, align) => {
      if (!p.prof) return;
      g.fillStyle = 'rgba(20,40,150,0.9)'; g.fillRect(align === 'left' ? x : x - 150, 586 + (align === 'left' ? 50 : 0), 150, 22);
      const yy = align === 'left' ? 636 : 586;
      text('DDR POINTS', align === 'left' ? x + 75 : x - 75, yy + 11, 15, '#fff', 'center');
      text(String(p.prof.points).padStart(7, '0') + ' pts', x, yy + 42, 24, '#ffe86a', align);
    };
    pts(ps[0], 28, 'left');
    if (two) pts(ps[1], 1252, 'right');
    g.fillStyle = 'rgba(20,50,80,0.85)'; g.fillRect(1040, 640, 200, 34);
    text('Enter  CONTINUE', 1140, 657, 17, '#fff', 'center');
  },
  drawCard(p, cx, el) {
    const cy = 46, cw = 196, ch = 276;
    if (A.img.card) g.drawImage(A.img.card, cx, cy, cw, ch);
    g.fillStyle = A.img.card ? 'rgba(160,236,255,0.55)' : '#7fd4f4'; g.fillRect(cx, cy, cw, ch);
    g.strokeStyle = p.idx ? '#ffd8e6' : '#e8fbff'; g.lineWidth = 4; g.strokeRect(cx + 4, cy + 4, cw - 8, ch - 8);
    text('PLAYER ' + (p.idx + 1), cx + cw / 2, cy + 30, 22, p.idx ? '#ffe4ee' : '#e8f4ff', 'center');
    if (this.ps.length > 1 && p.name) text(p.name, cx + cw / 2, cy + ch + 13, 18, '#fff', 'center');
    const di = DIFFS.findIndex(d => d[0] === p.diff);
    const dl = A.img.diffLabel && A.img.diffLabel[di];
    if (!blit(dl, cx + cw / 2, cy + 64, 1.3)) text(DIFFS[di][1], cx + cw / 2, cy + 64, 20, DIFFS[di][2], 'center');
    if (el > 1.2) {
      const k = clamp((el - 1.2) * 5), sc = 1.45 * (1.5 - 0.5 * k);
      const gi = A.img.grades && A.img.grades[p.gr];
      if (!blit(gi, cx + cw / 2, cy + 170, sc, k)) text(p.gr, cx + cw / 2, cy + 170, 90, '#ffd23c', 'center');
      if (p.fc && A.img.resFull) blit(A.img.resFull[p.fc === 5 ? 3 : p.fc === 4 ? 0 : 2] || A.img.resFull[0], cx + cw / 2, cy + 248, 0.95, k);
      if (p.newMedal && el > 1.8) {          // first AA or better on a Replicant D-action song
        const k2 = clamp((el - 1.8) * 4), c = RDA_COLORS[rdaIndex(p.song)];
        g.save(); g.globalAlpha = k2;
        g.beginPath(); g.arc(cx + cw - 22, cy + 112, 22, 0, Math.PI * 2);
        const gr = g.createRadialGradient(cx + cw - 28, cy + 106, 2, cx + cw - 22, cy + 112, 23);
        gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, c); gr.addColorStop(1, 'rgba(0,0,0,0.6)');
        g.fillStyle = gr; g.fill();
        text('MEDAL GET!', cx + cw / 2, cy + 292, 20, c, 'center');
        g.restore();
      }
      if (p.newRecord && !p.failed) {
        g.save(); g.translate(cx + cw / 2, cy + 160); g.rotate(-0.12);
        if (!blit(A.img.newRecord, 0, 0, 1.15, k)) text('NEW RECORD', 0, 0, 26, '#ff60a0', 'center');
        g.restore();
      }
    }
  },
  drawCounts(p, right, py, sc, el) {
    const vals = [p.counts.MARVELOUS, p.counts.PERFECT, p.counts.GREAT, p.counts.GOOD, p.counts.BOO + p.counts.ALMOST,
                  p.counts.OK, p.counts.NG, p.maxCombo, p.score];
    const cols = ['white', 'gold', 'green', 'sky', 'red', 'gold', 'red', 'gold', 'white'];
    vals.forEach((v, i) => {
      const y = py + (10 + i * 19.05) * sc, shown = clamp((el - 0.15 - i * 0.08) * 4);
      if (shown <= 0) return;
      const n = i === 8 ? 7 : 4, str = String(v).padStart(n, '0'), lead = str.length - String(v).length;
      const set = A.numbers && A.numbers[cols[i]], dim = A.numbers && A.numbers.white;
      g.globalAlpha = shown;
      const h = 33, step = h * 0.6;
      if (set && set[0]) {
        for (let k = str.length - 1, x = right; k >= 0; k--, x -= step) {
          const im = (k < lead ? dim : set)[+str[k]];
          g.globalAlpha = shown * (k < lead ? 0.28 : 1);
          g.drawImage(im, x - step - 3, y - h / 2 - 1, h, h);
        }
      } else text(str, right, y, 24, '#fff', 'right');
      g.globalAlpha = 1;
    });
  },
};

// DDR points: the challenge task card, then any songs it unlocked
const Points = {
  bgm: 'MU_BGM_FREE',
  with(a, rest = []) { this.a = a; this.rest = rest; return this; },
  enter() {
    if (!this.a) { go(Select); return; }
    this.t0 = performance.now(); this.page = 0;
    this.a.tasks.forEach((k, i) => { if (k.done) setTimeout(() => { if (scene === this && this.page === 0) sfx('SE_RES_CLEAR01'); }, 500 + i * 300); });
  },
  input(a, p) {
    if (!p || (a !== 'START' && a !== 'BACK')) return;
    sfx('SE_SYS_DECIDE01');
    if (a === 'START' && this.page < this.a.unlocked.length) { this.page++; this.t0 = performance.now(); sfx('SE_DDR_FULLCOMBO'); return; }
    if (this.rest.length) { go(Points.with(this.rest[0], this.rest.slice(1))); return; }
    go(Select); sfx('VO_NAR_SELECTMUSIC');
  },
  draw(t) {
    menuBackground(t);
    const el = (performance.now() - this.t0) / 1000, A_ = this.a;
    if (this.page > 0) {             // NEW SONG unlocked
      const u = A_.unlocked[this.page - 1], song = u.songs[0];
      g.fillStyle = 'rgba(0,55,75,0.45)'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#4aa8f0'; g.fillRect(320, 140, 640, 420);
      g.fillStyle = '#0d2f8a'; g.fillRect(336, 156, 608, 372);
      text('DDR POINTS REACHED!!', W / 2, 200, 34, '#7fe8ff', 'center');
      text('NEW SONG!!', W / 2, 262, 26, '#fff', 'center');
      text(`"${u.label}" Unlocked!`, W / 2, 302, 24, '#fff', 'center');
      const jk = texture('jacket', song.jacket);
      if (jk.img) g.drawImage(jk.img, W / 2 - 80, 340, 160, 160);
      text('Enter  CONFIRM', 900, 545, 16, '#fff', 'right');
      return;
    }
    // challenge task card
    const x = 210, y = 60, w = 860, h = 600;
    g.fillStyle = '#5ab4f0'; g.fillRect(x, y, w, h);
    g.fillStyle = '#2f86da'; g.fillRect(x + 10, y + 10, w - 20, h - 20);
    text('CHALLENGE TASK', x + 60, y + 50, 34, '#fff');
    if (A_.who) text(A_.who, x + w - 40, y + 50, 26, '#ffe86a', 'right');
    g.fillStyle = '#103c8c'; g.fillRect(x + 30, y + 80, 330, 70);
    text('ANY SONG', x + 195, y + 115, 32, '#4ab4ff', 'center');
    text('Earn bonus points by clearing any song', x + 390, y + 103, 18, '#ffb050');
    text('under the following conditions.', x + 390, y + 127, 18, '#ffb050');
    A_.tasks.forEach((k, i) => {
      const ry = y + 168 + i * 82;
      g.fillStyle = '#0f2a66'; g.fillRect(x + 30, ry, w - 60, 70);
      text(String(i + 1), x + 58, ry + 35, 40, '#fff', 'center');
      text(`${k.label} for ${k.pts} DDR points.`, x + 90, ry + 35, 21, '#fff');
      const appear = clamp((el - 0.5 - i * 0.3) * 6);
      if (k.done && appear > 0) {
        g.save(); g.translate(x + w / 2 + 40, ry + 35); g.rotate(-0.12); const s = 1.6 - 0.6 * appear; g.scale(s, s);
        g.globalAlpha = appear; text('CLEARED!', 0, 0, 52, '#ffc030', 'center'); g.globalAlpha = 1; g.restore();
      }
    });
    const by = y + h - 76;
    g.fillStyle = '#1f5cb8'; g.fillRect(x + 10, by - 20, w - 20, 86);
    const nx = nextUnlock(A_.after);
    const cols = [['PLAY POINTS', A_.play], ['BONUS POINTS', A_.bonus],
                  nx ? ['STILL NEEDED', Math.max(0, nx.at - A_.after)] : ['TOTAL', A_.after]];
    if (nx) text('Next: ' + nx.label + ' at ' + nx.at + ' pts', x + 30, y + h + 22, 16, '#fff');
    cols.forEach(([label, v], i) => {
      const cx = x + 150 + i * 280;
      text(label, cx, by, 20, '#bfe6ff', 'center');
      text(String(v) + ' pts', cx, by + 34, 30, '#fff', 'center');
    });
    text('Enter  CONFIRM', x + w - 30, y + h + 22, 16, '#fff', 'right');
  },
};

// ---------------------------------------------------------------- main loop
cv.addEventListener('click', () => { audio(); if (scene && scene.click) scene.click(); });
// ---- cabinet lights (Ultimarc PAC Drive): a panel's light is on while it's stepped on
const Lights = {
  last: '', test: 0, ok: false,
  outputOf(act) {
    if (S.lightMap && S.lightMap[act]) return Math.max(0, S.lightMap[act]);
    const m = /^P([1-4])([LDUR])$/.exec(act);
    return m ? (m[1] - 1) * 4 + 'LDUR'.indexOf(m[2]) + 1 : 0;
  },
  tick() {
    const bits = [0, 0, 0, 0];
    if (this.test) {                              // light test: each output in turn
      const k = Math.floor((performance.now() - this.test) / 250);
      if (k >= 16) this.test = 0; else bits[0] = 1 << k;
    } else if (scene === Options && Options.page !== null && OPT_PAGES[Options.page] && OPT_PAGES[Options.page].name === 'LIGHTS'
               && (OPT_PAGES[Options.page].rows[Options.row] || {}).light) {
      // choosing a pin: that pin lights up so you can see which light it is
      const o = this.outputOf(OPT_PAGES[Options.page].rows[Options.row].light) - 1;
      if (o >= 0) bits[o >> 4] |= 1 << (o & 15);
    } else if (S.lights !== false) {
      for (const pl of ['P1', 'P2', 'P3', 'P4']) for (const d of 'LDUR') {
        if (!input.isDown(pl + d)) continue;
        const o = this.outputOf(pl + d) - 1;
        if (o >= 0 && o < 64) bits[o >> 4] |= 1 << (o & 15);
      }
    }
    const key = bits.join(',');
    if (key === this.last) return;
    this.last = key;
    fetch('/api/lights', { method: 'POST', body: JSON.stringify({ bits }), keepalive: true }).catch(() => {});
  },
};

function frame(ms) {
  input.poll();
  try { Lights.tick(); } catch (e) {}
  const t = ms / 1000;
  try {
    if (scene && scene.update) scene.update();
    if (scene) scene.draw(t);
  } catch (e) {
    console.error(e);
    g.fillStyle = '#300'; g.fillRect(0, H - 40, W, 40);
    text('Error: ' + e.message, 20, H - 20, 18, '#fff', 'left', 'normal');
  }
  requestAnimationFrame(frame);
}
go(Title);
requestAnimationFrame(frame);
