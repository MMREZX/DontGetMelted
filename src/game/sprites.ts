import { BIOMES, CHARACTERS, CREATURE_DEFS, CROPS, STYLES, WORLD_R } from './data';
import { computeDockReflectionState, DOCK_LAMP_SLOTS } from './fishing';
import { getBiomeAt } from './rules';
import type { RegionPhysicsResult } from './rules';
import { LANDMARKS, REGION_ZONES, ROADS } from './world';
import type {
  Building,
  Creature,
  DroppedSatchel,
  FishingSession,
  InteractPrompt,
  Mailbox,
  PlayerState,
  Projectile,
  ResidentDef,
  TripId,
  WaterRipple,
  WorldFeatureProp,
  WorldFlags,
  WorldObject,
} from './types';

const INK = '#160c24';

export function drawGooglyEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  phase: number,
  hypnotic = false,
): void {
  ctx.fillStyle = '#fffdf7';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (hypnotic) {
    ctx.strokeStyle = '#ff3b8d';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 3; a += 0.5) {
      const sr = (a / (Math.PI * 3)) * r * 0.78;
      const px = x + Math.cos(a + phase * 4) * sr;
      const py = y + Math.sin(a + phase * 4) * sr;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + Math.cos(phase * 3.1) * r * 0.34, y + Math.sin(phase * 2.7) * r * 0.34, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  t: number,
  wobbleFrac: number,
  trips: Set<TripId>,
  flags: WorldFlags,
  reducedMotion: boolean,
): void {
  const motionScale = reducedMotion ? 0.18 : 1;
  const hueShift =
    trips.has('kaleido') || trips.has('disco')
      ? (Math.sin(t * 0.8) * 24 + t * 12) * motionScale
      : wobbleFrac * Math.sin(t * 0.9) * 18 * motionScale;

  const viewCenterX = cx + w / 2;
  const viewCenterY = cy + h / 2;
  const viewRadius = Math.hypot(w, h) * 0.58;

  // Base fill uses the current viewport center biome so seamless transitions never flash dark void
  const centerBiome = getBiomeAt(viewCenterX, viewCenterY);
  const cHue = (centerBiome.hue + hueShift + 360) % 360;
  ctx.fillStyle = `hsl(${cHue}, ${Math.min(72, centerBiome.sat + wobbleFrac * 12)}%, ${centerBiome.lit}%)`;
  ctx.fillRect(cx - 32, cy - 32, w + 64, h + 64);

  // Draw visible REGION_ZONES valleys (sorted outer -> inner priority)
  const orderedZones = [...REGION_ZONES].sort((a, b) => a.priority - b.priority);
  for (const zone of orderedZones) {
    const dx = viewCenterX - zone.cx;
    const dy = viewCenterY - zone.cy;
    if (Math.abs(dx) > zone.rx + viewRadius + 220 || Math.abs(dy) > zone.ry + viewRadius + 220) {
      continue;
    }
    const b = BIOMES[zone.id];
    const bh = (b.hue + hueShift + 360) % 360;
    ctx.fillStyle = `hsl(${bh}, ${Math.min(74, b.sat + wobbleFrac * 14)}%, ${b.lit}%)`;
    ctx.beginPath();
    ctx.ellipse(zone.cx, zone.cy, zone.rx, zone.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 226, 150, 0.16)';
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  // Draw county expedition loop roads & footpaths inside viewport
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const road of ROADS) {
    if (road.shortcutId === 'lamp_service_tunnel' && !flags.wickworksRestored) continue;
    // Quick bounding box cull
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [px, py] of road.points) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    if (maxX < cx - 140 || minX > cx + w + 140 || maxY < cy - 140 || minY > cy + h + 140) continue;

    ctx.strokeStyle = 'rgba(22, 12, 36, 0.28)';
    ctx.lineWidth = 42;
    ctx.beginPath();
    road.points.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.stroke();

    ctx.strokeStyle = road.shortcutId ? 'rgba(179, 136, 255, 0.42)' : 'rgba(247, 239, 222, 0.34)';
    ctx.lineWidth = 30;
    ctx.setLineDash(road.shortcutId ? [18, 12] : []);
    ctx.beginPath();
    road.points.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Giggle-Grove Multi-Level Hub Details: Mailbox Square, Market Window, Rooftop Walk Deck
  if (Math.hypot(viewCenterX, viewCenterY) < 1650) {
    // Sun-dappled Mailbox Square
    ctx.fillStyle = 'rgba(255, 224, 138, 0.16)';
    ctx.beginPath();
    ctx.ellipse(-60, -80, 210, 150, 0, 0, Math.PI * 2);
    ctx.fill();

    // Grove Public Market pavilion floor + Reopened Region Window Display
    ctx.fillStyle = 'rgba(247, 239, 222, 0.22)';
    ctx.strokeStyle = 'rgba(22, 12, 36, 0.38)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(310, -340, 220, 150, 18);
    ctx.fill();
    ctx.stroke();

    // Market Display Window showing reopened outer-county produce!
    ctx.fillStyle = '#4c2c7a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(350, -330, 140, 36, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    const marketSign = flags.orchardRipened
      ? 'FRESH PRISM PEARS!'
      : flags.radioRepaired
        ? 'GROVE MARKET · ON AIR'
        : 'GROVE MARKET';
    ctx.fillText(marketSign, 420, -308);

    // Creasefolk Rooftop Walk elevated timber & folded-paper walkway
    ctx.fillStyle = 'rgba(22, 12, 36, 0.32)';
    ctx.beginPath();
    ctx.roundRect(-720, -545, 970, 62, 16);
    ctx.fill();

    ctx.fillStyle = '#e8dcc4';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-720, -558, 970, 56, 14);
    ctx.fill();
    ctx.stroke();

    // Pleated paper seams along Rooftop Walk
    ctx.strokeStyle = 'rgba(22, 12, 36, 0.24)';
    ctx.lineWidth = 2;
    for (let rx = -680; rx <= 210; rx += 56) {
      ctx.beginPath();
      ctx.moveTo(rx, -556);
      ctx.lineTo(rx, -504);
      ctx.stroke();
    }
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#5c4b37';
    ctx.fillText('CREASEFOLK ROOFTOP WALK (ELEVATED SHORTCUT)', -235, -526);
  }

  // Stretched Giant Sock Clothesline ribbon once hung between Unpaired Sea & Cloud-9!
  if (flags.socksHung) {
    ctx.save();
    ctx.strokeStyle = '#ff85b3';
    ctx.lineWidth = 8;
    ctx.setLineDash([22, 10]);
    ctx.beginPath();
    ctx.moveTo(8650, 3450);
    ctx.quadraticCurveTo(6800, 3450, 4950, 4100);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Lightweight batched biome ground details inside viewport
  const tile = 180;
  const sx = Math.floor((cx - tile) / tile) * tile;
  const sy = Math.floor((cy - tile) / tile) * tile;

  const grassTufts: Array<[number, number, number]> = [];
  const daisies: Array<[number, number]> = [];

  for (let x = sx; x < cx + w + tile; x += tile) {
    for (let y = sy; y < cy + h + tile; y += tile) {
      if (Math.hypot(x, y) > WORLD_R - 40) continue;
      const b = getBiomeAt(x + tile * 0.5, y + tile * 0.5);
      const hash = Math.sin(x * 0.017 + y * 0.031) * 43758.5453;
      const frac = hash - Math.floor(hash);
      const px = x + tile * (0.2 + frac * 0.6);
      const py = y + tile * (0.2 + ((frac * 7) % 1) * 0.6);

      if (b.id === 'giggle_grove') {
        const sway = Math.sin(t * 2.2 + frac * 12) * (2 + wobbleFrac * 4) * motionScale;
        grassTufts.push([px, py, sway]);
        if (frac > 0.58) daisies.push([px + 16, py - 6]);
      } else if (b.id === 'marmalade_flats') {
        ctx.fillStyle = 'rgba(255, 209, 102, 0.22)';
        ctx.beginPath();
        ctx.ellipse(px, py, 28, 12, 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.id === 'bureaucracy_bog' || b.id === 'carbon_copy_delta') {
        ctx.fillStyle = b.id === 'carbon_copy_delta' ? 'rgba(76, 201, 240, 0.2)' : 'rgba(46, 196, 182, 0.18)';
        ctx.beginPath();
        ctx.ellipse(px, py, 32, 14, -0.1, 0, Math.PI * 2);
        ctx.fill();
        if (frac > 0.56) {
          ctx.fillStyle = 'rgba(247, 239, 222, 0.28)';
          ctx.fillRect(px + 8, py - 8, 14, 10);
        }
      } else if (b.id === 'vinyl_desert' || b.id === 'dead_air_basin') {
        ctx.strokeStyle = b.id === 'dead_air_basin' ? 'rgba(255, 112, 166, 0.3)' : 'rgba(255, 93, 143, 0.24)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(px, py, 40, 15, 0.32, 0, Math.PI);
        ctx.stroke();
      } else if (b.id === 'great_fridge' || b.id === 'midnight_defrost') {
        ctx.strokeStyle = 'rgba(224, 251, 252, 0.22)';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x + 12, y + 12, tile - 24, tile - 24);
      } else if (b.id === 'prism_orchard') {
        ctx.strokeStyle = 'rgba(114, 239, 221, 0.26)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - 14, py);
        ctx.lineTo(px, py - 12);
        ctx.lineTo(px + 14, py);
        ctx.lineTo(px, py + 12);
        ctx.closePath();
        ctx.stroke();
      } else if (b.id === 'unpaired_sea') {
        ctx.strokeStyle = 'rgba(255, 240, 210, 0.24)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(px, py, 20, 0.2, Math.PI - 0.2);
        ctx.stroke();
      } else if (b.id === 'wickwater_afterhours') {
        ctx.fillStyle = 'rgba(255, 159, 28, 0.14)';
        ctx.beginPath();
        ctx.ellipse(px, py, 24, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255, 240, 250, 0.22)';
        ctx.beginPath();
        ctx.arc(px - 10, py, 15, 0, Math.PI * 2);
        ctx.arc(px + 8, py - 4, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (grassTufts.length > 0) {
    ctx.strokeStyle = 'rgba(22, 12, 36, 0.26)';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [px, py, sway] of grassTufts) {
      ctx.moveTo(px - 6, py);
      ctx.quadraticCurveTo(px - 9 + sway, py - 9, px - 11 + sway, py - 14);
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + sway, py - 11, px + 2 + sway, py - 16);
      ctx.moveTo(px + 6, py);
      ctx.quadraticCurveTo(px + 9 + sway, py - 8, px + 11 + sway, py - 12);
    }
    ctx.stroke();
  }

  if (daisies.length > 0) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    for (const [dx, dy] of daisies) {
      ctx.moveTo(dx + 3.4, dy);
      ctx.arc(dx, dy, 3.4, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  // Subtle landmark ground signposts
  for (const lm of LANDMARKS) {
    if (Math.abs(lm.x - viewCenterX) > w * 0.65 || Math.abs(lm.y - viewCenterY) > h * 0.65) continue;
    if (lm.isWarmRefuge) {
      ctx.fillStyle = 'rgba(255, 209, 102, 0.12)';
      ctx.beginPath();
      ctx.arc(lm.x, lm.y, 130, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Outer county border fence
  if (Math.hypot(viewCenterX, viewCenterY) + viewRadius > WORLD_R - 80) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 10;
    ctx.setLineDash([28, 16]);
    ctx.beginPath();
    ctx.arc(0, 0, WORLD_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export function drawWorldFeature(
  ctx: CanvasRenderingContext2D,
  f: WorldFeatureProp,
  t: number,
  flags: WorldFlags,
  mirrorAngles: Record<string, number>,
  physics: RegionPhysicsResult,
  reducedMotion: boolean,
): void {
  const pulse = reducedMotion ? 0 : Math.sin(t * 4) * 3;
  ctx.save();
  ctx.translate(f.x, f.y);

  if (f.kind === 'rooftop_ramp') {
    ctx.fillStyle = '#c9a66b';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-34, -22, 68, 44, 8);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#fffdf7';
    ctx.lineWidth = 2.5;
    for (let i = -12; i <= 12; i += 8) {
      ctx.beginPath();
      ctx.moveTo(-22, i);
      ctx.lineTo(22, i);
      ctx.stroke();
    }
  } else if (f.kind === 'mailbox_radio') {
    ctx.fillStyle = '#4c2c7a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-22, -46, 44, 46, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flags.radioRepaired ? '#2ec4b6' : '#ff5d8f';
    ctx.beginPath();
    ctx.arc(0, -24, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if ((flags.radioRepaired || flags.allNightBroadcastHosted) && !reducedMotion) {
      ctx.strokeStyle = flags.allNightBroadcastHosted ? '#a8ff3e' : '#ffd166';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, -24, 22 + ((t * 24) % 24), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (flags.allNightBroadcastHosted) {
      ctx.fillStyle = '#ffd166';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect(-34, -68, 68, 18, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.font = '900 9px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ON AIR ★', 0, -56);
    }
  } else if (f.kind === 'tunnel_hatch') {
    ctx.fillStyle = flags.wickworksRestored ? '#b388ff' : '#536270';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(flags.wickworksRestored ? 'TUNNEL OPEN' : 'SEALED HATCH', 0, 4);
  } else if (f.kind === 'listening_booth') {
    // Retro roadside phone-style listening booth
    ctx.fillStyle = '#ff5d8f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.roundRect(-28, -72, 56, 72, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c8f4ff';
    ctx.fillRect(-18, -58, 36, 36);
    ctx.strokeRect(-18, -58, 36, 36);
    ctx.fillStyle = '#ffd166';
    ctx.font = '800 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(flags.radioRepaired ? '3 NOTES!' : '2 NOTES...', 0, -37);
  } else if (f.kind === 'grooves_track') {
    const dir = f.regionId === 'dead_air_basin' ? physics.grooveDir : 1;
    const ang = (f.angle ?? -2.55) + (dir === -1 ? Math.PI : 0);
    ctx.strokeStyle = physics.grooveWarning ? 'rgba(255, 209, 102, 0.72)' : 'rgba(255, 93, 143, 0.44)';
    ctx.lineWidth = 6;
    for (let r = f.radius * 0.45; r <= f.radius; r += 55) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Clear directional arrow for muted/reduced-motion accessibility
    ctx.save();
    ctx.rotate(ang);
    ctx.fillStyle = physics.grooveWarning ? '#ffd166' : '#ff85b3';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.lineTo(14, -18);
    ctx.lineTo(14, 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (f.kind === 'radio_tower') {
    // Iconic bent tonearm broadcast tower (straightens & beams gold once repaired!)
    ctx.fillStyle = 'rgba(255, 93, 143, 0.16)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 95, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Giant vinyl platter base
    ctx.fillStyle = '#1d122e';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 74, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tonearm mast (bent if unrepaired, proud & upright if repaired)
    ctx.strokeStyle = INK;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-26, -6);
    if (flags.radioRepaired) {
      ctx.lineTo(-10, -135);
      ctx.lineTo(36, -118);
    } else {
      ctx.quadraticCurveTo(-45, -80, 18, -96);
    }
    ctx.stroke();

    ctx.strokeStyle = flags.radioRepaired ? '#ffd166' : '#c6cfd8';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-26, -6);
    if (flags.radioRepaired) {
      ctx.lineTo(-10, -135);
      ctx.lineTo(36, -118);
    } else {
      ctx.quadraticCurveTo(-45, -80, 18, -96);
    }
    ctx.stroke();

    // Broadcast beacon rings when repaired
    if (flags.radioRepaired) {
      ctx.strokeStyle = '#2ec4b6';
      ctx.lineWidth = 3;
      const r1 = 22 + (reducedMotion ? 12 : (t * 40) % 55);
      ctx.beginPath();
      ctx.arc(36, -118, r1, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (f.kind === 'stamp_bridge') {
    const active = physics.stampBridgeActive;
    const ghost = physics.stampGhostVisible;
    if (active) {
      ctx.fillStyle = '#f7efde';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(-90, -40, 180, 80, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#219ebc';
      ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('APPROVED BRIDGE', 0, 4);
    } else if (ghost) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(-90, -40, 180, 80);
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffd166';
      ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GHOST INK TRACE', 0, 4);
    } else {
      ctx.fillStyle = 'rgba(20, 48, 68, 0.65)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 96, 44, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.kind === 'mural_wall') {
    ctx.fillStyle = '#f7efde';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-64, -74, 128, 74, 8);
    ctx.fill();
    ctx.stroke();
    if (flags.deltaMuralSolved) {
      // Harmonious two-layer Overprint Mural: Oona's cobalt wave + Inkling's luminous arrows!
      ctx.fillStyle = '#219ebc';
      ctx.fillRect(-56, -64, 112, 54);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.moveTo(-42, -37);
      ctx.lineTo(28, -37);
      ctx.lineTo(18, -48);
      ctx.lineTo(44, -37);
      ctx.lineTo(18, -26);
      ctx.lineTo(28, -37);
      ctx.fill();
      ctx.fillStyle = '#fffdf7';
      ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FERRY · BOTH LAYERS', 0, -16);
    } else {
      // Contested smudged half-painted wall
      ctx.fillStyle = '#457b9d';
      ctx.fillRect(-56, -64, 54, 54);
      ctx.fillStyle = '#e5e5e5';
      ctx.fillRect(2, -64, 54, 54);
      ctx.fillStyle = INK;
      ctx.font = '800 9px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SMUDGED MURAL', 0, -34);
    }
  } else if (f.kind === 'duplicate_drift') {
    // Show rain-duplicated crate + genuine shore-marked original
    const bob = reducedMotion ? 0 : Math.sin(t * 3) * 4;
    // Wet ghost duplicate on the left
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#4cc9f0';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.fillRect(-54, -22 + bob, 32, 26);
    ctx.strokeRect(-54, -22 + bob, 32, 26);
    ctx.globalAlpha = 1;

    // Genuine shore-marked crate on the right
    if (!flags.originalDriftFound) {
      ctx.fillStyle = '#d48c3b';
      ctx.fillRect(10, -24 - bob, 36, 28);
      ctx.strokeRect(10, -24 - bob, 36, 28);
      // Dry white chalk shore-mark!
      ctx.strokeStyle = '#fffdf7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(16, -14 - bob);
      ctx.lineTo(38, -14 - bob);
      ctx.moveTo(27, -20 - bob);
      ctx.lineTo(27, -4 - bob);
      ctx.stroke();
    }
  } else if (f.kind === 'ferry_bell') {
    ctx.fillStyle = '#7f4f24';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillRect(-44, -8, 88, 22);
    ctx.strokeRect(-44, -8, 88, 22);
    ctx.fillStyle = flags.ferryRestored ? '#ffd166' : '#9faab5';
    ctx.beginPath();
    ctx.arc(0, -28, 16, Math.PI, 0);
    ctx.lineTo(18, -14);
    ctx.lineTo(-18, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (flags.ferryInsulated) {
      ctx.fillStyle = '#90be6d';
      ctx.fillRect(-34, -4, 68, 8);
    }
  } else if (f.kind === 'jam_canal') {
    ctx.strokeStyle = 'rgba(255, 183, 3, 0.55)';
    ctx.lineWidth = 44;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-140, 48);
    ctx.lineTo(140, -48);
    ctx.stroke();
    ctx.strokeStyle = '#fff8e8';
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 16]);
    ctx.beginPath();
    ctx.moveTo(-115, 40);
    ctx.lineTo(115, -40);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (f.kind === 'mirror') {
    const step = (mirrorAngles[f.id] ?? 0) % 4;
    const rad = (step * Math.PI) / 2;
    const targetMap: Record<string, number> = { feat_mirror_1: 2, feat_mirror_2: 3, feat_mirror_3: 1 };
    const aligned = step === targetMap[f.id];

    // Beam toward Prism Greenhouse when aligned!
    if (aligned) {
      ctx.strokeStyle = 'rgba(114, 239, 221, 0.65)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(8850 - f.x, -3750 - f.y);
      ctx.stroke();
    }

    // Mirror plinth
    ctx.fillStyle = aligned ? '#ffd166' : '#8d99ae';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(0, -26);
    ctx.rotate(rad);
    ctx.fillStyle = aligned ? '#9ef0f0' : '#edf2f4';
    ctx.fillRect(-20, -6, 40, 12);
    ctx.strokeRect(-20, -6, 40, 12);
    ctx.restore();
  } else if (f.kind === 'dryer_lighthouse') {
    ctx.fillStyle = '#edf2f4';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-36, -86, 72, 86, 12);
    ctx.fill();
    ctx.stroke();
    // Spinning drum porthole
    ctx.fillStyle = physics.dryerKnockWarning ? '#ff5d8f' : '#4ea8de';
    ctx.beginPath();
    ctx.arc(0, -44, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (physics.dryerKnockWarning) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -44, 34 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (f.kind === 'sock_half_a' || f.kind === 'sock_half_b') {
    const found = f.kind === 'sock_half_a' ? flags.sockHalfAFound : flags.sockHalfBFound;
    if (!found) {
      ctx.fillStyle = f.kind === 'sock_half_a' ? '#ff85b3' : '#ffd166';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-16, -54);
      ctx.lineTo(14, -54);
      ctx.lineTo(16, -12);
      ctx.lineTo(36, 0);
      ctx.quadraticCurveTo(38, 16, 18, 16);
      ctx.lineTo(-16, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (f.kind === 'wash_line') {
    ctx.strokeStyle = '#fffdf7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-90, 26);
    ctx.lineTo(90, -26);
    ctx.stroke();
    // Fluttering bedsheet
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.fillRect(-18, -14 + pulse * 0.5, 36, 28);
    ctx.strokeRect(-18, -14 + pulse * 0.5, 36, 28);
  } else if (f.kind === 'appliance_bulb') {
    const g = ctx.createRadialGradient(0, -16, 12, 0, -16, f.radius);
    g.addColorStop(0, 'rgba(255, 224, 138, 0.36)');
    g.addColorStop(1, 'rgba(255, 224, 138, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -16, f.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -28, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (f.kind === 'defrost_valve') {
    ctx.fillStyle = flags.defrostDiverted ? '#2ec4b6' : '#ff4d6d';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, -22, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#fffdf7';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-16, -22);
    ctx.lineTo(16, -22);
    ctx.moveTo(0, -38);
    ctx.lineTo(0, -6);
    ctx.stroke();
  } else if (f.kind === 'candleboat') {
    // Cooling golden wax ledge around candleboat
    ctx.fillStyle = physics.waxLedgeSolid
      ? physics.waxDimWarning
        ? 'rgba(255, 93, 143, 0.45)'
        : 'rgba(255, 209, 102, 0.42)'
      : 'rgba(60, 40, 25, 0.35)';
    ctx.strokeStyle = physics.waxLedgeSolid ? '#ffd166' : '#8d99ae';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, f.radius * 0.65, f.radius * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Boat hull & glowing wick flame
    ctx.fillStyle = '#f7efde';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, -8, 36, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (physics.waxLedgeSolid) {
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.ellipse(0, -34 + pulse * 0.4, 9, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (f.kind === 'unsent_letter_box') {
    ctx.fillStyle = '#5e2ca5';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.roundRect(-30, -50, 60, 50, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flags.wickworksRestored ? '#ffd166' : '#ff9f1c';
    ctx.beginPath();
    ctx.arc(0, -25, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (flags.wickwaterCeremony === 'public') {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -25, 28 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (f.kind === 'ferry_note') {
    // Damp Ferry Note pinned on a harbor-wood post right in Mailbox Square
    ctx.fillStyle = '#6c584c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.fillRect(-5, -42, 10, 44);
    ctx.strokeRect(-5, -42, 10, 44);

    // Fluttering damp blue-cream note paper
    const flutter = reducedMotion ? 0 : Math.sin(t * 3.4) * 2.5;
    ctx.fillStyle = '#e8f6ff';
    ctx.beginPath();
    ctx.moveTo(-14, -40);
    ctx.lineTo(15, -40);
    ctx.lineTo(17 + flutter * 0.4, -14);
    ctx.lineTo(-12 + flutter * 0.4, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Ink text lines + wax stamp pin
    ctx.strokeStyle = '#219ebc';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-8, -31);
    ctx.lineTo(8, -31);
    ctx.moveTo(-8, -25);
    ctx.lineTo(10, -25);
    ctx.moveTo(-8, -19);
    ctx.lineTo(4, -19);
    ctx.stroke();

    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath();
    ctx.arc(0, -39, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // Gentle inviting ring until supper has been served
    if (flags.ferrySupperServedDay === 0) {
      ctx.strokeStyle = flags.ferrySupperStage !== 'unstarted' ? 'rgba(76, 201, 240, 0.5)' : '#ffd166';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, -28, 22 + Math.abs(pulse), 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (f.kind === 'fishing_bank') {
    // Delta Public Bank & Dry Dock: Ink Cove Water + 3 Pilings + Movable Dock Lamp + Mirror Minnow Reflection!
    const refl = computeDockReflectionState(t, flags.dockLampSlot, flags.ferryRestored);

    // Shimmering Ink-Delta Fishing Cove to the north of the timber dock
    ctx.fillStyle = '#123e54';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, -82, 168, 76, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner teal water depth band
    ctx.fillStyle = '#1c5d7a';
    ctx.beginPath();
    ctx.ellipse(0, -82, 140, 56, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle animated water sheen lines
    ctx.strokeStyle = 'rgba(144, 224, 239, 0.28)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      const sy = -114 + i * 16;
      const sx = Math.sin(t * 1.4 + i) * (reducedMotion ? 2 : 10);
      ctx.beginPath();
      ctx.moveTo(-82 + sx, sy);
      ctx.lineTo(82 + sx, sy);
      ctx.stroke();
    }

    // Timber Dry Dock Platform
    ctx.fillStyle = '#8b5e34';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-126, -24, 252, 48, 8);
    ctx.fill();
    ctx.stroke();

    // Plank seams
    ctx.strokeStyle = 'rgba(22, 12, 36, 0.35)';
    ctx.lineWidth = 2;
    for (let px = -104; px <= 104; px += 26) {
      ctx.beginPath();
      ctx.moveTo(px, -22);
      ctx.lineTo(px, 22);
      ctx.stroke();
    }

    // 3 Pilings + Lamp Mounting Slots
    for (const slot of DOCK_LAMP_SLOTS) {
      const sdx = slot.x - f.x;
      const swy = slot.waterY - f.y;
      const isLit = slot.slot === flags.dockLampSlot;
      // Timber piling post
      ctx.fillStyle = '#5c3d22';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.roundRect(sdx - 11, -34, 22, 26, 4);
      ctx.fill();
      ctx.stroke();

      // Reliable Spool Perch silhouette nosing quietly near each piling
      const perchAngle = Math.sin(t * 1.8 + slot.slot * 2.1) * 0.22;
      const px = sdx + Math.sin(t * 1.1 + slot.slot) * 14;
      const py = swy + 18;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(perchAngle);
      ctx.fillStyle = 'rgba(9, 24, 34, 0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-16, -4);
      ctx.lineTo(-16, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (isLit) {
        // Reflected Dock Lamp Column on the cove water!
        if (!refl.disturbanceActive) {
          const rg = ctx.createRadialGradient(sdx, swy + 10, 6, sdx, swy + 10, 58);
          rg.addColorStop(0, 'rgba(255, 224, 130, 0.62)');
          rg.addColorStop(0.55, 'rgba(144, 224, 239, 0.24)');
          rg.addColorStop(1, 'rgba(255, 224, 130, 0)');
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.ellipse(sdx, swy + 10, 56, 36, 0, 0, Math.PI * 2);
          ctx.fill();

          // Crisp intact vertical mirror beam on water
          ctx.fillStyle = 'rgba(255, 234, 165, 0.42)';
          ctx.beginPath();
          ctx.ellipse(sdx, swy + 24, 14, 34, 0, 0, Math.PI * 2);
          ctx.fill();

          // Rare Silvery Mirror Minnow gracefully circling the intact reflection!
          const ma = t * (reducedMotion ? 0.5 : 1.9);
          const mx = sdx + Math.cos(ma) * 20;
          const my = swy + 8 + Math.sin(ma) * 10;
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(ma + Math.PI * 0.5);
          ctx.fillStyle = '#e0fbfc';
          ctx.strokeStyle = '#ffd166';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(0, 0, 9.5, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-9, 0);
          ctx.lineTo(-14, -4);
          ctx.lineTo(-14, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          // Broken scattered reflection slivers during wake disturbance!
          ctx.fillStyle = 'rgba(255, 224, 130, 0.34)';
          for (let k = 0; k < 5; k++) {
            const jx = Math.sin(t * 9 + k * 2.4) * 16;
            ctx.fillRect(sdx - 12 + jx, swy - 6 + k * 12, 24, 4);
          }
        }

        // Brass Movable Dock Lamp perched on active piling
        ctx.fillStyle = '#ffd166';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(sdx - 9, -56, 18, 22, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff9db';
        ctx.beginPath();
        ctx.arc(sdx, -45, 5.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Empty brass hook ring showing another movable lamp slot
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.65)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sdx, -30, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Passing Ferry Silhouette OR Drifting Plank crossing the water during disturbance!
    if (refl.disturbanceActive) {
      const prog = refl.disturbanceProgress;
      const wx = -148 + prog * 296;
      const wy = -94;
      // Expanding V-wake lines
      ctx.strokeStyle = 'rgba(224, 251, 252, 0.72)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(wx - 44, wy - 12);
      ctx.lineTo(wx + 12, wy);
      ctx.lineTo(wx - 44, wy + 12);
      ctx.stroke();

      if (refl.disturbanceKind === 'ferry') {
        // Distant brass-and-teal ferry hull gliding by
        ctx.fillStyle = '#2ec4b6';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(wx - 24, wy - 12, 48, 18, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(wx - 10, wy - 18, 20, 7);
        ctx.strokeRect(wx - 10, wy - 18, 20, 7);
      } else {
        // Drifting river plank on fresh save
        ctx.fillStyle = '#b07d4f';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.fillRect(wx - 22, wy - 5, 44, 10);
        ctx.strokeRect(wx - 22, wy - 5, 44, 10);
      }
    }

    // Loaner Reed Rod Rack on right end of dock
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(106, 6);
    ctx.lineTo(122, -36);
    ctx.moveTo(114, 6);
    ctx.lineTo(128, -32);
    ctx.stroke();

    // Crisp dock nameplate
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3d6';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeText('DELTA PUBLIC BANK · LOANER RODS', 0, 14);
    ctx.fillText('DELTA PUBLIC BANK · LOANER RODS', 0, 14);
  } else if (f.kind === 'dock_lamp_spot') {
    // Small brass sign marker for movable lamp rail
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (f.kind === 'tuning_fork') {
    // Undertone Caverns: Colossal fallen brass tuning fork & harmonic bridge rings
    const tuned = flags.undertoneForkTuned;
    const pulse = reducedMotion ? 0 : Math.sin(t * 4.5) * 4;
    if (tuned) {
      ctx.strokeStyle = '#ff70a6';
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.ellipse(0, -14, 58 + pulse, 28 + pulse * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.fillStyle = tuned ? '#ffd166' : '#a88c5d';
    // Stem
    ctx.beginPath();
    ctx.roundRect(-62, -10, 44, 14, 6);
    ctx.fill();
    ctx.stroke();
    // Prongs spanning across cavern chasm
    ctx.beginPath();
    ctx.roundRect(-22, -28, 86, 12, 5);
    ctx.roundRect(-22, 6, 86, 12, 5);
    ctx.fill();
    ctx.stroke();
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = tuned ? '#ff70a6' : '#f7efde';
    ctx.fillText(tuned ? 'TUNING FORK · IN TUNE' : 'FALLEN TUNING FORK', 10, 34);
  } else if (f.kind === 'tide_press') {
    // Negative Coast: Silver-and-ink litho press beside photographic low tide
    const restored = flags.negativePressRestored;
    ctx.fillStyle = restored ? '#e0fbfc' : '#4a5568';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.roundRect(-42, -38, 84, 42, 10);
    ctx.fill();
    ctx.stroke();
    // Ink roller cylinder
    ctx.fillStyle = restored ? '#160c24' : '#2d3748';
    ctx.beginPath();
    ctx.roundRect(-30, -52, 60, 16, 6);
    ctx.fill();
    ctx.stroke();
    // Fresh printed silver weather sheet
    ctx.fillStyle = restored ? '#72efdd' : '#cbd5e0';
    ctx.fillRect(-18, -26, 36, 18);
    ctx.strokeRect(-18, -26, 36, 18);
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e0fbfc';
    ctx.fillText(restored ? 'TIDE PRESS · PRINTING' : 'NEGATIVE TIDE PRESS', 0, 18);
  } else if (f.kind === 'hanging_gutter') {
    // Inverted Allotments: Redirectable copper rain gutter with upward pollen drift
    const directed = flags.invertedGutterDirected;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillStyle = directed ? '#4cc9f0' : '#b07d4f';
    ctx.save();
    ctx.rotate(directed ? -0.18 : 0.22);
    ctx.beginPath();
    ctx.roundRect(-54, -22, 108, 18, 8);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Upward drifting gravity-clover pollen motes
    ctx.fillStyle = '#a8ff3e';
    for (let i = 0; i < 4; i++) {
      const py = -26 - (((t * (reducedMotion ? 0 : 28) + i * 16) % 44));
      ctx.beginPath();
      ctx.arc(-32 + i * 22, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a8ff3e';
    ctx.fillText(directed ? 'GUTTER · TWIN BEDS WATERED' : 'HANGING RAIN GUTTER', 0, 18);
  }

  ctx.restore();
}

export function drawWaterRipples(ctx: CanvasRenderingContext2D, ripples: WaterRipple[]): void {
  if (ripples.length === 0) return;
  ctx.save();
  for (const r of ripples) {
    const ratio = Math.max(0, 1 - r.age / r.maxAge);
    ctx.globalAlpha = ratio * 0.72;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.52, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFishingSession(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  fishing: FishingSession,
  t: number,
  reducedMotion: boolean,
): void {
  if (!fishing.active) return;
  const rodTipX = player.x + player.facing * 26;
  const rodTipY = player.y - 52;
  const pullBend = fishing.phase === 'tension' ? (fishing.fishPulling ? 12 : 5) : 0;

  ctx.save();
  // Fishing rod (iridescent Prism Reel glow if equipped!)
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(player.x + player.facing * 8, player.y - 22);
  ctx.quadraticCurveTo(rodTipX - player.facing * 6, rodTipY - 12 + pullBend, rodTipX, rodTipY + pullBend);
  ctx.stroke();

  ctx.strokeStyle = fishing.usingPrismReel ? '#72efdd' : '#d4a373';
  ctx.lineWidth = 3.2;
  ctx.stroke();

  // Line from rod tip to bobber
  const midX = (rodTipX + fishing.bobberX) * 0.5;
  const sag = fishing.phase === 'tension' && fishing.reelHeld ? 2 : 16;
  const midY = (rodTipY + fishing.bobberY) * 0.5 + sag;
  ctx.strokeStyle =
    fishing.phase === 'tension' && fishing.tension > 72
      ? '#ff4d6d'
      : fishing.usingPrismReel
        ? 'rgba(114, 239, 221, 0.9)'
        : 'rgba(247, 239, 222, 0.85)';
  ctx.lineWidth = fishing.phase === 'tension' ? 2.4 : 1.6;
  ctx.beginPath();
  ctx.moveTo(rodTipX, rodTipY + pullBend);
  ctx.quadraticCurveTo(midX, midY, fishing.bobberX, fishing.bobberY);
  ctx.stroke();

  // Animated bobber position by FSM phase
  let bx = fishing.bobberX;
  let by = fishing.bobberY;
  if (fishing.phase === 'nibble_1' || fishing.phase === 'nibble_2') {
    bx += (reducedMotion ? 4 : Math.sin(t * 28) * 7) * (fishing.phase === 'nibble_2' ? -1 : 1);
  } else if (fishing.phase === 'bite') {
    by += 6;
  } else if (fishing.phase === 'tension') {
    bx += Math.sin(t * 16) * (fishing.fishPulling ? 8 : 3);
    by += Math.cos(t * 12) * 3;
  } else {
    by += reducedMotion ? 0 : Math.sin(t * 3.5) * 2.2;
  }

  // Concentric widening bite rings & tension splash rings
  if (fishing.phase === 'nibble_1' || fishing.phase === 'nibble_2') {
    ctx.strokeStyle = 'rgba(224, 251, 252, 0.78)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(bx, by + 2, 16 + ((t * 28) % 14), 8 + ((t * 14) % 7), 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (fishing.phase === 'bite') {
    const r = 18 + (reducedMotion ? 10 : (t * 62) % 34);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(bx, by + 2, r, r * 0.54, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff5d8f';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(bx, by + 2, r * 0.62, r * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (fishing.phase === 'tension') {
    ctx.strokeStyle = fishing.fishPulling ? '#ff4d6d' : '#2ec4b6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(bx, by + 2, 22, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Cork bobber (red top, cream bottom)
  ctx.fillStyle = fishing.phase === 'bite' ? '#ffd166' : '#ff4d6d';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(bx, by - 2, 6.5, Math.PI, 0);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fffdf7';
  ctx.beginPath();
  ctx.arc(bx, by - 2, 6.5, 0, Math.PI);
  ctx.fill();
  ctx.stroke();

  // Clear diegetic callout above bobber (legible even when muted)
  if (fishing.phase === 'bite' || fishing.phase === 'nibble_1' || fishing.phase === 'nibble_2') {
    ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    const cue = fishing.phase === 'bite' ? 'DIVE! HOOK NOW!' : 'twitch...';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeText(cue, bx, by - 18);
    ctx.fillStyle = fishing.phase === 'bite' ? '#ffd166' : '#c8f4ff';
    ctx.fillText(cue, bx, by - 18);
  }
  ctx.restore();
}

export function drawWorldObject(
  ctx: CanvasRenderingContext2D,
  o: WorldObject,
  t: number,
  wobbleFrac: number,
  trips: Set<TripId>,
  reducedMotion = false,
): void {
  const m = reducedMotion ? 0.2 : 1;
  const sway = Math.sin(t * (2.2 + wobbleFrac * 2.8) + o.seed) * (3 + wobbleFrac * 7) * m;
  const shakeX = o.shake > 0 ? Math.sin(t * 72) * 5.5 : 0;

  ctx.save();
  ctx.translate(o.x + shakeX, o.y);

  ctx.fillStyle = 'rgba(13, 6, 24, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, o.type === 'tree' || o.type === 'cabinet' || o.type === 'pear_tree' ? 24 : 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const flash = o.hitFlash > 0;

  if (o.type === 'tree') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.7, -28, sway * 1.15, -56);
    ctx.stroke();

    ctx.strokeStyle = flash ? '#fffdf7' : '#8b5fbf';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 0.7, -28, sway * 1.15, -56);
    ctx.stroke();

    const crownX = sway * 1.15;
    const crownY = -62;
    const hue = (318 + o.seed * 4 + (wobbleFrac > 0.35 || trips.has('kaleido') ? t * 32 * m : 0)) % 360;
    const crownFill = flash ? '#fffdf7' : `hsl(${hue}, 76%, 56%)`;
    const crownShade = flash ? '#fffdf7' : `hsl(${hue}, 70%, 44%)`;

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(crownX - 15, crownY + 4, 21, 0, Math.PI * 2);
    ctx.arc(crownX + 15, crownY + 4, 21, 0, Math.PI * 2);
    ctx.arc(crownX, crownY - 10, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = crownShade;
    ctx.beginPath();
    ctx.arc(crownX - 15, crownY + 4, 17.5, 0, Math.PI * 2);
    ctx.arc(crownX + 15, crownY + 4, 17.5, 0, Math.PI * 2);
    ctx.arc(crownX, crownY - 10, 21.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = crownFill;
    ctx.beginPath();
    ctx.arc(crownX - 13, crownY + 1, 14, 0, Math.PI * 2);
    ctx.arc(crownX + 13, crownY + 1, 14, 0, Math.PI * 2);
    ctx.arc(crownX, crownY - 12, 19, 0, Math.PI * 2);
    ctx.fill();

    if (wobbleFrac >= 0.32 || trips.has('kaleido') || trips.has('cosmic')) {
      drawGooglyEye(ctx, crownX - 8, crownY - 6, 5.8, t + o.seed, trips.has('kaleido'));
      drawGooglyEye(ctx, crownX + 8, crownY - 6, 5.8, t + o.seed + 1.2, trips.has('kaleido'));
    }
  } else if (o.type === 'pear_tree') {
    // Prism Orchard glass-pear tree with transparent chiming fruit!
    ctx.strokeStyle = INK;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(sway * 0.6, -50);
    ctx.stroke();
    ctx.strokeStyle = flash ? '#fffdf7' : '#2ec4b6';
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = flash ? '#fffdf7' : 'rgba(114, 239, 221, 0.55)';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(sway * 0.6, -60, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hanging transparent Lens-Pear
    ctx.fillStyle = o.ripeChime ? '#ffd166' : '#c8f4ff';
    ctx.beginPath();
    ctx.ellipse(sway * 0.6 + 10, -48, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (o.type === 'receipt_reed') {
    ctx.fillStyle = flash ? '#ffffff' : '#f7efde';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-8 + sway * 0.4, -36, 16, 36, 3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#219ebc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4 + sway * 0.4, -26);
    ctx.lineTo(4 + sway * 0.4, -26);
    ctx.moveTo(-4 + sway * 0.4, -18);
    ctx.lineTo(4 + sway * 0.4, -18);
    ctx.stroke();
  } else if (o.type === 'wax_bloom') {
    ctx.fillStyle = flash ? '#ffffff' : '#ff9f1c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, -14, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, -20, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.type === 'frozen_pea') {
    ctx.fillStyle = flash ? '#ffffff' : '#90be6d';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, -14, 16, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (o.type === 'shroom') {
    const capY = -20 + Math.sin(t * 3 + o.seed) * 2 * m;
    ctx.fillStyle = flash ? '#ffffff' : '#f7efde';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-7, -18, 14, 20, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#ff4d8d';
    ctx.beginPath();
    ctx.ellipse(0, capY, 20, 13, 0, Math.PI, Math.PI * 2);
    ctx.quadraticCurveTo(20, capY + 5, 0, capY + 4);
    ctx.quadraticCurveTo(-20, capY + 5, -20, capY);
    ctx.fill();
    ctx.stroke();
    if (!flash) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(-8, capY - 5, 3.6, 0, Math.PI * 2);
      ctx.arc(5, capY - 7, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (o.type === 'berry') {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-10, -10, 15, 0, Math.PI * 2);
    ctx.arc(10, -10, 15, 0, Math.PI * 2);
    ctx.arc(0, -18, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#2b9348';
    ctx.beginPath();
    ctx.arc(-10, -10, 12, 0, Math.PI * 2);
    ctx.arc(10, -10, 12, 0, Math.PI * 2);
    ctx.arc(0, -18, 14, 0, Math.PI * 2);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = '#5e9cff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      [
        [-7, -15],
        [6, -18],
        [1, -8],
      ].forEach(([bx, by]) => {
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
  } else if (o.type === 'crystal') {
    const hover = Math.sin(t * 4.2 + o.seed) * 6 * m;
    ctx.save();
    ctx.translate(0, -20 + hover);
    ctx.fillStyle = 'rgba(76, 201, 240, 0.24)';
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#4cc9f0';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(14, -3);
    ctx.lineTo(8, 16);
    ctx.lineTo(-8, 16);
    ctx.lineTo(-14, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (o.type === 'cabinet') {
    ctx.save();
    ctx.rotate(Math.sin(o.seed) * 0.08);
    ctx.fillStyle = flash ? '#ffffff' : '#738290';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-16, -46, 32, 48, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-4, -37, 8, 3);
    ctx.fillRect(-4, -22, 8, 3);
    ctx.restore();
  } else if (o.type === 'pickle') {
    ctx.fillStyle = flash ? '#ffffff' : '#2ec4b6';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(0, -16, 10, 18, Math.sin(t * 2 + o.seed) * 0.2 * m, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fffdf7';
    ctx.beginPath();
    ctx.arc(0, -16, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (o.type === 'hyper') {
    ctx.fillStyle = flash ? '#ffffff' : '#ffd166';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-10, -18);
    ctx.lineTo(-2, -18);
    ctx.lineTo(-6, -34);
    ctx.lineTo(12, -15);
    ctx.lineTo(3, -15);
    ctx.lineTo(8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (o.type === 'broc') {
    ctx.fillStyle = flash ? '#ffffff' : '#95d5b2';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-6, -16, 12, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#48cae4';
    ctx.beginPath();
    ctx.arc(-9, -22, 10, 0, Math.PI * 2);
    ctx.arc(9, -22, 10, 0, Math.PI * 2);
    ctx.arc(0, -29, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (o.type === 'cocoa') {
    ctx.fillStyle = flash ? '#ffffff' : '#5e2ca5';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(0, -16, 14, 17, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (o.type === 'sock_pile') {
    ctx.fillStyle = flash ? '#ffffff' : '#ff85b3';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-6, -24);
    ctx.lineTo(5, -24);
    ctx.lineTo(6, -6);
    ctx.lineTo(15, -1);
    ctx.quadraticCurveTo(16, 6, 8, 6);
    ctx.lineTo(-6, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (o.type === 'cloud') {
    const hover = Math.sin(t * 3 + o.seed) * 4 * m;
    ctx.fillStyle = flash ? '#ffffff' : '#e0fbfc';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(-11, -12 + hover, 10, 0, Math.PI * 2);
    ctx.arc(11, -12 + hover, 10, 0, Math.PI * 2);
    ctx.arc(0, -19 + hover, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (o.type === 'geode') {
    // Minecraft-inspired glowing amethyst/prism crystal geode cluster
    ctx.fillStyle = flash ? '#ffffff' : '#3a2d4c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(0, -8, 19, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const shards: Array<[number, number, number, string]> = [
      [-9, -12, -0.35, '#72efdd'],
      [0, -18, 0.04, '#b388ff'],
      [9, -11, 0.42, '#ff85b3'],
    ];
    for (const [sx, sy, rot, col] of shards) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(rot);
      ctx.fillStyle = flash ? '#ffffff' : col;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Twinkle glint
    const glint = 0.5 + 0.5 * Math.sin(t * 4.5 + o.seed);
    ctx.fillStyle = `rgba(255,255,255,${glint * 0.9})`;
    ctx.beginPath();
    ctx.arc(2, -26, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.type === 'salvage_crate') {
    // Rust-inspired riveted roadside salvage supply crate
    ctx.fillStyle = flash ? '#ffffff' : '#b07d4f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-17, -28, 34, 28, 4);
    ctx.fill();
    ctx.stroke();

    // Diagonal scrap brace & stencil stripe
    ctx.strokeStyle = '#6f4a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, -25);
    ctx.lineTo(14, -3);
    ctx.stroke();

    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.fillRect(-13, -18, 26, 7);
    ctx.strokeRect(-13, -18, 26, 7);
  } else if (o.type === 'moon_orchid') {
    // Strange Horticulture-inspired arcane botanical specimen
    const sway = Math.sin(t * 2 + o.seed) * 3 * m;
    ctx.strokeStyle = '#3d2463';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.quadraticCurveTo(sway - 6, -16, sway + 2, -30);
    ctx.stroke();

    ctx.fillStyle = flash ? '#ffffff' : '#e0aaff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + t * 0.35 * m;
      ctx.beginPath();
      ctx.ellipse(sway + 2 + Math.cos(a) * 9, -30 + Math.sin(a) * 6, 8, 4.5, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(sway + 2, -30, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.type === 'eye_bloom') {
    // Spinch-inspired kinetic neon psychedelic eye-flower
    const pulse = 1 + Math.sin(t * 3.4 + o.seed) * 0.1 * m;
    const hue = (t * 48 * m + o.seed * 19) % 360;
    ctx.strokeStyle = '#2ec4b6';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, -24);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, -26);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = flash ? '#ffffff' : `hsl(${hue}, 92%, 62%)`;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.6 * m;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 11, Math.sin(a) * 11, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    drawGooglyEye(ctx, 0, 0, 8.5, t * 1.4 + o.seed, wobbleFrac > 0.4 || trips.has('kaleido'));
    ctx.restore();
  } else if (o.type === 'tuned_reed_patch') {
    // Harmonic pink-gold resonant cavern reeds
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    for (let i = -1; i <= 1; i++) {
      const h = 28 + (i === 0 ? 10 : 0);
      ctx.fillStyle = flash ? '#ffffff' : i === 0 ? '#ffd166' : '#ff70a6';
      ctx.beginPath();
      ctx.roundRect(i * 9 - 3, -h, 6, h, 3);
      ctx.fill();
      ctx.stroke();
    }
  } else if (o.type === 'gravity_clover_patch') {
    // Upside-down floating neon-lime clover cluster
    const lift = Math.sin(t * 2.8 + o.seed) * 4 * m;
    ctx.strokeStyle = '#a8ff3e';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -24 + lift);
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#a8ff3e';
    ctx.strokeStyle = INK;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 7, -24 + lift + Math.sin(a) * 7, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

export function drawMailbox(ctx: CanvasRenderingContext2D, m: Mailbox, t: number): void {
  ctx.save();
  ctx.translate(m.x, m.y);

  ctx.strokeStyle = m.col;
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(0, 3, 28 + Math.sin(t * 3) * 3, 12, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#6c584c';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.fillRect(-4, -22, 8, 25);
  ctx.strokeRect(-4, -22, 8, 25);

  ctx.fillStyle = m.discovered ? '#e63946' : '#738290';
  ctx.beginPath();
  ctx.roundRect(-16, -40, 32, 20, [10, 10, 3, 3]);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = m.col;
  ctx.fillRect(-10, -34, 20, 6);

  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(16, -30);
  ctx.lineTo(22, -42 + Math.sin(t * 4) * 2);
  ctx.stroke();

  ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  ctx.strokeText('WORMHOLE', 0, 19);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('WORMHOLE', 0, 19);

  ctx.restore();
}

export function drawBuilding(ctx: CanvasRenderingContext2D, b: Building, t: number, megaLamp: boolean): void {
  ctx.save();
  ctx.translate(b.x, b.y);

  if (b.type === 'lava_lamp') {
    const lr = megaLamp ? 245 : 175;
    const g = ctx.createRadialGradient(0, -14, 12, 0, -14, lr);
    g.addColorStop(0, `hsla(${(t * 35) % 360}, 95%, 65%, 0.25)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -14, lr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-13, 2);
    ctx.lineTo(13, 2);
    ctx.lineTo(8, -10);
    ctx.lineTo(-8, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#2d1a4b';
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(-12, -32);
    ctx.lineTo(-6, -50);
    ctx.lineTo(6, -50);
    ctx.lineTo(12, -32);
    ctx.lineTo(8, -10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = `hsl(${(t * 45 + 320) % 360}, 92%, 62%)`;
    const by1 = -22 + Math.sin(t * 2.2 + b.phase) * 9;
    const by2 = -36 + Math.cos(t * 1.9 + b.phase) * 7;
    ctx.beginPath();
    ctx.arc(-2, by1, 5.5, 0, Math.PI * 2);
    ctx.arc(2.5, by2, 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(-7, -50);
    ctx.lineTo(7, -50);
    ctx.lineTo(4, -58);
    ctx.lineTo(-4, -58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (b.type === 'mood_plot') {
    ctx.fillStyle = '#7f4f24';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-28, -16, 56, 32, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4a2c17';
    ctx.beginPath();
    ctx.roundRect(-23, -11, 46, 22, 4);
    ctx.fill();

    if (b.crop) {
      const crop = CROPS[b.crop];
      const pct = Math.min(1, b.growth / crop.time);
      const scale = 0.45 + pct * 0.7;
      ctx.save();
      ctx.translate(0, -4);
      ctx.scale(scale, scale);

      if (b.crop === 'bell_reed_crop') {
        // Distinct Bell Reed growth stages: shoot -> reeds -> golden-teal chiming bells!
        ctx.strokeStyle = '#2ec4b6';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-8, 6);
        ctx.quadraticCurveTo(-11, -8, -7, -20);
        ctx.moveTo(0, 6);
        ctx.lineTo(0, -24);
        ctx.moveTo(8, 6);
        ctx.quadraticCurveTo(11, -8, 7, -19);
        ctx.stroke();
        if (pct >= 0.45) {
          ctx.fillStyle = pct >= 1 ? '#ffd166' : '#72efdd';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 2.2;
          for (const [bx, by] of [
            [-7, -22],
            [0, -27],
            [7, -21],
          ]) {
            ctx.beginPath();
            ctx.arc(bx, by, 5, Math.PI, 0);
            ctx.lineTo(bx + 6, by + 5);
            ctx.lineTo(bx - 6, by + 5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
      } else {
        ctx.strokeStyle = '#52b788';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.lineTo(0, -14);
        ctx.stroke();

        ctx.fillStyle = crop.accent;
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(0, -18, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = INK;
      ctx.fillRect(-20, 12, 40, 6);
      ctx.fillStyle = pct >= 1 ? '#2ec4b6' : '#ffd166';
      ctx.fillRect(-19, 13, 38 * pct, 4);
    } else {
      ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#f7efde';
      ctx.textAlign = 'center';
      ctx.fillText('SOIL', 0, 3);
    }
  } else if (b.type === 'funk_blender') {
    ctx.fillStyle = '#ff5d8f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-14, -14, 28, 16, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c8f4ff';
    ctx.beginPath();
    ctx.moveTo(-11, -14);
    ctx.lineTo(-14, -40);
    ctx.lineTo(14, -40);
    ctx.lineTo(11, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `hsl(${(t * 90) % 360}, 90%, 62%)`;
    ctx.fillRect(-10, -30, 20, 14);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.roundRect(-15, -45, 30, 6, 3);
    ctx.fill();
    ctx.stroke();
  } else if (b.type === 'boombox') {
    ctx.fillStyle = '#3a245c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-22, -26, 44, 26, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2ec4b6';
    ctx.beginPath();
    ctx.arc(-11, -13, 7, 0, Math.PI * 2);
    ctx.arc(11, -13, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (b.type === 'sassy_chest') {
    ctx.fillStyle = '#d48c3b';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-19, -26, 38, 26, 6);
    ctx.fill();
    ctx.stroke();
    drawGooglyEye(ctx, -7, -20, 4.2, t * 1.3);
    drawGooglyEye(ctx, 7, -20, 4.2, t * 1.3 + 0.8);
  } else if (b.type === 'dream_totem') {
    // Don't Starve-inspired sanity/calming Velvet Dreamcatcher Totem
    const g = ctx.createRadialGradient(0, -24, 14, 0, -24, 210);
    g.addColorStop(0, 'rgba(224, 170, 255, 0.22)');
    g.addColorStop(1, 'rgba(224, 170, 255, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -24, 210, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7f4f24';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.fillRect(-4, -36, 8, 38);
    ctx.strokeRect(-4, -36, 8, 38);

    // Woven pastel hoop
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, -44, 15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#e0aaff';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.2;
      ctx.beginPath();
      ctx.moveTo(0, -44);
      ctx.lineTo(Math.cos(a) * 14, -44 + Math.sin(a) * 14);
      ctx.stroke();
    }
    // Dangling feathers
    ctx.fillStyle = '#72efdd';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    for (const fx of [-9, 0, 9]) {
      const sway = Math.sin(t * 2.5 + fx) * 2.5;
      ctx.beginPath();
      ctx.ellipse(fx + sway, -24, 3.5, 8, 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (b.type === 'vibe_beacon') {
    // Minecraft-inspired Prismatic Sky-Beam Beacon
    const hue = (t * 50) % 360;
    const beam = ctx.createLinearGradient(0, -34, 0, -240);
    beam.addColorStop(0, `hsla(${hue}, 95%, 72%, 0.55)`);
    beam.addColorStop(1, `hsla(${(hue + 80) % 360}, 95%, 72%, 0)`);
    ctx.fillStyle = beam;
    ctx.fillRect(-10, -240, 20, 210);

    ctx.fillStyle = '#2d1a4b';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(-22, 4);
    ctx.lineTo(22, 4);
    ctx.lineTo(14, -14);
    ctx.lineTo(-14, -14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = `hsl(${hue}, 92%, 68%)`;
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(12, -24);
    ctx.lineTo(0, -14);
    ctx.lineTo(-12, -24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (b.type === 'boop_turret') {
    // Rust-inspired automated Confetti Repeller base defense trap
    ctx.fillStyle = '#4a3b5c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-16, 4);
    ctx.lineTo(0, -16);
    ctx.lineTo(16, 4);
    ctx.stroke();

    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath();
    ctx.arc(0, -22, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const aim = Math.sin(t * 1.6 + b.phase) * 0.7;
    ctx.save();
    ctx.translate(0, -22);
    ctx.rotate(aim);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.roundRect(4, -5, 18, 10, 3);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (b.type === 'camp_table') {
    // Cozy Camp Supper Table — visibly gains a second place setting once Capt. Nix is served!
    const vertical = ((b.rotation ?? 0) % 2) === 1;
    const tw = vertical ? 44 : 68;
    const th = vertical ? 54 : 38;
    ctx.fillStyle = 'rgba(13, 6, 24, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 8, tw * 0.56, th * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Table legs
    ctx.fillStyle = '#5c3a21';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.fillRect(-tw * 0.4, -2, 8, 14);
    ctx.fillRect(tw * 0.4 - 8, -2, 8, 14);

    // Tabletop
    ctx.fillStyle = '#c98b4d';
    ctx.beginPath();
    ctx.roundRect(-tw * 0.5, -th + 8, tw, th, 8);
    ctx.fill();
    ctx.stroke();

    // Warm woven table runner
    ctx.fillStyle = '#ff85b3';
    ctx.fillRect(-tw * 0.16, -th + 10, tw * 0.32, th - 4);

    // Player's ceramic supper bowl (left)
    ctx.fillStyle = '#fffdf7';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-tw * 0.26, -th * 0.5 + 8, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(-tw * 0.26, -th * 0.5 + 8, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Second place setting for Capt. Nix (visibly appears after Dinner for the Last Ferry!)
    if (b.hasSecondSetting) {
      ctx.fillStyle = '#e0fbfc';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tw * 0.26, -th * 0.5 + 8, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.arc(tw * 0.26, -th * 0.5 + 8, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // Tiny brass teacup & gentle steam curl
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(tw * 0.36, -th * 0.72 + 8, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 253, 247, 0.75)';
      ctx.lineWidth = 1.6;
      const st = Math.sin(t * 3.5) * 2.5;
      ctx.beginPath();
      ctx.moveTo(tw * 0.26, -th * 0.5);
      ctx.quadraticCurveTo(tw * 0.26 + st, -th * 0.5 - 10, tw * 0.26 - st, -th * 0.5 - 18);
      ctx.stroke();
    }
  } else if (b.type === 'bench') {
    const vertical = ((b.rotation ?? 0) % 2) === 1;
    ctx.fillStyle = 'rgba(13, 6, 24, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 6, vertical ? 15 : 28, vertical ? 24 : 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9c6644';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    if (vertical) {
      ctx.beginPath();
      ctx.roundRect(-10, -24, 20, 48, 5);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.roundRect(-26, -14, 52, 18, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#6c4427';
      ctx.fillRect(-20, 4, 6, 7);
      ctx.fillRect(14, 4, 6, 7);
    }
  } else if (b.type === 'dock_lamp') {
    const lr = megaLamp ? 215 : 165;
    const g = ctx.createRadialGradient(0, -24, 8, 0, -24, lr);
    g.addColorStop(0, 'rgba(255, 224, 130, 0.34)');
    g.addColorStop(1, 'rgba(255, 224, 130, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -24, lr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4a3b5c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.fillRect(-3, -30, 6, 32);
    ctx.strokeRect(-3, -30, 6, 32);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.roundRect(-11, -50, 22, 22, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff9db';
    ctx.beginPath();
    ctx.arc(0, -39, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.type === 'rain_trough') {
    ctx.fillStyle = '#738290';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-26, -18, 52, 24, 6);
    ctx.fill();
    ctx.stroke();
    // Shimmering reflective rainwater surface
    ctx.fillStyle = '#48cae4';
    ctx.beginPath();
    ctx.roundRect(-21, -14, 42, 14, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.6;
    const sh = Math.sin(t * 2.4 + b.phase) * 5;
    ctx.beginPath();
    ctx.moveTo(-12 + sh, -8);
    ctx.lineTo(10 + sh, -8);
    ctx.stroke();
  } else if (b.type === 'workbench') {
    ctx.fillStyle = '#8b5e34';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-28, -28, 56, 30, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c9a66b';
    ctx.fillRect(-24, -24, 48, 12);
    ctx.strokeRect(-24, -24, 48, 12);
    // Brass vise & T-square
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(-22, -33, 12, 10);
    ctx.strokeRect(-22, -33, 12, 10);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(6, -34, 14, 6);
    ctx.strokeRect(6, -34, 14, 6);
  } else if (b.type === 'camp_relay') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillStyle = '#2e777d';
    ctx.beginPath();
    ctx.roundRect(-24, -31, 48, 35, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e6bd7a';
    ctx.beginPath();
    ctx.roundRect(-17, -24, 34, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#211238';
    ctx.fillRect(-12, -19, 16, 8);
    ctx.fillStyle = '#72efdd';
    ctx.fillRect(-10, -17, 11, 4);
    ctx.fillStyle = '#ff895d';
    ctx.beginPath();
    ctx.arc(10, -15, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, -31);
    ctx.lineTo(14, -51);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(14, -52, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (b.type === 'frost_pantry') {
    ctx.fillStyle = '#90e0ef';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-20, -44, 40, 46, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#caf0f8';
    ctx.fillRect(-15, -38, 30, 18);
    ctx.strokeRect(-15, -38, 30, 18);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(9, -31, 4, 10);
  } else if (b.type === 'choir_irrigator') {
    ctx.fillStyle = '#2ec4b6';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.fillRect(-5, -24, 10, 26);
    ctx.strokeRect(-5, -24, 10, 26);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, -30, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Gentle shimmering water arcs
    ctx.strokeStyle = 'rgba(144, 224, 239, 0.72)';
    ctx.lineWidth = 2;
    const r = 18 + ((t * 24) % 18);
    ctx.beginPath();
    ctx.arc(0, -28, r, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
  } else if (b.type === 'camp_awning') {
    // Striped canvas shelter canopy on timber posts with soft warm shelter halo
    ctx.fillStyle = 'rgba(255, 209, 102, 0.12)';
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.35)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 4, 52, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillStyle = '#9c6644';
    ctx.fillRect(-34, -44, 6, 48);
    ctx.strokeRect(-34, -44, 6, 48);
    ctx.fillRect(28, -44, 6, 48);
    ctx.strokeRect(28, -44, 6, 48);

    // Scalloped striped awning roof
    const stripes = ['#ff5d8f', '#fff3d6', '#2ec4b6', '#fff3d6', '#ff5d8f'];
    for (let i = 0; i < stripes.length; i++) {
      const sx = -40 + i * 16;
      ctx.fillStyle = stripes[i];
      ctx.beginPath();
      ctx.roundRect(sx, -56, 16, 18, [4, 4, 7, 7]);
      ctx.fill();
      ctx.stroke();
    }
  } else if (b.type === 'specimen_cabinet') {
    // Glass-front naturalist field specimen cabinet
    ctx.fillStyle = '#6f4e37';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-22, -48, 44, 50, 6);
    ctx.fill();
    ctx.stroke();
    // Illuminated glass display pane
    ctx.fillStyle = '#1b263b';
    ctx.fillRect(-16, -42, 32, 26);
    ctx.strokeRect(-16, -42, 32, 26);
    // Tiny mounted reed, minnow & clover specimens
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.ellipse(-6, -34, 5, 2.5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a8ff3e';
    ctx.beginPath();
    ctx.arc(7, -34, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff70a6';
    ctx.fillRect(-10, -26, 20, 4);
    // Brass drawer pulls
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-12, -10, 24, 5);
    ctx.strokeRect(-12, -10, 24, 5);
  }

  ctx.restore();
}

export function drawDroppedSatchel(
  ctx: CanvasRenderingContext2D,
  satchel: DroppedSatchel,
  t: number,
  reducedMotion = false,
): void {
  const bob = reducedMotion ? 0 : Math.sin(t * 3.8) * 3.5;
  ctx.save();
  ctx.translate(satchel.x, satchel.y);

  // Beacon ring so player can spot their lost satchel effortlessly
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2.5;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(0, 4, 30 + (reducedMotion ? 0 : Math.sin(t * 3) * 4), 14, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.translate(0, bob);
  ctx.fillStyle = '#d48c3b';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-18, -22, 36, 24, 7);
  ctx.fill();
  ctx.stroke();

  // Flap & brass buckle
  ctx.fillStyle = '#f4a261';
  ctx.beginPath();
  ctx.roundRect(-18, -22, 36, 11, [7, 7, 3, 3]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(-4, -14, 8, 7);
  ctx.strokeRect(-4, -14, 8, 7);

  ctx.font = '900 10px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.5;
  ctx.strokeText('LOST SATCHEL [Space]', 0, -32);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('LOST SATCHEL [Space]', 0, -32);
  ctx.restore();
}

export function drawResident(
  ctx: CanvasRenderingContext2D,
  res: ResidentDef,
  x: number,
  y: number,
  t: number,
  reducedMotion = false,
): void {
  ctx.save();
  ctx.translate(x, y);

  // Cozy rug / workstation circle
  ctx.fillStyle = 'rgba(255, 209, 102, 0.16)';
  ctx.strokeStyle = res.accent;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(0, 4, 38, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const bob = reducedMotion ? 0 : Math.sin(t * 3.2 + res.id.charCodeAt(0)) * 2.5;
  ctx.translate(0, bob);

  if (res.id === 'reginald') {
    ctx.fillStyle = '#4c2c7a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-16, -30, 32, 30, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe5c8';
    ctx.beginPath();
    ctx.arc(0, -43, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1b112e';
    ctx.fillRect(-18, -58, 36, 5);
    ctx.fillRect(-11, -78, 22, 20);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-11, -63, 22, 5);
    ctx.strokeStyle = '#f7efde';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -37);
    ctx.quadraticCurveTo(-12, -33, -20, -40);
    ctx.moveTo(0, -37);
    ctx.quadraticCurveTo(12, -33, 20, -40);
    ctx.stroke();
  } else if (res.id === 'grandma') {
    ctx.fillStyle = '#ff9ec4';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -16, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff5f8';
    ctx.beginPath();
    ctx.arc(0, -40, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-8, -52, 8, 0, Math.PI * 2);
    ctx.arc(8, -52, 8, 0, Math.PI * 2);
    ctx.arc(0, -56, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (res.id === 'trenchcoat') {
    ctx.fillStyle = '#8b6f47';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-14, -40);
    ctx.lineTo(14, -40);
    ctx.lineTo(18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#52b788';
    ctx.beginPath();
    ctx.ellipse(0, -47, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawGooglyEye(ctx, -6, -54, 4.4, t * 2);
    drawGooglyEye(ctx, 6, -54, 4.4, t * 2 + 1);
    drawGooglyEye(ctx, 3, -24, 3.2, t * 1.5);
  } else {
    // 8 Original Peoples: distinct torso silhouette & signature cultural headwear!
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillStyle = res.accent;
    ctx.beginPath();
    ctx.roundRect(-14, -31, 28, 30, 9);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.fillStyle = res.people === 'glazelings' ? '#c8f4ff' : res.people === 'lampspun' ? '#ffe5b4' : '#f7efde';
    ctx.beginPath();
    ctx.arc(0, -44, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cultural silhouette headwear by PeopleId
    if (res.people === 'creasefolk') {
      // Origami folded paper boat hat
      ctx.fillStyle = '#fffdf7';
      ctx.beginPath();
      ctx.moveTo(-20, -53);
      ctx.lineTo(0, -72);
      ctx.lineTo(20, -53);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (res.people === 'belljacks') {
      // Brass tuning-fork horns
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, -56);
      ctx.lineTo(-10, -72);
      ctx.moveTo(10, -56);
      ctx.lineTo(10, -72);
      ctx.moveTo(-10, -56);
      ctx.lineTo(10, -56);
      ctx.stroke();
    } else if (res.people === 'overprints') {
      // Ink-roller beret
      ctx.fillStyle = '#219ebc';
      ctx.beginPath();
      ctx.ellipse(0, -57, 17, 6, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (res.people === 'selvedge') {
      // Giant wooden clothespin crest
      ctx.fillStyle = '#d48c3b';
      ctx.fillRect(-5, -73, 10, 18);
      ctx.strokeRect(-5, -73, 10, 18);
    } else if (res.people === 'glazelings') {
      // Prismatic glass dome halo
      ctx.strokeStyle = '#72efdd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -44, 19, Math.PI, 0);
      ctx.stroke();
    } else if (res.people === 'brinebacks') {
      // River captain oilskin cap
      ctx.fillStyle = '#1f3f52';
      ctx.beginPath();
      ctx.arc(0, -54, 13, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-16, -56, 32, 4);
    } else if (res.people === 'lampspun') {
      // Glowing wax-collar flame
      ctx.fillStyle = '#ff9f1c';
      ctx.beginPath();
      ctx.ellipse(0, -64, 6, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (res.people === 'sporesteppers') {
      // Cozy cork-mushroom cap
      ctx.fillStyle = '#90be6d';
      ctx.beginPath();
      ctx.ellipse(0, -56, 19, 9, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Friendly cartoon eyes
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-5, -45, 2.5, 0, Math.PI * 2);
    ctx.arc(5, -45, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nameplate
  ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeText(res.name, 0, -80);
  ctx.fillStyle = '#f7efde';
  ctx.fillText(res.name, 0, -80);

  ctx.restore();
}

export function drawCreature(
  ctx: CanvasRenderingContext2D,
  c: Creature,
  t: number,
  isGravityNap: boolean,
  reducedMotion = false,
): void {
  const def = CREATURE_DEFS[c.type];
  const m = reducedMotion ? 0.2 : 1;
  const hover = Math.sin(t * 4.2 + c.seed) * 4 * m + (isGravityNap ? 18 : 0);

  if (c.aiState === 'windup' && def.hostile) {
    const pulse = 0.55 + Math.sin(t * 24) * 0.3;
    ctx.save();
    if (def.policy === 'charger') {
      ctx.strokeStyle = `rgba(255, 77, 109, ${pulse})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.telegraphX, c.telegraphY);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (def.policy === 'orbiter_ranged') {
      ctx.strokeStyle = `rgba(255, 159, 28, ${pulse})`;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 16);
      ctx.lineTo(c.telegraphX, c.telegraphY - 12);
      ctx.stroke();
    } else {
      const r = c.telegraphRadius || 78;
      ctx.fillStyle = 'rgba(255, 0, 110, 0.22)';
      ctx.strokeStyle = `rgba(255, 209, 102, ${pulse})`;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(c.telegraphX, c.telegraphY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = 'rgba(13, 6, 24, 0.3)';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 4, def.boss ? 46 : 20, def.boss ? 16 : 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(c.x, c.y - 10 - hover);

  if (c.aiState === 'ko') {
    const p = Math.min(1, 1 - c.koTimer / 0.4);
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.rotate(p * 1.4 * (c.facing || 1));
  } else {
    if (c.danceTimer > 0 && !reducedMotion) ctx.rotate(Math.sin(t * 18) * 0.22);
    if (c.hitAnim > 0) ctx.scale(1.22, 0.82);
  }

  const flash = c.hitFlash > 0;

  if (c.type === 'needle_wren') {
    // Needle Wren: brass phonograph legs—clearly lifts one foot when c.footLift > 0 before groove reversal!
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(-5, 10);
    ctx.moveTo(4, -4);
    if (c.footLift > 0) {
      // Lifted foot warning!
      ctx.lineTo(13, -1);
    } else {
      ctx.lineTo(5, 10);
    }
    ctx.stroke();

    ctx.fillStyle = flash ? '#ffffff' : '#ff70a6';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(0, -14, 15, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Phonograph-needle beak
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(13 * c.facing, -17);
    ctx.lineTo(27 * c.facing, -14);
    ctx.lineTo(13 * c.facing, -11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawGooglyEye(ctx, 7 * c.facing, -16, 3.5, t + c.seed);

    if (c.footLift > 0) {
      ctx.fillStyle = '#ffd166';
      ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FLIP!', 0, -30);
    }
  } else if (c.type === 'lantern_moth') {
    // Glowing Wickwater Lantern Moth
    const flap = reducedMotion ? 2 : Math.sin(t * 18 + c.seed) * 7;
    ctx.fillStyle = 'rgba(255, 159, 28, 0.25)';
    ctx.beginPath();
    ctx.arc(0, -18, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = flash ? '#ffffff' : '#ff9f1c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(-12, -20 + flap * 0.4, 13, 8, -0.35, 0, Math.PI * 2);
    ctx.ellipse(12, -20 + flap * 0.4, 13, 8, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.ellipse(0, -18, 7, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawGooglyEye(ctx, -3, -22, 2.8, t + c.seed);
    drawGooglyEye(ctx, 3, -22, 2.8, t + c.seed + 0.6);
  } else if (c.type === 'honk_blimp') {
    ctx.fillStyle = flash ? '#ffffff' : '#fff8e8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(0, -14, 22, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!flash) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-16, -18, 32, 6);
    }
    ctx.fillStyle = flash ? '#ffffff' : '#fff8e8';
    ctx.beginPath();
    ctx.arc(16 * c.facing, -26, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.moveTo(22 * c.facing, -28);
    ctx.lineTo(34 * c.facing, -24);
    ctx.lineTo(22 * c.facing, -21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawGooglyEye(ctx, 18 * c.facing, -28, 3.6, t + c.seed);
  } else if (c.type === 'toast_crab') {
    const pop = Math.abs(Math.sin(t * 3.5 + c.seed)) * 8 * m;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.fillStyle = '#f4a261';
    ctx.beginPath();
    ctx.roundRect(-11, -30 - pop, 22, 16, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#ff5d8f';
    ctx.beginPath();
    ctx.roundRect(-17, -20, 34, 22, 8);
    ctx.fill();
    ctx.stroke();
    drawGooglyEye(ctx, -6, -11, 3.8, t + c.seed);
    drawGooglyEye(ctx, 6, -11, 3.8, t + c.seed + 0.7);
  } else if (c.type === 'sofa_sloth') {
    ctx.fillStyle = flash ? '#ffffff' : '#c77dff';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-22, -26, 44, 26, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#ff85b3';
    ctx.beginPath();
    ctx.roundRect(-15, -18, 30, 14, 6);
    ctx.fill();
    ctx.stroke();
  } else if (c.type === 'existential_duck') {
    ctx.fillStyle = flash ? '#ffffff' : '#ffd166';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(0, -10, 17, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8 * c.facing, -23, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2ec4b6';
    ctx.beginPath();
    ctx.ellipse(6 * c.facing, -32, 12, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawGooglyEye(ctx, 10 * c.facing, -25, 3.4, t + c.seed);
  } else if (c.type === 'reality_inspector') {
    ctx.fillStyle = flash ? '#ffffff' : '#2b2d42';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-15, -34, 30, 34, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : '#edf2f4';
    ctx.beginPath();
    ctx.arc(0, -45, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#160c24';
    ctx.beginPath();
    ctx.arc(0, -54, 12, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-17, -55, 34, 4);
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(5 * c.facing, -46, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (c.type === 'paperwork_gremlin') {
    ctx.fillStyle = flash ? '#ffffff' : '#ff9f1c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.roundRect(-14, -30, 28, 26, 5);
    ctx.fill();
    ctx.stroke();
    drawGooglyEye(ctx, -5, -19, 4.2, t * 2);
    drawGooglyEye(ctx, 5, -19, 4.2, t * 2 + 1.5);
  } else if (c.type === 'frost_cube') {
    ctx.fillStyle = flash ? '#ffffff' : '#90e0ef';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-20, -36, 40, 36, 9);
    ctx.fill();
    ctx.stroke();
    drawGooglyEye(ctx, -7, -21, 4.8, t * 1.4);
    drawGooglyEye(ctx, 7, -21, 4.8, t * 1.4 + 0.9);
  } else if (c.type === 'tax_octopus_boss') {
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.sin(t * 2.4 + i) * 0.2 * m;
      const tx = Math.cos(ang) * 44;
      const ty = Math.sin(ang) * 20 - 6;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.quadraticCurveTo(tx * 0.5, ty - 14, tx, ty);
      ctx.stroke();
      ctx.strokeStyle = flash ? '#ffffff' : '#d90429';
      ctx.lineWidth = 6.5;
      ctx.stroke();
    }
    ctx.fillStyle = flash ? '#ffffff' : '#ef233c';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, -34, 30, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2ec4b6';
    ctx.beginPath();
    ctx.ellipse(0, -45, 26, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawGooglyEye(ctx, -11, -33, 6.8, t * 2.5, true);
    drawGooglyEye(ctx, 11, -33, 6.8, t * 2.5 + 1.2, true);
  }

  if (c.tamed) {
    ctx.fillStyle = '#ff5d8f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    const hy = -42 + Math.sin(t * 5) * 2.5 * m;
    ctx.beginPath();
    ctx.arc(-3.5, hy, 4, 0, Math.PI * 2);
    ctx.arc(3.5, hy, 4, 0, Math.PI * 2);
    ctx.moveTo(-7.2, hy + 1.5);
    ctx.lineTo(0, hy + 9);
    ctx.lineTo(7.2, hy + 1.5);
    ctx.fill();
    ctx.stroke();
  }

  if (def.hostile && c.aiState !== 'ko' && (def.boss || c.hp < c.maxHp)) {
    const bw = def.boss ? 86 : 42;
    const by = def.boss ? -72 : -66;
    ctx.fillStyle = INK;
    ctx.fillRect(-bw / 2 - 1, by - 1, bw + 2, 9);
    ctx.fillStyle = def.boss ? '#ff006e' : '#ff5d8f';
    ctx.fillRect(-bw / 2, by, bw * Math.max(0, c.hp / c.maxHp), 7);
  }

  ctx.restore();

  if (c.sayTimer > 0 && c.say) {
    ctx.save();
    ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    const ty = c.y - (def.boss ? 98 : 66);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeText(c.say, c.x, ty);
    ctx.fillStyle = '#fffdf7';
    ctx.fillText(c.say, c.x, ty);
    ctx.restore();
  }
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  t: number,
  trips: Set<TripId>,
  isGravityNap: boolean,
  ghostTimer: number,
  reducedMotion = false,
): void {
  const ch = CHARACTERS[p.charId];
  const effectiveStyle = trips.has('floaty') ? 'astral_glide' : p.moveStyle;
  const st = STYLES[effectiveStyle];
  const speedNorm = Math.min(1, Math.hypot(p.vx, p.vy) / 160);

  let lift = st.hover ? st.hover + Math.sin(t * 5) * 4 : Math.abs(Math.sin(p.bob)) * st.bounce * speedNorm;
  if (isGravityNap) lift += 16;
  if (p.elevation === 1) lift += 18;

  // Barnaby porcelain low-Vibe gentle shiver
  const barnabyShiver = p.charId === 'barnaby' && p.vibe < p.maxVibe * 0.3 && !reducedMotion ? Math.sin(t * 36) * 2.2 : 0;

  ctx.fillStyle = 'rgba(13, 6, 24, 0.32)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 5, 19 - Math.min(6, lift * 0.2), 7.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(p.x + barnabyShiver, p.y - lift);
  if (ghostTimer > 0) ctx.globalAlpha = 0.56;
  if (p.rollTimer > 0 && !reducedMotion) {
    ctx.rotate((1 - p.rollTimer / 0.22) * Math.PI * 2 * p.facing);
  }
  ctx.scale(p.facing * p.squashX, p.squashY);
  if (p.actionAnim > 0) ctx.rotate(0.22);

  const flash = p.hitFlash > 0;
  const leg = Math.sin(p.bob) * 11 * speedNorm;

  ctx.strokeStyle = ch.colors.limb;
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.quadraticCurveTo(-8 - leg * 0.5, 4, -7 - leg, 9);
  ctx.moveTo(6, -4);
  ctx.quadraticCurveTo(8 + leg * 0.5, 4, 7 + leg, 9);
  ctx.stroke();

  if (effectiveStyle === 'toast_skates') {
    ctx.fillStyle = '#f4a261';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillRect(-13 - leg, 5, 12, 6);
    ctx.strokeRect(-13 - leg, 5, 12, 6);
    ctx.fillRect(1 + leg, 5, 12, 6);
    ctx.strokeRect(1 + leg, 5, 12, 6);
  }

  ctx.fillStyle = flash ? '#ffffff' : p.gear.sweater ? '#ff85b3' : ch.colors.body;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.roundRect(-14, -31, 28, 29, ch.id === 'gerald' ? 4 : 11);
  ctx.fill();
  ctx.stroke();

  if (!flash) {
    if (ch.id === 'pip') {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-11, -29);
      ctx.lineTo(11, -6);
      ctx.stroke();
    } else if (ch.id === 'barnaby') {
      ctx.strokeStyle = '#ff70a6';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-15, -18, 7, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
    } else if (ch.id === 'gerald') {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-5, -24, 10, 3);
      ctx.fillRect(-5, -13, 10, 3);
    } else if (ch.id === 'tilda') {
      // Pleated surveyor sash & brass compass buckle
      ctx.strokeStyle = '#ff9f1c';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-10, -28);
      ctx.lineTo(10, -6);
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(0, -17, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (ch.id === 'brin') {
      // Wound cyan-and-gold bobbin lines around spool torso
      ctx.strokeStyle = '#72efdd';
      ctx.lineWidth = 2.6;
      for (const yy of [-24, -18, -12]) {
        ctx.beginPath();
        ctx.moveTo(-12, yy);
        ctx.lineTo(12, yy);
        ctx.stroke();
      }
    }
  }

  ctx.fillStyle = flash ? '#ffffff' : ch.colors.head;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(0, -44, 15.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (p.gear.prismShades) {
    ctx.fillStyle = '#ff006e';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.fillRect(-9, -49, 9, 6);
    ctx.strokeRect(-9, -49, 9, 6);
    ctx.fillStyle = '#4cc9f0';
    ctx.fillRect(2, -49, 9, 6);
    ctx.strokeRect(2, -49, 9, 6);
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(5.5, -45, 2.9, 0, Math.PI * 2);
    ctx.arc(-4, -45, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(1, -40, 4.2, 0.1 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }

  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  if (p.gear.partyHat) {
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath();
    ctx.moveTo(-11, -56);
    ctx.lineTo(11, -56);
    ctx.lineTo(0, -80);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (ch.hat === 'mailman') {
    ctx.fillStyle = ch.colors.hat;
    ctx.beginPath();
    ctx.arc(0, -54, 13, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-1, -56, 17, 5);
    ctx.strokeRect(-1, -56, 17, 5);
  } else if (ch.hat === 'saucer') {
    ctx.fillStyle = ch.colors.hat;
    ctx.beginPath();
    ctx.ellipse(0, -58, 17, 5, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (ch.hat === 'headphones') {
    ctx.strokeStyle = '#ff4d9e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, -45, 17.5, Math.PI * 1.05, -0.05);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(-16, -44, 5.5, 0, Math.PI * 2);
    ctx.arc(16, -44, 5.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (ch.hat === 'fedora') {
    ctx.fillStyle = '#1f242c';
    ctx.fillRect(-16, -59, 32, 5);
    ctx.fillRect(-10, -72, 20, 14);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-10, -63, 20, 3.5);
  } else if (ch.hat === 'pleat_cap') {
    // Crisp origami-creased bridge surveyor hat
    ctx.fillStyle = ch.colors.hat;
    ctx.beginPath();
    ctx.moveTo(-18, -54);
    ctx.lineTo(0, -74);
    ctx.lineTo(18, -54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -72);
    ctx.lineTo(0, -55);
    ctx.stroke();
  } else if (ch.hat === 'spool_hat') {
    // Turned-wood fishing-spool cap wrapped in cyan guide line
    ctx.fillStyle = '#d48c3b';
    ctx.fillRect(-14, -58, 28, 4.5);
    ctx.strokeRect(-14, -58, 28, 4.5);
    ctx.fillStyle = '#72efdd';
    ctx.fillRect(-9, -70, 18, 12);
    ctx.strokeRect(-9, -70, 18, 12);
    ctx.fillStyle = '#d48c3b';
    ctx.fillRect(-13, -74, 26, 4.5);
    ctx.strokeRect(-13, -74, 26, 4.5);
  } else if (ch.hat === 'wick_flame') {
    // Glowing candle-wick flame cap
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(-12, -59, 24, 5);
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.moveTo(-7, -59);
    ctx.quadraticCurveTo(0, -79, 7, -59);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(0, -64, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (ch.hat === 'painter_beret') {
    // Tilted wet-ink painter beret + nib stem
    ctx.fillStyle = '#4cc9f0';
    ctx.beginPath();
    ctx.ellipse(-2, -61, 16, 7.5, -0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#160c24';
    ctx.fillRect(-2, -71, 4, 6);
  } else if (ch.hat === 'bell_ears') {
    // Round acoustic bell-mouse ears
    ctx.fillStyle = '#ff70a6';
    ctx.beginPath();
    ctx.arc(-11, -61, 7, 0, Math.PI * 2);
    ctx.arc(11, -61, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(-11, -61, 3, 0, Math.PI * 2);
    ctx.arc(11, -61, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (ch.hat === 'steam_lid') {
    // Porcelain kettle lid + brass pressure whistle
    ctx.fillStyle = '#a8dadc';
    ctx.beginPath();
    ctx.ellipse(0, -58, 16, 6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-4, -71, 8, 9);
    ctx.strokeRect(-4, -71, 8, 9);
  } else if (ch.hat === 'prism_visor') {
    // Stained-glass refractive crown visor
    ctx.fillStyle = '#72efdd';
    ctx.beginPath();
    ctx.moveTo(-15, -56);
    ctx.lineTo(-6, -69);
    ctx.lineTo(6, -69);
    ctx.lineTo(15, -56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff5d8f';
    ctx.fillRect(-9, -63, 18, 4);
  } else if (ch.hat === 'reed_boater') {
    // Woven bladderwort sun-boater with yellow ribbon
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.ellipse(0, -57, 19, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-11, -68, 22, 10);
    ctx.strokeRect(-11, -68, 22, 10);
    ctx.fillStyle = '#52b788';
    ctx.fillRect(-11, -62, 22, 3.5);
  }

  ctx.restore();
}

export function drawWorldCompass(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  angle: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(px + Math.cos(angle) * 58, py - 18 + Math.sin(angle) * 58);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-7, -7);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawProjectile(ctx: CanvasRenderingContext2D, pr: Projectile, t: number): void {
  ctx.save();
  ctx.translate(pr.x, pr.y - 16);
  ctx.rotate(t * 10);
  if (pr.kind === 'parcel') {
    ctx.fillStyle = '#f4a261';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.roundRect(-11, -9, 22, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#4cc9f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(0, 9);
    ctx.moveTo(-11, 0);
    ctx.lineTo(11, 0);
    ctx.stroke();
  } else if (pr.kind === 'red_tape') {
    ctx.fillStyle = '#ff4d6d';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.fillRect(-10, -6, 20, 12);
    ctx.strokeRect(-10, -6, 20, 12);
  } else {
    ctx.fillStyle = '#ff006e';
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawInteractPrompt(ctx: CanvasRenderingContext2D, prompt: InteractPrompt, t: number): void {
  const y = prompt.y - 64 + Math.sin(t * 6) * 2.5;
  ctx.save();
  ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
  const metrics = ctx.measureText(prompt.label);
  const padX = 12;
  const w = metrics.width + padX * 2;
  const h = 24;

  ctx.fillStyle = 'rgba(22, 12, 36, 0.94)';
  ctx.strokeStyle = prompt.accent;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(prompt.x - w / 2, y - h / 2, w, h, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f7efde';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(prompt.label, prompt.x, y + 0.5);
  ctx.restore();
}
