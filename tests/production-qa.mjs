
import { GameEngine } from '/src/game/engine.ts';
import { AudioMixer, OUTPUT_CEILING } from '/src/game/audioMixer.ts';
import { DEFAULT_AUDIO_SETTINGS } from '/src/game/save.ts';
import { SAVE_KEY } from '/src/game/data.ts';
import { DELTA_BANK_X, DELTA_BANK_Y } from '/src/game/fishing.ts';
import { maxGeneralFlashes, relativeLuminance, isSaturatedRedTransition } from '/src/game/visualSafety.ts';
import {
  GROVE_CAMP, HOLLOW, HOLLOW_PACK, HOLLOW_QUARTZ, HOLLOW_RIBBONS, HOLLOW_SHELTER,
  MILLPOND_BANKS, MILLPOND_RIBBONS, MINT_BEDS, hollowReady, millpondReady,
} from '/src/game/expeditions.ts';

// Keep fixture saves in this tab. The live game's saved adventure is never used.
Object.defineProperty(window, 'localStorage', { get: () => window.sessionStorage, configurable: true });
const canvas = document.querySelector('canvas');
const report = document.querySelector('#report');
const note = (message) => { report.textContent += message + '\n'; };
const verify = (condition, message) => { if (!condition) throw new Error(message); };
const tick = 1 / 60;
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let hud;
const hooks = {
  onHudUpdate: (snapshot) => { hud = snapshot; },
  onToast() {},
  onModeChange() {},
  onOpenModal() {},
};

function position(engine, point) {
  const p = engine.state.player;
  p.x = point.x;
  p.y = point.y;
  p.vx = p.vy = 0;
  engine.camX = p.x;
  engine.camY = p.y;
}
function interactAt(engine, point) {
  position(engine, point);
  engine.triggerBoop();
}
function catchFish(engine, shouldCaption) {
  let caption = false;
  for (let i = 0; i < 1800 && engine.fishing.phase !== 'landed'; i++) {
    engine.update(tick);
    if (engine.fishing.phase === 'bite') {
      engine.emitHud();
      caption ||= Boolean(hud.soundCaption?.includes('Fish bite'));
      engine.handleFishingActionDown();
    }
    if (engine.fishing.phase === 'tension') engine.fishing.reelHeld = !engine.fishing.fishPulling;
  }
  verify(engine.fishing.phase === 'landed', 'The fishing session did not land.');
  if (shouldCaption) verify(caption, 'Muted fishing lacked a visual bite caption.');
}

function restoreFieldwork(engine, comfort) {
  engine.startNewGame('pip');
  engine.state.creatures = [];
  engine.updateAudioSettings({ master: comfort ? 0 : 1, muted: comfort, flashFree: comfort, perceptionIntensity: comfort ? 0 : 1, visualSoundCues: false });
  engine.setReducedMotion(comfort);
  engine.startMillpond();
  MILLPOND_RIBBONS.forEach((point) => interactAt(engine, point));
  MINT_BEDS.forEach((point) => interactAt(engine, point));
  interactAt(engine, MILLPOND_BANKS[comfort ? 1 : 0]);
  catchFish(engine, comfort);
  verify(engine.state.inv.reed_perch === 1, 'The landed fish was not a Reed Perch.');
  verify(engine.state.worldFlags.ferrySupperStage === 'unstarted', 'Millpond altered the existing ferry quest.');
  verify(millpondReady(engine.state.expeditions.millpond), 'Millpond objectives were not credited.');
  position(engine, GROVE_CAMP);
  engine.finishMillpond();
  verify(engine.state.expeditions.millpond.status === 'restored', 'Millpond restoration failed.');
  engine.finishMillpond();
  verify(engine.state.inv.reed_perch === 1, 'Duplicate turn-in changed items.');

  engine.startHollow(comfort ? 'anchor' : 'hauler');
  HOLLOW_RIBBONS.slice(0, 2).forEach((point) => interactAt(engine, point));
  HOLLOW_QUARTZ.slice(0, 2).forEach((point) => interactAt(engine, point));
  position(engine, HOLLOW_SHELTER);
  engine.bankHollowQuartz();
  verify(engine.state.expeditions.hollow.bankedQuartz === 2, 'Partial quartz banking failed.');
  interactAt(engine, HOLLOW_QUARTZ[2]);
  interactAt(engine, HOLLOW_PACK);
  engine.shareHollowDraught();
  verify(engine.state.expeditions.hollow.sharedDraught, 'Draught was not shared.');
  // Walk the route at a normal pace so the escort follows, using the live world/survival step.
  const p = engine.state.player;
  for (let i = 0; i < 950 && !engine.state.expeditions.hollow.escorted; i++) {
    const dx = HOLLOW_SHELTER.x - p.x, dy = HOLLOW_SHELTER.y - p.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.1) {
      const move = Math.min(distance, 170 * tick);
      p.x += dx / distance * move; p.y += dy / distance * move;
    }
    engine.update(tick);
  }
  verify(hollowReady(engine.state.expeditions.hollow), 'The companion did not finish the escort.');
  engine.finishHollow();
  verify(engine.state.expeditions.hollow.status === 'restored', 'Waterwheel restoration failed.');
  verify(engine.state.inv.hollow_waterwheel_plan === 1, 'Blueprint was not recorded.');
  engine.finishHollow();
  verify(engine.state.inv.hollow_waterwheel_plan === 1, 'Duplicate Waterwheel reward.');
  verify(engine.loadGame() && engine.state.expeditions.hollow.status === 'restored', 'Expedition progress failed to reload.');
}
async function verifyOverlap(engine) {
  engine.startNewGame('pip');
  engine.state.creatures = [];
  engine.startMillpond();
  engine.state.expeditions.millpond.status = 'restored';
  engine.startHollow('anchor');
  HOLLOW_RIBBONS.slice(0,2).forEach((point) => interactAt(engine, point));
  engine.updateAudioSettings({ master: 0, muted: true, flashFree: true, perceptionIntensity: 1 });
  engine.setReducedMotion(false);
  position(engine, HOLLOW);
  engine.state.expeditions.hollow.day = engine.state.day;
  engine.state.expeditions.hollow.elapsed = 28;
  engine.state.dayTime = 69;
  engine.state.player.wobble = 68;
  engine.state.trips.cosmic = 22;
  engine.state.trips.chrono = 20;
  const sampled = document.createElement('canvas');
  sampled.width = sampled.height = 3;
  const ctx = sampled.getContext('2d', {willReadFrequently:true});
  const traces = Array.from({length:9}, () => []);
  const previous = Array.from({length:9}, () => null);
  let maxRedTransitions = 0;
  const renderStart = performance.now();
  for (let i = 0; i < 600; i++) {
    engine.state.player.vibe = 16;
    engine.update(tick);
    engine.perception.rememberStride(HOLLOW.x - 20, HOLLOW.y, 1);
    engine.render();
    traces.forEach((_, index) => {
      const x = Math.round((canvas.width - Math.min(canvas.width, 341)) * ((index % 3) / 2));
      const y = Math.round((canvas.height - 256) * (Math.floor(index / 3) / 2));
      ctx.drawImage(canvas, x, y, Math.min(canvas.width, 341), 256, index % 3, Math.floor(index / 3), 1, 1);
    });
    const colors = ctx.getImageData(0,0,3,3).data;
    traces.forEach((trace, index) => {
      const rgb = [colors[index * 4], colors[index * 4 + 1], colors[index * 4 + 2]];
      if (previous[index] && isSaturatedRedTransition(previous[index],rgb)) maxRedTransitions++;
      previous[index] = rgb;
      trace.push({ms:i*1000/60, luminance:relativeLuminance(rgb)});
    });
    if (i % 24 === 0) await wait(0);
  }
  verify(engine.perception.weights.warning > 0.2 && engine.perception.weights.focus > 0.1, 'Combined storm, strain and focus did not engage.');
  const flashes = Math.max(...traces.map(maxGeneralFlashes));
  verify(flashes <= 1 && maxRedTransitions === 0, 'Sampled overlap exceeded flash targets.');
  const fps = (600_000 / (performance.now() - renderStart)).toFixed(1);
  note('Combined effects · ' + flashes + ' general flashes/s, ' + maxRedTransitions + ' saturated-red transitions in nine block-average traces. ' + fps + ' capture-loop frames/s.');
  engine.render();
  engine.setReducedMotion(true);
  engine.render();
  verify(engine.perception.echoCount === 0 && engine.perception.parallax === 0, 'Comfort motion did not clear within one render.');
  engine.updateAudioSettings({ perceptionIntensity: 0 });
  verify(Object.values(engine.perception.weights).every((weight) => weight === 0), 'Perception weight survived zero intensity.');
  engine.state.player.vibe = 0;
  engine.update(tick);
  verify(Math.hypot(engine.state.player.x - HOLLOW_SHELTER.x, engine.state.player.y - HOLLOW_SHELTER.y) < 1, 'Hollow failed to recover to the shelter.');
  verify(engine.state.expeditions.hollow.ribbons === 3 && engine.state.expeditions.hollow.status === 'active', 'Recovery discarded tied ribbons.');
  note('Comfort reset and Hollow recovery passed.');
}

async function verifyAssetLoads(engine) {
  await Promise.all(Object.values(engine.fieldAssets).map(async (asset) => {
    await asset.decode();
    verify(asset.naturalWidth > 0, 'An expedition asset did not load.');
  }));
  note('All eight expedition asset sources decoded in the browser.');
}

async function verifyMixer() {
  const audio = new OfflineAudioContext(1, 60 * 44100, 44100);
  const settings = {...DEFAULT_AUDIO_SETTINGS, master:1, music:1, ambience:1, effects:1};
  const mixer = new AudioMixer(audio, audio.destination, settings);
  mixer.color(0.8, 0.9);
  const frequencies = [110, 146.83, 185, 240, 340, 445, 540, 640];
  for (const bus of Object.values(mixer.channels)) {
    frequencies.forEach((frequency,index) => {
      const oscillator = audio.createOscillator();
      oscillator.type = index % 3 === 0 ? 'sawtooth' : 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.connect(bus);
      oscillator.start();
      oscillator.stop(60);
    });
  }
  const output = (await audio.startRendering()).getChannelData(0);
  let peak = 0;
  let clipped = 0;
  for (const value of output) {
    const level = Math.abs(value);
    peak = Math.max(level, peak);
    if (level >= 0.99) clipped++;
  }
  verify(peak <= OUTPUT_CEILING && clipped === 0, 'Mixer exceeded the ceiling.');
  note('Audio · 60 seconds at full bus levels, ' + (20 * Math.log10(peak)).toFixed(3) + ' dBFS peak, ' + clipped + ' clipped samples.');
}

async function verifyAudioLifecycle(engine) {
  const realtime = engine.audio.ctx;
  verify(realtime, 'Web Audio failed to initialize.');
  engine.audio.setHidden(true);
  await wait(120);
  verify(realtime.state === 'suspended', 'AudioContext did not suspend on hide.');
  engine.audio.setHidden(false);
  await wait(120);
  verify(realtime.state === 'running', 'AudioContext did not resume on return.');
  note('Browser AudioContext suspended and resumed through the visibility lifecycle.');
}

document.querySelector('#run').onclick = async () => {
  report.textContent = '';
  const engine = new GameEngine(canvas, hooks);
  try {
    restoreFieldwork(engine, true);
    note('At 0% and muted · Millpond catch, both restorations, banked quartz, companion escort, and save reload passed.');
    await wait(0);
    restoreFieldwork(engine, false);
    note('At 100% · Both restorations and save reload passed on the sunlit bank and Hauler route.');
    await wait(0);
    engine.state.player.vibe = engine.state.player.maxVibe;
    position(engine, {x:DELTA_BANK_X,y:DELTA_BANK_Y});
    engine.startCast(0);
    catchFish(engine, false);
    verify(engine.state.inv.spool_perch === 1 && engine.state.worldFlags.ferrySupperStage === 'caught', 'The existing Delta path changed.');
    note('Delta regression · Spool Perch and the ferry supper catch stage passed.');
    const save = JSON.parse(sessionStorage.getItem(SAVE_KEY));
    save.version = 7;
    delete save.expeditions;
    sessionStorage.setItem(SAVE_KEY, JSON.stringify(save));
    verify(engine.loadGame() && engine.state.expeditions.millpond.status === 'unstarted' && engine.state.inv.hollow_waterwheel_plan === 1, 'v7 migration dropped legacy progress.');
    note('Legacy save · v7 inventory preserved while initializing the new fieldwork data.');
    await verifyAssetLoads(engine);
    await verifyOverlap(engine);
    await verifyAudioLifecycle(engine);
    await verifyMixer();
    note('All browser production checks passed.');
  } catch (error) {
    note(String(error.stack ?? error));
  } finally {
    engine.destroy();
  }
};
