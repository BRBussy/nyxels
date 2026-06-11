import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
// midnight-js reads a process-global network id internally (unlike compact-js,
// which takes it explicitly). We set it once here, via the umbrella package's
// subpath so the whole app touches one resolution of midnight-js-network-id.
import { setNetworkId as setSDKNetworkId } from "@midnight-ntwrk/midnight-js/network-id";

import {
  DEFAULT_ENDPOINTS,
  indexerWsUrlFromIndexerUrl,
  type Config,
  type Endpoints,
} from "@nyxels/lib";
import { DEFAULT_NETWORK, Network } from "../lib/network.ts";

// Re-exported so app code can take the config shape from the context that
// owns it, without also depending on @nyxels/lib directly.
export type { Config };

interface ConfigContextValue {
  /** The full connection config for the currently-selected network. */
  config: Config;
  /** Switch network (resets endpoints to that network's defaults). */
  setNetworkId: (networkId: Network) => void;
  setIndexer: (indexerUrl: string) => void;
  setNode: (nodeUrl: string) => void;
  setProofServer: (proofServerUrl: string) => void;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

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
      setIndexer: (indexerUrl: string) =>
        setEndpoints((curr) => ({
          ...curr,
          indexerUrl: new URL(indexerUrl).toString(),
          indexerWsUrl: indexerWsUrlFromIndexerUrl(indexerUrl),
        })),
      setNode: (nodeUrl: string) => setEndpoints((curr) => ({ ...curr, nodeUrl: new URL(nodeUrl).toString() })),
      setProofServer: (proofServerUrl: string) =>
        setEndpoints((curr) => ({ ...curr, proofServerUrl: new URL(proofServerUrl).toString() })),
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
