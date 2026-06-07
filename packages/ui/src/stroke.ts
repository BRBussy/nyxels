import { getStroke } from "perfect-freehand";

import { SQUARE_SIZE } from "./constants.ts";
import type { InputPoint, Square } from "./types.ts";

// Shared brush feel. `size` is per-stroke (so each stroke keeps the thickness it
// was drawn at); the rest shape how the input points become a smooth outline.
const STROKE_OPTIONS = {
  thinning: 0.6,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
} as const;

export interface RenderPath {
  d: string;
  color: string;
}

interface LiveSegment {
  index: number; // square index this run of points belongs to
  points: InputPoint[];
}

/** A point in a square's local space → the overlay's grid-pixel space. */
function toGrid(p: InputPoint, sx: number, sy: number, gridSize: number): InputPoint {
  const col = sx;
  const row = gridSize - 1 - sy; // bottom-left origin: y grows up
  return [col * SQUARE_SIZE + p[0], row * SQUARE_SIZE + p[1], p[2]];
}

/** Run perfect-freehand over grid-space points and return an SVG path `d`. */
function pointsToPath(points: InputPoint[], size: number): string {
  if (points.length === 0) return "";
  return outlineToSvgPath(getStroke(points, { size, ...STROKE_OPTIONS }));
}

/**
 * Build the SVG paths for all committed strokes, in grid-pixel space.
 *
 * Storage is per-square, but a gesture that crossed squares was split into one
 * segment per square (sharing a `gesture` id). Here we regroup those segments by
 * gesture, order them by `seq`, concatenate their points and run getStroke ONCE —
 * so a cross-square stroke renders as a single seamless outline rather than a
 * row of separately-tapered pieces.
 */
export function buildGesturePaths(squares: Square[], gridSize: number): RenderPath[] {
  const grouped = new Map<number, { seq: number; sx: number; sy: number; points: InputPoint[]; color: string; size: number }[]>();
  const singles: RenderPath[] = []; // legacy strokes with no gesture id

  for (const sq of squares) {
    for (const stroke of sq.strokes) {
      if (stroke.gesture === undefined) {
        const d = pointsToPath(stroke.points.map((p) => toGrid(p, sq.x, sq.y, gridSize)), stroke.size);
        if (d) singles.push({ d, color: stroke.color });
        continue;
      }
      const arr = grouped.get(stroke.gesture) ?? [];
      arr.push({ seq: stroke.seq ?? 0, sx: sq.x, sy: sq.y, points: stroke.points, color: stroke.color, size: stroke.size });
      grouped.set(stroke.gesture, arr);
    }
  }

  // Sort gestures by id (≈ draw order) so later strokes paint on top.
  const gesturePaths = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, segs]) => {
      segs.sort((a, b) => a.seq - b.seq);
      const points = segs.flatMap((s) => s.points.map((p) => toGrid(p, s.sx, s.sy, gridSize)));
      return { d: pointsToPath(points, segs[0].size), color: segs[0].color };
    })
    .filter((p) => p.d);

  return [...singles, ...gesturePaths];
}

/**
 * The in-progress gesture as a single continuous path, so live drawing across
 * active squares is seamless (it's literally one stroke until committed).
 */
export function buildLivePath(
  segments: LiveSegment[],
  squares: Square[],
  gridSize: number,
  color: string,
  size: number,
): RenderPath | null {
  const points: InputPoint[] = [];
  for (const seg of segments) {
    const sq = squares[seg.index];
    if (!sq) continue;
    for (const p of seg.points) points.push(toGrid(p, sq.x, sq.y, gridSize));
  }
  if (points.length < 2) return null;
  return { d: pointsToPath(points, size), color };
}

// perfect-freehand's recommended outline → SVG path helper: a closed polygon
// drawn with quadratic curves through the midpoints for smoothness.
function outlineToSvgPath(points: number[][]): string {
  if (points.length === 0) return "";
  const d = points.reduce<(string | number)[]>(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...points[0], "Q"],
  );
  d.push("Z");
  return d.join(" ");
}
