import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';
import { expect, it } from 'vitest';

import { rgbaToHex } from '../../core/src/assets/colorUtils.js';
import {
  CHAR_FRAME_H,
  CHAR_FRAME_W,
  CHAR_FRAMES_PER_ROW,
  CHARACTER_DIRECTIONS,
  ROOM_ANIMATED_FRAME_COUNT,
  ROOM_SHEET_FRAME,
} from '../../core/src/assets/constants.js';
import { decodeCharacterPng } from '../../core/src/assets/pngDecoder.js';
import { SEATED_FRAME } from '../../core/src/assets/seatedFrame.js';
import type { CharacterProfile } from '../../core/src/characterProfiles.js';
import { DEFAULT_CHARACTER_PROFILES } from '../../core/src/defaultCharacterProfiles.js';
import {
  setExternalCharacterSprites,
  sheetToOfficeSprites,
  startOfficeSync,
} from '../src/characters/officeSprites.js';
import { CharacterRenderer } from '../src/characters/renderer.js';
import { EYE_FOLDERS } from '../src/characters/slots.js';
import { decodeWardrobe, parseWardrobeManifest, type Rgba } from '../src/characters/wardrobe.js';
import { VISITOR_WAVE_BEAT_SEC, VISITOR_WAVE_SEC } from '../src/constants.js';
import { createCharacter, flatCharacterFrame } from '../src/office/engine/characters.js';
import { OfficeState } from '../src/office/engine/officeState.js';
import { roomCastSprite } from '../src/office/engine/roomCast.js';
import { roomCharacterFrame } from '../src/office/engine/roomCharacterFrame.js';
import type { RoomSeatArt } from '../src/office/engine/roomFurnitureArt.js';
import { ROOM_GROUND_SCALE } from '../src/office/roomProjection.js';
import {
  getCharacterRoomCastIndex,
  getCharacterSprites,
} from '../src/office/sprites/spriteData.js';
import { setProviderCapabilities } from '../src/office/toolUtils.js';
import { CharacterState, Direction, TILE_SIZE } from '../src/office/types.js';

const art = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/characters/art');
const files = new Map<string, Rgba>(
  fs
    .readdirSync(art, { recursive: true, encoding: 'utf-8' })
    .filter((f) => f.endsWith('.png'))
    .map((f) => {
      const img = PNG.sync.read(fs.readFileSync(path.join(art, f)));
      const key = f
        .split(path.sep)
        .join('/')
        .replace(/\.png$/, '');
      return [key, { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) }];
    }),
);
const manifest = parseWardrobeManifest(
  JSON.parse(fs.readFileSync(path.join(art, 'wardrobe.json'), 'utf-8')),
);
const renderer = new CharacterRenderer(decodeWardrobe(manifest, files, EYE_FOLDERS));

function sync(profiles: readonly CharacterProfile[]): () => void {
  const state = { renderer, profiles };
  return startOfficeSync({ subscribe: () => () => {}, getState: () => state as never });
}

const differs = (a: string[][], b: string[][]) =>
  a.some((row, y) => row.some((px, x) => px !== b[y][x]));

it('office characters shut their eyes mid-blink, facing the viewer', () => {
  const stop = sync(DEFAULT_CHARACTER_PROFILES);
  DEFAULT_CHARACTER_PROFILES.forEach((_, i) => {
    const open = getCharacterSprites(i, 0, false);
    const shut = getCharacterSprites(i, 0, true);
    expect(differs(open.typing[Direction.DOWN][0], shut.typing[Direction.DOWN][0])).toBe(true);
    expect(differs(open.walk[Direction.DOWN][1], shut.walk[Direction.DOWN][1])).toBe(true);
    // A repeat blinks in its own clothes.
    const repeatShut = getCharacterSprites(i, 1, true);
    expect(differs(repeatShut.walk[Direction.DOWN][1], shut.walk[Direction.DOWN][1])).toBe(true);
  });
  stop();
});

it('a character whose eyes are always shut has no blink', () => {
  const closed = { ...DEFAULT_CHARACTER_PROFILES[0], eyeShape: 'closed' };
  const stop = sync([closed]);
  expect(getCharacterSprites(0, 0, true)).toBe(getCharacterSprites(0, 0, false));
  stop();
});

it('dresses the matching preset after a reorder and restores its wardrobe when edited', () => {
  const [suit, dress] = DEFAULT_CHARACTER_PROFILES;
  const frames = Array.from({ length: 8 }, () => [[rgbaToHex(255, 241, 119, 255)]]);
  const sprites = { down: frames, up: frames, right: frames };
  setExternalCharacterSprites([], [{ profileId: 'char-0', sprites }]);
  let stop = sync([dress, { ...suit, name: 'Renamed' }]);
  try {
    expect(getCharacterRoomCastIndex(0)).toBe(1);
    expect(getCharacterSprites(1, 0, true).walk[Direction.DOWN][1]).toBe(frames[1]);
    stop();
    const edited = {
      ...suit,
      colors: { ...suit.colors, skin: { h: 0, s: 0, b: 0, c: 0, palette: 'Dark' } },
    };
    stop = sync([edited]);
    expect(getCharacterSprites(0).walk[Direction.DOWN][1]).toEqual(
      sheetToOfficeSprites(renderer.sheet(edited)).down[1],
    );
    stop();
    setExternalCharacterSprites([]);
    stop = sync([suit]);
    expect(getCharacterRoomCastIndex(0)).toBe(0);
  } finally {
    setExternalCharacterSprites([]);
    stop();
  }
});

it('keeps bundled room designs through renames and reordering while preserving other looks', () => {
  const [suit, dress, spike] = DEFAULT_CHARACTER_PROFILES;
  const renamedAndReordered = {
    ...(Object.fromEntries(Object.entries(spike).reverse()) as CharacterProfile),
    name: 'New label',
  };
  const recolored = {
    ...dress,
    colors: { ...dress.colors, skin: { h: 0, s: 0, b: 0, c: 0, palette: 'Dark' } },
  };
  const duplicate = { ...suit, id: 'my-suit' };
  const frames = Array.from({ length: 8 }, () => [[rgbaToHex(255, 17, 113, 255)]]);
  setExternalCharacterSprites([{ down: frames, right: frames, up: frames }]);
  const stop = sync([renamedAndReordered, recolored, duplicate, suit]);
  try {
    expect(getCharacterRoomCastIndex(0)).toBe(2);
    expect(getCharacterRoomCastIndex(1)).toBeUndefined();
    expect(getCharacterRoomCastIndex(2)).toBeUndefined();
    expect(getCharacterRoomCastIndex(3)).toBe(0);
    expect(getCharacterRoomCastIndex(4)).toBeUndefined();
    expect(getCharacterSprites(0).walk[Direction.DOWN][1]).toEqual(
      sheetToOfficeSprites(renderer.sheet(spike)).down[1],
    );

    const projection = { toScreen: (x: number, y: number) => ({ x, y }) };
    const character = createCharacter(1, 3, null, null, 2);
    expect(roomCharacterFrame(character, projection, 1).pixels).toBe(
      roomCastSprite(0, Direction.DOWN, false, {}, 2),
    );
    const edited = createCharacter(3, 1, null, null);
    expect(roomCharacterFrame(edited, projection, 1).nativeScale).toBe(2);
    const external = createCharacter(2, 4, null, null);
    expect(roomCharacterFrame(external, projection, 1).pixels).toEqual(frames[0]);
  } finally {
    setExternalCharacterSprites([]);
    stop();
  }
});

it.each([
  {
    width: CHAR_FRAME_W,
    height: CHAR_FRAME_H,
    scale: 1,
    hipY: CHAR_FRAME_H - 8,
    columns: CHAR_FRAMES_PER_ROW,
  },
  { ...ROOM_SHEET_FRAME, columns: CHAR_FRAMES_PER_ROW },
  { ...ROOM_SHEET_FRAME, columns: ROOM_ANIMATED_FRAME_COUNT },
])('preserves $columns poses of $width×$height and anchors their hips to the cushion', (frame) => {
  const png = new PNG({
    width: frame.width * frame.columns,
    height: frame.height * CHARACTER_DIRECTIONS.length,
  });
  // Every column, facing and mirrored edge has its own color and half-alpha edge.
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      png.data.set(
        [x % 256, y % 256, 113, x % frame.width === 0 ? 128 : 255],
        (y * png.width + x) * 4,
      );
    }
  }
  const imported = decodeCharacterPng(PNG.sync.write(png));
  for (const [row, dir] of CHARACTER_DIRECTIONS.entries()) {
    expect(imported[dir]).toHaveLength(frame.columns);
    for (const [column, pixels] of imported[dir].entries()) {
      expect(pixels).toHaveLength(frame.height);
      expect(pixels[0]).toHaveLength(frame.width);
      expect(pixels[frame.height - 1][0]).toBe(
        rgbaToHex((column * frame.width) % 256, ((row + 1) * frame.height - 1) % 256, 113, 128),
      );
    }
  }
  setExternalCharacterSprites([imported]);
  const stop = sync([DEFAULT_CHARACTER_PROFILES[0]]);
  setProviderCapabilities({ readingTools: ['Read'], subagentToolNames: [] });
  try {
    const directions = [
      [Direction.DOWN, imported.down],
      [Direction.UP, imported.up],
      [Direction.RIGHT, imported.right],
      [
        Direction.LEFT,
        (frame.scale > 1 ? imported.up : imported.right).map((f) =>
          f.map((row) => [...row].reverse()),
        ),
      ],
    ] as const;
    const poses = [
      { state: CharacterState.IDLE, isActive: false, currentTool: null, frame: 0, source: 1 },
      { state: CharacterState.WALK, isActive: false, currentTool: null, frame: 2, source: 2 },
      {
        state: CharacterState.WALK,
        isActive: false,
        currentTool: null,
        frame: 1,
        source: frame.columns === ROOM_ANIMATED_FRAME_COUNT ? 8 : 1,
      },
      {
        state: CharacterState.WALK,
        isActive: false,
        currentTool: null,
        frame: 3,
        source: frame.columns === ROOM_ANIMATED_FRAME_COUNT ? 9 : 1,
      },
      ...[0, 1, 2].map((beat) => ({
        state: CharacterState.IDLE,
        isActive: false,
        currentTool: null,
        frame: 0,
        visitorWave: VISITOR_WAVE_SEC - (beat + 0.25) * VISITOR_WAVE_BEAT_SEC,
        source: frame.columns === ROOM_ANIMATED_FRAME_COUNT ? 10 + beat : 1,
      })),
      { state: CharacterState.TYPE, isActive: true, currentTool: null, frame: 1, source: 4 },
      { state: CharacterState.TYPE, isActive: true, currentTool: 'Read', frame: 1, source: 6 },
      {
        state: CharacterState.TYPE,
        isActive: false,
        currentTool: null,
        frame: 0,
        source: SEATED_FRAME,
      },
    ];
    const pixels = [[rgbaToHex(90, 60, 30, 255)]];
    const seat: RoomSeatArt = {
      x: 37,
      y: 49,
      z: 6,
      chair: {
        pixels,
        furniture: { sprite: pixels, x: 35, y: 35, zY: 56 },
        model: { sprite: { pixels, left: 0, top: 0 }, x: 35, y: 35, depthX: 39, depthY: 57 },
      },
    };
    const zoom = 2;
    const projection = { toScreen: (x: number, y: number) => ({ x: x * zoom, y: y * zoom }) };
    const cushion = projection.toScreen(seat.x, seat.y);
    if (frame.scale > 1) {
      const office = new OfficeState();
      const agent = createCharacter(3, 1, null, null);
      office.characters.set(agent.id, agent);
      const flat = flatCharacterFrame(agent);
      expect(flat.nativeScale).toBe(ROOM_SHEET_FRAME.scale);
      expect(flat.width).toBe(frame.width / frame.scale);
      // The upper corner is beyond the legacy 16×24 click rectangle but is painted.
      const inside = 0.25;
      expect(office.getCharacterAt(flat.x + inside, flat.y + inside)).toBe(agent.id);
      expect(office.getCharacterAt(flat.x - inside, flat.y + inside)).toBeNull();
    }
    for (const [dir, frames] of directions) {
      for (const { source, ...pose } of poses) {
        const character = { ...createCharacter(3, 1, 'chair', null), dir, blinkShut: 1, ...pose };
        const rendered = roomCharacterFrame(character, projection, zoom, seat);
        expect(rendered.pixels).toEqual(frames[source]);
        expect(rendered.width).toBe(
          frame.scale > 1 ? 2 * TILE_SIZE * ROOM_GROUND_SCALE * zoom : frame.width * zoom,
        );
        if (dir !== Direction.LEFT) expect(rendered.pixels).toBe(frames[source]);
        if (pose.state === CharacterState.TYPE) {
          expect(rendered.cushion).toBe(seat);
          expect(rendered.x + (frame.width / 2) * rendered.pixelZoom).toBe(cushion.x);
          expect(rendered.y + frame.hipY * rendered.pixelZoom).toBe(cushion.y - seat.z * zoom);
          expect(rendered.depth).toBe(57 * zoom + 0.01);
        } else {
          expect(rendered.cushion).toBeUndefined();
        }
      }
    }
  } finally {
    setProviderCapabilities({ readingTools: [], subagentToolNames: [] });
    setExternalCharacterSprites([]);
    stop();
  }
});
