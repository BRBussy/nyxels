import { describe, expect, it } from "vitest";

import { COORD_SCALE, PRESSURE_MAX, SERIAL_VERSION, deserializeStrokes, serializeStrokes } from "./serialize.ts";
import type { InputPoint, Stroke } from "./types.ts";

// Values aligned to the codec's quantisation grid, so the round-trip is EXACT.
// `coord` takes an already-scaled integer; `pres` takes an integer 0..255.
const coord = (q: number) => q / COORD_SCALE;
const pres = (byte: number) => byte / PRESSURE_MAX;

describe("serializeStrokes / deserializeStrokes", () => {
  it("returns a Uint8Array", () => {
    expect(serializeStrokes([])).toBeInstanceOf(Uint8Array);
  });

  it("round-trips an aligned stroke exactly", () => {
    const strokes: Stroke[] = [
      {
        points: [
          [coord(640), coord(1920), pres(128)], // 20, 60, ~0.5
          [coord(672), coord(1900), pres(200)],
          [coord(700), coord(1888), pres(255)],
        ],
        color: "#3b82f6",
        size: 10,
        gesture: 0,
        seq: 1,
      },
    ];
    expect(deserializeStrokes(serializeStrokes(strokes))).toEqual(strokes);
  });

  it("round-trips a realistic multi-stroke canvas exactly", () => {
    const strokes: Stroke[] = [
      { points: [[coord(0), coord(0), pres(0)]], color: "#111827", size: 5, gesture: 7, seq: 0 },
      {
        points: [
          [coord(64), coord(96), pres(120)],
          [coord(128), coord(160), pres(140)],
        ],
        color: "#ef4444",
        size: 20,
        gesture: 7,
        seq: 1,
      },
      { points: [], color: "#22c55e", size: 10, gesture: 8, seq: 0 },
    ];
    expect(deserializeStrokes(serializeStrokes(strokes))).toEqual(strokes);
  });

  it("round-trips an empty array", () => {
    expect(deserializeStrokes(serializeStrokes([]))).toEqual([]);
  });

  it("round-trips a stroke with no points", () => {
    const strokes: Stroke[] = [{ points: [], color: "#eab308", size: 8, gesture: 3, seq: 2 }];
    expect(deserializeStrokes(serializeStrokes(strokes))).toEqual(strokes);
  });

  it("omits optional fields (gesture/seq) when absent", () => {
    const strokes: Stroke[] = [{ points: [[coord(32), coord(32), pres(64)]], color: "#111827", size: 5 }];
    const out = deserializeStrokes(serializeStrokes(strokes));
    expect(out).toEqual(strokes);
    expect(out[0]).not.toHaveProperty("gesture");
    expect(out[0]).not.toHaveProperty("seq");
  });

  it("preserves seq === 0 (not treated as absent)", () => {
    const strokes: Stroke[] = [{ points: [[coord(10), coord(10), pres(10)]], color: "#a855f7", size: 5, gesture: 9, seq: 0 }];
    const out = deserializeStrokes(serializeStrokes(strokes));
    expect(out[0].seq).toBe(0);
    expect(out[0].gesture).toBe(9);
  });

  it("handles negative and out-of-range coordinates via zig-zag", () => {
    const strokes: Stroke[] = [
      {
        points: [
          [coord(-64), coord(4096), pres(255)], // -2, 128
          [coord(-128), coord(0), pres(0)],
        ],
        color: "#ffffff",
        size: 5,
      },
    ];
    expect(deserializeStrokes(serializeStrokes(strokes))).toEqual(strokes);
  });

  it("round-trips large gesture ids (multi-byte varint)", () => {
    const gesture = 1_000_000;
    const strokes: Stroke[] = [{ points: [[coord(32), coord(64), pres(100)]], color: "#f97316", size: 10, gesture, seq: 1234 }];
    const out = deserializeStrokes(serializeStrokes(strokes));
    expect(out[0].gesture).toBe(gesture);
    expect(out[0].seq).toBe(1234);
  });

  it("normalizes colour to lowercase #rrggbb (documented)", () => {
    const out = deserializeStrokes(serializeStrokes([{ points: [[coord(0), coord(0), pres(0)]], color: "#AABBCC", size: 5 }]));
    expect(out[0].color).toBe("#aabbcc");
  });

  it("expands #rgb shorthand colours", () => {
    const out = deserializeStrokes(serializeStrokes([{ points: [[coord(0), coord(0), pres(0)]], color: "#f0a", size: 5 }]));
    expect(out[0].color).toBe("#ff00aa");
  });

  it("snaps arbitrary floats to within half a quantisation step", () => {
    const points: InputPoint[] = Array.from({ length: 60 }, (_, i) => [
      ((i * 37) % 1000) / 8.3, // pseudo-random-ish spread across ~0..120
      ((i * 53) % 1000) / 8.3,
      ((i * 17) % 100) / 100,
    ]);
    const strokes: Stroke[] = [{ points, color: "#ef4444", size: 8, gesture: 1, seq: 0 }];
    const out = deserializeStrokes(serializeStrokes(strokes));

    out[0].points.forEach((p, i) => {
      const orig = points[i];
      expect(Math.abs(p[0] - orig[0])).toBeLessThanOrEqual(1 / COORD_SCALE / 2 + 1e-9);
      expect(Math.abs(p[1] - orig[1])).toBeLessThanOrEqual(1 / COORD_SCALE / 2 + 1e-9);
      expect(Math.abs(p[2] - orig[2])).toBeLessThanOrEqual(1 / PRESSURE_MAX / 2 + 1e-9);
    });
  });

  it("is idempotent: decode→encode→decode is stable and byte-identical", () => {
    const raw: Stroke[] = [
      {
        points: Array.from({ length: 40 }, (_, i) => [12.3456 + i * 0.7, 80.91 - i * 0.31, (i % 10) / 10] as InputPoint),
        color: "#3b82f6",
        size: 7.5,
        gesture: 42,
        seq: 0,
      },
      {
        points: Array.from({ length: 25 }, (_, i) => [50 + i, 50 - i, 0.5] as InputPoint),
        color: "#111827",
        size: 10,
        gesture: 42,
        seq: 1,
      },
    ];

    const once = deserializeStrokes(serializeStrokes(raw));
    const bytes1 = serializeStrokes(once);
    const twice = deserializeStrokes(bytes1);
    const bytes2 = serializeStrokes(twice);

    expect(twice).toEqual(once); // values stable after the first pass
    expect(Array.from(bytes2)).toEqual(Array.from(bytes1)); // bytes stable
  });

  it("is far smaller than JSON for a realistic gesture", () => {
    // Two squares of a cross-square gesture, ~120 samples each.
    const makeStroke = (seq: number): Stroke => ({
      points: Array.from({ length: 120 }, (_, i) => [(i % 120) + 0.5, ((i * 7) % 120) + 0.25, 0.5] as InputPoint),
      color: "#111827",
      size: 10,
      gesture: 3,
      seq,
    });
    const strokes = [makeStroke(0), makeStroke(1)];

    const bytes = serializeStrokes(strokes);
    const json = new TextEncoder().encode(JSON.stringify(strokes));

    // Comfortably better than 2× (in practice ~3–4×).
    expect(bytes.length * 2).toBeLessThan(json.length);
  });

  it("throws on an unknown version byte", () => {
    const bytes = serializeStrokes([{ points: [], color: "#111827", size: 5 }]);
    const tampered = Uint8Array.from(bytes);
    tampered[0] = SERIAL_VERSION + 99;
    expect(() => deserializeStrokes(tampered)).toThrow(/version/);
  });

  it("rejects malformed colours when encoding", () => {
    expect(() => serializeStrokes([{ points: [], color: "rgb(1,2,3)", size: 5 }])).toThrow(/colour/);
  });
});
