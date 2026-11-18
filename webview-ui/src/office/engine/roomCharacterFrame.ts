import { CHARACTER_SITTING_OFFSET_PX, CHARACTER_Z_SORT_OFFSET } from '../../constants.js';
import type { RoomProjection } from '../roomProjection.js';
import { getCharacterSprites } from '../sprites/spriteData.js';
import type { Character } from '../types.js';
import { CharacterState, TILE_SIZE } from '../types.js';
import { getCharacterSprite } from './characters.js';
import { roomCharacterSprite } from './roomCharacterArt.js';

export function roomCharacterPixels(character: Character) {
  const source = getCharacterSprite(
    character,
    getCharacterSprites(character.palette, character.repeat, character.blinkShut > 0),
  );
  return roomCharacterSprite(source, character.dir, character.state === CharacterState.TYPE);
}

export function roomCharacterHeadroom(pixels: ReturnType<typeof roomCharacterPixels>): number {
  const firstRow = pixels.findIndex((row) => row.some(Boolean));
  return pixels.length - Math.max(0, firstRow);
}

export function roomCharacterFrame(character: Character, projection: RoomProjection, zoom: number) {
  const sitting = character.state === CharacterState.TYPE;
  const pixels = roomCharacterPixels(character);
  const foot = projection.toScreen(character.x, character.y);
  const width = Math.floor(pixels[0].length * zoom);
  const height = Math.floor(pixels.length * zoom);
  return {
    pixels,
    foot,
    depth: projection.toScreen(character.x, character.y + TILE_SIZE / 2 + CHARACTER_Z_SORT_OFFSET)
      .y,
    x: Math.round(foot.x - width / 2),
    y: Math.round(foot.y - height + (sitting ? CHARACTER_SITTING_OFFSET_PX * zoom : 0)),
    width,
    height,
  };
}
