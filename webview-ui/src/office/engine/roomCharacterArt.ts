import { rgbaToHex } from '../../../../core/src/assets/colorUtils.js';
import { CHAR_FRAME_H, CHAR_FRAME_W } from '../../../../core/src/assets/constants.js';
import { Direction, type SpriteData } from '../types.js';

const cache = new WeakMap<SpriteData, Map<number, SpriteData>>();
const ROOM_FRAME_W = CHAR_FRAME_W + 2;
const HIGHLIGHT = rgbaToHex(255, 255, 255, 255);
const PUPIL = rgbaToHex(0, 0, 0, 255);

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

function edgePixel(row: string[], facing: number): number {
  let x = facing < 0 ? 0 : ROOM_FRAME_W - 1;
  while (x >= 0 && x < ROOM_FRAME_W && !row[x]) x -= facing;
  return x;
}

/** Reveal the near cheek and keep the original eye shapes and colors intact. */
function widenCheek(row: string[]): void {
  const edge = edgePixel(row, 1);
  if (edge <= 0 || edge >= ROOM_FRAME_W - 1 || !row[edge - 1]) return;
  row[edge + 1] = row[edge];
  row[edge] = row[edge - 1];
}

/** Smaller eye highlights leave the eyes readable under the hairline. */
function softenEyeHighlights(row: string[], above: string[], profile: boolean): void {
  for (let x = 1; x < ROOM_FRAME_W - 1; x++) {
    if (row[x] !== HIGHLIGHT) continue;
    if (row[x - 1] !== PUPIL && row[x + 1] !== PUPIL && above[x] !== PUPIL) continue;
    row[x] = shade(row[x], !profile && x < ROOM_FRAME_W / 2 ? 0.64 : 0.78);
  }
}

/** Keep the near shoe on the same floor pixel. The far half of the jacket
 * sits one pixel higher, while the far shoe recedes by a second pixel. */
function angleFrontBody(art: SpriteData, shoulder: number, foot: number, facing: number): void {
  if (shoulder > foot) return;
  const depth = (x: number) => (x - (ROOM_FRAME_W - 1) / 2) * facing;
  const nearFoot = art[foot].some((pixel, x) => pixel && depth(x) < 1);
  const body = art.slice(shoulder, foot + 1);
  const seam = art[shoulder - 1];
  // The calf is already enlarged by duplicating rows. Advance the far foot
  // at one of those repeats so the stagger retains cuffs and shoe colors.
  const calf = body.findIndex(
    (row, y) =>
      y >= body.length - 8 &&
      row.some(Boolean) &&
      body[y + 1] !== undefined &&
      row.every((pixel, x) => pixel === body[y + 1][x]),
  );
  for (let y = 0; y < body.length; y++) {
    const belowKnee = y >= body.length - 8;
    art[shoulder + y] = body[y].map((pixel, x) => {
      const plane = depth(x);
      if (plane < 1 || (belowKnee && !nearFoot)) return pixel;
      const lift = calf >= 0 && y >= calf ? 2 : 1;
      const sample = body[y + lift]?.[x] ?? '';
      const collar = y === 0 && !seam[x] && !sample ? pixel : sample;
      return collar && plane >= 2 ? shade(collar, 0.88) : collar;
    });
  }
}

/** The profile poses have only one visible sleeve and one shoe when standing.
 * Give the sleeve a side plane and reveal a little of the receding sole. */
function angleSideBody(art: SpriteData, shoulder: number, foot: number, facing: number): void {
  for (let y = shoulder + 2; y <= Math.min(shoulder + 9, foot - 5); y++) {
    const row = art[y];
    const nearEdge = edgePixel(row, -facing);
    const side = nearEdge - facing;
    const sleeve = row[nearEdge + facing];
    if (side >= 0 && side < ROOM_FRAME_W && sleeve) row[side] = shade(sleeve, 0.88);
  }

  const shoeRows = art.slice(foot - 2, foot + 1);
  if (foot < shoulder + 10 || shoeRows.length !== 3) return;
  const outline = shoeRows[0].map((_, x) => shoeRows.some((row) => row[x]));
  if (outline.lastIndexOf(true) - outline.indexOf(true) > 3) return;
  for (let y = 0; y < shoeRows.length; y++) {
    const row = shoeRows[y];
    const dest = art[foot - 4 + y];
    const spread = y === 0 ? 1 : 2;
    for (let x = 0; x < ROOM_FRAME_W; x++) {
      const side = x + spread * facing;
      if (row[x] && side >= 0 && side < ROOM_FRAME_W && !dest[side]) {
        dest[side] = shade(row[x], 0.84);
      }
    }
  }
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
  const side = direction === Direction.LEFT || direction === Direction.RIGHT;
  const facing = direction === Direction.DOWN || direction === Direction.LEFT ? -1 : 1;
  const turn = side ? 0 : facing * 2;
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
  let shoulderRow = 0;
  for (let y = 0; y < CHAR_FRAME_H; y++) {
    if (y === hairRow) continue;
    if (y === shoulder) shoulderRow = art.length;
    const sourceRow = source[y];
    const row =
      y < shoulder
        ? headRow(sourceRow, turn)
        : y < shoulder + 6
          ? torsoRow(sourceRow, y < shoulder + 3 ? turn : 0)
          : ['', ...sourceRow, ''];
    if (direction === Direction.DOWN && y === shoulder - 2) widenCheek(row);
    art.push(row);
    if (y <= lastPixelRow && extraRows.has(y)) art.push([...row]);
  }
  if (!sitting) {
    const foot = art.length - source.length + lastPixelRow;
    if (side) angleSideBody(art, shoulderRow, foot, facing);
    else angleFrontBody(art, shoulderRow, foot, facing);
  }
  if (direction !== Direction.UP) {
    const eye = shoulderRow - (side ? 5 : 3);
    softenEyeHighlights(art[eye], art[eye - 1], side);
    softenEyeHighlights(art[eye + 1], art[eye], side);
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
