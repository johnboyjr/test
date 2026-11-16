// DDR II's particle effects (Konami TEB files, read by teb.py / ddr2fx.py), played the way main.dol's
// effect code does it: EffMath 0x80179ae0 (emitting), spawn 0x8017ac48 (box) / 0x8017ade0 (sphere) /
// 0x8017b010 (ring) + 0x8017a910, the particle step 0x8017b2bc and the draw 0x8017cb28 / 0x8017d0e4.
'use strict';

(function () {
  const VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec4 aCol;
uniform mat4 uVP; varying vec2 vUV; varying vec4 vCol;
void main() { gl_Position = uVP * vec4(aPos, 1.0); vUV = aUV; vCol = aCol; }`;
  const FS = `
precision mediump float;
varying vec2 vUV; varying vec4 vCol; uniform sampler2D uTex; uniform float uHasTex;
void main() { vec4 t = uHasTex > 0.5 ? texture2D(uTex, vUV) : vec4(1.0); gl_FragColor = t * vCol; }`;

  const SCALE = 10;                     // the effect manager's own scale (0x80178278: 10.0 at +676)
  const MAXQ = 6000;

  // rnd(x): -x..x (0x80180990); rnd0(x): 0..x (0x80180a28)
  const rnd = x => x ? (Math.random() * 2 - 1) * x : 0;
  const rnd0 = x => x ? Math.random() * x : 0;
  // (t, v) keys, linear (0x80180800)
  function curve(k, t) {
    if (!k || !k.length) return 1;
    if (t <= k[0][0]) return k[0][1];
    for (let i = 1; i < k.length; i++) if (t <= k[i][0]) {
      const a = k[i - 1], b = k[i], u = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 1;
      return a[1] + (b[1] - a[1]) * u;
    }
    return k[k.length - 1][1];
  }
  // ---- 4x4 helpers (column-major, like stage.js)
  const mul = (a, b) => {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  };
  const pt = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  const dir = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z];
  const qmat = (q, p) => {
    let [x, y, z, w] = q; const n = Math.hypot(x, y, z, w);
    if (n < 1e-6) { x = 0; y = 0; z = 0; w = 1; } else { x /= n; y /= n; z /= n; w /= n; }
    return [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
      2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
      2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0, p[0], p[1], p[2], 1];
  };
  const slerp = (a, b, t) => {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], s = 1;
    if (d < 0) { d = -d; s = -1; }
    if (d > 0.9995) return a.map((v, i) => v + (b[i] * s - v) * t);
    const th = Math.acos(d), k0 = Math.sin((1 - t) * th) / Math.sin(th), k1 = Math.sin(t * th) / Math.sin(th) * s;
    return a.map((v, i) => v * k0 + b[i] * k1);
  };
  // euler (x, y, z) rotation as 3x3 columns, used for the spread cone (0x80180da4)
  const euler = (ax, ay, az) => {
    const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay), cz = Math.cos(az), sz = Math.sin(az);
    return [cy * cz, cy * sz, -sy, sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy, cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy];
  };
  const r3 = (R, v) => [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]];

  // a node's key track at time t -> local matrix, or null when no track runs then (0x8017dc0c)
  function trackAt(tracks, t) {
    for (const tr of tracks || []) {
      const k = tr.keys;
      if (!k.length) continue;
      const t0 = k[0][0], t1 = Math.max(tr.end, k[k.length - 1][0]);
      if (t < t0 || t > t1) continue;
      let i = 0; while (i < k.length - 2 && t >= k[i + 1][0]) i++;
      const a = k[i], b = k[Math.min(i + 1, k.length - 1)], u = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
      let p;
      if (tr.flags >>> 24 && k.length > 2) {         // smooth (Catmull-Rom through the keys)
        const p0 = k[Math.max(0, i - 1)], p3 = k[Math.min(k.length - 1, i + 2)], u2 = u * u, u3 = u2 * u;
        p = [1, 2, 3].map(j => 0.5 * ((2 * a[j]) + (-p0[j] + b[j]) * u + (2 * p0[j] - 5 * a[j] + 4 * b[j] - p3[j]) * u2 + (-p0[j] + 3 * a[j] - 3 * b[j] + p3[j]) * u3));
      } else p = [1, 2, 3].map(j => a[j] + (b[j] - a[j]) * u);
      const qa = a.slice(4, 8), qb = b.slice(4, 8);
      const q = Math.hypot(...qa) < 1e-6 && Math.hypot(...qb) < 1e-6 ? [0, 0, 0, 1] : slerp(qa, qb, u);
      return qmat(q, p);
    }
    return null;
  }
  const trackEnd = tracks => (tracks || []).reduce((m, tr) => Math.max(m, tr.end, tr.keys.length ? tr.keys[tr.keys.length - 1][0] : 0), 0);

  class Fx {
    constructor(gl, fx) {
      this.gl = gl; this.fx = fx; this.live = [];
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = this.prog = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
      this.a = { pos: gl.getAttribLocation(p, 'aPos'), uv: gl.getAttribLocation(p, 'aUV'), col: gl.getAttribLocation(p, 'aCol') };
      this.u = { vp: gl.getUniformLocation(p, 'uVP'), tex: gl.getUniformLocation(p, 'uTex'), has: gl.getUniformLocation(p, 'uHasTex') };
      this.buf = gl.createBuffer();
      this.verts = new Float32Array(MAXQ * 6 * 9);
      this.banks = {};
      for (const [k, b] of Object.entries(fx)) {
        if (!/^bank\d$/.test(k) || !b) continue;
        this.banks[+k.slice(4)] = { effects: b.effects, tex: (b.tex || []).map(png => this.texture(png)) };
      }
    }
    texture(png) {
      const gl = this.gl, t = gl.createTexture(), im = new Image();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      if (!png) return t;
      im.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      };
      im.src = 'data:image/png;base64,' + png;
      return t;
    }
    // play effect `eff` of bank `bank` at the world matrix M (a stage spot); returns the instance
    play(bank, eff, M, opts = {}) {
      const B = this.banks[bank], E = B && B.effects && B.effects[eff];
      if (!E) return null;
      const inst = { bid: bank, B, E, M: M || [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], t: 0, st: E.map(() => ({ timer: null, ps: [], W: null })),
        end: Math.max(...E.map(n => trackEnd(n.keys))), done: false, tag: opts.tag };
      this.live.push(inst);
      return inst;
    }
    // a bank added later (the combo performance's GAME_APL_EFF.bin = bank 3)
    addBank(n, b) { if (b && b.effects && !this.banks[n]) this.banks[n] = { effects: b.effects, tex: (b.tex || []).map(png => this.texture(png)) }; }
    playing(tag) { return this.live.some(i => i.tag === tag && !i.done); }
    clear() { this.live = []; }
    update(dt) {
      if (!(dt > 0)) return;
      dt = Math.min(dt, 0.1);
      for (const inst of this.live) this.step(inst, dt);
      this.live = this.live.filter(i => !i.done);
    }
    step(inst, dt) {
      inst.t += dt;
      const E = inst.E, t = inst.t;
      // node matrices (parent first: node 0 is the root; child = first child, brother = next sibling)
      const W = new Array(E.length).fill(null), act = new Array(E.length).fill(false);
      const root = mul(inst.M, [SCALE, 0, 0, 0, 0, SCALE, 0, 0, 0, 0, SCALE, 0, 0, 0, 0, 1]);
      const visit = (i, P, parAct) => {
        for (let guard = 0; i >= 0 && i < E.length && guard < 64; guard++) {
          const nd = E[i], L = trackAt(nd.keys, t);
          act[i] = parAct && !!L;
          W[i] = L ? mul(P, L) : (inst.st[i].W || P);
          inst.st[i].W = W[i];
          if (nd.child) visit(nd.child, W[i], act[i]);
          i = nd.brother || -1;
        }
      };
      visit(0, root, true);
      let alive = false;
      E.forEach((nd, i) => {
        if (nd.type !== 1 || !nd.emit) return;
        const s = inst.st[i], em = nd.emit;
        // emitting (0x80179ae0): every `interval` seconds a burst, while the node's track runs
        if (act[i]) {
          if (s.timer === null) s.timer = em.interval;
          s.timer += dt;
          let guard = 0;
          while (s.timer >= em.interval && guard++ < 64) {
            for (let b = 0; b < Math.max(1, em.burst); b++) if (s.ps.length < Math.max(1, em.max)) s.ps.push(this.spawn(nd, W[i], s.timer - em.interval));
            if (em.interval <= 0) { s.timer = 0; break; }
            s.timer -= em.interval;
          }
        }
        // particles age; at the end of their life they die (or start again, flag 0x800)
        for (const p of s.ps) {
          p.age += dt;
          if (p.age >= p.life) { if (nd.flags & 0x800) p.age = 0; else p.dead = true; }
        }
        s.ps = s.ps.filter(p => !p.dead);
        if (nd.flags & 0x80) for (const p of s.ps) p.W = W[i];            // they move with the emitter
        if (s.ps.length) alive = true;
      });
      if (t > inst.end && !alive) inst.done = true;
    }
    spawn(nd, W, age0) {
      const em = nd.emit, lk = nd.look || {}, p = { age: Math.max(0, age0 || 0), W, tz: this.travelZ || 0 };
      p.life = Math.max(0.0001, em.life + rnd(em.lifeVar));
      p.speed = em.speed + rnd(em.speedVar);
      // where it starts and which way it goes
      if (nd.shape === 1 && nd.sphere) {                       // sphere (0x8017ade0)
        const R = euler(rnd(Math.PI * 2), rnd(Math.PI * 2), rnd(Math.PI * 2)), r = nd.sphere.r;
        const up = [R[3], R[4], R[5]];
        p.p0 = nd.sphere.flags & 1 ? [up[0] * r[0], up[1] * r[1], up[2] * r[2]] : [up[0] * rnd(r[0]), up[1] * rnd(r[1]), up[2] * rnd(r[2])];
        const l = Math.hypot(...p.p0) || 1;
        p.dir = nd.sphere.flags & 4 ? p.p0.map(v => v / l) : r3(euler(rnd(em.cone[0]), rnd(em.cone[1]), rnd(em.cone[2])), [0, 1, 0]);
      } else if (nd.shape === 2 && nd.ring) {                  // ring (0x8017b010)
        const a = rnd(Math.PI * 2), r = nd.ring.r, f = nd.ring.flags;
        p.p0 = f & 8 ? [Math.cos(a) * r[0], Math.sin(a) * r[1], 0] : f & 0x10 ? [0, Math.cos(a) * r[0], Math.sin(a) * r[1]] : [Math.cos(a) * r[0], 0, Math.sin(a) * r[1]];
        const l = Math.hypot(...p.p0) || 1;
        p.dir = f & 4 ? p.p0.map(v => v / l) : r3(euler(rnd(em.cone[0]), rnd(em.cone[1]), rnd(em.cone[2])), [0, 1, 0]);
      } else {                                                  // box (0x8017ac48)
        p.p0 = [rnd(em.box[0]), rnd(em.box[1]), rnd(em.box[2])];
        p.dir = r3(euler(rnd(em.cone[0]), rnd(em.cone[1]), rnd(em.cone[2])), [0, 1, 0]);
      }
      if (nd.accel) {
        const a = nd.accel;
        p.acc = r3(euler(rnd(a.angVar[0]), rnd(a.angVar[1]), rnd(a.angVar[2])), a.dir);
        p.accV = a.v + rnd(a.var);
      }
      if (nd.rot) {
        const r = nd.rot;
        p.a0 = r[0] + rnd(r[1]); p.spin = r[2] + rnd(r[3]); p.spinA = r[4] + rnd(r[5]);
      }
      // a random size (percent range, 0x8017a910)
      p.k = 1;
      if (lk.rndLo || lk.rndHi) p.k = 1 - rnd0((100 - lk.rndLo) / 100) + rnd0((lk.rndHi - 100) / 100);
      if (nd.scale && nd.flags & 0x100) { p.speed *= nd.scale[1]; p.k *= nd.scale[1]; }
      return p;
    }
    // world position of a particle now (0x8017b2bc)
    where(nd, p) {
      const a = p.age, L = p.p0.slice();
      for (let j = 0; j < 3; j++) L[j] += p.dir[j] * p.speed * a;
      if (p.acc) for (let j = 0; j < 3; j++) L[j] += p.acc[j] * p.accV * a * a * 0.5;
      if (nd.rot && nd.flags & 0x20 && (nd.rot[6] || nd.rot[7])) {     // turning round the emitter's up axis
        const ang = nd.rot[6] * a + nd.rot[7] * a * a * 0.5, c = Math.cos(ang), s = Math.sin(ang);
        const x = L[0] * c + L[2] * s, z = -L[0] * s + L[2] * c; L[0] = x; L[2] = z;
      }
      const P = pt(p.W, L[0], L[1], L[2]);
      // (the stage travels on while a particle stays where it was emitted - the boss stage's trails;
      // particles that move with their emitter, flag 0x80, travel along)
      if (!(nd.flags & 0x80) && this.travelZ) P[2] -= this.travelZ - (p.tz || 0);
      return P;
    }
    draw(VP, V) {
      if (!this.live.length) return;
      const gl = this.gl;
      const R = [V[0], V[4], V[8]], U = [V[1], V[5], V[9]];
      // the game draws the blended effects first, then the added (glowing) ones
      const batches = new Map();
      for (const inst of this.live) inst.E.forEach((nd, i) => {
        if (nd.type !== 1 || !nd.look) return;
        const ps = inst.st[i].ps;
        if (!ps.length) return;
        const key = inst.bid + ':' + (nd.look.blend === 2 ? 1 : 0) + ':' + (nd.flags & 0x200 ? 1 : 0) + ':' + nd.look.tex;
        let b = batches.get(key);
        if (!b) batches.set(key, b = { add: nd.look.blend === 2, noZ: !!(nd.flags & 0x200), tex: nd.look.tex, B: inst.B, list: [] });
        for (const p of ps) b.list.push([nd, p]);
      });
      gl.useProgram(this.prog);
      gl.uniformMatrix4fv(this.u.vp, false, new Float32Array(VP));
      gl.uniform1i(this.u.tex, 0);
      gl.enable(gl.BLEND); gl.depthMask(false); gl.depthFunc(gl.LEQUAL);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      const order = [...batches.values()].sort((a, b) => a.add - b.add);
      for (const b of order) {
        let n = 0;
        const v = this.verts;
        for (const [nd, p] of b.list) {
          if (n >= MAXQ) break;
          const lk = nd.look, t = Math.min(1, p.age / p.life), em = nd.emit;
          const c = curve(lk.sizeCurve, t);
          const sx = (lk.size0[0] + (lk.size1[0] - lk.size0[0]) * c) * p.k, sy = (lk.size0[1] + (lk.size1[1] - lk.size0[1]) * c) * p.k;
          const sc = Math.hypot(p.W[0], p.W[1], p.W[2]);           // the emitter's scale (x10 and the spot's)
          const hx = sx * sc * 0.5, hy = sy * sc * 0.5;
          // colour: keys over the life (in percent), or the palette; alpha from the alpha curve
          let col, al = curve(lk.alphaCurve, t);
          if (lk.colorKeys && lk.colorKeys.length) {
            const pc = t * 100, k = lk.colorKeys;
            let i = 0; while (i < k.length - 2 && pc > k[i + 1][0]) i++;
            const A = k[i], B2 = k[Math.min(i + 1, k.length - 1)], u = B2[0] > A[0] ? Math.min(1, Math.max(0, (pc - A[0]) / (B2[0] - A[0]))) : 0;
            col = [1, 2, 3].map(j => (A[j] + (B2[j] - A[j]) * u) / 255);
          } else {
            const pl = (lk.palette && lk.palette[0]) || [255, 255, 255, 255];
            col = [pl[0] / 255, pl[1] / 255, pl[2] / 255]; al *= pl[3] / 255;
          }
          if (al <= 0.002) continue;
          // the picture: a cell of an animated sheet (0x8017be20)
          let u0 = 0, v0 = 0, us = 1, vs = 1;
          if (lk.cells && lk.cells.count) {
            const cols = Math.max(1, Math.round(lk.cells.texW / Math.max(1, lk.cells.cellW)));
            const f = Math.floor(p.age / Math.max(0.001, lk.cells.time)) % lk.cells.count;
            us = vs = 1 / cols; u0 = (f % cols) * us; v0 = Math.floor(f / cols) * vs;
          }
          const ctr = this.where(nd, p);
          let ax, ay;
          if (em.bill === 0) {                                    // facing the camera
            const ang = p.a0 !== undefined ? p.a0 + p.spin * p.age + p.spinA * p.age * p.age * 0.5 : 0, cs = Math.cos(ang), sn = Math.sin(ang);
            ax = [0, 1, 2].map(j => (R[j] * cs + U[j] * sn) * hx);
            ay = [0, 1, 2].map(j => (-R[j] * sn + U[j] * cs) * hy);
          } else {                                                // lying in the emitter's own plane
            const X = dir(p.W, 1, 0, 0), Y = dir(p.W, 0, 1, 0), lx = Math.hypot(...X) || 1, ly = Math.hypot(...Y) || 1;
            ax = X.map(q => q / lx * hx); ay = Y.map(q => q / ly * hy);
          }
          const corner = (sxn, syn, uu, vv, o) => {
            v[o] = ctr[0] + ax[0] * sxn + ay[0] * syn; v[o + 1] = ctr[1] + ax[1] * sxn + ay[1] * syn; v[o + 2] = ctr[2] + ax[2] * sxn + ay[2] * syn;
            v[o + 3] = uu; v[o + 4] = vv; v[o + 5] = col[0]; v[o + 6] = col[1]; v[o + 7] = col[2]; v[o + 8] = al;
          };
          const o = n * 54;
          corner(-1, 1, u0, v0, o); corner(1, 1, u0 + us, v0, o + 9); corner(1, -1, u0 + us, v0 + vs, o + 18);
          corner(-1, 1, u0, v0, o + 27); corner(1, -1, u0 + us, v0 + vs, o + 36); corner(-1, -1, u0, v0 + vs, o + 45);
          n++;
        }
        if (!n) continue;
        gl.bufferData(gl.ARRAY_BUFFER, v.subarray(0, n * 54), gl.DYNAMIC_DRAW);
        const st = 36;
        gl.enableVertexAttribArray(this.a.pos); gl.vertexAttribPointer(this.a.pos, 3, gl.FLOAT, false, st, 0);
        gl.enableVertexAttribArray(this.a.uv); gl.vertexAttribPointer(this.a.uv, 2, gl.FLOAT, false, st, 12);
        gl.enableVertexAttribArray(this.a.col); gl.vertexAttribPointer(this.a.col, 4, gl.FLOAT, false, st, 20);
        const tex = b.tex >= 0 ? b.B.tex[b.tex] : null;
        gl.activeTexture(gl.TEXTURE0);
        if (tex) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1f(this.u.has, 1); } else gl.uniform1f(this.u.has, 0);
        gl.blendFunc(gl.SRC_ALPHA, b.add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
        if (b.noZ) gl.disable(gl.DEPTH_TEST); else gl.enable(gl.DEPTH_TEST);
        gl.drawArrays(gl.TRIANGLES, 0, n * 6);
      }
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
      gl.disableVertexAttribArray(this.a.col); gl.disableVertexAttribArray(this.a.uv);
    }
  }

  window.TebFx = { create: (gl, fx) => new Fx(gl, fx), _test: { curve, trackAt } };
})();
