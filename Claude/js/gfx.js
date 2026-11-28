'use strict';
/* ---------------------------------------------------------------------------
   GFX — tiny WebGL2 renderer.
   Pipeline per frame:
     dusk sky (half-res) -> background (horizon silhouette) -> sprite batch (HDR)
     -> bloom (prefilter, downsample chain, upsample chain)
     -> final composite (shockwaves, chromatic aberration, vignette, tonemap, grain)
--------------------------------------------------------------------------- */
const GFX = (() => {
  const FW = 800, FH = 900, MAXQ = 14000, FPV = 9;
  let canvas, gl, hdr = false, W = 0, H = 0;
  const vb = new Float32Array(MAXQ * 4 * FPV);
  let qn = 0, P = {}, vao, vbo, triVao, atlas, scene, neb, bloom = [];
  const view = { s: 1, ox: 0, oy: 0 };
  const fx = { time: 0, scroll: 0, hue: 0, aberr: 0, flash: 0, shx: 0, shy: 0, warp: 0 };
  const shocks = [];
  for (let i = 0; i < 8; i++) shocks.push({ x: 0, y: 0, age: 0, life: 0, str: 0, spd: 0 });
  let shockI = 0;
  const shockU = new Float32Array(32);

  const HEAD = '#version 300 es\nprecision highp float;\n';
  const NOISE = `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = m * p; a *= 0.5; }
  return s;
}
vec3 pal(float t){ return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
`;

  const VS_TRI = '#version 300 es\n' + `
out vec2 vUv;
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  // Dusk sky, rendered at half resolution (it is soft anyway): gradient, stars, moon, drifting clouds.
  const FS_NEB = HEAD + NOISE + `
out vec4 o;
uniform vec2 uRes; uniform float uTime, uScroll, uHue;
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float h = uv.y + 0.5;
  vec3 tint = pal(uHue + 0.92);
  vec3 ember = mix(vec3(0.55, 0.38, 0.28), tint, 0.4) * 0.5;         // the last light on the horizon
  vec3 slate = mix(vec3(0.075, 0.095, 0.125), tint * 0.1, 0.2);
  vec3 col = mix(slate, vec3(0.020, 0.030, 0.056), smoothstep(0.3, 1.0, h));
  col = mix(col, ember, pow(clamp(1.0 - h, 0.0, 1.0), 2.6) * 0.85);
  // a few faint stars high up
  vec2 g = uv * 44.0, id = floor(g), f = fract(g); float r = hash(id + 3.0);
  if (r > 0.92) {
    vec2 q = f - (vec2(hash(id + 5.1), hash(id + 9.7)) * 0.6 + 0.2);
    col += vec3(0.8, 0.85, 1.0) * exp(-dot(q, q) * 500.0) * (0.3 + 0.2 * sin(uTime * (1.0 + r * 3.0) + r * 80.0)) * smoothstep(0.45, 0.9, h);
  }
  // a pale moon
  vec2 mp = uv - vec2(0.27, 0.31); float md = length(mp);
  if (md < 0.06) {
    float lit = smoothstep(-0.05, 0.035, dot(mp, normalize(vec2(-0.55, 0.6))));
    vec3 moon = vec3(0.62, 0.63, 0.58) * (0.7 + 0.3 * fbm(mp * 36.0 + 4.0)) * (0.25 + 0.75 * lit);
    col = mix(col, moon, smoothstep(0.05, 0.046, md));
  }
  col += vec3(0.5, 0.55, 0.6) * 0.07 * exp(-max(md - 0.046, 0.0) * 14.0);
  // clouds: wide and flat, drifting sideways, lit from below by the horizon
  vec2 p = vec2(uv.x * 1.25 + uScroll * 0.012, uv.y * 3.4);
  vec2 w = vec2(fbm(p * 0.7 + 3.1), fbm(p * 0.7 + vec2(7.7, 1.9))) * 0.7;
  float c1 = fbm(p + w + vec2(0.0, uTime * 0.003));
  float c2 = fbm(p + w + vec2(0.0, uTime * 0.003 - 0.16));
  float cover = smoothstep(0.36, 0.64, c1) * smoothstep(0.03, 0.28, h);
  vec3 cloud = mix(vec3(0.052, 0.062, 0.082), ember * 0.95 + 0.02, pow(clamp(1.0 - h, 0.0, 1.0), 1.6));
  cloud *= 1.0 + clamp((c1 - c2) * 8.0, -0.6, 1.3);
  col = mix(col, cloud, cover * 0.88);
  o = vec4(col, 1.0);
}`;

  // Full resolution: the sky, plus a crisp silhouette along the bottom (ridge, hills, poles, wires, perched birds).
  const FS_BG = HEAD + NOISE + `
in vec2 vUv; out vec4 o;
uniform sampler2D uNeb; uniform vec2 uRes;
float wireY(float t, float y0, float sag){ return y0 - sag * 4.0 * t * (1.0 - t); }
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float h = uv.y + 0.5, x = uv.x, px = 1.0 / uRes.y;
  vec3 col = texture(uNeb, vUv).rgb;
  if (h < 0.22) {
    float far = 0.088 + 0.034 * noise(vec2(x * 1.3 + 11.0, 4.0));
    col = mix(col, col * 0.3 + vec3(0.004, 0.006, 0.010), smoothstep(far + px, far - px, h));
    float hill = 0.048 + 0.036 * noise(vec2(x * 2.2 + 3.0, 1.5)) + 0.016 * noise(vec2(x * 7.0, 8.2));
    float sil = smoothstep(hill + px, hill - px, h);
    const float CELL = 0.62;
    float xs = x + 0.31 + CELL * 0.5, lx = xs - floor(xs / CELL) * CELL - CELL * 0.5;   // distance to the nearest pole
    sil = max(sil, step(abs(lx), 0.0032) * step(h, 0.186));
    sil = max(sil, step(abs(lx), 0.030) * step(abs(h - 0.172), 0.0026));
    sil = max(sil, step(abs(lx), 0.021) * step(abs(h - 0.156), 0.0024));
    float xw = x + 0.31, wi = floor(xw / CELL), t = xw / CELL - wi;                     // t: 0 at a pole, 1 at the next
    sil = max(sil, smoothstep(1.7 * px, 0.7 * px, abs(h - wireY(t, 0.172, 0.030))));
    sil = max(sil, smoothstep(1.7 * px, 0.7 * px, abs(h - wireY(t, 0.156, 0.037))));
    for (int k = 0; k < 5; k++) {   // birds perched on the upper wire
      float fk = float(k), r = hash(vec2(wi * 3.7 + fk, 2.0));
      if (r < 0.4) continue;
      float tb = 0.12 + 0.76 * hash(vec2(wi + 0.5, fk * 5.3 + 1.0)), s = sign(r - 0.7);
      vec2 d = vec2(x, h) - vec2((wi + tb) * CELL - 0.31, wireY(tb, 0.172, 0.030) + 0.0075);
      float body = length(d / vec2(0.0052, 0.0075));
      float head = length((d - vec2(0.0022 * s, 0.0078)) / vec2(0.0034));
      float tail = length((d - vec2(-0.0040 * s, -0.0070)) / vec2(0.0022, 0.0058));
      sil = max(sil, smoothstep(1.08, 0.92, min(body, min(head, tail))));
    }
    col = mix(col, vec3(0.004, 0.006, 0.010), sil);
    // a few lit windows on the near hill
    float wid = floor(x * 70.0);
    if (hash(vec2(wid, 9.0)) > 0.86) {
      vec2 wd = abs(vec2(x, h) - vec2((wid + 0.5) / 70.0, hill * (0.25 + 0.5 * hash(vec2(wid, 4.0)))));
      col += vec3(0.55, 0.38, 0.16) * 0.55 * step(wd.x, 0.0022) * step(wd.y, 0.0018) * step(h, hill - 0.004);
    }
  }
  o = vec4(col, 1.0);
}`;

  const VS_SPR = '#version 300 es\n' + `
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
layout(location = 2) in vec4 aCol;
layout(location = 3) in float aAdd;
uniform vec4 uView;
out vec2 vUv; out vec4 vCol; out float vAdd;
void main(){ vUv = aUv; vCol = aCol; vAdd = aAdd; gl_Position = vec4(aPos * uView.xy + uView.zw, 0.0, 1.0); }`;

  // Premultiplied output. alpha -> 0 when additive, so one blend mode serves both.
  const FS_SPR = HEAD + `
in vec2 vUv; in vec4 vCol; in float vAdd; out vec4 o;
uniform sampler2D uTex;
void main(){ vec4 t = texture(uTex, vUv); o = vec4(t.rgb * vCol.rgb * vCol.a, t.a * vCol.a * (1.0 - vAdd)); }`;

  const FS_PRE = HEAD + `
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uThr, uKnee;
void main(){
  vec3 c = (texture(uTex, vUv + uTexel * vec2(-1, -1)).rgb + texture(uTex, vUv + uTexel * vec2(1, -1)).rgb
          + texture(uTex, vUv + uTexel * vec2(-1, 1)).rgb + texture(uTex, vUv + uTexel * vec2(1, 1)).rgb) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThr + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  c *= max(soft, br - uThr) / max(br, 1e-4);
  o = vec4(min(c, vec3(24.0)), 1.0);
}`;

  const FS_DOWN = HEAD + `
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel;
void main(){
  vec3 s = texture(uTex, vUv).rgb * 4.0;
  s += texture(uTex, vUv + uTexel * vec2(-1, -1)).rgb + texture(uTex, vUv + uTexel * vec2(1, -1)).rgb;
  s += texture(uTex, vUv + uTexel * vec2(-1, 1)).rgb + texture(uTex, vUv + uTexel * vec2(1, 1)).rgb;
  o = vec4(s / 8.0, 1.0);
}`;

  const FS_UP = HEAD + `
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel;
void main(){
  vec4 d = uTexel.xyxy * vec4(1, 1, -1, 0);
  vec3 s = texture(uTex, vUv - d.xy).rgb + texture(uTex, vUv - d.wy).rgb * 2.0 + texture(uTex, vUv - d.zy).rgb;
  s += texture(uTex, vUv + d.zw).rgb * 2.0 + texture(uTex, vUv).rgb * 4.0 + texture(uTex, vUv + d.xw).rgb * 2.0;
  s += texture(uTex, vUv + d.zy).rgb + texture(uTex, vUv + d.wy).rgb * 2.0 + texture(uTex, vUv + d.xy).rgb;
  o = vec4(s / 16.0, 1.0);
}`;

  const FS_FIN = HEAD + `
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uBloom; uniform vec2 uRes;
uniform float uTime, uAberr, uFlash, uBloomK; uniform vec4 uShock[8];
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 samp(vec2 uv){ return texture(uScene, uv).rgb + texture(uBloom, uv).rgb * uBloomK; }
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec2 asp = vec2(uRes.x / uRes.y, 1.0), uv = vUv;
  for (int i = 0; i < 8; i++) {
    vec4 s = uShock[i];
    if (s.w > 0.00005) {
      vec2 d = (vUv - s.xy) * asp; float l = length(d) + 1e-5, w = l - s.z;
      uv -= (d / l) / asp * exp(-w * w * 520.0) * s.w;
    }
  }
  vec2 c = uv - 0.5; float r2 = dot(c, c);
  vec2 ab = c * (uAberr + r2 * 0.002);
  vec3 col = vec3(samp(uv + ab).r, samp(uv).g, samp(uv - ab).b);
  col += uFlash * vec3(1.0, 0.92, 0.8);
  col *= 1.0 - smoothstep(0.12, 0.95, r2 * 1.7) * 0.78;
  col = aces(col * 1.08);
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.04;
  o = vec4(col, 1.0);
}`;

  function prog(vs, fs) {
    const p = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(t);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  function target(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (hdr) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }
  const free = t => { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); } };

  function init(cv) {
    canvas = cv;
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl) return false;
    hdr = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    P.neb = prog(VS_TRI, FS_NEB); P.bg = prog(VS_TRI, FS_BG); P.spr = prog(VS_SPR, FS_SPR);
    P.pre = prog(VS_TRI, FS_PRE); P.down = prog(VS_TRI, FS_DOWN); P.up = prog(VS_TRI, FS_UP); P.fin = prog(VS_TRI, FS_FIN);

    triVao = gl.createVertexArray();
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, vb.byteLength, gl.DYNAMIC_DRAW);
    const st = FPV * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, st, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, st, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, st, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, st, 32);
    const idx = new Uint16Array(MAXQ * 6);
    for (let i = 0; i < MAXQ; i++) {
      const v = i * 4, o = i * 6;
      idx[o] = v; idx[o + 1] = v + 1; idx[o + 2] = v + 2; idx[o + 3] = v; idx[o + 4] = v + 2; idx[o + 5] = v + 3;
    }
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    resize();
    return true;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = Math.max(2, Math.floor(canvas.clientWidth * dpr)), h = Math.max(2, Math.floor(canvas.clientHeight * dpr));
    const maxPx = 2560 * 1440;
    if (w * h > maxPx) { const k = Math.sqrt(maxPx / (w * h)); w = Math.floor(w * k); h = Math.floor(h * k); }
    if (w === W && h === H) return false;
    W = w; H = h; canvas.width = W; canvas.height = H;
    free(scene); free(neb); bloom.forEach(free);
    scene = target(W, H);
    neb = target(Math.max(1, W >> 1), Math.max(1, H >> 1));
    bloom = [];
    let bw = W >> 1, bh = H >> 1;
    for (let i = 0; i < 6 && bw >= 4 && bh >= 4; i++) { bloom.push(target(bw, bh)); bw >>= 1; bh >>= 1; }
    view.s = Math.min(W / FW, H / FH);
    view.ox = (W - FW * view.s) / 2;
    view.oy = (H - FH * view.s) / 2;
    return true;
  }

  function setAtlas(cv) {
    atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // Queue one textured quad. add = 0 normal (premultiplied alpha), 1 = additive light.
  function quad(sp, x, y, w, h, rot, r, g, b, a, add) {
    if (qn >= MAXQ) return;
    const hw = w * 0.5, hh = h * 0.5;
    let c = 1, s = 0;
    if (rot) { c = Math.cos(rot); s = Math.sin(rot); }
    const ax = c * hw, ay = s * hw, bx = -s * hh, by = c * hh;
    let o = qn * 36; qn++;
    vb[o] = x - ax - bx; vb[o + 1] = y - ay - by; vb[o + 2] = sp.u0; vb[o + 3] = sp.v0;
    vb[o + 4] = r; vb[o + 5] = g; vb[o + 6] = b; vb[o + 7] = a; vb[o + 8] = add; o += 9;
    vb[o] = x + ax - bx; vb[o + 1] = y + ay - by; vb[o + 2] = sp.u1; vb[o + 3] = sp.v0;
    vb[o + 4] = r; vb[o + 5] = g; vb[o + 6] = b; vb[o + 7] = a; vb[o + 8] = add; o += 9;
    vb[o] = x + ax + bx; vb[o + 1] = y + ay + by; vb[o + 2] = sp.u1; vb[o + 3] = sp.v1;
    vb[o + 4] = r; vb[o + 5] = g; vb[o + 6] = b; vb[o + 7] = a; vb[o + 8] = add; o += 9;
    vb[o] = x - ax + bx; vb[o + 1] = y - ay + by; vb[o + 2] = sp.u0; vb[o + 3] = sp.v1;
    vb[o + 4] = r; vb[o + 5] = g; vb[o + 6] = b; vb[o + 7] = a; vb[o + 8] = add;
  }

  function shock(x, y, str, spd, life) {
    const s = shocks[shockI]; shockI = (shockI + 1) % 8;
    s.x = x; s.y = y; s.str = str; s.spd = spd || 500; s.life = life || 0.7; s.age = 0;
  }

  function bindT(t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null); gl.viewport(0, 0, t ? t.w : W, t ? t.h : H); }
  function tex(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }
  const tri = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

  function render(dt) {
    resize();
    for (let i = 0; i < 8; i++) {
      const s = shocks[i], o = i * 4;
      if (s.age < s.life) {
        s.age += dt;
        const k = Math.max(0, 1 - s.age / s.life);
        shockU[o] = (s.x * view.s + view.ox) / W;
        shockU[o + 1] = 1 - (s.y * view.s + view.oy) / H;
        shockU[o + 2] = s.age * s.spd * view.s / H;
        shockU[o + 3] = s.str * k * k;
      } else shockU[o + 3] = 0;
    }

    gl.disable(gl.BLEND);
    gl.bindVertexArray(triVao);
    let u;

    bindT(neb); gl.useProgram(P.neb.p); u = P.neb.u;
    gl.uniform2f(u.uRes, neb.w, neb.h); gl.uniform1f(u.uTime, fx.time); gl.uniform1f(u.uScroll, fx.scroll); gl.uniform1f(u.uHue, fx.hue);
    tri();

    bindT(scene); gl.useProgram(P.bg.p); u = P.bg.u;
    tex(0, neb.tex); gl.uniform1i(u.uNeb, 0);
    gl.uniform2f(u.uRes, W, H);
    tri();

    if (qn) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(P.spr.p); u = P.spr.u;
      tex(0, atlas); gl.uniform1i(u.uTex, 0);
      gl.uniform4f(u.uView, 2 * view.s / W, -2 * view.s / H,
        2 * (view.ox + fx.shx * view.s) / W - 1, 1 - 2 * (view.oy + fx.shy * view.s) / H);
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, vb, 0, qn * 36);
      gl.drawElements(gl.TRIANGLES, qn * 6, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(triVao);
      gl.disable(gl.BLEND);
    }
    qn = 0;

    const n = bloom.length;
    if (n) {
      bindT(bloom[0]); gl.useProgram(P.pre.p); u = P.pre.u;
      tex(0, scene.tex); gl.uniform1i(u.uTex, 0); gl.uniform2f(u.uTexel, 1 / W, 1 / H);
      gl.uniform1f(u.uThr, hdr ? 0.8 : 0.55); gl.uniform1f(u.uKnee, 0.4);
      tri();
      gl.useProgram(P.down.p); u = P.down.u; gl.uniform1i(u.uTex, 0);
      for (let i = 1; i < n; i++) {
        bindT(bloom[i]); tex(0, bloom[i - 1].tex);
        gl.uniform2f(u.uTexel, 1 / bloom[i - 1].w, 1 / bloom[i - 1].h);
        tri();
      }
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(P.up.p); u = P.up.u; gl.uniform1i(u.uTex, 0);
      for (let i = n - 2; i >= 0; i--) {
        bindT(bloom[i]); tex(0, bloom[i + 1].tex);
        gl.uniform2f(u.uTexel, 1 / bloom[i + 1].w, 1 / bloom[i + 1].h);
        tri();
      }
      gl.disable(gl.BLEND);
    }

    bindT(null); gl.useProgram(P.fin.p); u = P.fin.u;
    tex(0, scene.tex); gl.uniform1i(u.uScene, 0);
    tex(1, n ? bloom[0].tex : scene.tex); gl.uniform1i(u.uBloom, 1);
    gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uTime, fx.time);
    gl.uniform1f(u.uAberr, fx.aberr); gl.uniform1f(u.uFlash, fx.flash);
    gl.uniform1f(u.uBloomK, n ? (hdr ? 0.26 : 0.4) : 0);
    gl.uniform4fv(u.uShock, shockU);
    tri();
  }

  // client px -> playfield x
  const toFieldX = cx => (cx * (W / canvas.clientWidth) - view.ox) / view.s;
  const fieldCssWidth = () => FW * view.s * (canvas.clientWidth / W);

  return { init, setAtlas, quad, shock, render, fx, toFieldX, fieldCssWidth, FW, FH };
})();
