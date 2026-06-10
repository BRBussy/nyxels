// Account test: the wallet built from SEED starts, syncs to the chain tip,
// and holds NIGHT and DUST — so the deploy + method tests can pay fees.
import { nativeToken } from "@midnight-ntwrk/ledger-v8";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { config, seed } from "../lib/config";
import { buildWallet, type Wallet } from "../lib/wallet";

// DUST generates over time from NIGHT holdings, so on a freshly started local
// chain the balance can be 0 for the first moments — poll briefly before
// declaring the account unfunded.
const DUST_WAIT_MS = 90_000;
const DUST_POLL_MS = 5_000;

describe("account", () => {
  let wallet: Wallet;

  beforeAll(async () => {
    wallet = await buildWallet(seed, config);
  });

  afterAll(async () => {
    await wallet?.stop();
  });

  it("derives addresses and syncs to the chain tip", async () => {
    expect(wallet.addresses.unshielded).toMatch(/^mn_/);
    expect(wallet.addresses.dust).toMatch(/^mn_/);
    await wallet.facade.waitForSyncedState();
  });

  it("holds NIGHT", async () => {
    const synced = await wallet.facade.waitForSyncedState();
    const night = synced.unshielded.balances[nativeToken().raw] ?? 0n;
    expect(
      night,
      `Account ${wallet.addresses.unshielded} (from SEED) holds no NIGHT on ${config.networkId}. ` +
        "On the local stack, use the pre-funded dev seed (the default) or fund this account first.",
    ).toBeGreaterThan(0n);
  });

  it("holds DUST (to pay fees)", async () => {
    const deadline = Date.now() + DUST_WAIT_MS;
    let dust = 0n;
    for (;;) {
      const synced = await wallet.facade.waitForSyncedState();
      dust = synced.dust.balance(new Date());
      if (dust > 0n || Date.now() > deadline) break;
      await new Promise((resolve) => setTimeout(resolve, DUST_POLL_MS));
    }
    expect(
      dust,
      `Account ${wallet.addresses.dust} has no DUST after waiting ${DUST_WAIT_MS / 1000}s. ` +
        "DUST generates from registered NIGHT — on the local stack the pre-funded dev seed " +
        "(the default) has it; otherwise register this account's NIGHT for dust generation.",
    ).toBeGreaterThan(0n);
  });
});
