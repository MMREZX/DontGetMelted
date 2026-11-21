import assert from 'node:assert/strict';
import test from 'node:test';
import { createCeilingCurve, getVoicePeak, OUTPUT_CEILING, setMixerGain, SILENCE } from './audioMixer.ts';
import { PerceptionDirector, VisualCueBridge } from './perception.ts';
import { clampFrameSeconds } from './perceptionTuning.ts';
import { DEFAULT_AUDIO_SETTINGS } from './save.ts';
import { tripPaintStrength } from './tripFx.ts';
import { contrastRatio, isSaturatedRedTransition, maxGeneralFlashes, relativeLuminance } from './visualSafety.ts';

test('perception budget holds through overlap and comfort removes echoes immediately', () => {
  const director = new PerceptionDirector();
  director.setComfort(false, false, 0.75);
  const shelter = { calm: true, focused: true, strain: 0.6, danger: false };
  for (let i = 0; i < 240; i++) director.step(1 / 60, shelter);
  assert.ok(Math.abs(director.contour(0)) > 0);
  director.rememberStride(10, 12, 1);
  assert.equal(director.echoCount, 1);
  director.setComfort(true, false, 0.75);
  assert.equal(director.echoCount, 0);
  assert.equal(director.contour(0), 0);
  assert.equal(director.weights.echo, 0);
  assert.ok(director.weights.focus > 0, 'static hatch stays available');

  director.setComfort(false, false, 0.75);
  for (let i = 0; i < 180; i++) {
    director.step(1 / 60, { ...shelter, danger: true });
    assert.ok(Object.values(director.weights).reduce((a, b) => a + b) <= 0.75000001);
    if (director.weights.calm > 0) assert.ok(director.weights.warning <= 0.25);
  }
  assert.equal(director.weights.calm, 0);
  assert.ok(director.weights.warning > 0.25);
  director.rememberStride(10, 12, 1);
  director.setComfort(false, true, 0.75);
  assert.equal(director.echoCount, 0);
  director.setComfort(false, false, 0);
  assert.ok(Object.values(director.weights).every((weight) => weight === 0));
  assert.equal(director.contour(0), 0);
});

test('muted captions survive at zero intensity and keep source direction', () => {
  const bridge = new VisualCueBridge();
  bridge.add({ id: 'Fish bite', category: 'fish', worldPos: { x: 200, y: 50 }, urgency: 'urgent', channel: 'effects' }, 50, 50, 10);
  bridge.add({ id: 'Camp shift complete', category: 'bell', worldPos: null, urgency: 'normal', channel: 'effects' }, 50, 50, 10.1);
  const settings = { ...DEFAULT_AUDIO_SETTINGS, perceptionIntensity: 0 };
  assert.equal(bridge.caption(settings, 0, 0, 100, 100), null);
  assert.match(bridge.caption({ ...settings, master: 0 }, 0, 0, 100, 100) ?? '', /Fish bite · E$/);
  assert.match(bridge.caption({ ...settings, effects: 0 }, 0, 0, 100, 100) ?? '', /Fish bite/);
  bridge.clear();
  assert.equal(bridge.caption({ ...settings, muted: true }, 0, 0, 100, 100), null);
});

test('mixer holds the current gain, settles within 50 ms, and bounds the output', () => {
  const calls: unknown[][] = [];
  const param = {
    value: 0.5,
    cancelScheduledValues: (...args: unknown[]) => calls.push(['cancel', ...args]),
    setValueAtTime: (...args: unknown[]) => calls.push(['hold existing', ...args]),
    setTargetAtTime: (...args: unknown[]) => calls.push(['target', ...args]),
  } as unknown as AudioParam;
  setMixerGain(param, -10, 4);
  setMixerGain(param, 2, 5);
  assert.deepEqual(calls, [
    ['cancel', 4], ['hold existing', 0.5, 4], ['target', SILENCE, 4, 0.015],
    ['cancel', 5], ['hold existing', 0.5, 5], ['target', 1, 5, 0.015],
  ]);
  assert.ok(Math.exp(-0.05 / 0.015) < 0.05);
  const curve = createCeilingCurve();
  assert.ok(curve.every((value) => Math.abs(value) <= OUTPUT_CEILING));
  assert.equal(curve[1024], 0);
  assert.equal(curve[1152], 0.125);
});

test('a resumed frame cannot catch up more than 50 ms of simulation', () => {
  assert.equal(clampFrameSeconds(60_000), 0.05);
  assert.equal(clampFrameSeconds(16), 0.016);
  assert.equal(clampFrameSeconds(-10), 0);
});

test('default flash-free optics still animate and give brews a visible paint strength', () => {
  const director = new PerceptionDirector();
  const intensity = DEFAULT_AUDIO_SETTINGS.perceptionIntensity;
  director.setComfort(false, DEFAULT_AUDIO_SETTINGS.flashFree, intensity);
  for (let i = 0; i < 90; i++) director.step(1 / 60, { calm: true, focused: true, strain: 0, danger: false });
  assert.ok(director.ambientTime > 0);
  assert.ok(tripPaintStrength(intensity, director.weights.focus, 0.45) >= 0.5);
  director.setComfort(true, true, intensity);
  assert.equal(director.ambientTime, 0);
  assert.ok(tripPaintStrength(intensity, director.weights.focus, 0.45) >= 0.5, 'static motifs remain visible');
  director.setComfort(true, true, 0);
  assert.equal(tripPaintStrength(0, director.weights.focus, 0.45), 0);
});

test('bus normalization preserves the existing sound loudness before limiting', () => {
  const originalPeak = 0.11;
  for (const [channel, nominal] of [['music', 0.316], ['ambience', 0.2], ['effects', 0.501]] as const) {
    assert.ok(Math.abs(getVoicePeak(originalPeak, channel) * nominal - originalPeak) < 1e-12);
  }
  assert.ok(getVoicePeak(0.14, 'effects') < OUTPUT_CEILING);
});

test('gameplay cards meet contrast thresholds and QA detects opposing luminance shifts', () => {
  const card = [22, 12, 36] as const;
  assert.equal(relativeLuminance([255, 255, 255]), 1);
  assert.equal(contrastRatio([255, 255, 255], [0, 0, 0]), 21);
  assert.ok(contrastRatio(card, [247, 239, 222]) >= 4.5);
  assert.ok(contrastRatio(card, [255, 209, 102]) >= 4.5);
  assert.ok(contrastRatio(card, [114, 239, 221]) >= 3);
  const steady = Array.from({ length: 40 }, (_, i) => ({ ms: i * 50, luminance: i % 2 ? 0.22 : 0.18 }));
  const flashes = steady.map(({ ms }, i) => ({ ms, luminance: i % 2 ? 0.6 : 0.18 }));
  assert.equal(maxGeneralFlashes(steady), 0);
  assert.equal(maxGeneralFlashes(flashes), 10);
  assert.ok(isSaturatedRedTransition([255, 0, 0], [247, 239, 222]));
  assert.equal(isSaturatedRedTransition([92, 65, 86], [22, 12, 36]), false);
});
