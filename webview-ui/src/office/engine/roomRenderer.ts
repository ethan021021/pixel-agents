import {
  BUBBLE_FADE_DURATION_SEC,
  HEADLESS_CHARACTER_ALPHA,
  HOVERED_OUTLINE_ALPHA,
  ROOM_COLORS,
  SEAT_AVAILABLE_COLOR,
  SEAT_BUSY_COLOR,
  SEAT_OWN_COLOR,
  SELECTED_OUTLINE_ALPHA,
  VISITOR_ID,
} from '../../constants.js';
import { isWalkable } from '../layout/tileMap.js';
import type { RoomPoint, RoomProjection } from '../roomProjection.js';
import { roomSampleInset } from '../roomRaster.js';
import { getCachedSprite, getOutlineSprite } from '../sprites/spriteCache.js';
import { BUBBLE_HEART_SPRITE } from '../sprites/spriteData.js';
import { CharacterState, TILE_SIZE } from '../types.js';
import { roomMatrixSprite } from './matrixEffect.js';
import type { OfficeState } from './officeState.js';
import { isGhostHeadlessAgentsEnabled, renderVisitorMarker } from './renderer.js';
import { roomCharacterFrame } from './roomCharacterFrame.js';
import { roomFurnitureArt, roomFurnitureSpriteBounds, roomSeatArt } from './roomFurnitureArt.js';
import { roomPetFrame } from './roomPetFrame.js';
import { drawRoomShell, drawRoomTarget, roomPolygon } from './roomShell.js';

type FurnitureArt = ReturnType<typeof roomFurnitureArt>[number];

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  art: FurnitureArt,
  projection: RoomProjection,
  zoom: number,
  foreground: boolean,
): void {
  const sprite = foreground ? art.model?.sprite.seating?.foreground : art.model?.sprite;
  const { x, y, width, pixelZoom } = roomFurnitureSpriteBounds(art, projection, zoom, sprite);
  const image = getCachedSprite(sprite?.pixels ?? art.pixels, 1);
  if (art.mirror) {
    ctx.save();
    ctx.translate(x + width, y);
    ctx.scale(-1, 1);
    drawRoomBitmap(ctx, image, 0, 0, pixelZoom);
    ctx.restore();
  } else {
    drawRoomBitmap(ctx, image, x, y, pixelZoom);
  }
}

function footShadow(
  ctx: CanvasRenderingContext2D,
  foot: RoomPoint,
  zoom: number,
  halfWidth = 5,
): void {
  const x = Math.round(foot.x);
  const y = Math.round(foot.y);
  ctx.fillStyle = ROOM_COLORS.contactShadow;
  const wide = halfWidth * zoom;
  const narrow = wide * 0.6;
  ctx.fillRect(Math.round(x - wide), y - zoom, Math.round(2 * wide), 2 * zoom);
  ctx.fillRect(Math.round(x - narrow), y - 2 * zoom, Math.round(2 * narrow), 4 * zoom);
}

function drawRoomBitmap(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
  pixelZoom: number,
): void {
  // Canvas engines can choose either texel when a device-pixel center sits
  // directly between two. Bias the source sample to the higher index used by
  // hit testing. The destination bounds still share the same foot and hip.
  const inset = roomSampleInset(pixelZoom);
  ctx.drawImage(
    image,
    inset,
    inset,
    image.width - inset,
    image.height - inset,
    x,
    y,
    image.width * pixelZoom,
    image.height * pixelZoom,
  );
}

/** Visitor view of the office layout, with original isometric sprites. */
export function renderRoom(
  ctx: CanvasRenderingContext2D,
  office: OfficeState,
  projection: RoomProjection,
  zoom: number,
): void {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = ROOM_COLORS.background;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const hover = office.hoveredTile;
  const walkHover =
    hover && isWalkable(hover.col, hover.row, office.tileMap, office.blockedTiles) ? hover : null;
  const layout = office.getLayout();
  drawRoomShell(ctx, layout, projection, zoom, walkHover);
  const destination = office.visitor?.path.at(-1);
  if (destination) drawRoomTarget(ctx, projection, zoom, destination);

  const sprites: Array<{ depth: number; draw: () => void }> = [];
  const overlays: Array<() => void> = [];
  const occupied = new Set<FurnitureArt>();
  for (const art of roomFurnitureArt(office.furniture, layout)) {
    const model = art.model;
    const ground = model?.sprite.footprint;
    if (model && ground) {
      const left = model.x + ground.left;
      const right = model.x + ground.right;
      const top = model.y + ground.top;
      const bottom = model.y + ground.bottom;
      roomPolygon(
        ctx,
        [
          projection.toScreen(left, top),
          projection.toScreen(right, top),
          projection.toScreen(right, bottom),
          projection.toScreen(left, bottom),
        ],
        ROOM_COLORS.contactShadow,
      );
    }
    const { depth } = roomFurnitureSpriteBounds(art, projection, zoom);
    sprites.push({
      depth,
      draw: () => drawFurniture(ctx, art, projection, zoom, false),
    });
  }
  for (const character of office.getCharacters()) {
    const frame = roomCharacterFrame(
      character,
      projection,
      zoom,
      roomSeatArt(office, character.seatId),
    );
    const { pixels, foot, depth, x, y, width, headY, pixelZoom, nativeScale, cushion } = frame;
    const selected = character.id === office.selectedAgentId;
    const hovered = character.id === office.hoveredAgentId;
    const alpha =
      character.isHeadless && isGhostHeadlessAgentsEnabled() ? HEADLESS_CHARACTER_ALPHA : 1;
    if (!character.matrixEffect && character.state !== CharacterState.TYPE) {
      footShadow(ctx, foot, zoom);
    }
    sprites.push({
      depth,
      draw: () => {
        ctx.save();
        ctx.globalAlpha = alpha;
        if (character.matrixEffect) {
          drawRoomBitmap(ctx, roomMatrixSprite(character, pixels, nativeScale), x, y, pixelZoom);
        } else {
          if (selected || hovered) {
            ctx.globalAlpha = selected ? SELECTED_OUTLINE_ALPHA : HOVERED_OUTLINE_ALPHA;
            drawRoomBitmap(
              ctx,
              getCachedSprite(getOutlineSprite(pixels), 1),
              x - pixelZoom,
              y - pixelZoom,
              pixelZoom,
            );
            ctx.globalAlpha = alpha;
          }
          drawRoomBitmap(ctx, getCachedSprite(pixels, 1), x, y, pixelZoom);
        }
        ctx.restore();
      },
    });
    if (character.id === VISITOR_ID) {
      overlays.push(() => renderVisitorMarker(ctx, x + width / 2, headY, zoom));
    }
    if (cushion) occupied.add(cushion.chair);
  }
  // The near arm and backrest can cover an occupant, even though their hips
  // and the cushion share the same depth group.
  for (const art of occupied) {
    if (!art.model?.sprite.seating?.foreground) continue;
    const { depth } = roomFurnitureSpriteBounds(art, projection, zoom);
    sprites.push({
      depth: depth + 0.02,
      draw: () => drawFurniture(ctx, art, projection, zoom, true),
    });
  }
  for (const pet of office.getPets()) {
    const frame = roomPetFrame(pet, projection, zoom);
    if (!frame) continue;
    const image = getCachedSprite(frame.pixels, zoom);
    footShadow(ctx, frame.foot, zoom, frame.shadowHalfWidth);
    sprites.push({ depth: frame.depth, draw: () => ctx.drawImage(image, frame.x, frame.y) });
    if (pet.bubbleType === 'heart') {
      overlays.push(() => {
        const heart = getCachedSprite(BUBBLE_HEART_SPRITE, zoom);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, pet.bubbleTimer / BUBBLE_FADE_DURATION_SEC));
        ctx.drawImage(
          heart,
          Math.round(frame.foot.x - heart.width / 2),
          frame.headY - zoom - heart.height,
        );
        ctx.restore();
      });
    }
  }
  sprites.sort((a, b) => a.depth - b.depth);
  for (const sprite of sprites) sprite.draw();
  if (!office.visitor && hover && office.selectedAgentId !== null) {
    const uid = office.getSeatAtTile(hover.col, hover.row);
    const seat = uid && office.seats.get(uid);
    if (seat) {
      const cushion = roomSeatArt(office, seat.uid);
      const point = projection.toScreen(
        cushion?.x ?? (hover.col + 0.5) * TILE_SIZE,
        cushion?.y ?? (hover.row + 0.5) * TILE_SIZE,
      );
      const y = point.y - (cushion?.z ?? 0) * zoom;
      const radius = 4 * zoom;
      const color =
        office.characters.get(office.selectedAgentId)?.seatId === uid
          ? SEAT_OWN_COLOR
          : seat.assigned
            ? SEAT_BUSY_COLOR
            : SEAT_AVAILABLE_COLOR;
      roomPolygon(
        ctx,
        [
          { x: point.x, y: y - radius / 2 },
          { x: point.x + radius, y },
          { x: point.x, y: y + radius / 2 },
          { x: point.x - radius, y },
        ],
        color,
      );
    }
  }
  for (const overlay of overlays) overlay();
  ctx.restore();
}
