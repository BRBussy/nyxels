// Builds the midnight-js provider set used to deploy/call the contract,
// adapting our WalletFacade-based `Wallet` to midnight-js's
// WalletProvider/MidnightProvider.
//
// Why midnight-js here: `compact-js` gives us the CompiledContract binding and
// can run a circuit locally, but it does NOT assemble + prove + submit a ledger
// contract transaction. `@midnight-ntwrk/midnight-js` is the layer that does,
// via `deployContract`/`submitCallTx` driven by these providers.
import type {
  MidnightProviders,
  WalletProvider,
  MidnightProvider,
  UnboundTransaction,
} from "@midnight-ntwrk/midnight-js/types";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
// midnight-js reads a process-global network id internally (unlike compact-js,
// which takes it explicitly). Set it once, here, where every midnight-js
// consumer passes through.
import { setNetworkId } from "@midnight-ntwrk/midnight-js/network-id";

import type { Config } from "./config";
import type { Wallet } from "./wallet";

const TTL_MS = 30 * 60 * 1000;

/**
 * Adapt our `Wallet` (WalletFacade + keys) to midnight-js's wallet interfaces.
 * `balanceTx` balances the unbound tx with our dust/shielded keys then finalizes
 * (which proves); `submitTx` relays it.
 *
 * The midnight-js ledger types come from `midnight-js-protocol`; our facade uses
 * `ledger-v8`. They are the same underlying classes, so the values pass straight
 * through — the casts only bridge the two packages' nominal type identities.
 */
function createWalletProvider(wallet: Wallet): WalletProvider & MidnightProvider {
  const { facade, keys } = wallet;
  return {
    getCoinPublicKey: () => keys.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => keys.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: UnboundTransaction, ttl?: Date) {
      const recipe = await facade.balanceUnboundTransaction(
        tx as never,
        { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + TTL_MS) },
      );
      const signed = await facade.signRecipe(recipe, (payload) => keys.unshieldedKeystore.signData(payload));
      return (await facade.finalizeRecipe(signed)) as never;
    },
    submitTx: (tx) => facade.submitTransaction(tx as never) as never,
  };
}

/**
 * Build the full provider set for a contract whose compiled assets live at
 * `zkConfigPath`. `C` is the union of the contract's circuit ids (e.g.
 * `"extendCanvas"`), which `deployContract`/`submitCallTx` use to type calls.
 */
export function buildProviders<C extends string = string>(
  wallet: Wallet,
  zkConfigPath: string,
  config: Config,
): MidnightProviders<C> {
  setNetworkId(config.networkId);

  const zkConfigProvider = new NodeZkConfigProvider<C>(zkConfigPath);
  const walletProvider = createWalletProvider(wallet);
  const accountId = walletProvider.getCoinPublicKey();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: "nyxels-integration-tests-private-state",
      accountId,
      privateStoragePasswordProvider: () => `${Buffer.from(accountId, "hex").toString("base64")}!`,
    }),
    publicDataProvider: indexerPublicDataProvider(config.indexerUrl, config.indexerWsUrl),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proofServerUrl, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}
