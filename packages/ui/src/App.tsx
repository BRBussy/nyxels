import { useCallback, useMemo, useRef, useState, type PointerEvent } from "react";

import { StrokeLayer } from "./components/StrokeLayer.tsx";
import { SQUARE_SIZE } from "./constants.ts";
import { coordAt, gridExtent } from "./sequence.ts";
import { serializeStrokes } from "./serialize.ts";
import type { InputPoint, Square, Stroke } from "./types.ts";

import "./App.css";

// Pointer movement (px) above which a press is treated as a draw, not a tap.
const TAP_SLOP = 4;

type Mode = "draw" | "view";
// One contiguous run of points within a single square, during a live gesture.
interface LiveSegment {
  index: number;
  points: InputPoint[];
}

// Drawing palette (paper is light, so the default ink is dark).
const PALETTE = ["#111827", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"] as const;
const SIZES = [
  { label: "S", value: 5 },
  { label: "M", value: 10 },
  { label: "L", value: 20 },
] as const;

const coordKey = (x: number, y: number) => `${x},${y}`;

function freshCanvas(): Square[] {
  return [{ x: 0, y: 0, strokes: [] }];
}

export default function App() {
  // In-memory only — the canvas is not persisted, so a reload starts fresh.
  const [squares, setSquares] = useState<Square[]>(freshCanvas);
  const [mode, setMode] = useState<Mode>("draw");
  // Indices of the squares currently active (drawable). Multiple at once.
  const [active, setActive] = useState<Set<number>>(() => new Set([0]));
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [size, setSize] = useState<number>(SIZES[1].value);

  // In-progress gesture as ordered per-square runs. The ref is the synchronous
  // source of truth used at commit; `live` mirrors it for rendering.
  const liveRef = useRef<LiveSegment[]>([]);
  const [live, setLive] = useState<LiveSegment[]>([]);
  const setLiveBoth = useCallback((next: LiveSegment[]) => {
    liveRef.current = next;
    setLive(next);
  }, []);

  // Undo stack of gesture ids (one entry per pen gesture).
  const [undoStack, setUndoStack] = useState<number[]>([]);
  const gestureRef = useRef<{ x0: number; y0: number; moved: boolean } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Monotonic gesture id (in-memory; resets with the page).
  const nextGesture = useRef(0);

  // coord "x,y" → square index, for hit-testing pointer positions.
  const coordIndex = useMemo(() => {
    const m = new Map<string, number>();
    squares.forEach((s, i) => m.set(coordKey(s.x, s.y), i));
    return m;
  }, [squares]);

  // Grid must fit every square, plus the "add" placeholder while in draw mode.
  const gridSize = gridExtent(squares.length + (mode === "draw" ? 1 : 0));
  const [nextX, nextY] = coordAt(squares.length);

  // Bottom-left origin: y grows UP, so a higher y maps to a smaller (0-based) row.
  const colOf = (x: number) => x;
  const rowOf = (y: number) => gridSize - 1 - y;

  // --- Hit-testing -----------------------------------------------------------
  /** Which square (and where within it) a client point falls on, or null. */
  const hitTest = useCallback(
    (clientX: number, clientY: number) => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const lx = clientX - rect.left;
      const ly = clientY - rect.top;
      const col = Math.floor(lx / SQUARE_SIZE);
      const row = Math.floor(ly / SQUARE_SIZE);
      if (col < 0 || row < 0 || col >= gridSize || row >= gridSize) return null;
      const index = coordIndex.get(coordKey(col, gridSize - 1 - row));
      if (index === undefined) return null;
      return { index, localX: lx - col * SQUARE_SIZE, localY: ly - row * SQUARE_SIZE };
    },
    [gridSize, coordIndex],
  );

  // --- Pointer handling (grid-level, so strokes can cross squares) -----------
  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (mode !== "draw") return;
      if ((e.target as HTMLElement).closest(".add-square")) return; // + handles itself

      gestureRef.current = { x0: e.clientX, y0: e.clientY, moved: false };
      try {
        gridRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* some devices reject capture — drawing still works */
      }

      const hit = hitTest(e.clientX, e.clientY);
      if (hit && active.has(hit.index)) {
        setLiveBoth([{ index: hit.index, points: [[hit.localX, hit.localY, e.pressure]] }]);
      } else {
        setLiveBoth([]);
      }
    },
    [mode, active, hitTest, setLiveBoth],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      if (!g) return;
      if (!g.moved && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > TAP_SLOP) g.moved = true;

      const hit = hitTest(e.clientX, e.clientY);
      if (!hit || !active.has(hit.index)) return; // only active squares record ink

      const cur = liveRef.current;
      const point: InputPoint = [hit.localX, hit.localY, e.pressure];
      const last = cur[cur.length - 1];
      if (last && last.index === hit.index) {
        // Extend the current run (same square).
        setLiveBoth([...cur.slice(0, -1), { index: last.index, points: [...last.points, point] }]);
      } else {
        // Crossed into a different active square — start a new ordered run.
        setLiveBoth([...cur, { index: hit.index, points: [point] }]);
      }
    },
    [active, hitTest, setLiveBoth],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const g = gestureRef.current;
      gestureRef.current = null;
      try {
        gridRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (mode !== "draw" || !g) {
        setLiveBoth([]);
        return;
      }

      // A tap (no real movement) toggles the pressed square's active state.
      if (!g.moved) {
        const hit = hitTest(g.x0, g.y0);
        if (hit) {
          setActive((prev) => {
            const next = new Set(prev);
            if (next.has(hit.index)) next.delete(hit.index);
            else next.add(hit.index);
            return next;
          });
        }
        setLiveBoth([]);
        return;
      }

      // A drag commits one stroke per square-run, all sharing a gesture id so
      // rendering can stitch them back into one seamless outline.
      const segments = liveRef.current;
      const totalPoints = segments.reduce((sum, s) => sum + s.points.length, 0);
      if (totalPoints > 1) {
        const gesture = nextGesture.current++;
        const additions = segments.map((seg, seq): { index: number; stroke: Stroke } => ({
          index: seg.index,
          stroke: { points: seg.points, color, size, gesture, seq },
        }));
        setSquares((prev) =>
          prev.map((sq, i) => {
            const adds = additions.filter((a) => a.index === i).map((a) => a.stroke);
            return adds.length > 0 ? { ...sq, strokes: [...sq.strokes, ...adds] } : sq;
          }),
        );
        setUndoStack((prev) => [...prev, gesture]);
      }
      setLiveBoth([]);
    },
    [mode, color, size, hitTest, setLiveBoth],
  );

  // --- Toolbar actions -------------------------------------------------------
  const addSquare = useCallback(() => {
    setSquares((prev) => {
      const [x, y] = coordAt(prev.length);
      setActive((a) => new Set(a).add(prev.length));
      return [...prev, { x, y, strokes: [] }];
    });
  }, []);

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const gesture = stack[stack.length - 1];
      setSquares((prev) =>
        prev.map((sq) => {
          const kept = sq.strokes.filter((st) => st.gesture !== gesture);
          return kept.length === sq.strokes.length ? sq : { ...sq, strokes: kept };
        }),
      );
      return stack.slice(0, -1);
    });
  }, []);

  const clearActive = useCallback(() => {
    setSquares((prev) => prev.map((sq, i) => (active.has(i) ? { ...sq, strokes: [] } : sq)));
    setUndoStack([]); // stack would reference removed strokes
  }, [active]);

  const resetCanvas = useCallback(() => {
    setSquares(freshCanvas());
    setActive(new Set([0]));
    setUndoStack([]);
  }, []);

  const isDraw = mode === "draw";
  const hasActiveInk = squares.some((sq, i) => active.has(i) && sq.strokes.length > 0);
  const dim = gridSize * SQUARE_SIZE;

  // Per-square serialized size — recomputed only when committed strokes change,
  // not on every pointer move.
  const sizes = useMemo(
    () =>
      squares.map((sq) => ({
        x: sq.x,
        y: sq.y,
        count: sq.strokes.length,
        bytes: serializeStrokes(sq.strokes).length,
      })),
    [squares],
  );
  const totalStrokes = sizes.reduce((sum, s) => sum + s.count, 0);
  const totalBytes = sizes.reduce((sum, s) => sum + s.bytes, 0);
  const kb = (bytes: number) => (bytes / 1024).toFixed(3);

  return (
    <main className="app">
      <header>
        <h1>Shared Canvas</h1>
        <p>
          {isDraw
            ? "Tap squares to (de)activate them, then drag to draw — strokes flow across active squares."
            : "Viewing the canvas. Switch to Draw to edit."}
        </p>
      </header>

      <div className="toolbar" role="toolbar" aria-label="Tools">
        <div className="modes" role="group" aria-label="Mode">
          <button type="button" className="mode-btn" aria-pressed={isDraw} onClick={() => setMode("draw")}>
            Draw
          </button>
          <button type="button" className="mode-btn" aria-pressed={!isDraw} onClick={() => setMode("view")}>
            View
          </button>
        </div>

        {isDraw && (
          <>
            <div className="group" aria-label="Color">
              {PALETTE.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className="swatch"
                  style={{ background: swatch }}
                  aria-label={`Color ${swatch}`}
                  aria-pressed={color === swatch}
                  onClick={() => setColor(swatch)}
                />
              ))}
            </div>

            <div className="group" aria-label="Brush size">
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className="size-btn"
                  aria-pressed={size === s.value}
                  onClick={() => setSize(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="group">
              <button type="button" className="action" onClick={undo} disabled={undoStack.length === 0}>
                Undo
              </button>
              <button type="button" className="action" onClick={clearActive} disabled={!hasActiveInk}>
                Clear active
              </button>
              <button type="button" className="action" onClick={resetCanvas}>
                Reset
              </button>
            </div>
          </>
        )}
      </div>

      <div className="canvas-frame">
        <div
          ref={gridRef}
          className={isDraw ? "grid grid--draw" : "grid"}
          style={{ width: dim, height: dim }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* White paper tiles, one per square (bottom layer). */}
          {squares.map((sq) => (
            <div
              key={`t${coordKey(sq.x, sq.y)}`}
              className="tile"
              style={{ left: colOf(sq.x) * SQUARE_SIZE, top: rowOf(sq.y) * SQUARE_SIZE, width: SQUARE_SIZE, height: SQUARE_SIZE }}
            />
          ))}

          {/* All ink, on one seamless overlay. */}
          <StrokeLayer squares={squares} gridSize={gridSize} live={live} liveColor={color} liveSize={size} />

          {/* Grey wash over inactive squares (draw mode), above the ink. */}
          {isDraw &&
            squares.map((sq, i) =>
              active.has(i) ? null : (
                <div
                  key={`d${coordKey(sq.x, sq.y)}`}
                  className="dim"
                  style={{ left: colOf(sq.x) * SQUARE_SIZE, top: rowOf(sq.y) * SQUARE_SIZE, width: SQUARE_SIZE, height: SQUARE_SIZE }}
                />
              ),
            )}

          {/* Add-next placeholder (top layer, clickable). */}
          {isDraw && (
            <button
              type="button"
              className="add-square"
              style={{ left: colOf(nextX) * SQUARE_SIZE, top: rowOf(nextY) * SQUARE_SIZE, width: SQUARE_SIZE, height: SQUARE_SIZE }}
              aria-label={`Add square at ${nextX}, ${nextY}`}
              title={`Add square at [${nextX}, ${nextY}]`}
              onClick={addSquare}
            >
              +
            </button>
          )}
        </div>
      </div>

      <footer>
        {mode.toUpperCase()} · {squares.length} square{squares.length === 1 ? "" : "s"}
        {isDraw && ` · ${active.size} active · next: [${nextX}, ${nextY}]`}
      </footer>

      <table className="sizes">
        <thead>
          <tr>
            <th>square coordinates</th>
            <th>no. strokes</th>
            <th>serialised strokes size [kb]</th>
          </tr>
        </thead>
        <tbody>
          {sizes.map((s) => (
            <tr key={coordKey(s.x, s.y)}>
              <td>
                [{s.x}, {s.y}]
              </td>
              <td>{s.count}</td>
              <td>{kb(s.bytes)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>total</td>
            <td>{totalStrokes}</td>
            <td>{kb(totalBytes)}</td>
          </tr>
        </tfoot>
      </table>
    </main>
  );
}
