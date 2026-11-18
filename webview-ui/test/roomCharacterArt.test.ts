import { describe, expect, it } from 'vitest';

import { rgbaToHex } from '../../core/src/assets/colorUtils.js';
import { roomCharacterSprite } from '../src/office/engine/roomCharacterArt.js';
import { Direction, type SpriteData } from '../src/office/types.js';

const makeFrame = (): SpriteData =>
  Array.from({ length: 32 }, () => new Array<string>(16).fill(''));
const skin = rgbaToHex(223, 165, 133, 255);
const suit = rgbaToHex(44, 83, 128, 255);
const accessory = rgbaToHex(22, 123, 129, 137);

const clearRowsBelow = (sprite: SpriteData) =>
  sprite.length - 1 - sprite.findLastIndex((row) => row.some(Boolean));

describe('room character art', () => {
  it('lengthens a standing frame, narrows its head and keeps facial colors and the original anchor', () => {
    const source = makeFrame();
    for (let y = 3; y <= 10; y++) source[y].fill(skin, 1, 15);
    source[9][6] = accessory;
    for (let y = 18; y <= 30; y++) source[y].fill(suit, 5, 11);
    const original = structuredClone(source);

    const room = roomCharacterSprite(source, Direction.DOWN, false);

    expect(room).toHaveLength(39);
    expect(room.every((row) => row.length === 18)).toBe(true);
    expect(room[9].filter(Boolean)).toHaveLength(12);
    expect(room.findIndex((row) => row.some(Boolean))).toBe(4);
    expect(room[9][5]).toBe(original[9][6]);
    expect(clearRowsBelow(room)).toBe(clearRowsBelow(source));
    expect(source).toEqual(original);
    expect(roomCharacterSprite(source, Direction.DOWN, false)).toBe(room);
    expect(roomCharacterSprite(source, Direction.UP, false)).not.toBe(room);
  });

  it('extends only the seated torso and keeps the feet and sparse frame padding in place', () => {
    const up = makeFrame();
    for (let y = 17; y <= 25; y++) up[y].fill(suit, 5, 11);
    const seated = roomCharacterSprite(up, Direction.UP, true);
    expect(seated).toHaveLength(35);
    expect(clearRowsBelow(seated)).toBe(6);
    expect(roomCharacterSprite(up, Direction.UP, false)).toHaveLength(39);

    const sparse = makeFrame();
    sparse[10][7] = accessory;
    expect(clearRowsBelow(roomCharacterSprite(sparse, Direction.LEFT, false))).toBe(21);
  });
});
