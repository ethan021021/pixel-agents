import {
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_Z_SORT_OFFSET,
  VISITOR_WAVE_BEAT_SEC,
} from '../../constants.js';
import type { RoomProjection } from '../roomProjection.js';
import { getCharacterRoomCastIndex, getCharacterSprites } from '../sprites/spriteData.js';
import type { Character } from '../types.js';
import { CharacterState, Direction, TILE_SIZE } from '../types.js';
import { getCharacterSprite, isReadingTool } from './characters.js';
import { roomCastSprite } from './roomCast.js';
import type { RoomCharacterPose } from './roomCharacterArt.js';
import {
  ROOM_CHARACTER_NATIVE_SCALE,
  ROOM_SEATED_FRAME_HEIGHT,
  ROOM_SEATED_HIP,
  roomCharacterSprite,
} from './roomCharacterArt.js';
import type { RoomSeatArt } from './roomFurnitureArt.js';
import { roomFurnitureSpriteBounds } from './roomFurnitureArt.js';

const stride = [-1, 0, 1, 0] as const;

function roomCharacterPixels(character: Character) {
  const sitting = character.state === CharacterState.TYPE && character.seatId !== null;
  const wave = character.visitorWave ?? 0;
  let gesture: 'rest' | 'type' | 'read' | 'wave' = 'rest';
  if (wave > 0) gesture = 'wave';
  else if (sitting && (character.isActive || character.isSubagent)) {
    gesture = isReadingTool(character.currentTool) ? 'read' : 'type';
  }
  const beat = wave > 0 ? Math.floor(wave / VISITOR_WAVE_BEAT_SEC) : character.frame;
  const pose: RoomCharacterPose = {
    stride: character.state === CharacterState.WALK ? stride[character.frame % 4] : 0,
    gesture,
    beat: beat % 2 === 0 ? 0 : 1,
    blink: character.blinkShut > 0,
  };
  const preset = getCharacterRoomCastIndex(character.palette);
  if (preset !== undefined) {
    return {
      pixels: roomCastSprite(preset, character.dir, sitting, pose, character.repeat),
      nativeScale: ROOM_CHARACTER_NATIVE_SCALE,
    };
  }
  const sprites = getCharacterSprites(character.palette, character.repeat, pose.blink);
  const source = getCharacterSprite(character, sprites);
  const pixels = roomCharacterSprite(source, character.dir, sitting, {
    ...pose,
    standing: sprites.walk[character.dir][1],
    front: sprites.walk[Direction.DOWN][1],
  });
  return { pixels, nativeScale: pixels === source ? 1 : ROOM_CHARACTER_NATIVE_SCALE };
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
  const { pixels, nativeScale } = roomCharacterPixels(character);
  const pixelZoom = zoom / nativeScale;
  const width = pixels[0].length * pixelZoom;
  const height = pixels.length * pixelZoom;
  const foot = projection.toScreen(character.x, character.y);
  const cushion =
    sitting && nativeScale > 1 && pixels.length === ROOM_SEATED_FRAME_HEIGHT ? seat : undefined;
  const column = cushion ? projection.toScreen(cushion.x, cushion.y) : foot;
  const x = Math.round(column.x - (cushion ? ROOM_SEATED_HIP.x * pixelZoom : width / 2));
  const y = cushion
    ? Math.round(column.y - cushion.z * zoom - ROOM_SEATED_HIP.y * pixelZoom)
    : Math.round(foot.y - height + (sitting ? CHARACTER_SITTING_OFFSET_PX * zoom : 0));
  const headRow = pixels.findIndex((row) => row.some(Boolean));
  const headY = y + Math.max(0, headRow) * pixelZoom;
  const depth = cushion
    ? roomFurnitureSpriteBounds(cushion.chair, projection, zoom).depth + 0.01
    : projection.toScreen(character.x, character.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET).y;
  return { pixels, nativeScale, pixelZoom, foot, x, y, width, height, headY, depth, cushion };
}
