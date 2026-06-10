# Nyxels Integration Tests

Comprehensive integration test package for Nyxels. It exercises the full
contract lifecycle — environment, compile, account, deploy, interact — against
a real Midnight stack.

There are exactly **two ways to run** (no subset selection — that adds
unnecessary complexity):

1. **All tests, in order:** `npm test`
2. **A single test:** `npm run test:<name>` (e.g. `npm run test:deploy`,
   `npm run test:extend-canvas`)

A "single test" includes the individual contract-method tests — each method
(extend-canvas, update-square, …) is its own test with its own script. There
are deliberately no grouping scripts in between (no `test:interactions` that
runs all method tests): that would be subset selection.

Every test is independently runnable, with one caveat: the method tests need a
deployed contract, so either `CONTRACT_ADDRESS` is set in the environment, or
the deploy test has run at least once (it persists the address — see
[Contract address handoff](#contract-address-handoff)).

## Layout

Everything is driven from `package.json` — no bash wrappers. Each test is a
plain vitest file; "bash-flavoured" tests (port checks, invoking the compiler)
are done in-test via `fetch` and `child_process`, so the whole package is one
toolchain with uniform reporting.

```
packages/
├─ contract/             # Compact source under test
├─ contract-sdk/         # compiled contract (managed/ artifacts) under test
└─ integration-tests/    # this package
    ├─ package.json      # the only entry point: npm test / npm run test:<name>
    ├─ tsconfig.json
    ├─ vitest.config.ts  # forks pool, no file parallelism, generous timeouts (proving is slow)
    ├─ .env.example      # optional overrides — every var except CONTRACT_ADDRESS has a default
    ├─ .contract-address # gitignored; written by the deploy test, read by later tests
    └─ src/
        ├─ lib/                       # shared helpers (contract-agnostic where possible)
        │   ├─ config.ts              #   env + defaults; CONTRACT_ADDRESS resolution
        │   ├─ wallet.ts              #   seed → started, synced WalletFacade
        │   ├─ providers.ts           #   midnight-js providers (wallet as balancer/submitter)
        │   └─ contract.ts            #   CompiledContract binding + read/decode helpers
        └─ tests/                       # one file per test, numbered in run order
            ├─ 1-environment.test.ts    #   compiler present; node/indexer/proof-server reachable
            ├─ 2-compile.test.ts        #   packages/contract compiles cleanly
            ├─ 3-account.test.ts        #   SEED account synced, has NIGHT + DUST
            ├─ 4-deploy.test.ts         #   deploys via contract-sdk; persists the address
            ├─ 5-interactions/          #   one test per contract method
            │   ├─ extend-canvas.test.ts
            │   └─ update-square.test.ts
            └─ 6-dust-estimation.test.ts #  contract-sdk dust estimate vs actual dust paid/consumed
```

`npm test` is simply every test `&&`-chained in order:

```json
{
  "scripts": {
    "test": "npm run test:environment && npm run test:compile && npm run test:account && npm run test:deploy && npm run test:extend-canvas && npm run test:update-square && npm run test:dust-estimation",
    "test:environment": "vitest run src/tests/1-environment.test.ts",
    "test:compile": "vitest run src/tests/2-compile.test.ts",
    "test:account": "vitest run src/tests/3-account.test.ts",
    "test:deploy": "vitest run src/tests/4-deploy.test.ts",
    "test:extend-canvas": "vitest run src/tests/5-interactions/extend-canvas.test.ts",
    "test:update-square": "vitest run src/tests/5-interactions/update-square.test.ts",
    "test:dust-estimation": "vitest run src/tests/6-dust-estimation.test.ts"
  }
}
```

A failing test aborts the chain, so nothing downstream runs against a broken
precondition.

Because every method test can run alone (against a contract deployed at any
point in the past), each one must be **self-contained and order-independent**:
it builds its own wallet, joins the contract itself, and tolerates whatever
state previous runs left on chain — asserting on the *delta* it causes (or
resetting to a known state first), never on absolute values only a fresh
deployment would have.

## Prerequisites

### Compact compiler

The `compact` compiler must be on the `PATH` (the compile test invokes
`compact compile` exactly as `packages/contract`'s `compile` script does).

### Midnight network & proof server

Tests run against whatever stack the environment points at (see
[Environment](#environment)). They *can* target a deployed network, but the
easiest setup is a local (undeployed) stack via docker compose:

| Component              | Recommended image                       | Port |
| ---------------------- | --------------------------------------- | ---- |
| midnight-proof-server  | `midnightntwrk/proof-server:8.0.3`      | 6300 |
| midnight-indexer       | `midnightntwrk/indexer-standalone:4.0.1`| 8088 |
| midnight-node          | `midnightntwrk/midnight-node:0.22.3`    | 9944 |

## Environment

Every variable has a baked-in default (in `src/lib/config.ts`) targeting the
local stack — **except `CONTRACT_ADDRESS`**, which has none. With the docker
stack up, `npm test` works with no `.env` at all. Override via the environment
or an optional `.env` (copy `.env.example`).

```sh
# Seed used for deployment and wallet interactions.
# Default is the pre-funded dev account on the local chain.
SEED=0000000000000000000000000000000000000000000000000000000000000001

# Local stack endpoints (the defaults).
NETWORK_ID=undeployed
INDEXER_URL=http://127.0.0.1:8088/api/v3/graphql
INDEXER_WS_URL=ws://127.0.0.1:8088/api/v3/graphql/ws
NODE_URL=http://127.0.0.1:9944
PROOF_SERVER_URL=http://127.0.0.1:6300

# The one variable with NO default. Set it to run interaction tests against an
# already-deployed contract; leave it unset to have the deploy test provide it.
CONTRACT_ADDRESS=
```

### Contract address handoff

Each test runs as its own process, so the deploy test can't hand the address
to later tests through `process.env`. Instead:

1. `4-deploy.test.ts` deploys and writes the address to `.contract-address`
   (gitignored) in this package's root.
2. `config.ts` resolves the contract address as: `CONTRACT_ADDRESS` env var if
   set → otherwise `.contract-address` if present → otherwise fail with
   instructions ("set CONTRACT_ADDRESS or run `npm run test:deploy` first").

This makes both modes work naturally: a full `npm test` flows the freshly
deployed address into the method tests, and a lone
`npm run test:extend-canvas` reuses the last deployment (or an explicitly set
`CONTRACT_ADDRESS`).

## Test flow

Tests, in the order `npm test` runs them:

1. **Environment** — `compact` compiler resolvable; node, indexer and
   proof server respond on their configured endpoints.
2. **Compile** — `packages/contract` compiles cleanly into
   `packages/contract-sdk/managed` (shelling out to `compact compile`).
3. **Account** — the wallet built from `SEED` starts, syncs to the chain tip,
   and holds NIGHT and DUST (so deploy/call fees can be paid).
4. **Deploy** — deploys the compiled contract from `@nyxels/contract-sdk`,
   asserts the deploy transaction lands, and persists the contract address.
   Witness bodies never execute in the contract constructor, so dummy witness
   stubs are sufficient here regardless of what the contract declares.
5. **Method tests** — the crux. One test per contract method; each joins the
   deployed contract itself (`findDeployedContract`), proves + submits a real
   call, then reads the public state back via the indexer to assert the
   change:
   - **extend-canvas** — extends the canvas; asserts the new bounds.
   - **update-square** — updates a square; asserts the stored square data.
6. **Dust estimation** — validates `@nyxels/contract-sdk`'s dust estimation
   tool (`estimateDustCost` + `fetchLedgerParameters` + `paidDustFees`): it
   intercepts the finalized extendCanvas transaction pre-submission, estimates
   its line-item dust cost from the chain's current fee parameters, and
   asserts the estimate matches both the fee the wallet actually attached
   (the dust spend's `vFee`) and the observed dust balance drop (both
   balance snapshots priced at one timestamp so dust generation cancels out).
   On the local dev chain all three agree exactly.
