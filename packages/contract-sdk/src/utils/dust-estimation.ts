// Dust cost estimation for shared-canvas transactions.
//
// DUST is the fee token: it generates over time from NIGHT holdings and is
// consumed to pay for a transaction's footprint on the ledger. Before asking a
// user to sign extendCanvas/updateSquare, the app should be able to tell them
// what the call will do to their dust balance. This module turns a built
// transaction + the ledger's fee parameters into that answer, as a line-item
// breakdown.
//
// How the numbers are grounded (all SPECKs — the atomic dust unit):
//   • The ledger prices a transaction's SyntheticCost (bytes written, compute
//     and read time, blockspace) via `transaction.fees(ledgerParameters)`.
//   • A balancing wallet does not pay the bare minimum: the Midnight dust
//     wallet burns `feesWithMargin(params, feeBlocksMargin) +
//     additionalFeeOverhead` (its `costParameters`). Pass the same cost
//     parameters the paying wallet is configured with and `totalSpecks` is the
//     amount its dust spend will actually declare (its `vFee`).
//   • The storage/execution/blockspace split apportions the required fee
//     across the transaction's cost dimensions using the ledger's own
//     `feePrices` weights. The split is an attribution (the ledger prices the
//     transaction as a whole); the totals are exact.
//
// Everything here is pure arithmetic over values the caller already holds —
// type-only imports, no runtime dependency on the ledger WASM.
import type { LedgerParameters, SyntheticCost } from "@midnight-ntwrk/ledger-v8";

/**
 * The fee-related wallet configuration of whoever pays for the transaction.
 * Mirror of the wallet SDK's `costParameters` (see WalletFacade configuration):
 * the dust wallet burns `feesWithMargin(params, feeBlocksMargin) +
 * additionalFeeOverhead`, so an estimate is only as good as these match the
 * paying wallet's settings.
 */
export interface DustCostParameters {
  readonly feeBlocksMargin: number;
  readonly additionalFeeOverhead: bigint;
}

/**
 * The slice of the ledger `Transaction` API the estimator needs. Any
 * `Transaction<S, P, B>` satisfies it structurally. Fee values are only
 * accurate for proven transactions (the ledger estimates proof sizes
 * otherwise) — estimate post-proving, pre-submission, for exact numbers.
 */
export interface EstimatableTransaction {
  cost(params: LedgerParameters, enforceTimeToDismiss?: boolean): SyntheticCost;
  fees(params: LedgerParameters, enforceTimeToDismiss?: boolean): bigint;
  feesWithMargin(params: LedgerParameters, margin: number): bigint;
}

export const DustLineItemKind = {
  /** Persistent ledger growth: bytes this transaction writes into state. */
  StorageWrite: "storage-write",
  /** Processing: compute + read time, plus bytes churned (written transiently). */
  Execution: "execution",
  /** Blockspace the serialized transaction occupies. */
  Blockspace: "blockspace",
  /** Safety margin for block-fullness fee drift while the tx is in flight. */
  FullnessMargin: "fullness-margin",
  /** Flat overhead the paying wallet adds on top (its `additionalFeeOverhead`). */
  WalletOverhead: "wallet-overhead",
} as const;
export type DustLineItemKind = (typeof DustLineItemKind)[keyof typeof DustLineItemKind];

export interface DustLineItem {
  readonly kind: DustLineItemKind;
  readonly description: string;
  readonly specks: bigint;
}

export interface DustEstimate {
  /**
   * What the paying wallet will burn (its dust spend's `vFee`), assuming its
   * cost parameters match the ones given. Equals the sum of `lineItems`.
   */
  readonly totalSpecks: bigint;
  /** The bare minimum the ledger demands (no margin, no wallet overhead). */
  readonly requiredFeeSpecks: bigint;
  /** The total, decomposed. Sums exactly to `totalSpecks`. */
  readonly lineItems: readonly DustLineItem[];
  /** The raw resource cost the fee was derived from, for display/debugging. */
  readonly syntheticCost: SyntheticCost;
}

// Apportion `total` across `weights` in bigint arithmetic (weights scaled to
// integers), handing the rounding remainder to the heaviest bucket so the
// shares always sum exactly to `total`.
const WEIGHT_SCALE = 1e6;
function apportion(total: bigint, weights: readonly number[]): bigint[] {
  const scaled = weights.map((w) => BigInt(Math.round(Math.max(w, 0) * WEIGHT_SCALE)));
  const sum = scaled.reduce((a, b) => a + b, 0n);
  if (sum === 0n) {
    // Degenerate cost (nothing measurable) — put everything in the first bucket.
    return scaled.map((_, i) => (i === 0 ? total : 0n));
  }
  const shares = scaled.map((w) => (total * w) / sum);
  const allocated = shares.reduce((a, b) => a + b, 0n);
  const heaviest = scaled.reduce((best, w, i) => (w > scaled[best] ? i : best), 0);
  shares[heaviest] += total - allocated;
  return shares;
}

/**
 * Estimate the dust a transaction will cost its payer, as line items.
 *
 * @param transaction      The transaction to price. Use the proven transaction
 *                         for exact numbers (pre-proving values are estimates).
 * @param ledgerParameters The chain's CURRENT fee parameters — fetch them with
 *                         {@link fetchLedgerParameters}. Do not assume
 *                         `LedgerParameters.initialParameters()`: chains run
 *                         their own parameters (the local dev chain prices
 *                         transactions at next to nothing, for example).
 * @param costParameters   The paying wallet's fee settings — see
 *                         {@link DustCostParameters}.
 */
export function estimateDustCost(
  transaction: EstimatableTransaction,
  ledgerParameters: LedgerParameters,
  costParameters: DustCostParameters,
): DustEstimate {
  const syntheticCost = transaction.cost(ledgerParameters);
  const requiredFeeSpecks = transaction.fees(ledgerParameters);
  const feeWithMargin = transaction.feesWithMargin(ledgerParameters, costParameters.feeBlocksMargin);
  const totalSpecks = feeWithMargin + costParameters.additionalFeeOverhead;

  // Attribute the required fee across the ledger's priced cost dimensions,
  // weighted exactly as the fee prices weight them.
  const { readFactor, computeFactor, blockUsageFactor, writeFactor } = ledgerParameters.feePrices;
  const [storage, execution, blockspace] = apportion(requiredFeeSpecks, [
    writeFactor * Number(syntheticCost.bytesWritten),
    readFactor * Number(syntheticCost.readTime) +
      computeFactor * Number(syntheticCost.computeTime) +
      writeFactor * Number(syntheticCost.bytesChurned),
    blockUsageFactor * Number(syntheticCost.blockUsage),
  ]);

  const lineItems: DustLineItem[] = [
    {
      kind: DustLineItemKind.StorageWrite,
      description: `ledger storage (${syntheticCost.bytesWritten} bytes written)`,
      specks: storage,
    },
    {
      kind: DustLineItemKind.Execution,
      description: "execution (compute + reads + transient writes)",
      specks: execution,
    },
    {
      kind: DustLineItemKind.Blockspace,
      description: `blockspace (${syntheticCost.blockUsage} bytes of block)`,
      specks: blockspace,
    },
    {
      kind: DustLineItemKind.FullnessMargin,
      description: `block-fullness safety margin (${costParameters.feeBlocksMargin} blocks)`,
      specks: feeWithMargin - requiredFeeSpecks,
    },
    {
      kind: DustLineItemKind.WalletOverhead,
      description: "paying wallet's flat fee overhead",
      specks: costParameters.additionalFeeOverhead,
    },
  ];

  return { totalSpecks, requiredFeeSpecks, lineItems, syntheticCost };
}

/** A GraphQL response carrying the latest block's hex-encoded ledger parameters. */
interface LedgerParametersQueryResponse {
  readonly data?: { readonly block?: { readonly ledgerParameters?: string } | null } | null;
  readonly errors?: readonly { readonly message: string }[];
}

/**
 * Deserializes raw ledger-parameter bytes — pass the ledger's
 * `LedgerParameters` class itself (it has a static `deserialize`). Taking it
 * as an argument keeps this module free of any runtime ledger dependency and
 * guarantees the result comes from the caller's own WASM instance.
 */
export interface LedgerParametersDecoder<TParams> {
  deserialize(raw: Uint8Array): TParams;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Fetch the chain's current ledger (fee) parameters from a Midnight indexer's
 * GraphQL endpoint — every block carries them. These, not
 * `LedgerParameters.initialParameters()`, are what the network actually
 * charges (and what the paying wallet's balancer uses).
 *
 * @param indexerUrl The indexer's GraphQL HTTP endpoint.
 * @param decoder    `LedgerParameters` from the ledger package in use.
 */
export async function fetchLedgerParameters<TParams>(
  indexerUrl: string,
  decoder: LedgerParametersDecoder<TParams>,
): Promise<TParams> {
  const response = await fetch(indexerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "query { block { ledgerParameters } }" }),
  });
  if (!response.ok) {
    throw new Error(`indexer at ${indexerUrl} responded ${response.status} to the ledger-parameters query`);
  }
  const body = (await response.json()) as LedgerParametersQueryResponse;
  const hex = body.data?.block?.ledgerParameters;
  if (!hex) {
    const detail = body.errors?.map((e) => e.message).join("; ") ?? "no block in response";
    throw new Error(`indexer at ${indexerUrl} returned no ledger parameters: ${detail}`);
  }
  return decoder.deserialize(hexToBytes(hex));
}

/**
 * The slice of a (submitted) transaction needed to read what was actually
 * paid: each intent's dust actions carry spends whose `vFee` is the dust
 * irrevocably burned for fees. Any finalized `Transaction` satisfies this.
 */
export interface DustFeePayingTransaction {
  readonly intents:
    | ReadonlyMap<number, { readonly dustActions: { readonly spends: readonly { readonly vFee: bigint }[] } | undefined }>
    | undefined;
}

/**
 * The dust actually paid by a transaction: the sum of `vFee` over its dust
 * spends. On a submitted transaction this is the exact amount the payer's
 * dust balance drops by (before generation tops it back up). Compare with an
 * estimate's `totalSpecks` to validate it.
 */
export function paidDustFees(transaction: DustFeePayingTransaction): bigint {
  let total = 0n;
  for (const intent of transaction.intents?.values() ?? []) {
    for (const spend of intent.dustActions?.spends ?? []) {
      total += spend.vFee;
    }
  }
  return total;
}
