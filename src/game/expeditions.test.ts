import assert from 'node:assert/strict';
import test from 'node:test';
import { awardDisciplinePractice, createInitialDisciplines } from './disciplines.ts';
import {
  expeditionActionAt, HOLLOW_PACK, HOLLOW_QUARTZ, HOLLOW_RIBBONS, hollowPressure, hollowReady, MILLPOND_BANKS,
  MILLPOND_RIBBONS, millpondReady, MINT_BEDS, newExpeditions, restorationPercent,
} from './expeditions.ts';
import { createIdleFishingSession, startFishingCast, stepFishingSession, triggerFishingHookOrReel } from './fishing.ts';
import { selectTripMotif } from './tripFx.ts';
import type { TripId, TripSynergyId } from './types.ts';

test('Millpond tracks each physical objective once, with fresh mint after restoration', () => {
  const progress = newExpeditions();
  const { millpond } = progress;
  const fork = MILLPOND_RIBBONS[0];
  assert.equal(expeditionActionAt(progress, fork.x, fork.y), null);
  millpond.status = 'active';
  assert.equal(expeditionActionAt(progress, fork.x, fork.y)?.type, 'millpond_ribbon');
  millpond.ribbons = 3;
  assert.equal(expeditionActionAt(progress, fork.x, fork.y), null);
  millpond.perchLanded = true;
  assert.equal(millpondReady(millpond), false);
  millpond.mint = 3;
  assert.equal(millpondReady(millpond), true);
  millpond.status = 'restored';
  millpond.mintDay = 3;
  millpond.dailyMint = 3;
  const herb = MINT_BEDS[0];
  assert.equal(expeditionActionAt(progress, herb.x, herb.y, 3), null);
  assert.equal(expeditionActionAt(progress, herb.x, herb.y, 4)?.type, 'mint');
  assert.equal(restorationPercent(progress), 10);
});

test('both Millpond banks use the established line and hook rules with different waiting times', () => {
  const times: number[] = [];
  for (const millpond of MILLPOND_BANKS) {
    const day = { usingPrismReel: false, hasBellLure: false, baitId: '', currentReaderPerk: false, stillwaterPerk: false, millpond };
    let session = startFishingCast(createIdleFishingSession(), 1, 1, 1, day);
    const opts = { reflectionIntegrity: 0, currentReaderPerk: false, hasBellLure: false };
    assert.equal(session.targetFish, 'reed_perch');
    const dt = 1 / 60;
    let ticks = 0;
    for (; ticks < 600 && session.phase !== 'bite'; ticks++) session = stepFishingSession(session, dt, opts).next;
    times.push(ticks);
    const hook = triggerFishingHookOrReel(session, true);
    assert.equal(hook.hooked, true);
    session = hook.next;
    for (let i = 0; i < 1200 && session.active; i++) {
      session.reelHeld = !session.fishPulling;
      session = stepFishingSession(session, dt, opts).next;
    }
    assert.equal(session.lastOutcome, 'landed');
  }
  assert.ok(times[1] > times[0] + 60);
});

test('Hollow escalates in phases, rewards marked paths, and has a real escort gate', () => {
  const progress = newExpeditions();
  const { hollow } = progress;
  hollow.status = 'active';
  assert.equal(expeditionActionAt(progress, HOLLOW_PACK.x, HOLLOW_PACK.y)?.type, 'pack');
  HOLLOW_QUARTZ.forEach((site, i) => {
    assert.equal(expeditionActionAt(progress, site.x, site.y)?.index, i);
  });
  assert.equal(HOLLOW_RIBBONS.length, 3);
  hollow.quartz = 7;
  hollow.ribbons = 3;
  hollow.packed = true;
  assert.equal(hollowReady(hollow), false);
  hollow.escorted = true;
  assert.equal(hollowReady(hollow), true);
  assert.ok(hollowPressure(35, false, 'hauler', false) > hollowPressure(20, false, 'anchor', true));
  assert.equal(hollowPressure(35, true, 'anchor', false), hollowPressure(35, false, 'anchor', false) * 0.75);
  hollow.status = 'restored';
  progress.millpond.status = 'restored';
  assert.equal(restorationPercent(progress), 25);
});

test('all baseline brews and five synergies select their motifs', () => {
  const brews: TripId[] = ['kaleido', 'floaty', 'synesthesia', 'chrono', 'cosmic', 'disco', 'prism_refract', 'velvet_fog'];
  for (const brew of brews) assert.equal(selectTripMotif(new Set([brew]), brew, null), brew);
  const synergies: Array<[TripSynergyId, TripId]> = [
    ['astral_timefold', 'chrono'], ['hyper_chord', 'disco'], ['starglass_fractal', 'prism_refract'],
    ['fever_tapestry', 'velvet_fog'], ['nebula_drift', 'floaty'],
  ];
  for (const [synergy, base] of synergies) assert.equal(selectTripMotif(new Set(brews), base, synergy), base);
  assert.equal(selectTripMotif(new Set(), null, null), null);
});

test('repeated actions fade out daily and simulated single loops stay below 1.25× varied XP/min', () => {
  const defaults = createInitialDisciplines();
  let repeated = awardDisciplinePractice(defaults.angling, 'catch_reed_perch', 30, 1);
  assert.equal(repeated.gainedXp, 30);
  repeated = awardDisciplinePractice(repeated.next, 'catch_reed_perch', 30, 1);
  assert.equal(repeated.gainedXp, 2);
  assert.equal(awardDisciplinePractice(repeated.next, 'catch_reed_perch', 30, 1).gainedXp, 0);
  assert.equal(awardDisciplinePractice(repeated.next, 'catch_reed_perch', 30, 2).gainedXp, 11);
  for (let seed = 1; seed <= 128; seed++) {
    let state = seed;
    const draw = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    let farm = defaults.angling;
    let varied = { ...defaults };
    for (let seconds = 0; seconds < 108; seconds += 6 + draw() * 8) {
      farm = awardDisciplinePractice(farm, 'catch_spool_perch', 30, 1).next;
    }
    const completions = [
      ['angling', 'catch_reed_perch', 30],
      ['wayfinding', 'discover_millpond', 24],
      ['farming', 'harvest_bell_reed', 28],
      ['wayfinding', 'millpond_restored', 38],
    ] as const;
    for (const [discipline, action, xp] of completions) {
      if (draw() > (action === 'millpond_restored' ? 0.2 : 0.07)) {
        varied[discipline] = awardDisciplinePractice(varied[discipline], action, xp, 1).next;
      }
    }
    const completed = Object.values(varied).reduce((sum, category) => sum + category.xp, 0);
    if (completed >= 28) assert.ok(farm.xp / completed <= 1.25);
  }
});
