# nyxels

A mashup of Nyx (the Greek goddess of the night) and pixels — a shared,
on-chain pixel canvas built on [Midnight](https://midnight.network).

The canvas is a grid of squares that grows from one corner along an L-shaped
path. Each square is owned and holds freehand strokes; stroke data is serialized
to a compact `Uint8Array` and stored on-chain per square.

## Monorepo layout

npm workspaces, three packages:

```
packages/
├─ contract/        @nyxels/contract      — Compact SOURCE (.compact) + tests
│                                            `npm run compile` → contract-sdk/managed
├─ contract-sdk/    @nyxels/contract-sdk  — COMPILED SDK: the generated managed/
│                                            artifacts (committed) + a stable
│                                            re-export surface for consumers
└─ ui/              @nyxels/ui            — the React SPA (Vite); drawing + the
                                            Stroke[] ⇄ Uint8Array codec
```

`contract/` owns the Compact source and the `compile` step, which writes the
generated artifacts into `contract-sdk/managed/`. Those artifacts are committed,
so `@nyxels/contract-sdk` and the UI build without the Compact toolchain
installed. The UI will consume `@nyxels/contract-sdk` to talk to the chain
(next step — not wired yet).

## Commands (from the repo root)

```bash
npm install            # install all workspaces
npm run dev            # run the UI (@nyxels/ui) dev server
npm test               # run all workspace test suites
npm run typecheck      # typecheck all workspaces
npm run compile        # recompile the Compact contract (needs the Compact toolchain)
```

Target a single package with `-w`, e.g. `npm run build -w @nyxels/ui`.

## Toolchain

- **Contract:** Compact compiler 0.31.0 / language 0.23 / runtime 0.16
  (`@midnight-ntwrk/compact-runtime`).
- **UI:** Vite 8 + React 19 + TypeScript 6 + perfect-freehand.
