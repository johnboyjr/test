// Hottest Party's 3D dance stages, drawn with WebGL behind the arrows for Hottest Party songs.
// The server reads the stage from the disc (hpstage.py) and sends the models, textures, the
// animation curves and the camera moves; this file puts them together and plays them.
'use strict';

(function () {
  const VS = `
attribute vec3 aPos; attribute vec2 aUV; attribute vec4 aCol; attribute vec3 aNrm;
attribute vec3 aSkJ; attribute vec3 aSkW; uniform mat4 uSk[4]; uniform float uSkin;
uniform mat4 uMVP; uniform vec2 uUVOff; uniform float uLit;
uniform float uGx; uniform mat4 uWorld; uniform mat4 uMV; uniform vec4 uMatC; uniform vec4 uAmbC;
uniform float uLitOn; uniform vec3 uLDir; uniform vec3 uLCol;
varying vec2 vUV; varying vec4 vCol; varying vec4 vCol1; varying float vZ;
void main() {
  // skinned stage parts (the boss tunnel / portal tube): up to three nodes per vertex
  vec4 P = vec4(aPos, 1.0); vec3 N = aNrm;
  if (uSkin > 0.5 && aSkW.x + aSkW.y + aSkW.z > 0.0001) {
    mat4 K = uSk[int(aSkJ.x + 0.5)] * aSkW.x + uSk[int(aSkJ.y + 0.5)] * aSkW.y + uSk[int(aSkJ.z + 0.5)] * aSkW.z;
    P = vec4((K * P).xyz, 1.0); N = mat3(K) * aNrm;
  }
  gl_Position = uMVP * P; vUV = aUV + uUVOff; vCol = aCol; vCol1 = vec4(1.0);
  vZ = -(uMV * P).z;
  if (uGx > 0.5) {
    // DDR II (main.dol 0x8014fac8): COLOR0 = the vertex colour; a lit material also gets COLOR1 =
    // clamp(ambient + light * max(N.L, 0)) * material, per vertex (GX_DF_CLAMP, no attenuation)
    if (uLitOn > 0.5) {
      vec3 n = normalize(mat3(uWorld) * N);
      float d = max(dot(n, uLDir), 0.0);
      vCol1 = vec4(clamp(uAmbC.rgb + uLCol * d, 0.0, 1.0) * uMatC.rgb, clamp(uAmbC.a + d, 0.0, 1.0) * uMatC.a);
    }
  } else if (uLit > 0.5) {
    // the dancers are lit by a soft light from the front and above (the stage itself is not lit)
    vec3 n = normalize(aNrm);
    float d = max(dot(n, normalize(vec3(0.3, 0.8, 0.6))), 0.0);
    vCol = vec4(aCol.rgb * (0.58 + 0.55 * d), aCol.a);
  }
}`;
  const FS = `
precision highp float;
varying vec2 vUV; varying vec4 vCol; varying vec4 vCol1; varying float vZ;
uniform sampler2D uTex; uniform float uHasTex; uniform vec4 uMat; uniform float uAdd; uniform float uCut;
uniform float uGx; uniform float uFog; uniform vec4 uMul;
void main() {
  vec4 t = uHasTex > 0.5 ? texture2D(uTex, vUV) : vec4(1.0);
  if (uGx > 0.5) {
    // TEV: stage 0 texture x COLOR0, stage 1 (lit) x COLOR1; then the alpha test and the fog
    // (x the model's colour, +112: 0x8015c440 - the boss opening dims and fades its props with it)
    vec4 g = t * vCol * vCol1 * uMul;
    if (g.a * 255.0 <= uCut) discard;
    // (fog as 0x801438a4 would set it: GX_FOG_PERSP_LIN 10-1000, white - not used during play)
    if (uFog > 0.5) g.rgb = mix(g.rgb, vec3(1.0), clamp((vZ - 10.0) / 990.0, 0.0, 1.0));
    gl_FragColor = g;
    return;
  }
  vec4 c = t * vCol * uMat;
  if (uAdd > 0.5) { gl_FragColor = vec4(c.rgb * c.a, 1.0); return; }
  if (c.a < uCut) discard;
  gl_FragColor = c;
}`;

  // ---- small matrix helpers (column-major 4x4)
  const M = {
    id: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    mul(a, b) {
      const o = new Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      return o;
    },
    // T * Rz * Ry * Rx * S (degrees, Maya's XYZ order)
    trs(p, r, s) {
      const d = Math.PI / 180, cx = Math.cos(r[0] * d), sx = Math.sin(r[0] * d), cy = Math.cos(r[1] * d), sy = Math.sin(r[1] * d),
        cz = Math.cos(r[2] * d), sz = Math.sin(r[2] * d);
      const m00 = cy * cz, m01 = sx * sy * cz - cx * sz, m02 = cx * sy * cz + sx * sz;
      const m10 = cy * sz, m11 = sx * sy * sz + cx * cz, m12 = cx * sy * sz - sx * cz;
      const m20 = -sy, m21 = sx * cy, m22 = cx * cy;
      return [m00 * s[0], m10 * s[0], m20 * s[0], 0, m01 * s[1], m11 * s[1], m21 * s[1], 0, m02 * s[2], m12 * s[2], m22 * s[2], 0, p[0], p[1], p[2], 1];
    },
    persp(fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2);
      return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0];
    },
    look(eye, at, roll) {
      let z = [eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]];
      const zl = Math.hypot(...z) || 1; z = z.map(v => v / zl);
      let up = [0, 1, 0];
      if (Math.abs(z[1]) > 0.999) up = [0, 0, -1];
      let x = [up[1] * z[2] - up[2] * z[1], up[2] * z[0] - up[0] * z[2], up[0] * z[1] - up[1] * z[0]];
      const xl = Math.hypot(...x) || 1; x = x.map(v => v / xl);
      let y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
      if (roll) {
        const a = roll * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        const nx = x.map((v, i) => v * c + y[i] * s), ny = y.map((v, i) => y[i] * c - x[i] * s);
        x = nx; y = ny;
      }
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
        -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]), -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]), -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]), 1];
    },
  };

  // inverse of an affine 4x4 (column-major)
  function inv(m) {
    const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C || 1e-9;
    const r = [A / det, B / det, C / det, 0,
      -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det, 0,
      (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det, 0, 0, 0, 0, 1];
    const tx = m[12], ty = m[13], tz = m[14];
    r[12] = -(r[0] * tx + r[4] * ty + r[8] * tz); r[13] = -(r[1] * tx + r[5] * ty + r[9] * tz); r[14] = -(r[2] * tx + r[6] * ty + r[10] * tz);
    return r;
  }

  // ---- animation curves: constant, linear [t, v, ...], bezier/hermite [t, v, in, out, ...] (slopes per frame)
  function curve(tr, f) {
    const k = tr.keys;
    if (tr.curve === 4 || typeof k === 'number') return k;
    const st = tr.curve === 2 ? 4 : 2, n = k.length / st;
    if (!n) return 0;
    if (f <= k[0]) return k[1];
    if (f >= k[(n - 1) * st]) return k[(n - 1) * st + 1];
    let i = 0;
    while (i < n - 2 && f >= k[(i + 1) * st]) i++;
    const t0 = k[i * st], v0 = k[i * st + 1], t1 = k[(i + 1) * st], v1 = k[(i + 1) * st + 1], dt = t1 - t0 || 1, u = (f - t0) / dt;
    if (st === 2) return v0 + (v1 - v0) * u;
    const m0 = k[i * st + 3] * dt, m1 = k[(i + 1) * st + 2] * dt, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * m1;
  }

  const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

  class Stage {
    constructor(data) {
      this.data = data;
      this.cv = document.createElement('canvas');
      this.cv.width = 1280; this.cv.height = 720;
      const gl = this.gl = this.cv.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: !(typeof S !== 'undefined' && S.glFast) });
      if (!gl) throw new Error('no WebGL');
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = this.prog = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      gl.useProgram(p);
      this.a = {}; for (const n of ['aPos', 'aUV', 'aCol', 'aNrm', 'aSkJ', 'aSkW']) this.a[n] = gl.getAttribLocation(p, n);
      this.u = {}; for (const n of ['uMVP', 'uUVOff', 'uTex', 'uHasTex', 'uMat', 'uAdd', 'uCut', 'uLit', 'uGx', 'uWorld', 'uMV',
        'uMatC', 'uAmbC', 'uLitOn', 'uLDir', 'uLCol', 'uFog', 'uSkin', 'uSk', 'uMul']) this.u[n] = gl.getUniformLocation(p, n === 'uSk' ? 'uSk[0]' : n);
      this.spots = data.spots || {};
      this.dancers = [];
      this.models = data.models.map(m => this.build(m));
      this.cams = data.cameras || [];
      // DDR II: the stage's particle effects (teb.js)
      this.fx = null;
      if (data.fx && window.TebFx) { try { this.fx = TebFx.create(gl, data.fx); } catch (e) { console.error('stage effects', e); } }
    }
    textures(bitmaps) {
      const gl = this.gl;
      return bitmaps.map(b => {
        const t = gl.createTexture(), im = new Image();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        im.onload = () => {
          gl.bindTexture(gl.TEXTURE_2D, t);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
          const pot = v => (v & (v - 1)) === 0;
          if (pot(im.width) && pot(im.height)) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
          else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); }
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          const wrap = pot(im.width) && pot(im.height) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
        };
        im.src = 'data:image/png;base64,' + b.png;
        return t;
      });
    }
    build(m) {
      const gl = this.gl;
      const tex = this.textures(m.bitmaps);
      const byName = {};
      const objs = m.objects.map((o, i) => {
        byName[o.name] = i;
        const mesh = (o.mesh || []).map(g => {
          const buf = arr => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; };
          const f32 = s => new Float32Array(b64(s).buffer);
          return { mat: g.mat, n: g.n, pos: buf(f32(g.pos)), uv: buf(f32(g.uv)), col: buf(b64(g.col)), nrm: g.nrm ? buf(f32(g.nrm)) : null,
            sj: g.sj ? buf(f32(g.sj)) : null, sw: g.sw ? buf(f32(g.sw)) : null };
        });
        return { o, mesh, pos: o.pos.slice(), rot: o.rot.slice(), scl: o.scl.slice(), vis: true };
      });
      const tracks = (m.motion && m.motion.tracks) || [];
      return { m, tex, objs, byName, tracks, len: (m.motion && m.motion.len) || 0, uvOff: m.attrs.map(() => [0, 0]) };
    }
    animate(md, f) {
      for (const ob of md.objs) { ob.pos = ob.o.pos.slice(); ob.rot = ob.o.rot.slice(); ob.scl = ob.o.scl.slice(); }
      for (const a of md.uvOff) { a[0] = 0; a[1] = 0; }
      if (!md.len) return;
      const fr = f % md.len;
      for (const tr of md.tracks) {
        const v = curve(tr, fr);
        if (tr.type === 2) {
          const i = md.byName[tr.target];
          if (i === undefined) continue;
          const ob = md.objs[i], c = tr.ch;
          if (c >= 8 && c <= 10) ob.pos[c - 8] = v;
          else if (c >= 0x1c && c <= 0x1e) ob.rot[c - 0x1c] = v;
          else if (c >= 0x1f && c <= 0x21) ob.scl[c - 0x1f] = v;
        } else if (tr.type === 10 && md.uvOff[tr.target]) {
          if (tr.ch === 8) md.uvOff[tr.target][0] = v;
          else if (tr.ch === 9) md.uvOff[tr.target][1] = v;
        }
      }
    }
    world(md) {
      const W = new Array(md.objs.length);
      const get = i => {
        if (W[i]) return W[i];
        const ob = md.objs[i], p = ob.o.parent;
        let local = M.trs(ob.pos, ob.rot, ob.scl);
        if (ob.o.pre) local = M.mul(ob.o.pre, local);
        W[i] = p >= 0 && p < md.objs.length && p !== i ? M.mul(get(p), local) : local;
        return W[i];
      };
      for (let i = 0; i < md.objs.length; i++) get(i);
      return W;
    }
    // the camera: which of the stage's camera moves, and how far into it
    camera(cam, f) {
      if (cam.hp2) {                      // Hottest Party 2: eye and look-at keys in seconds (f = frames of 1/60 s)
        const t = f / 60, at = (keys) => {
          let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= t) i++;
          const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], u = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
          return a.slice(1).map((v, k) => v + (b[k + 1] - v) * u);
        };
        if (cam.ddr2) {
          // DDR II's camera manager (main.dol 0x8005b764): the move's angle is across a 640 x 480 frame,
          // so the height's angle is 2 atan(480/640 tan(a/2)); near 1, far 5000 (checked in a memory dump)
          const a = (at(cam.fov)[0] || 45) * Math.PI / 360;
          return { eye: at(cam.eye), at: at(cam.at), roll: 0, fov: 2 * Math.atan(0.75 * Math.tan(a)) * 180 / Math.PI, near: 1, far: 5000 };
        }
        return { eye: at(cam.eye), at: at(cam.at), roll: 0, fov: at(cam.fov)[0] || 45, near: 1, far: cam.far || 100000 };
      }
      const v = { 8: 0, 9: 300, 10: 1200, 11: 0, 12: 0, 13: 0, 14: 0, 15: 45, 17: 10, 18: 100000 };
      for (const tr of cam.tracks) if (tr.param === 7) v[tr.ch] = curve(tr, f);
      const eye = [v[8], v[9], v[10]];
      let at = [v[11], v[12], v[13]];
      // the aim is stored as a far-away point in the looking direction
      if (Math.hypot(at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]) < 1) at = [0, 0, 0];
      // the camera's lens is a focal length in mm (Maya's 36 x 24 mm film back)
      return { eye, at, roll: v[14], fov: 2 * Math.atan(12 / Math.max(1, v[15])) * 180 / Math.PI, near: Math.max(1, v[17]), far: v[18] || 100000 };
    }
    // f: animation frame (60 per second); camIdx, camF: which camera and its frame
    render(f, camIdx, camF) {
      const gl = this.gl, W = this.cv.width, H = this.cv.height;
      // the models' own clock (texture flipbooks and scrolls run from when the stage loads: on the boss
      // stage that is the opening, 10 s before the song's start - chart time 0)
      this.gxT = f / 60 + (this.bossIntro && !this.introCamNow ? 10 : 0);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const cam = this.introCamNow ? this.camera(this.introCamNow.cam, this.introCamNow.f) : this.pvCam ? this.pvCam : this.appealCam ? this.camera(this.appealCam.cam, this.appealCam.f) : this.cueCam ? this.camera(this.cueCam.cam, this.cueCam.f)
        : this.songCam && this.songT !== undefined ? this.camera(this.songCam, Math.max(0, this.songT) * 60)
        : this.cams.length ? this.camera(this.cams[camIdx % this.cams.length], camF)
        : this.fixedCam || { eye: [0, 400, 1400], at: [0, 200, 0], roll: 0, fov: 45, near: 10, far: 100000 };
      let P = M.persp(cam.fov * Math.PI / 180, this.aspect || W / H, cam.near, cam.far);
      // (DDR II: the picture is moved sideways so the dancer stands beside the arrows, not behind them)
      if (this.ndcShift && !this.pvCam && !this.introCamNow) P = M.mul([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, this.ndcShift, 0, 0, 1], P);
      const V = M.look(cam.eye, cam.at, cam.roll), VP = M.mul(P, V);
      this.V = V;
      // DDR II: the lead dancer stands at the formation's spot 1 and the dance's camera moves are
      // relative to it (Dolphin memory, boss song: lead at stage + (0, -15, 20), camera = stage + spot +
      // move); here the lead is at the origin, so the stage is drawn at -spot (not in the opening,
      // whose moves are relative to the stage itself)
      const ls = !this.introCamNow && this.leadSpot ? this.leadSpot : null;
      const S0 = ls ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -ls[0], -ls[1], -ls[2], 1] : null;
      const VPs = S0 ? M.mul(VP, S0) : VP;
      this.stageShift = S0;
      // DDR II's stage light (0x80114fa4, checked against a memory dump): one white directional light
      // shining from the camera's eye toward its target
      { const d = [cam.eye[0] - cam.at[0], cam.eye[1] - cam.at[1], cam.eye[2] - cam.at[2]], l = Math.hypot(...d) || 1;
        this.lightDir = [d[0] / l, d[1] / l, d[2] / l]; }
      this.view = { VP, eye: cam.eye, w: W, h: H, lightDir: this.lightDir };
      this.lastCam = cam;                      // (for checking against Dolphin's camera trace)
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.useProgram(this.prog);
      gl.uniform1i(this.u.uTex, 0);
      let items = [];
      // three passes: the solid parts (writing depth), then soft edges and see-through parts blended
      // over them, then the glowing (additive) parts
      const flush = () => {
        // DDR II: the stage's parts are drawn one after another in the model's own order, each with its
        // material's blend kind (0x80177184) - no sorting; then the dancers as before
        if (items.some(it => it.mat.gx)) {
          for (const it of items) if (it.mat.gx) this.drawGx(it);
          items = items.filter(it => !it.mat.gx);
          gl.depthMask(true);
        }
        gl.disable(gl.BLEND);
        gl.uniform1f(this.u.uGx, 0);
        gl.depthMask(true);
        for (const it of items) if (!it.add && !it.mat.blend) this.drawItem(it, false, it.mat.cut != null ? it.mat.cut : 0.9);
        gl.depthMask(false);
        for (const it of items) if (!it.add) this.drawItem(it, true, 0.02);
        for (const it of items) if (it.add) this.drawItem(it, true, 0);
        gl.depthMask(true);
        items = [];
      };
      // DDR II: the movie on the stage's screens (white placeholder textures, see setMovie)
      if (this.movie && this.movieTex) {
        const fr = this.movie.frameAt(f / 60);
        if (fr && fr !== this.movieFrame) {
          this.movieFrame = fr;
          gl.bindTexture(gl.TEXTURE_2D, this.movieTex);
          try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fr); } catch (e) {}
        }
      }
      // (the song's extra stage files play their own movies on their own screens)
      for (const sm of Object.values(this.slotMovies || {})) {
        const fr = sm.movie.frameAt(f / 60);
        if (fr && fr !== sm.frame) {
          sm.frame = fr;
          gl.bindTexture(gl.TEXTURE_2D, sm.tex);
          try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fr); } catch (e) {}
        }
      }
      // (the pv screens come in three shapes - _43 / _CE / _WI - and only the one for the screen is used)
      const hasWide = this.models.some(md => /_WI\.zmb$/i.test(md.m.name || ''));
      for (const md of this.models) {
        if (hasWide && /_(43|CE)\.zmb$/i.test(md.m.name || '')) continue;
        // (DDR II: only the stage variant the dance's cues picked - 0 the stage, 1 / 2 the song's extra
        // stage files; a background-video variant draws no models)
        if (this.hp2 === 'ddr2' && (md.m.movieSlot || 0) !== (this.variant || 0)) continue;
        // (the boss stage: the opening's props only during the opening, the tunnel only after it)
        if (!!md.m.intro !== !!this.introCamNow) continue;
        // (the opening's own script, 0x80116478: which props show, their colour and the portal's clock)
        md.mul = null; md.clock0 = 0; md.amb = null;
        if (this.introCamNow && !this.bossProp(md)) continue;
        // menus: each model is its own layer, drawn over the one before
        if (this.layered) { flush(); gl.clear(gl.DEPTH_BUFFER_BIT); }
        // (DDR II: the models' animations run on the stage's own clock - from the boss opening's start)
        this.animate(md, this.hp2 === 'ddr2' ? ((this.gxT || 0) - md.clock0) * 60 : f);
        if (md.m.skin) this.skinPose(md, ((this.gxT || 0) - md.clock0) * 60);
        const Wm = this.world(md);
        // (DDR II props are drawn once at each of their spots)
        for (const P of md.m.inst || [null]) {
          const VPi = P ? M.mul(VPs, P) : VPs;
          md.objs.forEach((ob, i) => {
            for (const g of ob.mesh) {
              const mat = md.m.materials[g.mat] || { color: [255, 255, 255], alpha: 1, flags: 0, attrs: [] };
              const Wi = P ? M.mul(P, Wm[i]) : Wm[i];
              items.push({ md, g, mat, mvp: M.mul(VPi, Wm[i]), add: (mat.flags & 16) !== 0,
                world: S0 ? M.mul(S0, Wi) : Wi });
            }
          });
        }
      }
      // the dancers, posed for this moment of the song
      if (this.dancers.length && this.dance) {
        const posed = new Set();
        for (const d of this.dancers) {
          // each character model is posed once (the same outfit always dances in the same group)
          if (!posed.has(d.ch)) { this.pose(d.ch, Math.max(0, this.measure || 0), d.group || 0); posed.add(d.ch); }
          const place = M.trs(d.at, [0, d.turn || 0, 0], [d.scale || 1, d.scale || 1, d.scale || 1]);
          for (const g of d.ch.groups) {
            const mat = d.ch.c.materials[g.mat] || { color: [255, 255, 255], alpha: 1, flags: 0, attrs: [] };
            items.push({ md: d.ch, g, mat, mvp: M.mul(VP, place), add: false, lit: true });
          }
        }
      }
      flush();
      if (this.fx) { try { this.fx.draw(VPs, S0 ? M.mul(V, S0) : V); } catch (e) { console.error('effects', e); this.fx = null; } }
      return this.cv;
    }
    // ---- dancers: a skinned character (from hpchar.py) and the song's dance
    addCharacter(c) {
      const gl = this.gl;
      const ch = { c, tex: this.textures(c.bitmaps), uvOff: c.attrs.map(() => [0, 0]), m: c, groups: [] };
      const f32 = s => new Float32Array(b64(s).buffer), u16 = s => new Uint16Array(b64(s).buffer);
      ch.objs = c.objects;
      // bind pose: each joint's world matrix, and its inverse
      ch.bind = this.worldOf(c.objects, () => null);
      ch.inv = ch.bind.map(inv);
      ch.meshes = c.meshes.map(m => {
        const mm = { pos: f32(m.pos), nrm: f32(m.nrm), nv: m.nv, nn: m.nn, vj: m.vj ? u16(m.vj) : null, vw: m.vw ? f32(m.vw) : null,
          nj: m.nj ? u16(m.nj) : null, nw: m.nw ? f32(m.nw) : null, obj: m.obj };
        mm.sp = new Float32Array(mm.pos.length); mm.sn = new Float32Array(mm.nrm.length);
        for (const g of m.groups) {
          const buf = (arr, dyn) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); return b; };
          const pi = u16(g.pi), ni = u16(g.ni);
          const gg = { mat: g.mat, n: g.n, pi, ni, mesh: mm, cp: new Float32Array(g.n * 3), cn: new Float32Array(g.n * 3),
            uv: buf(f32(g.uv)), col: buf(b64(g.col)) };
          gg.pos = buf(gg.cp, true); gg.nrm = buf(gg.cn, true);
          ch.groups.push(gg);
        }
        return mm;
      });
      return ch;
    }
    // world matrices for an object list; local(i) can override an object's [pos, rot, scl]
    worldOf(objs, local) {
      const Wd = new Array(objs.length);
      const get = i => {
        if (Wd[i]) return Wd[i];
        const o = objs[i], l = local(i) || [o.pos, o.rot, o.scl];
        Wd[i] = M.trs(l[0], l[1], l[2]);
        if (o.parent >= 0 && o.parent < objs.length && o.parent !== i) Wd[i] = M.mul(get(o.parent), Wd[i]);
        return Wd[i];
      };
      for (let i = 0; i < objs.length; i++) get(i);
      return Wd;
    }
    setDance(d) {
      const clips = {};
      for (const [k, c] of Object.entries(d.clips)) {
        const tr = {};
        for (const [name, chs] of Object.entries(c.tracks)) {
          tr[name] = {};
          for (const [ch, v] of Object.entries(chs)) tr[name][ch] = new Float32Array(b64(v).buffer);
        }
        clips[k] = { frames: c.frames, tr };
      }
      this.dance = { perMeasure: d.perMeasure || 60, clips, timeline: d.timeline || [] };
      // the song's camera path for the whole song (the second one is a close-up path, not used)
      this.songCams = d.cameras || [];
      this.songCam = this.songCams[0] || null;
    }
    // which part a group (0 = lead, 1 = backup dancers) dances at a measure, and how far into it:
    // like the game, a part starts on its measure and runs 120 frames (here 60 samples) a measure
    clipAt(group, measure) {
      const tl = this.dance.timeline;
      let clip = null, start = 0;
      for (const ev of tl) {
        if (ev[0] > measure && clip !== null) break;
        const c = ev[1 + group];
        if (c >= 0) { clip = c; start = ev[0]; }
        if (ev[0] > measure) break;
      }
      const C = clip !== null ? this.dance.clips[clip] : null;
      if (!C) return null;
      const f = Math.max(0, Math.min(C.frames - 1, (measure - start) * this.dance.perMeasure));
      return { C, f };
    }
    pose(ch, measure, group) {
      const at = this.clipAt(group, measure);
      const fr = at ? at.f : 0, i0 = Math.floor(fr), i1 = at ? Math.min(at.C.frames - 1, i0 + 1) : 0, u = fr - i0;
      const val = (a, dflt) => a ? a[i0] + (a[i1] - a[i0]) * u : dflt;
      const TR = at ? at.C.tr : {};
      const Wd = this.worldOf(ch.objs, i => {
        const t = TR[ch.objs[i].name];
        if (!t) return null;
        const o = ch.objs[i];
        return [[val(t.px, o.pos[0]), val(t.py, o.pos[1]), val(t.pz, o.pos[2])],
                [val(t.rx, o.rot[0]), val(t.ry, o.rot[1]), val(t.rz, o.rot[2])], o.scl];
      });
      const S = Wd.map((w, j) => M.mul(w, ch.inv[j]));
      for (const mm of ch.meshes) {
        const P = mm.pos, N = mm.nrm, sp = mm.sp, sn = mm.sn;
        if (!mm.vj) { sp.set(P); sn.set(N); continue; }
        for (let v = 0; v < mm.nv; v++) {
          let x = 0, y = 0, z = 0;
          const px = P[v * 3], py = P[v * 3 + 1], pz = P[v * 3 + 2];
          for (let k = 0; k < 4; k++) {
            const w = mm.vw[v * 4 + k];
            if (!w) continue;
            const m = S[mm.vj[v * 4 + k]];
            x += w * (m[0] * px + m[4] * py + m[8] * pz + m[12]);
            y += w * (m[1] * px + m[5] * py + m[9] * pz + m[13]);
            z += w * (m[2] * px + m[6] * py + m[10] * pz + m[14]);
          }
          sp[v * 3] = x; sp[v * 3 + 1] = y; sp[v * 3 + 2] = z;
        }
        for (let v = 0; v < mm.nn; v++) {
          let x = 0, y = 0, z = 0;
          const nx = N[v * 3], ny = N[v * 3 + 1], nz = N[v * 3 + 2];
          for (let k = 0; k < 4; k++) {
            const w = mm.nw[v * 4 + k];
            if (!w) continue;
            const m = S[mm.nj[v * 4 + k]];
            x += w * (m[0] * nx + m[4] * ny + m[8] * nz);
            y += w * (m[1] * nx + m[5] * ny + m[9] * nz);
            z += w * (m[2] * nx + m[6] * ny + m[10] * nz);
          }
          sn[v * 3] = x; sn[v * 3 + 1] = y; sn[v * 3 + 2] = z;
        }
      }
      const gl = this.gl;
      for (const g of ch.groups) {
        const sp = g.mesh.sp, sn = g.mesh.sn;
        for (let k = 0; k < g.n; k++) {
          const p = g.pi[k] * 3, n = g.ni[k] * 3;
          g.cp[k * 3] = sp[p]; g.cp[k * 3 + 1] = sp[p + 1]; g.cp[k * 3 + 2] = sp[p + 2];
          g.cn[k * 3] = sn[n]; g.cn[k * 3 + 1] = sn[n + 1]; g.cn[k * 3 + 2] = sn[n + 2];
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, g.pos); gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.cp);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.nrm); gl.bufferSubData(gl.ARRAY_BUFFER, 0, g.cn);
      }
    }
    // one DDR II stage part, the way main.dol draws it (see DDR2_SPEC.md 'How the game draws a model')
    drawGx({ md, g, mat, mvp, world }) {
      const gl = this.gl, a = this.a, u = this.u, x = mat.gx;
      const T = this.gxT || 0;
      // texture flipbook (0x801576fc): the material's clock runs at 60 a second, wrapped at the last
      // frame time; the texture shown is the first whose time is past the clock
      let ai = mat.attrs && mat.attrs.length ? mat.attrs[0] : -1;
      if (x.flip) {
        const tt = x.flip.t, last = tt[tt.length - 1] || 1, c = (T * 60) % last;
        let i = 0; while (i < tt.length - 1 && tt[i] <= c) i++;
        ai = x.flip.a[i];
      }
      const at = ai >= 0 ? md.m.attrs[ai] : null;
      const ti = at ? at.bitmap : -1;
      // texture scroll (0x8015713c -> the texture matrix): offset (-u, v), from the +60 keys (time in
      // seconds, wrapped at the last key; a component steps when its flag is 1) or else speed * 60 * t
      let uv = [0, 0];
      if (x.scroll) {
        const ks = x.scroll.keys;
        if (ks && ks.length > 1) {
          const t0 = ks[0][0], tl = ks[ks.length - 1][0];
          let t = T;
          if (tl > t0 && t > tl) t -= Math.floor((t - t0) / (tl - t0)) * (tl - t0);
          let j = 0; while (j < ks.length - 2 && ks[j + 1][0] <= t) j++;
          const a = ks[j], b = ks[j + 1], w = b[0] > a[0] ? Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0]))) : 0;
          const v = c => a[3 + c] === 1 ? a[1 + c] : a[1 + c] + (b[1 + c] - a[1 + c]) * w;
          uv = [-v(0), v(1)];
        } else uv = [-x.scroll.speed[0] * 60 * T, x.scroll.speed[1] * 60 * T];
        uv = uv.map(q => q - Math.floor(q));
      }
      // (materials tagged 91-100 show the stage movie in place of their textures: 0x8004d91c)
      const stx = x.movie && this.screenTex(md);
      if (stx) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, stx); gl.uniform1f(u.uHasTex, 1); }
      else if (ti >= 0 && md.tex[ti]) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, md.tex[ti]); gl.uniform1f(u.uHasTex, 1); }
      else gl.uniform1f(u.uHasTex, 0);
      gl.uniform2f(u.uUVOff, uv[0], uv[1]);
      gl.uniform1f(u.uGx, 1); gl.uniform1f(u.uLit, 0);
      const mc = md.mul || [1, 1, 1, 1];
      gl.uniform4f(u.uMul, mc[0], mc[1], mc[2], mc[3]);
      const W = world || M.id();
      gl.uniformMatrix4fv(u.uWorld, false, new Float32Array(W));
      gl.uniformMatrix4fv(u.uMV, false, new Float32Array(M.mul(this.V, W)));
      // (the colours as the model loader leaves them - see hp2stage: white for nearly every stage part;
      // the Dolphin dumps' per-object colour records agreed)
      gl.uniform4f(u.uMatC, x.mat[0] / 255, x.mat[1] / 255, x.mat[2] / 255, x.mat[3] / 255);
      const amb = md.amb && x.tag >= 11 && x.tag <= 90 ? md.amb : x.amb;
      gl.uniform4f(u.uAmbC, amb[0] / 255, amb[1] / 255, amb[2] / 255, amb[3] / 255);
      // the lit path needs the model's light mask (obj +168): 0x80114fa4 -> 0x80052bc8 sets it only for
      // the main stage file's models (variant 0; groups mask 123), so the song's extra stage files
      // (variants 1 / 2) are drawn unlit - Wings snapshots: +168 = 1 on STG013's DRAW, 0 on STG406's
      const litOn = x.lit && !(this.hp2 === 'ddr2' && (md.m.movieSlot || 0) > 0);
      gl.uniform1f(u.uLitOn, litOn ? 1 : 0);
      const L = this.lightDir || [0, 0, 1];
      gl.uniform3f(u.uLDir, L[0], L[1], L[2]);
      // light 0's colour: grey 255 x the stage's light preset +8 (1.0 on the song stages)
      const lg = this.data && this.data.fx && this.data.fx.light && this.data.fx.light.G;
      const G = typeof lg === 'number' ? Math.min(1, Math.max(0, lg)) : 1;
      gl.uniform3f(u.uLCol, G, G, G);
      // blend kind: 1 = added (src alpha, one), no depth write, no fog; 2 = (zero, 1 - src alpha);
      // 0 / 3 = alpha blended. Kinds 1-3 alpha-test at 160 (at 0 with bit 7); kind 0 does not test.
      const k = x.kind;
      gl.enable(gl.BLEND);
      if (k === 1) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else if (k === 2) gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(k !== 1);
      gl.uniform1f(u.uCut, k === 0 ? -1 : x.a0 ? 0 : 160);
      // (fog: 0x801438a4 sets it only while the fog manager's +580 is 1 - 0 during play, so none)
      gl.uniform1f(u.uFog, 0);
      if (g.nrm && litOn) { gl.bindBuffer(gl.ARRAY_BUFFER, g.nrm); gl.enableVertexAttribArray(a.aNrm); gl.vertexAttribPointer(a.aNrm, 3, gl.FLOAT, false, 0, 0); }
      else if (a.aNrm >= 0) { gl.disableVertexAttribArray(a.aNrm); gl.vertexAttrib3f(a.aNrm, 0, 1, 0); }
      gl.uniformMatrix4fv(u.uMVP, false, new Float32Array(mvp));
      gl.depthFunc(gl.LEQUAL);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.pos); gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.uv); gl.enableVertexAttribArray(a.aUV); gl.vertexAttribPointer(a.aUV, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.col); gl.enableVertexAttribArray(a.aCol); gl.vertexAttribPointer(a.aCol, 4, gl.UNSIGNED_BYTE, true, 0, 0);
      const skin = g.sj && g.sw && md.skinMats;
      if (skin) {
        gl.uniform1f(u.uSkin, 1);
        gl.uniformMatrix4fv(u.uSk, false, md.skinMats);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.sj); gl.enableVertexAttribArray(a.aSkJ); gl.vertexAttribPointer(a.aSkJ, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, g.sw); gl.enableVertexAttribArray(a.aSkW); gl.vertexAttribPointer(a.aSkW, 3, gl.FLOAT, false, 0, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, g.n);
      if (skin) {
        gl.uniform1f(u.uSkin, 0);
        gl.disableVertexAttribArray(a.aSkJ); gl.disableVertexAttribArray(a.aSkW);
        gl.vertexAttrib3f(a.aSkJ, 0, 0, 0); gl.vertexAttrib3f(a.aSkW, 0, 0, 0);
      }
    }
    // The boss opening (main.dol 0x801163ac sets it up, 0x80116478 runs it each frame; c = frames since
    // the opening began, at 60 a second). At the start STG201 / STG201_01 are off and BG109, BG201,
    // DRAW109 on, hole01 off (Dolphin dumps at 3.83 / 3.97 / 8.77 s agree: hole01 off, then on with BG109
    // off). DRAW109's and BG109's colour go from 1 to 0.15 between c 60 and 210 (dusk - the dumps' model
    // colours, +112: 0.15 for both); BG109 also fades out over c 390-420 and is switched off; hole01 is switched on at c 300, fades in by c 360, and its animation
    // restarts then (0x8015625c - the dumps' clock: 3.833 at 3.83 s, 3.767 at 8.77 s), so the portal's
    // tube grows from 0.3 to full size over c 300-450.
    bossProp(md) {
      const n = md.m.name || '', c = (this.introT || 0) * 60;
      const k = c < 60 ? 1 : c < 210 ? 0.85 * (210 - c) / 150 + 0.15 : 0.15;
      if (/BG109/i.test(n)) {
        if (c >= 420) return false;
        md.mul = [k, k, k, c >= 390 ? (420 - c) / 30 : 1];
      } else if (/DRAW109/i.test(n)) {
        md.mul = [k, k, k, 1];
      } else if (/hole01/i.test(n)) {
        if (c < 300) return false;
        md.mul = [1, 1, 1, Math.min(1, (c - 300) / 60)];
        md.clock0 = 5;
        // its light-channel ambient (materials tagged 11-90): light preset 0's colour (d2ffe6) until c 390,
        // then preset 1's (8caadc), faded in a straight line over preset 1's time +128 = 0.5 s (the script
        // writes it, controller +276) - Dolphin dumps: d2ffe6 at c 230 / 238, 8caadc at c 526 and in the song
        const L = (this.data.fx || {}).light;
        if (L && L.color && L.channel) {
          const a = L.color, b = L.channel[0], u = Math.max(0, Math.min(1, (c - 390) / 30));
          md.amb = [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * u)).concat(255);
        }
      }
      return true;
    }
    // skinned models: each skinning node's world matrix now (its own and its parents' ZAB keys at
    // frame f, looped over the animation's length) x the inverse of its world matrix in the file
    skinPose(md, f) {
      const sk = md.m.skin;
      if (!sk || !sk.nodes || !sk.slots) { md.skinMats = null; return; }
      const len = sk.len || 1, fr = ((f % len) + len) % len;
      const samp = (keys, n) => {
        if (!keys || !keys.length) return null;
        if (fr <= keys[0][0]) return keys[0].slice(1);
        const L = keys[keys.length - 1]; if (fr >= L[0]) return L.slice(1);
        let lo = 0, hi = keys.length - 1;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (keys[mid][0] <= fr) lo = mid; else hi = mid; }
        const A = keys[lo], B = keys[hi], t = (fr - A[0]) / Math.max(1e-6, B[0] - A[0]);
        if (n === 4) {                       // quaternions: the short way round, normalised
          let d = 0; for (let i = 1; i < 5; i++) d += A[i] * B[i];
          const sg = d < 0 ? -1 : 1, q = [0, 1, 2, 3].map(i => A[i + 1] * (1 - t) + sg * B[i + 1] * t);
          const l = Math.hypot(...q) || 1; return q.map(v => v / l);
        }
        return [0, 1, 2].map(i => A[i + 1] + (B[i + 1] - A[i + 1]) * t);
      };
      const qm = (T, q, S) => {
        const [x, y, z, w] = q;
        const r = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w),
          2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)];
        return [r[0] * S[0], r[1] * S[0], r[2] * S[0], 0, r[3] * S[1], r[4] * S[1], r[5] * S[1], 0, r[6] * S[2], r[7] * S[2], r[8] * S[2], 0, T[0], T[1], T[2], 1];
      };
      if (!md.skinBindInv) {
        const bw = [];
        sk.nodes.forEach((n, i) => { bw[i] = n.parent >= 0 ? M.mul(bw[n.parent], n.m) : n.m; });
        md.skinBindInv = sk.slots.map(i => inv(bw[i]));
      }
      const now = [];
      sk.nodes.forEach((n, i) => {
        const T = samp(n.T, 3), R = samp(n.R, 4), S = samp(n.S, 3);
        const loc = T || R || S ? qm(T || n.m.slice(12, 15), R || [0, 0, 0, 1], S || [1, 1, 1]) : n.m;
        now[i] = n.parent >= 0 ? M.mul(now[n.parent], loc) : loc;
      });
      const out = new Float32Array(64);
      sk.slots.forEach((i, k) => { if (k < 4) out.set(M.mul(now[i], md.skinBindInv[k]), k * 16); });
      md.skinMats = out;
    }
    drawItem({ md, g, mat, mvp, add, lit }, blend, cut) {
      const gl = this.gl, a = this.a;
      const at = mat.attrs && mat.attrs.length ? md.m.attrs[mat.attrs[0]] : null;
      const ti = at ? at.bitmap : -1, uv = mat.attrs && mat.attrs.length ? md.uvOff[mat.attrs[0]] || [0, 0] : [0, 0];
      const stx = ti >= 0 && md.m.bitmaps[ti] && md.m.bitmaps[ti].screen && this.screenTex(md);
      if (stx) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, stx); gl.uniform1f(this.u.uHasTex, 1); }
      else if (ti >= 0 && md.tex[ti]) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, md.tex[ti]); gl.uniform1f(this.u.uHasTex, 1); }
      else gl.uniform1f(this.u.uHasTex, 0);
      gl.uniform2f(this.u.uUVOff, -uv[0], uv[1]);
      // (DDR II's stages colour their parts by vertex colour: the material colours are Maya placeholders
      // - pure green / yellow / cyan - that the GX light channel never uses)
      const c = this.hp2 === 'ddr2' && !lit ? [204, 204, 204] : mat.color || [255, 255, 255];
      // Maya's default grey (0.8) is the 'no tint' colour
      const k = v => Math.min(1, v / 204);
      gl.uniform4f(this.u.uMat, k(c[0]), k(c[1]), k(c[2]), mat.alpha == null ? 1 : mat.alpha);
      gl.uniform1f(this.u.uAdd, add ? 1 : 0);
      gl.uniform1f(this.u.uCut, cut);
      gl.uniform1f(this.u.uLit, lit ? 1 : 0);
      if (lit && g.nrm) { gl.bindBuffer(gl.ARRAY_BUFFER, g.nrm); gl.enableVertexAttribArray(a.aNrm); gl.vertexAttribPointer(a.aNrm, 3, gl.FLOAT, false, 0, 0); }
      else if (a.aNrm >= 0) { gl.disableVertexAttribArray(a.aNrm); gl.vertexAttrib3f(a.aNrm, 0, 1, 0); }
      gl.uniformMatrix4fv(this.u.uMVP, false, new Float32Array(mvp));
      gl.depthFunc(gl.LEQUAL);
      if (blend) { gl.enable(gl.BLEND); if (add) gl.blendFunc(mat.addAlpha ? gl.SRC_ALPHA : gl.ONE, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
      else gl.disable(gl.BLEND);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.pos); gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.uv); gl.enableVertexAttribArray(a.aUV); gl.vertexAttribPointer(a.aUV, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.col); gl.enableVertexAttribArray(a.aCol); gl.vertexAttribPointer(a.aCol, 4, gl.UNSIGNED_BYTE, true, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, g.n);
    }
  }

  // camera moves follow the music: each move spans four measures (about every 7-11 s, as on the Wii),
  // then the next one starts
  Stage.prototype.draw = function (beat, secs, songT) {
    this.songT = songT; this.beat = beat; this.measure = beat / 4;
    // the boss stage's opening (introT = seconds into it): its own camera moves, one after another
    this.introCamNow = null;
    if (this.introT != null && this.data.introCams && this.data.introCams.length) {
      let t = this.introT, k = 0;
      const cs = this.data.introCams;
      while (k < cs.length - 1 && t >= cs[k].len) { t -= cs[k].len; k++; }
      this.introCamNow = { cam: cs[k], k, f: Math.min(t, cs[k].len) * 60 };
      // the stage's own effects run all the time (0x80053124): on the boss stage that is bank 5's
      // effect 0 at EFF_03_01 (0, 740, 2730), the lightning ball in the tunnel mouth (hole01) - the
      // portal seen above the dancers
      if (this.fx) {
        const dt = this.introLast != null ? this.introT - this.introLast : 0;
        this.introLast = this.introT;
        // (the boss stage travels +3 a frame through the opening, from 0: see travelZ)
        this.fx.travelZ = 180 * this.introT;
        this.fx.update(Math.max(0, Math.min(dt, 0.1)));
        const fx = this.data.fx || {}, own = fx.own || [];
        // (the opening starts the stage's own effects at c 180 - 3 s in: 0x80116478 -> 0x80052ffc)
        if (this.introT >= 3) Object.keys(fx.spots || {}).filter(n => n.startsWith('EFF_03_')).sort().forEach((n, i) => {
          const row = own[i];
          if (row && row.effect >= 0 && !this.fx.playing('own' + i)) this.fx.play(5, row.effect, fx.spots[n], { tag: 'own' + i });
        });
        // the dancers' effect set: 1 from the start (0x80062058), 2 from c 544 = 9.07 s, as they fly up
        // (0x80062014)
        this.chrEffects(this.introT * 60 < 544 ? 1 : 2);
      }
      return this.render(this.introT * 60, 0, 0);
    }
    if (this.pvCam) return this.render(Math.max(0, secs) * 60, 0, 0);       // DDR II video songs: the fixed monitor view
    if (this.cams.length && this.cams[0].ddr2) {     // DDR II (GAME_DEF_CAM): a random move, played for its own length, then another
      this.ddr2Cues(beat, secs);
      // CAMERA WORK: DEFAULT follows the dance's cue sheet; FRONT ONLY / ALL CAMERAS use the game's
      // own moves (GAME_DEF_CAM) - only the ones looking at the dancer from the front, or all of them
      const work = this.cameraWork || 'default';
      if (this.cueCam && work === 'default') return this.render(secs * 60, 0, 0);
      if (!this.camPool || this.camPoolFor !== work) {
        this.camPoolFor = work;
        const front = this.cams.map((c, i) => [c, i]).filter(([c]) => { const e = c.eye && c.eye[0]; return e && e[3] > 0 && Math.abs(e[1]) < e[3] * 0.3; }).map(([, i]) => i);
        this.camPool = work === 'front' && front.length ? front : this.cams.map((_, i) => i);
        this.camSeq = null;
      }
      const pool = this.camPool, pick = () => pool[Math.floor(Math.random() * pool.length)];
      const t = Math.max(0, secs);
      if (!this.camSeq || t < this.camSeqT0) { this.camSeq = { i: pick(), at: t }; this.camSeqT0 = t; }
      let c = this.cams[this.camSeq.i];
      while (t - this.camSeq.at >= (c.len || 3)) {
        this.camSeq.at += c.len || 3;
        let j = pick();
        if (j === this.camSeq.i && pool.length > 1) j = pool[(pool.indexOf(j) + 1) % pool.length];
        this.camSeq.i = j; c = this.cams[j];
      }
      return this.render(secs * 60, this.camSeq.i, (t - this.camSeq.at) * 60);
    }
    if (this.cams.length && this.cams[0].hp2) {      // Hottest Party 2: each move plays in real time, then the next
      const n = this.cams.length, len = this.cams[0].len || 3, k = Math.floor(Math.max(0, secs) / len);
      return this.render(secs * 60, (k * 3 + 1) % n, (Math.max(0, secs) % len) * 60);
    }
    const n = Math.max(1, this.cams.length), b = Math.max(0, beat), seg = Math.floor(b / 16);
    const ci = (seg * 7 + 3) % n, cam = this.cams[ci] || null, len = cam ? cam.len || 180 : 180;
    return this.render(secs * 60, ci, ((b % 16) / 16) * len);
  };

  // DDR II: the dance's cue sheets (ddr2fx.py) drive the stage - effect groups at the stage's EFF_ spots
  // (event type 7 -> 0x80112d9c -> 0x80052e1c) and the dance part's own camera moves (type 4 ->
  // 0x8005c540); the stage's own effects (EFF_03_xx, bank 5) play all the time (0x80052ffc)
  // DDR II: play a movie (a /api/movie path) on the stage's screens
  // the movie texture a model's screens show (null until its first frame): the stage's own movie, or
  // for an extra stage file (md.m.movieSlot 1 / 2) that file's own
  Stage.prototype.screenTex = function (md) {
    const k = md && md.m && md.m.movieSlot;
    if (k) { const sm = this.slotMovies && this.slotMovies[k]; return sm && sm.frame ? sm.tex : null; }
    return this.movieTex && this.movieFrame ? this.movieTex : null;
  };
  Stage.prototype.setMovie = function (file, opts = {}, slot = 0) {
    if (!file || typeof Movie === 'undefined') return;
    const gl = this.gl;
    if (slot) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      (this.slotMovies = this.slotMovies || {})[slot] = { movie: new Movie(file, { loop: !opts.sync }), tex, frame: null };
      return;
    }
    this.movie = new Movie(file, { loop: !opts.sync });
    this.movieTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.movieTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  Stage.prototype.ddr2Cues = function (beat, secs) {
    const fx = this.data.fx || {}, now = Math.max(0, secs);
    const dt = this.lastSecs !== undefined ? now - this.lastSecs : 0;
    this.lastSecs = now;
    if (dt < 0 || dt > 1) { this.cueAt = undefined; this.cueCam = null; if (this.fx) this.fx.clear(); }
    if (dt < 0) { this.variant = 0; this.variantCounter = 0; }
    if (this.fx) {
      // the boss stage travels: the stage, the dancers, the camera and the lights get the controller's
      // travel offset (+72, +3.0 a frame by 0x80116a04 - Dolphin camtrace: 0 -> 1800 through the opening,
      // -50000 at chart time 0, then 180 units a second), so it doesn't show - except in particles, which
      // stay where they were emitted (teb.js travelZ)
      this.fx.travelZ = [200, 204, 205].includes(this.data.id) ? -50000 + 180 * now : 0;
      this.chrEffects(1);
      this.fx.update(Math.max(0, Math.min(dt, 0.1)));
      const own = (fx.own || []), spots = Object.keys(fx.spots || {}).filter(n => n.startsWith('EFF_03_')).sort();
      spots.forEach((n, k) => {
        const row = own[k];
        if (row && row.effect >= 0 && !this.fx.playing('own' + k)) this.fx.play(5, row.effect, fx.spots[n], { tag: 'own' + k });
      });
    }
    const ch = this.choreo, m = beat / 4;
    if (this.cueCam) {
      // the move plays at its own speed for the cue's time (holding its last frame); a whole-song
      // move (a song's own camera, over a minute long) follows the song's clock
      // (the move lasts its cue's time in seconds)
      const c = this.cueCam, u = (now - c.t0) / Math.max(0.01, c.dur);
      if (u >= 1 || u < 0) this.cueCam = null;
      else {
        c.f = this.cueFrame(c, now - c.t0);
      }
    }
    if (!ch || !ch.d || !ch.d.cues) return;
    const endM = Math.floor((this.endBeat || 1e9) / 4) + 1;
    const prev = this.cueAt === undefined ? Math.max(-1e-6, m - 0.5) : this.cueAt;
    this.cueAt = m;
    if (!(m > prev)) return;
    for (let k = Math.max(0, Math.floor(prev)); k <= Math.floor(m); k++) {
      const pa = ch.partAt(k, endM);
      if (!pa) continue;
      const sheet = pa.kind === 'L' ? ch.d.cues.L[pa.i] : ch.d.cues[pa.kind];
      if (!sheet) continue;
      for (const c of sheet.cues) {
        const at = pa.start + c.m;
        if (at < k || at >= k + 1 || !(at > prev && at <= m)) continue;
        this.cue(c, sheet, at, pa);
      }
    }
  };
  // where a part's camera moves start on the dance's own camera timeline: Hottest Party 4's moves are
  // cut from one take running through S, L01, L02, L03 and E in that order (keys in seconds from the
  // take's start); the game plays a move at that part's place in the take + the time since the part
  // began (Dolphin camtrace, London EVOLVED Ver.C: L02's first move at 11.36 s, E's at 105.35 s although
  // the song reached E after 86 s)
  Stage.prototype.partStart = function (pa) {
    const ch = this.choreo, d = ch && ch.d;
    if (!d || !pa) return 0;
    const secs = kind => (i) => { const pt = ch.part(kind, i); return pt ? ch.partLen(pt) : 0; };
    if (pa.kind === 'S') return 0;
    let a = secs('S')(0);
    const nL = (d.L || []).length, upto = pa.kind === 'E' ? nL : pa.i;
    for (let j = 0; j < upto; j++) a += secs('L')(j);
    return a;
  };
  // the boss dancers' own effects (bank 6 = character/CHR_EFF.bin): Dolphin memory, London EVOLVED Ver.C
  // (the effect manager's live instances, every dump): per dancer one effect at the hips and one at each
  // hand, running all song and following the bones (0x8005fb04 -> 0x801791f0) - the lead 8 + 9 / 9, the
  // dancer at spot 2 10 + 11 / 11, spot 3 12 + 13 / 13. (The odd ones sit level with the hips, 2-5 units
  // to each side, while the dancers fly arms at their sides: the hands.) Their particles stay behind as
  // the stage travels (teb.js travelZ): the trails behind the flying dancers.
  // Effect sets (0x80271848) and their codes' effects (0x8005f168: table 0x80271c30, a row of 4 dancer
  // slots per code 1000-1008): set 1 = codes 1003 / 1004 / 1005 at the hips and the two hands -> slot k
  // effects 8 + 2k and 9 + 2k (the London EVOLVED dumps' 8/9/9, 10/11/11, 12/13/13); set 2 = codes 1006 /
  // 1007 / 1008 at the hips (attach flag 1) and the two feet -> 16 + 2k and 17 + 2k.
  const CHR_SETS = { 1: { base: 8, at: ['Hips', 'LeftHand', 'RightHand'] }, 2: { base: 16, at: ['Hips', 'LeftFoot', 'RightFoot'] } };
  Stage.prototype.chrEffects = function (set) {
    const D = window.Dancer3D, fx = this.fx, S = CHR_SETS[set];
    if (!fx || !fx.banks || !fx.banks[6] || !D || !D.bones || !S) return;
    const ref = D.bonesRef || [0, 0, 0];
    // a new set starts its own effects (the old ones are left to finish)
    if (this.chrSet !== set) { this.chrSet = set; this.chrFx = []; }
    this.chrFx = this.chrFx || [];
    D.bones.forEach((b, k) => {
      if (!b || k > 2) return;
      const at = (bn) => { const m = b[bn]; if (!m) return null; const o = Array.from(m); o[12] += ref[0]; o[13] += ref[1]; o[14] += ref[2]; return o; };
      S.at.forEach((bn, s) => {
        const M = at(bn); if (!M) return;
        const key = k * 3 + s;
        let inst = this.chrFx[key];
        // (when an effect has run its length the game stops it and starts it again: 0x8005fb04 ->
        // 0x80179320 / 0x8017913c / 0x8017911c)
        if (inst && !inst.done && inst.t >= inst.end) inst.done = true;
        if (!inst || inst.done) inst = this.chrFx[key] = fx.play(6, S.base + 2 * k + (s ? 1 : 0), M);
        if (inst) inst.M = M;
      });
    });
  };
  // the stage variant a cue's column 9 picks (0x8011399c -> 0x80113838 -> 0x80129308), on the row being
  // reached: 0 = back to the stage. Any other value goes through only if the gate table (main.dol
  // 0x80292080) [min(pass, 3)][part kind] is set - pass = the loop's round (schedule +288: 1 the first
  // time through the loops, 2 the second ...; 0 for S and E), kind 0 S, 1-3 the three loop slots, 4 E:
  // pass 0 S/E yes, pass 1 slot 2, pass 2 slots 1 and 3, pass 3+ slot 2. Then the next of the song's two
  // extra stage files in turn (counter + 1 mod 3, 0 -> 1: 1, 2, 1, 2 ...), if it was loaded
  // (0x8005386c: variant < the loaded count). Checked against three Dolphin plays of Wings of an Angel
  // (controller +108 counter / +5156 variant at every 10 s snapshot): every cue let through or not
  // matches.
  const VARIANT_GATE = [[1, 0, 0, 0, 1], [0, 0, 1, 0, 0], [0, 1, 0, 1, 0], [0, 0, 1, 0, 0]];
  Stage.prototype.pickVariant = function (k9, pa) {
    const n = (this.data.variantKinds || [0]).length;
    let v = 0;
    if (k9) {
      const kind = !pa ? 0 : pa.kind === 'S' ? 0 : pa.kind === 'E' ? 4 : (pa.i || 0) + 1;
      const pass = !pa || pa.kind !== 'L' ? 0 : pa.pass || 1;
      if (!VARIANT_GATE[Math.min(pass, 3)][kind]) return;
      this.variantCounter = ((this.variantCounter || 0) + 1) % 3 || 1;
      v = this.variantCounter;
    }
    if (v < n) this.variant = v;
  };
  // a background-video variant (screen kind 1, bgv/<name>): the frame to show behind the dancers
  Stage.prototype.bgvFrame = function () {
    const v = this.variant || 0, kinds = this.data.variantKinds || [];
    if (!v || kinds[v] !== 1) return null;
    const sm = this.slotMovies && this.slotMovies[v];
    return sm && sm.frame ? sm.frame : null;
  };
  Stage.prototype.cue = function (c, sheet, at, pa) {
    const fx = this.data.fx || {};
    if (c.k9 !== undefined) this.pickVariant(c.k9, pa);
    if (c.fx !== undefined && this.fx && fx.groups && fx.groups[c.fx]) {
      for (const k of fx.groups[c.fx]) {
        const sl = fx.slots && fx.slots[k], spot = sl && fx.spots['EFF_' + sl[0]];
        if (spot && sl[1] >= 0) this.fx.play(1, sl[1], spot);
      }
    }
    if (c.cam && sheet.cams && sheet.cams[c.cam[0]]) {
      const cam = sheet.cams[c.cam[0]], bpm = c.bpm || 120;
      // its time is in seconds at the dance's own tempo: as measures it keeps the song's beat
      const durM = (c.cam[1] > 0 ? c.cam[1] : cam.len) * bpm / 240;
      // (when the cue was reached, not when this frame noticed it: the part's own seconds between the two)
      let late = 0;
      const ch = this.choreo;
      if (ch && pa && ch.partSecs && this.cueAt !== undefined) {
        const pt = ch.part(pa.kind, pa.i);
        late = Math.max(0, ch.partSecs(pt, this.cueAt - pa.start) - ch.partSecs(pt, at - pa.start));
      }
      this.cueCam = { cam, m0: at, durM, dur: c.cam[1] > 0 ? c.cam[1] : cam.len, f: 0, t0: Math.max(0, (this.lastSecs || 0) - late), take: c.tt != null ? c.tt : this.partStart(pa) + (c.t || 0) };
      // (its first frame straight away - not frame 0 for one frame until the next update)
      this.cueCam.f = this.cueFrame(this.cueCam, late);
    }
  };
  // the frame of a cue's move `into` seconds after the cue: a piece of the dance's take plays from its
  // place in the take; a move from the shared library (GAME_DEF_CAM: HP2U_DEF_CAM_.., HP3U_DEF_CAM_..)
  // is spread over the cue's time (Dolphin camtrace, Wings of an Angel: HP2U_DEF_CAM_02_14, 6 s long
  // on an 11.64 s cue, ran at 0.52 speed and reached its last key as the next cue came; DEF_CAM_03_07,
  // 9 s on 8.73 s, ran at full speed); anything else plays at its own speed and holds its last key
  Stage.prototype.cueFrame = function (c, into) {
    const last = Math.max(...[c.cam.eye, c.cam.at].map(k => k && k.length ? k[k.length - 1][0] : 0)) || c.cam.len;
    if (c.take > 0 && last > c.take) return (c.take + into) * 60;
    if (/_DEF_CAM_/.test(c.cam.name || '') && c.dur > 0) return Math.min(1, Math.max(0, into / c.dur)) * last * 60;
    return Math.min(last, into) * 60;
  };

  window.HPStage = {
    fromData(d) { return new Stage(d); },
    // a Hottest Party 2 stage (files/stage/STGnnn.bin), its own camera moves included
    // `game` 'hp3': one of Hottest Party 3's stages (files/stage/STGnnn.bin, the same format as HP2's)
    async loadHP2(n, game = 'hp2') {
      if (!n || n === 'random') {
        const list = await (await fetch('/api/' + game + 'stages')).json();
        if (!list.length) return null;
        n = list[Math.floor(Math.random() * list.length)];
      }
      const r = await fetch('/api/' + game + 'stage/' + n);
      if (!r.ok) return null;
      const st = new Stage(await r.json());
      st.hp2 = n;
      return st;
    },
    // Hottest Party 2's dancers (hp2char.py): the lead in the middle and two backup dancers either side,
    // all dancing the song's routine. Read from the game's memory in Dolphin: the lead is CHR01x and
    // the backups are two different outfits of CHR09x; GAME_POSITION puts a pair at x = -10 and +10.
    // `slot` is an HP2 song: its routine plays in measures, so it keeps the beat on any song.
    // `game` 'hp3': Hottest Party 3's dancers (same files and formats as HP2's, in sound/stream/character):
    // a lead picked from its characters (CHR01x-CHR15x) and a backup dancer (CHR21x-CHR32x) in two outfits
    async addDancersHP2(st, slot, game = 'hp2') {
      const dr = await fetch('/api/' + game + 'dance/' + slot);
      if (!dr.ok) return false;
      st.setDance(await dr.json());
      const get = async (base, outfit) => { const r = await fetch('/api/' + game + 'char/' + base + '0/' + outfit); return r.ok ? st.addCharacter(await r.json()) : null; };
      const outfits = [1, 2, 3, 4].sort(() => Math.random() - 0.5);
      const pick = (lo, hi) => String(lo + Math.floor(Math.random() * (hi - lo + 1))).padStart(2, '0');
      const leadBase = game === 'hp3' ? pick(1, 15) : '01', backBase = game === 'hp3' ? pick(21, 32) : '09';
      let [lead, b1, b2] = await Promise.all([get(leadBase, 1 + Math.floor(Math.random() * 2)), get(backBase, outfits[0]), get(backBase, outfits[1])]);
      if (game === 'hp3' && !lead) lead = await get(leadBase, 1);               // (some have one outfit)
      // HP2 models are about 15 units tall; Hottest Party's stages (and HP1's dancers) are ~10x that
      const k = st.hp2 ? 1 : 10, sc = d => Object.assign(d, { scale: k });
      if (lead) st.dancers.push(sc({ ch: lead, group: 0, at: [0, 0, st.hp2 ? 0 : 120] }));
      if (b1) st.dancers.push(sc({ ch: b1, group: 1, at: [-10 * k, 0, st.hp2 ? -4 : -60] }));
      if (b2) st.dancers.push(sc({ ch: b2, group: 1, at: [10 * k, 0, st.hp2 ? -4 : -60] }));
      return st.dancers.length > 0;
    },
    async load(slot, stage) {
      const r = await fetch('/api/hpstage/' + slot + '?stage=' + encodeURIComponent(stage || 'random'));
      if (!r.ok) return null;
      return new Stage(await r.json());
    },
    // the song's dancers: your character in front, backup dancers around (where the stage puts them)
    async addDancers(st, slot, who) {
      const dr = await fetch('/api/hpdance/' + slot);
      if (!dr.ok) return false;
      st.setDance(await dr.json());
      const get = async id => { const r = await fetch('/api/hpchar/' + id); return r.ok ? st.addCharacter(await r.json()) : null; };
      // like the game (read from its memory in Dolphin): four backup dancers from two of the four outfit
      // pairs (c_101/102, 111/112, 121/122, 131/132). The two in the front spots (chr*2*1, chr*2*2) are
      // the opposite sex to the lead - a woman in front gets the men in suits - and the other two
      // stand further back
      const lead = await get(who || '001');
      const female = ['1', '2', '6'].includes(String(who || '001').slice(-1));        // EMI, JENNY, BLACK F (any outfit)
      const sets = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, 2);
      const F = ['101', '111', '121', '131'], M = ['102', '112', '122', '132'];
      // (two dumps from the real game: the back two were women once and men the next time - either way)
      const front = female ? M : F, back = Math.random() < 0.5 ? F : M;
      const ids = [front[sets[0]], front[sets[1]], back[sets[0]], back[sets[1]]];
      const chs = await Promise.all(ids.map(get));
      const sp = st.spots, at = (n, d) => sp[n] || d;
      if (lead) st.dancers.push({ ch: lead, group: 0, at: at('chr*1*1', [0, 0, 120]) });
      const spots = [['chr*2*1', [-110, 0, 110]], ['chr*2*2', [110, 0, 110]], ['chr*2*3', [-110, 0, -110]], ['chr*2*4', [110, 0, -110]]];
      chs.forEach((ch, k) => { if (ch) st.dancers.push({ ch, group: 1, at: at(spots[k][0], spots[k][1]) }); });
      return true;
    },
  };
})();
