import type {
  CookingRecipeDef,
  DisciplineId,
  DisciplineProgress,
  PerkId,
} from './types.ts';

export const TIER_NAMES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Novice',
  2: 'Hand',
  3: 'Specialist',
  4: 'Expert',
  5: 'Master',
};

export const TIER_XP_THRESHOLDS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 0,
  2: 40,
  3: 100,
  4: 190,
  5: 310,
};

export interface DisciplineDef {
  id: DisciplineId;
  name: string;
  accent: string;
  practiceWhere: string;
  tiers: Record<1 | 2 | 3 | 4 | 5, string>;
  perks: [PerkDef, PerkDef];
}

export interface PerkDef {
  id: PerkId;
  discipline: DisciplineId;
  name: string;
  desc: string;
  accent: string;
}

export const DISCIPLINES: Record<DisciplineId, DisciplineDef> = {
  farming: {
    id: 'farming',
    name: 'Farming',
    accent: '#2ec4b6',
    practiceWhere: 'Plant, compliment, and harvest Mood Soil plots at Giggle-Grove Camp.',
    tiers: {
      1: 'Sow and water Mood Soil plots',
      2: 'Read stress signs & mulch Bell Reeds',
      3: 'Graft compatible plants & unlock Tier-3 Perk',
      4: 'Unlock Choir Irrigator blueprint',
      5: 'Breed stable county hybrids',
    },
    perks: [
      {
        id: 'graft_sage',
        discipline: 'farming',
        name: 'Graft Sage',
        desc: '+60% hybrid crossbreed odds & Bell Reeds mature 35% faster.',
        accent: '#a7c957',
      },
      {
        id: 'hydro_tender',
        discipline: 'farming',
        name: 'Hydro Tender',
        desc: 'Plots near a Rain Trough or Choir Irrigator grow at 2x speed automatically.',
        accent: '#4cc9f0',
      },
    ],
  },
  angling: {
    id: 'angling',
    name: 'Angling',
    accent: '#4cc9f0',
    practiceWhere: 'Cast at the Delta Public Bank, experiment with the Dock Lamp, and land fish.',
    tiers: {
      1: 'Cast & reel Spool Perch with a reed rod',
      2: 'Read surface nibbles & craft Bell-Reed Lures',
      3: 'Unlock Prism Reel & choose Tier-3 Angling Perk',
      4: 'Track reflected shoals & deep Receipt Eels',
      5: 'Establish a self-sustaining Rain Trough nursery',
    },
    perks: [
      {
        id: 'current_reader',
        discipline: 'angling',
        name: 'Current Reader',
        desc: '+0.65s wider bite window & +15% faster reeling in ink currents.',
        accent: '#4cc9f0',
      },
      {
        id: 'stillwater_keeper',
        discipline: 'angling',
        name: 'Stillwater Keeper',
        desc: 'Bonus reflected Mirror Minnow catch value & Rain Trough camp spawns calm ripples.',
        accent: '#ffd166',
      },
    ],
  },
  cookery: {
    id: 'cookery',
    name: 'Cookery',
    accent: '#ffd166',
    practiceWhere: 'Cook fish chowders, preserved snacks, and shared meals at your Camp Table.',
    tiers: {
      1: 'Simmer Ferryman’s Perch Chowder & warm broths',
      2: 'Unlock Frost Pantry & preserve travel rations',
      3: 'Serve timed courses & choose Tier-3 Cookery Perk',
      4: 'Substitute regional ingredients for bonus buffs',
      5: 'Host an all-night broadcast supper with lasting guest dish',
    },
    perks: [
      {
        id: 'provisioner',
        discipline: 'cookery',
        name: 'Provisioner',
        desc: 'Cooked travel meals last +40% longer & restore +15 extra Munch.',
        accent: '#f4a261',
      },
      {
        id: 'tablekeeper',
        discipline: 'cookery',
        name: 'Tablekeeper',
        desc: 'Meals shared at Camp Table grant +25 bonus Vibe & extra visitor gifts.',
        accent: '#ff85b3',
      },
    ],
  },
  fabrication: {
    id: 'fabrication',
    name: 'Fabrication',
    accent: '#ff5d8f',
    practiceWhere: 'Craft tools, camp lamps, Funk-Blender brews, and Workbench upgrades.',
    tiers: {
      1: 'Lash basic rods, lamps & field kits',
      2: 'Fit interchangeable camp parts & reed spools',
      3: 'Cut calibrated lens sockets (Prism Reel) & choose Perk',
      4: 'Craft modular field tools & defensive repellers',
      5: 'Build county community masterworks',
    },
    perks: [
      {
        id: 'lens_smith',
        discipline: 'fabrication',
        name: 'Lens-Smith',
        desc: 'Optical & crystal recipes save 1 Cosmic Crystal (minimum 1).',
        accent: '#72efdd',
      },
      {
        id: 'field_tinker',
        discipline: 'fabrication',
        name: 'Field Tinker',
        desc: 'Craft Workbench & Funk-Blender recipes anywhere in the county.',
        accent: '#ff5d8f',
      },
    ],
  },
  building: {
    id: 'building',
    name: 'Building',
    accent: '#b388ff',
    practiceWhere: 'Place, furnish, move, and light up structures around your Giggle-Grove Camp.',
    tiers: {
      1: 'Place camp tables, benches & shelters',
      2: 'Light & furnish a cozy visitor dining stop',
      3: 'Unlock Frost Pantry & choose Tier-3 Building Perk',
      4: 'Route water (Rain Trough) & warmth across camp',
      5: 'Design a staffed regional waystation',
    },
    perks: [
      {
        id: 'host',
        discipline: 'building',
        name: 'Host',
        desc: 'Furnished camp tables restore +4 Vibe/s at dusk & attract neighbor gifts.',
        accent: '#ffd166',
      },
      {
        id: 'rigger',
        discipline: 'building',
        name: 'Rigger',
        desc: 'Salvaging structures returns 100% materials & extends placement reach.',
        accent: '#b388ff',
      },
    ],
  },
  field_botany: {
    id: 'field_botany',
    name: 'Field Botany',
    accent: '#a8ff3e',
    practiceWhere: 'Observe rare flora & Mirror Minnow reflections, log sketches, or release catches.',
    tiers: {
      1: 'Sketch Delta reflections & Bell Reed habitats',
      2: 'Compare reed notch patterns & nocturnal blooms',
      3: 'Verify look-alikes & brew stabilizing Moon-Petals',
      4: 'Cultivate rare symbionts across biomes',
      5: 'Publish a County Field Guide expanding market stock',
    },
    perks: [
      {
        id: 'field_naturalist',
        discipline: 'field_botany',
        name: 'Field Naturalist',
        desc: 'Bonus XP when observing reflections or releasing rare specimens.',
        accent: '#a8ff3e',
      },
      {
        id: 'nocturnal_spotter',
        discipline: 'field_botany',
        name: 'Nocturnal Spotter',
        desc: 'Moon Orchids & Eye-Blooms drop bonus petals and prism dust.',
        accent: '#72efdd',
      },
    ],
  },
  acoustics: {
    id: 'acoustics',
    name: 'Acoustics',
    accent: '#ff70a6',
    practiceWhere: 'Tune Fallen Tuning Forks in Undertone Caverns, repair Radio Unmelted, or play station motifs.',
    tiers: {
      1: 'Recognize regional calls & ferry horns',
      2: 'Record county motifs & groove reversals',
      3: 'Tune resonant Choir Irrigators & choose Perk',
      4: 'Relay answering signals across cavern hollows',
      5: 'Conduct the personalized All-Night County Broadcast',
    },
    perks: [
      {
        id: 'echo_listener',
        discipline: 'acoustics',
        name: 'Echo Listener',
        desc: 'Acoustic bridge cycles hold +1.5s longer and wall taps echo twice as far.',
        accent: '#ff70a6',
      },
      {
        id: 'motif_weaver',
        discipline: 'acoustics',
        name: 'Motif Weaver',
        desc: 'Radio & tuning fork harmonies restore +12 Vibe and charm nearby critters.',
        accent: '#ffd166',
      },
    ],
  },
  wayfinding: {
    id: 'wayfinding',
    name: 'Wayfinding',
    accent: '#48cae4',
    practiceWhere: 'Discover outer regions, unlock county mailboxes, and survey new expedition loops.',
    tiers: {
      1: 'Mark landmarks & follow compass pins',
      2: 'Read regional timing cues & tidal schedules',
      3: 'Survey hidden shortcuts & choose Tier-3 Perk',
      4: 'Rig cross-region passages & windlifts',
      5: 'Link remote refuges into an all-night county route',
    },
    perks: [
      {
        id: 'shortcut_surveyor',
        discipline: 'wayfinding',
        name: 'Shortcut Surveyor',
        desc: '+10% walking speed along county roads & instant compass bearing updates.',
        accent: '#48cae4',
      },
      {
        id: 'lantern_strider',
        discipline: 'wayfinding',
        name: 'Lantern Strider',
        desc: 'Gentler dusk/night Vibe drain & +6s Ghost Mode grace time.',
        accent: '#ffd166',
      },
    ],
  },
  creature_care: {
    id: 'creature_care',
    name: 'Creature Care',
    accent: '#90be6d',
    practiceWhere: 'Feed favored snacks, dance peacefully with county critters, and release rare catches.',
    tiers: {
      1: 'Observe creature temperaments & favored treats',
      2: 'Prepare favored feed & earn buddy perks',
      3: 'Teach buddies field tasks & choose Tier-3 Perk',
      4: 'Restore calm nesting & nursery habitats',
      5: 'Broker a peaceful county migration corridor',
    },
    perks: [
      {
        id: 'gentle_hand',
        discipline: 'creature_care',
        name: 'Gentle Hand',
        desc: 'Taming takes 1 fewer snack & peaceful encounters restore +8 Vibe.',
        accent: '#90be6d',
      },
      {
        id: 'field_scout',
        discipline: 'creature_care',
        name: 'Field Scout',
        desc: 'Active buddies trigger their gathering & scouting gifts 35% more often.',
        accent: '#a8ff3e',
      },
    ],
  },
  hospitality: {
    id: 'hospitality',
    name: 'Hospitality',
    accent: '#ff9f1c',
    practiceWhere: 'Host Capt. Nix at Camp Table, barter with neighbors, and mediate regional disputes.',
    tiers: {
      1: 'Share warm suppers & greet county neighbors',
      2: 'Learn daily schedules & trade local goods',
      3: 'Organize a welcoming stop & choose Tier-3 Perk',
      4: 'Mediate regional shortages & cross-town deliveries',
      5: 'Found a recurring all-night county camp festival',
    },
    perks: [
      {
        id: 'warm_welcome',
        discipline: 'hospitality',
        name: 'Warm Welcome',
        desc: 'Camp visitors leave bonus Bottlecaps & 15% extra barter discount.',
        accent: '#ff9f1c',
      },
      {
        id: 'county_connector',
        discipline: 'hospitality',
        name: 'County Connector',
        desc: 'Resolving regional requests grants +25 bonus XP and boosts broadcast harmony.',
        accent: '#ff85b3',
      },
    ],
  },
};

export const CORE_DISCIPLINE_IDS: DisciplineId[] = [
  'farming',
  'angling',
  'cookery',
  'fabrication',
  'building',
  'field_botany',
  'acoustics',
  'wayfinding',
  'creature_care',
  'hospitality',
];

export function createInitialDisciplines(): Record<DisciplineId, DisciplineProgress> {
  return {
    farming: { xp: 0, tier: 1, perk: null, distinctActions: [] },
    angling: { xp: 0, tier: 1, perk: null, distinctActions: [] },
    cookery: { xp: 0, tier: 1, perk: null, distinctActions: [] },
    fabrication: { xp: 0, tier: 1, perk: null, distinctActions: [] },
    building: { xp: 0, tier: 1, perk: null, distinctActions: [] },
    field_botany: { xp: 0, tier: 1, perk: null, distinctActions: [] },
    acoustics: { xp: 0, tier: 1, perk: null, distinctActions: [] },
    wayfinding: { xp: 0, tier: 1, perk: null, distinctActions: [] },
    creature_care: { xp: 0, tier: 1, perk: null, distinctActions: [] },
    hospitality: { xp: 0, tier: 1, perk: null, distinctActions: [] },
  };
}

export function computeTierForXp(xp: number): 1 | 2 | 3 | 4 | 5 {
  if (xp >= TIER_XP_THRESHOLDS[5]) return 5;
  if (xp >= TIER_XP_THRESHOLDS[4]) return 4;
  if (xp >= TIER_XP_THRESHOLDS[3]) return 3;
  if (xp >= TIER_XP_THRESHOLDS[2]) return 2;
  return 1;
}

export function getNextTierXp(tier: 1 | 2 | 3 | 4 | 5): number | null {
  if (tier >= 5) return null;
  return TIER_XP_THRESHOLDS[(tier + 1) as 2 | 3 | 4 | 5];
}

/**
 * Pure discipline practice award:
 * Distinct useful outcomes grant full XP; trivial repeat of the same actionKey grants diminished XP (capped).
 */
export function awardDisciplinePractice(
  current: DisciplineProgress,
  actionKey: string,
  baseXp: number,
): {
  next: DisciplineProgress;
  gainedXp: number;
  promoted: boolean;
  newTier: 1 | 2 | 3 | 4 | 5;
  wasFirstTime: boolean;
} {
  const alreadyDone = current.distinctActions.includes(actionKey);
  const gainedXp = alreadyDone ? Math.max(4, Math.round(baseXp * 0.35)) : baseXp;
  const nextXp = current.xp + gainedXp;
  const newTier = computeTierForXp(nextXp);
  const promoted = newTier > current.tier;
  const distinctActions = alreadyDone
    ? current.distinctActions
    : [...current.distinctActions, actionKey];

  return {
    next: {
      ...current,
      xp: nextXp,
      tier: newTier,
      distinctActions,
    },
    gainedXp,
    promoted,
    newTier,
    wasFirstTime: !alreadyDone,
  };
}

export function selectDisciplinePerk(
  disciplines: Record<DisciplineId, DisciplineProgress>,
  disciplineId: DisciplineId,
  perkId: PerkId,
): { ok: boolean; reason?: string; next: Record<DisciplineId, DisciplineProgress> } {
  const prog = disciplines[disciplineId];
  if (!prog) return { ok: false, reason: 'Unknown discipline', next: disciplines };
  if (prog.tier < 3) {
    return { ok: false, reason: `Reach ${DISCIPLINES[disciplineId].name} Tier 3 (Specialist) first.`, next: disciplines };
  }
  const validPerk = DISCIPLINES[disciplineId].perks.some((p) => p.id === perkId);
  if (!validPerk) return { ok: false, reason: 'Invalid perk for discipline.', next: disciplines };

  return {
    ok: true,
    next: {
      ...disciplines,
      [disciplineId]: {
        ...prog,
        perk: perkId,
      },
    },
  };
}

export function hasPerk(
  disciplines: Record<DisciplineId, DisciplineProgress> | undefined,
  perkId: PerkId,
): boolean {
  if (!disciplines) return false;
  return Object.values(disciplines).some((d) => d.perk === perkId);
}

// Camp Cooking Recipes (with local substitutions + expected buffs + storage life)
export const COOKING_RECIPES: CookingRecipeDef[] = [
  {
    id: 'cook_perch_chowder',
    name: 'Ferryman’s Perch Chowder',
    desc: 'Warm Delta broth simmered with Spool Perch & a local aromatic. Satisfies Capt. Nix’s last-ferry supper!',
    accent: '#ffd166',
    primaryAny: ['spool_perch', 'mirror_minnow'],
    secondaryAny: ['fizz_berry', 'pop_toast', 'frost_broc', 'bell_reed'],
    outId: 'perch_chowder',
    mun: 46,
    vib: 36,
    wob: -12,
    buffLabel: 'Warm Walk (+12% Speed & Chill Comfort, 90s)',
    storageDays: 2,
  },
  {
    id: 'cook_mirror_tartare',
    name: 'Reflected Minnow Glaze',
    desc: 'Luminous Mirror Minnow dressed with Lens-Pear or Bell Reed. Boosts reflection sight & shares magnificently.',
    accent: '#72efdd',
    primaryAny: ['mirror_minnow'],
    secondaryAny: ['bell_reed', 'lens_pear', 'moon_petal', 'fizz_berry'],
    outId: 'mirror_tartare',
    mun: 38,
    vib: 48,
    wob: 8,
    buffLabel: 'Reflected Sight (+15% Speed & Calm Focus, 110s)',
    storageDays: 2,
  },
  {
    id: 'cook_eel_pickles',
    name: 'Jarred Receipt-Eel Relish',
    desc: 'Preserved travel ration that keeps for days in a pack or Frost Pantry.',
    accent: '#b388ff',
    primaryAny: ['receipt_eel', 'spool_perch'],
    secondaryAny: ['chrono_pickle', 'frost_broc', 'bell_reed'],
    outId: 'eel_relish',
    mun: 54,
    vib: 28,
    wob: -6,
    buffLabel: 'Long Haul Ration (Travel Endurance, 140s)',
    storageDays: 5,
    reqCookeryTier: 2,
  },
  {
    id: 'cook_grove_broth',
    name: 'Grove Kettle Broth',
    desc: 'Everyday warming supper made from local berries, toast, or broccoli—never requires rare drops.',
    accent: '#2ec4b6',
    primaryAny: ['fizz_berry', 'frost_broc'],
    secondaryAny: ['pop_toast', 'bell_reed', 'shroom'],
    outId: 'grove_broth',
    mun: 34,
    vib: 26,
    wob: -14,
    buffLabel: 'Cozy Hearth (+8% Speed, 60s)',
    storageDays: 2,
  },
];
