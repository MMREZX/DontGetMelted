import { BIOMES, CHARACTERS, CROPS, DAY_LENGTH, LEAD_EPILOGUES, QUESTS, WORLD_R } from './data.ts';
import { DISCIPLINES, hasPerk, TIER_NAMES } from './disciplines.ts';
import { LANDMARKS, REGION_ZONES, WORLD_FEATURES } from './world.ts';
import type {
  BiomeDef,
  BiomeId,
  Building,
  BuildingType,
  CampShelterStatus,
  CharacterId,
  CountySyncStatus,
  CropId,
  DisciplineId,
  DisciplineProgress,
  DiscoveryState,
  DroppedSatchel,
  Mailbox,
  PhaseId,
  PlayerState,
  RecipeDef,
  RegionalEventState,
  RegionTimingCue,
  ResidentDef,
  RunStats,
  TechniqueId,
  TripId,
  TripMood,
  TripProfile,
  TripStage,
  TripSynergyDef,
  WorldFeatureProp,
  WorldFlags,
} from './types.ts';

// Single shared county geography lookup used by Terrain, Physics, Atlas, Minimap, and Spawners
export function getBiomeAt(x: number, y: number): BiomeDef {
  let bestId: BiomeId = 'giggle_grove';
  let bestScore = Infinity;

  // Subtle deterministic border wiggle so regions read like hand-drawn storybook valleys
  const warpX = Math.sin(y * 0.0011) * 145;
  const warpY = Math.cos(x * 0.0011) * 145;
  const wx = x + warpX;
  const wy = y + warpY;

  for (const zone of REGION_ZONES) {
    const dx = (wx - zone.cx) / zone.rx;
    const dy = (wy - zone.cy) / zone.ry;
    const normDist = Math.hypot(dx, dy);
    // Priority slightly favors inner hub & inner ring inside their ellipses while smoothly transitioning outward
    const score = normDist < 1 ? normDist - zone.priority * 0.025 : normDist;
    if (score < bestScore) {
      bestScore = score;
      bestId = zone.id;
    }
  }

  return BIOMES[bestId];
}

export function clampToWorld(x: number, y: number, margin = 90): { x: number; y: number } {
  const maxR = WORLD_R - margin;
  const d = Math.hypot(x, y);
  if (d <= maxR || d === 0) return { x, y };
  return { x: (x / d) * maxR, y: (y / d) * maxR };
}

export function getPhaseFromDayTime(dayTime: number): { id: PhaseId; name: string; progress: number } {
  const t = ((dayTime % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  if (t < 54) {
    return { id: 'day', name: 'Sunny Side Up', progress: t / 54 };
  }
  if (t < 76) {
    return { id: 'dusk', name: 'Disco Dusk', progress: (t - 54) / 22 };
  }
  return { id: 'night', name: 'The Big Snooze', progress: (t - 76) / (DAY_LENGTH - 76) };
}

export function getXpThreshold(skillsCount: number, unspentSp: number): number {
  return (skillsCount + unspentSp + 1) * 55;
}

export function applyXpGain(
  currentXp: number,
  currentSp: number,
  skillsCount: number,
  amount: number,
  charId: CharacterId,
): { xp: number; sp: number; leveledUp: boolean } {
  const mult = charId === 'pip' ? 1.15 : 1;
  let xp = currentXp + Math.round(amount * mult);
  let sp = currentSp;
  let leveledUp = false;
  let threshold = getXpThreshold(skillsCount, sp);
  while (xp >= threshold) {
    xp -= threshold;
    sp += 1;
    leveledUp = true;
    threshold = getXpThreshold(skillsCount, sp);
  }
  return { xp, sp, leveledUp };
}

export function canSeeCrystals(
  player: Pick<PlayerState, 'wobble' | 'gear'>,
  activeTrips: Set<TripId>,
  experienceId: string | null,
): boolean {
  if (player.gear.prismShades) return true;
  const threshold = player.gear.partyHat ? 20 : 35;
  return (
    player.wobble >= threshold ||
    activeTrips.has('kaleido') ||
    activeTrips.has('cosmic') ||
    activeTrips.has('disco') ||
    activeTrips.has('prism_refract') ||
    experienceId === 'polka_eclipse'
  );
}

export function getNpcDiscount(charId: CharacterId, skills: string[]): number {
  const geraldMult = charId === 'gerald' ? 0.75 : 1;
  const skillMult = skills.includes('smooth_talker') ? 0.8 : 1;
  return geraldMult * skillMult;
}

export function getDiscountedCost(
  give: Record<string, number>,
  charId: CharacterId,
  skills: string[],
): Record<string, number> {
  const mult = getNpcDiscount(charId, skills);
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(give)) {
    result[k] = Math.max(1, Math.round(v * mult));
  }
  return result;
}

export function hasIngredients(inv: Record<string, number>, cost: Record<string, number>): boolean {
  return Object.entries(cost).every(([k, v]) => (inv[k] || 0) >= v);
}

export function getEffectiveRecipeCost(
  recipe: RecipeDef,
  disciplines?: Record<DisciplineId, DisciplineProgress>,
): Record<string, number> {
  if (!hasPerk(disciplines, 'lens_smith')) return recipe.cost;
  const out: Record<string, number> = { ...recipe.cost };
  if (out.cosmic_crystal && out.cosmic_crystal > 1) {
    out.cosmic_crystal = out.cosmic_crystal - 1;
  }
  return out;
}

export function getSalvageRefund(
  recipe: RecipeDef,
  disciplines?: Record<DisciplineId, DisciplineProgress>,
): Record<string, number> {
  const fullRefund = hasPerk(disciplines, 'rigger');
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(recipe.cost)) {
    out[k] = fullRefund ? v : Math.max(1, Math.floor(v * 0.5));
  }
  return out;
}

export function canCraftRecipe(
  recipe: RecipeDef,
  inv: Record<string, number>,
  nearBlender: boolean,
  gear: PlayerState['gear'],
  unlockedStyles: string[],
  opts?: {
    nearWorkbench?: boolean;
    disciplines?: Record<DisciplineId, DisciplineProgress>;
  },
): {
  ok: boolean;
  reason: 'ready' | 'owned' | 'need_blender' | 'need_workbench' | 'need_skill' | 'need_items';
  missingSkills?: string[];
  missingItems?: string[];
} {
  if (recipe.type === 'gear' && recipe.gearKey && gear[recipe.gearKey]) {
    return { ok: false, reason: 'owned' };
  }
  if (recipe.type === 'style' && recipe.style && unlockedStyles.includes(recipe.style)) {
    return { ok: false, reason: 'owned' };
  }

  const fieldTinker = hasPerk(opts?.disciplines, 'field_tinker');

  if (!fieldTinker) {
    if (((recipe.type === 'blend' && !recipe.fieldCraft) || recipe.reqStation === 'funk_blender') && !nearBlender) {
      return { ok: false, reason: 'need_blender' };
    }
    if (recipe.reqStation === 'workbench' && !opts?.nearWorkbench) {
      return { ok: false, reason: 'need_workbench' };
    }
  }

  if (recipe.reqDisciplines) {
    const missingSkills: string[] = [];
    for (const [discKey, reqTier] of Object.entries(recipe.reqDisciplines) as Array<[DisciplineId, number]>) {
      const curTier = opts?.disciplines?.[discKey]?.tier ?? 1;
      if (curTier < reqTier) {
        const tName = TIER_NAMES[reqTier as 1 | 2 | 3 | 4 | 5] || `Tier ${reqTier}`;
        missingSkills.push(`${DISCIPLINES[discKey].name} ${reqTier} (${tName})`);
      }
    }
    if (missingSkills.length > 0) {
      return { ok: false, reason: 'need_skill', missingSkills };
    }
  }

  const effCost = getEffectiveRecipeCost(recipe, opts?.disciplines);
  if (!hasIngredients(inv, effCost)) {
    const missingItems = Object.entries(effCost)
      .filter(([k, v]) => (inv[k] || 0) < v)
      .map(([k, v]) => `${v - (inv[k] || 0)} ${k}`);
    return { ok: false, reason: 'need_items', missingItems };
  }
  return { ok: true, reason: 'ready' };
}

export function computeCropGrowthDelta(
  dt: number,
  nearBoombox: boolean,
  nearDjMoss: boolean,
  raveCloud: boolean,
  nearSynesthesia: boolean,
): number {
  const m =
    (nearBoombox ? 2 : 1) *
    (nearDjMoss ? 2 : 1) *
    (raveCloud ? 2 : 1) *
    (nearSynesthesia ? 2.5 : 1);
  return dt * m;
}

export function checkHybridPair(
  plot: Pick<Building, 'x' | 'y' | 'crop'>,
  allBuildings: Array<Pick<Building, 'type' | 'x' | 'y' | 'crop'>>,
): CropId | null {
  if (!plot.crop) return null;
  const near = (targetCrop: CropId) =>
    allBuildings.some(
      (b) =>
        b.type === 'mood_plot' &&
        b.crop === targetCrop &&
        Math.hypot(b.x - plot.x, b.y - plot.y) > 1 &&
        Math.hypot(b.x - plot.x, b.y - plot.y) < 185,
    );

  if ((plot.crop === 'shroom_crop' && near('toast_crop')) || (plot.crop === 'toast_crop' && near('shroom_crop'))) {
    return 'party_bagel';
  }
  if ((plot.crop === 'shroom_crop' && near('pickle_crop')) || (plot.crop === 'pickle_crop' && near('shroom_crop'))) {
    return 'cosmic_truffle';
  }
  return null;
}

export function isCropReady(crop: CropId | null, growth: number): boolean {
  if (!crop) return false;
  return growth >= CROPS[crop].time;
}

export function computeNightVibeDelta(
  dt: number,
  phaseId: PhaseId,
  nearLamp: boolean,
  charId: CharacterId,
  opts?: { sheltered?: boolean; lanternStrider?: boolean },
): number {
  if (phaseId === 'night') {
    if (nearLamp) {
      return dt * (charId === 'barnaby' ? 5.2 : 3.6);
    }
    let drain = 3.6;
    if (opts?.sheltered) drain *= 0.5;
    if (opts?.lanternStrider) drain *= 0.75;
    return -dt * drain;
  }
  return nearLamp ? dt * 2.0 : 0;
}

// =========================================================================
// IMPOSSIBLE REGIONAL PHYSICS & TIMING RULES
// =========================================================================
export interface RegionPhysicsResult {
  pushX: number;
  pushY: number;
  speedMult: number;
  coldMult: number;
  grooveDir: 1 | -1;
  grooveWarning: boolean; // true 1.5s before Dead Air Basin groove reverses
  stampBridgeActive: boolean; // Carbon Copy Delta paper bridge currently printed
  stampGhostVisible: boolean; // Wobble or Wet-Ink Footing shows upcoming print
  dryerKnockWarning: boolean; // Unpaired Sea 2 knocks before wind shifts
  windAngle: number;
  compressorSilent: boolean; // Midnight Defrost silent 5s window
  waxLedgeSolid: boolean; // Wickwater cooling wax walkable window
  waxDimWarning: boolean; // Lantern Moths scatter 1.5s before wick dims
  timingCue: RegionTimingCue | null;
}

export function getRegionPhysics(
  x: number,
  y: number,
  time: number,
  biomeId: BiomeId,
  techniques: TechniqueId[],
  elevation: 0 | 1,
  wobble: number,
  ignoreMud: boolean,
  echoListenerPerk = false,
): RegionPhysicsResult {
  const hasTech = (t: TechniqueId) => techniques.includes(t);

  // Dead Air Basin 7s reversing groove cycle
  const grooveCycle = ((time % 7) + 7) % 7;
  const groovePhase = Math.floor(time / 7) % 2;
  const grooveDir: 1 | -1 = biomeId === 'dead_air_basin' && groovePhase === 1 ? -1 : 1;
  const grooveWarning = biomeId === 'dead_air_basin' && grooveCycle >= 5.5;

  // Carbon Copy Delta 6s stamp bridge cycle (solid 4.2s, printing/wet 1.8s)
  const stampCycle = ((time % 6) + 6) % 6;
  const stampBridgeActive = stampCycle < 4.2;
  const stampGhostVisible = !stampBridgeActive && (wobble >= 18 || hasTech('mural_step'));

  // Unpaired Sea 8s wind cycle with double dryer knock warning in final 1.6s
  const windCycle = ((time % 8) + 8) % 8;
  const windQuarter = Math.floor(time / 8) % 4;
  const windAngles = [Math.PI, -Math.PI * 0.75, Math.PI * 0.75, -Math.PI * 0.25];
  const windAngle = windAngles[windQuarter];
  const dryerKnockWarning = windCycle >= 6.4;

  // Midnight Defrost 10s compressor cycle (5s humming/cold, 5s silent/safe)
  const defrostCycle = ((time % 10) + 10) % 10;
  const compressorSilent = defrostCycle >= 5.0;

  // Wickwater Afterhours 8s cooling wax ledge cycle (solid 5.8s, dims warning 4.3..5.8)
  const waxCycle = ((time % 8) + 8) % 8;
  const waxLedgeSolid = waxCycle < 5.8;
  const waxDimWarning = waxCycle >= 4.3 && waxCycle < 5.8;

  let pushX = 0;
  let pushY = 0;
  let speedMult = BIOMES[biomeId].slow;
  let coldMult = 1;
  let timingCue: RegionTimingCue | null = null;

  if (ignoreMud || hasTech('current_sense')) {
    if (biomeId === 'marmalade_flats' || biomeId === 'bureaucracy_bog' || biomeId === 'carbon_copy_delta') {
      speedMult = Math.max(speedMult, 1.0);
    }
  }

  // Elevation boost on Giggle-Grove Creasefolk Rooftop Walk
  if (elevation === 1) {
    speedMult *= hasTech('paper_fold_glide') ? 1.28 : 1.12;
  }

  // Cork Soles reduce cold everywhere
  if (hasTech('cork_sole_insulation')) {
    coldMult *= 0.48;
  }

  if (biomeId === 'vinyl_desert' || biomeId === 'dead_air_basin') {
    // Check if riding an explicit playable groove track
    let onTrack = false;
    for (const f of WORLD_FEATURES) {
      if (f.kind === 'grooves_track' && Math.hypot(x - f.x, y - f.y) < f.radius) {
        onTrack = true;
        const ang = (f.angle ?? -2.55) + (grooveDir === -1 ? Math.PI : 0);
        const boost = hasTech('resonant_stride') ? (grooveDir === 1 ? 155 : 48) : 112;
        pushX += Math.cos(ang) * boost;
        pushY += Math.sin(ang) * boost;
      }
    }
    if (!onTrack && !ignoreMud) {
      const spinStrength = biomeId === 'dead_air_basin' ? 28 : 20;
      const eff = hasTech('resonant_stride') ? spinStrength * 0.35 : spinStrength;
      const ang = Math.atan2(y + 2200, x + 3900) + Math.PI * 0.5 * grooveDir;
      pushX += Math.cos(ang) * eff;
      pushY += Math.sin(ang) * eff;
    }
    if (biomeId === 'dead_air_basin') {
      timingCue = {
        label: grooveWarning
          ? 'Wren foot up! Groove reversing...'
          : grooveDir === 1
            ? 'Basin Groove: Outward Spin'
            : 'Basin Groove: B-Side Reverse',
        progress: grooveCycle / 7,
        warning: grooveWarning,
        accent: grooveWarning ? '#ffd166' : '#ff5d8f',
      };
    }
  } else if (biomeId === 'marmalade_flats') {
    for (const f of WORLD_FEATURES) {
      if (f.kind === 'jam_canal' && Math.hypot(x - f.x, y - f.y) < f.radius) {
        const ang = f.angle ?? -0.35;
        pushX += Math.cos(ang) * 125;
        pushY += Math.sin(ang) * 125;
        speedMult = 1.2;
      }
    }
  } else if (biomeId === 'carbon_copy_delta') {
    timingCue = {
      label: stampBridgeActive
        ? 'Ink Bridges: Dry & Walkable'
        : stampGhostVisible
          ? 'Ghost Trace: Next Stamp Dropping'
          : 'Ink River Wet (Wobble sees trace)',
      progress: stampCycle / 6,
      warning: !stampBridgeActive,
      accent: stampBridgeActive ? '#4cc9f0' : '#ffd166',
    };
    for (const f of WORLD_FEATURES) {
      if (f.kind === 'stamp_bridge' && Math.hypot(x - f.x, y - f.y) < f.radius) {
        speedMult = stampBridgeActive ? 1.18 : 0.62;
      }
    }
  } else if (biomeId === 'unpaired_sea') {
    const gustStrength = hasTech('gust_trimmed_hem') ? 38 : 68;
    const dir = hasTech('gust_trimmed_hem') ? -1 : 1;
    pushX += Math.cos(windAngle) * gustStrength * dir;
    pushY += Math.sin(windAngle) * gustStrength * dir;
    if (hasTech('gust_trimmed_hem')) {
      speedMult *= 1.14;
    }
    timingCue = {
      label: dryerKnockWarning ? 'Dryer Knock-Knock! Wind turning!' : 'Unpaired Sea: Bedsheet Breeze',
      progress: windCycle / 8,
      warning: dryerKnockWarning,
      accent: dryerKnockWarning ? '#ff5d8f' : '#ffd166',
    };
  } else if (biomeId === 'cloud_laundromat') {
    for (const f of WORLD_FEATURES) {
      if (f.kind === 'wash_line' && Math.hypot(x - f.x, y - f.y) < f.radius) {
        const ang = f.angle ?? 2.75;
        pushX += Math.cos(ang) * 95;
        pushY += Math.sin(ang) * 95;
      }
    }
  } else if (biomeId === 'midnight_defrost') {
    if (compressorSilent) {
      coldMult = 0;
      speedMult = 1.15;
    }
    timingCue = {
      label: compressorSilent ? 'Compressor Silent — Safe Crossing!' : 'Compressor Humming (Chilly!)',
      progress: compressorSilent ? (defrostCycle - 5) / 5 : defrostCycle / 5,
      warning: !compressorSilent && defrostCycle > 3.6,
      accent: compressorSilent ? '#72efdd' : '#4895ef',
    };
  } else if (biomeId === 'wickwater_afterhours') {
    if (hasTech('watchkeepers_collar') && waxLedgeSolid) {
      speedMult *= 1.1;
    }
    timingCue = {
      label: waxDimWarning
        ? 'Moths Scattering! Wax dimming...'
        : waxLedgeSolid
          ? 'Candleboat Wax: Cool & Solid'
          : 'Fresh Pour: Wait for Wax to Cool',
      progress: waxCycle / 8,
      warning: waxDimWarning || !waxLedgeSolid,
      accent: waxDimWarning ? '#ff5d8f' : '#ff9f1c',
    };
  } else if (biomeId === 'undertone_caverns') {
    // 8s Moth Choir Resonance cycle: solid echo bridge 0..5.0s (+1.5s with Echo Listener perk), quiet remainder
    const cavCycle = ((time % 8) + 8) % 8;
    const openWindow = echoListenerPerk ? 6.5 : 5.0;
    const bridgeOpen = cavCycle < openWindow;
    const fading = cavCycle >= openWindow - 1.4 && cavCycle < openWindow;
    if (bridgeOpen) speedMult *= 1.12;
    timingCue = {
      label: fading
        ? 'Moth Choir Fading — Step onto rock!'
        : bridgeOpen
          ? echoListenerPerk
            ? 'Moth Choir Swell (Echo Listener +1.5s)'
            : 'Moth Choir Swell: Echo Hollows Open'
          : 'Cavern Quiet — Strike Tuning Fork!',
      progress: cavCycle / 8,
      warning: fading || !bridgeOpen,
      accent: fading ? '#ffd166' : bridgeOpen ? '#ff70a6' : '#b388ff',
    };
  } else if (biomeId === 'negative_coast') {
    // 9s Photographic Low Tide cycle: low tide exposes second painted beach 0..5.4s, tide returning 5.4..9s
    const tideCycle = ((time % 9) + 9) % 9;
    const lowTide = tideCycle < 5.4;
    const turning = tideCycle >= 4.0 && tideCycle < 5.4;
    if (lowTide) speedMult = Math.max(speedMult, 1.1);
    timingCue = {
      label: turning
        ? 'Silver Tide Turning — Head to Press!'
        : lowTide
          ? 'Low Tide: Negative Shoreline Exposed'
          : 'High Silver Tide — Wait for Ebb',
      progress: tideCycle / 9,
      warning: turning || !lowTide,
      accent: turning ? '#ffd166' : lowTide ? '#e0fbfc' : '#4cc9f0',
    };
  } else if (biomeId === 'inverted_allotments') {
    // 7s Upward Pollen Windlift cycle: cross-bed tailwind push
    const liftCycle = ((time % 7) + 7) % 7;
    const strongLift = liftCycle < 4.4;
    const liftAng = strongLift ? -Math.PI * 0.65 : Math.PI * 0.35;
    pushX += Math.cos(liftAng) * (strongLift ? 42 : 16);
    pushY += Math.sin(liftAng) * (strongLift ? 42 : 16);
    if (strongLift) speedMult *= 1.14;
    timingCue = {
      label: strongLift
        ? 'Pollen Windlift: Shared-Gravity Boost!'
        : 'Calm Canopy: Beds Settling',
      progress: liftCycle / 7,
      warning: liftCycle >= 3.6 && liftCycle < 4.4,
      accent: strongLift ? '#a8ff3e' : '#72efdd',
    };
  }

  return {
    pushX,
    pushY,
    speedMult,
    coldMult,
    grooveDir,
    grooveWarning,
    stampBridgeActive,
    stampGhostVisible,
    dryerKnockWarning,
    windAngle,
    compressorSilent,
    waxLedgeSolid,
    waxDimWarning,
    timingCue,
  };
}

// =========================================================================
// DISCOVERY, REFUGE RESCUE, MIRRORS, RADIO & QUEST PROGRESS
// =========================================================================
const DISCOVERY_RANK: Record<DiscoveryState, number> = {
  unknown: 0,
  rumor: 1,
  seen: 2,
  visited: 3,
};

export function upgradeDiscovery(
  discoveries: Record<string, DiscoveryState>,
  key: string,
  next: DiscoveryState,
): boolean {
  const cur = discoveries[key] ?? 'unknown';
  if (DISCOVERY_RANK[next] > DISCOVERY_RANK[cur]) {
    discoveries[key] = next;
    return true;
  }
  return false;
}

export function updateDiscoveryAtPosition(
  discoveries: Record<string, DiscoveryState>,
  x: number,
  y: number,
): string[] {
  const newlyVisited: string[] = [];
  const currentBiome = getBiomeAt(x, y);
  if (upgradeDiscovery(discoveries, currentBiome.id, 'visited')) {
    newlyVisited.push(currentBiome.name);
  }

  // Mark nearby regions as seen when approaching their borders
  for (const zone of REGION_ZONES) {
    const d = Math.hypot((x - zone.cx) / zone.rx, (y - zone.cy) / zone.ry);
    if (d < 1.38) {
      upgradeDiscovery(discoveries, zone.id, 'seen');
    }
  }

  // Landmarks: seen within 1150px, visited within 360px
  for (const lm of LANDMARKS) {
    const dist = Math.hypot(x - lm.x, y - lm.y);
    if (dist < 360) {
      if (upgradeDiscovery(discoveries, lm.id, 'visited')) {
        newlyVisited.push(lm.name);
      }
    } else if (dist < 1150) {
      upgradeDiscovery(discoveries, lm.id, 'seen');
    }
  }

  return newlyVisited;
}

export function findNearestWarmRefuge(
  x: number,
  y: number,
  buildings: Array<Pick<Building, 'type' | 'x' | 'y'>>,
): { x: number; y: number; dist: number; angle: number; name: string } {
  let best = { x: -145, y: -145, dist: Math.hypot(-145 - x, -145 - y), name: 'Mailbox Square' };

  for (const lm of LANDMARKS) {
    if (!lm.isWarmRefuge) continue;
    const d = Math.hypot(lm.x - x, lm.y - y);
    if (d < best.dist) {
      best = { x: lm.x, y: lm.y, dist: d, name: lm.name };
    }
  }

  for (const b of buildings) {
    if (b.type !== 'lava_lamp') continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < best.dist) {
      best = { x: b.x, y: b.y, dist: d, name: 'Lava Lamp' };
    }
  }

  return {
    ...best,
    angle: Math.atan2(best.y - y, best.x - x),
  };
}

export function getGhostTimerDuration(
  techniques: TechniqueId[],
  disciplines?: Record<DisciplineId, DisciplineProgress>,
): number {
  const base = techniques.includes('watchkeepers_collar') ? 30 : 22;
  return base + (hasPerk(disciplines, 'lantern_strider') ? 6 : 0);
}

export function getEffectiveBarterCost(
  give: Record<string, number>,
  disciplines?: Record<DisciplineId, DisciplineProgress>,
): Record<string, number> {
  if (!hasPerk(disciplines, 'warm_welcome')) return give;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(give)) {
    out[k] = k === 'bottlecap' && v > 1 ? Math.max(1, Math.floor(v * 0.85)) : v;
  }
  return out;
}

// =========================================================================
// CAMP PLACEMENT REACHABILITY, SHELTER DETECTION, MELT RECOVERY & EVENTS
// =========================================================================
const NON_BLOCKING_FEATURE_KINDS = new Set([
  'grooves_track',
  'jam_canal',
  'stamp_bridge',
  'wash_line',
  'appliance_bulb',
  'candleboat',
]);

export function validateBuildingPlacement(
  x: number,
  y: number,
  _type: BuildingType,
  existingBuildings: Array<Pick<Building, 'id' | 'x' | 'y'>>,
  mailboxes: Array<Pick<Mailbox, 'x' | 'y' | 'biomeName'>>,
  features: ReadonlyArray<Pick<WorldFeatureProp, 'kind' | 'x' | 'y' | 'label'>> = WORLD_FEATURES,
  ignoreBuildingId?: string,
): { ok: boolean; reason?: string } {
  for (const m of mailboxes) {
    if (Math.hypot(x - m.x, y - m.y) < 68) {
      return {
        ok: false,
        reason: `Too close to the ${m.biomeName} Wormhole Mailbox — keep travel anchors reachable!`,
      };
    }
  }
  for (const f of features) {
    if (NON_BLOCKING_FEATURE_KINDS.has(f.kind)) continue;
    if (Math.hypot(x - f.x, y - f.y) < 72) {
      return {
        ok: false,
        reason: `Too close to ${f.label} — keep quest entrances & fishing banks unobstructed!`,
      };
    }
  }
  for (const b of existingBuildings) {
    if (ignoreBuildingId && b.id === ignoreBuildingId) continue;
    if (Math.hypot(x - b.x, y - b.y) < 40) {
      return {
        ok: false,
        reason: 'Overlaps existing camp furniture — step aside a pace so walkways stay clear!',
      };
    }
  }
  return { ok: true };
}

export function evaluateCampShelter(
  x: number,
  y: number,
  buildings: Array<Pick<Building, 'type' | 'x' | 'y'>>,
): CampShelterStatus {
  const nearAwning = buildings.some((b) => b.type === 'camp_awning' && Math.hypot(b.x - x, b.y - y) <= 210);
  if (nearAwning) {
    return {
      sheltered: true,
      reason: 'Under Canvas Camp Awning (-50% night chill & +10% crop growth)',
    };
  }
  const nearWorkbench = buildings.some((b) => b.type === 'workbench' && Math.hypot(b.x - x, b.y - y) <= 190);
  const nearLamp = buildings.some(
    (b) =>
      (b.type === 'lava_lamp' || b.type === 'dock_lamp' || b.type === 'vibe_beacon' || b.type === 'dream_totem') &&
      Math.hypot(b.x - x, b.y - y) <= 190,
  );
  if (nearWorkbench && nearLamp) {
    return {
      sheltered: true,
      reason: 'Warm Workbench Refuge (-50% night chill & +10% crop growth)',
    };
  }
  return {
    sheltered: false,
    reason: 'Open Sky — raise a Canvas Camp Awning or pair a Workbench + Lamp for shelter.',
  };
}

const PROTECTED_RECOVERY_ITEMS = new Set([
  'bottlecap',
  'broadcast_pin',
  'ferry_note',
  'bell_lure',
  'gossip_slip',
  'ink_voucher',
  'seed_shroom',
  'seed_toast',
  'seed_pickle',
  'seed_pear',
  'seed_moss',
  'seed_bell_reed',
  'seed_upside_clover',
]);

export function buildMeltRecoveryOutcome(
  inv: Record<string, number>,
  difficultyMode: 'standard' | 'relaxed' | 'harsh',
  x: number,
  y: number,
  day: number,
  biomeName: string,
): {
  keptInv: Record<string, number>;
  droppedSatchel: DroppedSatchel | null;
  daylightCost: number;
  advanceNextMorning: boolean;
} {
  if (difficultyMode === 'relaxed') {
    return {
      keptInv: { ...inv },
      droppedSatchel: null,
      daylightCost: 24,
      advanceNextMorning: false,
    };
  }

  const dropFrac = difficultyMode === 'harsh' ? 0.65 : 0.5;
  const keptInv: Record<string, number> = {};
  const droppedItems: Record<string, number> = {};
  let totalDropped = 0;

  for (const [k, qty] of Object.entries(inv)) {
    if (!qty || qty <= 0) continue;
    if (PROTECTED_RECOVERY_ITEMS.has(k) || qty <= 1) {
      keptInv[k] = qty;
    } else {
      const dropQty = Math.max(1, Math.floor(qty * dropFrac));
      const keepQty = qty - dropQty;
      if (keepQty > 0) keptInv[k] = keepQty;
      droppedItems[k] = dropQty;
      totalDropped += dropQty;
    }
  }

  return {
    keptInv,
    droppedSatchel:
      totalDropped > 0
        ? {
            x,
            y,
            day,
            biomeName,
            items: droppedItems,
          }
        : null,
    daylightCost: difficultyMode === 'harsh' ? DAY_LENGTH : 45,
    advanceNextMorning: difficultyMode === 'harsh',
  };
}

export function evaluateRegionalEventTrigger(
  day: number,
  flags: WorldFlags,
  discoveries: Record<string, DiscoveryState>,
  activeEvent: RegionalEventState | null,
  cooldownDay: number,
): RegionalEventState | null {
  // Never interrupt Day 1 onboarding or overlap an active event
  if (day < 2 || activeEvent || day < cooldownDay) return null;

  const candidates: RegionalEventState[] = [];
  if (discoveries.carbon_copy_delta === 'visited' || flags.ferryRestored || flags.ferrySupperServedDay > 0) {
    candidates.push({
      id: 'delta_ink_swell',
      title: 'Ink-Tide Delivery Delay',
      regionId: 'carbon_copy_delta',
      eyewitnessId: 'oona_offset',
      eyewitnessName: 'Oona Offset',
      summary: 'A fresh surge of wet print-ink is smudging the Delta ferry pier—supply crates are backing up!',
      groundedReason: 'Triggered because the Carbon Copy Delta crossing is active on your county routes.',
      startedDay: day,
      optionALabel: 'Stabilize Pier (1 Bell Reed / Tide Ink / Voucher)',
      optionADesc: 'Bind the wet pier cleanly: +15 Bottlecaps, +1 Ink Voucher, +30 Hospitality & +25 Wayfinding XP.',
      optionBLabel: 'Reroute Footbridge & Post Chalk Notice (Free)',
      optionBDesc: 'Peaceful low-pack reroute: +1 Juicy Gossip, +18 Wayfinding XP & full route recovery.',
    });
  }
  if (discoveries.prism_orchard === 'visited' || flags.orchardRipened) {
    candidates.push({
      id: 'orchard_prism_fog',
      title: 'Refracted Orchard Haze',
      regionId: 'prism_orchard',
      eyewitnessId: 'pell_pipette',
      eyewitnessName: 'Pell Pipette',
      summary: 'Valley mist settled over Prism Orchard, bending sunbeams away from the ripening Lens-Pear trellises!',
      groundedReason: 'Triggered because Prism Orchard’s glass trellises are charted on your county routes.',
      startedDay: day,
      optionALabel: 'Focus Warm Lamp / Crystal Beam (1 Cosmic Crystal or Free w/ Lamp)',
      optionADesc: 'Clears the orchard haze: +1 Lens-Pear, +1 Pear Seed & +30 Field Botany XP.',
      optionBLabel: 'Harvest Cool Shade Berries Early (Free)',
      optionBDesc: 'Turns haze into brisk foraging: +2 Fizz Berries, +1 Pop-Toast & +20 Farming XP.',
    });
  }
  if (
    discoveries.dead_air_basin === 'visited' ||
    discoveries.undertone_caverns === 'visited' ||
    flags.radioRepaired ||
    flags.undertoneForkTuned
  ) {
    candidates.push({
      id: 'cavern_echo_drift',
      title: 'Moth Choir Frequency Drift',
      regionId: 'undertone_caverns',
      eyewitnessId: 'nell_backbeat',
      eyewitnessName: 'Nell Backbeat',
      summary: 'The western echo carrier slipped half a step flat—radio requests are arriving in slow motion!',
      groundedReason: 'Triggered because Dead Air Basin / Undertone Caverns are connected to your broadcasts.',
      startedDay: day,
      optionALabel: 'Re-Tune with Harmonic Reed (1 Bell/Tuned Reed or Free for Bea/DJ Moss)',
      optionADesc: 'Locks crystal-clear county pitch: +18 Bottlecaps, +1 Tuned Reed & +35 Acoustics XP.',
      optionBLabel: 'Host Cozy Acoustic Story Hour (Free)',
      optionBDesc: 'Turns drift into warm mellow radio: +20 Vibe, +1 Juicy Gossip & +25 Hospitality XP.',
    });
  }

  if (candidates.length === 0) return null;
  return candidates[day % candidates.length];
}

export function computeMirrorRipenCount(mirrorAngles: Record<string, number>): number {
  // Target angles aiming each Orchard Mirror straight into the Prism Greenhouse (8850, -3750)
  const targets: Record<string, number> = {
    feat_mirror_1: 2,
    feat_mirror_2: 3,
    feat_mirror_3: 1,
  };
  let aligned = 0;
  for (const [id, target] of Object.entries(targets)) {
    if (((mirrorAngles[id] ?? 0) % 4) === target) {
      aligned += 1;
    }
  }
  return aligned;
}

export function getResidentPosition(
  res: ResidentDef,
  phaseId: PhaseId,
  time: number,
): { x: number; y: number } {
  const baseX = phaseId === 'night' && res.nightX !== undefined ? res.nightX : res.homeX;
  const baseY = phaseId === 'night' && res.nightY !== undefined ? res.nightY : res.homeY;
  // Gentle small-radius living idle patrol so settlements feel inhabited
  const seed = res.id.charCodeAt(0) * 1.7 + res.id.charCodeAt(res.id.length - 1);
  return {
    x: baseX + Math.sin(time * 0.45 + seed) * 14,
    y: baseY + Math.cos(time * 0.38 + seed * 1.3) * 10,
  };
}

export function getRadioBroadcastLine(flags: WorldFlags, day: number, charId: CharacterId): string | null {
  if (!flags.radioRepaired && !flags.allNightBroadcastHosted) return null;
  const hero = CHARACTERS[charId]?.name ?? 'Friend';
  if (flags.allNightBroadcastHosted) {
    return `ALL-NIGHT BROADCAST LIVE (Day ${day}): Hosted by ${hero}! Every restored settlement across the county is tuned in.`;
  }
  const ferryTag =
    flags.ferrySupperServedDay > 0
      ? ' Capt. Nix sends a warm two-note ferry horn to your camp table!'
      : '';
  if (flags.radioSolution === 'djmoss') {
    return `Radio Unmelted (Day ${day}): Live frog-bass relay spun by ${hero}! Groove Express boarding now.${ferryTag}`;
  }
  if (flags.radioSolution === 'gerald') {
    return `Radio Unmelted (Day ${day}): Form 1040-R cleared by ${hero}—county jazz legally restored!${ferryTag}`;
  }
  if (flags.radioSolution === 'barnaby') {
    return `Radio Unmelted (Day ${day}): Tea-steamed brass tonearm courtesy of ${hero}. Mind your biscuits!${ferryTag}`;
  }
  if (flags.radioSolution === 'pip') {
    return `Radio Unmelted (Day ${day}): Special dedication to ${hero}—you actually made your appointment!${ferryTag}`;
  }
  return `Radio Unmelted (Day ${day}): County signal humming clear thanks to ${hero}!${ferryTag}`;
}

export function computeCountySyncStatus(
  flags: WorldFlags,
  stats: RunStats,
  tamedCount: number,
  talkedResidentsCount: number,
  charId: CharacterId,
): CountySyncStatus {
  const milestones: Array<{ done: boolean; label: string; shoutOut: string }> = [
    {
      done: flags.ferrySupperServedDay > 0,
      label: 'Last Ferry Supper',
      shoutOut:
        flags.ferrySupperFollowUp === 'lure_reflected'
          ? 'Capt. Nix calls in from Delta Public Bank—the reflected Mirror Minnows are leaping under the dock lamp!'
          : flags.ferrySupperFollowUp === 'bait_garden'
            ? 'Capt. Nix sends thanks for the fragrant Bell Reed harvest drifting across Mailbox Square!'
            : 'Capt. Nix blows a warm two-note horn from your Giggle-Grove Camp Table—second plate still steaming!',
    },
    {
      done: flags.radioRepaired,
      label: 'Radio Unmelted Tower',
      shoutOut: 'Nell Backbeat cranks the repaired tonearm in Dead Air Basin—the missing third note rings across every valley!',
    },
    {
      done: flags.ferryRestored,
      label: 'Public Records Ferry',
      shoutOut: 'The Public Records Ferry clears the ink current on time; Three Frogs in a Trenchcoat applaud inside one lapel.',
    },
    {
      done: flags.orchardRipened,
      label: 'Prism Orchard Mirrors',
      shoutOut: 'Pell Pipette & Facet chime a glass-pear chord from the sunlit Greenhouse.',
    },
    {
      done: flags.socksHung,
      label: 'Giant Sock Clothesline',
      shoutOut: 'Auntie Bias & Grandma Cloud send breezy greetings along the taut skyway from Clothespin Harbor.',
    },
    {
      done: flags.wickworksRestored || flags.defrostDiverted,
      label: 'Night Shift & Wickworks',
      shoutOut: 'Sol & Flicker Shortwick light the Lamp-Service Tunnel with orbiting Lantern Moths.',
    },
    {
      done: flags.undertoneForkTuned,
      label: 'Undertone Caverns Fork',
      shoutOut: 'Hush Mothwright’s cavern moth choir harmonizes beneath Dead Air Basin in clear acoustic fifths!',
    },
    {
      done: flags.negativePressRestored,
      label: 'Negative Coast Tide Press',
      shoutOut: 'Sable Blot rolls off tomorrow’s storm-proof weather charts in crisp silver Tide Ink.',
    },
    {
      done: flags.invertedGutterDirected,
      label: 'Inverted Allotments Gutter',
      shoutOut: 'Tiller Upside floats a celebratory bouquet of Gravity Clover up the Cloud-9 Windlift!',
    },
  ];

  const completed = milestones.filter((m) => m.done);
  const restoredCount = completed.length;
  const totalRestorations = milestones.length;
  const peacefulRoute = (stats.enemiesBonked || 0) === 0;
  const readyForBroadcast = flags.radioRepaired || restoredCount >= 3 || flags.allNightBroadcastHosted;

  const broadcastLines: string[] = [
    `LIVE FROM GIGGLE-GROVE: ${CHARACTERS[charId]?.name ?? 'Wanderer'} opens the county’s first All-Night Broadcast!`,
    ...completed.map((c) => c.shoutOut),
  ];

  if (tamedCount > 0) {
    broadcastLines.push(
      `Creature Roll Call: ${tamedCount} befriended county ${tamedCount === 1 ? 'companion joins' : 'companions join'} the chorus around Mailbox Square.`,
    );
  }
  if (talkedResidentsCount >= 4) {
    broadcastLines.push(
      `Neighborhood Roll Call: ${talkedResidentsCount} residents tuned in from across all 15 county regions.`,
    );
  }
  if (peacefulRoute) {
    broadcastLines.push(
      'Peaceful Route Honor: Not a single neighbor or inspector was bonked—diplomacy, music, and snacks carried the county!',
    );
  }

  return {
    restoredCount,
    totalRestorations,
    readyForBroadcast,
    peacefulRoute,
    leadEpilogue: LEAD_EPILOGUES[charId] || LEAD_EPILOGUES.pip,
    completedLabels: completed.map((c) => c.label),
    broadcastLines,
  };
}

export function getQuestProgress(
  quest: (typeof QUESTS)[number],
  stats: RunStats,
  flags: WorldFlags,
): number {
  if (quest.flagKey) {
    const val = flags[quest.flagKey];
    if (typeof val === 'boolean') return val ? 1 : 0;
    if (typeof val === 'number') return val;
    return val ? 1 : 0;
  }
  if (quest.statKey) {
    return stats[quest.statKey] ?? 0;
  }
  return 0;
}

export function countUnclaimedQuests(
  stats: RunStats,
  claimedQuests: string[],
  flags?: WorldFlags,
): number {
  let count = 0;
  const f = flags ?? ({} as WorldFlags);
  for (const q of QUESTS) {
    if (!claimedQuests.includes(q.id) && getQuestProgress(q, stats, f) >= q.target) {
      count += 1;
    }
  }
  return count;
}

export function getActiveQuestSummary(
  stats: RunStats,
  claimedQuests: string[],
  flags?: WorldFlags,
): { title: string; progress: string } {
  const f = flags ?? ({} as WorldFlags);
  // Prioritize ready-to-claim quests first
  for (const q of QUESTS) {
    if (!claimedQuests.includes(q.id) && getQuestProgress(q, stats, f) >= q.target) {
      return { title: q.title, progress: 'Ready to claim' };
    }
  }
  for (const q of QUESTS) {
    if (!claimedQuests.includes(q.id)) {
      const cur = Math.min(q.target, getQuestProgress(q, stats, f));
      return {
        title: q.title,
        progress: `${cur}/${q.target}`,
      };
    }
  }
  return { title: 'County Legend', progress: 'All Done' };
}

// =========================================================================
// PERCEPTUAL TRIP & BAD-TRIP STATE MACHINE
// =========================================================================
export interface TripVisualMeta {
  id: TripId;
  name: string;
  shortName: string;
  accent: string;
  effectSummary: string;
  habitat: string;
  onsetNote: string;
  peakNote: string;
  afterglowNote: string;
  riskLevel: 'Gentle' | 'Vibrant' | 'Intense' | 'High Bad-Trip Risk';
  enemyTimeScale: number;
  playerSpeedMult: number;
}

export const TRIP_VISUAL_META: Record<TripId, TripVisualMeta> = {
  kaleido: {
    id: 'kaleido',
    name: 'Kaleido-Shroom',
    shortName: 'KALEIDO',
    accent: '#ff5d8f',
    effectSummary: 'Reveals Cosmic Crystals and quickens your stride.',
    habitat: 'The Giggle-Grove meadows & Mood Soil plots',
    onsetNote: 'Look for hidden Cosmic Crystals near the path.',
    peakNote: 'Follow the revealed crystals while the effect lasts.',
    afterglowNote: 'Gather any visible crystals before the effect fades.',
    riskLevel: 'Vibrant',
    enemyTimeScale: 1,
    playerSpeedMult: 1.05,
  },
  floaty: {
    id: 'floaty',
    name: 'Cloud-Puff Spore',
    shortName: 'FLOATY',
    accent: '#8be9fd',
    effectSummary: 'Temporarily grants Astral Glide.',
    habitat: 'Cloud-9 Laundromat & Unpaired Sea updrafts',
    onsetNote: 'Use the glide to cross sticky ground.',
    peakNote: 'Skim across jam and reversing grooves.',
    afterglowNote: 'Finish crossing before your normal stride returns.',
    riskLevel: 'Gentle',
    enemyTimeScale: 1,
    playerSpeedMult: 1.14,
  },
  synesthesia: {
    id: 'synesthesia',
    name: 'Hyper-Fizz Nectar',
    shortName: 'SYNESTHESIA',
    accent: '#ffd166',
    effectSummary: 'Increases sprint speed and speeds nearby crop growth.',
    habitat: 'Marmalade Flats fizzy fountains & Listening Booths',
    onsetNote: 'Try a quick sprint or return to your crops.',
    peakNote: 'Use the speed for a short expedition or stay near Mood Soil.',
    afterglowNote: 'Wrap up nearby tending before the speed wears off.',
    riskLevel: 'Vibrant',
    enemyTimeScale: 1,
    playerSpeedMult: 1.38,
  },
  chrono: {
    id: 'chrono',
    name: 'Chrono-Pickle',
    shortName: 'CHRONO',
    accent: '#2ec4b6',
    effectSummary: 'Slows foes while your own stride quickens.',
    habitat: 'Bureaucracy Bog brine jars & Pickle crops',
    onsetNote: 'Use the gap to move away from nearby foes.',
    peakNote: 'Cross enemy territory while their attacks are slower.',
    afterglowNote: 'Give foes more room as they return to normal speed.',
    riskLevel: 'Gentle',
    enemyTimeScale: 0.45,
    playerSpeedMult: 1.08,
  },
  cosmic: {
    id: 'cosmic',
    name: 'Void-Cocoa',
    shortName: 'COSMIC',
    accent: '#b388ff',
    effectSummary: 'Reveals hidden crystals and slightly slows foes.',
    habitat: 'Vinyl Desert & Dead Air Basin starlight groves',
    onsetNote: 'Check for hidden crystals along your route.',
    peakNote: 'Use the slower attacks to reach an exposed crystal.',
    afterglowNote: 'Gather any crystals before they fade from view.',
    riskLevel: 'Intense',
    enemyTimeScale: 0.92,
    playerSpeedMult: 1.04,
  },
  disco: {
    id: 'disco',
    name: 'Disco Overdrive',
    shortName: 'DISCO',
    accent: '#ff3b8d',
    effectSummary: 'Boosts speed and helps prevent a Bad Trip.',
    habitat: 'Funk-Blender combo (Kaleido-Shroom + Hyper-Fizz)',
    onsetNote: 'Use the boost to cross an exposed stretch.',
    peakNote: 'Plan around the speed bonus and keep Vibe up.',
    afterglowNote: 'Look for shelter before the protection fades.',
    riskLevel: 'Gentle',
    enemyTimeScale: 0.85,
    playerSpeedMult: 1.28,
  },
  prism_refract: {
    id: 'prism_refract',
    name: 'Prism Absinthe',
    shortName: 'PRISM',
    accent: '#72efdd',
    effectSummary: 'Reveals Cosmic Crystals and increases movement speed.',
    habitat: 'Prism Orchard greenhouses & Funk-Blender',
    onsetNote: 'Check for newly visible crystal nodes.',
    peakNote: 'Collect nearby Cosmic Crystals while your sight is clear.',
    afterglowNote: 'Collect any remaining crystals before the effect wears off.',
    riskLevel: 'Intense',
    enemyTimeScale: 0.95,
    playerSpeedMult: 1.1,
  },
  velvet_fog: {
    id: 'velvet_fog',
    name: 'Velvet Spores',
    shortName: 'VELVET',
    accent: '#c77dff',
    effectSummary: 'Extends night sight, raises Wobble, and lowers Vibe.',
    habitat: 'Wickwater Afterhours canals & Funk-Blender',
    onsetNote: 'Check your Vibe and mark a warm refuge.',
    peakNote: 'Use the wider lantern light to find shelter.',
    afterglowNote: 'Recover Vibe near shelter or sip Boring Decaf.',
    riskLevel: 'High Bad-Trip Risk',
    enemyTimeScale: 0.88,
    playerSpeedMult: 0.94,
  },
};

export const TRIP_SYNERGIES: TripSynergyDef[] = [
  {
    id: 'starglass_fractal',
    pair: ['kaleido', 'prism_refract'],
    name: 'Starglass Fractal',
    accent: '#72efdd',
    bonusDesc: 'Bonus Cosmic Crystal drops & +8% radiant stride',
    speedBonus: 0.08,
    crystalBonus: true,
  },
  {
    id: 'astral_timefold',
    pair: ['cosmic', 'chrono'],
    name: 'Astral Timefold',
    accent: '#b388ff',
    bonusDesc: 'Foes move and attack at 35% of normal speed',
    enemyTimeScale: 0.35,
  },
  {
    id: 'fever_tapestry',
    pair: ['velvet_fog', 'kaleido'],
    name: 'Fever Dream Tapestry',
    accent: '#ff5d8f',
    bonusDesc: 'Keep Vibe high while the two brews raise Wobble',
  },
  {
    id: 'hyper_chord',
    pair: ['synesthesia', 'disco'],
    name: 'Hyper-Chord Rave',
    accent: '#ffd166',
    bonusDesc: '+15% extra sprint & friendly creature charm aura',
    speedBonus: 0.15,
    charmAura: true,
  },
  {
    id: 'nebula_drift',
    pair: ['floaty', 'cosmic'],
    name: 'Zero-G Nebula Drift',
    accent: '#8be9fd',
    bonusDesc: '+12% glide speed & frictionless drift',
    speedBonus: 0.12,
  },
];

export function computeTripStage(
  rem: number,
  maxDur: number,
): { stage: TripStage; progress: number; factor: number } {
  const safeMax = Math.max(1, maxDur);
  const progress = Math.max(0, Math.min(1, 1 - rem / safeMax));
  if (progress < 0.22) {
    const t = progress / 0.22;
    return { stage: 'onset', progress, factor: 0.48 + t * 0.52 };
  }
  if (progress <= 0.74) {
    return { stage: 'peak', progress, factor: 1.0 };
  }
  const t = (progress - 0.74) / 0.26;
  return { stage: 'afterglow', progress, factor: Math.max(0.38, 1.0 - t * 0.62) };
}

export function detectTripSynergy(trips: Partial<Record<TripId, number>>): TripSynergyDef | null {
  for (const syn of TRIP_SYNERGIES) {
    const [a, b] = syn.pair;
    if ((trips[a] || 0) > 0 && (trips[b] || 0) > 0) {
      return syn;
    }
  }
  return null;
}

export function computeTripProfile(
  vibe: number,
  maxVibe: number,
  wobble: number,
  trips: Partial<Record<TripId, number>>,
  tripMaxDur?: Partial<Record<TripId, number>>,
  nearCalmingTotem = false,
): TripProfile {
  const safeMax = Math.max(1, maxVibe);
  const vibeRatio = Math.max(0, Math.min(1, vibe / safeMax));
  const activeEntries = (Object.entries(trips) as Array<[TripId, number]>).filter(([, rem]) => (rem || 0) > 0);
  activeEntries.sort((a, b) => (b[1] || 0) - (a[1] || 0));

  const dominantTrip: TripId | null = activeEntries.length > 0 ? activeEntries[0][0] : null;
  const activeCount = activeEntries.length;
  const hasDiscoShield = (trips.disco || 0) > 0;
  const hasVelvet = (trips.velvet_fog || 0) > 0;
  const synergy = detectTripSynergy(trips);

  let stage: TripStage | null = null;
  let stageProgress = 0;
  let stageFactor = 1;
  if (dominantTrip) {
    const rem = trips[dominantTrip] || 0;
    const defaultDur =
      dominantTrip === 'disco' ? 40 : dominantTrip === 'chrono' ? 22 : dominantTrip === 'synesthesia' ? 25 : 32;
    const maxD = Math.max(rem, tripMaxDur?.[dominantTrip] || defaultDur);
    const st = computeTripStage(rem, maxD);
    stage = st.stage;
    stageProgress = st.progress;
    stageFactor = st.factor;
  }

  let enemyTimeScale = 1;
  let playerSpeedMult = 1;

  for (const [tid] of activeEntries) {
    const meta = TRIP_VISUAL_META[tid];
    enemyTimeScale = Math.min(enemyTimeScale, meta.enemyTimeScale);
    if (meta.playerSpeedMult > 1) {
      playerSpeedMult = Math.max(playerSpeedMult, meta.playerSpeedMult);
    } else {
      playerSpeedMult *= meta.playerSpeedMult;
    }
  }

  if (synergy) {
    if (synergy.speedBonus) playerSpeedMult += synergy.speedBonus;
    if (synergy.enemyTimeScale) enemyTimeScale = Math.min(enemyTimeScale, synergy.enemyTimeScale);
  }


  const intensity = Math.max(
    0,
    Math.min(1, ((wobble / 100) * 0.82 + Math.min(0.32, activeCount * 0.14)) * (0.72 + 0.28 * stageFactor)),
  );

  // Bad Trip triggers when Wobble is HIGH while Vibe is LOW (or extreme Wobble >= 86 with dipping Vibe).
  // Disco Overdrive & nearby Velvet Dreamcatcher totems shield/suppress spiraling.
  const highWobble = wobble >= 55 || (hasVelvet && wobble >= 46);
  const totemDampen = nearCalmingTotem ? 0.34 : 1;
  const rawSpiralScore =
    !highWobble
      ? 0
      : hasDiscoShield && vibeRatio >= 0.16
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((wobble - 46) / 48) * 0.58 +
                Math.max(0, (0.52 - vibeRatio) / 0.42) * 0.78 +
                (hasVelvet ? 0.14 : 0),
            ),
          ) * totemDampen;

  let mood: TripMood = 'sober';
  let label = 'Steady & Clear';
  let advice = 'Sip a brew (1–5) to shift perception.';
  let badTripIntensity = 0;
  let euphoriaIntensity = 0;
  let badTripTier: 0 | 1 | 2 | 3 = 0;

  if (
    highWobble &&
    !nearCalmingTotem &&
    ((vibeRatio <= 0.36 && rawSpiralScore >= 0.45) || (wobble >= 86 && vibeRatio <= 0.52 && !hasDiscoShield))
  ) {
    mood = 'bad_trip';
    badTripIntensity = Math.max(0.45, Math.min(1, rawSpiralScore));
    badTripTier = badTripIntensity > 0.76 ? 3 : 2;
    label = badTripTier === 3 ? 'FULL MELT SPIRAL' : 'BAD TRIP · PARANOIA';
    advice = 'Sip Boring Decaf, eat a Moon-Petal, or stand near a Lava Lamp / Dreamcatcher!';
  } else if (highWobble && vibeRatio < 0.48 && !hasDiscoShield && rawSpiralScore >= 0.22) {
    mood = 'uneasy';
    badTripTier = 1;
    badTripIntensity = Math.min(0.42, rawSpiralScore * 0.75);
    label = nearCalmingTotem ? 'TOTEM-CALMED JITTERS' : 'Wobble Jitters';
    advice = nearCalmingTotem
      ? 'Velvet Dreamcatcher is keeping the shadows at bay.'
      : 'Vibe is dipping while tripping high—warm up or eat!';
  } else if (wobble >= 52 || activeCount >= 2 || hasDiscoShield || synergy) {
    mood = 'euphoric';
    euphoriaIntensity = Math.max(0.35, Math.min(1, intensity * (0.55 + vibeRatio * 0.55)));
    label = synergy
      ? `SYNERGY · ${synergy.name.toUpperCase()}`
      : hasDiscoShield
        ? 'ECSTATIC DISCO PEAK'
        : stage === 'afterglow'
          ? 'WARM AFTERGLOW'
          : 'GOOD TRIP · EUPHORIC';
    advice = synergy
      ? synergy.bonusDesc
      : dominantTrip
        ? stage === 'onset'
          ? TRIP_VISUAL_META[dominantTrip].onsetNote
          : stage === 'afterglow'
            ? TRIP_VISUAL_META[dominantTrip].afterglowNote
            : TRIP_VISUAL_META[dominantTrip].peakNote
        : 'Radiant high-Vibe resonance!';
  } else if (wobble >= 24 || activeCount > 0) {
    mood = 'come_up';
    euphoriaIntensity = Math.min(0.34, intensity * 0.5);
    label = dominantTrip
      ? `${TRIP_VISUAL_META[dominantTrip].shortName} ${stage === 'afterglow' ? 'AFTERGLOW' : 'ONSET'}`
      : 'Gentle Shimmer';
    advice = dominantTrip
      ? stage === 'afterglow'
        ? TRIP_VISUAL_META[dominantTrip].afterglowNote
        : TRIP_VISUAL_META[dominantTrip].onsetNote
      : 'Colors feel warmer and springier.';
  }

  return {
    mood,
    label,
    advice,
    stage,
    stageProgress,
    stageFactor,
    synergy,
    badTripTier,
    intensity,
    euphoriaIntensity,
    badTripIntensity,
    dominantTrip,
    enemyTimeScale,
    playerSpeedMult,
  };
}
