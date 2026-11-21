import { useEffect, useState } from 'react';
import { Radio, Sparkles, Volume2, X } from 'lucide-react';
import {
  BIOMES,
  CHARACTERS,
  CREATURE_DEFS,
  ITEMS,
  QUESTS,
  RECIPES,
  RESIDENTS,
  SKILLS,
  STYLES,
  TECHNIQUES,
} from '../game/data';
import {
  COOKING_RECIPES,
  CORE_DISCIPLINE_IDS,
  DISCIPLINES,
  getNextTierXp,
  TIER_NAMES,
} from '../game/disciplines';
import {
  canCraftRecipe,
  getDiscountedCost,
  getEffectiveRecipeCost,
  getQuestProgress,
  getSalvageRefund,
  hasIngredients,
  TRIP_SYNERGIES,
  TRIP_VISUAL_META,
} from '../game/rules';
import type { GameEngine } from '../game/engine';
import type {
  DifficultyMode,
  DisciplineId,
  FerryFollowUpChoice,
  HudSnapshot,
  ModalType,
  MoveStyleId,
  PeopleId,
  TechniqueId,
  TripId,
} from '../game/types';
import { AtlasModal } from './AtlasModal';
import { Dialog } from './Dialog';
import { FieldworkPanel } from './FieldworkPanel';

interface ModalsProps {
  engine: GameEngine | null;
  hud: HudSnapshot;
  modal: ModalType;
  payload: { creatureId?: string; residentId?: string; plotId?: string; buildingId?: string };
  onClose: () => void;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
  onSave: () => void;
}

const PEOPLE_LABELS: Record<PeopleId, string> = {
  creasefolk: 'Creasefolk',
  overprints: 'Overprints',
  belljacks: 'Belljacks',
  selvedge: 'Selvedge Folk',
  glazelings: 'Glazelings',
  brinebacks: 'Brinebacks',
  lampspun: 'Lampspun',
  sporesteppers: 'Sporesteppers',
  county_local: 'County Local',
};

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog label={title} className="fixed inset-0 z-40 flex items-center justify-center px-4 pb-4 pt-20 sm:pt-14 bg-[#0d0618]/78 outline-none">
      <div className="ink-panel w-full max-w-[640px] max-h-[min(85dvh,100%)] rounded-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-[#f7efde]/15 bg-[#160c24]/70">
          <div>
            <h2 className="font-display font-black text-xl text-[#ffd166] leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-[#f7efde]/75 mt-0.5">{subtitle}</p>}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="ink-button w-9 h-9 rounded-xl bg-[#ff5d8f] text-[#160c24] border-2 border-[#160c24] flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-5 h-5 stroke-[2.6]" />
            </button>
          )}
        </div>
        <div className="min-h-0 p-3 sm:p-5 overflow-y-auto overscroll-contain storybook-scroll">{children}</div>
      </div>
    </Dialog>
  );
}

function getResidentActionMeta(
  residentId: string,
  hud: HudSnapshot,
): { label: string; enabled: boolean; accent?: string } | null {
  const f = hud.worldFlags;
  if (residentId === 'miri') {
    if (!hud.techniques.includes('paper_fold_glide')) {
      return { label: 'Learn Paper-Fold Glide & Rooftop Route', enabled: true, accent: '#ffd166' };
    }
    return null;
  }
  if (residentId === 'nell') {
    return f.radioRepaired
      ? { label: 'Ride Groove Express to Mailbox Square', enabled: true, accent: '#ff5d8f' }
      : { label: 'Inspect Bent Tonearm & Repair Tower', enabled: true, accent: '#ffd166' };
  }
  if (residentId === 'oona' || residentId === 'inkling') {
    if (!f.deltaMuralSolved) {
      return { label: 'Propose Compromise Overprint Mural', enabled: true, accent: '#2ec4b6' };
    }
    return null;
  }
  if (residentId === 'nix') {
    if (!f.ferryRestored) {
      const hasPermit = (hud.inv.misfiled_permit || 0) > 0;
      return {
        label: hasPermit ? 'Deliver Triplicate Ferry Permit' : 'Needs Shore-Marked Permit from Drift',
        enabled: hasPermit,
        accent: '#2ec4b6',
      };
    }
    if (!f.ferryInsulated && (hud.inv.compost_insulation || 0) > 0) {
      return { label: 'Deliver Dot’s Warm Compost Insulation', enabled: true, accent: '#ffd166' };
    }
    return { label: 'Ride Public Records Ferry', enabled: true, accent: '#2ec4b6' };
  }
  if (residentId === 'pell') {
    if (f.orchardRipened && (!hud.techniques.includes('refracted_focus') || ((hud.inv.pear_lens || 0) === 0 && !f.radioRepaired))) {
      return { label: 'Claim Refracted Focus & Pear Lens', enabled: true, accent: '#72efdd' };
    }
    return null;
  }
  if (residentId === 'auntie_bias') {
    if (!f.socksHung) {
      const ready = f.sockHalfAFound && f.sockHalfBFound;
      return {
        label: ready ? 'Hang Giant Sock Clothesline' : 'Find Both Giant Sock Halves in Unpaired Sea',
        enabled: ready,
        accent: '#ffd166',
      };
    }
    return { label: 'Ride Giant Sock Clothesline to Cloud-9', enabled: true, accent: '#ffd166' };
  }
  if (residentId === 'dot_mulch') {
    if (!f.compostPostalAssigned) {
      return { label: 'Register Compost Postal #4B & Take Insulation', enabled: true, accent: '#a7c957' };
    }
    return null;
  }
  if (residentId === 'sol_shortwick' || residentId === 'flicker_shortwick') {
    return f.wickworksRestored
      ? { label: 'Take Lamp-Service Tunnel to Giggle-Grove', enabled: true, accent: '#b388ff' }
      : { label: 'Choose Ceremony for Last Unsent Message', enabled: true, accent: '#ff9f1c' };
  }
  return null;
}

export function Modals({
  engine,
  hud,
  modal,
  payload,
  onClose,
  onResume,
  onRestart,
  onTitle,
  onSave,
}: ModalsProps) {
  const [danceRadius, setDanceRadius] = useState(146);
  const [danceHits, setDanceHits] = useState(0);
  const [danceFeedback, setDanceFeedback] = useState('Tap GROOVE when the gold ring meets teal!');
  const [bagTab, setBagTab] = useState<'satchel' | 'herbarium' | 'journal'>('satchel');
  const [expIngA, setExpIngA] = useState<string>('');
  const [expIngB, setExpIngB] = useState<string>('');

  useEffect(() => {
    if (modal !== 'dance' || !engine) return;
    setDanceHits(engine.danceState?.hits || 0);
    setDanceFeedback(
      engine.danceState?.radioMode
        ? 'Lock DJ Moss’s 3-beat signal onto Radio Unmelted!'
        : 'Tap GROOVE when the gold ring meets teal!',
    );
    let raf = 0;
    const sync = () => {
      if (engine.danceState) {
        setDanceRadius(engine.danceState.radius);
      }
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, [modal, engine]);

  // PAUSE MODAL
  if (hud.mode === 'paused' && modal !== 'settings') {
    return (
      <ModalShell title="Adventure Paused" subtitle={`${CHARACTERS[hud.charId].name} · Day ${hud.day} · ${hud.biomeName}`}>
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-[#160c24]/85 border border-[#f7efde]/15 p-3 text-center">
            <div className="text-[11px] text-[#f7efde]/70 font-bold uppercase">Day</div>
            <div className="font-mono-num text-xl font-bold text-[#ffd166] mt-0.5">{hud.day}</div>
          </div>
          <div className="rounded-xl bg-[#160c24]/85 border border-[#f7efde]/15 p-3 text-center">
            <div className="text-[11px] text-[#f7efde]/70 font-bold uppercase">Techniques</div>
            <div className="font-mono-num text-xl font-bold text-[#ff85b3] mt-0.5">
              {hud.techniques.length}/8
            </div>
          </div>
          <div className="rounded-xl bg-[#160c24]/85 border border-[#f7efde]/15 p-3 text-center">
            <div className="text-[11px] text-[#f7efde]/70 font-bold uppercase">Transports</div>
            <div className="font-mono-num text-xl font-bold text-[#2ec4b6] mt-0.5">
              {hud.unlockedTransports.length}/4
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="ink-button w-full py-3 rounded-xl bg-[#ffd166] text-[#160c24] font-display font-black text-base border-2 border-[#160c24] cursor-pointer"
          >
            Resume Adventure
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onSave}
              className="ink-button py-2.5 rounded-xl bg-[#2ec4b6] text-[#160c24] font-bold text-sm border-2 border-[#160c24] cursor-pointer"
            >
              Save Progress
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="ink-button py-2.5 rounded-xl bg-[#2d1a4b] text-[#f7efde] font-bold text-sm border-2 border-[#f7efde]/30 cursor-pointer"
            >
              Restart Run
            </button>
          </div>
          <button
            type="button"
            onClick={() => engine?.setActiveModal('settings')}
            className="ink-button min-h-11 rounded-xl border border-[#f7efde]/35 bg-[#2d1a4b] text-sm font-bold text-[#f7efde] cursor-pointer"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="ink-button w-full py-2.5 rounded-xl bg-[#160c24] text-[#f7efde]/80 font-bold text-sm border border-[#f7efde]/20 cursor-pointer"
          >
            Return to Title
          </button>
        </div>
      </ModalShell>
    );
  }

  // MELT RECOVERY / GAME OVER MODAL
  if (hud.mode === 'gameover') {
    const diffCopy =
      hud.difficultyMode === 'relaxed'
        ? 'Relaxed mode: you wake warmly at Mailbox Square with 100% of your satchel intact (costs a brief afternoon nap).'
        : hud.difficultyMode === 'harsh'
          ? 'Harsh mode: you wake at next dawn in Mailbox Square. Learned recipes, journal, camp structures & friendships stay intact; 65% of loose forage waits in a Recoverable Satchel at the melt site.'
          : 'Standard mode: you wake safely at Mailbox Square. Learned recipes, journal, camp structures & friendships stay intact; half of loose forage waits in a Recoverable Satchel pinned on your compass.';
    return (
      <ModalShell title="You Melted!" subtitle={hud.deathReason || `Melted on Day ${hud.day}`}>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl bg-[#160c24]/85 border border-[#f7efde]/15 p-3 text-center">
            <div className="text-[11px] text-[#f7efde]/70 font-bold uppercase">Days</div>
            <div className="font-mono-num text-2xl font-bold text-[#ffd166] mt-0.5">{hud.day}</div>
          </div>
          <div className="rounded-xl bg-[#160c24]/85 border border-[#f7efde]/15 p-3 text-center">
            <div className="text-[11px] text-[#f7efde]/70 font-bold uppercase">Trips Taken</div>
            <div className="font-mono-num text-2xl font-bold text-[#ff5d8f] mt-0.5">{hud.stats.tripsTaken}</div>
          </div>
          <div className="rounded-xl bg-[#160c24]/85 border border-[#f7efde]/15 p-3 text-center">
            <div className="text-[11px] text-[#f7efde]/70 font-bold uppercase">Harvests</div>
            <div className="font-mono-num text-2xl font-bold text-[#2ec4b6] mt-0.5">{hud.stats.harvests}</div>
          </div>
        </div>
        <div className="rounded-xl bg-[#100621]/90 border border-[#ffd166]/45 p-3 mb-4 text-xs text-[#f7efde]/90 leading-relaxed">
          {diffCopy}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {engine && (
            <button
              type="button"
              data-testid="recover-melt-btn"
              onClick={() => engine.recoverFromMelt()}
              className="ink-button flex-1 py-3 px-4 rounded-xl bg-[#ffd166] text-[#160c24] font-display font-black text-sm sm:text-base border-2 border-[#160c24] cursor-pointer"
            >
              Wake at Giggle-Grove (Keep Progress)
            </button>
          )}
          <button
            type="button"
            data-start="true"
            onClick={onRestart}
            className="ink-button px-4 py-3 rounded-xl bg-[#ff5d8f] text-[#160c24] font-display font-black text-sm border-2 border-[#160c24] cursor-pointer"
          >
            Start Fresh Run
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="ink-button px-4 py-3 rounded-xl bg-[#2d1a4b] text-[#f7efde] font-bold text-sm border-2 border-[#f7efde]/25 cursor-pointer"
          >
            Title
          </button>
        </div>
      </ModalShell>
    );
  }

  if (!modal || !engine) return null;

  // INTERACTIVE COUNTY ATLAS
  if (modal === 'atlas') {
    return <AtlasModal engine={engine} hud={hud} onClose={onClose} />;
  }

  if (modal === 'fieldwork') {
    return (
      <ModalShell title="Camp Ledger" onClose={onClose}>
        <FieldworkPanel hud={hud} engine={engine} />
      </ModalShell>
    );
  }

  // AUDIO, COMFORT & DIFFICULTY SETTINGS MODAL
  if (modal === 'settings') {
    const a = hud.audioSettings;
    const titleSettings = hud.mode === 'title';
    const previewMuted = a.muted || a.master === 0 || a.effects === 0;
    const difficulties: { id: DifficultyMode; label: string; note: string }[] = [
      { id: 'relaxed', label: 'Relaxed', note: 'Gentler tension & calmer nights' },
      { id: 'standard', label: 'Standard', note: 'Balanced county survival' },
      { id: 'harsh', label: 'Harsh', note: 'Faster drain & lively fish' },
    ];
    return (
      <ModalShell
        title={titleSettings ? 'Audio & Comfort' : 'Audio, Comfort & Difficulty'}
        onClose={onClose}
      >
        <div className="flex flex-col gap-3.5">
          {[
            { key: 'master' as const, label: 'Master Volume', value: a.master, accent: '#f7efde' },
            { key: 'music' as const, label: 'Regional Music', value: a.music, accent: '#ff5d8f' },
            { key: 'ambience' as const, label: 'County Ambience', value: a.ambience, accent: '#2ec4b6' },
            { key: 'effects' as const, label: 'Boops & Chimes', value: a.effects, accent: '#ffd166' },
            { key: 'perceptionIntensity' as const, label: 'Perception Intensity', value: a.perceptionIntensity, accent: '#b388ff' },
          ].map((row) => (
            <label key={row.key} className="flex flex-col gap-1.5 rounded-xl bg-[#160c24]/90 border border-[#f7efde]/15 p-3">
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className="inline-flex items-center gap-1.5 text-[#fffdf7]">
                  <Volume2 className="w-3.5 h-3.5" style={{ color: row.accent }} />
                  {row.label}
                </span>
                <span className="font-mono-num text-[#ffd166]">{Math.round(row.value * 100)}%</span>
              </div>
              <input
                type="range"
                aria-label={row.label}
                min={0}
                max={100}
                value={Math.round(row.value * 100)}
                onChange={(e) => engine.updateAudioSettings({ [row.key]: Number(e.target.value) / 100 })}
                className="min-h-11 w-full accent-[#ffd166] cursor-pointer"
              />
            </label>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => engine.toggleMute()}
              aria-pressed={hud.muted}
              className={`ink-button min-h-11 px-3 rounded-xl font-extrabold text-xs border-2 border-[#160c24] cursor-pointer ${
                hud.muted ? 'bg-[#ff5d8f] text-[#160c24]' : 'bg-[#2d1a4b] text-[#f7efde]'
              }`}
            >
              {hud.muted ? 'Unmute Audio' : 'Mute All Audio'}
            </button>

            <label className="flex items-center justify-between gap-2 rounded-xl border border-[#f7efde]/30 bg-[#160c24] px-3 text-xs font-bold text-[#f7efde]">
              Reduced Motion
              <select
                value={hud.reducedMotionOverride === null ? 'system' : hud.reducedMotionOverride ? 'on' : 'off'}
                onChange={(event) => engine.setReducedMotion(event.target.value === 'system' ? null : event.target.value === 'on')}
                className="min-h-11 cursor-pointer bg-[#160c24] text-[#f7efde]"
              >
                <option value="system">System</option>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => engine.updateAudioSettings({ flashFree: !a.flashFree })}
              aria-pressed={a.flashFree}
              className={`ink-button min-h-11 px-3 rounded-xl font-extrabold text-xs border-2 border-[#160c24] cursor-pointer ${
                a.flashFree ? 'bg-[#ffd166] text-[#160c24]' : 'bg-[#2d1a4b] text-[#f7efde]'
              }`}
            >
              {a.flashFree ? 'Flash-Free Optics: ON' : 'Flash-Free Optics: OFF'}
            </button>

            <button
              type="button"
              onClick={() => engine.updateAudioSettings({ visualSoundCues: !a.visualSoundCues })}
              aria-pressed={a.visualSoundCues}
              className={`ink-button min-h-11 px-3 rounded-xl font-extrabold text-xs border-2 border-[#160c24] cursor-pointer ${
                a.visualSoundCues ? 'bg-[#72efdd] text-[#160c24]' : 'bg-[#2d1a4b] text-[#f7efde]'
              }`}
            >
              Visual Sound Cues · {a.visualSoundCues ? 'On' : a.muted || a.master === 0 ? 'Auto (muted)' : 'Off'}
            </button>

            <button
              type="button"
              data-testid="toggle-stable-camera"
              onClick={() => engine.updateAudioSettings({ stableCamera: !a.stableCamera })}
              aria-pressed={a.stableCamera}
              className={`ink-button min-h-11 px-3 rounded-xl font-extrabold text-xs border-2 border-[#160c24] cursor-pointer ${
                a.stableCamera ? 'bg-[#a8ff3e] text-[#160c24]' : 'bg-[#2d1a4b] text-[#f7efde]'
              }`}
            >
              {a.stableCamera ? 'Stable Camera: ON' : 'Stable Camera: OFF'}
            </button>

            {!titleSettings && <button
              type="button"
              onClick={() => engine.toggleFishingAssist()}
              aria-pressed={hud.fishing.toggleAssist}
              className={`ink-button min-h-11 px-3 rounded-xl font-extrabold text-xs border-2 border-[#160c24] cursor-pointer ${
                hud.fishing.toggleAssist ? 'bg-[#72efdd] text-[#160c24]' : 'bg-[#2d1a4b] text-[#f7efde]'
              }`}
            >
              {hud.fishing.toggleAssist ? 'Fishing Toggle Assist: ON' : 'Fishing Toggle Assist: OFF'}
            </button>}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[#f7efde]/15 pt-3">
            <button type="button" onClick={() => engine.restoreDefaultEffects()}
              className="ink-button min-h-11 rounded-xl bg-[#ffd166] px-3 text-xs font-extrabold text-[#160c24] cursor-pointer">
              Restore Audio &amp; Visual Effects
            </button>
            <button type="button" onClick={() => engine.previewSoundEffects()} disabled={previewMuted}
              className="ink-button min-h-11 rounded-xl border border-[#72efdd] bg-[#160c24] px-3 text-xs font-extrabold text-[#72efdd] enabled:cursor-pointer disabled:opacity-45">
              Test Sound Effects
            </button>
            {a.perceptionIntensity === 0 && <p className="text-xs font-bold text-[#ffd166]">Perception effects are off.</p>}
          </div>

          {!titleSettings && <div className="rounded-xl bg-[#160c24]/90 border border-[#f7efde]/15 p-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#ffd166] mb-2">
              Survival Difficulty
            </div>
            <div className="grid grid-cols-3 gap-2">
              {difficulties.map((d) => {
                const active = hud.difficultyMode === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => engine.setDifficulty(d.id)}
                    className={`ink-button py-2 px-2 rounded-xl text-left border-2 cursor-pointer ${
                      active
                        ? 'bg-[#ffd166] text-[#160c24] border-[#160c24]'
                        : 'bg-[#100621] text-[#f7efde] border-[#f7efde]/20'
                    }`}
                  >
                    <div className="font-display font-black text-xs">{d.label}</div>
                    <div className={`text-[10px] mt-0.5 leading-tight ${active ? 'text-[#160c24]/80' : 'text-[#f7efde]/65'}`}>
                      {d.note}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>}

          <p className="text-[11px] text-[#f7efde]/85">
            Fishing prompts and timing cues stay visible at 0% perception intensity. Sound captions turn on automatically for muted channels.
          </p>
        </div>
      </ModalShell>
    );
  }

  // PASS 1: MAILBOX SQUARE DAMP NOTE MODAL (Dinner for the Last Ferry)
  if (modal === 'ferry_note') {
    const f = hud.worldFlags;
    const isRestored = f.ferryRestored;
    const accepted = f.ferrySupperStage !== 'unstarted';
    const served = f.ferrySupperServedDay > 0;
    const cs = hud.campSupperStatus;
    return (
      <ModalShell
        title="Damp Note on Mailbox Square"
        subtitle="Ink-blotted ferry stationery clipped to the Giggle-Grove notice board."
        onClose={onClose}
      >
        <div className="flex flex-col gap-3.5">
          <div className="rounded-xl bg-[#160c24]/92 border-2 border-[#72efdd] p-4 flex flex-col gap-2">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#72efdd]">
              {isRestored ? 'Late-Shift Service Request · Capt. Nix' : 'Shoreline Supper Rumor · Capt. Nix'}
            </div>
            <p className="text-sm text-[#fffdf7] leading-relaxed italic">
              {isRestored
                ? '“To whichever neighbor has a warm pot in Giggle-Grove: the Public Records Ferry is running late tonight, and my thermos cracked on the second crossing. If you pull a Spool Perch from the Delta Public Bank and simmer Perch Chowder at a lit camp table with a bench, I will pull ashore and eat before the last horn.”'
                : '“Shoreline notice from Capt. Nix (Public Records Ferry, currently dry-docked while my triplicate permit drifts): I am still camped on the Carbon Copy Delta Public Bank. Loaner reed rod is free on the piling—move the dock lamp between pools if you want to spot a Mirror Minnow. Cook a warm pot of Ferryman’s Perch Chowder back at your Giggle-Grove camp (Table + Bench + Lamp) and I will walk up for supper—and share word on reopening the ferry.”'}
            </p>
            <div className="text-xs text-[#ffd166] font-semibold mt-1">
              • Loaner Reed Rod at Delta Public Bank works immediately (0 bait required, no crafted lamp needed).
              <br />• Accepting pins Delta Public Bank on your compass &amp; gives 1 Bell Reed Rhizome + 2 Fizz-Berries.
            </div>
          </div>

          <div className="rounded-xl bg-[#100621]/90 border border-[#f7efde]/15 p-3 text-xs text-[#f7efde]/85 flex flex-col gap-1">
            <div className="font-extrabold text-[#ffd166]">Supper Checklist ({served ? 'Served!' : accepted ? 'In Progress' : 'New Request'})</div>
            <div>• Camp Table placed: {cs.hasTable ? '✓ Ready' : 'Not yet (Craft in C)'}</div>
            <div>• Bench beside Table: {cs.hasBenchNearTable ? '✓ Ready' : 'Not yet (Craft in C)'}</div>
            <div>• Lamp lighting Table: {cs.hasLampNearTable ? '✓ Ready' : 'Not yet (Lava Lamp or Dock Lamp)'}</div>
            <div>• Hot Supper cooked: {cs.hasCookedSupper ? '✓ Ready' : 'Not yet (Cook at Camp Table)'}</div>
          </div>

          {served ? (
            <div className="text-xs font-extrabold text-[#2ec4b6]">
              Capt. Nix has already been served! Rest until Next Dusk at your Camp Table to host his return visit.
            </div>
          ) : (
            <button
              type="button"
              data-testid="accept-ferry-note-btn"
              onClick={() => engine.acceptFerryNote()}
              className="ink-button py-3 px-4 rounded-xl bg-[#ffd166] text-[#160c24] font-display font-black text-sm border-2 border-[#160c24] cursor-pointer"
            >
              {accepted ? 'Re-Pin Delta Public Bank on Compass' : 'Accept Request & Pin Delta Public Bank'}
            </button>
          )}
        </div>
      </ModalShell>
    );
  }

  // PASS 1: CAMP TABLE KITCHEN & SUPPER SERVICE MODAL
  if (modal === 'cook') {
    const f = hud.worldFlags;
    const cs = hud.campSupperStatus;
    const served = f.ferrySupperServedDay > 0;
    const visited = hud.ferryEveningActive;
    const cookableKeys = Object.keys(hud.inv).filter(
      (k) => (hud.inv[k] || 0) > 0 && ITEMS[k] && ['food', 'mat', 'sub'].includes(ITEMS[k].cat),
    );
    const selA = expIngA && (hud.inv[expIngA] || 0) > 0 ? expIngA : cookableKeys[0] || '';
    const selB =
      expIngB && (hud.inv[expIngB] || 0) > 0
        ? expIngB
        : cookableKeys.find((k) => k !== selA || (hud.inv[k] || 0) >= 2) || selA;

    return (
      <ModalShell
        title="Camp Kitchen & Supper Table"
        subtitle="Simmer regional meals with local substitutes, test experimental pots, or serve Capt. Nix."
        onClose={onClose}
      >
        <div className="flex flex-col gap-4">
          {/* Capt. Nix Supper Service Card */}
          <div className="rounded-xl bg-[#160c24]/92 border-2 border-[#ffd166] p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="font-display font-black text-sm text-[#ffd166]">
                Dinner for the Last Ferry · Capt. Nix
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#100621] text-[#2ec4b6]">
                {visited ? 'Visited!' : served ? 'Awaiting Next Dusk' : cs.readyToServe ? 'Ready to Serve!' : 'Prep Camp'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-bold">
              <span className={cs.hasTable ? 'text-[#2ec4b6]' : 'text-[#f7efde]/55'}>{cs.hasTable ? '✓' : '○'} Table</span>
              <span className={cs.hasBenchNearTable ? 'text-[#2ec4b6]' : 'text-[#f7efde]/55'}>{cs.hasBenchNearTable ? '✓' : '○'} Bench</span>
              <span className={cs.hasLampNearTable ? 'text-[#2ec4b6]' : 'text-[#f7efde]/55'}>{cs.hasLampNearTable ? '✓' : '○'} Lamp</span>
              <span className={cs.hasCookedSupper ? 'text-[#2ec4b6]' : 'text-[#f7efde]/55'}>{cs.hasCookedSupper ? '✓' : '○'} Hot Dish</span>
            </div>

            {!served ? (
              <button
                type="button"
                data-testid="serve-nix-supper-btn"
                disabled={!cs.readyToServe}
                onClick={() => engine.serveNixSupper()}
                className="ink-button py-2.5 px-4 rounded-xl bg-[#ffd166] text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {cs.readyToServe ? 'Ring Supper Bell & Serve Capt. Nix' : 'Finish Table + Bench + Lamp + Hot Dish'}
              </button>
            ) : !visited ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  data-testid="rest-until-dusk-btn"
                  onClick={() => engine.restUntilNextDusk()}
                  className="ink-button flex-1 py-2.5 px-4 rounded-xl bg-[#2ec4b6] text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer"
                >
                  Rest Until Next Dusk (Host Capt. Nix)
                </button>
                {!f.ferrySupperFollowUp && (
                  <button
                    type="button"
                    onClick={() => engine.setActiveModal('followup_choice')}
                    className="ink-button py-2.5 px-3 rounded-xl bg-[#ff5d8f] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer"
                  >
                    Pick Follow-Up
                  </button>
                )}
              </div>
            ) : (
              <div className="text-xs font-bold text-[#72efdd]">
                Capt. Nix visited your table, left a second place setting, and sounded his two-note horn on the river!
              </div>
            )}
          </div>

          {/* Authored Recipes with Local Substitutes */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#2ec4b6] mb-2">
              Camp Recipes (Local Substitutes Supported)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {COOKING_RECIPES.map((rec) => {
                const foundPrim = rec.primaryAny.find((id) => (hud.inv[id] || 0) >= 1);
                const foundSec = rec.secondaryAny.find(
                  (id) => (hud.inv[id] || 0) >= (id === foundPrim ? 2 : 1),
                );
                const cookTier = hud.disciplines.cookery?.tier || 1;
                const tierOk = !rec.reqCookeryTier || cookTier >= rec.reqCookeryTier;
                const canCook = Boolean(foundPrim && foundSec && tierOk);
                return (
                  <div
                    key={rec.id}
                    className="rounded-xl bg-[#160c24]/90 border-2 border-[#2ec4b6]/75 p-3 flex flex-col gap-1.5"
                  >
                    <div className="font-display font-extrabold text-sm text-[#ffd166]">{rec.name}</div>
                    <p className="text-[11px] text-[#f7efde]/80 leading-snug">{rec.desc}</p>
                    <div className="text-[10.5px] font-bold text-[#72efdd]">
                      {rec.buffLabel} · Keeps {rec.storageDays}d
                    </div>
                    <div className="flex flex-col gap-0.5 text-[10px] text-[#f7efde]/75">
                      <div className={foundPrim ? 'text-[#a8ff3e]' : 'text-[#ff85b3]'}>
                        {foundPrim ? '✓' : '×'} Primary: {rec.primaryAny.map((id) => ITEMS[id]?.name || id).join(' / ')}
                      </div>
                      <div className={foundSec ? 'text-[#a8ff3e]' : 'text-[#ff85b3]'}>
                        {foundSec ? '✓' : '×'} Local Sub: {rec.secondaryAny.map((id) => ITEMS[id]?.name || id).join(' / ')}
                      </div>
                      {rec.reqCookeryTier && !tierOk && (
                        <div className="text-[#b388ff]">
                          Requires Cookery Tier {rec.reqCookeryTier} ({TIER_NAMES[rec.reqCookeryTier as 1 | 2 | 3 | 4 | 5]})
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      data-testid={`cook-recipe-${rec.id}`}
                      disabled={!canCook}
                      onClick={() => engine.cookRecipe(rec.id)}
                      className="ink-button mt-auto py-1.5 px-3 rounded-lg bg-[#2ec4b6] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {!tierOk ? `Cookery T${rec.reqCookeryTier} Needed` : canCook ? 'Cook Pot' : 'Missing Ingredient'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Experimental Pot */}
          <div className="rounded-xl bg-[#100621]/90 border border-[#b388ff]/50 p-3 flex flex-col gap-2">
            <div className="text-xs font-extrabold text-[#b388ff]">
              Experimental Camp Skillet (Any 2 Ingredients → Edible Camp Leftovers + Tip)
            </div>
            {cookableKeys.length === 0 ? (
              <div className="text-xs text-[#f7efde]/65">Forage berries, shrooms, reeds, or fish to toss into the pot.</div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="First experimental ingredient"
                  value={selA}
                  onChange={(e) => setExpIngA(e.target.value)}
                  className="flex-1 min-w-[120px] rounded-lg bg-[#160c24] border border-[#f7efde]/30 px-2 py-1.5 text-xs text-[#fffdf7]"
                >
                  {cookableKeys.map((k) => (
                    <option key={k} value={k}>
                      {ITEMS[k].name} (x{hud.inv[k]})
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Second experimental ingredient"
                  value={selB}
                  onChange={(e) => setExpIngB(e.target.value)}
                  className="flex-1 min-w-[120px] rounded-lg bg-[#160c24] border border-[#f7efde]/30 px-2 py-1.5 text-xs text-[#fffdf7]"
                >
                  {cookableKeys.map((k) => (
                    <option key={k} value={k}>
                      {ITEMS[k].name} (x{hud.inv[k]})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selA || !selB || (selA === selB && (hud.inv[selA] || 0) < 2)}
                  onClick={() => engine.cookExperimental(selA, selB)}
                  className="ink-button py-1.5 px-3 rounded-lg bg-[#b388ff] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer disabled:opacity-40"
                >
                  Simmer Pair
                </button>
              </div>
            )}
          </div>
        </div>
      </ModalShell>
    );
  }

  // PASS 1: 3-WAY FERRY FOLLOW-UP CHOICE MODAL
  if (modal === 'followup_choice') {
    const choices: { id: FerryFollowUpChoice; title: string; reward: string; desc: string; accent: string }[] = [
      {
        id: 'lure_reflected',
        title: 'Chase the Reflected Minnow',
        reward: '+1 Bell-Reed Lure · +1 Pear Lens · +Angling XP',
        desc: 'Ask Capt. Nix about the Mirror Minnow’s lamp-tracking habit and pin the Delta Bank for a prism-scale expedition.',
        accent: '#72efdd',
      },
      {
        id: 'bait_garden',
        title: 'Grow a Riverbank Bait Garden',
        reward: '+2 Bell Reed Rhizomes · +4 Fizz-Berries · +Farming XP',
        desc: 'Trade soup spices for hardy reed cuttings so Giggle-Grove Mood Soil yields steady aromatics & bait.',
        accent: '#a8ff3e',
      },
      {
        id: 'comfort_stop',
        title: 'Keep a Standing Supper Stop',
        reward: '+25 Bottlecaps · +2 Rubber Timber · +Building XP',
        desc: 'Mark your Giggle-Grove table as an official late-shift layover for ferry crews and wandering neighbors.',
        accent: '#ffd166',
      },
    ];
    return (
      <ModalShell
        title="Capt. Nix’s Supper Promise"
        subtitle="Choose how you want to follow up before Capt. Nix’s next-evening visit at your camp table."
        onClose={onClose}
      >
        <div className="grid grid-cols-1 gap-3">
          {choices.map((ch) => (
            <div
              key={ch.id}
              className="rounded-xl bg-[#160c24]/92 border-2 p-3.5 flex flex-col gap-1.5"
              style={{ borderColor: ch.accent }}
            >
              <div className="font-display font-black text-base" style={{ color: ch.accent }}>
                {ch.title}
              </div>
              <p className="text-xs text-[#f7efde]/85">{ch.desc}</p>
              <div className="text-[11px] font-bold text-[#ffd166]">{ch.reward}</div>
              <button
                type="button"
                data-testid={`followup-${ch.id}`}
                onClick={() => engine.chooseFerryFollowUp(ch.id)}
                className="ink-button mt-1 py-2 px-4 rounded-xl text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer"
                style={{ backgroundColor: ch.accent }}
              >
                Commit to This Path
              </button>
            </div>
          ))}
        </div>
      </ModalShell>
    );
  }

  // PASS 1: CAMP FURNITURE MANAGEMENT MODAL (Place / Move / Rotate / Salvage / Use)
  if (modal === 'camp_manage' && payload.buildingId) {
    const b = engine.state.buildings.find((x) => x.id === payload.buildingId);
    if (!b) return null;
    const matchRecipe = RECIPES.find((r) => r.id === b.type);
    const refund = matchRecipe ? getSalvageRefund(matchRecipe, hud.disciplines) : { rubber_wood: 1 };
    const refundStr = Object.entries(refund)
      .map(([k, v]) => `${v} ${ITEMS[k]?.name || k}`)
      .join(' · ');
    const titles: Record<string, string> = {
      camp_table: 'Camp Supper Table',
      bench: 'Wooden Camp Bench',
      dock_lamp: 'Movable Dock Lamp',
      rain_trough: 'Rain Catchment Trough',
      workbench: 'Tinker’s Workbench',
      frost_pantry: 'Frost Pantry Chest',
      choir_irrigator: 'Choir Irrigator',
      camp_awning: 'Canvas Camp Awning',
      camp_relay: 'Camp Relay',
      specimen_cabinet: 'Field Specimen Cabinet',
      lava_lamp: 'Lava Lamp Sanctuary',
    };

    return (
      <ModalShell
        title={titles[b.type] || 'Camp Fixture'}
        subtitle={`Facing ${(b.rotation || 0) * 90}° · Rearrange, rotate, or salvage cleanly without losing quest progress.`}
        onClose={onClose}
      >
        <div className="flex flex-col gap-3">
          {/* Simple, Explainable Camp Shelter Status */}
          <div
            data-testid="camp-shelter-status"
            className={`rounded-xl border px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 ${
              hud.campShelter.sheltered
                ? 'bg-[#102622] border-[#2ec4b6] text-[#72efdd]'
                : 'bg-[#160c24]/90 border-[#f7efde]/20 text-[#f7efde]/80'
            }`}
          >
            <span className="font-extrabold uppercase tracking-wider text-[10.5px]">
              {hud.campShelter.sheltered ? '★ Sheltered Camp' : 'Open Sky Camp'}
            </span>
            <span className="text-[11px]">{hud.campShelter.reason}</span>
          </div>

          {b.type === 'camp_table' && (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                data-testid="open-camp-kitchen-btn"
                onClick={() => engine.setActiveModal('cook')}
                className="ink-button flex-1 py-2.5 px-4 rounded-xl bg-[#ffd166] text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer"
              >
                Open Camp Kitchen &amp; Serve Supper
              </button>
              {hud.worldFlags.ferrySupperServedDay > 0 && !hud.ferryEveningActive && (
                <button
                  type="button"
                  data-testid="manage-rest-dusk-btn"
                  onClick={() => engine.restUntilNextDusk()}
                  className="ink-button py-2.5 px-4 rounded-xl bg-[#2ec4b6] text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer"
                >
                  Rest Until Next Dusk
                </button>
              )}
            </div>
          )}

          {b.type === 'bench' && (
            <button
              type="button"
              onClick={() => engine.restUntilNextDusk()}
              className="ink-button py-2.5 px-4 rounded-xl bg-[#2ec4b6] text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer"
            >
              Sit &amp; Rest Until Next Dusk
            </button>
          )}

          {b.type === 'workbench' && (
            <button
              type="button"
              onClick={() => engine.setActiveModal('craft')}
              className="ink-button py-2.5 px-4 rounded-xl bg-[#ff5d8f] text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer"
            >
              Open Workbench Crafting
            </button>
          )}

          {b.type === 'specimen_cabinet' && (
            <button
              type="button"
              onClick={() => {
                setBagTab('journal');
                engine.setActiveModal('bag');
              }}
              className="ink-button py-2.5 px-4 rounded-xl bg-[#a8ff3e] text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer"
            >
              Inspect {hud.journalSketches.length} Field Journal Sketches
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              data-testid="move-building-btn"
              onClick={() => engine.startMoveBuilding(b.id)}
              className="ink-button py-2.5 px-3 rounded-xl bg-[#72efdd] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer"
            >
              Move Furniture
            </button>
            <button
              type="button"
              data-testid="rotate-building-btn"
              onClick={() => engine.rotateBuilding(b.id)}
              className="ink-button py-2.5 px-3 rounded-xl bg-[#b388ff] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer"
            >
              Rotate 90° ({((b.rotation || 0) * 90 + 90) % 360}°)
            </button>
            <button
              type="button"
              data-testid="salvage-building-btn"
              onClick={() => engine.salvageBuilding(b.id)}
              className="ink-button py-2.5 px-3 rounded-xl bg-[#ff5d8f] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer"
            >
              Salvage
            </button>
          </div>
          {refundStr && (
            <div className="text-[11px] text-[#f7efde]/75">
              Salvaging returns: <span className="text-[#ffd166] font-bold">{refundStr}</span>
            </div>
          )}
        </div>
      </ModalShell>
    );
  }

  // RADIO UNMELTED TOWER REPAIR MODAL
  if (modal === 'radio_repair') {
    const ch = CHARACTERS[hud.charId];
    const hasStylus = (hud.inv.radio_stylus || 0) > 0;
    const leadRouteCopy: Record<typeof hud.charId, { title: string; desc: string }> = {
      pip: {
        title: 'Pip’s Pneumatic Mail-Tube Splint',
        desc: 'Bridge Nell’s bent tonearm with a pressurized parcel tube so every county mailbox rings on schedule.',
      },
      barnaby: {
        title: 'Barnaby’s Chamomile Steam Re-Seat',
        desc: 'Gently steam the warped brass tonearm back into alignment without cracking the vintage shellac.',
      },
      djmoss: {
        title: 'DJ Moss’s Live Frog-Bass Relay Jam',
        desc: 'Step onto the console and match a 3-beat groove live to make your own custom rhythm the new signal.',
      },
      gerald: {
        title: 'Gerald’s Form 1040-R Tower Unseal',
        desc: 'Stamp the overdue broadcast variance and rediscover Gerald’s dusty county jazz license in the desk drawer.',
      },
      tilda: {
        title: 'Tilda’s Pleated Brass-Foil Truss',
        desc: 'Fold a razor-true origami span beneath the bent tonearm so the vinyl vibration never drifts off-axis.',
      },
      brin: {
        title: 'Brin’s Braided Bobbin Counterweight',
        desc: 'Rig a balanced line-and-spool tensioner that keeps Nell’s stylus tracking smoothly across every groove.',
      },
      solfa: {
        title: 'Solfa’s Warm Tallow Wax Solder',
        desc: 'Set the loose brass needle mount with a glowing drop of Wickwater tallow so it holds steady through the night.',
      },
      marlo: {
        title: 'Marlo’s Waterproof Tide-Ink Shim',
        desc: 'Slide a crisp ink-pressed paper wedge beneath the tonearm hinge to keep the channel level in damp air.',
      },
      bea: {
        title: 'Bea’s Cavern Fifth Harmonic Calibration',
        desc: 'Strike the antenna mast to match Undertone Caverns’ natural pitch so the missing third note rings effortless.',
      },
      gus: {
        title: 'Gus’s Frost-Rated Vacuum Gasket Swap',
        desc: 'Pop a fresh flexible seal onto the frozen broadcast relay valve with one seasoned wrench twist.',
      },
      nori: {
        title: 'Nori’s Split-Sunbeam Prism Needle',
        desc: 'Clip a miniature orchard prism onto the stylus arm to read micro-grooves with pure refracted light.',
      },
      mossie: {
        title: 'Mossie’s Buoyant Reed Platter Leveler',
        desc: 'Float the warped turntable base on springy river reeds so every revolution spins true.',
      },
    };
    const leadOption = leadRouteCopy[hud.charId];

    return (
      <ModalShell
        title="Radio Unmelted Broadcast Tower"
        subtitle={
          hud.worldFlags.radioRepaired
            ? 'Signal restored! All three notes are singing across the county.'
            : 'Nell Backbeat’s bent tonearm needs either your Wanderer’s signature fix or a Prism Orchard Pear-Lens Stylus.'
        }
        onClose={onClose}
      >
        {hud.worldFlags.radioRepaired ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-[#160c24]/90 border-2 border-[#2ec4b6] p-4 text-sm text-[#f7efde]">
              <div className="font-display font-extrabold text-[#ffd166] inline-flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#ff5d8f]" /> Broadcast Live!
              </div>
              <p className="mt-1 text-xs text-[#f7efde]/85">
                Step onto the Groove Express turntable to glide straight home to Giggle-Grove Mailbox Square and hear your name on the radio.
              </p>
            </div>
            <button
              type="button"
              onClick={() => engine.rideTransport('groove_express')}
              className="ink-button py-3 px-4 rounded-xl bg-[#ff5d8f] text-[#160c24] font-display font-black text-sm border-2 border-[#160c24] cursor-pointer"
            >
              Ride Groove Express to Mailbox Square
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl bg-[#160c24]/90 border-2 border-[#ffd166] p-4 flex flex-col gap-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#2ec4b6]">
                {ch.name} Signature Route
              </div>
              <div className="font-display font-extrabold text-base text-[#ffd166]">{leadOption.title}</div>
              <p className="text-xs text-[#f7efde]/82">{leadOption.desc}</p>
              <button
                type="button"
                onClick={() => engine.resolveRadioRepair(hud.charId)}
                className="ink-button mt-1 py-2.5 px-4 rounded-xl bg-[#ffd166] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer"
              >
                Use {ch.name}’s Method
              </button>
            </div>

            <div className="rounded-xl bg-[#160c24]/90 border-2 border-[#72efdd]/70 p-4 flex flex-col gap-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#72efdd]">
                Cross-County Craft Route (Any Wanderer)
              </div>
              <div className="font-display font-extrabold text-base text-[#fffdf7]">Seat Pear-Lens Stylus</div>
              <p className="text-xs text-[#f7efde]/80">
                Crafted from a Rejected Pear Lens (Prism Orchard) + Cosmic Crystal at any Funk-Blender.
              </p>
              <button
                type="button"
                disabled={!hasStylus}
                onClick={() => engine.resolveRadioRepair('public')}
                className="ink-button mt-1 py-2.5 px-4 rounded-xl bg-[#72efdd] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {hasStylus ? 'Seat Pear-Lens Stylus' : 'Needs Pear-Lens Stylus in Satchel'}
              </button>
            </div>
          </div>
        )}
      </ModalShell>
    );
  }

  // PASS 3: ALL-NIGHT COUNTY BROADCAST FINALE & 4-SHADE GB RADIO TUNER
  if (modal === 'all_night_broadcast') {
    const sync = hud.countySync;
    const ch = CHARACTERS[hud.charId];
    const stationIdx = hud.worldFlags.broadcastStationIndex || 0;
    const hosted = hud.worldFlags.allNightBroadcastHosted;
    const stations = [
      { freq: '88.1', name: 'Grove FM', desc: 'Mailbox Square brass swing & ferry bulletins' },
      { freq: '94.5', name: 'Delta Ink', desc: 'Carbon Copy press rhythms & river calls' },
      { freq: '101.3', name: 'Undertone', desc: 'Moth Choir fifths from the western caverns' },
      { freq: '107.9', name: 'Allotments', desc: 'Windlift chimes & skyward garden folk' },
    ];
    const syncPct = Math.round((sync.restoredCount / Math.max(1, sync.totalRestorations)) * 100);
    const barHeights = [
      [18, 28, 22, 34, 24, 30, 16, 26],
      [26, 16, 32, 20, 34, 22, 28, 18],
      [14, 24, 34, 30, 26, 34, 22, 16],
      [30, 22, 18, 28, 34, 20, 32, 24],
    ][stationIdx];

    return (
      <ModalShell
        title="All-Night County Broadcast"
        subtitle={`${ch.name} at the Mailbox Square Console · County Sync ${sync.restoredCount}/${sync.totalRestorations} (${syncPct}%)`}
        onClose={onClose}
      >
        <div className="flex flex-col gap-2.5" data-testid="all-night-broadcast-modal">
          {/* Authentic 4-Shade Handheld Phosphor Radio Tuner SVG */}
          <div className="rounded-xl bg-[#100621] border-2 border-[#8bac0f] p-2.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
              <span className="inline-flex items-center gap-1.5 text-[#9bbc0f] truncate">
                <Radio className="w-4 h-4 shrink-0" />
                POCKET TUNER MK-IV · {stations[stationIdx].freq} MHz ({stations[stationIdx].name})
              </span>
              <span
                className={`font-mono-num text-[10px] px-2 py-0.5 rounded font-black shrink-0 ${
                  hosted ? 'bg-[#9bbc0f] text-[#0f380f]' : 'bg-[#306230] text-[#9bbc0f]'
                }`}
              >
                {hosted ? 'ON AIR ★' : sync.readyForBroadcast ? 'SIGNAL READY' : 'STANDBY'}
              </span>
            </div>

            <svg
              viewBox="0 0 420 94"
              className="w-full h-auto max-h-[138px] rounded-lg border-2 border-[#0f380f] block"
              role="img"
              aria-label={`4-shade retro radio tuner set to ${stations[stationIdx].freq} MHz ${stations[stationIdx].name}`}
            >
              {/* Shade 4 (Lightest LCD background) */}
              <rect x="0" y="0" width="420" height="94" fill="#9bbc0f" />
              {/* Shade 3 (Mid-light screen bezel & grid) */}
              <rect x="6" y="6" width="408" height="82" rx="4" fill="#8bac0f" stroke="#0f380f" strokeWidth="3" />
              {/* Dial track */}
              <rect x="20" y="23" width="380" height="20" rx="3" fill="#9bbc0f" stroke="#306230" strokeWidth="2" />
              {/* Station tick marks */}
              {[0, 1, 2, 3].map((i) => {
                const tx = 65 + i * 96;
                return (
                  <g key={i}>
                    <line x1={tx} y1="23" x2={tx} y2="33" stroke="#0f380f" strokeWidth="2.5" />
                    <text x={tx} y="19" textAnchor="middle" fill="#0f380f" fontSize="9.5" fontWeight="900" fontFamily="monospace">
                      {stations[i].freq}
                    </text>
                  </g>
                );
              })}
              {/* Moving tuning needle */}
              <rect x={65 + stationIdx * 96 - 3} y="21" width="6" height="24" rx="1" fill="#0f380f" />
              <rect x={65 + stationIdx * 96 - 1} y="23" width="2" height="20" fill="#9bbc0f" />

              {/* Left status pixel badge */}
              <rect x="20" y="49" width="176" height="32" rx="3" fill="#0f380f" />
              <text x="30" y="63" fill="#9bbc0f" fontSize="10" fontWeight="900" fontFamily="monospace">
                {hosted ? '★ ON AIR LIVE ★' : sync.readyForBroadcast ? 'SYNC: READY' : `SYNC: ${sync.restoredCount}/3 MIN`}
              </text>
              <text x="30" y="75" fill="#8bac0f" fontSize="8.5" fontWeight="700" fontFamily="monospace">
                {stations[stationIdx].name.toUpperCase()} · {sync.peacefulRoute ? 'PEACEFUL' : 'LIVELY'}
              </text>

              {/* Right 8-bar phosphor waveform equalizer */}
              <rect x="208" y="49" width="192" height="32" rx="3" fill="#306230" stroke="#0f380f" strokeWidth="2" />
              {barHeights.map((h, i) => {
                const scaledH = Math.round(h * 0.78);
                return (
                  <rect
                    key={i}
                    x={219 + i * 22}
                    y={79 - scaledH}
                    width="14"
                    height={scaledH}
                    rx="1"
                    fill={i % 2 === 0 ? '#9bbc0f' : '#8bac0f'}
                    stroke="#0f380f"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {stations.map((st, idx) => {
                const active = stationIdx === idx;
                return (
                  <button
                    key={st.freq}
                    type="button"
                    data-testid={`station-btn-${idx}`}
                    onClick={() => engine.playBroadcastStation(idx)}
                    className={`ink-button py-1.5 px-2 rounded-lg text-left border-2 cursor-pointer ${
                      active
                        ? 'bg-[#9bbc0f] text-[#0f380f] border-[#0f380f]'
                        : 'bg-[#160c24] text-[#f7efde] border-[#306230]'
                    }`}
                  >
                    <div className="font-mono-num font-black text-[11px]">{st.freq} MHz</div>
                    <div className="text-[10px] font-bold truncate">{st.name}</div>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-[#f7efde]/75">{stations[stationIdx].desc}</div>
          </div>

          {/* County Sync Progress & Route Badge */}
          <div className="rounded-xl bg-[#160c24]/92 border-2 border-[#ffd166]/70 p-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-display font-black text-sm text-[#ffd166]">
                County Sync Progress ({sync.restoredCount}/{sync.totalRestorations} Restorations)
              </div>
              <span
                data-testid="broadcast-route-badge"
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                  sync.peacefulRoute
                    ? 'bg-[#2ec4b6]/20 border-[#2ec4b6] text-[#72efdd]'
                    : 'bg-[#ff5d8f]/20 border-[#ff5d8f] text-[#ff85b3]'
                }`}
              >
                {sync.peacefulRoute ? 'Peaceful Route (0 Bonks)' : `Lively Route (${hud.stats.enemiesBonked} Bonks)`}
              </span>
            </div>

            <div className="h-2 rounded-full bg-[#100621] overflow-hidden border border-[#f7efde]/15">
              <div
                className="h-full origin-left rounded-full bg-[#ffd166]"
                style={{ transform: `scaleX(${Math.max(0.04, sync.restoredCount / Math.max(1, sync.totalRestorations))})` }}
              />
            </div>

            {sync.completedLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 text-[10.5px] font-bold">
                {sync.completedLabels.map((lbl) => (
                  <span key={lbl} className="px-2 py-0.5 rounded bg-[#100621] border border-[#2ec4b6]/60 text-[#72efdd]">
                    ✓ {lbl}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[#f7efde]/70">
                Restore Radio Unmelted or any 3 county landmarks (Supper, Ferry, Orchard, Clothesline, Wickworks, Undertone Fork, Tide Press, Hanging Gutter) to unlock the live broadcast!
              </div>
            )}
          </div>

          {/* Personalized Lead Epilogue & Broadcast Roll Call */}
          <div className="rounded-xl bg-[#100621]/92 border border-[#b388ff]/55 p-3.5 flex flex-col gap-2">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#b388ff]">
              {ch.name}’s Broadcast Epilogue
            </div>
            <p className="text-xs text-[#fffdf7] leading-relaxed italic">“{sync.leadEpilogue}”</p>
            <div className="border-t border-[#f7efde]/12 pt-2 flex flex-col gap-1 text-[11px] text-[#f7efde]/85">
              {sync.broadcastLines.slice(0, 6).map((line, i) => (
                <div key={i}>• {line}</div>
              ))}
            </div>
          </div>

          {/* Action Buttons (Always keeps the county playable afterward!) */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              data-testid="host-broadcast-btn"
              disabled={!sync.readyForBroadcast}
              onClick={() => engine.hostAllNightBroadcast()}
              className="ink-button flex-1 py-3 px-4 rounded-xl bg-[#ffd166] text-[#160c24] font-display font-black text-sm border-2 border-[#160c24] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {hosted
                ? 'ON AIR ★ Replay Broadcast & Keep Exploring'
                : sync.readyForBroadcast
                  ? 'Host All-Night Broadcast & Keep Exploring'
                  : `Restore ${Math.max(0, 3 - sync.restoredCount)} More Landmark(s) or Radio Tower`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ink-button py-3 px-4 rounded-xl bg-[#2d1a4b] text-[#f7efde] font-bold text-xs border-2 border-[#f7efde]/25 cursor-pointer"
            >
              Keep Exploring County
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // WICKWATER CEREMONY CHOICE MODAL
  if (modal === 'ceremony_choice') {
    return (
      <ModalShell
        title="The Last Unsent Message"
        subtitle="Sol & Flicker Shortwick disagree on how Wickwater should honor the county’s final unmailed letter."
        onClose={onClose}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#160c24]/90 border-2 border-[#ff9f1c] p-4 flex flex-col gap-2">
            <div className="font-display font-extrabold text-base text-[#ffd166]">Flicker’s Public Dedication</div>
            <p className="text-xs text-[#f7efde]/80">
              Launch a choir of bright tallow lanterns along the canals so every traveler knows the Lamp-Service Tunnel is open again.
            </p>
            <button
              type="button"
              onClick={() => engine.resolveCeremonyChoice('public')}
              className="ink-button mt-auto py-2.5 px-3 rounded-xl bg-[#ff9f1c] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer"
            >
              Hold Public Dedication
            </button>
          </div>

          <div className="rounded-xl bg-[#160c24]/90 border-2 border-[#b388ff] p-4 flex flex-col gap-2">
            <div className="font-display font-extrabold text-base text-[#ffd166]">Sol’s Private Delivery</div>
            <p className="text-xs text-[#f7efde]/80">
              Seal the message in warm wax and carry it quietly up the Lamp-Service Tunnel to Giggle-Grove before dawn.
            </p>
            <button
              type="button"
              onClick={() => engine.resolveCeremonyChoice('private')}
              className="ink-button mt-auto py-2.5 px-3 rounded-xl bg-[#b388ff] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer"
            >
              Honor Private Delivery
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // RESIDENT CONVERSATION & BARTER MODAL
  if ((modal === 'resident' || modal === 'trade') && payload.residentId) {
    const res = RESIDENTS.find((r) => r.id === payload.residentId);
    if (!res) return null;
    const isHelped = res.helpFlag ? Boolean(hud.worldFlags[res.helpFlag]) : false;
    const storyAction = getResidentActionMeta(res.id, hud);
    const taughtTech = res.teaches ? TECHNIQUES[res.teaches] : null;
    const knowsTech = res.teaches ? hud.techniques.includes(res.teaches) : false;

    return (
      <ModalShell
        title={res.name}
        subtitle={`${PEOPLE_LABELS[res.people]} · ${res.role} · ${BIOMES[res.regionId].name}`}
        onClose={onClose}
      >
        <div className="flex flex-col gap-3.5">
          {/* Dialogue Bubble */}
          <div
            className="rounded-xl bg-[#160c24]/92 border-2 p-3.5"
            style={{ borderColor: res.accent }}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#2ec4b6] mb-1">
              {res.idleAction}
            </div>
            <p className="text-sm text-[#fffdf7] leading-relaxed">
              &ldquo;{isHelped ? res.afterHelpLine : res.greet}&rdquo;
            </p>
            <div className="mt-2.5 pt-2 border-t border-[#f7efde]/12 flex flex-col gap-1 text-[11px] text-[#f7efde]/75">
              <div><strong className="text-[#ffd166]">Looking for:</strong> {res.want}</div>
              <div><strong className="text-[#2ec4b6]">Connections:</strong> {res.relationship}</div>
              <div><strong className="text-[#ff85b3]">Local note:</strong> {res.weatherLine}</div>
              {res.disagreementTopic && (
                <div><strong className="text-[#b388ff]">Active Debate:</strong> {res.disagreementTopic}</div>
              )}
            </div>
          </div>

          {/* Cultural Technique Banner */}
          {taughtTech && (
            <div className="rounded-xl bg-[#100621]/90 border border-[#b388ff]/50 px-3.5 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-[#b388ff] inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Cultural Technique: {taughtTech.name}
                </div>
                <div className="text-[11px] text-[#f7efde]/75 mt-0.5">{taughtTech.desc}</div>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-1 rounded-lg bg-[#2d1a4b] text-[#ffd166] shrink-0">
                {knowsTech ? 'Learned' : 'Earnable'}
              </span>
            </div>
          )}

          {/* Story / Transport Action */}
          {storyAction && (
            <button
              type="button"
              disabled={!storyAction.enabled}
              onClick={() => engine.resolveResidentStoryAction(res.id)}
              className="ink-button py-3 px-4 rounded-xl font-display font-black text-sm text-[#160c24] border-2 border-[#160c24] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              style={{ backgroundColor: storyAction.accent || '#ffd166' }}
            >
              {storyAction.label}
            </button>
          )}

          {/* Barter Stalls */}
          {res.trades && res.trades.length > 0 && (
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#ffd166] mb-2">
                Local Barter & Crafts
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {res.trades.map((tr, idx) => {
                  const cost = getDiscountedCost(tr.give, hud.charId, hud.skills);
                  const canAfford = hasIngredients(hud.inv, cost);
                  const owned = Boolean(tr.style && hud.unlockedStyles.includes(tr.style));
                  const costStr = Object.entries(cost)
                    .map(([k, v]) => `${v} ${ITEMS[k]?.name || k}`)
                    .join(' · ');
                  return (
                    <div key={tr.label} className="rounded-xl bg-[#160c24]/90 border-2 border-[#ffd166]/65 p-3 flex flex-col gap-1.5">
                      <div className="font-display font-extrabold text-sm text-[#ffd166]">{tr.label}</div>
                      <div className="text-xs font-semibold text-[#2ec4b6]">Price: {costStr}</div>
                      <button
                        type="button"
                        disabled={!canAfford || owned}
                        onClick={() => engine.doResidentTrade(res.id, idx)}
                        className="ink-button mt-auto py-1.5 px-3 rounded-lg bg-[#ffd166] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {owned ? 'Unlocked' : canAfford ? 'Barter' : 'Not Enough'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ModalShell>
    );
  }

  // BAG & BOTANICAL HERBARIUM MODAL
  if (modal === 'bag') {
    const keys = Object.keys(hud.inv).filter((k) => (hud.inv[k] || 0) > 0 && ITEMS[k]);
    const tripKeys = Object.keys(TRIP_VISUAL_META) as TripId[];
    return (
      <ModalShell
        title="Satchel & Botanical Herbarium"
        subtitle="Quick-sip brews with 1–5. Pair compatible psychedelics to unlock Cross-Trip Synergies."
        onClose={onClose}
      >
        {/* Three-Tab Bar: Satchel | Field Journal | Botanical Herbarium */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <button
            type="button"
            onClick={() => setBagTab('satchel')}
            className={`ink-button py-2 px-2 rounded-xl font-display font-black text-xs border-2 cursor-pointer ${
              bagTab === 'satchel'
                ? 'bg-[#ffd166] text-[#160c24] border-[#160c24]'
                : 'bg-[#160c24]/90 text-[#f7efde]/80 border-[#f7efde]/25'
            }`}
          >
            Satchel ({keys.length})
          </button>
          <button
            type="button"
            onClick={() => setBagTab('journal')}
            className={`ink-button py-2 px-2 rounded-xl font-display font-black text-xs border-2 cursor-pointer ${
              bagTab === 'journal'
                ? 'bg-[#72efdd] text-[#160c24] border-[#160c24]'
                : 'bg-[#160c24]/90 text-[#f7efde]/80 border-[#f7efde]/25'
            }`}
          >
            Journal ({hud.journalSketches.length})
          </button>
          <button
            type="button"
            onClick={() => setBagTab('herbarium')}
            className={`ink-button py-2 px-2 rounded-xl font-display font-black text-xs border-2 cursor-pointer ${
              bagTab === 'herbarium'
                ? 'bg-[#2ec4b6] text-[#160c24] border-[#160c24]'
                : 'bg-[#160c24]/90 text-[#f7efde]/80 border-[#f7efde]/25'
            }`}
          >
            Herbarium ({tripKeys.length})
          </button>
        </div>

        {bagTab === 'journal' ? (
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#72efdd]">
              Wildlife &amp; Water Field Sketches
            </div>
            {hud.journalSketches.length === 0 ? (
              <p className="text-xs text-[#f7efde]/75">
                Watch calm water reflections at the Delta Public Bank or inspect strange regional wildlife to sketch them here.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {hud.journalSketches.map((sk) => (
                  <div key={sk.id} className="rounded-xl bg-[#160c24]/92 border-2 border-[#72efdd] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-extrabold text-sm text-[#ffd166]">{sk.title}</span>
                      <span className="text-[10px] font-mono-num font-bold uppercase text-[#72efdd]">{sk.category}</span>
                    </div>
                    <p className="text-xs text-[#f7efde]/85 mt-1 leading-snug">{sk.note}</p>
                  </div>
                ))}
              </div>
            )}
            {hud.journalNotes.length > 0 && (
              <div className="rounded-xl bg-[#100621]/90 border border-[#f7efde]/15 p-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#ffd166] mb-1.5">
                  Recent County Notes
                </div>
                <ul className="list-disc pl-4 text-xs text-[#f7efde]/80 space-y-1">
                  {hud.journalNotes.slice(0, 6).map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : bagTab === 'satchel' ? (
          keys.length === 0 ? (
            <p className="text-sm text-[#f7efde]/80">Your satchel is empty. Boop nearby trees, shrooms, or bushes to forage!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {keys.map((k) => {
                const it = ITEMS[k];
                const usable = it.cat === 'food' || it.cat === 'sub' || k === 'junk_mail';
                const tripMeta = it.trip && it.trip !== 'sober' ? TRIP_VISUAL_META[it.trip] : null;
                const risksBadTrip = (it.vib || 0) < 0 && (it.wob || 0) >= 35;
                const isGrounding = it.trip === 'sober';
                const statParts: string[] = [];
                if (it.wob) statParts.push(`${it.wob > 0 ? '+' : ''}${it.wob} Wobble`);
                if (it.vib) statParts.push(`${it.vib > 0 ? '+' : ''}${it.vib} Vibe`);
                if (it.mun) statParts.push(`${it.mun > 0 ? '+' : ''}${it.mun} Munch`);
                if (it.dur) statParts.push(`${it.dur}s`);

                return (
                  <div
                    key={k}
                    className="rounded-xl bg-[#160c24]/90 border-2 p-3 flex flex-col gap-1.5"
                    style={{
                      borderColor: isGrounding
                        ? '#a8ff3e'
                        : tripMeta
                          ? tripMeta.accent
                          : it.cat === 'quest'
                            ? '#ffd166'
                            : '#2ec4b6',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-extrabold text-sm text-[#ffd166]">{it.name}</span>
                      <span className="font-mono-num text-xs font-bold text-[#f7efde]">x{hud.inv[k]}</span>
                    </div>
                    <p className="text-xs text-[#f7efde]/82 leading-snug">{it.desc || it.quote || 'Crafting & barter resource.'}</p>
                    {tripMeta && (
                      <div className="text-[11px] font-semibold leading-snug" style={{ color: tripMeta.accent }}>
                        {tripMeta.effectSummary}
                      </div>
                    )}
                    {statParts.length > 0 && (
                      <div className="text-[10px] font-mono-num font-bold text-[#f7efde]/70">
                        {statParts.join(' · ')}
                      </div>
                    )}
                    {risksBadTrip && (
                      <div className="text-[10px] font-extrabold text-[#ff5d8f]">
                        Caution: Drains Vibe while spiking Wobble—can trigger a Bad Trip!
                      </div>
                    )}
                    {isGrounding && (
                      <div className="text-[10px] font-extrabold text-[#a8ff3e]">
                        Instant Antidote: Clears Wobble & ends any Bad Trip spiral.
                      </div>
                    )}
                    {usable && (
                      <div className="mt-auto flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            engine.consumeItem(k);
                            onClose();
                          }}
                          className={`ink-button flex-1 py-1.5 px-3 rounded-lg font-extrabold text-xs border-2 border-[#160c24] cursor-pointer ${
                            isGrounding
                              ? 'bg-[#a8ff3e] text-[#160c24]'
                              : it.cat === 'sub'
                                ? 'bg-[#ff5d8f] text-[#160c24]'
                                : 'bg-[#2ec4b6] text-[#160c24]'
                          }`}
                        >
                          {isGrounding ? 'Sip & Ground' : it.cat === 'sub' ? 'Consume Brew' : k === 'junk_mail' ? 'Throw Decoy' : 'Eat Snack'}
                        </button>
                        {(k === 'spool_perch' || k === 'mirror_minnow' || k === 'receipt_eel' || k === 'reed_perch') && (
                          <button
                            type="button"
                            onClick={() => engine.releaseFish(k)}
                            className="ink-button py-1.5 px-2.5 rounded-lg bg-[#72efdd] text-[#160c24] font-extrabold text-[11px] border-2 border-[#160c24] cursor-pointer"
                          >
                            Release
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-5">
            {/* Cross-Trip Synergies Compendium */}
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#ffd166] mb-2">
                Cross-Trip Synergies (Combine Two Active Brews)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {TRIP_SYNERGIES.map((syn) => {
                  const isActive = hud.tripSynergy?.id === syn.id;
                  const pairNames = `${TRIP_VISUAL_META[syn.pair[0]].name} + ${TRIP_VISUAL_META[syn.pair[1]].name}`;
                  return (
                    <div
                      key={syn.id}
                      className="rounded-xl bg-[#160c24]/92 border-2 p-3 flex flex-col gap-1"
                      style={{ borderColor: isActive ? '#a8ff3e' : syn.accent }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-black text-xs uppercase tracking-wide" style={{ color: syn.accent }}>
                          ✦ {syn.name}
                        </span>
                        {isActive && (
                          <span className="text-[9px] font-mono-num font-black px-1.5 py-0.5 rounded bg-[#a8ff3e] text-[#160c24]">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-bold text-[#ffd166]">{pairNames}</div>
                      <div className="text-[10px] font-extrabold text-[#2ec4b6] mt-0.5">{syn.bonusDesc}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Strange Horticulture-style Specimen Field Guide */}
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#2ec4b6] mb-2">
                Psychedelic Specimen Field Guide (Onset → Peak → Afterglow)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {tripKeys.map((tid) => {
                  const meta = TRIP_VISUAL_META[tid];
                  const riskCol =
                    meta.riskLevel === 'High Bad-Trip Risk'
                      ? '#ff3b8d'
                      : meta.riskLevel === 'Intense'
                        ? '#ffd166'
                        : meta.riskLevel === 'Vibrant'
                          ? '#a8ff3e'
                          : '#72efdd';
                  return (
                    <div
                      key={tid}
                      className="rounded-xl bg-[#160c24]/90 border-2 p-3 flex flex-col gap-1.5"
                      style={{ borderColor: meta.accent }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-extrabold text-sm" style={{ color: meta.accent }}>
                          {meta.name}
                        </span>
                        <span
                          className="text-[9px] font-mono-num font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#100621] border"
                          style={{ borderColor: riskCol, color: riskCol }}
                        >
                          {meta.riskLevel}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-[#ffd166]/90">Habitat: {meta.habitat}</div>
                      <div className="text-[10px] text-[#f7efde]/82 space-y-0.5 leading-snug">
                        <div>
                          <span className="font-extrabold text-[#ffd166]">Onset:</span> {meta.onsetNote}
                        </div>
                        <div>
                          <span className="font-extrabold text-[#ff5d8f]">Peak:</span> {meta.peakNote}
                        </div>
                        <div>
                          <span className="font-extrabold text-[#72efdd]">Afterglow:</span> {meta.afterglowNote}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </ModalShell>
    );
  }

  // CRAFT MODAL (with Authoritative Station & Discipline Tier Gates)
  if (modal === 'craft') {
    return (
      <ModalShell
        title="Camp Crafting, Furniture & Workbench"
        subtitle={
          hud.nearWorkbench && hud.nearBlender
            ? 'Workbench & Funk-Blender ready! Special schematics and combo brews unlocked.'
            : hud.nearWorkbench
              ? 'Workbench ready! Craft precision tools like Prism Reel once skill tiers are met.'
              : hud.nearBlender
                ? 'Funk-Blender ready! Blend psychedelic combos, Pear-Lens Stylus, and camp furniture.'
                : 'Craft camp furniture anytime; stand near a Funk-Blender or Workbench for advanced gear.'
        }
        onClose={onClose}
      >
        <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2.5 rounded-xl bg-[#160c24]/90 border border-[#ffd166]/35">
          <span className="text-xs text-[#f7efde]/85">
            {hud.shakeBonus ? 'Froth active! Next Disco Overdrive restores +30 Vibe.' : 'Froth the Blender before mixing Disco Overdrive for +30 Vibe.'}
          </span>
          <button
            type="button"
            onClick={() => engine.triggerFroth()}
            className="ink-button px-3 py-1.5 rounded-lg bg-[#ffd166] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer whitespace-nowrap"
          >
            {hud.shakeBonus ? 'Frothed' : 'Froth Blender'}
          </button>
        </div>

        <p className="mb-3 rounded-lg border border-[#ffd166]/40 bg-[#160c24] px-3 py-2 text-xs font-bold text-[#fff1cf]">
          {hud.shelteredAtRefuge ? 'Sheltered work · Cool-Mint Brew yields one extra draught here.' : 'Field work · Craft portable supplies while exposed.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {RECIPES.filter((recipe) => !recipe.requiresMillpond || hud.expeditions.millpond.status === 'restored').map((r) => {
            const check = canCraftRecipe(r, hud.inv, hud.nearBlender, hud.gear, hud.unlockedStyles, {
              nearWorkbench: hud.nearWorkbench,
              disciplines: hud.disciplines,
            });
            const effCost = getEffectiveRecipeCost(r, hud.disciplines);
            const costStr = Object.entries(effCost)
              .map(([k, v]) => `${v} ${ITEMS[k]?.name || k}`)
              .join(' · ');
            const skillReqs = r.reqDisciplines
              ? (Object.entries(r.reqDisciplines) as [DisciplineId, number][]).map(([disc, reqTier]) => {
                  const cur = hud.disciplines[disc]?.tier || 1;
                  return { disc, reqTier, met: cur >= reqTier, cur };
                })
              : [];
            return (
              <div
                key={r.id}
                data-testid={`recipe-${r.id}`}
                className="rounded-xl bg-[#160c24]/90 border-2 p-3 flex flex-col gap-1.5"
                style={{
                  borderColor:
                    check.reason === 'need_skill' || check.reason === 'need_workbench'
                      ? '#b388ff'
                      : r.type === 'blend'
                        ? '#ff5d8f'
                        : '#ffd166',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-extrabold text-sm text-[#ffd166]">{r.name}</span>
                  {r.reqStation === 'workbench' && (
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#2d1a4b] text-[#72efdd] shrink-0">
                      Workbench
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#f7efde]/78 leading-snug">{r.desc}</p>
                <div className="text-[11px] font-semibold text-[#2ec4b6] mt-0.5">{costStr}</div>
                {skillReqs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                    {skillReqs.map((sr) => (
                      <span
                        key={sr.disc}
                        className={`px-1.5 py-0.5 rounded bg-[#100621] border ${
                          sr.met ? 'border-[#a8ff3e] text-[#a8ff3e]' : 'border-[#ff5d8f] text-[#ff85b3]'
                        }`}
                      >
                        {DISCIPLINES[sr.disc].name} T{sr.reqTier} ({TIER_NAMES[sr.reqTier as 1 | 2 | 3 | 4 | 5]} · You: T{sr.cur})
                      </span>
                    ))}
                  </div>
                )}
                {check.reason === 'need_skill' && r.practiceHint && (
                  <div className="text-[10px] text-[#b388ff]">{r.practiceHint}</div>
                )}
                <button
                  type="button"
                  disabled={!check.ok}
                  onClick={() => engine.craftRecipe(r.id)}
                  className={`ink-button mt-auto py-1.5 px-3 rounded-lg font-extrabold text-xs border-2 border-[#160c24] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    r.type === 'blend' ? 'bg-[#ff5d8f] text-[#160c24]' : 'bg-[#ffd166] text-[#160c24]'
                  }`}
                >
                  {check.reason === 'owned'
                    ? 'Owned'
                    : check.reason === 'need_workbench'
                      ? 'Stand Near Workbench'
                      : check.reason === 'need_blender'
                        ? 'Needs Funk-Blender'
                        : check.reason === 'need_skill'
                          ? `Locked: ${(check.missingSkills || []).join(' & ')}`
                          : check.ok
                            ? 'Craft'
                            : 'Missing Materials'}
                </button>
              </div>
            );
          })}
        </div>
      </ModalShell>
    );
  }

  // MOVEMENT STYLES MODAL
  if (modal === 'style') {
    return (
      <ModalShell title="Movement Styles" subtitle="Swap gaits freely once unlocked via crafting or county barters." onClose={onClose}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(STYLES) as MoveStyleId[]).map((id) => {
            const s = STYLES[id];
            const unlocked = hud.unlockedStyles.includes(id);
            const active = hud.moveStyle === id;
            return (
              <div key={id} className="rounded-xl bg-[#160c24]/90 border-2 border-[#ffd166]/70 p-3 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-display font-extrabold text-sm text-[#ffd166]">{s.name}</span>
                  <span className="font-mono-num text-[11px] text-[#2ec4b6]">{Math.round(s.spd * 100)}% Spd</span>
                </div>
                <p className="text-xs text-[#f7efde]/80">{s.desc}</p>
                <button
                  type="button"
                  disabled={!unlocked || active}
                  onClick={() => engine.setMoveStyle(id)}
                  className="ink-button mt-auto py-1.5 px-3 rounded-lg bg-[#2ec4b6] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {active ? 'Equipped' : unlocked ? 'Equip Style' : 'Unlock via Barter / Craft'}
                </button>
              </div>
            );
          })}
        </div>
      </ModalShell>
    );
  }

  // SKILLS, 5-TIER LIVELIHOOD DISCIPLINES, PERKS & CULTURAL TECHNIQUES MODAL
  if (modal === 'skills') {
    return (
      <ModalShell
        title="Livelihood Disciplines, Perks & Skills"
        subtitle={`Skill Points: ${hud.sp} · Cultural Techniques: ${hud.techniques.length}/8 · Retrain any Tier-3 Perk for 10 Caps`}
        onClose={onClose}
      >
        <div className="flex flex-col gap-5">
          {/* PASS 2 & 3: All 10 Livelihood Disciplines (5 Tiers + Tier-3 Sidegrade Perks) */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#72efdd] mb-2">
              Ten Livelihood Disciplines (Tier 1 Novice → Tier 5 Master)
            </div>
            <div className="grid grid-cols-1 gap-3">
              {CORE_DISCIPLINE_IDS.map((discId) => {
                const def = DISCIPLINES[discId];
                const prog = hud.disciplines[discId] || { xp: 0, tier: 1 as const, perk: null, recentActions: [] };
                const nextXp = getNextTierXp(prog.tier);
                const pct = nextXp ? Math.min(100, Math.round((prog.xp / nextXp) * 100)) : 100;
                const canPickPerk = prog.tier >= 3 && !prog.perk;
                const nextTierKey = (prog.tier + 1) as 2 | 3 | 4 | 5;
                return (
                  <div
                    key={discId}
                    data-testid={`discipline-${discId}`}
                    className="rounded-xl bg-[#160c24]/92 border-2 p-3 flex flex-col gap-2"
                    style={{ borderColor: def.accent }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-display font-black text-sm" style={{ color: def.accent }}>
                          {def.name}
                        </span>
                        <span className="ml-2 text-[11px] font-extrabold text-[#ffd166]">
                          Tier {prog.tier} · {TIER_NAMES[prog.tier]}
                        </span>
                      </div>
                      <span className="font-mono-num text-[11px] text-[#f7efde]/80">
                        {nextXp ? `${prog.xp}/${nextXp} XP` : `${prog.xp} XP (MAX)`}
                      </span>
                    </div>

                    <div className="h-1.5 rounded-full bg-[#100621] overflow-hidden border border-[#f7efde]/15">
                      <div
                        className="h-full origin-left rounded-full"
                        style={{ transform: `scaleX(${Math.max(0.03, pct / 100)})`, backgroundColor: def.accent }}
                      />
                    </div>

                    <div className="text-[11px] text-[#f7efde]/80 leading-snug">
                      <strong className="text-[#ffd166]">Current Effect:</strong> {def.tiers[prog.tier]}
                      {prog.tier < 5 && (
                        <span className="text-[#f7efde]/60"> · Next (T{prog.tier + 1}): {def.tiers[nextTierKey]}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-[#f7efde]/60">{def.practiceWhere}</div>

                    {/* Tier-3 Sidegrade Perks (always previewed before selection!) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                      {def.perks.map((pk) => {
                        const chosen = prog.perk === pk.id;
                        return (
                          <div
                            key={pk.id}
                            className="rounded-lg bg-[#100621]/90 border p-2 flex flex-col gap-1"
                            style={{ borderColor: chosen ? '#ffd166' : 'rgba(247,239,222,0.18)' }}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-display font-extrabold text-xs text-[#fffdf7]">{pk.name}</span>
                              {chosen && (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#ffd166] text-[#160c24]">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-[#2ec4b6] leading-snug">{pk.desc}</div>
                            {canPickPerk && (
                              <button
                                type="button"
                                onClick={() => engine.pickDisciplinePerk(discId, pk.id)}
                                className="ink-button mt-1 py-1 px-2 rounded-lg bg-[#ffd166] text-[#160c24] font-extrabold text-[11px] border border-[#160c24] cursor-pointer"
                              >
                                Choose Perk (Tier 3)
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {prog.perk && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          disabled={hud.caps < 10}
                          onClick={() => engine.retrainDisciplinePerk(discId)}
                          className="ink-button py-1 px-2.5 rounded-lg bg-[#2d1a4b] text-[#ffd166] font-extrabold text-[10.5px] border border-[#ffd166]/50 cursor-pointer disabled:opacity-40"
                        >
                          Retrain Perk (10 Bottlecaps)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#b388ff] mb-2">
              Brain-Bloom Skills
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SKILLS.map((sk) => {
                const owned = hud.skills.includes(sk.id);
                return (
                  <div
                    key={sk.id}
                    className="rounded-xl bg-[#160c24]/90 border-2 p-3 flex flex-col gap-1.5"
                    style={{ borderColor: owned ? '#ffd166' : sk.accent }}
                  >
                    <div className="font-display font-extrabold text-sm text-[#ffd166]">{sk.name}</div>
                    <p className="text-xs text-[#f7efde]/80">{sk.desc}</p>
                    <button
                      type="button"
                      disabled={owned || hud.sp < sk.cost}
                      onClick={() => engine.buySkill(sk.id)}
                      className="ink-button mt-auto py-1.5 px-3 rounded-lg bg-[#b388ff] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {owned ? 'Learned' : `Learn (${sk.cost} SP)`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#2ec4b6] mb-2">
              County Peoples’ Cultural Techniques ({hud.techniques.length}/8)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(TECHNIQUES) as TechniqueId[]).map((tid) => {
                const t = TECHNIQUES[tid];
                const known = hud.techniques.includes(tid);
                return (
                  <div
                    key={tid}
                    className="rounded-xl bg-[#160c24]/90 border p-3"
                    style={{ borderColor: known ? t.accent : 'rgba(247,239,222,0.16)' }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-extrabold text-xs text-[#ffd166]">{t.name}</span>
                      <span className="text-[10px] font-bold uppercase text-[#2ec4b6]">
                        {known ? 'Active' : PEOPLE_LABELS[t.peopleId]}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#f7efde]/75 mt-1">{t.desc}</p>
                    <div className="text-[10px] text-[#f7efde]/55 mt-1">Taught by {t.teacher}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </ModalShell>
    );
  }

  // STATE-GROUNDED REGIONAL EVENT MODAL
  if (modal === 'regional_event' && hud.regionalEvent) {
    const ev = hud.regionalEvent;
    return (
      <ModalShell
        title={`County Bulletin: ${ev.title}`}
        subtitle={`Eyewitness: ${ev.eyewitnessName} · Day ${ev.startedDay} · Region: ${BIOMES[ev.regionId]?.name || ev.regionId}`}
        onClose={onClose}
      >
        <div className="flex flex-col gap-3.5" data-testid="regional-event-modal">
          <div className="rounded-xl bg-[#160c24]/92 border-2 border-[#ffd166]/70 p-3.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#ffd166]">
              Eyewitness Report — {ev.eyewitnessName}
            </div>
            <p className="text-sm text-[#fffdf7] mt-1 leading-relaxed">{ev.summary}</p>
            <div className="text-[11px] text-[#72efdd] mt-2">{ev.groundedReason}</div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            <button
              type="button"
              data-testid="event-choice-a"
              onClick={() => engine.resolveRegionalEvent('a')}
              className="ink-button text-left p-3.5 rounded-xl bg-[#2d1a4b] hover:bg-[#3a2260] border-2 border-[#ffd166] cursor-pointer"
            >
              <div className="font-display font-black text-sm text-[#ffd166]">{ev.optionALabel}</div>
              <div className="text-xs text-[#f7efde]/85 mt-0.5">{ev.optionADesc}</div>
            </button>

            <button
              type="button"
              data-testid="event-choice-b"
              onClick={() => engine.resolveRegionalEvent('b')}
              className="ink-button text-left p-3.5 rounded-xl bg-[#160c24] hover:bg-[#24133d] border-2 border-[#2ec4b6] cursor-pointer"
            >
              <div className="font-display font-black text-sm text-[#72efdd]">{ev.optionBLabel}</div>
              <div className="text-xs text-[#f7efde]/85 mt-0.5">{ev.optionBDesc}</div>
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // QUESTS & FIELD JOURNAL MODAL
  if (modal === 'quests') {
    return (
      <ModalShell
        title="County Bounties & Field Notes"
        subtitle="Complete regional expeditions and milestones for Bottlecaps, XP, and rare seeds."
        onClose={onClose}
      >
        <div className="flex flex-col gap-4">
          {hud.regionalEvent && (
            <div className="rounded-xl bg-[#24120c] border-2 border-[#ffd166] p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-black text-sm text-[#ffd166]">
                  Live County Bulletin: {hud.regionalEvent.title}
                </div>
                <div className="text-[11px] text-[#f7efde]/85 mt-0.5">
                  Eyewitness {hud.regionalEvent.eyewitnessName}: {hud.regionalEvent.summary}
                </div>
              </div>
              <button
                type="button"
                data-testid="open-regional-event-btn"
                onClick={() => engine.setActiveModal('regional_event')}
                className="ink-button px-3.5 py-2 rounded-xl bg-[#ffd166] text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer whitespace-nowrap"
              >
                Respond Now
              </button>
            </div>
          )}

          {/* County Sync & All-Night Broadcast Launcher */}
          <div className="rounded-xl bg-[#160c24]/92 border-2 border-[#ff5d8f] p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-display font-black text-sm text-[#ffd166] inline-flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-[#ff5d8f]" />
                All-Night County Broadcast · Sync {hud.countySync.restoredCount}/{hud.countySync.totalRestorations}
              </div>
              <div className="text-[11px] text-[#f7efde]/80 mt-0.5">
                {hud.worldFlags.allNightBroadcastHosted
                  ? 'Broadcast live across all 15 regions! Tune stations or replay anytime.'
                  : hud.countySync.readyForBroadcast
                    ? 'Signal ready! Tune the Pocket Tuner & host your personalized county finale.'
                    : 'Restore Radio Unmelted or 3 county landmarks to go live from Mailbox Square.'}
              </div>
            </div>
            <button
              type="button"
              data-testid="open-broadcast-btn"
              onClick={() => engine.setActiveModal('all_night_broadcast')}
              className="ink-button px-3.5 py-2 rounded-xl bg-[#ff5d8f] text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer whitespace-nowrap"
            >
              {hud.worldFlags.allNightBroadcastHosted ? 'ON AIR ★ Tuner' : 'Open Tuner'}
            </button>
          </div>

          {hud.journalNotes.length > 0 && (
            <div className="rounded-xl bg-[#100621]/90 border border-[#2ec4b6]/40 p-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#2ec4b6] mb-1.5">
                Latest Field Notes
              </div>
              <ul className="flex flex-col gap-1 text-xs text-[#f7efde]/85 list-disc pl-4">
                {hud.journalNotes.slice(0, 4).map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {QUESTS.map((q) => {
              const claimed = hud.claimedQuests.includes(q.id);
              const cur = getQuestProgress(q, hud.stats, hud.worldFlags);
              const ready = !claimed && cur >= q.target;
              return (
                <div
                  key={q.id}
                  className="rounded-xl bg-[#160c24]/90 border-2 p-3.5 flex items-center justify-between gap-4"
                  style={{ borderColor: claimed ? '#2ec4b6' : ready ? '#ffd166' : 'rgba(247,239,222,0.22)' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-extrabold text-sm text-[#ffd166]">{q.title}</span>
                      <span className="text-[10px] font-bold uppercase text-[#2ec4b6]">
                        {BIOMES[q.regionId].name}
                      </span>
                    </div>
                    <p className="text-xs text-[#f7efde]/80 mt-0.5">{q.desc}</p>
                    <div className="text-[11px] font-mono-num text-[#2ec4b6] mt-1">
                      Progress: {cur}/{q.target} · Reward: +{q.rewardCaps} Caps · +{q.rewardXp} XP
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!ready}
                    onClick={() => engine.claimQuest(q.id)}
                    className="ink-button shrink-0 px-3.5 py-2 rounded-lg bg-[#ffd166] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {claimed ? 'Claimed' : ready ? 'Claim Reward' : 'In Progress'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </ModalShell>
    );
  }

  // WORMHOLE MAILBOX FAST TRAVEL
  if (modal === 'wormhole') {
    return (
      <ModalShell
        title="Wormhole Mail Network"
        subtitle="Warp between any county mailboxes you have visited on foot."
        onClose={onClose}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {engine.state.mailboxes.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={!m.discovered}
              onClick={() => engine.warpToMailbox(m.id)}
              className="ink-button rounded-xl bg-[#160c24]/90 border-2 p-3.5 text-left cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: m.discovered ? m.col : 'rgba(247,239,222,0.18)' }}
            >
              <div className="font-display font-extrabold text-sm text-[#ffd166]">{m.biomeName}</div>
              <div className="text-xs text-[#f7efde]/75 mt-0.5">
                {m.discovered ? `Mailbox #${m.id + 1} · Instant Warp` : 'Undiscovered · Visit region to activate'}
              </div>
            </button>
          ))}
        </div>
      </ModalShell>
    );
  }

  // PLANT SEED MODAL
  if (modal === 'plant' && payload.plotId) {
    const seeds = ['seed_bell_reed', 'seed_upside_clover', 'seed_shroom', 'seed_toast', 'seed_pickle', 'seed_pear', 'seed_moss'].filter(
      (s) => (hud.inv[s] || 0) > 0,
    );
    return (
      <ModalShell title="Plant in Mood Soil" subtitle="Place Shrooms next to Toast or Pickles for Hybrid Mutations!" onClose={onClose}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {seeds.map((sid) => {
            const it = ITEMS[sid];
            return (
              <div key={sid} className="rounded-xl bg-[#160c24]/90 border-2 border-[#2ec4b6] p-3 flex flex-col gap-1.5">
                <div className="font-display font-extrabold text-sm text-[#ffd166]">
                  {it.name} (x{hud.inv[sid]})
                </div>
                <p className="text-xs text-[#f7efde]/80">{it.desc}</p>
                <button
                  type="button"
                  onClick={() => engine.plantOnPlot(payload.plotId!, sid)}
                  className="ink-button mt-auto py-1.5 px-3 rounded-lg bg-[#2ec4b6] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer"
                >
                  Plant Seed
                </button>
              </div>
            );
          })}
        </div>
      </ModalShell>
    );
  }

  // CREATURE SOCIAL WHEEL
  if (modal === 'social' && payload.creatureId) {
    const c = engine.getCreature(payload.creatureId);
    if (!c) return null;
    const def = CREATURE_DEFS[c.type];
    const req = Math.max(1, (def.hearts || 3) - (hud.skills.includes('party_animal') ? 1 : 0));
    const favItem = def.fav ? ITEMS[def.fav] : null;
    const hasFav = def.fav ? (hud.inv[def.fav] || 0) > 0 : false;
    return (
      <ModalShell
        title={def.name}
        subtitle={`Affinity: ${c.hearts}/${req} Hearts · ${c.tamed ? 'Buddy Perk' : 'Tame Perk'}: ${def.perk}`}
        onClose={onClose}
      >
        {def.temperament && (
          <p className="text-xs text-[#2ec4b6] mb-3 font-semibold">{def.temperament}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => engine.doSocial(c.id, 'compliment')}
            className="ink-button py-3 px-4 rounded-xl bg-[#2ec4b6] text-[#160c24] font-extrabold text-sm border-2 border-[#160c24] cursor-pointer"
          >
            Compliment (+Gossip)
          </button>
          <button
            type="button"
            onClick={() => engine.doSocial(c.id, 'boop')}
            className="ink-button py-3 px-4 rounded-xl bg-[#ffd166] text-[#160c24] font-extrabold text-sm border-2 border-[#160c24] cursor-pointer"
          >
            Playful Boop (+{ITEMS[def.drop]?.name})
          </button>
          <button
            type="button"
            onClick={() => engine.startDanceOff(c.id)}
            className="ink-button py-3 px-4 rounded-xl bg-[#ff5d8f] text-[#160c24] font-extrabold text-sm border-2 border-[#160c24] cursor-pointer"
          >
            Rhythm Dance-Off (+2 Hearts)
          </button>
          <button
            type="button"
            disabled={!hasFav}
            onClick={() => engine.doSocial(c.id, 'feed')}
            className="ink-button py-3 px-4 rounded-xl bg-[#b388ff] text-[#160c24] font-extrabold text-sm border-2 border-[#160c24] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Feed {favItem?.name || 'Snack'} (+1 Heart)
          </button>
        </div>
      </ModalShell>
    );
  }

  // RHYTHM DANCE-OFF MODAL (Creatures + DJ Moss's Radio Unmelted Calibration!)
  if (modal === 'dance' && payload.creatureId) {
    const isRadio = payload.creatureId === '__radio__';
    const c = isRadio ? null : engine.getCreature(payload.creatureId);
    const def = c ? CREATURE_DEFS[c.type] : null;
    return (
      <ModalShell
        title={isRadio ? 'Radio Unmelted Live Jam' : '3-Beat Rhythm Dance-Off'}
        subtitle={`${isRadio ? 'DJ Moss Custom Signal' : def?.name || 'Buddy'} · Beats matched: ${danceHits}/3`}
        onClose={onClose}
      >
        <div className="flex flex-col items-center gap-4 py-3">
          <p className="text-xs font-bold text-[#2ec4b6] text-center">{danceFeedback}</p>
          <div className="relative w-[160px] h-[160px] flex items-center justify-center">
            <div className="w-[70px] h-[70px] rounded-full border-[5px] border-[#2ec4b6] flex items-center justify-center font-display font-black text-sm text-[#ffd166]">
              BEAT
            </div>
            <div
              className="absolute rounded-full border-[5px] border-[#ffd166] pointer-events-none"
              style={{ width: `${danceRadius}px`, height: `${danceRadius}px` }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              const res = engine.hitDanceBeat();
              setDanceHits(res.hits);
              setDanceFeedback(res.hit ? `Nice groove! (${res.hits}/3)` : 'Off-beat! Wait for the teal circle.');
            }}
            className="ink-button px-10 py-3.5 rounded-xl bg-[#ff5d8f] text-[#160c24] font-display font-black text-lg border-2 border-[#160c24] cursor-pointer"
          >
            GROOVE!
          </button>
        </div>
      </ModalShell>
    );
  }

  return null;
}
