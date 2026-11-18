import type { RoomBox, RoomModel, RoomModelInput } from '../roomModel.js';
import { TILE_SIZE } from '../types.js';

type Faces = RoomBox['colors'];

/* eslint-disable pixel-agents/no-inline-colors -- Authored room furniture palette. */
const WOOD = {
  frame: ['#9f6646', '#55312b', '#754332'],
  apron: ['#ad724e', '#724030', '#915438'],
  edge: ['#e3ac72', '#9d5738', '#b46e49'],
  surface: ['#ca8c58', '#83482e', '#a56844'],
  grain: ['#d99e6b', '#b87852', '#c48658'],
  seam: ['#b4784d', '#86472f', '#a65d39'],
  foot: ['#674737', '#3e2828', '#57352c'],
} as const;

const SOFA = {
  plinth: ['#5d3541', '#341f31', '#452637'],
  base: ['#943c56', '#54263d', '#742c47'],
  cloth: ['#ad4961', '#743047', '#90374e'],
  seat: ['#bb526b', '#7e304a', '#a13f57'],
  crown: ['#cd667d', '#963c53', '#b54f67'],
  welt: ['#db8291', '#a7475b', '#c36b7e'],
} as const;

const WINE = {
  plinth: ['#594050', '#302330', '#4c3144'],
  base: ['#874968', '#4f2d4a', '#663756'],
  cloth: ['#9f5575', '#61405e', '#7e4264'],
  seat: ['#ac6080', '#713f61', '#924e6e'],
  crown: ['#bf7491', '#8e4e70', '#a85d80'],
  welt: ['#cc8ba4', '#a36181', '#bb7595'],
} as const;

const COFFEE_TABLE = {
  foot: ['#70796f', '#2c3739', '#444f4b'],
  stem: ['#7b8479', '#364345', '#53615a'],
  collar: ['#bda170', '#7d6143', '#9a7b50'],
  rim: ['#d8c3a4', '#777263', '#9d8a72'],
  laminate: ['#f1e5c4', '#b5aba0', '#c9bba1'],
} as const;

const BENCH = {
  seat: ['#b49768', '#796049', '#9b7750'],
  crown: ['#d1b77e', '#9d8358', '#b99b67'],
  welt: ['#dfc690', '#af9160', '#c8a977'],
} as const;
/* eslint-enable pixel-agents/no-inline-colors */

type Piece = (
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number,
  colors: Faces,
) => RoomBox;

const box: Piece = (x, y, z, width, depth, height, colors) => ({
  x,
  y,
  z,
  width,
  depth,
  height,
  colors,
});

const corners = (width: number, depth: number, inset: number, size: number) => {
  const right = width - inset - size;
  const front = depth - inset - size;
  return [
    [inset, inset],
    [right, inset],
    [inset, front],
    [right, front],
  ];
};

function occupiedTop(input: RoomModelInput): number {
  return Math.min(input.backgroundRows * TILE_SIZE, input.depth - TILE_SIZE);
}

function table(input: RoomModelInput, meeting: boolean): RoomModel {
  const x = 1;
  const y = occupiedTop(input) + 1;
  const width = input.width - 2;
  const depth = input.depth - y - 1;
  const surfaceHeight = meeting ? 14 : 13;
  const apronTop = surfaceHeight - 2;
  const place: Piece = (dx, dy, ...rest) => box(x + dx, y + dy, ...rest);
  const alongX = width >= depth;
  const run = alongX ? width : depth;
  const pier = (offset: number, z: number, length: number, height: number, colors: Faces) =>
    alongX
      ? place(offset, 2, z, length, depth - 4, height, colors)
      : place(2, offset, z, width - 4, length, height, colors);
  const leg = 3.5;
  const boxes = meeting
    ? corners(width, depth, 1.5, leg).flatMap(([lx, ly]) => [
        place(lx, ly, 0, leg, leg, 1.25, WOOD.foot),
        place(lx + 0.4, ly + 0.4, 1.25, leg - 0.8, leg - 0.8, apronTop - 1.25, WOOD.frame),
      ])
    : [2, run - 6.5].flatMap((offset) => [
        pier(offset, 0, 4.5, 1.5, WOOD.foot),
        pier(offset + 0.4, 1.5, 3.7, apronTop - 1.5, WOOD.frame),
      ]);

  const apronHeight = 2.75;
  const apronZ = apronTop - apronHeight;
  boxes.push(
    place(1.5, 1.5, apronZ, width - 3, 1.5, apronHeight, WOOD.apron),
    place(1.5, 3, apronZ, 1.5, depth - 6, apronHeight, WOOD.apron),
    place(width - 3, 3, apronZ, 1.5, depth - 6, apronHeight, WOOD.apron),
    place(1.5, depth - 3, apronZ, width - 3, 1.5, apronHeight, WOOD.apron),
    place(0, 0, apronTop, width, depth, 2, WOOD.edge),
    place(1, 1, surfaceHeight - 0.25, width - 2, depth - 2, 0.25, WOOD.surface),
  );

  // Place the seams flush with the top so computers and cups share one elevation.
  const grain = (offset: number, length: number, colors: Faces) =>
    alongX
      ? place(2, offset, surfaceHeight - 0.2, width - 4, length, 0.2, colors)
      : place(offset, 2, surfaceHeight - 0.2, length, depth - 4, 0.2, colors);
  const span = alongX ? depth : width;
  boxes.push(grain(span * 0.34, 0.65, WOOD.grain), grain(span * 0.7, 0.5, WOOD.seam));
  if (meeting) boxes.push(grain(span * 0.52, 0.65, WOOD.grain));
  return { boxes, surfaceHeight };
}

function coffeeTable(input: RoomModelInput): RoomModel {
  const surfaceHeight = 8;
  const width = input.width - 2;
  const depth = input.depth - occupiedTop(input) - 2;
  const x = 1;
  const y = occupiedTop(input) + 1;

  // Narrow end bands soften each corner while keeping the whole piece on its footprint.
  const slab = (
    inset: number,
    z: number,
    height: number,
    corner: number,
    colors: Faces,
  ): RoomBox[] => {
    const w = width - 2 * inset;
    const d = depth - 2 * inset;
    const left = x + inset;
    const back = y + inset;
    const step = corner / 2;
    return [
      box(left + corner, back, z, w - 2 * corner, step, height, colors),
      box(left + step, back + step, z, w - 2 * step, step, height, colors),
      box(left, back + corner, z, w, d - 2 * corner, height, colors),
      box(left + step, back + d - corner, z, w - 2 * step, step, height, colors),
      box(left + corner, back + d - step, z, w - 2 * corner, step, height, colors),
    ];
  };

  return {
    surfaceHeight,
    boxes: [
      ...slab(4.75, 0, 1.5, 4, COFFEE_TABLE.foot),
      ...slab(7.25, 1.5, 3.25, 3, COFFEE_TABLE.stem),
      ...slab(6.7, 4.75, 1.25, 3, COFFEE_TABLE.collar),
      ...slab(0.85, 6, 1.1, 6, COFFEE_TABLE.rim),
      ...slab(0, 7.1, 0.9, 6, COFFEE_TABLE.laminate),
    ],
  };
}

function seatSpace(input: RoomModelInput) {
  const x = 1;
  const y = occupiedTop(input) + 1;
  const w = input.width - 2;
  const d = input.depth - y - 1;
  const facing = input.type.endsWith(':left') ? 'left' : input.orientation;
  const side = facing === 'left' || facing === 'right' || facing === 'side';

  // Work from the backrest toward the front of the seat, in any rotation.
  const place: Piece = (u, v, z, width, depth, height, colors) => {
    if (facing === 'left') return box(x + w - v - depth, y + u, z, depth, width, height, colors);
    if (side) return box(x + v, y + u, z, depth, width, height, colors);
    if (facing === 'back') return box(x + u, y + d - v - depth, z, width, depth, height, colors);
    return box(x + u, y + v, z, width, depth, height, colors);
  };

  return {
    width: side ? d : w,
    depth: side ? w : d,
    place,
    nearBack: facing === 'back' || facing === 'left',
  };
}

function upholsteredSeat(input: RoomModelInput, sofa: boolean): RoomModel {
  const { width, depth, place, nearBack } = seatSpace(input);
  const cloth = sofa ? SOFA : WINE;
  const boxes = [
    place(1.3, 1.2, 0, width - 2.6, depth - 2.4, 1.8, cloth.plinth),
    place(0.75, 0.6, 1.8, width - 1.5, depth - 1.2, 1.7, cloth.base),
    place(0, 0, 3.5, width, depth, 2, cloth.base),
  ];

  const back = [
    place(0.25, 0.05, 5.5, width - 0.5, 3.6, 6.6, cloth.cloth),
    place(0.9, 0.35, 12.1, width - 1.8, 2.8, 1.4, cloth.cloth),
    place(1.65, 0.85, 13.5, width - 3.3, 1.8, 0.9, cloth.crown),
  ];
  if (!nearBack) boxes.push(...back);

  const arm = sofa ? 4.1 : 2.5;
  const armrest = (u: number): RoomBox[] => [
    place(u + 0.25, 2, 5.5, arm - 0.5, depth - 2.4, 1.65, cloth.base),
    place(u, 2, 7.15, arm, depth - 2.75, 3.15, cloth.cloth),
    place(u + 0.5, 2.55, 10.3, arm - 1, depth - 4.15, 1.2, cloth.crown),
  ];
  boxes.push(...armrest(0));

  const cushions = sofa ? 2 : 1;
  const gap = 0.85;
  const cushionWidth = (width - 2 * arm - (cushions + 1) * gap) / cushions;
  for (let i = 0; i < cushions; i++) {
    const u = arm + gap + i * (cushionWidth + gap);
    boxes.push(
      place(u, 3, 5.5, cushionWidth, depth - 3.45, 1.5, cloth.seat),
      place(u + 0.35, 3.35, 7, cushionWidth - 0.7, depth - 4.25, 1.1, cloth.crown),
      place(u + 0.35, depth - 0.85, 6.25, cushionWidth - 0.7, 0.4, 0.5, cloth.welt),
    );
  }

  boxes.push(...armrest(width - arm));
  if (nearBack) boxes.push(...back);
  return { boxes };
}

function woodenSeat(input: RoomModelInput, bench: boolean, cushioned: boolean): RoomModel {
  const { width, depth, place, nearBack } = seatSpace(input);
  const boxes = corners(width, depth, 1.15, 1.65).map(([lx, ly]) =>
    place(lx, ly, 0, 1.65, 1.65, 5, WOOD.frame),
  );
  boxes.push(
    place(1.25, 2, 2, width - 2.5, 1.15, 1.2, WOOD.apron),
    place(1.25, depth - 3, 2, width - 2.5, 1.15, 1.2, WOOD.apron),
  );
  const back = bench
    ? []
    : [
        place(1.25, 0.4, 5, 1.6, 1.8, 7.5, WOOD.frame),
        place(width - 2.85, 0.4, 5, 1.6, 1.8, 7.5, WOOD.frame),
        place(1, 0.25, 7.5, width - 2, 1.75, 1.35, WOOD.apron),
        place(1, 0.25, 10, width - 2, 1.75, 1.5, WOOD.apron),
        place(0.65, 0.1, 12.5, width - 1.3, 2, 1.1, WOOD.edge),
      ];

  if (!nearBack) boxes.push(...back);
  boxes.push(place(0, 0.8, 5, width, depth - 1.1, 1.45, WOOD.edge));
  if (cushioned) {
    boxes.push(
      place(0.7, 1.3, 6.45, width - 1.4, depth - 2, 1.4, BENCH.seat),
      place(1.2, 1.8, 7.85, width - 2.4, depth - 3, 0.65, BENCH.crown),
      place(1, depth - 1.2, 7.15, width - 2, 0.5, 0.4, BENCH.welt),
    );
  } else {
    boxes.push(
      place(1, depth * 0.4, 6.25, width - 2, 0.65, 0.2, WOOD.seam),
      place(1, depth * 0.66, 6.25, width - 2, 0.55, 0.2, WOOD.grain),
    );
  }
  if (nearBack) boxes.push(...back);
  return { boxes };
}

export function roomSeatingModel(input: RoomModelInput): RoomModel | null {
  switch (input.type.replace(/:left$/, '')) {
    case 'DESK_FRONT':
    case 'DESK_SIDE':
    case 'SMALL_TABLE_FRONT':
    case 'SMALL_TABLE_SIDE':
      return table(input, false);
    case 'TABLE_FRONT':
      return table(input, true);
    case 'COFFEE_TABLE':
      return coffeeTable(input);
    case 'SOFA_FRONT':
    case 'SOFA_BACK':
    case 'SOFA_SIDE':
      return upholsteredSeat(input, true);
    case 'CUSHIONED_CHAIR_FRONT':
    case 'CUSHIONED_CHAIR_BACK':
    case 'CUSHIONED_CHAIR_SIDE':
      return upholsteredSeat(input, false);
    case 'WOODEN_CHAIR_FRONT':
    case 'WOODEN_CHAIR_BACK':
    case 'WOODEN_CHAIR_SIDE':
      return woodenSeat(input, false, false);
    case 'CUSHIONED_BENCH':
      return woodenSeat(input, true, true);
    case 'WOODEN_BENCH':
      return woodenSeat(input, true, false);
    default:
      return null;
  }
}
