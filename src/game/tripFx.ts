import { CHARACTERS } from './data';
import { BAD_TRIP_WHISPERS, TRIP_VISUAL_META } from './rules';
import type {
  BadTripPhantom,
  PlayerState,
  SoundWaveRipple,
  TracerSnapshot,
  TripId,
  TripProfile,
} from './types';

const INK = '#160c24';

function drawClockGear(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  teeth: number,
  rot: number,
  strokeCol: string,
  fillCol: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a1 = (i / teeth) * Math.PI * 2;
    const a2 = ((i + 0.36) / teeth) * Math.PI * 2;
    const a3 = ((i + 0.5) / teeth) * Math.PI * 2;
    const a4 = ((i + 0.86) / teeth) * Math.PI * 2;
    const rOut = radius + 7;
    const rIn = radius - 3;
    if (i === 0) ctx.moveTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
    else ctx.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
    ctx.lineTo(Math.cos(a2) * rOut, Math.sin(a2) * rOut);
    ctx.lineTo(Math.cos(a3) * rOut, Math.sin(a3) * rOut);
    ctx.lineTo(Math.cos(a4) * rIn, Math.sin(a4) * rIn);
  }
  ctx.closePath();
  ctx.fillStyle = fillCol;
  ctx.strokeStyle = strokeCol;
  ctx.lineWidth = 1.8;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  for (let s = 0; s < 4; s++) {
    const sa = (s * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(sa) * radius * 0.42, Math.sin(sa) * radius * 0.42);
    ctx.lineTo(Math.cos(sa) * (radius - 4), Math.sin(sa) * (radius - 4));
    ctx.stroke();
  }
  ctx.restore();
}

// =========================================================================
// WORLD-SPACE PERCEPTUAL LAYERS (Drawn inside world camera transform)
// =========================================================================
export function drawTripWorldLayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  t: number,
  trips: Set<TripId>,
  profile: TripProfile,
  tracers: TracerSnapshot[],
  ripples: SoundWaveRipple[],
  phantoms: BadTripPhantom[],
  nearbyObjects: Array<{ x: number; y: number }>,
  reducedMotion: boolean,
  effectStrength = 1,
  flashFree = false,
): void {
  if (effectStrength <= 0.01) return;
  const m = reducedMotion || flashFree ? 0.16 : 1;
  const env = profile.stageFactor * Math.max(0, Math.min(1, effectStrength));
  const synId = profile.synergy?.id || null;

  // 1. COSMIC (Void-Cocoa): Flower-of-Life Lattice + Starlight Constellation Threads + Astral Double
  if (trips.has('cosmic')) {
    ctx.save();
    ctx.strokeStyle = 'rgba(179, 136, 255, 0.25)';
    ctx.lineWidth = 1.6;
    const cell = 135;
    const baseX = Math.floor(player.x / cell) * cell;
    const baseY = Math.floor(player.y / cell) * cell;
    const rot = reducedMotion ? 0 : t * 0.14;
    for (let gx = -3; gx <= 3; gx++) {
      for (let gy = -2; gy <= 2; gy++) {
        const cx = baseX + gx * cell + (gy % 2 === 0 ? 0 : cell * 0.5);
        const cy = baseY + gy * cell * 0.86;
        const dist = Math.hypot(cx - player.x, cy - player.y);
        if (dist > 440) continue;
        ctx.globalAlpha = Math.max(0.04, (1 - dist / 440) * 0.36 * env);
        ctx.beginPath();
        ctx.arc(cx, cy, 46 + Math.sin(t * 1.6 + gx + gy) * 4 * m, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const a = rot + (k * Math.PI * 2) / 3;
          const px = cx + Math.cos(a) * 32;
          const py = cy + Math.sin(a) * 32;
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Starlight Constellation Threads connecting nearby trees/flora
    if (nearbyObjects.length >= 2) {
      ctx.strokeStyle = 'rgba(224, 170, 255, 0.36)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([6, 6]);
      for (let i = 0; i < Math.min(nearbyObjects.length, 8); i++) {
        const a = nearbyObjects[i];
        const b = nearbyObjects[(i + 1) % Math.min(nearbyObjects.length, 8)];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 310) {
          ctx.globalAlpha = 0.32 * env;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y - 16);
          ctx.lineTo(b.x, b.y - 16);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    // Orbiting translucent Astral Double (+ mini-planet pair during Nebula Drift synergy)
    const count = synId === 'nebula_drift' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const orbitAng = t * (1.45 + i * 0.45) * m + (i * Math.PI * 2) / count;
      const rx = 52 + i * 24;
      const ry = 28 + i * 14;
      const ox = player.x + Math.cos(orbitAng) * rx;
      const oy = player.y + Math.sin(orbitAng) * ry - 18;
      ctx.globalAlpha = 0.46 * env;
      ctx.fillStyle = i === 0 ? '#c77dff' : i === 1 ? '#8be9fd' : '#ffd166';
      ctx.beginPath();
      ctx.arc(ox, oy, i === 0 ? 11 : 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#72efdd';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(ox, oy, i === 0 ? 18 : 13, i === 0 ? 8 : 5, 0.35, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 2. DISCO OVERDRIVE: Illuminated Cycling Dancefloor Tile Grid + Club Spotlights
  if (trips.has('disco')) {
    ctx.save();
    const tile = 64;
    const bx = Math.floor(player.x / tile) * tile;
    const by = Math.floor(player.y / tile) * tile;
    for (let gx = -3; gx <= 3; gx++) {
      for (let gy = -2; gy <= 2; gy++) {
        const tx = bx + gx * tile;
        const ty = by + gy * tile;
        const dist = Math.hypot(tx + tile * 0.5 - player.x, ty + tile * 0.5 - player.y);
        if (dist > 250) continue;
        const hue = (t * 95 * m + (gx + 5) * 42 + (gy + 5) * 65) % 360;
        ctx.globalAlpha = Math.max(0.04, (1 - dist / 250) * 0.22 * env);
        ctx.fillStyle = `hsl(${hue}, 92%, 62%)`;
        ctx.fillRect(tx + 3, ty + 3, tile - 6, tile - 6);
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(tx + 3, ty + 3, tile - 6, tile - 6);
      }
    }

    const beamCols = ['rgba(255, 59, 141, 0.18)', 'rgba(46, 196, 182, 0.18)', 'rgba(255, 209, 102, 0.18)'];
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const ang = t * (0.9 + i * 0.3) * m + (i * Math.PI * 2) / 3;
      const lx = player.x + Math.cos(ang) * 185;
      const ly = player.y + Math.sin(ang) * 115;
      const gr = ctx.createRadialGradient(lx, ly, 10, lx, ly, 128);
      gr.addColorStop(0, beamCols[i]);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(lx, ly, 128, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 3. SYNESTHESIA / HYPER-CHORD: Live Radial Sound-Spectrum Ring around Player + Wave Ripples
  if (trips.has('synesthesia') || synId === 'hyper_chord') {
    ctx.save();
    const bars = synId === 'hyper_chord' ? 24 : 16;
    const baseR = 44;
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * Math.PI * 2 + t * 0.6 * m;
      const wave = 8 + Math.abs(Math.sin(t * 7.5 * m + i * 0.9)) * (synId === 'hyper_chord' ? 24 : 15);
      const hue = (i * (360 / bars) + t * 80 * m) % 360;
      ctx.strokeStyle = `hsla(${hue}, 95%, 66%, ${0.58 * env})`;
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(a) * baseR, player.y - 14 + Math.sin(a) * baseR * 0.62);
      ctx.lineTo(
        player.x + Math.cos(a) * (baseR + wave),
        player.y - 14 + Math.sin(a) * (baseR + wave) * 0.62,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  if (ripples.length > 0) {
    ctx.save();
    ctx.font = '800 15px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    for (const r of ripples) {
      const ratio = Math.max(0, r.life / r.maxLife);
      ctx.globalAlpha = ratio * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.56, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = r.color;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      const gx = r.x + Math.cos(r.radius * 0.06) * 16;
      const gy = r.y - 26 - (1 - ratio) * 32;
      ctx.strokeText(r.glyph, gx, gy);
      ctx.fillText(r.glyph, gx, gy);
    }
    ctx.restore();
  }

  // 4. ASTRAL TIMEFOLD SYNERGY (Cosmic + Chrono): Interlocking Gold Zodiac-Clockwork Orbit
  if (synId === 'astral_timefold') {
    ctx.save();
    ctx.translate(player.x, player.y - 14);
    ctx.globalAlpha = 0.56 * env;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 84, 52, t * 0.3 * m, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#72efdd';
    ctx.beginPath();
    ctx.ellipse(0, 0, 84, 52, -t * 0.3 * m + Math.PI / 3, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.25 * m;
      ctx.fillStyle = i % 2 === 0 ? '#ffd166' : '#c77dff';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 84, Math.sin(a) * 52, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 5. GHOSTLY PLAYER TRACERS (Chrono / Floaty / Prism / Velvet / Disco)
  if (tracers.length > 0) {
    ctx.save();
    for (let i = 0; i < tracers.length; i++) {
      const tr = tracers[i];
      if (tr.alpha <= 0.02) continue;
      const ch = CHARACTERS[tr.charId];
      ctx.save();
      ctx.translate(tr.x, tr.y - tr.elevation * 38);
      ctx.globalAlpha = tr.alpha * 0.46;
      ctx.fillStyle = tr.color;
      ctx.beginPath();
      ctx.roundRect(-12, -26 - tr.bob, 24, 24, 9);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -34 - tr.bob, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ch.colors.accent;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // 6. PRISM ABSINTHE / STARGLASS FRACTAL: RGB Halo + Radiating Rainbow Rays + Orbiting Crystal Facets
  if (trips.has('prism_refract')) {
    ctx.save();
    const isStarglass = synId === 'starglass_fractal';
    const rays = isStarglass ? 12 : 6;
    const rayLen = isStarglass ? 155 : 92;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + t * 0.35 * m;
      const hue = (i * (360 / rays) + t * 50 * m) % 360;
      ctx.globalAlpha = (isStarglass ? 0.24 : 0.14) * env;
      ctx.fillStyle = `hsl(${hue}, 96%, 68%)`;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 20);
      ctx.lineTo(player.x + Math.cos(a - 0.07) * rayLen, player.y - 20 + Math.sin(a - 0.07) * rayLen * 0.68);
      ctx.lineTo(player.x + Math.cos(a + 0.07) * rayLen, player.y - 20 + Math.sin(a + 0.07) * rayLen * 0.68);
      ctx.closePath();
      ctx.fill();
    }

    const shift = reducedMotion ? 7 : 9 + Math.sin(t * 5) * 4;
    ctx.globalAlpha = 0.34 * env;
    ctx.fillStyle = '#ff2a85';
    ctx.beginPath();
    ctx.arc(player.x - shift, player.y - 22, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00f5d4';
    ctx.beginPath();
    ctx.arc(player.x + shift, player.y - 22, 22, 0, Math.PI * 2);
    ctx.fill();

    const facetCount = isStarglass ? 6 : 4;
    for (let i = 0; i < facetCount; i++) {
      const a = t * 1.15 * m + (i * Math.PI * 2) / facetCount;
      const fx = player.x + Math.cos(a) * (isStarglass ? 86 : 72);
      const fy = player.y - 16 + Math.sin(a) * (isStarglass ? 52 : 44);
      ctx.globalAlpha = 0.62 * env;
      ctx.fillStyle = i % 3 === 0 ? '#72efdd' : i % 3 === 1 ? '#ffd166' : '#ff85b3';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(fx, fy - 12);
      ctx.lineTo(fx + 8, fy);
      ctx.lineTo(fx, fy + 12);
      ctx.lineTo(fx - 8, fy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // 7. BAD TRIP: Peripheral Shadow Hallucination Phantoms (vanish when approached)
  if (profile.badTripIntensity > 0.25 && phantoms.length > 0) {
    ctx.save();
    for (const ph of phantoms) {
      const fade = Math.min(1, ph.life / 0.8) * Math.min(1, (ph.maxLife - ph.life) / 0.5 + 0.2);
      const jitterX = reducedMotion ? 0 : Math.sin(t * 14 + ph.seed) * 3.5;
      const jitterY = reducedMotion ? 0 : Math.cos(t * 11 + ph.seed) * 2.5;
      ctx.save();
      ctx.translate(ph.x + jitterX, ph.y + jitterY);
      ctx.globalAlpha = fade * (0.48 + profile.badTripIntensity * 0.4);

      ctx.fillStyle = '#12051f';
      ctx.strokeStyle = '#9ef01a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-18, 6);
      ctx.quadraticCurveTo(-24, -28, -12, -56);
      ctx.arc(0, -60, 14, Math.PI, 0);
      ctx.quadraticCurveTo(24, -28, 18, 6);
      ctx.quadraticCurveTo(6, -2, 0, 8);
      ctx.quadraticCurveTo(-6, -2, -18, 6);
      ctx.fill();
      ctx.stroke();

      const ang = Math.atan2(player.y - ph.y, player.x - ph.x);
      for (const ex of [-6, 6]) {
        ctx.fillStyle = '#d9ff3b';
        ctx.beginPath();
        ctx.ellipse(ex, -58, 4.5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(ex + Math.cos(ang) * 1.8, -58 + Math.sin(ang) * 1.8, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#d9ff3b';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3.5;
      ctx.strokeText(ph.whisper, 0, -82);
      ctx.fillText(ph.whisper, 0, -82);
      ctx.restore();
    }
    ctx.restore();
  }
}

// =========================================================================
// SCREEN-SPACE PERCEPTUAL POST-FX OVERLAY (Drawn over canvas, beneath HUD)
// =========================================================================
export function drawTripScreenOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  trips: Set<TripId>,
  profile: TripProfile,
  playerScreenX: number,
  playerScreenY: number,
  nearCalmingTotem: boolean,
  reducedMotion: boolean,
  effectStrength = 1,
  flashFree = false,
): void {
  const strength = Math.max(0, Math.min(1, effectStrength));
  if (strength <= 0.01) return;
  const m = reducedMotion || flashFree ? 0.12 : 1;
  const env = profile.stageFactor * strength;
  const synId = profile.synergy?.id || null;

  // --- A. KALEIDO-SHROOM: Double-Ring Symmetrical Corner Mandala Rosettes ---
  if (trips.has('kaleido')) {
    ctx.save();
    const corners: Array<[number, number]> = [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ];
    const petals = synId === 'starglass_fractal' ? 12 : 10;
    const baseR = Math.min(w, h) * (0.19 + 0.05 * env);
    for (let c = 0; c < corners.length; c++) {
      const [cx, cy] = corners[c];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((c % 2 === 0 ? 1 : -1) * t * 0.26 * m);
      for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2;
        const hue = (t * 42 * m + i * 36 + c * 40) % 360;
        ctx.strokeStyle = `hsla(${hue}, 92%, 68%, ${0.34 * env})`;
        ctx.fillStyle = `hsla(${(hue + 50) % 360}, 88%, 62%, ${0.09 * env})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(a) * baseR * 0.46,
          Math.sin(a) * baseR * 0.46,
          baseR * 0.42,
          baseR * 0.16,
          a,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.stroke();

        // Inner geometric star filigree petal
        ctx.strokeStyle = `hsla(${(hue + 140) % 360}, 95%, 74%, ${0.26 * env})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(a + 0.18) * baseR * 0.25,
          Math.sin(a + 0.18) * baseR * 0.25,
          baseR * 0.2,
          baseR * 0.08,
          a + 0.18,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // --- B. CLOUD-PUFF (Floaty): Pastel Foreground Cloud Wisps & Glossy Soap Bubbles ---
  if (trips.has('floaty')) {
    ctx.save();
    for (let c = 0; c < 4; c++) {
      const cx = (((t * (16 + c * 5) * m + c * 380) % (w + 260)) + (w + 260)) % (w + 260) - 130;
      const cy = c < 2 ? 42 + c * 28 : h - 46 - (c - 2) * 26;
      ctx.fillStyle = `rgba(218, 246, 255, ${0.12 * env})`;
      ctx.beginPath();
      ctx.arc(cx, cy, 42, 0, Math.PI * 2);
      ctx.arc(cx + 34, cy - 8, 34, 0, Math.PI * 2);
      ctx.arc(cx - 32, cy - 4, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 14; i++) {
      const seed = i * 97.3;
      const bx = ((seed * 19 + Math.sin(t * 0.9 + i) * 35 * m) % w + w) % w;
      const by = h - (((t * (38 + (i % 4) * 14) * m + seed * 13) % (h + 90) + (h + 90)) % (h + 90)) + 40;
      const br = 9 + (i % 4) * 6;
      ctx.strokeStyle = i % 2 === 0 ? `rgba(139, 233, 253, ${0.58 * env})` : `rgba(255, 133, 179, ${0.5 * env})`;
      ctx.fillStyle = `rgba(139, 233, 253, ${0.09 * env})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.65 * env})`;
      ctx.beginPath();
      ctx.arc(bx - br * 0.32, by - br * 0.32, br * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- C. SYNESTHESIA (Hyper-Fizz): Live Spectrum Equalizer Ribbons ---
  if (trips.has('synesthesia')) {
    ctx.save();
    const bars = 28;
    const step = w / bars;
    for (let i = 0; i < bars; i++) {
      const hBar = (8 + Math.abs(Math.sin(t * 6.5 * m + i * 0.65)) * 22) * env;
      const hue = (i * 14 + t * 70 * m) % 360;
      ctx.fillStyle = `hsla(${hue}, 92%, 66%, 0.32)`;
      ctx.fillRect(i * step + 4, 0, step - 8, hBar);
      ctx.fillRect(i * step + 4, h - hBar, step - 8, hBar);
    }
    for (const edgeY of [20, h - 20]) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 24) {
        const amp = reducedMotion ? 4 : 9 + Math.sin(t * 6 + x * 0.02) * 7;
        const y = edgeY + Math.sin(x * 0.025 + t * 5 * m) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = edgeY < 50 ? 'rgba(255, 209, 102, 0.5)' : 'rgba(46, 196, 182, 0.5)';
      ctx.lineWidth = 2.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- D. CHRONO-PICKLE: Sepia-Teal Wash, Meshing Clockwork Corner Gears & Watch Dial ---
  if (trips.has('chrono')) {
    ctx.save();
    const gr = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.66);
    gr.addColorStop(0, 'rgba(46, 196, 182, 0)');
    gr.addColorStop(1, `rgba(22, 118, 128, ${0.34 * env})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);

    // Meshing translucent brass-teal clockwork gears in outer corners
    drawClockGear(ctx, 56, h - 135, 36, 10, t * 0.45 * m, `rgba(255,209,102,${0.42 * env})`, `rgba(46,196,182,${0.12 * env})`);
    drawClockGear(ctx, 112, h - 165, 24, 8, -t * 0.68 * m, `rgba(114,239,221,${0.4 * env})`, `rgba(255,209,102,${0.1 * env})`);
    drawClockGear(ctx, w - 58, 150, 34, 10, -t * 0.4 * m, `rgba(255,209,102,${0.4 * env})`, `rgba(46,196,182,${0.12 * env})`);

    const cx = w / 2;
    const cy = h / 2;
    const rx = w * 0.46;
    const ry = h * 0.44;
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.28 * env})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + t * 0.08 * m;
      const len = i % 2 === 0 ? 12 : 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      ctx.lineTo(cx + Math.cos(a) * (rx - len), cy + Math.sin(a) * (ry - len));
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- E. PRISM ABSINTHE / STARGLASS: RGB Chromatic Bands & Floating Glass Facets ---
  if (trips.has('prism_refract')) {
    ctx.save();
    const band = Math.max(8, profile.chromaSplit * 1.6);
    ctx.fillStyle = `rgba(255, 42, 133, ${0.24 * env})`;
    ctx.fillRect(0, 0, band, h);
    ctx.fillStyle = `rgba(0, 245, 212, ${0.24 * env})`;
    ctx.fillRect(w - band, 0, band, h);
    ctx.fillStyle = `rgba(255, 209, 102, ${0.18 * env})`;
    ctx.fillRect(0, 0, w, band * 0.72);

    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? 0 : 1;
      const px = side === 0 ? 34 + (i % 2) * 32 : w - 34 - (i % 2) * 32;
      const py = ((i % 4) + 0.5) * (h / 4) + Math.sin(t * 1.4 + i) * 14 * m;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(t * 0.4 * m + i);
      ctx.fillStyle =
        i % 3 === 0
          ? `rgba(114,239,221,${0.25 * env})`
          : i % 3 === 1
            ? `rgba(255,93,143,${0.22 * env})`
            : `rgba(255,209,102,${0.22 * env})`;
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * env})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(20, 14);
      ctx.lineTo(-20, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // --- F. VELVET SPORES & FEVER TAPESTRY: Melting Candle-Wax Curtain + Baroque Filigree ---
  if (trips.has('velvet_fog')) {
    ctx.save();
    ctx.fillStyle = `rgba(42, 14, 68, ${0.52 * env})`;
    ctx.strokeStyle = `rgba(255, 159, 28, ${0.46 * env})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const cols = 16;
    const step = w / cols;
    for (let i = 0; i <= cols; i++) {
      const x = i * step;
      const drip = (26 + ((i * 37) % 44) + Math.sin(t * 1.1 * m + i * 0.9) * 14 * m) * env;
      if (i === 0) ctx.lineTo(0, drip);
      else {
        const prevX = (i - 1) * step;
        ctx.quadraticCurveTo((prevX + x) * 0.5, drip + 22, x, drip * 0.68);
      }
    }
    ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (synId === 'fever_tapestry') {
      ctx.strokeStyle = `rgba(255, 93, 143, ${0.34 * env})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = ((i + 0.5) / 6) * h;
        ctx.beginPath();
        ctx.arc(16, y, 22 + Math.sin(t * 2 + i) * 5 * m, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(w - 16, y, 22 + Math.cos(t * 2 + i) * 5 * m, Math.PI * 0.5, Math.PI * 1.5);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // --- G. EUPHORIC GOOD TRIP HALO (High Vibe + High Wobble) ---
  if (profile.euphoriaIntensity > 0.12 && profile.badTripIntensity <= 0.05) {
    ctx.save();
    const pulse = 1 + Math.sin(t * 2.4 * m) * 0.06;
    const g = ctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.34,
      w / 2,
      h / 2,
      Math.max(w, h) * 0.72 * pulse,
    );
    const hue = (t * 24 * m + 330) % 360;
    g.addColorStop(0, 'rgba(255, 209, 102, 0)');
    g.addColorStop(0.76, `hsla(${hue}, 88%, 62%, ${0.09 * profile.euphoriaIntensity})`);
    g.addColorStop(1, `hsla(${(hue + 55) % 360}, 92%, 58%, ${0.26 * profile.euphoriaIntensity})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.22 * m;
      const sx = w / 2 + Math.cos(a) * w * 0.42;
      const sy = h / 2 + Math.sin(a) * h * 0.4;
      const sz = (3.5 + Math.sin(t * 3.2 + i) * 1.8) * profile.euphoriaIntensity;
      ctx.fillStyle = i % 2 === 0 ? '#ffd166' : '#ff85b3';
      ctx.globalAlpha = 0.65 * profile.euphoriaIntensity;
      ctx.beginPath();
      ctx.moveTo(sx, sy - sz * 2);
      ctx.lineTo(sx + sz * 0.7, sy - sz * 0.7);
      ctx.lineTo(sx + sz * 2, sy);
      ctx.lineTo(sx + sz * 0.7, sy + sz * 0.7);
      ctx.lineTo(sx, sy + sz * 2);
      ctx.lineTo(sx - sz * 0.7, sy + sz * 0.7);
      ctx.lineTo(sx - sz * 2, sy);
      ctx.lineTo(sx - sz * 0.7, sy - sz * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // --- H. BAD TRIP 3-TIER ESCALATION ("UNEASY -> PARANOIA -> FULL MELT SPIRAL") ---
  if (profile.badTripIntensity > 0.05) {
    const b = profile.badTripIntensity * strength;
    ctx.save();

    // 1. Heartbeat-pulsing bruised-violet & sickly acid-chartreuse claustrophobic vignette
    const hbPhase = (t * 1.48) % 1;
    const heartbeat =
      reducedMotion || flashFree
        ? 0
        : hbPhase < 0.14
          ? Math.sin((hbPhase / 0.14) * Math.PI)
          : hbPhase > 0.22 && hbPhase < 0.34
            ? Math.sin(((hbPhase - 0.22) / 0.12) * Math.PI) * 0.65
            : 0;

    const innerR = Math.min(w, h) * (0.34 - b * 0.13 - heartbeat * 0.03);
    const outerR = Math.max(w, h) * 0.68;
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.max(60, innerR), w / 2, h / 2, outerR);
    vg.addColorStop(0, 'rgba(20, 4, 34, 0)');
    vg.addColorStop(0.62, `rgba(68, 12, 82, ${0.22 + b * 0.26})`);
    vg.addColorStop(0.86, `rgba(116, 148, 18, ${0.14 + b * 0.2})`);
    vg.addColorStop(1, `rgba(12, 3, 22, ${0.52 + b * 0.4 + heartbeat * 0.08})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    // 2. Heavy RGB Chromatic Aberration framing edge splits
    const splitW = 6 + b * 14 + heartbeat * 5;
    ctx.fillStyle = `rgba(255, 28, 102, ${0.18 + b * 0.25})`;
    ctx.fillRect(0, 0, splitW, h);
    ctx.fillStyle = `rgba(158, 240, 26, ${0.16 + b * 0.25})`;
    ctx.fillRect(w - splitW, 0, splitW, h);

    // 3. Don't-Starve-inspired creeping dark-ink corner tendrils (recoil when near Dreamcatcher!)
    const tendrilReach = (nearCalmingTotem ? 0.35 : 1) * (45 + b * 85 + heartbeat * 16);
    ctx.strokeStyle = `rgba(16, 4, 28, ${0.55 + b * 0.35})`;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const cornerDirs: Array<[number, number, number, number]> = [
      [0, 0, 1, 1],
      [w, 0, -1, 1],
      [0, h, 1, -1],
      [w, h, -1, -1],
    ];
    for (let c = 0; c < cornerDirs.length; c++) {
      const [ox, oy, dx, dy] = cornerDirs[c];
      for (let k = 0; k < 3; k++) {
        const spread = 0.25 + k * 0.28;
        const len = tendrilReach * (0.75 + k * 0.16);
        const sway = reducedMotion ? 0 : Math.sin(t * 2.6 + c * 2 + k) * 14;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(
          ox + dx * len * 0.55 + sway,
          oy + dy * len * spread * 0.5,
          ox + dx * len * Math.cos(spread),
          oy + dy * len * Math.sin(spread) + sway * 0.6,
        );
        ctx.stroke();
      }
    }

    // 4. Melting vertical dark-ink & acid-rose drips oozing from top edge
    if (b >= 0.35) {
      const dripCount = 18;
      const step = w / dripCount;
      ctx.fillStyle = `rgba(18, 5, 32, ${0.55 + b * 0.32})`;
      ctx.strokeStyle = `rgba(255, 59, 141, ${0.42 + b * 0.35})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 0; i <= dripCount; i++) {
        const x = i * step;
        const dripLen = (24 + ((i * 53) % 72) + Math.sin(t * 1.9 * m + i * 1.4) * 22 * m) * b;
        ctx.lineTo(x, dripLen);
        if (i < dripCount) {
          ctx.quadraticCurveTo(x + step * 0.5, dripLen * 0.35, x + step, (18 + (((i + 1) * 53) % 60)) * b);
        }
      }
      ctx.lineTo(w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 5. Tier 3 FULL MELT SPIRAL: Jagged Neon Anxiety Cracks + Reaching Shadow Hands along sides
    if (b >= 0.68 && !nearCalmingTotem) {
      ctx.strokeStyle = `rgba(255, 59, 141, ${0.35 + heartbeat * 0.35})`;
      ctx.lineWidth = 2;
      for (let side = 0; side < 2; side++) {
        const sx = side === 0 ? 4 : w - 4;
        const dir = side === 0 ? 1 : -1;
        for (let k = 0; k < 3; k++) {
          const sy = h * (0.28 + k * 0.22);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + dir * 24, sy - 10);
          ctx.lineTo(sx + dir * 44, sy + 6);
          ctx.lineTo(sx + dir * 68, sy - 8);
          ctx.stroke();
        }
      }

      // Stylized cartoon shadow hands curling inward at mid-left & mid-right outer frame
      for (let side = 0; side < 2; side++) {
        const hx = side === 0 ? 18 + Math.sin(t * 2.2) * 8 * m : w - 18 - Math.sin(t * 2.2) * 8 * m;
        const hy = h * 0.64;
        const dir = side === 0 ? 1 : -1;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.fillStyle = 'rgba(18, 5, 32, 0.78)';
        ctx.strokeStyle = 'rgba(158, 240, 26, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        for (let f = -1; f <= 1; f++) {
          ctx.beginPath();
          ctx.moveTo(dir * 12, f * 7);
          ctx.quadraticCurveTo(dir * 32, f * 12 - 4, dir * 42, f * 11 + Math.sin(t * 4 + f) * 4 * m);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 6. Blinking Paranoid Watching Eyes around screen edges tracking the player
    if (b >= 0.38) {
      const eyeAnchors: Array<[number, number, number]> = [
        [0.09, 0.26, 0.4],
        [0.07, 0.52, 1.9],
        [0.11, 0.76, 3.2],
        [0.91, 0.28, 0.9],
        [0.93, 0.54, 2.5],
        [0.89, 0.77, 4.1],
        [0.32, 0.1, 1.3],
        [0.68, 0.1, 2.9],
        [0.34, 0.89, 3.8],
        [0.66, 0.89, 5.0],
      ];
      const visibleEyes = Math.min(eyeAnchors.length, Math.floor(4 + b * 6));
      for (let i = 0; i < visibleEyes; i++) {
        const [nx, ny, phase] = eyeAnchors[i];
        const ex = nx * w;
        const ey = ny * h;
        const blinkCycle = (t * 0.42 + phase) % 1;
        const openAmt = reducedMotion
          ? 0.95
          : blinkCycle > 0.91
            ? Math.max(0.08, 1 - (blinkCycle - 0.91) * 11)
            : 1;
        const ew = 20 + b * 10;
        const eh = (11 + b * 6) * openAmt;
        const lookAng = Math.atan2(playerScreenY - ey, playerScreenX - ex);

        ctx.save();
        ctx.translate(ex, ey);
        ctx.globalAlpha = Math.min(0.94, (b - 0.32) * 1.45);
        ctx.fillStyle = '#f5f0c8';
        ctx.strokeStyle = '#ff3b8d';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Expressive cartoon upper lashes
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        for (let l = -1; l <= 1; l++) {
          ctx.beginPath();
          ctx.moveTo(l * ew * 0.36, -eh * 0.88);
          ctx.lineTo(l * ew * 0.46, -eh - 6);
          ctx.stroke();
        }

        if (openAmt > 0.25) {
          const px = Math.cos(lookAng) * ew * 0.28;
          const py = Math.sin(lookAng) * eh * 0.28;
          ctx.fillStyle = '#aacc00';
          ctx.beginPath();
          ctx.arc(px, py, Math.min(ew * 0.38, eh * 0.72), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(px, py, Math.min(ew * 0.22, eh * 0.45), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px - 2.5, py - 2.5, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 7. Peripheral anxious cartoon whisper
      const whisperIdx = Math.floor(t * 0.28) % BAD_TRIP_WHISPERS.length;
      const whisper = BAD_TRIP_WHISPERS[whisperIdx];
      ctx.save();
      ctx.font = '800 12px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(0.88, (b - 0.35) * 1.4);
      const wx = w * 0.5 + (reducedMotion ? 0 : Math.sin(t * 9) * 3);
      const wy = h - 78 + (reducedMotion ? 0 : Math.cos(t * 8) * 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.strokeText(whisper, wx, wy);
      ctx.fillStyle = '#d9ff3b';
      ctx.fillText(whisper, wx, wy);
      ctx.restore();
    }

    ctx.restore();
  }
}

export function getTripDominantColor(tripId: TripId | null): string {
  if (!tripId) return '#ffd166';
  return TRIP_VISUAL_META[tripId].accent;
}
