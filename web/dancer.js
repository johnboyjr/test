// Dancers: an original built-in dancer, or your own .glb/.gltf model, performing the dance moves
// from the game's dance files (one-measure clips, 36 frames per beat) in time with the song.
'use strict';

(function () {
  // ------------------------------------------------------------------ small math (quats are [x,y,z,w])
  const V = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  };
  const Q = {
    id: () => [0, 0, 0, 1],
    mul(a, b) {
      return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
              a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
              a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
              a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
    },
    inv: q => [-q[0], -q[1], -q[2], q[3]],
    rot(q, v) {
      const u = [q[0], q[1], q[2]], s = q[3];
      const t = V.mul(V.cross(u, v), 2);
      return V.add(V.add(v, V.mul(t, s)), V.cross(u, t));
    },
    norm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; },
    slerp(a, b, t) {
      let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
      if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
      if (d > 0.9995) return Q.norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);
      const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
      return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
    },
    fromTo(a, b) {
      a = V.norm(a); b = V.norm(b);
      const d = V.dot(a, b);
      if (d < -0.9999) { let ax = V.cross([1, 0, 0], a); if (V.len(ax) < 1e-3) ax = V.cross([0, 1, 0], a); ax = V.norm(ax); return [ax[0], ax[1], ax[2], 0]; }
      const c = V.cross(a, b);
      return Q.norm([c[0], c[1], c[2], 1 + d]);
    },
    axisAngle(ax, ang) { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; },
    fromBasis(x, y, z) {            // rotation whose columns are x, y, z
      const m00 = x[0], m10 = x[1], m20 = x[2], m01 = y[0], m11 = y[1], m21 = y[2], m02 = z[0], m12 = z[1], m22 = z[2];
      const tr = m00 + m11 + m22;
      let q;
      if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]; }
      else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
      else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
      else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
      return Q.norm(q);
    },
  };
  // 4x4 column-major
  const M = {
    id: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
      return o;
    },
    trs(t, q, s) {
      const [x, y, z, w] = q, sx = s ? s[0] : 1, sy = s ? s[1] : 1, sz = s ? s[2] : 1;
      return new Float32Array([
        (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
        (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
        (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
        t[0], t[1], t[2], 1]);
    },
    persp(fov, asp, n, f) {
      const t = 1 / Math.tan(fov / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
      return o;
    },
    lookAt(e, c, up) {
      const z = V.norm(V.sub(e, c)), x = V.norm(V.cross(up, z)), y = V.cross(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
                               -V.dot(x, e), -V.dot(y, e), -V.dot(z, e), 1]);
    },
    invert(m) {
      const inv = new Float32Array(16);
      inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
      inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
      inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
      inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
      inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
      inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
      inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
      inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
      inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
      inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
      inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
      inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
      inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
      inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
      inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
      inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
      let det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
      det = det ? 1 / det : 0;
      for (let i = 0; i < 16; i++) inv[i] *= det;
      return inv;
    },
    pos: m => [m[12], m[13], m[14]],
    rotq(m) {
      const x = V.norm([m[0], m[1], m[2]]), y = V.norm([m[4], m[5], m[6]]), z = V.norm([m[8], m[9], m[10]]);
      return Q.fromBasis(x, y, z);
    },
  };

  // ------------------------------------------------------------------ the dance skeleton
  // A standard humanoid hierarchy using the bone names in the dance files. Joint directions come from
  // the dance files; the built-in dancer's proportions are its own.
  const PARENT = {
    Hips: null, Spine: 'Hips', Spine1: 'Spine', Neck: 'Spine1', Head: 'Neck',
    LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg', LeftToeBase: 'LeftFoot',
    RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg', RightToeBase: 'RightFoot',
  };
  for (const s of ['Left', 'Right']) {
    Object.assign(PARENT, { [s + 'Collar']: 'Spine1', [s + 'Arm']: s + 'Collar', [s + 'ForeArm']: s + 'Arm', [s + 'Hand']: s + 'ForeArm' });
    for (const f of ['Thumb', 'Index', 'Middle', 'Ring']) Object.assign(PARENT, { [`${s}Hand${f}1`]: s + 'Hand', [`${s}Hand${f}2`]: `${s}Hand${f}1` });
  }
  const ORDER = []; (function walk(p) { for (const b in PARENT) if (PARENT[b] === p) { ORDER.push(b); walk(b); } })(null);
  // the built-in dancer's bone lengths (hip height about 8 units)
  const LEN = {
    Spine: 0.95, Spine1: 1.25, Neck: 1.45, Head: 0.75,
    LeftUpLeg: 0.85, LeftLeg: 3.75, LeftFoot: 3.7, LeftToeBase: 1.15,
    LeftCollar: 1.15, LeftArm: 0.75, LeftForeArm: 1.95, LeftHand: 1.85,
    LeftHandThumb1: 0.3, LeftHandThumb2: 0.4, LeftHandIndex1: 0.85, LeftHandIndex2: 0.4,
    LeftHandMiddle1: 0.9, LeftHandMiddle2: 0.42, LeftHandRing1: 0.85, LeftHandRing2: 0.38,
  };
  for (const k of Object.keys(LEN)) if (k.startsWith('Left')) LEN['Right' + k.slice(4)] = LEN[k];
  const HIP_H = 8.0;

  // ------------------------------------------------------------------ choreography
  function sampleTrack(arr, stride, f) {
    const n = arr.length / stride;
    if (!n) return null;
    if (f <= arr[0] || n === 1) return arr.slice(1, stride);
    if (f >= arr[(n - 1) * stride]) return arr.slice((n - 1) * stride + 1, n * stride);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m * stride] <= f) lo = m; else hi = m; }
    const f0 = arr[lo * stride], f1 = arr[hi * stride], t = (f - f0) / ((f1 - f0) || 1);
    const a = arr.slice(lo * stride + 1, lo * stride + stride), b = arr.slice(hi * stride + 1, hi * stride + stride);
    if (stride === 5) return Q.slerp(a, b, t);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  class Choreo {
    constructor(data, seed) {
      this.d = data; this.fpb = data.framesPerBeat || 36;
      // the order the loop parts play in (the game picks them at random; this is fixed per song)
      let s = (seed || 1) >>> 0;
      this.rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      this.loops = [];
      // joint directions in each parent's space, from the dance data
      const c0 = data.S[0] || data.L[0][0];
      this.dir = {};
      for (const b of ORDER) if (b !== 'Hips' && c0[b] && c0[b].p) this.dir[b] = V.norm(c0[b].p.slice(1, 4));
      // facing and height reference from the first pose
      this.ref = null;
      this.ref = this.solve(this.local(0, 1e9), true);
    }
    clipFor(measure, endMeasure) {
      const d = this.d;
      if (measure >= endMeasure && d.E.length) return d.E[Math.min(d.E.length - 1, measure - endMeasure)];
      if (measure < d.S.length) return d.S[measure];
      let m = measure - d.S.length;
      while (true) {
        if (!this.loops.length || m >= this.loopsLen()) {
          if (this.loops.length > 4000) return d.L[0][0];
          const part = d.L[Math.floor(this.rand() * d.L.length)];
          this.loops.push(part);
          continue;
        }
        for (const part of this.loops) { if (m < part.length) return part[m]; m -= part.length; }
      }
    }
    loopsLen() { return this.loops.reduce((n, p) => n + p.length, 0); }
    // beat -> {rot: {bone: q}, hips: [x,y,z]}
    local(beat, endBeat) {
      const fpm = this.fpb * 4;
      const b = Math.max(0, beat);
      const measure = Math.floor(b / 4), endMeasure = Math.floor(endBeat / 4) + 1;
      let f = (b - measure * 4) * this.fpb;
      if (measure >= endMeasure + this.d.E.length) f = fpm - 1;
      const clip = this.clipFor(measure, endMeasure);
      const rot = {};
      for (const bn of ORDER) {
        const tr = clip[bn];
        rot[bn] = tr && tr.r ? sampleTrack(tr.r, 5, f) : Q.id();
      }
      const hp = clip.Hips && clip.Hips.p ? sampleTrack(clip.Hips.p, 4, f) : [0, 8, 0];
      return { rot, hips: hp };
    }
    // world pose of the dance skeleton, turned to face the camera (+Z), feet near y = 0
    solve(loc, raw) {
      const wq = {}, wp = {};
      for (const b of ORDER) {
        if (b === 'Hips') { wq[b] = loc.rot.Hips; wp[b] = loc.hips.slice(); continue; }
        const p = PARENT[b], d = this.dir[b] || [1, 0, 0];
        wp[b] = V.add(wp[p], Q.rot(wq[p], V.mul(d, LEN[b] || 0.5)));
        wq[b] = Q.mul(wq[p], loc.rot[b]);
      }
      if (raw) {
        const lat = V.sub(wp.LeftUpLeg, wp.RightUpLeg);
        const fwd = V.norm([lat[2] * 1, 0, -lat[0]]);      // cross(lateral, up) on the floor
        const yaw = Math.atan2(fwd[0], fwd[2]);
        return { yaw: Q.axisAngle([0, 1, 0], -yaw), hx: loc.hips[0], hz: loc.hips[2], hy: loc.hips[1] };
      }
      const r = this.ref, out = { q: {}, p: {} };
      const lim = (v, m) => m * Math.tanh(v / m);
      const hipsAt = [lim((loc.hips[0] - r.hx) * 0.35, 2.2), HIP_H + (loc.hips[1] - r.hy) * 0.9, lim((loc.hips[2] - r.hz) * 0.35, 2.5)];
      for (const b of ORDER) {
        out.q[b] = Q.mul(r.yaw, wq[b]);
        out.p[b] = V.add(Q.rot(r.yaw, V.sub(wp[b], wp.Hips)), Q.rot(r.yaw, hipsAt));
      }
      out.p.Hips = Q.rot(r.yaw, hipsAt);
      return out;
    }
    pose(beat, endBeat) { return this.solve(this.local(beat, endBeat)); }
  }

  // ------------------------------------------------------------------ GL
  const VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUV; attribute vec4 aJ; attribute vec4 aW;
uniform mat4 uVP; uniform mat4 uModel; uniform mat4 uJ[MAXJ]; uniform float uSkin;
varying vec3 vN; varying vec2 vUV; varying vec3 vP;
void main() {
  mat4 m = uModel;
  if (uSkin > 0.5) m = uModel * (uJ[int(aJ.x)] * aW.x + uJ[int(aJ.y)] * aW.y + uJ[int(aJ.z)] * aW.z + uJ[int(aJ.w)] * aW.w);
  vec4 w = m * vec4(aPos, 1.0);
  vN = mat3(m) * aNrm; vUV = aUV; vP = w.xyz;
  gl_Position = uVP * w;
}`;
  const FS = `
precision mediump float;
varying vec3 vN; varying vec2 vUV; varying vec3 vP;
uniform vec4 uColor; uniform sampler2D uTex; uniform float uHasTex; uniform float uGlow; uniform float uCut; uniform vec3 uEye;
void main() {
  vec4 c = uColor;
  if (uHasTex > 0.5) c *= texture2D(uTex, vUV);
  if (c.a < uCut) discard;
  vec3 n = normalize(vN);
  vec3 L1 = normalize(vec3(0.4, 0.9, 0.7)), L2 = normalize(vec3(-0.7, 0.2, -0.4));
  float d = max(dot(n, L1), 0.0) * 0.75 + max(dot(n, L2), 0.0) * 0.25;
  vec3 v = normalize(uEye - vP);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 col = c.rgb * (0.38 + d) + vec3(0.45, 0.8, 1.0) * rim * 0.35;
  col = mix(col, c.rgb * 1.25, uGlow);
  gl_FragColor = vec4(col, c.a);
}`;

  class Renderer {
    constructor(w, h) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = w; this.canvas.height = h;
      const gl = this.gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: true });
      if (!gl) throw new Error('WebGL is not available');
      this.maxJ = Math.max(8, Math.min(200, Math.floor((gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) - 24) / 4)));
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = this.prog = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS.replace('MAXJ', this.maxJ)));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      gl.useProgram(p);
      this.a = {}; for (const n of ['aPos', 'aNrm', 'aUV', 'aJ', 'aW']) this.a[n] = gl.getAttribLocation(p, n);
      this.u = {}; for (const n of ['uVP', 'uModel', 'uJ', 'uSkin', 'uColor', 'uTex', 'uHasTex', 'uGlow', 'uCut', 'uEye']) this.u[n] = gl.getUniformLocation(p, n);
      gl.enable(gl.DEPTH_TEST);
      this.white = this.texture(null);
    }
    buffer(data, target) {
      const gl = this.gl, b = gl.createBuffer();
      gl.bindBuffer(target || gl.ARRAY_BUFFER, b); gl.bufferData(target || gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return b;
    }
    texture(img) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (img) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        const pot = v => (v & (v - 1)) === 0;
        if (pot(img.width) && pot(img.height)) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
        else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
      } else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      return t;
    }
    begin(camY, dist, lookY) {
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const eye = [0, camY, dist];
      this.vp = M.mul(M.persp(0.52, this.canvas.width / this.canvas.height, 1, 200), M.lookAt(eye, [0, lookY, 0], [0, 1, 0]));
      gl.useProgram(this.prog);
      gl.uniformMatrix4fv(this.u.uVP, false, this.vp);
      gl.uniform3fv(this.u.uEye, eye);
    }
    // mesh: {pos, nrm, uv?, j?, w?, idx (Uint16/32), count, type}
    draw(mesh, model, mat, joints) {
      const gl = this.gl, a = this.a;
      const bind = (loc, buf, size, type, norm) => {
        if (loc < 0) return;
        if (!buf) { gl.disableVertexAttribArray(loc); return; }
        gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type || gl.FLOAT, !!norm, 0, 0);
      };
      bind(a.aPos, mesh.pos, 3); bind(a.aNrm, mesh.nrm, 3);
      if (mesh.uv) bind(a.aUV, mesh.uv, 2); else { if (a.aUV >= 0) { gl.disableVertexAttribArray(a.aUV); gl.vertexAttrib2f(a.aUV, 0, 0); } }
      if (mesh.j && joints) { bind(a.aJ, mesh.j, 4); bind(a.aW, mesh.w, 4); }
      else { if (a.aJ >= 0) { gl.disableVertexAttribArray(a.aJ); gl.vertexAttrib4f(a.aJ, 0, 0, 0, 0); } if (a.aW >= 0) { gl.disableVertexAttribArray(a.aW); gl.vertexAttrib4f(a.aW, 1, 0, 0, 0); } }
      gl.uniformMatrix4fv(this.u.uModel, false, model);
      gl.uniform1f(this.u.uSkin, mesh.j && joints ? 1 : 0);
      if (mesh.j && joints) gl.uniformMatrix4fv(this.u.uJ, false, joints);
      gl.uniform4fv(this.u.uColor, mat.color || [1, 1, 1, 1]);
      gl.uniform1f(this.u.uGlow, mat.glow || 0);
      gl.uniform1f(this.u.uCut, mat.cut === undefined ? 0.02 : mat.cut);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mat.tex || this.white);
      gl.uniform1i(this.u.uTex, 0); gl.uniform1f(this.u.uHasTex, mat.tex ? 1 : 0);
      if (mat.blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); } else gl.disable(gl.BLEND);
      if (mat.doubleSided) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idx);
      gl.drawElements(gl.TRIANGLES, mesh.count, mesh.type || gl.UNSIGNED_SHORT, 0);
    }
  }

  // ------------------------------------------------------------------ the built-in dancer (an original design)
  // Our own look (not the game's dancer): a graphite body with amber joints, a magenta visor and white sneakers.
  function ellipsoid(rx, ry, rz, seg = 14) {
    const pos = [], nrm = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const v = i / seg * Math.PI;
      for (let j = 0; j <= seg; j++) {
        const u = j / seg * Math.PI * 2;
        const n = [Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)];
        pos.push(n[0] * rx, n[1] * ry, n[2] * rz);
        nrm.push(...V.norm([n[0] / rx, n[1] / ry, n[2] / rz]));
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + seg + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    return { pos, nrm, idx };
  }
  // capsule from (0,0,0) to `to`, radius r0 at the start and r1 at the end
  function capsule(to, r0, r1, seg = 12) {
    const L = V.len(to), pos = [], nrm = [], idx = [];
    const rings = [];
    const cap = 4;
    for (let i = 0; i <= cap; i++) { const a = -Math.PI / 2 + i / cap * Math.PI / 2; rings.push([r0 * Math.sin(a), r0 * Math.cos(a), Math.sin(a)]); }
    for (let i = 0; i <= cap; i++) { const a = i / cap * Math.PI / 2; rings.push([L + r1 * Math.sin(a), r1 * Math.cos(a), Math.sin(a)]); }
    for (const [x, r, ny] of rings) for (let j = 0; j <= seg; j++) {
      const u = j / seg * Math.PI * 2, c = Math.cos(u), s = Math.sin(u);
      const nl = Math.sqrt(Math.max(0, 1 - ny * ny));
      pos.push(x, r * c, r * s); nrm.push(ny, nl * c, nl * s);
    }
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = i * (seg + 1) + j, b = a + seg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    // rotate +X onto the bone direction
    const q = Q.fromTo([1, 0, 0], to);
    for (let k = 0; k < pos.length; k += 3) {
      const p = Q.rot(q, [pos[k], pos[k + 1], pos[k + 2]]), n = Q.rot(q, [nrm[k], nrm[k + 1], nrm[k + 2]]);
      pos[k] = p[0]; pos[k + 1] = p[1]; pos[k + 2] = p[2]; nrm[k] = n[0]; nrm[k + 1] = n[1]; nrm[k + 2] = n[2];
    }
    return { pos, nrm, idx };
  }
  const C = { shell: [0.24, 0.25, 0.31, 1], joint: [1.0, 0.68, 0.16, 1], visor: [1.0, 0.25, 0.75, 1], shoe: [0.96, 0.96, 0.98, 1], sole: [1.0, 0.3, 0.6, 1], trim: [1.0, 0.68, 0.16, 1] };

  class BuiltIn {
    constructor(R, dirs) {
      this.R = R;
      const parts = [], gl = R.gl;
      const add = (bone, geo, color, local, glow) => {
        const mesh = { pos: R.buffer(new Float32Array(geo.pos)), nrm: R.buffer(new Float32Array(geo.nrm)),
                       idx: R.buffer(new Uint16Array(geo.idx), gl.ELEMENT_ARRAY_BUFFER), count: geo.idx.length };
        parts.push({ bone, mesh, mat: { color, glow: glow || 0 }, local: local || M.id() });
      };
      const off = b => V.mul(dirs[b] || [1, 0, 0], LEN[b] || 0.5);          // child joint in its parent's space
      const seg = (bone, child, r0, r1, color) => add(bone, capsule(off(child), r0, r1), color);
      // torso
      const sp = off('Spine'), s1 = off('Spine1');
      add('Hips', ellipsoid(1.05, 0.75, 0.8), C.joint, M.trs(V.mul(sp, 0.35), Q.id()));
      seg('Spine', 'Spine1', 0.62, 0.75, C.shell);
      add('Spine1', ellipsoid(1.0, 1.25, 0.75), C.shell, M.trs(V.mul(off('Neck'), 0.42), Q.fromTo([0, 1, 0], off('Neck'))));
      add('Spine1', ellipsoid(0.55, 0.12, 0.62), C.trim, M.trs(V.mul(off('Neck'), 0.1), Q.fromTo([0, 1, 0], off('Neck'))), 0.5);
      seg('Neck', 'Head', 0.24, 0.26, C.joint);
      // head: a smooth helmet with a visor band
      // the head bone points along its own +X (bones in the dance files run along their local X)
      const hd = [1, 0, 0];
      add('Head', ellipsoid(0.82, 1.0, 0.85), C.shell, M.trs(V.mul(hd, 0.75), Q.fromTo([0, 1, 0], hd)));
      // visor sits on the face side; worked out from the pose at load (see faceDir)
      this.visorPart = parts.length;
      add('Head', ellipsoid(0.86, 0.26, 0.9), C.visor, M.id(), 0.85);
      for (const s of ['Left', 'Right']) {
        add(s + 'UpLeg', ellipsoid(0.5, 0.5, 0.5), C.joint);
        seg(s + 'UpLeg', s + 'Leg', 0.62, 0.48, C.shell);
        add(s + 'Leg', ellipsoid(0.42, 0.42, 0.42), C.joint);
        seg(s + 'Leg', s + 'Foot', 0.45, 0.33, C.shell);
        seg(s + 'Foot', s + 'ToeBase', 0.48, 0.4, C.shoe);
        add(s + 'Foot', ellipsoid(0.5, 0.5, 0.5), C.sole);
        seg(s + 'ToeBase', s + 'ToeBase', 0.38, 0.38, C.shoe);
        seg(s + 'Collar', s + 'Arm', 0.36, 0.36, C.shell);
        add(s + 'Arm', ellipsoid(0.46, 0.46, 0.46), C.trim, null, 0.3);
        seg(s + 'Arm', s + 'ForeArm', 0.36, 0.3, C.shell);
        add(s + 'ForeArm', ellipsoid(0.3, 0.3, 0.3), C.joint);
        seg(s + 'ForeArm', s + 'Hand', 0.3, 0.24, C.shell);
        add(s + 'Hand', ellipsoid(0.3, 0.3, 0.3), C.joint);
        seg(s + 'Hand', s + 'HandMiddle1', 0.22, 0.24, C.joint);
        for (const f of ['Thumb', 'Index', 'Middle', 'Ring']) seg(`${s}Hand${f}1`, `${s}Hand${f}2`, 0.11, 0.1, C.joint);
      }
      this.parts = parts;
    }
    // put the visor on the front of the head (the side facing the camera in the first pose)
    fitVisor(pose) {
      const up = [1, 0, 0];
      let fwd = Q.rot(Q.inv(pose.q.Head), [0, 0, 1]);              // camera side in the first pose
      fwd = V.norm(V.sub(fwd, V.mul(up, V.dot(fwd, up))));
      const hd = this.parts[this.visorPart - 1].local, c = [hd[12], hd[13], hd[14]];
      const at = V.add(V.add(c, V.mul(fwd, 0.16)), V.mul(up, 0.1));
      // thin axis (y) along the head's up, long axes around it: a band across the eyes
      const x = V.norm(V.cross(up, fwd));
      this.parts[this.visorPart].local = M.trs(at, Q.fromBasis(x, up, V.cross(x, up)));
    }
    draw(pose, scale, offX) {
      const R = this.R;
      for (const pt of this.parts) {
        const q = pose.q[pt.bone], p = pose.p[pt.bone];
        if (!q) continue;
        const world = M.mul(M.trs([p[0] * scale + offX, p[1] * scale, p[2] * scale], q, [scale, scale, scale]), pt.local);
        R.draw(pt.mesh, world, pt.mat);
      }
    }
  }

  // ------------------------------------------------------------------ your own model (.glb / .gltf)
  // Bone names are matched loosely: Mixamo ("mixamorig:LeftArm"), VRoid ("J_Bip_L_UpperArm"),
  // Unreal-style ("upperarm_l") and plain names all work.
  const ALIASES = {
    Hips: ['hips', 'pelvis', 'chips', 'root_hips'],
    Spine: ['spine', 'cspine', 'spine01', 'spine_01'],
    Spine1: ['spine2', 'chest', 'cchest', 'upperchest', 'cupperchest', 'spine1', 'spine02', 'spine03'],
    Neck: ['neck', 'cneck', 'neck01'],
    Head: ['head', 'chead'],
  };
  const SIDE = {
    Collar: ['shoulder', 'clavicle', 'collar'],
    Arm: ['arm', 'upperarm'],
    ForeArm: ['forearm', 'lowerarm'],
    Hand: ['hand'],
    HandMiddle1: ['handmiddle1', 'middle1', 'middleproximal'],
    UpLeg: ['upleg', 'upperleg', 'thigh'],
    Leg: ['leg', 'lowerleg', 'calf', 'shin'],
    Foot: ['foot'],
    ToeBase: ['toebase', 'toes', 'toe', 'ball'],
  };
  function normName(n) {
    return n.toLowerCase().replace(/^mixamorig\d*[:_]?/, '').replace(/^j_bip_/, '').replace(/^(bip01|bip001|armature)[ _]?/, '').replace(/[^a-z0-9]/g, '');
  }
  function sideNames(side, parts) {
    const s = side === 'Left' ? 'left' : 'right', c = side[0].toLowerCase(), out = [];
    for (const p of parts) out.push(s + p, c + p, p + c, p + s, s + '' + p);
    return out;
  }
  function mapBones(names) {
    const norm = names.map(normName), map = {};
    const find = list => { for (const a of list) { const i = norm.indexOf(a); if (i >= 0) return i; } return -1; };
    for (const k in ALIASES) { const i = find(ALIASES[k]); if (i >= 0) map[k] = i; }
    for (const side of ['Left', 'Right']) for (const k in SIDE) {
      const i = find(sideNames(side, SIDE[k]));
      if (i >= 0) map[side + k] = i;
    }
    return map;
  }

  async function loadGLTF(R, buf, fetchUri) {
    const dv = new DataView(buf);
    let json, bin = null;
    if (dv.getUint32(0, true) === 0x46546C67) {        // 'glTF' binary
      let o = 12;
      while (o < buf.byteLength) {
        const len = dv.getUint32(o, true), type = dv.getUint32(o + 4, true);
        if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, o + 8, len)));
        else if (type === 0x004E4942) bin = buf.slice(o + 8, o + 8 + len);
        o += 8 + len;
      }
    } else json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf)));
    const buffers = await Promise.all((json.buffers || []).map(async (b, i) => {
      if (!b.uri) return bin;
      if (b.uri.startsWith('data:')) return (await fetch(b.uri)).arrayBuffer();
      return fetchUri(b.uri);
    }));
    const view = bvI => { const bv = json.bufferViews[bvI]; return { buf: buffers[bv.buffer], off: bv.byteOffset || 0, len: bv.byteLength, stride: bv.byteStride || 0 }; };
    const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    const accessor = i => {
      const a = json.accessors[i], n = NC[a.type], count = a.count;
      const T = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[a.componentType];
      const out = new Float32Array(count * n);
      if (a.bufferView === undefined) return out;
      const v = view(a.bufferView), es = T.BYTES_PER_ELEMENT, stride = v.stride || es * n;
      const base = v.off + (a.byteOffset || 0);
      const dvv = new DataView(v.buf);
      const rd = { 5120: o => dvv.getInt8(o), 5121: o => dvv.getUint8(o), 5122: o => dvv.getInt16(o, true), 5123: o => dvv.getUint16(o, true),
                   5125: o => dvv.getUint32(o, true), 5126: o => dvv.getFloat32(o, true) }[a.componentType];
      const normDiv = a.normalized ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType] || 1 : 1;
      for (let k = 0; k < count; k++) for (let c = 0; c < n; c++) out[k * n + c] = rd(base + k * stride + c * es) / normDiv;
      return out;
    };
    // textures
    const images = await Promise.all((json.images || []).map(async im => {
      try {
        let blob;
        if (im.bufferView !== undefined) { const v = view(im.bufferView); blob = new Blob([new Uint8Array(v.buf, v.off, v.len)], { type: im.mimeType || 'image/png' }); }
        else if (im.uri.startsWith('data:')) blob = await (await fetch(im.uri)).blob();
        else blob = new Blob([await fetchUri(im.uri)]);
        return R.texture(await createImageBitmap(blob));
      } catch (e) { return null; }
    }));
    const textures = (json.textures || []).map(t => images[t.source]);
    const mats = (json.materials || []).map(m => {
      const pbr = m.pbrMetallicRoughness || {};
      const ti = pbr.baseColorTexture ? textures[pbr.baseColorTexture.index] : null;
      return { color: pbr.baseColorFactor || [1, 1, 1, 1], tex: ti || null, doubleSided: !!m.doubleSided,
               blend: m.alphaMode === 'BLEND', cut: m.alphaMode === 'MASK' ? (m.alphaCutoff ?? 0.5) : m.alphaMode === 'BLEND' ? 0.01 : -1 };
    });
    // nodes
    const nodes = (json.nodes || []).map((n, i) => {
      let t = n.translation || [0, 0, 0], r = n.rotation || [0, 0, 0, 1], s = n.scale || [1, 1, 1];
      if (n.matrix) { const m = new Float32Array(n.matrix); t = M.pos(m); r = M.rotq(m); s = [V.len([m[0], m[1], m[2]]), V.len([m[4], m[5], m[6]]), V.len([m[8], m[9], m[10]])]; }
      return { i, name: n.name || 'node' + i, t, r, s, children: n.children || [], parent: -1, mesh: n.mesh, skin: n.skin };
    });
    nodes.forEach(n => n.children.forEach(c => { nodes[c].parent = n.i; }));
    const order = []; const visit = i => { order.push(i); nodes[i].children.forEach(visit); };
    nodes.forEach(n => { if (n.parent < 0) visit(n.i); });
    // meshes
    const gl = R.gl, meshes = (json.meshes || []).map(m => m.primitives.filter(p => (p.mode ?? 4) === 4 && p.attributes.POSITION !== undefined).map(p => {
      const at = p.attributes, pos = accessor(at.POSITION);
      const nrm = at.NORMAL !== undefined ? accessor(at.NORMAL) : new Float32Array(pos.length).fill(0).map((_, k) => k % 3 === 1 ? 1 : 0);
      const vcount = pos.length / 3;
      let idx;
      if (p.indices !== undefined) idx = accessor(p.indices); else { idx = new Float32Array(vcount); for (let k = 0; k < vcount; k++) idx[k] = k; }
      const big = vcount > 65535;
      const ext = gl.getExtension('OES_element_index_uint');
      return {
        pos: R.buffer(pos), nrm: R.buffer(nrm),
        uv: at.TEXCOORD_0 !== undefined ? R.buffer(accessor(at.TEXCOORD_0)) : null,
        j: at.JOINTS_0 !== undefined ? R.buffer(accessor(at.JOINTS_0)) : null,
        w: at.WEIGHTS_0 !== undefined ? R.buffer(accessor(at.WEIGHTS_0)) : null,
        idx: R.buffer(big && ext ? new Uint32Array(idx) : new Uint16Array(idx), gl.ELEMENT_ARRAY_BUFFER),
        count: idx.length, type: big && ext ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
        mat: p.material !== undefined ? mats[p.material] : { color: [0.85, 0.85, 0.85, 1] },
        minY: pos.reduce((m, v, k) => k % 3 === 1 ? Math.min(m, v) : m, Infinity),
      };
    }));
    const skins = (json.skins || []).map(s => ({ joints: s.joints, ibm: s.inverseBindMatrices !== undefined ? accessor(s.inverseBindMatrices) : null }));
    return { nodes, order, meshes, skins };
  }

  class Custom {
    constructor(R, g) {
      this.R = R; this.g = g;
      const names = g.nodes.map(n => n.name);
      this.map = mapBones(names);                    // dance bone -> node index
      if (this.map.Hips === undefined) throw new Error('This model has no bone named like "Hips"');
      this.rest = this.world(g.nodes.map(n => ({ t: n.t, r: n.r, s: n.s })));
      this.restQ = this.rest.map(M.rotq); this.restP = this.rest.map(M.pos);
      const hp = this.restP[this.map.Hips];
      const feet = ['LeftFoot', 'RightFoot', 'LeftToeBase'].map(b => this.map[b]).filter(i => i !== undefined).map(i => this.restP[i][1]);
      const floor = feet.length ? Math.min(...feet) : 0;
      this.hipH = Math.max(1e-3, hp[1] - floor);
      this.floor = floor;
      this.scale = HIP_H / this.hipH;                 // shown at the same size as the built-in dancer
    }
    world(locals) {
      const g = this.g, out = new Array(g.nodes.length);
      for (const i of g.order) {
        const n = g.nodes[i], L = locals[i];
        const m = M.trs(L.t, L.r, L.s);
        out[i] = n.parent >= 0 ? M.mul(out[n.parent], m) : m;
      }
      return out;
    }
    // match the model's bones to the dance pose: each limb points the same way as the dancer's
    retarget(pose) {
      const g = this.g, map = this.map, rp = this.restP, rq = this.restQ;
      const want = {};                                // node -> desired world rotation
      const has = (...b) => b.every(x => map[x] !== undefined && pose.p[x]);
      const dirRule = (b, c) => {
        if (!has(b, c)) return;
        const dr = V.sub(rp[map[c]], rp[map[b]]), ds = V.sub(pose.p[c], pose.p[b]);
        if (V.len(dr) < 1e-6 || V.len(ds) < 1e-6) return;
        want[map[b]] = Q.mul(Q.fromTo(dr, ds), rq[map[b]]);
      };
      const frame = (up, lat) => { const y = V.norm(up), x = V.norm(V.sub(lat, V.mul(y, V.dot(lat, y)))); return Q.fromBasis(x, y, V.cross(x, y)); };
      const frameRule = (b, upA, upB, latA, latB) => {
        if (!has(b, upA, upB, latA, latB)) return;
        const fs = frame(V.sub(pose.p[upB], pose.p[upA]), V.sub(pose.p[latB], pose.p[latA]));
        const fr = frame(V.sub(rp[map[upB]], rp[map[upA]]), V.sub(rp[map[latB]], rp[map[latA]]));
        want[map[b]] = Q.mul(Q.mul(fs, Q.inv(fr)), rq[map[b]]);
      };
      frameRule('Hips', 'Hips', 'Spine1', 'RightUpLeg', 'LeftUpLeg');
      if (!want[map.Hips]) frameRule('Hips', 'Hips', 'Neck', 'RightUpLeg', 'LeftUpLeg');
      dirRule('Spine', 'Spine1');
      frameRule('Spine1', 'Spine1', 'Neck', 'RightArm', 'LeftArm');
      dirRule('Neck', 'Head');
      for (const s of ['Left', 'Right']) {
        dirRule(s + 'Collar', s + 'Arm'); dirRule(s + 'Arm', s + 'ForeArm'); dirRule(s + 'ForeArm', s + 'Hand');
        dirRule(s + 'Hand', s + 'HandMiddle1');
        dirRule(s + 'UpLeg', s + 'Leg'); dirRule(s + 'Leg', s + 'Foot'); dirRule(s + 'Foot', s + 'ToeBase');
      }
      // walk the tree, turning wanted world rotations into local ones
      const locals = g.nodes.map(n => ({ t: n.t, r: n.r, s: n.s }));
      const wq = new Array(g.nodes.length);
      for (const i of g.order) {
        const n = g.nodes[i], pq = n.parent >= 0 ? wq[n.parent] : Q.id();
        if (want[i]) locals[i] = { t: n.t, r: Q.norm(Q.mul(Q.inv(pq), want[i])), s: n.s };
        wq[i] = Q.mul(pq, locals[i].r);
      }
      // the hips follow the dancer's hips (moves, bounce)
      const hi = map.Hips, hn = g.nodes[hi];
      const target = [pose.p.Hips[0] / this.scale, this.floor + pose.p.Hips[1] / this.scale, pose.p.Hips[2] / this.scale];
      const parentW = hn.parent >= 0 ? this.world(locals)[hn.parent] : M.id();
      const lp = M.mul(M.invert(parentW), new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, target[0], target[1], target[2], 1]));
      locals[hi] = { t: M.pos(lp), r: locals[hi].r, s: locals[hi].s };
      return this.world(locals);
    }
    draw(pose, scale, offX) {
      const R = this.R, g = this.g, W = this.retarget(pose);
      const root = M.mul(M.trs([offX, 0, 0], Q.id(), [scale * this.scale, scale * this.scale, scale * this.scale]), M.id());
      for (const i of g.order) {
        const n = g.nodes[i];
        if (n.mesh === undefined) continue;
        let joints = null;
        if (n.skin !== undefined) {
          const sk = g.skins[n.skin], cnt = Math.min(sk.joints.length, R.maxJ);
          joints = new Float32Array(R.maxJ * 16);
          for (let k = 0; k < cnt; k++) {
            const ibm = sk.ibm ? sk.ibm.subarray(k * 16, k * 16 + 16) : M.id();
            joints.set(M.mul(W[sk.joints[k]], ibm), k * 16);
          }
        }
        const model = joints ? root : M.mul(root, W[i]);
        for (const prim of g.meshes[n.mesh]) R.draw(prim, model, prim.mat, joints);
      }
    }
  }

  // ------------------------------------------------------------------ public
  const Dancer = {
    R: null, built: null, custom: null, customErr: '', customFor: null,
    ensure() {
      if (!this.R) this.R = new Renderer(560, 720);
      return this.R;
    },
    async useModel(url) {
      this.custom = null; this.customErr = ''; this.customFor = url;
      if (!url) return;
      try {
        const R = this.ensure();
        const buf = await (await fetch(url)).arrayBuffer();
        const base = url.replace(/[^/]*$/, '');
        const g = await loadGLTF(R, buf, async u => (await fetch(url.includes('/api/dancermodel') ? '/api/dancermodel/res?u=' + encodeURIComponent(u) : base + u)).arrayBuffer());
        if (this.customFor === url) this.custom = new Custom(R, g);
      } catch (e) { this.customErr = String(e.message || e); console.error('dancer model', e); }
    },
    // data: the dance from the server; seed: per song
    prepare(data, seed) {
      if (!data) return null;
      const ch = new Choreo(data, seed);
      const R = this.ensure();
      if (!this.built || this.builtFor !== data) { this.built = new BuiltIn(R, ch.dir); this.builtFor = data; }
      this.built.fitVisor(ch.pose(0, 1e9));
      return ch;
    },
    // render one frame; returns the canvas to drawImage, or null
    render(ch, beat, endBeat, opts = {}) {
      if (!ch || !this.R) return null;
      const R = this.R, pose = ch.pose(beat, endBeat);
      R.begin(9.5, 40, 8.2);
      const who = this.custom && !opts.builtIn ? this.custom : this.built;
      who.draw(pose, 1, 0);
      return R.canvas;
    },
    _test: { Q, V, M, mapBones, normName, Choreo, ORDER, PARENT },
  };
  window.Dancer3D = Dancer;
})();
