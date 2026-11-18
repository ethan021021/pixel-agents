import { TileType } from '../types.js';

/** Check if a tile is walkable (floor, carpet, or doorway, and not blocked by furniture) */
export function isWalkable(
  col: number,
  row: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): boolean {
  const rows = tileMap.length;
  const cols = rows > 0 ? tileMap[0].length : 0;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false;
  const t = tileMap[row][col];
  if (t === TileType.WALL || t === TileType.VOID) return false;
  if (blockedTiles.has(`${col},${row}`)) return false;
  return true;
}

/** Get walkable tile positions (grid coords) for wandering */
export function getWalkableTiles(
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): Array<{ col: number; row: number }> {
  const rows = tileMap.length;
  const cols = rows > 0 ? tileMap[0].length : 0;
  const tiles: Array<{ col: number; row: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isWalkable(c, r, tileMap, blockedTiles)) {
        tiles.push({ col: c, row: r });
      }
    }
  }
  return tiles;
}

const AXIAL_STEPS = [
  { dc: 0, dr: -1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
];
const ALL_STEPS = [
  { dc: -1, dr: -1 },
  { dc: 1, dr: -1 },
  { dc: -1, dr: 1 },
  { dc: 1, dr: 1 },
  ...AXIAL_STEPS,
];

/** A diagonal step crosses the corners of both adjacent tiles. */
export function clearsTileCorners(
  col: number,
  row: number,
  nextCol: number,
  nextRow: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): boolean {
  return (
    col === nextCol ||
    row === nextRow ||
    (isWalkable(nextCol, row, tileMap, blockedTiles) &&
      isWalkable(col, nextRow, tileMap, blockedTiles))
  );
}

/** Shortest path from start to end. The visitor can opt into diagonal A*. */
export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
  diagonals = false,
): Array<{ col: number; row: number }> {
  if (startCol === endCol && startRow === endRow) return [];
  if (!isWalkable(endCol, endRow, tileMap, blockedTiles)) return [];

  const key = (c: number, r: number) => `${c},${r}`;
  const startKey = key(startCol, startRow);
  const endKey = key(endCol, endRow);
  const costs = new Map([[startKey, 0]]);
  const parent = new Map<string, string>();
  const queue = [{ col: startCol, row: startRow, cost: 0, estimate: 0 }];
  const dirs = diagonals ? ALL_STEPS : AXIAL_STEPS;
  const estimate = (col: number, row: number) => {
    const dc = Math.abs(endCol - col);
    const dr = Math.abs(endRow - row);
    return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
  };

  for (let i = 0; i < queue.length; i++) {
    // Keep the ordinary agent path in its original FIFO order. For diagonal
    // paths, visit the lowest total estimated cost first.
    if (diagonals) {
      let closest = i;
      for (let j = i + 1; j < queue.length; j++) {
        const candidate = queue[j];
        const best = queue[closest];
        if (
          candidate.estimate < best.estimate ||
          (candidate.estimate === best.estimate && candidate.cost > best.cost)
        ) {
          closest = j;
        }
      }
      [queue[i], queue[closest]] = [queue[closest], queue[i]];
    }
    const curr = queue[i];
    const currKey = key(curr.col, curr.row);
    if (curr.cost !== costs.get(currKey)) continue;

    if (currKey === endKey) {
      // Reconstruct path
      const path: Array<{ col: number; row: number }> = [];
      let k = endKey;
      while (k !== startKey) {
        const [c, r] = k.split(',').map(Number);
        path.unshift({ col: c, row: r });
        k = parent.get(k)!;
      }
      return path;
    }

    for (const { dc, dr } of dirs) {
      const nc = curr.col + dc;
      const nr = curr.row + dr;
      const nk = key(nc, nr);
      const diagonal = dc !== 0 && dr !== 0;
      const cost = curr.cost + (diagonal ? Math.SQRT2 : 1);
      if (cost >= (costs.get(nk) ?? Infinity)) continue;
      if (!isWalkable(nc, nr, tileMap, blockedTiles)) continue;
      if (diagonal && !clearsTileCorners(curr.col, curr.row, nc, nr, tileMap, blockedTiles)) {
        continue;
      }

      costs.set(nk, cost);
      parent.set(nk, currKey);
      queue.push({ col: nc, row: nr, cost, estimate: cost + (diagonals ? estimate(nc, nr) : 0) });
    }
  }

  // No path found
  return [];
}
