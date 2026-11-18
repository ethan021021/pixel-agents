import type { RoomBox, RoomModel, RoomModelInput } from '../roomModel.js';
import { TILE_SIZE } from '../types.js';

type Faces = RoomBox['colors'];
const solid = (color: string): Faces => [color, color, color];

/* eslint-disable pixel-agents/no-inline-colors -- Original palette data for the accessory models. */
const ink = {
  walnut: ['#a37044', '#583825', '#744a2e'],
  walnutEdge: ['#e3a16c', '#88543c', '#b1764e'],
  caseInterior: ['#372c38', '#211e2a', '#2d2632'],
  brass: ['#f4ce80', '#987247', '#c19a59'],
  bezel: ['#e7d6b2', '#938163', '#b6a487'],
  shell: ['#f3e3bf', '#9c8969', '#c7b393'],
  petrol: ['#47777b', '#243e4e', '#365861'],
  petrolEdge: ['#619690', '#3b6268', '#527c7e'],
  keys: ['#505a5c', '#303c43', '#404b50'],
  keycaps: ['#d4ccb0', '#777568', '#a49d86'],
  cup: ['#eee3c6', '#918a70', '#bcaf92'],
  clay: ['#ba805b', '#783f32', '#9c5740'],
  clayFoot: ['#935c4a', '#644034', '#7c4d3e'],
  clayEdge: ['#df9d70', '#915441', '#be7052'],
  jade: ['#55948a', '#2e5359', '#42716f'],
  jadeFoot: ['#467472', '#2b434c', '#3c5c62'],
  jadeEdge: ['#93b6a0', '#466b68', '#67938a'],
  leafDark: ['#54895c', '#203d36', '#2f6048'],
  leaf: ['#75a667', '#315d43', '#4c8554'],
  leafLight: ['#a7bb6a', '#547344', '#6d9956'],
  cactus: ['#81a16b', '#385c49', '#527c55'],
  bin: ['#6c8780', '#354a4d', '#4c6563'],
  binRim: ['#9daea0', '#4f6661', '#788f84'],
  screenOff: solid('#263331'),
  screenGlass: solid('#435855'),
  screenOn: solid('#20473d'),
  screenTrim: solid('#21323a'),
  phosphor: solid('#8dde8e'),
  signal: solid('#d6b46b'),
  soil: solid('#3d3029'),
  rope: solid('#b59a73'),
  paper: solid('#ddd1ac'),
  hand: solid('#4b493c'),
  coffee: solid('#6c3c2c'),
  foam: solid('#c89b6a'),
  binInterior: solid('#263c3c'),
  sky: solid('#848f97'),
  hill: solid('#5b7467'),
  grass: solid('#a0a16c'),
  sun: solid('#efd091'),
  rust: solid('#b36e57'),
  boardInk: solid('#648577'),
} as const satisfies Record<string, Faces>;

const bookColors: Faces[] = [
  ['#dd7963', '#783a3b', '#aa544e'],
  ['#62ab9f', '#345d60', '#46837e'],
  ['#ecc181', '#886247', '#bb915f'],
  ['#758db5', '#45516d', '#5b7191'],
  ['#b794ba', '#634867', '#8b678c'],
];
/* eslint-enable pixel-agents/no-inline-colors */

function box(
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  colors: Faces,
): RoomBox {
  return { x, y, z, width, depth, height, colors };
}

/** Shift the model's center onto its footprint and turn the face toward the chair. */
function computer(input: RoomModelInput): RoomModel {
  const lit = input.type.includes('_ON_');
  const cursor = input.type.endsWith('_2') ? 1.2 : input.type.endsWith('_3') ? 2.4 : 0;
  const pieces = [
    box(-5.5, -6, 0, 11, 9, 1.5, ink.keys),
    box(-5, -6.5, 1.5, 10.5, 8.5, 9.5, ink.petrol),
    box(-6.5, -1.5, 1.5, 13, 4, 11.5, ink.petrol),
    box(-5.7, -1.15, 13, 11.4, 4.65, 1, ink.petrolEdge),
    box(-6.5, 1.1, 1.5, 13, 2.4, 11.5, ink.shell),
    box(6.5, -0.75, 9.5, 0.25, 1.75, 0.55, ink.keys),
    box(6.5, -0.75, 8.4, 0.25, 1.75, 0.55, ink.keys),
    box(-5.35, 3.5, 4.05, 10.7, 0.54, 8.1, ink.bezel),
    box(-4.8, 4.04, 4.7, 9.6, 0.25, 6.85, ink.screenTrim),
    box(-4.15, 4.29, 5.3, 8.3, 0.15, 5.65, lit ? ink.screenOn : ink.screenOff),
    box(-3.55, 4.44, 10.35, 7.1, 0.2, 0.55, ink.screenGlass),
    box(3.9, 3.55, 2.55, 1.2, 0.45, 0.6, lit ? ink.phosphor : ink.signal),
    box(-4.4, 3.55, 2.35, 3.8, 0.45, 0.55, ink.keys),
    ...(lit
      ? [
          box(-3.5, 4.44, 8.8, 5.9, 0.25, 0.48, ink.phosphor),
          box(-3.5, 4.44, 7.45, 4.4, 0.25, 0.48, ink.phosphor),
          box(-3.5 + cursor, 4.44, 6.3, 1.1, 0.25, 0.56, ink.phosphor),
        ]
      : []),
    box(-6.1, 5.9, 0, 11.35, 4.4, 0.95, ink.petrol),
    box(-5.55, 6.55, 0.95, 6.7, 1.8, 0.35, ink.keycaps),
    box(1.95, 6.55, 0.95, 2.55, 2.35, 0.35, ink.keycaps),
    box(-4.1, 9.18, 0.95, 4.4, 0.55, 0.35, ink.keycaps),
    box(6.15, 6.5, 0, 2.25, 3.4, 1.15, ink.shell),
  ];
  const cx = input.width / 2;
  const cy = Math.max(input.backgroundRows * TILE_SIZE, input.depth - TILE_SIZE) + 7.5;
  return {
    boxes: pieces.map((part) => {
      const { x, z, width, height, colors } = part;
      const y = part.y * 0.74;
      const depth = part.depth * 0.74;
      const floor = z + input.surfaceHeight;
      switch (input.orientation) {
        case 'left':
          return box(cx + y, cy - x - width, floor, depth, width, height, colors);
        case 'right':
        case 'side':
          return box(cx - y - depth, cy + x, floor, depth, width, height, colors);
        case 'back':
          return box(cx - x - width, cy - y - depth, floor, width, depth, height, colors);
        default:
          return box(cx + x, cy + y, floor, width, depth, height, colors);
      }
    }),
  };
}

function planter(x: number, y: number, z: number, size: number, glazed = false): RoomBox[] {
  const body = glazed ? ink.jade : ink.clay;
  const rim = glazed ? ink.jadeEdge : ink.clayEdge;
  const inset = (gap: number, heightFromBase: number, height: number, colors: Faces) =>
    box(
      x - size / 2 + gap,
      y - size / 2 + gap,
      z + heightFromBase,
      size - 2 * gap,
      size - 2 * gap,
      height,
      colors,
    );
  return [
    inset(0.75, 0, 1.1, glazed ? ink.jadeFoot : ink.clayFoot),
    inset(1, 1.1, 1.1, body),
    inset(0.75, 2.2, 2.3, body),
    inset(0.7, 2.8, 0.55, rim),
    inset(0, 4.5, 1.35, rim),
    inset(1.15, 5.86, 0.18, ink.soil),
  ];
}

function foliage(x: number, y: number, z: number, scale: number): RoomBox[] {
  const leaf = (
    dx: number,
    dy: number,
    dz: number,
    w: number,
    d: number,
    h: number,
    colors: Faces,
  ) => box(x + dx * scale, y + dy * scale, z + dz * scale, w * scale, d * scale, h * scale, colors);
  return [
    leaf(-0.6, -0.6, 0, 1.2, 1.2, 10, ink.leafDark),
    leaf(-3.8, -2.25, 5.4, 3.3, 2.4, 3.4, ink.leafDark),
    leaf(-5.6, -2.45, 6.9, 3.8, 2, 2.1, ink.leaf),
    leaf(0.7, -2, 8.8, 2.75, 2.5, 4.3, ink.leafDark),
    leaf(2.3, -2.4, 11, 3.6, 2.3, 2.6, ink.leafLight),
    leaf(-1.5, -0.9, 10.1, 2.6, 2.5, 4.4, ink.leafDark),
    leaf(-1.1, -0.95, 13, 2.15, 2.2, 2.25, ink.leafLight),
    leaf(-0.8, 0.7, 5.1, 3, 2.55, 3.25, ink.leaf),
    leaf(1.35, 1.45, 6.2, 3.8, 2.2, 2.5, ink.leafLight),
    leaf(-3.85, 1.15, 3.7, 3.9, 2.6, 2.15, ink.leafDark),
  ];
}

function floorPlant(input: RoomModelInput): RoomModel {
  const x = input.width / 2;
  const y = input.depth - TILE_SIZE / 2;
  const z = input.surfaceHeight;
  const large = input.type === 'LARGE_PLANT';
  const boxes = planter(
    x,
    y,
    z,
    large ? 12 : 8,
    input.type === 'PLANT_2' || input.type === 'CACTUS',
  );
  if (input.type === 'POT') return { boxes };
  if (input.type === 'CACTUS') {
    boxes.push(
      box(x - 1.9, y - 1.6, z + 5, 3.8, 3.3, 11.5, ink.cactus),
      box(x - 4.2, y - 0.75, z + 8, 3, 2, 2, ink.leaf),
      box(x - 4.2, y - 0.75, z + 10, 1.65, 2, 3.15, ink.cactus),
      box(x + 1.4, y - 0.75, z + 10.4, 3.25, 2, 1.8, ink.leaf),
      box(x + 3.2, y - 0.75, z + 12.2, 1.5, 2, 2.9, ink.cactus),
    );
  } else {
    const scale = large ? 1.35 : input.type === 'PLANT' ? 1.05 : 0.8;
    boxes.push(...foliage(x, y, z + 5.5, scale));
  }
  return { boxes };
}

/** Wall objects share the same relief geometry, turned onto the west wall as needed. */
function wallModel(input: RoomModelInput, boxes: RoomBox[]): RoomModel {
  return {
    boxes: boxes.map((part) =>
      input.wallAlongX
        ? part
        : {
            ...part,
            x: part.y,
            y: part.x,
            width: part.depth,
            depth: part.width,
          },
    ),
  };
}

function hangingPlant(input: RoomModelInput): RoomModel {
  const center = input.width / 2;
  return wallModel(input, [
    box(center - 1.2, 1, 35, 2.4, 1.9, 1.2, ink.brass),
    box(center - 0.35, 2, 26, 0.7, 0.7, 9, ink.rope),
    box(center - 2.35, 4.9, 20, 0.65, 0.65, 7.5, ink.rope),
    box(center + 2, 4.9, 20, 0.65, 0.65, 7.5, ink.rope),
    ...planter(center, 5.5, 15, 7.2, true),
    ...foliage(center, 5.5, 20, 0.7),
    box(center - 4.2, 7.5, 15.6, 1.65, 1.9, 5.3, ink.leaf),
    box(center + 3.2, 7.9, 13.3, 1.35, 1.9, 5.9, ink.leafDark),
  ]);
}

function bookshelf(input: RoomModelInput): RoomModel {
  const width = input.width - 4;
  const levels = input.type === 'DOUBLE_BOOKSHELF' ? 2 : 1;
  const base = levels === 2 ? 12 : 19;
  const boxes = [box(2, 0.5, base, width, 2.6, 2 + levels * 10, ink.caseInterior)];
  for (let level = 0; level < levels; level++) {
    const z = base + level * 10;
    const spines = Math.floor((width - 11) / 3);
    boxes.push(
      box(2, 0.5, z, width, 6, 1.7, ink.walnut),
      box(2, 6.5, z + 0.6, width, 0.13, 1.1, ink.walnutEdge),
    );
    for (let spine = 0; spine < spines; spine++) {
      const x = 4.2 + spine * 3 + level * 3.7;
      const height = 4.1 + ((spine * 3 + level) % 4);
      boxes.push(
        box(
          x,
          3.1,
          z + 1.7,
          spine % 3 === 1 ? 2.65 : 2.05,
          2.85,
          height,
          bookColors[(spine + 2 * level) % bookColors.length],
        ),
      );
      if (spine % 3 !== 1) {
        boxes.push(box(x + 0.3, 5.95, z + 3, 1.45, 0.18, 0.55, ink.paper));
      }
    }
    if (spines > 2) {
      const x = level === 0 ? width - 4.3 : 4.1;
      boxes.push(
        box(x, 3.3, z + 1.7, 5, 2.9, 1.5, bookColors[2]),
        box(x + 0.4, 3.4, z + 3.2, 4.2, 2.65, 1.4, bookColors[0]),
      );
    }
  }
  boxes.push(
    box(1.5, 0.5, base, 1.7, 6.15, 2 + levels * 10, ink.walnut),
    box(input.width - 3.2, 0.5, base, 1.7, 6.15, 2 + levels * 10, ink.walnut),
    box(1.4, 0.5, base + levels * 10, width + 1.2, 6.2, 1.85, ink.walnutEdge),
    box(2.05, 6.36, base + levels * 10 - 0.45, width - 0.1, 0.28, 0.63, ink.brass),
  );
  return wallModel(input, boxes);
}

function frame(input: RoomModelInput): RoomModel {
  const large = input.type === 'LARGE_PAINTING' || input.type === 'WHITEBOARD';
  const width = input.width - (large ? 6 : 4);
  const x = (input.width - width) / 2;
  const z = large ? 16 : 20;
  const height = large ? 15 : 11;
  const variant = input.type === 'SMALL_PAINTING_2';
  const boxes = [
    box(x, 0.45, z, width, 1.35, height, ink.walnut),
    box(x + 0.8, 1.8, z + 0.8, width - 1.6, 0.35, height - 1.6, ink.brass),
    box(x + 1.6, 2.15, z + 1.5, width - 3.2, 0.4, height - 3, ink.paper),
  ];
  if (input.type === 'WHITEBOARD') {
    boxes.push(
      box(x + 4, 2.55, z + 8.2, 8, 0.22, 0.65, ink.boardInk),
      box(x + 4, 2.55, z + 5.9, 11, 0.22, 0.65, ink.boardInk),
      box(x + 4, 2.55, z + 3.6, 6, 0.22, 0.65, ink.boardInk),
      box(x + 16, 2.55, z + 4.2, 4, 0.22, 5.15, ink.sky),
      box(x + 5, 1.3, z + 0.4, width - 9, 3, 1.2, ink.bezel),
      box(x + 7, 2.2, z + 1.61, 4, 1.2, 0.55, ink.boardInk),
    );
  } else {
    const artWidth = width - 5;
    const artX = x + 2.5;
    boxes.push(
      box(artX, 2.55, z + 2.5, artWidth, 0.2, height - 5, variant ? ink.rust : ink.sky),
      box(artX + artWidth * 0.64, 2.75, z + height - 5.3, 1.8, 0.2, 1.8, ink.sun),
      box(artX, 2.75, z + 2.5, artWidth * 0.66, 0.2, 3.1, ink.hill),
      box(artX + artWidth * 0.22, 2.75, z + 5.6, artWidth * 0.24, 0.2, 1.55, ink.hill),
      box(artX + artWidth * 0.55, 2.75, z + 2.5, artWidth * 0.45, 0.2, 2.1, ink.grass),
    );
  }
  return wallModel(input, boxes);
}

function clock(input: RoomModelInput): RoomModel {
  const x = (input.width - 11) / 2;
  return wallModel(input, [
    box(x + 1.2, 0.5, 19, 8.6, 1.65, 11, ink.walnut),
    box(x, 0.5, 20.2, 11, 1.65, 8.6, ink.walnutEdge),
    box(x + 1.35, 2.15, 20.35, 8.3, 0.65, 8.3, ink.paper),
    box(x + 5.17, 2.8, 24, 0.72, 0.24, 3.8, ink.hand),
    box(x + 5.17, 3.05, 24, 2.63, 0.23, 0.72, ink.hand),
    box(x + 3, 2.8, 22.05, 0.65, 0.24, 0.65, ink.rust),
    box(x + 8.1, 2.8, 26.8, 0.65, 0.24, 0.65, ink.rust),
  ]);
}

function coffee(input: RoomModelInput): RoomModel {
  const x = input.width / 2;
  const y = input.depth / 2;
  const z = input.surfaceHeight;
  return {
    boxes: [
      box(x - 4, y - 3.6, z, 8, 7.2, 0.9, ink.cup),
      box(x - 2.5, y - 2.35, z + 0.9, 5, 4.7, 3.55, ink.cup),
      box(x + 2.5, y - 0.9, z + 1.55, 1.9, 1.65, 0.65, ink.cup),
      box(x + 3.7, y - 0.9, z + 2.2, 0.7, 1.65, 1.35, ink.cup),
      box(x + 2.5, y - 0.9, z + 3.55, 1.9, 1.65, 0.65, ink.cup),
      box(x - 1.65, y - 1.6, z + 4.46, 3.3, 3.2, 0.18, ink.coffee),
      box(x - 1.35, y - 1.35, z + 4.65, 2, 0.65, 0.15, ink.foam),
    ],
  };
}

function bin(input: RoomModelInput): RoomModel {
  const x = input.width / 2;
  const y = input.depth / 2;
  const boxes = [
    box(x - 3.6, y - 3.6, 0, 7.2, 7.2, 1.5, ink.binInterior),
    box(x - 4.25, y - 4.25, 1.5, 8.5, 8.5, 8.8, ink.bin),
    box(x - 4.8, y - 4.8, 10.3, 9.6, 9.6, 1, ink.binRim),
    box(x - 3.65, y - 3.65, 11.31, 7.3, 7.3, 0.2, ink.binInterior),
  ];
  for (const offset of [-2.5, 0, 2.5]) {
    boxes.push(
      box(x + offset, y + 4.25, 3, 0.55, 0.24, 5.4, ink.binRim),
      box(x + 4.25, y + offset, 3, 0.24, 0.55, 5.4, ink.binInterior),
    );
  }
  return { boxes };
}

export function roomAccessoryModel(input: RoomModelInput): RoomModel | null {
  switch (input.type) {
    case 'PC_FRONT_OFF':
    case 'PC_FRONT_ON_1':
    case 'PC_FRONT_ON_2':
    case 'PC_FRONT_ON_3':
    case 'PC_BACK':
    case 'PC_SIDE':
    case 'PC_SIDE:left':
      return computer(input);
    case 'HANGING_PLANT':
      return input.surfaceHeight > 0 ? floorPlant(input) : hangingPlant(input);
    case 'PLANT':
    case 'PLANT_2':
    case 'LARGE_PLANT':
    case 'CACTUS':
    case 'POT':
      return floorPlant(input);
    case 'BOOKSHELF':
    case 'DOUBLE_BOOKSHELF':
      return bookshelf(input);
    case 'SMALL_PAINTING':
    case 'SMALL_PAINTING_2':
    case 'LARGE_PAINTING':
    case 'WHITEBOARD':
      return frame(input);
    case 'CLOCK':
      return clock(input);
    case 'COFFEE':
      return coffee(input);
    case 'BIN':
      return bin(input);
    default:
      return null;
  }
}
