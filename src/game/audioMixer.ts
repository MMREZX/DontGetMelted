import type { AudioSettings } from './types.ts';

export const AUDIO_CHANNELS = ['music', 'ambience', 'effects'] as const;
export type AudioChannel = typeof AUDIO_CHANNELS[number];

export const VOLUME_RAMP = 0.015;
export const SILENCE = 0.0001;
export const OUTPUT_CEILING = 10 ** (-1 / 20);

const CHANNEL_LEVELS = { music: 0.316, ambience: 0.2, effects: 0.501 };

// Match the legacy oscillator levels at the corresponding mix faders.
export function getVoicePeak(volume: number, channel: AudioChannel): number {
  return volume / CHANNEL_LEVELS[channel];
}

export function setMixerGain(param: AudioParam, target: number, now: number, timeConstant = VOLUME_RAMP): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now);
  } else {
    const current = param.value;
    param.cancelScheduledValues(now);
    param.setValueAtTime(current, now);
  }
  const safeTarget = Number.isFinite(target) ? Math.min(1, Math.max(SILENCE, target)) : SILENCE;
  param.setTargetAtTime(safeTarget, now, timeConstant);
}

export function createCeilingCurve(): Float32Array<ArrayBuffer> {
  return Float32Array.from({ length: 2049 }, (_, i) =>
    Math.max(-OUTPUT_CEILING, Math.min(OUTPUT_CEILING, (i - 1024) / 1024)));
}

export class AudioMixer {
  readonly channels: Record<AudioChannel, GainNode>;
  private readonly ctx: BaseAudioContext;
  private readonly master: GainNode;
  private readonly analyser: AnalyserNode;
  private readonly musicWarmth: BiquadFilterNode;
  private readonly cleanAmbience: GainNode;
  private readonly hollowAmbience: GainNode;
  private readonly ambientEcho: GainNode;
  private urgentUntil = 0;
  private readonly samples = new Float32Array(2048);
  private peak = 0;
  private clippedSamples = 0;
  private rmsSquared = 0;

  constructor(ctx: BaseAudioContext, output: AudioNode, settings: AudioSettings) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = settings.muted ? SILENCE : Math.max(SILENCE, settings.master);
    this.channels = {
      music: ctx.createGain(),
      ambience: ctx.createGain(),
      effects: ctx.createGain(),
    };
    this.musicWarmth = ctx.createBiquadFilter();
    this.musicWarmth.type = 'lowshelf';
    this.musicWarmth.frequency.value = 220;
    this.channels.music.connect(this.musicWarmth).connect(this.master);
    this.channels.effects.connect(this.master);

    this.cleanAmbience = ctx.createGain();
    this.channels.ambience.connect(this.cleanAmbience).connect(this.master);
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 300;
    highpass.Q.value = 0.9;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2400;
    lowpass.Q.value = 0.7;
    this.hollowAmbience = ctx.createGain();
    this.hollowAmbience.gain.value = SILENCE;
    this.channels.ambience.connect(highpass).connect(lowpass).connect(this.hollowAmbience).connect(this.master);
    const delay = ctx.createDelay(0.3);
    delay.delayTime.value = 0.18;
    this.ambientEcho = ctx.createGain();
    this.ambientEcho.gain.value = SILENCE;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.22;
    lowpass.connect(delay).connect(this.ambientEcho).connect(this.master);
    delay.connect(feedback).connect(delay);

    for (const name of AUDIO_CHANNELS) {
      this.channels[name].gain.value = Math.max(SILENCE, CHANNEL_LEVELS[name] * settings[name]);
    }

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -8;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;
    const ceiling = ctx.createWaveShaper();
    ceiling.curve = createCeilingCurve();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = this.samples.length;
    this.master.connect(compressor).connect(ceiling).connect(this.analyser).connect(output);
  }

  apply(settings: AudioSettings, paused: boolean, hidden: boolean, masterRamp = VOLUME_RAMP): void {
    const now = this.ctx.currentTime;
    setMixerGain(this.master.gain, hidden || settings.muted ? SILENCE : settings.master, now, masterRamp);
    for (const name of AUDIO_CHANNELS) {
      const duck = name === 'effects' ? 1 : paused ? 0.25 : this.urgentUntil > now ? 0.71 : 1;
      setMixerGain(this.channels[name].gain, CHANNEL_LEVELS[name] * settings[name] * duck, now);
    }
  }

  duckForCue(settings: AudioSettings, paused: boolean, hidden: boolean): void {
    this.urgentUntil = this.ctx.currentTime + 0.25;
    this.apply(settings, paused, hidden);
    for (const name of ['music', 'ambience'] as const) {
      if (!paused) this.channels[name].gain.setTargetAtTime(
        Math.max(SILENCE, CHANNEL_LEVELS[name] * settings[name]), this.urgentUntil, 0.06);
    }
  }

  color(calm: number, hollow: number): void {
    const now = this.ctx.currentTime;
    this.musicWarmth.gain.setTargetAtTime(Math.min(2.5, calm * 2.5), now, 0.6);
    setMixerGain(this.cleanAmbience.gain, 1 - hollow * 0.65, now, 0.6);
    setMixerGain(this.hollowAmbience.gain, hollow * 0.62, now, 0.6);
    setMixerGain(this.ambientEcho.gain, hollow * 0.18, now, 0.6);
  }

  measure(dt: number): { peakDb: number; rmsDb: number; clippedSamples: number } {
    this.analyser.getFloatTimeDomainData(this.samples);
    const count = Math.min(this.samples.length, Math.round(dt * this.ctx.sampleRate));
    let energy = 0;
    for (let i = this.samples.length - count; i < this.samples.length; i++) {
      const sample = Math.abs(this.samples[i]);
      this.peak = Math.max(sample, this.peak);
      energy += sample ** 2;
      if (sample >= 0.99) this.clippedSamples++;
    }
    if (count) this.rmsSquared += (energy / count - this.rmsSquared) * (1 - Math.exp(-dt / 0.3));
    return {
      peakDb: 20 * Math.log10(Math.max(this.peak, 1e-8)),
      rmsDb: 10 * Math.log10(Math.max(this.rmsSquared, 1e-16)),
      clippedSamples: this.clippedSamples,
    };
  }
}
