import type { FurnitureInstance } from './types.js';
import { TILE_SIZE } from './types.js';

export const ROOM_GROUND_SCALE = 0.75;

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
