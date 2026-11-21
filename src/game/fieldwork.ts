import type { BiomeId, PhaseId, Waypoint } from './types.ts';

export const CAMP_JOBS = {
  forage: { name: 'Forage', description: 'Bring back Timber and a Fizz Berry.' },
  tend: { name: 'Tend plots', description: 'Advance every planted crop within 280 units of camp.' },
  watch: { name: 'Keep watch', description: 'Reduce weather pressure around camp through the night.' },
  relay: { name: 'Supply Relay', description: 'The restored Waterwheel supports a supply shift yielding 3 Timber and 2 berries.' },
};

export type CampJob = keyof typeof CAMP_JOBS;
export type TrailId = 'lantern_loop' | 'marmalade_run';
export type WeatherId = 'clear' | 'paper_squall' | 'emberfall' | 'hush_dew';
export const MAX_CAMP_PROVISIONS = 12;

export interface CampProgress {
  anchorId: string | null;
  provisions: number;
  jobs: Partial<Record<string, CampJob>>;
  lastShiftDay: number;
  wardDay: number;
  report: string[];
  trailRecords: Partial<Record<TrailId, number>>;
}

export function createCampProgress(): CampProgress {
  return { anchorId: null, provisions: 0, jobs: {}, lastShiftDay: 0, wardDay: 0, report: [], trailRecords: {} };
}

export const WEATHER = {
  clear: { name: 'Clear Skies', color: '#ffd166', description: 'Good conditions for a long expedition.', phase: 'any' },
  paper_squall: { name: 'Paper Squall', color: '#9ae1f1', description: 'From dusk, wind drains extra Vibe away from warm shelter.', phase: 'evening' },
  emberfall: { name: 'Emberfall', color: '#ffa165', description: 'In daylight, drifting embers burn through Munch faster. Stay near shelter or pack a meal.', phase: 'day' },
  hush_dew: { name: 'Hush Dew', color: '#c0a7ff', description: 'From dusk, the air steadies Wobble and holds warmth longer.', phase: 'evening' },
};

const WEATHER_CYCLE: WeatherId[] = ['clear', 'hush_dew', 'paper_squall', 'emberfall', 'clear'];

export function getCountyWeather(seed: number, day: number): WeatherId {
  if (day <= 1) return 'clear';
  const pattern = (seed >>> 0) % WEATHER_CYCLE.length;
  return WEATHER_CYCLE[(pattern + day - 2) % WEATHER_CYCLE.length];
}

export function isWeatherActive(weather: WeatherId, phase: PhaseId): boolean {
  const timing = WEATHER[weather].phase;
  return timing === 'day' ? phase === 'day' : timing === 'evening' && phase !== 'day';
}

export function getWeatherPressure(weather: WeatherId, phase: PhaseId, protectedAtCamp: boolean) {
  if (!isWeatherActive(weather, phase)) return { vibe: 0, munch: 0, wobble: 0 };
  const exposure = protectedAtCamp ? 0.2 : 1;
  return {
    vibe: weather === 'paper_squall' ? -0.58 * exposure : weather === 'hush_dew' ? 0.28 : 0,
    munch: weather === 'emberfall' ? -0.36 * exposure : 0,
    wobble: weather === 'hush_dew' ? -0.6 : 0,
  };
}

export function resolveCampShift(
  camp: CampProgress,
  day: number,
  companions: ReadonlyArray<{ id: string; name: string }>,
  conditions: { hasCamp: boolean; hasPlots: boolean; hasLamp: boolean; hasRelay: boolean },
) {
  const effects = { timber: 0, berries: 0, cropGrowth: 0 };
  if (camp.lastShiftDay >= day) return { camp, effects };

  const next = { ...camp, lastShiftDay: day, report: [] as string[] };
  for (const companion of companions) {
    const job = camp.jobs[companion.id];
    if (!job) continue;
    const blocker = !conditions.hasCamp ? 'mark a camp site in the ledger'
      : job === 'tend' && !conditions.hasPlots ? 'plant a crop near camp'
      : job === 'watch' && !conditions.hasLamp ? 'place a lamp near camp'
      : job === 'watch' && next.wardDay === day ? 'choose a job alongside the current watcher'
      : !next.provisions ? 'stock a camp ration' : null;
    if (blocker) {
      next.report.push(`${companion.name} is waiting. To start the shift, ${blocker}.`);
      continue;
    }

    next.provisions -= 1;
    if (job === 'forage') {
      const timber = conditions.hasRelay ? 3 : 2;
      effects.timber += timber;
      effects.berries += 1;
      next.report.push(`${companion.name} found ${timber} Timber and 1 Fizz Berry.`);
    } else if (job === 'tend') {
      const growth = conditions.hasRelay ? 14 : 9;
      effects.cropGrowth += growth;
      next.report.push(`${companion.name} tended the camp plots.`);
    } else if (job === 'relay') {
      effects.timber += 3;
      effects.berries += 2;
      next.report.push(`${companion.name} brought in a Waterwheel supply crate with 3 Timber and 2 Fizz Berries.`);
    } else {
      next.wardDay = day;
      next.report.push(`${companion.name} is watching the lamp through the night.`);
    }
  }
  return { camp: next, effects };
}

export interface TrailGate extends Waypoint {
  roll?: boolean;
}

export interface RibbonTrail {
  name: string;
  biome: BiomeId;
  seconds: number;
  reward: Record<string, number>;
  gates: readonly TrailGate[];
}

export const RIBBON_TRAILS: Record<TrailId, RibbonTrail> = {
  lantern_loop: {
    name: 'Lantern Loop',
    biome: 'giggle_grove',
    seconds: 20,
    reward: { bottlecap: 12, rubber_wood: 3, cosmic_crystal: 1 },
    gates: [
      { x: 150, y: 275, label: 'Lantern Loop start' },
      { x: 420, y: 460, label: 'Mushroom bend', roll: true },
      { x: 715, y: 250, label: 'Lantern crossing' },
      { x: 610, y: -100, label: 'Paper arch finish', roll: true },
    ],
  },
  marmalade_run: {
    name: 'Marmalade Run',
    biome: 'marmalade_flats',
    seconds: 24,
    reward: { bottlecap: 18, pop_toast: 3, hyper_fizz: 1 },
    gates: [
      { x: 3240, y: -285, label: 'Marmalade Run start' },
      { x: 3540, y: -40, label: 'Jam ridge', roll: true },
      { x: 3920, y: -225, label: 'Bubble meadow' },
      { x: 4250, y: -485, label: 'Copper ribbon', roll: true },
      { x: 4390, y: -835, label: 'Fountain finish' },
    ],
  },
};

export interface TrailRun {
  id: TrailId;
  gateIndex: number;
  elapsed: number;
}

export function stepTrail(run: TrailRun, x: number, y: number, rolling: boolean, dt: number) {
  const route = RIBBON_TRAILS[run.id];
  const gate = route.gates[run.gateIndex];
  const elapsed = run.elapsed + (run.gateIndex > 0 ? dt : 0);
  if (elapsed > route.seconds) return { status: 'expired' as const, run };
  const reached = Math.hypot(x - gate.x, y - gate.y) <= 68 && (!gate.roll || rolling);
  const next = { ...run, elapsed, gateIndex: run.gateIndex + Number(reached) };
  return { status: next.gateIndex === route.gates.length ? 'finished' as const : 'active' as const, run: next };
}
