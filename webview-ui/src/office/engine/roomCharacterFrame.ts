import {
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_Z_SORT_OFFSET,
  VISITOR_WAVE_BEAT_SEC,
} from '../../constants.js';
import type { RoomProjection } from '../roomProjection.js';
import { getCharacterSprites } from '../sprites/spriteData.js';
import type { Character } from '../types.js';
import { CharacterState, Direction, TILE_SIZE } from '../types.js';
import { getCharacterSprite, isReadingTool } from './characters.js';
import {
  ROOM_SEATED_FRAME_HEIGHT,
  ROOM_SEATED_HIP,
  roomCharacterSprite,
} from './roomCharacterArt.js';
import type { RoomSeatArt } from './roomFurnitureArt.js';
import { roomFurnitureSpriteBounds } from './roomFurnitureArt.js';

const stride = [-1, 0, 1, 0] as const;

export function roomCharacterPixels(character: Character) {
  const sprites = getCharacterSprites(character.palette, character.repeat, character.blinkShut > 0);
  const sitting = character.state === CharacterState.TYPE && character.seatId !== null;
  const source = getCharacterSprite(character, sprites);
  const wave = character.visitorWave ?? 0;
  let gesture: 'rest' | 'type' | 'read' | 'wave' = 'rest';
  if (wave > 0) gesture = 'wave';
  else if (sitting && (character.isActive || character.isSubagent)) {
    gesture = isReadingTool(character.currentTool) ? 'read' : 'type';
  }
  const beat = wave > 0 ? Math.floor(wave / VISITOR_WAVE_BEAT_SEC) : character.frame;
  return roomCharacterSprite(source, character.dir, sitting, {
    standing: sprites.walk[character.dir][1],
    front: sprites.walk[Direction.DOWN][1],
    stride: character.state === CharacterState.WALK ? stride[character.frame % 4] : 0,
    gesture,
    beat: beat % 2 === 0 ? 0 : 1,
    blink: character.blinkShut > 0,
  });
}

export function roomCharacterHeadroom(pixels: ReturnType<typeof roomCharacterPixels>): number {
  const firstRow = pixels.findIndex((row) => row.some(Boolean));
  return pixels.length - Math.max(0, firstRow);
}

/** Draw and pick the same pose. A modeled seat places its rendered hip on the
 * cushion; older/custom chair sprites use their original tile-based placement. */
export function roomCharacterFrame(
  character: Character,
  projection: Pick<RoomProjection, 'toScreen'>,
  zoom: number,
  seat?: RoomSeatArt,
) {
  const sitting = character.state === CharacterState.TYPE && character.seatId !== null;
  const pixels = roomCharacterPixels(character);
  const width = Math.floor(pixels[0].length * zoom);
  const height = Math.floor(pixels.length * zoom);
  const foot = projection.toScreen(character.x, character.y);
  const cushion = sitting && pixels.length === ROOM_SEATED_FRAME_HEIGHT ? seat : undefined;
  const column = cushion ? projection.toScreen(cushion.x, cushion.y) : foot;
  const x = Math.round(column.x - (cushion ? ROOM_SEATED_HIP.x * zoom : width / 2));
  const y = cushion
    ? Math.round(column.y - (cushion.z + ROOM_SEATED_HIP.y) * zoom)
    : Math.round(foot.y - height + (sitting ? CHARACTER_SITTING_OFFSET_PX * zoom : 0));
  const depth = cushion
    ? roomFurnitureSpriteBounds(cushion.chair, projection, zoom).depth + 0.01
    : projection.toScreen(character.x, character.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET).y;
  return { pixels, foot, x, y, width, height, depth, cushion };
}
