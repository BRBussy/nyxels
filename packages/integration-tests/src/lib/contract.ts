// The shared-canvas contract binding used by the deploy + method tests:
// witnesses, private state, the CompiledContract, and join/read helpers.
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import type { WitnessContext } from "@midnight-ntwrk/compact-runtime";
import { findDeployedContract, type FoundContract } from "@midnight-ntwrk/midnight-js/contracts";
import type { MidnightProviders, PublicDataProvider } from "@midnight-ntwrk/midnight-js/types";
import * as SharedCanvas from "@nyxels/contract-sdk";

import { config, resolveContractAddress, zkConfigPath } from "./config";
import { buildProviders } from "./providers";
import type { Wallet } from "./wallet";

// The provable circuits the tests call, used to type `callTx.<circuit>`.
export type SharedCanvasCircuit = "extendCanvas" | "updateSquare";

// A canvas coordinate as the generated bindings shape it.
export type Coordinate = { x: bigint; y: bigint };

// ---------------------------------------------------------------------------
// Witness wiring
// ---------------------------------------------------------------------------
// The contract declares `witness operatorSecretKey(): Bytes<32>;` — private
// data the circuits read but that never goes on chain (only the commitment
// `generateOwnerCommittment(sk, x, y, nonce)` stored in `Square.owner` does).
// We model the secret as the contract's private state.
export type SharedCanvasPrivateState = {
  readonly operatorSecretKey: Uint8Array;
};

// A fixed test identity. Keeping it constant means every test (and every run)
// acts as the same operator, so squares minted by one run can be updated by
// the next — required for the method tests to be independently runnable
// against a long-lived contract.
export const OPERATOR_SECRET_KEY: Uint8Array = Uint8Array.from(
  Buffer.from("4e7978656c73496e746567726174696f6e54657374734f70657261746f724b31", "hex"),
);

export const witnesses: SharedCanvas.Witnesses<SharedCanvasPrivateState> = {
  operatorSecretKey: ({
    privateState,
  }: WitnessContext<SharedCanvas.Ledger, SharedCanvasPrivateState>): [SharedCanvasPrivateState, Uint8Array] => [
    privateState,
    privateState.operatorSecretKey,
  ],
};

export const INITIAL_PRIVATE_STATE: SharedCanvasPrivateState = {
  operatorSecretKey: OPERATOR_SECRET_KEY,
};

// Key under which midnight-js persists this contract's private state locally.
export const PRIVATE_STATE_ID = "nyxelsSharedCanvas";

// ---------------------------------------------------------------------------
// The CompiledContract binding
// ---------------------------------------------------------------------------
// Three required pieces: the generated contract class under a label, our
// witness implementations, and the managed/ root the proving + verifier keys
// are read from. `.pipe` is safe ONLY on the `make` result (the combinators
// spread-rebuild and drop the prototype carrying it), so the whole chain is
// built in one expression.
export function buildCompiledContract() {
  return CompiledContract.make("shared-canvas", SharedCanvas.Contract).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );
}

// ---------------------------------------------------------------------------
// Reading public state
// ---------------------------------------------------------------------------
/** Fetch and decode the canvas's on-chain public state via the indexer. */
export async function readCanvas(
  publicDataProvider: PublicDataProvider,
  address: string,
): Promise<SharedCanvas.Ledger> {
  const state = await publicDataProvider.queryContractState(address);
  if (!state) {
    throw new Error(
      `No contract state found at ${address} — is CONTRACT_ADDRESS/.contract-address ` +
        "pointing at a shared-canvas deployment on this network?",
    );
  }
  return SharedCanvas.ledger(state.data);
}

/** The owner commitment our operator identity produces for a square. */
export function ownerCommitment(coordinate: Coordinate, nonce: bigint): Uint8Array {
  return SharedCanvas.pureCircuits.generateOwnerCommittment(
    OPERATOR_SECRET_KEY,
    coordinate.x,
    coordinate.y,
    nonce,
  );
}

// ---------------------------------------------------------------------------
// Joining the deployed contract
// ---------------------------------------------------------------------------
export interface JoinedSharedCanvas {
  readonly address: string;
  readonly providers: MidnightProviders<SharedCanvasCircuit>;
  readonly contract: FoundContract<SharedCanvas.Contract<SharedCanvasPrivateState>>;
}

/**
 * Resolve the deployed contract's address and join it: verifies the on-chain
 * verifier keys match our compiled artifacts and returns a handle whose
 * `callTx.<circuit>` methods build, prove and submit calls. Seeds/overwrites
 * the local private state with our fixed operator identity so ownership is
 * stable across tests and runs.
 */
export async function joinSharedCanvas(wallet: Wallet): Promise<JoinedSharedCanvas> {
  const address = resolveContractAddress();
  const providers = buildProviders<SharedCanvasCircuit>(wallet, zkConfigPath, config);
  const contract = await findDeployedContract(providers, {
    contractAddress: address,
    compiledContract: buildCompiledContract(),
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: INITIAL_PRIVATE_STATE,
  });
  return { address, providers, contract };
}
