import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Backpack,
  Coffee,
  Compass,
  Eye,
  Hammer,
  Map as MapIcon,
  Pause,
  Radio,
  Save,
  ScrollText,
  SlidersHorizontal,
  Sparkles,
  TentTree,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { CHARACTERS } from '../game/data';
import { RIBBON_TRAILS, WEATHER } from '../game/fieldwork';
import type { HudSnapshot, ModalType } from '../game/types';
import {
  CapIcon,
  GossipIcon,
  MunchIcon,
  PhaseIcon,
  SockIcon,
  VibeIcon,
  WobbleIcon,
} from './Icons';

interface GameHudProps {
  hud: HudSnapshot;
  showRadioTicker: boolean;
  minimapRef: (el: HTMLCanvasElement | null) => void;
  onOpenModal: (modal: ModalType) => void;
  onToggleMute: () => void;
  onSave: () => void;
  onPause: () => void;
  onBoop: () => void;
  onRoll: () => void;
  onAbility: () => void;
  onConsumeItem: (id: string) => void;
  onSelectCastSlot: (slot: number) => void;
  onMoveDockLamp: (slot?: number) => void;
  onStartCast: (slot?: number) => void;
  onFishingActionDown: () => void;
  onFishingReel: (pressed: boolean) => void;
  onToggleFishingAssist: () => void;
  onCancelFishing: () => void;
  onPlaceMovedBuilding: () => void;
  onRotateMovedBuilding: () => void;
  onCancelMove: () => void;
}

function shortBrewLabel(id: string, fallback: string): string {
  switch (id) {
    case 'shroom':
      return 'Shroom';
    case 'cloud_puff':
      return 'Cloud';
    case 'hyper_fizz':
      return 'Fizz';
    case 'chrono_pickle':
      return 'Chrono';
    case 'void_cocoa':
      return 'Void';
    case 'disco_overdrive':
      return 'Disco';
    case 'prism_absinthe':
      return 'Prism';
    case 'velvet_spores':
      return 'Velvet';
    case 'grounding_salt':
      return 'Decaf';
    case 'fizz_berry':
      return 'Berry';
    case 'pop_toast':
      return 'Toast';
    case 'party_bagel':
      return 'Bagel';
    case 'cosmic_truffle':
      return 'Truffle';
    case 'frost_broc':
      return 'Broc';
    case 'lens_pear':
      return 'Pear';
    case 'moon_petal':
      return 'Petal';
    case 'junk_mail':
      return 'Decoy';
    case 'perch_chowder':
      return 'Chowdr';
    case 'mirror_tartare':
      return 'Tartar';
    case 'eel_relish':
      return 'Relish';
    case 'grove_broth':
      return 'Broth';
    case 'camp_leftovers':
      return 'Skilt';
    case 'spool_perch':
      return 'Perch';
    case 'mirror_minnow':
      return 'Minnow';
    case 'upside_clover':
      return 'Clover';
    case 'tuned_reed':
      return 'T-Reed';
    case 'tide_ink':
      return 'T-Ink';
    default:
      return fallback.split(' ')[0].slice(0, 6);
  }
}

function MeterRow({
  label,
  value,
  max,
  color,
  trailColor,
  icon,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  trailColor: string;
  icon: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const [trail, setTrail] = useState(pct);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (pct >= trail) {
      setTrail(pct);
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setTrail(pct), 280);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [pct, trail]);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <div className="shrink-0">{icon}</div>
      <span className="w-[42px] sm:w-[50px] text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-[#f7efde]/85">
        {label}
      </span>
      <div className="relative flex-1 h-2.5 rounded-full bg-[#100621] border border-[#f7efde]/20 overflow-hidden">
        <div
          className="absolute inset-0 origin-left rounded-full"
          style={{ transform: `scaleX(${trail / 100})`, backgroundColor: trailColor }}
        />
        <div
          className="absolute inset-0 origin-left rounded-full"
          style={{ transform: `scaleX(${pct / 100})`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono-num text-[10px] sm:text-[11px] font-bold text-[#fffdf7] w-[22px] sm:w-[26px] text-right">
        {Math.round(value)}
      </span>
    </div>
  );
}

export function GameHud({
  hud,
  showRadioTicker,
  minimapRef,
  onOpenModal,
  onToggleMute,
  onSave,
  onPause,
  onBoop,
  onRoll,
  onAbility,
  onConsumeItem,
  onSelectCastSlot,
  onMoveDockLamp,
  onStartCast,
  onFishingActionDown,
  onFishingReel,
  onToggleFishingAssist,
  onCancelFishing,
  onPlaceMovedBuilding,
  onRotateMovedBuilding,
  onCancelMove,
}: GameHudProps) {
  const ch = CHARACTERS[hud.charId];
  const hasDecaf = (hud.inv.grounding_salt || 0) > 0;
  const isBadTrip = hud.tripMood === 'bad_trip';
  const isUneasy = hud.tripMood === 'uneasy';
  const slotNames = ['West Piling', 'Center Pool', 'East Cove'];
  const f = hud.fishing;
  const weather = WEATHER[hud.weather.current];
  const ribbon = hud.fieldwork.trail;
  const fishingPhaseLabel =
    f.phase === 'casting'
      ? 'Casting line...'
      : f.phase === 'waiting'
        ? 'Watching cork...'
        : f.phase === 'nibble_1'
          ? 'Nibble... steady!'
          : f.phase === 'nibble_2'
            ? 'Second tug... get ready!'
            : f.phase === 'bite'
              ? 'DIVE! HOOK NOW [Space]'
              : f.phase === 'tension'
                ? f.fishPulling
                  ? 'PULLING! GIVE SLACK!'
                  : 'CALM! REEL IN!'
                : f.phase === 'landed'
                  ? 'LANDED!'
                  : f.phase === 'escaped'
                    ? 'LINE SLIPPED!'
                    : 'Ready to Cast';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {/* TOP-LEFT: Vitality Cluster */}
      <div className="fixed top-3 left-3 flex flex-col gap-1.5 w-[min(196px,calc(100vw-172px))] sm:w-[238px]">
        <div className="ink-panel rounded-2xl px-2.5 py-2 sm:px-3 sm:py-2.5 flex flex-col gap-1.5 pointer-events-auto">
          <MeterRow
            label="Vibe"
            value={hud.vibe}
            max={hud.maxVibe}
            color="#ff5d8f"
            trailColor="#ffd166"
            icon={<VibeIcon className="w-4 h-4" />}
          />
          <MeterRow
            label="Munch"
            value={hud.munch}
            max={hud.maxMunch}
            color="#ffd166"
            trailColor="#f4a261"
            icon={<MunchIcon className="w-4 h-4" />}
          />
          <MeterRow
            label="Wobble"
            value={hud.wobble}
            max={100}
            color={hud.wobble >= 82 ? '#ff3b8d' : '#2ec4b6'}
            trailColor="#b388ff"
            icon={<WobbleIcon className="w-4 h-4" />}
          />

          {/* Compact unboxed currency & XP line */}
          <div className="flex items-center justify-between gap-2 pt-1.5 mt-0.5 border-t border-[#f7efde]/12 text-[11px] font-mono-num text-[#f7efde]/90">
            <span className="inline-flex items-center gap-1" title="Bottlecaps">
              <CapIcon /> {hud.caps}
            </span>
            <span className="inline-flex items-center gap-1" title="Juicy Gossip">
              <GossipIcon /> {hud.gossip}
            </span>
            <span className="inline-flex items-center gap-1" title="Missing Left Socks">
              <SockIcon /> {hud.socks}
            </span>
            <span className="text-[#ffd166] font-bold pl-1">
              XP {hud.xp}/{hud.xpNext}
            </span>
          </div>
        </div>

        {/* Visible Region Timing Cue (100% readable when muted or in Reduced Motion) */}
        {hud.timingCue && (
          <div
            className="px-2.5 py-1.5 rounded-xl bg-[#160c24]/92 border-2 text-[11px] font-bold"
            style={{ borderColor: hud.timingCue.warning ? '#ffd166' : hud.timingCue.accent }}
          >
            <div className="flex items-center justify-between gap-2 text-[#fffdf7]">
              <span className="truncate">{hud.timingCue.label}</span>
              {hud.timingCue.warning && <span className="text-[#ffd166] font-mono-num shrink-0">SOON</span>}
            </div>
            <div className="h-1.5 rounded-full bg-[#100621] mt-1 overflow-hidden">
              <div
                className="h-full origin-left rounded-full"
                style={{
                  transform: `scaleX(${Math.max(0, Math.min(1, hud.timingCue.progress))})`,
                  backgroundColor: hud.timingCue.warning ? '#ffd166' : hud.timingCue.accent,
                }}
              />
            </div>
          </div>
        )}

        {/* Active State-Grounded Regional Event Bulletin */}
        {hud.regionalEvent && (
          <button
            type="button"
            data-testid="hud-regional-event-btn"
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenModal('regional_event');
            }}
            className="pointer-events-auto text-left px-2.5 py-1.5 rounded-xl bg-[#24120c]/95 border-2 border-[#ffd166] text-[11px] font-bold cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 text-[#ffd166]">
              <span className="truncate">★ {hud.regionalEvent.title}</span>
              <span className="font-mono-num text-[10px] shrink-0">OPEN</span>
            </div>
            <div className="text-[10px] text-[#f7efde]/80 truncate">
              Eyewitness: {hud.regionalEvent.eyewitnessName}
            </div>
          </button>
        )}

        {/* Subtle Camp Shelter or Lost Satchel Reminder */}
        {hud.droppedSatchel ? (
          <div
            data-testid="hud-satchel-reminder"
            className="px-2.5 py-1 rounded-xl bg-[#160c24]/92 border border-[#ffd166]/70 text-[10.5px] font-bold text-[#ffd166] truncate"
          >
            Lost Satchel waiting in {hud.droppedSatchel.biomeName}
          </div>
        ) : (
          hud.campShelter.sheltered && (
            <div
              data-testid="hud-shelter-badge"
              className="px-2.5 py-1 rounded-xl bg-[#102622]/92 border border-[#2ec4b6]/70 text-[10.5px] font-bold text-[#72efdd] truncate"
            >
              ★ Sheltered Camp (-50% night chill)
            </div>
          )
        )}

        {/* Perceptual Trip Mood, Pharmacokinetic Stage & Cross-Trip Synergy Readout */}
        {(hud.tripMood !== 'sober' || hud.activeTrips.length > 0 || hud.nearCalmingTotem) && (
          <div
            data-testid="trip-status-panel"
            data-trip-mood={hud.tripMood}
            data-trip-stage={hud.tripStage}
            data-trip-synergy={hud.tripSynergy?.id || ''}
            className={`px-2.5 py-2 rounded-xl border-2 pointer-events-auto ${
              isBadTrip
                ? 'bg-[#1a0826]/95 border-[#ff3b8d]'
                : isUneasy
                  ? 'bg-[#1d112b]/94 border-[#ffd166]'
                  : hud.tripSynergy
                    ? 'bg-[#170b2b]/94 border-[#ffd166]'
                    : 'bg-[#160c24]/90 border-[#2ec4b6]/75'
            }`}
          >
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <span
                className={`inline-flex items-center gap-1.5 min-w-0 flex-1 text-[11px] font-display font-black tracking-wide uppercase ${
                  isBadTrip ? 'text-[#a8ff3e]' : isUneasy ? 'text-[#ffd166]' : 'text-[#ffd166]'
                }`}
              >
                {isBadTrip ? (
                  <Eye className="w-3.5 h-3.5 text-[#ff3b8d] shrink-0" />
                ) : isUneasy ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-[#ffd166] shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-[#2ec4b6] shrink-0" />
                )}
                <span className="truncate">{hud.tripLabel}</span>
              </span>
              {isBadTrip ? (
                <span className="font-mono-num text-[10px] font-extrabold text-[#ff3b8d] shrink-0">
                  T{hud.badTripTier} · {Math.round(hud.badTripIntensity * 100)}%
                </span>
              ) : (
                hud.tripStage && (
                  <span
                    className="font-mono-num text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#100621] border border-[#f7efde]/20 shrink-0"
                    style={{
                      color:
                        hud.tripStage === 'peak'
                          ? '#ff5d8f'
                          : hud.tripStage === 'onset'
                            ? '#ffd166'
                            : '#72efdd',
                    }}
                  >
                    {hud.tripStage}
                  </span>
                )
              )}
            </div>

            {hud.tripStage && (
              <div className="mt-1.5">
                <div className="h-1.5 rounded-full bg-[#100621] overflow-hidden border border-[#f7efde]/12">
                  <div
                    className="h-full origin-left rounded-full"
                    style={{
                      transform: `scaleX(${Math.max(0.04, Math.min(1, hud.tripStageProgress))})`,
                      backgroundColor: isBadTrip
                        ? '#ff3b8d'
                        : hud.tripStage === 'peak'
                          ? '#ff5d8f'
                          : hud.tripStage === 'onset'
                            ? '#ffd166'
                            : '#72efdd',
                    }}
                  />
                </div>
              </div>
            )}

            {hud.tripSynergy && (
              <div
                className="mt-1.5 px-2 py-1 rounded-lg bg-[#100621]/90 border text-[10px] leading-tight"
                style={{ borderColor: hud.tripSynergy.accent }}
              >
                <div className="font-display font-black uppercase tracking-wide" style={{ color: hud.tripSynergy.accent }}>
                  ✦ SYNERGY · {hud.tripSynergy.name}
                </div>
                <div className="text-[#f7efde]/82 mt-0.5">{hud.tripSynergy.bonusDesc}</div>
              </div>
            )}

            {hud.activeTrips.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold font-mono-num">
                {hud.activeTrips.map((tr) => (
                  <span key={tr.id} style={{ color: tr.accent }}>
                    {tr.name} {Math.ceil(tr.rem)}s
                  </span>
                ))}
              </div>
            )}

            <div className="mt-1 text-[10px] leading-snug text-[#f7efde]/85">{hud.tripAdvice}</div>

            {hud.nearCalmingTotem && (
              <div className="mt-1 text-[10px] font-extrabold text-[#b388ff]">
                ✦ Dreamcatcher Aura: Bad Trips suppressed
              </div>
            )}

            {(isBadTrip || isUneasy) && hasDecaf && (
              <button
                type="button"
                onClick={() => onConsumeItem('grounding_salt')}
                className="ink-button mt-1.5 w-full py-1 px-2 rounded-lg bg-[#a8ff3e] hover:bg-[#beff6b] text-[#160c24] border-2 border-[#160c24] text-[10px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Coffee className="w-3 h-3 stroke-[2.6]" />
                <span>Sip Boring Decaf (Ground Now)</span>
              </button>
            )}
          </div>
        )}

        {hud.ghostTimer > 0 && (
          <div className="px-2.5 py-1.5 rounded-lg bg-[#ff3b8d] text-[#160c24] text-xs font-extrabold border-2 border-[#160c24]">
            GHOST MODE · Refuge {hud.nearestRefugeDist}m · {hud.ghostTimer}s
          </div>
        )}

        {hud.exp && (
          <div className="px-2.5 py-1 rounded-lg bg-[#160c24]/90 border border-[#ffd166]/70 text-[11px] font-bold text-[#f7efde] font-mono-num">
            Event: <span style={{ color: hud.exp.accent }}>{hud.exp.name}</span> · {hud.exp.rem}s
          </div>
        )}

        {hud.elevation === 1 && (
          <div className="px-2.5 py-1 rounded-lg bg-[#2d1a4b]/92 border border-[#ffd166]/70 text-[11px] font-extrabold text-[#ffd166]">
            Elevated Level · Rooftop Walk
          </div>
        )}
      </div>

      {/* TOP-RIGHT: World Clock, Minimap & Utility Buttons */}
      <div className="fixed top-3 right-3 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto">
          <button
            type="button"
            aria-label="Audio & Motion Settings"
            onClick={() => onOpenModal('settings')}
            className="ink-button w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#180c2a]/92 border-2 border-[#b388ff] text-[#b388ff] flex items-center justify-center cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
            onClick={onToggleMute}
            className="ink-button w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#180c2a]/92 border-2 border-[#2ec4b6] text-[#f7efde] flex items-center justify-center cursor-pointer"
          >
            {hud.muted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ff5d8f]" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2ec4b6]" />}
          </button>
          <button
            type="button"
            aria-label="Save progress"
            onClick={onSave}
            className="ink-button w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#180c2a]/92 border-2 border-[#ffd166] text-[#ffd166] flex items-center justify-center cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            aria-label="Pause game"
            onClick={onPause}
            className="ink-button w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#180c2a]/92 border-2 border-[#f7efde]/50 text-[#f7efde] flex items-center justify-center cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        <button
          type="button"
          aria-label="Camp Ledger"
          onClick={() => onOpenModal('fieldwork')}
          className="ink-button flex max-w-[140px] items-center gap-2 rounded-xl border border-[#72efdd]/50 bg-[#122832]/95 px-2.5 py-2 text-left pointer-events-auto cursor-pointer sm:max-w-none"
        >
          <TentTree size={16} className="shrink-0 text-[#72efdd]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-[11px] font-extrabold leading-tight text-[#f7efde]">Camp Ledger <span className="hidden sm:inline text-[#72efdd]">[H]</span></span>
            <span className="block truncate text-[10px] font-bold" style={{ color: weather.color }}>{weather.name}{hud.weather.active && ' · Active'}</span>
          </span>
        </button>

        {ribbon && (
          <div data-testid="ribbon-trail-timer" className="w-32 rounded-lg border border-[#ffd166]/60 bg-[#211238]/95 p-2 text-xs leading-tight sm:w-44">
            <p className="font-black text-[#ffd166]">{RIBBON_TRAILS[ribbon.id].name}</p>
            <p className="mt-0.5 text-[#f7efde]">{ribbon.gate ? `${ribbon.gate}/${ribbon.total} · ${ribbon.seconds.toFixed(1)}s` : 'Reach the start'}</p>
            {ribbon.gate > 0 && <p className="mt-0.5 text-[10px] text-[#72efdd]">{ribbon.roll ? 'Roll · ' : ''}{ribbon.label}</p>}
          </div>
        )}

        <div className="flex items-start gap-2">
          {/* Biome, Active Quest & Waypoint */}
          <div className="hidden sm:flex flex-col items-end text-right ink-panel-teal rounded-2xl px-3 py-2 pointer-events-auto max-w-[230px]">
            <div className="font-display font-extrabold text-[13px] text-[#2ec4b6] leading-tight">
              {hud.biomeName}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#ffd166] mt-0.5 font-mono-num">
              <PhaseIcon phase={hud.phaseId} className="w-3.5 h-3.5" />
              <span>{hud.phaseName}</span>
              <span aria-hidden="true">·</span>
              <span>Day {hud.day}</span>
            </div>
            <button
              type="button"
              aria-label="Quests"
              onClick={() => onOpenModal('quests')}
              className="mt-1 text-[11px] font-semibold text-[#f7efde]/85 hover:text-[#ffd166] cursor-pointer truncate max-w-full"
            >
              Quest: {hud.activeQuestTitle} ({hud.activeQuestProgress})
            </button>
            {hud.waypoint && hud.waypointDist !== null && (
              <button
                type="button"
                onClick={() => onOpenModal('atlas')}
                className="mt-0.5 text-[10px] font-bold text-[#ffd166]/90 hover:underline cursor-pointer truncate max-w-full font-mono-num"
              >
                Pin: {hud.waypoint.label} · {hud.waypointDist}m
              </button>
            )}
          </div>

          {/* Clickable Minimap -> Opens County Atlas */}
          <button
            type="button"
            aria-label="Open County Atlas"
            onClick={() => onOpenModal('atlas')}
            className="rounded-full p-1 bg-[#160c24]/92 border-[2.5px] border-[#2ec4b6] hover:border-[#ffd166] shadow-md pointer-events-auto cursor-pointer"
          >
            <canvas ref={minimapRef} width={74} height={74} className="block rounded-full" aria-label="World minimap" />
          </button>
        </div>
      </div>

      {/* GROVE RADIO BROADCAST TICKER (when near Mailbox Square after restoring Radio Unmelted) */}
      {hud.radioBroadcastLine && showRadioTicker && (
        <div className="fixed top-[192px] sm:top-4 left-1/2 -translate-x-1/2 max-w-[90vw] sm:max-w-[500px] px-3.5 py-1.5 rounded-xl bg-[#160c24]/94 border-2 border-[#ff5d8f] text-[#ffd166] text-xs font-bold flex items-center gap-2 shadow-lg">
          <Radio className="w-4 h-4 text-[#ff5d8f] shrink-0" />
          <span className="truncate">{hud.radioBroadcastLine}</span>
        </div>
      )}

      {/* BUILDING RELOCATION BANNER */}
      {hud.movingBuildingId && (
        <div
          data-testid="move-building-banner"
          className="fixed bottom-[126px] xl:bottom-[72px] left-1/2 -translate-x-1/2 w-[92vw] max-w-[420px] px-3.5 py-2.5 rounded-2xl bg-[#160c24]/95 border-2 border-[#ffd166] pointer-events-auto flex flex-col gap-2 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-[#ffd166]">
            <span>Moving Camp Furniture · Walk to spot</span>
            <span className="font-mono-num text-[10px] text-[#2ec4b6]">[Space] Place · [R] Rotate</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPlaceMovedBuilding}
              className="ink-button flex-1 py-1.5 px-3 rounded-lg bg-[#ffd166] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer"
            >
              Place Here
            </button>
            <button
              type="button"
              onClick={onRotateMovedBuilding}
              className="ink-button py-1.5 px-3 rounded-lg bg-[#2ec4b6] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer"
            >
              Rotate 90°
            </button>
            <button
              type="button"
              onClick={onCancelMove}
              className="ink-button py-1.5 px-3 rounded-lg bg-[#2d1a4b] text-[#f7efde] font-bold text-xs border border-[#f7efde]/30 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* DELTA PUBLIC BANK & TACTILE FISHING PANEL */}
      {(hud.nearDock || f.active) && !hud.movingBuildingId && (
        <div
          data-testid="fishing-hud-panel"
          className="fixed bottom-[126px] xl:bottom-[74px] left-1/2 -translate-x-1/2 w-[94vw] max-w-[460px] px-3 py-2.5 rounded-2xl bg-[#160c24]/95 border-2 border-[#72efdd] pointer-events-auto flex flex-col gap-2 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-display font-black text-xs sm:text-sm text-[#72efdd] truncate">
                {f.active ? fishingPhaseLabel : 'Delta Public Bank · Loaner Reed Rod Ready'}
              </div>
              <div className="text-[10px] font-bold text-[#f7efde]/80 truncate">
                Lamp on {slotNames[hud.dockLampSlot]} ·{' '}
                {hud.dockReflectionIntact ? (
                  <span className="text-[#ffd166]">Reflection CALM (Mirror Minnow drawn!)</span>
                ) : (
                  <span className="text-[#ff85b3]">Wake rippling — settling...</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleFishingAssist}
              className={`ink-button shrink-0 px-2 py-1 rounded-lg text-[10px] font-extrabold border cursor-pointer ${
                f.toggleAssist
                  ? 'bg-[#2ec4b6] text-[#160c24] border-[#160c24]'
                  : 'bg-[#2d1a4b] text-[#f7efde]/85 border-[#f7efde]/25'
              }`}
            >
              {f.toggleAssist ? 'Assist: ON' : 'Assist: OFF'}
            </button>
          </div>

          {!f.active ? (
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-3 gap-1.5">
                {[0, 1, 2].map((slotIdx) => {
                  const selected = f.castSlot === slotIdx;
                  const lit = hud.dockLampSlot === slotIdx;
                  return (
                    <button
                      key={slotIdx}
                      type="button"
                      onClick={() => onSelectCastSlot(slotIdx)}
                      className={`ink-button py-1.5 px-2 rounded-lg text-[10.5px] font-extrabold border-2 cursor-pointer ${
                        selected
                          ? 'bg-[#2d1a4b] border-[#ffd166] text-[#fffdf7]'
                          : 'bg-[#100621] border-[#f7efde]/20 text-[#f7efde]/80'
                      }`}
                    >
                      {slotNames[slotIdx].split(' ')[0]} {lit ? '✦' : ''}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="move-dock-lamp-btn"
                  onClick={() => onMoveDockLamp()}
                  className="ink-button py-1.5 px-3 rounded-lg bg-[#ffd166] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer whitespace-nowrap"
                >
                  Move Lamp [L]
                </button>
                <button
                  type="button"
                  data-testid="cast-line-btn"
                  onClick={() => onStartCast(f.castSlot)}
                  className="ink-button flex-1 py-1.5 px-3 rounded-lg bg-[#2ec4b6] text-[#160c24] font-display font-black text-xs border-2 border-[#160c24] cursor-pointer"
                >
                  Cast Into {slotNames[f.castSlot]} [Space]
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {f.phase === 'tension' && (
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
                  <div>
                    <div className="flex justify-between text-[#ffd166]">
                      <span>Line Tension</span>
                      <span className="font-mono-num">{Math.round(f.tension)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#100621] border border-[#f7efde]/20 overflow-hidden mt-0.5">
                      <div
                        className="h-full origin-left rounded-full"
                        style={{
                          transform: `scaleX(${Math.max(0.02, Math.min(1, f.tension / 100))})`,
                          backgroundColor: f.tension > 78 ? '#ff3b8d' : f.tension > 55 ? '#ffd166' : '#2ec4b6',
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[#72efdd]">
                      <span>Reel In</span>
                      <span className="font-mono-num">{Math.round(f.progress)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#100621] border border-[#f7efde]/20 overflow-hidden mt-0.5">
                      <div
                        className="h-full origin-left rounded-full bg-[#72efdd]"
                        style={{ transform: `scaleX(${Math.max(0.02, Math.min(1, f.progress / 100))})` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="fishing-action-btn"
                  onPointerDown={(e) => {
                    if (!e.isPrimary || e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    onFishingActionDown();
                  }}
                  onLostPointerCapture={() => {
                    if (!f.toggleAssist) onFishingReel(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== ' ' && e.key !== 'Enter') return;
                    e.preventDefault();
                    if (!e.repeat) onFishingActionDown();
                  }}
                  onKeyUp={(e) => {
                    if (e.key !== ' ' && e.key !== 'Enter') return;
                    e.preventDefault();
                    if (!f.toggleAssist) onFishingReel(false);
                  }}
                  onBlur={() => {
                    if (!f.toggleAssist) onFishingReel(false);
                  }}
                  onClick={(e) => {
                    if (e.detail !== 0) return;
                    onFishingActionDown();
                    if (!f.toggleAssist) onFishingReel(false);
                  }}
                  className={`ink-button touch-none flex-1 py-2 px-4 rounded-xl font-display font-black text-sm border-2 border-[#160c24] cursor-pointer ${
                    f.phase === 'bite'
                      ? 'bg-[#a8ff3e] text-[#160c24]'
                      : f.phase === 'tension'
                        ? f.fishPulling
                          ? 'bg-[#ff5d8f] text-[#160c24]'
                          : 'bg-[#ffd166] text-[#160c24]'
                        : 'bg-[#2d1a4b] text-[#f7efde]'
                  }`}
                >
                  {f.phase === 'bite'
                    ? 'HOOK NOW!'
                    : f.phase === 'tension'
                      ? f.toggleAssist
                        ? f.reelHeld
                          ? 'Reeling (Tap to Give Slack)'
                          : 'Slack (Tap to Reel)'
                        : f.fishPulling
                          ? 'RELEASE TO GIVE SLACK!'
                          : 'HOLD TO REEL IN'
                      : 'Wait for Bite...'}
                </button>
                <button
                  type="button"
                  onClick={onCancelFishing}
                  className="ink-button py-2 px-3 rounded-xl bg-[#2d1a4b] text-[#f7efde] font-bold text-xs border border-[#f7efde]/30 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOTTOM-LEFT: Quick-Sip Brews Strip (1-5 hotkeys; stacks cleanly above dock below xl) */}
      {hud.quickSlots.length > 0 && (
        <div
          aria-label="Quick-Sip Brews"
          className="fixed bottom-[64px] xl:bottom-3 left-3 flex items-center gap-1 sm:gap-1.5 pointer-events-auto"
        >
          {hud.quickSlots.slice(0, 5).map((slot, idx) => {
            const isAntidoteAlert = (isBadTrip || isUneasy) && slot.id === 'grounding_salt';
            return (
              <button
                key={slot.id}
                type="button"
                title={`[${idx + 1}] ${slot.name} (x${slot.qty})`}
                onClick={() => onConsumeItem(slot.id)}
                className={`ink-button ${
                  idx >= 3 ? 'hidden sm:flex' : 'flex'
                } flex-col items-start justify-between w-11 min-[380px]:w-[54px] sm:w-[64px] px-1 sm:px-1.5 py-1.5 rounded-xl bg-[#180c2a]/94 border-2 text-left cursor-pointer`}
                style={{
                  borderColor: isAntidoteAlert ? '#a8ff3e' : slot.accent,
                }}
              >
                <div className="w-full flex items-center justify-between gap-1 leading-none">
                  <span className="font-mono-num text-[9px] font-extrabold text-[#f7efde]/70">[{idx + 1}]</span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: isAntidoteAlert ? '#a8ff3e' : slot.accent }}
                  />
                </div>
                <span className="mt-1 text-[10px] font-extrabold text-[#fffdf7] leading-tight truncate w-full">
                  {shortBrewLabel(slot.id, slot.name)}
                </span>
                <span className="font-mono-num text-[9px] font-bold text-[#ffd166] leading-none mt-0.5">
                  x{slot.qty}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* BOTTOM-CENTER: RPG Menu Dock */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-1.5 pointer-events-auto max-w-[calc(100vw-16px)]">
        <button
          type="button"
          aria-label="Atlas"
          onClick={() => onOpenModal('atlas')}
          className="ink-button flex h-11 min-w-11 items-center justify-center gap-1.5 px-2 sm:h-auto sm:px-3 sm:py-2 rounded-xl bg-[#180c2a]/94 border-2 border-[#2ec4b6] text-[#f7efde] text-xs font-extrabold cursor-pointer whitespace-nowrap"
        >
          <MapIcon className="w-4 h-4 text-[#2ec4b6]" />
          <span className="hidden sm:inline">Atlas</span>
        </button>

        <button
          type="button"
          aria-label="Bag"
          onClick={() => onOpenModal('bag')}
          className="ink-button flex h-11 min-w-11 items-center justify-center gap-1.5 px-2 sm:h-auto sm:px-3 sm:py-2 rounded-xl bg-[#180c2a]/94 border-2 border-[#2ec4b6] text-[#f7efde] text-xs font-extrabold cursor-pointer whitespace-nowrap"
        >
          <Backpack className="w-4 h-4 text-[#2ec4b6]" />
          <span className="hidden sm:inline">Bag</span>
        </button>

        <button
          type="button"
          aria-label="Craft"
          onClick={() => onOpenModal('craft')}
          className="ink-button flex h-11 min-w-11 items-center justify-center gap-1.5 px-2 sm:h-auto sm:px-3 sm:py-2 rounded-xl bg-[#180c2a]/94 border-2 border-[#ff5d8f] text-[#f7efde] text-xs font-extrabold cursor-pointer whitespace-nowrap"
        >
          <Hammer className="w-4 h-4 text-[#ff5d8f]" />
          <span className="hidden sm:inline">Craft</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenModal('style')}
          aria-label="Styles"
          className="ink-button flex h-11 min-w-11 items-center justify-center gap-1.5 px-2 sm:h-auto sm:px-3 sm:py-2 rounded-xl bg-[#180c2a]/94 border-2 border-[#ffd166] text-[#f7efde] text-xs font-extrabold cursor-pointer whitespace-nowrap"
        >
          <Compass className="w-4 h-4 text-[#ffd166]" />
          <span className="hidden sm:inline">Styles</span>
        </button>

        <button
          type="button"
          aria-label="Skills"
          onClick={() => onOpenModal('skills')}
          className="ink-button flex h-11 min-w-11 items-center justify-center gap-1.5 px-2 sm:h-auto sm:px-3 sm:py-2 rounded-xl bg-[#180c2a]/94 border-2 border-[#b388ff] text-[#f7efde] text-xs font-extrabold cursor-pointer whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4 text-[#b388ff]" />
          <span className="hidden sm:inline">Skills</span>
          {hud.sp > 0 && <span className="hidden sm:inline font-mono-num text-[#ffd166]">({hud.sp})</span>}
        </button>

        <button
          type="button"
          aria-label="Quests"
          onClick={() => onOpenModal('quests')}
          className="ink-button flex h-11 min-w-11 items-center justify-center gap-1.5 px-2 sm:h-auto sm:px-3 sm:py-2 rounded-xl bg-[#180c2a]/94 border-2 border-[#ffd166] text-[#f7efde] text-xs font-extrabold cursor-pointer whitespace-nowrap"
        >
          <ScrollText className="w-4 h-4 text-[#ffd166]" />
          <span className="hidden sm:inline">Quests</span>
          {hud.unclaimedQuests > 0 && <span className="hidden sm:inline font-mono-num text-[#2ec4b6]">+{hud.unclaimedQuests}</span>}
        </button>
      </div>

      {/* BOTTOM-RIGHT: Action Controls (stacked above dock on narrow mobile so zero overlap) */}
      <div className="fixed bottom-[64px] xl:bottom-3 right-3 flex items-end gap-1 min-[380px]:gap-2 pointer-events-auto">
        <button
          type="button"
          aria-label="Wormhole Roll"
          onClick={onRoll}
          className={`ink-button flex flex-col items-center justify-center size-11 min-[380px]:size-12 rounded-full border-2 border-[#160c24] font-extrabold text-[10px] cursor-pointer ${
            hud.rollCd > 0 ? 'bg-[#2d1a4b] text-[#f7efde]/50' : 'bg-[#b388ff] text-[#160c24]'
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          <span className="font-mono-num leading-none mt-0.5">
            {hud.rollCd > 0 ? `${hud.rollCd.toFixed(1)}s` : 'ROLL'}
          </span>
        </button>

        <button
          type="button"
          aria-label={`Use ${ch.ability.name}`}
          onClick={onAbility}
          className={`ink-button flex flex-col items-center justify-center size-11 min-[380px]:size-12 rounded-full border-2 border-[#160c24] font-extrabold text-[10px] cursor-pointer ${
            hud.abCd > 0 ? 'bg-[#2d1a4b] text-[#f7efde]/50' : 'bg-[#2ec4b6] text-[#160c24]'
          }`}
        >
          <span className="text-[9px] uppercase leading-none">[E]</span>
          <span className="font-mono-num leading-none mt-0.5">
            {hud.abCd > 0 ? `${Math.ceil(hud.abCd)}s` : 'SKILL'}
          </span>
        </button>

        <button
          type="button"
          aria-label="Boop interact or attack"
          onClick={onBoop}
          className="ink-button flex flex-col items-center justify-center size-12 min-[380px]:size-15 rounded-full bg-[#ffd166] hover:bg-[#ffdb82] text-[#160c24] border-[2.5px] border-[#160c24] font-display font-black text-xs cursor-pointer"
        >
          <span>BOOP!</span>
          <span className="text-[9px] font-sans font-bold opacity-75">Space</span>
        </button>
      </div>
    </div>
  );
}
