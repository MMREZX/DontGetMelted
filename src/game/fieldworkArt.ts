import { WEATHER } from './fieldwork';
import type { TrailGate, WeatherId } from './fieldwork';

export function drawRibbonGate(ctx: CanvasRenderingContext2D, gate: TrailGate, ordinal: number): void {
  const color = gate.roll ? '#ffd166' : '#72efdd';
  ctx.save();
  ctx.translate(gate.x, gate.y);
  ctx.fillStyle = 'rgba(20,9,35,0.48)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 47, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#160c24';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-35, 7);
  ctx.quadraticCurveTo(-50, -66, 0, -66);
  ctx.quadraticCurveTo(50, -66, 35, 7);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#211238';
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-34, -74, 68, 20, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '700 10px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ordinal === 0 ? 'START' : gate.roll ? 'ROLL' : String(ordinal), 0, -64);
  ctx.restore();
}

export function drawWeatherVeil(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  weather: WeatherId,
  time: number,
  still: boolean,
): void {
  const color = WEATHER[weather].color;
  const veil = ctx.createLinearGradient(0, 0, 0, height);
  veil.addColorStop(0, color + '26');
  veil.addColorStop(0.64, color + '00');
  ctx.save();
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = weather === 'paper_squall' ? 1.5 : 2.5;
  const motion = still ? 0 : time;
  const drift = weather === 'paper_squall' ? 93 : 15;
  ctx.beginPath();
  for (let i = 0; i < 22; i += 1) {
    const x = (i * 157 + motion * drift) % width;
    const y = (i * 71 + motion * (weather === 'hush_dew' ? 8 : 28)) % height;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (weather === 'paper_squall' ? 17 : 3), y + 4);
  }
  ctx.stroke();
  ctx.restore();
}
