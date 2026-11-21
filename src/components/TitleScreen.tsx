import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CHARACTERS } from '../game/data';
import type { CharacterId } from '../game/types';
import { CharacterPortrait, DontMeltEmblem } from './Icons';
import countyCover from '../assets/unmelted-county-cover.jpg';

interface TitleScreenProps {
  selectedChar: CharacterId;
  onSelectChar: (id: CharacterId) => void;
  onStart: () => void;
  hasSave: boolean;
  onResume: () => void;
}

const CHAR_LIST: CharacterId[] = [
  'pip',
  'barnaby',
  'djmoss',
  'gerald',
  'tilda',
  'brin',
  'solfa',
  'marlo',
  'bea',
  'gus',
  'nori',
  'mossie',
];

export function TitleScreen({ selectedChar, onSelectChar, onStart, hasSave, onResume }: TitleScreenProps) {
  const radioGroup = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey ||
          (e.target instanceof Element && e.target.closest('button, input, select, textarea, a[href], [contenteditable]'))) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        const idx = (CHAR_LIST.indexOf(selectedChar) + 1) % CHAR_LIST.length;
        onSelectChar(CHAR_LIST[idx]);
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        const idx = (CHAR_LIST.indexOf(selectedChar) - 1 + CHAR_LIST.length) % CHAR_LIST.length;
        onSelectChar(CHAR_LIST[idx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedChar, onSelectChar, onStart]);

  function onRadioKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const offset = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 :
      ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
    if (!offset) return;
    event.preventDefault();
    const index = (CHAR_LIST.indexOf(selectedChar) + offset + CHAR_LIST.length) % CHAR_LIST.length;
    onSelectChar(CHAR_LIST[index]);
    radioGroup.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[index]?.focus();
  }

  const activeChar = CHARACTERS[selectedChar];

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between pointer-events-none">
      <img src={countyCover} alt="" fetchPriority="high" className="absolute inset-0 size-full object-cover object-[58%_center] sm:object-center" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#160c24]/95 via-[#160c24]/65 to-[#160c24]/25 sm:to-[#160c24]/0" />

      {/* Main asymmetric left composition */}
      <div className="relative z-10 min-h-0 flex-1 flex px-4 sm:px-10 lg:px-14 py-3 overflow-y-auto overscroll-contain pointer-events-auto">
        <div className="w-full max-w-[600px] my-auto flex flex-col gap-3">
          <DontMeltEmblem className="w-full max-w-[270px] sm:max-w-[300px] h-auto" />

          <p className="max-w-[430px] text-sm leading-relaxed text-[#f7efde]">
            Scout fifteen impossible regions, build a camp with your companions, and keep Unmelted County on the air.
          </p>

          {/* Character Selector (All 12 Playable Leads) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between text-xs font-bold tracking-wide text-[#ffd166]">
              <span>Choose your wanderer</span>
              <span className="text-[#f7efde]/75 font-semibold truncate ml-2">{activeChar.title}</span>
            </div>

            <div
              ref={radioGroup}
              onKeyDown={onRadioKey}
              className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[218px] sm:max-h-none overflow-y-auto storybook-scroll pr-0.5"
              role="radiogroup"
              aria-label="Choose playable character"
            >
              {CHAR_LIST.map((id) => {
                const c = CHARACTERS[id];
                const isSelected = id === selectedChar;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    data-testid={`select-char-${id}`}
                    aria-checked={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => onSelectChar(id)}
                    className={`ink-button flex items-center gap-2 px-2 py-1.5 rounded-xl text-left cursor-pointer border-2 ${
                      isSelected
                        ? 'bg-[#2d1a4b] border-[#ffd166] text-[#fffdf7]'
                        : 'bg-[#1a0d2e]/90 border-[#f7efde]/20 text-[#f7efde]/80 hover:border-[#ffd166]/60'
                    }`}
                  >
                    <CharacterPortrait id={id} className="w-8 h-8 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-display font-extrabold text-[11.5px] leading-tight truncate">{c.name}</div>
                      <div className="text-[10px] text-[#2ec4b6] font-semibold truncate">{c.ability.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Character Perk Summary */}
            <div className="px-3 py-2 rounded-xl bg-[#160c24]/88 border border-[#f7efde]/15 text-xs leading-snug text-[#f7efde]/90">
              <div className="font-bold text-[#ffd166]">{activeChar.tagline}</div>
              <div className="mt-0.5 text-[#f7efde]/82">{activeChar.perk}</div>
            </div>
          </div>

          {/* Primary Start / Resume CTAs (<= 2 actions) */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-0.5">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="ink-button flex-1 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-[#ffd166] hover:bg-[#ffdb82] text-[#160c24] font-display font-black text-base sm:text-lg tracking-tight border-2 border-[#160c24] cursor-pointer whitespace-nowrap"
            >
              Start Adventure
            </button>

            {hasSave && (
              <button
                type="button"
                onClick={onResume}
                className="ink-button px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-[#2ec4b6] hover:bg-[#3ad6c8] text-[#160c24] font-display font-extrabold text-sm sm:text-base border-2 border-[#160c24] cursor-pointer whitespace-nowrap"
              >
                Resume Save
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Single flat borderless control-hint line */}
      <div className="relative z-10 bg-[#160c24]/80 px-4 sm:px-10 pb-2.5 pt-1 text-[11px] font-semibold text-[#f7efde]/75 tracking-wide">
        WASD Move · Space Boop/Hook · Shift Roll · E Ability · G Atlas · H Camp Ledger · 1–5 Quick Sip · Esc Pause
      </div>
    </div>
  );
}
