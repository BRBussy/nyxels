import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useConfig, type NetworkId } from "./ConfigContext";
import * as SharedCanvas from "@nyxels/contract-sdk";
import { type WitnessContext } from "@midnight-ntwrk/compact-runtime";
import { CompiledContract } from "@midnight-ntwrk/compact-js";

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
const CPK = "0".repeat(64);

interface SharedCanvasContextValue {

}

const SharedCanvasContext = createContext<SharedCanvasContextValue | null>(null);

const networkAddressIdx: { [key: NetworkId]: string } = {
    "undeployed": "529e85a2a2040228b44b3ae9113cf24ca454039820639f168864cf003e7e07a8",
    "preview": "",
    "preprod": "",
    "mainnet": "",
}

export function SharedCanvasContextProvider({ children }: { children: ReactNode }) {
    const { networkId } = useConfig();

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
        const compiledContract = CompiledContract.make(
            "shared-canvas",
            SharedCanvas.Contract,
        ).pipe(
            CompiledContract.withWitnesses(witnesses),
            CompiledContract.withCompiledFileAssets(ZK_ASSETS_PATH),
        );
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