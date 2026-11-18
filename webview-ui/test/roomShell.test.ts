import { readFileSync } from 'node:fs';

import { afterEach, expect, it, vi } from 'vitest';

import { ROOM_COLORS } from '../src/constants.js';
import { colorizeSprite } from '../src/office/colorize.js';
import { type RoomProjection, roomProjection } from '../src/office/roomProjection.js';
import { MAX_COLS, MAX_ROWS, type OfficeLayout, TileType } from '../src/office/types.js';

afterEach(() => vi.unstubAllGlobals());

// The node test project has no browser typings. Exercise the actual renderer
// with just the drawing surface it uses, leaving the DOM contract to the app build.
const { drawRoomShell } = await vi.importActual<{
  drawRoomShell(
    screen: { drawImage: ReturnType<typeof vi.fn> },
    layout: OfficeLayout,
    projection: RoomProjection,
    zoom: number,
    hovered: null,
  ): void;
}>('../src/office/engine/roomShell.js');

function shellCapture() {
  const paints = new Set<string>();
  const offscreen = vi.fn(() => ({
    width: 0,
    height: 0,
    getContext: () => ({
      set fillStyle(color: string) {
        paints.add(color);
      },
      fillRect() {},
    }),
  }));
  vi.stubGlobal('document', { createElement: offscreen });
  const blit = vi.fn();
  const screen = { drawImage: blit };
  return {
    paints,
    offscreen,
    blit,
    draw(layout: OfficeLayout) {
      drawRoomShell(
        screen,
        layout,
        roomProjection(640, 480, layout.cols, layout.rows, 1, 0, 0),
        1,
        null,
      );
    },
  };
}

it('the bundled layout uses its authored materials and a repeated draw reuses the native image', () => {
  const layout = JSON.parse(
    readFileSync(new URL('../public/assets/default-layout-1.json', import.meta.url), 'utf8'),
  ) as OfficeLayout;
  const capture = shellCapture();
  capture.draw(layout);
  expect(capture.paints).toContain(ROOM_COLORS.lightWall.panel);
  expect(capture.paints).toContain(ROOM_COLORS.floor[6][0]);
  expect(capture.paints).toContain(ROOM_COLORS.floor[0][0]);
  expect(capture.paints).toContain(ROOM_COLORS.floor[8][0]);
  const image = capture.blit.mock.calls[0][0];
  // A diagonal step is half of a native 64-pixel tile. The margin is outside the room.
  expect(image.width).toBeGreaterThanOrEqual((layout.cols + layout.rows) * 32);
  capture.draw(layout);
  expect(capture.offscreen).toHaveBeenCalledTimes(1);
  expect(capture.blit.mock.calls[1][0]).toBe(image);
});

it('repainting wood and plaster tints their faces and detailing', () => {
  const color = { h: 280, s: 62, b: 0, c: 0 };
  const capture = shellCapture();
  capture.draw({
    version: 1,
    cols: 1,
    rows: 2,
    tiles: [TileType.WALL, TileType.FLOOR_7],
    furniture: [],
    tileColors: [color, color],
  });
  for (const swatch of [
    ROOM_COLORS.lightWall.panel,
    ROOM_COLORS.floor[6][1],
    ROOM_COLORS.woodSeam,
  ]) {
    expect(capture.paints).toContain(colorizeSprite([[swatch]], color)[0][0]);
  }
});

it('fits the largest layout within a bounded backing canvas', () => {
  const capture = shellCapture();
  capture.draw({
    version: 1,
    cols: MAX_COLS,
    rows: MAX_ROWS,
    tiles: Array(MAX_COLS * MAX_ROWS).fill(TileType.VOID),
    furniture: [],
  });
  const { width, height } = capture.blit.mock.calls[0][0];
  expect(width * height).toBeLessThanOrEqual(8 * 1024 * 1024);
  expect(width).toBeLessThanOrEqual(4096);
});
