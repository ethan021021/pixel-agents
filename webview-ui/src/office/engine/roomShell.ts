import { ROOM_COLORS } from '../../constants.js';
import { hslToRgb } from '../colorize.js';
import type { RoomPoint, RoomProjection } from '../roomProjection.js';
import {
  ROOM_GROUND_SCALE,
  ROOM_PLATFORM_DEPTH as PLATFORM_DEPTH,
  ROOM_WALL_HEIGHT as WALL_HEIGHT,
} from '../roomProjection.js';
import type { ColorValue, OfficeLayout } from '../types.js';
import { TILE_SIZE, TileType } from '../types.js';
import { furnitureCovers } from './visitorNavigation.js';

const LOW_WALL_HEIGHT = 5;
const HALF_WIDTH = TILE_SIZE * ROOM_GROUND_SCALE;
const HALF_HEIGHT = HALF_WIDTH / 2;

interface Wall {
  col: number;
  row: number;
  north: boolean;
  a: RoomPoint;
  b: RoomPoint;
  height: number;
}

type TileAt = (col: number, row: number) => TileType;

export function roomPolygon(
  ctx: CanvasRenderingContext2D,
  points: RoomPoint[],
  color: string,
): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Draw the cached room on its native pixel grid. Canvas paths would blend
 * the edge palette before it was enlarged to game scale. */
function pixelFace(ctx: CanvasRenderingContext2D, points: RoomPoint[], color: string): void {
  const top = Math.ceil(Math.min(...points.map(({ y }) => y)) - 0.5);
  const bottom = Math.ceil(Math.max(...points.map(({ y }) => y)) - 0.5);
  ctx.fillStyle = color;
  for (let y = top; y < bottom; y++) {
    const sample = y + 0.5;
    let left = Infinity;
    let right = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a.y > sample === b.y > sample) continue;
      const x = a.x + ((sample - a.y) / (b.y - a.y)) * (b.x - a.x);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    if (left < right) {
      const start = Math.ceil(left - 0.5);
      const end = Math.ceil(right - 0.5);
      ctx.fillRect(start, y, end - start, 1);
    }
  }
}

function line(ctx: CanvasRenderingContext2D, a: RoomPoint, b: RoomPoint, color: string): void {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ctx.fillRect(Math.round(a.x + (b.x - a.x) * t), Math.round(a.y + (b.y - a.y) * t), 1, 1);
  }
}

function floorPoint(top: RoomPoint, x: number, y: number, zoom = 1): RoomPoint {
  return {
    x: top.x + (x - y) * ROOM_GROUND_SCALE * zoom,
    y: top.y + ((x + y) * ROOM_GROUND_SCALE * zoom) / 2,
  };
}

function diamond(top: RoomPoint, zoom: number): RoomPoint[] {
  return [
    top,
    floorPoint(top, TILE_SIZE, 0, zoom),
    floorPoint(top, TILE_SIZE, TILE_SIZE, zoom),
    floorPoint(top, 0, TILE_SIZE, zoom),
  ];
}

function along(wall: Pick<Wall, 'a' | 'b'>, span: number, height: number): RoomPoint {
  return {
    x: wall.a.x + (wall.b.x - wall.a.x) * span,
    y: wall.a.y + (wall.b.y - wall.a.y) * span - height,
  };
}

function wallBand(
  ctx: CanvasRenderingContext2D,
  wall: Pick<Wall, 'a' | 'b'>,
  start: number,
  end: number,
  base: number,
  top: number,
  color: string,
): void {
  pixelFace(
    ctx,
    [
      along(wall, start, base),
      along(wall, end, base),
      along(wall, end, top),
      along(wall, start, top),
    ],
    color,
  );
}

function paintWall(ctx: CanvasRenderingContext2D, wall: Wall): void {
  const colors = wall.north ? ROOM_COLORS.lightWall : ROOM_COLORS.shadedWall;
  const { height } = wall;
  wallBand(ctx, wall, 0, 1, 0, height, colors.panel);
  wallBand(ctx, wall, 0, 1, 0, Math.min(11, height - 2), colors.wainscot);
  wallBand(ctx, wall, 0, 1, 0, 2, colors.skirting);
  wallBand(ctx, wall, 0, 1, Math.min(11, height - 2), Math.min(12, height - 1), colors.trim);
  wallBand(ctx, wall, 0, 1, height - 2, height, colors.cap);
  line(ctx, along(wall, 0, height), along(wall, 1, height), colors.edge);
}

function paintDoor(ctx: CanvasRenderingContext2D, wall: Wall): void {
  const { entry } = ROOM_COLORS;
  pixelFace(
    ctx,
    [
      along(wall, 0.3, 0),
      along(wall, 1.7, 0),
      along(wall, 1.7, 28),
      along(wall, 1.5, 33),
      along(wall, 0.5, 33),
      along(wall, 0.3, 28),
    ],
    entry.frame,
  );
  pixelFace(
    ctx,
    [
      along(wall, 0.42, 0),
      along(wall, 1.58, 0),
      along(wall, 1.58, 27),
      along(wall, 1.46, 30),
      along(wall, 0.54, 30),
      along(wall, 0.42, 27),
    ],
    entry.hall,
  );
  line(ctx, along(wall, 0.35, 0), along(wall, 0.35, 27), entry.liner);
  line(ctx, along(wall, 0.54, 31), along(wall, 1.49, 31), entry.liner);
  wallBand(ctx, wall, 1.38, 1.58, 0, 26, entry.inside);
  const a = along(wall, 0.35, 0);
  const b = along(wall, 1.65, 0);
  const offset = wall.north ? floorPoint({ x: 0, y: 0 }, 0, 5) : floorPoint({ x: 0, y: 0 }, 5, 0);
  const c = { x: b.x + offset.x, y: b.y + offset.y };
  const d = { x: a.x + offset.x, y: a.y + offset.y };
  pixelFace(ctx, [a, b, c, d], entry.threshold);
  wallBand(ctx, { a: d, b: c }, 0, 1, -1, 0, entry.sill);
}

function paintWindow(ctx: CanvasRenderingContext2D, wall: Wall): void {
  const { window } = ROOM_COLORS;
  wallBand(ctx, wall, 0.13, 1.87, 13, 34, window.casing);
  wallBand(ctx, wall, 0.22, 1.78, 14, 33, window.frame);
  wallBand(ctx, wall, 0.33, 1.67, 16, 31, window.daylight);
  wallBand(ctx, wall, 0.33, 1.67, 24, 31, window.sky);
  for (const [start, end, roof] of [
    [0.38, 0.61, 22],
    [0.65, 0.94, 19],
    [1.31, 1.58, 23],
  ]) {
    wallBand(ctx, wall, start, end, 16, roof, window.buildings);
  }
  wallBand(ctx, wall, 0.96, 1.04, 14, 33, window.frame);
  wallBand(ctx, wall, 0.05, 1.95, 12, 14, window.sill);
}

function paintWallFixtures(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  walls: Wall[],
  at: TileAt,
): void {
  const free = walls.filter(({ col, row, north, height }) => {
    if (height !== WALL_HEIGHT) return false;
    const x = col + (north ? 0 : 1);
    const y = row + (north ? 1 : 0);
    if (at(x, y) === TileType.WALL) return false;
    return !layout.furniture.some(
      (item) => furnitureCovers(item, col, row) || furnitureCovers(item, x, y),
    );
  });
  const wallPairs: Wall[] = [];
  for (const wall of free) {
    const next = free.find(
      ({ col, row, north }) =>
        wall.north === north &&
        col === wall.col + Number(north) &&
        row === wall.row + Number(!north),
    );
    if (next) wallPairs.push({ ...wall, b: next.b });
  }
  // Prefer the blank side wall. Keep existing artwork and floor routes clear.
  const door = wallPairs.filter(({ north }) => !north).at(-1) ?? wallPairs.at(-1);
  if (!door) return;
  paintDoor(ctx, door);
  const window = wallPairs.find(
    ({ col, row, north }) =>
      north === door.north && Math.abs(col - door.col) + Math.abs(row - door.row) >= 3,
  );
  if (window) paintWindow(ctx, window);
}

function carpetColor(color: ColorValue | undefined): string {
  if (!color) return ROOM_COLORS.rug;
  const channels = hslToRgb(color.h, color.s / 200, 0.46);
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function paintBoards(
  ctx: CanvasRenderingContext2D,
  point: RoomPoint,
  col: number,
  row: number,
  at: TileAt,
): void {
  for (const y of [0, TILE_SIZE / 2]) {
    line(ctx, floorPoint(point, 0, y), floorPoint(point, TILE_SIZE, y), ROOM_COLORS.woodSeam);
    const end = ((y * 5 + row * 7) % 10) + 3;
    if ((col + row + y / 4) % 3 === 0) {
      line(
        ctx,
        floorPoint(point, end, y),
        floorPoint(point, end, y + TILE_SIZE / 2),
        ROOM_COLORS.woodSeam,
      );
    }
    if ((col + row + y) % 4 === 0) {
      line(ctx, floorPoint(point, 3, y + 2), floorPoint(point, 10, y + 2), ROOM_COLORS.woodGlint);
    }
  }
  if (at(col - 1, row) !== TileType.FLOOR_7) {
    line(ctx, point, floorPoint(point, 0, TILE_SIZE), ROOM_COLORS.woodSeam);
  }
}

interface RoomShell {
  canvas: HTMLCanvasElement;
  origin: RoomPoint;
}

const shells = new WeakMap<OfficeLayout, RoomShell>();

function buildRoomShell(layout: OfficeLayout): RoomShell | null {
  const { cols, rows, tiles, carpetTiles } = layout;
  const canvas = document.createElement('canvas');
  const origin = { x: rows * HALF_WIDTH + 2, y: WALL_HEIGHT + 2 };
  canvas.width = (cols + rows) * HALF_WIDTH + 4;
  canvas.height = (cols + rows) * HALF_HEIGHT + origin.y + PLATFORM_DEPTH + 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const at: TileAt = (col, row) =>
    col >= 0 && col < cols && row >= 0 && row < rows ? tiles[row * cols + col] : TileType.VOID;
  const walls: Wall[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = at(col, row);
      if (tile === TileType.VOID) continue;
      const point = floorPoint(origin, col * TILE_SIZE, row * TILE_SIZE);
      const face = diamond(point, 1);
      const [, right, bottom, left] = face;
      const frontX = at(col + 1, row);
      const frontY = at(col, row + 1);
      if (frontX === TileType.VOID) {
        wallBand(ctx, { a: right, b: bottom }, 0, 1, -PLATFORM_DEPTH, 0, ROOM_COLORS.platformRight);
      }
      if (frontY === TileType.VOID) {
        wallBand(ctx, { a: left, b: bottom }, 0, 1, -PLATFORM_DEPTH, 0, ROOM_COLORS.platformLeft);
      }

      const rug = carpetTiles?.[row * cols + col];
      const floor = ROOM_COLORS.floor[tile - 1]?.[(row + col) % 2] ?? ROOM_COLORS.floorFallback;
      pixelFace(
        ctx,
        face,
        tile === TileType.WALL ? ROOM_COLORS.wallBase : rug ? carpetColor(rug.color) : floor,
      );
      if (tile === TileType.FLOOR_7 && !rug) {
        paintBoards(ctx, point, col, row, at);
      } else if (tile === TileType.FLOOR_1 && !rug) {
        // Join neighboring teal tiles into a broad woven area, with binding
        // on the outer edge instead of a heavy seam between each tile.
        if (at(col, row - 1) !== tile) line(ctx, point, right, ROOM_COLORS.tealSeam);
        if (frontX !== tile) line(ctx, right, bottom, ROOM_COLORS.tealSeam);
        if (frontY !== tile) line(ctx, left, bottom, ROOM_COLORS.tealSeam);
        if (at(col - 1, row) !== tile) line(ctx, point, left, ROOM_COLORS.tealSeam);
      } else if (tile !== TileType.WALL && !rug) {
        line(ctx, point, right, ROOM_COLORS.floorSeam);
        line(ctx, point, left, ROOM_COLORS.floorSeam);
      }

      if (tile !== TileType.WALL) continue;
      const north = at(col, row - 1) === TileType.VOID && frontY !== TileType.VOID;
      const west = at(col - 1, row) === TileType.VOID && frontX !== TileType.VOID;
      if (north) walls.push({ col, row, north: true, a: point, b: right, height: WALL_HEIGHT });
      if (west) walls.push({ col, row, north: false, a: point, b: left, height: WALL_HEIGHT });
      if (!north && !west) {
        const vertical = at(col, row - 1) === TileType.WALL || frontY === TileType.WALL;
        walls.push({
          col,
          row,
          north: !vertical,
          a: point,
          b: vertical ? left : right,
          height: LOW_WALL_HEIGHT,
        });
      }
    }
  }
  for (const wall of walls) paintWall(ctx, wall);
  paintWallFixtures(ctx, layout, walls, at);
  return { canvas, origin };
}

/** Bake the plaster, floorboards and trim at the same pixel scale as the sprites. */
export function drawRoomShell(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  projection: RoomProjection,
  zoom: number,
  hovered: { col: number; row: number } | null,
): void {
  const shell = shells.get(layout) ?? buildRoomShell(layout);
  if (!shell) return;
  shells.set(layout, shell);
  const start = projection.toScreen(0, 0);
  ctx.drawImage(
    shell.canvas,
    Math.round(start.x - shell.origin.x * zoom),
    Math.round(start.y - shell.origin.y * zoom),
    shell.canvas.width * zoom,
    shell.canvas.height * zoom,
  );
  if (hovered) {
    const top = projection.toScreen(hovered.col * TILE_SIZE, hovered.row * TILE_SIZE);
    roomPolygon(ctx, diamond(top, zoom), ROOM_COLORS.hoverFill);
    ctx.lineWidth = Math.max(1, Math.floor(zoom / 2));
    ctx.strokeStyle = ROOM_COLORS.hoverBorder;
    ctx.stroke();
  }
}

/** Keep the destination visible after the pointer leaves the chosen tile. */
export function drawRoomTarget(
  ctx: CanvasRenderingContext2D,
  projection: RoomProjection,
  zoom: number,
  tile: { col: number; row: number },
): void {
  const top = projection.toScreen(tile.col * TILE_SIZE, tile.row * TILE_SIZE);
  roomPolygon(
    ctx,
    [
      floorPoint(top, 2, 2, zoom),
      floorPoint(top, 14, 2, zoom),
      floorPoint(top, 14, 14, zoom),
      floorPoint(top, 2, 14, zoom),
    ],
    ROOM_COLORS.destinationFill,
  );
  ctx.strokeStyle = ROOM_COLORS.destinationBorder;
  ctx.lineWidth = Math.max(1, Math.floor(zoom / 2));
  ctx.stroke();
}
