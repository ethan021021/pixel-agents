import { Direction, type SpriteData } from '../types.js';
import { drawRoomCastBody, rgb } from './roomCastBody.js';
import { ROOM_SEATED_FRAME_HEIGHT, type RoomCharacterPose } from './roomCharacterArt.js';

const WIDTH = 36;
const HEIGHT = 78;
const INK = rgb(0x231e28);

const FACE = [
  '       oooooooooooo',
  '     ooffffffffffffoo',
  '   oossffffffffffffffo',
  '  ossssfffffffffffffffo',
  ' ossssfffffffffffffffffo',
  ' ossssfffffffffffffffffo',
  'osssssfffffffffffffffffo',
  'osssssfffffffffffffffffo',
  'ossssssffffffffffffffffo',
  'ossssssffffffffffffffffo',
  'ossssssffffffffffffffffo',
  'osssffssfffffffffffffffo',
  'ossfsfsssfffffffffffffho',
  'ossfsfsssfffffffffffffho',
  'osssffssfffffffffffffffo',
  ' ossssssfffffffffffffffo',
  '  ossssssffffffffffffffo',
  '   oosssssffffffffffffo',
  '     osssssffffffffffo',
  '      oossssfffffffoo',
  '        oosssffffoo',
  '          ooooooo',
];

const BACK_OF_HEAD = [
  '       oooooooooooo',
  '     ooccccccccccccoo',
  '   oocccccccccccccccco',
  '  occccccccccccccccccco',
  ' occcccccccccccccccccddo',
  ' occccccccccccccccccdddo',
  'occcccccccccccccccccdddo',
  'occcccccccccccccccccdddo',
  'occccccccccccccccccddddo',
  'occccccccccccccccccddddo',
  'odccccccccccccccccdddddo',
  'odccccccccccccccccdddsfo',
  'oddccccccccccccccdddsffo',
  'odddccccccccccccdddsfsfo',
  'oddddccccccccccddddsfso',
  ' oddddddddddddddddssffo',
  '  oodddddddddddddsssffo',
  '    oodddddddddssssffo',
  '      ooddddddsssffoo',
  '        ossssffffffo',
  '         oooooooooo',
];

const QUIFF = [
  '             oooooooo',
  '          oooaaacccaaooo',
  '        ooooooaaacccccccao',
  '     oooaaaaaaccccccccccao',
  '    oacccccccccccaaaaaaco',
  '  ooccccccccccaaaaacccco',
  ' odcccccaaaaaacccccccoo',
  'oddcccccccccccccccooo',
  'odddccccccddcccoooo',
  'oddddcccdcccdoo',
  'oddddccccccoo',
  ' odddccccoo',
  ' odddccoo',
  '  oddco',
  '   ooo',
];

const BOB = [
  '         ooooooooo',
  '      oooaaaaaaaaaooo',
  '    ooaacccccccccccaaoo',
  '   oaacccccccccccccccaao',
  '  oacccccccccccccccccccao',
  ' oacccccccccccccccccccccao',
  'occcccccccccccccccccccccco',
  'occcccccccccccccccccccooo',
  'odcccccooooooooooooooo',
  'oddccco',
  'oddccco',
  'oddccco',
  'odddcco',
  'odddcco',
  'oddddcco',
  'oddddcco',
  'odddccco',
  'odddccco',
  'odddcccco',
  'oddcccccao',
  ' odccccaoo',
  '  oooooo',
];

const BEANIE = [
  '           ooooooo',
  '        oooaaaaaaaooo',
  '      ooaaaaaaaaaaaaaoo',
  '     oaacccccccccccccaao',
  '    oaacccccccccccccccaao',
  '   oaacccccccccccccccccao',
  '  oaaccdccccccccccccdccao',
  '  oaacdcccccccccccccdccoo',
  ' oaaaccccdccccccccdcccooo',
  ' oaadddddddddddddddddooo',
  'oaddccccccccccccccccco',
  'oddcccccccccccccccooo',
  'odccoooooooooccooo',
  ' oooo        ooo',
];

const TWISTS = [
  '     oooooo',
  '   ooaaccddoo   ooooo',
  '  oaacccdddooooooaacaoo',
  '  oaccccdodccaaacccaaado',
  '  occccdocccaaccccaccccco',
  '   odddoccaaaccccadcccddo',
  '    oooaaacccccccdcccdo',
  '     oacccccccddcccdoo',
  '    occcccdddccccco',
  '    occccdddccccoo',
  '   occccdddccooo',
  '   oddddccooo',
  '   odddcco',
  '   oddcoo',
  '   oddo',
  '  oacdo',
  '  ocddo',
  '   ooo',
];

const SILVER = [
  '          oooooooo',
  '       oooaaaccccaoo',
  '     ooaaaaccccaaccaoo',
  '   ooaaacccaacccccccaaoo',
  '  oaaaaccaaacccccccaaccao',
  '  oaccccaaccccccccaacccao',
  ' oaccccaacccccccccccacco',
  ' oacccacccccccoooocccoo',
  'odccccooooooo    oooo',
  'oddccco',
  'oddcco',
  ' odcco',
  ' odco',
  '  oo',
];

const COILS = [
  '        ooooo ooooo',
  '     oooaaaacoacaaaooo',
  '    oaaaccccccaccccaaao',
  '  ooaacdccccccccccdccaoo',
  ' oaaacccccdccccccccccccao',
  ' oaccccccccccdcccdcccccao',
  'occcccccccccccccccccccccao',
  'odcccccddcccccccdcccccccao',
  'oddcccccccccccccccccddooo',
  'odddccccccccccccccddoo',
  'oddddccccccccddooooo',
  ' oddddooooooo',
  ' odddo',
];

const looks = [
  {
    skin: [rgb(0xd88f5c), rgb(0xad6340), rgb(0xf4ae79)],
    hair: [rgb(0x432b28), rgb(0x2d2327), rgb(0x745043)],
    crown: QUIFF,
  },
  {
    skin: [rgb(0xe5ad83), rgb(0xbf7c62), rgb(0xffd0a0)],
    hair: [rgb(0x322740), rgb(0x231e2d), rgb(0x554367)],
    crown: BOB,
  },
  {
    skin: [rgb(0xe5aa78), rgb(0xbd7954), rgb(0xffe0a0)],
    hair: [rgb(0x963a42), rgb(0x702b37), rgb(0xba5652)],
    crown: BEANIE,
  },
  {
    skin: [rgb(0xa86140), rgb(0x80442f), rgb(0xd18a5a)],
    hair: [rgb(0x382622), rgb(0x2b1e20), rgb(0x6b4933)],
    crown: TWISTS,
  },
  {
    skin: [rgb(0xbd7c51), rgb(0x945738), rgb(0xdf9e6b)],
    hair: [rgb(0xadb4b4), rgb(0x747b84), rgb(0xdde2d8)],
    crown: SILVER,
  },
  {
    skin: [rgb(0x965638), rgb(0x6c382b), rgb(0xc58055)],
    hair: [rgb(0x342830), rgb(0x251e26), rgb(0x55404b)],
    crown: COILS,
  },
] as const;

type RoomLook = (typeof looks)[number];

function paint(
  art: SpriteData,
  rows: readonly string[],
  x: number,
  y: number,
  colors: Record<string, string>,
) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = colors[row[dx]];
      if (color) art[y + dy][x + dx] = color;
    }
  });
}

function drawHead(
  art: SpriteData,
  look: RoomLook,
  index: number,
  back: boolean,
  blink: boolean,
  sitting: boolean,
) {
  const y = sitting ? 13 : 17;
  const [f, s, h] = look.skin;
  const [c, d, a] = look.hair;
  const colors = { o: INK, f, s, h, c, d, a, w: rgb(0xf3e6ce), l: rgb(0x644336) };
  const scalp = index === 2 ? { ...colors, c: rgb(0x5d3b30), d: rgb(0x3c2928) } : colors;
  paint(art, back ? BACK_OF_HEAD : FACE, 5, y, scalp);
  paint(art, look.crown, 4, y - 6, colors);

  if (back) {
    // The sides of the hat and bob continue around the nape.
    if (index === 2)
      paint(
        art,
        [' aaaccccccccccccaaad', ' aacccccccccccccaaad', ' oddddddddddddddddo'],
        6,
        y + 4,
        colors,
      );
    if (index === 1)
      paint(art, ['     dddd', '    dddddo', '  dddddddo', '  ooooooo'], 20, y + 13, colors);
    return;
  }

  // The bridge, nose and mouth turn within the cheek plane, away from the outline.
  const near = blink ? [' ooo'] : [' ooo', ' woo', '  of'];
  const far = blink ? [' oo'] : [' oo', 'woo', '  o'];
  const eyeX = index === 3 || index === 5 ? 16 : 15;
  paint(art, ['  ll', ' l'], eyeX, y + 7, colors);
  paint(art, [' ll'], 24, y + 6, colors);
  paint(art, near, eyeX, y + 10, colors);
  paint(art, far, 24, y + 8, colors);
  paint(art, ['sh', 'sh', 'shh', ' ll'], 22, y + 10, colors);
  paint(art, index === 1 || index === 3 ? ['   l', ' ll'] : ['lll'], 20, y + 16, colors);

  if (index === 4) {
    paint(
      art,
      ['       oooo', 'ooooo o   o', 'o   ooo   o', 'o   o  ooo', ' ooo'],
      15,
      y + 8,
      colors,
    );
  }
  if (index === 3) art[y + 15][10] = rgb(0xf5ca71);
  if (index === 2) paint(art, ['s s', ' s '], 16, y + 14, colors);
}

const frames = new Map<string, SpriteData>();

/** The original room cast has its own art. Its proportions are independent of the flat office. */
export function roomCastSprite(
  index: number,
  direction: Direction,
  sitting: boolean,
  pose: RoomCharacterPose = {},
  repeat = 0,
): SpriteData {
  const { stride = 0, gesture = 'rest', beat = 0, blink = false } = pose;
  const outfit = (index + repeat) % looks.length;
  const key = `${index}:${outfit}:${direction}:${sitting}:${stride}:${gesture}:${beat}:${blink}`;
  const cached = frames.get(key);
  if (cached) return cached;

  const look = looks[index];
  const art: SpriteData = Array.from({ length: sitting ? ROOM_SEATED_FRAME_HEIGHT : HEIGHT }, () =>
    new Array<string>(WIDTH).fill(''),
  );
  const back = direction === Direction.UP || direction === Direction.LEFT;
  drawRoomCastBody(art, outfit, look.skin, back, sitting, pose);
  drawHead(art, look, index, back, blink, sitting);
  if (direction === Direction.DOWN || direction === Direction.LEFT)
    art.forEach((row) => row.reverse());
  frames.set(key, art);
  return art;
}
