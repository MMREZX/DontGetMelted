import paperTexture from '../../public/assets/textures/paper_tooth_512.webp?url';
import paperFallback from '../../public/assets/textures/paper_tooth_512.png?url';
import brambleFrame from '../../public/assets/vfx/bramble_frame_1280.webp?url';
import honeycombPlate from '../../public/assets/vfx/kluver_honeycomb_512.png?url';
import spiralPlate from '../../public/assets/vfx/kluver_spiral_512.png?url';
import propsAtlas from '../../public/assets/props/expedition_props.webp?url';
import washesAtlas from '../../public/assets/env/ground_washes_atlas.webp?url';
import faunaAtlas from '../../public/assets/creatures/field_fauna.webp?url';
import cueIcons from '../../public/assets/ui/cue_icons.svg?url';

export type FieldSprite = 'ribbon' | 'lantern' | 'mint' | 'quartz' | 'perch' | 'meadowMoth' | 'hollowBeetle' | 'guideMoth';

const FIELD_ASSETS = {
  paper: paperTexture,
  bramble: brambleFrame,
  honeycomb: honeycombPlate,
  spiral: spiralPlate,
  props: propsAtlas,
  washes: washesAtlas,
  fauna: faunaAtlas,
  cues: cueIcons,
} as const;

export type FieldAssets = Record<keyof typeof FIELD_ASSETS, HTMLImageElement>;

export function loadFieldAssets(): FieldAssets {
  return Object.fromEntries(Object.entries(FIELD_ASSETS).map(([id, url]) => {
    const image = new Image();
    if (id === 'paper') image.addEventListener('error', () => {
      image.src = paperFallback;
    }, { once: true });
    image.src = url;
    return [id, image];
  })) as FieldAssets;
}

export function imageReady(image: HTMLImageElement): boolean {
  return image.complete && image.naturalWidth > 0;
}

export function drawFieldSprite(
  ctx: CanvasRenderingContext2D, assets: FieldAssets, sprite: FieldSprite, x: number, y: number, size: number,
): boolean {
  const props: FieldSprite[] = ['ribbon', 'lantern', 'mint', 'quartz'];
  const fauna: FieldSprite[] = ['perch', 'meadowMoth', 'hollowBeetle', 'guideMoth'];
  const prop = props.indexOf(sprite);
  const sheet = prop >= 0 ? assets.props : assets.fauna;
  if (!imageReady(sheet)) return false;
  const cell = prop >= 0 ? prop : fauna.indexOf(sprite);
  const cellSize = sheet.naturalWidth / 2;
  ctx.drawImage(sheet, (cell % 2) * cellSize, Math.floor(cell / 2) * cellSize, cellSize, cellSize, x - size / 2, y - size, size, size);
  return true;
}
