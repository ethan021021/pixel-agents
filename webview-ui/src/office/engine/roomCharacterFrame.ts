import { CHAR_FRAME_H, CHAR_FRAME_W } from '../../../../core/src/assets/constants.js';
import {
  CHARACTER_SITTING_OFFSET_PX,
  CHARACTER_Z_SORT_OFFSET,
  VISITOR_WAVE_BEAT_SEC,
} from '../../constants.js';
import type { RoomProjection } from '../roomProjection.js';
import { getCharacterRoomSource, getCharacterSprites } from '../sprites/spriteData.js';
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
// Imported sheets carry no pelvis metadata. Their standard frame center and
// waist row line up with the room's modeled seat without changing any pixels.
const externalSeatHip = { x: CHAR_FRAME_W / 2, y: CHAR_FRAME_H - 8 };

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
  const roomSource = getCharacterRoomSource(character.palette);
  if (typeof roomSource === 'number') {
    return {
      pixels: roomCastSprite(roomSource, character.dir, sitting, pose, character.repeat),
      nativeScale: ROOM_CHARACTER_NATIVE_SCALE,
      hip: ROOM_SEATED_HIP,
    };
  }
  const sprites = getCharacterSprites(character.palette, character.repeat, pose.blink);
  const source = getCharacterSprite(character, sprites);
  if (roomSource === 'external') {
    const standardFrame = source.length === CHAR_FRAME_H && source[0]?.length === CHAR_FRAME_W;
    return { pixels: source, nativeScale: 1, hip: standardFrame ? externalSeatHip : undefined };
  }
  const pixels = roomCharacterSprite(source, character.dir, sitting, {
    ...pose,
    standing: sprites.walk[character.dir][1],
    front: sprites.walk[Direction.DOWN][1],
  });
  const transformed = pixels !== source;
  return {
    pixels,
    nativeScale: transformed ? ROOM_CHARACTER_NATIVE_SCALE : 1,
    hip: transformed && pixels.length === ROOM_SEATED_FRAME_HEIGHT ? ROOM_SEATED_HIP : undefined,
  };
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
  const { pixels, nativeScale, hip } = roomCharacterPixels(character);
  const pixelZoom = zoom / nativeScale;
  const width = pixels[0].length * pixelZoom;
  const height = pixels.length * pixelZoom;
  const foot = projection.toScreen(character.x, character.y);
  const placement = sitting && seat && hip ? { seat, hip } : undefined;
  const column = placement ? projection.toScreen(placement.seat.x, placement.seat.y) : foot;
  const x = Math.round(column.x - (placement ? placement.hip.x * pixelZoom : width / 2));
  const y = placement
    ? Math.round(column.y - placement.seat.z * zoom - placement.hip.y * pixelZoom)
    : Math.round(foot.y - height + (sitting ? CHARACTER_SITTING_OFFSET_PX * zoom : 0));
  const headRow = pixels.findIndex((row) => row.some(Boolean));
  const headY = y + Math.max(0, headRow) * pixelZoom;
  const cushion = placement?.seat;
  const depth = cushion
    ? roomFurnitureSpriteBounds(cushion.chair, projection, zoom).depth + 0.01
    : projection.toScreen(character.x, character.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET).y;
  return { pixels, nativeScale, pixelZoom, foot, x, y, width, height, headY, depth, cushion };
}
