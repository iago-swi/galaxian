'use strict';
/* ---------------------------------------------------------------------------
   ART — paints every sprite procedurally into one texture atlas (Canvas 2D).
   All sizes are in playfield units; the atlas is rendered at SS x for sharpness.
--------------------------------------------------------------------------- */
const ART = (() => {
  const SS = 2, SIZE = 2048, PAD = 12, TAU = Math.PI * 2, CORE_Y = 22;
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
  const glow = (col, blur) => { c.shadowColor = col; c.shadowBlur = blur * SS; };
  const noGlow = () => { c.shadowColor = 'transparent'; c.shadowBlur = 0; };
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
     one parametric routine. Dark body + neon feather edges = backlit silhouette. */
  const BIRDS = {
    // small, sickle wings, long forked tail
    swallow: {
      span: 27, fold: 0.3, wingY: 10, chord: 7, rootX: 2.5, wristX: 0.42, wristY: 3, tipY: -16, bulge: 2, trailY: -6, feathers: 5, notch: 2, flapY: 3,
      bodyY: 4, bl: 11, bw: 3.8, head: 4, beakL: 4.5, beakW: 1.8, tail: 'fork', tailL: 22, tailW: 8, darkTo: 0.62,
      dark: 'rgba(3,18,32,0.95)', mid: 'rgba(30,190,255,0.92)', light: '#d8ffff', glow: '#22e0ff', eye: '#ffffff', eyeGlow: '#aaffff', beak: '#fff0b0',
    },
    // long narrow wings bent at the wrist, short fan tail
    gull: {
      span: 29, fold: 0.32, wingY: 11, chord: 9, rootX: 3, wristX: 0.45, wristY: 5.5, tipY: -7, bulge: 2, trailY: -1, feathers: 6, notch: 2.6, flapY: 3.5,
      bodyY: 3, bl: 12, bw: 5.2, head: 4.6, beakL: 6.5, beakW: 2, tail: 'fan', tailL: 9, tailW: 6, darkTo: 0.64,
      dark: 'rgba(30,6,34,0.95)', mid: 'rgba(255,60,190,0.92)', light: '#ffe0f6', glow: '#ff30b8', eye: '#c8ffff', eyeGlow: '#60ffff', beak: '#ffe9a0',
    },
    // stooping hunter: broad pointed wings swept hard back, long narrow tail
    falcon: {
      span: 24, fold: 0.22, wingY: 11, chord: 12, rootX: 3.2, wristX: 0.4, wristY: 4, tipY: -18, bulge: 3, trailY: -5, feathers: 5, notch: 2.2, flapY: 2.5,
      bodyY: 2, bl: 14, bw: 5.8, head: 5, beakL: 5, beakW: 2.3, tail: 'fan', tailL: 15, tailW: 4.6, darkTo: 0.64,
      dark: 'rgba(34,14,2,0.95)', mid: 'rgba(255,150,30,0.94)', light: '#fff6d0', glow: '#ffa020', eye: '#ffffff', eyeGlow: '#ffe080', beak: '#ffffff',
    },
    // the big one: broad wings with splayed finger feathers, wedge tail, red eyes
    raven: {
      span: 34, fold: 0.28, wingY: 12, chord: 17, rootX: 4, wristX: 0.44, wristY: 4, tipY: -5, bulge: 3, trailY: -4, feathers: 6, notch: 3, flapY: 3,
      fingers: 5, fingerL: 13,
      bodyY: 2, bl: 16, bw: 7.5, head: 6.5, beakL: 9, beakW: 3.2, tail: 'wedge', tailL: 19, tailW: 9, darkTo: 0.78, eyeR: 2,
      dark: 'rgba(2,8,10,0.97)', mid: 'rgba(20,200,130,0.92)', light: '#d0ffe6', glow: '#20ff90', eye: '#ff4050', eyeGlow: '#ff1030', beak: '#c8ffe0',
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
    const wingFill = rgrad(0, cy, 3, 0, cy, o.span * 1.05, [[0, o.dark], [o.darkTo, o.dark], [1, o.mid]]);

    // tail
    const tw = o.tailW, tl = o.tailL, sway = g * 0.8;
    if (part !== 'wing') {
    c.beginPath(); c.moveTo(-2.6, yT);
    if (o.tail === 'fork') { c.lineTo(-tw + sway, yT - tl); c.lineTo(sway * 0.5, yT - tl * 0.42); c.lineTo(tw + sway, yT - tl); }
    else if (o.tail === 'wedge') { c.lineTo(-tw + sway, yT - tl * 0.68); c.lineTo(sway, yT - tl); c.lineTo(tw + sway, yT - tl * 0.68); }
    else { c.lineTo(-tw + sway, yT - tl * 0.86); c.quadraticCurveTo(sway, yT - tl * 1.14, tw + sway, yT - tl * 0.86); }
    c.lineTo(2.6, yT); c.closePath();
    glow(o.glow, 6);
    c.fillStyle = grad(0, yT, 0, yT - tl, [[0, o.dark], [0.72, o.dark], [1, o.mid]]);
    c.fill(); c.strokeStyle = o.light; c.lineWidth = 1.1; c.stroke();
    noGlow();
    c.strokeStyle = o.mid; c.globalAlpha = 0.34; c.lineWidth = 0.7;
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
      c.strokeStyle = o.mid; c.globalAlpha = 0.36; c.lineWidth = 0.75;
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
    c.strokeStyle = o.mid; c.globalAlpha = 0.45; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, yT + 2); c.lineTo(0, hy - 2); c.stroke();
    c.globalAlpha = 1;
    // beak
    glow(o.beak, 4); c.fillStyle = o.beak;
    c.beginPath(); c.moveTo(-o.beakW, hy + o.head * 0.55); c.lineTo(0, hy + o.head + o.beakL); c.lineTo(o.beakW, hy + o.head * 0.55); c.closePath(); c.fill();
    // eyes
    glow(o.eyeGlow, 6); c.fillStyle = o.eye;
    for (const sg of [-1, 1]) { c.beginPath(); c.arc(sg * o.head * 0.58, hy + o.head * 0.1, o.eyeR || 1.5, 0, TAU); c.fill(); }
    noGlow();
  }

  /* ---------- player ship (drawn nose-up) ---------- */
  function ship() {
    glow('#40d0ff', 8);
    c.beginPath();
    c.moveTo(0, -9); c.lineTo(30, 17); c.lineTo(27.5, 25); c.lineTo(10, 19.5); c.lineTo(0, 24);
    c.lineTo(-10, 19.5); c.lineTo(-27.5, 25); c.lineTo(-30, 17); c.closePath();
    c.fillStyle = grad(0, -9, 0, 25, [[0, '#b6e6ff'], [0.55, '#4e7fd2'], [1, '#1c2f72']]);
    c.fill();
    c.strokeStyle = 'rgba(150,240,255,0.95)'; c.lineWidth = 1.4; c.stroke();
    noGlow();
    // wing accents
    c.strokeStyle = 'rgba(255,90,210,0.95)'; c.lineWidth = 1.6; glow('#ff40c8', 4);
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 8, 2); c.lineTo(s * 25.5, 17.5); c.stroke(); }
    noGlow();
    // nacelles
    c.fillStyle = grad(0, 12, 0, 29, [[0, '#dff4ff'], [1, '#33528f']]);
    for (const s of [-1, 1]) { c.beginPath(); c.roundRect(s * 9 - 3, 12, 6, 17, 2.4); c.fill(); }
    // fuselage
    c.beginPath(); c.moveTo(0, -33);
    c.bezierCurveTo(7.5, -17, 8.5, 6, 5.2, 27); c.lineTo(-5.2, 27);
    c.bezierCurveTo(-8.5, 6, -7.5, -17, 0, -33); c.closePath();
    glow('#60e0ff', 7);
    c.fillStyle = grad(-8, 0, 8, 0, [[0, '#7fa6e6'], [0.42, '#ffffff'], [1, '#6a8cd0']]);
    c.fill();
    c.strokeStyle = 'rgba(205,250,255,0.95)'; c.lineWidth = 1.1; c.stroke();
    // cockpit
    glow('#30ffff', 7);
    c.fillStyle = grad(0, -18, 0, 0, [[0, '#eaffff'], [0.5, '#27e6ff'], [1, '#0a52b0']]);
    c.beginPath(); c.ellipse(0, -9, 2.9, 8, 0, 0, TAU); c.fill();
    noGlow();
    c.strokeStyle = 'rgba(20,50,120,0.6)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-4.6, 9); c.lineTo(4.6, 9); c.moveTo(-5, 17); c.lineTo(5, 17); c.stroke();
  }

  function build() {
    canvas.width = canvas.height = SIZE;
    c = canvas.getContext('2d');

    add('glow', 64, 64, () => {
      c.fillStyle = rgrad(0, 0, 0, 0, 0, 32, [[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,0.8)'], [0.3, 'rgba(255,255,255,0.36)'], [0.55, 'rgba(255,255,255,0.11)'], [0.8, 'rgba(255,255,255,0.025)'], [1, 'rgba(255,255,255,0)']]);
      c.fillRect(-32, -32, 64, 64);
    });
    add('ring', 128, 128, () => {
      glow('#ffffff', 7); c.strokeStyle = '#ffffff'; c.lineWidth = 2.6;
      c.beginPath(); c.arc(0, 0, 54, 0, TAU); c.stroke();
      noGlow(); c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 6;
      c.beginPath(); c.arc(0, 0, 50, 0, TAU); c.stroke();
    });
    add('bolt', 16, 48, () => {
      glow('#ffffff', 5); c.fillStyle = '#ffffff';
      c.beginPath(); c.roundRect(-2.4, -19, 4.8, 38, 2.4); c.fill();
    });
    add('ship', 76, 76, ship);
    add('flame', 24, 52, () => {
      glow('#ffffff', 5);
      c.fillStyle = grad(0, -22, 0, 24, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(210,240,255,0.85)'], [1, 'rgba(255,255,255,0)']]);
      c.beginPath(); c.moveTo(-5, -22); c.quadraticCurveTo(-6.5, 0, 0, 24); c.quadraticCurveTo(6.5, 0, 5, -22); c.closePath(); c.fill();
    });
    add('shield', 100, 100, () => {
      c.fillStyle = rgrad(0, 0, 22, 0, 0, 43, [[0, 'rgba(255,255,255,0)'], [0.8, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0.6)']]);
      c.beginPath(); c.arc(0, 0, 43, 0, TAU); c.fill();
      glow('#ffffff', 6); c.strokeStyle = '#ffffff'; c.lineWidth = 1.8;
      c.beginPath(); c.arc(0, 0, 43, 0, TAU); c.stroke();
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

    // egg of a great raven: dark shell, glowing veins
    add('egg', 48, 60, () => {
      c.beginPath();
      c.moveTo(0, -24); c.bezierCurveTo(13, -24, 18, -4, 18, 6); c.bezierCurveTo(18, 18, 9, 25, 0, 25);
      c.bezierCurveTo(-9, 25, -18, 18, -18, 6); c.bezierCurveTo(-18, -4, -13, -24, 0, -24); c.closePath();
      glow('#20ff90', 8);
      c.fillStyle = rgrad(-4, -6, 2, 0, 2, 26, [[0, 'rgba(20,60,44,0.97)'], [0.6, 'rgba(4,16,14,0.97)'], [1, 'rgba(2,8,10,0.97)']]);
      c.fill(); c.strokeStyle = '#d0ffe6'; c.lineWidth = 1.3; c.stroke();
      c.save(); c.clip();
      c.strokeStyle = 'rgba(60,255,160,0.95)'; c.lineWidth = 1.1; glow('#20ff90', 5);
      for (const [x0, y0, pts] of [[-3, -24, [[2, -14], [-5, -6], [3, 3], [-2, 12], [4, 25]]], [-5, -6, [[-12, -1], [-18, 8]]], [3, 3, [[11, 7], [18, 4]]], [-2, 12, [[-9, 17], [-12, 25]]], [2, -14, [[9, -11], [14, -16]]]]) {
        c.beginPath(); c.moveTo(x0, y0); pts.forEach(([x, y]) => c.lineTo(x, y)); c.stroke();
      }
      c.restore(); noGlow();
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(-7, -11, 3, 6.5, 0.45, 0, TAU); c.fill();
    });

    // the Aerie: armour plate, its eye, the lid over the eye, and the hull
    add('plate', 26, 18, () => {
      glow('#ffffff', 3);
      c.fillStyle = grad(0, -6, 0, 6, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(150,150,150,0.9)']]);
      c.beginPath(); c.roundRect(-9.5, -5.5, 19, 11, 2.5); c.fill();
      noGlow(); c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.stroke();
    });
    add('core', 64, 64, () => {
      glow('#ff3060', 10);
      c.fillStyle = rgrad(0, 0, 1, 0, 0, 24, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,190,200,1)'], [0.7, 'rgba(255,50,90,0.98)'], [1, 'rgba(140,0,50,0.9)']]);
      c.beginPath(); c.arc(0, 0, 24, 0, TAU); c.fill();
      noGlow();
      c.strokeStyle = 'rgba(255,230,235,0.8)'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, 0, 19, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(120,0,40,0.5)'; c.lineWidth = 1;
      for (let k = 0; k < 16; k++) { const a = k * TAU / 16; c.beginPath(); c.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); c.lineTo(Math.cos(a) * 18, Math.sin(a) * 18); c.stroke(); }
      c.fillStyle = 'rgba(30,0,12,0.95)'; c.beginPath(); c.ellipse(0, 0, 4, 13, 0, 0, TAU); c.fill();
    });
    add('lid', 64, 64, () => {
      c.fillStyle = rgrad(0, -6, 2, 0, 0, 27, [[0, 'rgba(46,28,80,0.99)'], [1, 'rgba(10,8,26,0.99)']]);
      c.beginPath(); c.arc(0, 0, 26.5, 0, TAU); c.fill();
      glow('#ff40c8', 4); c.strokeStyle = 'rgba(255,150,230,0.9)'; c.lineWidth = 1.3; c.beginPath(); c.arc(0, 0, 26.5, 0, TAU); c.stroke();
      glow('#ff3060', 5); c.strokeStyle = 'rgba(255,70,110,0.95)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(0, 5, 20, 0); c.stroke();
      noGlow(); c.strokeStyle = 'rgba(190,150,255,0.3)'; c.lineWidth = 0.9;
      for (const y of [-14, -7, 9, 16]) { const w = Math.sqrt(26 * 26 - y * y) - 3; c.beginPath(); c.moveTo(-w, y); c.lineTo(w, y); c.stroke(); }
    });
    add('aerie', 700, 240, () => {
      const hull = () => {
        c.beginPath();
        const fx = k => -330 + k / 8 * 262, fy = k => 10 - 82 * Math.pow(k / 8, 0.8);
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
      hull(); glow('#c040ff', 12);
      c.fillStyle = grad(0, -100, 0, 55, [[0, 'rgba(58,30,104,0.98)'], [0.5, 'rgba(22,12,52,0.98)'], [1, 'rgba(6,5,20,0.98)']]);
      c.fill();
      c.strokeStyle = grad(-330, 0, 330, 0, [[0, '#ff7fe0'], [0.5, '#e8d8ff'], [1, '#ff7fe0']]); c.lineWidth = 1.8; c.stroke();
      noGlow();
      c.save(); hull(); c.clip();
      // feather-like ribs across the wings
      c.strokeStyle = 'rgba(200,150,255,0.26)'; c.lineWidth = 1;
      for (const s of [-1, 1]) for (let k = 0; k < 11; k++) {
        const x = s * (70 + k * 24);
        c.beginPath(); c.moveTo(x, -100); c.quadraticCurveTo(x + s * 14, -20, x + s * 34, 60); c.stroke();
      }
      c.strokeStyle = 'rgba(255,130,230,0.4)'; c.lineWidth = 1.2;
      for (const d of [20, 36]) { c.beginPath(); c.moveTo(-330, 10 + d); c.bezierCurveTo(-250, -30 + d, -170, -58 + d, -68, -72 + d); c.lineTo(68, -72 + d); c.bezierCurveTo(170, -58 + d, 250, -30 + d, 330, 10 + d); c.stroke(); }
      c.restore();
      // lit windows along the wings
      glow('#40ffff', 4); c.fillStyle = 'rgba(170,255,255,0.95)';
      for (const s of [-1, 1]) for (let k = 0; k < 9; k++) {
        const x = s * (62 + k * 26), y = -22 + Math.pow(Math.abs(x) / 330, 2) * 46;
        c.beginPath(); c.roundRect(x - 4, y - 1.6, 8, 3.2, 1.4); c.fill();
      }
      // canopy
      glow('#60e0ff', 6); c.strokeStyle = 'rgba(190,245,255,0.9)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(0, -100); c.lineTo(0, -16); c.stroke();
      for (const y of [-84, -66, -48]) { c.beginPath(); c.moveTo(-16, y - 7); c.lineTo(0, y); c.lineTo(16, y - 7); c.stroke(); }
      for (const s of [-1, 1]) {
        // engine vents
        glow('#ff40c8', 8); c.fillStyle = 'rgba(255,170,240,0.95)';
        c.beginPath(); c.roundRect(s * 37 - 9, -106, 18, 5, 2.5); c.fill();
        // launch bay
        glow('#30ffa0', 8); c.fillStyle = 'rgba(180,255,220,0.95)';
        c.beginPath(); c.roundRect(s * 285 - 17, 20, 34, 7, 3); c.fill();
        // turret
        glow('#ffb030', 8); c.fillStyle = 'rgba(20,10,30,0.95)'; c.strokeStyle = '#ffd890'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(s * 215, 40, 8.5, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#fff2c0'; c.beginPath(); c.arc(s * 215, 42, 3.2, 0, TAU); c.fill();
      }
      // socket rim around the eye
      glow('#ff40c8', 6); c.strokeStyle = 'rgba(255,170,240,0.9)'; c.lineWidth = 1.6;
      c.beginPath(); c.arc(0, CORE_Y, 31, 0.55, Math.PI - 0.55, true); c.stroke();
    });

    // power-ups: white hex frame + icon, tinted at draw time
    const hex = () => {
      c.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + TAU / 12; c[k ? 'lineTo' : 'moveTo'](Math.cos(a) * 16, Math.sin(a) * 16); }
      c.closePath();
      c.fillStyle = 'rgba(255,255,255,0.14)'; c.fill();
      glow('#ffffff', 6); c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.stroke();
    };
    add('pw_twin', 44, 44, () => {
      hex(); c.fillStyle = '#ffffff';
      for (const s of [-1, 1]) { c.beginPath(); c.roundRect(s * 4.5 - 1.8, -8, 3.6, 16, 1.8); c.fill(); }
    });
    add('pw_shield', 44, 44, () => {
      hex(); c.lineWidth = 2.6;
      c.beginPath(); c.arc(0, 2, 8, Math.PI, TAU); c.lineTo(8, 4); c.moveTo(-8, 2); c.lineTo(-8, 4); c.stroke();
      c.beginPath(); c.arc(0, 2, 2, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
    });
    add('pw_rapid', 44, 44, () => {
      hex(); c.lineWidth = 2.6;
      for (const y of [-1, 6]) { c.beginPath(); c.moveTo(-7, y); c.lineTo(0, y - 7); c.lineTo(7, y); c.stroke(); }
    });

    for (const ch of '0123456789x+') add('g' + ch, 14, 22, () => {
      c.font = 'bold 19px Bahnschrift, "Segoe UI", Arial, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      glow('#ffffff', 3); c.fillStyle = '#ffffff'; c.fillText(ch, 0, 1);
    });
  }

  return { build, canvas, sprites };
})();
