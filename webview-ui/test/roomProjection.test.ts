import { describe, expect, it } from 'vitest';

import { roomEntryPan, roomFurnitureBounds, roomProjection } from '../src/office/roomProjection.js';
import { TILE_SIZE, TileType } from '../src/office/types.js';

describe('angled office projection', () => {
  it('maps a floor tile to a 2:1 diamond and round-trips continuous points', () => {
    const projection = roomProjection(803, 613, 21, 22, 3, -19.25, 31.75);
    const left = projection.toScreen(0, TILE_SIZE);
    const right = projection.toScreen(TILE_SIZE, 0);
    const top = projection.toScreen(0, 0);
    const bottom = projection.toScreen(TILE_SIZE, TILE_SIZE);
    expect(right.x - left.x).toBe(2 * (bottom.y - top.y));
    expect(left.y).toBe(right.y);
    expect(bottom.x).toBe(top.x);

    for (const [x, y] of [
      [0, 0],
      [92.25, 136.8],
      [336, 352],
    ]) {
      const screen = projection.toScreen(x, y);
      const world = projection.toWorld(screen.x, screen.y);
      expect(world.x).toBeCloseTo(x, 9);
      expect(world.y).toBeCloseTo(y, 9);
    }
  });

  it('calculates an absolute focus pan independent of the current pan', () => {
    const world = { x: 12 * TILE_SIZE + 8, y: 15 * TILE_SIZE + 8 };
    const projection = roomProjection(803, 613, 21, 22, 2, -190, 173);
    const pan = projection.focusPan(world.x, world.y);
    const focused = roomProjection(803, 613, 21, 22, 2, pan.x, pan.y);
    expect(focused.toScreen(world.x, world.y)).toEqual({ x: 401, y: 306 });
  });

  it('places the bottom center of an upright furniture sprite at its projected anchor', () => {
    const projection = roomProjection(640, 480, 16, 16, 2, -12, 40);
    const furniture = { sprite: [['', '']], x: 16, y: 32, zY: 42 };
    const bounds = roomFurnitureBounds(furniture, projection, 2);
    const anchor = projection.toScreen(17, 33);
    expect(bounds).toEqual({
      x: Math.round(anchor.x - 2),
      y: Math.round(anchor.y - 2),
      width: 4,
      height: 2,
      depth: projection.toScreen(17, 42).y,
    });
  });

  it('frames the occupied room at entry and follows the visitor when it cannot fit', () => {
    const layout = {
      cols: 4,
      rows: 3,
      tiles: [
        TileType.VOID,
        TileType.WALL,
        TileType.WALL,
        TileType.VOID,
        TileType.VOID,
        TileType.FLOOR_1,
        TileType.FLOOR_1,
        TileType.VOID,
        TileType.VOID,
        TileType.VOID,
        TileType.VOID,
        TileType.VOID,
      ],
    };
    const visitor = { x: 2.5 * TILE_SIZE, y: 1.5 * TILE_SIZE };
    const base = roomProjection(0, 0, layout.cols, layout.rows, 2, 0, 0);
    const fit = roomEntryPan(layout, 2, 1000, 800, visitor);
    const top = base.toScreen(TILE_SIZE, 0);
    const bottom = base.toScreen(3 * TILE_SIZE, 2 * TILE_SIZE);
    expect(fit).toEqual({ x: -(top.x + bottom.x) / 2, y: 40 - (top.y + bottom.y) / 2 });
    expect(roomEntryPan(layout, 2, 10, 10, visitor)).toEqual(base.focusPan(visitor.x, visitor.y));
  });
});
