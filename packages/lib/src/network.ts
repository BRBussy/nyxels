// Network identity — the one place the Nyxels networks are defined.
//
// midnight-js types a network id as a bare `string` (`NetworkId`) with no
// companion enum, so this app-local `Network` is our source of named values.
// Convention: a network id is ALWAYS named `networkId` and ALWAYS typed
// `NetworkId` (so we're ready if the SDK ever narrows it), with values supplied
// from `Network`.
//
// `Network` is a const object + derived union rather than a TS `enum`: the
// tsconfig sets `erasableSyntaxOnly` (enums are not erasable syntax), and this
// pattern is the modern bundler-friendly equivalent — same `Network.Mainnet`
// value access and `Network` type usage at call sites.
import type { NetworkId } from "@midnight-ntwrk/midnight-js/network-id";

// Re-exported so consumers have a single import site for both the value object
// and the type. `NetworkId` remains the SDK's type.
export type { NetworkId };

export const Network = {
  /** Local standalone stack (Docker node + indexer + proof server on localhost). */
  Undeployed: "undeployed",
  /** Public test network for early/breaking changes — bleeding-edge ledger. */
  Preview: "preview",
  /** Public test network that mirrors mainnet config; the final staging step. */
  Preprod: "preprod",
  /** Production network (live, real value). */
  Mainnet: "mainnet",
} as const;
export type Network = (typeof Network)[keyof typeof Network];

export const NETWORKS: readonly Network[] = [Network.Undeployed, Network.Preview, Network.Preprod, Network.Mainnet];
