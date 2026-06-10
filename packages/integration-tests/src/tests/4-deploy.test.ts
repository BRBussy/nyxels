// Deploy test: deploys the compiled shared-canvas contract from
// @nyxels/contract-sdk and persists the address for the method tests.
//
// Witness bodies never execute in the contract constructor, so the witness
// implementation attached here is irrelevant to the deploy itself — we attach
// the same fixed operator identity the method tests use, purely so the stored
// private state is consistent everywhere.
import { deployContract } from "@midnight-ntwrk/midnight-js/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { config, persistContractAddress, seed, zkConfigPath } from "../lib/config";
import {
  buildCompiledContract,
  INITIAL_PRIVATE_STATE,
  PRIVATE_STATE_ID,
  readCanvas,
  type SharedCanvasCircuit,
} from "../lib/contract";
import { buildProviders } from "../lib/providers";
import { buildWallet, type Wallet } from "../lib/wallet";

describe("deploy", () => {
  let wallet: Wallet;

  beforeAll(async () => {
    wallet = await buildWallet(seed, config);
  });

  afterAll(async () => {
    await wallet?.stop();
  });

  it("deploys the shared-canvas contract and persists its address", async () => {
    const providers = buildProviders<SharedCanvasCircuit>(wallet, zkConfigPath, config);

    const deployed = await deployContract(providers, {
      compiledContract: buildCompiledContract(),
      privateStateId: PRIVATE_STATE_ID,
      initialPrivateState: INITIAL_PRIVATE_STATE,
    });

    const address = deployed.deployTxData.public.contractAddress;
    expect(address).toBeTruthy();
    console.log(`deployed shared-canvas at ${address} (tx ${deployed.deployTxData.public.txId})`);

    // Genesis state: empty canvas, cursor at the origin.
    const canvas = await readCanvas(providers.publicDataProvider, address);
    expect([canvas.depth, canvas.nextX, canvas.nextY]).toEqual([0n, 0n, 0n]);
    expect(canvas.canvasIdx.isEmpty()).toBe(true);

    // Hand the address to the method tests (and later runs).
    persistContractAddress(address);
  });
});
