// Test configuration. Every variable has a baked-in default targeting the
// local docker stack — EXCEPT the contract address, which must either be set
// via CONTRACT_ADDRESS or be produced by the deploy test (which persists it to
// the gitignored .contract-address file in this package's root).
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

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

/**
 * Connection config — everything needed to talk to one Midnight stack. The
 * `seed` is intentionally NOT part of this: a config describes a *network*,
 * while a seed identifies a *wallet*.
 */
export interface Config {
  readonly networkId: string;
  readonly indexerUrl: string;
  readonly indexerWsUrl: string;
  readonly nodeUrl: string;
  readonly proofServerUrl: string;
}

/** The configured stack — local docker stack unless overridden. */
export const config: Config = {
  networkId: env("NETWORK_ID", "undeployed"),
  indexerUrl: env("INDEXER_URL", "http://127.0.0.1:8088/api/v3/graphql"),
  indexerWsUrl: env("INDEXER_WS_URL", "ws://127.0.0.1:8088/api/v3/graphql/ws"),
  nodeUrl: env("NODE_URL", "http://127.0.0.1:9944"),
  proofServerUrl: env("PROOF_SERVER_URL", "http://127.0.0.1:6300"),
};

/** Seed for deployment + wallet interactions. Default: the pre-funded dev account. */
export const seed: string = env(
  "SEED",
  "0000000000000000000000000000000000000000000000000000000000000001",
);

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Where the deploy test persists the deployed contract's address. */
export const contractAddressFile: string = path.join(packageRoot, ".contract-address");

/** Root of the @nyxels/contract package (the Compact source under test). */
export const contractPackageDir: string = path.resolve(packageRoot, "..", "contract");

/** The compiler output the SDK + proof providers read (managed/ in contract-sdk). */
export const zkConfigPath: string = path.resolve(packageRoot, "..", "contract-sdk", "managed");

/**
 * Resolve the address of the deployed contract under test:
 * CONTRACT_ADDRESS env var if set → otherwise the .contract-address file
 * written by the last deploy test → otherwise fail with instructions.
 */
export function resolveContractAddress(): string {
  const fromEnv = process.env["CONTRACT_ADDRESS"];
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim();
  if (fs.existsSync(contractAddressFile)) {
    const fromFile = fs.readFileSync(contractAddressFile, "utf8").trim();
    if (fromFile.length > 0) return fromFile;
  }
  throw new Error(
    "No contract address available: set CONTRACT_ADDRESS in the environment, " +
      "or run `npm run test:deploy` first (it writes .contract-address for later tests).",
  );
}

/** Persist the freshly deployed contract address for later tests. */
export function persistContractAddress(address: string): void {
  fs.writeFileSync(contractAddressFile, `${address}\n`, "utf8");
}
