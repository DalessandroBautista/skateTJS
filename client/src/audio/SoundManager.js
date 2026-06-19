/**
 * SoundManager.js
 *
 * Efectos de sonido procedurales usando Web Audio API.
 * No requiere archivos externos — todo se genera en código.
 */
export class SoundManager {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._enabled = true;
    this._init();
  }

  _init() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = 0.4;
      this._masterGain.connect(this._ctx.destination);
    } catch {
      this._enabled = false;
    }
  }

  _resume() {
    if (this._ctx?.state === 'suspended') this._ctx.resume();
  }

  // --- Sonidos del juego ---

  playJump() {
    if (!this._enabled) return;
    this._resume();
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.connect(gain);
    gain.connect(this._masterGain);

    osc.type = 'sine';
    const now = this._ctx.currentTime;
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playLand() {
    if (!this._enabled) return;
    this._resume();
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.type = 'sine';
    const now = this._ctx.currentTime;
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Aterrizaje de trick: thud más pesado + acorde de impacto */
  playLandTrick() {
    if (!this._enabled) return;
    this._resume();
    const now = this._ctx.currentTime;

    // Thud grave más fuerte
    const thud = this._ctx.createOscillator();
    const thudGain = this._ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(110, now);
    thud.frequency.exponentialRampToValueAtTime(45, now + 0.12);
    thudGain.gain.setValueAtTime(1.0, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    thud.connect(thudGain);
    thudGain.connect(this._masterGain);
    thud.start(now);
    thud.stop(now + 0.18);

    // Golpe de tabla (clack)
    const clack = this._ctx.createOscillator();
    const clackGain = this._ctx.createGain();
    clack.type = 'sawtooth';
    clack.frequency.setValueAtTime(600, now);
    clack.frequency.exponentialRampToValueAtTime(150, now + 0.06);
    clackGain.gain.setValueAtTime(0.5, now);
    clackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    clack.connect(clackGain);
    clackGain.connect(this._masterGain);
    clack.start(now);
    clack.stop(now + 0.08);

    // Pequeño acorde ascendente (confirmación)
    [440, 554, 659].forEach((freq, i) => {
      const osc = this._ctx.createOscillator();
      const g = this._ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + 0.05 + i * 0.04;
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g);
      g.connect(this._masterGain);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  playTrick() {
    if (!this._enabled) return;
    this._resume();
    // Whoosh rápido
    const bufferSize = this._ctx.sampleRate * 0.12;
    const buffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this._ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.8;

    const gain = this._ctx.createGain();
    gain.gain.value = 0.6;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);
    source.start();
  }

  playGrindStart() {
    if (!this._enabled) return;
    this._resume();
    // Clank metálico
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.connect(gain);
    gain.connect(this._masterGain);

    osc.type = 'sawtooth';
    const now = this._ctx.currentTime;
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playComboEnd(score) {
    if (!this._enabled) return;
    this._resume();
    // Fanfarria ascendente con volumen proporcional al score
    const vol = Math.min(0.6, 0.2 + score / 5000);
    const notes = [261, 329, 392, 523];
    notes.forEach((freq, i) => {
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.connect(gain);
      gain.connect(this._masterGain);

      osc.type = 'triangle';
      const t = this._ctx.currentTime + i * 0.1;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  playLevelUp() {
    if (!this._enabled) return;
    this._resume();
    const notes = [261, 329, 392, 523, 659, 784];
    notes.forEach((freq, i) => {
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.connect(gain);
      gain.connect(this._masterGain);

      osc.type = 'triangle';
      const t = this._ctx.currentTime + i * 0.08;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  // --- Música ambient procedural ---

  /**
   * Inicia música ambient según el mapa.
   * @param {'plaza'|'park'|'streets'} mapId
   */
  startAmbient(mapId) {
    if (!this._enabled) return;
    this._resume();
    this.stopAmbient();

    switch (mapId) {
      case 'park':    this._ambientPark();    break;
      case 'streets': this._ambientStreets(); break;
      default:        this._ambientPlaza();   break;
    }
  }

  stopAmbient() {
    if (this._ambientNodes) {
      for (const node of this._ambientNodes) {
        try { node.stop?.(); node.disconnect?.(); } catch {}
      }
    }
    this._ambientNodes = [];
  }

  /** Plaza: drone urbano — bass bajo + ruido suave filtrado */
  _ambientPlaza() {
    const ctx = this._ctx;
    const nodes = [];

    // Bass drone en Re
    const drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 73.4; // D2
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.06;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 200;
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this._masterGain);
    drone.start();
    nodes.push(drone);

    // Sub-harmonic suave
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 36.7; // D1
    const subGain = ctx.createGain();
    subGain.gain.value = 0.08;
    sub.connect(subGain);
    subGain.connect(this._masterGain);
    sub.start();
    nodes.push(sub);

    // Ruido ambiente de ciudad (filtrado alto)
    const bufSize = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    noiseFilter.Q.value = 0.3;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.02;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this._masterGain);
    noise.start();
    nodes.push(noise);

    this._ambientNodes = nodes;
  }

  /** Park: chill — pad suave con armonías */
  _ambientPark() {
    const ctx = this._ctx;
    const nodes = [];

    // Pad harmónico en Sol mayor (G-B-D)
    const freqs = [98, 123.5, 146.8, 196, 246]; // G2 B2 D3 G3 B3
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.025;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      osc.connect(filter);
      filter.connect(g);
      g.connect(this._masterGain);
      osc.start();
      nodes.push(osc);
    }

    // LFO para movimiento suave del pad
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(this._masterGain);
    lfo.start();
    nodes.push(lfo);

    this._ambientNodes = nodes;
  }

  /** Streets: energético — bass pulsante + hi-hat */
  _ambientStreets() {
    const ctx = this._ctx;
    const nodes = [];

    // Bass pulsante en La (110 Hz)
    const bass = ctx.createOscillator();
    bass.type = 'square';
    bass.frequency.value = 55; // A1
    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 150;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.07;

    // LFO para pulsación tipo 4/4 (120 BPM = 2Hz)
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 2.0;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain);
    lfoGain.connect(bassGain.gain);

    bass.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this._masterGain);
    bass.start();
    lfo.start();
    nodes.push(bass, lfo);

    // Hi-hat: noise corto repetitivo
    const scheduleHihat = () => {
      const interval = 0.25; // corcheas a 120 BPM
      const now = ctx.currentTime;
      for (let i = 0; i < 8; i++) {
        const t = now + i * interval;
        const src = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
        src.buffer = buf;
        const hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.value = 8000;
        const hg = ctx.createGain();
        hg.gain.value = 0.04;
        src.connect(hpf);
        hpf.connect(hg);
        hg.connect(this._masterGain);
        src.start(t);
      }
    };
    scheduleHihat();
    const hihatTimer = setInterval(scheduleHihat, 2000);
    // Guardar el timer para poder detenerlo
    nodes.push({ stop: () => clearInterval(hihatTimer), disconnect: () => {} });

    this._ambientNodes = nodes;
  }

  setVolume(v) {
    if (this._masterGain) this._masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  toggle() {
    this._enabled = !this._enabled;
    this.setVolume(this._enabled ? 0.4 : 0);
    return this._enabled;
  }
}

export const soundManager = new SoundManager();
