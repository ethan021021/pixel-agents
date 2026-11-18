import { ROOM_SHEET_FRAME } from '../../../core/src/assets/constants.js';
import type { FurnitureInstance, OfficeLayout } from './types.js';
import { TILE_SIZE, TileType } from './types.js';

export const ROOM_GROUND_SCALE = 0.75;
/** Source pixels per room display unit: a tile is 64 native pixels across its diamond. */
export const ROOM_NATIVE_SCALE = ROOM_SHEET_FRAME.width / (2 * TILE_SIZE * ROOM_GROUND_SCALE);
export const ROOM_WALL_HEIGHT = 42;
export const ROOM_PLATFORM_DEPTH = 2;

export interface RoomPoint {
  x: number;
  y: number;
}

export interface RoomProjection {
  toScreen(worldX: number, worldY: number): RoomPoint;
  toWorld(screenX: number, screenY: number): RoomPoint;
  focusPan(worldX: number, worldY: number): RoomPoint;
}

/** Map the office's ground plane onto 2:1 diamonds in canvas device pixels. */
export function roomProjection(
  width: number,
  height: number,
  cols: number,
  rows: number,
  zoom: number,
  panX: number,
  panY: number,
): RoomProjection {
  const scale = zoom * ROOM_GROUND_SCALE;
  const centerX = (cols * TILE_SIZE) / 2;
  const centerY = (rows * TILE_SIZE) / 2;
  const canvasX = Math.floor(width / 2) + Math.round(panX);
  const canvasY = Math.floor(height / 2) + Math.round(panY);

  return {
    toScreen(worldX, worldY) {
      const x = (worldX - centerX) * scale;
      const y = (worldY - centerY) * scale;
      return { x: canvasX + x - y, y: canvasY + (x + y) / 2 };
    },
    toWorld(screenX, screenY) {
      const x = (screenX - canvasX) / (2 * scale);
      const y = (screenY - canvasY) / scale;
      return { x: centerX + y + x, y: centerY + y - x };
    },
    focusPan(worldX, worldY) {
      const x = (worldX - centerX) * scale;
      const y = (worldY - centerY) * scale;
      return { x: y - x, y: -(x + y) / 2 };
    },
  };
}

/** Frame the painted room rather than the empty padding in its layout. Keep
 * the visitor centered when the current zoom is too large for the viewport. */
export function roomEntryPan(
  layout: Pick<OfficeLayout, 'cols' | 'rows' | 'tiles'>,
  zoom: number,
  width: number,
  height: number,
  visitor?: RoomPoint,
): RoomPoint {
  const { cols, rows, tiles } = layout;
  const projection = roomProjection(0, 0, cols, rows, zoom, 0, 0);
  const halfWidth = TILE_SIZE * ROOM_GROUND_SCALE * zoom;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    if (tile === TileType.VOID) continue;
    const point = projection.toScreen((i % cols) * TILE_SIZE, Math.floor(i / cols) * TILE_SIZE);
    left = Math.min(left, point.x - halfWidth);
    right = Math.max(right, point.x + halfWidth);
    top = Math.min(top, point.y - (tile === TileType.WALL ? ROOM_WALL_HEIGHT * zoom : 0));
    bottom = Math.max(bottom, point.y + halfWidth + ROOM_PLATFORM_DEPTH * zoom);
  }
  if (!Number.isFinite(top))
    return visitor ? projection.focusPan(visitor.x, visitor.y) : { x: 0, y: 0 };
  if (visitor && (right - left > width || bottom - top > height))
    return projection.focusPan(visitor.x, visitor.y);
  return { x: -(left + right) / 2, y: -(top + bottom) / 2 };
}

/** Bounds of the upright sprite, in canvas device pixels. */
export function roomFurnitureBounds(
  furniture: FurnitureInstance,
  projection: Pick<RoomProjection, 'toScreen'>,
  zoom: number,
): { x: number; y: number; width: number; height: number; depth: number } {
  const spriteWidth = furniture.sprite[0].length;
  const spriteHeight = furniture.sprite.length;
  const anchorX = furniture.x + spriteWidth / 2;
  const anchor = projection.toScreen(anchorX, furniture.y + spriteHeight);
  const width = Math.floor(spriteWidth * zoom);
  const height = Math.floor(spriteHeight * zoom);
  return {
    x: Math.round(anchor.x - width / 2),
    y: Math.round(anchor.y - height),
    width,
    height,
    depth: projection.toScreen(anchorX, furniture.zY).y,
  };
}
