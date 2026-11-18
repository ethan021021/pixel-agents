import { ROOM_COLORS } from '../../constants.js';
import { hslToRgb } from '../colorize.js';
import type { RoomPoint, RoomProjection } from '../roomProjection.js';
import { ROOM_GROUND_SCALE } from '../roomProjection.js';
import type { ColorValue, OfficeLayout } from '../types.js';
import { TILE_SIZE, TileType } from '../types.js';
import { furnitureCovers } from './visitorNavigation.js';

const WALL_HEIGHT = 42;
const LOW_WALL_HEIGHT = 8;
const PLATFORM_DEPTH = 4;
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

function line(ctx: CanvasRenderingContext2D, a: RoomPoint, b: RoomPoint, color: string): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = color;
  ctx.stroke();
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
  roomPolygon(
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
  roomPolygon(
    ctx,
    [
      along(wall, 0.16, 0),
      along(wall, 1.84, 0),
      along(wall, 1.84, 27),
      along(wall, 1.55, 33),
      along(wall, 0.45, 33),
      along(wall, 0.16, 27),
    ],
    entry.frame,
  );
  roomPolygon(
    ctx,
    [
      along(wall, 0.31, 0),
      along(wall, 1.69, 0),
      along(wall, 1.69, 26),
      along(wall, 1.46, 30),
      along(wall, 0.54, 30),
      along(wall, 0.31, 26),
    ],
    entry.hall,
  );
  line(ctx, along(wall, 0.23, 0), along(wall, 0.23, 27), entry.liner);
  line(ctx, along(wall, 0.54, 31), along(wall, 1.49, 31), entry.liner);
  wallBand(ctx, wall, 1.44, 1.69, 0, 25, entry.inside);
  const a = along(wall, 0.24, 0);
  const b = along(wall, 1.76, 0);
  const offset = wall.north ? floorPoint({ x: 0, y: 0 }, 0, 5) : floorPoint({ x: 0, y: 0 }, 5, 0);
  const c = { x: b.x + offset.x, y: b.y + offset.y };
  const d = { x: a.x + offset.x, y: a.y + offset.y };
  roomPolygon(ctx, [a, b, c, d], entry.threshold);
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
  for (const y of [0, 5, 11]) {
    line(ctx, floorPoint(point, 0, y), floorPoint(point, TILE_SIZE, y), ROOM_COLORS.floorSeam);
    if ((col + row + y) % 3 !== 0) {
      line(ctx, floorPoint(point, 2, y + 1), floorPoint(point, 12, y + 1), ROOM_COLORS.woodGrain);
    }
    const end = ((y * 5 + row * 7) % 12) + 2;
    if ((col + y) % 2 === 0) {
      line(
        ctx,
        floorPoint(point, end, y),
        floorPoint(point, end, Math.min(y + 5, TILE_SIZE)),
        ROOM_COLORS.floorSeam,
      );
    }
  }
  if (at(col - 1, row) !== TileType.FLOOR_7) {
    line(ctx, point, floorPoint(point, 0, TILE_SIZE), ROOM_COLORS.floorSeam);
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
      roomPolygon(
        ctx,
        face,
        tile === TileType.WALL ? ROOM_COLORS.wallBase : rug ? carpetColor(rug.color) : floor,
      );
      if (tile === TileType.FLOOR_7 && !rug) paintBoards(ctx, point, col, row, at);
      else {
        ctx.strokeStyle = ROOM_COLORS.floorSeam;
        ctx.stroke();
        if (tile === TileType.FLOOR_1 && !rug) {
          line(ctx, floorPoint(point, 2, 2), floorPoint(point, 14, 2), ROOM_COLORS.floorGlint);
        }
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
  // The room's outside edge uses full pixels, like the furniture silhouettes.
  const shell = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < shell.data.length; i += 4) {
    shell.data[i] = shell.data[i] >= 128 ? 255 : 0;
  }
  ctx.putImageData(shell, 0, 0);
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
