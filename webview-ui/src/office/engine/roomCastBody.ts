import { rgbaToHex } from '../../../../core/src/assets/colorUtils.js';
import type { SpriteData } from '../types.js';
import type { RoomCharacterPose } from './roomCharacterArt.js';

type Paint = Record<string, string>;
type Swatches = readonly [number, number, number];

interface Outfit {
  top: Swatches;
  trousers: Swatches;
  shoes: Swatches;
  accents: readonly [number, number];
  front: readonly string[];
  back: readonly string[];
  sleeve?: Swatches;
  wide?: boolean;
  cuffs?: boolean;
}

const outfits = [
  {
    // Cobalt track top with lime sleeve tape and canvas sneakers.
    top: [0x3267d3, 0x284c9b, 0x608bed],
    trousers: [0x343b64, 0x262a4a, 0x4d5779],
    shoes: [0xe0decb, 0xa5aaa8, 0xf5ebd2],
    accents: [0xcfdf83, 0xb4c9ff],
    front: ['   a   ', ' aa a a', 'a   aa ', '    b  ', '    b  ', '    b  ', '    b  '],
    back: ['aaaaaa', '      ', ' bbbb '],
  },
  {
    // Coral chore coat with two plum pockets and a wide leg.
    top: [0xd86e77, 0xa84d66, 0xf18d89],
    trousers: [0x645080, 0x453457, 0x826b9a],
    shoes: [0x5c406e, 0x3e3050, 0xaa728c],
    accents: [0x6b477c, 0xffcc9c],
    front: [' b     ', '  b    ', '  ba   ', '  b aa ', '  b aa ', '  b    ', 'aab  aa'],
    back: ['aaaaaa', '     a', '     a', '     a'],
    wide: true,
  },
  {
    // Sage pullover with a high hood and rolled dark denim.
    top: [0x73968b, 0x496f6b, 0x96b6a1],
    trousers: [0x3c536b, 0x2e3c5a, 0x6a7d8c],
    shoes: [0x484956, 0x2f3441, 0xa5b3a6],
    accents: [0x486963, 0xe2d5a2],
    front: ['aa   aa', ' aa aa ', '  b b  ', '  b b  ', '       ', ' aaaa  ', ' aaaa  '],
    back: ['aaaaaa', 'a    a', ' aa aa', '  aa  '],
    cuffs: true,
  },
  {
    // Plum bomber, ribbed in sherbet, and warm tan chinos.
    top: [0x805181, 0x573a68, 0xa775a0],
    trousers: [0xb58a62, 0x825f50, 0xcdac78],
    shoes: [0x665076, 0x3e3658, 0xc38b82],
    accents: [0xd99c88, 0xf2c790],
    front: [' aaa   ', '    a  ', '    b  ', '    b  ', ' a  b  ', 'a   b  ', '    b  '],
    back: [' aaaa ', 'a    a', '      '],
  },
  {
    // Mustard tabard over a cream shirt and tailored slacks.
    top: [0xc89544, 0x986034, 0xe5b35d],
    sleeve: [0xd9d1b8, 0x9b9d8a, 0xf0e6ca],
    trousers: [0x555464, 0x3b394f, 0x74717f],
    shoes: [0x5b4e50, 0x3d383d, 0x8b7365],
    accents: [0x6b654f, 0xeed8a8],
    front: ['a    a ', ' a  a  ', '  aa   ', ' b     ', '       ', ' ab ab ', ' ba ba '],
    back: ['  aa  ', ' aa aa', '      '],
  },
  {
    // Rust windbreaker with a green yoke and cream trousers.
    top: [0xc56a4d, 0x965344, 0xda8c62],
    trousers: [0xdecb9f, 0xb29c80, 0xf1deb0],
    shoes: [0x687e70, 0x3d5c58, 0xb7b98d],
    accents: [0x446e70, 0xf7cc83],
    front: ['aaa    ', 'aaaaa  ', 'aaaaaaa', '    bbb', '    b  ', '    b  ', '    b  '],
    back: ['aaaaaaa', 'aaaaaaa', '      b'],
  },
] as const satisfies readonly Outfit[];

const TORSO = [
  '        oKo',
  '        oKKo',
  '       oKKko',
  '      oooKkooo',
  '    ooFFFCCQQoo',
  '  ooFFFFFFCQQQoo',
  ' oFFFFFFCCCCQQQooo',
  'oFFFFFFCCCCCCQQQCo',
  'oFFFFFCCCCCCCQQQCCo',
  'oFFFFCCCCCCCCQQQQCo',
  'oFFFFCCCCCCCCQQQCCo',
  'oFFFCCCCCCCCCQQQCCo',
  'oFFFCCCCCCCCCQQCCo',
  'oFFFCCCCCCCCCQQCo',
  'oFFFCCCCCCCCCQQCo',
  ' oFFCCCCCCCCCQCo',
  ' oFCCCCCCCCCCQCo',
  ' oCCCCCCCCCCCCo',
  '  oCCCCCCCCCCCo',
  '  oooooooooooo',
];

const COAT = [
  ...TORSO.slice(0, 13),
  'oFFFCCCCCCCCCQQQCo',
  'oFFFCCCCCCCCQQQQCo',
  'oFFFCCCCCCCCQQQQo',
  'oFFFCCCCCCCCQQQCo',
  'oFFCCCCCCCCCQQQCo',
  'oFFaaCCCCCCCaaQCo',
  'oFFaaCCCCCCCaaQCo',
  'oFFCCCCCCCCCCCCCo',
  'oFOOCCCCCCCCCCCCo',
  'oOOooooooooooooo',
];

const HOOD = [
  '    ooQQo',
  '  ooQFFQo',
  ' oQFFCCQo',
  'oQFCCCCQQoo',
  'oQFCCCQQQCCoo',
  'oQQCCQQooCCCoo',
  ' oQQQQo  oooo',
  '  oooo',
];

const BOMBER = [
  ...TORSO.slice(0, 7),
  'oFFFFFCCCCCCCQQQCo',
  'oFFFFFCCCCCCCQQQQCo',
  'oFFFFFCCCCCCCQQQQCo',
  'oFFFFFCCCCCCCQQQCCo',
  'oFFFFCCCCCCCCQQQCCo',
  'oFFFFCCCCCCCCQQCCo',
  ' oFFFCCCCCCCCQQCo',
  ' oFFFCCCCCCCCQQo',
  '  ooaaaaaaaaaoo',
  '   oQQQQQQQQQo',
  '   oooooooooo',
];

const VEST = [
  ...TORSO.slice(0, 4),
  '     ooFFCoQoo',
  '    oF!FFCoQQo',
  '   oFF!FFCoQQo',
  '   oFF!CCCoQQoo',
  '   oFFC!CCoQCCo',
  '   oFFFCo!QCCCo',
  '  oFFFCCCCCCCCCo',
  '  oFFFCCCCCCCCQo',
  '  oFFCCCCCCCCQQo',
  '   oFFCCCCCCCQQo',
  '   oFFCCCCCCCQo',
  '   oFFCCCCCCCQo',
  '   oFFCCCCCCCQo',
  '  oCCCCCCCCCCCo',
  '  oooooooooooo',
];

const NEAR_SLEEVE = [
  '  oooo',
  ' oFFFCo',
  'oFFFCCCo',
  'oFFFCCCo',
  'oFFCCCCo',
  'oFFCCCCo',
  'oFCCCCCo',
  'oFCCCCo',
  'oCCCCCo',
  ' oQQQoo',
  ' oabao',
  ' oKKko',
  ' oKhko',
  '  ooo',
];

const COAT_SLEEVE = [
  ...NEAR_SLEEVE.slice(0, 8),
  'oFCCCCo',
  'oCCCCCo',
  'oCQQQoo',
  ' oabao',
  ' oKKko',
  ' oKhko',
  '  ooo',
];

const BOMBER_SLEEVE = [
  '  ooooo',
  ' oFFFFCo',
  'oFFFFCCCo',
  'oFFFFCCCo',
  'oFFFCCCCo',
  'oFFFCCCCo',
  'oFFCCCCCo',
  ' oFFCCCo',
  '  oaaaao',
  '  oQQQQo',
  '   oKko',
  '   oKko',
  '    oo',
];

const SHORT_SLEEVE = [
  ...NEAR_SLEEVE.slice(0, 5),
  'oFQQQQo',
  'oabaaaao',
  ' oKhhko',
  ' oKhKko',
  '  oKKko',
  '  oKhko',
  '   ooo',
];

const FAR_SLEEVE = [
  ' oooo',
  'oCCCoo',
  'oCCCQoo',
  'oCCQQQoo',
  ' oCQQQCo',
  ' oCQQQCo',
  '  oQQQCo',
  '  oQQQoo',
  '   oabo',
  '   oKko',
  '   oKko',
  '    oo',
];

const LAP_SLEEVE = [
  '  ooooo',
  ' oFFFCCo',
  'oFFCCCCo',
  'oFCCCCCo',
  'oFCCCCCo',
  'oCCCCCCo',
  'oCCCCCCoo',
  'oCCCCCCCCo',
  ' oQQCCCCCCoo',
  '  ooQQaaKKKKo',
  '    oooohKKko',
  '        oooo',
];

const SHORT_LAP = [
  ...LAP_SLEEVE.slice(0, 6),
  'oabaaaaoo',
  'oKKhKKKKKo',
  ' oKKKKKKKKoo',
  '  ooKKhKKKKKo',
  '    oooohKKko',
  '        oooo',
];

const WORK_HAND = ['ooo', 'oCCooo', 'oCCCCo', ' oabKKKo', '  oohKKo', '    oooo'];

const PAPER = ['     ooooo', '  ooommmmo', ' oommmmnmo', 'ommmnmmmoo', 'ommmmmmmo', ' ooonooo'];

const WAVE_UP = [
  ' ooo',
  'ohhKo',
  'oKKKo',
  'oKKko',
  ' ohko',
  ' oKko',
  '  oao',
  '  oCCo',
  '   oCCo',
  '   oFCCoo',
  '    oFFCoo',
  '     oFFCo',
  '      oooo',
];

const WAVE_TILT = [
  'oooo',
  'ohhKo',
  ' oKKKo',
  '  oKKko',
  '  oKKko',
  '   oako',
  '   oCCo',
  '    oCCo',
  '    oFCCo',
  '     oFCCoo',
  '      oFFCo',
  '       oooo',
];

const SHOE = [
  ' ooooo',
  'oVVVVVo',
  'oVVVVVVoo',
  ' oVVVVWWVo',
  '  oVWWWWVVo',
  '  oouuVVVVo',
  '   ooooooo',
];

const SEATED_SHOE = [
  ' ooooo',
  'oVVVVVo',
  'oVVVWWoo',
  ' oVVWWWWo',
  '  oWWWWVo',
  '  oVuuuoo',
  '   ooooo',
];

const REAR_SHOE = ['  ooooo', ' oVVVWWo', 'oVVVVVVVo', ' ooooooo'];

const COLLARS: readonly (readonly string[])[] = [
  ['ooQQQo', ' CooCbo', '    b  '],
  ['QQ  aa', 'QQQaa', ' obba'],
  ['aQ CCa', ' aQooa', '  aaaa'],
  ['aa ooa', ' oaao', '   b'],
  ['!a  a!', ' !aa!', '  !!'],
  ['ooa aao', '  aba', '   b'],
];

export const rgb = (value: number): string =>
  rgbaToHex(value >> 16, (value >> 8) & 255, value & 255, 255);

interface Leg {
  hip: number;
  knee: number;
  ankle: number;
  kneeY: number;
  sole: number;
}

const STANCES: Record<-1 | 0 | 1, readonly [Leg, Leg]> = {
  '-1': [
    { hip: 21, knee: 19, ankle: 14, kneeY: 62, sole: 71 },
    { hip: 14, knee: 16, ankle: 19, kneeY: 64, sole: 77 },
  ],
  0: [
    { hip: 20, knee: 21, ankle: 21, kneeY: 62, sole: 73 },
    { hip: 14, knee: 13, ankle: 13, kneeY: 66, sole: 77 },
  ],
  1: [
    { hip: 21, knee: 24, ankle: 25, kneeY: 65, sole: 77 },
    { hip: 14, knee: 11, ankle: 8, kneeY: 60, sole: 71 },
  ],
};

const SEATED: readonly [Leg, Leg] = [
  { hip: 21, knee: 29, ankle: 28, kneeY: 50, sole: 59 },
  { hip: 15, knee: 23, ankle: 22, kneeY: 52, sole: 63 },
];

const SEATED_REAR: readonly [Leg, Leg] = [
  { hip: 20, knee: 25, ankle: 25, kneeY: 46, sole: 51 },
  { hip: 14, knee: 20, ankle: 20, kneeY: 48, sole: 54 },
];

const INK = rgb(0x282331);

/** Extend cloth between the cut's shoulder and hem, keeping contour rows crisp. */
function extendCloth(rows: readonly string[], first: number, last: number, extra: number) {
  const count = last - first;
  const middle = Array.from(
    { length: count + extra },
    (_, y) => rows[first + Math.floor((y * count) / (count + extra))],
  );
  return [...rows.slice(0, first), ...middle, ...rows.slice(last)];
}

/** Original clothes and pose silhouettes for the room's native art grid. */
export function drawRoomCastBody(
  art: SpriteData,
  outfit: number,
  skin: readonly [string, string, string],
  back: boolean,
  sitting: boolean,
  pose: RoomCharacterPose,
): void {
  const look: Outfit = outfits[outfit] ?? outfits[0];
  const [cloth, shade, light] = look.top.map(rgb);
  const [denim, deepDenim, seam] = look.trousers.map(rgb);
  const [shoe, deepShoe, sole] = look.shoes.map(rgb);
  const [accent, piping] = look.accents.map(rgb);
  const [baseSkin, skinShade, skinLight] = skin;
  const palette: Paint = {
    o: INK,
    C: cloth,
    Q: shade,
    F: light,
    a: accent,
    b: piping,
    O: shade,
    K: baseSkin,
    k: skinShade,
    h: skinLight,
    V: shoe,
    W: sole,
    u: deepShoe,
    m: rgb(0xf4e3b6),
    n: rgb(0xb89572),
  };
  const sleeves = look.sleeve?.map(rgb) ?? [cloth, shade, light];
  const sleevePaint = { ...palette, C: sleeves[0], Q: sleeves[1], F: sleeves[2] };
  palette['!'] = sleeves[2];
  const farShoe = { ...palette, V: deepShoe, W: shoe };
  const stride = pose.stride ?? 0;
  const body = sitting ? 29 : 33;
  const rear = sitting && back;
  const [far, near] = rear ? SEATED_REAR : sitting ? SEATED : STANCES[stride];
  const joint = rear ? 43 : sitting ? 46 : 50;

  const write = (x: number, y: number, ink: string) => {
    if (art[y] && x >= 0 && x < art[y].length) art[y][x] = ink;
  };
  const paint = (
    mask: readonly string[],
    x: number,
    y: number,
    colors: Paint = palette,
    stagger = false,
  ) => {
    mask.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const ink = colors[row[dx]];
        const depth = stagger && dy >= 4 ? 2 - Math.min(4, Math.round(dx / 4.4)) : 0;
        if (ink) write(x + dx, y + dy + depth, ink);
      }
    });
  };
  const leg = (stance: Leg, away: boolean) => {
    const shoeMask = rear ? REAR_SHOE : sitting ? SEATED_SHOE : SHOE;
    const ankleY = stance.sole - shoeMask.length + 2;
    const width = look.wide ? 11 : 9;
    const base = away ? deepDenim : denim;
    for (let y = joint; y <= ankleY; y++) {
      const thigh = y <= stance.kneeY;
      const progress = thigh
        ? (y - joint) / (stance.kneeY - joint)
        : (y - stance.kneeY) / (ankleY - stance.kneeY);
      const center = thigh
        ? stance.hip + (stance.knee - stance.hip) * progress
        : stance.knee + (stance.ankle - stance.knee) * progress;
      const size = thigh
        ? width - Number(!sitting && progress > 0.65)
        : width - (look.wide ? 1 : progress < 0.4 ? 1 : 3);
      const left = Math.round(center - size / 2);
      for (let x = 0; x < size; x++) {
        const edge = x === 0 || x === size - 1;
        const cuff = look.cuffs && y >= ankleY - 2;
        const crease =
          sitting && !back && !away && y <= stance.kneeY && y > stance.kneeY - 3 && x <= size - 3;
        write(left + x, y, edge ? INK : cuff || crease ? seam : x === size - 2 ? deepDenim : base);
      }
    }
    paint(shoeMask, stance.ankle - 4, stance.sole - shoeMask.length + 1, away ? farShoe : palette);
  };

  leg(far, true);
  leg(near, false);
  const farSleeve = sitting ? FAR_SLEEVE : extendCloth(FAR_SLEEVE, 3, 8, 5);
  paint(farSleeve, 23, body + (sitting ? 6 : 5 + 2 * stride), sleevePaint);
  const coat = sitting
    ? [...COAT.slice(0, 18), 'oFFaaCCCCCCQaao', ' oOCCCCCCCCoo', '  ooooooooo']
    : COAT;
  const torso = outfit === 1 ? coat : outfit === 3 ? BOMBER : outfit === 4 ? VEST : TORSO;
  const top = sitting ? torso : extendCloth(torso, 9, torso.length - 3, 5);
  paint(top, 8, body, palette, !sitting);
  if (outfit === 2) paint(HOOD, back ? 5 : 6, body + 3);
  if (!back) paint(COLLARS[outfit] ?? COLLARS[0], 14, body + 5);
  paint(back ? look.back : look.front, 17, body + 6);
  if (outfit === 0) paint(['FFQQCC   ', ' CCQQCoo ', '   oooo  '], 13, body + (sitting ? 17 : 21));
  if (pose.gesture === 'wave') {
    paint(pose.beat ? WAVE_TILT : WAVE_UP, 0, body - 4, sleevePaint);
  } else if (sitting) {
    paint(outfit === 5 ? SHORT_LAP : LAP_SLEEVE, 5, body + 5, sleevePaint);
    if (pose.gesture === 'type' || pose.gesture === 'read') {
      paint(WORK_HAND, 23 + (pose.beat ?? 0), body + 13, sleevePaint);
      if (pose.gesture === 'read') paint(PAPER, 22, body + 14);
    }
  } else {
    const sleeve =
      outfit === 1
        ? COAT_SLEEVE
        : outfit === 3
          ? BOMBER_SLEEVE
          : outfit === 5
            ? SHORT_SLEEVE
            : NEAR_SLEEVE;
    const lengthenedSleeve = extendCloth(sleeve, 4, sleeve.length - 4, 21 - sleeve.length);
    paint(lengthenedSleeve, look.wide || outfit === 3 ? 3 : 4, body + 6 - 2 * stride, sleevePaint);
  }
}
