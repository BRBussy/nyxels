// Deploy test: deploys the compiled shared-canvas contract from
// @nyxels/contract-sdk and persists the address for the method tests.
//
// Witness bodies never execute in the contract constructor, so the witness
// implementation attached here is irrelevant to the deploy itself — we attach
// the same fixed operator identity the method tests use, purely so the stored
// private state is consistent everywhere.
import { deployContract } from "@midnight-ntwrk/midnight-js/contracts";
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config, zkConfigPath } from "./config";
import { buildWallet, type Wallet } from "./wallet";
import { buildProviders } from "./providers";
import {
    buildCompiledContract,
    INITIAL_PRIVATE_STATE,
    PRIVATE_STATE_ID,
    type SharedCanvasCircuit,
} from "./contract";

let wallet: Wallet;

async function main() {
    const rl = createInterface({ input: stdin, output: stdout });
    const seed = await rl.question('Enter wallet seed (hex, 12 or 24 word format) for deployment: ');

    console.debug("building wallet...");
    wallet = await buildWallet(seed, config);

    console.debug("constructing providers...");
    const providers = buildProviders<SharedCanvasCircuit>(wallet, zkConfigPath, config);

    console.debug("deploying contract...");
    const deployed = await deployContract(providers, {
        compiledContract: buildCompiledContract(),
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: INITIAL_PRIVATE_STATE,
    });

    const address = deployed.deployTxData.public.contractAddress;

    console.log(`deployed shared-canvas at ${address} (tx ${deployed.deployTxData.public.txId})`);
}


main()
.catch((e) => {
    console.error("error deploying contract", e);
})
.finally(async () => {
    console.debug("stopping wallet")
    if (!wallet) {
        return;
    }
    try {
        await wallet.stop();
    } catch (e) {
        console.error("error stopping contract", e)
    }
});