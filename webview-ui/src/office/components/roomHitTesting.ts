import { GREETER_ID, PET_HIT_HALF_WIDTH, PET_HIT_HEIGHT } from '../../constants.js';
import type { OfficeState } from '../engine/officeState.js';
import { roomCharacterFrame } from '../engine/roomCharacterFrame.js';
import {
  roomFurnitureArt,
  roomFurnitureSpriteBounds,
  roomSeatArt,
} from '../engine/roomFurnitureArt.js';
import { getCatalogEntry } from '../layout/furnitureCatalog.js';
import type { RoomProjection } from '../roomProjection.js';
import type { FurnitureInstance, Seat, SpriteData } from '../types.js';
import { TILE_SIZE } from '../types.js';

/** Use the same projected sprites and depth order as the room renderer. */
export function roomActorAt(
  office: OfficeState,
  projection: RoomProjection,
  zoom: number,
  x: number,
  y: number,
): {
  agentId: number | null;
  petId: string | null;
  furniture: FurnitureInstance | null;
  surfaceHeight: number;
} {
  const surface = roomFurnitureAt(office, projection, zoom, x, y);
  let depth = surface?.depth ?? -Infinity;
  let agentId: number | null = null;
  let petId: string | null = null;
  for (const ch of office.getCharacters()) {
    if (ch.id === GREETER_ID || ch.matrixEffect === 'despawn') continue;
    const frame = roomCharacterFrame(ch, projection, zoom, roomSeatArt(office, ch.seatId));
    if (frame.depth < depth || !pickPixel(frame.pixels, frame, zoom, x, y)) continue;
    const chair = frame.cushion?.chair;
    const front = chair?.model?.sprite.seating?.foreground;
    if (chair && front) {
      const bounds = roomFurnitureSpriteBounds(chair, projection, zoom, front);
      if (pickPixel(front.pixels, bounds, zoom, x, y)) continue;
    }
    depth = frame.depth;
    agentId = ch.id;
  }
  for (const pet of office.getPets()) {
    const foot = projection.toScreen(pet.x, pet.y);
    const spriteDepth = projection.toScreen(pet.x, pet.y + TILE_SIZE / 2).y;
    if (
      spriteDepth >= depth &&
      Math.abs(x - foot.x) <= PET_HIT_HALF_WIDTH * zoom &&
      y >= foot.y - PET_HIT_HEIGHT * zoom &&
      y <= foot.y
    ) {
      depth = spriteDepth;
      agentId = null;
      petId = pet.id;
    }
  }
  return {
    agentId,
    petId,
    furniture: surface?.furniture ?? null,
    surfaceHeight: surface?.surfaceHeight ?? 0,
  };
}

function pickPixel(
  pixels: SpriteData,
  origin: { x: number; y: number },
  zoom: number,
  x: number,
  y: number,
  mirror = false,
): boolean {
  const col = Math.floor((x - origin.x) / zoom);
  const row = Math.floor((y - origin.y) / zoom);
  return !!pixels[row]?.[mirror ? pixels[0].length - 1 - col : col];
}

/** A click on a furniture sprite's face can sit above its floor tile. */
function roomFurnitureAt(
  office: OfficeState,
  projection: RoomProjection,
  zoom: number,
  x: number,
  y: number,
): { furniture: FurnitureInstance; depth: number; surfaceHeight: number } | null {
  let hit: ReturnType<typeof roomFurnitureAt> = null;
  for (const art of roomFurnitureArt(office.furniture, office.getLayout())) {
    const bounds = roomFurnitureSpriteBounds(art, projection, zoom);
    if (hit && bounds.depth < hit.depth) continue;
    if (!pickPixel(art.pixels, bounds, zoom, x, y, art.mirror)) continue;
    hit = { furniture: art.furniture, depth: bounds.depth, surfaceHeight: art.surfaceHeight ?? 0 };
  }
  return hit;
}

export function roomSeatAt(
  office: OfficeState,
  furniture: FurnitureInstance,
  projection: RoomProjection,
  x: number,
  y: number,
  zoom = 1,
): Seat | null {
  const item = office.getLayout().furniture.find(({ uid }) => uid === furniture.uid);
  const entry = item && getCatalogEntry(item.type);
  if (!item || entry?.category !== 'chairs') return null;
  let closest: Seat | null = null;
  let distance = Infinity;
  for (const seat of office.seats.values()) {
    if (seat.assigned || (seat.uid !== item.uid && !seat.uid.startsWith(`${item.uid}:`))) continue;
    if (
      seat.seatCol < item.col ||
      seat.seatCol >= item.col + entry.footprintW ||
      seat.seatRow < item.row ||
      seat.seatRow >= item.row + entry.footprintH
    )
      continue;
    const cushion = roomSeatArt(office, seat.uid);
    const point = projection.toScreen(
      cushion?.x ?? (seat.seatCol + 0.5) * TILE_SIZE,
      cushion?.y ?? (seat.seatRow + 0.5) * TILE_SIZE,
    );
    const score = (point.x - x) ** 2 + (point.y - (cushion?.z ?? 0) * zoom - y) ** 2;
    if (score < distance) {
      closest = seat;
      distance = score;
    }
  }
  return closest;
}
