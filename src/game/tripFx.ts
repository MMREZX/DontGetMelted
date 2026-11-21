import type { TripId, TripSynergyDef } from './types.ts';

// Brew motifs use soft ink, anchored geometry and slow, optional motion.
const INK: Record<TripId, string> = {
  kaleido: '#703d61',
  floaty: '#335c75',
  synesthesia: '#6b4c32',
  chrono: '#355963',
  cosmic: '#45366d',
  disco: '#743c62',
  prism_refract: '#315e69',
  velvet_fog: '#59334f',
};

const PIGMENT: Record<TripId, string> = {
  kaleido: '#f0a5d6',
  floaty: '#a7def6',
  synesthesia: '#f8d889',
  chrono: '#e4c799',
  cosmic: '#b9a3ed',
  disco: '#f3a9cd',
  prism_refract: '#9bece0',
  velvet_fog: '#dca3ed',
};

export function tripPaintStrength(intensity: number, focus: number, stage: number): number {
  return Math.min(1, intensity, focus * 3) * (0.6 + 0.4 * stage);
}

export function selectTripMotif(
  active: ReadonlySet<TripId>,
  dominant: TripId | null,
  synergy: TripSynergyDef['id'] | null,
): TripId | null {
  if (synergy === 'hyper_chord') return 'disco';
  if (synergy === 'astral_timefold') return 'chrono';
  if (synergy === 'starglass_fractal') return 'prism_refract';
  if (synergy === 'fever_tapestry') return 'velvet_fog';
  if (synergy === 'nebula_drift') return 'floaty';
  return dominant && active.has(dominant) ? dominant : null;
}

interface MotifScene {
  brew: TripId;
  synergy: TripSynergyDef['id'] | null;
  x: number;
  y: number;
  strength: number;
  phase: number;
  still: boolean;
  anchors: ReadonlyArray<{ x: number; y: number }>;
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry = rx): void {
  ctx.moveTo(x + rx, y);
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function rosette(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number, accent: boolean): void {
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5 + phase;
    const ox = x + Math.cos(angle) * 21;
    const oy = y + Math.sin(angle) * 13;
    ring(ctx, ox, oy, 13, 9);
    if (accent) ring(ctx, ox, oy, 19, 13);
  }
  ring(ctx, x, y, 8, 5);
}

function gear(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number, radius: number): void {
  ring(ctx, x, y, radius * 0.8, radius * 0.54);
  ring(ctx, x, y, radius * 0.38, radius * 0.27);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6 + phase;
    ctx.moveTo(x + Math.cos(angle) * radius * 0.8, y + Math.sin(angle) * radius * 0.54);
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.7);
  }
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(phase) * radius * 0.72, y + Math.sin(phase) * radius * 0.48);
}

export function drawTripMotif(ctx: CanvasRenderingContext2D, scene: MotifScene): void {
  const { brew, synergy, x, y, anchors, still } = scene;
  if (scene.strength < 0.005) return;
  const phase = still ? 0 : scene.phase * 0.52;
  ctx.save();
  const radius = brew === 'velvet_fog' ? 235 : 190;
  const stain = ctx.createRadialGradient(x, y, 20, x, y, radius);
  stain.addColorStop(0, `${PIGMENT[brew]}00`);
  stain.addColorStop(0.42, PIGMENT[brew]);
  stain.addColorStop(1, `${PIGMENT[brew]}00`);
  ctx.globalAlpha = scene.strength * 0.19;
  ctx.fillStyle = stain;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.strokeStyle = INK[brew];
  ctx.fillStyle = PIGMENT[brew];
  ctx.globalAlpha = scene.strength * 0.72;
  ctx.lineJoin = 'round';
  ctx.beginPath();

  switch (brew) {
    case 'kaleido':
      rosette(ctx, x - 84, y + 28, phase, true);
      rosette(ctx, x + 84, y + 25, -phase, true);
      for (const prop of anchors.slice(0, 4)) rosette(ctx, prop.x, prop.y, phase, Boolean(synergy));
      break;
    case 'floaty':
      for (let i = 0; i < 7; i++) {
        const angle = i * 2.4;
        const px = x + Math.cos(angle) * (62 + i * 13);
        const py = y - 10 + Math.sin(angle) * 58 + Math.sin(phase + i) * 6;
        ring(ctx, px, py, 9 + i * 1.6, 9 + i * 1.6);
        if (synergy === 'nebula_drift') ring(ctx, px, py, 10 + i * 1.3, 4 + i);
      }
      break;
    case 'synesthesia':
      for (let i = 0; i < 24; i++) {
        const angle = i * Math.PI / 12;
        const length = 56 + (4 + Math.sin(phase + i * 1.2) * 4);
        ctx.moveTo(x + Math.cos(angle) * 48, y + Math.sin(angle) * 25);
        ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length * 0.52);
      }
      break;
    case 'chrono':
      gear(ctx, x - 68, y + 12, phase, 43);
      gear(ctx, x + 72, y + 35, -phase, synergy === 'astral_timefold' ? 33 : 24);
      break;
    case 'cosmic':
      for (let i = 0; i < anchors.length; i++) {
        const prop = anchors[i];
        ring(ctx, prop.x, prop.y, 17, 10);
        ring(ctx, prop.x + 10, prop.y, 17, 10);
        if (i > 0) {
          ctx.moveTo(anchors[i - 1].x, anchors[i - 1].y);
          ctx.lineTo(prop.x, prop.y);
        }
      }
      ring(ctx, x + 28, y - 14 - Math.sin(phase) * 5, 10, 16);
      break;
    case 'disco': {
      const gx = Math.floor(x / 29) * 29;
      const gy = Math.floor(y / 22) * 22;
      for (let row = -2; row <= 2; row++) {
        for (let col = -2; col <= 2; col++) {
          ctx.rect(gx + col * 29, gy + row * 22, 26, 19);
        }
      }
      ctx.globalAlpha = scene.strength * 0.25;
      ctx.fill();
      ctx.globalAlpha = scene.strength * 0.72;
      if (synergy === 'hyper_chord') gear(ctx, x, y, phase, 64);
      break;
    }
    case 'prism_refract':
      for (let i = 0; i < 9; i++) {
        const angle = i * Math.PI * 2 / 9 + phase * 0.2;
        const px = x + Math.cos(angle) * 82;
        const py = y + Math.sin(angle) * 54;
        ctx.moveTo(px, py - 11);
        ctx.lineTo(px + 9, py);
        ctx.lineTo(px - 3, py + 10);
        ctx.closePath();
        if (synergy === 'starglass_fractal') {
          ctx.moveTo(px, py);
          ctx.lineTo(x + Math.cos(angle) * 103, y + Math.sin(angle) * 64);
        }
      }
      break;
    case 'velvet_fog':
      ring(ctx, x, y + 20, 94, 49);
      for (const prop of anchors) {
        ctx.moveTo(prop.x - 20, prop.y - 18);
        ctx.quadraticCurveTo(prop.x - 8, prop.y - 8, prop.x - 15, prop.y + 9 + Math.sin(phase) * 3);
        ctx.quadraticCurveTo(prop.x + 4, prop.y + 12, prop.x + 8, prop.y - 8);
        ctx.quadraticCurveTo(prop.x + 11, prop.y - 22, prop.x + 22, prop.y - 12);
        if (synergy === 'fever_tapestry') ring(ctx, prop.x, prop.y, 22, 12);
      }
      break;
  }
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = PIGMENT[brew];
  ctx.globalAlpha = scene.strength * 0.84;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}
