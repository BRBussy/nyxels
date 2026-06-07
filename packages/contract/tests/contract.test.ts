import { describe, expect, it } from "vitest";

import * as SharedCanvas from "@nyxels/contract-sdk";
import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";

type SharedCanvasPrivateState = {};

const witnesses: SharedCanvas.Witnesses<SharedCanvasPrivateState> = {
  operatorSecretKey: ({
    privateState,
  }: WitnessContext<SharedCanvas.Ledger, SharedCanvasPrivateState>): [SharedCanvasPrivateState, Uint8Array] => {
    return [privateState, new Uint8Array()];
  },
};

describe("shared-canvas contract", () => {
  it("constructs with the operatorSecretKey witness and exposes its circuits", () => {
    const contract = new SharedCanvas.Contract<SharedCanvasPrivateState>(witnesses);
    expect(contract.circuits.extendCanvas).toBeTypeOf("function");
    expect(contract.circuits.updateSquare).toBeTypeOf("function");
    expect(contract.circuits.incrementCoordinate).toBeTypeOf("function");
  });
});

// `incrementCoordinate` is the pure state-stepper behind the L-shell growth.
// Given the current cursor (depth, x, y) — where (x, y) is the coordinate just
// minted — it returns the next (depth, x, y). The minted sequence it must walk
// is the L-shell, identical to the UI's `coordAt`:
//
//   (0,0) (1,0) (1,1) (0,1) (2,0) (2,1) (2,2) (1,2) (0,2) (3,0) …
//
// which traces, per shell d: UP the new column x=d (y: 0→d), then LEFT along the
// new row y=d (x: d-1→0), then STEP OUT to depth d+1 at the (0,d) corner.
type State = readonly [depth: number, x: number, y: number];

const STEP_CASES: ReadonlyArray<{ leg: string; before: State; after: State }> = [
  // before (depth,x,y)            expected next (depth,x,y)
  { leg: "genesis → step out of the 1×1", before: [0, 0, 0], after: [1, 1, 0] },
  { leg: "climb column x=1 (up)", before: [1, 1, 0], after: [1, 1, 1] },
  { leg: "column x=1 full → move left", before: [1, 1, 1], after: [1, 0, 1] },
  { leg: "corner (0,1) → step out to depth 2", before: [1, 0, 1], after: [2, 2, 0] },
  { leg: "climb column x=2 (up)", before: [2, 2, 0], after: [2, 2, 1] },
  { leg: "climb column x=2 (up)", before: [2, 2, 1], after: [2, 2, 2] },
  { leg: "column x=2 full → move left", before: [2, 2, 2], after: [2, 1, 2] },
  { leg: "move left along row y=2", before: [2, 1, 2], after: [2, 0, 2] },
  { leg: "corner (0,2) → step out to depth 3", before: [2, 0, 2], after: [3, 3, 0] },
];

describe("incrementCoordinate — L-shell stepping", () => {
  it.each(STEP_CASES)("$leg: [$before] → [$after]", ({ before, after }) => {
    const [depth, x, y] = before;
    const result = SharedCanvas.pureCircuits.incrementCoordinate(BigInt(depth), BigInt(x), BigInt(y));
    expect(result).toEqual(after.map((n) => BigInt(n)));
  });

  it("walks the full first three shells in sequence", () => {
    // Drive the cursor from genesis and collect the coordinate minted at each
    // step; it must reproduce coordAt's L-shell ordering exactly.
    let state: State = [0, 0, 0];
    const minted: Array<[number, number]> = [];
    for (let i = 0; i < 9; i++) {
      minted.push([state[1], state[2]]); // (x, y) is the coordinate minted now
      const [d, x, y] = state;
      const next = SharedCanvas.pureCircuits.incrementCoordinate(BigInt(d), BigInt(x), BigInt(y));
      state = [Number(next[0]), Number(next[1]), Number(next[2])];
    }
    expect(minted).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [2, 0],
      [2, 1],
      [2, 2],
      [1, 2],
      [0, 2],
    ]);
  });
});