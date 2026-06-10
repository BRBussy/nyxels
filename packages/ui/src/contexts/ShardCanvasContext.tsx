import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
// import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";

// FIXME: .....
// Base path under which the compiled ZK assets (the contract's `keys/` and
// `zkir/` from @nyxels/contract-sdk's managed/ output) are served as static
// files. compact-js records this path; the matching FetchZkConfigProvider in
// the midnight-js provider set fetches from the same base when proving.
const ZK_ASSETS_PATH = "/shared-canvas";

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