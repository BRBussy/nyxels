// Builds a started, synced WalletFacade from a hex seed. Use it from a test to
// sign / balance / prove / submit transactions.
//
// The facade opens a WebSocket to the indexer for live state, so we install a
// global `WebSocket` (Node has no DOM one) before anything connects.
import { WebSocket } from "ws";
// @ts-expect-error -- assign the Node ws implementation as the global the SDK expects
globalThis.WebSocket = WebSocket;

import * as ledger from "@midnight-ntwrk/ledger-v8";
import { HDWallet, Roles } from "@midnight-ntwrk/wallet-sdk-hd";
import {
  mergeWalletEntries,
  WalletEntrySchema,
  WalletFacade,
} from "@midnight-ntwrk/wallet-sdk-facade";
import { ShieldedWallet } from "@midnight-ntwrk/wallet-sdk-shielded";
import { DustWallet } from "@midnight-ntwrk/wallet-sdk-dust-wallet";
import {
  createKeystore,
  PublicKey as UnshieldedPublicKey,
  type UnshieldedKeystore,
  UnshieldedWallet,
} from "@midnight-ntwrk/wallet-sdk-unshielded-wallet";
import { InMemoryTransactionHistoryStorage } from "@midnight-ntwrk/wallet-sdk-abstractions";
import {
  DustAddress,
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from "@midnight-ntwrk/wallet-sdk-address-format";

import type { Config } from "./config";

/** Live key material for the account — reused for signing / balancing. */
export interface AccountKeys {
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: UnshieldedKeystore;
}

export interface WalletAddresses {
  unshielded: string;
  shielded: string;
  dust: string;
}

/** A started facade bundled with its keys and addresses. */
export interface Wallet {
  facade: WalletFacade;
  keys: AccountKeys;
  addresses: WalletAddresses;
  stop(): Promise<void>;
}

/** Normalise a 64-char hex seed (with or without 0x) into 32 bytes. */
function seedBytes(seed: string): Uint8Array {
  const hex = seed.startsWith("0x") ? seed.slice(2) : seed;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("SEED must be 64 hex chars");
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

function deriveAccountKeys(seed: string, networkId: string): AccountKeys {
  const hd = HDWallet.fromSeed(seedBytes(seed));
  if (hd.type !== "seedOk") throw new Error("HDWallet.fromSeed failed");
  const derived = hd.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (derived.type !== "keysDerived") throw new Error("deriveKeysAt failed");
  hd.hdWallet.clear();

  return {
    shieldedSecretKeys: ledger.ZswapSecretKeys.fromSeed(derived.keys[Roles.Zswap]),
    dustSecretKey: ledger.DustSecretKey.fromSeed(derived.keys[Roles.Dust]),
    unshieldedKeystore: createKeystore(derived.keys[Roles.NightExternal], networkId),
  };
}

function deriveAddresses(keys: AccountKeys, networkId: string): WalletAddresses {
  const shielded = new ShieldedAddress(
    ShieldedCoinPublicKey.fromHexString(keys.shieldedSecretKeys.coinPublicKey),
    ShieldedEncryptionPublicKey.fromHexString(keys.shieldedSecretKeys.encryptionPublicKey),
  );
  return {
    unshielded: keys.unshieldedKeystore.getBech32Address().asString(),
    shielded: MidnightBech32m.encode(networkId, shielded).asString(),
    dust: DustAddress.encodePublicKey(networkId, keys.dustSecretKey.publicKey),
  };
}

/**
 * Build the facade, start it, and wait for it to sync to the chain tip. Returns
 * the facade + keys + addresses, plus a `stop()` to release connections.
 */
export async function buildWallet(seed: string, config: Config): Promise<Wallet> {
  const keys = deriveAccountKeys(seed, config.networkId);
  const facade = await WalletFacade.init({
    configuration: {
      networkId: config.networkId,
      indexerClientConnection: {
        indexerHttpUrl: config.indexerUrl,
        indexerWsUrl: config.indexerWsUrl,
      },
      provingServerUrl: new URL(config.proofServerUrl),
      relayURL: new URL(config.nodeUrl.replace(/^http/, "ws")),
      costParameters: { additionalFeeOverhead: 300_000_000_000n, feeBlocksMargin: 5 },
      txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
    },
    shielded: (cfg) => ShieldedWallet(cfg).startWithSecretKeys(keys.shieldedSecretKeys),
    unshielded: (cfg) =>
      UnshieldedWallet(cfg).startWithPublicKey(UnshieldedPublicKey.fromKeyStore(keys.unshieldedKeystore)),
    dust: (cfg) =>
      DustWallet(cfg).startWithSecretKey(keys.dustSecretKey, ledger.LedgerParameters.initialParameters().dust),
  });

  await facade.start(keys.shieldedSecretKeys, keys.dustSecretKey);
  await facade.waitForSyncedState();

  return {
    facade,
    keys,
    addresses: deriveAddresses(keys, config.networkId),
    stop: () => facade.stop(),
  };
}
