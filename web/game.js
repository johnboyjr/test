// DDR II PC - game. Screens: title, setup, select, options, controls, loading, play, results.
'use strict';

const W = 1280, H = 720;
const cv = document.getElementById('screen');
const g = cv.getContext('2d');
const input = new Input();
const AUTO = new URLSearchParams(location.search).has('auto');
const AUTO_HELD = {};
// a player named DEMO plays itself, every step dead on time (freezes held to the end)
const isAuto = p => AUTO || /^demo$/i.test((p && p.name) || '');

// ---------------------------------------------------------------- settings
const DEFAULTS = {
  style: 'single', diff: 1, speed: 2, appearance: 'visible', turn: 'off', freezes: true,
  offset: 0, gauge: 'normal', marvelous: true, unlocks: 'off', menuMusic: true, short: false, videoSize: 'wii', screen: 'wide', voice: true, menuSounds: true, movies: true, colors: 'rainbow', bindings: null, sort: 'game', game: 'ddr2', dancer: true, hpStage: 'random', hpDancer: '001', dancerCustom: false, dancerModel: '', ddr2Char: 'random', ddr2Stage3d: true, ngBreaksCombo: false, jump: true, cut: false, guideline: 'beginner', judgePos: 'normal', autoSave: true, evaluation: true, scroll: 'normal', timingColor: false, metronome: false, songOn: true, clap: false, cameraWork: 'default', comboPerf: '50', dancerLight: 'pc', fps: 'max', showFps: false, glFast: true, gameLevel: 'medium', freezeGuide: true,
  custom: null,                     // DDR CUSTOM: which game each part comes from (see CUSTOM_PARTS)
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
// DDR points unlock schedule. The game's own table (main.dol 0x8027bf38) replaces this list when the
// disc is read (applyDiscUnlocks); this copy (from RemyWiki) is only the fallback. Songs are by the
// game's song number. Outfits and Mii parts aren't in DDR II PC, but they still count as the "next" goal.
let UNLOCKS = [
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
  const slots = new Set([song.slot, song.full, song.alt && song.alt.slot, ...(song.versions || []).map(v => v.slot)].filter(Boolean));
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
const UNLOCK_FALLBACK = UNLOCKS;
const UNLOCK_AT = {};
for (const [pts, , slots] of UNLOCKS) for (const sl of slots || []) UNLOCK_AT[sl] = pts;
// the disc's table -> UNLOCKS: [points, label, [full song slots]], one entry per points total
function applyDiscUnlocks(rows) {
  if (!rows || !rows.length) return;
  const OUTFIT = { 200: 'Outfit "EMI"', 201: 'Outfit "DISCO"', 202: 'Outfit "RUBY"', 203: 'Outfit "YUNI"', 204: 'Outfit "RAGE"' };
  const MII = { 82: 'A', 83: 'A', 86: 'B', 87: 'B', 88: 'C', 89: 'C', 84: 'D', 85: 'E' };
  const known = {};                                 // song names from the built-in list, if the song isn't here
  for (const [, label, slots] of UNLOCK_FALLBACK) if (slots && slots.length === 1) known[slots[0]] = label;
  const by = new Map();
  for (const [pts, type, id, , b] of rows) {
    const e = by.get(pts) || { labels: [], slots: [] };
    if (type === 1) {
      const slot = id + 1, full = slot % 2 ? slot + 1 : slot;
      if (!e.slots.includes(full)) {
        e.slots.push(full);
        const so = SONGS.find(x => (x.full || x.slot) === full || x.slot === slot);
        const nm = so ? so.name : known[full];
        if (nm && !e.labels.includes(nm)) e.labels.push(nm);
      }
    } else if (type === 2 && OUTFIT[id]) e.labels.push(OUTFIT[id]);
    else if (type === 2 && id === 205) e.labels.push(b ? 'Outfit "RENA"' : 'Character "RENA"');
    else if (type === 2 && MII[id]) { const l = MII[id] + '-' + (b + 1); if (!e.labels.some(x => x.endsWith(' ' + l) || x.includes(l))) e.labels.push('Mii BODY ' + l); }
    else if (type === 7) e.labels.push('Mii Character');
    by.set(pts, e);
  }
  const list = [...by.entries()].sort((a, b) => a[0] - b[0]).map(([pts, e]) => {
    const mii = e.labels.filter(l => l.startsWith('Mii BODY ')), other = e.labels.filter(l => !l.startsWith('Mii BODY '));
    const label = other.concat(mii.length ? ['Mii BODY ' + mii.map(l => l.slice(9)).join(', ')] : []).join(' + ') || 'Song';
    return [pts, label, e.slots.length ? e.slots : undefined];
  });
  UNLOCKS = list;
  for (const k of Object.keys(UNLOCK_AT)) delete UNLOCK_AT[k];
  for (const [pts, , slots] of UNLOCKS) for (const sl of slots || []) UNLOCK_AT[sl] = pts;
}
// Player data, like the game's user data: each player has their own DDR points, records and
// play options (speed, style, turn...). Controls, audio offset and screen settings are shared.
// (GAME OVER and MARVELOUS are the whole game's settings in DDR II, not a player's)
const PROFILE_OPTS = ['style', 'diff', 'speed', 'appearance', 'turn', 'freezes', 'colors', 'lastSlot', 'short', 'ngBreaksCombo', 'jump', 'cut', 'guideline', 'evaluation', 'scroll', 'judgePos'];
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
// AUTO SAVE off (Options > SAVE): records are kept only when SAVE is chosen (force)
function writeSave(force) {
  if (S.autoSave === false && !force) return;
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
addEventListener('keydown', e => { if (e.code === 'F3') { e.preventDefault(); S.showFps = !S.showFps; saveSettings(); } });

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
  if (dec.loop) b.loopFrom = dec.loopStart / dec.rate;     // looped sound: where its loop starts (s)
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

// an original 256x256 design for a song with no art: colours, rays, rings and a dance-floor grid,
// all picked from the song's name
function genArt(x, name) {
  let h = 2166136261;
  for (const ch of name) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  for (let i = 0; i < 4; i++) rnd();                 // stir, so similar names get different colours
  const hue = Math.floor(rnd() * 360), hue2 = (hue + 40 + Math.floor(rnd() * 80)) % 360, style = Math.floor(rnd() * 3);
  const gr = x.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, `hsl(${hue},85%,52%)`); gr.addColorStop(1, `hsl(${hue2},80%,28%)`);
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const cx = 40 + rnd() * 176, cy = 40 + rnd() * 176;
  x.save();
  if (style === 0) {                                  // rays from a point
    const n = 10 + Math.floor(rnd() * 10);
    x.fillStyle = 'rgba(255,255,255,0.13)';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, b = a + Math.PI / n;
      x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * 400, cy + Math.sin(a) * 400); x.lineTo(cx + Math.cos(b) * 400, cy + Math.sin(b) * 400); x.fill();
    }
  } else if (style === 1) {                           // a floor grid in perspective
    x.strokeStyle = 'rgba(255,255,255,0.22)'; x.lineWidth = 2;
    for (let i = -8; i <= 8; i++) { x.beginPath(); x.moveTo(128 + i * 12, 120); x.lineTo(128 + i * 70, 256); x.stroke(); }
    for (let k = 0; k < 7; k++) { const y = 120 + 136 * Math.pow(k / 6, 1.8); x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); }
  } else {                                            // stripes
    x.translate(128, 128); x.rotate(rnd() * Math.PI);
    x.fillStyle = 'rgba(255,255,255,0.12)';
    for (let i = -8; i < 8; i += 2) x.fillRect(i * 24, -260, 24, 520);
  }
  x.restore();
  // rings
  for (let i = 0, n = 2 + Math.floor(rnd() * 3); i < n; i++) {
    x.beginPath(); x.arc(rnd() * 256, rnd() * 256, 20 + rnd() * 70, 0, Math.PI * 2);
    x.lineWidth = 6 + rnd() * 14; x.strokeStyle = `hsla(${(hue + 180) % 360},90%,70%,0.35)`; x.stroke();
  }
  const sh = x.createRadialGradient(128, 128, 60, 128, 128, 190);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
  x.fillStyle = sh; x.fillRect(0, 0, 256, 256);
}

// the part of a picture that isn't see-through, as fractions [x, y, w, h] of its size (cached)
const VIS_BOX = new WeakMap();
function visibleBox(img) {
  if (!img || !(img.naturalWidth || img.width)) return [0, 0, 1, 1];
  if (VIS_BOX.has(img)) return VIS_BOX.get(img);
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  let box = [0, 0, 1, 1];
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const a = x.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (a[(yy * w + xx) * 4 + 3] > 200) {   // solid only (not the soft shadow)
      if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
    }
    if (x1 >= x0) box = [x0 / w, y0 / h, (x1 - x0 + 1) / w, (y1 - y0 + 1) / h];
  } catch (e) { /* keep the whole picture */ }
  VIS_BOX.set(img, box);
  return box;
}

// ---------------------------------------------------------------- images
const imgCache = new Map();
const ART_BG = {};
const ART_GEN = {};             // disc banner URL -> a name to make the tile's own design from (HP2)               // custom song picture URL -> its background picture (for banners)
function texture(kind, idx) {          // kind: jacket | title; idx can also be a picture's URL (custom songs)
  const key = kind + idx;
  if (imgCache.has(key)) return imgCache.get(key);
  const entry = { img: null };
  imgCache.set(key, entry);
  if (idx === null || idx === undefined) { entry.missing = true; return entry; }
  if (typeof idx === 'string' && idx.startsWith('/')) {
    const im = new Image();
    im.onload = () => {        // squared off like the game's jackets
      if (kind === 'raw') { entry.img = im; return; }       // (as it is: Hottest Party 2's name tabs)
      const c = document.createElement('canvas'), x = c.getContext('2d'), s = Math.min(im.width, im.height);
      c.width = c.height = 256;
      if (im.width / im.height > 1.6) {
        // a banner (no jacket): it goes across the middle of the song's background picture
        const banner = () => { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 128 - 128 * im.height / im.width - 6, 256, 256 * im.height / im.width + 12);
          x.drawImage(im, 0, 128 - 128 * im.height / im.width, 256, 256 * im.height / im.width); entry.img = c; };
        x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
        const bgUrl = ART_BG[idx];
        if (bgUrl === idx) {
          // a disc's own banner (Hottest Party): no blown-up copy of itself behind it (the text came out
          // twice); a backdrop in the banner's own colours, the banner across the middle, full width
          // behind it: the banner itself, blown up, heavily blurred and darkened (colours only, no text)
          if (ART_GEN[idx]) genArt(x, ART_GEN[idx]);
          else {
            x.fillStyle = '#000'; x.fillRect(0, 0, 256, 256);
            x.save(); x.filter = 'blur(14px) brightness(0.55) saturate(1.3)';
            x.drawImage(im, (im.width - im.height) / 2, 0, im.height, im.height, -24, -24, 304, 304);
            x.restore();
          }
          const h = 256 * im.height / im.width, y = 128 - h / 2;
          x.fillStyle = '#000'; x.fillRect(0, y - 4, 256, h + 8);
          x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(0, y - 3, 256, 1); x.fillRect(0, y + h + 2, 256, 1);
          x.drawImage(im, 0, y, 256, h);
          entry.img = c;
          return;
        }
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
// Text in the game's own font (font/font_us.bin; A.font once A.loadIntro has run). size = the letters'
// cell height on screen; letters a little apart, like the game's. Falls back to text() without the font.
// sp = the gap after each letter, in the font's own pixels (24 to a line)
function gfontWidth(s, size, sp = 2) {
  const F = A.font; if (!F) return 0;
  const k = size / 24; let w = 0;
  for (const ch of s) { const gl = F.glyphs[F.alias[ch] || ch]; w += (gl ? gl.w + sp : 6 + sp) * k; }
  return w;
}
function gtext(s, x, y, size = 24, color = '#fff', align = 'left', sp = 2, pitch = 1.25) {
  const F = A.font;
  if (!F) return text(s, x, y, size * 0.85, color, align);
  let atlas = F.atlas;
  if (color && color !== '#fff' && color !== '#ffffff') atlas = F.tints[color] || (F.tints[color] = tintImg(F.atlas, color));
  const k = size / 24;
  String(s).split('\n').forEach((ln, j) => {
    const w = gfontWidth(ln, size, sp);
    let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const cy = y - size / 2 + j * size * pitch;
    for (const ch of ln) {
      const gl = F.glyphs[F.alias[ch] || ch];
      if (gl) g.drawImage(atlas, gl.sx, gl.sy, gl.w, 24, cx, cy, gl.w * k, size);
      cx += (gl ? gl.w + sp : 6 + sp) * k;
    }
  });
}
// the biggest size (up to `size`) at which `s` fits in `maxW`
function fitSize(s, size, maxW, weight = 'bold') {
  for (; size > 8; size--) { g.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`; if (g.measureText(s).width <= maxW) break; }
  return size;
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
// Hottest Party's own menu background (the gridded sphere and turning circles from its disc),
// used on song select inside the HOTTEST PARTY folder and around a Hottest Party song
let HP_LOOK = false;
const HPMenu = {
  st: null, busy: false, failed: false,
  get() {
    if (this.st || this.busy || this.failed || !window.HPStage) return this.st;
    this.busy = true;
    fetch('/api/hpmenu').then(r => r.ok ? r.json() : null).then(d => {
      if (!d) { this.failed = true; return; }
      const st = HPStage.fromData(d);
      st.fixedCam = { eye: [0, 0, 1250], at: [0, 0, 0], roll: 0, fov: 34, near: 10, far: 100000 };
      st.aspect = 4 / 3; st.layered = true;
      this.st = st;
    }).catch(() => { this.failed = true; }).finally(() => { this.busy = false; });
    return null;
  },
  draw() {
    const st = this.get();
    if (!st) return false;
    try { g.drawImage(st.render(performance.now() / 1000 * 60, 0, 0), 0, 0, W, H); return true; }
    catch (e) { console.error('hp menu', e); this.failed = true; this.st = null; return false; }
  },
};
function menuBackground(t) {
  if ((HP_LOOK && (scene === Select || scene === Loading || scene === Results || scene === Explain) ||
       look('menu') === 'hp' && scene !== Players && scene !== Title && scene !== Setup && scene !== GameSel ||
       scene === GameSel && GameSel.games[GameSel.i] && ['hp', 'hp2', 'hp3'].includes(GameSel.games[GameSel.i].id)) && HPMenu.draw()) return;
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
  if (s !== Select && s !== Loading && s !== Play && s !== Results && s !== Explain && s !== Points) HP_LOOK = hpLike() && s !== Players && s !== Title;
  if (s.enter) s.enter();
  Bgm.want(s.bgm || null);
}
// menu music (the game's MU_BGM_FREE loop on menu screens; song select uses the previews like the game)
const Bgm = {
  cur: null, src: null, gain: null, cache: new Map(),
  async want(name) {
    if (S.menuMusic === false) name = null;
    // Hottest Party's own menu music (and its results music)
    if (name && look('menu') === 'hp' && scene !== Players && scene !== Title && scene !== Setup) name = scene === Results ? 'HP009' : 'HP006';
    if (name === this.cur) return;
    this.cur = name;
    if (this.src) { const s = this.src, gn = this.gain; try { gn.gain.setTargetAtTime(0, actx.currentTime, 0.15); s.stop(actx.currentTime + 0.8); } catch (e) {} this.src = null; }
    if (!name || !actx) return;
    try {
      let buf = this.cache.get(name);
      if (!buf) { buf = toBuffer(DDR.decodeBRSTM(await bin(name.startsWith('HP') ? '/api/hpbgm/' + name.slice(2) : '/api/bgm/' + name))); this.cache.set(name, buf); }
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
// DDR II's own unlock table, read once the songs are in (their names label the unlocks)
let DISC_UNLOCKS = null;
async function loadDiscUnlocks() {
  try { if (!DISC_UNLOCKS) DISC_UNLOCKS = (await api('/api/ddr2unlocks')) || []; } catch (e) { DISC_UNLOCKS = []; }
  applyDiscUnlocks(DISC_UNLOCKS);
  try { if (!CTASK) CTASK = (await api('/api/ddr2tasks')) || null; } catch (e) { CTASK = null; }
}

// ---- DDR II's challenge task (DDR2_SPEC.md "Challenge task"; main.dol 0x8011f920 / 0x8011fa98 and
// 0x80120334-0x801206b8, tables at 0x80291bc8). Each player keeps a task position: six indexes into the
// tables (task 0-19, song, difficulty, gauge, combo, rank). The tables used depend on the DDR points
// stored at the last step: up to 899,999, up to 1,679,999, or more. After each rewarded play the task
// steps on (not the very first time), every index by one; a specified-song task also steps its song on
// to the next one that is unlocked.
let CTASK = null;
function ctRange(pts) { return pts <= 899999 ? 0 : pts <= 1679999 ? 1 : 2; }
function ctState(prof) {
  if (!prof.ctask) prof.ctask = { on: 0, pts: 0, i: [0, Math.floor(Math.random() * 255), 0, 0, 0, 0] };
  return prof.ctask;
}
// the task now: { any, songId, rows: [{label, pts, test(r)}] } (null without the disc's tables)
function ctTask(prof) {
  const T = CTASK;
  if (!T || !prof) return null;
  const st = ctState(prof), r = ctRange(st.pts || 0), [i24, i25, i26, i27, i28, i29] = st.i;
  const any = T.kind[i24 % T.kind.length] !== 0;
  const songs = T.songs[r];
  const songId = any ? -1 : songs[i25 % songs.length];
  const dl = T.diff[r][i26 % T.diff[r].length], gv = T.gauge[r][i27 % T.gauge[r].length];
  const cv = T.combo[r][i28 % T.combo[r].length], rv = T.rank[r][i29 % T.rank[r].length];
  const DN = ['BEGINNER', 'BASIC', 'DIFFICULT', 'EXPERT'], RN = ['', '', 'C', 'B', 'A', 'AA', 'AAA'];
  const rows = [
    [dl >= 4 ? 'Clear on Challenge' : `Clear on ${DN[dl]} or higher`, [500, 750, 1000, 1500, 2000][dl] || 0, x => x.level >= dl],
    [gv >= 100 ? 'Clear with the Dance Gauge at 100%' : `Clear with the Dance Gauge at ${gv}% or higher`,
     { 60: 250, 75: 500, 90: 750, 100: 1000 }[gv] || 0, x => x.gauge >= gv],
    [cv < 0 ? 'Clear with a FULL COMBO' : `Clear with a MAX COMBO of ${cv} or higher`,
     cv < 0 ? 1500 : { 50: 500, 100: 750, 200: 1000 }[cv] || 0, x => cv < 0 ? x.fc : x.maxCombo >= cv],
    [`Clear with RANK ${RN[rv]} or higher`, { 2: 250, 3: 500, 4: 750, 5: 1000 }[rv] || 0, x => x.rank >= rv],
  ].map(([label, pts, test]) => ({ label, pts, test }));
  return { any, songId, rows };
}
// does a played song count for the task? (0x80120774: ANY SONG, or the song or its pair - id ^ 1)
function ctSongOk(task, slot) {
  if (task.any) return true;
  const id = slot - 1;
  return id === task.songId || id === (task.songId % 2 ? task.songId - 1 : task.songId + 1);
}
// 0x8011fa98: step on after a rewarded play (pts = the DDR points before this play's)
function ctStep(prof, pts, unlockPts = pts) {
  const T = CTASK;
  if (!T) return;
  const st = ctState(prof), inc = st.on ? 1 : 0, r = ctRange(pts);
  st.on = 1; st.pts = pts;
  const n = [T.kind.length, 0, T.diff[r].length, T.gauge[r].length, T.combo[r].length, T.rank[r].length];
  for (const k of [0, 2, 3, 4, 5]) st.i[k] = (st.i[k] + inc) % n[k];
  if (T.kind[st.i[0]] !== 0 || !inc) return;
  // a specified song: the next one in this range's list that is unlocked, else (none left) the first
  // range's list
  const unl = id => { const sg = songForSlot(id + 1); return !!sg && !isLocked(sg, unlockPts); };
  const L = T.songs[r];
  for (let k = 0; k < L.length; k++) { st.i[1] = (st.i[1] + 1) % L.length; if (unl(L[st.i[1]])) return; }
  const L0 = T.songs[0];
  for (let k = 0; k < 256; k++) { st.i[1] = (st.i[1] + 1) % L0.length; if (unl(L0[st.i[1]])) return; }
}
async function loadSongs() {
  const game = await api('/api/songs');
  for (const s of game) if (s.disc && s.jacket) ART_BG[s.jacket] = s.jacket;     // a disc's banner, over a blow-up of itself
  // Hottest Party 2 has no song art on the disc (only a name tab), so its tiles get a design of their
  // own, made up from the song's name: the same song always gets the same one
  // (the song's picture comes from select_cmn.bin; if that can't be read, the tile gets a design of its own)
  for (const s of game) if (s.disc === 'hp2' && s.jacket && !s.jacket.startsWith('/api/hp2art/')) ART_GEN[s.jacket] = s.name || String(s.slot);
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
// MY CHARACTER (the Wii's song select: COURSE MUSIC, MY CHARACTER, FAVORITE MUSIC, RANDOM, then the
// songs): the dancer picker, drawn here with the dancers' names in black boxes
// Their pictures are the disc's own tiles in comAF's jacket sheet (/9): 202 COURSE MUSIC, 204 RANDOM,
// 205 FAVORITE MUSIC, 206 OPTIONS, 267 MY CHARACTER (loaded from your disc like the song jackets)
const sysTile = (special, name, jk) => ({ folderTile: true, special, folder: name, slot: special, name, artist: '', count: 0, jk,
  bpm: ['---', '---'], length: 0, single: [0, 0, 0, 0, 0], double: [0, 0, 0, 0, 0], radar: [], jacket: null, title: null });
const MYCHAR_TILE = Object.assign(sysTile('mychar', 'MY CHARACTER', 267), { myChar: true });
const OPTIONS_TILE = sysTile('options', 'OPTIONS', 206), COURSE_TILE = sysTile('course', 'COURSE MUSIC', 202), FAV_TILE = sysTile('fav', 'FAVORITE MUSIC', 205);
const RANDOM_SONG = { random: true, jk: 204, slot: 'random', name: 'RANDOM', artist: '', bpm: ['???', '???'], length: 0,
  single: [0, 0, 0, 0, 0], double: [0, 0, 0, 0, 0], radar: [], jacket: null, title: null };
function sectionOf(song) { return !song ? '' : song.random ? 'random' : song.folderTile ? 'folders' : song.custom || song.disc ? 'folder:' + song.folder : rdaIndex(song) >= 0 ? 'rda' : 'game'; }
function danceNo(song) { return song.custom ? parseInt(song.slot.slice(1, 7), 16) % 119 + 1 : song.disc ? (song.slot * 7) % 119 + 1 : song.slot; }
const DIFFS = [[4, 'BEGINNER', '#6cf'], [1, 'BASIC', '#fd4'], [2, 'DIFFICULT', '#f55'], [3, 'EXPERT', '#4e6'], [6, 'CHALLENGE', '#c6f']];
// Player 2 (VERSUS): joins on song select. null = one player. {name: their user data or null for a guest, diff}
let P2 = null;
// the grey meter panel (METER_FM_US.bin /0/4 #5) tinted for player 3 (green) / 4 (yellow)
const TINTED = {};
function tintedPanel(idx) {
  const base = A.img.meterPanels && A.img.meterPanels[5];
  if (!base) return null;
  if (!TINTED[idx]) {
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
    const x = c.getContext('2d');
    x.drawImage(base, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = idx === 2 ? '#20e040' : '#ffe020'; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(base, 0, 0);
    TINTED[idx] = c;
  }
  return TINTED[idx];
}
// 3 / 4 players: the game's own meter layout (METER_MULTI_US.bin's CAE block for 3 or 4 players). Each part's
// first frame gives its place (x, y), pivot, scale and turn. Mapping to the 1280 x 720 screen, checked against
// Wii screenshots of both: each player's panel (1p_bar) sits 2 screen pixels a unit from the middle (520), and
// that player's other parts keep their distance from the panel at 1.5x, like y and the pictures.
// The fields (dummy01 / @dummy) sit on a 0-640 strip: 3 players at 110 / 320 / 530, 4 players at 93 / 244 / 397 / 547.
const MULTI_LAY = {};
function multiLayout(n) {
  if (MULTI_LAY[n] !== undefined) return MULTI_LAY[n];
  const M = A.multi && A.multi[n];
  if (!M || !M.cae) return null;
  const first = p => {
    const o = { x: 0, y: 0, px: 0, py: 0, sx: 1, sy: 1, rot: 0, alpha: 255 };
    const sc = p.tracks && p.tracks[0] ? p.tracks[0].script : [];
    for (const [t, k, v] of sc) { if (t > 0) break; if (k in o) o[k] = v; }
    return o;
  };
  const by = {};
  M.cae.forEach(p => { if (p.name === '@dummy') return; (by[p.sprite] = by[p.sprite] || []).push(first(p)); });
  Object.values(by).forEach(a => a.sort((u, v) => u.x - v.x));
  const bars = by[4] || [];
  if (bars.length !== n) return (MULTI_LAY[n] = null);
  const cells = Array.from({ length: n }, () => []);
  (by[7] || []).forEach(c => { let b = 0; bars.forEach((q, i) => { if (Math.abs(q.x - c.x) < Math.abs(bars[b].x - c.x)) b = i; }); cells[b].push(c); });
  const fields = (by[8] || []).filter((f, i, a) => a.findIndex(q => q.x === f.x) === i);
  return (MULTI_LAY[n] = { plate: (by[1] || [])[0], word: (by[0] || [])[0], bars, gauges: by[5] || [], diffs: by[6] || [],
    nums: (by[2] || []).filter(q => q.y > 80), danger: by[9] || [], badges: by[10] || [], cells, fields });
}
// FRIENDSHIP / SYNC with 3 / 4 players (Wii screenshot, 3 players FRIENDSHIP): one shared field in the middle
// (the CAE's field mark at 320 on the 0-640 strip, full size) under the pink group panel, the STYLE plate top
// left, and a PLAYER n tag per player (game/METER_FS2_US.bin's CAE: 1p_bar03 at 0.85 x 0.45 with PLAYER n on it,
// at (319, 120) (730, 120) (319, 297) (729, 297)). Same screen mapping as the 3 / 4 player meters (the group
// panel's parts keep their distance from it at 1.5x).
let PARTY_LAY;
function partyLayout() {
  if (PARTY_LAY !== undefined) return PARTY_LAY;
  if (!A.party || !A.party.cae) return null;
  const by = {};
  A.party.cae.forEach(p => {
    if (p.name === '@dummy') return;
    const o = { x: 0, y: 0, px: 0, py: 0, sx: 1, sy: 1, rot: 0, alpha: 255 };
    for (const [t, k, v] of (p.tracks && p.tracks[0] ? p.tracks[0].script : [])) { if (t > 0) break; if (k in o) o[k] = v; }
    (by[p.sprite] = by[p.sprite] || []).push(o);
  });
  const tagOrder = a => (a || []).slice().sort((u, v) => (u.y - v.y) || (u.x - v.x));    // P1 top left, P2 top right, P3 / P4 under
  return (PARTY_LAY = { word: (by[0] || [])[0], plate: (by[1] || [])[0], bar: (by[4] || [])[0], panels: tagOrder(by[5]), gauge: (by[6] || [])[0],
    tags: tagOrder(by[7]), diff: (by[8] || [])[0], cells: (by[9] || []).sort((u, v) => u.x - v.x), score: (by[2] || []).find(q => q.y > 60),
    danger: (by[11] || [])[0], box: (by[12] || [])[0], sticker: (by[13] || [])[0] });
}
function drawParty(ps, t) {
  const L = partyLayout(), P = A.party;
  if (!L || !L.bar) return false;
  const ax = L.bar.x, p = ps[0], life = p.life / 1000, di = DIFFS.findIndex(d => d[0] === p.diff);
  // the style plate and word (their own place: no group offset)
  mspr(P.plate, L.plate, L.plate && L.plate.x); mspr(P.words[GROUP === 'sync' ? 3 : 4], L.word, L.plate && L.plate.x);
  // each player's tag
  ps.forEach((q, i) => { const o = L.panels[i], tg = L.tags[i]; if (o) { mspr(P.panels[i], o, o.x); mspr(P.tags[i], tg, o.x); } });
  // the group panel: panel, gauge, difficulty, pills, score, badge with PARTY
  mspr(P.bar, L.bar, ax); mspr(P.gauge, L.gauge, ax); mspr(P.diffs[di], L.diff, ax);
  const cs = L.cells, N = cs.length, units = life * N;
  cs.forEach((c, k) => {
    const part = Math.max(0, Math.min(1, units - k)); if (part <= 0) return;
    const x = MX(c.x, ax) + (4 - c.px) * c.sx * 1.5, y = MY(c.y) + (7 - c.py) * c.sy * 1.5, rx = 3.1 * c.sx * 1.5, ry = 5.2 * c.sy * 1.5;
    g.save(); g.beginPath(); g.rect(x - rx - 1, y + ry - 2 * ry * part, 2 * rx + 2, 2 * ry * part + 1); g.clip();
    g.fillStyle = life >= 1 ? `hsl(${((k * 17 - t * 260) % 360 + 360) % 360},95%,55%)` : 'rgb(48,214,122)';
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.restore();
  });
  if (life < 0.3 && life > 0 && (t * 3 | 0) % 2 === 0) mspr(P.danger, L.danger, ax);
  mspr(P.box, L.box, ax); mspr(P.sticker, L.sticker, ax);
  const nm = L.score;
  if (nm) {
    const dw = 28 * nm.sx * 1.5, h = 28 * nm.sy * 1.5, adv = dw * 0.66, right = MX(nm.x, ax) + adv / 2, y = MY(nm.y);
    const str = String(p.score).padStart(Play.scoreDigits || 7, '0'), set = A.numbers && A.numbers.white;
    [...str].forEach((ch, k) => { const im = set && set[+ch], cx = right - adv * (str.length - k - 0.5);
      if (im) { const w = im.width * h / im.height; g.drawImage(im, cx - w / 2, y - h / 2, w, h); } else text(ch, cx, y, h, '#fff', 'center'); });
  }
  return true;
}
const MX = (x, ax = 520) => 640 + (ax - 520) * 2 + (x - ax) * 1.5, MY = y => y * 1.5;
function mspr(im, o, ax = 520) {
  if (!im || !o) return false;
  g.save(); g.globalAlpha *= o.alpha / 255; g.translate(MX(o.x, ax), MY(o.y)); g.rotate(o.rot * Math.PI / 180);
  g.scale(o.sx * 1.5, o.sy * 1.5); g.drawImage(im, -o.px, -o.py); g.restore();
  return true;
}
// Players 3 and 4 (SELECT NUMBER OF PLAYERS 3 / 4): the same {name, diff} as P2, in order
let PX = [];
function styleNow() { return S.style; }            // VERSUS follows the Style option: Single (2 mats) or Double (4 mats)
function levelsOf(song) { return styleNow() === 'double' ? song.double : song.single; }
function chartKey(diff) { return (diff << 8) | (styleNow() === 'double' ? 0x18 : 0x14); }
function p2Profile() { return P2 && P2.name ? DATA.profiles[P2.name] || null : null; }
// player 2 plays with their own saved options (a guest uses player 1's)
function p2Opts() { return pOpts(P2); }
// a joined player's options: their saved ones (a guest uses player 1's), then any changed for them
function pOpts(P) {
  const prof = P && P.name ? DATA.profiles[P.name] || null : null, o = Object.assign({}, S);
  if (prof && prof.opts) for (const k of PROFILE_OPTS) if (k in prof.opts) o[k] = prof.opts[k];
  if (P && P.opts) Object.assign(o, P.opts);              // changed for that player on the options screen
  return o;
}

// ---- title
// ---- DEMO PLAY (the game's attract mode, main.dol): left on the title screen, the game plays its demo
// table (16 entries at 0x8027b878, in turn) as game mode 8: one dancer playing by itself, the
// 1,000,000-point scoring (0x80037dd4 mode 1), and any button goes back to the title.
// Song code 1000 = any song (0x8004c0f4); a slot code gets 0, 2 or 4 added at random (0x8004be98).
// Type 6 entries play on stage 18. The entry's last value is the difficulty index (0 BEGINNER, 1 BASIC):
// it goes to each player's +16 (0x800288d8), which the player setup uses to index the song's level bytes
// (0x800339f4); the 9 stored beside it is the play-option flags 0x1|0x8, the auto-play judging path (0x8002d484).
// The title waits 1200 frames (20 s at 60 fps: its timer at +328 against 1200.0, 0x800e1988), then
// fades out and leaves for the demo (state 16).
const DEMO_IDLE = 20;
const DEMO = { on: false, i: 0, table: null, saved: null };
async function startDemo() {
  if (!DEMO.table) {
    try { DEMO.table = (await api('/api/ddr2demo')).demos || []; } catch (e) { DEMO.table = []; }
  }
  if (!DEMO.table.length || !SONGS.length) return false;
  const disc = SONGS.filter(x => !x.disc && !x.custom && !isLocked(x));
  for (let tries = 0; tries < 16; tries++) {
    const e = DEMO.table[DEMO.i]; DEMO.i = (DEMO.i + 1) % DEMO.table.length;
    let song = null;
    if (e.song === 1000) song = disc[Math.floor(Math.random() * disc.length)];
    else song = songForSlot(e.song + 2 * Math.floor(Math.random() * 3)) || songForSlot(e.song);
    if (!song) continue;
    const want = e.b4 === 1 ? 1 : 4;
    const lv = song.single || [];
    const has = d => lv[DIFFS.findIndex(x => x[0] === d)] > 0;
    const diff = has(want) ? want : [4, 1, 2, 3].find(has);
    if (!diff) continue;
    DEMO.saved = { diff: S.diff, style: S.style, p2: P2 };
    S.diff = diff; S.style = 'single'; P2 = null;
    DEMO.on = true; DEMO.type = e.type;
    go(Loading.with(song));
    return true;
  }
  return false;
}
function endDemo() {
  if (!DEMO.on) return;
  DEMO.on = false;
  if (DEMO.saved) { S.diff = DEMO.saved.diff; S.style = DEMO.saved.style; P2 = DEMO.saved.p2; DEMO.saved = null; }
  go(Title);
}

// ---- start-up, as on the Wii (timed from a recording of the real game): the wrist-strap screens (3 s and
// 3.5 s), KONAMI (fades in 0.5 s, 3 s, fades out), the WARNING "Loading." window over the darkened menu
// background while the game loads, NOTICE (0.5 s fades, 3 s), a white flash, the opening movie
// (movie/select/OP.thp, stored on its side), then the title. Enter / a click skips a step (the
// warning stays until loading is done). Pictures: logo/logo_ENG.tpl, select/selTitle_US.bin, comAF_US.bin.
async function bootLoad() {
  const st = await api('/api/status');
  const set = await api('/api/settings');
  if (set.pc) S = Object.assign({}, DEFAULTS, set.pc);
  if (S.colorsV !== 2) { S.colors = 'rainbow'; S.colorsV = 2; }   // VIVID is the game's default
  input.setBindings(S.bindings);
  if (S.dancerCustom && S.dancerModel && window.Dancer3D) Dancer3D.useModel('/api/dancermodel');
  let su = null;
  try { su = await api('/api/setup'); } catch (e) {}
  if (!st.ok || (su && !su.ffmpegOk && !su.ffmpegSkip)) return st.ok ? '' : (st.error || 'no game folder');
  SONGS = await loadSongs(); await loadDiscUnlocks();
  await loadSave();
  if (!A.ready) await A.load();
  return null;
}
const BOOT = [                                   // [step, seconds]
  ['strap0', 3.0], ['strap1', 3.5], ['konami', 4.0], ['white', 0.5], ['dim', 0.75], ['warning', 1.5],
  ['dim2', 1.5], ['notice', 4.0], ['bright', 1.25], ['flash', 0.5], ['movie', 0], ['done', 0]];
const Boot = {
  step: 0, at: 0, load: null, loaded: false, err: null, movie: null, snd: null,
  enter() {
    this.step = 0; this.at = performance.now(); this.loaded = false; this.err = null;
    A.loadIntro().catch(() => {});
    this.load = bootLoad().then(e => { this.err = e; this.loaded = true; }).catch(e => { this.err = String(e); this.loaded = true; });
    api('/api/menumovie').then(m => { if (m && m.file) this.movie = new Movie(m.file, { audio: true }); }).catch(() => {});
  },
  leave() { this.stopMovie(); },
  stopMovie() { if (this.snd) { try { this.snd.stop(); } catch (e) {} this.snd = null; } if (this.movie) { this.movie.close(); this.movie = null; } },
  name() { return BOOT[this.step][0]; },
  next() {
    if (this.loaded && this.err !== null) return go(Setup.with(this.err));
    this.step++; this.at = performance.now();
    if (this.name() === 'movie') {
      if (!this.movie || this.movie.failed) return this.next();
      this.movieAt = performance.now();
      const au = this.movie.audio;
      if (au) try {
        const ctx = audio(), b = ctx.createBuffer(au.chans.length, au.chans[0].length, au.rate);
        au.chans.forEach((c, k) => b.copyToChannel(c, k));
        const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(); this.snd = src;
      } catch (e) {}
    }
    if (this.name() === 'done') { this.stopMovie(); go(Title); }
  },
  update() {
    const [nm, dur] = BOOT[this.step], el = (performance.now() - this.at) / 1000;
    if (nm === 'warning' && !this.loaded) return;           // stays up while the game loads
    if (nm === 'movie') { if (this.movie && this.movie.info && el > this.movie.duration) this.next(); return; }
    if (nm === 'dim2' && !this.loaded) return;
    if (dur && el >= dur) this.next();
  },
  input(a, p) {
    if (!p || (a !== 'START' && a !== 'BACK')) return;
    audio();
    const nm = this.name();
    if (nm === 'warning' || nm === 'dim2' && !this.loaded) return;
    if (nm === 'movie' || nm === 'flash' || nm === 'bright') { this.step = BOOT.length - 2; return this.next(); }
    this.next();
  },
  click() { this.input('START', true); },
  draw(t) {
    const I = A.intro || {}, nm = this.name(), el = (performance.now() - this.at) / 1000;
    const full = im => { if (im) g.drawImage(im, (W - H * 4 / 3) / 2, 0, H * 4 / 3, H); };   // a 4:3 Wii picture
    if (nm === 'strap0' || nm === 'strap1') {
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); full(I.strap && I.strap[nm === 'strap0' ? 0 : 1]); return;
    }
    if (nm === 'konami' || nm === 'white') {
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      const a = nm === 'white' ? 0 : Math.min(clamp(el / 0.5), clamp((4.0 - el) / 0.5));
      if (I.konami) { g.globalAlpha = a; g.drawImage(I.konami, W / 2 - 384, H / 2 - 96 - 20, 768, 192); g.globalAlpha = 1; }
      return;
    }
    if (nm === 'movie') {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const fr = this.movie && this.movie.frameAt((performance.now() - this.movieAt) / 1000);
      if (fr) {                                    // stored turned a quarter clockwise: turn it back
        g.save(); g.translate(0, H); g.rotate(-Math.PI / 2); g.drawImage(fr, 0, 0, H, W); g.restore();
      }
      return;
    }
    if (nm === 'flash') { g.fillStyle = el < 0.25 ? '#fff' : '#000'; g.fillRect(0, 0, W, H); return; }
    // the menu background, darkened (brightening again before the movie)
    menuBackground(t);
    let dark = 0.62;
    if (nm === 'dim') { g.fillStyle = '#fff'; g.globalAlpha = 1 - clamp(el / 0.75); g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    if (nm === 'bright') dark = 0.62 * (1 - clamp(el / 1.25));
    g.fillStyle = `rgba(0,20,30,${dark})`; g.fillRect(0, 0, W, H);
    if (nm === 'bright' && el > 0.9) { g.fillStyle = `rgba(255,255,255,${clamp((el - 0.9) / 0.35)})`; g.fillRect(0, 0, W, H); }
    if (nm === 'warning') {
      // comAF's window (554 x 320 Wii pixels) with the font's WARNING! banner and the game's text
      if (I.window) g.drawImage(I.window, W / 2 - 396, H / 2 - 229 - 6, 792, 457);
      const bn = I.banners && I.banners[0];
      if (bn) g.drawImage(bn, W / 2 - bn.width * 0.75, 182 - bn.height * 0.75, bn.width * 1.5, bn.height * 1.5);
      gtext('Loading.', W / 2, 218, 30, '#fff', 'center');
      gtext('Please do not touch\nthe Power Button\nor RESET.', W / 2, 296, 30, '#fff', 'center');
    }
    if (nm === 'notice') {
      const a = Math.min(clamp(el / 0.5), clamp((4.0 - el) / 0.5));
      g.globalAlpha = a;
      // selTitle's NOTICE layout (Wii 640 x 480): title (320,76), text (320,203), DOLBY (320,354), (C) (320,417)
      const P = (im, x, y, px, py) => { if (im) g.drawImage(im, W / 2 + (x - 320 - px) * 1.5, y * 1.5 - py * 1.5, im.width * 1.5, im.height * 1.5); };
      P(I.notice, 320, 76, 100, 25); P(I.noticeText, 320, 203, 300, 100); P(I.dolby, 320, 354, 89, 38); P(I.copy, 320, 417, 180, 17);
      g.globalAlpha = 1;
    }
    if (this.err && this.loaded && (nm === 'dim2' || nm === 'notice')) text(this.err, W / 2, H - 30, 16, '#fff', 'center', 'normal');
  },
};

// ---- the title (selTitle_US.bin): the dark starry sky with mist, ripples floating at the bottom, the
// arrow emblem flying together, the DanceDanceRevolution II logo, "Let's dance!" (gently rocking) and
// (C) 2011 Konami Digital Entertainment. Layout in Wii pixels: logo (320,172), button (320,336),
// (C) (320,417), emblem about (240,240).
const Title = {
  t0: 0, busy: false,
  enter() { this.t0 = this.idle = performance.now(); if (!A.intro && A.loadIntro) A.loadIntro().catch(() => {}); },
  draw(t) {
    if (SONGS.length && A.ready && !this.busy && !DEMO.on && performance.now() - this.idle > DEMO_IDLE * 1000) {
      this.idle = performance.now(); startDemo();
    }
    const I = A.intro || {}, el = (performance.now() - this.t0) / 1000;
    // the sky
    g.fillStyle = '#04192b'; g.fillRect(0, 0, W, H);
    if (I.nebula) { g.globalAlpha = 0.9; g.drawImage(I.nebula, W / 2 - 600, H / 2 - 520, 1200, 1040); g.globalAlpha = 1; }
    if (I.mist) { g.globalAlpha = 0.35; g.drawImage(I.mist, -100 + Math.sin(t * 0.1) * 40, 0, 900, 720); g.drawImage(I.mist, 600 - Math.sin(t * 0.13) * 40, -80, 900, 720); g.globalAlpha = 1; }
    if (I.stars) for (let k = 0; k < 6; k++) { g.globalAlpha = 0.8; g.drawImage(I.stars, (k % 3) * 430 - 20, Math.floor(k / 3) * 360 + ((t * 6 + k * 50) % 360) - 360, 430, 430); g.drawImage(I.stars, (k % 3) * 430 - 20, Math.floor(k / 3) * 360 + ((t * 6 + k * 50) % 360), 430, 430); g.globalAlpha = 1; }
    // ripples on the floor
    const rp = I.ripple || [];
    [[170, 575, 2.2, 0], [470, 600, 1.4, 2], [800, 640, 1.8, 1], [1080, 560, 1.5, 0], [1190, 640, 1.9, 2], [80, 690, 2.4, 1], [620, 700, 2.1, 0]].forEach(([x, y, s, k], i) => {
      const im = rp[k]; if (!im) return;
      const pulse = 1 + 0.03 * Math.sin(t * 1.5 + i), sw = im.width * s * pulse, sh = sw * 0.32;
      g.globalAlpha = 0.85; g.drawImage(im, x - sw / 2, y - sh / 2, sw, sh); g.globalAlpha = 1;
    });
    // the arrow emblem: four arrows flying in to point at its middle, cut square
    const k = clamp((el - 0.2) / 0.9), ek = 1 - Math.pow(1 - k, 3), cx = 480, cy = 360, half = 134;
    if (I.arrow) {
      if (!this.emb) {                            // the arrow in the emblem's blue -> cyan
        const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x2 = c.getContext('2d');
        x2.drawImage(I.arrow, 0, 0); x2.globalCompositeOperation = 'source-in';
        const gr = x2.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#1d6ff0'); gr.addColorStop(1, '#2fe0ff');
        x2.fillStyle = gr; x2.fillRect(0, 0, 256, 256); this.emb = c;
      }
      g.save(); g.globalAlpha = ek;
      g.beginPath(); const ch = 14;                // the emblem's square with clipped corners
      g.moveTo(cx - half + ch, cy - half); g.lineTo(cx + half - ch, cy - half); g.lineTo(cx + half, cy - half + ch); g.lineTo(cx + half, cy + half - ch);
      g.lineTo(cx + half - ch, cy + half); g.lineTo(cx - half + ch, cy + half); g.lineTo(cx - half, cy + half - ch); g.lineTo(cx - half, cy - half + ch); g.closePath(); g.clip();
      [[-1, -1, 135], [1, -1, 225], [-1, 1, 45], [1, 1, -45]].forEach(([sx, sy, rot]) => {
        const fly = (1 - ek) * 420, d = 70;
        g.save(); g.translate(cx + sx * (d + fly), cy + sy * (d + fly)); g.rotate(rot * Math.PI / 180);
        g.drawImage(this.emb, -95, -95, 190, 190); g.restore();
      });
      g.restore();
    }
    // the logo (with a flash as the emblem lands), the button, (C)
    const lk = clamp((el - 0.9) / 0.4);
    if (I.logo) { g.globalAlpha = lk; g.drawImage(I.logo, W / 2 - 365, 264 - 91, 730, 182); g.globalAlpha = 1; }
    else text('DANCE DANCE REVOLUTION II', W / 2, 258, 58, '#fff', 'center');
    if (I.flare && el > 0.9 && el < 1.8) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - clamp((el - 0.9) / 0.9); g.drawImage(I.flare, W / 2 - 600, 258 - 150, 1200, 300); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    const bk = clamp((el - 1.4) / 0.3);
    if (I.letsDance) {
      g.save(); g.globalAlpha = bk; g.translate(W / 2, 517);
      const wob = Math.sin(t * 3); g.rotate(wob * 1.4 * Math.PI / 180); g.scale(1.03 + 0.01 * wob, 1.03 + 0.01 * wob);
      g.drawImage(I.letsDance, -219, -58, 438, 116); g.restore();
    } else if ((t * 2 | 0) % 2 === 0) text("Let's dance!", W / 2, 504, 40, '#fff', 'center');
    if (I.copy2 || I.copy) { const im = I.copy2 || I.copy; g.globalAlpha = bk; g.drawImage(im, W / 2 - im.width * 0.75, 634 - im.height * 0.75, im.width * 1.5, im.height * 1.5); g.globalAlpha = 1; }
    text('F11: full screen', W - 20, 706, 12, '#9ab', 'right', 'normal');
  },
  async begin() {
    if (this.busy) return;
    this.busy = true; audio();
    try {
      if (!SONGS.length || !A.ready) { const e = await bootLoad(); if (e !== null) { this.busy = false; return go(Setup.with(e)); } }
      sfx('SE_SYS_DECIDE01');
      // (no SELECT GAME screen: straight to DDR II's own mode select, like the real game)
      if (S.game !== 'ddr2') { S.game = 'ddr2'; saveSettings(); HP_LOOK = hpLike(); Bgm.cur = undefined; }
      Select.inFolder = null;
      go(ModeSel);
    } catch (e) { go(Setup.with(String(e))); }
    this.busy = false;
  },
  input(a, p) { this.idle = performance.now(); if (p && a === 'START') this.begin(); },
  click() { this.begin(); },
};

// ---- players (user data)
// ---- which game you're playing: DDR II, or Hottest Party (when its disc is added). Picked after
// your profile; the menus, music, song list and gameplay follow the game you pick.
function hpAvailable() { return SONGS.some(s => s.disc === 'hp'); }
// DDR II's own dancers (read from your disc as a .glb, see ddr2char.py): one per song, or the one you
// picked in Options > DANCE. Your own model (DANCER MODEL) still comes first; BUILT-IN = the mannequin.
let DDR2_CHARS = null;
// force: a dancer's file id that must be used (lessons: always DISCO, '202' - the teacher, as on the Wii)
async function ddr2Dancer(force) {
  if (!window.Dancer3D) return;
  if (!force) {
    if (S.dancerCustom && S.dancerModel) { if (Dancer3D.useExtras) Dancer3D.useExtras([]); return; }
    if (S.ddr2Char === 'builtin') { if (Dancer3D.useExtras) Dancer3D.useExtras([]); }
    if (S.ddr2Char === 'builtin') { if (Dancer3D.customFor && Dancer3D.customFor.startsWith('/api/ddr2char/')) await Dancer3D.useModel(''); return; }
  }
  if (!DDR2_CHARS) { try { DDR2_CHARS = await api('/api/ddr2chars'); } catch (e) { DDR2_CHARS = []; } }
  if (!DDR2_CHARS.length) return;
  if (force) {
    const c = DDR2_CHARS.find(x => x.id === force);
    if (c) { if (Dancer3D.useExtras) Dancer3D.useExtras([]); const url = '/api/ddr2char/' + c.id + '/' + c.outfits[0]; if (Dancer3D.customFor !== url) await Dancer3D.useModel(url); return; }
  }
  // The game's own rule (CSelect::setPlayerChr, main.dol 0x8004a728): RANDOM draws from the 9 dancers
  // (ids 200-208 = files CHR201-209) that are unlocked, then outfit = rand % 2 - but outfit 1 only
  // once that dancer's second outfit is unlocked (the disc's unlock table, type 2), otherwise outfit 0.
  const lockedAt = ddr2CharLockedAt;
  const gameId = c => +c.id - 1;
  const open = DDR2_CHARS.filter(c => gameId(c) >= 200 && gameId(c) <= 208 && !lockedAt(gameId(c), 0));
  const pool = open.length ? open : DDR2_CHARS;
  // (a chosen dancer who is still locked - EARN THEM on, not enough DDR POINTS - is not used)
  const chosen = DDR2_CHARS.find(c => c.id === S.ddr2Char);
  // MY CHARACTER's RANDOM (girls) / RANDOM (boys): the open dancers of that sex (character flags)
  const sexPool = S.ddr2Char === 'randomF' ? pool.filter(c => c.sex === 1) : S.ddr2Char === 'randomM' ? pool.filter(c => c.sex === 2) : pool;
  const from = sexPool.length ? sexPool : pool;
  const pick = chosen && !lockedAt(gameId(chosen), 0) ? chosen : from[Math.floor(Math.random() * from.length)];
  let outfit = pick.outfits.length > 1 ? pick.outfits[Math.floor(Math.random() * 2) % pick.outfits.length] : pick.outfits[0];
  if (lockedAt(gameId(pick), 1)) outfit = pick.outfits[0];
  const url = '/api/ddr2char/' + pick.id + '/' + outfit;
  if (Dancer3D.customFor !== url) await Dancer3D.useModel(url);
}
// the DDR POINTS a dancer (game id 200-208) or its second outfit (b = 1) still needs: the disc's unlock
// table, type 2 rows [points, 2, id, ?, outfit]; 0 = open (or SONG UNLOCKS is ALL OPEN). Only RENA (id
// 205) has her first outfit locked (690,000); every dancer's second outfit is locked at first.
function ddr2CharLockedAt(id, b) {
  if (S.unlocks !== 'on') return 0;
  const r = (DISC_UNLOCKS || []).find(x => x[1] === 2 && x[2] === id && x[4] === b);
  return r && SAVE.points < r[0] ? r[0] : 0;
}
function hp2Available() { return SONGS.some(s => s.disc === 'hp2'); }
function hp3Available() { return SONGS.some(s => s.disc === 'hp3'); }
function gamesAvailable() { return hpAvailable() || hp2Available() || hp3Available(); }
function gameNow() { return S.game === 'hp' && hpAvailable() ? 'hp' : S.game === 'hp2' && hp2Available() ? 'hp2' : S.game === 'hp3' && hp3Available() ? 'hp3' : S.game === 'custom' ? 'custom' : 'ddr2'; }
// DDR CUSTOM: every part of the game can come from DDR II or Hottest Party
const CUSTOM_PARTS = [
  { key: 'select', name: 'SONG SELECT', help: 'The song selection screen: DDR II or Hottest Party 1, 2 or 3.', values: ['ddr2', 'hp', 'hp2', 'hp3'] },
  { key: 'menu', name: 'MENUS & MUSIC', help: 'Menu backgrounds and menu music.' },
  { key: 'arrows', name: 'ARROWS', help: 'Arrows, step zone and freeze arrows.' },
  { key: 'board', name: 'PLAY BOARD', help: 'DDR II: the blue lane panel. Hottest Party: open lanes on the left.' },
  { key: 'hud', name: 'LIFE BAR & SCORE', help: 'The life gauge and score panel.' },
  { key: 'judge', name: 'JUDGMENTS & COMBO', help: 'MARVELOUS / PERFECT ... and the combo count.' },
  { key: 'banners', name: 'READY / GO / CLEARED', help: 'The start and end banners.' },
  { key: 'stage', name: 'BACKGROUND', help: 'DDR II: song videos / its background. Hottest Party: a 3D stage.' },
  { key: 'dancer', name: 'DANCER', help: 'DDR II\'s dancer, Hottest Party\'s dancers, Hottest Party 2\'s dancers, or none.', values: ['ddr2', 'hp', 'hp2', 'off'] },
  { key: 'score', name: 'TIMING & SCORING', help: 'DDR II: its timing windows and 1,000,000-point score. Hottest Party: its wider windows and step-number score (9 digits).' },
];
function customOf(key) { const c = S.custom || {}; return c[key] || (key === 'board' || key === 'stage' ? 'hp' : 'hp'); }
// which game a part looks like right now: 'ddr2' or 'hp' (or 'off' for the dancer)
function look(part) {
  const gm = gameNow();
  if (gm === 'custom') {
    const v = customOf(part);
    if (v === 'hp2' && part === 'select') return hp2Available() ? 'hp2' : hpAvailable() ? 'hp' : 'ddr2';
    if (v === 'hp3' && part === 'select') return hp3Available() ? 'hp3' : 'ddr2';
    return v === 'hp' && !hpAvailable() && part !== 'dancer' ? (part === 'select' || part === 'menu' ? 'ddr2' : v) : v;
  }
  if (gm === 'hp2' && part === 'select') return 'hp2';
  // Hottest Party 3 (same engine as HP2; its own menu pictures aren't read yet): HP2's look if that disc is here
  if (gm === 'hp3' && part === 'select') return 'hp3';
  return gm === 'ddr2' ? 'ddr2' : 'hp';
}
// Hottest Party style menus and song select
function hpLike() { const v = look('select'); return v === 'hp' || v === 'hp2'; }
// the songs of the game being played (DDR II also has your custom songs; DDR CUSTOM has everything)
function gameSongs() { const gm = gameNow(); return gm === 'custom' ? SONGS : gm === 'ddr2' ? SONGS.filter(s => !s.disc) : SONGS.filter(s => s.disc === gm); }
function stylesNow() { const gm = gameNow(); return gm === 'hp' || gm === 'hp2' || gm === 'hp3' ? STYLES.filter(st => st.style !== 'double') : STYLES; }
// the folder a song sits in when it's not one of the game's own
function folderOf(s) { return s.custom || s.disc ? s.folder : 'DANCE DANCE REVOLUTION II'; }
const GameSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0, logo: null,
  all: [{ id: 'ddr2', name: 'DANCE DANCE REVOLUTION II', sub: 'Wii (2011)' }, { id: 'hp', name: 'HOTTEST PARTY', sub: 'Wii (2007)' },
        { id: 'hp2', name: 'HOTTEST PARTY 2', sub: 'Wii (2008)' }, { id: 'hp3', name: 'HOTTEST PARTY 3', sub: 'Wii (2009)' },
        { id: 'custom', name: 'DDR CUSTOM', sub: 'mix and match' }],
  games: [],
  enter() {
    this.games = this.all.filter(gm => gm.id === 'ddr2' || gm.id === 'custom' || SONGS.some(s => s.disc === gm.id));
    this.i = Math.max(0, this.games.findIndex(gm => gm.id === S.game)); this.at = performance.now();
    if (!this.logo) { const im = new Image(); im.onload = () => { this.logo = im; }; im.src = '/api/hpimg/logo'; }
  },
  input(a, p) {
    if (!p) return;
    if (/^P[1-4][LU]$/.test(a)) { if (this.i > 0) { this.i--; sfx('SE_SYS_SELECT01'); } }
    else if (/^P[1-4][RD]$/.test(a)) { if (this.i < this.games.length - 1) { this.i++; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'START') {
      S.game = this.games[this.i].id; saveSettings();
      sfx('SE_SYS_DECIDE01');
      Select.inFolder = null; Select.idx = 0;
      HP_LOOK = hpLike();
      Bgm.cur = undefined; go(S.game === 'custom' ? CustomSel : ModeSel);
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Title); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('SELECT GAME', 210, 44, 34, '#fff', 'center');
    const N = this.games.length, k = clamp((performance.now() - this.at) / 250), gap = N > 4 ? 14 : N > 3 ? 20 : N > 2 ? 30 : 50, w = N > 4 ? 230 : N > 3 ? 285 : N > 2 ? 370 : 470, h = 380;
    const x0 = 640 - (N * w + (N - 1) * gap) / 2;
    this.games.forEach((gm, i) => {
      const on = this.i === i, x = x0 + i * (w + gap), y = 160 + (1 - k) * 40;
      const n = gm.id === 'custom' ? SONGS.length : gm.id === 'ddr2' ? SONGS.filter(s => !s.disc).length : SONGS.filter(s => s.disc === gm.id).length;
      g.save(); g.globalAlpha = k;
      if (on) { g.fillStyle = `rgba(255,138,30,${0.75 + 0.25 * Math.sin(t * 6)})`; g.fillRect(x - 10, y - 10, w + 20, h + 20); }
      const gr = g.createLinearGradient(0, y, 0, y + h);
      if (gm.id === 'hp') { gr.addColorStop(0, '#ffd23c'); gr.addColorStop(1, '#ff6a10'); }
      else if (gm.id === 'hp2') { gr.addColorStop(0, '#ff7ad8'); gr.addColorStop(1, '#8a2be2'); }
      else if (gm.id === 'hp3') { gr.addColorStop(0, '#36d1ff'); gr.addColorStop(1, '#1b3fd1'); }
      else if (gm.id === 'custom') { gr.addColorStop(0, '#5df0c0'); gr.addColorStop(1, '#127a6a'); } else { gr.addColorStop(0, on ? '#3aa0ff' : '#2a6cc0'); gr.addColorStop(1, on ? '#1446b0' : '#123a80'); }
      g.fillStyle = gr; g.fillRect(x, y, w, h);
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x, y, w, h);
      const logo = gm.id === 'hp' ? this.logo : gm.id === 'hp2' || gm.id === 'hp3' || gm.id === 'custom' ? null : A.img.logo;
      if (logo) { const sc = Math.min((w - 40) / logo.width, 210 / logo.height); g.drawImage(logo, x + w / 2 - logo.width * sc / 2, y + 130 - logo.height * sc / 2, logo.width * sc, logo.height * sc); }
      else text(gm.name, x + w / 2, y + 130, fitSize(gm.name, 30, w - 24), '#fff', 'center');
      text(gm.name, x + w / 2, y + 270, fitSize(gm.name, N > 3 ? 19 : 24, w - 20), on ? '#fff' : '#eef', 'center');
      text(gm.sub + '   ' + n + ' songs', x + w / 2, y + 310, 18, '#fff', 'center', 'normal');
      if (gm.id === 'ddr2') text('+ your custom songs', x + w / 2, y + 340, 15, '#e6f2ff', 'center', 'normal');
      g.restore();
    });
    text('Left/Right: choose    Enter: OK    Esc: back', W / 2, 690, 16, '#0d3770', 'center', 'normal');
  },
};

// DDR CUSTOM: pick which game each part of the game comes from
const CustomSel = {
  bgm: 'MU_BGM_FREE',
  i: 0,
  enter() { this.i = 0; if (!S.custom) S.custom = {}; },
  rows() { return CUSTOM_PARTS.concat([{ key: 'go', name: 'START' }]); },
  vals(r) { return r.values || ['ddr2', 'hp']; },
  label(v) { return v === 'ddr2' ? 'DDR II' : v === 'hp' ? 'HOTTEST PARTY' : v === 'hp2' ? 'HOTTEST PARTY 2' : v === 'hp3' ? 'HOTTEST PARTY 3' : 'OFF'; },
  input(a, p) {
    if (!p) return;
    const rows = this.rows(), r = rows[this.i];
    if (/^P[1-4]U$/.test(a)) { this.i = (this.i + rows.length - 1) % rows.length; sfx('SE_SYS_SELECT01'); }
    else if (/^P[1-4]D$/.test(a)) { this.i = (this.i + 1) % rows.length; sfx('SE_SYS_SELECT01'); }
    else if (/^P[1-4][LR]$/.test(a) && r.key !== 'go') {
      const v = this.vals(r), k = v.indexOf(customOf(r.key)), d = a.endsWith('R') ? 1 : -1;
      S.custom = Object.assign({}, S.custom, { [r.key]: v[(k + d + v.length) % v.length] }); saveSettings();
      HP_LOOK = hpLike(); Bgm.cur = undefined;
      sfx('SE_SYS_SELECT02');
    } else if (a === 'START') {
      if (r.key !== 'go') { this.i = rows.length - 1; sfx('SE_SYS_SELECT01'); return; }
      sfx('SE_SYS_DECIDE01'); HP_LOOK = hpLike(); Bgm.cur = undefined; go(ModeSel);
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(GameSel); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('DDR CUSTOM', 210, 44, 34, '#fff', 'center');
    const rows = this.rows(), x = 240, w = 800, rh = 46, y0 = 110;
    rows.forEach((r, i) => {
      const y = y0 + i * rh, on = this.i === i;
      g.fillStyle = on ? 'rgba(255,138,30,0.92)' : 'rgba(10,40,90,0.72)'; g.fillRect(x, y, w, rh - 6);
      if (r.key === 'go') { text('START  ▶', x + w / 2, y + rh / 2 - 3, 24, '#fff', 'center'); return; }
      text(r.name, x + 20, y + rh / 2 - 3, 20, '#fff', 'left');
      const v = customOf(r.key);
      text((on ? '◀  ' : '') + this.label(v) + (on ? '  ▶' : ''), x + w - 20, y + rh / 2 - 3, 20, v === 'hp' ? '#ffd23c' : v === 'off' ? '#bbb' : '#8fd0ff', 'right');
    });
    const r = rows[this.i];
    if (r.help) text(r.help, W / 2, y0 + rows.length * rh + 18, 17, '#0d3770', 'center', 'normal');
    if (!hpAvailable() && rows.some(r2 => r2.key !== 'go' && customOf(r2.key) === 'hp'))
      text('Hottest Party parts need your Hottest Party disc (added in Setup).', W / 2, y0 + rows.length * rh + 44, 15, '#a01010', 'center', 'normal');
    text('Up/Down: part    Left/Right: which game    Enter: start    Esc: back', W / 2, 690, 16, '#0d3770', 'center', 'normal');
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
      { key: 'folder', label: 'or: an extracted game folder (DDR II or Hottest Party)', value: '', ok: null },
      { key: 'hpiso', label: 'Extra disc: Hottest Party (USA) - optional', value: st.hpOk ? st.hpSongs + ' songs from ' + (st.hpFolder || '') : st.hpFolder ? 'could not read ' + st.hpFolder : 'not added (H: pick an extracted folder instead)', ok: st.hpOk ? true : null },
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
      const y = 228 + k * 66, on = this.i === k;
      g.fillStyle = on ? 'rgba(255,140,30,0.35)' : 'rgba(0,20,70,0.6)'; g.fillRect(230, y, 820, 58);
      if (on) { g.strokeStyle = '#ff9a20'; g.lineWidth = 3; g.strokeRect(230, y, 820, 58); }
      text(r.label, 250, y + 22, 22, r.key === 'go' && !(this.st && this.st.gameOk) ? '#889' : '#fff');
      if (r.value) text(r.value.length > 70 ? '...' + r.value.slice(-67) : r.value, 250, y + 46, 15, '#bcd', 'left', 'normal');
      if (r.ok === true) text('OK', 1020, y + 31, 24, '#5f8', 'right');
      else if (r.ok === false) text('NEEDED', 1020, y + 31, 18, r.key === 'ffmpeg' ? '#fd6' : '#f88', 'right');
    });
    if (this.st && this.st.busy) text('Working' + '.'.repeat(1 + ((t * 2) | 0) % 3), 640, 576, 20, '#ffd23c', 'center');
    if (this.msg) text(this.msg.slice(0, 120), 640, 604, 17, '#ffd', 'center', 'normal');
    text('Up/Down choose   Enter pick   K skip ffmpeg   D pick DolphinTool.exe   H Hottest Party folder   X remove Hottest Party', 640, 690, 15, '#dde', 'center', 'normal');
    text('ffmpeg is used for custom-song videos and pictures. Unzip the ffmpeg download first, then pick bin\\ffmpeg.exe inside it.', 640, 664, 14, '#cde', 'center', 'normal');
  },
  async act(what) {
    if (this.st && this.st.busy) return;
    if (what === 'go') {
      if (!(this.st && this.st.gameOk)) { this.msg = 'Pick your Wii disc first.'; return; }
      if (!this.st.ffmpegOk && !this.st.ffmpegSkip) { await api('/api/setup', { pick: 'skipffmpeg' }); }
      sfx('SE_SYS_DECIDE01');
      SONGS = await loadSongs(); await loadSave(); await loadDiscUnlocks();
      if (!A.ready) await A.load();
      if (S.game !== 'ddr2') { S.game = 'ddr2'; saveSettings(); HP_LOOK = hpLike(); }
      return go(ModeSel);
    }
    this.msg = what === 'folder' || what === 'hpfolder' ? 'A folder window should open (it may be behind the browser)...' : 'A file window should open (it may be behind the browser)...';
    try { this.st = await api('/api/setup', { pick: what }); } catch (e) { this.msg = String(e); return; }
    this.msg = this.st.msg || '';
    if (this.st.busy) this.refresh();
    if (what === 'iso' && this.st.gameOk && !this.st.ffmpegOk && !this.st.ffmpegSkip) this.i = 1;
    else if (this.st.gameOk && (this.st.ffmpegOk || this.st.ffmpegSkip) && what !== 'hpiso' && what !== 'hpfolder') this.i = this.rows().length - 1;
  },
  input(a, p) {
    if (!p) return;
    const n = this.rows().length;
    if (a === 'P1U' || a === 'P2U') { this.i = (this.i + n - 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1D' || a === 'P2D') { this.i = (this.i + 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (a === 'START') this.act(this.rows()[this.i].key);
  },
  key(e) {
    if (e.code === 'KeyK') { api('/api/setup', { pick: 'skipffmpeg' }).then(() => this.refresh()); this.msg = 'ffmpeg skipped (custom-song videos in old formats will not play).'; }
    if (e.code === 'KeyD') this.act('dolphintool');
    if (e.code === 'KeyH') this.act('hpfolder');
    if (e.code === 'KeyX') this.act('hpremove');
  },
  click() { this.act(this.rows()[this.i].key); },
};

function hasDouble(s) { return (s.double || []).some(v => v > 0) || !!(s.alt && (s.alt.double || []).some(v => v > 0)); }

// ---- style select, before the song list: SINGLE, DOUBLE, 2 PLAYERS (one mat each) or
// 2 PLAYERS DOUBLE (two mats each, four in all)
// ---- game modes (SELECT MODE): every game gets them all, named the way that game names them.
// RELAXED: you can't fail (DDR II / HP3's RELAXED MODE). MAX COMBO CHALLENGE: song after song until the
// combo breaks; the combo carries over from song to song (HP1's MAX CONTINUOUS COMBO, HP3's challenge).
const MODES = [
  // the game's own four (SELECT MODE cards 1-4, select_bin group 0)
  { id: 'free', card: 0, name: { ddr2: 'DANCE MODE', hp: 'FREE PLAY MODE', hp2: 'FREE PLAY', hp3: 'FREE PLAY' }, help: 'The main mode for music fitness.' },
  { id: 'workout', card: 1, name: { all: 'WORKOUT MODE' }, help: 'Exercise with DDR to burn calories!' },
  { id: 'training', card: 2, name: { all: 'TRAINING MODE' }, help: 'Practice difficult songs.' },
  { id: 'lesson', card: 3, name: { hp: 'LESSON', all: 'DDR SCHOOL' }, help: 'Learn the basics of DDR.' },
  // more modes (after the game's four)
  { id: 'relaxed', name: { all: 'RELAXED MODE' }, help: 'Dance at your own pace: the Dance Gauge never runs out, so you can\'t fail.' },
  { id: 'maxcombo', name: { hp: 'MAX CONTINUOUS COMBO', all: 'MAX COMBO CHALLENGE' }, help: 'Keep one combo going song after song. The run ends the moment your combo breaks.' },
  { id: 'course', name: { ddr2: 'COURSE MODE', hp3: 'DANCE ORDER', all: 'COURSE' }, help: 'Several songs in a row with one Dance Gauge. Or make your own course with ORDER EDIT.' },
  { id: 'gc', only: ['hp', 'hp2', 'ddr2'], name: { hp: 'GROOVE CIRCUIT', hp2: 'GROOVE ARENA', ddr2: 'TOURNAMENT MODE' }, help: 'Tour the venues, clear the crowd\'s dance requests and win the dance battles.' },
];
function modeName(m, gm = gameNow()) { return m.name[gm] || m.name.all || m.name.ddr2; }
function modesNow() { return MODES.filter(m => !m.only || m.only.includes(gameNow())); }
// modes two players can play together (they go through SELECT NUMBER OF PLAYERS)
const TWO_P_MODES = ['free', 'relaxed', 'maxcombo'];
// where a mode goes once the players have picked their record data
function modeNext() { return S.mode === 'course' ? CourseSel : S.mode === 'workout' ? WorkoutSet : S.mode === 'lesson' ? LessonSel : S.mode === 'gc' ? GCSel : Style; }

// ---- the game's menus are laid out on the Wii's 640 x 480 screen (select_bin's CAE layouts). The game
// shows that 4:3 layout in the middle of the 16:9 picture at 1.5x (measured on real-game footage: SELECT
// LESSON's arrows, 281 Wii pixels apart, are 430 apart on a 1280-wide screen); backgrounds fill the width.
const WX = x => 640 + (x - 320) * 1.5, WY = y => y * 1.5, WS = 1.5;
// a picture at a layout point: (px, py) = its pivot in the picture, sx/sy its scale (negative = mirrored)
function wspr(im, x, y, px, py, sx = 1, sy = 1, a = 1) {
  if (!im) return false;
  g.save(); g.globalAlpha *= a; g.translate(WX(x), WY(y)); g.scale(sx * WS, sy * WS); g.drawImage(im, -px, -py); g.restore();
  return true;
}
// the song-start screen: comAF's speaker ring (CAE block 0x13aa40: en_a01 the "DDR" disc, en_b01-03 the
// ring's three layers as top halves + their 180-degree copies, neji the screws; pictures /5/0/0/0-5).
// Each part has three tracks: 0 a short close-in (16 frames), 1 the opening (16 frames: the disc fades
// as the ring layers scale out from 1.35 to 2.3 and uncover the stage), 2 the long close-in (61 frames,
// with the shake at the end). Commands per frame at 30 fps (cae.py): x / y the pivot's place on the Wii
// screen, px / py the pivot in the picture, sx / sy scale (negative = turned round), rot degrees,
// alpha 0-255. Seen in the real game (Unbelievable footage): after the explanation screen the ring
// closes in, then opens out round the song's stage.
const RING = { parts: null, tex: null, loading: null };
function loadRing() {
  if (!RING.loading) RING.loading = (async () => {
    const j = await (await fetch('/api/cae/af')).json();
    const b = (j.blocks || []).find(x => x.at === 0x13aa40);
    if (!b || !b.parts || !A.tplOf) return;
    RING.tex = await Promise.all([0, 1, 2, 3, 4, 5].map(i => A.tplOf('af', '/5/0/0/' + i).then(t => t[0] && t[0].canvas).catch(() => null)));
    RING.parts = b.parts;
  })().catch(() => {});
  return RING.loading;
}
function ringLen(track) { return RING.parts ? Math.max(...RING.parts.map(p => (p.tracks[track] || {}).count || 0)) : 0; }
function drawRing(track, f) {
  if (!RING.parts || !RING.tex) return false;
  const list = [];
  for (const p of RING.parts) {
    const tr = p.tracks[track], im = RING.tex[p.sprite];
    if (!tr || !im) continue;
    const s = { x: 320, y: 240, px: 0, py: 0, sx: 1, sy: 1, rot: 0, alpha: 255, cell: 0 };
    for (const [t, k, v] of tr.script) { if (t > f) break; if (k in s) s[k] = v; }
    if (s.alpha > 0) list.push([s, im]);
  }
  // command 1 is the depth: higher numbers lie further back (the outer ring 5/4 over the screws 7-18,
  // over the gold ring 20/19, over the inner ring 23/22; the DDR disc 2 in front) - as in the footage
  list.sort((a, b) => b[0].cell - a[0].cell);
  for (const [s, im] of list) {
    g.save(); g.globalAlpha *= s.alpha / 255; g.translate(WX(s.x), WY(s.y)); g.rotate(s.rot * Math.PI / 180);
    g.scale(s.sx * WS, s.sy * WS); g.drawImage(im, -s.px, -s.py); g.restore();
  }
  return true;
}
// The combo performance (COMBO PERFORMANCE, main.dol 0x800fcdc8 / 0x800fd1d0): motions from
// game/GAME_APL_MOT01.bin (types 0-4 x 2, +1 for dancers flagged in 0x8026e898 / 0x802b8824) and camera
// moves from GAME_APL_CAM0n (n = the song record's +24 style + 1), loaded per style
const APL = {};
function loadAppeal(style) {
  if (!APL[style]) APL[style] = api('/api/appeal?style=' + style).catch(() => null);
  return APL[style];
}
// the game's message window (mes_wind_L, centre (319, 350) on the Wii screen) with its help text
// (measured on real-game footage: the window 837 x 192 on a 1280 screen, the words in the game's font,
// 12 px in from its left edge, the first line 25 px down, a line every 30 px)
function helpWindow(msg, x = 319, y = 357) {
  const M = A.menu || {};
  const cx = WX(x), cy = WY(y), L = cx - 419, T = cy - 96;
  if (M.helpWin) g.drawImage(M.helpWin, L, T, 838, 200); else { g.fillStyle = 'rgba(20,80,190,0.85)'; g.fillRect(L, T, 838, 192); }
  if (A.font) String(msg || '').split('\n').forEach((ln, i) => gtext(ln, L + 12, T + 25 + i * 30, 27, '#fff', 'left', 3.6, 1));
  else String(msg || '').split('\n').forEach((ln, i) => text(ln, L + 14, T + 25 + i * 30, 24, '#fff', 'left', 'bold'));
}
// a menu title in the game's title bar (select_bin title_wind, top left)
// (the bar centred at the top, its title in the middle - as in real-game footage)
function menuTitle(img, name) {
  const M = A.menu || {};
  if (!wspr(M.titleBar, 320, 30, 215, 40)) { g.fillStyle = '#2a7fd6'; g.fillRect(WX(320) - 322, 0, 645, 105); }
  if (img) { const h = 36, w = img.width * h / img.height; g.drawImage(img, WX(320) - w / 2, 54 - h / 2, w, h); }
  else {
    g.font = 'bold 36px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = '#fff'; g.strokeText(name, WX(320), 54); g.fillStyle = '#111'; g.fillText(name, WX(320), 54);
  }
}
// the button hints at the bottom right: the game's hint pictures (comAF group 1: 0 CONFIRM, 3 BACK,
// 4 SELECT, 32 Pointer:SELECT ...), placed as in real-game footage; text when they aren't loaded
function keyHints(s, ids = [0, 3, 4], pointer = true) {
  const P = A.hints;
  if (!P || !P[0]) { text(s, W - 24, 698, 15, '#0d3770', 'right', 'normal'); return; }
  ids.forEach((id, k) => { const im = P[id]; if (im) g.drawImage(im, 1125 - (ids.length - 1 - k) * 155 - 75, 651, 150, 24); });
  if (pointer && P[32]) g.drawImage(P[32], 1125 - 75, 677, 150, 24);
}
// DDR POINTS, bottom left of the song select (comAF_US.bin CAE block 0x2e2840, laid out on the 854 x 480
// widescreen screen, so 1.5x straight across; Wii screenshots): the DDR POINTS plate (/7/0/2) at (74.45,
// 432.85), tilted -3 degrees, and under it the points (Num_00 at (125.45, 445.95), 0.7x) or, once every
// unlock is earned, COMPLETE!! (/7/0/1) at (100.38, 449.52) tilted -3.25 degrees
function drawPointsPlate() {
  if (!A.img.ptsPlate) return false;
  const spr = (im, x, y, px, py, rot, sc = 1) => { if (!im) return; g.save(); g.translate(x * 1.5, y * 1.5); g.rotate(rot * Math.PI / 180); g.scale(sc * 1.5, sc * 1.5); g.drawImage(im, -px, -py); g.restore(); };
  spr(A.img.ptsPlate, 74.45, 432.85, 52, 12, -3);
  if (!nextUnlock(SAVE.points) && A.img.ptsComplete) spr(A.img.ptsComplete, 100.38, 449.52, 70, 15, -3.25);
  else {          // (how the game lines the digits up on that point is not decoded: centred here)
    g.save(); g.translate(125.45 * 1.5, 445.95 * 1.5); g.rotate(-3 * Math.PI / 180);
    num28(String(SAVE.points).padStart(7, '0'), 0, 0, 28 * 0.7 * 1.5, 'center');
    g.restore();
  }
  return true;
}
// numbers in the game's italic number set (comAF 28 x 28: 0-9, 20 ':', 21 '.', 22 '-', 23 '/')
function num28(s, x, y, h, align = 'center', step = 0.72) {
  const P = A.num28; if (!P || !P[0]) return text(s, x, y, h * 0.8, '#fff', align);
  const map = { ':': 20, '.': 21, '-': 22, '/': 23 }, adv = h * step;
  const w = [...s].length * adv; let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (const ch of s) { const im = P[ch >= '0' && ch <= '9' ? +ch : map[ch]]; if (im) g.drawImage(im, cx - (h - adv) / 2, y - h / 2, h, h); cx += adv; }
}

// FRIENDSHIP / SYNC (SELECT STYLE, 2 players): 'friend' | 'sync' | null
let GROUP = null;
// The group styles' judging (text_eng help): each step is judged for every player, then everyone gets the
// best of those judgments (FRIENDSHIP) or the worst (SYNC, where a MISS or an Almost fails the whole group).
// The step is settled once every player has been judged on it (hit, or missed when its window closes).
class GroupJudge {
  constructor(mode, ps) { this.mode = mode; this.ps = ps; this.pend = new Map(); }
  report(p, row, j) {
    let e = this.pend.get(row.off);
    if (!e) this.pend.set(row.off, e = []);
    e.push([p, row, j]);
    const need = this.ps.filter(q => (q.rowOffs || (q.rowOffs = new Set(q.rows.map(r => r.off)))).has(row.off)).length;
    if (e.length < need) return;
    this.pend.delete(row.off);
    const js = e.map(x => x[2]), gj = this.mode === 'friend' ? Math.max(...js) : Math.min(...js);
    for (const [q, r] of e) { q.groupApply = true; q.judgeRow(r, gj); q.groupApply = false; }
    if (this.mode === 'sync' && gj <= 1)
      for (const q of this.ps) if (!q.failed && q.o.gauge !== 'no fail') { q.failed = true; q.failAt = q.o.gauge === 'end' ? Infinity : q.now(); }
  }
}
let BATTLE = null;                                 // BATTLE MODE: { level } (0-3: the opponent profile group)
let MC = null;                                     // a MAX COMBO CHALLENGE run: { totals: [p1, p2], songs }
// ---- SELECT MODE: the game's numbered picture cards (two rows, staggered), the mode's dancer on the left,
// its name and help, and "SELECT MODE" with a reflection (select_bin group 0, layout blocks 0-2)
const MODE_SPOTS = [[324, 103], [468, 103], [394, 254], [538, 254]];
const ModeSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0, moved: 0,
  enter() { this.i = Math.max(0, modesNow().findIndex(m => m.id === (S.mode || 'free'))); this.at = this.moved = performance.now(); MC = null; COURSE = null; WK = null; GC = null; BATTLE = null; },
  input(a, p) {
    if (!p) return;
    const n = modesNow().length, d = /^P[1-4]([LDUR])$/.exec(a), was = this.i;
    if (d) {
      const k = d[1] === 'L' ? -1 : d[1] === 'R' ? 1 : d[1] === 'U' ? -2 : 2;
      this.i = Math.max(0, Math.min(n - 1, this.i + k));
      if (this.i !== was) { sfx('SE_SYS_SELECT01'); this.moved = performance.now(); }
    } else if (a === 'START') {
      S.mode = modesNow()[this.i].id; saveSettings(); sfx('SE_SYS_DECIDE01');
      MC = S.mode === 'maxcombo' ? { totals: [0, 0], songs: 0 } : null;
      if (TWO_P_MODES.includes(S.mode)) go(PlayerNum);
      else { PlayerNum.n = 1; P2 = null; go(Players.with(modeNext(), ModeSel)); }
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Title); }
  },
  click() { this.input('START', true); },
  // one card: the numbered gradient card with the mode's dancer shape in black and its name
  card(m, k, x, y, sc, on, t) {
    const M = A.menu || {}, ci = m.card !== undefined ? m.card : k % 4;
    const im = M.modeCard && M.modeCard[ci];
    g.save(); g.translate(WX(x), WY(y)); g.scale(sc * WS, sc * WS);
    if (on) { g.shadowColor = 'rgba(255,170,40,0.9)'; g.shadowBlur = 18 + 8 * Math.sin(t * 6); }
    if (im) g.drawImage(im, -78, -88); else { g.fillStyle = '#c050f0'; g.fillRect(-78, -88, 156, 176); }
    g.shadowBlur = 0;
    const sil = M.modeSil && M.modeSil[ci];
    if (sil) {                                     // the shape, in black, inside the card's colour panel
      if (!this.dark) this.dark = [];
      if (!this.dark[ci]) {
        const c = document.createElement('canvas'); c.width = sil.width; c.height = sil.height;
        const x2 = c.getContext('2d'); x2.drawImage(sil, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#000'; x2.fillRect(0, 0, c.width, c.height);
        this.dark[ci] = c;
      }
      const bob = on ? 1 + 0.04 * Math.max(0, Math.sin((performance.now() - this.moved) / 60)) : 1;
      g.save(); g.beginPath(); g.rect(-66, -54, 132, 136); g.clip();
      g.drawImage(this.dark[ci], -sil.width * 0.36 * bob, -48, sil.width * 0.72 * bob, sil.height * 0.72 * bob);
      g.restore();
    }
    if (m.card === undefined) {                   // our extra modes: their own number on the card's badge
      g.fillStyle = '#fff'; g.fillRect(-76, -86, 30, 30);
      g.font = 'bold 24px "Segoe UI", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#7a2bd0'; g.fillText(String(k + 1), -61, -71);
    }
    const nm = m.card !== undefined && gameNow() === 'ddr2' && M.modeCardName ? M.modeCardName[m.card] : null;
    if (nm) {                                      // the name, dark, on the card's white top strip
      if (!this.darkName) this.darkName = [];
      if (!this.darkName[m.card]) {
        const c = document.createElement('canvas'); c.width = nm.width; c.height = nm.height;
        const x2 = c.getContext('2d'); x2.drawImage(nm, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#2a2a3a'; x2.fillRect(0, 0, c.width, c.height);
        this.darkName[m.card] = c;
      }
      g.drawImage(this.darkName[m.card], -42, -86, 96, 32);
    }
    else {
      const words = modeName(m).split(' '), half = Math.ceil(words.length / 2);
      [words.slice(0, half).join(' '), words.slice(half).join(' ')].forEach((s, j) => {
        g.font = `bold ${fitSize(s, 15, 108)}px "Segoe UI", Arial, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.lineWidth = 3; g.strokeStyle = '#fff'; g.strokeText(s, -38, -76 + j * 16); g.fillStyle = '#222'; g.fillText(s, -38, -76 + j * 16);
      });
    }
    g.restore();
  },
  draw(t) {
    menuBackground(t);
    const M = A.menu || {}, L = modesNow(), m = L[this.i], k = clamp((performance.now() - this.at) / 300);
    const page = Math.floor(this.i / 4), mk = clamp((performance.now() - this.moved) / 250);
    // the dancer of the mode on the left: its white shape a little behind, then the dancer
    const di = m.card !== undefined ? m.card : this.i % 4, dx = (1 - mk) * -30;
    g.globalAlpha = mk * 0.75; wspr(M.dancerSil && M.dancerSil[di], 193 + dx * 0.5, 210, 100, 120); g.globalAlpha = 1;
    g.globalAlpha = mk; wspr(M.dancer && M.dancer[di], 180 + dx, 216, 100, 120); g.globalAlpha = 1;
    // the cards of this page (4 to a page), the chosen one full size, the others at 0.7, each with its reflection
    L.slice(page * 4, page * 4 + 4).forEach((md, j) => {
      const i = page * 4 + j, on = i === this.i, [x, y] = MODE_SPOTS[j], ox = (1 - k) * 26;
      g.globalAlpha = k;
      const sc = on ? 1 : 0.7;
      if (j >= 2) { const yr = y + 176 * sc + 2; g.save(); g.globalAlpha = k * 0.22; g.translate(0, WY(yr) * 2); g.scale(1, -1); this.card(md, i, x + ox, yr, sc, false, t); g.restore(); }
      this.card(md, i, x + ox, y, sc, on, t);
      g.globalAlpha = 1;
    });
    if (L.length > 4) {                           // more modes on the next page
      const pages = Math.ceil(L.length / 4);
      for (let q = 0; q < pages; q++) { g.fillStyle = q === page ? '#ff3ca0' : 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(WX(600) + q * 26, WY(22), 7, 0, Math.PI * 2); g.fill(); }
    }
    // the mode's name and help (the game's pictures for its four), then SELECT MODE, both mirrored below
    const nameImg = m.card !== undefined && gameNow() === 'ddr2' && M.modeName ? M.modeName[m.card] : null;
    if (!wspr(nameImg, 128, 351, 96, 32, 0.75, 0.675, mk)) text(modeName(m), WX(30), WY(351), 30, '#fff', 'left');
    const helpImg = m.card !== undefined && M.modeHelp ? M.modeHelp[m.card] : null;
    if (helpImg) { wspr(helpImg, 331, 378, 280, 13, 1, 0.9, mk); wspr(helpImg, 331, 458, 280, 13, 1, -0.9, mk * 0.4); }
    else text(m.help, WX(52), WY(378), fitSize(m.help, 22, WX(560), 'bold'), '#fff', 'left');
    if (M.selectMode) { wspr(M.selectMode, 216, 405, M.selectMode.width / 2, M.selectMode.height / 2, 1, 0.9, k); wspr(M.selectMode, 216, 436, M.selectMode.width / 2, M.selectMode.height / 2, 1, -0.9, k * 0.5); }
    else text('SELECT MODE', WX(216), WY(405), 40, '#fff', 'center');
    const best = m.id === 'maxcombo' && SAVE.modeRecords && SAVE.modeRecords.maxcombo;
    if (best) text('BEST ' + Object.entries(best).map(([st, n]) => st.toUpperCase() + ' ' + n).join('   '), WX(331), WY(330), 18, '#ffe86a', 'center');
    keyHints('Arrows: select    Enter: confirm    Esc: back');
  },
};

// ---- SELECT NUMBER OF PLAYERS (select_bin group 1): five picture cards; 3, 4 players and SYNC. GUEST
// (adding Wii Remotes) aren't in this version, so they're shown greyed
const PlayerNum = {
  bgm: 'MU_BGM_FREE',
  i: 0, n: 1, at: 0,
  cards: [{ n: 1, help: 'Play with 1 player.\nTo add Wii Remotes,\nselect SYNCHRONIZE GUEST.' }, { n: 2, help: 'Play with 2 players.\nTo add Wii Remotes,\nselect SYNCHRONIZE GUEST.' },
          { n: 3, help: 'Play with 3 players.\nTo add Wii Remotes,\nselect SYNCHRONIZE GUEST.' }, { n: 4, help: 'Play with 4 players.\nTo add Wii Remotes,\nselect SYNCHRONIZE GUEST.' },
          { n: 0, off: true, help: 'To add Wii Remotes,\nselect SYNCHRONIZE GUEST.\n(Not used on PC: every mat and pad is already on.)' }],
  enter() { this.i = Math.max(0, Math.min(3, this.n - 1)); this.at = performance.now(); },
  input(a, p) {
    if (!p) return;
    const d = /^P[1-4]([LR])$/.exec(a);
    if (d) { const j = Math.max(0, Math.min(4, this.i + (d[1] === 'L' ? -1 : 1))); if (j !== this.i) { this.i = j; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'START') {
      const c = this.cards[this.i];
      if (c.off) { sfx('SE_SYS_CANCEL'); return; }
      this.n = c.n; if (c.n === 1) P2 = null; if (c.n < 3) PX = [];
      // (3 and 4 players: the modes that take 2 players, NORMAL / FRIENDSHIP / SYNC)
      sfx('SE_SYS_DECIDE01'); go(Players.with(modeNext(), PlayerNum));
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(ModeSel); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const M = A.menu || {}, k = clamp((performance.now() - this.at) / 300);
    menuTitle(M.playersTitle, 'SELECT NUMBER OF PLAYERS');
    // real game: cards 158 Wii px apart from x 30, the chosen one larger
    this.cards.forEach((c, i) => {
      const on = i === this.i, x = 30 + i * 158 + (1 - k) * 20, y = 187, sc = on ? 0.8 : 0.68;
      g.save(); g.globalAlpha = k * (c.off ? 0.45 : 1);
      if (on) wspr(M.cardOn, x, y, 76, 94, sc, sc, 0.75 + 0.25 * Math.sin(t * 6));
      if (!wspr(M.cards && M.cards[i], x, y, 66, 84, sc, sc)) { g.fillStyle = '#29a8f0'; g.fillRect(WX(x) - 67, WY(y) - 86, 134, 172); text(c.n ? c.n + 'P' : 'SYNC', WX(x), WY(y), 30, '#fff', 'center'); }
      g.restore();
    });
    helpWindow(this.cards[this.i].help);
    keyHints('Left/Right: select    Enter: confirm    Esc: back');
  },
};

// ---- SELECT RECORD DATA (select_bin group 9, layout: a 3 x 2 grid of record windows): the game has
// RECORD A-D, GUEST and EDIT. Here the records are your players (as many as you like, 4 shown at a time;
// "New Entry" makes one), GUEST plays without saving, EDIT deletes a record. With 2 players, each picks.
// real game: RECORD A-D in a row, GUEST and EDIT under them
const REC_SPOTS = [[107, 163], [249, 163], [391, 163], [533, 163], [211, 273], [455, 273]];
const Players = {
  bgm: 'MU_BGM_FREE',
  i: 0, top: 0, typing: null, ask: null, edit: false, msg: '', who: 0, next: null, back: null,
  names() { return Object.keys(DATA.profiles); },
  with(next, back) { this.next = next; this.back = back; return this; },
  recs() { return this.names().concat(['']); },                 // '' = New Entry
  enter() {
    const n = this.names();
    this.who = 0; this.edit = false; this.ask = null; this.msg = '';
    const k = Math.max(0, n.indexOf(DATA.current));
    this.top = Math.max(0, k - 3); this.i = k - this.top;
    this.typing = n.length ? null : '';
    this.at = performance.now();
  },
  two() { return PlayerNum.n >= 2 && TWO_P_MODES.includes(S.mode) && this.next === Style; },
  count() { return this.two() ? PlayerNum.n : 1; },
  // a player's record is picked (null = GUEST)
  choose(name) {
    if (this.who === 0) {
      if (name) { usePlayer(name); fit(); writeSave(true); saveSettings(); }
      else { DATA.current = null; SAVE = { points: 0, records: {} }; }
      sfx('SE_SYS_DECIDE01');
      if (this.two()) { this.who = 1; this.edit = false; this.msg = ''; P2 = null; PX = []; return; }
    } else {
      // (each record can be used by one player at a time)
      const taken = [DATA.current, P2 && P2.name, ...PX.map(x => x && x.name)].slice(0, this.who);
      const by = name ? taken.indexOf(name) : -1;
      if (by >= 0) { this.msg = 'This data is already in use by Player ' + (by + 1) + '.'; sfx('SE_SYS_CANCEL'); return; }
      const prof = name && DATA.profiles[name];
      const P = { name, diff: prof && prof.opts && prof.opts.diff !== undefined ? prof.opts.diff : S.diff };
      if (this.who === 1) P2 = P; else PX[this.who - 2] = P;
      sfx('SE_SYS_DECIDE01');
      if (this.who + 1 < this.count()) { this.who++; this.edit = false; this.msg = ''; PX.length = Math.max(0, this.who - 2); return; }
    }
    go(this.next || ModeSel);
  },
  slot(j) {                                                     // grid slot -> {kind, name}
    if (j === 4) return { kind: 'guest' };
    if (j === 5) return { kind: 'edit' };
    const r = this.recs(), k = this.top + j;
    return k < r.length ? { kind: r[k] ? 'rec' : 'new', name: r[k] } : { kind: 'none' };
  },
  input(a, p) {
    if (!p || this.typing !== null) return;
    if (this.ask) {
      const q = this.ask; this.ask = null;
      if (a !== 'START') { sfx('SE_SYS_WINDOWOUT'); return; }
      if (q.kind === 'del') {
        delete DATA.profiles[q.name];
        if (DATA.current === q.name) { DATA.current = null; SAVE = { points: 0, records: {} }; }
        api('/api/save', DATA).catch(() => {});
        this.msg = 'Deleted ' + q.name + '.'; this.top = 0; this.i = 0; this.edit = false;
      } else if (q.kind === 'guest') this.choose(null);
      return;
    }
    const d = /^P[1-4]([LDUR])$/.exec(a);
    if (d) {
      const r = this.recs(), was = this.i + 100 * this.top;
      if (d[1] === 'L') { if (this.i === 0 && this.top > 0) this.top--; else if (this.i > 0) this.i--; }
      else if (d[1] === 'R') { if (this.i === 3 && this.top + 4 < r.length) this.top++; else if (this.i < 5) this.i++; }
      else if (d[1] === 'U') { if (this.i >= 3) this.i -= 3; else if (this.top > 0) this.top--; }
      else if (d[1] === 'D') { if (this.i < 3) this.i += 3; else if (this.i === 3 && this.top + 4 < r.length) this.top++; }
      while (this.i < 4 && this.slot(this.i).kind === 'none' && this.i > 0) this.i--;
      if (this.i + 100 * this.top !== was) sfx('SE_SYS_SELECT01');
      return;
    }
    if (a === 'START') {
      const s = this.slot(this.i);
      if (s.kind === 'edit') { this.edit = !this.edit; this.msg = ''; sfx('SE_SYS_DECIDE02'); if (this.edit) this.i = 0; return; }
      if (this.edit) {
        if (s.kind === 'rec') { this.ask = { kind: 'del', name: s.name }; sfx('SE_SYS_WINDOWIN'); }
        return;
      }
      if (s.kind === 'rec') this.choose(s.name);
      else if (s.kind === 'new') { this.typing = ''; sfx('SE_SYS_DECIDE02'); }
      else if (s.kind === 'guest') { this.ask = { kind: 'guest' }; sfx('SE_SYS_WINDOWIN'); }
    } else if (a === 'OPTIONS') { const s = this.slot(this.i); if (s.kind === 'rec') { this.ask = { kind: 'del', name: s.name }; sfx('SE_SYS_WINDOWIN'); } }
    else if (a === 'BACK') {
      if (this.edit) { this.edit = false; sfx('SE_SYS_WINDOWOUT'); return; }
      if (this.who >= 1) { this.who--; sfx('SE_SYS_WINDOWOUT'); return; }
      sfx('SE_SYS_WINDOWOUT'); go(this.back || ModeSel);
    }
  },
  key(e) {
    if (this.typing === null) return;
    e.preventDefault();
    if (e.code === 'Escape') { this.typing = this.names().length ? null : ''; if (this.typing === '' ) go(this.back || ModeSel); return; }
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
    const M = A.menu || {}, k = clamp((performance.now() - this.at) / 300);
    menuTitle(M.dataTitle, 'SELECT RECORD DATA');
    if (this.two()) text('PLAYER ' + (this.who + 1), W - 40, 60, 30, ['#3aa0ff', '#ff5aa0', '#3cc060', '#f0a020'][this.who], 'right');
    const btn = M.dataBtn || [];
    for (let j = 0; j < 6; j++) {
      const s = this.slot(j), [x, y] = REC_SPOTS[j], on = j === this.i && this.typing === null;
      if (s.kind === 'none') continue;
      const big = j >= 4, cx = WX(x), cy = WY(y), sc = on ? 1.12 : 1;
      const bw = (big ? 225 : 165) * sc, bh = 95 * sc;
      g.save(); g.globalAlpha = k * (this.edit && s.kind !== 'rec' && s.kind !== 'edit' ? 0.4 : 1);
      const frame = big ? M.geOn : M.recOn;
      if (on && frame) { const fw = bw * 1.12, fh = bh * 1.16; g.globalAlpha *= 0.85 + 0.15 * Math.sin(t * 6); g.drawImage(frame, cx - fw / 2, cy - fh / 2, fw, fh); g.globalAlpha = k; }
      const im = big ? (M.guestEdit && M.guestEdit[j - 4]) : M.recBtn;
      if (im) g.drawImage(im, cx - bw / 2, cy - bh / 2, bw, bh); else { g.fillStyle = '#7fe0ff'; g.fillRect(cx - bw / 2, cy - bh / 2, bw, bh); }
      if (s.kind === 'rec' || s.kind === 'new') {
        // the name in the dark label at the top, the record's points below
        const nm = s.kind === 'rec' ? s.name : 'NEW ENTRY';
        gtext(nm, cx, cy - bh * 0.27, Math.min(26, 26 * 120 / Math.max(1, gfontWidth(nm, 26, 2))) * sc, '#fff', 'center', 2, 1);
        if (s.kind === 'rec') {
          const pr = DATA.profiles[s.name] || {};
          gtext((pr.points || 0) + ' pts', cx, cy + bh * 0.2, 18 * sc, '#14306e', 'center', 2, 1);
        }
        if (this.who >= 1 && s.name === DATA.current && M.badges && M.badges[0]) g.drawImage(M.badges[0], cx - bw / 2 - 8, cy - bh / 2 - 22, 40, 40);
        else if (on && M.badges && M.badges[this.who]) g.drawImage(M.badges[this.who], cx - bw / 2 - 8, cy - bh / 2 - 22, 40, 40);
        else if (on && this.who >= 2) { g.fillStyle = this.who === 2 ? '#3cc060' : '#f0a020'; g.beginPath(); g.arc(cx - bw / 2 + 12, cy - bh / 2 - 2, 18, 0, Math.PI * 2); g.fill(); text(String(this.who + 1), cx - bw / 2 + 12, cy - bh / 2 - 1, 20, '#fff', 'center'); }
      }
      if (s.kind === 'edit' && this.edit) gtext('DONE', cx, cy + 20, 20, '#14306e', 'center', 2, 1);
      g.restore();
    }
    const n = this.recs().length;
    if (this.top > 0) text('◀', WX(28), WY(163), 40, '#ff3ca0', 'center');
    if (this.top + 4 < n) text('▶', WX(612), WY(163), 40, '#ff3ca0', 'center');
    const help = this.ask ? (this.ask.kind === 'del' ? 'Are you sure you want to delete\nthis record data?   (' + this.ask.name + ')\nEnter: YES    Esc: NO'
                                                     : 'Game play results will not be\nsaved. Is this okay?\nEnter: YES    Esc: NO')
      : this.msg ? this.msg
      : this.edit ? 'Select the record data\nyou want to delete.'
      : this.who >= 1 ? 'Select player data for Player ' + (this.who + 1) + '.\nSelecting "GUEST" will not\nsave any record data.'
      : 'Select the record data you want\nto use. Selecting "GUEST" will not\nsave any record data.';
    helpWindow(help, 319, 389);
    if (this.typing !== null) {
      g.fillStyle = 'rgba(0,30,90,0.75)'; g.fillRect(0, 0, W, H);
      helpWindow('Type a name (up to 8 letters),\nthen press Enter.', 319, 300);
      g.fillStyle = 'rgba(0,20,70,0.92)'; g.fillRect(420, 250, 440, 70);
      text(this.typing + ((t * 2 | 0) % 2 ? '_' : ' '), 640, 285, 40, '#fff', 'center');
      text('NAME', 640, 225, 28, '#ffd23c', 'center');
    }
    keyHints(this.typing !== null ? 'Enter: OK    Esc: cancel' : 'Arrows: select    Enter: confirm    Tab: delete    Esc: back');
  },
};

// ---- SELECT STYLE (select_bin group 1 cards: NORMAL, FRIENDSHIP, SYNC, DOUBLE). 1 player: NORMAL or DOUBLE;
// 2 players: NORMAL (each scored on their own), FRIENDSHIP and SYNC (shared judgments: not in this version
// yet, greyed), and 2 PLAYERS DOUBLE (two mats each, a PC extra)
function styleCards() {
  const two = PlayerNum.n >= 2 && TWO_P_MODES.includes(S.mode), many = two && PlayerNum.n > 2, hasD = !many && stylesNow().some(st => st.style === 'double');
  const L = two ? [
    { card: 5, name: 'NORMAL', style: 'single', two: true, help: 'For 2 player. Normal gameplay.' },
    { card: 6, name: 'FRIENDSHIP', style: 'single', two: true, group: 'friend', help: 'For 2 or more players. The highest\njudgment in the group for each arrow\nis awarded to all players.' },
    { card: 7, name: 'SYNC', style: 'single', two: true, group: 'sync', help: 'For 2 or more players. Group judgment\nis based on the lowest accuracy. A "MISS"\nor "NOT QUITE" score will fail the game!' },
    { card: 8, name: '2P DOUBLE', style: 'double', two: true, badge: '2P', help: 'For 2 players with 2 DDR Controllers each\n(4 mats in all).' },
  ] : [                                        // (the real game shows all four, the group styles greyed)
    { card: 5, name: 'NORMAL', style: 'single', two: false, help: 'For 1 player. Normal gameplay.' },
    { card: 6, name: 'FRIENDSHIP', off: true, help: 'For 2 or more players. The highest\njudgment in the group for each arrow\nis awarded to all players.' },
    // (PC: in DANCE MODE, SYNC's place - it needs 2 players - is the battle against the computer)
    S.mode === 'free' ? { card: -1, name: 'BATTLE CPU', style: 'single', two: false, battle: true, help: 'For 1 player. Dance against a\ncomputer opponent, 2 player VERSUS style.\nBeat its score to win!' }
      : { card: 7, name: 'SYNC', off: true, help: 'For 2 or more players. Group judgment\nis based on the lowest accuracy. A "MISS"\nor "NOT QUITE" score will fail the game!' },
    { card: 8, name: 'DOUBLE', style: 'double', two: false, help: 'For 1 player only. This style is\nplayable with 2 DDR Controllers.' },
  ];
  return L.filter(c => c.style !== 'double' || hasD);
}
const Style = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0,
  enter() {
    if (hpLike() && S.style === 'double') S.style = 'single';
    BATTLE = null;
    const L = styleCards();
    this.i = Math.max(0, L.findIndex(c => !c.off && c.style === S.style && (c.group || null) === GROUP));
    this.at = performance.now();
  },
  input(a, p) {
    if (!p) return;
    const L = styleCards(), d = /^P[1-4]([LR])$/.exec(a);
    if (d) { const j = Math.max(0, Math.min(L.length - 1, this.i + (d[1] === 'L' ? -1 : 1))); if (j !== this.i) { this.i = j; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'START') {
      const st = L[this.i];
      if (st.off) { sfx('SE_SYS_CANCEL'); return; }
      if (st.battle) { sfx('SE_SYS_DECIDE01'); S.style = 'single'; saveSettings(); GROUP = null; P2 = null; PX = []; go(BattleSel); return; }
      S.style = st.style; saveSettings(); GROUP = st.group || null;
      if (GROUP && P2) P2.diff = S.diff;
      if (GROUP) PX.forEach(x => { if (x) x.diff = S.diff; });
      sfx('SE_SYS_DECIDE01');
      Select.query = '';
      if (!st.two) { P2 = null; PX = []; }
      go(Select); sfx('VO_NAR_SELECTMUSIC');
      if (st.two && !P2) { Select.openJoin(); Select.join.fromStyle = true; Select.join.list = Select.join.list.filter(x => x !== '1 PLAYER ONLY'); }
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Players); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const M = A.menu || {}, k = clamp((performance.now() - this.at) / 300), L = styleCards();
    menuTitle(null, 'SELECT STYLE');
    let nS = 0, nD = 0;
    for (const s of gameSongs()) { if (isLocked(s)) continue; nS++; if (hasDouble(s)) nD++; }
    // real game: cards 160 Wii px apart around the middle, the chosen one larger
    L.forEach((c, i) => {
      const on = i === this.i, x = 320 + (i - (L.length - 1) / 2) * 160 + (1 - k) * 20, y = 187, sc = on ? 0.88 : 0.68;
      g.save(); g.globalAlpha = k * (c.off ? 0.6 : 1);
      if (on) wspr(M.cardOn, x, y, 76, 94, sc, sc, 0.75 + 0.25 * Math.sin(t * 6));
      if (c.battle) {                                  // our own card (the game has none for it): VS on a red-blue split
        const w = 132 * sc * WS, h = 168 * sc * WS, X = WX(x) - w / 2, Y = WY(y) - h / 2;
        g.fillStyle = '#f0a818'; g.fillRect(X, Y, w, h);
        const gr = g.createLinearGradient(X, Y, X + w, Y + h); gr.addColorStop(0, '#2a7dff'); gr.addColorStop(0.5, '#7a3cff'); gr.addColorStop(1, '#ff3c6a');
        g.fillStyle = gr; g.fillRect(X + 8 * sc, Y + 8 * sc, w - 16 * sc, h * 0.7);
        text('VS', WX(x), Y + h * 0.36, Math.round(64 * sc), '#ffe86a', 'center');
        text('1P  \u2194  CPU', WX(x), Y + h * 0.6, Math.round(18 * sc), '#fff', 'center');
        text('BATTLE CPU', WX(x), Y + h * 0.88, Math.round(22 * sc), '#7a3a00', 'center');
      } else if (!wspr(M.cards && M.cards[c.card], x, y, 66, 84, sc, sc)) { g.fillStyle = '#f0b020'; g.fillRect(WX(x) - 67, WY(y) - 86, 134, 172); text(c.name, WX(x), WY(y), 24, '#fff', 'center'); }
      if (c.badge) { g.fillStyle = '#ff3ca0'; g.fillRect(WX(x) + 30, WY(y) - 86, 44, 26); text(c.badge, WX(x) + 52, WY(y) - 73, 18, '#fff', 'center'); }
      g.restore();
    });
    helpWindow(L[this.i].help);
    keyHints('Left/Right: select    Enter: confirm    Esc: back');
  },
};

// the MAX COMBO CHALLENGE result: the run's combo, and your best
const MCResult = {
  bgm: 'MU_BGM_FREE',
  with(totals, songs) { this.totals = totals; this.songs = songs; this.at = performance.now(); return this; },
  enter() {
    const st = S.style + (P2 ? '2p' : '');
    SAVE.modeRecords = SAVE.modeRecords || {}; SAVE.modeRecords.maxcombo = SAVE.modeRecords.maxcombo || {};
    const best = Math.max(...this.totals);
    this.newBest = best > (SAVE.modeRecords.maxcombo[st] || 0);
    if (this.newBest) { SAVE.modeRecords.maxcombo[st] = best; writeSave(); }
    this.best = SAVE.modeRecords.maxcombo[st] || 0;
    sfx('VO_NAR_GAMEOVER');
  },
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_DECIDE01'); MC = null; go(ModeSel); } },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const k = clamp((performance.now() - this.at) / 400);
    g.globalAlpha = k;
    g.fillStyle = 'rgba(10,30,90,0.85)'; g.fillRect(290, 130, 700, 440); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(290, 130, 700, 440);
    text(modeName(MODES[2]), 640, 185, 38, '#ffe86a', 'center');
    text((S.style === 'double' ? 'DOUBLE' : 'SINGLE') + ' STYLE', 640, 235, 22, '#fff', 'center');
    this.totals.slice(0, P2 ? 2 : 1).forEach((n, i, arr) => {
      const x = arr.length > 1 ? 470 + i * 340 : 640;
      if (arr.length > 1) text('PLAYER ' + (i + 1), x, 300, 20, '#bfe0ff', 'center');
      text(String(n), x, 370, 90, '#fff', 'center'); text('COMBOS', x, 440, 24, '#ffd23c', 'center');
    });
    text(this.songs + (this.songs === 1 ? ' song' : ' songs') + '   BEST ' + this.best + (this.newBest ? '   NEW RECORD!' : ''), 640, 510, 20, this.newBest ? '#ffe86a' : '#fff', 'center');
    g.globalAlpha = 1;
    text('Enter: back to SELECT MODE', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// ---- BATTLE MODE: you against a computer opponent (Hottest Party 2's battle opponent, decoded) on the same
// chart, on the 2 player VERSUS screen (no second dancer). Its four strengths are HP2's four profile groups.
const BATTLE_LEVELS = [
  { name: 'LEVEL 1', who: 'ROOKIE', help: 'Hottest Party 2\'s first dance battles.\nMostly GREAT, with some BOO and ALMOST.' },
  { name: 'LEVEL 2', who: 'CHALLENGER', help: 'A burning arena\'s opponent in Hottest Party 2.\nA few more PERFECTs, fewer misses.' },
  { name: 'LEVEL 3', who: 'RIVAL', help: 'Hottest Party 2\'s ROUND 2 opponent.\nPERFECT as often as GREAT, rare misses.' },
  { name: 'LEVEL 4', who: 'CHAMPION', help: 'A burning ROUND 2 arena\'s opponent.\nMostly PERFECT and MARVELOUS, almost never misses.' },
];
const BattleSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0,
  enter() { this.i = Math.max(0, Math.min(3, (SAVE.battle && SAVE.battle.last) || 0)); this.at = performance.now(); GROUP = null; PX = []; P2 = null; },
  input(a, p) {
    if (!p) return;
    const d = /^P[1-4]([LDUR])$/.exec(a);
    if (d) {
      const j = Math.max(0, Math.min(3, this.i + (d[1] === 'L' || d[1] === 'U' ? -1 : 1)));
      if (j !== this.i) { this.i = j; sfx('SE_SYS_SELECT01'); }
    } else if (a === 'START') {
      sfx('SE_SYS_DECIDE01'); BATTLE = { level: this.i };
      SAVE.battle = SAVE.battle || {}; SAVE.battle.last = this.i; writeSave();
      // like 2 player VERSUS (single style): no SELECT STYLE, straight to the songs
      S.style = 'single'; GROUP = null; P2 = null; PX = []; Select.query = '';
      go(Select); sfx('VO_NAR_SELECTMUSIC');
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); BATTLE = null; go(Style); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    menuTitle(null, 'SELECT OPPONENT');
    const k = clamp((performance.now() - this.at) / 300), rec = (SAVE.battle && SAVE.battle.rec) || {};
    g.save(); g.globalAlpha = k;
    BATTLE_LEVELS.forEach((L, i) => {
      const on = i === this.i, x = 640 + (i - 1.5) * 250, y = 330, w = on ? 220 : 196, h = on ? 230 : 204;
      g.fillStyle = on ? 'rgba(200,40,120,0.92)' : 'rgba(20,40,110,0.85)'; g.fillRect(x - w / 2, y - h / 2, w, h);
      g.strokeStyle = on ? '#ffe86a' : '#fff'; g.lineWidth = on ? 5 : 3; g.strokeRect(x - w / 2, y - h / 2, w, h);
      text(L.name, x, y - 70, on ? 30 : 26, '#ffe86a', 'center');
      text(L.who, x, y - 25, on ? 24 : 20, '#fff', 'center');
      for (let s = 0; s <= i; s++) text('\u2605', x - 15 * i + 30 * s, y + 20, 26, '#ffd23c', 'center');
      const r = rec[i] || { w: 0, l: 0 };
      text('WIN ' + r.w + '   LOSE ' + r.l, x, y + 70, 17, '#bfe0ff', 'center', 'normal');
    });
    g.restore();
    helpWindow(BATTLE_LEVELS[this.i].help, 319, 380);
    keyHints('Left/Right: select    Enter: confirm    Esc: back');
  },
};
// after each song: who won, then back to the song list for the next battle
const BattleResult = {
  bgm: 'MU_BGM_FREE',
  with(ps) { this.ps = ps; this.at = performance.now(); return this; },
  enter() {
    const me = this.ps[0], com = this.ps.find(p => p.com !== undefined) || this.ps[1];
    this.me = me.failed ? 0 : me.score; this.com = com.score;
    this.res = me.failed || this.me < this.com ? 'lose' : this.me > this.com ? 'win' : 'draw';
    const lv = BATTLE ? BATTLE.level : 0;
    SAVE.battle = SAVE.battle || {}; SAVE.battle.rec = SAVE.battle.rec || {};
    const r = SAVE.battle.rec[lv] = SAVE.battle.rec[lv] || { w: 0, l: 0 };
    if (this.res === 'win') r.w++; else if (this.res === 'lose') r.l++;
    writeSave();
    sfx(this.res === 'win' ? 'SE_DDR_FULLCOMBO' : 'SE_SYS_WINDOWOUT');
  },
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_DECIDE01'); go(Select); } },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const k = clamp((performance.now() - this.at) / 400), lv = BATTLE ? BATTLE.level : 0;
    g.globalAlpha = k;
    g.fillStyle = 'rgba(10,30,90,0.85)'; g.fillRect(240, 120, 800, 460); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(240, 120, 800, 460);
    text('BATTLE  ' + BATTLE_LEVELS[lv].name + '  ' + BATTLE_LEVELS[lv].who, 640, 170, 26, '#bfe0ff', 'center');
    const big = { win: ['YOU WIN!', '#7dff9a'], lose: ['YOU LOSE', '#ff8a8a'], draw: ['DRAW', '#ffe86a'] }[this.res];
    text(big[0], 640, 250, 72, big[1], 'center');
    const dg = this.ps[0].hpRules ? 9 : 7;
    [['YOU', this.me, this.ps[0].failed ? 'FAILED' : ''], ['COM', this.com, '']].forEach(([who, sc, note], i) => {
      const x = 450 + i * 380;
      text(who, x, 350, 26, i ? '#ff9ad5' : '#5ad0ff', 'center');
      text(String(sc).padStart(dg, '0'), x, 420, 48, '#fff', 'center');
      if (note) text(note, x, 470, 22, '#ff8a8a', 'center');
    });
    const r = (SAVE.battle.rec || {})[lv] || { w: 0, l: 0 };
    text('WIN ' + r.w + '   LOSE ' + r.l, 640, 540, 20, '#fff', 'center', 'normal');
    g.globalAlpha = 1;
    keyHints('Enter: next song');
  },
};
// ---- COURSES: songs in a row on one Dance Gauge (it carries over; it running out ends the course).
// Every game gets ten courses made from its own songs, from easy to hard, plus up to six of your own
// (ORDER EDIT, kept in your player data). (The games' own course lists aren't read from the discs yet.)
let COURSE = null;                                  // the course being played: { name, slots, diff, i, life: [], scores: [], failed }
// a song slot from the game's tables -> the song to play (a cut slot plays the song's SHORT version)
// London EVOLVED's three songs (Ver.A / B / C, each its own chart and dance) are one entry in song select;
// starting it picks one of the three at random (main.dol 0x8004be98: id 92 + 2 x (rand() % 3))
function songVersion(song, v) { return v ? Object.assign({}, song, v, { versions: null, versionOf: song.slot }) : song; }
function pickVersion(song) {
  if (!song || !song.versions || !song.versions.length) return song;
  return songVersion(song, song.versions[Math.floor(Math.random() * song.versions.length)]);
}
function songForSlot(sl) {
  const s = SONGS.find(s2 => s2.slot === sl);
  if (s) return s;
  const f = SONGS.find(s2 => s2.alt && s2.alt.slot === sl);
  if (f) return Object.assign({}, f, f.alt, { isShort: true, movie: f.movie });
  const g = SONGS.find(s2 => s2.versions && s2.versions.some(v => v.slot === sl));
  if (g) return songVersion(g, g.versions.find(v => v.slot === sl));
  return SONGS.find(s2 => s2.full === sl || s2.cut === sl) || null;
}
let DDR2_COURSES = null;           // DDR II's own COURSE 1-10 / WORKOUT 1-10 lists (main.dol)
async function loadDdr2Courses() {
  if (DDR2_COURSES) return DDR2_COURSES;
  try { DDR2_COURSES = (await api('/api/ddr2courses')) || {}; } catch (e) { DDR2_COURSES = {}; }
  return DDR2_COURSES;
}
function builtInCourses() {
  if (gameNow() === 'ddr2' && DDR2_COURSES && DDR2_COURSES.courses)   // the game's own courses
    return DDR2_COURSES.courses.map((sl, c) => ({ name: 'COURSE ' + (c + 1), slots: sl.filter(x => songForSlot(x)) }))
      .concat((DDR2_COURSES.workouts || []).map((sl, c) => ({ name: 'WORKOUT ' + (c + 1), slots: sl.filter(x => songForSlot(x)) })))
      .filter(c => c.slots.length);
  // Hottest Party 2's own 20 courses (main.dol, the ones its GROOVE ARENA asks for: 3 or 4 songs each)
  if (gameNow() === 'hp2' && GAD && GAD.courses)
    return GAD.courses.map((sl, c) => ({ name: 'COURSE ' + (c + 1), slots: sl.map(x => 2000 + x).filter(x => songForSlot(x)) })).filter(c => c.slots.length);
  return builtInCoursesMade();
}
function builtInCoursesMade() {
  const songs = gameSongs().filter(s => !s.random && !s.folderTile && !isLocked(s) && s.single && s.single[1] > 0);
  const lvl = s => s.single[1] || 0;                  // by the BASIC level
  const sorted = songs.slice().sort((a, b) => lvl(a) - lvl(b) || a.slot - b.slot);
  const out = [];
  for (let c = 0; c < 10 && sorted.length >= 4; c++) {
    const from = Math.floor((sorted.length - 4) * c / 9), pick = [];
    for (let k = 0; pick.length < 4 && from + k * 3 < sorted.length + 12; k++) {
      const s2 = sorted[Math.min(sorted.length - 1, from + ((k * 3 + c) % Math.max(1, sorted.length - from)))];
      if (!pick.includes(s2)) pick.push(s2);
    }
    while (pick.length < 4) { const s2 = sorted[(from + pick.length * 7) % sorted.length]; if (!pick.includes(s2)) pick.push(s2); else break; }
    out.push({ name: 'COURSE ' + (c + 1), slots: pick.map(s2 => s2.slot) });
  }
  return out;
}
function myOrders() { SAVE.orders = SAVE.orders || []; return SAVE.orders; }
const CourseSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, at: 0, list: [],
  async enter() {
    await loadDdr2Courses();
    if (gameNow() === 'hp2') await GC_HP2.load();
    this.list = builtInCourses().concat(myOrders().map((o, k) => ({ name: 'ORDER ' + (k + 1), slots: o, mine: k })));
    this.list.push({ name: 'ORDER EDIT', edit: true });
    this.i = Math.min(this.i, this.list.length - 1); this.at = performance.now();
    if (![4, 1, 2, 3].includes(S.diff)) S.diff = 1;
  },
  input(a, p) {
    if (!p) return;
    const c = this.list[this.i];
    if (a === 'P1U') { if (this.i > 0) { this.i--; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1D') { if (this.i < this.list.length - 1) { this.i++; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1L' || a === 'P1R') {               // the difficulty for the whole course
      const order = [4, 1, 2, 3], k = order.indexOf(S.diff);
      S.diff = order[Math.max(0, Math.min(3, k + (a === 'P1R' ? 1 : -1)))]; sfx('SE_SYS_SELECT02');
    } else if (a === 'START') {
      sfx('SE_SYS_DECIDE01');
      if (c.edit) { go(OrderEdit.with(null)); return; }
      const songs = c.slots.map(sl => songForSlot(sl)).filter(Boolean);
      if (!songs.length) return;
      S.style = 'single'; P2 = null;
      COURSE = { name: c.name, slots: c.slots.filter(sl => songForSlot(sl)), diff: S.diff, i: 0, life: [], scores: [], failed: false };
      startCourseSong();
    } else if (a === 'OPTIONS' && c.mine !== undefined) { go(OrderEdit.with(c.mine)); }
    else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); if (this.fromSelect) { this.fromSelect = false; go(Select); } else go(ModeSel); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('SELECT COURSE', 210, 44, 34, '#fff', 'center');
    const di = DIFFS.findIndex(x => x[0] === S.diff);
    text('◀  ' + DIFFS[di][1] + '  ▶', 1000, 44, 26, DIFFS[di][2], 'center');
    const top = Math.max(0, Math.min(this.i - 4, this.list.length - 9));
    this.list.slice(top, top + 9).forEach((c, k) => {
      const i = top + k, on = i === this.i, y = 100 + k * 62;
      g.fillStyle = on ? 'rgba(255,138,30,0.95)' : c.edit ? 'rgba(20,120,80,0.85)' : c.mine !== undefined ? 'rgba(120,40,140,0.85)' : 'rgba(20,60,140,0.85)';
      g.fillRect(80, y, 420, 52); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(80, y, 420, 52);
      text(c.name, 100, y + 27, 24, '#fff', 'left');
      if (c.slots) {
        const best = SAVE.modeRecords && SAVE.modeRecords.course && SAVE.modeRecords.course[S.game + ':' + c.name + ':' + S.diff];
        if (best) text(String(best).padStart(7, '0'), 480, y + 27, 18, '#ffe86a', 'right');
      }
    });
    const c = this.list[this.i];
    if (!c) return;                                   // (the course list is still loading)
    g.fillStyle = 'rgba(10,30,90,0.85)'; g.fillRect(540, 100, 660, 550); g.strokeStyle = '#fff'; g.strokeRect(540, 100, 660, 550);
    if (c.edit) {
      text('ORDER EDIT', 870, 150, 30, '#ffe86a', 'center');
      text('Make your own course: up to 6 songs in the order you want.', 870, 200, 18, '#fff', 'center', 'normal');
      text('Your courses show up here as ORDER 1, ORDER 2 ...', 870, 230, 18, '#fff', 'center', 'normal');
    } else {
      text(c.name, 870, 145, 30, '#ffe86a', 'center');
      c.slots.forEach((sl, k) => {
        const s2 = SONGS.find(x => x.slot === sl); if (!s2) return;
        const lv = (levelsOf(s2) || [])[DIFFS.findIndex(x => x[0] === S.diff)] || 0;
        text((k + 1) + '. ' + s2.name, 570, 200 + k * 60, fitSize(s2.name, 22, 520), '#fff', 'left');
        text((s2.artist || '') + (lv ? '   level ' + lv : '   (no chart at this difficulty)'), 600, 226 + k * 60, 15, lv ? '#bfe0ff' : '#ff9a9a', 'left', 'normal');
      });
      if (c.mine !== undefined) text('Tab: edit this order', 870, 620, 16, '#ffd23c', 'center', 'normal');
    }
    text('Up/Down: course   Left/Right: difficulty   Enter: start   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
function startCourseSong() {
  const song = songForSlot(COURSE.slots[COURSE.i]);
  S.diff = COURSE.diff;
  const di = DIFFS.findIndex(x => x[0] === S.diff);
  if (!song || !((levelsOf(song) || [])[di] > 0)) {        // no chart at this difficulty: the nearest one it has
    const lv = levelsOf(song) || [];
    const alt = [1, 2, 4, 3].find(d => lv[DIFFS.findIndex(x => x[0] === d)] > 0);
    if (!song || !alt) { COURSE.scores.push(0); COURSE.i++; if (COURSE.i < COURSE.slots.length) startCourseSong(); else go(CourseResult); return; }
    S.diff = alt;
  }
  go(Loading.with(song));
}
// ORDER EDIT: pick songs for your own course
const OrderEdit = {
  bgm: 'MU_BGM_FREE',
  with(k) { this.k = k; this.picked = k === null ? [] : myOrders()[k].slice(); this.i = 0; return this; },
  enter() { this.songs = gameSongs().filter(s2 => !s2.random && !s2.folderTile && !isLocked(s2)); },
  input(a, p) {
    if (!p) return;
    const n = this.songs.length;
    if (a === 'P1U') { this.i = (this.i - 1 + n) % n; sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1D') { this.i = (this.i + 1) % n; sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1L') { this.i = Math.max(0, this.i - 10); sfx('SE_SYS_SELECT01'); }
    else if (a === 'P1R') { this.i = Math.min(n - 1, this.i + 10); sfx('SE_SYS_SELECT01'); }
    else if (a === 'START') {
      if (this.picked.length < 6) { this.picked.push(this.songs[this.i].slot); sfx('SE_SYS_DECIDE01'); }
      if (this.picked.length >= 6) this.finish();
    } else if (a === 'OPTIONS') this.finish();
    else if (a === 'BACK') {
      if (this.picked.length) { this.picked.pop(); sfx('SE_SYS_WINDOWOUT'); } else go(CourseSel);
    }
  },
  finish() {
    if (this.picked.length < 2) { sfx('SE_SYS_WINDOWOUT'); return; }       // (the games want at least 2 songs)
    const o = myOrders();
    if (this.k === null) { if (o.length >= 6) o.shift(); o.push(this.picked); } else o[this.k] = this.picked;
    writeSave(); sfx('SE_SYS_DECIDE01'); go(CourseSel);
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('ORDER EDIT', 210, 44, 34, '#fff', 'center');
    const n = this.songs.length, top = Math.max(0, Math.min(this.i - 5, n - 11));
    this.songs.slice(top, top + 11).forEach((s2, k) => {
      const i = top + k, on = i === this.i, y = 100 + k * 50;
      g.fillStyle = on ? 'rgba(255,138,30,0.95)' : 'rgba(20,60,140,0.8)'; g.fillRect(60, y, 560, 44);
      text(s2.name, 76, y + 22, fitSize(s2.name, 20, 520), '#fff', 'left');
      if (this.picked.includes(s2.slot)) text('✓', 600, y + 22, 20, '#7dff9a', 'right');
    });
    g.fillStyle = 'rgba(10,30,90,0.85)'; g.fillRect(660, 100, 560, 540); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(660, 100, 560, 540);
    text('YOUR COURSE  (' + this.picked.length + ' / 6)', 940, 140, 24, '#ffe86a', 'center');
    this.picked.forEach((sl, k) => { const s2 = SONGS.find(x => x.slot === sl); if (s2) text((k + 1) + '. ' + s2.name, 690, 190 + k * 56, fitSize(s2.name, 22, 500), '#fff', 'left'); });
    text('Enter: add   Esc: remove last / back   Tab: save (2 songs or more)', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// the end of a course: every song's score and the total
const CourseResult = {
  bgm: 'MU_BGM_FREE',
  enter() {
    this.at = performance.now();
    this.total = COURSE.scores.reduce((a, b) => a + b, 0);
    this.cleared = !COURSE.failed && COURSE.scores.length >= COURSE.slots.length;
    SAVE.modeRecords = SAVE.modeRecords || {}; SAVE.modeRecords.course = SAVE.modeRecords.course || {};
    const key = S.game + ':' + COURSE.name + ':' + COURSE.diff;
    this.newBest = this.total > (SAVE.modeRecords.course[key] || 0);
    if (this.newBest) { SAVE.modeRecords.course[key] = this.total; writeSave(); }
  },
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_DECIDE01'); COURSE = null; go(CourseSel); } },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const c = COURSE; if (!c) return;
    g.fillStyle = 'rgba(10,30,90,0.88)'; g.fillRect(240, 90, 800, 540); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(240, 90, 800, 540);
    text(c.name + '  ' + DIFFS[DIFFS.findIndex(x => x[0] === c.diff)][1], 640, 140, 32, '#ffe86a', 'center');
    text(this.cleared ? 'COURSE CLEARED!' : 'COURSE FAILED', 640, 190, 28, this.cleared ? '#7dff9a' : '#ff8a8a', 'center');
    c.slots.forEach((sl, k) => {
      const s2 = SONGS.find(x => x.slot === sl), y = 250 + k * 48;
      text((k + 1) + '. ' + (s2 ? s2.name : '?'), 290, y, fitSize(s2 ? s2.name : '?', 22, 520), k < c.scores.length ? '#fff' : '#889', 'left');
      text(k < c.scores.length ? String(c.scores[k]).padStart(7, '0') : '-------', 990, y, 22, '#fff', 'right');
    });
    text('TOTAL  ' + String(this.total).padStart(8, '0') + (this.newBest ? '   NEW RECORD!' : ''), 640, 580, 28, this.newBest ? '#ffe86a' : '#fff', 'center');
    text('Enter: back to SELECT COURSE', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// ---- WORKOUT MODE: the games' workout menu: your weight, a target (PLAY TIME, CALORIES BURNED or NO
// SETTING), then songs as usual with the calories counted up on screen. Leaving (Esc on the song
// select) or reaching the target ends the workout; each workout goes in your log (player data).
// Calories are an estimate from your weight, the time danced and the steps you hit (the games don't
// say how they count theirs): about 0.0004 kcal per kg per step plus 1.5 kcal per kg per hour
// (a busy 2-minute song for someone of 60 kg comes to about 13 kcal: 6-7 kcal a minute).
let WK = null;                                      // { target: 'none'|'time'|'kcal', goal, kcal, secs, songs }
// DDR II's own calorie rule (0x80038d58, run for each step judged): the song's calories are
//   0.165 x 1.05 x weight(kg) x MET x (song length in hours), MET 3.1 on BASIC and 3.5 otherwise,
// shared out evenly over the chart's steps (kept in thousandths of a kcal; shown here in kcal).
function workoutKcal(p, secs) {
  const kg = (SAVE.weight || 60);
  const judged = Object.entries(p.counts || {}).filter(([k]) => k !== 'NG' && k !== 'OK').reduce((a, [, b]) => a + b, 0);
  const total = Math.max(1, (p.rows && p.rows.length) || judged || 1);
  const songSecs = (typeof Play !== 'undefined' && Play.endT) || secs;
  const met = p.slot === 1 ? 3.1 : 3.5;
  return 0.33 * 0.5 * 1.05 * kg * met * (songSecs / 3600) * Math.min(1, judged / total);
}
const WorkoutSet = {
  bgm: 'MU_BGM_FREE',
  i: 0,
  enter() { this.at = performance.now(); SAVE.weight = SAVE.weight || 60; S.wkTarget = S.wkTarget || 'none'; S.wkTime = S.wkTime || 20; S.wkKcal = S.wkKcal || 100; },
  rows() { return ['WEIGHT', 'TARGET', S.wkTarget === 'time' ? 'PLAY TIME' : S.wkTarget === 'kcal' ? 'CALORIES BURNED' : null, 'START', 'WORKOUT LOG'].filter(Boolean); },
  input(a, p) {
    if (!p) return;
    const rows = this.rows(), r = rows[this.i];
    if (a === 'P1U') { if (this.i > 0) { this.i--; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1D') { if (this.i < rows.length - 1) { this.i++; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1L' || a === 'P1R') {
      const d = a === 'P1R' ? 1 : -1;
      if (r === 'WEIGHT') SAVE.weight = Math.max(20, Math.min(200, (SAVE.weight || 60) + d));
      else if (r === 'TARGET') { const T = ['none', 'time', 'kcal']; S.wkTarget = T[(T.indexOf(S.wkTarget) + d + 3) % 3]; }
      else if (r === 'PLAY TIME') S.wkTime = Math.max(5, Math.min(180, S.wkTime + 5 * d));
      else if (r === 'CALORIES BURNED') S.wkKcal = Math.max(10, Math.min(2000, S.wkKcal + 10 * d));
      sfx('SE_SYS_SELECT02'); saveSettings();
    } else if (a === 'START') {
      if (r === 'START') {
        writeSave(); sfx('SE_SYS_DECIDE01');
        WK = { target: S.wkTarget, goal: S.wkTarget === 'time' ? S.wkTime * 60 : S.wkTarget === 'kcal' ? S.wkKcal : 0, kcal: 0, secs: 0, songs: 0 };
        go(Style);
      } else if (r === 'WORKOUT LOG') { sfx('SE_SYS_DECIDE01'); go(WorkoutLog); }
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); writeSave(); go(ModeSel); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('WORKOUT MENU', 210, 44, 34, '#fff', 'center');
    const val = r => r === 'WEIGHT' ? (SAVE.weight || 60) + ' kg  (' + Math.round((SAVE.weight || 60) * 2.2046) + ' lb)'
      : r === 'TARGET' ? { none: 'NO SETTING', time: 'PLAY TIME', kcal: 'CALORIES BURNED' }[S.wkTarget]
      : r === 'PLAY TIME' ? S.wkTime + ' min' : r === 'CALORIES BURNED' ? S.wkKcal + ' kcal' : '';
    this.rows().forEach((r, i) => {
      const on = i === this.i, y = 150 + i * 90, x = 300, w = 680;
      g.fillStyle = on ? 'rgba(255,138,30,0.95)' : r === 'START' ? 'rgba(20,130,80,0.9)' : 'rgba(20,60,140,0.85)';
      g.fillRect(x, y, w, 70); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x, y, w, 70);
      text(r, x + 30, y + 35, 26, '#fff', 'left');
      const v = val(r); if (v) text((on ? '◀  ' : '') + v + (on ? '  ▶' : ''), x + w - 24, y + 35, 22, '#ffe86a', 'right');
    });
    text('Up/Down: choose   Left/Right: change   Enter: OK   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
const WorkoutLog = {
  bgm: 'MU_BGM_FREE',
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_WINDOWOUT'); go(WorkoutSet); } },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('WORKOUT LOG', 210, 44, 34, '#fff', 'center');
    const log = (SAVE.workoutLog || []).slice(-10).reverse();
    g.fillStyle = 'rgba(10,30,90,0.85)'; g.fillRect(240, 110, 800, 540);
    if (!log.length) text('No workouts yet.', 640, 380, 24, '#fff', 'center');
    log.forEach((w, k) => {
      const y = 150 + k * 48;
      text(w.date, 280, y, 20, '#bfe0ff', 'left', 'normal');
      text(w.songs + (w.songs === 1 ? ' song' : ' songs'), 600, y, 20, '#fff', 'left', 'normal');
      text(Math.round(w.secs / 60) + ' min', 790, y, 20, '#fff', 'right', 'normal');
      text(w.kcal.toFixed(1) + ' kcal', 1000, y, 22, '#ffe86a', 'right');
    });
    const all = (SAVE.workoutLog || []).reduce((a, w) => a + w.kcal, 0);
    text('TOTAL ' + all.toFixed(1) + ' kcal', 640, 625, 22, '#7dff9a', 'center');
  },
};
// the end of a workout
const WorkoutResult = {
  bgm: 'MU_BGM_FREE',
  enter() {
    this.at = performance.now(); this.w = WK;
    if (WK && WK.songs) {
      SAVE.workoutLog = SAVE.workoutLog || [];
      SAVE.workoutLog.push({ date: new Date().toLocaleDateString(), kcal: WK.kcal, secs: WK.secs, songs: WK.songs });
      if (SAVE.workoutLog.length > 200) SAVE.workoutLog.shift();
      writeSave();
    }
  },
  input(a, p) { if (p && (a === 'START' || a === 'BACK')) { sfx('SE_SYS_DECIDE01'); WK = null; go(WorkoutSet); } },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const w = this.w || { kcal: 0, secs: 0, songs: 0, target: 'none' };
    g.fillStyle = 'rgba(10,30,90,0.88)'; g.fillRect(290, 130, 700, 440); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(290, 130, 700, 440);
    text('WORKOUT RESULTS', 640, 185, 36, '#ffe86a', 'center');
    if (w.target !== 'none') text(w.done ? 'TARGET REACHED!' : 'Target: ' + (w.target === 'time' ? Math.round(w.goal / 60) + ' min' : w.goal + ' kcal'), 640, 235, 24, w.done ? '#7dff9a' : '#fff', 'center');
    text(w.kcal.toFixed(1), 640, 330, 90, '#fff', 'center'); text('kcal burned', 640, 400, 24, '#ffd23c', 'center');
    text(Math.floor(w.secs / 60) + ' min ' + Math.round(w.secs % 60) + ' s  -  ' + w.songs + (w.songs === 1 ? ' song' : ' songs'), 640, 470, 22, '#fff', 'center');
    text('(estimated from your weight, ' + (SAVE.weight || 60) + ' kg)', 640, 520, 16, '#bfe0ff', 'center', 'normal');
    text('Enter: back to the WORKOUT MENU', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// the calorie counter while you dance, and the workout's progress on the song select
function workoutBar(kcal, secs) {
  const w = WK; if (!w) return;
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(W / 2 - 170, 6, 340, 34);
  let msg = kcal.toFixed(1) + ' kcal   ' + Math.floor(secs / 60) + ':' + String(Math.floor(secs % 60)).padStart(2, '0');
  if (w.target === 'kcal') msg += '   / ' + w.goal + ' kcal'; else if (w.target === 'time') msg += '   / ' + Math.round(w.goal / 60) + ' min';
  text(msg, W / 2, 23, 18, '#ffe86a', 'center');
}
// ---- TRAINING MODE (HP2 / HP3 / DDR II): after picking a song, its settings: SPEED (the music and
// arrows slowed down or sped up), SECTION (from measure A to measure B), REPEAT (the section starts
// again by itself until you press Esc) and ASSIST TICK (a click on every step). You can't fail.
const TRAIN = { speed: 100, from: 1, to: 0, repeat: true, tick: true };   // to 0 = the end of the song
const TrainSet = {
  bgm: 'MU_BGM_FREE',
  i: 0,
  with(next, measures) { this.next = next; this.measures = Math.max(1, measures); if (TRAIN.to > this.measures || TRAIN.to < TRAIN.from) TRAIN.to = 0; if (TRAIN.from > this.measures) TRAIN.from = 1; return this; },
  rows: ['SPEED', 'FROM MEASURE', 'TO MEASURE', 'REPEAT', 'ASSIST TICK', 'START'],
  input(a, p) {
    if (!p) return;
    const r = this.rows[this.i], d = a === 'P1R' ? 1 : a === 'P1L' ? -1 : 0;
    if (a === 'P1U') { if (this.i > 0) { this.i--; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1D') { if (this.i < this.rows.length - 1) { this.i++; sfx('SE_SYS_SELECT01'); } }
    else if (d) {
      if (r === 'SPEED') TRAIN.speed = Math.max(50, Math.min(150, TRAIN.speed + 10 * d));
      else if (r === 'FROM MEASURE') TRAIN.from = Math.max(1, Math.min(TRAIN.to || this.measures, TRAIN.from + d));
      else if (r === 'TO MEASURE') { const cur = TRAIN.to || this.measures + 1; const v = Math.max(TRAIN.from, Math.min(this.measures + 1, cur + d)); TRAIN.to = v > this.measures ? 0 : v; }
      else if (r === 'REPEAT') TRAIN.repeat = !TRAIN.repeat;
      else if (r === 'ASSIST TICK') TRAIN.tick = !TRAIN.tick;
      sfx('SE_SYS_SELECT02');
    } else if (a === 'START') { sfx('SE_SYS_DECIDE01'); go(this.next); }
    else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Select); }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text('TRAINING', 210, 44, 34, '#fff', 'center');
    const v = { SPEED: TRAIN.speed + '%', 'FROM MEASURE': String(TRAIN.from), 'TO MEASURE': TRAIN.to ? String(TRAIN.to) : 'END (' + this.measures + ')',
      REPEAT: TRAIN.repeat ? 'ON' : 'OFF', 'ASSIST TICK': TRAIN.tick ? 'ON' : 'OFF', START: '' };
    this.rows.forEach((r, i) => {
      const on = i === this.i, y = 130 + i * 82, x = 300, w = 680;
      g.fillStyle = on ? 'rgba(255,138,30,0.95)' : r === 'START' ? 'rgba(20,130,80,0.9)' : 'rgba(20,60,140,0.85)';
      g.fillRect(x, y, w, 64); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x, y, w, 64);
      text(r, x + 30, y + 32, 24, '#fff', 'left');
      if (v[r]) text((on ? '◀  ' : '') + v[r] + (on ? '  ▶' : ''), x + w - 24, y + 32, 22, '#ffe86a', 'right');
    });
    text('Up/Down: choose   Left/Right: change   Enter: start   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// seconds where a chart position (1024 units a beat) is reached: offAt run backwards
function timeAtOff(tm, off) {
  let lo = -10, hi = 2000;
  for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; if (tm.offAt(mid) < off) lo = mid; else hi = mid; }
  return hi;
}
function trainTick(ctx, when) {
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.frequency.value = 1760; gn.gain.setValueAtTime(0.0001, when); gn.gain.exponentialRampToValueAtTime(0.25, when + 0.002); gn.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  o.connect(gn).connect(ctx.destination); o.start(when); o.stop(when + 0.06);
  return o;
}
// ---- GROOVE CIRCUIT (Hottest Party) and GROOVE ARENA (Hottest Party 2): the story modes. Venues full of
// the crowd's dance requests, ending in battles. The requests' wording comes from each disc (HP1:
// mess/messdata_eng.bin, HP2: text/text_eng.bin) and the rules are read from that wording: how many
// songs, which difficulty, the grade, combo, score, gauge, GREAT/PERFECT or 'Boo' limit.
// Hottest Party: the request table in sys/main.dol gives each request's songs and limits (hp.py gc_table);
// GC_SONGS1 / GC_POOL2 below are only used if that table can't be read. Venues open like the game.
const GC_VENUES = ['INCEPTION', 'GENESIS', 'TECTONIC', 'HALLUMINATION', 'ERU', 'SYSTRONIX', 'STARGAZE', 'U-MATIC', 'EV'];
// round 1: [designated songs, Venue Master's song] per venue (slot numbers of Hottest Party's songs)
const GC_SONGS1 = [[['L']], [[1039], [1035]], [[1045], [1028]], [[1041], [1038]], [[1043, 1036], [1027]],
  [[1047, 1048], [1030]], [[1044, 1040], [1037]], [[1042, 1034], [1033]], [[1029, 1032, 1031], [1046]]];
const GC_POOL2 = [1007, 1024, 1014, 1012, 1023, 1018, 1015, 1006, 1003, 1009, 1005, 1021, 1004, 1000, 1001, 1002, 1008,
  1010, 1011, 1013, 1016, 1017, 1019, 1020, 1022, 1025, 1012, 1014, 1024, 1007, 1023, 1018, 1015];
const GC_MASTER2 = [null, 1035, 1028, 1038, 1027, 1030, 1037, 1033, 1049];
const GC_REWARDS1 = [
  ['Song "Lesson by DJ", stage DDR; venues GENESIS, TECTONIC, HALLUMINATION and ERU open'],
  ['Stages Oscillator and Cyberium', 'Song "Heavens and the Earth", stage Ampliture', 'Song "little steps", stage Illuminix, new gear for Harmony'],
  ['Stages Ion and Red Modus', 'Song "THE REASON", stage Substance', 'Song "BRE∀K DOWN! (World Version)", stage Blue Modus, new gear for Root'],
  ['Stages Lost Future and Delight', 'Song "Here I Go Again", stage Essential', 'Song "We Will Live Together", stage Dream Cell, new gear for Gaku'],
  ['Stages Sakura and Safety', 'Songs "Beautiful Inside" and "Touchin\'", stage Momiji', 'Song "LOVE SHINE", stage Culture, new gear for Rena'],
  ['Stages Sensor and Metrio', 'Songs "Such A Feeling" and "Hold Tight", stage IntroVex', 'Song "CANDY (UFO mix)", stage Scope, new gear for Domi'],
  ['Stages Reversion and Libre', 'Songs "Mess With My Emotions" and "Moving On", stage Retroversion', 'Song "I\'m Flying Away", stage Conceptia, new gear for Danca'],
  ['Stages 7th Key and Emergence', 'Songs "the beat" and "will", stage Lens', 'Song "let it out", stage Deviate, new gear for Chordia'],
  ['Stages Propel and Air', 'Songs "1998", "Confession" and "B4U", stage Sunshine', 'Song "SUPER SAMURAI", stage Moon, new gear for U.G., backup dancers'],
];
// Hottest Party 2's arenas: 11 per round. Which request is in which arena, its songs, courses, limits and
// opponents all come from the game's own tables in sys/main.dol (hp2.py ga_rounds / ga_courses); the names
// are the arena name plates in select/select_bin.bin, in the same order.
const GA_NAMES = ['INCEPTION ARENA', 'GET-A-GO-GO', 'ARENA SHIFT', 'FUNKTION JUNCTION', 'GROOVE BY GROOVE', 'WONDERLAND', 'DANCETERIA',
  'PINNACLE', 'EXPOSURE', 'OVER-EXPOSURE 1', 'OVER-EXPOSURE 2'];
let GCD = null;            // HP1's request texts { round1: [25], round2: [25], lesson, lessonSong }
let GAD = null;            // HP2's { requests: [58], unlocks: [song names] }
let GC = null;             // the request being played { cfg, round, v, r, req, i, results: [], diff, share, vname }
function gcRank(diff) { return [4, 1, 2, 3].indexOf(diff); }      // BEGINNER 0, BASIC 1, DIFFICULT 2, EXPERT 3
function gcParse(t) {
  const num = re => { const m = re.exec(t); return m ? +m[1].replace(/,/g, '') : null; };
  const n = num(/Clear (\d+)/), g = /(?:an? (AA|A|B|C) score|grade of (AA|A|B|C) or higher)/.exec(t);
  const course = /course/.test(t);
  const q = {
    text: t, master: /Venue Master|Beat (1 dancer|the dance group)/.test(t), group: /dance group/.test(t),
    designated: /designated/.test(t), course, n: course ? 3 : n || 1,
    minDiff: /expert/i.test(t) ? 3 : /difficult/i.test(t) ? 2 : /basic/i.test(t) ? 1 : 0,
    grade: g ? g[1] || g[2] : null, boo: num(/(\d+) or fewer '?Boo/), combo: num(/over (\d+) Combos/),
    score: num(/over ([\d,]+) (?:points|scores)/), gauge: num(/(\d+)% (?:or better )?on (?:the )?dance gauge/),
    great: num(/over (\d+) GREAT/), perfect: num(/over (\d+) PERFECT/),
  };
  if (q.boo === null && /any 'Boo'/.test(t)) q.boo = 0;
  if (q.master && !course) q.n = 1;
  return q;
}
// ---- the two modes' rules
const GC_HP1 = {
  game: 'hp', disc: 'hp', key: 'gc', title: 'GROOVE CIRCUIT', master: 'VENUE MASTER',
  ready() { return GCD && !GCD.missing; },
  async load() { if (!GCD) { try { GCD = await api('/api/hp1gc'); } catch (e) { GCD = null; } if (!GCD) GCD = { missing: true }; } return GCD.lessonSong || null; },
  save() { SAVE.gc = SAVE.gc || { round: 1, done: {}, rounds: 0 }; return SAVE.gc; },
  rounds() { return [this.save().round]; },
  names(round) { return GC_VENUES; },
  requests(round, v) {
    const T = GCD && GCD['round' + round]; if (!T) return [];
    const texts = v === 0 ? [T[0]] : T.slice(1 + 3 * (v - 1), 4 + 3 * (v - 1));
    let pool = 0;                                           // round 2: designated songs dealt out in venue order
    if (round === 2) for (let u = 0; u < v; u++) {
      const tt = u === 0 ? [T[0]] : T.slice(1 + 3 * (u - 1), 4 + 3 * (u - 1));
      tt.forEach(x => { const q = gcParse(x); if (q.designated && !q.master) pool += q.n; });
    }
    const tab = GCD.table && GCD.table[round - 1] && GCD.table[round - 1][v];
    if (tab && tab.length === texts.length) {               // the game's own table (main.dol): exact rules and songs
      return texts.map((t, r) => {
        const e = tab[r], q = gcParse(t);
        Object.assign(q, { minDiff: e.diff, master: !!e.master, designated: !!e.songs, n: e.n,
          score: e.score || null, boo: e.boo === null || e.boo === undefined ? null : e.boo, combo: e.combo || null, grade: e.grade || null,
          songs: e.songs ? e.songs.map(x => 1000 + x) : null });
        q.reward = round === 1 ? (GC_REWARDS1[v] || [])[r] : null;
        return q;
      });
    }
    return texts.map((t, r) => {
      const q = gcParse(t);
      if (round === 1) {
        const S1 = GC_SONGS1[v];
        q.songs = q.master ? S1[1] : q.designated ? S1[0] : null;
        if (q.songs) q.songs = q.songs.map(x => x === 'L' ? (GCD.lesson || 1039) : x);
      } else q.songs = q.master ? [GC_MASTER2[v]] : q.designated ? GC_POOL2.slice(pool, pool + q.n) : null;
      q.reward = round === 1 ? (GC_REWARDS1[v] || [])[r] : null;
      return q;
    });
  },
  open(round, v) {
    if (v === 0) return true;
    const n = GC_VENUES.filter((x, u) => u < 8 && gcVenueCleared(this, round, u)).length;
    if (v <= 4) return gcVenueCleared(this, round, 0);
    if (v <= 7) return n >= 4;
    return n >= 8;                                          // EV: every other venue
  },
  hidden(round, v) { return v === 8 && !this.open(round, v); },
  lockedWhy(round, v) { return v <= 4 ? 'Clear INCEPTION to open this venue.' : v <= 7 ? 'Clear four venues to open this one.' : ''; },
  share(round, v, q) { return round === 1 ? 0.55 + 0.04 * v : 0.76 + 0.025 * v; },
  // a request cleared for the first time: the whole circuit done? -> the next round
  cleared(c) {
    const sv = this.save();
    if (c.v === 8 && gcVenueCleared(this, c.round, 8)) {
      sv.rounds = (sv.rounds || 0) + 1;
      if (sv.round === 1) sv.round = 2; else { sv.round = 1; sv.done = {}; }   // round 2 done: the circuit starts over
      return c.round === 1 ? 'GROOVE CIRCUIT CLEARED!  Round 2 begins: harder requests.' : 'GROOVE CIRCUIT CLEARED AGAIN!  The circuit starts over.';
    }
    return null;
  },
  status() { const sv = this.save(); return 'ROUND ' + sv.round + (sv.rounds ? '   (circuit cleared ' + sv.rounds + 'x)' : ''); },
};
const GC_HP2 = {
  game: 'hp2', disc: 'hp2', key: 'ga', title: 'GROOVE ARENA', master: 'DANCE BATTLE',
  ready() { return GAD && !GAD.missing && GAD.rounds; },
  async load() {
    if (!GAD) { try { GAD = await api('/api/hp2ga'); } catch (e) { GAD = null; } if (!GAD) GAD = { missing: true }; }
    return null;
  },
  save() { SAVE.ga = SAVE.ga || { done: {}, round2: false, rounds: 0 }; if (SAVE.ga.v !== 2) { SAVE.ga = { done: {}, round2: false, rounds: 0, v: 2 }; } return SAVE.ga; },
  rounds() { return this.save().round2 ? [1, 2] : [1]; },
  names(round) { return GA_NAMES; },
  // a course by its number: its songs come from the game's course table (main.dol)
  course(id) { return ((GAD.courses || [])[id] || []).map(x => 2000 + x); },
  courseName(id) { return 'COURSE ' + (id + 1); },
  requests(round, v) {
    const A = GAD && GAD.rounds && GAD.rounds[round - 1] && GAD.rounds[round - 1][v]; if (!A) return [];
    return A.map(r => {
      const q = { text: r.text, minDiff: r.diff, grade: r.grade || null, boo: r.boo !== undefined ? r.boo : null, combo: r.combo || null,
        score: r.score || null, gauge: r.gauge || null, great: r.great || null, perfect: r.perfect || null,
        master: r.kind === 5 || r.kind === 6, course: r.kind === 2 || r.kind === 4 || r.kind === 6, designated: r.kind >= 3,
        dancers: r.dancers || null };
      q.group = !!(r.dancers && r.dancers.length > 1) || /dance group/.test(r.text);
      if (r.kind === 1 || r.kind === 7) { q.n = r.n || 1; q.songs = null; }
      else if (r.kind === 2) {                             // pick a course: the five the game never designates in this round
        q.pick = round === 1 ? [0, 1, 2, 3, 4] : [10, 11, 12, 13, 14];
        q.songs = this.course(q.pick[0]); q.n = q.songs.length; q.courseId = q.pick[0];
      }
      else if (r.kind === 3 || r.kind === 5) { q.songs = r.songs.map(x => 2000 + x); q.n = q.songs.length; }
      else { q.songs = this.course(r.course); q.n = q.songs.length; q.courseId = r.course; }
      // a dancer number is outfit*1000 + character (the game uses it to pick the dancer's model and costume)
      q.outfits = r.dancers ? r.dancers.map(x => Math.floor(x / 1000)) : null;
      q.level = null;
      return q;
    });
  },
  open(round, v) {
    const C = u => gcVenueCleared(this, round, u);
    if (v === 0) return true;
    if (v <= 3) return C(0);
    if (v <= 6) return C(1) && C(2) && C(3);
    if (v === 7) return [4, 5, 6].every(C);
    if (v === 8) return C(7);
    return C(8);                                            // the hidden venues: once EXPOSURE's dance group is beaten
  },
  hidden(round, v) { return v >= 8 && !this.open(round, v); },
  lockedWhy(round, v) { return v <= 3 ? 'Clear INCEPTION ARENA to open this arena.' : v <= 6 ? 'Clear GET-A-GO-GO, ARENA SHIFT and FUNKTION JUNCTION.' : 'Clear every arena before PINNACLE.'; },
  // how high the opponent's score climbs: an estimate that rises arena by arena (the game's own rule for
  // its dancers' scores isn't decoded)
  share(round, v, q) { return (round === 1 ? 0.5 + 0.03 * v : 0.72 + 0.02 * v) + (q.group ? 0.03 : 0); },
  // the opponent's profile group (HP2 0x80034860): +1 once the arena is burning, +2 in round 2
  comGroup(round, v) { return (gcVenueCleared(this, round, v) ? 1 : 0) + (round === 2 ? 2 : 0); },
  cleared(c) {
    const sv = this.save();
    if (c.v === 8 && gcVenueCleared(this, c.round, 8)) {
      sv.rounds = (sv.rounds || 0) + 1;
      if (c.round === 1 && !sv.round2) { sv.round2 = true; return 'ALL ARENAS BURNING!  Hidden venues appear, and ROUND 2 opens (Left/Right on the arena list).'; }
      return 'ALL ARENAS BURNING!  Hidden venues appear.';
    }
    return null;
  },
  status() { return this.save().round2 ? 'Left/Right: ROUND 1 / ROUND 2' : 'ROUND 1'; },
};
// DDR II's TOURNAMENT MODE: 4 stages of 8 requests, read from the game's own table (main.dol 0x80279560)
// and its wording (text_eng.bin): songs of your choice, specified songs, dancer battles and a final.
let TOUR = null;
const GC_DDR2 = {
  game: 'ddr2', disc: undefined, key: 'tour', title: 'TOURNAMENT', master: 'DANCE BATTLE',
  ready() { return TOUR && TOUR.rows; },
  async load() { if (!TOUR) { try { TOUR = (await api('/api/ddr2tour')) || {}; } catch (e) { TOUR = {}; } } return null; },
  save() { SAVE.tour = SAVE.tour || { done: {}, rounds: 0 }; return SAVE.tour; },
  rounds() { return [1]; },
  names() { return ['STAGE 1', 'STAGE 2', 'STAGE 3', 'STAGE 4']; },
  requests(round, v) {
    if (!TOUR || !TOUR.rows) return [];
    const play = sl => songForSlot(sl), pools = TOUR.pools || [];
    return TOUR.rows.slice(v * 8, v * 8 + 8).map((r, k) => {
      const i = v * 8 + k;
      const q = { text: (TOUR.texts || [])[i] || '', minDiff: r.diff, grade: null, boo: null, combo: null, score: null, gauge: null, great: null, perfect: null,
        master: r.kind === 8 || r.kind === 9, group: false, designated: false, course: false };
      if (r.cond === 1) q.grade = { 1: 'D', 2: 'C', 3: 'B', 4: 'A', 5: 'AA' }[r.value] || 'C';
      else if (r.cond === 2) q.combo = r.value - 1;                 // "at least N": the check is "over"
      else if (r.cond === 5) q.gauge = r.value;
      else if (r.cond === 6) q.perfect = r.value - 1;
      else if (r.cond === 7) q.great = r.value - 1;
      else if (r.cond === 10) q.boo = r.value;
      if (r.kind === 1) { q.n = r.n; q.songs = null; }
      else if (r.kind === 3 || r.kind === 10) {
        const ok = r.songs.filter(play), need = r.kind === 10 ? 1 : r.n;
        q.designated = true;
        if (ok.length > need) { q.pickFrom = ok; q.need = need; q.n = need; q.songs = null; }
        else { q.songs = ok; q.n = need; }                       // (songs this copy can't play become your choice)
      } else if (r.kind === 8) {                                   // a dancer's song (the game: list stage*4 + battle), then one of yours
        const pool = (pools[v * 4 + Math.max(0, k - 5)] || []).filter(play);
        q.songs = pool.length ? [pool[Math.floor(Math.random() * pool.length)]] : []; q.n = 2;
      } else if (r.kind === 9) {                                   // the final: the opponent's song (list stage*4+2), 2 competition songs (list stage*4+3), 1 of yours
        const opp = (pools[v * 4 + 2] || []).filter(play), comp = (pools[v * 4 + 3] || []).filter(play), pick = [];
        if (opp.length) pick.push(opp[Math.floor(Math.random() * opp.length)]);
        while (pick.length < 3 && comp.length) { const x = comp.splice(Math.floor(Math.random() * comp.length), 1)[0]; if (!pick.includes(x)) pick.push(x); }
        q.songs = pick; q.n = 4;
      }
      return q;
    });
  },
  open(round, v) { return v === 0 || gcCleared(this, round, v - 1, 7); },
  hidden() { return false; },
  lockedWhy(round, v) { return 'Win STAGE ' + v + "'s final to open this stage."; },
  share(round, v, q) { return 0.55 + 0.08 * v + (q.n === 4 ? 0.05 : 0); },
  // DDR II keeps HP2's opponent table unused (0x8026F0F4); its one round takes HP2's rule: +1 once the stage is cleared
  comGroup(round, v) { return gcVenueCleared(this, round, v) ? 1 : 0; },
  cleared(c) {
    if (c.v === 3 && c.r === 7) { const sv = this.save(); sv.rounds = (sv.rounds || 0) + 1; return 'TOURNAMENT CHAMPION!'; }
    return null;
  },
  status() { return 'TOURNAMENT'; },
};
function gcCfg() { return gameNow() === 'hp2' ? GC_HP2 : gameNow() === 'ddr2' ? GC_DDR2 : GC_HP1; }
function gcCleared(cfg, round, v, r) { return !!cfg.save().done[round + ':' + v + ':' + r]; }
function gcVenueCleared(cfg, round, v) { const R = cfg.requests(round, v); return R.length > 0 && R.every((q, r) => gcCleared(cfg, round, v, r)); }
function gcMaxScore(p) { return p && p.hpRules ? p.hpM * 10 : 1000000; }
// The battle opponent (COM), decoded from Hottest Party 2 (and DDR II's shared engine, 0x80034cc8).
// A profile is 18 bytes: weights for BOO, ALMOST, GOOD, GREAT, PERFECT, MARVELOUS, then the chance (%)
// that a second panel of a jump is played (byte 6). Table [group][row], row = the chart's difficulty
// (BEGINNER..EXPERT; CHALLENGE takes EXPERT's), group = the arena's state (see comGroup).
// HP2 0x801d80f0 (every arena has the same 4 x 4), DDR II 0x8026F0F4 (the same numbers, unused there).
const COM_TABLE = [
  [[4, 5, 5, 40, 26, 20, 30], [4, 5, 5, 40, 26, 20, 30], [4, 5, 5, 40, 26, 20, 30], [4, 5, 5, 40, 26, 20, 30]],
  [[3, 3, 4, 40, 30, 20, 40], [3, 3, 4, 40, 30, 20, 30], [3, 3, 4, 40, 30, 20, 25], [3, 3, 4, 40, 30, 20, 25]],
  [[2, 2, 2, 40, 40, 20, 65], [2, 2, 2, 40, 40, 20, 60], [2, 2, 2, 40, 40, 20, 55], [2, 2, 2, 40, 40, 20, 55]],
  [[0, 0, 2, 34, 48, 25, 85], [0, 0, 2, 34, 48, 25, 75], [0, 0, 2, 34, 48, 25, 70], [0, 0, 2, 34, 48, 25, 70]],
];
const comRnd = n => Math.floor(Math.random() * n);
// the judgments for n steps (0x80034cc8): each weight gets a small random lift, the steps are shared out
// by the weights (the rest to the first weighted judgment), then the list is shuffled (10n swaps)
function comJudgments(w, n) {
  const total = w.slice(0, 6).reduce((a, b) => a + b, 0); if (total <= 0 || n <= 0) return [];
  const plain = w.slice(0, 6).every(x => x === 0 || x === 255);
  const adj = w.slice(0, 6).map(x => { const j = x && !plain ? Math.trunc(2 * comRnd(total) / 100) : 0; return Math.max(0, x + j - Math.trunc(j / 4)); });
  const sum = adj.reduce((a, b) => a + b, 0); if (sum <= 0) return [];
  const per = Math.fround(n / sum), cnt = adj.map(a => Math.trunc(Math.fround(a * per)));
  const left = n - cnt.reduce((a, b) => a + b, 0);
  if (left > 0) { const k = w.findIndex((x, i) => i < 6 && x); if (k >= 0) cnt[k] += left; }
  const out = []; cnt.forEach((c, j) => { for (let i = 0; i < c && out.length < n; i++) out.push(j); });
  for (let k = 0; k < 10 * out.length; k++) { const i = k % out.length, j = comRnd(out.length); const x = out[i]; out[i] = out[j]; out[j] = x; }
  return out;
}
// the opponent's whole song: its score at every judgment, scored by the same rules as the player
function comRival(p, w) {
  const notes = p.notes.slice().sort((a, b) => a.t - b.t), cat = comJudgments(w, notes.length);
  const of = new Map(); notes.forEach((n, i) => of.set(n, cat[i] ?? 5));
  const ev = [];
  for (const row of p.rows) {
    // a jump is judged by its later press; each press is early or late at random, so either panel's judgment
    const j = of.get(row.notes[comRnd(row.notes.length)]);
    ev.push({ t: row.t, j });
    row.notes.forEach((n, k) => {
      if (n.endT === undefined) return;
      // held through when its step is GREAT or better (0x8002dac8); a jump's other panel only by byte 6's chance
      const ok = of.get(n) >= 3 && (k === 0 || comRnd(100) < w[6]);
      ev.push({ t: n.endT, ok });
    });
  }
  ev.sort((a, b) => a.t - b.t);
  const jc = [0, 0, 0, 0, 0, 0]; let okN = 0, score = 0, hk = 0;
  const T = p.hpRules ? p.hpT : 0;
  const tl = [];
  for (const e of ev) {
    if (p.hpRules) {
      hk = Math.min(T, hk + 1);
      const v = hk === T ? p.hpM - (T * (T - 1) / 2) * p.hpUnit : hk * p.hpUnit;
      const wv = e.j !== undefined ? (e.j >= 3 ? 10 : e.j === 2 ? 5 : 0) : (e.ok ? 10 : 0);
      score = Math.min(999999999, score + wv * v);
    } else {
      if (e.j !== undefined) jc[e.j]++; else if (e.ok) okN++;
      let num = SCORE_FREEZE_OK * okN;
      for (let k = 0; k < 6; k++) num += SCORE_W[k] * jc[k];
      score = Math.max(0, Math.floor(100000 * num / p.den) - jc[3] - jc[4]) * 10;
    }
    tl.push([e.t, score]);
  }
  return { tl, score };
}
function gcOpp(p, play) {
  if (!GC || GC.comGroup === null || GC.comGroup === undefined) return null;
  if (!play._com) {
    const row = Math.min(3, p.slot ?? 1);
    play._com = comRival(p, COM_TABLE[Math.min(3, GC.comGroup)][row]);
  }
  return play._com;
}
// BATTLE MODE's opponent, played as player 2: each row is judged when it reaches the step zone with the
// judgment the profile drew for it (as the game's simulated presses land), freezes held by the same rule
function comStep(p, t) {
  if (!p.comCat) {
    const w = COM_TABLE[Math.max(0, Math.min(3, p.com))][Math.min(3, p.slot ?? 1)];
    const notes = p.notes.slice().sort((a, b) => a.t - b.t), cat = comJudgments(w, notes.length);
    p.comW = w; p.comCat = new Map(); notes.forEach((n, i) => p.comCat.set(n, cat[i] ?? 5));
  }
  for (const row of p.rows) {
    if (row.t > t) break;
    if (row.judged || row.comDone) continue;
    row.comDone = true; row.hit = row.notes.length; row.dt = 0;
    row.notes.forEach((n, k) => {
      n.done = true; n.hitT = row.t; p.flash[n.lane] = t;
      if (n.endT !== undefined) {
        const ok = p.comCat.get(n) >= 3 && (k === 0 || comRnd(100) < p.comW[6]);
        n.holding = true; n.comHold = ok ? n.endT + 1 : row.t; p.holding.push(n);
      }
    });
    p.judgeRow(row, p.comCat.get(row.notes[comRnd(row.notes.length)]));
  }
}
// the opponent's final score (Hottest Party's GROOVE CIRCUIT keeps the estimate: its own system isn't decoded)
function gcOppFinal(p, play) { const c = gcOpp(p, play); return c ? c.score : Math.floor(gcMaxScore(p) * GC.share); }
function gcOppNow(p, play, t) {
  const c = gcOpp(p, play);
  if (!c) return Math.floor(gcMaxScore(p) * GC.share * clamp(Math.max(0, t) / Math.max(1, play.endT)));
  let s = 0; for (const [et, sc] of c.tl) { if (et > t) break; s = sc; }
  return s;
}
// does one song meet the request?
function gcCheck(q, p, play) {
  const why = [];
  if (p.failed) why.push('FAILED');
  if (gcRank(p.diff) < q.minDiff) why.push(['', 'BASIC', 'DIFFICULT', 'EXPERT'][q.minDiff] + ' OR HIGHER');
  if (q.grade && GRADE_ORDER.indexOf(p.gr) < GRADE_ORDER.indexOf(q.grade)) why.push(q.grade + ' OR BETTER');
  const boo = (p.counts.BOO || 0) + (p.counts.ALMOST || 0);
  if (q.boo !== null && boo > q.boo) why.push(q.boo ? q.boo + ' OR FEWER BOO' : 'NO BOO');
  if (q.combo !== null && !(p.maxCombo > q.combo)) why.push('OVER ' + q.combo + ' COMBO');
  if (q.score !== null && !(p.score > q.score)) why.push('OVER ' + q.score.toLocaleString('en-US') + ' POINTS');
  if (q.gauge !== null && !(p.life >= q.gauge * 10)) why.push(q.gauge + '% GAUGE');
  if (q.great !== null && !((p.counts.GREAT || 0) > q.great)) why.push('OVER ' + q.great + ' GREAT');
  if (q.perfect !== null && !((p.counts.PERFECT || 0) + (p.counts.MARVELOUS || 0) > q.perfect)) why.push('OVER ' + q.perfect + ' PERFECT');
  if (q.master && !(p.score > gcOppFinal(p, play))) why.push('BEAT THE ' + (q.group ? 'DANCE GROUP' : GC.cfg.master === 'VENUE MASTER' ? 'VENUE MASTER' : 'DANCER'));
  return { ok: !why.length, why, boo };
}
function gcStartSong() {
  const q = GC.req, slot = q.songs[GC.i];
  const song = SONGS.find(s2 => s2.slot === slot) || (GC.extra && GC.extra.slot === slot ? GC.extra : null);
  if (!song) { GC.results.push({ name: 'song ' + slot + ' missing', ok: false, why: ['NOT FOUND'] }); go(GCResult); return; }
  const lv = levelsOf(song) || [];
  const want = [4, 1, 2, 3][GC.diff];
  S.diff = lv[DIFFS.findIndex(x => x[0] === want)] > 0 ? want
    : [4, 1, 2, 3].slice(q.minDiff).find(d => lv[DIFFS.findIndex(x => x[0] === d)] > 0) || want;
  go(Loading.with(song));
}
// a song of the request is over (from the results screen)
function gcSongDone(p, play) {
  const q = GC.req;
  if (GC.i >= (q.songs || []).length && play.song.disc !== GC.cfg.disc) { GC.note = 'Only ' + ({ hp: 'Hottest Party', hp2: 'Hottest Party 2' }[GC.cfg.disc] || 'DDR II') + ' songs count in ' + GC.cfg.title + '.'; go(Select); return; }
  const c = gcCheck(q, p, play);
  GC.results.push({ name: play.song.name, gr: p.gr, combo: p.maxCombo, boo: c.boo, score: p.score,
    master: q.master ? gcOppFinal(p, play) : null, ok: c.ok, why: c.why });
  GC.note = null;
  if (!c.ok) { go(GCResult); return; }
  GC.i++;
  if (GC.i >= q.n) { go(GCResult); return; }
  if (q.songs && GC.i < q.songs.length) gcStartSong(); else go(Select);
}
function gcBox(x, y, w, h, fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x, y, w, h); }
function gcWrap(str, x, y, size, maxW, color, lh) {
  g.font = size + 'px "Segoe UI", Arial, sans-serif';
  let line = '';
  for (const w of String(str).split(' ')) {
    const t2 = line ? line + ' ' + w : w;
    if (g.measureText(t2).width > maxW && line) { text(line, x, y, size, color, 'left', 'normal'); y += lh; line = w; } else line = t2;
  }
  if (line) text(line, x, y, size, color, 'left', 'normal');
  return y + lh;
}
function gcWho(q, cfg) { return q.group ? 'DANCE GROUP' : cfg.master === 'VENUE MASTER' ? 'VENUE MASTER' : 'DANCER'; }
// while dancing: the request and, in a battle, the opponent's score climbing through the song
function gcPlayBar(play) {
  const q = GC.req, p = play.ps && play.ps[0]; if (!q || !p) return;
  const x = 860, y = 96, w = 390;
  gcBox(x, y, w, q.master ? 78 : 44, 'rgba(10,20,60,0.75)');
  text(GC.vname + '  ' + (q.n > 1 ? 'SONG ' + (GC.i + 1) + ' / ' + q.n : 'REQUEST'), x + 12, y + 22, fitSize(GC.vname + '  SONG 1 / 1', 18, w - 24), '#ffe86a', 'left');
  if (q.master) {
    const vm = gcOppNow(p, play, play.now());
    text(gcWho(q, GC.cfg), x + 12, y + 56, 16, '#ff9ad5', 'left');
    text(String(vm).padStart(9, '0'), x + w - 12, y + 56, 22, p.score >= vm ? '#7dff9a' : '#ff8a8a', 'right');
  }
}
// on the song select during a request whose songs you pick
function gcSelectBar() {
  const q = GC.req; if (!q) return;
  gcBox(16, 636, 610, 64, 'rgba(10,20,60,0.88)');
  text(GC.cfg.title + '  ' + GC.vname + '   SONG ' + (GC.i + 1) + ' / ' + q.n, 321, 656, fitSize(GC.cfg.title + '  ' + GC.vname + '   SONG 1 / 1', 18, 590), '#ffe86a', 'center');
  text(GC.note || q.text, 321, 684, fitSize(GC.note || q.text, 15, 590, 'normal'), '#fff', 'center', 'normal');
}
const GCSel = {
  bgm: 'MU_BGM_FREE',
  v: 0, r: 0, focus: 'venue', diff: 1, at: 0, round: 1, cfg: null,
  async enter() {
    this.at = performance.now(); GC = null; this.focus = 'venue';
    this.cfg = gcCfg(); this.loading = true;
    this.extra = await this.cfg.load();
    this.loading = false;
    const R = this.cfg.rounds(); if (!R.includes(this.round)) this.round = R[R.length - 1];
    if (this.v >= this.cfg.names(this.round).length) this.v = 0;
  },
  venues() {
    const c = this.cfg, R = this.round;
    return c.names(R).map((n, v) => ({ v, name: n, open: c.open(R, v), cleared: gcVenueCleared(c, R, v) })).filter(x => !c.hidden(R, x.v));
  },
  input(a, p) {
    const c = this.cfg;
    if (!p || !c || !c.ready()) { if (p && a === 'BACK') go(ModeSel); return; }
    const R = this.round, V = this.venues(), reqs = c.requests(R, this.v);
    const up = /^P[1-4]U$/.test(a), dn = /^P[1-4]D$/.test(a), lf = /^P[1-4]L$/.test(a), rt = /^P[1-4]R$/.test(a);
    if (this.focus === 'venue') {
      const k = V.findIndex(x => x.v === this.v), rounds = c.rounds();
      if (up && k > 0) { this.v = V[k - 1].v; sfx('SE_SYS_SELECT01'); }
      else if (dn && k < V.length - 1) { this.v = V[k + 1].v; sfx('SE_SYS_SELECT01'); }
      else if ((lf || rt) && rounds.length > 1) {
        const j = rounds.indexOf(R) + (rt ? 1 : -1);
        if (j >= 0 && j < rounds.length) { this.round = rounds[j]; this.v = 0; sfx('SE_SYS_SELECT01'); }
      } else if (a === 'START') {
        if (!c.open(R, this.v)) { sfx('SE_SYS_WINDOWOUT'); return; }
        sfx('SE_SYS_DECIDE01'); this.focus = 'req';
        this.r = Math.max(0, reqs.findIndex((q, r) => !gcCleared(c, R, this.v, r)));
        this.diff = Math.max(reqs[this.r] ? reqs[this.r].minDiff : 0, R === 2 ? 2 : 1);
      } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(ModeSel); }
      return;
    }
    const q = reqs[this.r];
    if (this.focus === 'songs') {                           // pick n of the specified songs
      const L = q.pickFrom;
      if (up && this.si > 0) { this.si--; sfx('SE_SYS_SELECT01'); }
      else if (dn && this.si < L.length - 1) { this.si++; sfx('SE_SYS_SELECT01'); }
      else if (lf && this.diff > q.minDiff) { this.diff--; sfx('SE_SYS_SELECT01'); }
      else if (rt && this.diff < 3) { this.diff++; sfx('SE_SYS_SELECT01'); }
      else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.focus = 'req'; }
      else if (a === 'START') {
        const sl = L[this.si], k = this.picked.indexOf(sl);
        if (k >= 0) this.picked.splice(k, 1); else if (this.picked.length < q.need) this.picked.push(sl);
        sfx('SE_SYS_DECIDE01');
        if (this.picked.length === q.need) {
          S.style = 'single'; P2 = null;
          const qq = Object.assign({}, q, { songs: this.picked.slice(), pickFrom: null });
          GC = { cfg: c, round: R, v: this.v, r: this.r, req: qq, i: 0, results: [], diff: this.diff, extra: this.extra,
            share: c.share(R, this.v, qq), comGroup: c.comGroup ? c.comGroup(R, this.v) : null, vname: c.names(R)[this.v] };
          this.focus = 'req'; gcStartSong();
        }
      }
      return;
    }
    if (this.focus === 'course') {                          // choose which course to dance
      if (up && this.ci > 0) { this.ci--; sfx('SE_SYS_SELECT01'); }
      else if (dn && this.ci < q.pick.length - 1) { this.ci++; sfx('SE_SYS_SELECT01'); }
      else if (lf && this.diff > q.minDiff) { this.diff--; sfx('SE_SYS_SELECT01'); }
      else if (rt && this.diff < 3) { this.diff++; sfx('SE_SYS_SELECT01'); }
      else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.focus = 'req'; }
      else if (a === 'START') {
        sfx('SE_SYS_DECIDE01'); S.style = 'single'; P2 = null;
        const id = q.pick[this.ci], qq = Object.assign({}, q, { songs: c.course(id), courseId: id });
        qq.n = qq.songs.length;
        GC = { cfg: c, round: R, v: this.v, r: this.r, req: qq, i: 0, results: [], diff: this.diff, extra: this.extra,
          share: c.share(R, this.v, qq), comGroup: c.comGroup ? c.comGroup(R, this.v) : null, vname: c.names(R)[this.v] };
        this.focus = 'req'; gcStartSong();
      }
      return;
    }
    if (up && this.r > 0) { this.r--; sfx('SE_SYS_SELECT01'); this.diff = Math.max(this.diff, reqs[this.r].minDiff); }
    else if (dn && this.r < reqs.length - 1) { this.r++; sfx('SE_SYS_SELECT01'); this.diff = Math.max(this.diff, reqs[this.r].minDiff); }
    else if (a === 'START' && q && q.pick && this.focus === 'req') { sfx('SE_SYS_DECIDE01'); this.focus = 'course'; this.ci = this.ci || 0; }
    else if (lf && q && q.songs && this.diff > q.minDiff) { this.diff--; sfx('SE_SYS_SELECT01'); }
    else if (rt && q && q.songs && this.diff < 3) { this.diff++; sfx('SE_SYS_SELECT01'); }
    else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.focus = 'venue'; }
    else if (a === 'START' && q) {
      sfx('SE_SYS_DECIDE01');
      S.style = 'single'; P2 = null;
      GC = { cfg: c, round: R, v: this.v, r: this.r, req: q, i: 0, results: [], diff: this.diff, extra: this.extra,
        share: c.share(R, this.v, q), comGroup: c.comGroup ? c.comGroup(R, this.v) : null, vname: c.names(R)[this.v] };
      if (q.pickFrom) { this.focus = 'songs'; this.picked = []; this.si = 0; GC = null; return; }
      if (q.songs && q.songs.length) gcStartSong(); else go(Select);
    }
  },
  click() { this.input('START', true); },
  draw(t) {
    menuBackground(t);
    const c = this.cfg || gcCfg();
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text(c.title, 210, 44, 32, '#fff', 'center');
    if (this.loading) { text('Loading...', 640, 360, 22, '#fff', 'center'); return; }
    if (!c.ready()) { text(c.title + ' needs the ' + (c.disc === 'hp' ? 'Hottest Party' : 'Hottest Party 2') + ' disc: add it in Setup.', 640, 360, 22, '#fff', 'center'); return; }
    const R = this.round, V = this.venues();
    text((c.rounds().length > 1 ? 'ROUND ' + R + '   ' : '') + c.status(), 1240, 44, 18, '#ffe86a', 'right');
    const step = Math.min(60, 530 / Math.max(1, V.length));
    V.forEach((x, k) => {
      const y = 100 + k * step, on = x.v === this.v, h = step - 8;
      gcBox(60, y, 360, h, on ? (this.focus === 'venue' ? 'rgba(255,138,30,0.95)' : 'rgba(200,110,30,0.9)') : x.open ? 'rgba(20,60,140,0.85)' : 'rgba(40,40,60,0.75)');
      text(x.open ? x.name : '? ? ?', 80, y + h / 2, Math.min(22, h * 0.5), x.open ? '#fff' : '#99a', 'left');
      if (x.cleared) text('CLEARED', 405, y + h / 2, 14, '#7dff9a', 'right');
    });
    const reqs = c.requests(R, this.v), open = c.open(R, this.v);
    gcBox(460, 100, 780, 530, 'rgba(10,30,90,0.88)');
    text(open ? c.names(R)[this.v] : '? ? ?', 850, 135, 30, '#ffe86a', 'center');
    if (!open) { text(c.lockedWhy(R, this.v), 850, 300, 20, '#fff', 'center', 'normal'); }
    else {
      // fit the requests in the panel (up to six)
      const rh = Math.min(138, (460 - (reqs.length - 1) * 8) / Math.max(1, reqs.length)), compact = rh < 110;
      const top = Math.max(0, Math.min(this.r - 2, reqs.length - 6));
      reqs.forEach((q, r) => {
        const y = 165 + r * (rh + 8), on = this.focus === 'req' && r === this.r, done = gcCleared(c, R, this.v, r);
        gcBox(480, y, 740, rh, on ? 'rgba(255,138,30,0.9)' : q.master ? 'rgba(120,30,90,0.85)' : 'rgba(20,60,140,0.85)');
        text((q.master ? (q.group ? 'DANCE GROUP BATTLE' : c.master) : 'REQUEST ' + (r + 1)) + (q.level !== null && q.level !== undefined ? '   COM LV ' + (q.level + 1) : ''), 495, y + 16, 14, '#ffe86a', 'left');
        if (done) text('CLEARED', 1205, y + 16, 14, '#7dff9a', 'right');
        let yy = gcWrap(q.text, 495, y + (compact ? 36 : 44), compact ? 15 : 18, 710, '#fff', compact ? 18 : 24);
        if (q.songs) {
          const names = q.songs.map(sl => { const so = SONGS.find(s2 => s2.slot === sl) || (this.extra && this.extra.slot === sl ? this.extra : null); return so ? so.name : '?'; });
          const line = q.pick ? 'Pick one of ' + q.pick.length + ' courses' : (q.course ? (c.courseName && q.courseId !== undefined ? c.courseName(q.courseId) + ': ' : 'Course: ') : 'Song' + (names.length > 1 ? 's' : '') + ': ') + names.join(' / ');
          if (compact) text(line, 495, yy, fitSize(line, 13, 560, 'normal'), '#cfe3ff', 'left', 'normal');
          else yy = gcWrap(line, 495, yy, 15, 710, '#cfe3ff', 20);
        }
        if (q.reward && !compact) gcWrap('Unlocks: ' + q.reward, 495, yy, 14, 710, '#ffd23c', 19);
        if (on && q.songs) text('◀ ' + ['BEGINNER', 'BASIC', 'DIFFICULT', 'EXPERT'][this.diff] + ' ▶', 1205, y + rh - 16, compact ? 15 : 18, '#fff', 'right');
      });
    }
    if (this.focus === 'songs' && reqs[this.r] && reqs[this.r].pickFrom) {
      const q = reqs[this.r];
      gcBox(380, 150, 520, 440, 'rgba(10,20,60,0.96)');
      text('PICK ' + q.need + ' OF THESE SONGS', 640, 185, 22, '#ffe86a', 'center');
      q.pickFrom.forEach((sl, k) => {
        const y = 215 + k * 66, on = k === this.si, got = this.picked.includes(sl), so = songForSlot(sl);
        gcBox(400, y, 480, 58, on ? 'rgba(255,138,30,0.95)' : got ? 'rgba(20,120,60,0.9)' : 'rgba(20,60,140,0.9)');
        text((got ? '\u2714 ' : '') + (so ? so.name : 'song ' + sl), 415, y + 29, fitSize(so ? so.name : 'x', 18, 440), '#fff', 'left');
      });
      text('\u25C0 ' + ['BEGINNER', 'BASIC', 'DIFFICULT', 'EXPERT'][this.diff] + ' \u25B6', 640, 570, 18, '#fff', 'center');
    }
    if (this.focus === 'course' && reqs[this.r] && reqs[this.r].pick) {
      const q = reqs[this.r];
      gcBox(380, 150, 520, 440, 'rgba(10,20,60,0.96)');
      text('PICK A COURSE', 640, 185, 24, '#ffe86a', 'center');
      q.pick.forEach((id, k) => {
        const y = 215 + k * 66, on = k === this.ci;
        gcBox(400, y, 480, 58, on ? 'rgba(255,138,30,0.95)' : 'rgba(20,60,140,0.9)');
        text(c.courseName(id), 415, y + 18, 17, '#fff', 'left');
        const nm = c.course(id).map(sl => (SONGS.find(s2 => s2.slot === sl) || {}).name || '?').join(' / ');
        text(nm, 415, y + 42, fitSize(nm, 13, 450, 'normal'), '#cfe3ff', 'left', 'normal');
      });
      text('\u25C0 ' + ['BEGINNER', 'BASIC', 'DIFFICULT', 'EXPERT'][this.diff] + ' \u25B6', 640, 570, 18, '#fff', 'center');
    }
    if (this.focus === 'songs') text('Up/Down: song   Enter: pick / unpick   Left/Right: difficulty   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
    else text(this.focus === 'course' ? 'Up/Down: course   Left/Right: difficulty   Enter: start   Esc: back' : this.focus === 'venue' ? 'Up/Down: ' + (c.key === 'ga' ? 'arena' : 'venue') + (c.rounds().length > 1 ? '   Left/Right: round' : '') + '   Enter: OK   Esc: back'
      : 'Up/Down: request   Left/Right: difficulty   Enter: start   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
const GCResult = {
  bgm: 'MU_BGM_FREE',
  enter() {
    this.at = performance.now();
    const c = GC; this.ok = c.results.length >= c.req.n && c.results.every(x => x.ok);
    this.first = false; this.msg = null; this.venueDone = false;
    if (this.ok) {
      const sv = c.cfg.save(), key = c.round + ':' + c.v + ':' + c.r;
      this.first = !sv.done[key]; sv.done[key] = true;
      this.venueDone = gcVenueCleared(c.cfg, c.round, c.v);
      if (this.first) this.msg = c.cfg.cleared(c);
      writeSave();
    }
  },
  input(a, p) {
    if (!p || (a !== 'START' && a !== 'BACK')) return;
    sfx('SE_SYS_DECIDE01'); GC = null; go(GCSel);
  },
  draw(t) {
    menuBackground(t);
    const c = GC; if (!c) return;
    gcBox(190, 70, 900, 590, 'rgba(10,30,90,0.9)');
    text(c.vname + (c.req.master ? '  ' + (c.req.group ? 'DANCE GROUP BATTLE' : c.cfg.master) : '  REQUEST ' + (c.r + 1)), 640, 110, fitSize(c.vname + '  DANCE GROUP BATTLE', 28, 860), '#ffe86a', 'center');
    gcWrap(c.req.text, 230, 150, 18, 820, '#fff', 24);
    const rowH = c.results.length > 6 ? 44 : 58;
    c.results.forEach((x, k) => {
      const y = 215 + k * rowH;
      gcBox(230, y, 820, rowH - 8, x.ok ? 'rgba(20,110,60,0.85)' : 'rgba(130,30,40,0.85)');
      text(x.name, 245, y + 15, 16, '#fff', 'left');
      if (x.gr) text(x.gr + '   COMBO ' + x.combo + '   BOO ' + x.boo + '   ' + String(x.score).padStart(9, '0') + (x.master !== null ? '   VS ' + String(x.master).padStart(9, '0') : ''), 245, y + rowH - 22, 13, '#dfe', 'left', 'normal');
      text(x.ok ? 'OK' : x.why.join(', '), 1035, y + (rowH - 8) / 2, x.ok ? 20 : fitSize(x.why.join(', '), 14, 360, 'normal'), x.ok ? '#7dff9a' : '#ffd0d0', 'right');
    });
    const y = 225 + Math.max(1, c.results.length) * rowH;
    if (this.ok) {
      text(c.req.master ? (c.req.group ? 'DANCE GROUP BEATEN!' : c.cfg.master === 'VENUE MASTER' ? 'VENUE MASTER BEATEN!' : 'DANCER BEATEN!') : 'REQUEST CLEARED!', 640, y + 20, 32, '#7dff9a', 'center');
      if (this.first && c.req.reward) text('Unlocked: ' + c.req.reward, 640, y + 62, fitSize('Unlocked: ' + c.req.reward, 18, 820, 'normal'), '#ffd23c', 'center', 'normal');
      if (this.msg) text(this.msg, 640, y + 100, fitSize(this.msg, 20, 860), '#fff', 'center');
      else if (this.venueDone) text((c.cfg.key === 'ga' ? 'ARENA' : 'VENUE') + ' CLEARED!  All requests cleared!', 640, y + 100, 20, '#fff', 'center');
    } else {
      text('REQUEST FAILED', 640, y + 20, 32, '#ff8a8a', 'center');
      text('Pick it again to try again.', 640, y + 60, 18, '#fff', 'center', 'normal');
    }
    text('Enter: back to the ' + (c.cfg.key === 'ga' ? 'arenas' : 'venues'), 640, 690, 16, '#fff', 'center', 'normal');
  },
};
// ---- DDR SCHOOL: Hottest Party 3's 18 lessons (6 STEP, 7 GIMMICK, 5 HAND), each a short chart over the
// lesson music, with the teacher's words from the disc shown first. You can't fail; clearing one marks
// it. (Gimmick and hand arrows play as normal arrows for now.)
let LESSONS = null;
// ---- DDR SCHOOL. DDR II's own (select_bin group 11, layout block 12605088 on the Wii screen): one lesson at
// a time - its name plate, best grade and crown at the top, the teacher on the left, his words in a speech
// window, arrows to change lesson and BEGIN LESSONS. 6 STEP LESSONS (played here), 5 CHOREOGRAPH and 4 Wii
// Balance Board lessons (need the Wii Remote / balance board: listed, not playable). Other games: Hottest
// Party 3's lessons, in a list.
const GRADE_RANK = ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'];
function lessonKey(song) { return song.disc ? song.lesson : 'ddr2-' + song.lesson; }
const LessonSel = {
  bgm: 'MU_BGM_FREE',
  i: 0, intro: null, at: 0, moved: 0, msg: '',
  ddr2() { return gameNow() !== 'hp3' && gameNow() !== 'hp' && gameNow() !== 'hp2'; },
  async enter() {
    this.intro = null; this.msg = ''; this.at = this.moved = performance.now();
    if (!A.font && A.loadIntro) await A.loadIntro().catch(() => {});      // the game's font
    const want = this.ddr2() ? 'ddr2' : 'hp3';
    if (!LESSONS || LESSONS.of !== want) {
      try { LESSONS = await api(want === 'ddr2' ? '/api/lessons?game=ddr2' : '/api/lessons'); } catch (e) { LESSONS = []; }
      // DDR II's SELECT LESSON (classic play) holds the 6 STEP LESSONS ("1/6" in the real game); the
      // CHOREOGRAPH and balance board lessons belong to the motion play that isn't in this version
      if (want === 'ddr2') LESSONS = LESSONS.filter(l => l.playable);
      LESSONS.of = want;
      if (want === 'ddr2' && !LESSONS.length) { try { LESSONS = await api('/api/lessons'); LESSONS.of = want; } catch (e) {} }
    }
    if (this.i >= LESSONS.length) this.i = 0;
  },
  start(l) {
    sfx('SE_SYS_DECIDE01'); S.style = 'single'; P2 = null; S.diff = 4;
    go(Loading.with(l));
  },
  input(a, p) {
    if (!p) return;
    const L = LESSONS || [];
    if (this.ddr2() && L.length && L[0].playable !== undefined) {
      const d = /^P[1-4]([LDUR])$/.exec(a), was = this.i;
      if (d && (d[1] === 'L' || d[1] === 'U')) this.i = (this.i + L.length - 1) % L.length;      // (wraps round, like the game)
      else if (d) this.i = (this.i + 1) % L.length;
      if (this.i !== was) { sfx('SE_SYS_SELECT01'); this.moved = performance.now(); this.msg = ''; }
      if (a === 'START' && L[this.i]) {
        if (L[this.i].playable) this.start(L[this.i]);
        else { sfx('SE_SYS_CANCEL'); this.msg = L[this.i].kind === 'CHOREOGRAPH' ? 'CHOREOGRAPH lessons need the Wii Remote and Nunchuk (hand play isn\'t in this version yet).' : 'Wii Balance Board lessons need the Wii Balance Board (not in this version).'; }
      } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(ModeSel); }
      return;
    }
    if (this.intro) {                                   // the teacher's words, then the lesson
      if (a === 'START') this.start(this.intro);
      else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); this.intro = null; }
      return;
    }
    if (a === 'P1U') { if (this.i > 0) { this.i--; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1D') { if (this.i < L.length - 1) { this.i++; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'START' && L[this.i]) { sfx('SE_SYS_DECIDE01'); this.intro = L[this.i]; }
    else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(ModeSel); }
  },
  click() { this.input('START', true); },
  draw(t) {
    const L = LESSONS || [];
    if (this.ddr2() && L.length && L[0].playable !== undefined) return this.drawDDR2(t, L);
    return this.drawList(t, L);
  },
  drawDDR2(t, L) {
    menuBackground(t);
    const M = A.lesson || {}, l = L[this.i], k = clamp((performance.now() - this.moved) / 250), k0 = clamp((performance.now() - this.at) / 300);
    // title: SELECT LESSON on its bar
    if (!wspr(M.titleBar, 320, 30, 215, 40)) { g.fillStyle = '#2a7fd6'; g.fillRect(WX(320) - 322, 0, 645, 105); }
    if (!wspr(M.title, 320, 35, M.title ? M.title.width / 2 : 0, M.title ? M.title.height / 2 : 0)) text('SELECT LESSON', WX(320), WY(35), 30, '#fff', 'center');
    // the teacher, a pose per lesson, in order (lessons 1 and 3 checked against the real game)
    const key = lessonKey(l), gr = (SAVE.lessons || {})[key], fc = (SAVE.lessonFc || {})[key];
    g.globalAlpha = k0; wspr(M.teacher && M.teacher[this.i % 6], 190 - (1 - k) * 12, 312, 200, 245); g.globalAlpha = 1;
    // his speech window: dark blue, light blue once the lesson is cleared (seen in the real game)
    const wi = !l.playable ? 0 : l.kind !== 'STEP' ? 2 : gr ? 3 : 1;
    if (!wspr(M.wind && M.wind[wi], 399, 248, 210, 180)) { g.fillStyle = 'rgba(20,50,120,0.9)'; g.fillRect(WX(399) - 315, WY(248) - 270, 630, 540); }
    // the teacher's words in the game's font, set like the real game (Step Lesson 1's first line fills 80%
    // of the dark panel's width; left edge 3% in, first line 9% down, a line every 10% of its height)
    const ox = WX(399) - 798, lines = (this.msg || l.words || '').split('\n'), pl = 560 + ox, pr = 1092 + ox, pt = 184, pb = 524, pw = pr - pl, ph = pb - pt;
    const fs = ph * 0.102 / 1.05;
    if (A.font && this.sp === undefined) this.sp = (pw * 0.8 / (fs / 24) - gfontWidth("Let's try Step Lesson 1!", 24, 0)) / [..."Let's try Step Lesson 1!"].length;
    lines.forEach((ln, j) => gtext(ln, pl + pw * 0.028, pt + ph * 0.087 + j * ph * 0.102, fs, '#fff', 'left', this.sp ?? 3, 1));
    // the lesson's name plate, best grade and crown, and which lesson of how many ("3/6") in the dark box
    const plate = M.names && l.kind === 'STEP' ? M.names[l.n - 1] : null;      // (the disc's other plates are in German)
    if (!wspr(plate, 338, 98, 92, 23)) {
      g.fillStyle = l.kind === 'STEP' ? '#2a62d6' : l.kind === 'CHOREOGRAPH' ? '#1e9a44' : '#2a9ad6'; g.fillRect(WX(338) - 138, WY(98) - 34, 276, 69);
      text(l.name.replace(' LESSON', '').replace('Wii Balance Board', 'BALANCE BOARD'), WX(338), WY(98) - 10, fitSize(l.name, 22, 260), '#fff', 'center');
      text('LESSON', WX(338), WY(98) + 16, 18, '#fff', 'center');
    }
    if (gr) wspr(M.grades && M.grades[GRADE_RANK.indexOf(gr)], 460, 98, 25, 16);
    if (fc && M.crowns) wspr(M.crowns[fc === 5 ? 2 : fc === 4 ? 0 : fc === 3 ? 1 : 3], 441, 92, 24, 21, 0.7, 0.7);
    // arrows to change lesson, BEGIN LESSONS between them, and where we are (n / 15)
    const bob = 0;
    if (L.length > 1 && !wspr(M.arrow, 278 - bob / 2, 387, 35, 35, -0.6, 0.9)) text('◀', WX(278), WY(387), 40, '#ff3ca0', 'center');
    if (L.length > 1 && !wspr(M.arrow, 559 + bob / 2, 387, 35, 35, 0.6, 0.9)) text('▶', WX(559), WY(387), 40, '#ff3ca0', 'center');
    g.save(); g.globalAlpha = l.playable ? 1 : 0.45;
    if (!wspr(M.begin, 418, 387, 90, 21, 0.88, 0.88)) { g.fillStyle = '#ff3ca0'; g.fillRect(WX(418) - 135, WY(387) - 32, 270, 63); text('Begin Lessons', WX(418), WY(387), 26, '#fff', 'center'); }
    g.restore();
    num28((this.i + 1) + '/' + L.length, WX(562), WY(98), 42, 'center', 0.66);
    keyHints('Left/Right: lesson    Enter: begin    Esc: back');
  },
  drawList(t, L) {
    menuBackground(t);
    if (A.img.headerBar) g.drawImage(A.img.headerBar, -40, -6, 480, 86);
    text(modeName(MODES.find(m => m.id === 'lesson')), 210, 44, 34, '#fff', 'center');
    if (!L.length) { text(LESSONS ? 'No lessons found on your disc.' : 'Loading...', 640, 360, 22, '#fff', 'center'); return; }
    const done = SAVE.lessons || {};
    const top = Math.max(0, Math.min(this.i - 4, L.length - 10));
    L.slice(top, top + 10).forEach((l, k) => {
      const i = top + k, on = i === this.i, y = 100 + k * 56;
      g.fillStyle = on ? 'rgba(255,138,30,0.95)' : l.kind === 'STEP LESSON' ? 'rgba(20,60,140,0.85)' : l.kind === 'GIMMICK LESSON' ? 'rgba(120,40,140,0.85)' : 'rgba(20,120,90,0.85)';
      g.fillRect(80, y, 440, 48); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(80, y, 440, 48);
      text(l.name, 100, y + 24, 22, '#fff', 'left');
      if (done[lessonKey(l)]) text('CLEAR ' + done[lessonKey(l)], 500, y + 24, 16, '#7dff9a', 'right');
    });
    const l = this.intro || L[this.i];
    g.fillStyle = 'rgba(10,30,90,0.88)'; g.fillRect(560, 100, 660, 540); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(560, 100, 660, 540);
    text(l.name, 890, 145, 30, '#ffe86a', 'center');
    // the teacher's words (from the disc), wrapped
    const words = (l.words || '').replace(/\s+/g, ' ').trim().split(' ');
    let line = '', y = 205;
    g.font = '20px "Segoe UI", Arial, sans-serif';
    for (const w of words) {
      const tryL = line ? line + ' ' + w : w;
      if (g.measureText(tryL).width > 600 && line) { text(line, 590, y, 20, '#fff', 'left', 'normal'); y += 32; line = w; } else line = tryL;
    }
    if (line) text(line, 590, y, 20, '#fff', 'left', 'normal');
    if (l.kind !== 'STEP LESSON') text('(' + (l.kind === 'GIMMICK LESSON' ? 'gimmick' : 'hand') + ' arrows play as normal arrows for now)', 890, 600, 15, '#ffd23c', 'center', 'normal');
    text(this.intro ? 'Enter: start the lesson   Esc: back' : 'Up/Down: lesson   Enter: OK   Esc: back', 640, 690, 16, '#fff', 'center', 'normal');
  },
};
const STYLES = [
  { name: 'SINGLE', sub: '1 player - 1 mat', style: 'single', two: false, mats: [1] },
  { name: 'DOUBLE', sub: '1 player - 2 mats', style: 'double', two: false, mats: [2] },
  { name: '2 PLAYERS', sub: '1 mat each', style: 'single', two: true, mats: [1, 1] },
  { name: '2 PLAYERS DOUBLE', sub: '2 mats each - 4 mats', style: 'double', two: true, mats: [2, 2] },
];
// ---- song select
// Hottest Party's menu pictures, loaded from its disc the first time they're needed
let HP_UI = null;
function hpUI() {
  if (HP_UI) return HP_UI;
  const L = (f, i) => { const im = new Image(); im.src = `/api/hpui/${f}/${i}`; return im; };
  const titles = {};
  for (let k = 0; k < 52; k++) titles[k] = L('ddrmodesel', 206 + Math.min(k, 49));
  HP_UI = { header: L('ddrmodesel', 170), curve: L('ddrmodesel', 174), frame: L('ddrmodesel', 183), tile: L('ddrmodesel', 189),
    diff: [195, 196, 197, 198].map(i => L('ddrmodesel', i)), foot: L('ddrmodesel', 199), p1: L('ddrmodesel', 201),
    up: L('ddrmodesel', 43), down: L('ddrmodesel', 44), track: L('ddrmodesel', 193), thumb: L('ddrmodesel', 194),
    sel: L('selcom', 74), grades: [1, 2, 3, 4, 5, 6, 7].map(i => L('selcom', i)), titles };
  return HP_UI;
}
// Hottest Party 2's song select pictures (files/select/selMusic.bin), the same parts as hpUI()
let HP2_UI = null;
function hp2SelUI() {
  if (HP2_UI) return HP2_UI;
  const L = i => { const im = new Image(); im.src = '/api/hp2sel/' + i; return im; };
  HP2_UI = { hp2: true, header: L(12), curve: L(16), frame: L(7), tile: L(13), tileOn: L(15),
    diff: [19, 18, 20, 21].map(L), foot: L(22), p1: L(8), sel: L(23), thumb: L(45),
    grades: [31, 30, 29, 28, 25, 26, 27].map(L), info: L(32), titles: {} };
  return HP2_UI;
}
// Hottest Party 3's song select pictures (files/select/selMusic_us.bin; names are entry paths, see hp3.py)
let HP3_UI = null;
function hp3SelUI() {
  if (HP3_UI) return HP3_UI;
  const L = p => { const im = new Image(); im.src = '/api/hp3sel/' + p; return im; };
  HP3_UI = { panel: L('0.0.4.0'), arrow: L('0.0.5.0'), logo: L('0.0.7.0'), bubble: L('0.0.8.0'), stage: L('0.0.3.0'),
    sort: L('0.0.9.0'), sortName: L('0.0.10.0'), thumb: L('0.0.11.0'), bigFrame: L('1.0.1'), smallFrame: L('1.1.1'),
    grades: [0, 1, 2, 3, 4, 5, 6].map(i => L('2.0.1.' + i)), feet: [0, 1, 2, 3, 4].map(i => L('2.0.2.' + i)), p1: L('2.0.3.0'),
    bars: [7, 8, 9, 10].map(i => L('2.0.' + i + '.0')), radar: L('3.0.1.0'),
    labels: { AIR: L('3.0.2.0'), CHAOS: L('3.0.3.0'), FREEZE: L('3.0.4.0'), STREAM: L('3.0.5.0'), VOLTAGE: L('3.0.6.0') }, clouds: L('4.0.0.0') };
  return HP3_UI;
}
// the song select looks like Hottest Party 2's
function hp2Sel() { return look('select') === 'hp2'; }
// the foot icon in a colour (cached per colour)
function tintFoot(img, col) {
  if (!tintFoot.cv) tintFoot.cv = document.createElement('canvas');
  if (tintFoot.col === col && tintFoot.src === img) return;
  const c = tintFoot.cv, x = c.getContext('2d');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  x.clearRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'source-over';
  tintFoot.col = col; tintFoot.src = img;
}
// Hottest Party's gameplay pictures (data/arrow.bin, gamemes.bin), read from its disc and cut up
// once they've loaded: the arrows (grey arrows on a colour key, coloured the way the key says),
// step zone, freeze arrows, judgments and combo digits, the gauge, style badge and score panel
// the colours Hottest Party writes into the arrows' palette as it plays (read from a Dolphin texture
// dump of the real game): 48 steps round its colour cycle; each step holds the four note colours
// (beat, 8th, 16th, other), 9 shades each from the arrow's edge inwards
const HP_ARROW_PAL = [
  'c66b29de8429ef9c31ffbd39ffe742ffff5affff73ffff84ffffad8c2973a5296bc63963de4a5aff5a52ff734aff944affb542ffce423952c6424ace5a42d67342de8c42dea539d6ce42d6ef42c6ff42b531adad31b5c631b5e731b5ff39adff429cff5294ff5a84ff7373ff',
  'c67329de8c29efad31ffce39ffef4affff63ffff7bffff9cffffb5942963ad3163ce425ae74a52ff6b4aff8442ffa542ffbd42ffe742394ac64a42ce6339ce7b39d69439ceb539cede42c6ff42b5ff52a531adb529a5ce31ade731a5ff399cff428cff5a8cff6b73ff846bff',
  'ce8429de9429e7b539f7de4af7f75affff73ffff8cefffadefffce9c315abd3952d64a52f75a4aff7b42ff8c39ffb542ffd642fff7424242b55a39bd6b39c68c31c6ad39bdc639b5ef42b5ff4aa5ff5a8c299cb5299cd6319cef3194ff428cff4a84ff637bff736bff9c63ff',
  'c68c29d6ad39e7ce42e7e752efff6be7ff84e7ffadd6ffc6c6ffefad394ace4a42e75a42ff7339ff8c39ffad39ffce42ffef42ffff525231ad6b31b58431b59c31adbd39ade7399cff4a94ff5a84ff7373298cc6298cde3184ef397bff4a7bff636bff7b63ff9452ffb552ff',
  'c6a531cebd42cede52d6f76bd6ff84ceff9cc6ffc6b5ffe7adffffb54239d65239ef6b39ff8c31ffa539ffc639ffef42ffff4affff6363319c7b299c9c319cb53194de398cff4a84ff5a7bff6b6bff8463297bc63173de396bef4a6bff5a5aff7b52ff9452ffb54affd642ff',
  'b5ad39bdce4ac6e763bdff7bbdff9cb5ffb5adffde9cffff8cffffc65231de6331ef8431ff9c31ffbd39ffde39ffff4affff5affff7373298c94298cad318cce3984ef427bff5273ff6b6bff845affa552316bce3963de4263ef5a52ff734aff844affad4affce42f7f742f7',
  'adbd4aa5d663adef84a5ff949cffb58cffde8cffff73ffff6bffffc66329de8429ef9c31ffb531ffde42ffff4affff63ffff73ffff9c8c297ba52973c6396bde4a6bff5a5aff7352ff8c52ffad4affce42395ac64a4ad65a4ae77342e78c42efad39e7d642e7ef42d6ff42c6',
  '94c66394de7b8cf79c8cffb57bffd673ffff6bffff5affff5affffc67b29de9429e7b539f7d642f7ef4affff63f7ff84efff9ce7ffbd9c3163bd3963de4a52f75a4aff7342ff8c42ffad42ffce42fff7424a42bd5a39ce7339ce9431cead39cece39c6f742bdff4ab5ff5aa5',
  '8cc6638cde8484ef9c84ffbd7bffde73ffff63ffff5affff52ffffc68429de9c29e7bd39efde42eff752f7ff6befff84e7ffa5d6ffc6a5315abd395ade4a52ff634aff7b42ff9442ffb542ffd642ffff424a39bd6339c67b39ce9431c6b539c6d639bdff42b5ff4aadff5a9c',
  '84ce7384de947befad73ffce6bffef63ffff5affff4affff42f7ffc68c29d6a531dece39dee74ae7ff63e7ff7bdeff9cceffbdbdffd6ad3152ce424ae7524aff7342ff8442ffa539ffce42ffef42ffff425a31b57331bd8431bda531b5c639b5ef39a5ff4aa5ff5294ff6b84',
  '73ce8473de9c6be7bd63f7de5af7f752ffff4affff42efff42e7ffc69c31ceb539d6d64adeef5ad6ff73ceff84ceffadbdffceadfff7b5394ace4a42ef6339ff7b39ff9c39ffb539ffde42ffff42ffff526331ad7b29ad9c31b5b531add639a5f74294ff5294ff637bff7b73',
  '6bc68c63d6a563e7c652e7e74aefff4aefff4aefff42deff42ceffbda531c6bd39cede52ceff63c6ff7bbdff9cb5ffbdadffde9cffffbd4a39d65a39ef6b39ff8c31ffad39ffce39ffef42ffff4affff5a6b29a58429a5a5319cc6319ce74294ff4a84ff5a84ff6b6bff8c63',
  '63c68c63d6ad5ae7ce52e7e74aefff42e7ff42e7ff42d6ff42c6ffb5ad31bdc642c6e752c6ff6bbdff84b5ff9cb5ffc6a5ffe78cffffc64a39de6339ef7339ff9431ffb539ffd639fff742ffff4affff6373299c8c299cad319cc63194ef428cff4a84ff637bff736bff9c63',
  '5ac69c52cebd52d6d64adef742deff39d6ff42d6ff42c6ff42b5ffb5ad39bdce4ab5e763b5ff73b5ff94a5ffb59cffd694fff77bffffc65231de6b31f78431ff9c31ffbd39ffe739ffff4affff5affff6b7b2994942994b5318cd6398cef427bff5a73ff736bff845affad5a',
  '5ac6a54acebd4acede42d6f742d6ff39ceff42c6ff42b5ff42adffadb539b5ce4ab5e76badff7badff9c9cffbd94ffe784ffff73ffffc65a31de7329f78c31ffad31ffc639ffef42ffff52ffff5affff7384298c9c298cbd3184de397bf74a7bff636bff7b63ff9452ffb552',
  '52bda54acebd42cede42ceff42ceff39c6ff42bdff42b5ff42a5ffadb542adce52adef6badff84a5ffa594ffc68cffef7bffff73ffffc65a31de7329ef9431ffad31ffce39fff742ffff52ffff63ffff7b8c298ca52984c63984de4273ff4a73ff6363ff845aff9c52ffbd52',
  '52bda54acebd42cede42ceff42ceff39c6ff42bdff42b5ff42a5ffadb542adce52adef6badff84a5ffa594ffc68cffef7bffff73ffffc65a31de7329ef9431ffad31ffce39fff742ffff52ffff63ffff7b8c298ca52984c63984de4273ff4a73ff6363ff845aff9c52ffbd52',
  '4abdad4ac6c642cee739c6ff39c6ff39bdff42b5ff42adff529cffa5b54aa5d65aa5ef73a5ff8c9cffad8cffce84ffef73ffff6bffffc66331de7b29ef9c31ffb531ffd639fff742ffff5affff6bffff848c2984a52984ce397be74273ff526bff6b63ff845affa54affc642',
  '4ab5ad42bdce39c6e739bdff39bdff39b5ff42adff429cff528cff9cbd4aa5d6639cef7b94ff9494ffb584ffd67bffff6bffff63ffffc66329de8429ef9c31ffbd31ffde42ffff4affff63ffff73ffff8c94297bad297bce3973ef4a6bff5a63ff735aff9452ffad4affce42',
  '42b5b539bdce39bde731b5ff39b5ff39a5ff42a5ff4a94ff5a84ff9cc65294de639cef8494ff9c84ffbd84ffde73ffff63ffff5affffce7329de8429efa531f7c631ffe742ffff52ffff6bf7ff7befff9c9c2973b53173d6396bef4a63ff635aff7b52ff9c4affbd42ffd642',
  '39adb539b5ce39b5e731b5ff39adff39a5ff429cff4a84ff5a7bff94c65a94de6b94f7848cffa57bffc67bffe76bffff5affff5affffce7329de8c29e7ad31f7ce31f7ef42ffff52ffff6befff7be7ffa59c2973bd316bd6426bf74a5aff6b52ff844affa54affbd42ffe742',
  '39adbd31a5d631adef31a5ff399cff398cff4a8cff5273ff6b6bff8cc66384de7384ef947bffb573ffd66bfff763ffff52ffff52ffffc68429d69c29e7b531efde39eff74aefff63efff7bdeff94ceffb5ad3163c63963e74a5aff5a52ff7b4aff8c42ffb542ffd642fff742',
  '319cc62994de319cf73194ff3984ff427bff5273ff6363ff7b5aff7bce7373de8c73efa56bffc663ffe75affff52ffff4affff42f7ffc68c29cea529d6ce39dee74adeff5ad6ff73d6ff94c6ffadb5ffceb5315ace4252e7524aff734aff8442ffa539ffce42ffef42ffff42',
  '298cc6298cde3184ef3184ff427bff4a73ff6363ff735aff8c52ff73ce7b6bde9463e7b55af7d652f7ef4affff4affff42efff42e7ffbd9c29ceb531ced642ceef52ceff6bc6ff84bdffa5b5ffc6a5ffe7bd394ad64a4aef6342ff7b39ff9c39ffb539ffde42ffff42ffff52',
  '298cc62984de3184ef3173ff4273ff5263ff6b5aff7b52ff9c52ff63c68463de9c5ae7bd52efde4aeff74af7ff42efff42e7ff42d6ffbd9c31c6bd39cede4ac6f75ac6ff73bdff8cb5ffada5ffce9cfff7bd424ade5242ef6b39ff8439ffa539ffc639ffef42ffff42ffff52',
  '2973ce2973de316be74263f74a5af76352ff7b4aff9c42efbd42e75ac69452cead4adece4adeef42deff39deff42d6ff42c6ff42b5ffadad31b5ce42b5e752b5ff73adff849cffa59cffce84ffef7bffffc65239de6339f78439ff9c31ffbd39ffde39ffff42ffff52ffff63',
  '2963c6315ace4252de4a4ade6b42e78442dea542d6bd42cee742bd42b5ad39bdc639c6e739c6ff39bdff39b5ff42adff42a5ff5a8cff9cbd429cd65a9cef6b94ff8c8cffad84ffc67bffef63ffff63ffffce6331de8429ef9c31ffb531ffde39ffff42ffff5affff63f7ff84',
  '314ab54242c65242ce6b39c68439bd9c39bdc642b5e742a5ff529c31adb531add631adef31a5ff39a5ff3994ff4a8cff5a7bff6b73ff84c65a84de7384f78c73ffa573ffc663ffef5affff52ffff52ffffc67b29d69429e7b531e7d639efef42efff5ae7ff73d6ff84c6ffad',
  '3942b54a39bd5a39bd7331b59439b5ad39a5d642a5f74a94ff5a84319cbd29a5de319cef3194ff398cff4284ff527bff636bff7b63ff7bc66373de7b73ef9c6bffb563ffd65affff52ffff4affff42ffffc68c29cea529d6c631dede42deff4adeff63d6ff7bc6ff9cb5ffbd',
  '4239ad5a31a56b31ad8c31a5ad399cce398cef4a8cff5273ff6b6b298cc62994de318cf73184ff427bff4a73ff636bff735aff9c52ff6bce7363de8c63e7ad52f7c64af7ef4affff4affff42efff42efffbd9c29c6b531cece39ceef4ac6ff5abdff7bbdff94adffb59cffd6',
  '52319c6b299484319c9c3194bd3984e7427bff5273ff6363ff7b5a2984c6297bde317bef3973ff4a6bff5a5aff7b5aff944affb542ff5ac68452d69c52e7bd4ae7de42eff739efff42e7ff42d6ff42ceffb5a531bdc639b5de4ab5ff5ab5ff73a5ff8ca5ffad94ffce84fff7',
  '63298c73298c943184b5317bce427bf74a6bff6363ff7352ff8c522973ce2973de396be74a63f7525aff7352ff8c4affad42f7c642ef52c68c4acead42d6ce42dee742deff39d6ff42ceff42c6ff52b5ffadad31adce42ade752a5ff6b9cff8494ff9c8cffc67bffe76bffff',
  '63298c7b29849c3184b53173d64273ff5263ff6b5aff7b52ff9c522973c6296bde3963e74a5af75a52f7734aff944af7b542efce42e74ac6944acead42d6ce39d6ef39d6ff39ceff42ceff42bdff52adffa5b531a5ce42a5e7529cff739cff848cffa584ffce73ffef6bffff',
  '6b298484297b9c317bbd3973de426bff5a5aff735aff844affad422963c63163de395ae74a52ef634aef7b42f79c42efbd42e7e742d64abd9c42cebd39ced639cef739ceff39c6ff42bdff42adff52a5ff9cb539a5d64a9cef5a94ff738cff9484ffad7bffd66bfff763ffff',
  '732973942973ad316bce4263ef4a5aff6352ff7b4aff9c42ffbd42315ac6395ad64a52de5a4ade7342e78c42e7ad42dece42cef742c639b5a539bdbd39c6de31bdff39bdff39b5ff42adff4a9cff638cff94bd4294d65294ef6b8cff847bffa57bffc66bffe75affff5affff',
  '84296b9c2963b53963de4a52f75a4aff734aff8c4affad42ffce423152c6394ace524ad66342de7b42d69c39d6bd42cede42bdff42ad39adad31b5ce31b5e731b5ff39adff39a5ff4a9cff5284ff6b7bff8cc64a84de6384f77b7bff9473ffb56bffd663fff752ffff52ffff',
  '8c2963a5315ac63952de4a4aff6342ff8442ff9c42ffbd42ffe742394abd4242ce5a42ce7339ce8c39cea539c6ce42bdef42adff52a531adb529adce31ade731a5ff39a5ff4294ff528cff5a7bff7373ff84c6527bde6b7bf78473ff9c6bffbd5affe75affff4affff42ffff',
  '8c295aad3952ce4252e7524aff6b42ff8439ffad42ffc642ffef42394ab54a42c66339c67339c69439bdb539bdde42b5f742a5ff5a8c31a5b529a5d631a5ef319cff3994ff428cff5284ff6373ff7b6bff7bc65a73de736bef8c6bffad5affc652ffef52ffff4affff42ffff',
  '94315ab5394ace4a4aef5a42ff7b42ff8c39ffb542ffd642fff7423942b55239bd6b39bd8431bd9c39b5bd39ade742a5ff4a9cff5a84319cbd299cd6319cef3194ff428cff4a84ff5a7bff6b6bff8c63ff73c66373de736bef9463ffb552ffd652fff74affff42ffff42ffff',
  '9c314abd394ad65242f76342ff7b39ff9439ffbd42ffde42ffff524239b55a39b56b39b58c31b5ad39b5c639a5ef429cff4a94ff637b299cc62994de3194ef318cff4284ff4a7bff6373ff7363ff9c5aff6bce6363de8463ef9c5affb552ffde4affff4affff42ffff42f7ff',
  '9c314abd4242de5242f76b39ff8439ff9c39ffc642ffe742ffff524a39ad5a31b57331b59431b5b539adce399cf74a94ff5284ff6b732994c62994de318cef3184ff427bff5273ff6b6bff7b5affa55aff63ce6b63de845ae79c52f7bd4affe742ffff42ffff42f7ff42efff',
  'ad394ac64a42e75a39ff7339ff8c39ffad39ffce42ffef42ffff5a4a31ad6331ad7b31ad9431a5b5399cde3994ff4a8cff5a7bff736b298cc6298cde3184f7397bff427bff5a6bff7363ff8452ffad52ff63c6735ade8c52e7ad4af7c642f7ef42ffff42f7ff42efff42e7ff',
  'ad3942ce4a39e76339ff7331ff9439ffb539ffde42fff74affff5a5231a56b29a58431a5a5319cbd3994e74284ff5284ff5a73ff7b632984c62984de3184f73973ff4a6bff6363ff7b5aff9452ffb542ff5ac67352de9452e7b54aefce42efef39efff42efff42deff42ceff',
  'b53939ce5239e76b39ff8431ff9c39ffbd39ffe742ffff4affff635a319c73299c8c319cad3194ce398cef4284ff5a7bff636bff84632984c6297bde3973ef4273ff5263ff6b5aff8452ffa54affbd42ff52c6844ad6944ae7b542e7de42eff739e7ff42e7ff42d6ff42c6ff',
  'b54239ce5a31e76b31ff8c31ffad39ffce39ffef4affff52ffff6b6329947b2994943194b5318cd6427bf74a7bff5a73ff6b63ff8c5a2973c62973de396bef4a63ff5a5aff7352ff8c52ffad42ffce42ff4ac6844acea542debd42dede39e7ff39deff42d6ff42ceff52bdff',
  'bd4a31d66329ef8431ff9431ffb539ffde42ffff52ffff5affff7b6b298c84298ca53184bd317be74273ff526bff6b63ff7b52ffa552296bce316bde3963e74a5af76352f7844aff9c4affbd42f7e742ef42c68c39cead39cece39d6e739d6ff39ceff42c6ff42b5ff5aadff',
  'c65a31de7329ef8c31ffad31ffc639ffef4affff5affff6bffff8473298494297bb5317bce3973ef4a63ff635aff7b5aff944affb5423163c6395ade4a52e75a4aef7342ef8c42f7b542efce42def742d639b59c39c6bd39c6d631c6f739bdff39bdff42b5ff4aa5ff639cff',
  'c66329de7b29f79c31ffb531ffd642ffff52ffff6bffff7bffff9c8429739c2973bd396bde4263f7525aff6b52ff8c4affa542ffc642315ac63952d6524ade6b4ade7b42e79c39e7c642dee742ceff42bd31b5a531bdbd31bdde31b5ff39b5ff39a5ff4aa5ff5294ff6b84ff'];
let HP_HUD = null;
function hpHud() {
  if (HP_HUD) return HP_HUD;
  const L = (f, i) => { const im = new Image(); im.src = `/api/hpui/${f}/${i}`; return im; };
  const H2 = HP_HUD = { src: { notes: L('arrow', 0), idx: (() => { const im = new Image(); im.src = '/api/hpidx/arrow/0'; return im; })(), zone: L('arrow', 1), freeze: L('arrow', 33), judge: L('gamemes', 3) },
    gauge: L('arrow', 2), fill: L('arrow', 16), p: [19, 20, 21, 22].map(i => L('arrow', i)), ball: [23, 24, 25, 26].map(i => L('arrow', i)),
    style: L('arrow', 8), single: L('arrow', 11), battle: L('arrow', 12), diff: [3, 4, 5, 6].map(i => L('arrow', i)),
    scoreBox: L('arrow', 10), field: L('arrow', 7), danger: L('arrow', 28),
    ready: L('gamemes', 4), hereWeGo: L('gamemes', 5), cleared: L('gamemes', 6), failed: L('gamemes', 7),
    finished: L('gamemes', 8), gameOver: L('gamemes', 9), go: L('gamemes', 10), ok: false };
  const cut = (img, x, y, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h); return c; };
  const pixels = (c, fn) => { const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height); fn(d.data, c.width, c.height); x.putImageData(d, 0, 0); return c; };
  const build = () => {
    const S2 = H2.src;
    if (!S2.notes.naturalWidth || !S2.idx.naturalWidth || !S2.zone.naturalWidth || !S2.freeze.naturalWidth || !S2.judge.naturalWidth) return;
    // arrows: 64x64 frames, 8 to a row. Each set of four (left, down, up, right) sits on its own colour;
    // that colour is the arrow's: dark greys take it, light greys go to white, the key itself is see-through
    H2.notes = [];
    for (let set = 0; set < 7; set++) {
      const row = set >> 1, col0 = (set & 1) * 4;
      H2.notes.push([0, 1, 2, 3].map(d => pixels(cut(S2.notes, (col0 + d) * 64, row * 64, 64, 64), (p, w, h) => {
        const k = [p[4 + 4 * w], p[5 + 4 * w], p[6 + 4 * w]];
        for (let i = 0; i < p.length; i += 4) {
          if (p[i] === k[0] && p[i + 1] === k[1] && p[i + 2] === k[2]) { p[i + 3] = 0; continue; }
          const v = p[i] / 255;
          for (let c = 0; c < 3; c++) p[i + c] = k[c] * (1 - v) + 255 * v;
        }
      })));
    }
    // step zone: the plain grey arrows (the first set, without its colour); pressing lights the white shape
    // the arrows' palette numbers: each set of four uses its own 16 colours (set k = colours 16k..16k+15)
    H2.ix = [];
    for (let set = 0; set < 6; set++) {
      const row = set >> 1, col0 = (set & 1) * 4;
      H2.ix.push([0, 1, 2, 3].map(d => { const c = cut(S2.idx, (col0 + d) * 64, row * 64, 64, 64), p = c.getContext('2d').getImageData(0, 0, 64, 64).data, a = new Uint8Array(4096); for (let i = 0; i < 4096; i++) a[i] = p[i * 4] & 15; return a; }));
    }
    // step zone: the game's grey set (edge light grey, see-through middle, greys 74..140); lit: the lighter greys
    const greys = (lo, edge) => { const t = [null, [edge, edge, edge], null, null, null]; for (let i = 0; i < 9; i++) t.push([lo + 8 * i, lo + 8 * i, lo + 8 * i]); return t; };
    H2.zone = [0, 1, 2, 3].map(d => hpPaint(H2.ix[4][d], greys(74, 231)));
    H2.zoneOn = [0, 1, 2, 3].map(d => hpPaint(H2.ix[5][d], greys(173, 231)));
    H2.zoneLit = [0, 1, 2, 3].map(d => cut(S2.zone, d * 64, 0, 64, 64));
    // freeze arrows: four 64-wide columns, the head on top, then the body down to its tail; black is see-through
    const clear = (p) => { for (let i = 0; i < p.length; i += 4) { const m = Math.max(p[i], p[i + 1], p[i + 2]); if (m < 40) p[i + 3] = m * 6; } };
    H2.frzHead = [0, 1, 2, 3].map(d => pixels(cut(S2.freeze, d * 64, 0, 64, 64), clear));
    H2.frzBody = [0, 1, 2, 3].map(d => pixels(cut(S2.freeze, d * 64, 128, 64, 256), clear));
    H2.frzTail = [0, 1, 2, 3].map(d => pixels(cut(S2.freeze, d * 64, 384, 64, 64), clear));
    // judgments and digits (the sheet's own rectangles)
    const J = S2.judge;
    H2.digits = [...Array(10)].map((_, i) => cut(J, i * 56, 0, 56, 56));
    H2.judge = { MARVELOUS: cut(J, 0, 280, 412, 56), PERFECT: cut(J, 0, 56, 512, 56), GREAT: cut(J, 0, 112, 280, 56),
      GOOD: cut(J, 283, 112, 224, 56), ALMOST: cut(J, 224, 168, 250, 56), BOO: cut(J, 0, 168, 224, 56),
      COMBO: cut(J, 0, 224, 224, 56), OK: cut(J, 224, 224, 128, 56), NG: cut(J, 352, 224, 128, 56) };
    H2.ok = true;
  };
  for (const k in H2.src) H2.src[k].addEventListener('load', build);
  return H2;
}
// one 64x64 arrow from its palette numbers and a 16-colour table ([r,g,b] or null = see-through)
function hpPaint(ix, tab, into) {
  const c = into || document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), d = x.createImageData(64, 64), p = d.data;
  for (let i = 0; i < 4096; i++) { const col = tab[ix[i]]; if (col) { p[4 * i] = col[0]; p[4 * i + 1] = col[1]; p[4 * i + 2] = col[2]; p[4 * i + 3] = 255; } }
  x.putImageData(d, 0, 0);
  return c;
}
// the note arrows as they look now: the colour cycle goes round once a measure, and the white bar in
// the middle lights up in three steps (all, two, one, none) through each beat
function hpNotes(hp, measurePhase, beat) {
  const N = HP_ARROW_PAL.length, step = Math.floor((1 - measurePhase) * N + N) % N, flash = Math.min(3, Math.floor(beat * 4));
  const key = step * 4 + flash;
  if (hp.notesKey === key) return hp.notesNow;
  const row = HP_ARROW_PAL[step], W8 = [255, 255, 255], G8 = [82, 82, 82];
  const lit = [[1, 1, 1], [1, 1, 0], [1, 0, 0], [0, 0, 0]][flash];
  if (!hp.notesNow) hp.notesNow = [0, 1, 2, 3].map(() => [0, 1, 2, 3].map(() => document.createElement('canvas')));
  for (let b = 0; b < 4; b++) {
    const tab = [null, [8, 8, 8], lit[0] ? W8 : G8, lit[1] ? W8 : G8, lit[2] ? W8 : G8];
    for (let i = 0; i < 9; i++) { const o = (b * 9 + i) * 6; tab.push([parseInt(row.substr(o, 2), 16), parseInt(row.substr(o + 2, 2), 16), parseInt(row.substr(o + 4, 2), 16)]); }
    for (let d = 0; d < 4; d++) hpPaint(hp.ix[b][d], tab, hp.notesNow[b][d]);
  }
  hp.notesKey = key;
  return hp.notesNow;
}
// Hottest Party 2's gameplay screen (files/game/gui.tpl): the gold gauge, STYLE badge and score panel,
// its judgments, combo digits and banners (its arrows look like Hottest Party 1's, which are used)
let HP2_HUD = null;
function hp2Hud() {
  if (HP2_HUD) return HP2_HUD;
  const L = i => { const im = new Image(); im.src = '/api/hp2gui/' + i; return im; };
  const H2 = HP2_HUD = { gauge: L(0), score: L(15), style: L(20), single: L(19), diff: [11, 12, 13, 14].map(L),
    ball: [23, 24, 25, 26].map(L), danger: L(22), ready: L(32), hereWeGo: L(31), finished: L(30), failed: L(29),
    cleared: L(30), go: L(31), sheet: L(28), ok: false };
  H2.sheet.addEventListener('load', () => {
    const J = H2.sheet, cut = (x, y, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(J, x, y, w, h, 0, 0, w, h); return c; };
    H2.digits = [...Array(10)].map((_, i) => cut(i * 56, 0, 56, 56));
    H2.judge = { PERFECT: cut(99, 56, 318, 56), GREAT: cut(28, 112, 228, 56), GOOD: cut(310, 112, 178, 56),
      BOO: cut(52, 168, 121, 56), ALMOST: cut(243, 168, 220, 56), COMBO: cut(18, 224, 202, 56),
      OK: cut(227, 224, 123, 56), NG: cut(354, 224, 125, 56), MARVELOUS: cut(7, 280, 400, 56) };
    H2.ok = true;
  });
  return H2;
}
const okImg = im => im && (im.naturalWidth || im.width) ? im : null;
function rainbowAt(t) { return `hsl(${(t * 120) % 360},100%,60%)`; }
// the dancers' names (the disc's name plates, select_bin_us.bin /2/2/0/0) by file id (CHR201-209 = game ids
// 200-208, the order the unlock table gives their outfits: EMI 200, DISCO 201, RUBY 202, YUNI 203, RAGE 204)
const DDR2_CHAR_NAMES = { '201': 'EMI', '202': 'DISCO', '203': 'RUBY', '204': 'YUNI', '205': 'RAGE', '206': 'Rena', '207': 'NAOKI', '208': 'jun', '209': 'U1' };
// MY CHARACTER: the Wii's 3 x 3 pages (Wii footage): page 1 = RANDOM ALL / RANDOM girls / RANDOM boys,
// Mii, EMI, DISCO, YUNI, RAGE, RUBY; page 2 = Rena, NAOKI, jun, U1, then empty slots. Locked dancers
// show ???. DDR II PC has no Mii, so that slot can't be picked. Each dancer is a black box with the
// portraits loaded from the configured extracted disc, plus a separate 3D preview.
const MYCHAR_PAGES = [['random', 'randomF', 'randomM', 'mii', '201', '202', '204', '205', '203'], ['206', '207', '208', '209', null, null, null, null, null]];
const MYCHAR_ICONS = { random: 16, randomF: 17, randomM: 18, mii: 11,
  '201': 1, '202': 2, '203': 4, '204': 5, '205': 6,
  '206': 12, '207': 14, '208': 13, '209': 15 };
const MyChar = {
  icons: {},
  icon(v) {
    const n = !v ? 21 : this.locked(v) ? 22 : MYCHAR_ICONS[v];
    if (n === undefined) return null;
    if (!this.icons[n]) {
      const im = new Image();
      im.src = '/api/ddr2charicon/' + n;
      this.icons[n] = im;
    }
    return okImg(this.icons[n]);
  },
  preview(t) {
    const v = this.item(this.cur);
    if (!this.previewDancer || !this.previewCh || !/^\d+$/.test(v || '') || this.locked(v)) return;
    const d = this.previewDancer;
    const url = '/api/ddr2char/' + v + '/0';
    if (d.customFor !== url) d.useModel(url);
    if (!d.custom) {
      text(d.customErr ? 'Preview unavailable' : 'Loading dancer...', 400, 390, 20, '#fff', 'center');
      return;
    }
    try {
      const cv = d.render(this.previewCh, 8 + (t * 2) % 120, 1e6);
      if (cv) g.drawImage(cv, 180, 100, 420, 480);
    } catch (e) { console.error('character preview', e); }
  },
  bgm: 'MU_BGM_FREE',
  enter() {
    this.page = 0; this.cur = 0;
    this.icons = {};
    this.previewDancer = window.Dancer3D ? Dancer3D.createPreview() : null;
    this.previewCh = null;
    const dancer = this.previewDancer;
    const song = SONGS.find(s => !s.custom && !s.disc);
    if (dancer && song) api('/api/dance/' + danceNo(song)).then(data => {
      if (this.previewDancer === dancer && data) this.previewCh = dancer.prepare(data, 7);
    }).catch(() => {});
    const at = MYCHAR_PAGES.findIndex(p => p.includes(S.ddr2Char));
    if (at >= 0) { this.page = at; this.cur = MYCHAR_PAGES[at].indexOf(S.ddr2Char); }
    if (!DDR2_CHARS) api('/api/ddr2chars').then(c => { DDR2_CHARS = c || []; }).catch(() => { DDR2_CHARS = []; });
  },
  leave() { this.previewDancer = null; this.previewCh = null; },
  item(k) { return MYCHAR_PAGES[this.page][k]; },
  locked(v) { return /^\d+$/.test(v || '') && ddr2CharLockedAt(+v - 1, 0) > 0; },
  usable(v) { return !!v && v !== 'mii' && !this.locked(v) && (!/^\d+$/.test(v) || !DDR2_CHARS || DDR2_CHARS.some(c => c.id === v)); },
  label(v) {
    if (!v) return '';
    if (v === 'random') return 'RANDOM ALL';
    if (v === 'randomF') return 'RANDOM ♀';
    if (v === 'randomM') return 'RANDOM ♂';
    if (v === 'mii') return 'Mii';
    return this.locked(v) ? '???' : DDR2_CHAR_NAMES[v] || v;
  },
  input(a, p) {
    if (!p) return;
    const r = Math.floor(this.cur / 3), c = this.cur % 3;
    if (a === 'P1L' || a === 'P2L') {
      if (c > 0) this.cur--; else if (this.page > 0) { this.page--; this.cur = r * 3 + 2; } else return;
      sfx('SE_SYS_SELECT01');
    } else if (a === 'P1R' || a === 'P2R') {
      if (c < 2) this.cur++; else if (this.page < MYCHAR_PAGES.length - 1) { this.page++; this.cur = r * 3; } else return;
      sfx('SE_SYS_SELECT01');
    } else if (a === 'P1U' || a === 'P2U') { if (r > 0) { this.cur -= 3; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'P1D' || a === 'P2D') { if (r < 2) { this.cur += 3; sfx('SE_SYS_SELECT01'); } }
    else if (a === 'START') {
      const v = this.item(this.cur);
      if (!this.usable(v)) { sfx('SE_SYS_ERROR'); return; }
      sfx('SE_SYS_DECIDE01');
      S.ddr2Char = v; saveSettings();
      Promise.resolve().then(() => ddr2Dancer()).catch(() => {});
      go(Select);
    } else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Select); }
  },
  draw(t) {
    menuBackground(t);
    this.preview(t);
    // title bar
    g.fillStyle = '#1f6fd0'; g.fillRect(400, 10, 480, 64);
    g.fillStyle = '#3b8ff0'; g.fillRect(406, 14, 468, 56);
    text('MY CHARACTER', 640, 44, 34, '#fff', 'center');
    // the grid: a blue panel, 3 x 3 boxes, the cursor's in an orange frame
    const gx = 690, gy = 150, cs = 132, gap = 12, pw = 3 * cs + 4 * gap;
    g.fillStyle = '#2a6fd0'; g.fillRect(gx - gap, gy - gap, pw, pw);
    for (let k = 0; k < 9; k++) {
      const v = this.item(k), x = gx + (k % 3) * (cs + gap), y = gy + Math.floor(k / 3) * (cs + gap);
      if (!v) { const im = this.icon(null); g.fillStyle = '#dfe6ea'; g.fillRect(x, y, cs, cs); if (im) g.drawImage(im, x, y, cs, cs); continue; }
      const rnd = v === 'random' || v === 'randomF' || v === 'randomM';
      g.fillStyle = v === 'random' ? '#2bb7a4' : v === 'randomF' ? '#e86ab8' : v === 'randomM' ? '#2b7fe0' : v === 'mii' ? '#1a8a78' : '#000';
      g.fillRect(x, y, cs, cs);
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, cs - 4, cs - 4);
      const lb = this.label(v);
      const portrait = this.icon(v);
      if (portrait) {
        g.drawImage(portrait, x, y, cs, cs);
        g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x + 4, y + cs - 28, cs - 8, 24);
      }
      text(lb, x + cs / 2, portrait ? y + cs - 16 : y + cs / 2, fitSize(lb, portrait ? 16 : rnd ? 20 : 24, cs - 16), '#fff', 'center');
      if (k === this.cur) { g.strokeStyle = '#ff6a10'; g.lineWidth = 8; g.strokeRect(x - 6, y - 6, cs + 12, cs + 12); }
    }
    // the pink page arrows either side of the panel
    const ay = gy + pw / 2 - gap;
    const tri = (x, dir) => { g.fillStyle = '#ff28c8'; g.beginPath(); g.moveTo(x, ay); g.lineTo(x - dir * 34, ay - 30); g.lineTo(x - dir * 34, ay + 30); g.closePath(); g.fill(); };
    if (this.page > 0) tri(gx - gap - 54, -1);
    if (this.page < MYCHAR_PAGES.length - 1) tri(gx - gap + pw + 54, 1);
    // the name box (bottom left)
    const v = this.item(this.cur), nm = this.label(v);
    g.fillStyle = '#1f6fd0'; g.fillRect(290, 560, 260, 70); g.fillStyle = '#3b8ff0'; g.fillRect(296, 566, 248, 58);
    if (nm) text(nm, 420, 596, fitSize(nm, 30, 230), '#fff', 'center');
    // the buttons
    text('Enter CONFIRM    Esc BACK    Arrows SELECT', 1240, 690, 18, '#fff', 'right');
  },
};

const Select = {
  idx: 0, moved: 0, previewFor: -1, previewSrc: null, previewGain: null, previewCache: new Map(),
  // hold left / right (keys or a mat panel) to keep scrolling: a pause, then faster and faster
  held: 0, heldSince: 0, nextRep: 0, reps: 0,
  update() {
    const now = performance.now();
    if (this.okAt && now - this.okAt > 450) { this.launch(); return; }
    if (this.stage || this.join || this.typing !== null || !this.order || this.order.length < 2) { this.held = 0; return; }
    const hpm = hpLike();
    const key = { L: hpm ? 'Up' : 'Left', R: hpm ? 'Down' : 'Right' }, pad = { L: hpm ? 'U' : 'L', R: hpm ? 'D' : 'R' };
    const side = d => ['P1', 'P2', 'P3', 'P4'].some(p => input.isDown(p + pad[d])) || !!input.down['k:Arrow' + key[d]];
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
    const last = S.lastSlot && SONGS.find(s => (s.custom || s.disc) && s.slot === S.lastSlot);
    if (last && this.inFolder === undefined) this.inFolder = last.folder;
    this.buildOrder();
    this.order = this.filtered(this.query);
    if (!this.order.length) { this.query = ''; this.order = this.fullOrder; }   // the songs changed under the search
    this.typing = null; this.stage = null;
    this.idx = Math.min(this.idx, this.order.length - 1);
    if (S.lastSlot) { const i = this.order.findIndex(s => s.slot === S.lastSlot || s.full === S.lastSlot || (s.alt && s.alt.slot === S.lastSlot)); if (i >= 0) this.idx = i; }
    // otherwise start on the game's first song, not on RANDOM or another game's folder
    if (this.order[this.idx] && (this.order[this.idx].folderTile || this.order[this.idx].random) && !this.inFolder) {
      const i = this.order.findIndex(s => !s.folderTile && !s.random); if (i >= 0) this.idx = i;
    }
    this.fixDiff();
    this.moved = performance.now();
  },
  leave() { this.stopPreview(); this.typing = null; },
  // the list: RANDOM, then a tile for each of your custom folders, then the game's songs
  // (Replicant D-action together at the end, in the game's order). Inside a folder: just its songs.
  inFolder: undefined,
  buildOrder() {
    // in Double, songs with no Double charts are left out
    const ok = s => !isLocked(s) && (styleNow() !== 'double' || hasDouble(s));
    const all = SONGS.filter(ok), gm = gameNow();
    // the game's own songs straight in the list; every other game's songs and your custom songs each
    // get a folder (DDR II, HOTTEST PARTY, HOTTEST PARTY 2, then your folders)
    const homeDisc = gm === 'hp' || gm === 'hp2' || gm === 'hp3' ? gm : null;
    let home = all.filter(s => !s.custom && (homeDisc ? s.disc === homeDisc : !s.disc));
    if (!homeDisc) home = home.filter(s => rdaIndex(s) < 0).concat(home.filter(s => rdaIndex(s) >= 0).sort((a, b) => rdaIndex(a) - rdaIndex(b)));
    const away = all.filter(s => !home.includes(s));
    const groups = ['DANCE DANCE REVOLUTION II', 'HOTTEST PARTY', 'HOTTEST PARTY 2', 'HOTTEST PARTY 3'].filter(f => away.some(s => folderOf(s) === f))
      .concat([...new Set(away.filter(s => s.disc).map(s => s.folder))].filter(f => !['HOTTEST PARTY', 'HOTTEST PARTY 2', 'HOTTEST PARTY 3'].includes(f)), CUSTOM_FOLDERS);
    this.allSongs = home.concat(away);                  // what a search looks through
    if (this.inFolder) {
      this.fullOrder = away.filter(s => folderOf(s) === this.inFolder);
      if (!this.fullOrder.length) this.inFolder = null;
      else return;
    }
    const tiles = [...new Set(groups)].map(f => ({ folderTile: true, folder: f, disc: away.some(s => !s.custom && folderOf(s) === f), slot: 'folder:' + f, name: f, artist: '',
      count: away.filter(s => folderOf(s) === f).length, bpm: ['---', '---'], length: 0,
      single: [0, 0, 0, 0, 0], double: [0, 0, 0, 0, 0], radar: [], jacket: null, title: null }));
    // DDR II's own row before the songs (Wii): OPTIONS, COURSE MUSIC, MY CHARACTER, FAVORITE MUSIC, RANDOM
    const sys = hpLike() ? [] : [OPTIONS_TILE].concat(S.mode === 'free' && !BATTLE && !GC && styleNow() !== 'double' && !P2 ? [COURSE_TILE] : [],
      window.Dancer3D ? [MYCHAR_TILE] : [], [FAV_TILE]);
    this.fullOrder = sys.concat([RANDOM_SONG], tiles, home.length ? home : away);
  },
  openFolder(tile) {
    if (tile.myChar) { sfx('SE_SYS_DECIDE01'); this.stopPreview && this.stopPreview(); go(MyChar); return; }
    if (tile.special === 'options') { sfx('SE_SYS_WINDOWIN'); this.stopPreview && this.stopPreview(); Options.keep = false; Options.from = Select; go(Options); return; }
    if (tile.special === 'course') { sfx('SE_SYS_DECIDE01'); this.stopPreview && this.stopPreview(); CourseSel.fromSelect = true; go(CourseSel); return; }
    if (tile.special === 'fav') {                         // your favorite songs only (BACK: the whole list again)
      if (!this.fullOrder.some(s => isFav(s))) { this.note = 'No favorites yet - press Q to star a song'; this.noteAt = performance.now(); sfx('SE_SYS_ERROR'); return; }
      sfx('SE_SYS_DECIDE01'); this.favOnly = true; this.order = this.filtered(this.query = ''); this.idx = 0;
      this.moved = performance.now(); this.stopPreview && this.stopPreview(); this.fixDiff(); return;
    }
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
    // (in Double only the versions with Double charts count: a song whose short or full version has none
    // shows the other one)
    const dbl = v => (v.double || []).some(x => x > 0), dblOnly = styleNow() === 'double' && s.alt && !s.folderTile;
    let short = !!(S.short && s.alt);
    if (dblOnly && !dbl(short ? s.alt : s)) short = !short;
    if (short) return Object.assign({}, s, s.alt, { isShort: true, movie: s.movie });   // the short version keeps the song's video
    return Object.assign({}, s, { isShort: !!s.short });
  },
  hasBoth() {
    const s = this.order[this.idx];
    if (!(s && s.alt)) return false;
    if (styleNow() !== 'double') return true;
    const dbl = v => (v.double || []).some(x => x > 0);
    return dbl(s) && dbl(s.alt);
  },
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
    if (who === 1 && P2 && !GROUP) { P2.diff = this.stepDiff(P2.diff, d); return; }
    if (who >= 2 && PX[who - 2] && !GROUP) { PX[who - 2].diff = this.stepDiff(PX[who - 2].diff, d); return; }
    const n = this.stepDiff(S.diff, d);
    if (n !== S.diff) { S.diff = n; saveSettings(); }
    if (GROUP && P2) P2.diff = S.diff;            // FRIENDSHIP / SYNC: everyone dances the same chart
    if (GROUP) PX.forEach(x => { if (x) x.diff = S.diff; });
  },
  // player 2 joins (or changes who they are / leaves): a small list of user data
  openJoin() {
    if (BATTLE) return;          // BATTLE MODE: player 2 is the computer
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
    if (this.stage === 'go') return;
    if (this.stage) { this.stageInput(a); return; }
    if (a === 'BACK' && this.query) { this.applySearch(''); sfx('SE_SYS_WINDOWOUT'); return; }
    if (a === 'BACK' && this.inFolder && !this.favOnly) { this.closeFolder(); return; }
    if (a === 'BACK' && !this.favOnly) { sfx('SE_SYS_WINDOWOUT'); this.stopPreview(); go(BATTLE ? BattleSel : Style); return; }
    // in VERSUS each player picks their own difficulty: player 2 is the P2 side (Single) or P3/P4 (Double)
    let who = 0;
    const pm = /^P([1-4])([LDUR])$/.exec(a);
    if (pm) {
      const n = +pm[1];
      if (P2) who = styleNow() === 'double' ? (n >= 3 ? 1 : 0) : n >= 3 ? (PX[n - 3] ? n - 1 : 0) : (n === 2 ? 1 : 0);
      a = 'P1' + pm[2];
    }
    // Hottest Party: the list goes up and down, left / right picks the difficulty, Enter starts
    if (hpLike()) {
      const swap = { P1L: 'P1U', P1R: 'P1D', P1U: 'P1L', P1D: 'P1R' };
      if (swap[a]) a = swap[a];
      if (a === 'START' && this.order[this.idx] && this.order[this.idx].folderTile) { this.openFolder(this.order[this.idx]); return; }
      if (a === 'START' && this.order[this.idx] && !this.order[this.idx].random) {
        if (!levelsOf(this.song()).some(v => v > 0)) { sfx('SE_SYS_ERROR'); return; }
        if (this.okAt) return;
        sfx('SE_SYS_DECIDE01'); this.stage = 'go'; this.okAt = performance.now(); return;
      }
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
    else if (a === 'OPTIONS') { sfx('SE_SYS_WINDOWIN'); Options.keep = false; go(Options); }
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
        // every player's pick: P1 S.diff, P2 P2.diff, P3 / P4 PX (FRIENDSHIP / SYNC: all share S.diff)
        const picks = [S.diff, P2 && (GROUP ? S.diff : P2.diff), ...PX.map(x => x && (GROUP ? S.diff : x.diff))];
        const here = picks.map((pd, k) => pd === d ? k : -1).filter(k => k >= 0), marks = A.img.selMarks && A.img.selMarks[0];
        const sc = on ? 1.12 : 1, bw = 156 * sc, bh = 57 * sc, cx = px + 475, cy = top + r * step + 28;
        const bx = cx - bw / 2, by = cy - bh / 2;
        if (on || here.length) {          // (Wii 3 / 4 player screenshots: every picked button gets the orange frame)
          g.save(); g.shadowColor = '#ff8a10'; g.shadowBlur = 14;
          g.strokeStyle = `rgba(255,${this.okAt ? 120 : 110 + 40 * pulse},20,1)`; g.lineWidth = 5;
          g.beginPath(); g.roundRect ? g.roundRect(bx - 5, by - 5, bw + 10, bh + 10, 10) : g.rect(bx - 5, by - 5, bw + 10, bh + 10); g.stroke();
          g.restore();
        }
        if (P.diff && P.diff[i]) g.drawImage(P.diff[i], bx, by, bw, bh); else { g.fillStyle = DIFFS[i][2]; g.fillRect(bx, by, bw, bh); text(name, bx + 10, by + 16, 15, '#fff'); }
        const str = String(lv[i]).padStart(2, '0'), ny = by + bh * 0.3, fs = 19 * sc;
        outl(str[0], bx + bw * 0.845, ny, fs, str[0] === '0' ? 'rgba(255,255,255,0.35)' : '#fff', 'center');
        outl(str[1], bx + bw * 0.935, ny, fs, '#fff', 'center');
        if (on && this.okAt) { if (!blit(P.ok, bx + bw - 30, by + bh - 15, 1)) text('OK', bx + bw - 30, by + bh - 15, 18, '#ffe14d', 'center'); }
        if (marks) {
          // the game's markers (selMusic CAE 0x178ae0, sel_1p-4p): drawn at (133, -1) from the button's middle,
          // pivot (60, 21); player n's badge sits n-1 slots out, so players sharing a button line up 1 2 3 4
          // (drawn farthest first, so each nearer badge covers the longer lines behind it).
          // Sized to this window's buttons (the game's button: 180 x 0.9).
          const k = 156 / (180 * 0.9);          // (game units -> this window's pixels)
          here.slice().reverse().forEach(pi => { const m = A.img.selMarks[pi]; if (m) g.drawImage(m, cx + (133 - 60) * k, cy + (-1 - 21) * k, m.width * k, m.height * k); });
        } else {
          if (on && !blit(P.badge && P.badge[0], bx + bw + 24, cy, 0.5)) text('1', bx + bw + 24, cy, 18, '#fff', 'center');
          if (on2 && !blit(P.badge && P.badge[1], bx - 24, cy, 0.5)) text('2', bx - 24, cy, 18, '#fff', 'center');
        }
      });
      footer([['Up/Down', 'DIFFICULTY'], ['Enter', 'START'], ['Esc', 'BACK']]);
    }
    g.restore();
  },
  draw(t) {
    { const cur = this.order && this.order[this.idx];
      HP_LOOK = hpLike() || !!((this.inFolder && SONGS.some(s => s.disc && s.folder === this.inFolder)) || (cur && (cur.disc || (cur.folderTile && cur.disc)))); }
    if (hpLike() && !this.join && this.order && this.order.length) { if (hp2Sel()) this.drawHP2(t); else this.drawHP(t); return; }
    if (look('select') === 'hp3' && !this.join && this.order && this.order.length) { this.drawHP3(t); return; }
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
    else if (this.inFolder || song.custom || song.disc) { const f = this.inFolder || song.folder; g.fillStyle = 'rgba(10,60,40,0.5)'; g.fillRect(0, 0, 432, 74); text(f.toUpperCase(), 216, 38, 30, '#e8fff4', 'center'); const dsc = SONGS.some(s => s.disc && s.folder === f); text(dsc ? (this.inFolder ? 'FROM YOUR DISC   Esc: back to all songs' : 'FROM YOUR DISC') : this.inFolder ? 'YOUR FOLDER   Esc: back to all songs' : 'CUSTOM SONGS', 216, 64, 13, '#bfffe0', 'center', 'normal'); }
    else if (!blit(A.img.selTitle, 222, 50, 1.45)) text('SELECT MUSIC', 222, 50, 34, '#fff', 'center');
    // title + BPM / length (top right)
    const ti = texture('title', song.title);
    if (ti.img) g.drawImage(ti.img, 640 - ti.img.width * 0.85, 30, ti.img.width * 1.7, ti.img.height * 1.7);
    else { text(song.name.slice(0, 40), 640, song.artist ? 50 : 66, Math.min(28, Math.round(440 / (0.56 * Math.max(1, song.name.slice(0, 40).length)))), '#fff', 'center'); if (song.artist) text(song.artist.slice(0, 44), 640, 86, 18, '#dff', 'center'); }
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
    // the challenge task's song gets the game's "Specified Song" sticker (selMusic_us.bin /0/3/0/4),
    // over the jacket's lower right, tilted (placed from the Wii's song select)
    const ctk = !song.random && !song.folderTile && SAVE ? ctTask(SAVE) : null;
    if (ctk && !ctk.any && song.slot && ctSongOk(ctk, song.slot)) {
      if (A.specSong === undefined && A.tplOf) {
        A.specSong = null;
        A.tplOf('mus', '/0/3/0/4').then(t => { A.specSong = t[0] ? t[0].canvas : null; }).catch(() => {});
      }
      if (A.specSong) {
        g.save(); g.translate(big * 0.14, big * 0.2); g.rotate(-0.42);
        const bw = big * 0.86, bh = bw * A.specSong.height / A.specSong.width;
        g.drawImage(A.specSong, -bw / 2, -bh / 2, bw, bh); g.restore();
      }
    }
    g.restore();
    // pink arrows and the position bar under the row
    const bob = 0;
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
    const PX = 629, PY = 405, PW = 383, PH = 232;
    if (A.img.diffPanel) g.drawImage(A.img.diffPanel, PX, PY, PW, PH);
    else panel(PX, PY, PW, PH);
    // the rows go in the middle of the panel's visible box (the picture has see-through margins)
    // the blue box shows at x 636-1004, y 437-630 (the picture's top part is see-through): rows in its middle
    const rowW = 338, rowX = Math.round((636 + 1004 - rowW) / 2), rowY = Math.round((437 + 630 - (4 * 43 - 3)) / 2);
    const lv = levelsOf(song);
    // like the game, only the difficulties the song has, from the top
    const shown = DIFFS.map((x, i) => i).filter(i => lv[i] > 0);
    DIFFS.forEach(([d, name, col], i) => {
      const row = shown.indexOf(i);
      if (row < 0) return;
      const y = rowY + row * 43, x = rowX, w = rowW, h = 40, on = S.diff === d, has = true;
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
        if (rec.fc && A.img.crowns) blit(A.img.crowns[rec.fc === 5 ? 2 : rec.fc === 4 ? 0 : rec.fc === 3 ? 1 : 3], x + 4, y + h / 2 - 6, 0.7);
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
    if (!drawPointsPlate()) {
      g.fillStyle = 'rgba(20,40,150,0.9)'; g.fillRect(28, 636, 150, 22);
      text('DDR POINTS', 103, 647, 15, '#fff', 'center');
      text(String(SAVE.points).padStart(7, '0') + ' pts', 28, 678, 24, '#ffe86a');
    }
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
  // Hottest Party's song select, built from its own pictures (data/ddrmodesel.bin, selcom.bin):
  // the song on the left (banner frame, BPM, stage, the four difficulty bars with your grade and the
  // level in feet), the songs as tabs on the right over the cream curve, a scroll bar at the edge
  drawHP(t) {
    menuBackground(t);
    const song = this.song(), now = performance.now(), U = hp2Sel() ? hp2SelUI() : hpUI();
    if (now - this.moved > 350 && this.previewFor !== song.slot && song.preview) this.startPreview(song);
    const im = (img, x, y, w, h) => { if (img && img.complete && img.naturalWidth) { g.drawImage(img, x, y, w || img.naturalWidth, h || img.naturalHeight); return true; } return false; };
    const ital = (str, x, y, size, col, align = 'left', stroke = '#5a1a00') => {
      g.font = `italic 900 ${size}px "Arial Black", "Segoe UI", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = Math.max(3, size / 5); g.strokeStyle = stroke; g.strokeText(str, x, y);
      g.fillStyle = col; g.fillText(str, x, y);
    };
    // the cream curve behind the list
    if (U.hp2) im(U.curve, 800, 0, 480, 720); else im(U.curve, 760, 0, 520, 720);
    // header
    if (!(U.hp2 ? im(U.header, 0, 6, 832, 96) : im(U.header, 0, 0, 900, 93))) ital('SELECT MUSIC', 40, 34, 32, '#fff');
    // ---- the song: banner frame (banner, BPM, stage)
    const fx = 170, fy = 82, fw = 339, fh = 255, kx = fw / 226, ky = fh / 170;
    im(U.frame, fx, fy, fw, fh);
    // the picture's screen: HP1's frame has a banner window at the top; HP2's frame is all screen
    const bx = U.hp2 ? fx + 0.06 * fw : fx + 12 * kx, by = U.hp2 ? fy + 0.15 * fh : fy + 21 * ky,
          bw = U.hp2 ? 0.80 * fw : 202 * kx, bh = U.hp2 ? 0.72 * fh : 99 * ky;
    if (song.random) this.drawRandomTile(bx, by, bw, bh, t);
    else if (song.folderTile) this.drawFolderTile(bx, by, bw, bh, song);
    else {
      const jk = texture('jacket', song.jacket);
      const sq = U.hp2 && texture('jacket', song.jacket);
      if (sq && sq.img) {                                  // HP2's screen: the song's tile (its design and name tab)
        const k = Math.max(bw / sq.img.width, bh / sq.img.height), sw = bw / k, sh = bh / k;
        g.drawImage(sq.img, (sq.img.width - sw) / 2, (sq.img.height - sh) / 2, sw, sh, bx, by, bw, bh);
      } else if (jk && jk.img && song.disc === 'hp2') {            // HP2's art is the song's name tab: on a dark panel
        g.fillStyle = '#1a1030'; g.fillRect(bx, by, bw, bh);
        const sc = Math.min(bw / jk.img.width, bh / jk.img.height) * 0.95;
        g.drawImage(jk.img, bx + bw / 2 - jk.img.width * sc / 2, by + bh / 2 - jk.img.height * sc / 2, jk.img.width * sc, jk.img.height * sc);
      } else if (jk && jk.img) g.drawImage(jk.img, 0, jk.img.height * 0.27, jk.img.width, jk.img.height * 0.46, bx, by, bw, bh);
    }
    const bpm = song.random ? '???' : song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + ' - ' + song.bpm[1];
    if (U.hp2) {                                  // BPM under the screen
      ital('BPM', fx + fw + 14, fy + fh - 46, 18, '#ffe14a', 'left', '#3a2400');
      ital(bpm, fx + fw + 14, fy + fh - 20, 24, '#fff', 'left', '#000');
    } else {
      ital(bpm, fx + 78 * kx, fy + 131 * ky, 21, '#fff', 'left', '#000');
      ital(S.hpStage && S.hpStage !== 'random' && S.hpStage !== 'song' ? 'STAGE ' + S.hpStage : 'RANDOM', fx + 12 * kx, fy + 152 * ky, 19, '#fff', 'left', '#000');
    }
    // ---- difficulties: the game's bars, your grade on the left, the level in feet on the right
    const lv = levelsOf(song), FOOT = { 4: '#3cc8ff', 1: '#ff9a2a', 2: '#ff4ad0', 3: '#46e04a' };
    [4, 1, 2, 3].forEach((d, i) => {
      const di = DIFFS.findIndex(x => x[0] === d), lvl = lv[di] || 0, y = 352 + i * 72, on = S.diff === d && !song.random;
      const x = on ? 76 : 96, w = U.hp2 ? 440 : 450, h = U.hp2 ? 76 : 70;
      g.globalAlpha = lvl || song.random ? 1 : 0.4;
      if (!im(U.diff[i], x, y, w, h)) { g.fillStyle = FOOT[d]; g.fillRect(x, y, w, h); ital(DIFFS[di][1], x + 80, y + h / 2, 24, '#fff'); }
      if (on) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.roundRect ? g.roundRect(x + 3, y + 3, w - 18, h - 14, 26) : g.rect(x + 3, y + 3, w - 18, h - 14); g.stroke(); }
      // feet: 10, lit up to the level (HP2's bars have dark feet printed on them: light those up)
      if (U.hp2) for (let k = 0; k < Math.min(10, lvl); k++) {
        const fh2 = h * 0.5, fw2 = fh2 * 20 / 26, fx2 = x + w * (0.584 + k * 0.0372), fy2 = y + h * 0.24;
        if (U.foot && U.foot.complete && U.foot.naturalWidth) { tintFoot(U.foot, FOOT[d]); g.drawImage(tintFoot.cv, fx2, fy2, fw2, fh2); }
      }
      else for (let k = 0; k < 10; k++) {
        const fx2 = x + 262 + k * 16, fy2 = y + 18;
        g.save();
        g.globalAlpha *= k < lvl ? 1 : 0.35;
        if (U.foot && U.foot.complete && U.foot.naturalWidth) { tintFoot(U.foot, FOOT[d]); g.drawImage(tintFoot.cv, fx2, fy2, 15, 22); }
        else { g.fillStyle = FOOT[d]; g.fillRect(fx2 + 3, fy2 + 4, 12, 20); }
        g.restore();
      }
      // your best grade on this chart
      const rec = song.random ? null : recordOf(song, d);
      const gi = rec && rec.grade ? { E: 1, D: 2, C: 3, B: 4, A: 5, AA: 6, AAA: 7 }[rec.grade] : 0;
      if (gi && U.grades[gi - 1]) im(U.grades[gi - 1], x - 4, y - 4, 74, 70);
      g.globalAlpha = 1;
      if (on) {                                   // the player's cursor
        if (!im(U.p1, x + w - 12, y + 18, 34, 34)) { g.fillStyle = '#ffe000'; g.beginPath(); g.arc(x + w + 4, y + 35, 16, 0, Math.PI * 2); g.fill(); }
      }
    });
    im(U.down, 310, 646, 50, 50);
    // ---- the list
    const n = this.order.length, rowH = 112, cy = 360;
    const anim = clamp((now - this.moved) / 120), shift = (1 - anim) * (this.lastDir || 0) * rowH;
    g.save(); g.beginPath(); g.rect(780, 60, 470, 600); g.clip();
    for (let k = -3; k <= 3; k++) {
      const i = ((this.idx + k) % n + n) % n, s2 = this.order[i], on = k === 0;
      const y = cy + k * rowH + shift - 42, x = 850 + Math.abs(k) * 6, w = 360, h = 86;
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(-0.03); g.translate(-(x + w / 2), -(y + h / 2));
      if (!im(on && U.tileOn ? U.tileOn : U.tile, x, y, w, h)) { g.fillStyle = '#ff5a1a'; g.fillRect(x, y, w, h); }
      if (s2.random) ital('RANDOM', x + w / 2, y + h / 2, 34, rainbowAt(t), 'center', '#3a0060');
      else if (s2.folderTile) {                    // a folder: another game's songs, or your custom songs
        ital(s2.name.length > 24 ? s2.name.slice(0, 23) + '…' : s2.name, x + w / 2, y + 34, s2.name.length > 18 ? 20 : 26, '#fff7a0', 'center', '#3a0a00');
        ital(s2.count + ' songs  ▶', x + w / 2, y + 62, 15, '#fff', 'center', '#3a0a00');
      }
      else {
        const jt = s2.disc === 'hp2' ? texture('raw', s2.tab || s2.jacket) : null;
        const ti = s2.disc === 'hp' ? U.titles[s2.slot - 1000] : jt && jt.img ? jt.img : null;
        if (!(ti && (U.hp2 && s2.disc === 'hp2' ? im(ti, x, y, w, h) : im(ti, x + w / 2 - 172, y + h / 2 - 34, 344, 69)))) {
          ital(s2.name.slice(0, 26), x + w / 2, y + 32, 22, '#ffe14a', 'center', '#3a0a00');
          if (s2.artist) ital(s2.artist.slice(0, 30), x + w / 2, y + 60, 15, '#fff', 'center', '#3a0a00');
        }
      }
      g.restore();
      if (on) {                                    // the green frame and its pointer
        if (!im(U.sel, x - 20, y - 14, w + 40, h + 28)) { g.strokeStyle = '#3cff5a'; g.lineWidth = 6; g.strokeRect(x - 6, y - 6, w + 12, h + 12); }
      }
    }
    g.restore();
    im(U.up, 1010, 62, 50, 50); im(U.down, 1010, 606, 50, 50);
    // scroll bar
    if (!im(U.track, 1236, 66, 34, 590)) { g.fillStyle = U.hp2 ? '#5a3a00' : '#4a0a00'; g.fillRect(1240, 66, 22, 590); }
    im(U.thumb, 1238, 70 + 500 * (this.idx / Math.max(1, n - 1)), 30, 80);
    // controls, as the game's dark tabs
    const hints = [['Enter', 'CONFIRM'], ['Esc', 'BACK'], ['S', 'SEARCH'], ['Left/Right', 'DIFFICULTY'], ['Up/Down', 'MUSIC'], ['Tab', 'OPTIONS']];
    hints.forEach(([k, l], i) => {
      const x = 640 + (i % 3) * 212, y = 668 + Math.floor(i / 3) * 28, w = 204;
      g.fillStyle = 'rgba(40,40,40,0.85)'; g.beginPath(); g.roundRect ? g.roundRect(x, y - 12, w, 24, 12) : g.rect(x, y - 12, w, 24); g.fill();
      g.font = 'bold 13px "Segoe UI", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffcf6a'; g.fillText(k, x + 10, y);
      ital(l, x + w - 10, y, 14, '#fff', 'right', '#000');
    });
    if (this.note && now - this.noteAt < 2500) text(this.note, 640, 620, 20, '#fff', 'center');
    if (this.typing !== null) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(320, 300, 640, 70); text('SEARCH: ' + this.typing + '_', 640, 335, 26, '#fff', 'center'); }
    if (this.okAt) { g.fillStyle = `rgba(255,255,255,${0.5 * (1 - clamp((now - this.okAt) / 450))})`; g.fillRect(0, 0, W, H); }
  },
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
  // Hottest Party 2's song select, laid out from a recording of the real game (Wii pictures are drawn
  // 4:3 and stretched to widescreen, so they're a third wider here than on the disc)
  drawHP2(t) {
    menuBackground(t);
    const song = this.song(), now = performance.now(), U = hp2SelUI();
    if (now - this.moved > 350 && this.previewFor !== song.slot && song.preview) this.startPreview(song);
    const im = (img, x, y, w, h) => { if (img && img.complete && img.naturalWidth) { g.drawImage(img, x, y, w || img.naturalWidth, h || img.naturalHeight); return true; } return false; };
    const lbl = (str, x, y, size, col = '#fff', align = 'left') => {
      g.font = `900 ${size}px "Arial Black", "Segoe UI", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = Math.max(3, size / 5); g.strokeStyle = '#1a1030'; g.strokeText(str, x, y); g.fillStyle = col; g.fillText(str, x, y);
    };
    // the gold panel on the right (its curved edge), the list's scroll bar, and the bottom band
    im(U.curve, 760, 50, 560, 672);
    g.fillStyle = 'rgba(30,20,0,0.85)'; g.fillRect(1258, 130, 14, 520);
    im(U.thumb, 1252, 130 + 410 * (this.idx / Math.max(1, this.order.length - 1)), 26, 110);
    // ---- the list: song tabs on a gentle arc, the cursor's in the green frame
    const n = this.order.length, rowH = 115, cy = 349;
    const anim = clamp((now - this.moved) / 120), shift = (1 - anim) * (this.lastDir || 0) * rowH;
    g.save(); g.beginPath(); g.rect(820, 60, 430, 610); g.clip();
    for (let k = -3; k <= 3; k++) {
      const i = ((this.idx + k) % n + n) % n, s2 = this.order[i], on = k === 0;
      const w = 354, h = 85, x = 868 + Math.abs(k) * 4, y = cy + k * rowH + shift - h / 2;
      g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(0.035 * (k + (on ? 0 : -shift / rowH))); g.translate(-(x + w / 2), -(y + h / 2));
      if (on) im(U.sel, x - 16, y - 12, w + 34, h + 26);
      if (!im(U.tile, x, y, w, h)) { g.fillStyle = '#ff4a1a'; g.fillRect(x, y, w, h); }
      if (s2.random) lbl('RANDOM', x + w / 2, y + h / 2, 30, rainbowAt(t), 'center');
      else if (s2.folderTile) {
        lbl(s2.name, x + w / 2, y + 32, fitSize(s2.name, 26, w - 30), '#fff7a0', 'center');
        lbl(s2.count + ' songs  ▶', x + w / 2, y + 62, 15, '#fff', 'center');
      } else {
        const tab = s2.disc === 'hp2' ? texture('raw', s2.tab || s2.jacket) : null;
        const hp1 = s2.disc === 'hp' ? hpUI().titles[s2.slot - 1000] : null;
        if (!(tab && tab.img ? (g.drawImage(tab.img, x, y, w, h), true) : hp1 && im(hp1, x + 8, y + 6, w - 16, h - 12))) {
          lbl(s2.name, x + w / 2, y + 32, fitSize(s2.name, 26, w - 30), '#ffe14a', 'center');
          if (s2.artist) lbl(s2.artist, x + w / 2, y + 62, fitSize(s2.artist, 16, w - 40), '#fff', 'center');
        }
      }
      g.restore();
    }
    g.restore();
    // ---- header: the gold band and the SELECT MUSIC tab
    if (!im(U.header, 0, -6, 1320, 118)) lbl('SELECT MUSIC', 90, 62, 40, '#fff');
    // ---- the song's box: its picture, then BPM and STAGE
    const bx = 110, by = 120, bw = 324, bh = 242;
    if (!im(U.info, bx, by, bw, bh)) { g.fillStyle = '#101028'; g.fillRect(bx, by, bw, bh); }
    const ax = bx + 6, ay = by + 12, aw = bw - 12, ah = 162;        // the box's white window (BPM and STAGE bars under it)
    if (song.random) this.drawRandomTile(ax, ay, aw, ah, t);
    else if (song.folderTile) this.drawFolderTile(ax, ay, aw, ah, song);
    else {
      // HP2's song picture fills the window, as in the game; other songs show their tile
      const raw = song.disc === 'hp2' ? texture('raw', song.jacket) : null, sq = texture('jacket', song.jacket);
      if (raw && raw.img) g.drawImage(raw.img, ax, ay, aw, ah);
      else if (sq && sq.img) { const k = Math.max(aw / sq.img.width, ah / sq.img.height), sw = aw / k, sh = ah / k;
        g.drawImage(sq.img, (sq.img.width - sw) / 2, (sq.img.height - sh) / 2, sw, sh, ax, ay, aw, ah); }
    }
    const bpm = song.random ? '???' : song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + '-' + song.bpm[1];
    lbl(bpm, bx + 155, by + 0.757 * bh, 20, '#fff');
    lbl('STAGE', bx + 34, by + 0.925 * bh, 18, '#fff'); lbl(':', bx + 128, by + 0.925 * bh, 18, '#fff');
    lbl(S.hpStage && S.hpStage !== 'random' && S.hpStage !== 'song' ? 'STAGE ' + S.hpStage : 'RANDOM', bx + 155, by + 0.925 * bh, 18, '#fff');
    // ---- difficulties: the four bars, feet lit to the level, your grade on the left, the 1P marker
    const lv = levelsOf(song), FOOT = { 4: '#3cc8ff', 1: '#ff9a2a', 2: '#ff4ad0', 3: '#46e04a' };
    [4, 1, 2, 3].forEach((d, i) => {
      const di = DIFFS.findIndex(x => x[0] === d), lvl = lv[di] || 0, x = 116, y = 378 + i * 54, w = 401, h = 52, on = S.diff === d && !song.random;
      g.globalAlpha = lvl || song.random ? 1 : 0.4;
      if (!im(U.diff[i], x, y, w, h)) { g.fillStyle = FOOT[d]; g.fillRect(x, y, w, h); lbl(DIFFS[di][1], x + 80, y + h / 2, 22, '#fff'); }
      if (U.foot && U.foot.complete && U.foot.naturalWidth) {
        tintFoot(U.foot, FOOT[d]);
        for (let k = 0; k < Math.min(10, lvl); k++) g.drawImage(tintFoot.cv, x + w * (0.564 + k * 0.0374), y + h * 0.19, w * 0.045, h * 0.58);
      }
      const rec = song.random ? null : recordOf(song, d);
      const gi = rec && rec.grade ? { E: 1, D: 2, C: 3, B: 4, A: 5, AA: 6, AAA: 7 }[rec.grade] : 0;
      if (gi && U.grades[gi - 1]) im(U.grades[gi - 1], x + 12, y - 4, 64, 54);
      g.globalAlpha = 1;
      if (on) {
        const bob = Math.sin(t * 6) * 2;
        if (!im(U.p1, x + w - 74 + bob, y + 10, 96, 31)) { g.fillStyle = '#3c78ff'; g.beginPath(); g.arc(x + w + 18, y + h / 2, 15, 0, Math.PI * 2); g.fill(); lbl('1', x + w + 18, y + h / 2, 16, '#fff', 'center'); }
      }
    });
    // ---- controls along the bottom band
    g.fillStyle = 'rgba(70,40,0,0.35)'; g.fillRect(0, 676, W, 44);
    const hints = [['Enter', 'CONFIRM'], ['Esc', 'BACK'], ['Up/Down', 'MUSIC'], ['Left/Right', 'DIFFICULTY'], ['S', 'SEARCH'], ['Tab', 'OPTIONS']];
    hints.forEach(([k, l], i) => {
      const w = 196, x = 1280 - (hints.length - i) * (w + 6) - 8, y = 700;
      g.fillStyle = 'rgba(30,30,30,0.85)'; g.beginPath(); g.roundRect ? g.roundRect(x, y - 13, w, 26, 6) : g.rect(x, y - 13, w, 26); g.fill();
      g.font = 'bold 13px "Segoe UI", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffcf6a'; g.fillText(k, x + 8, y);
      lbl(l, x + w - 8, y, 14, '#fff', 'right');
    });
    if (this.note && now - this.noteAt < 2500) text(this.note, 640, 640, 20, '#fff', 'center');
    if (this.typing !== null) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(320, 300, 640, 70); text('SEARCH: ' + this.typing + '_', 640, 335, 26, '#fff', 'center'); }
    if (this.okAt) { g.fillStyle = `rgba(255,255,255,${0.5 * (1 - clamp((now - this.okAt) / 450))})`; g.fillRect(0, 0, W, H); }
  },
  // Hottest Party 3's song select, laid out from a recording of the real game: the orange panel with the
  // jacket row (the cursor's jacket big in the middle), title and artist above, BPM and STAGE under it,
  // the SORT bar, the radar on the left and the four difficulty bars on the right
  drawHP3(t) {
    menuBackground(t);
    const song = this.song(), now = performance.now(), U = hp3SelUI(), n = this.order.length;
    if (now - this.moved > 350 && this.previewFor !== song.slot && song.preview) this.startPreview(song);
    const ok = im => im && im.complete && im.naturalWidth;
    const im = (img, x, y, w, h) => { if (ok(img)) { g.drawImage(img, x, y, w || img.naturalWidth, h || img.naturalHeight); return true; } return false; };
    const lbl = (str, x, y, size, col = '#fff', align = 'center', stroke = '#1a2a6a') => {
      g.font = `900 ${size}px "Arial Black", "Segoe UI", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = Math.max(3, size / 5); g.strokeStyle = stroke; g.strokeText(str, x, y); g.fillStyle = col; g.fillText(str, x, y);
    };
    const tileOf = (s2, x, y, w, h) => {
      if (s2.random) this.drawRandomTile(x, y, w, h, t);
      else if (s2.folderTile) this.drawFolderTile(x, y, w, h, s2);
      else { const jk = texture('jacket', s2.jacket); if (jk && jk.img) g.drawImage(jk.img, x, y, w, h); else { g.fillStyle = '#123'; g.fillRect(x, y, w, h); lbl(s2.name.slice(0, 14), x + w / 2, y + h / 2, 13, '#fff'); } }
    };
    // clouds along the bottom
    im(U.clouds, -20, 600, 1320, 130);
    // ---- the orange panel and the jacket row
    if (!im(U.panel, 7, 24, 1265, 357)) { g.fillStyle = '#ffa020'; g.fillRect(7, 120, 1265, 260); }
    const at = k => this.order[((this.idx + k) % n + n) % n];
    const since = clamp((now - this.moved) / 140), slide = (1 - since) * (this.lastDir || 0);
    // side jackets: four each side, smaller and turned away the further out they are
    const SIDE = [[476, 346, 168, 150], [346, 223, 166, 146], [223, 119, 168, 140], [119, 33, 170, 136]];
    for (let k = 4; k >= 1; k--) {
      for (const dir of [-1, 1]) {
        const [x1, x0, y, h] = SIDE[k - 1], w = x1 - x0, sk = 0.05 * dir;
        const x = dir < 0 ? x0 + slide * 30 : 1280 - x1 + slide * 30;
        if (n < 2) continue;
        g.save(); g.transform(1, dir < 0 ? -sk : sk, 0, 1, x, y + (dir < 0 ? sk * w : 0));
        g.fillStyle = '#000'; g.fillRect(-4, -4, w + 8, h + 8);
        tileOf(at(dir * k), 0, 0, w, h);
        g.restore();
      }
    }
    // the cursor's jacket, big, in its yellow frame
    const bx = 536, by = 113, bw = 206, pop = 0.94 + 0.06 * since;
    g.save(); g.translate(bx + bw / 2, by + bw / 2); g.scale(pop, pop);
    g.fillStyle = '#000'; g.fillRect(-bw / 2 - 6, -bw / 2 - 6, bw + 12, bw + 12);
    tileOf(song, -bw / 2, -bw / 2, bw, bw);
    im(U.bigFrame, -bw / 2 - 14, -bw / 2 - 14, bw + 28, bw + 28);
    g.restore();
    // green arrows either side
    const bob = 0;
    if (ok(U.arrow)) {
      g.save(); g.translate(536 - 6 - bob, 214); g.scale(-1, 1); g.drawImage(U.arrow, 0, -48, 50, 96); g.restore();
      g.drawImage(U.arrow, 744 + 6 + bob, 166, 50, 96);
    }
    // title and artist above the jacket
    const title = song.random ? 'RANDOM' : song.folderTile ? song.name : song.name, artist = song.random || song.folderTile ? '' : (song.artist || '');
    lbl(title, 640, 50, fitSize(title, 30, 420), '#ffe23c', 'center', '#3a1200');
    if (artist) lbl(artist, 640, 82, fitSize(artist, 18, 400), '#fff', 'center', '#3a1200');
    // BPM and STAGE bars under the row
    const bpm = song.random ? '???' : song.bpm[0] === song.bpm[1] ? '' + song.bpm[0] : song.bpm[0] + '-' + song.bpm[1];
    lbl(bpm, 736, 342, 20, '#fff', 'right', '#000');             // (the panel picture has the BPM bar)
    if (!im(U.stage, 800, 327, 270, 44)) lbl('STAGE', 840, 346, 17, '#fff');
    lbl(S.hpStage && S.hpStage !== 'random' && S.hpStage !== 'song' ? 'STAGE ' + S.hpStage : 'RANDOM', 990, 346, 18, '#fff', 'center', '#000');
    // ---- SORT bar with the scroll position
    im(U.sort, 246, 360, 788, 74);
    if (ok(U.thumb)) g.drawImage(U.thumb, 262 + (this.idx / Math.max(1, n - 1)) * 640, 368, 46, 12);
    if (!im(U.sortName, 890, 413, 96, 16)) lbl(this.favOnly ? 'FAVORITE' : this.query ? 'SEARCH' : 'DEFAULT', 935, 421, 14, '#1a2a6a', 'center', '#fff');
    // ---- the radar (left)
    const rx = 320, ry = 528;
    im(U.radar, rx - 128, ry - 120, 256, 248);
    if (!song.random && !song.folderTile) { g.save(); g.translate(rx, ry + 8); g.scale(1.85, 1.85); this.drawRadar(song, 0, 0, 1, true); g.restore(); }
    const LB = U.labels;
    im(LB.STREAM, rx + 2, ry - 140, 90, 30); im(LB.CHAOS, rx + 82, ry - 40, 84, 30); im(LB.FREEZE, rx + 58, ry + 74, 90, 30);
    im(LB.AIR, rx - 118, ry + 86, 54, 30); im(LB.VOLTAGE, rx - 196, ry - 4, 104, 30);
    // ---- difficulties (right): bar, your grade on it, feet lit to the level, the 1P marker on yours
    const lv = levelsOf(song);
    [4, 1, 2, 3].forEach((d, i) => {
      const di = DIFFS.findIndex(x => x[0] === d), lvl = lv[di] || 0, x = 711, y = 436 + i * 53, w = 360, h = 47;
      g.globalAlpha = lvl || song.random ? 1 : 0.45;
      if (!im(U.bars[i], x, y, w, h)) { g.fillStyle = ['#3cc8ff', '#ffd23c', '#ff4ad0', '#46e04a'][i]; g.fillRect(x, y, w, h); lbl(DIFFS[di][1], x + 120, y + h / 2, 20, '#fff'); }
      for (let k = 0; k < 10; k++) im(U.feet[k < lvl ? i + 1 : 0], x + 226 + k * 13.2, y + 8, 18, 31);
      const rec = song.random ? null : recordOf(song, d);
      const gi = rec && rec.grade ? ['AAA', 'AA', 'A', 'B', 'C', 'D', 'E'].indexOf(rec.grade) : -1;
      if (gi >= 0) im(U.grades[gi], x + 22, y - 2, 46, 50);
      g.globalAlpha = 1;
      if (S.diff === d && !song.random && !im(U.p1, x + w - 20 + Math.sin(t * 6) * 2, y + 4, 86, 40)) {
        g.fillStyle = '#2a6cff'; g.beginPath(); g.arc(x + w + 20, y + h / 2, 15, 0, Math.PI * 2); g.fill(); lbl('1', x + w + 20, y + h / 2, 16, '#fff');
      }
    });
    // ---- DDR POINTS and the controls along the bottom
    if (!drawPointsPlate()) {
      g.fillStyle = 'rgba(20,40,150,0.9)'; g.fillRect(70, 664, 150, 22);
      text('DDR POINTS', 145, 675, 15, '#fff', 'center');
      text(String(SAVE.points).padStart(7, '0'), 145, 703, 24, '#ffe86a', 'center');
    }
    const help = [[['Enter', 'CONFIRM'], ['Esc', 'BACK'], ['←→', 'MUSIC'], ['↑↓', 'DIFFICULTY']], [['Q', 'FAVORITE'], ['S', 'SEARCH'], ['Tab', 'OPTIONS'], ['F', 'FOLDER']]];
    help.forEach((row, r) => row.forEach(([k, v], i) => {
      const x = 612 + i * 156, y = 676 + r * 26, w = 150;
      g.fillStyle = 'rgba(30,50,110,0.9)'; g.beginPath(); g.roundRect ? g.roundRect(x, y - 11, w, 22, 6) : g.rect(x, y - 11, w, 22); g.fill();
      g.font = 'bold 12px "Segoe UI", Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#ffcf6a'; g.fillText(k, x + 7, y);
      lbl(v, x + w - 8, y, 13, '#fff', 'right', '#000');
    }));
    if (this.note && now - this.noteAt < 2500) text(this.note, 640, 640, 20, '#fff', 'center');
    if (this.typing !== null) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(320, 300, 640, 70); text('SEARCH: ' + this.typing + '_', 640, 335, 26, '#fff', 'center'); }
    if (this.okAt) { g.fillStyle = `rgba(255,255,255,${0.5 * (1 - clamp((now - this.okAt) / 450))})`; g.fillRect(0, 0, W, H); }
  },
  // one of your custom folders: a folder shape with its name and how many songs are in it
  drawFolderTile(x, y, w, h, f) {
    if (f.jk !== undefined) { const e = texture('jacket', f.jk); if (e.img) { g.drawImage(e.img, x, y, w, h); return; } }
    if (f.myChar) {
      g.fillStyle = '#000'; g.fillRect(x, y, w, h);
      g.strokeStyle = '#ff6a10'; g.lineWidth = Math.max(2, w * 0.02); g.strokeRect(x + w * 0.04, y + h * 0.04, w * 0.92, h * 0.92);
      text('MY', x + w / 2, y + h * 0.4, Math.round(w * 0.17), '#fff', 'center');
      text('CHARACTER', x + w / 2, y + h * 0.6, fitSize('CHARACTER', Math.round(w * 0.15), w * 0.86), '#fff', 'center');
      return;
    }
    if (f.disc) {           // another game's disc (Hottest Party): a disc instead of a folder
      const gd = g.createLinearGradient(x, y, x + w, y + h); gd.addColorStop(0, '#ff8a1c'); gd.addColorStop(1, '#c4127a');
      g.fillStyle = gd; g.fillRect(x, y, w, h);
      const cx = x + w / 2, cy = y + h * 0.36, r = h * 0.25;
      const rg = g.createRadialGradient(cx, cy, r * 0.2, cx, cy, r); rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.6, '#dfe8ff'); rg.addColorStop(1, '#9fb4e6');
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = rg; g.fill();
      g.beginPath(); g.arc(cx, cy, r * 0.18, 0, Math.PI * 2); g.fillStyle = '#c4127a'; g.fill();
      const nm = f.folder.toUpperCase();
      text(nm, x + w / 2, y + h * 0.72, fitSize(nm, Math.round(w * 0.13), w * 0.9), '#fff', 'center');
      text(f.count + ' songs', x + w / 2, y + h * 0.88, Math.round(w * 0.085), '#ffe6f2', 'center', 'normal');
      return;
    }
    const gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#1fc27a'); gr.addColorStop(1, '#0a6e48');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    const fw = w * 0.62, fh = h * 0.38, fx = x + (w - fw) / 2, fy = y + h * 0.14;
    g.fillStyle = '#ffd65a'; g.fillRect(fx, fy, fw * 0.4, fh * 0.2); g.fillRect(fx, fy + fh * 0.14, fw, fh * 0.86);
    g.fillStyle = '#ffe89a'; g.fillRect(fx, fy + fh * 0.32, fw, fh * 0.68);
    const nm = f.folder.toUpperCase(), size = Math.max(10, Math.min(w * 0.16, w * 1.5 / Math.max(6, nm.length)));
    const nm2 = nm.length > 20 ? nm.slice(0, 19) + '…' : nm;
    text(nm2, x + w / 2, y + h * 0.7, fitSize(nm2, Math.round(size), w * 0.9), '#fff', 'center');
    text(f.count + (f.count === 1 ? ' song' : ' songs'), x + w / 2, y + h * 0.87, Math.round(w * 0.085), '#d6ffe9', 'center', 'normal');
  },
  drawRandomTile(x, y, w, h, t) {
    if (!hpLike()) { const e = texture('jacket', RANDOM_SONG.jk); if (e.img) { g.drawImage(e.img, x, y, w, h); return; } }
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
      if (bare === true) return;                       // (the caller draws its own labels)
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
// Hottest Party's characters (c_001..c_008 on its disc)
const HP_DANCERS = { '001': 'EMI', '002': 'JENNY', '003': 'AFRO', '004': 'RAGE', '005': 'HISPANIC', '006': 'BLACK F', '007': 'KOREA M', '008': 'JAMAICA', off: 'OFF' };
const yesNo = v => v ? 'ON' : 'OFF';
// The game's OPTIONS (CselOpt*, select_bin group 10): a 3 x 3 grid - INDIVIDUAL OPTIONS (its own grid of
// player options), ASSIST, SAVE / GAME PLAY, DANCE, CREDIT / GRAPHIC, USER SUPPORT, CONFIRM. Every page lists
// a row per player (or its settings), then CONFIRM. Help lines are the game's (text_eng.bin). Settings that
// only the PC version has are under PC SETTINGS, below the game's grid.
const IND_KEYS = ['speed', 'scroll', 'judgePos', 'freezes', 'colors', 'guideline', 'turn', 'jump', 'cut'];
const OPT_IND = [
  { big: 15, name: 'SPEED', help: 'Set the arrow scroll rate.', player: { key: 'speed', values: SPEEDS, fmt: v => 'x' + (v % 1 === 0 ? v.toFixed(1) : v) } },
  { big: 14, name: 'SCROLL', help: 'Sets the arrows\' flow direction.', player: { key: 'scroll', values: ['normal', 'reverse'], fmt: v => v === 'reverse' ? 'REVERSE' : 'NORMAL' } },
  { big: 5, name: 'EVALUATION', help: 'Sets JUDGMENT to appear either above or below the arrows.',
    player: { key: 'judgePos', values: ['normal', 'combo', 'judgment', 'all'], fmt: v => ({ normal: 'NORMAL', combo: 'COMBO', judgment: 'JUDGMENT ONLY', all: 'ALL' })[v] || 'NORMAL',
      helps: { normal: 'Displays JUDGMENT and COMBO above the arrows.', combo: 'Displays COMBO below the arrows.', judgment: 'Displays JUDGMENT below the arrows.', all: 'Displays JUDGMENT and COMBO below the arrows.' } } },
  { big: 6, name: 'FREEZE ARROW', help: 'FREEZE ARROW setting. When turned "OFF", FREEZE ARROWS will appear as normal arrows.', player: { key: 'freezes', values: ON_OFF, fmt: yesNo } },
  { big: 0, name: 'ARROW', help: 'Change color of arrows.', player: { key: 'colors', values: ['rainbow', 'rhythm', 'flat', 'cycle'], fmt: v => ({ rainbow: 'VIVID', rhythm: 'NOTE', flat: 'FLAT', cycle: 'RAINBOW' })[v] || String(v).toUpperCase(),
    helps: { rainbow: 'Default color.', rhythm: 'Arrow color will depend on timing.', flat: 'Arrows will be the same color.', cycle: 'Arrow color will change.' } } },
  { big: 9, name: 'GUIDELINE', help: 'Displays lines indicating 1 measure of music.', player: { key: 'guideline', values: ['beginner', true, false], fmt: v => v === 'beginner' ? 'DEFAULT' : v ? 'ALL' : 'OFF',
    helps: { beginner: 'Show bar lines only for the BEGINNER level.', true: 'Show bar lines for all difficulty levels.', false: 'Hide bar lines for all difficulty levels.' } } },
  { big: 12, name: 'ROTATE', help: 'Change step directions.', player: { key: 'turn', values: ['off', 'mirror', 'left', 'right', 'shuffle'], fmt: v => v === 'off' ? 'NORMAL' : v.toUpperCase(),
    helps: { off: 'Normal arrow directions are used.', mirror: 'Arrow directions are rotated 180 degrees.', left: 'Arrow directions are rotated 90 degrees to the left.', right: 'Arrow directions are rotated 90 degrees to the right.', shuffle: 'Direction of steps is shuffled at random.' } } },
  { big: 11, name: 'JUMP', help: 'Turn JUMP "OFF" and simultaneous step arrows will not be shown.', player: { key: 'jump', values: ON_OFF, fmt: yesNo } },
  { big: 4, name: 'CUT', help: 'When CUT is set to ON, there are no steps for beats less than quarter notes.', player: { key: 'cut', values: OFF_ON, fmt: yesNo } },
  { big: 2, name: 'CONFIRM', confirm: true, help: 'Confirm changes and return to previous screen.' },
];
const OPT_PC = [
  { name: 'APPEARANCE', help: 'HIDDEN: arrows vanish near the top. SUDDEN: they appear late. STEALTH: you can\'t see them. (Not in DDR II.)', player: { key: 'appearance', values: ['visible', 'hidden', 'sudden', 'stealth'] } },
  { name: 'N.G. COMBO', help: 'Whether letting go of a freeze arrow (N.G.) breaks your combo. The real DDR II keeps it (OFF).', player: { key: 'ngBreaksCombo', values: OFF_ON, fmt: yesNo } },
  { name: 'JUDGMENT', help: 'Show the judgment (MARVELOUS, PERFECT...) and combo while you play. (OFF is not in DDR II.)', player: { key: 'evaluation', values: ON_OFF, fmt: yesNo } },
  { name: 'SOUND', help: 'Menu sounds and music.', rows: [
    { name: 'MENU SOUNDS', key: 'menuSounds', values: ON_OFF, fmt: yesNo },
    { name: 'MENU MUSIC', key: 'menuMusic', values: ON_OFF, fmt: yesNo },
  ] },
  { name: 'SCREEN', help: 'Song videos, the screen shape and full screen.', rows: [
    { name: 'VIDEO SIZE', key: 'videoSize', values: ['wii', 'full'], fmt: v => v === 'wii' ? 'WII MONITOR' : 'FULL SCREEN' },
    { name: 'SCREEN', key: 'screen', values: ['wide', '4:3'], fmt: v => v === 'wide' ? '16:9' : '4:3' },
    { name: 'FULL SCREEN', action: 'fullscreen', fmt: () => 'F11' },
    { name: 'FRAME RATE', key: 'fps', values: ['max', '60', '120'], fmt: v => v === 'max' ? 'MONITOR' : v + ' FPS',
      help: 'MONITOR: one frame per screen refresh. 60 FPS: like the Wii. 120 FPS: needs a 120 Hz (or faster) screen. Timing is the same either way.' },
    { name: 'FPS COUNTER', key: 'showFps', values: OFF_ON, fmt: yesNo, help: 'Shows the frames drawn each second in the top right corner (F3 turns it on and off too).' },
    { name: '3D BUFFER', key: 'glFast', values: [false, true], fmt: v => v ? 'FAST' : 'ORIGINAL',
      help: 'FAST: the 3D stage and dancer skip keeping a spare copy of each frame. ORIGINAL: as before. Restart the game (or F5) for it to take effect.' },
  ] },
  { name: 'LIGHTS', help: 'Cabinet lights through an Ultimarc PAC Drive: a panel lights up while you step on it.', rows: [
    { name: 'LIGHTS', key: 'lights', values: ON_OFF, fmt: yesNo },
    { name: 'LIGHT TEST', action: 'lighttest', fmt: () => 'ENTER' },
    { name: 'PAC DRIVE DLL', action: 'pacdll', fmt: () => Options.lightMsg ? (Options.lightOk ? 'FOUND' : 'NOT FOUND') : 'ENTER' },
    { name: 'RESET PINS', action: 'lightreset', fmt: () => 'ENTER' },
  ].concat([1, 2, 3, 4].flatMap(pl => [['L', 'LEFT'], ['D', 'DOWN'], ['U', 'UP'], ['R', 'RIGHT']].map(([d, nm]) =>
    ({ name: 'P' + pl + ' ' + nm, light: 'P' + pl + d })))) },
  { name: 'CUSTOM SONGS', help: 'Make folders and import StepMania songs.', action: () => go(CustomSongs) },
  { name: 'PLAYER DATA', help: 'Pick, make or delete players.', action: () => go(Players.with(Options, Options)) },
  { name: 'CONTROLS', help: 'Set up keys, dance mats and controllers.', action: () => go(Controls) },
  { name: 'DANCE MATS', help: 'Step on each mat so the game knows which mat is which player.', action: () => go(MatCheck.with(Options, false)) },
  { name: 'GAME FOLDER', help: 'Pick your Wii disc, an extracted DDR II folder, or ffmpeg.', action: () => go(Setup.with('')) },
  { big: 2, name: 'CONFIRM', confirm: true, help: 'Confirm changes and return to previous screen.' },
];
const OPT_TOP = [
  { big: 10, name: 'INDIVIDUAL OPTIONS', help: 'Change fine settings such as the arrow speed, color, and other aspects.', sub: OPT_IND, reset: 'ind' },
  { big: 1, name: 'ASSIST', help: 'Set options for the assist feature.', rows: [
    { small: 12, name: 'METRONOME', key: 'metronome', values: OFF_ON, fmt: yesNo, help: 'Set the option to use the metronome while dancing.' },
    { small: 8, name: 'HAND CLAP', key: 'clap', values: OFF_ON, fmt: yesNo, help: 'Set the option to hear applause while dancing.' },
    { small: 21, name: 'SONG', key: 'songOn', values: ON_OFF, fmt: yesNo, help: 'Set whether or not to hear the song while dancing.' },
    { small: 23, name: 'TIMING EVALUATION', key: 'timingColor', values: OFF_ON, fmt: yesNo, help: 'Setting to "ON" will change the steps\' color. Early timing will show up blue and late timing pink.' },
  ] },
  { big: 13, name: 'SAVE', help: 'Set saving options.', rows: [
    { small: 0, name: 'AUTO SAVE', key: 'autoSave', values: ON_OFF, fmt: yesNo, help: 'Set options for autosave.' },
    { small: 20, name: 'SAVE', action: 'save', fmt: () => Options.saveMsg || 'SAVE', help: 'Save game data.' },
  ] },
  { big: 7, name: 'GAME PLAY', help: 'Set game play settings.', rows: [
    { small: 24, name: 'VOICE', key: 'voice', values: [true, false, 'noboo'], fmt: v => v === 'noboo' ? 'NO BOOING' : v ? 'ALL' : 'OFF', help: 'Select settings for In-game voice.',
      helps: { true: 'Use all voices.', false: 'Use no voice.', noboo: 'Remove BOOING during gameplay.' } },
    // the game's own labels (text_eng.bin entry 1), easiest first; its 8 gauge rows run hardest..easiest, so
    // the default row (x1.0, our key 'medium') is MEDIUM HARD and the next easier one is MEDIUM
    { small: 5, name: 'GAME LEVEL', key: 'gameLevel', values: ['easiest', 'very easy', 'easy', 'a little easy', 'medium', 'hard', 'very hard', 'hardest'],
      fmt: v => ({ 'a little easy': 'MEDIUM', medium: 'MEDIUM HARD' })[v] || String(v).toUpperCase(), help: 'The higher the level, the faster the Dance Gauge decreases.' },
    { small: 6, name: 'GAME OVER', key: 'gauge', values: ['normal', 'end', 'no fail'], fmt: v => v === 'normal' ? 'NORMAL' : v === 'end' ? 'END OF SONG' : 'OFF',
      help: 'Sets to keep playing or not when the Dance Gauge becomes 0. (Workout/Training Modes aren\'t affected).',
      helps: { normal: 'Ends game when the Dance Gauge becomes zero.', end: 'Continues game after the Dance Gauge becomes zero.', 'no fail': 'You can\'t fail: the Dance Gauge stops at 1. (Not in DDR II.)' } },
    { name: 'FREEZE GUIDE', key: 'freezeGuide', values: ON_OFF, fmt: yesNo, help: 'The Explanation of Freeze Arrow before your first song with freeze arrows.' },
  ] },
  { big: 17, name: 'DANCE', help: 'Set appearance options.', rows: [
    { small: 29, name: 'DANCER', key: 'dancer', values: ON_OFF, fmt: yesNo, help: 'The dancer on songs without a video.' },
    { small: 13, name: 'MOVIES', key: 'movies', values: ON_OFF, fmt: v => v ? 'NORMAL' : 'OFF', help: 'Sets movies displayed in the game.' },
    { name: 'DDR II STAGE', key: 'ddr2Stage3d', values: [true, false], fmt: v => v ? '3D STAGE' : 'OFF', help: 'DDR II\'s 3D stages behind the dancer.' },
    { name: 'CAMERA WORK', key: 'cameraWork', values: ['default', 'front', 'all'], fmt: v => v === 'front' ? 'FRONT ONLY' : v === 'all' ? 'ALL CAMERAS' : 'DEFAULT',
      helps: { default: 'Automatic camera settings based on mode.', front: 'Only fixed front cameras are used.', all: 'All cameras are used.' } },
    { name: 'COMBO PERFORMANCE', key: 'comboPerf', values: ['50', 'off'], fmt: v => v === 'off' ? 'OFF' : '50',
      helps: { '50': 'Sets the combo performance to 50.', off: 'Setting to "OFF" eliminates the lighting show.' } },
    { name: 'DDR II DANCER', key: 'ddr2Char', values: ['random', 'randomF', 'randomM', '201', '202', '203', '204', '205', '206', '207', '208', '209', 'builtin'], fmt: v => v === 'random' ? 'RANDOM ALL' : v === 'randomF' ? 'RANDOM (GIRLS)' : v === 'randomM' ? 'RANDOM (BOYS)' : v === 'builtin' ? 'BUILT-IN' : (DDR2_CHAR_NAMES[v] || 'DANCER ' + (+v - 200)) + (ddr2CharLockedAt(+v - 1, 0) ? ' (LOCKED)' : ''),
      skip: v => /^\d+$/.test(v) && ddr2CharLockedAt(+v - 1, 0) > 0 },
    { name: 'DANCER LIGHTING', key: 'dancerLight', values: ['pc', 'game'], fmt: v => v === 'game' ? 'GAME STYLE' : 'DDR II PC',
      helps: { pc: 'The built-in dancer keeps DDR II PC\'s own lighting.', game: 'All dancers use stage colour, camera light and the original shading ramp approximation.' } },
    { name: 'DANCER MODEL', action: 'model' },
    { name: 'HOTTEST PARTY DANCER', key: 'hpDancer', values: ['001', '002', '003', '004', '005', '006', '007', '008', 'off'], fmt: v => HP_DANCERS[v] || v },
    { name: 'HOTTEST PARTY STAGE', key: 'hpStage', values: ['random'].concat(Array.from({ length: 41 }, (_, i) => String(i + 1)), [false]), fmt: v => v === 'random' || v === 'song' ? 'RANDOM' : v === false ? 'OFF' : 'STAGE ' + v },
  ] },
  { big: 3, name: 'CREDIT', help: 'View game credits.', action: () => go(Credits) },
  { big: 8, name: 'GRAPHIC', help: 'Change the look of the game screen.', rows: [
    { small: 10, name: 'MARVELOUS', key: 'marvelous', values: ON_OFF, fmt: yesNo, help: 'Enable MARVELOUS judgment ranking.' },
    { small: 22, name: 'TIMING', key: 'offset', step: 5, min: -500, max: 500, fmt: v => (v > 0 ? '+' : '') + v + ' ms', help: 'Modify arrow timing. (Raise it if the arrows feel early.)' },
  ] },
  { big: 16, name: 'USER SUPPORT', help: 'Unlocks your songs and gear from DanceDanceRevolution.', rows: [
    { name: 'SONG UNLOCKS', key: 'unlocks', values: ['off', 'on'], fmt: v => v === 'on' ? 'EARN THEM' : 'ALL OPEN', help: 'ALL OPEN: every song and dancer is open. EARN THEM: unlock them with DDR POINTS, like the game.' },
  ] },
  { big: 2, name: 'CONFIRM', confirm: true, help: 'Confirm changes and return to previous screen.' },
  { name: 'PC SETTINGS', help: 'Settings of this PC version: controls, mats, sound, screen, lights, custom songs and more.', sub: OPT_PC },
];
// every page in the tree (the lights test looks for its page)
const OPT_PAGES = [].concat(OPT_TOP, OPT_IND, OPT_PC);
const Options = {
  bgm: 'MU_BGM_FREE',
  i: 0, page: null, row: 0, items: OPT_TOP, stack: [], ask: null,
  enter() { if (this.keep) { this.keep = false; return; } this.page = null; this.modelMsg = ''; this.items = OPT_TOP; this.stack = []; this.i = 0; this.ask = null; this.saveMsg = ''; },
  // DEFAULT (Tab): the game's two resets - the individual options, or everything else
  resetAsk() {
    const ind = this.items === OPT_IND;
    this.ask = { i: 0, msg: ind ? 'Would you like to reset the individual options to their default settings?'
                               : 'Would you like to reset everything other than the individual options to their default settings?',
      run: () => {
        if (ind) { for (const k of IND_KEYS) S[k] = DEFAULTS[k]; if (P2 && P2.opts) for (const k of IND_KEYS) delete P2.opts[k]; }
        else for (const pg of OPT_TOP) for (const r of pg.rows || []) if (r.key && r.key in DEFAULTS) S[r.key] = DEFAULTS[r.key];
        saveSettings();
        this.note = ind ? 'The individual options have been restored to their default settings.' : 'All options other than the individual options have been restored to their default settings.';
      } };
    sfx('SE_SYS_WINDOWIN');
  },
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
    const pg = this.page;
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
        if (r.key === 'ddr2Char') Promise.resolve().then(() => ddr2Dancer());
        if (r.action) return;
        if (r.step) S[r.key] = Math.max(r.min, Math.min(r.max, (S[r.key] || 0) + d * r.step));
        else {
          const vs = r.values; let j = vs.indexOf(S[r.key]); j = j < 0 ? 0 : j;
          // (values that are locked - r.skip - are stepped over)
          let k = j + d;
          while (k >= 0 && k < vs.length && r.skip && r.skip(vs[k])) k += d;
          if (k >= 0 && k < vs.length) S[r.key] = vs[k];
        }
        if (r.key === 'screen') fit();
        if (r.key === 'menuMusic') { Bgm.cur = undefined; Bgm.want(this.bgm); }
        saveSettings();
      },
      action: r.action === 'fullscreen' ? () => toggleFullscreen() : r.action === 'model' ? () => this.pickModel()
            : r.action === 'lighttest' ? () => this.lightCall({ start: true }, true)
            : r.action === 'pacdll' ? () => this.lightCall({ pick: true })
            : r.action === 'save' ? () => { writeSave(true); this.saveMsg = 'SAVED'; sfx('SE_SYS_DECIDE01'); }
            : r.action === 'lightreset' ? () => { S.lightMap = null; saveSettings(); Lights.last = ''; this.lightMsg = 'Pins back to: P1 L D U R on 1-4, P2 on 5-8, P3 on 9-12, P4 on 13-16.'; } : null }));
  },
  async lightCall(body, test) {
    this.lightMsg = 'Working...';
    try { const r = await api('/api/lights', body); this.lightOk = r.ok; this.lightMsg = r.msg; } catch (e) { this.lightMsg = String(e); }
    if (test) { Lights.last = ''; Lights.test = performance.now(); if (this.lightOk) this.lightMsg += '  Lighting outputs 1 to 16 in turn...'; }
  },
  // CONFIRM / back: out of a sub-grid, or out of the options
  up() {
    sfx('SE_SYS_WINDOWOUT'); saveSettings();
    if (this.stack.length) { const t = this.stack.pop(); this.items = t.items; this.i = t.i; return; }
    go(this.from || Select);
  },
  input(a, p) {
    if (!p) return;
    const dir = /^P[1-4]([LDUR])$/.exec(a);
    const d = dir ? dir[1] : null;
    if (this.ask) {                                          // YES / NO
      if (d === 'U' || d === 'D' || d === 'L' || d === 'R') { this.ask.i = 1 - this.ask.i; sfx('SE_SYS_SELECT01'); }
      else if (a === 'START') { const q = this.ask; this.ask = null; if (q.i === 0) { q.run(); sfx('SE_SYS_DECIDE01'); } else sfx('SE_SYS_WINDOWOUT'); }
      else if (a === 'BACK') { this.ask = null; sfx('SE_SYS_WINDOWOUT'); }
      return;
    }
    if (this.page === null) {                                // the grid of options
      const n = this.items.length, c = this.cols;
      this.note = '';
      if (d === 'L') this.i = (this.i + n - 1) % n;
      else if (d === 'R') this.i = (this.i + 1) % n;
      else if (d === 'U') this.i = this.i - c >= 0 ? this.i - c : this.i + c * Math.floor((n - 1 - this.i) / c);
      else if (d === 'D') this.i = this.i + c < n ? this.i + c : this.i % c;
      else if (a === 'START') {
        const pg = this.items[this.i];
        if (pg.confirm) { this.up(); return; }
        sfx('SE_SYS_DECIDE02');
        if (pg.action) { saveSettings(); this.keep = true; pg.action(); }
        else if (pg.sub) { this.stack.push({ items: this.items, i: this.i }); this.items = pg.sub; this.i = 0; }
        else { this.page = pg; this.row = 0; this.modelMsg = ''; this.saveMsg = ''; }
        return;
      } else if (a === 'BACK') { this.up(); return; }
      else if (a === 'OPTIONS') { if (this.items !== OPT_PC) this.resetAsk(); return; }
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
    const pg = this.page || (this.stack.length ? this.stack[this.stack.length - 1].items[this.stack[this.stack.length - 1].i] : null);
    if (pg) {
      if (O.tab) g.drawImage(O.tab, 470, 14, 330, 48); else { g.fillStyle = '#2a7fd6'; g.fillRect(470, 14, 330, 48); }
      this.label(pg.big !== undefined && O.big ? O.big[pg.big] : null, pg.name, 635, 38, 18);
    }
    if (DATA.current) text('PLAYER: ' + DATA.current + (P2 ? '   2P: ' + (P2.name || 'GUEST') : ''), W - 30, 38, 18, '#0d3770', 'right');
  },
  // the YES / NO window (reset to default)
  drawAsk(t) {
    const q = this.ask;
    g.fillStyle = 'rgba(0,20,60,0.45)'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(20,70,170,0.95)'; g.fillRect(300, 180, 680, 330); g.strokeStyle = '#cfefff'; g.lineWidth = 3; g.strokeRect(300, 180, 680, 330);
    const words = q.msg.split(' '), lines = [''];
    for (const w of words) { if ((lines[lines.length - 1] + ' ' + w).length > 38) lines.push(w); else lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + w; }
    lines.forEach((ln, k) => text(ln, 340, 225 + k * 34, 24, '#fff', 'left'));
    ['YES', 'NO'].forEach((nm, k) => {
      const y = 360 + k * 72, on = q.i === k;
      if (on) { g.fillStyle = '#ff8a1e'; g.fillRect(510 - 6, y - 6, 260 + 12, 56 + 12); }
      g.fillStyle = '#d8f6ff'; g.fillRect(510, y, 260, 56);
      text(nm, 640, y + 28, 28, '#14306e', 'center');
    });
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
      const L = this.items, r0 = Math.max(0, Math.min(Math.ceil(L.length / c) - rowsVis, Math.floor(this.i / c) - 3));
      L.forEach((pg, i) => {
        const r = Math.floor(i / c) - r0;
        if (r < 0 || r >= rowsVis) return;
        // the game's 3 x 3 grid; PC SETTINGS sits a little apart below it
        const x = gx + (i % c) * (bw + 25), y = 92 + r * 70 + (L === OPT_TOP && i >= 9 ? 26 : 0), on = i === this.i;
        const im = on ? O.btnOn : O.btn;
        if (im) g.drawImage(im, x, y, bw, bh); else { g.fillStyle = on ? '#ff8a1e' : '#1e6fe0'; g.fillRect(x, y, bw, bh); }
        if (on) { g.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * Math.sin(t * 7)})`; g.lineWidth = 3; g.strokeRect(x - 2, y - 2, bw + 4, bh + 4); }
        this.label(pg.big !== undefined && O.big ? O.big[pg.big] : null, pg.name, x + bw / 2, y + bh / 2, 20, pg.big !== undefined ? '#14306e' : '#fff');
      });
      this.helpBox(this.note || L[this.i].help);
      if (this.ask) this.drawAsk(t);
      text('Arrows: choose    Enter: open    Tab: default    Esc: back', W / 2, 690, 16, '#0d3770', 'center', 'normal');
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
    const pg = this.page;
    const row = rows[this.row];
    let help = cOn ? 'Confirm changes and return to previous screen.' : pg.help;
    // the game's help for the value now chosen (or the row's own help)
    if (row && !cOn && pg.player) { const h = pg.player.helps && pg.player.helps[String(this.pget(pg.player.key, this.row))]; if (h) help = h; }
    if (row && !cOn && pg.rows && pg.rows[this.row]) { const r = pg.rows[this.row]; help = (r.helps && r.helps[String(S[r.key])]) || r.help || help; }
    if (row && pg.rows && pg.rows[this.row] && pg.rows[this.row].action === 'model') help = this.modelMsg || 'Enter: pick a .glb / .gltf model.  Left/Right: built-in dancer or your model.';
    if (row && pg.rows && pg.rows[this.row] && /lighttest|pacdll/.test(pg.rows[this.row].action || '')) help = this.lightMsg || 'P1 arrows light outputs 1-4 (L D U R), P2 5-8, P3 9-12, P4 13-16. Enter: test / pick the DLL.';
    if (row && pg.rows && pg.rows[this.row] && pg.rows[this.row].light) help = 'Left/Right: pick the PAC Drive pin for this arrow (the chosen pin lights up). OFF: no light. Pins past 16 are on a 2nd board.';
    if (row && pg.rows && pg.rows[this.row] && pg.rows[this.row].action === 'lightreset') help = this.lightMsg || 'Enter: put every arrow back on the standard pins.';
    this.helpBox(help);
    text('Up/Down: choose    Left/Right: change    Enter: confirm    Esc: back', W / 2, 690, 16, '#0d3770', 'center', 'normal');
  },
};

// ---- CREDIT: the game's staff roll (text_eng.bin), scrolling up; Up/Down to scroll by hand, Enter/Esc to leave
const Credits = {
  bgm: 'MU_BGM_FREE',
  lines: null, y: 0, at: 0, hand: 0,
  enter() {
    this.at = performance.now(); this.hand = 0;
    if (!this.lines) api('/api/ddr2credits').then(r => { this.lines = (r && r.lines) || []; }).catch(() => { this.lines = []; });
  },
  input(a, p) {
    if (!p) return;
    if (/^P[1-4]U$/.test(a)) this.hand -= 160;
    else if (/^P[1-4]D$/.test(a)) this.hand += 160;
    else if (a === 'START' || a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(Options); }
  },
  draw(t) {
    menuBackground(t);
    g.fillStyle = 'rgba(0,20,70,0.55)'; g.fillRect(0, 0, W, H);
    const L = this.lines || [];
    if (!L.length) { text(this.lines ? 'No credits found on the disc.' : 'Loading...', W / 2, H / 2, 26, '#fff', 'center'); return; }
    const gap = { head: 44, section: 64, name: 34 };
    let total = 0; for (const [k] of L) total += gap[k];
    const scroll = ((performance.now() - this.at) / 1000 * 60 + this.hand) % (total + H);
    let y = H - scroll;
    for (const [k, s] of L) {
      if (k !== 'name') y += gap[k] - 34;
      if (y > -40 && y < H + 40) {
        for (const [j, ln] of s.split('\n').entries())
          text(ln, W / 2, y + j * 30, k === 'head' ? 20 : k === 'section' ? 24 : 26, k === 'head' ? '#7fe0ff' : k === 'section' ? '#ffd23c' : '#fff', 'center', k === 'name' ? 'bold' : 'bold');
      }
      y += 34 + (s.split('\n').length - 1) * 30;
    }
    keyHints('Up/Down: scroll    Enter / Esc: back');
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
  // page: which of the game's explanation pictures (comAF /5/4: 4 Arrow, 5-10 STEP LESSON 1-6, 11 Freeze Arrow)
  with(next, page = 11) { this.next = next; this.page = page; return this; },
  enter() { this.t0 = performance.now(); sfx('SE_SYS_WINDOWIN'); },
  input(a, p) {
    if (!p) return;
    if (a === 'START') { sfx('SE_SYS_DECIDE01'); go(this.next); }
    // (back out of a lesson's explanation: SELECT LESSON)
    else if (a === 'BACK') { sfx('SE_SYS_WINDOWOUT'); go(this.next && this.next.song && this.next.song.lesson ? LessonSel : this.next); }
  },
  draw(t) {
    // the game's own page: the 640 x 480 picture in the middle of the 854 x 480 screen with its side panels
    // (107 wide each), all at 1.5x; the Let's dance! button (comAF hint 34) at the bottom right - placed
    // from the Wii screenshot (Step Lesson 1)
    const E = A.img.explain, pg = E && E[this.page];
    if (pg) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      if (E[0]) g.drawImage(E[0], 0, 0, 107 * 1.5, 720);
      if (E[1]) g.drawImage(E[1], (107 + 640) * 1.5, 0, 107 * 1.5, 720);
      g.drawImage(pg, 107 * 1.5, 0, 640 * 1.5, 720);
      const h = A.hints && A.hints[34];
      if (h) g.drawImage(h, 1271 - h.width * 1.5, 655 - h.height * 0.75, h.width * 1.5, h.height * 1.5);
      else text("Let's dance!", 1196, 655, 20, '#ffe86a', 'center');
      return;
    }
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
  with(song) { this.song = pickVersion(song); return this; },
  async enter() {
    this.msg = 'Loading...'; this.err = '';
    this.at = performance.now();
    // the short close-in's sound (0x8010502c: sound 602 = SE_SYS_SHUTCLOSE)
    loadRing().then(() => { if (RING.parts && scene === this) sfx('SE_SYS_SHUTCLOSE'); });
    const song = this.song;
    HP_LOOK = song.disc === 'hp' || song.disc === 'hp2' || song.disc === 'hp3';
    try {
      const [chartBuf, audioBuf, dance] = await Promise.all([
        song.custom ? api('/api/custom/chart/' + song.slot) : bin('/api/chart/' + song.slot),
        song.custom ? customAudio(song) : bin('/api/audio/' + song.slot),
        S.dancer && look('dancer') === 'ddr2' && window.Dancer3D ? api('/api/dance/' + danceNo(song)).catch(() => null) : null,
        S.dancer && look('dancer') === 'ddr2' ? ddr2Dancer(song.lesson ? '202' : null).catch(e => console.error('ddr2 dancer', e)) : null]);
      this.dance = dance;
      // a Hottest Party song plays on its own 3D stage from the disc
      this.stage = null;
      // a 3D stage from Hottest Party's disc. Its songs dance their own routine; any other song
      // borrows the routine of the Hottest Party song closest to it in BPM (the moves follow measures)
      // (Hottest Party 3 songs use HP2's stages and dancers for now: same engine, their own aren't read yet)
      // Hottest Party 3 plays the song's music video instead of a 3D stage (as the game does)
      const hp3Video = song.disc === 'hp3' && song.movie && song.movie.sync && S.movies !== false;
      // DDR II's own 3D stages: the stage the game picks for this song (server: Game.stage_for). Songs
      // with a music video keep the video, as on the Wii (their stages are the video-screen ones)
      const ddr2Video = song.movie && song.movie.sync && S.movies !== false;
      if (hp3Video) this.stage = null;
      else if (!song.disc && !song.custom && look('stage') === 'ddr2' && S.ddr2Stage3d !== false && window.HPStage) {
        this.msg = 'Building the stage...';
        try {
          const r = await fetch('/api/ddr2stage/' + song.slot);
          // a song with its own video: on stage 28 (the green circuit world) the video plays on the stage's
          // framed monitor, seen head-on, with no dancer (Dolphin footage); otherwise it plays full screen
          let sd = r.ok ? await r.json() : null;
          const pvStage = sd && [27, 28, 29].includes(sd.id);
          if (sd && ddr2Video && !pvStage) sd = null;
          if (sd) {
            this.stage = HPStage.fromData(sd); this.stage.hp2 = 'ddr2';
            // the video stages (27 moon and snow, 28 circuit world, 29 water cave): a fixed head-on view of
            // the framed monitor at the right, no dancer; it plays the song's video, else the stage movie
            if (pvStage) {
              this.stage.pvCam = { eye: [0, 0, 62], at: [0, 0, -50], roll: 0, fov: 45, near: 1, far: 100000 };
              this.stage.noDancer = true;
              if (ddr2Video) this.stage.setMovie(song.movie.file, { sync: true });
            }
            // backup dancers: only the boss stage has them (Dolphin's file log: normal songs load just
            // your dancer; Unbelievable loads CHR207, CHR208 and CHR209 - yours plus the other two)
            if (Dancer3D.useExtras) {
              let lead = (Dancer3D.customFor || '').match(/ddr2char\/(\d{3})\//);
              const boss = [200, 204, 205].includes(sd.id) && lead;
              // the boss stage always has the same three: CHR208 leads (the first character file the
              // game loads for it, Dolphin's file log; you always play as her), CHR207 and CHR209 behind
              if (boss && lead[1] !== '208') { await Dancer3D.useModel('/api/ddr2char/208/1'); lead = [null, '208']; }
              const trio = ['207', '209'];
              if (boss && sd.introCams && sd.introCams.length) this.stage.bossIntro = true;
              await Dancer3D.useExtras(boss ? trio.map(id => '/api/ddr2char/' + id + '/1') : []);
              // normal songs: the backup silhouettes and their picture, as the stage's record says (0 = none)
              // (lessons: none - the teacher dances alone, as on the Wii)
              if (Dancer3D.useSilhouette) await Dancer3D.useSilhouette(boss || song.lesson ? 0 : sd.silhouette || 0);
            }
            // its screens play one of the stage movies (if it has any)
            if (!(pvStage && ddr2Video) && (sd.models.some(m => (m.materials || []).some(t => t.gx && t.gx.movie)) || (sd.variantKinds || []).includes(1)) && S.movies !== false) {
              try {
                const mv = await (await fetch('/api/ddr2movie/' + song.slot + '?n=' + sd.id)).json();
                if (mv.movie) this.stage.setMovie(mv.movie);
                (mv.movies || []).forEach((f, k) => { if (k && f) this.stage.setMovie(f, {}, k); });
              } catch (e) { /* no movie */ }
            }
          }
        } catch (e) { console.error('ddr2 stage', e); this.stage = null; }
      }
      else if ((song.disc === 'hp2' || song.disc === 'hp3' || (look('dancer') === 'hp2' && !hpAvailable() && hp2Available())) && look('stage') === 'hp' && S.hpStage !== false && window.HPStage) {
        // Hottest Party 2's own stages, camera moves and dancers (HP1's dancers stand in if HP2's won't load)
        this.msg = 'Building the stage...';
        try {
          // Hottest Party 3's songs on one of its own stages (HP2's if those can't be read)
          this.stage = song.disc === 'hp3' ? await HPStage.loadHP2('random', 'hp3') : null;
          if (!this.stage && hp2Available()) this.stage = await HPStage.loadHP2('random');
          const dl = look('dancer');
          if (this.stage && S.hpDancer !== 'off' && (dl === 'hp' || dl === 'hp2')) {
            this.msg = 'Bringing in the dancers...';
            let ok = false;
            try {
              let ds = song.slot;
              if (song.disc !== 'hp2') {            // another game's song: the HP2 routine closest in BPM
                const bpm = (song.bpm && +song.bpm[1]) || 130, h2 = SONGS.filter(s => s.disc === 'hp2');
                h2.sort((a, b) => Math.abs(a.bpm[1] - bpm) - Math.abs(b.bpm[1] - bpm));
                ds = h2.length ? h2[0].slot : ds;
              }
              // Hottest Party 3's songs get its own dancers dancing their own routine
              ok = song.disc === 'hp3' ? await HPStage.addDancersHP2(this.stage, song.slot, 'hp3') || await HPStage.addDancersHP2(this.stage, ds)
                                       : await HPStage.addDancersHP2(this.stage, ds);
            } catch (e) { console.error('hp2 dancers', e); }
            if (!ok && hpAvailable()) {
              const hps = SONGS.filter(s => s.disc === 'hp'), bpm = (song.bpm && +song.bpm[1]) || 130;
              hps.sort((a, b) => Math.abs(a.bpm[1] - bpm) - Math.abs(b.bpm[1] - bpm));
              if (hps.length) await HPStage.addDancers(this.stage, hps[0].slot, S.hpDancer || '001');
            }
          }
        } catch (e) { console.error('hp2 stage', e); this.stage = null; }
      } else
      if (look('stage') === 'hp' && hpAvailable() && S.hpStage !== false && window.HPStage) {
        this.msg = 'Building the stage...';
        let ds = song.slot;
        if (song.disc !== 'hp') {
          const bpm = (song.bpm && +song.bpm[1]) || 130;
          const hps = SONGS.filter(s => s.disc === 'hp');
          hps.sort((a, b) => Math.abs(a.bpm[1] - bpm) - Math.abs(b.bpm[1] - bpm));
          ds = hps.length ? hps[0].slot : song.slot;
        }
        try {
          this.stage = await HPStage.load(ds, S.hpStage);
          if (this.stage && S.hpDancer !== 'off' && look('dancer') === 'hp') { this.msg = 'Bringing in the dancers...'; await HPStage.addDancers(this.stage, ds, S.hpDancer || '001'); }
          else if (this.stage && look('dancer') === 'hp2' && hp2Available()) {
            // Hottest Party 2's dancers on any song: the HP2 routine closest in BPM, kept on this song's beat
            const bpm = (song.bpm && +song.bpm[1]) || 130, h2 = SONGS.filter(s => s.disc === 'hp2');
            h2.sort((a, b) => Math.abs(a.bpm[1] - bpm) - Math.abs(b.bpm[1] - bpm));
            this.msg = 'Bringing in the dancers...';
            if (h2.length) await HPStage.addDancersHP2(this.stage, song.disc === 'hp2' ? song.slot : h2[0].slot);
          }
        } catch (e) { console.error('stage', e); this.stage = null; }
      }
      this.msg = 'Decoding...';
      await new Promise(r => setTimeout(r, 20));
      const ss4 = song.custom ? chartBuf : DDR.parseSS4(chartBuf);      // custom charts come already in the game's shape
      const charts = DEMO.on ? [{ diff: S.diff, o: S, prof: null, name: 'DEMO' }]
        : [{ diff: S.diff, o: S, prof: DATA.profiles[DATA.current] || null, name: DATA.current || 'PLAYER' }];
      if (P2 && !DEMO.on) charts.push({ diff: GROUP ? S.diff : P2.diff, o: p2Opts(), prof: p2Profile(), name: P2.name || 'GUEST' });
      // players 3 and 4 (single style only)
      if (P2 && !DEMO.on && styleNow() !== 'double') PX.forEach(x => { if (x) charts.push({ diff: GROUP ? S.diff : x.diff, o: pOpts(x), prof: x.name ? DATA.profiles[x.name] || null : null, name: x.name || 'GUEST' }); });
      if (BATTLE && !DEMO.on && charts.length === 1)
        charts.push({ diff: S.diff, o: Object.assign({}, S, { gauge: 'no fail' }), prof: null, name: 'COM', com: BATTLE.level });
      for (const c of charts) {
        c.built = DDR.buildNotes(ss4, chartKey(c.diff));
        if (!c.built) throw new Error('This difficulty has no chart.');
      }
      const music = song.custom ? audioBuf : toBuffer(DDR.decodeRWAR(audioBuf));
      if (scene !== this) return;
      const play = Play.with(song, charts, music, this.dance);
      play.stage = this.stage;
      // like the game: before a BEGINNER song with freeze arrows, explain them (once per player per session)
      const who = charts.filter(c => c.diff === 4 && c.built.notes.some(n => n.endT !== undefined) && !Explain.seen.has(c.name || '?'));
      // a step lesson starts with its explanation page (the game's STEP LESSON n picture), every time
      if (song.lesson && song.lesson <= 6) go(Explain.with(play, 4 + song.lesson));
      else if (S.freezeGuide !== false && S.freezes !== false && who.length) { who.forEach(c => Explain.seen.add(c.name || '?')); go(Explain.with(play)); }
      else if (S.mode === 'training' && !COURSE && !WK && !MC) {
        const tm = charts[0].built.timing, last = Math.max(...charts.map(c => Math.max(0, ...c.built.notes.map(n => n.endT || n.t))));
        go(TrainSet.with(play, Math.ceil(tm.offAt(last) / 4096)));
      } else go(play);
    } catch (e) { console.error('load', e && e.stack); this.err = String(e.message || e); }
  },
  input(a, p) { if (p && DEMO.on) return endDemo(); if (p && a === 'BACK') go(this.song && this.song.lesson ? LessonSel : Select); },
  draw(t) {
    // the speaker ring closing in, then held until the song starts: the short close-in (track 0, 16
    // frames, sound 602) - the one CSelect plays when the song is decided (main.dol 0x800457c8 ->
    // 0x801004e0 -> 0x8010502c). The long one (track 2 + sound 609) only closes a song's end (0x800421a0).
    if (RING.parts && !this.err) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      drawRing(0, RING.freeze !== undefined ? RING.freeze : Math.min(ringLen(0) - 1, Math.floor((performance.now() - this.at) / 1000 * 30)));
      return;
    }
    menuBackground(t);
    const jk = texture('jacket', this.song.jacket);
    if (jk.img) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(W / 2 - 152, 138, 304, 304); g.drawImage(jk.img, W / 2 - 150, 140, 300, 300); }
    const ti = texture('title', this.song.title);
    if (ti.img) g.drawImage(ti.img, W / 2 - ti.img.width, 470, ti.img.width * 2, ti.img.height * 2);
    else if (this.song.custom || this.song.disc) text(this.song.name, W / 2, 500, 30, '#fff', 'center');
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
// the combo count's colours by full-combo tier (0 = broken)
const COMBO_TINTS = { 0: '#58e048', 2: '#6a5cff', 3: '#58e048', 4: '#ffcc30', 5: null };
// a picture coloured in (multiplied, so its outline and shading stay), cached per colour
const TINT_CACHE = new Map();
function tintImg(im, col) {
  if (!im) return im;
  let m = TINT_CACHE.get(im);
  if (!m) TINT_CACHE.set(im, m = {});
  if (!m[col]) {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
    m[col] = c;
  }
  return m[col];
}
const J_COLORS = ['#ff4060', '#c77dff', '#4dc3ff', '#4dff7a', '#ffe14d', '#ffffff'];
const WIN_EARLY = [-25, -25, -16, -6, -2], WIN_LATE = [30, 30, 15, 7, 2];
const SEARCH_EARLY = WIN_EARLY[0] / TPS, SEARCH_LATE = WIN_LATE[0] / TPS;
// Hottest Party's rules (its main.dol): windows in frames of 1/60 s from the tables at 0x801ab4a0 (early)
// and 0x801ab4c0 (late), MARVELOUS .. BOO; past +28 frames the step is missed
const HP_WIN_EARLY = [-23, -20, -14, -5, -2, -1], HP_WIN_LATE = [28, 19, 13, 6, 2, 1];   // BOO .. MARVELOUS
function judgeOfHP(dtSec) {
  const d = dtSec * 60;
  for (let j = 5; j >= 0; j--) if (d >= HP_WIN_EARLY[j] && d < HP_WIN_LATE[j]) return j;
  return 0;
}
// Hottest Party's score (0x801599b0): the chart is worth M = table[difficulty*5 + level-1] x 1000
// (0x801f3cac). With T = steps + freezes, each step or freeze judged is the k-th event and is worth
// k x floor(M / (T(T+1)/2)) (the last one takes what's left, so the chart adds up to M exactly), times
// 10 for MARVELOUS / PERFECT / GREAT / freeze O.K. and 5 for GOOD. Capped at 999,999,999
const HP_SCORE_M = [1000, 1200, 1400, 1600, 1800, 2000, 2400, 2800, 3200, 3600, 4000, 4400, 4800, 5200, 5600,
  6000, 6400, 6800, 7200, 7600, 8000, 8500, 9000, 9500, 10000];
function judgeOf(dtSec) {           // dt = press time - step time (seconds); same checks as 0x8002d484
  const d = dtSec * TPS;
  let j = 5;
  for (let k = 4; k >= 0; k--) {
    if (d >= WIN_EARLY[k] && d <= WIN_LATE[k]) return j;
    j--;
  }
  return 0;
}
// Score (0x80037dd4, mode 0): 100000 * sum(weight * count) / (2 * (steps + freezes)), floored, minus the
// number of GREATs and PERFECTs, then x10. (Mode 1, game mode 8: weights 3/2/1 out of 1,000,000, nothing taken off.)
const SCORE_W = [0, 0, 0, 1, 2, 2];       // BOO ALMOST GOOD GREAT PERFECT MARVELOUS
const SCORE_W1 = [0, 0, 0, 1, 2, 3];      // the same in scoring mode 1 (demo play)
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
// GAME LEVEL (0x8026f860, index 0 hardest .. 7 easiest; the game starts on index 3): [gain, loss]
const GAME_LEVELS = { hardest: [0.55, 2.0], 'very hard': [0.7, 1.7], hard: [0.8, 1.3], medium: [1, 1],
  'a little easy': [1.2, 0.8], easy: [1.4, 0.7], 'very easy': [1.7, 0.55], easiest: [2.0, 0.35] };
const DIFF_SLOT = { 4: 0, 1: 1, 2: 2, 3: 3, 6: 4 };   // chart difficulty -> the game's difficulty index
const FREEZE_GRACE = 0.25;      // measured on the Wii (freeze watcher): N.G. comes ~250 ms (15 frames) after letting go

// One dancer: their chart, options, judgments, score and life. Play runs one, or two in VERSUS.
const DIRS = ['L', 'D', 'U', 'R'];
class Dancer {
  constructor(idx, song, built, diff, o, prof, name, lanes) {
    this.idx = idx; this.song = song; this.diff = diff; this.o = o; this.prof = prof; this.name = name;
    this.lanes = lanes; this.style = lanes === 8 ? 'double' : 'single';
    const map = turnMap(lanes, o.turn);
    let notes = built.notes.map(n => ({ off: n.off, t: n.t, lane: map[n.lane], endOff: o.freezes ? n.endOff : undefined,
                                        endT: o.freezes ? n.endT : undefined, done: false, q: quant(n.off), foot: n.foot }));
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
    this.score = 0; this.combo = 0; this.comboBroke = false; this.fcTier = 5; this.maxCombo = 0; this.life = 500; this.missRun = 0; this.failed = false;
    this.den = SCORE_DEN * Math.max(1, this.rows.length + this.freezeTotal);
    // which game's timing and scoring this dancer plays by
    this.hpRules = look('score') === 'hp';
    this.searchEarly = this.hpRules ? HP_WIN_EARLY[0] / 60 : SEARCH_EARLY;
    this.searchLate = this.hpRules ? HP_WIN_LATE[0] / 60 : SEARCH_LATE;
    if (this.hpRules) {
      const lv = Math.max(1, Math.min(10, (levelsOf(song)[DIFFS.findIndex(d => d[0] === diff)] || 1)));
      const di = Math.min(4, this.slot === 4 ? 3 : this.slot);
      this.hpM = HP_SCORE_M[Math.min(24, di * 5 + Math.min(5, lv) - 1 + Math.max(0, lv - 5))] * 1000;
      this.hpT = Math.max(1, this.rows.length + this.freezeTotal);
      this.hpUnit = Math.floor(this.hpM / (this.hpT * (this.hpT + 1) / 2));
      this.hpK = 0;
    }
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
      if (dt < this.searchEarly) break;
      if (dt <= this.searchLate && (!best || Math.abs(dt) < Math.abs(t - best.t))) best = n;
    }
    if (!best) return;
    best.done = true; best.hitT = t;
    const row = best.row;
    row.hit++;
    if (best.endT !== undefined) { best.holding = true; this.holding.push(best); }
    // a jump is judged when its last panel goes down, by that press's timing
    if (row.hit === row.notes.length) { row.dt = t - row.t; this.judgeRow(row, this.hpRules ? judgeOfHP(t - row.t) : judgeOf(t - row.t)); }
  }
  judgeRow(row, j) {
    row.judged = true;
    if (this.group && !this.groupApply) { this.group.report(this, row, j); return; }   // FRIENDSHIP / SYNC
    if (j === 5 && !this.o.marvelous) j = 4;            // Marvelous option off: counts as Perfect
    this.jc[j]++; this.counts[J_NAMES[j]]++;
    // combo continues on GOOD or better; BOO/ALMOST break it and count toward the loss streak
    // the full-combo tier so far (5 MARVELOUS, 4 PERFECT, 3 GREAT, 2 GOOD); a break ends any full combo
    if (j < 2) this.comboBroke = true; else this.fcTier = Math.min(this.fcTier ?? 5, j);
    if (j >= 2) { this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); this.missRun = 0; }
    else { this.combo = 0; this.comboBroke = true; this.missRun++; if (this.mcRun && !this.failed) { this.failed = true; this.failAt = this.now(); } }   // MAX COMBO CHALLENGE: a break ends the run
    if (this.hpRules) this.hpEvent(j >= 3 ? 10 : j === 2 ? 5 : 0); else this.updateScore();
    if (j >= 3 || j === 0) this.lifeChange(j >= 4 ? 0 : j === 3 ? 1 : 3);
    this.judgeText = { name: J_NAMES[j], color: J_COLORS[j], at: this.now() };
    // TIMING EVALUATION: the step flashes blue when early, pink when late
    const tc = S.timingColor && row.dt !== undefined && j < 5 ? (row.dt < 0 ? '#3c8cff' : '#ff5cc0') : null;
    if (j >= 2 && S.clap && A.ready) A.playSfx('SE_DDR_CLAP');           // HAND CLAP: a clap on every step hit (0x80026b10)
    if (j >= 2) for (const n of row.notes) this.bursts.push({ lane: n.lane, at: this.now(), color: tc || J_COLORS[j] });
    if (this.combo > 0 && this.combo % 100 === 0) {
      const c = Math.min(this.combo, 1000);
      sfx(this.combo > 1000 ? 'VO_NAR_COMBOOVER' : `VO_NAR_${c}COMBO`);
    }
  }
  fullCombo() {   // 0 none, 2 good, 3 great, 4 perfect, 5 marvelous (combo kept through every step, no N.G.)
    if (this.jc[0] || this.jc[1] || this.counts.NG || this.failed) return 0;
    return this.jc[2] ? 2 : this.jc[3] ? 3 : this.jc[4] ? 4 : 5;
  }
  // Hottest Party: the next step or freeze is judged; w = 10, 5 or 0
  hpEvent(w) {
    this.hpK = Math.min(this.hpT, this.hpK + 1);
    const k = this.hpK, T = this.hpT;
    const v = k === T ? this.hpM - (T * (T - 1) / 2) * this.hpUnit : k * this.hpUnit;
    if (w) this.score = Math.min(999999999, this.score + w * v);
  }
  updateScore() {
    if (this.hpRules) return;
    if (DEMO.on) {                // game mode 8 (0x8026f718 row 1): MARVELOUS 3, PERFECT 2, GREAT 1, freeze 3, of 1,000,000
      let n1 = 3 * this.counts.OK;
      for (let k = 0; k < 6; k++) n1 += SCORE_W1[k] * this.jc[k];
      this.score = Math.floor(1000000 * n1 / (3 * Math.max(1, this.rows.length + this.freezeTotal)));
      return;
    }
    let num = SCORE_FREEZE_OK * this.counts.OK;
    for (let k = 0; k < 6; k++) num += SCORE_W[k] * this.jc[k];
    // then (0x80037ec0, mode 0) one unit off for every GREAT and every PERFECT (counters 3 and 4),
    // not below 0, then x10: only MARVELOUS keeps a step's full value
    this.score = Math.max(0, Math.floor(100000 * num / this.den) - this.jc[3] - this.jc[4]) * 10;
  }
  lifeChange(col) {
    let d = LIFE_DELTA[this.slot][col];
    // GAME LEVEL: the game's 8 levels (0x8026f860, picked by the setting at +5500, default 3 = x1.0): each is
    // [gain multiplier, loss multiplier] applied to every gauge change (0x80038194)
    const lv = GAME_LEVELS[S.gameLevel] || [1, 1];
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
      // END OF SONG: still failed, but the song plays on to the end (the gauge stays empty)
      if (this.o.gauge === 'end' && !this.failed) { this.failed = true; this.failAt = Infinity; }
    }
    if (this.life > 1000) this.life = 1000;
    if (this.o.gauge !== 'normal' && this.o.gauge !== 'end' && this.life < 1) this.life = 1;
    // the crowd (0x800381fc): after every gauge change, a good sign when the gauge is over 700 or the
    // combo over 12, a bad one when the gauge is under 200 (Play.crowd reacts to them)
    this.crowdEv |= this.life > 700 || this.combo > 12 ? 1 : this.life < 200 ? 2 : 0;
  }
  freezeNG(n, t, silent) {
    n.holding = false; n.freezeNG = true; this.counts.NG++; if (this.hpRules) this.hpEvent(0);
    this.lifeChange(3);
    // the real DDR II keeps the combo through a freeze N.G. (tested on the Wii game); Options can make it break
    if (this.o.ngBreaksCombo) { this.combo = 0; this.comboBroke = true; if (this.mcRun && !this.failed) { this.failed = true; this.failAt = this.now(); } }
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
      if (row.t > t - this.searchLate) break;
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
        n.holding = false; n.freezeOK = true; this.counts.OK++; if (this.hpRules) this.hpEvent(10); else this.updateScore(); this.lifeChange(0);
        this.okText = { name: 'OK', lane: n.lane, at: t };
        this.bursts.push({ lane: n.lane, at: t, color: '#ffe84a' });     // the head flashes as it goes, like the game
      }
    }
    this.holding = this.holding.filter(n => n.holding);
  }
  // lanes, arrows, flashes, judgment and combo. x0 = left edge of the lanes
  draw(t, x0, lw, ry, held, ended) {
    const lanes = this.lanes, size = lw - 6, o = this.o;
    // SCROLL REVERSE: the step zone at the bottom and the arrows coming down. Everything is worked out
    // as if it scrolled up, then put on screen by Y() (a mirror about the step zone)
    const rev = o.scroll === 'reverse', yr = rev ? H - 150 : ry;
    const Y = y => rev ? yr - (y - ry) : y;
    const flipOn = () => { if (rev) { g.save(); g.translate(0, yr + ry); g.scale(1, -1); } };
    const flipOff = () => { if (rev) g.restore(); };
    // Hottest Party's arrows / judgments (each can be picked on its own in DDR CUSTOM)
    const HP = Play.hpArrows || Play.hpJudge ? hpHud() : null, hpOk = HP && HP.ok ? HP : null;
    const hp = Play.hpArrows ? hpOk : null;
    const hj = Play.hpJudge ? (Play.hp2Screen && HP2_HUD && HP2_HUD.ok ? HP2_HUD : hpOk) : null;
    if (!Play.hpBoard && !Play.introOn) {
      // the lane area: translucent blue with white lane lines, like the game
      g.fillStyle = 'rgba(16,52,170,0.55)'; g.fillRect(x0 - 4, 0, lanes * lw + 8, H);
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillRect(x0 - 6, 0, 3, H); g.fillRect(x0 + lanes * lw + 3, 0, 3, H);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let l = 1; l < lanes; l++) g.fillRect(x0 + l * lw - 1, 0, 2, H);
    }
    const offNow = this.timing.offAt(t);
    const beat = (((offNow % 1024) + 1024) % 1024) / 1024;
    const aframe = Math.min(6, Math.floor(beat * 7));
    const beatPx = lw * o.speed;
    const yOf = off => ry + (off - offNow) / 1024 * beatPx;
    const dirOf = l => l % 4;
    // GUIDELINE: a line across the lanes at every measure
    if (o.guideline === true || (o.guideline === 'beginner' && this.diff === 4)) {
      g.fillStyle = 'rgba(255,255,255,0.45)';
      for (let m = Math.floor(offNow / 4096) * 4096; ; m += 4096) {
        const y = yOf(m);
        if (y > H) break;
        if (y > ry) g.fillRect(x0 - 4, Y(y) - 1, lanes * lw + 8, 2);
      }
    }
    // step zone
    for (let l = 0; l < lanes; l++) {
      const x = x0 + l * lw + lw / 2, d = dirOf(l);
      const down = t - this.flash[l] < 0.08 || held(l);
      const grey = (A.zoneC8 && A.zoneC8(d, false)) || (A.receptor ? A.receptor(d) : A.arrowGrey && A.arrowGrey[0][d]);
      if (hp) {
        const sc = down ? 0.9 : 1, z = size * 1.08 * sc;
        // the dark grey set, turning to the light grey one when pressed and fading back through each beat
        g.drawImage(hp.zone[d], x - z / 2, yr - z / 2, z, z);
        g.globalAlpha = down ? 1 : Math.max(0, 1 - beat * 2.5);
        g.drawImage(hp.zoneOn[d], x - z / 2, yr - z / 2, z, z);
        g.globalAlpha = 1;
      } else if (grey) {
        const sc = down ? 0.9 : 1;
        g.globalAlpha = 1; g.drawImage(grey, x - size * sc / 2, yr - size * sc / 2, size * sc, size * sc);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = down ? 0.55 : 0.35 * (1 - beat);
        g.drawImage(A.arrowMask[d], x - size * sc / 2, yr - size * sc / 2, size * sc, size * sc);
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      } else drawArrow(down ? 'flash' : 'receptor', x, yr, d, size);
    }
    // judgment: about a second on screen, then a quick fade; the combo count stays up for as long as the
    // combo lasts. EVALUATION (the game's option) is draw order: NORMAL draws both over the arrows (seen in
    // the real game: the combo covers arrows passing through it); COMBO puts the combo under the arrows,
    // JUDGMENT ONLY the judgment, ALL both. They stay in the same place either way.
    const jAge = this.judgeText ? t - this.judgeText.at : 9;
    const evalOn = !ended && o.evaluation !== false, jp = o.judgePos || 'normal';
    const cx = x0 + lanes * lw / 2, cy = rev ? Y(Play.hpBoard ? 362 : 352) - 70 : Play.hpBoard ? 362 : 352;
    const drawJudge = (cy) => {
      if (jAge < 1.0) {
        const k = Math.min(1, jAge * 14), fa = jAge > 0.85 ? (1 - jAge) / 0.15 : 1;
        const im = hj ? hj.judge[this.judgeText.name] : A.judge && A.judge[this.judgeText.name];
        const sc = (lanes === 8 ? 0.95 : 0.8) * (1.15 - 0.15 * k);
        g.globalAlpha = fa;
        if (!blit(im, cx, cy, sc, fa)) text(this.judgeText.name, cx, cy, 46, this.judgeText.color, 'center');
        g.globalAlpha = 1;
      }
    };
    const drawCombo = (cy) => {
      if (this.combo >= 4 && hj) {
        const hp = hj, str = String(this.combo), dh = 44, dw = dh * 0.78, cw = hp.judge.COMBO.width * dh / 56, tot = str.length * dw + 8 + cw;
        let xx = cx - tot / 2;
        for (const ch of str) { g.drawImage(hp.digits[+ch], xx - dw * 0.14, cy + 102 - dh / 2, dh, dh); xx += dw; }
        g.drawImage(hp.judge.COMBO, xx + 8, cy + 102 - dh / 2, cw, dh);
      } else if (this.combo >= 4) {
        // measured from two real-game shots: the word "combo" starts 13.5% of the lanes' width left of their
        // centre, the count ends 21% left of it; ~97 px under the judgment
        const L = lanes * lw * (lanes === 8 ? 0.5 : 1), cw = A.judge && A.judge.COMBO, wh = 40, ww = cw ? cw.width * wh / cw.height : 0;
        const wx = cx - 0.135 * L + ww / 2, y2 = cy + 97;
        // its colour is the full combo you're on track for, like the FULL COMBO banners: only MARVELOUS =
        // white-blue (the picture's own), PERFECT = gold, GREAT = green, GOOD = blue-purple; once the
        // combo has been broken (or a freeze N.G.) no full combo is possible: green
        const tier = this.comboBroke || this.counts.NG ? 0 : this.fcTier ?? 5;
        const col = COMBO_TINTS[tier];
        const set = col ? A.comboDigits.map(im => tintImg(im, col)) : A.comboDigits, cwi = cw && col ? tintImg(cw, col) : cw;
        const ok = cw && digits(set, String(this.combo), cx - 0.21 * L + 8, y2, 46, 'right', -0.32);
        if (ok) g.drawImage(cwi, wx - ww / 2, y2 - wh / 2, ww, wh);
        else text(this.combo + ' COMBO', cx, y2, 30, '#fff', 'center');
      }
    };
    const under = { normal: [], combo: ['c'], judgment: ['j'], all: ['j', 'c'] }[jp] || [];
    if (evalOn) { if (under.includes('j')) drawJudge(cy); if (under.includes('c')) drawCombo(cy); }
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
      if (hp && n.endT !== undefined) {
        // Hottest Party's freeze arrow: the body tiled from the head down, its tail at the end
        const sc = size / 64, top = y, tailTop = Math.max(top, yEnd - 32 * sc);
        if (n.freezeNG || n.missed) g.globalAlpha = alpha * 0.45;
        flipOn();
        g.save(); g.beginPath(); g.rect(x - size / 2 - 1, top, size + 2, Math.max(0, tailTop - top)); g.clip();
        for (let yy = tailTop; yy > top - 256 * sc; yy -= 256 * sc) g.drawImage(hp.frzBody[d], x - size / 2, yy - 256 * sc, size, 256 * sc);
        g.restore();
        if (yEnd > y) g.drawImage(hp.frzTail[d], x - size / 2, tailTop - 32 * sc, size, 64 * sc);
        flipOff();
        const hz = size * 1.0, yh = Y(y);
        g.drawImage(hp.frzHead[d], x - hz / 2, yh - hz / 2, hz, hz);
        if (n.holding) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.35 + 0.2 * Math.sin(t * 40); g.drawImage(hp.frzHead[d], x - hz / 2, yh - hz / 2, hz, hz); g.globalCompositeOperation = 'source-over'; }
        g.globalAlpha = 1;
        continue;
      }
      if (hp) {
        // the arrow's colour by its timing: beat, 8th, 16th, other - each set has two frames that swap every half beat
        const set = o.colors === 'flat' || o.colors === 'cycle' ? 0 : n.q === 4 ? 0 : n.q === 8 ? 1 : n.q === 16 ? 2 : 3;
        const sp = hpNotes(hp, (((offNow / 4096) % 1) + 1) % 1, beat)[set][d], z = size * 1.04;
        g.drawImage(sp, x - z / 2, Y(y) - z / 2, z, z);
        g.globalAlpha = 1;
        continue;
      }
      if (n.endT !== undefined && yEnd > y) {
        const fz = (n.freezeNG || n.missed) ? A.freezeOff : A.freezeOn;
        flipOn();
        if (fz && fz[d] && fz[d].body) this.drawFreeze(fz[d], x, y, yEnd, size, n.holding);
        else {
          g.fillStyle = n.holding ? 'rgba(120,255,140,0.95)' : 'rgba(60,200,90,0.8)';
          g.fillRect(x - size * 0.32, y, size * 0.64, yEnd - y);
        }
        flipOff();
      }
      if (n.endT !== undefined && A.freezeOn && A.freezeOn[d]) {
        const fz = (n.freezeNG || n.missed) ? A.freezeOff : A.freezeOn;
        g.drawImage(n.holding && fz[d].headH ? fz[d].headH : fz[d].head, x - size / 2, Y(y) - size / 2, size, size);
      } else {
        // the game's palettes: the four note colours by timing (beat, 8th, 16th, other). On RAINBOW
        // (the game's default) every colour goes once round the colour wheel each measure, the hue
        // falling (cyan, green, yellow, orange, red, pink, violet...) - measured from the real game
        const group = n.q === 4 ? 0 : n.q === 8 ? 1 : n.q === 16 ? 2 : 3;
        let sp = null;
        if (A.c8) {
          // RAINBOW ("arrow color will change"): every arrow one colour, going round the wheel twice a
          // measure - how the game does it isn't read yet **(check)**
          const shift = o.colors === 'rainbow' ? -360 * ((((offNow / 4096) % 1) + 1) % 1) : o.colors === 'cycle' ? -360 * ((((offNow / 2048) % 1) + 1) % 1) : 0;
          // (a lesson's arrows are coloured by foot: left blue, right red - the game's explanation text)
          sp = n.foot ? A.noteC8(n.foot === 1 ? 3 : 1, 0, aframe, d, beat < 0.2)      // (ramps 3 blue, 1 red)
            : A.noteC8(o.colors === 'flat' || o.colors === 'cycle' ? 0 : group, shift, aframe, d, beat < 0.2);   // (measured: white for ~1/5 of each beat)
        } else {
          let top, bot;
          if (n.foot) { const c = A.hex(n.foot === 1 ? TINT[8] : TINT[4]); top = c; bot = c.map(v => v * 0.7); }
          else if (o.colors === 'flat' || o.colors === 'rhythm') { const c = A.hex(o.colors === 'flat' ? TINT.flat : TINT[n.q] || TINT[0]); top = c; bot = c.map(v => v * 0.7); }
          else { const base = n.q === 4 ? 28 : n.q === 8 ? 222 : 288; const hue = Math.round((base + Math.max(0, (n.off - offNow) / 1024) * 55) / 10) * 10 % 360; top = A.hsl(hue, 1, 0.55); bot = A.hsl(hue + 50, 1, 0.5); }
          sp = A.arrowCol ? A.arrowCol(top, bot, aframe, d) : null;
        }
        if (sp) g.drawImage(sp, x - size / 2, Y(y) - size / 2, size, size);
        else drawArrow(o.colors === 'flat' ? 4 : n.q, x, Y(y), d, size);
      }
      g.globalAlpha = 1;
    }
    // hit flashes
    this.bursts = this.bursts.filter(b => t - b.at < 0.2);
    if (hp) {                                    // Hottest Party: the arrow's white shape flashes and grows
      g.globalCompositeOperation = 'lighter';
      for (const b of this.bursts) {
        const k = (t - b.at) / 0.2, x = x0 + b.lane * lw + lw / 2, sc = size * (1.05 + 0.35 * k);
        g.globalAlpha = 0.45 * (1 - k);
        g.drawImage(hp.zoneLit[dirOf(b.lane)], x - sc / 2, yr - sc / 2, sc, sc);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    } else if (A.burst) {
      g.globalCompositeOperation = 'lighter';
      for (const b of this.bursts) {
        const k = (t - b.at) / 0.2, x = x0 + b.lane * lw + lw / 2, sc = size * (1.1 + 0.5 * k);
        g.globalAlpha = 0.8 * (1 - k);
        g.drawImage(A.burstTint(b.color, dirOf(b.lane)), x - sc / 2, yr - sc / 2, sc, sc);
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    for (const n of this.holding) if (n.holding && A.burst && !hp) {
      const x = x0 + n.lane * lw + lw / 2;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 40);
      g.drawImage(A.arrowMask[dirOf(n.lane)], x - size / 2, yr - size / 2, size, size);
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    if (evalOn) { if (!under.includes('j')) drawJudge(cy); if (!under.includes('c')) drawCombo(cy); }
    // OK / NG under a freeze arrow
    if (this.okText && t - this.okText.at < 0.5) {
      const im = hj ? hj.judge[this.okText.name] : A.judge && A.judge[this.okText.name];
      const x = x0 + this.okText.lane * lw + lw / 2;
      if (!blit(im, x, rev ? yr - lw * 0.95 : ry + lw * 0.95, lanes === 8 ? 0.5 : 0.6))
        text(this.okText.name, x, rev ? yr - lw * 0.9 : ry + lw * 0.9, 26, this.okText.name === 'OK' ? '#ffe14d' : '#ff4060', 'center');
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
  // 3 / 4 players: the game's panel, badge, difficulty, gauge and score at the places in METER_MULTI_US.bin
  drawHudMulti(n, L, t) {
    const M = A.multi[n], i = this.idx, life = this.life / 1000;
    const di = DIFFS.findIndex(d => d[0] === this.diff);
    const ax = L.bars[i].x;
    mspr(M.panels[i], L.bars[i], ax);
    mspr(M.gauges[i], L.gauges[i], ax);
    mspr(M.diffs[di], L.diffs[i], ax);
    // the gauge's pills (gauge01, 8 x 14, one part per pill, left to right) lit like the 1-player gauge
    const cs = L.cells[i], N = cs.length, units = life * N, full = life >= 1, lit = Math.max(1, Math.ceil(units));
    const mph = (((this.timing.offAt(t) / 4096) % 1) + 1) % 1;
    cs.forEach((c, k) => {
      const part = Math.max(0, Math.min(1, units - k));
      if (part <= 0) return;
      let col;
      if (full) col = `hsl(${((k * 17 - t * 260) % 360 + 360) % 360},95%,55%)`;
      else {
        const fromTip = (lit - 1 - k) / Math.max(1, lit);
        const cyan = mph < 0.15 ? fromTip < mph / 0.15 : mph < 0.62 ? true : mph < 0.95 ? (mph - 0.62) / 0.33 - fromTip < 0 : false;
        col = cyan ? 'rgb(34,186,232)' : 'rgb(48,214,122)';
      }
      const x = MX(c.x, ax) + (4 - c.px) * c.sx * 1.5, y = MY(c.y) + (7 - c.py) * c.sy * 1.5;
      const rx = 3.1 * c.sx * 1.5, ry = 5.2 * c.sy * 1.5;
      g.save(); g.beginPath(); g.rect(x - rx - 1, y + ry - 2 * ry * part, 2 * rx + 2, 2 * ry * part + 1); g.clip();
      g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.restore();
    });
    if (life < 0.3 && life > 0 && (t * 3 | 0) % 2 === 0) mspr(M.danger, L.danger[i], ax);
    mspr(M.badges[i], L.badges[i], ax);
    // the score (Num_00, 28 x 28 digits at the part's scale): measured on the 3- and 4-player screenshots,
    // the last digit's middle is on the part's place, the digits 0.66 digit-widths apart
    const nm = L.nums[i];
    if (nm) {
      const dw = 28 * nm.sx * 1.5, h = 28 * nm.sy * 1.5, adv = dw * 0.66, right = MX(nm.x, ax) + adv / 2, y = MY(nm.y);
      const str = String(this.score).padStart(Play.scoreDigits || 7, '0'), set = A.numbers && A.numbers.white;
      [...str].forEach((ch, k) => {
        const im = set && set[+ch], cx = right - adv * (str.length - k - 0.5);
        if (im) { const w = im.width * h / im.height; g.drawImage(im, cx - w / 2, y - h / 2, w, h); }
        else text(ch, cx, y, h, '#fff', 'center');
      });
    }
  }
  // the life gauge panel above the lanes
  drawHud(x0, width, t, badge, two) {
    if (Play.hpHud && Play.hp2Screen && HP2_HUD) return this.drawHudHP2(HP2_HUD, x0, width, t, badge, two);
    const HP = Play.hpHud ? hpHud() : null;
    if (HP && HP.ok) return this.drawHudHP(HP, x0, width, t, badge, two);
    const life = this.life / 1000;
    const di = DIFFS.findIndex(d => d[0] === this.diff);
    const px = x0 + width / 2 - 183, py = 30, pw = 366, ph = 112;
    // each player's own colour (Wii 4-player screen: 1 blue, 2 red, 3 green, 4 yellow). Players 1 / 2 use
    // the file's blue / red panels; for 3 / 4 the file's green / yellow panels are a different (pill)
    // shape, so the grey panel is tinted green / yellow here (APPROXIMATION, matched to the screenshot)
    const pan = (A.img.meterPanels && this.idx < 2 && A.img.meterPanels[this.idx]) || (this.idx >= 2 ? tintedPanel(this.idx) : null) || A.img.meterPanel;
    if (pan) g.drawImage(pan, px, py, pw, ph);
    else { g.fillStyle = 'rgba(60,140,230,0.9)'; g.fillRect(px, py, pw, ph); }
    const pb = (A.img.meterBadges && A.img.meterBadges[this.idx]) || (this.idx === 1 ? A.img.meterBadge2 : this.idx === 0 ? A.img.meterBadge : null);   // the game's 1-4 badges
    if (!blit(pb, px + 14, py + 50, 1.15) && this.idx >= 1) { g.fillStyle = ['', '#e8508c', '#3cc060', '#f0a020'][this.idx]; g.beginPath(); g.arc(px + 14, py + 50, 20, 0, Math.PI * 2); g.fill(); text(String(this.idx + 1), px + 14, py + 51, 22, '#fff', 'center'); }
    const dl = A.img.meterDiff && A.img.meterDiff[di];
    if (!blit(dl, px + pw / 2 + 26, py + 22, 1.15)) text(DIFFS[di][1], px + pw / 2 + 26, py + 22, 18, DIFFS[di][2], 'center');
    // LED gauge, like the game's (measured from the real game): once a measure the lit pills turn
    // from green to cyan in a quick sweep from the tip leftwards, stay cyan, then turn back to green
    // in a slower, sparkly sweep, again from the tip. The last pill fills from the bottom, and a
    // full gauge cycles through the rainbow.
    const gx = px + 78, gy = py + 38, gs = 1.5, fr = (A.img.meterGauges && A.img.meterGauges[this.idx]) || A.img.meterGauge;
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
    const sd = Play.scoreDigits || 7, sz = sd > 7 ? 24 : 30;
    if (!digits(A.numbers && A.numbers.white, String(this.score).padStart(sd, '0'), sx, sy, sz, 'right', -0.3))
      text(String(this.score).padStart(sd, '0'), sx, sy, 26, '#fff', 'right');
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

// Hottest Party's gauge and score panel: the gauge top left (player ball, PLAYER n, STYLE badge beside
// it), the score bottom left in an orange panel with the difficulty on a tab above
Dancer.prototype.drawHudHP = function (hp, x0, width, t, badge, two) {
  const life = this.life / 1000, di = DIFFS.findIndex(d => d[0] === this.diff), pi = this.idx || 0;
  const right = two && pi === 1;
  const im = (img, x, y, w, h) => { if (img && img.naturalWidth) { g.drawImage(img, x, y, w, h); return true; } return false; };
  const k = 1.5, gx = right ? x0 + width - 232 * k + 20 : x0 - 30, gy = 38;
  // the gauge: its frame, the bar inside it (the lit part), the player's ball in the ring
  // (the game draws this frame upside down: the wide dark slot on top for the bar, the PLAYER tab under it)
  if (hp.gauge && hp.gauge.naturalWidth) { g.save(); g.translate(gx, gy + 58 * k); g.scale(1, -1); g.drawImage(hp.gauge, 0, 0, 232 * k, 58 * k); g.restore(); }
  const bx = gx + 46 * k, by = gy + 10 * k, bw = 168 * k, bh = 19 * k;
  g.fillStyle = 'rgba(40,10,0,0.85)'; g.fillRect(bx, by, bw, bh);
  const full = life >= 1;
  g.save(); g.beginPath(); g.rect(bx, by, bw * life, bh); g.clip();
  const grd = g.createLinearGradient(bx, by, bx, by + bh);
  grd.addColorStop(0, full ? `hsl(${(t * 300) % 360},100%,70%)` : '#7ff3ff'); grd.addColorStop(1, full ? `hsl(${(t * 300 + 60) % 360},100%,45%)` : '#1aa0d8');
  g.globalAlpha = 0.85; g.fillStyle = grd; g.fillRect(bx, by, bw, bh); g.globalAlpha = 1;
  // stripes, like the game's bar
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let sx = bx + ((t * 60) % 12); sx < bx + bw * life; sx += 12) g.fillRect(sx, by, 5, bh);
  g.restore();
  im(hp.ball[pi], gx + 8 * k, gy + 14 * k, 28 * k, 28 * k);
  im(hp.p[pi], gx + 34 * k, gy + 38 * k, 102 * 1.15, 18 * 1.15);
  if (badge) {
    im(hp.style, gx + 226 * k, gy - 2, 156 * 1.45, 44 * 1.45);
    im(hp.single, gx + 226 * k + 78 * 1.45 - 70 * 0.85, gy + 34, 140 * 0.85, 32 * 0.85);
  }
  if (life < 0.3 && life > 0 && (t * 3 | 0) % 2 === 0) im(hp.danger, gx + 120, gy + 95, 74 * 1.6, 12 * 1.6);
  // the score panel
  const sk = 2.25, sx = right ? x0 + width - 150 * sk + 10 : x0 - 30, sy = 600;
  const tab = hp.diff[[4, 1, 2, 3].indexOf(this.diff)];
  g.fillStyle = '#ff5a14'; g.beginPath(); g.roundRect ? g.roundRect(sx + 60, sy - 22, 150, 30, 10) : g.rect(sx + 60, sy - 22, 150, 30); g.fill();
  g.fillStyle = '#2a0a00'; g.beginPath(); g.roundRect ? g.roundRect(sx + 64, sy - 19, 142, 24, 8) : g.rect(sx + 64, sy - 19, 142, 24); g.fill();
  if (!im(tab, sx + 74, sy - 18, 94 * 1.3, 16 * 1.3)) text(DIFFS[di][1], sx + 135, sy - 7, 16, DIFFS[di][2], 'center');
  im(hp.scoreBox, sx, sy, 150 * sk, 38 * sk);
  g.fillStyle = 'rgba(30,8,0,0.92)'; g.beginPath(); g.roundRect ? g.roundRect(sx + 84, sy + 16, 150 * sk - 104, 38 * sk - 32, 10) : g.rect(sx + 84, sy + 16, 150 * sk - 104, 38 * sk - 32); g.fill();
  g.font = 'italic 900 31px "Arial Black", "Segoe UI", Arial, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.fillText(String(this.score).padStart(Play.scoreDigits || 9, '0'), sx + 150 * sk - 28, sy + 38 * sk / 2 + 1);
  if (two && this.name) text(this.name, sx + 150 * sk / 2, sy + 38 * sk + 14, 16, '#fff', 'center');
};

// Hottest Party 2's gold screen: the gauge top left with the player's ball in its ring, the STYLE badge
// at the top in the middle, the score panel bottom left with the difficulty on its tab
Dancer.prototype.drawHudHP2 = function (h2, x0, width, t, badge, two) {
  const life = this.life / 1000, pi = this.idx || 0, right = two && pi === 1;
  const im = (img, x, y, w, h) => { if (img && img.naturalWidth) { g.drawImage(img, x, y, w, h); return true; } return false; };
  const k = 1.35, gw = 246 * k, gh = 46 * k, gx = right ? W - gw - 60 : 64, gy = 30;
  // the bar first (inside the frame's slot), then the frame over it
  // the frame (its slot shows the empty gauge), then the lit part of the bar over the slot
  im(h2.gauge, gx, gy, gw, gh);
  const bx = gx + 40 * k, by = gy + 6 * k, bw = 198 * k, bh = 12 * k;
  const grd = g.createLinearGradient(bx, by, bx, by + bh), full = life >= 1;
  grd.addColorStop(0, full ? `hsl(${(t * 300) % 360},100%,72%)` : '#fff3a0'); grd.addColorStop(1, full ? `hsl(${(t * 300 + 60) % 360},100%,50%)` : '#ffae20');
  g.save(); g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + bw * life, by); g.lineTo(bx + bw * life - bh * 0.5, by + bh); g.lineTo(bx, by + bh); g.closePath(); g.clip();
  g.globalAlpha = 0.85; g.fillStyle = grd; g.fillRect(bx, by, bw, bh); g.globalAlpha = 1;
  g.fillStyle = 'rgba(120,50,0,0.35)';
  for (let sx = bx + ((t * 60) % 10); sx < bx + bw * life; sx += 10) g.fillRect(sx, by, 4, bh);
  g.restore();
  im(h2.ball[pi], gx + 6 * k, gy + 7 * k, 30 * k, 30 * k);
  if (life < 0.3 && life > 0 && (t * 3 | 0) % 2 === 0) im(h2.danger, bx + bw - 74 * 1.5 - 6, by + 1, 74 * 1.5, 12 * 1.5);
  if (badge) {
    const sk = 1.45, sw = 156 * sk, sh = 44 * sk, sx2 = W / 2 - sw / 2 + 120;
    im(h2.style, sx2, 12, sw, sh);
    im(h2.single, sx2 + sw / 2 - 70 * 1.25 / 2 * 1.4, 12 + sh * 0.5, 70 * 1.25 * 1.4, 16 * 1.4);
  }
  // the score panel
  const sk = 1.5, pw = 232 * sk, ph = 58 * sk, px = right ? W - pw - 60 : 108, py = 612;
  im(h2.score, px, py, pw, ph);
  const di = [4, 1, 2, 3].indexOf(this.diff);
  im(h2.diff[di >= 0 ? di : 1], px + 74 * sk, py - 1, 94 * 1.25, 16 * 1.25);
  g.font = 'italic 900 34px "Arial Black", "Segoe UI", Arial, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.strokeStyle = '#3a2000'; g.lineWidth = 4; g.lineJoin = 'round';
  const str = String(this.score).padStart(Play.scoreDigits || 9, '0');
  g.strokeText(str, px + pw - 30, py + ph * 0.62); g.fillText(str, px + pw - 30, py + ph * 0.62);
  if (two && this.name) text(this.name, px + pw / 2, py + ph + 14, 16, '#fff', 'center');
};

const Play = {
  // charts: [{built, diff, o, prof, name}] - one per player
  with(song, charts, music, dance) {
    this.song = song; this.music = music; this.dance = dance || null;
    this.two = charts.length > 1;
    // which game each part of the screen looks like (all one game, or mixed in DDR CUSTOM). Hottest
    // Party's pictures come from its disc, so without it everything stays DDR II's
    const has = hpAvailable(), L = k => has && look(k) === 'hp';
    this.hpArrows = L('arrows'); this.hpJudge = L('judge'); this.hpBoard = L('board'); this.hpHud = L('hud'); this.hpBanners = L('banners');
    this.hp = this.hpBoard;
    this.scoreDigits = look('score') === 'hp' ? 9 : 7;
    this.hp2Screen = (gameNow() === 'hp2' || gameNow() === 'hp3') && hp2Available();         // Hottest Party 2's own gold screen
    if (this.hp2Screen) hp2Hud();
    if (this.hpArrows || this.hpJudge || this.hpHud || this.hpBanners) hpHud();
    const lanes = S.style === 'double' ? 8 : 4;
    this.lanes = lanes;
    this.ps = charts.map((c, i) => new Dancer(i, song, c.built, c.diff, S.mode === 'relaxed' ? Object.assign({}, c.o, { gauge: 'no fail' }) : c.o, c.prof, c.name, lanes));
    this.cheer = null; this.crowdNext = undefined;
    this.group = GROUP && this.ps.length > 1 && !DEMO.on ? new GroupJudge(GROUP, this.ps) : null;
    for (const p of this.ps) p.group = this.group;
    charts.forEach((c, i) => { if (c.com !== undefined) this.ps[i].com = c.com; });
    this.mode = COURSE ? 'course' : WK ? 'workout' : GC ? 'gc' : BATTLE ? 'battle' : (S.mode || 'free');
    this.charts = charts;
    this.train = null;
    if (song.lesson) { this.mode = 'lesson'; for (const p of this.ps) p.o = Object.assign({}, p.o, { gauge: 'no fail' }); }
    if (this.mode === 'training') {
      const tm = this.ps[0].timing, r = TRAIN.speed / 100;
      const A = TRAIN.from > 1 ? timeAtOff(tm, (TRAIN.from - 1) * 4096) : 0, B = TRAIN.to ? timeAtOff(tm, TRAIN.to * 4096) : Infinity;
      this.train = { rate: r, A, B };
      for (const p of this.ps) {
        p.o = Object.assign({}, p.o, { gauge: 'no fail' });
        p.notes = p.notes.filter(n => n.t >= A - 0.05 && n.t < B);       // just the section's steps
        p.rows = p.rows.filter(rw => rw.t >= A - 0.05 && rw.t < B);
        p.lastNoteT = Math.max(A, ...p.notes.map(n => n.endT || n.t));
        p.freezeTotal = p.notes.filter(n => n.endT !== undefined).length;
        p.den = SCORE_DEN * Math.max(1, p.rows.length + p.freezeTotal);
      }
      this.lastNoteT = Math.max(...this.ps.map(p => p.lastNoteT));
      this.endT = Math.min(this.endT, this.lastNoteT + 1.5);
    }
    if (COURSE && COURSE.i > 0 && COURSE.life[0] !== undefined) this.ps.forEach((p, i) => { p.life = COURSE.life[i]; });
    if (this.mode === 'maxcombo' && MC) this.ps.forEach((p, i) => { p.combo = MC.totals[i] || 0; p.maxCombo = p.combo; p.mcRun = true; });
    this.ended = null; this.saidReady = false; this.saidGo = false;
    for (const k in AUTO_HELD) delete AUTO_HELD[k];
    this.lastNoteT = Math.max(...this.ps.map(p => p.lastNoteT));
    this.endT = Math.max(music.duration - 0.2, this.lastNoteT + 1.5);
    return this;
  },
  enter() {
    this.ringAt = RING.parts ? performance.now() : undefined;
    // the opening's sound (0x80105318: sound 601 = SE_SYS_SHUTOPEN)
    if (RING.parts) sfx('SE_SYS_SHUTOPEN');
    this.bossSnd = false;
    // the combo performance's state (combo object, 0x800fcb90): per player the level reached (+8; 1000 =
    // done for the song), the opening run (counts good steps until the first break, then stops) and the
    // performance running now
    this.apl = { data: null, lv: this.ps.map(() => 0), run: this.ps.map(() => 0), alive: this.ps.map(() => true), last: this.ps.map(() => 0), cur: null };
    const style = this.song && this.song.tier;
    if (S.comboPerf !== 'off' && style >= 0 && style <= 3 && !this.two && !this.hp) loadAppeal(style).then(d => { if (this.apl) this.apl.data = d; });
    const ctx = audio();
    this.src = ctx.createBufferSource();
    this.src.buffer = this.music;
    this.gain = ctx.createGain();
    this.src.connect(this.gain).connect(ctx.destination);
    if (S.songOn === false) this.gain.gain.value = 0;     // SONG: OFF (steps and sounds only)
    this.lastTick = undefined;
    this.t0 = ctx.currentTime + 4.6;      // room for the song card before READY
    Play.introOn = this.introOn = false;
    this.danceEnd = null;
    // the boss stage's opening (10 s: its three camera moves) plays first, before the song card
    // (Dolphin camtrace: the opening's travel runs 10 s and the song's starts at chart time 0, with the
    // tunnel, the dance and its first camera move; READY comes 0.3 s later - no card pause before it)
    if (this.stage && this.stage.bossIntro && !this.train) this.t0 = ctx.currentTime + 10;
    if (this.train) {                       // training: from measure A, at the chosen speed
      const tr = this.train;
      this.src.playbackRate.value = tr.rate;
      this.t0 = ctx.currentTime + (this.train.again ? 1.5 : 4.6);
      this.src.start(this.t0, Math.max(0, tr.A));
      this.ticks = [];
      if (TRAIN.tick) for (const row of this.ps[0].rows) { const at = this.t0 + (row.t - tr.A) / tr.rate + outLatency(); if (at > ctx.currentTime) this.ticks.push(trainTick(ctx, at)); }
    } else this.src.start(this.t0);
    this.quitHeld = 0;
    this.movie = this.song.custom ? (this.song.video && S.movies !== false ? new VideoMovie(this.song.video, this.song.videoStart || 0) : null)
               : this.song.movie && this.song.movie.sync && S.movies !== false && !(this.stage && this.stage.noDancer) ? new Movie(this.song.movie.file, { loop: !this.song.movie.sync }) : null;
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
    if (this.stage && this.stage.dancers && this.stage.dancers.length) return;     // Hottest Party's own dancers are on its stage
    if (this.stage && this.stage.noDancer) return;                                  // DDR II's video stage: just the monitor
    // like the game: a song with a video shows its video monitor, not a dancer
    // (also while the video is still loading, so the dancer doesn't flash up before it)
    if (this.movie && !this.movie.failed) return;
    const tm = this.ps[0].timing, beat = this.danceBeat(t), end = this.danceEndBeat();
    let cv = null;
    // on DDR II's 3D stage the dancer stands in the stage, seen through the stage's camera
    const view = this.stage && this.stage.hp2 === 'ddr2' && this.stage.view;
    // the boss stage's opening: the S part's opening clip (600 frames over the 10 s), at the S part's
    // formation its cues never pick (the three side by side on the ground)
    let intro = null;
    // (the opening's clip is the S part's last one, the 600-frame clip whose hips are placed in the
    // stage - HP4U_053 has it third, HP4U_054 fourth, HP4U_055 sixth; the others are one-measure dance clips)
    const Spart = this.choreo.d && this.choreo.d.S, openClip = Spart && Spart.length ? Spart[Spart.length - 1] : null;
    const hp = openClip && openClip.Hips && openClip.Hips.p;
    if (view && this.stage.introT != null && hp && hp.length > 3 && hp[2] > 2) {
      const pt = this.choreo.part('S'), used = new Set(pt.fcues.map(c => c.k5));
      const form = pt.forms.find((f, i) => !used.has(i)) || null;
      intro = { clip: openClip, f: Math.min(143.99, this.stage.introT / 10 * 144), form };
    }
    const ap = this.apl && this.apl.cur ? { clip: this.apl.cur.clip, f: Math.min(143.99, Math.max(0, (t - this.apl.cur.t0) / this.apl.cur.len * 144)) } : null;
    // the light show (DDR2_SPEC.md "the light show decoded"): while a combo performance runs the game
    // switches the dancers' ambient colour from the stage's (light preset 0 of the current variant) to
    // the table's clamp(C x F), at once, and back at the end. DDR II PC's own dancer takes that change
    // as the ratio of the two colours on its ambient term (the game's own dancers are not redrawn).
    let tint = null;
    if (ap && this.apl.data && this.apl.data.lights && this.stage && this.stage.data) {
      const L = this.apl.data.lights[this.apl.cur.type], amb = this.stage.data.dancerAmb || [];
      const base = amb[this.stage.variant || 0] || amb[0];
      if (L && base) tint = L.amb.map((v, k) => base[k] > 0 ? v / base[k] : 1);
    }
    // the dancer lighting switch (Options: DANCER LIGHTING): GAME STYLE lights DDR II PC's own dancer
    // the game's way - the stage's ambient colour for the current variant, swapped for the light
    // show's colour while a combo performance runs
    let ambG = null;
    if (S.dancerLight === 'game' && this.stage && this.stage.data && this.stage.data.dancerAmb) {
      const amb = this.stage.data.dancerAmb, base = amb[this.stage.variant || 0] || amb[0];
      const L = ap && this.apl.data && this.apl.data.lights ? this.apl.data.lights[this.apl.cur.type] : null;
      const c = L ? L.amb : base;
      if (c) ambG = c.map(v => v / 255);
    }
    try { cv = Dancer3D.render(this.choreo, beat, end, view ? { view, secs: t, intro, appeal: ap, tint: ambG ? null : tint, lightMode: S.dancerLight, ambG } : {}); } catch (e) { console.error('dancer', e); this.choreo = null; return; }
    if (!cv) return;
    if (view) { g.drawImage(cv, 0, 0, W, H); return; }
    const [cx, top, w] = this.dancerSpot(), h = w * cv.height / cv.width;
    // a soft floor shadow, then the dancer
    g.fillStyle = 'rgba(0,0,30,0.35)'; g.beginPath(); g.ellipse(cx, top + h * 0.885, w * 0.22, w * 0.045, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(cv, cx - w / 2, top, w, h);
  },
  leave() { if (this.cheer) { A.stopSfx(this.cheer.h, 1.5); this.cheer = null; } try { this.src.stop(); } catch (e) {} for (const o of this.ticks || []) { try { o.stop(); } catch (e) {} } this.ticks = []; if (this.movie) { this.movie.close(); this.movie = null; } },
  // song time for a context time; offset > 0 moves the arrows later
  songTime(ctxT) { return this.train ? this.train.A + (ctxT - outLatency() - this.t0) * this.train.rate - S.offset / 1000 : ctxT - outLatency() - this.t0 - S.offset / 1000; },
  now() { return this.songTime(actx.currentTime); },
  // the boss stage: READY comes 0.3 s after chart time 0 (Dolphin footage, 4 fps), 3.3 s later than
  // after a normal song's card
  bannerShift() { return this.stage && this.stage.bossIntro ? 3.3 : 0; },
  // where the dance is (in beats of its own tempo): a song's own dance (the fixed table) runs on the
  // chart's clock in seconds at the dance file's tempo (Dolphin camtrace, London EVOLVED Ver.C: the dance
  // controller's time = chart time, its camera moves change every 5 measures of 190.04 BPM while the
  // chart is at 170); the other dances follow the chart's beats
  danceEndBeat() {
    this.danceBeat(0);
    return this.danceEnd ? this.danceEnd.endBeat : this.danceBeat(this.lastNoteT);
  },
  danceBeat(t) {
    const d = this.dance, bpm = d && d.clock === 'seconds' && d.cues && d.cues.S && d.cues.S.cues && d.cues.S.cues[0] && d.cues.S.cues[0].bpm;
    if (bpm && this.choreo && this.choreo.beatAtSeconds) {
      // the ending: the dance's E part is placed to end with the song - at whole seconds of the chart's
      // last tempo point (0x8003d740 -> 0x80119de4: ticks / 150, a whole number) minus E's length; the
      // loop playing then is cut short (Dolphin camtrace: London EVOLVED Ver.C's E at 86.0 s, twice)
      const ch = this.choreo;
      if (!this.danceEnd) {
        // (the song's length: its song record +36 - main.dol's table, the length the game's schedule
        // holds at +448: Wings of an Angel 185, London EVOLVED 114, both checked in Dolphin memory; the
        // chart's last tempo point only when the record has none)
        const tsec = this.ps[0].timing.s || [], recLen = this.song && this.song.length > 0 ? this.song.length : 0;
        const songEnd = Math.floor(recLen || (tsec.length ? tsec[tsec.length - 1] : 0));
        const E = ch.d.E && ch.d.E.length ? ch.part('E') : null;
        // (0x80119f0c lays S and the loops end to end until a part would pass the song's end minus E's
        // length; that part stops before its first row past that point and E starts there - camtrace +
        // the merged table in memory: S, L01, L02 cut after 66 rows, E at 85.89 s)
        let eStart = Infinity;
        if (E) {
          const limit = songEnd - ch.partLen(E);
          let at = ch.partLen(ch.part('S'));
          for (let k = 0; k < 4000; k++) {
            if (k >= ch.loops.length) ch.reach(ch.loopsLen());
            const pt = ch.loops[k];
            if (!pt) { eStart = at; break; }
            const len = ch.partLen(pt);
            if (at + len <= limit) { at += len; continue; }
            const row = (pt.rows || []).find(r => at + r.t > limit);
            eStart = row ? at + row.t : at + len;
            break;
          }
        }
        const mE = isFinite(eStart) ? ch.beatAtSeconds(eStart) / 4 : Infinity;
        this.danceEnd = { eStart, EM: Math.floor(mE) + 1, endBeat: isFinite(mE) ? 4 * Math.floor(mE) : 1e9, E };
      }
      const de = this.danceEnd;
      if (de.E && t >= de.eStart) return 4 * (de.EM + ch.partMeasure(de.E, t - de.eStart));
      return ch.beatAtSeconds(t);
    }
    if (bpm) return Math.max(0, t) * bpm / 60;
    return this.ps[0].timing.offAt(t) / 1024;
  },
  // a pad action -> [dancer, lane]. VERSUS: each side is its own player. One player: both sides
  // play the same 4 lanes, or the two halves of a Double chart.
  route(a) {
    const m = /^P([1-4])([LDUR])$/.exec(a);
    if (!m) return null;
    const side = +m[1] - 1, d = DIRS.indexOf(m[2]);
    if (this.two && this.lanes === 8) return this.ps[side >> 1] && this.ps[side >> 1].com === undefined ? [this.ps[side >> 1], (side & 1) * 4 + d] : null;   // 4 mats
    if (this.two) return side < this.ps.length && this.ps[side].com === undefined ? [this.ps[side], d] : null;
    if (side > 1) return null;
    if (this.lanes === 8) return [this.ps[0], side * 4 + d];
    return [this.ps[0], d];
  },
  heldBy(p, l) {
    if (isAuto(p)) return (AUTO_HELD[p.idx + ':' + l] || 0) > this.now();
    if (p.com !== undefined) return p.holding.some(n => n.lane === l && (n.comHold || 0) > this.now());
    const d = DIRS[l % 4];
    if (this.two && this.lanes === 8) return input.isDown(`P${p.idx * 2 + (l < 4 ? 1 : 2)}${d}`);
    if (this.two) return input.isDown(`P${p.idx + 1}${d}`);
    if (this.lanes === 8) return input.isDown(`P${l < 4 ? 1 : 2}${d}`);
    return input.isDown('P1' + d) || input.isDown('P2' + d);
  },
  input(a, pressed, perf, menuKey) {
    if (DEMO.on) { if (pressed) endDemo(); return; }
    if (menuKey) return;
    if (a === 'BACK') { this.quitHeld = pressed ? performance.now() : 0; return; }
    const r = this.route(a);
    if (!r || !pressed) return;
    r[0].press(r[1], this.songTime(ctxTimeAt(perf)));
  },
  fadeOut() {
    try { this.gain.gain.setTargetAtTime(0, actx.currentTime, 0.6); } catch (e) {}
    if (this.cheer) { A.stopSfx(this.cheer.h, 2); this.cheer = null; }
  },
  // The crowd (main.dol 0x80026b10, the song's sound step): at READY the crowd cheers (SE_DDR_CHEER01, looped)
  // for 6 s then fades out over 5 s; it's quiet from HERE WE GO for 7 measures. After that, on a step that
  // left a player's gauge over 700 or combo over 12 it cheers (CHEER02, looped, 6 s), or on one that left
  // the gauge under 200 it boos (CHEER03) - then at least 17 measures until the next. A cleared song ends
  // with the crowd cheering. VOICE: OFF = no crowd, NO BOOING = no boos.
  crowd(what) {
    const t = this.now(), v = S.voice;
    const on = v !== false && !DEMO.on && A.ready && this.mode !== 'lesson';
    const play = (name, dur, loop) => {
      if (this.cheer) A.stopSfx(this.cheer.h, 0.4);
      const h = { srcs: [] };
      A.playSfx(name, 1, { loop, handle: h });
      this.cheer = { h, until: dur > 0 ? t + dur : Infinity };
    };
    const pos = () => this.ps[0].timing.offAt(Math.max(0, t));
    if (what === 'ready') { if (on) play('SE_DDR_CHEER01', 6, true); return; }
    if (what === 'go') { if (this.cheer) { A.stopSfx(this.cheer.h, 5); this.cheer = null; } this.crowdNext = 7 * 4096; return; }
    if (what === 'end') { if (on) play('SE_DDR_CHEER02', 0, true); return; }
    // every frame: the looped cheer's time runs out, then the crowd reacts to this frame's steps
    if (this.cheer && t > this.cheer.until) { A.stopSfx(this.cheer.h, 5); this.cheer = null; }
    let ev = 0;
    for (const p of this.ps) { ev |= p.crowdEv || 0; p.crowdEv = 0; }
    if (!ev || this.ended || this.crowdNext === undefined || t < 0 || pos() < this.crowdNext) return;
    if (ev & 1) { if (on) { play('SE_DDR_CHEER02', 6, true); this.crowdNext = pos() + 17 * 4096; } }
    else if (on && v !== 'noboo' && this.ps.some(p => !p.failed)) { play('SE_DDR_CHEER03', 0, false); this.crowdNext = pos() + 17 * 4096; }
  },
  update() {
    const t = this.now();
    for (const p of this.ps) {
      if (isAuto(p)) {
        for (const n of p.notes) {
          if (n.t > t) break;
          if (!n.done) { AUTO_HELD[p.idx + ':' + n.lane] = n.endT !== undefined ? n.endT : 0; p.press(n.lane, n.t); }
        }
      }
      if (p.com !== undefined) comStep(p, t);
      p.update(t, l => this.heldBy(p, l));
    }
    if (!this.saidReady && t - this.bannerShift() > -3.0) { this.saidReady = true; sfx('VO_NAR_INGAMEREADY'); this.crowd('ready'); }
    if (!this.saidGo && t > -1.3) { this.saidGo = true; sfx('VO_NAR_INGAMEHEREWEGO'); this.crowd('go'); }
    this.crowd('step');
    // METRONOME (0x80026b10): a tick on every beat, the first beat of each measure its own sound
    if (S.metronome && !this.ended && A.ready) {
      const bt = Math.floor(this.ps[0].timing.offAt(Math.max(0, t)) / 1024);
      if (t >= 0 && this.lastTick !== undefined && bt > this.lastTick) A.playSfx(bt % 4 === 0 ? 'SE_DDR_METRONOME01' : 'SE_DDR_METRONOME02');
      this.lastTick = bt;
    }
    // (held BACK quits: a lesson goes back to SELECT LESSON, everything else to the song list)
    if (this.quitHeld && performance.now() - this.quitHeld > 800) { go(this.mode === 'lesson' ? LessonSel : Select); return; }
    // the song stops when every player has failed, or after the last step
    if (!this.ended && this.ps.filter(p => p.com === undefined).every(p => p.failed && t - p.failAt > 0.2)) { this.ended = { kind: 'failed', at: t }; this.fadeOut(); }
    if (!this.ended && t > this.lastNoteT + 0.6) {
      this.ended = { kind: 'finish', at: t };
      if (this.ps.some(p => !p.failed)) this.crowd('end');
      if (this.ps.some(p => p.fullCombo())) sfx('SE_DDR_FULLCOMBO');
    }
    if (this.ended && !this.ended.faded && t - this.ended.at > 2.2) { this.ended.faded = true; this.fadeOut(); }
    if (this.train && TRAIN.repeat && this.ended && t - this.ended.at > 1.2) {     // training: the section again
      try { this.src.stop(); } catch (e) {}
      const again = Play.with(this.song, this.charts.map(c => Object.assign({}, c)), this.music, this.dance);
      again.stage = this.stage; again.train.again = true; go(again); return;
    }
    if ((this.ended && t - this.ended.at > 3.6) || t > this.endT + 1) { if (DEMO.on) return endDemo(); go(Results.with(this)); }
  },
  // The combo performance, each frame (main.dol 0x800fcdc8). Per player: the opening run (+0x5832c)
  // counts good steps until the first break and then stays put; the depth (+52) is 1 for the option's
  // "50" (the only depth the dumps showed). Only up to 85% of the song's measures (+0x301094 against
  // +0x301090) and one at a time:
  //   run broken (run > combo) after a level was reached -> type 4 (the break), then none for the song;
  //   level 0, depth >= 1, run >= 50 -> type 0; level 1, depth >= 2, run >= 100 -> type 1;
  //   level 2, depth >= 3, run >= 200 -> type 2, again at 400, 600, ...
  // A performance plays the lead's motion clip type x 2 (+1 for flagged dancers) and the camera move of
  // the same number, and ends when the motion has played out (0x800fd3c8: dancer +148 = 2).
  appealStep(t) {
    const A = this.apl;
    if (!A || !A.data || !this.stage || this.stage.hp2 !== 'ddr2' || !this.choreo) return;
    // (the player block's +52 is the chart's difficulty, 0 BEGINNER .. 4 CHALLENGE - written with the level at
    // +48 by 0x800339f4: so no performance on BEGINNER, the 100 one from DIFFICULT, the 200 ones from EXPERT)
    const diffIdx = p => ({ 4: 0, 1: 1, 2: 2, 3: 3, 6: 4 })[p.diff] || 0;
    if (A.cur) {
      const u = (t - A.cur.t0) / A.cur.len;
      if (u >= 1 || u < 0) { A.cur = null; this.stage.appealCam = null; }
      else {
        const cam = A.data.cams[A.cur.idx];
        this.stage.appealCam = cam ? { cam, f: (t - A.cur.t0) * 60 } : null;
      }
    }
    if (t < 0 || this.ended) return;
    const tm = this.ps[0].timing;
    const meas = Math.floor(tm.offAt(t) / 4096), total = Math.floor(tm.offAt(this.lastNoteT) / 4096);
    let ev = null;
    this.ps.forEach((p, i) => {
      if (A.alive[i]) { if (p.combo < A.last[i]) A.alive[i] = false; else A.run[i] = p.combo; }
      A.last[i] = p.combo;
      if (A.lv[i] >= 1000 || meas > Math.floor(total * 85 / 100)) return;
      const run = A.run[i];
      if (run > p.combo) { if (A.lv[i] > 0 && !ev) ev = [i, 4]; A.lv[i] = 1000; return; }
      const lv = A.lv[i];
      const need = lv === 0 ? [1, 50, 0] : lv === 1 ? [2, 100, 1] : [3, lv === 2 ? 200 : (lv - 1) * 200, 2];
      if (diffIdx(p) >= need[0] && run >= need[1]) { if (!ev) ev = [i, need[2]]; A.lv[i]++; }
    });
    if (ev && !A.cur) {
      const lead = ((Dancer3D.customFor || '').match(/ddr2char\/(\d{3})\//) || [])[1];
      const alt = lead && A.data.alt ? A.data.alt[lead] || 0 : 0;
      const idx = ev[1] * 2 + alt, c = A.data.clips[idx];
      if (c && c.bones) {
        A.cur = { type: ev[1], idx, t0: t, len: c.frames / 60, clip: c.bones };
        // the stage effects (0x800535f0): bank 3 effect A[style][clip], then B[style][type], at the
        // stage's origin (no spot); the set is the song's style (movie manager +0x10000 - 20440: 0 for
        // Wings of an Angel, 1 for a style-1 song in the dumps)
        const fx = this.stage.fx, D = A.data;
        if (fx && D.bank3) {
          fx.addBank(3, D.bank3);
          for (const e of [D.effA && D.effA[idx], D.effB && D.effB[ev[1]]]) if (e >= 0) fx.play(3, e, null, { tag: 'apl' });
        }
      }
    }
  },
  // before READY the song's card flies out of the video screen like the game's: it starts tiny at
  // the screen's top-left, tumbles up and round in an arc (white back first, flipping to the
  // front), lands over the bottom-right of the screen with a slight tilt, and stays until READY ends
  drawSongCard(t) {
    // (the boss stage: the card and the footprints come at the start of its opening, over the island,
    // and the card is gone when the night shot begins - Dolphin footage)
    const boss = this.stage && this.stage.bossIntro;
    const k = boss ? t + 10 : t + 4.6;      // seconds since the song screen came up
    if (k < 0.25) return;
    const f = clamp((k - 0.25) / 1.1), out = boss ? clamp((k - 2.7) / 0.3) : clamp((t + 1.4) / 0.3);
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
    if (this.hp && !this.two) return [{ lw: 94, x0: 199 }];
    if (this.hp) return [{ lw: 90, x0: 60 }, { lw: 90, x0: W - 60 - 4 * 90 }];
    if (!this.two) return [{ lw: 96, x0: 92 }];
    // 3 and 4 players (Wii 4-player screenshot, NORMAL): the fields 23.8% of the screen apart, centred at
    // 14.4 / 38.1 / 62.0 / 85.6% of the width, each field 16.6% wide. (3 players: not seen yet - spread
    // the same way over three places, PROVISIONAL)
    // (field centres from METER_MULTI_US.bin's layout; field widths measured: 4 players 16.6% of the
    // screen, 3 players 20.6%)
    if (this.ps.length > 2 && GROUP && partyLayout()) return this.ps.map(() => ({ lw: 96, x0: W / 2 - 2 * 96 }));
    if (this.ps.length > 2) {
      const n = this.ps.length, lw = W * (n > 3 ? 0.166 : 0.206) / 4, L = multiLayout(n);
      const cx = L && L.fields.length === n ? L.fields.map(f => f.x / 640) : n > 3 ? [0.144, 0.381, 0.620, 0.856] : [0.172, 0.5, 0.828];
      return this.ps.map((p, i) => ({ lw, x0: W * cx[i] - 2 * lw }));
    }
    return [{ lw: 96, x0: 92 }, { lw: 96, x0: W - 92 - 4 * 96 }];
  },
  draw(t0) {
    const t = this.now();
    // background: the song's video (or a background loop), else the game's gameplay backdrop
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const fr = this.movie && !this.movie.failed ? this.movie.frameAt(Math.max(0, t)) : null;
    let st = null;
    if (this.stage) {
      try {
        const tm = this.ps[0].timing;
        // (DDR II stages follow the dance's cue sheets: which part is danced when)
        this.stage.choreo = this.choreo; this.stage.endBeat = this.danceEndBeat();
        if (this.stage.hp2 === 'ddr2') this.stage.cameraWork = S.cameraWork;
        if (this.stage.hp2 === 'ddr2') this.stage.ndcShift = this.choreo ? (this.dancerSpot()[0] - W / 2) / (W / 2) : 0;
        this.stage.introT = this.stage.bossIntro && t < 0 && t >= -10 ? t + 10 : null;
        Play.introOn = this.introOn = this.stage.introT != null;
        // the boss opening's sound at c 180 (0x80116478: sound 633 SE_DDR_BOSS for one player, 634
        // SE_DDR_BOSSMULTI for more), with the stage's own effects
        if (this.introOn && this.stage.introT >= 3 && !this.bossSnd) { this.bossSnd = true; sfx(this.two ? 'SE_DDR_BOSSMULTI' : 'SE_DDR_BOSS'); }
        // the formation's look point (s1_look_NN): the dance's camera moves are relative to it (Dolphin
        // memory, boss song: (0,-15,20), (-30,15,-15), (30,15,-15) as the formation changed) - the stage is
        // drawn around it
        if (this.stage.hp2 === 'ddr2') {
          const fm = this.choreo && this.choreo.formAt && !this.stage.noDancer ? this.choreo.formAt(this.danceBeat(Math.max(0, t)), this.stage.endBeat) : null;
          this.stage.leadSpot = fm ? fm.look || (fm.spots && fm.spots[1]) || null : null;
        }
        this.appealStep(t);
        st = this.stage.draw(this.danceBeat(Math.max(0, t)), this.stage.hp2 === 'ddr2' ? t : performance.now() / 1000, t);
      }
      catch (e) { console.error('stage', e); this.stage = null; }
    }
    if (st) {
      g.drawImage(st, 0, 0, W, H);
      // (DDR II: a background-video variant fills the screen behind the dancers)
      const bgv = this.stage && this.stage.bgvFrame && this.stage.bgvFrame();
      if (bgv) g.drawImage(bgv, 0, 0, W, H);
    }
    else if (fr && (S.videoSize === 'full' || this.song.disc === 'hp3')) {      // (Hottest Party 3's music videos fill the screen)
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
    // the speaker ring opening out round the stage (track 1, 16 frames from the start of play)
    if (RING.parts && this.ringAt !== undefined) {
      const f = RING.freeze !== undefined ? RING.freeze : Math.floor((performance.now() - this.ringAt) / 1000 * 30);
      if (f < ringLen(1)) drawRing(1, f); else this.ringAt = undefined;
    }
    const many = this.ps.length > 2;
    const ry = this.hp ? 156 : many && !(GROUP && partyLayout()) ? (this.ps.length > 3 ? 224 : 232) : 196, lay = this.layout();     // (3 / 4 players: measured on the Wii screenshots)
    // 3 / 4 players: each field is a full-height see-through column in the player's colour
    const party = many && GROUP && partyLayout();
    if (many && !party) lay.forEach((l, i) => { g.fillStyle = ['rgba(40,90,230,0.45)', 'rgba(220,40,70,0.45)', 'rgba(40,200,90,0.45)', 'rgba(220,210,40,0.45)'][i]; g.fillRect(l.x0 - l.lw * 0.15, 0, l.lw * 4.3, H); });
    this.ps.forEach((p, i) => {
      const { lw, x0 } = lay[i], width = p.lanes * lw, cx = x0 + width / 2;
      // (FRIENDSHIP / SYNC, 3 / 4 players: one shared field - player 1's, whose judgments are the group's)
      if (party && i > 0) return;
      p.draw(t, x0, lw, ry, l => this.heldBy(p, l), this.ended);
      // before the song, footprints show where to stand: the outer panels, then the inner ones,
      // back and forth, then all four blink and they're gone (like the game)
      if ((this.stage && this.stage.bossIntro ? this.introOn && t + 10 < 2.2 : t < -2.4) && A.img.feet && A.img.feet[0]) {
        const k = this.introOn ? t + 10 : t + 4.6, ft = A.img.feet[p.idx === 1 ? 1 : 0], fs = lw * 0.8;
        const all = k > 1.75, on = all ? ((k * 8) | 0) % 2 === 0 : true, outer = ((k / 0.45) | 0) % 2 === 0;
        if (on) for (let l = 0; l < p.lanes; l++) {
          const inner = l % 4 === 1 || l % 4 === 2;
          if (!all && inner === outer) continue;
          g.drawImage(ft, x0 + lw * (l + 0.5) - fs / 2, ry - fs / 2, fs, fs);
        }
      }
      if (!this.introOn) {
        // (4 players: each player's meter panel scaled to its quarter of the screen - PROVISIONAL)
        // (3 / 4 players: the panel 61% size, its middle at 19.5% of the height - Wii 4-player screenshot)
        const ML = many && !party ? multiLayout(this.ps.length) : null;
        if (party) drawParty(this.ps, t);
        else if (ML) {
          p.drawHudMulti(this.ps.length, ML, t);
          // the STYLE plate in the middle with the style's word (NORMAL / SYNC / FRIENDSHIP), once
          if (i === this.ps.length - 1) {
            const M = A.multi[this.ps.length];
            mspr(M.plate, ML.plate);
            mspr(M.words[GROUP === 'sync' ? 1 : GROUP === 'friend' ? 2 : 0], ML.word);
          }
        }
        else {
          const shrink = many ? 0.61 : 1;
          if (shrink !== 1) { g.save(); g.translate(cx, H * 0.195); g.scale(shrink, shrink); g.translate(-cx, -86); }
          p.drawHud(x0, width, t, !this.two && this.lanes === 4, this.two);
          if (shrink !== 1) g.restore();
        }
      }
      // each player's ending banner (centred when playing alone)
      const bx = this.two ? cx : W / 2, bs = this.two ? 0.78 : 1.25;
      if (this.ended) {
        const k = clamp((t - this.ended.at) * 5), sc = bs * (1.4 - 0.4 * k), fc = p.fullCombo();
        const kind = p.failed ? 'failed' : fc ? 'fc' : 'finish';
        const im = kind === 'failed' ? (A.img.failed || A.img.tryAgain)
                 : kind === 'fc' ? (fc === 5 ? A.img.fullComboB : fc === 4 ? A.img.fullComboY : fc === 3 ? A.img.fullComboG : A.img.fullComboP || A.img.fullComboG)
                 : A.img.finishY;
        const label = kind === 'failed' ? 'FAILED' : kind === 'fc' ? 'FULL COMBO' : 'FINISH!!';
        const HBs = this.hpBanners && this.hp2Screen && HP2_HUD ? HP2_HUD : this.hpBanners && HP_HUD && HP_HUD.ok ? HP_HUD : null;
        const hb = HBs ? (kind === 'failed' ? HBs.failed : kind === 'fc' ? HBs.cleared : HBs.finished) : null;
        if (hb && hb.naturalWidth) blit(hb, bx, H / 2, sc * 1.2, k); else
        if (!blit(im, bx, H / 2, sc, k)) text(label, bx, H / 2, this.two ? 40 : 64, '#ffd23c', 'center');
      } else if (p.failed) blit(A.img.failed, bx, H / 2, this.two ? 0.75 : 1.2);
    });
    // banners
    const bt = t - this.bannerShift();
    if (t < -1.1) this.drawSongCard(t);
    const HB = this.hpBanners && this.hp2Screen && HP2_HUD ? HP2_HUD : this.hpBanners && HP_HUD && HP_HUD.ok ? HP_HUD : null, hb = k => HB && HB[k] && HB[k].naturalWidth ? HB[k] : null;
    if (HB) {
      if (bt < -1.4 && bt > -3.0) blit(hb('ready'), W / 2, H / 2, 1.6, clamp((bt + 3.0) * 4));
      else if (bt >= -1.4 && bt < -0.2) blit(hb('hereWeGo'), W / 2, H / 2, 1.5, clamp((-0.2 - bt) * 3));
      else if (t >= -0.2 && t < 0.6) blit(hb('go'), W / 2, H / 2, 1.6 + 0.4 * clamp(t + 0.2), clamp((0.6 - t) * 3));
    } else
    if (bt < -1.4 && bt > -3.0) { if (!blit(A.img.ready, W / 2, H / 2, 1.2, clamp((bt + 3.0) * 4))) text('READY', W / 2, H / 2, 56, '#ffd23c', 'center'); }
    else if (bt >= -1.4 && bt < 0.3) { if (!blit(A.img.hereWeGo, W / 2, H / 2, 1.2, clamp((0.3 - bt) * 3))) text('HERE WE GO!', W / 2, H / 2, 56, '#ffd23c', 'center'); }
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
    // (3 / 4 players: CHANGE INFO turns the cards between the grade and the counts)
    if (p && this.ps && this.ps.length > 2 && (a === 'OPTIONS' || a === 'P1L' || a === 'P1R')) { this.info = !this.info; sfx('SE_SYS_SELECT02'); return; }
    if (!p || (a !== 'START' && a !== 'BACK')) return;
    sfx('SE_SYS_DECIDE01');
    if (this.play && this.play.mode === 'gc' && GC) { gcSongDone(this.ps[0], this.play); return; }
    if (this.play && this.play.mode === 'battle' && BATTLE && this.ps.length > 1) { go(BattleResult.with(this.ps)); return; }
    if (this.play && this.play.mode === 'lesson') {
      const p0 = this.ps[0];
      // the lesson's best grade (and full combo) - DDR II's lessons are kept apart from Hottest Party 3's
      const key = lessonKey(this.play.song), old = (SAVE.lessons || {})[key];
      if (!p0.failed && p0.gr && (!old || GRADE_RANK.indexOf(p0.gr) > GRADE_RANK.indexOf(old))) { SAVE.lessons = SAVE.lessons || {}; SAVE.lessons[key] = p0.gr; }
      const fc = p0.fullCombo ? p0.fullCombo() : 0;
      if (fc) { SAVE.lessonFc = SAVE.lessonFc || {}; SAVE.lessonFc[key] = Math.max(SAVE.lessonFc[key] || 0, fc); }
      writeSave();
      go(LessonSel); return;
    }
    if (this.play && this.play.mode === 'workout' && WK) {
      const p0 = this.ps[0], secs = Math.max(0, Math.min(this.play.endT, p0.failed ? p0.failAt : this.play.endT));
      WK.kcal += workoutKcal(p0, secs); WK.secs += secs; WK.songs++;
      WK.done = WK.target === 'time' ? WK.secs >= WK.goal : WK.target === 'kcal' ? WK.kcal >= WK.goal : false;
      go(WK.done ? WorkoutResult : Select); return;
    }
    if (this.play && this.play.mode === 'course' && COURSE) {   // a course: on to the next song, or its result
      const p0 = this.ps[0];
      COURSE.scores.push(p0.score); COURSE.life = this.ps.map(p => p.life);
      if (p0.failed) { COURSE.failed = true; go(CourseResult); return; }
      COURSE.i++;
      if (COURSE.i < COURSE.slots.length) startCourseSong(); else go(CourseResult);
      return;
    }
    if (this.play && this.play.mode === 'maxcombo' && MC) {   // the run goes on (pick the next song) or it's over
      MC.songs++;
      if (this.ps.some(p => p.failed)) { go(MCResult.with(this.ps.map(p => p.combo || p.maxCombo), MC.songs)); return; }
      MC.totals = this.ps.map(p => p.combo); go(Select); return;
    }
    const q = (this.awards || []).filter(Boolean);      // each player with user data gets their points card
    go(q.length ? Points.with(q[0], q.slice(1)) : Select);
  },
  // records, play points and challenge-task bonus into the player's own data (guests keep nothing)
  award(p) {
    const prof = p.prof;
    if (!prof || isAuto(p)) return null;              // DEMO plays keep no records or points
    if (this.play && this.play.mode && this.play.mode !== 'free') return null;   // (RELAXED / MAX COMBO keep their own records)
    prof.points = prof.points || 0; prof.records = prof.records || {};
    const key = recKey(p.song.slot, p.style, p.diff), old = prof.records[key];
    const r = { failed: p.failed, life: p.life, maxCombo: p.maxCombo, grade: p.gr };
    const gi = GRADE_ORDER.indexOf(p.gr);
    const play = p.failed || gi < 0 ? 0 : PLAY_POINTS[p.slot][gi];
    const ct = ctTask(prof);
    let tasks, taskSong = null;
    if (ct) {
      // the game's challenge task: only a cleared play of the right song counts
      const x = { level: p.slot, gauge: Math.floor((p.life || 0) / 10), maxCombo: p.maxCombo || 0, fc: (p.fc || 0) > 0,
                  rank: ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'].indexOf(p.gr) };
      const ok = !p.failed && ctSongOk(ct, p.song.slot);
      tasks = ct.rows.map(k => ({ label: k.label, pts: k.pts, done: ok && !!k.test(x) }));
      taskSong = ct.any ? null : songForSlot(ct.songId + 1) || null;
    } else tasks = TASKS.map(([label, pts, test]) => ({ label, pts, done: !!test(r) }));
    const bonus = tasks.reduce((n, k) => n + (k.done ? k.pts : 0), 0);
    const before = prof.points;
    p.newRecord = !old || p.score > old.score;
    const hadMedal = rdaIndex(p.song) >= 0 && hasMedal(p.song, prof);
    const rank = gr => ['E', 'D', 'C', 'B', 'A', 'AA', 'AAA'].indexOf(gr);
    prof.records[key] = {
      score: Math.max(p.score, old ? old.score : 0),
      grade: !old || rank(p.gr) > rank(old.grade) ? p.gr : old.grade,
      fc: Math.max(p.fc || 0, old ? old.fc || 0 : 0),
      // the game keeps its best max combo as a record of its own too (0x800e9374: u16 at song record +84)
      maxCombo: Math.max(p.maxCombo || 0, old ? old.maxCombo || 0 : 0),
      plays: (old ? old.plays || 0 : 0) + 1,
    };
    prof.points = before + play + bonus;
    // the task steps on while there is still something to unlock (0x800e77d8: reward list +148)
    let next = null;
    if (ct && nextUnlock(before)) {
      // (the step stores the profile's points field as it stands then: 0 after a new profile's first
      // play in the Wii dump, though that play gave 2,000 - the points before this play)
      ctStep(prof, before, prof.points);
      const nt = ctTask(prof);
      if (nt) next = { rows: nt.rows.map(k => ({ label: k.label, pts: k.pts })), song: nt.any ? null : songForSlot(nt.songId + 1) || null };
    }
    p.newMedal = rdaIndex(p.song) >= 0 && !hadMedal && hasMedal(p.song, prof);
    // what the new total unlocks (player 1's points decide the song list; shown only when unlocking is on)
    const unlocked = p.idx === 0 && S.unlocks === 'on' ? unlockedBetween(before, prof.points).filter(u => u.songs.length) : [];
    return { who: this.ps.length > 1 ? `PLAYER ${p.idx + 1}  ${p.name}` : null, play, bonus, tasks, taskSong, next, before, after: prof.points, unlocked };
  },
  enter() {
    if (!this.ps || !this.ps.length) { go(Select); return; }
    this.t0 = performance.now();
    this.gradeShown = false; this.info = false;
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
    if (ps.length > 2 && A.img.resMany && A.img.resMany.cards[0]) { this.drawMany(t, el); return; }
    // RESULTS tab
    g.fillStyle = 'rgba(160,170,180,0.9)'; g.fillRect(468, -6, 344, 84);
    g.fillStyle = '#2f8fe0'; g.fillRect(476, -6, 328, 76);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(476, -6, 328, 30);
    if (!blit(A.img.resTitle, 640, 44, 1.25)) text('RESULTS', 640, 44, 36, '#fff', 'center');
    // grade cards: player 1 left of the jacket (far left and far right in VERSUS)
    // (3 / 4 players - PROVISIONAL layout, the Wii's is not known yet: two cards each side of the jacket)
    const many = ps.length > 2, MANY_X = [20, 236, 848, 1064];
    ps.forEach(p => this.drawCard(p, many ? MANY_X[p.idx] : two ? (p.idx ? 1044 : 40) : 252, el));
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
    if (many) {
      // each player's counts in a column under their card
      const rows = [['MARVELOUS', p => p.counts.MARVELOUS], ['PERFECT', p => p.counts.PERFECT], ['GREAT', p => p.counts.GREAT],
                    ['GOOD', p => p.counts.GOOD], ['MISS', p => p.counts.BOO + p.counts.ALMOST], ['O.K.', p => p.counts.OK],
                    ['NOT QUITE', p => p.counts.NG], ['MAX COMBO', p => p.maxCombo], ['SCORE', p => p.score]];
      ps.forEach(p => {
        const x = MANY_X[p.idx];
        g.fillStyle = 'rgba(20,60,140,0.85)'; g.fillRect(x, 346, 196, 236);
        rows.forEach(([lb, f], i) => {
          if (el < 0.15 + i * 0.08) return;
          text(lb, x + 10, 366 + i * 25, 14, '#bfe6ff');
          text(String(f(p)), x + 186, 366 + i * 25, 18, '#fff', 'right');
        });
      });
    } else {
      if (panelImg) g.drawImage(panelImg, 0, 0, 284 + (two ? 146 : 0), 198, px, py, (284 + (two ? 146 : 0)) * sc, 198 * sc);
      ps.forEach(p => this.drawCounts(p, px + (p.idx ? 416 : 141) * sc, py, sc, el));
    }
    if (!two) {
      // song title on the right where the game shows the dancer
      const ti = texture('title', song.title);
      if (ti.img) g.drawImage(ti.img, 1010 - ti.img.width * 0.75, 420, ti.img.width * 1.5, ti.img.height * 1.5);
      else if (song.custom || song.disc) { text(song.name.slice(0, 26), 1010, 440, 24, '#fff', 'center'); if (song.artist) text(song.artist.slice(0, 32), 1010, 468, 16, '#dff', 'center', 'normal'); }
      text('Speed x' + ps[0].o.speed, 1010, 500, 18, '#dff', 'center', 'normal');
      if (ps[0].failed) blit(A.img.failed, 1010, 300, 0.8, clamp(el - 1.2));
    } else {
      const ti = texture('title', song.title);
      if (ti.img) g.drawImage(ti.img, 640 - ti.img.width * 0.6, 652, ti.img.width * 1.2, ti.img.height * 1.2);
      else if (song.custom || song.disc) text(song.name.slice(0, 40), 640, 668, 22, '#fff', 'center');
    }
    // DDR points (each player's own total)
    const pts = (p, x, align) => {
      if (!p.prof) return;
      g.fillStyle = 'rgba(20,40,150,0.9)'; g.fillRect(align === 'left' ? x : x - 150, 586 + (align === 'left' ? 50 : 0), 150, 22);
      const yy = align === 'left' ? 636 : 586;
      text('DDR POINTS', align === 'left' ? x + 75 : x - 75, yy + 11, 15, '#fff', 'center');
      text(String(p.prof.points).padStart(7, '0') + ' pts', x, yy + 42, 24, '#ffe86a', align);
    };
    if (many) ps.forEach(p => { if (p.prof) { text('DDR POINTS', MANY_X[p.idx] + 98, 598, 14, '#fff', 'center'); text(String(p.prof.points).padStart(7, '0') + ' pts', MANY_X[p.idx] + 98, 620, 20, '#ffe86a', 'center'); } });
    else {
      pts(ps[0], 28, 'left');
      if (two) pts(ps[1], 1252, 'right');
    }
    g.fillStyle = 'rgba(20,50,80,0.85)'; g.fillRect(1040, 640, 200, 34);
    text('Enter  CONTINUE', 1140, 657, 17, '#fff', 'center');
  },
  // 3 / 4 players (selResult CAE 0xedf20 the screen, 0x12b580 a card; laid out on the 854 x 480 screen, 1.5x
  // around the middle - checked against a Wii 4-player screenshot): the RESULTS tab (520, 11 / 29), the jacket
  // frame (520, 139) with the jacket (520, 128) at 0.5, the style words (520, 205), the judgment list (520, 327),
  // and the players' cards at (326, 122) (714, 122) (326, 327) (714, 327): card (0, 0) pivot (72, 99), PLAYER n
  // (0, -81), difficulty (0, -55), grade (0, 21). CHANGE INFO turns a card to its counts: window (0, 8) pivot
  // (58, 77), the eight counts at x 16.5, y -60 .. 45, the score at (32, 61) (last digit's middle on the place).
  drawMany(t, el) {
    const M = A.img.resMany, ps = this.ps, song = ps[0].song;
    const RX = x => 640 + (x - 520) * 1.5, RY = y => y * 1.5;
    const spr = (im, x, y, px, py, sc = 1, a = 1) => { if (!im) return false; g.save(); g.globalAlpha *= a; g.translate(RX(x), RY(y)); g.scale(sc * 1.5, sc * 1.5); g.drawImage(im, -px, -py); g.restore(); return true; };
    spr(M.titleBar, 520, 11, 123, 50); spr(M.title, 520, 29, 100, 19);
    const jk = texture('jacket', song.jacket);
    if (jk.img) { const s = 256 * 0.5 * 1.5; g.drawImage(jk.img, RX(520) - s / 2, RY(128) - s / 2, s, s); }
    spr(M.frame, 520, 139, 90, 82);
    const lanes8 = this.play.lanes === 8;
    spr(M.styles[GROUP === 'sync' ? 3 : GROUP === 'friend' ? 4 : lanes8 ? 6 : 0], 520, 205, 85, 12);
    spr(M.list, 520, 327, 112, 99);
    const SPOTS = [[326, 122], [714, 122], [326, 327], [714, 327]];
    ps.forEach(p => {
      const [cx, cy] = SPOTS[p.idx] || SPOTS[0], di = DIFFS.findIndex(d => d[0] === p.diff);
      spr(M.cards[p.idx], cx, cy, 72, 99);
      spr(M.players[p.idx], cx, cy - 81, 50, 13);
      if (this.info) {
        spr(M.counts, cx, cy + 8, 58, 77);
        const vals = [p.counts.MARVELOUS, p.counts.PERFECT, p.counts.GREAT, p.counts.GOOD, p.counts.BOO + p.counts.ALMOST, p.counts.OK, p.counts.NG, p.maxCombo];
        const row = (v, x, y, n) => {
          const h = 28 * 0.6 * 1.5, adv = h * 0.66, str = String(v).padStart(n, '0'), set = A.numbers && A.numbers.white, right = RX(x) + adv / 2;
          [...str].forEach((ch, k) => { const im = set && set[+ch], dx = right - adv * (str.length - k - 0.5);
            if (im) { const w = im.width * h / im.height; g.drawImage(im, dx - w / 2, RY(y) - h / 2, w, h); } else text(ch, dx, RY(y), h, '#fff', 'center'); });
        };
        vals.forEach((v, i) => row(v, cx + 16.5, cy - 60 + i * 15, 4));
        row(p.score, cx + 32, cy + 61, 7);
        return;
      }
      if (!spr(M.diffs[di], cx, cy - 55, 60, 11)) text(DIFFS[di][1], RX(cx), RY(cy - 55), 18, DIFFS[di][2], 'center');
      if (el > 1.2) {
        const k = clamp((el - 1.2) * 5), sc = 1.5 * (1.5 - 0.5 * k);
        const gi = A.img.grades && A.img.grades[p.gr];
        // (the grade layout 0x1b47c0 / 0x1cb760 hangs off the card's dummy01 at (0, 29): letter (0, -8), NEW RECORD (-5, -12))
        if (!blit(gi, RX(cx), RY(cy + 21), sc, k)) text(p.gr, RX(cx), RY(cy + 21), 90, '#ffd23c', 'center');
        // NEW RECORD across the letter (its size and tilt measured on the Wii screenshot: 187 px wide, 6 degrees)
        // (the Wii shows it on an E too: 3-player screenshot, every card E with NEW RECORD)
        if (p.newRecord && A.img.newRecord) {
          const im = A.img.newRecord, w = 187, h = im.height * w / im.width;
          g.save(); g.globalAlpha = k; g.translate(RX(cx - 5), RY(cy + 17)); g.rotate(-6 * Math.PI / 180); g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
        }
      }
    });
    drawPointsPlate();
    // (the game's EXIT / CHANGE INFO buttons, bottom right)
    g.fillStyle = 'rgba(20,50,80,0.85)'; g.fillRect(860, 640, 160, 34); g.fillRect(1030, 640, 210, 34);
    text('Enter  EXIT', 940, 657, 17, '#fff', 'center'); text('Tab  CHANGE INFO', 1135, 657, 17, '#fff', 'center');
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
      if (p.fc && A.img.resFull) blit(A.img.resFull[p.fc === 5 ? 3 : p.fc === 4 ? 0 : p.fc === 3 ? 2 : 1] || A.img.resFull[0], cx + cw / 2, cy + 248, 0.95, k);
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
      if (p.newRecord) {
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
    this.t0 = performance.now(); this.page = 0; this.nextShown = false;
    this.a.tasks.forEach((k, i) => { if (k.done) setTimeout(() => { if (scene === this && this.page === 0) sfx('SE_RES_CLEAR01'); }, 500 + i * 300); });
  },
  input(a, p) {
    if (!p || (a !== 'START' && a !== 'BACK')) return;
    sfx('SE_SYS_DECIDE01');
    // after the task card: the NEXT CHALLENGE TASK (once the task has stepped on)
    if (a === 'START' && this.page === 0 && this.a.next && !this.nextShown) { this.nextShown = true; this.t0 = performance.now(); return; }
    if (a === 'START' && this.page < this.a.unlocked.length) { this.page++; this.t0 = performance.now(); sfx('SE_DDR_FULLCOMBO'); return; }
    // the last task card shown names a specified song: the song list opens on it
    const card = this.nextShown && this.a.next ? this.a.next.song : this.a.taskSong;
    if (card && card.slot) this.jump = card.slot;
    if (this.rest.length) { const j = this.jump; go(Points.with(this.rest[0], this.rest.slice(1))); this.jump = this.jump || j; return; }
    if (this.jump) { S.lastSlot = this.jump; saveSettings(); Select.inFolder = null; Select.query = ''; Select.favOnly = false; }
    this.jump = null;
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
    // challenge task card (the NEXT CHALLENGE TASK card is pink and has only STILL NEEDED)
    const nextCard = this.page === 0 && this.nextShown && A_.next;
    const x = 210, y = 60, w = 860, h = 600;
    g.fillStyle = nextCard ? '#f05ab0' : '#5ab4f0'; g.fillRect(x, y, w, h);
    g.fillStyle = nextCard ? '#c8287e' : '#2f86da'; g.fillRect(x + 10, y + 10, w - 20, h - 20);
    text(nextCard ? 'NEXT CHALLENGE TASK' : 'CHALLENGE TASK', x + 60, y + 50, 34, '#fff');
    if (A_.who) text(A_.who, x + w - 40, y + 50, 26, '#ffe86a', 'right');
    g.fillStyle = nextCard ? '#6a1446' : '#103c8c'; g.fillRect(x + 30, y + 80, 330, 70);
    const tsong = nextCard ? A_.next.song : A_.taskSong;
    if (tsong) {
      // the song's title picture (2Dcommon/comAF_US.bin /10): the title and the artist under it, in the
      // game's yellow lettering - the same picture the game puts on this card
      const tp = tsong.title !== undefined && tsong.title !== null ? texture('title', tsong.title) : null;
      if (tp && tp.img) {
        const sc = Math.min(1.3, 300 / tp.img.width, 62 / tp.img.height);
        g.drawImage(tp.img, x + 195 - tp.img.width * sc / 2, y + 115 - tp.img.height * sc / 2, tp.img.width * sc, tp.img.height * sc);
      } else {
        text(tsong.name, x + 195, y + 105, 22, '#fff86a', 'center');
        if (tsong.artist) text(tsong.artist, x + 195, y + 132, 16, '#fff86a', 'center');
      }
      text('Earn bonus points by clearing the specified', x + 390, y + 103, 18, '#ffb050');
      text('song under the following conditions.', x + 390, y + 127, 18, '#ffb050');
    } else {
      text('ANY SONG', x + 195, y + 115, 32, '#4ab4ff', 'center');
      text('Earn bonus points by clearing any song', x + 390, y + 103, 18, '#ffb050');
      text('under the following conditions.', x + 390, y + 127, 18, '#ffb050');
    }
    (nextCard ? A_.next.rows : A_.tasks).forEach((k, i) => {
      const ry = y + 168 + i * 82;
      g.fillStyle = '#0f2a66'; g.fillRect(x + 30, ry, w - 60, 70);
      text(String(i + 1), x + 58, ry + 35, 40, '#fff', 'center');
      text(`${k.label} for ${k.pts} DDR points.`, x + 90, ry + 35, 21, '#fff');
      const appear = clamp((el - 0.5 - i * 0.3) * 6);
      // each row gets a stamp: CLEARED! (gold) or TRY AGAIN (brown) - the Wii's result card
      if (!nextCard && appear > 0) {
        g.save(); g.translate(x + w / 2 + 40, ry + 35); g.rotate(-0.12); const s = 1.6 - 0.6 * appear; g.scale(s, s);
        g.globalAlpha = appear; text(k.done ? 'CLEARED!' : 'TRY AGAIN', 0, 0, 52, k.done ? '#ffc030' : '#c8783c', 'center'); g.globalAlpha = 1; g.restore();
      }
    });
    const by = y + h - 76;
    g.fillStyle = nextCard ? '#a81e68' : '#1f5cb8'; g.fillRect(x + 10, by - 20, w - 20, 86);
    const nx = nextUnlock(A_.after);
    if (nextCard) {
      if (nx) { text('STILL NEEDED', x + w - 190, by, 20, '#bfe6ff', 'center'); text(Math.max(0, nx.at - A_.after) + ' pts', x + w - 190, by + 34, 30, '#fff', 'center'); }
      text('Enter  CONFIRM', x + w - 30, y + h + 22, 16, '#fff', 'right');
      return;
    }
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
    } else if (scene === Options && Options.page && Options.page.name === 'LIGHTS'
               && (Options.page.rows[Options.row] || {}).light) {
      // choosing a pin: that pin lights up so you can see which light it is
      const o = this.outputOf(Options.page.rows[Options.row].light) - 1;
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

// the FRAME RATE option: draw at most 60 / 120 times a second (the browser draws once per screen refresh, so
// this can only lower the rate; everything in the game runs on time, not on frames)
let lastFrameMs = 0;
const FPS = { n: [] };
function frame(ms) {
  const cap = S.fps === '60' ? 60 : S.fps === '120' ? 120 : 0;
  if (cap) {
    const step = 1000 / cap;
    if (ms - lastFrameMs < step - 1.5) { requestAnimationFrame(frame); return; }
    lastFrameMs = ms - lastFrameMs < step * 2 ? lastFrameMs + step : ms;   // keep an even beat
    if (lastFrameMs > ms) lastFrameMs = ms;
  }
  input.poll();
  try { Lights.tick(); } catch (e) {}
  const t = ms / 1000;
  try {
    if (scene && scene.update) scene.update();
    if (scene) scene.draw(t);
    // the FPS counter: frames drawn in the last second, top right, over everything
    FPS.n.push(ms); while (FPS.n.length && ms - FPS.n[0] > 1000) FPS.n.shift();
    if (S.showFps) {
      const f = FPS.n.length;
      g.save(); g.globalAlpha = 1; g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(W - 92, 6, 86, 26);
      text(f + ' FPS', W - 12, 19, 18, f >= 55 ? '#7dff7d' : f >= 30 ? '#ffe86a' : '#ff6a6a', 'right');
      g.restore();
    }
  } catch (e) {
    console.error(e);
    g.fillStyle = '#300'; g.fillRect(0, H - 40, W, 40);
    text('Error: ' + e.message, 20, H - 20, 18, '#fff', 'left', 'normal');
  }
  requestAnimationFrame(frame);
}
go(Boot);
requestAnimationFrame(frame);

// (workout overlays: the counter while dancing, the running total on the song select)
{
  const pd = Play.draw;
  Play.draw = function (t) {
    pd.call(this, t);
    if (this.mode === 'gc' && GC) gcPlayBar(this);
    if (this.mode === 'workout' && WK && this.ps && this.ps[0]) { const s2 = Math.max(0, this.now()); workoutBar(WK.kcal + workoutKcal(this.ps[0], Math.min(s2, this.endT)), WK.secs + Math.min(s2, this.endT)); }
  };
  const sd = Select.draw;
  Select.draw = function (t) { sd.call(this, t); if (WK) workoutBar(WK.kcal, WK.secs); if (GC) gcSelectBar(); };
  const si = Select.input;
  Select.input = function (a, p) {
    if (GC && p && a === 'BACK' && !this.stage && !this.join && !this.inFolder && this.typing === null) { sfx('SE_SYS_WINDOWOUT'); GC = null; go(GCSel); return; }
    if (WK && p && a === 'BACK' && !this.stage && !this.join && !this.inFolder && this.typing === null) { sfx('SE_SYS_WINDOWOUT'); go(WK.songs ? WorkoutResult : WorkoutSet); if (!WK.songs) WK = null; return; }
    return si.call(this, a, p);
  };
}

// (3 / 4 players on song select: their picks show as the game's markers on SELECT DIFFICULTY)
