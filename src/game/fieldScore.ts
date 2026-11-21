import { setMixerGain, SILENCE } from './audioMixer.ts';

// Original D Dorian score. The three parts share a beat-quantized Web Audio clock.
const BEAT = 60 / 96;
const BAR = BEAT * 4;
const NOTES = [146.83, 164.81, 174.61, 196, 220, 246.94, 261.63, 293.66];
const ARPEGGIOS = [[0, 2, 4, 7], [3, 5, 7, 2], [1, 3, 5, 0], [0, 4, 6, 2]];

export class FieldScore {
  private readonly ctx: AudioContext;
  private readonly voices: readonly [GainNode, GainNode, GainNode];
  private readonly winds: readonly [GainNode, GainNode];
  private readonly sources: AudioBufferSourceNode[] = [];
  private readonly activeNotes = new Set<OscillatorNode>();
  private nextBeat = 0;
  private noteIndex = 0;
  private lastMix = '';
  private gains: [number, number, number] = [0.14, 0, 0];
  private cadence = 1;

  constructor(ctx: AudioContext, music: AudioNode, ambience: AudioNode) {
    this.ctx = ctx;
    const makeGain = (output: AudioNode) => {
      const gain = ctx.createGain();
      gain.gain.value = SILENCE;
      gain.connect(output);
      return gain;
    };
    this.voices = [makeGain(music), makeGain(music), makeGain(music)];
    this.winds = [makeGain(ambience), makeGain(ambience)];
  }

  mix(calm: number, tense: number, landmark: boolean, squall: boolean, drift: number): void {
    const mixKey = [Math.round(calm * 8), Math.round(tense * 8), Number(landmark), Number(squall), Math.round(drift * 100)].join('/');
    if (mixKey === this.lastMix) return;
    this.lastMix = mixKey;
    this.gains = [0.18, Math.min(0.22, calm * 0.18 + (landmark ? 0.08 : 0)), Math.min(0.18, tense * 0.18)];
    this.cadence = 1 + drift;
    const now = this.ctx.currentTime;
    setMixerGain(this.winds[0].gain, squall ? 0.035 : 0.14, now, 0.9);
    setMixerGain(this.winds[1].gain, squall ? 0.48 : 0.001, now, 0.9);
    this.sources.forEach((source, index) => source.playbackRate.setTargetAtTime(index === 1 ? this.cadence : 1, now, 0.9));
  }

  tick(): void {
    const now = this.ctx.currentTime;
    if (!this.sources.length) this.startAmbience(now);
    if (this.nextBeat < now) {
      this.nextBeat = Math.ceil((now + 0.04) / BAR) * BAR;
      this.noteIndex = 0;
    }
    while (this.nextBeat < now + 0.12) {
      const time = this.nextBeat;
      const beat = this.noteIndex % 4;
      const bar = Math.floor(this.noteIndex / 4) % ARPEGGIOS.length;
      if (beat === 0) {
        this.voices.forEach((voice, index) => setMixerGain(voice.gain, this.gains[index], time, 0.55));
      }
      const note = NOTES[ARPEGGIOS[bar][beat]];
      this.pluck(note, time, 0.47, this.voices[0], false);
      if (beat % 2 === 0) this.pluck(note * 2, time + 0.025, 0.9 * this.cadence, this.voices[1], true);
      if (beat === 0) this.pluck(NOTES[ARPEGGIOS[bar][0]] / 2, time, BAR * 0.92, this.voices[2], true);
      this.nextBeat += BEAT;
      this.noteIndex++;
    }
  }

  private pluck(hz: number, time: number, duration: number, destination: AudioNode, sustained: boolean): void {
    const oscillator = this.ctx.createOscillator();
    oscillator.type = sustained ? 'sine' : 'triangle';
    oscillator.frequency.value = hz;
    const profile = this.ctx.createGain();
    profile.gain.setValueAtTime(SILENCE, time);
    profile.gain.linearRampToValueAtTime(sustained ? 0.12 : 0.22, time + (sustained ? 0.12 : 0.012));
    profile.gain.exponentialRampToValueAtTime(SILENCE, time + duration);
    oscillator.connect(profile).connect(destination);
    this.activeNotes.add(oscillator);
    oscillator.onended = () => {
      oscillator.disconnect();
      profile.disconnect();
      this.activeNotes.delete(oscillator);
    };
    oscillator.start(time);
    oscillator.stop(time + duration);
  }

  private startAmbience(now: number): void {
    const RATE = 8000;
    const FRAMES = RATE * 30;
    for (let track = 0; track < 2; track++) {
      const sample = this.ctx.createBuffer(1, FRAMES, RATE);
      const data = sample.getChannelData(0);
      let noise = 1 + track * 709;
      let smooth = 0;
      for (let i = 0; i < FRAMES; i++) {
        noise = (Math.imul(1664525, noise) + 1013904223) >>> 0;
        smooth += (noise / 2147483648 - 1 - smooth) * (track ? 0.055 : 0.12);
        const t = i / RATE;
        const loopEdge = Math.min(1, i / 1600, (FRAMES - 1 - i) / 1600);
        const swell = 0.55 + 0.4 * Math.sin(t * Math.PI / 3);
        data[i] = loopEdge * smooth * (track ? swell * 0.75 : 0.3);
      }
      const source = this.ctx.createBufferSource();
      source.buffer = sample;
      source.loop = true;
      source.connect(this.winds[track]);
      source.start(now);
      this.sources.push(source);
    }
  }

  flushNotes(): void {
    this.nextBeat = 0;
  }

  destroy(): void {
    this.sources.forEach((source) => source.stop());
    this.activeNotes.forEach((note) => note.stop());
    this.sources.length = 0;
  }
}
