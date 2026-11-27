'use strict';
/* ---------------------------------------------------------------------------
   NIGHTFLOCK — game logic. Playfield is a fixed 800 x 900 space, y pointing down.
   A cycle has four stages: a flock, a brood (eggs that hatch into great ravens),
   a storm (a faster flock) and the Aerie (a ship as wide as the screen).
--------------------------------------------------------------------------- */
(() => {
  const FW = GFX.FW, FH = GFX.FH, TAU = Math.PI * 2, PI = Math.PI;
  const $ = id => document.getElementById(id);
  const canvas = $('c');
  let ok = false;
  try { ok = GFX.init(canvas); } catch (err) { console.error(err); }
  if (!ok) { $('nogl').hidden = false; return; }
  ART.build();
  GFX.setAtlas(ART.canvas);
  const S = ART.sprites, Q = GFX.quad, fxv = GFX.fx;

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const angDiff = (to, from) => ((to - from + PI) % TAU + TAU) % TAU - PI;
  const alerp = (a, b, t) => a + angDiff(b, a) * t;

  /* ---------- definitions ---------- */
  const TYPES = {
    M: { spr: 'swallow', size: 72, r: 15, hp: 1, pts: 30, col: [0.25, 1, 1], face: 1, flap: 13, speed: 235, turn: 2.2, weave: 1.7, shots: 1 },
    R: { spr: 'gull', size: 72, r: 17, hp: 1, pts: 50, col: [1, 0.3, 0.85], face: 1, flap: 8, speed: 295, turn: 3.0, weave: 0.8, shots: 1 },
    L: { spr: 'falcon', size: 72, r: 15, hp: 1, pts: 80, col: [1, 0.68, 0.2], face: 1, flap: 10, speed: 360, turn: 1.6, weave: 0.25, shots: 2 },
    // great raven: hatched from an egg. Only a hit on the body counts; a wing is shot off and grows back.
    G: { spr: 'raven', size: 158, r: 18, wingR: 24, wingX: 37, hp: 1, pts: 200, col: [0.3, 1, 0.6], face: 1, flap: 6.5, speed: 215, great: true },
  };
  const FLOCKS = [
    ['..LLLLLL..', '.RRRRRRRR.', 'MMMMMMMMMM', 'MMMMMMMMMM'],
    ['LL......LL', '.RRR..RRR.', '..MMMMMM..', '...MMMM...', '....MM....'],
    ['...LLLL...', '..RRRRRR..', '.MMMMMMMM.', '..RRRRRR..', '...MMMM...'],
  ];
  const STORMS = [
    ['LLL....LLL', 'RRRR..RRRR', 'MMMM..MMMM', '.MM....MM.'],
    ['.LL.LL.LL.', 'RR.RRRR.RR', 'MM.MMMM.MM', '.MMRRRRMM.'],
  ];
  const STAGES = ['flock', 'brood', 'storm', 'boss'];
  const STAGE_LINE = { flock: 'THE FLOCK IS GATHERING', brood: 'THE EGGS ARE STIRRING', storm: 'THEY COME AS A STORM', boss: 'THE AERIE DESCENDS' };
  const POWS = {
    twin: { spr: 'pw_twin', col: [0.3, 1, 1.2] },
    rapid: { spr: 'pw_rapid', col: [1.3, 0.8, 0.2] },
  };
  const SH_T = 1.8, SH_CD = 5, WING_T = 3.2;            // shield time, shield recharge, wing regrowth
  const BW = 13, BH = 5, PW = 21, PH = 13, PY0 = 62, CORE_Y = 22;  // the Aerie's armour grid and eye
  const START_WAVE = clamp(+(new URLSearchParams(location.search).get('wave')) || 1, 1, 99);

  /* ---------- state ---------- */
  const G = {
    mode: 'title', paused: false, time: 0, ts: 1, score: 0, best: 0, wave: 1, cycle: 0, stage: 'flock', lives: 3,
    combo: 0, comboT: 0, shake: 0, aberr: 0, flash: 0, hueT: 0, warp: 0,
    diveT: 2.5, clearT: 0, overT: 0, nextLife: 15000,
  };
  const P = { x: FW / 2, y: FH - 64, vx: 0, tilt: 0, alive: false, inv: 0, sh: 0, shCool: 0, twin: 0, rapid: 0, cool: 0, resp: 0 };
  let enemies = [], eggs = [], bullets = [], ebul = [], pows = [], fxs = [], pops = [], boss = null;
  try { G.best = +(localStorage.getItem('nightflock.best') || localStorage.getItem('tidelight.best')) || 0; } catch (err) { /* storage unavailable */ }

  /* ---------- particles (struct-of-arrays ring buffer) ---------- */
  const PN = 6000;
  const px = new Float32Array(PN), py = new Float32Array(PN), pvx = new Float32Array(PN), pvy = new Float32Array(PN),
    pl = new Float32Array(PN), pm = new Float32Array(PN), ps = new Float32Array(PN),
    pr = new Float32Array(PN), pg = new Float32Array(PN), pb = new Float32Array(PN), pd = new Float32Array(PN), pk = new Uint8Array(PN);
  let pi = 0;
  function spawnP(x, y, vx, vy, life, size, r, g, b, drag, kind) {
    const i = pi; pi = (pi + 1) % PN;
    px[i] = x; py[i] = y; pvx[i] = vx; pvy[i] = vy; pl[i] = pm[i] = life; ps[i] = size; pr[i] = r; pg[i] = g; pb[i] = b; pd[i] = drag; pk[i] = kind;
  }
  function updateParticles(dt) {
    for (let i = 0; i < PN; i++) {
      if (pl[i] <= 0) continue;
      pl[i] -= dt;
      const k = Math.max(0, 1 - pd[i] * dt);
      pvx[i] *= k; pvy[i] *= k; px[i] += pvx[i] * dt; py[i] += pvy[i] * dt;
    }
  }
  function drawParticles() {
    const gl = S.glow;
    for (let i = 0; i < PN; i++) {
      if (pl[i] <= 0) continue;
      const t = pl[i] / pm[i];
      if (pk[i] === 1) { // streak, stretched along velocity
        const vx = pvx[i], vy = pvy[i], sp = Math.sqrt(vx * vx + vy * vy);
        const len = clamp(sp * 0.07, ps[i], 70), a = t * 1.5;
        Q(gl, px[i], py[i], len * 2, ps[i], Math.atan2(vy, vx), pr[i] * a, pg[i] * a, pb[i] * a, 1, 1);
      } else {
        const sz = ps[i] * (0.35 + 0.65 * t);
        Q(gl, px[i], py[i], sz, sz, 0, pr[i] * t, pg[i] * t, pb[i] * t, 1, 1);
      }
    }
  }
  function sparks(x, y, n, r, g, b, v) {
    for (let k = 0; k < n; k++) { const a = rand(0, TAU), s = rand(0.25, 1) * v; spawnP(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.2, 0.5), 6, r, g, b, 3, 1); }
  }
  function explode(x, y, col, k) {
    const r = col[0], g = col[1], b = col[2];
    fxs.push({ kind: 0, x, y, t: 0, life: 0.3, size: 170 * k, r, g, b });
    fxs.push({ kind: 1, x, y, t: 0, life: 0.5, size: 170 * k, r, g, b });
    fxs.push({ kind: 2, x, y, t: 0, life: 0.24, size: 420 * k, r, g, b });
    const n = (28 * k) | 0, sq = Math.sqrt(k);
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), v = rand(70, 560) * sq, w = Math.random() < 0.35;
      spawnP(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.35, 0.95), rand(5, 9),
        w ? 1.7 : r * 1.5 + 0.15, w ? 1.7 : g * 1.5 + 0.15, w ? 1.7 : b * 1.5 + 0.15, 3.2, 1);
    }
    for (let i = 0; i < 10 * k; i++)
      spawnP(x + rand(-12, 12), y + rand(-12, 12), rand(-45, 45), rand(-45, 45), rand(0.7, 1.5), rand(9, 18), r, g, b, 1, 0);
    GFX.shock(x, y, 0.011 * k, 520, 0.7);
    G.shake = Math.min(20, G.shake + 4 * k);
  }

  /* ---------- stages ---------- */
  const mk = (T, o) => Object.assign({
    T, sx: 0, sy: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, side: 1, state: 'form', t: 0, hp: T.hp, ph: rand(0, 4), flash: 0, tr: 0,
    phase: 0, hd: 0, dir: 1, shots: 0, shotT: 0, wob: 0, off: 0, anchor: false,
    wl: 0, wr: 0, swoop: 0, swT: 0, tx: 0, ty: 0, tT: 0, tumble: false,
  }, o);
  const level = () => 1 + G.cycle * 2 + (G.stage === 'storm' ? 1 : 0);

  let sxv = 0, syv = 0;
  function slot(e) {
    if (e.anchor) { // escorts hang under the Aerie's wings
      sxv = boss ? boss.x + e.sx : e.x; syv = boss ? boss.y + e.sy + Math.sin(G.time * 2 + e.ph) * 5 : e.y;
      return;
    }
    const br = 1 + 0.05 * Math.sin(G.time * 0.9);
    sxv = FW / 2 + Math.sin(G.time * 0.55) * 62 + e.sx * br;
    syv = e.sy + Math.sin(G.time * 1.7 + e.sx * 0.02) * 4;
  }
  function spawnFlock(lay) {
    const cols = lay[0].length;
    let iL = 0, iR = 0;
    lay.forEach((row, r) => {
      for (let c = 0; c < cols; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        const sx = (c - (cols - 1) / 2) * 56, side = sx < 0 ? -1 : 1;
        const order = side < 0 ? iL++ : iR++;
        enemies.push(mk(TYPES[ch], { sx, sy: 108 + r * 50, x: side < 0 ? -70 : FW + 70, y: 430, side, state: 'enter', t: -0.35 - order * 0.075 }));
      }
    });
    G.diveT = 3.2;
  }
  function spawnBrood() {
    const n = Math.min(6 + G.cycle * 2, 12);
    for (let i = 0; i < n; i++) eggs.push({
      x: 0, y: -60, t: -0.3 - i * 0.3, ph: rand(0, TAU), ax: rand(200, 330), sp: rand(0.5, 0.9) * (i % 2 ? 1 : -1),
      y0: rand(130, 400), hatch: Math.max(2.5, 4 + i * 1.1 + rand(0, 1.2) - G.cycle * 0.3), rot: 0, flash: 0,
    });
  }
  function spawnBoss() {
    const hp = 12 + G.cycle * 4;
    boss = { x: FW / 2, y: -170, ty: 190, t: 0, hp, hpMax: hp, open: 0, irisOpen: false, irisT: 3.2, volley: 0,
      plates: new Uint8Array(BW * BH).fill(1), tur: [2.6, 3.4], bayT: 3, dying: 0, exT: 0, flash: 0 };
    G.diveT = 4;
  }
  function startStage() {
    G.cycle = ((G.wave - 1) / 4) | 0; G.stage = STAGES[(G.wave - 1) % 4];
    if (G.stage === 'flock') spawnFlock(FLOCKS[G.cycle % FLOCKS.length]);
    else if (G.stage === 'storm') spawnFlock(STORMS[G.cycle % STORMS.length]);
    else if (G.stage === 'brood') spawnBrood();
    else spawnBoss();
    banner('WAVE ' + String(G.wave).padStart(2, '0'), STAGE_LINE[G.stage]);
  }

  function launch(e, dir, delay, off) {
    e.state = 'dive'; e.phase = 0; e.t = -delay; e.hd = -PI / 2; e.dir = dir;
    e.shots = e.T.shots + (level() > 5 ? 1 : 0); e.shotT = rand(0.35, 0.8); e.wob = rand(0, TAU); e.off = off;
  }
  function birdShot(e) {
    ebul.push({ x: e.x, y: e.y + 12, vx: clamp((P.x - e.x) * 0.55, -120, 120), vy: Math.min(300 + level() * 11, 450), t: rand(0, 6) });
    SFX.eshoot();
  }

  function updateEnemies(dt) {
    const play = G.mode === 'play', lv = level();
    const spMul = 1 + Math.min(lv - 1, 12) * 0.045;
    const maxSwoop = 1 + Math.min(G.cycle, 2);
    let divers = 0, entering = 0, swoops = 0, flock = 0;
    for (const e of enemies) { if (e.swoop === 1) swoops++; if (!e.anchor && !e.T.great) flock++; }
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i], T = e.T;
      slot(e);
      const tx = sxv, ty = syv, ox = e.x, oy = e.y;
      e.flash = Math.max(0, e.flash - dt * 6);
      let moving = true;
      if (e.state === 'enter') {
        entering++; e.t += dt;
        if (e.t < 0) continue;
        const u = Math.min(1, e.t / 1.7), k = u * u * (3 - 2 * u), m = 1 - k;
        const x0 = e.side < 0 ? -70 : FW + 70, x1 = FW / 2 + e.side * 90, x2 = tx - e.side * 210;
        e.x = m * m * m * x0 + 3 * m * m * k * x1 + 3 * m * k * k * x2 + k * k * k * tx;
        e.y = m * m * m * 430 + 3 * m * m * k * 760 + 3 * m * k * k * (ty + 230) + k * k * k * ty;
        if (u >= 1) e.state = 'form';
      } else if (e.state === 'form') {
        e.x = tx; e.y = ty; moving = false;
      } else if (e.state === 'dive') {
        divers++; e.t += dt;
        if (e.t < 0) { e.x = tx; e.y = ty; moving = false; }
        else {
          let sp = T.speed * spMul;
          if (e.phase === 0) { // peel off in a half loop
            e.hd += e.dir * 5.2 * dt; sp *= 0.8;
            if (Math.abs(e.hd + PI / 2) >= PI * 0.94) { e.phase = 1; e.hd = PI / 2 - e.dir * 0.12; }
          } else {
            if (play && P.alive && e.y < P.y - 150) {
              const want = Math.atan2(P.y - e.y, P.x + e.off - e.x);
              e.hd += clamp(angDiff(want, e.hd), -T.turn * dt, T.turn * dt);
            }
            e.hd += Math.cos(e.t * 3.2 + e.wob) * T.weave * dt;
            e.hd = clamp(e.hd, 0.35, PI - 0.35);
            if (play && P.alive && e.shots > 0 && e.y > 150 && e.y < P.y - 170) {
              e.shotT -= dt;
              if (e.shotT <= 0) { e.shots--; e.shotT = 0.3; birdShot(e); }
            }
          }
          e.x += Math.cos(e.hd) * sp * dt; e.y += Math.sin(e.hd) * sp * dt;
          if (e.y > FH + 50 || e.x < -90 || e.x > FW + 90) {
            e.y = -50;
            if (play && !e.anchor && flock <= 5) { // the last of a flock keep attacking
              e.x = clamp(P.x + rand(-220, 220), 60, FW - 60); e.phase = 1; e.hd = PI / 2;
              e.shots = T.shots; e.shotT = rand(0.2, 0.5);
            } else { e.state = 'return'; e.x = clamp(tx, 40, FW - 40); }
          }
        }
      } else if (e.state === 'great') {
        e.wl = Math.max(0, e.wl - dt); e.wr = Math.max(0, e.wr - dt);
        const clipped = (e.wl > 0 ? 1 : 0) + (e.wr > 0 ? 1 : 0);
        e.tumble = clipped === 2;
        if (e.tumble) { // no wings: it tumbles down until one grows back
          if (e.swoop === 1) swoops--;
          e.swoop = 0;
          e.vx *= Math.max(0, 1 - dt * 1.5); e.vy += (150 - e.vy) * Math.min(1, dt * 2);
          if (e.y > FH + 90) { e.y = -70; e.x = rand(120, FW - 120); }
        } else {
          let sp = T.speed * spMul * (clipped ? 0.6 : 1);
          if (e.swoop === 0) {
            e.tT -= dt; e.swT -= dt;
            if (e.tT <= 0 || Math.hypot(e.tx - e.x, e.ty - e.y) < 30) { e.tx = rand(90, FW - 90); e.ty = rand(110, 400); e.tT = rand(1.2, 2.4); }
            if (e.swT <= 0 && play && P.alive && !clipped && swoops < maxSwoop) {
              e.swoop = 1; swoops++; e.tx = clamp(P.x + rand(-50, 50), 60, FW - 60); e.ty = rand(610, 700);
              e.shots = 2 + (G.cycle > 1 ? 1 : 0); e.shotT = 0.35; SFX.dive();
            }
          } else if (e.swoop === 1) {
            sp *= 1.6;
            if (clipped || Math.hypot(e.tx - e.x, e.ty - e.y) < 45) {
              e.swoop = 2; swoops--; e.tx = clamp(e.x + (e.vx >= 0 ? 240 : -240), 90, FW - 90); e.ty = rand(120, 300);
            } else if (play && P.alive && e.shots > 0 && e.y > 220 && e.y < P.y - 170) {
              e.shotT -= dt;
              if (e.shotT <= 0) { e.shots--; e.shotT = 0.3; birdShot(e); }
            }
          } else {
            sp *= 1.25;
            if (Math.hypot(e.tx - e.x, e.ty - e.y) < 45) { e.swoop = 0; e.swT = rand(2.5, 5.5) * Math.max(0.5, 1 - G.cycle * 0.12); e.tT = 0; }
          }
          const dxT = e.tx - e.x, dyT = e.ty - e.y, d = Math.hypot(dxT, dyT) || 1, k = Math.min(1, dt * 2.6);
          e.vx += (dxT / d * sp - e.vx) * k; e.vy += (dyT / d * sp - e.vy) * k;
          if (clipped) { // one wing: it veers toward the missing side
            const a = (e.wl > 0 ? -1 : 1) * 1.6 * dt, c = Math.cos(a), s = Math.sin(a), vx = e.vx;
            e.vx = vx * c - e.vy * s; e.vy = vx * s + e.vy * c;
          }
        }
        e.x += e.vx * dt; e.y += e.vy * dt;
      } else { // return to slot
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy), stp = Math.min(d, 340 * dt);
        if (d < 3) { e.state = 'form'; e.x = tx; e.y = ty; }
        else { e.x += dx / d * stp; e.y += dy / d * stp; }
        if (d < 60) moving = false;
      }
      if (e.tumble) e.rot += dt * 7;
      else if (!moving) e.rot = alerp(e.rot, 0, Math.min(1, dt * 8));
      else {
        const dx = e.x - ox, dy = e.y - oy;
        if (dx * dx + dy * dy > 0.0001)
          e.rot = alerp(e.rot, Math.atan2(dy, dx) - PI / 2, Math.min(1, dt * (T.great ? 6 : 12)));
        e.tr -= dt;
        if (e.tr <= 0) {
          e.tr = T.great ? 0.035 : 0.022;
          spawnP(e.x + rand(-3, 3), e.y + rand(-3, 3), 0, 0, 0.4, T.great ? 26 : T.size * 0.27, T.col[0] * 0.7, T.col[1] * 0.7, T.col[2] * 0.7, 0, 0);
        }
      }
    }

    // choose the next bird to dive out of a formation
    G.diveT -= dt;
    if (G.diveT <= 0) {
      const storm = G.stage === 'storm', bossSt = G.stage === 'boss';
      G.diveT = rand(0.5, 1.3) * Math.max(0.45, 2.0 - lv * 0.14) * (play ? (storm ? 0.7 : bossSt ? 1.3 : 1) : 1.7);
      const maxD = !play ? 3 : bossSt ? 1 + Math.min(G.cycle, 3) : Math.min(2 + (lv >> 1) + (storm ? 1 : 0), 7);
      if (entering === 0 && divers < maxD && (!play || P.alive)) {
        const form = enemies.filter(e => e.state === 'form');
        if (form.length) {
          form.sort((a, b) => (Math.abs(b.sx) - Math.abs(a.sx)) + (b.sy - a.sy) * 0.3);
          const e = form[(Math.random() * Math.min(form.length, 8)) | 0];
          launch(e, e.sx < 0 ? -1 : e.sx > 0 ? 1 : (Math.random() < 0.5 ? -1 : 1), 0, rand(-60, 60));
          SFX.dive();
        }
      }
    }
  }

  function updateEggs(dt) {
    for (let i = eggs.length - 1; i >= 0; i--) {
      const g = eggs[i];
      g.t += dt; g.flash = Math.max(0, g.flash - dt * 6);
      if (g.t < 0) continue;
      const k = Math.min(1, g.t / 1.4), e = k * k * (3 - 2 * k);
      g.x = FW / 2 + g.ax * Math.sin(g.ph + g.t * g.sp);
      g.y = -60 + (g.y0 + 38 * Math.sin(g.t * 1.6 + g.ph * 2) + 60) * e;
      g.hatch -= dt;
      g.rot = g.hatch < 1.3 ? Math.sin(g.t * 38) * 0.22 * (1 - g.hatch / 1.3) : Math.sin(g.t * 2 + g.ph) * 0.12;
      if (g.hatch <= 0) { // a great raven breaks out
        eggs.splice(i, 1);
        enemies.push(mk(TYPES.G, { x: g.x, y: g.y, vx: rand(-60, 60), vy: -130, state: 'great', tx: g.x, ty: Math.max(110, g.y - 90), tT: 0.7, swT: rand(1.5, 4) }));
        fxs.push({ kind: 1, x: g.x, y: g.y, t: 0, life: 0.45, size: 150, r: 0.3, g: 1, b: 0.6 });
        sparks(g.x, g.y, 22, 0.6, 1.6, 1.0, 380);
        SFX.hatch();
      }
    }
  }

  /* ---------- the Aerie ---------- */
  function updateBoss(dt) {
    const b = boss, play = G.mode === 'play';
    b.t += dt; b.flash = Math.max(0, b.flash - dt * 5);
    if (b.dying > 0) {
      b.dying -= dt; b.exT -= dt; b.y += 14 * dt;
      if (b.exT <= 0) {
        b.exT = 0.075;
        const lx = rand(-310, 310), col = [[1.2, 0.3, 1], [0.3, 1, 1.2], [1.4, 1.2, 1]][(Math.random() * 3) | 0];
        explode(b.x + lx, b.y + rand(-70, 60) * (1 - Math.abs(lx) / 400), col, rand(0.7, 1.5));
        if (Math.random() < 0.4) SFX.boom(1.2);
      }
      if (b.dying <= 0) {
        for (let k = 0; k < 3; k++) explode(b.x + (k - 1) * 150, b.y, [1.4, 0.6, 1.2], 3);
        GFX.shock(b.x, b.y, 0.06, 800, 1.3); G.flash = 0.8; G.shake = 30; G.aberr = 0.02; G.ts = 0.25;
        const pts = 3000 * (G.cycle + 1);
        addScore(pts); pops.push({ x: b.x, y: b.y, s: String(pts), t: -0.6, col: [1, 0.6, 1], sc: 2.4 });
        SFX.die(); boss = null;
      }
      return;
    }
    b.ty = Math.min(330, b.ty + dt * (3 + G.cycle));
    b.y += (b.ty - b.y) * Math.min(1, dt * 0.9);
    b.x = FW / 2 + Math.sin(b.t * 0.4) * 70;
    // the eye opens and closes; it can only be hurt while open
    b.irisT -= dt;
    if (b.irisT <= 0) {
      b.irisOpen = !b.irisOpen;
      b.irisT = b.irisOpen ? 1.9 : Math.max(1.4, 2.4 - G.cycle * 0.2);
      if (b.irisOpen) b.volley = 0.6;
    }
    b.open += ((b.irisOpen ? 1 : 0) - b.open) * Math.min(1, dt * 6);
    if (!play || !P.alive || b.y < 60) return;
    const sp = 300 + G.cycle * 20;
    if (b.volley > 0) {
      b.volley -= dt;
      if (b.volley <= 0) {
        const cx = b.x, cy = b.y + CORE_Y + 30, base = Math.atan2(P.y - cy, P.x - cx), n = G.cycle > 0 ? 5 : 3;
        for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * 0.2; ebul.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: rand(0, 6) }); }
        SFX.eshoot();
      }
    }
    for (let k = 0; k < 2; k++) { // wing turrets
      b.tur[k] -= dt;
      if (b.tur[k] <= 0) {
        b.tur[k] = rand(1.5, 2.5) * Math.max(0.55, 1 - G.cycle * 0.1);
        const x = b.x + (k ? 215 : -215), y = b.y + 44, d = Math.hypot(P.x - x, P.y - y) || 1;
        ebul.push({ x, y, vx: (P.x - x) / d * sp, vy: (P.y - y) / d * sp, t: rand(0, 6) });
        SFX.eshoot();
      }
    }
    b.bayT -= dt; // launch bays release escorts that gather under the wings
    if (b.bayT <= 0) {
      b.bayT = Math.max(1.6, 3.4 - G.cycle * 0.3);
      if (enemies.length < Math.min(4 + G.cycle, 7)) {
        const side = Math.random() < 0.5 ? -1 : 1;
        enemies.push(mk(Math.random() < 0.35 ? TYPES.R : TYPES.M, {
          x: b.x + side * 285, y: b.y + 24, side, state: 'return', anchor: true, sx: side * rand(170, 300), sy: rand(85, 130) }));
        sparks(b.x + side * 285, b.y + 26, 8, 0.4, 1.5, 0.8, 200);
      }
    }
  }
  // Does a shot of the ship meet the Aerie? Tested in the ship's own space, bottom to top.
  function bossHit(bu, dt) {
    const b = boss;
    if (!b || b.dying > 0) return false;
    const lx = bu.x - b.x, ly = bu.y - b.y, lyPrev = ly + 980 * dt, a = Math.abs(lx);
    if (a > 334 || ly > 125) return false;
    const mid = (BW - 1) >> 1, c = Math.round(lx / PW) + mid;
    if (c >= 0 && c < BW) {
      for (let r = BH - 1; r >= 0; r--) {
        if (!b.plates[r * BW + c]) continue;
        const pyy = PY0 + r * PH;
        if (ly <= pyy + PH / 2 && lyPrev >= pyy - PH / 2) {
          b.plates[r * BW + c] = 0; addScore(10);
          sparks(b.x + (c - mid) * PW, b.y + pyy, 9, 1.6, 1.0, 0.5, 300);
          SFX.hit(); return true;
        }
      }
    }
    if (a < 26) {
      if (ly > CORE_Y + 24) return false;
      if (b.open > 0.55) {
        b.hp--; b.flash = 1; addScore(100); G.shake = Math.max(G.shake, 6); G.aberr = Math.max(G.aberr, 0.004);
        sparks(bu.x, b.y + CORE_Y + 20, 18, 1.8, 0.5, 0.8, 420);
        fxs.push({ kind: 1, x: b.x, y: b.y + CORE_Y, t: 0, life: 0.35, size: 150, r: 1.2, g: 0.3, b: 0.6 });
        SFX.hit(); SFX.boom(0.6);
        if (b.hp <= 0) killBoss();
      } else { sparks(bu.x, b.y + CORE_Y + 24, 6, 1.2, 1.2, 1.5, 220); SFX.clang(); }
      return true;
    }
    const yb = a < 140 ? 52 - (a - 30) / 110 * 4 : a < 300 ? 48 - (a - 140) / 160 * 14 : 34 - (a - 300) / 30 * 24;
    if (ly <= yb) { sparks(bu.x, b.y + yb, 4, 0.8, 0.6, 1.4, 160); return true; }
    return false;
  }
  function killBoss() {
    boss.dying = 2.6; boss.exT = 0; ebul.length = 0; G.ts = 0.5;
    for (let i = enemies.length - 1; i >= 0; i--) killEnemy(i);
    SFX.boom(1.5);
  }

  /* ---------- scoring / damage ---------- */
  function addScore(n) {
    G.score += n;
    if (G.score >= G.nextLife) {
      G.nextLife += 20000;
      if (G.lives < 5) { G.lives++; banner('EXTRA SHIP', ''); SFX.power(); }
    }
  }
  function killEnemy(i) {
    const e = enemies[i], T = e.T, diving = (e.state === 'dive' && e.t >= 0) || e.swoop === 1;
    enemies.splice(i, 1);
    G.combo++; G.comboT = 2.6;
    const mult = Math.min(8, 1 + ((G.combo / 3) | 0));
    const pts = T.pts * (diving ? 2 : 1) * mult;
    addScore(pts);
    pops.push({ x: e.x, y: e.y, s: String(pts), t: 0, col: T.col, sc: diving ? 1.25 : 1 });
    explode(e.x, e.y, T.col, T.great ? 1.9 : 1);
    SFX.boom(T.great ? 1.5 : 1);
    G.aberr = Math.max(G.aberr, T.great ? 0.006 : 0.003);
    if ((T.great && Math.random() < 0.35) || (diving && !T.great && Math.random() < 0.05)) {
      const kinds = Object.keys(POWS);
      pows.push({ x: e.x, y: e.y, kind: kinds[(Math.random() * kinds.length) | 0], t: 0 });
    }
  }
  function shieldFlash(x, y) {
    sparks(x, y, 8, 0.5, 1.6, 1.2, 260);
    fxs.push({ kind: 1, x: P.x, y: P.y, t: 0, life: 0.3, size: 150, r: 0.4, g: 1.2, b: 0.9 });
    SFX.shieldHit();
  }
  function hurtPlayer() {
    if (P.inv > 0 || P.sh > 0 || !P.alive) return;
    P.alive = false; P.resp = 1.9; P.twin = P.rapid = 0; P.sh = 0; P.shCool = 0; G.combo = 0; G.comboT = 0;
    G.lives--;
    explode(P.x, P.y, [0.4, 0.9, 1.3], 2.6);
    explode(P.x + rand(-20, 20), P.y + rand(-10, 10), [1.2, 0.5, 1], 1.4);
    for (let i = 0; i < 70; i++) {
      const a = rand(0, TAU), v = rand(100, 900);
      spawnP(P.x, P.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.6, 1.6), rand(6, 11), 1.2, 1.6, 2, 2.4, 1);
    }
    GFX.shock(P.x, P.y, 0.045, 700, 1.1);
    G.shake = 26; G.flash = 0.55; G.aberr = 0.016; G.ts = 0.16;
    SFX.die();
    if (G.lives <= 0) G.overT = 2.4;
  }

  /* ---------- player ---------- */
  const keys = { left: false, right: false, fire: false, shield: false };
  const pointer = { active: false, x: FW / 2, id: -1 };
  function updatePlayer(dt) {
    if (!P.alive) {
      if (G.lives > 0) {
        P.resp -= dt;
        if (P.resp <= 0) { P.alive = true; P.x = FW / 2; P.vx = 0; P.inv = 2.6; ebul.length = 0; }
      }
      keys.shield = false;
      return;
    }
    // force shield: a short burst of safety, then a recharge
    if (P.sh > 0) { P.sh -= dt; if (P.sh <= 0) { P.sh = 0; P.shCool = SH_CD; } }
    else if (P.shCool > 0) P.shCool = Math.max(0, P.shCool - dt);
    if (keys.shield && P.sh <= 0 && P.shCool <= 0) {
      P.sh = SH_T;
      fxs.push({ kind: 1, x: P.x, y: P.y, t: 0, life: 0.4, size: 220, r: 0.4, g: 1.3, b: 1 });
      SFX.shieldUp();
    }
    keys.shield = false;
    const up = P.sh > 0;
    let tv = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * 440;
    if (pointer.active) tv = clamp((pointer.x - P.x) * 10, -560, 560);
    if (up) tv *= 0.35;
    P.vx += (tv - P.vx) * Math.min(1, dt * 14);
    P.x = clamp(P.x + P.vx * dt, 38, FW - 38);
    P.tilt += (P.vx / 440 - P.tilt) * Math.min(1, dt * 10);
    P.inv = Math.max(0, P.inv - dt); P.twin = Math.max(0, P.twin - dt); P.rapid = Math.max(0, P.rapid - dt);
    P.cool -= dt;
    const maxB = (P.rapid > 0 ? 6 : 3) * (P.twin > 0 ? 2 : 1);
    if (!up && (keys.fire || pointer.active) && P.cool <= 0 && bullets.length < maxB) {
      P.cool = P.rapid > 0 ? 0.085 : 0.17;
      if (P.twin > 0) { bullets.push({ x: P.x - 12, y: P.y - 22 }, { x: P.x + 12, y: P.y - 22 }); }
      else bullets.push({ x: P.x, y: P.y - 34 });
      fxs.push({ kind: 0, x: P.x, y: P.y - 34, t: 0, life: 0.09, size: 60, r: 0.3, g: 0.8, b: 1.2 });
      SFX.shoot();
    }
    for (const s of [-1, 1]) // engine exhaust
      spawnP(P.x + s * 9 + rand(-1.5, 1.5), P.y + 30, P.vx * 0.2 + rand(-12, 12), rand(180, 340), rand(0.14, 0.3), rand(8, 13), 0.25, 0.75, 1.3, 0, 0);
  }

  function updateShots(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y -= 980 * dt;
      spawnP(b.x, b.y + 16, 0, 140, 0.13, 9, 0.15, 0.6, 1.1, 0, 0);
      let gone = b.y < -30 || bossHit(b, dt);
      for (let j = eggs.length - 1; j >= 0 && !gone; j--) {
        const g = eggs[j];
        if (g.t < 0) continue;
        const dx = g.x - b.x, dy = g.y - b.y;
        if (dx * dx + dy * dy < 23 * 23) {
          gone = true; eggs.splice(j, 1);
          G.combo++; G.comboT = 2.6;
          const pts = 40 * Math.min(8, 1 + ((G.combo / 3) | 0));
          addScore(pts); pops.push({ x: g.x, y: g.y, s: String(pts), t: 0, col: [0.4, 1, 0.7], sc: 1 });
          explode(g.x, g.y, [0.4, 1, 0.7], 0.8); SFX.boom(0.8);
        }
      }
      for (let j = enemies.length - 1; j >= 0 && !gone; j--) {
        const e = enemies[j], T = e.T;
        if (e.state === 'enter' && e.t < 0) continue;
        const dx = e.x - b.x, dy = e.y - b.y, rr = T.r + 7;
        if (dx * dx + dy * dy < rr * rr) {
          gone = true;
          if (--e.hp <= 0) killEnemy(j);
          else { e.flash = 1; SFX.hit(); sparks(b.x, b.y, 10, 1.6, 1.8, 1.4, 320); }
        } else if (T.great) { // a wing takes the shot: it is torn off and grows back
          const c = Math.cos(e.rot), s = Math.sin(e.rot);
          for (const side of [-1, 1]) {
            if ((side < 0 ? e.wl : e.wr) > 0) continue;
            const wx = e.x + side * T.wingX * c - 7 * s - b.x, wy = e.y + side * T.wingX * s + 7 * c - b.y, wr = T.wingR + 5;
            if (wx * wx + wy * wy < wr * wr) {
              gone = true;
              if (side < 0) e.wl = WING_T; else e.wr = WING_T;
              addScore(20); e.flash = 0.6; SFX.hit();
              sparks(b.x, b.y, 16, 0.5, 1.6, 0.9, 340);
              for (let k = 0; k < 8; k++) spawnP(b.x + rand(-14, 14), b.y + rand(-10, 10), rand(-70, 70), rand(-20, 120), rand(0.6, 1.2), rand(10, 16), 0.3, 1, 0.6, 1, 0);
              break;
            }
          }
        }
      }
      if (gone) bullets.splice(i, 1);
    }
    const up = P.alive && P.sh > 0;
    for (let i = ebul.length - 1; i >= 0; i--) {
      const b = ebul[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt;
      if (b.y > FH + 30 || b.x < -30 || b.x > FW + 30) { ebul.splice(i, 1); continue; }
      if (P.alive) {
        const dx = b.x - P.x, dy = b.y - P.y, d2 = dx * dx + dy * dy;
        if (up && d2 < 50 * 50) { ebul.splice(i, 1); shieldFlash(b.x, b.y); }
        else if (d2 < 17 * 17) { ebul.splice(i, 1); hurtPlayer(); }
      }
    }
    if (P.alive) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (e.state === 'form' || (e.state === 'enter' && e.t < 0)) continue;
        const dx = e.x - P.x, dy = e.y - P.y, rr = e.T.r + (up ? 46 : 14);
        if (dx * dx + dy * dy < rr * rr) {
          if (up) { shieldFlash(e.x, e.y); killEnemy(j); continue; } // a bird that rams the shield is destroyed
          if (P.inv <= 0) { if (--e.hp <= 0) killEnemy(j); else e.flash = 1; }
          hurtPlayer(); break;
        }
      }
      if (P.alive && !up) for (const g of eggs) {
        if (g.t >= 0 && Math.abs(g.x - P.x) < 28 && Math.abs(g.y - P.y) < 32) { hurtPlayer(); break; }
      }
    }
    for (let i = pows.length - 1; i >= 0; i--) {
      const p = pows[i];
      p.y += 120 * dt; p.t += dt;
      if (p.y > FH + 40) { pows.splice(i, 1); continue; }
      if (P.alive && Math.abs(p.x - P.x) < 34 && Math.abs(p.y - P.y) < 34) {
        pows.splice(i, 1);
        if (p.kind === 'twin') P.twin = 14; else P.rapid = 12;
        const c = POWS[p.kind].col;
        fxs.push({ kind: 1, x: P.x, y: P.y, t: 0, life: 0.5, size: 240, r: c[0], g: c[1], b: c[2] });
        pops.push({ x: P.x, y: P.y - 40, s: '+', t: 0, col: c, sc: 1.6 });
        addScore(100); SFX.power();
      }
    }
  }

  /* ---------- flow ---------- */
  function clearField() { enemies = []; eggs = []; bullets = []; ebul = []; pows = []; pops = []; boss = null; }
  function start() {
    SFX.init(); SFX.start(); SFX.setIntensity(1);
    clearField();
    Object.assign(G, { mode: 'play', paused: false, score: 0, wave: START_WAVE, lives: 3, combo: 0, comboT: 0, clearT: 0, overT: 0, nextLife: 15000, hueT: 0 });
    Object.assign(P, { x: FW / 2, vx: 0, tilt: 0, alive: true, inv: 2, sh: 0, shCool: 0, twin: 0, rapid: 0, cool: 0 });
    $('title').classList.add('hidden'); $('over').classList.add('hidden'); $('pause').classList.add('hidden');
    $('hud').classList.remove('hidden');
    startStage();
  }
  function gameOver() {
    G.mode = 'over'; SFX.setIntensity(0);
    const isBest = G.score > G.best && START_WAVE === 1; // a run started at a later wave (testing) is not kept
    if (isBest) { G.best = G.score; try { localStorage.setItem('nightflock.best', String(G.best)); } catch (err) { /* ignore */ } }
    $('overScore').textContent = G.score.toLocaleString('en-US');
    $('overBest').textContent = isBest ? 'NEW BEST' : 'BEST ' + G.best.toLocaleString('en-US');
    $('overBest').classList.toggle('new', isBest);
    $('over').classList.remove('hidden');
    G.overT = 0.9; // short lock so a held key does not restart instantly
  }
  function banner(main, sub) {
    const el = $('banner');
    $('bannerMain').textContent = main; $('bannerSub').textContent = sub;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  function togglePause() {
    if (G.mode !== 'play') return;
    G.paused = !G.paused;
    $('pause').classList.toggle('hidden', !G.paused);
  }

  function update(dt, rdt) {
    G.time += dt;
    G.warp += ((G.clearT > 0 ? 1 : 0) - G.warp) * Math.min(1, rdt * 2.5);
    fxv.time = G.time; fxv.warp = G.warp;
    fxv.scroll += dt * (G.mode === 'play' ? 1 : 0.6) * (1 + G.warp * 16);
    fxv.hue += (G.hueT - fxv.hue) * Math.min(1, rdt * 0.9);
    G.shake *= Math.exp(-rdt * 7); G.aberr *= Math.exp(-rdt * 5); G.flash *= Math.exp(-rdt * 6);
    fxv.shx = (Math.random() - 0.5) * 2 * G.shake; fxv.shy = (Math.random() - 0.5) * 2 * G.shake;
    fxv.aberr = 0.0012 + G.aberr + G.warp * 0.006; fxv.flash = G.flash;

    if (boss) updateBoss(dt);
    updateEggs(dt);
    updateEnemies(dt);
    if (G.mode === 'play') {
      updatePlayer(dt);
      updateShots(dt);
      if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
      if (G.overT > 0) { G.overT -= rdt; if (G.overT <= 0) gameOver(); }
      else if (!enemies.length && !eggs.length && !boss && G.lives > 0) {
        if (G.clearT <= 0) {
          G.clearT = 2.6; addScore(500 * G.wave); SFX.wave();
          banner(G.stage === 'boss' ? 'THE AERIE HAS FALLEN' : 'WAVE CLEARED', G.stage === 'boss' ? 'THE SKY IS YOURS, FOR NOW' : 'JUMPING TO THE NEXT SKY');
        } else {
          G.clearT -= dt;
          if (G.clearT <= 0) { G.wave++; G.hueT += 0.115; startStage(); }
        }
      }
    } else {
      if (G.mode === 'over' && G.overT > 0) G.overT -= rdt;
      for (let i = ebul.length - 1; i >= 0; i--) { const b = ebul[i]; b.y += b.vy * dt; b.x += b.vx * dt; if (b.y > FH + 30) ebul.splice(i, 1); }
      if (!enemies.length && !eggs.length && !boss) spawnFlock(FLOCKS[0]); // attract mode keeps a flock on screen
    }
    updateParticles(dt);
    for (let i = fxs.length - 1; i >= 0; i--) { const f = fxs[i]; f.t += dt; if (f.t >= f.life) fxs.splice(i, 1); }
    for (let i = pops.length - 1; i >= 0; i--) { const p = pops[i]; p.t += dt; p.y -= 42 * dt; if (p.t >= 0.9) pops.splice(i, 1); }
    updateHud();
  }

  /* ---------- drawing ---------- */
  function text(str, x, y, sc, r, g, b) {
    const adv = 11.5 * sc; let cx = x - (str.length - 1) * adv / 2;
    for (const ch of str) { const sp = S['g' + ch]; if (sp) Q(sp, cx, y, sp.w * sc, sp.h * sc, 0, r, g, b, 1, 1); cx += adv; }
  }
  function drawBoss() {
    const b = boss, gl = S.glow, t = G.time, k = 1.15 + b.flash * 1.6, cx = b.x, cy = b.y + CORE_Y;
    Q(gl, b.x, b.y, 980, 420, 0, 0.2, 0.04, 0.26, 1, 1);
    for (const s of [-1, 1]) { // engines, bays, turrets
      Q(gl, b.x + s * 37, b.y - 108, 60, 80 * rand(0.8, 1.2), 0, 1.3, 0.3, 1.1, 1, 1);
      Q(gl, b.x + s * 285, b.y + 24, 70, 36, 0, 0.2, 0.9 + 0.4 * Math.sin(t * 5), 0.5, 1, 1);
      const charge = clamp(1 - b.tur[s < 0 ? 0 : 1] / 0.6, 0, 1);
      Q(gl, b.x + s * 215, b.y + 42, 34 + charge * 40, 34 + charge * 40, 0, 1.4, 0.7 + charge, 0.2 + charge, 1, 1);
    }
    Q(S.aerie, b.x, b.y, 700, 240, 0, k, k, k, 1, 0);
    // the eye in its socket
    const o = b.open, pu = 1 + Math.sin(t * 7) * 0.06;
    Q(gl, cx, cy, 210 * (0.45 + o * 0.7), 210 * (0.45 + o * 0.7), 0, 1.3 * (0.3 + o), 0.15, 0.35 * (0.3 + o), 1, 1);
    Q(S.core, cx, cy, 54 * pu, 54 * pu, 0, 1.5 + b.flash * 3, 1.5 + b.flash * 3, 1.5 + b.flash * 3, 1, 0);
    if (o < 0.98) Q(S.lid, cx, cy, 58, 58, 0, 1.2, 1.2, 1.2, 1 - o, 0);
    // armour plates
    const mid = (BW - 1) >> 1;
    for (let r = 0; r < BH; r++) {
      const f = r / (BH - 1), pr2 = 1.5 - f * 0.4, pg2 = 0.55 + f * 0.25, pb2 = 0.3 + f * 1.3;
      for (let c = 0; c < BW; c++) if (b.plates[r * BW + c])
        Q(S.plate, b.x + (c - mid) * PW, b.y + PY0 + r * PH, PW + 3, PH + 3, 0, pr2, pg2, pb2, 1, 0);
    }
  }
  function draw() {
    const gl = S.glow, t = G.time;
    drawParticles();

    for (const p of pows) {
      const d = POWS[p.kind], c = d.col, pu = 1 + Math.sin(p.t * 6) * 0.08;
      Q(gl, p.x, p.y, 120, 120, 0, c[0] * 0.3, c[1] * 0.3, c[2] * 0.3, 1, 1);
      Q(S[d.spr], p.x, p.y, 44 * pu, 44 * pu, Math.sin(p.t * 2.2) * 0.25, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, 1, 0);
    }
    if (boss) drawBoss();
    for (const g of eggs) {
      if (g.t < 0) continue;
      const near = g.hatch < 1.3 ? 1 - g.hatch / 1.3 : 0, k = 1.15 + near * 1.6 + g.flash * 2;
      Q(gl, g.x, g.y, 110 + near * 60, 110 + near * 60, 0, 0.1 + near * 0.3, 0.32 + near * 0.6, 0.2 + near * 0.3, 1, 1);
      Q(S.egg, g.x, g.y, 48, 60, g.rot, k, k, k, 1, 0);
    }
    for (const b of bullets) {
      Q(gl, b.x, b.y, 44, 96, 0, 0.1, 0.45, 0.85, 1, 1);
      Q(S.bolt, b.x, b.y, 16, 48, 0, 1.2, 2.3, 2.8, 1, 1);
    }
    for (const e of enemies) {
      if (e.state === 'enter' && e.t < 0) continue;
      const T = e.T, c = T.col, k = 1.25 + e.flash * 3, fr = ((t * T.flap + e.ph) | 0) & 3;
      Q(gl, e.x, e.y, T.size * 1.9, T.size * 1.9, 0, c[0] * 0.3, c[1] * 0.3, c[2] * 0.3, 1, 1);
      if (T.great) { // wings are separate sprites, so each can be torn off and grow back
        const w = S['ravenW' + fr];
        for (const side of [-1, 1]) {
          const tm = side < 0 ? e.wl : e.wr;
          if (tm > 0.8) continue;
          const z = T.size * (1 - tm / 0.8);
          Q(w, e.x, e.y, side * z, z, e.rot, k, k, k, 1, 0);
        }
        Q(S['ravenB' + fr], e.x, e.y, T.size, T.size, e.rot, k, k, k, 1, 0);
      } else Q(S[T.spr + fr], e.x, e.y, T.size, T.size, e.rot, k, k, k, 1, 0);
    }
    for (const b of ebul) {
      const pu = 1 + Math.sin(b.t * 22) * 0.18, a = Math.atan2(b.vy, b.vx);
      Q(gl, b.x, b.y, 54 * pu, 54 * pu, 0, 1.1, 0.22, 0.5, 1, 1);
      Q(gl, b.x, b.y, 30, 15, a, 3, 2, 1.8, 1, 1);
    }
    if (P.alive && G.mode === 'play') {
      const bl = P.inv > 0 ? 0.5 + 0.5 * Math.sin(t * 34) : 1, wd = 1 - Math.abs(P.tilt) * 0.2;
      Q(gl, P.x, P.y + 4, 170, 170, 0, 0.06, 0.24, 0.42, 1, 1);
      for (const s of [-1, 1]) Q(S.flame, P.x + s * 9 * wd, P.y + 46, 15, 46 * rand(0.75, 1.25), 0, 0.6, 1.5, 2.4, bl, 1);
      Q(S.ship, P.x, P.y, 76 * wd, 76, P.tilt * 0.2, 1.25, 1.25, 1.25, bl, 0);
      if (Math.sin(t * 9) > 0.6) for (const s of [-1, 1]) Q(gl, P.x + s * 28 * wd, P.y + 20, 22, 22, 0, s < 0 ? 2 : 0.2, s < 0 ? 0.3 : 2, 0.6, 1, 1);
      if (P.sh > 0) {
        const fade = P.sh < 0.45 ? 0.45 + 0.55 * Math.abs(Math.sin(t * 26)) : 1, z = 112 + Math.sin(t * 9) * 5;
        Q(gl, P.x, P.y, 230, 230, 0, 0.1 * fade, 0.5 * fade, 0.4 * fade, 1, 1);
        Q(S.shield, P.x, P.y, z, z, t * 1.6, 0.45 * fade, 1.9 * fade, 1.3 * fade, 1, 1);
        Q(S.shield, P.x, P.y, z * 0.9, z * 0.9, -t * 2.3, 0.3 * fade, 1.0 * fade, 1.2 * fade, 1, 1);
      }
    }
    for (const f of fxs) {
      const u = f.t / f.life, a = (1 - u) * (1 - u);
      if (f.kind === 0) { const z = f.size * (0.5 + u * 0.8), k = a * 1.7; Q(gl, f.x, f.y, z, z, 0, (f.r * 0.6 + 0.55) * k, (f.g * 0.6 + 0.55) * k, (f.b * 0.6 + 0.55) * k, 1, 1); }
      else if (f.kind === 1) { const z = f.size * (0.2 + 0.95 * (1 - (1 - u) * (1 - u))), k = a * 1.6; Q(S.ring, f.x, f.y, z, z, 0, f.r * k, f.g * k, f.b * k, 1, 1); }
      else { const k = a * 1.3; Q(gl, f.x, f.y, f.size * (0.6 + u), 11 * (1 - u), 0, (f.r + 0.4) * k, (f.g + 0.4) * k, (f.b + 0.4) * k, 1, 1); }
    }
    for (const p of pops) {
      if (p.t < 0) continue;
      const a = Math.min(1, (0.9 - p.t) * 3) * 1.5, sc = p.sc * (1 + Math.max(0, 0.12 - p.t) * 4);
      text(p.s, p.x, p.y, sc, (p.col[0] * 0.6 + 0.5) * a, (p.col[1] * 0.6 + 0.5) * a, (p.col[2] * 0.6 + 0.5) * a);
    }
  }

  /* ---------- HUD (plain DOM, updated only on change) ---------- */
  const hud = { score: -1, best: -1, wave: -1, lives: -1, mult: -1, chips: '', sh: '', shv: -1, boss: -2 };
  const SHIP_SVG = '<svg viewBox="0 0 24 24"><path d="M12 1 L14.5 13 L23 19 L22 21.5 L14 19.5 L12 21 L10 19.5 L2 21.5 L1 19 L9.5 13 Z"/></svg>';
  function updateHud() {
    if (hud.score !== G.score) { hud.score = G.score; $('score').textContent = String(G.score).padStart(6, '0'); }
    const best = Math.max(G.best, G.score);
    if (hud.best !== best) { hud.best = best; $('best').textContent = String(best).padStart(6, '0'); }
    if (hud.wave !== G.wave) { hud.wave = G.wave; $('wave').textContent = String(G.wave).padStart(2, '0'); }
    if (hud.lives !== G.lives) { hud.lives = G.lives; $('lives').innerHTML = SHIP_SVG.repeat(Math.max(0, G.lives)); }
    const mult = Math.min(8, 1 + ((G.combo / 3) | 0));
    if (hud.mult !== mult) {
      hud.mult = mult; $('comboX').textContent = '×' + mult;
      const el = $('combo'); el.classList.toggle('on', mult > 1);
      if (mult > 1) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    }
    if (mult > 1) $('comboBar').style.transform = 'scaleX(' + clamp(G.comboT / 2.6, 0, 1).toFixed(3) + ')';
    const chips = (P.twin > 0 ? 'TWIN ' + Math.ceil(P.twin) + '|' : '') + (P.rapid > 0 ? 'RAPID ' + Math.ceil(P.rapid) + '|' : '');
    if (hud.chips !== chips) { hud.chips = chips; $('chips').innerHTML = chips.split('|').filter(Boolean).map(s => '<span class="chip ' + s.split(' ')[0].toLowerCase() + '">' + s + '</span>').join(''); }
    const sh = P.sh > 0 ? 'on' : P.shCool > 0 ? 'wait' : 'ready';
    if (hud.sh !== sh) { hud.sh = sh; $('shield').className = sh; }
    const shv = Math.round((P.sh > 0 ? P.sh / SH_T : P.shCool > 0 ? 1 - P.shCool / SH_CD : 1) * 100);
    if (hud.shv !== shv) { hud.shv = shv; $('shieldFill').style.transform = 'scaleX(' + shv / 100 + ')'; }
    const bv = boss && boss.dying <= 0 ? Math.round(boss.hp / boss.hpMax * 100) : -1;
    if (hud.boss !== bv) { hud.boss = bv; $('boss').classList.toggle('on', bv >= 0); if (bv >= 0) $('bossFill').style.transform = 'scaleX(' + bv / 100 + ')'; }
  }

  /* ---------- input ---------- */
  function begin() { if (G.mode === 'title' || (G.mode === 'over' && G.overT <= 0)) start(); }
  addEventListener('keydown', e => {
    const k = e.code;
    if (k === 'ArrowLeft' || k === 'KeyA') keys.left = true;
    else if (k === 'ArrowRight' || k === 'KeyD') keys.right = true;
    else if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') { keys.fire = true; if (!e.repeat) begin(); }
    else if (k === 'ArrowDown' || k === 'KeyS' || k === 'ShiftLeft' || k === 'ShiftRight') { if (!e.repeat && G.mode === 'play') keys.shield = true; }
    else if (k === 'Enter') { if (!e.repeat) begin(); }
    else if (k === 'KeyP' || k === 'Escape') { if (!e.repeat) togglePause(); }
    else if (k === 'KeyM') { if (!e.repeat) { SFX.init(); $('mute').classList.toggle('off', SFX.toggleMute()); } }
    else return;
    SFX.init(); e.preventDefault();
  });
  addEventListener('keyup', e => {
    const k = e.code;
    if (k === 'ArrowLeft' || k === 'KeyA') keys.left = false;
    else if (k === 'ArrowRight' || k === 'KeyD') keys.right = false;
    else if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') keys.fire = false;
  });
  addEventListener('pointerdown', e => {
    SFX.init();
    if (G.mode !== 'play') { begin(); return; }
    if (G.paused) { togglePause(); return; }
    // right button, or a second finger while one is down: shield
    if (e.button === 2 || (pointer.active && e.pointerId !== pointer.id)) { keys.shield = true; return; }
    pointer.active = true; pointer.id = e.pointerId; pointer.x = GFX.toFieldX(e.clientX);
  });
  addEventListener('pointermove', e => { if (pointer.active && e.pointerId === pointer.id) pointer.x = GFX.toFieldX(e.clientX); });
  const release = e => { if (e.pointerId === pointer.id && e.button !== 2) pointer.active = false; };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  addEventListener('blur', () => { keys.left = keys.right = keys.fire = keys.shield = false; pointer.active = false; if (G.mode === 'play' && !G.paused) togglePause(); });
  addEventListener('contextmenu', e => e.preventDefault());

  /* ---------- main loop ---------- */
  function layout() { document.documentElement.style.setProperty('--fieldw', Math.round(GFX.fieldCssWidth()) + 'px'); }
  addEventListener('resize', () => requestAnimationFrame(layout));
  let last = performance.now(), laid = false;
  function frame(now) {
    requestAnimationFrame(frame);
    let rdt = Math.min(0.05, (now - last) / 1000); last = now;
    if (G.paused) rdt = 0;
    G.ts += (1 - G.ts) * Math.min(1, rdt * 2.4);
    const dt = rdt * G.ts;
    if (!G.paused) update(dt, rdt);
    draw();
    GFX.render(dt);
    if (!laid) { laid = true; layout(); }
  }
  // for scripted tests: read the state, or bring the Aerie down
  window.__nightflock = { state: G, ship: P, boss: () => boss, birds: () => enemies, eggs: () => eggs, shots: () => ebul, killBoss };
  spawnFlock(FLOCKS[0]);
  $('titleBest').textContent = G.best ? 'BEST ' + G.best.toLocaleString('en-US') : '';
  requestAnimationFrame(frame);
})();
