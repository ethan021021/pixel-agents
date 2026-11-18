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
  shell: ['#f2e8cd', '#a2977c', '#c9bea2'],
  caseShade: ['#d8ccb2', '#8c826c', '#b1a78f'],
  caseEdge: ['#fcf3dc', '#b3a78a', '#ded1b4'],
  keys: ['#817965', '#514c40', '#666052'],
  keycaps: ['#e6dcbd', '#ab9c82', '#c2b398'],
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
  screenOff: solid('#34473a'),
  screenGlass: solid('#576649'),
  screenOn: solid('#355e38'),
  screenTrim: solid('#21323a'),
  phosphor: solid('#b6d978'),
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
  const panel = [
    box(-6.2, 1.1, 2.25, 12.4, 1.45, 10.4, ink.caseEdge),
    box(-5.45, 2.55, 3.25, 10.9, 0.28, 8.5, ink.bezel),
    box(-4.8, 2.83, 4.25, 9.6, 0.18, 6.8, ink.screenTrim),
    box(-4.4, 3.01, 4.6, 8.8, 0.14, 6, lit ? ink.screenOn : ink.screenOff),
    box(-3.9, 3.15, 10, 7.85, 0.15, 0.34, ink.screenGlass),
    box(-4.2, 2.83, 2.95, 3.05, 0.28, 0.4, ink.keys),
    box(3.7, 2.83, 2.95, 0.9, 0.28, 0.4, lit ? ink.phosphor : ink.signal),
  ];
  if (lit) {
    panel.push(
      box(-3.6, 3.15, 8.65, 0.5, 0.18, 0.4, ink.phosphor),
      box(-2.85, 3.15, 8.28, 0.65, 0.18, 0.4, ink.phosphor),
      box(-3.6, 3.15, 7.9, 0.5, 0.18, 0.4, ink.phosphor),
      box(-1.45, 3.15, 8.12, 3.5, 0.18, 0.4, ink.phosphor),
      box(-3.6 + cursor, 3.15, 6.35, 1.15, 0.18, 0.55, ink.phosphor),
    );
  }
  const keyboard = [
    box(-6.1, 4.05, 0, 10.3, 5.1, 1, ink.bezel),
    box(-5.75, 4.4, 1, 9.6, 4.4, 0.55, ink.caseShade),
    box(-5.25, 4.9, 1.55, 8.6, 3.3, 0.18, ink.keys),
  ];
  for (let row = 0; row < 3; row++) {
    for (let key = 0; key < 8; key++) {
      keyboard.push(
        box(-5.11 + key * 1.05, 5.05 + row * 0.76, 1.73, 0.82, 0.55, 0.22, ink.keycaps),
      );
    }
  }
  keyboard.push(
    box(-4.3, 7.45, 1.73, 4.8, 0.55, 0.22, ink.keycaps),
    box(0.95, 7.45, 1.73, 2, 0.55, 0.22, ink.keycaps),
    box(5.15, 5.5, 0, 2.45, 3.1, 0.6, ink.bezel),
    box(5.5, 5.8, 0.6, 1.75, 2.35, 0.65, ink.shell),
  );
  const frontVisible =
    input.orientation !== 'back' && input.orientation !== 'right' && input.orientation !== 'side';
  const housing = [
    box(-5.75, -5.9, 0, 11.5, 8.75, 1.25, ink.keys),
    box(-6.1, -6.2, 1.25, 12.2, 9, 1, ink.bezel),
    box(-5.1, -6.1, 2.25, 10.2, 7.2, 8.3, ink.caseShade),
    box(-5.65, -4.35, 2.25, 11.3, 6.2, 9.9, ink.shell),
    box(-6.2, -2.5, 2.25, 12.4, 4.1, 10.4, ink.shell),
    box(-5.8, -2.1, 12.65, 11.6, 3.4, 0.55, ink.caseEdge),
  ];
  // The rear casing really hides the glass and keyboard when the monitor turns.
  const pieces = frontVisible
    ? [...housing, ...panel, ...keyboard]
    : [...keyboard, ...panel, ...housing];
  if (!frontVisible) {
    for (let slat = 0; slat < 4; slat++) {
      pieces.push(box(-3.1, -6.28, 6 + slat * 0.75, 6.2, 0.18, 0.32, ink.keys));
    }
  }
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
  const inset = (gap: number, heightFromBase: number, height: number, colors: Faces): RoomBox => ({
    ...box(
      x - size / 2 + gap,
      y - size / 2 + gap,
      z + heightFromBase,
      size - 2 * gap,
      size - 2 * gap,
      height,
      colors,
    ),
    cornerRadius: (size - 2 * gap) * 0.28,
  });
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
  const leaves: RoomBox[] = [];
  // A leaf bends out from the stem. Its overlapping facets widen in the middle
  // and taper at the tip so the silhouette remains readable at room zoom.
  const blade = (reachX: number, reachY: number, rise: number, droop: number, colors: Faces) => {
    for (let step = 0; step < 8; step++) {
      const t = step / 7;
      const spread = scale * (0.55 + 2.5 * Math.sin(Math.PI * t));
      const thickness = scale * (0.6 + 1.1 * (1 - t));
      const px = x + reachX * t * scale;
      const py = y + reachY * t * scale;
      const pz = z + (rise * t + droop * Math.sin(Math.PI * t)) * scale;
      leaves.push({
        ...box(px - spread / 2, py - spread / 2, pz, spread, spread, thickness, colors),
        cornerRadius: spread / 3,
      });
    }
  };
  blade(-3.8, -5.2, 5.1, 3.3, ink.leafDark);
  blade(3.0, -4.8, 9.6, 2.6, ink.leaf);
  blade(-4.5, -1.4, 10.9, 2.2, ink.leafLight);
  blade(0.6, -1.8, 14.4, 0.9, ink.leaf);
  blade(5.9, 0.8, 6.5, 4.3, ink.leafLight);
  blade(-3.2, 4.8, 5.3, 3.7, ink.leaf);
  blade(2.1, 4.0, 3.9, 3.4, ink.leafDark);
  return leaves;
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
    const artHeight = height - 5;
    boxes.push(box(artX, 2.55, z + 2.5, artWidth, 0.18, artHeight, variant ? ink.rust : ink.sky));
    boxes.push(
      box(
        artX + artWidth * 0.19,
        2.74,
        z + 2.5 + artHeight * 0.62,
        artWidth * 0.12,
        0.18,
        artHeight * 0.2,
        ink.sun,
      ),
    );
    // Stepped poster profiles on the wall plane. All the columns share a baseline.
    const peaks = [2, 3, 4, 6, 7, 5, 4, 3, 5, 6, 4, 3];
    peaks.forEach((peak, index) => {
      const left = artX + (index * artWidth) / peaks.length;
      const width = artWidth / peaks.length;
      boxes.push(box(left, 2.93, z + 2.5, width, 0.15, (artHeight * peak) / 11, ink.hill));
      boxes.push(
        box(
          left,
          3.09,
          z + 2.5,
          width,
          0.15,
          (artHeight * (2 + (index % 7 < 3 ? 1 : 0))) / 11,
          ink.grass,
        ),
      );
    });
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
    ...Array.from({ length: 12 }, (_, hour) => {
      const angle = (hour * Math.PI) / 6;
      return box(
        x + 5.32 + 3.43 * Math.sin(angle),
        2.82,
        24.4 + 3.38 * Math.cos(angle),
        0.43,
        0.15,
        hour % 3 === 0 ? 0.66 : 0.37,
        ink.hand,
      );
    }),
    box(x + 4.96, 3.29, 23.8, 1, 0.18, 0.95, ink.brass),
  ]);
}

function coffee(input: RoomModelInput): RoomModel {
  const x = input.width / 2;
  const y = input.depth / 2;
  const z = input.surfaceHeight;
  return {
    boxes: [
      { ...box(x - 4, y - 3.6, z, 8, 7.2, 0.9, ink.cup), cornerRadius: 2.3 },
      { ...box(x - 2.5, y - 2.35, z + 0.9, 5, 4.7, 3.55, ink.cup), cornerRadius: 1.35 },
      box(x + 2.5, y - 0.9, z + 1.55, 1.9, 1.65, 0.65, ink.cup),
      box(x + 3.7, y - 0.9, z + 2.2, 0.7, 1.65, 1.35, ink.cup),
      box(x + 2.5, y - 0.9, z + 3.55, 1.9, 1.65, 0.65, ink.cup),
      { ...box(x - 1.9, y - 1.85, z + 4.46, 3.8, 3.7, 0.18, ink.coffee), cornerRadius: 1 },
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
