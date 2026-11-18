import type { RoomBox, RoomModel, RoomModelInput } from '../roomModel.js';
import { TILE_SIZE } from '../types.js';

type Faces = RoomBox['colors'];

/* eslint-disable pixel-agents/no-inline-colors -- Authored room furniture palette. */
const WOOD = {
  frame: ['#986849', '#63463c', '#805441'],
  apron: ['#b1835b', '#79543f', '#966846'],
  edge: ['#d6ad7a', '#9d714f', '#b38458'],
  surface: ['#c69b67', '#896144', '#a47750'],
  grain: ['#d4ac78', '#b1845b', '#bd9263'],
  seam: ['#b9895a', '#8c6147', '#a47752'],
  foot: ['#6d5147', '#423137', '#584038'],
} as const;

const SOFA = {
  base: ['#646e82', '#384457', '#4b566b'],
  cloth: ['#788398', '#4a566c', '#5b6980'],
  seat: ['#8996ad', '#56647b', '#6a7891'],
  crown: ['#98a3b8', '#69768d', '#78869e'],
  welt: ['#a8b2c1', '#65748d', '#8290a7'],
} as const;

const WINE = {
  base: ['#87616d', '#523b4c', '#694954'],
  cloth: ['#966c78', '#644959', '#7b5365'],
  seat: ['#ad8590', '#735565', '#8d6472'],
  crown: ['#bd98a0', '#836775', '#9f7883'],
  welt: ['#c6a5a9', '#8e6d78', '#af858e'],
} as const;

const BENCH = {
  seat: ['#b1966c', '#79654f', '#927957'],
  crown: ['#c7ad80', '#937d5c', '#ab9068'],
  welt: ['#d6bc90', '#a18b65', '#b99e72'],
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

function table(input: RoomModelInput, kind: 'desk' | 'meeting' | 'small' | 'coffee'): RoomModel {
  const x = 1;
  const y = occupiedTop(input) + 1;
  const width = input.width - 2;
  const depth = input.depth - y - 1;
  const low = kind === 'coffee';
  const surfaceHeight = low ? 8 : kind === 'meeting' ? 14 : 13;
  const apronTop = surfaceHeight - 2;
  const leg = kind === 'meeting' ? 2.75 : 2;
  const place: Piece = (dx, dy, ...rest) => box(x + dx, y + dy, ...rest);

  const boxes = corners(width, depth, 1.5, leg).flatMap(([lx, ly]) => [
    place(lx + 0.25, ly + 0.25, 0, leg - 0.5, leg - 0.5, 1, WOOD.foot),
    place(lx, ly, 1, leg, leg, apronTop - 1, WOOD.frame),
  ]);
  const apronZ = apronTop - (low ? 1.4 : 2.25);
  const apronHeight = apronTop - apronZ;
  boxes.push(
    place(1.5, 1.5, apronZ, width - 3, 1.5, apronHeight, WOOD.apron),
    place(1.5, 3, apronZ, 1.5, depth - 6, apronHeight, WOOD.apron),
    place(width - 3, 3, apronZ, 1.5, depth - 6, apronHeight, WOOD.apron),
    place(1.5, depth - 3, apronZ, width - 3, 1.5, apronHeight, WOOD.apron),
    place(0, 0, apronTop, width, depth, 2, WOOD.edge),
    place(1, 1, surfaceHeight - 0.25, width - 2, depth - 2, 0.25, WOOD.surface),
  );

  // Place the seams flush with the top so computers and cups share one elevation.
  const grainAlongX = width >= depth;
  const run = grainAlongX ? depth : width;
  const grain = (offset: number, length: number, colors: Faces) =>
    grainAlongX
      ? place(2, offset, surfaceHeight - 0.2, width - 4, length, 0.2, colors)
      : place(offset, 2, surfaceHeight - 0.2, length, depth - 4, 0.2, colors);
  boxes.push(grain(run * 0.34, 0.65, WOOD.grain), grain(run * 0.7, 0.5, WOOD.seam));
  if (kind === 'meeting' || low) boxes.push(grain(run * 0.52, 0.65, WOOD.grain));
  return { boxes, surfaceHeight };
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
  const legHeight = sofa ? 2 : 3;
  const boxes = corners(width, depth, 1.2, 1.8).map(([lx, ly]) =>
    place(lx, ly, 0, 1.8, 1.8, legHeight, WOOD.frame),
  );
  boxes.push(
    place(0, 0.5, legHeight, width, depth - 1, 1.25, WOOD.frame),
    place(0, 0, legHeight + 1.25, width, depth, 5.5 - legHeight - 1.25, cloth.base),
  );

  const back = [
    place(0.55, 0, 5.5, width - 1.1, 3.5, 6.5, cloth.cloth),
    place(1.15, 0.55, 12, width - 2.3, 2.6, 1.4, cloth.crown),
  ];
  if (!nearBack) boxes.push(...back);

  const arm = sofa ? 2.7 : 0.7;
  const armrest = (u: number): RoomBox[] => [
    place(u, 2, 5.5, arm, depth - 2.5, 3.4, cloth.cloth),
    place(u + 0.35, 2.35, 8.9, arm - 0.7, depth - 3.2, 0.8, cloth.crown),
  ];
  if (sofa) boxes.push(...armrest(0));

  const cushions = sofa ? 2 : 1;
  const gap = 0.65;
  const cushionWidth = (width - 2 * arm - (cushions + 1) * gap) / cushions;
  for (let i = 0; i < cushions; i++) {
    const u = arm + gap + i * (cushionWidth + gap);
    boxes.push(
      place(u, 3, 5.5, cushionWidth, depth - 4, 1.8, cloth.seat),
      place(u + 0.45, 3.45, 7.3, cushionWidth - 0.9, depth - 4.9, 0.7, cloth.crown),
      place(u + 0.25, depth - 1.45, 6.65, cushionWidth - 0.5, 0.45, 0.45, cloth.welt),
    );
  }

  if (sofa) boxes.push(...armrest(width - arm));
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
      return table(input, 'desk');
    case 'TABLE_FRONT':
      return table(input, 'meeting');
    case 'SMALL_TABLE_FRONT':
    case 'SMALL_TABLE_SIDE':
      return table(input, 'small');
    case 'COFFEE_TABLE':
      return table(input, 'coffee');
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
