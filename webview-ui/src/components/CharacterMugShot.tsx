import { useEffect, useRef, useSyncExternalStore } from 'react';

import { isRoomSheetFrame } from '../../../core/src/assets/characterSheet.js';
import { ROOM_SHEET_FRAME } from '../../../core/src/assets/constants.js';
import {
  MUGSHOT_CROP_LEFT_COL,
  MUGSHOT_CROP_SIDE_PX,
  MUGSHOT_CROP_TOP_ROW,
  MUGSHOT_RENDER_ZOOM,
} from '../constants.js';
import { roomCastSprite } from '../office/engine/roomCast.js';
import { ROOM_CHARACTER_NATIVE_SCALE } from '../office/engine/roomCharacterArt.js';
import { getCachedSprite } from '../office/sprites/spriteCache.js';
import {
  getCharacterRoomCastIndex,
  getCharacterSprites,
  getCharacterTemplatesVersion,
  subscribeCharacterTemplates,
} from '../office/sprites/spriteData.js';
import { Direction } from '../office/types.js';

interface CharacterMugShotProps {
  palette: number;
  repeat: number;
  /** Sprite pixels to CSS pixels, a whole number. Defaults to MUGSHOT_RENDER_ZOOM. */
  zoom?: number;
  /** First sprite row of the crop. Defaults to MUGSHOT_CROP_TOP_ROW. */
  cropTop?: number;
  /** Use the independent room portrait when selecting a visitor. */
  roomPortrait?: boolean;
}

/**
 * A square "mug shot" — the head region of an agent's front-facing sprite,
 * scaled up crisply. Used as the terminal tab's identity in place of a label.
 *
 * Reuses the office sprite cache: the full front sprite is rendered once per
 * palette:repeat, and we blit just the head square out of it — again whenever
 * the character sprites are replaced, so a mounted mug shot never goes stale.
 */
export function CharacterMugShot({
  palette,
  repeat,
  zoom = MUGSHOT_RENDER_ZOOM,
  cropTop = MUGSHOT_CROP_TOP_ROW,
  roomPortrait,
}: CharacterMugShotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Redraw when the character sprites change (the cast arrives or is edited).
  const sprites = useSyncExternalStore(subscribeCharacterTemplates, getCharacterTemplatesVersion);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const side = MUGSHOT_CROP_SIDE_PX * zoom;
    const roomCastIndex = roomPortrait ? getCharacterRoomCastIndex(palette) : undefined;
    const room = roomCastIndex !== undefined;
    const frames = getCharacterSprites(palette, repeat);
    const front = room
      ? roomCastSprite(roomCastIndex, Direction.DOWN, false, undefined, repeat)
      : (frames.standing?.[Direction.DOWN] ?? frames.walk[Direction.DOWN][0]);
    const nativeScale = room
      ? ROOM_CHARACTER_NATIVE_SCALE
      : isRoomSheetFrame(front[0].length, front.length)
        ? ROOM_SHEET_FRAME.scale
        : 1;
    const full = getCachedSprite(front, 1);
    const sourceSide = MUGSHOT_CROP_SIDE_PX * nativeScale;
    const left =
      nativeScale > 1 ? Math.floor((full.width - sourceSide) / 2) : MUGSHOT_CROP_LEFT_COL;
    const top =
      nativeScale > 1
        ? Math.max(0, front.findIndex((row) => row.some(Boolean)) - nativeScale)
        : cropTop;
    canvas.width = side;
    canvas.height = side;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, side, side);
    ctx.drawImage(full, left, top, sourceSide, sourceSide, 0, 0, side, side);
  }, [palette, repeat, zoom, cropTop, roomPortrait, sprites]);

  return (
    <canvas
      ref={canvasRef}
      width={MUGSHOT_CROP_SIDE_PX * zoom}
      height={MUGSHOT_CROP_SIDE_PX * zoom}
      style={{
        width: MUGSHOT_CROP_SIDE_PX * zoom,
        height: MUGSHOT_CROP_SIDE_PX * zoom,
        imageRendering: 'pixelated',
      }}
    />
  );
}
