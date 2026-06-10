import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useConfig } from "./ConfigContext";
import type { NetworkId } from "../lib/network.ts";
import * as SharedCanvas from "@nyxels/contract-sdk";
import { type WitnessContext } from "@midnight-ntwrk/compact-runtime";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
// Imports for the still-commented provider wiring below (re-enable with it):
// import { findDeployedContract, type ContractProviders } from "@midnight-ntwrk/midnight-js/contracts";
// import type { MidnightProviders } from "@midnight-ntwrk/midnight-js/types";
// import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
// import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";

// Base path under which the compiled ZK assets (the contract's `keys/` and
// `zkir/` from @nyxels/contract-sdk's managed/ output) are served as static
// files — copy-zk-assets puts them in public/shared-canvas/, and BASE_URL
// covers the GitHub Pages subpath ("/" locally, "/nyxels/" deployed).
// compact-js records this path; the matching FetchZkConfigProvider in the
// midnight-js provider set fetches from the same base when proving.
const ZK_ASSETS_PATH = `${import.meta.env.BASE_URL}shared-canvas`;

// The contract's circuit names — what the artifact files are named after.
const CIRCUITS = ["updateSquare", "extendCanvas"] as const;
type Circuit = (typeof CIRCUITS)[number];

type SharedCanvasPrivateState = {};

// The witness the circuits read.
// In real use this will hook into some wallet flow to get a private
// unique identifier from the executing user.
const witnesses: SharedCanvas.Witnesses<SharedCanvasPrivateState> = {
    operatorSecretKey: ({
        privateState,
    }: WitnessContext<SharedCanvas.Ledger, SharedCanvasPrivateState>): [SharedCanvasPrivateState, Uint8Array] => {
        return [privateState, new Uint8Array(32)];
    },
};

// dummy coin public key (32-byte hex).
// required by the API (for zswap use cases),
// unused in this example
// const CPK = "0".repeat(64);

interface SharedCanvasContextValue {

}

// FIXME... this level DB thing. Need to understand more.
// const PRIVATE_STATE_ID = "shared-canvas";

const SharedCanvasContext = createContext<SharedCanvasContextValue | null>(null);

const networkAddressIdx: { [key: NetworkId]: string } = {
    "undeployed": "529e85a2a2040228b44b3ae9113cf24ca454039820639f168864cf003e7e07a8",
    "preview": "",
    "preprod": "",
    "mainnet": "",
}

// function buildProviders(): MidnightProviders<
//     // CircuitKeys: supposed to be a "union of circuit names from compiled contract" according to: 'https://docs.midnight.network/guides/configure-providers#the-midnightproviders-type'
//     // but cannot find this union in "@nyxels/contract-sdk",
//     string,
//     // PrivateStateID: literal of the private state storage key. Just a string but use a union with single value to enforce type safety.
//     string,
//     // PrivateState: shape of the contract's private state object
//     SharedCanvasPrivateState,
// > {
//     return {
//         // Manages the Private State of a Contract.
//         // Key Methods: get(id)→PS|null, set(id, PS), remove, clear
//         privateStateProvider: levelPrivateStateProvider({
//             privateStateStoreName: "shared-canvas-state",
//             signingKeyStoreName: "some-signing-key-store-name",
//             // what is this? it is not in the docs at: https://docs.midnight.network/guides/configure-providers#privatestateprovider
//             accountId: "",
//             privateStoragePasswordProvider: () => "random-pwd",
//         }),

//         // Retrieves public data from the blockchain.
//         // Key Methods: queryContractState(addr), watchForContractState, contractStateObservable(addr)
//         publicDataProvider: indexerPublicDataProvider(
//             "", // query url - i.e. indexerUrl
//             "", // subscription url - i.e. indexerWsUrl
//         ),

//         // Retrieves the ZK artifacts of a contract needed to create proofs.
//         // Key Methods: getProverKey(id), getVerifierKey(id), getZKIR(id) — id is typed to PCK, i.e. just a string that is the name of the circuit
//         zkConfigProvider: new FetchZkConfigProvider<string>('path-to-hosted-artifacts'),

//         // proof provider
//     };
// }

export function SharedCanvasContextProvider({ children }: { children: ReactNode }) {
    const { config: { networkId } } = useConfig();

    // One-time smoke test on first mount: fetch every ZK artifact through a
    // FetchZkConfigProvider and log what came back, so a broken asset path is
    // visible in the console immediately (locally and deployed) rather than
    // surfacing later as a failed proof. The ref guards StrictMode's
    // double-invoke so the ~8MB of keys is only fetched once.
    const hasVerifiedZkAssetsRef = useRef(false);
    useEffect(() => {
        if (hasVerifiedZkAssetsRef.current) return;
        hasVerifiedZkAssetsRef.current = true;
        (async () => {
            // The provider requires an absolute http(s) URL, so anchor the
            // served path to the current origin. The explicit bound fetch is
            // needed because the provider's cross-fetch default calls the
            // native fetch unbound ("Illegal invocation" in browsers).
            const baseURL = new URL(ZK_ASSETS_PATH, window.location.origin).toString();
            const provider = new FetchZkConfigProvider<Circuit>(baseURL, window.fetch.bind(window));
            console.info(`[shared-canvas] loading ZK artifacts from ${baseURL}`);

            for (const circuit of CIRCUITS) {
                const start = performance.now();
                const [proverKey, verifierKey, zkir] = await Promise.all([
                    provider.getProverKey(circuit),
                    provider.getVerifierKey(circuit),
                    provider.getZKIR(circuit),
                ]);
                const ms = Math.round(performance.now() - start);
                console.info(
                    `[shared-canvas] ${circuit}: prover ${proverKey.length} bytes, ` +
                    `verifier ${verifierKey.length} bytes, zkir ${zkir.length} bytes (${ms}ms)`,
                );
            }
            console.info("[shared-canvas] all ZK artifacts loaded ✔");
        })().catch((e: unknown) => {
            console.error("[shared-canvas] ZK artifact loading FAILED", e);
        });
    }, []);

    // keep contract address in sync with network
    const [contractAddress, setContractAddress] = useState<string | null>(null);
    useEffect(() => {
        const newContractAddress = networkAddressIdx[networkId];
        if (!networkAddressIdx) {
            throw new Error(`contract address for networkId '${networkId}' not known`);
        }
        setContractAddress(newContractAddress);
    }, [networkId])

    // reconstruct contract whenever the address changes
    useEffect(() => {
        (async () => {
            const compiledContract = CompiledContract.make(
                "shared-canvas",
                SharedCanvas.Contract,
            ).pipe(
                CompiledContract.withWitnesses(witnesses),
                CompiledContract.withCompiledFileAssets(ZK_ASSETS_PATH),
            );
            void compiledContract; // consumed by the commented wiring below

            // const contract = await findDeployedContract(
            //     {},
            //     {
            //         contractAddress: "529e85a2a2040228b44b3ae9113cf24ca454039820639f168864cf003e7e07a8",
            //         compiledContract,
            //         privateStateId: PRIVATE_STATE_ID,
            //         initialPrivateState: { localSecretKey: DEMO_SECRET_KEY },
            //     },
            // );
        })();
    }, [])

    const value = useMemo<SharedCanvasContextValue>(() => ({

    }), [contractAddress]);

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