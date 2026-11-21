import type { Waypoint } from './types.ts';

export const MILLPOND = { x: 1390, y: 290, label: 'The Singing Millpond' };
export const MILLPOND_BANKS = [
  { x: 1455, y: 375, waterX: 1440, waterY: 322, label: 'Sunlit Reed Bank', shaded: false },
  { x: 1280, y: 358, waterX: 1322, waterY: 320, label: 'Shaded Willow Bank', shaded: true },
] as const;
export const MILLPOND_RIBBONS = [
  { x: 690, y: 220, label: 'Camp Road Fork' },
  { x: 1060, y: 266, label: 'Willow Turn' },
] as const;
export const MINT_BEDS = [
  { x: 1315, y: 435, label: 'Cool-Mint' },
  { x: 1545, y: 364, label: 'Cool-Mint' },
] as const;

export const HOLLOW = { x: -8670, y: 1460, label: 'Red-Chalk Hollow' };
export const HOLLOW_SHELTER = { x: -7950, y: 1540, label: 'Sheltered Hollow Trailhead' };
export const HOLLOW_RIBBONS = [
  { x: -8015, y: 1540, label: 'Trailhead Ribbon' },
  { x: -8260, y: 1525, label: 'Hollow Fork Ribbon' },
  { x: -8560, y: 1440, label: 'Waterwheel Ribbon' },
] as const;
export const HOLLOW_QUARTZ = [
  { x: -8460, y: 1220, label: 'Chalk-Quartz' },
  { x: -8790, y: 1325, label: 'Chalk-Quartz' },
  { x: -8685, y: 1705, label: 'Chalk-Quartz' },
] as const;
export const HOLLOW_PACK = { x: -8875, y: 1565, label: 'Stalled Companion' };
export const HOLLOW_COMPANION_HOME = { x: -8040, y: 1502, label: 'Companion at the Trailhead' };
export const GROVE_CAMP = { x: -145, y: -145, label: 'Mailbox Square Camp' };
export const HOLLOW_ZONE_RADIUS = 880;
export const HOLLOW_SAFE_RADIUS = 215;
export const FIELD_ACTION_RADIUS = 95;

type EncounterStatus = 'unstarted' | 'active' | 'restored';
export type HollowRole = 'hauler' | 'anchor';

export interface ExpeditionProgress {
  millpond: {
    status: EncounterStatus;
    ribbons: number;
    mint: number;
    mintDay: number;
    dailyMint: number;
    perchLanded: boolean;
  };
  hollow: {
    status: EncounterStatus;
    role: HollowRole;
    day: number;
    elapsed: number;
    ribbons: number;
    quartz: number;
    bankedQuartz: number;
    packed: boolean;
    sharedDraught: boolean;
    escorted: boolean;
    escortX: number;
    escortY: number;
  };
}

export function newExpeditions(): ExpeditionProgress {
  return {
    millpond: { status: 'unstarted', ribbons: 0, mint: 0, mintDay: 0, dailyMint: 0, perchLanded: false },
    hollow: {
      status: 'unstarted', role: 'anchor', day: 0, elapsed: 0, ribbons: 0, quartz: 0, bankedQuartz: 0,
      packed: false, sharedDraught: false, escorted: false, escortX: HOLLOW_PACK.x, escortY: HOLLOW_PACK.y,
    },
  };
}

export function hasSite(mask: number, index: number): boolean {
  return (mask & (1 << index)) !== 0;
}

export function countSites(mask: number): number {
  let bits = 0;
  for (; mask; mask >>>= 1) bits += mask & 1;
  return bits;
}

export function within(x: number, y: number, target: Pick<Waypoint, 'x' | 'y'>, radius: number): boolean {
  return Math.hypot(x - target.x, y - target.y) <= radius;
}

export function millpondBankAt(x: number, y: number) {
  return MILLPOND_BANKS.find((bank) => within(x, y, bank, 82));
}

export function millpondReady(progress: ExpeditionProgress['millpond']): boolean {
  return progress.perchLanded && countSites(progress.ribbons) >= 2 && countSites(progress.mint) >= 2;
}

export function hollowReady(progress: ExpeditionProgress['hollow']): boolean {
  return countSites(progress.quartz) >= 3 && countSites(progress.ribbons) >= 2 && progress.packed && progress.escorted;
}

export function hollowPressure(elapsed: number, restored: boolean, role: HollowRole, onTrail: boolean): number {
  const exposure = elapsed < 12 ? 0.65 : elapsed < 32 ? 1.5 : 2.7;
  return exposure * (restored ? 0.75 : 1) * (role === 'hauler' ? 1.18 : 1) * (onTrail ? 0.7 : 1);
}

export function restorationPercent(progress: ExpeditionProgress): number {
  return (progress.millpond.status === 'restored' ? 10 : 0) + (progress.hollow.status === 'restored' ? 15 : 0);
}

export type ExpeditionAction = { type: 'millpond_ribbon' | 'mint' | 'hollow_ribbon' | 'quartz' | 'pack'; index: number; point: Waypoint };

export function expeditionActionAt(progress: ExpeditionProgress, x: number, y: number, day = 0): ExpeditionAction | null {
  const mintMask = progress.millpond.status === 'restored'
    ? progress.millpond.mintDay === day ? progress.millpond.dailyMint : 0
    : progress.millpond.mint;
  const entries = [
    [progress.millpond.status === 'active', 'millpond_ribbon', MILLPOND_RIBBONS, progress.millpond.ribbons],
    [progress.millpond.status !== 'unstarted', 'mint', MINT_BEDS, mintMask],
    [progress.hollow.status === 'active', 'hollow_ribbon', HOLLOW_RIBBONS, progress.hollow.ribbons],
    [progress.hollow.status === 'active', 'quartz', HOLLOW_QUARTZ, progress.hollow.quartz],
    [progress.hollow.status === 'active', 'pack', [HOLLOW_PACK], Number(progress.hollow.packed)],
  ] as const;
  let best: ExpeditionAction | null = null;
  let distance = FIELD_ACTION_RADIUS;
  for (const [active, type, points, mask] of entries) {
    if (!active) continue;
    points.forEach((point, index) => {
      const gap = Math.hypot(x - point.x, y - point.y);
      if (gap < distance && !hasSite(mask, index)) {
        best = { type, index, point };
        distance = gap;
      }
    });
  }
  return best;
}

export function actionLabel(action: ExpeditionAction): string {
  switch (action.type) {
    case 'millpond_ribbon':
    case 'hollow_ribbon': return '[Space] Tie a Ribbon Stake';
    case 'mint': return '[Space] Gather Cool-Mint';
    case 'quartz': return '[Space] Gather Chalk-Quartz';
    case 'pack': return '[Space] Collect the Supply Pack';
  }
}
