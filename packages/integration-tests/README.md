# Nyxels Integration Tests

Comprehensive package of integration tests for Nyxels. Structred so that:

```
packages/
├─ contract/ # contract source under test
├─ contract-sdk/ # compiled contract under integration test
└─ integration-tests/ # this directory, integration tests for 
    ├─ package.json
    ├─ scripts
    |   ├─ run-all.sh # bash only, runs tests in order
    |   ├─ environment-check.sh # bash only, uses curl to check nodes
    |   ├─ compile-test.sh # bash only, uses compact compiler to run compile
    |   ├─ account-test.sh # bash to call associated .test.ts file in src/tests/account-test.test.ts
    |   ├─ deploy-test.sh  # bash to call associated .test.ts file in src/tests/account-test.test.ts
    |   └─ contract-interactions.sh
    └─ src
        ├─ lib # common components
        └─ tests # integration tests
            ├─ account-test.test.ts
            ├─ deploy-test.test.ts --> contract address captured and environement variable set
            ├─ contract-interactions.test.ts --> orchestrate all contract interactions tests
            └─ contract-interactions
                ├─ extend-canvas.test.ts --> specific method
                └─ update-square.test.ts

```

## Prerequisites

### Compact Compiler
Compact compiler required.

### Midnight Network & Proof Server
Integration tests are run against a configured network (see environment for configuration). Integration tests can run against a deployed network, but easiest is to run them againast a local (undeployed) network. It is easiest to set this up is using docker compose to run the required components:

- Component: midnight-proof-server
    - Recommended Image: midnightntwrk/proof-server:8.0.3
    - Available on Port: 6300
- Component: midnight-indexer
    - Recommended Image: midnightntwrk/indexer-standalone:4.0.1
    - Available on Port: 8088
- Component: midnight-node
    - Recommended Image: midnightntwrk/midnight-node:0.22.3
    - Available on Port: 9944

## Environment
Integration tests are configured with the following environment variables. Override to change defaults.
```sh
# Seed used for deployments and wallet interactions
SEED=0000000000000000000000000000000000000000000000000000000000000001

# Address of contract. Blank by default, populate if contract already deployed and only interaction tests are being done.
# Populated by the deploy-test.test.ts for subsequent tests to use from the environment. So ensure that runs first (at least once).
CONTRACT_ADDRESS=

# Local stack used by default. These are the endpoints.
NETWORK_ID=undeployed
INDEXER_URL=http://127.0.0.1:8088/api/v3/graphql
INDEXER_WS_URL=ws://127.0.0.1:8088/api/v3/graphql/ws
NODE_URL=http://127.0.0.1:9944
PROOF_SERVER_URL=http://127.0.0.1:6300
```

## Test Flow
Tests are run as follows, in sequence:
- environment check:
  - confirm compact compiler present
  - check for midnight-proof-server, midnight-indexer, midnight-node listening on the configured ports
- compile test: checks packages/contract compiles
- account test: checks account with configured seed is present, has NIGHT, has Dust.
- deploy test: deploys compiled contract with packages/contract-sdk
- contract interactions test: crux of the test! Tests methods:
  - extend canvas
  - update square