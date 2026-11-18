import type { RoomPoint } from './roomProjection.js';

/** Nudge only exact nearest-neighbor ties in a fractional room bitmap. A fixed inset
 * can cross the next sampled texel at larger zooms, away from what the hit test picks. */
export function roomSampleInset(pixelZoom: number): number {
  return Number.isInteger(pixelZoom) ? 0 : Math.min(1 / 16, 1 / (16 * pixelZoom));
}

/** Scan a convex face through source-pixel centers, producing half-open integer spans. */
export function roomFaceSpans(
  points: readonly RoomPoint[],
  paint: (y: number, startX: number, endX: number) => void,
): void {
  const top = Math.ceil(Math.min(...points.map((p) => p.y)) - 0.5);
  const bottom = Math.ceil(Math.max(...points.map((p) => p.y)) - 0.5);
  for (let y = top; y < bottom; y++) {
    const sample = y + 0.5;
    let left = Infinity;
    let right = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if (a.y > sample === b.y > sample) continue;
      const x = a.x + ((sample - a.y) / (b.y - a.y)) * (b.x - a.x);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    if (left < right) paint(y, Math.ceil(left - 0.5), Math.ceil(right - 0.5));
  }
}
