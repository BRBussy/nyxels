// BrowserWallet — a {@link Wallet} backed by a connected browser-extension wallet
// (e.g. Lace Midnight), via the dapp-connector API injected at `window.midnight`.
//
// Importing `@midnight-ntwrk/dapp-connector-api` also pulls in its global
// augmentation, so `window.midnight?.<key>` is typed as `InitialAPI`.
//
// Discovery, NOT a fixed key. Wallets inject their `InitialAPI` under an opaque,
// per-install key — Lace 4.x uses a random UUID (e.g.
// `window.midnight["36e95c3a-…"]`), compatible with the CAIP-372 draft — so there
// is no stable string to hardcode. {@link BrowserWallet.available} enumerates the
// injected wallets; the caller picks one and passes its `walletKey` to connect.
//
// Same two-path lifecycle as SeedWallet:
//   1. `const w = new BrowserWallet(config, key); await w.connect();`
//   2. `const w = await BrowserWallet.Connect(config, key);`
//
// The constructor only records which injected wallet to use; the actual
// connection (and the identity/config reads it needs) happen in `connect()`.
// Touching any other member before that throws.
//
// The connector is pull-based: there is no live state stream (unlike the seed
// facade's `Observable`), so balances / history / connection status are read on
// demand via the `get…` methods below.
import type {
  ConnectedAPI,
  Configuration,
  ConnectionStatus,
  DesiredOutput,
  HistoryEntry,
} from "@midnight-ntwrk/dapp-connector-api";

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

// TokenKind is app-owned, so map explicitly to the connector's bare
// string-union `kind` rather than relying on assignability.
const KIND_TO_DESIRED: Record<TokenKind, DesiredOutput["kind"]> = {
  [TokenKind.Shielded]: "shielded",
  [TokenKind.Unshielded]: "unshielded",
};

/**
 * The injected wallet's self-description, taken from its `InitialAPI`. Display
 * the `name`/`icon` defensively (text node / `img` tag) — they come from the
 * extension. See the dapp-connector docs.
 */
export interface BrowserWalletInfo {
  walletKey: string; // which `window.midnight.<key>` this wallet was found under
  rdns: string; // reverse-DNS id, e.g. "network.midnight.wallet.lace"
  name: string; // human-facing wallet name
  icon: string; // URL or data: URL
  apiVersion: string; // dapp-connector-api version the extension implements
}

/**
 * The shielded address plus the two public keys the connector returns alongside
 * it. Kept distinct from the interface's flat {@link WalletAddresses} so the
 * extra material can be surfaced without bloating the unified shape.
 */
export interface ShieldedAddressDetail {
  address: string;
  coinPublicKey: string;
  encryptionPublicKey: string;
}

/** A one-shot read of everything live the connector exposes about the account. */
export interface BrowserWalletSnapshot {
  balances: WalletBalances; // interface-shaped (dust = current balance)
  dustCap: bigint; // the cap dropped by the flattened WalletBalances
  connectionStatus: ConnectionStatus;
}

// Everything that only exists once connected.
interface Connected {
  api: ConnectedAPI;
  info: BrowserWalletInfo;
  configuration: Configuration;
  networkId: NetworkId;
  addresses: WalletAddresses;
  shielded: ShieldedAddressDetail;
}

export class BrowserWallet implements Wallet {
  readonly source: WalletSource = WalletSource.BrowserWallet;

  private readonly config: Config;
  private readonly walletKey: string;
  private connected?: Connected;
  // In-flight connect, so concurrent / StrictMode-double calls share one prompt
  // instead of racing two `injected.connect()` calls.
  private connecting?: Promise<void>;

  /**
   * @param config     app config; `config.networkId` is passed to the wallet as
   *                   the desired-network hint on connect
   * @param walletKey  the `window.midnight` key of the injected wallet to use —
   *                   an opaque per-install id, obtained from {@link available}
   *                   (never hardcoded; see the file header)
   */
  constructor(config: Config, walletKey: string) {
    this.config = config;
    this.walletKey = walletKey;
  }

  /** Connect to the injected wallet identified by `walletKey` in one call. */
  static async Connect(config: Config, walletKey: string): Promise<BrowserWallet> {
    const wallet = new BrowserWallet(config, walletKey);
    await wallet.connect();
    return wallet;
  }

  /**
   * Enumerate the wallets currently injected under `window.midnight`, each with
   * the key needed to {@link Connect} it. Empty when no extension is installed /
   * enabled. A single extension may inject more than one entry (e.g. multiple
   * API versions), so callers should let the user pick when more than one is
   * returned.
   */
  static available(): BrowserWalletInfo[] {
    if (typeof window === "undefined" || !window.midnight) return [];
    return Object.entries(window.midnight).map(([walletKey, api]) => ({
      walletKey,
      rdns: api.rdns,
      name: api.name,
      icon: api.icon,
      apiVersion: api.apiVersion,
    }));
  }

  /**
   * Connect to the injected wallet and cache its identity + config. Idempotent:
   * a second call is a no-op once connected, and concurrent calls share the one
   * in-flight connection. The connector rejects with a dapp-connector `APIError`
   * (`code: 'Rejected'`) if the user declines the prompt — propagated to the
   * caller, which decides how to surface a cancellation.
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.connecting) return this.connecting;

    this.connecting = this.performConnect().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private async performConnect(): Promise<void> {
    const injected = typeof window !== "undefined" ? window.midnight?.[this.walletKey] : undefined;
    if (!injected) {
      throw new Error(
        `No Midnight wallet found at window.midnight.${this.walletKey} — is the extension installed and enabled?`,
      );
    }

    const api = await injected.connect(this.config.networkId);
    const [configuration, unshielded, shielded, dust] = await Promise.all([
      api.getConfiguration(),
      api.getUnshieldedAddress(),
      api.getShieldedAddresses(),
      api.getDustAddress(),
    ]);

    this.connected = {
      api,
      info: {
        walletKey: this.walletKey,
        rdns: injected.rdns,
        name: injected.name,
        icon: injected.icon,
        apiVersion: injected.apiVersion,
      },
      configuration,
      networkId: configuration.networkId,
      addresses: {
        unshielded: unshielded.unshieldedAddress,
        shielded: shielded.shieldedAddress,
        dust: dust.dustAddress,
      },
      shielded: {
        address: shielded.shieldedAddress,
        coinPublicKey: shielded.shieldedCoinPublicKey,
        encryptionPublicKey: shielded.shieldedEncryptionPublicKey,
      },
    };
  }

  /** Guard for members that require {@link connect} to have completed. */
  private requireConnected(): Connected {
    if (!this.connected) {
      throw new Error("BrowserWallet is not connected — call connect() (or use BrowserWallet.Connect) first.");
    }
    return this.connected;
  }

  get id(): string {
    return this.requireConnected().addresses.unshielded;
  }

  get name(): string {
    return this.requireConnected().info.name;
  }

  get networkId(): NetworkId {
    return this.requireConnected().networkId;
  }

  /** The injected wallet's self-description (key, rdns, name, icon, version). */
  get info(): BrowserWalletInfo {
    return this.requireConnected().info;
  }

  /** The services config the wallet reported on connect (indexer, node, …). */
  get configuration(): Configuration {
    return this.requireConnected().configuration;
  }

  /** The shielded address plus its coin / encryption public keys. */
  get shieldedDetail(): ShieldedAddressDetail {
    return this.requireConnected().shielded;
  }

  /** Synchronous address access for callers holding the concrete BrowserWallet
   *  (available once connected). The async {@link getAddresses} satisfies the
   *  {@link Wallet} interface. */
  get addresses(): WalletAddresses {
    return this.requireConnected().addresses;
  }

  async getAddresses(): Promise<WalletAddresses> {
    return this.requireConnected().addresses;
  }

  async getBalances(): Promise<WalletBalances> {
    const { api } = this.requireConnected();
    const [unshielded, shielded, dust] = await Promise.all([
      api.getUnshieldedBalances(),
      api.getShieldedBalances(),
      api.getDustBalance(),
    ]);
    return { unshielded, shielded, dust: dust.balance };
  }

  /**
   * One parallel read of all the live account state the connector exposes:
   * balances (with the dust cap the flat {@link WalletBalances} drops) and the
   * current connection status. Transaction history is paged, so it has its own
   * {@link getTxHistory} call rather than being baked in here.
   */
  async getSnapshot(): Promise<BrowserWalletSnapshot> {
    const { api } = this.requireConnected();
    const [unshielded, shielded, dust, connectionStatus] = await Promise.all([
      api.getUnshieldedBalances(),
      api.getShieldedBalances(),
      api.getDustBalance(),
      api.getConnectionStatus(),
    ]);
    return {
      balances: { unshielded, shielded, dust: dust.balance },
      dustCap: dust.cap,
      connectionStatus,
    };
  }

  /** A page of the wallet's transaction history (0-indexed page number). */
  async getTxHistory(pageNumber: number, pageSize: number): Promise<HistoryEntry[]> {
    return this.requireConnected().api.getTxHistory(pageNumber, pageSize);
  }

  async transfer(outputs: TransferOutput[]): Promise<void> {
    const { api } = this.requireConnected();
    const desired: DesiredOutput[] = outputs.map((o) => ({
      kind: KIND_TO_DESIRED[o.kind],
      type: o.tokenType,
      value: o.amount,
      recipient: o.receiver,
    }));
    // The wallet builds, balances, proves and signs; we relay the result back.
    const { tx } = await api.makeTransfer(desired);
    await api.submitTransaction(tx);
  }

  async submitUnprovenTransaction(): Promise<void> {
    // Submitting via the dapp-connector requires balancing + delegated proving
    // (getProvingProvider + a KeyMaterialProvider) which v1 does not wire up yet.
    throw new Error("Submitting an unproven transaction via a browser wallet is not yet supported — use a seed wallet.");
  }
}
