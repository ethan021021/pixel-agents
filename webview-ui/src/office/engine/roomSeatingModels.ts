import type { RoomBox, RoomModel, RoomModelInput, RoomSeatSurface } from '../roomModel.js';
import { TILE_SIZE } from '../types.js';

type Faces = RoomBox['colors'];

/* eslint-disable pixel-agents/no-inline-colors -- Authored room furniture palette. */
const WOOD = {
  frame: ['#b78952', '#684328', '#97693b'],
  apron: ['#cf9a58', '#815328', '#a8743d'],
  edge: ['#f5cc80', '#a7763d', '#d2a05b'],
  surface: ['#e0b26e', '#986e3f', '#bb8b53'],
  grain: ['#efd298', '#ae8755', '#c9a36a'],
  seam: ['#be965e', '#85643d', '#ab8150'],
  foot: ['#735535', '#3a2e22', '#58422d'],
  drawer: ['#d0a168', '#866038', '#b78a52'],
  pull: ['#f9dc77', '#765724', '#b99448'],
} as const;

const BLOTTER = {
  edge: ['#39534f', '#273a3a', '#324b49'],
  leather: ['#718d74', '#495b50', '#5f7863'],
} as const;

const SOFA = {
  base: ['#547a34', '#30552a', '#436a31'],
  cloth: ['#81b746', '#3d742f', '#599338'],
  seat: ['#94c655', '#548632', '#72aa41'],
  crown: ['#a9d56a', '#64943b', '#8bbb4d'],
  welt: ['#c2e489', '#719b42', '#9bc661'],
  button: ['#74a640', '#416c32', '#537c36'],
} as const;

const STEEL = {
  rim: ['#c2cfca', '#677877', '#889896'],
  side: ['#818f91', '#465254', '#59676a'],
  dark: ['#4c5a59', '#2b3637', '#354441'],
} as const;

const UPHOLSTERY = {
  base: ['#688789', '#405759', '#506d6d'],
  cloth: ['#82a5a6', '#516c70', '#688a8d'],
  seat: ['#93b6b6', '#657f84', '#789ca0'],
  crown: ['#a7c7c4', '#759398', '#8cabae'],
  welt: ['#c1d7cd', '#819b9b', '#a7c0bc'],
  button: ['#789a9b', '#4f696d', '#607e80'],
} as const;

const COFFEE_TABLE = {
  foot: ['#8e9b98', '#424d4d', '#647270'],
  stem: ['#b3bfba', '#576564', '#81918c'],
  collar: ['#d5bd78', '#856b3b', '#b29b5e'],
  rim: ['#e0d2b4', '#6a6759', '#989585'],
  glass: ['#77999a', '#496768', '#628284'],
  gleam: ['#afc4b9', '#6f908b', '#8fada4'],
} as const;

const BENCH = {
  seat: ['#af7450', '#754b36', '#936044'],
  crown: ['#cd926d', '#986247', '#b57b59'],
  welt: ['#e4b887', '#a77553', '#c79669'],
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
  cornerRadius?: number,
) => RoomBox;

const box: Piece = (x, y, z, width, depth, height, colors, cornerRadius) => ({
  x,
  y,
  z,
  width,
  depth,
  height,
  colors,
  cornerRadius,
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

function table(input: RoomModelInput, kind: 'desk' | 'meeting' | 'console'): RoomModel {
  const x = 1;
  const y = occupiedTop(input) + 1;
  const width = input.width - 2;
  const depth = input.depth - y - 1;
  const surfaceHeight = kind === 'meeting' ? 14 : 13;
  const apronTop = surfaceHeight - 2;
  const place: Piece = (dx, dy, ...rest) => box(x + dx, y + dy, ...rest);
  const alongX = width >= depth;
  const run = alongX ? width : depth;
  const onTop: Piece = (u, v, z, w, d, height, colors, cornerRadius) =>
    alongX
      ? place(u, v, z, w, d, height, colors, cornerRadius)
      : place(v, u, z, d, w, height, colors, cornerRadius);
  const span = alongX ? depth : width;
  const leg = kind === 'meeting' ? 3 : 2.15;
  const boxes = corners(width, depth, 1.65, leg).flatMap(([lx, ly]) => [
    place(lx + 0.25, ly + 0.25, 0, leg - 0.5, leg - 0.5, 0.9, WOOD.foot, 0.25),
    place(lx + 0.4, ly + 0.4, 0.9, leg - 0.8, leg - 0.8, 2.4, WOOD.frame, 0.3),
    place(lx + 0.15, ly + 0.15, 3.3, leg - 0.3, leg - 0.3, 0.75, WOOD.edge, 0.3),
    place(lx, ly, 4.05, leg, leg, apronTop - 4.05, WOOD.apron, 0.3),
  ]);

  const apronZ = apronTop - 2.25;
  boxes.push(
    place(1.5, 1.5, apronZ, width - 3, depth - 3, 2.25, WOOD.apron),
    place(0.45, 0.45, apronTop - 0.35, width - 0.9, depth - 0.9, 0.7, WOOD.frame, 0.6),
    place(0, 0, apronTop + 0.35, width, depth, 1.65, WOOD.edge, 0.6),
    place(0.8, 0.8, surfaceHeight - 0.3, width - 1.6, depth - 1.6, 0.3, WOOD.surface, 0.5),
  );
  // Thin, irregular runs follow the long boards. The top remains flush for props.
  const grainZ = surfaceHeight - 0.15;
  for (const fraction of [0.31, 0.63]) {
    boxes.push(onTop(1.5, span * fraction, grainZ, run - 3, 0.62, 0.15, WOOD.seam));
  }
  boxes.push(
    onTop(3, span * 0.21, grainZ, run * 0.25, 0.42, 0.15, WOOD.grain),
    onTop(run * 0.53, span * 0.82, grainZ, run * 0.29, 0.35, 0.15, WOOD.grain),
  );

  if (kind === 'desk') {
    const pad = run * 0.43;
    const u = (run - pad) / 2;
    const drawerWidth = Math.min(11.5, run * 0.28);
    const end = run - drawerWidth - 1.5;
    boxes.push(
      onTop(u, 1.8, surfaceHeight - 0.24, pad, span - 3.6, 0.24, BLOTTER.edge, 0.55),
      onTop(
        u + 0.55,
        2.35,
        surfaceHeight - 0.15,
        pad - 1.1,
        span - 4.7,
        0.15,
        BLOTTER.leather,
        0.35,
      ),
      onTop(end, 2.3, 4.2, drawerWidth, span - 4.3, apronZ - 4.2, WOOD.frame),
    );
    for (const z of [4.5, 6.7]) {
      boxes.push(
        onTop(end + 0.5, span - 2, z, drawerWidth - 1, 0.45, 2, WOOD.drawer),
        onTop(end + drawerWidth / 2 - 1.3, span - 1.55, z + 0.86, 2.6, 0.55, 0.45, WOOD.pull, 0.2),
      );
    }
  }
  return { boxes, surfaceHeight };
}

function coffeeTable(input: RoomModelInput): RoomModel {
  const surfaceHeight = 8;
  const width = input.width - 2;
  const depth = input.depth - occupiedTop(input) - 2;
  const x = 1;
  const y = occupiedTop(input) + 1;

  const centerX = x + width / 2;
  const centerY = y + depth / 2;
  const centered = (w: number, d: number, z: number, h: number, colors: Faces, radius: number) =>
    box(centerX - w / 2, centerY - d / 2, z, w, d, h, colors, radius);
  const legs = corners(width, depth, 2.65, 1.8).flatMap(([u, v]) => [
    box(x + u, y + v, 0, 1.8, 1.8, 0.8, COFFEE_TABLE.foot, 0.4),
    box(x + u + 0.25, y + v + 0.25, 0.8, 1.3, 1.3, 4.65, COFFEE_TABLE.stem, 0.4),
    box(x + u, y + v, 5.45, 1.8, 1.8, 0.7, COFFEE_TABLE.collar, 0.4),
  ]);
  return {
    surfaceHeight,
    boxes: [
      ...legs,
      box(x + 3.5, y + 3.5, 2.1, 0.7, depth - 7, 0.75, COFFEE_TABLE.foot),
      box(x + width - 4.2, y + 3.5, 2.1, 0.7, depth - 7, 0.75, COFFEE_TABLE.foot),
      centered(width - 1.5, depth - 1.5, 6.15, 1.15, COFFEE_TABLE.foot, 1.45),
      centered(width, depth, 7.3, 0.7, COFFEE_TABLE.rim, 1.55),
      centered(width - 2.1, depth - 2.1, 7.8, 0.2, COFFEE_TABLE.glass, 0.95),
      box(x + width * 0.18, y + 2.2, 7.85, 0.7, depth - 4.4, 0.15, COFFEE_TABLE.gleam),
      box(x + width * 0.23, y + 2.2, 7.85, 1.4, depth - 4.4, 0.15, COFFEE_TABLE.gleam),
      box(x + width * 0.76, y + 2.2, 7.85, 0.4, depth - 4.4, 0.15, COFFEE_TABLE.gleam),
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
  const nearBack = facing === 'back' || facing === 'left';

  // Work from the backrest toward the front of the seat, in any rotation.
  const anchor = (u: number, v: number, z: number): RoomSeatSurface => {
    if (facing === 'left') return { x: x + w - v, y: y + u, z };
    if (side) return { x: x + v, y: y + u, z };
    if (facing === 'back') return { x: x + u, y: y + d - v, z };
    return { x: x + u, y: y + v, z };
  };
  const place: Piece = (u, v, z, width, depth, height, colors, cornerRadius) => {
    const origin = anchor(u, nearBack ? v + depth : v, z);
    return box(
      origin.x,
      origin.y,
      z,
      side ? depth : width,
      side ? width : depth,
      height,
      colors,
      cornerRadius,
    );
  };

  return { width: side ? d : w, depth: side ? w : d, place, anchor, nearBack };
}

function upholsteredSeat(input: RoomModelInput, sofa: boolean): RoomModel {
  const { width, depth, place, anchor, nearBack } = seatSpace(input);
  const cloth = sofa ? SOFA : UPHOLSTERY;
  const metal = !sofa;
  const arm = sofa ? 2.8 : 1.1;
  const boxes: RoomBox[] = sofa
    ? corners(width, depth, 1.15, 1.85).map(([u, v]) =>
        place(u, v, 0, 1.85, 1.85, 1.8, WOOD.foot, 0.45),
      )
    : [0.2, width - 1.35].flatMap((u) => [
        place(u, 0.7, 0, 1.15, depth - 1.35, 1.15, STEEL.side, 0.35),
        place(u, 0.7, 1.15, 1.15, 1.3, 4.05, STEEL.rim, 0.3),
        place(u, depth - 2, 1.15, 1.15, 1.3, 4.05, STEEL.rim, 0.3),
      ]);
  if (sofa) {
    boxes.push(
      place(0.5, 0.5, 1.8, width - 1, depth - 1, 1.45, WOOD.frame, 1.1),
      place(0, 0, 3.25, width, depth, 1.05, WOOD.edge, 1.15),
      place(0.45, 0.35, 4.3, width - 0.9, depth - 0.7, 1.2, cloth.base, 0.8),
    );
  } else {
    boxes.push(place(0.5, 1, 4.35, width - 1, depth - 1.5, 1.15, STEEL.dark, 1.05));
  }

  // The rear rail and the two individual rolls make the division between sofa seats legible.
  const couchSeats = sofa ? 2 : 1;
  const gap = 0.55;
  const cushionWidth = (width - 2 * arm - (couchSeats + 1) * gap) / couchSeats;
  const back: RoomBox[] = [
    place(0.6, 0, 5.2, width - 1.2, 2.1, 8, metal ? STEEL.side : cloth.base, 0.7),
  ];
  const anchors: RoomSeatSurface[] = [];
  const seatDepth = depth - 4.65;
  for (let i = 0; i < couchSeats; i++) {
    const u = arm + gap + i * (cushionWidth + gap);
    back.push(
      place(u - 0.2, 0.5, 5.85, cushionWidth + 0.4, 3.7, 6.7, cloth.cloth, 1.15),
      place(u + 0.05, 0.65, 12.55, cushionWidth - 0.1, 3.4, 1.15, cloth.seat, 1.12),
      place(u + 0.43, 0.95, 13.7, cushionWidth - 0.86, 2.78, 0.65, cloth.crown, 0.9),
    );
    if (sofa) {
      for (const f of [0.32, 0.68]) {
        const button = u + cushionWidth * f;
        back.push(
          place(button - 0.47, 4.1, 9.6, 0.94, 0.2, 0.48, cloth.button),
          place(button - 0.18, 4.12, 9.25, 0.36, 0.22, 1.1, cloth.button),
          place(button + 0.12, 4.14, 9.25, 0.35, 0.23, 0.36, cloth.welt),
        );
      }
    }
    anchors.push(anchor(u + cushionWidth / 2, 3.7 + seatDepth / 2 - 0.6, 7.95));
  }

  if (!nearBack) boxes.push(...back);
  const armrest = (u: number): RoomBox[] =>
    metal
      ? [
          place(u, 0.7, 5.2, arm, 1, 8, STEEL.side, 0.3),
          place(u, 1.7, 7.85, arm, depth - 2.85, 0.85, STEEL.rim, 0.35),
          place(u, depth - 2.1, 5.15, arm, 1.2, 2.7, STEEL.side, 0.35),
        ]
      : [
          place(u, 1.4, 4.3, arm, depth - 1.9, 3.35, WOOD.apron, 0.8),
          place(u + 0.15, 1.35, 7.65, arm - 0.3, depth - 1.9, 2.1, cloth.cloth, 0.9),
          place(u + 0.3, 1.55, 9.75, arm - 0.6, depth - 2.35, 0.7, cloth.seat, 0.8),
          place(u + 0.65, 1.95, 10.45, arm - 1.3, depth - 3.15, 0.35, cloth.crown, 0.6),
        ];
  boxes.push(...armrest(0));
  for (let i = 0; i < couchSeats; i++) {
    const u = arm + gap + i * (cushionWidth + gap);
    boxes.push(
      place(u, 3.55, 5.5, cushionWidth, seatDepth + 0.72, 1.5, cloth.seat, 1.1),
      place(u + 0.25, 3.75, 7, cushionWidth - 0.5, seatDepth + 0.2, 0.7, cloth.seat, 1.2),
      place(u + 0.55, 4.05, 7.7, cushionWidth - 1.1, seatDepth - 0.35, 0.25, cloth.crown, 1.2),
    );
    if (sofa) {
      const v = 4.05 + seatDepth * 0.52;
      const button = u + cushionWidth / 2;
      boxes.push(
        place(button - 0.5, v - 0.17, 7.93, 1, 0.38, 0.02, cloth.button),
        place(button - 0.17, v - 0.5, 7.93, 0.36, 1, 0.02, cloth.button),
        place(button + 0.22, v + 0.08, 7.93, 0.35, 0.5, 0.02, cloth.welt),
      );
    }
  }
  const foreground = armrest(width - arm);
  if (nearBack) foreground.push(...back);
  boxes.push(...foreground);
  return { boxes, seating: { anchors, foreground } };
}

function woodenSeat(input: RoomModelInput, bench: boolean, cushioned: boolean): RoomModel {
  const { width, depth, place, anchor, nearBack } = seatSpace(input);
  const boxes = corners(width, depth, 0.95, 1.8).flatMap(([u, v]) => [
    place(u + 0.18, v + 0.18, 0, 1.44, 1.44, 1, WOOD.foot, 0.23),
    place(u, v, 1, 1.8, 1.8, 4.2, WOOD.frame, 0.23),
  ]);
  boxes.push(
    place(1.15, 1.7, 2.6, width - 2.3, 0.86, 0.85, WOOD.apron),
    place(1.15, depth - 2.55, 2.6, width - 2.3, 0.86, 0.85, WOOD.apron),
    place(0.55, 1.05, 4.6, width - 1.1, depth - 1.7, 1.1, WOOD.frame, 0.45),
  );
  const back = bench
    ? []
    : [
        place(0.85, 0.25, 5.7, 1.65, 1.8, 10.1, WOOD.frame, 0.35),
        place(width - 2.5, 0.25, 5.7, 1.65, 1.8, 10.1, WOOD.frame, 0.35),
        place(1.4, 0.65, 9.2, width - 2.8, 1.25, 1.4, WOOD.apron, 0.3),
        place(0.8, 0.35, 12.2, width - 1.6, 1.8, 2.5, WOOD.surface, 0.5),
        place(1.25, 0.45, 14.7, width - 2.5, 1.5, 0.7, WOOD.edge, 0.4),
      ];
  if (!nearBack) boxes.push(...back);
  const topBack = cushioned ? 1.45 : 0.6;
  const topDepth = depth - (cushioned ? 2.2 : 1.15);
  const topHeight = cushioned ? 8.5 : 6.45;
  boxes.push(place(0, 0.6, 5.7, width, depth - 1.15, 0.75, WOOD.edge, 0.65));
  if (cushioned) {
    boxes.push(
      place(0.35, 1.1, 6.45, width - 0.7, depth - 1.6, 1.25, BENCH.seat, 0.8),
      place(0.8, topBack, 7.7, width - 1.6, topDepth, 0.8, BENCH.crown, 0.8),
      place(1.1, depth - 1, 7.1, width - 2.2, 0.35, 0.32, BENCH.welt),
    );
  } else {
    for (const t of [0.34, 0.67]) {
      boxes.push(place(0.7, depth * t, 6.31, width - 1.4, 0.62, 0.14, WOOD.seam));
    }
    boxes.push(place(width * 0.18, depth * 0.8, 6.34, width * 0.4, 0.41, 0.11, WOOD.grain));
  }
  const foreground = nearBack ? back : [];
  boxes.push(...foreground);
  const hips = anchor(width / 2, topBack + topDepth / 2 - (bench ? 0 : 1), topHeight);
  return { boxes, seating: { anchors: [hips], foreground } };
}

export function roomSeatingModel(input: RoomModelInput): RoomModel | null {
  switch (input.type.replace(/:left$/, '')) {
    case 'DESK_FRONT':
    case 'DESK_SIDE':
      return table(input, 'desk');
    case 'SMALL_TABLE_FRONT':
    case 'SMALL_TABLE_SIDE':
      return table(input, 'console');
    case 'TABLE_FRONT':
      return table(input, 'meeting');
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
