// Builds a started, synced WalletFacade from a hex seed. Use it from a test to
// sign / balance / prove / submit transactions. The seed→account construction
// (key derivation, address encoding, facade wiring) comes from @nyxels/lib,
// shared with the UI's SeedWallet.
//
// The facade opens a WebSocket to the indexer for live state, so we install a
// global `WebSocket` (Node has no DOM one) before anything connects.
import { WebSocket } from "ws";
// @ts-expect-error -- assign the Node ws implementation as the global the SDK expects
globalThis.WebSocket = WebSocket;

import type { WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import {
  deriveAccountKeys,
  deriveAddresses,
  initialiseWalletFacade,
  type AccountKeys,
  type WalletAddresses,
} from "@nyxels/lib";

import type { Config } from "./config";

/** A started facade bundled with its keys and addresses. */
export interface Wallet {
  facade: WalletFacade;
  keys: AccountKeys;
  addresses: WalletAddresses;
  stop(): Promise<void>;
}

/**
 * Build the facade, start it, and wait for it to sync to the chain tip. Returns
 * the facade + keys + addresses, plus a `stop()` to release connections.
 */
export async function buildWallet(seed: string, config: Config): Promise<Wallet> {
  const keys = deriveAccountKeys(seed, config.networkId);
  const facade = await initialiseWalletFacade(keys, config);

  await facade.start(keys.shieldedSecretKeys, keys.dustSecretKey);
  await facade.waitForSyncedState();

  return {
    facade,
    keys,
    addresses: deriveAddresses(keys, config.networkId),
    stop: () => facade.stop(),
  };
}
