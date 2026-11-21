import {
  ALL_BIOME_IDS, CHARACTERS, CREATURE_DEFS, CROPS, DAY_LENGTH, LEGACY_SAVE_KEY_V3, LEGACY_SAVE_KEY_V4,
  RECIPES, SAVE_BACKUP_KEY, SAVE_KEY, STYLES, TECHNIQUES,
} from './data.ts';
import { createInitialDisciplines, DISCIPLINES } from './disciplines.ts';
import { CAMP_JOBS, createCampProgress, MAX_CAMP_PROVISIONS, RIBBON_TRAILS } from './fieldwork.ts';
import { newExpeditions } from './expeditions.ts';
import { TRIP_VISUAL_META } from './rules.ts';
import { LANDMARKS, TRANSPORT_ROUTES } from './world.ts';
import type {
  AudioSettings,
  Building,
  CharacterId,
  Creature,
  DisciplineId,
  DisciplineProgress,
  DiscoveryState,
  GameState,
  Mailbox,
  WorldFlags,
} from './types.ts';

export const SAVE_VERSION = 8;
const SETTINGS_KEY = 'dont_melt_preferences';

export const DEFAULT_WORLD_FLAGS: WorldFlags = {
  radioRepaired: false,
  radioSolution: '',
  radioCustomBeat: 1,
  deltaPermitFound: false,
  ferryRestored: false,
  ferryInsulated: false,
  deltaMuralSolved: false,
  orchardMirrorsAligned: 0,
  orchardRipened: false,
  sockHalfAFound: false,
  sockHalfBFound: false,
  socksHung: false,
  defrostDiverted: false,
  compostPostalAssigned: false,
  wickworksRestored: false,
  wickwaterCeremony: '',
  originalDriftFound: false,
  rooftopShortcutLearned: false,
  ferrySupperStage: 'unstarted',
  ferrySupperServedDay: 0,
  ferrySupperFollowUp: '',
  mirrorMinnowObserved: false,
  mirrorMinnowCaught: false,
  prismReelLeadUnlocked: false,
  dockLampSlot: 1,
  undertoneForkTuned: false,
  negativePressRestored: false,
  invertedGutterDirected: false,
  allNightBroadcastHosted: false,
  broadcastStationIndex: 0,
};

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 1,
  music: 0.72,
  ambience: 0.68,
  effects: 0.85,
  muted: false,
  perceptionIntensity: 0.75,
  visualSoundCues: false,
  flashFree: true,
  stableCamera: false,
};

export function normalizeAudioSettings(saved: unknown): AudioSettings {
  const settings = restoreFields({ ...DEFAULT_AUDIO_SETTINGS }, saved);
  if (isRecord(saved) && typeof saved.perceptionIntensity !== 'number') {
    settings.perceptionIntensity = finite(saved.effectStrength, settings.perceptionIntensity);
  }
  for (const key of ['master', 'music', 'ambience', 'effects', 'perceptionIntensity'] as const) {
    settings[key] = Math.max(0, Math.min(1, settings[key]));
  }
  return settings;
}

export function readPreferences(storage: Pick<Storage, 'getItem'>):
  { audio: AudioSettings; motion: boolean | null } | null {
  try {
    const raw = JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null');
    if (!isRecord(raw)) return null;
    return {
      audio: normalizeAudioSettings(raw.audio),
      motion: typeof raw.motion === 'boolean' ? raw.motion : null,
    };
  } catch {
    return null;
  }
}

function readMotionOverride(saved: Record<string, unknown>): boolean | null {
  if (typeof saved.reducedMotionOverride === 'boolean' || saved.reducedMotionOverride === null) {
    return saved.reducedMotionOverride;
  }
  return typeof saved.reducedMotion === 'boolean' ? saved.reducedMotion : null;
}

export function readSavePreferences(storage: Pick<Storage, 'getItem'>):
  { audio: AudioSettings; motion: boolean | null } | null {
  try {
    const raw = JSON.parse(readRawSavedJson(storage) ?? 'null');
    if (!isRecord(raw) || !isRecord(raw.player)) return null;
    return { audio: normalizeAudioSettings(raw.audioSettings), motion: readMotionOverride(raw) };
  } catch {
    return null;
  }
}

export function writePreferences(storage: Pick<Storage, 'setItem'>, audio: AudioSettings, motion: boolean | null): void {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify({ audio, motion }));
  } catch {
    // Settings still apply to the live game if storage is unavailable.
  }
}

export function createInitialDiscoveries(): Record<string, DiscoveryState> {
  const map: Record<string, DiscoveryState> = {};
  for (const id of ALL_BIOME_IDS) {
    map[id] = id === 'giggle_grove' ? 'visited' : 'unknown';
  }
  // Early rumors visible on the county atlas so the player immediately feels pulled outward
  map.vinyl_desert = 'rumor';
  map.bureaucracy_bog = 'rumor';
  map.carbon_copy_delta = 'rumor';
  map.marmalade_flats = 'rumor';
  map.cloud_laundromat = 'rumor';
  map.great_fridge = 'rumor';
  map.dead_air_basin = 'rumor';
  map.undertone_caverns = 'rumor';
  map.negative_coast = 'rumor';
  map.inverted_allotments = 'rumor';

  for (const lm of LANDMARKS) {
    if (lm.regionId === 'giggle_grove') {
      map[lm.id] = lm.id === 'lm_mailbox_square' ? 'visited' : 'seen';
    } else if (
      lm.id === 'lm_listening_booth' ||
      lm.id === 'lm_radio_unmelted' ||
      lm.id === 'lm_delta_bank' ||
      lm.id === 'lm_tuning_fork' ||
      lm.id === 'lm_tide_press' ||
      lm.id === 'lm_hanging_gutter'
    ) {
      map[lm.id] = 'rumor';
    } else {
      map[lm.id] = 'unknown';
    }
  }
  return map;
}

export function createDefaultMirrorAngles(): Record<string, number> {
  return {
    feat_mirror_1: 0,
    feat_mirror_2: 1,
    feat_mirror_3: 2,
  };
}

export function readRawSavedJson(storage: Pick<Storage, 'getItem'>): string | null {
  try {
    return storage.getItem(SAVE_KEY) || storage.getItem(LEGACY_SAVE_KEY_V4) || storage.getItem(LEGACY_SAVE_KEY_V3);
  } catch {
    return null;
  }
}

export function hasSavedGame(storage: Pick<Storage, 'getItem'>): boolean {
  return Boolean(readRawSavedJson(storage));
}

export function safeLoadAndMigrate(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  buildFreshState: (charId: CharacterId, worldSeed?: number) => GameState,
): { state: GameState | null; backupPreserved: boolean; unreadable?: boolean } {
  const rawStr = readRawSavedJson(storage);
  if (!rawStr) return { state: null, backupPreserved: false };

  let state: GameState | null = null;
  let needsBackup = true;
  try {
    const parsed = JSON.parse(rawStr);
    state = migrateSaveData(parsed, buildFreshState);
    needsBackup = !state || parsed.version !== SAVE_VERSION;
  } catch {
    // Keep the original text available for recovery when possible.
  }

  let backupPreserved = false;
  if (needsBackup) {
    try {
      storage.setItem(SAVE_BACKUP_KEY, rawStr);
      backupPreserved = true;
    } catch {
      // The save slot is still intact if storage rejects the backup.
    }
  }
  return { state, backupPreserved, unreadable: !state };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isId<K extends string>(table: Record<K, unknown>, key: unknown): key is K {
  return typeof key === 'string' && Object.hasOwn(table, key);
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function restoreFields<T extends object>(defaults: T, saved: unknown): T {
  if (!isRecord(saved)) return defaults;
  const restored = Object.entries(defaults).map(([key, fallback]) => {
    const value = saved[key];
    return [key, typeof fallback === 'number' ? finite(value, fallback) : typeof value === typeof fallback ? value : fallback];
  });
  return Object.fromEntries(restored) as T;
}

function numericEntries(saved: unknown): Record<string, number> {
  if (!isRecord(saved)) return {};
  return Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, number] =>
    !Object.hasOwn(Object.prototype, entry[0]) && typeof entry[1] === 'number' && Number.isFinite(entry[1]) && entry[1] > 0,
  ));
}

function hasPosition(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function restoreCreatures(saved: Creature[] | undefined, roster: Creature[], currentVersion: boolean): Creature[] {
  if (!Array.isArray(saved)) return roster;
  const restored = new Map<string, Creature>();
  for (const creature of saved) {
    if (!hasPosition(creature) || typeof creature.id !== 'string' || !isId(CREATURE_DEFS, creature.type)) continue;
    if (!currentVersion && creature.tamed !== true) continue;
    const definition = CREATURE_DEFS[creature.type];
    const defaults: Creature = {
      id: creature.id, type: creature.type, x: creature.x, y: creature.y, vx: 0, vy: 0, facing: 1,
      hp: definition.maxHp, maxHp: definition.maxHp, tamed: false, hearts: 0, buddyTimer: 18, timer: 2,
      seed: 0, say: '', sayTimer: 0, hitAnim: 0, hitFlash: 0, danceTimer: 0, frozenTimer: 0, footLift: 0,
      aiState: 'idle', aiTimer: 1, telegraphX: creature.x, telegraphY: creature.y, telegraphRadius: 72,
      koTimer: 0, hasToken: false,
    };
    const entry = restoreFields(defaults, creature);
    if (!['windup', 'attack', 'recover', 'ko'].includes(entry.aiState)) entry.aiState = 'idle';
    restored.set(entry.id, entry);
  }
  if (currentVersion) return [...restored.values()];
  return [...restored.values(), ...roster.filter((creature) => !restored.has(creature.id))];
}

export function migrateSaveData(
  raw: unknown,
  buildFreshState: (charId: CharacterId, worldSeed?: number) => GameState,
): GameState | null {
  if (!isRecord(raw) || !isRecord(raw.player)) return null;
  if (raw.version !== undefined && (!Number.isInteger(raw.version) || Number(raw.version) < 3 || Number(raw.version) > SAVE_VERSION)) return null;
  const src = raw as Partial<GameState>;

  const charId = isId(CHARACTERS, src.player?.charId) ? src.player.charId : 'pip';
  const seed = finite(src.worldSeed, 198477);

  const base = buildFreshState(charId, seed);

  // Merge core progress without duplicating claimed quest rewards
  const claimedQuests = Array.isArray(src.claimedQuests)
    ? Array.from(new Set(src.claimedQuests.filter((q): q is string => typeof q === 'string')))
    : [];

  const skills = Array.isArray(src.skills)
    ? Array.from(new Set(src.skills.filter((s): s is string => typeof s === 'string')))
    : [];

  const techniques = Array.isArray(src.techniques)
    ? [...new Set(src.techniques.filter((id) => isId(TECHNIQUES, id)))]
    : [];

  const unlockedStyles = Array.isArray(src.unlockedStyles)
    ? [...new Set<GameState['unlockedStyles'][number]>(['hustle', ...src.unlockedStyles.filter((id) => isId(STYLES, id))])]
    : base.unlockedStyles;

  const unlockedTransports = Array.isArray(src.unlockedTransports)
    ? [...new Set(src.unlockedTransports.filter((id) => isId(TRANSPORT_ROUTES, id)))]
    : [];

  const worldFlags = restoreFields(DEFAULT_WORLD_FLAGS, src.worldFlags);
  const dockLampSlot = [0, 1, 2].includes(worldFlags.dockLampSlot) ? worldFlags.dockLampSlot : DEFAULT_WORLD_FLAGS.dockLampSlot;

  const discoveries: Record<string, DiscoveryState> = {
    ...base.discoveries,
    ...Object.fromEntries(Object.entries(isRecord(src.discoveries) ? src.discoveries : {}).filter(([, value]) =>
      value === 'unknown' || value === 'rumor' || value === 'seen' || value === 'visited',
    )),
  };

  const audioSettings = normalizeAudioSettings(src.audioSettings);
  const reducedMotionOverride = readMotionOverride(raw);

  // Merge disciplines cleanly (reconciling existing progress for v3/v4 saves!)
  const defaultDisc = createInitialDisciplines();
  const disciplines: Record<DisciplineId, DisciplineProgress> = { ...defaultDisc };
  if (src.disciplines && typeof src.disciplines === 'object') {
    for (const k of Object.keys(defaultDisc) as DisciplineId[]) {
      const incoming = src.disciplines[k];
      if (incoming && typeof incoming === 'object') {
        disciplines[k] = {
          xp: Math.max(0, finite(incoming.xp, 0)),
          tier: ([1, 2, 3, 4, 5].includes(incoming.tier) ? incoming.tier : 1) as 1 | 2 | 3 | 4 | 5,
          perk: DISCIPLINES[k].perks.some((perk) => perk.id === incoming.perk) ? incoming.perk : null,
          distinctActions: Array.isArray(incoming.distinctActions) ? [...new Set(incoming.distinctActions.filter((action) => typeof action === 'string'))] : [],
          ...(Number.isInteger(incoming.practiceDay) && Number(incoming.practiceDay) > 0 ?
            { practiceDay: incoming.practiceDay, dailyActions: numericEntries(incoming.dailyActions) } : {}),
        };
      }
    }
  } else {
    // Reconcile legacy harvests/crops/buildings into starter discipline XP on v3/v4 upgrade
    const legacyCrops = finite(src.stats?.cropsHarvested, 0);
    if (legacyCrops > 0) {
      disciplines.farming.xp = Math.min(90, legacyCrops * 18);
      disciplines.farming.tier = disciplines.farming.xp >= 40 ? 2 : 1;
    }
  }

  // Preserve legacy placed buildings & crops cleanly inside the expanded county
  const placeableTypes = new Set(RECIPES.filter((recipe) => recipe.type === 'place').map((recipe) => recipe.id));
  const buildings: Building[] = Array.isArray(src.buildings)
    ? src.buildings.filter((building) => hasPosition(building) && typeof building.id === 'string' && placeableTypes.has(building.type))
      .map((building) => ({
        ...building,
        phase: finite(building.phase, 0),
        crop: isId(CROPS, building.crop) ? building.crop : null,
        growth: finite(building.growth, 0),
        rotation: finite(building.rotation, 0),
      }))
    : base.buildings;

  // Preserve discovered mailboxes by biomeId when upgrading from v3/v4 -> v5
  const savedDiscoveredBiomes = new Set<string>(['giggle_grove']);
  if (Array.isArray(src.mailboxes)) {
    for (const m of src.mailboxes) {
      if (m && typeof m.biomeId === 'string' && (m.discovered !== false || src.version === undefined)) {
        savedDiscoveredBiomes.add(m.biomeId);
      }
    }
  }
  const mailboxes: Mailbox[] = base.mailboxes.map((m) => ({
    ...m,
    discovered: m.discovered || savedDiscoveredBiomes.has(m.biomeId),
  }));

  // Preserve tamed buddies from v3/v4/v5 saves onto the refreshed creature roster
  // Version 6 already persisted the full world roster.
  const hasSavedWorld = (src.version ?? 0) >= 6;
  const creatures = restoreCreatures(src.creatures, base.creatures, hasSavedWorld);
  const player = restoreFields(base.player, src.player);
  const camp = createCampProgress();
  const expeditions = newExpeditions();
  if (isRecord(src.expeditions)) {
    const readStatus = (status: string) => status === 'active' || status === 'restored' ? status : 'unstarted';
    expeditions.millpond = restoreFields(expeditions.millpond, src.expeditions.millpond);
    expeditions.millpond.status = readStatus(expeditions.millpond.status);
    expeditions.millpond.ribbons = Math.max(0, Math.min(3, expeditions.millpond.ribbons | 0));
    expeditions.millpond.mint = Math.max(0, Math.min(3, expeditions.millpond.mint | 0));
    expeditions.millpond.mintDay = Math.max(0, Math.floor(expeditions.millpond.mintDay));
    expeditions.millpond.dailyMint = Math.max(0, Math.min(3, expeditions.millpond.dailyMint | 0));
    expeditions.hollow = restoreFields(expeditions.hollow, src.expeditions.hollow);
    expeditions.hollow.status = readStatus(expeditions.hollow.status);
    expeditions.hollow.role = expeditions.hollow.role === 'hauler' ? 'hauler' : 'anchor';
    expeditions.hollow.ribbons = Math.max(0, Math.min(7, expeditions.hollow.ribbons | 0));
    expeditions.hollow.quartz = Math.max(0, Math.min(7, expeditions.hollow.quartz | 0));
    expeditions.hollow.bankedQuartz = Math.max(0, Math.min(3, expeditions.hollow.bankedQuartz | 0));
    expeditions.hollow.escortX = Math.max(-11600, Math.min(11600, expeditions.hollow.escortX));
    expeditions.hollow.escortY = Math.max(-11600, Math.min(11600, expeditions.hollow.escortY));
    expeditions.hollow.day = Math.max(0, Math.floor(expeditions.hollow.day));
    expeditions.hollow.elapsed = Math.max(0, Math.min(180, expeditions.hollow.elapsed));
  }
  if (isRecord(src.camp)) {
    camp.anchorId = typeof src.camp.anchorId === 'string' ? src.camp.anchorId : null;
    camp.provisions = Math.min(MAX_CAMP_PROVISIONS, Math.max(0, Math.floor(finite(src.camp.provisions, 0))));
    camp.lastShiftDay = Math.max(0, Math.floor(finite(src.camp.lastShiftDay, 0)));
    camp.wardDay = Math.max(0, Math.floor(finite(src.camp.wardDay, 0)));
    camp.report = Array.isArray(src.camp.report) ? src.camp.report.filter((line) => typeof line === 'string').slice(0, 6) : [];
    const jobs = isRecord(src.camp.jobs) ? src.camp.jobs : {};
    for (const creature of creatures) {
      const job = jobs[creature.id];
      if (creature.tamed && isId(CAMP_JOBS, job)) camp.jobs[creature.id] = job;
    }
    for (const [id, time] of Object.entries(numericEntries(src.camp.trailRecords))) {
      if (isId(RIBBON_TRAILS, id) && time <= RIBBON_TRAILS[id].seconds) camp.trailRecords[id] = time;
    }
  }
  const npcMemories = Object.fromEntries(Object.entries(isRecord(src.npcMemories) ? src.npcMemories : {})
    .filter(([, memory]) => isRecord(memory))
    .map(([id, memory]) => [id, restoreFields({ talked: false, helped: false, visits: 0 }, memory)]));

  const migrated: GameState = {
    ...base,
    camp,
    expeditions,
    version: SAVE_VERSION,
    worldSeed: seed,
    time: Math.max(0, finite(src.time, base.time)),
    dayTime: Math.max(0, Math.min(DAY_LENGTH, finite(src.dayTime, base.dayTime))),
    day: Math.max(1, Math.floor(finite(src.day, base.day))),
    dead: Boolean(src.dead),
    victory: Boolean(src.victory),
    deathReason: typeof src.deathReason === 'string' ? src.deathReason : '',
    ghostTimer: Math.max(0, finite(src.ghostTimer, 0)),
    exp: src.exp ?? null,
    expCooldown: finite(src.expCooldown, base.expCooldown),
    xp: Math.max(0, finite(src.xp, 0)),
    sp: Math.max(0, finite(src.sp, 0)),
    skills,
    techniques,
    unlockedStyles,
    unlockedTransports,
    claimedQuests,
    discoveries,
    npcMemories,
    worldFlags: { ...worldFlags, dockLampSlot },
    mirrorAngles:
      src.mirrorAngles && typeof src.mirrorAngles === 'object'
        ? { ...createDefaultMirrorAngles(), ...src.mirrorAngles }
        : base.mirrorAngles,
    waypoint: hasPosition(src.waypoint) && typeof src.waypoint.label === 'string' ? src.waypoint : null,
    journalNotes: Array.isArray(src.journalNotes) ? src.journalNotes.filter((note) => typeof note === 'string') : base.journalNotes,
    journalSketches: Array.isArray(src.journalSketches)
      ? src.journalSketches.filter((sketch) => sketch && typeof sketch.id === 'string' && typeof sketch.title === 'string' && typeof sketch.note === 'string')
      : base.journalSketches || [],
    disciplines,
    audioSettings,
    reducedMotion: reducedMotionOverride ?? base.reducedMotion,
    reducedMotionOverride,
    difficultyMode: src.difficultyMode === 'relaxed' || src.difficultyMode === 'harsh' ? src.difficultyMode : 'standard',
    fishingToggleAssist: Boolean(src.fishingToggleAssist),
    movingBuildingId: null,
    activeMealBuff: src.activeMealBuff ?? null,
    stats: restoreFields(base.stats, src.stats),
    player: {
      ...player,
      charId,
      elevation: player.elevation === 1 ? 1 : 0,
      moveStyle: unlockedStyles.includes(player.moveStyle) ? player.moveStyle : 'hustle',
      gear: restoreFields({ reedRod: false, prismReel: false, ...base.player.gear }, src.player?.gear),
    },
    trips: Object.fromEntries(Object.entries(numericEntries(src.trips)).filter(([id]) => isId(TRIP_VISUAL_META, id))),
    tripMaxDur: Object.fromEntries(Object.entries(numericEntries(src.tripMaxDur)).filter(([id]) => isId(TRIP_VISUAL_META, id))),
    inv: isRecord(src.inv) ? numericEntries(src.inv) : base.inv,
    objects:
      hasSavedWorld && Array.isArray(src.objects)
        ? src.objects.filter((object) => hasPosition(object) && typeof object.id === 'string')
        : base.objects,
    creatures,
    buildings,
    mailboxes,
    projectiles: [],
    ducks: [],
    popups: [],
    inspectorCd: finite(src.inspectorCd, 0),
    shakeBonus: Boolean(src.shakeBonus),
    droppedSatchel: hasPosition(src.droppedSatchel) && isRecord(src.droppedSatchel.items)
      ? { ...src.droppedSatchel, items: numericEntries(src.droppedSatchel.items) }
      : null,
    regionalEvent: src.regionalEvent && typeof src.regionalEvent === 'object' ? src.regionalEvent : null,
    regionalEventCooldownDay: finite(src.regionalEventCooldownDay, 2),
  };

  return migrated;
}
