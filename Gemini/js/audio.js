/* Suncrest — Web Audio Pentatonic Koto, Taiko, Shakuhachi & Woodblock Synth */
(function (global) {
  'use strict';

  // Japanese In-sen / Hirajoshi pentatonic frequencies (D minor pentatonic coloration)
  const SCALE_LOW = [146.83, 155.56, 196.00, 220.00, 261.63]; // D3 Eb3 G3 A3 C4
  const SCALE_MID = [293.66, 311.13, 392.00, 440.00, 523.25, 587.33, 622.25, 783.99];
  const KOTO_PATTERNS = [
    [0, 2, 3, 5, 3, 2, 1, 0, 2, 3, 4, 5, 4, 3, 2, 1],
    [0, 3, 2, 5, 6, 5, 3, 2, 0, 4, 3, 5, 7, 5, 4, 3],
    [0, 1, 3, 0, 4, 3, 2, 1, 5, 4, 3, 2, 3, 1, 0, 2]
  ];

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.noiseBuf = null;
      this.muted = false;
      this.musicMode = 'idle'; // 'idle' | 'flock' | 'brood' | 'boss'
      this.step = 0;
      this.nextNoteTime = 0;
      this.timerId = null;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }
      const AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.72;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.36;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.78;
      this.sfxGain.connect(this.master);

      // Shared white-noise buffer for woodblocks, taiko skins, explosions
      const len = this.ctx.sampleRate * 1.2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.nextNoteTime = this.ctx.currentTime + 0.08;
      this.timerId = setInterval(() => this._schedule(), 55);
    }

    setMuted(m) {
      this.muted = !!m;
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(this.muted ? 0 : 0.72, this.ctx.currentTime, 0.02);
      }
    }

    toggleMute() {
      this.setMuted(!this.muted);
      return this.muted;
    }

    setMusicMode(mode) {
      this.musicMode = mode;
    }

    _schedule() {
      if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
      const tempo = this.musicMode === 'boss' ? 132 : (this.musicMode === 'brood' ? 114 : 106);
      const stepDur = (60 / tempo) / 2; // eighth notes
      const now = this.ctx.currentTime;
      if (this.nextNoteTime < now - 0.25) {
        this.nextNoteTime = now + 0.05;
      }
      while (this.nextNoteTime < now + 0.22) {
        this._playMusicStep(this.step, this.nextNoteTime, stepDur);
        this.nextNoteTime += stepDur;
        this.step = (this.step + 1) % 32;
      }
    }

    _playMusicStep(step, t, dur) {
      if (this.musicMode === 'idle') {
        // Gentle sparse koto arpeggio on title screen
        if (step % 4 === 0) {
          const idx = KOTO_PATTERNS[0][(step / 2) % 16];
          this._kotoPluck(SCALE_MID[idx], t, 0.65, 0.16);
        }
        return;
      }

      const patIdx = this.musicMode === 'boss' ? 2 : (this.musicMode === 'brood' ? 1 : 0);
      const noteIdx = KOTO_PATTERNS[patIdx][step % 16];

      // Plucked koto lead
      if (step % 2 === 0 || (this.musicMode === 'boss' && step % 4 === 3)) {
        const freq = SCALE_MID[noteIdx] * (step >= 16 ? 1 : 1);
        this._kotoPluck(freq, t, dur * 2.1, this.musicMode === 'boss' ? 0.22 : 0.18);
      }

      // Low shamisen/bass anchor on bar beats
      if (step % 8 === 0) {
        const bass = SCALE_LOW[(step / 8) % SCALE_LOW.length];
        this._kotoPluck(bass, t, dur * 3.2, 0.22);
      }

      // Taiko drum rhythm
      const isBoss = this.musicMode === 'boss';
      if (step % 8 === 0 || (isBoss && (step % 8 === 3 || step % 8 === 6)) || (!isBoss && step % 16 === 10)) {
        this._taikoHit(t, step % 8 === 0 ? 0.34 : 0.22, isBoss ? 82 : 94);
      }

      // Hyoshigi woodblock accent
      if (step % 8 === 4 || (isBoss && step % 4 === 2)) {
        this._woodblock(t, 1280 + (step % 4) * 140, 0.08);
      }

      // Breathy shakuhachi-style flute swell every 16 steps
      if (step % 16 === 0) {
        const fluteNote = SCALE_MID[(noteIdx + 2) % SCALE_MID.length];
        this._fluteNote(fluteNote, t, dur * 4.5, 0.09);
      }
    }

    _kotoPluck(freq, t, dur, vol) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 5.2, t);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.15, t + dur * 0.7);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    _taikoHit(t, vol, baseHz) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseHz * 1.85, t);
      osc.frequency.exponentialRampToValueAtTime(baseHz * 0.62, t + 0.16);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.007);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.26);
    }

    _woodblock(t, hz, vol) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, t);
      osc.frequency.exponentialRampToValueAtTime(hz * 0.78, t + 0.045);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.06);
    }

    _fluteNote(freq, t, dur, vol) {
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      lfo.frequency.setValueAtTime(5.2, t);
      lfoGain.gain.setValueAtTime(4.5, t);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(vol, t + dur * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + dur + 0.03);
      lfo.stop(t + dur + 0.03);
    }

    // --- Sound Effects ---
    _ready() {
      return this.ctx && this.ctx.state === 'running' && !this.muted;
    }

    playShot() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(980, t);
      osc.frequency.exponentialRampToValueAtTime(340, t + 0.085);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.095);
    }

    playBirdHit(high) {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(high ? 720 : 540, t);
      osc.frequency.exponentialRampToValueAtTime(190, t + 0.13);
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
      this._noiseBurst(t, 0.09, 1400, 0.12);
    }

    playEggBreak() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      [1180, 1520, 880].forEach((hz, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, t + idx * 0.02);
        gain.gain.setValueAtTime(0.16, t + idx * 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.02 + 0.09);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t + idx * 0.02);
        osc.stop(t + idx * 0.02 + 0.1);
      });
    }

    playEggHatch() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(520, t + 0.22);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.26);
    }

    playWingShear() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      this._noiseBurst(t, 0.15, 2200, 0.2);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(640, t);
      osc.frequency.exponentialRampToValueAtTime(280, t + 0.14);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.16);
    }

    playWingRegrow() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      [392, 523.25, 659.25].forEach((hz, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, t + idx * 0.045);
        gain.gain.setValueAtTime(0.11, t + idx * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.045 + 0.16);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t + idx * 0.045);
        osc.stop(t + idx * 0.045 + 0.18);
      });
    }

    playPhoenixKill() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      this._taikoFx(t, 120, 0.36);
      this._noiseBurst(t, 0.24, 900, 0.22);
      [587.33, 880].forEach((hz, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(hz, t + i * 0.03);
        gain.gain.setValueAtTime(0.16, t + i * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t + i * 0.03);
        osc.stop(t + 0.34);
      });
    }

    playWardActivate() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      [293.66, 440, 587.33, 880].forEach((hz, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, t + i * 0.025);
        gain.gain.setValueAtTime(0.14, t + i * 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t + i * 0.025);
        osc.stop(t + 0.58);
      });
    }

    playWardDeflect() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1320, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.09);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.11);
    }

    playWardReady() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      [587.33, 783.99].forEach((hz, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, t + i * 0.06);
        gain.gain.setValueAtTime(0.11, t + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.22);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t + i * 0.06);
        osc.stop(t + i * 0.06 + 0.24);
      });
    }

    playTileBreak(isBronze) {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isBronze ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(isBronze ? 460 : 340, t);
      osc.frequency.exponentialRampToValueAtTime(isBronze ? 220 : 150, t + 0.11);
      gain.gain.setValueAtTime(isBronze ? 0.16 : 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.13);
    }

    playBossCoreHit() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      // Resonant bronze temple gong hit
      [196, 293.66, 466.16, 622.25].forEach((hz, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(hz, t);
        osc.frequency.exponentialRampToValueAtTime(hz * 0.96, t + 0.45);
        gain.gain.setValueAtTime(0.16 / (idx + 1), t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.5);
      });
    }

    playBossDestroy() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      for (let i = 0; i < 6; i++) {
        const dt = i * 0.24;
        this._taikoFx(t + dt, 105 - i * 8, 0.35);
        this._noiseBurst(t + dt, 0.35, 700 - i * 60, 0.26);
      }
      this.playStageClear(0.95);
    }

    playPlayerHit() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      this._taikoFx(t, 95, 0.42);
      this._noiseBurst(t, 0.42, 620, 0.34);
    }

    playExtraLife() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      [293.66, 392.00, 440.00, 587.33, 783.99].forEach((hz, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(hz, t + i * 0.075);
        gain.gain.setValueAtTime(0.2, t + i * 0.075);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.075 + 0.32);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t + i * 0.075);
        osc.stop(t + i * 0.075 + 0.35);
      });
    }

    playStageClear(delay) {
      if (!this._ready()) return;
      const t = this.ctx.currentTime + (delay || 0);
      [392.00, 440.00, 523.25, 587.33].forEach((hz, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(hz, t + i * 0.085);
        gain.gain.setValueAtTime(0.18, t + i * 0.085);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.085 + 0.36);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t + i * 0.085);
        osc.stop(t + i * 0.085 + 0.38);
      });
    }

    playPowerup() {
      if (!this._ready()) return;
      const t = this.ctx.currentTime;
      [440, 587.33, 880].forEach((hz, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, t + i * 0.05);
        gain.gain.setValueAtTime(0.16, t + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.22);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t + i * 0.05);
        osc.stop(t + i * 0.05 + 0.24);
      });
    }

    _taikoFx(t, hz, vol) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(hz * 1.9, t);
      osc.frequency.exponentialRampToValueAtTime(hz * 0.48, t + 0.26);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.36);
    }

    _noiseBurst(t, dur, cutoff, vol) {
      if (!this.noiseBuf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(cutoff, t);
      filter.frequency.exponentialRampToValueAtTime(cutoff * 0.35, t + dur);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      src.start(t);
      src.stop(t + dur + 0.02);
    }
  }

  global.SuncrestAudio = SoundEngine;
})(window);
