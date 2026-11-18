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

export interface RoomModel {
  /** The painter's order, from the rear pieces to the nearest details. */
  boxes: RoomBox[];
  surfaceHeight?: number;
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
