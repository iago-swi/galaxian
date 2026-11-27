'use strict';
/* ---------------------------------------------------------------------------
   SFX — everything you hear is synthesized live with the Web Audio API.
   No audio files: oscillators + filtered noise + a small generative soundtrack.
--------------------------------------------------------------------------- */
const SFX = (() => {
  let ac = null, out, echo, noiseBuf, muted = false, step = 0, nextT = 0, intensity = 0, lastDive = 0;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    out = ac.createGain(); out.gain.value = muted ? 0 : 0.75;
    out.connect(comp); comp.connect(ac.destination);
    // feedback delay bus for spacey tails
    echo = ac.createGain();
    const d = ac.createDelay(1), fb = ac.createGain(), lp = ac.createBiquadFilter();
    d.delayTime.value = 0.36; fb.gain.value = 0.4; lp.type = 'lowpass'; lp.frequency.value = 2400;
    echo.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(out);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 1.5, ac.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    nextT = ac.currentTime + 0.1;
    setInterval(schedule, 60);
  }

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  }
  // one enveloped oscillator, optional pitch glide / lowpass / echo send
  function tone(type, f0, f1, dur, vol, o = {}) {
    if (!ac) return;
    const t = o.t || ac.currentTime, osc = ac.createOscillator(), g = ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f0, t);
    if (f1) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    if (o.detune) osc.detune.value = o.detune;
    env(g, t, o.a || 0.004, vol, dur);
    let node = g; osc.connect(g);
    if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = o.q || 1; g.connect(f); node = f; }
    node.connect(out); if (o.echo) { const s = ac.createGain(); s.gain.value = o.echo; node.connect(s); s.connect(echo); }
    osc.start(t); osc.stop(t + (o.a || 0.004) + dur + 0.05);
    return osc;
  }
  function burst(dur, vol, f0, f1, o = {}) {
    if (!ac) return;
    const t = o.t || ac.currentTime, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf; src.loop = true;
    f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = o.q || 0.8;
    env(g, t, 0.003, vol, dur);
    src.connect(f); f.connect(g); g.connect(out);
    if (o.echo) { const s = ac.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(echo); }
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  /* ---------- generative soundtrack: Am - F - C - G, 16 steps per bar ---------- */
  const ROOT = [55, 43.65, 65.41, 49], THIRD = [1.189, 1.26, 1.26, 1.26];
  function schedule() {
    if (!ac || ac.state !== 'running') return;
    const sl = 0.145;
    if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.25) {
      const s = step % 16, bar = (step >> 4) % 4, root = ROOT[bar], th = THIRD[bar], t = nextT;
      if (s === 0) for (const [m, dt] of [[4, -7], [4 * th, 6], [6, 0], [8, 9]])
        tone('sawtooth', root * m, 0, 1.9, 0.022, { t, a: 0.5, lp: 750 + intensity * 500, detune: dt, echo: 0.3 });
      if ([0, 3, 6, 8, 11, 14].includes(s))
        tone('sawtooth', root * (s === 6 || s === 14 ? 2 : 1), 0, 0.2, 0.15, { t, lp: 330 + intensity * 260, q: 4 });
      if (intensity > 0) {
        if (s % 4 === 0) tone('sine', 130, 42, 0.16, 0.34, { t });
        if (s % 4 === 2) burst(0.045, 0.045, 9000, 7000, { t, type: 'highpass' });
        if (s === 4 || s === 12) burst(0.11, 0.07, 2600, 900, { t, type: 'bandpass', echo: 0.25 });
      }
      if (s % 2 === 0 && Math.random() < 0.34 + intensity * 0.3) {
        const notes = [1, th, 1.498, 2, 2 * th, 2.997];
        tone('triangle', root * 8 * notes[(Math.random() * notes.length) | 0], 0, 0.22, 0.045, { t, echo: 0.65 });
      }
      step++; nextT += sl;
    }
  }

  return {
    init,
    setIntensity(v) { intensity = v; },
    toggleMute() { muted = !muted; if (out) out.gain.setTargetAtTime(muted ? 0 : 0.75, ac.currentTime, 0.03); return muted; },
    shoot() { tone('square', 1500, 260, 0.11, 0.07, { lp: 3800 }); tone('sawtooth', 760, 190, 0.08, 0.05, { lp: 2000 }); },
    eshoot() { tone('sine', 620, 240, 0.16, 0.07, { echo: 0.3 }); },
    hit() { tone('square', 1900, 900, 0.05, 0.06, { lp: 5000 }); burst(0.05, 0.08, 6000, 2500); },
    boom(k = 1) {
      burst(0.32 * k, 0.3, 4200, 160, { echo: 0.2 });
      tone('sine', 170, 36, 0.3 * k, 0.4);
      tone('triangle', 900, 120, 0.2, 0.07, { echo: 0.5 });
    },
    dive() {
      if (!ac || ac.currentTime - lastDive < 0.25) return;
      lastDive = ac.currentTime;
      const o = tone('sine', 1250, 300, 0.75, 0.05, { a: 0.03, echo: 0.4 });
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = 17; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency);
      l.start(); l.stop(ac.currentTime + 0.9);
    },
    power() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, 0, 0.2, 0.1, { t: ac ? ac.currentTime + i * 0.055 : 0, echo: 0.5 })); },
    shieldUp() { tone('sine', 300, 1300, 0.35, 0.12, { a: 0.02, echo: 0.5 }); burst(0.3, 0.08, 1500, 8000, { type: 'bandpass', echo: 0.3 }); },
    shieldHit() { tone('sine', 1500, 700, 0.12, 0.08, { echo: 0.4 }); },
    hatch() { burst(0.12, 0.2, 5000, 1200, { type: 'bandpass' }); tone('square', 900, 1800, 0.14, 0.06, { lp: 4000, echo: 0.4 }); },
    clang() { tone('square', 520, 500, 0.09, 0.06, { lp: 2500 }); tone('triangle', 1310, 1290, 0.12, 0.05, { echo: 0.3 }); },
    die() {
      burst(1.3, 0.5, 5000, 60, { echo: 0.3 });
      tone('sawtooth', 420, 28, 1.2, 0.26, { lp: 1400 });
      tone('sine', 110, 24, 1.1, 0.5);
    },
    wave() { [220, 330, 440, 660].forEach((f, i) => tone('sawtooth', f, f * 1.01, 0.5, 0.05, { t: ac ? ac.currentTime + i * 0.09 : 0, lp: 2400, a: 0.03, echo: 0.6 })); },
    start() { tone('sawtooth', 110, 880, 0.6, 0.1, { lp: 3000, a: 0.02, echo: 0.6 }); burst(0.7, 0.12, 300, 6000, { echo: 0.4 }); },
  };
})();
