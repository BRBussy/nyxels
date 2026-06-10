// Environment test: the compact compiler is resolvable, and the node, indexer
// and proof server respond on their configured endpoints. Runs first so every
// later failure can be trusted to be about the system under test, not the
// environment.
import { execSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { config } from "../lib/config";

const FETCH_TIMEOUT_MS = 5_000;

/** GETs a URL, returning the response — any HTTP status counts as "listening". */
async function tryFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    throw new Error(
      `Nothing reachable at ${url} (${e instanceof Error ? e.message : String(e)}). ` +
        "Is the local Midnight stack running? Start it with: docker compose up -d --wait " +
        "(see README — proof-server :6300, indexer :8088, node :9944).",
    );
  }
}

describe("environment", () => {
  it("compact compiler is on the PATH", () => {
    let version: string;
    try {
      version = execSync("compact --version", { encoding: "utf8" }).trim();
    } catch {
      throw new Error(
        "The `compact` compiler is not on the PATH. Install the Compact developer tools " +
          "(https://docs.midnight.network) — the compile test and contract artifacts need it.",
      );
    }
    expect(version.length).toBeGreaterThan(0);
  });

  it(`midnight-node is healthy at ${config.nodeUrl}`, async () => {
    const response = await tryFetch(`${config.nodeUrl}/health`);
    expect(
      response.ok,
      `midnight-node responded ${response.status} on ${config.nodeUrl}/health — the node is up but unhealthy.`,
    ).toBe(true);
  });

  it(`midnight-indexer answers GraphQL at ${config.indexerUrl}`, async () => {
    const response = await tryFetch(config.indexerUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "query { __typename }" }),
    });
    expect(
      response.ok,
      `midnight-indexer responded ${response.status} to a GraphQL query at ${config.indexerUrl} — ` +
        "the port is open but the GraphQL API is not serving.",
    ).toBe(true);
  });

  it(`midnight-proof-server is listening at ${config.proofServerUrl}`, async () => {
    // The proof server exposes no documented health route — any HTTP response
    // (even a 404) proves something is listening on the configured port.
    const response = await tryFetch(config.proofServerUrl);
    expect(response.status).toBeGreaterThan(0);
  });
});
