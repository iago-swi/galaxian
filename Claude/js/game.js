'use strict';
/* ---------------------------------------------------------------------------
   NIGHTFLOCK — game logic. Playfield is a fixed 800 x 900 space, y pointing down.
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

  /* ---------- creature definitions ---------- */
  const TYPES = {
    M: { spr: 'swallow', size: 72, r: 15, hp: 1, pts: 30, col: [0.25, 1, 1], face: 1, flap: 13, speed: 235, turn: 2.2, weave: 1.7, shots: 1 },
    R: { spr: 'gull', size: 72, r: 17, hp: 1, pts: 50, col: [1, 0.3, 0.85], face: 1, flap: 8, speed: 295, turn: 3.0, weave: 0.8, shots: 1 },
    L: { spr: 'falcon', size: 72, r: 15, hp: 1, pts: 80, col: [1, 0.68, 0.2], face: 1, flap: 10, speed: 360, turn: 1.6, weave: 0.25, shots: 2 },
    W: { spr: 'raven', size: 96, r: 24, hp: 2, pts: 150, col: [0.3, 1, 0.6], face: 1, flap: 6.5, speed: 255, turn: 2.4, weave: 1.0, shots: 3 },
  };
  const LAYOUTS = [
    ['...W..W...', '..LLLLLL..', '.RRRRRRRR.', 'MMMMMMMMMM', 'MMMMMMMMMM'],
    ['W........W', 'LL......LL', '.RRR..RRR.', '..MMMMMM..', '...MMMM...', '....MM....'],
    ['....WW....', '...LLLL...', '..RRRRRR..', '.MMMMMMMM.', '..RRRRRR..', '...MMMM...'],
    ['.W......W.', 'LLL....LLL', 'RRRR..RRRR', 'MMMM..MMMM', '.MM....MM.'],
    ['..W.WW.W..', '.LL....LL.', 'RR.MMMM.RR', 'RR.MMMM.RR', '.LLRRRRLL.'],
  ];
  const POWS = {
    twin: { spr: 'pw_twin', col: [0.3, 1, 1.2], label: 'TWIN' },
    shield: { spr: 'pw_shield', col: [0.4, 1.2, 0.6], label: 'SHIELD' },
    rapid: { spr: 'pw_rapid', col: [1.3, 0.8, 0.2], label: 'RAPID' },
  };

  /* ---------- state ---------- */
  const G = {
    mode: 'title', paused: false, time: 0, ts: 1, score: 0, best: 0, wave: 1, lives: 3,
    combo: 0, comboT: 0, shake: 0, aberr: 0, flash: 0, hueT: 0, warp: 0,
    diveT: 2.5, clearT: 0, overT: 0, nextLife: 15000,
  };
  const P = { x: FW / 2, y: FH - 64, vx: 0, tilt: 0, alive: false, inv: 0, shield: false, twin: 0, rapid: 0, cool: 0, resp: 0 };
  let enemies = [], bullets = [], ebul = [], pows = [], fxs = [], pops = [];
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

  /* ---------- waves ---------- */
  let sxv = 0, syv = 0;
  function slot(e) {
    const br = 1 + 0.05 * Math.sin(G.time * 0.9);
    sxv = FW / 2 + Math.sin(G.time * 0.55) * 62 + e.sx * br;
    syv = e.sy + Math.sin(G.time * 1.7 + e.sx * 0.02) * 4;
  }
  function spawnWave(n) {
    const lay = LAYOUTS[(n - 1) % LAYOUTS.length], cols = lay[0].length;
    let iL = 0, iR = 0;
    lay.forEach((row, r) => {
      for (let c = 0; c < cols; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        const sx = (c - (cols - 1) / 2) * 56, side = sx < 0 ? -1 : 1;
        const order = side < 0 ? iL++ : iR++;
        enemies.push({
          T: TYPES[ch], sx, sy: 108 + r * 50, x: side < 0 ? -70 : FW + 70, y: 430, rot: 0, side,
          state: 'enter', t: -0.35 - order * 0.075, hp: TYPES[ch].hp, ph: rand(0, 4), flash: 0, tr: 0,
          phase: 0, hd: 0, dir: 1, shots: 0, shotT: 0, wob: 0, off: 0,
        });
      }
    });
    G.diveT = 3.2;
  }

  function launch(e, dir, delay, off) {
    e.state = 'dive'; e.phase = 0; e.t = -delay; e.hd = -PI / 2; e.dir = dir;
    e.shots = e.T.shots + (G.wave > 5 ? 1 : 0); e.shotT = rand(0.35, 0.8); e.wob = rand(0, TAU); e.off = off;
  }

  function updateEnemies(dt) {
    const play = G.mode === 'play';
    const spMul = 1 + Math.min(G.wave - 1, 12) * 0.045;
    let divers = 0, entering = 0;
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
            const ty2 = P.y;
            if (play && P.alive && e.y < ty2 - 150) {
              const want = Math.atan2(ty2 - e.y, P.x + e.off - e.x);
              e.hd += clamp(angDiff(want, e.hd), -T.turn * dt, T.turn * dt);
            }
            e.hd += Math.cos(e.t * 3.2 + e.wob) * T.weave * dt;
            e.hd = clamp(e.hd, 0.35, PI - 0.35);
            if (play && P.alive && e.shots > 0 && e.y > 150 && e.y < ty2 - 170) {
              e.shotT -= dt;
              if (e.shotT <= 0) {
                e.shots--; e.shotT = 0.3;
                const vy = Math.min(300 + G.wave * 11, 450);
                ebul.push({ x: e.x, y: e.y + 12, vx: clamp((P.x - e.x) * 0.55, -120, 120), vy, t: rand(0, 6) });
                SFX.eshoot();
              }
            }
          }
          e.x += Math.cos(e.hd) * sp * dt; e.y += Math.sin(e.hd) * sp * dt;
          if (e.y > FH + 50 || e.x < -90 || e.x > FW + 90) {
            e.y = -50;
            if (play && enemies.length <= 5) { // last survivors keep attacking
              e.x = clamp(P.x + rand(-220, 220), 60, FW - 60); e.phase = 1; e.hd = PI / 2;
              e.shots = T.shots; e.shotT = rand(0.2, 0.5);
            } else { e.state = 'return'; e.x = tx; }
          }
        }
      } else { // return to slot
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy), stp = Math.min(d, 340 * dt);
        if (d < 3) { e.state = 'form'; e.x = tx; e.y = ty; }
        else { e.x += dx / d * stp; e.y += dy / d * stp; }
        if (d < 60) moving = false;
      }
      if (!moving) e.rot = alerp(e.rot, 0, Math.min(1, dt * 8));
      else {
        const dx = e.x - ox, dy = e.y - oy;
        if (dx * dx + dy * dy > 0.0001) {
          const th = Math.atan2(dy, dx);
          e.rot = alerp(e.rot, T.face > 0 ? th - PI / 2 : th + PI / 2, Math.min(1, dt * 12));
        }
        e.tr -= dt;
        if (e.tr <= 0) {
          e.tr = 0.022;
          spawnP(e.x + rand(-3, 3), e.y + rand(-3, 3), 0, 0, 0.4, T.size * 0.27, T.col[0] * 0.7, T.col[1] * 0.7, T.col[2] * 0.7, 0, 0);
        }
      }
      if (e.hp < T.hp && Math.random() < dt * 14)
        spawnP(e.x + rand(-14, 14), e.y + rand(-14, 14), rand(-60, 60), rand(-60, 60), 0.4, 6, 1.6, 1.6, 1.2, 2, 1);
    }

    // choose the next attacker
    G.diveT -= dt;
    if (G.diveT <= 0) {
      G.diveT = rand(0.5, 1.3) * Math.max(0.45, 2.0 - G.wave * 0.14) * (play ? 1 : 1.7);
      const maxD = play ? Math.min(2 + (G.wave >> 1), 7) : 3;
      if (entering === 0 && divers < maxD && (!play || P.alive)) {
        const form = enemies.filter(e => e.state === 'form');
        if (form.length) {
          form.sort((a, b) => (Math.abs(b.sx) - Math.abs(a.sx)) + (b.sy - a.sy) * 0.3);
          const e = form[(Math.random() * Math.min(form.length, 8)) | 0];
          const dir = e.sx < 0 ? -1 : e.sx > 0 ? 1 : (Math.random() < 0.5 ? -1 : 1), off = rand(-60, 60);
          launch(e, dir, 0, off);
          if (e.T === TYPES.W) { // elites bring an escort
            const d2 = o => (o.sx - e.sx) ** 2 + (o.sy - e.sy) ** 2;
            form.filter(o => o !== e && o.T !== TYPES.W).sort((a, b) => d2(a) - d2(b)).slice(0, 2)
              .forEach((o, j) => { if (d2(o) < 150 * 150) launch(o, dir, 0.14 * (j + 1), off + (j ? 45 : -45)); });
          }
          SFX.dive();
        }
      }
    }
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
    const e = enemies[i], T = e.T, diving = e.state === 'dive' && e.t >= 0;
    enemies.splice(i, 1);
    G.combo++; G.comboT = 2.6;
    const mult = Math.min(8, 1 + ((G.combo / 3) | 0));
    const pts = T.pts * (diving ? 2 : 1) * mult;
    addScore(pts);
    pops.push({ x: e.x, y: e.y, s: String(pts), t: 0, col: T.col, sc: diving ? 1.25 : 1 });
    const big = T === TYPES.W;
    explode(e.x, e.y, T.col, big ? 1.7 : 1);
    SFX.boom(big ? 1.5 : 1);
    G.aberr = Math.max(G.aberr, big ? 0.006 : 0.003);
    if ((big && Math.random() < 0.75) || (diving && Math.random() < 0.05)) {
      const kinds = Object.keys(POWS).filter(k => !(k === 'shield' && P.shield));
      pows.push({ x: e.x, y: e.y, kind: kinds[(Math.random() * kinds.length) | 0], t: 0 });
    }
  }
  function hurtPlayer() {
    if (P.inv > 0 || !P.alive) return;
    if (P.shield) {
      P.shield = false; P.inv = 1.2;
      fxs.push({ kind: 1, x: P.x, y: P.y, t: 0, life: 0.5, size: 260, r: 0.4, g: 1, b: 0.7 });
      GFX.shock(P.x, P.y, 0.02, 600, 0.6); G.shake = 10; SFX.shieldBreak();
      return;
    }
    P.alive = false; P.resp = 1.9; P.twin = P.rapid = 0; G.combo = 0; G.comboT = 0;
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
  const keys = { left: false, right: false, fire: false };
  const pointer = { active: false, x: FW / 2 };
  function updatePlayer(dt) {
    if (!P.alive) {
      if (G.lives > 0) {
        P.resp -= dt;
        if (P.resp <= 0) { P.alive = true; P.x = FW / 2; P.vx = 0; P.inv = 2.6; ebul.length = 0; }
      }
      return;
    }
    let tv = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * 440;
    if (pointer.active) tv = clamp((pointer.x - P.x) * 10, -560, 560);
    P.vx += (tv - P.vx) * Math.min(1, dt * 14);
    P.x = clamp(P.x + P.vx * dt, 38, FW - 38);
    P.tilt += (P.vx / 440 - P.tilt) * Math.min(1, dt * 10);
    P.inv = Math.max(0, P.inv - dt); P.twin = Math.max(0, P.twin - dt); P.rapid = Math.max(0, P.rapid - dt);
    P.cool -= dt;
    const maxB = (P.rapid > 0 ? 6 : 3) * (P.twin > 0 ? 2 : 1);
    if ((keys.fire || pointer.active) && P.cool <= 0 && bullets.length < maxB) {
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
      let gone = b.y < -30;
      for (let j = enemies.length - 1; j >= 0 && !gone; j--) {
        const e = enemies[j];
        if (e.state === 'enter' && e.t < 0) continue;
        const dx = e.x - b.x, dy = e.y - b.y, rr = e.T.r + 7;
        if (dx * dx + dy * dy < rr * rr) {
          gone = true;
          if (--e.hp <= 0) killEnemy(j);
          else {
            e.flash = 1; SFX.hit(); G.shake = Math.max(G.shake, 3);
            for (let k = 0; k < 10; k++) { const a = rand(0, TAU), v = rand(80, 320); spawnP(b.x, b.y, Math.cos(a) * v, Math.sin(a) * v, rand(0.2, 0.45), 6, 1.6, 1.8, 1.4, 3, 1); }
          }
        }
      }
      if (gone) bullets.splice(i, 1);
    }
    for (let i = ebul.length - 1; i >= 0; i--) {
      const b = ebul[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt;
      if (b.y > FH + 30) { ebul.splice(i, 1); continue; }
      if (P.alive) {
        const dx = b.x - P.x, dy = b.y - P.y;
        if (dx * dx + dy * dy < 17 * 17) { ebul.splice(i, 1); hurtPlayer(); }
      }
    }
    if (P.alive) for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (e.state === 'form' || (e.state === 'enter' && e.t < 0)) continue;
      const dx = e.x - P.x, dy = e.y - P.y, rr = e.T.r + 14;
      if (dx * dx + dy * dy < rr * rr) { if (P.inv <= 0) { if (--e.hp <= 0) killEnemy(j); else e.flash = 1; } hurtPlayer(); break; }
    }
    for (let i = pows.length - 1; i >= 0; i--) {
      const p = pows[i];
      p.y += 120 * dt; p.t += dt;
      if (p.y > FH + 40) { pows.splice(i, 1); continue; }
      if (P.alive && Math.abs(p.x - P.x) < 34 && Math.abs(p.y - P.y) < 34) {
        pows.splice(i, 1);
        if (p.kind === 'twin') P.twin = 14; else if (p.kind === 'rapid') P.rapid = 12; else P.shield = true;
        const c = POWS[p.kind].col;
        fxs.push({ kind: 1, x: P.x, y: P.y, t: 0, life: 0.5, size: 240, r: c[0], g: c[1], b: c[2] });
        pops.push({ x: P.x, y: P.y - 40, s: '+', t: 0, col: c, sc: 1.6 });
        addScore(100); SFX.power();
      }
    }
  }

  /* ---------- flow ---------- */
  function start() {
    SFX.init(); SFX.start(); SFX.setIntensity(1);
    enemies = []; bullets = []; ebul = []; pows = []; pops = [];
    Object.assign(G, { mode: 'play', paused: false, score: 0, wave: 1, lives: 3, combo: 0, comboT: 0, clearT: 0, overT: 0, nextLife: 15000, hueT: 0 });
    Object.assign(P, { x: FW / 2, vx: 0, tilt: 0, alive: true, inv: 2, shield: false, twin: 0, rapid: 0, cool: 0 });
    spawnWave(1);
    $('title').classList.add('hidden'); $('over').classList.add('hidden'); $('pause').classList.add('hidden');
    $('hud').classList.remove('hidden');
    banner('WAVE 01', 'THE FLOCK IS GATHERING');
  }
  function gameOver() {
    G.mode = 'over'; SFX.setIntensity(0);
    const isBest = G.score > G.best;
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

    updateEnemies(dt);
    if (G.mode === 'play') {
      updatePlayer(dt);
      updateShots(dt);
      if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
      if (G.overT > 0) { G.overT -= rdt; if (G.overT <= 0) gameOver(); }
      else if (!enemies.length && G.lives > 0) {
        if (G.clearT <= 0) { G.clearT = 2.6; addScore(500 * G.wave); banner('WAVE CLEARED', 'JUMPING TO THE NEXT SKY'); SFX.wave(); }
        else {
          G.clearT -= dt;
          if (G.clearT <= 0) {
            G.wave++; G.hueT += 0.115; spawnWave(G.wave);
            banner('WAVE ' + String(G.wave).padStart(2, '0'), G.wave % 5 === 0 ? 'THEY ARE ANGRY NOW' : 'INCOMING');
          }
        }
      }
    } else {
      if (G.mode === 'over' && G.overT > 0) G.overT -= rdt;
      for (let i = ebul.length - 1; i >= 0; i--) { const b = ebul[i]; b.y += b.vy * dt; b.x += b.vx * dt; if (b.y > FH + 30) ebul.splice(i, 1); }
      if (!enemies.length) spawnWave(1); // attract mode keeps a swarm on screen
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
  function draw() {
    const gl = S.glow, t = G.time;
    drawParticles();

    for (const p of pows) {
      const d = POWS[p.kind], c = d.col, pu = 1 + Math.sin(p.t * 6) * 0.08;
      Q(gl, p.x, p.y, 120, 120, 0, c[0] * 0.3, c[1] * 0.3, c[2] * 0.3, 1, 1);
      Q(S[d.spr], p.x, p.y, 44 * pu, 44 * pu, Math.sin(p.t * 2.2) * 0.25, c[0] * 1.5, c[1] * 1.5, c[2] * 1.5, 1, 0);
    }
    for (const b of bullets) {
      Q(gl, b.x, b.y, 44, 96, 0, 0.1, 0.45, 0.85, 1, 1);
      Q(S.bolt, b.x, b.y, 16, 48, 0, 1.2, 2.3, 2.8, 1, 1);
    }
    for (const e of enemies) {
      if (e.state === 'enter' && e.t < 0) continue;
      const T = e.T, c = T.col, k = 1.25 + e.flash * 3;
      const sp = S[T.spr + (((t * T.flap + e.ph) | 0) & 3)];
      Q(gl, e.x, e.y, T.size * 1.9, T.size * 1.9, 0, c[0] * 0.3, c[1] * 0.3, c[2] * 0.3, 1, 1);
      Q(sp, e.x, e.y, T.size, T.size, e.rot, k, k, k, 1, 0);
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
      if (P.shield) {
        const z = 104 + Math.sin(t * 5) * 4;
        Q(S.shield, P.x, P.y, z, z, t * 0.8, 0.35, 1.5, 0.9, 0.85, 1);
      }
    }
    for (const f of fxs) {
      const u = f.t / f.life, a = (1 - u) * (1 - u);
      if (f.kind === 0) { const z = f.size * (0.5 + u * 0.8), k = a * 1.7; Q(gl, f.x, f.y, z, z, 0, (f.r * 0.6 + 0.55) * k, (f.g * 0.6 + 0.55) * k, (f.b * 0.6 + 0.55) * k, 1, 1); }
      else if (f.kind === 1) { const z = f.size * (0.2 + 0.95 * (1 - (1 - u) * (1 - u))), k = a * 1.6; Q(S.ring, f.x, f.y, z, z, 0, f.r * k, f.g * k, f.b * k, 1, 1); }
      else { const k = a * 1.3; Q(gl, f.x, f.y, f.size * (0.6 + u), 11 * (1 - u), 0, (f.r + 0.4) * k, (f.g + 0.4) * k, (f.b + 0.4) * k, 1, 1); }
    }
    for (const p of pops) {
      const a = Math.min(1, (0.9 - p.t) * 3) * 1.5, sc = p.sc * (1 + Math.max(0, 0.12 - p.t) * 4);
      text(p.s, p.x, p.y, sc, (p.col[0] * 0.6 + 0.5) * a, (p.col[1] * 0.6 + 0.5) * a, (p.col[2] * 0.6 + 0.5) * a);
    }
  }

  /* ---------- HUD (plain DOM, updated only on change) ---------- */
  const hud = { score: -1, best: -1, wave: -1, lives: -1, mult: -1, chips: '' };
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
    const chips = (P.twin > 0 ? 'TWIN ' + Math.ceil(P.twin) + '|' : '') + (P.rapid > 0 ? 'RAPID ' + Math.ceil(P.rapid) + '|' : '') + (P.shield ? 'SHIELD|' : '');
    if (hud.chips !== chips) { hud.chips = chips; $('chips').innerHTML = chips.split('|').filter(Boolean).map(s => '<span class="chip ' + s.split(' ')[0].toLowerCase() + '">' + s + '</span>').join(''); }
  }

  /* ---------- input ---------- */
  function begin() { if (G.mode === 'title' || (G.mode === 'over' && G.overT <= 0)) start(); }
  addEventListener('keydown', e => {
    const k = e.code;
    if (k === 'ArrowLeft' || k === 'KeyA') keys.left = true;
    else if (k === 'ArrowRight' || k === 'KeyD') keys.right = true;
    else if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW') { keys.fire = true; if (!e.repeat) begin(); }
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
    pointer.active = true; pointer.x = GFX.toFieldX(e.clientX);
  });
  addEventListener('pointermove', e => { if (pointer.active) pointer.x = GFX.toFieldX(e.clientX); });
  addEventListener('pointerup', () => { pointer.active = false; });
  addEventListener('pointercancel', () => { pointer.active = false; });
  addEventListener('blur', () => { keys.left = keys.right = keys.fire = false; pointer.active = false; if (G.mode === 'play' && !G.paused) togglePause(); });
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
  spawnWave(1);
  $('titleBest').textContent = G.best ? 'BEST ' + G.best.toLocaleString('en-US') : '';
  requestAnimationFrame(frame);
})();
