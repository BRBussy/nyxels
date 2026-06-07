import { memo, useMemo } from "react";

import { SQUARE_SIZE } from "../constants.ts";
import { buildGesturePaths, buildLivePath } from "../stroke.ts";
import type { InputPoint, Square } from "../types.ts";

interface LiveSegment {
  index: number;
  points: InputPoint[];
}

interface StrokeLayerProps {
  squares: Square[];
  gridSize: number;
  // The in-progress gesture, as ordered runs of points per square.
  live: LiveSegment[];
  liveColor: string;
  liveSize: number;
}

// A single SVG spanning the whole grid that draws ALL strokes in grid-pixel
// space. Because it isn't clipped per square, a reassembled cross-square stroke
// renders as one continuous outline — no seams at square borders.
function StrokeLayerImpl({ squares, gridSize, live, liveColor, liveSize }: StrokeLayerProps) {
  // Committed art only recomputes when the squares or grid size change — not on
  // every pointer move — so live drawing stays cheap.
  const committed = useMemo(() => buildGesturePaths(squares, gridSize), [squares, gridSize]);
  const livePath = buildLivePath(live, squares, gridSize, liveColor, liveSize);
  const dim = gridSize * SQUARE_SIZE;

  return (
    <svg className="stroke-layer" width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
      {committed.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} />
      ))}
      {livePath && <path d={livePath.d} fill={livePath.color} />}
    </svg>
  );
}

export const StrokeLayer = memo(StrokeLayerImpl);
