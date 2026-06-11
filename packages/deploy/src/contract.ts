// The shared-canvas contract binding used by the deploy + method tests:
// witnesses, private state, the CompiledContract, and join/read helpers.
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import * as SharedCanvas from "@nyxels/contract-sdk";

import { zkConfigPath } from "./config";

// The provable circuits the tests call, used to type `callTx.<circuit>`.
export type SharedCanvasCircuit = "extendCanvas" | "updateSquare";

// A canvas coordinate as the generated bindings shape it.
export type Coordinate = { x: bigint; y: bigint };

export type SharedCanvasPrivateState = {};

export const witnesses: SharedCanvas.Witnesses<SharedCanvasPrivateState> = {
  operatorSecretKey: ({
    privateState,
  }: WitnessContext<SharedCanvas.Ledger, SharedCanvasPrivateState>): [SharedCanvasPrivateState, Uint8Array] => [
    privateState,
    new Uint8Array(64),
  ],
};

export const INITIAL_PRIVATE_STATE: SharedCanvasPrivateState = {};

// Key under which midnight-js persists this contract's private state locally.
export const PRIVATE_STATE_ID = "nyxelsSharedCanvas";

export function buildCompiledContract() {
  return CompiledContract.make("shared-canvas", SharedCanvas.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );
}