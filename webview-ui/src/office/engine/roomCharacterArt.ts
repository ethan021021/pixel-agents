import { rgbaToHex } from '../../../../core/src/assets/colorUtils.js';
import { CHAR_FRAME_H, CHAR_FRAME_W } from '../../../../core/src/assets/constants.js';
import { Direction, type SpriteData } from '../types.js';

const cache = new WeakMap<SpriteData, Map<number, SpriteData>>();
const ROOM_FRAME_W = CHAR_FRAME_W + 2;

/** The wardrobe's facing rows put the shoulders at different heights in a chair. */
function shoulders(direction: Direction, sitting: boolean): number {
  if (direction === Direction.DOWN) return sitting ? 22 : 18;
  if (direction === Direction.UP) return sitting ? 17 : 18;
  return sitting ? 21 : 20;
}

function upperHairRow(source: SpriteData, shoulder: number): number {
  const first = source.findIndex((row) => row.some(Boolean));
  if (first < 0) return -1;
  // Compress only pixels present in an adjacent row, well above the eyes.
  for (let y = first + 2; y <= Math.min(first + 7, shoulder - 9); y++) {
    if (
      source[y].some(Boolean) &&
      source[y].every(
        (pixel, x) => !pixel || pixel === source[y - 1][x] || pixel === source[y + 1][x],
      )
    )
      return y;
  }
  return -1;
}

function headRow(source: string[], turn: number): string[] {
  const row = new Array<string>(ROOM_FRAME_W).fill('');
  for (let x = 0; x < CHAR_FRAME_W; x++) {
    if (!source[x]) continue;
    const center = x >= 3 && x <= 12;
    // Bring the silhouette in by one pixel at each side. Keep the face and
    // its accessories at full resolution when two pixels share a destination.
    const dest = x + turn + (x < 3 ? 2 : x > 12 ? 0 : 1);
    if (center || !row[dest]) row[dest] = source[x];
  }
  return row;
}

function torsoRow(source: string[], lean: number): string[] {
  const row = [
    ...source.slice(0, 3),
    source[2],
    ...source.slice(3, 14),
    source[13],
    ...source.slice(14),
  ];
  if (lean < 0 && !row[0]) return [...row.slice(1), ''];
  if (lean > 0 && !row[ROOM_FRAME_W - 1]) return ['', ...row.slice(0, -1)];
  return row;
}

function shade(pixel: string, amount: number): string {
  if (pixel.length !== 7 && pixel.length !== 9) return pixel;
  const channel = (at: number) =>
    Math.min(255, Math.round(parseInt(pixel.slice(at, at + 2), 16) * amount));
  const alpha = pixel.length === 9 ? parseInt(pixel.slice(7), 16) : 255;
  return rgbaToHex(channel(1), channel(3), channel(5), alpha);
}

/** Form a room-view frame from the original wardrobe pixels. The additional
 * rows sit above the feet and leave the source frame's bottom padding intact,
 * including poses whose knees or shoes sit higher in the box. */
export function roomCharacterSprite(
  source: SpriteData,
  direction: Direction,
  sitting: boolean,
): SpriteData {
  if (source.length !== CHAR_FRAME_H || source[0]?.length !== CHAR_FRAME_W) return source;
  const key = direction * 2 + Number(sitting);
  const cached = cache.get(source);
  const existing = cached?.get(key);
  if (existing) return existing;

  const shoulder = shoulders(direction, sitting);
  const turn = direction === Direction.DOWN ? -2 : direction === Direction.UP ? 2 : 0;
  const hairRow = upperHairRow(source, shoulder);
  const extraRows = sitting
    ? new Set([shoulder + 1, shoulder + 2, shoulder + 3])
    : new Set([shoulder + 1, shoulder + 2, shoulder + 4, 25, 26, 27, 28]);
  let lastPixelRow = source.length - 1;
  while (lastPixelRow >= 0 && !source[lastPixelRow].some(Boolean)) lastPixelRow--;
  // Very sparse custom frames can have no legs. Keep their empty rows at the
  // bottom too, moving any unused extension above their art.
  const topPadding = [...extraRows].filter((y) => y > lastPixelRow).length + Number(hairRow >= 0);
  const art: SpriteData = Array.from({ length: topPadding }, () =>
    new Array<string>(ROOM_FRAME_W).fill(''),
  );
  for (let y = 0; y < CHAR_FRAME_H; y++) {
    if (y === hairRow) continue;
    const sourceRow = source[y];
    const row =
      y < shoulder
        ? headRow(sourceRow, turn)
        : y < shoulder + 6
          ? torsoRow(sourceRow, y < shoulder + 3 ? turn : 0)
          : ['', ...sourceRow, ''];
    art.push(row);
    if (y <= lastPixelRow && extraRows.has(y)) art.push(row);
  }

  // A one-pixel contour on the room's shadow side adds depth without adding
  // pixels below the feet or replacing the wearer's palette.
  const result = art.map((row, y) =>
    row.map((pixel, x) => {
      if (!pixel) return pixel;
      if (!row[x + 1] || !art[y + 1]?.[x]) return shade(pixel, 0.83);
      if (!row[x - 1] && !art[y - 1]?.[x]) return shade(pixel, 1.05);
      return pixel;
    }),
  );
  const frames = cached ?? new Map<number, SpriteData>();
  frames.set(key, result);
  if (!cached) cache.set(source, frames);
  return result;
}
