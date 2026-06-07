import type { InputPoint, Stroke } from "./types.ts";

// Compact, reversible binary codec for Stroke[] ⇄ Uint8Array.
//
// The bulk of a canvas is `points`: densely sampled and locally close together.
// We exploit that with three tricks:
//   1. Quantise reals to fixed-point integers (documented precision below).
//   2. Delta-encode each point against the previous one (small magnitudes).
//   3. Zig-zag + LEB128 varint the integers (small magnitudes ⇒ few bytes).
//
// Within the quantisation precision the round-trip is lossless AND idempotent:
// re-encoding a decoded value yields byte-identical output. Arbitrary float
// inputs are snapped to the nearest representable value (error ≤ half a step).
//
// Wire layout (all ints LEB128 varints; signed values zig-zag encoded):
//   u8    version
//   var   strokeCount
//   per stroke:
//     u8    flags          bit0 hasGesture, bit1 hasSeq
//     u8×3  r, g, b         colour
//     var   round(size * SIZE_SCALE)
//     var   gesture         (only if hasGesture)
//     var   seq             (only if hasSeq)
//     var   pointCount
//     per point (delta from previous; first point's "previous" is 0):
//       svar  dqx           qx = round(x * COORD_SCALE)
//       svar  dqy           qy = round(y * COORD_SCALE)
//       u8    round(pressure * PRESSURE_MAX)

export const SERIAL_VERSION = 1;
/** Coordinate precision: 1/COORD_SCALE px (≈ 0.03 px). */
export const COORD_SCALE = 32;
/** Brush-size precision: 1/SIZE_SCALE px. */
export const SIZE_SCALE = 16;
/** Pressure precision: 1/PRESSURE_MAX (8-bit). */
export const PRESSURE_MAX = 255;

const HAS_GESTURE = 1 << 0;
const HAS_SEQ = 1 << 1;

// --- Low-level integer IO ----------------------------------------------------

class ByteWriter {
  private buf: number[] = [];

  u8(value: number): void {
    this.buf.push(value & 0xff);
  }

  /** Unsigned LEB128. Uses arithmetic (not bitwise) so values > 2^31 are safe. */
  varUint(value: number): void {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`varUint expects a non-negative integer, got ${value}`);
    }
    let v = value;
    while (v > 0x7f) {
      this.buf.push((v % 128) | 0x80);
      v = Math.floor(v / 128);
    }
    this.buf.push(v);
  }

  /** Signed varint via zig-zag, so small magnitudes (incl. negative) stay tiny. */
  varInt(value: number): void {
    if (!Number.isInteger(value)) throw new RangeError(`varInt expects an integer, got ${value}`);
    this.varUint(value >= 0 ? value * 2 : value * -2 - 1);
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.buf);
  }
}

class ByteReader {
  private buf: Uint8Array;
  private pos = 0;

  constructor(buf: Uint8Array) {
    this.buf = buf;
  }

  u8(): number {
    if (this.pos >= this.buf.length) throw new RangeError("unexpected end of buffer");
    return this.buf[this.pos++];
  }

  varUint(): number {
    let result = 0;
    let scale = 1;
    let byte: number;
    do {
      byte = this.u8();
      result += (byte & 0x7f) * scale;
      scale *= 128;
    } while (byte & 0x80);
    return result;
  }

  varInt(): number {
    const zig = this.varUint();
    return zig % 2 === 0 ? zig / 2 : -(zig + 1) / 2;
  }

  get remaining(): number {
    return this.buf.length - this.pos;
  }
}

// --- Colour helpers ----------------------------------------------------------

function parseColor(color: string): [number, number, number] {
  let hex = color.trim().replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) {
    throw new RangeError(`unsupported colour (need #rgb or #rrggbb): ${color}`);
  }
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function toHexColor(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function quantizePressure(pressure: number): number {
  const q = Math.round(pressure * PRESSURE_MAX);
  return q < 0 ? 0 : q > PRESSURE_MAX ? PRESSURE_MAX : q;
}

// --- Public API --------------------------------------------------------------

/** Encode an array of strokes into a compact Uint8Array. */
export function serializeStrokes(strokes: Stroke[]): Uint8Array {
  const w = new ByteWriter();
  w.u8(SERIAL_VERSION);
  w.varUint(strokes.length);

  for (const stroke of strokes) {
    let flags = 0;
    if (stroke.gesture !== undefined) flags |= HAS_GESTURE;
    if (stroke.seq !== undefined) flags |= HAS_SEQ;
    w.u8(flags);

    const [r, g, b] = parseColor(stroke.color);
    w.u8(r);
    w.u8(g);
    w.u8(b);

    w.varUint(Math.round(stroke.size * SIZE_SCALE));
    if (stroke.gesture !== undefined) w.varUint(stroke.gesture);
    if (stroke.seq !== undefined) w.varUint(stroke.seq);

    w.varUint(stroke.points.length);
    let prevX = 0;
    let prevY = 0;
    for (const [x, y, pressure] of stroke.points) {
      const qx = Math.round(x * COORD_SCALE);
      const qy = Math.round(y * COORD_SCALE);
      w.varInt(qx - prevX);
      w.varInt(qy - prevY);
      w.u8(quantizePressure(pressure));
      prevX = qx;
      prevY = qy;
    }
  }

  return w.toUint8Array();
}

/** Decode a Uint8Array produced by serializeStrokes back into strokes. */
export function deserializeStrokes(bytes: Uint8Array): Stroke[] {
  const r = new ByteReader(bytes);
  const version = r.u8();
  if (version !== SERIAL_VERSION) {
    throw new RangeError(`unsupported serial version ${version} (expected ${SERIAL_VERSION})`);
  }

  const count = r.varUint();
  const strokes: Stroke[] = [];
  for (let i = 0; i < count; i++) {
    const flags = r.u8();
    const color = toHexColor(r.u8(), r.u8(), r.u8());
    const size = r.varUint() / SIZE_SCALE;

    const stroke: Stroke = { points: [], color, size };
    if (flags & HAS_GESTURE) stroke.gesture = r.varUint();
    if (flags & HAS_SEQ) stroke.seq = r.varUint();

    const pointCount = r.varUint();
    const points: InputPoint[] = [];
    let qx = 0;
    let qy = 0;
    for (let j = 0; j < pointCount; j++) {
      qx += r.varInt();
      qy += r.varInt();
      const pressure = r.u8() / PRESSURE_MAX;
      points.push([qx / COORD_SCALE, qy / COORD_SCALE, pressure]);
    }
    stroke.points = points;
    strokes.push(stroke);
  }

  return strokes;
}
