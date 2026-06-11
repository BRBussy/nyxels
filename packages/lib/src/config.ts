// Connection config — everything needed to talk to one Midnight stack.
import { Network, type NetworkId } from "./network.ts";

/**
 * The set of endpoints (+ network id) needed to reach the chain. Plain data,
 * so it can be handed to domain classes/functions by argument rather than
 * having them reach for a global. A seed is intentionally NOT part of this:
 * a config describes a *network*, while a seed identifies a *wallet*.
 */
export interface Config {
  readonly indexerUrl: string; // indexer GraphQL over HTTP
  readonly indexerWsUrl: string; // indexer GraphQL over WebSocket (subscriptions / sync)
  readonly nodeUrl: string; // Midnight node RPC (HTTP; converted to ws:// for the facade relay)
  readonly proofServerUrl: string; // proof server (ZK proof generation)
  readonly networkId: NetworkId; // which network these endpoints belong to
}

export type Endpoints = Omit<Config, "networkId">;

// The proof server sees private witness data, so it is always run locally
// rather than against a remote host.
export const LOCAL_PROOF_SERVER = "http://127.0.0.1:6300";

// Default endpoints per network. Undeployed is the local standalone stack
// (Docker containers) run during development.
export const DEFAULT_ENDPOINTS: Record<Network, Endpoints> = {
  [Network.Undeployed]: {
    indexerUrl: "http://127.0.0.1:8088/api/v3/graphql",
    indexerWsUrl: "ws://127.0.0.1:8088/api/v3/graphql/ws",
    nodeUrl: "http://127.0.0.1:9944",
    proofServerUrl: LOCAL_PROOF_SERVER,
  },
  [Network.Preview]: {
    indexerUrl: "https://indexer.preview.midnight.network/api/v3/graphql",
    indexerWsUrl: "wss://indexer.preview.midnight.network/api/v3/graphql/ws",
    nodeUrl: "https://rpc.preview.midnight.network",
    proofServerUrl: LOCAL_PROOF_SERVER,
  },
  [Network.Preprod]: {
    indexerUrl: "https://indexer.preprod.midnight.network/api/v3/graphql",
    indexerWsUrl: "wss://indexer.preprod.midnight.network/api/v3/graphql/ws",
    nodeUrl: "https://rpc.preprod.midnight.network",
    proofServerUrl: LOCAL_PROOF_SERVER,
  },
  [Network.Mainnet]: {
    indexerUrl: "https://indexer.mainnet.midnight.network/api/v3/graphql",
    indexerWsUrl: "wss://indexer.mainnet.midnight.network/api/v3/graphql/ws",
    nodeUrl: "https://rpc.mainnet.midnight.network",
    proofServerUrl: LOCAL_PROOF_SERVER,
  },
};

// Derive the indexer WebSocket URL from the indexer HTTP URL: swap the scheme
// to ws(s) and append the "/ws" path segment the indexer expects.
export function indexerWsUrlFromIndexerUrl(indexerUrl: string): string {
  const url = new URL(indexerUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
  return url.toString();
}
