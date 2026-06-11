// Test configuration. Every variable has a baked-in default targeting the
// local docker stack — EXCEPT the contract address, which must either be set
// via CONTRACT_ADDRESS or be produced by the deploy test (which persists it to
// the gitignored .contract-address file in this package's root).
import * as path from "node:path";
import { fileURLToPath } from "node:url";
// The Config shape (and per-network endpoint defaults) are shared with the UI
// via @nyxels/lib; this module layers the env-var overrides on top.
import { DEFAULT_ENDPOINTS, Network, type Config } from "@nyxels/lib";

try {
  // Node 22+: load .env from CWD into process.env. Optional — defaults below
  // cover the local stack — so a missing file is fine.
  process.loadEnvFile();
} catch {
  // No .env file — fall back to whatever is already in the environment.
}

/** Env var if set (non-empty), otherwise the default. */
function env(name: string, defaultValue: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : defaultValue;
}

export type { Config };

const LOCAL = DEFAULT_ENDPOINTS[Network.Undeployed];

/** The configured stack — local docker stack unless overridden. */
export const config: Config = {
  networkId: env("NETWORK_ID", Network.Undeployed),
  indexerUrl: env("INDEXER_URL", LOCAL.indexerUrl),
  indexerWsUrl: env("INDEXER_WS_URL", LOCAL.indexerWsUrl),
  nodeUrl: env("NODE_URL", LOCAL.nodeUrl),
  proofServerUrl: env("PROOF_SERVER_URL", LOCAL.proofServerUrl),
};

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The compiler output the SDK + proof providers read (managed/ in contract-sdk). */
export const zkConfigPath: string = path.resolve(packageRoot, "contract-sdk", "managed");
