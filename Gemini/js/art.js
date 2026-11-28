/* Suncrest — Procedural Ukiyo-e / Rinpa Woodblock & Gold-Leaf Art Engine */
(function (global) {
  'use strict';

  const INK = '#1b1615';
  const CREAM = '#faf1dc';

  // Five distinct sunlit woodblock palettes, one per stage in each cycle.
  const STAGE_PALETTES = [
    {
      name: 'Dawn Flock',
      sub: 'Swifts, kingfishers and kites descend across morning paper',
      skyTop: '#f5ead3',
      skyMid: '#efe0be',
      skyLow: '#e5c596',
      sunCore: '#d83a20',
      sunRing: '#ef7e44',
      sunY: 0.34,
      sunR: 112,
      cloudFill: 'rgba(249, 241, 220, 0.72)',
      cloudGold: 'rgba(209, 152, 52, 0.34)',
      mountainFar: '#96a8b2',
      mountainNear: '#587185',
      waveBack: '#264d7c',
      waveFront: '#1a385e',
      foam: '#f7eed9'
    },
    {
      name: 'Gale Flock',
      sub: 'A wider wing rides the gold-leaf wind',
      skyTop: '#f3e3b4',
      skyMid: '#ebd08e',
      skyLow: '#dfaa5e',
      sunCore: '#cf311a',
      sunRing: '#f4b44a',
      sunY: 0.28,
      sunR: 100,
      cloudFill: 'rgba(252, 245, 224, 0.68)',
      cloudGold: 'rgba(202, 134, 24, 0.42)',
      mountainFar: '#9e8f77',
      mountainNear: '#625e64',
      waveBack: '#244b75',
      waveFront: '#173254',
      foam: '#fbf3de'
    },
    {
      name: 'Porcelain Brood',
      sub: 'Crack the kintsugi eggs before the Great Phoenixes hatch',
      skyTop: '#eef1e1',
      skyMid: '#dce5d0',
      skyLow: '#e6c8a8',
      sunCore: '#d94528',
      sunRing: '#f29a62',
      sunY: 0.36,
      sunR: 118,
      cloudFill: 'rgba(250, 248, 236, 0.76)',
      cloudGold: 'rgba(187, 148, 62, 0.32)',
      mountainFar: '#7d9b94',
      mountainNear: '#3d6b66',
      waveBack: '#1f5761',
      waveFront: '#163f4a',
      foam: '#f5f2e4'
    },
    {
      name: 'Crimson Brood',
      sub: 'Twin broods weave across the persimmon scroll',
      skyTop: '#f5dec2',
      skyMid: '#ebc092',
      skyLow: '#de8e5d',
      sunCore: '#be2614',
      sunRing: '#ee7b38',
      sunY: 0.39,
      sunR: 126,
      cloudFill: 'rgba(252, 239, 218, 0.66)',
      cloudGold: 'rgba(196, 114, 34, 0.42)',
      mountainFar: '#8a6b6e',
      mountainNear: '#4d4152',
      waveBack: '#283d66',
      waveFront: '#182745',
      foam: '#faebd4'
    },
    {
      name: 'The Sun-Ark',
      sub: 'Breach the lacquer armour and revolving bronze shields',
      skyTop: '#efd8a4',
      skyMid: '#e2b56c',
      skyLow: '#d47c4a',
      sunCore: '#b92212',
      sunRing: '#f3c151',
      sunY: 0.25,
      sunR: 146,
      cloudFill: 'rgba(249, 234, 196, 0.56)',
      cloudGold: 'rgba(205, 134, 24, 0.48)',
      mountainFar: '#7b554c',
      mountainNear: '#412e34',
      waveBack: '#1f365c',
      waveFront: '#132440',
      foam: '#f8ebd0'
    }
  ];

  // Cached procedural washi paper texture pattern
  let paperPattern = null;

  function ensurePaperPattern(ctx) {
    if (paperPattern) return paperPattern;
    const tile = document.createElement('canvas');
    tile.width = 160;
    tile.height = 160;
    const tctx = tile.getContext('2d');

    // Deterministic pseudo-random washi fibers & warm specks
    let seed = 198012;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    tctx.clearRect(0, 0, 160, 160);
    for (let i = 0; i < 420; i++) {
      const x = rand() * 160;
      const y = rand() * 160;
      const r = 0.5 + rand() * 1.1;
      tctx.fillStyle = rand() > 0.5
        ? 'rgba(110, 82, 46, 0.045)'
        : 'rgba(255, 250, 236, 0.065)';
      tctx.fillRect(x, y, r, r);
    }

    // Subtle organic paper fibers
    tctx.lineWidth = 0.7;
    for (let i = 0; i < 48; i++) {
      const x = rand() * 160;
      const y = rand() * 160;
      const len = 6 + rand() * 18;
      const ang = rand() * Math.PI * 2;
      tctx.strokeStyle = rand() > 0.45
        ? 'rgba(122, 92, 54, 0.05)'
        : 'rgba(255, 252, 242, 0.07)';
      tctx.beginPath();
      tctx.moveTo(x, y);
      tctx.quadraticCurveTo(
        x + Math.cos(ang + 0.3) * len * 0.5,
        y + Math.sin(ang + 0.3) * len * 0.5,
        x + Math.cos(ang) * len,
        y + Math.sin(ang) * len
      );
      tctx.stroke();
    }

    paperPattern = ctx.createPattern(tile, 'repeat');
    return paperPattern;
  }

  function lerpColor(hexA, hexB, t) {
    const a = parseInt(hexA.slice(1), 16);
    const b = parseInt(hexB.slice(1), 16);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bl})`;
  }

  // Full-bleed woodblock backdrop: sky wash, vermilion sun, Rinpa clouds, Fuji-style ridges & Hokusai waves
  function drawBackdrop(ctx, w, h, stageIdx, time, scrollBoost, arenaRect) {
    const p = STAGE_PALETTES[stageIdx % STAGE_PALETTES.length];
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, p.skyTop);
    grad.addColorStop(0.56, p.skyMid);
    grad.addColorStop(1, p.skyLow);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle vertical woodblock sunbeams on boss stage
    const sunX = w * 0.5;
    const sunY = h * p.sunY;
    const sunScale = Math.min(w, h) / 800;
    const sunR = p.sunR * Math.max(0.75, sunScale);

    if (stageIdx % 5 === 4) {
      ctx.save();
      ctx.translate(sunX, sunY);
      ctx.rotate(time * 0.04);
      const rays = 16;
      ctx.fillStyle = 'rgba(243, 193, 81, 0.16)';
      for (let i = 0; i < rays; i++) {
        const a0 = (i / rays) * Math.PI * 2;
        const a1 = a0 + Math.PI / rays * 0.45;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, Math.max(w, h), a0, a1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Outer gold-leaf halo around the sun
    const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.75, sunX, sunY, sunR * 2.25);
    halo.addColorStop(0, 'rgba(244, 185, 76, 0.34)');
    halo.addColorStop(0.55, 'rgba(244, 185, 76, 0.10)');
    halo.addColorStop(1, 'rgba(244, 185, 76, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 2.25, 0, Math.PI * 2);
    ctx.fill();

    // Vermilion sun disc with delicate ink & gold ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    const sunGrad = ctx.createRadialGradient(sunX - sunR * 0.18, sunY - sunR * 0.22, sunR * 0.1, sunX, sunY, sunR);
    sunGrad.addColorStop(0, p.sunRing);
    sunGrad.addColorStop(0.45, p.sunCore);
    sunGrad.addColorStop(1, p.sunCore);
    ctx.fillStyle = sunGrad;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(27, 22, 21, 0.22)';
    ctx.stroke();

    // Thin decorative concentric gold ring
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.12, 0, Math.PI * 2);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(200, 138, 30, 0.35)';
    ctx.stroke();
    ctx.restore();

    // Stylized Rinpa horizontal cloud bands drifting slowly
    drawRinpaCloudBand(ctx, w, h * 0.18, time * (10 + scrollBoost * 28), 1.0, p.cloudGold, p.cloudFill);
    drawRinpaCloudBand(ctx, w, h * 0.48, -time * (7 + scrollBoost * 20) + 210, 0.85, p.cloudFill, p.cloudGold);
    drawRinpaCloudBand(ctx, w, h * 0.67, time * (5 + scrollBoost * 16) + 95, 0.72, p.cloudGold, p.cloudFill);

    // Distant volcanic ridge & temple silhouette
    const horizonY = h * 0.84;
    ctx.save();
    ctx.fillStyle = p.mountainFar;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, horizonY - 24);
    ctx.quadraticCurveTo(w * 0.16, horizonY - 68, w * 0.31, horizonY - 22);
    ctx.quadraticCurveTo(w * 0.50, horizonY - 115, w * 0.69, horizonY - 18);
    ctx.quadraticCurveTo(w * 0.85, horizonY - 56, w, horizonY - 20);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Snow-capped peak accent on center mountain
    ctx.fillStyle = 'rgba(250, 243, 226, 0.65)';
    ctx.beginPath();
    ctx.moveTo(w * 0.455, horizonY - 61);
    ctx.quadraticCurveTo(w * 0.50, horizonY - 96, w * 0.545, horizonY - 60);
    ctx.lineTo(w * 0.528, horizonY - 50);
    ctx.lineTo(w * 0.512, horizonY - 57);
    ctx.lineTo(w * 0.496, horizonY - 48);
    ctx.lineTo(w * 0.48, horizonY - 56);
    ctx.closePath();
    ctx.fill();

    // Nearer misty coastal ridge
    ctx.fillStyle = p.mountainNear;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, horizonY + 8);
    ctx.quadraticCurveTo(w * 0.22, horizonY - 26, w * 0.44, horizonY + 14);
    ctx.quadraticCurveTo(w * 0.74, horizonY - 30, w, horizonY + 6);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Subtle torii gate silhouette on far left promontory
    const tx = w * 0.13;
    const ty = horizonY - 9;
    ctx.fillStyle = 'rgba(165, 36, 16, 0.65)';
    ctx.fillRect(tx - 10, ty - 18, 2.5, 19);
    ctx.fillRect(tx + 7.5, ty - 18, 2.5, 19);
    ctx.fillRect(tx - 15, ty - 19, 30, 3);
    ctx.fillRect(tx - 12, ty - 13, 24, 2);
    ctx.restore();

    // Stylized Hokusai-inspired woodblock waves along the bottom
    drawWoodblockWaves(ctx, w, h, h * 0.895, time * 1.15, p.waveBack, p.foam, 14, 0.55);
    drawWoodblockWaves(ctx, w, h, h * 0.945, -time * 1.55 + 1.4, p.waveFront, p.foam, 18, 0.88);

    // Subtle scroll margin ink framing around the logical playfield when wide
    if (arenaRect && w - arenaRect.w > 70) {
      ctx.save();
      ctx.strokeStyle = 'rgba(27, 22, 21, 0.16)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(arenaRect.x - 10, 16);
      ctx.lineTo(arenaRect.x - 10, h - 16);
      ctx.moveTo(arenaRect.x + arenaRect.w + 10, 16);
      ctx.lineTo(arenaRect.x + arenaRect.w + 10, h - 16);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(200, 138, 30, 0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(arenaRect.x - 15, 22);
      ctx.lineTo(arenaRect.x - 15, h - 22);
      ctx.moveTo(arenaRect.x + arenaRect.w + 15, 22);
      ctx.lineTo(arenaRect.x + arenaRect.w + 15, h - 22);
      ctx.stroke();
      ctx.restore();
    }

    // Composite tactile washi paper grain over the background
    const pat = ensurePaperPattern(ctx);
    if (pat) {
      ctx.save();
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function drawRinpaCloudBand(ctx, w, baseY, offset, scale, fillMain, fillAccent) {
    ctx.save();
    const span = 520 * scale;
    const start = ((offset % span) + span) % span - span;
    for (let x = start; x < w + span; x += span) {
      const y = baseY + Math.sin(x * 0.004) * 10;
      ctx.fillStyle = fillMain;
      ctx.beginPath();
      ctx.roundRect(x, y, 220 * scale, 18 * scale, 9 * scale);
      ctx.roundRect(x + 90 * scale, y - 10 * scale, 175 * scale, 16 * scale, 8 * scale);
      ctx.roundRect(x + 210 * scale, y + 4 * scale, 140 * scale, 13 * scale, 6.5 * scale);
      ctx.fill();

      ctx.fillStyle = fillAccent;
      ctx.beginPath();
      ctx.roundRect(x + 18 * scale, y + 6 * scale, 148 * scale, 6 * scale, 3 * scale);
      ctx.roundRect(x + 125 * scale, y - 4 * scale, 110 * scale, 5 * scale, 2.5 * scale);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWoodblockWaves(ctx, w, h, baseY, phase, fillColor, foamColor, amp, foamAlpha) {
    ctx.save();
    const step = 96;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, baseY);
    for (let x = 0; x <= w + step; x += step) {
      const wave = Math.sin(x * 0.015 + phase) * amp;
      const crest = Math.cos(x * 0.03 - phase * 0.8) * (amp * 0.35);
      ctx.quadraticCurveTo(x + step * 0.4, baseY + wave - amp * 0.85, x + step, baseY + crest);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Foam rim & sumi contour
    ctx.strokeStyle = foamColor;
    ctx.globalAlpha = foamAlpha;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let x = 0; x <= w + step; x += step) {
      const wave = Math.sin(x * 0.015 + phase) * amp;
      const crest = Math.cos(x * 0.03 - phase * 0.8) * (amp * 0.35);
      ctx.quadraticCurveTo(x + step * 0.4, baseY + wave - amp * 0.85, x + step, baseY + crest);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(27, 22, 21, 0.38)';
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
  }

  // Player's Crimson Origami-Crane Skiff
  function drawPlayerShip(ctx, x, y, tilt, wardActive, wardReady, wardPulse, invulnTimer, time, twinActive) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt * 0.14);

    // Respawn flicker
    if (invulnTimer > 0 && Math.floor(invulnTimer * 18) % 2 === 0) {
      ctx.globalAlpha = 0.48;
    }

    // Subtle ready-aura behind the ship when Solar Ward is charged
    if (wardReady && !wardActive) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 4.5);
      ctx.save();
      ctx.strokeStyle = `rgba(214, 148, 30, ${0.26 + pulse * 0.28})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(0, 2, 26 + pulse * 2.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Calligraphy exhaust plume
    const flameH = 11 + Math.sin(time * 42) * 4;
    ctx.fillStyle = '#e89d28';
    ctx.beginPath();
    ctx.moveTo(-6, 15);
    ctx.lineTo(0, 17 + flameH);
    ctx.lineTo(6, 15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff8df';
    ctx.beginPath();
    ctx.moveTo(-3, 15);
    ctx.lineTo(0, 15 + flameH * 0.6);
    ctx.lineTo(3, 15);
    ctx.closePath();
    ctx.fill();

    // Swept paper-lacquer wings
    ctx.fillStyle = CREAM;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(9, -4);
    ctx.lineTo(24, 11);
    ctx.lineTo(20, 16);
    ctx.lineTo(7, 11);
    ctx.lineTo(5, 17);
    ctx.lineTo(0, 13);
    ctx.lineTo(-5, 17);
    ctx.lineTo(-7, 11);
    ctx.lineTo(-20, 16);
    ctx.lineTo(-24, 11);
    ctx.lineTo(-9, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vermilion lacquer wing panels
    ctx.fillStyle = '#cf341c';
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(-19, 11);
    ctx.lineTo(-16, 13);
    ctx.lineTo(-5, 8);
    ctx.closePath();
    ctx.moveTo(6, -2);
    ctx.lineTo(19, 11);
    ctx.lineTo(16, 13);
    ctx.lineTo(5, 8);
    ctx.closePath();
    ctx.fill();

    // Prussian-blue twin nose cannons when Twin Lance is active
    if (twinActive) {
      ctx.fillStyle = '#1b4070';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.fillRect(-13, -10, 4, 12);
      ctx.strokeRect(-13, -10, 4, 12);
      ctx.fillRect(9, -10, 4, 12);
      ctx.strokeRect(9, -10, 4, 12);
    }

    // Center gold spine & solar jewel
    ctx.fillStyle = '#d69926';
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(4.2, -3);
    ctx.lineTo(0, 10);
    ctx.lineTo(-4.2, -3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Solar Ward jewel on canopy
    ctx.fillStyle = wardActive ? '#fff8d4' : (wardReady ? '#f5c247' : '#3a5473');
    ctx.beginPath();
    ctx.arc(0, -3, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Active Solar Ward Mandala Barrier
    if (wardActive) {
      const r = 34 + Math.sin(time * 24) * 1.6;
      const g = ctx.createRadialGradient(0, 0, r * 0.25, 0, 0, r);
      g.addColorStop(0, 'rgba(255, 245, 200, 0.14)');
      g.addColorStop(0.72, 'rgba(242, 184, 58, 0.34)');
      g.addColorStop(1, 'rgba(207, 52, 28, 0.58)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Rotating sacred mandala ring
      ctx.save();
      ctx.rotate(time * 2.8);
      ctx.strokeStyle = '#cf341c';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#fff5cf';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
      ctx.stroke();

      // 8 geometric sun petals around the rim
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = i % 2 === 0 ? '#f6c952' : '#cf341c';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(r - 7, 0);
        ctx.lineTo(r - 1, -3.5);
        ctx.lineTo(r + 4, 0);
        ctx.lineTo(r - 1, 3.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // Remaining ward timer arc
      if (wardPulse > 0) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * wardPulse);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // Woodblock Small Birds: 'swift' (Prussian blue), 'kingfisher' (Jade), 'kite' (Vermilion)
  function drawSmallBird(ctx, bird, time) {
    const flap = Math.sin(bird.flapPhase);
    const wingLift = flap * 10;
    const wingSpan = bird.type === 'kite' ? 23 : (bird.type === 'kingfisher' ? 21 : 19);

    let mainColor = '#1e4d82';
    let accentColor = '#f5ebd3';
    let tipColor = '#142947';
    if (bird.type === 'kingfisher') {
      mainColor = '#1e7a61';
      accentColor = '#e6b23e';
      tipColor = '#144438';
    } else if (bird.type === 'kite') {
      mainColor = '#cf341c';
      accentColor = '#f2be49';
      tipColor = '#281816';
    }

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.angle);

    // Subtle ivory paper cutout rim so birds stay ultra-legible over any cloud or sun
    ctx.shadowColor = 'rgba(252, 245, 224, 0.65)';
    ctx.shadowBlur = 4;

    // Wings (symmetrical woodblock curves)
    ctx.fillStyle = mainColor;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.9;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    // Left wing
    ctx.moveTo(-4, -2);
    ctx.quadraticCurveTo(-wingSpan * 0.55, -10 + wingLift * 0.5, -wingSpan, -4 + wingLift);
    ctx.quadraticCurveTo(-wingSpan * 0.62, 6 + wingLift * 0.6, -5, 5);
    // Tail
    if (bird.type === 'swift') {
      ctx.lineTo(-7, -14);
      ctx.lineTo(0, -8);
      ctx.lineTo(7, -14);
    } else {
      ctx.lineTo(-6, -13);
      ctx.quadraticCurveTo(0, -16, 6, -13);
    }
    // Right wing
    ctx.lineTo(5, 5);
    ctx.quadraticCurveTo(wingSpan * 0.62, 6 + wingLift * 0.6, wingSpan, -4 + wingLift);
    ctx.quadraticCurveTo(wingSpan * 0.55, -10 + wingLift * 0.5, 4, -2);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Dark painted wingtips
    ctx.fillStyle = tipColor;
    ctx.beginPath();
    ctx.moveTo(-wingSpan * 0.64, -5 + wingLift * 0.7);
    ctx.lineTo(-wingSpan, -4 + wingLift);
    ctx.lineTo(-wingSpan * 0.65, 4 + wingLift * 0.7);
    ctx.closePath();
    ctx.moveTo(wingSpan * 0.64, -5 + wingLift * 0.7);
    ctx.lineTo(wingSpan, -4 + wingLift);
    ctx.lineTo(wingSpan * 0.65, 4 + wingLift * 0.7);
    ctx.closePath();
    ctx.fill();

    // Feather ink strokes
    ctx.strokeStyle = 'rgba(27, 22, 21, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-7, 1);
    ctx.lineTo(-wingSpan * 0.68, -1 + wingLift * 0.7);
    ctx.moveTo(7, 1);
    ctx.lineTo(wingSpan * 0.68, -1 + wingLift * 0.7);
    ctx.stroke();

    // Central body & breast
    ctx.fillStyle = accentColor;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 2, 5.5, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Beak pointing forward (+Y)
    ctx.fillStyle = '#e5a325';
    ctx.beginPath();
    ctx.moveTo(-2.6, 10);
    ctx.lineTo(0, 16);
    ctx.lineTo(2.6, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-2.2, 7.2, 1.3, 0, Math.PI * 2);
    ctx.arc(2.2, 7.2, 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Diving crimson glint
    if (bird.state === 'diving') {
      ctx.strokeStyle = 'rgba(207, 52, 28, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 2, 14 + Math.sin(time * 24) * 1.5, 0.25, Math.PI - 0.25);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Kintsugi Porcelain Egg
  function drawEgg(ctx, egg, time) {
    ctx.save();
    let shakeX = 0;
    let shakeY = 0;
    const hatchingSoon = egg.hatchTimer < 1.4;
    if (hatchingSoon) {
      const intensity = (1.4 - egg.hatchTimer) * 2.6;
      shakeX = Math.sin(time * 58 + egg.phase) * intensity;
      shakeY = Math.cos(time * 47 + egg.phase) * intensity * 0.7;
    }

    ctx.translate(egg.x + shakeX, egg.y + shakeY);
    ctx.rotate(Math.sin(time * 4.5 + egg.phase) * 0.14);

    // Warm golden aura as egg approaches hatching
    if (hatchingSoon) {
      const prog = 1 - egg.hatchTimer / 1.4;
      const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 26 + prog * 10);
      g.addColorStop(0, `rgba(246, 190, 56, ${0.42 * prog})`);
      g.addColorStop(1, 'rgba(207, 52, 28, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 26 + prog * 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Egg silhouette
    ctx.fillStyle = '#fbf5e4';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.bezierCurveTo(13, -15, 15, 4, 12, 12);
    ctx.bezierCurveTo(9, 18, -9, 18, -12, 12);
    ctx.bezierCurveTo(-15, 4, -13, -15, 0, -17);
    ctx.closePath();
    ctx.fill();

    // Cobalt porcelain glaze band & floral dot accents
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#235185';
    ctx.fillRect(-16, -2, 32, 6);
    ctx.fillStyle = '#d69926';
    ctx.fillRect(-16, -3.5, 32, 1.5);
    ctx.fillRect(-16, 4, 32, 1.5);
    ctx.fillStyle = '#fbf5e4';
    for (let dx = -9; dx <= 9; dx += 6) {
      ctx.beginPath();
      ctx.arc(dx, 1, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shading crescent
    ctx.fillStyle = 'rgba(27, 22, 21, 0.10)';
    ctx.beginPath();
    ctx.ellipse(6, 2, 10, 17, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Outer ink line
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.bezierCurveTo(13, -15, 15, 4, 12, 12);
    ctx.bezierCurveTo(9, 18, -9, 18, -12, 12);
    ctx.bezierCurveTo(-15, 4, -13, -15, 0, -17);
    ctx.closePath();
    ctx.stroke();

    // Glowing Kintsugi cracks spreading as hatch nears
    if (hatchingSoon) {
      const prog = Math.min(1, (1.4 - egg.hatchTimer) / 1.4);
      ctx.strokeStyle = '#d9381e';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-2, -11);
      ctx.lineTo(3, -3);
      ctx.lineTo(-4, 4);
      if (prog > 0.4) {
        ctx.lineTo(5, 11);
        ctx.moveTo(3, -3);
        ctx.lineTo(9, 2);
      }
      ctx.stroke();

      ctx.strokeStyle = '#ffdf76';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Great Solar Phoenix (body + independently destructible & regrowing left/right wings)
  function drawPhoenix(ctx, ph, time) {
    const flap = Math.sin(ph.flapPhase);
    ctx.save();
    ctx.translate(ph.x, ph.y);
    ctx.rotate(ph.angle);

    // Draw each wing independently (-1 = left, +1 = right)
    drawPhoenixWing(ctx, -1, ph.leftWing, ph.leftRegrow, flap, time);
    drawPhoenixWing(ctx, 1, ph.rightWing, ph.rightRegrow, flap, time);

    // Flowing ornamental tail ribbons (top / behind bird)
    const tailSway = Math.sin(time * 7 + ph.phase) * 7;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    for (let s = -1; s <= 1; s += 2) {
      ctx.fillStyle = s === -1 ? '#cf341c' : '#d69422';
      ctx.beginPath();
      ctx.moveTo(s * 3, -12);
      ctx.quadraticCurveTo(s * 14 + tailSway * 0.5, -26, s * 10 + tailSway, -40);
      ctx.quadraticCurveTo(s * 4 + tailSway * 0.6, -28, 0, -15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Center royal plume
    ctx.fillStyle = '#f2be49';
    ctx.beginPath();
    ctx.moveTo(-3, -13);
    ctx.quadraticCurveTo(tailSway * 0.4, -30, tailSway * 0.7, -44);
    ctx.quadraticCurveTo(3 + tailSway * 0.3, -29, 3, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Central Crowned Body (hitting this destroys the Great Phoenix!)
    ctx.fillStyle = ph.hitFlash > 0 ? '#fff9e6' : '#c92e18';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 2, 13, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gilded chest shield / solar emblem (visual target cue!)
    ctx.fillStyle = '#f5c753';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(7.5, 2);
    ctx.lineTo(0, 12);
    ctx.lineTo(-7.5, 2);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Inner vermilion heart dot
    ctx.fillStyle = '#a81f0f';
    ctx.beginPath();
    ctx.arc(0, 2, 3.3, 0, Math.PI * 2);
    ctx.fill();

    // Crowned crest feathers & fierce beak (+Y)
    ctx.fillStyle = '#f2be49';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-4, 17);
    ctx.lineTo(0, 26);
    ctx.lineTo(4, 17);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fierce eyes
    ctx.fillStyle = '#fff9de';
    ctx.beginPath();
    ctx.arc(-4.5, 13, 2.3, 0, Math.PI * 2);
    ctx.arc(4.5, 13, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-4.5, 13.6, 1.2, 0, Math.PI * 2);
    ctx.arc(4.5, 13.6, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawPhoenixWing(ctx, side, alive, regrowTimer, flap, time) {
    ctx.save();
    ctx.scale(side, 1);

    if (!alive) {
      // Sheared stub + visible golden regrowth filaments
      const progress = Math.max(0, Math.min(1, 1 - regrowTimer / 3.6));
      ctx.fillStyle = '#5c2b1e';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(11, -5);
      ctx.lineTo(18, -2);
      ctx.lineTo(16, 6);
      ctx.lineTo(11, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (progress > 0.15) {
        // Golden energy wing budding back into shape!
        const budScale = 0.25 + progress * 0.72;
        ctx.save();
        ctx.globalAlpha = 0.35 + progress * 0.55;
        ctx.scale(budScale, budScale);
        ctx.fillStyle = '#f6c84f';
        ctx.strokeStyle = '#cf341c';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(12, -4);
        ctx.quadraticCurveTo(32, -16 + flap * 6, 54, -8 + flap * 12);
        ctx.quadraticCurveTo(40, 12 + flap * 8, 12, 9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    const lift = flap * 13;
    // Outer sweeping crimson-gold wing
    ctx.fillStyle = '#d43a1f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.1;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(11, -6);
    ctx.quadraticCurveTo(30, -19 + lift * 0.45, 55, -10 + lift);
    // Scalloped primary feathers
    ctx.lineTo(50, -1 + lift * 0.9);
    ctx.lineTo(54, 4 + lift * 0.85);
    ctx.lineTo(44, 7 + lift * 0.75);
    ctx.lineTo(46, 13 + lift * 0.65);
    ctx.lineTo(35, 11 + lift * 0.55);
    ctx.lineTo(34, 16 + lift * 0.45);
    ctx.quadraticCurveTo(22, 14 + lift * 0.3, 11, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner gilded plumage band
    ctx.fillStyle = '#efb842';
    ctx.beginPath();
    ctx.moveTo(12, -2);
    ctx.quadraticCurveTo(28, -9 + lift * 0.4, 45, -3 + lift * 0.8);
    ctx.quadraticCurveTo(32, 7 + lift * 0.5, 12, 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Prussian-blue shoulder accent
    ctx.fillStyle = '#1d497a';
    ctx.beginPath();
    ctx.moveTo(12, -4);
    ctx.quadraticCurveTo(22, -7 + lift * 0.25, 29, -1 + lift * 0.4);
    ctx.quadraticCurveTo(20, 4 + lift * 0.2, 12, 3);
    ctx.closePath();
    ctx.fill();

    // Subtle shimmer on freshly regrown wings
    if (regrowTimer < 0 && regrowTimer > -0.6) {
      ctx.strokeStyle = `rgba(255, 245, 195, ${0.7 + Math.sin(time * 30) * 0.3})`;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    ctx.restore();
  }

  // The Sun-Ark Citadel — Screen-wide Imperial Woodblock Sky-Fortress
  function drawSunArk(ctx, boss, time) {
    ctx.save();
    ctx.translate(boss.x, boss.y);

    const halfW = boss.width * 0.5;

    // 1. Upper Pagoda Hull & Upturned Imperial Eaves (Prussian slate + vermilion lacquer + gold trim)
    ctx.fillStyle = '#1e3e68';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-halfW - 10, 8);
    ctx.quadraticCurveTo(-halfW + 18, -12, -halfW + 78, -36);
    ctx.lineTo(-144, -66);
    ctx.lineTo(-154, -76);
    ctx.lineTo(-104, -92);
    ctx.lineTo(-56, -92);
    ctx.lineTo(0, -118);
    ctx.lineTo(56, -92);
    ctx.lineTo(104, -92);
    ctx.lineTo(154, -76);
    ctx.lineTo(144, -66);
    ctx.lineTo(halfW - 78, -36);
    ctx.quadraticCurveTo(halfW - 18, -12, halfW + 10, 8);
    ctx.lineTo(halfW - 14, 34);
    ctx.lineTo(-halfW + 14, 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Subtle upper pagoda clerestory arches
    ctx.fillStyle = '#f2c24b';
    for (let ax = -84; ax <= 84; ax += 28) {
      ctx.beginPath();
      ctx.roundRect(ax - 5, -84, 10, 11, [4, 4, 0, 0]);
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.lineWidth = 2.6;

    // Vermilion lacquer mid-deck superstructure
    ctx.fillStyle = '#c4301a';
    ctx.beginPath();
    ctx.moveTo(-halfW + 42, 22);
    ctx.lineTo(-halfW + 96, -24);
    ctx.lineTo(halfW - 96, -24);
    ctx.lineTo(halfW - 42, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gold-leaf ornamental trim bands & roof ribs
    ctx.fillStyle = '#e5ae3c';
    ctx.fillRect(-130, -68, 260, 10);
    ctx.strokeRect(-130, -68, 260, 10);

    ctx.strokeStyle = 'rgba(245, 206, 108, 0.72)';
    ctx.lineWidth = 2;
    for (let rx = -240; rx <= 240; rx += 40) {
      ctx.beginPath();
      ctx.moveTo(rx, -22);
      ctx.lineTo(rx * 1.06, 20);
      ctx.stroke();
    }

    // Golden finial spire at apex
    ctx.fillStyle = '#f2c24b';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -142);
    ctx.lineTo(7, -118);
    ctx.lineTo(-7, -118);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Side Escort Launch Alcoves
    for (let s = -1; s <= 1; s += 2) {
      const bx = s * (halfW - 64);
      ctx.fillStyle = '#181415';
      ctx.strokeStyle = '#e8b343';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx - 22, 6, 44, 20, 4);
      ctx.fill();
      ctx.stroke();
    }

    // 2. Central Recessed Sanctum & Vulnerable Solar Core
    ctx.fillStyle = '#1a1516';
    ctx.strokeStyle = '#e8b343';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-52, -46, 104, 68, 8);
    ctx.fill();
    ctx.stroke();

    // Solar Sovereign Core orb
    const corePulse = 0.5 + 0.5 * Math.sin(time * 8);
    const coreFlash = boss.coreHitFlash > 0;
    const coreHpRatio = Math.max(0, boss.coreHp / boss.coreMaxHp);
    const coreR = 23 + corePulse * 2.5;

    const coreGlow = ctx.createRadialGradient(0, -12, 4, 0, -12, coreR * 1.85);
    coreGlow.addColorStop(0, coreFlash ? 'rgba(255,255,255,0.95)' : 'rgba(255, 226, 128, 0.85)');
    coreGlow.addColorStop(0.55, 'rgba(215, 58, 28, 0.55)');
    coreGlow.addColorStop(1, 'rgba(215, 58, 28, 0)');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(0, -12, coreR * 1.85, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = coreFlash ? '#ffffff' : (coreHpRatio < 0.35 ? '#ff5522' : '#d9371c');
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, -12, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotating golden sun-wheel emblem inside the Core
    ctx.save();
    ctx.translate(0, -12);
    ctx.rotate(time * 1.8);
    ctx.strokeStyle = '#fae08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      ctx.lineTo(Math.cos(a) * (coreR - 2), Math.sin(a) * (coreR - 2));
      ctx.stroke();
    }
    ctx.restore();

    // 3. Layer 2: Revolving Horizontal Shield Conveyor Belt (classic 1980 Phoenix!)
    const beltY = boss.beltY;
    const beltHalfW = boss.beltWidth * 0.5;

    // Guide rail behind the moving belt
    ctx.fillStyle = 'rgba(27, 22, 21, 0.55)';
    ctx.fillRect(-beltHalfW - 6, beltY - 9, boss.beltWidth + 12, 18);
    ctx.strokeStyle = '#d69926';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-beltHalfW - 6, beltY - 9, boss.beltWidth + 12, 18);

    // Clip moving shield segments to the belt span
    ctx.save();
    ctx.beginPath();
    ctx.rect(-beltHalfW, beltY - 12, boss.beltWidth, 24);
    ctx.clip();
    const segW = boss.beltSegW;
    for (let i = 0; i < boss.belt.length; i++) {
      const seg = boss.belt[i];
      if (!seg.alive) continue;
      // Compute wrapped X position along conveyor
      const rawX = ((i * segW + boss.beltOffset) % boss.beltWidth + boss.beltWidth) % boss.beltWidth;
      const drawXs = [rawX - beltHalfW];
      if (rawX + segW > boss.beltWidth) drawXs.push(rawX - beltHalfW - boss.beltWidth);

      for (const sx of drawXs) {
        const pad = 2.5;
        ctx.fillStyle = '#e5b242';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.roundRect(sx + pad, beltY - 8, segW - pad * 2, 16, 3);
        ctx.fill();
        ctx.stroke();

        // Rivet & lacquer stripe
        ctx.fillStyle = '#a82714';
        ctx.fillRect(sx + pad + 4, beltY - 2, segW - pad * 2 - 8, 4);
      }
    }
    ctx.restore();

    // 4. Layer 1: Outer Bulwark — Multi-row Destructible Lacquered Armour Tiles
    for (let i = 0; i < boss.tiles.length; i++) {
      const t = boss.tiles[i];
      if (!t.alive) continue;
      const tx = t.x - t.w * 0.5;
      const ty = t.y - t.h * 0.5;
      ctx.fillStyle = t.row === 0 ? '#d23b21' : (t.row === 1 ? '#f0dec0' : '#244d7e');
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(tx + 1, ty + 1, t.w - 2, t.h - 2, 2);
      ctx.fill();
      ctx.stroke();

      // Small gold highlight notch on each lacquer tile
      ctx.fillStyle = 'rgba(246, 206, 102, 0.72)';
      ctx.fillRect(tx + 4, ty + 3, t.w - 8, 2.5);
    }

    // 5. Twin Dragon Lantern Wing Turrets
    for (let i = 0; i < boss.turrets.length; i++) {
      const tur = boss.turrets[i];
      const charge = Math.max(0, 1 - tur.cooldown / 0.55);
      ctx.save();
      ctx.translate(tur.x, tur.y);
      ctx.fillStyle = '#d69824';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = charge > 0.3 ? '#fff7d4' : '#b92614';
      ctx.beginPath();
      ctx.arc(0, 0, 5.5 + charge * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // Player Sun-Lance Shot
  function drawPlayerShot(ctx, s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    // Warm trailing ink streak
    const grad = ctx.createLinearGradient(0, -10, 0, 18);
    grad.addColorStop(0, '#cf341c');
    grad.addColorStop(0.55, '#f0b63e');
    grad.addColorStop(1, 'rgba(240, 182, 62, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-2.5, -8, 5, 24);

    // Crisp sun-lance tip
    ctx.fillStyle = '#fff9e6';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(3.8, -2);
    ctx.lineTo(0, 7);
    ctx.lineTo(-3.8, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Enemy Obsidian-Ringed Ember Bead (high contrast against light paper!)
  function drawEnemyShot(ctx, b, time) {
    ctx.save();
    ctx.translate(b.x, b.y);
    const r = b.big ? 6.8 : 5.2;

    // Dark ink outer halo for instant readability on bright sunlit parchment
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Vermilion ember body
    ctx.fillStyle = b.big ? '#e6421d' : '#cf2e18';
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing pale-gold hot center
    const core = 2 + Math.sin(time * 24 + b.x) * 0.6;
    ctx.fillStyle = '#fff5cc';
    ctx.beginPath();
    ctx.arc(0, 0, core, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Twin Lance Paper Lantern Power-up
  function drawPowerup(ctx, p, time) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.sin(time * 5 + p.phase) * 0.12);

    // Soft radiant halo
    ctx.fillStyle = 'rgba(242, 188, 60, 0.32)';
    ctx.beginPath();
    ctx.arc(0, 0, 19 + Math.sin(time * 8) * 2, 0, Math.PI * 2);
    ctx.fill();

    // Lantern caps
    ctx.fillStyle = INK;
    ctx.fillRect(-7, -14, 14, 3);
    ctx.fillRect(-7, 11, 14, 3);

    // Glowing lantern body
    ctx.fillStyle = '#d6361c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gold II emblem
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(-4.5, -6, 3, 12);
    ctx.fillRect(1.5, -6, 3, 12);
    ctx.restore();
  }

  // Particles: painted feathers, gold leaf flakes, lacquer splinters, ink sunburst rings
  function drawParticles(ctx, particles) {
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i];
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);

      if (pt.kind === 'ring') {
        const rad = pt.r0 + (pt.r1 - pt.r0) * (1 - alpha);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 2.6 * alpha + 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.stroke();
      } else if (pt.kind === 'feather') {
        ctx.fillStyle = pt.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, pt.size * 1.45, pt.size * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (pt.kind === 'shard') {
        ctx.fillStyle = pt.color;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-pt.size, -pt.size * 0.6);
        ctx.lineTo(pt.size, -pt.size * 0.2);
        ctx.lineTo(pt.size * 0.3, pt.size);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Gold leaf / ember spark
        ctx.fillStyle = pt.color;
        ctx.fillRect(-pt.size * 0.5, -pt.size * 0.5, pt.size, pt.size);
      }

      ctx.restore();
    }
  }

  // Floating calligraphic score popups
  function drawPopups(ctx, popups) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < popups.length; i++) {
      const pop = popups[i];
      const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.6);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = pop.big
        ? '700 18px "Cinzel", Georgia, serif'
        : '600 13px "IBM Plex Mono", monospace';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(250, 241, 220, 0.92)';
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color || INK;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.restore();
  }

  // SVG markup for lives indicator crane icon
  function getLifeIconSVG() {
    return '<svg class="life-icon" viewBox="0 0 28 28" aria-hidden="true">' +
      '<path d="M14 3 L18 11 L26 19 L23 22 L17 19 L14 23 L11 19 L5 22 L2 19 L10 11 Z" fill="#faf1dc" stroke="#1b1615" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M14 5 L16.4 13 L14 19 L11.6 13 Z" fill="#cf341c"/>' +
      '</svg>';
  }

  global.SuncrestArt = {
    STAGE_PALETTES,
    lerpColor,
    drawBackdrop,
    drawPlayerShip,
    drawSmallBird,
    drawEgg,
    drawPhoenix,
    drawSunArk,
    drawPlayerShot,
    drawEnemyShot,
    drawPowerup,
    drawParticles,
    drawPopups,
    getLifeIconSVG
  };
})(window);
