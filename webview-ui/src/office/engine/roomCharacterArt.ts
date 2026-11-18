import { rgbaToHex } from '../../../../core/src/assets/colorUtils.js';
import { CHAR_FRAME_H, CHAR_FRAME_W } from '../../../../core/src/assets/constants.js';
import { Direction, type SpriteData } from '../types.js';
import { drawRoomCharacterHead } from './roomCharacterHead.js';

export const ROOM_CHARACTER_NATIVE_SCALE = 2;
const FRAME_W = 36;
const STANDING_H = 78;
export const ROOM_SEATED_FRAME_HEIGHT = 70;
export const ROOM_SEATED_HIP = { x: 18, y: 48 } as const;

export interface RoomCharacterPose {
  standing?: SpriteData;
  front?: SpriteData;
  stride?: -1 | 0 | 1;
  gesture?: 'rest' | 'type' | 'read' | 'wave';
  beat?: 0 | 1;
  blink?: boolean;
}

const cache = new WeakMap<
  SpriteData,
  { standing: SpriteData; front: SpriteData; frames: Map<string, SpriteData> }
>();

type Mask = readonly string[];
type Paint = (
  rows: Mask,
  x: number,
  y: number,
  colors: Record<string, string>,
  native?: boolean,
) => void;

// The shoulder line, hem, and feet follow the same three-quarter axis.
const COAT = [
  '     oAAo      ',
  '   ooCCcooo    ',
  '  ooCCCqqcco   ',
  ' ooCCCTTqqcco  ',
  'oCCCCCTTqccco  ',
  'oCCCCCTTqccco  ',
  'oCCCCCTTqccoo  ',
  'oCCCCCTTqco    ',
  'oCCCCTTqoo     ',
  ' ooCCCTqo      ',
  '   oooo        ',
];
const FAR_SLEEVE = [' oooo ', 'oCcco ', 'oCcco ', ' oCco ', ' oCco ', ' ocUo ', ' oASo ', '  oo  '];
const SLEEVE = [' ooo ', 'oCqCo', 'oCCco', 'oCCco', 'oCcco', ' oUo ', ' oAo ', ' oSo ', '  o  '];
const LAP_SLEEVE = [
  ' ooo     ',
  'oCqCo    ',
  'oCCco    ',
  'oCCco    ',
  ' oCcco   ',
  '  oCCco  ',
  '   oUASo ',
  '     ooo ',
];
const WAVING_SLEEVE = [
  [' oo    ', 'oSHo   ', 'oSSAo  ', ' oAAo  ', '  oUo  ', '  oCCoo', '   oCCo', '    ooo'],
  ['oo     ', 'oHo    ', ' oSAo  ', '  oAo  ', '  oUCo ', '   oCoo', '   oCCo', '    ooo'],
] as const;
const TROUSER = [' oPPo ', 'oPKPo ', 'oPPpo ', 'oPKpo ', 'oPPpo ', 'oPPpo ', ' oPpo '];
const FORWARD_HIP = ['  oPPo  ', '  oPPPo ', '   oPPPo', '    oPPo', '    oPPo'];
const SKIRT = ['  oPPPPo  ', ' oPPPPPPo ', ' oPPPPpPo ', 'oPPPPpPPPo', 'ooPPpPPooo', '  oooooo  '];
const SHOE = [
  '  oooo      ',
  ' oDddLo     ',
  'oDDdLLoo    ',
  'oDOdLdLLoo  ',
  'oDdDddLLDDo ',
  ' odDDDDLDDdo',
  '  ooOOOOOoo ',
  '    ooooo   ',
];
const BENT_FAR = [
  ' oPPo     ',
  'oPPPPoo   ',
  'oPPPPPpo  ',
  ' oPPKPpo  ',
  '  ooPPpo  ',
  '    oPpo  ',
  '    oPpo  ',
  '     oo   ',
];
const BENT_NEAR = [
  'oooo     ',
  'oPPPoo   ',
  'oPPPPPoo ',
  'oPPKPPpo ',
  ' oPPPpPo ',
  '  ooPpPo ',
  '    oPpo ',
  '    oPpo ',
  '    oPpo ',
  '     oo  ',
];
// In the rear view, knees project away from the viewer above the hip line.
// The soles stay close to the cushion so they tuck behind the chair's back.
const RECEDING_LEG = ['    opo ', '  ooppo ', ' oPPppo ', 'oPPPpo  ', ' oooo   '];
const RECEDING_SHOE = [' oo ', 'oDdo', ' oOo'];

const nativeMasks = new WeakMap<Mask, Mask>();

/** Articulation uses tile-scale landmarks. Resolve its contours on the
 * native atlas so outlines and garment details occupy single pixels. */
function nativeMask(rows: Mask): Mask {
  const cached = nativeMasks.get(rows);
  if (cached) return cached;
  const expanded = rows.flatMap((row) => {
    const doubled = Array.from(row, (glyph) => glyph + glyph).join('');
    return [doubled, doubled];
  });
  const mask = expanded.map((row, y) =>
    Array.from(row, (glyph, x) => {
      if (glyph !== 'o') return glyph;
      const neighbors = [row[x + 1], row[x - 1], expanded[y + 1]?.[x], expanded[y - 1]?.[x]];
      if (neighbors.some((neighbor) => !neighbor || neighbor === ' ')) return glyph;
      return neighbors.find((neighbor) => neighbor !== 'o') ?? glyph;
    }).join(''),
  );
  nativeMasks.set(rows, mask);
  return mask;
}

function shade(pixel: string, amount: number, lift = 0): string {
  const channel = (at: number) =>
    Math.min(255, Math.round(parseInt(pixel.slice(at, at + 2), 16) * amount + lift));
  const alpha = pixel.length === 9 ? parseInt(pixel.slice(7), 16) : 255;
  return rgbaToHex(channel(1), channel(3), channel(5), alpha);
}

function mostCommon(pixels: string[], backup: string): string {
  const counts = new Map<string, number>();
  for (const ink of pixels) if (ink) counts.set(ink, (counts.get(ink) ?? 0) + 1);
  let count = 0;
  for (const [ink, frequency] of counts) {
    if (frequency <= count) continue;
    backup = ink;
    count = frequency;
  }
  return backup;
}

function sample(
  source: SpriteData,
  top: number,
  bottom: number,
  left: number,
  right: number,
): string[] {
  return source.slice(top, bottom).flatMap((row) => row.slice(left, right));
}

function lastInk(source: SpriteData): number {
  let y = source.length - 1;
  while (y >= 0 && !source[y].some(Boolean)) y--;
  return y;
}

/** Draw the same hinged seated pose in each room direction while taking colors
 * and recognizable details from the composed character wardrobe. */
export function roomCharacterSprite(
  source: SpriteData,
  direction: Direction,
  sitting: boolean,
  pose: RoomCharacterPose = {},
): SpriteData {
  if (source.length !== CHAR_FRAME_H || source[0]?.length !== CHAR_FRAME_W) return source;
  const {
    standing = source,
    front = standing,
    stride = 0,
    gesture = 'rest',
    beat = 0,
    blink = false,
  } = pose;
  const key = `${direction}:${sitting}:${stride}:${gesture}:${beat}:${blink}`;
  const cached = cache.get(source);
  const frames =
    cached?.standing === standing && cached.front === front
      ? cached.frames
      : new Map<string, SpriteData>();
  const existing = frames.get(key);
  if (existing) return existing;
  if (lastInk(standing) < 23 || !standing.slice(10, 18).some((row) => row.some(Boolean)))
    return source;

  const back = direction === Direction.UP || direction === Direction.LEFT;
  const mirror = direction === Direction.DOWN || direction === Direction.LEFT;
  const skin =
    front[17][8] || mostCommon(sample(front, 16, 18, 7, 9), rgbaToHex(183, 123, 93, 255));
  const shirt = front[20][5] || mostCommon(sample(standing, 19, 24, 5, 12), skin);
  const trousers = mostCommon(sample(front, 25, 27, 6, 10), shirt);
  const shoes = front[29][5] || mostCommon(sample(front, 29, 31, 5, 11), trousers);
  const iris = mostCommon(
    sample(front, 14, 16, 6, 11).filter((ink) => ink && parseInt(ink.slice(1, 7), 16) < 0x454545),
    shade(skin, 0.32),
  );
  const ink = rgbaToHex(38, 31, 41, 255);
  const paper = rgbaToHex(211, 222, 219, 255);
  const colors: Record<string, string> = {
    o: ink,
    S: skin,
    A: shade(skin, 0.76),
    H: shade(skin, 1.18, 3),
    C: shirt,
    c: shade(shirt, 0.72),
    q: shade(shirt, 1.13, 9),
    U: shade(shirt, 1.14, 15),
    T: shirt,
    P: trousers,
    p: shade(trousers, 0.7),
    K: shade(trousers, 1.11, 9),
    D: shade(shoes, 1.11, 6),
    d: shade(shoes, 0.8),
    L: shade(shoes, 1.19, 12),
    O: shade(shoes, 0.49, 6),
  };
  const art: SpriteData = Array.from(
    { length: sitting ? ROOM_SEATED_FRAME_HEIGHT : STANDING_H },
    () => new Array<string>(FRAME_W).fill(''),
  );
  const paint: Paint = (rows, x, y, palette, native = false) => {
    const mask = native ? rows : nativeMask(rows);
    const left = x * ROOM_CHARACTER_NATIVE_SCALE;
    const top = y * ROOM_CHARACTER_NATIVE_SCALE;
    mask.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const at = left + dx;
        const color = palette[row[dx]];
        if (color && at >= 0 && at < FRAME_W) art[top + dy][at] = color;
      }
    });
  };
  const hem = front[28].filter(Boolean).length;
  const skirt = hem >= 10 && hem > front[29].filter(Boolean).length;
  const legs = skirt ? { ...colors, P: skin, p: colors.A, K: shade(skin, 1.08, 5) } : colors;
  const farCloth = {
    ...legs,
    P: shade(legs.P, 0.79),
    K: shade(legs.K, 0.79),
    D: shade(shoes, 0.82, 6),
    L: shade(shoes, 0.96, 8),
  };

  if (sitting && back) {
    paint(RECEDING_LEG, 8, 21, farCloth);
    paint(RECEDING_SHOE, 12, 23, farCloth);
    paint(RECEDING_LEG, 6, 23, legs);
    paint(RECEDING_SHOE, 10, 25, colors);
  } else if (sitting) {
    paint(BENT_FAR, 8, 22, farCloth);
    paint(SHOE, 12, 28, farCloth, true);
    paint(BENT_NEAR, 4, 23, legs);
    paint(SHOE, 9, 30, colors, true);
  } else {
    const forward = stride === 1;
    const farX = stride === -1 ? 5 : 8 + stride * 2;
    const nearX = stride === -1 ? 7 : 4 - stride;
    const farY = forward ? 2 : 0;
    const nearY = forward ? -2 : 0;
    if (forward) paint(FORWARD_HIP, 7, 25, farCloth);
    paint(TROUSER, farX, 27 + farY, farCloth);
    paint(SHOE, farX, 33 + farY, farCloth, true);
    paint(TROUSER, nearX, 28 + nearY, legs);
    paint(SHOE, nearX, 35 + nearY, colors, true);
  }
  if (skirt) paint(SKIRT, sitting ? 5 : 4, sitting ? (back ? 22 : 23) : 25, colors);

  const bodyY = sitting ? 15 : 17;
  if (!sitting) paint(FAR_SLEEVE, 12, bodyY + 2 - stride, farCloth);
  paint(COAT, 2, bodyY, colors);
  // Give stripes, ties, and jackets from the cast their existing swatches on
  // the visible front or back of the shirt, inside the new sleeve geometry.
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 3; x++) {
      const swatch = standing[19 + y][7 + x];
      if (!swatch) continue;
      const dstY = (bodyY + y + 4) * ROOM_CHARACTER_NATIVE_SCALE;
      const dstX = (8 + x) * ROOM_CHARACTER_NATIVE_SCALE;
      for (let dy = 0; dy < ROOM_CHARACTER_NATIVE_SCALE; dy++) {
        for (let dx = 0; dx < ROOM_CHARACTER_NATIVE_SCALE; dx++) {
          const row = art[dstY + dy];
          if (row[dstX + dx] && row[dstX + dx] !== ink) row[dstX + dx] = swatch;
        }
      }
    }
  }
  if (sitting && (gesture === 'type' || gesture === 'read')) {
    paint([' ooo ', 'oCCoo', 'oCCASo', ' oooo '], 10 + beat, bodyY + 6, colors);
  }
  if (gesture !== 'wave') {
    paint(sitting ? LAP_SLEEVE : SLEEVE, 2, bodyY + 2 + (sitting ? 0 : stride), colors);
  }
  if (sitting && gesture === 'read') {
    paint(['  oo ', 'opppo', ' oppo', '  oo '], 10, bodyY + 8, { o: ink, p: paper });
  }
  drawRoomCharacterHead(art, {
    standing,
    front,
    skin,
    iris,
    ink,
    back,
    blink,
    headY: sitting ? 12 : 16,
  });
  if (gesture === 'wave') paint(WAVING_SLEEVE[beat], 0, bodyY - 3, colors);

  const result = mirror ? art.map((row) => row.reverse()) : art;
  frames.set(key, result);
  if (frames !== cached?.frames) cache.set(source, { standing, front, frames });
  return result;
}
