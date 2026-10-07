"use client";

/**
 * Sound, authored in code.
 *
 * Every poster in this casino is drawn rather than drawn *from* a file, and
 * the sound follows the same rule: there are no audio assets here, only an
 * oscillator and an envelope. That is not a purity exercise — it is what makes
 * a card flip able to be a semitone higher than the one before it, so a hand
 * that scores five cards walks up a scale instead of repeating one click five
 * times.
 *
 * ── The music ───────────────────────────────────────────────────────
 * A slow generative pad. Four notes of a pentatonic set, each a detuned pair
 * of triangles through a gentle low-pass, arriving every few seconds and
 * overlapping. There is no loop point because there is no loop: it will not
 * repeat, so it cannot become the thing you are waiting to hear end.
 *
 * ── The rule everything here obeys ──────────────────────────────────
 * Browsers refuse to make noise until the page has been touched, and quite
 * right too. Nothing starts itself: the context is created on the first real
 * gesture, and until then every call here is a no-op rather than an error.
 */

const MUTE_KEY = "grimoire:muted";

/** A minor pentatonic in A, low enough to sit under everything. */
const PAD_NOTES = [220, 261.63, 293.66, 329.63, 392, 440];
const PLINK_SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private padTimer: number | null = null;
  private started = false;
  muted = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this.muted = window.localStorage.getItem(MUTE_KEY) === "1";
      } catch {
        this.muted = false;
      }
    }
  }

  /** Builds the graph. Safe to call on every gesture; it only ever builds once. */
  private wake(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.ctx = new Ctor();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.16;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.5;
      this.sfxBus.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** Called from the first click anywhere; starts the pad if it is not running. */
  begin() {
    const ctx = this.wake();
    if (!ctx || this.started) return;
    this.started = true;
    this.schedulePad();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // Nothing stored; the setting lasts for this page view.
    }
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(muted ? 0 : 1, this.ctx.currentTime + 0.25);
    }
  }

  // ── The pad ─────────────────────────────────

  private schedulePad() {
    const next = () => {
      this.pad();
      // Irregular on purpose: an even pulse becomes a metronome you start
      // counting, and the point of this is to not be noticed.
      this.padTimer = window.setTimeout(next, 3200 + Math.random() * 3600);
    };
    this.padTimer = window.setTimeout(next, 400);
  }

  /** One long, soft note: two detuned triangles under a slow filter sweep. */
  private pad() {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || this.muted) return;
    const now = ctx.currentTime;
    const root = PAD_NOTES[Math.floor(Math.random() * PAD_NOTES.length)];
    const length = 7 + Math.random() * 4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 2.4);
    gain.gain.linearRampToValueAtTime(0, now + length);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.linearRampToValueAtTime(900, now + length * 0.5);
    filter.frequency.linearRampToValueAtTime(380, now + length);
    filter.Q.value = 0.8;

    for (const detune of [-5, 6]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = root;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + length + 0.1);
    }
    filter.connect(gain);
    gain.connect(this.musicBus);
  }

  // ── The parts a sound effect is made of ─────

  /** A plucked tone. Everything short in this file is one of these. */
  private tone(freq: number, length: number, type: OscillatorType = "sine", level = 0.3, glide = 0) {
    const ctx = this.wake();
    if (!ctx || !this.sfxBus || this.muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + glide), now + length);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + length + 0.02);
  }

  /** A short burst of filtered noise: paper, shuffling, a card landing. */
  private noise(length: number, freq: number, level = 0.22, type: BiquadFilterType = "bandpass") {
    const ctx = this.wake();
    if (!ctx || !this.sfxBus || this.muted) return;
    const now = ctx.currentTime;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * length));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = 0.9;

    const gain = ctx.createGain();
    gain.gain.value = level;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start(now);
  }

  // ── The vocabulary ──────────────────────────

  tap() {
    this.tone(660, 0.07, "sine", 0.16);
  }
  press() {
    this.tone(392, 0.12, "triangle", 0.22);
    this.tone(588, 0.1, "sine", 0.1);
  }
  deal() {
    // Four quick sheets of paper, not one: a hand arrives, it does not appear.
    for (let i = 0; i < 4; i++) window.setTimeout(() => this.noise(0.1, 1800 + i * 160, 0.16), i * 85);
  }
  discard() {
    this.noise(0.26, 1100, 0.2, "highpass");
  }
  shuffle() {
    for (let i = 0; i < 7; i++) window.setTimeout(() => this.noise(0.07, 1500 + Math.random() * 900, 0.1), i * 42);
  }
  play() {
    this.tone(330, 0.18, "triangle", 0.24);
    window.setTimeout(() => this.tone(494, 0.22, "triangle", 0.2), 90);
  }
  /** Each scoring card a semitone up from the last, so a hand climbs. */
  point(step: number) {
    this.tone(PLINK_SCALE[Math.min(step, PLINK_SCALE.length - 1)], 0.16, "sine", 0.26);
  }
  mult(step: number) {
    const base = PLINK_SCALE[Math.min(step, PLINK_SCALE.length - 1)];
    this.tone(base * 0.75, 0.22, "sawtooth", 0.12);
    this.tone(base, 0.18, "sine", 0.18);
  }
  total() {
    [0, 90, 200].forEach((at, i) => window.setTimeout(() => this.tone([523.25, 659.25, 783.99][i], 0.4, "triangle", 0.22), at));
  }
  coin() {
    this.tone(1046, 0.1, "square", 0.08);
    window.setTimeout(() => this.tone(1318, 0.14, "square", 0.06), 55);
  }
  token() {
    this.tone(880, 0.16, "triangle", 0.18, -240);
  }
  open() {
    this.noise(0.34, 900, 0.24, "bandpass");
    window.setTimeout(() => this.tone(523, 0.26, "triangle", 0.18), 120);
  }
  rite() {
    [0, 110, 220, 330].forEach((at, i) => window.setTimeout(() => this.tone([392, 494, 587, 784][i], 0.5, "sine", 0.16), at));
  }
  win() {
    [0, 130, 260, 430].forEach((at, i) => window.setTimeout(() => this.tone([523.25, 659.25, 783.99, 1046.5][i], 0.55, "triangle", 0.24), at));
  }
  lose() {
    [0, 180, 420].forEach((at, i) => window.setTimeout(() => this.tone([392, 330, 262][i], 0.7, "sine", 0.2), at));
  }
}

export const sfx = new Sound();

/** Wakes the audio on the first gesture anywhere, then takes itself off. */
export function armAudio() {
  if (typeof window === "undefined") return () => {};
  const begin = () => sfx.begin();
  window.addEventListener("pointerdown", begin, { once: true });
  window.addEventListener("keydown", begin, { once: true });
  return () => {
    window.removeEventListener("pointerdown", begin);
    window.removeEventListener("keydown", begin);
  };
}
