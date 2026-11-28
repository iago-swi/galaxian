'use strict';
/* ---------------------------------------------------------------------------
   ART — paints every sprite procedurally into one texture atlas (Canvas 2D).
   The look is a naturalist's plate: natural colors, an ink outline, no glow.
   All sizes are in playfield units; the atlas is rendered at SS x for sharpness.
--------------------------------------------------------------------------- */
const ART = (() => {
  const SS = 2, SIZE = 2048, PAD = 12, TAU = Math.PI * 2, CORE_Y = 22, INK = '#0e1016';
  const canvas = document.createElement('canvas');
  const sprites = {};
  let c, cx = PAD, cy = PAD, rowH = 0;

  function add(name, w, h, draw) {
    const pw = Math.ceil(w * SS), ph = Math.ceil(h * SS);
    if (cx + pw + PAD > SIZE) { cx = PAD; cy += rowH + PAD; rowH = 0; }
    if (cy + ph + PAD > SIZE) console.error('atlas is full: ' + name);
    c.save();
    c.beginPath(); c.rect(cx, cy, pw, ph); c.clip();
    c.translate(cx + pw / 2, cy + ph / 2); c.scale(SS, SS);
    c.lineJoin = 'round'; c.lineCap = 'round';
    draw(w, h);
    c.restore();
    sprites[name] = { u0: cx / SIZE, v0: cy / SIZE, u1: (cx + pw) / SIZE, v1: (cy + ph) / SIZE, w, h };
    cx += pw + PAD; rowH = Math.max(rowH, ph);
  }
  let GLOW = 0; // painted glow is off in this look; a spec may switch it on for a single bird
  const glow = (col, blur) => { c.shadowColor = col; c.shadowBlur = blur * SS * GLOW; };
  const noGlow = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; };
  const ink = (w, a) => { c.globalAlpha = a === undefined ? 1 : a; c.strokeStyle = INK; c.lineWidth = w; c.stroke(); c.globalAlpha = 1; };
  function grad(x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }
  function rgrad(x0, y0, r0, x1, y1, r1, stops) {
    const g = c.createRadialGradient(x0, y0, r0, x1, y1, r1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }

  /* ---------- the flock (4 looping wing-beat frames each; p = phase) ----------
     Every bird is seen from above, beak pointing down the screen, and painted by
     one parametric routine. dark = body and inner wing, mid = wing and tail tips. */
  const BIRDS = {
    // small, sickle wings, long forked tail: slate blue
    swallow: {
      span: 27, fold: 0.3, wingY: 10, chord: 7, rootX: 2.5, wristX: 0.42, wristY: 3, tipY: -16, bulge: 2, trailY: -6, feathers: 5, notch: 2, flapY: 3,
      bodyY: 4, bl: 11, bw: 3.8, head: 4, beakL: 4.5, beakW: 1.8, tail: 'fork', tailL: 22, tailW: 8, darkTo: 0.62,
      dark: '#3f6490', mid: '#16233a', light: INK, line: INK, glow: '#000', eye: '#f2e9c9', eyeGlow: '#000', beak: '#c9703a',
    },
    // long narrow wings bent at the wrist, short fan tail: white with black tips
    gull: {
      span: 29, fold: 0.32, wingY: 11, chord: 9, rootX: 3, wristX: 0.45, wristY: 5.5, tipY: -7, bulge: 2, trailY: -1, feathers: 6, notch: 2.6, flapY: 3.5,
      bodyY: 3, bl: 12, bw: 5.2, head: 4.6, beakL: 6.5, beakW: 2, tail: 'fan', tailL: 9, tailW: 6, darkTo: 0.64,
      dark: '#e6eaec', mid: '#23272e', light: INK, line: INK, glow: '#000', eye: '#16181d', eyeGlow: '#000', beak: '#e0a43a',
    },
    // stooping hunter: broad pointed wings swept hard back, long narrow tail: brown
    falcon: {
      span: 24, fold: 0.22, wingY: 11, chord: 12, rootX: 3.2, wristX: 0.4, wristY: 4, tipY: -18, bulge: 3, trailY: -5, feathers: 5, notch: 2.2, flapY: 2.5,
      bodyY: 2, bl: 14, bw: 5.8, head: 5, beakL: 5, beakW: 2.3, tail: 'fan', tailL: 15, tailW: 4.6, darkTo: 0.64,
      dark: '#9a7650', mid: '#3e2c1c', light: INK, line: INK, glow: '#000', eye: '#f2e9c9', eyeGlow: '#000', beak: '#d8c080',
    },
    // the big one: broad wings with splayed finger feathers, wedge tail, red eyes: blue-black
    raven: {
      span: 34, fold: 0.28, wingY: 12, chord: 17, rootX: 4, wristX: 0.44, wristY: 4, tipY: -5, bulge: 3, trailY: -4, feathers: 6, notch: 3, flapY: 3,
      fingers: 5, fingerL: 13,
      bodyY: 2, bl: 16, bw: 7.5, head: 6.5, beakL: 9, beakW: 3.2, tail: 'wedge', tailL: 19, tailW: 9, darkTo: 0.5, eyeR: 2,
      dark: '#2a3148', mid: '#6d74a6', light: INK, line: INK, glow: '#000', eye: '#e2452c', eyeGlow: '#000', beak: '#565d74',
    },
  };

  // part: undefined = whole bird, 'body' = tail, body and head, 'wing' = the right wing alone
  function bird(p, o, part) {
    const f = Math.sin(p), g = Math.cos(p);
    const s = 1 - o.fold * (0.5 - 0.5 * f), span = o.span * s;          // raised wings look shorter from above
    const yF = o.wingY, yR = yF - o.chord, cy = (yF + yR) / 2;
    const tipX = span, tipY = yF + o.tipY + g * o.flapY - (1 - s) * 12;
    const wrX = span * o.wristX, wrY = yF + o.wristY + g * o.flapY * 0.4;
    const eX = o.fingers ? wrX + (tipX - wrX) * 0.6 : tipX, eY = o.fingers ? wrY + (tipY - wrY) * 0.6 : tipY;
    const hy = o.bodyY + o.bl - 1, yT = o.bodyY - o.bl + 3;
    const wingFill = rgrad(0, cy, 3, 0, cy, o.span * 1.05, o.hard ? [[0, o.dark], [o.darkTo, o.dark], [o.darkTo + 0.01, o.mid], [1, o.mid]] : [[0, o.dark], [o.darkTo, o.dark], [1, o.mid]]);

    // tail
    const tw = o.tailW, tl = o.tailL, sway = g * 0.8;
    if (part !== 'wing') {
      c.beginPath(); c.moveTo(-2.6, yT);
      if (o.tail === 'fork') { c.lineTo(-tw + sway, yT - tl); c.lineTo(sway * 0.5, yT - tl * 0.42); c.lineTo(tw + sway, yT - tl); }
      else if (o.tail === 'wedge') { c.lineTo(-tw + sway, yT - tl * 0.68); c.lineTo(sway, yT - tl); c.lineTo(tw + sway, yT - tl * 0.68); }
      else { c.lineTo(-tw + sway, yT - tl * 0.86); c.quadraticCurveTo(sway, yT - tl * 1.14, tw + sway, yT - tl * 0.86); }
      c.lineTo(2.6, yT); c.closePath();
      glow(o.glow, 6);
      c.fillStyle = grad(0, yT, 0, yT - tl, [[0, o.dark], [0.6, o.dark], [1, o.mid]]);
      c.fill(); c.strokeStyle = o.light; c.lineWidth = 1.1; c.stroke();
      noGlow();
      c.strokeStyle = o.line || o.mid; c.globalAlpha = o.noLines ? 0 : 0.34; c.lineWidth = 0.7;
      for (const k of [-0.5, 0, 0.5]) {
        c.beginPath(); c.moveTo(k * 2, yT - 2); c.lineTo(k * tw * 1.2 + sway, yT - tl * (o.tail === 'fork' ? 0.55 : 0.85)); c.stroke();
      }
      c.globalAlpha = 1;
    }

    for (const sg of part === 'wing' ? [1] : part === 'body' ? [] : [-1, 1]) {
      // splayed primary feathers at the wing tip
      if (o.fingers) {
        const bx = wrX + (tipX - wrX) * 0.45, by = wrY + (tipY - wrY) * 0.45, w = 2.4;
        for (let k = 0; k < o.fingers; k++) {
          const a = 0.6 - k * (1.55 / (o.fingers - 1)) + g * 0.08;
          const L = o.fingerL * (1 - Math.abs(k - (o.fingers - 1) / 2.4) * 0.07) * s;
          const dx = Math.cos(a), dy = Math.sin(a), nx = -dy * w, ny = dx * w;
          c.beginPath();
          c.moveTo(sg * (bx + nx), by + ny);
          c.quadraticCurveTo(sg * (bx + dx * L * 0.6 + nx * 1.25), by + dy * L * 0.6 + ny * 1.25, sg * (bx + dx * L), by + dy * L);
          c.quadraticCurveTo(sg * (bx + dx * L * 0.6 - nx * 1.25), by + dy * L * 0.6 - ny * 1.25, sg * (bx - nx), by - ny);
          c.closePath();
          glow(o.glow, 6); c.fillStyle = wingFill; c.fill();
          c.strokeStyle = o.light; c.lineWidth = 1.05; c.stroke();
        }
      }
      // wing: leading edge out to the tip, then a scalloped trailing edge back to the body
      const pts = [], n = o.feathers, cxT = span * 0.5, cyT = yR + o.trailY;
      c.beginPath();
      c.moveTo(sg * o.rootX, yF);
      c.quadraticCurveTo(sg * wrX * 0.5, wrY + o.bulge, sg * wrX, wrY);
      c.quadraticCurveTo(sg * (wrX + (eX - wrX) * 0.62), wrY + (eY - wrY) * 0.22, sg * eX, eY);
      let qx = eX, qy = eY;
      for (let i = 1; i <= n; i++) {
        const t = i / n, m = 1 - t;
        const ex = m * m * eX + 2 * m * t * cxT + t * t * o.rootX, ey = m * m * eY + 2 * m * t * cyT + t * t * yR;
        const d = o.notch * Math.pow(m + 0.15, 0.7) + 0.8;
        c.quadraticCurveTo(sg * ((qx + ex) / 2 + d * 0.3), (qy + ey) / 2 - d, sg * ex, ey);
        pts.push([ex, ey, t]); qx = ex; qy = ey;
      }
      c.closePath();
      glow(o.glow, 8);
      c.fillStyle = wingFill; c.fill();
      c.strokeStyle = o.light; c.lineWidth = 1.25; c.stroke();
      noGlow();
      c.strokeStyle = o.line || o.mid; c.globalAlpha = o.noLines ? 0 : 0.36; c.lineWidth = 0.75;
      for (let i = 0; i < n - 1; i++) {
        const ex = pts[i][0], ey = pts[i][1], u = 1 - pts[i][2];
        const lx = u < 0.5 ? o.rootX + (wrX - o.rootX) * u * 2 : wrX + (eX - wrX) * (u - 0.5) * 2;
        const ly = u < 0.5 ? yF + (wrY - yF) * u * 2 : wrY + (eY - wrY) * (u - 0.5) * 2;
        c.beginPath(); c.moveTo(sg * ex, ey); c.lineTo(sg * (ex + (lx - ex) * 0.7), ey + (ly - ey) * 0.7); c.stroke();
      }
      c.globalAlpha = 1;
    }

    if (part === 'wing') return;
    // body and head
    glow(o.glow, 6);
    c.fillStyle = o.dark; c.strokeStyle = o.light; c.lineWidth = 1.1;
    c.beginPath(); c.ellipse(0, o.bodyY, o.bw, o.bl, 0, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(0, hy, o.head, 0, TAU); c.fill(); c.stroke();
    noGlow();
    c.beginPath(); c.ellipse(0, o.bodyY, o.bw - 0.9, o.bl - 0.9, 0, 0, TAU); c.fill();
    c.beginPath(); c.arc(0, hy, o.head - 0.9, 0, TAU); c.fill();
    c.strokeStyle = o.line || o.mid; c.globalAlpha = o.noLines ? 0 : 0.3; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, yT + 2); c.lineTo(0, hy - 2); c.stroke();
    c.globalAlpha = 1;
    // beak
    glow(o.beak, 4); c.fillStyle = o.beak;
    c.beginPath(); c.moveTo(-o.beakW, hy + o.head * 0.55); c.lineTo(0, hy + o.head + o.beakL); c.lineTo(o.beakW, hy + o.head * 0.55); c.closePath(); c.fill();
    c.strokeStyle = o.light; c.lineWidth = 0.7; c.stroke();
    // eyes
    glow(o.eyeGlow, 6); c.fillStyle = o.eye;
    for (const sg of [-1, 1]) { c.beginPath(); c.arc(sg * o.head * 0.58, hy + o.head * 0.1, o.eyeR || 1.5, 0, TAU); c.fill(); }
    noGlow();
  }

  /* ---------- player ship (drawn nose-up): painted steel, red wing stripes ---------- */
  function ship() {
    c.beginPath();
    c.moveTo(0, -9); c.lineTo(30, 17); c.lineTo(27.5, 25); c.lineTo(10, 19.5); c.lineTo(0, 24);
    c.lineTo(-10, 19.5); c.lineTo(-27.5, 25); c.lineTo(-30, 17); c.closePath();
    c.fillStyle = grad(0, -9, 0, 25, [[0, '#b4bfca'], [1, '#5d6975']]);
    c.fill(); ink(1.1);
    c.strokeStyle = '#b8402c'; c.lineWidth = 2.6;
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 9, 3.5); c.lineTo(s * 24, 17); c.stroke(); }
    c.fillStyle = grad(0, 12, 0, 29, [[0, '#cfd6dd'], [1, '#59636e']]);
    for (const s of [-1, 1]) { c.beginPath(); c.roundRect(s * 9 - 3, 12, 6, 17, 2.4); c.fill(); ink(0.9); }
    c.beginPath(); c.moveTo(0, -33);
    c.bezierCurveTo(7.5, -17, 8.5, 6, 5.2, 27); c.lineTo(-5.2, 27);
    c.bezierCurveTo(-8.5, 6, -7.5, -17, 0, -33); c.closePath();
    c.fillStyle = grad(-8, 0, 8, 0, [[0, '#9aa5b0'], [0.42, '#f1f4f6'], [1, '#8c97a2']]);
    c.fill(); ink(1.1);
    c.fillStyle = grad(0, -18, 0, 0, [[0, '#cfe6f3'], [1, '#4f8fb8']]);
    c.beginPath(); c.ellipse(0, -9, 2.9, 8, 0, 0, TAU); c.fill(); ink(0.9);
    c.beginPath(); c.moveTo(-4.6, 9); c.lineTo(4.6, 9); c.moveTo(-5, 17); c.lineTo(5, 17); ink(0.8, 0.5);
  }

  function build() {
    canvas.width = canvas.height = SIZE;
    c = canvas.getContext('2d');

    // soft dot, used for haze, puffs and flames
    add('glow', 64, 64, () => {
      c.fillStyle = rgrad(0, 0, 0, 0, 0, 32, [[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,0.8)'], [0.3, 'rgba(255,255,255,0.36)'], [0.55, 'rgba(255,255,255,0.11)'], [0.8, 'rgba(255,255,255,0.025)'], [1, 'rgba(255,255,255,0)']]);
      c.fillRect(-32, -32, 64, 64);
    });
    add('ring', 128, 128, () => {
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.2; c.beginPath(); c.arc(0, 0, 54, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 50, 0, TAU); c.stroke();
    });
    // the ship's shot: a pale bar with an ink outline
    add('bolt', 16, 48, () => { c.fillStyle = '#f3e7a6'; c.beginPath(); c.roundRect(-2.4, -19, 4.8, 38, 2.4); c.fill(); ink(1); });
    // a bird's shot
    add('pellet', 18, 18, () => {
      c.fillStyle = rgrad(-1.5, -1.5, 0.5, 0, 0, 6, [[0, '#ffc9b4'], [0.5, '#e8573c'], [1, '#b8301c']]);
      c.beginPath(); c.arc(0, 0, 5.6, 0, TAU); c.fill(); ink(1.2);
    });
    // one feather, white so that it can be tinted
    add('feather', 14, 24, () => {
      c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(4.2, -3, 2.6, 6); c.lineTo(0, 10); c.lineTo(-2.6, 6); c.quadraticCurveTo(-4.2, -3, 0, -10); c.closePath();
      c.fillStyle = grad(-4, 0, 4, 0, [[0, '#d9d9d9'], [0.5, '#ffffff'], [1, '#cfcfcf']]); c.fill(); ink(0.7, 0.75);
      c.beginPath(); c.moveTo(0, -9); c.lineTo(0, 10); ink(0.6, 0.5);
    });
    add('ship', 76, 76, ship);
    add('flame', 24, 52, () => {
      c.fillStyle = grad(0, -22, 0, 24, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,240,210,0.8)'], [1, 'rgba(255,255,255,0)']]);
      c.beginPath(); c.moveTo(-5, -22); c.quadraticCurveTo(-6.5, 0, 0, 24); c.quadraticCurveTo(6.5, 0, 5, -22); c.closePath(); c.fill();
    });
    add('shield', 100, 100, () => {
      c.fillStyle = rgrad(0, 0, 22, 0, 0, 43, [[0, 'rgba(255,255,255,0)'], [0.8, 'rgba(255,255,255,0.14)'], [1, 'rgba(255,255,255,0.45)']]);
      c.beginPath(); c.arc(0, 0, 43, 0, TAU); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 43, 0, TAU); c.stroke();
      c.lineWidth = 3;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, 0, 43, k * TAU / 3, k * TAU / 3 + 0.7); c.stroke(); }
    });

    for (const name of ['swallow', 'gull', 'falcon'])
      for (let f = 0; f < 4; f++) add(name + f, 72, 72, () => bird(f / 4 * TAU, BIRDS[name]));
    // the great raven is kept in pieces: the body, and one wing that is mirrored for the other side
    for (let f = 0; f < 4; f++) {
      add('ravenB' + f, 96, 96, () => bird(f / 4 * TAU, BIRDS.raven, 'body'));
      add('ravenW' + f, 96, 96, () => bird(f / 4 * TAU, BIRDS.raven, 'wing'));
    }

    // egg of a great raven: pale green, speckled
    add('egg', 48, 60, () => {
      c.beginPath();
      c.moveTo(0, -24); c.bezierCurveTo(13, -24, 18, -4, 18, 6); c.bezierCurveTo(18, 18, 9, 25, 0, 25);
      c.bezierCurveTo(-9, 25, -18, 18, -18, 6); c.bezierCurveTo(-18, -4, -13, -24, 0, -24); c.closePath();
      c.fillStyle = rgrad(-5, -8, 2, 0, 2, 28, [[0, '#dcefe4'], [0.55, '#a9cbbb'], [1, '#6f9684']]);
      c.fill(); ink(1.3);
      c.fillStyle = 'rgba(92,64,40,0.85)';
      for (const [x, y, r] of [[-6, -10, 1.5], [5, -4, 1.9], [-9, 6, 1.3], [3, 10, 2.1], [9, 3, 1.2], [-2, -17, 1.1], [-3, 16, 1.4], [10, -12, 1.0], [-11, -3, 0.9], [7, 17, 1.1]]) {
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-7, -11, 2.6, 6, 0.45, 0, TAU); c.fill();
    });

    // the Aerie: armour plate, its eye, the shutter over the eye, and the hull
    add('plate', 26, 18, () => {
      c.fillStyle = grad(0, -6, 0, 6, [[0, '#ffffff'], [1, '#aeb2b8']]);
      c.beginPath(); c.roundRect(-9.5, -5.5, 19, 11, 2); c.fill(); ink(1.1);
      c.fillStyle = 'rgba(14,16,22,0.7)';
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 6.4, 0, 0.9, 0, TAU); c.fill(); }
    });
    add('core', 64, 64, () => {
      c.fillStyle = rgrad(0, 0, 1, 0, 0, 24, [[0, '#fff0c0'], [0.3, '#f6c04a'], [0.72, '#de7226'], [1, '#9a2f18']]);
      c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill(); ink(1.6);
      c.strokeStyle = 'rgba(90,30,10,0.45)'; c.lineWidth = 1;
      for (let k = 0; k < 18; k++) { const a = k * TAU / 18; c.beginPath(); c.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); c.lineTo(Math.cos(a) * 21, Math.sin(a) * 21); c.stroke(); }
      c.fillStyle = '#0a0b10'; c.beginPath(); c.ellipse(0, 0, 4.4, 13.5, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(-7, -9, 2.6, 0, TAU); c.fill();
    });
    add('lid', 64, 64, () => {
      c.fillStyle = grad(0, -26, 0, 26, [[0, '#7a869c'], [1, '#3a4254']]);
      c.beginPath(); c.arc(0, 0, 26.5, 0, TAU); c.fill(); ink(1.6);
      for (const y of [-16, -8, 8, 16]) { const w = Math.sqrt(26 * 26 - y * y) - 2; c.beginPath(); c.moveTo(-w, y); c.lineTo(w, y); ink(0.9, 0.5); }
      c.beginPath(); c.moveTo(-24, 0); c.quadraticCurveTo(0, 5, 24, 0); ink(2.4);
      c.fillStyle = 'rgba(14,16,22,0.75)';
      for (const [x, y] of [[-14, -12], [14, -12], [-14, 12], [14, 12]]) { c.beginPath(); c.arc(x, y, 1.1, 0, TAU); c.fill(); }
    });
    add('aerie', 700, 240, () => {
      const fx = k => -330 + k / 8 * 262, fy = k => 10 - 82 * Math.pow(k / 8, 0.8);
      const hull = () => {
        c.beginPath();
        c.moveTo(-330, 10);
        for (let k = 1; k <= 8; k++) c.quadraticCurveTo((fx(k - 1) + fx(k)) / 2 - 8, (fy(k - 1) + fy(k)) / 2 - 17, fx(k), fy(k)); // left wing feathers
        c.lineTo(-50, -110); c.lineTo(-24, -96); c.lineTo(0, -114); c.lineTo(24, -96); c.lineTo(50, -110);                          // tail
        c.lineTo(-fx(8), fy(8));
        for (let k = 7; k >= 0; k--) c.quadraticCurveTo(-(fx(k + 1) + fx(k)) / 2 + 8, (fy(k + 1) + fy(k)) / 2 - 17, -fx(k), fy(k));
        c.lineTo(300, 34); c.lineTo(140, 48); c.lineTo(30, 52); c.lineTo(27, 38);
        c.arc(0, CORE_Y, 31, 0.55, Math.PI - 0.55, true);
        c.lineTo(-30, 52); c.lineTo(-140, 48); c.lineTo(-300, 34);
        c.closePath();
      };
      hull();
      c.fillStyle = grad(0, -112, 0, 55, [[0, '#7d889d'], [0.45, '#4d576b'], [1, '#262d3d']]);
      c.fill();
      c.save(); hull(); c.clip();
      // feather-like ribs across the wings, and two bands that follow the wing line
      c.strokeStyle = INK; c.globalAlpha = 0.32; c.lineWidth = 1;
      for (const s of [-1, 1]) for (let k = 0; k < 11; k++) {
        const x = s * (70 + k * 24);
        c.beginPath(); c.moveTo(x, -100); c.quadraticCurveTo(x + s * 14, -20, x + s * 34, 60); c.stroke();
      }
      c.globalAlpha = 0.4; c.lineWidth = 1.3;
      for (const d of [20, 36]) { c.beginPath(); c.moveTo(-330, 10 + d); c.bezierCurveTo(-250, -30 + d, -170, -58 + d, -68, -72 + d); c.lineTo(68, -72 + d); c.bezierCurveTo(170, -58 + d, 250, -30 + d, 330, 10 + d); c.stroke(); }
      c.globalAlpha = 1;
      // a lighter sheen along the top of the wings
      c.fillStyle = grad(0, -112, 0, -20, [[0, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(-340, -116, 680, 100);
      c.restore();
      hull(); ink(2);
      // lit windows along the wings
      for (const s of [-1, 1]) for (let k = 0; k < 9; k++) {
        const x = s * (62 + k * 26), y = -22 + Math.pow(Math.abs(x) / 330, 2) * 46;
        c.fillStyle = '#f2d58c'; c.beginPath(); c.roundRect(x - 4, y - 1.6, 8, 3.2, 1.2); c.fill(); ink(0.7);
      }
      // spine
      c.beginPath(); c.moveTo(0, -100); c.lineTo(0, -16); ink(1.6);
      for (const y of [-84, -66, -48]) { c.beginPath(); c.moveTo(-16, y - 7); c.lineTo(0, y); c.lineTo(16, y - 7); ink(1.3); }
      for (const s of [-1, 1]) {
        // engine vents
        c.fillStyle = '#b8553a'; c.beginPath(); c.roundRect(s * 37 - 9, -106, 18, 5, 2.5); c.fill(); ink(0.9);
        // launch bay
        c.fillStyle = '#0c0e14'; c.beginPath(); c.roundRect(s * 285 - 17, 20, 34, 7, 3); c.fill();
        c.strokeStyle = '#c9a45a'; c.lineWidth = 1.4; c.stroke();
        // turret
        c.fillStyle = '#c9a45a'; c.beginPath(); c.arc(s * 215, 40, 8.5, 0, TAU); c.fill(); ink(1.4);
        c.fillStyle = '#0c0e14'; c.beginPath(); c.arc(s * 215, 42, 3.4, 0, TAU); c.fill();
      }
      // brass rim around the eye socket
      c.strokeStyle = '#c9a45a'; c.lineWidth = 2.2; c.beginPath(); c.arc(0, CORE_Y, 31, 0.55, Math.PI - 0.55, true); c.stroke();
    });

    // power-ups: a pale tag with a dark icon, tinted at draw time
    const hex = () => {
      c.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + TAU / 12; c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * 16, Math.sin(a) * 16); }
      c.closePath();
      c.fillStyle = '#ffffff'; c.fill(); ink(1.5);
    };
    add('pw_twin', 44, 44, () => {
      hex(); c.fillStyle = INK;
      for (const s of [-1, 1]) { c.beginPath(); c.roundRect(s * 4.5 - 1.8, -8, 3.6, 16, 1.8); c.fill(); }
    });
    add('pw_rapid', 44, 44, () => {
      hex();
      for (const y of [-1, 6]) { c.beginPath(); c.moveTo(-7, y); c.lineTo(0, y - 7); c.lineTo(7, y); ink(2.6); }
    });

    // digits for the points that rise from a kill
    for (const ch of '0123456789x+') add('g' + ch, 14, 22, () => {
      c.font = 'bold 19px Georgia, "Times New Roman", serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.strokeStyle = INK; c.lineWidth = 2.6; c.strokeText(ch, 0, 1);
      c.fillStyle = '#ffffff'; c.fillText(ch, 0, 1);
    });
  }

  // paint one bird into any 2D context (used to try out other looks)
  function paintBird(ctx, p, spec, part) {
    const prev = c, g0 = GLOW;
    c = ctx; GLOW = spec.glowK || 0; c.lineJoin = 'round'; c.lineCap = 'round';
    bird(p, spec, part);
    c = prev; GLOW = g0;
  }

  return { build, canvas, sprites, BIRDS, paintBird };
})();
