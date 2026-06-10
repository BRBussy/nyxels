// Method test: extendCanvas. Mints the square at the current cursor and
// advances the cursor along the L-shell walk.
//
// Self-contained and order-independent: it joins the contract itself and
// asserts on the delta it causes from whatever state previous runs left —
// never on absolute values only a fresh deployment would have.
import * as SharedCanvas from "@nyxels/contract-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { config, resolveContractAddress, seed } from "../../lib/config";
import { joinSharedCanvas, ownerCommitment, readCanvas, type JoinedSharedCanvas } from "../../lib/contract";
import { buildWallet, type Wallet } from "../../lib/wallet";

describe("extendCanvas", () => {
  let wallet: Wallet;
  let joined: JoinedSharedCanvas;

  beforeAll(async () => {
    // Resolve the address before the (slow) wallet build so a missing
    // CONTRACT_ADDRESS/.contract-address fails immediately with instructions.
    resolveContractAddress();
    wallet = await buildWallet(seed, config);
    joined = await joinSharedCanvas(wallet);
  });

  afterAll(async () => {
    await wallet?.stop();
  });

  it("mints the square at the cursor and advances the cursor", async () => {
    const { contract, providers, address } = joined;

    const before = await readCanvas(providers.publicDataProvider, address);
    const cursor = { x: before.nextX, y: before.nextY };
    expect(
      before.canvasIdx.member(cursor),
      "the cursor coordinate is already minted — the contract should never be in this state",
    ).toBe(false);

    const result = await contract.callTx.extendCanvas();
    console.log(`extendCanvas txId: ${result.public.txId}  block: ${result.public.blockHeight}`);

    // The circuit returns the coordinate it minted — the cursor we read.
    const [minted] = result.private.result;
    expect(minted).toEqual(cursor);

    const after = await readCanvas(providers.publicDataProvider, address);

    // The new square exists, owned by our operator identity at nonce 0, blank.
    expect(after.canvasIdx.member(cursor)).toBe(true);
    const square = after.canvasIdx.lookup(cursor);
    expect(square.nonce).toBe(0n);
    expect(square.owner).toEqual(ownerCommitment(cursor, 0n));
    expect(square.strokeData.length).toBe(0);

    // The cursor advanced exactly as the pure circuit prescribes.
    const [expectedDepth, expectedX, expectedY] = SharedCanvas.pureCircuits.incrementCoordinate(
      before.depth,
      before.nextX,
      before.nextY,
    );
    expect([after.depth, after.nextX, after.nextY]).toEqual([expectedDepth, expectedX, expectedY]);

    // Exactly one square was added.
    expect(after.canvasIdx.size()).toBe(before.canvasIdx.size() + 1n);
  });
});
