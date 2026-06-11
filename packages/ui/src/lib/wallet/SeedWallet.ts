// SeedWallet — a {@link Wallet} backed by a seed held in-app.
//
// The seed→account construction utilities (key derivation, address encoding,
// facade wiring) come from @nyxels/lib, shared with the integration tests.
//
// Two construction paths:
//   1. `const w = new SeedWallet(seed, config); await w.initialise();`
//   2. `const w = await SeedWallet.Initialise(seed, config);`
//
// The constructor only records inputs (it is intentionally not async and does no
// work). Everything else — derive keys, build the facade, start it — happens in
// `initialise()`. Touching any other member before that throws.
import * as ledger from "@midnight-ntwrk/ledger-v8";
import { WalletFacade, type CombinedTokenTransfer } from "@midnight-ntwrk/wallet-sdk-facade";
import { MidnightBech32m, ShieldedAddress, UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import {
  deriveAccountKeys,
  deriveAddresses,
  initialiseWalletFacade,
  parseSeed,
  type AccountKeys,
} from "@nyxels/lib";
import type { NetworkId } from "@/lib/network";
import type { Config } from "@/contexts/ConfigContext";
import {
  TokenKind,
  WalletSource,
  type Wallet,
  type WalletAddresses,
  type WalletBalances,
  type TransferOutput,
} from "@/lib/wallet/Wallet";
import type { UnboundTransaction } from "@midnight-ntwrk/midnight-js/types";

const RECIPE_TTL_MS = 30 * 60 * 1000; // recipes expire 30 min out

/** A constructed account: the WalletFacade bundled with its key material. */
export type SeedWalletContext = AccountKeys & {
  wallet: WalletFacade;
};

/**
 * A wallet's default display name: the first 10 data characters of its
 * unshielded address. The bech32m human-readable part varies by network
 * (`mn_addr` on mainnet, `mn_addr_<networkId>` elsewhere), so split on the
 * final `1` separator — the data charset never contains it. Short, stable and
 * recognisable; the user can override it with a friendlier label.
 */
export function defaultSeedWalletName(unshieldedAddress: string): string {
  const separator = unshieldedAddress.lastIndexOf("1");
  const data = separator >= 0 ? unshieldedAddress.slice(separator + 1) : unshieldedAddress;
  return data.slice(0, 10);
}

// ── SeedWallet ──────────────────────────────────────────────────────────────

// What's known once keys are derived (before the facade has synced).
interface Identity {
  addresses: WalletAddresses;
  networkId: NetworkId;
}

export class SeedWallet implements Wallet {
  /** Build and start a SeedWallet in one call (does NOT wait for sync). */
  static async Initialise(seed: string, config: Config): Promise<SeedWallet> {
    const wallet = new SeedWallet(seed, config);
    await wallet.initialise();
    return wallet;
  }

  readonly source: WalletSource = WalletSource.Seed;

  private readonly seed: string;
  private readonly config: Config;
  private identity?: Identity;
  private ctx?: SeedWalletContext;
  private _seedHex?: string;
  private _name?: string;

  /**
   * @param seed    the BIP-39 mnemonic / hex seed
   * @param config  the connection config to derive addresses for and connect to
   *                (`config.networkId` is the network)
   *
   * The name starts as a default derived from the unshielded address (see
   * {@link defaultSeedWalletName}); assign {@link name} to relabel it.
   */
  constructor(seed: string, config: Config) {
    this.seed = seed;
    this.config = config;
  }

  /**
   * Balances a transaction
   * @param tx The transaction to balance.
   * @param ttl
   * 
   * NOTE: for MidnightProvider interface implementation.
   */
  balanceTx(tx: UnboundTransaction, ttl?: Date): Promise<ledger.FinalizedTransaction> {
    throw new Error("Method not implemented.");
  }

  getCoinPublicKey(): ledger.CoinPublicKey {
    throw new Error("Method not implemented.");
  }

  getEncryptionPublicKey(): ledger.EncPublicKey {
    throw new Error("Method not implemented.");
  }

  /**
   * Submit a transaction to the network to be consensed upon.
   * @param tx The finalized transaction to submit.
   * @returns The transaction identifier of the submitted transaction.
   * 
   * NOTE: for MidnightProvider interface implementation.
   */
  submitTx(tx: ledger.FinalizedTransaction): Promise<ledger.TransactionId> {
    throw new Error("Method not implemented.");
  }

  /**
   * Derive the account, construct the facade and start it. Resolves once the
   * facade is started (connections open, scanning begun) — it does NOT wait for
   * the chain tip. Callers that need a synced wallet await {@link facade}'s
   * `waitForSyncedState()` (or use {@link getBalances}, which does). Idempotent:
   * a second call is a no-op once started.
   */
  async initialise(): Promise<void> {
    if (this.ctx) return;

    const config = this.config;
    const networkId = config.networkId;

    const keys = deriveAccountKeys(this.seed, networkId);
    const facade = await initialiseWalletFacade(keys, config);
    this.identity = { addresses: deriveAddresses(keys, networkId), networkId };

    // Identity is derived; from here on, clean up the facade if start fails so a
    // half-started wallet never leaks its connections.
    try {
      await facade.start(keys.shieldedSecretKeys, keys.dustSecretKey);
    } catch (e) {
      await facade.stop().catch(() => {});
      throw e; // identity is kept so callers can still show the addresses
    }

    this.ctx = { wallet: facade, ...keys };
  }

  // Guard for members known after key derivation (the Construct phase).
  private requireIdentity(): Identity {
    if (!this.identity) {
      throw new Error("SeedWallet is not initialised — call initialise() (or use SeedWallet.Initialise) first.");
    }
    return this.identity;
  }

  /**
   * The underlying {@link SeedWalletContext} (facade + keys). The escape hatch
   * for seed-only capabilities the unified {@link Wallet} interface doesn't
   * cover — the live state stream, UTxO inspection, DUST registration. Throws
   * until online.
   */
  get context(): SeedWalletContext {
    if (!this.ctx) {
      throw new Error("SeedWallet is not started — call initialise() (or use SeedWallet.Initialise) first.");
    }
    return this.ctx;
  }

  /**
   * The underlying {@link WalletFacade}. Available once {@link initialise} has
   * resolved (started, not necessarily synced) — use it to subscribe to the live
   * `state()` stream and `waitForSyncedState()`. Throws until started.
   */
  get facade(): WalletFacade {
    return this.context.wallet;
  }

  /**
   * The normalised hex form of this wallet's seed (mnemonics become their
   * derived seed hex). Stable identifier for the seed itself — used as the
   * dedup key. Available immediately (no initialise required); memoised since
   * deriving it from a mnemonic runs pbkdf2.
   */
  get seedHex(): string {
    if (this._seedHex === undefined) this._seedHex = parseSeed(this.seed).source.seedHex;
    return this._seedHex;
  }

  get id(): string {
    return this.requireIdentity().addresses.unshielded;
  }

  /** User-facing label. Defaults to {@link defaultSeedWalletName} until set. */
  get name(): string {
    if (this._name) return this._name;
    return defaultSeedWalletName(this.requireIdentity().addresses.unshielded);
  }

  set name(value: string) {
    this._name = value.trim() || undefined;
  }

  get networkId(): NetworkId {
    return this.requireIdentity().networkId;
  }

  /** Synchronous address access for callers holding the concrete SeedWallet
   *  (available once the Construct phase has run). The async {@link getAddresses}
   *  satisfies the {@link Wallet} interface. */
  get addresses(): WalletAddresses {
    return this.requireIdentity().addresses;
  }

  async getAddresses(): Promise<WalletAddresses> {
    return this.requireIdentity().addresses;
  }

  async getBalances(): Promise<WalletBalances> {
    // Waits for the chain tip, so first call may take a while on a fresh wallet.
    const state = await this.context.wallet.waitForSyncedState();
    return {
      unshielded: state.unshielded.balances,
      shielded: state.shielded.balances,
      dust: state.dust.balance(new Date()),
    };
  }

  async transfer(outputs: TransferOutput[]): Promise<void> {
    const ctx = this.context;
    const { networkId } = this.requireIdentity();

    // Group by rail and parse each receiver into the rail's address type.
    const transfers: CombinedTokenTransfer[] = [];
    const unshielded = outputs.filter((o) => o.kind === TokenKind.Unshielded);
    const shielded = outputs.filter((o) => o.kind === TokenKind.Shielded);

    if (unshielded.length) {
      transfers.push({
        type: "unshielded",
        outputs: unshielded.map((o) => ({
          amount: o.amount,
          type: o.tokenType,
          receiverAddress: MidnightBech32m.parse(o.receiver).decode(UnshieldedAddress, networkId),
        })),
      });
    }
    if (shielded.length) {
      transfers.push({
        type: "shielded",
        outputs: shielded.map((o) => ({
          amount: o.amount,
          type: o.tokenType,
          receiverAddress: MidnightBech32m.parse(o.receiver).decode(ShieldedAddress, networkId),
        })),
      });
    }

    // Build → sign (unshielded inputs) → prove + balance → submit.
    const recipe = await ctx.wallet.transferTransaction(
      transfers,
      { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
      { ttl: new Date(Date.now() + RECIPE_TTL_MS) },
    );
    const signed = await ctx.wallet.signRecipe(recipe, (payload) => ctx.unshieldedKeystore.signData(payload));
    const finalized = await ctx.wallet.finalizeRecipe(signed);
    await ctx.wallet.submitTransaction(finalized);
  }

  async submitUnprovenTransaction(serializedTransaction: Uint8Array): Promise<void> {
    const ctx = this.context;

    // Deserialize back into the ledger UnprovenTransaction the facade balances.
    const tx = ledger.Transaction.deserialize<ledger.SignatureEnabled, ledger.PreProof, ledger.PreBinding>(
      "signature",
      "pre-proof",
      "pre-binding",
      serializedTransaction,
    );

    // Balance (add dust/fee inputs) → sign those inputs → finalize (prove) → submit.
    const recipe = await ctx.wallet.balanceUnprovenTransaction(
      tx,
      { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
      { ttl: new Date(Date.now() + RECIPE_TTL_MS) },
    );
    const signed = await ctx.wallet.signRecipe(recipe, (payload) => ctx.unshieldedKeystore.signData(payload));
    const finalized = await ctx.wallet.finalizeRecipe(signed);
    await ctx.wallet.submitTransaction(finalized);
  }
}
