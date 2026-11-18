import { rgbaToHex } from '../../../../core/src/assets/colorUtils.js';
import { CHAR_FRAME_W } from '../../../../core/src/assets/constants.js';
import type { SpriteData } from '../types.js';

interface RoomCharacterHead {
  standing: SpriteData;
  front: SpriteData;
  skin: string;
  iris: string;
  ink: string;
  back: boolean;
  blink: boolean;
  headY: number;
}

const HEAD_X = 5;
const HAIR_X = 3;

// Native room pixels. The nearer cheek faces the viewer, the far eye sits
// higher, and an inward nose bridge leaves breathing room at the silhouette.
const FACE = [
  '       oooooooooo',
  '     oosSSSSSSSSSoo',
  '   oossSSSSSSSSSSSSoo',
  '  oAssSSSSSSSSSSSSSSSo',
  ' oAssSSSSSSSSSSSSSSSSSo',
  ' oAsSSSSSSSSSSSSSSSSSSSo',
  'oAAsSSSSSSSSSSSSSSSSSSSo',
  'oAAsSSSSSSSSSSSSSSSBBSSo',
  'oAAsSSSSSSSSSSSSSSBSSSSo',
  'oAAsSSSSSSSSBBBSSSeEGSSo',
  'oAAsSSSSSSSBSSSSSSeEGSSo',
  'oAAAssSSSSEEGSSSSsSShSSo',
  'oosAAsSSSSEEGSSSSsHhSSSo',
  'oAzsAAssSSEeGSSSszHhSSSo',
  ' oSAsAsSSSSSSSSSzHHhSSo',
  ' oAZASssSSSSSSSSSHhhSSo',
  '  oAAAssSSSSSSSSSSsSSSo',
  '  ooAAAssSSSSSSSmmmSSo',
  '   ooAAAssSSSSSSSSsSo',
  '    ooAAAssSSSSSSSSo',
  '     oooAAAAssSSSoo',
  '        ooooooooo',
];

const REAR = [
  '       oooooooooo',
  '     oorRRRRRRRRRoo',
  '   oorrRRRRRRRRRRRRoo',
  '  orrrRRRRRRRRRRRRRRRo',
  ' orrrRRRRRRRRRRRRRRRRRo',
  ' orrRRRRRRRRRRRRRRRRRrro',
  'orrRRRRRRRRRRRRRRRRRRrro',
  'orrRRRRRRRRRRRRRRRRRRrro',
  'orrRRRRRRRRRRRRRRRRRrrro',
  'orrRRRRRRRRRRRRRRRRRrrro',
  'orrrRRRRRRRRRRRRRRRRrsro',
  ' orrRRRRRRRRRRRRRRRrrSAo',
  ' orrrRRRRRRRRRRRRRrroSAo',
  '  orrRRRRRRRRRRRRRrroSzo',
  '  orrrRRRRRRRRRRRrroSSAo',
  '   oorrRRRRRRRRrrroSSAso',
  '    oorrrrrrrrrrooSSAso',
  '     ooorrrrrrroSSAAso',
  '       ooooAAAASSAso',
  '           oAAAAAso',
  '            oAAAAo',
  '             oooo',
];

const NEAR_LENS = ['ggggggg', 'g     g', 'g     g', 'g     g', ' ggggg '];
const FAR_LENS = [' ggggg', 'g    g', 'g    g', ' gggg '];

function shade(pixel: string, amount: number, lift = 0): string {
  const channel = (at: number) =>
    Math.min(255, Math.round(parseInt(pixel.slice(at, at + 2), 16) * amount + lift));
  const alpha = pixel.length === 9 ? parseInt(pixel.slice(7), 16) : 255;
  return rgbaToHex(channel(1), channel(3), channel(5), alpha);
}

/** Keep the existing hair or hat and any trailing locks, while tapering
 * outside corners on the finer grid. Hair colors remain the wardrobe's. */
function drawHair(
  art: SpriteData,
  source: SpriteData,
  skin: string,
  back: boolean,
  headY: number,
): void {
  const first = source.findIndex((row) => row.some(Boolean));
  if (first < 0 || first > 12) return;
  const scalp = source.slice(first, 11).flat().filter(Boolean);
  const colors = new Set(scalp);
  const hairInk = (pixel: string) => pixel && pixel !== skin && colors.has(pixel);
  const top = headY - 6 + Math.max(-2, Math.min(2, first - 3));
  const crown = headY + 7 - top;
  const rows = Array.from({ length: crown + 17 }, () =>
    new Array<string>(CHAR_FRAME_W * 2).fill(''),
  );
  for (let y = 0; y <= crown; y++) {
    const row = source[Math.round(first + ((12 - first) * y) / crown)];
    for (let x = 0; x < CHAR_FRAME_W; x++) {
      if (hairInk(row[x])) rows[y].fill(row[x], x * 2, x * 2 + 2);
    }
  }
  for (let y = 13; y < 21; y++) {
    for (let x = 0; x < CHAR_FRAME_W; x++) {
      const pixel = source[y][x];
      if ((back || x < 5 || x > 12) && hairInk(pixel)) {
        const dy = crown + 1 + (y - 13) * 2;
        rows[dy].fill(pixel, x * 2, x * 2 + 2);
        rows[dy + 1].fill(pixel, x * 2, x * 2 + 2);
      }
    }
  }
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const pixel = row[x];
      if (!pixel) continue;
      const side = !row[x - 1] ? 1 : !row[x + 1] ? -1 : 0;
      const end = !rows[y - 1]?.[x] ? 1 : !rows[y + 1]?.[x] ? -1 : 0;
      const roundCorner = side && end && row[x + 2 * side] && rows[y + end]?.[x];
      if (!roundCorner) art[top + y][HAIR_X + x] = pixel;
    }
  });
}

/** Paint the head with a single-pixel ink stroke at the room's 2× art scale. */
export function drawRoomCharacterHead(art: SpriteData, options: RoomCharacterHead): void {
  const { standing, front, skin, iris, ink, back, blink, headY } = options;
  const hair = standing[9][7] || standing[8][7] || skin;
  const palette: Record<string, string> = {
    o: ink,
    S: skin,
    s: shade(skin, 0.88),
    A: shade(skin, 0.75),
    B: shade(skin, 0.52),
    H: shade(skin, 1.13, 5),
    h: shade(skin, 1.03, 3),
    R: hair,
    r: shade(hair, 0.78),
    E: blink ? shade(skin, 0.59) : iris,
    e: blink ? skin : shade(iris, 1.04, 8),
    G: blink ? skin : shade(skin, 1.08, 16),
    z: shade(skin, 0.63),
    Z: shade(skin, 0.57),
    m: shade(skin, 0.56),
  };
  const paint = (rows: readonly string[], left: number, top: number) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const pixel = palette[row[x]];
        if (pixel) art[headY + top + y][HEAD_X + left + x] = pixel;
      }
    });
  };
  paint(back ? REAR : FACE, 0, 0);
  const eyewear = front[15][7];
  if (
    !back &&
    eyewear &&
    eyewear !== skin &&
    eyewear === front[15][8] &&
    eyewear !== front[14][7]
  ) {
    palette.g = eyewear;
    paint(FAR_LENS, 16, 8);
    paint([' gg', 'g'], 14, 10);
    paint(NEAR_LENS, 8, 10);
  }
  drawHair(art, standing, skin, back, headY);
}
