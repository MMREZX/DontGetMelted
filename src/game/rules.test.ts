import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_BIOME_IDS, CHARACTERS, ITEMS, QUESTS, RECIPES, RESIDENTS, SAVE_BACKUP_KEY, SAVE_KEY, TECHNIQUES } from './data.ts';
import { LANDMARKS, REGION_ZONES, ROADS, WORLD_FEATURES } from './world.ts';
import {
  applyXpGain,
  buildMeltRecoveryOutcome,
  canCraftRecipe,
  canSeeCrystals,
  checkHybridPair,
  computeCountySyncStatus,
  computeCropGrowthDelta,
  computeMirrorRipenCount,
  computeNightVibeDelta,
  computeTripProfile,
  computeTripStage,
  countUnclaimedQuests,
  detectTripSynergy,
  evaluateCampShelter,
  evaluateRegionalEventTrigger,
  findNearestWarmRefuge,
  getBiomeAt,
  getDiscountedCost,
  getEffectiveBarterCost,
  getEffectiveRecipeCost,
  getGhostTimerDuration,
  getPhaseFromDayTime,
  getRadioBroadcastLine,
  getRegionPhysics,
  getSalvageRefund,
  TRIP_SYNERGIES,
  TRIP_VISUAL_META,
  updateDiscoveryAtPosition,
  validateBuildingPlacement,
} from './rules.ts';
import {
  computeDockReflectionState,
  createIdleFishingSession,
  evaluateCampSupperStatus,
  startFishingCast,
  stepFishingSession,
  triggerFishingHookOrReel,
} from './fishing.ts';
import {
  awardDisciplinePractice,
  CORE_DISCIPLINE_IDS,
  createInitialDisciplines,
  DISCIPLINES,
  selectDisciplinePerk,
} from './disciplines.ts';
import {
  createDefaultMirrorAngles,
  createInitialDiscoveries,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_WORLD_FLAGS,
  migrateSaveData,
  safeLoadAndMigrate,
  SAVE_VERSION,
} from './save.ts';
import type { CharacterId, GameState } from './types.ts';
import { createCampProgress, getCountyWeather, getWeatherPressure, resolveCampShift, RIBBON_TRAILS, stepTrail } from './fieldwork.ts';
import type { TrailRun } from './fieldwork.ts';
import { newExpeditions } from './expeditions.ts';

function makeStubState(charId: CharacterId = 'pip', seed = 12345): GameState {
  return {
    version: SAVE_VERSION,
    camp: createCampProgress(),
    expeditions: newExpeditions(),
    worldSeed: seed,
    time: 0,
    dayTime: 10,
    day: 1,
    dead: false,
    victory: false,
    deathReason: '',
    ghostTimer: 0,
    exp: null,
    expCooldown: 55,
    xp: 0,
    sp: 0,
    skills: [],
    techniques: [],
    unlockedStyles: ['hustle'],
    unlockedTransports: [],
    claimedQuests: [],
    discoveries: createInitialDiscoveries(),
    npcMemories: {},
    worldFlags: { ...DEFAULT_WORLD_FLAGS },
    mirrorAngles: createDefaultMirrorAngles(),
    waypoint: null,
    journalNotes: [],
    journalSketches: [],
    disciplines: createInitialDisciplines(),
    difficultyMode: 'standard',
    audioSettings: { ...DEFAULT_AUDIO_SETTINGS },
    reducedMotion: false,
    stats: {
      harvests: 0,
      tripsTaken: 0,
      cropsHarvested: 0,
      buddiesTamed: 0,
      crystalsFound: 0,
      bossDefeated: 0,
      enemiesBonked: 0,
      daysSurvived: 1,
      fishCaught: 0,
      mealsCooked: 0,
    },
    player: {
      charId,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      elevation: 0,
      bob: 0,
      squashX: 1,
      squashY: 1,
      vibe: 100,
      maxVibe: 100,
      munch: 100,
      maxMunch: 100,
      wobble: 0,
      moveStyle: 'hustle',
      actionAnim: 0,
      hitFlash: 0,
      invulnTimer: 0,
      rollTimer: 0,
      rollCd: 0,
      abCd: 0,
      gear: { partyHat: false, sweater: false, prismShades: false, reedRod: false, prismReel: false },
    },
    trips: {},
    inv: { bottlecap: 14 },
    objects: [],
    creatures: [],
    buildings: [],
    mailboxes: [
      { id: 0, x: -145, y: -145, biomeId: 'giggle_grove', biomeName: 'The Giggle-Grove', col: '#38a169', discovered: true },
      { id: 1, x: -5100, y: -2950, biomeId: 'vinyl_desert', biomeName: 'The Vinyl Desert', col: '#7b2cbf', discovered: false },
    ],
    projectiles: [],
    ducks: [],
    popups: [],
    inspectorCd: 0,
    shakeBonus: false,
  };
}

test('all 15 regions resolve cleanly at their centers and match declared landmarks', () => {
  assert.equal(ALL_BIOME_IDS.length, 15);
  assert.equal(REGION_ZONES.length, 15);
  for (const zone of REGION_ZONES) {
    assert.equal(getBiomeAt(zone.cx, zone.cy).id, zone.id);
  }
  for (const lm of LANDMARKS) {
    assert.equal(getBiomeAt(lm.x, lm.y).id, lm.regionId, `Landmark ${lm.id} should lie inside ${lm.regionId}`);
  }
});

test('all 3 expedition loops have connected roads, residents, and teachable techniques', () => {
  assert.ok(ROADS.length >= 9);
  assert.equal(Object.keys(TECHNIQUES).length, 8);
  assert.ok(RESIDENTS.length >= 16);
  const taughtIds = new Set(RESIDENTS.map((r) => r.teaches).filter(Boolean));
  assert.equal(taughtIds.size, 8, 'Every one of the 8 peoples should have a resident teaching its technique');
  assert.ok(WORLD_FEATURES.length >= 24);
});

test('regional impossible physics rules fire predictable cues and respond to techniques', () => {
  // Dead Air Basin groove reversal warning at t = 6.0s (cycle 5.5..7.0)
  const basinWarn = getRegionPhysics(-7450, -4950, 6.0, 'dead_air_basin', [], 0, 0, false);
  assert.equal(basinWarn.grooveWarning, true);
  assert.equal(basinWarn.grooveDir, 1);

  // Dead Air Basin reversed B-side at t = 8.0s
  const basinRev = getRegionPhysics(-7450, -4950, 8.0, 'dead_air_basin', [], 0, 0, false);
  assert.equal(basinRev.grooveDir, -1);

  // Carbon Copy Delta stamp bridge: active at t=1.0, wet at t=5.0, ghost trace visible with Wobble or Mural Step
  const deltaActive = getRegionPhysics(-4150, -8200, 1.0, 'carbon_copy_delta', [], 0, 0, false);
  assert.equal(deltaActive.stampBridgeActive, true);
  const deltaWetSober = getRegionPhysics(-4150, -8200, 5.0, 'carbon_copy_delta', [], 0, 5, false);
  assert.equal(deltaWetSober.stampBridgeActive, false);
  assert.equal(deltaWetSober.stampGhostVisible, false);
  const deltaWetWobble = getRegionPhysics(-4150, -8200, 5.0, 'carbon_copy_delta', [], 0, 28, false);
  assert.equal(deltaWetWobble.stampGhostVisible, true);
  const deltaWetTech = getRegionPhysics(-4150, -8200, 5.0, 'carbon_copy_delta', ['mural_step'], 0, 0, false);
  assert.equal(deltaWetTech.stampGhostVisible, true);

  // Midnight Defrost: cold during hum (t=2), zero cold & boost during silent window (t=7)
  const defrostHum = getRegionPhysics(-8250, 6950, 2.0, 'midnight_defrost', [], 0, 0, false);
  assert.equal(defrostHum.compressorSilent, false);
  assert.equal(defrostHum.coldMult, 1);
  const defrostSilent = getRegionPhysics(-8250, 6950, 7.0, 'midnight_defrost', [], 0, 0, false);
  assert.equal(defrostSilent.compressorSilent, true);
  assert.equal(defrostSilent.coldMult, 0);

  // Unpaired Sea Dryer double-knock warning at t=7.0
  const seaWarn = getRegionPhysics(8650, 3450, 7.0, 'unpaired_sea', [], 0, 0, false);
  assert.equal(seaWarn.dryerKnockWarning, true);

  // Wickwater Afterhours moth scatter warning at t=5.0
  const wickWarn = getRegionPhysics(-2450, 8850, 5.0, 'wickwater_afterhours', [], 0, 0, false);
  assert.equal(wickWarn.waxLedgeSolid, true);
  assert.equal(wickWarn.waxDimWarning, true);
});

test('Prism Orchard mirrors ripen when all 3 align and discovery upgrades smoothly', () => {
  assert.equal(computeMirrorRipenCount({ feat_mirror_1: 0, feat_mirror_2: 1, feat_mirror_3: 2 }), 0);
  assert.equal(computeMirrorRipenCount({ feat_mirror_1: 2, feat_mirror_2: 3, feat_mirror_3: 1 }), 3);

  const disc = createInitialDiscoveries();
  assert.equal(disc.prism_orchard, 'unknown');
  const visited = updateDiscoveryAtPosition(disc, 8850, -3750);
  assert.equal(disc.prism_orchard, 'visited');
  assert.equal(disc.lm_prism_greenhouse, 'visited');
  assert.ok(visited.includes('Prism Orchard'));
});

test('Ghost Mode rescue timer scales with Watchkeeper Collar and finds closest warm refuge', () => {
  assert.equal(getGhostTimerDuration([]), 22);
  assert.equal(getGhostTimerDuration(['watchkeepers_collar']), 30);

  const refugeNearTower = findNearestWarmRefuge(-8700, -5900, []);
  assert.equal(refugeNearTower.name, 'Radio Unmelted Tower');
  assert.ok(refugeNearTower.dist < 300);

  const refugeNearLamp = findNearestWarmRefuge(4000, 4000, [{ type: 'lava_lamp', x: 4050, y: 4000 }]);
  assert.equal(refugeNearLamp.name, 'Lava Lamp');
  assert.equal(Math.round(refugeNearLamp.dist), 50);
});

test('legacy v3 save migrates without duplicating claimed quests', () => {
  const legacyV3 = {
    day: 4,
    dayTime: 32,
    xp: 40,
    sp: 2,
    skills: ['rubber_knees'],
    unlockedStyles: ['hustle', 'toast_skates'],
    claimedQuests: ['q_forage', 'q_wobble'],
    stats: { harvests: 9, tripsTaken: 3, cropsHarvested: 2, buddiesTamed: 1, crystalsFound: 2, bossDefeated: 0, enemiesBonked: 4, daysSurvived: 4 },
    player: {
      charId: 'gerald',
      x: 120,
      y: -80,
      vibe: 95,
      munch: 88,
      wobble: 12,
      gear: { partyHat: true, sweater: false, prismShades: false },
    },
    inv: { bottlecap: 88, rubber_wood: 7 },
    buildings: [{ id: 'b_old', type: 'lava_lamp', x: 100, y: 100, phase: 0, crop: null, growth: 0 }],
    mailboxes: [{ id: 1, biomeId: 'vinyl_desert', discovered: true }],
    creatures: [{ id: 'c_buddy', type: 'toast_crab', tamed: true, hearts: 3, x: 90, y: -60 }],
  };

  const migrated = migrateSaveData(legacyV3, makeStubState);
  assert.ok(migrated);
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.player.charId, 'gerald');
  assert.equal(migrated.inv.bottlecap, 88);
  assert.deepEqual(migrated.claimedQuests, ['q_forage', 'q_wobble']);
  assert.equal(migrated.buildings.length, 1);
  assert.equal(migrated.mailboxes.find((m) => m.biomeId === 'vinyl_desert')?.discovered, true);
  assert.equal(migrated.creatures.some((c) => c.id === 'c_buddy' && c.tamed), true);
  assert.equal(migrated.worldFlags.radioRepaired, false);
  // Already claimed quests must not be counted as unclaimed
  const unclaimed = countUnclaimedQuests(migrated.stats, migrated.claimedQuests, migrated.worldFlags);
  assert.equal(unclaimed, 3); // q_crystal, q_buddy, q_farm
});

test('save migration keeps empty world collections and repairs invalid values', () => {
  const base = makeStubState();
  const save = {
    ...base,
    player: { ...base.player, charId: 'constructor', x: 'broken', moveStyle: 'missing' },
    worldFlags: { dockLampSlot: 5 },
    audioSettings: { music: 8, ambience: null },
    buildings: [],
    creatures: [],
    objects: [],
    trips: { kaleido: 10, invalid: 60 },
    inv: { bottlecap: 7, fizz_berry: -3, rubber_wood: 'lots' },
    npcMemories: { missing: null, miri: { talked: true, visits: 2 } },
  };
  const restored = migrateSaveData(save, makeStubState);
  assert.ok(restored);
  assert.equal(restored.player.charId, 'pip');
  assert.equal(restored.player.moveStyle, 'hustle');
  assert.equal(restored.player.x, base.player.x);
  assert.equal(restored.worldFlags.dockLampSlot, DEFAULT_WORLD_FLAGS.dockLampSlot);
  assert.equal(restored.audioSettings.music, 1);
  assert.equal(restored.audioSettings.ambience, DEFAULT_AUDIO_SETTINGS.ambience);
  assert.deepEqual(restored.buildings, []);
  assert.deepEqual(restored.creatures, []);
  assert.deepEqual(restored.objects, []);
  assert.deepEqual(restored.trips, { kaleido: 10 });
  assert.deepEqual(restored.inv, { bottlecap: 7 });
  assert.deepEqual(restored.npcMemories, { miri: { talked: true, helped: false, visits: 2 } });
});

test('save loading preserves unsupported data and reports failed backups accurately', () => {
  const raw = JSON.stringify({ ...makeStubState(), version: SAVE_VERSION + 1 });
  const storage = {
    getItem: (key: string) => key === SAVE_KEY ? raw : null,
    setItem: () => { throw new Error('storage quota exceeded'); },
  };
  assert.deepEqual(safeLoadAndMigrate(storage, makeStubState), {
    state: null,
    unreadable: true,
    backupPreserved: false,
  });
  assert.equal(storage.getItem(SAVE_KEY), raw);
});

test('camp supper requires its bench and lamp near the same table and accepts eel relish', () => {
  const furniture = [
    { id: 'table_a', type: 'camp_table', x: 0, y: 0 },
    { id: 'table_b', type: 'camp_table', x: 1000, y: 0 },
    { id: 'bench', type: 'bench', x: 50, y: 0 },
    { id: 'lamp', type: 'lava_lamp', x: 1050, y: 0 },
  ].map((building) => ({ ...building, phase: 0, crop: null, growth: 0 })) as GameState['buildings'];
  const split = evaluateCampSupperStatus(furniture, { eel_relish: 1 });
  assert.equal(split.readyToServe, false);
  assert.equal(split.hasCookedSupper, true);
  assert.equal(split.hasBenchNearTable, true);
  assert.equal(split.hasLampNearTable, false);
  furniture[2].x = 950;
  const complete = evaluateCampSupperStatus(furniture, { eel_relish: 1 });
  assert.equal(complete.readyToServe, true);
  assert.equal(complete.tableId, 'table_b');
});

test('county forecast is stable for a save seed and shelter limits active hazards', () => {
  assert.equal(getCountyWeather(3, 1), 'clear');
  assert.equal(getCountyWeather(3, 2), 'emberfall');
  assert.deepEqual(getWeatherPressure('paper_squall', 'day', false), { vibe: 0, munch: 0, wobble: 0 });
  assert.ok(getWeatherPressure('paper_squall', 'dusk', false).vibe < getWeatherPressure('paper_squall', 'dusk', true).vibe);
  assert.ok(getWeatherPressure('emberfall', 'day', false).munch < 0);
  assert.ok(getWeatherPressure('hush_dew', 'night', false).wobble < 0);
});

test('camp shift consumes one ration per completed job and runs once at dusk', () => {
  const initial = { ...createCampProgress(), provisions: 2, jobs: { scout: 'forage', keeper: 'watch' } as const };
  const companions = [{ id: 'scout', name: 'Scout' }, { id: 'keeper', name: 'Keeper' }];
  const conditions = { hasCamp: true, hasPlots: false, hasLamp: false, hasRelay: true };
  const { camp, effects } = resolveCampShift(initial, 3, companions, conditions);
  assert.deepEqual(effects, { timber: 3, berries: 1, cropGrowth: 0 });
  assert.equal(camp.provisions, 1);
  assert.match(camp.report[1], /place a lamp/);
  assert.equal(resolveCampShift(camp, 3, companions, { ...conditions, hasLamp: true }).camp, camp);
  assert.equal(resolveCampShift(camp, 4, companions.slice(1), { ...conditions, hasLamp: true }).camp.wardDay, 4);
  assert.equal(initial.provisions, 2);
});

test('ribbon trials start on arrival, require rolls through gold gates, and expire', () => {
  const route = RIBBON_TRAILS.lantern_loop;
  const [start, gold, crossing, finish] = route.gates;
  const initial: TrailRun = { id: 'lantern_loop', gateIndex: 0, elapsed: 0 };
  const armed = stepTrail(initial, 0, 0, false, 60).run;
  assert.deepEqual(armed, initial);
  const running = stepTrail(armed, start.x, start.y, false, 1).run;
  assert.equal(running.gateIndex, 1);
  assert.equal(stepTrail(running, gold.x, gold.y, false, 1).run.gateIndex, 1);
  const cleared = stepTrail(running, gold.x, gold.y, true, 5).run;
  const finalLeg = stepTrail(cleared, crossing.x, crossing.y, false, 5).run;
  assert.equal(stepTrail(finalLeg, finish.x, finish.y, true, 3).status, 'finished');
  assert.equal(stepTrail(finalLeg, finish.x, finish.y, true, 11).status, 'expired');
  for (const trail of Object.values(RIBBON_TRAILS)) {
    assert.ok(Object.keys(trail.reward).every((item) => Object.hasOwn(ITEMS, item)));
  }
});

test('v6 camp progress reloads and ignores invalid records', () => {
  const base = makeStubState();
  const source = { ...base, camp: { ...base.camp, provisions: 3, trailRecords: { lantern_loop: 8.25, marmalade_run: 36 } } };
  const restored = migrateSaveData(source, makeStubState);
  assert.equal(restored?.camp.provisions, 3);
  assert.deepEqual(restored?.camp.trailRecords, { lantern_loop: 8.25 });
});

test('classic core systems: phases, XP, crystal sight, discounts, crafting, hybrids, night Vibe, radio', () => {
  assert.equal(getPhaseFromDayTime(10).id, 'day');
  assert.equal(getPhaseFromDayTime(60).id, 'dusk');
  assert.equal(getPhaseFromDayTime(90).id, 'night');

  const pipXp = applyXpGain(0, 0, 0, 50, 'pip');
  assert.equal(pipXp.sp, 1);
  assert.equal(canSeeCrystals({ wobble: 22, gear: { partyHat: true, sweater: false, prismShades: false } }, new Set(), null), true);

  const geraldCost = getDiscountedCost({ bottlecap: 16 }, 'gerald', ['smooth_talker']);
  assert.equal(geraldCost.bottlecap, 10);

  const stylusRecipe = RECIPES.find((r) => r.id === 'radio_stylus')!;
  assert.equal(
    canCraftRecipe(stylusRecipe, { pear_lens: 1, cosmic_crystal: 1 }, true, { partyHat: false, sweater: false, prismShades: false }, ['hustle']).ok,
    true,
  );

  assert.equal(computeCropGrowthDelta(1, true, true, false, false), 4);
  assert.equal(
    checkHybridPair(
      { x: 0, y: 0, crop: 'shroom_crop' },
      [
        { type: 'mood_plot', x: 0, y: 0, crop: 'shroom_crop' },
        { type: 'mood_plot', x: 100, y: 0, crop: 'toast_crop' },
      ],
    ),
    'party_bagel',
  );
  assert.ok(computeNightVibeDelta(1, 'night', true, 'barnaby') > computeNightVibeDelta(1, 'night', true, 'pip'));

  const radioFlags = { ...DEFAULT_WORLD_FLAGS, radioRepaired: true, radioSolution: 'djmoss' as const };
  assert.ok(getRadioBroadcastLine(radioFlags, 3, 'djmoss')?.includes('DJ Moss'));
  assert.ok(QUESTS.some((q) => q.id === 'q_radio_unmelted'));
});

test('psychedelic trip profile differentiates Sober, Come-up, Euphoric Good Trip, Uneasy, and Bad Trip Melt Spiral', () => {
  // 1. Sober baseline
  const sober = computeTripProfile(95, 100, 0, {});
  assert.equal(sober.mood, 'sober');
  assert.equal(sober.badTripIntensity, 0);
  assert.equal(sober.euphoriaIntensity, 0);

  // 2. Come-up on a single mild brew with healthy Vibe
  const comeUp = computeTripProfile(88, 100, 32, { kaleido: 25 });
  assert.equal(comeUp.mood, 'come_up');
  assert.equal(comeUp.dominantTrip, 'kaleido');
  assert.ok(comeUp.euphoriaIntensity > 0);
  assert.equal(comeUp.badTripIntensity, 0);

  // 3. Euphoric Good Trip when Vibe is high & Wobble is high
  const goodTrip = computeTripProfile(90, 100, 74, { kaleido: 22, prism_refract: 30 });
  assert.equal(goodTrip.mood, 'euphoric');
  assert.equal(goodTrip.dominantTrip, 'prism_refract');
  assert.ok(goodTrip.euphoriaIntensity >= 0.5);
  assert.equal(goodTrip.badTripIntensity, 0);
  assert.equal(goodTrip.synergy?.id, 'starglass_fractal');

  // 4. Uneasy jitters when Vibe dips into the 40%s while Wobble is high
  const uneasy = computeTripProfile(43, 100, 66, { cosmic: 20 });
  assert.equal(uneasy.mood, 'uneasy');
  assert.ok(uneasy.badTripIntensity > 0 && uneasy.badTripIntensity < 0.45);

  // 5. Full Bad Trip / Melt Spiral when Vibe is LOW (<= 36%) and Wobble is TOO HIGH (>= 55)
  const badTrip = computeTripProfile(24, 100, 88, { velvet_fog: 32, kaleido: 20 });
  assert.equal(badTrip.mood, 'bad_trip');
  assert.ok(badTrip.badTripIntensity >= 0.7);
  assert.equal(badTrip.badTripTier, 3);
  assert.equal(badTrip.label, 'FULL MELT SPIRAL');

  // 6. Extreme Wobble >= 86 with dipping Vibe <= 52% also spirals unless Disco shields
  const extremeSpiral = computeTripProfile(48, 100, 92, { synesthesia: 25 });
  assert.equal(extremeSpiral.mood, 'bad_trip');

  // 7. Disco Overdrive shields against Bad Trip while Vibe >= 16%
  const discoShielded = computeTripProfile(25, 100, 92, { disco: 18, velvet_fog: 25 });
  assert.equal(discoShielded.mood, 'euphoric');
  assert.equal(discoShielded.badTripIntensity, 0);

  // 8. Prism Absinthe enables crystal sight & all 8 substances have distinct optical summaries
  assert.equal(
    canSeeCrystals({ wobble: 10, gear: { partyHat: false, sweater: false, prismShades: false } }, new Set(['prism_refract']), null),
    true,
  );
  const allTripIds = Object.keys(TRIP_VISUAL_META);
  assert.equal(allTripIds.length, 8);
  const summaries = new Set(Object.values(TRIP_VISUAL_META).map((m) => m.effectSummary));
  assert.equal(summaries.size, 8, 'Every psychedelic substance must have a distinct perceptual summary');
});

test('pharmacokinetic trip stages, cross-trip synergies, 3-tier bad trip escalation, and Dreamcatcher calming aura', () => {
  // 1. 3-stage pharmacokinetic curve: Onset (0..22%), Peak (22..74%), Afterglow (74..100%)
  const onset = computeTripStage(27, 30); // elapsed 10%
  assert.equal(onset.stage, 'onset');
  assert.ok(onset.factor > 0.35 && onset.factor < 0.9);

  const peak = computeTripStage(15, 30); // elapsed 50%
  assert.equal(peak.stage, 'peak');
  assert.ok(peak.factor >= 1.0);

  const afterglow = computeTripStage(4, 30); // elapsed 86.7%
  assert.equal(afterglow.stage, 'afterglow');
  assert.ok(afterglow.factor < 0.78 && afterglow.factor >= 0.35);

  // 2. Cross-Trip Synergies detect valid pairs cleanly
  assert.equal(TRIP_SYNERGIES.length, 5);
  assert.equal(detectTripSynergy({ kaleido: 20, prism_refract: 25 })?.id, 'starglass_fractal');
  assert.equal(detectTripSynergy({ cosmic: 20, chrono: 18 })?.id, 'astral_timefold');
  assert.equal(detectTripSynergy({ velvet_fog: 22, kaleido: 18 })?.id, 'fever_tapestry');
  assert.equal(detectTripSynergy({ synesthesia: 15, disco: 15 })?.id, 'hyper_chord');
  assert.equal(detectTripSynergy({ floaty: 16, cosmic: 20 })?.id, 'nebula_drift');
  assert.equal(detectTripSynergy({ kaleido: 20 }), null);

  // 3. Starglass Fractal boosts euphoria & embeds synergy in TripProfile
  const starglass = computeTripProfile(85, 100, 68, { kaleido: 18, prism_refract: 18 }, { kaleido: 32, prism_refract: 34 }, false);
  assert.equal(starglass.synergy?.id, 'starglass_fractal');
  assert.equal(starglass.stage, 'peak');
  assert.ok(starglass.euphoriaIntensity >= 0.7);

  // 4. 3-tier Bad Trip escalation (Tier 1 Uneasy, Tier 2 Paranoia, Tier 3 Full Melt Spiral)
  const tier1 = computeTripProfile(43, 100, 64, { cosmic: 16 }, { cosmic: 32 }, false);
  assert.equal(tier1.badTripTier, 1);

  const tier2 = computeTripProfile(32, 100, 62, { velvet_fog: 20 }, { velvet_fog: 34 }, false);
  assert.equal(tier2.badTripTier, 2);

  const tier3 = computeTripProfile(18, 100, 92, { velvet_fog: 20, kaleido: 16 }, { velvet_fog: 34, kaleido: 32 }, false);
  assert.equal(tier3.badTripTier, 3);
  assert.equal(tier3.label, 'FULL MELT SPIRAL');

  // 5. Velvet Dreamcatcher (nearCalmingTotem = true) suppresses Bad Trip back to calmed safety
  const calmed = computeTripProfile(20, 100, 90, { velvet_fog: 20 }, { velvet_fog: 34 }, true);
  assert.notEqual(calmed.mood, 'bad_trip');
  assert.ok(calmed.badTripIntensity <= 0.3);
});

test('Pass 1: Fishing FSM, Mirror Minnow lamp-reflection disturbance/reform, and Camp Supper evaluation', () => {
  // 1. Reflection intact vs broken by passing ferry / drifting plank, then reforms
  const calmRef = computeDockReflectionState(1.0, 1, false);
  assert.equal(calmRef.disturbanceActive, false);
  assert.equal(calmRef.minnowVisible, true);
  assert.ok(calmRef.reflectionIntegrity >= 0.9);

  const wakeRef = computeDockReflectionState(11.8, 1, false); // drifting plank crosses 10.2..13.6
  assert.equal(wakeRef.disturbanceActive, true);
  assert.equal(wakeRef.disturbanceKind, 'plank');
  assert.equal(wakeRef.minnowVisible, false);

  const ferryWake = computeDockReflectionState(11.8, 1, true);
  assert.equal(ferryWake.disturbanceKind, 'ferry');

  const reformedRef = computeDockReflectionState(14.8, 1, false);
  assert.equal(reformedRef.disturbanceActive, false);
  assert.equal(reformedRef.minnowVisible, true);

  // 2. Deterministic Fishing FSM: casting -> waiting -> nibble_1 -> nibble_2 -> bite -> tension -> landed
  let sess = startFishingCast(
    createIdleFishingSession(false),
    1,
    1,
    calmRef.reflectionIntegrity,
    {
      usingPrismReel: false,
      hasBellLure: false,
      baitId: 'fizz_berry',
      currentReaderPerk: false,
      stillwaterPerk: false,
    },
  );
  assert.equal(sess.phase, 'casting');
  assert.equal(sess.targetFish, 'mirror_minnow');

  const seenPhases = new Set<string>([sess.phase]);
  for (let i = 0; i < 400 && sess.phase !== 'bite'; i++) {
    const step = stepFishingSession(sess, 0.05, {
      reflectionIntegrity: 1,
      currentReaderPerk: false,
      hasBellLure: false,
    });
    sess = step.next;
    seenPhases.add(sess.phase);
  }
  assert.ok(seenPhases.has('waiting'));
  assert.ok(seenPhases.has('nibble_1'));
  assert.ok(seenPhases.has('nibble_2'));
  assert.ok(seenPhases.has('bite'));

  // Hook on bite!
  const hooked = triggerFishingHookOrReel(sess, true);
  assert.equal(hooked.hooked, true);
  assert.equal(hooked.next.phase, 'tension');
  sess = hooked.next;

  // Reel during calm, give slack during pull until landed
  let landedFish: string | null = null;
  for (let i = 0; i < 400 && sess.phase === 'tension'; i++) {
    const shouldReel = !sess.fishPulling && sess.tension < 72;
    sess = { ...sess, reelHeld: shouldReel };
    const step = stepFishingSession(sess, 0.05, {
      reflectionIntegrity: 1,
      currentReaderPerk: false,
      hasBellLure: false,
    });
    sess = step.next;
    if (step.events.landedFish) landedFish = step.events.landedFish;
  }
  assert.equal(landedFish, 'mirror_minnow');
  assert.equal(sess.phase, 'landed');

  // 3. Camp Supper setup evaluator works regardless of furniture placement order
  const incomplete = evaluateCampSupperStatus(
    [{ id: 't1', type: 'camp_table', x: 0, y: 0, crop: null }],
    { perch_chowder: 1 },
  );
  assert.equal(incomplete.hasTable, true);
  assert.equal(incomplete.hasBenchNearTable, false);
  assert.equal(incomplete.readyToServe, false);

  const complete = evaluateCampSupperStatus(
    [
      { id: 't1', type: 'camp_table', x: 0, y: 0, crop: null },
      { id: 'b1', type: 'bench', x: 45, y: 12, crop: null },
      { id: 'l1', type: 'lava_lamp', x: -55, y: 10, crop: null },
    ],
    { perch_chowder: 1 },
  );
  assert.equal(complete.hasTable, true);
  assert.equal(complete.hasBenchNearTable, true);
  assert.equal(complete.hasLampNearTable, true);
  assert.equal(complete.hasCookedSupper, true);
  assert.equal(complete.readyToServe, true);
});

test('Pass 2: 5-tier Disciplines, diminishing returns, Tier-3 Perks, Authoritative Recipe Gates, 12 leads, and Save Backup', () => {
  // 1. All 12 playable leads exist including Tilda Crease, Brin Bobbin, and all 6 Pass 3 leads
  assert.equal(Object.keys(CHARACTERS).length, 12);
  assert.ok(CHARACTERS.tilda && CHARACTERS.brin && CHARACTERS.solfa && CHARACTERS.bea && CHARACTERS.mossie);

  // 2. Discipline XP diminishing returns on identical repeated trivial actions vs distinct actions
  let discs = createInitialDisciplines();
  const firstGain = awardDisciplinePractice(discs.angling, 'cast_spool_perch', 20);
  discs = { ...discs, angling: firstGain.next };
  assert.equal(firstGain.gainedXp, 20);

  // Repeat identical action 3 more times — XP diminishes
  let lastAward = 20;
  for (let i = 0; i < 3; i++) {
    const rep = awardDisciplinePractice(discs.angling, 'cast_spool_perch', 20);
    discs = { ...discs, angling: rep.next };
    lastAward = rep.gainedXp;
  }
  assert.ok(lastAward < 20, 'Repeating identical trivial actions must yield diminishing XP');

  // Distinct action awards full XP & reaches Tier 3 Specialist
  const big1 = awardDisciplinePractice(discs.angling, 'land_mirror_minnow', 85);
  discs = { ...discs, angling: big1.next };
  assert.ok(discs.angling.tier >= 3);

  // Tier-3 perk selection works and rejects mismatched discipline perks
  const picked = selectDisciplinePerk(discs, 'angling', 'current_reader');
  assert.equal(picked.ok, true);
  discs = picked.next;
  assert.equal(discs.angling.perk, 'current_reader');

  // 3. Authoritative Recipe Gates (Prism Reel requires Workbench + Angling T3 + Fabrication T3)
  const prismReel = RECIPES.find((r) => r.id === 'prism_reel')!;
  assert.ok(prismReel);
  const noBench = canCraftRecipe(
    prismReel,
    { pear_lens: 2, reed_spool: 3, rubber_wood: 4 },
    false,
    { partyHat: false, sweater: false, prismShades: false, reedRod: false, prismReel: false },
    ['hustle'],
    { nearWorkbench: false, disciplines: discs },
  );
  assert.equal(noBench.ok, false);
  assert.equal(noBench.reason, 'need_workbench');

  const noFab = canCraftRecipe(
    prismReel,
    { pear_lens: 2, reed_spool: 3, rubber_wood: 4 },
    false,
    { partyHat: false, sweater: false, prismShades: false, reedRod: false, prismReel: false },
    ['hustle'],
    { nearWorkbench: true, disciplines: discs },
  );
  assert.equal(noFab.ok, false);
  assert.equal(noFab.reason, 'need_skill');

  // Advance Fabrication to Tier 3 and pick Lens Smith perk -> unlocks crafting!
  discs = { ...discs, fabrication: awardDisciplinePractice(discs.fabrication, 'craft_workbench', 110).next };
  discs = selectDisciplinePerk(discs, 'fabrication', 'lens_smith').next;
  const effCost = getEffectiveRecipeCost(prismReel, discs);
  assert.ok((effCost.pear_lens || 0) <= (prismReel.cost.pear_lens || 0));

  const readyPrism = canCraftRecipe(
    prismReel,
    { pear_lens: 2, reed_spool: 3, rubber_wood: 4 },
    false,
    { partyHat: false, sweater: false, prismShades: false, reedRod: false, prismReel: false },
    ['hustle'],
    { nearWorkbench: true, disciplines: discs },
  );
  assert.equal(readyPrism.ok, true);

  // Rigger perk boosts salvage refund
  const campTableRec = RECIPES.find((r) => r.id === 'camp_table')!;
  const baseRefund = getSalvageRefund(campTableRec, discs);
  discs = { ...discs, building: awardDisciplinePractice(discs.building, 'build_camp', 110).next };
  discs = selectDisciplinePerk(discs, 'building', 'rigger').next;
  const riggerRefund = getSalvageRefund(campTableRec, discs);
  assert.ok((riggerRefund.rubber_wood || 0) >= (baseRefund.rubber_wood || 0));

  // 4. Malformed save JSON preserves raw backup instead of wiping storage
  const store = new Map<string, string>();
  store.set(SAVE_KEY, '{corrupt_json:::');
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };
  const loadRes = safeLoadAndMigrate(mockStorage, makeStubState);
  assert.equal(loadRes.state, null);
  assert.equal(loadRes.backupPreserved, true);
  assert.equal(store.get(SAVE_BACKUP_KEY), '{corrupt_json:::');
});

test('Pass 3: outer regions, disciplines, Choir Irrigator, County Sync, and legacy v5 migration', () => {
  // 1. All 10 disciplines have 2 unique perks each (20 total unique perks)
  assert.equal(CORE_DISCIPLINE_IDS.length, 10);
  const allPerkIds = new Set<string>();
  for (const id of CORE_DISCIPLINE_IDS) {
    const def = DISCIPLINES[id];
    assert.ok(def, `Discipline ${id} must exist`);
    assert.equal(def.perks.length, 2);
    for (const pk of def.perks) allPerkIds.add(pk.id);
  }
  assert.equal(allPerkIds.size, 20, 'Every discipline perk ID must be globally unique');

  // 2. Choir Irrigator requires Workbench + Farming T4 + Acoustics T3
  const choirRec = RECIPES.find((r) => r.id === 'choir_irrigator')!;
  assert.ok(choirRec);
  assert.equal(choirRec.reqDisciplines?.farming, 4);
  assert.equal(choirRec.reqDisciplines?.acoustics, 3);
  let discs = createInitialDisciplines();
  discs = { ...discs, farming: awardDisciplinePractice(discs.farming, 'farm_mastery', 220).next };
  const blockedAcoustics = canCraftRecipe(
    choirRec,
    { bell_reed: 2, cosmic_crystal: 1, rubber_wood: 2 },
    false,
    { partyHat: false, sweater: false, prismShades: false, reedRod: false, prismReel: false },
    ['hustle'],
    { nearWorkbench: true, disciplines: discs },
  );
  assert.equal(blockedAcoustics.ok, false);
  assert.equal(blockedAcoustics.reason, 'need_skill');

  discs = { ...discs, acoustics: awardDisciplinePractice(discs.acoustics, 'tune_fork', 110).next };
  const unlockedChoir = canCraftRecipe(
    choirRec,
    { bell_reed: 2, cosmic_crystal: 1, rubber_wood: 2 },
    false,
    { partyHat: false, sweater: false, prismShades: false, reedRod: false, prismReel: false },
    ['hustle'],
    { nearWorkbench: true, disciplines: discs },
  );
  assert.equal(unlockedChoir.ok, true);

  // 3. Pass 3 regional impossible physics & muted-friendly timing cues
  const cavernsRes = getRegionPhysics(-9200, 700, 1.0, 'undertone_caverns', [], 0, 0, false);
  assert.ok(cavernsRes.timingCue && cavernsRes.timingCue.label.includes('Choir'));
  assert.ok(cavernsRes.speedMult > 1.0);

  const coastLow = getRegionPhysics(4100, -8400, 1.5, 'negative_coast', [], 0, 0, false);
  assert.ok(coastLow.timingCue && coastLow.timingCue.label.includes('Tide'));
  assert.ok(coastLow.speedMult >= 1.0);

  const allotLift = getRegionPhysics(4400, 8400, 1.0, 'inverted_allotments', [], 0, 0, false);
  assert.ok(allotLift.timingCue && allotLift.timingCue.label.includes('Windlift'));
  assert.ok(allotLift.speedMult > 1.0);

  // 4. Personalized County Sync status: Peaceful Route vs Combative Route + all 12 lead epilogues
  const restoredFlags = {
    ...DEFAULT_WORLD_FLAGS,
    undertoneForkTuned: true,
    negativePressRestored: true,
    invertedGutterDirected: true,
  };
  const peacefulSync = computeCountySyncStatus(
    restoredFlags,
    { ...makeStubState().stats, enemiesBonked: 0 },
    2,
    6,
    'bea',
  );
  assert.equal(peacefulSync.restoredCount, 3);
  assert.equal(peacefulSync.totalRestorations, 9);
  assert.equal(peacefulSync.readyForBroadcast, true);
  assert.equal(peacefulSync.peacefulRoute, true);
  assert.ok(peacefulSync.leadEpilogue.length > 20);
  assert.ok(peacefulSync.broadcastLines.some((l) => l.includes('Peaceful Route')));

  const livelySync = computeCountySyncStatus(
    restoredFlags,
    { ...makeStubState().stats, enemiesBonked: 3 },
    1,
    4,
    'solfa',
  );
  assert.equal(livelySync.peacefulRoute, false);
  assert.notEqual(livelySync.leadEpilogue, peacefulSync.leadEpilogue);

  // A v5 migration preserves existing state and initializes Pass 3 flags and disciplines.
  const v5Save = {
    ...makeStubState('tilda', 777),
    version: 5,
    disciplines: {
      farming: { xp: 45, tier: 2, perk: null, recentActions: [] },
      angling: { xp: 10, tier: 1, perk: null, recentActions: [] },
    },
  };
  const migrated = migrateSaveData(v5Save, makeStubState);
  assert.ok(migrated);
  assert.ok(migrated.disciplines);
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.player.charId, 'tilda');
  assert.equal(migrated.disciplines.farming.tier, 2);
  assert.equal(migrated.disciplines.acoustics.tier, 1);
  assert.equal(migrated.disciplines.hospitality.tier, 1);
  assert.equal(migrated.worldFlags.undertoneForkTuned, false);
  assert.equal(migrated.worldFlags.allNightBroadcastHosted, false);
});

test('v7 preferences migrate v6 effects and preserve saved world collections and progress', () => {
  const legacy = {
    ...makeStubState(),
    version: 6,
    day: 8,
    reducedMotion: true,
    audioSettings: { music: 0, effects: 0.4, flashFree: false, effectStrength: 0.42, master: -1 },
    inv: { spool_perch: 2 },
    objects: [{ id: 'foraged_berry', x: 10, y: 24, respawn: 14 }],
    creatures: [],
  };
  const migrated = migrateSaveData(legacy, makeStubState);
  assert.ok(migrated);
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.day, 8);
  assert.deepEqual(migrated.inv, { spool_perch: 2 });
  assert.deepEqual(migrated.objects, legacy.objects);
  assert.deepEqual(migrated.creatures, []);
  assert.equal(migrated.reducedMotionOverride, true);
  assert.deepEqual(migrated.audioSettings, {
    ...DEFAULT_AUDIO_SETTINGS, music: 0, effects: 0.4, flashFree: false, perceptionIntensity: 0.42, master: 0,
  });
  assert.deepEqual(migrateSaveData(migrated, makeStubState), migrated);
});

test('missing settings follow the system and malformed saves leave the original recoverable', () => {
  const buildReducedMotion = () => ({ ...makeStubState(), reducedMotion: true });
  const minimal = migrateSaveData({ player: {} }, buildReducedMotion);
  assert.ok(minimal);
  assert.equal(minimal.reducedMotionOverride, null);
  assert.equal(minimal.reducedMotion, true);
  assert.deepEqual(minimal.audioSettings, DEFAULT_AUDIO_SETTINGS);
  const map = new Map<string, string>();
  const storage = { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } };
  assert.deepEqual(safeLoadAndMigrate(storage, makeStubState), { state: null, backupPreserved: false });
  map.set(SAVE_KEY, '{"version":6,');
  assert.deepEqual(safeLoadAndMigrate(storage, makeStubState), { state: null, backupPreserved: true, unreadable: true });
  assert.equal(map.get(SAVE_KEY), map.get(SAVE_BACKUP_KEY));
});

test('Completion: Furniture reachability, camp shelter, recoverable melt satchels, grounded regional events, and Pass 3 perk mechanics', () => {
  // 1. Furniture reachability validation keeps mailboxes, quest landmarks & walkways clear
  const mailboxes = [{ x: -145, y: -145, biomeName: 'Giggle-Grove' }];
  const existing = [{ id: 'b1', x: 100, y: 100 }];

  const blockedMailbox = validateBuildingPlacement(-130, -140, 'camp_awning', existing, mailboxes, WORLD_FEATURES);
  assert.equal(blockedMailbox.ok, false);
  assert.ok(blockedMailbox.reason?.includes('Mailbox'));

  const blockedFeature = validateBuildingPlacement(-70, -195, 'camp_awning', existing, mailboxes, WORLD_FEATURES);
  assert.equal(blockedFeature.ok, false);
  assert.ok(blockedFeature.reason?.includes('unobstructed'));

  const blockedOverlap = validateBuildingPlacement(112, 108, 'specimen_cabinet', existing, mailboxes, WORLD_FEATURES);
  assert.equal(blockedOverlap.ok, false);
  assert.ok(blockedOverlap.reason?.includes('Overlaps'));

  // Ignoring self when moving works cleanly
  const moveSelfOk = validateBuildingPlacement(112, 108, 'camp_awning', existing, mailboxes, WORLD_FEATURES, 'b1');
  assert.equal(moveSelfOk.ok, true);

  // 2. Explainable Camp Shelter detection + 50% night chill mitigation
  const openSky = evaluateCampShelter(200, 200, []);
  assert.equal(openSky.sheltered, false);

  const awningShelter = evaluateCampShelter(200, 200, [{ type: 'camp_awning', x: 260, y: 210 }]);
  assert.equal(awningShelter.sheltered, true);
  assert.ok(awningShelter.reason.includes('Awning'));

  const workbenchShelter = evaluateCampShelter(200, 200, [
    { type: 'workbench', x: 240, y: 210 },
    { type: 'dock_lamp', x: 260, y: 220 },
  ]);
  assert.equal(workbenchShelter.sheltered, true);

  const unshelteredDrain = computeNightVibeDelta(1, 'night', false, 'pip');
  const shelteredDrain = computeNightVibeDelta(1, 'night', false, 'pip', { sheltered: true });
  assert.equal(shelteredDrain, unshelteredDrain * 0.5);

  // 3. Melt recovery story & recoverable satchels across Relaxed / Standard / Harsh
  const inv = { fizz_berry: 6, rubber_wood: 4, bottlecap: 20, seed_bell_reed: 2, broadcast_pin: 1 };
  const relaxed = buildMeltRecoveryOutcome(inv, 'relaxed', -500, 400, 2, 'Vinyl Desert');
  assert.equal(relaxed.droppedSatchel, null);
  assert.equal(relaxed.keptInv.fizz_berry, 6);

  const standard = buildMeltRecoveryOutcome(inv, 'standard', -500, 400, 2, 'Vinyl Desert');
  assert.ok(standard.droppedSatchel);
  assert.equal(standard.droppedSatchel.items.fizz_berry, 3);
  assert.equal(standard.keptInv.fizz_berry, 3);
  assert.equal(standard.keptInv.bottlecap, 20);
  assert.equal(standard.keptInv.seed_bell_reed, 2);
  assert.equal(standard.keptInv.broadcast_pin, 1);

  const harsh = buildMeltRecoveryOutcome(inv, 'harsh', -500, 400, 2, 'Vinyl Desert');
  assert.ok(harsh.droppedSatchel);
  assert.equal(harsh.advanceNextMorning, true);
  assert.ok((harsh.droppedSatchel.items.fizz_berry || 0) >= 3);

  // 4. State-grounded regional events respect Day 1 onboarding guard, world state, and cooldown
  const day1Blocked = evaluateRegionalEventTrigger(1, DEFAULT_WORLD_FLAGS, { carbon_copy_delta: 'visited' }, null, 2);
  assert.equal(day1Blocked, null);

  const unvisitedBlocked = evaluateRegionalEventTrigger(3, DEFAULT_WORLD_FLAGS, { giggle_grove: 'visited' }, null, 2);
  assert.equal(unvisitedBlocked, null);

  const deltaEv = evaluateRegionalEventTrigger(3, DEFAULT_WORLD_FLAGS, { carbon_copy_delta: 'visited' }, null, 2);
  assert.ok(deltaEv);
  assert.equal(deltaEv.id, 'delta_ink_swell');
  assert.equal(deltaEv.eyewitnessName, 'Oona Offset');

  const cooldownBlocked = evaluateRegionalEventTrigger(3, DEFAULT_WORLD_FLAGS, { carbon_copy_delta: 'visited' }, null, 5);
  assert.equal(cooldownBlocked, null);

  // 5. Pass 3 perk effects: lantern_strider, echo_listener, warm_welcome
  let discs = createInitialDisciplines();
  discs = {
    ...discs,
    wayfinding: { ...discs.wayfinding, tier: 3, perk: 'lantern_strider' },
    acoustics: { ...discs.acoustics, tier: 3, perk: 'echo_listener' },
    hospitality: { ...discs.hospitality, tier: 3, perk: 'warm_welcome' },
  };
  assert.equal(getGhostTimerDuration([], discs), 28);
  const cavernNormal = getRegionPhysics(-9200, 700, 5.8, 'undertone_caverns', [], 0, 0, false, false);
  const cavernEcho = getRegionPhysics(-9200, 700, 5.8, 'undertone_caverns', [], 0, 0, false, true);
  assert.equal(cavernNormal.timingCue?.label.includes('Quiet'), true);
  assert.equal(cavernEcho.timingCue?.label.includes('Fading') || cavernEcho.timingCue?.label.includes('Echo Listener'), true);
  const discounted = getEffectiveBarterCost({ bottlecap: 20, gossip_slip: 1 }, discs);
  assert.equal(discounted.bottlecap, 17);
  assert.equal(discounted.gossip_slip, 1);
});
