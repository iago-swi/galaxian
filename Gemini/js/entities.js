/* Suncrest — Formations, Small Birds, Kintsugi Eggs, Great Phoenixes & The Sun-Ark Boss */
(function (global) {
  'use strict';

  const ARENA_W = 820;
  const ARENA_H = 760;

  // Classic 5-stage Phoenix cycle definitions
  const STAGE_TYPES = ['flock1', 'flock2', 'brood1', 'brood2', 'boss'];

  // Formation templates: K = Vermilion Kite, J = Jade Kingfisher, S = Azure Swift
  const FORMATIONS_FLOCK1 = [
    [
      '....K.K.K.K....',
      '..J.J.J.J.J.J..',
      '.S.S.S.S.S.S.S.',
      '...S.S.S.S.S...'
    ],
    [
      '...K..K.K..K...',
      '.J.J..J.J..J.J.',
      'S.S.S.S.S.S.S.S',
      '..S.S.....S.S..'
    ]
  ];

  const FORMATIONS_FLOCK2 = [
    [
      'K.K...K.K...K.K',
      '.J.J.J.J.J.J.J.',
      '..S.S.S.S.S.S..',
      '.S.S.S...S.S.S.'
    ],
    [
      '..K.K.K.K.K.K..',
      'J.J.J.....J.J.J',
      '.S.S.S.S.S.S.S.',
      '...S.S.S.S.S...'
    ]
  ];

  const BIRD_SPECS = {
    swift: {
      points: 40,
      diveSpeed: 235,
      weaveAmp: 54,
      weaveFreq: 5.2,
      shots: 1,
      hitR: 15,
      flapSpeed: 14,
      featherColor: '#1e4d82'
    },
    kingfisher: {
      points: 60,
      diveSpeed: 285,
      weaveAmp: 34,
      weaveFreq: 4.1,
      shots: 1,
      hitR: 16,
      flapSpeed: 12,
      featherColor: '#1e7a61'
    },
    kite: {
      points: 90,
      diveSpeed: 335,
      weaveAmp: 20,
      weaveFreq: 3.4,
      shots: 2,
      hitR: 17,
      flapSpeed: 10.5,
      featherColor: '#cf341c'
    }
  };

  function createFlock(stageType, cycle) {
    const pool = stageType === 'flock1' ? FORMATIONS_FLOCK1 : FORMATIONS_FLOCK2;
    const grid = pool[(cycle - 1) % pool.length];
    const birds = [];
    const cols = grid[0].length;
    const spacingX = 44;
    const spacingY = 48;
    const startX = (ARENA_W - (cols - 1) * spacingX) * 0.5;
    const startY = 122;

    let idx = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = grid[r][c];
        if (ch === '.') continue;
        const type = ch === 'K' ? 'kite' : (ch === 'J' ? 'kingfisher' : 'swift');
        const spec = BIRD_SPECS[type];
        const homeX = startX + c * spacingX;
        const homeY = startY + r * spacingY;
        const fromLeft = idx % 2 === 0;
        const entryX = fromLeft ? -45 : ARENA_W + 45;
        const entryY = 70 + (r * 55) + (idx % 3) * 28;
        birds.push({
          id: idx + 1,
          type,
          spec,
          x: entryX,
          y: entryY,
          vx: 0,
          vy: 0,
          angle: 0,
          homeX,
          homeY,
          row: r,
          col: c,
          state: 'entering', // 'entering' | 'formation' | 'diving' | 'returning'
          entryDelay: idx * 0.065,
          entryT: 0,
          entryP0: { x: entryX, y: entryY },
          entryP1: { x: fromLeft ? ARENA_W * 0.28 : ARENA_W * 0.72, y: 310 + r * 20 },
          entryP2: { x: homeX + (fromLeft ? -60 : 60), y: homeY - 60 },
          flapPhase: Math.random() * Math.PI * 2,
          diveTime: 0,
          diveDir: 1,
          shotsLeft: spec.shots,
          nextShotTime: 0.45,
          isEscort: false
        });
        idx++;
      }
    }
    return birds;
  }

  function createEscortBird(x, y, side, cycle) {
    const type = Math.random() < 0.42 ? 'kingfisher' : 'swift';
    const spec = BIRD_SPECS[type];
    const homeX = Math.max(90, Math.min(ARENA_W - 90, x + side * (25 + Math.random() * 40)));
    const homeY = Math.min(410, y + 65 + Math.random() * 45);
    return {
      id: Math.random(),
      type,
      spec,
      x,
      y,
      vx: side * 90,
      vy: 60,
      angle: 0,
      homeX,
      homeY,
      row: 0,
      col: 0,
      state: 'diving',
      entryDelay: 0,
      entryT: 1,
      flapPhase: Math.random() * Math.PI * 2,
      diveTime: 0.1,
      diveDir: side,
      shotsLeft: 1 + (cycle >= 3 ? 1 : 0),
      nextShotTime: 0.55 + Math.random() * 0.45,
      isEscort: true
    };
  }

  function createEggs(stageType, cycle) {
    const baseCount = stageType === 'brood1' ? 6 : 8;
    const count = Math.min(14, baseCount + (cycle - 1) * 2);
    const eggs = [];
    for (let i = 0; i < count; i++) {
      const lane = i % 4;
      const baseY = 128 + lane * 66 + (Math.random() * 14 - 7);
      const fromLeft = i % 2 === 0;
      eggs.push({
        id: i + 1,
        x: fromLeft ? 70 + (i * 42) % 240 : ARENA_W - 70 - (i * 42) % 240,
        y: baseY,
        baseY,
        vx: (fromLeft ? 1 : -1) * (125 + Math.random() * 48 + (cycle - 1) * 18),
        bobAmp: 22 + Math.random() * 14,
        bobFreq: 2.2 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2,
        hatchTimer: 3.4 + i * 0.85 + Math.random() * 0.7,
        radius: 17
      });
    }
    return eggs;
  }

  function createPhoenixFromEgg(egg, cycle) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    return {
      id: Math.random(),
      x: egg.x,
      y: egg.y,
      vx: dir * (110 + (cycle - 1) * 14),
      vy: -20,
      angle: 0,
      phase: Math.random() * Math.PI * 2,
      flapPhase: Math.random() * Math.PI * 2,
      leftWing: true,
      rightWing: true,
      leftRegrow: 0,  // >0 while regrowing; briefly negative after regrown for shimmer
      rightRegrow: 0,
      hitFlash: 0,
      state: 'cruising', // 'cruising' | 'swooping' | 'recovering'
      targetX: 110 + Math.random() * (ARENA_W - 220),
      targetY: 115 + Math.random() * 210,
      retargetTimer: 1.2 + Math.random() * 1.2,
      swoopTimer: 2.2 + Math.random() * 2.4,
      shotsLeft: 0,
      nextShotTimer: 0.4,
      bodyR: 16
    };
  }

  function createSunArk(cycle) {
    const width = 670;
    const beltWidth = 448;
    const beltSegCount = 16;
    const beltSegW = beltWidth / beltSegCount;
    const beltY = 36;

    // Layer 2: Revolving horizontal bronze shield belt
    const belt = [];
    for (let i = 0; i < beltSegCount; i++) {
      belt.push({
        alive: true,
        regrowTimer: 0
      });
    }

    // Layer 1: Outer Bulwark — 3 rows x 14 columns of destructible lacquer armour tiles
    const tiles = [];
    const cols = 14;
    const rows = 3;
    const tileW = 36;
    const tileH = 15;
    const totalTileW = cols * tileW;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Gentle curved pagoda underside profile: outer corners slightly tucked
        const distCenter = Math.abs(c - (cols - 1) * 0.5);
        if (r === 2 && distCenter > 5.2) continue;
        tiles.push({
          row: r,
          col: c,
          x: -totalTileW * 0.5 + (c + 0.5) * tileW,
          y: beltY + 21 + r * (tileH + 2),
          w: tileW,
          h: tileH,
          alive: true
        });
      }
    }

    const coreMaxHp = 10 + (cycle - 1) * 4;
    return {
      x: ARENA_W * 0.5,
      y: -155,
      targetStartY: 224,
      entering: true,
      width,
      swayPhase: 0,
      swayAmp: 58,
      descentSpeed: 5.5 + (cycle - 1) * 1.35,
      maxY: 475,
      coreHp: coreMaxHp,
      coreMaxHp,
      coreHitFlash: 0,
      coreY: -12,
      coreR: 25,
      beltWidth,
      beltSegW,
      beltY,
      beltOffset: 0,
      beltSpeed: 74 + (cycle - 1) * 15,
      belt,
      tiles,
      turrets: [
        { x: -214, y: 24, cooldown: 1.4 },
        { x: 214, y: 24, cooldown: 2.1 }
      ],
      escortTimer: 2.6,
      dying: false,
      dyingTimer: 0,
      explosionTick: 0
    };
  }

  // Swept point-to-SunArk layer collision (bottom-to-top: Armor Tiles -> Revolving Shield Belt -> Core/Hull)
  // Returns { hit: false } or { hit: true, kind: 'tile'|'belt'|'core'|'hull', x, y, target }
  function testShotAgainstSunArk(boss, prevX, prevY, currX, currY) {
    if (boss.dying || boss.entering) return { hit: false };

    // Sample up to 4 substeps along vertical segment so fast shots never tunnel through 15px tiles
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      const f = s / steps;
      const wx = prevX + (currX - prevX) * f;
      const wy = prevY + (currY - prevY) * f;
      const lx = wx - boss.x;
      const ly = wy - boss.y;

      // Bounding box early out
      if (Math.abs(lx) > boss.width * 0.5 + 8 || ly < -115 || ly > 110) continue;

      // 1. Layer 1: Outer lacquer armour tiles (check bottom rows first)
      for (let i = boss.tiles.length - 1; i >= 0; i--) {
        const t = boss.tiles[i];
        if (!t.alive) continue;
        if (Math.abs(lx - t.x) <= t.w * 0.5 + 3 && Math.abs(ly - t.y) <= t.h * 0.5 + 4) {
          return { hit: true, kind: 'tile', x: boss.x + t.x, y: boss.y + t.y, target: t };
        }
      }

      // 2. Layer 2: Revolving horizontal bronze shield conveyor belt
      if (Math.abs(lx) <= boss.beltWidth * 0.5 && Math.abs(ly - boss.beltY) <= 10) {
        const halfBelt = boss.beltWidth * 0.5;
        const posInBelt = lx + halfBelt;
        const shifted = ((posInBelt - boss.beltOffset) % boss.beltWidth + boss.beltWidth) % boss.beltWidth;
        const segIdx = Math.floor(shifted / boss.beltSegW) % boss.belt.length;
        const seg = boss.belt[segIdx];
        if (seg && seg.alive) {
          return { hit: true, kind: 'belt', x: wx, y: boss.y + boss.beltY, target: seg };
        }
      }

      // 3. Vulnerable Solar Sovereign Core (recessed inside the sanctum above the belt)
      const dxC = lx;
      const dyC = ly - boss.coreY;
      if (dxC * dxC + dyC * dyC <= (boss.coreR + 4) * (boss.coreR + 4)) {
        return { hit: true, kind: 'core', x: boss.x, y: boss.y + boss.coreY, target: boss };
      }

      // 4. Indestructible outer hull underside (blocks shots outside the central sanctum opening)
      if (ly <= 26 && Math.abs(lx) > 48 && Math.abs(lx) <= boss.width * 0.5 - 10) {
        return { hit: true, kind: 'hull', x: wx, y: wy, target: null };
      }
      // Top ceiling of sanctum
      if (ly <= -42 && Math.abs(lx) <= 52) {
        return { hit: true, kind: 'hull', x: wx, y: wy, target: null };
      }
    }

    return { hit: false };
  }

  global.SuncrestEntities = {
    ARENA_W,
    ARENA_H,
    STAGE_TYPES,
    BIRD_SPECS,
    createFlock,
    createEscortBird,
    createEggs,
    createPhoenixFromEgg,
    createSunArk,
    testShotAgainstSunArk
  };
})(window);
