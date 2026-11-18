import { describe, expect, it } from 'vitest';

import { rgbaToHex } from '../../core/src/assets/colorUtils.js';
import { ROOM_SEATED_HIP, roomCharacterSprite } from '../src/office/engine/roomCharacterArt.js';
import { Direction, type SpriteData } from '../src/office/types.js';

const skin = rgbaToHex(223, 165, 133, 255);
const shirt = rgbaToHex(44, 83, 128, 255);
const hair = rgbaToHex(93, 57, 110, 255);
const trousers = rgbaToHex(39, 115, 91, 255);
const shoes = rgbaToHex(190, 126, 67, 255);
const pin = rgbaToHex(22, 123, 129, 255);

const empty = (): SpriteData => Array.from({ length: 32 }, () => new Array<string>(16).fill(''));

function wardrobe(): SpriteData {
  const source = empty();
  for (let y = 3; y <= 12; y++) source[y].fill(hair, 4, 12);
  for (let y = 13; y <= 17; y++) source[y].fill(skin, 5, 11);
  for (let y = 18; y <= 24; y++) source[y].fill(shirt, 4, 12);
  for (let y = 25; y <= 28; y++) source[y].fill(trousers, 4, 12);
  source[20][8] = pin;
  for (let y = 29; y <= 30; y++) {
    source[y].fill(shoes, 5, 7);
    source[y].fill(shoes, 9, 11);
  }
  return source;
}

const bottom = (sprite: SpriteData) => sprite.findLastIndex((row) => row.some(Boolean));

describe('room character art', () => {
  it('draws its own standing shape using the original wardrobe colors and shirt detail', () => {
    const source = wardrobe();
    const original = structuredClone(source);
    const room = roomCharacterSprite(source, Direction.RIGHT, false);

    expect(room).toHaveLength(39);
    expect(room.every((row) => row.length === 18)).toBe(true);
    expect(room.flat()).toEqual(expect.arrayContaining([skin, shirt, hair, trousers, pin]));
    expect(source).toEqual(original);
    expect(roomCharacterSprite(source, Direction.RIGHT, false)).toBe(room);
  });

  it('keeps a supported foot in both walk steps and draws a separate rear view', () => {
    const source = wardrobe();
    const centered = roomCharacterSprite(source, Direction.RIGHT, false);
    const first = roomCharacterSprite(source, Direction.RIGHT, false, { stride: -1 });
    const second = roomCharacterSprite(source, Direction.RIGHT, false, { stride: 1 });
    expect(bottom(first)).toBe(bottom(centered));
    expect(bottom(second)).toBe(bottom(centered));
    expect(first).not.toEqual(second);
    expect(roomCharacterSprite(source, Direction.UP, false).slice(12, 18)).not.toEqual(
      centered.slice(12, 18),
    );
  });

  it('keeps the configured iris ink within the face and blinks without changing the silhouette', () => {
    const source = wardrobe();
    const iris = rgbaToHex(51, 38, 88, 255);
    source[14][7] = iris;

    const open = roomCharacterSprite(source, Direction.RIGHT, false);
    const closed = roomCharacterSprite(source, Direction.RIGHT, false, { blink: true });

    expect(open[14][9]).toBe(iris);
    expect(closed[14][9]).not.toBe(iris);
    expect(closed.map((row) => row.map(Boolean))).toEqual(open.map((row) => row.map(Boolean)));
  });

  it('bends the legs from the seat and keeps the hip and shoe placement during gestures', () => {
    const standing = wardrobe();
    const frame = empty();
    const seated = roomCharacterSprite(frame, Direction.RIGHT, true, { standing });
    const typing = roomCharacterSprite(frame, Direction.RIGHT, true, {
      standing,
      gesture: 'type',
      beat: 1,
    });
    const reading = roomCharacterSprite(frame, Direction.RIGHT, true, {
      standing,
      gesture: 'read',
    });

    expect(seated).toHaveLength(35);
    expect(seated[ROOM_SEATED_HIP.y][ROOM_SEATED_HIP.x]).toBeTruthy();
    // The far shoe projects past the near one and lands two room pixels higher.
    expect(seated.findLastIndex((row) => row.slice(15).some(Boolean))).toBe(31);
    expect(bottom(seated)).toBe(33);
    expect(typing.slice(27)).toEqual(seated.slice(27));
    expect(reading.slice(27)).toEqual(seated.slice(27));
    expect(typing).not.toEqual(seated);
    expect(reading).not.toEqual(seated);
  });

  it('foreshortens knees and soles when sitting with the back toward the room', () => {
    const standing = wardrobe();
    const frame = empty();
    const right = roomCharacterSprite(frame, Direction.UP, true, { standing });
    const left = roomCharacterSprite(frame, Direction.LEFT, true, { standing });

    expect(right[ROOM_SEATED_HIP.y][ROOM_SEATED_HIP.x]).toBeTruthy();
    expect(right.findLastIndex((row) => row[15])).toBe(25);
    expect(right.every((row) => !row[16] && !row[17])).toBe(true);
    expect(bottom(right)).toBe(27);
    expect(left).toEqual(right.map((row) => [...row].reverse()));
  });

  it('keeps nonstandard art and updates cached frames when the wardrobe changes', () => {
    const sparse = empty();
    sparse[10][7] = pin;
    expect(roomCharacterSprite(sparse, Direction.LEFT, false)).toBe(sparse);

    const standing = wardrobe();
    const changed = structuredClone(standing);
    changed[17][8] = pin;
    const original = roomCharacterSprite(sparse, Direction.RIGHT, true, { standing });
    const edited = roomCharacterSprite(sparse, Direction.RIGHT, true, { standing: changed });
    expect(original).not.toEqual(edited);
  });

  it('waves above shoulder level in two phases without moving the feet', () => {
    const source = wardrobe();
    const still = roomCharacterSprite(source, Direction.RIGHT, false);
    const wave = roomCharacterSprite(source, Direction.RIGHT, false, { gesture: 'wave', beat: 0 });
    const tilt = roomCharacterSprite(source, Direction.RIGHT, false, { gesture: 'wave', beat: 1 });

    expect(wave[15][1]).toBe(skin);
    expect(still[15][1]).toBe('');
    expect(tilt[15]).not.toEqual(wave[15]);
    expect(wave.slice(28)).toEqual(still.slice(28));
    expect(tilt.slice(28)).toEqual(still.slice(28));
  });
});
