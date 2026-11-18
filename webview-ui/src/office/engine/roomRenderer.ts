import {
  BUBBLE_FADE_DURATION_SEC,
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_Z_SORT_OFFSET,
  HEADLESS_CHARACTER_ALPHA,
  HOVERED_OUTLINE_ALPHA,
  ROOM_COLORS,
  SELECTED_OUTLINE_ALPHA,
  VISITOR_ID,
} from '../../constants.js';
import { hslToRgb } from '../colorize.js';
import { isWalkable } from '../layout/tileMap.js';
import type { RoomPoint, RoomProjection } from '../roomProjection.js';
import { ROOM_GROUND_SCALE, roomFurnitureBounds } from '../roomProjection.js';
import { getPetSprites } from '../sprites/petSpriteData.js';
import { getCachedSprite, getOutlineSprite } from '../sprites/spriteCache.js';
import { BUBBLE_HEART_SPRITE, getCharacterSprites } from '../sprites/spriteData.js';
import type { ColorValue, OfficeLayout } from '../types.js';
import { CharacterState, TILE_SIZE, TileType } from '../types.js';
import { getCharacterSprite } from './characters.js';
import { renderMatrixEffect } from './matrixEffect.js';
import type { OfficeState } from './officeState.js';
import { getPetSpriteData } from './petEntity.js';
import { isGhostHeadlessAgentsEnabled, renderVisitorMarker } from './renderer.js';

const WALL_HEIGHT = 38;
const LOW_WALL_HEIGHT = 8;
const PLATFORM_DEPTH = 6;

function polygon(ctx: CanvasRenderingContext2D, points: RoomPoint[], color: string): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function edgeBand(
  ctx: CanvasRenderingContext2D,
  a: RoomPoint,
  b: RoomPoint,
  bottom: number,
  top: number,
  color: string,
): void {
  polygon(
    ctx,
    [
      { x: a.x, y: a.y - bottom },
      { x: b.x, y: b.y - bottom },
      { x: b.x, y: b.y - top },
      { x: a.x, y: a.y - top },
    ],
    color,
  );
}

function wall(
  ctx: CanvasRenderingContext2D,
  a: RoomPoint,
  b: RoomPoint,
  height: number,
  zoom: number,
  lit: boolean,
): void {
  const colors = lit ? ROOM_COLORS.lightWall : ROOM_COLORS.shadedWall;
  edgeBand(ctx, a, b, 0, height * zoom, colors.panel);
  edgeBand(ctx, a, b, 0, 4 * zoom, colors.skirting);
  edgeBand(ctx, a, b, 4 * zoom, 5 * zoom, colors.trim);
  edgeBand(ctx, a, b, (height - 2) * zoom, height * zoom, colors.cap);
  if (height > 9) {
    ctx.fillStyle = colors.seam;
    ctx.fillRect(Math.round(a.x), Math.round(a.y - (height - 3) * zoom), zoom, (height - 9) * zoom);
  }
}

function carpetColor(color: ColorValue | undefined): string {
  if (!color) return ROOM_COLORS.rug;
  const channels = hslToRgb(color.h, color.s / 200, 0.46);
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  layout: OfficeLayout,
  projection: RoomProjection,
  zoom: number,
  hovered: { col: number; row: number } | null,
): void {
  const { cols, rows, tiles, carpetTiles } = layout;
  const at = (col: number, row: number) =>
    col >= 0 && col < cols && row >= 0 && row < rows ? tiles[row * cols + col] : TileType.VOID;
  const halfWidth = TILE_SIZE * zoom * ROOM_GROUND_SCALE;
  const halfHeight = halfWidth / 2;
  const walls: Array<() => void> = [];
  const { width, height } = ctx.canvas;
  ctx.lineWidth = Math.max(1, Math.floor(zoom / 2));
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tile = at(col, row);
      if (tile === TileType.VOID) continue;
      const frontX = at(col + 1, row);
      const frontY = at(col, row + 1);
      const backX = at(col - 1, row);
      const backY = at(col, row - 1);
      const top = projection.toScreen(col * TILE_SIZE, row * TILE_SIZE);
      if (
        top.x + halfWidth < 0 ||
        top.x - halfWidth > width ||
        top.y + 2 * halfHeight + PLATFORM_DEPTH * zoom < 0 ||
        top.y - WALL_HEIGHT * zoom > height
      ) {
        continue;
      }
      const right = { x: top.x + halfWidth, y: top.y + halfHeight };
      const bottom = { x: top.x, y: top.y + 2 * halfHeight };
      const left = { x: top.x - halfWidth, y: top.y + halfHeight };
      const face = [top, right, bottom, left];
      if (frontX === TileType.VOID) {
        edgeBand(ctx, right, bottom, -PLATFORM_DEPTH * zoom, 0, ROOM_COLORS.platformRight);
      }
      if (frontY === TileType.VOID) {
        edgeBand(ctx, left, bottom, -PLATFORM_DEPTH * zoom, 0, ROOM_COLORS.platformLeft);
      }

      const rug = carpetTiles?.[row * cols + col];
      const floorColor =
        ROOM_COLORS.floor[tile - 1]?.[(row + col) % 2] ?? ROOM_COLORS.floorFallback;
      polygon(
        ctx,
        face,
        tile === TileType.WALL ? ROOM_COLORS.wallBase : rug ? carpetColor(rug.color) : floorColor,
      );
      ctx.strokeStyle = ROOM_COLORS.floorSeam;
      ctx.stroke();
      if (hovered?.col === col && hovered.row === row) {
        polygon(ctx, face, ROOM_COLORS.hoverFill);
        ctx.strokeStyle = ROOM_COLORS.hoverBorder;
        ctx.stroke();
      }

      if (tile !== TileType.WALL) continue;
      const northWall = backY === TileType.VOID && frontY !== TileType.VOID;
      const westWall = backX === TileType.VOID && frontX !== TileType.VOID;
      if (northWall) walls.push(() => wall(ctx, top, right, WALL_HEIGHT, zoom, true));
      if (westWall) walls.push(() => wall(ctx, top, left, WALL_HEIGHT, zoom, false));
      if (!northWall && !westWall) {
        const vertical = backY === TileType.WALL || frontY === TileType.WALL;
        walls.push(() => wall(ctx, top, vertical ? left : right, LOW_WALL_HEIGHT, zoom, !vertical));
      }
    }
  }
  for (const draw of walls) draw();
}

/** Visitor view using the same layout and animated sprites as the flat office. */
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
  drawGround(ctx, office.getLayout(), projection, zoom, walkHover);

  const sprites: Array<{ depth: number; draw: () => void }> = [];
  const overlays: Array<() => void> = [];
  for (const furniture of office.furniture) {
    const { x, y, width, depth } = roomFurnitureBounds(furniture, projection, zoom);
    const image = getCachedSprite(furniture.sprite, zoom);
    sprites.push({
      depth,
      draw: () => {
        if (furniture.mirrored) {
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
    const point = projection.toScreen(character.x, character.y);
    const data = getCharacterSprite(
      character,
      getCharacterSprites(character.palette, character.repeat, character.blinkShut > 0),
    );
    const image = getCachedSprite(data, zoom);
    const sitting = character.state === CharacterState.TYPE ? CHARACTER_SITTING_OFFSET_PX : 0;
    const x = Math.round(point.x - image.width / 2);
    const y = Math.round(point.y - image.height + sitting * zoom);
    const selected = character.id === office.selectedAgentId;
    const hovered = character.id === office.hoveredAgentId;
    const alpha =
      character.isHeadless && isGhostHeadlessAgentsEnabled() ? HEADLESS_CHARACTER_ALPHA : 1;
    const depth = projection.toScreen(
      character.x,
      character.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET,
    ).y;
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
      overlays.push(() => renderVisitorMarker(ctx, point.x, y, zoom));
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
