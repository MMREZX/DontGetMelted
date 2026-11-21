import { useMemo, useState } from 'react';
import { Compass, MapPin, Navigation, Train, X } from 'lucide-react';
import { BIOMES } from '../game/data';
import type { GameEngine } from '../game/engine';
import type { DiscoveryState, HudSnapshot, TransportId } from '../game/types';
import { LANDMARKS, REGION_ZONES, ROADS, TRANSPORT_ROUTES } from '../game/world';
import { Dialog } from './Dialog';

interface AtlasModalProps {
  engine: GameEngine;
  hud: HudSnapshot;
  onClose: () => void;
}

const LOOP_COLORS: Record<'broadcast' | 'weather' | 'night_shift' | 'hub', string> = {
  broadcast: '#ff5d8f',
  weather: '#72efdd',
  night_shift: '#b388ff',
  hub: '#ffd166',
};

const TRANSPORT_HINTS: Record<TransportId, string> = {
  groove_express: 'Restore Radio Unmelted in Dead Air Basin',
  records_ferry: 'Return Triplicate Permit to Capt. Nix in Carbon Copy Delta',
  sock_clothesline: 'Bring both Giant Sock halves to Auntie Bias in Unpaired Sea',
  lamp_service_tunnel: 'Complete the Wickwater Ceremony in Wickwater Afterhours',
};

export function AtlasModal({ engine, hud, onClose }: AtlasModalProps) {
  const [zoom, setZoom] = useState<'overview' | 'local'>('overview');
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<string | null>(null);

  const discoveredRegions = useMemo(
    () =>
      REGION_ZONES.filter((z) => {
        const st = hud.discoveries[z.id];
        return st === 'visited' || st === 'seen';
      }).length,
    [hud.discoveries],
  );

  const viewBox =
    zoom === 'overview'
      ? '-12500 -11800 25000 23600'
      : `${Math.round(hud.playerX - 4200)} ${Math.round(hud.playerY - 3400)} 8400 6800`;

  const selectedLandmark = selectedLandmarkId
    ? LANDMARKS.find((l) => l.id === selectedLandmarkId) || null
    : null;

  const lavaLamps = engine.state.buildings.filter((b) => b.type === 'lava_lamp');

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const { x, y } = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    const bounds = svg.viewBox.baseVal;
    if (x < bounds.x || y < bounds.y || x > bounds.x + bounds.width || y > bounds.y + bounds.height) return;
    engine.setWaypoint({ x: Math.round(x), y: Math.round(y), label: 'Custom Atlas Pin' });
  };

  const getDisc = (id: string): DiscoveryState => hud.discoveries[id] || 'unknown';

  const notableLandmarks = useMemo(
    () =>
      LANDMARKS.filter((lm) => {
        const st = hud.discoveries[lm.id] || hud.discoveries[lm.regionId] || 'unknown';
        return st !== 'unknown';
      }),
    [hud.discoveries],
  );

  return (
    <Dialog label="County Atlas" className="fixed inset-0 z-40 flex items-center justify-center px-3 pb-3 pt-20 sm:px-5 sm:pb-5 sm:pt-14 bg-[#0d0618]/82 outline-none">
      <div className="ink-panel w-full max-w-[960px] max-h-[min(90dvh,100%)] rounded-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#f7efde]/15 bg-[#160c24]/80">
          <div className="flex items-center gap-2.5">
            <Compass className="w-5 h-5 text-[#ffd166]" />
            <div>
              <h2 className="font-display font-black text-lg sm:text-xl text-[#ffd166] leading-tight">
                Unmelted County Atlas
              </h2>
              <p className="text-[11px] sm:text-xs text-[#f7efde]/75">
                {discoveredRegions}/{REGION_ZONES.length} Regions Charted · County Sync {hud.countySync.restoredCount}/{hud.countySync.totalRestorations} · Click to pin compass
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="atlas-open-broadcast-btn"
              onClick={() => engine.setActiveModal('all_night_broadcast')}
              className="ink-button px-2.5 py-1.5 rounded-xl bg-[#ff5d8f] text-[#160c24] font-extrabold text-xs border-2 border-[#160c24] cursor-pointer whitespace-nowrap"
            >
              {hud.worldFlags.allNightBroadcastHosted ? 'ON AIR ★ Tuner' : 'Broadcast Tuner'}
            </button>
            <div className="flex rounded-xl bg-[#100621] p-0.5 border border-[#f7efde]/20">
              <button
                type="button"
                onClick={() => setZoom('overview')}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                  zoom === 'overview' ? 'bg-[#ffd166] text-[#160c24]' : 'text-[#f7efde]/75 hover:text-[#fffdf7]'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setZoom('local')}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                  zoom === 'local' ? 'bg-[#2ec4b6] text-[#160c24]' : 'text-[#f7efde]/75 hover:text-[#fffdf7]'
                }`}
              >
                Local Zoom
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close Atlas"
              className="ink-button w-9 h-9 rounded-xl bg-[#ff5d8f] text-[#160c24] border-2 border-[#160c24] flex items-center justify-center cursor-pointer shrink-0"
            >
              <X className="w-5 h-5 stroke-[2.6]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto overscroll-contain lg:overflow-hidden">
          {/* Interactive County Map Canvas (SVG) */}
          <div className="relative flex-1 bg-[#120821] p-3 flex flex-col items-center justify-center min-h-[300px] sm:min-h-[380px]">
            <svg
              viewBox={viewBox}
              onClick={handleSvgClick}
              className="w-full h-full max-h-[520px] rounded-xl border-2 border-[#2ec4b6]/45 bg-[#160c24] cursor-crosshair select-none"
              role="img"
              aria-label="Interactive county map"
            >
              {/* Subtle parchment grid rings */}
              <circle cx={0} cy={0} r={2200} fill="none" stroke="rgba(247,239,222,0.08)" strokeWidth={70} strokeDasharray="240 220" />
              <circle cx={0} cy={0} r={6200} fill="none" stroke="rgba(247,239,222,0.07)" strokeWidth={70} strokeDasharray="280 260" />
              <circle cx={0} cy={0} r={11200} fill="none" stroke="rgba(255,209,102,0.14)" strokeWidth={90} />

              {/* Region Zones */}
              {REGION_ZONES.map((z) => {
                const biome = BIOMES[z.id];
                const state = getDisc(z.id);
                if (state === 'unknown') {
                  return (
                    <g key={z.id}>
                      <ellipse
                        cx={z.cx}
                        cy={z.cy}
                        rx={z.rx * 0.85}
                        ry={z.ry * 0.85}
                        fill="rgba(247,239,222,0.04)"
                        stroke="rgba(247,239,222,0.14)"
                        strokeWidth={60}
                        strokeDasharray="220 220"
                      />
                      <text
                        x={z.cx}
                        y={z.cy}
                        textAnchor="middle"
                        fill="rgba(247,239,222,0.28)"
                        fontSize={zoom === 'overview' ? 540 : 280}
                        fontWeight="800"
                      >
                        ?
                      </text>
                    </g>
                  );
                }

                const fillOpacity = state === 'visited' ? 0.32 : state === 'seen' ? 0.18 : 0.08;
                const strokeDash = state === 'rumor' ? '260 220' : undefined;
                return (
                  <g key={z.id}>
                    <ellipse
                      cx={z.cx}
                      cy={z.cy}
                      rx={z.rx * 0.9}
                      ry={z.ry * 0.9}
                      fill={biome.mapCol}
                      fillOpacity={fillOpacity}
                      stroke={biome.mapCol}
                      strokeOpacity={state === 'visited' ? 0.85 : 0.45}
                      strokeWidth={state === 'visited' ? 95 : 65}
                      strokeDasharray={strokeDash}
                    />
                    <text
                      x={z.cx}
                      y={z.cy - z.ry * 0.56}
                      textAnchor="middle"
                      fill={state === 'visited' ? '#fffdf7' : 'rgba(247,239,222,0.72)'}
                      fontSize={zoom === 'overview' ? 420 : 230}
                      fontWeight="900"
                    >
                      {biome.name}
                    </text>
                  </g>
                );
              })}

              {/* Expedition Loop Roads */}
              {ROADS.map((road) => {
                const pts = road.points.map(([x, y]) => `${x},${y}`).join(' ');
                const unlockedShortcut = road.shortcutId ? hud.unlockedTransports.includes(road.shortcutId) : true;
                return (
                  <polyline
                    key={road.id}
                    points={pts}
                    fill="none"
                    stroke={LOOP_COLORS[road.loop]}
                    strokeWidth={zoom === 'overview' ? 130 : 75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeOpacity={unlockedShortcut ? 0.62 : 0.25}
                    strokeDasharray={road.shortcutId && !unlockedShortcut ? '260 260' : undefined}
                  />
                );
              })}

              {/* Unlocked Fast Transport Lines */}
              {(Object.keys(TRANSPORT_ROUTES) as TransportId[]).map((tid) => {
                if (!hud.unlockedTransports.includes(tid)) return null;
                const rt = TRANSPORT_ROUTES[tid];
                return (
                  <line
                    key={tid}
                    x1={rt.fromX}
                    y1={rt.fromY}
                    x2={rt.toX}
                    y2={rt.toY}
                    stroke={rt.accent}
                    strokeWidth={zoom === 'overview' ? 160 : 95}
                    strokeDasharray="340 200"
                    strokeOpacity={0.9}
                  />
                );
              })}

              {/* Discovered Mailboxes */}
              {engine.state.mailboxes
                .filter((m) => m.discovered)
                .map((m) => (
                  <rect
                    key={`mb_${m.id}`}
                    x={m.x - 160}
                    y={m.y - 160}
                    width={320}
                    height={320}
                    rx={60}
                    fill="#4cc9f0"
                    stroke="#160c24"
                    strokeWidth={55}
                  />
                ))}

              {/* Placed Lava Lamps */}
              {lavaLamps.map((b) => (
                <circle
                  key={b.id}
                  cx={b.x}
                  cy={b.y}
                  r={zoom === 'overview' ? 180 : 110}
                  fill="#ff9f1c"
                  stroke="#fffdf7"
                  strokeWidth={45}
                />
              ))}

              {/* Landmarks */}
              {LANDMARKS.map((lm) => {
                const st = getDisc(lm.id);
                const regSt = getDisc(lm.regionId);
                if (st === 'unknown' && regSt === 'unknown') return null;
                const isSelected = selectedLandmarkId === lm.id;
                const r = zoom === 'overview' ? 270 : 160;
                const col =
                  lm.kind === 'tower'
                    ? '#ff5d8f'
                    : lm.kind === 'ferry' || lm.kind === 'dock'
                      ? '#2ec4b6'
                      : lm.kind === 'greenhouse'
                        ? '#72efdd'
                        : lm.isWarmRefuge
                          ? '#ffd166'
                          : '#f7efde';
                return (
                  <g
                    key={lm.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedLandmarkId(lm.id);
                      engine.setWaypoint({ x: lm.x, y: lm.y, label: lm.name });
                    }}
                  >
                    {isSelected && (
                      <circle cx={lm.x} cy={lm.y} r={r * 1.85} fill="none" stroke="#ffd166" strokeWidth={80} />
                    )}
                    <circle
                      cx={lm.x}
                      cy={lm.y}
                      r={r}
                      fill={col}
                      fillOpacity={st === 'visited' || st === 'seen' ? 1 : 0.55}
                      stroke="#160c24"
                      strokeWidth={65}
                    />
                    {zoom === 'local' && (
                      <text
                        x={lm.x}
                        y={lm.y + r * 2.1}
                        textAnchor="middle"
                        fill="#fffdf7"
                        fontSize={210}
                        fontWeight="800"
                      >
                        {lm.name}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Active Waypoint Pin */}
              {hud.waypoint && (
                <g>
                  <circle
                    cx={hud.waypoint.x}
                    cy={hud.waypoint.y}
                    r={zoom === 'overview' ? 520 : 290}
                    fill="none"
                    stroke="#ffd166"
                    strokeWidth={100}
                    strokeDasharray="240 160"
                  />
                  <circle
                    cx={hud.waypoint.x}
                    cy={hud.waypoint.y}
                    r={zoom === 'overview' ? 190 : 110}
                    fill="#ffd166"
                  />
                </g>
              )}

              {/* Player Marker */}
              <g>
                <circle
                  cx={hud.playerX}
                  cy={hud.playerY}
                  r={zoom === 'overview' ? 420 : 240}
                  fill="#ffffff"
                  stroke="#ff5d8f"
                  strokeWidth={110}
                />
              </g>
            </svg>

            {/* Compact Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-2 text-[11px] font-semibold text-[#f7efde]/80">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#ff5d8f]" /> You
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffd166]" /> Refuge / Waypoint
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#4cc9f0]" /> Mailbox
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff9f1c]" /> Lava Lamp
              </span>
            </div>
          </div>

          {/* Right Sidebar: Waypoint, Transports, Landmarks */}
          <div className="w-full lg:w-[300px] border-t lg:border-t-0 lg:border-l border-[#f7efde]/15 bg-[#160c24]/75 p-4 flex flex-col gap-3.5 lg:overflow-y-auto storybook-scroll">
            {/* Active Waypoint */}
            <div className="rounded-xl bg-[#100621]/90 border border-[#ffd166]/45 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#ffd166] inline-flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5" /> Active Compass
                </span>
                {hud.waypoint && (
                  <button
                    type="button"
                    onClick={() => engine.setWaypoint(null)}
                    className="text-[11px] font-bold text-[#ff85b3] hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              {hud.waypoint ? (
                <div className="mt-1">
                  <div className="font-display font-extrabold text-sm text-[#fffdf7]">{hud.waypoint.label}</div>
                  {hud.waypointDist !== null && (
                    <div className="text-xs font-mono-num text-[#2ec4b6] mt-0.5">
                      {hud.waypointDist}m away
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[#f7efde]/65 mt-1">Click any landmark or region on the chart to set a waypoint.</p>
              )}
              {selectedLandmark && (
                <p className="text-[11px] text-[#f7efde]/80 mt-2 pt-2 border-t border-[#f7efde]/12 leading-snug">
                  <strong className="text-[#ffd166]">{selectedLandmark.name}:</strong> {selectedLandmark.desc}
                </p>
              )}
            </div>

            {/* Public Transports */}
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#2ec4b6] mb-2 inline-flex items-center gap-1.5">
                <Train className="w-3.5 h-3.5" /> Public Transports
              </div>
              <div className="flex flex-col gap-2">
                {(Object.keys(TRANSPORT_ROUTES) as TransportId[]).map((tid) => {
                  const rt = TRANSPORT_ROUTES[tid];
                  const unlocked = hud.unlockedTransports.includes(tid);
                  return (
                    <div
                      key={tid}
                      className="rounded-xl bg-[#100621]/90 border p-2.5 flex flex-col gap-1"
                      style={{ borderColor: unlocked ? rt.accent : 'rgba(247,239,222,0.16)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-extrabold text-xs text-[#fffdf7]">{rt.name}</span>
                        {unlocked ? (
                          <button
                            type="button"
                            onClick={() => engine.rideTransport(tid)}
                            className="ink-button px-2.5 py-1 rounded-lg bg-[#ffd166] text-[#160c24] font-extrabold text-[11px] border border-[#160c24] cursor-pointer"
                          >
                            Ride
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold uppercase text-[#f7efde]/45">Sealed</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#f7efde]/70 leading-snug">
                        {unlocked ? `${rt.fromName} ↔ ${rt.toName}` : TRANSPORT_HINTS[tid]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Discovered & Rumored Landmarks */}
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#ffd166] mb-2 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Landmarks & Rumors
              </div>
              <div className="flex flex-col gap-1.5">
                {notableLandmarks.map((lm) => {
                  const st = getDisc(lm.id);
                  const active = hud.waypoint?.label === lm.name;
                  return (
                    <button
                      key={lm.id}
                      type="button"
                      onClick={() => {
                        setSelectedLandmarkId(lm.id);
                        engine.setWaypoint({ x: lm.x, y: lm.y, label: lm.name });
                      }}
                      className={`text-left px-2.5 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                        active
                          ? 'bg-[#2d1a4b] border-[#ffd166] text-[#fffdf7]'
                          : 'bg-[#100621]/80 border-[#f7efde]/12 text-[#f7efde]/85 hover:border-[#2ec4b6]/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold truncate">{lm.name}</span>
                        <span className="text-[10px] uppercase font-mono-num text-[#2ec4b6] shrink-0">
                          {st === 'visited' ? 'Visited' : st === 'seen' ? 'Seen' : 'Rumor'}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#f7efde]/60 truncate">{BIOMES[lm.regionId].name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
