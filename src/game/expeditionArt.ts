import {
  hasSite, HOLLOW, HOLLOW_COMPANION_HOME, HOLLOW_PACK, HOLLOW_QUARTZ, HOLLOW_RIBBONS, HOLLOW_SHELTER,
  MILLPOND, MILLPOND_BANKS, MILLPOND_RIBBONS, MINT_BEDS, within,
} from './expeditions';
import type { ExpeditionProgress } from './expeditions';
import { drawFieldSprite, imageReady } from './fieldAssets';
import type { FieldAssets, FieldSprite } from './fieldAssets';

const INK = '#24172e';

function outline(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke = INK): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.8;
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, name: string, x: number, y: number): void {
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const width = ctx.measureText(name).width + 16;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 11, width, 22, 6);
  ctx.fill();
  ctx.fillStyle = '#fff1cf';
  ctx.fillText(name, x, y);
}

function drawWash(ctx: CanvasRenderingContext2D, assets: FieldAssets, index: number, x: number, y: number, w: number, h: number): void {
  if (!imageReady(assets.washes)) return;
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.drawImage(assets.washes, (index % 2) * 256, Math.floor(index / 2) * 256, 256, 256, x - w / 2, y - h / 2, w, h);
  ctx.restore();
}

function drawProp(ctx: CanvasRenderingContext2D, assets: FieldAssets, sprite: FieldSprite, x: number, y: number, size: number, color: string): void {
  if (!drawFieldSprite(ctx, assets, sprite, x, y, size)) outline(ctx, x, y - 11, 12, 9, color);
}

export function drawExpeditionScenery(
  ctx: CanvasRenderingContext2D, assets: FieldAssets, progress: ExpeditionProgress,
  x: number, y: number, viewRadius: number, phase: number, calm: number, drift: number, day: number,
): void {
  ctx.save();
  if (within(x, y, MILLPOND, viewRadius + 340)) {
    const { millpond } = progress;
    const restored = millpond.status === 'restored';
    drawWash(ctx, assets, Number(restored), MILLPOND.x, MILLPOND.y, 580, 400);
    outline(ctx, MILLPOND.x, MILLPOND.y, 164, 66, restored ? '#4d968f' : '#467276');
    outline(ctx, MILLPOND.x - 10, MILLPOND.y - 5, 148, 53, 'rgba(116,210,185,0.32)', '#6e9b91');
    outline(ctx, MILLPOND_BANKS[1].x - 27, MILLPOND_BANKS[1].y - 25, 59, 26, 'rgba(25,47,60,0.37)', '#44655a');
    for (let i = 0; i < 22; i++) {
      const px = MILLPOND.x - 156 + i * 14;
      const py = MILLPOND.y + 47 + Math.sin(i * 2.1) * 10;
      const sway = Math.sin(phase + i * 0.71) * calm * 3;
      ctx.strokeStyle = i % 3 === 0 ? '#d9c887' : '#375945';
      ctx.lineWidth = i % 3 === 0 ? 3.4 : 2.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px - 2, py - 13, px + sway + 7, py - 31 + (i % 4) * 4);
      ctx.stroke();
    }
    if (restored) drawProp(ctx, assets, 'perch', MILLPOND.x + 43, MILLPOND.y + 7, 29, '#83cbc1');
    drawProp(ctx, assets, 'meadowMoth', MILLPOND_BANKS[1].x - 35, MILLPOND_BANKS[1].y - 10, 30, '#fff0b0');
    if (millpond.status !== 'unstarted') {
      const picked = restored ? (millpond.mintDay === day ? millpond.dailyMint : 0) : millpond.mint;
      MINT_BEDS.forEach((point, index) => {
        if (!hasSite(picked, index)) drawProp(ctx, assets, 'mint', point.x, point.y, 48, '#a7dbab');
      });
    }
    drawProp(ctx, assets, 'lantern', MILLPOND_BANKS[1].x - 70, MILLPOND_BANKS[1].y + 4, 74, '#ffd166');
  }

  if (within(x, y, HOLLOW, viewRadius + 880)) {
    const { hollow } = progress;
    const restored = hollow.status === 'restored';
    drawWash(ctx, assets, restored ? 3 : 2, HOLLOW.x + drift * 18, HOLLOW.y, 1280, 760);
    outline(ctx, HOLLOW_SHELTER.x, HOLLOW_SHELTER.y, 122, 48, 'rgba(211,156,114,0.52)', '#6b4a52');
    for (let i = 0; i < 8; i++) {
      const ridgeX = HOLLOW.x - 400 + i * 103 + drift * 12;
      outline(ctx, ridgeX, HOLLOW.y - 345 + Math.sin(i * 2) * 54, 114, 30, 'rgba(124,63,81,0.35)', 'rgba(36,23,46,0.46)');
    }
    outline(ctx, HOLLOW.x, HOLLOW.y + 16, 72, 28, restored ? '#5ba598' : '#866471');
    ctx.strokeStyle = restored ? '#e2c17e' : '#ad8073';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(HOLLOW.x, HOLLOW.y - 30, 31, 0, Math.PI * 2);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + (restored ? phase * 0.3 : 0);
      ctx.moveTo(HOLLOW.x, HOLLOW.y - 30);
      ctx.lineTo(HOLLOW.x + Math.cos(angle) * 31, HOLLOW.y - 30 + Math.sin(angle) * 31);
    }
    ctx.stroke();
    drawProp(ctx, assets, 'lantern', HOLLOW_SHELTER.x - 44, HOLLOW_SHELTER.y, 75, '#f4d083');
    drawProp(ctx, assets, 'hollowBeetle', HOLLOW.x - 190, HOLLOW.y - 58, 33, '#a65a78');
    if (hollow.status === 'active') {
      HOLLOW_QUARTZ.forEach((point, index) => {
        if (!hasSite(hollow.quartz, index)) drawProp(ctx, assets, 'quartz', point.x, point.y, 63, '#f4b8aa');
      });
      const companion = hollow.escorted ? HOLLOW_COMPANION_HOME : hollow.packed
        ? { x: hollow.escortX, y: hollow.escortY }
        : HOLLOW_PACK;
      drawProp(ctx, assets, 'guideMoth', companion.x, companion.y, 56, '#fff1bb');
    }
  }
  ctx.restore();
}

export function drawExpeditionNavigation(
  ctx: CanvasRenderingContext2D, assets: FieldAssets, progress: ExpeditionProgress,
  x: number, y: number, viewRadius: number, currentBank: string | undefined,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (const [status, mask, points] of [
    [progress.millpond.status, progress.millpond.ribbons, MILLPOND_RIBBONS],
    [progress.hollow.status, progress.hollow.ribbons, HOLLOW_RIBBONS],
  ] as const) {
    if (status === 'unstarted' || !points.some((point) => within(x, y, point, viewRadius + 140))) continue;
    const linked = points.filter((_, index) => hasSite(mask, index));
    if (linked.length > 1) {
      ctx.beginPath();
      linked.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
      ctx.setLineDash([13, 11]);
      ctx.lineWidth = 7;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff1cf';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    points.forEach((point, index) => {
      if (!within(x, y, point, viewRadius)) return;
      if (hasSite(mask, index)) drawProp(ctx, assets, 'ribbon', point.x, point.y, 55, '#fff1cf');
      else if (status === 'active') outline(ctx, point.x, point.y, 12, 6, '#fff1cf');
    });
  }
  if (within(x, y, MILLPOND, viewRadius)) {
    for (const bank of MILLPOND_BANKS) {
      outline(ctx, bank.waterX, bank.waterY, 22, 11, 'transparent', '#24172e');
      ctx.strokeStyle = '#eff3c9';
      ctx.lineWidth = 1.7;
      ctx.stroke();
      if (currentBank === bank.label) label(ctx, bank.shaded ? 'Shaded Willow Bank' : 'Sunlit Reed Bank', bank.x, bank.y + 22);
    }
  }
  ctx.restore();
}
