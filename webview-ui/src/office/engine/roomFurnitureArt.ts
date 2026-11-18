import { ROOM_COLORS } from '../../constants.js';
import { adjustSprite, colorizeSprite } from '../colorize.js';
import { getCatalogEntry } from '../layout/furnitureCatalog.js';
import type { RoomModel, RoomModelInput, RoomSeatSurface } from '../roomModel.js';
import type { RoomPoint, RoomProjection } from '../roomProjection.js';
import { roomFurnitureBounds, roomProjection } from '../roomProjection.js';
import type { FurnitureInstance, OfficeLayout, SpriteData } from '../types.js';
import { TILE_SIZE, TileType } from '../types.js';
import type { OfficeState } from './officeState.js';
import { roomAccessoryModel } from './roomAccessoryModels.js';
import { roomSeatingModel } from './roomSeatingModels.js';

interface RoomSprite {
  pixels: SpriteData;
  left: number;
  top: number;
  footprint?: { left: number; top: number; right: number; bottom: number };
  seating?: { anchors: readonly RoomSeatSurface[]; foreground?: RoomSprite };
}

interface RoomFurnitureArt {
  furniture: FurnitureInstance;
  pixels: SpriteData;
  mirror?: boolean;
  surfaceHeight?: number;
  model?: { sprite: RoomSprite; x: number; y: number; depthX: number; depthY: number };
}

export interface RoomSeatArt extends RoomSeatSurface {
  chair: RoomFurnitureArt;
}

interface Face {
  corners: RoomPoint[];
  color: string;
}

const localProjection = roomProjection(0, 0, 0, 0, 1, 0, 0);
const sprites = new Map<string, RoomSprite>();
const SPRITE_CACHE_SIZE = 256;

/** Rasterize the original cuboids once, with crisp edges at every room zoom. */
function rasterize(model: RoomModel): RoomSprite {
  const faces: Face[] = [];
  for (const { x, y, z, width, depth, height, colors } of model.boxes) {
    const a = localProjection.toScreen(x, y);
    const b = localProjection.toScreen(x + width, y);
    const c = localProjection.toScreen(x + width, y + depth);
    const d = localProjection.toScreen(x, y + depth);
    const lift = (p: RoomPoint, amount: number) => ({ x: p.x, y: p.y - amount });
    const top = [a, b, c, d].map((p) => lift(p, z + height));
    faces.push(
      { corners: top, color: colors[0] },
      { corners: [top[2], top[1], lift(b, z), lift(c, z)], color: colors[1] },
      { corners: [top[3], top[2], lift(c, z), lift(d, z)], color: colors[2] },
    );
  }
  const corners = faces.flatMap((face) => face.corners);
  const left = Math.floor(Math.min(...corners.map((p) => p.x))) - 1;
  const top = Math.floor(Math.min(...corners.map((p) => p.y))) - 1;
  const right = Math.ceil(Math.max(...corners.map((p) => p.x))) + 1;
  const bottom = Math.ceil(Math.max(...corners.map((p) => p.y))) + 1;
  const pixels = Array.from({ length: bottom - top }, () =>
    new Array<string>(right - left).fill(''),
  );

  for (const face of faces) {
    const xs = face.corners.map((p) => p.x);
    const ys = face.corners.map((p) => p.y);
    const maxY = Math.ceil(Math.max(...ys));
    const maxX = Math.ceil(Math.max(...xs));
    for (let y = Math.floor(Math.min(...ys)); y < maxY; y++) {
      for (let x = Math.floor(Math.min(...xs)); x < maxX; x++) {
        const inside = face.corners.every((a, i) => {
          const b = face.corners[(i + 1) % 4];
          return (b.x - a.x) * (y + 0.5 - a.y) - (b.y - a.y) * (x + 0.5 - a.x) >= -1e-6;
        });
        if (inside) pixels[y - top][x - left] = face.color;
      }
    }
  }

  const ground = model.boxes.filter(({ z }) => z === 0);
  const footprint = ground.length
    ? {
        left: Math.min(...ground.map((box) => box.x)),
        top: Math.min(...ground.map((box) => box.y)),
        right: Math.max(...ground.map((box) => box.x + box.width)),
        bottom: Math.max(...ground.map((box) => box.y + box.depth)),
      }
    : undefined;
  const seating = model.seating && {
    anchors: model.seating.anchors,
    foreground: model.seating.foreground.length
      ? rasterize({ boxes: model.seating.foreground })
      : undefined,
  };
  return {
    left,
    top,
    footprint,
    seating,
    pixels: pixels.map((row, y) =>
      row.map(
        (pixel, x) =>
          pixel ||
          (row[x - 1] || row[x + 1] || pixels[y - 1]?.[x] || pixels[y + 1]?.[x]
            ? ROOM_COLORS.furnitureOutline
            : ''),
      ),
    ),
  };
}

interface Mount {
  col: number;
  row: number;
  alongX: boolean;
}

function wallMount(
  layout: OfficeLayout,
  col: number,
  row: number,
  width: number,
  depth: number,
): Mount | null {
  const at = (x: number, y: number) =>
    x >= 0 && x < layout.cols && y >= 0 && y < layout.rows
      ? layout.tiles[y * layout.cols + x]
      : TileType.VOID;
  // The editor anchors wall furniture by the last row of its footprint.
  const y = row + depth - 1;
  for (let x = col; x < col + width; x++) {
    if (at(x, y) !== TileType.WALL) continue;
    const north = at(x, y - 1) === TileType.VOID && at(x, y + 1) !== TileType.VOID;
    const west = at(x - 1, y) === TileType.VOID && at(x + 1, y) !== TileType.VOID;
    if (north || west) return { col: north ? col : x, row: y, alongX: north };
  }
  return null;
}

const officeArt = new WeakMap<FurnitureInstance[], RoomFurnitureArt[]>();

/** The layout still owns furniture placement, workstation state, and seats. */
export function roomFurnitureArt(
  instances: FurnitureInstance[],
  layout: OfficeLayout,
): RoomFurnitureArt[] {
  const cached = officeArt.get(instances);
  if (cached) return cached;
  const placements = new Map(layout.furniture.map((item) => [item.uid, item]));
  const items = instances.map((furniture) => {
    const placement = furniture.uid === undefined ? undefined : placements.get(furniture.uid);
    const type = furniture.type ?? placement?.type;
    const entry = type ? getCatalogEntry(type) : undefined;
    const input = entry && {
      type: entry.type,
      width: entry.footprintW * TILE_SIZE,
      depth: entry.footprintH * TILE_SIZE,
      backgroundRows: entry.backgroundTiles ?? 0,
      orientation: entry.orientation,
      surfaceHeight: 0,
      wallAlongX: true,
    };
    return {
      furniture,
      placement,
      entry,
      input,
      seating: input && roomSeatingModel(input),
    };
  });
  const surfaces = new Map<
    string,
    { z: number; x: number; y: number; depthX: number; depthY: number }
  >();
  for (const { seating, input, placement, furniture } of items) {
    if (!seating?.surfaceHeight || !placement || !input) continue;
    const surface = {
      z: seating.surfaceHeight,
      x: furniture.x,
      y: furniture.y,
      depthX: furniture.x + input.width / 2,
      depthY: furniture.y + input.depth,
    };
    for (let row = input.backgroundRows; row < input.depth / TILE_SIZE; row++) {
      for (let col = 0; col < input.width / TILE_SIZE; col++) {
        surfaces.set(`${placement.col + col},${placement.row + row}`, surface);
      }
    }
  }

  const art = items.map(({ furniture, placement, entry, input, seating }): RoomFurnitureArt => {
    const fallback = { furniture, pixels: furniture.sprite, mirror: furniture.mirrored };
    if (!input || !entry || !placement) return fallback;
    const surface = entry.canPlaceOnSurfaces
      ? surfaces.get(`${placement.col},${placement.row + input.backgroundRows}`)
      : undefined;
    const mount =
      entry.canPlaceOnWalls && !surface
        ? wallMount(layout, placement.col, placement.row, entry.footprintW, entry.footprintH)
        : null;
    const x = mount ? mount.col * TILE_SIZE : furniture.x;
    const y = mount ? mount.row * TILE_SIZE : furniture.y;
    const modelInput: RoomModelInput = {
      ...input,
      surfaceHeight: surface?.z ?? 0,
      wallAlongX: mount?.alongX ?? true,
    };
    if (!mount && !surface && entry.category === 'wall') return fallback;

    const key = JSON.stringify([modelInput, placement.color]);
    let sprite = sprites.get(key);
    if (!sprite) {
      const model = seating ?? roomAccessoryModel(modelInput);
      if (!model) return fallback;
      sprite = rasterize(model);
      if (placement.color) {
        const tint = placement.color.colorize ? colorizeSprite : adjustSprite;
        sprite.pixels = tint(sprite.pixels, placement.color);
        const front = sprite.seating?.foreground;
        if (front) front.pixels = tint(front.pixels, placement.color);
      }
      if (sprites.size >= SPRITE_CACHE_SIZE) sprites.clear();
      sprites.set(key, sprite);
    }

    const width = mount?.alongX === false ? 0 : input.width;
    const front = entry.category === 'chairs' ? furniture.zY - y : input.depth;
    // Props draw just in front of their supporting surface, with the closer
    // diagonals on top when two props on the same table overlap.
    const aboveSurface = surface
      ? 0.5 + (furniture.x - surface.x + furniture.y - surface.y) / (TILE_SIZE * 8)
      : 0;
    return {
      furniture,
      pixels: sprite.pixels,
      surfaceHeight: seating?.surfaceHeight,
      model: {
        sprite,
        x,
        y,
        depthX: surface?.depthX ?? x + width / 2,
        depthY: surface
          ? surface.depthY + aboveSurface
          : mount
            ? y + (mount.alongX ? 0 : input.width / 2) - TILE_SIZE / 2
            : y + front,
      },
    };
  });
  officeArt.set(instances, art);
  return art;
}

const seatArt = new WeakMap<RoomFurnitureArt[], Map<string, RoomSeatArt>>();

/** The model anchors are in the same tile order as layoutToSeats. */
export function roomSeatArt(office: OfficeState, uid: string | null): RoomSeatArt | undefined {
  if (!uid) return;
  const chairs = roomFurnitureArt(office.furniture, office.getLayout());
  let seats = seatArt.get(chairs);
  if (!seats) {
    const positions = new Map<string, RoomSeatArt>();
    for (const chair of chairs) {
      const { model, furniture } = chair;
      const uid = furniture.uid;
      if (!model || uid === undefined) continue;
      const anchors = model.sprite.seating?.anchors;
      anchors?.forEach(({ x, y, z }, index) => {
        positions.set(index ? `${uid}:${index}` : uid, {
          x: model.x + x,
          y: model.y + y,
          z,
          chair,
        });
      });
    }
    seatArt.set(chairs, positions);
    seats = positions;
  }
  return seats.get(uid);
}

export function roomFurnitureSpriteBounds(
  art: RoomFurnitureArt,
  projection: Pick<RoomProjection, 'toScreen'>,
  zoom: number,
  sprite = art.model?.sprite,
): { x: number; y: number; width: number; depth: number } {
  const model = art.model;
  if (!model || !sprite) return roomFurnitureBounds(art.furniture, projection, zoom);
  const anchor = projection.toScreen(model.x, model.y);
  return {
    x: Math.round(anchor.x + sprite.left * zoom),
    y: Math.round(anchor.y + sprite.top * zoom),
    width: Math.floor(sprite.pixels[0].length * zoom),
    depth: projection.toScreen(model.depthX, model.depthY).y,
  };
}
