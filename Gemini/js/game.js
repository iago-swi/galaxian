/* Suncrest — Core Game Loop, Ship & Solar Ward, Scoring, Input & HUD */
(function (global) {
  'use strict';

  const Art = global.SuncrestArt;
  const Audio = global.SuncrestAudio;
  const Ent = global.SuncrestEntities;

  const VERSION = '1.0.0';
  const STORAGE_KEY = 'suncrest.best';
  const ARENA_W = Ent.ARENA_W;
  const ARENA_H = Ent.ARENA_H;

  const SHIP_Y = 664;
  const SHIP_SPEED = 490;
  const SHOT_SPEED = 840;
  const FIRE_COOLDOWN = 0.16;
  const WARD_DURATION = 2.0;
  const WARD_COOLDOWN = 5.0;
  const WING_REGROW_TIME = 3.6;

  // DOM refs
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hudEl = document.getElementById('hud');
  const scoreEl = document.getElementById('hud-score');
  const bestEl = document.getElementById('hud-best');
  const titleBestEl = document.getElementById('title-best');
  const cycleEl = document.getElementById('hud-cycle');
  const stageNameEl = document.getElementById('hud-stage-name');
  const comboSealEl = document.getElementById('combo-seal');
  const livesWrapEl = document.getElementById('lives-wrap');
  const powerupBadgeEl = document.getElementById('powerup-badge');
  const powerupTimerEl = document.getElementById('powerup-timer');
  const wardStateEl = document.getElementById('ward-state');
  const wardFillEl = document.getElementById('ward-fill');
  const bossBarWrap = document.getElementById('boss-bar-wrap');
  const bossFillEl = document.getElementById('boss-fill');
  const bossLabelEl = document.getElementById('boss-label');

  const bannerEl = document.getElementById('banner');
  const bannerKickerEl = document.getElementById('banner-kicker');
  const bannerTitleEl = document.getElementById('banner-title');
  const bannerSubEl = document.getElementById('banner-sub');

  const titleOverlay = document.getElementById('title-overlay');
  const pauseOverlay = document.getElementById('pause-overlay');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const goScoreEl = document.getElementById('go-score');
  const goBestEl = document.getElementById('go-best');
  const goStageEl = document.getElementById('go-stage');
  const newBestTagEl = document.getElementById('new-best-tag');
  const touchControlsEl = document.getElementById('touch-controls');

  const btnStart = document.getElementById('btn-start');
  const btnTitleMute = document.getElementById('btn-title-mute');
  const btnMute = document.getElementById('btn-mute');
  const btnPause = document.getElementById('btn-pause');
  const btnResume = document.getElementById('btn-resume');
  const btnPauseRestart = document.getElementById('btn-pause-restart');
  const btnPauseTitle = document.getElementById('btn-pause-title');
  const btnRestart = document.getElementById('btn-restart');
  const btnGoTitle = document.getElementById('btn-go-title');

  const audio = new Audio();

  function loadBestScore() {
    try {
      const val = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      return Number.isFinite(val) && val > 0 ? val : 0;
    } catch (_) {
      return 0;
    }
  }

  function saveBestScore(score) {
    try {
      localStorage.setItem(STORAGE_KEY, String(score));
    } catch (_) {
      // Ignore storage errors (private mode / restricted file contexts)
    }
  }

  function fmtScore(n) {
    return String(Math.max(0, Math.floor(n))).padStart(6, '0');
  }

  // Game state
  const state = {
    mode: 'title', // 'title' | 'playing' | 'paused' | 'gameover'
    time: 0,
    score: 0,
    best: loadBestScore(),
    newBestAchieved: false,
    practiceMode: false, // true when ?stage=N query param is used
    lives: 3,
    nextExtraLife: 10000,
    stageNum: 1, // 1-based global stage index
    cycle: 1,
    stageInCycle: 0, // 0..4
    stageClearTimer: 0,
    bannerTimer: 0,
    scrollBoost: 0,
    shakeTime: 0,
    shakeMag: 0,
    comboCount: 0,
    comboTimer: 0,
    formationSway: 0,
    diveCooldown: 1.0,
    // Entities
    player: {
      x: ARENA_W * 0.5,
      y: SHIP_Y,
      vx: 0,
      tilt: 0,
      alive: true,
      respawnTimer: 0,
      invulnTimer: 0,
      fireCooldown: 0,
      wardActiveTimer: 0,
      wardCooldownTimer: 0,
      wardWasReady: true,
      twinTimer: 0
    },
    birds: [],
    eggs: [],
    phoenixes: [],
    boss: null,
    playerShots: [],
    enemyShots: [],
    powerups: [],
    particles: [],
    popups: [],
    // Ambient title flock
    titleBirds: []
  };

  // Input tracking
  const input = {
    left: false,
    right: false,
    fire: false,
    wardQueued: false,
    pointerActive: false,
    pointerArenaX: ARENA_W * 0.5
  };

  // Viewport & arena transform
  const view = {
    w: 1280,
    h: 800,
    dpr: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    arenaRect: { x: 0, y: 0, w: ARENA_W, h: ARENA_H }
  };

  function resize() {
    view.w = Math.max(320, window.innerWidth);
    view.h = Math.max(320, window.innerHeight);
    view.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);

    const touchExtra = document.body.classList.contains('touch-active') ? 76 : 0;
    const availH = Math.max(260, view.h - touchExtra);
    view.scale = Math.min(view.w / ARENA_W, availH / ARENA_H);
    const drawW = ARENA_W * view.scale;
    const drawH = ARENA_H * view.scale;
    view.offsetX = (view.w - drawW) * 0.5;
    view.offsetY = (availH - drawH) * 0.5;
    view.arenaRect = { x: view.offsetX, y: view.offsetY, w: drawW, h: drawH };
  }

  function screenToArenaX(clientX) {
    return (clientX - view.offsetX) / view.scale;
  }

  // --- Particle & Popup Helpers ---
  function spawnBurst(x, y, count, color, kind, speedMin, speedMax) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speedMin + Math.random() * (speedMax - speedMin);
      const maxLife = 0.45 + Math.random() * 0.5;
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        size: kind === 'feather' ? 5 + Math.random() * 4 : (3 + Math.random() * 4),
        life: maxLife,
        maxLife,
        color,
        kind: kind || 'spark',
        gravity: kind === 'feather' ? 42 : (kind === 'shard' ? 140 : 12)
      });
    }
  }

  function spawnRing(x, y, r0, r1, color, dur) {
    state.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      rot: 0,
      vrot: 0,
      r0,
      r1,
      life: dur || 0.36,
      maxLife: dur || 0.36,
      color,
      kind: 'ring',
      gravity: 0
    });
  }

  function spawnPopup(x, y, text, color, big) {
    state.popups.push({
      x,
      y,
      text,
      color: color || '#1b1615',
      big: !!big,
      life: big ? 1.25 : 0.85,
      maxLife: big ? 1.25 : 0.85
    });
  }

  function addShake(mag, dur) {
    state.shakeMag = Math.max(state.shakeMag, mag);
    state.shakeTime = Math.max(state.shakeTime, dur);
  }

  // --- Scoring, Multiplier & Extra Lives ---
  function getMultiplier() {
    if (state.comboCount >= 9) return 4;
    if (state.comboCount >= 6) return 3;
    if (state.comboCount >= 3) return 2;
    return 1;
  }

  function registerKillCombo() {
    state.comboCount++;
    state.comboTimer = 2.6;
  }

  function addScore(points, x, y, countTowardCombo, bigPopup) {
    if (countTowardCombo) registerKillCombo();
    const mult = countTowardCombo ? getMultiplier() : 1;
    const gained = points * mult;
    state.score += gained;

    if (x !== undefined && y !== undefined) {
      const label = mult > 1 ? `+${gained} ×${mult}` : `+${gained}`;
      spawnPopup(x, y, label, mult > 1 ? '#cf341c' : '#1b1615', bigPopup);
    }

    if (!state.practiceMode && state.score > state.best) {
      state.best = state.score;
      state.newBestAchieved = true;
      saveBestScore(state.best);
    }

    // Extra life award at 10,000, then every 20,000 (up to 5 lives)
    while (state.score >= state.nextExtraLife) {
      if (state.lives < 5) {
        state.lives++;
        audio.playExtraLife();
        showBanner('Imperial Blessing', 'Extra Ship', `Awarded at ${state.nextExtraLife.toLocaleString()} points`, 2.2);
        renderLives();
      }
      state.nextExtraLife = state.nextExtraLife === 10000 ? 30000 : state.nextExtraLife + 20000;
    }

    updateHud();
  }

  function showBanner(kicker, title, sub, duration) {
    bannerKickerEl.textContent = kicker;
    bannerTitleEl.textContent = title;
    bannerSubEl.textContent = sub || '';
    state.bannerTimer = duration || 2.1;
    bannerEl.classList.add('visible');
  }

  // --- Stage Setup ---
  function setupStage(stageNum) {
    state.stageNum = stageNum;
    state.cycle = Math.floor((stageNum - 1) / 5) + 1;
    state.stageInCycle = (stageNum - 1) % 5;
    const stageType = Ent.STAGE_TYPES[state.stageInCycle];
    const pal = Art.STAGE_PALETTES[state.stageInCycle];

    state.birds = [];
    state.eggs = [];
    state.phoenixes = [];
    state.boss = null;
    state.enemyShots = [];
    state.playerShots = [];
    state.stageClearTimer = 0;
    state.scrollBoost = 1.0;
    state.diveCooldown = Math.max(0.45, 1.15 - (state.cycle - 1) * 0.15);

    if (stageType === 'flock1' || stageType === 'flock2') {
      state.birds = Ent.createFlock(stageType, state.cycle);
      audio.setMusicMode('flock');
    } else if (stageType === 'brood1' || stageType === 'brood2') {
      state.eggs = Ent.createEggs(stageType, state.cycle);
      audio.setMusicMode('brood');
    } else {
      state.boss = Ent.createSunArk(state.cycle);
      audio.setMusicMode('boss');
    }

    const cycleTag = `Cycle ${state.cycle} · Stage ${state.stageInCycle + 1}`;
    showBanner(cycleTag, pal.name, pal.sub, 2.3);
    updateHud();
  }

  function startGame(startStage) {
    audio.init();
    state.practiceMode = typeof startStage === 'number' && startStage > 1;
    state.mode = 'playing';
    state.score = 0;
    state.newBestAchieved = false;
    state.lives = 3;
    state.nextExtraLife = 10000;
    state.comboCount = 0;
    state.comboTimer = 0;
    state.particles = [];
    state.popups = [];
    state.powerups = [];

    const pl = state.player;
    pl.x = ARENA_W * 0.5;
    pl.y = SHIP_Y;
    pl.vx = 0;
    pl.tilt = 0;
    pl.alive = true;
    pl.respawnTimer = 0;
    pl.invulnTimer = 1.6;
    pl.fireCooldown = 0;
    pl.wardActiveTimer = 0;
    pl.wardCooldownTimer = 0;
    pl.wardWasReady = true;
    pl.twinTimer = 0;

    titleOverlay.classList.remove('visible');
    pauseOverlay.classList.remove('visible');
    gameoverOverlay.classList.remove('visible');
    hudEl.classList.add('visible');
    touchControlsEl.classList.add('visible');

    renderLives();
    setupStage(startStage || 1);
  }

  function returnToTitle() {
    state.mode = 'title';
    audio.setMusicMode('idle');
    hudEl.classList.remove('visible');
    pauseOverlay.classList.remove('visible');
    gameoverOverlay.classList.remove('visible');
    bannerEl.classList.remove('visible');
    bossBarWrap.classList.remove('visible');
    touchControlsEl.classList.remove('visible');
    titleOverlay.classList.add('visible');
    titleBestEl.textContent = fmtScore(state.best);
    state.titleBirds = Ent.createFlock('flock1', 1);
  }

  function togglePause(forcePause) {
    if (state.mode !== 'playing' && state.mode !== 'paused') return;
    const shouldPause = typeof forcePause === 'boolean' ? forcePause : state.mode === 'playing';
    if (shouldPause && state.mode === 'playing') {
      state.mode = 'paused';
      pauseOverlay.classList.add('visible');
    } else if (!shouldPause && state.mode === 'paused') {
      state.mode = 'playing';
      pauseOverlay.classList.remove('visible');
    }
  }

  function triggerGameOver() {
    state.mode = 'gameover';
    audio.setMusicMode('idle');
    bannerEl.classList.remove('visible');
    bossBarWrap.classList.remove('visible');
    touchControlsEl.classList.remove('visible');

    goScoreEl.textContent = fmtScore(state.score);
    goBestEl.textContent = fmtScore(state.best);
    goStageEl.textContent = `C${state.cycle} · S${state.stageInCycle + 1}`;
    newBestTagEl.classList.toggle('visible', state.newBestAchieved && !state.practiceMode);
    gameoverOverlay.classList.add('visible');
  }

  // --- Player Damage & Solar Ward ---
  function activateWard() {
    const pl = state.player;
    if (!pl.alive || pl.wardActiveTimer > 0 || pl.wardCooldownTimer > 0) return;
    pl.wardActiveTimer = WARD_DURATION;
    pl.wardWasReady = false;
    audio.playWardActivate();
    spawnRing(pl.x, pl.y, 12, 46, '#d69926', 0.34);
  }

  function damagePlayer() {
    const pl = state.player;
    if (!pl.alive || pl.invulnTimer > 0 || pl.wardActiveTimer > 0) return;
    pl.alive = false;
    pl.twinTimer = 0;
    state.comboCount = 0;
    state.comboTimer = 0;
    state.lives--;
    renderLives();

    audio.playPlayerHit();
    addShake(11, 0.42);
    spawnRing(pl.x, pl.y, 10, 68, '#cf341c', 0.45);
    spawnBurst(pl.x, pl.y, 26, '#cf341c', 'shard', 70, 260);
    spawnBurst(pl.x, pl.y, 18, '#f4c14a', 'spark', 50, 220);

    if (state.lives <= 0) {
      pl.respawnTimer = 1.4;
    } else {
      pl.respawnTimer = 1.5;
      // Push boss up slightly if it had descended onto the ship
      if (state.boss && !state.boss.dying && state.boss.y > 410) {
        state.boss.y -= 85;
      }
    }
  }

  function maybeDropPowerup(x, y, chance) {
    if (state.powerups.length >= 1) return;
    if (Math.random() < chance) {
      state.powerups.push({
        x,
        y,
        vy: 112,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  // --- HUD Rendering ---
  function renderLives() {
    let html = '';
    for (let i = 0; i < state.lives; i++) {
      html += Art.getLifeIconSVG();
    }
    livesWrapEl.innerHTML = html || '<span class="hud-label" style="font-size:10px">LAST</span>';
  }

  function updateHud() {
    scoreEl.textContent = fmtScore(state.score);
    bestEl.textContent = fmtScore(state.best);
    titleBestEl.textContent = fmtScore(state.best);

    const pal = Art.STAGE_PALETTES[state.stageInCycle];
    cycleEl.textContent = `Cycle ${state.cycle} · Stage ${state.stageInCycle + 1}`;
    stageNameEl.textContent = pal.name;

    const mult = getMultiplier();
    comboSealEl.textContent = `×${mult}`;
    comboSealEl.classList.toggle('active', mult > 1 && state.comboTimer > 0);

    // Solar Ward gauge
    const pl = state.player;
    if (pl.wardActiveTimer > 0) {
      const pct = (pl.wardActiveTimer / WARD_DURATION) * 100;
      wardStateEl.textContent = 'ACTIVE';
      wardStateEl.className = 'active';
      wardFillEl.className = 'active';
      wardFillEl.style.width = `${pct.toFixed(1)}%`;
    } else if (pl.wardCooldownTimer > 0) {
      const pct = (1 - pl.wardCooldownTimer / WARD_COOLDOWN) * 100;
      wardStateEl.textContent = `${pl.wardCooldownTimer.toFixed(1)}s`;
      wardStateEl.className = 'recharging';
      wardFillEl.className = 'recharging';
      wardFillEl.style.width = `${pct.toFixed(1)}%`;
    } else {
      wardStateEl.textContent = 'READY';
      wardStateEl.className = '';
      wardFillEl.className = '';
      wardFillEl.style.width = '100%';
    }

    // Twin Lance power-up badge
    if (pl.twinTimer > 0) {
      powerupBadgeEl.classList.add('visible');
      powerupTimerEl.textContent = `${Math.ceil(pl.twinTimer)}s`;
    } else {
      powerupBadgeEl.classList.remove('visible');
    }

    // Boss HP bar
    if (state.boss && !state.boss.dying && state.mode === 'playing') {
      bossBarWrap.classList.add('visible');
      bossLabelEl.textContent = state.cycle > 1 ? `The Sun-Ark · Cycle ${state.cycle}` : 'The Sun-Ark';
      const pct = Math.max(0, (state.boss.coreHp / state.boss.coreMaxHp) * 100);
      bossFillEl.style.width = `${pct.toFixed(1)}%`;
    } else {
      bossBarWrap.classList.remove('visible');
    }
  }

  function syncMuteButtons() {
    const label = audio.muted ? 'Muted' : 'Sound';
    btnMute.textContent = label;
    btnTitleMute.textContent = audio.muted ? 'Sound: Off' : 'Sound: On';
  }

  // --- Update Loops ---
  function updateTitleFlock(dt) {
    state.formationSway += dt * 1.15;
    const swayX = Math.sin(state.formationSway) * 52;
    for (const b of state.titleBirds) {
      b.flapPhase += dt * b.spec.flapSpeed;
      if (b.state === 'entering') {
        if (b.entryDelay > 0) {
          b.entryDelay -= dt;
          continue;
        }
        b.entryT = Math.min(1, b.entryT + dt * 0.9);
        const t = b.entryT;
        const mt = 1 - t;
        const tx = b.homeX + swayX;
        const ty = b.homeY;
        const nx = mt * mt * mt * b.entryP0.x + 3 * mt * mt * t * b.entryP1.x + 3 * mt * t * t * b.entryP2.x + t * t * t * tx;
        const ny = mt * mt * mt * b.entryP0.y + 3 * mt * mt * t * b.entryP1.y + 3 * mt * t * t * b.entryP2.y + t * t * t * ty;
        b.angle = Math.atan2(ny - b.y, nx - b.x) - Math.PI * 0.5;
        b.x = nx;
        b.y = ny;
        if (b.entryT >= 1) {
          b.state = 'formation';
          b.angle = 0;
        }
      } else {
        b.x = b.homeX + swayX;
        b.y = b.homeY + Math.sin(state.time * 2.2 + b.col * 0.6) * 6;
        b.angle = Math.sin(state.formationSway) * 0.08;
      }
    }
  }

  function updateGame(dt) {
    state.time += dt;
    state.scrollBoost = Math.max(0, state.scrollBoost - dt * 0.65);

    if (state.shakeTime > 0) {
      state.shakeTime = Math.max(0, state.shakeTime - dt);
      if (state.shakeTime === 0) state.shakeMag = 0;
    }

    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) {
        bannerEl.classList.remove('visible');
      }
    }

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.comboCount = 0;
    }

    updatePlayer(dt);
    updateShots(dt);
    updateBirds(dt);
    updateEggs(dt);
    updatePhoenixes(dt);
    updateBoss(dt);
    updatePowerups(dt);
    updateParticlesAndPopups(dt);
    checkStageClear(dt);
    updateHud();
  }

  function updatePlayer(dt) {
    const pl = state.player;
    if (!pl.alive) {
      pl.respawnTimer -= dt;
      if (pl.respawnTimer <= 0) {
        if (state.lives <= 0) {
          triggerGameOver();
          return;
        }
        pl.alive = true;
        pl.x = ARENA_W * 0.5;
        pl.y = SHIP_Y;
        pl.vx = 0;
        pl.invulnTimer = 2.4;
        pl.wardActiveTimer = 0;
        pl.wardCooldownTimer = 0;
        pl.wardWasReady = true;
      }
      return;
    }

    if (pl.invulnTimer > 0) pl.invulnTimer = Math.max(0, pl.invulnTimer - dt);
    if (pl.fireCooldown > 0) pl.fireCooldown = Math.max(0, pl.fireCooldown - dt);
    if (pl.twinTimer > 0) pl.twinTimer = Math.max(0, pl.twinTimer - dt);

    // Solar Ward state machine
    if (input.wardQueued) {
      input.wardQueued = false;
      activateWard();
    }
    if (pl.wardActiveTimer > 0) {
      pl.wardActiveTimer -= dt;
      if (pl.wardActiveTimer <= 0) {
        pl.wardActiveTimer = 0;
        pl.wardCooldownTimer = WARD_COOLDOWN;
      }
    } else if (pl.wardCooldownTimer > 0) {
      pl.wardCooldownTimer = Math.max(0, pl.wardCooldownTimer - dt);
      if (pl.wardCooldownTimer === 0 && !pl.wardWasReady) {
        pl.wardWasReady = true;
        audio.playWardReady();
        spawnRing(pl.x, pl.y, 16, 38, '#e9b949', 0.35);
      }
    }

    // Horizontal movement (slightly slower while Solar Ward is active)
    const speedFactor = pl.wardActiveTimer > 0 ? 0.55 : 1.0;
    let moveDir = 0;
    if (input.left) moveDir -= 1;
    if (input.right) moveDir += 1;

    if (moveDir !== 0) {
      pl.vx = moveDir * SHIP_SPEED * speedFactor;
      pl.x += pl.vx * dt;
    } else if (input.pointerActive) {
      const diff = input.pointerArenaX - pl.x;
      const maxStep = SHIP_SPEED * 1.15 * speedFactor * dt;
      const step = Math.max(-maxStep, Math.min(maxStep, diff));
      pl.vx = dt > 0 ? step / dt : 0;
      pl.x += step;
    } else {
      pl.vx *= 0.72;
    }

    pl.x = Math.max(42, Math.min(ARENA_W - 42, pl.x));
    const targetTilt = Math.max(-1, Math.min(1, pl.vx / SHIP_SPEED));
    pl.tilt += (targetTilt - pl.tilt) * Math.min(1, dt * 14);

    // Firing (disabled while Solar Ward is raised)
    const maxShots = pl.twinTimer > 0 ? 8 : 4;
    if (input.fire && pl.wardActiveTimer <= 0 && pl.fireCooldown <= 0 && state.playerShots.length < maxShots) {
      pl.fireCooldown = FIRE_COOLDOWN;
      if (pl.twinTimer > 0) {
        state.playerShots.push({ x: pl.x - 11, y: pl.y - 20, prevX: pl.x - 11, prevY: pl.y - 20, vy: -SHOT_SPEED });
        state.playerShots.push({ x: pl.x + 11, y: pl.y - 20, prevX: pl.x + 11, prevY: pl.y - 20, vy: -SHOT_SPEED });
      } else {
        state.playerShots.push({ x: pl.x, y: pl.y - 22, prevX: pl.x, prevY: pl.y - 22, vy: -SHOT_SPEED });
      }
      audio.playShot();
    }
  }

  function updateShots(dt) {
    // Player shots
    for (let i = state.playerShots.length - 1; i >= 0; i--) {
      const s = state.playerShots[i];
      s.prevX = s.x;
      s.prevY = s.y;
      s.y += s.vy * dt;

      if (s.y < -20) {
        state.playerShots.splice(i, 1);
        continue;
      }

      let consumed = false;

      // 1. Check against small birds
      for (let j = state.birds.length - 1; j >= 0; j--) {
        const b = state.birds[j];
        if (b.state === 'entering' && b.entryDelay > 0) continue;
        const dx = s.x - b.x;
        const dy = s.y - b.y;
        const r = b.spec.hitR + 6;
        if (dx * dx + dy * dy <= r * r) {
          const pts = b.state === 'diving' ? b.spec.points * 2 : b.spec.points;
          addScore(pts, b.x, b.y, true, b.state === 'diving');
          audio.playBirdHit(b.state === 'diving');
          spawnBurst(b.x, b.y, 12, b.spec.featherColor, 'feather', 40, 180);
          spawnRing(b.x, b.y, 6, 26, '#1b1615', 0.24);
          if (b.state === 'diving') maybeDropPowerup(b.x, b.y, 0.08);
          state.birds.splice(j, 1);
          consumed = true;
          break;
        }
      }
      if (consumed) {
        state.playerShots.splice(i, 1);
        continue;
      }

      // 2. Check against Kintsugi eggs
      for (let j = state.eggs.length - 1; j >= 0; j--) {
        const e = state.eggs[j];
        const dx = s.x - e.x;
        const dy = s.y - e.y;
        const r = e.radius + 6;
        if (dx * dx + dy * dy <= r * r) {
          addScore(50, e.x, e.y, true, false);
          audio.playEggBreak();
          spawnBurst(e.x, e.y, 11, '#fbf5e4', 'shard', 55, 195);
          spawnBurst(e.x, e.y, 7, '#235185', 'shard', 45, 165);
          spawnBurst(e.x, e.y, 6, '#e6b23e', 'spark', 40, 150);
          state.eggs.splice(j, 1);
          consumed = true;
          break;
        }
      }
      if (consumed) {
        state.playerShots.splice(i, 1);
        continue;
      }

      // 3. Check against Great Solar Phoenixes (Body kills; Wings shear off & regrow!)
      for (let j = state.phoenixes.length - 1; j >= 0; j--) {
        const ph = state.phoenixes[j];
        const dx = s.x - ph.x;
        const dy = s.y - ph.y;
        // Rotate into phoenix local space
        const ca = Math.cos(-ph.angle);
        const sa = Math.sin(-ph.angle);
        const lx = dx * ca - dy * sa;
        const ly = dx * sa + dy * ca;

        // Body hit destroys the Great Phoenix
        if ((lx * lx) / (17 * 17) + (ly * ly) / (23 * 23) <= 1) {
          const pts = ph.state === 'swooping' ? 400 : 250;
          addScore(pts, ph.x, ph.y, true, true);
          audio.playPhoenixKill();
          addShake(4.5, 0.18);
          spawnRing(ph.x, ph.y, 10, 46, '#cf341c', 0.34);
          spawnBurst(ph.x, ph.y, 18, '#d43a1f', 'feather', 60, 230);
          spawnBurst(ph.x, ph.y, 12, '#f2be49', 'feather', 50, 200);
          maybeDropPowerup(ph.x, ph.y, 0.28);
          state.phoenixes.splice(j, 1);
          consumed = true;
          break;
        }

        // Left wing hit
        if (ph.leftWing && lx >= -58 && lx <= -14 && ly >= -22 && ly <= 22) {
          ph.leftWing = false;
          ph.leftRegrow = WING_REGROW_TIME;
          ph.hitFlash = 0.14;
          addScore(30, s.x, s.y, false, false);
          audio.playWingShear();
          spawnBurst(s.x, s.y, 11, '#d43a1f', 'feather', 40, 175);
          spawnBurst(s.x, s.y, 6, '#f2be49', 'spark', 40, 140);
          consumed = true;
          break;
        }

        // Right wing hit
        if (ph.rightWing && lx >= 14 && lx <= 58 && ly >= -22 && ly <= 22) {
          ph.rightWing = false;
          ph.rightRegrow = WING_REGROW_TIME;
          ph.hitFlash = 0.14;
          addScore(30, s.x, s.y, false, false);
          audio.playWingShear();
          spawnBurst(s.x, s.y, 11, '#d43a1f', 'feather', 40, 175);
          spawnBurst(s.x, s.y, 6, '#f2be49', 'spark', 40, 140);
          consumed = true;
          break;
        }
      }
      if (consumed) {
        state.playerShots.splice(i, 1);
        continue;
      }

      // 4. Check against The Sun-Ark Boss (Layer 1 Tiles -> Layer 2 Revolving Belt -> Core / Hull)
      if (state.boss) {
        const res = Ent.testShotAgainstSunArk(state.boss, s.prevX, s.prevY, s.x, s.y);
        if (res.hit) {
          consumed = true;
          if (res.kind === 'tile') {
            res.target.alive = false;
            addScore(15, res.x, res.y, false, false);
            audio.playTileBreak(false);
            spawnBurst(res.x, res.y, 7, '#d23b21', 'shard', 40, 160);
          } else if (res.kind === 'belt') {
            res.target.alive = false;
            res.target.regrowTimer = 18.0; // Slowly reforges far later if fight drags on
            addScore(30, res.x, res.y, false, false);
            audio.playTileBreak(true);
            spawnBurst(res.x, res.y, 9, '#e5b242', 'shard', 50, 185);
          } else if (res.kind === 'core') {
            damageBossCore(1, res.x, res.y);
          } else {
            // Deflected by solid hull
            spawnBurst(res.x, res.y, 4, '#f0dec0', 'spark', 30, 110);
          }
        }
      }

      if (consumed) {
        state.playerShots.splice(i, 1);
      }
    }

    // Enemy shots
    const pl = state.player;
    for (let i = state.enemyShots.length - 1; i >= 0; i--) {
      const b = state.enemyShots[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -30 || b.x > ARENA_W + 30 || b.y < -30 || b.y > ARENA_H + 30) {
        state.enemyShots.splice(i, 1);
        continue;
      }

      if (pl.alive) {
        const dx = b.x - pl.x;
        const dy = b.y - pl.y;
        if (pl.wardActiveTimer > 0) {
          // Solar Ward deflects & vaporizes enemy shots
          if (dx * dx + dy * dy <= 38 * 38) {
            audio.playWardDeflect();
            spawnBurst(b.x, b.y, 6, '#f6c952', 'spark', 50, 160);
            state.enemyShots.splice(i, 1);
            continue;
          }
        } else if (dx * dx + dy * dy <= 16 * 16) {
          state.enemyShots.splice(i, 1);
          damagePlayer();
        }
      }
    }
  }

  function damageBossCore(amount, hx, hy) {
    const boss = state.boss;
    if (!boss || boss.dying) return;
    boss.coreHp = Math.max(0, boss.coreHp - amount);
    boss.coreHitFlash = 0.16;
    const x = hx !== undefined ? hx : boss.x;
    const y = hy !== undefined ? hy : boss.y + boss.coreY;

    addScore(150 * amount, x, y, false, true);
    audio.playBossCoreHit();
    addShake(6, 0.22);
    spawnRing(x, y, 12, 54, '#f5c753', 0.34);
    spawnBurst(x, y, 14, '#e6421d', 'spark', 60, 220);

    if (boss.coreHp <= 0) {
      boss.dying = true;
      boss.dyingTimer = 2.6;
      boss.explosionTick = 0;
      state.enemyShots = [];
      state.birds = []; // Clear remaining escorts
      audio.playBossDestroy();
      addScore(3000 * state.cycle, boss.x, boss.y, false, true);
      showBanner('The Sun-Ark Falls', `+${(3000 * state.cycle).toLocaleString()}`, `Cycle ${state.cycle} complete`, 2.5);
    }
  }

  function updateBirds(dt) {
    state.formationSway += dt * (1.25 + (state.cycle - 1) * 0.12);
    const swayX = Math.sin(state.formationSway) * 58;
    const breathe = 1 + Math.sin(state.formationSway * 2) * 0.04;

    const isGale = state.stageInCycle === 1;
    const maxDivers = Math.min(7, 2 + Math.floor((state.cycle - 1) * 1.2) + (isGale ? 1 : 0));
    const speedScale = 1 + Math.min(0.6, (state.cycle - 1) * 0.12) + (isGale ? 0.08 : 0);
    const bulletSpeed = Math.min(460, 295 + (state.cycle - 1) * 28 + (isGale ? 18 : 0));

    let divingCount = 0;
    const readyToDive = [];

    for (let i = state.birds.length - 1; i >= 0; i--) {
      const b = state.birds[i];
      b.flapPhase += dt * b.spec.flapSpeed;

      if (b.state === 'entering') {
        if (b.entryDelay > 0) {
          b.entryDelay -= dt;
          continue;
        }
        b.entryT = Math.min(1, b.entryT + dt * 1.05);
        const t = b.entryT;
        const mt = 1 - t;
        const tx = ARENA_W * 0.5 + (b.homeX - ARENA_W * 0.5) * breathe + swayX;
        const ty = b.homeY;
        const nx = mt * mt * mt * b.entryP0.x + 3 * mt * mt * t * b.entryP1.x + 3 * mt * t * t * b.entryP2.x + t * t * t * tx;
        const ny = mt * mt * mt * b.entryP0.y + 3 * mt * mt * t * b.entryP1.y + 3 * mt * t * t * b.entryP2.y + t * t * t * ty;
        b.angle = Math.atan2(ny - b.y, nx - b.x) - Math.PI * 0.5;
        b.x = nx;
        b.y = ny;
        if (b.entryT >= 1) {
          b.state = 'formation';
          b.angle = 0;
        }
      } else if (b.state === 'formation') {
        const tx = ARENA_W * 0.5 + (b.homeX - ARENA_W * 0.5) * breathe + swayX;
        const ty = b.homeY + Math.sin(state.time * 2.5 + b.col * 0.55) * 5;
        b.x += (tx - b.x) * Math.min(1, dt * 8);
        b.y += (ty - b.y) * Math.min(1, dt * 8);
        b.angle *= 0.85;
        readyToDive.push(b);
      } else if (b.state === 'diving') {
        divingCount++;
        b.diveTime += dt;
        const sp = b.spec.diveSpeed * speedScale;

        // Track toward player until close to ship altitude, then commit straight so player can dodge
        let targetVx = Math.sin(b.diveTime * b.spec.weaveFreq) * b.spec.weaveAmp * b.diveDir;
        if (b.y < SHIP_Y - 145 && state.player.alive) {
          const steer = Math.max(-180, Math.min(180, (state.player.x - b.x) * 1.1));
          targetVx += steer;
        }
        b.vx += (targetVx - b.vx) * Math.min(1, dt * 3.4);
        b.vy = Math.min(sp, b.vy + sp * 1.6 * dt);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.angle = Math.atan2(b.vy, b.vx) - Math.PI * 0.5;

        // Fire at player during dive
        b.nextShotTime -= dt;
        if (b.shotsLeft > 0 && b.nextShotTime <= 0 && b.y > 120 && b.y < SHIP_Y - 130 && state.player.alive) {
          b.shotsLeft--;
          b.nextShotTime = 0.55;
          const dx = state.player.x - b.x;
          const dy = state.player.y - b.y;
          const len = Math.hypot(dx, dy) || 1;
          state.enemyShots.push({
            x: b.x,
            y: b.y + 12,
            vx: (dx / len) * bulletSpeed * 0.65,
            vy: Math.max(bulletSpeed * 0.72, (dy / len) * bulletSpeed),
            big: false
          });
        }

        // Wrap back to top if escaped bottom
        if (b.y > ARENA_H + 34) {
          if (b.isEscort) {
            state.birds.splice(i, 1);
            continue;
          }
          b.y = -28;
          b.x = Math.max(60, Math.min(ARENA_W - 60, b.homeX + swayX));
          b.vx = 0;
          b.vy = 110;
          b.state = state.birds.length <= 4 ? 'diving' : 'returning';
          b.diveTime = 0;
          b.shotsLeft = b.spec.shots;
          b.nextShotTime = 0.6;
        }
      } else if (b.state === 'returning') {
        const tx = ARENA_W * 0.5 + (b.homeX - ARENA_W * 0.5) * breathe + swayX;
        const ty = b.homeY;
        const dx = tx - b.x;
        const dy = ty - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 10) {
          b.x = tx;
          b.y = ty;
          b.state = 'formation';
          b.angle = 0;
        } else {
          const step = Math.min(dist, 240 * dt);
          b.x += (dx / dist) * step;
          b.y += (dy / dist) * step;
          b.angle = Math.atan2(dy, dx) - Math.PI * 0.5;
        }
      }

      // Collision with player ship / Solar Ward
      const pl = state.player;
      if (pl.alive && b.state !== 'entering') {
        const dx = b.x - pl.x;
        const dy = b.y - pl.y;
        if (pl.wardActiveTimer > 0) {
          if (dx * dx + dy * dy <= 42 * 42) {
            // Ramming the active Solar Ward destroys the bird!
            addScore(b.spec.points * 2, b.x, b.y, true, false);
            audio.playBirdHit(true);
            audio.playWardDeflect();
            spawnBurst(b.x, b.y, 12, b.spec.featherColor, 'feather', 50, 200);
            state.birds.splice(i, 1);
            continue;
          }
        } else if (dx * dx + dy * dy <= 24 * 24) {
          state.birds.splice(i, 1);
          damagePlayer();
        }
      }
    }

    // Launch new divers from formation
    if (readyToDive.length > 0 && divingCount < maxDivers) {
      state.diveCooldown -= dt;
      if (state.diveCooldown <= 0) {
        // Prefer edge/bottom birds
        readyToDive.sort((a, b) => b.row - a.row);
        const pickPool = readyToDive.slice(0, Math.min(7, readyToDive.length));
        const diver = pickPool[Math.floor(Math.random() * pickPool.length)];
        diver.state = 'diving';
        diver.diveTime = 0;
        diver.diveDir = diver.x < ARENA_W * 0.5 ? 1 : -1;
        diver.vx = diver.diveDir * 85;
        diver.vy = 90;
        diver.shotsLeft = diver.spec.shots + (state.cycle >= 3 ? 1 : 0);
        diver.nextShotTime = 0.4 + Math.random() * 0.35;
        const baseInterval = isGale ? 0.72 : 1.05;
        state.diveCooldown = Math.max(0.28, baseInterval - (state.cycle - 1) * 0.12) + Math.random() * 0.45;
      }
    }
  }

  function updateEggs(dt) {
    const pl = state.player;
    for (let i = state.eggs.length - 1; i >= 0; i--) {
      const e = state.eggs[i];
      e.x += e.vx * dt;
      if (e.x < 46) {
        e.x = 46;
        e.vx = Math.abs(e.vx);
      } else if (e.x > ARENA_W - 46) {
        e.x = ARENA_W - 46;
        e.vx = -Math.abs(e.vx);
      }
      e.y = e.baseY + Math.sin(state.time * e.bobFreq + e.phase) * e.bobAmp;

      // Countdown to hatch into a Great Solar Phoenix
      e.hatchTimer -= dt;
      if (e.hatchTimer <= 0) {
        const ph = Ent.createPhoenixFromEgg(e, state.cycle);
        state.phoenixes.push(ph);
        audio.playEggHatch();
        spawnRing(e.x, e.y, 6, 36, '#e6b23e', 0.32);
        spawnBurst(e.x, e.y, 12, '#fbf5e4', 'shard', 55, 190);
        spawnBurst(e.x, e.y, 8, '#cf341c', 'feather', 40, 160);
        state.eggs.splice(i, 1);
        continue;
      }

      // Collision with player (rare, if egg drifts low)
      if (pl.alive) {
        const dx = e.x - pl.x;
        const dy = e.y - pl.y;
        if (pl.wardActiveTimer > 0 && dx * dx + dy * dy <= 42 * 42) {
          addScore(50, e.x, e.y, true, false);
          audio.playEggBreak();
          state.eggs.splice(i, 1);
        } else if (dx * dx + dy * dy <= 24 * 24) {
          damagePlayer();
        }
      }
    }
  }

  function updatePhoenixes(dt) {
    const pl = state.player;
    const maxSwoopers = Math.min(3, 1 + Math.floor(state.cycle / 2));
    let swoopingCount = 0;
    for (const ph of state.phoenixes) {
      if (ph.state === 'swooping') swoopingCount++;
    }

    const bulletSpeed = Math.min(440, 290 + (state.cycle - 1) * 26);

    for (let i = state.phoenixes.length - 1; i >= 0; i--) {
      const ph = state.phoenixes[i];
      ph.flapPhase += dt * 7.8;
      if (ph.hitFlash > 0) ph.hitFlash = Math.max(0, ph.hitFlash - dt);

      // Wing regrowth timers
      if (!ph.leftWing) {
        ph.leftRegrow -= dt;
        if (ph.leftRegrow <= 0) {
          ph.leftWing = true;
          ph.leftRegrow = -0.6; // brief golden shimmer
          audio.playWingRegrow();
          spawnBurst(ph.x - 28, ph.y, 8, '#f6c84f', 'spark', 30, 120);
        }
      } else if (ph.leftRegrow < 0) {
        ph.leftRegrow = Math.min(0, ph.leftRegrow + dt);
      }

      if (!ph.rightWing) {
        ph.rightRegrow -= dt;
        if (ph.rightRegrow <= 0) {
          ph.rightWing = true;
          ph.rightRegrow = -0.6;
          audio.playWingRegrow();
          spawnBurst(ph.x + 28, ph.y, 8, '#f6c84f', 'spark', 30, 120);
        }
      } else if (ph.rightRegrow < 0) {
        ph.rightRegrow = Math.min(0, ph.rightRegrow + dt);
      }

      const wings = (ph.leftWing ? 1 : 0) + (ph.rightWing ? 1 : 0);

      if (wings === 0) {
        // Both wings sheared: tumbles downward slowly until a wing regrows!
        ph.state = 'cruising';
        ph.vx *= 0.94;
        ph.vy = 118;
        ph.x += ph.vx * dt;
        ph.y += ph.vy * dt;
        ph.angle += dt * 4.2;
        if (ph.y > ARENA_H - 95) {
          ph.y = ARENA_H - 95;
          ph.vy = -60;
        }
      } else if (wings === 1) {
        // One wing missing: slowed & lists/circles toward missing wing, cannot start swoop
        ph.state = 'cruising';
        const turnDir = ph.leftWing ? 1 : -1;
        const speed = 132;
        const curAng = Math.atan2(ph.vy, ph.vx) + turnDir * 1.45 * dt;
        ph.vx = Math.cos(curAng) * speed;
        ph.vy = Math.sin(curAng) * speed;
        ph.x += ph.vx * dt;
        ph.y += ph.vy * dt;
        ph.angle = turnDir * 0.32;
      } else {
        // Both wings intact: cruise upper sky or swoop down firing at ship
        if (ph.state === 'cruising') {
          ph.retargetTimer -= dt;
          if (ph.retargetTimer <= 0) {
            ph.retargetTimer = 1.3 + Math.random() * 1.4;
            ph.targetX = 96 + Math.random() * (ARENA_W - 192);
            ph.targetY = 105 + Math.random() * 215;
          }
          const dx = ph.targetX - ph.x;
          const dy = ph.targetY - ph.y;
          const dist = Math.hypot(dx, dy) || 1;
          const spd = 165 + (state.cycle - 1) * 18;
          ph.vx += ((dx / dist) * spd - ph.vx) * Math.min(1, dt * 3.0);
          ph.vy += ((dy / dist) * spd - ph.vy) * Math.min(1, dt * 3.0);
          ph.x += ph.vx * dt;
          ph.y += ph.vy * dt;
          ph.angle = Math.max(-0.35, Math.min(0.35, ph.vx * 0.0014));

          ph.swoopTimer -= dt;
          if (ph.swoopTimer <= 0 && swoopingCount < maxSwoopers && pl.alive) {
            swoopingCount++;
            ph.state = 'swooping';
            ph.targetX = Math.max(85, Math.min(ARENA_W - 85, pl.x + (Math.random() - 0.5) * 90));
            ph.targetY = SHIP_Y - 120;
            ph.shotsLeft = 2;
            ph.nextShotTimer = 0.28;
          }
        } else if (ph.state === 'swooping') {
          const dx = ph.targetX - ph.x;
          const dy = ph.targetY - ph.y;
          const dist = Math.hypot(dx, dy) || 1;
          const spd = 295 + (state.cycle - 1) * 24;
          ph.vx += ((dx / dist) * spd - ph.vx) * Math.min(1, dt * 4.5);
          ph.vy += ((dy / dist) * spd - ph.vy) * Math.min(1, dt * 4.5);
          ph.x += ph.vx * dt;
          ph.y += ph.vy * dt;
          ph.angle = Math.max(-0.42, Math.min(0.42, ph.vx * 0.0018));

          ph.nextShotTimer -= dt;
          if (ph.shotsLeft > 0 && ph.nextShotTimer <= 0 && pl.alive) {
            ph.shotsLeft--;
            ph.nextShotTimer = 0.34;
            const sdx = pl.x - ph.x;
            const sdy = pl.y - ph.y;
            const slen = Math.hypot(sdx, sdy) || 1;
            state.enemyShots.push({
              x: ph.x,
              y: ph.y + 18,
              vx: (sdx / slen) * bulletSpeed * 0.72,
              vy: Math.max(bulletSpeed * 0.76, (sdy / slen) * bulletSpeed),
              big: true
            });
          }

          if (dist < 42 || ph.y > SHIP_Y - 110) {
            ph.state = 'cruising';
            ph.targetY = 125 + Math.random() * 140;
            ph.targetX = 110 + Math.random() * (ARENA_W - 220);
            ph.swoopTimer = Math.max(1.8, 3.2 - (state.cycle - 1) * 0.25) + Math.random() * 1.8;
          }
        }
      }

      // Soft arena walls
      if (ph.x < 64) { ph.x = 64; ph.vx = Math.abs(ph.vx); }
      if (ph.x > ARENA_W - 64) { ph.x = ARENA_W - 64; ph.vx = -Math.abs(ph.vx); }
      if (ph.y < 82) { ph.y = 82; ph.vy = Math.abs(ph.vy); }
      if (ph.y > ARENA_H - 95) { ph.y = ARENA_H - 95; ph.vy = -Math.abs(ph.vy); }

      // Player collision
      if (pl.alive) {
        const dx = ph.x - pl.x;
        const dy = ph.y - pl.y;
        if (pl.wardActiveTimer > 0 && dx * dx + dy * dy <= 44 * 44) {
          // Ward bounces the great bird back safely
          ph.vy = -210;
          audio.playWardDeflect();
          spawnBurst((ph.x + pl.x) * 0.5, (ph.y + pl.y) * 0.5, 8, '#f6c952', 'spark', 50, 160);
        } else if (dx * dx + dy * dy <= 28 * 28) {
          damagePlayer();
        }
      }
    }
  }

  function updateBoss(dt) {
    const boss = state.boss;
    if (!boss) return;

    if (boss.coreHitFlash > 0) boss.coreHitFlash = Math.max(0, boss.coreHitFlash - dt);

    if (boss.dying) {
      boss.dyingTimer -= dt;
      boss.explosionTick -= dt;
      if (boss.explosionTick <= 0) {
        boss.explosionTick = 0.14;
        const rx = boss.x + (Math.random() - 0.5) * boss.width * 0.85;
        const ry = boss.y + (Math.random() - 0.5) * 110;
        addShake(7, 0.2);
        spawnRing(rx, ry, 8, 56, '#cf341c', 0.38);
        spawnBurst(rx, ry, 14, '#e5ae3c', 'spark', 60, 240);
        spawnBurst(rx, ry, 8, '#1e3e68', 'shard', 50, 210);
      }
      if (boss.dyingTimer <= 0) {
        state.boss = null;
      }
      return;
    }

    if (boss.entering) {
      boss.y += 110 * dt;
      if (boss.y >= boss.targetStartY) {
        boss.y = boss.targetStartY;
        boss.entering = false;
      }
      return;
    }

    // Sway side to side & descend slowly toward the ship!
    boss.swayPhase += dt * 0.65;
    boss.x = ARENA_W * 0.5 + Math.sin(boss.swayPhase) * boss.swayAmp;
    boss.y = Math.min(boss.maxY, boss.y + boss.descentSpeed * dt);

    // Advance Layer 2 revolving bronze shield conveyor belt
    boss.beltOffset = (boss.beltOffset + boss.beltSpeed * dt) % boss.beltWidth;
    for (let i = 0; i < boss.belt.length; i++) {
      const seg = boss.belt[i];
      if (!seg.alive) {
        seg.regrowTimer -= dt;
        if (seg.regrowTimer <= 0) {
          seg.alive = true;
        }
      }
    }

    // Twin Dragon Lantern Turrets fire aimed ember shots
    const pl = state.player;
    const bulletSpeed = Math.min(430, 275 + (state.cycle - 1) * 24);
    for (const tur of boss.turrets) {
      tur.cooldown -= dt;
      if (tur.cooldown <= 0 && pl.alive) {
        tur.cooldown = Math.max(1.15, 2.05 - (state.cycle - 1) * 0.16) + Math.random() * 0.7;
        const wx = boss.x + tur.x;
        const wy = boss.y + tur.y;
        const dx = pl.x - wx;
        const dy = pl.y - wy;
        const len = Math.hypot(dx, dy) || 1;
        state.enemyShots.push({
          x: wx,
          y: wy + 8,
          vx: (dx / len) * bulletSpeed * 0.72,
          vy: Math.max(bulletSpeed * 0.72, (dy / len) * bulletSpeed),
          big: true
        });
      }
    }

    // Launch small escort birds from left and right alcoves while player attacks the Sun-Ark
    const maxEscorts = Math.min(6, 3 + (state.cycle - 1));
    boss.escortTimer -= dt;
    if (boss.escortTimer <= 0 && state.birds.length < maxEscorts) {
      boss.escortTimer = Math.max(1.8, 3.1 - (state.cycle - 1) * 0.25);
      const side = Math.random() < 0.5 ? -1 : 1;
      const bayX = boss.x + side * (boss.width * 0.5 - 64);
      const bayY = boss.y + 22;
      state.birds.push(Ent.createEscortBird(bayX, bayY, side, state.cycle));
    }

    // Check if the descending Sun-Ark reaches player ship altitude
    if (pl.alive && boss.y + 92 >= pl.y - 18 && Math.abs(pl.x - boss.x) < boss.width * 0.48) {
      damagePlayer();
    }
  }

  function updatePowerups(dt) {
    const pl = state.player;
    for (let i = state.powerups.length - 1; i >= 0; i--) {
      const p = state.powerups[i];
      p.y += p.vy * dt;
      if (p.y > ARENA_H + 30) {
        state.powerups.splice(i, 1);
        continue;
      }
      if (pl.alive) {
        const dx = p.x - pl.x;
        const dy = p.y - pl.y;
        if (dx * dx + dy * dy <= 34 * 34) {
          pl.twinTimer = 11.0;
          addScore(100, p.x, p.y, false, true);
          audio.playPowerup();
          spawnRing(p.x, p.y, 8, 38, '#e9b949', 0.34);
          state.powerups.splice(i, 1);
        }
      }
    }
  }

  function updateParticlesAndPopups(dt) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      pt.vy += pt.gravity * dt;
      if (pt.kind === 'feather') {
        pt.vx *= 0.97;
        pt.x += Math.sin(state.time * 9 + pt.rot) * 26 * dt;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.rot += pt.vrot * dt;
    }

    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pop = state.popups[i];
      pop.life -= dt;
      pop.y -= 34 * dt;
      if (pop.life <= 0) state.popups.splice(i, 1);
    }
  }

  function checkStageClear(dt) {
    const enemiesLeft = state.birds.length + state.eggs.length + state.phoenixes.length + (state.boss ? 1 : 0);
    if (enemiesLeft === 0) {
      if (state.stageClearTimer === 0) {
        // Award stage clear bonus
        const bonus = 500 * state.stageNum;
        addScore(bonus, ARENA_W * 0.5, ARENA_H * 0.44, false, true);
        if (state.stageInCycle !== 4) {
          audio.playStageClear(0);
        }
      }
      state.stageClearTimer += dt;
      if (state.stageClearTimer >= 1.55) {
        setupStage(state.stageNum + 1);
      }
    }
  }

  // --- Main Render ---
  function render() {
    ctx.save();
    ctx.scale(view.dpr, view.dpr);

    const bgStage = state.mode === 'title' ? 0 : state.stageInCycle;
    Art.drawBackdrop(ctx, view.w, view.h, bgStage, state.time, state.scrollBoost, view.arenaRect);

    // Arena coordinate transform + screen shake
    ctx.save();
    let sx = 0;
    let sy = 0;
    if (state.shakeTime > 0 && state.mode === 'playing') {
      sx = (Math.random() - 0.5) * 2 * state.shakeMag;
      sy = (Math.random() - 0.5) * 2 * state.shakeMag;
    }
    ctx.translate(view.offsetX + sx, view.offsetY + sy);
    ctx.scale(view.scale, view.scale);

    if (state.mode === 'title') {
      for (const b of state.titleBirds) {
        if (b.state === 'entering' && b.entryDelay > 0) continue;
        Art.drawSmallBird(ctx, b, state.time);
      }
      Art.drawPlayerShip(ctx, ARENA_W * 0.5, SHIP_Y, 0, false, true, 0, 0, state.time, false);
    } else {
      // Boss behind birds/shots
      if (state.boss) {
        Art.drawSunArk(ctx, state.boss, state.time);
      }

      // Eggs
      for (const e of state.eggs) {
        Art.drawEgg(ctx, e, state.time);
      }

      // Great Solar Phoenixes
      for (const ph of state.phoenixes) {
        Art.drawPhoenix(ctx, ph, state.time);
      }

      // Small birds
      for (const b of state.birds) {
        if (b.state === 'entering' && b.entryDelay > 0) continue;
        Art.drawSmallBird(ctx, b, state.time);
      }

      // Power-ups
      for (const p of state.powerups) {
        Art.drawPowerup(ctx, p, state.time);
      }

      // Player shots
      for (const s of state.playerShots) {
        Art.drawPlayerShot(ctx, s);
      }

      // Enemy shots
      for (const b of state.enemyShots) {
        Art.drawEnemyShot(ctx, b, state.time);
      }

      // Player ship
      const pl = state.player;
      if (pl.alive) {
        const wardActive = pl.wardActiveTimer > 0;
        const wardReady = !wardActive && pl.wardCooldownTimer <= 0;
        const wardPulse = wardActive ? pl.wardActiveTimer / WARD_DURATION : 0;
        Art.drawPlayerShip(ctx, pl.x, pl.y, pl.tilt, wardActive, wardReady, wardPulse, pl.invulnTimer, state.time, pl.twinTimer > 0);
      }

      // Particles & floating score popups
      Art.drawParticles(ctx, state.particles);
      Art.drawPopups(ctx, state.popups);
    }

    ctx.restore();
    ctx.restore();
  }

  // --- Frame Loop ---
  let lastTs = 0;
  function frame(ts) {
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
    lastTs = ts;

    if (state.mode === 'title') {
      state.time += dt;
      updateTitleFlock(dt);
    } else if (state.mode === 'playing') {
      updateGame(dt);
    }

    render();
    requestAnimationFrame(frame);
  }

  // --- Keyboard, Mouse & Touch Controls ---
  function onKeyDown(e) {
    const code = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code)) {
      e.preventDefault();
    }

    if (code === 'KeyM') {
      audio.init();
      audio.toggleMute();
      syncMuteButtons();
      return;
    }

    if (code === 'KeyP' || code === 'Escape') {
      if (state.mode === 'playing' || state.mode === 'paused') {
        togglePause();
      }
      return;
    }

    if (state.mode === 'title' && (code === 'Enter' || code === 'Space')) {
      startGame(1);
      return;
    }

    if (state.mode === 'gameover' && (code === 'Enter' || code === 'Space')) {
      startGame(1);
      return;
    }

    if (code === 'ArrowLeft' || code === 'KeyA') input.left = true;
    if (code === 'ArrowRight' || code === 'KeyD') input.right = true;
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ') {
      input.fire = true;
    }
    if (code === 'ArrowDown' || code === 'KeyS' || code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyX') {
      if (state.mode === 'playing') input.wardQueued = true;
    }
  }

  function onKeyUp(e) {
    const code = e.code;
    if (code === 'ArrowLeft' || code === 'KeyA') input.left = false;
    if (code === 'ArrowRight' || code === 'KeyD') input.right = false;
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ') {
      input.fire = false;
    }
  }

  // Touch device detection & dedicated on-screen touch pads
  function enableTouchUI() {
    if (!document.body.classList.contains('touch-active')) {
      document.body.classList.add('touch-active');
      resize();
    }
  }

  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    enableTouchUI();
  }
  window.addEventListener('touchstart', enableTouchUI, { passive: true, once: true });

  function bindTouchButton(id, onPress, onRelease) {
    const el = document.getElementById(id);
    if (!el) return;
    const press = (e) => {
      e.preventDefault();
      audio.init();
      el.classList.add('pressed');
      onPress();
    };
    const release = (e) => {
      e.preventDefault();
      el.classList.remove('pressed');
      if (onRelease) onRelease();
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  }

  bindTouchButton('touch-left', () => { input.left = true; }, () => { input.left = false; });
  bindTouchButton('touch-right', () => { input.right = true; }, () => { input.right = false; });
  bindTouchButton('touch-fire', () => { input.fire = true; }, () => { input.fire = false; });
  bindTouchButton('touch-ward', () => { input.wardQueued = true; }, null);

  // Optional direct drag on canvas for mouse/touch play
  canvas.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'playing') return;
    audio.init();
    if (e.button === 2) {
      input.wardQueued = true;
      return;
    }
    input.pointerActive = true;
    input.pointerArenaX = screenToArenaX(e.clientX);
    input.fire = true;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!input.pointerActive || state.mode !== 'playing') return;
    input.pointerArenaX = screenToArenaX(e.clientX);
  });

  function stopPointer() {
    if (input.pointerActive) {
      input.pointerActive = false;
      input.fire = false;
    }
  }
  window.addEventListener('pointerup', stopPointer);
  window.addEventListener('pointercancel', stopPointer);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Buttons
  btnStart.addEventListener('click', () => startGame(1));
  btnRestart.addEventListener('click', () => startGame(1));
  btnResume.addEventListener('click', () => togglePause(false));
  btnPauseRestart.addEventListener('click', () => startGame(1));
  btnPauseTitle.addEventListener('click', returnToTitle);
  btnGoTitle.addEventListener('click', returnToTitle);
  btnPause.addEventListener('click', () => togglePause());

  const handleMuteClick = () => {
    audio.init();
    audio.toggleMute();
    syncMuteButtons();
  };
  btnMute.addEventListener('click', handleMuteClick);
  btnTitleMute.addEventListener('click', handleMuteClick);

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', resize);

  // Auto-pause when tab loses visibility or window blurs
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') togglePause(true);
  });
  window.addEventListener('blur', () => {
    input.left = false;
    input.right = false;
    input.fire = false;
    input.pointerActive = false;
    if (state.mode === 'playing') togglePause(true);
  });

  // Initialize
  resize();
  syncMuteButtons();
  titleBestEl.textContent = fmtScore(state.best);
  state.titleBirds = Ent.createFlock('flock1', 1);

  // Query param ?stage=N for direct stage inspection (does not affect best score)
  const params = new URLSearchParams(window.location.search);
  const queryStage = parseInt(params.get('stage') || '', 10);
  if (Number.isFinite(queryStage) && queryStage >= 1 && queryStage <= 20) {
    startGame(queryStage);
  }

  // Inspection hook for automated verification
  global.__suncrest = {
    version: VERSION,
    start: (stageNum) => startGame(stageNum || 1),
    togglePause,
    activateWard,
    damageBossCore,
    hatchAllEggs: () => {
      for (const e of state.eggs) e.hatchTimer = 0.01;
    },
    setPlayerX: (x) => {
      state.player.x = Math.max(42, Math.min(ARENA_W - 42, x));
    },
    setScore: (n) => {
      state.score = n;
      updateHud();
    },
    getState: () => ({
      mode: state.mode,
      score: state.score,
      best: state.best,
      lives: state.lives,
      stageNum: state.stageNum,
      cycle: state.cycle,
      stageInCycle: state.stageInCycle,
      player: { ...state.player },
      birdCount: state.birds.length,
      eggCount: state.eggs.length,
      phoenixCount: state.phoenixes.length,
      phoenixes: state.phoenixes.map((p) => ({
        x: p.x, y: p.y, leftWing: p.leftWing, rightWing: p.rightWing,
        leftRegrow: p.leftRegrow, rightRegrow: p.rightRegrow
      })),
      boss: state.boss ? {
        x: state.boss.x,
        y: state.boss.y,
        entering: state.boss.entering,
        dying: state.boss.dying,
        coreHp: state.boss.coreHp,
        coreMaxHp: state.boss.coreMaxHp,
        tilesAlive: state.boss.tiles.filter((t) => t.alive).length,
        tilesTotal: state.boss.tiles.length,
        beltAlive: state.boss.belt.filter((s) => s.alive).length,
        beltTotal: state.boss.belt.length
      } : null,
      playerShots: state.playerShots.length,
      enemyShots: state.enemyShots.length,
      muted: audio.muted
    }),
    rawState: state
  };

  requestAnimationFrame(frame);
})(window);
