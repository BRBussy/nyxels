// Dust estimation test: validates @nyxels/contract-sdk's dust estimation tool
// against reality. Users of the shared-canvas app must be able to see what a
// method call will do to their dust balance BEFORE signing — so the estimate
// (computed on the transaction pre-submission) has to match both the fee the
// wallet actually attaches (the dust spend's vFee) and the observed dust
// balance drop.
//
// Self-contained and order-independent like the other method tests: it joins
// the contract itself and exercises extendCanvas as the method under estimate.
import { LedgerParameters, type FinalizedTransaction } from "@midnight-ntwrk/ledger-v8";
import { estimateDustCost, fetchLedgerParameters, paidDustFees, type DustEstimate } from "@nyxels/contract-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { config, resolveContractAddress, seed } from "../lib/config";
import { joinSharedCanvas, type JoinedSharedCanvas } from "../lib/contract";
import { COST_PARAMETERS } from "@nyxels/lib";
import { buildWallet, type Wallet } from "../lib/wallet";

// estimate vs the fee the wallet actually attaches: both derive from the same
// ledger fee model, differing only via the wallet's dry-run on a
// proof-erased transaction — a small allowance covers that.
const ESTIMATE_VS_PAID_TOLERANCE = 0.05;
// estimate vs observed balance drop: additionally absorbs dust generation
// accrued between the two balance snapshots.
const ESTIMATE_VS_CONSUMED_TOLERANCE = 0.1;

function relativeDifference(a: bigint, b: bigint): number {
  const reference = Number(a);
  return reference === 0 ? Number.POSITIVE_INFINITY : Math.abs(Number(a - b)) / reference;
}

function describeEstimate(estimate: DustEstimate): string {
  const items = estimate.lineItems
    .map((item) => `    ${item.specks} SPECKs — ${item.description} [${item.kind}]`)
    .join("\n");
  return `${items}\n    = ${estimate.totalSpecks} SPECKs total (ledger minimum ${estimate.requiredFeeSpecks})`;
}

describe("dust estimation", () => {
  let wallet: Wallet;
  let joined: JoinedSharedCanvas;
  let submitted: FinalizedTransaction | undefined;

  beforeAll(async () => {
    // Resolve the address before the (slow) wallet build so a missing
    // CONTRACT_ADDRESS/.contract-address fails immediately with instructions.
    resolveContractAddress();
    wallet = await buildWallet(seed, config);
    joined = await joinSharedCanvas(wallet, {
      onSubmitTransaction: (transaction) => {
        submitted = transaction;
      },
    });
  });

  afterAll(async () => {
    await wallet?.stop();
  });

  it("estimates extendCanvas's dust cost to match what is actually paid and consumed", async () => {
    // Snapshot wallet state before the call. Balances are evaluated later, at
    // one shared timestamp, so dust generated meanwhile cancels out of the
    // before/after comparison instead of polluting it.
    const stateBefore = await wallet.facade.waitForSyncedState();

    const result = await joined.contract.callTx.extendCanvas();
    console.log(`extendCanvas txId: ${result.public.txId}  block: ${result.public.blockHeight}`);

    expect(submitted, "the submit interceptor never saw the transaction").toBeDefined();
    const transaction = submitted as FinalizedTransaction;

    // The estimate, computed exactly as an app would pre-submission: the
    // proven transaction + the chain's CURRENT fee parameters (from the
    // indexer — what the network actually charges, and what the paying
    // wallet's balancer used) + the paying wallet's cost settings.
    const ledgerParameters = await fetchLedgerParameters(config.indexerUrl, LedgerParameters);
    const estimate = estimateDustCost(transaction, ledgerParameters, COST_PARAMETERS);
    console.log(`estimate for extendCanvas:\n${describeEstimate(estimate)}`);

    // Line items must decompose the total exactly, with nothing negative.
    expect(estimate.lineItems.reduce((sum, item) => sum + item.specks, 0n)).toBe(estimate.totalSpecks);
    for (const item of estimate.lineItems) {
      expect(item.specks, `line item ${item.kind} is negative`).toBeGreaterThanOrEqual(0n);
    }
    expect(estimate.totalSpecks).toBeGreaterThanOrEqual(estimate.requiredFeeSpecks);

    // 1. The estimate matches the fee the wallet actually attached (the dust
    //    spend's vFee — the exact amount burned for this transaction).
    const actuallyPaid = paidDustFees(transaction);
    console.log(`actually paid (vFee): ${actuallyPaid} SPECKs`);
    expect(actuallyPaid).toBeGreaterThan(0n);
    expect(
      relativeDifference(actuallyPaid, estimate.totalSpecks),
      `estimate ${estimate.totalSpecks} vs paid ${actuallyPaid} SPECKs differ by more than ` +
        `${ESTIMATE_VS_PAID_TOLERANCE * 100}%`,
    ).toBeLessThanOrEqual(ESTIMATE_VS_PAID_TOLERANCE);

    // 2. The dust balance drop agrees with the estimate. Both snapshots are
    //    priced at the same instant: the before-state's balance then says
    //    "what I would have had, had I not transacted", so the difference is
    //    the transaction's consumption with generation cancelled out.
    const stateAfter = await wallet.facade.waitForSyncedState();
    const now = new Date();
    const balanceBefore = stateBefore.dust.balance(now);
    const balanceAfter = stateAfter.dust.balance(now);
    const consumed = balanceBefore - balanceAfter;
    console.log(`dust balance: ${balanceBefore} -> ${balanceAfter} (consumed ${consumed} SPECKs)`);
    expect(consumed).toBeGreaterThan(0n);
    expect(
      relativeDifference(consumed, estimate.totalSpecks),
      `estimate ${estimate.totalSpecks} vs consumed ${consumed} SPECKs differ by more than ` +
        `${ESTIMATE_VS_CONSUMED_TOLERANCE * 100}%`,
    ).toBeLessThanOrEqual(ESTIMATE_VS_CONSUMED_TOLERANCE);
  });
});
