import type { CampJob, CampProgress, TrailId, WeatherId } from './fieldwork.ts';

export type GameMode = 'title' | 'playing' | 'paused' | 'gameover';

export type CharacterId =
  | 'pip'
  | 'barnaby'
  | 'djmoss'
  | 'gerald'
  | 'tilda'
  | 'brin'
  | 'solfa'
  | 'marlo'
  | 'bea'
  | 'gus'
  | 'nori'
  | 'mossie';
export type MoveStyleId = 'hustle' | 'jelly_hop' | 'toast_skates' | 'astral_glide' | 'crab_scuttle';

export type BiomeId =
  | 'giggle_grove'
  | 'marmalade_flats'
  | 'bureaucracy_bog'
  | 'vinyl_desert'
  | 'great_fridge'
  | 'cloud_laundromat'
  | 'dead_air_basin'
  | 'carbon_copy_delta'
  | 'prism_orchard'
  | 'unpaired_sea'
  | 'midnight_defrost'
  | 'wickwater_afterhours'
  | 'undertone_caverns'
  | 'negative_coast'
  | 'inverted_allotments';

export type PeopleId =
  | 'creasefolk'
  | 'overprints'
  | 'belljacks'
  | 'selvedge'
  | 'glazelings'
  | 'brinebacks'
  | 'lampspun'
  | 'sporesteppers'
  | 'county_local';

export type TechniqueId =
  | 'paper_fold_glide'
  | 'mural_step'
  | 'resonant_stride'
  | 'gust_trimmed_hem'
  | 'refracted_focus'
  | 'current_sense'
  | 'watchkeepers_collar'
  | 'cork_sole_insulation';

export type TransportId =
  | 'groove_express'
  | 'records_ferry'
  | 'sock_clothesline'
  | 'lamp_service_tunnel';

export type DiscoveryState = 'unknown' | 'rumor' | 'seen' | 'visited';

export type TripId =
  | 'kaleido'
  | 'floaty'
  | 'synesthesia'
  | 'chrono'
  | 'cosmic'
  | 'disco'
  | 'prism_refract'
  | 'velvet_fog';
export type TripMood = 'sober' | 'come_up' | 'euphoric' | 'uneasy' | 'bad_trip';
export type TripStage = 'onset' | 'peak' | 'afterglow';
export type TripSynergyId =
  | 'starglass_fractal'
  | 'astral_timefold'
  | 'fever_tapestry'
  | 'hyper_chord'
  | 'nebula_drift';
export type PhaseId = 'day' | 'dusk' | 'night';
export type DifficultyMode = 'standard' | 'relaxed' | 'harsh';
export type FerryFollowUpChoice = 'lure_reflected' | 'bait_garden' | 'comfort_stop';

export type FishId = 'spool_perch' | 'mirror_minnow' | 'receipt_eel';
export type FishingPhase =
  | 'idle'
  | 'casting'
  | 'waiting'
  | 'nibble_1'
  | 'nibble_2'
  | 'bite'
  | 'tension'
  | 'landed'
  | 'escaped';

export interface FishingSession {
  active: boolean;
  phase: FishingPhase;
  targetFish: FishId;
  bobberX: number;
  bobberY: number;
  castSlot: 0 | 1 | 2;
  phaseTimer: number;
  biteWindow: number;
  tension: number; // 0..100 (snap above 96, escape if too slack too long)
  progress: number; // 0..100 (land at 100)
  fishPulling: boolean;
  pullTimer: number;
  inReflection: boolean;
  usingPrismReel: boolean;
  toggleAssist: boolean;
  reelHeld: boolean;
  baitId: string;
  rewardCommitted: boolean;
  lastOutcome: '' | 'landed' | 'escaped';
  lastFishName: string;
}

export interface WaterRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  age: number;
  maxAge: number;
  color: string;
}

export type DisciplineId =
  | 'farming'
  | 'angling'
  | 'cookery'
  | 'fabrication'
  | 'building'
  | 'field_botany'
  | 'acoustics'
  | 'wayfinding'
  | 'creature_care'
  | 'hospitality';

export type PerkId =
  | 'current_reader'
  | 'stillwater_keeper'
  | 'host'
  | 'rigger'
  | 'provisioner'
  | 'tablekeeper'
  | 'graft_sage'
  | 'hydro_tender'
  | 'lens_smith'
  | 'field_tinker'
  | 'field_naturalist'
  | 'nocturnal_spotter'
  | 'echo_listener'
  | 'motif_weaver'
  | 'shortcut_surveyor'
  | 'lantern_strider'
  | 'gentle_hand'
  | 'field_scout'
  | 'warm_welcome'
  | 'county_connector';

export interface DisciplineProgress {
  xp: number;
  tier: 1 | 2 | 3 | 4 | 5;
  perk: PerkId | null;
  distinctActions: string[];
}

export interface JournalSketch {
  id: string;
  title: string;
  note: string;
  category: 'fish' | 'plant' | 'region' | 'ferry';
}

export interface CookingRecipeDef {
  id: string;
  name: string;
  desc: string;
  accent: string;
  primaryAny: string[]; // e.g. ['spool_perch', 'mirror_minnow']
  secondaryAny: string[]; // local substitute ingredient
  outId: string;
  mun: number;
  vib: number;
  wob: number;
  buffLabel: string;
  storageDays: number;
  reqCookeryTier?: number;
}

export interface TripSynergyDef {
  id: TripSynergyId;
  pair: [TripId, TripId];
  name: string;
  accent: string;
  visualDesc: string;
  bonusDesc: string;
  speedBonus?: number;
  enemyTimeScale?: number;
  crystalBonus?: boolean;
  charmAura?: boolean;
}

export interface TripProfile {
  mood: TripMood;
  label: string;
  advice: string;
  stage: TripStage | null;
  stageProgress: number; // 0..1 elapsed through dominant trip
  stageFactor: number; // 0.45..1.0 pharmacokinetic optical envelope
  synergy: TripSynergyDef | null;
  badTripTier: 0 | 1 | 2 | 3; // 0 none, 1 jitters, 2 paranoia, 3 full melt spiral
  intensity: number; // 0..1 overall trip depth
  euphoriaIntensity: number; // 0..1 good-trip peak strength
  badTripIntensity: number; // 0..1 bad-trip melt spiral strength
  dominantTrip: TripId | null;
  cameraZoomAmp: number;
  chromaSplit: number;
  enemyTimeScale: number;
  playerSpeedMult: number;
}

export interface TracerSnapshot {
  x: number;
  y: number;
  facing: number;
  bob: number;
  elevation: 0 | 1;
  color: string;
  alpha: number;
  charId: CharacterId;
}

export interface SoundWaveRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  glyph: string;
  life: number;
  maxLife: number;
}

export interface BadTripPhantom {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  whisper: string;
  seed: number;
}

export type CropId =
  | 'shroom_crop'
  | 'toast_crop'
  | 'pickle_crop'
  | 'party_bagel'
  | 'cosmic_truffle'
  | 'lens_pear_crop'
  | 'compost_moss_crop'
  | 'bell_reed_crop'
  | 'upside_clover_crop';

export type BuildingType =
  | 'lava_lamp'
  | 'mood_plot'
  | 'funk_blender'
  | 'boombox'
  | 'sassy_chest'
  | 'dream_totem'
  | 'vibe_beacon'
  | 'boop_turret'
  | 'camp_table'
  | 'bench'
  | 'dock_lamp'
  | 'rain_trough'
  | 'workbench'
  | 'frost_pantry'
  | 'choir_irrigator'
  | 'camp_awning'
  | 'camp_relay'
  | 'specimen_cabinet';

export type ObjectType =
  | 'tree'
  | 'shroom'
  | 'berry'
  | 'crystal'
  | 'cabinet'
  | 'pickle'
  | 'hyper'
  | 'broc'
  | 'cocoa'
  | 'sock_pile'
  | 'cloud'
  | 'pear_tree'
  | 'receipt_reed'
  | 'wax_bloom'
  | 'frozen_pea'
  | 'geode'
  | 'salvage_crate'
  | 'moon_orchid'
  | 'eye_bloom'
  | 'tuned_reed_patch'
  | 'gravity_clover_patch';

export type CreatureType =
  | 'honk_blimp'
  | 'toast_crab'
  | 'sofa_sloth'
  | 'existential_duck'
  | 'needle_wren'
  | 'lantern_moth'
  | 'reality_inspector'
  | 'paperwork_gremlin'
  | 'frost_cube'
  | 'tax_octopus_boss';

export type HostilePolicy = 'charger' | 'orbiter_ranged' | 'hop_slammer' | 'boss_octopus';

export type ModalType =
  | null
  | 'bag'
  | 'craft'
  | 'style'
  | 'skills'
  | 'quests'
  | 'social'
  | 'dance'
  | 'trade'
  | 'plant'
  | 'wormhole'
  | 'atlas'
  | 'resident'
  | 'settings'
  | 'radio_repair'
  | 'ceremony_choice'
  | 'ferry_note'
  | 'cook'
  | 'camp_manage'
  | 'fieldwork'
  | 'followup_choice'
  | 'all_night_broadcast'
  | 'regional_event';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  tagline: string;
  colors: {
    body: string;
    head: string;
    hat: string;
    limb: string;
    accent: string;
  };
  hat:
    | 'mailman'
    | 'saucer'
    | 'headphones'
    | 'fedora'
    | 'pleat_cap'
    | 'spool_hat'
    | 'wick_flame'
    | 'painter_beret'
    | 'bell_ears'
    | 'steam_lid'
    | 'prism_visor'
    | 'reed_boater';
  maxVibe: number;
  maxMunch: number;
  speed: number;
  perk: string;
  ability: {
    id:
      | 'express_delivery'
      | 'spill_tea'
      | 'drop_bass'
      | 'audit'
      | 'fold_span'
      | 'guide_line'
      | 'lend_glow'
      | 'high_water_mark'
      | 'wall_tap'
      | 'steam_vent'
      | 'split_sunbeam'
      | 'reed_float';
    name: string;
    desc: string;
    cd: number;
  };
  startInv: Record<string, number>;
}

export interface MoveStyleDef {
  id: MoveStyleId;
  name: string;
  spd: number;
  bounce: number;
  hover?: number;
  ignoreMud: boolean;
  desc: string;
}

export interface ItemDef {
  id: string;
  name: string;
  cat: 'mat' | 'rare' | 'cur' | 'tool' | 'food' | 'seed' | 'sub' | 'quest';
  accent: string;
  desc?: string;
  mun?: number;
  vib?: number;
  wob?: number;
  trip?: TripId | 'sober';
  dur?: number;
  quote?: string;
  crop?: CropId;
}

export interface BiomeDef {
  id: BiomeId;
  name: string;
  subtitle: string;
  ring: 'inner' | 'outer';
  loop?: 'broadcast' | 'weather' | 'night_shift' | 'hub';
  ruleSummary: string;
  wobbleHint: string;
  hue: number;
  sat: number;
  lit: number;
  groundHex: string;
  accentHex: string;
  mapCol: string;
  slow: number;
  spin: number;
  cold: number;
}

export interface RegionZone {
  id: BiomeId;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  priority: number;
}

export interface LandmarkDef {
  id: string;
  name: string;
  regionId: BiomeId;
  x: number;
  y: number;
  kind:
    | 'settlement'
    | 'tower'
    | 'ferry'
    | 'greenhouse'
    | 'dock'
    | 'refuge'
    | 'wickworks'
    | 'booth'
    | 'tunnel'
    | 'rooftop'
    | 'market'
    | 'overlook'
    | 'mural'
    | 'cavern'
    | 'press'
    | 'terrace';
  desc: string;
  isWarmRefuge?: boolean;
  transportId?: TransportId;
}

export interface RoadPath {
  id: string;
  loop: 'broadcast' | 'weather' | 'night_shift' | 'hub';
  label: string;
  points: Array<[number, number]>;
  shortcutId?: TransportId;
}

export interface WorldFeatureProp {
  id: string;
  regionId: BiomeId;
  kind:
    | 'mirror'
    | 'sock_half_a'
    | 'sock_half_b'
    | 'defrost_valve'
    | 'radio_tower'
    | 'listening_booth'
    | 'mural_wall'
    | 'stamp_bridge'
    | 'jam_canal'
    | 'wash_line'
    | 'candleboat'
    | 'rooftop_ramp'
    | 'appliance_bulb'
    | 'dryer_lighthouse'
    | 'grooves_track'
    | 'duplicate_drift'
    | 'mailbox_radio'
    | 'ferry_bell'
    | 'tunnel_hatch'
    | 'unsent_letter_box'
    | 'ferry_note'
    | 'fishing_bank'
    | 'dock_lamp_spot'
    | 'tuning_fork'
    | 'tide_press'
    | 'hanging_gutter';
  x: number;
  y: number;
  radius: number;
  angle?: number;
  targetX?: number;
  targetY?: number;
  label: string;
}

export interface TechniqueDef {
  id: TechniqueId;
  peopleId: PeopleId;
  name: string;
  teacher: string;
  accent: string;
  desc: string;
}

export interface ResidentDef {
  id: string;
  name: string;
  people: PeopleId;
  role: string;
  regionId: BiomeId;
  homeX: number;
  homeY: number;
  nightX?: number;
  nightY?: number;
  accent: string;
  greet: string;
  idleAction: string;
  want: string;
  relationship: string;
  weatherLine: string;
  afterHelpLine: string;
  helpFlag?: keyof WorldFlags;
  teaches?: TechniqueId;
  trades?: NpcTrade[];
  disagreementTopic?: string;
}

export interface CropDef {
  id: CropId;
  name: string;
  time: number;
  accent: string;
  yield: Record<string, number>;
  isHybrid?: boolean;
}

export interface RecipeDef {
  id: string;
  name: string;
  type: 'place' | 'gear' | 'style' | 'blend';
  cost: Record<string, number>;
  desc: string;
  gearKey?: 'partyHat' | 'sweater' | 'prismShades' | 'reedRod' | 'prismReel';
  style?: MoveStyleId;
  out?: Record<string, number>;
  reqDisciplines?: Partial<Record<DisciplineId, number>>;
  reqStation?: 'funk_blender' | 'workbench';
  practiceHint?: string;
}

export interface CreatureDef {
  id: CreatureType;
  name: string;
  accent: string;
  hostile?: boolean;
  boss?: boolean;
  policy?: HostilePolicy;
  fav?: string;
  hearts?: number;
  drop: string;
  spd: number;
  maxHp: number;
  perk?: string;
  temperament?: string;
  homeRegion?: BiomeId;
  lines: string[];
}

export interface NpcTrade {
  label: string;
  give: Record<string, number>;
  get?: Record<string, number>;
  style?: MoveStyleId;
}

export interface SkillDef {
  id: string;
  name: string;
  cost: number;
  accent: string;
  desc: string;
}

export interface ExperienceDef {
  id: 'gravity_nap' | 'duck_rain' | 'rave_cloud' | 'polka_eclipse';
  name: string;
  dur: number;
  accent: string;
  desc: string;
}

export interface QuestDef {
  id: string;
  title: string;
  regionId: BiomeId;
  desc: string;
  target: number;
  statKey?: keyof RunStats;
  flagKey?: keyof WorldFlags;
  rewardCaps: number;
  rewardXp: number;
  rewardItems?: Record<string, number>;
}

export interface WorldFlags {
  radioRepaired: boolean;
  radioSolution: '' | CharacterId | 'public';
  radioCustomBeat: number;
  deltaPermitFound: boolean;
  ferryRestored: boolean;
  ferryInsulated: boolean;
  deltaMuralSolved: boolean;
  orchardMirrorsAligned: number; // 0..3
  orchardRipened: boolean;
  sockHalfAFound: boolean;
  sockHalfBFound: boolean;
  socksHung: boolean;
  defrostDiverted: boolean;
  compostPostalAssigned: boolean;
  wickworksRestored: boolean;
  wickwaterCeremony: '' | 'public' | 'private';
  originalDriftFound: boolean;
  rooftopShortcutLearned: boolean;
  // Pass 1: Dinner for the Last Ferry
  ferrySupperStage: 'unstarted' | 'accepted' | 'caught' | 'served';
  ferrySupperServedDay: number; // 0 if unserved, else day number when served
  ferrySupperFollowUp: '' | 'lure_reflected' | 'bait_garden' | 'comfort_stop';
  mirrorMinnowObserved: boolean;
  mirrorMinnowCaught: boolean;
  prismReelLeadUnlocked: boolean;
  dockLampSlot: 0 | 1 | 2;
  // Pass 3: Outer Regions & All-Night Broadcast
  undertoneForkTuned: boolean;
  negativePressRestored: boolean;
  invertedGutterDirected: boolean;
  allNightBroadcastHosted: boolean;
  broadcastStationIndex: number;
}

export interface AudioSettings {
  music: number; // 0..1
  ambience: number; // 0..1
  effects: number; // 0..1
  muted: boolean;
  effectStrength?: number; // 0..1 perceptual trip visual strength
  flashFree?: boolean;
  stableCamera?: boolean;
}

export interface DroppedSatchel {
  x: number;
  y: number;
  day: number;
  biomeName: string;
  items: Record<string, number>;
}

export type RegionalEventId = 'delta_ink_swell' | 'orchard_prism_fog' | 'cavern_echo_drift';

export interface RegionalEventState {
  id: RegionalEventId;
  title: string;
  regionId: BiomeId;
  eyewitnessId: string;
  eyewitnessName: string;
  summary: string;
  groundedReason: string;
  startedDay: number;
  optionALabel: string;
  optionADesc: string;
  optionBLabel: string;
  optionBDesc: string;
}

export interface CampShelterStatus {
  sheltered: boolean;
  reason: string;
}

export interface WorldObject {
  id: string;
  type: ObjectType;
  regionId: BiomeId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  seed: number;
  shake: number;
  hitFlash: number;
  respawn: number;
  ripeChime?: boolean;
}

export interface Building {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  phase: number;
  crop: CropId | null;
  growth: number;
  rotation?: number; // 0..3 quarter-turns
  hasSecondSetting?: boolean;
}

export interface Mailbox {
  id: number;
  x: number;
  y: number;
  biomeId: BiomeId;
  biomeName: string;
  col: string;
  discovered: boolean;
}

export interface Creature {
  id: string;
  type: CreatureType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  hp: number;
  maxHp: number;
  tamed: boolean;
  hearts: number;
  buddyTimer: number;
  timer: number;
  seed: number;
  say: string;
  sayTimer: number;
  hitAnim: number;
  hitFlash: number;
  danceTimer: number;
  frozenTimer: number;
  footLift: number; // Needle Wren groove reversal signal
  aiState: 'idle' | 'windup' | 'attack' | 'recover' | 'ko';
  aiTimer: number;
  telegraphX: number;
  telegraphY: number;
  telegraphRadius: number;
  koTimer: number;
  hasToken: boolean;
}

export interface Projectile {
  id: string;
  fromPlayer: boolean;
  kind: 'parcel' | 'red_tape' | 'audit_orb';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  color: string;
}

export interface FallingDuck {
  x: number;
  y: number;
  z: number;
  seed: number;
}

export interface FloatingPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface PlayerState {
  charId: CharacterId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  elevation: 0 | 1; // 0 ground, 1 rooftop/clothesline
  bob: number;
  squashX: number;
  squashY: number;
  vibe: number;
  maxVibe: number;
  munch: number;
  maxMunch: number;
  wobble: number;
  moveStyle: MoveStyleId;
  actionAnim: number;
  hitFlash: number;
  invulnTimer: number;
  rollTimer: number;
  rollCd: number;
  abCd: number;
  gear: {
    partyHat: boolean;
    sweater: boolean;
    prismShades: boolean;
    reedRod?: boolean;
    prismReel?: boolean;
  };
}

export interface RunStats {
  harvests: number;
  tripsTaken: number;
  cropsHarvested: number;
  buddiesTamed: number;
  crystalsFound: number;
  bossDefeated: number;
  enemiesBonked: number;
  daysSurvived: number;
  fishCaught?: number;
  mealsCooked?: number;
  buildingsBuilt?: number;
}

export interface Waypoint {
  x: number;
  y: number;
  label: string;
}

export interface GameState {
  version: number;
  camp: CampProgress;
  worldSeed: number;
  time: number;
  dayTime: number;
  day: number;
  dead: boolean;
  victory: boolean;
  deathReason: string;
  ghostTimer: number;
  exp: (ExperienceDef & { rem: number }) | null;
  expCooldown: number;
  xp: number;
  sp: number;
  skills: string[];
  techniques: TechniqueId[];
  unlockedStyles: MoveStyleId[];
  unlockedTransports: TransportId[];
  claimedQuests: string[];
  discoveries: Record<string, DiscoveryState>;
  npcMemories: Record<string, { talked: boolean; helped: boolean; visits: number }>;
  worldFlags: WorldFlags;
  mirrorAngles: Record<string, number>;
  waypoint: Waypoint | null;
  journalNotes: string[];
  journalSketches?: JournalSketch[];
  disciplines?: Record<DisciplineId, DisciplineProgress>;
  audioSettings: AudioSettings;
  reducedMotion: boolean;
  difficultyMode?: 'standard' | 'relaxed' | 'harsh';
  fishingToggleAssist?: boolean;
  movingBuildingId?: string | null;
  activeMealBuff?: { name: string; rem: number; speedBonus?: number; coldResist?: boolean } | null;
  stats: RunStats;
  player: PlayerState;
  trips: Partial<Record<TripId, number>>;
  tripMaxDur?: Partial<Record<TripId, number>>;
  inv: Record<string, number>;
  objects: WorldObject[];
  creatures: Creature[];
  buildings: Building[];
  mailboxes: Mailbox[];
  projectiles: Projectile[];
  ducks: FallingDuck[];
  popups: FloatingPopup[];
  inspectorCd: number;
  shakeBonus: boolean;
  droppedSatchel?: DroppedSatchel | null;
  regionalEvent?: RegionalEventState | null;
  regionalEventCooldownDay?: number;
}

export interface InteractPrompt {
  x: number;
  y: number;
  label: string;
  accent: string;
}

export interface RegionTimingCue {
  label: string;
  progress: number; // 0..1
  warning: boolean;
  accent: string;
}

export interface CampSupperStatus {
  hasTable: boolean;
  hasBenchNearTable: boolean;
  hasLampNearTable: boolean;
  hasBellReedPlanted: boolean;
  hasCookedSupper: boolean;
  readyToServe: boolean;
  tableId: string | null;
}

export interface CountySyncStatus {
  restoredCount: number;
  totalRestorations: number;
  readyForBroadcast: boolean;
  peacefulRoute: boolean;
  leadEpilogue: string;
  completedLabels: string[];
  broadcastLines: string[];
}

export interface HudSnapshot {
  mode: GameMode;
  weather: { current: WeatherId; next: WeatherId; active: boolean; sheltered: boolean };
  fieldwork: {
    provisions: number;
    site: string | null;
    nearbySite: boolean;
    hasSite: boolean;
    nearCampAnchor: boolean;
    report: string[];
    lastShiftDay: number;
    wardActive: boolean;
    companions: Array<{ id: string; name: string; job: CampJob | null }>;
    trail: { id: TrailId; gate: number; total: number; seconds: number; label: string; roll: boolean } | null;
    trailRecords: CampProgress['trailRecords'];
  };
  day: number;
  dayTime: number;
  phaseId: PhaseId;
  phaseName: string;
  biomeId: BiomeId;
  biomeName: string;
  biomeRule: string;
  charId: CharacterId;
  vibe: number;
  maxVibe: number;
  munch: number;
  maxMunch: number;
  wobble: number;
  elevation: 0 | 1;
  ghostTimer: number;
  xp: number;
  xpNext: number;
  sp: number;
  abCd: number;
  abMaxCd: number;
  rollCd: number;
  moveStyle: MoveStyleId;
  activeTrips: Array<{ id: TripId; name: string; accent: string; rem: number; stage: TripStage }>;
  tripMood: TripMood;
  tripLabel: string;
  tripAdvice: string;
  tripStage: TripStage | null;
  tripStageProgress: number;
  tripSynergy: { id: TripSynergyId; name: string; accent: string; bonusDesc: string } | null;
  badTripTier: 0 | 1 | 2 | 3;
  badTripIntensity: number;
  euphoriaIntensity: number;
  dominantTrip: TripId | null;
  nearCalmingTotem: boolean;
  quickSlots: Array<{ id: string; name: string; qty: number; accent: string; kind: 'sub' | 'food' | 'sober' | 'tool'; trip?: TripId | 'sober' }>;
  exp: { name: string; rem: number; accent: string } | null;
  caps: number;
  gossip: number;
  socks: number;
  tamedCount: number;
  maxBuddies: number;
  unclaimedQuests: number;
  activeQuestTitle: string;
  activeQuestProgress: string;
  inv: Record<string, number>;
  skills: string[];
  techniques: TechniqueId[];
  unlockedStyles: MoveStyleId[];
  unlockedTransports: TransportId[];
  claimedQuests: string[];
  discoveries: Record<string, DiscoveryState>;
  worldFlags: WorldFlags;
  waypoint: Waypoint | null;
  waypointDist: number | null;
  waypointAngle: number | null;
  nearestRefugeDist: number;
  nearestRefugeAngle: number;
  timingCue: RegionTimingCue | null;
  radioBroadcastLine: string | null;
  audioSettings: AudioSettings;
  reducedMotion: boolean;
  difficultyMode: 'standard' | 'relaxed' | 'harsh';
  gear: PlayerState['gear'];
  stats: RunStats;
  shakeBonus: boolean;
  nearBlender: boolean;
  nearWorkbench: boolean;
  nearDock: boolean;
  dockLampSlot: 0 | 1 | 2;
  dockReflectionIntact: boolean;
  fishing: FishingSession;
  disciplines: Record<DisciplineId, DisciplineProgress>;
  journalSketches: JournalSketch[];
  campSupperStatus: CampSupperStatus;
  campShelter: CampShelterStatus;
  countySync: CountySyncStatus;
  droppedSatchel: DroppedSatchel | null;
  regionalEvent: RegionalEventState | null;
  ferryEveningActive: boolean;
  movingBuildingId: string | null;
  activeMealBuff: { name: string; rem: number } | null;
  deathReason: string;
  victory: boolean;
  muted: boolean;
  promptLabel: string | null;
  playerX: number;
  playerY: number;
  journalNotes: string[];
}
