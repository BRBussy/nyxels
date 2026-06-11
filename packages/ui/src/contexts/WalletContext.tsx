import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { parseSeed } from "@nyxels/lib";
import { WalletSource, type Wallet } from "@/lib/wallet/Wallet";
import { SeedWallet } from "@/lib/wallet/SeedWallet";
import { BrowserWallet } from "@/lib/wallet/BrowserWallet";
import {
  addStoredSeedWallet,
  loadStoredSeedWallets,
  removeStoredSeedWallet,
  renameStoredSeedWallet,
} from "@/lib/wallet/seedWalletStore";
import {
  loadSelectedWalletRef,
  saveSelectedWalletRef,
  type SelectedWalletRef,
} from "@/lib/wallet/selectedWalletStore";
import { useConfig } from "@/contexts/ConfigContext";

interface WalletContextValue {
  // ── Reactive collections (components re-render on change) ──
  /** Seed wallets in insertion order, typed as the concrete class. */
  seedWallets: SeedWallet[];
  /** The connected browser wallet, or null when none is connected. */
  browserWallet: BrowserWallet | null;
  /**
   * Every wallet behind the unified interface, for callers that must not care
   * which kind they hold.
   */
  wallets: Wallet[];

  // ── Selection ──
  /**
   * The wallet the app currently acts as, or null when none is selected. Always
   * one of {@link wallets}; deselects automatically when the wallet is removed
   * or disconnects. Selecting a seed wallet does NOT disconnect the browser
   * wallet (selection is a pointer, not a connection).
   */
  selectedWallet: Wallet | null;
  /** Select `wallet` (or null to deselect). Persisted across reloads. */
  selectWallet: (wallet: Wallet | null) => void;

  // ── Seed wallet actions ──
  /**
   * Get — or lazily create, start and store — the seed wallet for `seed`.
   * Dedupes on the normalised hex seed: an already-loaded seed returns its
   * existing instance. Resolves once the wallet is started (addresses + name
   * available) — NOT once synced; the caller awaits the wallet's
   * {@link SeedWallet.facade} `waitForSyncedState()` if it needs the chain tip.
   * Rejects if the seed is unparseable or start fails.
   */
  getSeedWallet: (seed: string) => Promise<SeedWallet>;
  /** Rename a seed wallet by its unshielded address (mn_addr…). */
  setSeedWalletName: (mnAddr: string, name: string) => void;
  /** Stop and forget a seed wallet by its unshielded address (mn_addr…). */
  removeSeedWallet: (mnAddr: string) => void;

  // ── Browser wallet actions ──
  /**
   * Connect the injected browser wallet found under `walletKey` (an opaque
   * `window.midnight` key from {@link BrowserWallet.available}), store it and
   * return it (so the caller can e.g. select it). Rejects if the user declines
   * the prompt or the wallet errors.
   */
  connectBrowserWallet: (walletKey: string) => Promise<BrowserWallet>;
  /** Forget the connected browser wallet (deselects it if selected). */
  disconnectBrowserWallet: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * The single source of truth for wallets loaded into the app. Mount once high
 * in the tree (inside ConfigContextProvider) so the set survives navigation.
 *
 * The live facades / connector APIs can't be serialised, so they're in-memory
 * only. Seed wallets are nonetheless durable across reloads: their seeds (and
 * any custom name) are persisted to localStorage via {@link seedWalletStore}
 * and re-derived on mount. Browser wallets aren't persisted — reconnecting is
 * the user's call. Which wallet is selected is persisted separately (a stable
 * reference, see {@link selectedWalletStore}); a selected browser wallet only
 * resolves again once reconnected. The context owns the wallet lifecycle
 * (create → store → stop); components subscribe to live state for rendering.
 */
export function WalletContextProvider({ children }: { children: ReactNode }) {
  const { config } = useConfig();

  const [seedWallets, setSeedWallets] = useState<SeedWallet[]>([]);
  const [browserWallet, setBrowserWallet] = useState<BrowserWallet | null>(null);
  // Selection as a reload-stable reference; the live wallet is derived below.
  const [selectedRef, setSelectedRef] = useState<SelectedWalletRef | null>(loadSelectedWalletRef);

  // Mirror of `seedWallets` for the stable action callbacks below (so they don't
  // need the array as a dependency and stay referentially stable across loads).
  // Synced from render via an effect; getSeedWallet also nudges it synchronously
  // on insert so a same-seed follow-up call dedupes against the just-added wallet
  // (before the effect has re-synced).
  const seedWalletsRef = useRef<SeedWallet[]>([]);
  useEffect(() => {
    seedWalletsRef.current = seedWallets;
  }, [seedWallets]);

  // In-flight bring-ups keyed by hex seed, so concurrent / StrictMode-double
  // calls for the same seed share one initialise instead of racing two facades.
  const inFlightRef = useRef<Map<string, Promise<SeedWallet>>>(new Map());

  const getSeedWallet = useCallback(
    (seed: string): Promise<SeedWallet> => {
      // Normalise to hex (throws ParseError on bad input — propagated to caller).
      const seedHex = parseSeed(seed).source.seedHex;

      // Persist first (dedups on the normalised seed) so the seed survives a
      // reload even if bring-up below is still in flight when the page closes.
      addStoredSeedWallet(seed);

      const existing = seedWalletsRef.current.find((w) => w.seedHex === seedHex);
      if (existing) return Promise.resolve(existing);

      const pending = inFlightRef.current.get(seedHex);
      if (pending) return pending;

      const wallet = new SeedWallet(seed, config);
      const promise = wallet
        .initialise()
        .then(() => {
          setSeedWallets((prev) => (prev.some((w) => w.seedHex === seedHex) ? prev : [...prev, wallet]));
          // Keep the ref current immediately (the effect-sync lags a render), so a
          // same-seed call between now and the next render still dedupes.
          if (!seedWalletsRef.current.some((w) => w.seedHex === seedHex)) {
            seedWalletsRef.current = [...seedWalletsRef.current, wallet];
          }
          return wallet;
        })
        .finally(() => {
          inFlightRef.current.delete(seedHex);
        });

      inFlightRef.current.set(seedHex, promise);
      return promise;
    },
    [config],
  );

  const setSeedWalletName = useCallback((mnAddr: string, name: string) => {
    const found = seedWalletsRef.current.find((w) => w.id === mnAddr);
    if (!found || name.trim() === found.name) return;
    found.name = name;
    // Persist the new label so it's restored on the next mount.
    renameStoredSeedWallet(found.seedHex, name);
    // Name lives on the instance; nudge a new array reference so consumers
    // re-render with the updated label.
    setSeedWallets((prev) => [...prev]);
  }, []);

  const removeSeedWallet = useCallback((mnAddr: string) => {
    const found = seedWalletsRef.current.find((w) => w.id === mnAddr);
    if (!found) return;
    // Forget it from storage so it doesn't come back on the next mount.
    removeStoredSeedWallet(found.seedHex);
    // Release the facade's connections before dropping it from the set.
    found.context.wallet.stop().catch(() => {});
    setSeedWallets((prev) => prev.filter((w) => w !== found));
  }, []);

  // Re-derive persisted seed wallets once on mount. getSeedWallet handles
  // dedup + re-storing; we then apply any custom name that was saved. A bring-up
  // that fails (e.g. transient network) is left in storage to retry next mount.
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    for (const entry of loadStoredSeedWallets()) {
      getSeedWallet(entry.seed)
        .then((wallet) => {
          if (entry.name) setSeedWalletName(wallet.id, entry.name);
        })
        .catch(() => {});
    }
  }, [getSeedWallet, setSeedWalletName]);

  const connectBrowserWallet = useCallback(
    async (walletKey: string) => {
      const wallet = await BrowserWallet.Connect(config, walletKey);
      setBrowserWallet(wallet);
      return wallet;
    },
    [config],
  );

  const disconnectBrowserWallet = useCallback(() => {
    setBrowserWallet(null);
  }, []);

  const selectWallet = useCallback((wallet: Wallet | null) => {
    const ref: SelectedWalletRef | null =
      wallet === null
        ? null
        : wallet.source === WalletSource.Seed
          ? { source: WalletSource.Seed, seedHex: (wallet as SeedWallet).seedHex }
          : { source: WalletSource.BrowserWallet };
    setSelectedRef(ref);
    saveSelectedWalletRef(ref);
  }, []);

  // Resolve the stable reference to the live instance. A reference to a wallet
  // that isn't (yet) loaded resolves to null — and resolves again by itself the
  // moment the wallet comes online (restore finishing, extension reconnecting).
  const selectedWallet = useMemo<Wallet | null>(() => {
    if (!selectedRef) return null;
    if (selectedRef.source === WalletSource.Seed) {
      return seedWallets.find((w) => w.seedHex === selectedRef.seedHex) ?? null;
    }
    return browserWallet;
  }, [selectedRef, seedWallets, browserWallet]);

  const wallets = useMemo<Wallet[]>(
    () => [...seedWallets, ...(browserWallet ? [browserWallet] : [])],
    [seedWallets, browserWallet],
  );

  const value = useMemo<WalletContextValue>(
    () => ({
      seedWallets,
      browserWallet,
      wallets,
      selectedWallet,
      selectWallet,
      getSeedWallet,
      setSeedWalletName,
      removeSeedWallet,
      connectBrowserWallet,
      disconnectBrowserWallet,
    }),
    [
      seedWallets,
      browserWallet,
      wallets,
      selectedWallet,
      selectWallet,
      getSeedWallet,
      setSeedWalletName,
      removeSeedWallet,
      connectBrowserWallet,
      disconnectBrowserWallet,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Access the loaded wallets. Throws if used outside a WalletContextProvider. */
export function useWallets(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallets must be used within a WalletContextProvider");
  return ctx;
}
