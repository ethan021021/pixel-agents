/**
 * A character sheet's layout, read in ONE place: 3 direction rows (down, up, right) x 8
 * frames (walk1-3, type1-2, read1-2, seated). Pure (no PNG decoder), so
 * the server's char_N.png decoding and the webview's composed sheets slice it the same way.
 */

import { rgbaToHex } from './colorUtils.js';
import {
  CHAR_FRAME_H,
  CHAR_FRAME_W,
  CHAR_FRAMES_PER_ROW,
  CHARACTER_DIRECTIONS,
  ROOM_ANIMATED_FRAME_COUNT,
  ROOM_SHEET_FRAME,
} from './constants.js';
import { LEGACY_SHEET_W, widenLegacySheet } from './seatedFrame.js';
import type { CharacterDirectionSprites } from './types.js';

/** The optional native isometric sheet keeps its source pixels through both renderers. */
export function isRoomSheetFrame(width: number, height: number): boolean {
  return width === ROOM_SHEET_FRAME.width && height === ROOM_SHEET_FRAME.height;
}

/**
 * An RGBA sheet's pixels in the current layout: a sheet from before the seated frame
 * (112 wide) widened with it, anything else as it is.
 */
export function currentSheetPixels<T extends Uint8Array | Uint8ClampedArray>(
  width: number,
  data: T,
): { width: number; data: T | Uint8ClampedArray } {
  if (width !== LEGACY_SHEET_W) return { width, data };
  return { width: CHAR_FRAME_W * CHAR_FRAMES_PER_ROW, data: widenLegacySheet(data) };
}

/** An RGBA sheet `width` pixels wide as per-direction frame sprites (hex pixel grids). */
export function sheetToDirectionSprites(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
): CharacterDirectionSprites {
  const columns =
    width === ROOM_SHEET_FRAME.width * ROOM_ANIMATED_FRAME_COUNT
      ? ROOM_ANIMATED_FRAME_COUNT
      : CHAR_FRAMES_PER_ROW;
  const frameWidth = width / columns;
  const frameHeight = data.length / (4 * width * CHARACTER_DIRECTIONS.length);
  if (
    !(frameWidth === CHAR_FRAME_W && frameHeight === CHAR_FRAME_H) &&
    !isRoomSheetFrame(frameWidth, frameHeight)
  ) {
    throw new Error(
      `Unsupported character sheet dimensions: ${width}×${frameHeight * CHARACTER_DIRECTIONS.length}`,
    );
  }
  const sprites: CharacterDirectionSprites = { down: [], up: [], right: [] };
  CHARACTER_DIRECTIONS.forEach((dir, row) => {
    for (let f = 0; f < columns; f++) {
      const frame: string[][] = [];
      for (let y = 0; y < frameHeight; y++) {
        const line: string[] = [];
        for (let x = 0; x < frameWidth; x++) {
          const i = ((row * frameHeight + y) * width + f * frameWidth + x) * 4;
          line.push(rgbaToHex(data[i], data[i + 1], data[i + 2], data[i + 3]));
        }
        frame.push(line);
      }
      sprites[dir].push(frame);
    }
  });
  return sprites;
}
