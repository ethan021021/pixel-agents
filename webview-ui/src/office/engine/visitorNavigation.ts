import { getCatalogEntry } from '../layout/furnitureCatalog.js';
import { findPath, isWalkable } from '../layout/tileMap.js';
import type { Character, PlacedFurniture, TileType } from '../types.js';
import { TILE_SIZE } from '../types.js';

export type VisitorTile = { col: number; row: number };

export function visitorTile(visitor: Character): VisitorTile {
  return { col: visitor.tileCol, row: visitor.tileRow };
}

export function placeVisitor(visitor: Character, tile: VisitorTile): void {
  visitor.tileCol = tile.col;
  visitor.tileRow = tile.row;
  visitor.x = (tile.col + 0.5) * TILE_SIZE;
  visitor.y = (tile.row + 0.5) * TILE_SIZE;
  visitor.path = [];
  visitor.moveProgress = 0;
  visitor.frame = 0;
  visitor.frameTimer = 0;
}

/** Finish the step already under way before taking a new route. */
export function visitorRoute(
  visitor: Character,
  destinations: VisitorTile[],
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): VisitorTile[] | null {
  const step = visitor.moveProgress > 0 ? visitor.path[0] : undefined;
  const from = step ?? visitorTile(visitor);
  let best: VisitorTile[] | null = null;
  let bestCost = Infinity;
  for (const to of destinations) {
    if (!isWalkable(to.col, to.row, tileMap, blockedTiles)) continue;
    const route = findPath(from.col, from.row, to.col, to.row, tileMap, blockedTiles, true);
    if (route.length === 0 && (from.col !== to.col || from.row !== to.row)) continue;
    let previous = from;
    let cost = 0;
    for (const tile of route) {
      cost += tile.col !== previous.col && tile.row !== previous.row ? Math.SQRT2 : 1;
      previous = tile;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = route;
    }
  }
  return best && step ? [step, ...best] : best;
}

/** The floor tiles bordering the footprint, along its four sides. */
export function adjacentTiles(col: number, row: number, width = 1, height = 1): VisitorTile[] {
  const tiles: VisitorTile[] = [];
  for (let c = col; c < col + width; c++) {
    tiles.push({ col: c, row: row - 1 }, { col: c, row: row + height });
  }
  for (let r = row; r < row + height; r++) {
    tiles.push({ col: col - 1, row: r }, { col: col + width, row: r });
  }
  return tiles;
}

export function furnitureCovers(item: PlacedFurniture, col: number, row: number): boolean {
  const entry = getCatalogEntry(item.type);
  return (
    !!entry &&
    col >= item.col &&
    col < item.col + entry.footprintW &&
    row >= item.row &&
    row < item.row + entry.footprintH
  );
}
