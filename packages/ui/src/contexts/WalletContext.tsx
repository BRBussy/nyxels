import type {
    ConnectedAPI,
    InitialAPI,
} from "@midnight-ntwrk/dapp-connector-api";
import { useConfig } from "./ConfigContext";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/** Bech32m addresses for each of the wallet's three asset classes. */
export type WalletAddresses = {
    unshielded: string;
    shielded: string;
    dust: string;
}

/**
 * Wallet balances. Shielded/unshielded are keyed by token type (a token may not
 * be present in the record at all, meaning a zero balance); dust is a single value.
 */
export type WalletBalances = {
    unshielded: Record<string, bigint>;
    shielded: Record<string, bigint>;
    dust: bigint;
}

interface WalletContextValue {
    /** Connect to the injected Midnight wallet on the currently-selected network. Rejects on failure. */
    connectWallet: () => Promise<void>;
    /** The connected wallet API, or null when no wallet is connected. */
    connectedWalletAPI: ConnectedAPI | null;
    addresses: WalletAddresses | null;
    balances: WalletBalances | null;
    /** Trigger a refetch of balances for the connected wallet. No-op if disconnected. */
    reloadBalances: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * Provides access to a connected Midnight browser wallet (e.g. Lace) and keeps
 * its addresses/balances in sync with the network selected in {@link useConfig}.
 *
 * The wallet's network must match the app's selected network: if they ever
 * diverge (the user switches networks in the wallet, or in the app while
 * connected) the connection is dropped so the UI can prompt a fresh connect.
 */
export function WalletContextProvider({ children }: { children: ReactNode }) {
    const { networkId } = useConfig();
    const [connectedWalletAPI, setConnectedWalletAPI] = useState<ConnectedAPI | null>(null);
    const [_addresses, _setAddresses] = useState<WalletAddresses | null>(null);
    const [_balances, _setBalances] = useState<WalletBalances | null>(null);

    // Bumped to force a balance refetch (see reloadBalances). The value itself is
    // meaningless — only its change matters as an effect dependency.
    const [balanceReloadToggle, setBalanceReloadToggle] = useState(false);

    // Guards connectWallet against re-entrancy: state updates are async, so the
    // `connectedWalletAPI` check alone can't stop two rapid calls both connecting.
    const connectingRef = useRef(false);

    // Only depends on stable state setters, so it never needs to be recreated.
    const resetState = useCallback(() => {
        setConnectedWalletAPI(null);
        _setAddresses(null);
        _setBalances(null);
    }, []);

    // Keep the wallet's network aligned with the app's. If they differ, drop the
    // connection. Errors are logged rather than thrown — throwing inside this
    // async block would only surface as an unhandled rejection.
    useEffect(() => {
        if (!connectedWalletAPI) {
            return;
        }
        let cancelled = false;
        (async () => {
            const apiConfig = await connectedWalletAPI.getConfiguration();
            if (cancelled) return;
            if (apiConfig.networkId !== networkId) {
                console.warn(
                    `wallet network '${apiConfig.networkId}' does not match app network '${networkId}'; disconnecting`,
                );
                resetState();
            }
        })();
        return () => { cancelled = true; };
    }, [connectedWalletAPI, networkId, resetState]);

    // Load balances whenever the wallet, network, or reload toggle changes. The
    // cancelled flag prevents a stale in-flight fetch from overwriting state
    // after the wallet/network has changed underneath it.
    useEffect(() => {
        if (!connectedWalletAPI) {
            return;
        }
        let cancelled = false;
        (async () => {
            const [unshielded, shielded, dust] = await Promise.all([
                connectedWalletAPI.getUnshieldedBalances(),
                connectedWalletAPI.getShieldedBalances(),
                connectedWalletAPI.getDustBalance(),
            ]);
            if (cancelled) return;
            _setBalances({
                unshielded,
                shielded,
                dust: dust.balance,
            });
        })();
        return () => { cancelled = true; };
    }, [connectedWalletAPI, networkId, balanceReloadToggle]);

    const connectWallet = useCallback(async () => {
        // Do nothing if already connected or a connect is already in flight.
        if (connectedWalletAPI || connectingRef.current) {
            return;
        }

        // Confirm an object is injected into the window object at the "midnight" key.
        if (typeof window === "undefined" || !window.midnight) {
            throw new Error(
                `No Midnight wallet found at window.midnight — is the extension installed and enabled?`,
            );
        }

        connectingRef.current = true;
        try {
            // Gather listed midnight wallets.
            const midnightWallets = Object.entries(window.midnight).map(([walletKey, api]) => ({
                walletKey,
                rdns: api.rdns,
                name: api.name,
                icon: api.icon,
                apiVersion: api.apiVersion,
            }));
            if (midnightWallets.length === 0) {
                throw new Error(
                    `No Midnight wallet found at window.midnight — is the extension installed and enabled?`,
                );
            }
            console.debug("found midnight wallets", midnightWallets, "using first one");

            // Get a typed handle on the first wallet and connect to the selected network.
            const initialAPI: InitialAPI = window.midnight[midnightWallets[0].walletKey];
            const connectedAPI = await initialAPI.connect(networkId);

            // Reject the connection if the wallet is not on the app's network.
            const apiConfig = await connectedAPI.getConfiguration();
            if (apiConfig.networkId !== networkId) {
                throw new Error(
                    `Network '${apiConfig.networkId}' selected in wallet does not match app configuration '${networkId}'`,
                );
            }
            setConnectedWalletAPI(connectedAPI);

            // Load addresses once per connection. Unlike balances these are stable
            // for the lifetime of the connection, so they are not reloaded.
            const [unshielded, shielded, dust] = await Promise.all([
                connectedAPI.getUnshieldedAddress(),
                connectedAPI.getShieldedAddresses(),
                connectedAPI.getDustAddress(),
            ]);
            _setAddresses({
                unshielded: unshielded.unshieldedAddress,
                shielded: shielded.shieldedAddress,
                dust: dust.dustAddress,
            });
        } finally {
            connectingRef.current = false;
        }
    }, [connectedWalletAPI, networkId]);

    const value = useMemo<WalletContextValue>(() => ({
        connectWallet,
        connectedWalletAPI,
        addresses: _addresses,
        balances: _balances,
        reloadBalances: () => setBalanceReloadToggle((curr) => !curr),
    }), [connectWallet, connectedWalletAPI, _addresses, _balances]);

    return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Access the connected wallet. Throws if used outside a {@link WalletContextProvider}. */
export function useWallet(): WalletContextValue {
    const ctx = useContext(WalletContext);
    if (!ctx) throw new Error("useWallet must be used within a WalletContextProvider");
    return ctx;
}
