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
  });
});
