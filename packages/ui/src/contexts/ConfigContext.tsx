import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
// midnight-js reads a process-global network id internally (unlike compact-js,
// which takes it explicitly). We set it once here, via the umbrella package's
// subpath so the whole app touches one resolution of midnight-js-network-id.
import { setNetworkId as setSDKNetworkId } from "@midnight-ntwrk/midnight-js/network-id";

import { DEFAULT_NETWORK, Network, type NetworkId } from "../lib/network.ts";

/**
 * The set of endpoints (+ network id) a wallet needs to reach the chain. Plain
 * data, so it can be handed to domain classes/functions by argument rather
 * than having them reach for a global.
 */
export interface Config {
  indexer: string; // indexer GraphQL over HTTP
  indexerWS: string; // indexer GraphQL over WebSocket (subscriptions / sync)
  node: string; // Midnight node RPC (HTTP; converted to ws:// for the facade relay)
  proofServer: string; // proof server (ZK proof generation)
  networkId: NetworkId; // which network these endpoints belong to
}

type Endpoints = Omit<Config, "networkId">;

// The proof server sees private witness data, so it is always run locally
// rather than against a remote host.
const LOCAL_PROOF_SERVER = "http://127.0.0.1:6300";

// Default endpoints per network. Undeployed is the local standalone stack
// (Docker containers) run during development.
const DEFAULT_ENDPOINTS: Record<Network, Endpoints> = {
  [Network.Undeployed]: {
    indexer: "http://127.0.0.1:8088/api/v3/graphql",
    indexerWS: "ws://127.0.0.1:8088/api/v3/graphql/ws",
    node: "http://127.0.0.1:9944",
    proofServer: LOCAL_PROOF_SERVER,
  },
  [Network.Preview]: {
    indexer: "https://indexer.preview.midnight.network/api/v3/graphql",
    indexerWS: "wss://indexer.preview.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.preview.midnight.network",
    proofServer: LOCAL_PROOF_SERVER,
  },
  [Network.Preprod]: {
    indexer: "https://indexer.preprod.midnight.network/api/v3/graphql",
    indexerWS: "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.preprod.midnight.network",
    proofServer: LOCAL_PROOF_SERVER,
  },
  [Network.Mainnet]: {
    indexer: "https://indexer.mainnet.midnight.network/api/v3/graphql",
    indexerWS: "wss://indexer.mainnet.midnight.network/api/v3/graphql/ws",
    node: "https://rpc.mainnet.midnight.network",
    proofServer: LOCAL_PROOF_SERVER,
  },
};

interface ConfigContextValue {
  /** The full connection config for the currently-selected network. */
  config: Config;
  /** Switch network (resets endpoints to that network's defaults). */
  setNetworkId: (networkId: Network) => void;
  setIndexer: (indexer: string) => void;
  setNode: (node: string) => void;
  setProofServer: (proofServer: string) => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

// Derive the indexer WebSocket URL from the indexer HTTP URL: swap the scheme
// to ws(s) and append the "/ws" path segment the indexer expects.
function indexerWSFromIndexer(indexer: string): string {
  const url = new URL(indexer);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
  return url.toString();
}

/**
 * Holds the app-wide connection config in memory and owns the selected network.
 * Mounted once at the root so the whole app shares one source of truth (via
 * {@link useConfig}); domain classes/functions take a {@link Config} by argument.
 */
export function ConfigContextProvider({ children }: { children: ReactNode }) {
  const [networkId, _setNetworkId] = useState<Network>(DEFAULT_NETWORK);
  const [endpoints, setEndpoints] = useState<Endpoints>(DEFAULT_ENDPOINTS[DEFAULT_NETWORK]);

  const setNetworkId = useCallback((next: Network) => {
    setSDKNetworkId(next); // keep midnight-js's global in step (it reads it internally)
    _setNetworkId(next);
    setEndpoints(DEFAULT_ENDPOINTS[next]);
  }, []);

  const config = useMemo<Config>(() => ({ ...endpoints, networkId }), [endpoints, networkId]);

  const value = useMemo<ConfigContextValue>(
    () => ({
      config,
      setNetworkId,
      setIndexer: (indexer: string) =>
        setEndpoints((curr) => ({
          ...curr,
          indexer: new URL(indexer).toString(),
          indexerWS: indexerWSFromIndexer(indexer),
        })),
      setNode: (node: string) => setEndpoints((curr) => ({ ...curr, node: new URL(node).toString() })),
      setProofServer: (proofServer: string) =>
        setEndpoints((curr) => ({ ...curr, proofServer: new URL(proofServer).toString() })),
    }),
    [config, setNetworkId],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

/** Access the global config. Throws if used outside a ConfigContextProvider. */
export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used within a ConfigContextProvider");
  return ctx;
}
