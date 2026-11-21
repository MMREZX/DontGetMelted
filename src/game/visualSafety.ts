type Rgb = readonly [number, number, number];

const LINEAR = Array.from({ length: 256 }, (_, value) => {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
});

export function relativeLuminance([red, green, blue]: Rgb): number {
  return 0.2126 * LINEAR[red] + 0.7152 * LINEAR[green] + 0.0722 * LINEAR[blue];
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function chromaticity(color: Rgb): { u: number; v: number; red: boolean } {
  const [r, g, b] = color.map((channel) => LINEAR[channel]);
  const x = 0.4124 * r + 0.3576 * g + 0.1805 * b;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const sum = x + 15 * y + 3 * z;
  return { u: sum ? (4 * x) / sum : 0, v: sum ? (9 * y) / sum : 0, red: r > 0 && r / (r + g + b) >= 0.8 };
}

export function isSaturatedRedTransition(a: Rgb, b: Rgb): boolean {
  const first = chromaticity(a);
  const second = chromaticity(b);
  return (first.red || second.red) && Math.hypot(first.u - second.u, first.v - second.v) > 0.2;
}

// Evaluate one luminance trace in timestamp order. Feed each sampled screen region separately.
export function maxGeneralFlashes(samples: ReadonlyArray<{ ms: number; luminance: number }>): number {
  if (!samples.length) return 0;
  let extreme = samples[0].luminance;
  let direction = 0;
  let firstTransition = 0;
  let peak = 0;
  let oldest = 0;
  const flashes: number[] = [];
  for (const { ms, luminance } of samples) {
    const delta = luminance - extreme;
    const nextDirection = Math.sign(delta);
    const qualifies = Math.abs(delta) >= 0.1 && Math.min(luminance, extreme) < 0.8;
    if (qualifies && nextDirection !== direction) {
      direction = nextDirection;
      if (firstTransition === -direction) {
        flashes.push(ms);
        while (flashes[oldest] <= ms - 1000) oldest++;
        peak = Math.max(peak, flashes.length - oldest);
        firstTransition = 0;
      } else {
        firstTransition = direction;
      }
      extreme = luminance;
    } else if (nextDirection === direction) {
      extreme = luminance;
    }
  }
  return peak;
}
