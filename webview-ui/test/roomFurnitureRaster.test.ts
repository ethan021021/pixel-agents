import { expect, it } from 'vitest';

import { rgbaToHex } from '../../core/src/assets/colorUtils.js';
import { ROOM_COLORS, ZOOM_MAX, ZOOM_MIN } from '../src/constants.js';
import { rasterizeRoomFurniture } from '../src/office/engine/roomFurnitureArt.js';
import type { RoomBox } from '../src/office/roomModel.js';
import { ROOM_NATIVE_SCALE, roomProjection } from '../src/office/roomProjection.js';
import { roomSampleInset } from '../src/office/roomRaster.js';
import { TILE_SIZE } from '../src/office/types.js';

const cube: RoomBox = {
  x: 0,
  y: 0,
  z: 0,
  width: TILE_SIZE,
  depth: TILE_SIZE,
  height: 3,
  colors: [
    rgbaToHex(204, 170, 136, 255),
    rgbaToHex(119, 85, 51, 255),
    rgbaToHex(153, 119, 85, 255),
  ],
};

it('paints the texel hit testing picks at every room zoom', () => {
  const sourceWidth = 164;
  for (let zoom = ZOOM_MIN; zoom <= ZOOM_MAX; zoom++) {
    const pixelZoom = zoom / ROOM_NATIVE_SCALE;
    const inset = roomSampleInset(pixelZoom);
    for (let x = 0; x + 0.5 < sourceWidth * pixelZoom; x++) {
      const hit = (x + 0.5) / pixelZoom;
      const drawn = inset + (hit * (sourceWidth - inset)) / sourceWidth;
      expect(Math.floor(drawn)).toBe(Math.floor(hit));
    }
  }
});

it('rasterizes a floor tile as a 64-pixel diamond with a one-pixel silhouette', () => {
  const sprite = rasterizeRoomFurniture({ boxes: [cube] });
  expect(sprite.footprint).toEqual({ left: 0, top: 0, right: TILE_SIZE, bottom: TILE_SIZE });
  const middle = sprite.pixels.find((row) => row.filter((p) => p === cube.colors[0]).length === 62);
  expect(middle).toBeDefined();
  const first = middle!.findIndex(Boolean);
  expect(middle![first]).toBe(ROOM_COLORS.furnitureOutline);
  expect(middle![first + 1]).toBe(cube.colors[0]);
  expect(sprite.pixels[0]).toHaveLength(66); // 64-pixel footprint plus one silhouette pixel on each side.
});

it('clips bevels to the footprint and rasterizes a contrasting front chamfer', () => {
  const square = rasterizeRoomFurniture({ boxes: [cube] });
  const chamfer = rasterizeRoomFurniture({ boxes: [{ ...cube, cornerRadius: 3 }] });
  expect(chamfer.footprint).toEqual(square.footprint);
  expect(chamfer.pixels.flat()).toContain(rgbaToHex(136, 102, 68, 255).toLowerCase());
  const projection = roomProjection(0, 0, 0, 0, ROOM_NATIVE_SCALE, 0, 0);
  const corner = projection.toScreen(0.5, 0.5);
  const value = (s: typeof square) =>
    s.pixels[Math.floor(corner.y - cube.height * ROOM_NATIVE_SCALE - s.top)]?.[
      Math.floor(corner.x - s.left)
    ];
  expect(value(square)).toBe(cube.colors[0]);
  expect(value(chamfer)).toBeFalsy();
});

it('retains only visible foreground pixels, even when a later piece uses the same shade', () => {
  const front: RoomBox = { ...cube, width: 6, depth: 6 };
  const cover = { ...front };
  const sprite = rasterizeRoomFurniture({
    boxes: [front, cover],
    seating: { anchors: [{ x: 3, y: 3, z: 3 }], foreground: [front] },
  });
  const mask = sprite.seating!.foreground!;
  expect(mask.left).toBe(sprite.left);
  expect(mask.top).toBe(sprite.top);
  expect(mask.pixels).toHaveLength(sprite.pixels.length);
  expect(mask.pixels[0]).toHaveLength(sprite.pixels[0].length);
  expect(mask.pixels.some((row) => row.some(Boolean))).toBe(false);
});
