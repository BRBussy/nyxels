import { defineConfig } from "vitest/config";

// Integration tests prove + submit real transactions, so everything here is
// tuned for "slow but real": one test file at a time, generous timeouts (a
// single proof can take minutes on first run), and the forks pool so the
// Midnight WASM runtime loads once per process with no worker-thread surprises.
export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
