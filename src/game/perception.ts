import type { AudioCueEvent, CueCategory } from './audio.ts';
import type { AudioSettings } from './types.ts';
import { PERCEPTION } from './perceptionTuning.ts';

interface EffectState {
  calm: boolean;
  focused: boolean;
  strain: number;
  danger: boolean;
  drifting?: boolean;
}

const INK = '#26192e';
const STAMP: Record<CueCategory, string> = { fish: '⚓', tool: '⚒', wind: '≋', bell: '♪', warning: '!' };
const STAMP_CELL: Record<CueCategory, number> = { fish: 0, tool: 1, wind: 2, bell: 3, warning: 4 };
const DIRECTIONS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}

export class PerceptionDirector {
  readonly weights = { calm: 0, focus: 0, echo: 0, warning: 0 };
  private readonly level = { ...this.weights };
  private intensity = 0;
  private still = false;
  private flashFree = false;
  private phase = 0;
  private driftWeight = 0;
  private ambientPhase = 0;
  private readonly echoTracks = Array.from({ length: 8 }, () => ({ id: '', index: 0, timer: 0, age: 0 }));
  private readonly echoes = Array.from({ length: 32 }, () => ({ x: 0, y: 0, facing: 1, life: 0, creature: false }));

  private applyBudget(): void {
    const { calm, focus, echo, warning } = this.level;
    const scale = this.intensity / Math.max(1, calm + focus + echo + warning);
    this.weights.calm = calm * scale;
    this.weights.focus = focus * scale;
    this.weights.echo = this.still ? 0 : echo * scale;
    this.weights.warning = warning * scale;
  }

  setComfort(reducedMotion: boolean, flashFree: boolean, intensity: number): void {
    if (this.still !== reducedMotion || this.flashFree !== flashFree || intensity === 0) {
      this.clearEchoes();
    }
    this.still = reducedMotion;
    this.flashFree = flashFree;
    this.intensity = intensity;
    this.applyBudget();
  }

  step(dt: number, state: EffectState): void {
    const level = this.level;
    level.calm = approach(level.calm, state.calm && !state.danger && level.warning === 0 ? 0.7 : 0,
      dt / (state.danger ? 1.2 : state.calm ? 2.5 : 3));
    const edgeTarget = state.danger ? (level.calm > 0 ? 0.25 : 0.9) : 0;
    level.warning = approach(level.warning, edgeTarget, dt / (state.danger ? 1.5 : 2.5));
    level.focus = approach(level.focus, state.focused ? 0.5 : 0, dt / (state.focused ? 1.5 : 2));
    const strain = state.strain >= PERCEPTION.echoThreshold ? Math.min(0.65, state.strain) : 0;
    level.echo = approach(level.echo, strain, dt / (strain ? 1.2 : 2));
    this.applyBudget();
    this.driftWeight = approach(this.driftWeight, state.drifting ? 1 : 0, dt / (state.drifting ? 3 : 3.5));
    if (!this.still && this.intensity > 0) {
      this.phase += dt;
      this.ambientPhase += dt * (1 + this.cadenceOffset);
    }
    for (const track of this.echoTracks) {
      track.timer = Math.max(0, track.timer - dt);
      track.age += dt;
    }
    for (const echo of this.echoes) echo.life = Math.max(0, echo.life - dt);
    if (this.weights.echo < 0.005) this.clearEchoes();
  }

  clearEchoes(): void {
    for (const track of this.echoTracks) {
      track.id = '';
      track.index = 0;
      track.timer = 0;
      track.age = 0;
    }
    for (const echo of this.echoes) echo.life = 0;
  }

  reset(): void {
    Object.assign(this.level, { calm: 0, focus: 0, echo: 0, warning: 0 });
    this.applyBudget();
    this.phase = 0;
    this.driftWeight = 0;
    this.ambientPhase = 0;
    this.clearEchoes();
  }

  get echoCount(): number {
    return this.echoes.filter((echo) => echo.life > 0).length;
  }

  rememberStride(x: number, y: number, facing: number, entity = 'player'): void {
    if (this.weights.echo < 0.005) return;
    let slot = entity === 'player' ? 0 : this.echoTracks.findIndex((track, index) => index > 0 && track.id === entity);
    if (slot < 0) slot = this.echoTracks.findIndex((track, index) => index > 0 && (!track.id || track.age > PERCEPTION.echoSeconds));
    if (slot < 0) return;
    const track = this.echoTracks[slot];
    if (track.timer > 0) return;
    if (track.id !== entity) track.index = 0;
    track.id = entity;
    track.age = 0;
    const echo = this.echoes[slot * 4 + track.index];
    echo.x = x;
    echo.y = y;
    echo.facing = facing;
    echo.life = PERCEPTION.echoSeconds;
    echo.creature = entity !== 'player';
    track.index = (track.index + 1) % 4;
    track.timer = PERCEPTION.echoSeconds / 4;
  }

  contour(seed: number): number {
    return this.still ? 0 : Math.sin(this.phase * Math.PI * 2 * PERCEPTION.contourHz + seed) *
      PERCEPTION.contourPixels * this.weights.calm;
  }

  get sceneryPhase(): number {
    return this.still || this.intensity === 0 ? 0 : this.phase * Math.PI * 2 * PERCEPTION.contourHz;
  }

  get ambientTime(): number {
    return this.still ? 0 : this.ambientPhase;
  }

  get parallax(): number {
    if (this.still || this.intensity === 0) return 0;
    return Math.sin(this.phase * Math.PI * 2 * PERCEPTION.driftHz) *
      PERCEPTION.driftDepth * this.driftWeight * this.intensity;
  }

  get cadenceOffset(): number {
    if (this.still || this.intensity === 0) return 0;
    return Math.sin(this.phase * Math.PI * 2 / PERCEPTION.cadenceSeconds) *
      PERCEPTION.cadenceDepth * this.driftWeight * this.intensity;
  }

  drawGlaze(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    if (this.weights.calm < 0.005) return;
    ctx.save();
    ctx.globalAlpha = this.weights.calm * 0.14;
    const wash = ctx.createRadialGradient(x, y, radius * 0.13, x, y, radius);
    wash.addColorStop(0, '#ffc379');
    wash.addColorStop(1, '#ffc37900');
    ctx.fillStyle = wash;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  drawLandmarkHalo(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (this.weights.focus < 0.005) return;
    ctx.save();
    ctx.globalAlpha = this.weights.focus * PERCEPTION.landmarkHaloAlpha;
    ctx.strokeStyle = '#ffe3a2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 62, 24, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawHatch(ctx: CanvasRenderingContext2D, x: number, y: number, plate?: HTMLImageElement): void {
    if (this.weights.focus < 0.005) return;
    const drift = this.still || this.flashFree ? 0 : Math.sin(this.phase * 0.6) * 2;
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.globalAlpha = PERCEPTION.hatchAlpha * this.weights.focus * 2;
    if (plate?.complete && plate.naturalWidth) {
      ctx.drawImage(plate, x - 78 + drift, y - 40, 156, 80);
      ctx.restore();
      return;
    }
    ctx.beginPath();
    for (let row = -2; row <= 2; row++) {
      for (let col = -3; col <= 3; col++) {
        const px = x + drift + col * 19 + (row % 2) * 9.5;
        const py = y + row * 13;
        for (let corner = 0; corner <= 6; corner++) {
          const angle = (corner + 0.5) * Math.PI / 3;
          const lx = px + Math.cos(angle) * 10;
          const ly = py + Math.sin(angle) * 7;
          if (corner === 0) ctx.moveTo(lx, ly);
          else ctx.lineTo(lx, ly);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  drawEchoes(ctx: CanvasRenderingContext2D): void {
    if (this.weights.echo < 0.005) return;
    ctx.save();
    ctx.fillStyle = '#644334';
    for (const echo of this.echoes) {
      if (echo.life <= 0) continue;
      ctx.globalAlpha = 0.28 * this.weights.echo * (echo.life / PERCEPTION.echoSeconds) ** 2;
      ctx.beginPath();
      ctx.ellipse(echo.x, echo.y - 17, 11, echo.creature ? 8 : 17, echo.facing * 0.12, 0, Math.PI * 2);
      ctx.ellipse(echo.x + (echo.creature ? 11 : 3) * echo.facing, echo.y - (echo.creature ? 22 : 38),
        echo.creature ? 6 : 10, echo.creature ? 5 : 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBramble(ctx: CanvasRenderingContext2D, width: number, height: number, mask?: HTMLImageElement): void {
    const strength = this.weights.warning;
    if (strength < 0.005) return;
    ctx.save();
    const edge = PERCEPTION.edgeFraction * Math.min(width, height);
    const reach = edge * (this.still ? 1 : 0.65 + strength * 0.35);
    ctx.globalAlpha = strength * PERCEPTION.edgeAlpha;
    if (mask?.complete && mask.naturalWidth) {
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.rect(reach, reach, width - 2 * reach, height - 2 * reach);
      ctx.clip('evenodd');
      const tint = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.4,
        width / 2, height / 2, Math.hypot(width, height) * 0.5);
      tint.addColorStop(0, '#29334600');
      tint.addColorStop(1, '#29334659');
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(mask, 0, 0, width, height);
      ctx.restore();
      return;
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (let side = 0; side < 4; side++) {
      ctx.save();
      ctx.translate(side === 1 || side === 2 ? width : 0, side >= 2 ? height : 0);
      ctx.rotate(side * Math.PI / 2);
      const length = side % 2 ? height : width;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(length, 0);
      ctx.lineTo(length - reach, reach);
      ctx.lineTo(reach, reach);
      ctx.closePath();
      ctx.clip();
      const shade = ctx.createLinearGradient(0, 0, 0, reach);
      shade.addColorStop(0, '#241531');
      shade.addColorStop(1, '#24153100');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, length, reach);
      ctx.beginPath();
      for (let x = 0; x < length + 20; x += 16) {
        const tip = reach * (0.35 + 0.62 * Math.abs(Math.sin(x * 0.13 + side)));
        ctx.moveTo(x - 23, 0);
        ctx.quadraticCurveTo(x + 17, tip * 0.55, x + 6, tip);
        ctx.moveTo(x + 10, tip * 0.57);
        ctx.lineTo(x + 1, tip * 0.62);
        ctx.moveTo(x + 13, tip * 0.35);
        ctx.lineTo(x + 24, tip * 0.46);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}

interface CueSlot {
  event: AudioCueEvent | null;
  x: number;
  y: number;
  life: number;
  time: number;
}

export class VisualCueBridge {
  private slotIndex = 0;
  private readonly slots: CueSlot[] = Array.from({ length: 16 }, () => ({ event: null, x: 0, y: 0, life: 0, time: 0 }));

  private showStamp(event: AudioCueEvent, settings: AudioSettings): boolean {
    return settings.visualSoundCues || settings.muted || settings.master === 0 || settings[event.channel] === 0;
  }

  add(event: AudioCueEvent, x: number, y: number, now: number): void {
    const px = event.worldPos?.x ?? x;
    const py = event.worldPos?.y ?? y;
    if (this.slots.some((slot) => slot.event?.id === event.id && now - slot.time < PERCEPTION.rippleInterval &&
      Math.hypot(slot.x - px, slot.y - py) < 40)) return;
    const slot = this.slots[this.slotIndex];
    Object.assign(slot, { event, x: px, y: py, life: PERCEPTION.rippleSeconds, time: now });
    this.slotIndex = (this.slotIndex + 1) % this.slots.length;
  }

  clear(): void {
    for (const slot of this.slots) {
      slot.life = 0;
      slot.event = null;
    }
  }

  step(dt: number): void {
    for (const slot of this.slots) slot.life = Math.max(0, slot.life - dt);
  }

  get active(): boolean {
    return this.slots.some((slot) => slot.life > 0);
  }

  caption(settings: AudioSettings, cx: number, cy: number, width: number, height: number): string | null {
    let latest: CueSlot | undefined;
    for (const slot of this.slots) {
      if (!slot.event || slot.life <= 0 || !this.showStamp(slot.event, settings)) continue;
      if (latest?.event?.urgency === 'urgent' && slot.event.urgency !== 'urgent') continue;
      if (!latest || slot.event.urgency !== latest.event?.urgency || slot.time >= latest.time) latest = slot;
    }
    if (!latest?.event) return null;
    const x = latest.x - cx;
    const y = latest.y - cy;
    const offscreen = x < 20 || x > width - 20 || y < 20 || y > height - 20;
    const angle = Math.atan2(y - height / 2, x - width / 2);
    const direction = DIRECTIONS[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
    return `${STAMP[latest.event.category]} ${latest.event.id}${offscreen ? ` · ${direction}` : ''}`;
  }

  drawRipples(ctx: CanvasRenderingContext2D, focus: number, still: boolean): void {
    if (focus < 0.005) return;
    ctx.save();
    ctx.strokeStyle = '#342239';
    ctx.lineWidth = 1.5;
    for (let i = 1, drawn = 0; i <= this.slots.length && drawn < 6; i++) {
      const slot = this.slots[(this.slotIndex + this.slots.length - i) % this.slots.length];
      if (!slot.event || slot.life <= 0) continue;
      drawn++;
      const progress = 1 - slot.life / PERCEPTION.rippleSeconds;
      const radius = still ? 24 : 12 + progress * 36;
      const fade = Math.min(1, progress * 15) * (1 - progress) ** 2;
      ctx.globalAlpha = 0.1 * focus * fade;
      ctx.beginPath();
      ctx.ellipse(slot.x, slot.y, radius, radius * 0.56, 0, 0, Math.PI * 2);
      ctx.ellipse(slot.x, slot.y, radius * 0.7, radius * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawStamps(ctx: CanvasRenderingContext2D, settings: AudioSettings, cx: number, cy: number, width: number, height: number, sheet?: HTMLImageElement): void {
    ctx.save();
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let offscreen: CueSlot | null = null;
    for (const slot of this.slots) {
      if (!slot.event || slot.life <= 0 || !this.showStamp(slot.event, settings)) continue;
      const x = Math.round(slot.x - cx);
      const y = Math.round(slot.y - cy + 19);
      if (x < 20 || x > width - 20 || y < 20 || y > height - 20) {
        if (!offscreen || slot.time >= offscreen.time) offscreen = slot;
        continue;
      }
      ctx.fillStyle = INK;
      ctx.strokeStyle = '#f7efde';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f7efde';
      if (sheet?.complete && sheet.naturalWidth) {
        ctx.drawImage(sheet, STAMP_CELL[slot.event.category] * 64, 0, 64, 64, x - 9, y - 9, 18, 18);
      } else {
        ctx.fillText(STAMP[slot.event.category], x, y);
      }
    }
    if (offscreen) {
      const dx = offscreen.x - cx - width / 2;
      const dy = offscreen.y - cy - height / 2;
      const extent = Math.max(Math.abs(dx) / Math.max(1, width * 0.36), Math.abs(dy) / Math.max(1, height * 0.29));
      ctx.translate(width / 2 + dx / extent, height / 2 + dy / extent);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath();
      ctx.moveTo(-5, -6);
      ctx.lineTo(4, 0);
      ctx.lineTo(-5, 6);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = '#f7efde';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
}
