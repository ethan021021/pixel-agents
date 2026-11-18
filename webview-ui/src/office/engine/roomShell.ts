import { ROOM_COLORS } from '../../constants.js';
import { colorizeSprite } from '../colorize.js';
import type { RoomPoint, RoomProjection } from '../roomProjection.js';
import {
  ROOM_GROUND_SCALE,
  ROOM_NATIVE_SCALE,
  ROOM_PLATFORM_DEPTH as PLATFORM_DEPTH,
  ROOM_WALL_HEIGHT as WALL_HEIGHT,
} from '../roomProjection.js';
import { roomFaceSpans } from '../roomRaster.js';
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
  tint?: ColorValue;
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

interface ShellInk {
  ctx: CanvasRenderingContext2D;
  density: number;
}

/** Floor, trim and furniture share the same raster grid. Layout coordinates
 * stay in world units until a face or one-pixel line is painted. */
function pixelFace({ ctx, density }: ShellInk, points: RoomPoint[], color: string): void {
  const native = points.map(({ x, y }) => ({ x: x * density, y: y * density }));
  ctx.fillStyle = color;
  roomFaceSpans(native, (y, left, right) => ctx.fillRect(left, y, right - left, 1));
}

function line({ ctx, density }: ShellInk, a: RoomPoint, b: RoomPoint, color: string): void {
  const x = Math.round(a.x * density);
  const y = Math.round(a.y * density);
  const dx = Math.round(b.x * density) - x;
  const dy = Math.round(b.y * density) - y;
  const steps = Math.max(1, Math.abs(dx), Math.abs(dy));
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    ctx.fillRect(x + Math.round((dx * i) / steps), y + Math.round((dy * i) / steps), 1, 1);
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
  ctx: ShellInk,
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

function paintWall(ctx: ShellInk, wall: Wall, palette: ShellPalette): void {
  const colors = wall.north ? ROOM_COLORS.lightWall : ROOM_COLORS.shadedWall;
  const { height } = wall;
  const paint = (color: string) => palette.tinted(color, wall.tint);
  wallBand(ctx, wall, 0, 1, 0, height, paint(colors.panel));
  const dado = Math.min(7, height - 1);
  wallBand(ctx, wall, 0, 1, 0, dado, paint(colors.wainscot));
  wallBand(ctx, wall, 0, 1, 0, 1.5, colors.skirting);
  wallBand(ctx, wall, 0, 1, dado - 1, dado, paint(colors.trim));
  line(ctx, along(wall, 0, 0), along(wall, 1, 0), colors.edge);
  if (height === LOW_WALL_HEIGHT) return;
  wallBand(ctx, wall, 0, 1, height - 1.25, height, paint(colors.cap));
  line(ctx, along(wall, 0, height), along(wall, 1, height), colors.edge);
}

function paintDoor(ctx: ShellInk, wall: Wall): void {
  const { entry } = ROOM_COLORS;
  // The two-tile wall segment contains a single threshold, with a reveal
  // on its far jamb. The near jamb and lintel catch the room light.
  wallBand(ctx, wall, 0.14, 0.88, 0, 36, entry.frame);
  wallBand(ctx, wall, 0.17, 0.85, 0, 35, entry.liner);
  wallBand(ctx, wall, 0.21, 0.82, 0, 33.5, entry.inside);
  wallBand(ctx, wall, 0.23, 0.74, 0, 32.5, entry.hall);
  line(ctx, along(wall, 0.23, 32.5), along(wall, 0.74, 32.5), entry.frame);
  const a = along(wall, 0.15, 0);
  const b = along(wall, 0.87, 0);
  const offset = wall.north ? floorPoint({ x: 0, y: 0 }, 0, 3) : floorPoint({ x: 0, y: 0 }, 3, 0);
  const c = { x: b.x + offset.x, y: b.y + offset.y };
  const d = { x: a.x + offset.x, y: a.y + offset.y };
  pixelFace(ctx, [a, b, c, d], entry.threshold);
  wallBand(ctx, { a: d, b: c }, 0, 1, -0.75, 0, entry.sill);
}

function paintWindow(ctx: ShellInk, wall: Wall): void {
  const { window } = ROOM_COLORS;
  wallBand(ctx, wall, 0.02, 1.12, 11, 35, window.casing);
  wallBand(ctx, wall, 0.05, 1.09, 12, 34, window.frame);
  wallBand(ctx, wall, 0.11, 1.03, 13.5, 32.5, window.sky);
  wallBand(ctx, wall, 0.11, 1.03, 13.5, 21, window.daylight);
  for (const [start, end, roof] of [
    [0.11, 0.24, 18.5],
    [0.24, 0.38, 16],
    [0.39, 0.5, 19.5],
    [0.69, 0.78, 17],
    [0.8, 0.95, 18.5],
    [0.95, 1.03, 16],
  ])
    wallBand(ctx, wall, start, end, 13.5, roof, window.buildings);
  for (const x of [0.17, 0.43, 0.88])
    wallBand(ctx, wall, x, x + 0.025, 15.5, 16.4, window.daylight);
  wallBand(ctx, wall, 0.55, 0.59, 13, 33, window.frame);
  wallBand(ctx, wall, 0.11, 1.03, 26.5, 27, window.frame);
  wallBand(ctx, wall, -0.03, 1.17, 10.5, 12, window.sill);
  line(ctx, along(wall, -0.03, 12), along(wall, 1.17, 12), window.frame);
}

function paintWallFixtures(ctx: ShellInk, layout: OfficeLayout, walls: Wall[], at: TileAt): void {
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

/** The shipped layout's swatches identify the authored office materials.
 * Repainting one in the editor tints the same material, grain and highlights. */
const defaultMaterialSwatches = new Map<number, string>([
  [TileType.WALL, '214:30:-100:-55'],
  [TileType.FLOOR_1, '209:39:-25:-80'],
  [TileType.FLOOR_7, '25:48:-43:-88'],
  [TileType.FLOOR_9, '209:0:-16:-8'],
]);

const swatchKey = ({ h, s, b, c }: ColorValue) => `${h}:${s}:${b}:${c}`;

class ShellPalette {
  private colors = new Map<string, string>();

  tinted(color: string, tint?: ColorValue): string {
    if (!tint) return color;
    const key = color + swatchKey(tint);
    let result = this.colors.get(key);
    if (!result) {
      result = colorizeSprite([[color]], tint)[0][0];
      this.colors.set(key, result);
    }
    return result;
  }
}

function paintBoards(
  ctx: ShellInk,
  point: RoomPoint,
  col: number,
  row: number,
  at: TileAt,
  seam: string,
  glint: string,
): void {
  for (const y of [0, TILE_SIZE / 2]) {
    line(ctx, floorPoint(point, 0, y), floorPoint(point, TILE_SIZE, y), seam);
    if ((col + 2 * row + y / 8) % 3 === 0) {
      line(ctx, floorPoint(point, 8, y), floorPoint(point, 8, y + TILE_SIZE / 2), seam);
    }
    if ((col + row + y / 8) % 3 === 1) {
      line(ctx, floorPoint(point, 3, y + 2), floorPoint(point, 11, y + 2), glint);
    }
  }
  if (at(col - 1, row) !== TileType.FLOOR_7) {
    line(ctx, point, floorPoint(point, 0, TILE_SIZE), seam);
  }
}

interface RoomShell {
  canvas: HTMLCanvasElement;
  origin: RoomPoint;
  density: number;
}

// The layout editor retains undo history. Keep only the image currently being drawn.
let cachedShell: { layout: OfficeLayout; shell: RoomShell } | null = null;

function buildRoomShell(layout: OfficeLayout): RoomShell | null {
  const { cols, rows, tiles, carpetTiles } = layout;
  const canvas = document.createElement('canvas');
  const origin = { x: rows * HALF_WIDTH + 2, y: WALL_HEIGHT + 2 };
  const width = (cols + rows) * HALF_WIDTH + 4;
  const height = (cols + rows) * HALF_HEIGHT + origin.y + PLATFORM_DEPTH + 2;
  // A sprawling imported room may exceed the host's canvas limits. Reduce
  // to a coarser integer tile lattice only when the native cache would be too large.
  let density = ROOM_NATIVE_SCALE;
  while (
    Math.ceil(width * density) > 4096 ||
    Math.ceil(height * density) > 4096 ||
    Math.ceil(width * density) * Math.ceil(height * density) > 8 * 1024 * 1024
  )
    density /= 2;
  canvas.width = Math.ceil(width * density);
  canvas.height = Math.ceil(height * density);
  const context = canvas.getContext('2d');
  if (!context) return null;
  const ctx = { ctx: context, density };
  const palette = new ShellPalette();
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
        const edge = { a: right, b: bottom };
        wallBand(ctx, edge, 0, 1, -PLATFORM_DEPTH, 0, ROOM_COLORS.platformRight);
        line(
          ctx,
          along(edge, 0, -PLATFORM_DEPTH),
          along(edge, 1, -PLATFORM_DEPTH),
          ROOM_COLORS.platformEdge,
        );
      }
      if (frontY === TileType.VOID) {
        const edge = { a: left, b: bottom };
        wallBand(ctx, edge, 0, 1, -PLATFORM_DEPTH, 0, ROOM_COLORS.platformLeft);
        line(
          ctx,
          along(edge, 0, -PLATFORM_DEPTH),
          along(edge, 1, -PLATFORM_DEPTH),
          ROOM_COLORS.platformEdge,
        );
      }

      const swatch = layout.tileColors?.[row * cols + col];
      const tint =
        swatch && swatchKey(swatch) !== defaultMaterialSwatches.get(tile) ? swatch : undefined;
      const rug = carpetTiles?.[row * cols + col];
      const floor = ROOM_COLORS.floor[tile - 1]?.[(row + col) % 2] ?? ROOM_COLORS.floorFallback;
      pixelFace(
        ctx,
        face,
        rug
          ? palette.tinted(ROOM_COLORS.rug, rug.color)
          : palette.tinted(tile === TileType.WALL ? ROOM_COLORS.wallBase : floor, tint),
      );
      if (tile === TileType.FLOOR_7 && !rug) {
        paintBoards(
          ctx,
          point,
          col,
          row,
          at,
          palette.tinted(ROOM_COLORS.woodSeam, tint),
          palette.tinted(ROOM_COLORS.woodGlint, tint),
        );
      } else if (tile === TileType.FLOOR_1 && !rug) {
        // Quiet field seams keep the walking grid visible within the carpet.
        const thread = palette.tinted(ROOM_COLORS.tealThread, tint);
        const bound = palette.tinted(ROOM_COLORS.tealSeam, tint);
        line(ctx, point, right, thread);
        line(ctx, point, left, thread);
        if (at(col, row - 1) !== tile) line(ctx, point, right, bound);
        if (frontX !== tile) line(ctx, right, bottom, bound);
        if (frontY !== tile) line(ctx, left, bottom, bound);
        if (at(col - 1, row) !== tile) line(ctx, point, left, bound);
      } else if (tile !== TileType.WALL && !rug) {
        line(ctx, point, right, palette.tinted(ROOM_COLORS.floorSeam, tint));
        line(ctx, point, left, palette.tinted(ROOM_COLORS.floorSeam, tint));
      }

      if (tile !== TileType.WALL) continue;
      const north = at(col, row - 1) === TileType.VOID && frontY !== TileType.VOID;
      const west = at(col - 1, row) === TileType.VOID && frontX !== TileType.VOID;
      if (north)
        walls.push({ col, row, north: true, tint, a: point, b: right, height: WALL_HEIGHT });
      if (west)
        walls.push({ col, row, north: false, tint, a: point, b: left, height: WALL_HEIGHT });
      if (!north && !west) {
        const vertical = at(col, row - 1) === TileType.WALL || frontY === TileType.WALL;
        walls.push({
          col,
          row,
          north: !vertical,
          tint,
          a: point,
          b: vertical ? left : right,
          height: LOW_WALL_HEIGHT,
        });
      }
    }
  }
  for (const wall of walls) paintWall(ctx, wall, palette);
  paintWallFixtures(ctx, layout, walls, at);
  return { canvas, origin, density };
}

/** Bake the plaster, floorboards and trim at the same pixel scale as the sprites. */
export function drawRoomShell(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  projection: RoomProjection,
  zoom: number,
  hovered: { col: number; row: number } | null,
): void {
  const shell = cachedShell?.layout === layout ? cachedShell.shell : buildRoomShell(layout);
  if (!shell) return;
  if (cachedShell?.shell !== shell) cachedShell = { layout, shell };
  const start = projection.toScreen(0, 0);
  ctx.drawImage(
    shell.canvas,
    Math.round(start.x - shell.origin.x * zoom),
    Math.round(start.y - shell.origin.y * zoom),
    (shell.canvas.width * zoom) / shell.density,
    (shell.canvas.height * zoom) / shell.density,
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
