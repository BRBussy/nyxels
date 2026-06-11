import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useConfig, type Config } from "./ConfigContext";
import { useWallets } from "./WalletContext.tsx";
import type { Network } from "../lib/network.ts";
import * as SharedCanvas from "@nyxels/contract-sdk";
import { type WitnessContext } from "@midnight-ntwrk/compact-runtime";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { findDeployedContract, type FoundContract } from "@midnight-ntwrk/midnight-js/contracts";
import type { MidnightProviders } from "@midnight-ntwrk/midnight-js/types";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import type { Wallet } from "@/lib/wallet/Wallet.ts";

// Base path under which the compiled ZK assets (the contract's `keys/` and
// `zkir/` from @nyxels/contract-sdk's managed/ output) are served as static
// files — copy-zk-assets puts them in public/shared-canvas/, and BASE_URL
// covers the GitHub Pages subpath ("/" locally, "/nyxels/" deployed).
// compact-js records this path; the matching FetchZkConfigProvider in the
// midnight-js provider set fetches from the same base when proving.
const ZK_ASSETS_PATH = `${import.meta.env.BASE_URL}shared-canvas`;

type SharedCanvasCircuit = keyof InstanceType<typeof SharedCanvas.Contract>["provableCircuits"] & string;

type SharedCanvasPrivateState = {};

type SharedCanvasContract = SharedCanvas.Contract<SharedCanvasPrivateState>;

type SharedCanvasWitnesses = SharedCanvas.Witnesses<SharedCanvasPrivateState>;

// The key used in the levelDb to store private state
type PrivateStateID = "shared-canvas";
const PRIVATE_STATE_ID: PrivateStateID = "shared-canvas";

type SharedCanvasProviders = MidnightProviders<
    // CircuitKeys: type expressing list of circuit names,
    SharedCanvasCircuit,
    // PrivateStateID: literal of the private state storage key. Just a string but use a union with single value to enforce type safety.
    PrivateStateID,
    // PrivateState: shape of the contract's private state object
    SharedCanvasPrivateState
>;

// The witness the circuits read.
// In real use this will hook into some wallet flow to get a private
// unique identifier from the executing user.
const witnesses: SharedCanvasWitnesses = {
    operatorSecretKey: ({
        privateState,
    }: WitnessContext<SharedCanvas.Ledger, SharedCanvasPrivateState>): [SharedCanvasPrivateState, Uint8Array] => {
        return [privateState, new Uint8Array(32)];
    },
};

// Built once at module scope — depends only on module constants.
const compiledContract = CompiledContract.make<SharedCanvasContract>(
    "shared-canvas",
    SharedCanvas.Contract,
).pipe(
    CompiledContract.withWitnesses(witnesses),
    CompiledContract.withCompiledFileAssets(ZK_ASSETS_PATH),
);

function buildProviders(
    config: Config,
    wallet: Wallet,
): SharedCanvasProviders {
    const zkConfigProvider = new FetchZkConfigProvider<SharedCanvasCircuit>(
        new URL(ZK_ASSETS_PATH, window.location.origin).toString(),
        window.fetch.bind(window),
    )

    return {
        // Manages the Private State of a Contract, plus contract-maintenance signing keys.
        // Key Methods: get(id)→PS|null, set(id, PS), remove, clear,
        //              getSigningKey/setSigningKey (keyed by contract address),
        //              exportPrivateStates/importPrivateStates.
        // Storage is browser IndexedDB (via LevelDB API): clearing browser data
        // permanently destroys it — the package itself warns against production use
        // where loss matters. Fine here: our private state is empty and we never
        // deploy from the browser, so no signing keys land in it either.
        privateStateProvider: levelPrivateStateProvider({
            // Sublevel for private states, keyed by privateStateId.
            // Default 'private-states' (in db 'midnight-level-db').
            // Set to prevent collision with other dApps.
            privateStateStoreName: 'sharedcanvas-private-states',

            // Sublevel for contract-maintenance signing keys, keyed by contract
            // address; written on deployContract.
            // Default 'signing-keys'.
            // Set to prevent collision with other dApps.
            signingKeyStoreName: 'sharedcanvas-signing-keys',

            // Account identifier used to scope storage.
            // This ensures data isolation between different accounts/wallets using the same database.
            accountId: wallet.id,

            // Returns the password (sync or async) used to encrypt BOTH stores.
            // Must pass validatePassword: ≥16 chars, ≥3 of {upper,lower,digit,special},
            // no 3+ repeated chars, no 4+ sequential runs — else
            // PasswordValidationError at runtime.
            // A constant in client source is obfuscation, not secrecy — acceptable
            // here only because nothing sensitive is stored.
            privateStoragePasswordProvider: () => "&*(BHJqwe419" + wallet.id,
        }),

        // Retrieves public data from the blockchain.
        // Key Methods: queryContractState(addr), watchForContractState, contractStateObservable(addr)
        publicDataProvider: indexerPublicDataProvider(
            // query url
            config.indexerUrl,
            // subscription url
            config.indexerWsUrl,
        ),

        // Retrieves the ZK artifacts of a contract needed to create proofs.
        // Key Methods: getProverKey(id), getVerifierKey(id), getZKIR(id) — id is typed to PCK, i.e. just a string that is the name of the circuit
        zkConfigProvider,

        // proof provider
        // ... should this perhaps BE the wallet?? since it already has it's own proof server config?
        proofProvider: httpClientProofProvider(
            // proof server url
            config.proofServerUrl,
            zkConfigProvider,
        ),

        /**
         * Creates proven, balanced transactions.
         */
        walletProvider: wallet,

        /**
         * Submits proven, balanced transactions to the network.
         */
        midnightProvider: wallet,
    };
}

// Where the shared-canvas contract is deployed on each network.
// An empty string means "not deployed there (yet)".
const networkAddressIdx: Record<Network, string> = {
    undeployed: "529e85a2a2040228b44b3ae9113cf24ca454039820639f168864cf003e7e07a8",
    preview: "",
    preprod: "",
    mainnet: "",
}

interface SharedCanvasContextValue {
    // null until found (i.e. while no wallet is selected, the contract is not
    // deployed on the selected network, or the find is still in flight).
    contract: FoundContract<SharedCanvasContract> | null,
    readContractState: () => Promise<SharedCanvas.Ledger>,
}

const SharedCanvasContext = createContext<SharedCanvasContextValue | null>(null);

export function SharedCanvasContextProvider({ children }: { children: ReactNode }) {
    const { config } = useConfig();
    const { selectedWallet } = useWallets();

    // Config.networkId is the SDK's bare string type, but its values always
    // come from the app's Network union.
    const contractAddress = networkAddressIdx[config.networkId as Network] || null;

    const providers = useMemo<SharedCanvasProviders | null>(
        () => (selectedWallet ? buildProviders(config, selectedWallet) : null),
        [config, selectedWallet],
    );

    const [contract, setContract] = useState<FoundContract<SharedCanvasContract> | null>(null);
    useEffect(() => {
        setContract(null);
        if (!contractAddress || !providers) {
            return;
        }

        // `cancelled` stops a superseded run from publishing its result after
        // the wallet or network changed under it.
        let cancelled = false;
        (async () => {
            try {
                const found = await findDeployedContract(
                    providers,
                    {
                        contractAddress,
                        compiledContract,
                        privateStateId: PRIVATE_STATE_ID,
                        initialPrivateState: {},
                    },
                );
                if (!cancelled) {
                    setContract(found);
                }
            } catch (e) {
                console.error("error finding deployed contract", e);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [providers, contractAddress]);

    const readContractState = useCallback(async () => {
        if (!(providers && contractAddress)) {
            throw new Error("shared canvas not initialised — a wallet and a deployed network are required before reading state");
        }

        const state = await providers.publicDataProvider.queryContractState(contractAddress)
        if (!state) {
            throw new Error(`no contract state found at address '${contractAddress}'`);
        }

        return SharedCanvas.ledger(state.data);
    }, [providers, contractAddress]);

    const value = useMemo<SharedCanvasContextValue>(() => ({
        contract,
        readContractState,
    }), [contract, readContractState]);

    return (
        <SharedCanvasContext.Provider value={value}>
            {children}
        </SharedCanvasContext.Provider>
    );
}

/** Access the global sharedcanvas. Throws if used outside a SharedCanvasProvider. */
export function useSharedCanvas(): SharedCanvasContextValue {
    const ctx = useContext(SharedCanvasContext);
    if (!ctx) throw new Error("useSharedCanvas must be used within a SharedCanvasProvider");
    return ctx;
}
