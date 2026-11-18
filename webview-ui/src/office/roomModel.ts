/** Authored furniture in the office's tile space. The three visible faces are
 * the top, +X edge, and +Y edge, in that order. */
export interface RoomBox {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  colors: readonly [top: string, xFace: string, yFace: string];
}

/** The cushion contact point for a seated character's hips, in local tile space. */
export interface RoomSeatSurface {
  x: number;
  y: number;
  z: number;
}

export interface RoomModel {
  /** The painter's order, from the rear pieces to the nearest details. */
  boxes: RoomBox[];
  surfaceHeight?: number;
  seating?: {
    /** Row-major, in the same order as the usable tiles in the footprint. */
    anchors: readonly RoomSeatSurface[];
    /** The near-facing portions that cover the edge of a seated character. */
    foreground: RoomBox[];
  };
}

export interface RoomModelInput {
  type: string;
  width: number;
  depth: number;
  backgroundRows: number;
  orientation: string | undefined;
  surfaceHeight: number;
  wallAlongX: boolean;
}
