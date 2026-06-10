// Method test: updateSquare. Writes stroke data to a square our operator
// identity owns, bumping its nonce and rolling its owner commitment forward.
//
// Self-contained and order-independent: if the canvas holds no square owned by
// the test operator yet (fresh deployment, or extended by someone else), it
// mints one itself via extendCanvas first.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { config, resolveContractAddress, seed } from "../../lib/config";
import {
  joinSharedCanvas,
  ownerCommitment,
  readCanvas,
  type Coordinate,
  type JoinedSharedCanvas,
} from "../../lib/contract";
import { buildWallet, type Wallet } from "../../lib/wallet";

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

describe("updateSquare", () => {
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

  it("stores stroke data and rolls the owner commitment to the next nonce", async () => {
    const { contract, providers, address } = joined;

    // Find a square our operator identity owns; mint one if there is none yet.
    const canvas = await readCanvas(providers.publicDataProvider, address);
    let coordinate: Coordinate | undefined;
    for (const [coord, square] of canvas.canvasIdx) {
      if (bytesEqual(square.owner, ownerCommitment(coord, square.nonce))) {
        coordinate = coord;
        break;
      }
    }
    if (!coordinate) {
      console.log("no square owned by the test operator yet — minting one via extendCanvas…");
      const minted = await contract.callTx.extendCanvas();
      [coordinate] = minted.private.result;
    }

    const before = (await readCanvas(providers.publicDataProvider, address)).canvasIdx.lookup(coordinate);
    const strokeData = new TextEncoder().encode(`nyxels integration test stroke @ ${new Date().toISOString()}`);
    expect(bytesEqual(strokeData, before.strokeData)).toBe(false);

    const result = await contract.callTx.updateSquare(coordinate, strokeData);
    console.log(`updateSquare txId: ${result.public.txId}  block: ${result.public.blockHeight}`);

    const after = (await readCanvas(providers.publicDataProvider, address)).canvasIdx.lookup(coordinate);
    expect(after.strokeData).toEqual(strokeData);
    expect(after.nonce).toBe(before.nonce + 1n);
    expect(after.owner).toEqual(ownerCommitment(coordinate, before.nonce + 1n));
  });
});
