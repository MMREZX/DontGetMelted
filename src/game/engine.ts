import { FunkAudio } from './audio';
import {
  BIOMES,
  CHARACTERS,
  CREATURE_DEFS,
  CROPS,
  DAY_LENGTH,
  EXPERIENCES,
  ITEMS,
  MAX_ATTACK_TOKENS,
  QUESTS,
  RECIPES,
  RESIDENTS,
  SAVE_KEY,
  SKILLS,
  STYLES,
  TECHNIQUES,
  WORLD_R,
} from './data';
import {
  awardDisciplinePractice,
  COOKING_RECIPES,
  createInitialDisciplines,
  DISCIPLINES,
  hasPerk,
  selectDisciplinePerk,
  TIER_NAMES,
} from './disciplines';
import {
  computeDockReflectionState,
  createIdleFishingSession,
  DELTA_BANK_X,
  DELTA_BANK_Y,
  DOCK_LAMP_SLOTS,
  evaluateCampSupperStatus,
  FISH_DEFS,
  getCampSupperDish,
  startFishingCast,
  stepFishingSession,
  triggerFishingHookOrReel,
} from './fishing';
import {
  CAMP_JOBS,
  createCampProgress,
  getCountyWeather,
  getWeatherPressure,
  isWeatherActive,
  MAX_CAMP_PROVISIONS,
  resolveCampShift,
  RIBBON_TRAILS,
  stepTrail,
  WEATHER,
} from './fieldwork';
import type { CampJob, TrailId, TrailRun } from './fieldwork';
import { drawRibbonGate, drawWeatherVeil } from './fieldworkArt';
import {
  applyXpGain,
  BAD_TRIP_WHISPERS,
  buildMeltRecoveryOutcome,
  canCraftRecipe,
  canSeeCrystals,
  checkHybridPair,
  clampToWorld,
  computeCountySyncStatus,
  computeCropGrowthDelta,
  computeMirrorRipenCount,
  computeNightVibeDelta,
  computeTripProfile,
  computeTripStage,
  countUnclaimedQuests,
  evaluateCampShelter,
  evaluateRegionalEventTrigger,
  findNearestWarmRefuge,
  getActiveQuestSummary,
  getBiomeAt,
  getDiscountedCost,
  getEffectiveBarterCost,
  getEffectiveRecipeCost,
  getGhostTimerDuration,
  getPhaseFromDayTime,
  getQuestProgress,
  getRadioBroadcastLine,
  getRegionPhysics,
  getResidentPosition,
  getSalvageRefund,
  getXpThreshold,
  hasIngredients,
  isCropReady,
  TRIP_VISUAL_META,
  updateDiscoveryAtPosition,
  upgradeDiscovery,
  validateBuildingPlacement,
} from './rules';
import {
  createDefaultMirrorAngles,
  createInitialDiscoveries,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_WORLD_FLAGS,
  hasSavedGame,
  safeLoadAndMigrate,
  SAVE_VERSION,
} from './save';
import {
  drawBuilding,
  drawCreature,
  drawDroppedSatchel,
  drawFishingSession,
  drawInteractPrompt,
  drawMailbox,
  drawPlayer,
  drawProjectile,
  drawResident,
  drawTerrain,
  drawWaterRipples,
  drawWorldCompass,
  drawWorldFeature,
  drawWorldObject,
} from './sprites';
import { drawTripScreenOverlay, drawTripWorldLayer, getTripDominantColor } from './tripFx';
import { LANDMARKS, mulberry32, REGION_ZONES, ROADS, TRANSPORT_ROUTES, WORLD_FEATURES } from './world';
import type {
  AudioSettings,
  BadTripPhantom,
  BiomeId,
  Building,
  CharacterId,
  Creature,
  CreatureType,
  DifficultyMode,
  DisciplineId,
  FishingSession,
  GameMode,
  GameState,
  HudSnapshot,
  InteractPrompt,
  ModalType,
  MoveStyleId,
  ObjectType,
  PerkId,
  PhaseId,
  ResidentDef,
  SoundWaveRipple,
  TechniqueId,
  TracerSnapshot,
  TransportId,
  TripId,
  WaterRipple,
  Waypoint,
} from './types';

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  kind: 'dot' | 'ring' | 'note';
}

interface AmbientMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

export interface EngineCallbacks {
  onHudUpdate: (snap: HudSnapshot) => void;
  onToast: (msg: string) => void;
  onOpenModal: (modal: ModalType, payload?: { creatureId?: string; residentId?: string; plotId?: string; buildingId?: string }) => void;
  onModeChange: (mode: GameMode) => void;
}

const POOL_SIZE = 260;
const SIMULATION_STEP = 1 / 60;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private callbacks: EngineCallbacks;
  public audio = new FunkAudio();

  private mode: GameMode = 'title';
  private activeModal: ModalType = null;
  public state: GameState;

  private width = 1280;
  private height = 720;
  private rafId = 0;
  private lastTs = 0;
  private hudTimer = 0;
  private discoveryTimer = 0;
  private pearChimeCd = 0;
  private stepSoundAccum = 0;
  private hitstop = 0;
  private trauma = 0;
  private camX = 0;
  private camY = 0;
  private defeatDelay = 0;

  private heldKeys = new Set<string>();
  private rollBuffer = 0;
  private boopBuffer = 0;
  private abBuffer = 0;
  public joy = { active: false, id: null as number | null, ox: 0, oy: 0, cx: 0, cy: 0, dx: 0, dy: 0 };

  private particles: PooledParticle[] = [];
  private particleCursor = 0;
  private ambientMotes: AmbientMote[] = [];
  private playerTracers: TracerSnapshot[] = [];
  private tracerTimer = 0;
  private soundRipples: SoundWaveRipple[] = [];
  private waterRipples: WaterRipple[] = [];
  private badTripPhantoms: BadTripPhantom[] = [];
  private phantomSpawnTimer = 0;
  private lastBadTripNotice = false;

  public fishing: FishingSession = createIdleFishingSession();
  private selectedCastSlot = 0;
  private trailRun: TrailRun | null = null;
  private buildingMove: { id: string; rotation: number } | null = null;
  private foldSpanTimer = 0;
  private guideLineTimer = 0;
  private ferryCallTimer = 3.5;
  private lastDockDisturbed = false;

  public danceState: { creatureId: string; radius: number; hits: number; needed: number; radioMode?: boolean } | null = null;
  private nearestPrompt: InteractPrompt | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private destroyed = false;
  private pausedRendered = false;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context unavailable');
    this.ctx = context;
    this.callbacks = callbacks;

    for (let i = 0; i < POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 5,
        color: '#ffd166',
        life: 0,
        maxLife: 0.5,
        kind: 'dot',
      });
    }
    for (let i = 0; i < 36; i++) {
      this.ambientMotes.push({
        x: rand(-700, 700),
        y: rand(-500, 500),
        vx: rand(-12, 12),
        vy: rand(-14, -4),
        r: rand(1.8, 3.8),
        phase: rand(0, Math.PI * 2),
      });
    }

    this.state = this.buildInitialWorld('pip', 198477);
    this.audio.applySettings(this.state.audioSettings);
    this.syncSize();
    this.attachEvents();
  }

  public setMinimapCanvas(canvas: HTMLCanvasElement | null): void {
    this.minimapCanvas = canvas;
  }

  public startLoop(): void {
    if (this.rafId || this.destroyed) return;
    this.lastTs = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      if (this.destroyed) return;
      elapsed += document.hidden ? 0 : Math.min(0.1, Math.max(0, (now - this.lastTs) / 1000));
      this.lastTs = now;
      while (elapsed >= SIMULATION_STEP) {
        this.update(SIMULATION_STEP);
        elapsed -= SIMULATION_STEP;
      }

      const isStaticPaused = this.mode === 'title' || this.mode === 'paused' || (this.activeModal !== null && !this.danceState);
      if (!document.hidden && (!isStaticPaused || !this.pausedRendered)) {
        this.render();
        this.pausedRendered = isStaticPaused;
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
    this.emitHud();
  }

  public destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.audio.destroy();
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.syncSize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.clearInputs);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.handleTouchEnd);
  }

  private syncSize = (): void => {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect ? rect.width : window.innerWidth));
    const h = Math.max(1, Math.round(rect ? rect.height : window.innerHeight));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.pausedRendered = false;
    }
    this.width = w;
    this.height = h;
  };

  private attachEvents(): void {
    if (typeof ResizeObserver !== 'undefined' && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(this.syncSize);
      this.resizeObserver.observe(this.canvas.parentElement);
    } else {
      window.addEventListener('resize', this.syncSize);
    }
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.clearInputs);
    document.addEventListener('visibilitychange', this.handleVisibility);
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd);
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd);
  }

  private clearInputs = (): void => {
    this.heldKeys.clear();
    this.boopBuffer = 0;
    this.rollBuffer = 0;
    this.abBuffer = 0;
    if (!this.fishing.toggleAssist) this.fishing.reelHeld = false;
    this.joy = { active: false, id: null, ox: 0, oy: 0, cx: 0, cy: 0, dx: 0, dy: 0 };
  };

  private handleVisibility = (): void => {
    this.lastTs = performance.now();
    if (document.hidden) this.clearInputs();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.mode === 'title' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target instanceof Element ? e.target : null;
    if (e.code !== 'Escape' && target?.closest('input, select, textarea, [contenteditable]')) return;
    if ((e.code === 'Space' || e.code === 'Enter') && target?.closest('button, a[href]')) return;
    this.audio.unlock();

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (e.repeat) return;
      if (this.mode === 'paused') {
        this.setMode('playing');
        return;
      }
      if (this.activeModal) {
        this.setActiveModal(null);
        return;
      }
      if (this.buildingMove) {
        this.cancelMoveBuilding();
        return;
      }
      if (this.fishing.active) {
        this.cancelFishing();
        return;
      }
      if (this.mode === 'playing') {
        this.setMode('paused');
        return;
      }
    }

    if (e.code === 'KeyM' && !e.repeat) {
      this.toggleMute();
      return;
    }

    if (this.mode !== 'playing') return;

    if (!e.repeat) {
      if (!this.activeModal && this.buildingMove) {
        if (e.code === 'KeyR') {
          this.rotateBuilding(this.buildingMove.id);
          return;
        }
        if (e.code === 'Space' || e.code === 'Enter') {
          this.placeMovedBuilding();
          return;
        }
      }
      if (e.code === 'KeyL' && !this.activeModal && this.isNearDock()) {
        this.moveDockLamp();
        return;
      }
      if (e.code === 'KeyB') {
        this.toggleModal('bag');
        return;
      }
      if (e.code === 'KeyC') {
        this.toggleModal('craft');
        return;
      }
      if (e.code === 'KeyV') {
        this.toggleModal('style');
        return;
      }
      if (e.code === 'KeyK') {
        this.toggleModal('skills');
        return;
      }
      if (e.code === 'KeyQ') {
        this.toggleModal('quests');
        return;
      }
      if (e.code === 'KeyG') {
        this.toggleModal('atlas');
        return;
      }
      if (e.code === 'KeyH') {
        this.toggleModal('fieldwork');
        return;
      }
    }

    if (this.activeModal) return;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    const isFresh = !this.heldKeys.has(e.code);
    this.heldKeys.add(e.code);

    if (isFresh) {
      if (e.code === 'Space') {
        if (this.fishing.active) {
          this.handleFishingActionDown();
        } else {
          this.boopBuffer = 0.13;
        }
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.rollBuffer = 0.13;
      if (e.code === 'KeyE') this.abBuffer = 0.13;
      if (e.code === 'Digit1') this.quickConsumeSlot(0);
      if (e.code === 'Digit2') this.quickConsumeSlot(1);
      if (e.code === 'Digit3') this.quickConsumeSlot(2);
      if (e.code === 'Digit4') this.quickConsumeSlot(3);
      if (e.code === 'Digit5') this.quickConsumeSlot(4);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const wasHeld = this.heldKeys.delete(e.code);
    if (wasHeld && e.code === 'Space' && this.fishing.active && !this.fishing.toggleAssist) {
      this.setFishingReel(false);
    }
  };

  private handleTouchStart = (e: TouchEvent): void => {
    this.audio.unlock();
    if (this.mode !== 'playing' || this.activeModal) return;
    for (const t of Array.from(e.changedTouches)) {
      if (!this.joy.active && t.clientX < this.width * 0.55) {
        this.joy = {
          active: true,
          id: t.identifier,
          ox: t.clientX,
          oy: t.clientY,
          cx: t.clientX,
          cy: t.clientY,
          dx: 0,
          dy: 0,
        };
      }
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.joy.active) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.joy.id) {
        let dx = t.clientX - this.joy.ox;
        let dy = t.clientY - this.joy.oy;
        const d = Math.hypot(dx, dy);
        if (d > 54) {
          dx = (dx / d) * 54;
          dy = (dy / d) * 54;
        }
        this.joy.cx = this.joy.ox + dx;
        this.joy.cy = this.joy.oy + dy;
        this.joy.dx = dx / 54;
        this.joy.dy = dy / 54;
      }
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    for (const t of Array.from(e.changedTouches)) {
      if (this.joy.active && t.identifier === this.joy.id) {
        this.joy = { active: false, id: null, ox: 0, oy: 0, cx: 0, cy: 0, dx: 0, dy: 0 };
      }
    }
  };

  public setMode(next: GameMode): void {
    this.mode = next;
    if (next === 'title' || next === 'gameover') {
      this.buildingMove = null;
      this.trailRun = null;
    }
    document.body.dataset.state = next;
    this.pausedRendered = false;
    this.clearInputs();
    this.callbacks.onModeChange(next);
    this.emitHud();
  }

  public setActiveModal(modal: ModalType, payload?: { creatureId?: string; residentId?: string; plotId?: string; buildingId?: string }): void {
    this.activeModal = modal;
    this.pausedRendered = false;
    if (modal) this.clearInputs();
    if (modal !== 'dance') this.danceState = null;
    this.callbacks.onOpenModal(modal, payload);
    this.emitHud();
  }

  private toggleModal(modal: ModalType): void {
    if (this.activeModal === modal) {
      this.setActiveModal(null);
    } else {
      this.setActiveModal(modal);
    }
  }

  public toggleMute(): void {
    this.audio.unlock();
    this.state.audioSettings.muted = !this.state.audioSettings.muted;
    this.audio.applySettings(this.state.audioSettings);
    if (this.mode === 'playing') this.saveGame(true);
    this.emitHud();
  }

  public updateAudioSettings(partial: Partial<AudioSettings>): void {
    this.audio.unlock();
    this.state.audioSettings = { ...this.state.audioSettings, ...partial };
    this.audio.applySettings(this.state.audioSettings);
    if (this.mode === 'playing') this.saveGame(true);
    this.emitHud();
  }

  public toggleReducedMotion(): void {
    this.state.reducedMotion = !this.state.reducedMotion;
    this.callbacks.onToast(
      this.state.reducedMotion
        ? 'Reduced Motion enabled: gentler sway, clear static timing arrows.'
        : 'Standard Motion restored.',
    );
    if (this.mode === 'playing') this.saveGame(true);
    this.emitHud();
  }

  public setWaypoint(wp: Waypoint | null): void {
    if (wp) this.trailRun = null;
    this.state.waypoint = wp;
    if (wp) {
      this.audio.ding();
      this.callbacks.onToast(`Atlas compass set to ${wp.label}.`);
    }
    this.emitHud();
  }

  public hasSave(): boolean {
    try {
      return hasSavedGame(localStorage);
    } catch {
      return false;
    }
  }

  public saveGame(silent = false): boolean {
    if (this.state.dead) return false;
    try {
      this.state.version = SAVE_VERSION;
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      if (!silent) {
        this.audio.ding();
        this.callbacks.onToast('Progress & county atlas saved to your satchel.');
      }
      return true;
    } catch {
      if (!silent) this.callbacks.onToast('Progress could not be saved. Browser storage is unavailable or full.');
      return false;
    }
  }

  public loadGame(): boolean {
    try {
      const { state: migrated, backupPreserved, unreadable } = safeLoadAndMigrate(
        localStorage,
        (c, seed) => this.buildInitialWorld(c, seed),
      );
      if (!migrated) {
        if (unreadable) this.callbacks.onToast(backupPreserved
          ? 'This save could not be loaded. A copy was saved in browser storage.'
          : 'This save could not be loaded. The original is still in browser storage.');
        return false;
      }
      this.state = migrated;
      this.prepareRun();
      this.audio.unlock();
      this.setMode(migrated.dead ? 'gameover' : 'playing');
      const ch = CHARACTERS[this.state.player.charId];
      this.callbacks.onToast(`Resumed Day ${this.state.day} as ${ch.name}.`);
      return true;
    } catch {
      this.callbacks.onToast('The saved adventure could not be loaded.');
      return false;
    }
  }

  public startNewGame(charId: CharacterId): void {
    this.audio.unlock();
    const seed = Math.floor(100000 + Math.random() * 899999);
    const { audioSettings, reducedMotion, fishingToggleAssist } = this.state;
    this.state = this.buildInitialWorld(charId, seed);
    this.state.audioSettings = { ...audioSettings };
    this.state.reducedMotion = reducedMotion;
    this.state.fishingToggleAssist = fishingToggleAssist;
    this.prepareRun();
    this.setMode('playing');
    const ch = CHARACTERS[charId];
    this.callbacks.onToast(
      `Welcome, ${ch.name}! Check the Damp Ferry Note in Mailbox Square, or open Atlas (G) to plot your route!`,
    );
  }

  private prepareRun(): void {
    this.audio.reset();
    this.audio.applySettings(this.state.audioSettings);
    this.camX = this.state.player.x;
    this.camY = this.state.player.y;
    this.hitstop = 0;
    this.trauma = 0;
    this.defeatDelay = 0;
    this.activeModal = null;
    this.danceState = null;
    this.fishing = createIdleFishingSession(Boolean(this.state.fishingToggleAssist));
    this.trailRun = null;
    this.selectedCastSlot = this.fishing.castSlot;
    this.buildingMove = null;
    this.foldSpanTimer = 0;
    this.guideLineTimer = 0;
    this.discoveryTimer = 0;
    this.pearChimeCd = 0;
    this.stepSoundAccum = 0;
    this.hudTimer = 0;
    this.tracerTimer = 0;
    this.phantomSpawnTimer = 0;
    this.ferryCallTimer = 3.5;
    this.lastDockDisturbed = false;
    this.playerTracers = [];
    this.soundRipples = [];
    this.waterRipples = [];
    this.badTripPhantoms = [];
    this.lastBadTripNotice = false;
    for (const particle of this.particles) particle.active = false;
    this.nearestPrompt = this.computeNearestPrompt();
    this.callbacks.onOpenModal(null);
  }

  private buildInitialWorld(charId: CharacterId, worldSeed = 198477): GameState {
    const ch = CHARACTERS[charId] || CHARACTERS.pip;
    const rng = mulberry32(worldSeed);
    const objects: GameState['objects'] = [];
    const creatures: Creature[] = [];
    const mailboxes: GameState['mailboxes'] = [];

    // 15 Regional Wormhole Mailboxes at key county hubs
    const mailboxCoords: Array<{ biomeId: BiomeId; x: number; y: number; discovered: boolean }> = [
      { biomeId: 'giggle_grove', x: -145, y: -145, discovered: true },
      { biomeId: 'vinyl_desert', x: -5020, y: -2900, discovered: false },
      { biomeId: 'bureaucracy_bog', x: 850, y: -3720, discovered: false },
      { biomeId: 'marmalade_flats', x: 3360, y: -670, discovered: false },
      { biomeId: 'cloud_laundromat', x: 3220, y: 2990, discovered: false },
      { biomeId: 'great_fridge', x: -4760, y: 4010, discovered: false },
      { biomeId: 'dead_air_basin', x: -8780, y: -6040, discovered: false },
      { biomeId: 'carbon_copy_delta', x: -2460, y: -8720, discovered: false },
      { biomeId: 'prism_orchard', x: 8790, y: -3830, discovered: false },
      { biomeId: 'unpaired_sea', x: 8580, y: 3540, discovered: false },
      { biomeId: 'midnight_defrost', x: -8160, y: 7020, discovered: false },
      { biomeId: 'wickwater_afterhours', x: -1670, y: 9120, discovered: false },
      { biomeId: 'undertone_caverns', x: -9120, y: 820, discovered: false },
      { biomeId: 'negative_coast', x: 4220, y: -8220, discovered: false },
      { biomeId: 'inverted_allotments', x: 4520, y: 8280, discovered: false },
    ];
    mailboxCoords.forEach((mc, i) => {
      mailboxes.push({
        id: i,
        x: mc.x,
        y: mc.y,
        biomeId: mc.biomeId,
        biomeName: BIOMES[mc.biomeId].name,
        col: BIOMES[mc.biomeId].mapCol,
        discovered: mc.discovered,
      });
    });

    // Starter welcoming Grove forage props right near spawn
    const starterProps: Array<{ type: ObjectType; x: number; y: number }> = [
      { type: 'tree', x: 155, y: 95 },
      { type: 'shroom', x: -105, y: 120 },
      { type: 'berry', x: 115, y: -105 },
      { type: 'tree', x: -215, y: 45 },
      { type: 'crystal', x: 185, y: -20 },
      { type: 'shroom', x: 40, y: 165 },
    ];
    starterProps.forEach((sp, i) => {
      const maxHp = sp.type === 'tree' ? 3 : sp.type === 'crystal' ? 2 : 1;
      objects.push({
        id: `starter_${i}`,
        type: sp.type,
        regionId: 'giggle_grove',
        x: sp.x,
        y: sp.y,
        hp: maxHp,
        maxHp,
        seed: i * 11.7 + 1.3,
        shake: 0,
        hitFlash: 0,
        respawn: 0,
      });
    });

    // Deterministic seeded scenery distributed cleanly across all 12 REGION_ZONES
    const propsPerZone = 42;
    let objIdx = 0;
    for (const zone of REGION_ZONES) {
      for (let i = 0; i < propsPerZone; i++) {
        const ang = rng() * Math.PI * 2;
        const rad = Math.sqrt(rng()) * 0.88;
        const x = zone.cx + Math.cos(ang) * zone.rx * rad;
        const y = zone.cy + Math.sin(ang) * zone.ry * rad;
        if (Math.hypot(x, y) < 260) continue;
        if (LANDMARKS.some((lm) => Math.hypot(lm.x - x, lm.y - y) < 165)) continue;
        if (WORLD_FEATURES.some((f) => Math.hypot(f.x - x, f.y - y) < 130)) continue;

        const rl = rng();
        let ty: ObjectType = 'tree';
        if (zone.id === 'giggle_grove') {
          ty =
            rl < 0.34
              ? 'tree'
              : rl < 0.54
                ? 'shroom'
                : rl < 0.7
                  ? 'berry'
                  : rl < 0.8
                    ? 'eye_bloom'
                    : rl < 0.88
                      ? 'moon_orchid'
                      : rl < 0.94
                        ? 'salvage_crate'
                        : 'crystal';
        } else if (zone.id === 'marmalade_flats') ty = rl < 0.32 ? 'tree' : rl < 0.58 ? 'berry' : rl < 0.76 ? 'shroom' : rl < 0.88 ? 'salvage_crate' : 'crystal';
        else if (zone.id === 'bureaucracy_bog') ty = rl < 0.32 ? 'cabinet' : rl < 0.58 ? 'pickle' : rl < 0.74 ? 'tree' : rl < 0.88 ? 'salvage_crate' : 'crystal';
        else if (zone.id === 'vinyl_desert' || zone.id === 'dead_air_basin') ty = rl < 0.4 ? 'hyper' : rl < 0.64 ? 'tree' : rl < 0.82 ? 'geode' : 'crystal';
        else if (zone.id === 'great_fridge') ty = rl < 0.38 ? 'broc' : rl < 0.68 ? 'cocoa' : rl < 0.84 ? 'geode' : 'crystal';
        else if (zone.id === 'cloud_laundromat' || zone.id === 'unpaired_sea') ty = rl < 0.4 ? 'sock_pile' : rl < 0.68 ? 'cloud' : rl < 0.84 ? 'eye_bloom' : 'crystal';
        else if (zone.id === 'carbon_copy_delta') ty = rl < 0.44 ? 'receipt_reed' : rl < 0.7 ? 'pickle' : rl < 0.86 ? 'salvage_crate' : 'crystal';
        else if (zone.id === 'prism_orchard') ty = rl < 0.52 ? 'pear_tree' : rl < 0.74 ? 'geode' : rl < 0.88 ? 'crystal' : 'eye_bloom';
        else if (zone.id === 'midnight_defrost') ty = rl < 0.42 ? 'frozen_pea' : rl < 0.7 ? 'broc' : rl < 0.85 ? 'moon_orchid' : 'crystal';
        else if (zone.id === 'wickwater_afterhours') ty = rl < 0.44 ? 'wax_bloom' : rl < 0.68 ? 'moon_orchid' : rl < 0.84 ? 'cocoa' : 'crystal';
        else if (zone.id === 'undertone_caverns') ty = rl < 0.46 ? 'tuned_reed_patch' : rl < 0.7 ? 'moon_orchid' : rl < 0.86 ? 'geode' : 'crystal';
        else if (zone.id === 'negative_coast') ty = rl < 0.4 ? 'receipt_reed' : rl < 0.66 ? 'geode' : rl < 0.84 ? 'salvage_crate' : 'crystal';
        else if (zone.id === 'inverted_allotments') ty = rl < 0.46 ? 'gravity_clover_patch' : rl < 0.68 ? 'pear_tree' : rl < 0.85 ? 'berry' : 'shroom';

        const maxHp =
          ty === 'tree' || ty === 'cabinet' || ty === 'pear_tree' || ty === 'geode'
            ? 3
            : ty === 'crystal' || ty === 'salvage_crate'
              ? 2
              : 1;
        objects.push({
          id: `obj_${objIdx++}`,
          type: ty,
          regionId: zone.id,
          x,
          y,
          hp: maxHp,
          maxHp,
          seed: rng() * 99,
          shake: 0,
          hitFlash: 0,
          respawn: 0,
          ripeChime: ty === 'pear_tree' && rl < 0.35,
        });
      }
    }

    // Hand-placed starter showcase specimens right around Giggle-Grove so players spot the new cross-genre assets quickly
    const showcaseProps: Array<[ObjectType, number, number, number]> = [
      ['eye_bloom', 165, 130, 1],
      ['moon_orchid', -215, 115, 1],
      ['geode', 260, -90, 3],
      ['salvage_crate', -280, -30, 2],
    ];
    for (const [ty, sx, sy, maxHp] of showcaseProps) {
      objects.push({
        id: `obj_show_${objIdx++}`,
        type: ty,
        regionId: 'giggle_grove',
        x: sx,
        y: sy,
        hp: maxHp,
        maxHp,
        seed: objIdx * 7.3,
        shake: 0,
        hitFlash: 0,
        respawn: 0,
      });
    }

    const makeCreature = (type: CreatureType, x: number, y: number, idSuffix: string): Creature => {
      const def = CREATURE_DEFS[type];
      return {
        id: `cr_${idSuffix}`,
        type,
        x,
        y,
        vx: 0,
        vy: 0,
        facing: 1,
        hp: def.maxHp,
        maxHp: def.maxHp,
        tamed: false,
        hearts: 0,
        buddyTimer: 18,
        timer: 1.5 + rng() * 3,
        seed: rng() * 50,
        say: '',
        sayTimer: 0,
        hitAnim: 0,
        hitFlash: 0,
        danceTimer: 0,
        frozenTimer: 0,
        footLift: 0,
        aiState: 'idle',
        aiTimer: 0.7 + rng(),
        telegraphX: x,
        telegraphY: y,
        telegraphRadius: 72,
        koTimer: 0,
        hasToken: false,
      };
    };

    // Starter Grove friends
    creatures.push(makeCreature('honk_blimp', -240, -175, 'grove_honk'));
    creatures.push(makeCreature('toast_crab', 240, 200, 'grove_crab'));

    // Regional wildlife teaching local rules!
    // Needle Wrens in Vinyl Desert & Dead Air Basin (lift foot before reversals!)
    creatures.push(makeCreature('needle_wren', -4000, -2180, 'wren_1'));
    creatures.push(makeCreature('needle_wren', -7350, -4880, 'wren_2'));
    creatures.push(makeCreature('needle_wren', -8520, -5820, 'wren_3'));

    // Lantern Moths in Wickwater Afterhours (scatter before wicks dim!)
    creatures.push(makeCreature('lantern_moth', -2380, 8820, 'moth_1'));
    creatures.push(makeCreature('lantern_moth', -1880, 8990, 'moth_2'));

    // Additional regional wildlife & hostiles per zone
    let cIdx = 0;
    for (const zone of REGION_ZONES) {
      for (let i = 0; i < 4; i++) {
        const ang = rng() * Math.PI * 2;
        const rad = 0.28 + rng() * 0.52;
        const x = zone.cx + Math.cos(ang) * zone.rx * rad;
        const y = zone.cy + Math.sin(ang) * zone.ry * rad;
        if (Math.hypot(x, y) < 380) continue;

        let ty: CreatureType = 'honk_blimp';
        if (zone.id === 'marmalade_flats') ty = i % 2 === 0 ? 'toast_crab' : 'sofa_sloth';
        else if (zone.id === 'bureaucracy_bog') ty = i % 2 === 0 ? 'paperwork_gremlin' : 'existential_duck';
        else if (zone.id === 'vinyl_desert' || zone.id === 'dead_air_basin') ty = i === 0 ? 'paperwork_gremlin' : 'needle_wren';
        else if (zone.id === 'great_fridge' || zone.id === 'midnight_defrost') ty = i % 2 === 0 ? 'frost_cube' : 'honk_blimp';
        else if (zone.id === 'cloud_laundromat' || zone.id === 'unpaired_sea') ty = i % 2 === 0 ? 'sofa_sloth' : 'honk_blimp';
        else if (zone.id === 'carbon_copy_delta') ty = i === 0 ? 'paperwork_gremlin' : 'existential_duck';
        else if (zone.id === 'prism_orchard') ty = i % 2 === 0 ? 'toast_crab' : 'honk_blimp';
        else if (zone.id === 'wickwater_afterhours') ty = i === 0 ? 'reality_inspector' : 'lantern_moth';
        else if (zone.id === 'undertone_caverns') ty = i % 2 === 0 ? 'lantern_moth' : 'needle_wren';
        else if (zone.id === 'negative_coast') ty = i === 0 ? 'paperwork_gremlin' : 'existential_duck';
        else if (zone.id === 'inverted_allotments') ty = i % 2 === 0 ? 'toast_crab' : 'sofa_sloth';
        else ty = i % 2 === 0 ? 'honk_blimp' : 'toast_crab';

        creatures.push(makeCreature(ty, x, y, `z_${cIdx++}`));
      }
    }

    // Grand Tax Octopus Boss in Bureaucracy Bog Flooded Archive
    creatures.push(makeCreature('tax_octopus_boss', 1250, -4550, 'boss_tax_octopus'));

    // Pre-built starter Community Mood Plot in Giggle-Grove so farming is immediately discoverable
    const starterBuildings: Building[] = [
      { id: 'bld_comm_plot_1', type: 'mood_plot', x: -440, y: 420, phase: 0, crop: 'shroom_crop', growth: 12 },
      { id: 'bld_comm_plot_2', type: 'mood_plot', x: -375, y: 420, phase: 1, crop: null, growth: 0 },
      { id: 'bld_comm_bench', type: 'bench', x: -410, y: 505, phase: 0, crop: null, growth: 0 },
      { id: 'bld_grove_lamp', type: 'lava_lamp', x: 560, y: 460, phase: 0, crop: null, growth: 0 },
    ];

    return {
      version: SAVE_VERSION,
      camp: createCampProgress(),
      worldSeed,
      time: 0,
      dayTime: 8,
      day: 1,
      dead: false,
      victory: false,
      deathReason: '',
      ghostTimer: 0,
      exp: null,
      expCooldown: 52,
      xp: 0,
      sp: 1,
      skills: [],
      techniques: [],
      disciplines: createInitialDisciplines(),
      journalSketches: [],
      difficultyMode: 'standard',
      fishingToggleAssist: false,
      unlockedStyles: ['hustle'],
      unlockedTransports: [],
      claimedQuests: [],
      discoveries: createInitialDiscoveries(),
      npcMemories: {},
      worldFlags: { ...DEFAULT_WORLD_FLAGS },
      mirrorAngles: createDefaultMirrorAngles(),
      waypoint: { x: -88, y: -102, label: 'Damp Ferry Note (Mailbox Square)' },
      journalNotes: [
        'A damp note is pinned near Mailbox Square asking for supper for Capt. Nix’s last ferry shift.',
        'Climb Miri’s Rooftop Walk above Mailbox Square for a breezy elevated shortcut.',
        'Follow Groove Highway northwest to the Listening Booth and Radio Unmelted in Dead Air Basin.',
      ],
      audioSettings: { ...DEFAULT_AUDIO_SETTINGS },
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
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
        buildingsBuilt: 0,
      },
      player: {
        charId: ch.id,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        facing: 1,
        elevation: 0,
        bob: 0,
        squashX: 1,
        squashY: 1,
        vibe: ch.maxVibe,
        maxVibe: ch.maxVibe,
        munch: ch.maxMunch,
        maxMunch: ch.maxMunch,
        wobble: 16,
        moveStyle: 'hustle',
        actionAnim: 0,
        hitFlash: 0,
        invulnTimer: 0,
        rollTimer: 0,
        rollCd: 0,
        abCd: 0,
        gear: { partyHat: false, sweater: false, prismShades: false, prismReel: false },
      },
      trips: {},
      inv: { ...ch.startInv },
      objects,
      creatures,
      buildings: starterBuildings,
      mailboxes,
      projectiles: [],
      ducks: [],
      popups: [],
      inspectorCd: 0,
      shakeBonus: false,
      droppedSatchel: null,
      regionalEvent: null,
      regionalEventCooldownDay: 2,
    };
  }

  private hasSkill(id: string): boolean {
    return this.state.skills.includes(id);
  }

  private addJournalNote(note: string): void {
    if (!this.state.journalNotes.includes(note)) {
      this.state.journalNotes.unshift(note);
      if (this.state.journalNotes.length > 18) this.state.journalNotes.pop();
    }
  }

  private learnTechnique(techId: TechniqueId): void {
    if (this.state.techniques.includes(techId)) return;
    this.state.techniques.push(techId);
    const t = TECHNIQUES[techId];
    this.audio.questFanfare();
    this.callbacks.onToast(`Learned Cultural Technique: ${t.name} (${t.teacher})!`);
    this.addJournalNote(`Learned ${t.name} from ${t.teacher}: ${t.desc}`);
    this.gainXP(35);
    this.emitHud();
  }

  private unlockTransport(id: TransportId): void {
    if (!this.state.unlockedTransports.includes(id)) {
      this.state.unlockedTransports.push(id);
    }
  }

  public rideTransport(id: TransportId): void {
    if (!this.state.unlockedTransports.includes(id)) return;
    const route = TRANSPORT_ROUTES[id];
    const p = this.state.player;
    const dFrom = Math.hypot(p.x - route.fromX, p.y - route.fromY);
    const dTo = Math.hypot(p.x - route.toX, p.y - route.toY);
    const destX = dFrom < dTo ? route.toX : route.fromX;
    const destY = dFrom < dTo ? route.toY : route.fromY;
    const destName = dFrom < dTo ? route.toName : route.fromName;

    this.trailRun = null;
    p.x = destX + 46;
    p.y = destY + 46;
    p.elevation = 0;
    this.camX = p.x;
    this.camY = p.y;
    this.audio.trip();
    this.burst(p.x, p.y - 16, route.accent, 24, 185);
    this.setActiveModal(null);
    this.callbacks.onToast(`Rode ${route.name} to ${destName}!`);
  }

  private activeTripsSet(): Set<TripId> {
    const s = new Set<TripId>();
    for (const [k, v] of Object.entries(this.state.trips)) {
      if ((v || 0) > 0) s.add(k as TripId);
    }
    return s;
  }

  private spawnParticle(
    x: number,
    y: number,
    vx: number,
    vy: number,
    color: string,
    size: number,
    life: number,
    kind: PooledParticle['kind'] = 'dot',
  ): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % POOL_SIZE;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.color = color;
    p.size = size;
    p.life = life;
    p.maxLife = life;
    p.kind = kind;
  }

  private burst(x: number, y: number, color: string, count = 12, speed = 135): void {
    const c = this.state.reducedMotion ? Math.max(4, Math.floor(count * 0.45)) : count;
    for (let i = 0; i < c; i++) {
      const a = (i / c) * Math.PI * 2 + rand(-0.2, 0.2);
      const s = rand(speed * 0.45, speed);
      this.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, color, rand(3.5, 7.5), rand(0.32, 0.65), 'dot');
    }
  }

  private addPopup(x: number, y: number, text: string, color = '#ffd166'): void {
    let offsetY = 0;
    for (const existing of this.state.popups) {
      if (Math.hypot(existing.x - x, existing.y - (y + offsetY)) < 26) {
        offsetY -= 22;
      }
    }
    this.state.popups.push({ x, y: y + offsetY, text, color, life: 1.5, maxLife: 1.5 });
  }

  private giveItem(id: string, q = 1): void {
    this.state.inv[id] = (this.state.inv[id] || 0) + q;
  }

  private takeItem(id: string, q = 1): boolean {
    if ((this.state.inv[id] || 0) < q) return false;
    this.state.inv[id] -= q;
    if (this.state.inv[id] <= 0) delete this.state.inv[id];
    return true;
  }

  private gainXP(amount: number): void {
    const res = applyXpGain(this.state.xp, this.state.sp, this.state.skills.length, amount, this.state.player.charId);
    this.state.xp = res.xp;
    this.state.sp = res.sp;
    if (res.leveledUp) {
      this.audio.questFanfare();
      this.callbacks.onToast('Brain-Bloom! +1 Skill Point earned. Open Skills (K) to upgrade.');
    }
  }

  private getQuickConsumables(): string[] {
    const orderWeight = (id: string): number => {
      const it = ITEMS[id];
      if (!it) return 99;
      if (it.cat === 'sub' && it.trip !== 'sober') return 1;
      if (it.trip === 'sober') return 2;
      if (it.cat === 'food') return 3;
      return 4;
    };
    return Object.keys(this.state.inv)
      .filter((k) => {
        const it = ITEMS[k];
        return it && (this.state.inv[k] || 0) > 0 && (it.cat === 'sub' || it.cat === 'food' || k === 'junk_mail');
      })
      .sort((a, b) => orderWeight(a) - orderWeight(b))
      .slice(0, 5);
  }

  private quickConsumeSlot(idx: number): void {
    const target = this.getQuickConsumables()[idx];
    if (target) this.consumeItem(target);
  }

  private isNearCalmingTotem(): boolean {
    const p = this.state.player;
    return this.state.buildings.some(
      (b) => b.type === 'dream_totem' && Math.hypot(b.x - p.x, b.y - p.y) < 250,
    );
  }

  public consumeItem(id: string): void {
    const it = ITEMS[id];
    if (!it || !this.takeItem(id, 1)) return;
    const p = this.state.player;
    const nearTotem = this.isNearCalmingTotem();
    const prevProfile = computeTripProfile(p.vibe, p.maxVibe, p.wobble, this.state.trips, this.state.tripMaxDur, nearTotem);
    p.squashX = 1.18;
    p.squashY = 0.84;

    if (it.cat === 'food') {
      const tkMult = hasPerk(this.getDisciplines(), 'tablekeeper') ? 1.25 : 1;
      p.munch = Math.min(p.maxMunch, p.munch + Math.round((it.mun || 0) * tkMult));
      p.vibe = Math.max(1, Math.min(p.maxVibe, p.vibe + Math.round((it.vib || 0) * tkMult)));
      p.wobble = Math.max(0, Math.min(100, p.wobble + (it.wob || 0)));
      this.audio.boop();
      this.burst(p.x, p.y - 18, it.accent, 8, 90);
      this.addPopup(p.x, p.y - 42, `Yum! ${it.name}${tkMult > 1 ? ' (Tablekeeper!)' : ''}`, '#2ec4b6');
    } else if (it.cat === 'sub') {
      const dm = this.hasSkill('zen_stomach') ? 1.35 : 1;
      const wm = this.hasSkill('zen_stomach') ? 0.8 : 1;
      p.munch = Math.min(p.maxMunch, p.munch + (it.mun || 0));
      let bonusVibe = id === 'disco_overdrive' && this.hasSkill('shake_master') ? 25 : 0;
      if (this.state.shakeBonus && id === 'disco_overdrive') {
        bonusVibe += 30;
        this.state.shakeBonus = false;
      }
      if (it.trip === 'sober') {
        const extraRelief = prevProfile.mood === 'bad_trip' || prevProfile.mood === 'uneasy' ? 18 : 0;
        p.vibe = Math.min(p.maxVibe, p.vibe + (it.vib || 0) + extraRelief);
        this.state.trips = {};
        this.state.tripMaxDur = {};
        p.wobble = Math.max(8, p.wobble + (it.wob || -68));
        this.badTripPhantoms = [];
        this.playerTracers = [];
        this.lastBadTripNotice = false;
        this.audio.groundingSigh();
        this.callbacks.onToast(
          extraRelief > 0
            ? 'Boring Decaf grounded your Bad Trip! Breathing steady again.'
            : 'Sweet, sensible beige reality restored.',
        );
      } else if (it.trip) {
        const rawVibe = p.vibe + (it.vib || 0) + bonusVibe;
        p.vibe = (it.vib || 0) < 0 ? Math.max(Math.round(p.maxVibe * 0.14), Math.min(p.maxVibe, rawVibe)) : Math.min(p.maxVibe, rawVibe);
        p.wobble = Math.min(100, p.wobble + (it.wob || 25) * wm);
        const addedDur = (it.dur || 25) * dm;
        const nextRem = (this.state.trips[it.trip] || 0) + addedDur;
        this.state.trips[it.trip] = nextRem;
        if (!this.state.tripMaxDur) this.state.tripMaxDur = {};
        this.state.tripMaxDur[it.trip] = Math.max(nextRem, this.state.tripMaxDur[it.trip] || addedDur);
        this.state.stats.tripsTaken += 1;
        this.audio.tripFor(it.trip);
        if (!this.state.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.24);
        const nextProfile = computeTripProfile(p.vibe, p.maxVibe, p.wobble, this.state.trips, this.state.tripMaxDur, nearTotem);
        if (nextProfile.mood === 'bad_trip') {
          this.callbacks.onToast('BAD TRIP SPIRAL! Vibe is too low for this Wobble—sip Boring Decaf or find a Lava Lamp!');
          this.lastBadTripNotice = true;
        } else if (nextProfile.synergy && nextProfile.synergy.id !== prevProfile.synergy?.id) {
          this.callbacks.onToast(`SYNERGY UNLOCKED: ${nextProfile.synergy.name}! ${nextProfile.synergy.bonusDesc}`);
        } else {
          this.callbacks.onToast(`${it.name}: ${TRIP_VISUAL_META[it.trip].effectSummary}`);
        }
      }
      this.burst(p.x, p.y - 20, it.accent, 18, 165);
      this.addPopup(p.x, p.y - 48, it.quote || it.name, it.accent);
      this.gainXP(10);
    } else if (id === 'junk_mail') {
      for (const c of this.state.creatures) {
        if (CREATURE_DEFS[c.type].hostile && Math.hypot(c.x - p.x, c.y - p.y) < 360) {
          c.frozenTimer = 4.2;
          c.aiState = 'idle';
          c.say = 'OOH, COUPONS?!';
          c.sayTimer = 2.6;
        }
      }
      this.audio.boop();
      this.burst(p.x, p.y - 14, '#f7efde', 12, 130);
      this.addPopup(p.x, p.y - 42, 'Tossed Junk Mail!', '#ffd166');
    }
    this.emitHud();
  }

  public triggerAbility(): void {
    if (this.mode !== 'playing' || this.activeModal || this.state.dead || this.state.player.abCd > 0) return;
    const p = this.state.player;
    const ch = CHARACTERS[p.charId];
    p.abCd = ch.ability.cd;
    p.actionAnim = 0.28;
    p.squashX = 1.24;
    p.squashY = 0.78;
    this.audio.trip();
    if (!this.state.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.3);

    if (ch.ability.id === 'express_delivery') {
      const aimX = Math.hypot(this.joy.dx, this.joy.dy) > 0.15 ? this.joy.dx : p.facing;
      const aimY = Math.hypot(this.joy.dx, this.joy.dy) > 0.15 ? this.joy.dy : 0;
      const len = Math.hypot(aimX, aimY) || 1;
      this.state.projectiles.push({
        id: `pr_${Math.random().toString(36).slice(2, 7)}`,
        fromPlayer: true,
        kind: 'parcel',
        x: p.x,
        y: p.y,
        vx: (aimX / len) * 460,
        vy: (aimY / len) * 460,
        life: 1.15,
        damage: 42,
        color: '#4cc9f0',
      });
      this.addPopup(p.x, p.y - 44, 'EXPRESS DELIVERY!', '#4cc9f0');
    } else if (ch.ability.id === 'spill_tea') {
      p.vibe = Math.min(p.maxVibe, p.vibe + 18);
      this.burst(p.x, p.y - 16, '#ff85b3', 22, 185);
      for (const c of this.state.creatures) {
        if (Math.hypot(c.x - p.x, c.y - p.y) < 235) {
          c.danceTimer = 3.8;
          c.frozenTimer = 2.6;
          c.aiState = 'idle';
          c.say = 'SO SCANDALOUS!';
          c.sayTimer = 2.2;
        }
      }
      this.addPopup(p.x, p.y - 44, 'SPILLED THE TEA! +18 Vibe', '#ff85b3');
    } else if (ch.ability.id === 'drop_bass') {
      this.burst(p.x, p.y - 14, '#2ec4b6', 26, 210);
      for (const c of this.state.creatures) {
        if (Math.hypot(c.x - p.x, c.y - p.y) < 275) {
          c.danceTimer = 4.6;
          c.frozenTimer = 2.2;
          c.aiState = 'idle';
          c.say = 'UNTZ UNTZ!';
          c.sayTimer = 2.2;
        }
      }
      for (const b of this.state.buildings) {
        if (b.type === 'mood_plot' && b.crop && Math.hypot(b.x - p.x, b.y - p.y) < 275) {
          b.growth = Math.min(CROPS[b.crop].time, b.growth + 9);
        }
      }
      this.addPopup(p.x, p.y - 44, 'BASS DROPPED!', '#2ec4b6');
    } else if (ch.ability.id === 'audit') {
      this.burst(p.x, p.y - 14, '#ffd166', 24, 195);
      for (const c of this.state.creatures) {
        if (Math.hypot(c.x - p.x, c.y - p.y) < 290 && c.aiState !== 'ko') {
          c.frozenTimer = 4.5;
          c.aiState = 'idle';
          c.say = 'WHERE ARE MY RECEIPTS?!';
          c.sayTimer = 2.6;
          if (CREATURE_DEFS[c.type].boss) {
            this.damageCreature(c, 45);
          }
        }
      }
      this.addPopup(p.x, p.y - 44, 'SURPRISE AUDIT!', '#ffd166');
    } else if (ch.ability.id === 'fold_span') {
      this.foldSpanTimer = 6.0;
      this.burst(p.x, p.y - 16, '#72efdd', 22, 180);
      this.addPopup(p.x, p.y - 44, 'FOLD SPAN! Glide Over Mud', '#72efdd');
    } else if (ch.ability.id === 'guide_line') {
      this.guideLineTimer = 10.0;
      this.burst(p.x, p.y - 16, '#ffd166', 22, 180);
      for (const c of this.state.creatures) {
        if (CREATURE_DEFS[c.type].hostile && Math.hypot(c.x - p.x, c.y - p.y) < 280) {
          c.frozenTimer = 2.6;
          c.aiState = 'idle';
          c.say = 'TANGLED IN LINE!';
          c.sayTimer = 1.9;
        }
      }
      this.addPopup(p.x, p.y - 44, 'GUIDE LINE! Shoals & Steady Cast', '#72efdd');
    } else if (ch.ability.id === 'lend_glow') {
      p.vibe = Math.min(p.maxVibe, p.vibe + 16);
      p.wobble = Math.max(0, p.wobble - 14);
      this.burst(p.x, p.y - 16, '#ff9f1c', 24, 175);
      this.soundRipples.push({
        x: p.x,
        y: p.y - 12,
        radius: 16,
        maxRadius: 150,
        color: '#ff9f1c',
        glyph: '✦',
        life: 1.4,
        maxLife: 1.4,
      });
      for (const c of this.state.creatures) {
        if (CREATURE_DEFS[c.type].hostile && Math.hypot(c.x - p.x, c.y - p.y) < 250) {
          c.frozenTimer = 2.8;
          c.aiState = 'idle';
          c.say = 'SO WARM!';
          c.sayTimer = 2.0;
        }
      }
      this.addPopup(p.x, p.y - 44, 'LEND GLOW! +16 Vibe · Calmed', '#ff9f1c');
    } else if (ch.ability.id === 'high_water_mark') {
      this.foldSpanTimer = 5.5;
      this.burst(p.x, p.y - 16, '#2ec4b6', 24, 190);
      this.spawnWaterRipple(p.x, p.y, '#2ec4b6', 78);
      for (const c of this.state.creatures) {
        if (CREATURE_DEFS[c.type].hostile && Math.hypot(c.x - p.x, c.y - p.y) < 260) {
          c.frozenTimer = 3.2;
          c.aiState = 'idle';
          c.say = 'INK-STAMPED!';
          c.sayTimer = 2.1;
        }
      }
      this.addPopup(p.x, p.y - 44, 'HIGH-WATER MARK! Ink Footing', '#2ec4b6');
    } else if (ch.ability.id === 'wall_tap') {
      this.audio.tuningForkChord();
      this.burst(p.x, p.y - 16, '#b388ff', 26, 200);
      this.soundRipples.push({
        x: p.x,
        y: p.y - 12,
        radius: 14,
        maxRadius: 185,
        color: '#b388ff',
        glyph: '♪',
        life: 1.5,
        maxLife: 1.5,
      });
      for (const c of this.state.creatures) {
        if (Math.hypot(c.x - p.x, c.y - p.y) < 290) {
          c.danceTimer = 4.2;
          c.frozenTimer = 2.6;
          c.aiState = 'idle';
          c.say = 'WHAT HARMONY!';
          c.sayTimer = 2.2;
        }
      }
      for (const b of this.state.buildings) {
        if (b.type === 'mood_plot' && b.crop && Math.hypot(b.x - p.x, b.y - p.y) < 290) {
          b.growth = Math.min(CROPS[b.crop].time, b.growth + 8);
        }
      }
      this.awardPractice('acoustics', 'bea_wall_tap', 10);
      this.addPopup(p.x, p.y - 44, 'WALL TAP! Harmonic Echo', '#b388ff');
    } else if (ch.ability.id === 'steam_vent') {
      p.vibe = Math.min(p.maxVibe, p.vibe + 20);
      this.burst(p.x, p.y - 16, '#72efdd', 28, 210);
      for (const c of this.state.creatures) {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (CREATURE_DEFS[c.type].hostile && d < 250 && c.aiState !== 'ko') {
          const len = d || 1;
          c.vx = ((c.x - p.x) / len) * 320;
          c.vy = ((c.y - p.y) / len) * 320;
          c.frozenTimer = 3.0;
          c.aiState = 'idle';
          c.say = 'STEAMED CLEAN!';
          c.sayTimer = 2.1;
        }
      }
      this.addPopup(p.x, p.y - 44, 'STEAM VENT! +20 Vibe · Thawed', '#72efdd');
    } else if (ch.ability.id === 'split_sunbeam') {
      const aimX = Math.hypot(this.joy.dx, this.joy.dy) > 0.15 ? this.joy.dx : p.facing;
      const aimY = Math.hypot(this.joy.dx, this.joy.dy) > 0.15 ? this.joy.dy : 0;
      const len = Math.hypot(aimX, aimY) || 1;
      this.guideLineTimer = 8.0;
      this.state.projectiles.push({
        id: `pr_${Math.random().toString(36).slice(2, 7)}`,
        fromPlayer: true,
        kind: 'parcel',
        x: p.x,
        y: p.y,
        vx: (aimX / len) * 510,
        vy: (aimY / len) * 510,
        life: 1.0,
        damage: 46,
        color: '#72efdd',
      });
      this.audio.glassChime();
      this.burst(p.x, p.y - 18, '#72efdd', 20, 185);
      this.addPopup(p.x, p.y - 44, 'SPLIT SUNBEAM! Crystals Lit', '#72efdd');
    } else if (ch.ability.id === 'reed_float') {
      this.foldSpanTimer = 6.5;
      p.vibe = Math.min(p.maxVibe, p.vibe + 10);
      p.munch = Math.min(p.maxMunch, p.munch + 12);
      this.audio.waterPlop();
      this.spawnWaterRipple(p.x, p.y, '#a8ff3e', 74);
      this.burst(p.x, p.y - 14, '#a8ff3e', 20, 170);
      this.addPopup(p.x, p.y - 44, 'REED FLOAT! Buoyant Drift', '#a8ff3e');
    }
    this.emitHud();
  }

  // =========================================================================
  // PASS 1 & PASS 2: DINNER FOR THE LAST FERRY, FISHING, COOKING, CAMP, SKILLS
  // =========================================================================

  public isNearDock(): boolean {
    const p = this.state.player;
    return Math.hypot(p.x - DELTA_BANK_X, p.y - DELTA_BANK_Y) < 235;
  }

  private isNearWorkbench(): boolean {
    const p = this.state.player;
    return this.state.buildings.some((b) => b.type === 'workbench' && Math.hypot(b.x - p.x, b.y - p.y) < 185);
  }

  private isNearCampKitchen(): boolean {
    const p = this.state.player;
    return this.state.buildings.some(
      (b) => (b.type === 'camp_table' || b.type === 'funk_blender') && Math.hypot(b.x - p.x, b.y - p.y) < 185,
    );
  }

  private spawnWaterRipple(x: number, y: number, color = '#90e0ef', maxRadius = 46): void {
    if (this.waterRipples.length > 26) this.waterRipples.shift();
    this.waterRipples.push({ x, y, radius: 6, maxRadius, color, age: 0, maxAge: 0.9 });
  }

  private getDisciplines(): Record<DisciplineId, import('./types').DisciplineProgress> {
    if (!this.state.disciplines) {
      this.state.disciplines = createInitialDisciplines();
    }
    return this.state.disciplines;
  }

  private awardPractice(disc: DisciplineId, actionKey: string, baseXp: number): void {
    const all = this.getDisciplines();
    const res = awardDisciplinePractice(all[disc], actionKey, baseXp);
    all[disc] = res.next;
    if (res.promoted) {
      const def = DISCIPLINES[disc];
      this.audio.questFanfare();
      this.callbacks.onToast(
        `${def.name} reached Tier ${res.newTier} (${TIER_NAMES[res.newTier]})! Open Skills (K) for unlocks.`,
      );
      this.addJournalNote(`${def.name} advanced to Tier ${res.newTier} (${TIER_NAMES[res.newTier]}).`);
    }
  }

  public acceptFerryNote(): void {
    const f = this.state.worldFlags;
    const firstTime = f.ferrySupperStage === 'unstarted';
    if (firstTime) f.ferrySupperStage = 'accepted';
    upgradeDiscovery(this.state.discoveries, 'carbon_copy_delta', 'seen');
    upgradeDiscovery(this.state.discoveries, 'lm_delta_bank', 'seen');

    if (firstTime) {
      this.giveItem('seed_bell_reed', 1);
      this.giveItem('fizz_berry', 2);
      this.audio.ding();
      this.addJournalNote(
        f.ferryRestored
          ? 'Accepted Capt. Nix’s damp note: fish at Delta Public Bank, cook Ferryman’s Perch Chowder, and host late-shift supper.'
          : 'Accepted Capt. Nix’s damp note: fish at Delta Public Bank (loaner rod), plant Bell Reed, cook Chowder, and meet Nix at your Camp Table.',
      );
    }

    this.state.waypoint = {
      x: DELTA_BANK_X,
      y: DELTA_BANK_Y,
      label: 'Delta Public Bank (Loaner Rod & Dock Lamp)',
    };
    this.setActiveModal(null);
    this.callbacks.onToast(
      firstTime
        ? 'Pinned Delta Public Bank! Received 1 Bell Reed Rhizome + 2 Fizz-Berries. Follow the gold arrow north!'
        : 'Delta Public Bank pinned on your compass!',
    );
    this.saveGame(true);
    this.emitHud();
  }

  public selectCastSlot(slotIdx: number): void {
    const clamped = Math.max(0, Math.min(2, slotIdx)) as 0 | 1 | 2;
    this.selectedCastSlot = clamped;
    this.fishing.castSlot = clamped;
    this.emitHud();
  }

  public moveDockLamp(explicitSlot?: number): void {
    const f = this.state.worldFlags;
    const nextSlot = (
      explicitSlot !== undefined ? Math.max(0, Math.min(2, explicitSlot)) : (f.dockLampSlot + 1) % 3
    ) as 0 | 1 | 2;
    f.dockLampSlot = nextSlot;
    const slot = DOCK_LAMP_SLOTS[nextSlot];
    this.audio.ding();
    this.spawnWaterRipple(slot.waterX, slot.waterY + 8, '#ffd166', 54);

    const refl = computeDockReflectionState(this.state.time, nextSlot, f.ferryRestored);
    if (refl.minnowVisible) {
      if (!f.mirrorMinnowObserved) {
        f.mirrorMinnowObserved = true;
        if (!this.state.journalSketches) this.state.journalSketches = [];
        if (!this.state.journalSketches.some((s) => s.id === 'sketch_mirror_minnow')) {
          this.state.journalSketches.push({
            id: 'sketch_mirror_minnow',
            title: 'Mirror Minnow (Reflected Light)',
            category: 'fish',
            note: 'Turns toward an intact dock lamp reflection at Delta Public Bank and vanishes whenever a ferry wake or drifting plank breaks the water.',
          });
        }
        this.awardPractice('field_botany', 'observe_mirror_minnow', 30);
        this.callbacks.onToast(
          `Moved Dock Lamp to ${slot.label}! A silvery Mirror Minnow turned into the reflection — sketched in your Field Journal!`,
        );
        this.saveGame(true);
      } else {
        this.callbacks.onToast(`Moved Dock Lamp to ${slot.label} — calm golden reflection glowing on the cove.`);
      }
    } else {
      this.callbacks.onToast(
        `Moved Dock Lamp to ${slot.label}. Wait for the wake to settle so the lamp reflection reforms!`,
      );
    }
    this.emitHud();
  }

  public startCast(slotIdx?: number): void {
    if (!this.isNearDock()) {
      this.callbacks.onToast('Stand at Delta Public Bank to borrow the loaner reed rod and cast.');
      return;
    }
    if (this.fishing.active && this.fishing.phase !== 'idle' && this.fishing.phase !== 'landed' && this.fishing.phase !== 'escaped') {
      return;
    }
    const targetSlot = (slotIdx !== undefined ? Math.max(0, Math.min(2, slotIdx)) : this.selectedCastSlot) as 0 | 1 | 2;
    this.selectedCastSlot = targetSlot;

    const p = this.state.player;
    const f = this.state.worldFlags;
    const refl = computeDockReflectionState(this.state.time, f.dockLampSlot, f.ferryRestored);
    const hasBait = (this.state.inv.fizz_berry || 0) > 0;
    const discs = this.getDisciplines();

    this.fishing = startFishingCast(
      { ...this.fishing, toggleAssist: Boolean(this.state.fishingToggleAssist) },
      targetSlot,
      f.dockLampSlot,
      refl.reflectionIntegrity,
      {
        usingPrismReel: Boolean(p.gear.prismReel),
        hasBellLure: (this.state.inv.bell_lure || 0) > 0,
        baitId: hasBait ? 'fizz_berry' : '',
        currentReaderPerk: hasPerk(discs, 'current_reader'),
        stillwaterPerk: hasPerk(discs, 'stillwater_keeper'),
        brinBonus: p.charId === 'brin' || this.guideLineTimer > 0,
      },
    );
    this.audio.waterPlop();
    this.spawnWaterRipple(this.fishing.bobberX, this.fishing.bobberY, '#90e0ef', 42);
    this.emitHud();
  }

  public handleFishingActionDown(): void {
    if (!this.fishing.active) return;
    if (this.fishing.phase === 'landed' || this.fishing.phase === 'escaped') {
      this.startCast(this.selectedCastSlot);
      return;
    }
    const { next, hooked } = triggerFishingHookOrReel(this.fishing, true);
    this.fishing = next;
    if (hooked) {
      this.audio.corkSqueak();
      this.spawnWaterRipple(this.fishing.bobberX, this.fishing.bobberY, '#ffd166', 58);
      this.burst(this.fishing.bobberX, this.fishing.bobberY, '#ffd166', 12, 125);
    }
    this.emitHud();
  }

  public setFishingReel(pressed: boolean): void {
    if (!this.fishing.active) return;
    const { next, hooked } = triggerFishingHookOrReel(this.fishing, pressed);
    this.fishing = next;
    if (hooked) {
      this.audio.corkSqueak();
      this.spawnWaterRipple(this.fishing.bobberX, this.fishing.bobberY, '#ffd166', 58);
    }
    this.emitHud();
  }

  public toggleFishingAssist(): void {
    this.state.fishingToggleAssist = !this.state.fishingToggleAssist;
    this.fishing.toggleAssist = this.state.fishingToggleAssist;
    this.callbacks.onToast(
      this.state.fishingToggleAssist
        ? 'Fishing Toggle Assist ON: tap Space or Reel once to toggle reeling.'
        : 'Fishing Hold Mode ON: hold Space or Reel while calm, release when pulling.',
    );
    if (this.mode === 'playing') this.saveGame(true);
    this.emitHud();
  }

  public cancelFishing(): void {
    this.fishing = createIdleFishingSession(Boolean(this.state.fishingToggleAssist));
    this.fishing.castSlot = this.selectedCastSlot as 0 | 1 | 2;
    this.emitHud();
  }

  public releaseFish(itemId: string): void {
    if (!this.takeItem(itemId, 1)) return;
    this.audio.waterPlop();
    const natBonus = hasPerk(this.getDisciplines(), 'field_naturalist') ? 1.35 : 1;
    this.state.player.vibe = Math.min(this.state.player.maxVibe, this.state.player.vibe + 10);
    this.awardPractice('angling', `release_${itemId}`, Math.round(18 * natBonus));
    this.awardPractice('field_botany', `release_${itemId}`, Math.round(14 * natBonus));
    this.awardPractice('creature_care', `release_${itemId}`, Math.round(18 * natBonus));
    this.callbacks.onToast(
      `Released ${ITEMS[itemId]?.name || itemId} back into the river (+10 Vibe & Angling/Care XP${natBonus > 1 ? ' · Naturalist +35%' : ''}).`,
    );
    this.emitHud();
  }

  public cookRecipe(recipeId: string): void {
    const rec = COOKING_RECIPES.find((r) => r.id === recipeId);
    if (!rec) return;

    const discs = this.getDisciplines();
    const cookTier = discs.cookery?.tier ?? 1;
    if (rec.reqCookeryTier && cookTier < rec.reqCookeryTier) {
      this.callbacks.onToast(`Requires Cookery Tier ${rec.reqCookeryTier} (${TIER_NAMES[rec.reqCookeryTier as 1 | 2 | 3 | 4 | 5]}).`);
      return;
    }

    const foundPrim = rec.primaryAny.find((id) => (this.state.inv[id] || 0) >= 1);
    if (!foundPrim) {
      this.callbacks.onToast(`Missing primary ingredient (${rec.primaryAny.map((k) => ITEMS[k]?.name || k).join(' / ')}).`);
      return;
    }
    const foundSec = rec.secondaryAny.find((id) => (this.state.inv[id] || 0) >= (id === foundPrim ? 2 : 1));
    if (!foundSec) {
      this.callbacks.onToast(`Missing local substitute (${rec.secondaryAny.map((k) => ITEMS[k]?.name || k).join(' / ')}).`);
      return;
    }

    this.takeItem(foundPrim, 1);
    this.takeItem(foundSec, 1);
    const extraServing = hasPerk(discs, 'provisioner') && (rec.id === 'cook_perch_chowder' || rec.id === 'cook_grove_broth') ? 1 : 0;
    const totalOut = 1 + extraServing;
    this.giveItem(rec.outId, totalOut);
    this.state.stats.mealsCooked = (this.state.stats.mealsCooked || 0) + 1;
    this.awardPractice('cookery', `cook_${rec.id}`, 32);
    this.gainXP(18);
    this.audio.ding();
    this.burst(this.state.player.x, this.state.player.y - 18, '#ff9f1c', 16, 130);
    this.callbacks.onToast(
      `Cooked ${totalOut} × ${rec.name}!${extraServing ? ' (Provisioner bonus +1!)' : ''}`,
    );
    this.emitHud();
  }

  public cookExperimental(idA: string, idB: string): void {
    if (!idA || !idB) return;
    if (idA === idB) {
      if ((this.state.inv[idA] || 0) < 2) return;
      this.takeItem(idA, 2);
    } else {
      if ((this.state.inv[idA] || 0) < 1 || (this.state.inv[idB] || 0) < 1) return;
      this.takeItem(idA, 1);
      this.takeItem(idB, 1);
    }
    this.giveItem('camp_leftovers', 1);
    this.state.stats.mealsCooked = (this.state.stats.mealsCooked || 0) + 1;
    this.awardPractice('cookery', 'cook_experimental', 16);
    this.audio.boop();
    this.callbacks.onToast(
      'Simmered Warm Camp Leftovers! Tip: Pair Spool Perch + Bell Reed (or local berry/toast) for Ferryman’s Perch Chowder.',
    );
    this.emitHud();
  }

  public serveNixSupper(): void {
    const f = this.state.worldFlags;
    // Strictly idempotent — never duplicate serving rewards or reset ferry state
    if (f.ferrySupperServedDay > 0) {
      this.callbacks.onToast('Capt. Nix already has a standing second place setting at your Camp Table!');
      return;
    }
    const status = evaluateCampSupperStatus(this.state.buildings, this.state.inv);
    if (!status.hasTable || !status.hasBenchNearTable || !status.hasLampNearTable) {
      this.callbacks.onToast('Place a Camp Table, Wooden Bench, and Lamp together at camp first!');
      return;
    }
    const dishId = getCampSupperDish(this.state.inv);
    if (!dishId || !this.takeItem(dishId, 1)) {
      this.callbacks.onToast('Cook Ferryman’s Perch Chowder (or a cooked fish dish) first!');
      return;
    }

    f.ferrySupperStage = 'served';
    f.ferrySupperServedDay = this.state.day;
    const table = this.state.buildings.find((b) => b.id === status.tableId);
    if (table) table.hasSecondSetting = true;

    this.awardPractice('cookery', 'serve_nix_supper', 40);
    this.awardPractice('building', 'host_camp_supper', 35);
    this.awardPractice('hospitality', 'serve_nix_supper', 45);
    const discs = this.getDisciplines();
    if (hasPerk(discs, 'host')) this.giveItem('bottlecap', 15);
    if (hasPerk(discs, 'warm_welcome')) this.giveItem('bottlecap', 12);
    this.gainXP(55 + (hasPerk(discs, 'county_connector') ? 25 : 0));
    this.audio.ferryTwoNoteCall();
    this.audio.questFanfare();
    if (table) {
      this.burst(table.x, table.y - 16, '#ffd166', 28, 170);
      this.soundRipples.push({
        x: table.x,
        y: table.y - 12,
        radius: 12,
        maxRadius: 120,
        color: '#ffd166',
        glyph: '♫',
        life: 1.4,
        maxLife: 1.4,
      });
    }
    this.addJournalNote(
      f.ferryRestored
        ? 'Served Capt. Nix hot supper at your Camp Table. Late-service ferry shifts and a second place setting now await every evening!'
        : 'Served Capt. Nix hot supper at your Camp Table. Nix shared where the shore-marked Ferry Permit drifted and will visit at dusk!',
    );
    this.setActiveModal('followup_choice');
    this.saveGame(true);
    this.emitHud();
  }

  public chooseFerryFollowUp(choice: 'lure_reflected' | 'bait_garden' | 'comfort_stop'): void {
    const f = this.state.worldFlags;
    // Strictly idempotent
    if (f.ferrySupperFollowUp !== '') {
      this.setActiveModal(null);
      return;
    }
    f.ferrySupperFollowUp = choice;
    this.audio.questFanfare();

    if (choice === 'lure_reflected') {
      this.giveItem('bell_lure', 1);
      this.giveItem('pear_lens', 1);
      this.awardPractice('angling', 'followup_lure_reflected', 24);
      this.addJournalNote('Follow-up choice: Reflected Lure — Nix gifted a Bell-Reed Lure & Pear Lens toward crafting the Prism Reel.');
      this.callbacks.onToast('Reflected Lure chosen! +1 Bell-Reed Lure & +1 Pear Lens. Rest at your Bench/Table to welcome Nix at dusk!');
    } else if (choice === 'bait_garden') {
      this.giveItem('seed_bell_reed', 2);
      this.giveItem('fizz_berry', 4);
      this.awardPractice('farming', 'followup_bait_garden', 24);
      this.addJournalNote('Follow-up choice: Bait Garden — Nix gifted 2 Bell Reed Rhizomes & 4 Fizz-Berries for your camp soil.');
      this.callbacks.onToast('Bait Garden chosen! +2 Bell Reed Rhizomes & +4 Fizz-Berries. Rest at your Bench/Table for Nix’s dusk visit!');
    } else {
      this.giveItem('bottlecap', 25);
      this.giveItem('rubber_wood', 2);
      this.awardPractice('building', 'followup_comfort_stop', 24);
      this.addJournalNote('Follow-up choice: Cozy Comfort Stop — Nix left 25 Caps & timber so your Camp Table glows warmer at dusk.');
      this.callbacks.onToast('Comfort Stop chosen! +25 Bottlecaps & +2 Timber. Rest at your Bench/Table for Nix’s dusk visit!');
    }
    this.setActiveModal(null);
    this.saveGame(true);
    this.emitHud();
  }

  public restUntilNextDusk(): void {
    const f = this.state.worldFlags;
    this.trailRun = null;
    this.state.day += 1;
    this.state.dayTime = 57; // Golden dusk right before evening shift
    this.state.stats.daysSurvived = this.state.day;
    const p = this.state.player;
    p.vibe = Math.min(p.maxVibe, p.vibe + 28);
    p.munch = Math.min(p.maxMunch, p.munch + 22);
    this.runCampShift(false);
    this.setActiveModal(null);

    if (f.ferrySupperServedDay > 0) {
      const table = this.getFerrySupperTable();
      if (table) {
        table.hasSecondSetting = true;
        this.soundRipples.push({
          x: table.x,
          y: table.y - 16,
          radius: 14,
          maxRadius: 135,
          color: '#72efdd',
          glyph: '♫',
          life: 1.6,
          maxLife: 1.6,
        });
      }
      this.audio.ferryTwoNoteCall();
      this.callbacks.onToast(
        f.ferryRestored
          ? `Evening of Day ${this.state.day}: Two-note ferry horn! Capt. Nix is seated at your Camp Table for the late shift.`
          : `Evening of Day ${this.state.day}: Two-note horn across the river! Capt. Nix stopped by your Camp Table to chat.`,
      );
    } else {
      this.audio.ding();
      this.callbacks.onToast(`Rested until Dusk of Day ${this.state.day}! (+28 Vibe, +22 Munch)`);
    }
    this.saveGame(true);
    this.emitHud();
  }

  private getFerrySupperTable(): Building | undefined {
    return this.state.buildings.find((b) => b.type === 'camp_table' && b.hasSecondSetting) ??
      this.state.buildings.find((b) => b.type === 'camp_table');
  }

  private getCampAnchor(): Building | undefined {
    return this.state.buildings.find((building) => building.id === this.state.camp.anchorId);
  }

  private findCampSite(maxDistance: number): Building | undefined {
    const p = this.state.player;
    let nearest: Building | undefined;
    let range = maxDistance;
    for (const building of this.state.buildings) {
      if (building.type !== 'bench' && building.type !== 'camp_table' && building.type !== 'workbench') continue;
      const distance = Math.hypot(building.x - p.x, building.y - p.y);
      if (distance < range) {
        range = distance;
        nearest = building;
      }
    }
    return nearest;
  }

  public setCampSite(): void {
    const site = this.findCampSite(185);
    if (!site) return;
    const camp = this.state.camp;
    if (camp.anchorId !== site.id) camp.wardDay = 0;
    camp.anchorId = site.id;
    this.emitHud();
  }

  public pinCampSite(): void {
    const site = this.getCampAnchor() ?? this.findCampSite(Infinity);
    if (!site) return;
    const label = RECIPES.find((recipe) => recipe.id === site.type)?.name ?? 'Camp site';
    this.setActiveModal(null);
    this.setWaypoint({ x: site.x, y: site.y, label });
  }

  public stockCamp(direction: 'deposit' | 'withdraw'): void {
    const site = this.getCampAnchor();
    const p = this.state.player;
    if (!site || Math.hypot(p.x - site.x, p.y - site.y) >= 185) return;
    const camp = this.state.camp;
    if (direction === 'deposit') {
      if (camp.provisions >= MAX_CAMP_PROVISIONS || !this.takeItem('fizz_berry', 1)) return;
      camp.provisions += 1;
    } else {
      if (camp.anchorId !== site.id || camp.provisions <= 0) return;
      camp.provisions -= 1;
      this.giveItem('fizz_berry', 1);
    }
    this.audio.boop();
    this.emitHud();
  }

  public setCampJob(creatureId: string, job: CampJob | null): void {
    if (!this.state.creatures.some((creature) => creature.id === creatureId && creature.tamed)) return;
    if (job && Object.hasOwn(CAMP_JOBS, job)) this.state.camp.jobs[creatureId] = job;
    else delete this.state.camp.jobs[creatureId];
    this.emitHud();
  }

  private runCampShift(announce = true): void {
    const camp = this.state.camp;
    if (camp.lastShiftDay >= this.state.day) return;
    const anchor = this.getCampAnchor();
    const local = anchor ? this.state.buildings.filter((building) => Math.hypot(building.x - anchor.x, building.y - anchor.y) <= 280) : [];
    const plots = local.filter((building) => building.type === 'mood_plot' && building.crop && !isCropReady(building.crop, building.growth));
    const companions = this.state.creatures.filter((creature) => creature.tamed)
      .map((creature) => ({ id: creature.id, name: CREATURE_DEFS[creature.type].name }));
    const result = resolveCampShift(camp, this.state.day, companions, {
      hasCamp: Boolean(anchor),
      hasPlots: plots.length > 0,
      hasLamp: local.some((building) => ['lava_lamp', 'dock_lamp', 'vibe_beacon', 'dream_totem'].includes(building.type)),
      hasRelay: local.some((building) => building.type === 'camp_relay'),
    });
    this.state.camp = result.camp;
    if (result.effects.timber) this.giveItem('rubber_wood', result.effects.timber);
    if (result.effects.berries) this.giveItem('fizz_berry', result.effects.berries);
    for (const plot of plots) {
      if (plot.crop) plot.growth = Math.min(CROPS[plot.crop].time, plot.growth + result.effects.cropGrowth);
    }
    if (result.camp.report.length) {
      if (announce) this.callbacks.onToast(result.camp.report[0]);
      this.saveGame(true);
      this.emitHud();
    }
  }

  public armTrail(id: TrailId): void {
    if (!Object.hasOwn(RIBBON_TRAILS, id) || this.state.discoveries[RIBBON_TRAILS[id].biome] === 'unknown') return;
    this.trailRun = { id, gateIndex: 0, elapsed: 0 };
    this.setActiveModal(null);
    this.callbacks.onToast(`Follow the compass to ${RIBBON_TRAILS[id].name}. The clock starts at the first ribbon.`);
  }

  public cancelTrail(): void {
    this.trailRun = null;
    this.emitHud();
  }

  private getDisplayedWaypoint(): Waypoint | null {
    const run = this.trailRun;
    return run ? RIBBON_TRAILS[run.id].gates[run.gateIndex] : this.state.waypoint;
  }

  private tickTrail(dt: number, rolling: boolean): void {
    const run = this.trailRun;
    if (!run) return;
    const p = this.state.player;
    const route = RIBBON_TRAILS[run.id];
    const outcome = stepTrail(run, p.x, p.y, rolling, dt);
    if (outcome.status === 'expired') {
      this.trailRun = null;
      this.callbacks.onToast(`Time ran out on ${route.name}. Start another attempt from the Camp Ledger.`);
    } else if (outcome.status === 'finished') {
      this.trailRun = null;
      const records = this.state.camp.trailRecords;
      const previous = records[run.id];
      const elapsed = outcome.run.elapsed;
      if (previous === undefined) {
        for (const [item, quantity] of Object.entries(route.reward)) this.giveItem(item, quantity);
        this.awardPractice('wayfinding', `trail_${run.id}`, 38);
        this.addJournalNote(`Completed ${route.name} in ${elapsed.toFixed(1)}s and claimed its trail cache.`);
        this.audio.questFanfare();
      }
      if (previous === undefined || elapsed < previous) {
        records[run.id] = elapsed;
        this.saveGame(true);
      }
      this.callbacks.onToast(`${route.name} finished in ${elapsed.toFixed(1)}s.${previous === undefined ? ' Trail cache added to your bag.' : elapsed < previous ? ' New best time!' : ''}`);
    } else {
      this.trailRun = outcome.run;
      if (run.gateIndex === outcome.run.gateIndex) return;
      this.audio.ding();
      this.burst(p.x, p.y - 12, '#ffd166', 10, 100);
    }
    this.emitHud();
  }

  public startMoveBuilding(buildingId: string): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    this.buildingMove = { id: buildingId, rotation: b.rotation ?? 0 };
    this.setActiveModal(null);
    this.callbacks.onToast('Move Mode: Walk to the new spot and press Space to place, R to rotate, or Esc to cancel.');
    this.emitHud();
  }

  public placeMovedBuilding(): void {
    const move = this.buildingMove;
    if (!move) return;
    const b = this.state.buildings.find((x) => x.id === move.id);
    const p = this.state.player;
    if (b) {
      const tx = p.x + p.facing * 52;
      const ty = p.y + 8;
      const check = validateBuildingPlacement(tx, ty, b.type, this.state.buildings, this.state.mailboxes, WORLD_FEATURES, b.id);
      if (!check.ok) {
        this.audio.hurt();
        this.callbacks.onToast(check.reason || 'Cannot place furniture here — keep paths and landmarks clear!');
        return;
      }
      b.x = tx;
      b.y = ty;
      b.rotation = move.rotation;
      this.audio.ding();
      this.burst(b.x, b.y - 8, '#ffd166', 12, 100);
      this.callbacks.onToast('Moved camp furniture neatly into place!');
    }
    this.buildingMove = null;
    this.emitHud();
  }

  public cancelMoveBuilding(): void {
    if (!this.buildingMove) return;
    this.buildingMove = null;
    this.callbacks.onToast('Cancelled moving furniture.');
    this.emitHud();
  }

  public rotateBuilding(buildingId: string): void {
    const b = this.state.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    const target = this.buildingMove?.id === buildingId ? this.buildingMove : b;
    target.rotation = ((target.rotation ?? 0) + 1) % 4;
    this.audio.boop();
    this.callbacks.onToast('Rotated furniture 90°.');
    this.emitHud();
  }

  public salvageBuilding(buildingId: string): void {
    const idx = this.state.buildings.findIndex((x) => x.id === buildingId);
    if (idx === -1) return; // Strictly idempotent
    const b = this.state.buildings[idx];
    this.state.buildings.splice(idx, 1);
    const recipe = RECIPES.find((r) => r.id === b.type);
    const refund = recipe ? getSalvageRefund(recipe, this.getDisciplines()) : { rubber_wood: 1 };
    const summary: string[] = [];
    for (const [k, v] of Object.entries(refund)) {
      this.giveItem(k, v);
      summary.push(`+${v} ${ITEMS[k]?.name || k}`);
    }
    this.audio.harvest();
    this.burst(b.x, b.y - 10, '#f4a261', 12, 110);
    if (this.buildingMove?.id === buildingId) this.buildingMove = null;
    this.setActiveModal(null);
    this.callbacks.onToast(`Salvaged structure: ${summary.join(', ')}.`);
    this.emitHud();
  }

  public pickDisciplinePerk(disc: DisciplineId, perk: PerkId): void {
    const res = selectDisciplinePerk(this.getDisciplines(), disc, perk);
    if (!res.ok) {
      this.callbacks.onToast(res.reason || `Reach Tier 3 in ${DISCIPLINES[disc].name} to choose a sidegrade perk.`);
      return;
    }
    this.state.disciplines = res.next;
    this.audio.questFanfare();
    const perkDef = DISCIPLINES[disc].perks.find((p) => p.id === perk);
    this.callbacks.onToast(`Selected ${DISCIPLINES[disc].name} Perk: ${perkDef?.name || perk}!`);
    this.emitHud();
  }

  public retrainDisciplinePerk(disc: DisciplineId): void {
    const discs = this.getDisciplines();
    if (!discs[disc]?.perk) return;
    if (!this.takeItem('bottlecap', 10)) {
      this.callbacks.onToast('Retraining a Tier-3 perk costs 10 Bottlecaps.');
      return;
    }
    discs[disc] = { ...discs[disc], perk: null };
    this.audio.ding();
    this.callbacks.onToast(`Cleared ${DISCIPLINES[disc].name} perk — choose your new Tier-3 sidegrade!`);
    this.emitHud();
  }

  public setDifficulty(diff: DifficultyMode): void {
    this.state.difficultyMode = diff;
    this.callbacks.onToast(
      diff === 'relaxed'
        ? 'Difficulty: Relaxed (gentler survival drain & softer enemy bonks).'
        : diff === 'harsh'
          ? 'Difficulty: Harsh (sharper survival drain & tougher foes).'
          : 'Difficulty: Standard.',
    );
    if (this.mode === 'playing') this.saveGame(true);
    this.emitHud();
  }

  private getEffectiveResidentPos(res: ResidentDef, phaseId: PhaseId, time: number): { x: number; y: number } {
    const f = this.state.worldFlags;
    if (
      res.id === 'nix' &&
      f.ferrySupperServedDay > 0 &&
      (this.state.day > f.ferrySupperServedDay || phaseId !== 'day') &&
      (phaseId === 'dusk' || phaseId === 'night')
    ) {
      const table = this.getFerrySupperTable();
      if (table) {
        return { x: table.x + 48, y: table.y + 6 };
      }
    }
    return getResidentPosition(res, phaseId, time);
  }

  public triggerRoll(): void {
    if (this.mode !== 'playing' || this.activeModal || this.state.dead || this.state.player.rollCd > 0) return;
    const p = this.state.player;
    p.rollTimer = 0.22;
    p.invulnTimer = 0.3;
    const styleBonus = p.moveStyle === 'crab_scuttle' ? 0.8 : 1;
    p.rollCd = (this.hasSkill('rubber_knees') ? 1.25 : 2.0) * styleBonus;
    p.squashX = 0.8;
    p.squashY = 1.24;

    const { mx, my } = this.getMoveVector();
    const len = Math.hypot(mx, my);
    const dx = len > 0.1 ? mx / len : p.facing;
    const dy = len > 0.1 ? my / len : 0;
    p.vx = dx * 620;
    p.vy = dy * 620;
    this.audio.roll();
    this.burst(p.x, p.y - 8, '#ff5d8f', 10, 120);
    this.addPopup(p.x, p.y - 36, 'WHOOSH!', '#ff5d8f');
    this.emitHud();
  }

  public resolveRadioRepair(method: CharacterId | 'public'): void {
    const f = this.state.worldFlags;
    if (f.radioRepaired) {
      this.rideTransport('groove_express');
      return;
    }
    if (method === 'public') {
      if (!this.takeItem('radio_stylus', 1)) {
        this.callbacks.onToast('Craft a Pear-Lens Stylus first (Prism Orchard Pear Lens + Cosmic Crystal at a Blender).');
        return;
      }
    } else if (method === 'djmoss') {
      // DJ Moss plays a live rhythm calibration Dance-Off!
      this.danceState = { creatureId: '__radio__', radius: 146, hits: 1, needed: 3, radioMode: true };
      this.setActiveModal('dance', { creatureId: '__radio__' });
      return;
    }

    this.completeRadioRepair(method);
  }

  private completeRadioRepair(method: CharacterId | 'public'): void {
    const f = this.state.worldFlags;
    f.radioRepaired = true;
    f.radioSolution = method;
    this.unlockTransport('groove_express');
    this.audio.radioJingle(true);
    this.audio.questFanfare();
    this.burst(-8850, -5950, '#ffd166', 32, 220);
    this.learnTechnique('resonant_stride');
    this.awardPractice('acoustics', 'repair_radio_unmelted', 45);
    this.gainXP(65);
    this.setActiveModal(null);

    const msgs: Record<CharacterId | 'public', string> = {
      pip: 'Pip patched the tonearm with a pneumatic mail tube! Groove Express & Grove Radio broadcasts are LIVE!',
      barnaby: 'Barnaby steamed the brass joint gently over chamomile! Radio Unmelted & Groove Express are LIVE!',
      djmoss: 'DJ Moss’s custom frog-bass beat IS the new Radio Unmelted signal! Groove Express is LIVE!',
      gerald: 'Gerald stamped Form 1040-R & uncovered his old county jazz license! Radio Unmelted & Groove Express are LIVE!',
      tilda: 'Tilda folded a razor-crisp brass-foil truss around the bent tonearm! Radio Unmelted & Groove Express are LIVE!',
      brin: 'Brin tensioned the tonearm with braided bobbin-line counterweight! Radio Unmelted & Groove Express are LIVE!',
      solfa: 'Solfa soldered the brass stylus shoe with warm tallow wax! Radio Unmelted & Groove Express are LIVE!',
      marlo: 'Marlo inked a waterproof shim into the bent tonearm hinge! Radio Unmelted & Groove Express are LIVE!',
      bea: 'Bea tuned the entire transmission tower to a resonant fifth! Radio Unmelted & Groove Express are LIVE!',
      gus: 'Gus tightened the frost-cracked vacuum gasket with one wrist twist! Radio Unmelted & Groove Express are LIVE!',
      nori: 'Nori clipped a spare greenhouse prism over the worn needle! Radio Unmelted & Groove Express are LIVE!',
      mossie: 'Mossie floated the crooked platter level on buoyant river reeds! Radio Unmelted & Groove Express are LIVE!',
      public: 'Pear-Lens Stylus seated cleanly! Radio Unmelted & Groove Express are LIVE across the county!',
    };
    this.callbacks.onToast(msgs[method]);
    this.addJournalNote(msgs[method]);
    this.saveGame(true);
    this.emitHud();
  }

  public resolveCeremonyChoice(choice: 'public' | 'private'): void {
    const f = this.state.worldFlags;
    f.wickwaterCeremony = choice;
    f.wickworksRestored = true;
    this.unlockTransport('lamp_service_tunnel');
    this.learnTechnique('watchkeepers_collar');
    this.awardPractice('hospitality', 'wickwater_ceremony', 36);
    this.audio.questFanfare();
    this.burst(-1750, 9050, '#ff9f1c', 30, 210);
    this.setActiveModal(null);

    const msg =
      choice === 'public'
        ? 'Public Dedication lit the Wickwater canals! Flicker & Sol unsealed the Lamp-Service Tunnel to Giggle-Grove.'
        : 'Private Delivery honored the Last Unsent Message quietly. Sol & Flicker unsealed the Lamp-Service Tunnel home!';
    this.callbacks.onToast(msg);
    this.addJournalNote(msg);
    this.saveGame(true);
    this.emitHud();
  }

  public playBroadcastStation(stationIndex: number): void {
    const idx = ((Math.floor(stationIndex) % 4) + 4) % 4;
    this.state.worldFlags.broadcastStationIndex = idx;
    this.audio.playStationMotif(idx);
    this.awardPractice('acoustics', `tune_station_${idx}`, 12);
    if (hasPerk(this.getDisciplines(), 'motif_weaver')) {
      this.state.player.vibe = Math.min(this.state.player.maxVibe, this.state.player.vibe + 12);
    }
    this.emitHud();
  }

  public recoverFromMelt(): void {
    const p = this.state.player;
    const diff = this.state.difficultyMode || 'standard';
    const biome = getBiomeAt(p.x, p.y);
    const outcome = buildMeltRecoveryOutcome(this.state.inv, diff, p.x, p.y, this.state.day, biome.name);

    this.state.inv = outcome.keptInv;
    if (outcome.droppedSatchel) {
      this.state.droppedSatchel = outcome.droppedSatchel;
      this.state.waypoint = {
        x: outcome.droppedSatchel.x,
        y: outcome.droppedSatchel.y,
        label: `Lost Satchel (${biome.name})`,
      };
    }

    if (outcome.advanceNextMorning || this.state.dayTime + outcome.daylightCost >= DAY_LENGTH) {
      this.state.day += 1;
      this.state.stats.daysSurvived = this.state.day;
      this.state.dayTime = 6;
    } else {
      this.state.dayTime += outcome.daylightCost;
    }

    p.x = -75;
    p.y = -45;
    p.vx = 0;
    p.vy = 0;
    p.elevation = 0;
    p.vibe = Math.round(p.maxVibe * 0.72);
    p.munch = Math.max(45, Math.round(p.maxMunch * 0.7));
    p.wobble = 14;
    this.state.trips = {};
    this.state.tripMaxDur = {};
    this.state.ghostTimer = 0;
    this.state.dead = false;
    this.state.deathReason = '';
    this.badTripPhantoms = [];
    this.mode = 'playing';
    this.callbacks.onModeChange('playing');
    this.audio.ding();
    this.burst(p.x, p.y - 16, '#ffd166', 20, 150);

    const msg = outcome.droppedSatchel
      ? `Woke safely at Mailbox Square! Your recipes, camp & friendships are intact—follow the compass pin back to ${biome.name} to recover your Lost Satchel.`
      : 'Woke safely at Mailbox Square with your whole satchel intact! Warm up and plan your next outing.';
    this.addJournalNote(msg);
    this.callbacks.onToast(msg);
    this.saveGame(true);
    this.emitHud();
  }

  public collectDroppedSatchel(): void {
    const satchel = this.state.droppedSatchel;
    if (!satchel) return; // Strictly idempotent
    this.state.droppedSatchel = null;
    const summary: string[] = [];
    for (const [k, qty] of Object.entries(satchel.items)) {
      this.giveItem(k, qty);
      summary.push(`+${qty} ${ITEMS[k]?.name || k}`);
    }
    if (this.state.waypoint?.label.startsWith('Lost Satchel')) {
      this.state.waypoint = null;
    }
    this.audio.questFanfare();
    this.burst(satchel.x, satchel.y - 14, '#ffd166', 24, 175);
    this.addPopup(satchel.x, satchel.y - 38, 'Satchel Recovered!', '#ffd166');
    this.callbacks.onToast(`Recovered your Lost Satchel (${summary.slice(0, 4).join(', ')}${summary.length > 4 ? '…' : ''})!`);
    this.saveGame(true);
    this.emitHud();
  }

  public resolveRegionalEvent(choice: 'a' | 'b'): void {
    const ev = this.state.regionalEvent;
    if (!ev) return; // Strictly idempotent
    const p = this.state.player;
    const discs = this.getDisciplines();
    const connBonus = hasPerk(discs, 'county_connector') ? 25 : 0;

    if (ev.id === 'delta_ink_swell') {
      if (choice === 'a') {
        const spent =
          this.takeItem('tide_ink', 1) || this.takeItem('bell_reed', 1) || this.takeItem('ink_voucher', 1);
        if (!spent) {
          this.callbacks.onToast('Need 1 Tide Ink, Bell Reed, or Ink Voucher — or pick the free Footbridge Reroute!');
          return;
        }
        this.giveItem('bottlecap', 15);
        this.giveItem('ink_voucher', 1);
        this.awardPractice('hospitality', 'ev_delta_a', 30);
        this.awardPractice('wayfinding', 'ev_delta_a', 25);
        this.callbacks.onToast('Oona Offset stabilized the Delta pier! +15 Caps, +1 Ink Voucher & route cleared.');
      } else {
        this.giveItem('gossip_slip', 1);
        this.awardPractice('wayfinding', 'ev_delta_b', 18);
        this.callbacks.onToast('Chalk reroute posted along the footbridge! Delta crossings restored peacefully.');
      }
    } else if (ev.id === 'orchard_prism_fog') {
      if (choice === 'a') {
        const freeLead = p.charId === 'nori' || p.charId === 'solfa' || this.state.buildings.some((b) => b.type === 'dock_lamp' || b.type === 'lava_lamp');
        if (!freeLead && !this.takeItem('cosmic_crystal', 1)) {
          this.callbacks.onToast('Need 1 Cosmic Crystal or a Camp Lamp — or pick Shade Berry Harvest!');
          return;
        }
        this.giveItem('lens_pear', 1);
        this.giveItem('seed_pear', 1);
        this.awardPractice('field_botany', 'ev_orchard_a', 30);
        this.callbacks.onToast('Refracted haze cleared across Prism Orchard! +1 Lens-Pear & +1 Pear Seed.');
      } else {
        this.giveItem('fizz_berry', 2);
        this.giveItem('pop_toast', 1);
        this.awardPractice('farming', 'ev_orchard_b', 20);
        this.callbacks.onToast('Cool shade harvest complete! +2 Fizz Berries & +1 Pop-Toast.');
      }
    } else if (ev.id === 'cavern_echo_drift') {
      if (choice === 'a') {
        const freeLead = p.charId === 'bea' || p.charId === 'djmoss';
        const spent = freeLead || this.takeItem('tuned_reed', 1) || this.takeItem('bell_reed', 1);
        if (!spent) {
          this.callbacks.onToast('Need 1 Bell Reed or Tuned Reed (free for Bea/DJ Moss) — or pick Story Hour!');
          return;
        }
        this.giveItem('bottlecap', 18);
        this.giveItem('tuned_reed', 1);
        this.awardPractice('acoustics', 'ev_cavern_a', 35);
        this.callbacks.onToast('County carrier wave locked back in fifths! +18 Caps & +1 Tuned Reed.');
      } else {
        p.vibe = Math.min(p.maxVibe, p.vibe + 20);
        this.giveItem('gossip_slip', 1);
        this.awardPractice('hospitality', 'ev_cavern_b', 25);
        this.callbacks.onToast('Cozy Acoustic Story Hour warmed the whole county! +20 Vibe & +1 Juicy Gossip.');
      }
    }

    if (connBonus > 0) {
      p.vibe = Math.min(p.maxVibe, p.vibe + 15);
    }
    this.gainXP(30 + connBonus);
    this.addJournalNote(`Resolved regional event "${ev.title}" with eyewitness ${ev.eyewitnessName} on Day ${this.state.day}.`);
    this.state.regionalEvent = null;
    this.state.regionalEventCooldownDay = this.state.day + 2;
    this.audio.questFanfare();
    this.setActiveModal(null);
    this.saveGame(true);
    this.emitHud();
  }

  public hostAllNightBroadcast(): void {
    const f = this.state.worldFlags;
    const sync = computeCountySyncStatus(
      f,
      this.state.stats,
      this.state.creatures.filter((c) => c.tamed).length,
      Object.values(this.state.npcMemories).filter((m) => m.talked).length,
      this.state.player.charId,
    );
    if (!sync.readyForBroadcast) {
      this.callbacks.onToast(
        `Restore at least 3 county landmarks (currently ${sync.restoredCount}/${sync.totalRestorations}) before going live!`,
      );
      return;
    }

    const firstTime = !f.allNightBroadcastHosted;
    f.allNightBroadcastHosted = true;
    if (firstTime) {
      this.giveItem('broadcast_pin', 1);
      this.awardPractice('acoustics', 'host_all_night_broadcast', 55);
      this.awardPractice('hospitality', 'host_all_night_broadcast', 55);
      this.gainXP(120);
      this.addJournalNote(
        `Hosted the All-Night County Broadcast on Day ${this.state.day} as ${CHARACTERS[this.state.player.charId].name}${sync.peacefulRoute ? ' (Peaceful Route)' : ''}!`,
      );
    }
    this.audio.radioJingle(true);
    this.audio.questFanfare();
    this.burst(-70, -195, '#ffd166', 32, 210);
    this.soundRipples.push({
      x: -70,
      y: -195,
      radius: 18,
      maxRadius: 210,
      color: '#ff5d8f',
      glyph: '♫',
      life: 1.8,
      maxLife: 1.8,
    });
    this.callbacks.onToast(
      firstTime
        ? 'ON AIR! Your All-Night County Broadcast echoed across all 15 regions! (+1 Broadcast Pin — keep exploring freely!)'
        : 'Broadcast replay queued across Unmelted County! Keep exploring anytime.',
    );
    this.saveGame(true);
    this.emitHud();
  }

  public resolveResidentStoryAction(residentId: string): void {
    const f = this.state.worldFlags;
    const mem = this.state.npcMemories[residentId] || { talked: true, helped: false, visits: 1 };

    if (residentId === 'miri') {
      f.rooftopShortcutLearned = true;
      mem.helped = true;
      this.learnTechnique('paper_fold_glide');
    } else if (residentId === 'nell') {
      if (!f.radioRepaired) {
        this.setActiveModal('radio_repair');
        return;
      }
      this.rideTransport('groove_express');
      return;
    } else if (residentId === 'oona' || residentId === 'inkling') {
      if (!f.deltaMuralSolved) {
        f.deltaMuralSolved = true;
        mem.helped = true;
        this.learnTechnique('mural_step');
        this.callbacks.onToast('Compromise Overprint! Oona’s heritage waves now shine beneath Inkling’s luminous timetable.');
        this.addJournalNote('Resolved the Carbon Copy Delta mural—both Oona’s waves and Inkling’s bold arrows now live on the wall.');
      }
    } else if (residentId === 'nix') {
      if (!f.ferryRestored && this.takeItem('misfiled_permit', 1)) {
        f.ferryRestored = true;
        mem.helped = true;
        this.unlockTransport('records_ferry');
        this.learnTechnique('current_sense');
        this.callbacks.onToast('Public Records Ferry restored! Ring either pier bell or use the Atlas to ride between Delta & Bog.');
        this.addJournalNote('Returned the shore-marked Triplicate Permit to Capt. Nix. Public Records Ferry is running!');
      } else if (f.ferryRestored && !f.ferryInsulated && this.takeItem('compost_insulation', 1)) {
        f.ferryInsulated = true;
        this.giveItem('bottlecap', 28);
        this.gainXP(45);
        this.audio.questFanfare();
        this.callbacks.onToast('Capt. Nix insulated the ferry cabin with Dot’s Compost! Cross-region supply chain complete (+28 Caps)!');
      } else if (f.ferryRestored) {
        this.rideTransport('records_ferry');
        return;
      }
    } else if (residentId === 'pell') {
      if (f.orchardRipened) {
        this.learnTechnique('refracted_focus');
        if ((this.state.inv.pear_lens || 0) === 0 && !f.radioRepaired) {
          this.giveItem('pear_lens', 1);
          this.callbacks.onToast('Pell gifted you a Rejected Pear Lens! Blend with Cosmic Crystal for a Radio Stylus.');
        }
      }
    } else if (residentId === 'auntie_bias') {
      if (!f.socksHung && f.sockHalfAFound && f.sockHalfBFound) {
        this.takeItem('giant_sock_left', 1);
        this.takeItem('giant_sock_right', 1);
        f.socksHung = true;
        mem.helped = true;
        this.unlockTransport('sock_clothesline');
        this.learnTechnique('gust_trimmed_hem');
        this.callbacks.onToast('Giant Sock Clothesline stretched from Clothespin Harbor to Cloud-9 Drying Gardens!');
        this.addJournalNote('Hung the Giant Sock Clothesline for Auntie Bias—fast wind-transit to Cloud-9 unlocked!');
      } else if (f.socksHung) {
        this.rideTransport('sock_clothesline');
        return;
      }
    } else if (residentId === 'dot_mulch') {
      if (!f.compostPostalAssigned) {
        f.compostPostalAssigned = true;
        mem.helped = true;
        this.giveItem('compost_insulation', 1);
        this.learnTechnique('cork_sole_insulation');
        this.callbacks.onToast('Assigned Freezer-Door Postal #4B! Dot gifted Warm Compost Insulation for Capt. Nix’s Ferry.');
        this.addJournalNote('Registered Dot Mulch’s Compost Postal Address #4B and received Warm Compost Insulation.');
      }
    } else if (residentId === 'sol_shortwick' || residentId === 'flicker_shortwick') {
      if (!f.wickworksRestored) {
        this.setActiveModal('ceremony_choice');
        return;
      }
      this.rideTransport('lamp_service_tunnel');
      return;
    }

    this.state.npcMemories[residentId] = mem;
    this.emitHud();
  }

  public triggerBoop(): void {
    if (this.mode !== 'playing' || this.activeModal || this.state.dead) return;
    if (this.buildingMove) {
      this.placeMovedBuilding();
      return;
    }
    const p = this.state.player;
    const phase = getPhaseFromDayTime(this.state.dayTime);
    p.actionAnim = 0.24;
    p.squashX = 1.2;
    p.squashY = 0.84;

    // 1. Check Residents (8 Peoples + Returning Locals, including Capt. Nix evening Camp Table visit!)
    for (const res of RESIDENTS) {
      const pos = this.getEffectiveResidentPos(res, phase.id, this.state.time);
      if (Math.hypot(pos.x - p.x, pos.y - p.y) < 92) {
        const mem = this.state.npcMemories[res.id] || { talked: false, helped: false, visits: 0 };
        mem.talked = true;
        mem.visits += 1;
        this.state.npcMemories[res.id] = mem;
        this.awardPractice('hospitality', `talk_${res.id}`, 12);
        this.audio.ding();
        this.setActiveModal('resident', { residentId: res.id });
        return;
      }
    }

    // 2. Check Interactive World Features (Damp Note, Delta Fishing Bank, Towers, Mirrors, Bridges, Ramps, Socks, Valves, Hatch, Pass 3 Landmarks)
    for (const f of WORLD_FEATURES) {
      if (f.kind === 'grooves_track' || f.kind === 'jam_canal' || f.kind === 'stamp_bridge' || f.kind === 'wash_line' || f.kind === 'appliance_bulb' || f.kind === 'candleboat') {
        continue;
      }
      if (Math.hypot(f.x - p.x, f.y - p.y) < f.radius + 20) {
        if (f.kind === 'ferry_note') {
          this.audio.ding();
          this.setActiveModal('ferry_note');
          return;
        }
        if (f.kind === 'dock_lamp_spot') {
          this.moveDockLamp();
          return;
        }
        if (f.kind === 'fishing_bank') {
          this.startCast(this.selectedCastSlot);
          return;
        }
        if (f.kind === 'rooftop_ramp') {
          p.elevation = p.elevation === 0 ? 1 : 0;
          this.state.worldFlags.rooftopShortcutLearned = true;
          this.audio.roll();
          this.addPopup(p.x, p.y - 44, p.elevation === 1 ? 'Climbed Rooftop Walk!' : 'Back to Street Level', '#ffd166');
          this.emitHud();
          return;
        }
        if (f.kind === 'mailbox_radio') {
          this.audio.radioJingle(this.state.worldFlags.radioRepaired);
          this.setActiveModal('all_night_broadcast');
          return;
        }
        if (f.kind === 'listening_booth') {
          this.audio.radioJingle(this.state.worldFlags.radioRepaired);
          upgradeDiscovery(this.state.discoveries, 'dead_air_basin', 'seen');
          upgradeDiscovery(this.state.discoveries, 'lm_radio_unmelted', 'seen');
          this.callbacks.onToast(
            this.state.worldFlags.radioRepaired
              ? 'All 3 notes ringing crystal clear across Vinyl Desert!'
              : 'Two lonely notes echo from Dead Air Basin to the northwest. Marked Radio Unmelted on your Atlas!',
          );
          this.setWaypoint({ x: -8850, y: -5950, label: 'Radio Unmelted Tower' });
          return;
        }
        if (f.kind === 'radio_tower') {
          this.setActiveModal('radio_repair');
          return;
        }
        if (f.kind === 'mural_wall') {
          if (!this.state.worldFlags.deltaMuralSolved) {
            this.resolveResidentStoryAction('oona');
          } else {
            this.callbacks.onToast('Oona’s heritage waves & Inkling’s bold route arrows gleam in harmony.');
          }
          return;
        }
        if (f.kind === 'duplicate_drift') {
          if (!this.state.worldFlags.originalDriftFound) {
            this.state.worldFlags.originalDriftFound = true;
            this.state.worldFlags.deltaPermitFound = true;
            this.giveItem('misfiled_permit', 1);
            this.audio.questFanfare();
            this.burst(f.x, f.y - 14, '#2ec4b6', 20, 160);
            this.callbacks.onToast('Found the shore-marked Triplicate Ferry Permit! Bring it to Capt. Nix Lowwater.');
            this.emitHud();
          } else {
            this.callbacks.onToast('Only harmless rain-cloned carbon copies bobbing here now.');
          }
          return;
        }
        if (f.kind === 'ferry_bell') {
          if (this.state.worldFlags.ferryRestored) {
            this.rideTransport('records_ferry');
          } else {
            this.audio.ding();
            this.callbacks.onToast('Bell impounded! Recover the shore-marked Triplicate Permit for Capt. Nix in the Delta.');
          }
          return;
        }
        if (f.kind === 'mirror') {
          const next = ((this.state.mirrorAngles[f.id] ?? 0) + 1) % 4;
          this.state.mirrorAngles[f.id] = next;
          const alignedCount = computeMirrorRipenCount(this.state.mirrorAngles);
          this.state.worldFlags.orchardMirrorsAligned = alignedCount;
          this.audio.glassChime();
          this.burst(f.x, f.y - 26, '#72efdd', 12, 130);
          if (alignedCount === 3 && !this.state.worldFlags.orchardRipened) {
            this.state.worldFlags.orchardRipened = true;
            this.giveItem('pear_lens', 1);
            this.giveItem('lens_pear', 2);
            this.learnTechnique('refracted_focus');
            this.audio.questFanfare();
            this.callbacks.onToast('All 3 Orchard Mirrors converged! Greenhouse ripened (+1 Rejected Pear Lens for Radio Stylus)!');
          } else {
            this.addPopup(f.x, f.y - 46, `Mirror Aligned: ${alignedCount}/3`, '#72efdd');
          }
          this.emitHud();
          return;
        }
        if (f.kind === 'sock_half_a' && !this.state.worldFlags.sockHalfAFound) {
          this.state.worldFlags.sockHalfAFound = true;
          this.giveItem('giant_sock_left', 1);
          this.audio.harvest();
          this.burst(f.x, f.y - 18, '#ff85b3', 18, 150);
          this.callbacks.onToast('Collected the Colossal Left Sock! Find its mate or visit Auntie Bias.');
          this.emitHud();
          return;
        }
        if (f.kind === 'sock_half_b' && !this.state.worldFlags.sockHalfBFound) {
          this.state.worldFlags.sockHalfBFound = true;
          this.giveItem('giant_sock_right', 1);
          this.audio.harvest();
          this.burst(f.x, f.y - 18, '#ffd166', 18, 150);
          this.callbacks.onToast('Collected the Colossal Right Sock! Bring both halves to Auntie Bias at Clothespin Harbor.');
          this.emitHud();
          return;
        }
        if (f.kind === 'dryer_lighthouse') {
          this.audio.dryerKnock();
          this.callbacks.onToast('Offshore Dryer: knocks twice right before Unpaired Sea wind gusts turn!');
          return;
        }
        if (f.kind === 'defrost_valve') {
          if (!this.state.worldFlags.defrostDiverted) {
            this.state.worldFlags.defrostDiverted = true;
            this.audio.questFanfare();
            this.burst(f.x, f.y - 22, '#72efdd', 24, 175);
            this.callbacks.onToast('Meltwater Sluice diverted! Wickwater’s candleboat canals are safe from defrost floods.');
            this.emitHud();
          } else {
            this.callbacks.onToast('Sluice valve steady—enamel reservoir draining cleanly.');
          }
          return;
        }
        if (f.kind === 'unsent_letter_box') {
          if (!this.state.worldFlags.wickworksRestored) {
            this.setActiveModal('ceremony_choice');
          } else {
            this.rideTransport('lamp_service_tunnel');
          }
          return;
        }
        if (f.kind === 'tunnel_hatch') {
          if (this.state.worldFlags.wickworksRestored) {
            this.rideTransport('lamp_service_tunnel');
          } else {
            this.audio.boop();
            this.callbacks.onToast('Old Lamp-Service Tunnel sealed from below. Restore Wickwater Wickworks in the deep south!');
          }
          return;
        }
        if (f.kind === 'tuning_fork') {
          const first = !this.state.worldFlags.undertoneForkTuned;
          this.state.worldFlags.undertoneForkTuned = true;
          this.audio.tuningForkChord();
          this.burst(f.x, f.y - 24, '#b388ff', 24, 180);
          this.soundRipples.push({
            x: f.x,
            y: f.y - 20,
            radius: 14,
            maxRadius: 170,
            color: '#b388ff',
            glyph: '♪',
            life: 1.6,
            maxLife: 1.6,
          });
          if (first) {
            this.giveItem('tuned_reed', 2);
            const bonus = p.charId === 'bea' ? 2 : 1;
            this.awardPractice('acoustics', 'tune_undertone_fork', 48 * bonus);
            this.gainXP(55);
            this.addJournalNote('Struck the Fallen Tuning Fork in Undertone Caverns! Moth Choir resonance unlocked (+2 Tuned Reeds).');
            this.callbacks.onToast('Fallen Tuning Fork humming in fifths! +2 Tuned Reeds & Acoustics XP.');
            this.saveGame(true);
          } else {
            this.callbacks.onToast('The Fallen Tuning Fork hums a warm cavern fifth across Undertone Caverns.');
          }
          if (hasPerk(this.getDisciplines(), 'motif_weaver')) {
            p.vibe = Math.min(p.maxVibe, p.vibe + 12);
            for (const c of this.state.creatures) {
              if (Math.hypot(c.x - f.x, c.y - f.y) < 320) c.danceTimer = 3.5;
            }
          }
          this.emitHud();
          return;
        }
        if (f.kind === 'tide_press') {
          const first = !this.state.worldFlags.negativePressRestored;
          this.state.worldFlags.negativePressRestored = true;
          this.audio.pressStamp();
          this.burst(f.x, f.y - 18, '#2ec4b6', 24, 175);
          this.spawnWaterRipple(f.x, f.y, '#2ec4b6', 76);
          if (first) {
            this.giveItem('tide_ink', 2);
            this.awardPractice('fabrication', 'restore_tide_press', 42);
            this.awardPractice('wayfinding', 'chart_negative_coast', 36);
            this.gainXP(55);
            this.addJournalNote('Restored the Negative Tide Press on the Negative Coast! Coastal proofs & Tide-Ink flowing.');
            this.callbacks.onToast('Negative Tide Press calibrated! +2 Tide-Ink Proof & Fabrication/Wayfinding XP.');
            this.saveGame(true);
          } else {
            this.callbacks.onToast('Negative Tide Press is printing crisp low-tide shadow charts.');
          }
          this.emitHud();
          return;
        }
        if (f.kind === 'hanging_gutter') {
          const first = !this.state.worldFlags.invertedGutterDirected;
          this.state.worldFlags.invertedGutterDirected = true;
          this.audio.gutterSplash();
          this.burst(f.x, f.y - 20, '#a8ff3e', 24, 180);
          if (first) {
            this.giveItem('upside_clover', 2);
            this.giveItem('seed_upside_clover', 2);
            this.awardPractice('farming', 'redirect_hanging_gutter', 46);
            this.awardPractice('building', 'redirect_hanging_gutter', 32);
            this.gainXP(55);
            this.addJournalNote('Redirected the Hanging Rain Gutter in Inverted Allotments! Received 2 Upside Clover & 2 Gravity Clover Seeds.');
            this.callbacks.onToast('Hanging Rain Gutter redirected! +2 Upside Clover & +2 Gravity Clover Seeds.');
            this.saveGame(true);
          } else {
            this.callbacks.onToast('Hanging Rain Gutter showers the upside-down plots in warm upward drizzle.');
          }
          this.emitHud();
          return;
        }
      }
    }

    // 3. Check Mailboxes
    for (const m of this.state.mailboxes) {
      if (Math.hypot(m.x - p.x, m.y - p.y) < 82) {
        if (!m.discovered) {
          m.discovered = true;
          this.awardPractice('wayfinding', `mailbox_${m.biomeId}`, 20);
        }
        this.audio.trip();
        this.setActiveModal('wormhole');
        return;
      }
    }

    // 3b. Check Dropped Recoverable Satchel
    if (this.state.droppedSatchel && Math.hypot(this.state.droppedSatchel.x - p.x, this.state.droppedSatchel.y - p.y) < 88) {
      this.collectDroppedSatchel();
      return;
    }

    // 4. Check Buildings
    for (const b of this.state.buildings) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < 82) {
        if (b.type === 'mood_plot') {
          this.interactPlot(b);
          return;
        }
        if (b.type === 'specimen_cabinet') {
          this.awardPractice('field_botany', 'inspect_specimen_cabinet', 18);
          this.audio.ding();
          this.callbacks.onToast(
            `Specimen Cabinet displays ${this.state.journalSketches?.length || 0} identified field sketches!`,
          );
          this.setActiveModal('camp_manage', { buildingId: b.id });
          return;
        }
        if (
          b.type === 'camp_table' ||
          b.type === 'bench' ||
          b.type === 'dock_lamp' ||
          b.type === 'workbench' ||
          b.type === 'rain_trough' ||
          b.type === 'frost_pantry' ||
          b.type === 'choir_irrigator' ||
          b.type === 'camp_awning' ||
          b.type === 'camp_relay'
        ) {
          this.audio.ding();
          this.setActiveModal('camp_manage', { buildingId: b.id });
          return;
        }
        if (b.type === 'funk_blender') {
          this.setActiveModal('craft');
          return;
        }
        if (b.type === 'sassy_chest') {
          const roasts = [
            'More shrooms? Truly groundbreaking.',
            'Your pockets smell aggressively of toast.',
            'Fifteen regions and still wearing that hat?',
          ];
          this.audio.boop();
          this.addPopup(b.x, b.y - 44, roasts[Math.floor(Math.random() * roasts.length)], '#ff85b3');
          return;
        }
      }
    }

    // 5. Check Creatures
    let closestCr: Creature | null = null;
    let bestCrDist = 92;
    for (const c of this.state.creatures) {
      if (c.aiState === 'ko') continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestCrDist) {
        bestCrDist = d;
        closestCr = c;
      }
    }
    if (closestCr) {
      const def = CREATURE_DEFS[closestCr.type];
      if (def.hostile) {
        const dmg = p.gear.prismShades ? 34 : 28;
        const dx = closestCr.x - p.x;
        const dy = closestCr.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        closestCr.vx = (dx / len) * 290;
        closestCr.vy = (dy / len) * 290;
        this.damageCreature(closestCr, dmg);
        return;
      }
      closestCr.hitAnim = 0.25;
      this.audio.boop();
      this.setActiveModal('social', { creatureId: closestCr.id });
      return;
    }

    // 6. Check Harvestable World Objects
    const seeCrystals = canSeeCrystals(p, this.activeTripsSet(), this.state.exp?.id ?? null);
    let bestObj = null as GameState['objects'][number] | null;
    let bestObjDist = 90;
    for (const o of this.state.objects) {
      if (o.respawn > 0 || (o.type === 'crystal' && !seeCrystals)) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d < bestObjDist) {
        bestObjDist = d;
        bestObj = o;
      }
    }

    if (bestObj) {
      bestObj.hp -= 1;
      bestObj.shake = 0.26;
      bestObj.hitFlash = 0.08;
      this.burst(bestObj.x, bestObj.y - 18, '#ffd166', 8, 120);

      if (bestObj.hp <= 0) {
        if (bestObj.type === 'pear_tree') this.audio.glassChime();
        else this.audio.harvest();
        this.hitstop = 0.032;
        if (!this.state.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.14);
        bestObj.respawn = 30;
        bestObj.hp = bestObj.maxHp;
        this.state.stats.harvests += 1;

        const lootMap: Record<ObjectType, [string, number]> = {
          tree: ['rubber_wood', 2],
          shroom: ['shroom', 1],
          berry: ['fizz_berry', 1],
          crystal: ['cosmic_crystal', 1],
          cabinet: ['gossip_slip', 1],
          pickle: ['chrono_pickle', 1],
          hyper: ['hyper_fizz', 1],
          broc: ['frost_broc', 1],
          cocoa: ['void_cocoa', 1],
          sock_pile: ['left_sock', 1],
          cloud: ['cloud_puff', 1],
          pear_tree: ['lens_pear', 1],
          receipt_reed: ['ink_voucher', 1],
          wax_bloom: ['void_cocoa', 1],
          frozen_pea: ['frost_broc', 1],
          geode: ['prism_dust', 1],
          salvage_crate: ['bottlecap', 6],
          moon_orchid: ['moon_petal', 1],
          eye_bloom: ['shroom', 1],
          tuned_reed_patch: ['tuned_reed', 1],
          gravity_clover_patch: ['upside_clover', 1],
        };
        const [itemId, qty] = lootMap[bestObj.type];
        this.giveItem(itemId, qty);
        const activeProf = computeTripProfile(p.vibe, p.maxVibe, p.wobble, this.state.trips, this.state.tripMaxDur, this.isNearCalmingTotem());
        if (bestObj.type === 'crystal' || bestObj.type === 'geode') {
          this.state.stats.crystalsFound += 1;
          if (bestObj.type === 'geode') this.giveItem('cosmic_crystal', 1);
          if (activeProf.synergy?.crystalBonus) {
            this.giveItem('cosmic_crystal', 1);
            this.addPopup(bestObj.x, bestObj.y - 54, 'Starglass Bonus +1 Crystal!', '#72efdd');
          }
        }
        if (bestObj.type === 'salvage_crate') {
          const bonusPool = ['rubber_wood', 'grounding_salt', 'prism_absinthe', 'hyper_fizz'];
          const bonusItem = bonusPool[Math.floor(Math.random() * bonusPool.length)];
          this.giveItem(bonusItem, 1);
          this.addPopup(bestObj.x, bestObj.y - 54, `Salvage Bonus: +1 ${ITEMS[bonusItem]?.name || bonusItem}!`, '#ffd166');
        }
        if (bestObj.type === 'eye_bloom' && Math.random() < 0.45) {
          this.giveItem('prism_absinthe', 1);
          this.addPopup(bestObj.x, bestObj.y - 54, '+1 Prism Absinthe!', '#72efdd');
        }
        if ((bestObj.type === 'moon_orchid' || bestObj.type === 'eye_bloom') && hasPerk(this.getDisciplines(), 'nocturnal_spotter')) {
          const bonusId = bestObj.type === 'moon_orchid' ? 'moon_petal' : 'prism_dust';
          this.giveItem(bonusId, 1);
          this.addPopup(bestObj.x, bestObj.y - 72, `Nocturnal Spotter +1 ${ITEMS[bonusId]?.name || bonusId}!`, '#b388ff');
        }
        if (bestObj.type === 'tuned_reed_patch') {
          this.awardPractice('acoustics', 'harvest_tuned_reed', 14);
        }
        if (bestObj.type === 'gravity_clover_patch' && Math.random() < 0.65) {
          this.giveItem('seed_upside_clover', 1);
          this.addPopup(bestObj.x, bestObj.y - 54, '+1 Gravity Clover Seed!', '#a8ff3e');
        }
        if (bestObj.type === 'cabinet' || bestObj.type === 'tree') this.giveItem('bottlecap', 2);
        if (bestObj.type === 'shroom' && Math.random() < 0.42) this.giveItem('seed_shroom', 1);
        if (bestObj.type === 'pickle' && Math.random() < 0.42) this.giveItem('seed_pickle', 1);
        if (bestObj.type === 'pear_tree' && bestObj.ripeChime) {
          this.giveItem('pear_lens', 1);
          this.addPopup(bestObj.x, bestObj.y - 54, '+1 Rejected Pear Lens!', '#72efdd');
        }
        this.addPopup(bestObj.x, bestObj.y - 34, `+${qty} ${ITEMS[itemId]?.name || itemId}`, '#2ec4b6');
        this.gainXP(7);
      } else {
        this.audio.boop();
        this.addPopup(bestObj.x, bestObj.y - 28, 'BOING!', '#fffdf7');
      }
      this.emitHud();
    } else {
      this.audio.boop();
      this.burst(p.x + p.facing * 24, p.y - 18, '#ffd166', 4, 70);
    }
  }

  private damageCreature(c: Creature, amount: number): void {
    const def = CREATURE_DEFS[c.type];
    c.hp -= amount;
    c.hitAnim = 0.25;
    c.hitFlash = 0.08;
    this.audio.heavyHit();
    this.hitstop = def.boss ? 0.06 : 0.04;
    if (!this.state.reducedMotion) this.trauma = Math.min(1, this.trauma + (def.boss ? 0.36 : 0.22));
    this.burst(c.x, c.y - 20, '#ff5d8f', def.boss ? 20 : 14, 175);
    this.addPopup(c.x, c.y - 48, def.boss ? `BONK -${amount} (${Math.max(0, c.hp)} HP)` : `BONK -${amount}!`, '#ffd166');

    if (c.hp <= 0 && c.aiState !== 'ko') {
      c.aiState = 'ko';
      c.koTimer = 0.4;
      c.hasToken = false;
      this.state.stats.enemiesBonked += 1;
      this.giveItem(def.drop, def.boss ? 4 : 2);
      this.giveItem('bottlecap', def.boss ? 40 : 9);
      this.gainXP(def.boss ? 110 : 26);
      if (def.boss) {
        this.state.stats.bossDefeated += 1;
        this.audio.questFanfare();
        this.callbacks.onToast('DEFEATED THE GRAND TAX OCTOPUS! Clerk Bram is mildly heartbroken, +40 Bottlecaps!');
      } else {
        this.callbacks.onToast(`Bonked ${def.name}! +9 Bottlecaps.`);
      }
      this.emitHud();
    }
  }

  private interactPlot(plot: Building): void {
    if (plot.crop) {
      const crop = CROPS[plot.crop];
      if (isCropReady(plot.crop, plot.growth)) {
        const yieldBonus = hasPerk(this.getDisciplines(), 'graft_sage') ? 1 : 0;
        for (const [k, v] of Object.entries(crop.yield)) this.giveItem(k, v + yieldBonus);
        this.audio.harvest();
        this.burst(plot.x, plot.y - 12, crop.accent, 18, 150);
        this.addPopup(plot.x, plot.y - 36, `Harvested ${crop.name}!`, '#2ec4b6');
        const harvestedCrop = plot.crop;
        plot.crop = null;
        plot.growth = 0;
        this.state.stats.cropsHarvested += 1;
        this.awardPractice('farming', `harvest_${harvestedCrop}`, 28);
        this.gainXP(16);
        this.emitHud();
      } else {
        const bonusGrow = (this.hasSkill('green_thumb') ? 10 : 6) + (hasPerk(this.getDisciplines(), 'hydro_tender') ? 4 : 0);
        plot.growth = Math.min(crop.time, plot.growth + bonusGrow);
        this.audio.boop();
        this.burst(plot.x, plot.y - 10, '#ff85b3', 8, 90);
        this.addPopup(plot.x, plot.y - 34, '"Radiant sprout!"', '#ff85b3');
        this.awardPractice('farming', `tend_${plot.crop}`, 8);
        this.tryHybridize(plot);
      }
      return;
    }

    const seeds = [
      'seed_bell_reed',
      'seed_upside_clover',
      'seed_shroom',
      'seed_toast',
      'seed_pickle',
      'seed_pear',
      'seed_moss',
    ].filter((s) => (this.state.inv[s] || 0) > 0);
    if (!seeds.length) {
      this.callbacks.onToast('No seeds! Check the Damp Note for a Bell Reed Rhizome, or barter with Sir Reginald.');
      return;
    }
    this.setActiveModal('plant', { plotId: plot.id });
  }

  public plantOnPlot(plotId: string, seedId: string): void {
    const plot = this.state.buildings.find((b) => b.id === plotId);
    const seed = ITEMS[seedId];
    if (!plot || plot.type !== 'mood_plot' || plot.crop || !seed?.crop || !this.takeItem(seedId, 1)) return;
    plot.crop = seed.crop;
    plot.growth = 0;
    this.audio.boop();
    this.awardPractice('farming', `plant_${seed.crop}`, 16);
    this.setActiveModal(null);
    this.callbacks.onToast(`Planted ${CROPS[seed.crop].name}! Boop to compliment sprouts.`);
  }

  private tryHybridize(plot: Building): void {
    const hybrid = checkHybridPair(plot, this.state.buildings);
    if (!hybrid) return;
    const chance = this.hasSkill('green_thumb') ? 0.68 : 0.36;
    if (Math.random() < chance) {
      plot.crop = hybrid;
      this.audio.trip();
      this.burst(plot.x, plot.y - 12, '#ffd166', 24, 170);
      this.awardPractice('field_botany', `hybrid_${hybrid}`, 32);
      this.callbacks.onToast(`HYBRID MUTATION! Sprout evolved into ${CROPS[hybrid].name}!`);
    }
  }

  public craftRecipe(recipeId: string): void {
    const r = RECIPES.find((x) => x.id === recipeId);
    if (!r) return;
    const check = canCraftRecipe(
      r,
      this.state.inv,
      this.isNearBlender(),
      this.state.player.gear,
      this.state.unlockedStyles,
      { nearWorkbench: this.isNearWorkbench(), disciplines: this.state.disciplines },
    );
    if (!check.ok) {
      this.callbacks.onToast(check.reason || 'Requirements not met yet.');
      return;
    }

    const p = this.state.player;
    if (r.type === 'place') {
      const placeX = p.x + p.facing * 52;
      const placeY = p.y + 8;
      const placeCheck = validateBuildingPlacement(
        placeX,
        placeY,
        r.id as Building['type'],
        this.state.buildings,
        this.state.mailboxes,
        WORLD_FEATURES,
      );
      if (!placeCheck.ok) {
        this.audio.hurt();
        this.callbacks.onToast(placeCheck.reason || 'Step into clear space before placing this structure!');
        return;
      }
    }

    const effCost = getEffectiveRecipeCost(r, this.state.disciplines);
    Object.entries(effCost).forEach(([k, v]) => this.takeItem(k, v));
    this.audio.ding();

    if (r.type === 'place') {
      this.state.buildings.push({
        id: `bld_${Math.random().toString(36).slice(2, 8)}`,
        type: r.id as Building['type'],
        x: p.x + p.facing * 52,
        y: p.y + 8,
        phase: 0,
        crop: null,
        growth: 0,
        rotation: 0,
      });
      this.state.stats.buildingsBuilt = (this.state.stats.buildingsBuilt || 0) + 1;
      this.awardPractice('building', `build_${r.id}`, 28);
      this.burst(p.x + p.facing * 52, p.y, '#ffd166', 14, 125);
      this.callbacks.onToast(`Placed ${r.name}! Press Space near it to manage, move, rotate, or salvage.`);
    } else if (r.type === 'gear' && r.gearKey) {
      p.gear[r.gearKey] = true;
      this.awardPractice('fabrication', `gear_${r.id}`, 36);
      this.callbacks.onToast(`Equipped ${r.name}!`);
    } else if (r.type === 'style' && r.style) {
      if (!this.state.unlockedStyles.includes(r.style)) this.state.unlockedStyles.push(r.style);
      p.moveStyle = r.style;
      this.awardPractice('fabrication', `style_${r.id}`, 24);
      this.callbacks.onToast(`Unlocked & equipped ${r.name}!`);
    } else if (r.type === 'blend' && r.out) {
      Object.entries(r.out).forEach(([k, v]) => this.giveItem(k, v));
      this.awardPractice('fabrication', `craft_${r.id}`, 24);
      this.callbacks.onToast(`Crafted ${r.name}!`);
    }
    this.gainXP(15);
    this.setActiveModal(null);
  }

  public triggerFroth(): void {
    this.state.shakeBonus = true;
    this.audio.trip();
    this.callbacks.onToast('Funk-Blender frothed! Your next Disco Overdrive grants +30 bonus Vibe.');
    this.emitHud();
  }

  public setMoveStyle(styleId: MoveStyleId): void {
    if (!this.state.unlockedStyles.includes(styleId)) return;
    this.state.player.moveStyle = styleId;
    this.audio.boop();
    this.callbacks.onToast(`Movement style set to ${STYLES[styleId].name}.`);
    this.setActiveModal(null);
  }

  public buySkill(skillId: string): void {
    const sk = SKILLS.find((s) => s.id === skillId);
    if (!sk || this.hasSkill(skillId) || this.state.sp < sk.cost) return;
    this.state.sp -= sk.cost;
    this.state.skills.push(skillId);
    this.audio.questFanfare();
    this.callbacks.onToast(`Learned ${sk.name}!`);
    this.emitHud();
  }

  public claimQuest(questId: string): void {
    const q = QUESTS.find((x) => x.id === questId);
    if (!q || this.state.claimedQuests.includes(q.id)) return;
    if (getQuestProgress(q, this.state.stats, this.state.worldFlags) < q.target) return;
    this.state.claimedQuests.push(q.id);
    this.giveItem('bottlecap', q.rewardCaps);
    if (q.rewardItems) {
      Object.entries(q.rewardItems).forEach(([k, v]) => this.giveItem(k, v));
    }
    this.gainXP(q.rewardXp);
    this.audio.questFanfare();
    this.callbacks.onToast(`Quest Complete: ${q.title}! +${q.rewardCaps} Bottlecaps & +${q.rewardXp} XP.`);
    this.emitHud();
  }

  public warpToMailbox(mailboxId: number): void {
    const m = this.state.mailboxes.find((x) => x.id === mailboxId);
    if (!m || !m.discovered) return;
    this.trailRun = null;
    this.state.player.x = m.x + 56;
    this.state.player.y = m.y + 42;
    this.state.player.elevation = 0;
    this.camX = this.state.player.x;
    this.camY = this.state.player.y;
    this.audio.trip();
    this.burst(this.state.player.x, this.state.player.y - 16, m.col, 24, 180);
    this.setActiveModal(null);
    this.callbacks.onToast(`Wormhole Mail delivered you to ${m.biomeName}!`);
  }

  public doSocial(creatureId: string, action: 'compliment' | 'boop' | 'feed'): void {
    const c = this.state.creatures.find((x) => x.id === creatureId);
    if (!c) return;
    const def = CREATURE_DEFS[c.type];
    if (action === 'compliment') {
      c.say = 'OH STOP IT!';
      c.sayTimer = 2.2;
      this.giveItem('gossip_slip', 1);
      if (this.hasSkill('smooth_talker')) this.giveItem('bottlecap', 3);
      if (hasPerk(this.getDisciplines(), 'gentle_hand')) {
        this.state.player.vibe = Math.min(this.state.player.maxVibe, this.state.player.vibe + 8);
      }
      this.awardPractice('creature_care', `compliment_${c.type}`, 14);
      this.audio.ding();
      this.addPopup(c.x, c.y - 42, '+1 Juicy Gossip', '#2ec4b6');
    } else if (action === 'boop') {
      c.say = def.lines[Math.floor(Math.random() * def.lines.length)];
      c.sayTimer = 2.1;
      const dx = c.x - this.state.player.x;
      const dy = c.y - this.state.player.y;
      const len = Math.hypot(dx, dy) || 1;
      c.vx = (dx / len) * 210;
      c.vy = (dy / len) * 210;
      this.giveItem(def.drop, 1);
      this.audio.honk();
      this.addPopup(c.x, c.y - 42, `+1 ${ITEMS[def.drop]?.name || def.drop}`, '#fffdf7');
    } else if (action === 'feed' && def.fav && this.takeItem(def.fav, 1)) {
      this.awardPractice('creature_care', `feed_${c.type}`, 24);
      this.addTameHearts(c, 1);
    }
    this.setActiveModal(null);
  }

  private addTameHearts(c: Creature, amount: number): void {
    const def = CREATURE_DEFS[c.type];
    const gentleDiscount = hasPerk(this.getDisciplines(), 'gentle_hand') ? 1 : 0;
    const req = Math.max(1, (def.hearts || 3) - (this.hasSkill('party_animal') ? 1 : 0) - gentleDiscount);
    c.hearts = Math.min(req, c.hearts + amount);
    this.burst(c.x, c.y - 16, '#ff5d8f', 16, 145);
    if (!c.tamed && c.hearts >= req) {
      const maxB = this.hasSkill('party_animal') ? 2 : 1;
      if (this.state.creatures.filter((x) => x.tamed).length >= maxB) {
        this.callbacks.onToast(`Buddy cap (${maxB}) reached! Learn Rhythm Legend for 2 companions.`);
      } else {
        c.tamed = true;
        c.say = 'BESTIES FOREVER!';
        c.sayTimer = 3.0;
        this.state.stats.buddiesTamed += 1;
        this.awardPractice('creature_care', `tame_${c.type}`, 45);
        this.audio.questFanfare();
        this.gainXP(32);
        this.callbacks.onToast(`Tamed ${def.name}! ${def.perk}`);
      }
    } else {
      c.say = 'DELICIOUS!';
      c.sayTimer = 2.0;
      this.audio.ding();
    }
  }

  public startDanceOff(creatureId: string): void {
    const startHits = this.state.player.charId === 'djmoss' ? 1 : 0;
    this.danceState = { creatureId, radius: 146, hits: startHits, needed: 3 };
    this.setActiveModal('dance', { creatureId });
  }

  public hitDanceBeat(): { hit: boolean; complete: boolean; hits: number } {
    if (!this.danceState) return { hit: false, complete: false, hits: 0 };
    if (Math.abs(this.danceState.radius - 70) < 30) {
      this.danceState.hits += 1;
      this.danceState.radius = 148;
      this.audio.ding();
      if (this.danceState.hits >= this.danceState.needed) {
        const isRadio = this.danceState.radioMode;
        const hits = this.danceState.hits;
        if (isRadio) {
          this.state.worldFlags.radioCustomBeat = (this.state.worldFlags.radioCustomBeat % 3) + 1;
          this.completeRadioRepair('djmoss');
          return { hit: true, complete: true, hits };
        }
        const c = this.state.creatures.find((x) => x.id === this.danceState?.creatureId);
        if (c) {
          c.danceTimer = 4.2;
          this.addTameHearts(c, 2);
          this.giveItem('bottlecap', 6);
          this.gainXP(22);
        }
        this.setActiveModal(null);
        return { hit: true, complete: true, hits };
      }
      return { hit: true, complete: false, hits: this.danceState.hits };
    }
    this.audio.hurt();
    this.danceState.radius = 148;
    return { hit: false, complete: false, hits: this.danceState.hits };
  }

  public doResidentTrade(residentId: string, tradeIdx: number): void {
    const res = RESIDENTS.find((r) => r.id === residentId);
    const trade = res?.trades?.[tradeIdx];
    if (!res || !trade) return;
    const baseCost = getDiscountedCost(trade.give, this.state.player.charId, this.state.skills);
    const cost = getEffectiveBarterCost(baseCost, this.getDisciplines());
    if (!hasIngredients(this.state.inv, cost)) return;
    if (trade.style && this.state.unlockedStyles.includes(trade.style)) return;

    Object.entries(cost).forEach(([k, v]) => this.takeItem(k, v));
    if (trade.get) {
      Object.entries(trade.get).forEach(([k, v]) => this.giveItem(k, v));
    }
    if (trade.style) {
      this.state.unlockedStyles.push(trade.style);
      this.state.player.moveStyle = trade.style;
    }
    this.audio.ding();
    this.awardPractice('hospitality', `barter_${residentId}`, 18);
    this.gainXP(14);
    this.callbacks.onToast(`Bartered for ${trade.label}!`);
    this.emitHud();
  }

  public getResident(residentId: string): ResidentDef | undefined {
    return RESIDENTS.find((r) => r.id === residentId);
  }

  public getCreature(creatureId: string): Creature | undefined {
    return this.state.creatures.find((c) => c.id === creatureId);
  }

  private isNearBlender(): boolean {
    const p = this.state.player;
    return (
      p.charId === 'barnaby' ||
      this.state.buildings.some((b) => b.type === 'funk_blender' && Math.hypot(b.x - p.x, b.y - p.y) < 175)
    );
  }

  private getMoveVector(): { mx: number; my: number } {
    let mx = this.joy.dx;
    let my = this.joy.dy;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) my -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) my += 1;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) mx -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    return { mx, my };
  }

  private hurtPlayer(amount: number, knockX: number, knockY: number, reason: string): void {
    const p = this.state.player;
    if (p.invulnTimer > 0 || this.state.ghostTimer > 0 || this.state.dead) return;
    const diffMult = this.state.difficultyMode === 'relaxed' ? 0.65 : this.state.difficultyMode === 'harsh' ? 1.35 : 1;
    const scaled = amount * diffMult;
    p.vibe = Math.max(0, p.vibe - scaled);
    p.hitFlash = 0.12;
    p.invulnTimer = 0.45;
    p.squashX = 1.28;
    p.squashY = 0.74;
    p.vx += knockX;
    p.vy += knockY;
    this.hitstop = 0.045;
    if (!this.state.reducedMotion) this.trauma = Math.min(1, this.trauma + 0.4);
    this.audio.hurt();
    this.burst(p.x, p.y - 20, '#ff4d6d', 14, 165);
    this.addPopup(p.x, p.y - 46, `-${Math.round(scaled)} Vibe`, '#ff4d6d');

    if (p.vibe <= 0) {
      this.triggerMeltCheck(reason);
    }
  }

  private triggerMeltCheck(reason: string): void {
    const p = this.state.player;
    const refuge = findNearestWarmRefuge(p.x, p.y, this.state.buildings);
    const dur = getGhostTimerDuration(this.state.techniques, this.getDisciplines());
    if (refuge.dist < 5200) {
      this.state.ghostTimer = dur;
      p.vibe = 1;
      this.audio.hurt();
      this.callbacks.onToast(`GHOST MODE! Follow the gold arrow to ${refuge.name} within ${dur}s to un-melt!`);
    } else {
      this.state.dead = true;
      this.state.deathReason = reason;
      this.defeatDelay = 0.5;
      this.audio.defeat();
      if (!this.state.reducedMotion) this.trauma = 0.7;
      this.burst(p.x, p.y - 16, '#ff5d8f', 28, 210);
    }
    this.emitHud();
  }

  private update(dt: number): void {
    if (this.mode === 'title') return;
    this.trauma = Math.max(0, this.trauma - dt * 1.9);

    for (const m of this.ambientMotes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < -520) m.y = 520;
      if (m.x < -760) m.x = 760;
      if (m.x > 760) m.x = -760;
    }

    for (let i = 0; i < POOL_SIZE; i++) {
      const pt = this.particles[i];
      if (!pt.active) continue;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
      pt.life -= dt;
      if (pt.life <= 0) pt.active = false;
    }

    if (this.danceState) {
      this.danceState.radius -= dt * 92;
      if (this.danceState.radius < 24) this.danceState.radius = 148;
      return;
    }

    if (this.mode !== 'playing' || this.activeModal) return;

    if (this.state.dead) {
      if (this.defeatDelay > 0) {
        this.defeatDelay -= dt;
        if (this.defeatDelay <= 0) this.setMode('gameover');
      }
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return;
    }

    if (this.boopBuffer > 0) {
      this.boopBuffer = 0;
      this.triggerBoop();
      if (this.activeModal) return;
    }
    if (this.rollBuffer > 0) {
      this.rollBuffer -= dt;
      if (this.state.player.rollCd <= 0) {
        this.rollBuffer = 0;
        this.triggerRoll();
      }
    }
    if (this.abBuffer > 0) {
      this.abBuffer -= dt;
      if (this.state.player.abCd <= 0) {
        this.abBuffer = 0;
        this.triggerAbility();
      }
    }

    const trips = this.activeTripsSet();
    const isChrono = trips.has('chrono');
    const isHyper = trips.has('synesthesia') || trips.has('disco');
    const p = this.state.player;
    const nearTotem = this.isNearCalmingTotem();
    const nearBeacon = this.state.buildings.some((b) => b.type === 'vibe_beacon' && Math.hypot(b.x - p.x, b.y - p.y) < 340);
    const tripProfile = computeTripProfile(p.vibe, p.maxVibe, p.wobble, this.state.trips, this.state.tripMaxDur, nearTotem);
    const wdt = dt * tripProfile.enemyTimeScale;

    this.state.time += dt;
    this.state.dayTime += wdt;
    if (this.state.dayTime >= DAY_LENGTH) {
      this.state.dayTime = 0;
      this.state.day += 1;
      this.state.stats.daysSurvived = this.state.day;
      this.gainXP(25);
      const nextEv = evaluateRegionalEventTrigger(
        this.state.day,
        this.state.worldFlags,
        this.state.discoveries,
        this.state.regionalEvent ?? null,
        this.state.regionalEventCooldownDay ?? 2,
      );
      if (nextEv) {
        this.state.regionalEvent = nextEv;
        this.addJournalNote(`County Bulletin (Day ${this.state.day}): ${nextEv.title} — reported by ${nextEv.eyewitnessName}.`);
        this.callbacks.onToast(
          `Dawn of Day ${this.state.day}! Eyewitness ${nextEv.eyewitnessName} reports: ${nextEv.title} (open Bulletin / Q)!`,
        );
      } else {
        this.callbacks.onToast(`Dawn of Day ${this.state.day}! Auto-saving satchel & county atlas...`);
      }
      this.saveGame(true);
    }

    const ch = CHARACTERS[p.charId];
    const phase = getPhaseFromDayTime(this.state.dayTime);
    const biome = getBiomeAt(p.x, p.y);
    if (phase.id !== 'day') this.runCampShift();
    const effectiveStyle = trips.has('floaty') ? 'astral_glide' : p.moveStyle;
    const st = STYLES[effectiveStyle];
    const physics = getRegionPhysics(
      p.x,
      p.y,
      this.state.time,
      biome.id,
      this.state.techniques,
      p.elevation,
      p.wobble,
      st.ignoreMud,
      hasPerk(this.getDisciplines(), 'echo_listener'),
    );

    // Regional musical & ambient engine + Bad Trip heartbeat & substance timbres
    this.audio.tickRegionalAudio(dt, biome.id, p.wobble, isChrono, isHyper, phase.id === 'night', {
      radioRepaired: this.state.worldFlags.radioRepaired,
      compressorSilent: physics.compressorSilent,
      dryerKnockWarning: physics.dryerKnockWarning,
      barnabyLowVibe: p.charId === 'barnaby' && p.vibe < p.maxVibe * 0.3,
      badTripIntensity: tripProfile.badTripIntensity,
      dominantTrip: tripProfile.dominantTrip,
    });

    if (tripProfile.mood === 'bad_trip' && !this.lastBadTripNotice) {
      this.lastBadTripNotice = true;
      this.callbacks.onToast('BAD TRIP SPIRAL! Low Vibe + high Wobble—sip Boring Decaf, eat, or step near a Lava Lamp!');
    } else if (tripProfile.mood !== 'bad_trip' && tripProfile.mood !== 'uneasy') {
      this.lastBadTripNotice = false;
    }

    // Ripe Lens-Pear audible chime in Prism Orchard
    if (this.pearChimeCd > 0) this.pearChimeCd -= dt;
    if (biome.id === 'prism_orchard' && this.pearChimeCd <= 0) {
      const ripeNear = this.state.objects.some(
        (o) => o.type === 'pear_tree' && o.ripeChime && o.respawn <= 0 && Math.hypot(o.x - p.x, o.y - p.y) < 260,
      );
      if (ripeNear) {
        this.pearChimeCd = 3.2;
        this.audio.glassChime();
      }
    }

    for (const k of Object.keys(this.state.trips) as TripId[]) {
      const rem = (this.state.trips[k] || 0) - dt;
      if (rem <= 0) {
        delete this.state.trips[k];
        if (this.state.tripMaxDur) delete this.state.tripMaxDur[k];
      } else {
        this.state.trips[k] = rem;
      }
    }

    // World Events
    if (this.state.exp) {
      this.state.exp.rem -= dt;
      if (this.state.exp.id === 'duck_rain' && Math.random() < dt * 1.3) {
        this.state.ducks.push({
          x: p.x + rand(-270, 270),
          y: p.y + rand(-190, 190),
          z: 230,
          seed: Math.random() * 20,
        });
      }
      if (this.state.exp.rem <= 0) {
        this.state.exp = null;
        this.state.expCooldown = rand(52, 78);
      }
    } else {
      this.state.expCooldown -= dt;
      if (this.state.expCooldown <= 0) {
        const pick = EXPERIENCES[Math.floor(Math.random() * EXPERIENCES.length)];
        this.state.exp = { ...pick, rem: pick.dur };
        this.audio.trip();
        this.callbacks.onToast(`World Event: ${pick.name} — ${pick.desc}`);
      }
    }

    for (let i = this.state.ducks.length - 1; i >= 0; i--) {
      const d = this.state.ducks[i];
      if (d.z > 0) d.z = Math.max(0, d.z - dt * 175);
      if (d.z <= 0 && Math.hypot(d.x - p.x, d.y - p.y) < 44) {
        this.giveItem('bottlecap', 3);
        this.giveItem('feather', 1);
        this.audio.honk();
        this.burst(d.x, d.y - 10, '#ffd166', 10, 110);
        this.addPopup(d.x, d.y - 24, '+3 Bottlecaps +1 Feather', '#ffd166');
        this.state.ducks.splice(i, 1);
      }
    }

    // Player movement with regional impossible physics & substance perks!
    p.squashX += (1 - p.squashX) * Math.min(1, dt * 12);
    p.squashY += (1 - p.squashY) * Math.min(1, dt * 12);
    if (p.abCd > 0) p.abCd = Math.max(0, p.abCd - dt);
    if (p.rollCd > 0) p.rollCd = Math.max(0, p.rollCd - dt);
    if (p.actionAnim > 0) p.actionAnim = Math.max(0, p.actionAnim - dt);
    if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);
    if (this.foldSpanTimer > 0) this.foldSpanTimer = Math.max(0, this.foldSpanTimer - dt);
    if (this.guideLineTimer > 0) this.guideLineTimer = Math.max(0, this.guideLineTimer - dt);

    // Step active fishing FSM
    if (this.fishing.active) {
      if (!this.isNearDock()) {
        this.cancelFishing();
      } else {
        const refl = computeDockReflectionState(this.state.time, this.state.worldFlags.dockLampSlot, this.state.worldFlags.ferryRestored);
        const res = stepFishingSession(this.fishing, dt, {
          reflectionIntegrity: refl.reflectionIntegrity,
          currentReaderPerk: hasPerk(this.getDisciplines(), 'current_reader'),
          hasBellLure: (this.state.inv.bell_lure || 0) > 0,
        });
        this.fishing = res.next;
        if (res.events.nibbleTwitch) {
          this.spawnWaterRipple(this.fishing.bobberX, this.fishing.bobberY, '#c8f4ff', 36);
        }
        if (res.events.biteDive) {
          this.audio.corkSqueak();
          this.spawnWaterRipple(this.fishing.bobberX, this.fishing.bobberY, '#ffd166', 54);
        }
        if (res.events.landedFish) {
          const fishId = res.events.landedFish;
          const fishDef = FISH_DEFS[fishId];
          this.giveItem(fishId, 1);
          this.state.stats.fishCaught = (this.state.stats.fishCaught || 0) + 1;
          if (this.state.worldFlags.ferrySupperStage === 'unstarted' || this.state.worldFlags.ferrySupperStage === 'accepted') {
            this.state.worldFlags.ferrySupperStage = 'caught';
          }
          this.awardPractice('angling', `catch_${fishId}`, fishId === 'mirror_minnow' ? 45 : 30);
          this.gainXP(fishId === 'mirror_minnow' ? 32 : 18);
          this.audio.questFanfare();
          this.burst(this.fishing.bobberX, this.fishing.bobberY, fishDef.accent, 22, 160);
          this.addPopup(p.x, p.y - 46, `Landed ${fishDef.name}!`, fishDef.accent);
          if (fishId === 'mirror_minnow' && !this.state.worldFlags.mirrorMinnowCaught) {
            this.state.worldFlags.mirrorMinnowCaught = true;
            this.state.worldFlags.mirrorMinnowObserved = true;
            this.state.worldFlags.prismReelLeadUnlocked = true;
            if (!this.state.journalSketches) this.state.journalSketches = [];
            if (!this.state.journalSketches.some((s) => s.id === 'sketch_mirror_minnow')) {
              this.state.journalSketches.push({
                id: 'sketch_mirror_minnow',
                title: 'Mirror Minnow (Caught!)',
                category: 'fish',
                note: 'Swims inside intact dock lamp reflections. Its silver sheen inspired the Prism Reel blueprint (Angling 3 + Fabrication 3 + Workbench).',
              });
            }
            this.addJournalNote('Caught a Mirror Minnow at Delta Public Bank! Unlocked the Prism Reel craft lead.');
            this.callbacks.onToast('Landed rare Mirror Minnow! Prism Reel crafting lead added to your Field Journal!');
          } else {
            this.callbacks.onToast(
              `Landed ${fishDef.name}! Return to your Giggle-Grove Camp Table to cook Ferryman’s Perch Chowder.`,
            );
          }
          this.emitHud();
        } else if (res.events.escaped) {
          this.audio.waterPlop();
          this.addPopup(this.fishing.bobberX, this.fishing.bobberY - 20, 'Slipped off!', '#ff85b3');
          this.emitHud();
        }
      }
    }

    // Update localized water ripples & Delta dock wake ripples
    for (let i = this.waterRipples.length - 1; i >= 0; i--) {
      const r = this.waterRipples[i];
      r.age += dt;
      r.radius = r.maxRadius * Math.min(1, r.age / r.maxAge);
      if (r.age >= r.maxAge) this.waterRipples.splice(i, 1);
    }
    if (this.isNearDock()) {
      const refl = computeDockReflectionState(this.state.time, this.state.worldFlags.dockLampSlot, this.state.worldFlags.ferryRestored);
      if (refl.disturbanceActive && !this.lastDockDisturbed) {
        this.spawnWaterRipple(DELTA_BANK_X, DELTA_BANK_Y - 82, '#90e0ef', 64);
      }
      this.lastDockDisturbed = refl.disturbanceActive;
    }

    // Evening Capt. Nix Camp Table visit: warm two-note departure call across the river!
    if (
      this.state.worldFlags.ferrySupperServedDay > 0 &&
      (this.state.day > this.state.worldFlags.ferrySupperServedDay || phase.id !== 'day') &&
      (phase.id === 'dusk' || phase.id === 'night')
    ) {
      const table = this.getFerrySupperTable();
      if (table) {
        table.hasSecondSetting = true;
        if (Math.hypot(table.x - p.x, table.y - p.y) < 520) {
          this.ferryCallTimer -= dt;
          if (this.ferryCallTimer <= 0) {
            this.ferryCallTimer = 14;
            this.audio.ferryTwoNoteCall();
            this.soundRipples.push({
              x: table.x + 48,
              y: table.y - 12,
              radius: 12,
              maxRadius: 125,
              color: '#72efdd',
              glyph: '♫',
              life: 1.5,
              maxLife: 1.5,
            });
          }
        }
      }
    }

    // Step off rooftop automatically if player walks outside Giggle-Grove boardwalk bounds
    if (p.elevation === 1 && (p.x < -760 || p.x > 290 || p.y < -600 || p.y > -455)) {
      p.elevation = 0;
    }

    const { mx, my } = this.fishing.active && this.fishing.phase !== 'landed' && this.fishing.phase !== 'escaped'
      ? { mx: 0, my: 0 }
      : this.getMoveVector();
    const speed =
      ch.speed *
      st.spd *
      (this.hasSkill('rubber_knees') ? 1.15 : 1) *
      (hasPerk(this.getDisciplines(), 'shortcut_surveyor') ? 1.1 : 1) *
      (nearBeacon ? 1.22 : 1) *
      (this.foldSpanTimer > 0 ? 1.32 : 1) *
      tripProfile.playerSpeedMult *
      (this.foldSpanTimer > 0 ? Math.max(1, physics.speedMult) : physics.speedMult);

    // Gentle dizzy sway during intense Bad Trip (disabled in Reduced Motion)
    const dizzyX =
      !this.state.reducedMotion && tripProfile.badTripIntensity > 0.5
        ? Math.sin(this.state.time * 2.3) * 28 * tripProfile.badTripIntensity
        : 0;
    const dizzyY =
      !this.state.reducedMotion && tripProfile.badTripIntensity > 0.5
        ? Math.cos(this.state.time * 1.9) * 22 * tripProfile.badTripIntensity
        : 0;

    const rolling = p.rollTimer > 0;
    if (rolling) {
      p.rollTimer -= dt;
    } else {
      const drag = effectiveStyle === 'toast_skates' ? 0.9 : 0.72;
      p.vx = p.vx * drag + (mx * speed + physics.pushX + dizzyX) * (1 - drag);
      p.vy = p.vy * drag + (my * speed + physics.pushY + dizzyY) * (1 - drag);
    }

    const prevX = p.x;
    const prevY = p.y;
    const clamped = clampToWorld(p.x + p.vx * dt, p.y + p.vy * dt);
    p.x = clamped.x;
    p.y = clamped.y;
    this.tickTrail(dt, rolling);

    if (Math.abs(mx) > 0.1) p.facing = mx > 0 ? 1 : -1;

    const distMoved = Math.hypot(p.x - prevX, p.y - prevY);
    if (distMoved > 0.1) {
      p.bob += distMoved * (effectiveStyle === 'jelly_hop' ? 0.065 : 0.085);
      this.stepSoundAccum += distMoved;
      if (this.stepSoundAccum > 88) {
        this.stepSoundAccum = 0;
        this.audio.leadStep(p.charId, p.vibe < p.maxVibe * 0.3);
        if (trips.has('synesthesia')) {
          const glyphs = ['♪', '♫', '◈', '✦'];
          const cols = ['#ffd166', '#2ec4b6', '#ff5d8f', '#8be9fd'];
          const idx = Math.floor(Math.random() * glyphs.length);
          this.soundRipples.push({
            x: p.x,
            y: p.y + 4,
            radius: 10,
            maxRadius: 96,
            color: cols[idx],
            glyph: glyphs[idx],
            life: 0.95,
            maxLife: 0.95,
          });
        }
      }
      if (isHyper && Math.random() < dt * 7) {
        this.spawnParticle(p.x, p.y - 6, rand(-25, 25), rand(-55, -20), '#ffd166', 5, 0.55, 'note');
      }
      if (trips.has('kaleido') && Math.random() < dt * 8) {
        const col = Math.random() < 0.5 ? '#ff5d8f' : '#72efdd';
        this.spawnParticle(p.x, p.y - 10, rand(-28, 28), rand(-35, 10), col, 4.5, 0.6, 'dot');
      }
    }

    // Update Perceptual Tracer Afterimages (Chrono, Floaty, Prism, Velvet, Disco, or Bad Trip)
    const shouldLeaveTracers =
      tripProfile.badTripIntensity > 0.45 ||
      Array.from(trips).some((tid) => TRIP_VISUAL_META[tid].hasTracers);
    this.tracerTimer -= dt;
    if (shouldLeaveTracers && distMoved > 1.2 && this.tracerTimer <= 0) {
      this.tracerTimer = 0.065;
      this.playerTracers.push({
        x: p.x,
        y: p.y,
        facing: p.facing,
        bob: Math.abs(Math.sin(p.bob)) * st.bounce,
        elevation: p.elevation,
        color:
          tripProfile.badTripIntensity > 0.45
            ? '#9ef01a'
            : getTripDominantColor(tripProfile.dominantTrip),
        alpha: 0.92,
        charId: p.charId,
      });
      if (this.playerTracers.length > 9) this.playerTracers.shift();
    }
    for (let i = this.playerTracers.length - 1; i >= 0; i--) {
      this.playerTracers[i].alpha -= dt * 1.65;
      if (this.playerTracers[i].alpha <= 0) this.playerTracers.splice(i, 1);
    }

    // Update Synesthesia Sound-Wave Ripples
    for (let i = this.soundRipples.length - 1; i >= 0; i--) {
      const r = this.soundRipples[i];
      r.life -= dt;
      r.radius = r.maxRadius * (1 - Math.max(0, r.life / r.maxLife));
      if (r.life <= 0) this.soundRipples.splice(i, 1);
    }

    // Update Bad Trip Peripheral Shadow Phantoms (vanish gently if approached or grounded)
    if (tripProfile.badTripIntensity > 0.35) {
      this.phantomSpawnTimer -= dt;
      if (this.phantomSpawnTimer <= 0 && this.badTripPhantoms.length < 3) {
        this.phantomSpawnTimer = rand(2.2, 4.2);
        const ang = Math.random() * Math.PI * 2;
        const dist = rand(210, 320);
        this.badTripPhantoms.push({
          x: p.x + Math.cos(ang) * dist,
          y: p.y + Math.sin(ang) * dist * 0.72,
          life: rand(3.5, 5.5),
          maxLife: 5.5,
          whisper: BAD_TRIP_WHISPERS[Math.floor(Math.random() * BAD_TRIP_WHISPERS.length)],
          seed: Math.random() * 50,
        });
      }
      for (let i = this.badTripPhantoms.length - 1; i >= 0; i--) {
        const ph = this.badTripPhantoms[i];
        ph.life -= dt;
        if (Math.hypot(ph.x - p.x, ph.y - p.y) < 125 || ph.life <= 0) {
          if (Math.hypot(ph.x - p.x, ph.y - p.y) < 125) {
            this.burst(ph.x, ph.y - 36, '#9ef01a', 8, 95);
          }
          this.badTripPhantoms.splice(i, 1);
        }
      }
    } else if (this.badTripPhantoms.length > 0) {
      this.badTripPhantoms = [];
    }

    this.camX += (p.x - this.camX) * Math.min(1, dt * 8.5);
    this.camY += (p.y - this.camY) * Math.min(1, dt * 8.5);

    // Discovery & Mailbox Auto-Discovery
    this.discoveryTimer += dt;
    if (this.discoveryTimer >= 0.35) {
      this.discoveryTimer = 0;
      const newPlaces = updateDiscoveryAtPosition(this.state.discoveries, p.x, p.y);
      if (newPlaces.length > 0) {
        this.audio.ding();
        this.awardPractice('wayfinding', `discover_${newPlaces[0]}`, 24);
        this.callbacks.onToast(`Discovered: ${newPlaces[0]}! Added to County Atlas (G).`);
        this.gainXP(18);
      }
      for (const m of this.state.mailboxes) {
        if (!m.discovered && Math.hypot(m.x - p.x, m.y - p.y) < 340) {
          m.discovered = true;
          this.awardPractice('wayfinding', `mailbox_${m.biomeId}`, 20);
          this.callbacks.onToast(`Unlocked Wormhole Mailbox: ${m.biomeName}!`);
        }
      }
      if (this.state.waypoint && Math.hypot(this.state.waypoint.x - p.x, this.state.waypoint.y - p.y) < 90) {
        this.callbacks.onToast(`Arrived at ${this.state.waypoint.label}!`);
        this.state.waypoint = null;
      }
    }

    const diffDrain = this.state.difficultyMode === 'relaxed' ? 0.65 : this.state.difficultyMode === 'harsh' ? 1.35 : 1;
    // Survival meters
    p.munch = Math.max(0, p.munch - dt * diffDrain * (p.charId === 'djmoss' && p.wobble > 40 ? 1.15 : 0.82));
    if (p.munch <= 0 && this.state.ghostTimer <= 0) {
      p.vibe -= dt * 3.4 * diffDrain;
    }
    if (p.wobble > 10) p.wobble = Math.max(10, p.wobble - dt * 0.7);

    // Warm refuge check (placed Lava Lamps, Dock Lamps, settlement warm refuges, Appliance Bulbs, Lantern Moth)
    const lampR = this.hasSkill('mega_lamp') ? 245 : 175;
    let nearWarmth =
      LANDMARKS.some((lm) => lm.isWarmRefuge && Math.hypot(lm.x - p.x, lm.y - p.y) < 230) ||
      WORLD_FEATURES.some((f) => f.kind === 'appliance_bulb' && Math.hypot(f.x - p.x, f.y - p.y) < f.radius) ||
      this.state.creatures.some((c) => c.tamed && c.type === 'lantern_moth' && Math.hypot(c.x - p.x, c.y - p.y) < 150);

    for (const b of this.state.buildings) {
      b.phase += dt * 2.5;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (
        ((b.type === 'lava_lamp' || b.type === 'dock_lamp') && d < lampR) ||
        (b.type === 'vibe_beacon' && d < 320)
      ) {
        nearWarmth = true;
      }
      if (b.type === 'camp_table' && d < 170) {
        const cozyRate = this.state.worldFlags.ferrySupperFollowUp === 'comfort_stop' ? 2.4 : 1.1;
        p.vibe = Math.min(p.maxVibe, p.vibe + dt * cozyRate);
      }
      if (b.type === 'rain_trough' && d < 240 && Math.random() < dt * 0.55) {
        this.spawnWaterRipple(b.x, b.y - 8, '#90e0ef', 28);
      }
      if (b.type === 'dream_totem' && d < 240) {
        p.vibe = Math.min(p.maxVibe, p.vibe + dt * 2.4);
        if (tripProfile.badTripIntensity > 0.1) p.wobble = Math.max(12, p.wobble - dt * 4.5);
      }
      if (b.type === 'vibe_beacon' && d < 320) {
        p.vibe = Math.min(p.maxVibe, p.vibe + dt * 1.6);
      }
      if (b.type === 'boop_turret' && b.phase >= 4.2) {
        const target = this.state.creatures.find(
          (c) => CREATURE_DEFS[c.type].hostile && c.aiState !== 'ko' && Math.hypot(c.x - b.x, c.y - b.y) < 280,
        );
        if (target) {
          b.phase = 0;
          const dx = target.x - b.x;
          const dy = target.y - b.y;
          const len = Math.hypot(dx, dy) || 1;
          this.state.projectiles.push({
            id: `tur_${Math.random().toString(36).slice(2, 7)}`,
            fromPlayer: true,
            kind: 'parcel',
            x: b.x,
            y: b.y - 22,
            vx: (dx / len) * 390,
            vy: (dy / len) * 390,
            life: 0.9,
            damage: 22,
            color: '#ffd166',
          });
          this.audio.boop();
          this.burst(b.x, b.y - 22, '#ff5d8f', 6, 95);
        }
      }
      if (b.type === 'mood_plot' && b.crop) {
        const nearBoombox = this.state.buildings.some(
          (x) => (x.type === 'boombox' || x.type === 'choir_irrigator') && Math.hypot(x.x - b.x, x.y - b.y) < 245,
        );
        const growthDelta = computeCropGrowthDelta(
          dt,
          nearBoombox,
          p.charId === 'djmoss' && d < 210,
          this.state.exp?.id === 'rave_cloud',
          isHyper && d < 170,
        );
        const baitGardenMult = this.state.worldFlags.ferrySupperFollowUp === 'bait_garden' && b.crop === 'bell_reed_crop' ? 1.45 : 1;
        const shelterMult = evaluateCampShelter(b.x, b.y, this.state.buildings).sheltered ? 1.1 : 1;
        b.growth = Math.min(CROPS[b.crop].time, b.growth + growthDelta * baitGardenMult * shelterMult);
        if (phase.id === 'dusk' && Math.random() < dt * 0.08) this.tryHybridize(b);
      }
    }

    // Warm Lava Lamp / Refuge / Dreamcatcher actively grounds a Bad Trip!
    if ((nearWarmth || nearTotem) && tripProfile.badTripIntensity > 0.15) {
      p.wobble = Math.max(10, p.wobble - dt * 3.8);
      p.vibe = Math.min(p.maxVibe, p.vibe + dt * 3.2);
    }

    if (biome.cold > 0 && !p.gear.sweater && !nearWarmth && this.state.ghostTimer <= 0) {
      p.vibe -= dt * biome.cold * physics.coldMult * diffDrain;
    }

    if (this.state.ghostTimer > 0) {
      if (nearWarmth) {
        this.state.ghostTimer = 0;
        p.vibe = p.maxVibe * 0.62;
        p.munch = Math.max(35, p.munch);
        this.audio.trip();
        this.burst(p.x, p.y - 16, '#2ec4b6', 24, 180);
        this.callbacks.onToast('BOUNCED BACK via warm refuge light!');
      } else {
        this.state.ghostTimer -= dt;
        if (this.state.ghostTimer <= 0) {
          this.state.dead = true;
          this.state.deathReason = `Melted on Day ${this.state.day} before reaching a warm refuge or Lava Lamp.`;
          this.defeatDelay = 0.45;
          this.audio.defeat();
        }
      }
    } else {
      const shelterNow = evaluateCampShelter(p.x, p.y, this.state.buildings);
      const camp = this.state.camp.wardDay === this.state.day ? this.getCampAnchor() : undefined;
      const watched = Boolean(camp && Math.hypot(camp.x - p.x, camp.y - p.y) <= 480);
      const weather = getWeatherPressure(getCountyWeather(this.state.worldSeed, this.state.day), phase.id, nearWarmth || shelterNow.sheltered || watched);
      p.munch = Math.max(0, p.munch + weather.munch * diffDrain * dt);
      p.wobble = Math.max(0, p.wobble + weather.wobble * dt);
      const nightDelta = computeNightVibeDelta(dt, phase.id, nearWarmth, p.charId, {
        sheltered: shelterNow.sheltered,
        lanternStrider: hasPerk(this.getDisciplines(), 'lantern_strider'),
      });
      p.vibe = Math.min(p.maxVibe, p.vibe + nightDelta + weather.vibe * diffDrain * dt);
      if (p.vibe <= 0) {
        const reason =
          phase.id === 'night' && !nearWarmth
            ? `Melted in The Big Snooze on Day ${this.state.day}. Stay near a settlement refuge or Lava Lamp!`
            : p.munch <= 0
              ? `Melted from empty Munch on Day ${this.state.day}. Forage or farm snacks!`
              : `Your Vibe melted on Day ${this.state.day}.`;
        this.triggerMeltCheck(reason);
      }
    }

    // High-Wobble Reality Inspector spawn
    if (this.state.inspectorCd > 0) this.state.inspectorCd -= dt;
    if (
      p.wobble >= 88 &&
      this.state.inspectorCd <= 0 &&
      !this.state.creatures.some((c) => c.type === 'reality_inspector' && c.aiState !== 'ko' && Math.hypot(c.x - p.x, c.y - p.y) < 900)
    ) {
      const a = Math.random() * Math.PI * 2;
      const sp = clampToWorld(p.x + Math.cos(a) * 340, p.y + Math.sin(a) * 340);
      const def = CREATURE_DEFS.reality_inspector;
      this.state.creatures.push({
        id: `insp_${Math.random().toString(36).slice(2, 8)}`,
        type: 'reality_inspector',
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        facing: 1,
        hp: def.maxHp,
        maxHp: def.maxHp,
        tamed: false,
        hearts: 0,
        buddyTimer: 0,
        timer: 1,
        seed: Math.random() * 40,
        say: p.charId === 'gerald' ? 'CARRY ON, SIR!' : 'LICENSE PLEASE!',
        sayTimer: 2.2,
        hitAnim: 0,
        hitFlash: 0,
        danceTimer: 0,
        frozenTimer: 0,
        footLift: 0,
        aiState: 'idle',
        aiTimer: 0.7,
        telegraphX: p.x,
        telegraphY: p.y,
        telegraphRadius: 34,
        koTimer: 0,
        hasToken: false,
      });
      this.callbacks.onToast(
        p.charId === 'gerald'
          ? 'Reality Inspector saluted Gerald peacefully.'
          : 'Reality Inspector alert! Sip Boring Decaf or dodge its red stamp charge!',
      );
    }

    // Projectiles
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const pr = this.state.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.fromPlayer) {
        for (const c of this.state.creatures) {
          if (c.aiState !== 'ko' && Math.hypot(c.x - pr.x, c.y - pr.y) < 38) {
            c.frozenTimer = 1.6;
            this.damageCreature(c, pr.damage);
            pr.life = 0;
            break;
          }
        }
      } else {
        if (Math.hypot(p.x - pr.x, p.y - pr.y) < 26) {
          this.hurtPlayer(pr.damage, pr.vx * 0.4, pr.vy * 0.4, `Clipped by bureaucratic Red Tape on Day ${this.state.day}.`);
          pr.life = 0;
        }
      }
      if (pr.life <= 0) this.state.projectiles.splice(i, 1);
    }

    // World Objects timers (only decrement active cooldowns)
    for (const o of this.state.objects) {
      if (o.shake > 0) o.shake = Math.max(0, o.shake - dt);
      if (o.hitFlash > 0) o.hitFlash = Math.max(0, o.hitFlash - dt);
      if (o.respawn > 0) o.respawn = Math.max(0, o.respawn - wdt);
    }

    // Only nearby wildlife runs AI. Attack slots are shared across the county.
    let activeTokens = this.state.creatures.filter((c) => c.hasToken && c.aiState !== 'ko').length;
    const basinWarnGlobal = ((this.state.time % 7) + 7) % 7 >= 5.5;
    const waxWarnGlobal = ((this.state.time % 8) + 8) % 8 >= 4.3 && ((this.state.time % 8) + 8) % 8 < 5.8;

    for (let i = this.state.creatures.length - 1; i >= 0; i--) {
      const c = this.state.creatures[i];
      const def = CREATURE_DEFS[c.type];
      if (c.aiState === 'ko') {
        c.koTimer -= dt;
        if (c.koTimer <= 0) this.state.creatures.splice(i, 1);
        continue;
      }
      if (!c.tamed && Math.hypot(c.x - p.x, c.y - p.y) > 1550) {
        if (c.hasToken) {
          c.hasToken = false;
          c.aiState = 'idle';
          c.aiTimer = 0.7;
          activeTokens -= 1;
        }
        continue;
      }

      if (c.sayTimer > 0) c.sayTimer -= dt;
      if (c.hitAnim > 0) c.hitAnim -= dt;
      if (c.hitFlash > 0) c.hitFlash -= dt;
      if (c.danceTimer > 0) c.danceTimer -= dt;

      // Needle Wren wildlife rule cue: lifts one brass foot 1.5s before groove flips!
      if (c.type === 'needle_wren') {
        c.footLift = basinWarnGlobal ? 1 : 0;
      }

      if (c.frozenTimer > 0) {
        c.frozenTimer -= dt;
        if (c.hasToken) {
          c.hasToken = false;
          activeTokens = Math.max(0, activeTokens - 1);
        }
        continue;
      }

      if (c.tamed) {
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 82) {
          c.x += (dx / d) * 185 * dt;
          c.y += (dy / d) * 185 * dt;
          if (Math.abs(dx) > 4) c.facing = dx > 0 ? 1 : -1;
        }
        c.buddyTimer -= dt;
        if (c.buddyTimer <= 0) {
          c.buddyTimer = hasPerk(this.getDisciplines(), 'field_scout') ? 16.25 : 25;
          if (c.type === 'toast_crab') {
            this.giveItem('pop_toast', 1);
            this.addPopup(c.x, c.y - 36, '*DING!* +1 Toast', '#ffd166');
          } else if (c.type === 'sofa_sloth') {
            p.vibe = Math.min(p.maxVibe, p.vibe + 12);
            this.addPopup(c.x, c.y - 36, 'Cozy Aura +12 Vibe', '#ff85b3');
          } else if (c.type === 'existential_duck') {
            this.giveItem('gossip_slip', 1);
            this.addPopup(c.x, c.y - 36, '+1 Juicy Gossip', '#2ec4b6');
          } else if (c.type === 'needle_wren') {
            this.giveItem('bottlecap', 4);
            this.addPopup(c.x, c.y - 36, '*tink!* +4 Caps', '#ff70a6');
          } else if (c.type === 'lantern_moth') {
            p.vibe = Math.min(p.maxVibe, p.vibe + 10);
            this.addPopup(c.x, c.y - 36, 'Warm Glow +10 Vibe', '#ff9f1c');
          } else {
            this.giveItem('bottlecap', 3);
            this.addPopup(c.x, c.y - 36, 'HONK! +3 Caps', '#ffd166');
          }
        }
        continue;
      }

      if (def.hostile) {
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (Math.abs(dx) > 4) c.facing = dx > 0 ? 1 : -1;

        if (trips.has('disco') || (c.type === 'reality_inspector' && (p.charId === 'gerald' || p.wobble < 66))) {
          if (c.type === 'reality_inspector' && p.wobble < 66) {
            this.addPopup(c.x, c.y - 34, 'Carry on, citizen.', '#2ec4b6');
            this.state.creatures.splice(i, 1);
            this.state.inspectorCd = 10;
          }
          continue;
        }

        const aggroR = def.boss ? 460 : 340;
        const moveSpd = (c.type === 'reality_inspector' && p.gear.partyHat ? 82 : def.spd) * (1 + Math.min(0.3, (this.state.day - 1) * 0.06));

        if (c.aiState === 'idle') {
          c.aiTimer -= wdt;
          if (dist < aggroR) {
            if (def.policy === 'orbiter_ranged') {
              const tangentX = -dy / dist;
              const tangentY = dx / dist;
              const radial = dist > 210 ? 0.7 : dist < 145 ? -0.7 : 0;
              c.x += ((dx / dist) * radial + tangentX * 0.8) * moveSpd * wdt;
              c.y += ((dy / dist) * radial + tangentY * 0.8) * moveSpd * wdt;
            } else {
              c.x += (dx / dist) * moveSpd * wdt;
              c.y += (dy / dist) * moveSpd * wdt;
            }

            const attackRange =
              def.policy === 'orbiter_ranged' ? 280 : def.policy === 'charger' ? 200 : def.boss ? 215 : 125;
            if (dist < attackRange && c.aiTimer <= 0 && (c.hasToken || activeTokens < MAX_ATTACK_TOKENS)) {
              if (!c.hasToken) {
                c.hasToken = true;
                activeTokens += 1;
              }
              c.aiState = 'windup';
              c.aiTimer = def.policy === 'charger' ? 0.48 : def.policy === 'orbiter_ranged' ? 0.55 : 0.62;
              c.telegraphX = p.x;
              c.telegraphY = p.y;
              c.telegraphRadius = def.boss ? 98 : 74;
              c.say = def.lines[Math.floor(Math.random() * def.lines.length)];
              c.sayTimer = 1.2;
              this.audio.telegraph();
            }
          }
        } else if (c.aiState === 'windup') {
          c.aiTimer -= wdt;
          if (c.aiTimer <= 0) {
            c.aiState = 'attack';
            if (def.policy === 'charger') {
              const tdx = c.telegraphX - c.x;
              const tdy = c.telegraphY - c.y;
              const tl = Math.hypot(tdx, tdy) || 1;
              c.vx = (tdx / tl) * 430;
              c.vy = (tdy / tl) * 430;
              c.aiTimer = 0.28;
            } else if (def.policy === 'orbiter_ranged') {
              const tdx = c.telegraphX - c.x;
              const tdy = c.telegraphY - c.y;
              const tl = Math.hypot(tdx, tdy) || 1;
              this.state.projectiles.push({
                id: `rt_${Math.random().toString(36).slice(2, 7)}`,
                fromPlayer: false,
                kind: 'red_tape',
                x: c.x,
                y: c.y,
                vx: (tdx / tl) * 285,
                vy: (tdy / tl) * 285,
                life: 1.8,
                damage: 13,
                color: '#ff4d6d',
              });
              c.aiState = 'recover';
              c.aiTimer = 1.25;
            } else if (def.policy === 'hop_slammer') {
              c.x = c.telegraphX;
              c.y = c.telegraphY;
              this.burst(c.x, c.y, '#72efdd', 18, 175);
              if (Math.hypot(p.x - c.x, p.y - c.y) < c.telegraphRadius) {
                this.hurtPlayer(16, (p.x - c.x) * 3, (p.y - c.y) * 3, `Frost-slammed on Day ${this.state.day}.`);
              }
              c.aiState = 'recover';
              c.aiTimer = 1.1;
            } else if (def.policy === 'boss_octopus') {
              this.burst(c.telegraphX, c.telegraphY, '#ff006e', 24, 210);
              if (Math.hypot(p.x - c.telegraphX, p.y - c.telegraphY) < c.telegraphRadius) {
                this.hurtPlayer(20, (p.x - c.x) * 3.2, (p.y - c.y) * 3.2, `Audited by the Grand Tax Octopus on Day ${this.state.day}.`);
              }
              const orbCount = c.hp < c.maxHp * 0.55 ? 8 : 5;
              for (let k = 0; k < orbCount; k++) {
                const oa = (k / orbCount) * Math.PI * 2 + this.state.time;
                this.state.projectiles.push({
                  id: `orb_${k}_${Math.random().toString(36).slice(2, 6)}`,
                  fromPlayer: false,
                  kind: 'audit_orb',
                  x: c.x,
                  y: c.y,
                  vx: Math.cos(oa) * 215,
                  vy: Math.sin(oa) * 215,
                  life: 2.1,
                  damage: 14,
                  color: '#ff006e',
                });
              }
              c.aiState = 'recover';
              c.aiTimer = 1.35;
            }
          }
        } else if (c.aiState === 'attack') {
          c.x += c.vx * wdt;
          c.y += c.vy * wdt;
          c.aiTimer -= wdt;
          if (Math.hypot(p.x - c.x, p.y - c.y) < 34) {
            this.hurtPlayer(15, c.vx * 0.5, c.vy * 0.5, `Fined into oblivion by a Reality Inspector on Day ${this.state.day}.`);
            c.aiTimer = 0;
          }
          if (c.aiTimer <= 0) {
            c.vx = 0;
            c.vy = 0;
            c.aiState = 'recover';
            c.aiTimer = 1.15;
          }
        } else if (c.aiState === 'recover') {
          c.aiTimer -= wdt;
          if (c.hasToken) {
            c.hasToken = false;
            activeTokens = Math.max(0, activeTokens - 1);
          }
          if (c.aiTimer <= 0) {
            c.aiState = 'idle';
            c.aiTimer = rand(0.6, 1.2);
          }
        }
      } else {
        // Friendly wandering creature (Lantern Moths scatter before wicks dim!)
        c.timer -= wdt;
        if (c.type === 'lantern_moth' && waxWarnGlobal) {
          c.vx = Math.cos(c.seed + this.state.time * 4) * 125;
          c.vy = Math.sin(c.seed + this.state.time * 4) * 125;
        } else if (c.timer <= 0) {
          c.timer = rand(2.2, 5.2);
          c.vx = rand(-def.spd, def.spd);
          c.vy = rand(-def.spd, def.spd);
          if (Math.abs(c.vx) > 5) c.facing = c.vx > 0 ? 1 : -1;
        }
        c.x += c.vx * wdt;
        c.y += c.vy * wdt;
        c.vx *= 0.96;
        c.vy *= 0.96;
        const cl = clampToWorld(c.x, c.y, 120);
        c.x = cl.x;
        c.y = cl.y;
      }
    }

    for (let i = this.state.popups.length - 1; i >= 0; i--) {
      this.state.popups[i].y -= dt * 30;
      this.state.popups[i].life -= dt;
      if (this.state.popups[i].life <= 0) this.state.popups.splice(i, 1);
    }

    this.nearestPrompt = this.computeNearestPrompt();

    this.hudTimer += dt;
    if (this.hudTimer >= 0.1) {
      this.hudTimer = 0;
      this.emitHud();
    }
  }

  private computeNearestPrompt(): InteractPrompt | null {
    const p = this.state.player;
    const phase = getPhaseFromDayTime(this.state.dayTime);

    if (this.buildingMove) {
      return { x: p.x, y: p.y - 16, label: '[Space] Place · [R] Rotate · [Esc] Cancel', accent: '#ffd166' };
    }
    if (this.fishing.active) {
      return null;
    }

    for (const res of RESIDENTS) {
      const pos = this.getEffectiveResidentPos(res, phase.id, this.state.time);
      if (Math.hypot(pos.x - p.x, pos.y - p.y) < 92) {
        return { x: pos.x, y: pos.y - 36, label: `[Space] Talk · ${res.name}`, accent: res.accent };
      }
    }

    for (const f of WORLD_FEATURES) {
      if (f.kind === 'grooves_track' || f.kind === 'jam_canal' || f.kind === 'stamp_bridge' || f.kind === 'wash_line' || f.kind === 'appliance_bulb' || f.kind === 'candleboat') {
        continue;
      }
      if (f.kind === 'sock_half_a' && this.state.worldFlags.sockHalfAFound) continue;
      if (f.kind === 'sock_half_b' && this.state.worldFlags.sockHalfBFound) continue;
      if (Math.hypot(f.x - p.x, f.y - p.y) < f.radius + 20) {
        return { x: f.x, y: f.y - 24, label: `[Space] ${f.label}`, accent: '#ffd166' };
      }
    }

    for (const m of this.state.mailboxes) {
      if (Math.hypot(m.x - p.x, m.y - p.y) < 82) {
        return { x: m.x, y: m.y, label: '[Space] Wormhole Mail', accent: '#ffd166' };
      }
    }
    if (this.state.droppedSatchel && Math.hypot(this.state.droppedSatchel.x - p.x, this.state.droppedSatchel.y - p.y) < 88) {
      return { x: this.state.droppedSatchel.x, y: this.state.droppedSatchel.y - 22, label: '[Space] Recover Lost Satchel', accent: '#ffd166' };
    }

    for (const b of this.state.buildings) {
      if (Math.hypot(b.x - p.x, b.y - p.y) < 82) {
        if (b.type === 'mood_plot') {
          const label = !b.crop
            ? '[Space] Plant Seed'
            : isCropReady(b.crop, b.growth)
              ? `[Space] Harvest ${CROPS[b.crop].name}`
              : '[Space] Compliment Sprout';
          return { x: b.x, y: b.y, label, accent: '#2ec4b6' };
        }
        if (b.type === 'camp_table') return { x: b.x, y: b.y, label: '[Space] Camp Table · Cook / Serve / Move', accent: '#ffd166' };
        if (b.type === 'bench') return { x: b.x, y: b.y, label: '[Space] Wooden Bench · Rest / Move', accent: '#c9a66b' };
        if (b.type === 'dock_lamp') return { x: b.x, y: b.y, label: '[Space] Reflector Lamp · Move / Salvage', accent: '#ffd166' };
        if (b.type === 'workbench') return { x: b.x, y: b.y, label: '[Space] Workbench · Craft / Move', accent: '#4cc9f0' };
        if (b.type === 'camp_awning') return { x: b.x, y: b.y, label: '[Space] Canvas Camp Awning · Shelter / Move', accent: '#ff5d8f' };
        if (b.type === 'specimen_cabinet') return { x: b.x, y: b.y, label: '[Space] Specimen Cabinet · Study / Move', accent: '#a8ff3e' };
        if (b.type === 'rain_trough' || b.type === 'frost_pantry' || b.type === 'choir_irrigator') {
          return { x: b.x, y: b.y, label: '[Space] Manage Camp Structure', accent: '#72efdd' };
        }
        if (b.type === 'funk_blender') return { x: b.x, y: b.y, label: '[Space] Funk-Blender', accent: '#ff5d8f' };
        if (b.type === 'sassy_chest') return { x: b.x, y: b.y, label: '[Space] Hear Roast', accent: '#ffd166' };
      }
    }
    for (const c of this.state.creatures) {
      if (c.aiState !== 'ko' && Math.hypot(c.x - p.x, c.y - p.y) < 92) {
        const def = CREATURE_DEFS[c.type];
        return {
          x: c.x,
          y: c.y,
          label: def.hostile ? `[Space] Bonk ${def.name}` : `[Space] Social · ${def.name}`,
          accent: def.hostile ? '#ff4d6d' : '#ff85b3',
        };
      }
    }
    const seeCrystals = canSeeCrystals(p, this.activeTripsSet(), this.state.exp?.id ?? null) || this.guideLineTimer > 0;
    for (const o of this.state.objects) {
      if (o.respawn > 0 || (o.type === 'crystal' && !seeCrystals)) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) < 88) {
        return { x: o.x, y: o.y, label: '[Space] Forage', accent: '#ffd166' };
      }
    }
    return null;
  }

  private render(): void {
    const ctx = this.ctx;
    const p = this.state.player;
    const t = this.state.time;
    const wf = p.wobble / 100;
    const trips = this.activeTripsSet();
    const isG = this.state.exp?.id === 'gravity_nap';
    const rm = this.state.reducedMotion;
    const phase = getPhaseFromDayTime(this.state.dayTime);
    const biome = getBiomeAt(p.x, p.y);
    const physics = getRegionPhysics(p.x, p.y, t, biome.id, this.state.techniques, p.elevation, p.wobble, false);
    const nearTotemRender = this.isNearCalmingTotem();
    const tripProfile = computeTripProfile(
      p.vibe,
      p.maxVibe,
      p.wobble,
      this.state.trips,
      this.state.tripMaxDur,
      nearTotemRender,
    );

    const noCamMotion = rm || Boolean(this.state.audioSettings.stableCamera);
    const shakeMag = noCamMotion ? 0 : this.trauma * this.trauma * 14 + tripProfile.badTripIntensity * 2.4;
    const shakeX = shakeMag > 0.2 ? (Math.random() * 2 - 1) * shakeMag : 0;
    const shakeY = shakeMag > 0.2 ? (Math.random() * 2 - 1) * shakeMag : 0;
    const wobbleSwayX = !noCamMotion && this.mode === 'playing' && wf > 0.45 ? Math.sin(t * 2.4) * (4 + wf * 6) : 0;
    const wobbleSwayY = !noCamMotion && this.mode === 'playing' && wf > 0.45 ? Math.cos(t * 2.0) * (3 + wf * 4.5) : 0;

    // Breathing perceptual FOV zoom & subtle Dutch tilt during deep trips / Bad Trip
    const zoomPulse =
      noCamMotion || this.mode === 'title' || tripProfile.cameraZoomAmp <= 0
        ? 1
        : 1 + Math.sin(t * (tripProfile.mood === 'bad_trip' ? 2.7 : 1.3)) * tripProfile.cameraZoomAmp;
    const dutchTilt =
      noCamMotion || this.mode === 'title'
        ? 0
        : tripProfile.badTripIntensity > 0.35
          ? Math.sin(t * 1.45) * 0.028 * tripProfile.badTripIntensity
          : trips.has('kaleido') || trips.has('velvet_fog')
            ? Math.sin(t * 0.85) * 0.012
            : 0;

    const cx = this.camX - this.width / 2 + shakeX + wobbleSwayX;
    const cy = this.camY - this.height / 2 + shakeY + wobbleSwayY;

    ctx.save();
    if (zoomPulse !== 1 || dutchTilt !== 0) {
      ctx.translate(this.width / 2, this.height / 2);
      if (dutchTilt !== 0) ctx.rotate(dutchTilt);
      if (zoomPulse !== 1) ctx.scale(zoomPulse, zoomPulse);
      ctx.translate(-this.width / 2, -this.height / 2);
    }
    ctx.translate(-cx, -cy);

    drawTerrain(ctx, cx, cy, this.width, this.height, t, wf, trips, this.state.worldFlags, rm);
    if (this.trailRun) {
      const { id, gateIndex } = this.trailRun;
      const gate = RIBBON_TRAILS[id].gates[gateIndex];
      if (Math.abs(gate.x - this.camX) <= this.width / 2 + 100 && Math.abs(gate.y - this.camY) <= this.height / 2 + 100) {
        drawRibbonGate(ctx, gate, gateIndex);
      }
    }

    const viewPadX = this.width * 0.68;
    const viewPadY = this.height * 0.68;

    // Ground-layer world features (tracks, canals, stamp bridges, candleboats, ramps)
    for (const f of WORLD_FEATURES) {
      if (Math.abs(f.x - this.camX) < viewPadX + f.radius && Math.abs(f.y - this.camY) < viewPadY + f.radius) {
        drawWorldFeature(ctx, f, t, this.state.worldFlags, this.state.mirrorAngles, physics, rm);
      }
    }

    // Perceptual world-space psychedelic layer (Sacred Geometry, Starlight Constellations, Disco tiles, Spectrum rings, Tracers, Bad Trip Phantoms)
    if (this.mode !== 'title') {
      const nearbyObjects: Array<{ x: number; y: number }> = [];
      if (trips.has('cosmic')) {
        for (const o of this.state.objects) {
          if (o.respawn > 0) continue;
          if (Math.hypot(o.x - p.x, o.y - p.y) < 380) {
            nearbyObjects.push({ x: o.x, y: o.y });
            if (nearbyObjects.length >= 14) break;
          }
        }
      }
      drawTripWorldLayer(
        ctx,
        p,
        t,
        trips,
        tripProfile,
        this.playerTracers,
        this.soundRipples,
        this.badTripPhantoms,
        nearbyObjects,
        rm,
        this.state.audioSettings.effectStrength ?? 1,
        Boolean(this.state.audioSettings.flashFree),
      );
    }

    drawWaterRipples(ctx, this.waterRipples);

    const drawables: Array<{ y: number; fn: () => void }> = [];
    const seeCrystals = canSeeCrystals(p, trips, this.state.exp?.id ?? null) || this.guideLineTimer > 0;
    const megaLamp = this.hasSkill('mega_lamp');

    for (const m of this.state.mailboxes) {
      if (Math.abs(m.x - this.camX) < viewPadX && Math.abs(m.y - this.camY) < viewPadY) {
        drawables.push({ y: m.y, fn: () => drawMailbox(ctx, m, t) });
      }
    }
    for (const res of RESIDENTS) {
      const pos = this.getEffectiveResidentPos(res, phase.id, t);
      if (Math.abs(pos.x - this.camX) < viewPadX && Math.abs(pos.y - this.camY) < viewPadY) {
        drawables.push({ y: pos.y, fn: () => drawResident(ctx, res, pos.x, pos.y, t, rm) });
      }
    }
    for (const o of this.state.objects) {
      if (o.respawn > 0 || (o.type === 'crystal' && !seeCrystals)) continue;
      if (Math.abs(o.x - this.camX) < viewPadX && Math.abs(o.y - this.camY) < viewPadY) {
        drawables.push({ y: o.y, fn: () => drawWorldObject(ctx, o, t, wf, trips, rm) });
      }
    }
    for (const building of this.state.buildings) {
      const preview = this.buildingMove?.id === building.id ? this.buildingMove : null;
      const b = preview ? { ...building, x: p.x + p.facing * 52, y: p.y + 8, rotation: preview.rotation } : building;
      if (Math.abs(b.x - this.camX) < viewPadX && Math.abs(b.y - this.camY) < viewPadY) {
        drawables.push({
          y: b.y,
          fn: () => {
            if (preview) {
              ctx.save();
              ctx.globalAlpha *= 0.65;
            }
            drawBuilding(ctx, b, t, megaLamp);
            if (preview) ctx.restore();
          },
        });
      }
    }
    for (const c of this.state.creatures) {
      if (Math.abs(c.x - this.camX) < viewPadX + 60 && Math.abs(c.y - this.camY) < viewPadY + 60) {
        drawables.push({ y: c.y, fn: () => drawCreature(ctx, c, t, isG, rm) });
      }
    }
    if (this.state.droppedSatchel) {
      const sat = this.state.droppedSatchel;
      if (Math.abs(sat.x - this.camX) < viewPadX && Math.abs(sat.y - this.camY) < viewPadY) {
        drawables.push({ y: sat.y, fn: () => drawDroppedSatchel(ctx, sat, t, rm) });
      }
    }
    if (this.mode !== 'title') {
      drawables.push({ y: p.y + p.elevation * 40, fn: () => drawPlayer(ctx, p, t, trips, isG, this.state.ghostTimer, rm) });
    }

    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    if (this.mode === 'playing' && this.fishing.active) {
      drawFishingSession(ctx, p, this.fishing, t, rm);
    }

    // Directional compass arrow around player (Ghost Mode refuge OR active Atlas waypoint)
    if (this.mode === 'playing') {
      const waypoint = this.getDisplayedWaypoint();
      if (this.state.ghostTimer > 0) {
        const ref = findNearestWarmRefuge(p.x, p.y, this.state.buildings);
        drawWorldCompass(ctx, p.x, p.y, ref.angle, '#ff9f1c');
      } else if (waypoint) {
        const ang = Math.atan2(waypoint.y - p.y, waypoint.x - p.x);
        drawWorldCompass(ctx, p.x, p.y, ang, '#ffd166');
      }
    }

    for (const dk of this.state.ducks) {
      ctx.save();
      ctx.translate(dk.x, dk.y - dk.z);
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = '#160c24';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (const pr of this.state.projectiles) drawProjectile(ctx, pr, t);

    for (let i = 0; i < POOL_SIZE; i++) {
      const pt = this.particles[i];
      if (!pt.active) continue;
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.mode === 'playing' && !this.activeModal && this.nearestPrompt) {
      drawInteractPrompt(ctx, this.nearestPrompt, t);
    }

    ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    for (const pop of this.state.popups) {
      ctx.globalAlpha = Math.min(1, pop.life / 0.4);
      ctx.strokeStyle = '#160c24';
      ctx.lineWidth = 4;
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    const weather = getCountyWeather(this.state.worldSeed, this.state.day);
    if (this.mode !== 'title' && isWeatherActive(weather, phase.id)) {
      drawWeatherVeil(ctx, this.width, this.height, weather, t, rm || Boolean(this.state.audioSettings.flashFree));
    }

    // Screen-space ambient pollen
    if (!rm) {
      ctx.fillStyle = 'rgba(255, 240, 200, 0.32)';
      for (const m of this.ambientMotes) {
        const sx = (((m.x + this.width / 2 - this.camX * 0.25) % this.width) + this.width) % this.width;
        const sy = (((m.y + this.height / 2 - this.camY * 0.25) % this.height) + this.height) % this.height;
        ctx.beginPath();
        ctx.arc(sx, sy, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Day/Dusk/Night atmosphere & lantern darkness
    if (phase.id === 'dusk' || this.state.exp?.id === 'rave_cloud') {
      ctx.fillStyle = `hsla(${(t * 36) % 360}, 78%, 52%, 0.11)`;
      ctx.fillRect(0, 0, this.width, this.height);
    } else if (phase.id === 'night' && this.mode !== 'title') {
      ctx.save();
      ctx.fillStyle = 'rgba(14, 5, 32, 0.72)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalCompositeOperation = 'destination-out';

      const px = p.x - cx;
      const py = p.y - cy;
      const lanternR = trips.has('velvet_fog') ? 240 : 155;
      const pg = ctx.createRadialGradient(px, py, 24, px, py, lanternR);
      pg.addColorStop(0, 'rgba(0,0,0,0.94)');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, lanternR, 0, Math.PI * 2);
      ctx.fill();

      for (const lm of LANDMARKS) {
        if (!lm.isWarmRefuge) continue;
        const lx = lm.x - cx;
        const ly = lm.y - cy;
        if (lx < -260 || lx > this.width + 260 || ly < -260 || ly > this.height + 260) continue;
        const lg = ctx.createRadialGradient(lx, ly, 36, lx, ly, 230);
        lg.addColorStop(0, 'rgba(0,0,0,1)');
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.arc(lx, ly, 230, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const b of this.state.buildings) {
        if (b.type === 'lava_lamp' || b.type === 'dock_lamp' || b.type === 'vibe_beacon' || b.type === 'dream_totem' || b.type === 'camp_table') {
          const lx = b.x - cx;
          const ly = b.y - cy;
          const lr =
            b.type === 'vibe_beacon'
              ? 280
              : b.type === 'dream_totem'
                ? 210
                : b.type === 'camp_table'
                  ? 145
                  : megaLamp
                    ? 250
                    : 185;
          const lg = ctx.createRadialGradient(lx, ly, 30, lx, ly, lr);
          lg.addColorStop(0, 'rgba(0,0,0,1)');
          lg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.arc(lx, ly, lr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Screen-space perceptual trip & Bad Trip Melt Spiral optical overlay (under HUD)
    if (this.mode !== 'title') {
      drawTripScreenOverlay(
        ctx,
        this.width,
        this.height,
        t,
        trips,
        tripProfile,
        p.x - cx,
        p.y - cy,
        nearTotemRender,
        rm,
        this.state.audioSettings.effectStrength ?? 1,
        Boolean(this.state.audioSettings.flashFree),
      );
    }

    if (this.joy.active) {
      ctx.strokeStyle = 'rgba(247, 239, 222, 0.55)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(this.joy.ox, this.joy.oy, 54, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 209, 102, 0.88)';
      ctx.beginPath();
      ctx.arc(this.joy.cx, this.joy.cy, 21, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderMinimap(): void {
    if (!this.minimapCanvas || this.mode === 'title') return;
    const mctx = this.minimapCanvas.getContext('2d');
    if (!mctx) return;
    const size = this.minimapCanvas.width;
    const R = size / 2;
    mctx.clearRect(0, 0, size, size);

    mctx.save();
    mctx.beginPath();
    mctx.arc(R, R, R - 1, 0, Math.PI * 2);
    mctx.clip();

    mctx.fillStyle = '#180d28';
    mctx.fillRect(0, 0, size, size);

    const s = (R - 4) / WORLD_R;

    // Shared REGION_ZONES rendered with discovery states
    for (const zone of REGION_ZONES) {
      const disc = this.state.discoveries[zone.id] ?? 'unknown';
      if (disc === 'unknown') continue;
      mctx.fillStyle = BIOMES[zone.id].mapCol;
      mctx.globalAlpha = disc === 'visited' ? 0.92 : disc === 'seen' ? 0.58 : 0.25;
      mctx.beginPath();
      mctx.ellipse(R + zone.cx * s, R + zone.cy * s, zone.rx * s, zone.ry * s, 0, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.globalAlpha = 1;

    // County roads
    mctx.strokeStyle = 'rgba(247, 239, 222, 0.42)';
    mctx.lineWidth = 1.4;
    for (const road of ROADS) {
      if (road.shortcutId === 'lamp_service_tunnel' && !this.state.worldFlags.wickworksRestored) continue;
      mctx.beginPath();
      road.points.forEach(([px, py], i) => (i === 0 ? mctx.moveTo(R + px * s, R + py * s) : mctx.lineTo(R + px * s, R + py * s)));
      mctx.stroke();
    }

    // Lava lamps
    mctx.fillStyle = '#ff9f1c';
    for (const b of this.state.buildings) {
      if (b.type === 'lava_lamp') {
        mctx.beginPath();
        mctx.arc(R + b.x * s, R + b.y * s, 2.5, 0, Math.PI * 2);
        mctx.fill();
      }
    }

    // Active Waypoint star
    const waypoint = this.getDisplayedWaypoint();
    if (waypoint) {
      mctx.fillStyle = '#ffd166';
      mctx.beginPath();
      mctx.arc(R + waypoint.x * s, R + waypoint.y * s, 3.8, 0, Math.PI * 2);
      mctx.fill();
    }

    // Player dot
    const p = this.state.player;
    mctx.fillStyle = '#ffffff';
    mctx.strokeStyle = '#160c24';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.arc(R + p.x * s, R + p.y * s, 3.8, 0, Math.PI * 2);
    mctx.fill();
    mctx.stroke();

    mctx.restore();
  }

  public emitHud(): void {
    this.renderMinimap();
    const p = this.state.player;
    const ch = CHARACTERS[p.charId];
    const phase = getPhaseFromDayTime(this.state.dayTime);
    const biome = getBiomeAt(p.x, p.y);
    const quest = getActiveQuestSummary(this.state.stats, this.state.claimedQuests, this.state.worldFlags);
    const physics = getRegionPhysics(p.x, p.y, this.state.time, biome.id, this.state.techniques, p.elevation, p.wobble, false);
    const refuge = findNearestWarmRefuge(p.x, p.y, this.state.buildings);
    const wp = this.getDisplayedWaypoint();
    const camp = this.state.camp;
    const campAnchor = this.getCampAnchor();
    const nearCampAnchor = Boolean(campAnchor && Math.hypot(campAnchor.x - p.x, campAnchor.y - p.y) < 185);
    const campShelter = evaluateCampShelter(p.x, p.y, this.state.buildings);
    const weather = getCountyWeather(this.state.worldSeed, this.state.day);
    const wardActive = Boolean(campAnchor && camp.wardDay === this.state.day && phase.id !== 'day');
    const watched = Boolean(wardActive && campAnchor && Math.hypot(campAnchor.x - p.x, campAnchor.y - p.y) <= 480);
    const run = this.trailRun;
    const trail = run ? RIBBON_TRAILS[run.id] : null;

    const nearTotem = this.isNearCalmingTotem();
    const tripProfile = computeTripProfile(p.vibe, p.maxVibe, p.wobble, this.state.trips, this.state.tripMaxDur, nearTotem);
    const activeTrips: HudSnapshot['activeTrips'] = [];
    for (const [k, v] of Object.entries(this.state.trips)) {
      if ((v || 0) > 0) {
        const tid = k as TripId;
        const meta = TRIP_VISUAL_META[tid];
        const maxD = Math.max(v || 1, this.state.tripMaxDur?.[tid] || 32);
        const st = computeTripStage(v || 0, maxD);
        activeTrips.push({ id: tid, name: meta.shortName, accent: meta.accent, rem: v || 0, stage: st.stage });
      }
    }

    const quickSlots: HudSnapshot['quickSlots'] = this.getQuickConsumables().map((id) => {
      const it = ITEMS[id];
      return {
        id,
        name: it.name,
        qty: this.state.inv[id] || 0,
        accent: it.accent,
        kind: it.trip === 'sober' ? 'sober' : it.cat === 'sub' ? 'sub' : it.cat === 'food' ? 'food' : 'tool',
        trip: it.trip,
      };
    });

    const nearMailboxSquare = Math.hypot(p.x + 145, p.y + 145) < 520;
    const radioLine = nearMailboxSquare ? getRadioBroadcastLine(this.state.worldFlags, this.state.day, p.charId) : null;

    this.callbacks.onHudUpdate({
      mode: this.mode,
      weather: {
        current: weather,
        next: getCountyWeather(this.state.worldSeed, this.state.day + 1),
        active: isWeatherActive(weather, phase.id),
        sheltered: campShelter.sheltered || watched,
      },
      fieldwork: {
        provisions: camp.provisions,
        site: campAnchor ? RECIPES.find((recipe) => recipe.id === campAnchor.type)?.name ?? 'Camp site' : null,
        nearbySite: Boolean(this.findCampSite(185)),
        hasSite: Boolean(campAnchor || this.findCampSite(Infinity)),
        nearCampAnchor,
        report: camp.report,
        lastShiftDay: camp.lastShiftDay,
        wardActive,
        companions: this.state.creatures.filter((creature) => creature.tamed)
          .map((creature) => ({ id: creature.id, name: CREATURE_DEFS[creature.type].name, job: camp.jobs[creature.id] ?? null })),
        trail: run && trail ? {
          id: run.id,
          gate: run.gateIndex,
          total: trail.gates.length - 1,
          seconds: Math.max(0, trail.seconds - run.elapsed),
          label: trail.gates[run.gateIndex].label,
          roll: Boolean(trail.gates[run.gateIndex].roll),
        } : null,
        trailRecords: { ...camp.trailRecords },
      },
      day: this.state.day,
      dayTime: this.state.dayTime,
      phaseId: phase.id,
      phaseName: phase.name,
      biomeId: biome.id,
      biomeName: biome.name,
      biomeRule: biome.ruleSummary,
      charId: p.charId,
      vibe: Math.round(p.vibe),
      maxVibe: Math.round(p.maxVibe),
      munch: Math.round(p.munch),
      maxMunch: Math.round(p.maxMunch),
      wobble: Math.round(p.wobble),
      elevation: p.elevation,
      ghostTimer: Math.ceil(this.state.ghostTimer),
      xp: this.state.xp,
      xpNext: getXpThreshold(this.state.skills.length, this.state.sp),
      sp: this.state.sp,
      abCd: p.abCd,
      abMaxCd: ch.ability.cd,
      rollCd: p.rollCd,
      moveStyle: p.moveStyle,
      activeTrips,
      tripMood: tripProfile.mood,
      tripLabel: tripProfile.label,
      tripAdvice: tripProfile.advice,
      tripStage: tripProfile.stage,
      tripStageProgress: tripProfile.stageProgress,
      tripSynergy: tripProfile.synergy
        ? {
            id: tripProfile.synergy.id,
            name: tripProfile.synergy.name,
            accent: tripProfile.synergy.accent,
            bonusDesc: tripProfile.synergy.bonusDesc,
          }
        : null,
      badTripTier: tripProfile.badTripTier,
      badTripIntensity: tripProfile.badTripIntensity,
      euphoriaIntensity: tripProfile.euphoriaIntensity,
      dominantTrip: tripProfile.dominantTrip,
      nearCalmingTotem: nearTotem,
      quickSlots,
      exp: this.state.exp
        ? { name: this.state.exp.name, rem: Math.ceil(this.state.exp.rem), accent: this.state.exp.accent }
        : null,
      caps: this.state.inv.bottlecap || 0,
      gossip: this.state.inv.gossip_slip || 0,
      socks: this.state.inv.left_sock || 0,
      tamedCount: this.state.creatures.filter((c) => c.tamed).length,
      maxBuddies: this.hasSkill('party_animal') ? 2 : 1,
      unclaimedQuests: countUnclaimedQuests(this.state.stats, this.state.claimedQuests, this.state.worldFlags),
      activeQuestTitle: quest.title,
      activeQuestProgress: quest.progress,
      inv: { ...this.state.inv },
      skills: [...this.state.skills],
      techniques: [...this.state.techniques],
      unlockedStyles: [...this.state.unlockedStyles],
      unlockedTransports: [...this.state.unlockedTransports],
      claimedQuests: [...this.state.claimedQuests],
      discoveries: { ...this.state.discoveries },
      worldFlags: { ...this.state.worldFlags },
      waypoint: wp,
      waypointDist: wp ? Math.round(Math.hypot(wp.x - p.x, wp.y - p.y) / 10) : null,
      waypointAngle: wp ? Math.atan2(wp.y - p.y, wp.x - p.x) : null,
      nearestRefugeDist: Math.round(refuge.dist / 10),
      nearestRefugeAngle: refuge.angle,
      timingCue: physics.timingCue,
      radioBroadcastLine: radioLine,
      audioSettings: { ...this.state.audioSettings },
      reducedMotion: this.state.reducedMotion,
      difficultyMode: this.state.difficultyMode || 'standard',
      gear: { ...p.gear },
      stats: { ...this.state.stats },
      shakeBonus: this.state.shakeBonus,
      nearBlender: this.isNearBlender(),
      nearWorkbench: this.isNearWorkbench(),
      nearDock: this.isNearDock(),
      dockLampSlot: this.state.worldFlags.dockLampSlot,
      dockReflectionIntact: computeDockReflectionState(
        this.state.time,
        this.state.worldFlags.dockLampSlot,
        this.state.worldFlags.ferryRestored,
      ).minnowVisible,
      fishing: { ...this.fishing },
      disciplines: { ...this.getDisciplines() },
      journalSketches: [...(this.state.journalSketches || [])],
      campSupperStatus: evaluateCampSupperStatus(this.state.buildings, this.state.inv),
      campShelter,
      ferryEveningActive:
        this.state.worldFlags.ferrySupperServedDay > 0 &&
        this.state.day > this.state.worldFlags.ferrySupperServedDay &&
        (phase.id === 'dusk' || phase.id === 'night'),
      movingBuildingId: this.buildingMove?.id ?? null,
      activeMealBuff: this.state.activeMealBuff ? { name: this.state.activeMealBuff.name, rem: this.state.activeMealBuff.rem } : null,
      deathReason: this.state.deathReason,
      victory: this.state.victory,
      muted: this.state.audioSettings.muted,
      promptLabel: this.nearestPrompt?.label ?? null,
      playerX: p.x,
      playerY: p.y,
      journalNotes: [...this.state.journalNotes],
      droppedSatchel: this.state.droppedSatchel ?? null,
      regionalEvent: this.state.regionalEvent ?? null,
      countySync: computeCountySyncStatus(
        this.state.worldFlags,
        this.state.stats,
        this.state.creatures.filter((c) => c.tamed).length,
        Object.values(this.state.npcMemories).filter((m) => m.talked).length,
        p.charId,
      ),
    });
  }
}
