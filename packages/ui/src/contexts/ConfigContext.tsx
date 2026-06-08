import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { type NetworkId as SDKNetworkId, setNetworkId as setSDKNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

// Midnight's network identifiers — the literal strings the SDK and Lace wallet
// expect (e.g. `wallet.connect('preprod')`). Ordered from local development
// through to production. Note there is no network literally named "testnet";
// "preview" and "preprod" are the two public test networks.
export type NetworkId = SDKNetworkId |
    // Local standalone stack (Docker node + indexer + proof server on localhost).
    "undeployed" |
    // Public test network for early/breaking changes — bleeding-edge ledger.
    "preview" |
    // Public test network that mirrors mainnet config; the final staging step.
    "preprod" |
    // Production network (live, real value).
    "mainnet";

export type NodeConfig = {
    indexer: string;
    indexerWS: string;
    node: string;
    proofServer: string;
};

interface ConfigContextValue {
    networkId: NetworkId;
    setNetworkId: (networkId: NetworkId) => void;
    nodeConfig: NodeConfig;
    setNodeConfigIndexer: (indexer: string) => void;
    setNodeConfigNode: (indexer: string) => void;
    setNodeConfigProofServer: (indexer: string) => void;
}

const defaultMainnetNodeConfig: NodeConfig = {
    indexer: "https://indexer.mainnet.midnight.network/api/v3/graphql",
    indexerWS: "wss://indexer.mainnet.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.mainnet.midnight.network",
    // The proof server sees private witness data, so it is always run locally
    // rather than against a remote host.
    proofServer: "http://127.0.0.1:6300",
};

const defaultPreprodNodeConfig: NodeConfig = {
    indexer: "https://indexer.preprod.midnight.network/api/v3/graphql",
    indexerWS: "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.preprod.midnight.network",
    proofServer: "http://127.0.0.1:6300",
};

const defaultPreviewNodeConfig: NodeConfig = {
    indexer: "https://indexer.preview.midnight.network/api/v3/graphql",
    indexerWS: "wss://indexer.preview.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.preview.midnight.network",
    proofServer: "http://127.0.0.1:6300",
};

// The undeployed network is the local standalone stack (Docker containers) run
// during development — see the Midnight standalone/counter-cli configs.
const defaultUndeployedNodeConfig: NodeConfig = {
    indexer: "http://127.0.0.1:8088/api/v3/graphql",
    indexerWS: "ws://127.0.0.1:8088/api/v3/graphql/ws",
    node: "http://127.0.0.1:9944",
    proofServer: "http://127.0.0.1:6300",
};

const ConfigContext = createContext<ConfigContextValue | null>(null);

// Derive the indexer WebSocket URL from the indexer HTTP URL: swap the scheme to
// ws(s) and append the "/ws" path segment the indexer expects.
function indexerWSFromIndexer(indexer: string): string {
    const url = new URL(indexer);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
    return url.toString();
}

export function ConfigContextProvider({ children }: { children: ReactNode }) {
    const [_networkId, _setNetworkId] = useState<NetworkId>("mainnet");
    const [_nodeConfig, _setNodeConfig] = useState<NodeConfig>(defaultMainnetNodeConfig);

    const setNetworkId = useCallback((networkId: NetworkId) => {
        setSDKNetworkId(networkId);
        _setNetworkId(networkId);

        switch (networkId) {
            case "undeployed":
                _setNodeConfig(defaultUndeployedNodeConfig);
                break;
            case "preview":
                _setNodeConfig(defaultPreviewNodeConfig);
                break;
            case "preprod":
                _setNodeConfig(defaultPreprodNodeConfig);
                break;
            case "mainnet":
                _setNodeConfig(defaultMainnetNodeConfig);
                break;
            default:
                throw new TypeError(`unexpected value given for networkId: ${networkId}`);
        }
    }, []);

    const value = useMemo<ConfigContextValue>(() => ({
        networkId: _networkId,
        setNetworkId,
        nodeConfig: _nodeConfig,
        setNodeConfigIndexer: (indexer: string) => _setNodeConfig((curr) => ({
            ...curr,
            indexer: new URL(indexer).toString(),
            indexerWS: indexerWSFromIndexer(indexer),
        })),
        setNodeConfigNode: (node: string) => _setNodeConfig((curr) => ({
            ...curr,
            node: new URL(node).toString(),
        })),
        setNodeConfigProofServer: (proofServer: string) => _setNodeConfig((curr) => ({
            ...curr,
            proofServer: new URL(proofServer).toString(),
        })),
    }), [_networkId, setNetworkId, _nodeConfig]);

    return (
        <ConfigContext.Provider value={value}>
            {children}
        </ConfigContext.Provider>
    );
}

/** Access the global config. Throws if used outside a ConfigProvider. */
export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within a ConfigProvider");
  return ctx;
}