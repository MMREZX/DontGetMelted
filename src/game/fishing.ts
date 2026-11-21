import type { Building, CampSupperStatus, FishId, FishingSession } from './types.ts';

// Delta Public Bank coordinates (Carbon Copy Delta southern cove along Public Records Ferry Line)
export const DELTA_BANK_X = -2150;
export const DELTA_BANK_Y = -7650;

// 3 movable dock lamp slots along the timber dry dock
export const DOCK_LAMP_SLOTS: ReadonlyArray<{ slot: 0 | 1 | 2; label: string; x: number; y: number; waterX: number; waterY: number }> = [
  { slot: 0, label: 'West Piling', x: DELTA_BANK_X - 88, y: DELTA_BANK_Y - 14, waterX: DELTA_BANK_X - 96, waterY: DELTA_BANK_Y - 82 },
  { slot: 1, label: 'Center Reflection Pool', x: DELTA_BANK_X, y: DELTA_BANK_Y - 16, waterX: DELTA_BANK_X, waterY: DELTA_BANK_Y - 92 },
  { slot: 2, label: 'East Cove', x: DELTA_BANK_X + 88, y: DELTA_BANK_Y - 14, waterX: DELTA_BANK_X + 94, waterY: DELTA_BANK_Y - 80 },
];

export interface FishDef {
  id: FishId;
  name: string;
  habitat: string;
  behavior: string;
  accent: string;
  pullStrength: number; // tension gain while pulling
  reelSpeed: number; // progress speed while reeling calm fish
  biteWindow: number; // seconds to hook after decisive dive
}

export const FISH_DEFS: Record<FishId, FishDef> = {
  spool_perch: {
    id: 'spool_perch',
    name: 'Spool Perch',
    habitat: 'Delta Public Bank pilings',
    behavior: 'Twitches the bobber sideways twice, then dives cleanly.',
    accent: '#4cc9f0',
    pullStrength: 34,
    reelSpeed: 42,
    biteWindow: 2.4,
  },
  mirror_minnow: {
    id: 'mirror_minnow',
    name: 'Mirror Minnow',
    habitat: 'Inside an intact Movable Dock Lamp reflection',
    behavior: 'Tracks reflected lamplight; scatters when a ferry or plank breaks the water, then returns.',
    accent: '#ffd166',
    pullStrength: 42,
    reelSpeed: 36,
    biteWindow: 2.2,
  },
  receipt_eel: {
    id: 'receipt_eel',
    name: 'Receipt Eel',
    habitat: 'Carbon Copy Delta ink eddies & deep shoals',
    behavior: 'Folds along ink currents in long bursts; prized by Delta cooks.',
    accent: '#b388ff',
    pullStrength: 46,
    reelSpeed: 34,
    biteWindow: 2.1,
  },
  reed_perch: {
    id: 'reed_perch',
    name: 'Reed Perch',
    habitat: 'Sunlit reeds and shaded willows at the Singing Millpond',
    behavior: 'Bites faster in sunlit water and uses two small tugs before diving.',
    accent: '#72efdd',
    pullStrength: 28,
    reelSpeed: 48,
    biteWindow: 2.5,
  },
};

export interface DockReflectionState {
  disturbanceActive: boolean;
  disturbanceProgress: number; // 0..1 across dock water
  disturbanceKind: 'ferry' | 'plank';
  reflectionIntegrity: number; // 0..1 (1 = clear reflection, <0.45 = broken)
  minnowX: number;
  minnowY: number;
  minnowVisible: boolean;
}

/**
 * Pure deterministic reflection & disturbance simulation for the Delta Public Bank.
 * Every 15s cycle: 0..10.5s calm intact reflection, 10.5..13.5s passing ferry/plank breaks reflection,
 * 13.5..15s water settles & reflection reforms.
 */
export function computeDockReflectionState(
  time: number,
  dockLampSlot: 0 | 1 | 2,
  ferryRestored: boolean,
): DockReflectionState {
  const cycle = ((time % 15) + 15) % 15;
  const lamp = DOCK_LAMP_SLOTS[dockLampSlot] || DOCK_LAMP_SLOTS[1];
  const disturbanceActive = cycle >= 10.2 && cycle < 13.6;
  const disturbanceProgress = disturbanceActive ? (cycle - 10.2) / 3.4 : 0;

  let reflectionIntegrity = 1;
  if (disturbanceActive) {
    // Drops sharply as wake crosses the lamp reflection
    reflectionIntegrity = Math.max(0.08, 1 - Math.sin(disturbanceProgress * Math.PI) * 0.92);
  } else if (cycle >= 13.6) {
    // Smoothly reforms as water settles
    reflectionIntegrity = 0.25 + ((cycle - 13.6) / 1.4) * 0.75;
  }

  // Mirror Minnow gently orbits the active lamp reflection when intact, darts deep when broken
  const orbitAngle = time * 1.35;
  const minnowVisible = reflectionIntegrity >= 0.55;
  const minnowX = lamp.waterX + Math.cos(orbitAngle) * 18;
  const minnowY = lamp.waterY + Math.sin(orbitAngle * 1.4) * 9;

  return {
    disturbanceActive,
    disturbanceProgress,
    disturbanceKind: ferryRestored ? 'ferry' : 'plank',
    reflectionIntegrity,
    minnowX,
    minnowY,
    minnowVisible,
  };
}

export function createIdleFishingSession(toggleAssist = false): FishingSession {
  const piling = DOCK_LAMP_SLOTS[0];
  return {
    active: false,
    phase: 'idle',
    targetFish: 'spool_perch',
    bobberX: piling.waterX,
    bobberY: piling.waterY,
    castSlot: piling.slot,
    phaseTimer: 0,
    biteWindow: 0,
    tension: 0,
    progress: 0,
    fishPulling: false,
    pullTimer: 0,
    inReflection: false,
    usingPrismReel: false,
    toggleAssist,
    reelHeld: false,
    baitId: 'fizz_berry',
    rewardCommitted: false,
    lastOutcome: '',
    lastFishName: '',
  };
}

export function startFishingCast(
  session: FishingSession,
  castSlot: 0 | 1 | 2,
  dockLampSlot: 0 | 1 | 2,
  reflectionIntegrity: number,
  opts: {
    usingPrismReel: boolean;
    hasBellLure: boolean;
    baitId: string;
    currentReaderPerk: boolean;
    stillwaterPerk: boolean;
    brinBonus?: boolean;
    millpond?: { waterX: number; waterY: number; shaded: boolean };
  },
): FishingSession {
  const spot = opts.millpond ?? DOCK_LAMP_SLOTS[castSlot] ?? DOCK_LAMP_SLOTS[1];
  const inReflection = !opts.millpond && castSlot === dockLampSlot && reflectionIntegrity >= 0.55;

  // Deterministic, learnable species choice:
  // Casting into the intact Movable Dock Lamp reflection targets the Mirror Minnow!
  // Casting away from the lamp targets the reliable Spool Perch (or Receipt Eel with Prism Reel on East Cove).
  let targetFish: FishId = 'spool_perch';
  if (opts.millpond) {
    targetFish = 'reed_perch';
  } else if (inReflection) {
    targetFish = 'mirror_minnow';
  } else if (opts.usingPrismReel && castSlot === 2 && opts.hasBellLure) {
    targetFish = 'receipt_eel';
  }

  const fish = FISH_DEFS[targetFish];
  const biteBonus = (opts.currentReaderPerk ? 0.65 : 0) + (opts.brinBonus ? 0.45 : 0) + (opts.usingPrismReel ? 0.35 : 0);

  return {
    ...session,
    active: true,
    phase: 'casting',
    targetFish,
    bobberX: spot.waterX,
    bobberY: spot.waterY,
    castSlot,
    phaseTimer: 0.45,
    biteWindow: fish.biteWindow + biteBonus,
    tension: 18,
    progress: 12,
    fishPulling: false,
    pullTimer: 0.9,
    inReflection,
    usingPrismReel: opts.usingPrismReel,
    reelHeld: false,
    baitId: opts.baitId,
    rewardCommitted: false,
    lastOutcome: '',
    lastFishName: fish.name,
    shadedBank: opts.millpond?.shaded,
    steadyReflection: !opts.millpond && opts.stillwaterPerk,
  };
}

export interface FishingTickEvents {
  bobberSplashed?: boolean;
  nibbleTwitch?: 1 | 2;
  biteDive?: boolean;
  corkSqueak?: boolean;
  landedFish?: FishId;
  escaped?: boolean;
}

/**
 * Pure deterministic Fishing FSM step:
 * casting -> waiting -> nibble_1 -> nibble_2 -> bite -> tension -> landed / escaped.
 */
export function stepFishingSession(
  session: FishingSession,
  dt: number,
  opts: {
    reflectionIntegrity: number;
    currentReaderPerk: boolean;
    hasBellLure: boolean;
  },
): { next: FishingSession; events: FishingTickEvents } {
  const events: FishingTickEvents = {};
  if (!session.active || session.phase === 'idle' || session.phase === 'landed' || session.phase === 'escaped') {
    return { next: session, events };
  }

  const next: FishingSession = { ...session };
  const fish = FISH_DEFS[next.targetFish];

  if (next.phase === 'casting') {
    next.phaseTimer -= dt;
    if (next.phaseTimer <= 0) {
      next.phase = 'waiting';
      // Brisk, welcoming wait so opening isn't spent staring at water
      next.phaseTimer = next.targetFish === 'reed_perch' ? (next.shadedBank ? 2.45 : 0.9) : opts.hasBellLure ? 1.15 : 1.55;
      events.bobberSplashed = true;
    }
    return { next, events };
  }

  // If targeting Mirror Minnow and reflection breaks BEFORE hooking, fish backs off until water settles
  if (
    next.targetFish === 'mirror_minnow' &&
    (next.phase === 'waiting' || next.phase === 'nibble_1' || next.phase === 'nibble_2') &&
    opts.reflectionIntegrity < (next.steadyReflection ? 0.3 : 0.45)
  ) {
    next.phase = 'waiting';
    next.phaseTimer = Math.max(next.phaseTimer, 0.8);
    return { next, events };
  }

  if (next.phase === 'waiting') {
    next.phaseTimer -= dt;
    if (next.phaseTimer <= 0) {
      next.phase = 'nibble_1';
      next.phaseTimer = 0.85;
      events.nibbleTwitch = 1;
    }
    return { next, events };
  }

  if (next.phase === 'nibble_1') {
    next.phaseTimer -= dt;
    if (next.phaseTimer <= 0) {
      next.phase = 'nibble_2';
      next.phaseTimer = 0.85;
      events.nibbleTwitch = 2;
    }
    return { next, events };
  }

  if (next.phase === 'nibble_2') {
    next.phaseTimer -= dt;
    if (next.phaseTimer <= 0) {
      next.phase = 'bite';
      next.phaseTimer = next.biteWindow;
      events.biteDive = true;
      events.corkSqueak = true;
    }
    return { next, events };
  }

  if (next.phase === 'bite') {
    next.phaseTimer -= dt;
    if (next.phaseTimer <= 0) {
      next.phase = 'escaped';
      next.lastOutcome = 'escaped';
      next.active = false;
      events.escaped = true;
    }
    return { next, events };
  }

  if (next.phase === 'tension') {
    // Fish alternates between calm glide (reel!) and piling surge (give slack!)
    next.pullTimer -= dt;
    if (next.pullTimer <= 0) {
      next.fishPulling = !next.fishPulling;
      next.pullTimer = next.fishPulling ? 1.05 : 1.45;
      if (next.fishPulling) events.corkSqueak = true;
    }

    const reelBonus = (next.usingPrismReel ? 1.25 : 1) * (opts.currentReaderPerk ? 1.15 : 1);

    if (next.reelHeld) {
      if (next.fishPulling) {
        // Reeling against a surging fish spikes tension fast
        next.tension += (fish.pullStrength * 1.18) * dt;
        next.progress += (fish.reelSpeed * 0.28) * dt;
      } else {
        // Reeling a calm fish builds steady progress with moderate tension
        next.tension += 12 * dt;
        next.progress += fish.reelSpeed * reelBonus * dt;
      }
    } else {
      // Giving slack cools tension quickly and keeps line intact
      next.tension -= (next.fishPulling ? 26 : 34) * dt;
      next.progress -= (next.fishPulling ? 4 : 9) * dt;
    }

    next.tension = Math.max(0, Math.min(100, next.tension));
    next.progress = Math.max(0, Math.min(100, next.progress));

    if (next.progress >= 100) {
      next.phase = 'landed';
      next.lastOutcome = 'landed';
      next.active = false;
      events.landedFish = next.targetFish;
    } else if (next.tension >= 98 || (next.progress <= 0 && next.phaseTimer < -2.2)) {
      next.phase = 'escaped';
      next.lastOutcome = 'escaped';
      next.active = false;
      events.escaped = true;
    } else {
      next.phaseTimer -= dt;
    }
  }

  return { next, events };
}

export function triggerFishingHookOrReel(session: FishingSession, isPressed: boolean): { next: FishingSession; hooked: boolean } {
  if (!session.active) return { next: session, hooked: false };

  if (session.phase === 'bite' && isPressed) {
    return {
      next: {
        ...session,
        phase: 'tension',
        phaseTimer: 0,
        tension: 30,
        progress: 24,
        fishPulling: false,
        pullTimer: 1.35,
        reelHeld: session.toggleAssist ? true : isPressed,
      },
      hooked: true,
    };
  }

  if (session.phase === 'tension') {
    if (session.toggleAssist) {
      if (isPressed) {
        return { next: { ...session, reelHeld: !session.reelHeld }, hooked: false };
      }
      return { next: session, hooked: false };
    }
    return { next: { ...session, reelHeld: isPressed }, hooked: false };
  }

  // Premature tug during waiting/nibbles cancels cleanly without eating the player's rod
  if ((session.phase === 'waiting' || session.phase === 'nibble_1' || session.phase === 'nibble_2') && isPressed) {
    return {
      next: {
        ...session,
        phase: 'escaped',
        lastOutcome: 'escaped',
        active: false,
      },
      hooked: false,
    };
  }

  return { next: session, hooked: false };
}

/**
 * Pure check for Dinner for the Last Ferry camp readiness:
 * Checks whether a Camp Table has a Bench within 165px and a Lamp within 200px,
 * plus whether Bell Reed has been planted and supper cooked.
 */
export function evaluateCampSupperStatus(
  buildings: Array<Pick<Building, 'id' | 'type' | 'x' | 'y' | 'crop'>>,
  inv: Record<string, number>,
): CampSupperStatus {
  const tables = buildings.filter((b) => b.type === 'camp_table');
  const benches = buildings.filter((b) => b.type === 'bench');
  const lamps = buildings.filter(
    (b) => b.type === 'dock_lamp' || b.type === 'lava_lamp' || b.type === 'vibe_beacon' || b.type === 'dream_totem',
  );
  const hasBellReedPlanted = buildings.some((b) => b.type === 'mood_plot' && b.crop === 'bell_reed_crop');
  const hasCookedSupper = getCampSupperDish(inv) !== undefined;

  let bestTableId: string | null = tables[0]?.id ?? null;
  let hasBenchNearTable = false;
  let hasLampNearTable = false;

  for (const tbl of tables) {
    const benchOk = benches.some((bn) => Math.hypot(bn.x - tbl.x, bn.y - tbl.y) <= 165);
    const lampOk = lamps.some((lp) => Math.hypot(lp.x - tbl.x, lp.y - tbl.y) <= 210);
    if (Number(benchOk) + Number(lampOk) > Number(hasBenchNearTable) + Number(hasLampNearTable)) {
      bestTableId = tbl.id;
      hasBenchNearTable = benchOk;
      hasLampNearTable = lampOk;
    }
    if (benchOk && lampOk) break;
  }

  return {
    hasTable: tables.length > 0,
    hasBenchNearTable,
    hasLampNearTable,
    hasBellReedPlanted,
    hasCookedSupper,
    readyToServe: tables.length > 0 && hasBenchNearTable && hasLampNearTable && hasCookedSupper,
    tableId: bestTableId,
  };
}

export function getCampSupperDish(inventory: Record<string, number>): string | undefined {
  return ['perch_chowder', 'mirror_tartare', 'eel_relish'].find((dish) => (inventory[dish] ?? 0) > 0);
}
