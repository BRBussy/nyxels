// The unified wallet abstraction the rest of the app codes against.
//
// Both a seed-derived wallet (SeedWallet, wrapping the wallet-sdk facade) and a
// connected browser wallet (BrowserWallet, wrapping the dapp-connector
// `ConnectedAPI`) implement this `Wallet` interface, so callers never branch on
// which kind they hold. Reads are async on purpose: it's the lowest common
// denominator between the two, since the browser connector API is pull-based
// with no live state stream (the seed facade's `Observable` has no equivalent
// there).
import type { NetworkId } from "@/lib/network";

/**
 * The kind of underlying wallet a {@link Wallet} abstracts over. Lets callers
 * label / branch on origin without re-introducing the concrete type they were
 * trying to hide. (Const object + union — see lib/network.ts.)
 */
export const WalletSource = {
  /** Derived from a seed and held in-app (the wallet-sdk facade). */
  Seed: "seed",
  /** A connected browser-extension wallet (dapp-connector `ConnectedAPI`). */
  BrowserWallet: "browserWallet",
} as const;
export type WalletSource = (typeof WalletSource)[keyof typeof WalletSource];

/**
 * Whether a token / transfer is on the shielded or unshielded rail. Both the
 * connector (`DesiredOutput.kind`) and the facade (transfer `type`) model this
 * as a bare string union with no exported constant set, so this app-local one
 * owns it. The values match those unions, so members map straight through.
 */
export const TokenKind = {
  Shielded: "shielded",
  Unshielded: "unshielded",
} as const;
export type TokenKind = (typeof TokenKind)[keyof typeof TokenKind];

/** A wallet's three Midnight addresses, as bech32m strings. */
export interface WalletAddresses {
  unshielded: string; // NIGHT receive address
  shielded: string;
  dust: string;
}

/**
 * A wallet's balances. The shielded / unshielded maps are keyed by raw token
 * type (e.g. `nativeToken().raw` for NIGHT); dust is a single, time-dependent
 * figure rather than a token map.
 */
export interface WalletBalances {
  unshielded: Record<string, bigint>;
  shielded: Record<string, bigint>;
  dust: bigint;
}

/** One output of a transfer: send `amount` of `tokenType` to `receiver`. */
export interface TransferOutput {
  kind: TokenKind; // which rail the token lives on
  tokenType: string; // raw token type
  amount: bigint; // smallest unit
  receiver: string; // bech32m receive address (matching `kind`)
}

/**
 * The unified wallet handle. See the file header for the rationale behind the
 * async, pull-based shape.
 */
export interface Wallet {
  /** Stable identifier — the unshielded address. */
  readonly id: string;
  /** User-facing label. */
  readonly name: string;
  /** Which kind of wallet this wraps. */
  readonly source: WalletSource;
  /** The network these addresses / balances belong to. */
  readonly networkId: NetworkId;

  /** Resolve the wallet's three addresses. */
  getAddresses(): Promise<WalletAddresses>;
  /** Read the current shielded / unshielded / dust balances. */
  getBalances(): Promise<WalletBalances>;
  /**
   * Build, sign and submit a transfer. Resolves once submitted. No transaction
   * id is returned: the browser connector's `submitTransaction` yields `void`,
   * so that's the honest common denominator.
   */
  transfer(outputs: TransferOutput[]): Promise<void>;

  /**
   * Balance, sign and submit an externally-built **unproven** transaction —
   * e.g. a contract-call transaction built by midnight-js. `serializedTransaction`
   * is a `ledger` `UnprovenTransaction` in serialized (bytes) form. Resolves
   * once submitted.
   *
   * v1 scope: implemented for seed wallets only; browser wallets throw until
   * the connector proving path is wired up.
   */
  submitUnprovenTransaction(serializedTransaction: Uint8Array): Promise<void>;
}
