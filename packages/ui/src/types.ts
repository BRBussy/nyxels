// One raw pointer sample captured while drawing, in a square's LOCAL coordinate
// space (0..SQUARE_SIZE on each axis). Pressure is 0..1 (0.5-ish for a mouse).
export type InputPoint = [x: number, y: number, pressure: number];

// A single freehand stroke segment, stored in the square it was drawn on. We keep
// the RAW input points (not an exported SVG outline) plus the brush settings, so a
// square round-trips with full fidelity — colour, thickness and pressure — and you
// can keep drawing on it afterwards.
//
// One pen gesture may cross several squares; it is split into one segment per
// square. `gesture` ties those segments together and `seq` records their order,
// so rendering can reassemble them into a single continuous, seamless outline
// while STORAGE stays per-square (see stroke.ts: buildGesturePaths).
export interface Stroke {
  points: InputPoint[];
  color: string;
  // perfect-freehand base brush size, in px.
  size: number;
  // Id shared by every segment of one pen gesture (undefined for legacy data).
  gesture?: number;
  // Order of this segment within its gesture.
  seq?: number;
}

// A single drawable cell of the canvas. Its coordinates follow the L-shell
// growth order (see sequence.ts); [0,0] is the bottom-left corner.
export interface Square {
  x: number;
  y: number;
  strokes: Stroke[];
}
