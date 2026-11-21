// Playtest starting points. This tuning affects presentation only.
export const PERCEPTION = {
  contourHz: 0.32,
  contourPixels: 3,
  hatchAlpha: 0.16,
  rippleSeconds: 1.2,
  rippleInterval: 0.5,
  echoSeconds: 0.32,
  driftHz: 0.18,
  driftDepth: 0.045,
  cadenceSeconds: 6,
  cadenceDepth: 0.06,
  landmarkHaloAlpha: 0.35,
  edgeFraction: 0.18,
  edgeAlpha: 0.55,
  echoThreshold: 0.35,
  warningThreshold: 0.75,
  maxFrameSeconds: 0.05,
} as const;

export function clampFrameSeconds(milliseconds: number): number {
  return Math.min(PERCEPTION.maxFrameSeconds, Math.max(0, milliseconds / 1000));
}

export function getMeltPressure(vibe: number, maxVibe: number, ghost: boolean): number {
  return ghost ? 1 : Math.min(1, Math.max(0, 1 - vibe / maxVibe));
}
