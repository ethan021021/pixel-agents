import {
  BUBBLE_FADE_DURATION_SEC,
  HEADLESS_CHARACTER_ALPHA,
  HOVERED_OUTLINE_ALPHA,
  ROOM_COLORS,
  SELECTED_OUTLINE_ALPHA,
  VISITOR_ID,
} from '../../constants.js';
import { isWalkable } from '../layout/tileMap.js';
import type { RoomPoint, RoomProjection } from '../roomProjection.js';
import { getPetSprites } from '../sprites/petSpriteData.js';
import { getCachedSprite, getOutlineSprite } from '../sprites/spriteCache.js';
import { BUBBLE_HEART_SPRITE } from '../sprites/spriteData.js';
import { CharacterState, TILE_SIZE } from '../types.js';
import { renderMatrixEffect } from './matrixEffect.js';
import type { OfficeState } from './officeState.js';
import { getPetSpriteData } from './petEntity.js';
import { isGhostHeadlessAgentsEnabled, renderVisitorMarker } from './renderer.js';
import { roomCharacterFrame, roomCharacterHeadroom } from './roomCharacterFrame.js';
import { roomFurnitureArt, roomFurnitureSpriteBounds } from './roomFurnitureArt.js';
import { drawRoomShell, roomPolygon } from './roomShell.js';

function footShadow(ctx: CanvasRenderingContext2D, foot: RoomPoint, zoom: number): void {
  const x = Math.round(foot.x);
  const y = Math.round(foot.y);
  ctx.fillStyle = ROOM_COLORS.contactShadow;
  ctx.fillRect(x - 5 * zoom, y - zoom, 10 * zoom, 2 * zoom);
  ctx.fillRect(x - 3 * zoom, y - 2 * zoom, 6 * zoom, 4 * zoom);
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

  const sprites: Array<{ depth: number; draw: () => void }> = [];
  const overlays: Array<() => void> = [];
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
    const { x, y, width, depth } = roomFurnitureSpriteBounds(art, projection, zoom);
    const image = getCachedSprite(art.pixels, zoom);
    sprites.push({
      depth,
      draw: () => {
        if (art.mirror) {
          ctx.save();
          ctx.translate(x + width, y);
          ctx.scale(-1, 1);
          ctx.drawImage(image, 0, 0);
          ctx.restore();
        } else ctx.drawImage(image, x, y);
      },
    });
  }
  for (const character of office.getCharacters()) {
    const {
      pixels: data,
      foot,
      depth,
      x,
      y,
      height,
    } = roomCharacterFrame(character, projection, zoom);
    const image = getCachedSprite(data, zoom);
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
          renderMatrixEffect(ctx, character, data, x, y, zoom);
        } else {
          if (selected || hovered) {
            ctx.globalAlpha = selected ? SELECTED_OUTLINE_ALPHA : HOVERED_OUTLINE_ALPHA;
            ctx.drawImage(getCachedSprite(getOutlineSprite(data), zoom), x - zoom, y - zoom);
            ctx.globalAlpha = alpha;
          }
          ctx.drawImage(image, x, y);
        }
        ctx.restore();
      },
    });
    if (character.id === VISITOR_ID) {
      const head = y + height - roomCharacterHeadroom(data) * zoom;
      overlays.push(() => renderVisitorMarker(ctx, foot.x, head, zoom));
    }
  }
  for (const pet of office.getPets()) {
    const data = getPetSpriteData(pet, getPetSprites(pet.petType));
    if (!data) continue;
    const point = projection.toScreen(pet.x, pet.y);
    const image = getCachedSprite(data, zoom);
    const x = Math.round(point.x - image.width / 2);
    const y = Math.round(point.y - image.height);
    const depth = projection.toScreen(pet.x, pet.y + TILE_SIZE / 2).y;
    footShadow(ctx, point, zoom);
    sprites.push({ depth, draw: () => ctx.drawImage(image, x, y) });
    if (pet.bubbleType === 'heart') {
      overlays.push(() => {
        const heart = getCachedSprite(BUBBLE_HEART_SPRITE, zoom);
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, pet.bubbleTimer / BUBBLE_FADE_DURATION_SEC));
        ctx.drawImage(heart, Math.round(point.x - heart.width / 2), y - zoom - heart.height);
        ctx.restore();
      });
    }
  }
  sprites.sort((a, b) => a.depth - b.depth);
  for (const sprite of sprites) sprite.draw();
  for (const overlay of overlays) overlay();
  ctx.restore();
}
