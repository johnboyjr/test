// Input: keyboard + gamepads (dance mats show up as gamepads), mapped to game actions.
'use strict';

const ACTIONS = [
  ['P1L', 'P1 Left'], ['P1D', 'P1 Down'], ['P1U', 'P1 Up'], ['P1R', 'P1 Right'],
  ['P2L', 'P2 Left'], ['P2D', 'P2 Down'], ['P2U', 'P2 Up'], ['P2R', 'P2 Right'],
  ['START', 'Start / OK'], ['BACK', 'Back'], ['OPTIONS', 'Options'], ['SWITCH', 'SHORT / FULL'],
  ['P2START', 'P2 Start (join)'],
  // Double VERSUS (4 mats): P1 + P2 are player 1's two mats, P3 + P4 are player 2's
  ['P3L', 'P3 Left'], ['P3D', 'P3 Down'], ['P3U', 'P3 Up'], ['P3R', 'P3 Right'],
  ['P4L', 'P4 Left'], ['P4D', 'P4 Down'], ['P4U', 'P4 Up'], ['P4R', 'P4 Right'],
];

const DEFAULT_BINDINGS = {
  P1L: [{ t: 'key', code: 'ArrowLeft' }], P1D: [{ t: 'key', code: 'ArrowDown' }],
  P1U: [{ t: 'key', code: 'ArrowUp' }], P1R: [{ t: 'key', code: 'ArrowRight' }],
  P2L: [{ t: 'key', code: 'Numpad4' }], P2D: [{ t: 'key', code: 'Numpad2' }],
  P2U: [{ t: 'key', code: 'Numpad8' }], P2R: [{ t: 'key', code: 'Numpad6' }],
  START: [{ t: 'key', code: 'Enter' }], BACK: [{ t: 'key', code: 'Escape' }],
  OPTIONS: [{ t: 'key', code: 'Tab' }], SWITCH: [{ t: 'key', code: 'Space' }],
  P2START: [{ t: 'key', code: 'NumpadEnter' }],
  P3L: [], P3D: [], P3U: [], P3R: [], P4L: [], P4D: [], P4U: [], P4R: [],
};

// keys that always work in menus, whatever the mapping (so you can't lock yourself out)
const MENU_KEYS = { ArrowLeft: 'P1L', ArrowRight: 'P1R', ArrowUp: 'P1U', ArrowDown: 'P1D',
                    Enter: 'START', Escape: 'BACK', Tab: 'OPTIONS', Space: 'SWITCH' };

function bindName(b) {
  if (b.t === 'key') return 'Key ' + b.code.replace(/^Key/, '').replace(/^Digit/, '');
  if (b.t === 'btn') return 'Pad ' + (b.pad + 1) + ' button ' + b.idx;
  if (b.t === 'axis') return 'Pad ' + (b.pad + 1) + ' axis ' + b.idx + (b.dir > 0 ? '+' : '-');
  return '?';
}

class Input {
  constructor() {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    this.down = {};            // raw source id -> true
    this.listeners = [];       // fn(action, pressed, perfTime, isMenuKey)
    this.capture = null;       // fn(binding) while remapping
    this.padState = {};
    // The browser numbers pads in the order they're plugged in / first pressed, so the same mat can
    // get a different number next time. padMap turns the pad a mat really is into the pad number the
    // controls were mapped with; the "step on each mat" check fills it in.
    this.padMap = {};
    this.padWatch = null;      // fn(real pad index) while the mat check is listening
    this.matsChecked = false; this.padsChanged = false;
    addEventListener('gamepadconnected', () => { this.padsChanged = true; });
    addEventListener('gamepaddisconnected', () => { this.padsChanged = true; });
    addEventListener('keydown', e => {
      if (e.code === 'F11') return;
      if (e.code === 'Tab' || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      this.raw({ t: 'key', code: e.code }, true, e.timeStamp);
    });
    addEventListener('keyup', e => this.raw({ t: 'key', code: e.code }, false, e.timeStamp));
    addEventListener('blur', () => { for (const id in this.down) delete this.down[id]; });
  }
  setBindings(b) {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_BINDINGS));
    if (b) for (const k in b) this.bindings[k] = b[k];
  }
  on(fn) { this.listeners.push(fn); }
  // the pad number a group of actions is mapped to ('P1' -> P1L/D/U/R), or null if they're keys
  padOf(prefix) {
    for (const d of ['L', 'D', 'U', 'R']) for (const b of this.bindings[prefix + d] || []) if (b.t !== 'key') return b.pad;
    return null;
  }
  padCount() { return (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter(Boolean).length; }
  // real pad -> mapped pad. Pads left out are switched off if their number is now taken by another mat.
  setPadMap(map) {
    const taken = new Set(Object.values(map)), out = {};
    for (const p of navigator.getGamepads ? navigator.getGamepads() : []) {
      if (!p) continue;
      out[p.index] = p.index in map ? map[p.index] : taken.has(p.index) ? 100 + p.index : p.index;
    }
    for (const k in map) out[k] = map[k];
    for (const id in this.down) if (!id.startsWith('k:')) delete this.down[id];
    this.padMap = out; this.matsChecked = true; this.padsChanged = false;
  }
  static id(b) { return b.t === 'key' ? 'k:' + b.code : b.t === 'btn' ? `b:${b.pad}:${b.idx}` : `a:${b.pad}:${b.idx}:${b.dir}`; }
  actionsFor(b) {
    const id = Input.id(b), out = [];
    for (const a in this.bindings) if (this.bindings[a].some(x => Input.id(x) === id)) out.push(a);
    return out;
  }
  isDown(action) {
    return (this.bindings[action] || []).some(b => this.down[Input.id(b)]);
  }
  raw(b, pressed, t) {
    const id = Input.id(b);
    if (pressed) { if (this.down[id]) return; this.down[id] = true; } else { if (!this.down[id]) return; delete this.down[id]; }
    if (this.capture && pressed) { const c = this.capture; this.capture = null; c(b); return; }
    const acts = this.actionsFor(b);
    const menu = b.t === 'key' ? MENU_KEYS[b.code] : null;
    for (const a of acts) for (const fn of this.listeners) fn(a, pressed, t, false);
    if (menu && !acts.includes(menu)) for (const fn of this.listeners) fn(menu, pressed, t, true);
  }
  poll() {  // call every frame
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const now = performance.now();
    for (const p of pads) {
      if (!p) continue;
      let st = this.padState[p.index];
      if (!st) {   // first sight: take the resting state as-is (some axes rest at -1)
        st = this.padState[p.index] = { b: p.buttons.map(b => b.pressed || b.value > 0.5),
                                        a: p.axes.map(() => 0),
                                        rest: p.axes.map(v => v > 0.5 ? 1 : v < -0.5 ? -1 : 0) };
        continue;
      }
      const lp = p.index in this.padMap ? this.padMap[p.index] : p.index;
      const watch = this.padWatch;
      p.buttons.forEach((btn, i) => {
        const on = btn.pressed || btn.value > 0.5;
        if (on !== !!st.b[i]) {
          st.b[i] = on;
          if (watch) { if (on) watch(p.index); }
          else this.raw({ t: 'btn', pad: lp, idx: i }, on, now);
        }
      });
      p.axes.forEach((v, i) => {
        let cur = v > 0.5 ? 1 : v < -0.5 ? -1 : 0;
        if (cur === st.rest[i]) cur = 0;          // an axis sitting at its resting value is "not pressed"
        const prev = st.a[i] || 0;
        if (cur === prev) return;
        st.a[i] = cur;
        if (watch) { if (cur) watch(p.index); return; }
        if (prev) this.raw({ t: 'axis', pad: lp, idx: i, dir: prev }, false, now);
        if (cur) this.raw({ t: 'axis', pad: lp, idx: i, dir: cur }, true, now);
      });
    }
  }
}
