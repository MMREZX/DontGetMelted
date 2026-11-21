import { CloudSun, Fish, Flag, MapPin, TentTree } from 'lucide-react';
import { BIOMES, ITEMS } from '../game/data';
import type { GameEngine } from '../game/engine';
import { CAMP_JOBS, MAX_CAMP_PROVISIONS, RIBBON_TRAILS, WEATHER } from '../game/fieldwork';
import type { CampJob, TrailId } from '../game/fieldwork';
import type { HudSnapshot } from '../game/types';
import { countSites, hollowReady, millpondReady, restorationPercent } from '../game/expeditions';

const jobs = Object.keys(CAMP_JOBS) as CampJob[];
const trails = Object.keys(RIBBON_TRAILS) as TrailId[];

const action = 'ink-button rounded-lg border px-3 py-2 text-xs font-extrabold enabled:cursor-pointer disabled:opacity-45';

function ExpeditionNotes({ hud, engine }: { hud: HudSnapshot; engine: GameEngine }) {
  const { millpond, hollow } = hud.expeditions;
  const cta = `${action} min-h-11 border-[#72efdd]/50 text-[#72efdd]`;
  const restored = restorationPercent(hud.expeditions);
  return (
    <section aria-labelledby="field-expeditions" className="rounded-xl border border-[#72efdd]/40 bg-[#122330] p-3 sm:p-4">
      <h3 id="field-expeditions" className="flex items-center gap-2 font-display text-lg font-black text-[#72efdd]">
        <MapPin size={18} aria-hidden="true" /> Restoration field notes
      </h3>
      <p className="mt-1 text-xs text-[#f7efde]">Field expeditions restored {restored}% · County broadcast sites {hud.countySync.restoredCount}/{hud.countySync.totalRestorations}</p>
      {hud.landmarkCue && <p className="mt-1 text-xs font-bold text-[#fff1cf]">Nearby landmark · {hud.landmarkCue}</p>}
      <div className="mt-3 grid gap-3">
        <div className="rounded-lg bg-[#160c24] p-3">
          <h4 className="font-display text-sm font-black text-[#72efdd]">The Singing Millpond</h4>
          {millpond.status === 'restored' ? <p className="mt-1 text-xs text-[#f7efde]">Restored. Cool-Mint Brew is available in Craft.</p> : (
            <>
              <p className="mb-2 mt-1 text-xs text-[#f7efde]">Tie two ribbons on the east road, catch a Reed Perch, and gather two Cool-Mint sprigs. The sunlit bank gets faster bites. The willow bank helps you cool down.</p>
              {millpond.status === 'active' && <ul className="mb-2 flex flex-wrap gap-x-3 text-xs font-bold text-[#fff1cf]">
                <li>Ribbons {countSites(millpond.ribbons)}/2</li><li>Reed Perch {Number(millpond.perchLanded)}/1</li><li>Cool-Mint {countSites(millpond.mint)}/2</li>
              </ul>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={cta} onClick={() => engine.startMillpond()}>
                  {millpond.status === 'active' ? 'Pin next Millpond stop' : 'Start Millpond fieldwork'}
                </button>
                {millpondReady(millpond) && <button type="button" className={cta} disabled={!hud.nearExpeditionCamp} onClick={() => engine.finishMillpond()}>
                  Log restoration at Mailbox Square
                </button>}
              </div>
            </>
          )}
        </div>
        <div className="rounded-lg bg-[#160c24] p-3">
          <h4 className="font-display text-sm font-black text-[#ffbdac]">Red-Chalk Hollow Storm</h4>
          {hollow.status === 'restored' ? <p className="mt-1 text-xs text-[#f7efde]">Waterwheel restored. Local exposure is 25% lower and the Supply Relay job is available.</p>
            : millpond.status !== 'restored' ? <p className="mt-1 text-xs text-[#f7efde]">Restore the Millpond to unlock this expedition.</p>
            : hollow.status === 'unstarted' ? (
              <>
                <p className="my-2 text-xs text-[#f7efde]">Pack Cooling Draughts and Ribbon Stakes. Bring back Chalk-Quartz and escort the stalled companion to shelter.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={cta} onClick={() => engine.startHollow('anchor')}>Begin with Camp Anchor</button>
                  <button type="button" className={cta} onClick={() => engine.startHollow('hauler')}>Begin with Field Hauler</button>
                </div>
                <p className="mt-2 text-xs text-[#f7efde]">The Anchor keeps pace and gives a clearer return cue. The Hauler brings an extra ration and takes a more exposed route.</p>
              </>
            ) : (
              <>
                <ul className="my-2 flex flex-wrap gap-x-3 text-xs font-bold text-[#fff1cf]">
                  <li>Ribbons {Math.min(2, countSites(hollow.ribbons))}/2</li>
                  <li>Quartz {countSites(hollow.quartz)}/3 · Banked {hollow.bankedQuartz}/3</li>
                  <li>{hollow.escorted ? 'Companion safe' : hollow.packed ? 'Escort companion' : 'Find the supply pack'}</li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={cta} onClick={() => engine.pinExpedition('hollow')}>Pin Hollow route</button>
                  {hud.nearExpeditionCamp && !hollow.day && <button type="button" className={cta} onClick={() => engine.waitForHollowSquall()}>Wait for the Afternoon Squall</button>}
                  <button type="button" className={cta} disabled={!hud.nearExpeditionCamp || (hud.inv.chalk_quartz ?? 0) <= 0} onClick={() => engine.bankHollowQuartz()}>Bank Quartz</button>
                  {hollow.packed && !hollow.escorted && !hollow.sharedDraught && <button type="button" className={cta}
                    disabled={(hud.inv.cooling_draught ?? 0) <= 0} onClick={() => engine.shareHollowDraught()}>Share Cooling Draught</button>}
                  {hollowReady(hollow) && <button type="button" className={cta} disabled={!hud.nearExpeditionCamp || (hud.inv.chalk_quartz ?? 0) + hollow.bankedQuartz < 3} onClick={() => engine.finishHollow()}>
                    Restore the Waterwheel
                  </button>}
                </div>
              </>
            )}
        </div>
      </div>
    </section>
  );
}

export function FieldworkPanel({ hud, engine }: { hud: HudSnapshot; engine: GameEngine }) {
  const camp = hud.fieldwork;
  const forecast = WEATHER[hud.weather.current];
  const next = WEATHER[hud.weather.next];
  const route = camp.trail;

  return (
    <div className="grid gap-4">
      <section aria-labelledby="county-forecast" className="rounded-xl border border-[#9ae1f1]/35 bg-[#122330] p-3 sm:p-4">
        <h3 id="county-forecast" className="mb-2 flex items-center gap-2 font-display text-lg font-black text-[#9ae1f1]">
          <CloudSun size={18} aria-hidden="true" /> County forecast
        </h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-bold text-[#f7efde]/65">Today {hud.weather.active && '· Active'}</p>
            <p className="mt-1 text-sm font-extrabold" style={{ color: forecast.color }}>{forecast.name}</p>
            <p className="mt-0.5 leading-relaxed text-[#f7efde]/85">{forecast.description}</p>
          </div>
          <div className="border-l border-[#f7efde]/15 pl-3">
            <p className="font-bold text-[#f7efde]/65">Tomorrow</p>
            <p className="mt-1 text-sm font-extrabold" style={{ color: next.color }}>{next.name}</p>
            <p className="mt-0.5 leading-relaxed text-[#f7efde]/85">{next.description}</p>
          </div>
        </div>
        {hud.weather.sheltered && <p className="mt-2 text-xs font-bold text-[#72efdd]">Camp protection is in range.</p>}
      </section>

      <ExpeditionNotes hud={hud} engine={engine} />

      <section aria-labelledby="first-fishing-trip" className="rounded-xl border border-[#72efdd]/40 bg-[#122330] p-3 sm:p-4">
        <h3 id="first-fishing-trip" className="mb-2 flex items-center gap-2 font-display text-lg font-black text-[#72efdd]">
          <Fish size={18} aria-hidden="true" /> First fishing trip
        </h3>
        <p className="text-xs leading-relaxed text-[#f7efde]">
          {(hud.stats.fishCaught ?? 0) > 0
            ? 'Catch logged. Bring a fish back to a Camp Table for the ferry supper.'
            : 'Borrow the reed rod at Delta Public Bank. Wait for HOOK NOW, then reel while the fish is calm.'}
        </p>
        <button type="button" className={`${action} mt-3 min-h-11 border-[#72efdd]/50 text-[#72efdd]`} onClick={() => engine.pinFishingBank()}>
          Pin Delta Public Bank
        </button>
      </section>

      <section aria-labelledby="camp-jobs" className="rounded-xl border border-[#ffd166]/35 bg-[#261734] p-3 sm:p-4">
        <h3 id="camp-jobs" className="mb-2 flex items-center gap-2 font-display text-lg font-black text-[#ffd166]">
          <TentTree size={18} aria-hidden="true" /> Camp and companions
        </h3>
        <p className="text-xs leading-relaxed text-[#f7efde]/85">
          Mark a camp at a bench, table, or workbench. Companions work once at dusk and use one ration each. A Fizz Berry fills one ration.
        </p>
        <div className="my-3 flex flex-wrap items-center gap-2">
          <span data-testid="camp-provisions" className="mr-1 text-xs font-extrabold text-[#ffd166]">{camp.provisions}/{MAX_CAMP_PROVISIONS} rations</span>
          {!camp.nearbySite && camp.hasSite && (
            <button type="button" className={`${action} border-[#ffd166]/35 text-[#ffd166]`} onClick={() => engine.pinCampSite()}>
              Pin a camp site
            </button>
          )}
          <button type="button" className={`${action} border-[#ffd166]/35 text-[#ffd166]`} disabled={!camp.nearbySite} onClick={() => engine.setCampSite()}>
            Set camp here
          </button>
          <button type="button" className={`${action} border-[#72efdd]/35 text-[#72efdd]`} disabled={!camp.nearCampAnchor || camp.provisions >= MAX_CAMP_PROVISIONS || !(hud.inv.fizz_berry > 0)} onClick={() => engine.stockCamp('deposit')}>
            Stock 1 berry
          </button>
          <button type="button" className={`${action} border-[#f7efde]/25 text-[#f7efde]`} disabled={!camp.nearCampAnchor || camp.provisions === 0} onClick={() => engine.stockCamp('withdraw')}>
            Take 1 berry
          </button>
        </div>
        <p className="text-xs text-[#f7efde]/75">
          {camp.site ?? 'No camp marked'}{camp.wardActive && ' · Watch active'}
          {camp.lastShiftDay === hud.day && ' · Today’s shift complete'}
        </p>
        {!camp.hasSite && <p className="mt-2 text-xs text-[#f7efde]/75">Craft a bench to start a camp.</p>}
        <div className="mt-3 grid gap-2">
          {camp.companions.length === 0 && <p className="text-xs text-[#f7efde]/70">Befriend a creature to assign its first job.</p>}
          {camp.companions.map((companion) => (
            <label key={companion.id} className="grid gap-1 rounded-lg border border-[#f7efde]/15 bg-[#160c24]/65 p-2.5 text-xs">
              <span className="font-extrabold text-[#f7efde]">{companion.name}’s job</span>
              <select value={companion.job ?? ''} onChange={(event) => engine.setCampJob(companion.id, (event.target.value || null) as CampJob | null)}
                className="w-full max-w-64 rounded-md border border-[#f7efde]/30 bg-[#160c24] p-2 text-[#f7efde]">
                <option value="">Travel companion</option>
                {jobs.filter((job) => job !== 'relay' || hud.expeditions.hollow.status === 'restored')
                  .map((job) => <option key={job} value={job}>{CAMP_JOBS[job].name}</option>)}
              </select>
              {companion.job && <span className="leading-relaxed text-[#f7efde]/75">{CAMP_JOBS[companion.job].description}</span>}
            </label>
          ))}
        </div>
        {camp.report.length > 0 && (
          <ul aria-label="Last camp shift" className="mt-3 grid list-disc gap-1 pl-4 text-xs text-[#f7efde]/85">
            {camp.report.map((line, index) => <li key={index}>{line}</li>)}
          </ul>
        )}
      </section>

      <section aria-labelledby="ribbon-trails" className="rounded-xl border border-[#72efdd]/35 bg-[#122832] p-3 sm:p-4">
        <h3 id="ribbon-trails" className="mb-2 flex items-center gap-2 font-display text-lg font-black text-[#72efdd]">
          <Flag size={18} aria-hidden="true" /> Ribbon trails
        </h3>
        <p className="text-xs leading-relaxed text-[#f7efde]/85">Follow the gates in order. Roll through gold arches. The first clear earns a supply cache.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {trails.map((id) => {
            const trail = RIBBON_TRAILS[id];
            const best = camp.trailRecords[id];
            const charted = hud.discoveries[trail.biome] !== 'unknown';
            return (
              <div key={id} className="flex flex-col rounded-lg border border-[#72efdd]/20 bg-[#160c24]/60 p-3 text-xs">
                <h4 className="font-display text-base font-black text-[#f7efde]">{trail.name}</h4>
                <p className="mt-1 text-[#f7efde]/75">{BIOMES[trail.biome].name} · {trail.seconds}s</p>
                <p className="my-2 flex-1 text-[#ffd166]">
                  {best !== undefined ? `Best ${best.toFixed(1)}s` : Object.entries(trail.reward).map(([item, count]) => `${count} ${ITEMS[item]?.name ?? item}`).join(' · ')}
                </p>
                <button type="button" disabled={!charted}
                  aria-label={route?.id === id ? `End ${trail.name} attempt` : `Pin ${trail.name} start`}
                  className={`${action} border-[#72efdd]/40 bg-[#173c42] text-[#c3fbef]`}
                  onClick={() => route?.id === id ? engine.cancelTrail() : engine.armTrail(id)}>
                  {route?.id === id ? 'End attempt' : charted ? 'Pin trail start' : 'Chart region first'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
